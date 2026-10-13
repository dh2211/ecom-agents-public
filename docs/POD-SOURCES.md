# Sources and provenance

Prepared 2026-09-21. New controls and POD policies are this repository's
own design choices.

- GitHub CLI fork semantics: https://cli.github.com/manual/gh_repo_fork
- Shopify orders read query: https://shopify.dev/docs/api/admin-graphql/2026-07/queries/orders
- Shopify product status: https://shopify-dev.shopifycloud.com/docs/api/admin-graphql/2026-01/enums/ProductStatus

Shopify and GitHub are live services. The adapter and publishing bridge have mocked/
fixture tests, not a live integration certification. The chosen API version is
explicitly pinned; a future version change requires a new schema/probe review.
