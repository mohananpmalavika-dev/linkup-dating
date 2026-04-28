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
      socket.emit('achievement-unlocked', {
        code: achievementCode,
        name: achievementName,
        emoji: achievementEmoji,
        timestamp: unlockedAt
      });

      // Emit to user room so all connected devices receive it
      socket.to(`user_${userId}`).emit('achievement-unlocked', {
        code: achievementCode,
        name: achievementName,
        emoji: achievementEmoji,
        timestamp: unlockedAt
      });
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

      socket.emit('leaderboard-rank-updated', {
        type,
        newRank,
        previousRank,
        score,
        city,
        interest,
        improved
      });

      socket.to(`user_${userId}`).emit('leaderboard-rank-updated', {
        type,
        newRank,
        previousRank,
        score,
        city,
        interest,
        improved,
        emoji
      });
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
      socket.emit('conversation-starter-voted', {
        voterName,
        voteCount: newVoteCount,
        timestamp
      });

      socket.to(`user_${userId}`).emit('conversation-starter-voted', {
        voterName,
        voteCount: newVoteCount,
        timestamp
      });
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

      socket.emit('achievement-milestone', {
        code: achievementCode,
        progress,
        requirement,
        percentage
      });

      socket.to(`user_${userId}`).emit('achievement-milestone', {
        code: achievementCode,
        progress,
        requirement,
        percentage
      });
    }
  });

  /**
   * Listen for badge featured event
   */
  socket.on('achievement:featured', (data) => {
    const { userId: featuredUserId, achievementCode, achievementName } = data;

    if (Number(featuredUserId) === Number(userId)) {
      socket.emit('badge-featured', {
        code: achievementCode,
        name: achievementName
      });

      socket.to(`user_${userId}`).emit('badge-featured', {
        code: achievementCode,
        name: achievementName
      });
    }
  });

  /**
   * Listen for leaderboard refresh event
   * Triggered monthly or on demand
   */
  socket.on('leaderboard:refreshed', (data) => {
    const { type, timestamp } = data;

    socket.emit('leaderboard-refreshed', {
      type,
      timestamp
    });

    socket.to(`user_${userId}`).emit('leaderboard-refreshed', {
      type,
      timestamp
    });
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
