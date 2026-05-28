---
name: auto-layout-refactor
description: Converts flat Figma frames built with absolute (free-form) positioning into proper auto-layout structures, in place. Triggers when the user describes a legacy or messy Figma file where layers were dragged into position instead of stacked — phrasings like "this file has no auto-layout", "everything is absolutely positioned", "refactor this screen to auto-layout", "auto-layout this page", "convert these frames to auto-layout", "clean up this old Figma file", "the layout is flat / has no structure", "add auto-layout to these frames", "wrap these into auto-layout", "fix this legacy layout", or "auto-layoutify". Also trigger when a designer opens an old design and asks for help making it editable, responsive, or maintainable. Do NOT trigger for creating new layouts from scratch (use figma-generate-design) or for component construction (use figma-generate-library).
---

# Auto-Layout Refactor

Old Figma files are full of frames where every layer was dragged into position by hand. Nothing is stacked, nothing reflows, and editing one element shifts everything else. This skill takes those flat frames and turns them into proper auto-layout structures the designer can actually maintain — without redrawing the screen.

The skill always loads alongside [figma-use](../figma-use/SKILL.md), which covers the Plugin API rules required by `use_figma`. Load `figma-use` first.

## What this skill does

Walks the **current page** of the open Figma file, finds every frame whose `layoutMode === "NONE"`, and refactors each one **bottom-up** into auto-layout:

1. **Detects intent from geometry** — clusters children into rows and columns based on bounding-box overlap, picks `HORIZONTAL` or `VERTICAL` per frame, and wraps any cluster that doesn't fit a clean axis into an intermediate frame.
2. **Reorders children by position** before flipping `layoutMode`, so Figma's auto-arrange doesn't scramble the visual order.
3. **Measures padding and gap from the original layout**, snapped to the nearest 4 px.
4. **Preserves the frame's original width and height** as `FIXED` on both axes, so the screen does not visibly reflow.
5. **Processes everything** — instances, locked layers, hidden layers all participate in the refactor. The designer asked for an aggressive cleanup pass, not a conservative one.
6. **Modifies frames in place.** Original frame IDs are preserved. Returns lists of refactored frame IDs and any clusters that were wrapped so the designer can review what changed.

## When to use this skill vs. an adjacent one

| Task | Use this skill? |
|---|---|
| "This screen has no auto-layout" / "everything's free-positioned" | **Yes** |
| "Auto-layout this old file" | **Yes** |
| "Make this responsive" *(on a flat layout)* | **Yes** — refactor first, then the designer can switch sizing modes |
| "Build a new screen from this code" | No → [figma-generate-design](../figma-generate-design/SKILL.md) |
| "Make this into a reusable component" | No → [figma-generate-library](../figma-generate-library/SKILL.md) |
| "Check what's out of compliance with our DS" | No → audit-design-system |

## Locked-in defaults (do not ask the designer again)

The designer who built this skill chose these defaults deliberately:

- **Scope:** the **whole current page**, recursing into nested frames bottom-up.
- **Ambiguous clusters** (overlapping children, irregular spacing, decorations): **wrap into an intermediate frame** named `"refactor-cluster"` with `layoutMode = "NONE"`, then continue the outer refactor treating that wrapper as one block.
- **Destructive:** modify frames **in place**. Do not duplicate. The designer relies on Figma's undo stack.
- **Spacing math:** snap measured padding and gap to the **nearest 4 px**. If a snap shifts an element by more than 2 px, flag it in the return value but still apply the snap.
- **Instances, locked, hidden:** **process everything**. Unlock locked frames, refactor inside them. Hidden layers are treated as normal layout participants.
- **Default sizing:** `layoutSizingHorizontal = "FIXED"` and `layoutSizingVertical = "FIXED"` on the refactored frame, locked to its measured pre-refactor width/height. Children inherit `HUG` unless they were already filling the frame.

If the designer wants different behavior, treat it as a new variant of the skill, not a runtime question.

## How to run it

