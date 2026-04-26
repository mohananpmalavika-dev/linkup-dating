import React, { useCallback, useEffect, useState } from 'react';
import '../styles/BrowseProfiles.css';
import datingProfileService from '../services/datingProfileService';

const defaultFilters = {
  ageRange: { min: 18, max: 65 },
  relationshipGoals: ['dating', 'relationship'],
  interests: [],
  heightRange: { min: 150, max: 210 }
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
  }, [searchProfiles]);

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

  const handleApplyFilters = () => {
    searchProfiles(filters);
    setShowFilters(false);
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
    searchProfiles(defaultFilters);
    setShowFilters(false);
  };

  return (
    <div className="browse-container">
      <div className="browse-header">
        <div>
          <h1>Browse Profiles</h1>
          <p className="browse-subtitle">Search by age, height, goals, and shared interests.</p>
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
              >
                {profile.profileVerified ? (
                  <div className="verified-badge">Verified</div>
                ) : null}
              </button>

              <div className="profile-card-info">
                <h3>{profile.firstName}, {profile.age}</h3>
                <p className="location">{profile.location?.city || 'Location unavailable'}</p>
                <p className="bio-preview">{truncateText(profile.bio)}</p>

                {profile.interests && profile.interests.length > 0 ? (
                  <div className="interests-preview">
                    {profile.interests.slice(0, 3).map((interest) => (
                      <span key={interest} className="tag-small">{interest}</span>
                    ))}
                  </div>
                ) : null}

                <div className="card-actions">
                  <button
                    type="button"
                    className="btn-view-profile"
                    onClick={() => onProfileSelect?.(profile)}
                  >
                    View Profile
                  </button>
                  <button
                    type="button"
                    className="btn-like-small"
                    onClick={() => handleLike(profile)}
                    aria-label={`Like ${profile.firstName}`}
                  >
                    Like
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && profiles.length === 0 && (
        <div className="no-profiles">
          <p>No profiles found. Try adjusting your filters.</p>
          <button type="button" onClick={() => setShowFilters(true)}>Adjust Filters</button>
        </div>
      )}
    </div>
  );
};

export default BrowseProfiles;
