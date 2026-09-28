"""Optional application-level maternal-context module.

    maternal risk (Model 1) + fetal status (Model 2) -> review message

This is a transparent, rule-based DISPLAY layer. It does NOT create a combined
prediction target and does NOT retrain anything. The two model outputs stay separate.

CLI:
    python -m common.maternal_context '{"maternal_output": {...}, "fetal_output": {...}}'
    (or pipe the JSON on stdin with --stdin)

Prototype only; not clinically validated; healthcare professional review required.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from common import config  # noqa: E402
from common.urinalysis_features import flag_urinalysis_record  # noqa: E402
from common.validation import InputValidationError, error_response, read_json_payload  # noqa: E402

_MATERNAL_RANK = {"low": 0, "medium": 1, "high": 2}
_FETAL_RANK = {"normal": 0, "suspect": 1, "pathological": 2}
EMERGENCY_NOTE = ("If there are urgent symptoms (for example heavy bleeding, severe headache, "
                  "seizure, chest pain, reduced or absent fetal movement, or waters breaking), "
                  "follow local clinical/emergency protocols regardless of this output.")


def build_review_message(
    maternal_output: dict[str, Any] | None = None,
    fetal_output: dict[str, Any] | None = None,
    urinalysis_record: dict[str, Any] | None = None,
) -> dict[str, Any]:
    maternal_risk = None
    fetal_status = None

    if maternal_output is not None:
        if maternal_output.get("model") != config.MODEL1_NAME:
            raise InputValidationError(
                f"maternal_output must come from '{config.MODEL1_NAME}', "
                f"got model={maternal_output.get('model')!r}.")
        maternal_risk = maternal_output.get("risk")
        if maternal_risk not in _MATERNAL_RANK:
            raise InputValidationError(f"Unknown maternal risk value: {maternal_risk!r}")
    if fetal_output is not None:
        if fetal_output.get("model") != config.MODEL2_NAME:
            raise InputValidationError(
                f"fetal_output must come from '{config.MODEL2_NAME}', "
                f"got model={fetal_output.get('model')!r}.")
        fetal_status = fetal_output.get("fetal_status")
        if fetal_status not in _FETAL_RANK:
            raise InputValidationError(f"Unknown fetal status value: {fetal_status!r}")
    if maternal_risk is None and fetal_status is None:
        raise InputValidationError("Provide maternal_output and/or fetal_output.")

    if fetal_status == "pathological" or maternal_risk == "high":
        priority = "urgent_review"
        message = ("Prototype flag: HIGH-PRIORITY clinician review recommended. "
                   "This is not a diagnosis.")
    elif fetal_status == "suspect" or maternal_risk == "medium":
        priority = "prompt_review"
        message = ("Prototype flag: prompt clinician review recommended. This is not a diagnosis.")
    else:
        priority = "routine_review"
        message = ("No flag raised by the prototype models. This does NOT guarantee safety; "
                   "continue routine care.")

    missing = []
    if maternal_risk is None:
        missing.append("maternal risk not supplied")
    if fetal_status is None:
        missing.append("fetal status not supplied")

    return {
        "model": "application_review_message",
        "review_priority": priority,
        "message": message,
        "maternal_risk": maternal_risk,
        "fetal_status": fetal_status,
        "urinalysis_flags": flag_urinalysis_record(urinalysis_record) if urinalysis_record else None,
        "notes": missing,
        "emergency_note": EMERGENCY_NOTE,
        "input_type": "model_outputs_only",
        "warning": config.WARNING_TEXT,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Combine Model 1 and Model 2 outputs into a review message.")
    parser.add_argument("json_input", nargs="?", help="JSON with maternal_output, fetal_output, urinalysis_record")
    parser.add_argument("--stdin", action="store_true", help="read the JSON from stdin")
    args = parser.parse_args(argv)
    try:
        payload = read_json_payload(args.json_input, args.stdin)
        if not isinstance(payload, dict):
            raise InputValidationError("Input must be a JSON object.")
        unknown = set(payload) - {"maternal_output", "fetal_output", "urinalysis_record"}
        if unknown:
            raise InputValidationError(f"Unknown fields rejected: {sorted(unknown)}")
        result = build_review_message(payload.get("maternal_output"),
                                      payload.get("fetal_output"),
                                      payload.get("urinalysis_record"))
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except InputValidationError as exc:
        print(json.dumps(error_response("application_review_message", str(exc), "input_error")))
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())