const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { NotificationService } = require('../controllers/notification.controller');
const Intern = require('../models/intern.model');

// Apply authentication middleware
router.use(protect);

/**
 * @desc    Test notification creation
 * @route   POST /api/test/notification
 * @access  Private/Admin
 */
router.post('/notification', async (req, res) => {
  try {
    console.log('🧪 Testing notification creation...');
    
    // Get a sample intern for testing
    const sampleIntern = await Intern.findOne().populate('userId', 'name email');
    
    if (!sampleIntern) {
      return res.status(404).json({
        status: 'error',
        message: 'No intern found for testing. Please add an intern first.'
      });
    }
    
    console.log('📝 Sample intern found:', {
      id: sampleIntern._id,
      name: sampleIntern.userId?.name || sampleIntern.name || 'Unknown',
      userId: sampleIntern.userId
    });
    
    // Create a test notification
    const notifications = await NotificationService.createAttendanceNotification(
      'absent',
      sampleIntern,
      {
        date: new Date(),
        markedBy: req.user?.name || 'Test Admin',
        isManual: true,
        isTest: true
      }
    );
    
    console.log('✅ Test notification created successfully:', notifications.length, 'notifications');
    
    res.status(200).json({
      status: 'success',
      message: 'Test notification created successfully',
      data: {
        notificationsCreated: notifications.length,
        sampleIntern: {
          id: sampleIntern._id,
          name: sampleIntern.userId?.name || sampleIntern.name || 'Unknown'
        },
        notifications: notifications.map(n => ({
          id: n._id,
          title: n.title,
          message: n.message,
          type: n.type,
          priority: n.priority
        }))
      }
    });
  } catch (error) {
    console.error('❌ Test notification creation failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Test notification creation failed',
      details: error.message,
      stack: error.stack
    });
  }
});

/**
 * @desc    Test intern data structure
 * @route   GET /api/test/intern-data
 * @access  Private/Admin
 */
router.get('/intern-data', async (req, res) => {
  try {
    console.log('🧪 Testing intern data structure...');
    
    // Get sample interns with populated data
    const interns = await Intern.find().limit(3).populate('userId', 'name email');
    
    console.log('📝 Sample interns found:', interns.length);
    
    const internData = interns.map(intern => ({
      id: intern._id,
      internId: intern.internId,
      department: intern.department,
      userId: intern.userId,
      userName: intern.userId?.name,
      userEmail: intern.userId?.email,
      rawIntern: intern
    }));
    
    res.status(200).json({
      status: 'success',
      message: 'Intern data retrieved successfully',
      data: {
        count: interns.length,
        interns: internData
      }
    });
  } catch (error) {
    console.error('❌ Intern data test failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Intern data test failed',
      details: error.message
    });
  }
});

module.exports = router;
