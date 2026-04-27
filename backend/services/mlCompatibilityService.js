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

module.exports = {
  calculateInterestsMatch,
  calculateLocationCompatibility,
  calculateAgeCompatibility,
  calculateValuesAlignment,
  calculateCommunicationStyleMatch,
  calculateActivityLevelMatch,
  calculateCompatibility,
  generateReasons,
  normalizeScore
};
