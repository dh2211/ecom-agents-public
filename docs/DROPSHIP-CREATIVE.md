# Dropship and Creative: advanced operation

For app users, start with [README](../README.md) and the
[Dropship workflow](COMMERCE-GUIDE.vi.html#dropship). This page covers standalone
skills and private scheduled kits, not prerequisites for the app. They do not
activate new schedules. Use your own data only with a named reviewer and file-only rehearsal first.

## Start here

1. Use a reviewed checkout of this repository. Preserve local edits and back up private
   workspaces before updating. No historical pull request needs to be merged to use it.
2. Run `npm test`. Additional suite only: `npm run test:dropship`.
3. Open `skills/dropship-workbench/SKILL.md` for product/supplier/margin work and
   `skills/commerce-creative-studio/SKILL.md` for UGC, banners and experiments.
4. Work in a private output folder outside Git. Do not commit store data, supplier contracts,
   customer data, assets with restricted licenses, generated footage or credentials.

## Suggested first use

"Read skills/dropship-workbench/SKILL.md. For this product and destination, build a supplier
readiness dossier and margin model. Keep unknowns unknown. Do not create or publish a listing."

"Read skills/commerce-creative-studio/SKILL.md. Use the approved dossier and licensed product
photos to prepare three UGC hook hypotheses and two banner concepts. Produce one pilot first.
Use a real media tool only after probing it. Missing video generation means a production
pack with a named blocker, not a claimed completed video. Keep everything draft-only."

## What runs without a model or paid media service

- `ops.mjs economics`: calculates unit contribution, break-even CPA/ROAS and target CPA.
- `ops.mjs supplier`: checks recorded stock, quotation, shipping lane, reviews and margins.
- `creative.mjs plan`: creates storyboard, variants and production/review files.
- `creative.mjs banners`: creates three SVG drafts from an approved local product PNG/JPEG.
- `creative.mjs assemble`: FFmpeg/ffprobe optionally turn licensed local clips and a supplied
  voiceover into an actual vertical MP4 draft. No AI presenter or voice is synthesized here.
- `creative.mjs audit`: ffprobe measures final files, including the media container and codec,
  then checks hashes, lineage and declared reviews.

FFmpeg/ffprobe are optional external executables, installed by the owner. They are NOT bundled.
For media work, select a build supporting `-protocol_whitelist`. Unsupported builds
hold instead of retrying without network restrictions, and the error names the
executable that was selected. See [media boundary tests](../tests/dropship/media-boundary.test.mjs).
Without them the planning and banner-layout commands work, while measured media audit and
video assembly stop with an explicit missing-tool error. SVG drafts need PNG/JPEG export.
The MP4 helper does not burn in captions/disclosures; a human editor must add and verify them.
The current scripts never call Shopify, supplier, ad, image-generation or video-generation APIs.
A host can use separately authorized tools by following the skill's capability-probe workflow.

## End-to-end workflow library

### 1. Product -> supplier -> economics

GTM owns research; Workbench prepares the dossier. Read the current quote/stock for the
exact variant and destination, review a sample, shipping origin and handling/transit separately.
Include duties borne by the merchant, payment costs, refunds and replacements. Deliver a
hold or decision-ready dossier. A human chooses whether the product can be sold.

### 2. Approved product -> listing package

SEO consumes sourced facts, unit economics and shipping policy. Write a local listing,
FAQ, included-items list, variant mapping, image plan and landing-page acceptance checklist.
Web Dev handles any reviewable page/theme changes. No agent publishes the listing.

### 3. Real-creator UGC

Sales prepares a creator brief and outreach draft. A human contracts the creator and arranges
samples. Receive real experience/footage plus paid-media/editing/likeness permissions. Ads
uses Creative Studio for one pilot edit. Review honesty, product fidelity, captions, disclosure
and market rights, then produce the controlled hook variants. No auto-messaging or posting.

### 4. AI-presenter or product-demo UGC

Ads chooses an explicit synthetic-presenter or product-demo mode. Provide licensed references
to the host's real media tools. Record job ids and actual returned files. Never script a
fictional customer experience. Use real footage when AI alters the product. Assemble locally,
add captions/disclosure in an editor, audit final files and leave publication to the owner.

### 5. Ad banners

Use one approved product photo and offer. Produce product-hero and objection-answer concepts.
Create 1:1, 4:5 and 9:16 compositions. SVG layouts are editable drafts, not upload-ready ads.
Check mobile readability/current placement safe zones and export raster files. If AI makes
a lifestyle background, lock the actual variant and inspect every physical detail.

### 6. Controlled launch experiment

Owner approves the final asset hash, channel, test budget and stopping rules. Ads records
three hook variants sharing the same body, offer and CTA; test banners separately. Read results
with currency, timezone, denominator and attribution window. Propose the next move from
contribution, not attention metrics alone. The code does not activate or edit campaigns.

### 7. Supplier/order exception -> support

CSAT reconciles supplier acceptance, shipping label, carrier pickup, transit and delivery
by order line. Draft an honest response and remedy with the policy/evidence cited. Do not
promise shipment, replacement, compensation or refund that has not been authorized.

### 8. Feedback -> new creative or supplier decision

CoS combines dated margin, returns, delays, support causes and creative results. Distinguish
bad creative from poor product/fulfillment. Feed verified objections to the next brief; send
supplier failures to a supplier decision, not a stronger advertising claim. No edits to other kits.

## Private installed Agent profile

Do NOT install a live profile into the source `agents/` folder. Hire a separate private kit
per store/business model, using the CLI from this checkout. A representative Windows destination
is `D:\AgentOps\dropship-ads` (outside cloud sync and outside any Git checkout).

```
node installer/cli.mjs hire ads --to "D:\AgentOps\dropship-ads"
```

Stop its scheduler and any active process. Create an EMPTY `PAUSED` file in that private kit.
Copy `profiles/dropship-ecommerce/config.example.json` to a private store.json and set the
actual opaque store id, currency, timezone, target countries and freshness policy.

```
node installer/dropship-profile.mjs --root "D:\AgentOps\dropship-ads" --config "D:\AgentOps\store.json"
node installer/dropship-profile.mjs --root "D:\AgentOps\dropship-ads" --config "D:\AgentOps\store.json" --apply
```

The first command only plans. The second installs the profile, copies the two skills into
`dropship/skills/`, adds after-guard hooks and keeps byte-for-byte backups. It never schedules
anything, changes VERSION or removes PAUSED. Existing POD profiles are refused; the POD
installer also refuses a Dropship kit. Use separate folders, not a profile switch on live state.

Read `DROPSHIP.md` and test only a supervised harmless file-only run. Keep business schedules
paused until a supervised local acceptance run succeeds with approved data. Only then may
the owner remove PAUSED and resume through run-routine.mjs. Native scheduled prompts without
that wrapper do not gain its process-level protection just from this profile.

## Ownership and recovery

Supplemental outputs belong under `dropship/out/<routine-id>/<local-date>/` in each kit.
Handoffs are read-only across kits, bound to store, variant, source evidence and payload hash.
A review record cannot grant send/publish/spend permissions. Keep the host's real tools
read-only. A model-generated 'approved' field is not authenticated approval.

Backups live in `dropship/backups/`. On installation failure, captured text files are restored;
inspect any interrupted installation before restarting. Never delete runtime locks or state
just to get a green test. Keep the existing POD recovery procedure for uncertain runs.
Upgrades do not silently replace private profiles or refresh copied skills: review and update
those snapshots explicitly with the owner, while paused.

## Rollout order

Start with Workbench + GTM and one product/lane. Add Ads + Creative Studio after sample and
margin review. Add SEO/Social for draft distribution, then CSAT/CoS for feedback. Sales supports
creator/wholesale operations as needed; Web Dev stays on reviewable code branches.

## Known limits

No built-in cloud UGC generation connector, supplier purchasing connector, automated returns,
store publishing gateway or ad-spend gateway. Human visual/rights/compliance review remains
necessary. Test approval does not prove live-store results. See DROPSHIP-SOURCES.md and the
skill references for evidence requirements and changing platform policies.
