# Worked Example — Settings Screen

A real before/after for one screen, tracing the algorithm step by step.

## Input: a flat "Account Settings" screen

A 400 × 600 frame named `AccountSettings`, layoutMode `NONE`. Its children, with positions and sizes in the parent's coordinate space:

| # | Name | x | y | w | h |
|---|---|---|---|---|---|
| 1 | `Header` (frame, layoutMode NONE) | 24 | 24 | 352 | 56 |
| 2 | `Avatar` (ellipse, inside Header conceptually but as a sibling here) | 40 | 32 | 40 | 40 |
| 3 | `UserName` (text) | 96 | 36 | 200 | 16 |
| 4 | `UserEmail` (text) | 96 | 56 | 200 | 14 |
| 5 | `NameField` (frame, layoutMode NONE) | 24 | 104 | 352 | 64 |
| 6 | `EmailField` (frame, layoutMode NONE) | 24 | 184 | 352 | 64 |
| 7 | `PasswordField` (frame, layoutMode NONE) | 24 | 264 | 352 | 64 |
| 8 | `SaveButton` (frame, layoutMode NONE) | 24 | 520 | 352 | 48 |

The original designer dragged everything into rough position. There is no auto-layout anywhere.

`Header` (1) is at (24, 24) but `Avatar` (2), `UserName` (3), and `UserEmail` (4) are also at the top, overlapping `Header`'s bounding box — they were *visually* meant to be inside Header but the designer never wrapped them. So the script sees children 1–4 as a 2-D cluster.

## Step 1 — bottom-up traversal collects candidates

The script's `findAll` pass picks up:

- `AccountSettings` (depth 0)
- `Header`, `NameField`, `EmailField`, `PasswordField`, `SaveButton` (depth 1)

Sorted by depth descending, the depth-1 frames are processed first. Each is a small frame with two children (a label + an input), which the script correctly identifies as `VERTICAL` and refactors with `paddingTop = 8`, `paddingBottom = 8`, `paddingLeft = 12`, `paddingRight = 12`, `itemSpacing = 4` (snapped from measurements). After this pass, those five frames are each a clean vertical auto-layout block.

## Step 2 — outer frame: cluster detection

Now the script gets to `AccountSettings`. Its children's bounding boxes:

- `Header` (1) covers x=[24, 376], y=[24, 80]
- `Avatar` (2) covers x=[40, 80], y=[32, 72] — **overlaps Header on both axes**
- `UserName` (3) covers x=[96, 296], y=[36, 52] — overlaps Header
- `UserEmail` (4) covers x=[96, 296], y=[56, 70] — overlaps Header
- `NameField` (5) at y=[104, 168] — no overlap with anyone
- `EmailField` (6) at y=[184, 248] — no overlap
- `PasswordField` (7) at y=[264, 328] — no overlap
- `SaveButton` (8) at y=[520, 568] — no overlap

Union-find groups:
- Cluster A: { Header, Avatar, UserName, UserEmail }
- Singleton: NameField, EmailField, PasswordField, SaveButton

Because Cluster A has multiple members, the script enters **wrap mode**.

## Step 3 — wrap the cluster

A new frame named `refactor-cluster` is created at the cluster's bounding box. The cluster covers x=[24, 376], y=[24, 80] (Header is the largest member). The wrapper is inserted into `AccountSettings` at the topmost index of the cluster members and positioned at (24, 24) with size 352 × 56.

Each cluster child is appended into the wrapper and rebased:

- `Header` (1): original (24, 24) → new (0, 0)
- `Avatar` (2): original (40, 32) → new (16, 8)
- `UserName` (3): original (96, 36) → new (72, 12)
- `UserEmail` (4): original (96, 56) → new (72, 32)

The wrapper itself stays `layoutMode = NONE`. It's a structural container, not an auto-layout participant. A designer will likely rename it to `HeaderRow` after the run.

## Step 4 — re-detect on the reduced set

`AccountSettings` now has 5 children: `refactor-cluster` (1 wrapper) + NameField, EmailField, PasswordField, SaveButton. The script re-runs `detectLayout` on this set.

- X-axis overlap pairs: 10 (every pair overlaps horizontally — they're all at x=24, w=352).
- Y-axis overlap pairs: 0 (they're all stacked vertically).

Fewer Y-overlaps → `VERTICAL`. Children sorted by Y: wrapper, NameField, EmailField, PasswordField, SaveButton.

## Step 5 — measure spacing

Children's edges in y:

- wrapper: top 24, bottom 80
- NameField: top 104, bottom 168
- EmailField: top 184, bottom 248
- PasswordField: top 264, bottom 328
- SaveButton: top 520, bottom 568

Padding top = 24 (snap of 24 = 24, shift 0).
Padding bottom = 600 − 568 = 32 (snap of 32 = 32, shift 0).
Padding left = 24, padding right = 24.

Gaps between consecutive children:
- wrapper → NameField: 104 − 80 = 24
- NameField → EmailField: 184 − 168 = 16
- EmailField → PasswordField: 264 − 248 = 16
- PasswordField → SaveButton: 520 − 328 = **192**

Median gap = 20 (median of [16, 16, 24, 192]). Snapped to 4 → **20**.

The 192 outlier is exactly why the script uses median, not mean. Mean would have given 62 — way off. The designer separated SaveButton with extra space because it's a primary action; the median ignores that and infers the spacing the rest of the form actually uses.

The 192 → 20 difference for the SaveButton position will now make SaveButton sit close to the password field. **This is a known trade-off** — the script's job is to extract the dominant layout convention, not preserve every outlier. The designer can manually push SaveButton down or wrap it in its own bottom section after the refactor.

## Step 6 — apply

Children re-appended in sorted order. `layoutMode = "VERTICAL"`. Padding and item spacing applied. `resize(400, 600)` and `layoutSizingHorizontal/Vertical = "FIXED"` to lock the original dimensions.

Children get `HUG` on both axes attempted; `TEXT` nodes that were already fixed-width throw and are left alone.

## Result

`AccountSettings` is now a vertical auto-layout frame, 400 × 600, with `refactor-cluster` (the header) and four field frames stacked at 20 px spacing. The header cluster is a child block the designer can rename and further refactor (likely into a horizontal auto-layout of Avatar + a vertical column of UserName/UserEmail) in a follow-up pass.

## Return value for this run

```js
{
  refactoredFrameIds: [
    "<NameField id>",
    "<EmailField id>",
    "<PasswordField id>",
    "<SaveButton id>",
    "<Header id>",
    "<AccountSettings id>"
  ],
  wrappedClusterIds: [ "<refactor-cluster id>" ],
  snapWarnings: [],            // all measurements happened to be 4-px multiples
  skippedFrames: [],
  overwrittenConstraints: []   // no non-default constraints in this example
}
```

## What the designer does next

1. Rename `refactor-cluster` to `HeaderRow` or similar.
2. Refactor `HeaderRow` manually or with another pass — it'll likely detect as 2-D again, so the designer probably wraps Avatar separately and uses an inner column for the text.
3. Decide what `SaveButton` should do — push it down, wrap it in a bottom-aligned section, or change its parent's `primaryAxisAlignItems` to `SPACE_BETWEEN`.
4. Flip selected children from HUG to FILL where they should stretch (e.g., the field frames probably should fill horizontally).
