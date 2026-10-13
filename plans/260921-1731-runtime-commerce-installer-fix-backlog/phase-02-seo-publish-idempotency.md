---
title: "Phase 2: SEO publish idempotency"
status: done
---

# Phase 2: SEO publish idempotency

## Context Links

- agents/seo-agent/routines/seo-publish-run/SKILL.md:139-245,453-500
- agents/seo-agent/CONTRACT.md run ledger and release sections
- agents/seo-agent/examples/content/published.jsonl
- agents/seo-agent/scripts/runlog.mjs

## Overview

Priority is P1. The surface route currently tells the routine to leave the draft ready and append no published line when the control was pressed but the URL cannot be found. The next run sees no published ledger entry and may press the same control again. The fix is a durable attempt record and a reconciliation gate, not an automatic second press.

## Requirements

- Generate an opaque attempt identity before the repository push or surface control is pressed.
- Append a local pending attempt record before the control action and close it as confirmed, reconciled-not-published or uncertain with the URL, observed result and blocker.
- On uncertain or missing live URL, leave the draft ready for owner reconciliation but block every later publish attempt for the same property and slug.
- If a later read proves that the article is live, append exactly one published record and one consumed record using the original attempt identity. Do not claim publication when no route was observed.
- Preserve release, harness permission, profile and draft-only gates. A pending local record must not authorize a remote action.

## Architecture

Use an append-only local publish-attempts ledger, or an equivalent existing ledger extension if the implementation proves that schema migration is safer. The Step 2 candidate check reads unresolved attempts before the folded published ledger. The reconciliation branch may inspect the live URL or ask the member for a decision, but it must never replay the surface control solely because the previous run was ambiguous.

## Related Code Files

Modify:

- agents/seo-agent/routines/seo-publish-run/SKILL.md
- agents/seo-agent/CONTRACT.md
- agents/seo-agent/examples/README.md and the smallest synthetic ledger fixture needed for the new record shape
- .github/scripts/skill-check.mjs if a structural check is the appropriate regression harness

Create only if needed for deterministic fixture checks:

- tests/seo/publish-attempts.test.mjs

## Implementation Steps

1. Define the attempt record fields, allowed statuses and append order without copying a real URL, account or identifier into examples.
2. Insert the pending record immediately before the surface control and make the control step conditional on a clean attempt state.
3. Rewrite the 404 and no-route branches so they close the attempt as uncertain and leave a named reconciliation blocker.
4. Add the Step 2 unresolved-attempt check and the one-time confirmation path for a silently successful publish.
5. Add a structural or fixture test for first press, ambiguous result, next-run refusal and later confirmed ledger closure.

## Todo

- [x] Use a new append-only `state/publish-attempts.jsonl` ledger.
- [x] Specify opaque attempt identity, append-only folding and collision behavior.
- [x] Add the ambiguous surface route reconciliation guard as a deterministic structural check.
- [x] Preserve release and draft-only gates in the existing routine contract and structural checks.
- [x] Update the SEO kit changelog and version.

## Success Criteria

- An ambiguous surface publish creates durable local evidence before and after the control action.
- The next run does not press publish while that attempt is unresolved.
- A confirmed live page is recorded once, and a missing page is never described as published.
- The existing SEO structural and AEO checks pass with no real business data.

## Risk Assessment

The ledger is append-only and can accumulate unresolved attempts. That is preferable to a duplicate publish, but the brief must surface the oldest blocker and the exact reconciliation action. Do not silently expire an attempt by date.

## Security Considerations

Store only opaque local identifiers, route names, hashes and observed statuses. Never put credentials, cookies, customer data or full page content in the attempt ledger or examples.

## Next Steps

The record shape is now part of the kit contract and the fictional examples before the regression gate.
