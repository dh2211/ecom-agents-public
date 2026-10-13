"""Schema migration for POD niche master data."""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Any

from .constants import (
    COPY_MODES,
    LEGACY_SCHEMA_VERSION,
    OLDER_SCHEMA_VERSION,
    PREVIOUS_SCHEMA_VERSION,
    SAFE_BACKGROUND_PALETTE,
    SCHEMA_VERSION,
)
from .utils import deep_copy_json, slugify, titleize


def profile_id_for_product(product: str) -> str:
    value = product.strip().lower()
    if "mug" in value or "tumbler" in value:
        return "drinkware-wrap"
    if "ornament" in value or "sticker" in value or "coaster" in value:
        return "keepsake-square"
    if "poster" in value or "canvas" in value or "print" in value:
        return "wall-art-portrait"
    if "blanket" in value or "flag" in value:
        return "large-format-portrait"
    if "tote" in value or "bag" in value:
        return "tote-portrait"
    if any(token in value for token in ("shirt", "tee", "hoodie", "sweatshirt", "apparel")):
        return "apparel-front"
    return "general-portrait"


PROFILE_TEMPLATES: dict[str, dict[str, Any]] = {
    "apparel-front": {
        "aspect_ratio": "5:6",
        "safe_zone": "Keep primary text and motifs inside the central 80% of the canvas.",
        "bleed": "Confirm the marketplace print-area template before final export.",
    },
    "tote-portrait": {
        "aspect_ratio": "4:5",
        "safe_zone": "Keep the main hierarchy inside the central 78% and away from seams.",
        "bleed": "Confirm the marketplace print-area template before final export.",
    },
    "drinkware-wrap": {
        "aspect_ratio": "2:1",
        "safe_zone": "Protect handle-adjacent margins and keep critical text in the visible center.",
        "bleed": "Use the exact printer wrap template before final export.",
    },
    "keepsake-square": {
        "aspect_ratio": "1:1",
        "safe_zone": "Keep text and faces away from cut holes, trim edges, and rounded corners.",
        "bleed": "Use the exact product template before final export.",
    },
    "large-format-portrait": {
        "aspect_ratio": "4:5",
        "safe_zone": "Keep personalization and small text inside the central 75%.",
        "bleed": "Use the exact printer template and bleed specification before final export.",
    },
    "wall-art-portrait": {
        "aspect_ratio": "2:3",
        "safe_zone": "Keep essential content inside the central 85% and allow trim-safe margins.",
        "bleed": "Use the marketplace wall-art template before final export.",
    },
    "general-portrait": {
        "aspect_ratio": "3:4",
        "safe_zone": "Keep essential content inside the central 80%.",
        "bleed": "Confirm the target product template before final export.",
    },
}


def build_output_profiles(products: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[str]] = defaultdict(list)
    for record in products:
        if not isinstance(record, dict):
            continue
        product = str(record.get("product", "")).strip()
        if not product:
            continue
        profile_id = profile_id_for_product(product)
        record["output_profile_id"] = profile_id
        grouped[profile_id].append(product)

    profiles: list[dict[str, Any]] = []
    for profile_id, product_names in grouped.items():
        template = PROFILE_TEMPLATES[profile_id]
        profiles.append(
            {
                "id": profile_id,
                "products": sorted(set(product_names)),
                "aspect_ratio": template["aspect_ratio"],
                "file_format": "PNG",
                "dpi": 300,
                "width_px": None,
                "height_px": None,
                "alpha_preferred": True,
                "safe_zone": template["safe_zone"],
                "bleed": template["bleed"],
                "marketplace_template_required": True,
            }
        )
    return sorted(profiles, key=lambda item: item["id"])


def _pair_id(buyer: str, recipient: str, used: set[str]) -> str:
    base = slugify(f"{buyer}-to-{recipient}")[:58].rstrip("-") or "buyer-recipient"
    candidate = base
    counter = 2
    while candidate in used:
        suffix = f"-{counter}"
        candidate = f"{base[:64-len(suffix)].rstrip('-')}{suffix}"
        counter += 1
    used.add(candidate)
    return candidate


