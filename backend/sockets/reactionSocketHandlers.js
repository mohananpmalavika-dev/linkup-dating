/**
 * Real-time Reaction Socket.io Handlers
 * Broadcasts reactions, custom reactions, and streak achievements in real-time
 */

const MessageReactionService = require('../services/messageReactionService');
const db = require('../config/database');

const reactionSocketHandlers = {
  /**
   * Handle emoji reaction added
   */
  async handleEmojiReactionAdded(io, socket, { messageId, userId, emoji, matchId }) {
    try {
      const result = await MessageReactionService.addEmojiReaction(messageId, userId, emoji);

      if (result.success) {
        // Get all reactions for the message
        const reactions = await MessageReactionService.getMessageReactions(messageId);

        // Broadcast to match room
        const matchRoom = `match_${matchId}`;
        io.to(matchRoom).emit('message_reaction_added', {
          messageId,
          userId,
          emoji,
          action: result.action,
          reactions: reactions.summary,
          timestamp: new Date()
        });

        // Check for streak milestones
        await this.checkStreakMilestones(io, matchId, userId);
      }
    } catch (error) {
      console.error('Error handling emoji reaction:', error);
      socket.emit('reaction_error', { error: error.message });
    }
  },

  /**
   * Handle custom reaction (profile photo) added
   */
  async handleCustomReactionAdded(io, socket, { messageId, userId, reactionData, matchId }) {
    try {
      const result = await MessageReactionService.addCustomReaction(messageId, userId, reactionData);

      if (result.success) {
        // Get all reactions for the message
        const reactions = await MessageReactionService.getMessageReactions(messageId);

        // Broadcast to match room
        const matchRoom = `match_${matchId}`;
        io.to(matchRoom).emit('message_custom_reaction_added', {
          messageId,
          userId,
          reactionData,
          action: result.action,
          reactions: reactions.summary,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Error handling custom reaction:', error);
      socket.emit('reaction_error', { error: error.message });
    }
  },

  /**
   * Handle reaction removed
   */
  async handleReactionRemoved(io, socket, { messageId, userId, emoji, matchId }) {
    try {
      const result = await MessageReactionService.removeReaction(messageId, userId, emoji);

      if (result.success) {
        // Get all reactions for the message
        const reactions = await MessageReactionService.getMessageReactions(messageId);

        // Broadcast to match room
        const matchRoom = `match_${matchId}`;
        io.to(matchRoom).emit('message_reaction_removed', {
          messageId,
          userId,
          emoji,
          reactions: reactions.summary,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Error handling reaction removal:', error);
      socket.emit('reaction_error', { error: error.message });
    }
  },

  /**
   * Check for streak milestones and send notifications
   */
  async checkStreakMilestones(io, matchId, userId) {
    try {
      // Get the match users
      const matchResult = await db.query(
        `SELECT user_id_1, user_id_2 FROM matches WHERE id = $1`,
        [matchId]
      );

      if (matchResult.rows.length === 0) return;

      const { user_id_1, user_id_2 } = matchResult.rows[0];
      const [user1, user2] = [user_id_1, user_id_2].sort();

      // Get streak
      const streakResult = await db.query(
        `SELECT * FROM message_streak_trackers
         WHERE user_id_1 = $1 AND user_id_2 = $2 AND match_id = $3`,
        [user1, user2, matchId]
      );

      if (streakResult.rows.length === 0) return;

      const streak = streakResult.rows[0];
      const matchRoom = `match_${matchId}`;

      // Check milestones and emit to both users
      if (streak.streak_days === 3 && !streak.milestone_3_days) {
        // 3-day streak milestone - send ❤️ emoji
        const user1Result = await db.query(`SELECT first_name FROM users WHERE id = $1`, [user_id_1]);
        const user2Result = await db.query(`SELECT first_name FROM users WHERE id = $1`, [user_id_2]);
        
        const userName1 = user1Result.rows[0]?.first_name || 'User';
        const userName2 = user2Result.rows[0]?.first_name || 'Your match';

        // Emit milestone reached event
        io.to(matchRoom).emit('streak_milestone_reached', {
          matchId,
          milestone: 3,
          streakDays: 3,
          isActive: true,
          emoji: '❤️',
          message: '🎉 You are on a 3-day message streak! ❤️',
          userName: userName2,
          engagementBoost: 'You both are really connecting!',
          timestamp: new Date()
        });

        // Mark milestone as achieved
        await db.query(
          `UPDATE message_streak_trackers SET milestone_3_days = true WHERE id = $1`,
          [streak.id]
        );
      } else if (streak.streak_days === 7 && !streak.milestone_7_days) {
        // 7-day streak milestone
        const userResult = await db.query(`SELECT first_name FROM users WHERE id = $1`, [user_id_2]);
        const userName = userResult.rows[0]?.first_name || 'Your match';

        io.to(matchRoom).emit('streak_milestone_reached', {
          matchId,
          milestone: 7,
          streakDays: 7,
          isActive: true,
          emoji: '❤️',
          message: '🎉 Impressive! You have a 7-day message streak! ❤️❤️',
          userName,
          engagementBoost: 'This is a strong connection forming!',
          timestamp: new Date()
        });

        await db.query(
          `UPDATE message_streak_trackers SET milestone_7_days = true WHERE id = $1`,
          [streak.id]
        );
      } else if (streak.streak_days === 30 && !streak.milestone_30_days) {
        // 30-day streak milestone - fire emoji!
        const userResult = await db.query(`SELECT first_name FROM users WHERE id = $1`, [user_id_2]);
        const userName = userResult.rows[0]?.first_name || 'Your match';

        io.to(matchRoom).emit('streak_milestone_reached', {
          matchId,
          milestone: 30,
          streakDays: 30,
          isActive: true,
          emoji: '🔥',
          message: '🔥🔥🔥 AMAZING! 30-day message streak! You two are incredible! 🔥🔥🔥',
          userName,
          engagementBoost: 'Outstanding connection! This is rare!',
          achievement: true,
          timestamp: new Date()
        });

        await db.query(
          `UPDATE message_streak_trackers SET milestone_30_days = true WHERE id = $1`,
          [streak.id]
        );
      }

      // Calculate and update engagement score with detailed breakdown
      const messageCountResult = await db.query(
        `SELECT COUNT(*) as count FROM messages 
         WHERE (from_user_id = $1 AND to_user_id = $2) 
            OR (from_user_id = $2 AND to_user_id = $1)`,
        [user_id_1, user_id_2]
      );
      
      const reactionCountResult = await db.query(
        `SELECT COUNT(*) as count FROM message_reactions mr
         WHERE EXISTS (
           SELECT 1 FROM messages m 
           WHERE m.id = mr.message_id 
           AND ((m.from_user_id = $1 AND m.to_user_id = $2) 
                OR (m.from_user_id = $2 AND m.to_user_id = $1))
         )`,
        [user_id_1, user_id_2]
      );

      const engagementScore = await MessageReactionService.calculateEngagementScore(
        matchId,
        user_id_1,
        user_id_2
      );

      if (engagementScore > 0) {
        io.to(matchRoom).emit('engagement_score_updated', {
          matchId,
          engagementScore,
          streakDays: streak.streak_days,
          totalMessages: parseInt(messageCountResult.rows[0]?.count || 0),
          totalReactions: parseInt(reactionCountResult.rows[0]?.count || 0),
          isActive: streak.is_active,
          psychology: {
            message: 'Your engagement score increased!',
            boost: Math.round((engagementScore / 1000) * 100) + '%'
          },
          timestamp: new Date()
        });
      }

    } catch (error) {
      console.error('Error checking streak milestones:', error);
    }
  },

  /**
   * Request message reactions (when opening a message)
   */
  async handleRequestMessageReactions(io, socket, { messageId, matchId }) {
    try {
      const reactions = await MessageReactionService.getMessageReactions(messageId);

      socket.emit('message_reactions_response', {
        messageId,
        reactions: reactions.summary,
        total: reactions.total
      });
    } catch (error) {
      console.error('Error requesting reactions:', error);
      socket.emit('reaction_error', { error: 'Failed to load reactions' });
    }
  },

  /**
   * Request streak info
   */
  async handleRequestStreak(io, socket, { userId1, userId2, matchId }) {
    try {
      const streak = await MessageReactionService.getStreak(userId1, userId2, matchId);

      socket.emit('streak_info_response', {
        matchId,
        streak
      });
    } catch (error) {
      console.error('Error requesting streak:', error);
    }
  },

  /**
   * Get suggested reactions for user
   */
  async handleGetSuggestedReactions(io, socket, { matchId, userId }) {
    try {
      const suggestions = await MessageReactionService.getSuggestedReactions(matchId, userId);

      socket.emit('suggested_reactions', {
        reactions: suggestions
      });
    } catch (error) {
      console.error('Error getting suggested reactions:', error);
      // Send default suggestions on error
      socket.emit('suggested_reactions', {
        reactions: ['👍', '❤️', '😂', '🔥']
      });
    }
  },

  /**
   * Get top reactions in a conversation
   */
  async handleGetTopReactions(io, socket, { matchId }) {
    try {
      const topReactions = await MessageReactionService.getTopReactions(matchId);

      socket.emit('top_reactions', {
        matchId,
        reactions: topReactions
      });
    } catch (error) {
      console.error('Error getting top reactions:', error);
    }
  }
};

module.exports = reactionSocketHandlers;
