# Release history

The repo version tracks the source distribution. Each agent carries its own `CHANGELOG.md` with kit changes, and this file links them.

## Unreleased

- `docs/COMMERCE-GUIDE.vi.html` is rewritten as a complete user guide: quick start, per OS install, Claude Code and Codex CLI setup, the step lifecycle, the `commerce-result/1` contract, the data each code gate needs (print spec, costs in minor units and bps, supplier dossier, media), upload rules, app limits, troubleshooting by error message, a glossary and an FAQ. Documentation only; app behaviour is unchanged.

## 1.1.0, 2026-10-05

- The commerce app gains a built in ChatGPT (Codex CLI) runner beside Claude Code, so the app keeps working when the Claude quota runs out. It runs `codex exec` read only and ephemeral, with user config, rules, web search and every tool feature off, and reads the final agent message from the JSONL events. Choose it under the runner settings, per default or per role. Sign in once with `codex login`.
- `docs/INSTALL.md` notes the Codex CLI route for scheduled kits without the Codex app.

## 1.0.0, 2026-09-21

First release of Ecom Agents: nine agent kits, the installer, the commerce app and the standards that carry them.

- Nine kits under `agents/`: GTM Engineer, Ad Manager, Web Dev, Social Media, Sales, Customer Satisfaction, Chief of Staff, SEO/AEO and POD Design. Each implements the Ecom Agent Standard and carries its own `CHANGELOG.md`. Every kit declares the same eleven supported harnesses in `agent.json`, and `CAPABILITIES.md` in each kit maps every capability a routine names to a concrete route, one row per harness where the harnesses differ.
- The installer in this checkout hires, lists and upgrades kits: `node installer/cli.mjs hire <slug> --to <folder>`. The source package is private and scoped, and this checkout is the verified distribution source; there is no published package to install from. Installs made under the retired ai-employees naming keep working: the installer resolves `-employee` slugs, the upgrade and the guard read `employee.json` beside `agent.json`, `ai-employee-receipt/2` receipts stay trusted, and the commerce workspace and routine locks fall back to the `~/.ai-employees` folders while the new ones do not exist.
- The commerce app under `app/commerce/` runs local and single user with draft only remote actions; the POD and Dropship overlays install onto a kit on request. All image assets under `assets/` generate locally, including the harness tiles from `src/icon.html`.
