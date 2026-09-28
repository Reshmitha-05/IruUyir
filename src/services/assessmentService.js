const db = require('../db/database');
const F = require('../constants/fields');
const config = require('../config');

const pick = (row, keys) => Object.fromEntries(keys.map((k) => [k, row[k]]));
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };

function getRecommendation(assessmentId) {
  return db.prepare('SELECT * FROM ai_recommendations WHERE assessment_id = ?').get(assessmentId) || null;
}
function shapeRecommendation(r) {
  if (!r) return null;
  return {
    id: r.id, status: r.approval_status,
    aiGeneratedText: r.ai_generated_text,
    workerEditedText: r.healthcare_worker_edited_text,
    finalText: r.approval_status === 'APPROVED' ? (r.healthcare_worker_edited_text || r.ai_generated_text) : null,
    approvedBy: r.approved_by, approvedAt: r.approved_at, createdAt: r.created_at,
  };
}
// Patients see ONLY the approved final text (no AI draft, no status internals).
function shapePatientRecommendation(r) {
  return { status: 'APPROVED', text: r.healthcare_worker_edited_text || r.ai_generated_text, approvedAt: r.approved_at };
}

function isApproved(assessmentId) {
  const r = getRecommendation(assessmentId);
  return !!r && r.approval_status === 'APPROVED';
}

// audience: 'worker' | 'patient'
function formatAssessment(row, audience) {
  const rec = getRecommendation(row.id);
  const out = {
    id: row.id, patientId: row.patient_id, appointmentId: row.appointment_id, trimester: row.trimester,
    clinicalData: pick(row, [...Object.keys(F.BASELINE), ...Object.keys(F.OPTIONAL_CLINICAL)]),
    urinalysis: pick(row, Object.keys(F.URINE)),
    fetalData: row.trimester >= 2 ? pick(row, Object.keys(F.FETAL)) : null,
    modelUsed: row.model_used, riskScore: row.risk_score, triageLevel: row.triage_level,
    contributingFactors: parse(row.contributing_factors) || [],
    createdAt: row.created_at,
  };
  const notes = db.prepare(`SELECT n.id, n.notes, n.created_at AS createdAt, w.name AS workerName
    FROM healthcare_worker_notes n JOIN healthcare_workers w ON w.id = n.worker_id
    WHERE n.assessment_id = ? ORDER BY n.id`).all(row.id);
  if (audience === 'worker') {
    out.modelDetails = parse(row.model_details);
    out.notes = notes;
    out.recommendation = shapeRecommendation(rec);
  } else {
    out.notes = config.patientCanSeeNotes ? notes : undefined;
    out.recommendation = rec && rec.approval_status === 'APPROVED' ? shapePatientRecommendation(rec) : null;
  }
  return out;
}

module.exports = { formatAssessment, getRecommendation, shapeRecommendation, isApproved };
