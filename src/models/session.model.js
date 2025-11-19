const mongoose = require('mongoose');

/**
 * Session Model
 * Tracks active user sessions for security and concurrent session control
 */

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  refreshToken: {
    type: String,
    unique: true,
    sparse: true // Allow null values
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  deviceInfo: {
    browser: String,
    os: String,
    device: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  logoutAt: {
    type: Date
  },
  logoutReason: {
    type: String,
    enum: ['manual', 'expired', 'forced', 'inactivity', 'security']
  }
}, {
  timestamps: true
});

// Index for efficient queries
sessionSchema.index({ userId: 1, isActive: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired sessions

// Static method to create new session
sessionSchema.statics.createSession = async function(userId, token, refreshToken, ipAddress, userAgent, expiresIn = 24 * 60 * 60 * 1000) {
  const expiresAt = new Date(Date.now() + expiresIn);
  
  // Parse user agent for device info
  const deviceInfo = parseUserAgent(userAgent);
  
  const session = await this.create({
    userId,
    token,
    refreshToken,
    ipAddress,
    userAgent,
    deviceInfo,
    expiresAt
  });
  
  return session;
};

// Static method to get active sessions for user
sessionSchema.statics.getActiveSessions = async function(userId) {
  return this.find({
    userId,
    isActive: true,
    expiresAt: { $gt: new Date() }
  }).sort({ lastActivity: -1 });
};

// Static method to validate session
sessionSchema.statics.validateSession = async function(token) {
  const session = await this.findOne({
    token,
    isActive: true,
    expiresAt: { $gt: new Date() }
  }).populate('userId', 'name email role');
  
  if (session) {
    // Update last activity
    session.lastActivity = new Date();
    await session.save();
  }
  
  return session;
};

// Static method to invalidate session (logout)
sessionSchema.statics.invalidateSession = async function(token, reason = 'manual') {
  return this.updateOne(
    { token },
    {
      $set: {
        isActive: false,
        logoutAt: new Date(),
        logoutReason: reason
      }
    }
  );
};

// Static method to invalidate all user sessions (force logout)
sessionSchema.statics.invalidateAllUserSessions = async function(userId, reason = 'forced') {
  return this.updateMany(
    { userId, isActive: true },
    {
      $set: {
        isActive: false,
        logoutAt: new Date(),
        logoutReason: reason
      }
    }
  );
};

// Static method to cleanup inactive sessions
sessionSchema.statics.cleanupInactiveSessions = async function(inactivityMinutes = 30) {
  const cutoffTime = new Date(Date.now() - inactivityMinutes * 60 * 1000);
  
  const result = await this.updateMany(
    {
      isActive: true,
      lastActivity: { $lt: cutoffTime }
    },
    {
      $set: {
        isActive: false,
        logoutAt: new Date(),
        logoutReason: 'inactivity'
      }
    }
  );
  
  return result;
};

// Static method to enforce concurrent session limit
sessionSchema.statics.enforceConcurrentLimit = async function(userId, maxSessions = 3) {
  const activeSessions = await this.find({
    userId,
    isActive: true,
    expiresAt: { $gt: new Date() }
  }).sort({ lastActivity: -1 });
  
  // If user has more than max sessions, invalidate oldest ones
  if (activeSessions.length > maxSessions) {
    const sessionsToInvalidate = activeSessions.slice(maxSessions);
    const tokenIds = sessionsToInvalidate.map(s => s.token);
    
    await this.updateMany(
      { token: { $in: tokenIds } },
      {
        $set: {
          isActive: false,
          logoutAt: new Date(),
          logoutReason: 'security'
        }
      }
    );
    
    return sessionsToInvalidate.length;
  }
  
  return 0;
};

// Helper function to parse user agent
function parseUserAgent(userAgent) {
  const info = {
    browser: 'Unknown',
    os: 'Unknown',
    device: 'Desktop'
  };
  
  if (!userAgent) return info;
  
  // Detect browser
  if (userAgent.includes('Chrome')) info.browser = 'Chrome';
  else if (userAgent.includes('Firefox')) info.browser = 'Firefox';
  else if (userAgent.includes('Safari')) info.browser = 'Safari';
  else if (userAgent.includes('Edge')) info.browser = 'Edge';
  
  // Detect OS
  if (userAgent.includes('Windows')) info.os = 'Windows';
  else if (userAgent.includes('Mac')) info.os = 'macOS';
  else if (userAgent.includes('Linux')) info.os = 'Linux';
  else if (userAgent.includes('Android')) info.os = 'Android';
  else if (userAgent.includes('iOS')) info.os = 'iOS';
  
  // Detect device
  if (userAgent.includes('Mobile') || userAgent.includes('Android')) info.device = 'Mobile';
  else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) info.device = 'Tablet';
  
  return info;
}

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
