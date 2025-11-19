const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const {
  getAuditLogs,
  getUserAuditLogs,
  getFailedLogins,
  getSuspiciousActivities,
  getActivitySummary,
  getAuditLogById,
  cleanupOldLogs
} = require('../controllers/auditLog.controller');

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

// Get all audit logs with filters
router.get('/', getAuditLogs);

// Get activity summary
router.get('/summary', getActivitySummary);

// Get failed login attempts
router.get('/failed-logins', getFailedLogins);

// Get suspicious activities
router.get('/suspicious', getSuspiciousActivities);

// Get audit logs for specific user
router.get('/user/:userId', getUserAuditLogs);

// Get specific audit log
router.get('/:id', getAuditLogById);

// Cleanup old logs
router.delete('/cleanup', cleanupOldLogs);

module.exports = router;
