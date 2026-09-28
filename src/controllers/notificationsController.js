const db = require('../db/database');
const { AppError, ok, asyncHandler } = require('../utils/response');
const { createRemindersForTomorrow } = require('../services/notificationService');

const SEL = 'SELECT id, patient_id AS patientId, type, title, message, read_status AS read, created_at AS createdAt FROM notifications';
exports.list = asyncHandler(async (req, res) => {
  const rows = req.user.role === 'patient'
    ? db.prepare(`${SEL} WHERE patient_id = ? AND healthcare_worker_id IS NULL ORDER BY id DESC LIMIT 100`).all(req.user.sub)
    : db.prepare(`${SEL} WHERE healthcare_worker_id = ? ORDER BY id DESC LIMIT 100`).all(req.user.sub);
  ok(res, rows.map((r) => ({ ...r, read: !!r.read })));
});
exports.markRead = asyncHandler(async (req, res) => {
  const col = req.user.role === 'patient' ? 'patient_id' : 'healthcare_worker_id';
  const extra = req.user.role === 'patient' ? 'AND healthcare_worker_id IS NULL' : '';
  const info = db.prepare(`UPDATE notifications SET read_status = 1 WHERE id = ? AND ${col} = ? ${extra}`).run(req.params.id, req.user.sub);
  if (!info.changes) throw new AppError(404, 'Notification not found');
  ok(res, { id: Number(req.params.id), read: true });
});
exports.runReminders = asyncHandler(async (req, res) => ok(res, createRemindersForTomorrow()));
