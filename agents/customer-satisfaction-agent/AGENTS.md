# AGENTS.md

**Customer Satisfaction Agent**. One of the nine Ecom Agents from [github.com/AoThunDao/ecom-agents-public](https://github.com/AoThunDao/ecom-agents-public).

This file follows the [AGENTS.md](https://agents.md) convention so that any harness can pick this kit up without being told how. It is a map, not the instructions. **The instructions are the files it points at, and they are authoritative over anything summarised here.**

## If you have been asked to install this Agent

The person opened you in this folder and said something like "install the Customer Satisfaction Agent from this folder". Read `INSTALL-PROMPT.md` and follow everything between `=== BEGIN PROMPT ===` and `=== END PROMPT ===` exactly as if they had pasted it. `«CSAT_ROOT»` is this folder, resolved to an absolute path. Where the `FILL THIS IN` block is unedited, work the lines out yourself the way the prompt says, and ask one question only if you cannot.

## If you have been asked to run a routine

Scheduled jobs use `node scripts/run-routine.mjs <id> -- <harness> [args]` from this kit root. The supervisor holds the run lock; a child already inside it must not start another supervisor. First run the cheap preflight `node scripts/guard.mjs <id>`. Exit on a non-run verdict, which the guard already records. On `run`, read:

1. `CONTRACT.md` - the laws every routine in this kit obeys. Read this even if the task looks small.
2. `ROLE.md` - what this Agent is responsible for and what belongs to someone else.
3. `SCHEDULE.md` - your row. It carries your days, window, period key, budget and browser lane. **Every clock time and every budget figure in this kit lives in that table and nowhere else.** If you find a clock time inside a routine file, that is a defect, not a source.
4. `routines/<id>/SKILL.md` - the routine itself.

Follow the routine opening preflight for `RELEASES.md` and any `POD.md` or `DROPSHIP.md` profile before business work. The guard checks eligibility only. Atomic state replacement protects file integrity; `scripts/run-routine.mjs` prevents concurrent wrapped runs.

Pre-owner refusals are stored separately in `state/runtime-refusals/*.json`. They mean no harness started for that invocation; never treat them as the owning run\'s terminal record. The member and fleet audit read this evidence alongside runtime journals.

## The routines in this kit

| Routine id | Instructions |
|---|---|
| `csat-churn-watch` | `routines/csat-churn-watch/SKILL.md` |
| `csat-deflection-desk` | `routines/csat-deflection-desk/SKILL.md` |
| `csat-desk-intake` | `routines/csat-desk-intake/SKILL.md` |
| `csat-desk-standup` | `routines/csat-desk-standup/SKILL.md` |
| `csat-inbox-sweep` | `routines/csat-inbox-sweep/SKILL.md` |
| `csat-reply-desk` | `routines/csat-reply-desk/SKILL.md` |
| `csat-satisfaction-report` | `routines/csat-satisfaction-report/SKILL.md` |
| `csat-taxonomy-refresh` | `routines/csat-taxonomy-refresh/SKILL.md` |

## What this Agent will never do

It drafts, fills, stages and leaves the last click to the person who hired it, unless that person released the channel in `RELEASES.md` at the kit root, in which case the routine that stages the channel completes the action and records it. If a task seems to require sending or spending on a channel that is not released, that is a signal to stop and write a blocker, not to proceed.

It also never edits its own `SCHEDULE.md` row, never widens its own budget, and never invents a number. Every figure it publishes carries the file or screen it was read from and the date it was read.

## Files it owns and files it must not touch

`state/`, `runlog.jsonl` and its own outputs are written by the routines. `SCHEDULE.md` belongs to the person who hired it. Anything under `strategy/` is shared, so read the writer rules in `CONTRACT.md` before writing there.

## If you are working on this kit as source code

Read the `AGENTS.md` at the root of the repository instead. It carries the contribution rules, the checks that must pass, and the no dashes rule that CI enforces.


<!-- POD PROFILE -->
## Optional POD profile

After the guard returns run and the core contract is read, check for POD.md.
If present, read it and its named local files before business work. It adds
restrictions; it never grants tool permission or relaxes the contract. Its
draft-only mode holds ALL remote writes, including formerly configured publish
routes. Keep the base routine ids, schemas, file owners and deliverables intact.
Never edit the member Corrections. Use scripts/run-routine.mjs as the scheduled
process entrypoint; guard.mjs alone does not reserve a run.
<!-- END POD PROFILE -->
