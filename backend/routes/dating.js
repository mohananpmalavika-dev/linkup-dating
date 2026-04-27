const express = require('express');
const router = express.Router();
const db = require('../config/database');
const spamFraudService = require('../services/spamFraudService');
const userNotificationService = require('../services/userNotificationService');
const { createModerationFlag } = require('../utils/moderation');

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const MULTIPART_FORM_DATA_PATTERN = /^multipart\/form-data/i;

const normalizeOptionalText = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalizedValue = String(value).trim();
  return normalizedValue ? normalizedValue : null;
};

const getRequestMetadata = (req) => ({
  ipAddress: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || null,
  userAgent: req.headers['user-agent'] || null
});

const countRowValue = (value) => Number.parseInt(value, 10) || 0;
const REPORT_REASON_CONFIG = {
  inappropriate_photos: {
    category: 'content',
    severity: 'high',
    title: 'Reported inappropriate photos'
  },
  fake_profile: {
    category: 'fraud',
    severity: 'high',
    title: 'Reported fake profile'
  },
  suspicious_behavior: {
    category: 'safety',
    severity: 'high',
    title: 'Reported suspicious behavior'
  },
  harassment: {
    category: 'safety',
    severity: 'critical',
    title: 'Reported harassment'
  },
  spam: {
    category: 'spam',
    severity: 'high',
    title: 'Reported spam or scam'
  },
  offensive_content: {
    category: 'content',
    severity: 'medium',
    title: 'Reported offensive content'
  },
  other: {
    category: 'behavior',
    severity: 'medium',
    title: 'User report'
  }
};

const getReportModerationConfig = (reason) =>
  REPORT_REASON_CONFIG[reason] || REPORT_REASON_CONFIG.other;

const hasMeaningfulFilters = (filters = {}) =>
  Object.values(filters).some((value) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (value && typeof value === 'object') {
      return hasMeaningfulFilters(value);
    }

    return value !== undefined && value !== null && String(value).trim() !== '';
  });

const recordSearchHistory = async ({ userId, source = 'search', filters = {}, resultCount = 0 }) => {
  if (!userId || !hasMeaningfulFilters(filters)) {
    return;
  }

  try {
    await db.query(
      `INSERT INTO user_search_history (user_id, source, filters, result_count)
       VALUES ($1, $2, $3, $4)`,
      [userId, source, JSON.stringify(filters), resultCount]
    );
  } catch (error) {
    console.error('Search history record error:', error);
  }
};

const normalizeSearchHistoryRow = (row = {}) => ({
  id: row.id,
  userId: row.user_id,
  source: row.source,
  filters: row.filters || {},
  resultCount: row.result_count || 0,
  createdAt: row.created_at
});

const normalizeInteger = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const normalizeBoolean = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true';
  }

  return Boolean(value);
};

const normalizeHeight = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const normalizedValue = String(value).trim();
  const feetAndInchesMatch = normalizedValue.match(/^(\d+)\s*'\s*(\d{1,2})/);

  if (feetAndInchesMatch) {
    const feet = Number.parseInt(feetAndInchesMatch[1], 10);
    const inches = Number.parseInt(feetAndInchesMatch[2], 10);
    return Math.round((feet * 12 + inches) * 2.54);
  }

  return normalizeInteger(normalizedValue.replace(/[^\d-]/g, ''));
};

const safeJsonParse = (value, fallbackValue = null) => {
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallbackValue;
  }
};

const extractMultipartBoundary = (contentType = '') => {
  const boundaryMatch = String(contentType).match(/boundary=([^;]+)/i);
  return boundaryMatch ? boundaryMatch[1].replace(/^"|"$/g, '') : null;
};

