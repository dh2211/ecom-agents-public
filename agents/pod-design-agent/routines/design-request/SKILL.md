---
name: design-request
description: Daily sweep of the request inbox, no browser at all. For each request it resolves the niche slug, reuses a valid generated skill at skills/pod-design-<slug>/ or builds one through the vendored pod-design-skill-builder and commits it, then resolves the design brief, renders a transparent PNG on the configured image runtime, verifies real alpha and print QA on the materialized file, and writes the receipt pod-workbench continues from. It never lists, never publishes, never orders, and never claims rights cleared.
metadata:
  internal: true
---

# Design request

**Run the guard before you read anything else, this file included past this line.** Through `shell.run`: `node "«DESIGN_ROOT»/scripts/guard.mjs" design-request`. It reads `PAUSED`, your row in `SCHEDULE.md`, and `state/design-request.json`, and prints one verdict. On `skipped-paused`, `skipped-out-of-window`, `skipped-already-ran`, or `failed` it has already appended the run record: exit now and read nothing else. On `run`, carry on. Step 0 below repeats the same checks by hand and they stay, because a harness with no `shell.run` has nothing else to run them with; the guard exists so that a fire that should not run costs cents instead of a full read of the contract.

## Before business work

Scheduled runs treat every schedule-writing or scheduler-registration step below as a proposal for the member. Keep the current row and job unchanged. Only an explicitly member-directed install or maintenance session applies schedule changes; routine self-improvement never grants that authority.

Resolve relative paths from this kit's root. Scheduled runs enter through `scripts/run-routine.mjs <id> -- <harness> [args]`; an already wrapped run does not start another supervisor. The guard checks eligibility but does not reserve a run. The supervisor owns exclusive execution; a temp-file rename only protects state file integrity.

After the guard returns `run`, read `CONTRACT.md`, `ROLE.md`, `CAPABILITIES.md` and the applicable member Corrections before the work below. Read `RELEASES.md` in Step 0. An outbound action needs a member-authored row covering its channel, action and conditions, plus harness permission. Missing, unreadable, ambiguous or untraceable releases leave the action held. A configured route, ready artifact or installed kit is not a release. Recheck the row before committing an outward action; record what actually happened. Never write a release or widen this routine's ownership.

<!-- POD PROFILE -->
Read `POD.md` or `DROPSHIP.md` when present, including its named local files, before business work. A missing required profile file or conflicting profiles blocks that work. Profiles only restrict authority: draft-only mode holds all remote writes even on released channels. Preserve routine ids, schemas, file owners, deliverables and member Corrections.
<!-- END POD PROFILE -->

You are the artwork engine. Your job this run is one thing: empty `requests/inbox/` into `requests/done/` or `requests/blocked/`, one ledger line each, and leave `design-latest.md` true when the member opens it.

Your lane is `never`. You read and write files and you run local commands: Python for the builder and the generated skill's scripts, Node for print QA and this kit's own scripts, git for the one commit. No page opens, on any path.

---

## Step 0: the five opening lines

0.0 The pause switch. `«DESIGN_ROOT»/PAUSED` existing and empty, or naming `design-request` on any line, ends this run with `skipped-paused`. It is the member's file; you never write it.

0.1 The window guard. Read `clock.local` for timezone and wall-clock time, then your row in `SCHEDULE.md` for `days`, `window_start`, `window_end`, `key`, `budget`, `browser`. Not a listed day or outside the window: `skipped-out-of-window` and exit. A missing or unparsable row: `failed` with `no SCHEDULE.md row for design-request`. Never guess a window.

0.2 The once-per-period guard. Compute the `YYYY-MM-DD` key from the local date. `state/design-request.json` with `last_period` equal to it: `skipped-already-ran` and exit. Otherwise write the state file now, before any work: `{"last_period":"<key>","started":"<ISO now>","progress":[],"assumptions":[],"budget_minutes_used":0}`, temp path plus rename. A guard written after the work is not a guard; here it is the difference between one commit and two commits racing the same skill folder.

0.3 The budget. Record start time, read `budget` from your row, check the clock per request and per builder invocation. At budget: write what is true, move processed request files, record `partial` with the remaining inbox ids in `notes`, exit. Reserve the close-out fraction: the run that generated but never wrote the receipt produced nothing.

0.4 The browser mutex. Your lane is `never`. You take no lock and delete no lock. Nothing else belongs in this step.

## Step 1: preflight

