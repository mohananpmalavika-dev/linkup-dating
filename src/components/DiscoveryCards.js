import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../styles/DiscoveryCards.css';
import datingProfileService from '../services/datingProfileService';

const DEFAULT_FILTERS = {
  ageMin: '',
  ageMax: '',
  distance: '',
  gender: '',
  relationshipGoals: '',
  interests: '',
  heightRangeMin: '',
  heightRangeMax: '',
  bodyTypes: ''
};

const BODY_TYPE_OPTIONS = ['Slim', 'Average', 'Athletic', 'Curvy', 'Muscular', 'Heavyset'];
const INTEREST_OPTIONS = ['Travel', 'Fitness', 'Music', 'Art', 'Cooking', 'Gaming', 'Sports', 'Hiking', 'Photography', 'Reading', 'Movies', 'Yoga'];
const DISCOVERY_HUB_TABS = [
  { key: 'smartQueue', label: 'For You' },
  { key: 'topPicks', label: 'Top Picks' },
  { key: 'trending', label: 'Trending' },
  { key: 'newProfiles', label: 'New' },
  { key: 'presets', label: 'Presets' }
];
const PRESET_NAME_SUGGESTIONS = ['Nearby', 'Serious', 'Creative', 'Weekend vibe'];

const buildDiscoveryFilters = (filters) => {
  const params = {};
  if (filters.ageMin !== '') params.ageMin = Number(filters.ageMin);
  if (filters.ageMax !== '') params.ageMax = Number(filters.ageMax);
  if (filters.distance !== '') params.distance = Number(filters.distance);
  if (filters.gender) params.gender = filters.gender;
  if (filters.relationshipGoals.trim()) params.relationshipGoals = filters.relationshipGoals.trim();
  if (filters.interests.trim()) params.interests = filters.interests.split(',').map((interest) => interest.trim()).filter(Boolean).join(', ');
  if (filters.heightRangeMin !== '') params.heightRangeMin = Number(filters.heightRangeMin);
  if (filters.heightRangeMax !== '') params.heightRangeMax = Number(filters.heightRangeMax);
  if (filters.bodyTypes.trim()) params.bodyTypes = filters.bodyTypes.split(',').map((bodyType) => bodyType.trim()).filter(Boolean).join(', ');
  return params;
};

const normalizePresetValue = (value) => {
  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (value === undefined || value === null) {
    return '';
  }

  return String(value);
};

const normalizeFiltersFromPreset = (filters = {}) => ({
  ageMin: filters.ageMin ?? filters.ageRange?.min ?? '',
  ageMax: filters.ageMax ?? filters.ageRange?.max ?? '',
  distance: filters.distance ?? filters.radiusKm ?? '',
  gender: Array.isArray(filters.gender) ? filters.gender[0] || '' : filters.gender || '',
  relationshipGoals: Array.isArray(filters.relationshipGoals)
    ? filters.relationshipGoals[0] || ''
    : filters.relationshipGoals || '',
  interests: normalizePresetValue(filters.interests),
  heightRangeMin: filters.heightRangeMin ?? filters.heightRange?.min ?? '',
  heightRangeMax: filters.heightRangeMax ?? filters.heightRange?.max ?? '',
  bodyTypes: normalizePresetValue(filters.bodyTypes)
});

const formatPresetSummary = (filters = {}) => {
  const normalized = normalizeFiltersFromPreset(filters);
  const summary = [];

  if (normalized.distance) summary.push(`${normalized.distance} km`);
  if (normalized.ageMin || normalized.ageMax) {
    summary.push(`Age ${normalized.ageMin || 18}-${normalized.ageMax || 99}`);
  }
  if (normalized.relationshipGoals) summary.push(normalized.relationshipGoals);
  if (normalized.interests) summary.push(normalized.interests.split(',').slice(0, 2).join(', '));

  return summary.length > 0 ? summary.join(' | ') : 'General discovery mix';
};

const getActivityHint = (lastActive) => {
  if (!lastActive) {
    return null;
  }

  const elapsedMinutes = Math.floor((Date.now() - new Date(lastActive).getTime()) / 60000);

  if (elapsedMinutes <= 5) {
    return { label: 'Online now', tone: 'online' };
  }

  if (elapsedMinutes <= 60 * 24) {
    return { label: 'Active recently', tone: 'recent' };
  }

  if (elapsedMinutes <= 60 * 24 * 7) {
    return { label: 'Active this week', tone: 'week' };
  }

  return null;
};

const buildRecommendationReasons = (profile) => {
  if (!profile) {
    return [];
  }

  const reasons = [];
  const activityHint = getActivityHint(profile.lastActive);

  if (Array.isArray(profile.compatibilityReasons)) {
    reasons.push(...profile.compatibilityReasons);
  }

  if ((profile.compatibilityScore || 0) >= 80) {
    reasons.push('High compatibility fit');
  }

  if (profile.distanceKm !== undefined && profile.distanceKm !== null) {
    reasons.push(`Close by at ${profile.distanceKm} km`);
  }

  if (profile.relationshipGoals) {
    reasons.push(`Looking for ${profile.relationshipGoals}`);
  }

  if (activityHint) {
    reasons.push(activityHint.label);
  }

  return reasons.filter((reason, index, list) => reason && list.indexOf(reason) === index).slice(0, 4);
};

