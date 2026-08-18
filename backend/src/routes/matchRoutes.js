const router = require('express').Router();
const c = require('../controllers/matchController');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect, restrictTo('student'));

router.post('/generate', c.generate);
router.get('/search', c.search);
router.get('/browse', c.browse);
router.get('/', c.listMyMatches);
router.get('/:id', c.getMatch);

module.exports = router;