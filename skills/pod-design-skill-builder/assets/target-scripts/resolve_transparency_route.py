#!/usr/bin/env python3
"""Resolve the mandatory transparency route for a POD image generation attempt."""

from __future__ import annotations

import argparse
import json
import math
import sys

CAPABILITIES = ("supported", "unknown", "unsupported")
QA_RESULTS = ("not-run", "pass", "fail")
SUPPORTED_EVIDENCE = ("native-control", "provider-metadata", "prior-alpha-pass")
UNKNOWN_EVIDENCE = ("unverified",)
UNSUPPORTED_EVIDENCE = (
    "explicit-provider-limitation",
    "transparent-option-rejected",
    "failed-probes",
)
ALL_EVIDENCE = SUPPORTED_EVIDENCE + UNKNOWN_EVIDENCE + UNSUPPORTED_EVIDENCE


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Choose transparent generation, transparent rerender, hard failure, or the "
            "temporary solid-background route without downgrading a supported model."
        )
    )
    parser.add_argument("--provider", required=True, help="Provider or host runtime name")
    parser.add_argument("--model", required=True, help="Exact model/tool or interface name")
    parser.add_argument("--capability", choices=CAPABILITIES, required=True)
    parser.add_argument("--evidence", choices=ALL_EVIDENCE, required=True)
    parser.add_argument("--alpha-qa", choices=QA_RESULTS, default="not-run")
    parser.add_argument(
        "--attempt",
        type=int,
        default=0,
        help="Number of transparent attempts already completed; use 0 before generation.",
    )
    parser.add_argument("--max-transparent-attempts", type=int, default=3)
    parser.add_argument("--unknown-probe-attempts", type=int, default=2)
    return parser


def validate_evidence(capability: str, evidence: str) -> None:
    allowed = {
        "supported": SUPPORTED_EVIDENCE,
        "unknown": UNKNOWN_EVIDENCE,
        "unsupported": UNSUPPORTED_EVIDENCE,
    }[capability]
    if evidence not in allowed:
        raise ValueError(
            f"evidence {evidence!r} is incompatible with capability {capability!r}; "
            f"allowed: {', '.join(allowed)}"
        )


def resolve(
    provider: str,
    model: str,
    capability: str,
    evidence: str,
    alpha_qa: str,
    attempt: int | float,
    max_transparent_attempts: int,
    unknown_probe_attempts: int,
) -> dict[str, object]:
    for field, value in (("provider", provider), ("model", model)):
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{field} must be a non-empty string")
    for field, value, allowed in (
        ("capability", capability, CAPABILITIES),
        ("evidence", evidence, ALL_EVIDENCE),
        ("alpha_qa", alpha_qa, QA_RESULTS),
    ):
        if not isinstance(value, str) or value not in allowed:
            raise ValueError(f"{field} must be one of {allowed}")
    if type(attempt) not in (int, float) or (type(attempt) is float and not math.isfinite(attempt)):
        raise ValueError("attempt must be a finite number")
    for field, value in (
        ("max-transparent-attempts", max_transparent_attempts),
        ("unknown-probe-attempts", unknown_probe_attempts),
    ):
        if type(value) is not int:
            raise ValueError(f"{field} must be an integer")
    provider = provider.strip()
    model = model.strip()
    if not provider:
        raise ValueError("provider must not be blank")
    if not model:
        raise ValueError("model must not be blank")
    validate_evidence(capability, evidence)
    if attempt < 0:
        raise ValueError("attempt must be zero or greater")
    if not 1 <= max_transparent_attempts <= 5:
        raise ValueError("max-transparent-attempts must be from 1 to 5")
    if not 1 <= unknown_probe_attempts <= 3:
        raise ValueError("unknown-probe-attempts must be from 1 to 3")
    if unknown_probe_attempts > max_transparent_attempts:
        raise ValueError("unknown-probe-attempts must not exceed max-transparent-attempts")

    payload: dict[str, object] = {
        "provider": provider,
        "model": model,
        "capability": capability,
        "capability_evidence": evidence,
        "alpha_qa": alpha_qa,
        "attempt": attempt,
        "max_transparent_attempts": max_transparent_attempts,
        "unknown_probe_attempts": unknown_probe_attempts,
        "allow_solid_fallback": False,
        "deliverable": False,
        "promoted_capability": capability,
        "final_output_requirement": "transparent-png-alpha-qa-pass",
    }

    if alpha_qa == "pass":
        payload.update(
            decision="accept-transparent",
            deliverable=True,
            promoted_capability="supported",
            reason=(
                "Materialized PNG alpha QA passed. Preserve this runtime as supported for "
                "the current provider/model/interface fingerprint."
            ),
        )
        return payload

    if capability == "supported":
        if alpha_qa == "not-run":
            payload.update(
                decision="generate-transparent",
                reason=(
                    "The active runtime has positive transparency evidence. Use its native "
                    "transparent option when exposed, request PNG, then run strict alpha QA."
                ),
            )
        elif attempt < max_transparent_attempts:
            payload.update(
                decision="rerender-transparent",
                reason=(
                    "Alpha QA failed, but solid fallback is forbidden for a supported "
                    "runtime. Tighten the transparent prompt or native settings and rerender."
                ),
            )
        else:
            payload.update(
                decision="hard-fail-transparent-required",
                reason=(
                    "All allowed transparent attempts failed. Stop without a solid fallback, "
                    "opaque substitute, or production-ready claim."
                ),
            )
        return payload

    if capability == "unknown":
        if alpha_qa == "not-run" or attempt < unknown_probe_attempts:
            payload.update(
                decision="probe-transparent",
                reason=(
                    "Transparency support is unverified. Attempt transparent output and inspect "
                    "the materialized PNG; model name, prompt claims, and PNG format do not prove alpha."
                ),
            )
        else:
            payload.update(
                decision="use-solid-fallback",
                allow_solid_fallback=True,
                promoted_capability="unsupported",
                fallback_evidence="failed-probes",
                reason=(
                    "This exact runtime failed the configured transparency probes. Use one "
                    "approved flat color only as a temporary removal canvas, then require final alpha QA."
                ),
            )
        return payload

    payload.update(
        decision="use-solid-fallback",
        allow_solid_fallback=True,
        fallback_evidence=evidence,
        reason=(
            "The active runtime has explicit evidence that native transparent output is unavailable. "
            "Use one approved flat color only as a temporary removal canvas, then verify final PNG alpha."
        ),
    )
    return payload


def main() -> int:
    args = build_parser().parse_args()
    try:
        payload = resolve(
            args.provider,
            args.model,
            args.capability,
            args.evidence,
            args.alpha_qa,
            args.attempt,
            args.max_transparent_attempts,
            args.unknown_probe_attempts,
        )
        print(json.dumps(payload, indent=2))
        return 0
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
