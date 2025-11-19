// Add notification email field to user
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./src/models/user.model');

async function addNotificationEmail() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const loginEmail = 'admin@checkmate.com';
    const notificationEmail = 'nzoggeivo@gmail.com';
    
    // Add notificationEmail field to user schema
    const user = await User.findOneAndUpdate(
      { email: loginEmail },
      { 
        $set: { 
          notificationEmail: notificationEmail 
        } 
      },
      { new: true }
    );
    
    if (user) {
      console.log('✅ Notification email added successfully!\n');
      console.log('Login Email:', user.email);
      console.log('Notification Email:', user.notificationEmail || notificationEmail);
      console.log('\nNow:');
      console.log('- Login with: admin@checkmate.com');
      console.log('- OTP sent to: nzoggeivo@gmail.com');
    } else {
      console.log('❌ User not found');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addNotificationEmail();
