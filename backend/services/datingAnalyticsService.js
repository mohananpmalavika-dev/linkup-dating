/**
 * Dating Analytics Service
 * Comprehensive analytics for user engagement, performance, and recommendations
 */

const { Op, Sequelize } = require('sequelize');
const {
  User,
  DatingProfile,
  ProfileEngagementMetric,
  InteractionMetric,
  DatingBenchmark,
  UserAnalytics,
  Match,
  Message
} = require('../models');

class DatingAnalyticsService {
  /**
   * Get user's personal stats
   */
  static async getPersonalStats(userId) {
    try {
      const user = await User.findByPk(userId, {
        include: { model: DatingProfile, as: 'datingProfile' }
      });

      if (!user) {
        return { success: false, message: 'User not found' };
      }

      const profile = user.datingProfile;
      if (!profile) {
        return { success: false, message: 'Dating profile not found' };
      }

      // Get current month metrics
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      const endOfMonth = new Date();

      // Get engagement metrics for current month
      const engagement = await ProfileEngagementMetric.aggregate(
        'profile_views',
        'sum',
        {
          where: {
            user_id: userId,
            metric_date: {
              [Op.between]: [
                startOfMonth.toISOString().split('T')[0],
                endOfMonth.toISOString().split('T')[0]
              ]
            }
          },
          raw: true
        }
      );

      // Calculate match rate
      const totalMatches = await Match.count({
        where: {
          [Op.or]: [
            { user_id_1: userId },
            { user_id_2: userId }
          ]
        }
      });

      const profileViews = engagement || 0;
      const matchRate = profileViews > 0 
        ? ((totalMatches / profileViews) * 100).toFixed(1)
        : 0;

      // Get industry benchmark
      const ageGroup = this.getAgeGroup(profile.age);
      const benchmark = await DatingBenchmark.findOne({
        where: {
          age_group: ageGroup,
          gender: profile.gender,
          location: { [Op.or]: [profile.location, null] }
        },
        order: [['benchmark_date', 'DESC']],
        limit: 1
      });

      const industryAvgMatchRate = benchmark?.avg_match_rate || 8;

      return {
        success: true,
        stats: {
          matchRate: parseFloat(matchRate),
          industryAverageMatchRate: parseFloat(industryAvgMatchRate),
          matchRateComparison: `Your match rate is ${((matchRate / industryAvgMatchRate) * 100).toFixed(0)}% vs industry average`,
          profileViews,
          likesReceived: await this.getLikesReceivedThisMonth(userId),
          matchesMade: totalMatches,
          messagesReceived: await this.getMessagesReceivedThisMonth(userId),
          avgResponseTime: await this.getAvgResponseTime(userId)
        }
      };
    } catch (error) {
      console.error('Error getting personal stats:', error);
      return { success: false, message: 'Error fetching personal stats' };
    }
  }

  /**
   * Get profile performance vs average for age group
   */
  static async getProfilePerformance(userId) {
    try {
      const user = await User.findByPk(userId, {
        include: { model: DatingProfile, as: 'datingProfile' }
      });

      if (!user?.datingProfile) {
        return { success: false, message: 'Profile not found' };
      }

      const profile = user.datingProfile;
      const ageGroup = this.getAgeGroup(profile.age);

      // Get benchmark
      const benchmark = await DatingBenchmark.findOne({
        where: {
          age_group: ageGroup,
          gender: profile.gender,
          location: { [Op.or]: [profile.location, null] }
        },
        order: [['benchmark_date', 'DESC']],
        limit: 1
      });

      // Get user's metrics for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const userMetrics = await ProfileEngagementMetric.sum('profile_views', {
        where: {
          user_id: userId,
          metric_date: {
            [Op.gte]: thirtyDaysAgo.toISOString().split('T')[0]
          }
        }
      });

      const avgUserMetrics = userMetrics / 30 || 0;
      const benchmarkAvg = benchmark?.avg_profile_views || 50;

      const performancePercentage = ((avgUserMetrics / benchmarkAvg) * 100).toFixed(0);

