const { AppError, ok, asyncHandler } = require('../utils/response');
const { validateAssessment } = require('../services/validationService');
const ml = require('../services/mlService');

// Stateless prediction (nothing saved). Frontends never run the model themselves.
exports.baseline = asyncHandler(async (req, res) => {
  const { clean, errors } = validateAssessment(req.body || {}, 1);
  if (errors.length) throw new AppError(422, 'Validation failed', errors);
  ok(res, await ml.predict(1, clean));
});
exports.trimester = asyncHandler(async (req, res) => {
  const t = Number((req.body || {}).trimester);
  if (![2, 3].includes(t)) throw new AppError(422, 'Validation failed', [{ field: 'trimester', message: 'trimester-risk requires trimester 2 or 3' }]);
  const { clean, errors } = validateAssessment(req.body, t);
  if (errors.length) throw new AppError(422, 'Validation failed', errors);
  ok(res, await ml.predict(t, clean));
});
