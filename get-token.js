// Quick script to generate a fresh token for testing
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const User = require('./src/models/user.model');

async function getToken() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const email = 'admin@checkmate.com';
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }
    
    // Generate token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '24h' }
    );
    
    console.log('\n✅ Token generated successfully!\n');
    console.log('Copy this token:');
    console.log('─'.repeat(80));
    console.log(token);
    console.log('─'.repeat(80));
    console.log('\nOpen browser console (F12) and run:');
    console.log(`localStorage.setItem('checkmate_auth_token', '${token}');`);
    console.log(`localStorage.setItem('checkmate_user', '${JSON.stringify({id: user._id, name: user.name, email: user.email, role: user.role})}');`);
    console.log(`window.location.href = '/dashboard';`);
    console.log('\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

getToken();
