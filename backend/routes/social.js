const express = require('express');
const crypto = require('crypto');
const db = require('../models');
const userNotificationService = require('../services/userNotificationService');

const router = express.Router();
const { Op, QueryTypes } = db.Sequelize;

const MAX_FRIENDS = 1000;
const REFERRAL_EXPIRY_DAYS = 30;
const REFERRAL_CODE_LENGTH = 12;
const SUPPORTED_SOCIAL_PLATFORMS = ['instagram', 'tiktok', 'twitter', 'facebook'];
const REFERRAL_REWARD_TEMPLATE = {
  boostCredits: 1,
  superlikeCredits: 3,
  premiumTrialDays: 7
};
const REFERRAL_QUALITY_BONUS_TEMPLATE = {
  boostCredits: 1,
  superlikeCredits: 1,
  premiumTrialDays: 3
};
const REFERRAL_QUALITY_THRESHOLD_TEMPLATE = {
  minProfileCompletionPercent: 80,
  requiresVerification: true,
  minAcceptedConversations: 1,
  minActiveMatches: 1,
  minPositiveFeedbackScore: 70
};
const DEFAULT_ENGAGEMENT_LOOP_SETTINGS = {
  audioPromptsEnabled: true,
  warmUpSpacesEnabled: true,
  datingIntentOnly: true
};

const slugify = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

const generateReferralCode = () =>
  crypto.randomBytes(REFERRAL_CODE_LENGTH / 2).toString('hex').toUpperCase();

const generateReferralLink = (referralCode) => {
  const baseUrl = process.env.APP_BASE_URL || 'https://datinghub.app';
  return `${baseUrl}/signup?ref=${referralCode}`;
};

const buildDisplayName = (row = {}) =>
  row.first_name || row.firstName || row.username || row.email || 'DatingHub member';

const normalizeRewardPayload = (reward = {}) => ({
  boostCredits: Number(reward.boostCredits ?? reward.boost_credits ?? REFERRAL_REWARD_TEMPLATE.boostCredits) || 0,
  superlikeCredits: Number(
    reward.superlikeCredits ?? reward.superlike_credits ?? REFERRAL_REWARD_TEMPLATE.superlikeCredits
  ) || 0,
  premiumTrialDays: Number(
    reward.premiumTrialDays ?? reward.premium_trial_days ?? REFERRAL_REWARD_TEMPLATE.premiumTrialDays
  ) || 0
});

