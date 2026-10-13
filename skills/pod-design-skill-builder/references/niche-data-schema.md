# POD Niche Data Schema 3.2

The machine-readable companion is `niche-data.schema.json`. The Python validator is authoritative for semantic references, scope-derived coverage, freshness, structured distinctness, and cross-record rules.

## Migration

The builder accepts schema `3.2`, `3.1`, `3.0`, and legacy `2.0`.

- `3.0 → 3.1` restores the capability/evidence transparency state machine and strict alpha policy.
- `3.1 → 3.2` preserves IDs, sample bindings, output profiles, and alpha policy while adding review-labeled market, evidence, production, creative, and sensitivity scaffolds.
- `2.0 → 3.2` also migrates slug/display, provenance status, pair IDs, copy objects, palette options, output profiles, concept-fit naming, and transparent-first defaults.

Migrated 3.2 scaffolds are valid starting points, not reviewed niche facts. The CLI emits a warning requiring review before demand-backed or production-ready claims.

Save normalized output with `--write-normalized-data <path>`.

## Root contract

```json
{
  "schema_version": "3.2",
  "niche_slug": "teacher",
  "niche_display": "Teacher",
  "locale": "en-US",
  "niche_profile": {},
  "data_provenance": {},
  "market_contexts": [],
  "evidence_claims": [],
  "personas": [],
  "buyer_recipient_pairs": [],
  "occasions": [],
  "emotions": [],
  "buyer_language": [],
  "visual_vocabulary": {},
  "product_fit": [],
  "production_methods": [],
  "personalization_fields": [],
  "hook_patterns": [],
  "idea_archetypes": [],
  "creative_controls": {},
  "combination_rules": [],
  "sensitivity_rules": [],
  "style_variants": [],
  "concept_fit_calibration": {},
  "ip_safety": {},
  "output_profiles": [],
  "output_defaults": {},
  "qa_rules": {},
  "sample_briefs": []
}
```

`niche_slug` is explicit lowercase ASCII hyphen-case. `niche_display` may contain Unicode but no newline or control character.

## Scope-derived coverage

Schema minima represent the smallest focused niche. The Python validator raises them from the number of distinct primary buyers and recipients, capped at the broad-niche limits.

| Domain | Focused floor | Broad cap |
|---|---:|---:|
| Personas | 3 | 8 |
| Buyer-recipient pairs | 3 | 5 |
| Occasions | 4 | 8 |
| Emotions | 4 | 6 |
| Buyer-language records | 4 | 6 |
| Motifs | 6 | 10 |
| Products | 3 | 5 |
| Personalization fields | 2 | 4 |
| Hooks | 5 | 8 |
| Sample briefs | 4 | 6 |
| Styles | 4 | 8 |

Counts do not replace uniqueness. Duplicate persona signatures and styles that fail to change at least two of typography, motifs, or palettes are errors.

## Provenance, markets, and claims

Every source has an ID:

```json
{
  "id": "internal-domain-knowledge",
  "type": "internal-domain-knowledge",
  "note": "Curated assumptions; no live-market validation."
}
```

For `researched` or `validated` evidence, at least one source also includes URL, ISO retrieval date, and the claim supported. `validated` additionally requires review owner and review date.

Market context:

```json
{
  "id": "etsy-us",
  "marketplace": "Etsy",
  "locale": "en-US",
  "region": "US",
  "measurement_system": "imperial",
  "restricted_claims": ["guaranteed outcome"],
  "output_notes": ["Verify the current provider template."],
  "review_by": "2026-11-21"
}
```

Evidence claim:

```json
{
  "id": "appreciation-angle",
  "claim_type": "market-hypothesis",
  "statement": "Appreciation is a plausible gift angle.",
  "status": "hypothesis",
  "source_ids": ["internal-domain-knowledge"],
  "market_context_ids": ["etsy-us"],
  "review_by": "2026-11-21",
  "confidence": "medium"
}
```

Claim types: `market-hypothesis`, `buyer-language`, `seasonality`, `production`, `policy`.

Claim status: `hypothesis`, `supported`, `validated`. `supported` and `validated` require at least one source reference. Expired `review_by` produces a stale warning and forbids current/demand-backed wording.

## Buyer system

Persona:

```json
{
  "id": "kindergarten-teacher",
  "name": "Kindergarten teacher",
  "identity_stage": "active early-elementary educator",
  "buyer_intents": ["self-purchase", "parent gift"],
  "recipient_relationships": ["parent to teacher"],
  "emotional_triggers": ["patience", "classroom impact"],
  "insider_language": ["little learners"],
  "safe_visual_cues": ["pencil", "book"],
  "product_fit": ["sweatshirt", "mug"],
  "avoid": ["licensed characters"]
}
```

Buyer-recipient pair:

```json
{
  "id": "parent-to-teacher",
  "buyer": "parent",
  "recipient": "classroom teacher",
  "purchase_reason": "Recognize classroom impact.",
  "strong_occasions": ["teacher-appreciation"],
  "preferred_products": ["mug", "tote"]
}
```

Occasions reference valid products and personalization keys. Emotions encode job-to-be-done, use conditions, design direction, copy tone, and avoid behavior. Buyer-language records contain original short phrases, meanings, use cases, and avoid rules.

## Visual vocabulary and styles

Visual vocabulary contains motifs, palettes, typography directions, and compositions. Palettes use unique `#RRGGBB` values and are foreground candidates recalculated against the actual product surface.

