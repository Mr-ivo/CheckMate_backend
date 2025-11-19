const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} = require('@simplewebauthn/server');
const User = require('../models/user.model');
const WebAuthnCredential = require('../models/webauthn.model');
const WebAuthnChallenge = require('../models/webauthnChallenge.model');
const Session = require('../models/session.model');
const { generateToken, generateRefreshToken } = require('../utils/jwt.utils');

// WebAuthn configuration
const rpName = 'CheckMate Attendance';
const rpID = process.env.RP_ID || 'localhost';
const origin = process.env.ORIGIN || `http://${rpID}:3000`;

/**
 * @desc    Generate registration options for new biometric credential
 * @route   POST /api/webauthn/register/options
 * @access  Private
 */
exports.generateRegistrationOptions = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }
    
    if (!user._id || !user.email || !user.name) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid user data'
      });
    }
    
    // Get existing credentials for this user
    const existingCredentials = await WebAuthnCredential.findByUserId(user._id);
    
    // Map existing credentials with safety check
    const excludeCredentials = existingCredentials
      .filter(cred => cred.credentialId) // Filter out credentials without ID
      .map(cred => {
        try {
          return {
            id: Buffer.from(cred.credentialId, 'base64'),
            type: 'public-key',
            transports: cred.transports || ['internal']
          };
        } catch (error) {
          console.warn('Skipping invalid credential:', cred._id);
          return null;
        }
      })
      .filter(cred => cred !== null); // Remove null entries
    
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: Buffer.from(user._id.toString()),
      userName: user.email,
      userDisplayName: user.name,
      // Don't prompt users for additional information about the authenticator
      attestationType: 'none',
      // Prevent users from re-registering existing authenticators
      excludeCredentials,
      authenticatorSelection: {
        // Prefer platform authenticators (built-in biometrics)
        authenticatorAttachment: 'platform',
        requireResidentKey: false,
        residentKey: 'preferred',
        userVerification: 'preferred'
      }
    });
    
    // Delete any existing registration challenges for this user
    await WebAuthnChallenge.deleteMany({
      userId: user._id,
      type: 'registration'
    });
    
    // Store new challenge for verification
    await WebAuthnChallenge.createChallenge(
      user._id,
      options.challenge,
      'registration',
      5 // 5 minutes
    );
    
    console.log(`🔐 Registration options generated for ${user.email}`);
    
    res.status(200).json({
      status: 'success',
      data: { options }
    });
  } catch (error) {
    console.error('Error generating registration options:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Verify registration response and save credential
 * @route   POST /api/webauthn/register/verify
 * @access  Private
 */
exports.verifyRegistration = async (req, res) => {
  try {
    const { credential, deviceName } = req.body;
    
    if (!credential) {
      return res.status(400).json({
        status: 'fail',
        message: 'Credential is required'
      });
    }
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }
    
    // Get the stored challenge first
    const storedChallenge = await WebAuthnChallenge.findOne({
      userId: user._id,
      type: 'registration',
      expiresAt: { $gt: new Date() }
    });
    
    if (!storedChallenge) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid or expired challenge'
      });
    }
    
    console.log('🔍 Challenge verification:');
    console.log('Stored challenge:', storedChallenge.challenge);
    console.log('Credential response:', JSON.stringify(credential).substring(0, 200));
    
    // Verify the registration response
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge: storedChallenge.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: false
      });
    } catch (verifyError) {
      console.error('❌ Verification error:', verifyError.message);
      // Delete the challenge even on error
      await storedChallenge.deleteOne();
      return res.status(400).json({
        status: 'fail',
        message: verifyError.message
      });
    }
    
    // Delete the challenge after verification (one-time use)
    await storedChallenge.deleteOne();
    
    if (!verification.verified) {
      return res.status(400).json({
        status: 'fail',
        message: 'Registration verification failed'
      });
    }
    
    const { registrationInfo } = verification;
    
    // Validate registration info
    if (!registrationInfo || !registrationInfo.credentialID || !registrationInfo.credentialPublicKey) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid registration info received'
      });
    }
    
    // Save the credential
    let credentialIdBase64, publicKeyBase64;
    try {
      credentialIdBase64 = Buffer.from(registrationInfo.credentialID).toString('base64');
      publicKeyBase64 = Buffer.from(registrationInfo.credentialPublicKey).toString('base64');
    } catch (bufferError) {
      console.error('Buffer conversion error:', bufferError);
      return res.status(400).json({
        status: 'fail',
        message: 'Failed to process credential data'
      });
    }
    
    const newCredential = await WebAuthnCredential.create({
      userId: user._id,
      credentialId: credentialIdBase64,
      publicKey: publicKeyBase64,
      counter: registrationInfo.counter || 0,
      deviceType: registrationInfo.credentialDeviceType,
      aaguid: registrationInfo.aaguid,
      credentialBackedUp: registrationInfo.credentialBackedUp,
      name: deviceName || 'Biometric Device',
      deviceInfo: {
        browser: req.get('user-agent')?.includes('Chrome') ? 'Chrome' : 
                 req.get('user-agent')?.includes('Firefox') ? 'Firefox' : 
                 req.get('user-agent')?.includes('Safari') ? 'Safari' : 'Unknown',
        os: req.get('user-agent')?.includes('Windows') ? 'Windows' :
            req.get('user-agent')?.includes('Mac') ? 'macOS' :
            req.get('user-agent')?.includes('Linux') ? 'Linux' :
            req.get('user-agent')?.includes('Android') ? 'Android' :
            req.get('user-agent')?.includes('iOS') ? 'iOS' : 'Unknown',
        device: req.get('user-agent')?.includes('Mobile') ? 'Mobile' : 'Desktop'
      },
      transports: credential.response.transports || ['internal']
    });
    
    console.log(`✅ Biometric credential registered for ${user.email}`);
    
    res.status(201).json({
      status: 'success',
      message: 'Biometric credential registered successfully',
      data: {
        credentialId: newCredential.credentialId,
        name: newCredential.name,
        deviceType: newCredential.deviceType
      }
    });
  } catch (error) {
    console.error('Error verifying registration:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Generate authentication options for biometric login
 * @route   POST /api/webauthn/auth/options
 * @access  Public
 */
exports.generateAuthenticationOptions = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        status: 'fail',
        message: 'Email is required'
      });
    }
    
    const user = await User.findOne({ email });
    
    if (!user) {
      // Don't reveal if user exists
      return res.status(200).json({
        status: 'success',
        data: { options: null }
      });
    }
    
    // Get user's credentials
    const credentials = await WebAuthnCredential.findByUserId(user._id);
    
    if (credentials.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'No biometric credentials found for this user'
      });
    }
    
    // Map credentials with safety check
    const allowCredentials = credentials
      .filter(cred => cred.credentialId)
      .map(cred => {
        try {
          return {
            id: Buffer.from(cred.credentialId, 'base64'),
            type: 'public-key',
            transports: cred.transports || ['internal']
          };
        } catch (error) {
          console.warn('Skipping invalid credential:', cred._id);
          return null;
        }
      })
      .filter(cred => cred !== null);
    
    if (allowCredentials.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'No valid biometric credentials found'
      });
    }
    
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'preferred'
    });
    
    // Store challenge for verification
    await WebAuthnChallenge.createChallenge(
      user._id,
      options.challenge,
      'authentication',
      5 // 5 minutes
    );
    
    console.log(`🔐 Authentication options generated for ${user.email}`);
    
    res.status(200).json({
      status: 'success',
      data: { options }
    });
  } catch (error) {
    console.error('Error generating authentication options:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Verify authentication response and complete biometric login
 * @route   POST /api/webauthn/auth/verify
 * @access  Public
 */
exports.verifyAuthentication = async (req, res) => {
  try {
    const { credential, email } = req.body;
    
    if (!credential || !email) {
      return res.status(400).json({
        status: 'fail',
        message: 'Credential and email are required'
      });
    }
    
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({
        status: 'fail',
        message: 'Authentication failed'
      });
    }
    
    // Find the credential
    if (!credential.rawId && !credential.id) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid credential data - missing rawId or id'
      });
    }
    
    // Try to get credential ID from rawId or id field
    let credentialId;
    try {
      if (credential.rawId) {
        credentialId = Buffer.from(credential.rawId, 'base64').toString('base64');
      } else if (credential.id) {
        // ID might already be in base64 format
        credentialId = credential.id;
      }
    } catch (bufferError) {
      console.error('Buffer conversion error:', bufferError);
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid credential format'
      });
    }
    
    const dbCredential = await WebAuthnCredential.findByCredentialId(credentialId);
    
    if (!dbCredential || dbCredential.userId.toString() !== user._id.toString()) {
      return res.status(401).json({
        status: 'fail',
        message: 'Credential not found'
      });
    }
    
    // Verify the challenge
    const challengeValid = await WebAuthnChallenge.verifyAndConsume(
      user._id,
      credential.response.clientDataJSON.challenge || credential.challenge,
      'authentication'
    );
    
    if (!challengeValid) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid or expired challenge'
      });
    }
    
    // Prepare authenticator data with safety checks
    let authenticatorData;
    try {
      if (!dbCredential.credentialId || !dbCredential.publicKey) {
        return res.status(400).json({
          status: 'fail',
          message: 'Invalid stored credential data'
        });
      }
      
      authenticatorData = {
        credentialID: Buffer.from(dbCredential.credentialId, 'base64'),
        credentialPublicKey: Buffer.from(dbCredential.publicKey, 'base64'),
        counter: dbCredential.counter || 0
      };
    } catch (bufferError) {
      console.error('Authenticator data conversion error:', bufferError);
      return res.status(400).json({
        status: 'fail',
        message: 'Failed to process stored credential'
      });
    }
    
    // Verify the authentication response
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge: credential.response?.clientDataJSON?.challenge || credential.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        authenticator: authenticatorData,
        requireUserVerification: false
      });
    } catch (verifyError) {
      console.error('❌ Biometric verification error:', verifyError.message);
      return res.status(401).json({
        status: 'fail',
        message: `Verification failed: ${verifyError.message}`
      });
    }
    
    if (!verification.verified) {
      console.error('❌ Verification not successful');
      return res.status(401).json({
        status: 'fail',
        message: 'Authentication verification failed. Please try again.'
      });
    }
    
    // Update credential counter and usage
    dbCredential.counter = verification.authenticationInfo.newCounter;
    await dbCredential.updateUsage();
    
    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    
    // Create session
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent') || 'Unknown';
    
    await Session.createSession(
      user._id,
      token,
      refreshToken,
      ipAddress,
      userAgent,
      24 * 60 * 60 * 1000 // 24 hours
    );
    
    // Enforce concurrent session limit
    await Session.enforceConcurrentLimit(user._id, 3);
    
    console.log(`✅ Biometric authentication successful for ${user.email}`);
    
    res.status(200).json({
      status: 'success',
      message: 'Biometric authentication successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          profileImage: user.profileImage
        },
        token,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Error verifying authentication:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Get all biometric credentials for current user
 * @route   GET /api/webauthn/credentials
 * @access  Private
 */
exports.getCredentials = async (req, res) => {
  try {
    const credentials = await WebAuthnCredential.findByUserId(req.user._id);
    
    res.status(200).json({
      status: 'success',
      data: {
        credentials: credentials.map(cred => ({
          id: cred._id,
          name: cred.name,
          deviceType: cred.deviceType,
          deviceInfo: cred.deviceInfo,
          lastUsed: cred.lastUsed,
          usageCount: cred.usageCount,
          createdAt: cred.createdAt
        })),
        count: credentials.length
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
 * @desc    Delete a biometric credential
 * @route   DELETE /api/webauthn/credentials/:credentialId
 * @access  Private
 */
exports.deleteCredential = async (req, res) => {
  try {
    const credential = await WebAuthnCredential.findById(req.params.credentialId);
    
    if (!credential) {
      return res.status(404).json({
        status: 'fail',
        message: 'Credential not found'
      });
    }
    
    // Ensure user can only delete their own credentials
    if (credential.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to delete this credential'
      });
    }
    
    await credential.deleteOne();
    
    console.log(`🗑️ Biometric credential deleted for ${req.user.email}`);
    
    res.status(200).json({
      status: 'success',
      message: 'Credential deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Update credential name
 * @route   PATCH /api/webauthn/credentials/:credentialId
 * @access  Private
 */
exports.updateCredentialName = async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({
        status: 'fail',
        message: 'Name is required'
      });
    }
    
    const credential = await WebAuthnCredential.findById(req.params.credentialId);
    
    if (!credential) {
      return res.status(404).json({
        status: 'fail',
        message: 'Credential not found'
      });
    }
    
    // Ensure user can only update their own credentials
    if (credential.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to update this credential'
      });
    }
    
    credential.name = name;
    await credential.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Credential name updated successfully',
      data: { credential: { id: credential._id, name: credential.name } }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
