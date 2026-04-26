import React, { useEffect, useMemo, useState } from 'react';
import '../styles/DiscoveryCards.css';
import datingProfileService from '../services/datingProfileService';

/**
 * DiscoveryCards Component
 * Swipe-based profile discovery interface with preference filters
 */
const DEFAULT_FILTERS = {
  ageMin: '',
  ageMax: '',
  distance: '',
  relationshipGoals: '',
  interests: ''
};

const buildDiscoveryFilters = (filters) => {
  const params = {};

  if (filters.ageMin !== '') {
    params.ageMin = Number(filters.ageMin);
  }

  if (filters.ageMax !== '') {
    params.ageMax = Number(filters.ageMax);
  }

  if (filters.distance !== '') {
    params.distance = Number(filters.distance);
  }

  if (filters.relationshipGoals.trim()) {
    params.relationshipGoals = filters.relationshipGoals.trim();
  }

  if (filters.interests.trim()) {
    params.interests = filters.interests
      .split(',')
      .map((interest) => interest.trim())
      .filter(Boolean)
      .join(',');
  }

  return params;
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

  const activeFilterCount = useMemo(() => (
    Object.values(appliedFilters).filter((value) => String(value).trim() !== '').length
  ), [appliedFilters]);

  useEffect(() => {
    loadProfiles(appliedFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProfiles = async (nextFilters = appliedFilters) => {
    setLoading(true);
    setError('');

    try {
      const data = await datingProfileService.getDiscoveryProfiles(buildDiscoveryFilters(nextFilters));
      const nextProfiles = data.profiles || [];
      setProfiles(nextProfiles);
      setCurrentIndex(0);
      setNoMoreProfiles(nextProfiles.length === 0);
    } catch (err) {
      setError('Failed to load profiles. Please try again.');
      console.error('Profile loading error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentProfile = () => profiles[currentIndex];

  const handleLike = async () => {
    const profile = getCurrentProfile();
    if (!profile) return;

    try {
      const result = await datingProfileService.likeProfile(profile.userId);
      if (result.isMatch) {
        onMatch?.({
          ...profile,
          matchId: result.match?.id || profile.matchId || null
        });
      }
      moveToNextCard();
    } catch (err) {
      setError('Failed to like profile');
      console.error(err);
    }
  };

  const handlePass = async () => {
    const profile = getCurrentProfile();
    if (!profile) return;

    try {
      await datingProfileService.passProfile(profile.userId);
      moveToNextCard();
    } catch (err) {
      setError('Failed to pass profile');
      console.error(err);
    }
  };

  const moveToNextCard = () => {
    if (currentIndex < profiles.length - 1) {
      setCurrentIndex((index) => index + 1);
    } else {
      setNoMoreProfiles(true);
    }
  };

  const reloadProfiles = () => {
    setCurrentIndex(0);
    setNoMoreProfiles(false);
    loadProfiles(appliedFilters);
  };

  const handleFilterChange = (field, value) => {
    setFilters((current) => ({
      ...current,
      [field]: value
    }));
  };

  const handleApplyFilters = async (event) => {
    event.preventDefault();
    const nextFilters = {
      ageMin: filters.ageMin,
      ageMax: filters.ageMax,
      distance: filters.distance,
      relationshipGoals: filters.relationshipGoals,
      interests: filters.interests
    };

    setAppliedFilters(nextFilters);
    setShowFilters(false);
    await loadProfiles(nextFilters);
  };

  const handleResetFilters = async () => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setShowFilters(false);
    await loadProfiles(DEFAULT_FILTERS);
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

  if (error) {
    return (
      <div className="discovery-container error">
        <p className="error-message">{error}</p>
        <button onClick={() => loadProfiles(appliedFilters)} className="btn-retry">Retry</button>
      </div>
    );
  }

  if (noMoreProfiles || !currentProfile) {
    return (
      <div className="discovery-container no-profiles">
        <div className="discovery-toolbar">
          <button
            type="button"
            className="btn-filter-toggle"
            onClick={() => setShowFilters((current) => !current)}
          >
            Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
          </button>
        </div>

        {showFilters ? (
          <form className="filter-panel empty-filter-panel" onSubmit={handleApplyFilters}>
            <h3>Discovery preferences</h3>
            <p>Set the people you want to see first.</p>
            <div className="filter-grid">
              <label className="filter-field">
                <span>Age from</span>
                <input
                  type="number"
                  min="18"
                  max="99"
                  value={filters.ageMin}
                  onChange={(event) => handleFilterChange('ageMin', event.target.value)}
                />
              </label>
              <label className="filter-field">
                <span>Age to</span>
                <input
                  type="number"
                  min="18"
                  max="99"
                  value={filters.ageMax}
                  onChange={(event) => handleFilterChange('ageMax', event.target.value)}
                />
              </label>
              <label className="filter-field">
                <span>Distance (km)</span>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={filters.distance}
                  onChange={(event) => handleFilterChange('distance', event.target.value)}
                />
              </label>
              <label className="filter-field">
                <span>Relationship goal</span>
                <select
                  value={filters.relationshipGoals}
                  onChange={(event) => handleFilterChange('relationshipGoals', event.target.value)}
                >
                  <option value="">Any</option>
                  <option value="serious">Serious relationship</option>
                  <option value="casual">Casual dating</option>
                  <option value="friendship">Friendship</option>
                  <option value="marriage">Marriage</option>
                </select>
              </label>
              <label className="filter-field filter-field-full">
                <span>Interests</span>
                <input
                  type="text"
                  placeholder="music, travel, fitness"
                  value={filters.interests}
                  onChange={(event) => handleFilterChange('interests', event.target.value)}
                />
              </label>
            </div>
            <div className="filter-actions">
              <button type="button" className="btn-filter-secondary" onClick={handleResetFilters}>Reset</button>
              <button type="submit" className="btn-filter-primary">Apply filters</button>
            </div>
          </form>
        ) : null}

        <div className="empty-state">
          <h2>No More Profiles</h2>
          <p>{activeFilterCount > 0 ? 'No profiles match your current preferences.' : "You've reviewed all available profiles!"}</p>
          <button onClick={reloadProfiles} className="btn-primary">Reload Profiles</button>
        </div>
      </div>
    );
  }

  return (
    <div className="discovery-container">
      <div className="discovery-toolbar">
        <button
          type="button"
          className="btn-filter-toggle"
          onClick={() => setShowFilters((current) => !current)}
        >
          Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
        </button>
      </div>

      {showFilters ? (
        <form className="filter-panel" onSubmit={handleApplyFilters}>
          <div className="filter-panel-header">
            <div>
              <h3>Discovery preferences</h3>
              <p>Refine who shows up in your swipe stack.</p>
            </div>
            <button type="button" className="btn-filter-close" onClick={() => setShowFilters(false)}>
              Close
            </button>
          </div>

          <div className="filter-grid">
            <label className="filter-field">
              <span>Age from</span>
              <input
                type="number"
                min="18"
                max="99"
                value={filters.ageMin}
                onChange={(event) => handleFilterChange('ageMin', event.target.value)}
                placeholder="Any"
              />
            </label>

            <label className="filter-field">
              <span>Age to</span>
              <input
                type="number"
                min="18"
                max="99"
                value={filters.ageMax}
                onChange={(event) => handleFilterChange('ageMax', event.target.value)}
                placeholder="Any"
              />
            </label>

            <label className="filter-field">
              <span>Distance (km)</span>
              <input
                type="number"
                min="1"
                max="500"
                value={filters.distance}
                onChange={(event) => handleFilterChange('distance', event.target.value)}
                placeholder="Any"
              />
            </label>

            <label className="filter-field">
              <span>Relationship goal</span>
              <select
                value={filters.relationshipGoals}
                onChange={(event) => handleFilterChange('relationshipGoals', event.target.value)}
              >
                <option value="">Any</option>
                <option value="serious">Serious relationship</option>
                <option value="casual">Casual dating</option>
                <option value="friendship">Friendship</option>
                <option value="marriage">Marriage</option>
              </select>
            </label>

            <label className="filter-field filter-field-full">
              <span>Interests</span>
              <input
                type="text"
                placeholder="music, travel, fitness"
                value={filters.interests}
                onChange={(event) => handleFilterChange('interests', event.target.value)}
              />
            </label>
          </div>

          <div className="filter-actions">
            <button type="button" className="btn-filter-secondary" onClick={handleResetFilters}>Reset</button>
            <button type="submit" className="btn-filter-primary">Apply filters</button>
          </div>
        </form>
      ) : null}

      {activeFilterCount > 0 ? (
        <div className="active-filter-summary">
          {appliedFilters.ageMin ? <span>Age {appliedFilters.ageMin}+</span> : null}
          {appliedFilters.ageMax ? <span>Up to {appliedFilters.ageMax}</span> : null}
          {appliedFilters.distance ? <span>{appliedFilters.distance} km</span> : null}
          {appliedFilters.relationshipGoals ? <span>{appliedFilters.relationshipGoals}</span> : null}
          {appliedFilters.interests ? <span>{appliedFilters.interests}</span> : null}
        </div>
      ) : null}

      {/* Card Stack */}
      <div className="card-stack">
        <div className="profile-card active">
          {/* Photo Gallery */}
          <div className="photo-container">
            {currentProfile.photos && currentProfile.photos.length > 0 ? (
              <>
                <img
                  src={currentProfile.photos[0]}
                  alt={currentProfile.firstName}
                  className="profile-photo"
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/400x600?text=No+Photo'; }}
                />
                {currentProfile.photos.length > 1 && (
                  <div className="photo-indicators">
                    {currentProfile.photos.map((_, idx) => (
                      <div
                        key={idx}
                        className={`indicator ${idx === 0 ? 'active' : ''}`}
                      ></div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="no-photo">No Photos</div>
            )}

            {/* Age & Location Badge */}
            <div className="profile-header">
              <div className="name-age">
                <h2>{currentProfile.firstName}</h2>
                <span className="age">{currentProfile.age}</span>
              </div>
              {currentProfile.profileVerified && (
                <div className="verified-badge" title="Verified Profile">
                  ✓
                </div>
              )}
            </div>

            {/* Location */}
            <div className="location">
              📍 {currentProfile.location?.city}, {currentProfile.location?.state}
            </div>
          </div>

          {/* Profile Info */}
          <div className="profile-info">
            {currentProfile.compatibilityScore ? (
              <div className="compatibility-panel">
                <div className="compatibility-badge">
                  Compatibility {currentProfile.compatibilityScore}%
                </div>
                {currentProfile.compatibilityReasons?.length > 0 ? (
                  <div className="compatibility-reasons">
                    {currentProfile.compatibilityReasons.map((reason) => (
                      <span key={reason} className="compatibility-reason">
                        {reason}
                      </span>
                    ))}
                  </div>
                ) : null}
                {currentProfile.icebreakers?.[0] ? (
                  <p className="compatibility-opener">Try this opener: {currentProfile.icebreakers[0]}</p>
                ) : null}
              </div>
            ) : null}

            {/* Bio */}
            {currentProfile.bio && (
              <div className="bio">
                <p>{currentProfile.bio}</p>
              </div>
            )}

            {/* Details Grid */}
            <div className="details-grid">
              {currentProfile.occupation && (
                <div className="detail-item">
                  <span className="label">Occupation</span>
                  <span className="value">{currentProfile.occupation}</span>
                </div>
              )}
              {currentProfile.education && (
                <div className="detail-item">
                  <span className="label">Education</span>
                  <span className="value">{currentProfile.education}</span>
                </div>
              )}
              {currentProfile.relationshipGoals && (
                <div className="detail-item">
                  <span className="label">Looking For</span>
                  <span className="value">{currentProfile.relationshipGoals}</span>
                </div>
              )}
            </div>

            {/* Interests */}
            {currentProfile.interests && currentProfile.interests.length > 0 && (
              <div className="interests">
                <h4>Interests</h4>
                <div className="interest-tags">
                  {currentProfile.interests.map((interest, idx) => (
                    <span key={idx} className="tag">{interest}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        <button
          onClick={handlePass}
          className="btn-action btn-pass"
          title="Not interested"
          aria-label="Pass"
        >
          ✕
        </button>
        <button
          onClick={() => onProfileView?.(currentProfile)}
          className="btn-action btn-view"
          title="View full profile"
          aria-label="View Profile"
        >
          ⓘ
        </button>
        <button
          onClick={handleLike}
          className="btn-action btn-like"
          title="Like this profile"
          aria-label="Like"
        >
          ♥
        </button>
      </div>

      {/* Card Counter */}
      <div className="card-counter">
        {currentIndex + 1} of {profiles.length}
      </div>
    </div>
  );
};

export default DiscoveryCards;
