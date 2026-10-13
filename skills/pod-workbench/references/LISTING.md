# Local listing contract

Required fields: store_id, sku, title, status="DRAFT", currency, asset_sha256,
supplier_template_ref, costs, source_observed_at, rights_review, spelling_review,
contrast_review and mockup_review. Human review objects use status="approved",
reviewed_by, reviewed_at, evidence_ref, asset_sha256, supplier_template_ref, store_id
and sku. Every identity field must match the listing; obtain a fresh review when
the artwork, supplier template or product changes. Older reviews missing these
bindings remain held, not silently migrated into approvals. All are declarations,
not authenticated signatures or legal guarantees. The same asset hash/template
must be in QA.

Include a supplemental variant mapping, description, size chart, care notes,
shipping-policy reference and source list. The technical helper cannot confirm
these product facts: the reviewer must verify them from the actual supplier/store.
Product price, publish status and variant mapping are different concerns.

The bundled adapter only reads product summaries and visible order summaries.
It does not create variants, upload media, write metafields, publish products or
send data to a print provider. A full Shopify/pod-provider integration requires an
explicitly approved future adapter with exact scopes and live sandbox tests.

A local listing marked ready-for-human-review is still a draft and is never
reported as uploaded, active, available or selling.
