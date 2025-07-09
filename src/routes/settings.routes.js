const express = require('express');
const router = express.Router();

const {
  getSettings,
  updateSettings,
  uploadLogo,
  resetSettings
} = require('../controllers/settings.controller');

const { protect, authorize } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(protect);

// Admin only routes
router.get('/', authorize('admin'), getSettings);
router.put('/', authorize('admin'), updateSettings);
router.post('/logo', authorize('admin'), uploadLogo);
router.post('/reset', authorize('admin'), resetSettings);

module.exports = router;
