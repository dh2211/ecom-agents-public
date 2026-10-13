# Upload limit and evidence repairs

**Status:** Done 2026-09-22. [PR #4](https://github.com/thienduy2211/ecom-agents/pull/4)
merged as `146ddfd00ae08498c5241e01dd01f2dc0a74294e`. Hosted Actions failed before
any step started, so the merge used the owner's request and local `npm test`.
Hosted CI is not claimed as passed.
**Authorized:** 2026-09-22, owner requested the 50 MiB limit, the reviewed repairs,
the two optimizations, documentation per FLOCK.md, then commit, push and merge.
**Evidence:** [verification report](../reports/upload-evidence-repairs-260922.md).

## Outcome and constraints

Raise the Commerce upload limit from 25 MiB to 50 MiB. Stop a later prepare from
rewriting approved history when ancestor evidence expires after a dependent task
has already run. Remove an incomplete hire when self-tests fail. Read only the new
run log suffix. Name the FFmpeg or ffprobe executable that lacks protocol_whitelist.

Preserve draft-only operation, private data, immutable attempt packets and the
rule that an incompatible media tool is not retried without network protection.
No registry publication, GitHub release, legal edits or live store action.
Existing installs do not update themselves. Commit subjects stay plain sentences.

## Current code and chosen approach

Node ESM, native node:test and the local Commerce server. The stale-ancestor
failure was reproduced with a mocked clock after research, supplier and economics
were approved. `prepare()` attributed the supplier failure to economics, held
that approved task, and left supplier succeeded, so every retry failed.

- Upload: accept 50 MiB decoded bytes. Reject one byte past that limit before
  storing the file. Allow the Base64 request body up to 80 MiB.
- Evidence: if the failing ancestor already has a later attempt, throw and save
  nothing. The owner keeps the project and creates a revised one. A stale task
  with no later attempt can still be held and retried.
- Hire: delete the copied tree when self-tests or the copy fail, and recreate an
  empty destination folder when the caller supplied one. No receipt is written.
- Run log: read from the recorded offset with a file descriptor. Still refuse a
  shrunk file, a partial last line, or a malformed record.
- Media: resolve the first PATH executable, probe protocol_whitelist once per
  file identity, and include that path in the blocker. Cache only that probe.
  The Commerce ledger is still read and checksummed on every state request.

Rejected: caching or skipping the ledger checksum, silently choosing another
FFmpeg after a failed protection check, and automatically cloning a revised
project. The app does not invent the revised project.

## Steps and acceptance

- [x] 50 MiB upload passes, and 50 MiB plus one byte is rejected.
- [x] Expired supplier evidence after economics approval leaves supplier and
  economics succeeded and does not start listing.
- [x] A failed hire leaves no destination and no trusted receipt. The same folder
  can be hired after the kit tests pass.
- [x] Run log tail reads a suffix after a large prefix and still rejects shrinkage
  and an unterminated record. All eight kit copies match the runtime source.
- [x] An unrecognized protocol_whitelist option does not cause a second,
  unrestricted probe.
- [x] FLOCK owners updated: guide, architecture, Dropship creative note, creative
  skill, changelog, this plan, the journal and the verification report.
- [x] Record the merged pull request on this plan after merge.

## Validation and rollback

`npm test` on 2026-09-22 passed: kit self-tests, no-dashes, 161 POD checks with
two Windows symlink skips, 66 Dropship checks, and 60 Commerce checks. No browser
pass is claimed for the new 50 MiB label. No real supplier or store was used.

Rollback is reverting this source change. Installed kits stay on their current
receipt until the owner runs upgrade from this checkout.
