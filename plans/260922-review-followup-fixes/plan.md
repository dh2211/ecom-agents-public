# Repair follow-up review findings

**Status:** Done 2026-09-22. PR #3 merged with an explicit owner exception for unavailable hosted CI.
**Authorized:** 2026-09-22, owner requested fixes, commit, push and merge.
**Evidence:** [follow-up review](../reports/codebase-review-260922-followup.md).

## Outcome and constraints

Close REV-01 through REV-04 and reduce unchanged Commerce state polling traffic.
Preserve draft-only operation, current API payloads, private data, immutable attempts,
conservative retry rules and existing installed kits. No registry publication, release,
legal document edits or real business actions. Commit subjects are plain sentences.

## Current code and reviewed approach

Node ESM, native node:test and plain browser JavaScript. The review already reproduced
the root causes on current main, 7c8f874. Existing tests cover the surrounding API,
dependency DAG, upgrade metadata pairing and browser recovery behavior.

- REV-01: replace recursive Base64 regex with bounded alphabet/padding validation;
  cover canonical encoding, full supported size and HTTP upload.
- REV-02: validate transitive dependency approvals and original packet digests again
  when approving a result; rejection stays available for stale evidence.
- REV-03: validate the trusted receipt version before acquiring the upgrade lock and
  reject a source older than the highest installed/applied version.
- REV-04: retain form drafts by project/job/attempt across redraw, API failures and
  project switches; clear only the submitted draft after success.
- Polling: retain the full response for existing clients, add conditional requests
  for unchanged state and avoid repeated snapshot construction, serialization and
  transfer. Every request still reads and verifies the ledger and detects current
  capabilities; no ledger or capability cache is introduced.

Rejected: relaxing upload byte limits, bypassing dependency freshness, trusting legacy
receipt metadata blindly, hiding API failures, or changing every kit for app-only fixes.
Runlog optimization and FFmpeg preflight are lower priority follow-up work.

## Steps and acceptance

- [x] Add failing regressions, implement REV-01/02 backend fixes.
- [x] Add failing regressions, implement REV-03 installer fix.
- [x] Add failing browser regressions, implement REV-04 draft preservation.
- [x] Verify conditional state polling saves transfer without missing revisions.
- [x] Independent review and full local tests, no-dashes, AEO, installer list, browser.
- [x] Update changelog, version, affected docs and journal with actual evidence.
- [x] Commit and push the reviewed repairs, create the pull request and inspect checks.
- [x] Record the explicit owner CI exception, merge and verify target branch status.

Tests must show real uploads below 25 MiB pass, stale/tampered ancestors cannot be
approved, a staged metadata upgrade cannot downgrade code, and UI drafts survive
failure/poll/project switching. Record unavailable symlink/OS/provider checks honestly.
Source updates do not automatically update existing installs or registry packages.

## Local verification, 2026-09-22

- PASS `npm test` with `C:\ffmpeg\bin` prepended only to the test process PATH:
  POD 160 passed and 2 skipped, Dropship 66 passed, Commerce 59 passed.
  Total: 285 passed, zero failures, 2 skipped out of 287 tests.
- PASS kit script selftests, the 60-routine structural check and `no-dashes`, all
  included in `npm test`. Real local video assembly passed with FFmpeg available.
- SKIP two Windows file-symlink fixtures due to `EPERM`: runtime journal symlink
  refusal and upgrade target symlink refusal. These remain coverage gaps.
- PASS `node .github/scripts/aeo-check.mjs`, `node installer/cli.mjs list`
  (eight kits) and `git diff --check`.
- PASS Chromium browser verification, including draft recovery and existing app
  workflows. Independent code reviewer verdict: Approve.
- PASS synthetic polling measurement: a 30-project fixture with 170k report content
  returned an initial body of 5,233,016 bytes. Five unchanged conditional requests
  all returned 304 with zero body bytes, measured around 85 to 110 ms end to end.
  Ledger disk reads and checksum verification remain; this is not a production
  performance guarantee.
- REV-03 red/green evidence: the installer suite first had nine expected failures;
  after the fix it passed 31 tests with one Windows symlink skip. Tests cover the
  staged-metadata downgrade, malformed trusted receipt versions, rejection before
  lock acquisition, legacy conservatism and same-version reconciliation.

Approval now verifies transitive dependency evidence and the original request's
dependency digest bindings. If stale ancestors already have executed descendants,
reject the pending result, preserve the old project and create a revised project.
No automatic ancestor refresh or rewriting of executed attempt history is claimed.
Form drafts live only in the current browser page; reload or tab close loses unsent
drafts. Conditional state polling saves snapshot response work and transfer while
retaining ledger verification and capability detection on every request.

## Delivery and remaining acceptance

Five commits were pushed to `codex/review-followup-fixes`, ending at `d0d3dc4`:
`94cf6ae` installer, `0d1d573` uploads, `80aa6fb` approval evidence,
`5de7de0` browser synchronization/polling and `d0d3dc4` documentation/version.
[PR #3](https://github.com/thienduy2211/ecom-agents/pull/3) targets main and has no
merge conflicts. Merge has not run at this checkpoint.

All four PR workflows failed before their jobs could start. Check annotations say
recent account payments failed or the spending limit needs increasing. This is a
CI infrastructure blocker, not a failing executed test. Examples are
[Commerce](https://github.com/thienduy2211/ecom-agents/actions/runs/35748251049) and
[POD](https://github.com/thienduy2211/ecom-agents/actions/runs/35748251155).
The owner has been asked whether to permit merging this reviewed change on local
verification while hosted CI is unavailable. No exception has been assumed.

**SUPERSEDED 2026-09-22, merge authorization:** the owner explicitly instructed
the agent to ignore CI and merge normally. PR #3 was merged using the normal merge
operation, without changing workflow configuration or repository protection.
Merge commit: `6abc6ce4a1c4b9524b769582e71208c510cfd65a`, confirmed by GitHub at
2026-09-22T15:40:27Z. Local main was fast-forwarded to the merged origin/main.
Hosted CI is unverified and is not claimed as passing; the owner accepted the
documented local test and independent review evidence for this merge.

Real POD and Dropship business pilots, supplier samples, rights verification,
provider integration and other operating systems remain separate owner acceptance.
Historical review reports are unchanged; this plan records the subsequent repairs.
Source version 1.0.4 and Commerce app version 1.0.2 are prepared, with kit versions
unchanged. The [session journal](../journals/2026-09-22-follow-up-review-repairs-and-verification.md)
records the work history without replacing this plan's delivery status.
