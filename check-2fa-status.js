// Check 2FA status for admin
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./src/models/user.model');
const TwoFactor = require('./src/models/twoFactor.model');

async function check2FAStatus() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const user = await User.findOne({ email: 'admin@checkmate.com' });
    
    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }
    
    const twoFactor = await TwoFactor.findOne({ userId: user._id });
    
    console.log('📧 User Email:', user.email);
    console.log('📧 Notification Email:', user.notificationEmail || 'Not set');
    console.log('🔐 2FA Enabled:', twoFactor ? twoFactor.enabled : false);
    
    if (twoFactor && twoFactor.enabled) {
      console.log('📊 Backup Codes Remaining:', twoFactor.backupCodes.length);
      console.log('\n✅ 2FA is ENABLED');
      console.log('When you login, you should see the 2FA code screen');
    } else {
      console.log('\n❌ 2FA is DISABLED');
      console.log('You need to enable it in Settings → Security');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

check2FAStatus();
