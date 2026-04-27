import React, { useCallback, useEffect, useState } from 'react';
import '../styles/BrowseProfiles.css';
import datingProfileService from '../services/datingProfileService';

const defaultFilters = {
  ageRange: { min: 18, max: 65 },
  relationshipGoals: ['dating', 'relationship'],
  interests: [],
  heightRange: { min: 150, max: 210 },
  bodyTypes: [],
  genderPreferences: [],
  distance: 100
};

const relationshipGoalOptions = [
  { label: 'Casual Dating', value: 'casual' },
  { label: 'Dating', value: 'dating' },
  { label: 'Relationship', value: 'relationship' },
  { label: 'Marriage', value: 'marriage' }
];

const interestOptions = [
  'Travel',
  'Fitness',
  'Music',
  'Art',
  'Cooking',
  'Gaming',
  'Sports',
  'Hiking',
  'Photography',
  'Reading',
  'Movies',
  'Yoga'
];

const bodyTypeOptions = ['Slim', 'Average', 'Athletic', 'Curvy', 'Muscular', 'Heavyset'];
const genderOptions = ['male', 'female', 'non-binary', 'other'];

const parseIntegerOrFallback = (value, fallbackValue) => {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
};

const truncateText = (value, limit = 60) => {
  const normalizedValue = String(value || '').trim();

  if (!normalizedValue) {
    return 'No bio yet.';
  }

  return normalizedValue.length > limit
    ? `${normalizedValue.slice(0, limit).trimEnd()}...`
    : normalizedValue;
};

/**
 * BrowseProfiles Component
 * Advanced profile search with filters that are fully supported by the backend
 */
