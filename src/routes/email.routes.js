const express = require('express');
const router = express.Router();
const emailController = require('../controllers/email.controller');
const { protect } = require('../middleware/auth.middleware');

// @route   POST /api/email/absent
// @desc    Send email to absent interns
// @access  Private
router.post('/absent', protect, emailController.sendAbsenteeEmail);

// @route   GET /api/email/test
// @desc    Test email configuration
// @access  Private
router.get('/test', protect, emailController.testEmailConfig);

module.exports = router;
