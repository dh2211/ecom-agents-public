from __future__ import annotations

import copy
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
import zipfile
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from pod_builder.migration import normalize_data
from pod_builder.packaging import BuildError, build_target_atomic, package_target
from pod_builder.validation import validate_data

SAMPLE = ROOT / "references" / "teacher-example-data.json"
PET_SAMPLE = ROOT / "references" / "pet-memorial-example-data.json"
SCHEMA = ROOT / "references" / "niche-data.schema.json"
ASSETS = ROOT / "assets" / "target-scripts"


def load_teacher() -> dict:
    return json.loads(SAMPLE.read_text(encoding="utf-8"))


def add_evidence_contract(data: dict) -> dict:
    data = copy.deepcopy(data)
    data["schema_version"] = "3.2"
    source_ids = []
    for index, source in enumerate(data["data_provenance"]["sources"], start=1):
        source_id = f"source-{index}"
        source["id"] = source_id
        source_ids.append(source_id)
    data["market_contexts"] = [
        {
            "id": "us-gift-market",
            "marketplace": "cross-marketplace",
            "locale": "en-US",
            "region": "US",
            "measurement_system": "imperial",
            "restricted_claims": ["guaranteed learning outcomes"],
            "output_notes": ["Use US English and verify each marketplace template."],
            "review_by": "2099-12-31",
        }
    ]
    data["evidence_claims"] = [
        {
            "id": "teacher-gift-hypothesis",
            "claim_type": "market-hypothesis",
            "statement": "Teacher identity and appreciation occasions are plausible POD gift angles.",
            "status": "hypothesis",
            "source_ids": source_ids,
            "market_context_ids": ["us-gift-market"],
            "review_by": "2099-12-31",
            "confidence": "low",
        }
    ]
    return data


def add_production_contract(data: dict) -> dict:
    data = add_evidence_contract(data)
    method_specs = [
        (
            "apparel-dtg",
            "DTG apparel baseline",
            ["t-shirt", "sweatshirt", "tote"],
            "direct-to-garment",
        ),
        (
            "sublimation-hard-goods",
            "Sublimation hard-goods baseline",
            ["mug", "ornament", "blanket"],
            "sublimation",
        ),
        (
            "printed-flat-goods",
            "Printed flat-goods baseline",
            ["poster", "sticker"],
            "digital-print",
        ),
    ]
    data["production_methods"] = []
    product_to_method = {}
    for method_id, label, products, process in method_specs:
        data["production_methods"].append(
            {
                "id": method_id,
                "label": label,
                "process": process,
                "products": products,
                "minimum_stroke_mm": 0.8,
                "minimum_gap_mm": 0.8,
                "minimum_text_height_mm": 4.0,
                "max_colors": 8,
                "distress_allowed": True,
                "halftones_allowed": True,
                "substrate_notes": "Provider-dependent; verify the selected product blank.",
                "ink_notes": "Use a provider-approved color profile and test print.",
                "template_required": True,
                "uncertainty": "baseline-provider-template-required",
            }
        )
        for product in products:
            product_to_method[product] = method_id
    for product in data["product_fit"]:
        product["production_method_id"] = product_to_method[product["product"]]
    return data


