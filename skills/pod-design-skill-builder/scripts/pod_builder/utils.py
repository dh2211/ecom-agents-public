"""Small dependency-free utilities."""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from pathlib import Path
from typing import Any

from .constants import ID_PATTERN


def slugify(value: str) -> str:
    """Create an ASCII hyphen slug while preserving Vietnamese transliteration."""
    value = str(value).strip().lower().replace("đ", "d")
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    ascii_value = ascii_value.encode("ascii", "ignore").decode("ascii")
    ascii_value = re.sub(r"[^a-z0-9]+", "-", ascii_value)
    return re.sub(r"-+", "-", ascii_value).strip("-") or "niche"


def validate_slug(value: str) -> bool:
    return bool(ID_PATTERN.fullmatch(value))


def titleize(value: str) -> str:
    return " ".join(part.capitalize() for part in re.split(r"[-_\s]+", value) if part)


def yaml_string(value: str) -> str:
    """JSON strings are valid YAML scalars and safely quote punctuation/newlines."""
    return json.dumps(value, ensure_ascii=False)


def read_json(path: Path) -> dict[str, Any]:
    try:
        raw = path.read_text(encoding="utf-8-sig")
        data = json.loads(raw)
    except FileNotFoundError as exc:
        raise ValueError(f"data file does not exist: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"invalid JSON in {path} at line {exc.lineno}, column {exc.colno}: {exc.msg}"
        ) from exc
    if not isinstance(data, dict):
        raise ValueError("master data root must be a JSON object")
    return data


def deep_copy_json(value: Any) -> Any:
    return json.loads(json.dumps(value, ensure_ascii=False))


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8", newline="\n")


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")


def sha256_json(value: Any) -> str:
    return hashlib.sha256(canonical_json_bytes(value)).hexdigest()


def contains_control_characters(value: str) -> bool:
    return any(ord(ch) < 32 and ch not in {"\t"} for ch in value)
