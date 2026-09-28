"""Central configuration for the maternal-health-ml hackathon prototype.

*** EDIT DATASET PATHS BELOW if your Kaggle CSV files have different names. ***

Prototype only; not clinically validated; healthcare professional review required.
"""
from __future__ import annotations

from pathlib import Path

# ---------------------------------------------------------------------------
# General settings
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parents[1]
RANDOM_STATE = 42
TEST_SIZE = 0.20
DROP_DUPLICATE_ROWS = True      # exact duplicates would leak between train and test
MIN_MATERNAL_FEATURES = 4       # training fails if fewer maternal columns are found
MIN_CTG_FEATURES = 10           # training fails if fewer CTG columns are found

WARNING_TEXT = (
    "Prototype only; not clinically validated; healthcare professional review required."
)

MODEL1_VERSION = "model1-maternal-risk-0.1.0-hackathon"
MODEL2_VERSION = "model2-fetal-health-0.1.0-hackathon"
MODEL1_NAME = "maternal_risk_model"
MODEL2_NAME = "fetal_health_model"
MODEL1_INPUT_TYPE = "maternal_vitals_and_verified_maternal_tests"
MODEL2_INPUT_TYPE = "CTG_features"

# ---------------------------------------------------------------------------
# DATASET PATHS  (single place to change filenames)
# ---------------------------------------------------------------------------
DATA_DIR = PROJECT_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"

MATERNAL_CSV = RAW_DIR / "maternal_health.csv"
URINALYSIS_CSV = RAW_DIR / "urinalysis.csv"
FETAL_CSV = RAW_DIR / "fetal_health.csv"

# Output of the separate (rule-based) urinalysis feature extraction
URINALYSIS_FEATURES_CSV = PROCESSED_DIR / "urinalysis_rule_features.csv"

# ---------------------------------------------------------------------------
# MODEL ARTIFACT PATHS (do not rename: the backend depends on these)
# ---------------------------------------------------------------------------
MODEL1_DIR = PROJECT_ROOT / "model1_maternal_risk"
MODEL1_ARTIFACT_DIR = MODEL1_DIR / "artifacts"
MODEL1_PIPELINE_PATH = MODEL1_ARTIFACT_DIR / "model1_pipeline.joblib"
MODEL1_FEATURES_PATH = MODEL1_ARTIFACT_DIR / "feature_columns.json"
MODEL1_CLASSES_PATH = MODEL1_ARTIFACT_DIR / "class_labels.json"
MODEL1_METRICS_PATH = MODEL1_ARTIFACT_DIR / "metrics.json"
MODEL1_INSPECTION_PATH = MODEL1_ARTIFACT_DIR / "inspection_report.json"
MODEL1_CONFUSION_PLOT_PATH = MODEL1_ARTIFACT_DIR / "confusion_matrix.png"

MODEL2_DIR = PROJECT_ROOT / "model2_fetal_health"
MODEL2_ARTIFACT_DIR = MODEL2_DIR / "artifacts"
MODEL2_PIPELINE_PATH = MODEL2_ARTIFACT_DIR / "model2_pipeline.joblib"
MODEL2_FEATURES_PATH = MODEL2_ARTIFACT_DIR / "feature_columns.json"
MODEL2_CLASSES_PATH = MODEL2_ARTIFACT_DIR / "class_labels.json"
MODEL2_METRICS_PATH = MODEL2_ARTIFACT_DIR / "metrics.json"
MODEL2_INSPECTION_PATH = MODEL2_ARTIFACT_DIR / "inspection_report.json"
MODEL2_CONFUSION_PLOT_PATH = MODEL2_ARTIFACT_DIR / "confusion_matrix.png"

# ---------------------------------------------------------------------------
# LABEL MAPPINGS (keys are normalized: lowercase, punctuation -> underscore)
# ---------------------------------------------------------------------------
MATERNAL_LABEL_ORDER = ["low", "medium", "high"]
MATERNAL_LABEL_MAP = {
    "low": "low", "low_risk": "low",
    "mid": "medium", "mid_risk": "medium",
    "medium": "medium", "medium_risk": "medium",
    "moderate": "medium", "moderate_risk": "medium",
    "high": "high", "high_risk": "high",
}
# Normalized names under which a maternal-risk target may appear
MATERNAL_TARGET_ALIASES = ["risklevel", "risk_level", "risk"]

