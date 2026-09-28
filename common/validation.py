"""Shared validation, column normalization, label normalization and CSV inspection.

All validation logic for training AND prediction lives here so the two models
never carry conflicting copies.

Prototype only; not clinically validated; healthcare professional review required.
"""
from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence

import numpy as np
import pandas as pd

from common import config


class DatasetError(Exception):
    """A dataset file/column/label problem that must stop training."""


class InputValidationError(ValueError):
    """The prediction input JSON is invalid."""


class ModelNotReadyError(RuntimeError):
    """Model artifacts are missing (train the model first)."""


# ---------------------------------------------------------------------------
# JSON helpers
# ---------------------------------------------------------------------------
def _json_default(obj: Any) -> Any:
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return None if math.isnan(float(obj)) else float(obj)
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, Path):
        return str(obj)
    return str(obj)


def save_json(path: Path | str, obj: Any) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(obj, handle, indent=2, ensure_ascii=False, default=_json_default)


def load_json(path: Path | str) -> Any:
    with Path(path).open("r", encoding="utf-8") as handle:
        return json.load(handle)


# ---------------------------------------------------------------------------
# Column-name normalization
# ---------------------------------------------------------------------------
def normalize_column_name(name: Any) -> str:
    """Lowercase; spaces/punctuation -> underscore; collapse duplicate underscores."""
    text = str(name).replace("\ufeff", "").strip().lower()
    text = re.sub(r"[^0-9a-z]+", "_", text)
    text = re.sub(r"_+", "_", text).strip("_")
    return text or "unnamed"


def normalize_dataframe_columns(
    df: pd.DataFrame, verbose: bool = True
) -> tuple[pd.DataFrame, dict[str, str]]:
    """Return (dataframe with normalized columns, {original: normalized})."""
    mapping: dict[str, str] = {}
    new_columns: list[str] = []
    seen: dict[str, int] = {}
    for original in df.columns:
        normalized = normalize_column_name(original)
        if normalized in seen:
            seen[normalized] += 1
            normalized = f"{normalized}_{seen[normalized]}"
        else:
            seen[normalized] = 1
        new_columns.append(normalized)
        mapping[str(original)] = normalized
    out = df.copy()
    out.columns = new_columns
    if verbose:
        print("  Column-name normalization (original -> normalized):")
        for original, normalized in mapping.items():
            print(f"    {original!r:60} -> {normalized}")
    return out, mapping


def apply_column_aliases(
    df: pd.DataFrame, alias_map: Mapping[str, Sequence[str]], verbose: bool = True
) -> tuple[pd.DataFrame, dict[str, str]]:
    """Rename columns to canonical names using an alias map.

    Returns (renamed dataframe, {canonical: column name found in the file}).
    If two columns map to the same canonical name, the first one wins.
    """
    lookup: dict[str, str] = {}
    for canonical, aliases in alias_map.items():
        for alias in [canonical, *aliases]:
            lookup.setdefault(alias, canonical)

    rename: dict[str, str] = {}
    applied: dict[str, str] = {}
    for column in df.columns:
        canonical = lookup.get(column)
        if canonical is None or canonical in applied:
            continue
        if canonical != column and canonical in df.columns:
            continue  # a column already has the canonical name
        rename[column] = canonical
        applied[canonical] = column
    out = df.rename(columns=rename)
    if verbose and applied:
        print("  Recognised columns (canonical <- column in file):")
        for canonical, source in applied.items():
            print(f"    {canonical:58} <- {source}")
    return out, applied


def find_target_column(df: pd.DataFrame, aliases: Sequence[str] | None) -> str | None:
    if not aliases:
        return None
    for alias in aliases:
        if alias in df.columns:
            return alias
    return None


def validate_required_columns(
    available: Sequence[str], required: Sequence[str], context: str
) -> None:
    missing = [c for c in required if c not in available]
    if missing:
        raise DatasetError(
            f"[{context}] required columns not found: {missing}. "
            f"Columns available: {list(available)}"
        )


def validate_numeric_ranges(
    df: pd.DataFrame, ranges: Mapping[str, tuple[float, float]]
) -> dict[str, dict[str, float]]:
    """Report values outside plausibility bounds (does NOT modify the data)."""
    violations: dict[str, dict[str, float]] = {}
    for column, (low, high) in ranges.items():
        if column not in df.columns:
            continue
        values = pd.to_numeric(df[column], errors="coerce")
        bad = values.notna() & ((values < low) | (values > high))
        if bad.any():
            violations[column] = {
                "rows_out_of_range": int(bad.sum()),
                "allowed_min": low,
                "allowed_max": high,
                "observed_min": float(values.min()),
                "observed_max": float(values.max()),
            }
    return violations


