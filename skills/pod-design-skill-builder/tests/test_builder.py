from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from pod_builder.colors import choose_safe_background, recommended_artwork_tone
from pod_builder.migration import normalize_data
from pod_builder.packaging import BuildError, build_target_atomic, package_target
from pod_builder.utils import slugify
from pod_builder.validation import validate_data

SAMPLE = ROOT / "references" / "teacher-example-data.json"
ASSETS = ROOT / "assets" / "target-scripts"
PLATFORM_VALIDATOR = Path("/home/oai/skills/skill-creator/scripts/quick_validate.py")


def load_sample() -> dict:
    return json.loads(SAMPLE.read_text(encoding="utf-8"))


def validator_kwargs() -> dict:
    return {
        "platform_validator": PLATFORM_VALIDATOR if PLATFORM_VALIDATOR.is_file() else None,
        "allow_internal_validator": not PLATFORM_VALIDATOR.is_file(),
    }


class ValidationTests(unittest.TestCase):
    def test_teacher_example_is_valid(self) -> None:
        report = validate_data(load_sample(), "teacher")
        self.assertEqual(report.errors, [])
        self.assertTrue(any("commercial demand" in warning for warning in report.warnings))

    def test_bool_is_not_accepted_as_integer(self) -> None:
        data = load_sample()
        data["qa_rules"]["max_colors"] = True
        report = validate_data(data, "teacher")
        self.assertTrue(any("qa_rules.max_colors" in error for error in report.errors))

    def test_invalid_date_and_hex_are_rejected(self) -> None:
        data = load_sample()
        data["data_provenance"]["last_updated"] = "not-a-date"
        data["visual_vocabulary"]["palettes"][0]["colors"][0] = "banana"
        report = validate_data(data, "teacher")
        self.assertTrue(any("last_updated" in error for error in report.errors))
        self.assertTrue(any("colors[0]" in error for error in report.errors))

    def test_semantic_references_are_enforced(self) -> None:
        data = load_sample()
        data["personas"][0]["product_fit"].append("imaginary-product")
        data["style_variants"][0]["motifs"].append("imaginary-motif")
        data["style_variants"][0]["palette_options"].append("imaginary-palette")
        data["sample_briefs"][0]["output_profile_id"] = "missing-profile"
        report = validate_data(data, "teacher")
        joined = "\n".join(report.errors)
        self.assertIn("imaginary-product", joined)
        self.assertIn("imaginary-motif", joined)
        self.assertIn("imaginary-palette", joined)
        self.assertIn("missing-profile", joined)

    def test_surface_tone_must_match_exact_color(self) -> None:
        data = load_sample()
        data["sample_briefs"][0]["product_surface"] = {
            "tone": "light",
            "color": "#111111",
        }
        report = validate_data(data, "teacher")
        self.assertTrue(any("conflicts with color" in error for error in report.errors))

    def test_unicode_slug_transliterates_vietnamese(self) -> None:
        self.assertEqual(slugify("Giáo viên"), "giao-vien")
        self.assertEqual(slugify("Mẹ bỉm sữa"), "me-bim-sua")

    def test_legacy_v2_migrates_to_v32(self) -> None:
        legacy = load_sample()
        legacy["schema_version"] = "2.0"
        legacy["niche"] = legacy.pop("niche_slug")
        provenance = legacy["data_provenance"]
        provenance["status"] = provenance.pop("evidence_status")
        provenance.pop("legal_status", None)
        provenance["marketplaces"] = []
        provenance["sources"] = []
        provenance["assumptions"] = []
        for field_name in (
            "market_contexts",
            "evidence_claims",
            "production_methods",
            "idea_archetypes",
            "creative_controls",
            "combination_rules",
            "sensitivity_rules",
        ):
            legacy.pop(field_name, None)
        for style in legacy["style_variants"]:
            style["palette"] = style.pop("palette_options")[0]
        calibration = legacy.pop("concept_fit_calibration")
        legacy["market_fit_calibration"] = {
            "go_score": 25,
            "refine_score": 21,
            "rework_score": 16,
            "replace_score": 15,
            "high_fit_signals": calibration["high_fit_signals"],
            "weak_fit_signals": calibration["weak_fit_signals"],
        }
        legacy.pop("output_profiles")
        legacy.pop("output_defaults")
        for product in legacy["product_fit"]:
            product.pop("output_profile_id", None)
            product.pop("production_method_id", None)
        legacy["qa_rules"] = {
            "exact_text_required": True,
            "max_colors": 7,
            "min_text_legibility": "Readable at thumbnail size.",
            "background": "#00FF00",
            "aspect_ratio": "3:4",
            "output_mode": "isolated artwork",
            "foreground_color_exclusion": ["#00FF00"],
        }
        for brief in legacy["sample_briefs"]:
            brief["exact_text"] = brief.pop("copy")["text"]
            brief.pop("buyer_recipient_pair_id", None)
            brief.pop("output_profile_id", None)
            brief.pop("product_surface", None)

        normalized, warnings = normalize_data(legacy, "teacher")
        report = validate_data(normalized, "teacher")
        self.assertEqual(report.errors, [])
        self.assertTrue(any("migrated" in warning for warning in warnings))
        self.assertEqual(normalized["schema_version"], "3.2")
        self.assertEqual(
            normalized["output_defaults"]["background"]["preferred_mode"],
            "transparent",
        )
        self.assertFalse(
            normalized["qa_rules"]["fallback_on_supported_alpha_failure"]
        )

    def test_v3_migrates_to_v32_transparency_policy(self) -> None:
        previous = load_sample()
        previous["schema_version"] = "3.0"
        background = previous["output_defaults"]["background"]
        for key in (
            "capability_policy",
            "supported_model_route",
            "unknown_model_route",
            "unsupported_model_route",
            "max_transparent_attempts",
            "unknown_probe_attempts",
            "fallback_condition",
            "require_native_transparency_option_when_available",
            "hard_fail_supported_after_attempts",
            "final_output_must_have_alpha",
        ):
            background.pop(key)
        qa = previous["qa_rules"]
        for key in (
            "rerender_on_alpha_failure",
            "fallback_on_supported_alpha_failure",
            "minimum_fully_transparent_ratio",
            "minimum_transparent_border_ratio",
            "minimum_visible_ratio",
            "maximum_significant_visible_ratio",
            "maximum_significant_bbox_fill_ratio",
            "minimum_significant_margin_ratio",
            "significant_alpha_threshold",
        ):
            qa.pop(key)

        normalized, warnings = normalize_data(previous, "teacher")
        report = validate_data(normalized, "teacher")
        self.assertEqual(report.errors, [])
        self.assertTrue(any("3.0" in warning and "3.1" in warning for warning in warnings))
        self.assertEqual(normalized["schema_version"], "3.2")
        self.assertEqual(
            normalized["output_defaults"]["background"]["supported_model_route"],
            "transparent-required-no-fallback",
        )
        self.assertTrue(
            normalized["output_defaults"]["background"]["final_output_must_have_alpha"]
        )

    def test_supported_runtime_fallback_policy_is_rejected(self) -> None:
        data = load_sample()
        data["qa_rules"]["fallback_on_supported_alpha_failure"] = True
        report = validate_data(data, "teacher")
        self.assertTrue(
            any(
                "fallback_on_supported_alpha_failure" in error
                and "must be false" in error
                for error in report.errors
            )
        )

    def test_output_profile_alpha_cannot_be_disabled(self) -> None:
        data = load_sample()
        data["output_profiles"][0]["alpha_preferred"] = False
        report = validate_data(data, "teacher")
        self.assertTrue(
            any(
                "output_profiles[0].alpha_preferred" in error
                and "must be true" in error
                for error in report.errors
            )
        )