FETAL_LABEL_ORDER = ["normal", "suspect", "pathological"]
FETAL_LABEL_MAP = {
    "1": "normal", "normal": "normal",
    "2": "suspect", "suspect": "suspect", "suspicious": "suspect",
    "3": "pathological", "pathological": "pathological", "pathologic": "pathological",
}
# "nsp" is the original UCI CTG name for the same 1/2/3 fetal-state label
FETAL_TARGET_ALIASES = ["fetal_health", "fetalhealth", "nsp"]

# ---------------------------------------------------------------------------
# MODEL 1 FEATURES (canonical name -> accepted normalized column names)
# ---------------------------------------------------------------------------
MATERNAL_FEATURE_ALIASES = {
    "age": ["age"],
    "systolic_bp": ["systolic_bp", "systolicbp", "systolic", "sbp", "systolic_blood_pressure"],
    "diastolic_bp": ["diastolic_bp", "diastolicbp", "diastolic", "dbp", "diastolic_blood_pressure"],
    "blood_sugar": ["blood_sugar", "bloodsugar", "bs", "blood_glucose"],
    "body_temperature": ["body_temperature", "bodytemperature", "bodytemp", "body_temp", "temperature"],
    "heart_rate": ["heart_rate", "heartrate", "hr", "pulse"],
}
MATERNAL_FEATURES = list(MATERNAL_FEATURE_ALIASES.keys())

MATERNAL_RANGES = {  # plausibility bounds only (NOT clinical thresholds)
    "age": (10, 70),
    "systolic_bp": (50, 250),
    "diastolic_bp": (30, 150),
    "blood_sugar": (1, 40),
    "body_temperature": (90, 110),
    "heart_rate": (30, 220),
}
MATERNAL_UNITS = {
    "age": "years",
    "systolic_bp": "mmHg",
    "diastolic_bp": "mmHg",
    "blood_sugar": "mmol/L (as in the Kaggle maternal dataset)",
    "body_temperature": "degrees Fahrenheit (as in the Kaggle maternal dataset)",
    "heart_rate": "beats per minute",
}
MATERNAL_EXAMPLE = {
    "age": 25, "systolic_bp": 120, "diastolic_bp": 80,
    "blood_sugar": 7.5, "body_temperature": 98.6, "heart_rate": 76,
}

# ---------------------------------------------------------------------------
# URINALYSIS (used ONLY for separate rule-based features unless a valid,
# documented merge with the maternal-risk target is possible)
# ---------------------------------------------------------------------------
URINALYSIS_FEATURE_ALIASES = {
    "urine_glucose": ["urine_glucose", "glucose", "glu"],
    "urine_protein": ["urine_protein", "protein", "pro"],
    "urine_ph": ["urine_ph", "ph"],
    "specific_gravity": ["specific_gravity", "sg", "spec_grav"],
    "blood": ["blood", "urine_blood", "occult_blood", "ery"],
    "leukocytes": ["leukocytes", "leucocytes", "leu", "leukocyte_esterase"],
    "nitrite": ["nitrite", "nitrites", "nit"],
    "ketones": ["ketones", "ketone", "ket"],
    "bacteria": ["bacteria"],
}
URINE_QUALITATIVE_FIELDS = [
    "urine_glucose", "urine_protein", "blood", "leukocytes", "nitrite", "ketones", "bacteria",
]
URINE_TYPICAL_RANGES = {  # informational reference bounds for flags only
    "urine_ph": (4.5, 8.0),
    "specific_gravity": (1.003, 1.030),
}

# ---------------------------------------------------------------------------
# MODEL 2 FEATURES (CTG)
# ---------------------------------------------------------------------------
CTG_FEATURE_ALIASES = {
    "baseline_value": ["baseline_value", "baseline_fhr", "lb"],
    "accelerations": ["accelerations", "ac"],
    "fetal_movement": ["fetal_movement", "fm"],
    "uterine_contractions": ["uterine_contractions", "uc"],
    "light_decelerations": ["light_decelerations", "dl"],
    "severe_decelerations": ["severe_decelerations", "ds"],
    "prolonged_decelerations": ["prolonged_decelerations", "dp"],
    "abnormal_short_term_variability": ["abnormal_short_term_variability", "astv"],
    "mean_value_of_short_term_variability": ["mean_value_of_short_term_variability", "mstv"],
    "percentage_of_time_with_abnormal_long_term_variability": [
        "percentage_of_time_with_abnormal_long_term_variability", "altv"],
    "mean_value_of_long_term_variability": ["mean_value_of_long_term_variability", "mltv"],
    "histogram_width": ["histogram_width", "width"],
    "histogram_min": ["histogram_min", "min"],
    "histogram_max": ["histogram_max", "max"],
    "histogram_number_of_peaks": ["histogram_number_of_peaks", "nmax"],
    "histogram_number_of_zeroes": ["histogram_number_of_zeroes", "nzeros"],
    "histogram_mode": ["histogram_mode", "mode"],
    "histogram_mean": ["histogram_mean", "mean"],
    "histogram_median": ["histogram_median", "median"],
    "histogram_variance": ["histogram_variance", "variance"],
    "histogram_tendency": ["histogram_tendency", "tendency"],
}
CTG_FEATURES = list(CTG_FEATURE_ALIASES.keys())

