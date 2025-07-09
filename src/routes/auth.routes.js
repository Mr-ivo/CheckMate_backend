const express = require('express');
const router = express.Router();
const { register, login, getMe, logout } = require('../controllers/auth.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// Public routes
router.post('/login', login);

// Protected routes
router.post('/register', protect, authorize('admin'), register);
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);

module.exports = router;
