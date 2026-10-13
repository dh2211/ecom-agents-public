"""Shared constants for the POD design skill builder."""

from __future__ import annotations

import re

SCHEMA_VERSION = "3.2"
PREVIOUS_SCHEMA_VERSION = "3.1"
OLDER_SCHEMA_VERSION = "3.0"
LEGACY_SCHEMA_VERSION = "2.0"
GENERATOR_ID = "pod-design-skill-builder"
GENERATOR_VERSION = "3.2.0"
MAX_SKILL_ZIP_BYTES = 25 * 1024 * 1024

ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
HEX_COLOR_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")
ASPECT_RATIO_PATTERN = re.compile(r"^[1-9][0-9]*:[1-9][0-9]*$")

SAFE_BACKGROUND_PALETTE = (
    "#000000",  # black
    "#FFFFFF",  # white
    "#808080",  # neutral gray
    "#3A3A3A",  # dark gray
    "#C0C0C0",  # silver
)

EVIDENCE_STATUSES = {"curated-draft", "researched", "validated"}
LEGAL_STATUSES = {"unchecked", "screened-not-cleared", "human-review-required"}
CLAIM_STATUSES = {"hypothesis", "supported", "validated"}
CLAIM_TYPES = {"market-hypothesis", "buyer-language", "seasonality", "production", "policy"}
CONFIDENCE_LEVELS = {"low", "medium", "high"}
MEASUREMENT_SYSTEMS = {"metric", "imperial", "mixed", "unspecified"}
VARIATION_AXES = {"composition", "typography", "motif", "palette", "hook", "personalization"}
COMBINATION_RULE_OUTCOMES = {"forbid", "review"}
SENSITIVITY_ACTIONS = {"refuse", "constrain", "human-review"}
COPY_MODES = {"exact", "proposed", "none"}
SURFACE_TONES = {"dark", "light", "mid", "unknown"}
PRIORITIES = {"high", "medium", "low"}

TRANSPARENCY_CAPABILITY_POLICIES = {"capability-gated"}
SUPPORTED_TRANSPARENCY_ROUTES = {"transparent-required-no-fallback"}
UNKNOWN_TRANSPARENCY_ROUTES = {"probe-then-fallback"}
UNSUPPORTED_TRANSPARENCY_ROUTES = {"flat-solid-remove-to-alpha"}
TRANSPARENCY_FALLBACK_CONDITIONS = {"confirmed-transparent-unavailable-only"}

EXCLUDED_PACKAGE_NAMES = {
    ".DS_Store",
    "Thumbs.db",
}
EXCLUDED_PACKAGE_SUFFIXES = {".pyc", ".pyo"}
