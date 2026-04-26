import React, { useCallback, useEffect, useState } from 'react';
import '../styles/BrowseProfiles.css';
import datingProfileService from '../services/datingProfileService';

const defaultFilters = {
  ageRange: { min: 18, max: 65 },
  locationRadius: 50,
  relationshipGoals: ['dating', 'relationship'],
  interests: [],
  heightRange: { min: 150, max: 210 }
};

/**
 * BrowseProfiles Component
 * Advanced profile search with filters
 */
const BrowseProfiles = ({ onProfileSelect, onMatch }) => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState(defaultFilters);

  // Load profiles on mount or filter change
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

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAgeChange = (min, max) => {
    setFilters(prev => ({
      ...prev,
      ageRange: { min, max }
    }));
  };

  const handleHeightChange = (min, max) => {
    setFilters(prev => ({
      ...prev,
      heightRange: { min, max }
    }));
  };

  const handleLike = async (profile) => {
    try {
      const result = await datingProfileService.likeProfile(profile.userId);
      if (result.isMatch) {
        onMatch?.({
          ...profile,
          matchId: result.match?.id || profile.matchId || null
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

  return (
    <div className="browse-container">
      {/* Header */}
      <div className="browse-header">
        <h1>Browse Profiles</h1>
        <button
          className="btn-filter-toggle"
          onClick={() => setShowFilters(!showFilters)}
        >
          ⚙ Filters
        </button>
      </div>

      {/* Filters Panel */}
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
                onChange={(e) => handleAgeChange(parseInt(e.target.value), filters.ageRange.max)}
                placeholder="Min Age"
              />
              <span>to</span>
              <input
                type="number"
                min="18"
                max="100"
                value={filters.ageRange.max}
                onChange={(e) => handleAgeChange(filters.ageRange.min, parseInt(e.target.value))}
                placeholder="Max Age"
              />
            </div>
          </div>

          <div className="filter-group">
            <label>Location Radius (km)</label>
            <input
              type="range"
              min="1"
              max="100"
              value={filters.locationRadius}
              onChange={(e) => handleFilterChange('locationRadius', parseInt(e.target.value))}
            />
            <span className="range-value">{filters.locationRadius} km</span>
          </div>

          <div className="filter-group">
            <label>Height Range (cm)</label>
            <div className="range-inputs">
              <input
                type="number"
                min="130"
                max="230"
                value={filters.heightRange.min}
                onChange={(e) => handleHeightChange(parseInt(e.target.value), filters.heightRange.max)}
                placeholder="Min Height"
              />
              <span>to</span>
              <input
                type="number"
                min="130"
                max="230"
                value={filters.heightRange.max}
                onChange={(e) => handleHeightChange(filters.heightRange.min, parseInt(e.target.value))}
                placeholder="Max Height"
              />
            </div>
          </div>

          <div className="filter-group">
            <label>Relationship Goals</label>
            <div className="checkbox-group">
              {['Casual Dating', 'Dating', 'Relationship', 'Marriage'].map((goal) => (
                <label key={goal} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={filters.relationshipGoals.includes(goal.toLowerCase())}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFilters(prev => ({
                          ...prev,
                          relationshipGoals: [...prev.relationshipGoals, goal.toLowerCase()]
                        }));
                      } else {
                        setFilters(prev => ({
                          ...prev,
                          relationshipGoals: prev.relationshipGoals.filter(g => g !== goal.toLowerCase())
                        }));
                      }
                    }}
                  />
                  {goal}
                </label>
              ))}
            </div>
          </div>

          <button className="btn-apply" onClick={handleApplyFilters}>Apply Filters</button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Searching profiles...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="error-container">
          <p>{error}</p>
          <button onClick={() => searchProfiles(filters)}>Retry</button>
        </div>
      )}

      {/* Profiles Grid */}
      {!loading && !error && profiles.length > 0 && (
        <div className="profiles-grid">
          {profiles.map((profile) => (
            <div key={profile.userId} className="profile-card-grid">
              {/* Photo */}
              <div
                className="profile-image"
                onClick={() => onProfileSelect?.(profile)}
                style={{
                  backgroundImage: profile.photos?.[0]
                    ? `url(${profile.photos[0]})`
                    : 'linear-gradient(135deg, #667eea, #764ba2)'
                }}
              >
                {profile.profileVerified && (
                  <div className="verified-badge">✓</div>
                )}
              </div>

              {/* Info */}
              <div className="profile-card-info">
                <h3>{profile.firstName}, {profile.age}</h3>
                <p className="location">📍 {profile.location?.city}</p>
                <p className="bio-preview">{profile.bio?.substring(0, 60)}...</p>

                {/* Interests Preview */}
                {profile.interests && profile.interests.length > 0 && (
                  <div className="interests-preview">
                    {profile.interests.slice(0, 3).map((interest, idx) => (
                      <span key={idx} className="tag-small">{interest}</span>
                    ))}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="card-actions">
                  <button
                    className="btn-view-profile"
                    onClick={() => onProfileSelect?.(profile)}
                  >
                    View Profile
                  </button>
                  <button
                    className="btn-like-small"
                    onClick={() => handleLike(profile)}
                  >
                    ♥
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Profiles */}
      {!loading && !error && profiles.length === 0 && (
        <div className="no-profiles">
          <p>No profiles found. Try adjusting your filters.</p>
          <button onClick={() => setShowFilters(true)}>Adjust Filters</button>
        </div>
      )}
    </div>
  );
};

export default BrowseProfiles;
