const mongoose = require('mongoose');
const Department = require('../models/department.model');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB Connected for Seeding...'))
.catch(err => console.error('MongoDB Connection Error:', err));

// Department data
const departments = [
  { name: 'Web Development', description: 'Frontend and backend web development' },
  { name: 'Mobile Development', description: 'iOS and Android app development' },
  { name: 'Graphic Design', description: 'UI/UX, branding, and visual design' },
  { name: 'Marketing', description: 'Digital marketing and social media management' },
  { name: 'QA Testing', description: 'Quality assurance and testing' },
  { name: 'DevOps', description: 'Development operations and infrastructure' },
  { name: 'Data Science', description: 'Data analysis and machine learning' }
];

// Seed departments
const seedDepartments = async () => {
  try {
    // Clear existing departments
    await Department.deleteMany({});
    console.log('Existing departments deleted');

    // Insert new departments
    const seededDepartments = await Department.insertMany(departments);
    console.log(`${seededDepartments.length} departments seeded successfully`);

    // Disconnect from MongoDB
    mongoose.disconnect();
    console.log('MongoDB disconnected');
  } catch (error) {
    console.error('Error seeding departments:', error);
    mongoose.disconnect();
  }
};

// Run the seed function
seedDepartments();
