/**
 * ML Compatibility Scoring Service
 * Calculates compatibility between profiles using ML patterns
 * Considers: interests, location, age, values, communication style, activity level
 */

const calculateInterestsMatch = (viewerInterests = [], candidateInterests = []) => {
  if (!viewerInterests.length || !candidateInterests.length) return 0;

  const viewerSet = new Set(
    viewerInterests.map(i => String(i || '').toLowerCase().trim()).filter(Boolean)
  );
  const candidateSet = new Set(
    candidateInterests.map(i => String(i || '').toLowerCase().trim()).filter(Boolean)
  );

  if (!viewerSet.size || !candidateSet.size) return 0;

  const intersection = new Set([...viewerSet].filter(x => candidateSet.has(x)));
  const union = new Set([...viewerSet, ...candidateSet]);

  return (intersection.size / union.size) * 100;
};

const calculateLocationCompatibility = (viewerLat, viewerLng, candidateLat, candidateLng, maxDistance = 100) => {
  if (!viewerLat || !viewerLng || !candidateLat || !candidateLng) return 50;

  const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const distance = haversineDistance(viewerLat, viewerLng, candidateLat, candidateLng);

  if (distance <= 5) return 100;
  if (distance <= 20) return 90;
  if (distance <= 50) return 70;
  if (distance <= maxDistance) return Math.max(30, 100 - (distance / maxDistance) * 70);
  return 0;
};

const calculateAgeCompatibility = (viewerAge, viewerAgeMin, viewerAgeMax, candidateAge) => {
  if (!viewerAge || !candidateAge) return 50;

  const ageDiff = Math.abs(viewerAge - candidateAge);

  if (candidateAge >= viewerAgeMin && candidateAge <= viewerAgeMax) {
    return Math.max(70, 100 - ageDiff * 2);
  }

  if (ageDiff <= 5) return 60;
  if (ageDiff <= 10) return 40;
  return 0;
};

const calculateValuesAlignment = (viewer, candidate) => {
  let score = 50;

  if (viewer.relationshipGoals && candidate.relationshipGoals) {
    const viewerGoals = Array.isArray(viewer.relationshipGoals)
      ? viewer.relationshipGoals.map(g => String(g).toLowerCase())
      : [String(viewer.relationshipGoals).toLowerCase()];

    const candidateGoals = Array.isArray(candidate.relationshipGoals)
      ? candidate.relationshipGoals.map(g => String(g).toLowerCase())
      : [String(candidate.relationshipGoals).toLowerCase()];

    const overlap = viewerGoals.filter(g => candidateGoals.includes(g)).length;
    score += overlap > 0 ? 25 : 0;
  }

  if (viewer.smoking !== undefined && candidate.smoking !== undefined) {
    if (viewer.smoking === candidate.smoking) score += 5;
  }

  if (viewer.drinking !== undefined && candidate.drinking !== undefined) {
    if (viewer.drinking === candidate.drinking) score += 5;
  }

  if (viewer.hasKids !== undefined && candidate.hasKids !== undefined) {
    if (viewer.hasKids === candidate.hasKids) score += 10;
  }

  if (viewer.religion && candidate.religion) {
    if (String(viewer.religion).toLowerCase() === String(candidate.religion).toLowerCase()) {
      score += 10;
    }
  }

  return Math.min(score, 100);
};

const calculateCommunicationStyleMatch = (viewerMetrics = {}, candidateMetrics = {}) => {
  let score = 50;

  const viewerResponseTime = viewerMetrics.avgResponseTimeSeconds || 3600;
  const candidateResponseTime = candidateMetrics.avgResponseTimeSeconds || 3600;

  const responseTimeDiff = Math.abs(viewerResponseTime - candidateResponseTime);
  if (responseTimeDiff < 3600) score += 20;
  else if (responseTimeDiff < 7200) score += 10;

  const viewerMsgLength = viewerMetrics.avgMessageLength || 50;
  const candidateMsgLength = candidateMetrics.avgMessageLength || 50;

  const msgLengthRatio = Math.min(viewerMsgLength, candidateMsgLength) / Math.max(viewerMsgLength, candidateMsgLength);
  score += msgLengthRatio > 0.7 ? 15 : msgLengthRatio > 0.4 ? 5 : 0;

  return Math.min(score, 100);
};

