require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/user.model');
const Intern = require('./src/models/intern.model');

async function approveUser(email) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      console.log('❌ User not found:', email);
      process.exit(1);
    }

    console.log('📋 User found:', user.email);
    console.log('Current status:', user.isActive ? 'Active' : 'Pending');

    // Activate user
    user.isActive = true;
    await user.save();

    // Update intern status
    const intern = await Intern.findOne({ userId: user._id });
    if (intern) {
      intern.status = 'active';
      await intern.save();
      console.log('✅ Intern status updated to active');
    }

    console.log('✅ User approved:', user.email);
    console.log('🎉 User can now login!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.log('Usage: node approve-user.js <email>');
  console.log('Example: node approve-user.js intern@example.com');
  process.exit(1);
}

approveUser(email);
