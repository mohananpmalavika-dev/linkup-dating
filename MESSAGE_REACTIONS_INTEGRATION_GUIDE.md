/**
 * MESSAGE REACTIONS & RICH REACTIONS - INTEGRATION GUIDE
 * Complete implementation guide with code examples
 * 
 * Features Implemented:
 * 1. Emoji reactions (👍, ❤️, 😂, 🔥, 😭, 😮, 🤔, 😠)
 * 2. Custom reactions using profile photos
 * 3. Heart streaks - emoji shown when messaging 3+ days
 * 4. Psychology boost - engagement score increases with streaks & reactions
 */

// ============================================================================
// 1. BACKEND IMPLEMENTATION SUMMARY
// ============================================================================

/**
 * Database Models Created:
 * 
 * 1. MessageReaction (Enhanced)
 *    - Location: backend/models/MessageReaction.js
 *    - Fields: messageId, userId, emoji, customReactionType, customPhotoUrl, customPhotoId, customDisplayName
 *    - Supports both emoji and custom photo reactions
 *    - Unique constraint: (messageId, userId)
 * 
 * 2. MessageStreakTracker (New)
 *    - Location: backend/models/MessageStreakTracker.js
 *    - Tracks consecutive messaging days between user pairs
 *    - Milestones: 3 days, 7 days, 30 days with notifications
 *    - Engagement score: Multi-factor calculation
 *    - Fields: streakDays, isActive, startDate, lastMessageDate, milestones, engagementScore
 */

/**
 * Services Created:
 * 
 * 1. MessageReactionService
 *    - Location: backend/services/messageReactionService.js
 *    - Emoji Reactions: 8 predefined emojis with categories
 *    - Custom Reactions: Photo URL + display name support
 *    - Streak Management: Daily validation, milestone detection
 *    - Engagement Scoring: Multi-factor calculation
 *    - Methods: 15+ covering all reaction operations
 */

/**
 * API Routes Created:
 * 
 * POST   /api/messages/:messageId/reactions
 *        Add emoji reaction
 * 
 * POST   /api/messages/:messageId/custom-reactions
 *        Add custom photo reaction
 * 
 * DELETE /api/messages/:messageId/reactions/:emoji
 *        Remove reaction
 * 
 * GET    /api/messages/:messageId/reactions
 *        Get all reactions for message
 * 
 * GET    /api/matches/:matchId/streak
 *        Get streak info
 * 
 * GET    /api/matches/:matchId/engagement-score
 *        Get engagement score
 * 
 * GET    /api/reactions/emoji-list
 *        Get available emojis
 * 
 * GET    /api/streaks/active-streaks
 *        Get user's active streaks
 */

/**
 * Socket.io Events:
 * 
 * EMIT:
 *   - emoji_reaction_added: Broadcast emoji reaction to match room
 *   - custom_reaction_added: Broadcast custom reaction
 *   - reaction_removed: Broadcast reaction removal
 *   - streak_milestone_3days: Notify 3-day streak
 *   - streak_milestone_7days: Notify 7-day streak
 *   - streak_milestone_30days: Notify 30-day streak
 *   - engagement_score_updated: Update engagement metrics
 * 
 * LISTEN:
 *   - message_reaction_added: Update UI with new reaction
 *   - message_custom_reaction_added: Update UI with custom reaction
 *   - message_reaction_removed: Remove reaction from UI
 */

// ============================================================================
// 2. FRONTEND IMPLEMENTATION - REACT COMPONENTS
// ============================================================================

import React, { useState } from 'react';
import ReactionPicker from './components/ReactionPicker';
import MessageReactionDisplay from './components/MessageReactionDisplay';
import StreakBadge from './components/StreakBadge';
import { useMessageReactions, useStreak, useEngagementScore } from './hooks/useReactions';

/**
 * ENHANCED MESSAGE BUBBLE COMPONENT
 * Shows reactions and streak indicators
 */
