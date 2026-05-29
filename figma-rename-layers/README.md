# figma-rename-layers

> A Claude Skill that renames Figma layers from their **design content** —
> turning `Frame 1`, `Group 7`, `Rectangle 12` into `Welcome Back`,
> `Input Group`, `Hero Image`.

Part of an open-source library of Figma-focused Claude Skills for product
designers.

## What it does

Walks every frame and its child layers on the **current page** and gives each
one a readable Title Case name derived from:

1. the **most prominent text** inside it (largest font size),
2. the **component** it is or contains,
3. an **image** fill.

Layers it can't describe better than their generic type are left alone, and
names you set on purpose are preserved by default.

## Why a script *and* a note about Figma AI

Figma has a built-in AI **"Rename layers"** command, but it lives in the editor
UI and **cannot be called from the Plugin API**. So this skill does the bulk work
with a verified Plugin API script (fully automatable) and documents the native AI
command as a manual fallback for nuanced layers. See
[`references/figma-ai-rename-fallback.md`](references/figma-ai-rename-fallback.md).

## Install (as a Claude Skill)

Copy the `figma-rename-layers/` folder into your skills directory (e.g. your
plugin's `skills/` folder or `~/.claude/skills/`). Claude loads it automatically
when a request matches the trigger description in `SKILL.md`.

## Use it

**With Claude + the Figma MCP** (recommended):

1. Open the page you want to clean up.
2. Ask: *"Rename all the layers on this page based on their content."*
3. Claude loads `figma-use`, then runs `scripts/rename-layers.js` via `use_figma`.

Pass options for control, e.g. rename 200 at a time:

```js
return await renameLayersOnCurrentPage({ batchSize: 200, overwriteNamed: false });
```

**Without Claude** — run the bundled plugin yourself: see
[`scripts/standalone-plugin/INSTALL.md`](scripts/standalone-plugin/INSTALL.md)
(three-click import, no build step, no tokens).

## Options

| Option | Default | Meaning |
|---|---|---|
| `batchSize` | `100` | Layers renamed per undo step. Each batch is one `figma.commitUndo()`. |
| `overwriteNamed` | `false` | When `false`, only generic/default names are changed. `true` renames everything. |
| `maxNameLength` | `32` | Max characters in a derived name (then ellipsized). |
| `descendIntoFrames` | `true` | Also rename generic-named children inside each frame. |

## Safety

Reads layer content; writes only the `name` property. Never creates, deletes,
moves, resizes, or restyles. Never touches other pages or the internals of
component instances.

## Folder structure

```
figma-rename-layers/
├─ SKILL.md                              # trigger description + how-to
├─ README.md                             # this file
├─ LICENSE                               # MIT
├─ scripts/
│  ├─ rename-layers.js                   # canonical logic (run via use_figma)
│  └─ standalone-plugin/                 # run it without Claude
│     ├─ manifest.json
│     ├─ code.js
│     └─ INSTALL.md
├─ references/
│  ├─ naming-heuristics.md               # exactly how a name is chosen
│  └─ figma-ai-rename-fallback.md        # the manual Figma AI route
└─ examples/
   └─ before-after.md                    # worked example
```

## License

MIT — see [LICENSE](LICENSE).
