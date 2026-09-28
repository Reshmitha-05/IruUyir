const jwt = require('jsonwebtoken');
const config = require('../config');
const { AppError } = require('../utils/response');
const { findPatient } = require('../utils/helpers');

function authenticate(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return next(new AppError(401, 'Authentication required'));
  try {
    req.user = jwt.verify(token, config.jwtSecret); // { sub, role, code }
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired token'));
  }
}
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(new AppError(403, 'You do not have permission for this action'));

// Hook for "authorized patient records". Prototype: every authenticated worker at the
// facility may access every patient. Tighten here (e.g. only workers with appointments) if needed.
function canWorkerAccessPatient(/* workerId, patient */) { return true; }

// Patients -> only themselves. Workers -> per canWorkerAccessPatient. Sets req.patient.
function patientAccess(req, res, next) {
  const p = findPatient(req.params.id);
  if (!p) return next(new AppError(404, 'Patient not found'));
  if (req.user.role === 'patient' && p.id !== req.user.sub) return next(new AppError(403, 'You can only access your own records'));
  if (req.user.role === 'worker' && !canWorkerAccessPatient(req.user.sub, p)) return next(new AppError(403, 'Not authorized for this patient'));
  req.patient = p;
  next();
}
module.exports = { authenticate, requireRole, patientAccess, canWorkerAccessPatient };
