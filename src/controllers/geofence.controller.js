const Geofence = require('../models/geofence.model');

/**
 * @desc    Create new geofence
 * @route   POST /api/geofences
 * @access  Private/Admin
 */
exports.createGeofence = async (req, res) => {
  try {
    const {
      name,
      description,
      latitude,
      longitude,
      radius,
      address,
      departments,
      allowedDays,
      allowedHours
    } = req.body;
    
    // Validate required fields
    if (!name || !latitude || !longitude) {
      return res.status(400).json({
        status: 'fail',
        message: 'Name, latitude, and longitude are required'
      });
    }
    
    // Create geofence
    const geofence = await Geofence.create({
      name,
      description,
      location: {
        type: 'Point',
        coordinates: [longitude, latitude] // GeoJSON format: [lon, lat]
      },
      radius: radius || 100,
      address,
      departments: departments || [],
      allowedDays: allowedDays || [1, 2, 3, 4, 5],
      allowedHours: allowedHours || { start: "06:00", end: "20:00" },
      createdBy: req.user._id
    });
    
    console.log(`📍 Geofence created: ${name} by ${req.user.email}`);
    
    res.status(201).json({
      status: 'success',
      data: { geofence }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Get all geofences
 * @route   GET /api/geofences
 * @access  Private/Admin
 */
exports.getAllGeofences = async (req, res) => {
  try {
    const { isActive, department } = req.query;
    
    const query = {};
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (department) query.departments = department;
    
    const geofences = await Geofence.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      status: 'success',
      data: {
        geofences,
        count: geofences.length
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
 * @desc    Get geofence by ID
 * @route   GET /api/geofences/:id
 * @access  Private/Admin
 */
exports.getGeofenceById = async (req, res) => {
  try {
    const geofence = await Geofence.findById(req.params.id)
      .populate('createdBy', 'name email');
    
    if (!geofence) {
      return res.status(404).json({
        status: 'fail',
        message: 'Geofence not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: { geofence }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Update geofence
 * @route   PUT /api/geofences/:id
 * @access  Private/Admin
 */
exports.updateGeofence = async (req, res) => {
  try {
    const {
      name,
      description,
      latitude,
      longitude,
      radius,
      address,
      departments,
      allowedDays,
      allowedHours,
      isActive
    } = req.body;
    
    const geofence = await Geofence.findById(req.params.id);
    
    if (!geofence) {
      return res.status(404).json({
        status: 'fail',
        message: 'Geofence not found'
      });
    }
    
    // Update fields
    if (name) geofence.name = name;
    if (description !== undefined) geofence.description = description;
    if (latitude && longitude) {
      geofence.location.coordinates = [longitude, latitude];
    }
    if (radius) geofence.radius = radius;
    if (address) geofence.address = address;
    if (departments) geofence.departments = departments;
    if (allowedDays) geofence.allowedDays = allowedDays;
    if (allowedHours) geofence.allowedHours = allowedHours;
    if (isActive !== undefined) geofence.isActive = isActive;
    
    await geofence.save();
    
    console.log(`📍 Geofence updated: ${geofence.name} by ${req.user.email}`);
    
    res.status(200).json({
      status: 'success',
      data: { geofence }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Delete geofence
 * @route   DELETE /api/geofences/:id
 * @access  Private/Admin
 */
exports.deleteGeofence = async (req, res) => {
  try {
    const geofence = await Geofence.findById(req.params.id);
    
    if (!geofence) {
      return res.status(404).json({
        status: 'fail',
        message: 'Geofence not found'
      });
    }
    
    await geofence.deleteOne();
    
    console.log(`🗑️ Geofence deleted: ${geofence.name} by ${req.user.email}`);
    
    res.status(200).json({
      status: 'success',
      message: 'Geofence deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Find nearby geofences
 * @route   POST /api/geofences/nearby
 * @access  Private
 */
exports.findNearbyGeofences = async (req, res) => {
  try {
    const { latitude, longitude, maxDistance = 1000 } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({
        status: 'fail',
        message: 'Latitude and longitude are required'
      });
    }
    
    const geofences = await Geofence.findNearby(latitude, longitude, maxDistance);
    
    // Add distance and validation info for each geofence
    const geofencesWithDetails = geofences.map(geofence => {
      const validation = geofence.validateLocation(latitude, longitude);
      return {
        ...geofence.toObject(),
        distance: Math.round(validation.distance),
        isValid: validation.valid,
        validationMessage: validation.message
      };
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        geofences: geofencesWithDetails,
        count: geofencesWithDetails.length
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
 * @desc    Validate location against geofences
 * @route   POST /api/geofences/validate
 * @access  Private
 */
exports.validateLocation = async (req, res) => {
  try {
    const { latitude, longitude, department } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({
        status: 'fail',
        message: 'Latitude and longitude are required'
      });
    }
    
    const validGeofence = await Geofence.findValidGeofence(latitude, longitude, department);
    
    if (!validGeofence) {
      // Find nearest geofence for helpful error message
      const nearbyGeofences = await Geofence.findNearby(latitude, longitude, 1000);
      
      if (nearbyGeofences.length === 0) {
        return res.status(403).json({
          status: 'fail',
          message: 'No workplace location found nearby',
          isValid: false,
          valid: false
        });
      }
      
      const nearest = nearbyGeofences[0];
      const validation = nearest.validateLocation(latitude, longitude);
      
      return res.status(403).json({
        status: 'fail',
        message: validation.message,
        isValid: false,
        valid: false,
        nearestLocation: {
          name: nearest.name,
          distance: Math.round(validation.distance),
          radius: nearest.radius
        }
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Location is valid for check-in',
      isValid: true,
      valid: true,
      data: {
        geofence: {
          id: validGeofence.geofence._id,
          name: validGeofence.geofence.name,
          distance: Math.round(validGeofence.validation.distance)
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
