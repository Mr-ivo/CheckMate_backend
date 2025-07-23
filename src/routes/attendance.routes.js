const express = require('express');
const router = express.Router();
const { 
  checkIn, 
  checkOut, 
  getAttendanceRecords, 
  getTodayAttendance,
  getAttendanceStats,
  getInternAttendance,
  getInternTodayStatus
} = require('../controllers/attendance.controller');

const { 
  getAttendanceByDate,
  updateAttendanceStatus,
  bulkUpdateAttendance,
  saveAttendanceData,
  exportAttendanceData,
  getAllDepartments,
  getWeeklyAttendancePercentage
} = require('../controllers/attendancePage.controller');

const { protect, authorize } = require('../middleware/auth.middleware');

// All routes are protected
router.use(protect);

// Routes for all authenticated users
router.post('/check-in', checkIn);
router.post('/check-out', checkOut);

// Routes for viewing attendance (admin/supervisor)
router.get('/', authorize('admin', 'supervisor'), getAttendanceRecords);
router.get('/today', authorize('admin', 'supervisor'), getTodayAttendance);
router.get('/stats', authorize('admin', 'supervisor'), getAttendanceStats);

// New routes for attendance management
router.get('/date/:date', authorize('admin', 'supervisor'), getAttendanceByDate);
router.patch('/:internId', authorize('admin', 'supervisor'), updateAttendanceStatus);
router.post('/bulk-update', authorize('admin', 'supervisor'), bulkUpdateAttendance);
router.post('/save', authorize('admin', 'supervisor'), saveAttendanceData);
router.get('/export', authorize('admin', 'supervisor'), exportAttendanceData);
router.get('/departments', authorize('admin', 'supervisor'), getAllDepartments);

// Intern-specific routes
router.get('/intern/:internId', getInternAttendance);
router.get('/intern/:internId/today', getInternTodayStatus);
router.get('/weekly/:internId', getWeeklyAttendancePercentage);

module.exports = router;
