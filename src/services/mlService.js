// Node never computes a score. It forwards validated features to the Python ML service.
const config = require('../config');
const F = require('../constants/fields');
const { AppError } = require('../utils/response');

function pickFeatures(clean, trimester) {
  const keys = [...Object.keys(F.BASELINE), ...Object.keys(F.URINE), ...(trimester >= 2 ? Object.keys(F.FETAL) : [])];
  return Object.fromEntries(keys.map((k) => [k, clean[k]]));
}

async function predict(trimester, clean) {
  const path = trimester === 1 ? '/predict/baseline' : '/predict/extended';
  let res;
  try {
    res = await fetch(config.mlUrl + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pickFeatures(clean, trimester)),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new AppError(503, `ML service unreachable at ${config.mlUrl}. Start it (see README) and retry.`);
  }
  const body = await res.json().catch(() => ({}));
  if (res.status === 422) throw new AppError(422, body.message || 'ML service rejected the input', body.errors);
  if (!res.ok) throw new AppError(503, body.message || `ML service error (${res.status})`);
  return body; // { riskScore, triageLevel, contributingFactors, factorDetails, modelUsed, components, disclaimer }
}
module.exports = { predict };
