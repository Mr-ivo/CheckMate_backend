const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  notificationEmail: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in query results by default
  },
  role: {
    type: String,
    enum: ['admin', 'supervisor', 'intern'],
    default: 'intern'
  },
  profileImage: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Account lockout fields for security
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  lastFailedLogin: {
    type: Date
  }
}, {
  timestamps: true // Automatically add createdAt and updatedAt fields
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it's modified or new
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    // Generate salt and hash password
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check if entered password is correct
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Virtual to check if account is locked
userSchema.virtual('isLocked').get(function() {
  // Check if lockUntil exists and is in the future
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Method to increment login attempts and lock account if needed
userSchema.methods.incLoginAttempts = async function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return await this.updateOne({
      $set: { loginAttempts: 1, lastFailedLogin: Date.now() },
      $unset: { lockUntil: 1 }
    });
  }
  
  // Otherwise increment attempts
  const updates = {
    $inc: { loginAttempts: 1 },
    $set: { lastFailedLogin: Date.now() }
  };
  
  // Lock account after 5 failed attempts for 30 minutes
  const maxAttempts = 5;
  const lockTime = 30 * 60 * 1000; // 30 minutes in milliseconds
  
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set.lockUntil = Date.now() + lockTime;
    console.log(`🔒 Account locked for user: ${this.email} until ${new Date(Date.now() + lockTime).toISOString()}`);
  }
  
  return await this.updateOne(updates);
};

// Method to reset login attempts on successful login
userSchema.methods.resetLoginAttempts = async function() {
  return await this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1, lastFailedLogin: 1 }
  });
};

// Ensure virtuals are included in JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

const User = mongoose.model('User', userSchema);

module.exports = User;
