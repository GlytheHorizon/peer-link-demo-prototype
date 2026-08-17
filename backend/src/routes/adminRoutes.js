const router = require('express').Router();
const c = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect, restrictTo('admin'));

router.get('/stats', c.stats);
router.get('/users', c.listUsers);
router.post('/users', c.createUser);
router.patch('/users/:id', c.updateUser);
router.delete('/users/:id', c.deleteUser);
router.get('/subjects', c.listSubjects);
router.get('/sessions', c.listSessions);

module.exports = router;