const normalizeBoolean = (value, fallbackValue = false) => {
  if (value === undefined || value === null) {
    return fallbackValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  return Boolean(value);
};

const normalizeNumber = (value, fallbackValue = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallbackValue;
};

const normalizeIsoDate = (value) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const percentage = (numerator, denominator) =>
  denominator > 0 ? Math.round((Number(numerator || 0) / Number(denominator || 0)) * 100) : 0;

const extractEngagementLoopSettings = (preferenceFlexibility = {}) => {
  const engagementLoops =
    preferenceFlexibility && typeof preferenceFlexibility === 'object' && preferenceFlexibility.engagementLoops
      ? preferenceFlexibility.engagementLoops
      : {};

  return {
    audioPromptsEnabled:
      engagementLoops.audioPromptsEnabled === undefined
        ? DEFAULT_ENGAGEMENT_LOOP_SETTINGS.audioPromptsEnabled
        : normalizeBoolean(engagementLoops.audioPromptsEnabled, true),
    warmUpSpacesEnabled:
      engagementLoops.warmUpSpacesEnabled === undefined
        ? DEFAULT_ENGAGEMENT_LOOP_SETTINGS.warmUpSpacesEnabled
        : normalizeBoolean(engagementLoops.warmUpSpacesEnabled, true),
    datingIntentOnly:
      engagementLoops.datingIntentOnly === undefined
        ? DEFAULT_ENGAGEMENT_LOOP_SETTINGS.datingIntentOnly
        : normalizeBoolean(engagementLoops.datingIntentOnly, true)
  };
};

const normalizeReferralThresholds = (thresholds = {}) => ({
  minProfileCompletionPercent: Math.max(
    0,
    Math.min(
      100,
      Math.round(
        normalizeNumber(
          thresholds.minProfileCompletionPercent ?? thresholds.min_profile_completion_percent,
          REFERRAL_QUALITY_THRESHOLD_TEMPLATE.minProfileCompletionPercent
        )
      )
    )
  ),
  requiresVerification:
    thresholds.requiresVerification === undefined && thresholds.requires_verification === undefined
      ? REFERRAL_QUALITY_THRESHOLD_TEMPLATE.requiresVerification
      : normalizeBoolean(
          thresholds.requiresVerification ?? thresholds.requires_verification,
          REFERRAL_QUALITY_THRESHOLD_TEMPLATE.requiresVerification
        ),
  minAcceptedConversations: Math.max(
    0,
    Math.round(
      normalizeNumber(
        thresholds.minAcceptedConversations ?? thresholds.min_accepted_conversations,
        REFERRAL_QUALITY_THRESHOLD_TEMPLATE.minAcceptedConversations
      )
    )
  ),
  minActiveMatches: Math.max(
    0,
    Math.round(
      normalizeNumber(
        thresholds.minActiveMatches ?? thresholds.min_active_matches,
        REFERRAL_QUALITY_THRESHOLD_TEMPLATE.minActiveMatches
      )
    )
  ),
  minPositiveFeedbackScore: Math.max(
    0,
    Math.min(
      100,
      Math.round(
        normalizeNumber(
          thresholds.minPositiveFeedbackScore ?? thresholds.min_positive_feedback_score,
          REFERRAL_QUALITY_THRESHOLD_TEMPLATE.minPositiveFeedbackScore
        )
      )
    )
  )
});

const normalizeReferralQualityState = (state = {}) => ({
  qualityQualified: normalizeBoolean(state.qualityQualified ?? state.quality_qualified, false),
  bonusAwarded: normalizeBoolean(state.bonusAwarded ?? state.bonus_awarded, false),
  qualityScore: Math.max(0, Math.min(100, Math.round(normalizeNumber(state.qualityScore ?? state.quality_score, 0)))),
  activationStatus: String(state.activationStatus ?? state.activation_status ?? 'pending'),
  qualifiedAt: normalizeIsoDate(state.qualifiedAt ?? state.qualified_at),
  bonusAwardedAt: normalizeIsoDate(state.bonusAwardedAt ?? state.bonus_awarded_at),
  evaluatedAt: normalizeIsoDate(state.evaluatedAt ?? state.evaluated_at)
});

const normalizeReferralProgram = (reward = {}) => {
  const source = reward && typeof reward === 'object' ? reward : {};
  const starterReward = normalizeRewardPayload(source.starterReward || source.starter_reward || source.rewardOffer || source);
  const qualityBonus = normalizeRewardPayload(source.qualityBonus || source.quality_bonus || REFERRAL_QUALITY_BONUS_TEMPLATE);
  const activationThresholds = normalizeReferralThresholds(
    source.activationThresholds || source.activation_thresholds
  );
  const qualityState = normalizeReferralQualityState(source.qualityState || source.quality_state);

  return {
    boostCredits: starterReward.boostCredits,
    superlikeCredits: starterReward.superlikeCredits,
    premiumTrialDays: starterReward.premiumTrialDays,
    starterReward,
    qualityBonus,
    activationThresholds,
    qualityState,
    rewardOffer: starterReward
  };
};

const serializeReferralProgram = (reward = {}) => {
  const program = normalizeReferralProgram(reward);

  return {
    reward: program.starterReward,
    rewardOffer: program.rewardOffer,
    starterReward: program.starterReward,
    qualityBonus: program.qualityBonus,
    activationThresholds: program.activationThresholds,
    qualityState: program.qualityState
  };
};

const serializeRewardBalance = (rewardBalance) => ({
  boostCredits: Number(rewardBalance?.boostCredits ?? rewardBalance?.boost_credits ?? 0) || 0,
  superlikeCredits: Number(rewardBalance?.superlikeCredits ?? rewardBalance?.superlike_credits ?? 0) || 0,
  premiumDaysAwarded: Number(rewardBalance?.premiumDaysAwarded ?? rewardBalance?.premium_days_awarded ?? 0) || 0
});

const serializeIntegration = (integration) => {
  const row = typeof integration?.get === 'function' ? integration.get({ plain: true }) : integration;

  return {
    id: row.id,
    platform: row.platform,
    username: row.username,
    isPublic: Boolean(row.isPublic ?? row.is_public),
    is_public: Boolean(row.isPublic ?? row.is_public),
    verifiedAt: row.verifiedAt ?? row.verified_at ?? null,
    verified_at: row.verifiedAt ?? row.verified_at ?? null,
    profileUrl: row.profileUrl || null,
    createdAt: row.createdAt ?? row.created_at ?? null,
    created_at: row.createdAt ?? row.created_at ?? null
  };
};

const serializeFriendRow = (row = {}, currentUserId) => {
  const friendId = Number(row.friend_id || row.friendId || 0) || null;
  const requestSentBy = Number(row.request_sent_by || row.requestSentBy || 0) || null;
  const acceptedAt = row.accepted_at || row.acceptedAt || null;
  const requestedAt = row.requested_at || row.requestedAt || row.created_at || row.createdAt || null;
  const isIncoming = requestSentBy ? requestSentBy !== Number(currentUserId) : false;

  return {
    friendshipId: Number(row.friendship_id || row.friendshipId || row.id || 0) || null,
    friendship_id: Number(row.friendship_id || row.friendshipId || row.id || 0) || null,
    friendId,
    friend_id: friendId,
    firstName: row.first_name || row.firstName || '',
    first_name: row.first_name || row.firstName || '',
    username: row.username || null,
    email: row.email || '',
    locationCity: row.location_city || row.locationCity || '',
    location_city: row.location_city || row.locationCity || '',
    photoUrl: row.photo_url || row.photoUrl || null,
    photo_url: row.photo_url || row.photoUrl || null,
    status: row.status || 'pending',
    acceptedAt,
    accepted_at: acceptedAt,
    requestedAt,
    requested_at: requestedAt,
    requestSentBy,
    request_sent_by: requestSentBy,
    isIncoming,
    displayName: buildDisplayName(row)
  };
};

const serializeReferralIntroduction = (row = {}) => ({
  id: Number(row.id),
  referredUserId: Number(row.referred_user_id),
  referred_user_id: Number(row.referred_user_id),
  referredFirstName: row.referred_first_name || '',
  referred_first_name: row.referred_first_name || '',
  referredUsername: row.referred_username || null,
  referredAge: row.referred_age ?? null,
  referred_age: row.referred_age ?? null,
  referredLocationCity: row.referred_location_city || '',
  referred_location_city: row.referred_location_city || '',
  referredPhotoUrl: row.referred_photo_url || null,
  referred_photo_url: row.referred_photo_url || null,
  referrerFirstName: row.referrer_first_name || '',
  referrer_first_name: row.referrer_first_name || '',
  referralMessage: row.referral_message || '',
  referral_message: row.referral_message || '',
  matchResult: row.match_result || 'pending',
  match_result: row.match_result || 'pending',
  createdAt: row.created_at || null,
  created_at: row.created_at || null,
  acceptedAt: row.accepted_at || null,
  accepted_at: row.accepted_at || null
});

const buildPublicProfileUrl = (platform, username = '') => {
  const normalizedUsername = String(username || '').replace(/^@+/, '').trim();
  if (!normalizedUsername) {
    return null;
  }

  switch (platform) {
    case 'instagram':
      return `https://www.instagram.com/${normalizedUsername}`;
    case 'tiktok':
      return `https://www.tiktok.com/@${normalizedUsername}`;
    case 'twitter':
      return `https://x.com/${normalizedUsername}`;
    case 'facebook':
      return `https://www.facebook.com/${normalizedUsername}`;
    default:
      return null;
  }
};

const buildWarmUpPrompt = (label, fallback) =>
  label ? `Share the kind of first date energy you want around ${label}.` : fallback;

const buildCommunityRoomDefinitions = (profile = {}, preferenceFlexibility = {}) => {
  const engagementLoopSettings = extractEngagementLoopSettings(preferenceFlexibility);
  if (!engagementLoopSettings.warmUpSpacesEnabled) {
    return [];
  }

  const interests = Array.isArray(profile.interests) ? profile.interests.filter(Boolean).slice(0, 2) : [];
  const definitions = [];

  if (profile.locationCity) {
    definitions.push({
      slug: `city-${slugify(profile.locationCity)}`,
      type: 'city',
      name: `${profile.locationCity} Date Energy`,
      description: `A gated warm-up space for singles around ${profile.locationCity} to share date ideas before matching.`,
      warmUpPrompt: buildWarmUpPrompt(
        profile.locationCity,
        'Share the date plan you would actually say yes to this week.'
      ),
      audioPrompt:
        engagementLoopSettings.audioPromptsEnabled
          ? 'Optional 30-second audio hello: what kind of date vibe are you looking for this week?'
          : null
    });
  }

  interests.forEach((interest) => {
    definitions.push({
      slug: `interest-${slugify(interest)}`,
      type: 'interest',
      name: `${interest} Warm-Up`,
      description: `Dating-first room for people who already share an interest in ${interest}.`,
      warmUpPrompt: `What is your favorite ${String(interest).toLowerCase()} date idea?`,
      audioPrompt:
        engagementLoopSettings.audioPromptsEnabled
          ? `Optional audio prompt: describe your ${String(interest).toLowerCase()} vibe in 30 seconds.`
          : null
    });
  });

  definitions.push(
    {
      slug: 'new-here',
      type: 'community',
      name: 'New Here Warm-Up',
      description: 'A soft landing space to share green flags, comfort rules, and intentional openers.',
      warmUpPrompt: 'Share one green flag and one first-date boundary that matters to you.',
      audioPrompt:
        engagementLoopSettings.audioPromptsEnabled
          ? 'Optional audio prompt: record the kind of connection you hope to build on DatingHub.'
          : null
    },
    {
      slug: 'serious-dating',
      type: 'community',
      name: 'Serious Dating',
      description: 'For members who want clear intent, thoughtful pacing, and relationship-minded conversation.',
      warmUpPrompt: 'What does intentional dating look like for you right now?',
      audioPrompt:
        engagementLoopSettings.audioPromptsEnabled
          ? 'Optional audio prompt: share your pace and what a meaningful first date looks like.'
          : null
    }
  );

  const seen = new Set();
  return definitions
    .filter((definition) => {
      if (!definition.slug || seen.has(definition.slug)) {
        return false;
      }

      seen.add(definition.slug);
      return true;
    })
    .map((definition) => ({
      ...definition,
      datingIntentOnly: true,
      isGated: true,
      maxMembers: 40,
      entryRequirements: [
        'Complete most of your dating profile first',
        'Keep relationship goals filled in',
        'Stay on-platform and dating-focused'
      ]
    }));
};

const buildWarmUpEligibility = (profile = {}, roomDefinition = {}) => {
  const profileCompletionPercent = Math.round(normalizeNumber(profile.profileCompletionPercent, 0));
  const profileVerified = normalizeBoolean(profile.profileVerified, false);
  const relationshipGoals = String(profile.relationshipGoals || '').trim();
  const blockers = [];

  if (profileCompletionPercent < 60) {
    blockers.push('Complete at least 60% of your profile');
  }

  if (!relationshipGoals) {
    blockers.push('Add a relationship goal first');
  }

  if (roomDefinition.slug === 'serious-dating' && profileCompletionPercent < 75) {
    blockers.push('Serious Dating opens after you complete more of your profile');
  }

  return {
    canJoin: blockers.length === 0,
    blockers,
    voicePromptReady: Boolean(profile.voiceIntroUrl) && roomDefinition.audioPrompt,
    trustHint: profileVerified ? 'Verified profiles move through warm-up spaces faster.' : null
  };
};

const normalizeWarmUpProfile = (row = {}) => ({
  locationCity: row.location_city || row.locationCity || '',
  interests: Array.isArray(row.interests) ? row.interests : [],
  relationshipGoals: row.relationship_goals || row.relationshipGoals || '',
  voiceIntroUrl: row.voice_intro_url || row.voiceIntroUrl || null,
  profileCompletionPercent: normalizeNumber(row.profile_completion_percent ?? row.profileCompletionPercent, 0),
  profileVerified: normalizeBoolean(row.profile_verified ?? row.profileVerified, false),
  preferenceFlexibility:
    row.preference_flexibility && typeof row.preference_flexibility === 'object'
      ? row.preference_flexibility
      : {}
});

const ensureRewardBalance = async (userId, transaction) => {
  let rewardBalance = await db.UserRewardBalance.findOne({
    where: { userId },
    transaction
  });

  if (!rewardBalance) {
    rewardBalance = await db.UserRewardBalance.create(
      { userId },
      { transaction }
    );
  }

  return rewardBalance;
};

const grantPremiumAccess = async (userId, premiumTrialDays, transaction) => {
  if (!premiumTrialDays) {
    return null;
  }

  const now = new Date();
  const existingSubscription = await db.Subscription.findOne({
    where: { userId },
    transaction
  });

  if (!existingSubscription) {
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + premiumTrialDays);

    await db.Subscription.create(
      {
        userId,
        plan: 'premium',
        status: 'active',
        startedAt: now,
        expiresAt,
        paymentMethod: 'referral_reward'
      },
      { transaction }
    );

    return expiresAt;
  }

  const nextExpiryBase =
    existingSubscription.expiresAt && new Date(existingSubscription.expiresAt) > now
      ? new Date(existingSubscription.expiresAt)
      : new Date(now);
  nextExpiryBase.setDate(nextExpiryBase.getDate() + premiumTrialDays);

  await existingSubscription.update(
    {
      plan: existingSubscription.plan === 'gold' ? 'gold' : 'premium',
      status: 'active',
      startedAt: existingSubscription.startedAt || now,
      expiresAt: nextExpiryBase,
      paymentMethod: existingSubscription.paymentMethod || 'referral_reward'
    },
    { transaction }
  );

  return nextExpiryBase;
};