const parseMultipartFormData = async (req) => {
  const boundary = extractMultipartBoundary(req.headers['content-type']);

  if (!boundary) {
    return { fields: {}, files: [] };
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let hasRejected = false;

    req.on('data', (chunk) => {
      if (hasRejected) {
        return;
      }

      totalBytes += chunk.length;
      if (totalBytes > MAX_UPLOAD_BYTES) {
        hasRejected = true;
        reject(new Error('Photo upload payload too large'));
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => {
      if (hasRejected) {
        return;
      }

      try {
        const rawBody = Buffer.concat(chunks).toString('latin1');
        const parts = rawBody
          .split(`--${boundary}`)
          .slice(1, -1)
          .map((part) => (part.startsWith('\r\n') ? part.slice(2) : part))
          .map((part) => (part.endsWith('\r\n') ? part.slice(0, -2) : part))
          .filter(Boolean);
        const fields = {};
        const files = [];

        for (const part of parts) {
          const headerSeparatorIndex = part.indexOf('\r\n\r\n');
          if (headerSeparatorIndex === -1) {
            continue;
          }

          const rawHeaders = part.slice(0, headerSeparatorIndex);
          const rawValue = part.slice(headerSeparatorIndex + 4);
          const dispositionHeader = rawHeaders
            .split('\r\n')
            .find((header) => /^content-disposition:/i.test(header));
          const contentTypeHeader = rawHeaders
            .split('\r\n')
            .find((header) => /^content-type:/i.test(header));

          if (!dispositionHeader) {
            continue;
          }

          const nameMatch = dispositionHeader.match(/name="([^"]+)"/i);
          if (!nameMatch) {
            continue;
          }

          const filenameMatch = dispositionHeader.match(/filename="([^"]*)"/i);
          const fieldName = nameMatch[1];

          if (filenameMatch) {
            files.push({
              fieldName,
              filename: filenameMatch[1],
              contentType: contentTypeHeader
                ? contentTypeHeader.split(':')[1].trim()
                : 'application/octet-stream',
              buffer: Buffer.from(rawValue, 'latin1')
            });
            continue;
          }

          if (fields[fieldName] === undefined) {
            fields[fieldName] = rawValue;
          } else if (Array.isArray(fields[fieldName])) {
            fields[fieldName].push(rawValue);
          } else {
            fields[fieldName] = [fields[fieldName], rawValue];
          }
        }

        resolve({ fields, files });
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
};

const normalizeIncomingPhotos = (rawPhotos = []) => {
  let candidatePhotos = rawPhotos;

  if (typeof candidatePhotos === 'string') {
    candidatePhotos = safeJsonParse(candidatePhotos, [candidatePhotos]);
  }

  if (!Array.isArray(candidatePhotos)) {
    candidatePhotos = [candidatePhotos];
  }

  return candidatePhotos
    .map((photo, index) => {
      if (typeof photo === 'string') {
        const normalizedUrl = normalizeOptionalText(photo);
        return normalizedUrl ? { url: normalizedUrl, position: index } : null;
      }

      if (!photo || typeof photo !== 'object') {
        return null;
      }

      const normalizedUrl = normalizeOptionalText(photo.url || photo.photo_url);
      if (!normalizedUrl) {
        return null;
      }

      const parsedPosition = normalizeInteger(photo.position);
      return {
        url: normalizedUrl,
        position: parsedPosition !== null ? parsedPosition : index
      };
    })
    .filter(Boolean);
};

const convertFileToDataUrl = (file) =>
  `data:${file.contentType || 'application/octet-stream'};base64,${file.buffer.toString('base64')}`;

const collectPhotosFromRequest = async (req) => {
  const jsonPhotos = normalizeIncomingPhotos(req.body?.photos);
  if (jsonPhotos.length > 0) {
    return jsonPhotos;
  }

  const contentType = String(req.headers['content-type'] || '');
  if (!MULTIPART_FORM_DATA_PATTERN.test(contentType)) {
    return [];
  }

  const { fields, files } = await parseMultipartFormData(req);
  const uploadedPhotos = files
    .filter((file) => file.fieldName === 'photos')
    .map((file, index) => ({
      url: convertFileToDataUrl(file),
      position: index
    }));

  if (uploadedPhotos.length > 0) {
    return uploadedPhotos;
  }

  return normalizeIncomingPhotos(fields.photos);
};

const normalizePhotoDetails = (photos) => {
  if (!Array.isArray(photos)) {
    return [];
  }

  return photos
    .map((photo, index) => {
      if (typeof photo === 'string') {
        return {
          id: null,
          url: photo,
          position: index,
          isPrimary: index === 0
        };
      }

      const normalizedUrl = normalizeOptionalText(photo?.photo_url || photo?.url);
      if (!normalizedUrl) {
        return null;
      }

      const parsedPosition = normalizeInteger(photo?.position);
      return {
        id: photo?.id ?? null,
        url: normalizedUrl,
        position: parsedPosition !== null ? parsedPosition : index,
        isPrimary: photo?.is_primary === undefined ? index === 0 : Boolean(photo.is_primary)
      };
    })
    .filter(Boolean)
    .sort((leftPhoto, rightPhoto) => leftPhoto.position - rightPhoto.position);
};

const normalizeInterestList = (interests = []) =>
  (Array.isArray(interests) ? interests : [])
    .map((interest) => String(interest || '').trim())
    .filter(Boolean);

const normalizeStringArray = (values = []) =>
  (Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean);

const COMPATIBILITY_QUESTION_LABELS = {
  weekendStyle: 'weekend style',
  communicationStyle: 'communication style',
  socialEnergy: 'social rhythm',
  planningStyle: 'planning style',
  affectionStyle: 'connection style',
  conflictStyle: 'conflict approach'
};

const COMPATIBILITY_QUESTION_IDS = Object.keys(COMPATIBILITY_QUESTION_LABELS);

const createDefaultDealBreakers = () => ({
  enforceAgeRange: false,
  enforceLocationRadius: false,
  onlyVerifiedProfiles: false,
  enforceRelationshipGoals: false,
  requireSharedInterests: false,
  enforceHeightRange: false,
  enforceBodyType: false,
  requireCompletedProfiles: false
});

const createDefaultPreferenceFlexibility = () => ({
  mode: 'balanced',
  learnFromActivity: true
});

const createDefaultCompatibilityAnswers = () =>
  COMPATIBILITY_QUESTION_IDS.reduce((answers, questionId) => {
    answers[questionId] = '';
    return answers;
  }, {});

const createEmptyLearningSignalGroup = () => ({
  interests: {},
  relationshipGoals: {},
  bodyTypes: {},
  ageBands: {},
  verification: {}
});

const createDefaultLearningProfile = () => ({
  positiveSignals: createEmptyLearningSignalGroup(),
  negativeSignals: createEmptyLearningSignalGroup(),
  totalPositiveActions: 0,
  totalNegativeActions: 0,
  lastInteractionAt: null
});

const toFiniteNumber = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const normalizeSignalKey = (value) => {
  const normalizedValue = normalizeOptionalText(value);
  return normalizedValue ? normalizedValue.toLowerCase() : null;
};

const clampSignalValue = (value) =>
  Math.max(-12, Math.min(12, Math.round(Number(value) * 100) / 100));

const normalizeSignalMap = (value) => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return Object.entries(value).reduce((normalizedMap, [key, rawScore]) => {
    const normalizedKey = normalizeSignalKey(key);
    const numericScore = Number(rawScore);

    if (!normalizedKey || !Number.isFinite(numericScore)) {
      return normalizedMap;
    }

    normalizedMap[normalizedKey] = clampSignalValue(numericScore);
    return normalizedMap;
  }, {});
};

const normalizeLearningSignalGroup = (value) => {
  const source = value && typeof value === 'object' ? value : {};
  const fallback = createEmptyLearningSignalGroup();

  return Object.keys(fallback).reduce((normalizedGroup, key) => {
    normalizedGroup[key] = normalizeSignalMap(source[key]);
    return normalizedGroup;
  }, {});
};

const normalizeDealBreakers = (value) => {
  const fallback = createDefaultDealBreakers();
  const source = value && typeof value === 'object' ? value : {};

  return Object.keys(fallback).reduce((normalizedBreakers, key) => {
    normalizedBreakers[key] = normalizeBoolean(source[key]);
    return normalizedBreakers;
  }, {});
};

const normalizePreferenceFlexibility = (value) => {
  const fallback = createDefaultPreferenceFlexibility();
  const source = value && typeof value === 'object' ? value : {};
  const normalizedMode = normalizeOptionalText(source.mode)?.toLowerCase();

  return {
    mode: ['strict', 'balanced', 'open'].includes(normalizedMode) ? normalizedMode : fallback.mode,
    learnFromActivity:
      source.learnFromActivity === undefined
        ? fallback.learnFromActivity
        : normalizeBoolean(source.learnFromActivity)
  };
};

const normalizeCompatibilityAnswers = (value) => {
  const fallback = createDefaultCompatibilityAnswers();
  const source = value && typeof value === 'object' ? value : {};

  return Object.keys(fallback).reduce((normalizedAnswers, key) => {
    normalizedAnswers[key] = normalizeOptionalText(source[key]) || '';
    return normalizedAnswers;
  }, {});
};

const normalizeLearningProfile = (value) => {
  const fallback = createDefaultLearningProfile();
  const source = value && typeof value === 'object' ? value : {};

  return {
    positiveSignals: normalizeLearningSignalGroup(source.positiveSignals),
    negativeSignals: normalizeLearningSignalGroup(source.negativeSignals),
    totalPositiveActions: Math.max(0, normalizeInteger(source.totalPositiveActions) ?? fallback.totalPositiveActions),
    totalNegativeActions: Math.max(0, normalizeInteger(source.totalNegativeActions) ?? fallback.totalNegativeActions),
    lastInteractionAt: normalizeOptionalText(source.lastInteractionAt)
  };
};

const normalizePreferenceRow = (row) => {
  const source = row && typeof row === 'object' ? row : {};

  return {
    ageRangeMin: normalizeInteger(source.age_range_min ?? source.ageRangeMin) ?? 18,
    ageRangeMax: normalizeInteger(source.age_range_max ?? source.ageRangeMax) ?? 50,
    locationRadius: normalizeInteger(source.location_radius ?? source.locationRadius) ?? 50,
    genderPreferences: normalizeStringArray(source.gender_preferences ?? source.genderPreferences),
    relationshipGoals: normalizeStringArray(source.relationship_goals ?? source.relationshipGoals),
    interests: normalizeInterestList(source.interests),
    heightRangeMin: normalizeInteger(source.height_range_min ?? source.heightRangeMin),
    heightRangeMax: normalizeInteger(source.height_range_max ?? source.heightRangeMax),
    bodyTypes: normalizeStringArray(source.body_types ?? source.bodyTypes),
    showMyProfile:
      source.show_my_profile === undefined && source.showMyProfile === undefined
        ? true
        : normalizeBoolean(source.show_my_profile ?? source.showMyProfile),
    allowMessages:
      source.allow_messages === undefined && source.allowMessages === undefined
        ? true
        : normalizeBoolean(source.allow_messages ?? source.allowMessages),
    notificationsEnabled:
      source.notifications_enabled === undefined && source.notificationsEnabled === undefined
        ? true
        : normalizeBoolean(source.notifications_enabled ?? source.notificationsEnabled),
    dealBreakers: normalizeDealBreakers(source.deal_breakers ?? source.dealBreakers),
    preferenceFlexibility: normalizePreferenceFlexibility(
      source.preference_flexibility ?? source.preferenceFlexibility
    ),
    compatibilityAnswers: normalizeCompatibilityAnswers(
      source.compatibility_answers ?? source.compatibilityAnswers
    ),
    learningProfile: normalizeLearningProfile(source.learning_profile ?? source.learningProfile)
  };
};

const formatPreferenceResponse = (preferenceRow) => {
  const preferences = normalizePreferenceRow(preferenceRow);

  return {
    ageRangeMin: preferences.ageRangeMin,
    ageRangeMax: preferences.ageRangeMax,
    locationRadius: preferences.locationRadius,
    genderPreferences: preferences.genderPreferences,
    relationshipGoals: preferences.relationshipGoals,
    interests: preferences.interests,
    heightRangeMin: preferences.heightRangeMin,
    heightRangeMax: preferences.heightRangeMax,
    bodyTypes: preferences.bodyTypes,
    showMyProfile: preferences.showMyProfile,
    allowMessages: preferences.allowMessages,
    notificationsEnabled: preferences.notificationsEnabled,
    dealBreakers: preferences.dealBreakers,
    preferenceFlexibility: preferences.preferenceFlexibility,
    compatibilityAnswers: preferences.compatibilityAnswers,
    learningProfile: preferences.learningProfile
  };
};

const buildAgeBand = (age) => {
  if (!Number.isFinite(age)) {
    return null;
  }

  const rangeStart = Math.max(18, Math.floor(age / 5) * 5);
  return `${rangeStart}-${rangeStart + 4}`;
};

const applySignalDelta = (signalBucket, key, delta) => {
  const normalizedKey = normalizeSignalKey(key);

  if (!normalizedKey || !Number.isFinite(delta) || delta === 0) {
    return;
  }

  const currentScore = Number(signalBucket[normalizedKey] || 0);
  const nextScore = clampSignalValue(currentScore + delta);

  if (Math.abs(nextScore) < 0.05) {
    delete signalBucket[normalizedKey];
    return;
  }

  signalBucket[normalizedKey] = nextScore;
};

const buildLearningDeltaProfile = (interactionType) => {
  if (interactionType === 'superlike') {
    return {
      interests: 0.9,
      relationshipGoals: 1.45,
      bodyTypes: 1.05,
      ageBands: 0.95,
      verification: 0.35
    };
  }

  if (interactionType === 'pass') {
    return {
      interests: 0.35,
      relationshipGoals: 0.55,
      bodyTypes: 0.45,
      ageBands: 0.4,
      verification: 0.15
    };
  }

  return {
    interests: 0.65,
    relationshipGoals: 1.1,
    bodyTypes: 0.8,
    ageBands: 0.75,
    verification: 0.25
  };
};

const buildUpdatedLearningProfile = (existingLearningProfile, candidateProfile, interactionType) => {
  const learningProfile = normalizeLearningProfile(existingLearningProfile);
  const signalGroup =
    interactionType === 'pass' ? learningProfile.negativeSignals : learningProfile.positiveSignals;
  const deltas = buildLearningDeltaProfile(interactionType);

  normalizeInterestList(candidateProfile?.interests)
    .slice(0, 4)
    .forEach((interest) => applySignalDelta(signalGroup.interests, interest, deltas.interests));

  if (candidateProfile?.relationshipGoals) {
    applySignalDelta(
      signalGroup.relationshipGoals,
      candidateProfile.relationshipGoals,
      deltas.relationshipGoals
    );
  }

  if (candidateProfile?.bodyType) {
    applySignalDelta(signalGroup.bodyTypes, candidateProfile.bodyType, deltas.bodyTypes);
  }

  const ageBand = buildAgeBand(candidateProfile?.age);
  if (ageBand) {
    applySignalDelta(signalGroup.ageBands, ageBand, deltas.ageBands);
  }

  if (candidateProfile?.profileVerified) {
    applySignalDelta(signalGroup.verification, 'verified', deltas.verification);
  }

  if (interactionType === 'pass') {
    learningProfile.totalNegativeActions += 1;
  } else {
    learningProfile.totalPositiveActions += interactionType === 'superlike' ? 2 : 1;
  }

  learningProfile.lastInteractionAt = new Date().toISOString();
  return learningProfile;
};

const persistLearningFeedback = async ({ userId, targetUserId, interactionType }) => {
  if (!userId || !targetUserId || userId === targetUserId) {
    return;
  }

  try {
    const [preferenceResult, targetProfileResult] = await Promise.all([
      db.query(
        `SELECT learning_profile, preference_flexibility
         FROM user_preferences
         WHERE user_id = $1
         LIMIT 1`,
        [userId]
      ),
      db.query(
        `SELECT dp.*
         FROM dating_profiles dp
         WHERE dp.user_id = $1
         LIMIT 1`,
        [targetUserId]
      )
    ]);

    const flexibility = normalizePreferenceFlexibility(
      preferenceResult.rows[0]?.preference_flexibility
    );

    if (!flexibility.learnFromActivity) {
      return;
    }

    const targetProfile = normalizeProfileRow(targetProfileResult.rows[0] || null);
    if (!targetProfile) {
      return;
    }

    const updatedLearningProfile = buildUpdatedLearningProfile(
      preferenceResult.rows[0]?.learning_profile,
      targetProfile,
      interactionType
    );

    await db.query(
      `INSERT INTO user_preferences (user_id, preference_flexibility, learning_profile)
       VALUES ($1, $2::jsonb, $3::jsonb)
       ON CONFLICT (user_id) DO UPDATE
       SET preference_flexibility = COALESCE(user_preferences.preference_flexibility, EXCLUDED.preference_flexibility),
           learning_profile = EXCLUDED.learning_profile,
           updated_at = CURRENT_TIMESTAMP`,
      [userId, JSON.stringify(flexibility), JSON.stringify(updatedLearningProfile)]
    );
  } catch (error) {
    console.error('Preference learning update error:', error);
  }
};

const calculateDistanceKm = (currentLocation = {}, candidateLocation = {}) => {
  const currentLat = toFiniteNumber(currentLocation.lat);
  const currentLng = toFiniteNumber(currentLocation.lng);
  const candidateLat = toFiniteNumber(candidateLocation.lat);
  const candidateLng = toFiniteNumber(candidateLocation.lng);

  if (
    currentLat !== null &&
    currentLng !== null &&
    candidateLat !== null &&
    candidateLng !== null
  ) {
    const toRadians = (degrees) => (degrees * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const deltaLat = toRadians(candidateLat - currentLat);
    const deltaLng = toRadians(candidateLng - currentLng);
    const haversine =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(toRadians(currentLat)) *
        Math.cos(toRadians(candidateLat)) *
        Math.sin(deltaLng / 2) *
        Math.sin(deltaLng / 2);

    return Math.round(earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
  }

  const currentCity = normalizeSignalKey(currentLocation.city);
  const candidateCity = normalizeSignalKey(candidateLocation.city);
  const currentState = normalizeSignalKey(currentLocation.state);
  const candidateState = normalizeSignalKey(candidateLocation.state);
  const currentCountry = normalizeSignalKey(currentLocation.country);
  const candidateCountry = normalizeSignalKey(candidateLocation.country);

  if (
    currentCity &&
    candidateCity &&
    currentState &&
    candidateState &&
    currentCity === candidateCity &&
    currentState === candidateState
  ) {
    return 10;
  }

  if (
    currentState &&
    candidateState &&
    currentCountry &&
    candidateCountry &&
    currentState === candidateState &&
    currentCountry === candidateCountry
  ) {
    return 75;
  }

  if (currentCountry && candidateCountry && currentCountry === candidateCountry) {
    return 250;
  }

  return null;
};

const buildIcebreakerSuggestions = (profile, sharedInterests = []) => {
  const suggestions = [];
  const firstSharedInterest = sharedInterests[0];
  const firstInterest = normalizeInterestList(profile?.interests)[0];

  if (firstSharedInterest) {
    suggestions.push(`I noticed we both like ${firstSharedInterest}. What got you into it?`);
  }

  if (profile?.occupation) {
    suggestions.push(`What's something you genuinely enjoy about working in ${profile.occupation}?`);
  }

  if (profile?.relationshipGoals) {
    suggestions.push(`What does a great ${profile.relationshipGoals} connection look like to you?`);
  }

  if (profile?.location?.city) {
    suggestions.push(`What do you enjoy most about living in ${profile.location.city}?`);
  }

  if (firstInterest && firstInterest !== firstSharedInterest) {
    suggestions.push(`If I wanted to learn more about ${firstInterest}, where should I start?`);
  }

  suggestions.push('What kind of conversation always keeps you interested?');
  suggestions.push('What is something simple that can make your whole day better?');

  return [...new Set(suggestions)].slice(0, 4);
};

const buildCompatibilitySuggestion = ({
  currentProfile,
  currentPreferences,
  candidateProfile,
  candidatePreferences
}) => {
  if (!candidateProfile) {
    return {
      isExcluded: false,
      compatibilityScore: 0,
      compatibilityReasons: [],
      icebreakers: []
    };
  }

  const viewerPreferences = normalizePreferenceRow(currentPreferences);
  const viewerFlexibility = normalizePreferenceFlexibility(
    viewerPreferences.preferenceFlexibility
  );
  const candidatePreferenceSet = normalizePreferenceRow(candidatePreferences);

  if (!currentProfile) {
    return {
      isExcluded: false,
      compatibilityScore: 60,
      compatibilityReasons: ['Complete your profile to unlock smarter match suggestions.'],
      icebreakers: buildIcebreakerSuggestions(candidateProfile)
    };
  }

  const currentInterests = normalizeInterestList(currentProfile.interests);
  const candidateInterests = normalizeInterestList(candidateProfile.interests);
  const currentInterestLookup = new Set(currentInterests.map((interest) => interest.toLowerCase()));
  const sharedInterests = candidateInterests.filter((interest) =>
    currentInterestLookup.has(interest.toLowerCase())
  );

  const preferredInterestLookup = new Set(
    normalizeInterestList(viewerPreferences.interests).map((interest) => interest.toLowerCase())
  );
  const sharedPreferredInterests = candidateInterests.filter((interest) =>
    preferredInterestLookup.has(interest.toLowerCase())
  );
  const candidateAge = Number.isFinite(candidateProfile.age) ? candidateProfile.age : null;
  const candidateHeight = Number.isFinite(candidateProfile.height) ? candidateProfile.height : null;
  const ageMatchesPreference =
    candidateAge === null
      ? null
      : candidateAge >= viewerPreferences.ageRangeMin &&
        candidateAge <= viewerPreferences.ageRangeMax;
  const heightMatchesPreference =
    candidateHeight === null
      ? null
      : (!viewerPreferences.heightRangeMin || candidateHeight >= viewerPreferences.heightRangeMin) &&
        (!viewerPreferences.heightRangeMax || candidateHeight <= viewerPreferences.heightRangeMax);
  const genderMatchesPreference =
    viewerPreferences.genderPreferences.length === 0
      ? null
      : viewerPreferences.genderPreferences.includes(candidateProfile.gender || '');
  const relationshipMatchesPreference =
    viewerPreferences.relationshipGoals.length === 0
      ? null
      : viewerPreferences.relationshipGoals.includes(candidateProfile.relationshipGoals || '');
  const bodyTypeMatchesPreference =
    viewerPreferences.bodyTypes.length === 0
      ? null
      : viewerPreferences.bodyTypes.includes(candidateProfile.bodyType || '');
  const distanceKm = calculateDistanceKm(currentProfile.location, candidateProfile.location);
  const withinRadius =
    distanceKm === null ? null : distanceKm <= Math.max(1, viewerPreferences.locationRadius || 50);
  const strictPreferenceViolations = [];
  const dealBreakerViolations = [];
  const reasonCandidates = [];
  const addReason = (text, weight) => {
    if (!text || !Number.isFinite(weight) || weight <= 0) {
      return;
    }

    reasonCandidates.push({ text, weight });
  };

  if (viewerFlexibility.mode === 'strict') {
    if (ageMatchesPreference === false) {
      strictPreferenceViolations.push('Outside your preferred age range');
    }
    if (genderMatchesPreference === false) {
      strictPreferenceViolations.push('Outside your preferred gender preferences');
    }
    if (relationshipMatchesPreference === false) {
      strictPreferenceViolations.push('Relationship goals do not line up');
    }
    if (withinRadius === false) {
      strictPreferenceViolations.push('Outside your distance radius');
    }
  }

  if (viewerPreferences.dealBreakers.enforceAgeRange && ageMatchesPreference === false) {
    dealBreakerViolations.push('Age range dealbreaker');
  }
  if (viewerPreferences.dealBreakers.enforceLocationRadius && withinRadius === false) {
    dealBreakerViolations.push('Distance dealbreaker');
  }
  if (
    viewerPreferences.dealBreakers.enforceRelationshipGoals &&
    relationshipMatchesPreference === false
  ) {
    dealBreakerViolations.push('Relationship goals dealbreaker');
  }
  if (
    viewerPreferences.dealBreakers.requireSharedInterests &&
    sharedPreferredInterests.length === 0 &&
    sharedInterests.length === 0
  ) {
    dealBreakerViolations.push('Shared interests dealbreaker');
  }
  if (viewerPreferences.dealBreakers.onlyVerifiedProfiles && !candidateProfile.profileVerified) {
    dealBreakerViolations.push('Verified profiles only');
  }
  if (viewerPreferences.dealBreakers.enforceHeightRange && heightMatchesPreference === false) {
    dealBreakerViolations.push('Height range dealbreaker');
  }
  if (viewerPreferences.dealBreakers.enforceBodyType && bodyTypeMatchesPreference === false) {
    dealBreakerViolations.push('Body type dealbreaker');
  }
  if (
    viewerPreferences.dealBreakers.requireCompletedProfiles &&
    (candidateProfile.profileCompletionPercent || 0) < 60
  ) {
    dealBreakerViolations.push('Profile completion dealbreaker');
  }

  if (dealBreakerViolations.length > 0 || strictPreferenceViolations.length > 0) {
    return {
      isExcluded: true,
      compatibilityScore: 0,
      compatibilityReasons: [],
      icebreakers: []
    };
  }

  let score = 42;

  if (sharedInterests.length > 0) {
    const sharedInterestScore = Math.min(16, sharedInterests.length * 6);
    score += sharedInterestScore;
    addReason(`Shared interests: ${sharedInterests.slice(0, 2).join(' and ')}`, sharedInterestScore);
  }

  if (sharedPreferredInterests.length > 0) {
    const preferredInterestScore = Math.min(12, sharedPreferredInterests.length * 4);
    score += preferredInterestScore;
    addReason(
      `Matches your preferred interests: ${sharedPreferredInterests.slice(0, 2).join(' and ')}`,
      preferredInterestScore
    );
  }

  if (relationshipMatchesPreference === true) {
    score += 12;
    addReason(`Fits your relationship goals`, 12);
  } else if (relationshipMatchesPreference === false) {
    score -= viewerFlexibility.mode === 'open' ? 2 : 7;
  } else if (
    currentProfile.relationshipGoals &&
    candidateProfile.relationshipGoals &&
    currentProfile.relationshipGoals === candidateProfile.relationshipGoals
  ) {
    score += 10;
    addReason(`Both of you are looking for ${candidateProfile.relationshipGoals}`, 10);
  }

  if (genderMatchesPreference === true) {
    score += 8;
  } else if (genderMatchesPreference === false) {
    score -= viewerFlexibility.mode === 'open' ? 1 : 5;
  }

  if (ageMatchesPreference === true) {
    score += 10;
    addReason(
      `Within your preferred age range`,
      10
    );
  } else if (ageMatchesPreference === false) {
    score -= viewerFlexibility.mode === 'open' ? 2 : 6;
  }

  if (heightMatchesPreference === true) {
    score += 4;
  } else if (heightMatchesPreference === false) {
    score -= viewerFlexibility.mode === 'strict' ? 4 : 2;
  }

  if (bodyTypeMatchesPreference === true) {
    score += 5;
  } else if (bodyTypeMatchesPreference === false) {
    score -= viewerFlexibility.mode === 'strict' ? 4 : 1;
  }

  if (withinRadius === true) {
    score += 8;
    addReason(
      distanceKm !== null
        ? `Within ${distanceKm} km of you`
        : `Close to your preferred location`,
      8
    );
  } else if (withinRadius === false) {
    score -= viewerFlexibility.mode === 'open' ? 2 : 7;
  }

  const currentCity = currentProfile.location?.city?.toLowerCase?.() || '';
  const candidateCity = candidateProfile.location?.city?.toLowerCase?.() || '';
  const currentState = currentProfile.location?.state?.toLowerCase?.() || '';
  const candidateState = candidateProfile.location?.state?.toLowerCase?.() || '';

  if (currentCity && candidateCity && currentCity === candidateCity) {
    score += 6;
    addReason(`You are both in ${candidateProfile.location.city}`, 6);
  } else if (currentState && candidateState && currentState === candidateState) {
    score += 4;
    addReason(`You are in the same region`, 4);
  }

  if (Number.isFinite(currentProfile.age) && Number.isFinite(candidateProfile.age)) {
    const ageGap = Math.abs(currentProfile.age - candidateProfile.age);

    if (ageGap <= 2) {
      score += 5;
    } else if (ageGap <= 5) {
      score += 3;
    }
  }

  if (candidateProfile.profileVerified) {
    score += 4;
    addReason(`Verified profile`, 4);
  }

  if (candidateProfile.bio) {
    score += 2;
  }

  const currentCompatibilityAnswers = normalizeCompatibilityAnswers(
    viewerPreferences.compatibilityAnswers
  );
  const candidateCompatibilityAnswers = normalizeCompatibilityAnswers(
    candidatePreferenceSet.compatibilityAnswers
  );
  const matchedQuestionIds = COMPATIBILITY_QUESTION_IDS.filter((questionId) => {
    const currentAnswer = currentCompatibilityAnswers[questionId];
    const candidateAnswer = candidateCompatibilityAnswers[questionId];
    return currentAnswer && candidateAnswer && currentAnswer === candidateAnswer;
  });

  if (matchedQuestionIds.length > 0) {
    const compatibilityQuestionScore = Math.min(18, matchedQuestionIds.length * 6);
    score += compatibilityQuestionScore;

    if (matchedQuestionIds.length === 1) {
      addReason(
        `You align on ${COMPATIBILITY_QUESTION_LABELS[matchedQuestionIds[0]]}`,
        compatibilityQuestionScore
      );
    } else {
      addReason(
        `You matched on ${matchedQuestionIds.length} compatibility questions`,
        compatibilityQuestionScore
      );
    }
  }

  const learningProfile = normalizeLearningProfile(viewerPreferences.learningProfile);
  const totalLearningSignals =
    learningProfile.totalPositiveActions + learningProfile.totalNegativeActions;

  if (viewerFlexibility.learnFromActivity && totalLearningSignals >= 2) {
    let learningRawScore = 0;

    candidateInterests.slice(0, 4).forEach((interest) => {
      const signalKey = interest.toLowerCase();
      learningRawScore += Number(learningProfile.positiveSignals.interests[signalKey] || 0);
      learningRawScore -= Number(learningProfile.negativeSignals.interests[signalKey] || 0);
    });

    if (candidateProfile.relationshipGoals) {
      const signalKey = candidateProfile.relationshipGoals.toLowerCase();
      learningRawScore +=
        Number(learningProfile.positiveSignals.relationshipGoals[signalKey] || 0) * 1.3;
      learningRawScore -=
        Number(learningProfile.negativeSignals.relationshipGoals[signalKey] || 0) * 1.1;
    }

    if (candidateProfile.bodyType) {
      const signalKey = candidateProfile.bodyType.toLowerCase();
      learningRawScore += Number(learningProfile.positiveSignals.bodyTypes[signalKey] || 0);
      learningRawScore -= Number(learningProfile.negativeSignals.bodyTypes[signalKey] || 0);
    }

    const ageBand = buildAgeBand(candidateProfile.age);
    if (ageBand) {
      const signalKey = ageBand.toLowerCase();
      learningRawScore += Number(learningProfile.positiveSignals.ageBands[signalKey] || 0) * 1.2;
      learningRawScore -= Number(learningProfile.negativeSignals.ageBands[signalKey] || 0);
    }

    if (candidateProfile.profileVerified) {
      learningRawScore += Number(learningProfile.positiveSignals.verification.verified || 0);
      learningRawScore -= Number(learningProfile.negativeSignals.verification.verified || 0);
    }

    const learningScore = Math.max(-12, Math.min(14, Math.round(learningRawScore * 2)));
    score += learningScore;

    if (learningScore >= 5) {
      addReason(`Aligned with the profiles you engage with most`, learningScore);
    }
  }

  const compatibilityReasons = reasonCandidates
    .sort((leftReason, rightReason) => rightReason.weight - leftReason.weight)
    .map((entry) => entry.text)
    .filter((text, index, list) => list.indexOf(text) === index)
    .slice(0, 4);

  return {
    isExcluded: false,
    compatibilityScore: Math.max(45, Math.min(99, Math.round(score))),
    compatibilityReasons,
    icebreakers: buildIcebreakerSuggestions(candidateProfile, sharedInterests)
  };
};

const normalizeProfileRow = (profileRow) => {
  if (!profileRow) {
    return null;
  }

  const photoDetails = normalizePhotoDetails(profileRow.photos);

  return {
    id: profileRow.id,
    userId: profileRow.user_id,
    username: profileRow.username || null,
    firstName: profileRow.first_name || '',
    age: profileRow.age,
    gender: profileRow.gender || null,
    bio: profileRow.bio || '',
    relationshipGoals: profileRow.relationship_goals || null,
    interests: Array.isArray(profileRow.interests) ? profileRow.interests : [],
    height: profileRow.height,
    occupation: profileRow.occupation || '',
    education: profileRow.education || '',
    bodyType: profileRow.body_type || null,
    ethnicity: profileRow.ethnicity || null,
    religion: profileRow.religion || null,
    smoking: profileRow.smoking || null,
    drinking: profileRow.drinking || null,
    hasKids: Boolean(profileRow.has_kids),
    wantsKids: Boolean(profileRow.wants_kids),
    profileVerified: Boolean(profileRow.profile_verified),
    profileCompletionPercent: profileRow.profile_completion_percent || 0,
    isActive: profileRow.is_active !== false,
    lastActive: profileRow.last_active || null,
    createdAt: profileRow.created_at || null,
    updatedAt: profileRow.updated_at || null,
    verifications: profileRow.verifications || {},
    location: {
      city: profileRow.location_city || '',
      state: profileRow.location_state || '',
      country: profileRow.location_country || '',
      lat: profileRow.location_lat ?? null,
      lng: profileRow.location_lng ?? null
    },
    photos: photoDetails.map((photo) => photo.url),
    photoDetails
  };
};

const normalizeMatchRow = (matchRow) => {
  const matchedProfile = matchRow.matched_user_profile || {};
  const photoDetails = normalizePhotoDetails(matchRow.matched_user_photos);
  const lastMessage = matchRow.last_message
    ? {
        id: matchRow.last_message.id,
        text: matchRow.last_message.text || '',
        fromUserId: matchRow.last_message.from_user_id,
        toUserId: matchRow.last_message.to_user_id,
        createdAt: matchRow.last_message.created_at || null,
        isRead: Boolean(matchRow.last_message.is_read)
      }
    : null;

  return {
    id: matchRow.id,
    matchId: matchRow.id,
    userId: matchRow.matched_user_id,
    firstName: matchedProfile.first_name || '',
    age: matchedProfile.age ?? null,
    bio: matchedProfile.bio || '',
    occupation: matchedProfile.occupation || '',
    education: matchedProfile.education || '',
    relationshipGoals: matchedProfile.relationship_goals || null,
    interests: Array.isArray(matchedProfile.interests) ? matchedProfile.interests : [],
    profileVerified: Boolean(matchedProfile.profile_verified),
    matchedAt: matchRow.matched_at || null,
    createdAt: matchRow.created_at || null,
    lastMessageAt: matchRow.last_message_at || null,
    messageCount: matchRow.message_count || 0,
    unreadCount: Number.parseInt(matchRow.unread_count, 10) || 0,
    status: matchRow.status,
    location: {
      city: matchedProfile.location_city || '',
      state: matchedProfile.location_state || '',
      country: matchedProfile.location_country || ''
    },
    photos: photoDetails.map((photo) => photo.url),
    photoDetails,
    lastMessage
  };
};

// 1. CREATE PROFILE (Signup Step 2 & 3)
router.post('/profiles', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      firstName,
      age,
      gender,
      city,
      state,
      country,
      bio,
      relationshipGoals,
      interests,
      height,
      occupation,
      education,
      bodyType,
      ethnicity,
      religion,
      smoking,
      drinking,
      hasKids,
      wantsKids
    } = req.body;

    const normalizedFirstName = normalizeOptionalText(firstName);
    const normalizedAge = normalizeInteger(age);
    const normalizedGender = normalizeOptionalText(gender);
    const normalizedCity = normalizeOptionalText(city);
    const normalizedState = normalizeOptionalText(state);
    const normalizedCountry = normalizeOptionalText(country);
    const normalizedBio = normalizeOptionalText(bio);
    const normalizedHeight = normalizeHeight(height);
    const normalizedOccupation = normalizeOptionalText(occupation);
    const normalizedEducation = normalizeOptionalText(education);
    const normalizedBodyType = normalizeOptionalText(bodyType);
    const normalizedEthnicity = normalizeOptionalText(ethnicity);
    const normalizedReligion = normalizeOptionalText(religion);
    const normalizedSmoking = normalizeOptionalText(smoking);
    const normalizedDrinking = normalizeOptionalText(drinking);
    const normalizedRelationshipGoals = normalizeOptionalText(relationshipGoals);
    const normalizedInterests = Array.isArray(interests) ? interests.filter(Boolean) : [];

    if (!normalizedFirstName || !normalizedAge || !normalizedGender || !normalizedCity) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const result = await db.query(
      `INSERT INTO dating_profiles (
         user_id, first_name, age, gender, location_city, location_state,
         location_country, bio, relationship_goals, interests, height,
         occupation, education, body_type, ethnicity, religion, smoking,
         drinking, has_kids, wants_kids, profile_completion_percent, last_active
       )
       VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11,
         $12, $13, $14, $15, $16, $17,
         $18, $19, $20, $21, CURRENT_TIMESTAMP
       )
       ON CONFLICT (user_id) DO UPDATE
       SET first_name = EXCLUDED.first_name,
           age = EXCLUDED.age,
           gender = EXCLUDED.gender,
           location_city = EXCLUDED.location_city,
           location_state = EXCLUDED.location_state,
           location_country = EXCLUDED.location_country,
           bio = EXCLUDED.bio,
           relationship_goals = EXCLUDED.relationship_goals,
           interests = EXCLUDED.interests,
           height = EXCLUDED.height,
           occupation = EXCLUDED.occupation,
           education = EXCLUDED.education,
           body_type = EXCLUDED.body_type,
           ethnicity = EXCLUDED.ethnicity,
           religion = EXCLUDED.religion,
           smoking = EXCLUDED.smoking,
           drinking = EXCLUDED.drinking,
           has_kids = EXCLUDED.has_kids,
           wants_kids = EXCLUDED.wants_kids,
           profile_completion_percent = GREATEST(COALESCE(dating_profiles.profile_completion_percent, 0), EXCLUDED.profile_completion_percent),
           updated_at = CURRENT_TIMESTAMP,
           last_active = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        userId, normalizedFirstName, normalizedAge, normalizedGender, normalizedCity, normalizedState,
        normalizedCountry, normalizedBio, normalizedRelationshipGoals, normalizedInterests, normalizedHeight,
        normalizedOccupation, normalizedEducation, normalizedBodyType, normalizedEthnicity, normalizedReligion, normalizedSmoking,
        normalizedDrinking, normalizeBoolean(hasKids), normalizeBoolean(wantsKids), 60
      ]
    );

    res.json({ message: 'Profile created', profile: normalizeProfileRow(result.rows[0]) });
  } catch (err) {
    console.error('Profile creation error:', err);
    res.status(500).json({ error: 'Failed to create profile' });
  }
});

// 2. GET MY PROFILE
router.get('/profiles/me', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      `SELECT dp.*, 
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos WHERE user_id = $1) as photos
       FROM dating_profiles dp
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(normalizeProfileRow(result.rows[0]));
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// 3. GET PROFILE BY ID
router.get('/profiles/:userId', async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { userId } = req.params;
    const result = await db.query(
      `SELECT dp.*, 
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos WHERE user_id = $1) as photos
       FROM dating_profiles dp
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    if (Number(currentUserId) !== Number(userId)) {
      const requestMetadata = getRequestMetadata(req);
      spamFraudService.trackUserActivity({
        userId: currentUserId,
        action: 'profile_view',
        analyticsUpdates: { profiles_viewed: 1 },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        runSpamCheck: true,
        runFraudCheck: true
      });
    }

    res.json(normalizeProfileRow(result.rows[0]));
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// 4. UPDATE PROFILE
router.put('/profiles/me', async (req, res) => {
  try {
    const userId = req.user.id;
    const { bio, interests, relationshipGoals } = req.body;

    const result = await db.query(
      `UPDATE dating_profiles 
       SET bio = COALESCE($1, bio),
           interests = COALESCE($2, interests),
           relationship_goals = COALESCE($3, relationship_goals),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $4
       RETURNING *`,
      [bio, interests, relationshipGoals, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ message: 'Profile updated', profile: normalizeProfileRow(result.rows[0]) });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// 5. UPLOAD PROFILE PHOTOS
router.post('/profiles/me/photos', async (req, res) => {
  try {
    const userId = req.user.id;
    const photos = await collectPhotosFromRequest(req);

    if (!photos.length) {
      return res.status(400).json({ error: 'Photos array required' });
    }

    await db.query(
      `UPDATE photo_moderation_queue
       SET status = 'superseded',
           review_action = 'superseded',
           review_notes = 'Replaced by a newer profile photo upload.',
           reviewed_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
         AND source_type = 'profile_photo'
         AND status IN ('pending', 'approved')`,
      [userId]
    );

    // Delete existing photos
    await db.query('DELETE FROM profile_photos WHERE user_id = $1', [userId]);

    // Insert new photos
    const photoUrls = [];
    const moderationQueue = [];
    for (let i = 0; i < photos.length; i++) {
      const position = photos[i].position !== undefined ? photos[i].position : i;
      const result = await db.query(
        `INSERT INTO profile_photos (user_id, photo_url, position, is_primary)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, photos[i].url, position, i === 0]
      );
      photoUrls.push(result.rows[0]);

      const queueItem = await spamFraudService.queuePhotoForModeration({
        userId,
        photoUrl: photos[i].url,
        profilePhotoId: result.rows[0].id,
        sourceType: 'profile_photo'
      });
      if (queueItem) {
        moderationQueue.push(queueItem);
      }
    }

    // Update profile completion
    await db.query(
      `UPDATE dating_profiles
       SET profile_completion_percent = GREATEST(COALESCE(profile_completion_percent, 0), 80),
           updated_at = CURRENT_TIMESTAMP,
           last_active = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId]
    );

    await spamFraudService.refreshSystemMetrics();

    res.json({
      message: 'Photos uploaded and sent through moderation review',
      photos: normalizePhotoDetails(photoUrls).map((photo) => photo.url),
      photoDetails: normalizePhotoDetails(photoUrls),
      moderation: {
        totalQueued: moderationQueue.length,
        pendingReview: moderationQueue.filter((item) => item.status === 'pending').length,
        autoApproved: moderationQueue.filter((item) => item.status === 'approved').length
      }
    });
  } catch (err) {
    console.error('Photo upload error:', err);
    res.status(500).json({ error: 'Failed to upload photos' });
  }
});

// 6. SEARCH PROFILES
router.post('/search', async (req, res) => {
  try {
    const userId = req.user.id;
    const { ageRange, relationshipGoals, heightRange, interests } = req.body;
    const normalizedInterests = Array.isArray(interests)
      ? interests.map((interest) => normalizeOptionalText(interest)).filter(Boolean)
      : [];

    let query = `
      SELECT dp.*, COUNT(*) OVER() as total_count,
             (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
              FROM profile_photos WHERE user_id = dp.user_id) as photos
      FROM dating_profiles dp
      WHERE dp.user_id != $1
        AND dp.is_active = true
        AND dp.profile_verified = true
    `;

    const params = [userId];
    let paramIndex = 2;

    if (ageRange?.min) {
      query += ` AND dp.age >= $${paramIndex++}`;
      params.push(ageRange.min);
    }
    if (ageRange?.max) {
      query += ` AND dp.age <= $${paramIndex++}`;
      params.push(ageRange.max);
    }
    if (relationshipGoals?.length > 0) {
      query += ` AND dp.relationship_goals = ANY($${paramIndex++})`;
      params.push(relationshipGoals);
    }
    if (heightRange?.min) {
      query += ` AND dp.height >= $${paramIndex++}`;
      params.push(heightRange.min);
    }
    if (heightRange?.max) {
      query += ` AND dp.height <= $${paramIndex++}`;
      params.push(heightRange.max);
    }
    if (normalizedInterests.length > 0) {
      query += ` AND COALESCE(dp.interests, ARRAY[]::text[]) && $${paramIndex++}::text[]`;
      params.push(normalizedInterests);
    }

    query += ' ORDER BY dp.updated_at DESC LIMIT 20';

    const result = await db.query(query, params);
    await recordSearchHistory({
      userId,
      source: 'browse_search',
      filters: {
        ageRange: ageRange || {},
        relationshipGoals: Array.isArray(relationshipGoals) ? relationshipGoals : [],
        heightRange: heightRange || {},
        interests: normalizedInterests
      },
      resultCount: result.rows.length
    });

    res.json({
      profiles: result.rows.map(normalizeProfileRow),
      totalCount: result.rows.length > 0
        ? Number.parseInt(result.rows[0].total_count, 10) || result.rows.length
        : 0
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Helper: build discovery SQL with DB-level filters
const buildDiscoveryQuery = ({
  userId,
  currentLat,
  currentLng,
  radiusKm,
  ageMin,
  ageMax,
  genderPreferences,
  relationshipGoals,
  interests,
  heightRangeMin,
  heightRangeMax,
  bodyTypes,
  excludeShown,
  limit = 100,
  offset = 0
}) => {
  const params = [userId];
  let paramIndex = 2;
  const conditions = [
    'dp.user_id != $1',
    'dp.is_active = true',
    'COALESCE(up.show_my_profile, true) = true'
  ];

  // Exclude already interacted users
  conditions.push(`dp.user_id NOT IN (
    SELECT CASE WHEN from_user_id = $1 THEN to_user_id ELSE from_user_id END
    FROM interactions WHERE from_user_id = $1 OR to_user_id = $1
  )`);

  // Exclude blocked users (both directions)
  conditions.push(`dp.user_id NOT IN (
    SELECT blocked_user_id FROM user_blocks WHERE blocking_user_id = $1
    UNION
    SELECT blocking_user_id FROM user_blocks WHERE blocked_user_id = $1
  )`);

  if (excludeShown) {
    conditions.push(`dp.user_id NOT IN (SELECT shown_user_id FROM discovery_queue_shown WHERE viewer_user_id = $1)`);
  }

  if (Number.isFinite(ageMin)) {
    conditions.push(`dp.age >= $${paramIndex++}`);
    params.push(ageMin);
  }
  if (Number.isFinite(ageMax)) {
    conditions.push(`dp.age <= $${paramIndex++}`);
    params.push(ageMax);
  }

  if (Array.isArray(genderPreferences) && genderPreferences.length > 0) {
    conditions.push(`dp.gender = ANY($${paramIndex++})`);
    params.push(genderPreferences);
  }

  if (Array.isArray(relationshipGoals) && relationshipGoals.length > 0) {
    conditions.push(`dp.relationship_goals = ANY($${paramIndex++})`);
    params.push(relationshipGoals);
  }

  if (Array.isArray(interests) && interests.length > 0) {
    conditions.push(`COALESCE(dp.interests, ARRAY[]::text[]) && $${paramIndex++}::text[]`);
    params.push(interests);
  }

  if (Number.isFinite(heightRangeMin)) {
    conditions.push(`dp.height >= $${paramIndex++}`);
    params.push(heightRangeMin);
  }
  if (Number.isFinite(heightRangeMax)) {
    conditions.push(`dp.height <= $${paramIndex++}`);
    params.push(heightRangeMax);
  }

  if (Array.isArray(bodyTypes) && bodyTypes.length > 0) {
    conditions.push(`dp.body_type = ANY($${paramIndex++})`);
    params.push(bodyTypes);
  }

  // Haversine distance filter
  if (Number.isFinite(currentLat) && Number.isFinite(currentLng) && Number.isFinite(radiusKm) && radiusKm > 0) {
    conditions.push(`(
      6371 * acos(
        LEAST(1, GREATEST(-1,
          cos(radians($${paramIndex})) * cos(radians(dp.location_lat)) *
          cos(radians(dp.location_lng) - radians($${paramIndex + 1})) +
          sin(radians($${paramIndex})) * sin(radians(dp.location_lat))
        ))
      )
    ) <= $${paramIndex + 2}`);
    params.push(currentLat, currentLng, radiusKm);
    paramIndex += 3;
  }

  const whereClause = conditions.join(' AND ');

  return {
    text: `
      SELECT dp.*,
             row_to_json(up) as preferences,
             (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
              FROM profile_photos WHERE user_id = dp.user_id) as photos
      FROM dating_profiles dp
      LEFT JOIN user_preferences up ON up.user_id = dp.user_id
      WHERE ${whereClause}
      ORDER BY dp.updated_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `,
    params: [...params, limit, offset]
  };
};

// 7. GET DISCOVERY PROFILES (For swipe interface) — with DB-level filtering
router.get('/discovery', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = parseInt(req.query.offset, 10) || 0;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' });
    }

    const currentProfileResult = await db.query(
      `SELECT dp.*,
              row_to_json(up) as preferences,
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos WHERE user_id = dp.user_id) as photos
       FROM dating_profiles dp
       LEFT JOIN user_preferences up ON up.user_id = dp.user_id
       WHERE dp.user_id = $1
       LIMIT 1`,
      [userId]
    );
    const currentProfile = normalizeProfileRow(currentProfileResult.rows[0] || null);
    const currentPreferences = normalizePreferenceRow(currentProfileResult.rows[0]?.preferences);

    const discoveryFilters = {
      ageMin: normalizeInteger(req.query.ageMin) ?? currentPreferences.ageRangeMin,
      ageMax: normalizeInteger(req.query.ageMax) ?? currentPreferences.ageRangeMax,
      distance: normalizeInteger(req.query.distance) ?? currentPreferences.locationRadius,
      gender: req.query.gender ? [req.query.gender] : currentPreferences.genderPreferences,
      relationshipGoals: req.query.relationshipGoals ? [req.query.relationshipGoals] : currentPreferences.relationshipGoals,
      interests: req.query.interests ? req.query.interests.split(',').map(s => s.trim()).filter(Boolean) : currentPreferences.interests,
      heightRangeMin: normalizeInteger(req.query.heightRangeMin) ?? currentPreferences.heightRangeMin,
      heightRangeMax: normalizeInteger(req.query.heightRangeMax) ?? currentPreferences.heightRangeMax,
      bodyTypes: req.query.bodyTypes ? req.query.bodyTypes.split(',').map(s => s.trim()).filter(Boolean) : currentPreferences.bodyTypes
    };

    const query = buildDiscoveryQuery({
      userId,
      currentLat: toFiniteNumber(currentProfile?.location?.lat),
      currentLng: toFiniteNumber(currentProfile?.location?.lng),
      radiusKm: discoveryFilters.distance,
      ageMin: discoveryFilters.ageMin,
      ageMax: discoveryFilters.ageMax,
      genderPreferences: discoveryFilters.gender,
      relationshipGoals: discoveryFilters.relationshipGoals,
      interests: discoveryFilters.interests,
      heightRangeMin: discoveryFilters.heightRangeMin,
      heightRangeMax: discoveryFilters.heightRangeMax,
      bodyTypes: discoveryFilters.bodyTypes,
      excludeShown: false,
      limit: 100,
      offset
    });

    const result = await db.query(query.text, query.params);

    const profiles = result.rows
      .map((profileRow) => {
        const normalizedProfile = normalizeProfileRow(profileRow);
        const compatibility = buildCompatibilitySuggestion({
          currentProfile,
          currentPreferences,
          candidateProfile: normalizedProfile,
          candidatePreferences: profileRow.preferences
        });

        if (compatibility.isExcluded) {
          return null;
        }

        return {
          ...normalizedProfile,
          ...compatibility
        };
      })
      .filter(Boolean)
      .sort((leftProfile, rightProfile) => rightProfile.compatibilityScore - leftProfile.compatibilityScore)
      .slice(0, limit);

    const requestMetadata = getRequestMetadata(req);
    spamFraudService.trackUserActivity({
      userId,
      action: 'discovery_feed_view',
      analyticsUpdates: {},
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runSpamCheck: true,
      runFraudCheck: true
    });
    await recordSearchHistory({
      userId,
      source: 'discovery',
      filters: discoveryFilters,
      resultCount: profiles.length
    });

    res.json({ profiles, offset: offset + profiles.length });
  } catch (err) {
    console.error('Discovery error:', err);
    res.status(500).json({ error: 'Failed to get discovery profiles', details: err.message });
  }
});

// 7b. GET SMART DISCOVERY QUEUE (Personalized multi-factor ranking)
router.get('/discovery-queue', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 20);
    const page = parseInt(req.query.page, 10) || 1;
    const offset = (page - 1) * 100;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' });
    }

    const currentProfileResult = await db.query(
      `SELECT dp.*,
              row_to_json(up) as preferences,
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos WHERE user_id = dp.user_id) as photos
       FROM dating_profiles dp
       LEFT JOIN user_preferences up ON up.user_id = dp.user_id
       WHERE dp.user_id = $1
       LIMIT 1`,
      [userId]
    );
    const currentProfile = normalizeProfileRow(currentProfileResult.rows[0] || null);
    const currentPreferences = normalizePreferenceRow(currentProfileResult.rows[0]?.preferences);

    if (!currentProfile) {
      return res.status(404).json({ error: 'Profile not found. Complete your profile first.' });
    }

    const query = buildDiscoveryQuery({
      userId,
      currentLat: toFiniteNumber(currentProfile?.location?.lat),
      currentLng: toFiniteNumber(currentProfile?.location?.lng),
      radiusKm: currentPreferences.locationRadius,
      ageMin: currentPreferences.ageRangeMin,
      ageMax: currentPreferences.ageRangeMax,
      genderPreferences: currentPreferences.genderPreferences,
      relationshipGoals: currentPreferences.relationshipGoals,
      interests: currentPreferences.interests,
      heightRangeMin: currentPreferences.heightRangeMin,
      heightRangeMax: currentPreferences.heightRangeMax,
      bodyTypes: currentPreferences.bodyTypes,
      excludeShown: true,
      limit: 100,
      offset
    });

    const result = await db.query(query.text, query.params);

    const learningProfile = normalizeLearningProfile(currentPreferences.learningProfile);
    const totalLearningSignals = learningProfile.totalPositiveActions + learningProfile.totalNegativeActions;
    const hasLearningData = currentPreferences.preferenceFlexibility?.learnFromActivity && totalLearningSignals >= 2;

    const scoredProfiles = result.rows
      .map((profileRow) => {
        const normalizedProfile = normalizeProfileRow(profileRow);
        const compatibility = buildCompatibilitySuggestion({
          currentProfile,
          currentPreferences,
          candidateProfile: normalizedProfile,
          candidatePreferences: profileRow.preferences
        });

        if (compatibility.isExcluded) {
          return null;
        }

        // Multi-factor scoring (0-100)
        let compatibilityFactor = compatibility.compatibilityScore * 0.40;

        // Behavioral alignment factor (25%)
        let behavioralFactor = 0;
        if (hasLearningData) {
          let behavioralRaw = 0;
          const candidateInterests = normalizeInterestList(normalizedProfile.interests);
          candidateInterests.slice(0, 4).forEach((interest) => {
            const key = interest.toLowerCase();
            behavioralRaw += Number(learningProfile.positiveSignals.interests[key] || 0);
            behavioralRaw -= Number(learningProfile.negativeSignals.interests[key] || 0);
          });
          if (normalizedProfile.relationshipGoals) {
            const key = normalizedProfile.relationshipGoals.toLowerCase();
            behavioralRaw += Number(learningProfile.positiveSignals.relationshipGoals[key] || 0) * 1.3;
            behavioralRaw -= Number(learningProfile.negativeSignals.relationshipGoals[key] || 0) * 1.1;
          }
          if (normalizedProfile.bodyType) {
            const key = normalizedProfile.bodyType.toLowerCase();
            behavioralRaw += Number(learningProfile.positiveSignals.bodyTypes[key] || 0);
            behavioralRaw -= Number(learningProfile.negativeSignals.bodyTypes[key] || 0);
          }
          const ageBand = buildAgeBand(normalizedProfile.age);
          if (ageBand) {
            const key = ageBand.toLowerCase();
            behavioralRaw += Number(learningProfile.positiveSignals.ageBands[key] || 0) * 1.2;
            behavioralRaw -= Number(learningProfile.negativeSignals.ageBands[key] || 0);
          }
          behavioralFactor = Math.max(0, Math.min(25, 12.5 + behavioralRaw * 1.5));
        } else {
          behavioralFactor = 12.5; // neutral baseline
        }

        // Recency / freshness factor (15%)
        let recencyFactor = 7.5; // baseline
        const profileCreated = normalizedProfile.createdAt ? new Date(normalizedProfile.createdAt) : null;
        const daysSinceCreated = profileCreated ? (Date.now() - profileCreated.getTime()) / (1000 * 60 * 60 * 24) : Infinity;
        if (daysSinceCreated <= 3) {
          recencyFactor = 15;
        } else if (daysSinceCreated <= 7) {
          recencyFactor = 12;
        } else if (daysSinceCreated <= 14) {
          recencyFactor = 10;
        } else if (daysSinceCreated <= 30) {
          recencyFactor = 9;
        }

        const lastActive = normalizedProfile.lastActive ? new Date(normalizedProfile.lastActive) : null;
        const hoursSinceActive = lastActive ? (Date.now() - lastActive.getTime()) / (1000 * 60 * 60) : Infinity;
        if (hoursSinceActive <= 24) {
          recencyFactor += 2;
        } else if (hoursSinceActive <= 72) {
          recencyFactor += 1;
        }
        recencyFactor = Math.min(15, recencyFactor);

        // Trending / social proof factor (10%)
        let trendingFactor = 5; // baseline
        // Boost verified profiles slightly within trending
        if (normalizedProfile.profileVerified) {
          trendingFactor += 1.5;
        }
        // Boost completed profiles
        if ((normalizedProfile.profileCompletionPercent || 0) >= 80) {
          trendingFactor += 1.5;
        }
        if ((normalizedProfile.profileCompletionPercent || 0) >= 60) {
          trendingFactor += 1;
        }
        trendingFactor = Math.min(10, trendingFactor);

        // Diversity injection factor (10%) — slightly boost profiles that differ in one dimension
        let diversityFactor = 5;
        const currentGoals = currentProfile.relationshipGoals;
        const candidateGoals = normalizedProfile.relationshipGoals;
        if (currentGoals && candidateGoals && currentGoals !== candidateGoals) {
          diversityFactor += 2;
        }
        const currentInterests = normalizeInterestList(currentProfile.interests);
        const candidateInterests = normalizeInterestList(normalizedProfile.interests);
        const shared = candidateInterests.filter(i => currentInterests.map(ci => ci.toLowerCase()).includes(i.toLowerCase()));
        if (shared.length === 0 && candidateInterests.length > 0 && currentInterests.length > 0) {
          diversityFactor += 2;
        }
        diversityFactor = Math.min(10, diversityFactor);

        const totalScore = Math.round(compatibilityFactor + behavioralFactor + recencyFactor + trendingFactor + diversityFactor);

        return {
          ...normalizedProfile,
          ...compatibility,
          queueScore: totalScore,
          scoreBreakdown: {
            compatibility: Math.round(compatibilityFactor),
            behavioral: Math.round(behavioralFactor),
            recency: Math.round(recencyFactor),
            trending: Math.round(trendingFactor),
            diversity: Math.round(diversityFactor)
          }
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.queueScore - a.queueScore)
      .slice(0, limit);

    // Record shown profiles for deduplication
    if (scoredProfiles.length > 0) {
      const values = scoredProfiles.map((p, i) => `($1, $${i + 2})`).join(', ');
      const shownIds = scoredProfiles.map(p => p.userId);
      await db.query(
        `INSERT INTO discovery_queue_shown (viewer_user_id, shown_user_id)
         VALUES ${values}
         ON CONFLICT (viewer_user_id, shown_user_id) DO UPDATE
         SET shown_at = CURRENT_TIMESTAMP`,
        [userId, ...shownIds]
      );
    }

    const requestMetadata = getRequestMetadata(req);
    spamFraudService.trackUserActivity({
      userId,
      action: 'discovery_queue_view',
      analyticsUpdates: {},
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runSpamCheck: true,
      runFraudCheck: true
    });

    res.json({
      profiles: scoredProfiles,
      page,
      hasMore: scoredProfiles.length === limit
    });
  } catch (err) {
    console.error('Discovery queue error:', err);
    res.status(500).json({ error: 'Failed to get discovery queue', details: err.message });
  }
});

// 7c. GET TRENDING PROFILES
router.get('/trending', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 20);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const result = await db.query(
      `SELECT dp.*,
              row_to_json(up) as preferences,
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos WHERE user_id = dp.user_id) as photos,
              COALESCE(engagement.like_count, 0) as like_count,
              COALESCE(engagement.view_count, 0) as view_count
       FROM dating_profiles dp
       LEFT JOIN user_preferences up ON up.user_id = dp.user_id
       LEFT JOIN LATERAL (
         SELECT
           COUNT(CASE WHEN i.interaction_type IN ('like', 'superlike') THEN 1 END) as like_count,
           COUNT(CASE WHEN i.interaction_type = 'profile_view' THEN 1 END) as view_count
         FROM interactions i
         WHERE i.to_user_id = dp.user_id AND i.created_at >= $2
       ) engagement ON true
       WHERE dp.user_id != $1
         AND dp.is_active = true
         AND dp.user_id NOT IN (
           SELECT CASE WHEN from_user_id = $1 THEN to_user_id ELSE from_user_id END
           FROM interactions WHERE from_user_id = $1 OR to_user_id = $1
         )
         AND dp.user_id NOT IN (
           SELECT blocked_user_id FROM user_blocks WHERE blocking_user_id = $1
           UNION
           SELECT blocking_user_id FROM user_blocks WHERE blocked_user_id = $1
         )
       ORDER BY (COALESCE(engagement.like_count, 0) * 2 + COALESCE(engagement.view_count, 0)) DESC,
                dp.profile_verified DESC,
                dp.profile_completion_percent DESC
       LIMIT $3`,
      [userId, sevenDaysAgo, limit]
    );

    const profiles = result.rows.map((row) => {
      const normalizedProfile = normalizeProfileRow(row);
      return {
        ...normalizedProfile,
        trendingScore: Number(row.like_count) * 2 + Number(row.view_count),
        likeCount: Number(row.like_count),
        viewCount: Number(row.view_count)
      };
    });

    res.json({ profiles, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Trending error:', err);
    res.status(500).json({ error: 'Failed to get trending profiles', details: err.message });
  }
});

// 7d. GET NEW PROFILES
router.get('/new-profiles', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 20);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const result = await db.query(
      `SELECT dp.*,
              row_to_json(up) as preferences,
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos WHERE user_id = dp.user_id) as photos
       FROM dating_profiles dp
       LEFT JOIN user_preferences up ON up.user_id = dp.user_id
       WHERE dp.user_id != $1
         AND dp.is_active = true
         AND dp.created_at >= $2
         AND dp.user_id NOT IN (
           SELECT CASE WHEN from_user_id = $1 THEN to_user_id ELSE from_user_id END
           FROM interactions WHERE from_user_id = $1 OR to_user_id = $1
         )
         AND dp.user_id NOT IN (
           SELECT blocked_user_id FROM user_blocks WHERE blocking_user_id = $1
           UNION
           SELECT blocking_user_id FROM user_blocks WHERE blocked_user_id = $1
         )
       ORDER BY dp.created_at DESC, dp.last_active DESC NULLS LAST
       LIMIT $3`,
      [userId, fourteenDaysAgo, limit]
    );

    const profiles = result.rows.map((row) => normalizeProfileRow(row));

    res.json({ profiles, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('New profiles error:', err);
    res.status(500).json({ error: 'Failed to get new profiles', details: err.message });
  }
});

// 8. LIKE PROFILE
router.post('/interactions/like', async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const { toUserId, targetUserId } = req.body;
    const userId = toUserId || targetUserId;
    const requestMetadata = getRequestMetadata(req);

    if (!userId) {
      return res.status(400).json({ error: 'toUserId or targetUserId required' });
    }

    // Record the like
    const likeInsertResult = await db.query(
      `INSERT INTO interactions (from_user_id, to_user_id, interaction_type)
       VALUES ($1, $2, 'like')
       ON CONFLICT (from_user_id, to_user_id, interaction_type) DO NOTHING
       RETURNING id`,
      [fromUserId, userId]
    );
    if (likeInsertResult.rowCount > 0) {
      await persistLearningFeedback({
        userId: fromUserId,
        targetUserId: userId,
        interactionType: 'like'
      });
    }

    spamFraudService.trackUserActivity({
      userId: fromUserId,
      action: 'like_profile',
      analyticsUpdates: { likes_sent: 1 },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runSpamCheck: true,
      runFraudCheck: true
    });

    // Check if mutual like exists
    const mutualResult = await db.query(
      `SELECT * FROM interactions 
       WHERE from_user_id = $1 AND to_user_id = $2 AND interaction_type = 'like'`,
      [userId, fromUserId]
    );

    if (mutualResult.rows.length > 0) {
      // Create match
      const matchResult = await db.query(
        `INSERT INTO matches (user_id_1, user_id_2)
         VALUES (LEAST($1, $2), GREATEST($1, $2))
         ON CONFLICT DO NOTHING
         RETURNING *`,
        [fromUserId, userId]
      );
      const persistedMatch = matchResult.rows[0] || (
        await db.query(
          `SELECT *
           FROM matches
           WHERE user_id_1 = LEAST($1, $2)
             AND user_id_2 = GREATEST($1, $2)
           LIMIT 1`,
          [fromUserId, userId]
        )
      ).rows[0];

      if (typeof req.emitToUser === 'function') {
        const participantIds = [fromUserId, userId];

        participantIds.forEach((participantId) => {
          req.emitToUser(participantId, 'new_match', {
            match: persistedMatch,
            user: { id: fromUserId },
            matchedUserId: participantId === fromUserId ? userId : fromUserId,
            createdAt: new Date().toISOString()
          });
        });
      }

      await Promise.all([
        userNotificationService.createNotification(fromUserId, {
          type: 'new_match',
          title: 'You have a new match',
          body: 'Someone liked you back. Open the chat to say hello.',
          metadata: {
            matchId: persistedMatch.id,
            matchedUserId: userId
          }
        }),
        userNotificationService.createNotification(userId, {
          type: 'new_match',
          title: 'It is a match',
          body: 'You matched with someone new. Start the conversation when you are ready.',
          metadata: {
            matchId: persistedMatch.id,
            matchedUserId: fromUserId
          }
        })
      ]);

      spamFraudService.updateUserAnalytics(fromUserId, { matches_made: 1 });
      spamFraudService.updateUserAnalytics(userId, { matches_made: 1 });
      spamFraudService.refreshSystemMetrics();

      return res.json({
        message: 'Its a match!',
        isMatch: true,
        match: persistedMatch
      });
    }

    res.json({ message: 'Profile liked', isMatch: false });
  } catch (err) {
    console.error('Like error:', err);
    res.status(500).json({ error: 'Failed to like profile' });
  }
});

// 9. PASS PROFILE
router.post('/interactions/pass', async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const { toUserId, targetUserId } = req.body;
    const userId = toUserId || targetUserId;

    if (!userId) {
      return res.status(400).json({ error: 'toUserId or targetUserId required' });
    }

    const passInsertResult = await db.query(
      `INSERT INTO interactions (from_user_id, to_user_id, interaction_type)
       VALUES ($1, $2, 'pass')
       ON CONFLICT (from_user_id, to_user_id, interaction_type) DO NOTHING
       RETURNING id`,
      [fromUserId, userId]
    );
    if (passInsertResult.rowCount > 0) {
      await persistLearningFeedback({
        userId: fromUserId,
        targetUserId: userId,
        interactionType: 'pass'
      });
    }

    res.json({ message: 'Profile passed' });
  } catch (err) {
    console.error('Pass error:', err);
    res.status(500).json({ error: 'Failed to pass profile' });
  }
});

// 10. GET MATCHES
router.get('/matches', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Number.parseInt(req.query.limit, 10) || 20;
    const page = Number.parseInt(req.query.page, 10) || 1;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT m.*,
              CASE WHEN m.user_id_1 = $1 THEN m.user_id_2 ELSE m.user_id_1 END as matched_user_id,
              (SELECT json_build_object(
                  'first_name', first_name,
                  'age', age,
                  'bio', bio,
                  'occupation', occupation,
                  'education', education,
                  'relationship_goals', relationship_goals,
                  'interests', interests,
                  'location_city', location_city,
                  'location_state', location_state,
                  'location_country', location_country,
                  'profile_verified', profile_verified
                )
               FROM dating_profiles 
               WHERE user_id = CASE WHEN m.user_id_1 = $1 THEN m.user_id_2 ELSE m.user_id_1 END) as matched_user_profile,
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos
               WHERE user_id = CASE WHEN m.user_id_1 = $1 THEN m.user_id_2 ELSE m.user_id_1 END) as matched_user_photos,
              (SELECT json_build_object(
                  'id', id,
                  'text', message,
                  'from_user_id', from_user_id,
                  'to_user_id', to_user_id,
                  'created_at', created_at,
                  'is_read', is_read
                )
               FROM messages
               WHERE match_id = m.id
               ORDER BY created_at DESC
               LIMIT 1) as last_message,
              (SELECT COUNT(*)
               FROM messages
               WHERE match_id = m.id
                 AND to_user_id = $1
                 AND is_read = false) as unread_count
       FROM matches m
       WHERE (m.user_id_1 = $1 OR m.user_id_2 = $1) AND m.status = 'active'
       ORDER BY m.matched_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({ matches: result.rows.map(normalizeMatchRow) });
  } catch (err) {
    console.error('Get matches error:', err);
    res.status(500).json({ error: 'Failed to get matches' });
  }
});

// 11. CHECK MATCH
router.get('/matches/by-id/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `SELECT m.*,
              CASE WHEN m.user_id_1 = $1 THEN m.user_id_2 ELSE m.user_id_1 END as matched_user_id,
              (SELECT json_build_object(
                  'first_name', first_name,
                  'age', age,
                  'bio', bio,
                  'occupation', occupation,
                  'education', education,
                  'relationship_goals', relationship_goals,
                  'interests', interests,
                  'location_city', location_city,
                  'location_state', location_state,
                  'location_country', location_country,
                  'profile_verified', profile_verified
                )
               FROM dating_profiles
               WHERE user_id = CASE WHEN m.user_id_1 = $1 THEN m.user_id_2 ELSE m.user_id_1 END) as matched_user_profile,
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos
               WHERE user_id = CASE WHEN m.user_id_1 = $1 THEN m.user_id_2 ELSE m.user_id_1 END) as matched_user_photos,
              (SELECT json_build_object(
                  'id', id,
                  'text', message,
                  'from_user_id', from_user_id,
                  'to_user_id', to_user_id,
                  'created_at', created_at,
                  'is_read', is_read
                )
               FROM messages
               WHERE match_id = m.id
               ORDER BY created_at DESC
               LIMIT 1) as last_message,
              (SELECT COUNT(*)
               FROM messages
               WHERE match_id = m.id
                 AND to_user_id = $1
                 AND is_read = false) as unread_count
       FROM matches m
       WHERE m.id = $2
         AND (m.user_id_1 = $1 OR m.user_id_2 = $1)
         AND m.status = 'active'
       LIMIT 1`,
      [userId, matchId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json({ match: normalizeMatchRow(result.rows[0]) });
  } catch (err) {
    console.error('Get match by id error:', err);
    res.status(500).json({ error: 'Failed to fetch match' });
  }
});

router.get('/matches/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    const result = await db.query(
      `SELECT * FROM matches 
       WHERE (user_id_1 = $1 AND user_id_2 = $2) 
          OR (user_id_1 = $2 AND user_id_2 = $1)`,
      [currentUserId, userId]
    );

    if (result.rows.length === 0) {
      return res.json({ isMatched: false });
    }

    res.json({ isMatched: true, match: result.rows[0] });
  } catch (err) {
    console.error('Check match error:', err);
    res.status(500).json({ error: 'Failed to check match' });
  }
});

// 12. UNMATCH
router.delete('/matches/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `UPDATE matches 
       SET status = 'unmatched'
       WHERE id = $1 AND (user_id_1 = $2 OR user_id_2 = $2)
       RETURNING *`,
      [matchId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json({ message: 'Unmatched successfully' });
  } catch (err) {
    console.error('Unmatch error:', err);
    res.status(500).json({ error: 'Failed to unmatch' });
  }
});

// 12b. UNMATCH - POST variant (for frontend compatibility)
router.post('/matches/:matchId/unmatch', async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `UPDATE matches 
       SET status = 'unmatched'
       WHERE id = $1 AND (user_id_1 = $2 OR user_id_2 = $2)
       RETURNING *`,
      [matchId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json({ message: 'Unmatched successfully' });
  } catch (err) {
    console.error('Unmatch error:', err);
    res.status(500).json({ error: 'Failed to unmatch' });
  }
});

// 13. GET LIKES RECEIVED
router.get('/interactions/likes', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = req.query.limit || 20;
    const page = req.query.page || 1;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT i.*, dp.first_name, dp.age, dp.location_city,
              (SELECT photo_url FROM profile_photos WHERE user_id = i.from_user_id LIMIT 1) as photo_url
       FROM interactions i
       JOIN dating_profiles dp ON i.from_user_id = dp.user_id
       WHERE i.to_user_id = $1 AND i.interaction_type = 'like'
       ORDER BY i.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get likes error:', err);
    res.status(500).json({ error: 'Failed to get likes' });
  }
});

// 13b. ALIAS - GET LIKES RECEIVED (alternate endpoint)
router.get('/likes-received', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = req.query.limit || 20;
    const page = req.query.page || 1;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT i.*, dp.first_name, dp.age, dp.location_city,
              (SELECT photo_url FROM profile_photos WHERE user_id = i.from_user_id LIMIT 1) as photo_url
       FROM interactions i
       JOIN dating_profiles dp ON i.from_user_id = dp.user_id
       WHERE i.to_user_id = $1 AND i.interaction_type = 'like'
       ORDER BY i.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get likes error:', err);
    res.status(500).json({ error: 'Failed to get likes' });
  }
});

// 14. GET INTERACTION HISTORY
router.get('/interactions/history', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = req.query.limit || 100;

    const result = await db.query(
      `SELECT * FROM interactions 
       WHERE from_user_id = $1 OR to_user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ error: 'Failed to get interaction history' });
  }
});

