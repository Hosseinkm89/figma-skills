# How a layer name is chosen

This is the exact decision the script makes for each layer. Read it when you
want to predict, trust, or extend the output.

## 1. Should this layer be touched at all?

A layer is considered for renaming when **either**:

- its current name is *generic* (a Figma default), **or**
- you passed `overwriteNamed: true`.

"Generic" means the name matches this pattern (case-insensitive, optional
trailing number):

```
Frame · Group · Section · Component · Component Set · Instance ·
Rectangle · Ellipse · Polygon · Star · Vector · Line · Arrow ·
Text · Image · Slice · Boolean Group · Union · Subtract · Intersect · Exclude
```

So `Frame 12`, `Group`, `Rectangle 3` qualify; `CTA Button` does not. This is
why your intentional names survive by default.

## 2. What name does it get?

Picked by node type, in this order. If none applies, the layer is **left
unchanged** (so a plain divider stays as-is rather than becoming "Rectangle").

| Layer type | Name source |
|---|---|
| **Text** | Its own characters, cleaned + truncated. |
| **Instance** | Its main component's name (`getMainComponentAsync()`), e.g. `Button`. |
| **Frame / Group / Section** | The **most prominent text** inside it — the text node with the largest font size (usually the heading). |
| Frame/Group/Section with no text | The name of a non-generic instance inside it, suffixed `Group` (e.g. `Avatar Group`). |
| Any of the above with only an image fill | `Image`. |
| **Rectangle / Ellipse / Polygon / Star** | `Image` if it has an image fill; otherwise left unchanged. |

"Most prominent text" = largest `fontSize`. Ties go to the first one found in
reading order.

## 3. How names are formatted

All derived names pass through Title Case, which:

- splits `camelCase`, `snake_case`, and `kebab-case` into words,
- collapses whitespace and strips line breaks/control characters,
- Title-Cases each word,
- keeps short all-caps tokens intact (`CTA`, `FAQ`, `USD`),
- truncates to `maxNameLength` (default 32) with an ellipsis.

Examples: `sign_in_button` → `Sign In Button`; `Welcome back, Sam!` →
`Welcome Back, Sam!`; `heroImageLarge` → `Hero Image Large`.

## 4. Batching and undo

Renames are applied in chunks of `batchSize` (default 100). After each chunk the
script calls `figma.commitUndo()`, so each chunk is one undo step. This keeps a
huge page responsive and lets the designer roll back gradually. To rename *N* at
a time, set `batchSize: N`.

## 5. What it never does

- Never touches **other pages** — current page only.
- Never descends into a component **instance's** internal layers (they belong to
  the main component).
- Never creates, deletes, moves, resizes, or restyles anything — it only sets
  `name`.

## Extending it

- **Add domain words** (e.g. always name a frame containing a price `Price
  Card`): add a branch in `deriveName` before the text check.
- **Change the generic list**: edit the `GENERIC` regex.
- **Different casing** (kebab-case for code-style names): replace `toTitleCase`'s
  final `join(' ')` step with a `join('-').toLowerCase()` variant.
- **Restrict by size** (e.g. only 200×200 icon frames): in `visit`, gate on
  `node.width === 200 && node.height === 200` before pushing a target.