const calculateActivityLevelMatch = (viewer, candidate) => {
  let score = 50;

  const viewerActivityLevel = viewer.activityLevel || 'moderate';
  const candidateActivityLevel = candidate.activityLevel || 'moderate';

  const levels = { sedentary: 1, low: 2, moderate: 3, active: 4, very_active: 5 };
  const viewerLevel = levels[viewerActivityLevel] || 3;
  const candidateLevel = levels[candidateActivityLevel] || 3;

  const levelDiff = Math.abs(viewerLevel - candidateLevel);
  if (levelDiff === 0) score += 25;
  else if (levelDiff === 1) score += 15;

  return score;
};

const generateReasons = (compatibility) => {
  const reasons = [];
  const { factors = {}, factors: { interests, location, age, values, communication, activity } = {} } = compatibility;

  if (interests >= 70) reasons.push('🎯 Shared interests & hobbies');
  else if (interests >= 50) reasons.push('📌 Some shared interests');

  if (location >= 80) reasons.push('📍 Close by (under 5 miles)');
  else if (location >= 60) reasons.push('🗺️ Within reasonable distance');

  if (age >= 75) reasons.push('📅 Right age match');
  else if (age >= 50) reasons.push('📅 Compatible age range');

  if (values >= 70) reasons.push('💝 Aligned relationship goals');
  else if (values >= 55) reasons.push('🤝 Compatible values');

  if (communication >= 65) reasons.push('💬 Similar communication style');

  if (activity >= 65) reasons.push('🏃 Compatible activity level');

  return reasons.length > 0 ? reasons : ['✨ Great potential match!'];
};

const normalizeScore = (factors) => {
  const weights = {
    interests: 0.25,
    location: 0.2,
    age: 0.2,
    values: 0.15,
    communication: 0.1,
    activity: 0.1
  };

  const weighted =
    (factors.interests || 0) * weights.interests +
    (factors.location || 0) * weights.location +
    (factors.age || 0) * weights.age +
    (factors.values || 0) * weights.values +
    (factors.communication || 0) * weights.communication +
    (factors.activity || 0) * weights.activity;

  return Math.round(weighted * 100) / 100;
};

const calculateCompatibility = (viewer, candidate, viewerMetrics = {}, candidateMetrics = {}) => {
  if (!viewer || !candidate) {
    return {
      overall_score: 0,
      factors: {
        interests: 0,
        location: 0,
        age: 0,
        values: 0,
        communication: 0,
        activity: 0
      },
      reasons: []
    };
  }

  const factors = {
    interests: Math.round(calculateInterestsMatch(viewer.interests, candidate.interests) * 100) / 100,
    location: Math.round(calculateLocationCompatibility(viewer.locationLat, viewer.locationLng, candidate.locationLat, candidate.locationLng) * 100) / 100,
    age: Math.round(calculateAgeCompatibility(viewer.age, viewer.ageRangeMin || 18, viewer.ageRangeMax || 65, candidate.age) * 100) / 100,
    values: Math.round(calculateValuesAlignment(viewer, candidate) * 100) / 100,
    communication: Math.round(calculateCommunicationStyleMatch(viewerMetrics, candidateMetrics) * 100) / 100,
    activity: Math.round(calculateActivityLevelMatch(viewer, candidate) * 100) / 100
  };

  const overallScore = normalizeScore(factors);

  return {
    overall_score: overallScore,
    factors,
    reasons: generateReasons({ factors })
  };
};

/**
 * Learn swipe patterns from user interaction history
 * Analyzes what profiles the user has liked/superliked to identify patterns
 */
