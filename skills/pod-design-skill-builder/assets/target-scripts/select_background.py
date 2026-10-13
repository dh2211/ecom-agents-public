#!/usr/bin/env python3
"""Select a safe flat removal background and evaluate product contrast."""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from typing import Iterable

SAFE_BACKGROUND_PALETTE = ("#000000", "#FFFFFF", "#808080", "#3A3A3A", "#C0C0C0")
HEX_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")


def normalize_hex(value: str) -> str:
    value = value.strip().upper()
    if not HEX_PATTERN.fullmatch(value):
        raise ValueError(f"invalid #RRGGBB color: {value!r}")
    return value


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = normalize_hex(value)
    return tuple(int(value[index:index+2], 16) for index in (1, 3, 5))  # type: ignore[return-value]


def linear(channel: float) -> float:
    channel /= 255.0
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def luminance(value: str) -> float:
    r, g, b = hex_to_rgb(value)
    rl, gl, bl = (linear(channel) for channel in (r, g, b))
    return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl


def contrast_ratio(first: str, second: str) -> float:
    a, b = luminance(first), luminance(second)
    return (max(a, b) + 0.05) / (min(a, b) + 0.05)


def tone(value: str) -> str:
    level = luminance(value)
    if level < 0.18:
        return "dark"
    if level > 0.65:
        return "light"
    return "mid"


def recommended_artwork_tone(product_color: str | None, product_tone: str) -> str:
    resolved = tone(product_color) if product_color else product_tone
    if resolved == "dark":
        return "light"
    if resolved == "light":
        return "dark"
    return "high-contrast-dual-tone"


def xyz(value: str) -> tuple[float, float, float]:
    r, g, b = hex_to_rgb(value)
    rl, gl, bl = (linear(channel) for channel in (r, g, b))
    return (
        (0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl) * 100,
        (0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl) * 100,
        (0.0193339 * rl + 0.1191920 * gl + 0.9503041 * bl) * 100,
    )


def lab(value: str) -> tuple[float, float, float]:
    x, y, z = xyz(value)
    x, y, z = x / 95.047, y / 100.0, z / 108.883
    delta = 6 / 29

    def f(component: float) -> float:
        return component ** (1 / 3) if component > delta ** 3 else component / (3 * delta ** 2) + 4 / 29

    fx, fy, fz = f(x), f(y), f(z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def delta_e(first: str, second: str) -> float:
    l1, a1, b1 = lab(first)
    l2, a2, b2 = lab(second)
    return math.sqrt((l1-l2)**2 + (a1-a2)**2 + (b1-b2)**2)


def rank_backgrounds(colors: Iterable[str]) -> list[dict[str, object]]:
    artwork = [normalize_hex(color) for color in colors]
    if not artwork:
        raise ValueError("at least one artwork color is required")
    result = []
    for candidate in SAFE_BACKGROUND_PALETTE:
        distances = [delta_e(candidate, color) for color in artwork]
        ratios = [contrast_ratio(candidate, color) for color in artwork]
        result.append({
            "color": candidate,
            "minimum_delta_e": round(min(distances), 2),
            "average_delta_e": round(sum(distances) / len(distances), 2),
            "minimum_contrast_ratio": round(min(ratios), 2),
        })
    result.sort(
        key=lambda row: (
            float(row["minimum_delta_e"]),
            float(row["average_delta_e"]),
            float(row["minimum_contrast_ratio"]),
        ),
        reverse=True,
    )
    return result


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Choose a safe POD fallback background")
    parser.add_argument(
        "--artwork-colors",
        required=True,
        help="Comma-separated foreground #RRGGBB colors",
    )
    parser.add_argument("--product-color", help="Exact product surface #RRGGBB color")
    parser.add_argument(
        "--product-tone",
        choices=("dark", "light", "mid", "unknown"),
        default="unknown",
    )
    parser.add_argument("--minimum-contrast", type=float, default=4.5)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        colors = [normalize_hex(item) for item in args.artwork_colors.split(",") if item.strip()]
        product_color = normalize_hex(args.product_color) if args.product_color else None
        ranked = rank_backgrounds(colors)
        contrast_rows = []
        if product_color:
            for color in colors:
                ratio = contrast_ratio(color, product_color)
                contrast_rows.append({
                    "artwork_color": color,
                    "product_color": product_color,
                    "contrast_ratio": round(ratio, 2),
                    "passes_minimum": ratio >= args.minimum_contrast,
                })
        payload = {
            "selected_fallback_background": ranked[0]["color"],
            "safe_palette": SAFE_BACKGROUND_PALETTE,
            "ranking": ranked,
            "product_surface": {
                "color": product_color,
                "tone": tone(product_color) if product_color else args.product_tone,
                "recommended_artwork_tone": recommended_artwork_tone(product_color, args.product_tone),
                "minimum_contrast_target": args.minimum_contrast,
                "foreground_checks": contrast_rows,
            },
            "mandatory_prompt": "MANDATORY FLAT SOLID COLOR. NO SHADOWS.",
        }
        print(json.dumps(payload, indent=2))
        return 0
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
