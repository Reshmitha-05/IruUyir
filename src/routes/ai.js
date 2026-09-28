const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
router.use(authenticate, requireRole('worker'));
router.post('/recommendation', require('../controllers/aiController').recommend);
module.exports = router;
