const express = require('express');
const router = express.Router();
const { register, login, getMe, logout } = require('../controllers/auth.controller');
const { loginWith2FA } = require('../controllers/auth2FA.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimiter.middleware');

// Public routes - with strict rate limiting
router.post('/login', authLimiter, login);
router.post('/login-2fa', authLimiter, loginWith2FA);
router.post('/register', authLimiter, register); // Public self-registration

// Protected routes
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);

module.exports = router;
