/**
 * Trending Service
 * Manages trending profiles calculation and leaderboard generation
 */

const calculateEngagementScore = (likes, superlikes, views) => {
  if (views === 0) return 0;
  // Formula: likes + superlikes*2 + views*0.1
  return Math.round((likes + superlikes * 2 + views * 0.1) * 100) / 100;
};

const calculateTrendMomentum = (currentScore, previousScore) => {
  if (previousScore === 0) return 0;
  const change = ((currentScore - previousScore) / previousScore) * 100;
  return Math.round(change * 100) / 100; // Percent change
};

/**
 * Calculate daily trending leaderboard
 * Ranks profiles by engagement score for the current day
 */
const calculateDailyTrending = async (dbModels, date = new Date()) => {
  const dateStr = date.toISOString().split('T')[0];
  
  try {
    // Get engagement metrics for all profiles today
    const engagementData = await dbModels.sequelize.query(`
      SELECT 
        u.id,
        u.firstName,
        u.age,
        dp.relationshipGoals,
        dp.interests,
        dp.location,
        COUNT(DISTINCT CASE WHEN i.interaction_type = 'like' THEN i.id END) as likes_received,
        COUNT(DISTINCT CASE WHEN i.interaction_type = 'superlike' THEN i.id END) as superlikes_received,
        COUNT(DISTINCT pv.id) as profile_views,
        COUNT(DISTINCT CASE WHEN m.created_at::date = $1 THEN m.id END) as matches_created,
        s.plan as subscription_plan,
        u.profileVerified as profile_verified
      FROM users u
      LEFT JOIN dating_profiles dp ON u.id = dp.user_id
      LEFT JOIN interactions i ON u.id = i.to_user_id AND i.created_at::date = $1
      LEFT JOIN profile_views pv ON u.id = pv.viewed_user_id AND pv.viewed_at::date = $1
      LEFT JOIN matches m ON (u.id = m.user_id_1 OR u.id = m.user_id_2) AND m.created_at::date = $1
      LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
      GROUP BY u.id, u.firstName, u.age, dp.relationshipGoals, dp.interests, dp.location, s.plan, u.profileVerified
      HAVING COUNT(DISTINCT CASE WHEN i.interaction_type IN ('like', 'superlike') THEN i.id END) > 0
        OR COUNT(DISTINCT pv.id) > 0
        OR COUNT(DISTINCT CASE WHEN m.created_at::date = $1 THEN m.id END) > 0
      ORDER BY likes_received + superlikes_received * 2 DESC
      LIMIT 500
    `, { 
      replacements: [dateStr],
      type: dbModels.sequelize.QueryTypes.SELECT 
    });

    // Score and rank each profile
    const scoredProfiles = engagementData.map((profile, idx) => {
      const engagement = calculateEngagementScore(
        profile.likes_received || 0,
        profile.superlikes_received || 0,
        profile.profile_views || 0
      );

      return {
        profile_user_id: profile.id,
        snapshot_date: dateStr,
        snapshot_hour: new Date(new Date().setHours(new Date().getHours(), 0, 0, 0)),
        likes_received: profile.likes_received || 0,
        superlikes_received: profile.superlikes_received || 0,
        profile_views: profile.profile_views || 0,
        matches_created: profile.matches_created || 0,
        engagement_score: engagement,
        daily_rank: idx + 1,
        is_premium: profile.subscription_plan === 'premium' || profile.subscription_plan === 'gold',
        profile_verified: profile.profile_verified || false,
        profile_name: profile.firstName,
        profile_age: profile.age
      };
    });

    return scoredProfiles;
  } catch (err) {
    console.error('Error calculating daily trending:', err);
    throw err;
  }
};

/**
 * Get today's trending profiles (premium: instant, free: 30-min delay)
 */
const getTrendingProfiles = async (dbModels, isPremium, limit = 20) => {
  try {
    const now = new Date();
    let queryDate = new Date(now);
    
    // Free tier: show data from 30 minutes ago
    if (!isPremium) {
      queryDate.setMinutes(queryDate.getMinutes() - 30);
    }
    
    const dateStr = queryDate.toISOString().split('T')[0];
    
    const trendingProfiles = await dbModels.TrendingProfile.findAll({
      where: {
        snapshot_date: dateStr
      },
      order: [['engagement_score', 'DESC']],
      limit,
      include: [
        {
          model: dbModels.User,
          as: 'profile',
          attributes: ['id', 'firstName', 'age', 'bio', 'profileVerified'],
          include: [
            {
              model: dbModels.DatingProfile,
              as: 'datingProfile',
              attributes: ['relationshipGoals', 'interests', 'location']
            },
            {
              model: dbModels.ProfilePhoto,
              as: 'profilePhotos',
              attributes: ['id', 'photo_url', 'position'],
              limit: 1,
              order: [['position', 'ASC']]
            }
          ]
        }
      ],
      raw: false
    });

    return trendingProfiles.map((tp, idx) => ({
      rank: idx + 1,
      profile: {
        id: tp.profile.id,
        firstName: tp.profile.firstName,
        age: tp.profile.age,
        bio: tp.profile.bio,
        verified: tp.profile.profileVerified,
        interests: tp.profile.datingProfile?.interests || [],
        goals: tp.profile.datingProfile?.relationshipGoals,
        location: tp.profile.datingProfile?.location,
        photoUrl: tp.profile.profilePhotos?.[0]?.photo_url
      },
      engagement: {
        likes: tp.likes_received,
        superlikes: tp.superlikes_received,
        views: tp.profile_views,
        matches: tp.matches_created,
        score: tp.engagement_score
      },
      isPremium: tp.is_premium,
      isVerified: tp.profile_verified,
      trendMomentum: tp.trend_momentum,
      badge: getTrendBadge(idx + 1, tp.engagement_score)
    }));
  } catch (err) {
    console.error('Error fetching trending profiles:', err);
    throw err;
  }
};

