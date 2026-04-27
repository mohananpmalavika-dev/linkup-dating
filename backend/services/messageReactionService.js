/**
 * Message Reaction Service
 * Handles emoji reactions, custom reactions, and engagement psychology
 */

const db = require('../config/database');

class MessageReactionService {
  // Predefined emoji reactions
  static EMOJI_REACTIONS = {
    'thumbs_up': '👍',
    'heart': '❤️',
    'laughing': '😂',
    'fire': '🔥',
    'crying': '😭',
    'wow': '😮',
    'angry': '😠',
    'thinking': '🤔'
  };

  static REACTION_CATEGORIES = {
    'positive': ['👍', '❤️', '😂', '🔥'],
    'emotional': ['😭', '😮', '🤔'],
    'negative': ['😠'],
    'all': ['👍', '❤️', '😂', '🔥', '😭', '😮', '🤔', '😠']
  };

  /**
   * Add emoji reaction to message
   */
  static async addEmojiReaction(messageId, userId, emoji) {
    try {
      // Validate emoji
      if (!this.isValidEmoji(emoji)) {
        throw new Error(`Invalid emoji: ${emoji}`);
      }

      // Check if user already reacted with this emoji
      const existing = await db.query(
        `SELECT id FROM message_reactions
         WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
        [messageId, userId, emoji]
      );

      if (existing.rows.length > 0) {
        // Remove the reaction (toggle)
        return await this.removeReaction(messageId, userId, emoji);
      }

      // Add new reaction
      const result = await db.query(
        `INSERT INTO message_reactions (message_id, user_id, emoji, created_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING *`,
        [messageId, userId, emoji]
      );

      // Update streak tracker
      await this.updateStreakAfterReaction(messageId);

      return {
        success: true,
        reaction: result.rows[0],
        action: 'added'
      };
    } catch (error) {
      console.error('Error adding emoji reaction:', error);
      throw error;
    }
  }

  /**
   * Add custom reaction using user's profile photo
   */
  static async addCustomReaction(messageId, userId, reactionData) {
    try {
      const { photoUrl, photoId, displayName } = reactionData;

      // Store custom reaction in metadata field
      const result = await db.query(
        `INSERT INTO message_reactions (
          message_id, user_id, emoji,
          custom_reaction_type, custom_photo_url, 
          custom_photo_id, custom_display_name,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (message_id, user_id) DO UPDATE SET
          custom_reaction_type = EXCLUDED.custom_reaction_type,
          custom_photo_url = EXCLUDED.custom_photo_url,
          custom_photo_id = EXCLUDED.custom_photo_id,
          custom_display_name = EXCLUDED.custom_display_name,
          updated_at = NOW()
        RETURNING *`,
        [messageId, userId, '🖼️', 'photo', photoUrl, photoId, displayName]
      );

      // Update streak tracker
      await this.updateStreakAfterReaction(messageId);

      return {
        success: true,
        reaction: result.rows[0],
        type: 'custom',
        action: 'added'
      };
    } catch (error) {
      console.error('Error adding custom reaction:', error);
      throw error;
    }
  }

  /**
   * Remove reaction
   */
  static async removeReaction(messageId, userId, emoji) {
    try {
      const result = await db.query(
        `DELETE FROM message_reactions
         WHERE message_id = $1 AND user_id = $2 AND emoji = $3
         RETURNING *`,
        [messageId, userId, emoji]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Reaction not found' };
      }

      return {
        success: true,
        reaction: result.rows[0],
        action: 'removed'
      };
    } catch (error) {
      console.error('Error removing reaction:', error);
      throw error;
    }
  }

  /**
   * Get all reactions for a message with user details
   */
  static async getMessageReactions(messageId) {
    try {
      const result = await db.query(
        `SELECT mr.*, u.display_name, u.id as user_id, pp.photo_url
         FROM message_reactions mr
         JOIN users u ON mr.user_id = u.id
         LEFT JOIN profile_photos pp ON mr.custom_photo_id = pp.id
         WHERE mr.message_id = $1
         ORDER BY mr.created_at DESC`,
        [messageId]
      );

      // Group by emoji/custom type
      const grouped = {};
      result.rows.forEach(reaction => {
        const key = reaction.custom_reaction_type ? 'photo' : reaction.emoji;
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push({
          userId: reaction.user_id,
          displayName: reaction.display_name,
          photoUrl: reaction.photo_url || reaction.custom_photo_url,
          customReactionType: reaction.custom_reaction_type,
          createdAt: reaction.created_at
        });
      });

      // Summary
      const summary = Object.entries(grouped).map(([type, users]) => ({
        type,
        count: users.length,
        users,
        emoji: type.length === 1 ? type : null
      }));

      return {
        success: true,
        total: result.rows.length,
        grouped,
        summary
      };
    } catch (error) {
      console.error('Error getting message reactions:', error);
      throw error;
    }
  }

  /**
   * Get reaction count grouped by emoji
   */
  static async getReactionCounts(messageId) {
    try {
      const result = await db.query(
        `SELECT emoji, COUNT(*) as count
         FROM message_reactions
         WHERE message_id = $1
         GROUP BY emoji
         ORDER BY count DESC`,
        [messageId]
      );

      return result.rows.reduce((acc, row) => {
        acc[row.emoji] = parseInt(row.count);
        return acc;
      }, {});
    } catch (error) {
      console.error('Error getting reaction counts:', error);
      return {};
    }
  }

  /**
   * Update streak tracker after message activity
   */
  static async updateStreakAfterReaction(messageId) {
    try {
      // Get message details
      const msgResult = await db.query(
        `SELECT match_id, from_user_id, to_user_id, created_at FROM messages WHERE id = $1`,
        [messageId]
      );

      if (msgResult.rows.length === 0) return;

      const { match_id, from_user_id, to_user_id, created_at } = msgResult.rows[0];
      const [user1, user2] = [from_user_id, to_user_id].sort();

      // Get or create streak tracker
      let streakResult = await db.query(
        `SELECT * FROM message_streak_trackers
         WHERE user_id_1 = $1 AND user_id_2 = $2 AND match_id = $3`,
        [user1, user2, match_id]
      );

      if (streakResult.rows.length === 0) {
        // Create new streak
        await db.query(
          `INSERT INTO message_streak_trackers (
            user_id_1, user_id_2, match_id, streak_days, 
            is_active, streak_start_date, last_message_date,
            total_messages, total_reactions, created_at, updated_at
          ) VALUES ($1, $2, $3, 1, true, NOW(), NOW(), 0, 1, NOW(), NOW())`,
          [user1, user2, match_id]
        );
      } else {
        // Update existing streak
        const tracker = streakResult.rows[0];
        const lastMsgDate = new Date(tracker.last_message_date);
        const today = new Date();
        
        // Calculate days since last message
        const daysDiff = Math.floor((today - lastMsgDate) / (1000 * 60 * 60 * 24));

        if (daysDiff === 0) {
          // Same day - update reaction count
          await db.query(
            `UPDATE message_streak_trackers
             SET total_reactions = total_reactions + 1, updated_at = NOW()
             WHERE id = $1`,
            [tracker.id]
          );
        } else if (daysDiff === 1) {
          // Consecutive day - increment streak
          const newStreakDays = tracker.streak_days + 1;
          await db.query(
            `UPDATE message_streak_trackers
             SET streak_days = $1, last_message_date = NOW(), 
                 total_reactions = total_reactions + 1,
                 milestone_3_days = CASE WHEN $1 >= 3 THEN true ELSE milestone_3_days END,
                 milestone_7_days = CASE WHEN $1 >= 7 THEN true ELSE milestone_7_days END,
                 milestone_30_days = CASE WHEN $1 >= 30 THEN true ELSE milestone_30_days END,
                 updated_at = NOW()
             WHERE id = $2`,
            [newStreakDays, tracker.id]
          );
        } else {
          // Streak broken
          await db.query(
            `UPDATE message_streak_trackers
             SET is_active = false, streak_broken_date = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [tracker.id]
          );
        }
      }
    } catch (error) {
      console.error('Error updating streak after reaction:', error);
      // Don't throw - streak update is non-critical
    }
  }

