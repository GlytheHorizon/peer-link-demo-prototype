const router = require('express').Router();
const c = require('../controllers/tutorController');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect);

// Profile routes must be declared BEFORE the /:id route.
router.use('/me', restrictTo('tutor'));
router.get('/me', c.getMyProfile);
router.put('/me', c.updateMyProfile);
router.get('/me/subjects', c.getMySubjects);
router.put('/me/subjects', c.setMySubjects);
router.post('/me/subjects', c.addMySubject);

router.get('/:id', c.getPublicTutor);

module.exports = router;