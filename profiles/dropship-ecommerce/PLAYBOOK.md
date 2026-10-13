# Dropship operating profile 1.0.0

## Scope

This is opt-in for a private installed Agent. Keep all 60 existing routine ids, original
schedules, core outputs and writer boundaries. The `pod-design-agent` kit
belongs to the POD profile and is not installable under this one. Do not apply Dropship and POD operating
profiles to the same installed kit; hire separate folders for each business model/store.
The creative studio is shared and can be used for either model without replacing a profile.

The profile is read-only external data + local drafts, even if old SEO/Social configuration
or RELEASES.md allowed automatic publication. Do not send, spend, publish, schedule posts,
update Shopify, fulfill, place supplier orders, change addresses, refund or deploy.
Restrict real tool permissions in the host; Markdown instructions are not a security boundary.
No copied skill gets installed globally. Never change PAUSED, RELEASES.md or owner Corrections.

## Run opening and output

After the normal cheap guard returns run, read DROPSHIP.md, dropship/config.json and this
file. Confirm clock/timezone, store, currency and target market. Read only the role below
that matches agent.json.slug. Recheck source freshness, coverage and pending human actions.
Missing capabilities or source data hold the artifact. Log partial when useful work was done,
or failed when it was not, using the original runlog vocabulary. Never log hold or blocked-media-tool.

Write supplemental work only in dropship/out/<routine-id>/<local-date>/. The producing
routine owns that directory. Keep base ledgers unchanged. Handoffs carry store/product/variant,
market, source references, coverage, revision, final payload hash and intended consumer.
Other Agents read approved handoffs and write acknowledgements only in their own folder.
Use the existing run-routine.mjs supervisor; this profile adds no second scheduler or lock.

## Role routing

| Agent | Use existing routines for | Supplemental outputs |
|---|---|---|
| gtm-engineer | Product/audience research and launch readiness | Candidate dossier, angle map, launch checklist; signals are not fabricated sales |
| ad-manager-agent | Account reads, creative production and measured review | UGC/banner test packs, target CPA by lane, fatigue hypotheses and change drafts |
| social-media-agent | Material capture, social adaptation and engagement drafts | Platform-specific hooks, captions and creator/demo cuts; publication stays held |
| seo-agent | Factual product copy, FAQ and index/readability review | Local listing/landing draft, shipping FAQ and consistency check; no live publish |
| sales-agent | Creator, affiliate, wholesale and supplier outreach preparation | Outreach drafts, creator requirements and rights checklist; no automatic sending |
| customer-satisfaction-agent | Order exception evidence and remedy drafts | Carrier/supplier timeline, truthful reply, returns cause; no refunds/orders |
| chief-of-staff | Fleet observation and business review | Margin/returns/stock risk summary and owner decision queue; no edits to other kits |
| web-dev-agent | Reviewable theme/site changes and measurements | Product-page QA, variant UX and tracking fixes on review branches; no deployment |

## Recommended workflows

1. GTM -> Dropship Workbench: problem evidence -> shortlist -> sample/supplier lane -> margins.
2. Workbench -> SEO: sourced listing and shipping promise -> local product-page package.
3. Ads -> Creative Studio: angle -> three hooks -> one pilot -> human QA -> controlled batch.
4. Sales -> real creator: sample and licensed brief -> authentic footage -> local UGC edit.
5. Ads -> AI-presenter: disclosed presenter + factual product demo; no fake customer experience.
6. Ads -> banners: approved photo -> three aspect-ratio layouts -> human raster/export review.
7. Owner launch -> Ads reads -> CoS: test results -> net contribution + supplier constraints -> next test.
8. CSAT -> GTM/Ads: verified returns/objections -> better sourcing/copy -> new revision, not invented proof.

## Capabilities and integration

Probe existing Shopify product/order reads; preserve pagination coverage. The fork's existing
read adapter is available from the source repo but this profile adds NO supplier or ad API.
Supplier dashboards, carriers, creators, image/video generators and editors must be configured
by the owner. No model subscription proves a media tool is available. No tool installs itself.
The local skills generate planning files and SVG layouts; FFmpeg/ffprobe optionally assemble
and inspect local clips. AI image/video/voice generation uses the host's actual authorized tools.
Record pending jobs honestly. A rendered draft is not a final ad or authorization to spend.

## Improvement and updates

Keep corrections, source facts and outputs private. Changing an allowed workflow never widens
permissions. Preserve replaced text with evidence. The installer backs up AGENTS.md, routine
files, agent.json and .gitignore under dropship/backups/. Stop the scheduler and reconcile
active jobs before installing or restoring. The installer leaves PAUSED untouched.
This profile is a copied snapshot; upstream upgrades do not silently refresh its private folder.