def add_creative_contract(data: dict) -> dict:
    data = add_production_contract(data)
    data["idea_archetypes"] = [
        {
            "id": "identity-pride",
            "label": "Identity pride",
            "purchase_logic": "Self-purchase or peer gift rooted in a specific educator identity.",
            "persona_ids": ["kindergarten-teacher", "math-teacher"],
            "occasion_ids": ["back-to-school"],
            "product_names": ["t-shirt", "sweatshirt"],
            "hook_ids": ["role-with-trait", "classroom-role-humor"],
            "required_variation_axes": ["composition", "typography", "motif"],
            "avoid": ["generic occupation badge without a recipient or occasion"],
        },
        {
            "id": "appreciation-gift",
            "label": "Appreciation gift",
            "purchase_logic": "A buyer thanks an educator for a specific contribution.",
            "persona_ids": ["kindergarten-teacher", "special-education-teacher"],
            "occasion_ids": ["teacher-appreciation", "staff-appreciation"],
            "product_names": ["mug", "tote", "sweatshirt"],
            "hook_ids": ["impact-contrast", "support-promise"],
            "required_variation_axes": ["hook", "composition", "palette"],
            "avoid": ["unsupported promises about student outcomes"],
        },
        {
            "id": "personalized-milestone",
            "label": "Personalized milestone",
            "purchase_logic": "A dated or named keepsake marks a career transition.",
            "persona_ids": ["first-year-teacher", "retired-teacher"],
            "occasion_ids": ["first-year-teaching", "teacher-retirement"],
            "product_names": ["mug", "blanket", "ornament", "poster"],
            "hook_ids": ["name-role-year", "career-legacy"],
            "required_variation_axes": ["personalization", "composition", "typography"],
            "avoid": ["invented dates, names, or years of service"],
        },
    ]
    data["creative_controls"] = {
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
    }
    data["combination_rules"] = [
        {
            "id": "retirement-no-childlike-style",
            "persona_ids": ["retired-teacher"],
            "occasion_ids": ["teacher-retirement"],
            "product_names": [],
            "style_variant_ids": ["cute-playful"],
            "idea_archetype_ids": ["personalized-milestone"],
            "outcome": "forbid",
            "reason": "Formal retirement tributes should not default to a childlike treatment.",
        }
    ]
    data["sensitivity_rules"] = [
        {
            "id": "no-medical-outcome-claims",
            "trigger_terms": ["cures", "guarantees recovery", "fixes disability"],
            "persona_ids": ["special-education-teacher", "school-counselor"],
            "occasion_ids": [],
            "action": "refuse",
            "constraints": ["Remove medical or guaranteed-outcome language."],
            "rationale": "POD copy must not make unsupported health or disability claims.",
        },
        {
            "id": "burnout-humor-review",
            "trigger_terms": ["burnout", "surviving on caffeine"],
            "persona_ids": [],
            "occasion_ids": ["teacher-appreciation"],
            "action": "constrain",
            "constraints": ["Keep humor respectful and do not trivialize distress."],
            "rationale": "Appreciation gifts should not reduce the recipient to exhaustion.",
        },
    ]
    return data


def request_from_brief(
    data: dict,
    brief_index: int = 0,
    *,
    idea_archetype_id: str = "appreciation-gift",
    hook_pattern_id: str = "impact-contrast",
    style_variant_ids: list[str] | None = None,
) -> dict:
    brief = data["sample_briefs"][brief_index]
    product = next(
        item for item in data["product_fit"] if item["product"] == brief["product"]
    )
    styles = style_variant_ids or [brief["style_variant_id"], "minimal-premium"]
    styles = list(dict.fromkeys(styles))
    if len(styles) == 1:
        styles.append("bold-retro" if styles[0] != "bold-retro" else "badge-keepsake")
    return {
        "market_context_id": "us-gift-market",
        "persona_id": brief["persona_id"],
        "buyer_recipient_pair_id": brief["buyer_recipient_pair_id"],
        "occasion_id": brief["occasion_id"],
        "emotion_id": brief["emotion_id"],
        "product": brief["product"],
        "output_profile_id": brief["output_profile_id"],
        "production_method_id": product["production_method_id"],
        "idea_archetype_id": idea_archetype_id,
        "hook_pattern_id": hook_pattern_id,
        "style_variant_ids": styles,
        "copy": copy.deepcopy(brief["copy"]),
        "product_surface": copy.deepcopy(brief["product_surface"]),
        "personalization": list(brief["personalization"]),
        "variant_count": len(styles),
        "image_runtime": {
            "provider": "OpenAI",
            "model": "ChatGPT Images 2.0",
            "capability": "supported",
            "evidence": "native-control",
            "alpha_qa": "not-run",
            "attempt": 0,
        },
    }


