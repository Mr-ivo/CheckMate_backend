const cron = require('node-cron');
const AbsenceService = require('./absence.service');

/**
 * Automatic Notification Scheduler
 * This service sets up automatic daily checks for notifications
 */

class NotificationScheduler {
  static isRunning = false;
  static scheduledTasks = [];

  /**
   * Start all automatic notification checks
   */
  static start() {
    if (this.isRunning) {
      console.log('⚠️ Notification scheduler is already running');
      return;
    }

    console.log('🚀 Starting automatic notification scheduler...');

    // Schedule daily absence check at 10:00 AM every day
    const absenceCheckTask = cron.schedule('0 10 * * *', async () => {
      try {
        console.log('⏰ Running scheduled absence check...');
        await AbsenceService.checkDailyAbsences();
      } catch (error) {
        console.error('❌ Error in scheduled absence check:', error);
      }
    }, {
      scheduled: false,
      timezone: "Africa/Lagos" // Adjust timezone as needed
    });

    // Schedule missed checkout check at 8:00 AM every day (for previous day)
    const missedCheckoutTask = cron.schedule('0 8 * * *', async () => {
      try {
        console.log('⏰ Running scheduled missed checkout check...');
        await AbsenceService.checkMissedCheckouts();
      } catch (error) {
        console.error('❌ Error in scheduled missed checkout check:', error);
      }
    }, {
      scheduled: false,
      timezone: "Africa/Lagos" // Adjust timezone as needed
    });

    // Schedule perfect attendance check at 6:00 PM every day
    const perfectAttendanceTask = cron.schedule('0 18 * * *', async () => {
      try {
        console.log('⏰ Running scheduled perfect attendance check...');
        await AbsenceService.checkPerfectAttendance();
      } catch (error) {
        console.error('❌ Error in scheduled perfect attendance check:', error);
      }
    }, {
      scheduled: false,
      timezone: "Africa/Lagos" // Adjust timezone as needed
    });

    // Schedule comprehensive check at 11:00 PM every day
    const comprehensiveCheckTask = cron.schedule('0 23 * * *', async () => {
      try {
        console.log('⏰ Running comprehensive daily check...');
        await AbsenceService.runAllChecks();
      } catch (error) {
        console.error('❌ Error in comprehensive daily check:', error);
      }
    }, {
      scheduled: false,
      timezone: "Africa/Lagos" // Adjust timezone as needed
    });

    // Start all tasks
    absenceCheckTask.start();
    missedCheckoutTask.start();
    perfectAttendanceTask.start();
    comprehensiveCheckTask.start();

    // Store tasks for later management
    this.scheduledTasks = [
      { name: 'absenceCheck', task: absenceCheckTask, schedule: '10:00 AM daily' },
      { name: 'missedCheckout', task: missedCheckoutTask, schedule: '8:00 AM daily' },
      { name: 'perfectAttendance', task: perfectAttendanceTask, schedule: '6:00 PM daily' },
      { name: 'comprehensiveCheck', task: comprehensiveCheckTask, schedule: '11:00 PM daily' }
    ];

    this.isRunning = true;
    console.log('✅ Automatic notification scheduler started successfully!');
    console.log('📅 Scheduled tasks:');
    this.scheduledTasks.forEach(({ name, schedule }) => {
      console.log(`   - ${name}: ${schedule}`);
    });
  }

  /**
   * Stop all automatic notification checks
   */
  static stop() {
    if (!this.isRunning) {
      console.log('⚠️ Notification scheduler is not running');
      return;
    }

    console.log('🛑 Stopping automatic notification scheduler...');

    // Stop all scheduled tasks
    this.scheduledTasks.forEach(({ name, task }) => {
      task.stop();
      console.log(`   - Stopped ${name}`);
    });

    this.scheduledTasks = [];
    this.isRunning = false;
    console.log('✅ Notification scheduler stopped successfully');
  }

  /**
   * Get status of the scheduler
   */
  static getStatus() {
    return {
      isRunning: this.isRunning,
      tasksCount: this.scheduledTasks.length,
      tasks: this.scheduledTasks.map(({ name, schedule }) => ({ name, schedule }))
    };
  }

  /**
   * Manually trigger all checks (for testing or immediate execution)
   */
  static async triggerManualCheck() {
    try {
      console.log('🔧 Manually triggering all notification checks...');
      const results = await AbsenceService.runAllChecks();
      console.log('✅ Manual check completed successfully');
      return results;
    } catch (error) {
      console.error('❌ Error in manual check:', error);
      throw error;
    }
  }

  /**
   * Trigger specific check type
   */
  static async triggerSpecificCheck(checkType) {
    try {
      console.log(`🔧 Manually triggering ${checkType} check...`);
      let results;

      switch (checkType) {
        case 'absence':
          results = await AbsenceService.checkDailyAbsences();
          break;
        case 'missedCheckout':
          results = await AbsenceService.checkMissedCheckouts();
          break;
        case 'perfectAttendance':
          results = await AbsenceService.checkPerfectAttendance();
          break;
        default:
          throw new Error(`Unknown check type: ${checkType}`);
      }

      console.log(`✅ ${checkType} check completed successfully`);
      return results;
    } catch (error) {
      console.error(`❌ Error in ${checkType} check:`, error);
      throw error;
    }
  }
}

module.exports = NotificationScheduler;
