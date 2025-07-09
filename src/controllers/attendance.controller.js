const Attendance = require('../models/attendance.model');
const Intern = require('../models/intern.model');

/**
 * @desc    Record attendance check-in
 * @route   POST /api/attendance/check-in
 * @access  Private
 */
exports.checkIn = async (req, res) => {
  try {
    const { internId, signature, location } = req.body;
    
    // Verify intern exists
    const intern = await Intern.findById(internId);
    if (!intern) {
      return res.status(404).json({
        status: 'fail',
        message: 'Intern not found'
      });
    }
    
    // Check if already checked in today
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to beginning of day
    
    const existingAttendance = await Attendance.findOne({
      internId,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) // Next day
      }
    });
    
    if (existingAttendance) {
      return res.status(400).json({
        status: 'fail',
        message: 'Already checked in today'
      });
    }
    
    // Create new attendance record
    const checkInTime = new Date();
    
    // Determine status based on check-in time
    // For example, if check-in is after 9:30 AM, mark as late
    let status = 'present';
    const lateThreshold = new Date(checkInTime);
    lateThreshold.setHours(9, 30, 0, 0); // Set late threshold to 9:30 AM
    
    if (checkInTime > lateThreshold) {
      status = 'late';
    }
    
    const attendance = await Attendance.create({
      internId,
      date: today,
      checkInTime,
      status,
      signature,
      location: location || undefined
    });
    
    res.status(201).json({
      status: 'success',
      data: { attendance }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Record attendance check-out
 * @route   POST /api/attendance/check-out
 * @access  Private
 */
exports.checkOut = async (req, res) => {
  try {
    const { internId, signature, location } = req.body;
    
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to beginning of day
    
    // Find today's attendance record
    const attendance = await Attendance.findOne({
      internId,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) // Next day
      }
    });
    
    if (!attendance) {
      return res.status(404).json({
        status: 'fail',
        message: 'No check-in record found for today'
      });
    }
    
    if (attendance.checkOutTime) {
      return res.status(400).json({
        status: 'fail',
        message: 'Already checked out today'
      });
    }
    
    // Update attendance record with check-out time
    attendance.checkOutTime = new Date();
    
    // Optionally update signature and location
    if (signature) {
      attendance.signature = signature;
    }
    
    if (location) {
      attendance.location = location;
    }
    
    await attendance.save();
    
    res.status(200).json({
      status: 'success',
      data: { attendance }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Get all attendance records
 * @route   GET /api/attendance
 * @access  Private
 */
exports.getAttendanceRecords = async (req, res) => {
  try {
    // Implement pagination and filtering
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    
    // Create query object for filtering
    const filter = {};
    
    // Filter by intern if specified
    if (req.query.internId) {
      filter.internId = req.query.internId;
    }
    
    // Filter by status if specified
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    // Filter by date range
    if (req.query.startDate) {
      filter.date = { $gte: new Date(req.query.startDate) };
    }
    
    if (req.query.endDate) {
      if (!filter.date) {
        filter.date = {};
      }
      filter.date.$lte = new Date(req.query.endDate);
    }
    
    // Execute query with population
    const records = await Attendance.find(filter)
      .populate({
        path: 'internId',
        select: 'internId department',
        populate: {
          path: 'userId',
          select: 'name email'
        }
      })
      .sort({ date: -1, checkInTime: -1 })
      .skip(startIndex)
      .limit(limit);
    
    // Get total count for pagination
    const total = await Attendance.countDocuments(filter);
    
    res.status(200).json({
      status: 'success',
      count: records.length,
      total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      data: { records }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Get today's attendance summary
 * @route   GET /api/attendance/today
 * @access  Private
 */
exports.getTodayAttendance = async (req, res) => {
  try {
    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Beginning of day
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1); // Beginning of next day
    
    // Get all attendance records for today
    const records = await Attendance.find({
      date: {
        $gte: today,
        $lt: tomorrow
      }
    }).populate({
      path: 'internId',
      select: 'internId department',
      populate: {
        path: 'userId',
        select: 'name email'
      }
    });
    
    // Get all interns
    const allInterns = await Intern.find({ status: 'active' })
      .populate('userId', 'name email');
    
    // Calculate summary statistics
    const presentCount = records.filter(r => r.status === 'present').length;
    const lateCount = records.filter(r => r.status === 'late').length;
    const absentCount = allInterns.length - records.length;
    const checkedOutCount = records.filter(r => r.checkOutTime).length;
    
    res.status(200).json({
      status: 'success',
      data: {
        date: today,
        summary: {
          totalInterns: allInterns.length,
          present: presentCount,
          late: lateCount,
          absent: absentCount,
          checkedOut: checkedOutCount,
          attendance: ((presentCount + lateCount) / allInterns.length * 100).toFixed(2) + '%'
        },
        records
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
 * @desc    Get attendance statistics
 * @route   GET /api/attendance/stats
 * @access  Private
 */
exports.getAttendanceStats = async (req, res) => {
  try {
    // Get date range from query or default to last 30 days
    const endDate = new Date();
    const startDate = req.query.startDate 
      ? new Date(req.query.startDate) 
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    
    // Get daily attendance counts
    const dailyStats = await Attendance.aggregate([
      {
        $match: {
          date: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            status: "$status"
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.date": 1 }
      }
    ]);
    
    // Process data for chart format
    const dates = [...new Set(dailyStats.map(item => item._id.date))].sort();
    
    const chartData = dates.map(date => {
      const dayData = {
        date,
        present: 0,
        late: 0,
        absent: 0,
        excused: 0
      };
      
      dailyStats.forEach(stat => {
        if (stat._id.date === date) {
          dayData[stat._id.status] = stat.count;
        }
      });
      
      return dayData;
    });
    
    // Get overall statistics
    const overallStats = await Attendance.aggregate([
      {
        $match: {
          date: {
            $gte: startDate,
            $lte: endDate
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
    
    // Transform stats to object
    const stats = {
      present: 0,
      late: 0,
      absent: 0,
      excused: 0
    };
    
    overallStats.forEach(stat => {
      stats[stat._id] = stat.count;
    });
    
    // Calculate total number of active interns during this period
    const activeInterns = await Intern.countDocuments({
      status: 'active',
      startDate: { $lte: endDate }
    });
    
    // Calculate business days in the range for absent calculation
    const businessDays = getBusinessDays(startDate, endDate);
    const expectedAttendance = activeInterns * businessDays;
    
    // Calculate absent count
    stats.absent = expectedAttendance - (stats.present + stats.late + stats.excused);
    if (stats.absent < 0) stats.absent = 0;
    
    const totalRecords = stats.present + stats.late + stats.absent + stats.excused;
    
    res.status(200).json({
      status: 'success',
      data: {
        period: {
          startDate,
          endDate,
          businessDays
        },
        stats: {
          ...stats,
          total: totalRecords,
          attendanceRate: totalRecords > 0 
            ? ((stats.present + stats.excused) / totalRecords * 100).toFixed(2) + '%' 
            : '0%'
        },
        chartData
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
 * @desc    Get intern's attendance records
 * @route   GET /api/attendance/intern/:internId
 * @access  Private
 */
exports.getInternAttendance = async (req, res) => {
  try {
    const { internId } = req.params;
    
    // Verify intern exists
    const intern = await Intern.findById(internId);
    if (!intern) {
      return res.status(404).json({
        status: 'fail',
        message: 'Intern not found'
      });
    }
    
    // Get date range from query or default to last 30 days
    const endDate = new Date();
    const startDate = req.query.startDate 
      ? new Date(req.query.startDate) 
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    
    // Get attendance records for this intern
    const history = await Attendance.find({
      internId,
      date: {
        $gte: startDate,
        $lte: endDate
      }
    }).sort({ date: -1 });
    
    // Calculate statistics
    const businessDays = getBusinessDays(startDate, endDate);
    
    const stats = {
      present: history.filter(record => record.status === 'present').length,
      late: history.filter(record => record.status === 'late').length,
      absent: 0,
      excused: history.filter(record => record.status === 'excused').length,
      streak: 0
    };
    
    // Calculate absent days (business days minus recorded attendance)
    stats.absent = businessDays - (stats.present + stats.late + stats.excused);
    if (stats.absent < 0) stats.absent = 0;
    
    // Calculate streak (consecutive days present)
    let streak = 0;
    const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Only count streak if intern checked in today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const checkedInToday = sortedHistory.some(record => {
      const recordDate = new Date(record.date);
      recordDate.setHours(0, 0, 0, 0);
      return recordDate.getTime() === today.getTime() && 
        (record.status === 'present' || record.status === 'late');
    });
    
    if (checkedInToday) {
      for (const record of sortedHistory) {
        const recordDate = new Date(record.date);
        recordDate.setHours(0, 0, 0, 0);
        
        // Check if this is a consecutive day (considering weekends)
        if (streak === 0) {
          if (record.status === 'present' || record.status === 'late') {
            streak = 1;
          }
        } else {
          const prevDate = new Date(today);
          prevDate.setDate(today.getDate() - streak);
          prevDate.setHours(0, 0, 0, 0);
          
          // Skip weekends when calculating streak
          while (prevDate.getDay() === 0 || prevDate.getDay() === 6) {
            prevDate.setDate(prevDate.getDate() - 1);
          }
          
          if (recordDate.getTime() === prevDate.getTime() && 
              (record.status === 'present' || record.status === 'late')) {
            streak++;
          } else {
            break;
          }
        }
      }
    }
    
    stats.streak = streak;
    
    res.status(200).json({
      status: 'success',
      data: {
        history,
        stats,
        period: {
          startDate,
          endDate,
          businessDays
        }
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
 * @desc    Get intern's attendance status for today
 * @route   GET /api/attendance/intern/:internId/today
 * @access  Private
 */
exports.getInternTodayStatus = async (req, res) => {
  try {
    const { internId } = req.params;
    
    // Verify intern exists
    const intern = await Intern.findById(internId);
    if (!intern) {
      return res.status(404).json({
        status: 'fail',
        message: 'Intern not found'
      });
    }
    
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find today's attendance record
    const record = await Attendance.findOne({
      internId,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) // Next day
      }
    });
    
    let status = 'not-checked-in';
    if (record) {
      status = record.checkOutTime ? 'checked-out' : 'checked-in';
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        status,
        record
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Helper function to calculate business days between two dates
function getBusinessDays(startDate, endDate) {
  let count = 0;
  const curDate = new Date(startDate.getTime());
  
  while (curDate <= endDate) {
    const dayOfWeek = curDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++; // Skip weekends (0 = Sunday, 6 = Saturday)
    curDate.setDate(curDate.getDate() + 1);
  }
  
  return count;
}
