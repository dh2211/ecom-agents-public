---
title: Upload limit and evidence repairs
date: 2026-09-22
summary: Raised the upload limit, stopped approved-history rewrites, and verified the hire, log and FFmpeg repairs locally
---

# Upload limit and evidence repairs

## What happened

The owner asked to raise the 25 MiB upload limit to 50 MiB, fix the reviewed
findings, and apply the two optimizations. A mocked clock showed that preparing
the Dropship listing one day after economics approval held the approved economics
task while the stale supplier task stayed succeeded. Every retry then failed.
The repair refuses that prepare without writing. A failed hire now removes the
incomplete copy. The supervisor reads the new run log suffix. Media checks name
the selected executable and do not retry without protocol_whitelist.

## Decisions and limits

The owner creates a revised project. The app does not clone one. A stale task
with no later attempt can still be held and retried. The ledger checksum stays
on every state request. The FFmpeg probe cache is only the support result for
one resolved file, invalidated when that file's size or modification time changes.
Unsent browser drafts and real-business acceptance are unchanged.

## Evidence and next steps

The repair plan owns delivery status:
[plan](../260922-upload-and-evidence-repairs/plan.md). Local `npm test` passed,
with two Windows symlink skips and no browser pass for the new label. Historical
reviews stay as evidence of the old 25 MiB and FFmpeg findings. They are not
rewritten. Git delivery was unfinished at the start of this journal.

## Git delivery

[PR #4](https://github.com/thienduy2211/ecom-agents/pull/4) merged on 2026-09-22
at 16:38:03Z as `146ddfd00ae08498c5241e01dd01f2dc0a74294e`. Hosted workflow jobs
failed with no steps, matching the earlier account availability failure. The
owner had requested the merge. Local `npm test` remains the verification.
Hosted CI is not a pass.

> Historical work record. Use FLOCK.md to find the current document owner.
