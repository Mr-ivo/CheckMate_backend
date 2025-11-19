const User = require('../models/user.model');
const Session = require('../models/session.model');
const TokenBlacklist = require('../models/tokenBlacklist.model');
const TwoFactor = require('../models/twoFactor.model');
const { generateToken, generateRefreshToken, getTokenExpiry } = require('../utils/jwt.utils');

/**
 * @desc    Register new user (self-registration with pending approval)
 * @route   POST /api/auth/register
 * @access  Public
 */
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, department, position, employeeId, address } = req.body;
    
    // Validate required fields
    if (!name || !email || !password || !phone || !department || !position || !employeeId) {
      return res.status(400).json({
        status: 'fail',
        message: 'Please provide all required fields'
      });
    }
    
    // Check if user already exists
    const userExists = await User.findOne({ email });
    
    if (userExists) {
      return res.status(400).json({
        status: 'fail',
        message: 'User with this email already exists'
      });
    }
    
    // Check if employee ID already exists
    const Intern = require('../models/intern.model');
    const employeeIdExists = await Intern.findOne({ employeeId });
    
    if (employeeIdExists) {
      return res.status(400).json({
        status: 'fail',
        message: 'Employee ID already exists'
      });
    }
    
    // Create new user with pending status
    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: 'intern',
      isActive: false, // Pending approval
      department
    });
    
    // Create intern record
    await Intern.create({
      userId: user._id,
      name,
      email,
      employeeId,
      department,
      position,
      contactNumber: phone,
      address: address || 'N/A',
      status: 'pending', // Pending approval
      startDate: new Date()
    });
    
    console.log(`🆕 New registration: ${email} - Pending approval`);
    
    // Don't generate token yet - account needs approval
    res.status(201).json({
      status: 'success',
      message: 'Registration successful! Your account is pending admin approval. You will receive an email once approved.',
      data: {
        user: {
          name: user.name,
          email: user.email,
          status: 'pending'
        }
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check if email and password are provided
    if (!email || !password) {
      return res.status(400).json({
        status: 'fail',
        message: 'Please provide email and password'
      });
    }
    
    // Check if user exists - include lockout fields
    const user = await User.findOne({ email }).select('+password +loginAttempts +lockUntil +lastFailedLogin');
    
    if (!user) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid credentials'
      });
    }
    
    // Check if account is locked
    if (user.isLocked) {
      const lockTimeRemaining = Math.ceil((user.lockUntil - Date.now()) / 60000); // minutes
      console.log(`🔒 Login attempt on locked account: ${user.email}`);
      return res.status(423).json({
        status: 'fail',
        message: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${lockTimeRemaining} minutes.`,
        lockUntil: user.lockUntil,
        remainingMinutes: lockTimeRemaining
      });
    }
    
    // Check if password matches
    const isMatch = await user.matchPassword(password);
    
    if (!isMatch) {
      // Increment login attempts
      await user.incLoginAttempts();
      
      // Calculate remaining attempts
      const remainingAttempts = Math.max(0, 5 - (user.loginAttempts + 1));
      
      console.log(`❌ Failed login attempt for ${user.email}. Attempts: ${user.loginAttempts + 1}/5`);
      
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid credentials',
        remainingAttempts,
        warning: remainingAttempts <= 2 ? `Account will be locked after ${remainingAttempts} more failed attempt(s)` : undefined
      });
    }
    
    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
      console.log(`✅ Login attempts reset for ${user.email}`);
    }
    
    // Check if 2FA is enabled
    const twoFactor = await TwoFactor.findByUserId(user._id);
    
    if (twoFactor && twoFactor.isEnabled) {
      // 2FA is enabled - don't issue token yet
      console.log(`🔐 2FA required for ${user.email}`);
      
      return res.status(200).json({
        status: 'success',
        message: 'Password verified. Please enter your 2FA code.',
        requires2FA: true,
        data: {
          userId: user._id,
          email: user.email,
          method: twoFactor.method
        }
      });
    }
    
    // No 2FA - proceed with normal login
    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    
    // Create session
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent') || 'Unknown';
    const tokenExpiry = getTokenExpiry(token);
    
    await Session.createSession(
      user._id,
      token,
      refreshToken,
      ipAddress,
      userAgent,
      24 * 60 * 60 * 1000 // 24 hours
    );
    
    // Enforce concurrent session limit (max 3 active sessions)
    const invalidatedCount = await Session.enforceConcurrentLimit(user._id, 3);
    if (invalidatedCount > 0) {
      console.log(`🔒 Invalidated ${invalidatedCount} old session(s) for ${user.email}`);
    }
    
    console.log(`✅ Successful login: ${user.email}`);
    
    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          profileImage: user.profileImage
        },
        token,
        refreshToken
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
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getMe = async (req, res) => {
  try {
    // User is already available in req.user due to auth middleware
    const user = await User.findById(req.user._id);
    
    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          profileImage: user.profileImage
        }
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
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
exports.logout = async (req, res) => {
  try {
    const token = req.token; // Added by auth middleware
    const tokenExpiry = getTokenExpiry(token);
    
    // Invalidate session
    await Session.invalidateSession(token, 'manual');
    
    // Blacklist token
    await TokenBlacklist.blacklistToken(token, req.user._id, 'logout', tokenExpiry);
    
    console.log(`👋 User logged out: ${req.user.email}`);
    
    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
