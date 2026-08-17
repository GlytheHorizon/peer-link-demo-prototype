const router = require('express').Router({ mergeParams: true });
const c = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', c.listMessages);
router.post('/', c.sendMessage);
router.delete('/:messageId', c.deleteMessage);

module.exports = router;