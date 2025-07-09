const Settings = require('../models/settings.model');

/**
 * @desc    Get application settings
 * @route   GET /api/settings
 * @access  Private (Admin only)
 */
exports.getSettings = async (req, res) => {
  try {
    // There should only be one settings document
    let settings = await Settings.findOne().sort({ created: -1 });
    
    if (!settings) {
      // If no settings exist, create default settings
      settings = await Settings.create({
        organization: {
          name: 'CheckMate Organization',
        },
        createdBy: req.user.id,
        updatedBy: req.user.id
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Update application settings
 * @route   PUT /api/settings
 * @access  Private (Admin only)
 */
exports.updateSettings = async (req, res) => {
  try {
    // Validate the request body
    const { organization, attendance, notifications, system } = req.body;
    
    // There should only be one settings document
    let settings = await Settings.findOne().sort({ created: -1 });
    
    if (!settings) {
      // If no settings exist, create new settings
      settings = new Settings({
        createdBy: req.user.id
      });
    }
    
    // Update settings fields if provided
    if (organization) {
      settings.organization = { 
        ...settings.organization, 
        ...organization 
      };
    }
    
    if (attendance) {
      settings.attendance = { 
        ...settings.attendance, 
        ...attendance,
        workingHours: {
          ...settings.attendance?.workingHours,
          ...attendance.workingHours
        },
        workingDays: {
          ...settings.attendance?.workingDays,
          ...attendance.workingDays
        }
      };
    }
    
    if (notifications) {
      settings.notifications = { 
        ...settings.notifications, 
        ...notifications,
        email: {
          ...settings.notifications?.email,
          ...notifications.email
        }
      };
      
      if (notifications.recipients) {
        settings.notifications.recipients = notifications.recipients;
      }
    }
    
    if (system) {
      settings.system = { 
        ...settings.system, 
        ...system 
      };
    }
    
    // Update metadata
    settings.lastUpdated = Date.now();
    settings.updatedBy = req.user.id;
    
    // Save the updated settings
    await settings.save();
    
    res.status(200).json({
      status: 'success',
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Upload organization logo
 * @route   POST /api/settings/logo
 * @access  Private (Admin only)
 */
exports.uploadLogo = async (req, res) => {
  try {
    // This would normally use multer or another upload middleware
    // For now, we'll just update with a URL if provided
    if (!req.body.logoUrl) {
      return res.status(400).json({
        status: 'fail',
        message: 'No logo URL provided'
      });
    }
    
    // Get settings
    let settings = await Settings.findOne().sort({ created: -1 });
    
    if (!settings) {
      return res.status(404).json({
        status: 'fail',
        message: 'Settings not found'
      });
    }
    
    // Update logo URL
    settings.organization.logo = req.body.logoUrl;
    settings.lastUpdated = Date.now();
    settings.updatedBy = req.user.id;
    
    await settings.save();
    
    res.status(200).json({
      status: 'success',
      data: {
        logo: settings.organization.logo
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Reset settings to defaults
 * @route   POST /api/settings/reset
 * @access  Private (Admin only)
 */
exports.resetSettings = async (req, res) => {
  try {
    // Find current settings
    let settings = await Settings.findOne().sort({ created: -1 });
    
    if (!settings) {
      return res.status(404).json({
        status: 'fail',
        message: 'Settings not found'
      });
    }
    
    // Keep organization name but reset everything else to defaults
    const orgName = settings.organization.name;
    
    // Create new settings with defaults
    const newSettings = new Settings({
      organization: {
        name: orgName
      },
      createdBy: req.user.id,
      updatedBy: req.user.id
    });
    
    // Save new default settings
    await newSettings.save();
    
    // Delete old settings if this is not the first settings document
    if (settings._id.toString() !== newSettings._id.toString()) {
      await Settings.findByIdAndDelete(settings._id);
    }
    
    res.status(200).json({
      status: 'success',
      data: newSettings
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
