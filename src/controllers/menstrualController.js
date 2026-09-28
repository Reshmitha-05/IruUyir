const db = require('../db/database');
const { AppError, ok, asyncHandler } = require('../utils/response');
const { isDate } = require('../utils/helpers');

const PHASES = ['PRE_PREGNANCY', 'PREGNANCY', 'POST_PREGNANCY'];
const shape = (r) => ({ ...r, symptoms: (() => { try { return JSON.parse(r.symptoms); } catch { return r.symptoms; } })() });

// Patient-entered data only. No condition is inferred from it.
exports.add = asyncHandler(async (req, res) => {
  const { cycle_start, cycle_end, cycle_length, phase, symptoms, notes } = req.body || {};
  const errors = [];
  if (!isDate(cycle_start)) errors.push({ field: 'cycle_start', message: 'YYYY-MM-DD required' });
  if (cycle_end && !isDate(cycle_end)) errors.push({ field: 'cycle_end', message: 'YYYY-MM-DD' });
  if (cycle_end && isDate(cycle_start) && cycle_end < cycle_start) errors.push({ field: 'cycle_end', message: 'cycle_end cannot be before cycle_start' });
  if (!PHASES.includes(phase)) errors.push({ field: 'phase', message: `phase must be one of ${PHASES.join(', ')}` });
  if (cycle_length !== undefined && cycle_length !== null && !(Number.isInteger(cycle_length) && cycle_length > 0 && cycle_length < 100)) errors.push({ field: 'cycle_length', message: 'positive integer (days)' });
  if (errors.length) throw new AppError(400, 'Validation failed', errors);
  const info = db.prepare(`INSERT INTO menstrual_cycles (patient_id, cycle_start, cycle_end, cycle_length, phase, symptoms, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(req.patient.id, cycle_start, cycle_end || null, cycle_length ?? null, phase, symptoms === undefined ? null : JSON.stringify(symptoms), notes || null);
  ok(res, shape(db.prepare('SELECT * FROM menstrual_cycles WHERE id = ?').get(info.lastInsertRowid)), 201);
});
exports.list = asyncHandler(async (req, res) =>
  ok(res, db.prepare('SELECT * FROM menstrual_cycles WHERE patient_id = ? ORDER BY cycle_start DESC').all(req.patient.id).map(shape)));
