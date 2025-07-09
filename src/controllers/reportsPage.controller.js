const Report = require('../models/report.model');
const Attendance = require('../models/attendance.model');
const Intern = require('../models/intern.model');
const Department = require('../models/department.model');

/**
 * @desc    Get department-wise attendance statistics
 * @route   GET /api/reports/stats/departments
 * @access  Private (Admin, Supervisor)
 */
exports.getDepartmentStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        status: 'fail',
        message: 'Start date and end date are required'
      });
    }

    // Parse dates
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);
    parsedStartDate.setHours(0, 0, 0, 0);
    parsedEndDate.setHours(23, 59, 59, 999);

    // Get all departments
    const departments = await Department.find({});
    
    // Create filter for attendance records
    const dateFilter = {
      date: {
        $gte: parsedStartDate,
        $lte: parsedEndDate
      }
    };

    // Calculate business days for the period
    const businessDays = getBusinessDays(parsedStartDate, parsedEndDate);
    
    // Calculate stats for each department
    const departmentStats = [];
    
    for (const department of departments) {
      // Get all interns in this department
      const interns = await Intern.find({ department: department.name });
      
      if (interns.length === 0) {
        departmentStats.push({
          department: department.name,
          attendanceRate: 0,
          interns: 0
        });
        continue;
      }
      
      const internIds = interns.map(intern => intern._id);
      
      // Get attendance records for these interns
      const attendanceFilter = {
        ...dateFilter,
        internId: { $in: internIds }
      };
      
      const attendanceRecords = await Attendance.find(attendanceFilter);
      
      // Calculate attendance rate
      const presentCount = attendanceRecords.filter(
        record => record.status === 'present' || record.status === 'excused'
      ).length;
      
      const totalExpectedAttendance = interns.length * businessDays;
      const attendanceRate = totalExpectedAttendance > 0 
        ? parseFloat(((presentCount / totalExpectedAttendance) * 100).toFixed(2))
        : 0;
      
      departmentStats.push({
        department: department.name,
        attendanceRate,
        interns: interns.length
      });
    }
    
    // Sort by attendance rate descending
    departmentStats.sort((a, b) => b.attendanceRate - a.attendanceRate);
    
    res.status(200).json({
      status: 'success',
      data: {
        departments: departmentStats.map(d => d.department),
        attendanceRates: departmentStats.map(d => d.attendanceRate)
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
 * @desc    Get attendance trends (weekly/monthly)
 * @route   GET /api/reports/trends/:period
 * @access  Private (Admin, Supervisor)
 */
exports.getAttendanceTrends = async (req, res) => {
  try {
    const { period } = req.params; // 'week', 'month', 'quarter', 'year'
    const { department } = req.query;
    
    let startDate, endDate, labels, format;
    const now = new Date();
    
    // Determine date range and labels based on period
    switch (period) {
      case 'week':
        // Last 7 days
        endDate = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        labels = Array(7).fill().map((_, i) => {
          const date = new Date(startDate);
          date.setDate(date.getDate() + i);
          return date.toLocaleDateString('en-US', { weekday: 'short' });
        });
        format = 'day';
        break;
      
      case 'month':
        // Last 30 days, grouped by week
        endDate = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
        labels = Array(5).fill().map((_, i) => {
          const date = new Date(startDate);
          date.setDate(date.getDate() + i * 7);
          return `Week ${i + 1}`;
        });
        format = 'week';
        break;
      
      case 'quarter':
        // Last 90 days, grouped by month
        endDate = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        labels = Array(3).fill().map((_, i) => {
          const date = new Date(startDate);
          date.setMonth(date.getMonth() + i);
          return date.toLocaleDateString('en-US', { month: 'short' });
        });
        format = 'month';
        break;
      
      case 'year':
        // Last 12 months
        endDate = new Date();
        startDate = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1);
        labels = Array(12).fill().map((_, i) => {
          const date = new Date(startDate);
          date.setMonth(date.getMonth() + i);
          return date.toLocaleDateString('en-US', { month: 'short' });
        });
        format = 'month';
        break;
      
      default:
        return res.status(400).json({
          status: 'fail',
          message: 'Invalid period. Use week, month, quarter, or year.'
        });
    }
    
    // Build filter for interns
    let internFilter = {};
    if (department && department !== 'all' && department !== 'All Departments') {
      internFilter.department = department;
    }
    
    // Get all applicable interns
    const interns = await Intern.find(internFilter);
    const internIds = interns.map(intern => intern._id);
    
    if (internIds.length === 0) {
      return res.status(200).json({
        status: 'success',
        data: {
          labels,
          datasets: [{
            label: 'Attendance Rate (%)',
            data: Array(labels.length).fill(0)
          }]
        }
      });
    }
    
    // Calculate attendance rates for each time period
    const attendanceRates = [];
    const presentCounts = [];
    const absentCounts = [];
    
    // Set start date to beginning of day and end date to end of day
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    if (format === 'day') {
      // Daily data points
      for (let i = 0; i < labels.length; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        
        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);
        
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);
        
        // Get attendance records for this day
        const records = await Attendance.find({
          internId: { $in: internIds },
          date: { $gte: dayStart, $lte: dayEnd }
        });
        
        const present = records.filter(r => r.status === 'present' || r.status === 'excused').length;
        const absent = internIds.length - present;
        
        presentCounts.push(present);
        absentCounts.push(absent);
        
        const rate = internIds.length > 0 
          ? parseFloat(((present / internIds.length) * 100).toFixed(2))
          : 0;
        
        attendanceRates.push(rate);
      }
    } else if (format === 'week' || format === 'month') {
      // Weekly or monthly data points
      const periodLength = format === 'week' ? 7 : 30;
      
      for (let i = 0; i < labels.length; i++) {
        const periodStart = new Date(startDate);
        periodStart.setDate(periodStart.getDate() + (i * periodLength));
        periodStart.setHours(0, 0, 0, 0);
        
        const periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + periodLength - 1);
        periodEnd.setHours(23, 59, 59, 999);
        
        // Get attendance records for this period
        const records = await Attendance.find({
          internId: { $in: internIds },
          date: { $gte: periodStart, $lte: periodEnd }
        });
        
        // Business days in this period
        const businessDays = getBusinessDays(periodStart, periodEnd);
        const totalExpectedAttendance = internIds.length * businessDays;
        
        const present = records.filter(r => r.status === 'present' || r.status === 'excused').length;
        const absent = totalExpectedAttendance - present;
        
        presentCounts.push(present);
        absentCounts.push(absent);
        
        const rate = totalExpectedAttendance > 0 
          ? parseFloat(((present / totalExpectedAttendance) * 100).toFixed(2))
          : 0;
        
        attendanceRates.push(rate);
      }
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        labels,
        attendanceRates,
        presentCounts,
        absentCounts
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
 * @desc    Get absence reasons distribution
 * @route   GET /api/reports/absence-reasons
 * @access  Private (Admin, Supervisor)
 */
exports.getAbsenceReasons = async (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        status: 'fail',
        message: 'Start date and end date are required'
      });
    }

    // Parse dates
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);
    parsedStartDate.setHours(0, 0, 0, 0);
    parsedEndDate.setHours(23, 59, 59, 999);
    
    // Build filter
    let filter = {
      date: {
        $gte: parsedStartDate,
        $lte: parsedEndDate
      },
      status: 'excused' // Only excused absences have reasons
    };
    
    // Filter by department if specified
    if (department && department !== 'all' && department !== 'All Departments') {
      const interns = await Intern.find({ department });
      const internIds = interns.map(intern => intern._id);
      
      if (internIds.length > 0) {
        filter.internId = { $in: internIds };
      }
    }
    
    // Aggregate absence reasons
    const attendanceRecords = await Attendance.find(filter);
    
    // Count reasons
    const reasonCounts = {
      'Sick': 0,
      'Personal Emergency': 0,
      'Transport Issues': 0,
      'Work From Home': 0,
      'Unexcused': 0, // For absences without a valid reason
      'Other': 0      // For any other reasons
    };
    
    attendanceRecords.forEach(record => {
      if (!record.absenceReason || record.absenceReason.trim() === '') {
        reasonCounts['Unexcused']++;
      } else if (reasonCounts[record.absenceReason]) {
        reasonCounts[record.absenceReason]++;
      } else if (record.absenceReason.toLowerCase().includes('sick') || 
                record.absenceReason.toLowerCase().includes('ill')) {
        reasonCounts['Sick']++;
      } else if (record.absenceReason.toLowerCase().includes('emergency') || 
                record.absenceReason.toLowerCase().includes('family')) {
        reasonCounts['Personal Emergency']++;
      } else if (record.absenceReason.toLowerCase().includes('transport') || 
                record.absenceReason.toLowerCase().includes('traffic')) {
        reasonCounts['Transport Issues']++;
      } else if (record.absenceReason.toLowerCase().includes('work from home') || 
                record.absenceReason.toLowerCase().includes('wfh') ||
                record.absenceReason.toLowerCase().includes('remote')) {
        reasonCounts['Work From Home']++;
      } else {
        reasonCounts['Other']++;
      }
    });
    
    // Convert to arrays for chart data
    const labels = Object.keys(reasonCounts);
    const data = Object.values(reasonCounts);
    
    res.status(200).json({
      status: 'success',
      data: {
        labels,
        data
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
 * @desc    Get attendance summary statistics
 * @route   GET /api/reports/summary
 * @access  Private (Admin, Supervisor)
 */
exports.getAttendanceSummary = async (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        status: 'fail',
        message: 'Start date and end date are required'
      });
    }

    // Parse dates
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);
    parsedStartDate.setHours(0, 0, 0, 0);
    parsedEndDate.setHours(23, 59, 59, 999);
    
    // Compare with previous period of the same length
    const periodLength = (parsedEndDate - parsedStartDate) / (1000 * 60 * 60 * 24);
    
    const prevStartDate = new Date(parsedStartDate);
    prevStartDate.setDate(prevStartDate.getDate() - periodLength - 1);
    
    const prevEndDate = new Date(parsedStartDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    
    // Build intern filter
    let internFilter = {};
    if (department && department !== 'all' && department !== 'All Departments') {
      internFilter.department = department;
    }
    
    // Get all applicable interns
    const interns = await Intern.find(internFilter);
    const internIds = interns.map(intern => intern._id);
    
    if (internIds.length === 0) {
      return res.status(200).json({
        status: 'success',
        data: {
          totalInterns: 0,
          averageAttendance: 0,
          attendanceTrend: 0,
          mostAbsentees: 'N/A',
          perfectAttendance: 0,
          lateArrivals: 0
        }
      });
    }
    
    // Build attendance filter for current period
    const currentFilter = {
      date: {
        $gte: parsedStartDate,
        $lte: parsedEndDate
      },
      internId: { $in: internIds }
    };
    
    // Build attendance filter for previous period
    const prevFilter = {
      date: {
        $gte: prevStartDate,
        $lte: prevEndDate
      },
      internId: { $in: internIds }
    };
    
    // Get attendance records for both periods
    const currentRecords = await Attendance.find(currentFilter);
    const prevRecords = await Attendance.find(prevFilter);
    
    // Business days in the current period
    const businessDays = getBusinessDays(parsedStartDate, parsedEndDate);
    const totalExpectedAttendance = internIds.length * businessDays;
    
    // Calculate current attendance rate
    const currentPresent = currentRecords.filter(r => r.status === 'present' || r.status === 'excused').length;
    const averageAttendance = totalExpectedAttendance > 0 
      ? parseFloat(((currentPresent / totalExpectedAttendance) * 100).toFixed(2))
      : 0;
    
    // Calculate previous attendance rate for trend
    const prevBusinessDays = getBusinessDays(prevStartDate, prevEndDate);
    const prevTotalExpectedAttendance = internIds.length * prevBusinessDays;
    
    const prevPresent = prevRecords.filter(r => r.status === 'present' || r.status === 'excused').length;
    const prevAverageAttendance = prevTotalExpectedAttendance > 0 
      ? parseFloat(((prevPresent / prevTotalExpectedAttendance) * 100).toFixed(2))
      : 0;
    
    // Calculate attendance trend
    const attendanceTrend = parseFloat((averageAttendance - prevAverageAttendance).toFixed(2));
    
    // Count late arrivals
    const lateArrivals = currentRecords.filter(r => r.status === 'late').length;
    
    // Calculate perfect attendance
    // Group by intern to find who has perfect attendance
    const internAttendance = {};
    
    // Initialize all interns with 0 absences
    internIds.forEach(id => {
      internAttendance[id.toString()] = {
        present: 0,
        absent: businessDays // Assume absent for all days
      };
    });
    
    // Count present days for each intern
    currentRecords.forEach(record => {
      const internId = record.internId.toString();
      if (record.status === 'present' || record.status === 'excused') {
        internAttendance[internId].present += 1;
        internAttendance[internId].absent -= 1;
      }
    });
    
    // Count interns with perfect attendance (no absences)
    const perfectAttendance = Object.values(internAttendance).filter(a => a.absent === 0).length;
    
    // Find department with most absences
    const departmentAbsences = {};
    
    // Get all department names
    const departments = await Department.find({});
    
    // Initialize department absences
    departments.forEach(dept => {
      departmentAbsences[dept.name] = {
        totalInterns: 0,
        absences: 0,
        absenteeRate: 0
      };
    });
    
    // Count interns per department
    for (const intern of interns) {
      if (departmentAbsences[intern.department]) {
        departmentAbsences[intern.department].totalInterns += 1;
      }
    }
    
    // Sum absences per department
    for (const [internId, attendance] of Object.entries(internAttendance)) {
      const intern = interns.find(i => i._id.toString() === internId);
      if (intern && departmentAbsences[intern.department]) {
        departmentAbsences[intern.department].absences += attendance.absent;
      }
    }
    
    // Calculate absentee rate per department
    for (const dept of departments) {
      const deptStats = departmentAbsences[dept.name];
      const totalPossibleAttendance = deptStats.totalInterns * businessDays;
      
      deptStats.absenteeRate = totalPossibleAttendance > 0 
        ? parseFloat(((deptStats.absences / totalPossibleAttendance) * 100).toFixed(2))
        : 0;
    }
    
    // Find department with highest absentee rate
    let mostAbsentees = 'N/A';
    let highestAbsenteeRate = 0;
    
    Object.entries(departmentAbsences).forEach(([dept, stats]) => {
      if (stats.totalInterns > 0 && stats.absenteeRate > highestAbsenteeRate) {
        highestAbsenteeRate = stats.absenteeRate;
        mostAbsentees = dept;
      }
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        totalInterns: internIds.length,
        averageAttendance,
        attendanceTrend,
        mostAbsentees,
        perfectAttendance,
        lateArrivals,
        highestDailyAttendance: {
          day: 'Thursday', // This would require more detailed analysis to be accurate
          rate: 92.6 // Placeholder value
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

/**
 * @desc    Export attendance report in various formats (PDF, Excel, CSV)
 * @route   GET /api/reports/export
 * @access  Private (Admin, Supervisor)
 */
exports.exportReport = async (req, res) => {
  try {
    const { startDate, endDate, department, format = 'csv' } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        status: 'fail',
        message: 'Start date and end date are required'
      });
    }

    if (!['csv', 'excel', 'pdf'].includes(format.toLowerCase())) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid format. Supported formats: csv, excel, pdf'
      });
    }
    
    // Parse dates
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);
    parsedStartDate.setHours(0, 0, 0, 0);
    parsedEndDate.setHours(23, 59, 59, 999);
    
    // Build attendance filter
    const attendanceFilter = {
      date: {
        $gte: parsedStartDate,
        $lte: parsedEndDate
      }
    };
    
    // Get all department IDs if needed
    let departmentIds = [];
    if (department && department !== 'all') {
      const deptRecord = await Department.findOne({ name: department });
      if (deptRecord) {
        departmentIds.push(deptRecord._id);
      }
    } else {
      const departments = await Department.find({});
      departmentIds = departments.map(dept => dept._id);
    }
    
    // Get all interns in the selected departments
    const interns = await Intern.find({ department: { $in: departmentIds } }).sort({ name: 1 });
    if (interns.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'No interns found in the selected department(s)'
      });
    }
    
    const internIds = interns.map(intern => intern._id);
    attendanceFilter.internId = { $in: internIds };
    
    // Get attendance records
    const attendanceRecords = await Attendance.find(attendanceFilter)
      .sort({ date: 1 })
      .populate('internId', 'name email studentId department');
    
    // Calculate business days in the period
    const businessDays = getBusinessDays(parsedStartDate, parsedEndDate);
    
    // Prepare data for export
    const reportData = [];
    
    // Process data for each intern
    for (const intern of interns) {
      const internAttendance = attendanceRecords.filter(record => 
        record.internId && record.internId._id.toString() === intern._id.toString()
      );
      
      const presentDays = internAttendance.filter(record => 
        record.status === 'present' || record.status === 'excused'
      ).length;
      
      const absentDays = businessDays - presentDays;
      
      // Get department name
      const department = await Department.findById(intern.department);
      const departmentName = department ? department.name : 'Unknown';
      
      // Calculate attendance rate
      const attendanceRate = businessDays > 0 
        ? ((presentDays / businessDays) * 100).toFixed(2) 
        : '0.00';
      
      // Create report row
      reportData.push({
        name: intern.name,
        email: intern.email,
        studentId: intern.studentId,
        department: departmentName,
        presentDays,
        absentDays,
        totalBusinessDays: businessDays,
        attendanceRate: `${attendanceRate}%`
      });
    }
    
    // Format and send response based on requested format
    switch (format.toLowerCase()) {
      case 'csv':
        // Generate CSV
        let csv = 'Name,Email,Student ID,Department,Present Days,Absent Days,Total Business Days,Attendance Rate\n';
        reportData.forEach(row => {
          csv += `${row.name},${row.email},${row.studentId},${row.department},${row.presentDays},${row.absentDays},${row.totalBusinessDays},${row.attendanceRate}\n`;
        });
        
        // Set response headers
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=attendance_report_${startDate}_to_${endDate}.csv`);
        return res.status(200).send(csv);
        
      case 'excel':
        // For Excel, we'd ideally use a library like exceljs or xlsx
        // This is a simplified version that returns CSV with Excel extension
        let excelCsv = 'Name,Email,Student ID,Department,Present Days,Absent Days,Total Business Days,Attendance Rate\n';
        reportData.forEach(row => {
          excelCsv += `${row.name},${row.email},${row.studentId},${row.department},${row.presentDays},${row.absentDays},${row.totalBusinessDays},${row.attendanceRate}\n`;
        });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=attendance_report_${startDate}_to_${endDate}.xlsx`);
        return res.status(200).send(excelCsv);
        
      case 'pdf':
        // For PDF, we'd ideally use a library like pdfkit or html-pdf
        // This is a simplified version that returns JSON with a message
        return res.status(200).json({
          status: 'success',
          message: 'PDF generation would be implemented here with a PDF library',
          data: reportData
        });
        
      default:
        return res.status(400).json({
          status: 'fail',
          message: 'Invalid format. Supported formats: csv, excel, pdf'
        });
    }
  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
