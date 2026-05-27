// ─────────────────────────────────────────────────────────────────────────────
// auto-layout-refactor / scripts / refactor.js
//
// Walks the CURRENT PAGE of the open Figma file and converts every flat frame
// (layoutMode === "NONE") into a proper auto-layout structure. It does this
// in place — original frame IDs are preserved.
//
// HOW TO READ THIS FILE AS A DESIGNER
//   Each section is labeled with what it does. You can change the constants in
//   the CONFIG block at the top to tune behavior — snap unit, wrapper name,
//   overlap threshold — without touching the algorithm itself.
//
// HOW IT IS EXECUTED
//   This file is the JavaScript body you pass to the `use_figma` MCP tool.
//   The harness wraps it in an async function automatically, so top-level
//   `await` and `return` work as written. Do NOT wrap it in an IIFE.
//   Call with:  use_figma({ code: <contents of this file>, skillNames: "auto-layout-refactor,figma-use" })
// ─────────────────────────────────────────────────────────────────────────────


// ─── CONFIG ───────────────────────────────────────────────────────────────────
// All numbers a designer might want to change live here.

const SNAP_TO_PX = 4;            // padding & item-spacing are rounded to this
const WRAPPER_NAME = "refactor-cluster";  // name for frames created around ambiguous clusters
const MIN_OVERLAP_RATIO = 0.25;  // two children "overlap" on an axis if their
                                 // overlap is at least 25% of the smaller extent.
                                 // Lower = stricter row/column detection.
const SNAP_WARN_PX = 2;          // if a snap shifts an element by more than this,
                                 // flag it in the return value.


// ─── RETURN VALUE ─────────────────────────────────────────────────────────────
// Everything the agent reports back is collected here.

const result = {
  refactoredFrameIds: [],
  wrappedClusterIds: [],
  snapWarnings: [],          // { nodeId, side, shiftPx }
  skippedFrames: [],         // { id, reason }
  overwrittenConstraints: [] // { nodeId, original: { horizontal, vertical } }
};


// ─── FONT PRELOAD ─────────────────────────────────────────────────────────────
// Per figma-use rule #8: ANY operation on a node that *contains* text needs
// the fonts of those text nodes loaded first. Since we will be re-parenting
// and re-ordering children of frames that may contain text, we preload every
// font used on the current page before doing anything else.
//
// findAllWithCriteria pre-narrows to TEXT nodes (faster than a generic findAll
// callback). getStyledTextSegments returns one entry per style run, so a text
// node with mixed fonts gives us each run's fontName without walking chars.
// All loadFontAsync calls are batched with Promise.all — sequential awaits
// would cost one round-trip per font.

const textNodes = figma.currentPage.findAllWithCriteria({ types: ["TEXT"] });
const fontKeys = new Set();
for (const t of textNodes) {
  for (const seg of t.getStyledTextSegments(["fontName"])) {
    fontKeys.add(JSON.stringify(seg.fontName));
  }
}
await Promise.all(
  [...fontKeys].map(k => figma.loadFontAsync(JSON.parse(k)))
);


// ─── COLLECT CANDIDATES (BOTTOM-UP) ───────────────────────────────────────────
// A "candidate" is any FrameNode on the current page whose layoutMode is
// currently "NONE" and which has 2 or more children. We sort candidates by
// depth descending so the innermost frames are refactored first — by the time
// we touch an outer frame, its inner frames are already solid auto-layout
// units and behave as opaque blocks.

function depthOf(node) {
  let d = 0;
  let cur = node.parent;
  while (cur && cur.type !== "PAGE") { d++; cur = cur.parent; }
  return d;
}

// findAllWithCriteria pre-narrows to frame-like nodes that support layoutMode.
// We INCLUDE COMPONENT and INSTANCE deliberately — the designer chose
// "process everything", including legacy components.
const candidates = figma.currentPage
  .findAllWithCriteria({ types: ["FRAME", "COMPONENT", "INSTANCE"] })
  .filter(n => n.layoutMode === "NONE" && n.children.length >= 2)
  .sort((a, b) => depthOf(b) - depthOf(a)); // deepest first


