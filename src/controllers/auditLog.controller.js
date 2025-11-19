const AuditLog = require('../models/auditLog.model');

/**
 * @desc    Get all audit logs with filters
 * @route   GET /api/audit-logs
 * @access  Private/Admin
 */
exports.getAuditLogs = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      action, 
      resource, 
      userId, 
      status,
      startDate,
      endDate
    } = req.query;
    
    // Build query
    const query = {};
    
    if (action) query.action = action;
    if (resource) query.resource = resource;
    if (userId) query.userId = userId;
    if (status) query.status = status;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    // Execute query with pagination
    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('userId', 'name email role')
      .lean();
    
    // Get total count
    const count = await AuditLog.countDocuments(query);
    
    res.status(200).json({
      status: 'success',
      data: {
        logs,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        totalLogs: count
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Get audit logs for a specific user
 * @route   GET /api/audit-logs/user/:userId
 * @access  Private/Admin
 */
exports.getUserAuditLogs = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;
    
    const logs = await AuditLog.getByUser(userId, parseInt(limit));
    
    res.status(200).json({
      status: 'success',
      data: { logs }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Get failed login attempts
 * @route   GET /api/audit-logs/failed-logins
 * @access  Private/Admin
 */
exports.getFailedLogins = async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    
    const logs = await AuditLog.getFailedLogins(parseInt(hours));
    
    res.status(200).json({
      status: 'success',
      data: { 
        logs,
        count: logs.length
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Get suspicious activities
 * @route   GET /api/audit-logs/suspicious
 * @access  Private/Admin
 */
exports.getSuspiciousActivities = async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    
    const logs = await AuditLog.getSuspiciousActivities(parseInt(hours));
    
    res.status(200).json({
      status: 'success',
      data: { 
        logs,
        count: logs.length
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Get activity summary
 * @route   GET /api/audit-logs/summary
 * @access  Private/Admin
 */
exports.getActivitySummary = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    const summary = await AuditLog.getActivitySummary(parseInt(days));
    
    res.status(200).json({
      status: 'success',
      data: { summary }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Get audit log by ID
 * @route   GET /api/audit-logs/:id
 * @access  Private/Admin
 */
exports.getAuditLogById = async (req, res) => {
  try {
    const log = await AuditLog.findById(req.params.id)
      .populate('userId', 'name email role');
    
    if (!log) {
      return res.status(404).json({
        status: 'fail',
        message: 'Audit log not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: { log }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Delete old audit logs (cleanup)
 * @route   DELETE /api/audit-logs/cleanup
 * @access  Private/Admin
 */
exports.cleanupOldLogs = async (req, res) => {
  try {
    const { days = 90 } = req.body;
    
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const result = await AuditLog.deleteMany({
      createdAt: { $lt: cutoffDate }
    });
    
    res.status(200).json({
      status: 'success',
      message: `Deleted ${result.deletedCount} audit logs older than ${days} days`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
