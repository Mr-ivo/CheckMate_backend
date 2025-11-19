const Session = require('../models/session.model');
const TokenBlacklist = require('../models/tokenBlacklist.model');
const { generateToken, generateRefreshToken, verifyRefreshToken, getTokenExpiry } = require('../utils/jwt.utils');
const User = require('../models/user.model');

/**
 * @desc    Get all active sessions for current user
 * @route   GET /api/sessions
 * @access  Private
 */
exports.getMySessions = async (req, res) => {
  try {
    const sessions = await Session.getActiveSessions(req.user._id);
    
    res.status(200).json({
      status: 'success',
      data: {
        sessions,
        count: sessions.length
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
 * @desc    Logout from specific session
 * @route   DELETE /api/sessions/:sessionId
 * @access  Private
 */
exports.logoutSession = async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId);
    
    if (!session) {
      return res.status(404).json({
        status: 'fail',
        message: 'Session not found'
      });
    }
    
    // Ensure user can only logout their own sessions
    if (session.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to logout this session'
      });
    }
    
    // Invalidate session
    await Session.invalidateSession(session.token, 'manual');
    
    // Blacklist token
    const tokenExpiry = getTokenExpiry(session.token);
    await TokenBlacklist.blacklistToken(session.token, req.user._id, 'logout', tokenExpiry);
    
    res.status(200).json({
      status: 'success',
      message: 'Session logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Logout from all sessions (except current)
 * @route   POST /api/sessions/logout-all
 * @access  Private
 */
exports.logoutAllSessions = async (req, res) => {
  try {
    const currentToken = req.token;
    
    // Get all active sessions
    const sessions = await Session.find({
      userId: req.user._id,
      isActive: true,
      token: { $ne: currentToken } // Exclude current session
    });
    
    // Invalidate all sessions except current
    await Session.invalidateAllUserSessions(req.user._id, 'forced');
    
    // Blacklist all tokens
    for (const session of sessions) {
      const tokenExpiry = getTokenExpiry(session.token);
      await TokenBlacklist.blacklistToken(session.token, req.user._id, 'security', tokenExpiry);
    }
    
    // Recreate current session to keep it active
    await Session.updateOne(
      { token: currentToken },
      { $set: { isActive: true, logoutAt: null, logoutReason: null } }
    );
    
    res.status(200).json({
      status: 'success',
      message: `Logged out from ${sessions.length} other session(s)`,
      loggedOutCount: sessions.length
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Refresh access token using refresh token
 * @route   POST /api/sessions/refresh
 * @access  Public
 */
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        status: 'fail',
        message: 'Refresh token is required'
      });
    }
    
    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);
    
    // Find session with this refresh token
    const session = await Session.findOne({
      refreshToken,
      isActive: true,
      expiresAt: { $gt: new Date() }
    });
    
    if (!session) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid or expired refresh token'
      });
    }
    
    // Get user
    const user = await User.findById(decoded.id);
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not found or inactive'
      });
    }
    
    // Generate new access token
    const newToken = generateToken(user);
    const tokenExpiry = getTokenExpiry(newToken);
    
    // Update session with new token
    session.token = newToken;
    session.lastActivity = new Date();
    await session.save();
    
    console.log(`🔄 Token refreshed for user: ${user.email}`);
    
    res.status(200).json({
      status: 'success',
      data: {
        token: newToken,
        expiresAt: tokenExpiry
      }
    });
  } catch (error) {
    res.status(401).json({
      status: 'fail',
      message: 'Invalid or expired refresh token'
    });
  }
};

/**
 * @desc    Get all sessions (admin only)
 * @route   GET /api/sessions/all
 * @access  Private/Admin
 */
exports.getAllSessions = async (req, res) => {
  try {
    const { page = 1, limit = 50, userId, isActive } = req.query;
    
    const query = {};
    if (userId) query.userId = userId;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
    const sessions = await Session.find(query)
      .sort({ lastActivity: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('userId', 'name email role');
    
    const count = await Session.countDocuments(query);
    
    res.status(200).json({
      status: 'success',
      data: {
        sessions,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        totalSessions: count
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
 * @desc    Force logout user (admin only)
 * @route   POST /api/sessions/force-logout/:userId
 * @access  Private/Admin
 */
exports.forceLogoutUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get all active sessions for user
    const sessions = await Session.find({
      userId,
      isActive: true
    });
    
    // Invalidate all sessions
    await Session.invalidateAllUserSessions(userId, 'forced');
    
    // Blacklist all tokens
    for (const session of sessions) {
      const tokenExpiry = getTokenExpiry(session.token);
      await TokenBlacklist.blacklistToken(session.token, userId, 'admin_action', tokenExpiry);
    }
    
    console.log(`🔒 Admin forced logout for user: ${userId}`);
    
    res.status(200).json({
      status: 'success',
      message: `Forced logout from ${sessions.length} session(s)`,
      loggedOutCount: sessions.length
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
