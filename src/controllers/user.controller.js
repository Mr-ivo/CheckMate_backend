const User = require('../models/user.model');

/**
 * @desc    Get all users
 * @route   GET /api/users
 * @access  Private/Admin
 */
exports.getUsers = async (req, res) => {
  try {
    // Implement pagination and filtering
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    
    // Create query object for filtering
    const filter = {};
    
    // Filter by role if specified
    if (req.query.role) {
      filter.role = req.query.role;
    }
    
    // Filter by active status if specified
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }
    
    // Execute query
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit);
    
    // Get total count for pagination
    const total = await User.countDocuments(filter);
    
    res.status(200).json({
      status: 'success',
      count: users.length,
      total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      data: { users }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Get single user
 * @route   GET /api/users/:id
 * @access  Private/Admin
 */
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: { user }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Update user
 * @route   PUT /api/users/:id
 * @access  Private/Admin
 */
exports.updateUser = async (req, res) => {
  try {
    // Don't allow password updates through this endpoint
    if (req.body.password) {
      delete req.body.password;
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: { user }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Delete user
 * @route   DELETE /api/users/:id
 * @access  Private/Admin
 */
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }
    
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
 * @desc    Approve pending user
 * @route   POST /api/users/:id/approve
 * @access  Private/Admin
 */
exports.approveUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }
    
    // Activate user
    user.isActive = true;
    await user.save();
    
    // Update intern status
    const Intern = require('../models/intern.model');
    await Intern.findOneAndUpdate(
      { userId: user._id },
      { status: 'active' }
    );
    
    console.log(`✅ User approved: ${user.email}`);
    
    // Send approval email notification
    try {
      const emailController = require('./email.controller');
      await emailController.sendApprovalEmail({
        name: user.name,
        email: user.email
      });
      console.log(`📧 Approval email sent to ${user.email}`);
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError);
      // Don't fail the approval if email fails
    }
    
    res.status(200).json({
      status: 'success',
      message: 'User approved successfully',
      data: { user }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Reject pending user
 * @route   POST /api/users/:id/reject
 * @access  Private/Admin
 */
exports.rejectUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }
    
    // Delete intern record
    const Intern = require('../models/intern.model');
    await Intern.findOneAndDelete({ userId: user._id });
    
    // Delete user
    await User.findByIdAndDelete(req.params.id);
    
    console.log(`❌ User rejected and removed: ${user.email}`);
    
    // TODO: Send rejection email notification
    
    res.status(200).json({
      status: 'success',
      message: 'User rejected and removed'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Deactivate user
 * @route   POST /api/users/:id/deactivate
 * @access  Private/Admin
 */
exports.deactivateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }
    
    user.isActive = false;
    await user.save();
    
    // Update intern status
    const Intern = require('../models/intern.model');
    await Intern.findOneAndUpdate(
      { userId: user._id },
      { status: 'inactive' }
    );
    
    console.log(`⏸️ User deactivated: ${user.email}`);
    
    res.status(200).json({
      status: 'success',
      message: 'User deactivated successfully',
      data: { user }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Activate user
 * @route   POST /api/users/:id/activate
 * @access  Private/Admin
 */
exports.activateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }
    
    user.isActive = true;
    await user.save();
    
    // Update intern status
    const Intern = require('../models/intern.model');
    await Intern.findOneAndUpdate(
      { userId: user._id },
      { status: 'active' }
    );
    
    console.log(`▶️ User activated: ${user.email}`);
    
    res.status(200).json({
      status: 'success',
      message: 'User activated successfully',
      data: { user }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
