"""Train Model 2: fetal health status from CTG features (normal / suspect / pathological).

Run from the repository root:
    python model2_fetal_health/train.py

Design:
* Trained ONLY on the Fetal Health (CTG) CSV, using only CTG feature columns.
* Maternal and urinalysis data are NOT used as CTG observations and are NOT joined
  to CTG rows (no shared patient ID exists). Maternal context is handled at
  application level by common/maternal_context.py.
* The target (fetal_health) is never used as a feature; it is never mixed with
  maternal risk labels.

Prototype only; not clinically validated; healthcare professional review required.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import joblib  # noqa: E402
import pandas as pd  # noqa: E402
from sklearn.compose import ColumnTransformer  # noqa: E402
from sklearn.ensemble import RandomForestClassifier  # noqa: E402
from sklearn.impute import SimpleImputer  # noqa: E402
from sklearn.pipeline import Pipeline  # noqa: E402

from common import config  # noqa: E402
from common.evaluation import (  # noqa: E402
    evaluate_classifier,
    safe_stratified_split,
    save_confusion_matrix_plot,
)
from common.validation import (  # noqa: E402
    DatasetError,
    apply_column_aliases,
    load_csv_with_inspection,
    normalize_fetal_labels,
    save_json,
    validate_numeric_ranges,
)

TARGET_COLUMN = "fetal_status"  # internal name; never part of the feature list


def run() -> int:
    config.ensure_dirs()
    print(f"MODEL 2 TRAINING  ({config.MODEL2_VERSION})\n{config.WARNING_TEXT}")
    print("NOTE: maternal and urinalysis data are NOT used here (different observations, "
          "no shared patient ID, different targets).\n")

    # 1. Inspect + load fetal data ---------------------------------------
    fetal_df, report = load_csv_with_inspection(
        config.FETAL_CSV, "fetal_health", target_aliases=config.FETAL_TARGET_ALIASES)
    target_col = report["target_column"]
    if target_col is None:
        raise DatasetError(
            f"fetal target column not found. Accepted names: {config.FETAL_TARGET_ALIASES}. "
            f"Columns in file: {report['normalized_columns']}")

    y_all, label_mapping = normalize_fetal_labels(fetal_df[target_col])

    fetal_df, applied = apply_column_aliases(fetal_df, config.CTG_FEATURE_ALIASES)
    feature_cols = [c for c in config.CTG_FEATURES if c in fetal_df.columns]
    absent = [c for c in config.CTG_FEATURES if c not in feature_cols]
    if len(feature_cols) < config.MIN_CTG_FEATURES:
        raise DatasetError(
            f"only {len(feature_cols)} CTG feature columns found ({feature_cols}); need at least "
            f"{config.MIN_CTG_FEATURES}. Columns in file: {list(fetal_df.columns)}")
    if absent:
        print(f"  NOTE: CTG features not present and therefore not used: {absent}")
    if target_col in feature_cols:
        raise DatasetError("target column would be used as a feature; refusing.")
    unused = [c for c in fetal_df.columns if c not in feature_cols and c != target_col]
    if unused:
        print(f"  NOTE: columns ignored (not recognised CTG features): {unused}")

    X_all = fetal_df[feature_cols].apply(pd.to_numeric, errors="coerce")
    introduced = int(X_all.isna().sum().sum() - fetal_df[feature_cols].isna().sum().sum())
    if introduced:
        print(f"  WARNING: {introduced} non-numeric values were converted to missing.")

    # 2. Clean -----------------------------------------------------------
    combined = X_all.copy()
    combined[TARGET_COLUMN] = y_all.values
    n_start = len(combined)
    combined = combined[combined[TARGET_COLUMN].notna()]
    n_missing_target = n_start - len(combined)
    n_duplicates = 0
    if config.DROP_DUPLICATE_ROWS:
        before = len(combined)
        combined = combined.drop_duplicates()
        n_duplicates = before - len(combined)
    print(f"\nRows: start={n_start}, dropped missing target={n_missing_target}, "
          f"dropped exact duplicates={n_duplicates}, kept={len(combined)}")
    y = combined[TARGET_COLUMN]
    X = combined.drop(columns=[TARGET_COLUMN])
    if TARGET_COLUMN in X.columns:
        raise DatasetError("target column leaked into features; refusing.")
    if len(X) < 50 or y.nunique() < 2:
        raise DatasetError(f"not enough data to train (rows={len(X)}, classes={y.nunique()}).")
    print(f"Class distribution used for training: {y.value_counts().to_dict()}")

    range_violations = validate_numeric_ranges(
        X, {c: config.CTG_RANGES[c] for c in feature_cols if c in config.CTG_RANGES})
    if range_violations:
        print("  WARNING: values outside plausibility bounds (kept, not modified):")
        for col, info in range_violations.items():
            print(f"    {col}: {info}")

    # 3. Split BEFORE fitting anything --------------------------------------
    X_train, X_test, y_train, y_test, stratified = safe_stratified_split(X, y)
    print(f"Split: train={len(X_train)}, test={len(X_test)}, stratified={stratified}, "
          f"random_state={config.RANDOM_STATE}")

    # 4. Pipeline (fitted on TRAIN only). Trees do not need scaling, so only imputation. ---
    numeric_columns = list(feature_cols)
    preprocessor = ColumnTransformer(
        [("numeric", Pipeline([("imputer", SimpleImputer(strategy="median"))]), numeric_columns)],
        remainder="drop")
    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", RandomForestClassifier(
            n_estimators=300, class_weight="balanced",
            random_state=config.RANDOM_STATE, n_jobs=-1)),
    ])
    pipeline.fit(X_train, y_train)

    # 5. Evaluate on the untouched test set ------------------------------------
    metrics = evaluate_classifier(pipeline, X_test, y_test,
                                  config.FETAL_LABEL_ORDER, config.MODEL2_NAME)

    # 6. Save artifacts ---------------------------------------------------------
    joblib.dump(pipeline, config.MODEL2_PIPELINE_PATH)
    save_json(config.MODEL2_FEATURES_PATH, {
        "model": config.MODEL2_NAME, "model_version": config.MODEL2_VERSION,
        "input_type": config.MODEL2_INPUT_TYPE,
        "feature_columns": feature_cols,
        "numeric_columns": numeric_columns,
        "categorical_columns": [],
        "ranges": {c: list(config.CTG_RANGES[c]) for c in feature_cols if c in config.CTG_RANGES},
        "units": {c: config.CTG_UNITS.get(c, "") for c in feature_cols},
        "target_excluded_from_features": target_col,
        "warning": config.WARNING_TEXT,
    })
    save_json(config.MODEL2_CLASSES_PATH, {
        "model": config.MODEL2_NAME,
        "classes_in_pipeline_order": [str(c) for c in pipeline.classes_],
        "display_order": config.FETAL_LABEL_ORDER,
        "label_mapping_original_to_normalized": label_mapping,
        "warning": config.WARNING_TEXT,
    })
    save_json(config.MODEL2_METRICS_PATH, {
        "model": config.MODEL2_NAME, "model_version": config.MODEL2_VERSION,
        "random_state": config.RANDOM_STATE, "test_size": config.TEST_SIZE,
        "stratified_split": stratified,
        "n_train": int(len(X_train)), "n_test": int(len(X_test)),
        "rows_dropped_duplicates": n_duplicates,
        "metrics": metrics,
        "note": ("Metrics are on a small public dataset test split; they are NOT evidence of "
                 "clinical performance."),
        "warning": config.WARNING_TEXT,
    })
    save_json(config.MODEL2_INSPECTION_PATH, {
        "fetal_health": report,
        "ctg_feature_mapping_canonical_to_file_column": applied,
        "ignored_columns": unused,
        "range_violations": range_violations,
        "maternal_and_urinalysis_used": False,
        "warning": config.WARNING_TEXT,
    })
    save_confusion_matrix_plot(metrics, config.MODEL2_CONFUSION_PLOT_PATH, "Model 2 fetal health (CTG)")

    print("\n" + "=" * 78)
    print("MODEL 2 TRAINING SUMMARY")
    print(f"  features used      : {len(feature_cols)} CTG columns")
    print(f"  target             : fetal health {config.FETAL_LABEL_ORDER}")
    print(f"  train / test rows  : {len(X_train)} / {len(X_test)}")
    print(f"  test accuracy      : {metrics['accuracy']:.4f}")
    print(f"  test balanced acc. : {metrics['balanced_accuracy']:.4f}")
    print(f"  pipeline saved to  : {config.rel(config.MODEL2_PIPELINE_PATH)}")
    print(f"  {config.WARNING_TEXT}")
    return 0


def main() -> int:
    try:
        return run()
    except DatasetError as exc:
        print(f"\nTRAINING ABORTED: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())