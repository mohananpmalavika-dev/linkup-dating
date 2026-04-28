const { Op } = require('sequelize');
const dbModels = require('../models');

const {
  VideoCallRating,
  VideoCallAnalytics,
  VideoCompatibilityScore,
  VideoDate,
  User
} = dbModels;

const INDUSTRY_AVERAGE_CALL_MINUTES = 12;

const videoCallInsightsService = {
  /**
   * Submit a post-call rating
   */
  async submitCallRating(videoDeteId, raterUserId, ratedUserId, ratingData) {
    try {
      // Verify the video call exists
      const videoCall = await VideoDate.findByPk(videoDeteId);
      if (!videoCall) {
        throw new Error('Video call not found');
      }

      // Check if rating already exists
      const existingRating = await VideoCallRating.findOne({
        where: {
          video_date_id: videoDeteId,
          rater_user_id: raterUserId,
          rated_user_id: ratedUserId,
        },
      });

      if (existingRating) {
        throw new Error('Rating already submitted');
      }

      // Create rating
      const rating = await VideoCallRating.create({
        video_date_id: videoDeteId,
        rater_user_id: raterUserId,
        rated_user_id: ratedUserId,
        rating: ratingData.rating,
        comment: ratingData.comment,
        would_date_again: ratingData.wouldDateAgain,
        communication_quality: ratingData.communicationQuality,
        chemistry_level: ratingData.chemistryLevel,
        appearance_match: ratingData.appearanceMatch,
        personality_match: ratingData.personalityMatch,
      });

      // Update analytics for the rated user
      await this.updateUserAnalytics(ratedUserId);

      return {
        success: true,
        message: 'Rating submitted successfully',
        rating: rating,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Get user's video call analytics
   */
  async getUserAnalytics(userId) {
    try {
      const user = await User.findByPk(userId);
      if (!user) throw new Error('User not found');

      let analytics = await VideoCallAnalytics.findOne({
        where: { user_id: userId },
      });

      if (!analytics) {
        analytics = await VideoCallAnalytics.create({
          user_id: userId,
        });
      }

      // Get industry comparison
      const allAnalytics = await VideoCallAnalytics.findAll({
        attributes: ['user_id', 'average_call_duration_minutes'],
        where: {
          total_calls: { [Op.gt]: 0 },
        },
      });

      const userIndex = allAnalytics.findIndex(a => a.user_id === userId);
      const usersWithHigherDuration = allAnalytics.filter(
        a => a.average_call_duration_minutes > analytics.average_call_duration_minutes
      ).length;

      const percentile = Math.round((usersWithHigherDuration / allAnalytics.length) * 100);

      return {
        success: true,
        analytics: {
          totalCalls: analytics.total_calls,
          totalDurationMinutes: analytics.total_duration_minutes,
          averageCallDuration: analytics.average_call_duration_minutes,
          industryAverage: INDUSTRY_AVERAGE_CALL_MINUTES,
          comparisonStatus:
            analytics.average_call_duration_minutes > INDUSTRY_AVERAGE_CALL_MINUTES
              ? 'above_average'
              : 'below_average',
          differenceMinutes: (
            analytics.average_call_duration_minutes - INDUSTRY_AVERAGE_CALL_MINUTES
          ).toFixed(2),
          longestCall: analytics.longest_call_minutes,
          shortestCall: analytics.shortest_call_minutes,
          callsThisMonth: analytics.calls_this_month,
          callsThisWeek: analytics.calls_this_week,
          averageRating: parseFloat(analytics.average_rating || 0).toFixed(2),
          totalRatingsReceived: analytics.total_ratings_received,
          ratingDistribution: {
            fiveStar: analytics.five_star_count,
            fourStar: analytics.four_star_count,
            threeStar: analytics.three_star_count,
            twoStar: analytics.two_star_count,
            oneStar: analytics.one_star_count,
          },
          conversionToDateCount: analytics.conversion_to_date_count,
          conversionRate: parseFloat(analytics.conversion_rate_percent || 0).toFixed(2),
          averageChemistryScore: parseFloat(analytics.average_chemistry_score || 0).toFixed(2),
          averageCommunicationScore: parseFloat(
            analytics.average_communication_score || 0
          ).toFixed(2),
          wouldDateAgainPercent: parseFloat(analytics.would_date_again_percent || 0).toFixed(2),
          noShowCount: analytics.no_show_count,
          percentileVsIndustry: percentile,
          lastCallDate: analytics.last_call_date,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Update user analytics based on ratings and calls
   */
  async updateUserAnalytics(userId) {
    try {
      // Get all completed calls for user
      const completedCalls = await VideoDate.findAll({
        where: {
          [Op.or]: [{ user_id_1: userId }, { user_id_2: userId }],
          status: 'completed',
          duration_seconds: { [Op.not]: null },
        },
      });

      if (completedCalls.length === 0) {
        return {
          success: false,
          error: 'No completed calls found',
        };
      }

      // Calculate statistics
      const totalDurationSeconds = completedCalls.reduce((sum, call) => sum + call.duration_seconds, 0);
      const totalDurationMinutes = Math.round(totalDurationSeconds / 60);
      const averageDurationMinutes = (totalDurationMinutes / completedCalls.length).toFixed(2);
      const longestCallMinutes = Math.max(
        ...completedCalls.map(call => Math.round(call.duration_seconds / 60))
      );

      // Get ratings received
      const ratings = await VideoCallRating.findAll({
        where: { rated_user_id: userId },
      });

      let averageRating = 0;
      let fiveStarCount = 0;
      let fourStarCount = 0;
      let threeStarCount = 0;
      let twoStarCount = 0;
      let oneStarCount = 0;
      let totalWouldDateAgain = 0;
      let wouldDateAgainCount = 0;
      let chemistrySum = 0;
      let communicationSum = 0;

      if (ratings.length > 0) {
        averageRating = (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(2);

        ratings.forEach(r => {
          if (r.rating === 5) fiveStarCount++;
          else if (r.rating === 4) fourStarCount++;
          else if (r.rating === 3) threeStarCount++;
          else if (r.rating === 2) twoStarCount++;
          else if (r.rating === 1) oneStarCount++;

          if (r.would_date_again !== null) {
            totalWouldDateAgain += r.would_date_again ? 1 : 0;
            wouldDateAgainCount++;
          }

          if (r.chemistry_level) chemistrySum += r.chemistry_level;
          if (r.communication_quality) communicationSum += r.communication_quality;
        });
      }

      const wouldDateAgainPercent =
        wouldDateAgainCount > 0 ? ((totalWouldDateAgain / wouldDateAgainCount) * 100).toFixed(2) : 0;
      const averageChemistryScore = ratings.filter(r => r.chemistry_level).length > 0
        ? (chemistrySum / ratings.filter(r => r.chemistry_level).length).toFixed(2)
        : 0;
      const averageCommunicationScore = ratings.filter(r => r.communication_quality).length > 0
        ? (communicationSum / ratings.filter(r => r.communication_quality).length).toFixed(2)
        : 0;

      // Calculate calls this month and week
      const now = new Date();
      const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
      const weekAgo = new Date(now.setDate(now.getDate() - 7));

      const callsThisMonth = completedCalls.filter(c => new Date(c.ended_at) > monthAgo).length;
      const callsThisWeek = completedCalls.filter(c => new Date(c.ended_at) > weekAgo).length;

      // Update or create analytics
      let analytics = await VideoCallAnalytics.findOne({
        where: { user_id: userId },
      });

      if (!analytics) {
        analytics = await VideoCallAnalytics.create({ user_id: userId });
      }

      await analytics.update({
        total_calls: completedCalls.length,
        total_duration_minutes: totalDurationMinutes,
        average_call_duration_minutes: averageDurationMinutes,
        longest_call_minutes: longestCallMinutes,
        calls_this_month: callsThisMonth,
        calls_this_week: callsThisWeek,
        average_rating: averageRating,
        total_ratings_received: ratings.length,
        five_star_count: fiveStarCount,
        four_star_count: fourStarCount,
        three_star_count: threeStarCount,
        two_star_count: twoStarCount,
        one_star_count: oneStarCount,
        average_chemistry_score: chemistryScore,
        average_communication_score: averageCommunicationScore,
        would_date_again_percent: wouldDateAgainPercent,
        last_call_date: completedCalls[0].ended_at,
      });

      return {
        success: true,
        message: 'Analytics updated',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Generate video compatibility score for a call
   */
  async generateCompatibilityScore(videoDeteId) {
    try {
      const videoCall = await VideoDate.findByPk(videoDeteId, {
        include: [
          { model: User, as: 'user1' },
          { model: User, as: 'user2' },
        ],
      });

      if (!videoCall) throw new Error('Video call not found');

      // Get ratings for both users
      const user1Ratings = await VideoCallRating.findAll({
        where: {
          video_date_id: videoDeteId,
          rater_user_id: videoCall.user_id_2,
          rated_user_id: videoCall.user_id_1,
        },
      });

      const user2Ratings = await VideoCallRating.findAll({
        where: {
          video_date_id: videoDeteId,
          rater_user_id: videoCall.user_id_1,
          rated_user_id: videoCall.user_id_2,
        },
      });

      // Calculate scores from ratings
      let chemistryScore = 0;
      let communicationScore = 0;
      let personalityScore = 0;
      let attractionScore = 0;

      if (user1Ratings.length > 0 || user2Ratings.length > 0) {
        const allRatings = [...user1Ratings, ...user2Ratings];

        chemistryScore = allRatings.reduce((sum, r) => sum + (r.chemistry_level || 0), 0) / (allRatings.length || 1);
        communicationScore = allRatings.reduce((sum, r) => sum + (r.communication_quality || 0), 0) / (allRatings.length || 1);
        personalityScore = allRatings.reduce((sum, r) => sum + (r.personality_match || 0), 0) / (allRatings.length || 1);
        attractionScore = allRatings.reduce((sum, r) => sum + (r.appearance_match || 0), 0) / (allRatings.length || 1);
      }

      // Simulate engagement and interaction metrics
      const engagementScore = Math.random() * 100; // Would be calculated from actual video analysis
      const conversationFlowScore = Math.random() * 100;

      // Calculate overall compatibility
      const overallScore = (
        (chemistryScore * 0.25 +
          communicationScore * 0.25 +
          personalityScore * 0.25 +
          attractionScore * 0.15 +
          engagementScore * 0.1) / 10
      ).toFixed(2);

      // Determine probability they will date
      const willDateProbability = Math.min(100, (overallScore * 1.2).toFixed(2));

      // Categorize
      let category = 'unlikely';
      if (overallScore >= 80) category = 'perfect_match';
      else if (overallScore >= 65) category = 'very_likely';
      else if (overallScore >= 50) category = 'likely';
      else if (overallScore >= 35) category = 'possible';

      // Create recommendation
      const recommendation = generateRecommendation(
        category,
        chemistryScore,
        communicationScore,
        personalityScore
      );

      // Create or update compatibility score
      let compatScore = await VideoCompatibilityScore.findOne({
        where: { video_date_id: videoDeteId },
      });

      if (!compatScore) {
        compatScore = await VideoCompatibilityScore.create({
          video_date_id: videoDeteId,
          user_id_1: videoCall.user_id_1,
          user_id_2: videoCall.user_id_2,
        });
      }

      await compatScore.update({
        overall_compatibility_score: overallScore,
        will_date_probability_percent: willDateProbability,
        chemistry_score: (chemistryScore * 20).toFixed(2), // Convert 1-5 to 0-100
        communication_compatibility: (communicationScore * 20).toFixed(2),
        personality_alignment: (personalityScore * 20).toFixed(2),
        attraction_match: (attractionScore * 20).toFixed(2),
        conversation_flow_score: conversationFlowScore,
        engagement_level: engagementScore,
        compatibility_category: category,
        recommendation: recommendation,
        confidence_level: 75,
      });

      return {
        success: true,
        message: 'Compatibility score generated',
        compatibilityScore: compatScore,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Get upcoming video calls for user
   */
  async getUserUpcomingCalls(userId) {
    try {
      const calls = await VideoDate.findAll({
        where: {
          [Op.or]: [{ user_id_1: userId }, { user_id_2: userId }],
          scheduled_at: { [Op.gte]: new Date() },
          status: { [Op.in]: ['scheduled', 'ringing'] },
        },
        include: [
          { model: User, as: 'user1', attributes: ['id', 'first_name', 'last_name'] },
          { model: User, as: 'user2', attributes: ['id', 'first_name', 'last_name'] },
        ],
        order: [['scheduled_at', 'ASC']],
      });

      return {
        success: true,
        calls: calls.map(call => ({
          id: call.id,
          title: call.title,
          scheduledAt: call.scheduled_at,
          otherUser: userId === call.user_id_1 ? call.user2 : call.user1,
          roomId: call.room_id,
          status: call.status,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Get video call history for user
   */
  async getUserCallHistory(userId, limit = 10) {
    try {
      const calls = await VideoDate.findAll({
        where: {
          [Op.or]: [{ user_id_1: userId }, { user_id_2: userId }],
          status: 'completed',
        },
        include: [
          { model: User, as: 'user1', attributes: ['id', 'first_name', 'last_name'] },
          { model: User, as: 'user2', attributes: ['id', 'first_name', 'last_name'] },
          { model: VideoCompatibilityScore, as: 'compatibilityScore' },
        ],
        order: [['ended_at', 'DESC']],
        limit,
      });

      return {
        success: true,
        calls: calls.map(call => ({
          id: call.id,
          endedAt: call.ended_at,
          durationMinutes: Math.round(call.duration_seconds / 60),
          otherUser: userId === call.user_id_1 ? call.user2 : call.user1,
          compatibilityScore: call.compatibilityScore,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
};

/**
 * Generate recommendation text based on compatibility
 */
function generateRecommendation(category, chemistry, communication, personality) {
  const recommendations = {
    perfect_match:
      'Amazing chemistry! You two have incredible potential. Consider scheduling a real date soon!',
    very_likely:
      'Excellent compatibility! Strong connection detected. Definitely worth meeting in person.',
    likely: 'Good potential! You have solid connection. Worth exploring further with a real date.',
    possible: 'Fair chemistry. You might work - consider another call or casual meetup.',
    unlikely: 'Limited connection. Best to keep an open mind or consider other matches.',
  };

  return recommendations[category] || recommendations.possible;
}

module.exports = videoCallInsightsService;
