"""Atomic target installation, validation, and package verification."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .constants import (
    EXCLUDED_PACKAGE_NAMES,
    EXCLUDED_PACKAGE_SUFFIXES,
    GENERATOR_ID,
    ID_PATTERN,
    MAX_SKILL_ZIP_BYTES,
)
from .rendering import write_target_skill


class BuildError(RuntimeError):
    """Raised when a target skill cannot be safely built or packaged."""


def _parse_restricted_frontmatter(skill_md: Path) -> dict[str, str]:
    content = skill_md.read_text(encoding="utf-8")
    match = re.match(r"^---\n(.*?)\n---(?:\n|$)", content, re.DOTALL)
    if not match:
        raise BuildError("SKILL.md has invalid YAML frontmatter delimiters")
    parsed: dict[str, str] = {}
    for line_number, raw in enumerate(match.group(1).splitlines(), start=2):
        if not raw.strip():
            continue
        if ":" not in raw:
            raise BuildError(f"SKILL.md frontmatter line {line_number} is malformed")
        key, value = raw.split(":", 1)
        key = key.strip()
        value = value.strip()
        if key in parsed:
            raise BuildError(f"SKILL.md frontmatter duplicates {key!r}")
        if value.startswith('"'):
            try:
                decoded = json.loads(value)
            except json.JSONDecodeError as exc:
                raise BuildError(
                    f"SKILL.md frontmatter value for {key!r} is not a valid quoted string"
                ) from exc
            if not isinstance(decoded, str):
                raise BuildError(f"SKILL.md frontmatter {key!r} must be a string")
            parsed[key] = decoded
        else:
            parsed[key] = value
    return parsed


def validate_skill_folder(skill_dir: Path) -> list[str]:
    errors: list[str] = []
    if not skill_dir.is_dir():
        return [f"skill folder does not exist: {skill_dir}"]
    skill_md = skill_dir / "SKILL.md"
    agent_yaml = skill_dir / "agents" / "openai.yaml"
    manifest_path = skill_dir / "manifest.json"
    if not skill_md.is_file():
        errors.append("SKILL.md is missing")
    if not agent_yaml.is_file():
        errors.append("agents/openai.yaml is missing")
    if not manifest_path.is_file():
        errors.append("manifest.json is missing")
    if errors:
        return errors

    try:
        frontmatter = _parse_restricted_frontmatter(skill_md)
    except (BuildError, OSError) as exc:
        return [str(exc)]

    unexpected = set(frontmatter) - {"name", "description"}
    if unexpected:
        errors.append(f"unexpected frontmatter fields: {sorted(unexpected)}")
    name = frontmatter.get("name", "")
    description = frontmatter.get("description", "")
    if not name:
        errors.append("frontmatter name is missing")
    elif not ID_PATTERN.fullmatch(name):
        errors.append("frontmatter name must be lowercase hyphenated text")
    elif len(name) > 64:
        errors.append("frontmatter name exceeds 64 characters")
    if not description:
        errors.append("frontmatter description is missing")
    elif len(description) > 1024:
        errors.append("frontmatter description exceeds 1024 characters")
    elif "<" in description or ">" in description:
        errors.append("frontmatter description cannot contain angle brackets")

    try:
        content = skill_md.read_text(encoding="utf-8")
    except OSError as exc:
        errors.append(f"cannot read SKILL.md: {exc}")
        return errors
    for relative in sorted(set(re.findall(r"(?:references|scripts)/[A-Za-z0-9._/-]+", content))):
        candidate = skill_dir / relative.rstrip(".,;:)")
        if not candidate.exists():
            errors.append(f"SKILL.md references missing path: {relative}")

    for path in skill_dir.rglob("*"):
        if path.is_symlink():
            errors.append(f"symlink is not allowed in packaged skill: {path.relative_to(skill_dir)}")

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"manifest.json is unreadable: {exc}")
        return errors
    content_hashes = manifest.get("content_sha256") if isinstance(manifest, dict) else None
    if not isinstance(content_hashes, dict):
        errors.append("manifest.json content_sha256 must be an object")
        return errors
    tracked_paths = {
        path.relative_to(skill_dir).as_posix()
        for path in skill_dir.rglob("*")
        if path.is_file()
        and path.name != "manifest.json"
        and "__pycache__" not in path.relative_to(skill_dir).parts
        and path.suffix.lower() not in EXCLUDED_PACKAGE_SUFFIXES
        and path.name not in EXCLUDED_PACKAGE_NAMES
    }
    if set(content_hashes) != tracked_paths:
        missing = sorted(tracked_paths - set(content_hashes))
        extra = sorted(set(content_hashes) - tracked_paths)
        errors.append(
            f"manifest content paths do not match target files; missing={missing}, extra={extra}"
        )
    for relative, expected in content_hashes.items():
        if relative not in tracked_paths:
            continue
        if not isinstance(expected, str) or not re.fullmatch(r"[0-9a-f]{64}", expected):
            errors.append(f"manifest hash for {relative!r} is not lowercase SHA-256")
            continue
        actual = hashlib.sha256((skill_dir / relative).read_bytes()).hexdigest()
        if actual != expected:
            errors.append(
                f"manifest hash mismatch for {relative!r}: expected {expected}, found {actual}"
            )
    return errors


def discover_platform_validator(explicit: Path | None = None) -> Path | None:
    if explicit is not None:
        candidate = explicit.expanduser().resolve()
        if not candidate.is_file():
            raise BuildError(f"platform validator not found: {candidate}")
        return candidate

    env_value = os.environ.get("SKILL_QUICK_VALIDATOR")
    candidates = []
    if env_value:
        candidates.append(Path(env_value))
    candidates.extend(
        [
            Path("/home/oai/skills/skill-creator/scripts/quick_validate.py"),
            Path("/home/oai/share/skills/skill-creator/scripts/quick_validate.py"),
        ]
    )
    for candidate in candidates:
        if candidate.is_file():
            return candidate.resolve()
    return None


def validate_for_packaging(
    skill_dir: Path,
    *,
    platform_validator: Path | None,
    allow_internal_validator: bool,
) -> Path | None:
    errors = validate_skill_folder(skill_dir)
    if errors:
        raise BuildError("internal skill validation failed:\n- " + "\n- ".join(errors))

    validator = discover_platform_validator(platform_validator)
    if validator is None:
        if allow_internal_validator:
            return None
        raise BuildError(
            "platform quick_validate.py was not found. Pass --platform-validator PATH, "
            "set SKILL_QUICK_VALIDATOR, or explicitly use --allow-internal-validator."
        )

    completed = subprocess.run(
        [sys.executable, str(validator), str(skill_dir)],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    if completed.returncode != 0:
        output = completed.stdout.strip() or "validator returned no details"
        raise BuildError(f"platform validation failed:\n{output}")
    return validator


def _read_manifest(skill_dir: Path) -> dict[str, Any]:
    manifest_path = skill_dir / "manifest.json"
    if not manifest_path.is_file():
        raise BuildError(
            f"refusing to replace {skill_dir}: generated manifest is missing"
        )
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise BuildError(
            f"refusing to replace {skill_dir}: manifest is unreadable"
        ) from exc
    if not isinstance(manifest, dict):
        raise BuildError(f"refusing to replace {skill_dir}: manifest root is invalid")
    return manifest


def _verify_replace_target(skill_dir: Path, expected_niche: str) -> None:
    manifest = _read_manifest(skill_dir)
    if manifest.get("generator_id") != GENERATOR_ID:
        raise BuildError(
            f"refusing to replace {skill_dir}: generator_id does not match {GENERATOR_ID!r}"
        )
    if manifest.get("niche_slug") != expected_niche:
        raise BuildError(
            f"refusing to replace {skill_dir}: manifest niche does not match {expected_niche!r}"
        )


def build_target_atomic(
    data: dict[str, Any],
    output_dir: Path,
    assets_root: Path,
    *,
    replace_generated: bool,
    platform_validator: Path | None,
    allow_internal_validator: bool,
) -> tuple[Path, Path | None]:
    output_dir = output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    target = output_dir / f"{data['niche_slug']}-pod-design-agent"
    if target.exists() and not replace_generated:
        raise BuildError(
            f"target already exists: {target}. Use --replace-generated only for a builder-owned target."
        )
    if target.exists():
        _verify_replace_target(target, data["niche_slug"])

    temp_root = Path(tempfile.mkdtemp(prefix=".pod-build-", dir=output_dir))
    temp_skill = temp_root / target.name
    backup: Path | None = None
    try:
        write_target_skill(data, temp_skill, assets_root)
        validator = validate_for_packaging(
            temp_skill,
            platform_validator=platform_validator,
            allow_internal_validator=allow_internal_validator,
        )

        if target.exists():
            backup = output_dir / f".{target.name}.backup-{uuid.uuid4().hex}"
            target.rename(backup)
        try:
            temp_skill.rename(target)
        except Exception:
            if backup is not None and backup.exists() and not target.exists():
                backup.rename(target)
            raise
        if backup is not None and backup.exists():
            shutil.rmtree(backup)
        return target, validator
    finally:
        if temp_root.exists():
            shutil.rmtree(temp_root, ignore_errors=True)
        if backup is not None and backup.exists() and not target.exists():
            backup.rename(target)


def _exclude_from_package(path: Path, root: Path) -> bool:
    relative = path.relative_to(root)
    if "__pycache__" in relative.parts:
        return True
    if path.name in EXCLUDED_PACKAGE_NAMES:
        return True
    if path.suffix.lower() in EXCLUDED_PACKAGE_SUFFIXES:
        return True
    if any(part.startswith(".pod-build-") for part in relative.parts):
        return True
    return False


def verify_zip(zip_path: Path, expected_root: str) -> None:
    try:
        with zipfile.ZipFile(zip_path) as archive:
            names = archive.namelist()
            if not names:
                raise BuildError("created ZIP is empty")
            roots: set[str] = set()
            for name in names:
                normalized = Path(name)
                if normalized.is_absolute() or ".." in normalized.parts:
                    raise BuildError(f"unsafe ZIP member: {name}")
                if normalized.parts:
                    roots.add(normalized.parts[0])
                if "__pycache__" in normalized.parts or normalized.suffix.lower() in EXCLUDED_PACKAGE_SUFFIXES:
                    raise BuildError(f"cache file leaked into ZIP: {name}")
            if roots != {expected_root}:
                raise BuildError(f"ZIP must contain one root {expected_root!r}; found {sorted(roots)}")
            required = {
                f"{expected_root}/SKILL.md",
                f"{expected_root}/agents/openai.yaml",
                f"{expected_root}/manifest.json",
            }
            missing = required - set(names)
            if missing:
                raise BuildError(f"ZIP is missing required files: {sorted(missing)}")
            bad = archive.testzip()
            if bad:
                raise BuildError(f"ZIP CRC verification failed at {bad}")
    except zipfile.BadZipFile as exc:
        raise BuildError(f"created archive is not a valid ZIP: {zip_path}") from exc


def _deterministic_zip_timestamp() -> tuple[int, int, int, int, int, int]:
    raw = os.environ.get("SOURCE_DATE_EPOCH")
    if raw is None:
        return (1980, 1, 1, 0, 0, 0)
    try:
        epoch = int(raw)
    except ValueError as exc:
        raise BuildError("SOURCE_DATE_EPOCH must be an integer Unix timestamp") from exc
    if epoch < 0:
        raise BuildError("SOURCE_DATE_EPOCH must not be negative")
    instant = datetime.fromtimestamp(epoch, tz=timezone.utc)
    if instant.year < 1980:
        return (1980, 1, 1, 0, 0, 0)
    if instant.year > 2107:
        raise BuildError("SOURCE_DATE_EPOCH exceeds the ZIP timestamp range")
    return (
        instant.year,
        instant.month,
        instant.day,
        instant.hour,
        instant.minute,
        instant.second - instant.second % 2,
    )


def package_target(
    skill_dir: Path,
    output_dir: Path,
    *,
    replace_archive: bool,
    platform_validator: Path | None,
    allow_internal_validator: bool,
) -> tuple[Path, Path | None]:
    validator = validate_for_packaging(
        skill_dir,
        platform_validator=platform_validator,
        allow_internal_validator=allow_internal_validator,
    )
    output_dir = output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    zip_path = output_dir / "skill.zip"
    if zip_path.exists() and not replace_archive:
        raise BuildError(
            f"archive already exists: {zip_path}. Use --replace-generated to replace it."
        )

    fd, temp_name = tempfile.mkstemp(prefix=".skill-", suffix=".zip", dir=output_dir)
    os.close(fd)
    temp_zip = Path(temp_name)
    try:
        timestamp = _deterministic_zip_timestamp()
        with zipfile.ZipFile(temp_zip, "w", zipfile.ZIP_DEFLATED) as archive:
            for path in sorted(skill_dir.rglob("*")):
                if not path.is_file() or _exclude_from_package(path, skill_dir):
                    continue
                if path.is_symlink():
                    raise BuildError(f"refusing to package symlink: {path}")
                archive_name = (Path(skill_dir.name) / path.relative_to(skill_dir)).as_posix()
                info = zipfile.ZipInfo(archive_name, date_time=timestamp)
                info.compress_type = zipfile.ZIP_DEFLATED
                info.create_system = 3
                info.external_attr = 0o100644 << 16
                info.flag_bits |= 0x800
                archive.writestr(info, path.read_bytes())
        size = temp_zip.stat().st_size
        if size > MAX_SKILL_ZIP_BYTES:
            raise BuildError(
                f"skill.zip would be {size:,} bytes, exceeding the {MAX_SKILL_ZIP_BYTES:,}-byte limit"
            )
        verify_zip(temp_zip, skill_dir.name)
        os.replace(temp_zip, zip_path)
        return zip_path, validator
    finally:
        if temp_zip.exists():
            temp_zip.unlink()
