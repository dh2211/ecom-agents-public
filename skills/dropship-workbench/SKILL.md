---
name: dropship-workbench
description: Research and prepare a dropshipping product for sale using supplier evidence, sample review, shipping lanes, unit economics, local listing drafts and support workflows. Use for dropship product selection, supplier comparison, fulfillment risk, margin checks, launch readiness or order-exception triage. Do not apply print-on-demand production assumptions to dropship products. Keep all external systems read-only and produce local drafts for human review.
---

# Dropship Workbench

## Input and output

Read the store config, target country, exact supplier/product/variant, source evidence,
customer-facing shipping/returns policy and costs. Use the examples in
`references/examples.json` as field definitions, not as business facts.

Deliver an evidence-backed product dossier, supplier risk sheet, economics report,
listing package, creative handoff and exception queue. Mark unknown values as unknown.
An attractive product is not ready to launch until supplier, sample and margin checks hold.

## Workflow

1. Read `references/OPERATIONS.md`. Select the product-research, supplier-readiness,
   listing, or support workflow. Confirm the store and market, not just the product name.
2. Read dated first-party records. Probe a connected read capability before relying on it.
   Record source system/id, observed_at, source_updated_at if present, coverage and currency.
   Competitor ads are inspiration, not proof of sales, claims, licensing or supplier quality.
3. Build at most three candidates per decision. Compare customer problem, differentiation,
   demonstrability, landed cost, returns risk and shipping feasibility. Do not invent demand.
4. Obtain a sample-review record for the exact variant. Verify packaging, instructions,
   dimensions, material, actual appearance and destination-specific safety requirements.
5. Run `node scripts/ops.mjs economics COSTS.json` from this skill directory.
   Use a single settlement currency. Include supplier shipping, merchant-borne duties,
   payment fees, expected refund/replacement losses and the proposed acquisition cost.
6. Run `node scripts/ops.mjs supplier PRODUCT.json STORE.json`.
   A hold means do more research or revise the plan; it is not permission to fill zeros.
7. Draft title, description, factual feature bullets, FAQ, variants, offer and shipping copy
   locally. Processing time and transit time are separate. Never promise a faster lane
   than the dated evidence supports. Apply a human legal/safety review before launch.
8. Hand the facts, licensed product assets, approved offer and restrictions to
   `commerce-creative-studio` if installed. Otherwise write the handoff and name the
   missing skill; do not silently install it or claim that media was created.
9. For support, reconcile order lines, supplier acceptance, tracking and carrier events.
   Draft a response and remedy for human action. A label is not carrier possession.
10. End with completed output paths, remaining blockers and the next owner's action.

## Boundaries

Never place supplier orders, publish/update products, fulfill orders, send messages,
change addresses, issue refunds, accept terms, enter credentials or change ad spend.
Never fabricate customer testimonials, certifications, delivery guarantees or scarcity.
Never upload raw customer data, tokens or private supplier agreements to GitHub.

Within an installed Agent, first follow its guard, contract and DROPSHIP.md.
Keep its original files and routines. Write supplemental outputs only under
`dropship/out/<routine-id>/<local-date>/`. A consumer reads another Agent's handoff
and acknowledges it in its own directory. Never write into that Agent's ledger.
The profile is not a permission sandbox; the operator must restrict actual tools.
