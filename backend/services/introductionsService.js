/**
 * Introductions Service (Concierge Light)
 * AI-based match suggestions for premium subscribers
 * 2-3 personalized introductions per week with conversation starters
 */

const { sequelize } = require('../config/database');
const {
  User,
  ConciergeMatch,
  Subscription,
  CompatibilityScore,
  DatingProfile,
  UserPreference,
  MessageTemplate,
  Match
} = require('../models');
const { Op } = require('sequelize');

const INTRO_CONFIG = {
  INTROS_PER_WEEK: 3,
  MAX_PENDING_INTROS: 5,
  COMPATIBILITY_THRESHOLD: 65,
  PREMIUM_PLANS: ['premium', 'gold'],
  REFRESH_DAYS: 7,
  MIN_PROFILE_COMPLETION: 50 // %
};

class IntroductionsService {
  /**
   * Check if user is premium and eligible for introductions
   */
  async isEligibleForIntros(userId) {
    try {
      const subscription = await Subscription.findOne({
        where: { userId }
      });

      if (!subscription) return false;

      const isPremium = INTRO_CONFIG.PREMIUM_PLANS.includes(subscription.plan);
      const isActive = subscription.status === 'active';

      if (!isPremium || !isActive) return false;

      // Check profile completion
      const profile = await DatingProfile.findOne({
        where: { userId }
      });

      if (!profile) return false;

      const completionScore = this.calculateProfileCompletion(profile);
      return completionScore >= INTRO_CONFIG.MIN_PROFILE_COMPLETION;
    } catch (error) {
      console.error('Error checking intro eligibility:', error);
      return false;
    }
  }

  /**
   * Calculate profile completion percentage
   */
  calculateProfileCompletion(profile) {
    let completedFields = 0;
    const totalFields = 10;

    if (profile.bio && profile.bio.trim()) completedFields++;
    if (profile.age) completedFields++;
    if (profile.gender) completedFields++;
    if (profile.height) completedFields++;
    if (profile.occupation) completedFields++;
    if (profile.education) completedFields++;
    if (profile.relationship_goal) completedFields++;
    if (profile.smoking_status) completedFields++;
    if (profile.drinking_status) completedFields++;
    if (profile.profile_photo_url) completedFields++;

    return Math.round((completedFields / totalFields) * 100);
  }