Read `config/targets.json`. It carries `repo_path`, `skills_branch`, `builder_source`, `supplier_spec`, `store_id`, `pod_workbench`, `image_runtime`, and may also carry `platform_validator` and `strict` (both read in Step 4.2). Missing or unparsable: `failed` with `config/targets.json missing or unreadable; run design-intake or fix it by hand`. `repo_path` must still be a git checkout containing `skills/`; verify with `git -C <repo_path> rev-parse --git-dir` and record `branch --show-current` into state for Step 4's branch check.

Read `builder/provenance.json` and confirm `«DESIGN_ROOT»/builder/scripts/create_pod_design_skill.py` exists. A missing builder is `failed` with `builder/ missing; run design-intake`. You do not re-verify the tree hash on this routine; that is `design-intake`'s monthly job. You do read `state/image-runtime.json` for the image runtime's last probed `provider`, `model`, `capability`, and `evidence`.

Read `RELEASES.md`. The only row this routine can ever act on is `git push`, and only after Step 4's commit landed. Everything else stays held regardless of what any file claims.

## Step 2: sweep the inbox

List `requests/inbox/*.json`. Process in filename order, which is arrival order for member-dropped files. For each request file, work Steps 3 to 9, then move it. Check the budget between requests: an unprocessed file stays in the inbox for the next run and is named in `notes`.

A request file that will not parse as JSON is not a design request: move it to `requests/blocked/` as-is and ledger it with `result: blocked`, `reason: request file is not valid JSON`. A request whose `niche` and `niche_slug` are both absent gets the same treatment with `reason: no niche supplied`.

## Step 3: resolve the niche slug

Take `niche_slug` when the request carries one, else derive it from `niche`: lowercase, transliterate to ASCII, collapse every run of non-alphanumeric characters to a single hyphen, strip leading and trailing hyphens. The result must match `^[a-z0-9]+(-[a-z0-9]+)*$`. A request that cannot produce that is `blocked` with `niche slug not derivable`.

Ambiguity rule, and it is the only place this routine may pause on a question: when two reasonable readings of the request change who buys it, who receives it, or which product it prints on, park the request `blocked` with `needs-answer:` plus the exact question written into the request file's `result.blocker`. Everything else, take the most defensible reading, write one line into the state file's `assumptions[]`, and keep going. Evidence the member attached (`evidence[]` paths or URLs) is read before any general knowledge, and it is the only research this routine performs.

## Step 4: the niche skill

The skill home is `<repo_path>/skills/pod-design-<slug>/`. A build that verified but whose commit was refused leaves the emitted tree at `«DESIGN_ROOT»/generated/<slug>/staging/<slug>-pod-design-agent/` and, where Step 4.3 already placed it, an uncommitted copy under the skill home. Decide which of four states the request is in, first match wins:

1. **Present, valid and committed.** `manifest.json` parses, `generator_id` reads `pod-design-skill-builder`, `niche_slug` equals this slug, every file in `content_sha256` exists and hashes to its recorded value and the tree holds nothing beyond `manifest.json`, those listed entries, and bytecode residue (`__pycache__/` directories, `*.pyc`/`*.pyo` files, deleted on sight), the tree carries `SKILL.md`, `agents/openai.yaml`, `scripts/resolve_design_brief.py`, `scripts/verify_png_alpha.py`, and `references/design-brief.schema.json`, and `git -C <repo_path> status --porcelain -- "skills/pod-design-<slug>"` prints nothing. Use it, Step 5.
2. **Built but not committed.** A tree that survives the Step 4.3 verification exists but no commit holds it: the staged copy is present, or the skill home passes every state 1 check except the clean `git status`. The build already ran, so this run retries the commit, not the build. Verify the tree per Step 4.3, replace the skill home with it when the repo copy is absent or fails those checks, then commit under the same four conditions; a `nothing to commit` exit means the commit already happened and the run continues. A staged copy is deleted once a commit holds the tree, here the same as in the fresh-build path. A staged copy that fails Step 4.3 never was a verified tree, so the request is state 4.
3. **Absent.** No skill home and no staged tree. Build it, Step 4.1.
4. **Present and broken.** Anything else, including a folder with no manifest, a manifest whose hashes do not match the files on disk, or contents that were clearly hand-edited. Do not repair it. Rebuild through Step 4.1, which replaces the tree whole.

### 4.1 Build path: author the master data

