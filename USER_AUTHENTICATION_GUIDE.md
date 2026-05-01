# DatingHub - User Authentication & Registration Guide

## Overview

DatingHub includes a complete user authentication system with:
- ✅ User Registration (Sign Up)
- ✅ User Login
- ✅ Profile Setup with avatar
- ✅ Email validation
- ✅ Password security requirements
- ✅ Form validation on frontend
- ✅ Token-based authentication

---

## Frontend Features

### 1. Sign Up Page (`src/components/SignUp.js`)

**Two-Step Registration Process:**

**Step 1: Account Details**
- Full Name
- Email (validated)
- Password (with strength requirements)
- Confirm Password
- Password requirements:
  - Minimum 8 characters
  - At least 1 uppercase letter
  - At least 1 lowercase letter
  - At least 1 number

**Step 2: Profile (Optional)**
- Profile Picture Upload
- Phone Number

### 2. Login Page (`src/components/Login.js`)

**Features:**
- Email & Password login
- Error handling and validation
- Link to signup page
- Persistent session via localStorage

### 3. Form Validation

**Frontend validation includes:**
- Email format validation
- Password strength validation
- Password confirmation matching
- Phone number format validation
- Required field checks
- Real-time error feedback

---

## Backend API Requirements

The frontend expects these API endpoints on your backend:

### Authentication Endpoints

#### 1. **POST /auth/signup**
Create a new user account

**Request:**
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123",
  "phone": "+1234567890",
  "avatar": "data:image/png;base64,..."
}
```

**Response (Success):**
```json
{
  "token": "jwt_token_here",
  "user": {
    "_id": "user_id",
    "fullName": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "avatar": "https://cloudinary.com/image.jpg",
    "createdAt": "2026-04-26T10:00:00Z"
  }
}
```

**Response (Error):**
```json
{
  "error": "Email already exists",
  "message": "A user with this email is already registered"
}
```

#### 2. **POST /auth/login**
Authenticate user with credentials

**Request:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response (Success):**
```json
{
  "token": "jwt_token_here",
  "user": {
    "_id": "user_id",
    "fullName": "John Doe",
    "email": "john@example.com",
    "avatar": "https://cloudinary.com/image.jpg"
  }
}
```

**Response (Error):**
```json
{
  "error": "Invalid credentials",
  "message": "Email or password is incorrect"
}
```

---

## Backend Implementation Example (Node.js/Express)

### Installation

```bash
npm install express bcryptjs jsonwebtoken dotenv mongoose cors
```

### Environment Variables (.env)

```env
MONGODB_URI=mongodb://localhost/linkup
JWT_SECRET=your_super_secret_jwt_key_here
NODE_ENV=development
PORT=5000
```

### User Schema (Mongoose)

```javascript
// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: /.+\@.+\..+/,
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
  },
  phone: {
    type: String,
    default: null,
  },
  avatar: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'away'],
    default: 'offline',
  },
  lastSeen: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', userSchema);
```

### Authentication Routes

```javascript
// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key';

// Sign Up
router.post('/signup', async (req, res) => {
  try {
    const { fullName, email, password, phone, avatar } = req.body;

    // Validate required fields
    if (!fullName || !email || !password) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Full name, email, and password are required',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        error: 'Email already exists',
        message: 'A user with this email is already registered',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      fullName,
      email: email.toLowerCase(),
      password: hashedPassword,
      phone: phone || null,
      avatar: avatar || null,
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Return user data (without password)
    const userData = {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      createdAt: user.createdAt,
    };

    res.status(201).json({
      token,
      user: userData,
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      error: 'Server error',
      message: error.message,
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Email and password are required',
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Update last seen
    user.lastSeen = new Date();
    await user.save();

    // Return user data (without password)
    const userData = {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
    };

    res.json({
      token,
      user: userData,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Server error',
      message: error.message,
    });
  }
});

// Get User Profile (Protected Route)
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Middleware to verify JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.userId = decoded.userId;
    next();
  });
}

