const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const {
  generateRegistrationOptions,
  verifyRegistration,
  generateAuthenticationOptions,
  verifyAuthentication,
  getCredentials,
  deleteCredential,
  updateCredentialName
} = require('../controllers/webauthn.controller');

// Public routes (for login)
router.post('/auth/options', generateAuthenticationOptions);
router.post('/auth/verify', verifyAuthentication);

// Protected routes (require authentication)
router.use(protect);

// Registration routes
router.post('/register/options', generateRegistrationOptions);
router.post('/register/verify', verifyRegistration);

// Credential management
router.get('/credentials', getCredentials);
router.delete('/credentials/:credentialId', deleteCredential);
router.patch('/credentials/:credentialId', updateCredentialName);

module.exports = router;
