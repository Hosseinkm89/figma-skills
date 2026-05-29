# Figma's built-in AI "Rename layers" — the manual fallback

Figma has a first-party AI command that renames selected layers. It often reads
intent better than a rules-based script for ambiguous or highly visual layers.

## Why the script can't call it

Figma's AI rename is a **feature of the editor UI**, exposed through the
right-click / contextual menu. It is **not part of the Plugin API** — there is no
method like `figma.ai.renameLayers()`. So neither this skill's script nor any
plugin can trigger it programmatically. It is a manual, designer-in-the-loop
action only.

That's why this skill ships a Plugin API heuristic (fully automatable) **and**
documents the native AI command for the cases the heuristic doesn't nail.

## When to reach for the native AI rename instead

- A section is visually meaningful but has **no text** and no clear component
  (the script leaves these untouched).
- You want names that capture **purpose/semantics** the content doesn't state
  literally (e.g. "Onboarding Step 2").
- You're polishing a **small selection** by hand and want the best single-shot
  names.

## How to use it (manual steps for the designer)

1. Select the layers or the frame you want renamed.
2. Right-click → look for the **Rename layers** AI option (also surfaced in
   Figma's AI actions menu).
3. Review and accept the suggestions.

> Availability and exact menu wording depend on your Figma plan and whether AI
> features are enabled for your account/organization. If you don't see it, AI
> features may be turned off in admin settings.

## Recommended workflow

1. Run this skill's script first — it cheaply fixes the bulk of `Frame 1`,
   `Group 7`, text, and component layers across the whole page.
2. Then hand-pick any remaining vague sections and apply Figma's AI rename to
   just those. Best of both: speed + nuance.
