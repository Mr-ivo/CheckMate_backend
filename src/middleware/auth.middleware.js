const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Session = require('../models/session.model');
const TokenBlacklist = require('../models/tokenBlacklist.model');

// Protect routes - verify token with session and blacklist check
exports.protect = async (req, res, next) => {
  let token;
  
  // Check if authorization header exists and starts with Bearer
  if (
    req.headers.authorization && 
    req.headers.authorization.startsWith('Bearer')
  ) {
    // Get token from header
    token = req.headers.authorization.split(' ')[1];
  }
  
  // Check if token exists
  if (!token) {
    return res.status(401).json({
      status: 'fail',
      message: 'Not authorized to access this route'
    });
  }
  
  try {
    // Check if token is blacklisted
    const isBlacklisted = await TokenBlacklist.isBlacklisted(token);
    if (isBlacklisted) {
      return res.status(401).json({
        status: 'fail',
        message: 'Token has been invalidated. Please login again.'
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user still exists
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        status: 'fail',
        message: 'User belonging to this token no longer exists'
      });
    }
    
    // Check if user account is active
    if (!user.isActive) {
      return res.status(401).json({
        status: 'fail',
        message: 'Your account has been deactivated'
      });
    }
    
    // Validate session (optional but recommended)
    const session = await Session.validateSession(token);
    if (!session) {
      // Session expired or doesn't exist - create warning but allow access
      console.log(`⚠️ No active session found for token, but token is valid`);
    }
    
    // Add user and token to request object
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'fail',
        message: 'Token has expired. Please login again.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    return res.status(401).json({
      status: 'fail',
      message: 'Not authorized to access this route'
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    // Check if user role is included in the authorized roles
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'fail',
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};