const BrowseProfiles = ({ onProfileSelect, onMatch }) => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(defaultFilters);
  const [favoriteUserIds, setFavoriteUserIds] = useState(new Set());
  const [searchHistory, setSearchHistory] = useState([]);

  const loadSavedState = useCallback(async () => {
    try {
      const [favoritesData, historyData] = await Promise.all([
        datingProfileService.getFavorites(),
        datingProfileService.getSearchHistory(5)
      ]);

      const favoriteIds = new Set(
        (favoritesData.favorites || []).map((favorite) => String(favorite.userId))
      );

      setFavoriteUserIds(favoriteIds);
      setSearchHistory(Array.isArray(historyData.history) ? historyData.history : []);
    } catch (savedStateError) {
      console.error('Failed to load saved browse state:', savedStateError);
    }
  }, []);

  const searchProfiles = useCallback(async (activeFilters) => {
    setLoading(true);
    setError('');

    try {
      const data = await datingProfileService.searchProfiles(activeFilters);
      setProfiles(data.profiles || []);
    } catch (err) {
      setError('Failed to search profiles');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    searchProfiles(defaultFilters);
    loadSavedState();
  }, [loadSavedState, searchProfiles]);

  const handleAgeChange = (min, max) => {
    setFilters((prev) => ({
      ...prev,
      ageRange: { min, max }
    }));
  };

  const handleHeightChange = (min, max) => {
    setFilters((prev) => ({
      ...prev,
      heightRange: { min, max }
    }));
  };

  const handleDistanceChange = (value) => {
    setFilters((prev) => ({
      ...prev,
      distance: parseIntegerOrFallback(value, prev.distance)
    }));
  };

  const toggleArrayValue = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((currentValue) => currentValue !== value)
        : [...prev[field], value]
    }));
  };

  const handleLike = async (profile) => {
    try {
      const result = await datingProfileService.likeProfile(profile.userId);
      if (result.isMatch) {
        onMatch?.({
          ...profile,
          matchId: result.match?.id || null
        });
      }
    } catch (err) {
      console.error('Failed to like profile:', err);
    }
  };

  const handleToggleFavorite = async (profile) => {
    const userId = String(profile.userId);
    const nextFavoriteIds = new Set(favoriteUserIds);

    try {
      if (nextFavoriteIds.has(userId)) {
        await datingProfileService.removeFavorite(profile.userId);
        nextFavoriteIds.delete(userId);
      } else {
        await datingProfileService.favoriteProfile(profile.userId);
        nextFavoriteIds.add(userId);
      }

      setFavoriteUserIds(nextFavoriteIds);
      await loadSavedState();
    } catch (favoriteError) {
      console.error('Failed to update favorite profile:', favoriteError);
      setError('Failed to update favorites');
    }
  };

  const handleApplyFilters = () => {
    searchProfiles(filters);
    setShowFilters(false);
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
    searchProfiles(defaultFilters);
    setShowFilters(false);
  };

  const handleApplyHistoryEntry = async (entry) => {
    const nextFilters = {
      ageRange: entry.filters?.ageRange || defaultFilters.ageRange,
      relationshipGoals: Array.isArray(entry.filters?.relationshipGoals)
        ? entry.filters.relationshipGoals
        : defaultFilters.relationshipGoals,
      interests: Array.isArray(entry.filters?.interests)
        ? entry.filters.interests
        : defaultFilters.interests,
      heightRange: entry.filters?.heightRange || defaultFilters.heightRange,
      bodyTypes: Array.isArray(entry.filters?.bodyTypes)
        ? entry.filters.bodyTypes
        : defaultFilters.bodyTypes,
      genderPreferences: Array.isArray(entry.filters?.genderPreferences)
        ? entry.filters.genderPreferences
        : defaultFilters.genderPreferences,
      distance: entry.filters?.distance || defaultFilters.distance
    };

    setFilters(nextFilters);
    await searchProfiles(nextFilters);
  };

  const handleClearSearchHistory = async () => {
    try {
      await datingProfileService.clearSearchHistory();
      setSearchHistory([]);
    } catch (historyError) {
      console.error('Failed to clear search history:', historyError);
    }
  };

  return (
    <div className="browse-container">
      <div className="browse-header">
        <div>
          <h1>Browse Profiles</h1>
          <p className="browse-subtitle">Search by age, height, goals, body type, distance, and shared interests.</p>
        </div>
        <button
          type="button"
          className="btn-filter-toggle"
          onClick={() => setShowFilters((currentValue) => !currentValue)}
        >
          Filters
        </button>
      </div>

      {showFilters && (
        <div className="filters-panel">
          <div className="filter-group">
            <label>Age Range</label>
            <div className="range-inputs">
              <input
                type="number"
                min="18"
                max="100"
                value={filters.ageRange.min}
                onChange={(event) =>
                  handleAgeChange(
                    parseIntegerOrFallback(event.target.value, filters.ageRange.min),
                    filters.ageRange.max
                  )
                }
                placeholder="Min Age"
              />
              <span>to</span>
              <input
                type="number"
                min="18"
                max="100"
                value={filters.ageRange.max}
                onChange={(event) =>
                  handleAgeChange(
                    filters.ageRange.min,
                    parseIntegerOrFallback(event.target.value, filters.ageRange.max)
                  )
                }
                placeholder="Max Age"
              />
            </div>
          </div>

          <div className="filter-group">
            <label>Height Range (cm)</label>
            <div className="range-inputs">
              <input
                type="number"
                min="130"
                max="230"
                value={filters.heightRange.min}
                onChange={(event) =>
                  handleHeightChange(
                    parseIntegerOrFallback(event.target.value, filters.heightRange.min),
                    filters.heightRange.max
                  )
                }
                placeholder="Min Height"
              />
              <span>to</span>
              <input
                type="number"
                min="130"
                max="230"
                value={filters.heightRange.max}
                onChange={(event) =>
                  handleHeightChange(
                    filters.heightRange.min,
                    parseIntegerOrFallback(event.target.value, filters.heightRange.max)
                  )
                }
                placeholder="Max Height"
              />
            </div>
          </div>

          <div className="filter-group">
            <label>Distance (km)</label>
            <div className="range-slider-container">
              <input
                type="range"
                min="1"
                max="500"
                value={filters.distance}
                onChange={(event) => handleDistanceChange(event.target.value)}
                className="range-slider"
              />
              <span className="range-value">{filters.distance} km</span>
            </div>
          </div>

          <div className="filter-group">
            <label>Gender Preferences</label>
            <div className="checkbox-group">
              {genderOptions.map((gender) => (
                <label key={gender} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={filters.genderPreferences.includes(gender)}
                    onChange={() => toggleArrayValue('genderPreferences', gender)}
                  />
                  {gender.charAt(0).toUpperCase() + gender.slice(1)}
                </label>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <label>Relationship Goals</label>
            <div className="checkbox-group">
              {relationshipGoalOptions.map((goal) => (
                <label key={goal.value} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={filters.relationshipGoals.includes(goal.value)}
                    onChange={() => toggleArrayValue('relationshipGoals', goal.value)}
                  />
                  {goal.label}
                </label>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <label>Interests</label>
            <div className="checkbox-group">
              {interestOptions.map((interest) => (
                <label key={interest} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={filters.interests.includes(interest)}
                    onChange={() => toggleArrayValue('interests', interest)}
                  />
                  {interest}
                </label>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <label>Body Types</label>
            <div className="checkbox-group">
              {bodyTypeOptions.map((type) => (
                <label key={type} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={filters.bodyTypes.includes(type)}
                    onChange={() => toggleArrayValue('bodyTypes', type)}
                  />
                  {type}
                </label>
              ))}
            </div>
          </div>

          <p className="filter-hint">These filters now map directly to the backend search request.</p>

          <div className="filters-actions">
            <button type="button" className="btn-apply" onClick={handleApplyFilters}>
              Apply Filters
            </button>
            <button type="button" className="btn-reset" onClick={handleResetFilters}>
              Reset
            </button>
          </div>
        </div>
      )}

      {searchHistory.length > 0 ? (
        <div className="filters-panel">
          <div className="section-header-row">
            <div>
              <label>Recent Searches</label>
              <p className="filter-hint">Reuse the filters that worked for you last time.</p>
            </div>
            <button type="button" className="btn-reset" onClick={handleClearSearchHistory}>
              Clear
            </button>
          </div>
          <div className="search-history-list">
            {searchHistory.map((entry) => (
              <button
                type="button"
                key={entry.id}
                className="search-history-item"
                onClick={() => handleApplyHistoryEntry(entry)}
              >
                <strong>{entry.source === 'browse_search' ? 'Browse search' : 'Discovery'}</strong>
                <span>{entry.resultCount} results • {new Date(entry.createdAt).toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {loading && (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Searching profiles...</p>
        </div>
      )}

      {error && (
        <div className="error-container">
          <p>{error}</p>
          <button type="button" onClick={() => searchProfiles(filters)}>Retry</button>
        </div>
      )}

      {!loading && !error && profiles.length > 0 && (
        <div className="profiles-grid">
          {profiles.map((profile) => (
            <div key={profile.userId} className="profile-card-grid">
              <button
                type="button"
                className="profile-image profile-image-button"
                onClick={() => onProfileSelect?.(profile)}
                style={{
                  backgroundImage: profile.photos?.[0]
                    ? `url(${profile.photos[0]})`
                    : 'linear-gradient(135deg, #667eea, #764ba2)'
                }}
