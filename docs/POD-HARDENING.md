# Runtime and upgrade hardening

**Historical scope note (2026-09-22):** the dated bundle observations below describe an earlier development environment. References to a fork/upstream are historical, not this repository's identity or installation path. This repository is canonical. Use the source checkout and consult the [repair verification](../plans/260922-commercial-readiness-fixes/plan.md) for current local evidence and acceptance limits. Do not read the table below as proof all concurrency or recovery paths are safe.

## Scope and verification boundary

Reviewed upstream: edffe8f4afea467818988ce3ce9332e6d832e5ed (19 September 2026).
Patch prepared: 21 September 2026. This is a source update bundle, not proof that a
GitHub fork, live store connection or deployment already exists.

The chat environment could read GitHub but could not fork/push or clone a full
repository. The bundled tests run the actual new modules and a synthetic 60-routine
application fixture. The original full-repository selftests are NOT claimed as run
in chat. publish.mjs runs them on the full clone before any commit/push.

## Changes and invariants

| Area | Before | In this patch |
|---|---|---|
| Upgrade baseline | Local custom hash could become the new baseline | Keep the old trusted upstream baseline for conflicts |
| Legacy receipt | May already encode the faulty baseline | Conservative .new staging; do not infer pristine files |
| Same version | Early return skipped same-version repairs | Compare files even when version text matches |
| Unknown files | Could be treated as kit files | Preserve/skip unknown classification |
| Edited .new | Could be overwritten | Preserve and stage a version/hash-qualified sidecar |
| Path safety | No explicit symlink boundary | Reject symlink and unsafe manifest paths |
| Run preflight | Corrupt state treated as no period | Fail closed; preserve the file for review |
| Duplicate run | Read-then-write race | External atomic mkdir lock BEFORE starting the model |
| Killed worker | Completion could be unclear | Separate started/completed/partial/uncertain journal |
| Timeout | Primarily an instruction to the model | Outer process timeout and process-tree termination |
| Thin ok log | A success-shaped fragment can mislead | Require a complete terminal record and successful process exit |
| ISO week | Some docs put Sunday with next Monday | Correct rationale; Sunday ends the old ISO week |
| Downloader | Missing version tag fell back to main | Versioned tag only; fail closed rather than change code silently |

No original routine id, base schedule value or ledger status is renamed. The
hardened supervisor keeps its extra lifecycle states in state/runtime, not in the
upstream closed runlog status set. CoS gains read-only journal observation authority.

## Correct entrypoint

After the initial interactive intake, schedule the process wrapper rather than a
native job that invokes the model directly:

```sh
node scripts/run-routine.mjs gtm-board-standup --root /absolute/kit -- claude -p "Read routines/gtm-board-standup/SKILL.md and follow it."
```

The generated run/*.cmd.example and run/*.sh.example use the wrapper. Fill the
real root and executable paths; operating-system schedulers may not inherit PATH.
The example CLI is not a claim of a live-tested Claude/Hermes/Codex installation.
Other harnesses can be supplied after -- only after verifying their actual headless
command. No tool permission is automatically broadened. Prompting tools can still
hang until the supervisor times out; configure restricted noninteractive permissions.

The supervisor locks the kit and conservatively serializes local-browser work
across kits. The default lock root is ~/.ecom-agents/locks. --resource can add
named shared resources; --lock-root can use a shared local directory. Do NOT use
cloud-sync directories or assume this is a distributed/multi-machine lock service.
Directly calling SKILL.md or guard.mjs bypasses these external locks.

## Recovery, deliberately not automatic

A paused routine remains paused. Corrupt state, an ownerless/stale lock or a started/
uncertain journal is never deleted or retried automatically. First stop the relevant
scheduler. Back up the complete kit. Check the process, journal, original state,
progress cursors, final artifacts and any external receipts. Confirm no worker is
still active. Then an operator can repair the specific corrupted file or remove a
confirmed dead lock, recording the evidence. Resume business work only through that
routine's own documented recovery path; do not erase last_period blindly.

The patch records incomplete work rather than promising automatic exactly-once
business execution. It does not implement a distributed transaction, durable
external-action outbox or provider-side idempotency. No external mutation is in
scope for the POD profile, so a missing receipt never triggers another order/send.

An ok line followed by a worker failure is still uncertain in the outer journal.
CoS must read that journal, not treat the earlier child line as proof of completion.
An unwrapped external process can still violate ownership: the supervisor cannot
control processes the operator starts outside it.

## Upgrades and rollback

Stop the scheduler and back up the kit first. Use the CLI from this source checkout,
not an unverified npm distribution. Report-only is the default; --apply
is explicit. Member files, POD.md, pod/** and SCHEDULE values are preserved. Edited
kit files stay in place and new versions are staged beside them. Review pending in
.installed.json, especially security fixes to locally edited scripts. Do not call
writeReceipt on a running/customized install to accept a merge.

Per-file writes use temp+rename; the full upgrade is not a cross-file transaction.
An I/O failure can leave a partial upgrade and requires review. The exclusive
.upgrade-lock prevents two cooperating upgrades, not a concurrently running agent;
pause scheduled work yourself. Restoring the pre-upgrade backup is the rollback.

## Security and limits

The receipt is a bookkeeping file, not a signature. Review declarations are not
authenticated identities. PNG checks cannot judge originality, legal rights, visual
spelling, aesthetic quality or real mockup fidelity. Numerical-copy checks cover
selected English/Vietnamese patterns, not every form of a factual claim.

Use real harness/OS permissions to protect source, review records, customer files
and tools. Markdown alone cannot enforce security. The read-only Shopify adapter
has no general query/mutation interface but cannot restrict unrelated harness tools.

Tested here: Linux, Node 22.16.0, synthetic data and mocked HTTP. Not tested here:
Windows process-tree behavior, Windows Task Scheduler, macOS launchd, native agent
schedulers, live Shopify scopes/schema response, carrier/provider APIs, real
printing or a production migration. Test on a development store before live use.
