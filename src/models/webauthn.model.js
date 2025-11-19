const mongoose = require('mongoose');

/**
 * WebAuthn Credential Model
 * Stores biometric credentials (fingerprint, face ID, etc.)
 */

const webauthnCredentialSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Credential ID (unique identifier for this credential)
  credentialId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // Public key for verification
  publicKey: {
    type: String,
    required: true
  },
  // Counter to prevent replay attacks
  counter: {
    type: Number,
    required: true,
    default: 0
  },
  // Device information
  deviceType: {
    type: String,
    enum: ['platform', 'cross-platform'],
    default: 'platform'
  },
  // Authenticator info
  aaguid: String,
  credentialDeviceType: String,
  credentialBackedUp: Boolean,
  // User-friendly name for the credential
  name: {
    type: String,
    default: 'Biometric Device'
  },
  // Device details
  deviceInfo: {
    browser: String,
    os: String,
    device: String
  },
  // Transport methods (usb, nfc, ble, internal)
  transports: [{
    type: String,
    enum: ['usb', 'nfc', 'ble', 'internal', 'hybrid']
  }],
  // Last used
  lastUsed: Date,
  // Usage statistics
  usageCount: {
    type: Number,
    default: 0
  },
  // Active status
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
webauthnCredentialSchema.index({ userId: 1, isActive: 1 });
webauthnCredentialSchema.index({ credentialId: 1 });

/**
 * Update last used timestamp and increment usage count
 */
webauthnCredentialSchema.methods.updateUsage = async function() {
  this.lastUsed = new Date();
  this.usageCount += 1;
  await this.save();
};

/**
 * Static method to find credential by credentialId
 */
webauthnCredentialSchema.statics.findByCredentialId = async function(credentialId) {
  return this.findOne({ credentialId, isActive: true });
};

/**
 * Static method to get all credentials for a user
 */
webauthnCredentialSchema.statics.findByUserId = async function(userId) {
  return this.find({ userId, isActive: true }).sort({ lastUsed: -1 });
};

/**
 * Static method to deactivate credential
 */
webauthnCredentialSchema.statics.deactivateCredential = async function(credentialId, userId) {
  return this.updateOne(
    { credentialId, userId },
    { $set: { isActive: false } }
  );
};

const WebAuthnCredential = mongoose.model('WebAuthnCredential', webauthnCredentialSchema);

module.exports = WebAuthnCredential;
