# WCAG contrast thresholds — what this skill checks against

This is the reference the audit script encodes. If you ever need to defend a
PASS/FAIL in a handoff review, the numbers and rules below are the source.

## Text contrast

The contrast ratio between text and its background must meet:

| Level | Normal text | Large text |
|---|---|---|
| **AA** — [WCAG 1.4.3](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html) | **4.5:1** | **3:1** |
| **AAA** — [WCAG 1.4.6](https://www.w3.org/WAI/WCAG21/Understanding/contrast-enhanced.html) | **7:1** | **4.5:1** |

### What counts as "large text"

WCAG defines large text as **18pt** and up, or **14pt and up if bold**. Figma's
font size is effectively in CSS pixels, and 1pt ≈ 1.333px, so the script uses:

- **24px or larger** → large (regular weight)
- **18.66px or larger** → large *if bold*

"Bold" here means a font weight of **700 or more** (or a style name containing
*Bold / Black / Heavy / Extrabold*). A 600 "Semi Bold" is **not** bold for this
rule, so it still needs the normal-text ratio.

## Non-text / UI contrast (heuristic)

[WCAG 1.4.11](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html)
requires **3:1** for the visual information needed to identify UI components and
states, and for meaningful graphics. The script approximates this by checking
the **visible solid strokes** of shapes, frames, and components — the kind of
strokes that form input borders, dividers, button outlines, and icon strokes —
against the background behind them.

This is intentionally a **review flag, not a verdict**, because:

- Tooling can't reliably tell a *meaningful* graphic (an icon that conveys state)
  from a *decorative* one (a background flourish), and decorative elements are
  exempt.
- Filled (stroke-less) icons and complex vector art are not scored, to avoid a
  flood of false failures.
- Adjacent-color and gradient backgrounds make the "background behind" ambiguous.

So treat the **Non-text 3:1** column as "these borders/strokes are worth a human
look," not "these definitely fail."

## The math (relative luminance)

Contrast ratio is `(L1 + 0.05) / (L2 + 0.05)`, where `L1` is the lighter color's
relative luminance and `L2` the darker's. Relative luminance linearizes each
sRGB channel:

```
c_linear = c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ^ 2.4
L = 0.2126 * R_linear + 0.7152 * G_linear + 0.0722 * B_linear
```

Ratios run from **1:1** (identical colors) to **21:1** (pure black on pure
white). Figma colors are already in the 0–1 range the formula expects.

## Translucency

If a text fill, stroke, or an ancestor background has opacity below 100%, the
script alpha-composites it over what's behind it before measuring — so a 60%
black label on white is scored at its *real* on-screen color, not as pure black.
