const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const c = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ success: false, message: 'Too many login attempts. Try again later.' }) });

router.post('/doctor/login', limiter, c.doctorLogin);
router.post('/patient/login', limiter, c.patientLogin);
router.get('/me', authenticate, c.me);
module.exports = router;