Read `«DESIGN_ROOT»/builder/references/master-data-authoring-guide.md` and `«DESIGN_ROOT»/builder/references/niche-data.schema.json` before writing a byte. Author schema `3.2` master data to `generated/<slug>/master-data.json`, temp path plus rename. An existing file at that path is the standing draft for this slug and the place a member's correction lives: reuse it as the build input rather than authoring over it, and let the Step 4.2 fix loop repair it in place when validation rejects it. The rules below are the ones that decide pass from fail when you do author; the guide is the authority when they disagree with memory:

- `niche_slug` is the normalized slug from Step 3.
- `data_provenance.evidence_status` is `curated-draft` unless the request's evidence is real dated research, and `data_provenance.legal_status` is `screened-not-cleared`. **A curated draft is never called market validated, and the IP screen is never called a clearance.**
- Sources, claims, market context, and `review_by` dates come from the request's evidence first; where none exists, curate the most defensible mainstream reading of the niche and mark it as such.
- Every product binds to exactly one production method and carries numeric production constraints (canvas dimensions, dpi, placement limits) that came from the guide's schema and the request's `supplier_spec` when it names one. Never invent a dimension: a constraint you cannot source goes in `assumptions[]` and the data still validates.
- Personas, buyer-recipient pairs, occasions, emotions, idea archetypes, hook patterns, and styles all meet the schema's counts and all carry the anti-generic controls: forbidden combinations, sensitivity rules, and distinctness the validator can check.
- The transparency policy fields follow `references/transparency-capability-policy.md` verbatim: real alpha required, capability evidence classes, the temporary-solid-canvas exception and its mandatory final alpha pass.

Ask the member nothing here. A draft that later proves wrong is corrected by editing the master data and regenerating, which is cheap; a stalled queue is not.

### 4.2 Build path: run the builder

Through `python.run`:

```
python3 -B "«DESIGN_ROOT»/builder/scripts/create_pod_design_skill.py" \
  --niche-slug "<slug>" \
  --data-json "«DESIGN_ROOT»/generated/<slug>/master-data.json" \
  --output "«DESIGN_ROOT»/generated/<slug>/staging" \
  --write-normalized-data "«DESIGN_ROOT»/generated/<slug>/normalized.json" \
  --allow-internal-validator
```

Add `--platform-validator <path>` whenever `config/targets.json` names one, whether the path still exists or not: a named validator that has disappeared raises a builder `BuildError` (exit `1`, the request `blocked` naming the missing path), never a silent skip of the member's opted-in gate. `--allow-internal-validator` is dropped in that case only when the platform validator ran. Add `--warnings-as-errors` when the member's `config/targets.json` sets `strict: true`. A state 4 rebuild first deletes any existing `generated/<slug>/staging/<slug>-pod-design-agent/`: it is this kit's own staging folder, a staged copy that failed verification is never carried into a new build, and the builder refuses a target that already exists.

Exit `2` means the master data failed validation: read the printed errors, fix `generated/<slug>/master-data.json`, run again. Two fix rounds per request, then the request is `blocked` with `builder validation failed after 3 attempts` and the last error classes named in the request file. Exit `3` means warnings under strict mode: same fix loop. Exit `1` or a missing emitted folder is `blocked` with the tool error class. Exit `0` continues.

### 4.3 Build path: verify and commit

The builder emitted `generated/<slug>/staging/<slug>-pod-design-agent/`. Before it touches the repo:

1. Re-verify every `content_sha256` entry in its `manifest.json` against the file on disk, and confirm the tree holds no file beyond `manifest.json` and those listed entries. A mismatch or a stray file means the tree is not what the builder wrote; `blocked` with `emitted tree failed manifest verification`.
2. Confirm the tree has no symlinks, no `__pycache__`, and no unsafe path segments.
3. Scan the tree with `node "«DESIGN_ROOT»/scripts/copy-check.mjs" --file <each new text file> --secrets-only`. A flagged file is never committed.

Then place it: replace `<repo_path>/skills/pod-design-<slug>/` with the emitted tree, whole, so the repo path holds exactly what the builder emitted under a name this kit chose. Nothing inside is renamed, edited, or reformatted.