// 14b. ALIAS - GET INTERACTION HISTORY (alternate endpoint)
router.get('/interaction-history', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = req.query.limit || 100;

    const result = await db.query(
      `SELECT * FROM interactions 
       WHERE from_user_id = $1 OR to_user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ error: 'Failed to get interaction history' });
  }
});

// 15. VERIFY IDENTITY
const verifyIdentityHandler = async (req, res) => {
  try {
    const userId = req.user.id;
    let verificationType = req.body?.verificationType;

    if (!verificationType && MULTIPART_FORM_DATA_PATTERN.test(String(req.headers['content-type'] || ''))) {
      const { fields } = await parseMultipartFormData(req);
      verificationType = fields.verificationType;
    }

    if (!verificationType) {
      return res.status(400).json({ error: 'Verification type required' });
    }

    // In production, integrate with third-party verification service
    const result = await db.query(
      `UPDATE dating_profiles 
       SET verifications = jsonb_set(verifications, $1, $2),
           profile_verified = true,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $3
       RETURNING *`,
      [
        `{${verificationType}}`,
        JSON.stringify({ status: 'verified', verifiedAt: new Date() }),
        userId
      ]
    );

    await userNotificationService.createNotification(userId, {
      type: 'verification_complete',
      title: 'Verification updated',
      body: `${verificationType} verification has been added to your profile.`,
      metadata: {
        verificationType,
        profileVerified: true
      }
    });

    res.json({ message: 'Profile verified', profile: normalizeProfileRow(result.rows[0]) });
  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
};

router.post('/profiles/verify', verifyIdentityHandler);
router.post('/profiles/me/verify', verifyIdentityHandler);

// 16. GET PROFILE COMPLETION STATUS
router.get('/profiles/me/completion', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT profile_completion_percent, first_name, age, gender, location_city, bio, interests,
              (SELECT COUNT(*) FROM profile_photos WHERE user_id = $1) as photo_count
       FROM dating_profiles WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({
      profileCompletionPercent: result.rows[0].profile_completion_percent || 0,
      firstName: result.rows[0].first_name || '',
      age: result.rows[0].age,
      gender: result.rows[0].gender || null,
      bio: result.rows[0].bio || '',
      interests: Array.isArray(result.rows[0].interests) ? result.rows[0].interests : [],
      photoCount: Number.parseInt(result.rows[0].photo_count, 10) || 0,
      location: {
        city: result.rows[0].location_city || ''
      }
    });
  } catch (err) {
    console.error('Completion check error:', err);
    res.status(500).json({ error: 'Failed to get completion status' });
  }
});

// 17. FAVORITE A PROFILE
router.post('/favorites', async (req, res) => {
  try {
    const userId = req.user.id;
    const favoriteUserId = normalizeInteger(req.body.favoriteUserId || req.body.userId);

    if (!favoriteUserId) {
      return res.status(400).json({ error: 'Favorite user ID is required' });
    }

    if (Number(userId) === Number(favoriteUserId)) {
      return res.status(400).json({ error: 'You cannot favorite your own profile' });
    }

    const userExists = await db.query('SELECT id FROM users WHERE id = $1 LIMIT 1', [favoriteUserId]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await db.query(
      `INSERT INTO favorite_profiles (user_id, favorite_user_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, favorite_user_id) DO NOTHING`,
      [userId, favoriteUserId]
    );

    res.json({ success: true, message: 'Profile saved to favorites' });
  } catch (err) {
    console.error('Favorite profile error:', err);
    res.status(500).json({ error: 'Failed to save favorite profile' });
  }
});

// 18. GET FAVORITE PROFILES
router.get('/favorites', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT fp.created_at as favorited_at,
              dp.*,
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos
               WHERE user_id = dp.user_id) as photos
       FROM favorite_profiles fp
       INNER JOIN dating_profiles dp ON dp.user_id = fp.favorite_user_id
       WHERE fp.user_id = $1
       ORDER BY fp.created_at DESC`,
      [userId]
    );

    res.json({
      favorites: result.rows.map((row) => ({
        ...normalizeProfileRow(row),
        favoritedAt: row.favorited_at
      }))
    });
  } catch (err) {
    console.error('Get favorites error:', err);
    res.status(500).json({ error: 'Failed to fetch favorite profiles' });
  }
});

