const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const {
  createGeofence,
  getAllGeofences,
  getGeofenceById,
  updateGeofence,
  deleteGeofence,
  findNearbyGeofences,
  validateLocation
} = require('../controllers/geofence.controller');

// All routes require authentication
router.use(protect);

// Public routes (for all authenticated users)
router.post('/nearby', findNearbyGeofences);
router.post('/validate', validateLocation);

// Admin only routes
router.post('/', authorize('admin'), createGeofence);
router.get('/', authorize('admin', 'supervisor'), getAllGeofences);
router.get('/:id', authorize('admin', 'supervisor'), getGeofenceById);
router.put('/:id', authorize('admin'), updateGeofence);
router.delete('/:id', authorize('admin'), deleteGeofence);

module.exports = router;
