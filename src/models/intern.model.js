const mongoose = require('mongoose');

const internSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  internId: {
    type: String,
    required: [true, 'Intern ID is required'],
    unique: true,
    trim: true
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    trim: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  supervisor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'terminated'],
    default: 'active'
  },
  attendanceRate: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Virtual for calculating attendance rate
internSchema.virtual('calculatedAttendanceRate').get(function() {
  // This would normally be calculated based on actual attendance records
  // For now, we'll just return the stored value
  return this.attendanceRate;
});

// Set toJSON option to include virtuals
internSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

const Intern = mongoose.model('Intern', internSchema);

module.exports = Intern;
