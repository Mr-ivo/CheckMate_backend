// Quick script to disable 2FA for a user
const mongoose = require('mongoose');
require('dotenv').config();

const TwoFactor = require('./src/models/twoFactor.model');

async function disable2FA() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find and disable 2FA for the user
    const email = 'admin@checkmate.com'; // Change this to your email
    
    // Find user by email first
    const User = require('./src/models/user.model');
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }
    
    console.log(`Found user: ${user.email}`);
    
    // Disable 2FA
    const result = await TwoFactor.findOneAndUpdate(
      { userId: user._id },
      { 
        $set: { 
          enabled: false,
          secret: null,
          backupCodes: []
        } 
      }
    );
    
    if (result) {
      console.log('✅ 2FA disabled successfully!');
      console.log(`You can now login with just email and password`);
    } else {
      console.log('ℹ️  No 2FA settings found (already disabled or never enabled)');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

disable2FA();
