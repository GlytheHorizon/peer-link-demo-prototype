const router = require('express').Router();
const c = require('../controllers/reportController');
const { protect, restrictTo } = require('../middleware/auth');

// Student/Tutor can create a user report (no admin restriction)
router.post('/user', protect, c.createUserReport);

// Admin routes for managing user reports
router.get('/user', protect, restrictTo('admin'), c.listUserReports);
router.patch('/user/:id', protect, restrictTo('admin'), c.resolveUserReport);

// Administrators may view academic/tutoring reports.
router.get('/overview', protect, restrictTo('admin'), c.overview);
router.get('/sessions', protect, restrictTo('admin'), c.sessionsReport);
router.get('/tutors', protect, restrictTo('admin'), c.tutorsReport);
router.get('/students', protect, restrictTo('admin'), c.studentsReport);

module.exports = router;