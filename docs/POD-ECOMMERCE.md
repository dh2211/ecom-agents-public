# POD Ecommerce quick start

This page is for operators using standalone skills or private scheduled kits.
For the local app, start with [README](../README.md) and the
[POD workflow in the user guide](COMMERCE-GUIDE.vi.html#pod). No kit installation
is needed for the app. Passing a helper does not authorize listing, spend, or other outbound actions.

## What is included

Nine opt-in role profiles cover the scheduled routines. POD Workbench is an
additional on-demand skill for niche research, print QA, contribution and listing
preparation; it is not silently installed globally or scheduled. Deterministic
helpers and a fixed-query, read-only Shopify adapter support those instructions.

The first release is draft-only, including SEO/Social workflows that previously
had a configured publishing channel. No product upload, supplier order, ad spend,
refund, message send, theme upload or deployment is performed by the POD layer.

## Install one Agent, then opt into POD

From this repository checkout, not an unverified npm package:

```sh
node installer/cli.mjs hire support --to /absolute/local/csat-kit
```

Stop the scheduler and worker, then create an empty `PAUSED` file in the installed kit.
Keep it in place during installation and acceptance:

```sh
node installer/pod-profile.mjs --root /absolute/local/csat-kit --config /private/store.json
```

Use profiles/pod-ecommerce/examples/store.example.json as the config shape. Replace
fictional values and keep the file outside git and cloud sync. No secret field is
accepted. The installer refuses to overwrite an existing POD profile. It does not
register a schedule, create accounts, connect tools or run a first business task.

Read the kit's INSTALL-PROMPT.md for interactive intake. Verify files/shell, actual
clock/timezone and each source read. Keep business schedules paused until a supervised
local acceptance run succeeds with your approved data. Use
scripts/run-routine.mjs, not a direct model prompt. See POD-HARDENING.md for the boundary.

Before applying a profile, stop the scheduler and worker, back up the kit and keep it
paused with an empty `PAUSED` marker. The POD installer requires a private, non-synced
folder outside git and rejects linked paths. It rolls back ordinary write failures,
but a killed process or power loss still requires inspection before retry.
Never target `agents/` inside the checkout. See [installer tests](../tests/pod/profile-installer.test.mjs).

## Helpers

```sh
node scripts/pod/cli.mjs margin profiles/pod-ecommerce/examples/costs.example.json
node scripts/pod/cli.mjs print-qa /private/design.png /private/supplier-spec.json
node scripts/pod/cli.mjs listing-qa /private/listing.json /private/qa.json /private/store.json
node scripts/pod/cli.mjs copy-qa /private/copy.txt /private/approved-claims.json
```

The provided costs and 64x64 print spec are TEST EXAMPLES, not prices or production
specifications. Use the provider's template for the actual product and placement.
CLI exits: 0 for successful computation/check, 1 for a hold, 2 for invalid input.
Do not publish on exit 0: all gates remain review-only.

## Preparing the files for those commands

Work in a private folder, not in `examples/`. The files in this repository are
fictional fixtures, never approved product specifications or live prices.

| Input or result | Source of its shape and owner |
|---|---|
| Store configuration | [store.example.json](../profiles/pod-ecommerce/examples/store.example.json); owner supplies actual store identity and freshness policy, no credentials. |
| Costs | [costs.example.json](../profiles/pod-ecommerce/examples/costs.example.json); owner verifies each value against the dated quote, fee and policy source. |
| Supplier spec | [print-spec.example.json](../profiles/pod-ecommerce/examples/print-spec.example.json) shows shape only; actual supplier/placement template owns production dimensions. |
| PNG QA result | `print-qa` prints JSON to stdout. Save that complete output as a new private `qa.json`; do not manufacture a pass. |
| Listing and reviews | [listingReadiness](../scripts/pod/core.mjs) owns the input fields; [listing fixture](../tests/pod/pod.test.mjs) demonstrates structure only. A person must supply real review evidence. |
| Approved claims | `copy-qa` expects a JSON array of exact approved claim strings, each backed by the private source register. |

Run print QA on the final PNG before listing QA. Copy the measured hash and supplier
template reference into the listing, not from an older artwork. Save helper outputs
beside that revision for the reviewer. Listing readiness does not create the listing
file or publish anything. Every review must match the listing's `asset_sha256`,
`supplier_template_ref`, `store_id` and `sku`. Old reviews without these bindings hold;
ask a reviewer to review the actual revision, never copy approval onto a new design.

The PNG helper supports noninterlaced 8-bit RGB/RGBA PNG. Other encodings fail closed
for local conversion. Inspect the actual alpha channel; no generator brand name or
marketing statement establishes transparency support. Human rights, spelling,
contrast and mockup reviews remain mandatory and are declarations, not signatures.

## Read-only Shopify probe

The adapter uses Shopify GraphQL Admin API 2026-07 and only two fixed read queries.
Supply SHOPIFY_ADMIN_ACCESS_TOKEN through a trusted environment/secret manager,
never in command arguments or store.json. Use a token restricted to the minimum
read scopes for the intended resource. Do not reuse a high-privilege production token.

```sh
node scripts/pod/cli.mjs shopify-read products /private/store.json /private/NEW-products.json
node scripts/pod/cli.mjs shopify-read orders /private/store.json /private/NEW-orders.json
```

The output path must be new; it is not overwritten. The script prints counts only.
A maximum-page sample is labeled incomplete. Orders are limited to what the app can
read. Historical access is not assumed. Customer addresses, names, emails and phone
numbers are not requested. Product results are summaries, not full variant mappings.

The read route is OPTIONAL. Existing verified MCP read routes or explicit owner
exports can serve the same capability. A connector being installed does not prove
its permissions, runtime availability or data completeness. Credentials, pagination,
stale data and missing fields must be tested on the actual machine/store.

## Role map

| Agent | POD specialization |
|---|---|
| GTM | Sourced niche/occasion context, real partners and launch readiness |
| SEO/AEO | Verified product facts, buyer questions and local draft packages |
| Ads | Contribution-aware creative hypotheses and evidence-backed change sheets |
| Social | Niche voice, correct assets, local calendar and draft-only delivery |
| Sales | Creator/wholesale/bulk partnerships, not unsolicited retail blasting |
| CSAT | Policy-backed replies, order evidence and held refund/reprint decisions |
| Web Dev | Shopify theme/app code review with no live checkout/deployment writes |
| CoS | Runtime health, print/order holds, data gaps and deduplicated KPI evidence |
| POD Design | Niche design-skill generation plus artwork: request to resolved brief to verified transparent print master with a receipt for pod-workbench |

Start with one role, one store and one reviewer. Measure usable drafts, wrong-source
claims, duplicate artifacts and correction effort before adding more roles. Adding
all 62 scheduled jobs at once is not an acceptance test.

## Design agent and generated niche skills

`agents/pod-design-agent/` is the artwork kit. It consumes request files, and for a
niche with no design skill it authors schema 3.2 master data per the vendored
builder's own guide, runs `skills/pod-design-skill-builder/` to emit a skill, verifies
the package, commits it as `skills/pod-design-<slug>/`, then resolves the brief,
renders on the configured image runtime, runs strict alpha QA and `print-qa`, and
writes a receipt `pod-workbench` continues from. The two skills inside the builder
bundle (teacher, pet-memorial) are references only and are not installed defaults.

Install it like any other kit, from this checkout:

```sh
node installer/cli.mjs hire pod-design-agent --to /absolute/local/pod-design-agent
```

Then open a session in that folder and say "install the POD Design Agent from this
folder". The intake binds the repository checkout that receives generated skills
(the one question it asks), vendors and verifies the builder copy, probes the image
runtime, and registers the two routines. To request a design, drop a request file
into `requests/inbox/`; `examples/request.example.json` in the kit shows the shape.
The daily `design-request` sweep picks it up and the receipt lands under
`out/<request-id>/`. With no image runtime configured the sweep still resolves the
brief and returns a held prompt package instead of fabricated artwork.

`skills/pod-design-skill-builder/` is a vendored tree whose local patches are recorded
in `provenance.json` under `known_drift`; its provenance, source-tree hash, and the
upstream hash it drifted from all live in that file. Generated skill trees carry a
`generator_id` manifest marker, which is also what `.github/scripts/no-dashes.mjs`
uses to exempt machine-emitted folders from the authored-copy dash scan. The vendored
builder itself is not exempt: it is kept free of em and en dashes so the same rule
holds for the text it emits into generated skills.

## Tests

```sh
node scripts/pod/test-all.mjs
```

Run `npm test` from the repository root for the local regression suite. A green suite
does not mean a publishing bridge is safe to run against a live store.
