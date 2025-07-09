# CheckMate Backend API

Backend server for the CheckMate Student Attendance Tracking System.

## Technologies Used

- Node.js & Express.js
- MongoDB & Mongoose ODM
- JWT Authentication
- bcrypt for password hashing

## Setup Instructions

### Prerequisites

- Node.js (v14+)
- MongoDB (local instance or MongoDB Atlas)

### Installation

1. Clone the repository
2. Install dependencies:

```
npm install
```

3. Set up environment variables:
   - Create a `.env` file based on the provided `.env` example
   - Set your MongoDB connection string and JWT secret

4. Start the server:

```
npm run dev
```

## API Documentation

### Authentication Endpoints

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - Register new user (admin only)
- `GET /api/auth/me` - Get current user profile
- `POST /api/auth/logout` - Logout user

### User Management Endpoints

- `GET /api/users` - Get all users (admin only)
- `GET /api/users/:id` - Get user by ID (admin only)
- `PUT /api/users/:id` - Update user (admin only)
- `DELETE /api/users/:id` - Delete user (admin only)

### Intern Management Endpoints

- `GET /api/interns` - Get all interns
- `POST /api/interns` - Create new intern (admin/supervisor only)
- `GET /api/interns/:id` - Get intern by ID
- `PUT /api/interns/:id` - Update intern (admin/supervisor only)
- `DELETE /api/interns/:id` - Delete intern (admin only)
- `GET /api/interns/:id/attendance-stats` - Get intern attendance statistics

### Attendance Tracking Endpoints

- `POST /api/attendance/check-in` - Record attendance check-in
- `POST /api/attendance/check-out` - Record attendance check-out
- `GET /api/attendance` - Get attendance records (admin/supervisor only)
- `GET /api/attendance/today` - Get today's attendance summary (admin/supervisor only)
- `GET /api/attendance/stats` - Get attendance statistics (admin/supervisor only)

### Report Endpoints

- `POST /api/reports/attendance` - Generate attendance report (admin/supervisor only)
- `GET /api/reports` - Get all reports (admin/supervisor only)
- `GET /api/reports/:id` - Get report by ID (admin/supervisor only)
- `DELETE /api/reports/:id` - Delete report (admin only)

## Authentication

The API uses JWT (JSON Web Token) for authentication:

1. Obtain a token by logging in via `/api/auth/login`
2. Include the token in the Authorization header of subsequent requests:
   ```
   Authorization: Bearer <your_token_here>
   ```

## Role-Based Access Control

The API implements role-based access control with three roles:

- **Admin**: Full access to all endpoints
- **Supervisor**: Can manage interns and view reports, but cannot manage users
- **Intern**: Limited access to check-in/check-out and view their own data

## Data Models

### User Model
- name
- email
- password (hashed)
- role (admin/supervisor/intern)
- profileImage
- isActive

### Intern Model
- userId (reference to User)
- internId (custom identifier)
- department
- startDate
- endDate
- supervisor (reference to User)
- status (active/completed/terminated)
- attendanceRate

### Attendance Model
- internId (reference to Intern)
- date
- checkInTime
- checkOutTime
- status (present/absent/late/excused)
- signature
- location (optional)
- notes

### Report Model
- title
- description
- generatedBy (reference to User)
- reportType
- dateRange (start/end)
- reportData