def _split_palette_options(value: Any, known_names: set[str]) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    text = str(value or "").strip()
    if not text:
        return []
    if text in known_names:
        return [text]
    parts = [part.strip() for part in text.split(" or ") if part.strip()]
    matches = [part for part in parts if part in known_names]
    return matches or [text]


def default_output_defaults() -> dict[str, Any]:
    return {
        "background": {
            "preferred_mode": "transparent",
            "transparent_format": "PNG",
            "require_real_alpha": True,
            "capability_policy": "capability-gated",
            "supported_model_route": "transparent-required-no-fallback",
            "unknown_model_route": "probe-then-fallback",
            "unsupported_model_route": "flat-solid-remove-to-alpha",
            "max_transparent_attempts": 3,
            "unknown_probe_attempts": 2,
            "fallback_condition": "confirmed-transparent-unavailable-only",
            "require_native_transparency_option_when_available": True,
            "hard_fail_supported_after_attempts": True,
            "final_output_must_have_alpha": True,
            "fallback_enabled": True,
            "safe_palette": list(SAFE_BACKGROUND_PALETTE),
            "selection_method": "max-color-distance-from-artwork",
            "mandatory_prompt": "MANDATORY FLAT SOLID COLOR. NO SHADOWS.",
            "forbidden": [
                "green chroma key",
                "neon background",
                "gradient",
                "texture",
                "shadow",
                "glow",
                "vignette",
                "checkerboard",
                "fake transparency",
            ],
        },
        "product_contrast": {
            "dark_surface_use": "light",
            "light_surface_use": "dark",
            "mid_surface_use": "high-contrast-dual-tone",
            "minimum_contrast_ratio": 4.5,
            "unknown_surface_action": "request-color-or-use-dual-outline",
        },
        "variant_count_default": 4,
        "variant_count_min": 1,
        "variant_count_max": 4,
        "copy_mode_default": "proposed",
    }


def default_qa_rules(old_qa: dict[str, Any] | None = None) -> dict[str, Any]:
    old_qa = old_qa or {}
    max_colors = old_qa.get("max_colors", 7)
    return {
        "max_colors": max_colors if isinstance(max_colors, int) and not isinstance(max_colors, bool) else 7,
        "min_text_legibility": old_qa.get(
            "min_text_legibility",
            "Main phrase remains readable at a 300 px thumbnail.",
        ),
        "copy_modes": sorted(COPY_MODES),
        "alpha_validation_required": True,
        "rerender_on_alpha_failure": True,
        "fallback_on_supported_alpha_failure": False,
        "isolated_artwork": True,
        "no_shadows": True,
        "product_contrast_required": True,
        "minimum_contrast_ratio": 4.5,
        "minimum_fully_transparent_ratio": 0.01,
        "minimum_transparent_border_ratio": 0.99,
        "minimum_visible_ratio": 0.001,
        "maximum_significant_visible_ratio": 0.90,
        "maximum_significant_bbox_fill_ratio": 0.92,
        "minimum_significant_margin_ratio": 0.005,
        "significant_alpha_threshold": 8,
        "background_edge_rule": "Final delivery edges must be transparent; a solid fallback is only a temporary removal canvas.",
    }


def _merge_missing(target: dict[str, Any], defaults: dict[str, Any]) -> None:
    """Recursively add new default keys without overwriting user data."""

    for key, value in defaults.items():
        if key not in target:
            target[key] = deep_copy_json(value)
        elif isinstance(value, dict) and isinstance(target.get(key), dict):
            _merge_missing(target[key], value)


