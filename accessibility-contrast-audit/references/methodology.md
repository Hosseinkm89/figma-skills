# Methodology — how the audit decides things

How the script turns a page of frames into per-frame verdicts and a report. Read
this when a result looks surprising, or when you want to extend the logic.

## 1. What gets audited

- The script walks **top-level children of the current page** only.
- It audits containers: `FRAME`, `COMPONENT`, `COMPONENT_SET`, `SECTION`, and
  top-level `INSTANCE` nodes. Loose shapes/text sitting bare on the canvas are
  skipped — they aren't a "screen" worth a row.
- Inside each top-level frame it traverses the whole subtree (`findAll`) to find
  text and UI nodes. `figma.skipInvisibleInstanceChildren = true` keeps hidden
  instance internals out of the traversal for speed.

## 2. Resolving the "background behind" an element

Contrast needs two colors. The text/stroke color is easy; the background is the
hard part. The script:

1. Walks **up the ancestor chain** from the element to the page.
2. Starts from a base background (white by default — configurable via
   `defaultBackground`) and **composites each ancestor's first visible solid
   fill** inward, respecting layer and fill opacity.
3. Uses the resulting color as the background.

This handles the common case (text on a card on a page) well. It does **not**
solve every case — a label sitting over a photo, a gradient, or a sibling shape
that visually sits behind it but isn't an ancestor will fall back to the nearest
solid ancestor or the default. Those are exactly the situations the "not scored"
note and the non-text *review* framing are there to catch.

## 3. Scoring text per run, not per node

A single text layer can mix colors and sizes. The script uses
`getStyledTextSegments(['fills','fontSize','fontName','fontWeight'])` so each
**run** is measured with its own color, size, and weight — no "mixed" values.

- Whitespace-only runs are skipped (no visible glyphs to judge).
- Runs whose fill is a gradient or image are **counted as "not scored"** and
  surfaced in the row's meta line — never silently passed.
- A tiny epsilon (0.005) is allowed at the boundary so a value that rounds to the
  exact threshold (e.g. 4.50:1) is treated as a pass.

## 4. Rolling up to a frame verdict

For each frame:

- **Text AA** passes only if **every** scored run meets its AA requirement.
- **Text AAA** passes only if every scored run meets its AAA requirement.
- **Non-text 3:1** passes only if every checked UI stroke meets 3:1.
- If there's nothing to score for a level (e.g. no text, or no UI strokes), that
  badge is **N/A** rather than a false PASS.

The row's grey meta line shows the worst (minimum) text ratio and worst UI ratio
so you can see *how close* a frame is, plus a count of any runs that weren't
scored.

## 5. The report page

- A new page `♿ Contrast Audit — <date>` is created with `figma.createPage()`.
- The report is one vertical auto-layout column: header → legend card → results
  table → footer. Everything is auto-layout so it reflows if you edit it.
- Each frame name is a text node with a **NODE hyperlink** to the audited frame
  (`setRangeHyperlink(0, len, { type: 'NODE', value: frameId })`). Figma only
  allows NODE hyperlink targets that are a page or a **frame** — top-level frames
  qualify, which is why the audit scopes to them.
- The node id is printed under each name so the address is visible even in a
  flattened export or screenshot.
- All report colors clear AA against their own backgrounds, so the audit never
  emits an inaccessible artifact.

## 6. Extending it

- **Add a column** (e.g. "AA Large only"): compute it in `auditFrame`, add a
  badge in the data-row loop, and widen the table.
- **Change the background fallback**: pass `defaultBackground: {r,g,b}` (0–1) —
  useful for dark-themed files where the canvas is dark, not white.
- **Audit a different scope**: change `AUDIT_TOP_TYPES` or replace
  `sourcePage.children` with a selection-based list.