class GeneratedDesignBriefContractTests(unittest.TestCase):
    def _build_target(
        self, root: Path, data: dict | None = None
    ) -> tuple[dict, Path]:
        data = data or add_creative_contract(load_teacher())
        target, _ = build_target_atomic(
            data,
            root,
            ASSETS,
            replace_generated=False,
            platform_validator=None,
            allow_internal_validator=True,
        )
        return data, target

    def _run_resolver(self, target: Path, request: dict) -> subprocess.CompletedProcess[str]:
        request_path = target.parent / "request.json"
        request_path.write_text(
            json.dumps(request, ensure_ascii=False), encoding="utf-8"
        )
        return subprocess.run(
            [
                sys.executable,
                str(target / "scripts" / "resolve_design_brief.py"),
                "--request",
                str(request_path),
            ],
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )

    def test_generated_target_contains_executable_brief_contract(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            data, target = self._build_target(Path(temp))
            required = {
                "scripts/resolve_design_brief.py",
                "references/design-brief.schema.json",
                "references/design-brief-contract.md",
                "references/market-evidence.md",
                "references/idea-archetypes.md",
                "references/production-sensitivity.md",
            }
            existing = {
                path.relative_to(target).as_posix()
                for path in target.rglob("*")
                if path.is_file()
            }
            self.assertTrue(required <= existing, sorted(required - existing))
            always_loaded_bytes = sum(
                (target / "references" / name).stat().st_size
                for name in ("master-data-index.md", "idea-engine-workflow.md")
            )
            self.assertLessEqual(always_loaded_bytes, 7000)

            completed = self._run_resolver(target, request_from_brief(data))
            self.assertEqual(completed.returncode, 0, completed.stderr)
            receipt = json.loads(completed.stdout)
            try:
                from jsonschema import Draft202012Validator, FormatChecker
            except ImportError:
                Draft202012Validator = None
            if Draft202012Validator is not None:
                schema = json.loads(
                    (target / "references" / "design-brief.schema.json").read_text(
                        encoding="utf-8"
                    )
                )
                schema_errors = list(
                    Draft202012Validator(
                        schema, format_checker=FormatChecker()
                    ).iter_errors(receipt)
                )
                self.assertEqual(schema_errors, [])
            bindings = receipt["bindings"]
            self.assertEqual(bindings["production_method_id"], "apparel-dtg")
            self.assertEqual(bindings["output_profile_id"], "apparel-front")
            self.assertEqual(receipt["copy"]["mode"], "exact")
            self.assertEqual(receipt["alpha_route"]["decision"], "generate-transparent")
            self.assertFalse(receipt["alpha_route"]["allow_solid_fallback"])
            self.assertEqual(len(receipt["variants"]), 2)
            self.assertIn("data_sha256", receipt["binding_receipt"])

    def test_resolver_blocks_anti_generic_copy(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            data, target = self._build_target(Path(temp))
            request = request_from_brief(data)
            request["copy"] = {
                "mode": "proposed",
                "text": "World's Best Teacher",
                "language": "en-US",
            }

            completed = self._run_resolver(target, request)

            self.assertEqual(completed.returncode, 2)
            self.assertIn("anti-generic", completed.stderr)

    def test_resolver_blocks_forbidden_combination(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            data, target = self._build_target(Path(temp))
            request = request_from_brief(
                data,
                2,
                idea_archetype_id="personalized-milestone",
                hook_pattern_id="career-legacy",
                style_variant_ids=["cute-playful", "minimal-premium"],
            )

            completed = self._run_resolver(target, request)

            self.assertEqual(completed.returncode, 2)
            self.assertIn("forbidden combination", completed.stderr)

    def test_resolver_enforces_sensitivity_refusal(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            data, target = self._build_target(Path(temp))
            request = request_from_brief(
                data,
                7,
                idea_archetype_id="appreciation-gift",
                hook_pattern_id="support-promise",
                style_variant_ids=["minimal-premium", "badge-keepsake"],
            )
            request["copy"] = {
                "mode": "proposed",
                "text": "This teacher cures disability",
                "language": "en-US",
            }

            completed = self._run_resolver(target, request)

            self.assertEqual(completed.returncode, 2)
            self.assertIn("sensitivity rule", completed.stderr)

    def test_resolver_rejects_pair_product_and_occasion_mismatch(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            data, target = self._build_target(Path(temp))
            request = request_from_brief(data)
            request["buyer_recipient_pair_id"] = (
                "coworker-or-school-team-to-retiring-teacher"
            )

            completed = self._run_resolver(target, request)

            self.assertEqual(completed.returncode, 2)
            self.assertIn("buyer-recipient pair", completed.stderr)

    def test_resolver_rejects_copy_over_product_limit_and_wrong_locale(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            data, target = self._build_target(Path(temp))
            request = request_from_brief(data)
            request["copy"] = {
                "mode": "proposed",
                "text": "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen",
                "language": "vi-VN",
            }

            completed = self._run_resolver(target, request)

            self.assertEqual(completed.returncode, 2)
            self.assertTrue(
                "word limit" in completed.stderr or "market locale" in completed.stderr,
                completed.stderr,
            )

    def test_resolver_rejects_surface_tone_color_conflict(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            data, target = self._build_target(Path(temp))
            request = request_from_brief(data)
            request["product_surface"] = {"tone": "light", "color": "#111111"}

            completed = self._run_resolver(target, request)

            self.assertEqual(completed.returncode, 2)
            self.assertIn("product surface tone", completed.stderr)

    def test_resolver_preserves_matching_review_rules_in_receipt(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            data = add_creative_contract(load_teacher())
            data["combination_rules"].append(
                {
                    "id": "kindergarten-appreciation-review",
                    "persona_ids": ["kindergarten-teacher"],
                    "occasion_ids": ["teacher-appreciation"],
                    "product_names": ["sweatshirt"],
                    "style_variant_ids": [],
                    "idea_archetype_ids": ["appreciation-gift"],
                    "outcome": "review",
                    "reason": "Review exact school-role wording before production.",
                }
            )
            data, target = self._build_target(Path(temp), data)

            completed = self._run_resolver(target, request_from_brief(data))

            self.assertEqual(completed.returncode, 0, completed.stderr)
            receipt = json.loads(completed.stdout)
            self.assertEqual(
                receipt["combination_reviews"][0]["rule_id"],
                "kindergarten-appreciation-review",
            )


class DeterministicPackagingTests(unittest.TestCase):
    def _build_package(self, output: Path) -> tuple[Path, Path]:
        data = add_creative_contract(load_teacher())
        target, _ = build_target_atomic(
            data,
            output,
            ASSETS,
            replace_generated=False,
            platform_validator=None,
            allow_internal_validator=True,
        )
        archive, _ = package_target(
            target,
            output,
            replace_archive=False,
            platform_validator=None,
            allow_internal_validator=True,
        )
        return target, archive

    def test_fixed_source_epoch_produces_byte_identical_packages(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            with mock.patch.dict(os.environ, {"SOURCE_DATE_EPOCH": "1700000000"}):
                target_a, archive_a = self._build_package(root / "a")
                time.sleep(1.1)
                target_b, archive_b = self._build_package(root / "b")

            self.assertEqual(
                hashlib.sha256(archive_a.read_bytes()).hexdigest(),
                hashlib.sha256(archive_b.read_bytes()).hexdigest(),
            )
            manifest_a = json.loads(
                (target_a / "manifest.json").read_text(encoding="utf-8")
            )
            manifest_b = json.loads(
                (target_b / "manifest.json").read_text(encoding="utf-8")
            )
            self.assertEqual(manifest_a, manifest_b)
            self.assertEqual(
                manifest_a["generated_at_utc"], "2023-11-14T22:13:20+00:00"
            )
            with zipfile.ZipFile(archive_a) as archive:
                self.assertEqual(len({item.date_time for item in archive.infolist()}), 1)

    def test_manifest_hashes_every_non_manifest_file(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            with mock.patch.dict(os.environ, {"SOURCE_DATE_EPOCH": "1700000000"}):
                target, _ = self._build_package(Path(temp))

            manifest = json.loads(
                (target / "manifest.json").read_text(encoding="utf-8")
            )
            expected_paths = {
                path.relative_to(target).as_posix()
                for path in target.rglob("*")
                if path.is_file() and path.name != "manifest.json"
            }
            self.assertEqual(set(manifest["content_sha256"]), expected_paths)
            for relative, expected_hash in manifest["content_sha256"].items():
                actual_hash = hashlib.sha256((target / relative).read_bytes()).hexdigest()
                self.assertEqual(actual_hash, expected_hash, relative)

    def test_packaging_rejects_content_that_no_longer_matches_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp)
            data = add_creative_contract(load_teacher())
            target, _ = build_target_atomic(
                data,
                output,
                ASSETS,
                replace_generated=False,
                platform_validator=None,
                allow_internal_validator=True,
            )
            with (target / "SKILL.md").open("a", encoding="utf-8") as handle:
                handle.write("\nTAMPERED\n")

            with self.assertRaises(BuildError):
                package_target(
                    target,
                    output,
                    replace_archive=False,
                    platform_validator=None,
                    allow_internal_validator=True,
                )


class CreativeAndSensitivityContractTests(unittest.TestCase):
    def test_creative_kernel_and_sensitivity_rules_are_first_class(self) -> None:
        data = add_creative_contract(load_teacher())

        report = validate_data(data, "teacher")

        for field_name in (
            "idea_archetypes",
            "creative_controls",
            "combination_rules",
            "sensitivity_rules",
        ):
            self.assertFalse(
                any(field_name in warning and "unknown root field" in warning for warning in report.warnings),
                report.warnings,
            )
            self.assertFalse(
                any(error.startswith(field_name) for error in report.errors),
                report.errors,
            )

    def test_creative_kernel_references_must_resolve(self) -> None:
        data = add_creative_contract(load_teacher())
        data["idea_archetypes"][0]["hook_ids"] = ["missing-hook"]
        data["combination_rules"][0]["style_variant_ids"] = ["missing-style"]

        report = validate_data(data, "teacher")
        joined = "\n".join(report.errors)

        self.assertIn("missing-hook", joined)
        self.assertIn("missing-style", joined)

    def test_sensitivity_action_must_change_behavior(self) -> None:
        data = add_creative_contract(load_teacher())
        data["sensitivity_rules"][0]["action"] = "note-only"
        data["sensitivity_rules"][1]["constraints"] = []

        report = validate_data(data, "teacher")
        joined = "\n".join(report.errors)

        self.assertIn("note-only", joined)
        self.assertIn("constraints", joined)

    def test_combination_rule_requires_a_real_selector(self) -> None:
        data = add_creative_contract(load_teacher())
        rule = data["combination_rules"][0]
        for field in (
            "persona_ids",
            "occasion_ids",
            "product_names",
            "style_variant_ids",
            "idea_archetype_ids",
        ):
            rule[field] = []

        report = validate_data(data, "teacher")

        self.assertTrue(
            any("at least one selector" in error for error in report.errors),
            report.errors,
        )


class ProductionMethodContractTests(unittest.TestCase):
    def test_every_product_binds_one_numeric_production_method(self) -> None:
        data = add_production_contract(load_teacher())

        report = validate_data(data, "teacher")

        self.assertFalse(
            any(
                "unknown root field" in warning and "production_methods" in warning
                for warning in report.warnings
            ),
            report.warnings,
        )
        self.assertFalse(
            any(
                error.startswith("production_methods")
                or "production_method_id" in error
                for error in report.errors
            ),
            report.errors,
        )

    def test_missing_or_mismatched_product_method_is_rejected(self) -> None:
        data = add_production_contract(load_teacher())
        data["product_fit"][0].pop("production_method_id")
        data["product_fit"][1]["production_method_id"] = "printed-flat-goods"

        report = validate_data(data, "teacher")
        joined = "\n".join(report.errors)

        self.assertIn("product_fit[0].production_method_id", joined)
        self.assertIn("does not list product", joined)

    def test_product_cannot_belong_to_multiple_methods(self) -> None:
        data = add_production_contract(load_teacher())
        data["production_methods"][1]["products"].append("t-shirt")

        report = validate_data(data, "teacher")

        self.assertTrue(
            any("multiple production methods" in error for error in report.errors),
            report.errors,
        )

    def test_numeric_production_constraints_must_be_positive_numbers(self) -> None:
        data = add_production_contract(load_teacher())
        data["production_methods"][0]["minimum_stroke_mm"] = 0
        data["production_methods"][0]["minimum_gap_mm"] = True

        report = validate_data(data, "teacher")
        joined = "\n".join(report.errors)

        self.assertIn("minimum_stroke_mm", joined)
        self.assertIn("minimum_gap_mm", joined)


class EvidenceAndMarketContextTests(unittest.TestCase):
    def test_valid_evidence_and_market_contexts_are_first_class_fields(self) -> None:
        data = add_evidence_contract(load_teacher())

        report = validate_data(data, "teacher")

        self.assertFalse(
            any(
                "unknown root field" in warning
                and ("market_contexts" in warning or "evidence_claims" in warning)
                for warning in report.warnings
            ),
            report.warnings,
        )
        self.assertFalse(
            any(
                error.startswith("market_contexts")
                or error.startswith("evidence_claims")
                for error in report.errors
            ),
            report.errors,
        )

    def test_evidence_claim_references_must_resolve(self) -> None:
        data = add_evidence_contract(load_teacher())
        data["evidence_claims"][0]["source_ids"] = ["missing-source"]
        data["evidence_claims"][0]["market_context_ids"] = ["missing-market"]

        report = validate_data(data, "teacher")
        joined = "\n".join(report.errors)

        self.assertIn("missing-source", joined)
        self.assertIn("missing-market", joined)

    def test_supported_claim_requires_traceable_sources(self) -> None:
        data = add_evidence_contract(load_teacher())
        data["evidence_claims"][0]["status"] = "supported"
        data["evidence_claims"][0]["source_ids"] = []

        report = validate_data(data, "teacher")

        self.assertTrue(
            any("supported claim requires" in error for error in report.errors),
            report.errors,
        )

    def test_stale_market_or_claim_is_labeled_not_silently_demand_backed(self) -> None:
        data = add_evidence_contract(load_teacher())
        data["market_contexts"][0]["review_by"] = "2000-01-01"
        data["evidence_claims"][0]["review_by"] = "2000-01-01"

        report = validate_data(data, "teacher")

        self.assertTrue(
            any("stale" in warning and "demand-backed" in warning for warning in report.warnings),
            report.warnings,
        )


class GoldenFixtureAndMigrationTests(unittest.TestCase):
    def test_machine_schema_accepts_both_golden_fixtures(self) -> None:
        try:
            from jsonschema import Draft202012Validator, FormatChecker
        except ImportError:
            self.skipTest("jsonschema is unavailable")
        schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
        validator = Draft202012Validator(schema, format_checker=FormatChecker())
        for path in (SAMPLE, PET_SAMPLE):
            data = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(list(validator.iter_errors(data)), [], path.name)

    def test_teacher_v32_fixture_is_semantically_valid(self) -> None:
        data = load_teacher()
        report = validate_data(data, "teacher")
        self.assertEqual(report.errors, [])
        self.assertEqual(data["schema_version"], "3.2")

    def test_pet_memorial_is_a_dissimilar_focused_sensitive_golden(self) -> None:
        data = json.loads(PET_SAMPLE.read_text(encoding="utf-8"))
        report = validate_data(data, "pet-memorial")

        self.assertEqual(report.errors, [])
        self.assertLess(len(data["personas"]), 8)
        self.assertLess(len(data["occasions"]), 8)
        self.assertGreaterEqual(len(data["production_methods"]), 2)
        self.assertTrue(
            any(rule["action"] == "refuse" for rule in data["sensitivity_rules"])
        )
        self.assertTrue(
            any("memorial" in item["purchase_logic"].lower() for item in data["idea_archetypes"])
        )

    def test_v31_migration_produces_valid_v32_contracts(self) -> None:
        source = add_creative_contract(load_teacher())
        source["schema_version"] = "3.1"
        for field_name in (
            "market_contexts",
            "evidence_claims",
            "production_methods",
            "idea_archetypes",
            "creative_controls",
            "combination_rules",
            "sensitivity_rules",
        ):
            source.pop(field_name)
        for record in source["data_provenance"]["sources"]:
            record.pop("id", None)
        for product in source["product_fit"]:
            product.pop("production_method_id", None)

        normalized, warnings = normalize_data(source, "teacher")
        report = validate_data(normalized, "teacher")

        self.assertEqual(report.errors, [])
        self.assertTrue(any("requires review" in warning for warning in warnings))
        self.assertEqual(normalized["schema_version"], "3.2")

    def test_machine_schema_required_roots_match_current_golden_contract(self) -> None:
        schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
        data = load_teacher()
        self.assertEqual(set(schema["required"]), set(data))


class Schema32ScopeAndDistinctnessTests(unittest.TestCase):
    def test_v31_migrates_to_v32_without_losing_core_bindings(self) -> None:
        source = load_teacher()
        source["schema_version"] = "3.1"
        original_personas = [item["id"] for item in source["personas"]]
        original_briefs = [item["id"] for item in source["sample_briefs"]]
        original_alpha_route = source["output_defaults"]["background"][
            "supported_model_route"
        ]

        normalized, warnings = normalize_data(source, "teacher")

        self.assertEqual(normalized["schema_version"], "3.2")
        self.assertEqual(
            [item["id"] for item in normalized["personas"]], original_personas
        )
        self.assertEqual(
            [item["id"] for item in normalized["sample_briefs"]], original_briefs
        )
        self.assertEqual(
            normalized["output_defaults"]["background"]["supported_model_route"],
            original_alpha_route,
        )
        self.assertTrue(any("3.1" in item and "3.2" in item for item in warnings))

    def test_scope_derived_minima_do_not_force_broad_niche_counts(self) -> None:
        data = load_teacher()
        data["niche_profile"]["primary_recipients"] = data["niche_profile"][
            "primary_recipients"
        ][:3]
        data["personas"] = data["personas"][:3]

        report = validate_data(data, "teacher")

        self.assertFalse(
            any(
                error.startswith("personas:") and "requires at least 8" in error
                for error in report.errors
            ),
            report.errors,
        )

    def test_structurally_cloned_personas_are_rejected(self) -> None:
        data = load_teacher()
        clone = copy.deepcopy(data["personas"][0])
        clone["id"] = "kindergarten-teacher-clone"
        clone["name"] = "Kindergarten teacher duplicate"
        data["personas"][1] = clone

        report = validate_data(data, "teacher")

        self.assertTrue(
            any("structured duplicate" in error for error in report.errors),
            report.errors,
        )

    def test_style_variants_must_differ_on_at_least_two_axes(self) -> None:
        data = load_teacher()
        first = data["style_variants"][0]
        second = data["style_variants"][1]
        second["typography"] = first["typography"]
        second["motifs"] = list(first["motifs"])
        second["palette_options"] = list(first["palette_options"])

        report = validate_data(data, "teacher")

        self.assertTrue(
            any("distinct creative axes" in error for error in report.errors),
            report.errors,
        )

    def test_machine_schema_declares_v32(self) -> None:
        schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
        self.assertEqual(schema["properties"]["schema_version"]["const"], "3.2")
        self.assertIn("niche_profile", schema["required"])


if __name__ == "__main__":
    unittest.main()
