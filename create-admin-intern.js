require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/user.model');
const Intern = require('./src/models/intern.model');

async function createAdminIntern() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find admin user
    const adminUser = await User.findOne({ email: 'admin@checkmate.com' });
    if (!adminUser) {
      console.log('❌ Admin user not found');
      process.exit(1);
    }

    console.log('✅ Found admin user:', adminUser.email);

    // Check if intern record already exists
    let intern = await Intern.findOne({ userId: adminUser._id });
    
    if (intern) {
      console.log('✅ Intern record already exists for admin');
      console.log('Intern ID:', intern._id);
    } else {
      // Create intern record for admin
      intern = await Intern.create({
        userId: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        employeeId: 'ADMIN-001',
        department: 'Administration',
        position: 'System Administrator',
        startDate: new Date(),
        status: 'active',
        contactNumber: adminUser.phone || '0000000000',
        address: 'Admin Office'
      });

      console.log('✅ Created intern record for admin');
      console.log('Intern ID:', intern._id);
    }

    console.log('\n📋 Admin can now use check-in with this intern ID:', intern._id);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createAdminIntern();
