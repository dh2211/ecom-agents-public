---
title: "Fix reviewed runtime, SEO, Commerce and installer findings"
description: "Backlog and phased fix plan for nine evidence-backed P1 and P2 findings from the whole repository review."
status: complete
priority: P1
effort: 6d
issue: null
branch: fix/reviewed-findings
tags: [bugfix, security, backend, tech-debt, critical]
blockedBy: []
blocks: []
created: 2026-09-22
---

# Fix reviewed runtime, SEO, Commerce and installer findings

## Overview

This plan turns the nine unresolved findings from the whole repository review into an ordered backlog. They are preexisting defects and are not fixed by PR #1. The work must preserve draft-only behavior, owner review, member data and the rule that an uncertain external action is never retried automatically.

The implementation is split by safety boundary. Each phase can ship as its own small PR from main; phase 06 is the shared release gate. No live account, customer data, credential, remote publish or spend is needed for the test fixtures.

## Backlog

| ID | Priority | Finding | Evidence | Planned outcome | Phase |
|---|---|---|---|---|---|
| RT-01 | P1 | An uncertain runtime journal from an older period does not stop a new period from starting. | scripts/runtime/run-routine.mjs:102-114 and the eight kit copies | Reconcile every prior started or uncertain journal before a new run. | 01 |
| SEO-01 | P1 | A surface publish can remain ready with no durable attempt marker, so a later run can press publish again. | agents/seo-agent/routines/seo-publish-run/SKILL.md:473-480 | Add an idempotent publish-attempt ledger and require reconciliation before another control press. | 02 |
| RT-02 | P2 | A busy lock exits before writing a runlog or journal record. | scripts/runtime/run-routine.mjs:101 | Record a validated failed run with a lock blocker and never start the harness. | 01 |
| COM-01 | P2 | A stale supplier dependency can throw during prepare after the dependency already succeeded, leaving no retry path. | app/commerce/engine.mjs:67-78,186-208 | Make stale dependencies explicitly retryable while preserving their artifact and event history. | 04 |
| COM-02 | P2 | Two individually valid dependency reports can exceed the combined packet limit and strand the downstream task. | app/commerce/engine.mjs:24-26,87-105,163-183 | Enforce the aggregate handoff budget before a result becomes an unrecoverable success, with actionable hold and retry state. | 04 |
| DS-01 | P2 | Supplier readiness reviews are checked only against the variant, not supplier or destination market. | skills/dropship-workbench/scripts/ops.mjs:92-96 | Bind sample, safety and returns reviews to variant, supplier and market. | 03 |
| CR-01 | P2 | Image audit trusts the filename extension and can accept a video renamed as PNG or JPEG. | skills/commerce-creative-studio/scripts/creative.mjs:94-107 | Validate measured container and codec, duration and audio against the declared image kind. | 03 |
| INS-01 | P2 | An older bundled kit can overwrite a newer installed kit during upgrade. | installer/upgrade.mjs:104-120 | Reject lower fresh versions before locking or writing, while retaining same-version repair behavior. | 05 |
| INS-02 | P2 | hire prints failed selftests but exits zero and writes a trusted receipt. | installer/cli.mjs:132-142,176-181,249-255 | Return nonzero and never create a trusted receipt for a kit whose mandatory selftests fail. | 05 |

## Goals

| # | Goal | Priority |
|---|---|---|
| 1 | Never start new business work while an older runtime execution is uncertain. | P1 |
| 2 | Never repeat an ambiguous SEO publish without a durable reconciliation decision. | P1 |
| 3 | Keep stale evidence, oversized handoffs, mismatched reviews, invalid media and unsafe upgrades visibly blocked and retryable. | P2 |
| 4 | Make every new failure mode mechanically testable on Windows and POSIX runners. | P2 |

## Dependencies

Phase 03 updates helpers used by the Commerce supplier and media gates. Phase 04 consumes those helpers and adds orchestration checks. Phase 06 depends on all earlier phases and on the existing CI billing issue being resolved before merge.

## Phases

| # | Phase | Priority | Status | Dependency |
|---|---|---|---|---|
| 1 | [Runtime supervisor reconciliation](./phase-01-start.md) | P1 and P2 | Done | None |
| 2 | [SEO publish idempotency](./phase-02-seo-publish-idempotency.md) | P1 | Done | None |
| 3 | [Shared evidence gates](./phase-03-shared-evidence-gates.md) | P2 | Done | None |
| 4 | [Commerce dependency handoffs](./phase-04-commerce-handoffs.md) | P2 | Done | Phase 03 for shared gate regressions |
| 5 | [Installer safety](./phase-05-installer-safety.md) | P2 | Done | None |
| 6 | [Regression and rollout](./phase-06-regression-and-rollout.md) | P1 gate | Done | Phases 01 to 05 |

## Success Criteria

- [x] All nine backlog IDs have a regression test or a deterministic structural check.
- [x] An old uncertain runtime journal blocks the next period and creates a visible record.
- [x] A lock collision creates one validated blocker record and runs no harness.
- [x] An ambiguous surface publish cannot be pressed again until its attempt is reconciled.
- [x] Stale dependencies and oversized packets remain actionable instead of leaving a project permanently stuck.
- [x] Supplier reviews and creative image exports are bound to measured identity and media facts.
- [x] Downgrades and failed hires fail closed without changing trusted install state.
- [x] Required local checks pass. GitHub Actions are intentionally skipped per the owner's instruction because the repository billing gate is unavailable.

## Implementation Contract

- Do not auto-retry an external action. A member must reconcile uncertain work.
- Do not truncate evidence silently. A size limit must produce a precise hold and a path to revise the source result.
- Keep member files, schedules, release rows, credentials and remote state out of tests.
- Update the relevant VERSION and CHANGELOG.md only when a shipped kit behavior changes. The root package is not published by this plan.
- Use one fix concern per commit and include DCO sign-off.

## Validation Status

The code locations and reproduction results were verified from the review report and source inspection. The implementation was validated locally with the repository selftests, no-dashes check, installer roster, runtime and installer tests, Dropship tests, Commerce tests, and targeted SEO structural checks. GitHub Actions were skipped at the owner's explicit request because the billing gate is unavailable.
