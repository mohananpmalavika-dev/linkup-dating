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

const FLEXIBILITY_MODES = [
  { value: 'strict', label: 'Strict', description: 'Only show profiles that match all your preferences exactly.' },
  { value: 'balanced', label: 'Balanced', description: 'A good mix of compatibility and variety.' },
  { value: 'open', label: 'Open', description: 'Show a wider range of profiles, including some outside your preferences.' }
];

const COMPATIBILITY_QUESTIONS = [
  { id: 'weekendStyle', label: 'Weekend Style', options: ['chill at home', 'outdoor adventure', 'social gatherings', 'productive projects'] },
  { id: 'communicationStyle', label: 'Communication Style', options: ['text throughout the day', 'check in once daily', 'prefer calls', 'keep it light'] },
  { id: 'socialEnergy', label: 'Social Energy', options: ['introvert', 'ambivert', 'extrovert', 'depends on the day'] },
  { id: 'planningStyle', label: 'Planning Style', options: ['spontaneous', 'plan ahead', 'mix of both', 'go with the flow'] },
  { id: 'affectionStyle', label: 'Affection Style', options: ['physical touch', 'words of affirmation', 'acts of service', 'quality time'] },
  { id: 'conflictStyle', label: 'Conflict Approach', options: ['discuss immediately', 'cool off first', 'avoid confrontation', 'seek compromise'] }
];

const DEFAULT_DEAL_BREAKERS = {
  enforceAgeRange: false,
  enforceLocationRadius: false,
  onlyVerifiedProfiles: false,
  enforceRelationshipGoals: false,
  requireSharedInterests: false,
  enforceHeightRange: false,
  enforceBodyType: false,
  requireCompletedProfiles: false
};

const DEFAULT_FLEXIBILITY = {
  mode: 'balanced',
  learnFromActivity: true
};

