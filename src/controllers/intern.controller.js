const User = require('../models/user.model');
const Intern = require('../models/intern.model');
const Attendance = require('../models/attendance.model');

/**
 * @desc    Get all interns
 * @route   GET /api/interns
 * @access  Private
 */
exports.getInterns = async (req, res) => {
  try {
    // Implement pagination and filtering
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    
    // Create query object for filtering
    const filter = {};
    
    // Filter by department if specified
    if (req.query.department) {
      filter.department = req.query.department;
    }
    
    // Filter by status if specified
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    // Filter by supervisor if specified
    if (req.query.supervisor) {
      filter.supervisor = req.query.supervisor;
    }
    
    // Execute query with population
    const interns = await Intern.find(filter)
      .populate('userId', 'name email profileImage')
      .populate('supervisor', 'name email')
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit);
    
    // Get total count for pagination
    const total = await Intern.countDocuments(filter);
    
    res.status(200).json({
      status: 'success',
      count: interns.length,
      total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      data: { interns }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Create new intern
 * @route   POST /api/interns
 * @access  Private/Admin
 */
exports.createIntern = async (req, res) => {
  try {
    const { 
      name, 
      email, 
      password, 
      internId, 
      department, 
      startDate, 
      supervisor 
    } = req.body;
    
    // First, create a user account for the intern
    const user = await User.create({
      name,
      email,
      password,
      role: 'intern'
    });
    
    // Then create the intern record linked to the user
    const intern = await Intern.create({
      userId: user._id,
      internId,
      department,
      startDate: startDate || new Date(),
      supervisor,
    });
    
    // Populate the user and supervisor data for the response
    const populatedIntern = await Intern.findById(intern._id)
      .populate('userId', 'name email profileImage')
      .populate('supervisor', 'name email');
    
    res.status(201).json({
      status: 'success',
      data: { intern: populatedIntern }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Get single intern
 * @route   GET /api/interns/:id
 * @access  Private
 */
exports.getIntern = async (req, res) => {
  try {
    const intern = await Intern.findById(req.params.id)
      .populate('userId', 'name email profileImage')
      .populate('supervisor', 'name email');
    
    if (!intern) {
      return res.status(404).json({
        status: 'fail',
        message: 'Intern not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: { intern }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Update intern
 * @route   PUT /api/interns/:id
 * @access  Private/Admin
 */
exports.updateIntern = async (req, res) => {
  try {
    const intern = await Intern.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    )
    .populate('userId', 'name email profileImage')
    .populate('supervisor', 'name email');
    
    if (!intern) {
      return res.status(404).json({
        status: 'fail',
        message: 'Intern not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: { intern }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Delete intern
 * @route   DELETE /api/interns/:id
 * @access  Private/Admin
 */
exports.deleteIntern = async (req, res) => {
  try {
    const intern = await Intern.findById(req.params.id);
    
    if (!intern) {
      return res.status(404).json({
        status: 'fail',
        message: 'Intern not found'
      });
    }
    
    // Delete associated user account
    if (intern.userId) {
      await User.findByIdAndDelete(intern.userId);
    }
    
    // Delete the intern record
    await Intern.findByIdAndDelete(req.params.id);
    
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

/**
 * @desc    Get intern attendance stats
 * @route   GET /api/interns/:id/attendance-stats
 * @access  Private
 */
exports.getInternAttendanceStats = async (req, res) => {
  try {
    const internId = req.params.id;
    
    // Get date range from query or default to last 30 days
    const endDate = new Date();
    const startDate = req.query.startDate 
      ? new Date(req.query.startDate) 
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    
    // Get attendance stats for the intern
    const stats = await Attendance.calculateStats(internId, startDate, endDate);
    
    // Update intern's attendance rate
    await Intern.findByIdAndUpdate(internId, {
      attendanceRate: stats.attendanceRate
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        internId,
        stats,
        period: {
          startDate,
          endDate
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