// ─── GEOMETRY HELPERS ─────────────────────────────────────────────────────────

// Bounding box of a child in its PARENT's coordinate space.
// child.x/y are already parent-relative, so this is straightforward.
function bbox(child) {
  return { x: child.x, y: child.y, w: child.width, h: child.height };
}

// 1-D overlap ratio: how much of the smaller extent is covered by the overlap.
function overlapRatio1D(aStart, aEnd, bStart, bEnd) {
  const overlap = Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
  const smaller = Math.min(aEnd - aStart, bEnd - bStart);
  if (smaller <= 0) return 0;
  return overlap / smaller;
}

// Snap a measured pixel value to the configured unit (default 4), and return
// { value, shift } so we can warn if a snap visibly moved something.
function snap(px) {
  const value = Math.round(px / SNAP_TO_PX) * SNAP_TO_PX;
  return { value, shift: Math.abs(value - px) };
}

// Median of an array. More robust than mean for legacy layouts where one big
// gap (e.g. a footer separated from a content block) skews the average.
function median(nums) {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}


// ─── ROW / COLUMN / CLUSTER DETECTION ─────────────────────────────────────────
// Returns one of:
//   { kind: "VERTICAL",   order: [...children] }
//   { kind: "HORIZONTAL", order: [...children] }
//   { kind: "CLUSTERED",  groups: [[children...], [children...], ...] }
//
// CLUSTERED means the children form 2-D groups we can't linearize. The caller
// wraps each group into a sub-frame, then re-runs the decision on the now-
// reduced set of "items".

function detectLayout(children) {
  if (children.length < 2) return { kind: "VERTICAL", order: children };

  const boxes = children.map(c => ({ node: c, ...bbox(c) }));

  // Build an overlap graph: two children are connected if they overlap on
  // BOTH axes (i.e. they sit on top of each other in 2-D). Those connected
  // components are the clusters.
  const n = boxes.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (i, j) => { parent[find(i)] = find(j); };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = boxes[i], b = boxes[j];
      const xOv = overlapRatio1D(a.x, a.x + a.w, b.x, b.x + b.w);
      const yOv = overlapRatio1D(a.y, a.y + a.h, b.y, b.y + b.h);
      if (xOv >= MIN_OVERLAP_RATIO && yOv >= MIN_OVERLAP_RATIO) union(i, j);
    }
  }

  // Group boxes by their cluster root.
  const groupMap = new Map();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groupMap.has(root)) groupMap.set(root, []);
    groupMap.get(root).push(boxes[i]);
  }
  const groups = [...groupMap.values()];

  // If multiple groups exist AND any group has more than one member, this is
  // a 2-D clustered layout — kick the wrapper logic in.
  const hasMultiMemberCluster = groups.some(g => g.length > 1);
  if (hasMultiMemberCluster && groups.length > 1) {
    return { kind: "CLUSTERED", groups: groups.map(g => g.map(b => b.node)) };
  }

  // Otherwise all children are linearly arrangeable. Decide the axis by
  // counting axis-overlap pairs:
  //   - low Y-overlap among consecutive children → VERTICAL stack
  //   - low X-overlap among consecutive children → HORIZONTAL row
  // We tally both and pick the cleaner one.
  let yOverlapPairs = 0, xOverlapPairs = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = boxes[i], b = boxes[j];
      if (overlapRatio1D(a.y, a.y + a.h, b.y, b.y + b.h) >= MIN_OVERLAP_RATIO) yOverlapPairs++;
      if (overlapRatio1D(a.x, a.x + a.w, b.x, b.x + b.w) >= MIN_OVERLAP_RATIO) xOverlapPairs++;
    }
  }

  // Fewer X-overlap pairs means children are stacked horizontally cleanly.
  if (xOverlapPairs <= yOverlapPairs) {
    const sorted = [...boxes].sort((a, b) => a.x - b.x).map(b => b.node);
    return { kind: "HORIZONTAL", order: sorted };
  } else {
    const sorted = [...boxes].sort((a, b) => a.y - b.y).map(b => b.node);
    return { kind: "VERTICAL", order: sorted };
  }
}


