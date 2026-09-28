const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const F = require('../constants/fields');

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const sqlType = (s) => (s.type === 'number' ? 'REAL' : s.type === 'boolean' ? 'INTEGER' : 'TEXT');
const cols = (group) => Object.entries(group).map(([k, s]) => `  ${k} ${sqlType(s)}`).join(',\n');

// SQLite does not check FK targets at CREATE time, so table order is not an issue.
db.exec(`
CREATE TABLE IF NOT EXISTS assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  appointment_id INTEGER REFERENCES appointments(id),
  healthcare_worker_id INTEGER REFERENCES healthcare_workers(id),
  trimester INTEGER NOT NULL CHECK (trimester IN (1,2,3)),
${cols(F.BASELINE)},
${cols(F.OPTIONAL_CLINICAL)},
${cols(F.URINE)},
${cols(F.FETAL)},
  model_used TEXT,
  risk_score REAL,
  triage_level TEXT,
  contributing_factors TEXT,
  model_details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

module.exports = db;