def migrate_v3_to_v3_1(
    data: dict[str, Any], requested_slug: str
) -> tuple[dict[str, Any], list[str]]:
    """Add capability-gated transparency policy and strict alpha QA to schema 3.0."""

    migrated = deep_copy_json(data)
    migrated["schema_version"] = "3.1"
    migrated.setdefault("niche_slug", slugify(requested_slug))
    migrated.setdefault("niche_display", titleize(migrated["niche_slug"]))

    output_defaults = migrated.setdefault("output_defaults", {})
    if not isinstance(output_defaults, dict):
        output_defaults = {}
        migrated["output_defaults"] = output_defaults
    _merge_missing(output_defaults, default_output_defaults())

    qa_rules = migrated.setdefault("qa_rules", {})
    if not isinstance(qa_rules, dict):
        qa_rules = {}
        migrated["qa_rules"] = qa_rules
    _merge_missing(qa_rules, default_qa_rules(qa_rules))

    return migrated, [
        "migrated schema 3.0 data to schema 3.1 with capability-gated transparency and strict alpha QA"
    ]


def _unique_slug(value: str, used: set[str], fallback: str) -> str:
    base = slugify(value)[:64].rstrip("-") or fallback
    candidate = base
    counter = 2
    while candidate in used:
        suffix = f"-{counter}"
        candidate = f"{base[:64-len(suffix)].rstrip('-')}{suffix}"
        counter += 1
    used.add(candidate)
    return candidate


def _migration_production_method_id(profile_id: str) -> str:
    if profile_id in {"apparel-front", "tote-portrait"}:
        return "apparel-dtg"
    if profile_id in {
        "drinkware-wrap",
        "keepsake-square",
        "large-format-portrait",
    }:
        return "sublimation-transfer"
    return "digital-flat-print"


