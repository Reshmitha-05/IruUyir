const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const c = require('../controllers/preArrivalController');
router.use(authenticate, requireRole('worker'));
router.get('/pre-arrival', c.list);
router.put('/pre-arrival/:id/acknowledge', c.acknowledge);
module.exports = router;
