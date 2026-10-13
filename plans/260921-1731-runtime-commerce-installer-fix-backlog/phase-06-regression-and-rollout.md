---
title: "Phase 6: Regression and rollout"
status: done
---

# Phase 6: Regression and rollout

## Context Links

- package.json test scripts
- .github/workflows/no-dashes.yml
- .github/workflows/pod-checks.yml
- .github/workflows/dropship-checks.yml
- .github/workflows/commerce-checks.yml
- AGENTS.md and CONTRIBUTING.md

## Overview

This phase is the local release gate for the nine fixes. It does not introduce product behavior. It proves that every finding has a regression test, the shipped instructions remain consistent, and version and changelog rules are satisfied. GitHub Actions are outside this validation because the owner explicitly chose local tests while the billing gate is unavailable.

## Requirements

- Run all repository checks locally and record exact results in the fix handoff.
- Run targeted tests for every phase and the complete Node test chain where the environment supports it.
- Run the available local Windows media tools and Node version. Platform-only symlink tests may skip when the host denies symlink creation.
- Keep DCO sign-off, no em dash or en dash, no secrets, no live business data and no direct remote mutation.
- Bump affected kit versions and changelogs in the same behavior commit, and link them from the root changelog. Do not publish npm or create a GitHub release.
- Do not gate this local fix on GitHub Actions. The owner requested local validation while the current Actions billing blocker remains.

## Validation Matrix

| Area | Command or gate | Expected result |
|---|---|---|
| Skill and routine wiring | node .github/scripts/selftests.mjs | Pass, including all structural checks |
| Text policy | node .github/scripts/no-dashes.mjs | Pass |
| Installer roster | node installer/cli.mjs list | Eight kits listed |
| SEO/AEO wiring | node .github/scripts/aeo-check.mjs | Pass |
| Runtime and installer | node --test tests/pod/runtime.test.mjs tests/pod/upgrade.test.mjs | All targeted tests pass |
| Dropship and media | node scripts/dropship/test-all.mjs | All tests pass with supported media tools |
| Commerce | node --test tests/commerce/commerce.test.mjs tests/commerce/review-media.test.mjs | All tests pass |
| Repository suite | npm.cmd test | Pass locally; platform-only symlink tests may skip when Windows denies symlink creation |
| Source hygiene | git diff --check and staged secret scan | Pass with no credentials |

## Implementation Steps

1. Add or update each regression test before the corresponding fix is marked complete.
2. Run the targeted matrix and inspect failures rather than weakening assertions for local tool limitations.
3. Run the structural checker against all 60 routines and all eight runtime copies.
4. Update changelogs and versions only for the files whose shipped behavior changed.
5. Open one PR per safety boundary or a small stack with explicit dependency links. Record the nine backlog IDs in each PR.
6. Wait for green GitHub checks, then merge using the repository's protected flow and watch post-merge CI.

## Todo

- [x] Add the nine regression cases and make each one fail against the current code.
- [x] Run all targeted and complete local test commands.
- [x] Record the GitHub Actions billing blocker and follow the owner's instruction to skip it.
- [x] Review version and changelog diffs.
- [x] Prepare the fix handoff with evidence and no claim that the earlier PR fixed these findings.

## Success Criteria

- Every backlog item has a passing, reproducible regression test or structural check.
- All required local workflows conclude success on the fix tree.
- No fix widens outbound authority, removes owner review or silently alters member data.
- The backlog can be closed item by item with a commit SHA, test result and PR link.

## Risk Assessment

The runtime and installer changes touch every shipped kit or every install path. Use byte parity checks, disposable fixtures and staged PRs. Treat CI billing, missing media tools or Windows symlink restrictions as environment blockers, never as reasons to delete a test.

## Security Considerations

Review generated fixtures and staged diffs for API keys, tokens, passwords, private data and live URLs. Keep all examples synthetic and redact run logs before sharing them.

## Next Steps

The local validation matrix concludes successfully. GitHub Actions remain intentionally unrun per the owner's instruction.
