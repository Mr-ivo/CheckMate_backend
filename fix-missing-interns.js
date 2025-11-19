require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/user.model');
const Intern = require('./src/models/intern.model');

async function fixMissingInterns() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find all users with role 'intern'
    const internUsers = await User.find({ role: 'intern' });
    console.log(`📋 Found ${internUsers.length} intern users`);

    let fixed = 0;
    let skipped = 0;

    for (const user of internUsers) {
      // Check if intern record exists
      const existingIntern = await Intern.findOne({ userId: user._id });
      
      if (existingIntern) {
        console.log(`⏭️  Skipping ${user.email} - intern record already exists`);
        skipped++;
        continue;
      }

      // Create intern record
      const intern = await Intern.create({
        userId: user._id,
        name: user.name,
        email: user.email,
        employeeId: `EMP-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        department: user.department || 'General',
        position: 'Intern',
        contactNumber: user.phone || 'N/A',
        address: 'N/A',
        status: user.isActive ? 'active' : 'pending',
        startDate: user.createdAt || new Date()
      });

      console.log(`✅ Created intern record for ${user.email} (ID: ${intern._id})`);
      fixed++;
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Fixed: ${fixed}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   📋 Total: ${internUsers.length}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixMissingInterns();
