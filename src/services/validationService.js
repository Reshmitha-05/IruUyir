const F = require('../constants/fields');

const toBool = (v) => {
  if (typeof v === 'boolean') return v ? 1 : 0;
  if ([1, '1', 'true', 'yes', 'YES', 'Yes'].includes(v)) return 1;
  if ([0, '0', 'false', 'no', 'NO', 'No'].includes(v)) return 0;
  return null;
};
const missing = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

function checkGroup(body, group, required, errors, clean, label) {
  for (const [k, spec] of Object.entries(group)) {
    const v = body[k];
    if (missing(v)) {
      if (required) errors.push({ field: k, message: `${k} is required (${label})` });
      continue;
    }
    if (spec.type === 'number') {
      const n = Number(v);
      if (!Number.isFinite(n)) { errors.push({ field: k, message: `${k} must be a number` }); continue; }
      if (spec.min !== undefined && (n < spec.min || n > spec.max)) {
        errors.push({ field: k, message: `${k} must be between ${spec.min} and ${spec.max}` }); continue;
      }
      clean[k] = n;
    } else if (spec.type === 'boolean') {
      const b = toBool(v);
      if (b === null) errors.push({ field: k, message: `${k} must be true/false` }); else clean[k] = b;
    } else {
      clean[k] = String(v).trim();
    }
  }
}

// Returns { trimester, clean, errors }. Missing trimester-specific fields are NEVER silently accepted.
function validateAssessment(body, forcedTrimester) {
  const errors = []; const clean = {};
  const trimester = Number(forcedTrimester ?? body.trimester);
  if (![1, 2, 3].includes(trimester)) {
    errors.push({ field: 'trimester', message: 'trimester must be 1, 2 or 3' });
    return { trimester, clean, errors };
  }
  checkGroup(body, F.BASELINE, true, errors, clean, 'baseline clinical');
  checkGroup(body, F.URINE, true, errors, clean, 'urinalysis');
  checkGroup(body, F.OPTIONAL_CLINICAL, false, errors, clean, 'optional clinical');
  checkGroup(body, F.FETAL, trimester >= 2, errors, clean, `fetal health, required for trimester ${trimester}`);
  if (trimester === 1) for (const k of Object.keys(F.FETAL)) delete clean[k]; // fetal fields not used in trimester 1
  return { trimester, clean, errors };
}

module.exports = { validateAssessment };
