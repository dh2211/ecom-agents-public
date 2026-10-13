# Shopify theme and store-code maintenance

Read the project's own rules and verify that the repository actually owns the
Shopify theme/app being changed. A business operating on Shopify does not imply
that the local repository can edit checkout, tax or a third-party app.

Use the existing branch-and-review workflow. Limit each change to one card. Test
mobile product pages, variant selection, personalization limits, image assets,
size-chart links and add-to-cart paths using non-billable fixtures or approved
preview routes. Never place a live order or alter payment settings to run a test.

Mockups must not expose a private store URL in promotional screenshots. Verify
product/variant id mapping rather than assuming a display label is stable. Keep
secret values out of commits and generated examples.

Done: a local branch, tests, screenshots without private details and a rollback
note. This POD release holds remote push, theme upload, publication, merge,
deployment, live checkout changes and infrastructure writes for human review.

## Corrections

Member-owned. Preserve all corrections.
