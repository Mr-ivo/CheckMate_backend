const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
} = require('../controllers/notification.controller');
const { protect } = require('../middleware/auth.middleware');

// Apply authentication middleware to all routes
router.use(protect);

// GET /api/notifications - Get all notifications for authenticated user
router.get('/', getNotifications);

// PUT /api/notifications/:id/read - Mark specific notification as read
router.put('/:id/read', markAsRead);

// PUT /api/notifications/read-all - Mark all notifications as read
router.put('/read-all', markAllAsRead);

// DELETE /api/notifications/:id - Delete specific notification
router.delete('/:id', deleteNotification);

// POST /api/notifications/test - Create test notifications (for development)
router.post('/test', async (req, res) => {
  try {
    const { createNotification } = require('../controllers/notification.controller');
    const userId = req.user.id;
    
    // Create sample notifications
    const testNotifications = [
      {
        title: 'New Intern Joined',
        message: 'John Doe has joined the Mobile Development team',
        type: 'intern',
        priority: 'medium',
        recipient: userId,
        recipientRole: 'admin',
        actionUrl: '/dashboard/interns',
        metadata: {
          internName: 'John Doe',
          department: 'Mobile Development'
        }
      },
      {
        title: 'Late Check-in Alert',
        message: 'Sarah Wilson checked in late at 10:30 AM',
        type: 'attendance',
        priority: 'high',
        recipient: userId,
        recipientRole: 'admin',
        actionUrl: '/dashboard/attendance',
        metadata: {
          internName: 'Sarah Wilson',
          checkInTime: '10:30 AM'
        }
      },
      {
        title: 'System Maintenance',
        message: 'Scheduled system maintenance will occur tonight at 2:00 AM',
        type: 'system',
        priority: 'medium',
        recipient: userId,
        recipientRole: 'admin',
        metadata: {
          maintenanceTime: '2:00 AM'
        }
      },
      {
        title: 'Urgent: Server Issue',
        message: 'Database connection issues detected. Please check immediately.',
        type: 'system',
        priority: 'urgent',
        recipient: userId,
        recipientRole: 'admin',
        actionUrl: '/dashboard/settings',
        metadata: {
          issueType: 'database',
          severity: 'critical'
        }
      },
      {
        title: 'Perfect Attendance',
        message: 'Mike Johnson has maintained perfect attendance for 30 days',
        type: 'attendance',
        priority: 'low',
        recipient: userId,
        recipientRole: 'admin',
        actionUrl: '/dashboard/interns',
        metadata: {
          internName: 'Mike Johnson',
          days: 30
        }
      }
    ];

    const createdNotifications = [];
    for (const notificationData of testNotifications) {
      const notification = await createNotification(notificationData);
      createdNotifications.push(notification);
    }

    res.status(201).json({
      status: 'success',
      message: `Created ${createdNotifications.length} test notifications`,
      data: createdNotifications
    });
  } catch (error) {
    console.error('Create test notifications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create test notifications',
      details: error.message
    });
  }
});

module.exports = router;
