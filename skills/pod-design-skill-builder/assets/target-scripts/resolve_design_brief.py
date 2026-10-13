#!/usr/bin/env python3
"""Resolve a niche POD request into a closed, machine-readable binding receipt."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any, Iterable

from resolve_transparency_route import resolve as resolve_transparency


class BriefError(ValueError):
    """Raised when a request cannot safely resolve against the master data."""


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")


def sha256_json(value: Any) -> str:
    return hashlib.sha256(canonical_json_bytes(value)).hexdigest()


def read_object(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError as exc:
        raise BriefError(f"JSON file does not exist: {path}") from exc
    except json.JSONDecodeError as exc:
        raise BriefError(
            f"invalid JSON in {path} at line {exc.lineno}, column {exc.colno}: {exc.msg}"
        ) from exc
    if not isinstance(value, dict):
        raise BriefError(f"JSON root must be an object: {path}")
    return value


def master_data_path() -> Path:
    references = Path(__file__).resolve().parent.parent / "references"
    candidates = sorted(references.glob("*-master-data.json"))
    if len(candidates) != 1:
        raise BriefError(
            f"expected exactly one *-master-data.json in {references}; found {len(candidates)}"
        )
    return candidates[0]


def index_by(records: Any, key: str, domain: str) -> dict[str, dict[str, Any]]:
    if not isinstance(records, list):
        raise BriefError(f"master data domain {domain!r} must be an array")
    result: dict[str, dict[str, Any]] = {}
    for index, record in enumerate(records):
        if not isinstance(record, dict):
            raise BriefError(f"{domain}[{index}] must be an object")
        value = record.get(key)
        if not isinstance(value, str) or not value:
            raise BriefError(f"{domain}[{index}].{key} must be a non-empty string")
        if value in result:
            raise BriefError(f"duplicate {domain} key {value!r}")
        result[value] = record
    return result


def require_string(request: dict[str, Any], field: str) -> str:
    value = request.get(field)
    if not isinstance(value, str) or not value.strip():
        raise BriefError(f"request.{field} must be a non-empty string")
    return value.strip()


def resolve_record(
    request: dict[str, Any],
    field: str,
    records: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    value = require_string(request, field)
    if value not in records:
        raise BriefError(f"request.{field} has unknown reference {value!r}")
    return records[value]


def normalize_text(value: Any) -> str:
    return " ".join(str(value).casefold().split())


def classify_surface_tone(color: str) -> str:
    channels = [int(color[index : index + 2], 16) / 255.0 for index in (1, 3, 5)]
    linear = [
        channel / 12.92
        if channel <= 0.04045
        else ((channel + 0.055) / 1.055) ** 2.4
        for channel in channels
    ]
    luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
    if luminance < 0.18:
        return "dark"
    if luminance > 0.65:
        return "light"
    return "mid"


def require_compatible(
    selected: str,
    allowed: Any,
    path: str,
    *,
    allow_empty: bool = False,
) -> None:
    if not isinstance(allowed, list):
        raise BriefError(f"{path} must be an array")
    if not allowed and allow_empty:
        return
    if selected not in allowed:
        raise BriefError(f"{selected!r} is incompatible with {path}: {allowed}")


def style_axes(style: dict[str, Any]) -> tuple[str, tuple[str, ...], tuple[str, ...]]:
    return (
        normalize_text(style.get("typography")),
        tuple(sorted(normalize_text(value) for value in style.get("motifs", []))),
        tuple(
            sorted(normalize_text(value) for value in style.get("palette_options", []))
        ),
    )


def validate_variant_distinctness(
    styles: list[dict[str, Any]], minimum_axes: int
) -> list[dict[str, Any]]:
    receipts: list[dict[str, Any]] = []
    axes = [style_axes(style) for style in styles]
    for index, style in enumerate(styles):
        distinct_from_previous: list[dict[str, Any]] = []
        for previous in range(index):
            changed = [
                name
                for name, left, right in zip(
                    ("typography", "motif", "palette"), axes[previous], axes[index]
                )
                if left != right
            ]
            if len(changed) < minimum_axes:
                raise BriefError(
                    f"style {style['id']!r} changes only {changed} from "
                    f"{styles[previous]['id']!r}; at least {minimum_axes} distinct creative axes are required"
                )
            distinct_from_previous.append(
                {"style_variant_id": styles[previous]["id"], "changed_axes": changed}
            )
        receipts.append(
            {
                "style_variant_id": style["id"],
                "commercial_role": style["commercial_role"],
                "typography": style["typography"],
                "motifs": style["motifs"],
                "palette_options": style["palette_options"],
                "distinct_from_previous": distinct_from_previous,
            }
        )
    return receipts


def selector_matches(
    rule: dict[str, Any], request: dict[str, Any], style_ids: list[str]
) -> bool:
    scalar_fields = {
        "persona_ids": request["persona_id"],
        "occasion_ids": request["occasion_id"],
        "product_names": request["product"],
        "idea_archetype_ids": request["idea_archetype_id"],
    }
    for field, selected in scalar_fields.items():
        values = rule.get(field, [])
        if values and selected not in values:
            return False
    rule_styles = rule.get("style_variant_ids", [])
    if rule_styles and not set(rule_styles).intersection(style_ids):
        return False
    return True


def sensitivity_result(
    rules: Iterable[dict[str, Any]], request: dict[str, Any], copy_text: str
) -> dict[str, Any]:
    matched: list[dict[str, Any]] = []
    normalized_copy = normalize_text(copy_text)
    for rule in rules:
        persona_ids = rule.get("persona_ids", [])
        occasion_ids = rule.get("occasion_ids", [])
        if persona_ids and request["persona_id"] not in persona_ids:
            continue
        if occasion_ids and request["occasion_id"] not in occasion_ids:
            continue
        triggers = [
            term for term in rule.get("trigger_terms", []) if normalize_text(term) in normalized_copy
        ]
        if not triggers:
            continue
        match = {
            "rule_id": rule["id"],
            "action": rule["action"],
            "matched_terms": triggers,
            "constraints": rule["constraints"],
            "rationale": rule["rationale"],
        }
        if rule["action"] == "refuse":
            raise BriefError(
                f"sensitivity rule {rule['id']!r} requires refusal after matching {triggers}"
            )
        matched.append(match)
    status = "clear"
    if any(item["action"] == "human-review" for item in matched):
        status = "human-review"
    elif matched:
        status = "constrained"
    return {"status": status, "matches": matched}


def resolve_request(data: dict[str, Any], request: dict[str, Any]) -> dict[str, Any]:
    domains = {
        "persona": index_by(data["personas"], "id", "personas"),
        "pair": index_by(data["buyer_recipient_pairs"], "id", "buyer_recipient_pairs"),
        "occasion": index_by(data["occasions"], "id", "occasions"),
        "emotion": index_by(data["emotions"], "id", "emotions"),
        "market": index_by(data["market_contexts"], "id", "market_contexts"),
        "archetype": index_by(data["idea_archetypes"], "id", "idea_archetypes"),
        "hook": index_by(data["hook_patterns"], "id", "hook_patterns"),
        "style": index_by(data["style_variants"], "id", "style_variants"),
        "profile": index_by(data["output_profiles"], "id", "output_profiles"),
        "method": index_by(data["production_methods"], "id", "production_methods"),
        "personalization": index_by(
            data["personalization_fields"], "key", "personalization_fields"
        ),
        "product": index_by(data["product_fit"], "product", "product_fit"),
    }

    resolved = {
        "market": resolve_record(request, "market_context_id", domains["market"]),
        "persona": resolve_record(request, "persona_id", domains["persona"]),
        "pair": resolve_record(request, "buyer_recipient_pair_id", domains["pair"]),
        "occasion": resolve_record(request, "occasion_id", domains["occasion"]),
        "emotion": resolve_record(request, "emotion_id", domains["emotion"]),
        "product": resolve_record(request, "product", domains["product"]),
        "profile": resolve_record(request, "output_profile_id", domains["profile"]),
        "method": resolve_record(
            request, "production_method_id", domains["method"]
        ),
        "archetype": resolve_record(
            request, "idea_archetype_id", domains["archetype"]
        ),
        "hook": resolve_record(request, "hook_pattern_id", domains["hook"]),
    }

    product_name = request["product"]
    if resolved["product"].get("output_profile_id") != request["output_profile_id"]:
        raise BriefError("selected output profile does not match the product contract")
    if resolved["product"].get("production_method_id") != request["production_method_id"]:
        raise BriefError("selected production method does not match the product contract")
    require_compatible(
        product_name, resolved["profile"].get("products"), "output profile products"
    )
    require_compatible(
        product_name, resolved["method"].get("products"), "production method products"
    )
    require_compatible(
        request["occasion_id"],
        resolved["pair"].get("strong_occasions"),
        "buyer-recipient pair strong occasions",
    )
    require_compatible(
        product_name,
        resolved["pair"].get("preferred_products"),
        "buyer-recipient pair preferred products",
    )
    require_compatible(
        product_name, resolved["persona"].get("product_fit"), "persona product fit"
    )
    require_compatible(
        product_name,
        resolved["occasion"].get("common_products"),
        "occasion common products",
    )

    archetype = resolved["archetype"]
    for request_field, archetype_field in (
        ("persona_id", "persona_ids"),
        ("occasion_id", "occasion_ids"),
        ("product", "product_names"),
        ("hook_pattern_id", "hook_ids"),
    ):
        require_compatible(
            request[request_field], archetype.get(archetype_field), f"idea archetype {archetype_field}"
        )

    copy_object = request.get("copy")
    if not isinstance(copy_object, dict):
        raise BriefError("request.copy must be an object")
    copy_mode = copy_object.get("mode")
    copy_text = copy_object.get("text")
    if copy_mode not in {"exact", "proposed", "none"}:
        raise BriefError("request.copy.mode must be exact, proposed, or none")
    if not isinstance(copy_text, str):
        raise BriefError("request.copy.text must be a string")
    if copy_mode == "none" and copy_text.strip():
        raise BriefError("request.copy.text must be empty when mode is none")
    if copy_mode in {"exact", "proposed"} and not copy_text.strip():
        raise BriefError(f"request.copy.text must not be blank when mode is {copy_mode}")
    copy_language = copy_object.get("language")
    if not isinstance(copy_language, str) or not copy_language.strip():
        raise BriefError("request.copy.language must be a non-empty string")
    market_locale = resolved["market"].get("locale")
    if copy_language != market_locale:
        raise BriefError(
            f"request.copy.language {copy_language!r} does not match market locale {market_locale!r}"
        )
    max_words = resolved["product"].get("max_words")
    word_count = len(copy_text.split())
    if isinstance(max_words, int) and word_count > max_words:
        raise BriefError(
            f"copy word limit exceeded for {product_name!r}: {word_count} > {max_words}"
        )

    normalized_copy = normalize_text(copy_text)
    for phrase in data["creative_controls"]["anti_generic_phrases"]:
        if normalize_text(phrase) in normalized_copy:
            raise BriefError(f"anti-generic gate matched prohibited phrase {phrase!r}")
    for phrase in resolved["market"].get("restricted_claims", []):
        if normalize_text(phrase) in normalized_copy:
            raise BriefError(f"market restriction matched prohibited claim {phrase!r}")

    personalization_keys = request.get("personalization")
    if not isinstance(personalization_keys, list):
        raise BriefError("request.personalization must be an array")
    if len(personalization_keys) != len(set(personalization_keys)):
        raise BriefError("request.personalization contains duplicates")
    personalization_records = []
    for key in personalization_keys:
        if key not in domains["personalization"]:
            raise BriefError(f"request.personalization has unknown reference {key!r}")
        record = domains["personalization"][key]
        require_compatible(product_name, record.get("products"), f"personalization {key} products")
        require_compatible(
            key,
            resolved["product"].get("personalization"),
            f"product {product_name} personalization",
        )
        require_compatible(
            key,
            resolved["occasion"].get("personalization"),
            f"occasion {request['occasion_id']} personalization",
        )
        personalization_records.append(record)

    product_surface = request.get("product_surface")
    if not isinstance(product_surface, dict):
        raise BriefError("request.product_surface must be an object")
    if product_surface.get("tone") not in {"dark", "light", "mid", "unknown"}:
        raise BriefError("request.product_surface.tone must be dark, light, mid, or unknown")
    surface_color = product_surface.get("color")
    if surface_color is not None and (
        not isinstance(surface_color, str)
        or not re.fullmatch(r"#[0-9A-Fa-f]{6}", surface_color)
    ):
        raise BriefError("request.product_surface.color must be null or #RRGGBB")
    if surface_color is not None and product_surface["tone"] != "unknown":
        computed_tone = classify_surface_tone(surface_color)
        if computed_tone != product_surface["tone"]:
            raise BriefError(
                f"product surface tone {product_surface['tone']!r} conflicts with "
                f"color {surface_color!r} ({computed_tone})"
            )

    style_ids = request.get("style_variant_ids")
    variant_count = request.get("variant_count")
    if not isinstance(style_ids, list) or not 1 <= len(style_ids) <= 4:
        raise BriefError("request.style_variant_ids must contain 1 to 4 IDs")
    if len(style_ids) != len(set(style_ids)):
        raise BriefError("request.style_variant_ids must be unique")
    if not isinstance(variant_count, int) or isinstance(variant_count, bool):
        raise BriefError("request.variant_count must be an integer")
    if variant_count != len(style_ids):
        raise BriefError("request.variant_count must match style_variant_ids length")
    styles = []
    for style_id in style_ids:
        if style_id not in domains["style"]:
            raise BriefError(f"request.style_variant_ids has unknown reference {style_id!r}")
        styles.append(domains["style"][style_id])
    minimum_axes = data["creative_controls"]["minimum_distinct_axes_per_variant"]
    variants = validate_variant_distinctness(styles, minimum_axes)

    combination_reviews: list[dict[str, Any]] = []
    for rule in data["combination_rules"]:
        if selector_matches(rule, request, style_ids):
            if rule["outcome"] == "forbid":
                raise BriefError(
                    f"forbidden combination {rule['id']!r}: {rule['reason']}"
                )
            combination_reviews.append(
                {"rule_id": rule["id"], "reason": rule["reason"]}
            )

    sensitivity = sensitivity_result(data["sensitivity_rules"], request, copy_text)

    runtime = request.get("image_runtime")
    if not isinstance(runtime, dict):
        raise BriefError("request.image_runtime must be an object")
    background = data["output_defaults"]["background"]
    try:
        alpha_route = resolve_transparency(
            runtime.get("provider", ""),
            runtime.get("model", ""),
            runtime.get("capability", ""),
            runtime.get("evidence", ""),
            runtime.get("alpha_qa", "not-run"),
            runtime.get("attempt", 0),
            background["max_transparent_attempts"],
            background["unknown_probe_attempts"],
        )
    except ValueError as exc:
        raise BriefError(f"invalid alpha route: {exc}") from exc

    bindings = {
        "market_context_id": request["market_context_id"],
        "persona_id": request["persona_id"],
        "buyer_recipient_pair_id": request["buyer_recipient_pair_id"],
        "occasion_id": request["occasion_id"],
        "emotion_id": request["emotion_id"],
        "product": product_name,
        "production_method_id": request["production_method_id"],
        "output_profile_id": request["output_profile_id"],
        "idea_archetype_id": request["idea_archetype_id"],
        "hook_pattern_id": request["hook_pattern_id"],
        "style_variant_ids": style_ids,
        "personalization_keys": personalization_keys,
    }
    return {
        "schema_version": "1.0",
        "binding_receipt": {
            "data_sha256": sha256_json(data),
            "request_sha256": sha256_json(request),
            "niche_slug": data["niche_slug"],
        },
        "bindings": bindings,
        "market_context": resolved["market"],
        "idea_archetype": resolved["archetype"],
        "production_method": resolved["method"],
        "output_profile": resolved["profile"],
        "copy": copy_object,
        "product_surface": product_surface,
        "personalization_contracts": personalization_records,
        "combination_reviews": combination_reviews,
        "sensitivity": sensitivity,
        "alpha_route": alpha_route,
        "variants": variants,
        "qa_contract": {
            "minimum_stroke_mm": resolved["method"]["minimum_stroke_mm"],
            "minimum_gap_mm": resolved["method"]["minimum_gap_mm"],
            "minimum_text_height_mm": resolved["method"]["minimum_text_height_mm"],
            "max_colors": min(
                resolved["method"]["max_colors"], data["qa_rules"]["max_colors"]
            ),
            "template_required": resolved["method"]["template_required"],
            "final_output_requirement": "transparent-png-alpha-qa-pass",
        },
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Resolve a POD request into a closed design-brief binding receipt"
    )
    parser.add_argument("--request", required=True, help="Request JSON path")
    parser.add_argument("--output", help="Optional receipt JSON path")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        request = read_object(Path(args.request))
        data = read_object(master_data_path())
        receipt = resolve_request(data, request)
        rendered = json.dumps(receipt, indent=2, ensure_ascii=False, sort_keys=True)
        if args.output:
            output = Path(args.output)
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(rendered + "\n", encoding="utf-8", newline="\n")
        else:
            print(rendered)
        return 0
    except (BriefError, OSError, TypeError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