// 19. REMOVE FAVORITE PROFILE
router.delete('/favorites/:favoriteUserId', async (req, res) => {
  try {
    const userId = req.user.id;
    const favoriteUserId = normalizeInteger(req.params.favoriteUserId);

    await db.query(
      `DELETE FROM favorite_profiles
       WHERE user_id = $1 AND favorite_user_id = $2`,
      [userId, favoriteUserId]
    );

    res.json({ success: true, message: 'Favorite removed' });
  } catch (err) {
    console.error('Remove favorite error:', err);
    res.status(500).json({ error: 'Failed to remove favorite profile' });
  }
});

// 20. GET SEARCH HISTORY
router.get('/search-history', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(normalizeInteger(req.query.limit) || 20, 100);

    const result = await db.query(
      `SELECT *
       FROM user_search_history
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    res.json({
      history: result.rows.map(normalizeSearchHistoryRow)
    });
  } catch (err) {
    console.error('Get search history error:', err);
    res.status(500).json({ error: 'Failed to fetch search history' });
  }
});

// 21. CLEAR SEARCH HISTORY
router.delete('/search-history', async (req, res) => {
  try {
    const userId = req.user.id;

    await db.query(
      `DELETE FROM user_search_history
       WHERE user_id = $1`,
      [userId]
    );

    res.json({ success: true, message: 'Search history cleared' });
  } catch (err) {
    console.error('Clear search history error:', err);
    res.status(500).json({ error: 'Failed to clear search history' });
  }
});

// 22. GET USER NOTIFICATIONS
router.get('/notifications', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(normalizeInteger(req.query.limit) || 25, 100);
    const notifications = await userNotificationService.getNotificationsForUser(userId, { limit });
    const unreadCount = await userNotificationService.getUnreadCount(userId);

    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// 23. GET UNREAD NOTIFICATION COUNT
router.get('/notifications/unread-count', async (req, res) => {
  try {
    const unreadCount = await userNotificationService.getUnreadCount(req.user.id);
    res.json({ unreadCount });
  } catch (err) {
    console.error('Get unread notification count error:', err);
    res.status(500).json({ error: 'Failed to fetch unread notification count' });
  }
});

// 24. MARK NOTIFICATION AS READ
router.post('/notifications/:notificationId/read', async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = normalizeInteger(req.params.notificationId);
    const notification = await userNotificationService.markAsRead(userId, notificationId);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true, notification });
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// 25. MARK ALL NOTIFICATIONS AS READ
router.post('/notifications/read-all', async (req, res) => {
  try {
    await userNotificationService.markAllAsRead(req.user.id);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark all notifications read error:', err);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// 26. BLOCK A USER
router.post('/blocks', async (req, res) => {
  try {
    const userId = req.user.id;
    const { blockedUserId } = req.body;

    if (!blockedUserId) {
      return res.status(400).json({ error: 'Blocked user ID is required' });
    }

    if (userId === blockedUserId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    // Check if user exists
    const userExists = await db.query('SELECT id FROM users WHERE id = $1', [blockedUserId]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Insert block
    await db.query(
      `INSERT INTO user_blocks (blocking_user_id, blocked_user_id) 
       VALUES ($1, $2) 
       ON CONFLICT DO NOTHING`,
      [userId, blockedUserId]
    );

    res.json({ success: true, message: 'User blocked successfully' });
  } catch (err) {
    console.error('Block user error:', err);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// 18. GET MY BLOCKED USERS
router.get('/blocks', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT ub.id, ub.blocked_user_id, dp.first_name, dp.age, 
              dp.location_city, dp.location_state,
              (SELECT photo_url FROM profile_photos WHERE user_id = ub.blocked_user_id LIMIT 1) as photo_url,
              ub.created_at
       FROM user_blocks ub
       JOIN users u ON ub.blocked_user_id = u.id
       JOIN dating_profiles dp ON dp.user_id = u.id
       WHERE ub.blocking_user_id = $1
       ORDER BY ub.created_at DESC`,
      [userId]
    );

    res.json({
      blockedUsers: result.rows.map(row => ({
        id: row.blocked_user_id,
        firstName: row.first_name,
        age: row.age,
        location: {
          city: row.location_city,
          state: row.location_state
        },
        photoUrl: row.photo_url,
        blockedAt: row.created_at
      }))
    });
  } catch (err) {
    console.error('Get blocked users error:', err);
    res.status(500).json({ error: 'Failed to get blocked users' });
  }
});

