"""Separate urinalysis module.

Two responsibilities:
1. assess_urinalysis_compatibility(): decide whether the urinalysis CSV can be
   legitimately merged into the Model 1 supervised table. It can ONLY be merged if
   it has a maternal-risk target that normalizes to low/medium/high AND shares
   enough maternal feature columns with the maternal dataset.
2. extract_urinalysis_features(): otherwise, derive transparent RULE-BASED
   dipstick flags. These are informational context, NOT a risk label, and are
   never used as a training target.

Prototype only; not clinically validated; healthcare professional review required.
"""
from __future__ import annotations

from typing import Any, Sequence

import numpy as np
import pandas as pd

from common import config
from common.validation import (
    DatasetError,
    apply_column_aliases,
    find_target_column,
    normalize_column_name,
    normalize_maternal_labels,
)

_NEGATIVE_TOKENS = {"negative", "neg", "-", "0", "none", "nil", "normal", "absent",
                    "nd", "not_detected", "no"}
_TRACE_TOKENS = {"trace", "tr", "+_", "+/-"}
_UNKNOWN_TOKENS = {"", "nan", "unknown", "na", "n_a", "null"}


def qualitative_status(value: Any) -> str:
    """Map a dipstick-style value to negative / trace / positive / unknown."""
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return "unknown"
    if isinstance(value, (int, float, np.number)) and not isinstance(value, bool):
        return "negative" if float(value) <= 0 else "positive"
    text = str(value).strip().lower()
    if text in _TRACE_TOKENS:
        return "trace"
    try:
        return "negative" if float(text) <= 0 else "positive"
    except ValueError:
        pass
    key = normalize_column_name(text) if text else ""
    if text in _NEGATIVE_TOKENS or key in _NEGATIVE_TOKENS:
        return "negative"
    if key in _UNKNOWN_TOKENS or text in _UNKNOWN_TOKENS:
        return "unknown"
    return "positive"


def assess_urinalysis_compatibility(
    urinalysis_df: pd.DataFrame, maternal_feature_cols: Sequence[str]
) -> tuple[dict[str, Any], pd.DataFrame]:
    """Return (assessment, urinalysis frame with canonical maternal column names)."""
    aliased, _ = apply_column_aliases(urinalysis_df, config.MATERNAL_FEATURE_ALIASES, verbose=False)
    reasons: list[str] = []
    target_col = find_target_column(aliased, config.MATERNAL_TARGET_ALIASES)

    if target_col is None:
        reasons.append("no maternal-risk target column (RiskLevel / risk_level / risk) exists in the "
                       "urinalysis file; its own target (if any) measures something else, so it "
                       "cannot be mapped to low/medium/high maternal risk")
    else:
        try:
            normalize_maternal_labels(aliased[target_col], verbose=False)
        except DatasetError as exc:
            reasons.append(f"urinalysis target '{target_col}' cannot be mapped to the maternal "
                           f"risk labels: {exc}")

    shared = [c for c in maternal_feature_cols if c in aliased.columns]
    if len(shared) < config.MIN_MATERNAL_FEATURES:
        reasons.append(f"only {len(shared)} maternal feature column(s) shared with the maternal "
                       f"dataset ({shared}); at least {config.MIN_MATERNAL_FEATURES} are required. "
                       "Merging would create mostly-empty columns")

    result = {
        "compatible": not reasons,
        "reasons": reasons,
        "target_column": target_col,
        "shared_features": shared,
    }
    return result, aliased


def extract_urinalysis_features(
    urinalysis_df: pd.DataFrame,
) -> tuple[pd.DataFrame, dict[str, str]]:
    """Rule-based urinalysis flags. No labels are created; no target is used."""
    aliased, detected = apply_column_aliases(
        urinalysis_df, config.URINALYSIS_FEATURE_ALIASES, verbose=False)
    out = pd.DataFrame(index=aliased.index)

    status_columns: list[str] = []
    for field in config.URINE_QUALITATIVE_FIELDS:
        if field in aliased.columns:
            out[f"{field}_status"] = aliased[field].map(qualitative_status)
            status_columns.append(f"{field}_status")

    for field, (low, high) in config.URINE_TYPICAL_RANGES.items():
        if field in aliased.columns:
            values = pd.to_numeric(aliased[field], errors="coerce")
            out[f"{field}_value"] = values
            out[f"{field}_outside_typical_range"] = ((values < low) | (values > high)).astype("boolean")
            out.loc[values.isna(), f"{field}_outside_typical_range"] = pd.NA

    core = [c for c in ("urine_protein_status", "urine_glucose_status", "blood_status",
                        "leukocytes_status", "nitrite_status") if c in out.columns]
    if core:
        out["positive_dipstick_count"] = (out[core] == "positive").sum(axis=1)
    return out, detected


def flag_urinalysis_record(record: dict[str, Any]) -> dict[str, Any]:
    """Rule-based flags for ONE urinalysis record (used by the maternal-context module)."""
    normalized = {normalize_column_name(k): v for k, v in record.items()}
    features, _ = extract_urinalysis_features(pd.DataFrame([normalized]))
    if features.empty:
        return {"note": "no recognised urinalysis fields were supplied"}
    row = features.iloc[0].to_dict()
    clean = {k: (None if (isinstance(v, float) and np.isnan(v)) else
                 (v.item() if hasattr(v, "item") else v)) for k, v in row.items()}
    clean["note"] = ("rule-based dipstick flags for review context only; "
                     "not a diagnosis and not a risk label")
    return clean