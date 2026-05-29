# accessibility-contrast-audit

A [Claude Skill](https://docs.claude.com/en/docs/agents-and-tools/skills) that
audits color contrast on a Figma page against **WCAG 2.1 AA and AAA**, then
writes a clean, designed **report page** into the same file — one PASS/FAIL row
per frame, with a click-to-jump link and node address for each.

## What it checks

- **Text contrast** — every run of text vs the background behind it, scored
  against AA (4.5:1 / 3:1 large) and AAA (7:1 / 4.5:1 large), with WCAG's
  large-text rule (24px+ regular, 18.66px+ bold).
- **Non-text / UI contrast** — visible solid strokes (input borders, dividers,
  button outlines, icon strokes) against the 3:1 rule (1.4.11). This column is a
  **heuristic flag for manual review**, not a guarantee.

A frame passes a level only if *every* text run inside it meets that level.

## What it produces

A new page, `♿ Contrast Audit — <date>`, with:

- A legend explaining the thresholds.
- A table with one row per top-level frame and **Text AA**, **Text AAA**, and
  **Non-text 3:1** badges (PASS / FAIL / N/A).
- A live link on each frame name that jumps to that frame, with its node id
  printed beneath — so findings are easy to act on without cluttering the design.

It **reads** your designs and only **writes** the report page. It never restyles
the frames it audits. (It reports contrast; it does not recolor anything.)

## Install

Pick the environment you use Claude in.

### Claude Code (terminal)

```bash
git clone https://github.com/hosseinkm89/figma-skills.git ~/figma-skills
ln -s ~/figma-skills/accessibility-contrast-audit ~/.claude/skills/accessibility-contrast-audit
```

### Cowork / Claude Agent SDK

Place the `accessibility-contrast-audit/` folder under your plugin's `skills/`
directory (or your agent's configured skills directory).

## Use

### With Claude + the Figma MCP server

Open the page you want to check and say something like *"run a WCAG contrast
audit on this page"* or *"which of these frames pass AA and AAA?"*. Claude loads
`figma-use`, runs the script, and opens the report page.

### Without Claude (run it yourself)

Import the ready-to-run plugin in
[`scripts/standalone-plugin/`](scripts/standalone-plugin/) via **Plugins →
Development → Import plugin from manifest…** — no build step, no tokens. See its
[INSTALL.md](scripts/standalone-plugin/INSTALL.md).

## Options

Pass these to `runContrastAudit({ ... })` (or edit the `OPTIONS` block in the
standalone `code.js`):

| Option | Default | Effect |
|---|---|---|
| `includeNonText` | `true` | Also check UI/non-text strokes against 3:1. |
| `switchToReport` | `true` | Open the report page when done. |
| `defaultBackground` | `{r:1,g:1,b:1}` | Background assumed when none is found (set to your canvas color for dark files). |

## How it works

- [`scripts/contrast-audit.js`](scripts/contrast-audit.js) — the canonical
  script (runs via `use_figma` or as the standalone plugin).
- [`references/wcag-thresholds.md`](references/wcag-thresholds.md) — the exact
  ratios and the relative-luminance math.
- [`references/methodology.md`](references/methodology.md) — background
  resolution, per-frame roll-up, and report structure.
- [`examples/example-report.md`](examples/example-report.md) — a worked example.

## License

MIT — see the repo [LICENSE](../LICENSE).
