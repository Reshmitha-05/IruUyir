const db = require('../db/database');
const config = require('../config');

const PATIENT_COLS = 'id, patient_id, name, date_of_birth, contact, emergency_contact, created_at'; // never password_hash

function findPatient(param) {
  const byNumericId = /^\d+$/.test(String(param));
  return db.prepare(`SELECT ${PATIENT_COLS} FROM patients WHERE ${byNumericId ? 'id' : 'patient_id'} = ?`).get(param);
}
const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: config.tz });
const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(Date.parse(s));
const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s || '');

module.exports = { PATIENT_COLS, findPatient, todayStr, addDays, isDate, isTime };