const awardReferralBundle = async (userId, reward, transaction) => {
  const normalizedReward = normalizeRewardPayload(reward);
  const rewardBalance = await ensureRewardBalance(userId, transaction);

  await rewardBalance.update(
    {
      boostCredits: Number(rewardBalance.boostCredits || 0) + normalizedReward.boostCredits,
      superlikeCredits: Number(rewardBalance.superlikeCredits || 0) + normalizedReward.superlikeCredits,
      premiumDaysAwarded: Number(rewardBalance.premiumDaysAwarded || 0) + normalizedReward.premiumTrialDays,
      lastRewardedAt: new Date()
    },
    { transaction }
  );

  const expiresAt = await grantPremiumAccess(userId, normalizedReward.premiumTrialDays, transaction);

  return {
    rewardBalance,
    expiresAt
  };
};

const getReferralActivationSnapshot = async (referredUserId, transaction = null) => {
  if (!referredUserId) {
    return null;
  }

  const [snapshot] = await db.sequelize.query(
    `SELECT
       COALESCE(dp.profile_completion_percent, 0) AS profile_completion_percent,
       COALESCE(dp.profile_verified, false) AS profile_verified,
       COUNT(DISTINCT mr.id) FILTER (
         WHERE (mr.from_user_id = :referredUserId OR mr.to_user_id = :referredUserId)
           AND mr.status = 'accepted'
       )::int AS accepted_conversations,
       COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'active')::int AS active_matches,
       ROUND(AVG(dcf.rating)::numeric, 2) AS avg_feedback_rating,
       ROUND(
         AVG(
           CASE
             WHEN dcf.would_date_again IS TRUE THEN 100
             WHEN dcf.would_date_again IS FALSE THEN 0
             ELSE NULL
           END
         )::numeric,
         2
       ) AS would_date_again_score
     FROM dating_profiles dp
     LEFT JOIN message_requests mr
       ON mr.from_user_id = dp.user_id OR mr.to_user_id = dp.user_id
     LEFT JOIN matches m
       ON (m.user_id_1 = dp.user_id OR m.user_id_2 = dp.user_id)
      AND m.status = 'active'
     LEFT JOIN date_completion_feedback dcf
       ON dcf.counterparty_user_id = dp.user_id
     WHERE dp.user_id = :referredUserId
     GROUP BY dp.user_id, dp.profile_completion_percent, dp.profile_verified`,
    {
      replacements: { referredUserId },
      type: QueryTypes.SELECT,
      transaction
    }
  );

  if (!snapshot) {
    return null;
  }

  return {
    referredUserId: Number(referredUserId),
    profileCompletionPercent: Math.round(normalizeNumber(snapshot.profile_completion_percent, 0)),
    profileVerified: normalizeBoolean(snapshot.profile_verified, false),
    acceptedConversations: Math.max(0, Math.round(normalizeNumber(snapshot.accepted_conversations, 0))),
    activeMatches: Math.max(0, Math.round(normalizeNumber(snapshot.active_matches, 0))),
    avgFeedbackRating: normalizeNumber(snapshot.avg_feedback_rating, 0),
    wouldDateAgainScore: normalizeNumber(snapshot.would_date_again_score, 0)
  };
};

