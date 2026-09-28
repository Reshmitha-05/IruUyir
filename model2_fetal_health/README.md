# Model 2: fetal CTG status classification (prototype)

> **Prototype only; not clinically validated; healthcare professional review required.**
> Not suitable for real clinical decisions.

## What it predicts
Fetal CTG status: **`normal` | `suspect` | `pathological`** (dataset labels 1 / 2 / 3).
It is intended for second/third-trimester CTG-style data. The dataset has no gestational-age
column, so this is a design intent, not something the data verifies.

## Training data
Only the Fetal Health Classification CSV (`data/raw/fetal_health.csv`), using only CTG feature
columns. Maternal and urinalysis data are **not** used as CTG observations: they are different
observations with no shared patient ID. Maternal context is combined only at application level
(`common/maternal_context.py`), which produces a review message and never a combined prediction.

## Limitations
- CTG features come from pre-processed CTG summaries, not raw traces.
- Small public dataset; class imbalance (most records are `normal`). Scores on the
  `suspect`/`pathological` classes come from few test examples.
- Exact duplicate rows are removed before splitting.
- A **normal** prediction does not mean the fetus is well. Reduced fetal movement or other urgent
  symptoms need clinical/emergency care.

## Train
```bash
python model2_fetal_health/train.py
```
Artifacts (`model2_fetal_health/artifacts/`): `model2_pipeline.joblib`, `feature_columns.json`,
`class_labels.json`, `metrics.json`, `inspection_report.json` (plus `confusion_matrix.png`).

## Predict
All CTG fields listed in `feature_columns.json` are required (see `python scripts/check_model_inputs.py`
for the exact schema, ranges and units). Unknown fields are rejected.

```bash
python model2_fetal_health/predict.py --stdin < request.json
```

Example `request.json` (format example only; illustrative numbers, not a real patient):
```json
{
  "baseline_value": 120, "accelerations": 0.0, "fetal_movement": 0.0,
  "uterine_contractions": 0.0, "light_decelerations": 0.0,
  "severe_decelerations": 0.0, "prolonged_decelerations": 0.0,
  "abnormal_short_term_variability": 73, "mean_value_of_short_term_variability": 0.5,
  "percentage_of_time_with_abnormal_long_term_variability": 43,
  "mean_value_of_long_term_variability": 2.4, "histogram_width": 64,
  "histogram_min": 62, "histogram_max": 126, "histogram_number_of_peaks": 2,
  "histogram_number_of_zeroes": 0, "histogram_mode": 120, "histogram_mean": 137,
  "histogram_median": 121, "histogram_variance": 73, "histogram_tendency": 1
}
```

Response shape (probability values are illustrative):
```json
{
  "model": "fetal_health_model",
  "fetal_status": "suspect",
  "probabilities": {"normal": 0.30, "suspect": 0.55, "pathological": 0.15},
  "input_type": "CTG_features",
  "warning": "Prototype only; not clinically validated; healthcare professional review required."
}
```

Model 2 predicts **fetal status** only. It never uses or produces maternal-risk labels.