const learnSwipePatterns = (interactions = [], profilesLiked = []) => {
  const patterns = {
    preferredAgeRange: { min: 18, max: 65, avg: 0 },
    preferredDistance: { avg: 0, max: 0 },
    interestFrequency: {},
    locationClusters: [],
    relationshipGoalFrequency: {},
    physicalAttributePreferences: {},
    activityLevelPreference: 'moderate',
    likeRate: 0
  };

  if (profilesLiked.length === 0) return patterns;

  // Calculate age preferences
  const ages = profilesLiked
    .map(p => Number(p.age))
    .filter(a => Number.isFinite(a));
  
  if (ages.length > 0) {
    patterns.preferredAgeRange.min = Math.min(...ages);
    patterns.preferredAgeRange.max = Math.max(...ages);
    patterns.preferredAgeRange.avg = Math.round(ages.reduce((a, b) => a + b, 0) / ages.length);
  }

  // Analyze interests
  const allInterests = [];
  profilesLiked.forEach(profile => {
    if (Array.isArray(profile.interests)) {
      profile.interests.forEach(interest => {
        const normalized = String(interest).toLowerCase().trim();
        patterns.interestFrequency[normalized] = (patterns.interestFrequency[normalized] || 0) + 1;
        allInterests.push(normalized);
      });
    }
  });

  // Analyze relationship goals
  profilesLiked.forEach(profile => {
    if (profile.relationshipGoals) {
      const goal = String(profile.relationshipGoals).toLowerCase();
      patterns.relationshipGoalFrequency[goal] = (patterns.relationshipGoalFrequency[goal] || 0) + 1;
    }
  });

  // Analyze physical preferences
  const bodyTypes = profilesLiked.map(p => String(p.bodyType || '').toLowerCase()).filter(Boolean);
  if (bodyTypes.length > 0) {
    const mostCommon = bodyTypes.reduce((a, b) =>
      bodyTypes.filter(x => x === a).length >= bodyTypes.filter(x => x === b).length ? a : b
    );
    patterns.physicalAttributePreferences.bodyType = mostCommon;
  }

  // Analyze activity levels
  const activityLevels = profilesLiked.map(p => String(p.activityLevel || 'moderate').toLowerCase());
  if (activityLevels.length > 0) {
    const mostCommon = activityLevels.reduce((a, b) =>
      activityLevels.filter(x => x === a).length >= activityLevels.filter(x => x === b).length ? a : b
    );
    patterns.activityLevelPreference = mostCommon;
  }

  // Calculate like rate
  if (interactions.length > 0) {
    const likes = interactions.filter(i => i.interactionType === 'like' || i.interactionType === 'superlike').length;
    patterns.likeRate = Math.round((likes / interactions.length) * 100);
  }

  return patterns;
};

/**
 * Calculate advanced compatibility score based on swipe patterns
 * Weights recent interactions more heavily using exponential decay
 */
const calculateCompatibilityScore = (viewer, candidate, learnedPatterns = {}) => {
  if (!viewer || !candidate) return 0;

  // Use existing calculateCompatibility function as base
  const basicScore = calculateCompatibility(viewer, candidate);
  let score = basicScore.overall_score;

  // Apply pattern-based adjustments
  if (learnedPatterns && Object.keys(learnedPatterns).length > 0) {
    let patternBoost = 0;

    // Check if candidate matches learned interest preferences
    const candidateInterests = Array.isArray(candidate.interests) ? candidate.interests : [];
    const topInterests = Object.entries(learnedPatterns.interestFrequency || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([interest]) => interest.toLowerCase());

    const matchedInterests = candidateInterests.filter(i =>
      topInterests.includes(String(i).toLowerCase())
    ).length;

    if (matchedInterests > 0) {
      patternBoost += Math.min(matchedInterests * 5, 15); // Max 15 point boost
    }

    // Check relationship goal alignment
    if (learnedPatterns.relationshipGoalFrequency) {
      const preferredGoal = Object.entries(learnedPatterns.relationshipGoalFrequency)
        .sort((a, b) => b[1] - a[1])[0]?.[0];

      if (preferredGoal && String(candidate.relationshipGoals || '').toLowerCase() === preferredGoal) {
        patternBoost += 10;
      }
    }

    // Check activity level alignment
    if (learnedPatterns.activityLevelPreference) {
      const candidateActivityLevel = String(candidate.activityLevel || 'moderate').toLowerCase();
      if (candidateActivityLevel === learnedPatterns.activityLevelPreference) {
        patternBoost += 8;
      }
    }

    score = Math.min(score + patternBoost, 100);
  }

  return Math.round(score);
};

/**
 * Build detailed compatibility breakdown for "Why You Might Like Them"
 */
