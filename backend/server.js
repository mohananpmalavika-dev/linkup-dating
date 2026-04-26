const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const socketIO = require('socket.io');
require('dotenv').config();

const db = require('./config/database');
const authRoutes = require('./routes/auth');
const datingRoutes = require('./routes/dating');
const messagingRoutes = require('./routes/messaging');
const productsRoutes = require('./routes/products');
const ordersRoutes = require('./routes/orders');
const appDataRoutes = require('./routes/app-data');
const astrologyRoutes = require('./routes/astrology');
const flashsalesRoutes = require('./routes/flashsales');
const { authenticateToken } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Store active users for real-time features
const activeUsers = new Map();

// WebSocket Connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('user_online', (userId) => {
    activeUsers.set(userId, socket.id);
    io.emit('user_status', { userId, online: true });
  });

  socket.on('send_message', (data) => {
    const { fromUserId, toUserId, message, matchId } = data;
    const receiverSocketId = activeUsers.get(toUserId);
    
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('receive_message', {
        fromUserId,
        matchId,
        message,
        timestamp: new Date()
      });
    }
  });

  socket.on('typing', (data) => {
    const { toUserId, isTyping } = data;
    const receiverSocketId = activeUsers.get(toUserId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('user_typing', { isTyping });
    }
  });

  socket.on('disconnect', () => {
    for (let [userId, socketId] of activeUsers.entries()) {
      if (socketId === socket.id) {
        activeUsers.delete(userId);
        io.emit('user_status', { userId, online: false });
        console.log('User offline:', userId);
        break;
      }
    }
  });
});

// Make io accessible to routes
app.use((req, res, next) => {
  req.io = io;
  req.activeUsers = activeUsers;
  next();
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'LinkUp Dating API Backend',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      auth: '/api/auth/signup, /api/auth/login, /api/auth/verify, /api/auth/check-username, /api/auth/check-email, /api/auth/send-otp, /api/auth/verify-otp, /api/auth/set-username, /api/auth/me, /api/auth/visibility, /api/auth/contact-means',
      dating: '/api/dating/* (requires auth)',
      messaging: '/api/messaging/* (requires auth)'
    }
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/app-data', appDataRoutes);
app.use('/api/astrology', astrologyRoutes);
app.use('/api/flashsales', flashsalesRoutes);
app.use('/api/dating', authenticateToken, datingRoutes);
app.use('/api/messaging', authenticateToken, messagingRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Backend is running', timestamp: new Date() });
});

// 404 Handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    message: `The endpoint ${req.method} ${req.path} does not exist`,
    availableEndpoints: {
      auth: '/api/auth/signup, /api/auth/login, /api/auth/verify, /api/auth/check-username, /api/auth/check-email, /api/auth/send-otp, /api/auth/verify-otp, /api/auth/set-username, /api/auth/me, /api/auth/visibility, /api/auth/contact-means',
      products: '/api/products, /api/products/manage',
      orders: '/api/orders/*, /api/orders/mine, /api/orders/manage, /api/orders/payment-config',
      appData: '/api/app-data/public, /api/app-data/classifieds/*, /api/app-data/realestate/*',
      astrology: '/api/astrology/signs, /api/astrology/daily/{sign}, /api/astrology/profile',
      flashsales: '/api/flashsales, /api/flashsales/reserve/bulk',
      dating: '/api/dating/* (requires auth)',
      messaging: '/api/messaging/* (requires auth)',
      health: '/health'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Initialize database and start server
const PORT = process.env.PORT || 5000;

db.init().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Dating app backend running on http://localhost:${PORT}`);
    console.log(`📱 WebSocket enabled for real-time features`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = { app, server, io };