def _ensure_v32_contracts(data: dict[str, Any]) -> list[str]:
    """Add conservative, review-labeled 3.2 contracts to older valid data."""

    warnings = [
        "schema 3.2 market, evidence, production, creative, and sensitivity scaffolds were generated during migration; this migrated data requires review before demand-backed or production-ready claims"
    ]
    provenance = data.setdefault("data_provenance", {})
    sources = provenance.setdefault("sources", [])
    used_source_ids: set[str] = set()
    for index, source in enumerate(sources, start=1):
        if not isinstance(source, dict):
            continue
        existing = source.get("id")
        if isinstance(existing, str) and existing:
            source_id = _unique_slug(existing, used_source_ids, f"source-{index}")
        else:
            source_id = _unique_slug(
                f"{source.get('type', 'source')}-{index}",
                used_source_ids,
                f"source-{index}",
            )
        source["id"] = source_id

    locale = str(data.get("locale") or "und")
    review_by = str(provenance.get("last_updated") or date.today().isoformat())
    marketplaces = provenance.get("marketplaces")
    if not isinstance(marketplaces, list) or not marketplaces:
        marketplaces = ["unspecified-marketplace"]
        provenance["marketplaces"] = marketplaces
    assumptions = provenance.get("assumptions")
    if not isinstance(assumptions, list) or not assumptions:
        provenance["assumptions"] = [
            "Migrated legacy data requires market, evidence, production, and sensitivity review."
        ]
    market_contexts: list[dict[str, Any]] = []
    used_market_ids: set[str] = set()
    for marketplace in marketplaces:
        market_id = _unique_slug(
            f"{locale}-{marketplace}", used_market_ids, "market-context"
        )
        market_contexts.append(
            {
                "id": market_id,
                "marketplace": str(marketplace),
                "locale": locale,
                "region": "unspecified",
                "measurement_system": "unspecified",
                "restricted_claims": [],
                "output_notes": [
                    "Migrated context: verify current marketplace copy and template constraints before launch."
                ],
                "review_by": review_by,
            }
        )
    data.setdefault("market_contexts", market_contexts)
    market_ids = [
        item["id"]
        for item in data.get("market_contexts", [])
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    ]
    source_ids = [
        item["id"]
        for item in sources
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    ]
    data.setdefault(
        "evidence_claims",
        [
            {
                "id": "migrated-market-hypothesis",
                "claim_type": "market-hypothesis",
                "statement": "Older niche assumptions were migrated without new live-market verification.",
                "status": "hypothesis",
                "source_ids": source_ids,
                "market_context_ids": market_ids,
                "review_by": review_by,
                "confidence": "low",
            }
        ],
    )

    products = data.get("product_fit", [])
    existing_methods = data.get("production_methods")
    if isinstance(existing_methods, list) and existing_methods:
        membership: dict[str, list[str]] = defaultdict(list)
        for method in existing_methods:
            if not isinstance(method, dict) or not isinstance(method.get("id"), str):
                continue
            for product_name in method.get("products", []):
                if isinstance(product_name, str):
                    membership[product_name].append(method["id"])
        for product in products if isinstance(products, list) else []:
            if not isinstance(product, dict) or product.get("production_method_id"):
                continue
            product_name = str(product.get("product") or "").strip()
            candidates = membership.get(product_name, [])
            if len(candidates) == 1:
                product["production_method_id"] = candidates[0]
    else:
        method_products: dict[str, list[str]] = defaultdict(list)
        for product in products if isinstance(products, list) else []:
            if not isinstance(product, dict):
                continue
            product_name = str(product.get("product") or "").strip()
            profile_id = str(product.get("output_profile_id") or "general-portrait")
            method_id = _migration_production_method_id(profile_id)
            product["production_method_id"] = method_id
            if product_name:
                method_products[method_id].append(product_name)
        method_labels = {
            "apparel-dtg": ("DTG apparel baseline", "direct-to-garment"),
            "sublimation-transfer": ("Sublimation transfer baseline", "sublimation"),
            "digital-flat-print": ("Digital flat-print baseline", "digital-print"),
        }
        qa = data.get("qa_rules") if isinstance(data.get("qa_rules"), dict) else {}
        max_colors = qa.get("max_colors", 8)
        if not isinstance(max_colors, int) or isinstance(max_colors, bool):
            max_colors = 8
        production_methods = []
        for method_id, assigned_products in sorted(method_products.items()):
            label, process = method_labels[method_id]
            production_methods.append(
                {
                    "id": method_id,
                    "label": label,
                    "process": process,
                    "products": sorted(set(assigned_products)),
                    "minimum_stroke_mm": 0.8,
                    "minimum_gap_mm": 0.8,
                    "minimum_text_height_mm": 4.0,
                    "max_colors": max(1, min(max_colors, 64)),
                    "distress_allowed": True,
                    "halftones_allowed": True,
                    "substrate_notes": "Migrated baseline; verify the selected blank and print provider.",
                    "ink_notes": "Migrated baseline; use the provider color profile and a test print.",
                    "template_required": True,
                    "uncertainty": "migrated-baseline-requires-provider-review",
                }
            )
        data["production_methods"] = production_methods

    personas = [
        item["id"]
        for item in data.get("personas", [])
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    ]
    occasions = [
        item["id"]
        for item in data.get("occasions", [])
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    ]
    product_names = [
        item["product"]
        for item in products
        if isinstance(item, dict) and isinstance(item.get("product"), str)
    ]
    hooks = [
        item["id"]
        for item in data.get("hook_patterns", [])
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    ]
    archetype_templates = (
        (
            "migrated-identity",
            "Migrated identity angle",
            "A niche identity supports self-purchase or a peer gift.",
            ["composition", "typography", "motif"],
        ),
        (
            "migrated-appreciation",
            "Migrated appreciation angle",
            "A buyer recognizes a recipient during a relevant occasion.",
            ["hook", "composition", "palette"],
        ),
        (
            "migrated-personalization",
            "Migrated personalization angle",
            "Names, dates, or roles make a milestone gift specific.",
            ["personalization", "composition", "typography"],
        ),
    )
    idea_archetypes = []
    for index, (item_id, label, purchase_logic, axes) in enumerate(
        archetype_templates
    ):
        idea_archetypes.append(
            {
                "id": item_id,
                "label": label,
                "purchase_logic": purchase_logic,
                "persona_ids": personas[index::3] or personas[:1],
                "occasion_ids": occasions[index::3] or occasions[:1],
                "product_names": product_names[index::3] or product_names[:1],
                "hook_ids": hooks[index::3] or hooks[:1],
                "required_variation_axes": axes,
                "avoid": [
                    "Treat this migrated scaffold as reviewed niche evidence before production."
                ],
            }
        )
    data.setdefault("idea_archetypes", idea_archetypes)
    data.setdefault(
        "creative_controls",
        {
            "required_variation_axes": [
                "composition",
                "typography",
                "motif",
                "palette",
                "hook",
                "personalization",
            ],
            "minimum_distinct_axes_per_variant": 2,
            "anti_generic_phrases": [
                "best ever",
                "world's best",
                "just a girl who loves",
            ],
        },
    )
    style_ids = [
        item["id"]
        for item in data.get("style_variants", [])
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    ]
    data.setdefault(
        "combination_rules",
        [
            {
                "id": "migrated-combination-review",
                "persona_ids": personas[:1],
                "occasion_ids": [],
                "product_names": [],
                "style_variant_ids": style_ids[:1],
                "idea_archetype_ids": [],
                "outcome": "review",
                "reason": "Migration cannot prove that this legacy persona/style combination is niche-distinctive.",
            }
        ],
    )
    data.setdefault(
        "sensitivity_rules",
        [
            {
                "id": "migrated-sensitive-claim-review",
                "trigger_terms": [
                    "guaranteed outcome",
                    "medical cure",
                    "targeted-group mockery",
                ],
                "persona_ids": [],
                "occasion_ids": [],
                "action": "human-review",
                "constraints": [
                    "Stop production-ready labeling until a human reviews the sensitive claim."
                ],
                "rationale": "Legacy data did not have a separate sensitivity behavior contract.",
            }
        ],
    )
    return warnings