const EnhancedMessageBubble = ({ 
  message, 
  matchId, 
  currentUserId,
  isOwn = false 
}) => {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const { reactions, addEmojiReaction, removeReaction } = useMessageReactions(message.id, matchId);
  const { streak } = useStreak(matchId);
  const { score } = useEngagementScore(matchId);

  const handleReactionSelect = async (emoji) => {
    await addEmojiReaction(emoji);
  };

  const handleReactionRemove = async (emoji) => {
    await removeReaction(emoji);
  };

  return (
    <div className={`message-bubble ${isOwn ? 'own' : 'other'}`}>
      {/* Message content */}
      <div className="message-content">
        <p className="message-text">{message.text}</p>
        <span className="message-time">{new Date(message.createdAt).toLocaleTimeString()}</span>
      </div>

      {/* Reactions display */}
      <MessageReactionDisplay
        messageId={message.id}
        reactions={reactions}
        onRemoveReaction={handleReactionRemove}
        currentUserId={currentUserId}
      />

      {/* Reaction picker button */}
      <button
        className="reaction-picker-trigger"
        onClick={() => setShowReactionPicker(!showReactionPicker)}
        title="Add reaction"
      >
        😊
      </button>

      {/* Reaction picker */}
      {showReactionPicker && (
        <div className="reaction-picker-wrapper">
          <ReactionPicker
            messageId={message.id}
            onReactionSelected={handleReactionSelect}
            matchId={matchId}
          />
        </div>
      )}

      {/* Streak indicator */}
      {streak && (
        <StreakBadge
          matchId={matchId}
          streakDays={streak.streakDays}
          emoji={streak.emoji}
          isActive={streak.active}
          totalMessages={streak.totalMessages}
          engagementScore={score}
        />
      )}
    </div>
  );
};

// ============================================================================
// 3. USAGE EXAMPLES IN CHATROOM/CONVERSATION VIEW
// ============================================================================

/**
 * CHAT CONVERSATION COMPONENT
 * Renders messages with integrated reactions and streaks
 */
