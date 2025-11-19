const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const {
  enable2FA,
  disable2FA,
  get2FAStatus,
  sendOTP,
  verifyOTP,
  verifyBackupCode,
  regenerateBackupCodes
} = require('../controllers/twoFactor.controller');

// Public routes (for login flow)
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/verify-backup', verifyBackupCode);

// Protected routes (require authentication)
router.use(protect);

router.get('/status', get2FAStatus);
router.post('/enable', enable2FA);
router.post('/disable', disable2FA);
router.post('/regenerate-backup-codes', regenerateBackupCodes);

module.exports = router;
