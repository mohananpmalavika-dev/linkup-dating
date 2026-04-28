/**
 * STREAK TRACKING - INTEGRATION CODE EXAMPLES
 * 
 * Copy and paste these code snippets into your project
 * to integrate streak tracking with the messaging system
 */

// ============================================================================
// 1. SERVER.JS - Register Streak Routes
// ============================================================================

// Add this to backend/server.js in the routes section:

/*
// ========== STREAK ROUTES ==========
const streakRoutes = require('./routes/streaks');
app.use('/api/streaks', authenticateToken, streakRoutes);
*/

// ============================================================================
// 2. MESSAGING ROUTE - Update on Message Send
// ============================================================================

// Example: Update backend/routes/messaging.js

/*
const express = require('express');
const router = express.Router();
const { Message, Match } = require('../models');
const streakService = require('../services/streakService');
const { authenticateToken } = require('../middleware/auth');

// Send message
router.post('/matches/:matchId/messages', authenticateToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    // Find the match
    const match = await Match.findByPk(matchId);
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    // Determine sender and recipient
    const isUser1 = match.userId1 === userId;
    const otherUserId = isUser1 ? match.userId2 : match.userId1;

    // Create the message
    const message = await Message.create({
      matchId,
      fromUserId: userId,
      toUserId: otherUserId,
      content,
      isRead: false
    });

    // *** UPDATE STREAK ON MESSAGE ***
    const streakResult = await streakService.updateStreakOnMessage(
      matchId,
      match.userId1,
      match.userId2
    );

    // Emit real-time updates via Socket.io (if available)
    if (req.io) {
      // Notify both users of the new streak data
      req.io.to(`match_${matchId}`).emit('streak:updated', {
        success: true,
        matchId,
        streak: streakResult.streak,
        milestoneTrigger: streakResult.milestoneTrigger,
        timestamp: new Date()
      });

      // If milestone was reached, emit special milestone event
      if (streakResult.milestoneTrigger) {
        req.io.to(`user_${otherUserId}`).emit('milestone:achieved', {
          matchId,
          milestone: streakResult.milestoneTrigger.milestone,
          description: streakResult.milestoneTrigger.description,
          streakDays: streakResult.streak.streakDays
        });
      }
    }

    // Send milestone notification if applicable
    if (streakResult.milestoneTrigger) {
      const notificationService = require('../services/notificationService');
      try {
        await notificationService.create({
          userId: otherUserId,
          type: 'STREAK_MILESTONE',
          title: '🎉 Milestone Reached!',
          message: streakResult.milestoneTrigger.description,
          relatedId: matchId,
          relatedType: 'MATCH'
        });
      } catch (error) {
        console.error('Error sending milestone notification:', error);
      }
    }

    // Return success response
    res.json({
      success: true,
      message: message.toJSON(),
      streak: streakResult.streak,
      milestoneTrigger: streakResult.milestoneTrigger
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
*/

// ============================================================================
// 3. SOCKET.IO - Real-time Streak Updates
// ============================================================================

// Add this to backend/sockets/messageSocket.js or similar:

/*
const streakService = require('../services/streakService');

// Handle message send via WebSocket
socket.on('message:send', async (data) => {
  try {
    const { matchId, content, fromUserId, toUserId } = data;

    // Save message to database
    const message = await Message.create({
      matchId,
      fromUserId,
      toUserId,
      content,
      isRead: false
    });

    // Update streak
    const streakResult = await streakService.updateStreakOnMessage(
      matchId,
      fromUserId,
      toUserId
    );

    // Emit to both users
    io.to(`user_${toUserId}`).emit('message:new', {
      message: message.toJSON()
    });

    io.to(`match_${matchId}`).emit('streak:updated', {
      matchId,
      streak: streakResult.streak,
      milestoneTrigger: streakResult.milestoneTrigger
    });

    // Notify about milestone if applicable
    if (streakResult.milestoneTrigger) {
      io.to(`user_${toUserId}`).emit('streak:milestone', {
        description: streakResult.milestoneTrigger.description,
        days: streakResult.streak.streakDays
      });

      io.to(`user_${fromUserId}`).emit('streak:milestone', {
        description: streakResult.milestoneTrigger.description,
        days: streakResult.streak.streakDays
      });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    socket.emit('error', { message: 'Failed to send message' });
  }
});
*/

// ============================================================================
// 4. DAILY TASK - Check for At-Risk Streaks
// ============================================================================

// Add this to backend/server.js or a separate task file:

