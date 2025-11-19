const mongoose = require('mongoose');

/**
 * Geofence Model
 * Defines workplace locations for attendance validation
 */

const geofenceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Geofence name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      validate: {
        validator: function(v) {
          return v.length === 2 && 
                 v[0] >= -180 && v[0] <= 180 && // longitude
                 v[1] >= -90 && v[1] <= 90;      // latitude
        },
        message: 'Invalid coordinates. Longitude must be between -180 and 180, Latitude between -90 and 90'
      }
    }
  },
  radius: {
    type: Number,
    required: [true, 'Radius is required'],
    min: [10, 'Radius must be at least 10 meters'],
    max: [5000, 'Radius cannot exceed 5000 meters'],
    default: 100 // 100 meters default
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    postalCode: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  departments: [{
    type: String,
    trim: true
  }],
  allowedDays: {
    type: [Number], // 0 = Sunday, 1 = Monday, etc.
    default: [1, 2, 3, 4, 5] // Monday to Friday
  },
  allowedHours: {
    start: {
      type: String, // Format: "HH:MM" (24-hour)
      default: "06:00"
    },
    end: {
      type: String, // Format: "HH:MM" (24-hour)
      default: "20:00"
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Create geospatial index for location-based queries
geofenceSchema.index({ location: '2dsphere' });
geofenceSchema.index({ isActive: 1 });
geofenceSchema.index({ departments: 1 });

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {Number} lat1 - Latitude of point 1
 * @param {Number} lon1 - Longitude of point 1
 * @param {Number} lat2 - Latitude of point 2
 * @param {Number} lon2 - Longitude of point 2
 * @returns {Number} Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Check if a point is within the geofence
 * @param {Number} latitude - User's latitude
 * @param {Number} longitude - User's longitude
 * @returns {Boolean} True if within geofence
 */
geofenceSchema.methods.isWithinGeofence = function(latitude, longitude) {
  const [fenceLon, fenceLat] = this.location.coordinates;
  const distance = calculateDistance(fenceLat, fenceLon, latitude, longitude);
  return distance <= this.radius;
};

/**
 * Check if current time is within allowed hours
 * @returns {Boolean} True if within allowed hours
 */
geofenceSchema.methods.isWithinAllowedHours = function() {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  return currentTime >= this.allowedHours.start && currentTime <= this.allowedHours.end;
};

/**
 * Check if current day is allowed
 * @returns {Boolean} True if today is an allowed day
 */
geofenceSchema.methods.isAllowedDay = function() {
  const today = new Date().getDay();
  return this.allowedDays.includes(today);
};

/**
 * Validate if check-in/out is allowed
 * @param {Number} latitude - User's latitude
 * @param {Number} longitude - User's longitude
 * @returns {Object} Validation result with details
 */
geofenceSchema.methods.validateLocation = function(latitude, longitude) {
  const result = {
    valid: false,
    withinGeofence: false,
    withinAllowedHours: false,
    allowedDay: false,
    distance: null,
    message: ''
  };

  // Check if geofence is active
  if (!this.isActive) {
    result.message = 'This location is currently inactive';
    return result;
  }

  // Check if today is an allowed day
  result.allowedDay = this.isAllowedDay();
  if (!result.allowedDay) {
    result.message = 'Check-in is not allowed on this day';
    return result;
  }

  // Check if within allowed hours
  result.withinAllowedHours = this.isWithinAllowedHours();
  if (!result.withinAllowedHours) {
    result.message = `Check-in is only allowed between ${this.allowedHours.start} and ${this.allowedHours.end}`;
    return result;
  }

  // Check if within geofence
  const [fenceLon, fenceLat] = this.location.coordinates;
  result.distance = calculateDistance(fenceLat, fenceLon, latitude, longitude);
  result.withinGeofence = result.distance <= this.radius;

  if (!result.withinGeofence) {
    result.message = `You are ${Math.round(result.distance)}m away from the workplace. You must be within ${this.radius}m to check in.`;
    return result;
  }

  // All checks passed
  result.valid = true;
  result.message = 'Location validated successfully';
  return result;
};

/**
 * Static method to find geofences near a location
 * @param {Number} latitude - Latitude
 * @param {Number} longitude - Longitude
 * @param {Number} maxDistance - Maximum distance in meters (default 1000m)
 * @returns {Array} Array of nearby geofences
 */
geofenceSchema.statics.findNearby = async function(latitude, longitude, maxDistance = 1000) {
  return this.find({
    isActive: true,
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: maxDistance
      }
    }
  });
};

/**
 * Static method to find valid geofence for check-in
 * @param {Number} latitude - User's latitude
 * @param {Number} longitude - User's longitude
 * @param {String} department - User's department (optional)
 * @returns {Object} Valid geofence or null
 */
geofenceSchema.statics.findValidGeofence = async function(latitude, longitude, department = null) {
  console.log(`🔍 Finding valid geofence for: lat=${latitude}, lon=${longitude}, dept=${department}`);
  
  // Find nearby geofences (within 500m)
  const nearbyGeofences = await this.findNearby(latitude, longitude, 500);
  console.log(`📍 Found ${nearbyGeofences.length} nearby geofences within 500m`);
  
  // Filter by department if provided
  let geofences = nearbyGeofences;
  if (department) {
    geofences = nearbyGeofences.filter(g => 
      g.departments.length === 0 || g.departments.includes(department)
    );
    console.log(`🏢 After department filter (${department}): ${geofences.length} geofences`);
  }
  
  // Find the first valid geofence
  for (const geofence of geofences) {
    console.log(`\n🎯 Checking geofence: ${geofence.name}`);
    console.log(`   Location: [${geofence.location.coordinates[1]}, ${geofence.location.coordinates[0]}]`);
    console.log(`   Radius: ${geofence.radius}m`);
    console.log(`   Departments: ${geofence.departments.join(', ') || 'All'}`);
    
    const validation = geofence.validateLocation(latitude, longitude);
    console.log(`   ✅ Valid: ${validation.valid}`);
    console.log(`   📏 Distance: ${Math.round(validation.distance)}m`);
    console.log(`   ⏰ Within hours: ${validation.withinAllowedHours}`);
    console.log(`   📅 Allowed day: ${validation.allowedDay}`);
    console.log(`   💬 Message: ${validation.message}`);
    
    if (validation.valid) {
      console.log(`✅ Valid geofence found: ${geofence.name}`);
      return {
        geofence,
        validation
      };
    }
  }
  
  console.log(`❌ No valid geofence found`);
  return null;
};

const Geofence = mongoose.model('Geofence', geofenceSchema);

module.exports = Geofence;
