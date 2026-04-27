const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const socketIO = require('socket.io');
require('dotenv').config();

const db = require('./config/database');
const { logger, logRequest } = require('./utils/logger');
const { apiLimiter, authLimiter, otpLimiter } = require('./middleware/rateLimit');
const authRoutes = require('./routes/auth');
const datingRoutes = require('./routes/dating');
const messagingRoutes = require('./routes/messaging');
const messagingEnhancedRoutes = require('./routes/messagingEnhanced');
const chatroomsRoutes = require('./routes/chatrooms');
const lobbyRoutes = require('./routes/lobby');
const adminRoutes = require('./routes/admin');
const productsRoutes = require('./routes/products');
const ordersRoutes = require('./routes/orders');
const appDataRoutes = require('./routes/app-data');
const astrologyRoutes = require('./routes/astrology');
const flashsalesRoutes = require('./routes/flashsales');
const videoCallRoutes = require('./routes/video-calls');
const socialRoutes = require('./routes/social');
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

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:3000'],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request Logging Middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    logRequest(req, res, startTime);
  });
  next();
});

// Apply general API rate limiting
app.use('/api/', apiLimiter);

// Store active users for real-time features.
// Each user can have multiple active sockets (multiple tabs/devices).
const activeUsers = new Map();

const normalizeUserKey = (userId) => String(userId);

const getSocketIdsForUser = (userId) => {
  const userSockets = activeUsers.get(normalizeUserKey(userId));
  return userSockets ? Array.from(userSockets) : [];
};

const emitToUser = (userId, eventName, payload) => {
  const socketIds = getSocketIdsForUser(userId);

  socketIds.forEach((socketId) => {
    io.to(socketId).emit(eventName, payload);
  });

  return socketIds.length > 0;
};

const markUserOnline = (userId, socketId) => {
  const userKey = normalizeUserKey(userId);
  let userSockets = activeUsers.get(userKey);
  const wasOffline = !userSockets || userSockets.size === 0;

  if (!userSockets) {
    userSockets = new Set();
    activeUsers.set(userKey, userSockets);
  }

  userSockets.add(socketId);
  return wasOffline;
};

const markUserOffline = (socketId) => {
  for (const [userKey, userSockets] of activeUsers.entries()) {
    if (!userSockets.has(socketId)) {
      continue;
    }

    userSockets.delete(socketId);

    if (userSockets.size === 0) {
      activeUsers.delete(userKey);
      return { userId: userKey, becameOffline: true };
    }

    return { userId: userKey, becameOffline: false };
  }

  return null;
};

