# Edge Cases

Cases the refactor script explicitly handles, skips, or flags. Read this when a frame in the return value's `skippedFrames` or `snapWarnings` list looks confusing.

## Cases the script handles

**Frames with only frames as children.** Common in screens built top-down. Each section is itself a frame, refactored on its own pass first; the outer pass then arranges the sections.

**Frames with mixed content** (text + rectangles + components). All are treated as opaque rectangles by the row/column detector. Their internal structure is not consulted, only their bounding boxes.

**Z-ordered overlapping decorations.** A card with a badge sitting on its top-right corner is a 2-D cluster. The badge and card get wrapped together in a `refactor-cluster` frame, which the outer pass then treats as a single block.

**Locked frames.** Unlocked at the start of the refactor pass and *not* re-locked. Designers should review which frames should still be locked after the run.

**Hidden frames.** Refactored normally. Visibility is preserved; the hidden flag has no effect on geometry-based detection.

**Component instances.** The instance frame itself is refactored if its `layoutMode === "NONE"`. The script does **not** push into a `COMPONENT_SET`'s internal variants — those need targeted treatment and are out of scope for this skill.

**Text with mixed font runs.** The font preload pass walks character-by-character via `getRangeFontName` for any text node where `fontName === figma.mixed`, so every used font is loaded before any structural mutation runs.

## Cases the script skips

A frame ends up in `result.skippedFrames` with a reason in these situations.

| Reason | What it means | What the designer should do |
|---|---|---|
| `"fewer than 2 children"` | A frame with 0 or 1 children has nothing to arrange. | Usually ignore. If the frame should be empty, leave it. |
| `"remained 2-D after wrapping"` | Even after wrapping each detected cluster, the wrappers themselves overlap. Genuinely 2-D layout — collage, dashboard with overlapping cards, decorative composition. | Refactor manually, or accept that this frame stays flat. |
| `"error: <message>"` | An exception was thrown mid-refactor. The frame was rolled back atomically (because `use_figma` is atomic) and skipped. | Read the message and report — likely a Plugin API edge case worth fixing in the script. |

## Cases the script flags but still applies

These show up in `result.snapWarnings` as `{ nodeId, side, shiftPx }`.

**Snap shift > 2 px.** A measured padding or item-spacing value was far enough from a 4 px multiple that snapping moved the layout visibly. The snap is still applied — consistency with the rest of the file beats pixel fidelity here — but the designer is told so they can eyeball the result.

**Overwritten constraints.** Any child whose constraints were not the default `{ horizontal: "MIN", vertical: "MIN" }` is recorded in `result.overwrittenConstraints`. Auto-layout supersedes constraints, so these are effectively wiped. If the designer had set `MAX` or `STRETCH` on a child intentionally, they may want to switch the child to `layoutPositioning = "ABSOLUTE"` after the refactor to keep that behavior.

## Cases the script intentionally does not handle

**Producing `layoutMode = "GRID"`.** Grid mode requires explicit row and column counts. Inferring those reliably from geometry is much harder than HORIZONTAL/VERTICAL and produces frequent false positives. The script outputs HORIZONTAL, VERTICAL, or wrapper-of-rows-as-VERTICAL instead. Designers who want a true grid can re-flip the resulting frame manually.

**Pushing children to FILL.** Every child ends up as `HUG` on both axes. Setting children to fill the container width is a design decision that depends on intent (a card's title should fill, but its icon should not), so the script defers that to the designer.

**Adjusting nested children of a refactored child.** Each frame is refactored once. If a refactored frame contained a card that has its own free-form internals, the card will *also* have been picked up by the bottom-up pass and refactored before its parent was. The outer pass does not re-enter children.

**Renaming.** The original frame names are preserved. New wrappers are named `refactor-cluster` so a designer can search for them after the run.
