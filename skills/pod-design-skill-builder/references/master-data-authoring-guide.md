# POD Niche Master-Data Authoring Guide

Schema 3.2 builds a niche-specific design system, not a keyword dump. Author records that change buyer logic, creative execution, production constraints, or safety behavior; remove fields that merely restate the niche name.

## Contents

1. [Bound the niche](#1-bound-the-niche)
2. [Separate validity, evidence, legal, and sensitivity](#2-separate-validity-evidence-legal-and-sensitivity)
3. [Create market contexts and traceable claims](#3-create-market-contexts-and-traceable-claims)
4. [Model the buyer system](#4-model-the-buyer-system)
5. [Build idea archetypes and creative gates](#5-build-idea-archetypes-and-creative-gates)
6. [Build the visual grammar](#6-build-the-visual-grammar)
7. [Map products, methods, and output profiles](#7-map-products-methods-and-output-profiles)
8. [Design copy and personalization](#8-design-copy-and-personalization)
9. [Encode IP and sensitivity behavior](#9-encode-ip-and-sensitivity-behavior)
10. [Encode transparency and product contrast](#10-encode-transparency-and-product-contrast)
11. [Calibrate concept fit](#11-calibrate-concept-fit)
12. [Create representative sample briefs](#12-create-representative-sample-briefs)
13. [Exercise the binding receipt](#13-exercise-the-binding-receipt)
14. [Validate and release](#14-validate-and-release)

## 1. Bound the niche

Use separate fields:

- `niche_slug`: lowercase ASCII hyphen-case, such as `giao-vien`;
- `niche_display`: native human-readable text, such as `Giáo viên`.

Record primary buyers, recipients, identity signals, included boundaries, excluded adjacent segments, locale, and marketplaces. Ask only when ambiguity changes purchase logic, protected references, production, safety, or proprietary evidence.

The validator derives minimum coverage from the declared buyer/recipient scope. A focused niche may use fewer records than a broad occupation, but it cannot use cloned filler. Persona signatures and style axes must remain structurally distinct.

Completion criterion: every included segment has a reason to share one design system, and every excluded segment would materially change that system.

## 2. Separate validity, evidence, legal, and sensitivity

Keep these independent:

1. **Schema validity**: executable structure and references pass.
2. **Evidence status**: `curated-draft`, `researched`, or `validated`.
3. **Legal status**: `unchecked`, `screened-not-cleared`, or `human-review-required`.
4. **Sensitivity action**: `refuse`, `constrain`, or `human-review` when a rule matches.
5. **Production readiness**: the selected provider template and output have been verified.

Do not call schema-valid data market-validated, IP-screened data legally cleared, a respectful concept production-ready, or a valid PNG print-ready without the relevant evidence.

Completion criterion: each status can change without silently changing the others.

## 3. Create market contexts and traceable claims

Every source needs a stable ID. A source may be a user brief, internal framework, research URL, or proprietary rule. `researched` and `validated` evidence still require URL, retrieval date, and the exact claim supported; `validated` also needs an owner and review date.

A market context records:

- marketplace, locale, and region;
- measurement system;
- restricted claim fragments;
- output/template notes;
- `review_by` date.

An evidence claim records:

- claim ID and type;
- exact statement;
- `hypothesis`, `supported`, or `validated` status;
- source IDs and market-context IDs;
- confidence and `review_by`.

A stale context or claim may remain in the package, but the target must downgrade it to a hypothesis and avoid current/demand-backed wording. Do not create a large citation graph for decorative facts; link only claims that affect market language, seasonality, production, or buyer logic.

Completion criterion: a reviewer can trace every non-hypothesis claim to a source and detect expired evidence without reading prose outside the data.

## 4. Model the buyer system

Author in this order:

1. personas;
2. buyer-recipient pairs;
3. occasions;
4. emotional jobs;
5. buyer language;
6. products and personalization;
7. hooks and visual execution.

Every commercial concept must answer:

- Who buys?
- Who receives?
- Why now?
- What emotional job is completed?
- Why does the product fit the message?

Personas must differ on structured buyer intent, recipient relationship, emotional trigger, or identity stage, not only their name or one adjective.

Completion criterion: each sample brief resolves to one coherent purchase hypothesis rather than mixing unrelated audience fragments.

## 5. Build idea archetypes and creative gates

An idea archetype is reusable purchase logic, not a style label. It binds compatible personas, occasions, products, hooks, required variation axes, and avoid rules.

Good archetypes include:

- identity/self-expression;
- appreciation or relationship gift;
- milestone/personalized keepsake;
- text-free symbolic concept;
- memorial/sympathy concept when appropriate.

Use only archetypes relevant to the niche. Add:

- `creative_controls.required_variation_axes`;
- `minimum_distinct_axes_per_variant`;
- short anti-generic phrase fragments;
- combination rules with selectors and `forbid` or `review` outcomes.

Do not add a self-awarded originality score. Execute observable gates instead: forbidden combinations fail, generic copy fails, and variants must differ on typography, motif, palette, composition, hook, or personalization as configured.

Completion criterion: deleting the archetype and gates would measurably reduce the specificity or diversity of a resolved brief.

## 6. Build the visual grammar

For every motif, state:

- what it means;
- when it helps;
- when it becomes inappropriate or generic.

Palettes are foreground candidates, not fixed output colors. Store valid `#RRGGBB` values and a contrast rule, then recalculate against the actual product surface.

Styles reference real motif and palette names. Keep at least four execution directions so the target can generate 1-4 variants, but require at least two changed creative axes between any pair. Do not force four outputs when the user asks for one.

Typography and composition records must explain hierarchy, use cases, and failure patterns. Numeric print constraints live in production methods rather than vague instructions such as “use bold lines.”

Completion criterion: each style is distinguishable by a checkable grammar, not cosmetic wording.

## 7. Map products, methods, and output profiles

Every product needs:

- priority and best-fit use cases;
- word limit;
- supported personalization;
- one `production_method_id`;
- one `output_profile_id`;
- print notes and avoid rules.

Every production method needs:

- products it covers;
- process label;
- minimum stroke, gap, and text height in millimeters;
- maximum colors;
- distress and halftone policy;
- substrate and ink notes;
- template requirement;
- explicit uncertainty.

Every output profile needs:

- products it covers;
- aspect ratio and file format;
- DPI target;
- `alpha_preferred: true` as a mandatory final-alpha invariant despite the legacy field name;
- safe zone, bleed, and template requirement;
- both pixel dimensions or neither.

A provider template can tighten a baseline but never silently weaken it. Leave dimensions null when unknown; do not invent marketplace specifications.

Completion criterion: every product belongs to exactly one method and one profile, and a resolver mismatch fails closed.

## 8. Design copy and personalization

Support exactly:

- `exact`: approved wording remains byte-for-byte in planning;
- `proposed`: wording is labeled as a suggestion;
- `none`: artwork contains no text or pseudo-text.

Personalization rules specify limits, allowed symbols, capitalization, date formats, and product compatibility. Keep buyer-language fragments short and original; never store copied listings, lyrics, trademarked slogans, memorial poems, or long quotations.

Market restricted claims and anti-generic fragments execute during request resolution. High-stakes exact text should be composed deterministically after illustration generation when a suitable layout tool exists.

Completion criterion: malformed copy, unsupported personalization, restricted claims, and anti-generic phrases produce typed failures.

## 9. Encode IP and sensitivity behavior

IP screening and sensitivity are different axes.

IP data includes:

- niche-specific avoid list;
- safe substitutions;
- human-review triggers.

Sensitivity rules include:

- trigger terms;
- optional persona and occasion selectors;
- `refuse`, `constrain`, or `human-review` action;
- mandatory constraints and rationale.

Examples of sensitivity gates include targeted-group mockery, blame, clinical promises, tragedy-as-humor, medical claims, and spiritual certainty. A rule that only writes a note is not behavioral and does not satisfy schema 3.2 intent.

Completion criterion: at least one adversarial fixture proves refusal or constraint, while legal status remains separate.

## 10. Encode transparency and product contrast

Final production output is a PNG with meaningful alpha.

Classify the exact runtime:

- `supported`: native control, provider metadata, or prior strict alpha pass;
- `unknown`: plausible but unverified;
- `unsupported`: explicit limitation, rejected control, or exhausted probes.

A supported runtime uses the native transparent option, PNG, and strict alpha QA. Failed alpha rerenders transparent and never switches to solid fallback. An unknown runtime probes first. Only unsupported or probe-confirmed unavailable routes may use a temporary flat canvas.

Approved fallback palette:

- `#000000`;
- `#FFFFFF`;
- `#808080`;
- `#3A3A3A`;
- `#C0C0C0`.

Select the canvas after the foreground palette by maximum color distance. Require `MANDATORY FLAT SOLID COLOR. NO SHADOWS.`, remove only edge-connected pixels, and run the same final alpha QA.

Keep product contrast independent:

- dark product → light foreground or strong light outline;
- light product → dark foreground or strong dark outline;
- mid/unknown → dual tone, knockout, or robust outline.

Completion criterion: every route ends at `transparent-png-alpha-qa-pass` or a typed failure.

## 11. Calibrate concept fit

Score five commercial criteria from 1-5:

- fast clarity;
- giftability;
- emotional pull;
- differentiation;
- series potential.

The 25-point total is a comparison heuristic, not a sales forecast. Record confidence, evidence basis, and assumptions. IP or sensitivity blockers override a high fit score.

Completion criterion: the same concept receives the same decision thresholds regardless of visual style.

## 12. Create representative sample briefs

Every sample brief binds:

- persona and buyer-recipient pair;
- buyer and recipient;
- occasion and emotion;
- product, method through product, and output profile;
- style;
- copy object;
- product surface;
- personalization;
- why the purchase logic fits;
- IP notes.

Exercise multiple products, buyers, copy modes, surfaces, methods, and emotional intensities. A focused niche may have fewer briefs than a broad niche, but it must cover its distinct system without duplicates.

Completion criterion: broad and focused goldens both pass without loosening the schema or manufacturing filler.

## 13. Exercise the binding receipt

After building a target, create a representative request JSON and run:

```bash
python scripts/resolve_design_brief.py --request request.json --output receipt.json
```

The receipt must close market, buyer system, archetype, hook, styles, copy, personalization, product, production method, output profile, sensitivity, and alpha policy. It records data and request SHA-256.

Also run negative cases:

- unknown ID;
- product/method/profile mismatch;
- anti-generic phrase;
- forbidden combination;
- sensitivity refusal;
- incompatible alpha capability evidence.

Completion criterion: positive receipt succeeds and every negative fails for the documented reason.

## 14. Validate and release

Run:

```bash
python scripts/create_pod_design_skill.py \
  --niche-slug <slug> \
  --data-json <file> \
  --validate-only
```

The validator checks types, ranges, source/claim freshness, semantic references, structured distinctness, product/method/profile closure, creative gates, sensitivity actions, copy consistency, sample bindings, and the alpha policy.

Treat warnings as review items. `curated-draft` intentionally warns that demand has not been live-validated. Use `--warnings-as-errors` only when the release contract requires every warning resolved.

Before release:

- run the full unit suite;
- build broad teacher and focused pet-memorial goldens;
- run the platform validator;
- verify manifest hashes;
- fix `SOURCE_DATE_EPOCH` and prove byte-identical ZIPs;
- confirm always-loaded references remain at or below 7,000 bytes.

Completion criterion: every binary no-go gate is green; no numeric readiness field substitutes for those gates.
