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
const { attendanceLimiter } = require('../middleware/rateLimiter.middleware');

// All routes are protected
router.use(protect);

// Routes for all authenticated users - with rate limiting
router.post('/check-in', attendanceLimiter, checkIn);
router.post('/check-out', attendanceLimiter, checkOut);

// Routes for viewing attendance (admin/supervisor)
router.get('/', authorize('admin', 'supervisor'), getAttendanceRecords);
router.get('/today', authorize('admin', 'supervisor'), getTodayAttendance);
router.get('/stats', authorize('admin', 'supervisor'), getAttendanceStats);

// New routes for attendance management
router.get('/date/:date', getAttendanceByDate); // Allow all authenticated users to view
router.patch('/:internId', authorize('admin', 'supervisor'), updateAttendanceStatus);
router.post('/bulk-update', authorize('admin', 'supervisor'), bulkUpdateAttendance);
router.post('/save', authorize('admin', 'supervisor'), saveAttendanceData);
router.get('/export', authorize('admin', 'supervisor'), exportAttendanceData);
router.get('/departments', getAllDepartments); // Allow all authenticated users to view

// Intern-specific routes
router.get('/intern/:internId', getInternAttendance);
router.get('/intern/:internId/today', getInternTodayStatus);
router.get('/weekly/:internId', getWeeklyAttendancePercentage);

module.exports = router;
