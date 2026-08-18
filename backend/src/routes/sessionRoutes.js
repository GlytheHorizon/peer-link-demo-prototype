const router = require('express').Router();
const c = require('../controllers/sessionController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', c.listMine);
router.post('/', c.createRequest);
router.get('/:id', c.getOne);
router.delete('/:id', c.deleteRequest);
router.patch('/:id/respond', c.respond);
router.patch('/:id/complete', c.complete);
router.patch('/:id/cancel', c.cancel);
  router.post('/:id/reschedule-requests', c.reschedule);
  router.get('/:id/reschedule-requests', c.listRescheduleRequests);
  router.post('/:id/reschedule-requests/:requestId/respond', c.respondRescheduleRequest);
router.post('/:id/pay', c.pay);

module.exports = router;