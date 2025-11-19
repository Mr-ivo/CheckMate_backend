// Quick script to update admin email
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./src/models/user.model');

async function updateEmail() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const oldEmail = 'nzoggeivo@gmail.com';
    const newEmail = 'admin@checkmate.com'; // CHANGE THIS!
    
    const user = await User.findOneAndUpdate(
      { email: oldEmail },
      { email: newEmail },
      { new: true }
    );
    
    if (user) {
      console.log('✅ Email updated successfully!');
      console.log(`Old: ${oldEmail}`);
      console.log(`New: ${user.email}`);
      console.log('\nYou can now:');
      console.log('1. Login with the new email');
      console.log('2. Enable 2FA');
      console.log('3. Receive OTP codes at your real email');
    } else {
      console.log('❌ User not found');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateEmail();
