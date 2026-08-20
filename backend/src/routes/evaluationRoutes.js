const router = require('express').Router();
const c = require('../controllers/evaluationController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/mine', c.listMine);
router.get('/tutor/:tutorId', c.listForTutor);
router.post('/', c.create);
router.get('/:sessionId', c.getForSession);

module.exports = router;