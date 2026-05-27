# Algorithm Reference

How `scripts/refactor.js` decides what to do with each frame. Read this when you need to understand a refactor's output, tune the constants, or debug a frame that came out wrong.

## Traversal: bottom-up

The script first collects every `FrameNode`, `ComponentNode`, and `InstanceNode` on the current page where `layoutMode === "NONE"` and `children.length >= 2`. It sorts them by depth descending and processes the deepest first.

The reason is order of operations. If an outer frame contains a card that is itself a flat layout, refactoring the outer frame first would treat the card as a loose pile of layers. Refactoring the card first turns it into a single auto-layout block — the outer pass then sees a clean rectangle, and its row/column detection becomes trustworthy.

## Per-frame decision

For each candidate frame, the script computes a bounding box for every child in the frame's coordinate space and runs three independent passes.

### 1. Cluster detection

Two children are considered to be in the same 2-D cluster if their bounding boxes overlap on *both* axes by at least `MIN_OVERLAP_RATIO` (default 25%) of the smaller extent. The script builds a union-find over child pairs and groups the connected components.

- If there are multiple groups and at least one has more than one child, the frame is **clustered**. Each multi-child group is wrapped into a `refactor-cluster` frame (positioned at the cluster's bounding box, with children's x/y rebased), then detection runs again on the now-flatter set of items.
- If detection still returns *clustered* on the second pass — meaning even the wrappers overlap each other — the frame is skipped and reported in `skippedFrames`. Forcing auto-layout on a genuinely 2-D layout produces nonsense.

### 2. Axis decision

Once children are linearly arrangeable, the script counts how many pairs of children overlap on the X axis vs. the Y axis (using the same overlap threshold).

- Fewer X-axis overlaps means children stack horizontally cleanly → `HORIZONTAL`.
- Fewer Y-axis overlaps means children stack vertically cleanly → `VERTICAL`.
- Ties go to `VERTICAL` (most pages and screens stack vertically by default).

Children are then sorted by their position along the chosen primary axis.

### 3. Spacing inference

- **Padding** on each side = distance from the frame's inner edge to the nearest child edge, snapped to the nearest 4 px.
- **Item spacing** = median of consecutive child gaps along the primary axis, snapped to 4. Median is used instead of mean so one outlier gap (a footer separated from the content, for example) does not skew the result.
- If a snap shifts an element by more than 2 px, a `snapWarnings` entry is recorded but the snap is still applied.

## Applying the refactor

The script applies changes in a strict order. Any other order produces visible bugs.

1. Re-append children in the sorted order. Figma respects child index when `layoutMode` is set, so the order has to be correct *before* the flip.
2. Set `layoutMode` to the decided value. This is the moment Figma reflows.
3. Set padding and item spacing.
4. Call `resize(origW, origH)` to restore the frame's pre-refactor dimensions.
5. Set `layoutSizingHorizontal = "FIXED"` and `layoutSizingVertical = "FIXED"` so the size sticks.
6. For each child, attempt to set `layoutSizingHorizontal/Vertical = "HUG"`. Some children (notably `TEXT` nodes in fixed-width mode) will throw on this — the attempt is wrapped in try/catch and the child is left as-is.

## Constants

| Constant | Default | Effect |
|---|---|---|
| `SNAP_TO_PX` | `4` | Padding and item spacing round to this multiple. Set to `8` for a coarser grid, `1` to disable. |
| `WRAPPER_NAME` | `"refactor-cluster"` | Name applied to frames the script creates around 2-D clusters. Easy to search-and-rename after the fact. |
| `MIN_OVERLAP_RATIO` | `0.25` | Two children "overlap" on an axis if the overlap is at least this fraction of the smaller extent. Lower = stricter row/column detection. Raise to `0.4` if rows are being incorrectly merged. |
| `SNAP_WARN_PX` | `2` | A snap that shifts an element more than this is recorded in `snapWarnings`. |

All four live at the top of `scripts/refactor.js`. They are the levers a designer can pull without touching the algorithm itself.