class BuildAndPackageTests(unittest.TestCase):
    def test_special_characters_do_not_break_target_frontmatter(self) -> None:
        data = load_sample()
        data["niche_display"] = "Teacher: Pro"
        self.assertEqual(validate_data(data, "teacher").errors, [])
        with tempfile.TemporaryDirectory() as temp:
            skill_dir, _ = build_target_atomic(
                data,
                Path(temp),
                ASSETS,
                replace_generated=False,
                **validator_kwargs(),
            )
            text = (skill_dir / "SKILL.md").read_text(encoding="utf-8")
            self.assertIn('description: "', text)
            self.assertIn("Teacher: Pro", text)

    def test_replace_refuses_unowned_folder(self) -> None:
        data = load_sample()
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / "teacher-pod-design-agent"
            target.mkdir()
            (target / "important.txt").write_text("do not delete", encoding="utf-8")
            with self.assertRaises(BuildError):
                build_target_atomic(
                    data,
                    Path(temp),
                    ASSETS,
                    replace_generated=True,
                    **validator_kwargs(),
                )
            self.assertEqual((target / "important.txt").read_text(), "do not delete")

    def test_failed_rebuild_preserves_existing_target(self) -> None:
        data = load_sample()
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp)
            target, _ = build_target_atomic(
                data,
                output,
                ASSETS,
                replace_generated=False,
                **validator_kwargs(),
            )
            original_manifest = (target / "manifest.json").read_text(encoding="utf-8")
            empty_assets = output / "empty-assets"
            empty_assets.mkdir()
            with self.assertRaises(BuildError):
                build_target_atomic(
                    data,
                    output,
                    empty_assets,
                    replace_generated=True,
                    **validator_kwargs(),
                )
            self.assertEqual(
                (target / "manifest.json").read_text(encoding="utf-8"),
                original_manifest,
            )

    def test_package_excludes_cache_and_has_one_root(self) -> None:
        data = load_sample()
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp)
            target, _ = build_target_atomic(
                data,
                output,
                ASSETS,
                replace_generated=False,
                **validator_kwargs(),
            )
            cache = target / "scripts" / "__pycache__"
            cache.mkdir()
            (cache / "junk.pyc").write_bytes(b"cache")
            zip_path, _ = package_target(
                target,
                output,
                replace_archive=False,
                **validator_kwargs(),
            )
            with zipfile.ZipFile(zip_path) as archive:
                names = archive.namelist()
            self.assertTrue(names)
            self.assertEqual({Path(name).parts[0] for name in names}, {target.name})
            self.assertFalse(any("__pycache__" in name or name.endswith(".pyc") for name in names))

    def test_package_size_limit_is_a_hard_error(self) -> None:
        data = load_sample()
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp)
            target, _ = build_target_atomic(
                data,
                output,
                ASSETS,
                replace_generated=False,
                **validator_kwargs(),
            )
            with mock.patch("pod_builder.packaging.MAX_SKILL_ZIP_BYTES", 100):
                with self.assertRaises(BuildError):
                    package_target(
                        target,
                        output,
                        replace_archive=False,
                        **validator_kwargs(),
                    )
            self.assertFalse((output / "skill.zip").exists())

    def test_generated_target_contains_transparency_gate(self) -> None:
        data = load_sample()
        with tempfile.TemporaryDirectory() as temp:
            target, _ = build_target_atomic(
                data,
                Path(temp),
                ASSETS,
                replace_generated=False,
                **validator_kwargs(),
            )
            self.assertTrue((target / "scripts" / "resolve_transparency_route.py").is_file())
            self.assertTrue((target / "scripts" / "verify_png_alpha.py").is_file())
            self.assertTrue(
                (target / "references" / "transparency-capability-policy.md").is_file()
            )
            skill_text = (target / "SKILL.md").read_text(encoding="utf-8")
            policy_text = (
                target / "references" / "transparency-capability-policy.md"
            ).read_text(encoding="utf-8")
            qa_text = (target / "references" / "qa-checklist.md").read_text(
                encoding="utf-8"
            )
            self.assertIn("Never switch a supported model to solid fallback", skill_text)
            self.assertIn("hard-fail", policy_text)
            self.assertIn("never switches to a solid canvas", qa_text)
            self.assertIn("transparent PNG that passes QA", skill_text)

    def test_generated_record_selector(self) -> None:
        data = load_sample()
        with tempfile.TemporaryDirectory() as temp:
            target, _ = build_target_atomic(
                data,
                Path(temp),
                ASSETS,
                replace_generated=False,
                **validator_kwargs(),
            )
            completed = subprocess.run(
                [
                    sys.executable,
                    str(target / "scripts" / "select_records.py"),
                    "--persona",
                    "kindergarten-teacher",
                    "--product",
                    "sweatshirt",
                    "--market",
                    "etsy-us",
                    "--archetype",
                    "appreciation-gift",
                    "--method",
                    "apparel-dtg",
                    "--sensitivity-rule",
                    "no-medical-outcome-claims",
                ],
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
            self.assertEqual(completed.returncode, 0, completed.stderr)
            payload = json.loads(completed.stdout)
            self.assertEqual(payload["persona"]["id"], "kindergarten-teacher")
            self.assertEqual(payload["product"]["product"], "sweatshirt")
            self.assertEqual(payload["market_context"]["id"], "etsy-us")
            self.assertEqual(payload["idea_archetype"]["id"], "appreciation-gift")
            self.assertEqual(payload["production_method"]["id"], "apparel-dtg")
            self.assertEqual(
                payload["sensitivity_rule"]["id"], "no-medical-outcome-claims"
            )


class BackgroundToolTests(unittest.TestCase):
    def test_safe_background_prefers_black_for_light_artwork(self) -> None:
        result = choose_safe_background(["#FFFFFF", "#FFD166", "#F4A261"])
        self.assertEqual(result["selected"], "#000000")
        self.assertEqual(recommended_artwork_tone("#111111"), "light")
        self.assertEqual(recommended_artwork_tone("#FFFFFF"), "dark")

    def _resolve_route(self, *extra: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [
                sys.executable,
                str(ASSETS / "resolve_transparency_route.py"),
                *extra,
            ],
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )

    def test_supported_route_rerenders_then_hard_fails_without_fallback(self) -> None:
        rerender = self._resolve_route(
            "--provider", "OpenAI",
            "--model", "ChatGPT Images 2.0",
            "--capability", "supported",
            "--evidence", "native-control",
            "--alpha-qa", "fail",
            "--attempt", "1",
            "--max-transparent-attempts", "3",
        )
        self.assertEqual(rerender.returncode, 0, rerender.stderr)
        payload = json.loads(rerender.stdout)
        self.assertEqual(payload["decision"], "rerender-transparent")
        self.assertFalse(payload["allow_solid_fallback"])

        stopped = self._resolve_route(
            "--provider", "OpenAI",
            "--model", "ChatGPT Images 2.0",
            "--capability", "supported",
            "--evidence", "native-control",
            "--alpha-qa", "fail",
            "--attempt", "3",
            "--max-transparent-attempts", "3",
        )
        self.assertEqual(stopped.returncode, 0, stopped.stderr)
        payload = json.loads(stopped.stdout)
        self.assertEqual(payload["decision"], "hard-fail-transparent-required")
        self.assertFalse(payload["allow_solid_fallback"])
        self.assertFalse(payload["deliverable"])

    def test_unknown_route_allows_fallback_only_after_probes(self) -> None:
        first = self._resolve_route(
            "--provider", "Example",
            "--model", "Unverified Image Runtime",
            "--capability", "unknown",
            "--evidence", "unverified",
            "--alpha-qa", "fail",
            "--attempt", "1",
            "--unknown-probe-attempts", "2",
        )
        self.assertEqual(first.returncode, 0, first.stderr)
        self.assertEqual(json.loads(first.stdout)["decision"], "probe-transparent")

        exhausted = self._resolve_route(
            "--provider", "Example",
            "--model", "Unverified Image Runtime",
            "--capability", "unknown",
            "--evidence", "unverified",
            "--alpha-qa", "fail",
            "--attempt", "2",
            "--unknown-probe-attempts", "2",
        )
        self.assertEqual(exhausted.returncode, 0, exhausted.stderr)
        payload = json.loads(exhausted.stdout)
        self.assertEqual(payload["decision"], "use-solid-fallback")
        self.assertTrue(payload["allow_solid_fallback"])
        self.assertEqual(payload["fallback_evidence"], "failed-probes")

    def test_capability_evidence_must_match_status(self) -> None:
        invalid = self._resolve_route(
            "--provider", "Example",
            "--model", "Model",
            "--capability", "supported",
            "--evidence", "failed-probes",
            "--alpha-qa", "not-run",
        )
        self.assertEqual(invalid.returncode, 2)
        self.assertIn("incompatible", invalid.stderr)

    def _verify_alpha(self, image: Path) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(ASSETS / "verify_png_alpha.py"), str(image)],
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )

    def test_alpha_verifier_rejects_opaque_empty_and_edge_touching_images(self) -> None:
        try:
            from PIL import Image, ImageDraw
        except ImportError:
            self.skipTest("Pillow is unavailable")
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)

            opaque = root / "opaque.png"
            Image.new("RGB", (64, 64), (255, 255, 255)).save(opaque)
            opaque_result = self._verify_alpha(opaque)
            self.assertNotEqual(opaque_result.returncode, 0)

            empty = root / "empty.png"
            Image.new("RGBA", (64, 64), (0, 0, 0, 0)).save(empty)
            empty_result = self._verify_alpha(empty)
            self.assertNotEqual(empty_result.returncode, 0)
            self.assertIn("no visible artwork", empty_result.stdout)

            touching = root / "touching.png"
            image = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
            draw = ImageDraw.Draw(image)
            draw.rectangle((0, 10, 40, 50), fill=(255, 0, 0, 255))
            image.save(touching)
            touching_result = self._verify_alpha(touching)
            self.assertNotEqual(touching_result.returncode, 0)
            self.assertIn("too close", touching_result.stdout)

            inset_panel = root / "inset-panel.png"
            image = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
            draw = ImageDraw.Draw(image)
            draw.rectangle((6, 6, 93, 93), fill=(30, 30, 30, 255))
            image.save(inset_panel)
            panel_result = self._verify_alpha(inset_panel)
            self.assertNotEqual(panel_result.returncode, 0)
            self.assertIn("inset background panel", panel_result.stdout)

    def test_flat_background_removal_and_alpha_verification(self) -> None:
        try:
            from PIL import Image, ImageDraw
        except ImportError:
            self.skipTest("Pillow is unavailable")
        with tempfile.TemporaryDirectory() as temp:
            temp_path = Path(temp)
            source = temp_path / "source.png"
            output = temp_path / "output.png"
            image = Image.new("RGBA", (96, 96), (255, 255, 255, 255))
            draw = ImageDraw.Draw(image)
            draw.ellipse((20, 20, 75, 75), fill=(15, 15, 15, 255))
            draw.ellipse((35, 35, 60, 60), fill=(220, 40, 80, 255))
            image.save(source)

            remove = subprocess.run(
                [
                    sys.executable,
                    str(ASSETS / "remove_flat_background.py"),
                    str(source),
                    str(output),
                    "--background",
                    "#FFFFFF",
                    "--tolerance",
                    "5",
                ],
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
            self.assertEqual(remove.returncode, 0, remove.stderr)
            verify = subprocess.run(
                [sys.executable, str(ASSETS / "verify_png_alpha.py"), str(output)],
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
            self.assertEqual(verify.returncode, 0, verify.stderr)
            payload = json.loads(verify.stdout)
            self.assertTrue(payload["passed"])
            self.assertEqual(payload["transparent_border_ratio"], 1.0)


if __name__ == "__main__":
    unittest.main()
