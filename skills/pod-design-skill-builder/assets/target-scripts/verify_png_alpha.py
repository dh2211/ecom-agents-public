#!/usr/bin/env python3
"""Strictly verify that a POD PNG contains meaningful real transparency."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Verify real PNG alpha, transparent canvas edges, visible artwork, and safe margins"
    )
    parser.add_argument("image")
    parser.add_argument("--minimum-fully-transparent-ratio", type=float, default=0.01)
    parser.add_argument("--minimum-transparent-border-ratio", type=float, default=0.99)
    parser.add_argument("--minimum-visible-ratio", type=float, default=0.001)
    parser.add_argument(
        "--maximum-significant-visible-ratio",
        type=float,
        default=0.90,
        help="Reject nearly full-canvas opaque art or an inset background panel.",
    )
    parser.add_argument(
        "--maximum-significant-bbox-fill-ratio",
        type=float,
        default=0.92,
        help="Reject a near-solid rectangular alpha mask inside the artwork bounding box.",
    )
    parser.add_argument("--minimum-significant-margin-ratio", type=float, default=0.005)
    parser.add_argument("--significant-alpha-threshold", type=int, default=8)
    parser.add_argument(
        "--edge-alpha-threshold",
        type=int,
        default=1,
        help="Treat edge alpha values at or below this value as transparent noise.",
    )
    return parser


def _flattened(image):
    if hasattr(image, "get_flattened_data"):
        return image.get_flattened_data()
    return image.getdata()


def _validate_args(args: argparse.Namespace) -> None:
    for name in (
        "minimum_fully_transparent_ratio",
        "minimum_transparent_border_ratio",
        "minimum_visible_ratio",
        "maximum_significant_visible_ratio",
        "maximum_significant_bbox_fill_ratio",
        "minimum_significant_margin_ratio",
    ):
        value = getattr(args, name)
        if not 0 <= value <= 1:
            raise ValueError(f"{name.replace('_', '-')} must be from 0 to 1")
    if args.minimum_visible_ratio >= args.maximum_significant_visible_ratio:
        raise ValueError(
            "minimum-visible-ratio must be lower than maximum-significant-visible-ratio"
        )
    if not 1 <= args.significant_alpha_threshold <= 254:
        raise ValueError("significant-alpha-threshold must be from 1 to 254")
    if not 0 <= args.edge_alpha_threshold < args.significant_alpha_threshold:
        raise ValueError(
            "edge-alpha-threshold must be zero or greater and lower than significant-alpha-threshold"
        )


def main() -> int:
    args = build_parser().parse_args()
    try:
        _validate_args(args)
        try:
            from PIL import Image
        except ImportError as exc:
            raise RuntimeError("Pillow is required for alpha verification") from exc

        path = Path(args.image)
        source = Image.open(path)
        if source.format != "PNG":
            raise ValueError(f"expected PNG, found {source.format!r}")

        had_alpha = source.mode in {"RGBA", "LA"} or (
            source.mode == "P" and "transparency" in source.info
        )
        rgba = source.convert("RGBA")
        alpha = rgba.getchannel("A")
        histogram = alpha.histogram()
        width, height = rgba.size
        total = width * height

        fully_transparent = histogram[0]
        semitransparent = sum(histogram[1:255])
        fully_opaque = histogram[255]
        significant_visible = sum(histogram[args.significant_alpha_threshold + 1 :])

        border_values: list[int] = []
        border_values.extend(_flattened(alpha.crop((0, 0, width, 1))))
        border_values.extend(_flattened(alpha.crop((0, height - 1, width, height))))
        if height > 2:
            border_values.extend(_flattened(alpha.crop((0, 1, 1, height - 1))))
            border_values.extend(_flattened(alpha.crop((width - 1, 1, width, height - 1))))
        border_transparent = sum(
            1 for value in border_values if value <= args.edge_alpha_threshold
        )
        border_ratio = border_transparent / len(border_values) if border_values else 0.0

        significant_mask = alpha.point(
            lambda value: 255 if value > args.significant_alpha_threshold else 0
        )
        bbox = significant_mask.getbbox()
        margin_pixels = None
        margin_ratios = None
        minimum_margin_ratio = 0.0
        significant_bbox_fill_ratio = 0.0
        if bbox:
            left, top, right, bottom = bbox
            bbox_area = max(1, (right - left) * (bottom - top))
            significant_bbox_fill_ratio = significant_visible / bbox_area
            margin_pixels = {
                "left": left,
                "top": top,
                "right": width - right,
                "bottom": height - bottom,
            }
            margin_ratios = {
                "left": left / width,
                "top": top / height,
                "right": (width - right) / width,
                "bottom": (height - bottom) / height,
            }
            minimum_margin_ratio = min(margin_ratios.values())

        fully_transparent_ratio = fully_transparent / total
        semitransparent_ratio = semitransparent / total
        opaque_ratio = fully_opaque / total
        significant_visible_ratio = significant_visible / total

        failures: list[str] = []
        if not had_alpha:
            failures.append("source file has no alpha channel or indexed transparency")
        if fully_transparent_ratio < args.minimum_fully_transparent_ratio:
            failures.append(
                "fully transparent pixel ratio is below the required threshold"
            )
        if significant_visible_ratio < args.minimum_visible_ratio:
            failures.append("visible artwork ratio is below the required threshold")
        if significant_visible_ratio > args.maximum_significant_visible_ratio:
            failures.append(
                "significant visible coverage is too high for isolated transparent artwork"
            )
        if bbox and significant_bbox_fill_ratio > args.maximum_significant_bbox_fill_ratio:
            failures.append(
                "alpha mask nearly fills its rectangular bounding box, suggesting an inset background panel"
            )
        if border_ratio < args.minimum_transparent_border_ratio:
            failures.append("canvas border is not sufficiently transparent")
        if bbox is None:
            failures.append("no visible artwork remains after alpha thresholding")
        elif minimum_margin_ratio < args.minimum_significant_margin_ratio:
            failures.append("significant artwork is too close to or touches a canvas edge")

        payload = {
            "image": str(path),
            "size": [width, height],
            "source_mode": source.mode,
            "had_alpha_capability": had_alpha,
            "fully_transparent_pixels": fully_transparent,
            "fully_transparent_ratio": round(fully_transparent_ratio, 6),
            "semitransparent_pixels": semitransparent,
            "semitransparent_ratio": round(semitransparent_ratio, 6),
            "fully_opaque_pixels": fully_opaque,
            "opaque_ratio": round(opaque_ratio, 6),
            "significant_visible_pixels": significant_visible,
            "significant_visible_ratio": round(significant_visible_ratio, 6),
            "significant_bbox_fill_ratio": round(significant_bbox_fill_ratio, 6),
            "transparent_border_ratio": round(border_ratio, 6),
            "significant_alpha_threshold": args.significant_alpha_threshold,
            "significant_content_bbox": list(bbox) if bbox else None,
            "margin_pixels": margin_pixels,
            "margin_ratios": {
                key: round(value, 6) for key, value in margin_ratios.items()
            }
            if margin_ratios
            else None,
            "minimum_significant_margin_ratio": round(minimum_margin_ratio, 6),
            "required_thresholds": {
                "minimum_fully_transparent_ratio": args.minimum_fully_transparent_ratio,
                "minimum_transparent_border_ratio": args.minimum_transparent_border_ratio,
                "minimum_visible_ratio": args.minimum_visible_ratio,
                "maximum_significant_visible_ratio": args.maximum_significant_visible_ratio,
                "maximum_significant_bbox_fill_ratio": args.maximum_significant_bbox_fill_ratio,
                "minimum_significant_margin_ratio": args.minimum_significant_margin_ratio,
                "edge_alpha_threshold": args.edge_alpha_threshold,
            },
            "failure_reasons": failures,
            "passed": not failures,
        }
        print(json.dumps(payload, indent=2))
        return 0 if not failures else 2
    except (OSError, RuntimeError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