// 19. UNBLOCK A USER
router.delete('/blocks/:blockedUserId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { blockedUserId } = req.params;

    await db.query(
      `DELETE FROM user_blocks 
       WHERE blocking_user_id = $1 AND blocked_user_id = $2`,
      [userId, parseInt(blockedUserId, 10)]
    );

    res.json({ success: true, message: 'User unblocked successfully' });
  } catch (err) {
    console.error('Unblock user error:', err);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// 20. REPORT A USER
router.post('/reports', async (req, res) => {
  try {
    const userId = req.user.id;
    const { reportedUserId, reason, description } = req.body;
    const requestMetadata = getRequestMetadata(req);

    if (!reportedUserId || !reason) {
      return res.status(400).json({ error: 'Reported user ID and reason are required' });
    }

    if (userId === reportedUserId) {
      return res.status(400).json({ error: 'Cannot report yourself' });
    }

    // Check if user exists
    const userExists = await db.query('SELECT id FROM users WHERE id = $1', [reportedUserId]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Insert report
    const result = await db.query(
      `INSERT INTO user_reports (reporting_user_id, reported_user_id, reason, description) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, created_at`,
      [userId, reportedUserId, reason, description || null]
    );

    const moderationConfig = getReportModerationConfig(reason);
    await createModerationFlag({
      userId: reportedUserId,
      sourceType: 'user_report',
      flagCategory: moderationConfig.category,
      severity: moderationConfig.severity,
      title: moderationConfig.title,
      reason: description || `Report reason: ${reason}`,
      metadata: {
        reportId: result.rows[0].id,
        reportedReason: reason,
        reportingUserId: userId
      }
    });

    spamFraudService.trackUserActivity({
      userId,
      action: 'report_submitted',
      analyticsUpdates: {},
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runFraudCheck: false
    });
    spamFraudService.checkForFraud(reportedUserId);
    spamFraudService.refreshSystemMetrics();

    res.json({ 
      success: true, 
      message: 'Report submitted successfully',
      reportId: result.rows[0].id,
      createdAt: result.rows[0].created_at
    });
  } catch (err) {
    console.error('Report user error:', err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// 27. GET USER PREFERENCES
router.get('/preferences', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT * FROM user_preferences WHERE user_id = $1`,
      [userId]
    );

    res.json(formatPreferenceResponse(result.rows[0] || null));
  } catch (err) {
    console.error('Get preferences error:', err);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

// 28. UPDATE USER PREFERENCES
router.put('/preferences', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      ageRangeMin,
      ageRangeMax,
      locationRadius,
      genderPreferences,
      relationshipGoals,
      interests,
      heightRangeMin,
      heightRangeMax,
      bodyTypes,
      showMyProfile,
      allowMessages,
      notificationsEnabled,
      dealBreakers,
      preferenceFlexibility,
      compatibilityAnswers,
      learningProfile
    } = req.body;
    const hasOwnField = (fieldName) => Object.prototype.hasOwnProperty.call(req.body || {}, fieldName);

    const existingPreferenceResult = await db.query(
      `SELECT *
       FROM user_preferences
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );
    const existingPreferences = normalizePreferenceRow(existingPreferenceResult.rows[0] || null);
    const nextPreferences = {
      ageRangeMin: hasOwnField('ageRangeMin')
        ? normalizeInteger(ageRangeMin) ?? 18
        : existingPreferences.ageRangeMin,
      ageRangeMax: hasOwnField('ageRangeMax')
        ? normalizeInteger(ageRangeMax) ?? 50
        : existingPreferences.ageRangeMax,
      locationRadius: hasOwnField('locationRadius')
        ? normalizeInteger(locationRadius) ?? 50
        : existingPreferences.locationRadius,
      genderPreferences: hasOwnField('genderPreferences')
        ? normalizeStringArray(genderPreferences)
        : existingPreferences.genderPreferences,
      relationshipGoals: hasOwnField('relationshipGoals')
        ? normalizeStringArray(relationshipGoals)
        : existingPreferences.relationshipGoals,
      interests: hasOwnField('interests')
        ? normalizeInterestList(interests)
        : existingPreferences.interests,
      heightRangeMin: hasOwnField('heightRangeMin')
        ? normalizeInteger(heightRangeMin)
        : existingPreferences.heightRangeMin,
      heightRangeMax: hasOwnField('heightRangeMax')
        ? normalizeInteger(heightRangeMax)
        : existingPreferences.heightRangeMax,
      bodyTypes: hasOwnField('bodyTypes')
        ? normalizeStringArray(bodyTypes)
        : existingPreferences.bodyTypes,
      showMyProfile: hasOwnField('showMyProfile')
        ? normalizeBoolean(showMyProfile)
        : existingPreferences.showMyProfile,
      allowMessages: hasOwnField('allowMessages')
        ? normalizeBoolean(allowMessages)
        : existingPreferences.allowMessages,
      notificationsEnabled: hasOwnField('notificationsEnabled')
        ? normalizeBoolean(notificationsEnabled)
        : existingPreferences.notificationsEnabled,
      dealBreakers: hasOwnField('dealBreakers')
        ? normalizeDealBreakers(dealBreakers)
        : existingPreferences.dealBreakers,
      preferenceFlexibility: hasOwnField('preferenceFlexibility')
        ? normalizePreferenceFlexibility(preferenceFlexibility)
        : existingPreferences.preferenceFlexibility,
      compatibilityAnswers: hasOwnField('compatibilityAnswers')
        ? normalizeCompatibilityAnswers(compatibilityAnswers)
        : existingPreferences.compatibilityAnswers,
      learningProfile: hasOwnField('learningProfile')
        ? normalizeLearningProfile(learningProfile)
        : existingPreferences.learningProfile
    };

    const result = await db.query(
      `INSERT INTO user_preferences (
         user_id, age_range_min, age_range_max, location_radius,
         gender_preferences, relationship_goals, interests,
         height_range_min, height_range_max, body_types,
         show_my_profile, allow_messages, notifications_enabled,
         deal_breakers, preference_flexibility, compatibility_answers, learning_profile
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16::jsonb, $17::jsonb)
       ON CONFLICT (user_id) DO UPDATE
       SET age_range_min = EXCLUDED.age_range_min,
           age_range_max = EXCLUDED.age_range_max,
           location_radius = EXCLUDED.location_radius,
           gender_preferences = EXCLUDED.gender_preferences,
           relationship_goals = EXCLUDED.relationship_goals,
           interests = EXCLUDED.interests,
           height_range_min = EXCLUDED.height_range_min,
           height_range_max = EXCLUDED.height_range_max,
           body_types = EXCLUDED.body_types,
           show_my_profile = EXCLUDED.show_my_profile,
           allow_messages = EXCLUDED.allow_messages,
           notifications_enabled = EXCLUDED.notifications_enabled,
           deal_breakers = EXCLUDED.deal_breakers,
           preference_flexibility = EXCLUDED.preference_flexibility,
           compatibility_answers = EXCLUDED.compatibility_answers,
           learning_profile = EXCLUDED.learning_profile,
           updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        userId,
        nextPreferences.ageRangeMin,
        nextPreferences.ageRangeMax,
        nextPreferences.locationRadius,
        nextPreferences.genderPreferences,
        nextPreferences.relationshipGoals,
        nextPreferences.interests,
        nextPreferences.heightRangeMin,
        nextPreferences.heightRangeMax,
        nextPreferences.bodyTypes,
        nextPreferences.showMyProfile,
        nextPreferences.allowMessages,
        nextPreferences.notificationsEnabled,
        JSON.stringify(nextPreferences.dealBreakers),
        JSON.stringify(nextPreferences.preferenceFlexibility),
        JSON.stringify(nextPreferences.compatibilityAnswers),
        JSON.stringify(nextPreferences.learningProfile)
      ]
    );


    res.json({
      message: 'Preferences updated',
      preferences: formatPreferenceResponse(result.rows[0])
    });
  } catch (err) {
    console.error('Update preferences error:', err);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// 29. SUPERLIKE PROFILE
router.post('/interactions/superlike', async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const { toUserId, targetUserId } = req.body;
    const userId = toUserId || targetUserId;
    const requestMetadata = getRequestMetadata(req);

    if (!userId) {
      return res.status(400).json({ error: 'toUserId or targetUserId required' });
    }

    const today = new Date().toISOString().split('T')[0];
    const analyticsResult = await db.query(
      `SELECT superlikes_used FROM user_analytics WHERE user_id = $1 AND activity_date = $2`,
      [fromUserId, today]
    );

    const superlikesUsed = analyticsResult.rows.length > 0 ? (analyticsResult.rows[0].superlikes_used || 0) : 0;
    const superlikeLimit = 1;
    if (superlikesUsed >= superlikeLimit) {
      return res.status(429).json({ error: 'Daily superlike limit reached', limit: superlikeLimit, used: superlikesUsed, remaining: 0 });
    }

    const superlikeInsertResult = await db.query(
      `INSERT INTO interactions (from_user_id, to_user_id, interaction_type)
       VALUES ($1, $2, 'superlike')
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [fromUserId, userId]
    );
    if (superlikeInsertResult.rowCount > 0) {
      await persistLearningFeedback({
        userId: fromUserId,
        targetUserId: userId,
        interactionType: 'superlike'
      });
    }

    await db.query(
      `INSERT INTO user_analytics (user_id, activity_date, superlikes_used)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, activity_date) DO UPDATE
       SET superlikes_used = user_analytics.superlikes_used + 1`,
      [fromUserId, today]
    );

    spamFraudService.trackUserActivity({ userId: fromUserId, action: 'superlike_profile', analyticsUpdates: { superlikes_sent: 1 }, ipAddress: requestMetadata.ipAddress, userAgent: requestMetadata.userAgent, runSpamCheck: true, runFraudCheck: true });

    const mutualResult = await db.query(
      `SELECT * FROM interactions WHERE from_user_id = $1 AND to_user_id = $2 AND interaction_type IN ('like', 'superlike')`,
      [userId, fromUserId]
    );

    if (mutualResult.rows.length > 0) {
      const matchResult = await db.query(
        `INSERT INTO matches (user_id_1, user_id_2) VALUES (LEAST($1, $2), GREATEST($1, $2)) ON CONFLICT DO NOTHING RETURNING *`,
        [fromUserId, userId]
      );
      const persistedMatch = matchResult.rows[0] || (await db.query(`SELECT * FROM matches WHERE user_id_1 = LEAST($1, $2) AND user_id_2 = GREATEST($1, $2) LIMIT 1`, [fromUserId, userId])).rows[0];

      if (typeof req.emitToUser === 'function') {
        [fromUserId, userId].forEach((pid) => {
          req.emitToUser(pid, 'new_match', { match: persistedMatch, user: { id: fromUserId }, matchedUserId: pid === fromUserId ? userId : fromUserId, createdAt: new Date().toISOString(), superlike: true });
        });
      }

      await Promise.all([
        userNotificationService.createNotification(fromUserId, { type: 'new_match', title: 'Super Like Match!', body: 'They liked you back! Start chatting now.', metadata: { matchId: persistedMatch.id, matchedUserId: userId } }),
        userNotificationService.createNotification(userId, { type: 'new_match', title: 'Someone Super Liked You!', body: 'You matched with someone who super liked you!', metadata: { matchId: persistedMatch.id, matchedUserId: fromUserId } })
      ]);

      spamFraudService.updateUserAnalytics(fromUserId, { matches_made: 1 });
      spamFraudService.updateUserAnalytics(userId, { matches_made: 1 });
      spamFraudService.refreshSystemMetrics();

      return res.json({ message: 'Super Like Match!', isMatch: true, match: persistedMatch, superlike: true });
    }

    res.json({ message: 'Profile super liked', isMatch: false, superlike: true });
  } catch (err) {
    console.error('Superlike error:', err);
    res.status(500).json({ error: 'Failed to superlike profile' });
  }
});

// 30. GET DAILY LIMITS
router.get('/daily-limits', async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const analyticsResult = await db.query(
      `SELECT likes_used, superlikes_used, rewinds_used
       FROM user_analytics
       WHERE user_id = $1 AND activity_date = $2`,
      [userId, today]
    );

    const likesUsed = analyticsResult.rows.length > 0 ? (analyticsResult.rows[0].likes_used || 0) : 0;
    const superlikesUsed = analyticsResult.rows.length > 0 ? (analyticsResult.rows[0].superlikes_used || 0) : 0;
    const rewindsUsed = analyticsResult.rows.length > 0 ? (analyticsResult.rows[0].rewinds_used || 0) : 0;

    const likeLimit = 50;
    const superlikeLimit = 1;
    const rewindLimit = 3;

    res.json({
      likeLimit, superlikeLimit, rewindLimit, likesUsed, superlikesUsed, rewindsUsed,
      remainingLikes: Math.max(0, likeLimit - likesUsed),
      remainingSuperlikes: Math.max(0, superlikeLimit - superlikesUsed),
      remainingRewinds: Math.max(0, rewindLimit - rewindsUsed),
      resetsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  } catch (err) {
    console.error('Get daily limits error:', err);
    res.status(500).json({ error: 'Failed to get daily limits' });
  }
});

// 31. LIKE PROFILE (with daily limit check)
router.post('/interactions/like', async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const { toUserId, targetUserId } = req.body;
    const userId = toUserId || targetUserId;
    const requestMetadata = getRequestMetadata(req);

    if (!userId) {
      return res.status(400).json({ error: 'toUserId or targetUserId required' });
    }

    const today = new Date().toISOString().split('T')[0];
    const analyticsResult = await db.query(
      `SELECT likes_used FROM user_analytics WHERE user_id = $1 AND activity_date = $2`,
      [fromUserId, today]
    );

    const likesUsed = analyticsResult.rows.length > 0 ? (analyticsResult.rows[0].likes_used || 0) : 0;
    const likeLimit = 50;
    if (likesUsed >= likeLimit) {
      return res.status(429).json({ error: 'Daily like limit reached', limit: likeLimit, used: likesUsed, remaining: 0 });
    }

    const likeInsertResult = await db.query(
      `INSERT INTO interactions (from_user_id, to_user_id, interaction_type)
       VALUES ($1, $2, 'like')
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [fromUserId, userId]
    );
    if (likeInsertResult.rowCount > 0) {
      await persistLearningFeedback({
        userId: fromUserId,
        targetUserId: userId,
        interactionType: 'like'
      });
    }

    await db.query(
      `INSERT INTO user_analytics (user_id, activity_date, likes_used)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, activity_date) DO UPDATE
       SET likes_used = user_analytics.likes_used + 1`,
      [fromUserId, today]
    );

    spamFraudService.trackUserActivity({ userId: fromUserId, action: 'like_profile', analyticsUpdates: { likes_sent: 1 }, ipAddress: requestMetadata.ipAddress, userAgent: requestMetadata.userAgent, runSpamCheck: true, runFraudCheck: true });

    const mutualResult = await db.query(
      `SELECT * FROM interactions WHERE from_user_id = $1 AND to_user_id = $2 AND interaction_type IN ('like', 'superlike')`,
      [userId, fromUserId]
    );

    if (mutualResult.rows.length > 0) {
      const matchResult = await db.query(
        `INSERT INTO matches (user_id_1, user_id_2) VALUES (LEAST($1, $2), GREATEST($1, $2)) ON CONFLICT DO NOTHING RETURNING *`,
        [fromUserId, userId]
      );
      const persistedMatch = matchResult.rows[0] || (await db.query(`SELECT * FROM matches WHERE user_id_1 = LEAST($1, $2) AND user_id_2 = GREATEST($1, $2) LIMIT 1`, [fromUserId, userId])).rows[0];

      if (typeof req.emitToUser === 'function') {
        [fromUserId, userId].forEach((pid) => {
          req.emitToUser(pid, 'new_match', { match: persistedMatch, user: { id: fromUserId }, matchedUserId: pid === fromUserId ? userId : fromUserId, createdAt: new Date().toISOString() });
        });
      }

      await Promise.all([
        userNotificationService.createNotification(fromUserId, { type: 'new_match', title: 'You have a new match', body: 'Someone liked you back. Open the chat to say hello.', metadata: { matchId: persistedMatch.id, matchedUserId: userId } }),
        userNotificationService.createNotification(userId, { type: 'new_match', title: 'It is a match', body: 'You matched with someone new. Start the conversation when you are ready.', metadata: { matchId: persistedMatch.id, matchedUserId: fromUserId } })
      ]);

      spamFraudService.updateUserAnalytics(fromUserId, { matches_made: 1 });
      spamFraudService.updateUserAnalytics(userId, { matches_made: 1 });
      spamFraudService.refreshSystemMetrics();

      return res.json({ message: 'Its a match!', isMatch: true, match: persistedMatch });
    }

    res.json({ message: 'Profile liked', isMatch: false });
  } catch (err) {
    console.error('Like error:', err);
    res.status(500).json({ error: 'Failed to like profile' });
  }
});

// 32. GET TOP PICKS (Most Compatible Profiles) — using smart discovery query
router.get('/top-picks', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 20);

    const currentProfileResult = await db.query(
      `SELECT dp.*,
              row_to_json(up) as preferences,
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos WHERE user_id = dp.user_id) as photos
       FROM dating_profiles dp
       LEFT JOIN user_preferences up ON up.user_id = dp.user_id
       WHERE dp.user_id = $1
       LIMIT 1`,
      [userId]
    );
    const currentProfile = normalizeProfileRow(currentProfileResult.rows[0] || null);
    const currentPreferences = normalizePreferenceRow(currentProfileResult.rows[0]?.preferences);

    if (!currentProfile) {
      return res.status(404).json({ error: 'Profile not found. Complete your profile first.' });
    }

    const query = buildDiscoveryQuery({
      userId,
      currentLat: toFiniteNumber(currentProfile?.location?.lat),
      currentLng: toFiniteNumber(currentProfile?.location?.lng),
      radiusKm: currentPreferences.locationRadius,
      ageMin: currentPreferences.ageRangeMin,
      ageMax: currentPreferences.ageRangeMax,
      genderPreferences: currentPreferences.genderPreferences,
      relationshipGoals: currentPreferences.relationshipGoals,
      interests: currentPreferences.interests,
      heightRangeMin: currentPreferences.heightRangeMin,
      heightRangeMax: currentPreferences.heightRangeMax,
      bodyTypes: currentPreferences.bodyTypes,
      excludeShown: false,
      limit: 100,
      offset: 0
    });

    const result = await db.query(query.text, query.params);

    const scoredProfiles = result.rows
      .map((profileRow) => {
        const normalizedProfile = normalizeProfileRow(profileRow);
        const compatibility = buildCompatibilitySuggestion({
          currentProfile,
          currentPreferences,
          candidateProfile: normalizedProfile,
          candidatePreferences: profileRow.preferences
        });

        if (compatibility.isExcluded) {
          return null;
        }

        return {
          ...normalizedProfile,
          ...compatibility,
          topPickScore: compatibility.compatibilityScore
        };
      })
      .filter(Boolean)
      .sort((leftProfile, rightProfile) => rightProfile.topPickScore - leftProfile.topPickScore)
      .slice(0, limit);

    const requestMetadata = getRequestMetadata(req);
    spamFraudService.trackUserActivity({
      userId,
      action: 'top_picks_view',
      analyticsUpdates: {},
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runSpamCheck: true,
      runFraudCheck: true
    });

    res.json({
      profiles: scoredProfiles,
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  } catch (err) {
    console.error('Top picks error:', err);
    res.status(500).json({ error: 'Failed to get top picks' });
  }
});

// 33. REWIND PASS (Undo last pass)
router.post('/interactions/rewind', async (req, res) => {
  try {
    const userId = req.user.id;
    const requestMetadata = getRequestMetadata(req);

    // Check daily rewind limit
    const today = new Date().toISOString().split('T')[0];
    const analyticsResult = await db.query(
      `SELECT rewinds_used FROM user_analytics WHERE user_id = $1 AND activity_date = $2`,
      [userId, today]
    );

    const rewindsUsed = analyticsResult.rows.length > 0 ? (analyticsResult.rows[0].rewinds_used || 0) : 0;
    const rewindLimit = 3; // Free tier: 3/day

    if (rewindsUsed >= rewindLimit) {
      return res.status(429).json({
        error: 'Daily rewind limit reached',
        limit: rewindLimit,
        used: rewindsUsed,
        remaining: 0
      });
    }

    // Find most recent pass interaction
    const passResult = await db.query(
      `SELECT * FROM interactions
       WHERE from_user_id = $1 AND interaction_type = 'pass'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (passResult.rows.length === 0) {
      return res.status(404).json({ error: 'No passes to rewind' });
    }

    const lastPass = passResult.rows[0];

    // Delete the pass interaction
    await db.query(
      `DELETE FROM interactions
       WHERE from_user_id = $1 AND to_user_id = $2 AND interaction_type = 'pass'`,
      [userId, lastPass.to_user_id]
    );

    // Update rewind count
    await db.query(
      `INSERT INTO user_analytics (user_id, activity_date, rewinds_used)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, activity_date) DO UPDATE
       SET rewinds_used = user_analytics.rewinds_used + 1`,
      [userId, today]
    );

    spamFraudService.trackUserActivity({
      userId,
      action: 'rewind_pass',
      analyticsUpdates: { rewinds_used: 1 },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runSpamCheck: true,
      runFraudCheck: true
    });

    // Get the restored profile
    const restoredProfileResult = await db.query(
      `SELECT dp.*,
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos WHERE user_id = dp.user_id) as photos
       FROM dating_profiles dp
       WHERE dp.user_id = $1`,
      [lastPass.to_user_id]
    );

    res.json({
      message: 'Pass rewound successfully',
      restoredProfile: normalizeProfileRow(restoredProfileResult.rows[0] || null),
      rewindsUsed: rewindsUsed + 1,
      rewindsRemaining: Math.max(0, rewindLimit - (rewindsUsed + 1))
    });
  } catch (err) {
    console.error('Rewind error:', err);
    res.status(500).json({ error: 'Failed to rewind pass' });
  }
});

