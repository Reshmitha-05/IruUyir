const router = require('express').Router();
const { authenticate, requireRole, patientAccess } = require('../middleware/auth');
const patients = require('../controllers/patientsController');
const appts = require('../controllers/appointmentsController');
const assess = require('../controllers/assessmentsController');
const timeline = require('../controllers/timelineController');
const cycle = require('../controllers/menstrualController');
const handoff = require('../controllers/handoffController');
const pre = require('../controllers/preArrivalController');

router.use(authenticate);
router.post('/', requireRole('worker'), patients.create);
router.get('/', requireRole('worker'), patients.list);

// Everything below: patient may only reach their own :id; workers per canWorkerAccessPatient().
router.get('/:id', patientAccess, patients.get);
router.get('/:id/appointments', patientAccess, appts.forPatient);
router.get('/:id/assessments', patientAccess, assess.listForPatient);
router.get('/:id/timeline', patientAccess, timeline.get);

// /api/menstrual-cycle feature (patient enters, worker reads)
router.post('/:id/menstrual-cycle', requireRole('patient'), patientAccess, cycle.add);
router.get('/:id/menstrual-cycle', patientAccess, cycle.list);

// /api/handoff feature
router.post('/:id/handoff-summary', patientAccess, handoff.generate);
router.get('/:id/handoff-summary/download', patientAccess, handoff.download);

// Emergency pre-arrival (patient only)
router.post('/:id/pre-arrival', requireRole('patient'), patientAccess, pre.create);
module.exports = router;
