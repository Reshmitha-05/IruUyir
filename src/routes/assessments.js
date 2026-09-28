const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const c = require('../controllers/assessmentsController');
router.use(authenticate);
router.post('/', requireRole('worker'), c.create);
router.get('/:id', c.get); // patients only get APPROVED assessments they own
router.put('/:id/recommendation', requireRole('worker'), c.editRecommendation);
router.post('/:id/approve', requireRole('worker'), c.approve);
router.post('/:id/notes', requireRole('worker'), c.addNote);
module.exports = router;
