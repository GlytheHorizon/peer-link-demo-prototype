const router = require('express').Router();
const c = require('../controllers/adminController');
const sr = require('../controllers/subjectRequestController');
const ta = require('../controllers/tutorApplicationController');
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
router.get('/tutor-applications', ta.list);
router.get('/tutor-applications/:id', ta.get);
router.post('/tutor-applications/:id/approve', ta.approve);
router.post('/tutor-applications/:id/reject', ta.reject);
router.get('/tutor-applications/:id/file/:field', ta.getFile);

module.exports = router;