# ---------------------------------------------------------------------------
# Label normalization
# ---------------------------------------------------------------------------
def _maternal_key(value: Any) -> str:
    return normalize_column_name(value)


def _fetal_key(value: Any) -> str:
    if isinstance(value, (int, float, np.integer, np.floating)) and not isinstance(value, bool):
        number = float(value)
        return str(int(number)) if number.is_integer() else str(value)
    text = str(value).strip().lower()
    try:
        number = float(text)
        if number.is_integer():
            return str(int(number))
    except ValueError:
        pass
    return normalize_column_name(text)


def _normalize_labels(
    series: pd.Series,
    label_map: Mapping[str, str],
    key_fn: Callable[[Any], str],
    context: str,
    verbose: bool,
) -> tuple[pd.Series, dict[str, str]]:
    mapping: dict[Any, str] = {}
    unknown: list[Any] = []
    for value in pd.unique(series.dropna()):
        key = key_fn(value)
        if key in label_map:
            mapping[value] = label_map[key]
        else:
            unknown.append(value)
    if unknown:
        raise DatasetError(
            f"[{context}] unrecognised target values: {[str(u) for u in unknown]}. "
            f"Accepted (normalized) values: {sorted(label_map)}. "
            "Refusing to guess labels; update the label map in common/config.py if needed."
        )
    normalized = series.map(mapping)
    printable = {str(k): v for k, v in sorted(mapping.items(), key=lambda kv: str(kv[0]))}
    if verbose:
        print(f"  Label mapping for {context} (original -> normalized):")
        for original, new in printable.items():
            print(f"    {original!r:20} -> {new}")
    return normalized, printable


def normalize_maternal_labels(
    series: pd.Series, verbose: bool = True
) -> tuple[pd.Series, dict[str, str]]:
    """'low risk'/'mid risk'/'high risk' (and variants) -> low/medium/high."""
    return _normalize_labels(series, config.MATERNAL_LABEL_MAP, _maternal_key,
                             "maternal risk target", verbose)


def normalize_fetal_labels(
    series: pd.Series, verbose: bool = True
) -> tuple[pd.Series, dict[str, str]]:
    """1/2/3 (or text variants) -> normal/suspect/pathological."""
    return _normalize_labels(series, config.FETAL_LABEL_MAP, _fetal_key,
                             "fetal_health target", verbose)


# ---------------------------------------------------------------------------
# CSV loading + inspection
# ---------------------------------------------------------------------------
_TARGET_HINTS = ("target", "label", "diagnosis", "result", "class", "risk",
                 "outcome", "health", "status", "nsp")


