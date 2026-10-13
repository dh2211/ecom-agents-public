---
title: "Phase 5: Installer safety"
status: done
---

# Phase 5: Installer safety

## Context Links

- installer/upgrade.mjs:66-72,104-158
- installer/cli.mjs:132-142,154-200,249-255
- tests/pod/upgrade.test.mjs
- scripts/pod/test-all.mjs

## Overview

Priority is P2. The installer must not replace a newer installed kit with an older bundled copy, and hire must not report success or create a trusted receipt when mandatory selftests fail.

## Requirements

- Parse and compare the validated semantic versions already present in agent.json and VERSION without a new dependency.
- Reject a lower fresh version before creating .upgrade-lock, staging files or changing the receipt. Equal versions keep the existing repair behavior.
- Keep legacy slug and receipt compatibility while applying the downgrade guard to both current and legacy identities.
- Run mandatory selftests before creating the trusted install receipt, or otherwise prove that a failed hire cannot be treated as a trusted baseline.
- Return nonzero from hire and its dispatcher when any mandatory selftest fails. Preserve the failed copy for inspection only if it has no trusted receipt and the output explains remediation.

## Architecture

Add a small strict semver comparator for the three numeric components and prerelease handling already allowed by the manifest grammar. The upgrade function should compare installed and fresh versions before the apply lock. The hire flow should copy, selftest, then write the receipt only on success; the CLI dispatcher must propagate the failure code instead of unconditionally exiting zero.

## Related Code Files

Modify:

- installer/upgrade.mjs
- installer/cli.mjs
- tests/pod/upgrade.test.mjs
- tests/pod/pod.test.mjs if the hire fixture belongs there

## Implementation Steps

1. Add downgrade, equal-version and prerelease comparison fixtures.
2. Assert a rejected downgrade leaves files, lock, receipt and pending state unchanged.
3. Build a disposable kit whose three mandatory scripts fail, invoke hire, and assert a nonzero exit and no trusted receipt.
4. Assert a healthy hire still writes the receipt and prints the prompt as before.
5. Run the full installer and POD test harness on Windows and Linux.

## Todo

- [x] Leave a failed hire copy available for inspection without writing a trusted receipt.
- [x] Add strict version comparison tests, including legacy receipt identity.
- [x] Add failure exit propagation coverage for hire and the dispatcher path.
- [x] Confirm no owner files or schedules are overwritten by the new ordering.

## Success Criteria

- A fresh 1.0.0 kit cannot downgrade an installed 2.0.0 kit through normal upgrade --apply.
- A failed selftest makes hire exit nonzero and cannot create an upstream receipt.
- Same-version repair, member-file preservation, dry-run behavior, symlink refusal and legacy names remain green.

## Risk Assessment

Moving receipt creation after selftests changes what a partially copied failed install looks like. Document the state clearly and test rerunning hire into a nonempty directory. Never delete an existing member directory as cleanup.

## Security Considerations

Version comparison and receipt ordering are trust boundaries. Reject ambiguous or malformed versions, never treat a receipt as a signature and never use a downgrade flag as an implicit bypass.

## Next Steps

The installer test results and package version policy are recorded in phase 06.
