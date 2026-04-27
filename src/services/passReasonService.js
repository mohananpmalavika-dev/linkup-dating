/**
 * Pass Reason Utility Service
 * Frontend utilities for managing pass reasons in the discovery flow
 */

export const PASS_REASONS = {
  AGE: 'age',
  DISTANCE: 'distance',
  INTERESTS: 'interests',
  GOALS: 'goals',
  BODY_TYPE: 'body_type',
  HEIGHT: 'height',
  OTHER: 'other'
};

export const PASS_REASON_INFO = {
  age: {
    label: 'Age Mismatch',
    icon: '📅',
    description: 'Outside your age preferences'
  },
  distance: {
    label: 'Too Far Away',
    icon: '📍',
    description: 'Beyond your distance preferences'
  },
  interests: {
    label: 'Different Interests',
    icon: '🎯',
    description: 'Your interests don\'t align'
  },
  goals: {
    label: 'Different Goals',
    icon: '💝',
    description: 'Your relationship goals don\'t match'
  },
  body_type: {
    label: 'Body Type',
    icon: '👤',
    description: 'Doesn\'t match your preferences'
  },
  height: {
    label: 'Height',
    icon: '📏',
    description: 'Outside your height preferences'
  },
  other: {
    label: 'Other',
    icon: '✨',
    description: 'Other reason'
  }
};

/**
 * Get the primary pass reason by comparing user preferences with profile
 */
export const detectPassReason = (userPreferences, profileData) => {
  // Check age
  if (profileData.age) {
    const ageMin = userPreferences.ageMin || 18;
    const ageMax = userPreferences.ageMax || 100;
    if (profileData.age < ageMin || profileData.age > ageMax) {
      return PASS_REASONS.AGE;
    }
  }

  // Check distance
  if (profileData.location && userPreferences.location) {
    const distance = calculateDistance(
      userPreferences.location,
      profileData.location
    );
    const maxDistance = userPreferences.maxDistance || 100;
    if (distance > maxDistance) {
      return PASS_REASONS.DISTANCE;
    }
  }

  // Check interests
  if (
    userPreferences.interests?.length > 0 &&
    profileData.interests?.length > 0
  ) {
    const userInterests = userPreferences.interests.map(i =>
      String(i).toLowerCase()
    );
    const profileInterests = profileData.interests.map(i =>
      String(i).toLowerCase()
    );
    const commonCount = userInterests.filter(i =>
      profileInterests.includes(i)
    ).length;

    if (commonCount === 0) {
      return PASS_REASONS.INTERESTS;
    }
  }

  // Check relationship goals
  if (
    userPreferences.relationshipGoals &&
    profileData.relationshipGoals &&
    String(userPreferences.relationshipGoals).toLowerCase() !==
      String(profileData.relationshipGoals).toLowerCase()
  ) {
    return PASS_REASONS.GOALS;
  }

  // Check body type
  if (userPreferences.bodyTypes?.length > 0 && profileData.bodyType) {
    const bodyTypes = userPreferences.bodyTypes.map(b =>
      String(b).toLowerCase()
    );
    if (!bodyTypes.includes(String(profileData.bodyType).toLowerCase())) {
      return PASS_REASONS.BODY_TYPE;
    }
  }

  // Check height
  if (
    profileData.height &&
    userPreferences.heightMin &&
    userPreferences.heightMax
  ) {
    if (
      profileData.height < userPreferences.heightMin ||
      profileData.height > userPreferences.heightMax
    ) {
      return PASS_REASONS.HEIGHT;
    }
  }

  return PASS_REASONS.OTHER;
};

/**
 * Get multiple pass reasons (all applicable reasons)
 */
