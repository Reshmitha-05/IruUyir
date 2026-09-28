// Creates ONE demo healthcare worker (from .env) and ONE demo patient. Safe to run repeatedly.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/db/database');

const email = (process.env.SEED_WORKER_EMAIL || 'doctor@iruuyir.local').toLowerCase();
const pw = process.env.SEED_WORKER_PASSWORD || 'ChangeMe123!';
if (!db.prepare('SELECT 1 FROM healthcare_workers WHERE email = ?').get(email)) {
  db.prepare('INSERT INTO healthcare_workers (worker_id, name, email, password_hash) VALUES (?, ?, ?, ?)')
    .run('HW-0001', 'Demo Doctor', email, bcrypt.hashSync(pw, 10));
  console.log(`Created worker: ${email} / (password from SEED_WORKER_PASSWORD)`);
} else console.log('Worker already exists');

if (!db.prepare("SELECT 1 FROM patients WHERE patient_id = 'PAT-0001'").get()) {
  db.prepare('INSERT INTO patients (patient_id, name, date_of_birth, contact, emergency_contact, password_hash) VALUES (?,?,?,?,?,?)')
    .run('PAT-0001', 'Demo Patient', '1999-05-20', '9000000000', '9111111111', bcrypt.hashSync('Patient@123', 10));
  console.log('Created patient: PAT-0001 / Patient@123');
} else console.log('Patient already exists');