def migrate_v3_1_to_v3_2(
    data: dict[str, Any], requested_slug: str
) -> tuple[dict[str, Any], list[str]]:
    """Advance schema 3.1 while preserving IDs, bindings, and alpha policy."""

    migrated = deep_copy_json(data)
    migrated["schema_version"] = SCHEMA_VERSION
    migrated.setdefault("niche_slug", slugify(requested_slug))
    migrated.setdefault("niche_display", titleize(migrated["niche_slug"]))
    warnings = [
        "migrated schema 3.1 data to schema 3.2 without changing existing IDs, bindings, or alpha policy"
    ]
    warnings.extend(_ensure_v32_contracts(migrated))
    return migrated, warnings


def _assign_pair_id(brief: dict[str, Any], pairs: list[dict[str, Any]]) -> str:
    buyer = str(brief.get("buyer", "")).strip().lower()
    recipient = str(brief.get("recipient", "")).strip().lower()
    candidates = [pair for pair in pairs if str(pair.get("buyer", "")).strip().lower() == buyer]
    for pair in candidates:
        pair_recipient = str(pair.get("recipient", "")).strip().lower()
        if recipient == pair_recipient or recipient in pair_recipient or pair_recipient in recipient:
            return str(pair["id"])
    if candidates:
        return str(candidates[0]["id"])
    return str(pairs[0]["id"]) if pairs else "buyer-recipient"


