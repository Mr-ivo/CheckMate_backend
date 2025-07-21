const Attendance = require('../models/attendance.model');
const Intern = require('../models/intern.model');
const Department = require('../models/department.model');

/**
 * @desc    Get attendance records for a specific date
 * @route   GET /api/attendance/date/:date
 * @access  Private (Admin/Supervisor)
 */
exports.getAttendanceByDate = async (req, res) => {
  try {
    const { date } = req.params;
    
    // Validate date format
    if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid date format. Please use YYYY-MM-DD'
      });
    }
    
    // Create date range for the specified date
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    
    // Get department filter if provided
    const departmentFilter = req.query.department ? { department: req.query.department } : {};
    
    // Get all interns (active only)
    const interns = await Intern.find({ status: 'active', ...departmentFilter })
      .populate('userId', 'name email');
    
    // Get attendance records for the date
    const attendanceRecords = await Attendance.find({
      date: {
        $gte: startDate,
        $lt: endDate
      }
    }).populate({
      path: 'internId',
      select: 'internId department',
      populate: {
        path: 'userId',
        select: 'name email'
      }
    });
    
    // Map attendance records to include intern details
    const mappedRecords = interns.map(intern => {
      // Find attendance record for this intern if exists
      const record = attendanceRecords.find(r => 
        r.internId && r.internId._id && 
        intern._id && r.internId._id.toString() === intern._id.toString()
      );
      
      return {
        _id: intern._id,
        internId: intern.internId,
        name: intern.userId ? intern.userId.name : 'Unknown',
        email: intern.userId ? intern.userId.email : '',
        department: intern.department,
        status: record ? record.status : '',
        checkInTime: record ? record.checkInTime : null,
        checkOutTime: record ? record.checkOutTime : null,
        signature: record ? record.signature : null,
        notes: record ? record.notes : ''
      };
    });
    
    res.status(200).json({
      status: 'success',
      count: mappedRecords.length,
      data: mappedRecords
    });
  } catch (error) {
    console.error('Error fetching attendance by date:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Update attendance status for an intern
 * @route   PATCH /api/attendance/:internId
 * @access  Private (Admin/Supervisor)
 */
exports.updateAttendanceStatus = async (req, res) => {
  try {
    const { internId } = req.params;
    const { status, date, notes } = req.body;
    
    if (!status || !['Present', 'Absent', 'Late', 'Excused'].includes(status)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid status. Must be Present, Absent, Late, or Excused'
      });
    }
    
    if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid date format. Please use YYYY-MM-DD'
      });
    }
    
    // Find the intern
    const intern = await Intern.findById(internId);
    if (!intern) {
      return res.status(404).json({
        status: 'fail',
        message: 'Intern not found'
      });
    }
    
    // Create date range for the specified date
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    
    // Find existing attendance record
    let attendance = await Attendance.findOne({
      internId,
      date: {
        $gte: startDate,
        $lt: endDate
      }
    });
    
    // If no record exists and status is not Absent, create one
    if (!attendance && status !== 'Absent') {
      attendance = new Attendance({
        internId,
        date: startDate,
        checkInTime: new Date(),
        status: status.toLowerCase(),
        signature: 'Admin marked attendance', // Default signature for admin-managed attendance
        notes: notes || `Attendance marked by admin: ${req.user.name}`
      });
      
      // Make signature optional for admin-managed attendance
      attendance.markModified('signature');
      await attendance.save();
    } else if (!attendance && status === 'Absent') {
      // For absent status, we don't need to create a record
      return res.status(200).json({
        status: 'success',
        message: 'Intern marked as absent'
      });
    } else {
      // Update existing record
      attendance.status = status.toLowerCase();
      if (notes) attendance.notes = notes;
      
      await attendance.save();
    }
    
    res.status(200).json({
      status: 'success',
      message: `Attendance status updated to ${status}`,
      data: attendance
    });
  } catch (error) {
    console.error('Error updating attendance status:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Bulk update attendance status
 * @route   POST /api/attendance/bulk-update
 * @access  Private (Admin/Supervisor)
 */
exports.bulkUpdateAttendance = async (req, res) => {
  try {
    const { date, status, department, notes } = req.body;
    
    if (!status || !['Present', 'Absent', 'Late', 'Excused'].includes(status)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid status. Must be Present, Absent, Late, or Excused'
      });
    }
    
    if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid date format. Please use YYYY-MM-DD'
      });
    }
    
    // Create date range for the specified date
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    
    // Get all interns based on department filter
    const departmentFilter = department ? { department } : {};
    const interns = await Intern.find({ status: 'active', ...departmentFilter });
    
    if (interns.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'No interns found matching the criteria'
      });
    }
    
    // Process each intern
    const results = [];
    for (const intern of interns) {
      // Find existing attendance record
      let attendance = await Attendance.findOne({
        internId: intern._id,
        date: {
          $gte: startDate,
          $lt: endDate
        }
      });
      
      // If no record exists and status is not Absent, create one
      if (!attendance && status !== 'Absent') {
        attendance = await Attendance.create({
          internId: intern._id,
          date: startDate,
          status: status.toLowerCase(),
          checkInTime: status === 'Present' || status === 'Late' ? new Date() : null,
          signature: 'Admin marked attendance',
          notes: notes || `Bulk attendance marked by admin: ${req.user.name}`
        });
      } 
      // If record exists, update it
      else if (attendance) {
        attendance.status = status.toLowerCase();
        
        // Update check-in time if not already set and status is Present or Late
        if (!attendance.checkInTime && (status === 'Present' || status === 'Late')) {
          attendance.checkInTime = new Date();
        }
        
        // Update notes if provided
        if (notes) {
          attendance.notes = notes;
        }
        
        await attendance.save();
      }
      
      if (attendance) {
        results.push(attendance);
      }
    }
    
    res.status(200).json({
      status: 'success',
      message: `Bulk updated ${results.length} attendance records to ${status}`,
      count: results.length,
      data: results
    });
  } catch (error) {
    console.error('Error bulk updating attendance:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Save attendance data
 * @route   POST /api/attendance/save
 * @access  Private (Admin/Supervisor)
 */
exports.saveAttendanceData = async (req, res) => {
  try {
    const { date, records } = req.body;
    
    if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid date format. Please use YYYY-MM-DD'
      });
    }
    
    if (!records || !Array.isArray(records)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Records must be an array'
      });
    }
    
    // Create date range for the specified date
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    
    // Process each record
    const results = [];
    for (const record of records) {
      const { internId, status, checkInTime, checkOutTime } = record;
      
      if (!internId) continue;
      
      // Find the intern
      const intern = await Intern.findById(internId);
      if (!intern) continue;
      
      // Find existing attendance record
      let attendance = await Attendance.findOne({
        internId,
        date: {
          $gte: startDate,
          $lt: endDate
        }
      });
      
      // If no record exists and status is not Absent or empty, create one
      if (!attendance && status && status !== 'Absent') {
        attendance = await Attendance.create({
          internId,
          date: startDate,
          status: status.toLowerCase(),
          checkInTime: checkInTime || (status === 'Present' || status === 'Late' ? new Date() : null),
          checkOutTime: checkOutTime || null
        });
      } 
      // If record exists, update it
      else if (attendance) {
        if (status) attendance.status = status.toLowerCase();
        if (checkInTime) attendance.checkInTime = new Date(checkInTime);
        if (checkOutTime) attendance.checkOutTime = new Date(checkOutTime);
        
        await attendance.save();
      }
      
      if (attendance) {
        results.push(attendance);
      }
    }
    
    res.status(200).json({
      status: 'success',
      message: `Saved ${results.length} attendance records`,
      count: results.length,
      data: results
    });
  } catch (error) {
    console.error('Error saving attendance data:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Export attendance data as CSV
 * @route   GET /api/attendance/export
 * @access  Private (Admin/Supervisor)
 */
exports.exportAttendanceData = async (req, res) => {
  try {
    const { date, department } = req.query;
    
    if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid date format. Please use YYYY-MM-DD'
      });
    }
    
    // Create date range for the specified date
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    
    // Get department filter if provided
    const departmentFilter = department ? { department } : {};
    
    // Get all interns (active only)
    const interns = await Intern.find({ status: 'active', ...departmentFilter })
      .populate('userId', 'name email');
    
    // Get attendance records for the date
    const attendanceRecords = await Attendance.find({
      date: {
        $gte: startDate,
        $lt: endDate
      }
    }).populate({
      path: 'internId',
      select: 'internId department',
      populate: {
        path: 'userId',
        select: 'name email'
      }
    });
    
    // Map attendance records to include intern details
    const mappedRecords = interns.map(intern => {
      // Find attendance record for this intern if exists
      const record = attendanceRecords.find(r => 
        r.internId && r.internId._id && 
        intern._id && r.internId._id.toString() === intern._id.toString()
      );
      
      return {
        InternID: intern.internId,
        Name: intern.userId ? intern.userId.name : 'Unknown',
        Email: intern.userId ? intern.userId.email : '',
        Department: intern.department,
        Status: record ? record.status.charAt(0).toUpperCase() + record.status.slice(1) : 'Absent',
        'Check-In Time': record && record.checkInTime ? record.checkInTime.toLocaleString() : 'N/A',
        'Check-Out Time': record && record.checkOutTime ? record.checkOutTime.toLocaleString() : 'N/A',
        Notes: record ? record.notes || '' : ''
      };
    });
    
    // Create CSV header
    let csv = 'Intern ID,Name,Email,Department,Status,Check-In Time,Check-Out Time,Notes\n';
    
    // Add data rows
    mappedRecords.forEach(record => {
      csv += `"${record.InternID}","${record.Name}","${record.Email}","${record.Department}","${record.Status}","${record['Check-In Time']}","${record['Check-Out Time']}","${record.Notes}"\n`;
    });
    
    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=attendance-${date}.csv`);
    
    // Send CSV data
    res.send(csv);
  } catch (error) {
    console.error('Error exporting attendance data:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Get all departments
 * @route   GET /api/departments
 * @access  Private
 */
exports.getAllDepartments = async (req, res) => {
  try {
    // Get all departments
    const departments = await Department.find();
    
    res.status(200).json({
      status: 'success',
      count: departments.length,
      data: departments
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
