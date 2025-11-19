const AuditLog = require('../models/auditLog.model');

/**
 * Audit Log Middleware
 * Automatically logs all requests for security tracking
 */

// Helper function to determine action from method and path
const determineAction = (method, path) => {
  // Authentication routes
  if (path.includes('/auth/login')) return 'LOGIN';
  if (path.includes('/auth/logout')) return 'LOGOUT';
  if (path.includes('/auth/register')) return 'USER_CREATED';
  
  // User routes
  if (path.includes('/users')) {
    if (method === 'GET') return 'USER_VIEWED';
    if (method === 'POST') return 'USER_CREATED';
    if (method === 'PUT' || method === 'PATCH') return 'USER_UPDATED';
    if (method === 'DELETE') return 'USER_DELETED';
  }
  
  // Intern routes
  if (path.includes('/interns')) {
    if (method === 'GET') return 'INTERN_VIEWED';
    if (method === 'POST') return 'INTERN_CREATED';
    if (method === 'PUT' || method === 'PATCH') return 'INTERN_UPDATED';
    if (method === 'DELETE') return 'INTERN_DELETED';
  }
  
  // Attendance routes
  if (path.includes('/attendance/check-in')) return 'CHECK_IN';
  if (path.includes('/attendance/check-out')) return 'CHECK_OUT';
  if (path.includes('/attendance')) {
    if (method === 'GET') return 'ATTENDANCE_VIEWED';
    if (method === 'PUT' || method === 'PATCH') return 'ATTENDANCE_UPDATED';
    if (method === 'DELETE') return 'ATTENDANCE_DELETED';
  }
  
  // Report routes
  if (path.includes('/reports')) {
    if (method === 'GET') return 'REPORT_VIEWED';
    if (method === 'POST') return 'REPORT_GENERATED';
    if (method === 'DELETE') return 'REPORT_DELETED';
  }
  
  // Email routes
  if (path.includes('/email')) return 'EMAIL_SENT';
  
  // Notification routes
  if (path.includes('/notifications')) {
    if (method === 'GET') return 'NOTIFICATION_VIEWED';
    if (method === 'POST') return 'NOTIFICATION_CREATED';
    if (method === 'DELETE') return 'NOTIFICATION_DELETED';
  }
  
  // Settings routes
  if (path.includes('/settings')) {
    if (method === 'GET') return 'SETTINGS_VIEWED';
    if (method === 'PUT' || method === 'PATCH') return 'SETTINGS_UPDATED';
  }
  
  // 2FA routes
  if (path.includes('/2fa')) {
    if (path.includes('/enable')) return '2FA_ENABLED';
    if (path.includes('/disable')) return '2FA_DISABLED';
    if (path.includes('/verify')) return '2FA_VERIFIED';
    return 'API_REQUEST';
  }
  
  // Session routes
  if (path.includes('/sessions')) {
    if (method === 'POST' && path.includes('/refresh')) return 'TOKEN_REFRESHED';
    if (method === 'DELETE') return 'SESSION_INVALIDATED';
    return 'API_REQUEST';
  }
  
  // Geofence routes
  if (path.includes('/geofences')) {
    if (method === 'POST' && path.includes('/validate')) return 'GEOFENCE_VALIDATED';
    if (method === 'POST') return 'GEOFENCE_CREATED';
    if (method === 'PUT' || method === 'PATCH') return 'GEOFENCE_UPDATED';
    if (method === 'DELETE') return 'GEOFENCE_DELETED';
    return 'API_REQUEST';
  }
  
  // Audit logs
  if (path.includes('/audit-logs')) return 'API_REQUEST';
  
  return 'API_REQUEST';
};

// Helper function to determine resource from path
const determineResource = (path) => {
  if (path.includes('/auth')) return 'auth';
  if (path.includes('/users')) return 'user';
  if (path.includes('/interns')) return 'intern';
  if (path.includes('/attendance')) return 'attendance';
  if (path.includes('/reports')) return 'report';
  if (path.includes('/notifications')) return 'notification';
  if (path.includes('/email')) return 'email';
  if (path.includes('/settings')) return 'settings';
  return 'system';
};

// Extract resource ID from path
const extractResourceId = (path) => {
  const match = path.match(/\/([a-f0-9]{24})/i);
  return match ? match[1] : null;
};

// Middleware to log all requests
const auditLogMiddleware = async (req, res, next) => {
  const startTime = Date.now();
  
  // Store original send function
  const originalSend = res.send;
  
  // Override send function to capture response
  res.send = function(data) {
    res.send = originalSend;
    
    const duration = Date.now() - startTime;
    
    // Only log if user is authenticated (except for login attempts)
    if (req.user || req.path.includes('/auth/login')) {
      const logData = {
        userId: req.user?._id || null,
        userEmail: req.user?.email || req.body?.email || 'anonymous',
        userName: req.user?.name || 'Anonymous',
        userRole: req.user?.role || 'guest',
        action: determineAction(req.method, req.path),
        resource: determineResource(req.path),
        resourceId: extractResourceId(req.path),
        method: req.method,
        endpoint: req.path,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        status: res.statusCode >= 200 && res.statusCode < 300 ? 'success' : 'failure',
        statusCode: res.statusCode,
        duration
      };
      
      // Add error message for failed requests
      if (res.statusCode >= 400) {
        try {
          const responseData = JSON.parse(data);
          logData.errorMessage = responseData.message || 'Unknown error';
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
      
      // Log asynchronously (don't wait for it)
      AuditLog.log(logData).catch(err => {
        console.error('Audit log error:', err);
      });
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

// Middleware to log specific actions with details
const logAction = (action, resource) => {
  return async (req, res, next) => {
    try {
      if (req.user) {
        await AuditLog.log({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          userRole: req.user.role,
          action,
          resource,
          resourceId: req.params.id || null,
          method: req.method,
          endpoint: req.path,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('user-agent'),
          status: 'success',
          details: {
            body: req.body,
            params: req.params,
            query: req.query
          }
        });
      }
    } catch (error) {
      console.error('Failed to log action:', error);
    }
    next();
  };
};

// Middleware to log failed login attempts
const logFailedLogin = async (email, ipAddress, userAgent) => {
  try {
    await AuditLog.log({
      userId: null,
      userEmail: email || 'unknown',
      userName: 'Failed Login Attempt',
      userRole: 'guest',
      action: 'LOGIN_FAILED',
      resource: 'auth',
      method: 'POST',
      endpoint: '/api/auth/login',
      ipAddress,
      userAgent,
      status: 'failure',
      statusCode: 401
    });
  } catch (error) {
    console.error('Failed to log failed login:', error);
  }
};

// Middleware to log account lockout
const logAccountLockout = async (user, ipAddress, userAgent) => {
  try {
    await AuditLog.log({
      userId: user._id,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      action: 'ACCOUNT_LOCKED',
      resource: 'auth',
      method: 'POST',
      endpoint: '/api/auth/login',
      ipAddress,
      userAgent,
      status: 'warning',
      statusCode: 423,
      details: {
        lockUntil: user.lockUntil,
        loginAttempts: user.loginAttempts
      }
    });
  } catch (error) {
    console.error('Failed to log account lockout:', error);
  }
};

module.exports = {
  auditLogMiddleware,
  logAction,
  logFailedLogin,
  logAccountLockout
};
