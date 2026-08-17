const router = require('express').Router();
const c = require('../controllers/conversationController');
const messageRoutes = require('./messageRoutes');
const { protect } = require('../middleware/auth');
const conversationModel = require('../models/conversationModel');
const { ApiError } = require('../utils/http');

router.use(protect);

router.get('/unread-count', require('../controllers/messageController').unreadCount);

router.get('/', c.listMine);
router.post('/', c.start);
router.get('/:id', c.getOne);

router.use(
  '/:id/messages',
  async (req, res, next) => {
    try {
      const conversation = await conversationModel.findById(Number(req.params.id));
      if (!conversation) return next(new ApiError(404, 'Conversation not found'));
      if (conversation.student_id !== req.user.id && conversation.tutor_id !== req.user.id) {
        return next(new ApiError(403, 'You are not part of this conversation'));
      }
      next();
    } catch (err) {
      next(err);
    }
  },
  messageRoutes
);

module.exports = router;