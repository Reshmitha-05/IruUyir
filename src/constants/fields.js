// Single source of truth for assessment input fields.
// Used by: validation, DB table creation, ML payload building.
const num = (min, max) => ({ type: 'number', min, max });
const cat = { type: 'category' };

// Units follow the UCI/Kaggle Maternal Health Risk dataset: temperature in °F, blood sugar in mmol/L.
const BASELINE = {
  age: num(10, 60),
  blood_sugar: num(1, 40),
  body_temperature: num(90, 110),
  heart_rate: num(30, 220),
  systolic_bp: num(60, 260),
  diastolic_bp: num(30, 160),
};

// Recorded and stored; only used by the model if the training data contained them.
const OPTIONAL_CLINICAL = {
  bmi: num(10, 80),
  previous_complication: { type: 'boolean' },
  preexisting_diabetes: { type: 'boolean' },
  gestational_diabetes: { type: 'boolean' },
  mental_health: { type: 'text' },
};

// Kaggle "Urinalysis Tests" dataset feature columns (Age/Gender are not used; see README).
const URINE = {
  color: cat, transparency: cat, glucose: cat, protein: cat,
  ph: num(3, 10), specific_gravity: num(1.0, 1.05),
  wbc: cat, rbc: cat, epithelial_cells: cat, mucous_threads: cat,
  amorphous_urates: cat, bacteria: cat,
};

// Kaggle "Fetal Health Classification" (CTG) feature columns.
const fnum = { type: 'number' };
const FETAL = Object.fromEntries([
  'baseline_value', 'accelerations', 'fetal_movement', 'uterine_contractions',
  'light_decelerations', 'severe_decelerations', 'prolongued_decelerations',
  'abnormal_short_term_variability', 'mean_value_of_short_term_variability',
  'percentage_of_time_with_abnormal_long_term_variability',
  'mean_value_of_long_term_variability', 'histogram_width', 'histogram_min',
  'histogram_max', 'histogram_number_of_peaks', 'histogram_number_of_zeroes',
  'histogram_mode', 'histogram_mean', 'histogram_median', 'histogram_variance',
  'histogram_tendency',
].map((k) => [k, fnum]));

module.exports = { BASELINE, OPTIONAL_CLINICAL, URINE, FETAL };