module.exports = router;
```

### Server Setup

```javascript
// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/linkup')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB error:', err));

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/messaging', require('./routes/messaging'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## User Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      DatingHub App Start                        │
└────────────┬────────────────────────────────────────────────┘
             │
             ├─→ [Has Auth Token?]
             │   ├─ YES → [Go to Messaging]
             │   └─ NO  → [Show Login/Signup]
             │
             ├─→ [Login Page]
             │   ├─ [New User?] → [Click "Create one"]
             │   │   └─→ [Sign Up Page - Step 1]
             │   │       ├─ Full Name
             │   │       ├─ Email
             │   │       ├─ Password
             │   │       └─ [Next] → [Step 2]
             │   │           ├─ Avatar (Optional)
             │   │           ├─ Phone (Optional)
             │   │           └─ [Create Account]
             │   │               └─→ POST /auth/signup
             │   │                   ├─ [Success] → [Get Token]
             │   │                   └─ [Error] → [Show Error]
             │   │
             │   └─ [Existing User?]
             │       ├─ Email
             │       ├─ Password
             │       └─ [Sign In]
             │           └─→ POST /auth/login
             │               ├─ [Success] → [Get Token]
             │               └─ [Error] → [Show Error]
             │
             └─→ [Store Token]
                 └─→ [Authenticated] → [Messaging App]
```

---

## Security Best Practices

### Frontend
✅ Password validation (min 8 chars, uppercase, lowercase, number)
✅ Email format validation
✅ Form validation before sending
✅ Secure token storage (localStorage)
✅ Clear token on logout

### Backend
✅ Password hashing with bcrypt (min 10 rounds)
✅ JWT token expiration (30 days recommended)
✅ Email uniqueness validation
✅ SQL/NoSQL injection prevention
✅ CORS configuration
✅ Rate limiting on auth endpoints
✅ HTTPS only in production

### Recommendations
- ✅ Always use HTTPS in production
- ✅ Implement rate limiting (max 5 login attempts per 15 minutes)
- ✅ Add email verification for signup
- ✅ Implement password reset flow
- ✅ Add 2FA (Two-Factor Authentication)
- ✅ Monitor failed login attempts
- ✅ Regular password strength audit

---

## Testing Signup/Login

### Test Signup
```bash
curl -X POST http://localhost:5000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "email": "test@example.com",
    "password": "TestPass123",
    "phone": "1234567890"
  }'
```

### Test Login
```bash
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123"
  }'
```

### Test Protected Route
```bash
curl -X GET http://localhost:5000/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Frontend Integration

The signup/login pages are automatically integrated into DatingHub:

1. **App starts** → Checks for auth token
2. **No token** → Shows Login page
3. **New user** → Click "Create one" → Shows SignUp page
4. **Signup** → POST to `/auth/signup` → Get token
5. **Token received** → Store & redirect to Messaging
6. **Messaging** → All authenticated requests include token

---

## Environment Setup

### .env File (Frontend)
```env
REACT_APP_BACKEND_URL=http://10.0.2.2:5000
# For physical device: http://192.168.x.x:5000
```

### .env File (Backend)
```env
MONGODB_URI=mongodb://localhost/linkup
JWT_SECRET=your_very_secret_key_here
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:3000
```

---

## Next Steps

1. **Backend Setup:** Implement the auth routes as shown above
2. **Database Setup:** Create MongoDB user collection
3. **Testing:** Test signup and login with provided curl commands
4. **Frontend Build:** Run `npm run build` to create production build
5. **Android Build:** Build APK with `npx cap open android`

---

## Troubleshooting

### "Email already exists"
- User already registered
- Use different email or login instead

### "Password does not meet requirements"
- Min 8 characters required
- Must have uppercase, lowercase, and number
- Example: "SecurePass123" ✓

### "Backend connection refused"
- Ensure backend server is running
- Check REACT_APP_BACKEND_URL in .env
- For emulator: use 10.0.2.2 not localhost

### "Invalid or expired token"
- Log out and login again
- Token expires after 30 days
- Clear browser cache if persisting

---

**Last Updated:** April 26, 2026

For more help: Check backend logs and frontend console for detailed errors.