// 34. GET DAILY PROMPTS
const DAILY_PROMPTS = [
  {
    id: 'prompt-1',
    category: 'personality',
    text: 'What is something you are passionate about that most people do not know?',
    icon: '💭'
  },
  {
    id: 'prompt-2',
    category: 'lifestyle',
    text: 'My perfect Sunday looks like...',
    icon: '☀️'
  },
  {
    id: 'prompt-3',
    category: 'goals',
    text: 'A goal I am currently working towards...',
    icon: '🎯'
  },
  {
    id: 'prompt-4',
    category: 'fun',
    text: 'Two truths and a lie about me...',
    icon: '🎲'
  },
  {
    id: 'prompt-5',
    category: 'personality',
    text: 'The way to my heart is...',
    icon: '❤️'
  },
  {
    id: 'prompt-6',
    category: 'lifestyle',
    text: 'My ideal travel destination and why...',
    icon: '✈️'
  },
  {
    id: 'prompt-7',
    category: 'preferences',
    text: 'I am looking for someone who...',
    icon: '🔍'
  },
  {
    id: 'prompt-8',
    category: 'fun',
    text: 'My most controversial opinion is...',
    icon: '🔥'
  },
  {
    id: 'prompt-9',
    category: 'personality',
    text: 'A book or movie that changed my perspective...',
    icon: '📚'
  },
  {
    id: 'prompt-10',
    category: 'lifestyle',
    text: 'My happy place is...',
    icon: '🏖️'
  }
];

router.get('/daily-prompts', async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's answered prompts
    const answeredResult = await db.query(
      `SELECT prompt_id, response FROM daily_prompt_responses WHERE user_id = $1`,
      [userId]
    );

    const answeredPromptIds = new Set(answeredResult.rows.map(row => row.prompt_id));

    // Return prompts with answered status
    const prompts = DAILY_PROMPTS.map(prompt => ({
      ...prompt,
      isAnswered: answeredPromptIds.has(prompt.id),
      response: answeredResult.rows.find(row => row.prompt_id === prompt.id)?.response || null
    }));

    res.json({ prompts });
  } catch (err) {
    console.error('Get daily prompts error:', err);
    res.status(500).json({ error: 'Failed to get daily prompts' });
  }
});

// 35. ANSWER DAILY PROMPT
router.post('/daily-prompts/:promptId/answer', async (req, res) => {
  try {
    const userId = req.user.id;
    const { promptId } = req.params;
    const { response } = req.body;

    if (!response || !response.trim()) {
      return res.status(400).json({ error: 'Response is required' });
    }

    if (response.trim().length > 500) {
      return res.status(400).json({ error: 'Response must be 500 characters or less' });
    }

    const prompt = DAILY_PROMPTS.find(p => p.id === promptId);
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    await db.query(
      `INSERT INTO daily_prompt_responses (user_id, prompt_id, response)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, prompt_id) DO UPDATE
       SET response = EXCLUDED.response,
           updated_at = CURRENT_TIMESTAMP`,
      [userId, promptId, response.trim()]
    );

    res.json({
      message: 'Prompt answered',
      prompt: {
        ...prompt,
        isAnswered: true,
        response: response.trim()
      }
    });
  } catch (err) {
    console.error('Answer prompt error:', err);
    res.status(500).json({ error: 'Failed to answer prompt' });
  }
});

