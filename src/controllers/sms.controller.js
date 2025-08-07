// SMS functionality has been removed for security and deployment reasons
const Intern = require('../models/intern.model');
const User = require('../models/user.model');

/**
 * Enhanced SMS Controller with Twilio Support
 * Supports both email-to-SMS gateway (US) and Twilio (International/Cameroon)
 */

/**
 * Send SMS to absent interns using Twilio
 * @route POST /api/sms/absent
 */
const sendAbsentSMS = async (req, res) => {
  try {
    const { date, absentInterns } = req.body;

    console.log(`📱 SMS Controller: Sending absent SMS for date: ${date}`);
    console.log(`👥 Absent interns count: ${absentInterns?.length || 0}`);

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required'
      });
    }

    if (!absentInterns || absentInterns.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No absent interns provided'
      });
    }

    const smsResults = [];
    const templates = twilioSMSService.generateSMSTemplates();

    // Process each absent intern
    for (const absentIntern of absentInterns) {
      try {
        // Get full intern details
        const intern = await Intern.findById(absentIntern.internId).populate('userId', 'name email');
        
        if (!intern) {
          console.log(`⚠️ Intern not found: ${absentIntern.internId}`);
          smsResults.push({
            success: false,
            internId: absentIntern.internId,
            error: 'Intern not found'
          });
          continue;
        }

        // Check if intern has phone number
        if (!intern.phone) {
          console.log(`⚠️ Missing phone for intern: ${intern.userId?.name || 'Unknown'}`);
          smsResults.push({
            success: false,
            internId: intern._id,
            internName: intern.userId?.name || 'Unknown',
            error: 'Phone number not provided'
          });
          continue;
        }

        // Generate SMS message
        const internName = intern.userId?.name || 'Student';
        const formattedDate = new Date(date).toLocaleDateString();
        const smsMessage = templates.absent(internName, formattedDate);

        console.log(`📱 Sending Twilio SMS to ${internName} (${intern.phone})`);

        // Send SMS using Twilio (for Cameroon/International)
        const smsResult = await twilioSMSService.sendSMS(
          intern.phone,
          smsMessage,
          '+237' // Cameroon country code
        );

        smsResults.push({
          ...smsResult,
          internId: intern._id,
          internName: internName,
          email: intern.email || intern.userId?.email
        });

      } catch (error) {
        console.error(`❌ Error processing intern ${absentIntern.internId}:`, error);
        smsResults.push({
          success: false,
          internId: absentIntern.internId,
          error: error.message
        });
      }
    }

    // Calculate results summary
    const successCount = smsResults.filter(r => r.success).length;
    const failureCount = smsResults.length - successCount;

    console.log(`📊 SMS Results: ${successCount} sent, ${failureCount} failed`);

    res.status(200).json({
      success: true,
      message: `SMS sent to ${successCount} interns, ${failureCount} failed`,
      results: smsResults,
      summary: {
        total: smsResults.length,
        sent: successCount,
        failed: failureCount
      }
    });

  } catch (error) {
    console.error('❌ SMS Controller Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send SMS notifications',
      error: error.message
    });
  }
};

/**
 * Send single SMS to specific intern using Twilio
 * @route POST /api/sms/single
 */
const sendSingleSMS = async (req, res) => {
  try {
    const { internId, message, messageType = 'custom' } = req.body;

    console.log(`📱 Sending single SMS to intern: ${internId}`);

    if (!internId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Intern ID and message are required'
      });
    }

    // Get intern details
    const intern = await Intern.findById(internId).populate('userId', 'name email');
    
    if (!intern) {
      return res.status(404).json({
        success: false,
        message: 'Intern not found'
      });
    }

    // Check if intern has phone number
    if (!intern.phone) {
      return res.status(400).json({
        success: false,
        message: 'Intern phone number not provided'
      });
    }

    const internName = intern.userId?.name || 'Student';
    
    // Send SMS using Twilio
    const smsResult = await twilioSMSService.sendSMS(
      intern.phone,
      message,
      '+237' // Cameroon country code
    );

    if (smsResult.success) {
      res.status(200).json({
        success: true,
        message: `SMS sent successfully to ${internName}`,
        result: {
          ...smsResult,
          internName: internName,
          email: intern.email || intern.userId?.email
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to send SMS',
        error: smsResult.error
      });
    }

  } catch (error) {
    console.error('❌ Single SMS Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send SMS',
      error: error.message
    });
  }
};

