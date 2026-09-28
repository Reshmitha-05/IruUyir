const db = require('../db/database');
const F = require('../constants/fields');
const { AppError, ok, asyncHandler } = require('../utils/response');
const { findPatient } = require('../utils/helpers');
const { validateAssessment } = require('../services/validationService');
const ml = require('../services/mlService');
const { formatAssessment, getRecommendation, shapeRecommendation } = require('../services/assessmentService');
const { notifyPatient } = require('../services/notificationService');

const FIELD_COLS = [...Object.keys(F.BASELINE), ...Object.keys(F.OPTIONAL_CLINICAL), ...Object.keys(F.URINE), ...Object.keys(F.FETAL)];

// Worker submits clinical data -> validated -> ML service -> saved.
exports.create = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const p = body.patient_id ? findPatient(body.patient_id) : null;
  if (!p) throw new AppError(400, 'Validation failed', [{ field: 'patient_id', message: 'valid patient_id required' }]);
  const { trimester, clean, errors } = validateAssessment(body);
  if (errors.length) throw new AppError(422, 'Validation failed', errors);

  let appointmentId = null;
  if (body.appointment_id) {
    const a = db.prepare('SELECT id, patient_id FROM appointments WHERE id = ?').get(body.appointment_id);
    if (!a || a.patient_id !== p.id) throw new AppError(400, 'appointment_id does not belong to this patient');
    appointmentId = a.id;
  }

  const result = await ml.predict(trimester, clean); // throws 503/422 if model unavailable or input rejected
  const keys = Object.keys(clean).filter((k) => FIELD_COLS.includes(k));
  const cols = ['patient_id', 'appointment_id', 'healthcare_worker_id', 'trimester', ...keys, 'model_used', 'risk_score', 'triage_level', 'contributing_factors', 'model_details'];
  const vals = [p.id, appointmentId, req.user.sub, trimester, ...keys.map((k) => clean[k]), result.modelUsed, result.riskScore, result.triageLevel,
    JSON.stringify(result.contributingFactors || []),
    JSON.stringify({ components: result.components, factorDetails: result.factorDetails, disclaimer: result.disclaimer })];
  const info = db.prepare(`INSERT INTO assessments (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...vals);
  if (appointmentId) db.prepare("UPDATE appointments SET status = 'COMPLETED' WHERE id = ?").run(appointmentId);
  ok(res, formatAssessment(db.prepare('SELECT * FROM assessments WHERE id = ?').get(info.lastInsertRowid), 'worker'), 201);
});

function loadForUser(req) {
  const a = db.prepare('SELECT * FROM assessments WHERE id = ?').get(req.params.id);
  if (!a) throw new AppError(404, 'Assessment not found');
  if (req.user.role === 'patient') {
    const rec = getRecommendation(a.id);
    // 404 (not 403) so patients cannot probe for other people's assessment ids; also hides unapproved results.
    if (a.patient_id !== req.user.sub || !rec || rec.approval_status !== 'APPROVED') throw new AppError(404, 'Assessment not found');
  }
  return a;
}
exports.get = asyncHandler(async (req, res) => ok(res, formatAssessment(loadForUser(req), req.user.role)));

exports.listForPatient = asyncHandler(async (req, res) => {
  let rows = db.prepare('SELECT * FROM assessments WHERE patient_id = ? ORDER BY id').all(req.patient.id);
  if (req.user.role === 'patient') rows = rows.filter((a) => getRecommendation(a.id)?.approval_status === 'APPROVED');
  ok(res, rows.map((a) => formatAssessment(a, req.user.role)));
});

exports.editRecommendation = asyncHandler(async (req, res) => {
  const a = loadForUser(req);
  const text = String((req.body || {}).text || '').trim();
  if (!text) throw new AppError(400, 'text is required');
  const rec = getRecommendation(a.id);
  if (!rec) throw new AppError(404, 'No AI recommendation yet. Call POST /api/ai/recommendation first.');
  // Editing an approved recommendation withdraws approval: the patient stops seeing it until re-approved.
  db.prepare(`UPDATE ai_recommendations SET healthcare_worker_edited_text = ?, approval_status = 'PENDING', approved_by = NULL, approved_at = NULL WHERE id = ?`).run(text, rec.id);
  ok(res, shapeRecommendation(getRecommendation(a.id)));
});

exports.approve = asyncHandler(async (req, res) => {
  const a = loadForUser(req);
  const rec = getRecommendation(a.id);
  if (!rec) throw new AppError(404, 'No AI recommendation to approve');
  db.prepare(`UPDATE ai_recommendations SET approval_status = 'APPROVED', approved_by = ?, approved_at = datetime('now') WHERE id = ?`).run(req.user.sub, rec.id);
  notifyPatient(a.patient_id, 'RECOMMENDATION_APPROVED', 'New recommendation available', 'Your healthcare worker has reviewed your latest assessment.');
  ok(res, shapeRecommendation(getRecommendation(a.id)));
});

exports.addNote = asyncHandler(async (req, res) => {
  const a = loadForUser(req);
  const notes = String((req.body || {}).notes || '').trim();
  if (!notes) throw new AppError(400, 'notes is required');
  const info = db.prepare('INSERT INTO healthcare_worker_notes (assessment_id, worker_id, notes) VALUES (?, ?, ?)').run(a.id, req.user.sub, notes);
  ok(res, db.prepare('SELECT id, assessment_id AS assessmentId, worker_id AS workerId, notes, created_at AS createdAt FROM healthcare_worker_notes WHERE id = ?').get(info.lastInsertRowid), 201);
});
