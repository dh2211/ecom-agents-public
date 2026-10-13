#!/usr/bin/env python3
"""Remove an approved flat background by flood-filling edge-connected pixels."""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path

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


def rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    return "#" + "".join(f"{channel:02X}" for channel in rgb)


def distance(first: tuple[int, int, int], second: tuple[int, int, int]) -> float:
    return math.sqrt(sum((a-b) ** 2 for a, b in zip(first, second)))


def detect_background(image, tolerance: int) -> str:
    width, height = image.size
    sample_points = [
        (0, 0),
        (width - 1, 0),
        (0, height - 1),
        (width - 1, height - 1),
        (width // 2, 0),
        (width // 2, height - 1),
        (0, height // 2),
        (width - 1, height // 2),
    ]
    samples = [image.getpixel(point)[:3] for point in sample_points]
    average = tuple(round(sum(sample[index] for sample in samples) / len(samples)) for index in range(3))
    safe_rgbs = {color: hex_to_rgb(color) for color in SAFE_BACKGROUND_PALETTE}
    selected, selected_rgb = min(safe_rgbs.items(), key=lambda item: distance(average, item[1]))
    if distance(average, selected_rgb) > max(20, tolerance * 1.5):
        raise ValueError(
            f"edge color {rgb_to_hex(average)} is not close to the approved safe palette"
        )
    if any(distance(sample, selected_rgb) > max(25, tolerance * 2) for sample in samples):
        raise ValueError("canvas edges are not a uniform flat background; refuse automatic removal")
    return selected


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Remove a safe, flat POD background")
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument(
        "--background",
        default="auto",
        help="Approved #RRGGBB background or auto",
    )
    parser.add_argument("--tolerance", type=int, default=18)
    parser.add_argument(
        "--edge-softness",
        type=int,
        default=0,
        choices=range(0, 4),
        help="Expand the removed region by 0-3 pixels; use only when edge fringe remains",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        if not 0 <= args.tolerance <= 64:
            raise ValueError("tolerance must be from 0 to 64")
        try:
            from PIL import Image, ImageChops, ImageDraw, ImageFilter
        except ImportError as exc:
            raise RuntimeError("Pillow is required for background removal") from exc

        input_path = Path(args.input)
        output_path = Path(args.output)
        image = Image.open(input_path).convert("RGBA")
        background = (
            detect_background(image, args.tolerance)
            if args.background.lower() == "auto"
            else normalize_hex(args.background)
        )
        if background not in SAFE_BACKGROUND_PALETTE:
            raise ValueError(
                f"background must be one of {SAFE_BACKGROUND_PALETTE}; found {background}"
            )

        bg_rgb = hex_to_rgb(background)
        rgb = image.convert("RGB")
        solid = Image.new("RGB", image.size, bg_rgb)
        diff = ImageChops.difference(rgb, solid)
        channels = diff.split()
        max_diff = ImageChops.lighter(ImageChops.lighter(channels[0], channels[1]), channels[2])
        candidate = max_diff.point(lambda value: 255 if value <= args.tolerance else 0, mode="1").convert("L")

        marker = 128
        draw = ImageDraw.Draw(candidate)
        width, height = candidate.size
        starts = [
            (0, 0),
            (width - 1, 0),
            (0, height - 1),
            (width - 1, height - 1),
            (width // 2, 0),
            (width // 2, height - 1),
            (0, height // 2),
            (width - 1, height // 2),
        ]
        for point in starts:
            if candidate.getpixel(point) == 255:
                ImageDraw.floodfill(candidate, point, marker, thresh=0)

        removed = candidate.point(lambda value: 255 if value == marker else 0)
        if args.edge_softness:
            removed = removed.filter(ImageFilter.MaxFilter(args.edge_softness * 2 + 1))
        keep = ImageChops.invert(removed)
        original_alpha = image.getchannel("A")
        new_alpha = ImageChops.multiply(original_alpha, keep)
        image.putalpha(new_alpha)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        image.save(output_path, format="PNG")
        histogram = removed.histogram()
        removed_pixels = histogram[255]
        payload = {
            "input": str(input_path),
            "output": str(output_path),
            "background": background,
            "tolerance": args.tolerance,
            "edge_softness": args.edge_softness,
            "removed_pixels": removed_pixels,
            "total_pixels": image.width * image.height,
            "removed_ratio": round(removed_pixels / (image.width * image.height), 6),
        }
        print(json.dumps(payload, indent=2))
        return 0
    except (OSError, RuntimeError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
