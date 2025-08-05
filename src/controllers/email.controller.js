const nodemailer = require('nodemailer');

/**
 * Email Controller for handling email notifications
 */

// Initialize email transporter
let transporter = null;

const initializeTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }
  return transporter;
};

// Generate professional absentee email template
const generateAbsenteeEmailTemplate = (internData, date) => {
  const internName = internData.name || internData.user?.name || 'Team Member';
  const internEmail = internData.email || internData.user?.email || '';
  const internDepartment = internData.department || 'General';
  const internId = internData.id || internData._id || 'N/A';
  const formattedDate = new Date(date).toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const currentTime = new Date().toLocaleString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Attendance Inquiry - CheckMate System</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.7;
          color: #2d3748;
          background-color: #f7fafc;
          padding: 20px;
        }
        .email-container {
          max-width: 650px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .header p {
          font-size: 16px;
          opacity: 0.9;
        }
        .content {
          padding: 40px 30px;
        }
        .greeting {
          font-size: 18px;
          font-weight: 600;
          color: #1a202c;
          margin-bottom: 20px;
        }
        .message {
          font-size: 16px;
          color: #4a5568;
          margin-bottom: 25px;
          line-height: 1.6;
        }
        .details-box {
          background-color: #f8fafc;
          border-left: 4px solid #10b981;
          padding: 20px;
          margin: 25px 0;
          border-radius: 0 8px 8px 0;
        }
        .details-box h3 {
          color: #1a202c;
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 12px;
        }
        .detail-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 14px;
        }
        .detail-label {
          font-weight: 600;
          color: #4a5568;
        }
        .detail-value {
          color: #2d3748;
        }
        .action-section {
          background-color: #edf2f7;
          padding: 25px;
          border-radius: 8px;
          margin: 25px 0;
        }
        .action-section h3 {
          color: #1a202c;
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 15px;
        }
        .action-list {
          list-style: none;
          padding: 0;
        }
        .action-list li {
          padding: 8px 0;
          border-bottom: 1px solid #e2e8f0;
          font-size: 14px;
          color: #4a5568;
        }
        .action-list li:last-child {
          border-bottom: none;
        }
        .footer {
          background-color: #1a202c;
          color: #e2e8f0;
          padding: 25px 30px;
          text-align: center;
        }
        .footer p {
          font-size: 14px;
          margin-bottom: 5px;
        }
        .footer .company {
          font-weight: 600;
          color: #10b981;
        }
        @media (max-width: 600px) {
          .email-container {
            margin: 10px;
            border-radius: 8px;
          }
          .content {
            padding: 25px 20px;
          }
          .header {
            padding: 25px 20px;
          }
          .header h1 {
            font-size: 24px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <h1>📋 CheckMate Attendance System</h1>
          <p>Attendance Inquiry Notice</p>
        </div>
        
        <div class="content">
          <div class="greeting">
            Hello ${internName},
          </div>
          
          <div class="message">
            We hope this message finds you well. We noticed that you were marked as absent on <strong>${formattedDate}</strong> and wanted to follow up to ensure everything is okay.
          </div>
          
          <div class="details-box">
            <h3>📊 Absence Details</h3>
            <div class="detail-item">
              <span class="detail-label">Employee Name:</span>
              <span class="detail-value">${internName}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Employee ID:</span>
              <span class="detail-value">${internId}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Department:</span>
              <span class="detail-value">${internDepartment}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Absence Date:</span>
              <span class="detail-value">${formattedDate}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Email Sent:</span>
              <span class="detail-value">${currentTime}</span>
            </div>
          </div>
          
          <div class="message">
            Your attendance is important to us, and we want to make sure you have the support you need. If your absence was due to illness, personal emergency, or any other circumstances, please let us know so we can assist you appropriately.
          </div>
          
          <div class="action-section">
            <h3>📝 Please Respond With:</h3>
            <ul class="action-list">
              <li>• The reason for your absence on ${formattedDate}</li>
              <li>• Whether you need any support or assistance</li>
              <li>• If this was a planned absence that wasn't properly recorded</li>
              <li>• Any documentation if the absence was medical-related</li>
              <li>• Your expected return date if you're still unable to attend</li>
            </ul>
          </div>
          
          <div class="message">
            Please reply to this email or contact your supervisor as soon as possible. We're here to support you and want to ensure your success in our program.
          </div>
          
          <div class="message">
            If you have any questions or concerns, please don't hesitate to reach out to the HR department or your direct supervisor.
          </div>
          
          <div class="message">
            <strong>Best regards,</strong><br>
            CheckMate Attendance Management Team
          </div>
        </div>
        
        <div class="footer">
          <p class="company">CheckMate System</p>
          <p>Automated Attendance Management</p>
          <p>This is an automated message. Please reply if you need assistance.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * @desc    Send email to absent interns
 * @route   POST /api/email/absent
 * @access  Private
 */
exports.sendAbsenteeEmail = async (req, res) => {
  try {
    const { internId, internData, date, type = 'single' } = req.body;

    // Validate required fields
    if (!internData || !date) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: internData and date'
      });
    }

    // Validate email address
    const email = internData.email || internData.user?.email;
    if (!email) {
      return res.status(400).json({
        status: 'error',
        message: 'No email address found for this intern'
      });
    }

    // Initialize transporter
    const emailTransporter = initializeTransporter();

    let result;

    if (type === 'bulk' && Array.isArray(internData)) {
      // Handle bulk email sending for multiple absent interns
      const results = [];
      
      for (const intern of internData) {
        try {
          const internEmail = intern.email || intern.user?.email;
          if (!internEmail) {
            results.push({
              intern: intern.name || intern.user?.name || 'Unknown',
              email: 'No email',
              success: false,
              error: 'No email address found'
            });
            continue;
          }

          // Create a custom sender that only shows CheckMate
          const mailOptions = {
            from: {
              name: 'CheckMate',
              address: process.env.EMAIL_USER
            },
            to: internEmail,
            subject: `Attendance Inquiry - ${new Date(date).toLocaleDateString()}`,
            html: generateAbsenteeEmailTemplate(intern, date)
          };

          const emailResult = await emailTransporter.sendMail(mailOptions);
          
          results.push({
            intern: intern.name || intern.user?.name || 'Unknown',
            email: internEmail,
            success: true,
            messageId: emailResult.messageId
          });

          // Add delay between emails to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Failed to send email to ${intern.name}:`, error);
          results.push({
            intern: intern.name || intern.user?.name || 'Unknown',
            email: intern.email || intern.user?.email || 'Unknown',
            success: false,
            error: error.message
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      result = {
        success: successCount > 0,
        results,
        summary: {
          total: results.length,
          sent: successCount,
          failed: results.length - successCount
        },
        message: `Sent ${successCount} of ${results.length} emails successfully`
      };
    } else {
      // Handle single email sending
      // Create a custom sender that only shows CheckMate
      const mailOptions = {
        from: {
          name: 'CheckMate',
          address: process.env.EMAIL_USER
        },
        to: email,
        subject: `Attendance Inquiry - ${new Date(date).toLocaleDateString()}`,
        html: generateAbsenteeEmailTemplate(internData, date)
      };

      const emailResult = await emailTransporter.sendMail(mailOptions);
      console.log('Email sent successfully:', emailResult.messageId);
      
      result = {
        success: true,
        messageId: emailResult.messageId,
        message: 'Email sent successfully'
      };
    }

    if (result.success || (Array.isArray(result.results) && result.results.some(r => r.success))) {
      return res.status(200).json({
        status: 'success',
        message: type === 'bulk' ? 'Bulk emails processed' : 'Email sent successfully',
        data: result
      });
    } else {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to send email',
        details: result.error || result
      });
    }

  } catch (error) {
    console.error('Email API error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      details: error.message
    });
  }
};

/**
 * @desc    Test email configuration
 * @route   GET /api/email/test
 * @access  Private
 */
exports.testEmailConfig = async (req, res) => {
  try {
    const emailTransporter = initializeTransporter();
    await emailTransporter.verify();
    
    return res.status(200).json({
      status: 'success',
      message: 'Email configuration is valid'
    });
  } catch (error) {
    console.error('Email configuration test error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Email configuration is invalid',
      details: error.message
    });
  }
};
