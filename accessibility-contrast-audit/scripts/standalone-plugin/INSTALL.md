# Run it yourself — no code experience needed

This folder is a complete, ready-to-run Figma plugin. There is **nothing to fill
in** and **no build step**. It audits whatever page you have open and writes a
report onto a new page in the same file.

## Three-click install (one time)

1. In the Figma desktop app, open any file. Go to the main menu →
   **Plugins → Development → Import plugin from manifest…**
2. Choose the `manifest.json` file in this folder.
3. Done — it now appears under **Plugins → Development → Accessibility Contrast
   Audit**.

> The Figma **desktop app** is required to import a development plugin (the
> browser version can't read local files).

## Each time you want to audit a page

1. Open the page whose frames you want to check.
2. Run **Plugins → Development → Accessibility Contrast Audit**.
3. A new page named `♿ Contrast Audit — <date>` is created and opened. A toast
   tells you how many frames failed AA. The audit makes **no changes** to your
   original frames; press **Cmd/Ctrl + Z** once to remove the report page if you
   don't want to keep it.

## What you'll see in the report

- A legend explaining the AA / AAA / non-text thresholds.
- One row per top-level frame, with **Text AA**, **Text AAA**, and
  **Non-text 3:1** badges (PASS / FAIL / N/A).
- Each frame name is a **link** — click it to jump straight to that frame. Its
  node address is printed underneath in grey.

## Want to tweak it?

Open `code.js` and edit the `OPTIONS` block near the bottom:

- `includeNonText` — set to `false` to skip the UI/non-text (border/stroke)
  checks and report on text contrast only.
- `switchToReport` — set to `false` to build the report page but stay on the
  page you were on.
