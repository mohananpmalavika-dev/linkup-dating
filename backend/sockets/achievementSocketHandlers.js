/**
 * Achievement Socket Handlers
 * Real-time achievement unlocks and leaderboard updates via Socket.io
 */

const handleAchievementSocketEvents = (socket, userId) => {
  /**
   * Listen for achievement unlocked event
   * Triggered when user earns a new badge
   */
  socket.on('achievement:unlocked', (data) => {
    const {
      achievementCode,
      achievementName,
      achievementEmoji,
      userId: achievedUserId,
      unlockedAt
    } = data;

    // Only process if it's the current user
    if (Number(achievedUserId) === Number(userId)) {
      // Emit event for frontend to handle notification
      window.dispatchEvent(
        new CustomEvent('achievement-unlocked', {
          detail: {
            code: achievementCode,
            name: achievementName,
            emoji: achievementEmoji,
            timestamp: unlockedAt
          }
        })
      );

      // Browser notification if permitted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`🎉 Achievement Unlocked!`, {
          body: `${achievementEmoji} ${achievementName}`,
          icon: achievementEmoji,
          badge: '🏆',
          tag: `achievement-${achievementCode}`,
          requireInteraction: false
        });
      }
    }
  });

  /**
   * Listen for leaderboard rank update
   * Triggered when user's rank changes
   */
  socket.on('leaderboard:rank-updated', (data) => {
    const {
      userId: rankedUserId,
      type,
      newRank,
      previousRank,
      score,
      city,
      interest
    } = data;

    if (Number(rankedUserId) === Number(userId)) {
      const improved = previousRank && newRank < previousRank;
      const emoji = improved ? '📈' : '📉';

      window.dispatchEvent(
        new CustomEvent('leaderboard-rank-updated', {
          detail: {
            type,
            newRank,
            previousRank,
            score,
            city,
            interest,
            improved
          }
        })
      );

      if (improved && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(`🎯 Rank Improved!`, {
          body: `You're now #${newRank} in ${type}`,
          icon: emoji,
          tag: `rank-update-${type}`,
          requireInteraction: false
        });
      }
    }
  });

  /**
   * Listen for new vote for conversation starter
   */
  socket.on('leaderboard:new-vote', (data) => {
    const {
      votedForUserId,
      voterName,
      newVoteCount,
      timestamp
    } = data;

    if (Number(votedForUserId) === Number(userId)) {
      window.dispatchEvent(
        new CustomEvent('conversation-starter-voted', {
          detail: {
            voterName,
            voteCount: newVoteCount,
            timestamp
          }
        })
      );

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`👍 Someone loved your conversation!`, {
          body: `${voterName} voted for you`,
          icon: '💬',
          tag: 'conversation-vote',
          requireInteraction: false
        });
      }
    }
  });

  /**
   * Listen for engagement milestone event
   * Triggered based on achievement progress
   */
  socket.on('achievement:milestone', (data) => {
    const {
      achievementCode,
      progress,
      requirement,
      userId: milestoneUserId
    } = data;

    if (Number(milestoneUserId) === Number(userId)) {
      const percentage = Math.round((progress / requirement) * 100);

      window.dispatchEvent(
        new CustomEvent('achievement-milestone', {
          detail: {
            code: achievementCode,
            progress,
            requirement,
            percentage
          }
        })
      );
    }
  });

  /**
   * Listen for badge featured event
   */
  socket.on('achievement:featured', (data) => {
    const { userId: featuredUserId, achievementCode, achievementName } = data;

    if (Number(featuredUserId) === Number(userId)) {
      window.dispatchEvent(
        new CustomEvent('badge-featured', {
          detail: {
            code: achievementCode,
            name: achievementName
          }
        })
      );
    }
  });

  /**
   * Listen for leaderboard refresh event
   * Triggered monthly or on demand
   */
  socket.on('leaderboard:refreshed', (data) => {
    const { type, timestamp } = data;

    window.dispatchEvent(
      new CustomEvent('leaderboard-refreshed', {
        detail: {
          type,
          timestamp
        }
      })
    );
  });

  return {
    /**
     * Emit request to check and unlock achievements for current user
     */
    checkAchievements: () => {
      socket.emit('achievement:check', { userId });
    },

    /**
     * Emit request to update user's leaderboard positions
     */
    updateLeaderboardRanks: () => {
      socket.emit('leaderboard:update-user-ranks', { userId });
    },

    /**
     * Emit vote for conversation starter
     */
    voteConversationStarter: (votedForUserId, reason = '') => {
      socket.emit('leaderboard:vote', {
        votedByUserId: userId,
        votedForUserId,
        reason
      });
    },

    /**
     * Emit request to fetch leaderboard
     */
    fetchLeaderboard: (type, filters = {}) => {
      socket.emit('leaderboard:fetch', {
        type,
        filters,
        userId
      });
    }
  };
};

module.exports = handleAchievementSocketEvents;
