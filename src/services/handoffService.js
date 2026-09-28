const db = require('../db/database');
const PDFDocument = require('pdfkit');
const F = require('../constants/fields');
const { buildTimeline } = require('./timelineService');
const { findPatient } = require('../utils/helpers');

const show = (o, keys) => keys.filter((k) => o[k] !== null && o[k] !== undefined).map((k) => `${k}=${o[k]}`).join(', ') || 'none recorded';

// Built ONLY from stored, worker-approved data. Nothing is inferred or invented.
function buildSummaryText(patientParam) {
  const p = findPatient(patientParam);
  const tl = buildTimeline(p.id, 'patient'); // approved assessments only
  const L = [];
  L.push('## Patient details');
  L.push(`Patient ID: ${p.patient_id}`, `Name: ${p.name}`, `Date of birth: ${p.date_of_birth}`,
    `Contact: ${p.contact || 'not recorded'}`, `Emergency contact: ${p.emergency_contact || 'not recorded'}`);

  const assessed = tl.flatMap((e) => e.assessments.map((a) => ({ e, a })));
  L.push('', '## Pregnancy / trimester history');
  if (!assessed.length) L.push('No approved assessments on record.');
  for (const { a } of assessed) L.push(`Trimester ${a.trimester} - assessed ${a.createdAt}`);

  L.push('', '## Appointment history');
  if (!tl.filter((e) => e.appointment).length) L.push('No appointments on record.');
  for (const e of tl.filter((x) => x.appointment)) {
    const ap = e.appointment;
    L.push(`#${ap.number} ${ap.date} ${ap.time} - ${ap.purpose || 'no purpose recorded'} [${ap.status}]`);
  }

  L.push('', '## Risk score progression (prototype ML triage score, 0-100; not a diagnosis)');
  if (!assessed.length) L.push('No scores on record.');
  for (const { a } of assessed) L.push(`${a.createdAt}: trimester ${a.trimester}, score ${a.riskScore}, triage ${a.triageLevel}`);

  L.push('', '## Assessment details');
  for (const { a } of assessed) {
    L.push(`--- Assessment ${a.id} (trimester ${a.trimester}, ${a.createdAt}) ---`);
    L.push(`Clinical parameters: ${show(a.clinicalData, Object.keys(a.clinicalData))}`);
    L.push(`Urinalysis: ${show(a.urinalysis, Object.keys(F.URINE))}`);
    if (a.fetalData) L.push(`Fetal monitoring: ${show(a.fetalData, Object.keys(F.FETAL))}`);
    L.push(`Model: ${a.modelUsed}; contributing factors: ${a.contributingFactors.join('; ') || 'none reported'}`);
    const notes = db.prepare(`SELECT n.notes, n.created_at, w.name FROM healthcare_worker_notes n
      JOIN healthcare_workers w ON w.id = n.worker_id WHERE n.assessment_id = ? ORDER BY n.id`).all(a.id);
    L.push(notes.length ? 'Healthcare-worker notes:' : 'Healthcare-worker notes: none recorded');
    for (const n of notes) L.push(`  - (${n.created_at}, ${n.name}) ${n.notes}`);
    L.push(`Approved recommendation: ${a.recommendation ? a.recommendation.text : 'none'}`, '');
  }
  L.push('## Disclaimer',
    'Risk scores are prototype ML triage scores for decision support only. They are not a clinical diagnosis.');
  return L.join('\n');
}

function streamPdf(res, patient, summaryText, generatedAt) {
  const doc = new PDFDocument({ margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="IruUyir-handoff-${patient.patient_id}.pdf"`);
  doc.pipe(res);
  doc.font('Helvetica-Bold').fontSize(18).text('IruUyir - Patient Handoff Summary');
  doc.font('Helvetica').fontSize(9).fillColor('#555').text(`Generated: ${generatedAt}`).fillColor('#000').moveDown();
  for (const line of summaryText.split('\n')) {
    if (line.startsWith('## ')) doc.moveDown(0.6).font('Helvetica-Bold').fontSize(13).text(line.slice(3));
    else doc.font('Helvetica').fontSize(10).text(line || ' ');
  }
  doc.end();
}
module.exports = { buildSummaryText, streamPdf };