  /**
   * Generate personalized introductions for a user
   */
  async generateIntroductions(userId, count = INTRO_CONFIG.INTROS_PER_WEEK) {
    try {
      const transaction = await sequelize.transaction();

      try {
        // Check eligibility
        const isEligible = await this.isEligibleForIntros(userId);
        if (!isEligible) {
          await transaction.rollback();
          return { success: false, message: 'User not eligible for introductions' };
        }

        // Check existing pending introductions
        const pendingCount = await ConciergeMatch.count({
          where: {
            user_id: userId,
            status: 'pending'
          },
          transaction
        });

        if (pendingCount >= INTRO_CONFIG.MAX_PENDING_INTROS) {
          await transaction.rollback();
          return {
            success: false,
            message: 'Too many pending introductions. Please respond to existing ones.'
          };
        }

        // Get user's preferences and profile
        const userProfile = await DatingProfile.findOne({
          where: { userId },
          include: [{ model: User, as: 'user' }],
          transaction
        });

        if (!userProfile) {
          await transaction.rollback();
          return { success: false, message: 'User profile not found' };
        }

        // Get candidates (users not yet matched or introduced)
        const candidates = await this.findMatchCandidates(
          userId,
          userProfile,
          count * 3, // Fetch extra to filter
          transaction
        );

        if (candidates.length === 0) {
          await transaction.rollback();
          return { success: false, message: 'No suitable candidates found' };
        }

        // Score and rank candidates
        const scoredCandidates = await Promise.all(
          candidates.map(async (candidate) => ({
            candidate,
            score: await this.calculateMatchScore(userId, candidate.id, transaction),
            reasons: await this.getMatchReasons(userProfile, candidate)
          }))
        );

        // Sort by score and take top N
        const topMatches = scoredCandidates
          .filter((m) => m.score >= INTRO_CONFIG.COMPATIBILITY_THRESHOLD)
          .sort((a, b) => b.score - a.score)
          .slice(0, count);

        if (topMatches.length === 0) {
          await transaction.rollback();
          return { success: false, message: 'No high-compatibility matches found' };
        }

        // Create introductions with conversation starters
        const introductions = [];
        for (const match of topMatches) {
          // Get conversation starters
          const starters = await this.generateConversationStarters(
            userProfile,
            match.candidate,
            transaction
          );

          // Generate personalized note
          const note = this.generateConciergeNote(
            userProfile,
            match.candidate,
            match.reasons,
            match.score
          );

          // Create concierge match
          const intro = await ConciergeMatch.create(
            {
              user_id: userId,
              matched_user_id: match.candidate.id,
              concierge_note: note,
              compatibility_reasons: match.reasons,
              suggested_date_idea: match.reasons.activity || null,
              status: 'pending'
            },
            { transaction }
          );

          introductions.push({
            id: intro.id,
            profile: match.candidate,
            score: match.score,
            reasons: match.reasons,
            starters,
            note
          });
        }

        await transaction.commit();
        return {
          success: true,
          count: introductions.length,
          introductions,
          message: `Generated ${introductions.length} introduction${introductions.length !== 1 ? 's' : ''}`
        };
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error generating introductions:', error);
      return {
        success: false,
        message: 'Failed to generate introductions',
        error: error.message
      };
    }
  }

  /**
   * Find candidate users for introduction
   */
  async findMatchCandidates(userId, userProfile, limit, transaction) {
    try {
      // Exclude: self, already matched, already introduced, blocked
      const existingMatches = await Match.findAll({
        attributes: ['user_id_1', 'user_id_2'],
        where: {
          [Op.or]: [
            { user_id_1: userId },
            { user_id_2: userId }
          ]
        },
        transaction
      });

      const matchedUserIds = new Set(
        existingMatches.flatMap((m) => [m.user_id_1, m.user_id_2])
      );
      matchedUserIds.add(userId);

      const existingIntros = await ConciergeMatch.findAll({
        attributes: ['matched_user_id'],
        where: {
          user_id: userId,
          status: { [Op.ne]: 'passed' }
        },
        transaction
      });

      const introUserIds = new Set(
        existingIntros.map((intro) => intro.matched_user_id)
      );

      // Build query
      const candidates = await DatingProfile.findAll({
        attributes: ['id', 'userId', 'gender', 'age', 'location', 'bio', 'profile_photo_url', 'interests'],
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'email']
          }
        ],
        where: {
          userId: {
            [Op.notIn]: Array.from(matchedUserIds).concat(Array.from(introUserIds))
          },
          gender: userProfile.interested_in || 'all'
        },
        limit,
        order: sequelize.random(),
        transaction
      });

