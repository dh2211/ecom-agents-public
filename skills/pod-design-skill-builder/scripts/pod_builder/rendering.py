"""Render a compact, progressively loaded target POD design skill."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence

from .constants import GENERATOR_ID, GENERATOR_VERSION, SAFE_BACKGROUND_PALETTE, SCHEMA_VERSION
from .utils import sha256_json, write_text, yaml_string


def _escape_cell(value: Any) -> str:
    if isinstance(value, list):
        rendered = "<br>".join(str(item) for item in value)
    elif isinstance(value, dict):
        rendered = "; ".join(f"{key}: {item}" for key, item in value.items())
    elif value is None:
        rendered = ""
    else:
        rendered = str(value)
    return rendered.replace("\n", " ").replace("|", "/")


def markdown_table(
    records: Iterable[dict[str, Any]], columns: Sequence[tuple[str, str]]
) -> str:
    rows = list(records)
    header = "| " + " | ".join(label for label, _ in columns) + " |"
    separator = "|" + "---|" * len(columns)
    body = [
        "| " + " | ".join(_escape_cell(row.get(key, "")) for _, key in columns) + " |"
        for row in rows
    ]
    return "\n".join([header, separator, *body])


def markdown_list(items: Iterable[Any]) -> str:
    rendered = [f"- {_escape_cell(item)}" for item in items]
    return "\n".join(rendered) if rendered else "- None recorded."


def _data_status(data: dict[str, Any]) -> str:
    provenance = data["data_provenance"]
    return (
        f"schema-valid; evidence={provenance['evidence_status']}; "
        f"legal={provenance['legal_status']}"
    )


def render_target_skill_md(data: dict[str, Any]) -> str:
    niche = data["niche_slug"]
    display = data["niche_display"]
    lower = display.lower()
    skill_name = f"{niche}-pod-design-agent"
    description = (
        f"Create, refine, and safely redesign print-on-demand artwork for the {lower} niche "
        "using schema-validated, provenance-labeled master data. Use for niche POD concepts, "
        "copy and personalization, product-aware color contrast, capability-gated mandatory "
        "transparent-background generation, verified alpha QA, safe solid-background fallback "
        "only when transparency is unavailable, reference-image redesign, "
        "concept-fit review, print QA, and IP-risk screening."
    )
    default_variants = data["output_defaults"]["variant_count_default"]
    return f'''---
name: {skill_name}
description: {yaml_string(description)}
---

# {display} POD Design Agent

Turn a rough {lower} idea, phrase, personalization request, or reference image into original POD artwork grounded in the bundled niche data.

## Load only what the task needs

Always read:

1. `references/master-data-index.md` for data status, valid IDs, and routing.
2. `references/idea-engine-workflow.md` for the operating sequence.

Then load conditionally:

- Run `scripts/select_records.py` or read the relevant domain file when exact records are needed.
- Read `references/design-brief-contract.md` before resolving a production request.
- Read `references/market-evidence.md` for market constraints, claim status, source links, and freshness.
- Read `references/idea-archetypes.md` for purchase logic, anti-generic controls, variation axes, and forbidden combinations.
- Read `references/production-sensitivity.md` for numeric print constraints and sensitivity actions.
- Read `references/personas.md` for persona or buyer-recipient decisions.
- Read `references/occasions-products.md` for occasions, products, print profiles, and personalization compatibility.
- Read `references/visual-system.md` for motifs, palettes, typography, compositions, and style variants.
- Read `references/copy-personalization.md` for copy modes, hooks, buyer language, and sample briefs.
- Read `references/concept-fit-and-ip-gate.md` before approving a concept or redesign.
- Read `references/transparency-capability-policy.md` before selecting any image-generation route.
- Read `references/background-and-contrast.md` before image generation or background removal.
- Read `references/generation-execution.md` when generating images or returning prompts.
- Read `references/prompt-templates.md` only while constructing production prompts.
- Read `references/qa-checklist.md` after each output.

The JSON file `references/{niche}-master-data.json` is canonical. Markdown files are compact views.

## Required workflow

1. Resolve persona, buyer-recipient pair, recipient, occasion, emotion, market context, idea archetype, product, production method, product surface color or tone, copy mode, personalization, output profile, hook, and style.
2. Build a request JSON and run `scripts/resolve_design_brief.py`. Stop on any resolver error. Treat the binding receipt as the authoritative contract for product/method/profile closure, creative gates, sensitivity behavior, and the alpha route.
3. Use `scripts/select_records.py` only for additional record inspection; do not bypass the resolver.
4. Set `variant_count` from 1 to 4. Default to {default_variants}; honor a smaller explicit user request.
5. Run the concept-fit heuristic and the separate IP gate. Do not turn the IP check into a numerical promise of legal safety.
6. Match artwork colors to the product surface:
   - dark product surface -> favor light artwork colors;
   - light product surface -> favor dark artwork colors;
   - mid-tone or unknown surface -> use a high-contrast dual-tone system or obtain the product color.
7. Select the product output profile. Treat marketplace dimensions and bleed as template-dependent unless exact specifications are supplied.
8. Classify the active model/tool as `supported`, `unknown`, or `unsupported` for real alpha. Model name or PNG format alone is not proof. Use native tool metadata, an explicit transparent option, current provider documentation, or a prior alpha-QA pass.
9. For `supported`, set the native transparent option when exposed, request PNG alpha, materialize the file, and run `scripts/verify_png_alpha.py`. On failure, rerender transparent up to {data['output_defaults']['background']['max_transparent_attempts']} attempts. Never switch a supported model to solid fallback. Hard-fail after the final failed attempt.
10. For `unknown`, probe transparent output up to {data['output_defaults']['background']['unknown_probe_attempts']} attempts. A passing alpha file promotes the runtime to `supported`. Only repeated failed probes establish that transparency is unavailable for the current runtime.
11. For explicitly `unsupported` or probe-confirmed unavailable output, choose one safe flat background from `{', '.join(SAFE_BACKGROUND_PALETTE)}` with `scripts/select_background.py`. Include `MANDATORY FLAT SOLID COLOR. NO SHADOWS.`, remove the flat color with `scripts/remove_flat_background.py`, and run strict alpha QA. The final deliverable must still be a transparent PNG.
12. Run copy, composition, contrast, alpha, printability, and IP QA. Regenerate or reprocess failed variants instead of calling them production-ready.

## Non-negotiable behavior

- Keep one commercial hypothesis across variants; vary visual execution rather than buyer logic.
- Use copy mode `exact`, `proposed`, or `none`. Do not force text into no-text artwork.
- Preserve approved exact copy byte-for-byte in planning; reject image outputs with malformed text.
- Deliver only a transparent PNG that passes QA. A fallback color is a temporary removal canvas, never an acceptable final background.
- Never use solid fallback merely because one transparent render failed on a supported model/tool.
- Do not deliver or label an image production-ready unless the materialized file passes strict alpha QA.
- Never use green chroma key, neon key colors, gradients, textures, shadows, glow, haze, lighting, vignette, or fake transparency as a fallback background.
- Keep foreground contrast strong against the actual product color, not merely against the temporary canvas.
- Generate directly when the user asks to create, draw, design, render, visualize, or redesign and an image tool is available.
- Use prompt-only mode only when explicitly requested or image generation is unavailable.
- Use a reference image only when it is actually present. Preserve broad intent, not distinctive composition, typography, marks, characters, or decorative treatment.
- Describe evidence as `{_data_status(data)}`. Do not claim demand validation or legal clearance beyond the recorded status.
'''


def render_master_data_index(data: dict[str, Any]) -> str:
    niche = data["niche_slug"]
    provenance = data["data_provenance"]
    counts = {
        "market contexts": len(data["market_contexts"]),
        "evidence claims": len(data["evidence_claims"]),
        "personas": len(data["personas"]),
        "buyer-recipient pairs": len(data["buyer_recipient_pairs"]),
        "occasions": len(data["occasions"]),
        "emotions": len(data["emotions"]),
        "products": len(data["product_fit"]),
        "production methods": len(data["production_methods"]),
        "output profiles": len(data["output_profiles"]),
        "idea archetypes": len(data["idea_archetypes"]),
        "sensitivity rules": len(data["sensitivity_rules"]),
        "style variants": len(data["style_variants"]),
        "sample briefs": len(data["sample_briefs"]),
    }
    id_rows = [
        {"domain": "market context", "ids": [item["id"] for item in data["market_contexts"]]},
        {"domain": "persona", "ids": [item["id"] for item in data["personas"]]},
        {"domain": "occasion", "ids": [item["id"] for item in data["occasions"]]},
        {"domain": "emotion", "ids": [item["id"] for item in data["emotions"]]},
        {"domain": "hook", "ids": [item["id"] for item in data["hook_patterns"]]},
        {"domain": "idea archetype", "ids": [item["id"] for item in data["idea_archetypes"]]},
        {"domain": "style", "ids": [item["id"] for item in data["style_variants"]]},
        {"domain": "production method", "ids": [item["id"] for item in data["production_methods"]]},
        {"domain": "output profile", "ids": [item["id"] for item in data["output_profiles"]]},
    ]
    return f'''# Master Data Index

## Status

- Niche: `{niche}` / {data['niche_display']}
- Schema: `{data['schema_version']}` (validated by the builder)
- Evidence: `{provenance['evidence_status']}`
- Legal screening: `{provenance['legal_status']}`
- Last updated: `{provenance['last_updated']}`
- Marketplaces: {", ".join(provenance['marketplaces'])}

`curated-draft` means the content is a reasoned starting point, not live proof of demand. `screened-not-cleared` is risk reduction, not legal clearance.

## Record counts

{markdown_table([{"domain": key, "count": value} for key, value in counts.items()], (("Domain", "domain"), ("Count", "count")))}

## Fast record lookup

```bash
python scripts/select_records.py --list-domains
python scripts/select_records.py --persona <persona-id> --occasion <occasion-id> --product <product-name>
python scripts/select_records.py --brief <sample-brief-id>
```

## Stable IDs

{markdown_table(id_rows, (("Domain", "domain"), ("IDs", "ids")))}

## Domain routing

- `references/personas.md`: personas and buyer-recipient pairs.
- `references/occasions-products.md`: occasions, products, personalization compatibility, and output profiles.
- `references/visual-system.md`: motifs, palettes, typography, compositions, and styles.
- `references/copy-personalization.md`: buyer language, hooks, personalization, and examples.
- `references/market-evidence.md`: market constraints, claim status, sources, and freshness.
- `references/idea-archetypes.md`: purchase logic, variation axes, anti-generic controls, and combination rules.
- `references/production-sensitivity.md`: numeric production constraints and behavioral sensitivity rules.
- `references/design-brief-contract.md`: required request shape and executable binding receipt.
- `references/concept-fit-and-ip-gate.md`: commercial heuristic and IP blockers.
- `references/transparency-capability-policy.md`: runtime evidence, retry state machine, and mandatory alpha QA.
- `references/background-and-contrast.md`: generation-canvas rules and product-surface contrast.

Canonical source: `references/{niche}-master-data.json`.
'''


def render_personas(data: dict[str, Any]) -> str:
    return f'''# Personas and Buyer-Recipient Logic

## Contents

- [Personas](#personas)
- [Buyer-recipient pairs](#buyer-recipient-pairs)

## Personas

{markdown_table(data['personas'], (("ID", "id"), ("Name", "name"), ("Stage", "identity_stage"), ("Buyer intents", "buyer_intents"), ("Relationships", "recipient_relationships"), ("Emotional triggers", "emotional_triggers"), ("Insider language", "insider_language"), ("Visual cues", "safe_visual_cues"), ("Products", "product_fit"), ("Avoid", "avoid")))}

## Buyer-recipient pairs

{markdown_table(data['buyer_recipient_pairs'], (("ID", "id"), ("Buyer", "buyer"), ("Recipient", "recipient"), ("Purchase reason", "purchase_reason"), ("Strong occasions", "strong_occasions"), ("Preferred products", "preferred_products")))}
'''


def render_occasions_products(data: dict[str, Any]) -> str:
    return f'''# Occasions, Products, Production Methods, and Output Profiles

## Contents

- [Occasions](#occasions)
- [Product fit](#product-fit)
- [Production methods](#production-methods)
- [Output profiles](#output-profiles)

## Occasions

{markdown_table(data['occasions'], (("ID", "id"), ("Name", "name"), ("Type", "type"), ("Seasonality", "seasonality"), ("Lead days", "lead_time_days"), ("Angles", "strong_angles"), ("Products", "common_products"), ("Personalization", "personalization"), ("Avoid", "avoid")))}

## Product fit

{markdown_table(data['product_fit'], (("Product", "product"), ("Priority", "priority"), ("Best with", "works_best_with"), ("Max words", "max_words"), ("Personalization", "personalization"), ("Production method", "production_method_id"), ("Output profile", "output_profile_id"), ("Print notes", "print_notes"), ("Avoid", "avoid")))}

## Production methods

Provider templates may tighten these baseline constraints; they must never silently weaken them.

{markdown_table(data['production_methods'], (("ID", "id"), ("Label", "label"), ("Process", "process"), ("Products", "products"), ("Min stroke mm", "minimum_stroke_mm"), ("Min gap mm", "minimum_gap_mm"), ("Min text mm", "minimum_text_height_mm"), ("Max colors", "max_colors"), ("Distress", "distress_allowed"), ("Halftones", "halftones_allowed"), ("Template", "template_required"), ("Uncertainty", "uncertainty")))}

## Output profiles

Dimensions remain null when the marketplace template must determine the final pixel canvas. Do not invent dimensions.

{markdown_table(data['output_profiles'], (("ID", "id"), ("Products", "products"), ("Aspect", "aspect_ratio"), ("Format", "file_format"), ("DPI", "dpi"), ("Alpha preferred", "alpha_preferred"), ("Safe zone", "safe_zone"), ("Bleed", "bleed"), ("Template required", "marketplace_template_required")))}
'''


def render_visual_system(data: dict[str, Any]) -> str:
    visual = data["visual_vocabulary"]
    return f'''# Visual System

## Contents

- [Motifs](#motifs)
- [Palettes](#palettes)
- [Typography](#typography)
- [Compositions](#compositions)
- [Style variants](#style-variants)

## Motifs

{markdown_table(visual['motifs'], (("Name", "name"), ("Meaning", "meaning"), ("Use with", "use_with"), ("Avoid with", "avoid_with")))}

## Palettes

Palette colors are foreground candidates. Recalculate them against the actual product surface before generation.

{markdown_table(visual['palettes'], (("Name", "name"), ("Colors", "colors"), ("Use when", "use_when"), ("Contrast rule", "contrast_rule")))}

## Typography

{markdown_table(visual['typography'], (("Name", "name"), ("Direction", "direction"), ("Use when", "use_when"), ("Avoid", "avoid")))}

## Compositions

{markdown_table(visual['compositions'], (("Name", "name"), ("Hierarchy", "hierarchy"), ("Use when", "use_when"), ("Avoid", "avoid")))}

## Style variants

Select between 1 and 4 variants for a request. The default is {data['output_defaults']['variant_count_default']}.

{markdown_table(data['style_variants'], (("ID", "id"), ("Label", "label"), ("Commercial role", "commercial_role"), ("Description", "description"), ("Typography", "typography"), ("Motifs", "motifs"), ("Palette options", "palette_options"), ("Avoid", "avoid")))}
'''


def render_copy_personalization(data: dict[str, Any]) -> str:
    sample_rows = []
    for brief in data["sample_briefs"]:
        row = dict(brief)
        copy = brief["copy"]
        row["copy_rendered"] = f"{copy['mode']}: {copy['text']}"
        sample_rows.append(row)
    return f'''# Copy, Personalization, and Examples

## Contents

- [Copy modes](#copy-modes)
- [Buyer language](#buyer-language)
- [Hook patterns](#hook-patterns)
- [Personalization](#personalization)
- [Sample briefs](#sample-briefs)

## Copy modes

- `exact`: preserve user-approved wording exactly. Reject malformed image text.
- `proposed`: label wording as proposed before image generation.
- `none`: create a no-text design and omit typography instructions.

## Buyer language

{markdown_table(data['buyer_language'], (("Theme", "theme"), ("Phrases", "phrases"), ("Meaning", "meaning"), ("Use for", "use_for"), ("Avoid", "avoid")))}

## Hook patterns

{markdown_table(data['hook_patterns'], (("ID", "id"), ("Template", "template"), ("Use when", "use_when"), ("Example", "example"), ("Avoid", "avoid")))}

## Personalization

{markdown_table(data['personalization_fields'], (("Key", "key"), ("Label", "label"), ("Example", "example"), ("Validation", "validation"), ("Products", "products")))}

## Sample briefs

{markdown_table(sample_rows, (("ID", "id"), ("Title", "title"), ("Persona", "persona_id"), ("Pair", "buyer_recipient_pair_id"), ("Buyer", "buyer"), ("Recipient", "recipient"), ("Occasion", "occasion_id"), ("Emotion", "emotion_id"), ("Style", "style_variant_id"), ("Product", "product"), ("Profile", "output_profile_id"), ("Copy", "copy_rendered"), ("Personalization", "personalization"), ("Direction", "visual_direction"), ("Why", "why_it_fits"), ("IP", "ip_notes")))}
'''


def render_market_evidence(data: dict[str, Any]) -> str:
    sources = data["data_provenance"]["sources"]
    return f'''# Market Context and Evidence

## Market contexts

These records constrain language, claims, units, and output assumptions. A stale context is not current demand evidence.

{markdown_table(data['market_contexts'], (("ID", "id"), ("Marketplace", "marketplace"), ("Locale", "locale"), ("Region", "region"), ("Units", "measurement_system"), ("Restricted claims", "restricted_claims"), ("Output notes", "output_notes"), ("Review by", "review_by")))}

## Evidence claims

`hypothesis` is a labeled assumption. `supported` or `validated` must retain source references. Re-check any expired `review_by` before describing it as current or demand-backed.

{markdown_table(data['evidence_claims'], (("ID", "id"), ("Type", "claim_type"), ("Statement", "statement"), ("Status", "status"), ("Confidence", "confidence"), ("Sources", "source_ids"), ("Markets", "market_context_ids"), ("Review by", "review_by")))}

## Source register

{markdown_table(sources, (("ID", "id"), ("Type", "type"), ("Note", "note"), ("URL", "url"), ("Retrieved", "retrieved_at"), ("Supports", "supports")))}
'''


def render_idea_archetypes(data: dict[str, Any]) -> str:
    controls = data["creative_controls"]
    return f'''# Idea Archetypes and Creative Gates

## Idea archetypes

An archetype defines purchase logic and compatible records. It is not a generic style label.

{markdown_table(data['idea_archetypes'], (("ID", "id"), ("Label", "label"), ("Purchase logic", "purchase_logic"), ("Personas", "persona_ids"), ("Occasions", "occasion_ids"), ("Products", "product_names"), ("Hooks", "hook_ids"), ("Variation axes", "required_variation_axes"), ("Avoid", "avoid")))}

## Variation and anti-generic controls

- Available axes: {', '.join(controls['required_variation_axes'])}
- Minimum changed axes between variants: {controls['minimum_distinct_axes_per_variant']}
- Anti-generic phrase fragments: {', '.join(controls['anti_generic_phrases'])}

Run `scripts/resolve_design_brief.py`; prose-only compliance is not sufficient.

## Combination rules

{markdown_table(data['combination_rules'], (("ID", "id"), ("Personas", "persona_ids"), ("Occasions", "occasion_ids"), ("Products", "product_names"), ("Styles", "style_variant_ids"), ("Archetypes", "idea_archetype_ids"), ("Outcome", "outcome"), ("Reason", "reason")))}
'''


def render_production_sensitivity(data: dict[str, Any]) -> str:
    return f'''# Production Methods and Sensitivity Rules

## Production methods

These values are conservative baseline constraints. A provider template can tighten them; uncertainty never relaxes them silently.

{markdown_table(data['production_methods'], (("ID", "id"), ("Label", "label"), ("Process", "process"), ("Products", "products"), ("Min stroke mm", "minimum_stroke_mm"), ("Min gap mm", "minimum_gap_mm"), ("Min text mm", "minimum_text_height_mm"), ("Max colors", "max_colors"), ("Distress", "distress_allowed"), ("Halftones", "halftones_allowed"), ("Template", "template_required"), ("Uncertainty", "uncertainty")))}

## Sensitivity actions

- `refuse`: stop the brief.
- `constrain`: carry mandatory constraints into production.
- `human-review`: stop production-ready claims until reviewed.

{markdown_table(data['sensitivity_rules'], (("ID", "id"), ("Triggers", "trigger_terms"), ("Personas", "persona_ids"), ("Occasions", "occasion_ids"), ("Action", "action"), ("Constraints", "constraints"), ("Rationale", "rationale")))}
'''


def render_design_brief_contract(data: dict[str, Any]) -> str:
    return f'''# Executable Design-Brief Contract

Resolve every production request before prompting or generating:

```bash
python scripts/resolve_design_brief.py --request request.json --output receipt.json
```

The request must bind market context, persona, buyer-recipient pair, occasion, emotion, product, production method, output profile, idea archetype, hook, 1-4 style IDs, copy mode, personalization, product surface, and the exact image runtime capability evidence.

A successful receipt binds all of those records to master-data SHA-256, enforces anti-generic and forbidden-combination gates, applies sensitivity behavior, verifies product/method/profile closure, records variant distinctness, and embeds the transparency route. Validate its shape against `references/design-brief.schema.json`.

Do not generate after a resolver error. A `human-review` sensitivity status blocks production-ready labeling. A `constrained` status makes every returned constraint mandatory.

The final-output invariant remains `transparent-png-alpha-qa-pass`; a design-brief receipt never substitutes for materialized-file alpha QA.
'''


def render_idea_engine_workflow(data: dict[str, Any]) -> str:
    return f'''# Idea Engine Workflow

## 1. Parse the request

Extract or infer market context, persona, buyer-recipient pair, occasion, primary emotion, idea archetype, product, product surface, copy mode, personalization, hook, requested styles/variant count, and the exact image runtime capability evidence.

Ask only when a missing value changes buyer logic, production method/profile, sensitivity, IP, contrast, or alpha routing. For an unknown product color, record `unknown` and use dual-tone protection.

## 2. Resolve the executable brief

Create a request JSON and run:

```bash
python scripts/resolve_design_brief.py --request request.json --output receipt.json
```

Stop on any error. The receipt must bind market, buyer system, archetype, hook, styles, copy, personalization, product, production method, output profile, sensitivity result, and alpha route. Use `select_records.py` only for extra inspection; never bypass the receipt.

## 3. State the purchase hypothesis and evidence

> I believe [buyer] will buy [product] for [recipient] during [occasion] because of [emotion], when the design expresses [archetype/hook] through [visual direction or personalization].

Record claim status, confidence, market context, and stale assumptions. `curated-draft` and expired claims are hypotheses, not demand proof.

## 4. Run independent gates

- Score five concept-fit criteria out of 25 with confidence and assumptions.
- Run IP blockers separately; any hard blocker stops production.
- Apply receipt sensitivity: `refuse` stops, `constrain` becomes mandatory, and `human-review` blocks production-ready labeling.
- Keep any `review` combination rule visible in the receipt.

## 5. Resolve copy and variation

- `exact`: preserve approved wording.
- `proposed`: label the wording before production.
- `none`: remove every text and pseudo-text instruction.

The resolver rejects restricted and anti-generic phrases. Generate only the requested 1-4 variants. Keep purchase logic fixed while meeting the receipt's distinct creative axes.

## 6. Resolve production and contrast

Use the receipt's product, production method, and output profile. Enforce minimum stroke `{min(item['minimum_stroke_mm'] for item in data['production_methods'])}` mm or the stricter selected-method value, minimum gap/text height, color limit, substrate/ink notes, and template requirement.

- dark product -> light artwork;
- light product -> dark artwork;
- mid/unknown -> high-contrast dual tone or outline.

Target at least {data['qa_rules']['minimum_contrast_ratio']}:1 for important text and shapes when exact colors are known.

## 7. Follow the receipt alpha route

- `supported`: native transparent option, PNG, strict alpha QA; failed output rerenders transparent and never falls back.
- `unknown`: probe transparent output; fallback only after all configured probes fail.
- `unsupported`: approved temporary flat canvas, edge-connected removal, and the same final alpha QA.

Deliver only `transparent-png-alpha-qa-pass`; otherwise return a typed failure.

## 8. Generate and QA

For each variant record style, changed axes, foreground palette, product surface, method/profile, production prompt, alpha route/attempt, sensitivity/IP status, and QA result. Regenerate, reprocess, or stop rather than calling a failed output production-ready.
'''


def render_concept_fit_and_ip_gate(data: dict[str, Any]) -> str:
    calibration = data["concept_fit_calibration"]
    ip = data["ip_safety"]
    return f'''# Concept-Fit Heuristic and IP Gate

## Concept-fit heuristic

Score each commercial criterion from 1 to 5. This is an internal comparison aid, not a sales forecast.

| Criterion | 1 = weak | 3 = acceptable | 5 = strong |
|---|---|---|---|
| Fast clarity | Niche and message are unclear | Niche is visible but broad | Persona and purpose are clear in 1-2 seconds |
| Giftability | No buyer, recipient, or trigger | Partial gift logic | Buyer, recipient, and occasion are explicit |
| Emotional pull | Decorative only | A mood is present | One emotional job drives the concept |
| Differentiation | Generic | One specific element | Persona + occasion + hook or personalization create a clear angle |
| Series potential | One-off | A few extensions exist | Purchase logic can expand across controlled dimensions |

### Decision thresholds

- `{calibration['go_score']}-25`: Go.
- `{calibration['refine_score']}-{calibration['go_score'] - 1}`: Refine.
- `{calibration['rework_score']}-{calibration['refine_score'] - 1}`: Rework.
- `0-{calibration['replace_score']}`: Replace.

Always report:

- score and decision;
- confidence: low / medium / high;
- evidence basis: `{data['data_provenance']['evidence_status']}`;
- assumptions that could change the result.

### High-fit signals

{markdown_list(calibration['high_fit_signals'])}

### Weak-fit signals

{markdown_list(calibration['weak_fit_signals'])}

## Separate IP gate

Do not add IP safety as a scored fit criterion. Record one status:

- `screened-no-identified-blocker`;
- `replacement-required`;
- `human-review-required`.

Any copied logo, official seal, licensed character, distinctive source layout, lyric, celebrity likeness, protected organization mark, or unverified trademark phrase is a hard blocker until replaced or reviewed.

### Niche-specific avoid list

{markdown_list(ip['niche_specific_avoid'])}

### Safe substitutions

{markdown_table(ip['safe_substitutions'], (("Risky element", "risky"), ("Replace with", "replace_with")))}

### Human-review triggers

{markdown_list(ip['human_review_triggers'])}

This process reduces risk. It is not legal clearance.
'''


def render_transparency_capability_policy(data: dict[str, Any]) -> str:
    background = data["output_defaults"]["background"]
    qa = data["qa_rules"]
    return f'''# Transparency Capability Policy

## Final-output invariant

The production deliverable must be a PNG with meaningful real alpha. A preview that looks dark, white, gray, or checkerboard-like is not evidence either way. Materialize the actual file and inspect its alpha channel.

## Classify the active runtime

Use exactly one status before generation:

- `supported`: the active tool exposes a native transparency control, current provider metadata explicitly advertises alpha/transparent output, or a prior output from this exact runtime passed strict alpha QA.
- `unknown`: transparency is plausible but unverified. A model name, prompt claim, `.png` extension, or RGB preview alone does not prove alpha support.
- `unsupported`: the active provider/tool explicitly lacks transparent output, rejects the native transparent option, or failed the configured probes in this runtime.

Examples are capability hints, not permanent name-based guarantees:

- For GPT Image 2 / ChatGPT Images 2.0, treat the runtime as `supported` when the interface exposes `background=transparent`, `transparent_background=true`, or an equivalent native control.
- For any Seedream 5.x or Grok Imagine image runtime, use `supported` only when that specific provider/tool advertises alpha or has passed alpha QA. Do not infer alpha support merely because it can return PNG.

## Mandatory state machine

Run the decision helper before and after each transparent attempt:

```bash
python scripts/resolve_transparency_route.py \\
  --provider "OpenAI" \\
  --model "ChatGPT Images 2.0" \\
  --capability supported \\
  --evidence native-control \\
  --alpha-qa fail \\
  --attempt 1 \\
  --max-transparent-attempts {background['max_transparent_attempts']} \\
  --unknown-probe-attempts {background['unknown_probe_attempts']}
```

Rules:

1. `supported` + failed alpha QA -> rerender transparent. Do this for at most {background['max_transparent_attempts']} completed attempts.
2. `supported` + final failed attempt -> hard-fail. Never use solid fallback.
3. `unknown` -> probe transparent for up to {background['unknown_probe_attempts']} attempts.
4. `unknown` + passing alpha QA -> promote to `supported` for the current runtime.
5. `unknown` + repeated failed probes -> transparency is unavailable for this runtime; allow temporary solid fallback.
6. `unsupported` -> allow temporary solid fallback immediately.
7. Any fallback result must be removed and must pass the same final alpha QA. The solid-color source is not a production deliverable.

## Native controls and prompts

When a native transparent control exists, set it explicitly in addition to the transparent prompt. Never rely on prompt wording alone when the API has a dedicated parameter. Request PNG rather than JPEG.

## Strict alpha QA

Run:

```bash
python scripts/verify_png_alpha.py output.png \\
  --minimum-fully-transparent-ratio {qa['minimum_fully_transparent_ratio']} \\
  --minimum-transparent-border-ratio {qa['minimum_transparent_border_ratio']} \\
  --minimum-visible-ratio {qa['minimum_visible_ratio']} \\
  --maximum-significant-visible-ratio {qa['maximum_significant_visible_ratio']} \\
  --maximum-significant-bbox-fill-ratio {qa['maximum_significant_bbox_fill_ratio']} \\
  --minimum-significant-margin-ratio {qa['minimum_significant_margin_ratio']} \\
  --significant-alpha-threshold {qa['significant_alpha_threshold']}
```

A pass requires:

- a real PNG alpha channel or indexed transparency;
- enough fully transparent canvas area;
- enough visible artwork to reject an empty transparent file;
- visible coverage below the full-canvas threshold;
- an alpha-mask bounding-box fill ratio that does not resemble an inset opaque panel;
- transparent outer borders;
- significant artwork clear of the canvas edge;
- no opaque painted checkerboard or solid rectangle masquerading as transparency.

If the output file cannot be materialized and inspected, mark alpha QA `unverified` and do not call it production-ready.
'''


def render_background_and_contrast(data: dict[str, Any]) -> str:
    safe = data["output_defaults"]["background"]["safe_palette"]
    contrast = data["output_defaults"]["product_contrast"]
    qa = data["qa_rules"]
    return f'''# Transparent Background and Smart Contrast

Read `transparency-capability-policy.md` first. It decides whether the run must rerender transparent or may use a temporary flat canvas.

## Separate two different backgrounds

1. **Product surface**: the garment or product color on which the artwork will be printed. Foreground colors must contrast with this surface.
2. **Generation canvas**: real transparent alpha for supported models; otherwise one temporary flat color used only for automated removal.

Never choose artwork colors only because they contrast with the temporary canvas. They must remain readable on the actual product.

## Transparent route

For a `supported` runtime:

- set the native transparent option when available;
- request PNG with isolated artwork only;
- prohibit mockups, product photos, rooms, floors, walls, scenes, borders, shadows, glow, lighting, haze, vignette, halos, and painted checkerboards;
- materialize the file and run strict alpha QA;
- rerender transparent after a failed check;
- never downgrade to a solid background after a supported-model failure.

For an `unknown` runtime, run the configured transparent probes before considering fallback.

## Safe flat fallback (confirmed unavailable only)

Use this route only when transparency is explicitly unsupported or repeated probes establish that it is unavailable in the current runtime.

Approved colors only:

{markdown_list(safe)}

Do not use green chroma key, neon colors, gradients, textured backgrounds, lighting, shadows, glow, haze, or vignette.

### Selection sequence

1. Finalize the artwork palette for the product surface.
2. Pass the foreground colors to:

```bash
python scripts/select_background.py \\
  --artwork-colors "#F5F5F5,#FFD166,#EF476F" \\
  --product-color "#111111"
```

3. Select the safe color with the largest minimum CIE Lab distance from all foreground colors. Use contrast ratio only as a secondary tie-breaker.
4. Insert this exact instruction in the image prompt:

> MANDATORY FLAT SOLID COLOR. NO SHADOWS. Use one uniform [SELECTED HEX] background from edge to edge. No gradient, texture, glow, haze, vignette, lighting, floor, wall, horizon, object shadow, or semitransparent spill.

5. Remove only the edge-connected flat background and run strict alpha QA:

```bash
python scripts/remove_flat_background.py input.png output.png --background "#SELECTED" --tolerance 18
python scripts/verify_png_alpha.py output.png \\
  --minimum-fully-transparent-ratio {qa['minimum_fully_transparent_ratio']} \\
  --minimum-transparent-border-ratio {qa['minimum_transparent_border_ratio']} \\
  --minimum-visible-ratio {qa['minimum_visible_ratio']} \\
  --maximum-significant-visible-ratio {qa['maximum_significant_visible_ratio']} \\
  --maximum-significant-bbox-fill-ratio {qa['maximum_significant_bbox_fill_ratio']} \\
  --minimum-significant-margin-ratio {qa['minimum_significant_margin_ratio']} \\
  --significant-alpha-threshold {qa['significant_alpha_threshold']}
```

The removal script flood-fills from canvas edges so an interior matching color is not automatically erased unless it connects to the background. If removal damages the art or alpha QA fails, regenerate the flat source or adjust removal settings; never deliver the solid canvas as the final asset.

## Product-surface contrast

| Product surface | Foreground direction | Practical rule |
|---|---|---|
| Dark, e.g. black shirt | Light artwork | Favor white, cream, yellow, light cyan, light pink, or other high-luminance niche colors; avoid large dark fills without a light outline. |
| Light, e.g. white shirt | Dark artwork | Favor black, charcoal, navy, deep burgundy, or other low-luminance niche colors; avoid pale text without a dark outline. |
| Mid-tone | Dual-tone or outline | Use a light/dark pair, knockout, or robust outline. |
| Unknown | Obtain color or protect both ways | Request the product color when material; otherwise use a dual-tone system and state the assumption. |

Target at least `{contrast['minimum_contrast_ratio']}:1` for important text and shapes when exact colors are known. This is a visibility heuristic; print method, ink, fabric, and halftones may require stronger contrast.

## Failure conditions

Regenerate, reprocess, or hard-fail when any of these occurs:

- no real transparent pixels;
- an empty all-transparent file;
- an opaque checkerboard or fake alpha;
- significant artwork touches a canvas edge;
- semitransparent spill remains around edges;
- a supported runtime fails alpha QA and has not exhausted its transparent rerenders;
- fallback is selected without explicit unsupported status or failed probes;
- fallback contains shadows or tonal variation;
- fallback color appears inside the artwork and connects to the edge;
- foreground loses contrast on the selected product surface;
- background removal damages fine details.

This workflow maximizes automation reliability but does not justify a universal 99% guarantee across every image, style, and print method.
'''

def render_generation_execution(data: dict[str, Any]) -> str:
    background = data["output_defaults"]["background"]
    return f'''# Generation Execution

## Direct image generation

When the user asks to create, generate, draw, design, render, visualize, make, or redesign POD artwork and an image tool is available:

1. Build the request JSON and run `scripts/resolve_design_brief.py`; stop on any resolver error.
2. Treat the binding receipt as authoritative for market, archetype, product/method/profile, copy, sensitivity, variants, and alpha route.
3. Generate the requested `variant_count` from 1 to 4; default {data['output_defaults']['variant_count_default']}.
4. Classify the active image runtime as `supported`, `unknown`, or `unsupported` for real alpha. Read `transparency-capability-policy.md` and use `scripts/resolve_transparency_route.py`.
5. If `supported`, set the native transparent option when exposed and request isolated PNG alpha. Materialize the file and run strict alpha QA.
6. If supported-model alpha QA fails, rerender transparent. Do not use a solid fallback. Stop after {background['max_transparent_attempts']} failed transparent attempts and report a hard failure rather than presenting an opaque file.
7. If `unknown`, probe transparent output for up to {background['unknown_probe_attempts']} attempts. Promote the runtime to `supported` after any alpha-QA pass.
8. Use the temporary safe-solid route only when the runtime is explicitly `unsupported` or the unknown probes establish transparency is unavailable. Remove the flat color and run the same strict alpha QA.
9. Inspect exact text, composition, product contrast, production constraints, sensitivity, actual alpha, safe margins, and printability.
10. Deliver only a transparent PNG that passes QA. A solid-source file may be retained as an intermediate diagnostic artifact but is not the final design.

Do not generate four images when the user explicitly requests one.

## Capability decision examples

```bash
# Before the first call on a runtime with a native transparent option
python scripts/resolve_transparency_route.py \\
  --provider "OpenAI" --model "ChatGPT Images 2.0" \\
  --capability supported --evidence native-control \\
  --alpha-qa not-run --attempt 0 \\
  --max-transparent-attempts {background['max_transparent_attempts']} \\
  --unknown-probe-attempts {background['unknown_probe_attempts']}

# After the first supported-runtime output fails alpha QA
python scripts/resolve_transparency_route.py \\
  --provider "OpenAI" --model "ChatGPT Images 2.0" \\
  --capability supported --evidence native-control \\
  --alpha-qa fail --attempt 1 \\
  --max-transparent-attempts {background['max_transparent_attempts']} \\
  --unknown-probe-attempts {background['unknown_probe_attempts']}

# Before probing a runtime whose alpha capability is not documented
python scripts/resolve_transparency_route.py \\
  --provider "Example Provider" --model "Exact Image Model Alias" \\
  --capability unknown --evidence unverified \\
  --alpha-qa not-run --attempt 0 \\
  --max-transparent-attempts {background['max_transparent_attempts']} \\
  --unknown-probe-attempts {background['unknown_probe_attempts']}

# After the configured unknown-runtime probes fail
python scripts/resolve_transparency_route.py \\
  --provider "Example Provider" --model "Exact Image Model Alias" \\
  --capability unknown --evidence unverified \\
  --alpha-qa fail --attempt {background['unknown_probe_attempts']} \\
  --max-transparent-attempts {background['max_transparent_attempts']} \\
  --unknown-probe-attempts {background['unknown_probe_attempts']}
```

## Prompt-only mode

Use only when the user asks for prompts/templates, asks not to generate, or no image tool is available. Return:

1. Executable binding receipt and data/request hashes.
2. Market, idea-archetype, product, production-method, output-profile, surface, and contrast plan.
3. Copy mode and approved/proposed/no-text status.
4. Concept-fit score, confidence, evidence status, and assumptions.
5. Separate IP and sensitivity statuses, constraints, and replacements.
6. Numeric production limits and unresolved provider-template uncertainty.
7. Transparency capability classification, evidence, retry policy, and fallback eligibility.
8. One complete prompt per requested variant with changed creative axes.

## Reference-image redesign

- Use only an image actually present in the current conversation.
- Ask for the image when absent; never invent its contents.
- Preserve only broad buyer intent and niche hook.
- Replace hierarchy, layout, typography, icon set, illustration, border, badge, and decorative treatment.
- Remove logos, watermarks, official marks, characters, copied slogans, and distinctive source trade dress.

## Text handling

- `exact`: preserve approved text in planning and reject malformed image text.
- `proposed`: label the wording before generation.
- `none`: omit all typography instructions.

For high-stakes exact text, prefer generating the illustration without text and composing typography deterministically in SVG, Canvas, or another layout tool when available.

## After generation

Run `references/qa-checklist.md`. Regenerate, reprocess, or hard-fail a failed output rather than presenting it as print-ready.
'''

def render_prompt_templates(data: dict[str, Any]) -> str:
    status = _data_status(data)
    return f'''# Prompt Templates

Use these internally or in explicit prompt-only mode. Remove branches that do not apply.

## Grounded brief

```markdown
### Master-data binding
- market_context_id:
- persona_id:
- buyer_recipient_pair_id:
- buyer:
- recipient:
- occasion_id:
- emotion_id:
- idea_archetype_id:
- product:
- product surface tone / HEX:
- production_method_id:
- output_profile_id:
- hook_pattern_id:
- style_variant_id:
- changed creative axes:
- personalization keys:
- variant_count: 1-4
- data status: {status}

### Copy
- mode: exact / proposed / none
- text:
- language:

### Commercial hypothesis
I believe [buyer] will buy [product] for [recipient] during [occasion] because of [emotion], when the design expresses [hook] through [visual direction or personalization].

### Concept fit
- score: /25
- decision: Go / Refine / Rework / Replace
- confidence: low / medium / high
- evidence basis: {data['data_provenance']['evidence_status']}
- assumptions:

### IP gate
- status: screened-no-identified-blocker / replacement-required / human-review-required
- replacements:

### Sensitivity and production
- sensitivity status: clear / constrained / human-review
- mandatory constraints:
- minimum stroke / gap / text height mm:
- max colors:
- provider template required: yes / no

### Transparency route
- active model/tool:
- capability: supported / unknown / unsupported
- capability evidence: native option / provider metadata / prior alpha-QA pass / probe result
- transparent attempt number:
- solid fallback eligible: yes only after confirmed unavailable / no
```

## Shared artwork prompt

```text
Create an original print-on-demand artwork for [persona], purchased by [buyer] for [recipient] during [occasion]. Primary emotion: [emotion]. Purchase archetype: [idea archetype]. Product: [product] using [production method] in [product surface HEX or tone]. Use [style variant], [typography], [composition], and original [niche motifs]. Apply foreground colors [palette HEX values] selected to contrast with the product. Enforce receipt limits for stroke, gap, text height, colors, sensitivity, and safe zone. Keep one focal point, closed silhouettes, and thumbnail readability. Include only approved personalization.

[COPY BRANCH]
- exact: Typeset exactly this approved text: "[text]". Do not add, remove, paraphrase, or misspell any character.
- proposed: Typeset this labeled proposed copy: "[text]".
- none: No words, letters, numerals, glyphs, labels, signatures, or pseudo-text anywhere in the artwork.
```

## Transparent route (mandatory for supported runtimes)

```text
Return isolated artwork as a PNG with genuine alpha transparency. Keep every pixel outside the intended artwork transparent. Do not paint a checkerboard, white/black rectangle, vignette, halo, or other backdrop into RGB pixels. No mockup, product photo, person, room, floor, wall, scene, border, gradient, texture, canvas shadow, glow, lighting, haze, vignette, watermark, or extra background object. Preserve a clear transparent margin around significant artwork.
```

When the tool exposes a native control, also set `background=transparent`, `transparent_background=true`, or the provider-equivalent parameter and request PNG. A supported runtime that fails alpha QA must receive this transparent route again; do not switch it to the fallback prompt.

## Flat fallback route (confirmed unavailable only)

```text
MANDATORY FLAT SOLID COLOR. NO SHADOWS. Place the isolated artwork on one perfectly uniform [SAFE BACKGROUND HEX] background from edge to edge. Use no other background color. No gradient, texture, glow, haze, vignette, lighting, floor, wall, horizon, object shadow, semitransparent spill, checkerboard, fake transparency, mockup, product photo, person, room scene, watermark, or extra background element. Keep [SAFE BACKGROUND HEX] out of the foreground artwork.
```

Choose `[SAFE BACKGROUND HEX]` from `{', '.join(SAFE_BACKGROUND_PALETTE)}` only after the artwork palette is known and only when the runtime is explicitly unsupported or configured probes have established that transparency is unavailable. Remove this flat background and verify the final alpha before delivery.

## Redesign addition

```text
Use the reference only to understand broad buyer intent and niche hook. Build a new hierarchy, composition, typography system, icon set, illustration, and decorative treatment. Do not reproduce distinctive source artwork, layout, logo, badge, watermark, character, slogan, or trade dress.
```

## Per-variant record

For each requested variant, retain:

1. style variant and commercial role;
2. changed creative axes;
3. foreground palette and product-contrast note;
4. production method and output profile;
5. sensitivity/IP status and mandatory constraints;
6. capability classification, evidence, attempt, route, and eligible fallback color;
7. production prompt and variant-specific avoid list;
8. QA outcome.
'''


def render_qa_checklist(data: dict[str, Any]) -> str:
    qa = data["qa_rules"]
    background = data["output_defaults"]["background"]
    return f'''# POD QA Checklist

## Grounding

- Binding receipt hashes the request and canonical data.
- Market, persona, pair, recipient, occasion, emotion, archetype, product, production method, output profile, hook, and style IDs resolve.
- Product, method, and profile agree bidirectionally.
- Anti-generic and forbidden-combination gates passed.
- Concept-fit decision is Go, with confidence and evidence basis stated.
- IP status has no unresolved hard blocker.
- Variant count matches the request and stays between 1 and 4.
- Each variant meets the configured distinct-axis requirement.

## Copy

- Copy mode is `exact`, `proposed`, or `none`.
- Exact approved text is preserved; proposed copy is labeled; no-text art contains no pseudo-text.
- Spelling, punctuation, and personalization are correct.
- Main text satisfies: {qa['min_text_legibility']}
- Word count fits the selected product.

## Product contrast

- Product surface color or tone is recorded.
- Dark product -> foreground is predominantly light.
- Light product -> foreground is predominantly dark.
- Mid or unknown product -> robust dual-tone or outline system is used.
- Important text and shapes target at least {qa['minimum_contrast_ratio']}:1 when exact colors are known.
- Color count does not exceed {qa['max_colors']} unless explicitly approved.

## Production and sensitivity

- Minimum stroke, gap, and text height meet the selected production method.
- Distress, halftone, substrate, ink, and template rules are honored.
- Provider uncertainty is recorded instead of invented away.
- `refuse` rules stopped before generation.
- Every `constrain` result appears in the prompt and QA.
- `human-review` blocks production-ready labeling.

## Capability and route gate

- Active provider, model/tool, endpoint or interface, and capability evidence are recorded.
- `supported` is used only when a native transparent control, explicit provider metadata, or a prior strict alpha-QA pass from the same runtime proves support.
- `unknown` runtimes are probed for transparent output up to {background['unknown_probe_attempts']} attempts before fallback becomes eligible.
- `unsupported` is used only after an explicit provider/tool limitation, rejection of the transparent control, or failed configured probes.
- A supported runtime never switches to a solid canvas after failed alpha QA.
- Supported-runtime alpha failure triggers transparent rerender, up to {background['max_transparent_attempts']} completed attempts.
- Exhausted supported-runtime attempts cause a hard failure; no opaque or solid-background substitute is delivered.

## Mandatory final alpha QA

Run the verifier against the materialized final PNG, not the UI preview:

```bash
python scripts/verify_png_alpha.py output.png \\
  --minimum-fully-transparent-ratio {qa['minimum_fully_transparent_ratio']} \\
  --minimum-transparent-border-ratio {qa['minimum_transparent_border_ratio']} \\
  --minimum-visible-ratio {qa['minimum_visible_ratio']} \\
  --maximum-significant-visible-ratio {qa['maximum_significant_visible_ratio']} \\
  --maximum-significant-bbox-fill-ratio {qa['maximum_significant_bbox_fill_ratio']} \\
  --minimum-significant-margin-ratio {qa['minimum_significant_margin_ratio']} \\
  --significant-alpha-threshold {qa['significant_alpha_threshold']}
```

A pass requires all of the following:

- File is PNG with a real alpha channel or indexed transparency.
- Fully transparent pixel ratio is at least {qa['minimum_fully_transparent_ratio']}.
- Transparent outer-border ratio is at least {qa['minimum_transparent_border_ratio']}.
- Visible-artwork ratio is at least {qa['minimum_visible_ratio']}, so an empty transparent file cannot pass.
- Significant visible coverage is at most {qa['maximum_significant_visible_ratio']}, rejecting near-full-canvas opaque backgrounds.
- Significant alpha-mask fill inside its bounding box is at most {qa['maximum_significant_bbox_fill_ratio']}, rejecting inset rectangular panels.
- Significant artwork maintains at least {qa['minimum_significant_margin_ratio']} margin from every canvas edge.
- Canvas outside the intended artwork is actually transparent.
- No opaque checkerboard, white/black rectangle, fake transparency, shadow, glow, haze, vignette, or lighting remains.
- Transparent edge pixels have no visible spill that would contaminate printing.
- The QA result and failure reasons are recorded per variant.

A preview that appears gray, black, white, or checkerboard is not evidence of failure. Pixel inspection of the materialized file is authoritative.

## Temporary fallback route

- Fallback was selected only because the runtime was explicitly unsupported or configured unknown-runtime probes established unavailability.
- The source background is exactly one of `{', '.join(SAFE_BACKGROUND_PALETTE)}`.
- The source background is perfectly flat and uniform.
- Prompt included `MANDATORY FLAT SOLID COLOR. NO SHADOWS.`
- No green chroma key or neon background was used.
- Selected background maximizes distance from the foreground palette.
- Edge-connected removal preserved artwork.
- The final post-removal PNG passes the same mandatory alpha QA above.
- The temporary solid-color source is never returned as the production deliverable.

## Artwork and print

- One clear focal point leads the hierarchy.
- Motifs are niche-relevant and original.
- Thin lines, micro-details, accidental edge cropping, mockups, and scenes are absent.
- Safe zone and product profile are respected.
- Marketplace dimensions and bleed were confirmed rather than invented when required.

## Safety

- No copied composition, logo, official badge, watermark, licensed character, lyric, celebrity, or protected organization mark appears.
- Human-review triggers are escalated.
- Output is described as screened, not legally cleared.

Fail the variant when any required check is missing. Rerender transparent for a supported runtime, continue probing an unknown runtime, or reprocess an eligible fallback. Never label an unverified or failed-alpha file production-ready.
'''


def render_agent_yaml(data: dict[str, Any]) -> str:
    display = data["niche_display"]
    skill_name = f"{data['niche_slug']}-pod-design-agent"
    short = f"Creates contrast-safe {display} POD artwork"
    if len(short) > 64:
        short = f"Creates {display} POD artwork"[:64].rstrip()
    default_prompt = (
        f"Use ${skill_name} to create a transparent-background POD design with product-aware contrast."
    )
    return "\n".join(
        [
            "interface:",
            f"  display_name: {yaml_string(f'{display} POD Design Agent')}",
            f"  short_description: {yaml_string(short)}",
            f"  brand_color: {yaml_string('#334155')}",
            f"  default_prompt: {yaml_string(default_prompt)}",
            "",
        ]
    )


def _generated_at_utc() -> str:
    source_epoch = os.environ.get("SOURCE_DATE_EPOCH")
    if source_epoch is not None:
        try:
            epoch = int(source_epoch)
        except ValueError as exc:
            raise ValueError("SOURCE_DATE_EPOCH must be an integer Unix timestamp") from exc
        if epoch < 0:
            raise ValueError("SOURCE_DATE_EPOCH must not be negative")
        instant = datetime.fromtimestamp(epoch, tz=timezone.utc)
    else:
        instant = datetime.now(timezone.utc)
    return instant.replace(microsecond=0).isoformat()


def render_manifest(
    data: dict[str, Any], content_sha256: dict[str, str]
) -> dict[str, Any]:
    return {
        "generator_id": GENERATOR_ID,
        "generator_version": GENERATOR_VERSION,
        "schema_version": SCHEMA_VERSION,
        "niche_slug": data["niche_slug"],
        "data_sha256": sha256_json(data),
        "generated_at_utc": _generated_at_utc(),
        "content_sha256": dict(sorted(content_sha256.items())),
    }


def write_target_skill(data: dict[str, Any], skill_dir: Path, assets_root: Path) -> None:
    niche = data["niche_slug"]
    references = skill_dir / "references"
    scripts = skill_dir / "scripts"
    agents = skill_dir / "agents"
    references.mkdir(parents=True, exist_ok=True)
    scripts.mkdir(parents=True, exist_ok=True)
    agents.mkdir(parents=True, exist_ok=True)

    write_text(skill_dir / "SKILL.md", render_target_skill_md(data))
    write_text(agents / "openai.yaml", render_agent_yaml(data))
    write_text(
        references / f"{niche}-master-data.json",
        json.dumps(data, indent=2, ensure_ascii=False),
    )
    write_text(references / "master-data-index.md", render_master_data_index(data))
    write_text(references / "personas.md", render_personas(data))
    write_text(references / "occasions-products.md", render_occasions_products(data))
    write_text(references / "visual-system.md", render_visual_system(data))
    write_text(
        references / "copy-personalization.md", render_copy_personalization(data)
    )
    write_text(references / "market-evidence.md", render_market_evidence(data))
    write_text(references / "idea-archetypes.md", render_idea_archetypes(data))
    write_text(
        references / "production-sensitivity.md",
        render_production_sensitivity(data),
    )
    write_text(
        references / "design-brief-contract.md", render_design_brief_contract(data)
    )
    write_text(
        references / "idea-engine-workflow.md", render_idea_engine_workflow(data)
    )
    write_text(
        references / "concept-fit-and-ip-gate.md",
        render_concept_fit_and_ip_gate(data),
    )
    write_text(
        references / "transparency-capability-policy.md",
        render_transparency_capability_policy(data),
    )
    write_text(
        references / "background-and-contrast.md",
        render_background_and_contrast(data),
    )
    write_text(
        references / "generation-execution.md", render_generation_execution(data)
    )
    write_text(references / "prompt-templates.md", render_prompt_templates(data))
    write_text(references / "qa-checklist.md", render_qa_checklist(data))

    for source in sorted(assets_root.glob("*.py")):
        shutil.copy2(source, scripts / source.name)

    reference_assets = assets_root.parent / "target-references"
    if reference_assets.is_dir():
        for source in sorted(reference_assets.glob("*")):
            if source.is_file():
                shutil.copy2(source, references / source.name)

    content_sha256: dict[str, str] = {}
    for path in sorted(skill_dir.rglob("*")):
        if path.is_file() and path.name != "manifest.json":
            relative = path.relative_to(skill_dir).as_posix()
            content_sha256[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
    write_text(
        skill_dir / "manifest.json",
        json.dumps(
            render_manifest(data, content_sha256),
            indent=2,
            ensure_ascii=False,
            sort_keys=True,
        ),
    )
