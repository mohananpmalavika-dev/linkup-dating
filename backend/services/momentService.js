const db = require('../config/database');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

const Moment = db.models.Moment;
const MomentView = db.models.MomentView;
const User = db.models.User;
const Match = db.models.Match;

const MOMENT_EXPIRY_HOURS = 24;

const momentService = {
  /**
   * Upload a new moment (24hr ephemeral photo)
   */
  async uploadMoment(userId, photoUrl, photoKey, caption) {
    try {
      if (!photoUrl) {
        throw new Error('Photo URL is required');
      }

      // Validate caption length
      if (caption && caption.length > 200) {
        throw new Error('Caption must be 200 characters or less');
      }

      // Calculate expiry time (24 hours from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + MOMENT_EXPIRY_HOURS);

      const moment = await Moment.create({
        user_id: userId,
        photo_url: photoUrl,
        photo_key: photoKey,
        caption: caption || null,
        expires_at: expiresAt,
      });

      return {
        success: true,
        message: 'Moment uploaded successfully',
        moment: {
          id: moment.id,
          photoUrl: moment.photo_url,
          caption: moment.caption,
          expiresAt: moment.expires_at,
          createdAt: moment.created_at,
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
   * Get moments from user's current matches (only non-expired)
   */
  async getMatchesMoments(userId) {
    try {
      // Get all current matches for the user
      const matches = await Match.findAll({
        where: {
          [Op.or]: [{ user_id_1: userId }, { user_id_2: userId }],
          status: 'matched',
        },
        attributes: ['user_id_1', 'user_id_2'],
      });

      if (matches.length === 0) {
        return {
          success: true,
          moments: [],
          message: 'No matches yet',
        };
      }

      // Extract all match user IDs
      const matchUserIds = matches.map(m =>
        m.user_id_1 === userId ? m.user_id_2 : m.user_id_1
      );

      // Get non-expired moments from matches
      const moments = await Moment.findAll({
        where: {
          user_id: { [Op.in]: matchUserIds },
          expires_at: { [Op.gt]: new Date() },
          is_deleted: false,
        },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'first_name', 'last_name', 'photo_url'],
          },
        ],
        order: [['created_at', 'DESC']],
      });

      // For each moment, check if current user has viewed it
      const momentsWithViewStatus = await Promise.all(
        moments.map(async m => {
          const hasViewed = await MomentView.findOne({
            where: {
              moment_id: m.id,
              viewer_user_id: userId,
            },
          });

          const timeUntilExpiry = this.getTimeUntilExpiry(m.expires_at);

          return {
            id: m.id,
            userId: m.user_id,
            userName: `${m.user.first_name} ${m.user.last_name}`,
            userPhoto: m.user.photo_url,
            photoUrl: m.photo_url,
            caption: m.caption,
            createdAt: m.created_at,
            expiresAt: m.expires_at,
            timeUntilExpiry,
            hasViewed: !!hasViewed,
            viewCount: m.view_count,
          };
        })
      );

      return {
        success: true,
        moments: momentsWithViewStatus,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Mark a moment as viewed by the current user
   */
  async recordMomentView(momentId, viewerUserId) {
    try {
      // Check if moment exists and is not expired
      const moment = await Moment.findByPk(momentId);
      if (!moment) {
        throw new Error('Moment not found');
      }

      if (new Date() > moment.expires_at) {
        throw new Error('Moment has expired');
      }

      // Check if already viewed
      const existingView = await MomentView.findOne({
        where: {
          moment_id: momentId,
          viewer_user_id: viewerUserId,
        },
      });

      if (existingView) {
        return {
          success: true,
          message: 'Already viewed',
        };
      }

      // Record the view
      const view = await MomentView.create({
        moment_id: momentId,
        viewer_user_id: viewerUserId,
      });

      // Increment view count
      await moment.increment('view_count');

      return {
        success: true,
        message: 'View recorded',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Get viewers of a moment (only owner can see this)
   */
  async getMomentViewers(momentId, userId) {
    try {
      const moment = await Moment.findByPk(momentId);
      if (!moment) {
        throw new Error('Moment not found');
      }

      // Only owner can see who viewed their moment
      if (moment.user_id !== userId) {
        throw new Error('Unauthorized');
      }

      const viewers = await MomentView.findAll({
        where: { moment_id: momentId },
        include: [
          {
            model: User,
            as: 'viewer',
            attributes: ['id', 'first_name', 'last_name', 'photo_url'],
          },
        ],
        order: [['viewed_at', 'DESC']],
      });

      return {
        success: true,
        viewers: viewers.map(v => ({
          userId: v.viewer_user_id,
          userName: `${v.viewer.first_name} ${v.viewer.last_name}`,
          userPhoto: v.viewer.photo_url,
          viewedAt: v.viewed_at,
        })),
        viewCount: viewers.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Get user's own moments (24hr window)
   */
  async getUserMoments(userId) {
    try {
      const moments = await Moment.findAll({
        where: {
          user_id: userId,
          expires_at: { [Op.gt]: new Date() },
          is_deleted: false,
        },
        include: [
          {
            model: db.models.MomentView,
            as: 'views',
            attributes: ['viewer_user_id', 'viewed_at'],
          },
        ],
        order: [['created_at', 'DESC']],
      });

      return {
        success: true,
        moments: moments.map(m => ({
          id: m.id,
          photoUrl: m.photo_url,
          caption: m.caption,
          createdAt: m.created_at,
          expiresAt: m.expires_at,
          timeUntilExpiry: this.getTimeUntilExpiry(m.expires_at),
          viewCount: m.view_count,
          viewers: m.views.length,
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
   * Delete expired moments (cleanup job)
   */
  async deleteExpiredMoments() {
    try {
      const now = new Date();

      // Find expired moments
      const expiredMoments = await Moment.findAll({
        where: {
          expires_at: { [Op.lte]: now },
          is_deleted: false,
        },
      });

      if (expiredMoments.length === 0) {
        return {
          success: true,
          message: 'No expired moments to delete',
          deletedCount: 0,
        };
      }

      // Delete associated views first
      const momentIds = expiredMoments.map(m => m.id);
      await MomentView.destroy({
        where: {
          moment_id: { [Op.in]: momentIds },
        },
      });

      // Mark moments as deleted (soft delete)
      await Moment.update(
        { is_deleted: true },
        {
          where: {
            id: { [Op.in]: momentIds },
          },
        }
      );

      // TODO: Delete photo files from storage (S3, etc.)
      // for (const moment of expiredMoments) {
      //   if (moment.photo_key) {
      //     await deleteFromStorage(moment.photo_key);
      //   }
      // }

      return {
        success: true,
        message: `Deleted ${expiredMoments.length} expired moments`,
        deletedCount: expiredMoments.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Get moments feed statistics
   */
  async getMomentsStats(userId) {
    try {
      // Get user's active moments
      const userMoments = await Moment.findAll({
        where: {
          user_id: userId,
          expires_at: { [Op.gt]: new Date() },
          is_deleted: false,
        },
      });

      // Get total views across all moments
      const totalViews = userMoments.reduce((sum, m) => sum + m.view_count, 0);

      // Get matches who viewed moments
      const viewedByMatches = await MomentView.findAll({
        where: {
          moment_id: { [Op.in]: userMoments.map(m => m.id) },
        },
        attributes: ['viewer_user_id'],
        raw: true,
      });

      const uniqueViewersCount = new Set(
        viewedByMatches.map(v => v.viewer_user_id)
      ).size;

      return {
        success: true,
        stats: {
          activeMoments: userMoments.length,
          totalViews,
          uniqueViewers: uniqueViewersCount,
          oldestMomentExpiry: userMoments.length > 0
            ? Math.min(...userMoments.map(m => m.expires_at.getTime()))
            : null,
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
   * Helper: Get human-readable time until expiry
   */
  getTimeUntilExpiry(expiresAt) {
    const now = new Date();
    const diff = expiresAt - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  },
};

module.exports = momentService;
