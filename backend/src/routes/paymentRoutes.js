const router = require('express').Router();
const c = require('../controllers/paymentController');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect, restrictTo('student'));

router.get('/mine', c.mine);

module.exports = router;