const calculateReferralActivationQuality = (snapshot, thresholds) => {
  if (!snapshot) {
    return {
      qualityQualified: false,
      qualityScore: 0,
      activationStatus: 'pending',
      reasons: []
    };
  }

  const feedbackScore = snapshot.avgFeedbackRating > 0
    ? Math.round((snapshot.avgFeedbackRating / 5) * 100)
    : Math.round(snapshot.wouldDateAgainScore || 0);
  const qualityScore = Math.round(
    snapshot.profileCompletionPercent * 0.35 +
    (snapshot.profileVerified ? 20 : 0) +
    Math.min(snapshot.acceptedConversations, 2) * 10 +
    Math.min(snapshot.activeMatches, 2) * 12.5 +
    Math.min(feedbackScore, 100) * 0.125
  );
  const qualityQualified =
    snapshot.profileCompletionPercent >= thresholds.minProfileCompletionPercent &&
    (!thresholds.requiresVerification || snapshot.profileVerified) &&
    snapshot.acceptedConversations >= thresholds.minAcceptedConversations &&
    snapshot.activeMatches >= thresholds.minActiveMatches &&
    (feedbackScore === 0 || feedbackScore >= thresholds.minPositiveFeedbackScore);
  const reasons = [];

  if (snapshot.profileCompletionPercent >= thresholds.minProfileCompletionPercent) {
    reasons.push(`Profile is ${snapshot.profileCompletionPercent}% complete`);
  }
  if (!thresholds.requiresVerification || snapshot.profileVerified) {
    reasons.push(snapshot.profileVerified ? 'Profile is verified' : 'Verification not required');
  }
  if (snapshot.acceptedConversations >= thresholds.minAcceptedConversations) {
    reasons.push(`${snapshot.acceptedConversations} accepted conversation${snapshot.acceptedConversations === 1 ? '' : 's'}`);
  }
  if (snapshot.activeMatches >= thresholds.minActiveMatches) {
    reasons.push(`${snapshot.activeMatches} active match${snapshot.activeMatches === 1 ? '' : 'es'}`);
  }

  return {
    qualityQualified,
    qualityScore: Math.max(0, Math.min(100, qualityScore)),
    activationStatus: qualityQualified ? 'activated_quality' : 'warming_up',
    reasons
  };
};

const maybeGrantReferralQualityBonus = async (referral, transaction) => {
  const currentRow = typeof referral?.get === 'function' ? referral.get({ plain: true }) : referral;
  const program = normalizeReferralProgram(currentRow?.reward);
  const snapshot = await getReferralActivationSnapshot(currentRow?.referredUserId, transaction);
  const qualityEvaluation = calculateReferralActivationQuality(snapshot, program.activationThresholds);
  const nextQualityState = {
    ...program.qualityState,
    qualityQualified: qualityEvaluation.qualityQualified,
    qualityScore: qualityEvaluation.qualityScore,
    activationStatus: qualityEvaluation.activationStatus,
    evaluatedAt: new Date().toISOString(),
    qualifiedAt:
      qualityEvaluation.qualityQualified
        ? program.qualityState.qualifiedAt || new Date().toISOString()
        : program.qualityState.qualifiedAt
  };
  let rewardResult = null;
  let bonusAwarded = false;

  if (qualityEvaluation.qualityQualified && !program.qualityState.bonusAwarded) {
    rewardResult = await awardReferralBundle(currentRow.referrerUserId, program.qualityBonus, transaction);
    nextQualityState.bonusAwarded = true;
    nextQualityState.bonusAwardedAt = new Date().toISOString();
    bonusAwarded = true;
  }

  const nextProgram = {
    ...program,
    qualityState: nextQualityState
  };

  await referral.update(
    {
      reward: nextProgram
    },
    { transaction }
  );

  return {
    referralId: currentRow.id,
    referredUserId: currentRow.referredUserId,
    program: normalizeReferralProgram(nextProgram),
    qualityEvaluation,
    snapshot,
    rewardResult,
    bonusAwarded
  };
};

