const notFound = (req, res) => res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ success: false, message: 'Invalid JSON body' });
  const status = err.status || 500;
  if (status >= 500 && !err.status) console.error(err);
  const body = { success: false, message: status >= 500 && !err.status ? 'Internal server error' : err.message };
  if (err.details) body.errors = err.details;
  res.status(status).json(body);
};
module.exports = { notFound, errorHandler };
