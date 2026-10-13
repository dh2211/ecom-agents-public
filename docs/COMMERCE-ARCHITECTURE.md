# Commerce Orchestrator and one-command local app

End users start with [README](../README.md) and the [user guide](COMMERCE-GUIDE.vi.html).
The source and app versions live in [package.json](../package.json).

Read the [baseline repair verification](../plans/260922-commercial-readiness-fixes/plan.md)
and [follow-up repair verification and delivery status](../plans/260922-review-followup-fixes/plan.md)
alongside the historical reviews. Local regression evidence does not certify a real
business deployment. Document ownership is in [FLOCK.md](../FLOCK.md).

Executable owners: [workflow plans](../app/commerce/workflows.mjs),
[state transitions and gates](../app/commerce/engine.mjs),
[persistence](../app/commerce/storage.mjs), [HTTP boundary](../app/commerce/server.mjs),
[worker execution](../app/commerce/runner.mjs) and [regression tests](../tests/commerce/).
The user guide owns the operational walkthrough; this page is the technical boundary reference.

## Entry points

- `npm start` / `node app/commerce/server.mjs`: local owner UI, no npm runtime dependencies.
- `START-WINDOWS.cmd`: native Node invocation, quoted repository path.
- `START-MAC.command`: shell launcher; npm start is also supported.
- `npm run commerce:audit`: read-only observation, no state initialization.
- `npm run commerce:recover -- --workers-stopped`: explicit dead-owner lock recovery.
- `npm run test:commerce`: tests for the new layer.

`--home PRIVATE_PATH` or COMMERCE_HOME selects a separate data root. Default:
`~/.ecom-agents-commerce`. Source ancestors/descendants, Git checkouts and obvious
cloud-sync locations are rejected. `--port 0` selects a free port. `--no-open` prints
the private URL without launching a browser. Never expose the server through a proxy.

## Architecture and compatibility

Owner -> fixed workflow plan -> durable task ledger -> on-demand role adapter ->
validated artifact -> owner review -> next eligible step.

This is a separate on-demand lane. It does NOT trigger the scheduled kit
routines out of window. No existing Agent state, profile, schedule or contract is
rewritten. Domain sources are reused without treating a scheduled routine as a worker.
Commerce Orchestrator is an app and optional operating skill, not another legacy cron kit.

Five fixed dependency graphs cover POD launch, Dropship launch, creative production,
ads learning and customer feedback. No arbitrary AI-authored executable graph is accepted.
Seven task role adapters cover GTM, POD/Dropship Workbench, Creative, SEO, Ads and CSAT.
This release does not claim it automatically controls every installed Agent.

Chief of Staff remains unchanged and read-only. observer.mjs reads the app ledger and
artifacts independently. Its report may be given to a CoS operator, but no additional
CoS read path or authority is installed automatically.

## Persistence and ownership

commerce.json is one checksummed snapshot containing settings, projects, attempts,
review records and hash-linked events. An exclusive transaction directory serializes
read/modify/write. A temporary file is fsynced before rename; POSIX additionally fsyncs
the parent directory. This is local persistence, not a distributed transaction service.
Checksums detect accidental changes; they are not signatures or access-control tokens.

A server lock refuses a second coordinator. Each job is durably claimed before a
worker starts. Each attempt gets a new identity and immutable request/output folder.
An interrupted write may leave unused files, not authority to declare a job completed.

States: waiting -> ready -> running / awaiting-result -> review -> succeeded.
Workers can return hold or failed. Invalid output, timeout, unsuccessful process exit
or restart yields uncertain. Retry requires an owner action; uncertainty requires
reconciliation. Maximum three attempts per job. Previous results are preserved.
Every step requires owner review; optional auto-advance only dispatches after approval.
One automatic worker subprocess runs at a time in this workspace. Manual handoffs may
exist in multiple projects. No app process means no background orchestration.

Bounds: 200 projects, 64 MiB ledger, 30 uploads per project, 50 MiB per file. Larger
workloads need a reviewed migration or separate workspace, not disabled integrity checks.

## Result contract and real gates

A commerce-result/1 response must match run_id, job_id, attempt_id and demo mode; it
must declare remote_mutation_allowed false. Only one JSON object is accepted. Source
dates must be valid and not future-dated. Generic report gates validate structure and
declared sources, not source truth. Every accepted draft still needs owner review.

Controller-side gates invoke the existing helpers:

- POD PNG: actual uploaded bytes and supplier spec through printQa.
- Economics: POD contribution or Dropship economics, matching project currency.
- Supplier: supplierReadiness for exact store/market, 24-hour source freshness.
- Final media: validateBrief and creativeAudit over project-owned asset ids, real
  files, source lineage, rights declarations and review records; ffprobe is required.

Stored results are SHA256-bound. Review and dependency dispatch recheck artifact
integrity and relevant gates. Approving a result also recursively rechecks all
transitive dependencies: their current attempt, owner approval, result integrity,
freshness gates and dependency result digests bound in each attempt's original
immutable request packet. Rejection remains available when upstream evidence is
stale, so the owner can record the reason without approving invalid evidence.
Upload filenames are generated; callers cannot supply
arbitrary disk read paths. No supplied human-review record is treated as authenticated
permission to publish, spend or grant rights.

## Worker routes

### Manual

