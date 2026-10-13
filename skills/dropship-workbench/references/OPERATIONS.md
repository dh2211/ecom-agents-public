# Dropship operations playbook

## Product research

Keep separate: observed fact, supplier assertion, assumption, and experiment result.
For each candidate capture product and variant ids, target buyer problem, buying occasion,
three possible hooks, competing offers, differentiation, likely return reasons, risk flags,
and the evidence that would make you reject it. Research only public or authorized sources.
Use ad-library observations to understand messaging, not to infer revenue or ROAS.
Do not sell a branded imitation or assume that a supplier owns the images it supplies.

## Supplier readiness

Evaluate one specific supplier-variant-destination lane at a time. Collect a current quote,
stock availability, origin, handling time, transit range, carrier/service, tracking latency,
packaging, samples, returns destination, replacement process and merchant-borne fees.
The sample, safety and returns reviews must each refer to the same variant, supplier and
destination market, not a similar item in the catalog. A new supplier or destination
requires new applicable reviews, not only a new quote.
The merchant still owns the customer promise and must review local product-safety rules.

The `supplier` helper checks the recorded data, not the supplier's actual business.
Stock, quote and lane evidence expire at max_source_age_hours. Sample/safety/returns
reviews need dated evidence and a reviewer; humans must recheck when the product,
packaging, market rules or supplier changes. An approval string is not a digital signature.

For a multi-supplier product, keep independent lane dossiers; never average delivery
estimates or select the cheapest quotation without its matching variant and destination.
Unknown stock is unknown, not in stock. Supplier substitution needs a new sample review.

## Economics

All monetary inputs are integers in one currency's minor units. Revenue is after discounts
and excludes collected tax. customer_paid_minor is the processor's actual charge basis,
which may include collected tax. Payment fee = rounded-up charge basis x rate + fixed fee.

Contribution before ads = merchandise revenue + shipping charged to buyer - supplier
product cost - supplier shipping - merchant-borne duties - other variable cost - payment
fees - expected refund loss - expected replacement loss.

Break-even CPA is the non-negative contribution before ads. Target CPA subtracts the
owner's desired contribution. Break-even ROAS uses the SAME revenue definition. Compare
an ad platform's differently defined revenue only after reconciling its basis. Do not mix
currencies, attribution windows, new-customer CAC and all-order CPA. Product/variant mix
and shipping destinations change the result. Exclude recoverable tax from cost; include
non-recoverable tax. When unsure, request an accounting review instead of guessing.

Expected losses are per-order planning assumptions, with date and source retained in the
dossier notes. Do not add realized refunds on top. For retrospective results, reconcile
actual refunds, chargebacks, replacements and supplier credits in a separate report.
This helper does not calculate accounting net profit or a tax liability.

## Listing package

Deliver one folder per product/variant/revision containing: evidence.json, supplier-check.json,
economics.json, listing-draft.md, variant-map.json, shipping-copy.md, faq.md and creative-brief.json.
List exact product contents; show size/material/color truthfully; distinguish accessories
shown for context from what ships in the box. Avoid unverified superlatives and certificates.
Price, inventory and shipping claims need fresh revalidation immediately before publication.
The supplied config/examples are incomplete on purpose: filling unknowns with zeros is wrong.

## Support and exceptions

Classify: supplier not accepted; accepted/not shipped; tracking created/no movement;
carrier delay; partial delivery; damaged/wrong variant; return; refund requested.
Record only opaque order/line ids in cross-team briefs. Keep raw personal data inside the
permitted support workspace. Verify carrier possession and delivered events independently
from Shopify fulfillment status. A refund draft is not an issued refund. Do not promise a
replacement or delivery date until the operator confirms the actual policy and evidence.

## Handoff and ownership

Use schema, artifact_id, store_id, business_model, market, product_id, variant_id, producer,
intended_consumer, revision, source_refs, source_observed_at, coverage, currency,
payload_path and payload_sha256. Set review_status to pending, never approved by the model.
A stable id derives from store, product, variant, purpose and revision. The owner records
approval separately against the final hash. No handoff authorizes an external action.

## Operational workflows

A. Discovery -> sample/supplier gate -> economics -> human product decision.
B. Approved product -> factual listing draft -> shipping/returns consistency -> human publish.
C. Supplier stock/price drift -> update risk evidence -> margin rerun -> operator change request.
D. Order exception -> carrier/supplier evidence -> response draft -> operator resolution.
E. Returns/reviews -> verified cause -> supplier fix request or new creative angle hypothesis.

## Sources

Shopify merchant responsibilities: https://help.shopify.com/en/manual/compliance/legal/dropshipping
FTC testimonial guidance: https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers
Reviewed 2026-09-21. These sources are starting points, not a legal clearance for a product or country.
