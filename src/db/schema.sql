-- NOTE: the "assessments" table is generated in database.js from src/constants/fields.js
CREATE TABLE IF NOT EXISTS healthcare_workers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  date_of_birth TEXT NOT NULL,
  contact TEXT,
  emergency_contact TEXT,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  healthcare_worker_id INTEGER REFERENCES healthcare_workers(id),
  appointment_number INTEGER NOT NULL,
  appointment_date TEXT NOT NULL,
  appointment_time TEXT NOT NULL,
  purpose TEXT,
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assessment_id INTEGER NOT NULL UNIQUE REFERENCES assessments(id),
  ai_generated_text TEXT NOT NULL,
  healthcare_worker_edited_text TEXT,
  approval_status TEXT NOT NULL DEFAULT 'PENDING',
  approved_by INTEGER REFERENCES healthcare_workers(id),
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS healthcare_worker_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assessment_id INTEGER NOT NULL REFERENCES assessments(id),
  worker_id INTEGER NOT NULL REFERENCES healthcare_workers(id),
  notes TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS menstrual_cycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  cycle_start TEXT NOT NULL,
  cycle_end TEXT,
  cycle_length INTEGER,
  phase TEXT NOT NULL,
  symptoms TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER REFERENCES patients(id),
  healthcare_worker_id INTEGER REFERENCES healthcare_workers(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read_status INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS handoff_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  summary_text TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pre_arrival_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  risk_score REAL,
  triage_level TEXT,
  latest_assessment_id INTEGER REFERENCES assessments(id),
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_appt_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appt_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_notif_patient ON notifications(patient_id);
CREATE INDEX IF NOT EXISTS idx_assess_patient ON assessments(patient_id);
