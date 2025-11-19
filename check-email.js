// Quick script to check current admin email
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./src/models/user.model');

async function checkEmail() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find admin user
    const admin = await User.findOne({ role: 'admin' });
    
    if (admin) {
      console.log('📧 Current Admin Email in Database:');
      console.log('─'.repeat(50));
      console.log(`Email: ${admin.email}`);
      console.log(`Name: ${admin.name}`);
      console.log(`Role: ${admin.role}`);
      console.log(`ID: ${admin._id}`);
      console.log('─'.repeat(50));
      console.log('\n✅ Email is: nzoggeivo@gmail.com');
    } else {
      console.log('❌ No admin user found');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkEmail();
