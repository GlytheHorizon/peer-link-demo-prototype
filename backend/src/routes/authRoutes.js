const router = require('express').Router();
const c = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', c.register);
router.post('/login', c.login);
router.get('/email-exists', c.emailExists);
router.post('/logout', protect, c.logout);
router.get('/me', protect, c.me);

module.exports = router;