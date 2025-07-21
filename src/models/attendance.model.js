const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  internId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Intern',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  checkInTime: {
    type: Date,
    required: true
  },
  checkOutTime: {
    type: Date
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'excused'],
    default: 'present'
  },
  signature: {
    type: String,  // Store digital signature as base64 string
    required: function() {
      // Only require signature for self check-in, not for admin-managed attendance
      return !this.notes || !this.notes.includes('Admin marked attendance');
    }
  },
  location: {
    latitude: {
      type: Number
    },
    longitude: {
      type: Number
    }
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Compound index for querying by internId and date
attendanceSchema.index({ internId: 1, date: 1 });

// Define a static method to get attendance by date range
attendanceSchema.statics.getByDateRange = async function(internId, startDate, endDate) {
  return this.find({
    internId: internId,
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ date: 1 });
};

// Define a static method to calculate attendance stats for an intern
attendanceSchema.statics.calculateStats = async function(internId, startDate, endDate) {
  const stats = await this.aggregate([
    {
      $match: {
        internId: new mongoose.Types.ObjectId(internId),
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 }
      }
    }
  ]);

  // Transform the results to a more usable format
  const result = {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    total: 0
  };

  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
  });

  // Calculate attendance rate (present + excused) / total
  result.attendanceRate = result.total > 0 
    ? ((result.present + result.excused) / result.total) * 100 
    : 0;

  return result;
};

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;