/*
const schedule = require('node-schedule');
const { MessageStreakTracker, User, Notification } = require('./models');
const { Op } = require('sequelize');

// Schedule to run at 11 PM daily (checks for streaks at risk)
schedule.scheduleJob('0 23 * * *', async () => {
  try {
    console.log('[CRON] 🔍 Checking for streaks at risk...');

    // Find all active streaks where last message was 23-24 hours ago
    const riskyStreaks = await MessageStreakTracker.findAll({
      where: {
        isActive: true,
        lastMessageDate: {
          [Op.between]: [
            new Date(Date.now() - 24 * 60 * 60 * 1000),  // 24 hours ago
            new Date(Date.now() - 23 * 60 * 60 * 1000)   // 23 hours ago
          ]
        }
      },
      include: [
        { model: User, as: 'user1', attributes: ['id', 'firstName'] },
        { model: User, as: 'user2', attributes: ['id', 'firstName'] }
      ]
    });

    console.log(`[CRON] Found ${riskyStreaks.length} at-risk streaks`);

    // Send notifications for each at-risk streak
    for (const streak of riskyStreaks) {
      // Notify user1
      await Notification.create({
        userId: streak.userId1,
        type: 'STREAK_WARNING',
        title: '🚨 Streak at Risk!',
        message: `Your ${streak.streakDays}-day streak with ${streak.user2.firstName} ends at midnight! Send a message to save it!`,
        relatedId: streak.matchId,
        relatedType: 'MATCH',
        priority: 'HIGH'
      });

      // Notify user2
      await Notification.create({
        userId: streak.userId2,
        type: 'STREAK_WARNING',
        title: '🚨 Streak at Risk!',
        message: `Your ${streak.streakDays}-day streak with ${streak.user1.firstName} ends at midnight! Send a message to save it!`,
        relatedId: streak.matchId,
        relatedType: 'MATCH',
        priority: 'HIGH'
      });

      // Mark notification as sent
      streak.notificationSent = true;
      streak.lastNotificationDate = new Date();
      await streak.save();
    }

    console.log('[CRON] ✅ At-risk streak notifications sent');
  } catch (error) {
    console.error('[CRON] ❌ Error checking streaks:', error);
  }
});

// Schedule to run at 12:01 AM daily (detects broken streaks)
schedule.scheduleJob('1 0 * * *', async () => {
  try {
    console.log('[CRON] 🔍 Checking for broken streaks...');

    // Find all active streaks with no message in 24+ hours
    const brokenStreaks = await MessageStreakTracker.findAll({
      where: {
        isActive: true,
        lastMessageDate: {
          [Op.lt]: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });

    console.log(`[CRON] Found ${brokenStreaks.length} broken streaks`);

    // Mark as inactive and record break date
    for (const streak of brokenStreaks) {
      streak.isActive = false;
      streak.streakBrokenDate = new Date();
      await streak.save();
    }

    console.log('[CRON] ✅ Broken streaks marked as inactive');
  } catch (error) {
    console.error('[CRON] ❌ Error processing broken streaks:', error);
  }
});
*/

// ============================================================================
// 5. FRONTEND - Use Streak Hook in Component
// ============================================================================

// Example: Update src/components/DatingMessaging.jsx

