---
title: "Phase 1: Runtime supervisor reconciliation"
status: done
---

# Phase 1: Runtime supervisor reconciliation

## Context Links

- scripts/runtime/run-routine.mjs:26-50,93-137
- scripts/runtime/guard.mjs:118-123
- tests/pod/runtime.test.mjs:30-61
- The same supervisor is shipped in agents/*/scripts/run-routine.mjs for all eight kits.

## Overview

Priority is P1 for old uncertainty and P2 for lock observability. The supervisor currently checks only the current period journal after acquiring the lock. It also throws LOCK_BUSY before the runlog path is reached. The phase keeps atomic locking and fail-closed behavior while making both outcomes visible.

## Requirements

- Scan the routine runtime journal directory for every period before starting a new harness.
- Treat started and uncertain journals from any period as a manual reconciliation blocker. Keep completed and partial semantics unchanged unless a test proves they are unsafe.
- On a lock collision, append exactly one valid failed run record with a blocker naming the resource and LOCK_BUSY. Return a nonzero exit code and do not create a started journal or run the harness.
- Preserve dual-root locking, foreign-owner protection, no stale lock stealing and the existing current-period race recheck.
- Keep all eight kit copies byte-identical or add a deterministic parity check if the source is changed through a copy step.

## Architecture

Add a read-only journal reconciliation helper that validates filenames and JSON status before the lock is acquired. Wrap acquire in a narrow lock-busy handler that uses the existing sanctioned writeRecord path. A lock-busy record is an observed refusal, not a business run, so it must not reserve a period or create an incomplete journal. The helper must never delete, edit or auto-complete an old journal.

## Related Code Files

Modify:

- scripts/runtime/run-routine.mjs
- agents/ad-manager-agent/scripts/run-routine.mjs
- agents/chief-of-staff/scripts/run-routine.mjs
- agents/customer-satisfaction-agent/scripts/run-routine.mjs
- agents/gtm-engineer/scripts/run-routine.mjs
- agents/sales-agent/scripts/run-routine.mjs
- agents/seo-agent/scripts/run-routine.mjs
- agents/social-media-agent/scripts/run-routine.mjs
- agents/web-dev-agent/scripts/run-routine.mjs
- tests/pod/runtime.test.mjs

Create only if the implementation needs a focused fixture helper:

- tests/pod/fixtures/runtime-reconciliation.mjs

## Implementation Steps

1. Add a fixture with daily periods and two runtime journal files, one old uncertain and one current absent file.
2. Implement journal enumeration with symlink and malformed JSON refusal. Return an actionable blocker listing the period, not the journal contents.
3. Invoke reconciliation before the current-period journal check, and write a failed run record when it refuses work.
4. Catch only LOCK_BUSY around acquisition. Record the lock refusal through writeRecord, release any partial multi-root claim, and return an exit code that automation treats as failed.
5. Port the exact supervisor change to all eight shipped copies and assert parity in the test.

## Todo

- [x] Add the old-period uncertainty regression.
- [x] Add the malformed and symlink journal regressions.
- [x] Add the lock-busy runlog and no-harness regression.
- [x] Verify dual-root and foreign-token tests remain green.
- [x] Run the runtime suite on the local Windows Node version. The symlink case is skipped when the host denies symlink creation.

## Success Criteria

- A new period cannot run while any earlier period for the same routine is started or uncertain.
- A held lock leaves no partial lock, no started journal and one valid failed run record.
- The existing runtime selftest and node --test tests/pod/runtime.test.mjs pass.
- All eight kit copies have the same behavior and the repository structural checker remains green.

## Risk Assessment

Scanning old journals can expose installs with years of unresolved history. That is intentional, but the error must name the exact period and the manual reconciliation path. Do not broaden the scan to partial without a separate evidence review because the current contract treats partial work as a terminal record.

## Security Considerations

Read journal metadata only. Never include report bodies, credentials or raw external receipts in a runlog blocker. Do not weaken lock ownership or allow stale lock stealing.

## Next Steps

This phase is implemented and its eight shipped runtime copies are versioned with the kit changelogs.