export const detectAllPassReasons = (userPreferences, profileData) => {
  const reasons = [];

  if (profileData.age) {
    const ageMin = userPreferences.ageMin || 18;
    const ageMax = userPreferences.ageMax || 100;
    if (profileData.age < ageMin || profileData.age > ageMax) {
      reasons.push(PASS_REASONS.AGE);
    }
  }

  if (profileData.location && userPreferences.location) {
    const distance = calculateDistance(
      userPreferences.location,
      profileData.location
    );
    const maxDistance = userPreferences.maxDistance || 100;
    if (distance > maxDistance) {
      reasons.push(PASS_REASONS.DISTANCE);
    }
  }

  if (
    userPreferences.interests?.length > 0 &&
    profileData.interests?.length > 0
  ) {
    const userInterests = userPreferences.interests.map(i =>
      String(i).toLowerCase()
    );
    const profileInterests = profileData.interests.map(i =>
      String(i).toLowerCase()
    );
    const commonCount = userInterests.filter(i =>
      profileInterests.includes(i)
    ).length;

    if (commonCount === 0) {
      reasons.push(PASS_REASONS.INTERESTS);
    }
  }

  if (
    userPreferences.relationshipGoals &&
    profileData.relationshipGoals &&
    String(userPreferences.relationshipGoals).toLowerCase() !==
      String(profileData.relationshipGoals).toLowerCase()
  ) {
    reasons.push(PASS_REASONS.GOALS);
  }

  if (userPreferences.bodyTypes?.length > 0 && profileData.bodyType) {
    const bodyTypes = userPreferences.bodyTypes.map(b =>
      String(b).toLowerCase()
    );
    if (!bodyTypes.includes(String(profileData.bodyType).toLowerCase())) {
      reasons.push(PASS_REASONS.BODY_TYPE);
    }
  }

  if (
    profileData.height &&
    userPreferences.heightMin &&
    userPreferences.heightMax
  ) {
    if (
      profileData.height < userPreferences.heightMin ||
      profileData.height > userPreferences.heightMax
    ) {
      reasons.push(PASS_REASONS.HEIGHT);
    }
  }

  return reasons.length > 0 ? reasons : [PASS_REASONS.OTHER];
};

/**
 * Calculate distance between two locations using Haversine formula
 * @param {Object} loc1 - { latitude, longitude }
 * @param {Object} loc2 - { latitude, longitude }
 * @returns {number} Distance in kilometers
 */
export const calculateDistance = (loc1, loc2) => {
  const R = 6371; // Earth's radius in km
  const dLat = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
  const dLon = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((loc1.latitude * Math.PI) / 180) *
      Math.cos((loc2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Get reason info for display
 */
export const getReasonInfo = (reason) => {
  return (
    PASS_REASON_INFO[reason] || {
      label: 'Other',
      icon: '✨',
      description: 'Other reason'
    }
  );
};

/**
 * Format pass reason for display
 */
export const formatPassReason = (reason) => {
  const info = getReasonInfo(reason);
  return `${info.icon} ${info.label}`;
};

/**
 * Get all valid pass reasons
 */
export const getAllPassReasons = () => {
  return Object.values(PASS_REASONS);
};

/**
 * Format time ago from timestamp
 */
export const formatTimeAgo = (timestamp) => {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now - time;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffMs / 604800000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  return time.toLocaleDateString();
};

/**
 * Group passed profiles by reason
 */
export const groupProfilesByReason = (profiles) => {
  const grouped = {};

  profiles.forEach(profile => {
    const reason = profile.passReason || PASS_REASONS.OTHER;
    if (!grouped[reason]) {
      grouped[reason] = [];
    }
    grouped[reason].push(profile);
  });

  return Object.entries(grouped)
    .map(([reason, items]) => ({
      reason,
      label: getReasonInfo(reason).label,
      icon: getReasonInfo(reason).icon,
      count: items.length,
      profiles: items
    }))
    .sort((a, b) => b.count - a.count);
};

export default {
  PASS_REASONS,
  PASS_REASON_INFO,
  detectPassReason,
  detectAllPassReasons,
  calculateDistance,
  getReasonInfo,
  formatPassReason,
  getAllPassReasons,
  formatTimeAgo,
  groupProfilesByReason
};
