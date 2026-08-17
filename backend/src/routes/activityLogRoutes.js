const router = require('express').Router();
const c = require('../controllers/activityLogController');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect, restrictTo('admin'));

router.get('/', c.listLogs);

module.exports = router;