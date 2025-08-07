const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const {
  sendAbsentSMS,
  sendSingleSMS,
  sendBulkSMS,
  testSMS,
  getTwilioAccount,
  testTwilioConfig
} = require('../controllers/sms.controller');

/**
 * SMS Routes with Twilio Support
 * All routes are protected and require authentication
 */

// @route   POST /api/sms/absent
// @desc    Send SMS to absent interns using Twilio
// @access  Private (Admin/Supervisor)
router.post('/absent', protect, sendAbsentSMS);

// @route   POST /api/sms/single
// @desc    Send single SMS to specific intern using Twilio
// @access  Private (Admin/Supervisor)
router.post('/single', protect, sendSingleSMS);

// @route   POST /api/sms/bulk
// @desc    Send bulk SMS notifications using Twilio
// @access  Private (Admin/Supervisor)
router.post('/bulk', protect, sendBulkSMS);

// @route   POST /api/sms/test
// @desc    Test SMS sending functionality using Twilio
// @access  Private (Admin only)
router.post('/test', protect, testSMS);

// @route   GET /api/sms/account
// @desc    Get Twilio account information and balance
// @access  Private (Admin only)
router.get('/account', protect, getTwilioAccount);

// @route   GET /api/sms/config-test
// @desc    Test Twilio configuration
// @access  Private (Admin only)
router.get('/config-test', protect, testTwilioConfig);

module.exports = router;
