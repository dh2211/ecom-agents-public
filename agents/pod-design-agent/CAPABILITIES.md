# POD Design Agent: capabilities

Routines name capabilities and never a tool. This file is the only place in the kit that maps a capability to a concrete route, and it does so one row per harness where the harnesses differ. When a routine's SKILL.md says `image.generate`, this file says what that is on the machine in front of you.

## 1. How to check what your harness supports

Probe live, in this run, never from memory and never from what a previous run found. The five checks that decide everything:

1. **Files and shell.** Can you read and write under `«DESIGN_ROOT»` and run a local command? Without `file.*` and `shell.run` nothing in this kit runs.
2. **Python.** `python3 --version`, or `py -3 --version` on Windows. The builder and every target script are Python, standard library only, 3.10 or newer.
3. **Node.** `node --version`, 18 or newer, for the print QA helper and this kit's own scripts.
4. **Git.** `git --version` and read access to `repo_path`.
5. **The image runtime.** Whatever `config/targets.json` names under `image_runtime`: a harness image tool, or a member-configured CLI or local endpoint. Probe it by asking for one small transparent PNG and inspecting the file that lands, not the setting it claims to honor. `state/image-runtime.json` is where the verdict lives, with its evidence class.

## 2. The harnesses, honestly

The kit needs files, a shell, Python, Node, git, and at most one image runtime. No browser lane exists. On the eleven harnesses the fleet supports, files and shell are core or expected on all of them; the scheduler differs, and section 8 carries that table. The open question per harness is the image runtime: a harness with no image tool still runs the whole kit, and holds each request at the prompt package.

## 3. Environment and files

### `clock.local`

Harness clock first, then a shell command: `date +"%Z %Y-%m-%d %H:%M:%S"` on macOS and Linux, `powershell -NoProfile -Command "(Get-TimeZone).Id; Get-Date -Format 'yyyy-MM-dd HH:mm:ss'"` on Windows. Never a timezone from memory or from a previous run.

### `file.read`, `file.write`, `file.list`

Harness file tools first, then the shell. Writes that a crash could truncate go to a temp path plus rename, which is also how the state file, the ledger, and every JSON the kit emits are written.

### `shell.run`

The harness's own shell tool. Where it is absent, `python.run`, `node.run`, `vcs.*`, `builder.run`, and `print.qa` all have no route and the run cannot complete; record `failed` with `no shell.run route`.

## 4. Language runtimes

### `python.run`

Run a Python 3 script and read its output. Routes: the harness's Python execution, then `shell.run` with `python3` (POSIX) or `py -3` (Windows). Exit codes carry meaning and the routines read them: `0` pass, `1` tool error, `2` validation failure, `3` warnings under `--warnings-as-errors` or a missing runtime dependency. A nonzero exit is data, not an exception to swallow. Every script invocation passes `-B`: `__pycache__/` and `*.pyc`/`*.pyo` bytecode caches are residue, never part of a verified or committed tree.

**Pillow is required for the image scripts.** `verify_png_alpha.py` and `remove_flat_background.py` import `PIL`; the builder, the resolvers, and `select_records.py` are standard library only. The probe is `python3 -c "import PIL"`. A missing Pillow is recorded once in `state/image-runtime.json` beside the capability verdict and is a member-installed fix (`python3 -m pip install pillow`), never something a routine installs silently and never a reason to skip alpha verification.

### `node.run`

Run a Node script, 18 or newer. Routes: the harness's Node execution, then `shell.run` with `node`.

### `builder.run`

`python.run` on `«DESIGN_ROOT»/builder/scripts/create_pod_design_skill.py`, the intake-verified private copy of the vendored builder. No vendored path outside `builder/` is ever invoked; the repo copy under `skills/pod-design-skill-builder/` is the source of truth the intake copies from, and `«DESIGN_ROOT»/builder/provenance.json` records which tree it holds.

### `print.qa`

The POD print QA helper, one call: `node <helper> print-qa <image.png> <supplier-spec.json>`. Route order: `node.run` on `<pod_workbench>/scripts/cli.mjs` when `config/targets.json` names an installed `pod-workbench` copy under `pod_workbench`, then `node.run` on `<repo_path>/scripts/pod/cli.mjs`. Exit `0` is pass, `1` is a hold, `2` is invalid input. **The JSON it prints is the verdict and it is stored beside the PNG. A pass nobody ran is the one lie this kit is forbidden to tell.**

## 5. The image runtime

### `image.generate`

Produce one PNG file from a prompt at the brief's exact pixel dimensions, writing to a path under `out/<request-id>/`, honoring a native transparency control (`background=transparent`, `transparent_background=true`, or provider equivalent) when the runtime exposes one.

Routes, in preference order:

1. The harness's own image generation tool, when one exists.
2. The route `config/targets.json` names under `image_runtime`: a member-configured CLI, a local endpoint, or a provider call the member set up. The config names the invocation shape and the runtime's provider and model labels; **it never contains a key**. A runtime that needs a credential reads it from the member's own environment at exec time, and its name, never its value, is what lands in `state/image-runtime.json`.
3. Nothing. The capability is absent, the prompt package is still written, and the request lands `held-prompt-only`.

The capability verdict is not a guess. `resolve_transparency_route.py` takes `--provider`, `--model`, `--capability {supported,unknown,unsupported}`, `--evidence` class, and attempt counts, and returns the mandated route. `supported` means a native transparent control exists or the runtime's own PNG already passed `verify_png_alpha.py` this install. `unsupported` is earned by `explicit-provider-limitation`, `transparent-option-rejected`, or `failed-probes`, and it unlocks only the temporary solid canvas route, which still ends in `remove_flat_background.py` plus a final alpha pass. **Capability evidence outranks brand and version names**, and `state/image-runtime.json` records it with `probed_at` so `design-intake` re-probes monthly.

## 6. Version control

`vcs.status`, `vcs.log`, `vcs.diff` are read-only against `repo_path`: current branch, clean tree, the diff of the staged skill tree before commit. `vcs.commit` is `git -C <repo_path> add -- skills/pod-design-<slug>` plus `git -C <repo_path> commit` with the contracted message, and it runs only after the four checks in `CONTRACT.md` 6.1 pass. `vcs.push` exists only where `RELEASES.md` names it. No other git mutation exists: no merge, rebase, reset, stash, checkout over member work, branch delete, or force anything.

## 7. Kit capabilities

### `runlog.append`

`node.run` on `«DESIGN_ROOT»/scripts/runlog.mjs`, then a direct append performing the same validation in the agent. One validated record per routine per period; the script refuses secret-shaped strings, multi-line fields, and drafts.

### `copy.check`

`node.run` on `«DESIGN_ROOT»/scripts/copy-check.mjs`, then the same rule set applied in the agent, marked `copy-check: in-agent` in the run record. Interfaces are verbatim:

```
node "«DESIGN_ROOT»/scripts/copy-check.mjs" --file <path> --dest <destination> [--json]
node "«DESIGN_ROOT»/scripts/copy-check.mjs" --file <path> --secrets-only [--json]
```

Every file a person will read (the daily summary, a request's result fields, a changelog line) goes through `--dest plain`. Every diff about to be committed goes through `--secrets-only` first, and a flagged hunk is never committed.

### `schedule.register`

`design-intake` only. Harness scheduler first, then the operating system's through `shell.run`, then the exact commands written to `schedule-commands.txt` and named in the report. One job per routine, never a chained job, and one routine proved by hand before both are registered.

### `web.fetch`

Read a URL's text without a browser. `design-intake` only, for the two kit checks in `CONTRACT.md` section 7.2. Routes: the harness's own fetch, then `shell.run` with a fetch command. There is no browser fallback because this kit has no browser lane: absent means the check records its one `assumptions[]` line and the run carries on, never a blocker.

## 8. The scheduling layer

A scheduled job's only content is the invocation that runs one routine unattended in `«DESIGN_ROOT»`, wrapped by the supervisor:

```
node "«DESIGN_ROOT»/scripts/run-routine.mjs" <id> --root "«DESIGN_ROOT»" -- <harness> -p "Read «DESIGN_ROOT»/routines/<id>/SKILL.md and follow it."
```

`run/<id>.cmd.example` carries the expanded shape. The supervisor owns the lock, the journal, the budget-derived timeout, and the uncertain state; an unwrapped job is an unguarded run and `design-intake` never registers one. Where the harness has its own scheduler (Claude Desktop app, OpenClaw cron, Hermes cron, Codex scheduled runs, the `agy` runner, Cline cron, Grok recurring tasks, Qwen Code scheduled tasks, DeepSeek's plugin), register one job per routine there; where it does not (Claude Code CLI, OpenCode, Pi), mirror `SCHEDULE.md` into the operating system's scheduler: Task Scheduler on Windows, cron or launchd on macOS and Linux. A machine that sleeps through a fire is handled by the window and the period guard, not by widening anything.

## 9. Scheduled runs get no permission prompt

A routine that stops mid-run to ask whether it may read its own files has not been scheduled, it has been abandoned to a dialog nobody watches. The member configures narrowly scoped noninteractive permissions at registration, and the kit's contract, not the permission layer, is what stops the outward actions. Never auto-accept all permissions; the fix for a prompt is a narrower rule, not a wider one.

## Corrections

This section belongs to the member. A line here outranks anything above it.