// 36. DELETE DAILY PROMPT ANSWER
router.delete('/daily-prompts/:promptId/answer', async (req, res) => {
  try {
    const userId = req.user.id;
    const { promptId } = req.params;

    await db.query(
      `DELETE FROM daily_prompt_responses WHERE user_id = $1 AND prompt_id = $2`,
      [userId, promptId]
    );

    res.json({ message: 'Prompt answer removed' });
  } catch (err) {
    console.error('Delete prompt answer error:', err);
    res.status(500).json({ error: 'Failed to remove prompt answer' });
  }
});

// 37. GET USER ANSWERED PROMPTS (for profile display)
router.get('/profiles/me/prompts', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT dpr.prompt_id, dpr.response, dpr.created_at
       FROM daily_prompt_responses dpr
       WHERE dpr.user_id = $1
       ORDER BY dpr.created_at DESC`,
      [userId]
    );

    const answeredPrompts = result.rows.map(row => {
      const prompt = DAILY_PROMPTS.find(p => p.id === row.prompt_id);
      return {
        ...prompt,
        response: row.response,
        answeredAt: row.created_at
      };
    }).filter(Boolean);

    res.json({ prompts: answeredPrompts });
  } catch (err) {
    console.error('Get profile prompts error:', err);
    res.status(500).json({ error: 'Failed to get profile prompts' });
  }
});

// 38. UPDATE NOTIFICATION PREFERENCES
router.put('/notification-preferences', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      newMatch,
      newMessage,
      likeReceived,
      superlikeReceived,
      profileViewed,
      dailyDigest,
      weeklyDigest,
      pushEnabled,
      emailEnabled
    } = req.body;

    const result = await db.query(
      `INSERT INTO notification_preferences (
         user_id,
         new_match,
         new_message,
         like_received,
         superlike_received,
         profile_viewed,
         daily_digest,
         weekly_digest,
         push_enabled,
         email_enabled
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (user_id) DO UPDATE
       SET new_match = EXCLUDED.new_match,
           new_message = EXCLUDED.new_message,
           like_received = EXCLUDED.like_received,
           superlike_received = EXCLUDED.superlike_received,
           profile_viewed = EXCLUDED.profile_viewed,
           daily_digest = EXCLUDED.daily_digest,
           weekly_digest = EXCLUDED.weekly_digest,
           push_enabled = EXCLUDED.push_enabled,
           email_enabled = EXCLUDED.email_enabled,
           updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        userId,
        normalizeBoolean(newMatch),
        normalizeBoolean(newMessage),
        normalizeBoolean(likeReceived),
        normalizeBoolean(superlikeReceived),
        normalizeBoolean(profileViewed),
        normalizeBoolean(dailyDigest),
        normalizeBoolean(weeklyDigest),
        normalizeBoolean(pushEnabled),
        normalizeBoolean(emailEnabled)
      ]
    );

    const row = result.rows[0];
    res.json({
      message: 'Notification preferences updated',
      preferences: {
        newMatch: row.new_match,
        newMessage: row.new_message,
        likeReceived: row.like_received,
        superlikeReceived: row.superlike_received,
        profileViewed: row.profile_viewed,
        dailyDigest: row.daily_digest,
        weeklyDigest: row.weekly_digest,
        pushEnabled: row.push_enabled,
        emailEnabled: row.email_enabled
      }
    });
  } catch (err) {
    console.error('Update notification preferences error:', err);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

// 39. GET NOTIFICATION PREFERENCES
router.get('/notification-preferences', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT * FROM notification_preferences WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        newMatch: true,
        newMessage: true,
        likeReceived: true,
        superlikeReceived: true,
        profileViewed: false,
        dailyDigest: false,
        weeklyDigest: true,
        pushEnabled: true,
        emailEnabled: false
      });
    }

    const row = result.rows[0];
    res.json({
      newMatch: row.new_match,
      newMessage: row.new_message,
      likeReceived: row.like_received,
      superlikeReceived: row.superlike_received,
      profileViewed: row.profile_viewed,
      dailyDigest: row.daily_digest,
      weeklyDigest: row.weekly_digest,
      pushEnabled: row.push_enabled,
      emailEnabled: row.email_enabled
    });
  } catch (err) {
    console.error('Get notification preferences error:', err);
    res.status(500).json({ error: 'Failed to get notification preferences' });
  }
});

// ========== PHASE 3: SAFETY & PREMIUM FEATURES ==========

// 40. GET PHOTO VERIFICATION POSE CHALLENGE
const VERIFICATION_POSES = [
  'thumbs_up', 'peace_sign', 'wave', 'hand_on_chin', 'salute',
  'heart_hands', 'shaka', 'point_up', 'fist_bump', 'ok_sign'
];

