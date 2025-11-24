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
    console.log('🔐 Generating biometric registration options');
    console.log(`📝 User ID: ${req.user._id}`);
    console.log(`📝 RP_ID: ${rpID}`);
    console.log(`📝 Origin: ${origin}`);
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      console.error('❌ User not found');
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }
    
    console.log(`✅ User found: ${user.email}`);
    
    if (!user._id || !user.email || !user.name) {
      console.error('❌ Invalid user data');
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid user data'
      });
    }
    
    // Get existing credentials for this user
    const existingCredentials = await WebAuthnCredential.findByUserId(user._id);
    
    console.log(`📝 Found ${existingCredentials.length} existing credentials`);
    
    // Map existing credentials with safety check
    const excludeCredentials = existingCredentials
      .filter(cred => cred.credentialId && typeof cred.credentialId === 'string') // Filter out invalid credentials
      .map(cred => {
        try {
          // credentialId is already a base64 string in the database
          // Convert it to a Buffer for the WebAuthn library
          const idBuffer = Buffer.from(cred.credentialId, 'base64');
          console.log(`📝 Excluding credential: ${cred.credentialId.substring(0, 20)}...`);
          
          // Ensure transports is an array of strings
          let transports = ['internal']; // Default
          if (Array.isArray(cred.transports)) {
            transports = cred.transports
              .filter(t => typeof t === 'string' && t.length > 0)
              .map(t => t.toString());
            if (transports.length === 0) {
              transports = ['internal'];
            }
          }
          
          return {
            id: idBuffer,
            type: 'public-key',
            transports: transports
          };
        } catch (error) {
          console.warn(`⚠️ Skipping invalid credential ${cred._id}:`, error.message);
          return null;
        }
      })
      .filter(cred => cred !== null); // Remove null entries
    
    console.log(`📝 Excluding ${excludeCredentials.length} credentials from registration`);
    
    // Temporarily disable excludeCredentials to avoid library issues
    // Users can register multiple devices
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: Buffer.from(user._id.toString()),
      userName: user.email,
      userDisplayName: user.name,
      // Don't prompt users for additional information about the authenticator
      attestationType: 'none',
      // Allow multiple registrations - don't exclude existing credentials
      // excludeCredentials: [], // Disabled to avoid validation issues
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
    console.error('❌ Error generating registration options:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      status: 'error',
      message: `Failed to generate registration options: ${error.message}`,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
    
    // Log full verification response for debugging
    console.log('✅ Verification successful:', {
      verified: verification.verified,
      hasRegistrationInfo: !!verification.registrationInfo,
      verificationKeys: Object.keys(verification)
    });
    
    if (!verification.verified) {
      return res.status(400).json({
        status: 'fail',
        message: 'Registration verification failed'
      });
    }
    
    const { registrationInfo } = verification;
    
    // Log FULL verification object for debugging
    console.log('📝 Full Verification Object:', JSON.stringify(verification, null, 2));
    
    // Log registration info for debugging
    console.log('📝 Registration Info:', {
      hasRegistrationInfo: !!registrationInfo,
      keys: registrationInfo ? Object.keys(registrationInfo) : [],
      credentialID: registrationInfo?.credentialID ? 'present' : 'missing',
      credentialPublicKey: registrationInfo?.credentialPublicKey ? 'present' : 'missing',
      credential: registrationInfo?.credential ? 'present' : 'missing',
      aaguid: registrationInfo?.aaguid ? 'present' : 'missing'
    });
    
    // Validate registration info with better error details
    if (!registrationInfo) {
      console.error('❌ No registration info in verification response');
      console.error('❌ Verification object:', Object.keys(verification));
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid registration response - no registration info'
      });
    }
    
    // Check for credentialID with different possible property names
    const credentialID = registrationInfo.credentialID || 
                        registrationInfo.credential?.id || 
                        registrationInfo.id;
    
    const credentialPublicKey = registrationInfo.credentialPublicKey || 
                                registrationInfo.credential?.publicKey || 
                                registrationInfo.publicKey;
    
    if (!credentialID) {
      console.error('❌ Missing credentialID in registration info');
      console.error('❌ Available keys:', Object.keys(registrationInfo));
      console.error('❌ Registration info:', JSON.stringify(registrationInfo, null, 2));
      return res.status(400).json({
        status: 'fail',
        message: `Missing credential ID. Available properties: ${Object.keys(registrationInfo).join(', ')}. Please contact support with this info.`
      });
    }
    
    if (!credentialPublicKey) {
      console.error('❌ Missing credentialPublicKey in registration info');
      console.error('❌ Available keys:', Object.keys(registrationInfo));
      console.error('❌ Registration info:', JSON.stringify(registrationInfo, null, 2));
      return res.status(400).json({
        status: 'fail',
        message: `Missing public key. Available properties: ${Object.keys(registrationInfo).join(', ')}. Please contact support with this info.`
      });
    }
    
    // Save the credential
    // IMPORTANT: Use base64url encoding (not regular base64) to match WebAuthn standard
    let credentialIdBase64Url, publicKeyBase64;
    try {
      // Convert to base64url (WebAuthn standard) - no padding, URL-safe characters
      credentialIdBase64Url = Buffer.from(credentialID).toString('base64url');
      publicKeyBase64 = Buffer.from(credentialPublicKey).toString('base64');
      
      console.log(`📝 Saving credential ID (base64url): ${credentialIdBase64Url.substring(0, 30)}...`);
    } catch (bufferError) {
      console.error('Buffer conversion error:', bufferError);
      return res.status(400).json({
        status: 'fail',
        message: 'Failed to process credential data'
      });
    }
    
    const newCredential = await WebAuthnCredential.create({
      userId: user._id,
      credentialId: credentialIdBase64Url,
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
    
    // Don't pass allowCredentials to avoid validation issues
    // The library will allow any registered credential for this RP
    console.log(`📝 User has ${credentials.length} registered credential(s)`);
    
    const options = await generateAuthenticationOptions({
      rpID,
      // Don't specify allowCredentials - allow any credential for this user
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
    console.log('🔐 Biometric authentication attempt');
    const { credential, email } = req.body;
    
    if (!credential || !email) {
      console.error('❌ Missing credential or email');
      return res.status(400).json({
        status: 'fail',
        message: 'Credential and email are required'
      });
    }
    
    console.log(`🔍 Looking up user: ${email}`);
    const user = await User.findOne({ email });
    
    if (!user) {
      console.error(`❌ User not found: ${email}`);
      return res.status(401).json({
        status: 'fail',
        message: 'Authentication failed'
      });
    }
    
    console.log(`✅ User found: ${user.email}`);
    
    // Find the credential
    if (!credential.rawId && !credential.id) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid credential data - missing rawId or id'
      });
    }
    
    // Try to get credential ID from rawId or id field
    // rawId is already base64url encoded, id is the same value
    let credentialId;
    try {
      if (credential.rawId) {
        // rawId is already base64url, just use it directly
        credentialId = credential.rawId;
        console.log(`📝 Credential ID from rawId: ${credentialId.substring(0, 20)}...`);
      } else if (credential.id) {
        // ID is the same as rawId
        credentialId = credential.id;
        console.log(`📝 Credential ID from id: ${credentialId.substring(0, 20)}...`);
      }
      
      // Also try searching by the id field directly
      if (!credentialId) {
        console.error('❌ No credential ID found in request');
        return res.status(400).json({
          status: 'fail',
          message: 'Missing credential ID'
        });
      }
    } catch (bufferError) {
      console.error('❌ Buffer conversion error:', bufferError);
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid credential format'
      });
    }
    
    console.log(`🔍 Looking up credential in database...`);
    console.log(`🔍 Searching for credential ID (base64url): ${credentialId}`);
    
    // Both registration and authentication now use base64url format
    // Direct match should work
    let dbCredential = await WebAuthnCredential.findByCredentialId(credentialId);
    
    // Fallback: Try base64 format for old credentials
    if (!dbCredential) {
      try {
        const bytes = Buffer.from(credentialId, 'base64url');
        const credentialIdBase64 = bytes.toString('base64');
        console.log(`🔍 Trying legacy base64 format: ${credentialIdBase64}`);
        dbCredential = await WebAuthnCredential.findByCredentialId(credentialIdBase64);
      } catch (e) {
        console.error('❌ Error during legacy format lookup:', e);
      }
    }
    
    if (!dbCredential) {
      console.error(`❌ Credential not found in database`);
      console.error(`❌ Searched for: ${credentialId}`);
      console.error(`❌ Also tried base64 encoded versions`);
      
      // List all credentials for this user for debugging
      const allUserCredentials = await WebAuthnCredential.find({ userId: user._id });
      console.error(`❌ User has ${allUserCredentials.length} credential(s) in database:`);
      allUserCredentials.forEach((cred, index) => {
        console.error(`   ${index + 1}. ID: ${cred.credentialId} (${cred.name || 'Unnamed'})`);
      });
      
      return res.status(401).json({
        status: 'fail',
        message: 'This device is not registered. Please register it in Settings → Security → Biometric Authentication first.'
      });
    }
    
    if (dbCredential.userId.toString() !== user._id.toString()) {
      console.error(`❌ Credential belongs to different user`);
      return res.status(401).json({
        status: 'fail',
        message: 'Credential mismatch'
      });
    }
    
    console.log(`✅ Credential found in database`);
    
    // Verify the challenge
    console.log(`🔍 Verifying challenge...`);
    const challengeValid = await WebAuthnChallenge.verifyAndConsume(
      user._id,
      credential.response.clientDataJSON.challenge || credential.challenge,
      'authentication'
    );
    
    if (!challengeValid) {
      console.error(`❌ Challenge verification failed or expired`);
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid or expired challenge. Please try again.'
      });
    }
    
    console.log(`✅ Challenge verified`);
    
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
    console.log(`🔍 Verifying authentication response...`);
    console.log(`📝 Expected origin: ${origin}`);
    console.log(`📝 Expected RP ID: ${rpID}`);
    
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
      console.error('❌ Full error:', verifyError);
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
    
    console.log(`✅ Authentication verified successfully!`);
    
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
