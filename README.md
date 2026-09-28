# maternal-health-ml: hackathon prototype

> **Prototype only; not clinically validated; healthcare professional review required.**
> This project is **not** a diagnostic system and is **not suitable for real clinical decisions**.

## Architecture

```
maternal inputs ──▶ Model 1 ──▶ maternal risk (low | medium | high) ─┐
                                                                     ├─▶ application-level review message
CTG inputs      ──▶ Model 2 ──▶ fetal status (normal | suspect | pathological) ─┘
```

| | Model 1 | Model 2 |
|---|---|---|
| Folder | `model1_maternal_risk/` | `model2_fetal_health/` |
| Predicts | maternal-risk **screening** | fetal-**CTG status classification** |
| Target | maternal risk: `low`/`medium`/`high` | fetal health: `normal`/`suspect`/`pathological` |
| Trained on | Maternal Health Risk dataset (+ urinalysis **only if** validly mappable) | Fetal Health (CTG) dataset only |
| Intended stage | first-trimester maternal data | second/third-trimester CTG data |
| Inputs | vitals + blood sugar (+ compatible tests) | CTG features |

The two models are trained separately, saved separately, and predict different things.

## Why datasets are not concatenated row by row
The maternal, urinalysis and fetal CSVs are **different observations of different people**. They have
no shared patient/record ID, so no row in one dataset corresponds to a row in another. Joining
them (randomly or by row number) would fabricate patients that never existed and produce meaningless
models. Unrelated columns and labels are never concatenated. Urinalysis rows are merged into Model 1's
training table only if the urinalysis file has a genuine maternal-risk target that maps to
`low/medium/high` and shares enough maternal columns. Otherwise it stays separate and is used only for
rule-based, non-label context flags.

## Why `fetal_health` is not a maternal-risk label
`fetal_health` describes a **CTG trace** (fetal heart-rate pattern), while maternal risk describes the
**mother's** vitals. A suspect CTG does not tell you the mother's risk level, and vice versa. Using one as
the other would be a labelling error, so Model 2 never sees maternal labels and Model 1 never sees fetal
labels. Combining them requires a real joined dataset with patient IDs and clinician-confirmed combined
outcomes; none is used here.

## Trimester note
First-trimester maternal data and second/third-trimester CTG data are **not the same kind of data**
and are not interchangeable. The datasets carry no gestational-age column, so trimester
intent is a design decision, not something the data verifies.

## Limitations and safety
- Public/Kaggle (and possibly synthetic or derived) data: small, of uncertain provenance and population, with
  possible bias and label noise. Test-set scores do **not** measure clinical performance.
- No clinical validation, no prospective testing, no calibration for any real population.
- A **low-risk** or **normal** prediction does **not** guarantee safety.
- **Urgent symptoms** (heavy bleeding, severe headache, seizure, chest pain, reduced or absent fetal movement,
  waters breaking, etc.) require clinical/emergency protocols regardless of any output here.
- Every output carries this warning: *"Prototype only; not clinically validated; healthcare professional review required."*
- Future work requires **joined, de-identified, clinician-labelled longitudinal data**, ethics/regulatory review,
  and prospective validation.

## Installation (Python 3.10+)
```bash
python -m venv .venv
# Windows PowerShell:  .venv\Scripts\Activate.ps1
# macOS/Linux:         source .venv/bin/activate
pip install -r requirements.txt
```

## Data
Download the three Kaggle CSVs and place them at:
```
data/raw/maternal_health.csv
data/raw/urinalysis.csv
data/raw/fetal_health.csv
```
Different filenames? Change the `DATASET PATHS` section in `common/config.py`.

## Commands (run from the repository root)
```bash
python scripts/inspect_datasets.py          # inspect all CSVs, save JSON reports to data/processed/
python model1_maternal_risk/train.py        # train Model 1
python model2_fetal_health/train.py         # train Model 2
python scripts/check_model_inputs.py        # print the exact JSON schema each predict.py expects
```

Predictions (bash):
```bash
python model1_maternal_risk/predict.py '{"age":25,"systolic_bp":120,"diastolic_bp":80,"blood_sugar":7.5,"body_temperature":98.6,"heart_rate":76}'
python model2_fetal_health/predict.py --stdin < request.json
```
Predictions (Windows PowerShell; use `--stdin` to avoid quote problems):
```powershell
'{"age":25,"systolic_bp":120,"diastolic_bp":80,"blood_sugar":7.5,"body_temperature":98.6,"heart_rate":76}' | python model1_maternal_risk/predict.py --stdin
Get-Content request.json | python model2_fetal_health/predict.py --stdin
```

Optional application-level message from the two outputs:
```bash
python -m common.maternal_context --stdin < combined.json
```
where `combined.json` is `{"maternal_output": <Model 1 JSON>, "fetal_output": <Model 2 JSON>}`
(optionally `"urinalysis_record": {...}`). It returns `review_priority` (`urgent_review` | `prompt_review` | `routine_review`),
a message and the warning. It is a rule-based display layer and does not produce a combined prediction.

## Frontend/backend integration contract

**Rules:** all fields required; unknown fields rejected; numbers must be JSON numbers (not strings). Field names come
from `feature_columns.json` of the trained model (`python scripts/check_model_inputs.py` prints them). Artifact filenames
and output keys are stable.

