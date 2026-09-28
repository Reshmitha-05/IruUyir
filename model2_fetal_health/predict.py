"""Predict fetal status (normal / suspect / pathological) from CTG features (JSON).

    python model2_fetal_health/predict.py '{"baseline_value": 120, ...}'
    python model2_fetal_health/predict.py --stdin < request.json

Prints ONE JSON object to stdout. On error prints a JSON error object (with the
warning) to stdout, a short message to stderr, and exits non-zero.

Prototype only; not clinically validated; healthcare professional review required.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import joblib  # noqa: E402

from common import config  # noqa: E402
from common.validation import (  # noqa: E402
    InputValidationError,
    ModelNotReadyError,
    error_response,
    load_json,
    ordered_probabilities,
    read_json_payload,
    require_artifacts,
    validate_prediction_payload,
)


def predict(payload) -> dict:
    require_artifacts(
        [config.MODEL2_PIPELINE_PATH, config.MODEL2_FEATURES_PATH, config.MODEL2_CLASSES_PATH],
        "python model2_fetal_health/train.py")
    meta = load_json(config.MODEL2_FEATURES_PATH)
    class_meta = load_json(config.MODEL2_CLASSES_PATH)
    pipeline = joblib.load(config.MODEL2_PIPELINE_PATH)

    row = validate_prediction_payload(
        payload, meta["numeric_columns"], meta["categorical_columns"], meta.get("ranges", {}))
    label = str(pipeline.predict(row)[0])
    probabilities = ordered_probabilities(
        pipeline.classes_, pipeline.predict_proba(row)[0], class_meta["display_order"])
    return {
        "model": config.MODEL2_NAME,
        "fetal_status": label,
        "probabilities": probabilities,
        "input_type": config.MODEL2_INPUT_TYPE,
        "warning": config.WARNING_TEXT,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Model 2: fetal CTG status prediction (prototype).")
    parser.add_argument("json_input", nargs="?", help="JSON object as a string")
    parser.add_argument("--stdin", action="store_true", help="read the JSON object from stdin")
    args = parser.parse_args(argv)
    try:
        payload = read_json_payload(args.json_input, args.stdin)
        print(json.dumps(predict(payload), ensure_ascii=False))
        return 0
    except InputValidationError as exc:
        print(json.dumps(error_response(config.MODEL2_NAME, str(exc), "input_error")))
        print(f"input error: {exc}", file=sys.stderr)
        return 2
    except ModelNotReadyError as exc:
        print(json.dumps(error_response(config.MODEL2_NAME, str(exc), "model_not_ready")))
        print(f"model not ready: {exc}", file=sys.stderr)
        return 3
    except Exception as exc:  # noqa: BLE001 - always return JSON to the caller
        print(json.dumps(error_response(config.MODEL2_NAME, f"{type(exc).__name__}: {exc}", "internal_error")))
        print(f"internal error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())