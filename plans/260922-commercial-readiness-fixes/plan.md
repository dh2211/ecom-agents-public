# Repair precommercial findings

**Status:** Done 2026-09-22
**Scope approved:** 2026-09-22, owner requested fixes to the precommercial review.
**Evidence:** [review and acceptance criteria](../reports/commercial-readiness-260922.md).

## Outcome and boundaries

Close COMM-01 through COMM-09 with reproducible local evidence. Preserve draft-only
behavior, member data, immutable attempts and fail-closed recovery. No live business
actions, npm publish, GitHub release, visibility change or GitHub Actions work.
Keep the prior documentation edits. Source-checkout delivery remains the verified path.

## Diagnosis and selected repairs

Dependency-free Node ESM, native node:test and plain instruction kits. Recent
commits da29445, 7d032cc, 9ed7823 and 548b996 introduced or exposed the reviewed
runtime, recovery, media and version issues. Exact symptoms and reproduction
sequences are owned by the linked review; new regression tests must fail before fixes.

- Runtime: refusal shares routine/period terminal stream with the real owner.
  Separate attribution/evidence without weakening validation of owner failure.
- Commerce: summary hold state hides ready work; dispatch checks artifacts but not
  parent approval state. Use one eligible-job policy across API/UI, revalidate lineage.
- SEO: recovery prose disagrees about consumed status, attempt identity and corrupt
  evidence. Make recovery fail closed and exercise crash boundaries in fixtures.
- POD/media: review identity is unchecked; legacy media fallback drops protocol
  protection. Bind reviews to revision/template and reject incompatible decoders.
- Installer: version/manifest are applied independently; POD profile lacks preflight
  and rollback. Preserve metadata pairing and private paused install boundaries.
- Distribution: source install is authoritative for this private package; remove
  claims that an unrelated npm command delivers these changes.

Rejected: suppressing all failed logs, treating hold as approved, accepting old asset
reviews, dropping network protections for compatibility, and rebaselining local edits.
These would hide symptoms instead of repairing the reviewed invariants (2026-09-22).

## Rounds

- [x] R1 Runtime and SEO, COMM-01/04, independent source and instruction work.
- [x] R2 Commerce state and UI recovery, COMM-02/03, independent of R1.
- [x] R3 Evidence and media, COMM-05/06, independent of R1/R2.
- [x] R4 Upgrade and POD profile safety, COMM-07/08, independent of R1/R2/R3.
- [x] R5 Distribution, versions and docs, COMM-09, after implementation contracts settle.
- [x] R6 Independent review and full local regression, after R1 through R5.

## Verification

Run new negative repros before edits, focused suites after each repair, then npm test,
aeo-check, installer list, no-dashes, diff check and Flock Core check. Record skips and
tool incompatibility honestly. Browser recovery gets an actual local UI check if the
existing browser test surface can run. No local test certifies real supplier/print/AI
provider acceptance or general commercial readiness.

## Worklog

### 2026-09-22: Started

Preserved prior dirty docs and Flock map. Split independent implementation ownership
among runtime/SEO, Commerce, installer and main-agent evidence/media work. Product
version/changelog/distribution integration remains with the main agent.

### 2026-09-22: Repairs verified locally

All nine findings are repaired within the reviewed scope. Two interrupted workers
left partial changes; the main agent inspected and integrated them. Final independent
review found two additional SEO recovery contradictions, both fixed before the final
suite. The explicit-provenance regression failed before its repair and passed after.

| Finding | Verification owner |
|---|---|
| COMM-01 | `tests/pod/runtime.test.mjs`: concurrent refusal does not contaminate owner completion; fleet instructions read separate refusal evidence |
| COMM-02/03 | `tests/commerce/commerce.test.mjs`: dispatch eligibility, held/transitive dependencies, current approval digest and full HTTP recovery |
| COMM-04 | `tests/pod/seo-publish.test.mjs`: crash boundaries, member reconciliation, malformed/conflicting history, explicit provenance; instructions preserve confirmed outcomes |
| COMM-05 | `tests/pod/pod.test.mjs`: missing/mismatched review asset, template, store and SKU all hold |
| COMM-06 | `tests/dropship/media-boundary.test.mjs`: no unrestricted fallback; real local playlist cannot fetch loopback segments |
| COMM-07 | `tests/pod/upgrade.test.mjs`: both metadata files staged together, custom fields and baseline preserved |
| COMM-08 | `tests/pod/profile-installer.test.mjs`: paused/private-path requirements and ordinary write-failure rollback |
| COMM-09 | `tests/pod/distribution.test.mjs`: source CLI help and kit update instructions; root/kit metadata aligned to 1.0.3 |

Final local evidence on Windows, Node v24.18.0:

- PASS `npm.cmd test`: POD 148 passed, 2 skipped; Dropship 66 passed; Commerce 51 passed. Total 265 passed, 2 skipped, zero failures. Script selftests, 60-routine structural check and no-dashes also passed.
- SKIP: two symlink fixtures require Windows permission unavailable to this process (`EPERM`). These are coverage gaps, not passing security tests.
- PASS `node .github/scripts/commerce-browser.mjs`: actual Chromium dispatch, approval, oversized-handoff recovery, completion, observer, mobile layout and guide. Main visually inspected desktop/mobile captures in the temporary commerce-screenshots folder.
- PASS `node .github/scripts/aeo-check.mjs`, `node installer/cli.mjs list` and `git diff --check`.
- PASS external Flock 0.3 Core checker: no errors, warnings or unmet MUST items. Flow/Handoff not claimed.
- Media suite selected installed `C:\ffmpeg\bin` on the process PATH. The default legacy ImageMagick FFmpeg is intentionally rejected; no global PATH or decoder protection was changed.
- Browser suite used the existing cached Playwright package through `COMMERCE_PLAYWRIGHT_PACKAGE`; no customer session or paid AI provider was used.

### Remaining acceptance and compatibility boundaries

This closes the engineering findings, not commercial acceptance. Real supplier print
samples, rights checks, approved POD and Dropship pilot dossiers, provider integration,
other OS/harness environments and operational backup recovery still need owner acceptance.
No live publish, spend, customer message, GitHub Actions, commit, push or npm publish ran.

Older POD review records without identity bindings now hold. Unsupported media decoders
now hold. A parent cannot be retried after descendants actually executed: preserve that
project and start a revised project. Profile rollback handles ordinary exceptions, not
power-loss atomicity. Multi-file upgrades still require backups. SEO publish history must
be initialized by the member for a verified unused install, never inferred empty on upgrade.
Source version 1.0.3 remains private and unpublished; use the reviewed checkout.

### 2026-09-22: Documentation and Git delivery preparation

The owner subsequently requested a Flock documentation update, commit and GitHub push.
Added journal navigation and removed stale open-defect claims from the architecture,
runtime reference and media guide. Historical review conclusions remain dated evidence.
Re-ran the full local suite: 265 passed, 2 Windows symlink skips, zero failures.
AEO, installer list, no-dashes, diff check and Flock Core checks passed; 113 relative
Markdown links across 69 changed documents resolved. The change scan found no secrets.
Git delivery is authorized separately from npm publication or commercial acceptance;
commit and push results are verified from Git, not inferred from this preparation note.
