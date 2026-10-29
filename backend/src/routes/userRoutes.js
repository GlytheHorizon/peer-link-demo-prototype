const router = require('express').Router();
const c = require('../controllers/userController');
const profilePicture = require('../controllers/profilePictureController');
const { protect, restrictTo } = require('../middleware/auth');

router.get('/me', protect, c.getMe);
router.put('/me', protect, c.updateMe);
router.post('/me/profile-picture', protect, profilePicture.upload);
router.delete('/me/profile-picture', protect, profilePicture.remove);
router.patch('/me/name', protect, c.changeName);
router.patch('/me/email', protect, c.changeEmail);
router.patch('/me/password', protect, c.changeUserPassword);
router.get('/me/warnings/unacknowledged', protect, c.getWarnings);
router.post('/warnings/:id/acknowledge', protect, c.acknowledgeWarning);
router.post('/heartbeat', protect, c.heartbeat);
router.get('/', protect, restrictTo('admin'), c.listUsers);
router.get('/:id', protect, restrictTo('admin'), c.getUser);

module.exports = router;