# Model 1: maternal risk screening (prototype)

> **Prototype only; not clinically validated; healthcare professional review required.**
> Not suitable for real clinical decisions.

## What it predicts
Maternal risk: **`low` | `medium` | `high`**. It is intended as a first-trimester
maternal-risk *screening* demo. The Kaggle maternal dataset has no gestational-age
column, so the "first trimester" intent is a project design choice, not something
the data verifies.

## Training data
- **Primary:** Maternal Health Risk CSV (`data/raw/maternal_health.csv`). The original
  label `mid risk` is normalized to `medium`.
- **Urinalysis (`data/raw/urinalysis.csv`):** merged **only** if it contains a maternal-risk
  target that maps to low/medium/high *and* shares at least 4 maternal feature columns.
  Otherwise it is **kept separate**: `common/urinalysis_features.py` produces rule-based
  dipstick flags in `data/processed/urinalysis_rule_features.csv`. No labels are ever
  invented for it. `train.py` prints `MERGED` or `KEPT SEPARATE`, with reasons.

## Limitations
- Small public dataset, likely derived from a limited population; may not reflect your population.
- The maternal dataset contains many exact duplicate rows. They are removed before splitting to avoid
  train/test leakage, which makes the dataset smaller.
- Test-set scores are on a small split and are **not** clinical performance.
- Features are only vitals/blood sugar. Many risk factors (history, gestational age, symptoms) are absent.
- A **low** prediction does not mean a pregnancy is safe. Urgent symptoms need clinical/emergency care.

## Train
```bash
python model1_maternal_risk/train.py
```
Artifacts (`model1_maternal_risk/artifacts/`): `model1_pipeline.joblib`, `feature_columns.json`,
`class_labels.json`, `metrics.json`, `inspection_report.json` (plus `confusion_matrix.png`).

## Predict
Input fields come from `feature_columns.json`. All are required, unknown fields are rejected.
Units: age in years; systolic/diastolic BP in mmHg; blood sugar in mmol/L; body temperature in
degrees Fahrenheit; heart rate in bpm (as in the Kaggle dataset).

```bash
python model1_maternal_risk/predict.py '{"age":25,"systolic_bp":120,"diastolic_bp":80,"blood_sugar":7.5,"body_temperature":98.6,"heart_rate":76}'
```

Response shape (probability values are illustrative):
```json
{
  "model": "maternal_risk_model",
  "risk": "low",
  "probabilities": {"low": 0.71, "medium": 0.24, "high": 0.05},
  "input_type": "maternal_vitals_and_verified_maternal_tests",
  "warning": "Prototype only; not clinically validated; healthcare professional review required."
}
```

Model 1 predicts **maternal risk** only. It has nothing to do with the fetal-health labels of Model 2.