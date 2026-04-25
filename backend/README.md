# LinkUp Dating App - Backend API

Complete Node.js + Express backend with PostgreSQL database and real-time WebSocket support.

## 🚀 Quick Start

### Prerequisites
- Node.js (v14+)
- PostgreSQL (v12+)
- npm

### Installation

1. **Install dependencies:**
```bash
cd backend
npm install
```

2. **Create `.env` file:**
```bash
cp .env.example .env
```

3. **Configure your database in `.env`:**
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=linkup_dating
DB_USER=postgres
DB_PASSWORD=your_password
PORT=5000
JWT_SECRET=your_super_secret_key
FRONTEND_URL=http://localhost:3000
```

4. **Create PostgreSQL database:**
```bash
createdb linkup_dating
```

5. **Start the server:**
```bash
npm run dev
```

Server will run on `http://localhost:5000`

## 📚 API Endpoints

### Authentication (`/api/auth`)
- **POST** `/signup` - Create new user account
- **POST** `/login` - Login with email/password
- **GET** `/verify` - Verify JWT token

### Dating Features (`/api/dating`)
- **POST** `/profiles` - Create/update dating profile
- **GET** `/profiles/me` - Get current user profile
- **GET** `/profiles/:userId` - Get user profile by ID
- **PUT** `/profiles/me` - Update profile
- **POST** `/profiles/me/photos` - Upload profile photos
- **POST** `/search` - Search profiles with filters
- **GET** `/discovery` - Get swipe cards
- **POST** `/interactions/like` - Like a profile
- **POST** `/interactions/pass` - Pass a profile
- **GET** `/matches` - Get user matches
- **GET** `/matches/:userId` - Check if users are matched
- **DELETE** `/matches/:matchId` - Unmatch
- **GET** `/interactions/likes` - Get received likes
- **GET** `/interactions/history` - Get interaction history
- **POST** `/profiles/verify` - Verify identity
- **GET** `/profiles/me/completion` - Get profile completion %

### Messaging (`/api/messaging`)
- **GET** `/matches/:matchId/messages` - Get match messages
- **POST** `/matches/:matchId/messages` - Send message
- **DELETE** `/messages/:messageId` - Delete message
- **GET** `/unread-count` - Get unread message count

## 🗄️ Database Schema

### Core Tables
- **users** - User accounts
- **dating_profiles** - User dating profiles
- **profile_photos** - Profile images
- **user_preferences** - User search filters
- **interactions** - Likes/Passes
- **matches** - User matches
- **messages** - Chat messages
- **video_dates** - Video call records
- **verification_tokens** - Email/phone verification

## 🔐 Authentication

All protected routes require JWT token in header:
```
Authorization: Bearer <token>
```

## 🔄 Real-time Features (WebSocket)

### Socket.io Events
- `user_online` - User comes online
- `send_message` - Send real-time message
- `receive_message` - Receive message
- `typing` - User typing indicator
- `user_status` - User online/offline status

## 🚀 Deployment

### Local Testing
```bash
npm run dev
```

### Production
```bash
NODE_ENV=production npm start
```

### Deploy to Heroku
```bash
heroku create your-app-name
heroku addons:create heroku-postgresql:hobby-dev
git push heroku main
```

## 📝 Environment Variables

```
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=linkup_dating
DB_USER=postgres
DB_PASSWORD=password

# Server
PORT=5000
NODE_ENV=development
API_BASE_URL=http://localhost:5000

# JWT
JWT_SECRET=your_secret_key
JWT_EXPIRE=7d

# Frontend
FRONTEND_URL=http://localhost:3000

# Email (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

## 🧪 Testing

Test endpoints using Postman or cURL:

```bash
# Signup
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123","confirmPassword":"password123"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Get profile (requires token)
curl -X GET http://localhost:5000/api/dating/profiles/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📦 Project Structure

```
backend/
├── config/
│   └── database.js          # PostgreSQL connection & schema
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── dating.js            # Dating feature routes
│   └── messaging.js         # Messaging routes
├── middleware/
│   └── auth.js              # JWT authentication
├── services/
│   └── (future)
├── server.js                # Main Express server
├── package.json
└── .env.example
```

## 🔧 Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
- Ensure PostgreSQL is running: `sudo service postgresql start` (Linux) or `brew services start postgresql` (Mac)

### Port Already in Use
```
Error: listen EADDRINUSE :::5000
```
- Change PORT in `.env` or kill the process: `lsof -ti:5000 | xargs kill -9`

### JWT Token Invalid
- Ensure JWT_SECRET matches between frontend and backend
- Check token hasn't expired (default 7 days)

## 📞 Support

For issues or questions, check the main [README.md](../README.md)

---

**Backend Ready!** 🎉 Now connect your frontend by updating the API_BASE_URL in `src/utils/api.js`
