const User = require('../models/user.model');
const Session = require('../models/session.model');
const TwoFactor = require('../models/twoFactor.model');
const { generateToken, generateRefreshToken, getTokenExpiry } = require('../utils/jwt.utils');

/**
 * @desc    Complete login with 2FA verification
 * @route   POST /api/auth/login-2fa
 * @access  Public
 */
exports.loginWith2FA = async (req, res) => {
  try {
    const { email, code, useBackupCode } = req.body;
    
    if (!email || !code) {
      return res.status(400).json({
        status: 'fail',
        message: 'Email and code are required'
      });
    }
    
    // Find user
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid credentials'
      });
    }
    
    // Get 2FA settings
    const twoFactor = await TwoFactor.findByUserId(user._id);
    
    if (!twoFactor || !twoFactor.isEnabled) {
      return res.status(401).json({
        status: 'fail',
        message: '2FA is not enabled for this account'
      });
    }
    
    // Verify code (OTP or backup code)
    let isValid = false;
    
    if (useBackupCode) {
      isValid = twoFactor.verifyBackupCode(code);
      if (isValid) {
        console.log(`✅ Backup code verified for ${user.email}`);
      }
    } else {
      isValid = twoFactor.verifyOTP(code);
      if (isValid) {
        console.log(`✅ OTP verified for ${user.email}`);
      }
    }
    
    await twoFactor.save();
    
    if (!isValid) {
      return res.status(401).json({
        status: 'fail',
        message: useBackupCode ? 'Invalid or already used backup code' : 'Invalid or expired OTP code',
        remainingAttempts: useBackupCode ? null : Math.max(0, 5 - (twoFactor.tempOTP?.attempts || 0))
      });
    }
    
    // 2FA verified - issue tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    
    // Create session
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent') || 'Unknown';
    
    await Session.createSession(
      user._id,
      token,
      refreshToken,
      ipAddress,
      userAgent,
      24 * 60 * 60 * 1000 // 24 hours
    );
    
    // Enforce concurrent session limit
    const invalidatedCount = await Session.enforceConcurrentLimit(user._id, 3);
    if (invalidatedCount > 0) {
      console.log(`🔒 Invalidated ${invalidatedCount} old session(s) for ${user.email}`);
    }
    
    console.log(`✅ Successful 2FA login: ${user.email}`);
    
    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          profileImage: user.profileImage
        },
        token,
        refreshToken,
        remainingBackupCodes: useBackupCode ? twoFactor.getRemainingBackupCodes() : undefined
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
