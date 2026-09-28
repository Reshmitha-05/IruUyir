const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const config = require('../config');
const { AppError, ok, asyncHandler } = require('../utils/response');

const sign = (sub, role, code) => jwt.sign({ sub, role, code }, config.jwtSecret, { expiresIn: config.jwtExpires });

exports.doctorLogin = asyncHandler(async (req, res) => {
  const { email, worker_id, password } = req.body || {};
  if ((!email && !worker_id) || !password) throw new AppError(400, 'email (or worker_id) and password are required');
  const w = email
    ? db.prepare('SELECT * FROM healthcare_workers WHERE email = ?').get(String(email).toLowerCase())
    : db.prepare('SELECT * FROM healthcare_workers WHERE worker_id = ?').get(worker_id);
  if (!w || !bcrypt.compareSync(String(password), w.password_hash)) throw new AppError(401, 'Invalid credentials');
  ok(res, {
    token: sign(w.id, 'worker', w.worker_id),
    user: { id: w.id, workerId: w.worker_id, name: w.name, email: w.email, role: 'worker' },
  });
});

exports.patientLogin = asyncHandler(async (req, res) => {
  const { patient_id, password } = req.body || {};
  if (!patient_id || !password) throw new AppError(400, 'patient_id and password are required');
  const p = db.prepare('SELECT * FROM patients WHERE patient_id = ?').get(patient_id);
  if (!p || !bcrypt.compareSync(String(password), p.password_hash)) throw new AppError(401, 'Invalid credentials');
  ok(res, {
    token: sign(p.id, 'patient', p.patient_id),
    user: { id: p.id, patientId: p.patient_id, name: p.name, role: 'patient' },
  });
});

exports.me = asyncHandler(async (req, res) => {
  const { sub, role } = req.user;
  const u = role === 'worker'
    ? db.prepare('SELECT id, worker_id AS workerId, name, email FROM healthcare_workers WHERE id = ?').get(sub)
    : db.prepare('SELECT id, patient_id AS patientId, name, date_of_birth AS dateOfBirth FROM patients WHERE id = ?').get(sub);
  if (!u) throw new AppError(401, 'Account no longer exists');
  ok(res, { ...u, role });
});
