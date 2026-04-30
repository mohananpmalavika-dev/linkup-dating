
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
const achievementsRoutes = require('./routes/achievements');
const ageVerificationRoutes = require('./routes/ageVerification');
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
const notificationRoutes = require('./routes/notifications');
const challengeRoutes = require('./routes/challenges');
const streakRoutes = require('./routes/streaks');
const introductionsRoutes = require('./routes/introductions');
const boostRoutes = require('./routes/boosts');
const preferencesPriorityRoutes = require('./routes/preferencesPriority');
const profileResetRoutes = require('./routes/profileReset');
const eventRoutes = require('./routes/events');
const doubleDatesRoutes = require('./routes/doubleDates');
const referralRoutes = require('./routes/referrals');
const referralsAdminRoutes = require('./routes/referralsAdmin');
const ipBlockingAdminRoutes = require('./routes/ipBlockingAdmin');
const analyticsRoutes = require('./routes/analytics');
const conversationQualityRoutes = require('./routes/conversationQuality');
const photoABTestingRoutes = require('./routes/photoABTesting');
const catfishDetectionRoutes = require('./routes/catfishDetection');
const videoVerificationRoutes = require('./routes/videoVerification');
const dateSafetyRoutes = require('./routes/dateSafety');
const icebreakerVideoRoutes = require('./routes/icebreakerVideos');
const momentsRoutes = require('./routes/moments');
const videoInsightsRoutes = require('./routes/videoInsights');
const { authenticateToken } = require('./middleware/auth');
const { checkIPBlock } = require('./middleware/ipBlocking');

// Category B: Socket handlers
const handleAchievementSocketEvents = require('./sockets/achievementSocketHandlers');
const privacyAwareActivityHandlers = require('./sockets/privacyAwareActivityHandlers');
const reactionSocketHandlers = require('./sockets/reactionSocketHandlers');
const SocketEventHandlers = require('./sockets/realTimeEventHandlers');

const app = express();

// Trust proxy configuration - MUST be set before other middleware
// This allows Express to correctly identify the client's IP address
// when the app is behind a proxy, load balancer, or CDN (like on Render, Heroku, AWS, etc.)
app.set('trust proxy', 1);

const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }
});

// Category B: Register real-time event handlers (presence, typing, activity, match notifications, profile changes)
SocketEventHandlers.registerHandlers(io);

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

// Mount IP blocking middleware EARLY - before other middleware
// This checks if the requesting IP is blocked and returns 403 if so
app.use(checkIPBlock);

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

    // Category B: Register achievement socket events for this user
    socket.achievementApi = handleAchievementSocketEvents(socket, socket.data.userId);
  });

  // Category B: Privacy-aware activity handlers
  socket.on('user_activity_update', (data) => {
    privacyAwareActivityHandlers.handleUserActivityUpdate(io, socket, data);
  });

  socket.on('activity_ended', (data) => {
    privacyAwareActivityHandlers.handleActivityEnded(io, socket, data);
  });

  socket.on('last_active_update', (data) => {
    privacyAwareActivityHandlers.handleLastActiveUpdate(io, socket, data);
  });

  socket.on('typing_indicator_privacy', (data) => {
    privacyAwareActivityHandlers.handleTypingIndicator(io, socket, data);
  });

  socket.on('online_status_privacy', (data) => {
    privacyAwareActivityHandlers.handleOnlineStatusUpdate(io, socket, data);
  });

  socket.on('privacy_level_change', (data) => {
    privacyAwareActivityHandlers.handlePrivacyLevelChange(io, socket, data);
  });

  socket.on('status_request', (data) => {
    privacyAwareActivityHandlers.handleStatusRequest(io, socket, data);
  });

  // Category B: Reaction socket handlers
  socket.on('emoji_reaction_added', (data) => {
    reactionSocketHandlers.handleEmojiReactionAdded(io, socket, data);
  });

  socket.on('custom_reaction_added', (data) => {
    reactionSocketHandlers.handleCustomReactionAdded(io, socket, data);
  });

  socket.on('reaction_removed', (data) => {
    reactionSocketHandlers.handleReactionRemoved(io, socket, data);
  });

  socket.on('request_message_reactions', (data) => {
    reactionSocketHandlers.handleRequestMessageReactions(io, socket, data);
  });

  socket.on('request_streak', (data) => {
    reactionSocketHandlers.handleRequestStreak(io, socket, data);
  });

  socket.on('get_suggested_reactions', (data) => {
    reactionSocketHandlers.handleGetSuggestedReactions(io, socket, data);
  });

  socket.on('get_top_reactions', (data) => {
    reactionSocketHandlers.handleGetTopReactions(io, socket, data);
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
      auth: '/api/auth/signup, /api/auth/login, /api/auth/verify, /api/auth/check-username, /api/auth/check-email, /api/auth/send-otp, /api/auth/verify-otp, /api/auth/set-username, /api/auth/me, /api/auth/visibility, /api/auth/contact-means, /api/auth/set-mpin, /api/auth/login-mpin, /api/auth/auth-methods',
      dating: '/api/dating/* (requires auth)',
      messaging: '/api/messaging/* (requires auth)',
      chatrooms: '/api/chatrooms/* (requires auth)'
    }
  });
});