  /**
   * Get streak info between two users
   */
  static async getStreak(userId1, userId2, matchId) {
    try {
      const [user1, user2] = [userId1, userId2].sort();

      const result = await db.query(
        `SELECT * FROM message_streak_trackers
         WHERE user_id_1 = $1 AND user_id_2 = $2 AND match_id = $3`,
        [user1, user2, matchId]
      );

      if (result.rows.length === 0) {
        return {
          active: false,
          streakDays: 0,
          emoji: null,
          text: null
        };
      }

      const streak = result.rows[0];
      if (!streak.is_active) {
        return {
          active: false,
          streakDays: streak.streak_days,
          previousStreak: streak.streak_days,
          emoji: null,
          text: `Previous streak: ${streak.streak_days} days`
        };
      }

      // Calculate emoji and text
      let emoji = null;
      let text = null;

      if (streak.streak_days >= 30) {
        emoji = '🔥';
        text = `${streak.streak_days}🔥 Day Streak!`;
      } else if (streak.streak_days >= 7) {
        emoji = '❤️';
        text = `${streak.streak_days}❤️ Day Streak!`;
      } else if (streak.streak_days >= 3) {
        emoji = '❤️';
        text = `${streak.streak_days}❤️ Day Streak!`;
      }

      return {
        active: streak.is_active,
        streakDays: streak.streak_days,
        emoji,
        text,
        engagementScore: streak.engagement_score,
        totalMessages: streak.total_messages,
        totalReactions: streak.total_reactions,
        startDate: streak.streak_start_date,
        lastMessageDate: streak.last_message_date
      };
    } catch (error) {
      console.error('Error getting streak:', error);
      return {
        active: false,
        streakDays: 0,
        emoji: null,
        text: null
      };
    }
  }

