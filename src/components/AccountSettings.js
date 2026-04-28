import React, { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import datingProfileService from '../services/datingProfileService';
import { getStoredUserData } from '../utils/auth';
import NotificationSettingsModal from './NotificationSettingsModal';
import '../styles/AccountSettings.css';

const GENDER_OPTIONS = ['male', 'female', 'non-binary', 'other'];
const RELATIONSHIP_GOALS_OPTIONS = [
  'dating',
  'relationship',
  'casual',
  'unsure',
  'friendship',
  'marriage'
];
const BODY_TYPE_OPTIONS = ['slim', 'athletic', 'average', 'curvy', 'muscular', 'heavyset'];
const INTEREST_SUGGESTIONS = [
  'music', 'travel', 'fitness', 'reading', 'cooking', 'gaming',
  'photography', 'art', 'hiking', 'movies', 'sports', 'dancing',
  'yoga', 'technology', 'fashion', 'pets', 'politics', 'science'
];
const PREFERENCE_MODE_OPTIONS = [
  {
    value: 'strict',
    label: 'Strict',
    description: 'Keep discovery close to your preferred ranges and goals.'
  },
  {
    value: 'balanced',
    label: 'Balanced',
    description: 'Prioritize your preferences while still allowing strong nearby fits.'
  },
  {
    value: 'open',
    label: 'Open',
    description: 'Use dealbreakers only and stay flexible with the rest.'
  }
];
const MESSAGE_GATING_OPTIONS = [
  {
    value: 'balanced',
    label: 'Balanced',
    description: 'Allow normal intros while still filtering hidden or quiet profiles.'
  },
  {
    value: 'strict',
    label: 'Strict',
    description: 'Only let well-completed, trusted profiles send a first intro.'
  },
  {
    value: 'trusted_only',
    label: 'Trusted Only',
    description: 'Reserve first-message access for the strongest trust signals.'
  }
];
const PROFILE_VISIBILITY_OPTIONS = [
  {
    value: 'discoverable',
    label: 'Discoverable',
    description: 'Show up normally in dating discovery.'
  },
  {
    value: 'limited',
    label: 'Limited',
    description: 'Only show to verified or high-trust members.'
  },
  {
    value: 'hidden',
    label: 'Hidden',
    description: 'Pause new discovery while keeping your account intact.'
  }
];
const DEAL_BREAKER_QUESTIONS = [
  {
    id: 'enforceAgeRange',
    label: 'Outside my age range',
    description: 'Hide profiles that fall outside your chosen age range.'
  },
  {
    id: 'enforceLocationRadius',
    label: 'Outside my distance radius',
    description: 'Remove profiles beyond your preferred location radius.'
  },
  {
    id: 'onlyVerifiedProfiles',
    label: 'Unverified profiles',
    description: 'Only show profiles that have completed verification.'
  },
  {
    id: 'enforceRelationshipGoals',
    label: 'Different relationship goals',
    description: 'Hide profiles whose relationship goals do not match yours.'
  },
  {
    id: 'requireSharedInterests',
    label: 'No shared interests',
    description: 'Require at least one shared or preferred interest.'
  },
  {
    id: 'enforceHeightRange',
    label: 'Outside my height range',
    description: 'If you set a height range, treat it as a hard rule.'
  },
  {
    id: 'enforceBodyType',
    label: 'Outside my selected body types',
    description: 'Treat selected body types as a required filter.'
  },
  {
    id: 'requireCompletedProfiles',
    label: 'Incomplete profiles',
    description: 'Hide profiles that are still mostly unfinished.'
  }
];
const COMPATIBILITY_QUESTIONS = [
  {
    id: 'weekendStyle',
    label: 'What kind of weekend feels best to you?',
    options: [
      { value: 'outdoors', label: 'Outdoors and exploring' },
      { value: 'cozy', label: 'Cozy and low-key' },
      { value: 'social', label: 'Going out with people' }
    ]
  },
  {
    id: 'communicationStyle',
    label: 'How do you like to communicate in a relationship?',
    options: [
      { value: 'direct', label: 'Direct and honest' },
      { value: 'steady', label: 'Consistent check-ins' },
      { value: 'deep', label: 'Long thoughtful talks' }
    ]
  },
  {
    id: 'socialEnergy',
    label: 'Which social rhythm sounds most like you?',
    options: [
      { value: 'small_circle', label: 'Small circle' },
      { value: 'balanced', label: 'A healthy mix' },
      { value: 'high_energy', label: 'Always up for plans' }
    ]
  },
  {
    id: 'planningStyle',
    label: 'How do you approach plans?',
    options: [
      { value: 'planner', label: 'I love a plan' },
      { value: 'balanced', label: 'Some structure, some spontaneity' },
      { value: 'spontaneous', label: 'Go with the flow' }
    ]
  },
  {
    id: 'affectionStyle',
    label: 'What helps you feel closest to someone?',
    options: [
      { value: 'quality_time', label: 'Quality time' },
      { value: 'words', label: 'Words and reassurance' },
      { value: 'acts', label: 'Thoughtful actions' }
    ]
  },
  {
    id: 'conflictStyle',
    label: 'How do you prefer to handle tension?',
    options: [
      { value: 'talk_now', label: 'Talk it through quickly' },
      { value: 'pause_then_talk', label: 'Take a beat, then talk' },
      { value: 'gentle', label: 'Keep it calm and gentle' }
    ]
  }
];

const createEmptyLearningSignals = () => ({
  interests: {},
  relationshipGoals: {},
  bodyTypes: {},
  ageBands: {},
  verification: {}
});

const createDefaultLearningProfile = () => ({
  positiveSignals: createEmptyLearningSignals(),
  negativeSignals: createEmptyLearningSignals(),
  totalPositiveActions: 0,
  totalNegativeActions: 0,
  lastInteractionAt: null
});

const createDefaultPreferences = () => ({
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
  dealBreakers: {
    enforceAgeRange: false,
    enforceLocationRadius: false,
    onlyVerifiedProfiles: false,
    enforceRelationshipGoals: false,
    requireSharedInterests: false,
    enforceHeightRange: false,
    enforceBodyType: false,
    requireCompletedProfiles: false
  },
  preferenceFlexibility: {
    mode: 'balanced',
    learnFromActivity: true,
    engagementLoops: {
      audioPromptsEnabled: true,
      warmUpSpacesEnabled: true,
      datingIntentOnly: true
    },
    safetyControls: {
      quietMode: false,
      messageGating: 'balanced',
      profileVisibility: 'discoverable',
      hideActivityStatus: false,
      autoEscalateModeration: true
    }
  },
  compatibilityAnswers: COMPATIBILITY_QUESTIONS.reduce((answers, question) => ({
    ...answers,
    [question.id]: ''
  }), {}),
  learningProfile: createDefaultLearningProfile()
});

const formatLearningLabel = (value) => {
  if (!value) {
    return '';
  }

  if (/^\d/.test(value)) {
    return value;
  }

  return value
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const getTopSignalKeys = (signalMap = {}, limit = 2) =>
  Object.entries(signalMap)
    .filter(([, score]) => Number(score) > 0)
    .sort((leftEntry, rightEntry) => Number(rightEntry[1]) - Number(leftEntry[1]))
    .map(([key]) => key)
    .slice(0, limit);

const buildLearningHighlights = (learningProfile) => {
  const positiveSignals = learningProfile?.positiveSignals || {};
  const highlights = [
    ...getTopSignalKeys(positiveSignals.interests, 2),
    ...getTopSignalKeys(positiveSignals.relationshipGoals, 1),
    ...getTopSignalKeys(positiveSignals.ageBands, 1).map((ageBand) => `${ageBand} age band`),
    ...getTopSignalKeys(positiveSignals.bodyTypes, 1)
  ];

  return highlights.map(formatLearningLabel).slice(0, 4);
};

const AccountSettings = ({ onBack, onLogout }) => {
  const currentUser = getStoredUserData();
  const [activeTab, setActiveTab] = useState('security');
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetId, setResetId] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [devResetCode, setDevResetCode] = useState('');

  const [preferences, setPreferences] = useState(createDefaultPreferences());
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    setPreferencesLoading(true);
    try {
      const data = await datingProfileService.getPreferences();
      const defaults = createDefaultPreferences();
      setPreferences({
        ...defaults,
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
        dealBreakers: {
          ...defaults.dealBreakers,
          ...(data.dealBreakers || {})
        },
        preferenceFlexibility: {
          ...defaults.preferenceFlexibility,
          ...(data.preferenceFlexibility || {}),
          engagementLoops: {
            ...defaults.preferenceFlexibility.engagementLoops,
            ...(data.preferenceFlexibility?.engagementLoops || {})
          },
          safetyControls: {
            ...defaults.preferenceFlexibility.safetyControls,
            ...(data.preferenceFlexibility?.safetyControls || {})
          }
        },
        compatibilityAnswers: {
          ...defaults.compatibilityAnswers,
          ...(data.compatibilityAnswers || {})
        },
        learningProfile: {
          ...defaults.learningProfile,
          ...(data.learningProfile || {}),
          positiveSignals: {
            ...defaults.learningProfile.positiveSignals,
            ...(data.learningProfile?.positiveSignals || {})
          },
          negativeSignals: {
            ...defaults.learningProfile.negativeSignals,
            ...(data.learningProfile?.negativeSignals || {})
          }
        }
      });
    } catch (err) {
      console.error('Failed to load preferences:', err);
    } finally {
      setPreferencesLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    setPreferencesSaving(true);
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
      setPreferencesSaving(false);
    }
  };

  const toggleArrayValue = (field, value) => {
    setPreferences((prev) => {
      const current = prev[field] || [];
      const exists = current.includes(value);
      return { ...prev, [field]: exists ? current.filter((v) => v !== value) : [...current, value] };
    });
  };

  const toggleDealBreaker = (field) => {
    setPreferences((prev) => ({
      ...prev,
      dealBreakers: {
        ...prev.dealBreakers,
        [field]: !prev.dealBreakers[field]
      }
    }));
  };

  const updatePreferenceFlexibilitySetting = (section, field, value) => {
    setPreferences((prev) => ({
      ...prev,
      preferenceFlexibility: {
        ...prev.preferenceFlexibility,
        [section]: {
          ...(prev.preferenceFlexibility?.[section] || {}),
          [field]: value
        }
      }
    }));
  };

  const updateCompatibilityAnswer = (field, value) => {
    setPreferences((prev) => ({
      ...prev,
      compatibilityAnswers: {
        ...prev.compatibilityAnswers,
        [field]: value
      }
    }));
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText.trim().toUpperCase() !== 'DELETE') {
      setError('Type DELETE to confirm account deletion');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authService.deleteAccount({ confirmationText: deleteConfirmationText.trim() });
      setSuccess('Account deleted successfully. You will be logged out.');
      setTimeout(() => { if (typeof onLogout === 'function') { onLogout(); } }, 2000);
    } catch (err) {
      setError(err?.error || err.response?.data?.error || 'Failed to delete account');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPasswordReset = async () => {
    if (!currentUser?.email) { setError('Unable to determine your account email'); return; }
    setResetLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await authService.requestPasswordReset(currentUser.email);
      setResetId(response.resetId || '');
      setDevResetCode(response.devResetCode || '');
      setSuccess(response.message || 'Password reset code sent');
    } catch (err) {
      setError(err?.error || err || 'Failed to request password reset');
    } finally {
      setResetLoading(false);
    }
  };

  const handleCompletePasswordReset = async () => {
    if (!resetId || !resetCode || !newPassword || !confirmPassword) {
      setError('Complete all password reset fields first');
      return;
    }
    setResetLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await authService.resetPassword({
        email: currentUser?.email, resetId, resetCode, newPassword, confirmPassword
      });
      setSuccess(response.message || 'Password reset successfully');
      setResetCode(''); setNewPassword(''); setConfirmPassword(''); setDevResetCode('');
    } catch (err) {
      setError(err?.error || err || 'Failed to reset password');
    } finally {
      setResetLoading(false);
    }
  };

  const renderPreferencesTab = () => {
    const learningHighlights = buildLearningHighlights(preferences.learningProfile);

    return (
    <div className="preferences-section">
      {preferencesLoading ? (
        <div className="preferences-loading">
          <div className="spinner"></div>
          <p>Loading your preferences...</p>
        </div>
      ) : (
        <div className="preferences-form">
          <div className="preferences-group">
            <h3>Age Range</h3>
            <div className="range-inputs">
              <label className="range-field">
                <span>From</span>
                <input
                  type="number"
                  min="18"
                  max="120"
                  value={preferences.ageRangeMin}
                  onChange={(e) =>
                    setPreferences((p) => ({ ...p, ageRangeMin: Number(e.target.value) }))
                  }
                />
              </label>
              <span className="range-separator">-</span>
              <label className="range-field">
                <span>To</span>
                <input
                  type="number"
                  min="18"
                  max="120"
                  value={preferences.ageRangeMax}
                  onChange={(e) =>
                    setPreferences((p) => ({ ...p, ageRangeMax: Number(e.target.value) }))
                  }
                />
              </label>
            </div>
          </div>

          <div className="preferences-group">
            <h3>Location Radius</h3>
            <div className="range-slider-container">
              <input
                type="range"
                min="1"
                max="500"
                value={preferences.locationRadius}
                onChange={(e) =>
                  setPreferences((p) => ({ ...p, locationRadius: Number(e.target.value) }))
                }
                className="range-slider"
              />
              <span className="range-value">{preferences.locationRadius} km</span>
            </div>
          </div>

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

          <div className="preferences-group">
            <h3>Height Range (cm)</h3>
            <div className="range-inputs">
              <label className="range-field">
                <span>Min</span>
                <input
                  type="number"
                  min="100"
                  max="250"
                  value={preferences.heightRangeMin}
                  onChange={(e) =>
                    setPreferences((p) => ({ ...p, heightRangeMin: e.target.value }))
                  }
                  placeholder="Any"
                />
              </label>
              <span className="range-separator">-</span>
              <label className="range-field">
                <span>Max</span>
                <input
                  type="number"
                  min="100"
                  max="250"
                  value={preferences.heightRangeMax}
                  onChange={(e) =>
                    setPreferences((p) => ({ ...p, heightRangeMax: e.target.value }))
                  }
                  placeholder="Any"
                />
              </label>
            </div>
          </div>

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

          <div className="preferences-group">
            <h3>Discovery Style</h3>
            <p className="preferences-helper">
              Choose how closely discovery should follow your soft preferences. Dealbreakers
              still apply in every mode.
            </p>
            <div className="segmented-control">
              {PREFERENCE_MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`segmented-option ${
                    preferences.preferenceFlexibility.mode === option.value ? 'active' : ''
                  }`}
                  onClick={() =>
                    setPreferences((prev) => ({
                      ...prev,
                      preferenceFlexibility: {
                        ...prev.preferenceFlexibility,
                        mode: option.value
                      }
                    }))
                  }
                >
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>
            <label className="toggle-item toggle-item-inline">
              <div className="toggle-info">
                <strong>Learning Algorithm</strong>
                <span>Use your likes, passes, and superlikes to improve future suggestions.</span>
              </div>
              <input
                type="checkbox"
                checked={preferences.preferenceFlexibility.learnFromActivity}
                onChange={(event) =>
                  setPreferences((prev) => ({
                    ...prev,
                    preferenceFlexibility: {
                      ...prev.preferenceFlexibility,
                      learnFromActivity: event.target.checked
                    }
                  }))
                }
                className="toggle-switch"
              />
            </label>
          </div>

          <div className="preferences-group">
            <h3>Warm-Up Spaces</h3>
            <p className="preferences-helper">
              Keep pre-match engagement lightweight and dating-first. These spaces stay gated and
              never turn into a general social feed.
            </p>
            <div className="toggle-list">
              <label className="toggle-item">
                <div className="toggle-info">
                  <strong>Warm-Up Spaces</strong>
                  <span>Join small themed rooms before matching when you want a softer start.</span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.preferenceFlexibility.engagementLoops.warmUpSpacesEnabled}
                  onChange={(event) =>
                    updatePreferenceFlexibilitySetting(
                      'engagementLoops',
                      'warmUpSpacesEnabled',
                      event.target.checked
                    )
                  }
                  className="toggle-switch"
                />
              </label>
              <label className="toggle-item">
                <div className="toggle-info">
                  <strong>Audio Prompts</strong>
                  <span>Allow optional short audio warm-ups when a room supports voice-first intros.</span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.preferenceFlexibility.engagementLoops.audioPromptsEnabled}
                  onChange={(event) =>
                    updatePreferenceFlexibilitySetting(
                      'engagementLoops',
                      'audioPromptsEnabled',
                      event.target.checked
                    )
                  }
                  className="toggle-switch"
                />
              </label>
            </div>
          </div>

          <div className="preferences-group">
            <h3>Trust-First Controls</h3>
            <p className="preferences-helper">
              Shape how visible and reachable you are before a match, with stronger defaults for
              privacy and safety.
            </p>

            <div className="toggle-list">
              <label className="toggle-item">
                <div className="toggle-info">
                  <strong>Quiet Mode</strong>
                  <span>Temporarily stop new intros while keeping your existing matches intact.</span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.preferenceFlexibility.safetyControls.quietMode}
                  onChange={(event) =>
                    updatePreferenceFlexibilitySetting(
                      'safetyControls',
                      'quietMode',
                      event.target.checked
                    )
                  }
                  className="toggle-switch"
                />
              </label>
              <label className="toggle-item">
                <div className="toggle-info">
                  <strong>Hide Activity Status</strong>
                  <span>Remove “online” and recent activity hints from discovery cards.</span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.preferenceFlexibility.safetyControls.hideActivityStatus}
                  onChange={(event) =>
                    updatePreferenceFlexibilitySetting(
                      'safetyControls',
                      'hideActivityStatus',
                      event.target.checked
                    )
                  }
                  className="toggle-switch"
                />
              </label>
              <label className="toggle-item">
                <div className="toggle-info">
                  <strong>Auto-Escalate Harassment Reports</strong>
                  <span>Push serious or repeated reports into stronger moderation review faster.</span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.preferenceFlexibility.safetyControls.autoEscalateModeration}
                  onChange={(event) =>
                    updatePreferenceFlexibilitySetting(
                      'safetyControls',
                      'autoEscalateModeration',
                      event.target.checked
                    )
                  }
                  className="toggle-switch"
                />
              </label>
            </div>

            <div className="preferences-group">
              <h3>Message Gating</h3>
              <div className="segmented-control">
                {MESSAGE_GATING_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`segmented-option ${
                      preferences.preferenceFlexibility.safetyControls.messageGating === option.value
                        ? 'active'
                        : ''
                    }`}
                    onClick={() =>
                      updatePreferenceFlexibilitySetting('safetyControls', 'messageGating', option.value)
                    }
                  >
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="preferences-group">
              <h3>Profile Visibility</h3>
              <div className="segmented-control">
                {PROFILE_VISIBILITY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`segmented-option ${
                      preferences.preferenceFlexibility.safetyControls.profileVisibility === option.value
                        ? 'active'
                        : ''
                    }`}
                    onClick={() =>
                      updatePreferenceFlexibilitySetting('safetyControls', 'profileVisibility', option.value)
                    }
                  >
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="preferences-group">
            <h3>Dealbreaker Questions</h3>
            <p className="preferences-helper">
              Turn these on when you want LinkUp to remove profiles instead of just lowering
              their score.
            </p>
            <div className="question-list">
              {DEAL_BREAKER_QUESTIONS.map((question) => (
                <label key={question.id} className="question-card checkbox-card">
                  <div className="question-copy">
                    <strong>{question.label}</strong>
                    <span>{question.description}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(preferences.dealBreakers[question.id])}
                    onChange={() => toggleDealBreaker(question.id)}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="preferences-group">
            <h3>Compatibility Questions</h3>
            <p className="preferences-helper">
              These answers help LinkUp spot emotional and lifestyle fit, not just filters.
            </p>
            <div className="question-list">
              {COMPATIBILITY_QUESTIONS.map((question) => (
                <div key={question.id} className="question-card">
                  <div className="question-copy">
                    <strong>{question.label}</strong>
                  </div>
                  <div className="option-grid">
                    {question.options.map((option) => (
                      <label
                        key={option.value}
                        className={`option-pill ${
                          preferences.compatibilityAnswers[question.id] === option.value
                            ? 'selected'
                            : ''
                        }`}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={option.value}
                          checked={preferences.compatibilityAnswers[question.id] === option.value}
                          onChange={() => updateCompatibilityAnswer(question.id, option.value)}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="preferences-group">
            <h3>Learning Snapshot</h3>
            <div className="insight-panel">
              {preferences.preferenceFlexibility.learnFromActivity ? (
                <>
                  <p>
                    {learningHighlights.length > 0
                      ? 'Right now your recent activity is giving stronger signals around:'
                      : 'LinkUp will start learning as you like, pass, and superlike profiles.'}
                  </p>
                  {learningHighlights.length > 0 ? (
                    <div className="insight-tags">
                      {learningHighlights.map((highlight) => (
                        <span key={highlight} className="insight-tag">{highlight}</span>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <p>Learning is paused. Turn it back on any time to personalize discovery again.</p>
              )}
            </div>
          </div>

          <div className="preferences-group">
            <h3>Privacy Settings</h3>
            <div className="toggle-list">
              <label className="toggle-item">
                <div className="toggle-info">
                  <strong>Show My Profile</strong>
                  <span>Appear in discovery for others</span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.showMyProfile}
                  onChange={(e) =>
                    setPreferences((p) => ({ ...p, showMyProfile: e.target.checked }))
                  }
                  className="toggle-switch"
                />
              </label>
              <label className="toggle-item">
                <div className="toggle-info">
                  <strong>Allow Messages</strong>
                  <span>Receive messages from matches</span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.allowMessages}
                  onChange={(e) =>
                    setPreferences((p) => ({ ...p, allowMessages: e.target.checked }))
                  }
                  className="toggle-switch"
                />
              </label>
              <label className="toggle-item">
                <div className="toggle-info">
                  <strong>Notifications</strong>
                  <span>Push and email notifications</span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.notificationsEnabled}
                  onChange={(e) =>
                    setPreferences((p) => ({
                      ...p,
                      notificationsEnabled: e.target.checked
                    }))
                  }
                  className="toggle-switch"
                />
              </label>
            </div>
          </div>

          <button
            className="btn-save-preferences"
            onClick={handleSavePreferences}
            disabled={preferencesSaving}
          >
            {preferencesSaving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      )}
    </div>
    );
  };

  const renderSecurityTab = () => (
    <div className="security-section">
      <div className="settings-item">
        <div className="setting-info">
          <h3>Password Reset</h3>
          <p>Send a reset code to {currentUser?.email || 'your email'} and choose a new password.</p>
        </div>
        <button className="btn-delete-account" onClick={handleRequestPasswordReset} disabled={resetLoading}>
          {resetLoading ? 'Sending...' : 'Send Reset Code'}
        </button>
      </div>

      {resetId && (
        <>
          <div className="form-group">
            <label htmlFor="reset-code">Reset code</label>
            <input id="reset-code" type="text" value={resetCode}
              onChange={(event) => setResetCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter the 6-digit code" className="form-input" disabled={resetLoading} />
          </div>
          <div className="form-group">
            <label htmlFor="new-password">New password</label>
            <input id="new-password" type="password" value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="At least 8 characters" className="form-input" disabled={resetLoading} />
          </div>
          <div className="form-group">
            <label htmlFor="confirm-password">Confirm new password</label>
            <input id="confirm-password" type="password" value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repeat your new password" className="form-input" disabled={resetLoading} />
          </div>
          {devResetCode && <div className="settings-success">Development reset code: <strong>{devResetCode}</strong></div>}
          <button className="btn-delete-account" onClick={handleCompletePasswordReset}
            disabled={resetLoading || !resetCode || !newPassword || !confirmPassword}>
            {resetLoading ? 'Resetting...' : 'Update Password'}
          </button>
        </>
      )}
    </div>
  );

  const renderAccountTab = () => (
    <div className="account-section">
      <div className="settings-item">
        <div className="setting-info">
          <h3>Delete Account</h3>
          <p>Permanently delete your account and all associated data</p>
        </div>
        <button className="btn-delete-account" onClick={() => setShowDeleteConfirmation(true)} disabled={loading}>
          Delete Account
        </button>
      </div>
    </div>
  );

  return (
    <div className="account-settings-container">
      <div className="settings-header">
        <button className="btn-back" onClick={onBack}>Back</button>
        <h1>Account Settings</h1>
        <div style={{ width: '44px' }} />
      </div>

      <div className="settings-tabs">
        <button className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => { setActiveTab('security'); setError(''); setSuccess(''); }}>Security</button>
        <button className={`tab-btn ${activeTab === 'preferences' ? 'active' : ''}`}
          onClick={() => { setActiveTab('preferences'); setError(''); setSuccess(''); }}>Preferences</button>
        <button className={`tab-btn ${activeTab === 'account' ? 'active' : ''}`}
          onClick={() => { setActiveTab('account'); setError(''); setSuccess(''); }}>Account</button>
        <button 
          className="tab-btn notification-settings-btn"
          onClick={() => setShowNotificationSettings(true)}
          title="Manage notification preferences"
        >
          🔔 Notifications
        </button>
      </div>

      <div className="settings-content">
        {error && <div className="settings-error">{error}</div>}
        {success && <div className="settings-success">{success}</div>}
        {activeTab === 'security' && renderSecurityTab()}
        {activeTab === 'preferences' && renderPreferencesTab()}
        {activeTab === 'account' && renderAccountTab()}
      </div>

      {showNotificationSettings && (
        <NotificationSettingsModal
          isOpen={showNotificationSettings}
          onClose={() => setShowNotificationSettings(false)}
          userId={currentUser?.id}
        />
      )}

      {showDeleteConfirmation && (
        <div className="delete-confirmation-overlay" onClick={() => !loading && setShowDeleteConfirmation(false)}>
          <div className="delete-confirmation-modal" onClick={e => e.stopPropagation()}>
            <div className="delete-modal-header">
              <h2>Delete Account</h2>
              <button className="close-btn" onClick={() => !loading && setShowDeleteConfirmation(false)} disabled={loading}>×</button>
            </div>
            <div className="delete-modal-content">
              <div className="warning-section">
                <span className="warning-icon">⚠️</span>
                <p className="warning-title">This action cannot be undone</p>
                <p className="warning-text">Deleting your account will permanently remove:</p>
              </div>
              <ul className="deletion-effects">
                <li>Your profile and all profile information</li>
                <li>All your photos</li>
                <li>Your matches and conversations</li>
                <li>Your account settings and preferences</li>
                <li>Any reports or blocks you've made</li>
              </ul>
              <div className="form-group">
                <label htmlFor="delete-confirmation">Type DELETE to confirm permanent deletion</label>
                <input id="delete-confirmation" type="text" value={deleteConfirmationText}
                  onChange={e => setDeleteConfirmationText(e.target.value)} placeholder="DELETE"
                  disabled={loading} className="form-input" />
              </div>
              <div className="modal-actions">
                <button className="btn btn-cancel-delete" onClick={() => {
                  setShowDeleteConfirmation(false); setDeleteConfirmationText(''); setError('');
                }} disabled={loading}>Cancel</button>
                <button className="btn btn-confirm-delete" onClick={handleDeleteAccount}
                  disabled={loading || deleteConfirmationText.trim().toUpperCase() !== 'DELETE'}>
                  {loading ? 'Deleting...' : 'Delete My Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountSettings;
