const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Generate a JWT access token for authentication
 * @param {Object} user - User object containing id
 * @returns {String} JWT token
 */
exports.generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '24h' }
  );
};

/**
 * Generate a refresh token (longer expiry)
 * @param {Object} user - User object containing id
 * @returns {String} Refresh token
 */
exports.generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: '7d' } // 7 days
  );
};

/**
 * Verify JWT token
 * @param {String} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
exports.verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

/**
 * Verify refresh token
 * @param {String} token - Refresh token to verify
 * @returns {Object} Decoded token payload
 */
exports.verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
};

/**
 * Decode token without verification (for extracting expiry)
 * @param {String} token - JWT token
 * @returns {Object} Decoded token
 */
exports.decodeToken = (token) => {
  return jwt.decode(token);
};

/**
 * Get token expiry date
 * @param {String} token - JWT token
 * @returns {Date} Expiry date
 */
exports.getTokenExpiry = (token) => {
  const decoded = jwt.decode(token);
  if (decoded && decoded.exp) {
    return new Date(decoded.exp * 1000);
  }
  return null;
};
