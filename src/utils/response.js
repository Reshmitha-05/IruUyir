class AppError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}
const ok = (res, data = {}, status = 200) => res.status(status).json({ success: true, data });
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
module.exports = { AppError, ok, asyncHandler };