The owner copies TASK.md/request.json into an already authorized agent and pastes its
JSON result. This is a structured handoff, not an automated Hermes/Codex/A2A connector.
No AI account, password or provider token is requested by this application.

### Built-in Claude

Print mode receives the prompt through stdin and emits a JSON envelope. Tools are
disabled with `--tools ""`, MCP is an empty strict configuration, setting sources are
empty, session persistence is disabled and turns are bounded. This route drafts from
supplied context only. It does not browse, run shell commands, inspect media or render.
No blanket permission-bypass option is used. Executable detection is not a login test.
CLI flag compatibility, authentication and quotas need real deployment verification.

On Windows native executables are invoked directly. A recognized npm .cmd installation
is resolved to its fixed package cli.js and run through Node. Unknown shims are refused.
No shell string is assembled from user input. Reference:
https://code.claude.com/docs/en/cli-reference

### Built-in Codex

`codex exec` receives the prompt through stdin (`-`) and prints JSONL events with
`--json`; the app keeps the text of the last `agent_message` item and fails on
`turn.failed` or `error` events. The run is `--sandbox read-only`, `--ephemeral`,
`--ignore-user-config` (no user MCP servers or profiles; login still comes from
CODEX_HOME), `--ignore-rules`, web search disabled, and every tool feature switched
off with `--disable` (list in `CODEX_DISABLED_FEATURES` in `runner.mjs`). Against
codex-cli 0.160.0 the only tool left in the request is `request_user_input`, which
has no effect in exec mode. No approval or sandbox bypass flag is used. Detection is
not a login test; sign in once with `codex login` (ChatGPT plan or API key).

On Windows the npm `codex.cmd` shim is resolved to `@openai/codex/bin/codex.js` and
run through Node, as for Claude. Reference: `codex exec --help`.

### Trusted external bridge

A local operator may create PRIVATE_WORKSPACE/runner.json, outside Git:

```json
{
  "schema": "commerce-runner/1",
  "command": "/absolute/path/to/node",
  "args": ["/absolute/path/to/operator-owned-bridge.mjs"],
  "stdin": "packet",
  "acknowledge_external_permissions": true
}
```

The existing native executable receives literal arguments. .cmd/.bat are refused.
A bridge reads stdin and writes exactly one commerce-result/1 JSON object on stdout.
Keep child processes attached, never detached/daemonized. The bridge enforces its own
filesystem, network, credentials, MCP, budget and remote-cancellation boundaries.
Owner acknowledgment is not a sandbox. This repository does not ship an authenticated
remote-worker channel or a ready-configured Hermes bridge.

stdout is bounded to 1 MiB and decoded as a UTF-8 stream. Raw provider stderr is not
retained, to avoid persisting possible secrets. Timeout/cancel attempts to stop the
process tree (POSIX process group; Windows taskkill) and records uncertainty/cancellation.
Stopping a local process does not prove remote business effects were undone.
References: https://nodejs.org/api/child_process.html and https://nodejs.org/api/url.html

## Local web protection and privacy

127.0.0.1 only, random per-process 256-bit token in the initial URL fragment. The UI
stores it in sessionStorage. API calls require token, exact Host, same Origin when
present, and JSON for mutation. No CORS. UI renders untrusted content through text
nodes; CSP prevents external scripts and frames. Known task files only are readable.
The static guide is separately trusted HTML with inline styling/scripts.

The browser keeps unsent result JSON, reviewer names and review notes in memory,
keyed by project, job and attempt. Drafts survive redraws, polling, API failures and
switching projects within the current page. A successful submission clears only its
submitted form. Reloading the page or closing the tab loses unsent drafts; the
browser does not persist them to localStorage, sessionStorage or the server.

`GET /api/state` returns an ETag. A matching `If-None-Match` receives HTTP 304,
avoiding snapshot construction, response serialization and full-state transfer.
Every request still reads and verifies the checksummed ledger and detects current
runner capabilities before computing the ETag. This reduces unchanged response
work; it does not cache or bypass ledger integrity or capability checks.

These controls do not defend against malicious processes with the same OS identity,
a compromised browser or an overprivileged external worker. There is no multi-user
login, tenant isolation, authenticated reviewer identity or action gateway. Supplied
context can leave the machine through the AI provider selected by the owner.

## Backup, recovery and updates

Graceful shutdown stops active subprocesses and releases the workspace only after no
active worker remains. Durable running attempts become uncertain at restart. Locks
are never auto-stolen. Recovery requires --workers-stopped and checks owner hostname
and local process absence before archiving lock directories. It never resets projects.
A reused live PID causes conservative refusal. Missing/malformed owner records require
manual inspection. Never delete a lock just to obtain a passing retry.

If approval fails because an ancestor's evidence changed or expired, reject the
pending result with a reason. Preparing the next task does the same when a later
task has already run: approved history stays in place and the owner creates a
revised project. A stale task with no later attempt can still be held and retried.
The app does not automatically refresh those inputs.

Stop coordinator and workers before backing up the entire private workspace. Preserve
ledger, runs and assets together. Pulling source updates does not import or migrate
legacy kits. Avoid duplicate work between the legacy scheduled lane and the app.

## Limits

No cloud media service, live store publishing, ad changes, purchasing, refunds, automatic
messages, distributed queue, multi-tenant SaaS or always-on hosted scheduler. Engineering
checks are not validation on a real store/supplier, safety certification or revenue guarantees.