/**
 * Send bulk SMS notifications using Twilio
 * @route POST /api/sms/bulk
 */
const sendBulkSMS = async (req, res) => {
  try {
    const { recipients } = req.body; // Array of {internId, message, messageType}

    console.log(`📱 Sending bulk SMS to ${recipients?.length || 0} recipients`);

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Recipients array is required'
      });
    }

    const smsRecipients = [];

    // Process each recipient to get phone info
    for (const recipient of recipients) {
      try {
        const intern = await Intern.findById(recipient.internId).populate('userId', 'name email');
        
        if (!intern) {
          console.log(`⚠️ Intern not found: ${recipient.internId}`);
          continue;
        }

        if (!intern.phone) {
          console.log(`⚠️ Missing phone for: ${intern.userId?.name}`);
          continue;
        }

        smsRecipients.push({
          phoneNumber: intern.phone,
          message: recipient.message,
          internId: intern._id,
          internName: intern.userId?.name || 'Student'
        });

      } catch (error) {
        console.error(`❌ Error processing recipient ${recipient.internId}:`, error);
      }
    }

    if (smsRecipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid recipients found with phone numbers'
      });
    }

    // Send bulk SMS using Twilio
    const results = await twilioSMSService.sendBulkSMS(smsRecipients, '+237');

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    res.status(200).json({
      success: true,
      message: `Bulk SMS completed: ${successCount} sent, ${failureCount} failed`,
      results: results,
      summary: {
        total: results.length,
        sent: successCount,
        failed: failureCount
      }
    });

  } catch (error) {
    console.error('❌ Bulk SMS Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send bulk SMS',
      error: error.message
    });
  }
};

/**
 * Test SMS sending functionality using Twilio
 * @route POST /api/sms/test
 */
const testSMS = async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required for testing'
      });
    }

    console.log(`🧪 Testing Twilio SMS to ${phoneNumber}`);

    const templates = twilioSMSService.generateSMSTemplates();
    const testMessage = message || templates.test('Test User');

    const result = await twilioSMSService.sendSMS(phoneNumber, testMessage, '+237');

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Test SMS sent successfully',
        result: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Test SMS failed',
        error: result.error
      });
    }

  } catch (error) {
    console.error('❌ Test SMS Error:', error);
    res.status(500).json({
      success: false,
      message: 'SMS test failed',
      error: error.message
    });
  }
};

/**
 * Get Twilio account information and balance
 * @route GET /api/sms/account
 */
const getTwilioAccount = async (req, res) => {
  try {
    const accountInfo = await twilioSMSService.getAccountInfo();
    
    if (accountInfo.success) {
      res.status(200).json({
        success: true,
        message: 'Twilio account information retrieved',
        data: accountInfo
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to get account information',
        error: accountInfo.error
      });
    }

  } catch (error) {
    console.error('❌ Get Account Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get account information',
      error: error.message
    });
  }
};

/**
 * Test Twilio configuration
 * @route GET /api/sms/config-test
 */
const testTwilioConfig = async (req, res) => {
  try {
    const configTest = await twilioSMSService.testConfiguration();
    
    if (configTest.success) {
      res.status(200).json({
        success: true,
        message: 'Twilio configuration is valid',
        data: configTest
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Twilio configuration is invalid',
        error: configTest.error
      });
    }

  } catch (error) {
    console.error('❌ Config Test Error:', error);
    res.status(500).json({
      success: false,
      message: 'Configuration test failed',
      error: error.message
    });
  }
};

module.exports = {
  sendAbsentSMS,
  sendSingleSMS,
  sendBulkSMS,
  testSMS,
  getTwilioAccount,
  testTwilioConfig
};
