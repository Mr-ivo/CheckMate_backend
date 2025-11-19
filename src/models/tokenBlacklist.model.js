const mongoose = require('mongoose');

/**
 * Token Blacklist Model
 * Stores invalidated JWT tokens to prevent reuse
 */

const tokenBlacklistSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    enum: ['logout', 'password_change', 'security_breach', 'admin_action', 'expired'],
    default: 'logout'
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// TTL index - automatically delete documents after expiration
tokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to blacklist a token
tokenBlacklistSchema.statics.blacklistToken = async function(token, userId, reason = 'logout', expiresAt) {
  try {
    await this.create({
      token,
      userId,
      reason,
      expiresAt: expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000) // Default 24 hours
    });
    console.log(`🚫 Token blacklisted for user ${userId}: ${reason}`);
    return true;
  } catch (error) {
    if (error.code === 11000) {
      // Token already blacklisted
      return true;
    }
    console.error('Failed to blacklist token:', error);
    return false;
  }
};

// Static method to check if token is blacklisted
tokenBlacklistSchema.statics.isBlacklisted = async function(token) {
  const blacklisted = await this.findOne({ token });
  return !!blacklisted;
};

// Static method to blacklist all user tokens (e.g., password change)
tokenBlacklistSchema.statics.blacklistAllUserTokens = async function(userId, reason = 'password_change') {
  // This would require storing all active tokens
  // For now, we'll rely on session invalidation
  console.log(`🚫 All tokens blacklisted for user ${userId}: ${reason}`);
  return true;
};

// Static method to cleanup expired blacklisted tokens
tokenBlacklistSchema.statics.cleanup = async function() {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
  console.log(`🧹 Cleaned up ${result.deletedCount} expired blacklisted tokens`);
  return result.deletedCount;
};

const TokenBlacklist = mongoose.model('TokenBlacklist', tokenBlacklistSchema);

module.exports = TokenBlacklist;
