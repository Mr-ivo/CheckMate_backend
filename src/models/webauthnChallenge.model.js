const mongoose = require('mongoose');

/**
 * WebAuthn Challenge Model
 * Stores temporary challenges for registration and authentication
 */

const webauthnChallengeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  challenge: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['registration', 'authentication'],
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// TTL index - automatically delete expired challenges
webauthnChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Static method to create a new challenge
 */
webauthnChallengeSchema.statics.createChallenge = async function(userId, challenge, type, expiresInMinutes = 5) {
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
  
  return this.create({
    userId,
    challenge,
    type,
    expiresAt
  });
};

/**
 * Static method to verify and consume challenge
 */
webauthnChallengeSchema.statics.verifyAndConsume = async function(userId, challenge, type) {
  const challengeDoc = await this.findOne({
    userId,
    challenge,
    type,
    expiresAt: { $gt: new Date() }
  });
  
  if (challengeDoc) {
    // Delete the challenge after use (one-time use)
    await challengeDoc.deleteOne();
    return true;
  }
  
  return false;
};

const WebAuthnChallenge = mongoose.model('WebAuthnChallenge', webauthnChallengeSchema);

module.exports = WebAuthnChallenge;
