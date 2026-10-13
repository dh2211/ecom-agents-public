# POD Design Agent

**Role:** turning "a design for this niche" into a verified transparent print master with a receipt.
**What it replaces:** the handmade per-niche prompt pile, and the artwork half of a POD contractor's loop.
**What it is:** two routines that run on your own machine, on your own schedule, against a request folder you own.

This is not a chat window and not a design service. It is a small engine: drop a request into `requests/inbox/`, and on the next fire it checks whether that niche already has a design skill, builds one through the vendored `pod-design-skill-builder` when it does not, commits the generated skill into your repository, then resolves the brief, writes the prompt, renders the PNG on your configured image runtime, verifies real alpha on the file itself, runs print QA, and hands you a receipt `pod-workbench` can continue from.

**It never lists a product, never uploads, never orders from a supplier, never runs ads, and never publishes. Its deliverables are local files and receipts.** Generated skills are committed to your repository the moment they pass the builder's own packaging verification, with no review round in between; the review that matters for POD artwork, rights, spelling, contrast, mockup and placement, still belongs to a person downstream, and this kit never claims otherwise.

---

## What it owns

- **Niche design skills.** For a niche that has none, it authors schema 3.2 master data following the builder's own authoring guide, runs `create_pod_design_skill.py`, verifies the emitted package, and commits the result as `skills/pod-design-<slug>/` with the message `Add generated pod design skill: <slug>`. Teacher and pet memorial are only examples shipped inside the builder bundle; this kit treats them as references, never as installed skills.
- **The request queue.** `requests/inbox/` in, `requests/done/` or `requests/blocked/` out, one ledger line per request in `ledger/design-ledger.jsonl`.
- **The design loop.** Brief binding through `resolve_design_brief.py`, concept-fit and IP screening, product-aware prompting, transparent PNG generation where the runtime is proven capable, strict `verify_png_alpha.py` on the materialized file, and the POD print QA helper on the result.
- **The receipts.** `out/<request-id>/receipt.json`, carrying the PNG hash, the brief receipt hashes, both QA verdicts, and the review status for `pod-workbench`.

## The two routines

| id | Cadence | Shipped fire time | What it does |
|---|---|---|---|
| `design-request` | Daily | 09:00 | Sweeps the request inbox; builds or reuses the niche skill; resolves, renders, verifies, receipts |
| `design-intake` | First weekday of the month | 11:30 | Binds the repository, vendors and hash-verifies the builder copy, probes the image runtime's alpha capability, registers the schedule |

The times are the shipped defaults. `SCHEDULE.md` is where they live, and where they disagree with this table `SCHEDULE.md` wins.

## What it needs

Node 18 or newer, Python 3.10 or newer (standard library only), git, and a local checkout to commit generated skills into. An image runtime is optional by design: without one, requests still resolve and come back as held prompt packages instead of fabricated passes.

## Installing it

Copy this folder somewhere local, outside OneDrive, Dropbox, Google Drive and iCloud, then open your agent there and say "install the POD Design Agent from this folder", or paste the prompt inside `INSTALL-PROMPT.md`. The intake binds your repository checkout, copies and hash-verifies the vendored builder, probes your image runtime, and registers two scheduled jobs through `scripts/run-routine.mjs`, the supervisor that owns the lock, the journal, and the timeout.

---

## Corrections

Format: one line per correction, newest at the top, `YYYY-MM-DD: what was wrong, what to do instead.`

Nothing reads this file at runtime, so a correction that has to change behaviour belongs in `CONTRACT.md`, in `CAPABILITIES.md`, or at the bottom of the routine it applies to. Use this section for anything about the kit as a whole that you want the next person reading it to see.