// WebSocket Connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('user_online', (userId) => {
    if (!userId) {
      return;
    }

    socket.data.userId = normalizeUserKey(userId);
    const wasOffline = markUserOnline(userId, socket.id);

    if (wasOffline) {
      io.emit('user_status', { userId, online: true });
    }
  });

  socket.on('send_message', (data) => {
    const { fromUserId, toUserId, message, matchId } = data;

    emitToUser(toUserId, 'receive_message', {
      fromUserId,
      matchId,
      message,
      timestamp: new Date()
    });
  });

  socket.on('typing', (data) => {
    const { toUserId, isTyping } = data;

    emitToUser(toUserId, 'user_typing', { isTyping });
  });

  socket.on('join_chatroom', (chatroomId) => {
    if (!chatroomId) {
      return;
    }

    socket.join(`chatroom_${chatroomId}`);
  });

  socket.on('leave_chatroom', (chatroomId) => {
    if (!chatroomId) {
      return;
    }

    socket.leave(`chatroom_${chatroomId}`);
  });

  socket.on('join_lobby', () => {
    socket.join('lobby');
  });

  socket.on('leave_lobby', () => {
    socket.leave('lobby');
  });

  socket.on('call:invite', (data = {}) => {
    const { callId, targetUserId, callType = 'video', matchId, fromUserName, videoDateId } = data;

    if (!targetUserId || !callId) {
      return;
    }

    emitToUser(targetUserId, 'call:incoming', {
      callId,
      matchId,
      videoDateId: videoDateId || null,
      callType,
      fromUserId: socket.data.userId || null,
      fromUserName: fromUserName || null,
      createdAt: new Date().toISOString()
    });
  });

  socket.on('call:accept', (data = {}) => {
    const { callId, targetUserId, matchId } = data;

    if (!targetUserId || !callId) {
      return;
    }

    emitToUser(targetUserId, 'call:accepted', {
      callId,
      matchId,
      fromUserId: socket.data.userId || null,
      acceptedAt: new Date().toISOString()
    });
  });

  socket.on('call:decline', (data = {}) => {
    const { callId, targetUserId, matchId } = data;

    if (!targetUserId || !callId) {
      return;
    }

    emitToUser(targetUserId, 'call:declined', {
      callId,
      matchId,
      fromUserId: socket.data.userId || null,
      declinedAt: new Date().toISOString()
    });
  });

  socket.on('call:end', (data = {}) => {
    const { callId, targetUserId, matchId, reason = 'ended' } = data;

    if (!targetUserId || !callId) {
      return;
    }

    emitToUser(targetUserId, 'call:ended', {
      callId,
      matchId,
      fromUserId: socket.data.userId || null,
      reason,
      endedAt: new Date().toISOString()
    });
  });

  socket.on('call:ready', (data = {}) => {
    const { callId, targetUserId, matchId } = data;

    if (!targetUserId || !callId) {
      return;
    }

    emitToUser(targetUserId, 'call:ready', {
      callId,
      matchId,
      fromUserId: socket.data.userId || null
    });
  });

  socket.on('call:signal', (data = {}) => {
    const { callId, targetUserId, matchId, description, candidate } = data;

    if (!targetUserId || !callId) {
      return;
    }

    emitToUser(targetUserId, 'call:signal', {
      callId,
      matchId,
      fromUserId: socket.data.userId || null,
      description: description || null,
      candidate: candidate || null
    });
  });

  // Social Features Socket Events
  socket.on('friend:request', (data = {}) => {
    const { targetUserId, requesterName } = data;
    if (!targetUserId) return;
    
    emitToUser(targetUserId, 'friend:request', {
      fromUserId: socket.data.userId,
      fromUserName: requesterName,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('friend:accepted', (data = {}) => {
    const { targetUserId } = data;
    if (!targetUserId) return;
    
    emitToUser(targetUserId, 'friend:accepted', {
      fromUserId: socket.data.userId,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('group:message', (data = {}) => {
    const { groupId, message, senderName } = data;
    if (!groupId) return;
    
    io.to(`group_${groupId}`).emit('group:message', {
      groupId,
      fromUserId: socket.data.userId,
      fromUserName: senderName,
      message,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('join_group', (groupId) => {
    if (!groupId) return;
    socket.join(`group_${groupId}`);
  });

  socket.on('leave_group', (groupId) => {
    if (!groupId) return;
    socket.leave(`group_${groupId}`);
  });

  socket.on('group:typing', (data = {}) => {
    const { groupId, isTyping } = data;
    if (!groupId) return;
    
    io.to(`group_${groupId}`).emit('group:typing', {
      groupId,
      userId: socket.data.userId,
      isTyping
    });
  });

  socket.on('call:settings', (data = {}) => {
    const {
      callId,
      targetUserId,
      matchId,
      videoDateId,
      qualityPreset,
      virtualBackground,
      screenShareEnabled,
      recordingRequested,
      recordingEnabled,
      recordingConsent
    } = data;

    if (!targetUserId || !callId) {
      return;
    }

    emitToUser(targetUserId, 'call:settings', {
      callId,
      matchId,
      videoDateId,
      fromUserId: socket.data.userId || null,
      qualityPreset: qualityPreset || null,
      virtualBackground: virtualBackground || null,
      screenShareEnabled: screenShareEnabled === undefined ? null : Boolean(screenShareEnabled),
      recordingRequested: recordingRequested === undefined ? null : Boolean(recordingRequested),
      recordingEnabled: recordingEnabled === undefined ? null : Boolean(recordingEnabled),
      recordingConsent: recordingConsent === undefined ? null : Boolean(recordingConsent)
    });
  });

  socket.on('disconnect', () => {
    const offlineResult = markUserOffline(socket.id);

    if (offlineResult?.becameOffline) {
      io.emit('user_status', { userId: offlineResult.userId, online: false });
      console.log('User offline:', offlineResult.userId);
    }
  });
});

// Make io accessible to routes
app.use((req, res, next) => {
  req.io = io;
  req.activeUsers = activeUsers;
  req.emitToUser = emitToUser;
  req.getOnlineUserCount = () => activeUsers.size;
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
      messaging: '/api/messaging/* (requires auth)',
      chatrooms: '/api/chatrooms/* (requires auth)',
      lobby: '/api/lobby/* (requires auth)'
    }
  });
});

// Routes with specific rate limiting
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/auth/send-otp', otpLimiter); // Override with stricter OTP limit
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/app-data', appDataRoutes);
app.use('/api/astrology', astrologyRoutes);
app.use('/api/flashsales', flashsalesRoutes);
app.use('/api/dating/video-calls', authenticateToken, videoCallRoutes);
app.use('/api/dating', authenticateToken, datingRoutes);
app.use('/api/messaging', authenticateToken, messagingRoutes);
app.use('/api/messaging', authenticateToken, messagingEnhancedRoutes);
app.use('/api/chatrooms', authenticateToken, chatroomsRoutes);
app.use('/api/lobby', authenticateToken, lobbyRoutes);
app.use('/api/admin', authenticateToken, adminRoutes);
app.use('/api/social', socialRoutes);

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
      chatrooms: '/api/chatrooms/* (requires auth)',
      lobby: '/api/lobby/* (requires auth)',
      health: '/health'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    userId: req.user?.id
  });
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;

const startServer = () => {
  if (server.listening) {
    return;
  }

  server.listen(PORT, () => {
    logger.info('Dating app backend running', {
      url: `http://localhost:${PORT}`
    });
    logger.info('WebSocket enabled for real-time features');
    logger.info('Database configuration loaded', {
      database: process.env.DB_NAME || 'linkup_dating'
    });
  });
};

// Initialize database and start server
db.init()
  .then(() => {
    // Sync Sequelize models (alter: true for development, use migrations in production)
    if (process.env.NODE_ENV !== 'production') {
      try {
        const dbModels = require('./models');

        dbModels.sequelize.sync({ alter: true }).then(() => {
          logger.info('Sequelize models synchronized');
        }).catch(err => {
          logger.error('Sequelize sync error', {
            message: err.message,
            stack: err.stack
          });
        });
      } catch (err) {
        logger.error('Failed to load Sequelize models for sync', {
          message: err.message,
          stack: err.stack
        });
      }
    }

    startServer();
  })
  .catch(err => {
    logger.error('Failed to initialize database', {
      message: err.message,
      stack: err.stack
    });

    if (process.env.NODE_ENV === 'production') {
      logger.warn('Starting server without database initialization so the app can stay online.');
      startServer();
      return;
    }

    process.exit(1);
  });

module.exports = { app, server, io };
