import React, { useState, useEffect } from 'react';
import datingProfileService from '../services/datingProfileService';
import '../styles/AccountSettings.css';

const GENDER_OPTIONS = ['male', 'female', 'non-binary', 'other'];
const RELATIONSHIP_GOALS_OPTIONS = ['serious', 'casual', 'friendship', 'marriage'];
const BODY_TYPE_OPTIONS = ['slim', 'athletic', 'average', 'curvy', 'muscular', 'heavyset'];
const INTEREST_SUGGESTIONS = [
  'music', 'travel', 'fitness', 'reading', 'cooking', 'gaming',
  'photography', 'art', 'hiking', 'movies', 'sports', 'dancing',
  'yoga', 'technology', 'fashion', 'pets', 'politics', 'science'
];

const DatingPreferences = ({ onBack }) => {
  const [preferences, setPreferences] = useState({
    ageRangeMin: 18,
    ageRangeMax: 50,
    locationRadius: 50,
    genderPreferences: [],
    relationshipGoals: [],
    interests: [],
    heightRangeMin: '',
    heightRangeMax: '',
    bodyTypes: [],
    showMyProfile: true,
    allowMessages: true,
    notificationsEnabled: true
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    setLoading(true);
    try {
      const data = await datingProfileService.getPreferences();
      setPreferences({
        ageRangeMin: data.ageRangeMin ?? 18,
        ageRangeMax: data.ageRangeMax ?? 50,
        locationRadius: data.locationRadius ?? 50,
        genderPreferences: data.genderPreferences || [],
        relationshipGoals: data.relationshipGoals || [],
        interests: data.interests || [],
        heightRangeMin: data.heightRangeMin || '',
        heightRangeMax: data.heightRangeMax || '',
        bodyTypes: data.bodyTypes || [],
        showMyProfile: data.showMyProfile ?? true,
        allowMessages: data.allowMessages ?? true,
        notificationsEnabled: data.notificationsEnabled ?? true
      });
    } catch (err) {
      console.error('Failed to load preferences:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await datingProfileService.updatePreferences({
        ...preferences,
        heightRangeMin: preferences.heightRangeMin ? Number(preferences.heightRangeMin) : null,
        heightRangeMax: preferences.heightRangeMax ? Number(preferences.heightRangeMax) : null
      });
      setSuccess('Preferences saved successfully');
    } catch (err) {
      setError(err || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const toggleArrayValue = (field, value) => {
    setPreferences((prev) => {
      const current = prev[field] || [];
      const exists = current.includes(value);
      return { ...prev, [field]: exists ? current.filter((v) => v !== value) : [...current, value] };
    });
  };

  if (loading) {
    return (
      <div className="preferences-container loading">
        <div className="spinner" />
        <p>Loading preferences...</p>
      </div>
    );
  }

  return (
    <div className="preferences-container">
      <div className="settings-header">
        <button type="button" className="btn-back" onClick={onBack}>Back</button>
        <h1>Dating Preferences</h1>
        <div style={{ width: 44 }} />
      </div>

      {error && <div className="settings-error">{error}</div>}
      {success && <div className="settings-success">{success}</div>}

      <div className="preferences-form">
        {/* Age Range */}
        <div className="preferences-group">
          <h3>Age Range</h3>
          <div className="range-inputs">
            <label className="range-field" htmlFor="age-min">
              <span>From</span>
              <input
                id="age-min"
                type="number"
                min="18"
                max="120"
                value={preferences.ageRangeMin}
                onChange={(e) => setPreferences((p) => ({ ...p, ageRangeMin: Number(e.target.value) }))}
              />
            </label>
            <span className="range-separator">-</span>
            <label className="range-field" htmlFor="age-max">
              <span>To</span>
              <input
                id="age-max"
                type="number"
                min="18"
                max="120"
                value={preferences.ageRangeMax}
                onChange={(e) => setPreferences((p) => ({ ...p, ageRangeMax: Number(e.target.value) }))}
              />
            </label>
          </div>

        {/* Location Radius */}
        <div className="preferences-group">
          <h3>Location Radius</h3>
          <div className="range-slider-container">
            <input
              type="range"
              min="1"
              max="500"
              value={preferences.locationRadius}
              onChange={(e) => setPreferences((p) => ({ ...p, locationRadius: Number(e.target.value) }))}
              className="range-slider"
            />
            <span className="range-value">{preferences.locationRadius} km</span>
          </div>

        {/* Gender Preferences */}
        <div className="preferences-group">
          <h3>Gender Preferences</h3>
          <div className="checkbox-grid">
            {GENDER_OPTIONS.map((gender) => (
              <label key={gender} className="checkbox-chip">
                <input
                  type="checkbox"
                  checked={preferences.genderPreferences.includes(gender)}
                  onChange={() => toggleArrayValue('genderPreferences', gender)}
                />
                <span>{gender.charAt(0).toUpperCase() + gender.slice(1)}</span>
              </label>
            ))}
          </div>

        {/* Relationship Goals */}
        <div className="preferences-group">
          <h3>Relationship Goals</h3>
          <div className="checkbox-grid">
            {RELATIONSHIP_GOALS_OPTIONS.map((goal) => (
              <label key={goal} className="checkbox-chip">
                <input
                  type="checkbox"
                  checked={preferences.relationshipGoals.includes(goal)}
                  onChange={() => toggleArrayValue('relationshipGoals', goal)}
                />
                <span>{goal.charAt(0).toUpperCase() + goal.slice(1)}</span>
              </label>
            ))}
          </div>

        {/* Interests */}
        <div className="preferences-group">
          <h3>Interests</h3>
          <div className="checkbox-grid">
            {INTEREST_SUGGESTIONS.map((interest) => (
              <label key={interest} className="checkbox-chip">
                <input
                  type="checkbox"
                  checked={preferences.interests.includes(interest)}
                  onChange={() => toggleArrayValue('interests', interest)}
                />
                <span>{interest.charAt(0).toUpperCase() + interest.slice(1)}</span>
              </label>
            ))}
          </div>

        {/* Height Range */}
        <div className="preferences-group">
          <h3>Height Range (cm)</h3>
          <div className="range-inputs">
            <label className="range-field" htmlFor="height-min">
              <span>Min</span>
              <input
                id="height-min"
                type="number"
                min="100"
                max="250"
                value={preferences.heightRangeMin}
                onChange={(e) => setPreferences((p) => ({ ...p, heightRangeMin: e.target.value }))}
                placeholder="Any"
              />
            </label>
            <span className="range-separator">-</span>
            <label className="range-field" htmlFor="height-max">
              <span>Max</span>
              <input
                id="height-max"
                type="number"
                min="100"
                max="250"
                value={preferences.heightRangeMax}
                onChange={(e) => setPreferences((p) => ({ ...p, heightRangeMax: e.target.value }))}
                placeholder="Any"
              />
            </label>
          </div>

        {/* Body Types */}
        <div className="preferences-group">
          <h3>Body Types</h3>
          <div className="checkbox-grid">
            {BODY_TYPE_OPTIONS.map((type) => (
              <label key={type} className="checkbox-chip">
                <input
                  type="checkbox"
                  checked={preferences.bodyTypes.includes(type)}
                  onChange={() => toggleArrayValue('bodyTypes', type)}
                />
                <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
              </label>
            ))}
          </div>

        {/* Privacy Settings */}
        <div className="preferences-group">
          <h3>Privacy Settings</h3>
          <div className="toggle-list">
            <label className="toggle-item" htmlFor="show-profile">
              <div className="toggle-info">
                <strong>Show My Profile</strong>
                <span>Appear in discovery for others</span>
              </div>
              <input
                id="show-profile"
                type="checkbox"
                checked={preferences.showMyProfile}
                onChange={(e) => setPreferences((p) => ({ ...p, showMyProfile: e.target.checked }))}
                className="toggle-switch"
              />
            </label>
            <label className="toggle-item" htmlFor="allow-messages">
              <div className="toggle-info">
                <strong>Allow Messages</strong>
                <span>Receive messages from matches</span>
              </div>
              <input
                id="allow-messages"
                type="checkbox"
                checked={preferences.allowMessages}
                onChange={(e) => setPreferences((p) => ({ ...p, allowMessages: e.target.checked }))}
                className="toggle-switch"
              />
            </label>
            <label className="toggle-item" htmlFor="notifications">
              <div className="toggle-info">
                <strong>Notifications</strong>
                <span>Push and email notifications</span>
              </div>
              <input
                id="notifications"
                type="checkbox"
                checked={preferences.notificationsEnabled}
                onChange={(e) => setPreferences((p) => ({ ...p, notificationsEnabled: e.target.checked }))}
                className="toggle-switch"
              />
            </label>
          </div>

        <button type="button" className="btn-save-preferences" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
  );
};

export default DatingPreferences;
