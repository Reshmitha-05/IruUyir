const db = require('../db/database');
const { AppError, ok, asyncHandler } = require('../utils/response');
const { buildSummaryText, streamPdf } = require('../services/handoffService');

exports.generate = asyncHandler(async (req, res) => {
  const text = buildSummaryText(req.patient.patient_id);
  const info = db.prepare('INSERT INTO handoff_summaries (patient_id, summary_text) VALUES (?, ?)').run(req.patient.id, text);
  ok(res, db.prepare('SELECT id, patient_id AS patientId, generated_at AS generatedAt, summary_text AS summaryText FROM handoff_summaries WHERE id = ?').get(info.lastInsertRowid), 201);
});
exports.download = asyncHandler(async (req, res) => {
  const s = db.prepare('SELECT * FROM handoff_summaries WHERE patient_id = ? ORDER BY id DESC LIMIT 1').get(req.patient.id);
  if (!s) throw new AppError(404, 'No handoff summary yet. Call POST /api/patients/:id/handoff-summary first.');
  streamPdf(res, req.patient, s.summary_text, s.generated_at);
});
