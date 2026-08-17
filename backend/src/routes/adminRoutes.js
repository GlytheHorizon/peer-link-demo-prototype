const router = require('express').Router();
const c = require('../controllers/adminController');
const sr = require('../controllers/subjectRequestController');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect, restrictTo('admin'));

router.get('/stats', c.stats);
router.get('/users', c.listUsers);
router.post('/users', c.createUser);
router.patch('/users/:id', c.updateUser);
router.delete('/users/:id', c.deleteUser);
router.get('/subjects', c.listSubjects);
router.get('/sessions', c.listSessions);
router.get('/subject-requests', sr.listRequests);
router.post('/subject-requests/:id/approve', sr.approveRequest);
router.post('/subject-requests/:id/reject', sr.rejectRequest);

module.exports = router;