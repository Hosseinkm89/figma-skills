# Example — cleaning up a messy page

A common situation: a screen was assembled quickly, so the frames are all
`Frame 1`, `Frame 2`, `Frame 3`. (Figma already auto-names text layers after
their content and instances after their component, so the noise is mostly in the
**frames and shapes**.) Here's what the skill does to a typical sign-in card.

This walkthrough is the exact output verified against the script's logic.

## Before

```
Frame 1
├─ Rectangle 4
├─ Frame 2
│  ├─ Welcome back              (text, 24px)
│  └─ Sign in to continue       (text, 14px)
├─ Frame 3
│  ├─ Input                     (instance of the Input component)
│  └─ Input                     (instance of the Input component)
├─ Button                       (instance of the Button component)
└─ Rectangle 9
```

## After (overwriteNamed = false — the default)

```
Welcome Back                    ← Frame 1: most prominent text in its subtree (24 > 14)
├─ Rectangle 4                  ← unchanged (plain shape, nothing to describe)
├─ Welcome Back                 ← Frame 2: largest text wins
│  ├─ Welcome back              ← unchanged (already named by content)
│  └─ Sign in to continue       ← unchanged
├─ Input Group                  ← Frame 3: no text → named from its Input component
│  ├─ Input                     ← unchanged
│  └─ Input                     ← unchanged
├─ Button                       ← unchanged (already named after its component)
└─ Rectangle 9                  ← unchanged
```

Summary returned:

```json
{ "renamed": 3, "candidates": 3, "page": "Sign In" }
```

### Why only three layers changed

- The three **generic frames** (`Frame 1/2/3`) are exactly what gets cleaned up.
- The **text layers** and **instances** were already meaningfully named, so
  `overwriteNamed: false` left them alone.
- `Rectangle 4` and `Rectangle 9` carry no text and no image fill — the script
  has nothing better than "Rectangle" to offer, so it leaves them untouched
  rather than adding noise.

> Want the rectangles and everything else re-titled too? Run with
> `overwriteNamed: true`.

## Running it

Via Claude + Figma MCP (after loading `figma-use`), run the body of
`../scripts/rename-layers.js`. To do, say, 200 renames per undo step:

```js
return await renameLayersOnCurrentPage({ batchSize: 200, overwriteNamed: false });
```

Or run the standalone plugin in `../scripts/standalone-plugin/` — same result,
no Claude required.
