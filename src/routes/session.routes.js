const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const {
  getMySessions,
  logoutSession,
  logoutAllSessions,
  refreshToken,
  getAllSessions,
  forceLogoutUser
} = require('../controllers/session.controller');

// Public routes
router.post('/refresh', refreshToken);

// Protected routes - user's own sessions
router.use(protect);
router.get('/', getMySessions);
router.delete('/:sessionId', logoutSession);
router.post('/logout-all', logoutAllSessions);

// Admin only routes
router.get('/all', authorize('admin'), getAllSessions);
router.post('/force-logout/:userId', authorize('admin'), forceLogoutUser);

module.exports = router;
