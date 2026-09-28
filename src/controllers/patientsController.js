const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { AppError, ok, asyncHandler } = require('../utils/response');
const { PATIENT_COLS, isDate } = require('../utils/helpers');

exports.create = asyncHandler(async (req, res) => {
  const { name, date_of_birth, contact, emergency_contact, password } = req.body || {};
  const errors = [];
  if (!name || !String(name).trim()) errors.push({ field: 'name', message: 'name is required' });
  if (!isDate(date_of_birth)) errors.push({ field: 'date_of_birth', message: 'date_of_birth must be YYYY-MM-DD' });
  if (!password || String(password).length < 8) errors.push({ field: 'password', message: 'password (min 8 chars) is required' });
  if (errors.length) throw new AppError(400, 'Validation failed', errors);

  const next = db.prepare('SELECT COALESCE(MAX(id),0)+1 AS n FROM patients').get().n;
  const patientId = (req.body.patient_id && String(req.body.patient_id).trim()) || `PAT-${String(next).padStart(4, '0')}`;
  if (db.prepare('SELECT 1 FROM patients WHERE patient_id = ?').get(patientId)) throw new AppError(409, 'patient_id already exists');

  const info = db.prepare(`INSERT INTO patients (patient_id, name, date_of_birth, contact, emergency_contact, password_hash)
    VALUES (?, ?, ?, ?, ?, ?)`).run(patientId, String(name).trim(), date_of_birth, contact || null, emergency_contact || null, bcrypt.hashSync(String(password), 10));
  ok(res, db.prepare(`SELECT ${PATIENT_COLS} FROM patients WHERE id = ?`).get(info.lastInsertRowid), 201);
});

// Search by patient ID or name: /api/patients?q=asha
exports.list = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const rows = q
    ? db.prepare(`SELECT ${PATIENT_COLS} FROM patients WHERE patient_id LIKE ? OR name LIKE ? ORDER BY name LIMIT 100`).all(`%${q}%`, `%${q}%`)
    : db.prepare(`SELECT ${PATIENT_COLS} FROM patients ORDER BY id DESC LIMIT 100`).all();
  ok(res, rows);
});

exports.get = asyncHandler(async (req, res) => {
  const p = req.patient;
  const latest = db.prepare(`SELECT a.id, a.trimester, a.risk_score AS riskScore, a.triage_level AS triageLevel, a.created_at AS createdAt
    FROM assessments a WHERE a.patient_id = ? ${req.user.role === 'patient'
    ? "AND EXISTS (SELECT 1 FROM ai_recommendations r WHERE r.assessment_id = a.id AND r.approval_status = 'APPROVED')" : ''}
    ORDER BY a.id DESC LIMIT 1`).get(p.id) || null;
  ok(res, { ...p, latestAssessment: latest });
});
