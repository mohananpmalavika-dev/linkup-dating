import React, { useCallback, useEffect, useState } from 'react';
import '../styles/BrowseProfiles.css';
import datingProfileService from '../services/datingProfileService';
import { isValidPincode } from '../utils/ecommerceHelpers';
import { buildLocalIdentityPack, buildTrustSummary } from '../utils/datingPhaseTwo';
import {
  formatProfileLocation,
  getDistrictOptionsForRegion,
  KERALA_REGION_OPTIONS,
  normalizePincodeInput,
  resolveKeralaLocation
} from '../utils/keralaLocation';

const defaultFilters = {
  ageRange: { min: 18, max: 65 },
  relationshipGoals: ['dating', 'relationship'],
  interests: [],
  heightRange: { min: 150, max: 210 },
  bodyTypes: [],
  distance: 100,
  genderPreferences: [],
  languages: [],
  conversationStyle: '',
  city: '',
  district: '',
  locality: '',
  pincode: '',
  keralaRegion: '',
  onlyVerifiedProfiles: false,
  communityPreference: ''
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
const languageOptions = ['English', 'Hindi', 'Malayalam', 'Tamil', 'Telugu', 'Kannada', 'Bengali', 'Marathi'];
const conversationStyleOptions = ['direct', 'steady', 'deep'];

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

const BrowseProfiles = ({ onProfileSelect, onMatch }) => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(defaultFilters);
  const [favoriteUserIds, setFavoriteUserIds] = useState(new Set());
  const [searchHistory, setSearchHistory] = useState([]);
  const districtOptions = getDistrictOptionsForRegion(filters.keralaRegion);

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
    setFilters((prev) => ({ ...prev, ageRange: { min, max } }));
  };

  const handleHeightChange = (min, max) => {
    setFilters((prev) => ({ ...prev, heightRange: { min, max } }));
  };

  const handleDistanceChange = (value) => {
    setFilters((prev) => ({ ...prev, distance: parseIntegerOrFallback(value, prev.distance) }));
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
        onMatch?.({ ...profile, matchId: result.match?.id || null });
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
    const normalizedPincode = normalizePincodeInput(filters.pincode);

    if (normalizedPincode && !isValidPincode(normalizedPincode)) {
      setError('Use a valid 6-digit pincode to narrow Kerala discovery.');
      return;
    }

    const apiFilters = {
      ageRange: filters.ageRange,
      relationshipGoals: filters.relationshipGoals,
      heightRange: filters.heightRange,
      interests: filters.interests,
      bodyTypes: filters.bodyTypes,
      distance: filters.distance,
      genderPreferences: filters.genderPreferences,
      languages: filters.languages,
      conversationStyle: filters.conversationStyle,
      city: filters.city,
      district: filters.district,
      locality: filters.locality,
      pincode: normalizedPincode,
      keralaRegion: filters.keralaRegion,
      onlyVerifiedProfiles: filters.onlyVerifiedProfiles,
      communityPreference: filters.communityPreference
    };
    setError('');
    searchProfiles(apiFilters);
    setShowFilters(false);
  };

  const handleResetFilters = () => {
    setError('');
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
      distance: entry.filters?.distance || defaultFilters.distance,
      genderPreferences: Array.isArray(entry.filters?.genderPreferences)
        ? entry.filters.genderPreferences
        : defaultFilters.genderPreferences,
      languages: Array.isArray(entry.filters?.languages)
        ? entry.filters.languages
        : defaultFilters.languages,
      conversationStyle: entry.filters?.conversationStyle || defaultFilters.conversationStyle,
      city: entry.filters?.city || defaultFilters.city,
      district: entry.filters?.district || defaultFilters.district,
      locality: entry.filters?.locality || defaultFilters.locality,
      pincode: entry.filters?.pincode || defaultFilters.pincode,
      keralaRegion: entry.filters?.keralaRegion || defaultFilters.keralaRegion,
      onlyVerifiedProfiles: Boolean(entry.filters?.onlyVerifiedProfiles),
      communityPreference: entry.filters?.communityPreference || defaultFilters.communityPreference
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
          <p className="browse-subtitle">Search by age, goals, interests, and tighter Kerala locality signals.</p>
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
            <label>Gender</label>
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
            <label>Languages</label>
            <div className="checkbox-group">
              {languageOptions.map((language) => (
                <label key={language} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={filters.languages.includes(language)}
                    onChange={() => toggleArrayValue('languages', language)}
                  />
                  {language}
                </label>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <label htmlFor="conversation-style-filter">Conversation Style</label>
            <select
              id="conversation-style-filter"
              value={filters.conversationStyle}
              onChange={(event) =>
                setFilters((currentFilters) => ({
                  ...currentFilters,
                  conversationStyle: event.target.value
                }))
              }
            >
              <option value="">Any style</option>
              {conversationStyleOptions.map((style) => (
                <option key={style} value={style}>
                  {style.charAt(0).toUpperCase() + style.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="city-filter">City Match</label>
            <input
              id="city-filter"
              type="text"
              value={filters.city}
              onChange={(event) =>
                setFilters((currentFilters) => ({
                  ...currentFilters,
                  city: event.target.value
                }))
              }
              placeholder="Bengaluru, Kochi, Chennai..."
            />
          </div>

          <div className="filter-group">
            <label htmlFor="district-filter">District</label>
            <select
              id="district-filter"
              value={filters.district}
              onChange={(event) =>
                setFilters((currentFilters) => {
                  const nextLocation = resolveKeralaLocation({
                    city: currentFilters.city,
                    district: event.target.value,
                    locality: currentFilters.locality,
                    pincode: currentFilters.pincode,
                    keralaRegion: currentFilters.keralaRegion
                  });

                  return {
                    ...currentFilters,
                    district: nextLocation.district,
                    keralaRegion: nextLocation.keralaRegion
                  };
                })
              }
            >
              <option value="">Any district</option>
              {districtOptions.map((district) => (
                <option key={district.value} value={district.value}>
                  {district.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="locality-filter">Locality Or Neighborhood</label>
            <input
              id="locality-filter"
              type="text"
              value={filters.locality}
              onChange={(event) =>
                setFilters((currentFilters) => ({
                  ...currentFilters,
                  locality: event.target.value
                }))
              }
              placeholder="Fort Kochi, Kakkanad, Kowdiar..."
            />
          </div>

          <div className="filter-group">
            <label htmlFor="pincode-filter">Pincode</label>
            <input
              id="pincode-filter"
              type="text"
              inputMode="numeric"
              value={filters.pincode}
              onChange={(event) =>
                setFilters((currentFilters) => ({
                  ...currentFilters,
                  pincode: normalizePincodeInput(event.target.value)
                }))
              }
              placeholder="682030"
              maxLength="6"
            />
          </div>

          <div className="filter-group">
            <label htmlFor="kerala-region-filter">Kerala Region</label>
            <select
              id="kerala-region-filter"
              value={filters.keralaRegion}
              onChange={(event) =>
                setFilters((currentFilters) => {
                  const nextLocation = resolveKeralaLocation({
                    city: currentFilters.city,
                    district: '',
                    locality: currentFilters.locality,
                    pincode: currentFilters.pincode,
                    keralaRegion: event.target.value
                  });

                  return {
                    ...currentFilters,
                    district: '',
                    keralaRegion: nextLocation.keralaRegion
                  };
                })
              }
            >
              <option value="">Any Kerala region</option>
              {KERALA_REGION_OPTIONS.map((region) => (
                <option key={region.value} value={region.value}>
                  {region.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="community-filter">Community Or Culture</label>
            <input
              id="community-filter"
              type="text"
              value={filters.communityPreference}
              onChange={(event) =>
                setFilters((currentFilters) => ({
                  ...currentFilters,
                  communityPreference: event.target.value
                }))
              }
              placeholder="Malayali, Tamil, Christian..."
            />
          </div>

          <label className="checkbox-label premium-filter-toggle">
            <input
              type="checkbox"
              checked={filters.onlyVerifiedProfiles}
              onChange={(event) =>
                setFilters((currentFilters) => ({
                  ...currentFilters,
                  onlyVerifiedProfiles: event.target.checked
                }))
              }
            />
            Verified profiles only
          </label>

          <p className="filter-hint">
            Premium filters now include district, locality, pincode, Kerala-region targeting, and verified-only discovery.
          </p>

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
                <span>{entry.resultCount} results &bull; {new Date(entry.createdAt).toLocaleString()}</span>
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
          {profiles.map((profile) => {
            const identityPack = buildLocalIdentityPack(profile);
            const trustSummary = buildTrustSummary({ profile });
            const locationLabel = formatProfileLocation(profile.location);

            return (
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
                  {profile.compatibilityScore ? (
                    <div className="compatibility-badge-browse">{profile.compatibilityScore}%</div>
                  ) : null}
                </button>

                <div className="profile-card-info">
                  <h3>{profile.firstName}, {profile.age}</h3>
                  <p className="location">
                    {locationLabel || 'Location unavailable'}
                    {profile.distanceKm ? ` · ${profile.distanceKm} km` : ''}
                  </p>
                  <p className="bio-preview">{truncateText(profile.bio)}</p>

                  <div className="browse-phase-two-badges">
                    {identityPack.cityVibe ? (
                      <span className="browse-mini-pill city">{identityPack.cityVibe}</span>
                    ) : null}
                    {identityPack.culturalBadges.slice(0, 1).map((badge) => (
                      <span key={badge.label} className={`browse-mini-pill ${badge.tone}`}>
                        {badge.label}
                      </span>
                    ))}
                    <span className={`browse-mini-pill trust ${trustSummary.level}`}>
                      {trustSummary.level === 'trusted'
                        ? 'High trust'
                        : trustSummary.level === 'strong'
                          ? 'Strong trust'
                          : trustSummary.level === 'pending'
                            ? 'Verification pending'
                            : trustSummary.level === 'basic'
                              ? 'Basic trust'
                              : 'New profile'}
                    </span>
                  </div>

                  {profile.interests && profile.interests.length > 0 ? (
                    <div className="interests-preview">
                      {profile.interests.slice(0, 3).map((interest) => (
                        <span key={interest} className="tag-small">{interest}</span>
                      ))}
                    </div>
                  ) : null}

                  {identityPack.localDateSuggestions?.[0] ? (
                    <p className="bio-preview browse-local-date-hint">
                      Local date idea: {identityPack.localDateSuggestions[0].title}
                    </p>
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
                      className="btn-view-profile"
                      onClick={() => handleToggleFavorite(profile)}
                    >
                      {favoriteUserIds.has(String(profile.userId)) ? 'Unfavorite' : 'Favorite'}
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
            );
          })}
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
