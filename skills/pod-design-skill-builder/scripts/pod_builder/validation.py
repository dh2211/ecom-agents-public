"""Strict type, range, and semantic validation for schema 3.2."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any, Iterable

from .colors import classify_surface_tone
from .constants import (
    ASPECT_RATIO_PATTERN,
    CLAIM_STATUSES,
    CLAIM_TYPES,
    COMBINATION_RULE_OUTCOMES,
    CONFIDENCE_LEVELS,
    COPY_MODES,
    EVIDENCE_STATUSES,
    HEX_COLOR_PATTERN,
    ID_PATTERN,
    LEGAL_STATUSES,
    MEASUREMENT_SYSTEMS,
    PRIORITIES,
    SAFE_BACKGROUND_PALETTE,
    SCHEMA_VERSION,
    SENSITIVITY_ACTIONS,
    SUPPORTED_TRANSPARENCY_ROUTES,
    SURFACE_TONES,
    TRANSPARENCY_CAPABILITY_POLICIES,
    TRANSPARENCY_FALLBACK_CONDITIONS,
    UNKNOWN_TRANSPARENCY_ROUTES,
    UNSUPPORTED_TRANSPARENCY_ROUTES,
    VARIATION_AXES,
)
from .utils import contains_control_characters


@dataclass
class ValidationReport:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors

    def error(self, path: str, message: str) -> None:
        self.errors.append(f"{path}: {message}")

    def warn(self, path: str, message: str) -> None:
        self.warnings.append(f"{path}: {message}")


def _is_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _is_number(value: Any) -> bool:
    return (isinstance(value, (int, float)) and not isinstance(value, bool))


def _as_mapping(value: Any, path: str, report: ValidationReport) -> dict[str, Any]:
    if not isinstance(value, dict):
        report.error(path, "must be an object")
        return {}
    return value


def _as_list(
    value: Any,
    path: str,
    report: ValidationReport,
    minimum: int = 0,
    maximum: int | None = None,
) -> list[Any]:
    if not isinstance(value, list):
        report.error(path, "must be an array")
        return []
    if len(value) < minimum:
        report.error(path, f"requires at least {minimum} records; found {len(value)}")
    if maximum is not None and len(value) > maximum:
        report.error(path, f"allows at most {maximum} records; found {len(value)}")
    return value


def _check_string(
    value: Any,
    path: str,
    report: ValidationReport,
    *,
    minimum: int = 1,
    maximum: int = 1000,
    allow_newline: bool = True,
) -> str | None:
    if not isinstance(value, str):
        report.error(path, "must be a string")
        return None
    text = value.strip()
    if len(text) < minimum:
        report.error(path, "must be non-empty")
        return None
    if len(text) > maximum:
        report.error(path, f"must be at most {maximum} characters")
    if not allow_newline and ("\n" in value or "\r" in value):
        report.error(path, "must not contain newlines")
    if contains_control_characters(value):
        report.error(path, "must not contain control characters")
    return text


def _check_bool(value: Any, path: str, report: ValidationReport) -> bool | None:
    if not isinstance(value, bool):
        report.error(path, "must be true or false")
        return None
    return value


def _check_int(
    value: Any,
    path: str,
    report: ValidationReport,
    minimum: int,
    maximum: int,
) -> int | None:
    if not _is_int(value):
        report.error(path, f"must be an integer from {minimum} to {maximum}")
        return None
    if not minimum <= value <= maximum:
        report.error(path, f"must be from {minimum} to {maximum}")
    return value


def _check_number(
    value: Any,
    path: str,
    report: ValidationReport,
    minimum: float,
    maximum: float,
) -> float | None:
    if not _is_number(value):
        report.error(path, f"must be a number from {minimum} to {maximum}")
        return None
    numeric = float(value)
    if not minimum <= numeric <= maximum:
        report.error(path, f"must be from {minimum} to {maximum}")
    return numeric


def _check_date(value: Any, path: str, report: ValidationReport) -> None:
    text = _check_string(value, path, report, maximum=10, allow_newline=False)
    if text is None:
        return
    try:
        date.fromisoformat(text)
    except ValueError:
        report.error(path, "must use ISO date format YYYY-MM-DD")


def _check_id(value: Any, path: str, report: ValidationReport) -> str | None:
    text = _check_string(value, path, report, maximum=64, allow_newline=False)
    if text is not None and not ID_PATTERN.fullmatch(text):
        report.error(path, "must be a lowercase hyphenated ID")
    return text


def _check_hex(value: Any, path: str, report: ValidationReport) -> str | None:
    text = _check_string(value, path, report, maximum=7, allow_newline=False)
    if text is not None and not HEX_COLOR_PATTERN.fullmatch(text):
        report.error(path, "must be a #RRGGBB color")
        return None
    return text.upper() if text else None


def _check_string_list(
    value: Any,
    path: str,
    report: ValidationReport,
    *,
    minimum: int = 0,
    maximum: int | None = None,
    unique: bool = False,
) -> list[str]:
    records = _as_list(value, path, report, minimum=minimum, maximum=maximum)
    valid: list[str] = []
    seen: set[str] = set()
    for index, item in enumerate(records):
        text = _check_string(
            item,
            f"{path}[{index}]",
            report,
            maximum=500,
            allow_newline=False,
        )
        if text is None:
            continue
        if unique and text in seen:
            report.error(f"{path}[{index}]", f"duplicate value {text!r}")
        seen.add(text)
        valid.append(text)
    return valid


def _record_ids(
    records: list[Any],
    path: str,
    report: ValidationReport,
    id_field: str = "id",
) -> set[str]:
    result: set[str] = set()
    for index, item in enumerate(records):
        if not isinstance(item, dict):
            report.error(f"{path}[{index}]", "must be an object")
            continue
        item_id = _check_id(item.get(id_field), f"{path}[{index}].{id_field}", report)
        if item_id:
            if item_id in result:
                report.error(f"{path}[{index}].{id_field}", f"duplicate ID {item_id!r}")
            result.add(item_id)
    return result


def _unique_names(
    records: list[Any], path: str, report: ValidationReport, field_name: str
) -> set[str]:
    result: set[str] = set()
    for index, item in enumerate(records):
        if not isinstance(item, dict):
            report.error(f"{path}[{index}]", "must be an object")
            continue
        name = _check_string(
            item.get(field_name),
            f"{path}[{index}].{field_name}",
            report,
            maximum=120,
            allow_newline=False,
        )
        if name:
            if name in result:
                report.error(
                    f"{path}[{index}].{field_name}", f"duplicate value {name!r}"
                )
            result.add(name)
    return result


def _check_refs(
    values: Iterable[str], valid: set[str], path: str, report: ValidationReport
) -> None:
    for value in values:
        if value not in valid:
            report.error(path, f"unknown reference {value!r}")


def _normalized_text(value: Any) -> str:
    return " ".join(str(value).casefold().split())


def _structured_signature(record: dict[str, Any], fields: tuple[str, ...]) -> tuple[Any, ...]:
    signature: list[Any] = []
    for field_name in fields:
        value = record.get(field_name)
        if isinstance(value, list):
            signature.append(tuple(sorted(_normalized_text(item) for item in value)))
        else:
            signature.append(_normalized_text(value))
    return tuple(signature)


def _reject_structured_duplicates(
    records: list[Any],
    path: str,
    fields: tuple[str, ...],
    report: ValidationReport,
) -> None:
    seen: dict[tuple[Any, ...], int] = {}
    for index, record in enumerate(records):
        if not isinstance(record, dict):
            continue
        signature = _structured_signature(record, fields)
        if signature in seen:
            report.error(
                f"{path}[{index}]",
                f"structured duplicate of {path}[{seen[signature]}] across {', '.join(fields)}",
            )
        else:
            seen[signature] = index


def _warn_unknown_root_fields(data: dict[str, Any], report: ValidationReport) -> None:
    allowed = {
        "schema_version",
        "niche_slug",
        "niche_display",
        "locale",
        "niche_profile",
        "data_provenance",
        "market_contexts",
        "evidence_claims",
        "personas",
        "buyer_recipient_pairs",
        "occasions",
        "emotions",
        "buyer_language",
        "visual_vocabulary",
        "product_fit",
        "production_methods",
        "personalization_fields",
        "hook_patterns",
        "idea_archetypes",
        "creative_controls",
        "combination_rules",
        "sensitivity_rules",
        "style_variants",
        "concept_fit_calibration",
        "ip_safety",
        "output_profiles",
        "output_defaults",
        "qa_rules",
        "sample_briefs",
    }
    for key in sorted(set(data) - allowed):
        report.warn(key, "unknown root field; it will be preserved but is not used by the generator")


def validate_data(data: dict[str, Any], requested_slug: str) -> ValidationReport:
    report = ValidationReport()
    _warn_unknown_root_fields(data, report)

    if data.get("schema_version") != SCHEMA_VERSION:
        report.error(
            "schema_version",
            f"expected {SCHEMA_VERSION!r}, found {data.get('schema_version')!r}",
        )

    niche_slug = _check_id(data.get("niche_slug"), "niche_slug", report)
    if niche_slug and niche_slug != requested_slug:
        report.error(
            "niche_slug",
            f"data slug {niche_slug!r} does not match requested slug {requested_slug!r}",
        )
    _check_string(
        data.get("niche_display"),
        "niche_display",
        report,
        maximum=80,
        allow_newline=False,
    )
    _check_string(data.get("locale"), "locale", report, maximum=35, allow_newline=False)
    locale_records = [("locale", data.get("locale"))]
    if isinstance(data.get("market_contexts"), list):
        locale_records.extend(
            (f"market_contexts[{i}].locale", item.get("locale"))
            for i, item in enumerate(data["market_contexts"]) if isinstance(item, dict)
        )
    for path, locale in locale_records:
        if isinstance(locale, str) and any(char.isspace() for char in locale):
            report.error(path, "locale must not contain whitespace; do not normalize identifiers")

    profile = _as_mapping(data.get("niche_profile"), "niche_profile", report)
    _check_string(profile.get("audience_summary"), "niche_profile.audience_summary", report)
    for field_name in (
        "primary_buyers",
        "primary_recipients",
        "identity_signals",
        "niche_boundaries",
        "excluded_segments",
    ):
        _check_string_list(
            profile.get(field_name),
            f"niche_profile.{field_name}",
            report,
            minimum=1,
            unique=True,
        )
    declared_buyers = profile.get("primary_buyers")
    declared_recipients = profile.get("primary_recipients")
    buyer_scope = (
        len({_normalized_text(item) for item in declared_buyers if isinstance(item, str)})
        if isinstance(declared_buyers, list)
        else 0
    )
    recipient_scope = (
        len({_normalized_text(item) for item in declared_recipients if isinstance(item, str)})
        if isinstance(declared_recipients, list)
        else 0
    )
    scope_size = max(3, buyer_scope, recipient_scope)

    provenance = _as_mapping(data.get("data_provenance"), "data_provenance", report)
    evidence_status = provenance.get("evidence_status")
    if evidence_status not in EVIDENCE_STATUSES:
        report.error(
            "data_provenance.evidence_status",
            f"expected one of {sorted(EVIDENCE_STATUSES)}",
        )
    legal_status = provenance.get("legal_status")
    if legal_status not in LEGAL_STATUSES:
        report.error(
            "data_provenance.legal_status",
            f"expected one of {sorted(LEGAL_STATUSES)}",
        )
    _check_date(provenance.get("last_updated"), "data_provenance.last_updated", report)
    _check_string_list(
        provenance.get("marketplaces"),
        "data_provenance.marketplaces",
        report,
        minimum=1,
        unique=True,
    )
    _check_string_list(
        provenance.get("assumptions"),
        "data_provenance.assumptions",
        report,
        minimum=1,
    )
    sources = _as_list(provenance.get("sources"), "data_provenance.sources", report)
    source_ids = _record_ids(sources, "data_provenance.sources", report)
    qualified_sources = 0
    for index, source in enumerate(sources):
        path = f"data_provenance.sources[{index}]"
        source = _as_mapping(source, path, report)
        _check_string(source.get("type"), f"{path}.type", report, maximum=80, allow_newline=False)
        _check_string(source.get("note"), f"{path}.note", report, maximum=1000)
        if source.get("url") is not None:
            url = _check_string(source.get("url"), f"{path}.url", report, maximum=2048, allow_newline=False)
            if url and not (url.startswith("https://") or url.startswith("http://")):
                report.error(f"{path}.url", "must start with http:// or https://")
        if source.get("retrieved_at") is not None:
            _check_date(source.get("retrieved_at"), f"{path}.retrieved_at", report)
        if source.get("supports") is not None:
            _check_string(source.get("supports"), f"{path}.supports", report, maximum=1000)
        if source.get("url") and source.get("retrieved_at") and source.get("supports"):
            qualified_sources += 1
    if evidence_status in {"researched", "validated"} and qualified_sources < 1:
        report.error(
            "data_provenance.sources",
            "researched or validated data requires at least one source with url, retrieved_at, and supports",
        )
    if evidence_status == "validated":
        _check_string(
            provenance.get("validation_owner"),
            "data_provenance.validation_owner",
            report,
            maximum=160,
            allow_newline=False,
        )
        _check_date(
            provenance.get("evidence_reviewed_at"),
            "data_provenance.evidence_reviewed_at",
            report,
        )
    if evidence_status == "curated-draft":
        report.warn(
            "data_provenance.evidence_status",
            "commercial demand has not been live-validated; label generated hypotheses accordingly",
        )

    market_contexts = _as_list(
        data.get("market_contexts"), "market_contexts", report, minimum=1
    )
    market_context_ids = _record_ids(market_contexts, "market_contexts", report)
    for index, item in enumerate(market_contexts):
        path = f"market_contexts[{index}]"
        item = _as_mapping(item, path, report)
        for field_name, maximum in (
            ("marketplace", 120),
            ("locale", 35),
            ("region", 120),
        ):
            _check_string(
                item.get(field_name),
                f"{path}.{field_name}",
                report,
                maximum=maximum,
                allow_newline=False,
            )
        if item.get("measurement_system") not in MEASUREMENT_SYSTEMS:
            report.error(
                f"{path}.measurement_system",
                f"expected one of {sorted(MEASUREMENT_SYSTEMS)}",
            )
        _check_string_list(
            item.get("restricted_claims"),
            f"{path}.restricted_claims",
            report,
            unique=True,
        )
        _check_string_list(
            item.get("output_notes"),
            f"{path}.output_notes",
            report,
            minimum=1,
        )
        review_by = item.get("review_by")
        _check_date(review_by, f"{path}.review_by", report)
        if isinstance(review_by, str):
            try:
                if date.fromisoformat(review_by) < date.today():
                    report.warn(
                        f"{path}.review_by",
                        "market context is stale; do not describe its constraints as current or demand-backed",
                    )
            except ValueError:
                pass

    evidence_claims = _as_list(
        data.get("evidence_claims"), "evidence_claims", report, minimum=1
    )
    _record_ids(evidence_claims, "evidence_claims", report)
    non_hypothesis_claims = 0
    for index, item in enumerate(evidence_claims):
        path = f"evidence_claims[{index}]"
        item = _as_mapping(item, path, report)
        if item.get("claim_type") not in CLAIM_TYPES:
            report.error(f"{path}.claim_type", f"expected one of {sorted(CLAIM_TYPES)}")
        _check_string(item.get("statement"), f"{path}.statement", report, maximum=1000)
        claim_status = item.get("status")
        if claim_status not in CLAIM_STATUSES:
            report.error(f"{path}.status", f"expected one of {sorted(CLAIM_STATUSES)}")
        elif claim_status != "hypothesis":
            non_hypothesis_claims += 1
        claim_source_refs = _check_string_list(
            item.get("source_ids"), f"{path}.source_ids", report, unique=True
        )
        _check_refs(claim_source_refs, source_ids, f"{path}.source_ids", report)
        market_refs = _check_string_list(
            item.get("market_context_ids"),
            f"{path}.market_context_ids",
            report,
            minimum=1,
            unique=True,
        )
        _check_refs(
            market_refs, market_context_ids, f"{path}.market_context_ids", report
        )
        if claim_status in {"supported", "validated"} and not claim_source_refs:
            report.error(
                f"{path}.source_ids",
                "supported claim requires at least one traceable source reference",
            )
        if item.get("confidence") not in CONFIDENCE_LEVELS:
            report.error(
                f"{path}.confidence", f"expected one of {sorted(CONFIDENCE_LEVELS)}"
            )
        review_by = item.get("review_by")
        _check_date(review_by, f"{path}.review_by", report)
        if isinstance(review_by, str):
            try:
                if date.fromisoformat(review_by) < date.today():
                    report.warn(
                        f"{path}.review_by",
                        "evidence claim is stale; downgrade it to a hypothesis and do not call it demand-backed",
                    )
            except ValueError:
                pass
    if evidence_status in {"researched", "validated"} and non_hypothesis_claims < 1:
        report.error(
            "evidence_claims",
            "researched or validated master data requires at least one supported or validated claim",
        )

    product_minimum = min(5, max(3, scope_size - 1))
    products = _as_list(
        data.get("product_fit"), "product_fit", report, minimum=product_minimum
    )
    product_names = _unique_names(products, "product_fit", report, "product")

    production_methods = _as_list(
        data.get("production_methods"), "production_methods", report, minimum=1
    )
    production_method_ids = _record_ids(
        production_methods, "production_methods", report
    )
    product_method_membership: dict[str, list[str]] = {
        product: [] for product in product_names
    }
    for index, item in enumerate(production_methods):
        path = f"production_methods[{index}]"
        item = _as_mapping(item, path, report)
        _check_string(
            item.get("label"), f"{path}.label", report, maximum=160, allow_newline=False
        )
        _check_string(
            item.get("process"),
            f"{path}.process",
            report,
            maximum=120,
            allow_newline=False,
        )
        method_products = _check_string_list(
            item.get("products"), f"{path}.products", report, minimum=1, unique=True
        )
        _check_refs(method_products, product_names, f"{path}.products", report)
        method_id = item.get("id") if isinstance(item.get("id"), str) else ""
        for product in method_products:
            if product in product_method_membership:
                product_method_membership[product].append(method_id)
        for field_name in (
            "minimum_stroke_mm",
            "minimum_gap_mm",
            "minimum_text_height_mm",
        ):
            _check_number(item.get(field_name), f"{path}.{field_name}", report, 0.1, 50.0)
        _check_int(item.get("max_colors"), f"{path}.max_colors", report, 1, 64)
        for field_name in (
            "distress_allowed",
            "halftones_allowed",
            "template_required",
        ):
            _check_bool(item.get(field_name), f"{path}.{field_name}", report)
        for field_name in ("substrate_notes", "ink_notes", "uncertainty"):
            _check_string(item.get(field_name), f"{path}.{field_name}", report)
    for product, method_ids in product_method_membership.items():
        if len(method_ids) == 0:
            report.error(
                "production_methods",
                f"product {product!r} is not assigned to a production method",
            )
        elif len(method_ids) > 1:
            report.error(
                "production_methods",
                f"product {product!r} appears in multiple production methods: {method_ids}",
            )

    personalization_minimum = min(4, max(2, scope_size))
    personalization = _as_list(
        data.get("personalization_fields"),
        "personalization_fields",
        report,
        minimum=personalization_minimum,
    )
    personalization_ids = _record_ids(
        personalization, "personalization_fields", report, id_field="key"
    )

    output_profiles = _as_list(
        data.get("output_profiles"), "output_profiles", report, minimum=1
    )
    output_profile_ids = _record_ids(output_profiles, "output_profiles", report)

    persona_minimum = min(8, max(3, recipient_scope))
    personas = _as_list(
        data.get("personas"), "personas", report, minimum=persona_minimum
    )
    persona_ids = _record_ids(personas, "personas", report)
    for index, item in enumerate(personas):
        path = f"personas[{index}]"
        item = _as_mapping(item, path, report)
        _check_string(item.get("name"), f"{path}.name", report, maximum=120, allow_newline=False)
        _check_string(item.get("identity_stage"), f"{path}.identity_stage", report, maximum=300)
        for field_name in (
            "buyer_intents",
            "recipient_relationships",
            "emotional_triggers",
            "insider_language",
            "safe_visual_cues",
            "avoid",
        ):
            _check_string_list(item.get(field_name), f"{path}.{field_name}", report, minimum=1)
        refs = _check_string_list(item.get("product_fit"), f"{path}.product_fit", report, minimum=1, unique=True)
        _check_refs(refs, product_names, f"{path}.product_fit", report)
    _reject_structured_duplicates(
        personas,
        "personas",
        (
            "identity_stage",
            "buyer_intents",
            "recipient_relationships",
            "emotional_triggers",
        ),
        report,
    )

    pair_minimum = min(5, max(3, min(buyer_scope, recipient_scope)))
    pairs = _as_list(
        data.get("buyer_recipient_pairs"),
        "buyer_recipient_pairs",
        report,
        minimum=pair_minimum,
    )
    pair_ids = _record_ids(pairs, "buyer_recipient_pairs", report)

    occasion_minimum = min(8, max(4, scope_size))
    occasions = _as_list(
        data.get("occasions"), "occasions", report, minimum=occasion_minimum
    )
    occasion_ids = _record_ids(occasions, "occasions", report)

    for index, item in enumerate(pairs):
        path = f"buyer_recipient_pairs[{index}]"
        item = _as_mapping(item, path, report)
        _check_string(item.get("buyer"), f"{path}.buyer", report, maximum=160, allow_newline=False)
        _check_string(item.get("recipient"), f"{path}.recipient", report, maximum=160, allow_newline=False)
        _check_string(item.get("purchase_reason"), f"{path}.purchase_reason", report)
        occasion_refs = _check_string_list(
            item.get("strong_occasions"), f"{path}.strong_occasions", report, minimum=1, unique=True
        )
        _check_refs(occasion_refs, occasion_ids, f"{path}.strong_occasions", report)
        product_refs = _check_string_list(
            item.get("preferred_products"), f"{path}.preferred_products", report, minimum=1, unique=True
        )
        _check_refs(product_refs, product_names, f"{path}.preferred_products", report)

    for index, item in enumerate(occasions):
        path = f"occasions[{index}]"
        item = _as_mapping(item, path, report)
        _check_string(item.get("name"), f"{path}.name", report, maximum=120, allow_newline=False)
        _check_string(item.get("type"), f"{path}.type", report, maximum=80, allow_newline=False)
        _check_string(item.get("seasonality"), f"{path}.seasonality", report, maximum=300)
        _check_int(item.get("lead_time_days"), f"{path}.lead_time_days", report, 0, 365)
        for field_name in ("strong_angles", "avoid"):
            _check_string_list(item.get(field_name), f"{path}.{field_name}", report, minimum=1)
        product_refs = _check_string_list(
            item.get("common_products"), f"{path}.common_products", report, minimum=1, unique=True
        )
        _check_refs(product_refs, product_names, f"{path}.common_products", report)
        personalization_refs = _check_string_list(
            item.get("personalization"), f"{path}.personalization", report, unique=True
        )
        _check_refs(personalization_refs, personalization_ids, f"{path}.personalization", report)

    emotion_minimum = min(6, max(4, scope_size))
    emotions = _as_list(
        data.get("emotions"), "emotions", report, minimum=emotion_minimum
    )
    emotion_ids = _record_ids(emotions, "emotions", report)
    for index, item in enumerate(emotions):
        path = f"emotions[{index}]"
        item = _as_mapping(item, path, report)
        for field_name in ("name", "job_to_be_done", "design_direction", "copy_tone", "avoid"):
            _check_string(item.get(field_name), f"{path}.{field_name}", report)
        _check_string_list(item.get("use_when"), f"{path}.use_when", report, minimum=1)

    buyer_language_minimum = min(6, max(4, scope_size))
    buyer_language = _as_list(
        data.get("buyer_language"),
        "buyer_language",
        report,
        minimum=buyer_language_minimum,
    )
    for index, item in enumerate(buyer_language):
        path = f"buyer_language[{index}]"
        item = _as_mapping(item, path, report)
        for field_name in ("theme", "meaning", "avoid"):
            _check_string(item.get(field_name), f"{path}.{field_name}", report)
        _check_string_list(item.get("phrases"), f"{path}.phrases", report, minimum=1)
        _check_string_list(item.get("use_for"), f"{path}.use_for", report, minimum=1)

    visual = _as_mapping(data.get("visual_vocabulary"), "visual_vocabulary", report)
    motif_minimum = min(10, max(6, scope_size + 2))
    motifs = _as_list(
        visual.get("motifs"),
        "visual_vocabulary.motifs",
        report,
        minimum=motif_minimum,
    )
    motif_names = _unique_names(motifs, "visual_vocabulary.motifs", report, "name")
    for index, item in enumerate(motifs):
        path = f"visual_vocabulary.motifs[{index}]"
        item = _as_mapping(item, path, report)
        _check_string(item.get("meaning"), f"{path}.meaning", report)
        _check_string_list(item.get("use_with"), f"{path}.use_with", report, minimum=1)
        _check_string_list(item.get("avoid_with"), f"{path}.avoid_with", report, minimum=1)

    palettes = _as_list(
        visual.get("palettes"), "visual_vocabulary.palettes", report, minimum=3
    )
    palette_names = _unique_names(palettes, "visual_vocabulary.palettes", report, "name")
    for index, item in enumerate(palettes):
        path = f"visual_vocabulary.palettes[{index}]"
        item = _as_mapping(item, path, report)
        colors = _as_list(item.get("colors"), f"{path}.colors", report, minimum=2, maximum=12)
        normalized_colors: list[str] = []
        for color_index, color in enumerate(colors):
            parsed = _check_hex(color, f"{path}.colors[{color_index}]", report)
            if parsed:
                if parsed in normalized_colors:
                    report.error(f"{path}.colors[{color_index}]", f"duplicate color {parsed}")
                normalized_colors.append(parsed)
        _check_string(item.get("use_when"), f"{path}.use_when", report)
        _check_string(item.get("contrast_rule"), f"{path}.contrast_rule", report)

    typography = _as_list(
        visual.get("typography"), "visual_vocabulary.typography", report, minimum=3
    )
    _unique_names(typography, "visual_vocabulary.typography", report, "name")
    for index, item in enumerate(typography):
        path = f"visual_vocabulary.typography[{index}]"
        item = _as_mapping(item, path, report)
        for field_name in ("direction", "use_when", "avoid"):
            _check_string(item.get(field_name), f"{path}.{field_name}", report)

    compositions = _as_list(
        visual.get("compositions"), "visual_vocabulary.compositions", report, minimum=4
    )
    _unique_names(compositions, "visual_vocabulary.compositions", report, "name")
    for index, item in enumerate(compositions):
        path = f"visual_vocabulary.compositions[{index}]"
        item = _as_mapping(item, path, report)
        for field_name in ("hierarchy", "use_when", "avoid"):
            _check_string(item.get(field_name), f"{path}.{field_name}", report)

    for index, item in enumerate(products):
        path = f"product_fit[{index}]"
        item = _as_mapping(item, path, report)
        if item.get("priority") not in PRIORITIES:
            report.error(f"{path}.priority", f"expected one of {sorted(PRIORITIES)}")
        _check_int(item.get("max_words"), f"{path}.max_words", report, 0, 60)
        _check_string_list(item.get("works_best_with"), f"{path}.works_best_with", report, minimum=1)
        personalization_refs = _check_string_list(
            item.get("personalization"), f"{path}.personalization", report, unique=True
        )
        _check_refs(personalization_refs, personalization_ids, f"{path}.personalization", report)
        _check_string(item.get("print_notes"), f"{path}.print_notes", report)
        _check_string_list(item.get("avoid"), f"{path}.avoid", report, minimum=1)
        profile_ref = _check_id(item.get("output_profile_id"), f"{path}.output_profile_id", report)
        if profile_ref and profile_ref not in output_profile_ids:
            report.error(f"{path}.output_profile_id", f"unknown reference {profile_ref!r}")
        method_ref = _check_id(
            item.get("production_method_id"),
            f"{path}.production_method_id",
            report,
        )
        if method_ref and method_ref not in production_method_ids:
            report.error(
                f"{path}.production_method_id", f"unknown reference {method_ref!r}"
            )
        product_name = item.get("product")
        if isinstance(product_name, str) and method_ref:
            listed_methods = product_method_membership.get(product_name, [])
            if method_ref not in listed_methods:
                report.error(
                    f"{path}.production_method_id",
                    f"method {method_ref!r} does not list product {product_name!r}",
                )

    for index, item in enumerate(personalization):
        path = f"personalization_fields[{index}]"
        item = _as_mapping(item, path, report)
        for field_name in ("label", "example", "validation"):
            _check_string(item.get(field_name), f"{path}.{field_name}", report)
        product_refs = _check_string_list(
            item.get("products"), f"{path}.products", report, minimum=1, unique=True
        )
        _check_refs(product_refs, product_names, f"{path}.products", report)

    hook_minimum = min(8, max(5, scope_size + 2))
    hooks = _as_list(
        data.get("hook_patterns"), "hook_patterns", report, minimum=hook_minimum
    )
    hook_ids = _record_ids(hooks, "hook_patterns", report)
    for index, item in enumerate(hooks):
        path = f"hook_patterns[{index}]"
        item = _as_mapping(item, path, report)
        for field_name in ("template", "use_when", "example", "avoid"):
            _check_string(item.get(field_name), f"{path}.{field_name}", report)

    styles = _as_list(
        data.get("style_variants"), "style_variants", report, minimum=4, maximum=8
    )
    style_ids = _record_ids(styles, "style_variants", report)
    for index, item in enumerate(styles):
        path = f"style_variants[{index}]"
        item = _as_mapping(item, path, report)
        for field_name in ("label", "commercial_role", "description", "typography", "avoid"):
            _check_string(item.get(field_name), f"{path}.{field_name}", report)
        motif_refs = _check_string_list(item.get("motifs"), f"{path}.motifs", report, minimum=1, unique=True)
        _check_refs(motif_refs, motif_names, f"{path}.motifs", report)
        palette_refs = _check_string_list(
            item.get("palette_options"), f"{path}.palette_options", report, minimum=1, unique=True
        )
        _check_refs(palette_refs, palette_names, f"{path}.palette_options", report)

    style_axes: list[tuple[str, tuple[str, ...], tuple[str, ...]]] = []
    for item in styles:
        if not isinstance(item, dict):
            style_axes.append(("", (), ()))
            continue
        style_axes.append(
            (
                _normalized_text(item.get("typography")),
                tuple(sorted(_normalized_text(value) for value in item.get("motifs", []))),
                tuple(
                    sorted(
                        _normalized_text(value)
                        for value in item.get("palette_options", [])
                    )
                ),
            )
        )
    for left_index, left_axes in enumerate(style_axes):
        for right_index in range(left_index + 1, len(style_axes)):
            right_axes = style_axes[right_index]
            differing_axes = sum(
                left_value != right_value
                for left_value, right_value in zip(left_axes, right_axes)
            )
            if differing_axes < 2:
                report.error(
                    f"style_variants[{right_index}]",
                    f"must differ from style_variants[{left_index}] on at least two distinct creative axes: typography, motifs, or palette_options",
                )

    idea_archetypes = _as_list(
        data.get("idea_archetypes"), "idea_archetypes", report, minimum=3
    )
    idea_archetype_ids = _record_ids(idea_archetypes, "idea_archetypes", report)
    for index, item in enumerate(idea_archetypes):
        path = f"idea_archetypes[{index}]"
        item = _as_mapping(item, path, report)
        _check_string(
            item.get("label"), f"{path}.label", report, maximum=160, allow_newline=False
        )
        _check_string(item.get("purchase_logic"), f"{path}.purchase_logic", report)
        for field_name, valid_refs in (
            ("persona_ids", persona_ids),
            ("occasion_ids", occasion_ids),
            ("product_names", product_names),
            ("hook_ids", hook_ids),
        ):
            refs = _check_string_list(
                item.get(field_name),
                f"{path}.{field_name}",
                report,
                minimum=1,
                unique=True,
            )
            _check_refs(refs, valid_refs, f"{path}.{field_name}", report)
        axes = _check_string_list(
            item.get("required_variation_axes"),
            f"{path}.required_variation_axes",
            report,
            minimum=2,
            unique=True,
        )
        _check_refs(axes, VARIATION_AXES, f"{path}.required_variation_axes", report)
        _check_string_list(item.get("avoid"), f"{path}.avoid", report, minimum=1)

    creative_controls = _as_mapping(
        data.get("creative_controls"), "creative_controls", report
    )
    available_axes = _check_string_list(
        creative_controls.get("required_variation_axes"),
        "creative_controls.required_variation_axes",
        report,
        minimum=3,
        unique=True,
    )
    _check_refs(
        available_axes,
        VARIATION_AXES,
        "creative_controls.required_variation_axes",
        report,
    )
    minimum_axes = _check_int(
        creative_controls.get("minimum_distinct_axes_per_variant"),
        "creative_controls.minimum_distinct_axes_per_variant",
        report,
        2,
        6,
    )
    if minimum_axes is not None and minimum_axes > len(available_axes):
        report.error(
            "creative_controls.minimum_distinct_axes_per_variant",
            "cannot exceed the number of available variation axes",
        )
    _check_string_list(
        creative_controls.get("anti_generic_phrases"),
        "creative_controls.anti_generic_phrases",
        report,
        minimum=3,
        unique=True,
    )

    combination_rules = _as_list(
        data.get("combination_rules"), "combination_rules", report, minimum=1
    )
    _record_ids(combination_rules, "combination_rules", report)
    selector_contract = (
        ("persona_ids", persona_ids),
        ("occasion_ids", occasion_ids),
        ("product_names", product_names),
        ("style_variant_ids", style_ids),
        ("idea_archetype_ids", idea_archetype_ids),
    )
    for index, item in enumerate(combination_rules):
        path = f"combination_rules[{index}]"
        item = _as_mapping(item, path, report)
        selector_count = 0
        for field_name, valid_refs in selector_contract:
            refs = _check_string_list(
                item.get(field_name), f"{path}.{field_name}", report, unique=True
            )
            selector_count += len(refs)
            _check_refs(refs, valid_refs, f"{path}.{field_name}", report)
        if selector_count == 0:
            report.error(path, "requires at least one selector")
        if item.get("outcome") not in COMBINATION_RULE_OUTCOMES:
            report.error(
                f"{path}.outcome",
                f"expected one of {sorted(COMBINATION_RULE_OUTCOMES)}",
            )
        _check_string(item.get("reason"), f"{path}.reason", report)

    sensitivity_rules = _as_list(
        data.get("sensitivity_rules"), "sensitivity_rules", report, minimum=1
    )
    _record_ids(sensitivity_rules, "sensitivity_rules", report)
    for index, item in enumerate(sensitivity_rules):
        path = f"sensitivity_rules[{index}]"
        item = _as_mapping(item, path, report)
        _check_string_list(
            item.get("trigger_terms"),
            f"{path}.trigger_terms",
            report,
            minimum=1,
            unique=True,
        )
        for field_name, valid_refs in (
            ("persona_ids", persona_ids),
            ("occasion_ids", occasion_ids),
        ):
            refs = _check_string_list(
                item.get(field_name), f"{path}.{field_name}", report, unique=True
            )
            _check_refs(refs, valid_refs, f"{path}.{field_name}", report)
        action = item.get("action")
        if action not in SENSITIVITY_ACTIONS:
            report.error(
                f"{path}.action",
                f"found {action!r}; expected one of {sorted(SENSITIVITY_ACTIONS)}",
            )
        _check_string_list(
            item.get("constraints"), f"{path}.constraints", report, minimum=1
        )
        _check_string(item.get("rationale"), f"{path}.rationale", report)

    calibration = _as_mapping(
        data.get("concept_fit_calibration"), "concept_fit_calibration", report
    )
    thresholds: dict[str, int] = {}
    for field_name in ("go_score", "refine_score", "rework_score", "replace_score"):
        value = _check_int(
            calibration.get(field_name), f"concept_fit_calibration.{field_name}", report, 0, 25
        )
        if value is not None:
            thresholds[field_name] = value
    if len(thresholds) == 4 and not (
        thresholds["replace_score"]
        < thresholds["rework_score"]
        < thresholds["refine_score"]
        < thresholds["go_score"]
        <= 25
    ):
        report.error(
            "concept_fit_calibration",
            "thresholds must satisfy replace < rework < refine < go <= 25",
        )
    _check_string_list(
        calibration.get("high_fit_signals"),
        "concept_fit_calibration.high_fit_signals",
        report,
        minimum=1,
    )
    _check_string_list(
        calibration.get("weak_fit_signals"),
        "concept_fit_calibration.weak_fit_signals",
        report,
        minimum=1,
    )

    ip = _as_mapping(data.get("ip_safety"), "ip_safety", report)
    _check_string_list(ip.get("niche_specific_avoid"), "ip_safety.niche_specific_avoid", report, minimum=5)
    substitutions = _as_list(ip.get("safe_substitutions"), "ip_safety.safe_substitutions", report, minimum=3)
    for index, item in enumerate(substitutions):
        path = f"ip_safety.safe_substitutions[{index}]"
        item = _as_mapping(item, path, report)
        _check_string(item.get("risky"), f"{path}.risky", report)
        _check_string(item.get("replace_with"), f"{path}.replace_with", report)
    _check_string_list(
        ip.get("human_review_triggers"),
        "ip_safety.human_review_triggers",
        report,
        minimum=3,
    )

    product_profile_membership: dict[str, set[str]] = {}
    for index, item in enumerate(output_profiles):
        path = f"output_profiles[{index}]"
        item = _as_mapping(item, path, report)
        profile_id = item.get("id") if isinstance(item.get("id"), str) else ""
        profile_products = _check_string_list(
            item.get("products"), f"{path}.products", report, minimum=1, unique=True
        )
        _check_refs(profile_products, product_names, f"{path}.products", report)
        product_profile_membership[profile_id] = set(profile_products)
        aspect = _check_string(item.get("aspect_ratio"), f"{path}.aspect_ratio", report, maximum=16, allow_newline=False)
        if aspect and not ASPECT_RATIO_PATTERN.fullmatch(aspect):
            report.error(f"{path}.aspect_ratio", "must use W:H with positive integers")
        if item.get("file_format") not in {"PNG", "SVG", "PDF"}:
            report.error(f"{path}.file_format", "expected PNG, SVG, or PDF")
        _check_int(item.get("dpi"), f"{path}.dpi", report, 72, 1200)
        width = item.get("width_px")
        height = item.get("height_px")
        if (width is None) != (height is None):
            report.error(path, "width_px and height_px must both be set or both be null")
        if width is not None:
            _check_int(width, f"{path}.width_px", report, 256, 50000)
            _check_int(height, f"{path}.height_px", report, 256, 50000)
        if _check_bool(item.get("alpha_preferred"), f"{path}.alpha_preferred", report) is False:
            report.error(
                f"{path}.alpha_preferred",
                "must be true because every final generated POD asset requires alpha",
            )
        _check_string(item.get("safe_zone"), f"{path}.safe_zone", report)
        _check_string(item.get("bleed"), f"{path}.bleed", report)
        _check_bool(
            item.get("marketplace_template_required"),
            f"{path}.marketplace_template_required",
            report,
        )

    for index, item in enumerate(products):
        if not isinstance(item, dict):
            continue
        profile_id = item.get("output_profile_id")
        product = item.get("product")
        if isinstance(profile_id, str) and isinstance(product, str):
            if product not in product_profile_membership.get(profile_id, set()):
                report.error(
                    f"product_fit[{index}].output_profile_id",
                    f"profile {profile_id!r} does not list product {product!r}",
                )

    defaults = _as_mapping(data.get("output_defaults"), "output_defaults", report)
    background = _as_mapping(defaults.get("background"), "output_defaults.background", report)
    if background.get("preferred_mode") != "transparent":
        report.error("output_defaults.background.preferred_mode", "must be 'transparent'")
    if background.get("transparent_format") != "PNG":
        report.error("output_defaults.background.transparent_format", "must be 'PNG'")
    if background.get("require_real_alpha") is not True:
        report.error("output_defaults.background.require_real_alpha", "must be true")
    if background.get("capability_policy") not in TRANSPARENCY_CAPABILITY_POLICIES:
        report.error(
            "output_defaults.background.capability_policy",
            f"expected one of {sorted(TRANSPARENCY_CAPABILITY_POLICIES)}",
        )
    if background.get("supported_model_route") not in SUPPORTED_TRANSPARENCY_ROUTES:
        report.error(
            "output_defaults.background.supported_model_route",
            f"expected one of {sorted(SUPPORTED_TRANSPARENCY_ROUTES)}",
        )
    if background.get("unknown_model_route") not in UNKNOWN_TRANSPARENCY_ROUTES:
        report.error(
            "output_defaults.background.unknown_model_route",
            f"expected one of {sorted(UNKNOWN_TRANSPARENCY_ROUTES)}",
        )
    if background.get("unsupported_model_route") not in UNSUPPORTED_TRANSPARENCY_ROUTES:
        report.error(
            "output_defaults.background.unsupported_model_route",
            f"expected one of {sorted(UNSUPPORTED_TRANSPARENCY_ROUTES)}",
        )
    max_transparent_attempts = _check_int(
        background.get("max_transparent_attempts"),
        "output_defaults.background.max_transparent_attempts",
        report,
        1,
        5,
    )
    unknown_probe_attempts = _check_int(
        background.get("unknown_probe_attempts"),
        "output_defaults.background.unknown_probe_attempts",
        report,
        1,
        3,
    )
    if (
        max_transparent_attempts is not None
        and unknown_probe_attempts is not None
        and unknown_probe_attempts > max_transparent_attempts
    ):
        report.error(
            "output_defaults.background.unknown_probe_attempts",
            "must not exceed max_transparent_attempts",
        )
    if background.get("fallback_condition") not in TRANSPARENCY_FALLBACK_CONDITIONS:
        report.error(
            "output_defaults.background.fallback_condition",
            f"expected one of {sorted(TRANSPARENCY_FALLBACK_CONDITIONS)}",
        )
    for field_name in (
        "require_native_transparency_option_when_available",
        "hard_fail_supported_after_attempts",
        "final_output_must_have_alpha",
    ):
        if _check_bool(
            background.get(field_name),
            f"output_defaults.background.{field_name}",
            report,
        ) is False:
            report.error(f"output_defaults.background.{field_name}", "must be true")
    if background.get("fallback_enabled") is not True:
        report.error("output_defaults.background.fallback_enabled", "must be true")
    safe_palette = _check_string_list(
        background.get("safe_palette"),
        "output_defaults.background.safe_palette",
        report,
        minimum=5,
        maximum=5,
        unique=True,
    )
    normalized_safe: list[str] = []
    for index, color in enumerate(safe_palette):
        parsed = _check_hex(color, f"output_defaults.background.safe_palette[{index}]", report)
        if parsed:
            normalized_safe.append(parsed)
    if set(normalized_safe) != set(SAFE_BACKGROUND_PALETTE):
        report.error(
            "output_defaults.background.safe_palette",
            f"must contain exactly {list(SAFE_BACKGROUND_PALETTE)}",
        )
    if background.get("selection_method") != "max-color-distance-from-artwork":
        report.error(
            "output_defaults.background.selection_method",
            "must be 'max-color-distance-from-artwork'",
        )
    mandatory = _check_string(
        background.get("mandatory_prompt"),
        "output_defaults.background.mandatory_prompt",
        report,
        maximum=200,
        allow_newline=False,
    )
    if mandatory and "NO SHADOWS" not in mandatory.upper():
        report.error(
            "output_defaults.background.mandatory_prompt",
            "must explicitly include NO SHADOWS",
        )
    forbidden = _check_string_list(
        background.get("forbidden"),
        "output_defaults.background.forbidden",
        report,
        minimum=5,
    )
    if not any("green" in item.lower() for item in forbidden):
        report.error(
            "output_defaults.background.forbidden",
            "must explicitly forbid green/chroma-key backgrounds",
        )

    product_contrast = _as_mapping(
        defaults.get("product_contrast"), "output_defaults.product_contrast", report
    )
    expected_tones = {
        "dark_surface_use": "light",
        "light_surface_use": "dark",
        "mid_surface_use": "high-contrast-dual-tone",
    }
    for field_name, expected in expected_tones.items():
        if product_contrast.get(field_name) != expected:
            report.error(
                f"output_defaults.product_contrast.{field_name}",
                f"must be {expected!r}",
            )
    minimum_contrast = _check_number(
        product_contrast.get("minimum_contrast_ratio"),
        "output_defaults.product_contrast.minimum_contrast_ratio",
        report,
        3.0,
        21.0,
    )
    _check_string(
        product_contrast.get("unknown_surface_action"),
        "output_defaults.product_contrast.unknown_surface_action",
        report,
        maximum=120,
        allow_newline=False,
    )
    min_variants = _check_int(
        defaults.get("variant_count_min"), "output_defaults.variant_count_min", report, 1, 4
    )
    max_variants = _check_int(
        defaults.get("variant_count_max"), "output_defaults.variant_count_max", report, 1, 4
    )
    default_variants = _check_int(
        defaults.get("variant_count_default"),
        "output_defaults.variant_count_default",
        report,
        1,
        4,
    )
    if None not in (min_variants, max_variants, default_variants) and not (
        min_variants <= default_variants <= max_variants
    ):
        report.error(
            "output_defaults.variant_count_default",
            "must fall between variant_count_min and variant_count_max",
        )
    if defaults.get("copy_mode_default") not in COPY_MODES:
        report.error(
            "output_defaults.copy_mode_default",
            f"expected one of {sorted(COPY_MODES)}",
        )

    qa = _as_mapping(data.get("qa_rules"), "qa_rules", report)
    _check_int(qa.get("max_colors"), "qa_rules.max_colors", report, 1, 12)
    _check_string(qa.get("min_text_legibility"), "qa_rules.min_text_legibility", report)
    copy_modes = set(
        _check_string_list(qa.get("copy_modes"), "qa_rules.copy_modes", report, minimum=3, unique=True)
    )
    if copy_modes != COPY_MODES:
        report.error("qa_rules.copy_modes", f"must contain exactly {sorted(COPY_MODES)}")
    for field_name in (
        "alpha_validation_required",
        "rerender_on_alpha_failure",
        "isolated_artwork",
        "no_shadows",
        "product_contrast_required",
    ):
        if _check_bool(qa.get(field_name), f"qa_rules.{field_name}", report) is False:
            report.error(f"qa_rules.{field_name}", "must be true")
    fallback_on_supported_failure = _check_bool(
        qa.get("fallback_on_supported_alpha_failure"),
        "qa_rules.fallback_on_supported_alpha_failure",
        report,
    )
    if fallback_on_supported_failure is not False:
        report.error(
            "qa_rules.fallback_on_supported_alpha_failure",
            "must be false; supported models must rerender or hard-fail instead of using solid fallback",
        )
    _check_number(
        qa.get("minimum_fully_transparent_ratio"),
        "qa_rules.minimum_fully_transparent_ratio",
        report,
        0.001,
        0.95,
    )
    _check_number(
        qa.get("minimum_transparent_border_ratio"),
        "qa_rules.minimum_transparent_border_ratio",
        report,
        0.90,
        1.0,
    )
    minimum_visible_ratio = _check_number(
        qa.get("minimum_visible_ratio"),
        "qa_rules.minimum_visible_ratio",
        report,
        0.0001,
        0.25,
    )
    maximum_significant_visible_ratio = _check_number(
        qa.get("maximum_significant_visible_ratio"),
        "qa_rules.maximum_significant_visible_ratio",
        report,
        0.25,
        0.99,
    )
    if (
        minimum_visible_ratio is not None
        and maximum_significant_visible_ratio is not None
        and minimum_visible_ratio >= maximum_significant_visible_ratio
    ):
        report.error(
            "qa_rules.minimum_visible_ratio",
            "must be lower than maximum_significant_visible_ratio",
        )
    _check_number(
        qa.get("maximum_significant_bbox_fill_ratio"),
        "qa_rules.maximum_significant_bbox_fill_ratio",
        report,
        0.5,
        0.99,
    )
    _check_number(
        qa.get("minimum_significant_margin_ratio"),
        "qa_rules.minimum_significant_margin_ratio",
        report,
        0.0,
        0.25,
    )
    _check_int(
        qa.get("significant_alpha_threshold"),
        "qa_rules.significant_alpha_threshold",
        report,
        2,
        254,
    )
    qa_contrast = _check_number(
        qa.get("minimum_contrast_ratio"),
        "qa_rules.minimum_contrast_ratio",
        report,
        3.0,
        21.0,
    )
    if minimum_contrast is not None and qa_contrast is not None and abs(minimum_contrast - qa_contrast) > 1e-9:
        report.error(
            "qa_rules.minimum_contrast_ratio",
            "must match output_defaults.product_contrast.minimum_contrast_ratio",
        )
    _check_string(qa.get("background_edge_rule"), "qa_rules.background_edge_rule", report)

    brief_minimum = min(6, max(4, scope_size))
    briefs = _as_list(
        data.get("sample_briefs"), "sample_briefs", report, minimum=brief_minimum
    )
    brief_ids = _record_ids(briefs, "sample_briefs", report)
    del brief_ids  # IDs are validated for uniqueness even though not cross-referenced.

    persona_by_id = {
        item.get("id"): item for item in personas if isinstance(item, dict) and isinstance(item.get("id"), str)
    }
    occasion_by_id = {
        item.get("id"): item for item in occasions if isinstance(item, dict) and isinstance(item.get("id"), str)
    }
    pair_by_id = {
        item.get("id"): item for item in pairs if isinstance(item, dict) and isinstance(item.get("id"), str)
    }
    product_by_name = {
        item.get("product"): item for item in products if isinstance(item, dict) and isinstance(item.get("product"), str)
    }

    for index, item in enumerate(briefs):
        path = f"sample_briefs[{index}]"
        item = _as_mapping(item, path, report)
        _check_string(item.get("title"), f"{path}.title", report)
        persona_ref = _check_id(item.get("persona_id"), f"{path}.persona_id", report)
        if persona_ref and persona_ref not in persona_ids:
            report.error(f"{path}.persona_id", f"unknown reference {persona_ref!r}")
        pair_ref = _check_id(
            item.get("buyer_recipient_pair_id"), f"{path}.buyer_recipient_pair_id", report
        )
        if pair_ref and pair_ref not in pair_ids:
            report.error(f"{path}.buyer_recipient_pair_id", f"unknown reference {pair_ref!r}")
        buyer = _check_string(item.get("buyer"), f"{path}.buyer", report, maximum=160, allow_newline=False)
        recipient = _check_string(
            item.get("recipient"), f"{path}.recipient", report, maximum=160, allow_newline=False
        )
        occasion_ref = _check_id(item.get("occasion_id"), f"{path}.occasion_id", report)
        if occasion_ref and occasion_ref not in occasion_ids:
            report.error(f"{path}.occasion_id", f"unknown reference {occasion_ref!r}")
        emotion_ref = _check_id(item.get("emotion_id"), f"{path}.emotion_id", report)
        if emotion_ref and emotion_ref not in emotion_ids:
            report.error(f"{path}.emotion_id", f"unknown reference {emotion_ref!r}")
        style_ref = _check_id(item.get("style_variant_id"), f"{path}.style_variant_id", report)
        if style_ref and style_ref not in style_ids:
            report.error(f"{path}.style_variant_id", f"unknown reference {style_ref!r}")
        product = _check_string(item.get("product"), f"{path}.product", report, maximum=120, allow_newline=False)
        if product and product not in product_names:
            report.error(f"{path}.product", f"unknown product {product!r}")
        profile_ref = _check_id(item.get("output_profile_id"), f"{path}.output_profile_id", report)
        if profile_ref and profile_ref not in output_profile_ids:
            report.error(f"{path}.output_profile_id", f"unknown reference {profile_ref!r}")
        if product and profile_ref:
            expected_profile = product_by_name.get(product, {}).get("output_profile_id")
            if expected_profile and profile_ref != expected_profile:
                report.error(
                    f"{path}.output_profile_id",
                    f"expected {expected_profile!r} for product {product!r}",
                )

        copy = _as_mapping(item.get("copy"), f"{path}.copy", report)
        copy_mode = copy.get("mode")
        if copy_mode not in COPY_MODES:
            report.error(f"{path}.copy.mode", f"expected one of {sorted(COPY_MODES)}")
        copy_text = copy.get("text")
        if not isinstance(copy_text, str):
            report.error(f"{path}.copy.text", "must be a string")
        elif copy_mode == "none" and copy_text.strip():
            report.error(f"{path}.copy.text", "must be empty when mode is 'none'")
        elif copy_mode in {"exact", "proposed"} and not copy_text.strip():
            report.error(f"{path}.copy.text", f"must be non-empty when mode is {copy_mode!r}")
        _check_string(copy.get("language"), f"{path}.copy.language", report, maximum=35, allow_newline=False)

        _check_string(item.get("visual_direction"), f"{path}.visual_direction", report)
        personalization_refs = _check_string_list(
            item.get("personalization"), f"{path}.personalization", report, unique=True
        )
        _check_refs(personalization_refs, personalization_ids, f"{path}.personalization", report)
        _check_string(item.get("why_it_fits"), f"{path}.why_it_fits", report)
        _check_string(item.get("ip_notes"), f"{path}.ip_notes", report)

        surface = _as_mapping(item.get("product_surface"), f"{path}.product_surface", report)
        tone = surface.get("tone")
        if tone not in SURFACE_TONES:
            report.error(f"{path}.product_surface.tone", f"expected one of {sorted(SURFACE_TONES)}")
        color = surface.get("color")
        parsed_surface_color = None
        if color is not None:
            parsed_surface_color = _check_hex(color, f"{path}.product_surface.color", report)
        if parsed_surface_color and tone in {"dark", "light", "mid"}:
            computed_tone = classify_surface_tone(parsed_surface_color)
            if computed_tone != tone:
                report.error(
                    f"{path}.product_surface.tone",
                    f"declared tone {tone!r} conflicts with color {parsed_surface_color} ({computed_tone})",
                )
        if tone in {"dark", "light", "mid"} and color is None:
            report.warn(
                f"{path}.product_surface.color",
                "tone is known but an exact product color would improve contrast scoring",
            )

        if pair_ref and pair_ref in pair_by_id:
            pair = pair_by_id[pair_ref]
            if buyer and pair.get("buyer") != buyer:
                report.error(
                    f"{path}.buyer",
                    f"does not match buyer in pair {pair_ref!r}",
                )
            if recipient and isinstance(pair.get("recipient"), str):
                pair_recipient = pair["recipient"].lower()
                if recipient.lower() not in pair_recipient and pair_recipient not in recipient.lower():
                    report.warn(
                        f"{path}.recipient",
                        f"is more specific than pair recipient {pair['recipient']!r}; confirm the relationship",
                    )

        if persona_ref and product and persona_ref in persona_by_id:
            persona_products = persona_by_id[persona_ref].get("product_fit", [])
            if isinstance(persona_products, list) and product not in persona_products:
                report.warn(
                    f"{path}.product",
                    f"product {product!r} is not listed for persona {persona_ref!r}",
                )
        if occasion_ref and product and occasion_ref in occasion_by_id:
            occasion_products = occasion_by_id[occasion_ref].get("common_products", [])
            if isinstance(occasion_products, list) and product not in occasion_products:
                report.warn(
                    f"{path}.product",
                    f"product {product!r} is not listed for occasion {occasion_ref!r}",
                )

    # Heuristic warnings for low-information filler.
    filler_phrases = {"high quality", "best seller", "unique design", "something nice"}
    corpus: list[str] = []
    for record in buyer_language:
        if isinstance(record, dict):
            corpus.extend(str(value) for value in record.get("phrases", []) if isinstance(value, str))
    for phrase in corpus:
        if phrase.strip().lower() in filler_phrases:
            report.warn("buyer_language", f"generic filler phrase detected: {phrase!r}")

    return report
