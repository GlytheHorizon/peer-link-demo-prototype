const router = require('express').Router();
const c = require('../controllers/resourceController');
const { protect, restrictTo } = require('../middleware/auth');

router.get('/', protect, c.list);
router.get('/folders', protect, c.folders);
router.post('/', protect, restrictTo('tutor'), c.upload);
router.get('/:id/file', protect, c.getFile);
router.delete('/:id', protect, restrictTo('tutor'), c.remove);

module.exports = router;