const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const NotificationScheduler = require('../services/notification.scheduler');
const AbsenceService = require('../services/absence.service');

// Apply authentication middleware to all routes
router.use(protect);

/**
 * @desc    Get scheduler status
 * @route   GET /api/notifications/scheduler/status
 * @access  Private/Admin
 */
router.get('/scheduler/status', async (req, res) => {
  try {
    const status = NotificationScheduler.getStatus();
    
    res.status(200).json({
      status: 'success',
      data: status
    });
  } catch (error) {
    console.error('Get scheduler status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get scheduler status',
      details: error.message
    });
  }
});

/**
 * @desc    Start automatic notification scheduler
 * @route   POST /api/notifications/scheduler/start
 * @access  Private/Admin
 */
router.post('/scheduler/start', async (req, res) => {
  try {
    NotificationScheduler.start();
    
    res.status(200).json({
      status: 'success',
      message: 'Notification scheduler started successfully',
      data: NotificationScheduler.getStatus()
    });
  } catch (error) {
    console.error('Start scheduler error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to start scheduler',
      details: error.message
    });
  }
});

/**
 * @desc    Stop automatic notification scheduler
 * @route   POST /api/notifications/scheduler/stop
 * @access  Private/Admin
 */
router.post('/scheduler/stop', async (req, res) => {
  try {
    NotificationScheduler.stop();
    
    res.status(200).json({
      status: 'success',
      message: 'Notification scheduler stopped successfully',
      data: NotificationScheduler.getStatus()
    });
  } catch (error) {
    console.error('Stop scheduler error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to stop scheduler',
      details: error.message
    });
  }
});

/**
 * @desc    Manually trigger all notification checks
 * @route   POST /api/notifications/trigger/all
 * @access  Private/Admin
 */
router.post('/trigger/all', async (req, res) => {
  try {
    const results = await NotificationScheduler.triggerManualCheck();
    
    res.status(200).json({
      status: 'success',
      message: 'All notification checks completed successfully',
      data: results
    });
  } catch (error) {
    console.error('Manual trigger all error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to trigger notification checks',
      details: error.message
    });
  }
});

/**
 * @desc    Manually trigger specific notification check
 * @route   POST /api/notifications/trigger/:checkType
 * @access  Private/Admin
 */
router.post('/trigger/:checkType', async (req, res) => {
  try {
    const { checkType } = req.params;
    const validCheckTypes = ['absence', 'missedCheckout', 'perfectAttendance'];
    
    if (!validCheckTypes.includes(checkType)) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid check type. Valid types: ${validCheckTypes.join(', ')}`
      });
    }
    
    const results = await NotificationScheduler.triggerSpecificCheck(checkType);
    
    res.status(200).json({
      status: 'success',
      message: `${checkType} check completed successfully`,
      data: results
    });
  } catch (error) {
    console.error(`Manual trigger ${req.params.checkType} error:`, error);
    res.status(500).json({
      status: 'error',
      message: `Failed to trigger ${req.params.checkType} check`,
      details: error.message
    });
  }
});

/**
 * @desc    Get daily absence summary
 * @route   GET /api/notifications/absence/summary
 * @access  Private/Admin
 */
router.get('/absence/summary', async (req, res) => {
  try {
    const results = await AbsenceService.checkDailyAbsences();
    
    res.status(200).json({
      status: 'success',
      message: 'Daily absence summary generated',
      data: results
    });
  } catch (error) {
    console.error('Get absence summary error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get absence summary',
      details: error.message
    });
  }
});

module.exports = router;
