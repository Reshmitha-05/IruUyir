const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const c = require('../controllers/mlController');
router.use(authenticate, requireRole('worker'));
router.post('/baseline-risk', c.baseline);
router.post('/trimester-risk', c.trimester);
module.exports = router;
