const db = require('../db/database');
const F = require('../constants/fields');
const { AppError, ok, asyncHandler } = require('../utils/response');
const { generateRecommendation } = require('../services/groqService');
const { getRecommendation, shapeRecommendation } = require('../services/assessmentService');

const brief = (a) => ({
  date: a.created_at, trimester: a.trimester, riskScore: a.risk_score, triageLevel: a.triage_level,
  systolic_bp: a.systolic_bp, diastolic_bp: a.diastolic_bp, blood_sugar: a.blood_sugar,
});

// POST /api/ai/recommendation { assessmentId, regenerate? }
exports.recommend = asyncHandler(async (req, res) => {
  const { assessmentId, regenerate } = req.body || {};
  const a = db.prepare('SELECT * FROM assessments WHERE id = ?').get(assessmentId);
  if (!a) throw new AppError(404, 'Assessment not found');
  const existing = getRecommendation(a.id);
  if (existing && !regenerate) throw new AppError(409, 'A recommendation already exists. Send regenerate:true to replace it.');

  const pick = (keys) => Object.fromEntries(keys.filter((k) => a[k] !== null).map((k) => [k, a[k]]));
  const history = db.prepare('SELECT * FROM assessments WHERE patient_id = ? AND id < ? ORDER BY id DESC LIMIT 3').all(a.patient_id, a.id).map(brief);
  const notes = db.prepare('SELECT notes FROM healthcare_worker_notes WHERE assessment_id = ? ORDER BY id').all(a.id).map((n) => n.notes);
  const details = JSON.parse(a.model_details || '{}');

  // Privacy: no name / contact details are sent to the external AI provider.
  const context = {
    trimester: a.trimester, riskScore: a.risk_score, triageLevel: a.triage_level,
    scoreNote: 'Prototype ML triage score 0-100; not a diagnosis.',
    contributingFactors: JSON.parse(a.contributing_factors || '[]'), factorDetails: details.factorDetails,
    clinicalData: pick([...Object.keys(F.BASELINE), ...Object.keys(F.OPTIONAL_CLINICAL)]),
    urinalysis: pick(Object.keys(F.URINE)),
    fetalData: a.trimester >= 2 ? pick(Object.keys(F.FETAL)) : undefined,
    recentAssessments: history, healthcareWorkerNotes: notes,
  };
  const text = await generateRecommendation(context);

  if (existing) {
    db.prepare(`UPDATE ai_recommendations SET ai_generated_text = ?, healthcare_worker_edited_text = NULL, approval_status = 'PENDING',
      approved_by = NULL, approved_at = NULL, created_at = datetime('now') WHERE id = ?`).run(text, existing.id);
  } else {
    db.prepare("INSERT INTO ai_recommendations (assessment_id, ai_generated_text, approval_status) VALUES (?, ?, 'PENDING')").run(a.id, text);
  }
  ok(res, shapeRecommendation(getRecommendation(a.id)), existing ? 200 : 201);
});
