"""Inspect all three raw CSV files before training.

Run from the repository root:
    python scripts/inspect_datasets.py

Prints shape, columns, dtypes, missing values, duplicates, target values and class
distribution, saves JSON reports to data/processed/, and previews the label
mappings and the urinalysis merge decision.

Prototype only; not clinically validated; healthcare professional review required.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from common import config  # noqa: E402
from common.urinalysis_features import assess_urinalysis_compatibility  # noqa: E402
from common.validation import (  # noqa: E402
    DatasetError,
    apply_column_aliases,
    load_csv_with_inspection,
    normalize_fetal_labels,
    normalize_maternal_labels,
    save_json,
)


def main() -> int:
    config.ensure_dirs()
    specs = [
        ("maternal_health", config.MATERNAL_CSV, config.MATERNAL_TARGET_ALIASES, True),
        ("urinalysis", config.URINALYSIS_CSV, config.MATERNAL_TARGET_ALIASES, False),
        ("fetal_health", config.FETAL_CSV, config.FETAL_TARGET_ALIASES, True),
    ]
    frames, reports, blocking = {}, {}, []

    for name, path, aliases, required in specs:
        try:
            frame, report = load_csv_with_inspection(path, name, target_aliases=aliases)
            frames[name], reports[name] = frame, report
            save_json(config.PROCESSED_DIR / f"inspection_{name}.json", report)
        except DatasetError as exc:
            print(f"\n[{'ERROR' if required else 'WARNING'}] {exc}")
            if required:
                blocking.append(name)

    summary: dict = {"warning": config.WARNING_TEXT}
    print("\n" + "=" * 78)
    print("PREVIEW: target label mappings and feature detection")

    if "maternal_health" in frames:
        frame, report = frames["maternal_health"], reports["maternal_health"]
        aliased, applied = apply_column_aliases(frame, config.MATERNAL_FEATURE_ALIASES)
        summary["maternal_features_detected"] = list(applied)
        if report["target_column"]:
            try:
                _, mapping = normalize_maternal_labels(frame[report["target_column"]])
                summary["maternal_label_mapping"] = mapping
            except DatasetError as exc:
                print(f"[ERROR] {exc}")
                blocking.append("maternal_target")
        else:
            print("[ERROR] maternal risk target column not found "
                  f"(accepted: {config.MATERNAL_TARGET_ALIASES}).")
            blocking.append("maternal_target")

        if "urinalysis" in frames:
            compat, _ = assess_urinalysis_compatibility(frames["urinalysis"], list(applied))
            summary["urinalysis_merge_decision"] = compat
            print("\nURINALYSIS MERGE DECISION (preview):",
                  "MERGE POSSIBLE" if compat["compatible"] else "KEPT SEPARATE")
            for reason in compat["reasons"]:
                print(f"  - {reason}")

    if "fetal_health" in frames:
        frame, report = frames["fetal_health"], reports["fetal_health"]
        aliased, applied = apply_column_aliases(frame, config.CTG_FEATURE_ALIASES)
        summary["ctg_features_detected"] = list(applied)
        missing = [c for c in config.CTG_FEATURES if c not in applied]
        if missing:
            print(f"  CTG features not found in file: {missing}")
        if report["target_column"]:
            try:
                _, mapping = normalize_fetal_labels(frame[report["target_column"]])
                summary["fetal_label_mapping"] = mapping
            except DatasetError as exc:
                print(f"[ERROR] {exc}")
                blocking.append("fetal_target")
        else:
            print("[ERROR] fetal_health target column not found "
                  f"(accepted: {config.FETAL_TARGET_ALIASES}).")
            blocking.append("fetal_target")

    save_json(config.PROCESSED_DIR / "inspection_summary.json", summary)
    print(f"\nReports saved in {config.rel(config.PROCESSED_DIR)}/")
    print(config.WARNING_TEXT)
    if blocking:
        print(f"\nINSPECTION FOUND BLOCKING PROBLEMS: {blocking}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())