**Model 1 request** (`units: age years, BP mmHg, blood sugar mmol/L, temperature °F, heart rate bpm`):
```json
{"age": 25, "systolic_bp": 120, "diastolic_bp": 80, "blood_sugar": 7.5, "body_temperature": 98.6, "heart_rate": 76}
```
**Model 1 response** (values illustrative):
```json
{
  "model": "maternal_risk_model",
  "risk": "low",
  "probabilities": {"low": 0.71, "medium": 0.24, "high": 0.05},
  "input_type": "maternal_vitals_and_verified_maternal_tests",
  "warning": "Prototype only; not clinically validated; healthcare professional review required."
}
```
**Model 2 request:** the CTG fields listed in `model2_fetal_health/README.md` (21 fields with the standard Kaggle CTG file).
**Model 2 response** (values illustrative):
```json
{
  "model": "fetal_health_model",
  "fetal_status": "normal",
  "probabilities": {"normal": 0.88, "suspect": 0.09, "pathological": 0.03},
  "input_type": "CTG_features",
  "warning": "Prototype only; not clinically validated; healthcare professional review required."
}
```
**Error response** (exit code 2 = bad input, 3 = model not trained, 1 = internal error; JSON on stdout):
```json
{
  "model": "maternal_risk_model",
  "error": "Missing required fields: ['heart_rate']. Expected exactly these fields: [...]",
  "error_type": "input_error",
  "warning": "Prototype only; not clinically validated; healthcare professional review required."
}
```

## Node.js integration

**Option A (recommended for the hackathon): run each Python script with `child_process.spawn`.** It is the simplest
option: no extra server, no extra dependency, one process per prediction.

**Option B:** wrap each model in its own small Python HTTP service (e.g. FastAPI/Flask, which are not in
`requirements.txt`) and call them over HTTP. It is faster per request but needs extra dependencies and ports.

Option A example (`backend/mlBridge.js`):
```js
const { spawn } = require("child_process");
const path = require("path");

const PROJECT_ROOT =
  process.env.ML_PROJECT_ROOT || path.resolve(__dirname, "..", "maternal-health-ml");
const PYTHON_BIN =
  process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");

const MATERNAL_KEYS = ["age", "systolic_bp", "diastolic_bp", "blood_sugar", "body_temperature", "heart_rate"];
const isCtgKey = (k) =>
  k.startsWith("histogram_") || k.endsWith("_variability") || k.endsWith("_decelerations") ||
  ["baseline_value", "accelerations", "fetal_movement", "uterine_contractions"].includes(k);

const MODELS = {
  maternal: { script: path.join("model1_maternal_risk", "predict.py"), rejectKey: isCtgKey },
  fetal: { script: path.join("model2_fetal_health", "predict.py"), rejectKey: (k) => MATERNAL_KEYS.includes(k) },
};

function runModel(modelName, payload, { timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const model = MODELS[modelName];
    if (!model) return reject(new Error(`Unknown model "${modelName}"`));
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      return reject(new Error("Payload must be a JSON object"));
    }
    // Never send the wrong input schema to the wrong model.
    const wrong = Object.keys(payload).filter(model.rejectKey);
    if (wrong.length) {
      return reject(new Error(`Refusing to send [${wrong.join(", ")}] to the "${modelName}" model: wrong input schema`));
    }

    const child = spawn(PYTHON_BIN, [model.script, "--stdin"], {
      cwd: PROJECT_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timer;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(reject, new Error(`Model "${modelName}" timed out after ${timeoutMs} ms`));
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));

    child.on("error", (err) =>
      finish(reject, new Error(`Could not start Python (${PYTHON_BIN}): ${err.message}`)));

    child.on("close", (code) => {
      let parsed = null;
      try { parsed = JSON.parse(stdout); } catch (_) { /* handled below */ }
      if (code !== 0) {
        const message = parsed && parsed.error ? parsed.error : stderr.trim() || `exit code ${code}`;
        return finish(reject, Object.assign(new Error(message), { exitCode: code, stderr }));
      }
      if (!parsed) {
        return finish(reject, new Error(`Model returned non-JSON output: ${stdout.slice(0, 200)}`));
      }
      finish(resolve, parsed);
    });

    child.stdin.on("error", () => {}); // a closed pipe is reported by the "close" handler
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

module.exports = { runModel };
```
Express usage:
```js
const { runModel } = require("./mlBridge");
app.post("/api/maternal-risk", async (req, res) => {
  try { res.json(await runModel("maternal", req.body)); }
  catch (err) { res.status(400).json({ error: err.message, warning: "Prototype only; not clinically validated; healthcare professional review required." }); }
});
app.post("/api/fetal-status", async (req, res) => {
  try { res.json(await runModel("fetal", req.body)); }
  catch (err) { res.status(400).json({ error: err.message, warning: "Prototype only; not clinically validated; healthcare professional review required." }); }
});
```

## Project layout
`common/` holds all shared logic (`config.py`, `validation.py`, `evaluation.py`, `urinalysis_features.py`,
`maternal_context.py`). `model1_maternal_risk/` and `model2_fetal_health/` each hold `train.py`, `predict.py`,
a README and `artifacts/`. `scripts/` holds the inspection and input-checker scripts.