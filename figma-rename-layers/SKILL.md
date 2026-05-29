---
name: figma-rename-layers
description: >-
  Batch-renames Figma layers from their design content instead of leaving
  default names like "Frame 1" or "Rectangle 23". Walks every frame and its
  child layers on the current page, derives a readable Title Case name from the
  most prominent text, a contained component, or an image fill, and applies the
  names in batches the designer can undo. Triggers when a designer wants to
  clean up generic layer names — phrasings like "rename all my layers", "my
  layers are all called Frame 1, Frame 2", "auto-rename these frames based on
  what's inside them", "clean up the layer names on this page", "name my layers
  from their content", "batch rename layers", "rename layers by content", or
  "fix these default layer names". Renames frames plus their generic-named
  children, preserves names the designer set on purpose, and chunks large pages
  so each batch is one undo step. The skill also documents Figma's built-in AI
  "Rename layers" command as a manual fallback for nuanced cases — that feature
  is editor-UI only and cannot be triggered from the Plugin API. Do NOT use this
  to create new layers (use figma-generate-design) or to restructure layout (use
  auto-layout-refactor).
---

# Figma — Rename Layers by Content

Turn a page full of `Frame 1`, `Group 7`, `Rectangle 12` into a clean,
self-describing layer tree. The skill reads what is actually *in* each layer and
names it accordingly, so the Layers panel reads like a table of contents.

## When this fires

A designer says something like:

- "Rename all the layers on this page based on what's in them."
- "Everything is called Frame 1, Frame 2 — clean it up."
- "Auto-name these frames and their children."
- "Batch rename my layers by content."

## What it does (in plain terms)

For the **current page**, it looks at every top-level frame and walks down into
its children. For each layer it can describe, it picks a name from, in order of
preference:

1. The **most prominent text** inside it (largest font size wins — that's
   usually the heading/label).
2. The **component** it is, or contains (e.g. an instance of `Button`).
3. Whether it's an **image** fill.

Names are written in readable **Title Case** (`Profile Card`, `Primary Button`,
`Hero Image`). Anything it can't describe better than its generic type is left
untouched — no churn for a plain divider rectangle.

## Two important defaults (decided for safety, both configurable)

1. **Intentional names are protected.** By default only layers that still carry
   a *generic/default* name (`Frame 12`, `Group 3`, `Rectangle 1`, …) get
   renamed. A layer the designer already named (`CTA Button`) is left alone.
   Set `overwriteNamed: true` to rename everything.
2. **Renames run in batches.** Layers are renamed in chunks (default 100 at a
   time), and each chunk is committed as a single undo step via
   `figma.commitUndo()`. On a huge page the designer can undo one batch at a
   time instead of one giant action. Tune with `batchSize`.

> If a designer asks for a specific simultaneous-rename count (e.g. "do 200 at a
> time"), pass that as `batchSize`.

## How to run it (Claude + Figma MCP)

1. **Load `figma-use` first.** This skill produces Plugin API code; `figma-use`
   is the mandatory prerequisite for any `use_figma` call.
2. Open the file/page to clean up.
3. Run the body of [`scripts/rename-layers.js`](scripts/rename-layers.js) via
   `use_figma`. It returns a summary `{ renamed, candidates, page }` and shows a
   Figma toast.
4. To customize, pass options, e.g.
   `renameLayersOnCurrentPage({ batchSize: 200, overwriteNamed: false })`.

## How to run it (no Claude — a designer running it themselves)

Use the ready-to-paste plugin in
[`scripts/standalone-plugin/`](scripts/standalone-plugin/). No build step, no
tokens, no placeholders — see that folder's notes for the three-click install.

## Figma's built-in AI rename (manual fallback)

Figma ships an AI **"Rename layers"** command in the editor. It is excellent for
nuanced, ambiguous layers — but it lives in the UI only and **cannot be called
from the Plugin API**, so this skill's script can't invoke it. When the
heuristic output isn't good enough for a tricky section, point the designer to
the manual flow in
[`references/figma-ai-rename-fallback.md`](references/figma-ai-rename-fallback.md).

## Scope guardrails

- Operates on the **current page only**.
- Skips the internal layers of component **instances** (those belong to the main
  component and usually can't/shouldn't be renamed).
- Never creates, deletes, moves, or restyles layers — it only sets `name`.

## Deeper docs

- [`references/naming-heuristics.md`](references/naming-heuristics.md) — exactly
  how a name is chosen, the generic-name regex, and how to extend it.
- [`references/figma-ai-rename-fallback.md`](references/figma-ai-rename-fallback.md)
  — when and how to use Figma's native AI rename instead.
- [`examples/before-after.md`](examples/before-after.md) — a worked example.