// ─── WRAP A CLUSTER INTO AN INTERMEDIATE FRAME ────────────────────────────────
// Creates a new FrameNode at the cluster's bounding box, re-parents the
// cluster's children into it, and rebases their x/y so they keep their
// visual positions. The wrapper itself stays layoutMode = "NONE" — it's a
// "this stuff goes together" container, not an auto-layout participant.

function wrapCluster(parent, clusterChildren) {
  // Compute bounding box of the cluster in the parent's coord space.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of clusterChildren) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + c.width);
    maxY = Math.max(maxY, c.y + c.height);
  }

  const wrapper = figma.createFrame();
  wrapper.name = WRAPPER_NAME;
  wrapper.fills = []; // transparent — purely structural
  wrapper.clipsContent = false;
  wrapper.resize(maxX - minX, maxY - minY);

  // Insert wrapper as a sibling at the position of the topmost cluster child
  // (lowest index in parent's children means topmost in z-order).
  const topmostIdx = Math.min(...clusterChildren.map(c => parent.children.indexOf(c)));
  parent.insertChild(topmostIdx, wrapper);

  // Position wrapper at the cluster's bbox in parent space.
  wrapper.x = minX;
  wrapper.y = minY;

  // Re-parent each child. appendChild keeps x/y values numerically the same,
  // so after appending we rebase to the wrapper's origin.
  for (const c of clusterChildren) {
    const origX = c.x, origY = c.y;
    wrapper.appendChild(c);
    c.x = origX - minX;
    c.y = origY - minY;
  }

  result.wrappedClusterIds.push(wrapper.id);
  return wrapper;
}


// ─── REFACTOR A SINGLE FRAME IN PLACE ─────────────────────────────────────────