const DEFAULT_COMPATIBILITY_ANSWERS = {
  weekendStyle: '',
  communicationStyle: '',
  socialEnergy: '',
  planningStyle: '',
  affectionStyle: '',
  conflictStyle: ''
};

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
    notificationsEnabled: true,
    dealBreakers: { ...DEFAULT_DEAL_BREAKERS },
    preferenceFlexibility: { ...DEFAULT_FLEXIBILITY },
    compatibilityAnswers: { ...DEFAULT_COMPATIBILITY_ANSWERS }
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
        notificationsEnabled: data.notificationsEnabled ?? true,
        dealBreakers: { ...DEFAULT_DEAL_BREAKERS, ...(data.dealBreakers || {}) },
        preferenceFlexibility: { ...DEFAULT_FLEXIBILITY, ...(data.preferenceFlexibility || {}) },
        compatibilityAnswers: { ...DEFAULT_COMPATIBILITY_ANSWERS, ...(data.compatibilityAnswers || {}) }
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

  const toggleDealBreaker = (key) => {
    setPreferences((prev) => ({
      ...prev,
      dealBreakers: { ...prev.dealBreakers, [key]: !prev.dealBreakers[key] }
    }));
  };

  const setFlexibilityMode = (mode) => {
    setPreferences((prev) => ({
      ...prev,
      preferenceFlexibility: { ...prev.preferenceFlexibility, mode }
    }));
  };

  const toggleLearnFromActivity = () => {
    setPreferences((prev) => ({
      ...prev,
      preferenceFlexibility: { ...prev.preferenceFlexibility, learnFromActivity: !prev.preferenceFlexibility.learnFromActivity }
    }));
  };

  const setCompatibilityAnswer = (questionId, answer) => {
    setPreferences((prev) => ({
      ...prev,
      compatibilityAnswers: { ...prev.compatibilityAnswers, [questionId]: answer }
    }));
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
        </div>

        {/* Deal Breakers */}
        <div className="preferences-group">
          <h3>Deal Breakers</h3>
          <p className="group-hint">Profiles matching these criteria will be excluded from your results.</p>
          <div className="toggle-list">
            <label className="toggle-item" htmlFor="deal-age">
              <div className="toggle-info">
                <strong>Enforce Age Range</strong>
                <span>Hide profiles outside your preferred age range</span>
              </div>
              <input
                id="deal-age"
                type="checkbox"
                checked={preferences.dealBreakers.enforceAgeRange}
                onChange={() => toggleDealBreaker('enforceAgeRange')}
                className="toggle-switch"
              />
            </label>
            <label className="toggle-item" htmlFor="deal-distance">
              <div className="toggle-info">
                <strong>Enforce Distance</strong>
                <span>Hide profiles outside your location radius</span>
              </div>
              <input
                id="deal-distance"
                type="checkbox"
                checked={preferences.dealBreakers.enforceLocationRadius}
                onChange={() => toggleDealBreaker('enforceLocationRadius')}
                className="toggle-switch"
              />
            </label>
            <label className="toggle-item" htmlFor="deal-verified">
              <div className="toggle-info">
                <strong>Verified Profiles Only</strong>
                <span>Only show profiles that have been verified</span>
              </div>
              <input
                id="deal-verified"
                type="checkbox"
                checked={preferences.dealBreakers.onlyVerifiedProfiles}
                onChange={() => toggleDealBreaker('onlyVerifiedProfiles')}
                className="toggle-switch"
              />
            </label>
            <label className="toggle-item" htmlFor="deal-goals">
              <div className="toggle-info">
                <strong>Enforce Relationship Goals</strong>
                <span>Hide profiles with different relationship goals</span>
              </div>
              <input
                id="deal-goals"
                type="checkbox"
                checked={preferences.dealBreakers.enforceRelationshipGoals}
                onChange={() => toggleDealBreaker('enforceRelationshipGoals')}
                className="toggle-switch"
              />
            </label>
            <label className="toggle-item" htmlFor="deal-interests">
              <div className="toggle-info">
                <strong>Require Shared Interests</strong>
                <span>Only show profiles with at least one shared interest</span>
              </div>
              <input
                id="deal-interests"
                type="checkbox"
                checked={preferences.dealBreakers.requireSharedInterests}
                onChange={() => toggleDealBreaker('requireSharedInterests')}
                className="toggle-switch"
              />
            </label>
            <label className="toggle-item" htmlFor="deal-height">
              <div className="toggle-info">
                <strong>Enforce Height Range</strong>
                <span>Hide profiles outside your preferred height range</span>
              </div>
              <input
                id="deal-height"
                type="checkbox"
                checked={preferences.dealBreakers.enforceHeightRange}
                onChange={() => toggleDealBreaker('enforceHeightRange')}
                className="toggle-switch"
              />
            </label>
            <label className="toggle-item" htmlFor="deal-body">
              <div className="toggle-info">
                <strong>Enforce Body Type</strong>
                <span>Only show profiles matching your selected body types</span>
              </div>
              <input
                id="deal-body"
                type="checkbox"
                checked={preferences.dealBreakers.enforceBodyType}
                onChange={() => toggleDealBreaker('enforceBodyType')}
                className="toggle-switch"
              />
            </label>
            <label className="toggle-item" htmlFor="deal-complete">
              <div className="toggle-info">
                <strong>Require Completed Profiles</strong>
                <span>Hide profiles with less than 60% completion</span>
              </div>
              <input
                id="deal-complete"
                type="checkbox"
                checked={preferences.dealBreakers.requireCompletedProfiles}
                onChange={() => toggleDealBreaker('requireCompletedProfiles')}
                className="toggle-switch"
              />
            </label>
          </div>
        </div>

        {/* Preference Flexibility */}
        <div className="preferences-group">
          <h3>Preference Flexibility</h3>
          <div className="flexibility-modes">
            {FLEXIBILITY_MODES.map((mode) => (
              <label key={mode.value} className={`flexibility-card ${preferences.preferenceFlexibility.mode === mode.value ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="flexibility-mode"
                  value={mode.value}
                  checked={preferences.preferenceFlexibility.mode === mode.value}
                  onChange={() => setFlexibilityMode(mode.value)}
                />
                <div className="flexibility-content">
                  <strong>{mode.label}</strong>
                  <span>{mode.description}</span>
                </div>
              </label>
            ))}
          </div>
          <label className="toggle-item" htmlFor="learn-activity">
            <div className="toggle-info">
              <strong>Learn From My Activity</strong>
              <span>Improve recommendations based on who you like and pass</span>
            </div>
            <input
              id="learn-activity"
              type="checkbox"
              checked={preferences.preferenceFlexibility.learnFromActivity}
              onChange={toggleLearnFromActivity}
              className="toggle-switch"
            />
          </label>
        </div>

        {/* Compatibility Questions */}
        <div className="preferences-group">
          <h3>Compatibility Questions</h3>
          <p className="group-hint">Answer these to improve your match compatibility scores.</p>
          <div className="compatibility-questions">
            {COMPATIBILITY_QUESTIONS.map((question) => (
              <div key={question.id} className="question-card">
                <label className="question-label">{question.label}</label>
                <select
                  value={preferences.compatibilityAnswers[question.id] || ''}
                  onChange={(e) => setCompatibilityAnswer(question.id, e.target.value)}
                >
                  <option value="">Select...</option>
                  {question.options.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
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
        </div>

        <button type="button" className="btn-save-preferences" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
};

export default DatingPreferences;