1. Load [figma-use](../figma-use/SKILL.md) first (mandatory before any `use_figma` call).
2. Read [references/algorithm.md](references/algorithm.md) to understand the row/column detection pass — this is the part most likely to need adjustment for an unusual file.
3. **Inspect before refactoring.** Run a small read-only `use_figma` call to confirm the page name, top-level frame count, and how many of those frames have `layoutMode === "NONE"`. Report that count to the designer before you start mutating anything.
4. Run [scripts/refactor.js](scripts/refactor.js) via `use_figma`. The script is parameterized at the top — `SNAP_TO_PX`, `WRAPPER_NAME`, `MIN_OVERLAP_RATIO` — and is meant to be read by a designer, not just executed.
5. After it returns, take a `get_screenshot` of the page and compare against the pre-refactor state. The most common failure mode is z-order rearrangement of overlapping decorative layers — those are the cases the wrapper logic is meant to catch.

## Refactor rules the script follows

These are baked into `scripts/refactor.js`. Listed here so the designer reading the skill can verify the behavior matches their mental model:

- **Bottom-up traversal.** Innermost frames are refactored first so they become solid units before their parent runs its layout pass.
- **Row vs. column decision.** For each frame, compute pairwise vertical overlap of children. If most children's Y-ranges *do not* overlap with their neighbors' (i.e. they sit clearly above/below each other), the frame is `VERTICAL`. If most children's X-ranges do not overlap with neighbors', it's `HORIZONTAL`. If both fail, it's a 2-D layout and gets the wrapper treatment per cluster.
- **Cluster detection.** Children that overlap on *both* axes with another child are flagged as a cluster. Clusters are wrapped together into a `"refactor-cluster"` frame at the cluster's bounding box, with children re-parented and their x/y rebased to the wrapper's origin.
- **Padding measurement.** Padding on each side = distance from the frame's inner edge to the nearest child edge on that side, snapped to 4.
- **Gap measurement.** Item spacing = median of the gaps between consecutive children along the primary axis, snapped to 4. Median is more robust than mean for legacy files where one outlier gap is common.
- **Reorder before flipping.** Children are sorted by their position along the chosen primary axis, then re-appended in that order via `frame.appendChild`, before `layoutMode` is set. Without this, Figma keeps z-order and visual order diverges.
- **Size preservation.** The frame's `width` and `height` are captured before `layoutMode` is set, and re-applied after via `frame.resize(w, h)` followed by `layoutSizingHorizontal = "FIXED"` / `layoutSizingVertical = "FIXED"`.

## Known limitations

- **Components and instances** are processed in the outer pass but the script does *not* push into a `COMPONENT_SET`'s internal variants — those need their own refactor strategy and are out of scope.
- **Constraints** on the original free-form children are overwritten when `layoutMode` is set. The script reports any child that had a non-default constraint so the designer can decide whether to re-apply.
- **Text auto-resize** is left untouched. A `TEXT` node set to "fixed size" stays fixed; one set to "auto width" stays that way. The refactor is structural, not typographic.
- **Grids** (`layoutMode = "GRID"`) are not produced. The script outputs `HORIZONTAL`, `VERTICAL`, or wrapper-of-rows-as-vertical. Grid mode requires explicit row/column counts the script can't reliably infer.

See [references/edge-cases.md](references/edge-cases.md) for the full list of cases the algorithm explicitly handles or skips, and what the return value looks like for each.

## Validation after running

After every refactor run, return this structure from the `use_figma` call so the designer can act on it:

```js
return {
  refactoredFrameIds: [...],           // frames whose layoutMode was changed
  wrappedClusterIds: [...],            // new "refactor-cluster" frames created
  snapWarnings: [...],                 // { nodeId, side, shiftPx } where snap moved something >2px
  skippedFrames: [...],                // { id, reason } — frames the script decided not to touch
  overwrittenConstraints: [...]        // { nodeId, original } — designer may want to re-apply
}
```

Surface the counts to the designer in conversation, then offer a `get_screenshot` of any frame that appears in `snapWarnings` or `overwrittenConstraints`.

## Reference files

| File | Read when |
|---|---|
| [references/algorithm.md](references/algorithm.md) | You need to understand or tune the row/column/cluster detection pass |
| [references/edge-cases.md](references/edge-cases.md) | The script flags a frame as skipped, or the designer reports a refactor that looks wrong |
| [examples/before-after.md](examples/before-after.md) | You want to see a worked example of the algorithm on a small layout |
