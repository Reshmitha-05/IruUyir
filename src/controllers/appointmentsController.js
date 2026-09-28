const db = require('../db/database');
const { AppError, ok, asyncHandler } = require('../utils/response');
const { findPatient, todayStr, isDate, isTime } = require('../utils/helpers');
const { notifyPatient } = require('../services/notificationService');

function latestRisk(patientId, approvedOnly) {
  return db.prepare(`SELECT a.id AS assessmentId, a.risk_score AS riskScore, a.triage_level AS triageLevel FROM assessments a
    WHERE a.patient_id = ? ${approvedOnly ? "AND EXISTS (SELECT 1 FROM ai_recommendations r WHERE r.assessment_id = a.id AND r.approval_status='APPROVED')" : ''}
    ORDER BY a.id DESC LIMIT 1`).get(patientId) || { assessmentId: null, riskScore: null, triageLevel: null };
}
function shape(a, approvedOnly, includePatient = true) {
  const out = {
    id: a.id, appointmentNumber: a.appointment_number, date: a.appointment_date, time: a.appointment_time,
    purpose: a.purpose, status: a.status, healthcareWorkerId: a.healthcare_worker_id,
    ...latestRisk(a.patient_id, approvedOnly),
  };
  if (includePatient) out.patient = { id: a.patient_id, patientId: a.patient_code, name: a.patient_name };
  return out;
}
const BASE = `SELECT a.*, p.patient_id AS patient_code, p.name AS patient_name
  FROM appointments a JOIN patients p ON p.id = a.patient_id`;

exports.create = asyncHandler(async (req, res) => {
  const { patient_id, appointment_date, appointment_time, purpose } = req.body || {};
  const p = patient_id ? findPatient(patient_id) : null;
  const errors = [];
  if (!p) errors.push({ field: 'patient_id', message: 'valid patient_id required' });
  if (!isDate(appointment_date)) errors.push({ field: 'appointment_date', message: 'YYYY-MM-DD required' });
  if (!isTime(appointment_time)) errors.push({ field: 'appointment_time', message: 'HH:MM (24h) required' });
  if (errors.length) throw new AppError(400, 'Validation failed', errors);

  const n = db.prepare('SELECT COUNT(*) AS c FROM appointments WHERE patient_id = ?').get(p.id).c + 1;
  const info = db.prepare(`INSERT INTO appointments (patient_id, healthcare_worker_id, appointment_number, appointment_date, appointment_time, purpose)
    VALUES (?, ?, ?, ?, ?, ?)`).run(p.id, req.user.sub, n, appointment_date, appointment_time, purpose || null);
  notifyPatient(p.id, 'APPOINTMENT_SCHEDULED', 'Appointment scheduled', `Appointment #${n} on ${appointment_date} at ${appointment_time}.`);
  const row = db.prepare(`${BASE} WHERE a.id = ?`).get(info.lastInsertRowid);
  ok(res, shape(row, false), 201);
});

exports.today = asyncHandler(async (req, res) => {
  const mine = req.query.mine === 'true';
  const rows = db.prepare(`${BASE} WHERE a.appointment_date = ? ${mine ? 'AND a.healthcare_worker_id = ?' : ''} ORDER BY a.appointment_time`)
    .all(...(mine ? [todayStr(), req.user.sub] : [todayStr()]));
  ok(res, { date: todayStr(), appointments: rows.map((r) => shape(r, false)) });
});

// /api/appointments/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD  (default: current month)
exports.calendar = asyncHandler(async (req, res) => {
  const t = todayStr();
  const from = req.query.from || `${t.slice(0, 7)}-01`;
  const to = req.query.to || `${t.slice(0, 7)}-31`;
  if (!isDate(from) || (req.query.to && !isDate(to))) throw new AppError(400, 'from/to must be YYYY-MM-DD');
  const rows = db.prepare(`${BASE} WHERE a.appointment_date BETWEEN ? AND ? ORDER BY a.appointment_date, a.appointment_time`).all(from, to);
  const days = {};
  for (const r of rows) (days[r.appointment_date] ||= []).push(shape(r, false));
  ok(res, { from, to, days });
});

exports.forPatient = asyncHandler(async (req, res) => {
  const approvedOnly = req.user.role === 'patient';
  const rows = db.prepare(`${BASE} WHERE a.patient_id = ? ORDER BY a.appointment_date, a.appointment_time`).all(req.patient.id);
  ok(res, rows.map((r) => shape(r, approvedOnly, false)));
});
