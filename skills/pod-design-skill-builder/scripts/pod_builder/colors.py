"""Color-distance and contrast helpers used by validation and tests."""

from __future__ import annotations

import math
from typing import Iterable

from .constants import HEX_COLOR_PATTERN, SAFE_BACKGROUND_PALETTE


def normalize_hex(value: str) -> str:
    value = value.strip().upper()
    if not HEX_COLOR_PATTERN.fullmatch(value):
        raise ValueError(f"invalid #RRGGBB color: {value!r}")
    return value


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = normalize_hex(value)
    return tuple(int(value[index : index + 2], 16) for index in (1, 3, 5))  # type: ignore[return-value]


def _srgb_channel_to_linear(channel: float) -> float:
    channel /= 255.0
    if channel <= 0.04045:
        return channel / 12.92
    return ((channel + 0.055) / 1.055) ** 2.4


def relative_luminance(value: str) -> float:
    r, g, b = hex_to_rgb(value)
    rl, gl, bl = (_srgb_channel_to_linear(c) for c in (r, g, b))
    return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl


def contrast_ratio(first: str, second: str) -> float:
    l1 = relative_luminance(first)
    l2 = relative_luminance(second)
    lighter, darker = max(l1, l2), min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


def classify_surface_tone(color: str) -> str:
    luminance = relative_luminance(color)
    if luminance < 0.18:
        return "dark"
    if luminance > 0.65:
        return "light"
    return "mid"


def recommended_artwork_tone(product_color: str | None, product_tone: str = "unknown") -> str:
    tone = classify_surface_tone(product_color) if product_color else product_tone
    if tone == "dark":
        return "light"
    if tone == "light":
        return "dark"
    return "high-contrast-dual-tone"


def _rgb_to_xyz(value: str) -> tuple[float, float, float]:
    r, g, b = hex_to_rgb(value)
    rl, gl, bl = (_srgb_channel_to_linear(c) for c in (r, g, b))
    x = (0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl) * 100
    y = (0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl) * 100
    z = (0.0193339 * rl + 0.1191920 * gl + 0.9503041 * bl) * 100
    return x, y, z


def _xyz_to_lab(xyz: tuple[float, float, float]) -> tuple[float, float, float]:
    x, y, z = xyz
    xr, yr, zr = x / 95.047, y / 100.0, z / 108.883

    def f(t: float) -> float:
        delta = 6 / 29
        if t > delta**3:
            return t ** (1 / 3)
        return t / (3 * delta**2) + 4 / 29

    fx, fy, fz = f(xr), f(yr), f(zr)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def delta_e_76(first: str, second: str) -> float:
    l1, a1, b1 = _xyz_to_lab(_rgb_to_xyz(first))
    l2, a2, b2 = _xyz_to_lab(_rgb_to_xyz(second))
    return math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2)


def choose_safe_background(
    artwork_colors: Iterable[str],
    safe_palette: Iterable[str] = SAFE_BACKGROUND_PALETTE,
) -> dict[str, object]:
    colors = [normalize_hex(color) for color in artwork_colors]
    if not colors:
        raise ValueError("at least one artwork color is required")

    ranked: list[dict[str, object]] = []
    for candidate in safe_palette:
        candidate = normalize_hex(candidate)
        distances = [delta_e_76(candidate, color) for color in colors]
        ratios = [contrast_ratio(candidate, color) for color in colors]
        ranked.append(
            {
                "color": candidate,
                "minimum_delta_e": round(min(distances), 2),
                "average_delta_e": round(sum(distances) / len(distances), 2),
                "minimum_contrast_ratio": round(min(ratios), 2),
            }
        )

    ranked.sort(
        key=lambda item: (
            float(item["minimum_delta_e"]),
            float(item["average_delta_e"]),
            float(item["minimum_contrast_ratio"]),
        ),
        reverse=True,
    )
    return {"selected": ranked[0]["color"], "ranked_candidates": ranked}
