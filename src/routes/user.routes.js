const express = require('express');
const router = express.Router();
const { getUsers, getUser, updateUser, deleteUser, approveUser, rejectUser, deactivateUser, activateUser } = require('../controllers/user.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// All routes are protected and require admin access
router.use(protect);
router.use(authorize('admin'));

router.route('/')
  .get(getUsers);

// User management actions
router.post('/:id/approve', approveUser);
router.post('/:id/reject', rejectUser);
router.post('/:id/deactivate', deactivateUser);
router.post('/:id/activate', activateUser);

router.route('/:id')
  .get(getUser)
  .put(updateUser)
  .delete(deleteUser);

module.exports = router;