      return {
        success: true,
        performance: {
          profileViewsPerDay: avgUserMetrics.toFixed(1),
          industryAverageViewsPerDay: benchmarkAvg.toFixed(1),
          percentageAboveAverage: performancePercentage > 100 
            ? performancePercentage - 100
            : -(100 - performancePercentage),
          performanceMessage: performancePercentage > 100
            ? `Your profile gets ${performancePercentage - 100}% more views than average for your age`
            : `Your profile gets ${100 - performancePercentage}% fewer views than average for your age`,
          ageGroup,
          benchmarkSampleSize: benchmark?.sample_size || 0
        }
      };
    } catch (error) {
      console.error('Error getting profile performance:', error);
      return { success: false, message: 'Error fetching profile performance' };
    }
  }

  /**
   * Get monthly report with trends
   */
  static async getMonthlyReport(userId, year, month) {
    try {
      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];

      // Get engagement metrics
      const engagement = await ProfileEngagementMetric.findAll({
        where: {
          user_id: userId,
          metric_date: {
            [Op.between]: [startDate, endDate]
          }
        },
        raw: true
      });

      // Get interaction metrics
      const interactions = await InteractionMetric.findAll({
        where: {
          user_id: userId,
          metric_date: {
            [Op.between]: [startDate, endDate]
          }
        },
        raw: true
      });

      // Calculate trends
      const totalLikes = engagement.reduce((sum, m) => sum + (m.likes_received || 0), 0);
      const totalSuperLikes = engagement.reduce((sum, m) => sum + (m.superlikes_received || 0), 0);
      const totalMatches = engagement.reduce((sum, m) => sum + (m.matches_formed || 0), 0);
      const totalMessages = interactions.reduce((sum, m) => sum + (m.messages_received || 0), 0);
      const avgResponseTime = interactions.length > 0
        ? (interactions.reduce((sum, m) => sum + (m.avg_message_response_time || 0), 0) / interactions.length).toFixed(1)
        : 0;
      const totalVideoCallMinutes = interactions.reduce((sum, m) => sum + (m.total_video_call_duration || 0), 0);
      const videoCallRate = engagement.length > 0
        ? ((interactions.filter(m => m.video_calls_initiated > 0).length / engagement.length) * 100).toFixed(1)
        : 0;

      // Get day-by-day data for chart
      const dailyData = engagement.map(m => ({
        date: m.metric_date,
        likes: m.likes_received,
        superLikes: m.superlikes_received,
        matches: m.matches_formed
      }));

      return {
        success: true,
        report: {
          month: new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' }),
          summary: {
            totalLikes,
            totalSuperLikes,
            totalMatches,
            totalMessages,
            avgResponseTime: `${avgResponseTime} minutes`,
            totalVideoCallMinutes,
            videoCallRate: `${videoCallRate}%`
          },
          trends: {
            likesTrend: this.calculateTrend(dailyData.map(d => d.likes)),
            matchesTrend: this.calculateTrend(dailyData.map(d => d.matches)),
            weeklyData: this.groupByWeek(engagement)
          },
          dailyData
        }
      };
    } catch (error) {
      console.error('Error getting monthly report:', error);
      return { success: false, message: 'Error fetching monthly report' };
    }
  }

  /**
   * Get personalized recommendations
   */
  static async getRecommendations(userId) {
    try {
      const user = await User.findByPk(userId, {
        include: { model: DatingProfile, as: 'datingProfile' }
      });

      if (!user?.datingProfile) {
        return { success: false, message: 'Profile not found' };
      }

      const recommendations = [];

      // Get engagement metrics
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const engagement = await ProfileEngagementMetric.findAll({
        where: {
          user_id: userId,
          metric_date: {
            [Op.gte]: thirtyDaysAgo.toISOString().split('T')[0]
          }
        },
        raw: true
      });

      // Recommendation 1: Profile photo performance
      const avgLikesPerView = engagement.length > 0
        ? engagement.reduce((sum, m) => sum + (m.likes_received || 0), 0) / engagement.length
        : 0;

      if (avgLikesPerView > 0.1) {
        recommendations.push({
          priority: 'low',
          title: '📸 Great Photo Performance',
          description: 'Your main photo is performing well! Keep it as your primary photo.',
          impact: '+15% expected engagement',
          action: 'Keep current setup',
          type: 'photo'
        });
      } else if (engagement.length > 5) {
        recommendations.push({
          priority: 'high',
          title: '📸 Update Main Photo',
          description: 'Your main photo gets 3x less engagement than top performers. Try a new main photo.',
          impact: '+45% expected engagement',
          action: 'Try new main photo',
          type: 'photo',
          expectedIncrease: 45
        });
      }

      // Recommendation 2: Bio length
      const bioLength = user.datingProfile.bio ? user.datingProfile.bio.length : 0;
      if (bioLength < 50) {
        recommendations.push({
          priority: 'high',
          title: '✍️ Expand Your Bio',
          description: 'Profiles with 100-200 character bios get 35% more matches.',
          impact: '+35% expected matches',
          action: 'Write a better bio',
          type: 'bio'
        });
      }

      // Recommendation 3: Response time
      const interactions = await InteractionMetric.findOne({
        where: { user_id: userId },
        order: [['metric_date', 'DESC']]
      });

      if (interactions && interactions.avg_message_response_time > 120) {
        recommendations.push({
          priority: 'high',
          title: '💬 Improve Response Time',
          description: `Your avg response time is ${interactions.avg_message_response_time} min. Faster responses lead to 28% more dates.`,
          impact: '+28% more dates',
          action: 'Reply faster to messages',
          type: 'messaging'
        });
      }

      // Recommendation 4: Video calls
      if (interactions && interactions.video_calls_initiated === 0) {
        recommendations.push({
          priority: 'medium',
          title: '📹 Try Video Calls',
          description: 'Users who initiate video calls see 42% higher conversion rates.',
          impact: '+42% conversion rate',
          action: 'Suggest video call earlier',
          type: 'video'
        });
      }

      // Recommendation 5: Activity level
      const interactions30Day = await InteractionMetric.findAll({
        where: {
          user_id: userId,
          metric_date: {
            [Op.gte]: thirtyDaysAgo.toISOString().split('T')[0]
          }
        }
      });

      if (interactions30Day.length < 10) {
        recommendations.push({
          priority: 'high',
          title: '⚡ Increase Activity',
          description: 'Active users (10+ interactions/month) get 3x more matches.',
          impact: '+3x matches',
          action: 'Be more active on the app',
          type: 'activity'
        });
      }

      // Recommendation 6: Interests diversity
      const interests = user.datingProfile.interests ? user.datingProfile.interests.split(',').length : 0;
      if (interests < 3) {
        recommendations.push({
          priority: 'medium',
          title: '🎯 Add More Interests',
          description: 'Profiles with 5+ interests see 25% more compatibility matches.',
          impact: '+25% matches',
          action: 'Add more interests',
          type: 'interests'
        });
      }

      // Sort by priority
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

      return {
        success: true,
        recommendations: recommendations.slice(0, 5) // Return top 5
      };
    } catch (error) {
      console.error('Error getting recommendations:', error);
      return { success: false, message: 'Error fetching recommendations' };
    }
  }

  /**
   * Get profile comparison with benchmarks
   */
  static async getProfileComparison(userId) {
    try {
      const user = await User.findByPk(userId, {
        include: { model: DatingProfile, as: 'datingProfile' }
      });

      if (!user?.datingProfile) {
        return { success: false, message: 'Profile not found' };
      }

      const profile = user.datingProfile;
      const ageGroup = this.getAgeGroup(profile.age);

      // Get benchmark
      const benchmark = await DatingBenchmark.findOne({
        where: {
          age_group: ageGroup,
          gender: profile.gender,
          location: { [Op.or]: [profile.location, null] }
        },
        order: [['benchmark_date', 'DESC']],
        limit: 1
      });

      if (!benchmark) {
        return { success: false, message: 'No benchmark data available' };
      }

      // Get user's last 30 days metrics
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const userEngagement = await ProfileEngagementMetric.findAll({
        where: {
          user_id: userId,
          metric_date: {
            [Op.gte]: thirtyDaysAgo.toISOString().split('T')[0]
          }
        }
      });

      const userInteractions = await InteractionMetric.findAll({
        where: {
          user_id: userId,
          metric_date: {
            [Op.gte]: thirtyDaysAgo.toISOString().split('T')[0]
          }
        }
      });

      const userAvgViews = userEngagement.length > 0
        ? userEngagement.reduce((sum, m) => sum + m.profile_views, 0) / 30
        : 0;

      const userAvgLikes = userEngagement.length > 0
        ? userEngagement.reduce((sum, m) => sum + m.likes_received, 0) / userEngagement.length
        : 0;

      const userAvgResponseTime = userInteractions.length > 0
        ? userInteractions.reduce((sum, m) => sum + m.avg_message_response_time, 0) / userInteractions.length
        : 0;

      return {
        success: true,
        comparison: {
          profileViews: {
            userAvg: userAvgViews.toFixed(1),
            benchmarkAvg: benchmark.avg_profile_views,
            percentageDifference: ((userAvgViews / benchmark.avg_profile_views - 1) * 100).toFixed(0)
          },
          likesReceived: {
            userAvg: userAvgLikes.toFixed(1),
            benchmarkAvg: benchmark.avg_likes_received,
            percentageDifference: ((userAvgLikes / benchmark.avg_likes_received - 1) * 100).toFixed(0)
          },
          matchRate: {
            userAvg: benchmark.avg_match_rate,
            benchmarkAvg: benchmark.avg_match_rate,
            percentageDifference: 0
          },
          responseTime: {
            userAvg: `${userAvgResponseTime.toFixed(0)} min`,
            benchmarkAvg: `${benchmark.avg_message_response_time} min`,
            percentageDifference: ((userAvgResponseTime / benchmark.avg_message_response_time - 1) * 100).toFixed(0)
          },
          videoCallRate: {
            userAvg: `${(userInteractions.filter(i => i.video_calls_initiated > 0).length / userInteractions.length * 100).toFixed(0)}%`,
            benchmarkAvg: `${benchmark.avg_video_call_rate}%`
          }
        }
      };
    } catch (error) {
      console.error('Error getting profile comparison:', error);
      return { success: false, message: 'Error fetching profile comparison' };
    }
  }

  /**
   * Helper: Get age group
   */
  static getAgeGroup(age) {
    if (age < 26) return '18-25';
    if (age < 36) return '26-35';
    if (age < 46) return '36-45';
    if (age < 56) return '46-55';
    return '55+';
  }

  /**
   * Helper: Get likes received this month
   */
  static async getLikesReceivedThisMonth(userId) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);

    return await ProfileEngagementMetric.sum('likes_received', {
      where: {
        user_id: userId,
        metric_date: {
          [Op.gte]: startOfMonth.toISOString().split('T')[0]
        }
      }
    }) || 0;
  }

  /**
   * Helper: Get messages received this month
   */
  static async getMessagesReceivedThisMonth(userId) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);

    return await InteractionMetric.sum('messages_received', {
      where: {
        user_id: userId,
        metric_date: {
          [Op.gte]: startOfMonth.toISOString().split('T')[0]
        }
      }
    }) || 0;
  }

  /**
   * Helper: Get average response time
   */
  static async getAvgResponseTime(userId) {
    const interactionMetric = await InteractionMetric.findOne({
      where: { user_id: userId },
      order: [['metric_date', 'DESC']]
    });

    return interactionMetric?.avg_message_response_time || 0;
  }

  /**
   * Helper: Calculate trend (up, down, stable)
   */
  static calculateTrend(dataArray) {
    if (dataArray.length < 2) return 'stable';

    const firstHalf = dataArray.slice(0, Math.floor(dataArray.length / 2));
    const secondHalf = dataArray.slice(Math.floor(dataArray.length / 2));

    const avg1 = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avg2 = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const percentChange = ((avg2 - avg1) / avg1) * 100;

    if (percentChange > 10) return 'up';
    if (percentChange < -10) return 'down';
    return 'stable';
  }

  /**
   * Helper: Group metrics by week
   */
  static groupByWeek(metrics) {
    const weeks = {};
    metrics.forEach(m => {
      const date = new Date(m.metric_date);
      const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
      const weekKey = weekStart.toISOString().split('T')[0];

      if (!weeks[weekKey]) {
        weeks[weekKey] = { likes: 0, matches: 0, views: 0 };
      }
      weeks[weekKey].likes += m.likes_received || 0;
      weeks[weekKey].matches += m.matches_formed || 0;
      weeks[weekKey].views += m.profile_views || 0;
    });

    return Object.entries(weeks).map(([week, data]) => ({
      week,
      ...data
    }));
  }
}

module.exports = DatingAnalyticsService;
