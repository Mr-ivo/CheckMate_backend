const mongoose = require('mongoose');

/**
 * Audit Log Model
 * Tracks all important user actions for security and compliance
 */

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  userRole: {
    type: String,
    enum: ['admin', 'supervisor', 'intern'],
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      // Authentication actions
      'LOGIN',
      'LOGOUT',
      'LOGIN_FAILED',
      'ACCOUNT_LOCKED',
      'PASSWORD_CHANGED',
      
      // User management
      'USER_CREATED',
      'USER_UPDATED',
      'USER_DELETED',
      'USER_VIEWED',
      
      // Intern management
      'INTERN_CREATED',
      'INTERN_UPDATED',
      'INTERN_DELETED',
      'INTERN_VIEWED',
      
      // Attendance actions
      'CHECK_IN',
      'CHECK_OUT',
      'ATTENDANCE_VIEWED',
      'ATTENDANCE_UPDATED',
      'ATTENDANCE_DELETED',
      
      // Report actions
      'REPORT_GENERATED',
      'REPORT_VIEWED',
      'REPORT_DELETED',
      
      // Email actions
      'EMAIL_SENT',
      'EMAIL_FAILED',
      
      // Notification actions
      'NOTIFICATION_CREATED',
      'NOTIFICATION_VIEWED',
      'NOTIFICATION_DELETED',
      
      // Settings actions
      'SETTINGS_UPDATED',
      'SETTINGS_VIEWED',
      
      // 2FA actions
      '2FA_ENABLED',
      '2FA_DISABLED',
      '2FA_VERIFIED',
      '2FA_FAILED',
      
      // Session actions
      'SESSION_CREATED',
      'SESSION_INVALIDATED',
      'TOKEN_REFRESHED',
      
      // Geofence actions
      'GEOFENCE_CREATED',
      'GEOFENCE_UPDATED',
      'GEOFENCE_DELETED',
      'GEOFENCE_VALIDATED',
      
      // Security actions
      'RATE_LIMIT_EXCEEDED',
      'UNAUTHORIZED_ACCESS',
      'SUSPICIOUS_ACTIVITY',
      
      // System actions
      'SYSTEM_ACTION',
      'API_REQUEST'
    ]
  },
  resource: {
    type: String,
    required: true,
    enum: ['user', 'intern', 'attendance', 'report', 'notification', 'email', 'settings', 'auth', 'system']
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  method: {
    type: String,
    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  },
  endpoint: {
    type: String
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  status: {
    type: String,
    enum: ['success', 'failure', 'warning'],
    default: 'success'
  },
  statusCode: {
    type: Number
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  changes: {
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed
  },
  errorMessage: {
    type: String
  },
  duration: {
    type: Number // Request duration in milliseconds
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, createdAt: -1 });
auditLogSchema.index({ ipAddress: 1, createdAt: -1 });
auditLogSchema.index({ status: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 }); // For time-based queries

// Static method to create audit log
auditLogSchema.statics.log = async function(logData) {
  try {
    const log = await this.create(logData);
    return log;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw error - audit logging should not break the main flow
    return null;
  }
};

// Static method to get logs by user
auditLogSchema.statics.getByUser = async function(userId, limit = 50) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// Static method to get logs by action
auditLogSchema.statics.getByAction = async function(action, limit = 50) {
  return this.find({ action })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('userId', 'name email role')
    .lean();
};

// Static method to get logs by date range
auditLogSchema.statics.getByDateRange = async function(startDate, endDate, filters = {}) {
  const query = {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    },
    ...filters
  };
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .populate('userId', 'name email role')
    .lean();
};

// Static method to get failed login attempts
auditLogSchema.statics.getFailedLogins = async function(hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return this.find({
    action: 'LOGIN_FAILED',
    createdAt: { $gte: since }
  })
    .sort({ createdAt: -1 })
    .lean();
};

// Static method to get suspicious activities
auditLogSchema.statics.getSuspiciousActivities = async function(hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return this.find({
    $or: [
      { action: 'SUSPICIOUS_ACTIVITY' },
      { action: 'UNAUTHORIZED_ACCESS' },
      { action: 'RATE_LIMIT_EXCEEDED' },
      { action: 'ACCOUNT_LOCKED' }
    ],
    createdAt: { $gte: since }
  })
    .sort({ createdAt: -1 })
    .populate('userId', 'name email role')
    .lean();
};

// Static method to get activity summary
auditLogSchema.statics.getActivitySummary = async function(days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: since }
      }
    },
    {
      $group: {
        _id: '$action',
        count: { $sum: 1 },
        successCount: {
          $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
        },
        failureCount: {
          $sum: { $cond: [{ $eq: ['$status', 'failure'] }, 1, 0] }
        }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
