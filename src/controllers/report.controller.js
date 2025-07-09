const Report = require('../models/report.model');
const Attendance = require('../models/attendance.model');
const Intern = require('../models/intern.model');

/**
 * @desc    Generate attendance report
 * @route   POST /api/reports/attendance
 * @access  Private
 */
exports.generateAttendanceReport = async (req, res) => {
  try {
    const { title, description, startDate, endDate, internIds } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        status: 'fail',
        message: 'Start date and end date are required'
      });
    }
    
    // Parse dates
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);
    
    // Create filter for attendance records
    const filter = {
      date: {
        $gte: parsedStartDate,
        $lte: parsedEndDate
      }
    };
    
    // Filter by intern IDs if provided
    if (internIds && internIds.length > 0) {
      filter.internId = { $in: internIds };
    }
    
    // Get attendance records
    const attendanceRecords = await Attendance.find(filter)
      .populate({
        path: 'internId',
        select: 'internId department userId',
        populate: {
          path: 'userId',
          select: 'name email'
        }
      });
    
    // Calculate statistics by intern
    const internStats = {};
    attendanceRecords.forEach(record => {
      const internId = record.internId._id.toString();
      
      if (!internStats[internId]) {
        internStats[internId] = {
          intern: {
            id: internId,
            internId: record.internId.internId,
            name: record.internId.userId.name,
            email: record.internId.userId.email,
            department: record.internId.department
          },
          stats: {
            present: 0,
            late: 0,
            absent: 0,
            excused: 0,
            total: 0
          },
          attendanceRate: 0
        };
      }
      
      internStats[internId].stats[record.status]++;
      internStats[internId].stats.total++;
    });
    
    // Calculate business days for absent tracking
    const businessDays = getBusinessDays(parsedStartDate, parsedEndDate);
    
    // Get all interns for absent calculation
    const allInterns = await Intern.find(
      internIds && internIds.length > 0 
        ? { _id: { $in: internIds } } 
        : {}
    ).populate('userId', 'name email');
    
    // Add missing interns and calculate absent days
    allInterns.forEach(intern => {
      const internId = intern._id.toString();
      
      if (!internStats[internId]) {
        internStats[internId] = {
          intern: {
            id: internId,
            internId: intern.internId,
            name: intern.userId.name,
            email: intern.userId.email,
            department: intern.department
          },
          stats: {
            present: 0,
            late: 0,
            absent: businessDays,
            excused: 0,
            total: businessDays
          },
          attendanceRate: 0
        };
      } else {
        // Calculate absent days (expected days - recorded days)
        const recordedDays = internStats[internId].stats.present + 
                            internStats[internId].stats.late + 
                            internStats[internId].stats.excused;
        internStats[internId].stats.absent = businessDays - recordedDays;
        if (internStats[internId].stats.absent < 0) internStats[internId].stats.absent = 0;
        internStats[internId].stats.total = recordedDays + internStats[internId].stats.absent;
      }
      
      // Calculate attendance rate
      const total = internStats[internId].stats.total;
      const present = internStats[internId].stats.present + internStats[internId].stats.excused;
      internStats[internId].attendanceRate = total > 0 
        ? parseFloat(((present / total) * 100).toFixed(2))
        : 0;
    });
    
    // Calculate overall statistics
    const overallStats = {
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      total: 0
    };
    
    Object.values(internStats).forEach(intern => {
      overallStats.present += intern.stats.present;
      overallStats.late += intern.stats.late;
      overallStats.absent += intern.stats.absent;
      overallStats.excused += intern.stats.excused;
      overallStats.total += intern.stats.total;
    });
    
    overallStats.attendanceRate = overallStats.total > 0
      ? parseFloat(((overallStats.present + overallStats.excused) / overallStats.total * 100).toFixed(2))
      : 0;
    
    // Create report
    const report = await Report.create({
      title: title || `Attendance Report ${parsedStartDate.toLocaleDateString()} - ${parsedEndDate.toLocaleDateString()}`,
      description: description || `Attendance report for the period ${parsedStartDate.toLocaleDateString()} to ${parsedEndDate.toLocaleDateString()}`,
      generatedBy: req.user._id,
      reportType: 'attendance',
      dateRange: {
        start: parsedStartDate,
        end: parsedEndDate
      },
      reportData: {
        interns: Object.values(internStats),
        overallStats,
        businessDays,
        totalInterns: allInterns.length
      }
    });
    
    res.status(201).json({
      status: 'success',
      data: { report }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Get all reports
 * @route   GET /api/reports
 * @access  Private
 */
exports.getReports = async (req, res) => {
  try {
    // Implement pagination and filtering
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    
    // Create filter object
    const filter = {};
    
    // Filter by report type if specified
    if (req.query.reportType) {
      filter.reportType = req.query.reportType;
    }
    
    // Filter by date range
    if (req.query.startDate) {
      filter['dateRange.start'] = { $gte: new Date(req.query.startDate) };
    }
    
    if (req.query.endDate) {
      filter['dateRange.end'] = { $lte: new Date(req.query.endDate) };
    }
    
    // Execute query with population
    const reports = await Report.find(filter)
      .populate('generatedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit);
    
    // Get total count for pagination
    const total = await Report.countDocuments(filter);
    
    res.status(200).json({
      status: 'success',
      count: reports.length,
      total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      data: { reports }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Get single report
 * @route   GET /api/reports/:id
 * @access  Private
 */
exports.getReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate('generatedBy', 'name email');
    
    if (!report) {
      return res.status(404).json({
        status: 'fail',
        message: 'Report not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: { report }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Delete report
 * @route   DELETE /api/reports/:id
 * @access  Private/Admin
 */
exports.deleteReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({
        status: 'fail',
        message: 'Report not found'
      });
    }
    
    await Report.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      status: 'success',
      data: null
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
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++; // Skip weekends
    curDate.setDate(curDate.getDate() + 1);
  }
  
  return count;
}