// Routes with specific rate limiting
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/auth', authLimiter, ageVerificationRoutes);
app.use('/api/auth/send-otp', otpLimiter); // Override with stricter OTP limit
app.use('/api/achievements', achievementsRoutes);
app.use('/api/leaderboards', achievementsRoutes);
app.use('/api/filters', achievementsRoutes);
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
app.use('/api/notifications', authenticateToken, notificationRoutes);
app.use('/api/challenges', authenticateToken, challengeRoutes);
app.use('/api/streaks', authenticateToken, streakRoutes);
app.use('/api/introductions', authenticateToken, introductionsRoutes);
app.use('/api/boosts', boostRoutes);
app.use('/api/preferences-priority', authenticateToken, preferencesPriorityRoutes);
app.use('/api/profile-reset', authenticateToken, profileResetRoutes);
app.use('/api/events', authenticateToken, eventRoutes);
app.use('/api/double-dates', authenticateToken, doubleDatesRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/admin/referrals', referralsAdminRoutes);
app.use('/api/admin/ip-blocking', ipBlockingAdminRoutes);
app.use('/api/analytics', authenticateToken, analyticsRoutes);
app.use('/api/conversation-quality', authenticateToken, conversationQualityRoutes);
app.use('/api/photo-ab-testing', authenticateToken, photoABTestingRoutes);
app.use('/api/catfish-detection', authenticateToken, catfishDetectionRoutes);
app.use('/api/video-verification', authenticateToken, videoVerificationRoutes);
app.use('/api/date-safety', authenticateToken, dateSafetyRoutes);
app.use('/api/icebreaker-videos', authenticateToken, icebreakerVideoRoutes);
app.use('/api/moments', momentsRoutes);
app.use('/api/video-insights', videoInsightsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Backend is running', timestamp: new Date() });
});

// 404 Handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    message: `The endpoint ${req.method} ${req.path} does not exist`,
    availableEndpoints: {
      auth: '/api/auth/signup, /api/auth/login, /api/auth/verify, /api/auth/check-username, /api/auth/check-email, /api/auth/send-otp, /api/auth/verify-otp, /api/auth/set-username, /api/auth/me, /api/auth/visibility, /api/auth/contact-means, /api/auth/set-mpin, /api/auth/login-mpin, /api/auth/auth-methods',
      products: '/api/products, /api/products/manage',
      orders: '/api/orders/*, /api/orders/mine, /api/orders/manage, /api/orders/payment-config, /api/orders/verify-payment',
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
  .then(async () => {
    // Sync Sequelize models with controlled order to prevent foreign key constraint errors
    try {
      const dbModels = require('./models');
      const { syncModelsInOrder } = require('./utils/syncModels');

      logger.info('Starting controlled model sync...');
      syncModelsInOrder(dbModels.sequelize, dbModels, logger).then(async () => {
        logger.info('✓ Sequelize models synchronized successfully');
        
        // Initialize IP blocklist table (critical for auth flows)
        try {
          logger.info('Initializing IP blocklist table...');
          const { Pool } = require('pg');
          const pool = new Pool({
            connectionString: process.env.DATABASE_URL || 
              `postgres://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'linkup_dating'}`,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
          });

          const client = await pool.connect();
          try {
            // Create table if not exists
            await client.query(`
              CREATE TABLE IF NOT EXISTS "ip_blocklist" (
                "id" SERIAL PRIMARY KEY,
                "ip_address" VARCHAR(45) NOT NULL,
                "reason" VARCHAR(255) DEFAULT 'underage_attempt',
                "block_duration_hours" INTEGER DEFAULT 2,
                "blocked_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "expires_at" TIMESTAMP NOT NULL,
                "attempted_email" VARCHAR(255),
                "attempted_age" INTEGER,
                "attempt_count" INTEGER DEFAULT 1,
                "is_active" BOOLEAN DEFAULT true,
                "removed_at" TIMESTAMP,
                "removed_by_admin_id" INTEGER,
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE("ip_address")
              );
            `);

            // Create indexes
            await client.query(`
              CREATE INDEX IF NOT EXISTS "idx_ip_blocklist_ip_active_expires" 
                ON "ip_blocklist" ("ip_address", "is_active", "expires_at");
            `);

            logger.info('✓ IP blocklist table initialized');
          } finally {
            await client.end();
            await pool.end();
          }
        } catch (err) {
          logger.warn('Failed to initialize IP blocklist table', {
            message: err.message,
            code: err.code
          });
          // Don't fail startup if IP blocklist init fails
        }

        // Initialize default admin settings for IP blocking and age verification
        try {
          const AdminSettingsService = require('./services/adminSettingsService');
          await AdminSettingsService.initializeDefaultSettings();
          logger.info('✓ Default admin settings initialized');
        } catch (err) {
          logger.error('Failed to initialize admin settings', {
            message: err.message,
            stack: err.stack
          });
        }
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
