const Intern = require('../models/intern.model');
const Attendance = require('../models/attendance.model');
const { NotificationService } = require('../controllers/notification.controller');

/**
 * Automatic Absence Detection Service
 * This service runs daily to check for absent interns and create notifications
 */

class AbsenceService {
  /**
   * Check for absent interns and create notifications
   * This function should be called daily (e.g., via cron job or scheduled task)
   */
  static async checkDailyAbsences() {
    try {
      console.log('🔍 Starting daily absence check...');
      
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to beginning of day
      const endOfDay = new Date(today.getTime() + 24 * 60 * 60 * 1000); // End of day
      
      // Get all active interns
      const allInterns = await Intern.find({ status: 'active' })
        .populate('userId', 'name email');
      
      console.log(`📊 Found ${allInterns.length} active interns to check`);
      
      // Get all attendance records for today
      const todayAttendance = await Attendance.find({
        date: {
          $gte: today,
          $lt: endOfDay
        }
      });
      
      // Create a set of intern IDs who have attendance records today
      const presentInternIds = new Set(
        todayAttendance.map(record => record.internId.toString())
      );
      
      // Find absent interns (those without attendance records)
      const absentInterns = allInterns.filter(intern => 
        !presentInternIds.has(intern._id.toString())
      );
      
      console.log(`❌ Found ${absentInterns.length} absent interns`);
      
      // Create notifications for absent interns
      let notificationsCreated = 0;
      for (const intern of absentInterns) {
        try {
          await NotificationService.createAttendanceNotification(
            'absent',
            {
              _id: intern._id,
              name: intern.userId?.name || intern.name || 'Unknown',
              department: intern.department
            },
            {
              date: today.toISOString().split('T')[0],
              checkTime: new Date().toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
              })
            }
          );
          notificationsCreated++;
          console.log(`📢 Created absence notification for ${intern.userId?.name || intern.name}`);
        } catch (notificationError) {
          console.error(`Failed to create absence notification for ${intern.userId?.name}:`, notificationError);
        }
      }
      
      console.log(`✅ Daily absence check completed. Created ${notificationsCreated} notifications.`);
      
      return {
        totalInterns: allInterns.length,
        presentInterns: presentInternIds.size,
        absentInterns: absentInterns.length,
        notificationsCreated
      };
      
    } catch (error) {
      console.error('❌ Error in daily absence check:', error);
      throw error;
    }
  }

  /**
   * Check for missed check-outs from previous day
   * This function checks if interns who checked in yesterday forgot to check out
   */
  static async checkMissedCheckouts() {
    try {
      console.log('🔍 Checking for missed check-outs...');
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const endOfYesterday = new Date(yesterday.getTime() + 24 * 60 * 60 * 1000);
      
      // Find attendance records from yesterday that have check-in but no check-out
      const missedCheckouts = await Attendance.find({
        date: {
          $gte: yesterday,
          $lt: endOfYesterday
        },
        checkInTime: { $exists: true },
        checkOutTime: { $exists: false }
      }).populate('internId', 'name department userId')
        .populate({
          path: 'internId',
          populate: {
            path: 'userId',
            select: 'name email'
          }
        });
      
      console.log(`⏰ Found ${missedCheckouts.length} missed check-outs`);
      
      // Create notifications for missed check-outs
      let notificationsCreated = 0;
      for (const record of missedCheckouts) {
        try {
          const internName = record.internId?.userId?.name || record.internId?.name || 'Unknown';
          
          await NotificationService.createAttendanceNotification(
            'missed_checkout',
            {
              _id: record.internId._id,
              name: internName,
              department: record.internId.department
            },
            {
              date: yesterday.toISOString().split('T')[0],
              checkInTime: record.checkInTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
              })
            }
          );
          notificationsCreated++;
          console.log(`📢 Created missed check-out notification for ${internName}`);
        } catch (notificationError) {
          console.error(`Failed to create missed check-out notification:`, notificationError);
        }
      }
      
      console.log(`✅ Missed check-out check completed. Created ${notificationsCreated} notifications.`);
      
      return {
        missedCheckouts: missedCheckouts.length,
        notificationsCreated
      };
      
    } catch (error) {
      console.error('❌ Error in missed check-out check:', error);
      throw error;
    }
  }

  /**
   * Check for perfect attendance milestones
   * This function checks if any intern has achieved perfect attendance milestones
   */
  static async checkPerfectAttendance() {
    try {
      console.log('🏆 Checking for perfect attendance milestones...');
      
      const milestones = [7, 14, 30, 60, 90]; // Days to celebrate
      const today = new Date();
      
      // Get all active interns
      const allInterns = await Intern.find({ status: 'active' })
        .populate('userId', 'name email');
      
      let notificationsCreated = 0;
      
      for (const intern of allInterns) {
        try {
          // Calculate consecutive attendance days
          const consecutiveDays = await this.calculateConsecutiveAttendanceDays(intern._id);
          
          // Check if this is a milestone day
          if (milestones.includes(consecutiveDays)) {
            await NotificationService.createAttendanceNotification(
              'perfect_attendance',
              {
                _id: intern._id,
                name: intern.userId?.name || intern.name || 'Unknown',
                department: intern.department
              },
              {
                days: consecutiveDays,
                milestone: true
              }
            );
            notificationsCreated++;
            console.log(`🏆 Created perfect attendance notification for ${intern.userId?.name} (${consecutiveDays} days)`);
          }
        } catch (error) {
          console.error(`Error checking perfect attendance for ${intern.userId?.name}:`, error);
        }
      }
      
      console.log(`✅ Perfect attendance check completed. Created ${notificationsCreated} notifications.`);
      
      return { notificationsCreated };
      
    } catch (error) {
      console.error('❌ Error in perfect attendance check:', error);
      throw error;
    }
  }

  /**
   * Calculate consecutive attendance days for an intern
   */
  static async calculateConsecutiveAttendanceDays(internId) {
    try {
      const today = new Date();
      let consecutiveDays = 0;
      let currentDate = new Date(today);
      
      // Go back day by day and count consecutive attendance
      for (let i = 0; i < 365; i++) { // Check up to 1 year back
        currentDate.setDate(currentDate.getDate() - 1);
        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        
        // Skip weekends (optional - adjust based on your business rules)
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday = 0, Saturday = 6
          continue;
        }
        
        const attendance = await Attendance.findOne({
          internId,
          date: {
            $gte: dayStart,
            $lt: dayEnd
          },
          status: { $in: ['present', 'late'] } // Count both present and late as attendance
        });
        
        if (attendance) {
          consecutiveDays++;
        } else {
          break; // Stop counting if we find a day without attendance
        }
      }
      
      return consecutiveDays;
    } catch (error) {
      console.error('Error calculating consecutive attendance days:', error);
      return 0;
    }
  }

  /**
   * Run all automatic checks
   * This is the main function that should be called by the scheduler
   */
  static async runAllChecks() {
    try {
      console.log('🚀 Starting all automatic notification checks...');
      
      const results = {
        timestamp: new Date(),
        absenceCheck: await this.checkDailyAbsences(),
        missedCheckoutCheck: await this.checkMissedCheckouts(),
        perfectAttendanceCheck: await this.checkPerfectAttendance()
      };
      
      console.log('✅ All automatic checks completed:', results);
      return results;
      
    } catch (error) {
      console.error('❌ Error running automatic checks:', error);
      throw error;
    }
  }
}

module.exports = AbsenceService;