def migrate_v2_to_v3(data: dict[str, Any], requested_slug: str) -> tuple[dict[str, Any], list[str]]:
    migrated = deep_copy_json(data)
    warnings = ["migrated schema 2.0 data to schema 3.2 in memory"]

    migrated["schema_version"] = SCHEMA_VERSION
    migrated["niche_slug"] = slugify(str(migrated.pop("niche", requested_slug)))
    migrated["niche_display"] = str(
        migrated.get("niche_display") or titleize(migrated["niche_slug"])
    ).strip()

    provenance = migrated.get("data_provenance")
    if not isinstance(provenance, dict):
        provenance = {}
        migrated["data_provenance"] = provenance
    provenance["evidence_status"] = provenance.pop("status", "curated-draft")
    provenance.setdefault("legal_status", "unchecked")
    provenance.setdefault("last_updated", date.today().isoformat())
    provenance.setdefault("marketplaces", [])
    provenance.setdefault("sources", [])
    provenance.setdefault("assumptions", [])

    pairs = migrated.get("buyer_recipient_pairs", [])
    if isinstance(pairs, list):
        used_ids: set[str] = set()
        for pair in pairs:
            if not isinstance(pair, dict):
                continue
            pair.setdefault(
                "id",
                _pair_id(str(pair.get("buyer", "")), str(pair.get("recipient", "")), used_ids),
            )

    products = migrated.get("product_fit", [])
    if not isinstance(products, list):
        products = []
    output_profiles = build_output_profiles(products)
    migrated["output_profiles"] = output_profiles

    palettes = migrated.get("visual_vocabulary", {}).get("palettes", [])
    known_palettes = {
        str(record.get("name"))
        for record in palettes
        if isinstance(record, dict) and record.get("name")
    }
    styles = migrated.get("style_variants", [])
    if isinstance(styles, list):
        for style in styles:
            if not isinstance(style, dict):
                continue
            style["palette_options"] = _split_palette_options(
                style.pop("palette", None), known_palettes
            )

    old_calibration = migrated.pop("market_fit_calibration", {})
    migrated["concept_fit_calibration"] = {
        "go_score": 21,
        "refine_score": 17,
        "rework_score": 13,
        "replace_score": 12,
        "high_fit_signals": old_calibration.get("high_fit_signals", [])
        if isinstance(old_calibration, dict)
        else [],
        "weak_fit_signals": old_calibration.get("weak_fit_signals", [])
        if isinstance(old_calibration, dict)
        else [],
    }

    migrated["output_defaults"] = default_output_defaults()
    migrated["qa_rules"] = default_qa_rules(
        migrated.get("qa_rules") if isinstance(migrated.get("qa_rules"), dict) else None
    )

    profile_by_product = {
        product: profile["id"]
        for profile in output_profiles
        for product in profile["products"]
    }
    briefs = migrated.get("sample_briefs", [])
    if isinstance(briefs, list):
        for brief in briefs:
            if not isinstance(brief, dict):
                continue
            exact_text = brief.pop("exact_text", "")
            brief["copy"] = {
                "mode": "exact" if str(exact_text).strip() else "none",
                "text": str(exact_text),
                "language": migrated.get("locale", "en-US"),
            }
            brief["buyer_recipient_pair_id"] = _assign_pair_id(
                brief, pairs if isinstance(pairs, list) else []
            )
            brief["output_profile_id"] = profile_by_product.get(
                brief.get("product"), "general-portrait"
            )
            brief.setdefault("product_surface", {"tone": "unknown", "color": None})

    warnings.extend(_ensure_v32_contracts(migrated))
    return migrated, warnings


def normalize_data(
    data: dict[str, Any], requested_slug: str
) -> tuple[dict[str, Any], list[str]]:
    version = data.get("schema_version")
    if version == LEGACY_SCHEMA_VERSION:
        normalized, warnings = migrate_v2_to_v3(data, requested_slug)
    elif version == OLDER_SCHEMA_VERSION:
        intermediate, warnings_30 = migrate_v3_to_v3_1(data, requested_slug)
        normalized, warnings_31 = migrate_v3_1_to_v3_2(intermediate, requested_slug)
        warnings = warnings_30 + warnings_31
    elif version == PREVIOUS_SCHEMA_VERSION:
        normalized, warnings = migrate_v3_1_to_v3_2(data, requested_slug)
    elif version == SCHEMA_VERSION:
        normalized = deep_copy_json(data)
        warnings = []
    else:
        normalized = deep_copy_json(data)
        warnings = []

    if "niche_slug" not in normalized and "niche" in normalized:
        normalized["niche_slug"] = slugify(str(normalized.pop("niche")))
    normalized.setdefault("niche_slug", slugify(requested_slug))
    normalized.setdefault("niche_display", titleize(normalized["niche_slug"]))
    normalized["niche_slug"] = str(normalized["niche_slug"]).strip().lower()
    normalized["niche_display"] = str(normalized["niche_display"]).strip()
    return normalized, warnings
