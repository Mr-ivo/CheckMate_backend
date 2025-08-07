const Notification = require('../models/notification.model');
const User = require('../models/user.model');

/**
 * Notification Controller for handling notification operations
 */

// Get all notifications for a user
const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const userId = req.user.id;

    const query = { recipient: userId };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('recipient', 'name email')
      .lean();

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ 
      recipient: userId, 
      isRead: false 
    });

    res.status(200).json({
      status: 'success',
      data: {
        notifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        unreadCount
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch notifications',
      details: error.message
    });
  }
};

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipient: userId },
      { 
        isRead: true, 
        readAt: new Date() 
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: notification,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to mark notification as read',
      details: error.message
    });
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await Notification.updateMany(
      { recipient: userId, isRead: false },
      { 
        isRead: true, 
        readAt: new Date() 
      }
    );

    res.status(200).json({
      status: 'success',
      data: {
        modifiedCount: result.modifiedCount
      },
      message: `Marked ${result.modifiedCount} notifications as read`
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to mark all notifications as read',
      details: error.message
    });
  }
};

// Delete notification
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOneAndDelete({
      _id: id,
      recipient: userId
    });

    if (!notification) {
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete notification',
      details: error.message
    });
  }
};

// Create notification (internal use)
const createNotification = async (notificationData) => {
  try {
    const notification = new Notification(notificationData);
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Create notification error:', error);
    throw error;
  }
};

// Notification service functions for generating notifications
const NotificationService = {
  // Create attendance-related notifications
  async createAttendanceNotification(type, internData, additionalData = {}) {
    try {
      console.log('🔔 NotificationService.createAttendanceNotification called');
      console.log('📝 Type:', type);
      console.log('👤 Intern data:', internData);
      console.log('📋 Additional data:', additionalData);
      
      const admins = await User.find({ role: 'admin' });
      console.log('👥 Found admins:', admins.length);
      
      if (admins.length === 0) {
        console.warn('⚠️ No admin users found! Cannot create notifications.');
        return [];
      }
      
      const notifications = [];

      for (const admin of admins) {
        let title, message, actionUrl;
        const internName = internData.userId?.name || internData.name || 'Unknown Intern';

        switch (type) {
          case 'late_checkin':
          case 'late':
            title = additionalData.isManual ? 'Manual Late Marking' : 'Late Check-in Alert';
            message = additionalData.isManual 
              ? `${internName} was manually marked as late by ${additionalData.markedBy || 'Admin'}${additionalData.isBulk ? ' (bulk update)' : ''}` 
              : `${internName} checked in late at ${additionalData.checkInTime}`;
            actionUrl = `/dashboard/attendance?internId=${internData._id}`;
            break;
          case 'missed_checkout':
            title = 'Missed Check-out';
            message = `${internName} forgot to check out yesterday`;
            actionUrl = `/dashboard/attendance?internId=${internData._id}`;
            break;
          case 'absent':
            title = additionalData.isManual ? 'Manual Absent Marking' : 'Intern Absent';
            message = additionalData.isManual 
              ? `${internName} was manually marked as absent by ${additionalData.markedBy || 'Admin'}${additionalData.isBulk ? ' (bulk update)' : ''}` 
              : `${internName} is absent today`;
            actionUrl = `/dashboard/attendance?date=${additionalData.date}`;
            break;
          case 'present':
            title = 'Manual Present Marking';
            message = `${internName} was manually marked as present by ${additionalData.markedBy || 'Admin'}${additionalData.isBulk ? ' (bulk update)' : ''}`;
            actionUrl = `/dashboard/attendance?internId=${internData._id}`;
            break;
          case 'excused':
            title = 'Excused Absence';
            message = `${internName} was marked as excused by ${additionalData.markedBy || 'Admin'}${additionalData.isBulk ? ' (bulk update)' : ''}`;
            actionUrl = `/dashboard/attendance?internId=${internData._id}`;
            break;
          case 'perfect_attendance':
            title = 'Perfect Attendance';
            message = `${internName} has maintained perfect attendance for ${additionalData.days} days`;
            actionUrl = `/dashboard/interns/${internData._id}`;
            break;
          default:
            title = 'Attendance Update';
            message = `Attendance update for ${internName}`;
            actionUrl = `/dashboard/attendance`;
        }

        console.log(`📝 Creating notification for admin: ${admin.name || admin.email}`);
        console.log('📋 Notification data:', {
          title,
          message,
          type: 'attendance',
          priority: type === 'absent' ? 'high' : 'medium',
          recipient: admin._id,
          recipientRole: 'admin'
        });
        
        const notification = await createNotification({
          title,
          message,
          type: 'attendance',
          priority: type === 'absent' ? 'high' : 'medium',
          recipient: admin._id,
          recipientRole: 'admin',
          relatedEntity: {
            entityType: 'intern',
            entityId: internData._id
          },
          actionUrl,
          metadata: {
            internName: internName,
            internId: internData._id,
            ...additionalData
          }
        });
        
        console.log(`✅ Notification created successfully:`, notification._id);
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Create attendance notification error:', error);
      throw error;
    }
  },

  // Create intern-related notifications
  async createInternNotification(type, internData, additionalData = {}) {
    try {
      const admins = await User.find({ role: 'admin' });
      const notifications = [];

      for (const admin of admins) {
        let title, message, actionUrl;

        switch (type) {
          case 'new_intern':
            title = 'New Intern Added';
            message = `${internData.name} has been added to the ${internData.department} team`;
            actionUrl = `/dashboard/interns/${internData._id}`;
            break;
          case 'intern_updated':
            title = 'Intern Profile Updated';
            message = `${internData.name}'s profile has been updated`;
            actionUrl = `/dashboard/interns/${internData._id}`;
            break;
          case 'low_attendance':
            title = 'Low Attendance Alert';
            message = `${internData.name} has low attendance (${additionalData.attendanceRate}%)`;
            actionUrl = `/dashboard/interns/${internData._id}`;
            break;
          default:
            title = 'Intern Update';
            message = `Update for intern ${internData.name}`;
            actionUrl = `/dashboard/interns`;
        }

        const notification = await createNotification({
          title,
          message,
          type: 'intern',
          priority: type === 'low_attendance' ? 'high' : 'medium',
          recipient: admin._id,
          recipientRole: 'admin',
          relatedEntity: {
            entityType: 'intern',
            entityId: internData._id
          },
          actionUrl,
          metadata: {
            internName: internData.name,
            internId: internData._id,
            ...additionalData
          }
        });

        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Create intern notification error:', error);
      throw error;
    }
  },

  // Create system notifications
  async createSystemNotification(title, message, priority = 'medium', metadata = {}) {
    try {
      const admins = await User.find({ role: 'admin' });
      const notifications = [];

      for (const admin of admins) {
        const notification = await createNotification({
          title,
          message,
          type: 'system',
          priority,
          recipient: admin._id,
          recipientRole: 'admin',
          metadata
        });

        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Create system notification error:', error);
      throw error;
    }
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  NotificationService
};