const syncReferralQualityBonuses = async (referrerUserId) => {
  const completedReferrals = await db.Referral.findAll({
    where: {
      referrerUserId,
      status: 'completed',
      referredUserId: { [Op.ne]: null }
    },
    order: [['completedAt', 'DESC'], ['id', 'DESC']]
  });

  const evaluations = [];
  const awardedBonuses = [];

  for (const referral of completedReferrals) {
    const transaction = await db.sequelize.transaction();

    try {
      const lockedReferral = await db.Referral.findByPk(referral.id, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      const evaluation = await maybeGrantReferralQualityBonus(lockedReferral, transaction);
      await transaction.commit();
      evaluations.push(evaluation);

      if (evaluation.bonusAwarded) {
        awardedBonuses.push(evaluation);
      }
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  if (awardedBonuses.length > 0) {
    await Promise.allSettled(
      awardedBonuses.map((evaluation) =>
        userNotificationService.createNotification(referrerUserId, {
          type: 'referral_quality_bonus',
          title: 'Referral quality bonus unlocked',
          body: 'One of your invites became an activated dater, so your quality bonus is now live.',
          metadata: {
            referredUserId: evaluation.referredUserId,
            reward: evaluation.program.qualityBonus,
            qualityScore: evaluation.qualityEvaluation.qualityScore
          }
        })
      )
    );
  }

  return evaluations;
};

const buildReferralQualitySummary = (evaluations = []) => {
  const completedReferrals = evaluations.length;
  const qualityActivated = evaluations.filter((evaluation) => evaluation.qualityEvaluation.qualityQualified).length;
  const qualityBonusAwarded = evaluations.filter((evaluation) => evaluation.bonusAwarded).length;
  const averageQualityScore = completedReferrals
    ? Math.round(
        evaluations.reduce(
          (sum, evaluation) => sum + normalizeNumber(evaluation.qualityEvaluation.qualityScore, 0),
          0
        ) / completedReferrals
      )
    : 0;

  return {
    completedReferrals,
    qualityActivated,
    qualityPending: Math.max(completedReferrals - qualityActivated, 0),
    qualityBonusAwarded,
    referralToActivatedUserQuality: percentage(qualityActivated, completedReferrals),
    averageQualityScore
  };
};

const getOrCreateActiveReferral = async (userId) => {
  const now = new Date();

  await db.Referral.update(
    { status: 'expired' },
    {
      where: {
        referrerUserId: userId,
        status: 'pending',
        expiresAt: { [Op.lt]: now }
      }
    }
  );

  let referral = await db.Referral.findOne({
    where: {
      referrerUserId: userId,
      status: 'pending',
      [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: now } }]
    },
    order: [['createdAt', 'DESC']]
  });

  if (!referral) {
    referral = await db.Referral.create({
      referrerUserId: userId,
      referralCode: generateReferralCode(),
      referralLink: '',
      reward: normalizeReferralProgram(),
      status: 'pending',
      expiresAt: new Date(Date.now() + REFERRAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
    });

    await referral.update({
      referralLink: generateReferralLink(referral.referralCode)
    });
  }

  return referral;
};

const getFriendList = async (userId, status = 'accepted', direction = 'all', limit = 50, offset = 0) => {
  const replacements = {
    userId: Number(userId),
    status,
    limit: Number(limit),
    offset: Number(offset)
  };

  let directionClause = '';
  if (status === 'pending' && direction === 'incoming') {
    directionClause = 'AND fr.request_sent_by <> :userId';
  } else if (status === 'pending' && direction === 'outgoing') {
    directionClause = 'AND fr.request_sent_by = :userId';
  }

  return db.sequelize.query(
    `SELECT
       fr.id AS friendship_id,
       fr.status,
       fr.request_sent_by,
       fr.accepted_at,
       fr.created_at AS requested_at,
       CASE
         WHEN fr.user_id_1 = :userId THEN fr.user_id_2
         ELSE fr.user_id_1
       END AS friend_id,
       u.email,
       dp.first_name,
       dp.username,
       dp.location_city,
       pp.photo_url
     FROM friend_relationships fr
     JOIN users u
       ON u.id = CASE
         WHEN fr.user_id_1 = :userId THEN fr.user_id_2
         ELSE fr.user_id_1
       END
     LEFT JOIN dating_profiles dp
       ON dp.user_id = u.id
     LEFT JOIN LATERAL (
       SELECT photo_url
       FROM profile_photos
       WHERE user_id = u.id
       ORDER BY is_primary DESC, position ASC, uploaded_at ASC
       LIMIT 1
     ) pp ON TRUE
     WHERE (fr.user_id_1 = :userId OR fr.user_id_2 = :userId)
       AND fr.status = :status
       ${directionClause}
     ORDER BY COALESCE(fr.accepted_at, fr.created_at) DESC, fr.id DESC
     LIMIT :limit OFFSET :offset`,
    {
      replacements,
      type: QueryTypes.SELECT
    }
  );
};

const getCommunityRooms = async (userId) => {
  const [profileRow] = await db.sequelize.query(
    `SELECT
       dp.location_city,
       dp.interests,
       dp.relationship_goals,
       dp.voice_intro_url,
       dp.profile_completion_percent,
       dp.profile_verified,
       up.preference_flexibility
     FROM dating_profiles dp
     LEFT JOIN user_preferences up ON up.user_id = dp.user_id
     WHERE dp.user_id = :userId
     LIMIT 1`,
    {
      replacements: { userId },
      type: QueryTypes.SELECT
    }
  );

  const warmUpProfile = normalizeWarmUpProfile(profileRow || {});
  const roomDefinitions = buildCommunityRoomDefinitions(
    warmUpProfile,
    warmUpProfile.preferenceFlexibility
  );
  if (roomDefinitions.length === 0) {
    return [];
  }

  const roomNames = roomDefinitions.map((definition) => definition.name);
  const chatrooms = await db.Chatroom.findAll({
    where: {
      isPublic: false,
      name: {
        [Op.in]: roomNames
      }
    },
    raw: true
  });

  const chatroomIds = chatrooms.map((room) => room.id);
  const memberships = chatroomIds.length > 0
    ? await db.ChatroomMember.findAll({
        where: {
          userId,
          chatroomId: {
            [Op.in]: chatroomIds
          }
        },
        raw: true
      })
    : [];
  const membershipByRoomId = new Set(memberships.map((membership) => Number(membership.chatroomId || membership.chatroom_id)));

  return roomDefinitions.map((definition) => {
    const existingRoom = chatrooms.find((room) => room.name === definition.name);
    const roomId = Number(existingRoom?.id || 0) || null;

    return {
      slug: definition.slug,
      type: definition.type,
      name: definition.name,
      description: definition.description,
      warmUpPrompt: definition.warmUpPrompt,
      audioPrompt: definition.audioPrompt,
      datingIntentOnly: definition.datingIntentOnly,
      isGated: definition.isGated,
      entryRequirements: definition.entryRequirements,
      chatroomId: roomId,
      chatroom_id: roomId,
      memberCount: Number(existingRoom?.memberCount ?? existingRoom?.member_count ?? 0) || 0,
      member_count: Number(existingRoom?.memberCount ?? existingRoom?.member_count ?? 0) || 0,
      isMember: roomId ? membershipByRoomId.has(roomId) : false,
      is_member: roomId ? membershipByRoomId.has(roomId) : false,
      eligibility: buildWarmUpEligibility(warmUpProfile, definition)
    };
  });
};

router.get('/hub', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const referralQualityEvaluations = await syncReferralQualityBonuses(userId);
    const referralQualitySummary = buildReferralQualitySummary(referralQualityEvaluations);

    const transaction = await db.sequelize.transaction();

    try {
      const [
        acceptedFriends,
        pendingIncoming,
        pendingOutgoing,
        introductionsRaw,
        rewardBalance,
        socialIntegrations,
        referral,
        communityRooms,
        totalFriends,
        totalPendingIncoming,
        totalPendingOutgoing,
        totalIntroductions,
        referralStats
      ] = await Promise.all([
        getFriendList(userId, 'accepted', 'all', 6, 0),
        getFriendList(userId, 'pending', 'incoming', 6, 0),
        getFriendList(userId, 'pending', 'outgoing', 3, 0),
        db.sequelize.query(
        `SELECT
           fr.id,
           fr.referred_user_id,
           fr.referral_message,
           fr.match_result,
           fr.created_at,
           fr.accepted_at,
           COALESCE(referred_dp.first_name, referred_user.email) AS referred_first_name,
           referred_dp.username AS referred_username,
           referred_dp.age AS referred_age,
           referred_dp.location_city AS referred_location_city,
           referred_photo.photo_url AS referred_photo_url,
           COALESCE(referrer_dp.first_name, referrer_user.email) AS referrer_first_name
         FROM friend_referrals fr
         JOIN users referred_user
           ON referred_user.id = fr.referred_user_id
         LEFT JOIN dating_profiles referred_dp
           ON referred_dp.user_id = fr.referred_user_id
         LEFT JOIN LATERAL (
           SELECT photo_url
           FROM profile_photos
           WHERE user_id = fr.referred_user_id
           ORDER BY is_primary DESC, position ASC, uploaded_at ASC
           LIMIT 1
         ) referred_photo ON TRUE
         JOIN users referrer_user
           ON referrer_user.id = fr.referrer_user_id
         LEFT JOIN dating_profiles referrer_dp
           ON referrer_dp.user_id = fr.referrer_user_id
         WHERE fr.recipient_user_id = :userId
         ORDER BY fr.created_at DESC, fr.id DESC
         LIMIT 4`,
        {
          replacements: { userId },
          type: QueryTypes.SELECT
        }
      ),
      ensureRewardBalance(userId, transaction),
      db.SocialIntegration.findAll({
        where: { userId },
        order: [['createdAt', 'ASC']],
        transaction
      }),
      getOrCreateActiveReferral(userId),
      getCommunityRooms(userId),
      db.FriendRelationship.count({
        where: {
          status: 'accepted',
          [Op.or]: [{ userId1: userId }, { userId2: userId }]
        },
        transaction
      }),
      db.FriendRelationship.count({
        where: {
          status: 'pending',
          [Op.or]: [{ userId1: userId }, { userId2: userId }],
          requestSentBy: { [Op.ne]: userId }
        },
        transaction
      }),
      db.FriendRelationship.count({
        where: {
          status: 'pending',
          [Op.or]: [{ userId1: userId }, { userId2: userId }],
          requestSentBy: userId
        },
        transaction
      }),
      db.FriendReferral.count({
        where: { recipient_user_id: userId },
        transaction
      }),
      db.sequelize.query(
        `SELECT
           COUNT(*)::int AS total_referrals,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::int AS completed,
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)::int AS pending,
           SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END)::int AS expired
         FROM referrals
         WHERE referrer_user_id = :userId`,
        {
          replacements: { userId },
          type: QueryTypes.SELECT,
          transaction
        }
      )
    ]);

    await transaction.commit();

    const activeReferral = typeof referral?.get === 'function' ? referral.get({ plain: true }) : referral;
    const serializedIntegrations = socialIntegrations.map((integration) =>
      serializeIntegration({
        ...(typeof integration.get === 'function' ? integration.get({ plain: true }) : integration),
        profileUrl: buildPublicProfileUrl(
          typeof integration.get === 'function' ? integration.get('platform') : integration.platform,
          typeof integration.get === 'function' ? integration.get('username') : integration.username
        )
      })
    );
    const stats = referralStats[0] || {};

      return res.json({
        summary: {
          totalFriends,
          totalPendingIncoming,
          totalPendingOutgoing,
          totalIntroductions,
          connectedSocialAccounts: serializedIntegrations.length
        },
        rewardWallet: serializeRewardBalance(rewardBalance),
        referral: {
          id: activeReferral.id,
          code: activeReferral.referralCode,
          link: activeReferral.referralLink,
          status: activeReferral.status,
          ...serializeReferralProgram(activeReferral.reward),
          expiresAt: activeReferral.expiresAt,
          stats: {
            totalReferrals: Number(stats.total_referrals || 0) || 0,
            completed: Number(stats.completed || 0) || 0,
            pending: Number(stats.pending || 0) || 0,
            expired: Number(stats.expired || 0) || 0
          },
          qualityMetrics: referralQualitySummary
        },
        friends: acceptedFriends.map((row) => serializeFriendRow(row, userId)),
        pendingRequests: pendingIncoming.map((row) => serializeFriendRow(row, userId)),
        outgoingRequests: pendingOutgoing.map((row) => serializeFriendRow(row, userId)),
        introductions: introductionsRaw.map(serializeReferralIntroduction),
        socialIntegrations: serializedIntegrations,
        communityRooms
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Get social hub error:', error);
    res.status(500).json({ error: 'Failed to load social hub' });
  }
});

router.get('/referral/me', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const referralQualityEvaluations = await syncReferralQualityBonuses(userId);
    const referral = await getOrCreateActiveReferral(userId);
    const row = referral.get({ plain: true });

    res.json({
      id: row.id,
      code: row.referralCode,
      link: row.referralLink,
      status: row.status,
      ...serializeReferralProgram(row.reward),
      expiresAt: row.expiresAt,
      qualityMetrics: buildReferralQualitySummary(referralQualityEvaluations)
    });
  } catch (error) {
    console.error('Get referral error:', error);
    res.status(500).json({ error: 'Failed to get referral info' });
  }
});

router.get('/referral/stats', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const referralQualityEvaluations = await syncReferralQualityBonuses(userId);
    const [stats, rewardBalance] = await Promise.all([
      db.sequelize.query(
        `SELECT
           COUNT(*)::int AS total_referrals,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::int AS completed,
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)::int AS pending,
           SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END)::int AS expired
         FROM referrals
         WHERE referrer_user_id = :userId`,
        {
          replacements: { userId },
          type: QueryTypes.SELECT
        }
      ),
      ensureRewardBalance(userId)
    ]);

    const counts = stats[0] || {};

    res.json({
      total_referrals: Number(counts.total_referrals || 0) || 0,
      completed: Number(counts.completed || 0) || 0,
      pending: Number(counts.pending || 0) || 0,
      expired: Number(counts.expired || 0) || 0,
      earnedRewards: serializeRewardBalance(rewardBalance),
      reward_offer: normalizeReferralProgram().starterReward,
      quality_bonus: normalizeReferralProgram().qualityBonus,
      quality_summary: buildReferralQualitySummary(referralQualityEvaluations)
    });
  } catch (error) {
    console.error('Get referral stats error:', error);
    res.status(500).json({ error: 'Failed to get referral stats' });
  }
});

