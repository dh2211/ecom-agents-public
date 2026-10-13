---
title: Follow-up review repairs and verification
date: 2026-09-22
summary: Four reproduced fixes and conditional polling verified locally; Git delivery remains pending
---

# Follow-up review repairs and verification

## What happened

Reproduced and repaired four follow-up findings: large Base64 uploads could overflow
validation, final approval did not recheck transitive dependency evidence, staged
upgrade metadata allowed older kit code to replace a newer applied version, and
browser redraws discarded unsent result and review fields. Added failing regressions
before the fixes. Independent code review concluded Approve.

## Decisions and limits

Keep original attempt packets and dependency digest bindings authoritative. When an
ancestor changes after a dependent task ran, reject the pending result and create a
revised project while preserving the original. Unsent browser drafts stay only in
page memory and are lost on reload or tab close. Conditional state requests return
304 for unchanged state, but still read and verify the ledger and detect capabilities.
Do not claim persistence or an integrity-check cache.

A synthetic 30-project fixture with 170k report content returned an initial state
body of 5,233,016 bytes. Five unchanged conditional requests all returned 304 and
zero body bytes, with end-to-end measurements around 85 to 110 ms. Disk checksum
work remains. This is a local synthetic observation, not a production guarantee.

## Evidence and next steps

The follow-up repair plan owns current delivery status and acceptance evidence:
[plan](../260922-review-followup-fixes/plan.md). Full local verification passed
285 tests with zero failures and two Windows EPERM file-symlink skips. Kit selftests,
no-dashes, AEO, installer listing, diff checks and Chromium browser verification
passed. Real local media assembly passed with C:\ffmpeg\bin on the test process PATH.

Source version 1.0.4 and Commerce app version 1.0.2 are prepared; kit versions remain
unchanged. Git shipping is unfinished at this checkpoint. Prior main Actions could
not start because of the account billing or spending limit, not a code-test failure.
No new PR exists yet. Real-business pilots and other operating systems remain separate
acceptance work. Historical reviews remain unchanged. AgentWiki publish skipped.

> Historical work record. Use FLOCK.md to find the current document owner.

## Git delivery checkpoint

Pushed five reviewed commits ending at d0d3dc4 and opened
[PR #3](https://github.com/thienduy2211/ecom-agents/pull/3). GitHub reports no merge
conflicts, but all four workflows could not start because of account payment or
spending-limit availability. The merge gate remains pending an infrastructure fix
or explicit owner exception for local verification. No hosted test pass is claimed.

## Merge completed with owner exception

The owner explicitly requested ignoring CI and merging normally. PR #3 merged on
2026-09-22 at 15:40:27Z as `6abc6ce4a1c4b9524b769582e71208c510cfd65a`.
The local main branch was fast-forwarded to the remote merge commit. No workflow
or repository protection settings were changed. Hosted CI remains unverified;
the already recorded local verification is the accepted evidence for this merge.
