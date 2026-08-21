const router = require('express').Router();
const c = require('../controllers/authController');
const ta = require('../controllers/tutorApplicationController');
const { protect } = require('../middleware/auth');

router.post('/register', c.register);
router.post('/login', c.login);
router.post('/admin-login', c.adminLogin);
router.post('/tutor-apply', ta.apply);
router.get('/email-exists', c.emailExists);
router.post('/forgot-password', c.forgotPassword);
router.post('/reset-password', c.resetPassword);
router.post('/logout', protect, c.logout);
router.get('/me', protect, c.me);
router.get('/tutor-application', protect, ta.myStatus);

module.exports = router;