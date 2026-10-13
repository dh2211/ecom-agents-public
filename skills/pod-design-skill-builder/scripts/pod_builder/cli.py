"""Command-line entry point for the POD design skill builder."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Sequence

from .constants import SCHEMA_VERSION
from .migration import normalize_data
from .packaging import BuildError, build_target_atomic, package_target
from .utils import read_json, slugify, validate_slug, write_text
from .validation import validate_data


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Build a validated niche-specific POD design agent skill"
    )
    niche = parser.add_mutually_exclusive_group(required=True)
    niche.add_argument(
        "--niche-slug",
        help="Explicit lowercase ASCII slug, for example giao-vien or teacher",
    )
    niche.add_argument(
        "--niche",
        help="Deprecated alias; a Unicode value is transliterated to an ASCII slug",
    )
    parser.add_argument(
        "--data-json",
        required=True,
        help="Schema 3.2, schema 3.1/3.0, or legacy 2.0 master data JSON",
    )
    parser.add_argument("--output", default="dist", help="Output directory; default: ./dist")
    parser.add_argument("--validate-only", action="store_true")
    parser.add_argument(
        "--write-normalized-data",
        help="Write migrated/normalized schema 3.2 JSON to this path",
    )
    parser.add_argument("--zip", action="store_true", help="Also create exact filename skill.zip")
    parser.add_argument(
        "--replace-generated",
        action="store_true",
        help="Replace only a target whose manifest proves this builder created it",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help=argparse.SUPPRESS,
    )
    parser.add_argument(
        "--platform-validator",
        help="Path to skill-creator quick_validate.py; common ChatGPT paths are auto-detected",
    )
    parser.add_argument(
        "--allow-internal-validator",
        action="store_true",
        help="Allow packaging without the platform validator; intended only for external environments",
    )
    parser.add_argument("--warnings-as-errors", action="store_true")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.force:
            print(
                "warning: --force is deprecated; using safe --replace-generated semantics",
                file=sys.stderr,
            )
            args.replace_generated = True

        raw_niche = args.niche_slug if args.niche_slug is not None else args.niche
        requested_slug = raw_niche.strip().lower() if args.niche_slug else slugify(raw_niche)
        if not validate_slug(requested_slug):
            raise ValueError(
                "niche slug must contain lowercase ASCII letters, digits, and single hyphens"
            )

        data, migration_warnings = normalize_data(
            read_json(Path(args.data_json)), requested_slug
        )
        report = validate_data(data, requested_slug)
        report.warnings[:0] = migration_warnings

        if report.warnings:
            print(f"validation warnings ({len(report.warnings)}):", file=sys.stderr)
            for warning in report.warnings:
                print(f"- {warning}", file=sys.stderr)
        if report.errors:
            print(f"validation failed with {len(report.errors)} error(s):", file=sys.stderr)
            for error in report.errors:
                print(f"- {error}", file=sys.stderr)
            return 2
        if args.warnings_as_errors and report.warnings:
            print("warnings-as-errors is enabled; refusing to continue", file=sys.stderr)
            return 3

        print(
            f"valid: {data['niche_slug']} master data (schema {SCHEMA_VERSION}; "
            f"evidence={data['data_provenance']['evidence_status']}; "
            f"legal={data['data_provenance']['legal_status']})"
        )

        if args.write_normalized_data:
            write_text(
                Path(args.write_normalized_data),
                json.dumps(data, indent=2, ensure_ascii=False),
            )
            print(f"normalized-data: {Path(args.write_normalized_data).resolve()}")

        if args.validate_only:
            return 0

        script_dir = Path(__file__).resolve().parent.parent
        assets_root = script_dir.parent / "assets" / "target-scripts"
        if not assets_root.is_dir():
            raise BuildError(f"target script assets are missing: {assets_root}")
        output_dir = Path(args.output).resolve()
        validator_path = Path(args.platform_validator) if args.platform_validator else None
        skill_dir, validator = build_target_atomic(
            data,
            output_dir,
            assets_root,
            replace_generated=args.replace_generated,
            platform_validator=validator_path,
            allow_internal_validator=args.allow_internal_validator,
        )
        print(f"created: {skill_dir}")
        print(f"validator: {validator if validator else 'internal-only (explicitly allowed)'}")

        if args.zip:
            zip_path, zip_validator = package_target(
                skill_dir,
                output_dir,
                replace_archive=args.replace_generated,
                platform_validator=validator_path,
                allow_internal_validator=args.allow_internal_validator,
            )
            print(f"packaged: {zip_path}")
            print(f"package-validator: {zip_validator if zip_validator else 'internal-only'}")
        return 0
    except (BuildError, OSError, RuntimeError, TypeError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
