const express = require('express');
const router = express.Router();
const { 
  generateAttendanceReport, 
  getReports, 
  getReport, 
  deleteReport 
} = require('../controllers/report.controller');

const {
  getDepartmentStats,
  getAttendanceTrends,
  getAbsenceReasons,
  getAttendanceSummary,
  exportReport
} = require('../controllers/reportsPage.controller');

const { protect, authorize } = require('../middleware/auth.middleware');

// All routes are protected
router.use(protect);

// New report page specific endpoints - MUST come before parameterized routes
router.get('/stats/departments', authorize('admin', 'supervisor'), getDepartmentStats);
router.get('/trends/:period', authorize('admin', 'supervisor'), getAttendanceTrends);
router.get('/absence-reasons', authorize('admin', 'supervisor'), getAbsenceReasons);
router.get('/summary', authorize('admin', 'supervisor'), getAttendanceSummary);
router.get('/export', authorize('admin', 'supervisor'), exportReport);

// Original report routes
router.post('/attendance', authorize('admin', 'supervisor'), generateAttendanceReport);
router.get('/', authorize('admin', 'supervisor'), getReports);

// These parameterized routes MUST come after specific routes
router.get('/:id', authorize('admin', 'supervisor'), getReport);
router.delete('/:id', authorize('admin'), deleteReport);

module.exports = router;