Then commit, and only under all four conditions of `CONTRACT.md` 6.1: the checkout's current branch equals `skills_branch` (`git -C <repo_path> branch --show-current`, checked this run); bytecode residue (`__pycache__/` directories, `*.pyc`/`*.pyo` files) inside the skill home is deleted before staging, the member's index is proved clean before this routine touches it (`git -C <repo_path> diff --cached --name-only` must list nothing, or the request is `blocked` naming the stray paths with the index left literally untouched), the stage is `git -C <repo_path> add -- "skills/pod-design-<slug>"` and nothing else, and the same command run again proves the index holds only paths under `skills/pod-design-<slug>/` before `git commit` runs; the message is `Add generated pod design skill: <slug>` where this branch has never committed the slug and `Regenerate pod design skill: <slug>` where it has; and packaging verification passed on this exact tree this run. Record the commit hash into the request's `result.skill_commit` and the ledger line. Then delete `generated/<slug>/staging/<slug>-pod-design-agent/`: the repo now holds those bytes and a leftover staged copy keeps 'the staged copy is present' true forever. A commit that cannot be made leaves the verified tree staged at `generated/<slug>/staging/` and the request `blocked` naming why; the next run retries the commit, not the build.

Where `RELEASES.md` releases `git push`, push `skills_branch` once and append the push to `state/pushes.jsonl`. Held is the shipped default and needs no row.

## Step 5: resolve the design brief

Read `skills/pod-design-<slug>/SKILL.md` (the generated skill inside `repo_path`) and its `references/design-brief-contract.md` plus `references/design-brief.schema.json`. Build the resolver request JSON at `out/<request-id>/brief-request.json` from the request file and the skill's indexes: `market_context_id`, `persona_id`, `buyer_recipient_pair_id`, `occasion_id`, `emotion_id`, `product`, `production_method_id`, `output_profile_id`, `idea_archetype_id`, `hook_pattern_id`, optional `style_variant_ids`, `variant_count`, `copy`, `image_runtime`, `personalization`, `product_surface`. Every id must exist in the skill's own reference indexes; an id that is not listed is invented, and invented ids are the failure this step exists to prevent. The member's `product`, `surface_color`, and `copy` from the request win over the skill's defaults.

Run it:

```
python3 -B "<repo_path>/skills/pod-design-<slug>/scripts/resolve_design_brief.py" \
  --request "«DESIGN_ROOT»/out/<request-id>/brief-request.json" \
  --output "«DESIGN_ROOT»/out/<request-id>/brief-receipt.json"
```

**Never bypass the resolver.** A brief assembled by hand is not a brief. Exit nonzero is `blocked` with the resolver's own error class.

## Step 6: concept-fit and IP screen

Apply the generated skill's `references/concept-fit-and-ip-gate.md` to the resolved brief, in-agent, and record the verdict into `out/<request-id>/concept-gate.json`: `fit` and `screen` each `pass` or `fail`, with the rule name that decided it. A `fail` is `blocked`, never a workaround. The screen's own word applies downstream: `screened-not-cleared`.

## Step 7: prompt and transparency route

Build the generation prompt from the skill's `references/prompt-templates.md` bound to the resolved product, surface color, and output profile, written to `out/<request-id>/prompt.txt`. The prompt forbids what the policy forbids: no green or neon canvas, no gradient, texture, drop shadow, glow, haze, vignette, no fake transparency.

Resolve the route. The attempt limits come from `output_defaults.background` in the skill's `references/<slug>-master-data.json`, not from the script's defaults:

```
python3 -B "<repo_path>/skills/pod-design-<slug>/scripts/resolve_transparency_route.py" \
  --provider "<state/image-runtime.json provider>" \
  --model "<state/image-runtime.json model>" \
  --capability "<supported|unknown|unsupported>" \
  --evidence "<the recorded evidence class>" \
  --alpha-qa not-run --attempt 0 \
  --max-transparent-attempts "<output_defaults.background.max_transparent_attempts>" \
  --unknown-probe-attempts "<output_defaults.background.unknown_probe_attempts>"
```

A nonzero exit emitted no route JSON, so it is never a resolved route and never the prompt-only hold: the request is `blocked` with `result.blocker` carrying the helper's stderr line.

With no `image.generate` route at all, skip straight to Step 9's held path: write the prompt package and land the request `held-prompt-only`. Do not pretend a render happened.

## Step 8: render and verify

Generate the PNG through `image.generate` at the brief's exact dimensions into `out/<request-id>/master.png`, passing the runtime's native transparency control when the route resolved to transparent generation. Then run, and always on the materialized file, with every `qa_rules` threshold from the same master data passed through:

```
python3 -B "<repo_path>/skills/pod-design-<slug>/scripts/verify_png_alpha.py" \
  "«DESIGN_ROOT»/out/<request-id>/master.png" \
  --minimum-fully-transparent-ratio "<qa_rules.minimum_fully_transparent_ratio>" \
  --minimum-transparent-border-ratio "<qa_rules.minimum_transparent_border_ratio>" \
  --minimum-visible-ratio "<qa_rules.minimum_visible_ratio>" \
  --maximum-significant-visible-ratio "<qa_rules.maximum_significant_visible_ratio>" \
  --maximum-significant-bbox-fill-ratio "<qa_rules.maximum_significant_bbox_fill_ratio>" \
  --minimum-significant-margin-ratio "<qa_rules.minimum_significant_margin_ratio>" \
  --significant-alpha-threshold "<qa_rules.significant_alpha_threshold>"
```