def load_csv_with_inspection(
    path: Path | str,
    dataset_name: str,
    target_aliases: Sequence[str] | None = None,
    verbose: bool = True,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Load a UTF-8 CSV, normalize column names, print and return an inspection report."""
    path = Path(path)
    if not path.exists():
        raise DatasetError(
            f"[{dataset_name}] file not found: {path}. Place the Kaggle CSV there or "
            "change the path in the DATASET PATHS section of common/config.py."
        )
    try:
        raw = pd.read_csv(path, encoding="utf-8-sig")  # utf-8-sig also handles a BOM
    except UnicodeDecodeError as exc:
        raise DatasetError(f"[{dataset_name}] {path.name} is not valid UTF-8: {exc}. "
                           "Re-save it as UTF-8.") from exc
    except pd.errors.EmptyDataError as exc:
        raise DatasetError(f"[{dataset_name}] {path.name} is empty.") from exc
    if raw.empty:
        raise DatasetError(f"[{dataset_name}] {path.name} has no data rows.")

    if verbose:
        print("=" * 78)
        print(f"DATASET: {dataset_name}")
        print(f"  file name : {path.name}")
        print(f"  shape     : {raw.shape[0]} rows x {raw.shape[1]} columns")
        print(f"  columns   : {list(raw.columns)}")
    df, mapping = normalize_dataframe_columns(raw, verbose=verbose)

    dtypes = {c: str(t) for c, t in df.dtypes.items()}
    missing = {c: int(n) for c, n in df.isna().sum().items()}
    duplicates = int(df.duplicated().sum())

    target_column = find_target_column(df, target_aliases)
    target_unique = None
    class_distribution = None
    if target_column is not None:
        target_unique = sorted(str(v) for v in df[target_column].dropna().unique())
        counts = df[target_column].value_counts(dropna=False)
        class_distribution = {str(k): int(v) for k, v in counts.items()}

    candidates: dict[str, list[str]] = {}
    for column in df.columns:
        if any(hint in column for hint in _TARGET_HINTS) and df[column].nunique(dropna=True) <= 20:
            candidates[column] = sorted(str(v) for v in df[column].dropna().unique())

    report: dict[str, Any] = {
        "dataset": dataset_name,
        "file_name": path.name,
        "file_path": config.rel(path),
        "shape": [int(raw.shape[0]), int(raw.shape[1])],
        "original_columns": [str(c) for c in raw.columns],
        "column_name_mapping": mapping,
        "normalized_columns": list(df.columns),
        "dtypes": dtypes,
        "missing_values": missing,
        "duplicate_rows": duplicates,
        "target_column": target_column,
        "target_unique_values": target_unique,
        "class_distribution": class_distribution,
        "candidate_target_columns": candidates,
        "warning": config.WARNING_TEXT,
    }

    if verbose:
        print("  data types:")
        for column, dtype in dtypes.items():
            print(f"    {column:58} {dtype}")
        print("  missing values per column:")
        for column, count in missing.items():
            print(f"    {column:58} {count}")
        print(f"  duplicate rows: {duplicates}")
        if target_column is not None:
            print(f"  target column: {target_column}")
            print(f"  target unique values: {target_unique}")
            print(f"  class distribution: {class_distribution}")
        else:
            print("  target column: NOT IDENTIFIED with the accepted names "
                  f"{list(target_aliases) if target_aliases else '(none requested)'}")
        if candidates:
            print("  candidate target-like columns and their unique values:")
            for column, values in candidates.items():
                shown = values if len(values) <= 10 else values[:10] + ["..."]
                print(f"    {column}: {shown}")
    return df, report


# ---------------------------------------------------------------------------
# Prediction input handling (shared by both predict.py scripts)
# ---------------------------------------------------------------------------
def read_json_payload(json_arg: str | None, use_stdin: bool) -> Any:
    if json_arg is not None and use_stdin:
        raise InputValidationError("Provide JSON either as an argument or with --stdin, not both.")
    if use_stdin or (json_arg is None and not sys.stdin.isatty()):
        raw = sys.stdin.read()
    else:
        raw = json_arg
    if raw is None or not raw.strip():
        raise InputValidationError(
            "No JSON input provided. Pass a JSON string argument or use --stdin."
        )
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise InputValidationError(f"Invalid JSON: {exc}") from exc


def validate_prediction_payload(
    payload: Any,
    numeric_columns: Sequence[str],
    categorical_columns: Sequence[str],
    ranges: Mapping[str, Sequence[float]],
) -> pd.DataFrame:
    """Strictly validate a single-record payload and return a one-row DataFrame."""
    if not isinstance(payload, dict):
        raise InputValidationError("Input must be a single JSON object (not a list or scalar).")
    expected = [*numeric_columns, *categorical_columns]
    unknown = sorted(set(payload) - set(expected))
    missing = [c for c in expected if c not in payload or payload[c] is None]
    problems = []
    if unknown:
        problems.append(f"Unknown input fields rejected: {unknown}")
    if missing:
        problems.append(f"Missing required fields: {missing}")
    if problems:
        raise InputValidationError("; ".join(problems) + f". Expected exactly these fields: {expected}")

    row: dict[str, Any] = {}
    for column in numeric_columns:
        value = payload[column]
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise InputValidationError(f"Field '{column}' must be a number, got {value!r}.")
        if not math.isfinite(value):
            raise InputValidationError(f"Field '{column}' must be a finite number.")
        if column in ranges:
            low, high = ranges[column]
            if value < low or value > high:
                raise InputValidationError(
                    f"Field '{column}'={value} is outside the accepted range [{low}, {high}]. "
                    "Check the units documented in the README."
                )
        row[column] = float(value)
    for column in categorical_columns:
        value = payload[column]
        if isinstance(value, (dict, list)):
            raise InputValidationError(f"Field '{column}' must be a string or number.")
        row[column] = value
    return pd.DataFrame([row], columns=expected)


def ordered_probabilities(
    classes: Sequence[Any], probabilities: Sequence[float],
    display_order: Sequence[str], ndigits: int = 6,
) -> dict[str, float]:
    pairs = {str(c): float(p) for c, p in zip(classes, probabilities)}
    ordered = {label: round(pairs[label], ndigits) for label in display_order if label in pairs}
    for label, value in pairs.items():
        ordered.setdefault(label, round(value, ndigits))
    return ordered


def require_artifacts(paths: Sequence[Path], train_command: str) -> None:
    missing = [config.rel(p) for p in paths if not Path(p).exists()]
    if missing:
        raise ModelNotReadyError(f"Missing model artifacts: {missing}. Run `{train_command}` first.")


def error_response(model_name: str, message: str, error_type: str) -> dict[str, str]:
    return {
        "model": model_name,
        "error": message,
        "error_type": error_type,
        "warning": config.WARNING_TEXT,
    }