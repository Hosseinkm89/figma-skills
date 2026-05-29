# Worked example

A designer has a page called **Checkout v3** with four top-level frames:
`Cart`, `Shipping`, `Payment`, and `Confirmation`. They ask Claude to "run a
contrast audit before handoff." Claude loads `figma-use`, then runs
`scripts/contrast-audit.js`.

## What the script returns

```json
{
  "sourcePage": "Checkout v3",
  "reportPageName": "♿ Contrast Audit — 2026-05-29",
  "reportPageId": "12:340",
  "framesAudited": 4,
  "framesFailingAA": 2,
  "framesFailingAAA": 3,
  "results": [
    {
      "frame": "Cart",
      "id": "10:21",
      "passAA": true,
      "passAAA": false,
      "passNonText": true,
      "minTextRatio": 5.1,
      "worst": { "text": "Subtotal", "ratio": 5.1, "requiredAA": 4.5, "large": false }
    },
    {
      "frame": "Shipping",
      "id": "10:88",
      "passAA": false,
      "passAAA": false,
      "passNonText": false,
      "minTextRatio": 2.9,
      "worst": { "text": "Optional delivery note", "ratio": 2.9, "requiredAA": 4.5, "large": false }
    },
    {
      "frame": "Payment",
      "id": "10:140",
      "passAA": false,
      "passAAA": false,
      "passNonText": true,
      "minTextRatio": 3.8,
      "worst": { "text": "Card number", "ratio": 3.8, "requiredAA": 4.5, "large": false }
    },
    {
      "frame": "Confirmation",
      "id": "10:202",
      "passAA": true,
      "passAAA": true,
      "passNonText": null,
      "minTextRatio": 8.2,
      "worst": { "text": "Order placed", "ratio": 8.2, "requiredAA": 3, "large": true }
    }
  ]
}
```

## What the report page looks like

A new page `♿ Contrast Audit — 2026-05-29` is created and opened, containing:

```
Accessibility Contrast Audit
Source page: "Checkout v3"  •  4 frames audited  •  2026-05-29
2 frames fail AA text contrast  •  3 fail AAA

┌─ How to read this ────────────────────────────────────────────────┐
│ • Text AA (1.4.3): normal 4.5:1, large 3:1.                        │
│ • Text AAA (1.4.6): normal 7:1, large 4.5:1.                       │
│ • Large text = 24px+ regular, or 18.66px+ bold.                    │
│ • Non-text (1.4.11): UI strokes need 3:1 (heuristic, review).      │
│ • A frame passes a level only if every text run meets it.          │
└────────────────────────────────────────────────────────────────────┘

Frame                                  Text AA   Text AAA   Non-text 3:1
────────────────────────────────────────────────────────────────────────
Cart            (link → 10:21)          PASS       FAIL        PASS
  10:21  •  min text 5.1:1
Shipping        (link → 10:88)          FAIL       FAIL        FAIL
  10:88  •  min text 2.9:1  •  min UI 2.1:1
Payment         (link → 10:140)         FAIL       FAIL        PASS
  10:140  •  min text 3.8:1
Confirmation    (link → 10:202)         PASS       PASS        N/A
  10:202  •  min text 8.2:1
```

Each frame name is a live link — clicking **Shipping** jumps the canvas straight
to the `Shipping` frame so the designer can fix the `Optional delivery note`
label (2.9:1, needs 4.5:1) and the low-contrast field border flagged at 2.1:1.

`Confirmation` shows **N/A** for non-text because it has no stroked UI elements
to check — the audit reports that honestly instead of inventing a PASS.
