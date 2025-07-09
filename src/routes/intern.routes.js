const express = require('express');
const router = express.Router();
const { 
  getInterns, 
  createIntern, 
  getIntern, 
  updateIntern, 
  deleteIntern,
  getInternAttendanceStats
} = require('../controllers/intern.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// All routes are protected
router.use(protect);

// Routes accessible by all authenticated users
router.get('/', getInterns);
router.get('/:id', getIntern);
router.get('/:id/attendance-stats', getInternAttendanceStats);

// Routes requiring admin or supervisor role
router.post('/', authorize('admin', 'supervisor'), createIntern);
router.put('/:id', authorize('admin', 'supervisor'), updateIntern);
router.delete('/:id', authorize('admin'), deleteIntern);

module.exports = router;