router.post('/referral/validate', async (req, res) => {
  try {
    const code = String(req.body?.code || '').trim().toUpperCase();
    if (!code) {
      return res.status(400).json({ error: 'Referral code required' });
    }

    const referral = await db.Referral.findOne({
      where: {
        referralCode: code,
        status: 'pending',
        [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }]
      }
    });

    if (!referral) {
      return res.status(404).json({ error: 'Invalid or expired referral code' });
    }

    res.json({
      valid: true,
      referrerId: referral.referrerUserId,
      reward: normalizeReferralProgram(referral.reward).starterReward,
      starterReward: normalizeReferralProgram(referral.reward).starterReward,
      qualityBonus: normalizeReferralProgram(referral.reward).qualityBonus
    });
  } catch (error) {
    console.error('Validate referral error:', error);
    res.status(500).json({ error: 'Failed to validate referral' });
  }
});

router.post('/referral/complete', async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const userId = req.user?.id;
    const code = String(req.body?.code || '').trim().toUpperCase();

    if (!userId) {
      await transaction.rollback();
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!code) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Referral code required' });
    }

    const referral = await db.Referral.findOne({
      where: {
        referralCode: code,
        status: 'pending'
      },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!referral || (referral.expiresAt && new Date(referral.expiresAt) <= new Date())) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Invalid or expired referral code' });
    }

    if (Number(referral.referrerUserId) === Number(userId)) {
      await transaction.rollback();
      return res.status(400).json({ error: 'You cannot use your own referral code' });
    }

    const existingReferralUsage = await db.Referral.findOne({
      where: {
        referredUserId: userId,
        status: 'completed'
      },
      transaction
    });

    if (existingReferralUsage) {
      await transaction.rollback();
      return res.status(409).json({ error: 'A referral has already been applied to this account' });
    }

    const referralProgram = normalizeReferralProgram(referral.reward);
    const starterReward = referralProgram.starterReward;
    const inviteeRewardResult = await awardReferralBundle(userId, starterReward, transaction);

    await referral.update(
      {
        referredUserId: userId,
        status: 'completed',
        completedAt: new Date(),
        reward: {
          ...referralProgram,
          qualityState: {
            ...referralProgram.qualityState,
            activationStatus: 'pending',
            evaluatedAt: null
          }
        }
      },
      { transaction }
    );

    await transaction.commit();

    await Promise.allSettled([
      userNotificationService.createNotification(referral.referrerUserId, {
        type: 'referral_reward',
        title: 'Referral invite activated',
        body: 'Your invite joined DatingHub. Your quality bonus will unlock once they become an activated dater.',
        metadata: {
          starterReward,
          qualityBonus: referralProgram.qualityBonus,
          referredUserId: userId
        }
      }),
      userNotificationService.createNotification(userId, {
        type: 'referral_reward',
        title: 'Referral rewards applied',
        body: 'Your signup rewards are now active on your account.',
        metadata: {
          reward: starterReward,
          referrerUserId: referral.referrerUserId
        }
      })
    ]);

    res.status(201).json({
      applied: true,
      reward: starterReward,
      inviter: {
        userId: referral.referrerUserId,
        rewardBalance: serializeRewardBalance(await ensureRewardBalance(referral.referrerUserId)),
        premiumExpiresAt: null,
        pendingQualityBonus: referralProgram.qualityBonus,
        bonusStatus: 'pending_activation'
      },
      invitee: {
        userId,
        rewardBalance: serializeRewardBalance(inviteeRewardResult.rewardBalance),
        premiumExpiresAt: inviteeRewardResult.expiresAt
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Complete referral error:', error);
    res.status(500).json({ error: 'Failed to apply referral rewards' });
  }
});