      return candidates;
    } catch (error) {
      console.error('Error finding match candidates:', error);
      return [];
    }
  }

  /**
   * Calculate match score between two users
   */
  async calculateMatchScore(userId, candidateId, transaction) {
    try {
      const compatibility = await CompatibilityScore.findOne({
        where: {
          viewer_id: userId,
          candidate_id: candidateId
        },
        transaction
      });

      if (compatibility) {
        return Number(compatibility.overall_score) || 75;
      }

      // Fallback: Return moderate score
      return 75;
    } catch (error) {
      console.error('Error calculating match score:', error);
      return 75;
    }
  }

  /**
   * Get specific reasons for match
   */
  async getMatchReasons(userProfile, candidateProfile) {
    const reasons = [];

    // Shared interests
    if (userProfile.interests && candidateProfile.interests) {
      const userInterests = Array.isArray(userProfile.interests)
        ? userProfile.interests
        : userProfile.interests.split(',').map((i) => i.trim());
      const candidateInterests = Array.isArray(candidateProfile.interests)
        ? candidateProfile.interests
        : candidateProfile.interests.split(',').map((i) => i.trim());

      const shared = userInterests.filter((i) => candidateInterests.includes(i));
      if (shared.length > 0) {
        reasons.push({
          type: 'shared_interests',
          label: `You both love ${shared.slice(0, 2).join(', ')}`,
          values: shared
        });
      }
    }

    // Location proximity
    if (userProfile.location && candidateProfile.location) {
      if (userProfile.location === candidateProfile.location) {
        reasons.push({
          type: 'location',
          label: `Both in ${userProfile.location}`
        });
      }
    }

    // Age compatibility
    if (userProfile.age && candidateProfile.age) {
      const ageDiff = Math.abs(userProfile.age - candidateProfile.age);
      if (ageDiff <= 5) {
        reasons.push({
          type: 'age',
          label: `Similar age range`
        });
      }
    }

    // Activity suggestion
    reasons.activity = `Grab coffee or attend a ${shared && shared[0] ? shared[0].toLowerCase() : 'community'} event together`;

    return reasons;
  }

  /**
   * Generate conversation starters for introduction
   */
  async generateConversationStarters(userProfile, candidateProfile, transaction) {
    try {
      // Get existing templates for this match
      const templates = await MessageTemplate.findAll({
        where: {
          recipientUserId: candidateProfile.id,
          category: {
            [Op.in]: ['shared_interest', 'location_based', 'activity_suggestion']
          }
        },
        limit: 5,
        order: sequelize.literal('RANDOM()'),
        transaction
      });

      if (templates.length > 0) {
        return templates.map((t) => ({
          id: t.id,
          title: t.title,
          content: t.content,
          category: t.category
        }));
      }

      // Generate AI-like starters if no templates
      const starters = this.generateDefaultStarters(userProfile, candidateProfile);
      return starters;
    } catch (error) {
      console.error('Error generating conversation starters:', error);
      return this.generateDefaultStarters(userProfile, candidateProfile);
    }
  }

  /**
   * Generate default conversation starters
   */
  generateDefaultStarters(userProfile, candidateProfile) {
    const starters = [];

    // Extract interests for context
    const interests = Array.isArray(candidateProfile.interests)
      ? candidateProfile.interests
      : (candidateProfile.interests || '').split(',').map((i) => i.trim());

    const firstInterest = interests[0] || 'adventures';

    starters.push({
      title: 'Shared Interest Icebreaker',
      content: `Hey! I noticed you're into ${firstInterest} too. What got you started with that?`,
      category: 'shared_interest'
    });

    starters.push({
      title: 'Location Connection',
      content: `I love ${candidateProfile.location || 'this area'}! Do you have any favorite spots there?`,
      category: 'location_based'
    });

    starters.push({
      title: 'Activity Suggestion',
      content: `Would you ever want to check out a ${firstInterest} event together? I'd love to explore it with someone who shares the same passion!`,
      category: 'activity_suggestion'
    });

    starters.push({
      title: 'Personal Question',
      content: `What's your ideal weekend look like? I'm always looking for new ideas!`,
      category: 'question_based'
    });

    starters.push({
      title: 'Genuine Compliment',
      content: `Your bio really resonated with me – you seem like someone who has their priorities straight. What's something you're passionate about right now?`,
      category: 'compliment'
    });

    return starters;
  }

  /**
   * Generate personalized concierge note
   */
  generateConciergeNote(userProfile, candidateProfile, reasons, score) {
    let note = `Based on your profile, we matched you with ${candidateProfile.first_name || candidateProfile.user.username}. `;

    if (reasons.length > 0) {
      const reasonText = reasons
        .filter((r) => r.label)
        .map((r) => r.label)
        .join('. ');
      note += `${reasonText}. `;
    }

    note += `We think you'd have great chemistry! Take a look and say hi if you're interested. 🎯`;

    return note;
  }

  /**
   * Get introductions for user
   */
  async getIntroductions(userId, status = 'pending', limit = 10) {
    try {
      const introductions = await ConciergeMatch.findAll({
        where: {
          user_id: userId,
          status
        },
        include: [
          {
            model: User,
            as: 'matchedUser',
            attributes: ['id', 'username'],
            include: [
              {
                model: DatingProfile,
                as: 'datingProfile',
                attributes: ['id', 'age', 'location', 'bio', 'profile_photo_url', 'interests']
              }
            ]
          }
        ],
        order: [['curated_at', 'DESC']],
        limit
      });

      return introductions.map((intro) => ({
        id: intro.id,
        userId: intro.matched_user_id,
        profile: {
          id: intro.matchedUser.datingProfile?.id,
          username: intro.matchedUser.username,
          age: intro.matchedUser.datingProfile?.age,
          location: intro.matchedUser.datingProfile?.location,
          bio: intro.matchedUser.datingProfile?.bio,
          photoUrl: intro.matchedUser.datingProfile?.profile_photo_url,
          interests: intro.matchedUser.datingProfile?.interests
        },
        conciergeNote: intro.concierge_note,
        reasons: intro.compatibility_reasons,
        suggestedActivity: intro.suggested_date_idea,
        status: intro.status,
        createdAt: intro.curated_at,
        respondedAt: intro.user_response_at,
        quality: intro.quality_rating,
        feedback: intro.feedback
      }));
    } catch (error) {
      console.error('Error getting introductions:', error);
      return [];
    }
  }

  /**
   * Respond to introduction (like/pass)
   */
  async respondToIntro(userId, introId, response, feedback = null) {
    try {
      const intro = await ConciergeMatch.findOne({
        where: {
          id: introId,
          user_id: userId
        }
      });

      if (!intro) {
        return { success: false, message: 'Introduction not found' };
      }

      const updateData = {
        status: response, // 'liked' or 'passed'
        user_response_at: new Date()
      };

      if (feedback && response === 'passed') {
        updateData.feedback = feedback;
      }

      await intro.update(updateData);

      // If liked, create a match
      if (response === 'liked') {
        const existingMatch = await Match.findOne({
          where: {
            [Op.or]: [
              {
                user_id_1: userId,
                user_id_2: intro.matched_user_id
              },
              {
                user_id_1: intro.matched_user_id,
                user_id_2: userId
              }
            ]
          }
        });

        if (!existingMatch) {
          await Match.create({
            user_id_1: userId,
            user_id_2: intro.matched_user_id,
            match_source: 'concierge_introduction'
          });

          return {
            success: true,
            message: 'Introduction liked and match created!',
            matched: true
          };
        }
      }

      return {
        success: true,
        message: `Introduction marked as ${response}`,
        matched: response === 'liked'
      };
    } catch (error) {
      console.error('Error responding to introduction:', error);
      return { success: false, message: 'Failed to respond' };
    }
  }

  /**
   * Rate introduction quality
   */
  async rateIntroduction(userId, introId, rating, feedback = null) {
    try {
      const intro = await ConciergeMatch.findOne({
        where: {
          id: introId,
          user_id: userId
        }
      });

      if (!intro) {
        return { success: false, message: 'Introduction not found' };
      }

      await intro.update({
        quality_rating: Math.min(5, Math.max(1, rating)),
        feedback: feedback || null
      });

      return { success: true, message: 'Rating recorded' };
    } catch (error) {
      console.error('Error rating introduction:', error);
      return { success: false, message: 'Failed to rate introduction' };
    }
  }

  /**
   * Check if new introductions should be generated for user
   */
  async shouldGenerateNewIntros(userId) {
    try {
      const lastGenerated = await ConciergeMatch.findOne({
        where: { user_id: userId },
        order: [['curated_at', 'DESC']],
        attributes: ['curated_at']
      });

      if (!lastGenerated) return true;

      const daysSinceGenerated = Math.floor(
        (Date.now() - new Date(lastGenerated.curated_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      return daysSinceGenerated >= INTRO_CONFIG.REFRESH_DAYS;
    } catch (error) {
      console.error('Error checking intro generation:', error);
      return false;
    }
  }

  /**
   * Get user's introduction statistics
   */
  async getIntroStats(userId) {
    try {
      const total = await ConciergeMatch.count({
        where: { user_id: userId }
      });

      const pending = await ConciergeMatch.count({
        where: {
          user_id: userId,
          status: 'pending'
        }
      });

      const liked = await ConciergeMatch.count({
        where: {
          user_id: userId,
          status: 'liked'
        }
      });

      const passed = await ConciergeMatch.count({
        where: {
          user_id: userId,
          status: 'passed'
        }
      });

      const matched = await ConciergeMatch.count({
        where: {
          user_id: userId,
          status: 'matched'
        }
      });

      // Get average quality rating
      const ratingResult = await sequelize.query(
        `SELECT AVG(quality_rating) as avg_rating 
         FROM concierge_matches 
         WHERE user_id = $1 AND quality_rating IS NOT NULL`,
        {
          bind: [userId],
          type: sequelize.QueryTypes.SELECT
        }
      );

      const avgRating = ratingResult[0]?.avg_rating || 0;

      return {
        total,
        pending,
        liked,
        passed,
        matched,
        averageQuality: Math.round(avgRating * 10) / 10
      };
    } catch (error) {
      console.error('Error getting intro stats:', error);
      return { total: 0, pending: 0, liked: 0, passed: 0, matched: 0 };
    }
  }
}

module.exports = new IntroductionsService();
