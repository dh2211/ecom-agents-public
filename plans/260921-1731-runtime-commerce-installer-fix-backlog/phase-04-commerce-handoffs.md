---
title: "Phase 4: Commerce dependency handoffs"
status: done
---

# Phase 4: Commerce dependency handoffs

## Context Links

- app/commerce/engine.mjs:24-27,67-109,129-191,202-209
- app/commerce/workflows.mjs
- tests/commerce/commerce.test.mjs
- tests/commerce/review-media.test.mjs

## Overview

Priority is P2. prepare rechecks dependency evidence, but a stale result that already reached succeeded has no owner retry path. The same method allows individually valid reports whose combined dependency packet exceeds the 200000 byte handoff limit. Both cases need explicit state transitions and no silent truncation.

## Requirements

- When a succeeded dependency fails a time-sensitive gate during downstream prepare, preserve its stored artifact and event history, mark it as an owner-actionable refresh state, and explain how to retry it. Do not auto-retry or discard the result.
- Keep downstream work unprepared until all dependency evidence is fresh and reviewed again.
- Measure the exact serialized dependency packet before dispatch. If it exceeds the limit, produce an actionable hold and ensure the upstream result is not an unrecoverable success that can never feed its dependent.
- Reject or hold oversized reports before they become succeeded when the workflow graph proves they cannot fit. Never silently truncate report text, sources or knowledge.
- Keep the 3-attempt limit, hash-bound review, event chain and draft-only authority unchanged.

## Architecture

Extract packet construction and dependency revalidation into testable helpers. Revalidation should emit an explicit event and a stable blocker containing the dependency id, gate and freshness reason. Packet budgeting should simulate the exact request.json for each ready dependent when a result is submitted, then recheck in prepare as defense in depth. A result that cannot fit is held with a retry or revised-project path before it is marked succeeded.

The workflow currently has a two-parent media task, so tests must cover two reports near the individual limit. The 200000 byte limit remains the single source of truth; do not raise it to hide the defect.

## Related Code Files

Modify:

- app/commerce/engine.mjs
- tests/commerce/commerce.test.mjs
- tests/commerce/review-media.test.mjs

Create only if packet construction is split into a focused module:

- app/commerce/packet.mjs

## Implementation Steps

1. Add a fixture that succeeds a supplier or media dependency, advances time beyond its freshness window, and then prepares the dependent task.
2. Define the owner-visible refresh transition and allow retry only after the owner has reconciled or refreshed the dependency evidence.
3. Extract packet assembly so the same serialized bytes are measured for submit-time projection and prepare-time dispatch.
4. Add two dependency reports large enough to exceed the combined limit. Assert the parent remains retryable or the child is explicitly held with a named corrective action, never silently stuck.
5. Run the existing end-to-end review, retry, audit and event-chain tests.

## Todo

- [x] Use the existing `hold` state for refresh without adding a second permanent job state.
- [x] Add freshness revalidation and event assertions through owner-actionable hold events.
- [x] Add aggregate packet size tests with two approved dependencies.
- [x] Measure UTF-8 serialized packet bytes before writing or dispatching the worker prompt.
- [x] Keep the Commerce UI and API error responses actionable through the stored blocker.

## Success Criteria

- A stale succeeded dependency never strands its project. The owner can see the cause and refresh or revise it.
- A packet over 200000 bytes is refused before any worker runs, with no result truncation or false success.
- Approved dependency artifacts remain hash-bound and auditable.
- Commerce tests remain green, including the media and review regression suites.

## Risk Assessment

Changing a succeeded dependency to a refreshable state can affect status ordering and API clients. Preserve the old result and event, expose the new blocker in runStatus, and add compatibility tests for existing stored state. Do not mutate user files outside the local Commerce workspace.

## Security Considerations

Packet limits protect local workers from oversized or adversarial inputs. Do not solve the issue by removing source validation, increasing limits without evidence or passing unbounded report text into a worker.

## Next Steps

The local Commerce suite exercises both the stale evidence path and the oversized handoff path.
