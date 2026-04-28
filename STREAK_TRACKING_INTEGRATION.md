/**
 * STREAK TRACKING INTEGRATION GUIDE
 * 
 * This guide shows how to integrate streak tracking into the messaging system
 * for comprehensive engagement psychology and gamification.
 */

/**
 * 1. UPDATE SERVER.JS - Register Streak Routes
 * 
 * Add this to the routes section in backend/server.js:
 */

// After other route registrations, add:
const streakRoutes = require('./routes/streaks');

// ... in the Express app configuration section:
app.use('/api/streaks', authenticateToken, streakRoutes);

/**
 * Example code to add to server.js:
 * 
 * // ============ STREAK ROUTES ============
 * const streakRoutes = require('./routes/streaks');
 * app.use('/api/streaks', authenticateToken, streakRoutes);
 */

// ============================================================================

/**
 * 2. UPDATE MESSAGE HANDLER - Trigger Streak Updates
 * 
 * In backend/routes/messaging.js or backend/sockets/messageSocket.js,
 * after a message is successfully saved, call streakService:
 */

const streakService = require('../services/streakService');

// Example: In message creation endpoint
router.post('/matches/:matchId/messages', authenticateToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    // ... existing message creation code ...

    // Save the message
    const message = await Message.create({
      matchId,
      fromUserId: userId,
      toUserId: otherUserId,
      content,
      isRead: false
    });

    // *** UPDATE STREAK ON NEW MESSAGE ***
    const streakResult = await streakService.updateStreakOnMessage(
      matchId,
      userId,
      otherUserId
    );

    // Emit streak update to Socket.io for real-time UI updates
    req.io.to(`match_${matchId}`).emit('streak:updated', {
      matchId,
      streak: streakResult.streak,
      milestoneTrigger: streakResult.milestoneTrigger
    });

    // Send milestone notification if milestone reached
    if (streakResult.milestoneTrigger) {
      const notificationService = require('../services/notificationService');
      await notificationService.sendMilestoneNotification(
        otherUserId,
        userId,
        streakResult.milestoneTrigger
      );
    }

    res.json({
      success: true,
      message,
      streak: streakResult.streak
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================

/**
 * 3. FRONTEND INTEGRATION - Use Streak Hook in Components
 * 
 * Example: In src/components/DatingMessaging.jsx or similar
 */

import useStreaks from '../hooks/useStreaks';
import StreakBadge from './StreakBadge';
import StreakLeaderboard from './StreakLeaderboard';

const DatingMessaging = () => {
  const { currentStreak, userStreaks } = useStreaks();

  return (
    <div className="messaging-container">
      {/* Match list with streak badges */}
      <div className="matches-list">
        {matches.map(match => (
          <div key={match.id} className="match-item">
            <StreakBadge 
              matchId={match.id}
              matchName={match.otherUser.firstName}
              compact={true}
            />
            {/* ... rest of match display ... */}
          </div>
        ))}
      </div>

      {/* Streak leaderboard section */}
      <div className="leaderboard-section">
        <StreakLeaderboard limit={10} />
      </div>

      {/* Expanded streak view */}
      {currentStreak && (
        <div className="streak-detail">
          <StreakBadge 
            matchId={currentStreak.matchId}
            matchName={currentStreak.otherUser.firstName}
            compact={false}
          />
        </div>
      )}
    </div>
  );
};

// ============================================================================

/**
 * 4. DISPLAY IN MATCH LIST - Show Flame Counter
 * 
 * In src/components/MatchListItem.jsx:
 */

import StreakBadge from './StreakBadge';

const MatchListItem = ({ match, onClick }) => {
  return (
    <div className="match-item" onClick={onClick}>
      <div className="match-header">
        <img src={match.profilePhoto} alt={match.name} className="avatar" />
        <div className="match-info">
          <h3>{match.name}</h3>
          <p>{match.lastMessage}</p>
        </div>
        
        {/* Add streak badge */}
        <StreakBadge 
          matchId={match.id}
          matchName={match.name}
          compact={true}
        />
      </div>
    </div>
  );
};

// ============================================================================

/**
 * 5. SOCKET.IO EVENTS - Real-time Streak Updates
 * 
 * In backend/sockets/messageSocket.js, add:
 */

// Listen for new messages and update streaks
socket.on('message:send', async (data) => {
  const { matchId, content, fromUserId, toUserId } = data;

  try {
    // ... save message ...

    // Update streak
    const streakService = require('../services/streakService');
    const streakResult = await streakService.updateStreakOnMessage(
      matchId,
      fromUserId,
      toUserId
    );

    // Emit to both users
    io.to(`user_${toUserId}`).emit('streak:updated', {
      matchId,
      streak: streakResult.streak,
      milestoneTrigger: streakResult.milestoneTrigger
    });

    io.to(`user_${fromUserId}`).emit('streak:updated', {
      matchId,
      streak: streakResult.streak,
      milestoneTrigger: streakResult.milestoneTrigger
    });
  } catch (error) {
    console.error('Error updating streak:', error);
  }
});

// ============================================================================

/**
 * 6. NOTIFICATION INTEGRATION - Send FOMO Triggers
 * 
 * Create backend/services/streakNotificationService.js:
 */

const streakNotificationService = {
  /**
   * Send milestone achievement notification
   */
  async sendMilestoneNotification(recipientUserId, senderUserId, milestone) {
    const sender = await User.findByPk(senderUserId);
    
    const notificationText = {
      '3_day': `🔥 You hit a 3-day streak with ${sender.firstName}! Keep it up!`,
      '7_day': `🔥🔥 Amazing! You've reached a 7-day streak with ${sender.firstName}!`,
      '30_day': `🔥🔥🔥 Incredible! 30-day streak with ${sender.firstName}! You're crushing it!`,
      '100_day': `🔥🔥🔥🔥🔥 LEGENDARY! 100-day streak with ${sender.firstName}!`
    };

    return await Notification.create({
      userId: recipientUserId,
      type: 'streak_milestone',
      title: 'Milestone Reached! 🎉',
      message: notificationText[milestone.milestone] || milestone.description,
      actionUrl: `/matches/${milestone.matchId}`,
      readAt: null
    });
  },

  /**
   * Send streak at risk warning (FOMO trigger)
   */
  async sendStreakAtRiskNotification(userId, matchId, otherUserName) {
    return await Notification.create({
      userId,
      type: 'streak_warning',
      title: '🚨 Streak at Risk!',
      message: `Your streak with ${otherUserName} ends at midnight! Send a message to save it!`,
      actionUrl: `/matches/${matchId}`,
      readAt: null,
      priority: 'high'
    });
  }
};

module.exports = streakNotificationService;

// ============================================================================

/**
 * 7. DAILY TASK - Check for Broken Streaks
 * 
 * Add a scheduled task to check for streaks about to break (in server.js or separate task file):
 */

const schedule = require('node-schedule');
const streakService = require('./services/streakService');

// Run at 11 PM daily to warn users of streaks at risk
schedule.scheduleJob('0 23 * * *', async () => {
  try {
    console.log('🔍 Checking for streaks at risk...');

    // Get all active streaks where last message was yesterday
    const riskyStreaks = await MessageStreakTracker.findAll({
      where: {
        isActive: true,
        lastMessageDate: {
          [Op.between]: [
            new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
            new Date(Date.now() - 23 * 60 * 60 * 1000)  // 23 hours ago
          ]
        }
      },
      include: [
        { model: User, as: 'user1' },
        { model: User, as: 'user2' }
      ]
    });

    // Send notifications for each risky streak
    for (const streak of riskyStreaks) {
      const streakNotificationService = require('./services/streakNotificationService');
      
      await streakNotificationService.sendStreakAtRiskNotification(
        streak.userId1,
        streak.matchId,
        streak.user2.firstName
      );
      
      await streakNotificationService.sendStreakAtRiskNotification(
        streak.userId2,
        streak.matchId,
        streak.user1.firstName
      );
    }

    console.log(`✅ Checked ${riskyStreaks.length} at-risk streaks`);
  } catch (error) {
    console.error('❌ Error checking streaks:', error);
  }
});

// ============================================================================

/**
 * 8. DEBUGGING & TESTING
 * 
 * Test endpoints:
 */

// Get user's active streaks
GET /api/streaks/user/active

// Get specific match streak
GET /api/streaks/match/{matchId}

// Get global leaderboard
GET /api/streaks/leaderboard?limit=20

// Get milestones for a streak length
GET /api/streaks/milestones/7

// Get user's streak statistics
GET /api/streaks/user/stats

// ============================================================================

/**
 * 9. PSYCHOLOGY CONFIGURATION
 * 
 * Milestone triggers and flame levels:
 */

const STREAK_CONFIG = {
  MILESTONES: {
    FIRST_BADGE: 3,        // Show flame emoji at 3+ days
    SEVEN_DAY: 7,          // Major milestone
    THIRTY_DAY: 30,        // Extended engagement
    HUNDRED_DAY: 100       // Extreme dedication
  },
  
  FLAME_LEVELS: {
    0: '🔥',              // 1-2 days
    1: '🔥🔥',            // 3-6 days
    2: '🔥🔥🔥',          // 7-29 days
    3: '🔥🔥🔥🔥',        // 30-99 days
    4: '🔥🔥🔥🔥🔥'      // 100+ days
  },

  // FOMO triggers
  NOTIFICATIONS: {
    MILESTONE_REACHED: true,           // When hitting milestone
    STREAK_BROKEN_WARNING: true,       // 1 hour before midnight
    STREAK_BROKEN_CONFIRMATION: true   // When streak actually breaks
  },

  // Engagement scoring
  ENGAGEMENT_FORMULA: (streakDays, totalMessages) => {
    return (streakDays * 10) + (totalMessages * 0.5);
  }
};

// ============================================================================

/**
 * 10. DAILY CHALLENGE INTEGRATION
 * 
 * Streaks complement Daily Challenges:
 * 
 * Daily Challenges give points for specific actions (Mon/Wed/Fri)
 * Streaks give badges for consistent engagement (daily messaging)
 * 
 * Combined psychology:
 * - Challenges: "Complete 5 challenges this week for 50 points"
 * - Streaks: "Maintain a 7-day streak for the Week Warrior badge"
 * 
 * Both drive daily engagement but with different reinforcement patterns.
 */

// ============================================================================

/**
 * SUCCESS INDICATORS
 * 
 * Check these to confirm streak tracking is working:
 * 
 * ✅ Backend:
 *    - Streak routes registered in server.js
 *    - streakService.updateStreakOnMessage() called after each message
 *    - Migration creates message_streak_trackers table
 *    - Notification service sends milestone notifications
 *    - Daily task checks for at-risk streaks
 * 
 * ✅ Frontend:
 *    - StreakBadge component renders in match list
 *    - Flame emoji visible on matches with 3+ day streaks
 *    - useStreaks hook fetches data correctly
 *    - StreakLeaderboard displays top streaks
 *    - Milestone notifications appear on screen
 * 
 * ✅ Database:
 *    - message_streak_trackers table has all required columns
 *    - Indexes created for performance
 *    - Streak data persisted across sessions
 * 
 * ✅ Real-time:
 *    - Socket.io emits streak:updated events
 *    - UI updates without page reload
 *    - Notifications appear in real-time
 */

module.exports = {
  INTEGRATION_GUIDE: true,
  IMPLEMENTED_FEATURES: [
    'Streak Calculation (consecutive days)',
    'Flame Counter (emoji progression)',
    'Milestone Badges (3/7/30/100 days)',
    'FOMO Notifications (streak at risk)',
    'Leaderboard (social competition)',
    'Engagement Scoring (psychology metric)',
    'Real-time Updates (Socket.io)',
    'Streak Statistics (user stats)',
    'At-risk Detection (daily task)'
  ]
};
