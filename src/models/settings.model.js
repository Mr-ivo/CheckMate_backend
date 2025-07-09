const mongoose = require('mongoose');

/**
 * Settings Schema
 */
const SettingsSchema = new mongoose.Schema({
  organization: {
    name: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true
    },
    logo: {
      type: String,
      default: '/images/default-logo.png'
    },
    address: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      match: [
        /^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/,
        'Please provide a valid email'
      ],
      trim: true
    },
    phone: {
      type: String,
      trim: true
    }
  },
  attendance: {
    workingHours: {
      start: {
        type: String,
        default: '09:00'
      },
      end: {
        type: String,
        default: '17:00'
      }
    },
    lateThreshold: {
      type: Number,
      default: 15,
      min: 0,
      max: 60,
      description: 'Minutes after start time before an intern is marked as late'
    },
    graceTime: {
      type: Number,
      default: 5,
      min: 0,
      max: 30,
      description: 'Minutes of grace period after start time'
    },
    workingDays: {
      monday: {
        type: Boolean,
        default: true
      },
      tuesday: {
        type: Boolean,
        default: true
      },
      wednesday: {
        type: Boolean,
        default: true
      },
      thursday: {
        type: Boolean,
        default: true
      },
      friday: {
        type: Boolean,
        default: true
      },
      saturday: {
        type: Boolean,
        default: false
      },
      sunday: {
        type: Boolean,
        default: false
      }
    }
  },
  notifications: {
    email: {
      dailyReport: {
        type: Boolean,
        default: true
      },
      weeklyReport: {
        type: Boolean,
        default: true
      },
      lateArrivals: {
        type: Boolean,
        default: true
      },
      absentees: {
        type: Boolean,
        default: true
      }
    },
    recipients: [{
      type: String,
      match: [
        /^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/,
        'Please provide a valid email'
      ]
    }]
  },
  system: {
    dateFormat: {
      type: String,
      enum: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'],
      default: 'YYYY-MM-DD'
    },
    timeFormat: {
      type: String,
      enum: ['12h', '24h'],
      default: '24h'
    },
    defaultTheme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
    language: {
      type: String,
      enum: ['en', 'fr', 'es'],
      default: 'en'
    }
  },
  created: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

/**
 * Update the lastUpdated field on save
 */
SettingsSchema.pre('save', function (next) {
  this.lastUpdated = Date.now();
  next();
});

module.exports = mongoose.model('Settings', SettingsSchema);
