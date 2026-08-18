const router = require('express').Router();
const c = require('../controllers/tutorController');
const sr = require('../controllers/subjectRequestController');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect);

// Profile routes must be declared BEFORE the /:id route.
router.use('/me', restrictTo('tutor'));
router.get('/me', c.getMyProfile);
router.put('/me', c.updateMyProfile);
router.get('/me/subjects', c.getMySubjects);
router.put('/me/subjects', c.setMySubjects);
router.get('/me/subject-requests', sr.listMyRequests);
router.post('/me/subject-requests', sr.createRequest);

  router.get('/:id', c.getPublicTutor);
  router.get('/', c.listTutors);

module.exports = router;