const ChatConversation = ({ matchId, messages, currentUserId }) => {
  return (
    <div className="conversation">
      <div className="messages-list">
        {messages.map((msg) => (
          <EnhancedMessageBubble
            key={msg.id}
            message={msg}
            matchId={matchId}
            currentUserId={currentUserId}
            isOwn={msg.fromUserId === currentUserId}
          />
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 4. STREAK DISPLAY IN MATCH HEADER
// ============================================================================

/**
 * MATCH HEADER WITH STREAK BADGE
 * Shows active streak at top of conversation
 */
const MatchHeader = ({ match, currentUserId }) => {
  const { streak } = useStreak(match.id);
  const { score } = useEngagementScore(match.id);

  return (
    <div className="match-header">
      <div className="user-info">
        <img src={match.user.profilePhoto} alt={match.user.displayName} />
        <div className="user-details">
          <h3>{match.user.displayName}</h3>
          <p className="user-age-location">{match.user.age} • {match.user.location}</p>
        </div>
      </div>

      {/* Streak display in header */}
      {streak && streak.streakDays >= 3 && (
        <div className="header-streak">
          <span className="streak-indicator">{streak.emoji}</span>
          <span className="streak-label">{streak.text}</span>
        </div>
      )}

      {/* Engagement score badge */}
      {score > 0 && (
        <div className="engagement-badge">
          <span className="engagement-value">{Math.round(score)}%</span>
          <span className="engagement-label">Engagement</span>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 5. USER STREAKS DASHBOARD
// ============================================================================

/**
 * ACTIVE STREAKS VIEW
 * Shows all active streaks for the user
 */
import { useActiveStreaks } from './hooks/useReactions';

const ActiveStreaksDashboard = () => {
  const { streaks, loading } = useActiveStreaks();

  if (loading) return <div>Loading streaks...</div>;

  return (
    <div className="streaks-dashboard">
      <h2>🔥 Your Active Streaks</h2>
      <div className="streaks-grid">
        {streaks.map((streak) => (
          <div key={streak.matchId} className="streak-card">
            <div className="streak-header">
              <span className="streak-emoji">{streak.emoji}</span>
              <h3>{streak.matchUserName}</h3>
            </div>

            <div className="streak-details">
              <p className="streak-days">{streak.streakDays} days 🎉</p>
              <p className="streak-messages">{streak.totalMessages} messages</p>
              <p className="engagement">
                <strong>Engagement:</strong> {Math.round(streak.engagementScore)}%
              </p>
            </div>

            <div className="streak-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.min((streak.streakDays / 30) * 100, 100)}%` }}
                ></div>
              </div>
              <small>{streak.streakDays} / 30 days to 🔥 emoji</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 6. ENGAGEMENT PSYCHOLOGY MECHANICS
// ============================================================================

/**
 * ENGAGEMENT SCORE CALCULATION BREAKDOWN
 * 
 * Score = (streakDays × 10) + messageBonus + reactionBonus + milestoneBonus
 * 
 * Components:
 * 1. Streak Velocity: streakDays × 10 points/day
 *    - Max contribution: 300 points (at 30 days)
 *    - Psychology: Longer streaks show consistent engagement
 * 
 * 2. Message Frequency: (messageCount × 2), capped at 200 points
 *    - Max contribution: 200 points (100+ messages)
 *    - Psychology: Frequent messaging indicates active interest
 * 
 * 3. Reaction Activity: (reactionCount × 5), capped at 150 points
 *    - Max contribution: 150 points (30+ reactions)
 *    - Psychology: Reactions show active participation & interest
 * 
 * 4. Milestone Bonuses:
 *    - 3-day milestone: +50 points (first motivation boost)
 *    - 7-day milestone: +100 points (sustained engagement proof)
 *    - 30-day milestone: +500 points (major relationship milestone)
 *    - Psychology: Milestone notifications trigger celebration & motivation
 * 
 * Formula Pseudocode:
 * 
 * calculateEngagementScore(matchId, userId1, userId2) {
 *   const streak = getStreak(matchId, userId1, userId2);
 *   const messages = countMessages(matchId, userId1, userId2);
 *   const reactions = countReactions(matchId, userId1, userId2);
 *   
 *   let score = (streak.days * 10);  // Base: 10 points per day
 *   score += Math.min(messages * 2, 200);  // Messages: 2 points each, max 200
 *   score += Math.min(reactions * 5, 150);  // Reactions: 5 points each, max 150
 *   
 *   // Milestone bonuses
 *   if (streak.milestone_3_days) score += 50;   // 3-day bonus
 *   if (streak.milestone_7_days) score += 100;  // 7-day bonus
 *   if (streak.milestone_30_days) score += 500; // 30-day bonus
 *   
 *   return Math.min(score, 1000);  // Cap at 1000 for percentage (0-100%)
 * }
 * 
 * Example Scores:
 * - 3 days, 50 messages, 10 reactions, milestone_3 = 
 *   (3×10) + 100 + 50 + 50 = 230 (23%)
 * - 7 days, 100 messages, 25 reactions, milestone_7 = 
 *   (7×10) + 200 + 125 + 50 + 100 = 585 (58%)
 * - 30 days, 200+ messages, 30+ reactions, all milestones = 
 *   (30×10) + 200 + 150 + 50 + 100 + 500 = 1000 (100%)
 */

// ============================================================================
// 7. PSYCHOLOGY-DRIVEN NOTIFICATIONS
// ============================================================================

/**
 * STREAK MILESTONE NOTIFICATIONS
 * Triggers celebration notifications to maintain engagement
 */

/**
 * 3-Day Milestone Notification
 * Message: "🎉 You are on a 3-day message streak! ❤️"
 * Psychology: First achievement - builds habit formation
 * Emoji Evolution: ❤️
 */

/**
 * 7-Day Milestone Notification
 * Message: "🎉 Impressive! You have a 7-day message streak! ❤️❤️"
 * Psychology: Sustained engagement - shows consistency
 * Emoji Evolution: ❤️ (stays the same)
 */

/**
 * 30-Day Milestone Notification
 * Message: "🔥🔥🔥 AMAZING! 30-day message streak! You two are incredible! 🔥🔥🔥"
 * Psychology: Major achievement - triggers celebration response
 * Emoji Evolution: 🔥 (upgraded from ❤️)
 * Psychology Message: "Outstanding connection! This is rare!"
 */

/**
 * REACTION SUGGESTIONS
 * Show user's most-used reactions first for easy access
 */
const reactionCategories = {
  positive: ['👍', '❤️', '😂', '🔥'],
  emotional: ['😭', '😮', '🤔'],
  negative: ['😠'],
  userFavorites: ['❤️', '😂']  // Based on usage history
};

// ============================================================================
// 8. INTEGRATION CHECKLIST
// ============================================================================

/**
 * ✅ Backend Components:
 *    ✅ MessageReaction model enhanced with custom reaction support
 *    ✅ MessageStreakTracker model with milestone tracking
 *    ✅ MessageReactionService with 15+ methods
 *    ✅ Database migration with triggers and views
 *    ✅ API routes for all reaction operations
 *    ✅ Socket.io handlers for real-time updates
 * 
 * ✅ Frontend Components:
 *    ✅ ReactionPicker component with emoji selection
 *    ✅ MessageReactionDisplay component with reaction details
 *    ✅ StreakBadge component with milestone indicators
 * 
 * ✅ Custom Hooks:
 *    ✅ useMessageReactions - Manage reactions for a message
 *    ✅ useStreak - Get streak information
 *    ✅ useEngagementScore - Get engagement metrics
 *    ✅ useSuggestedReactions - Get user's favorite reactions
 *    ✅ useActiveStreaks - Get all active streaks
 *    ✅ useTopReactions - Get popular reactions in conversation
 * 
 * ⏳ Integration Tasks:
 *    ⏳ Run database migration to create tables
 *    ⏳ Mount Socket handlers in main Socket.io server
 *    ⏳ Integrate components into ChatMessage/MessageBubble
 *    ⏳ Add ReactionPicker to message hover/long-press
 *    ⏳ Display StreakBadge in match headers
 *    ⏳ Show ActiveStreaksDashboard in profile/dashboard views
 *    ⏳ Add engagement score display to profile views
 */

// ============================================================================
// 9. KEY FILES CREATED
// ============================================================================

/**
 * Backend:
 * - backend/models/MessageReaction.js (Enhanced)
 * - backend/models/MessageStreakTracker.js (New)
 * - backend/services/messageReactionService.js (New)
 * - backend/sockets/reactionSocketHandlers.js (New)
 * - backend/routes/messageReactions.js (New)
 * - backend/migrations/20260428_add_reactions_and_streaks.sql (New)
 * 
 * Frontend:
 * - src/components/ReactionPicker.jsx (New)
 * - src/components/ReactionPicker.css (New)
 * - src/components/MessageReactionDisplay.jsx (New)
 * - src/components/MessageReactionDisplay.css (New)
 * - src/components/StreakBadge.jsx (New)
 * - src/components/StreakBadge.css (New)
 * - src/hooks/useReactions.js (New)
 */

// ============================================================================
// 10. NEXT STEPS
// ============================================================================

/**
 * 1. Run database migration
 *    $ npm run migrate -- 20260428_add_reactions_and_streaks.sql
 * 
 * 2. Restart backend server to load new Socket handlers
 * 
 * 3. Import and integrate components in ChatMessage component
 * 
 * 4. Test emoji reactions
 * 
 * 5. Test streak tracking with consecutive day messaging
 * 
 * 6. Verify milestone notifications at 3, 7, 30 days
 * 
 * 7. Monitor engagement score calculations
 */

export default EnhancedMessageBubble;
