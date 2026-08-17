const router = require('express').Router();
const c = require('../controllers/reportController');
const { protect, restrictTo } = require('../middleware/auth');

// Faculty and administrators may view academic/tutoring reports.
router.use(protect, restrictTo('faculty', 'admin'));

router.get('/overview', c.overview);
router.get('/sessions', c.sessionsReport);
router.get('/tutors', c.tutorsReport);
router.get('/students', c.studentsReport);

module.exports = router;