  /**
   * Calculate engagement score for psychology boost
   */
  static async calculateEngagementScore(matchId, userId1, userId2) {
    try {
      const [user1, user2] = [userId1, userId2].sort();

      // Get streak info
      const streakResult = await db.query(
        `SELECT streak_days, total_messages, total_reactions FROM message_streak_trackers
         WHERE user_id_1 = $1 AND user_id_2 = $2 AND match_id = $3`,
        [user1, user2, matchId]
      );

      if (streakResult.rows.length === 0) {
        return 0;
      }

      const streak = streakResult.rows[0];

      // Calculate engagement score
      const streakBonus = streak.streak_days * 10; // 10 points per day
      const messageBonus = Math.min(streak.total_messages * 2, 200); // Up to 200 points
      const reactionBonus = Math.min(streak.total_reactions * 5, 150); // Up to 150 points
      const milestone3Bonus = streak.streak_days >= 3 ? 50 : 0;
      const milestone7Bonus = streak.streak_days >= 7 ? 100 : 0;
      const milestone30Bonus = streak.streak_days >= 30 ? 500 : 0;

      const score = streakBonus + messageBonus + reactionBonus + 
                    milestone3Bonus + milestone7Bonus + milestone30Bonus;

      // Update score in database
      await db.query(
        `UPDATE message_streak_trackers
         SET engagement_score = $1, updated_at = NOW()
         WHERE user_id_1 = $2 AND user_id_2 = $3 AND match_id = $4`,
        [score, user1, user2, matchId]
      );

      return score;
    } catch (error) {
      console.error('Error calculating engagement score:', error);
      return 0;
    }
  }

  /**
   * Get top reactions in a conversation
   */
  static async getTopReactions(matchId, limit = 10) {
    try {
      const result = await db.query(
        `SELECT emoji, COUNT(*) as count
         FROM message_reactions mr
         JOIN messages m ON mr.message_id = m.id
         WHERE m.match_id = $1
         GROUP BY emoji
         ORDER BY count DESC
         LIMIT $2`,
        [matchId, limit]
      );

      return result.rows.map(row => ({
        emoji: row.emoji,
        count: parseInt(row.count)
      }));
    } catch (error) {
      console.error('Error getting top reactions:', error);
      return [];
    }
  }

  /**
   * Check if emoji is valid
   */
  static isValidEmoji(emoji) {
    return Object.values(this.EMOJI_REACTIONS).includes(emoji) ||
           Object.values(this.REACTION_CATEGORIES.all).includes(emoji);
  }

  /**
   * Get suggestion reactions for user
   */
  static async getSuggestedReactions(matchId, userId) {
    try {
      // Get user's most used reactions
      const result = await db.query(
        `SELECT emoji, COUNT(*) as count
         FROM message_reactions
         WHERE user_id = $1
         GROUP BY emoji
         ORDER BY count DESC
         LIMIT 5`,
        [userId]
      );

      const userReactions = result.rows.map(row => row.emoji);

      // If not enough, add popular ones
      const suggestions = [...new Set([
        ...userReactions,
        ...this.REACTION_CATEGORIES.positive,
        ...this.REACTION_CATEGORIES.emotional
      ])].slice(0, 8);

      return suggestions;
    } catch (error) {
      console.error('Error getting suggested reactions:', error);
      return this.REACTION_CATEGORIES.positive;
    }
  }
}

module.exports = MessageReactionService;
