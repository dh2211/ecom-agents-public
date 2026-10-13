# AGENTS.md

Instructions for an AI coding agent working **on this repository**. If you are an agent that has been *hired* and is running a routine, this is not your file: read `CONTRACT.md`, `ROLE.md` and your own `routines/<id>/SKILL.md` inside your kit folder, and read the `AGENTS.md` in that kit folder rather than this one.

This file follows the [AGENTS.md](https://agents.md) convention, stewarded by the Linux Foundation's Agentic AI Foundation.

## What this repository is

Ecom Agents includes a local single-user Commerce app for POD and Dropship, a process supervisor, and nine instruction kits that may be installed separately and scheduled. Do not confuse app workflow jobs with scheduled kit routines. Read `FLOCK.md` for document ownership before creating or updating documentation.

Eight of the nine kits are large on purpose: a shipped kit is roughly 1.1 MB of instructions, with `CONTRACT.md` near 85 KB and each routine's `SKILL.md` between 60 and 94 KB; `pod-design-agent` is deliberately smaller. Do not "tidy" a kit by shortening it. Precision in these files is what keeps a scheduled agent from improvising against someone's live business.

This repository is the canonical source for Ecom Agents. It is not a fork tracking an upstream project, and nothing is ported or synced from anywhere else. Version history starts at 1.0.0 here. Identifiers kept from the retired ai-employees naming, such as `employee.json`, `~/.ai-employees` paths, `-employee` slugs, `ai-employee-receipt/2` receipts and the `baseline_kind: 'upstream'` field inside them, exist only so installs made under the old name keep working. Treat them as compatibility code, never as a reason to reintroduce the retired branding.

## Repository layout

| Path | What it holds |
|---|---|
| `agents/<slug>/` | One complete kit. Nine of them |
| `agents/<slug>/routines/<id>/SKILL.md` | One scheduled routine. The largest and most important files here |
| `agents/<slug>/scripts/` | `guard.mjs`, `runlog.mjs`, `copy-check.mjs`, and a kit's own extras such as the Ad Manager's `review.mjs`. Each carries its own self test |
| `agents/<slug>/examples/` | Fictional example output. Never real customer or member data |
| `installer/cli.mjs` | Run `node installer/cli.mjs hire <slug> --to <private-folder>` from this checkout. The app uses Node 22 or newer; installed kit scripts retain Node 18 compatibility |
| `skills/hire/` | The same install flow as a Claude Code skill |
| `docs/` | Reader documentation: install, prerequisites, harnesses, cost, FAQ |
| `.github/scripts/` | `no-dashes.mjs` and `selftests.mjs`, both wired to CI |

## Checks you must run before opening a pull request

```bash
node .github/scripts/selftests.mjs
node .github/scripts/no-dashes.mjs
node installer/cli.mjs list
```

All three must pass. `selftests.mjs` runs the self test inside every script under each kit's `scripts/` folder. `no-dashes.mjs` enforces the rule below and is the one gate that fails builds most often.

## Rules that are not style preferences

**No em dashes or en dashes, anywhere.** Not in markdown, not in a code comment, not in a commit message. Use a period, a comma, or split the sentence. `no-dashes.mjs` enforces it and CI fails on a single violation. This exists because the kits write copy that gets published under a person's name, and a kit that uses dashes teaches the routine to use them too.

**A time, a budget or a price lives in exactly one place.** Clock times, windows and budgets live in a kit's `SCHEDULE.md` row and nowhere else. A routine `SKILL.md` that contains a clock time is a defect, not a source. The same rule holds for any number a routine might publish: it comes from a named file with a source and a date beside it.

**Never invent an example.** Everything under `examples/` is fictional and must stay fictional. Never commit a real customer, a real contact, a real account screen, a real API key, or a real price from anyone's live business.

**The product name is "Ecom Agents".** "AI Employees" and "Agent Employees" are retired names. The specification itself is **the Ecom Agent Standard**, a proper noun.

**A routine holds every outbound action unless the member released the channel.** It drafts, fills, stages and leaves things open for a person to send; where `RELEASES.md` in the member's install names the channel, it completes the action and records it. A change that makes a shipped routine send, submit, post or spend with no release behind it does not belong in this repository, and no routine ever writes a release.

## Adding or changing a kit

- Every kit carries `VERSION` and `CHANGELOG.md`. Bump both in the same commit that changes kit behaviour, and add a line to the root `CHANGELOG.md` linking the kit changelog.
- This checkout is the verified distribution source. `package.json` is a private scoped package; do not direct users to an unverified unscoped npm package. Bump the source package version with kit releases. Registry publication requires an explicit owner decision and is not performed by agents. A published version number can never be reused. State in the pull request that source changes do not update existing installs or registry packages automatically.
- The nine kits share one skeleton. If you change a shared section in one kit, check whether the other eight need the same change. Roughly 60 to 70 percent of a kit by bytes is shared standard text with the role name substituted.
- A new routine needs a `SCHEDULE.md` row, a `run/<id>.cmd.example` launcher, and a `routines/<id>/SKILL.md`. The routine id, the folder name and the YAML `name` key are always the same string.
- Fire times are staggered: a browser capable routine takes the first free minute at or after the previous browser capable fire plus that routine's **full budget** plus twenty minutes. Use the budget, never the typical run time.

## Commit and pull request conventions

Write the commit subject as a plain sentence saying what changed, no prefix and no dash. Explain in the body why the change was needed, and name the evidence if a run record or a field report prompted it. Keep one concern per commit.

## What is out of scope for an agent working here

Do not create GitHub releases, publish to npm, or alter the repository visibility. The owner does those by hand. `LICENSE` and `SECURITY.md` are legal documents: edit them only when the owner asks, and say why in the pull request.