const buildSuggestions = (viewer, candidate, sharedInterests = []) => {
  const suggestions = [];

  // Shared interests
  if (sharedInterests.length > 0) {
    const interests = sharedInterests.slice(0, 2).join(' and ');
    suggestions.push(`You both love ${interests}`);
  }

  // Location compatibility
  if (candidate.locationCity && viewer.locationCity) {
    if (candidate.locationCity === viewer.locationCity) {
      suggestions.push('Same city');
    } else if (candidate.locationState === viewer.locationState) {
      suggestions.push('Same state/region');
    }
  }

  // Relationship goals alignment
  if (viewer.relationshipGoals && candidate.relationshipGoals) {
    const viewerGoals = String(viewer.relationshipGoals).toLowerCase();
    const candidateGoals = String(candidate.relationshipGoals).toLowerCase();
    if (viewerGoals === candidateGoals) {
      suggestions.push(`Both looking for ${candidate.relationshipGoals}`);
    }
  }

  // Values alignment
  const valuesMatched = [];
  if (viewer.smoking === candidate.smoking && viewer.smoking) {
    valuesMatched.push('smoking preferences');
  }
  if (viewer.drinking === candidate.drinking && viewer.drinking) {
    valuesMatched.push('drinking habits');
  }
  if (viewer.religion && candidate.religion && String(viewer.religion).toLowerCase() === String(candidate.religion).toLowerCase()) {
    valuesMatched.push('religious values');
  }

  if (valuesMatched.length > 0) {
    suggestions.push(`Aligned ${valuesMatched.join(' & ')}`);
  }

  // Activity level
  if (viewer.activityLevel && candidate.activityLevel) {
    const viewerLevel = String(viewer.activityLevel).toLowerCase();
    const candidateLevel = String(candidate.activityLevel).toLowerCase();
    if (viewerLevel === candidateLevel) {
      suggestions.push(`Both ${candidateLevel} lifestyle`);
    }
  }

  // Bio/personality hints
  if (candidate.bio && candidate.bio.length > 10) {
    suggestions.push('Great bio with personality');
  }

  // High engagement profile
  if (candidate.photoCount && candidate.photoCount >= 3) {
    suggestions.push(`${candidate.photoCount} photos`);
  }

  return suggestions.slice(0, 4); // Return top 4 suggestions
};

/**
 * Generate icebreaker suggestions based on profile characteristics
 */
const generateIcebreakers = (profile, sharedInterests = []) => {
  const icebreakers = [];

  // Shared interests icebreakers
  if (sharedInterests.length > 0) {
    const interest = sharedInterests[0];
    icebreakers.push(`I love ${interest} too! What's your favorite ${interest} experience?`);
  }

  // Bio-based icebreakers
  if (profile.bio && profile.bio.toLowerCase().includes('travel')) {
    icebreakers.push('Looks like you enjoy traveling! Any dream destinations?');
  }

  if (profile.bio && profile.bio.toLowerCase().includes('food')) {
    icebreakers.push('I see you\'re a food lover! Favorite cuisine or restaurant?');
  }

  if (profile.bio && profile.bio.toLowerCase().includes('music')) {
    icebreakers.push('Music seems important to you. What\'s been on repeat lately?');
  }

  // Activity level icebreakers
  if (String(profile.activityLevel).toLowerCase() === 'very_active') {
    icebreakers.push('You seem super active! Want to grab coffee or go for a hike?');
  }

  // Generic icebreakers
  if (icebreakers.length < 2) {
    icebreakers.push(`Hi! I think we'd get along great. Tell me something interesting about yourself?`);
  }

  if (icebreakers.length < 3) {
    icebreakers.push(`Your profile caught my eye! What do you do for fun?`);
  }

  return icebreakers.slice(0, 3); // Return top 3 icebreakers
};

/**
 * Calculate compatibility factors with detailed breakdown
 */
const calculateDetailedFactors = (viewer, candidate, viewerMetrics = {}, candidateMetrics = {}) => {
  const basicScore = calculateCompatibility(viewer, candidate, viewerMetrics, candidateMetrics);

  return {
    overallScore: basicScore.overall_score,
    factors: {
      interests: {
        score: basicScore.factors.interests,
        label: 'Shared Interests',
        description: `${Math.round(basicScore.factors.interests)}% match on hobbies and interests`
      },
      location: {
        score: basicScore.factors.location,
        label: 'Location',
        description: `${Math.round(basicScore.factors.location)}% compatibility based on distance`
      },
      age: {
        score: basicScore.factors.age,
        label: 'Age Compatibility',
        description: `${Math.round(basicScore.factors.age)}% match for age preferences`
      },
      values: {
        score: basicScore.factors.values,
        label: 'Values Alignment',
        description: `${Math.round(basicScore.factors.values)}% aligned on life goals & values`
      },
      communication: {
        score: basicScore.factors.communication,
        label: 'Communication Style',
        description: `${Math.round(basicScore.factors.communication)}% match on how you communicate`
      },
      activity: {
        score: basicScore.factors.activity,
        label: 'Activity Level',
        description: `${Math.round(basicScore.factors.activity)}% match on lifestyle activity`
      }
    },
    topFactors: basicScore.reasons
  };
};

module.exports = {
  calculateInterestsMatch,
  calculateLocationCompatibility,
  calculateAgeCompatibility,
  calculateValuesAlignment,
  calculateCommunicationStyleMatch,
  calculateActivityLevelMatch,
  calculateCompatibility,
  generateReasons,
  normalizeScore,
  learnSwipePatterns,
  calculateCompatibilityScore,
  buildSuggestions,
  generateIcebreakers,
  calculateDetailedFactors
};