router.post('/friends/add', async (req, res) => {
  try {
    const userId = req.user?.id;
    const targetUserId = Number(req.body?.targetUserId);

    if (!userId || !targetUserId) {
      return res.status(400).json({ error: 'User IDs required' });
    }

    if (Number(userId) === Number(targetUserId)) {
      return res.status(400).json({ error: 'Cannot friend yourself' });
    }

    const existing = await db.FriendRelationship.findOne({
      where: {
        [Op.or]: [
          { userId1: userId, userId2: targetUserId },
          { userId1: targetUserId, userId2: userId }
        ]
      }
    });

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(400).json({ error: 'Already friends' });
      }

      if (existing.status === 'pending') {
        return res.status(400).json({ error: 'Friend request already sent' });
      }
    }

    const friendship = await db.FriendRelationship.create({
      userId1: userId,
      userId2: targetUserId,
      status: 'pending',
      requestSentBy: userId
    });

    res.status(201).json({
      id: friendship.id,
      friendshipId: friendship.id,
      status: 'pending',
      message: 'Friend request sent'
    });
  } catch (error) {
    console.error('Add friend error:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

router.post('/friends/:friendshipId/accept', async (req, res) => {
  try {
    const userId = req.user?.id;
    const friendshipId = Number(req.params.friendshipId);

    const friendship = await db.FriendRelationship.findByPk(friendshipId);
    if (!friendship) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    if (Number(friendship.userId1) !== Number(userId) && Number(friendship.userId2) !== Number(userId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (friendship.status !== 'pending') {
      return res.status(400).json({ error: 'Can only accept pending requests' });
    }

    await friendship.update({
      status: 'accepted',
      acceptedAt: new Date()
    });

    res.json({ status: 'accepted', message: 'Friend request accepted' });
  } catch (error) {
    console.error('Accept friend error:', error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

router.post('/friends/:friendshipId/decline', async (req, res) => {
  try {
    const userId = req.user?.id;
    const friendshipId = Number(req.params.friendshipId);

    const friendship = await db.FriendRelationship.findByPk(friendshipId);
    if (!friendship) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    if (Number(friendship.userId2) !== Number(userId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await friendship.destroy();
    res.json({ message: 'Friend request declined' });
  } catch (error) {
    console.error('Decline friend error:', error);
    res.status(500).json({ error: 'Failed to decline friend request' });
  }
});

router.get('/friends/list', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const status = String(req.query?.status || 'accepted');
    const direction = String(req.query?.direction || 'all');
    const limit = Math.min(Number(req.query?.limit || 50), MAX_FRIENDS);
    const offset = Math.max(Number(req.query?.offset || 0), 0);

    const friends = await getFriendList(userId, status, direction, limit, offset);

    res.json({
      friends: friends.map((row) => serializeFriendRow(row, userId)),
      count: friends.length
    });
  } catch (error) {
    console.error('Get friends list error:', error);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

router.get('/friends/status/:targetUserId', async (req, res) => {
  try {
    const userId = req.user?.id;
    const targetUserId = Number(req.params.targetUserId);

    if (!userId || !targetUserId) {
      return res.status(400).json({ error: 'User IDs required' });
    }

    if (Number(userId) === Number(targetUserId)) {
      return res.json({ status: 'self', canSendRequest: false });
    }

    const friendship = await db.FriendRelationship.findOne({
      where: {
        [Op.or]: [
          { userId1: userId, userId2: targetUserId },
          { userId1: targetUserId, userId2: userId }
        ]
      }
    });

    if (!friendship) {
      return res.json({ status: 'none', canSendRequest: true });
    }

    if (friendship.status === 'accepted') {
      return res.json({
        status: 'accepted',
        canSendRequest: false,
        friendshipId: friendship.id,
        friendship_id: friendship.id,
        acceptedAt: friendship.acceptedAt,
        accepted_at: friendship.acceptedAt
      });
    }

    const isIncoming = Number(friendship.requestSentBy) !== Number(userId);
    return res.json({
      status: isIncoming ? 'incoming_pending' : 'outgoing_pending',
      canSendRequest: false,
      friendshipId: friendship.id,
      friendship_id: friendship.id,
      requestedAt: friendship.createdAt,
      requested_at: friendship.createdAt,
      isIncoming
    });
  } catch (error) {
    console.error('Get friendship status error:', error);
    res.status(500).json({ error: 'Failed to get friendship status' });
  }
});

router.delete('/friends/:friendshipId', async (req, res) => {
  try {
    const userId = req.user?.id;
    const friendshipId = Number(req.params.friendshipId);

    const friendship = await db.FriendRelationship.findByPk(friendshipId);
    if (!friendship) {
      return res.status(404).json({ error: 'Friendship not found' });
    }

    if (Number(friendship.userId1) !== Number(userId) && Number(friendship.userId2) !== Number(userId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await friendship.destroy();
    res.json({ message: 'Friend removed' });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

router.post('/integrations', async (req, res) => {
  try {
    const userId = req.user?.id;
    const platform = String(req.body?.platform || '').trim().toLowerCase();
    const username = String(req.body?.username || '').trim().replace(/^@+/, '');
    const isPublic = Boolean(req.body?.isPublic);

    if (!userId || !platform || !username) {
      return res.status(400).json({ error: 'Platform and username required' });
    }

    if (!SUPPORTED_SOCIAL_PLATFORMS.includes(platform)) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    const existing = await db.SocialIntegration.findOne({
      where: { userId, platform }
    });

    if (existing) {
      await existing.update({
        username,
        isPublic
      });

      return res.json(
        serializeIntegration({
          ...(existing.get({ plain: true })),
          username,
          isPublic,
          profileUrl: buildPublicProfileUrl(platform, username)
        })
      );
    }

    const integration = await db.SocialIntegration.create({
      userId,
      platform,
      username,
      isPublic
    });

    res.status(201).json(
      serializeIntegration({
        ...integration.get({ plain: true }),
        profileUrl: buildPublicProfileUrl(platform, username)
      })
    );
  } catch (error) {
    console.error('Add social integration error:', error);
    res.status(500).json({ error: 'Failed to add social integration' });
  }
});

router.get('/integrations', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const integrations = await db.SocialIntegration.findAll({
      where: { userId },
      order: [['createdAt', 'ASC']]
    });

    res.json(
      integrations.map((integration) =>
        serializeIntegration({
          ...integration.get({ plain: true }),
          profileUrl: buildPublicProfileUrl(integration.platform, integration.username)
        })
      )
    );
  } catch (error) {
    console.error('Get social integrations error:', error);
    res.status(500).json({ error: 'Failed to fetch social integrations' });
  }
});

router.patch('/integrations/:integrationId', async (req, res) => {
  try {
    const userId = req.user?.id;
    const integrationId = Number(req.params.integrationId);
    const integration = await db.SocialIntegration.findByPk(integrationId);

    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    if (Number(integration.userId) !== Number(userId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updates = {};
    if (req.body?.username !== undefined) {
      const normalizedUsername = String(req.body.username || '').trim().replace(/^@+/, '');
      if (!normalizedUsername) {
        return res.status(400).json({ error: 'Username cannot be empty' });
      }

      updates.username = normalizedUsername;
    }

    if (req.body?.isPublic !== undefined) {
      updates.isPublic = Boolean(req.body.isPublic);
    }

    await integration.update(updates);

    const plain = integration.get({ plain: true });
    res.json(
      serializeIntegration({
        ...plain,
        profileUrl: buildPublicProfileUrl(plain.platform, plain.username)
      })
    );
  } catch (error) {
    console.error('Update social integration error:', err);
    res.status(500).json({ error: 'Failed to update social integration' });
  }
});

router.delete('/integrations/:integrationId', async (req, res) => {
  try {
    const userId = req.user?.id;
    const integrationId = Number(req.params.integrationId);

    const integration = await db.SocialIntegration.findByPk(integrationId);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    if (Number(integration.userId) !== Number(userId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await integration.destroy();
    res.json({ message: 'Social integration removed' });
  } catch (error) {
    console.error('Remove social integration error:', error);
    res.status(500).json({ error: 'Failed to remove integration' });
  }
});

router.get('/integrations/:userId/public', async (req, res) => {
  try {
    const targetUserId = Number(req.params.userId);

    const integrations = await db.SocialIntegration.findAll({
      where: {
        userId: targetUserId,
        isPublic: true
      },
      order: [['createdAt', 'ASC']]
    });

    res.json(
      integrations.map((integration) => {
        const plain = integration.get({ plain: true });
        return serializeIntegration({
          ...plain,
          profileUrl: buildPublicProfileUrl(plain.platform, plain.username)
        });
      })
    );
  } catch (error) {
    console.error('Get public social profiles error:', error);
    res.status(500).json({ error: 'Failed to fetch social profiles' });
  }
});

router.post('/community-rooms/:roomSlug/join', async (req, res) => {
  try {
    const userId = req.user?.id;
    const roomSlug = String(req.params.roomSlug || '').trim().toLowerCase();

    if (!userId || !roomSlug) {
      return res.status(400).json({ error: 'Room slug required' });
    }

    const [profileRow] = await db.sequelize.query(
      `SELECT
         dp.location_city,
         dp.interests,
         dp.relationship_goals,
         dp.voice_intro_url,
         dp.profile_completion_percent,
         dp.profile_verified,
         up.preference_flexibility
       FROM dating_profiles dp
       LEFT JOIN user_preferences up ON up.user_id = dp.user_id
       WHERE dp.user_id = :userId
       LIMIT 1`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT
      }
    );
    const warmUpProfile = normalizeWarmUpProfile(profileRow || {});
    const roomDefinitions = buildCommunityRoomDefinitions(
      warmUpProfile,
      warmUpProfile.preferenceFlexibility
    );
    const targetRoom = roomDefinitions.find((definition) => definition.slug === roomSlug);

    if (!targetRoom) {
      return res.status(404).json({ error: 'Community room not found' });
    }

    const eligibility = buildWarmUpEligibility(warmUpProfile, targetRoom);
    if (!eligibility.canJoin) {
      return res.status(403).json({
        error: 'Finish your dating profile setup before joining this warm-up space',
        blockers: eligibility.blockers
      });
    }

    let chatroom = await db.Chatroom.findOne({
      where: {
        isPublic: false,
        name: targetRoom.name
      }
    });

    if (!chatroom) {
      chatroom = await db.Chatroom.create({
        createdByUserId: userId,
        name: targetRoom.name,
        description: targetRoom.description,
        isPublic: false,
        maxMembers: targetRoom.maxMembers || 40,
        memberCount: 0
      });
    }

    const existingMembership = await db.ChatroomMember.findOne({
      where: {
        chatroomId: chatroom.id,
        userId
      }
    });

    if (!existingMembership) {
      await db.ChatroomMember.create({
        chatroomId: chatroom.id,
        userId
      });

      await chatroom.update({
        memberCount: Number(chatroom.memberCount || 0) + 1
      });
    }

    res.json({
      joined: true,
      chatroomId: chatroom.id,
      chatroom_id: chatroom.id,
      room: {
        slug: targetRoom.slug,
        name: targetRoom.name,
        description: targetRoom.description,
        warmUpPrompt: targetRoom.warmUpPrompt,
        audioPrompt: targetRoom.audioPrompt,
        datingIntentOnly: targetRoom.datingIntentOnly
      },
      eligibility
    });
  } catch (error) {
    console.error('Join community room error:', error);
    res.status(500).json({ error: 'Failed to join community room' });
  }
});

router.post('/group-chats', async (req, res) => {
  try {
    const userId = req.user?.id;
    const name = String(req.body?.name || '').trim();
    const description = String(req.body?.description || '').trim();
    const memberIds = Array.isArray(req.body?.memberIds) ? req.body.memberIds : [];
    const groupType = String(req.body?.groupType || 'custom');
    const matchId = req.body?.matchId || null;

    if (!userId || !name) {
      return res.status(400).json({ error: 'Name required' });
    }

    const groupChat = await db.GroupChat.create({
      name,
      description: description || null,
      createdByUserId: userId,
      groupType,
      matchId
    });

    await db.GroupChatMember.create({
      groupId: groupChat.id,
      userId,
      role: 'admin',
      status: 'active'
    });

    const uniqueMemberIds = [...new Set(memberIds.map((memberId) => Number(memberId)).filter(Boolean))]
      .filter((memberId) => Number(memberId) !== Number(userId));

    if (uniqueMemberIds.length > 0) {
      await db.GroupChatMember.bulkCreate(
        uniqueMemberIds.map((memberId) => ({
          groupId: groupChat.id,
          userId: memberId,
          role: 'member',
          status: 'active'
        })),
        { ignoreDuplicates: true }
      );
    }

    res.status(201).json({
      id: groupChat.id,
      name: groupChat.name,
      description: groupChat.description,
      memberCount: 1 + uniqueMemberIds.length
    });
  } catch (error) {
    console.error('Create group chat error:', error);
    res.status(500).json({ error: 'Failed to create group chat' });
  }
});

router.get('/group-chats', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const groupChats = await db.sequelize.query(
      `SELECT
         gc.id,
         gc.name,
         gc.description,
         gc.group_type,
         gc.created_at,
         COUNT(DISTINCT gcm.user_id)::int AS member_count,
         MAX(CASE WHEN self_member.user_id = :userId THEN self_member.last_read_message_id ELSE NULL END) AS last_read_message_id
       FROM group_chats gc
       JOIN group_chat_members gcm
         ON gc.id = gcm.group_id
        AND gcm.status = 'active'
       JOIN group_chat_members self_member
         ON self_member.group_id = gc.id
        AND self_member.user_id = :userId
        AND self_member.status = 'active'
       GROUP BY gc.id
       ORDER BY gc.updated_at DESC, gc.id DESC`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT
      }
    );

    res.json(groupChats);
  } catch (error) {
    console.error('Get group chats error:', error);
    res.status(500).json({ error: 'Failed to fetch group chats' });
  }
});

router.post('/group-chats/:groupId/messages', async (req, res) => {
  try {
    const userId = req.user?.id;
    const groupId = Number(req.params.groupId);
    const message = String(req.body?.message || '').trim();
    const mediaType = req.body?.mediaType || null;
    const mediaUrl = req.body?.mediaUrl || null;

    if (!userId || !message) {
      return res.status(400).json({ error: 'Message required' });
    }

    const member = await db.GroupChatMember.findOne({
      where: {
        groupId,
        userId,
        status: 'active'
      }
    });

    if (!member) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const groupMessage = await db.GroupChatMessage.create({
      groupId,
      fromUserId: userId,
      message,
      mediaType,
      mediaUrl,
      messageType: mediaType ? 'media' : 'text'
    });

    res.status(201).json({
      id: groupMessage.id,
      message: groupMessage.message,
      mediaType: groupMessage.mediaType,
      createdAt: groupMessage.createdAt
    });
  } catch (error) {
    console.error('Send group message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.get('/group-chats/:groupId/messages', async (req, res) => {
  try {
    const userId = req.user?.id;
    const groupId = Number(req.params.groupId);
    const limit = Math.max(Number(req.query?.limit || 50), 1);
    const offset = Math.max(Number(req.query?.offset || 0), 0);

    const member = await db.GroupChatMember.findOne({
      where: {
        groupId,
        userId,
        status: 'active'
      }
    });

    if (!member) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const messages = await db.GroupChatMessage.findAll({
      where: { groupId },
      include: [{ model: db.User, as: 'sender', attributes: ['id', 'email'] }],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    res.json(messages.reverse());
  } catch (error) {
    console.error('Get group messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.post('/group-chats/:groupId/leave', async (req, res) => {
  try {
    const userId = req.user?.id;
    const groupId = Number(req.params.groupId);

    const member = await db.GroupChatMember.findOne({
      where: {
        groupId,
        userId
      }
    });

    if (!member) {
      return res.status(404).json({ error: 'Not a member' });
    }

    await member.update({
      status: 'left',
      leftAt: new Date()
    });

    res.json({ message: 'Left group chat' });
  } catch (error) {
    console.error('Leave group chat error:', error);
    res.status(500).json({ error: 'Failed to leave group' });
  }
});

module.exports = router;
