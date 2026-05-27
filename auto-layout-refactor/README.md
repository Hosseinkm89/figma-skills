# auto-layout-refactor

A Claude Skill for product designers. Converts flat Figma frames built with absolute positioning into proper auto-layout structures, in place.

## What it solves

Old Figma files are full of frames where every layer was dragged into position by hand. Nothing reflows, editing one element shifts everything else, and the file is functionally read-only. This skill walks the open page, finds those flat frames, and turns them into auto-layout — without redrawing the screen.

It runs inside Claude using the Figma MCP server's `use_figma` tool. Triggering phrases include:

- "this file has no auto-layout"
- "everything's absolutely positioned"
- "auto-layout this page"
- "refactor this screen to auto-layout"
- "clean up this old Figma file"
- "the layout is flat / has no structure"

## How it works

For each frame with `layoutMode === "NONE"`, bottom-up:

1. Cluster children by 2-D overlap. Genuine clusters (badge-on-card, overlapping decorations) are wrapped into an intermediate `refactor-cluster` frame so the outer pass sees them as a single block.
2. Decide `HORIZONTAL` or `VERTICAL` by counting axis-overlap pairs.
3. Measure padding (distance from frame edge to nearest child) and item spacing (median gap between consecutive children), snapped to 4 px.
4. Reorder children by position, flip `layoutMode`, apply spacing, then resize back to the original width and height.

Every refactored frame, every wrapper created, and every snap that visibly shifted an element is returned to the designer for review.

The full algorithm is described in [`auto-layout-refactor/references/algorithm.md`](auto-layout-refactor/references/algorithm.md). Edge cases the script handles, skips, or flags are listed in [`auto-layout-refactor/references/edge-cases.md`](auto-layout-refactor/references/edge-cases.md). A worked example tracing the algorithm on a real settings screen is in [`auto-layout-refactor/examples/before-after.md`](auto-layout-refactor/examples/before-after.md).

## Locked-in behavior

These are deliberate defaults — the skill does not ask at runtime.

| | |
|---|---|
| Scope | Whole current page, recursing into nested frames bottom-up |
| Ambiguous clusters | Wrapped into an intermediate `refactor-cluster` frame |
| Destructive? | Yes — modifies frames in place |
| Spacing | Snapped to nearest 4 px; warns if a snap shifts an element > 2 px |
| Instances, locked, hidden layers | Processed (locked frames are unlocked) |
| Default sizing | `FIXED` on both axes, locked to original width/height |

If you want different defaults, fork the skill — that's cheaper than parameterizing the runtime behavior.

## Install

This skill is built to the [Anthropic SKILL.md spec](https://docs.claude.com/en/docs/agents-and-tools/skills) and runs anywhere Claude exposes Skills and the Figma MCP server.

Drop the `auto-layout-refactor/` folder into the skills location for your Claude environment:

- **Claude Code:** `~/.claude/skills/auto-layout-refactor/`
- **Cowork plugin:** include the folder under `skills/` in your plugin manifest.
- **Claude Agent SDK:** add to your skills directory and load via your agent config.

The skill's `SKILL.md` instructs Claude to load `figma-use` (shipped with the Figma MCP plugin) before running, which is required for any `use_figma` call.

## Use

Open the Figma file you want to clean up. In Claude, with the Figma MCP server connected, say something like:

> *"This screen is a mess of free-positioned layers. Auto-layout this page."*

Claude will:

1. Inspect the current page and report how many frames have no auto-layout.
2. Run the refactor script.
3. Report back the count of refactored frames, wrappers created, snap warnings, and any frames it skipped.
4. Take a screenshot so you can compare against your memory of the original.

Undo is one `Cmd+Z` per `use_figma` call.

## Limitations

- Does not produce `layoutMode = "GRID"`. Grid mode needs explicit row/column counts that can't be reliably inferred from geometry.
- Does not push into `COMPONENT_SET` internal variants.
- Children land as `HUG`. Stretching individual children to fill is a design decision left to you.
- The script's spacing inference uses the **median** gap — a deliberately outlier-resistant choice. A primary action separated from a form by a large gap will end up close to the form after the refactor. Wrap such elements into their own bottom section after the run, or use `primaryAxisAlignItems = "SPACE_BETWEEN"` on the parent.

## License

MIT. See `LICENSE`.

## Contributing

Pull requests welcome. This skill is part of a larger collection of Figma-workflow Skills aimed at product designers. The bar is:

- Descriptions trigger reliably on the symptoms a designer would describe (not the technical jargon).
- Scripts run as-is. No "fill in your token here" placeholders.
- Every skill ships with at least one worked example.
- Code comments are written so a designer who has never opened the Plugin API can still read the script and understand what it does.

If you have a different defaulting opinion (non-destructive runs, dry-run-first, GRID inference), open an issue or fork. Splitting into a sibling skill is preferred over adding runtime branches.