router.get('/verify-photo/challenge', async (req, res) => {
  try {
    const userId = req.user.id;
    const pose = VERIFICATION_POSES[Math.floor(Math.random() * VERIFICATION_POSES.length)];

    // Store the pose challenge for this user
    await db.query(
      `UPDATE dating_profiles
       SET verification_pose = $1,
           verification_status = 'pending',
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [pose, userId]
    );

    res.json({
      pose,
      instructions: `Please take a selfie while making a ${pose.replace(/_/g, ' ')} gesture. Make sure your face is clearly visible.`,
      expiresIn: 300 // 5 minutes
    });
  } catch (err) {
    console.error('Get verification challenge error:', err);
    res.status(500).json({ error: 'Failed to generate verification challenge' });
  }
});

// 41. SUBMIT PHOTO VERIFICATION
router.post('/profiles/me/verify-photo', async (req, res) => {
  try {
    const userId = req.user.id;
    const { photoBase64 } = req.body;
    const requestMetadata = getRequestMetadata(req);

    if (!photoBase64) {
      return res.status(400).json({ error: 'Verification photo is required' });
    }

    // Get current challenge pose
    const profileResult = await db.query(
      `SELECT verification_pose, verification_status
       FROM dating_profiles
       WHERE user_id = $1`,
      [userId]
    );

    const profile = profileResult.rows[0];
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    if (profile.verification_status === 'approved') {
      return res.status(400).json({ error: 'Profile is already verified' });
    }

    // Verification photos now flow through a moderation queue instead of
    // being auto-approved so admins can review edge cases and appeals.
    await db.query(
      `UPDATE dating_profiles
       SET verification_photo_url = $1,
           verification_status = 'pending',
           profile_verified = false,
           verified_at = NULL,
           verification_pose = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2
       RETURNING *`,
      [photoBase64, userId]
    );

    await spamFraudService.queuePhotoForModeration({
      userId,
      photoUrl: photoBase64,
      sourceType: 'verification_photo'
    });

    spamFraudService.trackUserActivity({
      userId,
      action: 'photo_verification_submitted',
      analyticsUpdates: { verifications_completed: 1 },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent
    });

    await userNotificationService.createNotification(userId, {
      type: 'verification_pending',
      title: 'Verification Submitted',
      body: 'Your verification selfie is now pending moderator review.',
      metadata: { verificationType: 'photo', status: 'pending' }
    });

    await spamFraudService.refreshSystemMetrics();

    res.json({
      message: 'Verification photo submitted for review',
      verified: false,
      verificationStatus: 'pending'
    });
  } catch (err) {
    console.error('Photo verification error:', err);
    res.status(500).json({ error: 'Failed to process photo verification' });
  }
});

// 42. GET VERIFICATION STATUS
router.get('/profiles/me/verification-status', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT verification_status, verification_photo_url, verified_at, profile_verified
       FROM dating_profiles
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const row = result.rows[0];
    res.json({
      verificationStatus: row.verification_status,
      profileVerified: row.profile_verified,
      verifiedAt: row.verified_at,
      hasVerificationPhoto: Boolean(row.verification_photo_url)
    });
  } catch (err) {
    console.error('Get verification status error:', err);
    res.status(500).json({ error: 'Failed to get verification status' });
  }
});

// 43. GET SUBSCRIPTION PLANS
router.get('/subscription/plans', async (req, res) => {
  try {
    const plans = [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        currency: 'USD',
        interval: 'month',
        features: [
          '50 likes per day',
          '1 superlike per day',
          '3 rewinds per day',
          'Basic matching'
        ],
        limits: {
          likesPerDay: 50,
          superlikesPerDay: 1,
          rewindsPerDay: 3,
          boostsPerMonth: 0,
          seeWhoLikedYou: false
        }
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 19.99,
        currency: 'USD',
        interval: 'month',
        features: [
          'Unlimited likes',
          '5 superlikes per day',
          'Unlimited rewinds',
          '1 boost per month',
          'See who liked you',
          'Read receipts',
          'Advanced filters'
        ],
        limits: {
          likesPerDay: Infinity,
          superlikesPerDay: 5,
          rewindsPerDay: Infinity,
          boostsPerMonth: 1,
          seeWhoLikedYou: true
        }
      },
      {
        id: 'gold',
        name: 'Gold',
        price: 29.99,
        currency: 'USD',
        interval: 'month',
        features: [
          'Everything in Premium',
          '5 boosts per month',
          'Priority in discovery',
          'Message requests',
          'Profile highlights',
          'Incognito mode'
        ],
        limits: {
          likesPerDay: Infinity,
          superlikesPerDay: 10,
          rewindsPerDay: Infinity,
          boostsPerMonth: 5,
          seeWhoLikedYou: true,
          messageRequests: true,
          incognitoMode: true
        }
      }
    ];

    res.json({ plans });
  } catch (err) {
    console.error('Get plans error:', err);
    res.status(500).json({ error: 'Failed to get subscription plans' });
  }
});

// 44. GET MY SUBSCRIPTION
router.get('/subscription/me', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT * FROM subscriptions WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Return free tier as default
      return res.json({
        plan: 'free',
        status: 'active',
        isPremium: false,
        isGold: false,
        features: {
          unlimitedLikes: false,
          unlimitedRewinds: false,
          seeWhoLikedYou: false,
          boostsRemaining: 0,
          messageRequests: false,
          incognitoMode: false
        }
      });
    }

    const sub = result.rows[0];
    const isPremium = sub.plan === 'premium' && sub.status === 'active' && (!sub.expires_at || new Date(sub.expires_at) > new Date());
    const isGold = sub.plan === 'gold' && sub.status === 'active' && (!sub.expires_at || new Date(sub.expires_at) > new Date());
    const isActive = isPremium || isGold;

    res.json({
      plan: sub.plan,
      status: isActive ? sub.status : 'expired',
      startedAt: sub.started_at,
      expiresAt: sub.expires_at,
      isPremium: isPremium,
      isGold: isGold,
      features: {
        unlimitedLikes: isActive,
        unlimitedRewinds: isActive,
        seeWhoLikedYou: isActive,
        boostsRemaining: isGold ? 5 : (isPremium ? 1 : 0),
        messageRequests: isGold,
        incognitoMode: isGold
      }
    });
  } catch (err) {
    console.error('Get subscription error:', err);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

// 45. CREATE SUBSCRIPTION (simulate - no Stripe)
router.post('/subscription/create', async (req, res) => {
  try {
    const userId = req.user.id;
    const { plan } = req.body;

    if (!['premium', 'gold'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Choose premium or gold.' });
    }

    // Cancel any existing subscription first
    await db.query(
      `UPDATE subscriptions
       SET status = 'cancelled',
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    const startedAt = new Date();
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    const result = await db.query(
      `INSERT INTO subscriptions (
         user_id, plan, status, started_at, expires_at, payment_method
       )
       VALUES ($1, $2, 'active', $3, $4, 'manual')
       ON CONFLICT (user_id) DO UPDATE
       SET plan = EXCLUDED.plan,
           status = EXCLUDED.status,
           started_at = EXCLUDED.started_at,
           expires_at = EXCLUDED.expires_at,
           payment_method = EXCLUDED.payment_method,
           updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, plan, startedAt, expiresAt]
    );

    await userNotificationService.createNotification(userId, {
      type: 'subscription_updated',
      title: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Activated!`,
      body: `Your ${plan} subscription is now active. Enjoy the premium features!`,
      metadata: { plan, status: 'active', expiresAt: expiresAt.toISOString() }
    });

    spamFraudService.updateUserAnalytics(userId, { premium_conversions: 1 });
    spamFraudService.refreshSystemMetrics();

    res.json({
      message: 'Subscription created',
      subscription: {
        plan,
        status: 'active',
        startedAt: startedAt.toISOString(),
        expiresAt: expiresAt.toISOString()
      }
    });
  } catch (err) {
    console.error('Create subscription error:', err);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// 46. CANCEL SUBSCRIPTION
router.delete('/subscription/cancel', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `UPDATE subscriptions
       SET status = 'cancelled',
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND status = 'active'
       RETURNING *`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    await userNotificationService.createNotification(userId, {
      type: 'subscription_cancelled',
      title: 'Subscription Cancelled',
      body: 'Your premium subscription has been cancelled. You can resubscribe anytime.',
      metadata: { previousPlan: result.rows[0].plan }
    });

    res.json({ message: 'Subscription cancelled successfully' });
  } catch (err) {
    console.error('Cancel subscription error:', err);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// 47. BOOST PROFILE
router.post('/profiles/me/boost', async (req, res) => {
  try {
    const userId = req.user.id;
    const requestMetadata = getRequestMetadata(req);

    // Check subscription for boost availability
    const subResult = await db.query(
      `SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    );

    const sub = subResult.rows[0];
    const isPremium = sub && sub.plan === 'premium' && (!sub.expires_at || new Date(sub.expires_at) > new Date());
    const isGold = sub && sub.plan === 'gold' && (!sub.expires_at || new Date(sub.expires_at) > new Date());

    if (!isPremium && !isGold) {
      return res.status(403).json({ error: 'Boost requires a Premium or Gold subscription' });
    }

    // Check if already boosted in last 30 minutes
    const boostResult = await db.query(
      `SELECT * FROM user_analytics
       WHERE user_id = $1 AND activity_date = $2
       LIMIT 1`,
      [userId, new Date().toISOString().split('T')[0]]
    );

    const boostsUsedToday = boostResult.rows[0]?.boosts_used || 0;
    const dailyBoostLimit = isGold ? 5 : (isPremium ? 1 : 0);

    if (boostsUsedToday >= dailyBoostLimit) {
      return res.status(429).json({
        error: 'Daily boost limit reached',
        limit: dailyBoostLimit,
        used: boostsUsedToday
      });
    }

    // Record boost
    await db.query(
      `INSERT INTO user_analytics (user_id, activity_date, boosts_used)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, activity_date) DO UPDATE
       SET boosts_used = user_analytics.boosts_used + 1`,
      [userId, new Date().toISOString().split('T')[0]]
    );

    spamFraudService.trackUserActivity({
      userId,
      action: 'profile_boosted',
      analyticsUpdates: { boosts_used: 1 },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent
    });

    res.json({
      message: 'Profile boosted!',
      boostedUntil: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      boostsRemaining: Math.max(0, dailyBoostLimit - boostsUsedToday - 1)
    });
  } catch (err) {
    console.error('Boost error:', err);
    res.status(500).json({ error: 'Failed to boost profile' });
  }
});

// 48. GET WHO LIKED ME
router.get('/who-liked-me', async (req, res) => {
  try {
    const userId = req.user.id;

    // Check subscription
    const subResult = await db.query(
      `SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    );

    const sub = subResult.rows[0];
    const isPremium = sub && ['premium', 'gold'].includes(sub.plan) && (!sub.expires_at || new Date(sub.expires_at) > new Date());

    const result = await db.query(
      `SELECT i.*, dp.first_name, dp.age, dp.location_city,
              (SELECT photo_url FROM profile_photos WHERE user_id = i.from_user_id LIMIT 1) as photo_url
       FROM interactions i
       JOIN dating_profiles dp ON i.from_user_id = dp.user_id
       WHERE i.to_user_id = $1 AND i.interaction_type IN ('like', 'superlike')
         AND i.from_user_id NOT IN (
           SELECT CASE WHEN user_id_1 = $1 THEN user_id_2 ELSE user_id_1 END
           FROM matches WHERE (user_id_1 = $1 OR user_id_2 = $1) AND status = 'active'
         )
       ORDER BY i.created_at DESC
       LIMIT 50`,
      [userId]
    );

    const likers = result.rows.map(row => ({
      userId: row.from_user_id,
      firstName: row.first_name,
      age: row.age,
      location: { city: row.location_city },
      photoUrl: row.photo_url,
      interactionType: row.interaction_type,
      likedAt: row.created_at,
      // For free users, blur the photo and name
      isRevealed: isPremium
    }));

    res.json({
      likers,
      isPremium,
      totalCount: likers.length,
      blurredCount: isPremium ? 0 : likers.length
    });
  } catch (err) {
    console.error('Get who liked me error:', err);
    res.status(500).json({ error: 'Failed to get likes' });
  }
});

// 49. SEND MESSAGE REQUEST (to non-match)
router.post('/message-requests', async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const { toUserId, message } = req.body;
    const requestMetadata = getRequestMetadata(req);

    if (!toUserId || !message || !message.trim()) {
      return res.status(400).json({ error: 'toUserId and message are required' });
    }

    if (fromUserId === toUserId) {
      return res.status(400).json({ error: 'Cannot send message request to yourself' });
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length < 10 || trimmedMessage.length > 500) {
      return res.status(400).json({ error: 'Message must be between 10 and 500 characters' });
    }

    // Check if already matched
    const matchCheck = await db.query(
      `SELECT * FROM matches
       WHERE (user_id_1 = $1 AND user_id_2 = $2) OR (user_id_1 = $2 AND user_id_2 = $1)
       AND status = 'active'
       LIMIT 1`,
      [fromUserId, toUserId]
    );

    if (matchCheck.rows.length > 0) {
      return res.status(400).json({ error: 'You are already matched with this user' });
    }

    // Check Gold subscription for message requests
    const subResult = await db.query(
      `SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [fromUserId]
    );

    const sub = subResult.rows[0];
    const isGold = sub && sub.plan === 'gold' && (!sub.expires_at || new Date(sub.expires_at) > new Date());

    if (!isGold) {
      return res.status(403).json({ error: 'Message requests require a Gold subscription' });
    }

    // Check for existing pending request
    const existingResult = await db.query(
      `SELECT * FROM message_requests
       WHERE from_user_id = $1 AND to_user_id = $2 AND status = 'pending'
       LIMIT 1`,
      [fromUserId, toUserId]
    );

    if (existingResult.rows.length > 0) {
      return res.status(409).json({ error: 'A pending message request already exists' });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const result = await db.query(
      `INSERT INTO message_requests (from_user_id, to_user_id, message, status, expires_at)
       VALUES ($1, $2, $3, 'pending', $4)
       RETURNING *`,
      [fromUserId, toUserId, trimmedMessage, expiresAt]
    );

    const fromProfile = await db.query(
      `SELECT first_name FROM dating_profiles WHERE user_id = $1 LIMIT 1`,
      [fromUserId]
    );
    const fromName = fromProfile.rows[0]?.first_name || 'Someone';

    await userNotificationService.createNotification(toUserId, {
      type: 'message_request',
      title: `Message request from ${fromName}`,
      body: trimmedMessage.length > 90 ? `${trimmedMessage.slice(0, 87)}...` : trimmedMessage,
      metadata: {
        requestId: result.rows[0].id,
        fromUserId,
        fromName
      }
    });

    spamFraudService.trackUserActivity({
      userId: fromUserId,
      action: 'message_request_sent',
      analyticsUpdates: { message_requests_sent: 1 },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runSpamCheck: true
    });

    res.json({
      message: 'Message request sent',
      request: result.rows[0]
    });
  } catch (err) {
    console.error('Send message request error:', err);
    res.status(500).json({ error: 'Failed to send message request' });
  }
});

// 50. GET INCOMING MESSAGE REQUESTS
router.get('/message-requests', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT mr.*,
              dp.first_name, dp.age, dp.location_city,
              (SELECT photo_url FROM profile_photos WHERE user_id = mr.from_user_id LIMIT 1) as photo_url
       FROM message_requests mr
       JOIN dating_profiles dp ON dp.user_id = mr.from_user_id
       WHERE mr.to_user_id = $1 AND mr.status = 'pending'
       ORDER BY mr.created_at DESC`,
      [userId]
    );

    res.json({
      requests: result.rows.map(row => ({
        id: row.id,
        fromUserId: row.from_user_id,
        firstName: row.first_name,
        age: row.age,
        location: { city: row.location_city },
        photoUrl: row.photo_url,
        message: row.message,
        status: row.status,
        createdAt: row.created_at,
        expiresAt: row.expires_at
      }))
    });
  } catch (err) {
    console.error('Get message requests error:', err);
    res.status(500).json({ error: 'Failed to get message requests' });
  }
});

// 51. ACCEPT MESSAGE REQUEST
router.post('/message-requests/:requestId/accept', async (req, res) => {
  try {
    const userId = req.user.id;
    const { requestId } = req.params;

    const requestResult = await db.query(
      `SELECT * FROM message_requests WHERE id = $1 AND to_user_id = $2 AND status = 'pending'`,
      [requestId, userId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Message request not found' });
    }

    const request = requestResult.rows[0];

    // Update request status
    await db.query(
      `UPDATE message_requests SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [requestId]
    );

    // Create a match
    const fromUserId = request.from_user_id;
    const matchResult = await db.query(
      `INSERT INTO matches (user_id_1, user_id_2) VALUES (LEAST($1, $2), GREATEST($1, $2)) ON CONFLICT DO NOTHING RETURNING *`,
      [fromUserId, userId]
    );
    const persistedMatch = matchResult.rows[0] || (await db.query(
      `SELECT * FROM matches WHERE user_id_1 = LEAST($1, $2) AND user_id_2 = GREATEST($1, $2) LIMIT 1`,
      [fromUserId, userId]
    )).rows[0];

    // Notify both users
    await Promise.all([
      userNotificationService.createNotification(userId, {
        type: 'message_request_accepted',
        title: 'Message request accepted',
        body: 'You can now chat with this user.',
        metadata: { matchId: persistedMatch.id }
      }),
      userNotificationService.createNotification(fromUserId, {
        type: 'message_request_accepted',
        title: 'Your message request was accepted!',
        body: 'Start the conversation now.',
        metadata: { matchId: persistedMatch.id }
      })
    ]);

    if (typeof req.emitToUser === 'function') {
      [fromUserId, userId].forEach((pid) => {
        req.emitToUser(pid, 'new_match', {
          match: persistedMatch,
          user: { id: fromUserId },
          matchedUserId: pid === fromUserId ? userId : fromUserId,
          createdAt: new Date().toISOString(),
          fromMessageRequest: true
        });
      });
    }

    res.json({
      message: 'Message request accepted',
      match: persistedMatch
    });
  } catch (err) {
    console.error('Accept message request error:', err);
    res.status(500).json({ error: 'Failed to accept message request' });
  }
});

// 52. DECLINE MESSAGE REQUEST
router.post('/message-requests/:requestId/decline', async (req, res) => {
  try {
    const userId = req.user.id;
    const { requestId } = req.params;

    const result = await db.query(
      `UPDATE message_requests
       SET status = 'declined',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND to_user_id = $2 AND status = 'pending'
       RETURNING *`,
      [requestId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message request not found' });
    }

    res.json({ message: 'Message request declined' });
  } catch (err) {
    console.error('Decline message request error:', err);
    res.status(500).json({ error: 'Failed to decline message request' });
  }
});

// ========== PHASE 4: ADVANCED PROFILE ANALYTICS & INSIGHTS ==========

// 53. RECORD PROFILE VIEW
router.post('/profiles/:userId/view', async (req, res) => {
  try {
    const viewerUserId = req.user.id;
    const { userId: viewedUserId } = req.params;
    const requestMetadata = getRequestMetadata(req);

    if (Number(viewerUserId) === Number(viewedUserId)) {
      return res.status(400).json({ error: 'Cannot view your own profile' });
    }

    // Update viewer's last active
    await db.query(
      `UPDATE dating_profiles SET last_active = CURRENT_TIMESTAMP WHERE user_id = $1`,
      [viewerUserId]
    );

    // Record the profile view (upsert to keep latest)
    await db.query(
      `INSERT INTO profile_views (viewer_user_id, viewed_user_id, viewed_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (viewer_user_id, viewed_user_id) DO UPDATE
       SET viewed_at = CURRENT_TIMESTAMP`,
      [viewerUserId, viewedUserId]
    );

    // Update analytics
    spamFraudService.trackUserActivity({
      userId: viewerUserId,
      action: 'profile_view',
      analyticsUpdates: { profiles_viewed: 1 },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runSpamCheck: true,
      runFraudCheck: true
    });

    // Send notification to viewed user if they have it enabled
    const notifPrefs = await db.query(
      `SELECT profile_viewed FROM notification_preferences WHERE user_id = $1`,
      [viewedUserId]
    );

    if (notifPrefs.rows[0]?.profile_viewed !== false) {
      const viewerProfile = await db.query(
        `SELECT first_name FROM dating_profiles WHERE user_id = $1`,
        [viewerUserId]
      );
      const viewerName = viewerProfile.rows[0]?.first_name || 'Someone';

      await userNotificationService.createNotification(viewedUserId, {
        type: 'profile_viewed',
        title: `${viewerName} viewed your profile`,
        body: 'Someone is interested in your profile.',
        metadata: { viewerUserId }
      });
    }

    res.json({ message: 'Profile view recorded' });
  } catch (err) {
    console.error('Record profile view error:', err);
    res.status(500).json({ error: 'Failed to record profile view' });
  }
});

// 54. GET PROFILE ANALYTICS (for own profile)
router.get('/profiles/me/analytics', async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Get profile completion details
    const profileResult = await db.query(
      `SELECT first_name, age, gender, location_city, bio, interests, occupation,
              education, relationship_goals, height, body_type, profile_verified,
              profile_completion_percent, last_active,
              (SELECT COUNT(*) FROM profile_photos WHERE user_id = $1) as photo_count
       FROM dating_profiles WHERE user_id = $1`,
      [userId]
    );
    const profile = profileResult.rows[0];

    // Get view counts
    const viewsResult = await db.query(
      `SELECT
         COUNT(*) as total_views,
         COUNT(CASE WHEN viewed_at >= $2 THEN 1 END) as views_last_7_days,
         COUNT(CASE WHEN viewed_at >= $3 THEN 1 END) as views_last_30_days,
         COUNT(DISTINCT viewer_user_id) as unique_viewers
       FROM profile_views WHERE viewed_user_id = $1`,
      [userId, sevenDaysAgo, thirtyDaysAgo]
    );

    // Get daily view trend (last 7 days)
    const dailyViewsResult = await db.query(
      `SELECT DATE(viewed_at) as date, COUNT(*) as count
       FROM profile_views
       WHERE viewed_user_id = $1 AND viewed_at >= $2
       GROUP BY DATE(viewed_at)
       ORDER BY date DESC`,
      [userId, sevenDaysAgo]
    );

    // Get interaction stats
    const interactionsResult = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM interactions WHERE from_user_id = $1 AND interaction_type = 'like') as likes_sent,
         (SELECT COUNT(*) FROM interactions WHERE to_user_id = $1 AND interaction_type = 'like') as likes_received,
         (SELECT COUNT(*) FROM interactions WHERE from_user_id = $1 AND interaction_type = 'superlike') as superlikes_sent,
         (SELECT COUNT(*) FROM interactions WHERE to_user_id = $1 AND interaction_type = 'superlike') as superlikes_received,
         (SELECT COUNT(*) FROM matches WHERE (user_id_1 = $1 OR user_id_2 = $1) AND status = 'active') as total_matches,
         (SELECT COUNT(*) FROM interactions WHERE from_user_id = $1 AND interaction_type = 'pass') as passes_sent`,
      [userId]
    );

    // Calculate profile strength
    const profileStrength = calculateProfileStrength(profile);

    res.json({
      profileStrength: {
        score: profileStrength.score,
        maxScore: 100,
        level: profileStrength.level,
        recommendations: profileStrength.recommendations
      },
      views: {
        total: Number.parseInt(viewsResult.rows[0]?.total_views || 0),
        last7Days: Number.parseInt(viewsResult.rows[0]?.views_last_7_days || 0),
        last30Days: Number.parseInt(viewsResult.rows[0]?.views_last_30_days || 0),
        uniqueViewers: Number.parseInt(viewsResult.rows[0]?.unique_viewers || 0),
        dailyTrend: dailyViewsResult.rows.map(row => ({
          date: row.date,
          count: Number.parseInt(row.count, 10)
        }))
      },
      interactions: {
        likesSent: Number.parseInt(interactionsResult.rows[0]?.likes_sent || 0),
        likesReceived: Number.parseInt(interactionsResult.rows[0]?.likes_received || 0),
        superlikesSent: Number.parseInt(interactionsResult.rows[0]?.superlikes_sent || 0),
        superlikesReceived: Number.parseInt(interactionsResult.rows[0]?.superlikes_received || 0),
        totalMatches: Number.parseInt(interactionsResult.rows[0]?.total_matches || 0),
        passesSent: Number.parseInt(interactionsResult.rows[0]?.passes_sent || 0)
      },
      lastActive: profile?.last_active,
      profileCompletionPercent: profile?.profile_completion_percent || 0
    });
  } catch (err) {
    console.error('Get analytics error:', err);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// Profile strength calculator helper
const calculateProfileStrength = (profile) => {
  const recommendations = [];
  let score = 0;

  // Photos (25 points)
  const photoCount = Number.parseInt(profile?.photo_count || 0);
  if (photoCount >= 6) {
    score += 25;
  } else if (photoCount >= 3) {
    score += 15;
    recommendations.push('Add more photos to increase engagement (aim for 6+)');
  } else {
    score += photoCount * 3;
    recommendations.push('Add at least 3 photos to your profile');
  }

  // Bio (20 points)
  const bioLength = (profile?.bio || '').length;
  if (bioLength >= 150) {
    score += 20;
  } else if (bioLength >= 50) {
    score += 10;
    recommendations.push('Write a longer bio (150+ characters) to express your personality');
  } else if (bioLength > 0) {
    score += 5;
    recommendations.push('Expand your bio to help others know you better');
  } else {
    recommendations.push('Add a bio - profiles with bios get 4x more matches');
  }

  // Basic info (20 points)
  if (profile?.occupation) score += 7;
  else recommendations.push('Add your occupation');

  if (profile?.education) score += 7;
  else recommendations.push('Add your education');

  if (profile?.height) score += 6;
  else recommendations.push('Add your height');

  // Interests (15 points)
  const interests = Array.isArray(profile?.interests) ? profile.interests : [];
  if (interests.length >= 5) {
    score += 15;
  } else if (interests.length >= 3) {
    score += 8;
    recommendations.push('Add more interests to find better matches');
  } else {
    score += interests.length * 2;
    recommendations.push('Add at least 3 interests');
  }

  // Verification (10 points)
  if (profile?.profile_verified) {
    score += 10;
  } else {
    recommendations.push('Get photo verified to build trust');
  }

  // Relationship goals (10 points)
  if (profile?.relationship_goals) {
    score += 10;
  } else {
    recommendations.push('Specify what you are looking for');
  }

  // Determine level
  let level = 'beginner';
  if (score >= 90) level = 'excellent';
  else if (score >= 75) level = 'strong';
  else if (score >= 50) level = 'good';
  else if (score >= 25) level = 'fair';

  return {
    score: Math.min(100, score),
    level,
    recommendations: recommendations.slice(0, 5)
  };
};

// 55. GET WHO VIEWED MY PROFILE (Premium)
router.get('/profiles/me/profile-views', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const page = parseInt(req.query.page, 10) || 1;
    const offset = (page - 1) * limit;

    // Check premium subscription
    const subResult = await db.query(
      `SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    );
    const sub = subResult.rows[0];
    const isPremium = sub && ['premium', 'gold'].includes(sub.plan) && (!sub.expires_at || new Date(sub.expires_at) > new Date());

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) FROM profile_views WHERE viewed_user_id = $1`,
      [userId]
    );
    const totalCount = Number.parseInt(countResult.rows[0].count, 10);

    // Get viewers
    const result = await db.query(
      `SELECT pv.viewer_user_id, pv.viewed_at,
              dp.first_name, dp.age, dp.location_city,
              (SELECT photo_url FROM profile_photos WHERE user_id = pv.viewer_user_id LIMIT 1) as photo_url
       FROM profile_views pv
       JOIN dating_profiles dp ON dp.user_id = pv.viewer_user_id
       WHERE pv.viewed_user_id = $1
       ORDER BY pv.viewed_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const viewers = result.rows.map(row => ({
      userId: row.viewer_user_id,
      firstName: row.first_name,
      age: row.age,
      location: { city: row.location_city },
      photoUrl: row.photo_url,
      viewedAt: row.viewed_at,
      isRevealed: isPremium
    }));

    res.json({
      viewers,
      isPremium,
      totalCount,
      blurredCount: isPremium ? 0 : viewers.length,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: offset + viewers.length < totalCount
      }
    });
  } catch (err) {
    console.error('Get profile views error:', err);
    res.status(500).json({ error: 'Failed to get profile views' });
  }
});

// 56. GET COMPATIBILITY WITH PROFILE
router.get('/profiles/:userId/compatibility', async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { userId: targetUserId } = req.params;

    // Get both profiles with preferences
    const [currentResult, targetResult] = await Promise.all([
      db.query(
        `SELECT dp.*, row_to_json(up) as preferences,
                (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
                 FROM profile_photos WHERE user_id = dp.user_id) as photos
         FROM dating_profiles dp
         LEFT JOIN user_preferences up ON up.user_id = dp.user_id
         WHERE dp.user_id = $1`,
        [currentUserId]
      ),
      db.query(
        `SELECT dp.*, row_to_json(up) as preferences,
                (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
                 FROM profile_photos WHERE user_id = dp.user_id) as photos
         FROM dating_profiles dp
         LEFT JOIN user_preferences up ON up.user_id = dp.user_id
         WHERE dp.user_id = $1`,
        [targetUserId]
      )
    ]);

    const currentProfile = normalizeProfileRow(currentResult.rows[0] || null);
    const currentPreferences = normalizePreferenceRow(currentResult.rows[0]?.preferences);
    const targetProfile = normalizeProfileRow(targetResult.rows[0] || null);
    const targetPreferences = normalizePreferenceRow(targetResult.rows[0]?.preferences);

    if (!currentProfile || !targetProfile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const compatibility = buildCompatibilitySuggestion({
      currentProfile,
      currentPreferences,
      candidateProfile: targetProfile,
      candidatePreferences: targetPreferences
    });

    // Calculate mutual interests percentage
    const currentInterests = normalizeInterestList(currentProfile.interests);
    const targetInterests = normalizeInterestList(targetProfile.interests);
    const currentInterestSet = new Set(currentInterests.map(i => i.toLowerCase()));
    const targetInterestSet = new Set(targetInterests.map(i => i.toLowerCase()));

    const mutualInterests = currentInterests.filter(interest =>
      targetInterestSet.has(interest.toLowerCase())
    );

    const totalUniqueInterests = new Set([...currentInterests.map(i => i.toLowerCase()), ...targetInterests.map(i => i.toLowerCase())]).size;
    const mutualInterestPercentage = totalUniqueInterests > 0
      ? Math.round((mutualInterests.length / totalUniqueInterests) * 100)
      : 0;

    // Check if already matched
    const matchResult = await db.query(
      `SELECT * FROM matches
       WHERE ((user_id_1 = $1 AND user_id_2 = $2) OR (user_id_1 = $2 AND user_id_2 = $1))
       AND status = 'active'
       LIMIT 1`,
      [currentUserId, targetUserId]
    );

    res.json({
      compatibilityScore: compatibility.compatibilityScore,
      compatibilityReasons: compatibility.compatibilityReasons,
      isExcluded: compatibility.isExcluded,
      mutualInterests: {
        count: mutualInterests.length,
        totalUnique: totalUniqueInterests,
        percentage: mutualInterestPercentage,
        interests: mutualInterests.slice(0, 10)
      },
      isMatched: matchResult.rows.length > 0,
      matchId: matchResult.rows[0]?.id || null,
      icebreakers: compatibility.icebreakers
    });
  } catch (err) {
    console.error('Get compatibility error:', err);
    res.status(500).json({ error: 'Failed to get compatibility' });
  }
});

// 57. UPDATE LAST ACTIVE (heartbeat endpoint)
router.post('/profiles/me/heartbeat', async (req, res) => {
  try {
    const userId = req.user.id;

    await db.query(
      `UPDATE dating_profiles
       SET last_active = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId]
    );

    res.json({ lastActive: new Date().toISOString() });
  } catch (err) {
    console.error('Heartbeat error:', err);
    res.status(500).json({ error: 'Failed to update activity' });
  }
});

module.exports = router;