const getModeSummary = (tabKey, presetCount, activeFilterCount) => {
  switch (tabKey) {
    case 'topPicks':
      return {
        title: 'Top Picks',
        subtitle: 'Highest-confidence profiles based on your compatibility data.'
      };
    case 'trending':
      return {
        title: 'Trending',
        subtitle: 'Popular profiles getting strong engagement right now.'
      };
    case 'newProfiles':
      return {
        title: 'New',
        subtitle: 'Fresh arrivals so you can meet people before the crowd does.'
      };
    case 'presets':
      return {
        title: 'Presets',
        subtitle: presetCount > 0
          ? `You have ${presetCount} saved filter preset${presetCount === 1 ? '' : 's'} ready to reapply.`
          : 'Save your favorite discovery setups for one-tap reuse.'
      };
    case 'smartQueue':
    default:
      return {
        title: 'For You',
        subtitle: activeFilterCount > 0
          ? 'Your active filters are shaping this stack right now.'
          : 'A tailored mix balancing compatibility, freshness, and activity.'
      };
  }
};

const DiscoveryCards = ({ onMatch, onProfileView }) => {
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [noMoreProfiles, setNoMoreProfiles] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [favoriteUserIds, setFavoriteUserIds] = useState(new Set());
  const [remainingLikes, setRemainingLikes] = useState(50);
  const [remainingSuperlikes, setRemainingSuperlikes] = useState(1);
  const [remainingRewinds, setRemainingRewinds] = useState(3);
  const [discoveryMode, setDiscoveryMode] = useState('smartQueue');
  const [activeHubTab, setActiveHubTab] = useState('smartQueue');
  const [subscription, setSubscription] = useState(null);
  const [boosting, setBoosting] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const [filterPresets, setFilterPresets] = useState([]);
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [savingPreset, setSavingPreset] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const loadMoreTriggered = useRef(false);
  const feedbackTimeoutRef = useRef(null);

  const activeFilterCount = useMemo(
    () => Object.values(appliedFilters).filter((value) => String(value).trim() !== '').length,
    [appliedFilters]
  );
  const modeSummary = useMemo(
    () => getModeSummary(activeHubTab, filterPresets.length, activeFilterCount),
    [activeHubTab, filterPresets.length, activeFilterCount]
  );

  const showFeedback = useCallback((type, message) => {
    if (feedbackTimeoutRef.current) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }

    setFeedback({ type, message });

    if (type !== 'error') {
      feedbackTimeoutRef.current = window.setTimeout(() => {
        setFeedback(null);
      }, 3500);
    }
  }, []);

  useEffect(() => {
    loadSmartQueue();
    loadDailyLimits();
    loadFilterPresets();
  }, []);

  useEffect(() => {
    datingProfileService
      .getFavorites()
      .then((data) => setFavoriteUserIds(new Set((data.favorites || []).map((favorite) => String(favorite.userId)))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setShowScoreBreakdown(false);
  }, [profiles, currentIndex]);

  useEffect(() => () => {
    if (feedbackTimeoutRef.current) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }
  }, []);

  const loadFilterPresets = async () => {
    try {
      setLoadingPresets(true);
      const data = await datingProfileService.getFilterPresets();
      setFilterPresets(Array.isArray(data.presets) ? data.presets : []);
    } catch (loadError) {
      console.error(loadError);
    } finally {
      setLoadingPresets(false);
    }
  };

  const loadProfiles = async (nextFilters = appliedFilters, cursor = null) => {
    if (cursor) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setProfiles([]);
      setCurrentIndex(0);
      loadMoreTriggered.current = false;
    }

    setError('');

    try {
      const params = { ...buildDiscoveryFilters(nextFilters), cursor, limit: 20 };
      const data = await datingProfileService.getDiscoveryProfiles(params);
      const newProfiles = data.profiles || [];

      if (cursor) {
        setProfiles((currentProfiles) => [...currentProfiles, ...newProfiles]);
      } else {
        setProfiles(newProfiles);
        setCurrentIndex(0);
      }

      setNoMoreProfiles(!data.hasMore && newProfiles.length === 0);
      setNextCursor(data.nextCursor || null);
      setDiscoveryMode('regular');
    } catch (loadError) {
      setError('Failed to load profiles. Please try again.');
      console.error(loadError);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadDailyLimits = async () => {
    try {
      const [limitsData, subscriptionData] = await Promise.all([
        datingProfileService.getDailyLimits().catch(() => ({})),
        datingProfileService.getMySubscription().catch(() => ({ plan: 'free', isPremium: false }))
      ]);

      setRemainingLikes(limitsData.remainingLikes ?? 50);
      setRemainingSuperlikes(limitsData.remainingSuperlikes ?? 1);
      setRemainingRewinds(limitsData.remainingRewinds ?? 3);
      setSubscription(subscriptionData);
    } catch (loadError) {
      console.error(loadError);
    }
  };

  const handleBoost = async () => {
    setBoosting(true);
    setError('');

    try {
      const response = await datingProfileService.boostProfile();
      showFeedback('success', response.message || 'Your profile is boosted.');
    } catch (boostError) {
      showFeedback('error', boostError || 'Boost requires Premium');
    } finally {
      setBoosting(false);
    }
  };

  const loadTopPicks = async () => {
    setLoading(true);
    setProfiles([]);
    setCurrentIndex(0);
    setError('');
    loadMoreTriggered.current = false;

    try {
      const data = await datingProfileService.getTopPicks(20);
      setProfiles(data.profiles || []);
      setNoMoreProfiles((data.profiles || []).length === 0);
      setDiscoveryMode('topPicks');
      setNextCursor(null);
    } catch (loadError) {
      setError('Failed to load top picks.');
      console.error(loadError);
    } finally {
      setLoading(false);
    }
  };

  const loadSmartQueue = async (cursor = null) => {
    if (cursor) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError('');
      setProfiles([]);
      setCurrentIndex(0);
      loadMoreTriggered.current = false;
    }

    try {
      const data = await datingProfileService.getDiscoveryQueue(cursor ? { cursor, limit: 20 } : { limit: 20 });
      const newProfiles = data.profiles || [];

      if (cursor) {
        setProfiles((currentProfiles) => [...currentProfiles, ...newProfiles]);
      } else {
        setProfiles(newProfiles);
        setCurrentIndex(0);
      }

      setNoMoreProfiles(!data.hasMore && newProfiles.length === 0);
      setNextCursor(data.nextCursor || null);
      setDiscoveryMode('smartQueue');
    } catch (loadError) {
      setError('Failed to load your personalized queue.');
      console.error(loadError);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadTrending = async (cursor = null) => {
    if (cursor) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError('');
      setProfiles([]);
      setCurrentIndex(0);
      loadMoreTriggered.current = false;
    }

    try {
      const data = await datingProfileService.getTrendingProfiles(cursor ? { cursor, limit: 20 } : { limit: 20 });
      const newProfiles = data.profiles || [];

      if (cursor) {
        setProfiles((currentProfiles) => [...currentProfiles, ...newProfiles]);
      } else {
        setProfiles(newProfiles);
        setCurrentIndex(0);
      }

      setNoMoreProfiles(!data.hasMore && newProfiles.length === 0);
      setNextCursor(data.nextCursor || null);
      setDiscoveryMode('trending');
    } catch (loadError) {
      setError('Failed to load trending profiles.');
      console.error(loadError);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadNewProfiles = async (cursor = null) => {
    if (cursor) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError('');
      setProfiles([]);
      setCurrentIndex(0);
      loadMoreTriggered.current = false;
    }

    try {
      const data = await datingProfileService.getNewProfiles(cursor ? { cursor, limit: 20 } : { limit: 20 });
      const newProfiles = data.profiles || [];

      if (cursor) {
        setProfiles((currentProfiles) => [...currentProfiles, ...newProfiles]);
      } else {
        setProfiles(newProfiles);
        setCurrentIndex(0);
      }

      setNoMoreProfiles(!data.hasMore && newProfiles.length === 0);
      setNextCursor(data.nextCursor || null);
      setDiscoveryMode('newProfiles');
    } catch (loadError) {
      setError('Failed to load new profiles.');
      console.error(loadError);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleRewind = async () => {
    if (remainingRewinds <= 0) {
      return;
    }

    try {
      const response = await datingProfileService.rewindPass();
      setRemainingRewinds(response.rewindsRemaining ?? 0);

      if (response.restoredProfile) {
        setProfiles((currentProfiles) => [response.restoredProfile, ...currentProfiles]);
        setCurrentIndex(0);
        setNoMoreProfiles(false);
        showFeedback('success', 'Your last pass is back in the stack.');
      }
    } catch (rewindError) {
      showFeedback('error', 'Failed to rewind your last pass.');
      console.error(rewindError);
    }
  };

  const selectHubTab = (tabKey) => {
    if (tabKey === activeHubTab && tabKey !== 'presets') {
      return;
    }

    setActiveHubTab(tabKey);
    setShowFilters(false);

    if (tabKey === 'presets') {
      return;
    }

    if (tabKey === 'smartQueue') {
      loadSmartQueue();
      return;
    }

    if (tabKey === 'topPicks') {
      loadTopPicks();
      return;
    }

    if (tabKey === 'trending') {
      loadTrending();
      return;
    }

    if (tabKey === 'newProfiles') {
      loadNewProfiles();
    }
  };

  const getCurrentProfile = () => profiles[currentIndex];

  const handleLike = async () => {
    const profile = getCurrentProfile();
    if (!profile) return;

    if (remainingLikes <= 0) {
      showFeedback('error', 'Daily like limit reached.');
      return;
    }

    try {
      const response = await datingProfileService.likeProfile(profile.userId);
      setRemainingLikes((currentLikes) => Math.max(0, currentLikes - 1));

      if (response.isMatch) {
        onMatch?.({ ...profile, matchId: response.match?.id || null });
      }

      moveToNextCard();
    } catch (likeError) {
      showFeedback('error', 'Failed to like this profile.');
      console.error(likeError);
    }
  };

  const handleSuperlike = async () => {
    const profile = getCurrentProfile();
    if (!profile) return;

    if (remainingSuperlikes <= 0) {
      showFeedback('error', 'Daily superlike limit reached.');
      return;
    }

    try {
      const response = await datingProfileService.superlikeProfile(profile.userId);
      setRemainingSuperlikes((currentSuperlikes) => Math.max(0, currentSuperlikes - 1));

      if (response.isMatch) {
        onMatch?.({
          ...profile,
          matchId: response.match?.id || null,
          superlike: true
        });
      }

      moveToNextCard();
    } catch (superlikeError) {
      showFeedback('error', 'Failed to superlike this profile.');
      console.error(superlikeError);
    }
  };

  const handlePass = async () => {
    const profile = getCurrentProfile();
    if (!profile) return;

    try {
      await datingProfileService.passProfile(profile.userId);
      moveToNextCard();
    } catch (passError) {
      showFeedback('error', 'Failed to pass this profile.');
      console.error(passError);
    }
  };

  const handleToggleFavorite = async () => {
    const profile = getCurrentProfile();
    if (!profile?.userId) return;

    const userId = String(profile.userId);
    const nextFavorites = new Set(favoriteUserIds);

    try {
      if (nextFavorites.has(userId)) {
        await datingProfileService.removeFavorite(profile.userId);
        nextFavorites.delete(userId);
        showFeedback('success', `${profile.firstName} removed from favorites.`);
      } else {
        await datingProfileService.favoriteProfile(profile.userId);
        nextFavorites.add(userId);
        showFeedback('success', `${profile.firstName} saved to favorites.`);
      }

      setFavoriteUserIds(nextFavorites);
    } catch (favoriteError) {
      showFeedback('error', 'Failed to update favorites.');
      console.error(favoriteError);
    }
  };

  const moveToNextCard = () => {
    if (currentIndex < profiles.length - 1) {
      setCurrentIndex((index) => index + 1);
      return;
    }

    setNoMoreProfiles(true);

    if (nextCursor && !loadMoreTriggered.current) {
      loadMoreTriggered.current = true;

      if (discoveryMode === 'smartQueue') loadSmartQueue(nextCursor);
      else if (discoveryMode === 'trending') loadTrending(nextCursor);
      else if (discoveryMode === 'newProfiles') loadNewProfiles(nextCursor);
      else if (discoveryMode === 'regular') loadProfiles(appliedFilters, nextCursor);
    }
  };

  const reloadProfiles = () => {
    setCurrentIndex(0);
    setNoMoreProfiles(false);
    loadMoreTriggered.current = false;

    if (discoveryMode === 'smartQueue') loadSmartQueue();
    else if (discoveryMode === 'trending') loadTrending();
    else if (discoveryMode === 'newProfiles') loadNewProfiles();
    else if (discoveryMode === 'topPicks') loadTopPicks();
    else loadProfiles(appliedFilters);
  };

  const handleFilterChange = (field, value) => {
    setFilters((currentFilters) => ({ ...currentFilters, [field]: value }));
  };

  const toggleInterest = (interest) => {
    setFilters((currentFilters) => {
      const interests = currentFilters.interests.split(',').map((value) => value.trim()).filter(Boolean);
      const nextInterests = interests.includes(interest)
        ? interests.filter((value) => value !== interest)
        : [...interests, interest];

      return { ...currentFilters, interests: nextInterests.join(', ') };
    });
  };

  const toggleBodyType = (bodyType) => {
    setFilters((currentFilters) => {
      const bodyTypes = currentFilters.bodyTypes.split(',').map((value) => value.trim()).filter(Boolean);
      const nextBodyTypes = bodyTypes.includes(bodyType)
        ? bodyTypes.filter((value) => value !== bodyType)
        : [...bodyTypes, bodyType];

      return { ...currentFilters, bodyTypes: nextBodyTypes.join(', ') };
    });
  };

  const handleApplyFilters = async (event) => {
    event.preventDefault();

    const nextFilters = {
      ageMin: filters.ageMin,
      ageMax: filters.ageMax,
      distance: filters.distance,
      gender: filters.gender,
      relationshipGoals: filters.relationshipGoals,
      interests: filters.interests,
      heightRangeMin: filters.heightRangeMin,
      heightRangeMax: filters.heightRangeMax,
      bodyTypes: filters.bodyTypes
    };

    setAppliedFilters(nextFilters);
    setActiveHubTab('presets');
    setShowFilters(false);
    setNextCursor(null);
    loadMoreTriggered.current = false;
    await loadProfiles(nextFilters);
    showFeedback('success', 'Discovery filters applied.');
  };

  const handleResetFilters = async () => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setActiveHubTab('smartQueue');
    setShowFilters(false);
    setNextCursor(null);
    loadMoreTriggered.current = false;
    await loadSmartQueue();
    showFeedback('success', 'Filters reset. Back to your For You queue.');
  };

  const handleSavePreset = async (suggestedName = '') => {
    const name = (suggestedName || presetName).trim();
    const filtersToSave = activeFilterCount > 0 ? appliedFilters : filters;
    const serializedFilters = buildDiscoveryFilters(filtersToSave);

    if (!name) {
      showFeedback('error', 'Add a preset name before saving.');
      return;
    }

    if (Object.keys(serializedFilters).length === 0) {
      showFeedback('error', 'Set at least one filter before saving a preset.');
      return;
    }

    try {
      setSavingPreset(true);
      await datingProfileService.saveFilterPreset(name, serializedFilters);
      setPresetName('');
      await loadFilterPresets();
      showFeedback('success', `"${name}" is ready to reuse.`);
    } catch (saveError) {
      showFeedback('error', saveError || 'Failed to save this preset.');
    } finally {
      setSavingPreset(false);
    }
  };

  const handleApplyPreset = async (preset) => {
    try {
      const response = await datingProfileService.applyFilterPreset(preset.id);
      const normalizedFilters = normalizeFiltersFromPreset(response.filters || preset.filters || {});

      setFilters(normalizedFilters);
      setAppliedFilters(normalizedFilters);
      setActiveHubTab('presets');
      setShowFilters(false);
      setNextCursor(null);
      loadMoreTriggered.current = false;
      await loadProfiles(normalizedFilters);
      showFeedback('success', `"${preset.preset_name || preset.presetName}" applied.`);
    } catch (applyError) {
      showFeedback('error', applyError || 'Failed to apply this preset.');
    }
  };

  const handleDeletePreset = async (presetId) => {
    try {
      await datingProfileService.deleteFilterPreset(presetId);
      setFilterPresets((currentPresets) => currentPresets.filter((preset) => preset.id !== presetId));
      showFeedback('success', 'Preset removed.');
    } catch (deleteError) {
      showFeedback('error', deleteError || 'Failed to delete this preset.');
    }
  };

  const currentProfile = getCurrentProfile();

  if (loading) {
    return (
      <div className="discovery-container loading">
        <div className="spinner"></div>
        <p>Finding profiles for you...</p>
      </div>
    );
  }

  if (error && profiles.length === 0) {
    return (
      <div className="discovery-container error">
        <p className="error-message">{error}</p>
        <button onClick={reloadProfiles} className="btn-retry">Retry</button>
      </div>
    );
  }

  const scoreBreakdown = currentProfile?.scoreBreakdown;
  const activityHint = getActivityHint(currentProfile?.lastActive);
  const recommendationReasons = buildRecommendationReasons(currentProfile);
  const isFavorite = currentProfile?.userId ? favoriteUserIds.has(String(currentProfile.userId)) : false;

  const renderFilterPanel = () => (
    <form className="filter-panel" onSubmit={handleApplyFilters}>
      <div className="filter-panel-header">
        <div>
          <h3>Discovery preferences</h3>
          <p>Refine who shows up in your stack, then save your best combinations.</p>
        </div>
        <button type="button" className="btn-filter-close" onClick={() => setShowFilters(false)}>
          Close
        </button>
      </div>

      <div className="filter-grid">
        <label className="filter-field">
          <span>Age from</span>
          <input type="number" min="18" max="99" value={filters.ageMin} onChange={(event) => handleFilterChange('ageMin', event.target.value)} placeholder="Any" />
        </label>
        <label className="filter-field">
          <span>Age to</span>
          <input type="number" min="18" max="99" value={filters.ageMax} onChange={(event) => handleFilterChange('ageMax', event.target.value)} placeholder="Any" />
        </label>
        <label className="filter-field">
          <span>Distance (km)</span>
          <input type="number" min="1" max="500" value={filters.distance} onChange={(event) => handleFilterChange('distance', event.target.value)} placeholder="Any" />
        </label>
        <label className="filter-field">
          <span>Gender</span>
          <select value={filters.gender} onChange={(event) => handleFilterChange('gender', event.target.value)}>
            <option value="">Any</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="non-binary">Non-binary</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="filter-field">
          <span>Relationship goal</span>
          <select value={filters.relationshipGoals} onChange={(event) => handleFilterChange('relationshipGoals', event.target.value)}>
            <option value="">Any</option>
            <option value="serious">Serious</option>
            <option value="casual">Casual</option>
            <option value="friendship">Friendship</option>
            <option value="marriage">Marriage</option>
          </select>
        </label>
        <label className="filter-field">
          <span>Height from (cm)</span>
          <input type="number" min="130" max="230" value={filters.heightRangeMin} onChange={(event) => handleFilterChange('heightRangeMin', event.target.value)} placeholder="Any" />
        </label>
        <label className="filter-field">
          <span>Height to (cm)</span>
          <input type="number" min="130" max="230" value={filters.heightRangeMax} onChange={(event) => handleFilterChange('heightRangeMax', event.target.value)} placeholder="Any" />
        </label>
        <label className="filter-field filter-field-full">
          <span>Body types</span>
          <div className="chip-group">
            {BODY_TYPE_OPTIONS.map((bodyType) => (
              <button
                key={bodyType}
                type="button"
                className={`chip ${filters.bodyTypes.includes(bodyType) ? 'active' : ''}`}
                onClick={() => toggleBodyType(bodyType)}
              >
                {bodyType}
              </button>
            ))}
          </div>
        </label>
        <label className="filter-field filter-field-full">
          <span>Interests</span>
          <div className="chip-group">
            {INTEREST_OPTIONS.map((interest) => (
              <button
                key={interest}
                type="button"
                className={`chip ${filters.interests.includes(interest) ? 'active' : ''}`}
                onClick={() => toggleInterest(interest)}
              >
                {interest}
              </button>
            ))}
          </div>
        </label>
      </div>

      <div className="preset-save-row">
        <div className="preset-save-copy">
          <strong>Save this setup</strong>
          <span>Great for one-tap moods like Nearby, Serious, or Weekend vibe.</span>
        </div>
        <div className="preset-save-form">
          <input
            type="text"
            value={presetName}
            onChange={(event) => setPresetName(event.target.value)}
            placeholder="Name this preset"
            maxLength={100}
          />
          <button type="button" className="btn-filter-secondary" onClick={() => handleSavePreset()} disabled={savingPreset}>
            {savingPreset ? 'Saving...' : 'Save preset'}
          </button>
        </div>
        <div className="preset-suggestion-row">
          {PRESET_NAME_SUGGESTIONS.map((name) => (
            <button key={name} type="button" className="preset-suggestion-chip" onClick={() => handleSavePreset(name)} disabled={savingPreset}>
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-actions">
        <button type="button" className="btn-filter-secondary" onClick={handleResetFilters}>Reset</button>
        <button type="submit" className="btn-filter-primary">Apply filters</button>
      </div>
    </form>
  );

  const renderPresetPanel = () => (
    <div className="preset-panel">
      <div className="preset-panel-header">
        <div>
          <h3>Saved presets</h3>
          <p>Quick-apply the setups that match your current dating mood.</p>
        </div>
        <button type="button" className="btn-filter-close" onClick={() => setShowFilters((current) => !current)}>
          {showFilters ? 'Hide filters' : 'Edit filters'}
        </button>
      </div>

      {loadingPresets ? (
        <p className="preset-empty-state">Loading your saved presets...</p>
      ) : filterPresets.length > 0 ? (
        <div className="preset-grid">
          {filterPresets.map((preset) => (
            <div key={preset.id} className="preset-card">
              <div className="preset-card-copy">
                <strong>{preset.preset_name || preset.presetName}</strong>
                <span>{formatPresetSummary(preset.filters)}</span>
              </div>
              <div className="preset-card-actions">
                <button type="button" className="preset-action-btn primary" onClick={() => handleApplyPreset(preset)}>
                  Apply
                </button>
                <button type="button" className="preset-action-btn" onClick={() => handleDeletePreset(preset.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="preset-empty-state">
          No saved presets yet. Open filters, tune your stack, and save a favorite configuration.
        </p>
      )}
    </div>
  );

  const renderDiscoveryControls = () => (
    <>
      <div className="discovery-hub">
        <div className="discovery-hub-copy">
          <span className="discovery-hub-label">Discovery Hub</span>
          <h2>Switch modes with intention</h2>
          <p>Move between personalized suggestions, social momentum, and your saved filter moods.</p>
        </div>
        <div className="discovery-hub-tabs">
          {DISCOVERY_HUB_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`hub-tab ${activeHubTab === tab.key ? 'active' : ''}`}
              onClick={() => selectHubTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="discovery-toolbar">
        <div className="toolbar-left">
          <button type="button" className="btn-filter-toggle" onClick={() => setShowFilters((current) => !current)}>
            Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
          </button>
          {filterPresets.length > 0 && activeHubTab !== 'presets' ? (
            <div className="quick-preset-row">
              {filterPresets.slice(0, 3).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="quick-preset-chip"
                  onClick={() => handleApplyPreset(preset)}
                >
                  {preset.preset_name || preset.presetName}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="daily-limits">
          <span title="Remaining likes">Likes {remainingLikes}</span>
          <span title="Remaining superlikes">Stars {remainingSuperlikes}</span>
          <span title="Remaining rewinds">Rewinds {remainingRewinds}</span>
          <button
            type="button"
            className="btn-boost"
            onClick={handleBoost}
            disabled={boosting || !(subscription?.isPremium || subscription?.isGold)}
          >
            {boosting ? 'Boosting...' : 'Boost'}
          </button>
        </div>
      </div>

      <div className="mode-summary">
        <strong>{modeSummary.title}</strong>
        <span>{modeSummary.subtitle}</span>
      </div>

      {feedback ? (
        <div className={`discovery-feedback ${feedback.type === 'error' ? 'error' : 'success'}`}>
          {feedback.message}
        </div>
      ) : null}

      {activeHubTab === 'presets' ? renderPresetPanel() : null}
      {showFilters ? renderFilterPanel() : null}

      {activeFilterCount > 0 ? (
        <div className="active-filter-summary">
          {appliedFilters.ageMin ? <span>Age {appliedFilters.ageMin}+</span> : null}
          {appliedFilters.ageMax ? <span>Up to {appliedFilters.ageMax}</span> : null}
          {appliedFilters.distance ? <span>{appliedFilters.distance} km</span> : null}
          {appliedFilters.gender ? <span>{appliedFilters.gender}</span> : null}
          {appliedFilters.relationshipGoals ? <span>{appliedFilters.relationshipGoals}</span> : null}
          {appliedFilters.interests ? <span>{appliedFilters.interests}</span> : null}
          {appliedFilters.heightRangeMin ? <span>Height {appliedFilters.heightRangeMin}+</span> : null}
          {appliedFilters.heightRangeMax ? <span>Height max {appliedFilters.heightRangeMax}</span> : null}
          {appliedFilters.bodyTypes ? <span>{appliedFilters.bodyTypes}</span> : null}
        </div>
      ) : null}
    </>
  );

  if (noMoreProfiles || !currentProfile) {
    return (
      <div className="discovery-container no-profiles">
        {renderDiscoveryControls()}
        <div className="empty-state">
          <h2>No More Profiles</h2>
          <p>
            {activeFilterCount > 0
              ? 'No profiles match your current preferences just yet.'
              : "You've reviewed all available profiles for this mode."}
          </p>
          {loadingMore ? (
            <div className="spinner small"></div>
          ) : (
            <button onClick={reloadProfiles} className="btn-primary">Reload Profiles</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="discovery-container">
      {renderDiscoveryControls()}

      <div className="card-stack">
        <div className="profile-card active">
          <div className="photo-container">
            {currentProfile.photos && currentProfile.photos.length > 0 ? (
              <>
                <img
                  src={currentProfile.photos[0]}
                  alt={currentProfile.firstName}
                  className="profile-photo"
                  loading="lazy"
                  decoding="async"
                  onError={(event) => {
                    event.target.src = 'https://via.placeholder.com/400x600?text=No+Photo';
                  }}
                />
                {currentProfile.photos.length > 1 ? (
                  <div className="photo-indicators">
                    {currentProfile.photos.map((photo, index) => (
                      <div key={`${photo}-${index}`} className={`indicator ${index === 0 ? 'active' : ''}`}></div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="no-photo">No Photos</div>
            )}

            <div className="profile-header">
              <div className="name-age">
                <h2>{currentProfile.firstName}</h2>
                <span className="age">{currentProfile.age}</span>
              </div>
              {currentProfile.profileVerified ? (
                <div className="verified-badge" title="Verified Profile">V</div>
              ) : null}
            </div>

            <div className="location">
              {currentProfile.location?.city}, {currentProfile.location?.state}
              {currentProfile.distanceKm !== undefined && currentProfile.distanceKm !== null
                ? ` | ${currentProfile.distanceKm} km`
                : ''}
            </div>

            {activityHint ? (
              <div className={`activity-pill ${activityHint.tone}`}>
                {activityHint.label}
              </div>
            ) : null}
          </div>

          <div className="profile-info">
            {currentProfile.compatibilityScore ? (
              <div className="profile-meta-row">
                <div className="compatibility-panel compact">
                  <div
                    className="compatibility-badge"
                    onClick={() => setShowScoreBreakdown((current) => !current)}
                    style={{ cursor: scoreBreakdown ? 'pointer' : 'default' }}
                  >
                    Compatibility {currentProfile.compatibilityScore}%
                    {scoreBreakdown ? (
                      <span className="score-toggle">{showScoreBreakdown ? ' ^' : ' v'}</span>
                    ) : null}
                  </div>

                  {showScoreBreakdown && scoreBreakdown ? (
                    <div className="score-breakdown">
                      <div className="score-row"><span>Compatibility</span><div className="score-bar"><div className="score-fill" style={{ width: `${scoreBreakdown.compatibility}%` }}></div></div><b>{scoreBreakdown.compatibility}%</b></div>
                      <div className="score-row"><span>Behavioral</span><div className="score-bar"><div className="score-fill behavioral" style={{ width: `${scoreBreakdown.behavioral}%` }}></div></div><b>{scoreBreakdown.behavioral}%</b></div>
                      <div className="score-row"><span>Recency</span><div className="score-bar"><div className="score-fill recency" style={{ width: `${scoreBreakdown.recency}%` }}></div></div><b>{scoreBreakdown.recency}%</b></div>
                      <div className="score-row"><span>Trending</span><div className="score-bar"><div className="score-fill trending" style={{ width: `${scoreBreakdown.trending}%` }}></div></div><b>{scoreBreakdown.trending}%</b></div>
                      <div className="score-row"><span>Diversity</span><div className="score-bar"><div className="score-fill diversity" style={{ width: `${scoreBreakdown.diversity}%` }}></div></div><b>{scoreBreakdown.diversity}%</b></div>
                    </div>
                  ) : null}
                </div>

                <button type="button" className={`favorite-toggle ${isFavorite ? 'active' : ''}`} onClick={handleToggleFavorite}>
                  {isFavorite ? 'Saved' : 'Save'}
                </button>
              </div>
            ) : null}

            {recommendationReasons.length > 0 ? (
              <div className="recommendation-panel">
                <p className="recommendation-label">Why this profile is showing up</p>
                <div className="compatibility-reasons">
                  {recommendationReasons.map((reason) => (
                    <span key={reason} className="compatibility-reason">{reason}</span>
                  ))}
                </div>
                {currentProfile.icebreakers?.[0] ? (
                  <p className="compatibility-opener">Suggested opener: {currentProfile.icebreakers[0]}</p>
                ) : null}
              </div>
            ) : null}

            {currentProfile.voiceIntroUrl ? (
              <div className="voice-intro-card">
                <div className="voice-intro-header">
                  <strong>Voice intro</strong>
                  <span>
                    {currentProfile.voiceIntroDurationSeconds
                      ? `${currentProfile.voiceIntroDurationSeconds}s`
                      : '15-30s'}
                  </span>
                </div>
                <audio controls preload="none" src={currentProfile.voiceIntroUrl} className="voice-intro-player">
                  Your browser does not support audio playback.
                </audio>
              </div>
            ) : null}

            {currentProfile.bio ? (
              <div className="bio">
                <p>{currentProfile.bio}</p>
              </div>
            ) : null}

            <div className="details-grid">
              {currentProfile.occupation ? (
                <div className="detail-item"><span className="label">Occupation</span><span className="value">{currentProfile.occupation}</span></div>
              ) : null}
              {currentProfile.education ? (
                <div className="detail-item"><span className="label">Education</span><span className="value">{currentProfile.education}</span></div>
              ) : null}
              {currentProfile.relationshipGoals ? (
                <div className="detail-item"><span className="label">Looking For</span><span className="value">{currentProfile.relationshipGoals}</span></div>
              ) : null}
              {currentProfile.bodyType ? (
                <div className="detail-item"><span className="label">Body Type</span><span className="value">{currentProfile.bodyType}</span></div>
              ) : null}
              {currentProfile.height ? (
                <div className="detail-item"><span className="label">Height</span><span className="value">{currentProfile.height} cm</span></div>
              ) : null}
            </div>

            {currentProfile.interests && currentProfile.interests.length > 0 ? (
              <div className="interests">
                <h4>Interests</h4>
                <div className="interest-tags">
                  {currentProfile.interests.map((interest, index) => (
                    <span key={`${interest}-${index}`} className="tag">{interest}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="action-buttons">
        <button onClick={handlePass} className="btn-action btn-pass" title="Not interested" aria-label="Pass">Pass</button>
        <button onClick={handleRewind} className="btn-action btn-rewind" title="Undo last pass" aria-label="Rewind" disabled={remainingRewinds <= 0}>Undo</button>
        <button onClick={() => onProfileView?.(currentProfile)} className="btn-action btn-view" title="View full profile" aria-label="View Profile">View</button>
        <button onClick={handleSuperlike} className="btn-action btn-superlike" title="Superlike" aria-label="Superlike" disabled={remainingSuperlikes <= 0}>Star</button>
        <button onClick={handleLike} className="btn-action btn-like" title="Like this profile" aria-label="Like" disabled={remainingLikes <= 0}>Like</button>
      </div>

      <div className="card-counter">{currentIndex + 1} of {profiles.length}{nextCursor ? ' +' : ''}</div>
      {loadingMore ? (
        <div className="loading-more">
          <div className="spinner small"></div>
          <span>Loading more...</span>
        </div>
      ) : null}
    </div>
  );
};

export default DiscoveryCards;