CTG_RANGES = {  # plausibility bounds only (NOT clinical thresholds)
    "baseline_value": (50, 250),
    "accelerations": (0, 1),
    "fetal_movement": (0, 1),
    "uterine_contractions": (0, 1),
    "light_decelerations": (0, 1),
    "severe_decelerations": (0, 1),
    "prolonged_decelerations": (0, 1),
    "abnormal_short_term_variability": (0, 100),
    "mean_value_of_short_term_variability": (0, 20),
    "percentage_of_time_with_abnormal_long_term_variability": (0, 100),
    "mean_value_of_long_term_variability": (0, 100),
    "histogram_width": (0, 300),
    "histogram_min": (50, 250),
    "histogram_max": (50, 300),
    "histogram_number_of_peaks": (0, 30),
    "histogram_number_of_zeroes": (0, 30),
    "histogram_mode": (50, 250),
    "histogram_mean": (50, 250),
    "histogram_median": (50, 250),
    "histogram_variance": (0, 1000),
    "histogram_tendency": (-1, 1),
}
CTG_UNITS = {  # as described for the Kaggle/UCI CTG data; verify against the dataset page
    "baseline_value": "beats per minute (baseline FHR)",
    "accelerations": "per second",
    "fetal_movement": "per second",
    "uterine_contractions": "per second",
    "light_decelerations": "per second",
    "severe_decelerations": "per second",
    "prolonged_decelerations": "per second",
    "abnormal_short_term_variability": "percent of time",
    "mean_value_of_short_term_variability": "as given in dataset",
    "percentage_of_time_with_abnormal_long_term_variability": "percent of time",
    "mean_value_of_long_term_variability": "as given in dataset",
    "histogram_width": "bpm (FHR histogram)",
    "histogram_min": "bpm (FHR histogram)",
    "histogram_max": "bpm (FHR histogram)",
    "histogram_number_of_peaks": "count",
    "histogram_number_of_zeroes": "count",
    "histogram_mode": "bpm (FHR histogram)",
    "histogram_mean": "bpm (FHR histogram)",
    "histogram_median": "bpm (FHR histogram)",
    "histogram_variance": "bpm^2 (FHR histogram)",
    "histogram_tendency": "-1, 0 or 1 (histogram tendency code)",
}
# Format example only: numbers are illustrative, NOT a real patient.
CTG_EXAMPLE = {
    "baseline_value": 120, "accelerations": 0.0, "fetal_movement": 0.0,
    "uterine_contractions": 0.0, "light_decelerations": 0.0,
    "severe_decelerations": 0.0, "prolonged_decelerations": 0.0,
    "abnormal_short_term_variability": 73, "mean_value_of_short_term_variability": 0.5,
    "percentage_of_time_with_abnormal_long_term_variability": 43,
    "mean_value_of_long_term_variability": 2.4, "histogram_width": 64,
    "histogram_min": 62, "histogram_max": 126, "histogram_number_of_peaks": 2,
    "histogram_number_of_zeroes": 0, "histogram_mode": 120, "histogram_mean": 137,
    "histogram_median": 121, "histogram_variance": 73, "histogram_tendency": 1,
}


def ensure_dirs() -> None:
    """Create output directories if they do not exist."""
    for directory in (RAW_DIR, PROCESSED_DIR, MODEL1_ARTIFACT_DIR, MODEL2_ARTIFACT_DIR):
        directory.mkdir(parents=True, exist_ok=True)


def rel(path) -> str:
    """Return a path relative to the project root (for readable messages/reports)."""
    try:
        return Path(path).resolve().relative_to(PROJECT_ROOT).as_posix()
    except ValueError:
        return str(path)