function refactorFrame(frame) {
  // Skip frames we genuinely can't touch.
  if (frame.children.length < 2) {
    result.skippedFrames.push({ id: frame.id, reason: "fewer than 2 children" });
    return;
  }

  // The designer chose "process everything" — so we unlock locked frames
  // for the duration of the refactor. We don't re-lock at the end because
  // the designer should review which frames *should* still be locked.
  if (frame.locked) frame.locked = false;

  // Capture original dimensions BEFORE flipping layoutMode — once auto-layout
  // is on with HUG sizing modes, the frame will shrink to its content.
  const origW = frame.width;
  const origH = frame.height;

  // Record any non-default constraints we're about to overwrite, so the
  // designer can decide if they want to re-apply.
  for (const c of frame.children) {
    if ("constraints" in c) {
      const con = c.constraints;
      const isDefault = con.horizontal === "MIN" && con.vertical === "MIN";
      if (!isDefault) {
        result.overwrittenConstraints.push({
          nodeId: c.id,
          original: { horizontal: con.horizontal, vertical: con.vertical }
        });
      }
    }
  }

  // Decide the layout. If it's clustered, wrap each cluster first, then
  // re-run detection on the reduced set of items.
  let decision = detectLayout(frame.children);
  if (decision.kind === "CLUSTERED") {
    for (const group of decision.groups) {
      if (group.length > 1) wrapCluster(frame, group);
    }
    decision = detectLayout(frame.children);
    // If it's STILL clustered, give up gracefully — leaves the wrappers in
    // place but doesn't force a bad auto-layout on top.
    if (decision.kind === "CLUSTERED") {
      result.skippedFrames.push({ id: frame.id, reason: "remained 2-D after wrapping" });
      return;
    }
  }

  // Measure padding from the original geometry, per side.
  const boxes = frame.children.map(c => bbox(c));
  const minLeft   = Math.min(...boxes.map(b => b.x));
  const minTop    = Math.min(...boxes.map(b => b.y));
  const maxRight  = Math.max(...boxes.map(b => b.x + b.w));
  const maxBottom = Math.max(...boxes.map(b => b.y + b.h));

  const padL = snap(minLeft);
  const padT = snap(minTop);
  const padR = snap(origW - maxRight);
  const padB = snap(origH - maxBottom);

  for (const [side, s] of [["left", padL], ["top", padT], ["right", padR], ["bottom", padB]]) {
    if (s.shift > SNAP_WARN_PX) {
      result.snapWarnings.push({ nodeId: frame.id, side: `padding-${side}`, shiftPx: s.shift });
    }
  }

  // Measure item spacing along the chosen primary axis.
  const orderedBoxes = decision.order.map(c => bbox(c));
  const gaps = [];
  for (let i = 1; i < orderedBoxes.length; i++) {
    const prev = orderedBoxes[i - 1], cur = orderedBoxes[i];
    if (decision.kind === "VERTICAL") {
      gaps.push(cur.y - (prev.y + prev.h));
    } else {
      gaps.push(cur.x - (prev.x + prev.w));
    }
  }
  const medianGap = median(gaps.map(g => Math.max(0, g))); // negative gap = overlap, clamp to 0
  const itemSpacingSnap = snap(medianGap);
  if (itemSpacingSnap.shift > SNAP_WARN_PX) {
    result.snapWarnings.push({ nodeId: frame.id, side: "itemSpacing", shiftPx: itemSpacingSnap.shift });
  }

  // Reorder children by position BEFORE flipping layoutMode. Otherwise Figma
  // keeps z-order and visual order diverges from logical order.
  for (const child of decision.order) {
    frame.appendChild(child); // appending moves to end of children — order is now correct
  }

  // Flip layout mode. This is the moment Figma reflows.
  frame.layoutMode = decision.kind;

  // Apply measured spacing.
  frame.paddingLeft   = padL.value;
  frame.paddingRight  = padR.value;
  frame.paddingTop    = padT.value;
  frame.paddingBottom = padB.value;
  frame.itemSpacing   = itemSpacingSnap.value;

  // Preserve original dimensions exactly. resize() must be called BEFORE
  // setting layoutSizing* — resize resets the sizing modes to FIXED, which
  // is what we want here anyway, but explicit is safer.
  frame.resize(origW, origH);
  frame.layoutSizingHorizontal = "FIXED";
  frame.layoutSizingVertical   = "FIXED";

  // Children default to HUG on both axes, which is the right starting point
  // for nested cards/buttons. The designer can flip individual children to
  // FILL later. Setting HUG requires the child to be in an auto-layout parent
  // (it already is, since we just flipped layoutMode above).
  for (const c of frame.children) {
    if ("layoutSizingHorizontal" in c) {
      try { c.layoutSizingHorizontal = "HUG"; } catch (_) { /* TEXT in fixed mode etc. */ }
      try { c.layoutSizingVertical   = "HUG"; } catch (_) {}
    }
  }

  result.refactoredFrameIds.push(frame.id);
}


// ─── MAIN LOOP ────────────────────────────────────────────────────────────────

for (const frame of candidates) {
  // The frame may have been wrapped inside a cluster by a deeper iteration —
  // if so, its parent changed and depth ordering is stale. Re-check it's
  // still a refactor target before touching it.
  if (frame.layoutMode !== "NONE") continue;
  if (!("children" in frame) || frame.children.length < 2) continue;

  try {
    refactorFrame(frame);
  } catch (err) {
    result.skippedFrames.push({ id: frame.id, reason: `error: ${err.message}` });
  }
}


// ─── RETURN ───────────────────────────────────────────────────────────────────
// Per figma-use rule #15: return all created/mutated node IDs.

return result;
