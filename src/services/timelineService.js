const db = require('../db/database');
const { formatAssessment, isApproved } = require('./assessmentService');

// audience 'patient': only assessments whose recommendation has been APPROVED by a worker are shown.
function buildTimeline(patientId, audience) {
  const appts = db.prepare('SELECT * FROM appointments WHERE patient_id = ? ORDER BY appointment_date, appointment_time').all(patientId);
  let assessments = db.prepare('SELECT * FROM assessments WHERE patient_id = ? ORDER BY id').all(patientId);
  if (audience === 'patient') assessments = assessments.filter((a) => isApproved(a.id));

  const entries = appts.map((a) => ({
    sortKey: `${a.appointment_date} ${a.appointment_time}`,
    appointment: {
      id: a.id, number: a.appointment_number, date: a.appointment_date, time: a.appointment_time,
      purpose: a.purpose, status: a.status,
    },
    assessments: assessments.filter((x) => x.appointment_id === a.id).map((x) => formatAssessment(x, audience)),
  }));
  for (const x of assessments.filter((x) => !appts.some((a) => a.id === x.appointment_id))) {
    entries.push({ sortKey: x.created_at, appointment: null, assessments: [formatAssessment(x, audience)] });
  }
  entries.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return entries.map(({ sortKey, ...rest }) => rest);
}
module.exports = { buildTimeline };
