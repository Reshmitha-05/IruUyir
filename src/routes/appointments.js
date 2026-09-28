const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const c = require('../controllers/appointmentsController');
router.use(authenticate, requireRole('worker'));
router.post('/', c.create);
router.get('/today', c.today);
router.get('/calendar', c.calendar);
module.exports = router;