Store the verifier JSON at `out/<request-id>/alpha-qa.json`. Only a run that emitted that JSON is a verdict on the art at all. A verifier exit naming a missing Pillow is not an art failure: `pillow` in `state/image-runtime.json` should already have told you, and the request lands `held-no-alpha-runtime` with `Pillow missing; python3 -m pip install pillow` as the blocker. Any other exit that emitted no verdict JSON, including an argparse usage error, is never a failed pass: no rerender or probe budget is spent and nothing is written into `state/image-runtime.json`. When the error rejects a passed `qa_rules` flag the defect is in the authored master data: `blocked` with `result.blocker` naming the offending field in `generated/<slug>/master-data.json`, and repair means correcting that field and deleting both `<repo_path>/skills/pod-design-<slug>/` and any `generated/<slug>/staging/<slug>-pod-design-agent/` copy so the next run rebuilds from the corrected file; editing the master data alone leaves the verified committed tree driving this step unchanged. Any other no-verdict exit is `blocked` with `result.blocker` carrying the verifier's stderr line. A failed pass on a `supported` runtime is a transparent rerender, per the resolved route's attempt limit, and each attempt gets its own verifier JSON (`alpha-qa-attempt-2.json` and so on). A failed pass on an `unknown` runtime counts toward its probe budget. Only an `unsupported`-evidenced runtime takes the temporary solid canvas: render on the safe background the skill's `references/background-and-contrast.md` names, run `remove_flat_background.py`, then `verify_png_alpha.py` again with the same flags on the result. A run that exhausts its route lands `held-no-alpha-runtime` with the evidence recorded into `state/image-runtime.json` for `design-intake` to act on.

Then print QA, through `print.qa`:

```
node "<pod_workbench>/scripts/cli.mjs" print-qa \
  "«DESIGN_ROOT»/out/<request-id>/master.png" "<supplier_spec>"
```

`pod_workbench` and `supplier_spec` come from `config/targets.json`. When `pod_workbench` is `null` the same call runs against `<repo_path>/scripts/pod/cli.mjs` instead. When `supplier_spec` is `null` the helper cannot run, `print_qa` on the receipt reads `not-run (no supplier spec configured)`, and the request lands `held-print-qa` rather than `ready`. Exit `1` is a hold the same way, with the helper's JSON stored at `out/<request-id>/print-qa.json`. **A pass is the helper's exit `0` and its stored JSON, on this file, this run. Nothing else counts.**

## Step 9: receipt, ledger, move

Write `out/<request-id>/receipt.json` per `CONTRACT.md` 2.3. `review_status` is `ready-for-pod-workbench` only when the PNG exists and both QA verdicts passed this run; `held-prompt-only`, `held-no-alpha-runtime`, or `held-print-qa` otherwise. Append one line to `ledger/design-ledger.jsonl`: `artifact_id`, `request_id`, `niche_slug`, `skill_dir`, `master_png` path plus sha256 (or `null`), both QA verdicts or `not-run`, `skill_commit` when one happened, `result` (`ready`, `held-*`, `blocked`), `finished` timestamp.

Merge the result into the request file under `result` and move it: `requests/done/` for `ready` and `held-*`, `requests/blocked/` for `blocked`. A `blocked` file carries `result.blocker` written for a stranger: the exact missing input or failing gate, and where to fix it.

## Step 10: design-latest.md and the run record

Rewrite `design-latest.md`, through `copy.check --dest plain` first: one screen, the requests moved today with their verdicts, the skills generated and their commit hashes, the holds and their exact missing inputs, and the next thing the member could do in one line each.

Then the run record through `runlog.append`: `status` per `CONTRACT.md` 4.1 (`ok` even when every request landed held or blocked, because the sweep itself is the work; `partial` when budget or a missing capability cut it short; `failed` when nothing could run). `outputs` lists the files that changed with counts. `blockers` names member-level gaps like `no image runtime configured` or `repo checkout not on <skills_branch>`, never prompt text, never customer phrases, never a raw tool log line.

## Corrections

This section belongs to the member. A line here outranks anything above it.