/**
 * Get trending leaderboard for current hour
 */
const getTrendingLeaderboard = async (dbModels, limit = 10) => {
  try {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    
    const leaderboard = await dbModels.TrendingProfile.findAll({
      where: {
        snapshot_date: dateStr
      },
      order: [['engagement_score', 'DESC']],
      limit,
      include: [
        {
          model: dbModels.User,
          as: 'profile',
          attributes: ['id', 'firstName', 'age', 'profileVerified'],
          include: [
            {
              model: dbModels.ProfilePhoto,
              as: 'profilePhotos',
              attributes: ['photo_url', 'position'],
              limit: 1,
              order: [['position', 'ASC']]
            }
          ]
        }
      ]
    });

    const medals = ['🥇', '🥈', '🥉', '#4️⃣', '#5️⃣', '#6️⃣', '#7️⃣', '#8️⃣', '#9️⃣', '🔟'];

    return leaderboard.map((entry, idx) => ({
      position: idx + 1,
      medal: medals[idx] || `#${idx + 1}`,
      profile: {
        id: entry.profile.id,
        name: entry.profile.firstName,
        age: entry.profile.age,
        verified: entry.profile.profileVerified,
        photo: entry.profile.profilePhotos?.[0]?.photo_url
      },
      score: entry.engagement_score,
      stats: {
        likes: entry.likes_received,
        superlikes: entry.superlikes_received,
        views: entry.profile_views,
        newMatches: entry.matches_created
      }
    }));
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    throw err;
  }
};

/**
 * Get badge based on ranking
 */
const getTrendBadge = (rank, score) => {
  if (rank === 1) return { icon: '🔥', label: 'Hottest Profile' };
  if (rank <= 3) return { icon: '⭐', label: 'Trending' };
  if (rank <= 10) return { icon: '📈', label: 'Rising' };
  if (rank <= 50) return { icon: '💫', label: 'Popular' };
  return null;
};

/**
 * Record trending snapshot (should be called hourly)
 */
const recordHourlySnapshot = async (dbModels) => {
  try {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const hourStart = new Date(now);
    hourStart.setMinutes(0, 0, 0);

    const profilesData = await dbModels.sequelize.query(`
      SELECT 
        i.to_user_id,
        COUNT(DISTINCT CASE WHEN i.interaction_type = 'like' THEN i.id END) as likes_received,
        COUNT(DISTINCT CASE WHEN i.interaction_type = 'superlike' THEN i.id END) as superlikes_received,
        COUNT(DISTINCT pv.id) as profile_views,
        COUNT(DISTINCT CASE WHEN m.created_at >= $1 AND m.created_at < $2 THEN m.id END) as matches_created
      FROM interactions i
      LEFT JOIN profile_views pv ON i.to_user_id = pv.viewed_user_id 
        AND pv.viewed_at >= $1 AND pv.viewed_at < $2
      LEFT JOIN matches m ON (i.to_user_id = m.user_id_1 OR i.to_user_id = m.user_id_2)
      WHERE i.created_at >= $1 AND i.created_at < $2
        AND i.interaction_type IN ('like', 'superlike')
      GROUP BY i.to_user_id
    `, {
      replacements: [hourStart, new Date(hourStart.getTime() + 3600000)],
      type: dbModels.sequelize.QueryTypes.SELECT
    });

    const records = profilesData.map(profile => ({
      profile_user_id: profile.to_user_id,
      snapshot_hour: hourStart,
      snapshot_date: dateStr,
      likes_received: profile.likes_received || 0,
      superlikes_received: profile.superlikes_received || 0,
      profile_views: profile.profile_views || 0,
      matches_created: profile.matches_created || 0,
      engagement_score: calculateEngagementScore(
        profile.likes_received || 0,
        profile.superlikes_received || 0,
        profile.profile_views || 0
      )
    }));

    // Bulk insert or update
    await dbModels.TrendingProfile.bulkCreate(records, {
      updateOnDuplicate: ['likes_received', 'superlikes_received', 'profile_views', 'matches_created', 'engagement_score']
    });

    console.log(`Recorded trending snapshot for ${records.length} profiles`);
    return records.length;
  } catch (err) {
    console.error('Error recording hourly snapshot:', err);
  }
};

/**
 * Clean old trending data (keep 30 days)
 */
const cleanupOldData = async (dbModels, daysToKeep = 30) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const deleted = await dbModels.TrendingProfile.destroy({
      where: {
        snapshot_date: {
          [dbModels.sequelize.Op.lt]: cutoffDateStr
        }
      }
    });

    console.log(`Cleaned up ${deleted} old trending records`);
    return deleted;
  } catch (err) {
    console.error('Error cleaning up trending data:', err);
  }
};

module.exports = {
  calculateEngagementScore,
  calculateTrendMomentum,
  calculateDailyTrending,
  getTrendingProfiles,
  getTrendingLeaderboard,
  getTrendBadge,
  recordHourlySnapshot,
  cleanupOldData
};
