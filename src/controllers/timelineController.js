const { ok, asyncHandler } = require('../utils/response');
const { buildTimeline } = require('../services/timelineService');
exports.get = asyncHandler(async (req, res) => ok(res, { patient: req.patient, timeline: buildTimeline(req.patient.id, req.user.role) }));
