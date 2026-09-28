const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const c = require('../controllers/notificationsController');
router.use(authenticate);
router.get('/', c.list);
router.put('/:id/read', c.markRead);
router.post('/run-reminders', requireRole('worker'), c.runReminders);
module.exports = router;
