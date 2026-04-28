const IcebreakerVideo = require('../models/IcebreakerVideo');
const IcebreakerVideoRating = require('../models/IcebreakerVideoRating');
const User = require('../models/User');
const Match = require('../models/Match');
const { logger } = require('../utils/logger');

/**
 * Upload and create a new icebreaker video
 * @param {string} userId - User uploading the video
 * @param {string} videoUrl - S3 URL to video file
 * @param {string} videoKey - S3 object key
 * @param {number} durationSeconds - Video duration (1-5 seconds)
 * @param {string} thumbnailUrl - Video thumbnail URL
 * @param {string} title - Optional video title
 * @returns {Promise<Object>} Created video object
 */
async function uploadIcebreakerVideo(
  userId,
  videoUrl,
  videoKey,
  durationSeconds,
  thumbnailUrl,
  title
) {
  try {
    // Validate duration
    if (!durationSeconds || durationSeconds < 1 || durationSeconds > 5) {
      throw new Error('Video duration must be between 1 and 5 seconds');
    }

    // Deactivate any existing active video
    await IcebreakerVideo.update(
      { is_active: false },
      { where: { user_id: userId, is_active: true } }
    );

    // Create new video as active
    const video = await IcebreakerVideo.create({
      user_id: userId,
      video_url: videoUrl,
      video_key: videoKey,
      duration_seconds: durationSeconds,
      thumbnail_url: thumbnailUrl,
      title: title || "Why I'm looking for someone",
      is_active: true,
    });

    logger.info(`[IcebreakerVideo] User ${userId} uploaded video ${video.id}`);
    return video;
  } catch (error) {
    logger.error(`[IcebreakerVideo] Upload failed for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Get user's active icebreaker video (their intro video)
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Active video or null
 */
async function getUserActiveVideo(userId) {
  try {
    const video = await IcebreakerVideo.findOne({
      where: { user_id: userId, is_active: true },
    });
    return video;
  } catch (error) {
    logger.error(`[IcebreakerVideo] Failed to get active video for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Get all videos for a user (gallery)
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of user's videos
 */
async function getUserVideos(userId) {
  try {
    const videos = await IcebreakerVideo.findAll({
      where: { user_id: userId },
      order: [['is_active', 'DESC'], ['created_at', 'DESC']],
      attributes: [
        'id',
        'title',
        'duration_seconds',
        'thumbnail_url',
        'is_active',
        'view_count',
        'like_count',
        'average_rating',
        'authenticity_score',
        'created_at',
      ],
    });
    return videos;
  } catch (error) {
    logger.error(`[IcebreakerVideo] Failed to get videos for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Get icebreaker video for a matched user (to display in their profile)
 * @param {string} userId - User ID of video owner
 * @param {string} viewerUserId - User ID of viewer
 * @returns {Promise<Object|null>} Video object with full details
 */
async function getMatchVideoForViewing(userId, viewerUserId) {
  try {
    // Check if users are matched
    const isMatched = await Match.findOne({
      where: [
        { user1_id: viewerUserId, user2_id: userId, match_status: 'matched' },
        { user1_id: userId, user2_id: viewerUserId, match_status: 'matched' },
      ],
    });

    if (!isMatched) {
      return null; // Not matched, can't view
    }

    // Get active video
    const video = await IcebreakerVideo.findOne({
      where: { user_id: userId, is_active: true },
      include: [
        {
          model: User,
          attributes: ['id', 'first_name', 'photo_url', 'age'],
        },
      ],
    });

    if (video) {
      // Increment view count
      await video.increment('view_count');
      
      // Record the view
      await recordVideoView(video.id, viewerUserId);
    }

    return video;
  } catch (error) {
    logger.error(
      `[IcebreakerVideo] Failed to get video ${userId} for viewer ${viewerUserId}:`,
      error
    );
    throw error;
  }
}

/**
 * Record that a user viewed a video
 * @param {string} videoId - Video ID
 * @param {string} viewerUserId - User viewing the video
 */
async function recordVideoView(videoId, viewerUserId) {
  try {
    // Check if already rated (which implies viewed)
    const existing = await IcebreakerVideoRating.findOne({
      where: { video_id: videoId, viewer_user_id: viewerUserId },
    });

    if (!existing) {
      // Create implicit view (no rating yet)
      await IcebreakerVideoRating.create({
        video_id: videoId,
        viewer_user_id: viewerUserId,
        rating: 3, // Default neutral rating
      });
    }
  } catch (error) {
    logger.error(
      `[IcebreakerVideo] Failed to record view for video ${videoId}:`,
      error
    );
    // Don't throw - view recording failure shouldn't block video playback
  }
}

/**
 * Rate an icebreaker video
 * @param {string} videoId - Video ID
 * @param {string} viewerUserId - Rating user ID
 * @param {Object} ratingData - Rating data
 * @returns {Promise<Object>} Rating object
 */
async function rateIcebreakerVideo(videoId, viewerUserId, ratingData) {
  try {
    const {
      rating,
      authenticity_rating,
      reaction,
      is_helpful,
      would_match,
      comment,
    } = ratingData;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Find or create rating
    let videoRating = await IcebreakerVideoRating.findOne({
      where: { video_id: videoId, viewer_user_id: viewerUserId },
    });

    if (videoRating) {
      // Update existing rating
      Object.assign(videoRating, {
        rating,
        authenticity_rating: authenticity_rating || videoRating.authenticity_rating,
        reaction: reaction || videoRating.reaction,
        is_helpful: is_helpful !== undefined ? is_helpful : videoRating.is_helpful,
        would_match: would_match !== undefined ? would_match : videoRating.would_match,
        comment: comment || videoRating.comment,
      });
      await videoRating.save();
    } else {
      // Create new rating
      videoRating = await IcebreakerVideoRating.create({
        video_id: videoId,
        viewer_user_id: viewerUserId,
        rating,
        authenticity_rating,
        reaction,
        is_helpful,
        would_match,
        comment,
      });
    }

    // Recalculate video stats
    await updateVideoStats(videoId);

    logger.info(
      `[IcebreakerVideo] User ${viewerUserId} rated video ${videoId}: ${rating} stars`
    );
    return videoRating;
  } catch (error) {
    logger.error(`[IcebreakerVideo] Failed to rate video ${videoId}:`, error);
    throw error;
  }
}

/**
 * Update video statistics (average rating, authenticity score, counts)
 * @param {string} videoId - Video ID
 */
async function updateVideoStats(videoId) {
  try {
    const ratings = await IcebreakerVideoRating.findAll({
      where: { video_id: videoId },
      attributes: [
        'rating',
        'authenticity_rating',
        'is_helpful',
        'would_match',
        'reaction',
      ],
    });

    if (ratings.length === 0) return;

    // Calculate stats
    const avgRating =
      ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

    const avgAuthenticityRating =
      ratings
        .filter((r) => r.authenticity_rating)
        .reduce((sum, r) => sum + r.authenticity_rating, 0) /
      (ratings.filter((r) => r.authenticity_rating).length || 1);

    // Authenticity score: weighted calculation based on authenticity ratings + helpful votes + would_match
    const helpfulCount = ratings.filter((r) => r.is_helpful).length;
    const wouldMatchCount = ratings.filter((r) => r.would_match).length;
    const totalRaters = ratings.length;

    const authenticity_score =
      avgAuthenticityRating * 0.5 + // 50% based on authenticity ratings
      (helpfulCount / totalRaters) * 50 + // 25% based on helpful votes
      (wouldMatchCount / totalRaters) * 25; // 25% based on would_match votes

    const like_count = ratings.filter((r) => r.reaction === 'like').length;
    const love_count = ratings.filter((r) => r.reaction === 'love').length;
    const wow_count = ratings.filter((r) => r.reaction === 'wow').length;
    const inspiring_count = ratings.filter(
      (r) => r.reaction === 'inspiring'
    ).length;

    // Update video with new stats
    await IcebreakerVideo.update(
      {
        average_rating: parseFloat(avgRating.toFixed(2)),
        like_count: like_count + love_count + inspiring_count + wow_count,
        authenticity_score: parseFloat(authenticity_score.toFixed(2)),
      },
      { where: { id: videoId } }
    );

    logger.info(`[IcebreakerVideo] Updated stats for video ${videoId}`);
  } catch (error) {
    logger.error(
      `[IcebreakerVideo] Failed to update stats for video ${videoId}:`,
      error
    );
    // Don't throw - stats update failure shouldn't block other operations
  }
}

/**
 * Get featured videos for discovery/explore page
 * @param {number} limit - Number of videos to return
 * @returns {Promise<Array>} Featured videos
 */
async function getFeaturedVideos(limit = 12) {
  try {
    const videos = await IcebreakerVideo.findAll({
      where: { is_featured: true, is_active: true },
      include: [
        {
          model: User,
          attributes: ['id', 'first_name', 'age', 'photo_url'],
        },
      ],
      order: [
        ['authenticity_score', 'DESC'],
        ['view_count', 'DESC'],
      ],
      limit,
    });

    return videos;
  } catch (error) {
    logger.error('[IcebreakerVideo] Failed to get featured videos:', error);
    throw error;
  }
}

/**
 * Get trending videos (sorted by engagement)
 * @param {number} limit - Number of videos to return
 * @param {number} daysBack - Include videos from last N days
 * @returns {Promise<Array>} Trending videos
 */
async function getTrendingVideos(limit = 20, daysBack = 7) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const videos = await IcebreakerVideo.findAll({
      where: {
        is_active: true,
        created_at: { [require('sequelize').Op.gte]: cutoffDate },
      },
      include: [
        {
          model: User,
          attributes: ['id', 'first_name', 'age', 'photo_url'],
        },
      ],
      order: [
        ['authenticity_score', 'DESC'],
        ['average_rating', 'DESC'],
        ['like_count', 'DESC'],
        ['view_count', 'DESC'],
      ],
      limit,
    });

    return videos;
  } catch (error) {
    logger.error('[IcebreakerVideo] Failed to get trending videos:', error);
    throw error;
  }
}

/**
 * Delete an icebreaker video
 * @param {string} videoId - Video ID
 * @param {string} userId - User ID (owner verification)
 * @param {string} videoKey - S3 key for deletion
 */
async function deleteIcebreakerVideo(videoId, userId, videoKey) {
  try {
    const video = await IcebreakerVideo.findOne({
      where: { id: videoId, user_id: userId },
    });

    if (!video) {
      throw new Error('Video not found or unauthorized');
    }

    // Delete from database
    await video.destroy();

    // TODO: Delete from S3 storage
    // await deleteFromS3(videoKey);

    logger.info(`[IcebreakerVideo] Deleted video ${videoId} for user ${userId}`);
  } catch (error) {
    logger.error(`[IcebreakerVideo] Failed to delete video ${videoId}:`, error);
    throw error;
  }
}

/**
 * Get video views statistics
 * @param {string} videoId - Video ID
 * @returns {Promise<Object>} View statistics
 */
async function getVideoViewStats(videoId, userId) {
  try {
    // Verify ownership
    const video = await IcebreakerVideo.findOne({
      where: { id: videoId, user_id: userId },
    });

    if (!video) {
      throw new Error('Video not found or unauthorized');
    }

    const ratings = await IcebreakerVideoRating.findAll({
      where: { video_id: videoId },
      attributes: ['rating', 'authenticity_rating', 'reaction', 'is_helpful'],
    });

    const stats = {
      total_views: video.view_count,
      total_ratings: ratings.length,
      average_rating: video.average_rating,
      authenticity_score: video.authenticity_score,
      reactions: {
        like: ratings.filter((r) => r.reaction === 'like').length,
        love: ratings.filter((r) => r.reaction === 'love').length,
        funny: ratings.filter((r) => r.reaction === 'funny').length,
        wow: ratings.filter((r) => r.reaction === 'wow').length,
        inspiring: ratings.filter((r) => r.reaction === 'inspiring').length,
      },
      helpful_count: ratings.filter((r) => r.is_helpful).length,
      rating_distribution: {
        one: ratings.filter((r) => r.rating === 1).length,
        two: ratings.filter((r) => r.rating === 2).length,
        three: ratings.filter((r) => r.rating === 3).length,
        four: ratings.filter((r) => r.rating === 4).length,
        five: ratings.filter((r) => r.rating === 5).length,
      },
    };

    return stats;
  } catch (error) {
    logger.error(`[IcebreakerVideo] Failed to get stats for video ${videoId}:`, error);
    throw error;
  }
}

module.exports = {
  uploadIcebreakerVideo,
  getUserActiveVideo,
  getUserVideos,
  getMatchVideoForViewing,
  recordVideoView,
  rateIcebreakerVideo,
  updateVideoStats,
  getFeaturedVideos,
  getTrendingVideos,
  deleteIcebreakerVideo,
  getVideoViewStats,
};
