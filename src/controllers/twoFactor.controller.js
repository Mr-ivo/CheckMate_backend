const TwoFactor = require('../models/twoFactor.model');
const User = require('../models/user.model');
const { Resend } = require('resend');

// Initialize Resend for email sending (works on Render, free tier: 100 emails/day)
const resend = new Resend(process.env.RESEND_API_KEY);

console.log('📧 Email configured with Resend API');

/**
 * Send OTP via email
 * @param {String} email - Recipient email
 * @param {String} code - OTP code
 * @param {String} userName - User's name
 */
const sendOTPEmail = async (email, code, userName) => {
  try {
    console.log(`📧 Sending OTP to ${email} via Resend API`);
    
    const { data, error } = await resend.emails.send({
      from: 'CheckMate <onboarding@resend.dev>',
      to: email,
      subject: '🔐 Your CheckMate Verification Code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .code-box { background: white; border: 2px dashed #10b981; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
            .code { font-size: 32px; font-weight: bold; color: #10b981; letter-spacing: 5px; }
            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
            .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Verification Code</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${userName}</strong>,</p>
              <p>You requested a verification code to access your CheckMate account. Use the code below to complete your login:</p>
              
              <div class="code-box">
                <div class="code">${code}</div>
                <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">This code expires in 10 minutes</p>
              </div>
              
              <div class="warning">
                <strong>⚠️ Security Notice:</strong> If you didn't request this code, please ignore this email and secure your account immediately.
              </div>
              
              <p>For your security:</p>
              <ul>
                <li>Never share this code with anyone</li>
                <li>CheckMate staff will never ask for this code</li>
                <li>This code can only be used once</li>
              </ul>
              
              <p>Best regards,<br><strong>CheckMate Security Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated message from CheckMate Attendance System</p>
              <p>© 2025 CheckMate. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    });
    
    if (error) {
      console.error(`❌ Resend API error:`, error);
      throw new Error(`Email sending failed: ${error.message}`);
    }
    
    console.log(`✅ Email sent successfully to ${email}. ID: ${data.id}`);
    return data;
  } catch (error) {
    console.error(`❌ FAILED to send email to ${email}:`, error.message);
    throw new Error(`Email sending failed: ${error.message}`);
  }
};

/**
 * @desc    Enable 2FA for user
 * @route   POST /api/2fa/enable
 * @access  Private
 */
exports.enable2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }
    
    // Enable 2FA and generate backup codes
    const { twoFactor, backupCodes } = await TwoFactor.enableForUser(
      user._id,
      user.email,
      'email'
    );
    
    console.log(`🔐 2FA enabled for user: ${user.email}`);
    
    res.status(200).json({
      status: 'success',
      message: '2FA has been enabled successfully',
      data: {
        method: twoFactor.method,
        backupCodes, // Show once, user must save them
        backupCodesCount: backupCodes.length
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
 * @desc    Disable 2FA for user
 * @route   POST /api/2fa/disable
 * @access  Private
 */
exports.disable2FA = async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({
        status: 'fail',
        message: 'Password is required to disable 2FA'
      });
    }
    
    // Verify password
    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.matchPassword(password);
    
    if (!isMatch) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid password'
      });
    }
    
    // Disable 2FA
    const disabled = await TwoFactor.disableForUser(user._id);
    
    if (!disabled) {
      return res.status(404).json({
        status: 'fail',
        message: '2FA is not enabled'
      });
    }
    
    console.log(`🔓 2FA disabled for user: ${user.email}`);
    
    res.status(200).json({
      status: 'success',
      message: '2FA has been disabled successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Get 2FA status
 * @route   GET /api/2fa/status
 * @access  Private
 */
exports.get2FAStatus = async (req, res) => {
  try {
    const twoFactor = await TwoFactor.findByUserId(req.user._id);
    
    if (!twoFactor) {
      return res.status(200).json({
        status: 'success',
        data: {
          enabled: false,
          method: null
        }
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        enabled: twoFactor.isEnabled,
        method: twoFactor.method,
        lastUsed: twoFactor.lastUsed,
        totalUsed: twoFactor.totalUsed,
        remainingBackupCodes: twoFactor.getRemainingBackupCodes()
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
 * @desc    Send OTP code
 * @route   POST /api/2fa/send-otp
 * @access  Public (but requires valid email/password first)
 */
exports.sendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        status: 'fail',
        message: 'Email is required'
      });
    }
    
    // Find user
    const user = await User.findOne({ email });
    
    if (!user) {
      // Don't reveal if user exists
      return res.status(200).json({
        status: 'success',
        message: 'If 2FA is enabled for this account, an OTP has been sent to your email'
      });
    }
    
    // Check if 2FA is enabled
    const twoFactor = await TwoFactor.findByUserId(user._id);
    
    if (!twoFactor || !twoFactor.isEnabled) {
      return res.status(200).json({
        status: 'success',
        message: 'If 2FA is enabled for this account, an OTP has been sent to your email'
      });
    }
    
    // Generate OTP
    const code = twoFactor.generateOTP();
    await twoFactor.save();
    
    // Send OTP via email ASYNCHRONOUSLY (don't wait for it)
    const emailToSend = user.notificationEmail || user.email;
    sendOTPEmail(emailToSend, code, user.name)
      .then(() => {
        console.log(`✅ OTP email sent to ${emailToSend}`);
      })
      .catch((error) => {
        console.error(`❌ Failed to send OTP email to ${emailToSend}:`, error.message);
      });
    
    console.log(`📧 OTP generated for ${emailToSend}: ${code}`); // Remove in production
    
    // Respond immediately (don't wait for email)
    res.status(200).json({
      status: 'success',
      message: 'OTP has been sent to your email',
      expiresIn: '10 minutes'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Verify OTP code
 * @route   POST /api/2fa/verify-otp
 * @access  Public (but requires valid email first)
 */
exports.verifyOTP = async (req, res) => {
  try {
    const { email, code } = req.body;
    
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
        message: 'Invalid code'
      });
    }
    
    // Get 2FA settings
    const twoFactor = await TwoFactor.findByUserId(user._id);
    
    if (!twoFactor || !twoFactor.isEnabled) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid code'
      });
    }
    
    // Verify OTP
    const isValid = twoFactor.verifyOTP(code);
    await twoFactor.save();
    
    if (!isValid) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid or expired code',
        remainingAttempts: Math.max(0, 5 - twoFactor.tempOTP?.attempts || 0)
      });
    }
    
    console.log(`✅ OTP verified for ${user.email}`);
    
    res.status(200).json({
      status: 'success',
      message: 'OTP verified successfully',
      data: {
        userId: user._id,
        verified: true
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
 * @desc    Verify backup code
 * @route   POST /api/2fa/verify-backup
 * @access  Public
 */
exports.verifyBackupCode = async (req, res) => {
  try {
    const { email, backupCode } = req.body;
    
    if (!email || !backupCode) {
      return res.status(400).json({
        status: 'fail',
        message: 'Email and backup code are required'
      });
    }
    
    // Find user
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid backup code'
      });
    }
    
    // Get 2FA settings
    const twoFactor = await TwoFactor.findByUserId(user._id);
    
    if (!twoFactor || !twoFactor.isEnabled) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid backup code'
      });
    }
    
    // Verify backup code
    const isValid = twoFactor.verifyBackupCode(backupCode);
    await twoFactor.save();
    
    if (!isValid) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid or already used backup code'
      });
    }
    
    console.log(`✅ Backup code verified for ${user.email}`);
    
    res.status(200).json({
      status: 'success',
      message: 'Backup code verified successfully',
      data: {
        userId: user._id,
        verified: true,
        remainingBackupCodes: twoFactor.getRemainingBackupCodes()
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
 * @desc    Regenerate backup codes
 * @route   POST /api/2fa/regenerate-backup-codes
 * @access  Private
 */
exports.regenerateBackupCodes = async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({
        status: 'fail',
        message: 'Password is required'
      });
    }
    
    // Verify password
    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.matchPassword(password);
    
    if (!isMatch) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid password'
      });
    }
    
    // Get 2FA settings
    const twoFactor = await TwoFactor.findByUserId(user._id);
    
    if (!twoFactor || !twoFactor.isEnabled) {
      return res.status(404).json({
        status: 'fail',
        message: '2FA is not enabled'
      });
    }
    
    // Clear old backup codes and generate new ones
    twoFactor.backupCodes = [];
    const backupCodes = twoFactor.generateBackupCodes(10);
    await twoFactor.save();
    
    console.log(`🔄 Backup codes regenerated for ${user.email}`);
    
    res.status(200).json({
      status: 'success',
      message: 'Backup codes regenerated successfully',
      data: {
        backupCodes,
        count: backupCodes.length
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Export helper function for use in other controllers
module.exports.sendOTPEmail = sendOTPEmail;
