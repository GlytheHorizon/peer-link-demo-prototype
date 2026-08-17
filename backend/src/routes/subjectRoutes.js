const router = require('express').Router();
const c = require('../controllers/subjectController');
const { protect, restrictTo } = require('../middleware/auth');

router.get('/', protect, c.listSubjects);
router.get('/search', protect, c.searchSubjects);

router.post('/', protect, restrictTo('admin'), c.createSubject);
router.put('/:id', protect, restrictTo('admin'), c.updateSubject);
router.delete('/:id', protect, restrictTo('admin'), c.deleteSubject);

module.exports = router;