"""Print the exact JSON input schema expected by each prediction script.

    python scripts/check_model_inputs.py

If a model has been trained, the schema comes from its saved feature_columns.json
(the source of truth). Otherwise the defaults from common/config.py are shown.

Prototype only; not clinically validated; healthcare professional review required.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from common import config  # noqa: E402
from common.validation import load_json  # noqa: E402


def _build(model_key: str) -> dict:
    if model_key == "model1":
        features_path, defaults = config.MODEL1_FEATURES_PATH, config.MATERNAL_FEATURES
        ranges, units, example = config.MATERNAL_RANGES, config.MATERNAL_UNITS, config.MATERNAL_EXAMPLE
        script, name, input_type = "model1_maternal_risk/predict.py", config.MODEL1_NAME, config.MODEL1_INPUT_TYPE
        outputs = "risk (low|medium|high)"
    else:
        features_path, defaults = config.MODEL2_FEATURES_PATH, config.CTG_FEATURES
        ranges, units, example = config.CTG_RANGES, config.CTG_UNITS, config.CTG_EXAMPLE
        script, name, input_type = "model2_fetal_health/predict.py", config.MODEL2_NAME, config.MODEL2_INPUT_TYPE
        outputs = "fetal_status (normal|suspect|pathological)"

    if Path(features_path).exists():
        meta = load_json(features_path)
        numeric, categorical = meta["numeric_columns"], meta["categorical_columns"]
        ranges = {k: tuple(v) for k, v in meta.get("ranges", {}).items()} or ranges
        source = f"trained artifact {config.rel(features_path)}"
    else:
        numeric, categorical = list(defaults), []
        source = "common/config.py defaults (model not trained yet; the trained artifact may use a subset)"

    properties = {}
    for col in numeric:
        prop = {"type": "number", "description": units.get(col, "")}
        if col in ranges:
            prop["minimum"], prop["maximum"] = ranges[col][0], ranges[col][1]
        properties[col] = prop
    for col in categorical:
        properties[col] = {"type": "string"}

    schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": f"{name} input ({input_type})",
        "type": "object",
        "properties": properties,
        "required": [*numeric, *categorical],
        "additionalProperties": False,
    }
    example_request = {}
    for col in [*numeric, *categorical]:
        if col in example:
            example_request[col] = example[col]
        elif col in ranges:
            example_request[col] = round((ranges[col][0] + ranges[col][1]) / 2, 3)
        else:
            example_request[col] = "value"
    return {"name": name, "script": script, "source": source, "schema": schema,
            "example": example_request, "outputs": outputs}


def main() -> int:
    for key in ("model1", "model2"):
        info = _build(key)
        print("=" * 78)
        print(f"{info['name']}  ->  {info['script']}")
        print(f"schema source : {info['source']}")
        print(f"predicts      : {info['outputs']}")
        print("\nJSON Schema (all fields required; unknown fields are rejected):")
        print(json.dumps(info["schema"], indent=2))
        print("\nExample request (format example only; illustrative values):")
        print(json.dumps(info["example"], indent=2))
        print("\nRun:")
        print(f"  python {info['script']} --stdin < request.json")
        print()
    print("Model 1 and Model 2 have DIFFERENT targets and DIFFERENT inputs; never send one "
          "model's fields to the other.")
    print(config.WARNING_TEXT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())