/*
import React, { useState, useEffect } from 'react';
import useStreaks from '../hooks/useStreaks';
import StreakBadge from './StreakBadge';

const DatingMessaging = () => {
  const [matches, setMatches] = useState([]);
  const { userStreaks, leaderboard, refetch } = useStreaks();

  // Refresh streaks when component mounts or user sends message
  const handleMessageSent = (matchId) => {
    // Message was sent, refresh streak data
    setTimeout(() => {
      refetch();
    }, 500);
  };

  return (
    <div className="dating-messaging">
      {/* Streak leaderboard */}
      <section className="leaderboard-section">
        <h2>🔥 Top Streaks</h2>
        {leaderboard.slice(0, 5).map((streak) => (
          <div key={streak.id} className="leaderboard-item">
            <span>{streak.matchNames}</span>
            <span>{streak.flameEmoji} {streak.streakDays}</span>
          </div>
        ))}
      </section>

      {/* Match list with streaks */}
      <section className="matches-list">
        <h2>📱 Your Matches</h2>
        {matches.map((match) => (
          <div key={match.id} className="match-item">
            <div className="match-header">
              <img 
                src={match.profilePhotoUrl} 
                alt={match.firstName}
                className="avatar"
              />
              <div className="match-info">
                <h3>{match.firstName}</h3>
                <p>{match.lastMessage}</p>
              </div>
              
              {/* Streak badge with flame */}
              <StreakBadge 
                matchId={match.id}
                matchName={match.firstName}
                compact={true}
              />
            </div>

            {/* Message area */}
            <div className="message-area">
              {/* ... message display ... */}
              <MessageInput 
                matchId={match.id}
                onMessageSent={() => handleMessageSent(match.id)}
              />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
};

export default DatingMessaging;
*/

// ============================================================================
// 6. MIGRATION - Create Database Schema
// ============================================================================

// Run: npm run migrate (or manually execute if using Sequelize migrations)

/*
-- This creates the message_streak_trackers table
CREATE TABLE IF NOT EXISTS message_streak_trackers (
  id SERIAL PRIMARY KEY,
  user_id_1 INTEGER NOT NULL,
  user_id_2 INTEGER NOT NULL,
  match_id INTEGER NOT NULL UNIQUE,
  streak_days INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  streak_start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_message_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  streak_broken_date TIMESTAMP,
  milestone_3_days BOOLEAN DEFAULT false,
  milestone_7_days BOOLEAN DEFAULT false,
  milestone_30_days BOOLEAN DEFAULT false,
  total_messages INTEGER DEFAULT 0,
  total_reactions INTEGER DEFAULT 0,
  engagement_score FLOAT DEFAULT 0,
  notification_sent BOOLEAN DEFAULT false,
  last_notification_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id_1) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id_2) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX idx_mst_user_id_1 ON message_streak_trackers(user_id_1);
CREATE INDEX idx_mst_user_id_2 ON message_streak_trackers(user_id_2);
CREATE INDEX idx_mst_match_id ON message_streak_trackers(match_id);
CREATE INDEX idx_mst_is_active ON message_streak_trackers(is_active);
CREATE INDEX idx_mst_streak_days ON message_streak_trackers(streak_days DESC);
CREATE INDEX idx_mst_last_message_date ON message_streak_trackers(last_message_date DESC);
*/

// ============================================================================
// 7. TESTING - API Test Examples
// ============================================================================

// Using cURL or Postman:

/*
// Get user's streaks
GET /api/streaks/user/active?limit=50
Authorization: Bearer YOUR_TOKEN

// Get specific match streak
GET /api/streaks/match/123
Authorization: Bearer YOUR_TOKEN

// Get global leaderboard
GET /api/streaks/leaderboard?limit=20

// Get user statistics
GET /api/streaks/user/stats
Authorization: Bearer YOUR_TOKEN

// Get milestone information
GET /api/streaks/milestones/15
*/

// ============================================================================
// 8. EXAMPLE RESPONSE FORMATS
// ============================================================================

/*
// Match Streak Response
{
  "success": true,
  "streak": {
    "id": 123,
    "userId1": 1,
    "userId2": 2,
    "matchId": 456,
    "streakDays": 7,
    "isActive": true,
    "streakStartDate": "2026-04-21T00:00:00Z",
    "lastMessageDate": "2026-04-28T18:32:15Z",
    "milestone3Days": true,
    "milestone7Days": false,
    "totalMessages": 145,
    "engagementScore": 1725,
    "flameEmoji": "🔥🔥",
    "flameLevel": 2,
    "isBadgeEarned": true,
    "daysSinceMessage": 0,
    "daysUntilBroken": 1,
    "otherUser": {
      "id": 2,
      "firstName": "Alice",
      "profilePhotoUrl": "..."
    }
  }
}

// User Streaks Response
{
  "success": true,
  "streaks": [
    {
      "id": 123,
      "streakDays": 15,
      "flameEmoji": "🔥🔥🔥",
      "flameLevel": 2,
      "isBadgeEarned": true,
      "daysUntilBroken": 1,
      "otherUser": { ... }
    }
  ]
}

// Leaderboard Response
{
  "success": true,
  "leaderboard": [
    {
      "rank": 1,
      "streakDays": 245,
      "flameEmoji": "🔥🔥🔥🔥🔥",
      "matchNames": "Alice & Bob",
      "totalMessages": 2456,
      "engagementScore": 4523
    }
  ]
}
*/

// ============================================================================
// END OF EXAMPLES
// ============================================================================

/**
 * NEXT STEPS:
 * 
 * 1. Copy the code snippets above to their respective files
 * 2. Update imports and paths as needed for your project structure
 * 3. Install any required dependencies (if not already present)
 * 4. Run database migration
 * 5. Test the streak system end-to-end
 * 6. Monitor engagement metrics
 * 
 * For more information, see:
 * - STREAK_TRACKING_IMPLEMENTATION.md (Full documentation)
 * - STREAK_TRACKING_QUICK_START.md (Quick reference)
 */
