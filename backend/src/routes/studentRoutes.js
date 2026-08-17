const router = require('express').Router();
const c = require('../controllers/studentController');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect, restrictTo('student'));

router.get('/me', c.getMyProfile);
router.put('/me', c.updateMyProfile);
router.get('/me/subjects', c.getMySubjects);
router.put('/me/subjects', c.setMySubjects);

module.exports = router;