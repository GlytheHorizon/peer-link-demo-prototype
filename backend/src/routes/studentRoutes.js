const router = require('express').Router();
const c = require('../controllers/studentController');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect);

router.get('/me', restrictTo('student'), c.getMyProfile);
router.put('/me', restrictTo('student'), c.updateMyProfile);
router.get('/me/subjects', restrictTo('student'), c.getMySubjects);
router.put('/me/subjects', restrictTo('student'), c.setMySubjects);

router.get('/:id', c.getPublicStudent);

module.exports = router;