---
name: accessibility-contrast-audit
description: >-
  Audits color contrast on a Figma page against WCAG 2.1 AA and AAA, then writes
  a clean, designed report onto a brand-new page in the same file. For every
  top-level frame it scores text contrast (1.4.3 AA and 1.4.6 AAA, with the
  large-text exception) and flags low-contrast UI strokes/borders (1.4.11, 3:1),
  giving each frame a PASS/FAIL verdict. The report lists one row per frame with
  pass/fail badges and a clickable link that jumps straight to that frame, plus
  its node address printed underneath — so findings are easy to act on without
  cluttering the layout. Triggers when a designer wants to check contrast or
  accessibility before handoff — phrasings like "check the color contrast on this
  page", "run a WCAG contrast audit", "is this design AA compliant?", "which
  frames pass AA and AAA?", "audit contrast and write up the results", "are my
  text colors accessible?", "find low-contrast text", "contrast check before
  handoff", or "make me an accessibility contrast report". Reads the designs and
  creates a report page only — it never restyles or modifies the audited frames.
  Do NOT use this to FIX contrast (it reports, it doesn't recolor), to run a full
  accessibility review beyond contrast (keyboard, alt text, focus order), or to
  build new components (use figma-generate-library).
---

# Accessibility Contrast Audit

Measure color contrast across a page the way WCAG does, and drop the findings
into a tidy report page the whole team can read — with a click-to-jump link to
every frame that needs attention.

## When this fires

A designer says something like:

- "Check the color contrast on this page."
- "Is this screen AA compliant? What about AAA?"
- "Which of these frames pass and which fail?"
- "Run a contrast audit before I hand off."
- "Find the low-contrast text in this file."
- "Make me an accessibility contrast report."

## What it does (in plain terms)

For the **current page**, it looks at every top-level frame and:

1. **Scores text contrast.** Each run of text is compared against the background
   color sitting behind it, then checked against the WCAG ratios:
   - **AA** (1.4.3): 4.5:1 for normal text, 3:1 for large text.
   - **AAA** (1.4.6): 7:1 for normal text, 4.5:1 for large text.
   - *Large* means 24px+ regular or 18.66px+ bold (WCAG's 18pt / 14pt-bold rule).
2. **Flags UI/non-text contrast.** Visible solid strokes — input borders,
   dividers, button outlines, icon strokes — are checked against the 3:1
   non-text rule (1.4.11). This is a **heuristic flag for manual review**, not a
   guarantee; decorative graphics are out of scope (see references).
3. **Gives each frame a verdict.** A frame passes a level only if *every* text
   run inside it meets that level. Results roll up to one PASS / FAIL / N/A badge
   per level, per frame.
4. **Writes a designed report page.** It creates a new page named
   `♿ Contrast Audit — <date>` and builds a clean table: a legend explaining the
   thresholds, then one row per frame showing the AA, AAA, and non-text badges.
   Each frame's name is a **live hyperlink that jumps to that frame**, and its
   node id is printed beneath it, so the address is always available without
   crowding the design.

## Two things worth knowing (both safe by design)

1. **It never touches your designs.** The skill only *reads* the audited frames
   and *creates* a separate report page. No colors are changed. If you want fixes,
   that's a different (recoloring) job — this skill reports, it doesn't repaint.
2. **The report page is itself accessible.** Every color used in the report (text,
   badges, the link) clears AA against its own background — so the audit doesn't
   ship an inaccessible artifact.

## How to run it (Claude + Figma MCP)

1. **Load `figma-use` first.** This skill produces Plugin API code; `figma-use`
   is the mandatory prerequisite for any `use_figma` call.
2. Open the page you want to audit so it is the current page.
3. Run the body of [`scripts/contrast-audit.js`](scripts/contrast-audit.js) via
   `use_figma`. It returns a summary `{ framesAudited, framesFailingAA,
   framesFailingAAA, results, reportPageId }` and opens the new report page.
4. To customize, pass options, e.g.
   `runContrastAudit({ includeNonText: false, switchToReport: false })`.

## How to run it (no Claude — a designer running it themselves)

Use the ready-to-paste plugin in
[`scripts/standalone-plugin/`](scripts/standalone-plugin/). No build step, no
tokens, no placeholders — see that folder's [INSTALL.md](scripts/standalone-plugin/INSTALL.md)
for the three-click install.

## Scope guardrails

- Operates on the **current page only**.
- Audits **top-level containers** (frames, components, sections, top-level
  instances). Loose shapes or text sitting bare on the canvas are skipped.
- **Reads only** the audited frames; the sole write is the new report page.
- Text runs with gradient or image fills are counted as "not scored" (a single
  contrast number isn't meaningful) and noted in the row, not silently passed.
- Non-text results are a **review aid**, deliberately conservative about what it
  claims — verify flagged borders/icons by eye.

## Deeper docs

- [`references/wcag-thresholds.md`](references/wcag-thresholds.md) — the exact
  ratios, the large-text rule, the relative-luminance math, and why non-text
  contrast is treated as a heuristic.
- [`references/methodology.md`](references/methodology.md) — how the effective
  background is resolved, how per-frame verdicts roll up, and the report's
  structure.
- [`examples/example-report.md`](examples/example-report.md) — a worked example
  of a finished report page and the summary it returns.