A style references valid motif and palette names:

```json
{
  "id": "minimal-premium",
  "label": "Minimal premium",
  "commercial_role": "high-consideration gift",
  "description": "One focal symbol with generous space.",
  "typography": "clean serif",
  "motifs": ["open book"],
  "palette_options": ["quiet neutral"],
  "avoid": "micro details"
}
```

Any pair of styles must differ on at least two of typography, motifs, or palette options.

## Products, production methods, and output profiles

Product:

```json
{
  "product": "sweatshirt",
  "priority": "high",
  "works_best_with": ["identity", "appreciation"],
  "max_words": 14,
  "personalization": ["teacher-name"],
  "production_method_id": "apparel-dtg",
  "output_profile_id": "apparel-front",
  "print_notes": "Use robust strokes and compact hierarchy.",
  "avoid": ["micro text"]
}
```

Production method:

```json
{
  "id": "apparel-dtg",
  "label": "DTG apparel baseline",
  "process": "direct-to-garment",
  "products": ["t-shirt", "sweatshirt"],
  "minimum_stroke_mm": 0.8,
  "minimum_gap_mm": 0.8,
  "minimum_text_height_mm": 4.0,
  "max_colors": 8,
  "distress_allowed": true,
  "halftones_allowed": true,
  "substrate_notes": "Verify the selected blank.",
  "ink_notes": "Use the provider profile and a test print.",
  "template_required": true,
  "uncertainty": "baseline-provider-template-required"
}
```

Each product appears in exactly one method and references that same method. Positive numeric constraints reject booleans and zero.

Output profile:

```json
{
  "id": "apparel-front",
  "products": ["t-shirt", "sweatshirt"],
  "aspect_ratio": "5:6",
  "file_format": "PNG",
  "dpi": 300,
  "width_px": null,
  "height_px": null,
  "alpha_preferred": true,
  "safe_zone": "Keep content inside the central 80%.",
  "bleed": "Confirm the provider template.",
  "marketplace_template_required": true
}
```

Set both pixel dimensions or neither. `alpha_preferred` must be true; schema 3.2 treats final alpha as mandatory.

## Idea archetypes and creative controls

Idea archetype:

```json
{
  "id": "appreciation-gift",
  "label": "Appreciation gift",
  "purchase_logic": "A buyer thanks a recipient for a specific contribution.",
  "persona_ids": ["kindergarten-teacher"],
  "occasion_ids": ["teacher-appreciation"],
  "product_names": ["mug"],
  "hook_ids": ["impact-contrast"],
  "required_variation_axes": ["hook", "composition", "palette"],
  "avoid": ["unsupported outcome promises"]
}
```

Allowed variation axes: `composition`, `typography`, `motif`, `palette`, `hook`, `personalization`.

Creative controls define the available axes, minimum distinct axes per variant, and anti-generic phrase fragments. Combination rules contain optional selector arrays, `forbid` or `review`, and a reason. At least one selector is required.

## Copy, personalization, and sensitivity

Copy object modes:

- `exact`: non-empty and preserved;
- `proposed`: non-empty and labeled;
- `none`: empty text only.

Personalization fields have stable keys, validation prose, and compatible products.

Sensitivity rule:

```json
{
  "id": "no-medical-claims",
  "trigger_terms": ["cures grief"],
  "persona_ids": [],
  "occasion_ids": [],
  "action": "refuse",
  "constraints": ["Remove medical claims."],
  "rationale": "The design system cannot promise clinical outcomes."
}
```

Actions: `refuse`, `constrain`, `human-review`. Constraints are mandatory; a note-only rule is invalid.

## Concept fit and IP

Concept-fit thresholds satisfy:

```text
replace < rework < refine < go <= 25
```

Commercial scoring is separate from IP. IP data requires at least five niche avoid items, three safe substitutions, and three human-review triggers. Neither scoring nor screening implies sales performance or legal clearance.

## Output defaults and alpha QA

The background contract is fixed:

- `preferred_mode: transparent`;
- PNG and real alpha required;
- capability-gated supported/unknown/unsupported routes;
- supported failure rerenders or hard-fails, never falls back;
- unknown probes before fallback;
- fallback only after confirmed unavailability;
- final output always requires alpha;
- safe palette exactly black, white, neutral gray, dark gray, and silver;
- maximum color-distance selection;
- prompt contains `NO SHADOWS`;
- forbidden list explicitly includes green/chroma-key background.

QA requires copy modes, isolated artwork, no shadows, product contrast, strict alpha ratios, margin checks, and matching contrast ratios between defaults and QA.

## Sample briefs and executable receipt

Sample briefs bind persona, pair, buyer, recipient, occasion, emotion, style, product, output profile, copy, personalization, visual direction, fit rationale, IP notes, and product surface.

The generated target resolves a request with `resolve_design_brief.py`. A receipt closes market context, archetype, hook, method, profile, copy, sensitivity, variants, and exact runtime alpha route. Invalid references and incompatible combinations fail closed.

## Cross-reference rules

The Python validator enforces:

- every ID/name is unique and every semantic reference resolves;
- source and market references resolve;
- products, methods, and profiles agree bidirectionally;
- personas and styles pass structured distinctness;
- archetype and combination selectors resolve;
- sensitivity actions and constraints are executable;
- sample pair, product, profile, personalization, and surface bindings agree;
- commercial fit, evidence maturity, legal status, sensitivity, production readiness, and alpha QA remain separate.
