# figma-skills

A growing collection of [Claude Skills](https://docs.claude.com/en/docs/agents-and-tools/skills) for product designers working in Figma. Each skill teaches Claude how to do one Figma workflow well — design system audits, token sync, layout cleanups, batch operations via the Plugin API — so you can describe what you want in plain language instead of opening yet another plugin.

Built by [@hosseinkm89](https://github.com/hosseinkm89). Maintained for designers, not engineers.

## Skills in this repo

| Skill | What it does | Triggers on phrases like |
|---|---|---|
| [`auto-layout-refactor`](auto-layout-refactor/) | Walks a Figma page and converts every flat, absolutely-positioned frame into proper auto-layout, in place. | "this file has no auto-layout", "auto-layout this page", "clean up this old Figma file" |

*More coming. See [Roadmap](#roadmap).*

## What is a Claude Skill?

A folder with a `SKILL.md` file and supporting scripts/references/examples. When Claude has access to a skill, it consults that skill automatically whenever your request matches what the skill is for — no need to invoke it by name. Skills extend what Claude can do without changing the model itself.

These skills are scoped to three areas of product design work:

1. **Design Systems & Tokens** — token generation, syncing design tokens with code, variable structures, theming, library organization.
2. **Day-to-day Design Workflows** — auto-layout patterns, variants, component properties, constraints, naming conventions, cleanup routines.
3. **Automation via the Figma Plugin API** — scripts for batch operations, audits, find-and-replace, import/export, structural transformations.

## Install

Each skill is a self-contained folder. Pick the environment you use Claude in and follow that section.

### Claude Code (terminal)

```bash
# Clone the whole collection once
git clone https://github.com/hosseinkm89/figma-skills.git ~/figma-skills

# Symlink the skills you want into your Claude skills directory
ln -s ~/figma-skills/auto-layout-refactor ~/.claude/skills/auto-layout-refactor
```

Symlinking (instead of copying) means you get future updates with a single `git pull`.

### Cowork

Place the skill folder under your plugin's `skills/` directory, or install the skill folder directly via the plugin manifest. See [Anthropic's plugin docs](https://docs.claude.com/en/docs/agents-and-tools/skills) for the canonical install path.

### Claude Agent SDK

Add the skill folder to your agent's configured skills directory and load via your agent config.

## Use

With the [Figma MCP server](https://help.figma.com/hc/en-us/articles/32132100833559) connected, open the Figma file you want to work on and talk to Claude in plain language. Each skill's description tells Claude when to fire — you should not have to invoke skills by name. If a skill doesn't trigger, the wording is the thing to tweak; open an issue.

## Repo structure

```
figma-skills/
├── README.md                ← you are here
├── LICENSE
├── <skill-name>/
│   ├── SKILL.md             ← the trigger description + workflow
│   ├── README.md            ← GitHub-facing intro for the skill
│   ├── scripts/             ← Plugin API or Code Connect scripts
│   ├── references/          ← deeper docs Claude loads when needed
│   └── examples/            ← at least one worked example per skill
```

Every skill follows the [Anthropic SKILL.md spec](https://docs.claude.com/en/docs/agents-and-tools/skills). Folders use kebab-case. The `SKILL.md` `name` field always matches the folder name.

## Roadmap

Skills planned or in progress:

- `design-tokens-sync` — generate Figma variables from a code token file (and vice versa)
- `variants-audit` — find variant sets with missing combinations or mismatched defaults
- `naming-cleanup` — apply a layer/component naming convention across a page
- `foundations-audit` — catch hardcoded colors, off-grid spacing, and unbound type styles
- `constraints-to-autolayout-companion` — for the cases `auto-layout-refactor` flags as 2-D

Open an issue to propose one.

## Contributing

PRs welcome. The bar is:

- **Triggering descriptions are specific.** Generic descriptions are the #1 reason a skill never fires. The description in YAML frontmatter is third person, lists example phrasings a designer would actually say, and names the symptoms the skill addresses.
- **Scripts run as-is.** No "fill in your token here" placeholders. Anyone with the Figma MCP server connected should be able to execute the script the moment they pull the repo.
- **Every skill has at least one worked example.** Code without an example is hard to trust and harder to extend.
- **Designer audience.** Comments in scripts are written so someone who has never opened the Figma Plugin API can read along.
- **One workflow per skill.** If two workflows could plausibly stand alone, split them. Many focused skills beat one mega-skill.

## License

MIT — see [LICENSE](LICENSE). Use them, fork them, modify them. Attribution appreciated but not required.
