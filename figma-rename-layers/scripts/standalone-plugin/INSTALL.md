# Run it yourself — no code experience needed

This folder is a complete, ready-to-run Figma plugin. There is **nothing to fill
in** and **no build step**. It runs on whatever page you have open.

## Three-click install (one time)

1. In the Figma desktop app, open any file. Go to the main menu →
   **Plugins → Development → Import plugin from manifest…**
2. Choose the `manifest.json` file in this folder.
3. Done — it now appears under **Plugins → Development → Rename Layers by
   Content**.

> The Figma **desktop app** is required to import a development plugin (the
> browser version can't read local files).

## Each time you want to clean up a page

1. Open the page whose layers you want to rename.
2. Run **Plugins → Development → Rename Layers by Content**.
3. A toast tells you how many layers were renamed. Press **Cmd/Ctrl + Z** to undo
   (each batch undoes separately).

## Want to tweak it?

Open `code.js` and edit the `OPTIONS` block near the bottom:

- `batchSize` — how many layers are renamed per undo step (e.g. set `200` to do
  200 at a time).
- `overwriteNamed` — set to `true` to rename **every** layer, including ones you
  named yourself. Leave `false` to protect your intentional names.
