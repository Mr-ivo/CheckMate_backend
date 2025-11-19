const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Two-Factor Authentication Model
 * Stores 2FA settings and backup codes for users
 */

const twoFactorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  isEnabled: {
    type: Boolean,
    default: false
  },
  method: {
    type: String,
    enum: ['email', 'authenticator', 'sms'],
    default: 'email'
  },
  // For email OTP
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  // Secret for TOTP (Time-based One-Time Password)
  secret: {
    type: String,
    select: false // Don't include in queries by default
  },
  // Backup codes for emergency access
  backupCodes: [{
    code: {
      type: String,
      required: true
    },
    used: {
      type: Boolean,
      default: false
    },
    usedAt: Date
  }],
  // Temporary OTP for email verification
  tempOTP: {
    code: String,
    expiresAt: Date,
    attempts: {
      type: Number,
      default: 0
    }
  },
  // Statistics
  lastUsed: Date,
  totalUsed: {
    type: Number,
    default: 0
  },
  failedAttempts: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for efficient queries
twoFactorSchema.index({ userId: 1, isEnabled: 1 });

/**
 * Generate a 6-digit OTP code
 * @returns {String} 6-digit code
 */
twoFactorSchema.methods.generateOTP = function() {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  
  this.tempOTP = {
    code,
    expiresAt,
    attempts: 0
  };
  
  return code;
};

/**
 * Verify OTP code
 * @param {String} code - Code to verify
 * @returns {Boolean} True if valid
 */
twoFactorSchema.methods.verifyOTP = function(code) {
  if (!this.tempOTP || !this.tempOTP.code) {
    return false;
  }
  
  // Check if expired
  if (new Date() > this.tempOTP.expiresAt) {
    return false;
  }
  
  // Check if too many attempts
  if (this.tempOTP.attempts >= 5) {
    return false;
  }
  
  // Increment attempts
  this.tempOTP.attempts += 1;
  
  // Verify code
  if (this.tempOTP.code === code) {
    // Clear temp OTP
    this.tempOTP = undefined;
    this.lastUsed = new Date();
    this.totalUsed += 1;
    this.failedAttempts = 0;
    return true;
  }
  
  this.failedAttempts += 1;
  return false;
};

/**
 * Generate backup codes
 * @param {Number} count - Number of codes to generate (default 10)
 * @returns {Array} Array of backup codes
 */
twoFactorSchema.methods.generateBackupCodes = function(count = 10) {
  const codes = [];
  
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
    
    this.backupCodes.push({
      code,
      used: false
    });
  }
  
  return codes;
};

/**
 * Verify backup code
 * @param {String} code - Backup code to verify
 * @returns {Boolean} True if valid
 */
twoFactorSchema.methods.verifyBackupCode = function(code) {
  const backupCode = this.backupCodes.find(
    bc => bc.code === code.toUpperCase() && !bc.used
  );
  
  if (!backupCode) {
    this.failedAttempts += 1;
    return false;
  }
  
  // Mark as used
  backupCode.used = true;
  backupCode.usedAt = new Date();
  
  this.lastUsed = new Date();
  this.totalUsed += 1;
  this.failedAttempts = 0;
  
  return true;
};

/**
 * Get remaining backup codes count
 * @returns {Number} Count of unused backup codes
 */
twoFactorSchema.methods.getRemainingBackupCodes = function() {
  return this.backupCodes.filter(bc => !bc.used).length;
};

/**
 * Static method to find 2FA settings for user
 * @param {String} userId - User ID
 * @returns {Object} 2FA settings or null
 */
twoFactorSchema.statics.findByUserId = async function(userId) {
  return this.findOne({ userId });
};

/**
 * Static method to enable 2FA for user
 * @param {String} userId - User ID
 * @param {String} email - User's email
 * @param {String} method - 2FA method (default: email)
 * @returns {Object} 2FA settings
 */
twoFactorSchema.statics.enableForUser = async function(userId, email, method = 'email') {
  let twoFactor = await this.findOne({ userId });
  
  if (!twoFactor) {
    twoFactor = await this.create({
      userId,
      email,
      method,
      isEnabled: true
    });
  } else {
    twoFactor.isEnabled = true;
    twoFactor.method = method;
    twoFactor.email = email;
    await twoFactor.save();
  }
  
  // Generate backup codes
  const backupCodes = twoFactor.generateBackupCodes(10);
  await twoFactor.save();
  
  return { twoFactor, backupCodes };
};

/**
 * Static method to disable 2FA for user
 * @param {String} userId - User ID
 * @returns {Boolean} True if disabled
 */
twoFactorSchema.statics.disableForUser = async function(userId) {
  const twoFactor = await this.findOne({ userId });
  
  if (!twoFactor) {
    return false;
  }
  
  twoFactor.isEnabled = false;
  twoFactor.tempOTP = undefined;
  await twoFactor.save();
  
  return true;
};

const TwoFactor = mongoose.model('TwoFactor', twoFactorSchema);

module.exports = TwoFactor;
