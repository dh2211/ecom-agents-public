#!/usr/bin/env python3
"""Select small slices of the canonical niche master data."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


def find_data_file() -> Path:
    references = Path(__file__).resolve().parent.parent / "references"
    matches = sorted(references.glob("*-master-data.json"))
    if len(matches) != 1:
        raise RuntimeError(
            f"expected exactly one *-master-data.json in {references}; found {len(matches)}"
        )
    return matches[0]


def load_data() -> dict[str, Any]:
    path = find_data_file()
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise RuntimeError("master data root must be an object")
    return data


def find_record(records: Any, field: str, value: str, label: str) -> dict[str, Any]:
    if not isinstance(records, list):
        raise KeyError(f"domain {label!r} is unavailable")
    for record in records:
        if isinstance(record, dict) and record.get(field) == value:
            return record
    raise KeyError(f"unknown {label}: {value!r}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Select exact POD master-data records")
    parser.add_argument("--list-domains", action="store_true")
    parser.add_argument("--market")
    parser.add_argument("--claim")
    parser.add_argument("--persona")
    parser.add_argument("--pair")
    parser.add_argument("--occasion")
    parser.add_argument("--emotion")
    parser.add_argument("--product")
    parser.add_argument("--hook")
    parser.add_argument("--archetype")
    parser.add_argument("--style")
    parser.add_argument("--method")
    parser.add_argument("--combination-rule")
    parser.add_argument("--sensitivity-rule")
    parser.add_argument("--brief")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        data = load_data()
        if args.list_domains:
            result = {
                "niche_slug": data.get("niche_slug"),
                "domains": {
                    "markets": [item.get("id") for item in data.get("market_contexts", [])],
                    "claims": [item.get("id") for item in data.get("evidence_claims", [])],
                    "personas": [item.get("id") for item in data.get("personas", [])],
                    "pairs": [item.get("id") for item in data.get("buyer_recipient_pairs", [])],
                    "occasions": [item.get("id") for item in data.get("occasions", [])],
                    "emotions": [item.get("id") for item in data.get("emotions", [])],
                    "products": [item.get("product") for item in data.get("product_fit", [])],
                    "hooks": [item.get("id") for item in data.get("hook_patterns", [])],
                    "archetypes": [item.get("id") for item in data.get("idea_archetypes", [])],
                    "styles": [item.get("id") for item in data.get("style_variants", [])],
                    "methods": [item.get("id") for item in data.get("production_methods", [])],
                    "combination_rules": [item.get("id") for item in data.get("combination_rules", [])],
                    "sensitivity_rules": [item.get("id") for item in data.get("sensitivity_rules", [])],
                    "briefs": [item.get("id") for item in data.get("sample_briefs", [])],
                },
            }
            print(json.dumps(result, indent=2, ensure_ascii=False))
            return 0

        requested = any(
            getattr(args, name)
            for name in (
                "market",
                "claim",
                "persona",
                "pair",
                "occasion",
                "emotion",
                "product",
                "hook",
                "archetype",
                "style",
                "method",
                "combination_rule",
                "sensitivity_rule",
                "brief",
            )
        )
        if not requested:
            raise ValueError("select at least one record or use --list-domains")

        result: dict[str, Any] = {
            "niche_slug": data.get("niche_slug"),
            "data_provenance": data.get("data_provenance"),
            "output_defaults": data.get("output_defaults"),
            "qa_rules": data.get("qa_rules"),
        }
        if args.market:
            result["market_context"] = find_record(
                data.get("market_contexts"), "id", args.market, "market context"
            )
        if args.claim:
            result["evidence_claim"] = find_record(
                data.get("evidence_claims"), "id", args.claim, "evidence claim"
            )
        if args.persona:
            result["persona"] = find_record(data.get("personas"), "id", args.persona, "persona")
        if args.pair:
            result["buyer_recipient_pair"] = find_record(
                data.get("buyer_recipient_pairs"), "id", args.pair, "buyer-recipient pair"
            )
        if args.occasion:
            result["occasion"] = find_record(data.get("occasions"), "id", args.occasion, "occasion")
        if args.emotion:
            result["emotion"] = find_record(data.get("emotions"), "id", args.emotion, "emotion")
        if args.product:
            product = find_record(data.get("product_fit"), "product", args.product, "product")
            result["product"] = product
            result["output_profile"] = find_record(
                data.get("output_profiles"),
                "id",
                str(product.get("output_profile_id")),
                "output profile",
            )
            result["production_method"] = find_record(
                data.get("production_methods"),
                "id",
                str(product.get("production_method_id")),
                "production method",
            )
        if args.hook:
            result["hook"] = find_record(data.get("hook_patterns"), "id", args.hook, "hook")
        if args.archetype:
            result["idea_archetype"] = find_record(
                data.get("idea_archetypes"), "id", args.archetype, "idea archetype"
            )
        if args.style:
            result["style"] = find_record(data.get("style_variants"), "id", args.style, "style")
        if args.method:
            result["production_method"] = find_record(
                data.get("production_methods"), "id", args.method, "production method"
            )
        if args.combination_rule:
            result["combination_rule"] = find_record(
                data.get("combination_rules"),
                "id",
                args.combination_rule,
                "combination rule",
            )
        if args.sensitivity_rule:
            result["sensitivity_rule"] = find_record(
                data.get("sensitivity_rules"),
                "id",
                args.sensitivity_rule,
                "sensitivity rule",
            )
        if args.brief:
            result["sample_brief"] = find_record(data.get("sample_briefs"), "id", args.brief, "brief")

        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0
    except (KeyError, RuntimeError, ValueError, json.JSONDecodeError, OSError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
