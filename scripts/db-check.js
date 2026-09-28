require('dotenv').config();
const fs = require('fs');
const db = require('../src/db/database');
const config = require('../src/config');
const EXPECTED = ['healthcare_workers', 'patients', 'appointments', 'assessments', 'ai_recommendations', 'healthcare_worker_notes',
  'menstrual_cycles', 'notifications', 'handoff_summaries', 'pre_arrival_notifications'];
const have = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
let bad = false;
console.log(`DB file : ${config.dbPath} (${fs.existsSync(config.dbPath) ? fs.statSync(config.dbPath).size + ' bytes' : 'MISSING'})`);
for (const t of EXPECTED) {
  if (!have.includes(t)) { console.log(`  [MISSING] ${t}`); bad = true; continue; }
  console.log(`  [ok] ${t.padEnd(26)} rows: ${db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c}`);
}
console.log('integrity_check :', db.pragma('integrity_check', { simple: true }));
console.log('foreign_keys    :', db.pragma('foreign_keys', { simple: true }) ? 'ON' : 'OFF');
console.log('assessments cols:', db.prepare('PRAGMA table_info(assessments)').all().length);
console.log(bad ? '\nRESULT: PROBLEM - run "npm run db:init"' : '\nRESULT: DATABASE OK');
process.exit(bad ? 1 : 0);
