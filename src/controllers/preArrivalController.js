const db = require('../db/database');
const { AppError, ok, asyncHandler } = require('../utils/response');
const { notifyAllWorkers } = require('../services/notificationService');

// Patient presses "I'M COMING TO HOSPITAL". No ambulance dispatch is performed.
exports.create = asyncHandler(async (req, res) => {
  const p = req.patient;
  const latest = db.prepare('SELECT id, risk_score, triage_level FROM assessments WHERE patient_id = ? ORDER BY id DESC LIMIT 1').get(p.id);
  const info = db.prepare('INSERT INTO pre_arrival_notifications (patient_id, risk_score, triage_level, latest_assessment_id) VALUES (?, ?, ?, ?)')
    .run(p.id, latest?.risk_score ?? null, latest?.triage_level ?? null, latest?.id ?? null);
  const scoreTxt = latest ? `risk score ${latest.risk_score} (${latest.triage_level})` : 'no assessment on record';
  notifyAllWorkers(p.id, 'PRE_ARRIVAL', 'Patient arriving at hospital', `${p.name} (${p.patient_id}) is on the way - ${scoreTxt}.`);
  ok(res, { id: info.lastInsertRowid, status: 'PENDING', riskScore: latest?.risk_score ?? null, triageLevel: latest?.triage_level ?? null,
    message: 'Hospital has been notified. This does not dispatch an ambulance - call your local emergency number if urgent.' }, 201);
});

const SEL = `SELECT n.id, n.status, n.risk_score AS riskScore, n.triage_level AS triageLevel, n.latest_assessment_id AS latestAssessmentId,
  n.created_at AS timestamp, p.id AS patientDbId, p.patient_id AS patientId, p.name AS patientName, p.contact, p.emergency_contact AS emergencyContact
  FROM pre_arrival_notifications n JOIN patients p ON p.id = n.patient_id`;
exports.list = asyncHandler(async (req, res) => {
  const status = req.query.status;
  ok(res, status ? db.prepare(`${SEL} WHERE n.status = ? ORDER BY n.id DESC`).all(status) : db.prepare(`${SEL} ORDER BY n.id DESC LIMIT 100`).all());
});
exports.acknowledge = asyncHandler(async (req, res) => {
  const info = db.prepare("UPDATE pre_arrival_notifications SET status = 'ACKNOWLEDGED' WHERE id = ?").run(req.params.id);
  if (!info.changes) throw new AppError(404, 'Alert not found');
  ok(res, { id: Number(req.params.id), status: 'ACKNOWLEDGED' });
});
