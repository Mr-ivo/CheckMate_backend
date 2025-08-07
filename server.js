require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const connectDB = require('./src/config/database');

// Import routes
const authRoutes = require('./src/routes/auth.routes');
const userRoutes = require('./src/routes/user.routes');
const internRoutes = require('./src/routes/intern.routes');
const attendanceRoutes = require('./src/routes/attendance.routes');
const reportRoutes = require('./src/routes/report.routes');
const settingsRoutes = require('./src/routes/settings.routes');
const emailRoutes = require('./src/routes/email.routes');
// SMS routes removed for security and deployment reasons
const notificationRoutes = require('./src/routes/notification.routes');
const notificationManagementRoutes = require('./src/routes/notification.management.routes');
const testRoutes = require('./src/routes/test.routes');
const NotificationScheduler = require('./src/services/notification.scheduler');

// Initialize express app
const app = express();

// Middleware
// Use more permissive CORS settings to allow mobile access
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests, etc)
    if(!origin) return callback(null, true);
    
    // List of allowed origins - expanded to include mobile access
    const allowedOrigins = [
      'http://localhost:3000',
      'https://check-mate-nine.vercel.app',
      'https://check-mate-nine.vercel.app/',
      'https://check-mate-nine.vercel.app:*',
      'https://*.vercel.app',
      'https://*.vercel.app:*',
      'https://*.vercel.app/*',
      'http://*.vercel.app',
      'http://*.vercel.app:*',
      'http://*.vercel.app/*'
    ];
    
    // Check if the origin matches any allowed origins
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      // Convert wildcard patterns to regex
      if (allowedOrigin.includes('*')) {
        const regexPattern = allowedOrigin
          .replace(/\./g, '\\.')
          .replace(/\*/g, '.*');
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(origin);
      }
      return allowedOrigin === origin;
    });
    
    if (!isAllowed) {
      console.warn(`CORS blocked request from origin: ${origin}`);
      // For now, allow all origins in production to troubleshoot mobile issues
      return callback(null, true); // Allow all origins temporarily
      // Uncomment below line to enforce CORS after debugging
      // return callback(new Error('CORS policy does not allow access from this origin.'), false);
    }
    
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev')); // Logging middleware

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/interns', internRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/email', emailRoutes);
// SMS routes removed for security and deployment reasons
app.use('/api/notifications', notificationRoutes);
app.use('/api/notifications', notificationManagementRoutes);
app.use('/api/test', testRoutes);

// Base route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to CheckMate API',
    status: 'Server is running'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  
  // Start automatic notification scheduler
  try {
    NotificationScheduler.start();
    console.log('✅ Automatic notification system started successfully!');
  } catch (error) {
    console.error('❌ Failed to start notification scheduler:', error);
  }
});
