const db = require('../db/database');
const { todayStr, addDays } = require('../utils/helpers');

function notifyPatient(patientId, type, title, message) {
  db.prepare('INSERT INTO notifications (patient_id, healthcare_worker_id, type, title, message) VALUES (?, NULL, ?, ?, ?)')
    .run(patientId, type, title, message);
}
function notifyAllWorkers(patientId, type, title, message) {
  const ins = db.prepare('INSERT INTO notifications (patient_id, healthcare_worker_id, type, title, message) VALUES (?, ?, ?, ?, ?)');
  for (const w of db.prepare('SELECT id FROM healthcare_workers').all()) ins.run(patientId, w.id, type, title, message);
}

// One-day-before reminders. Safe to run repeatedly (de-duplicated).
function createRemindersForTomorrow() {
  const tomorrow = addDays(todayStr(), 1);
  const rows = db.prepare("SELECT patient_id, appointment_time FROM appointments WHERE appointment_date = ? AND status = 'SCHEDULED'").all(tomorrow);
  let created = 0;
  for (const r of rows) {
    const message = `Your appointment is tomorrow at ${r.appointment_time}.`;
    const exists = db.prepare(`SELECT 1 FROM notifications WHERE patient_id = ? AND healthcare_worker_id IS NULL
      AND type = 'APPOINTMENT_REMINDER' AND message = ? AND created_at >= datetime('now','-20 hours')`).get(r.patient_id, message);
    if (!exists) { notifyPatient(r.patient_id, 'APPOINTMENT_REMINDER', 'Appointment reminder', message); created++; }
  }
  return { date: tomorrow, appointments: rows.length, created };
}
module.exports = { notifyPatient, notifyAllWorkers, createRemindersForTomorrow };
