"""Train Model 1: maternal risk (low / medium / high).

Run from the repository root:
    python model1_maternal_risk/train.py

Design:
* Primary data: Maternal Health Risk CSV.
* Urinalysis CSV is merged ONLY if it has a maternal-risk target that maps to
  low/medium/high AND shares enough maternal feature columns. Otherwise it is kept
  separate (rule-based features saved to data/processed/); no labels are invented.
* Split BEFORE fitting preprocessing; preprocessing is fitted on training data only.

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
from sklearn.preprocessing import OneHotEncoder, StandardScaler  # noqa: E402

from common import config  # noqa: E402
from common.evaluation import (  # noqa: E402
    evaluate_classifier,
    safe_stratified_split,
    save_confusion_matrix_plot,
)
from common.urinalysis_features import (  # noqa: E402
    assess_urinalysis_compatibility,
    extract_urinalysis_features,
)
from common.validation import (  # noqa: E402
    DatasetError,
    apply_column_aliases,
    load_csv_with_inspection,
    normalize_maternal_labels,
    save_json,
    validate_numeric_ranges,
)

TARGET_COLUMN = "risk_level"  # internal name; never part of the feature list


def build_preprocessor(numeric_columns: list[str], categorical_columns: list[str]) -> ColumnTransformer:
    transformers = []
    if numeric_columns:
        transformers.append(("numeric", Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]), numeric_columns))
    if categorical_columns:
        transformers.append(("categorical", Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore")),
        ]), categorical_columns))
    return ColumnTransformer(transformers, remainder="drop")


def handle_urinalysis(feature_cols: list[str]):
    """Decide: merge or keep separate. Returns (uri_X, uri_y, decision, uri_report)."""
    decision = {
        "urinalysis_file": config.rel(config.URINALYSIS_CSV),
        "status": None, "reasons": [], "shared_features": [], "rule_features_file": None,
    }
    if not config.URINALYSIS_CSV.exists():
        decision["status"] = "not_found_not_used"
        decision["reasons"] = ["file not found"]
        print("\nURINALYSIS DECISION: NOT USED (file not found: "
              f"{config.rel(config.URINALYSIS_CSV)}). Model 1 trains on the maternal dataset only.")
        return None, None, decision, None

    uri_df, uri_report = load_csv_with_inspection(
        config.URINALYSIS_CSV, "urinalysis", target_aliases=config.MATERNAL_TARGET_ALIASES)
    compat, aliased = assess_urinalysis_compatibility(uri_df, feature_cols)

    if compat["compatible"]:
        shared = compat["shared_features"]
        uri_y, uri_mapping = normalize_maternal_labels(aliased[compat["target_column"]])
        uri_X = aliased[shared].apply(pd.to_numeric, errors="coerce")
        decision.update(status="merged", shared_features=shared,
                        label_mapping=uri_mapping, rows_added=int(len(uri_X)))
        print("\nURINALYSIS DECISION: MERGED into the supervised table "
              f"(shared features only: {shared}; target '{compat['target_column']}' "
              "mapped with the label mapping printed above).")
        return uri_X, uri_y, decision, uri_report

    decision["status"] = "kept_separate"
    decision["reasons"] = compat["reasons"]
    print("\nURINALYSIS DECISION: KEPT SEPARATE (not merged into the supervised table).")
    for reason in compat["reasons"]:
        print(f"  - {reason}")
    features, detected = extract_urinalysis_features(uri_df)
    if features.empty:
        print("  No recognised urinalysis fields were found for rule-based features either.")
    else:
        config.URINALYSIS_FEATURES_CSV.parent.mkdir(parents=True, exist_ok=True)
        features.to_csv(config.URINALYSIS_FEATURES_CSV, index=False, encoding="utf-8")
        decision["rule_features_file"] = config.rel(config.URINALYSIS_FEATURES_CSV)
        decision["rule_feature_columns"] = list(features.columns)
        print(f"  Rule-based (non-label) urinalysis features saved to "
              f"{config.rel(config.URINALYSIS_FEATURES_CSV)} (detected fields: {list(detected)}).")
    return None, None, decision, uri_report


def run() -> int:
    config.ensure_dirs()
    print(f"MODEL 1 TRAINING  ({config.MODEL1_VERSION})\n{config.WARNING_TEXT}\n")

    # 1. Inspect + load maternal data ------------------------------------
    maternal_df, maternal_report = load_csv_with_inspection(
        config.MATERNAL_CSV, "maternal_health", target_aliases=config.MATERNAL_TARGET_ALIASES)
    target_col = maternal_report["target_column"]
    if target_col is None:
        raise DatasetError(
            f"maternal risk target not found. Accepted names: {config.MATERNAL_TARGET_ALIASES}. "
            f"Columns in file: {maternal_report['normalized_columns']}")

    maternal_df, applied = apply_column_aliases(maternal_df, config.MATERNAL_FEATURE_ALIASES)
    feature_cols = [c for c in config.MATERNAL_FEATURES if c in maternal_df.columns]
    absent = [c for c in config.MATERNAL_FEATURES if c not in feature_cols]
    if len(feature_cols) < config.MIN_MATERNAL_FEATURES:
        raise DatasetError(
            f"only {len(feature_cols)} maternal feature columns found ({feature_cols}); "
            f"need at least {config.MIN_MATERNAL_FEATURES}. Missing: {absent}. "
            f"Columns in file: {list(maternal_df.columns)}")
    if absent:
        print(f"  NOTE: maternal features not present and therefore not used: {absent}")
    if target_col in feature_cols:
        raise DatasetError("target column would be used as a feature; refusing.")

    y_maternal, label_mapping = normalize_maternal_labels(maternal_df[target_col])
    X_maternal = maternal_df[feature_cols].apply(pd.to_numeric, errors="coerce")
    introduced = int(X_maternal.isna().sum().sum() - maternal_df[feature_cols].isna().sum().sum())
    if introduced:
        print(f"  WARNING: {introduced} non-numeric values were converted to missing.")

    # 2. Urinalysis: merge or keep separate ---------------------------------
    uri_X, uri_y, urinalysis_decision, uri_report = handle_urinalysis(feature_cols)
    if urinalysis_decision["status"] == "merged":
        feature_cols = urinalysis_decision["shared_features"]
        X_all = pd.concat([X_maternal[feature_cols], uri_X[feature_cols]], ignore_index=True)
        y_all = pd.concat([y_maternal, uri_y], ignore_index=True)
    else:
        X_all, y_all = X_maternal[feature_cols].reset_index(drop=True), y_maternal.reset_index(drop=True)

    # 3. Clean: drop missing targets and exact duplicates --------------------
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
        X, {c: config.MATERNAL_RANGES[c] for c in feature_cols if c in config.MATERNAL_RANGES})
    if range_violations:
        print("  WARNING: values outside plausibility bounds (kept, not modified):")
        for col, info in range_violations.items():
            print(f"    {col}: {info}")

    # 4. Split BEFORE fitting anything ---------------------------------------
    X_train, X_test, y_train, y_test, stratified = safe_stratified_split(X, y)
    print(f"Split: train={len(X_train)}, test={len(X_test)}, stratified={stratified}, "
          f"random_state={config.RANDOM_STATE}")

    # 5. Pipeline (fitted on TRAIN only) --------------------------------------
    categorical_columns = [c for c in feature_cols if not pd.api.types.is_numeric_dtype(X_train[c])]
    numeric_columns = [c for c in feature_cols if c not in categorical_columns]
    pipeline = Pipeline([
        ("preprocessor", build_preprocessor(numeric_columns, categorical_columns)),
        ("classifier", RandomForestClassifier(
            n_estimators=300, class_weight="balanced",
            random_state=config.RANDOM_STATE, n_jobs=-1)),
    ])
    pipeline.fit(X_train, y_train)

    # 6. Evaluate on the untouched test set ------------------------------------
    metrics = evaluate_classifier(pipeline, X_test, y_test,
                                  config.MATERNAL_LABEL_ORDER, config.MODEL1_NAME)

    # 7. Save artifacts ---------------------------------------------------------
    joblib.dump(pipeline, config.MODEL1_PIPELINE_PATH)
    save_json(config.MODEL1_FEATURES_PATH, {
        "model": config.MODEL1_NAME, "model_version": config.MODEL1_VERSION,
        "input_type": config.MODEL1_INPUT_TYPE,
        "feature_columns": feature_cols,
        "numeric_columns": numeric_columns,
        "categorical_columns": categorical_columns,
        "ranges": {c: list(config.MATERNAL_RANGES[c]) for c in feature_cols if c in config.MATERNAL_RANGES},
        "units": {c: config.MATERNAL_UNITS.get(c, "") for c in feature_cols},
        "target_excluded_from_features": TARGET_COLUMN,
        "warning": config.WARNING_TEXT,
    })
    save_json(config.MODEL1_CLASSES_PATH, {
        "model": config.MODEL1_NAME,
        "classes_in_pipeline_order": [str(c) for c in pipeline.classes_],
        "display_order": config.MATERNAL_LABEL_ORDER,
        "label_mapping_original_to_normalized": label_mapping,
        "warning": config.WARNING_TEXT,
    })
    save_json(config.MODEL1_METRICS_PATH, {
        "model": config.MODEL1_NAME, "model_version": config.MODEL1_VERSION,
        "random_state": config.RANDOM_STATE, "test_size": config.TEST_SIZE,
        "stratified_split": stratified,
        "n_train": int(len(X_train)), "n_test": int(len(X_test)),
        "rows_dropped_duplicates": n_duplicates,
        "urinalysis_status": urinalysis_decision["status"],
        "metrics": metrics,
        "note": ("Metrics are on a small public dataset test split; they are NOT evidence of "
                 "clinical performance."),
        "warning": config.WARNING_TEXT,
    })
    save_json(config.MODEL1_INSPECTION_PATH, {
        "maternal_health": maternal_report,
        "urinalysis": uri_report,
        "urinalysis_decision": urinalysis_decision,
        "maternal_feature_mapping_canonical_to_file_column": applied,
        "range_violations": range_violations,
        "warning": config.WARNING_TEXT,
    })
    save_confusion_matrix_plot(metrics, config.MODEL1_CONFUSION_PLOT_PATH, "Model 1 maternal risk")

    print("\n" + "=" * 78)
    print("MODEL 1 TRAINING SUMMARY")
    print(f"  features used      : {feature_cols}")
    print(f"  target             : maternal risk {config.MATERNAL_LABEL_ORDER}")
    print(f"  urinalysis         : {urinalysis_decision['status'].upper()}")
    print(f"  train / test rows  : {len(X_train)} / {len(X_test)}")
    print(f"  test accuracy      : {metrics['accuracy']:.4f}")
    print(f"  test balanced acc. : {metrics['balanced_accuracy']:.4f}")
    print(f"  pipeline saved to  : {config.rel(config.MODEL1_PIPELINE_PATH)}")
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