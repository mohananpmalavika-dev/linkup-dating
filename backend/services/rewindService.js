/**
 * Rewind Service
 * Handles smart rewind and undo history functionality
 * Tracks passed profiles and categorizes them by reason
 */

/**
 * Categorize why a profile was passed
 * Analyzes the difference between user preferences and candidate profile
 */
const categorizePassReason = (userProfile, candidateProfile, userPreferences) => {
  const reasons = [];

  // Age mismatch
  if (candidateProfile.age) {
    const ageMin = userPreferences?.ageRangeMin || 18;
    const ageMax = userPreferences?.ageRangeMax || 65;
    if (candidateProfile.age < ageMin || candidateProfile.age > ageMax) {
      reasons.push('age');
    }
  }

  // Location/distance too far
  if (candidateProfile.locationLat && candidateProfile.locationLng && userProfile.locationLat && userProfile.locationLng) {
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

    const distance = haversineDistance(
      userProfile.locationLat,
      userProfile.locationLng,
      candidateProfile.locationLat,
      candidateProfile.locationLng
    );

    const maxDistance = userPreferences?.locationRadius || 100;
    if (distance > maxDistance) {
      reasons.push('distance');
    }
  }

  // Interests don't match
  if (userPreferences?.interests && candidateProfile.interests) {
    const userInterests = Array.isArray(userPreferences.interests)
      ? userPreferences.interests.map(i => String(i).toLowerCase())
      : [];
    const candidateInterests = Array.isArray(candidateProfile.interests)
      ? candidateProfile.interests.map(i => String(i).toLowerCase())
      : [];

    const sharedCount = userInterests.filter(i => candidateInterests.includes(i)).length;
    if (userInterests.length > 0 && sharedCount === 0) {
      reasons.push('interests');
    }
  }

  // Relationship goals mismatch
  if (userPreferences?.relationshipGoals && candidateProfile.relationshipGoals) {
    const userGoals = String(userPreferences.relationshipGoals).toLowerCase();
    const candidateGoals = String(candidateProfile.relationshipGoals).toLowerCase();
    if (userGoals !== candidateGoals) {
      reasons.push('goals');
    }
  }

  // Body type preference
  if (userPreferences?.bodyTypes && candidateProfile.bodyType) {
    const bodyTypes = Array.isArray(userPreferences.bodyTypes)
      ? userPreferences.bodyTypes.map(b => String(b).toLowerCase())
      : [];
    if (bodyTypes.length > 0 && !bodyTypes.includes(String(candidateProfile.bodyType).toLowerCase())) {
      reasons.push('body_type');
    }
  }

  // Height preference
  if (candidateProfile.height && userPreferences?.heightRangeMin && userPreferences?.heightRangeMax) {
    if (candidateProfile.height < userPreferences.heightRangeMin || candidateProfile.height > userPreferences.heightRangeMax) {
      reasons.push('height');
    }
  }

  // If multiple reasons, prioritize the most important ones
  if (reasons.length === 0) {
    reasons.push('other');
  }

  // Return primary reason (most significant)
  return {
    primary: reasons[0],
    all: reasons,
    label: getReasonLabel(reasons[0])
  };
};

/**
 * Get human-readable label for pass reason
 */
const getReasonLabel = (reason) => {
  const labels = {
    age: '📅 Age Mismatch',
    distance: '📍 Too Far Away',
    interests: '🎯 Different Interests',
    goals: '💝 Different Goals',
    body_type: '👤 Body Type',
    height: '📏 Height',
    other: '✨ Other'
  };
  return labels[reason] || labels.other;
};

/**
 * Get icon emoji for pass reason
 */
const getReasonIcon = (reason) => {
  const icons = {
    age: '📅',
    distance: '📍',
    interests: '🎯',
    goals: '💝',
    body_type: '👤',
    height: '📏',
    other: '✨'
  };
  return icons[reason] || icons.other;
};

/**
 * Format undo history item
 */
const formatUndoHistoryItem = (profile, passTimestamp, reason) => {
  const now = new Date();
  const passTime = new Date(passTimestamp);
  const hoursAgo = Math.floor((now - passTime) / (1000 * 60 * 60));
  const daysAgo = Math.floor((now - passTime) / (1000 * 60 * 60 * 24));

  let timeLabel = 'Just now';
  if (hoursAgo > 0 && hoursAgo < 24) {
    timeLabel = `${hoursAgo}h ago`;
  } else if (daysAgo > 0 && daysAgo < 7) {
    timeLabel = `${daysAgo}d ago`;
  } else if (daysAgo >= 7) {
    timeLabel = `${Math.floor(daysAgo / 7)}w ago`;
  }

  return {
    profileId: profile.userId,
    name: profile.firstName,
    age: profile.age,
    location: `${profile.location?.city || '?'}, ${profile.location?.state || ''}`,
    photo: profile.photos?.[0]?.photo_url,
    passedAt: passTimestamp,
    timeAgo: timeLabel,
    reason: reason.primary,
    reasonLabel: reason.label,
    reasonIcon: getReasonIcon(reason.primary),
    allReasons: reason.all
  };
};

/**
 * Group undo history by reason
 */
const groupByReason = (historyItems) => {
  const grouped = {
    age: [],
    distance: [],
    interests: [],
    goals: [],
    body_type: [],
    height: [],
    other: []
  };

  historyItems.forEach(item => {
    const reason = item.reason || 'other';
    if (grouped[reason]) {
      grouped[reason].push(item);
    } else {
      grouped[reason].push(item);
    }
  });

  // Return non-empty groups with labels
  return Object.entries(grouped)
    .filter(([_, items]) => items.length > 0)
    .map(([reason, items]) => ({
      reason,
      label: getReasonLabel(reason),
      icon: getReasonIcon(reason),
      count: items.length,
      profiles: items
    }));
};

/**
 * Check if user can rewind (based on premium status)
 */
const canUserRewind = (subscriptionAccess, rewindsSentToday) => {
  const isPremium = subscriptionAccess.isPremium || subscriptionAccess.isGold;
  const rewindLimit = isPremium ? Infinity : 3; // Premium: unlimited, Free: 3/day

  return {
    canRewind: rewindsSentToday < rewindLimit,
    rewindLimit,
    rewindsSent: rewindsSentToday,
    rewindsRemaining: isPremium ? 'Unlimited' : Math.max(0, rewindLimit - rewindsSentToday),
    isPremium
  };
};

/**
 * Get pass reason message for user
 */
const getPassReasonMessage = (reason) => {
  const messages = {
    age: 'You passed because they were outside your age preferences',
    distance: 'You passed because they were too far away',
    interests: "You passed because your interests didn't align",
    goals: "You passed because your relationship goals didn't match",
    body_type: 'You passed because of body type preferences',
    height: 'You passed because of height preferences',
    other: 'You passed on this profile'
  };
  return messages[reason.primary] || messages.other;
};

/**
 * Calculate rewind availability based on subscription
 */
const getRewindAvailability = (isPremium, rewindsUsedToday) => {
  const dailyLimit = isPremium ? 999 : 3; // Premium: effectively unlimited
  const remaining = Math.max(0, dailyLimit - rewindsUsedToday);
  
  return {
    isPremium,
    dailyLimit,
    usedToday: rewindsUsedToday,
    remainingToday: remaining,
    canRewind: remaining > 0,
    message: isPremium ? 'Unlimited rewinds' : `${remaining} rewinds remaining today`
  };
};

/**
 * Get passed profiles history (past 7 days)
 * Returns array with profile info and pass reason
 */
const getPassedProfilesHistory = (decisions) => {
  // Filter for pass decisions only in past 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  return decisions
    .filter(d => d.decision_type === 'pass' && new Date(d.decision_timestamp) > sevenDaysAgo)
    .sort((a, b) => new Date(b.decision_timestamp) - new Date(a.decision_timestamp))
    .map(d => ({
      profileId: d.profile_user_id,
      passedAt: d.decision_timestamp,
      reason: d.pass_reason,
      reasonJson: d.pass_reasons_json,
      profile: d.profile // Expects profile to be joined
    }));
};

/**
 * Group passed profiles by reason with counts
 */
const groupPassedByReason = (passedProfiles) => {
  const reasonGroups = {
    age: [],
    distance: [],
    interests: [],
    goals: [],
    body_type: [],
    height: [],
    other: []
  };

  passedProfiles.forEach(item => {
    const reason = item.reason || 'other';
    if (reasonGroups[reason]) {
      reasonGroups[reason].push(item);
    } else {
      reasonGroups[reason].push(item);
    }
  });

  // Transform to response format with totals
  return Object.entries(reasonGroups)
    .filter(([_, profiles]) => profiles.length > 0)
    .map(([reason, profiles]) => ({
      reason,
      label: getReasonLabel(reason),
      icon: getReasonIcon(reason),
      count: profiles.length,
      profiles: profiles.map(p => ({
        profileId: p.profileId,
        passedAt: p.passedAt,
        profile: p.profile
      }))
    }))
    .sort((a, b) => b.count - a.count);
};

/**
 * Record rewind usage for quota tracking
 */
const recordRewindUsage = (rewindDetail) => {
  return {
    profile_id: rewindDetail.profileId,
    timestamp: new Date(),
    reason: rewindDetail.reason,
    restored_at: new Date()
  };
};

module.exports = {
  categorizePassReason,
  formatUndoHistoryItem,
  groupByReason,
  canUserRewind,
  getPassReasonMessage,
  getReasonLabel,
  getReasonIcon,
  getRewindAvailability,
  getPassedProfilesHistory,
  groupPassedByReason,
  recordRewindUsage
};
