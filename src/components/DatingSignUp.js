import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getTranslationValue } from '../data/translations';
import { API_BASE_URL } from '../utils/api';
import { isValidPincode } from '../utils/ecommerceHelpers';
import {
  KERALA_REGION_OPTIONS,
  getDistrictOptionsForRegion,
  normalizePincodeInput,
  resolveKeralaLocation
} from '../utils/keralaLocation';
import PublicLegalNotice from './PublicLegalNotice';
import '../styles/DatingSignUp.css';

const RELATIONSHIP_INTENT_OPTIONS = [
  { value: 'dating', label: 'Looking to date' },
  { value: 'relationship', label: 'Serious relationship' },
  { value: 'marriage', label: 'Marriage minded' },
  { value: 'casual', label: 'Casual dating' },
  { value: 'friendship', label: 'Friendship first' }
];

const LANGUAGE_OPTIONS = [
  'English',
  'Hindi',
  'Malayalam',
  'Tamil',
  'Telugu',
  'Kannada',
  'Bengali',
  'Marathi'
];

const CONVERSATION_STYLE_OPTIONS = [
  { value: 'direct', label: 'Direct and honest' },
  { value: 'steady', label: 'Consistent check-ins' },
  { value: 'deep', label: 'Long thoughtful talks' }
];

const WEEKEND_STYLE_OPTIONS = [
  { value: 'cozy', label: 'Cozy and low-key' },
  { value: 'outdoors', label: 'Outdoors and exploring' },
  { value: 'social', label: 'Going out with people' }
];

const PLANNING_STYLE_OPTIONS = [
  { value: 'planner', label: 'I like a plan' },
  { value: 'balanced', label: 'Some structure, some spontaneity' },
  { value: 'spontaneous', label: 'Go with the flow' }
];

const SOCIAL_ENERGY_OPTIONS = [
  { value: 'small_circle', label: 'Small circle energy' },
  { value: 'balanced', label: 'A healthy mix' },
  { value: 'high_energy', label: 'Always up for plans' }
];

const MESSAGE_GATING_OPTIONS = [
  { value: 'balanced', label: 'Balanced intros' },
  { value: 'strict', label: 'Trusted intros only' },
  { value: 'trusted_only', label: 'Highest-trust intros' }
];

/**
 * DatingSignUp Component
 * Sign up for dating app with profile creation
 * Uses OTP-based authentication matching the Login flow
 */
const DatingSignUp = ({ language = 'en', onSignUpSuccess, onLoginClick, onBackToLaunch }) => {
  const [step, setStep] = useState(1); // 1: Email OTP, 2: Username, 3: Profile, 4: Photos
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // OTP verification state
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpId, setOtpId] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [verifiedToken, setVerifiedToken] = useState(null);
  const [verifiedUser, setVerifiedUser] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [referralCode, setReferralCode] = useState('');
  const [referralValidated, setReferralValidated] = useState(false);
  const [referralMessage, setReferralMessage] = useState('');
  const [validatingReferral, setValidatingReferral] = useState(false);
  
  // Username state
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState(null); // 'checking', 'available', 'taken'
  const [usernameError, setUsernameError] = useState('');
  const usernameCheckTimeoutRef = React.useRef(null);
  const resendTimerRef = React.useRef(null);

  const [formData, setFormData] = useState({
    firstName: '',
    age: '',
    gender: 'female',
    city: '',
    district: '',
    locality: '',
    pincode: '',
    keralaRegion: '',
    state: '',
    country: '',
    bio: '',
    relationshipGoals: 'dating',
    languages: ['English'],
    religion: '',
    communityPreference: '',
    conversationStyle: '',
    weekendStyle: '',
    planningStyle: '',
    socialEnergy: '',
    messageGating: 'balanced',
    interests: [],
    height: '',
    occupation: '',
    education: '',
    photos: [],
  });

  const INTERESTS = [
    'Travel', 'Fitness', 'Music', 'Art', 'Cooking', 'Gaming', 'Sports',
    'Hiking', 'Photography', 'Reading', 'Movies', 'Yoga', 'Meditation',
  ];
  const districtOptions = getDistrictOptionsForRegion(formData.keralaRegion);

  const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const looksLikePhoneNumber = (value) => /^\+?[0-9\s()-]{7,}$/.test(String(value || '').trim());
  const legalNoticeMessage = getTranslationValue(language, 'public.signupNotice');

  const validateUsername = (value) => {
    return /^[a-zA-Z0-9_-]{3,20}$/.test(value);
  };

  const trackFunnelEvent = async (eventName, payload = {}) => {
    if (!verifiedToken) {
      return;
    }

    try {
      await axios.post(
        `${API_BASE_URL}/dating/funnel/events`,
        {
          eventName,
          ...payload
        },
        {
          headers: { Authorization: `Bearer ${verifiedToken}` }
        }
      );
    } catch (eventError) {
      console.error('Failed to track funnel event:', eventError);
    }
  };

  useEffect(() => {
    const urlCode = new URLSearchParams(window.location.search).get('ref');
    if (urlCode) {
      const normalizedCode = urlCode.trim().toUpperCase();
      setReferralCode(normalizedCode);
      void validateReferralCode(normalizedCode, true);
    }

    return () => {
      if (usernameCheckTimeoutRef.current) {
        clearTimeout(usernameCheckTimeoutRef.current);
      }
      if (resendTimerRef.current) {
        clearInterval(resendTimerRef.current);
      }
    };
  }, []);

  const validateReferralCode = async (value, silent = false) => {
    const normalizedCode = String(value || '').trim().toUpperCase();

    if (!normalizedCode) {
      setReferralValidated(false);
      setReferralMessage('');
      return true;
    }

    setValidatingReferral(true);
    try {
      await axios.post(`${API_BASE_URL}/social/referral/validate`, {
        code: normalizedCode
      });
      setReferralValidated(true);
      setReferralMessage('Referral code validated. Rewards will be applied after signup.');
      return true;
    } catch (err) {
      setReferralValidated(false);
      setReferralMessage(silent ? 'Referral code could not be validated yet.' : 'Referral code is invalid or expired.');
      return false;
    } finally {
      setValidatingReferral(false);
    }
  };

  // Send OTP to email
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const normalizedEmail = email.trim().toLowerCase();

    if (referralCode.trim()) {
      const validReferral = await validateReferralCode(referralCode, false);
      if (!validReferral) {
        setError('Please use a valid referral code or clear the field to continue.');
        return;
      }
    }

    if (!normalizedEmail) {
      setError('Please enter your email');
      return;
    }

    if (looksLikePhoneNumber(email) && !validateEmail(normalizedEmail)) {
      setError('Phone OTP is not available yet. Please use your email address.');
      return;
    }

    if (!validateEmail(normalizedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/send-otp`, {
        email: normalizedEmail,
        purpose: 'signup'
      });

      setOtpId(response.data.otpId || '');
      setOtpSent(true);
      setSuccess(response.data?.message || 'OTP sent to your email!');
      setResendCooldown(60); // 60 second cooldown
      
      // Start countdown timer
      if (resendTimerRef.current) {
        clearInterval(resendTimerRef.current);
      }
      resendTimerRef.current = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) {
            clearInterval(resendTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setOtp('');

    const normalizedEmail = email.trim().toLowerCase();

    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/send-otp`, {
        email: normalizedEmail,
        purpose: 'signup'
      });

      setOtpId(response.data.otpId || '');
      setSuccess(response.data?.message || 'OTP resent to your email!');
      setResendCooldown(60); // Reset cooldown
      
      // Start countdown timer
      if (resendTimerRef.current) {
        clearInterval(resendTimerRef.current);
      }
      resendTimerRef.current = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) {
            clearInterval(resendTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');

    if (!otp.trim()) {
      setError('Please enter the OTP');
      return;
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Please enter the 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/verify-otp`, {
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        otpId
      });

      const { token, user } = response.data;
      setVerifiedToken(token);
      setVerifiedUser(user);
      setStep(2); // Move to username setup
      setSuccess('Email verified! Now set your username.');
      setOtp('');
      setOtpId('');
      setOtpSent(false);
      await Promise.all([
        axios.post(
          `${API_BASE_URL}/dating/funnel/events`,
          { eventName: 'dating_onboarding_started' },
          { headers: { Authorization: `Bearer ${token}` } }
        ).catch(() => {}),
        axios.post(
          `${API_BASE_URL}/dating/funnel/events`,
          { eventName: 'dating_onboarding_email_verified' },
          { headers: { Authorization: `Bearer ${token}` } }
        ).catch(() => {})
      ]);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  // Check username availability
  const checkUsernameAvailability = async (value) => {
    if (!value || value.length < 3) {
      setUsernameStatus(null);
      setUsernameError('');
      return;
    }

    if (!validateUsername(value)) {
      setUsernameStatus(null);
      setUsernameError('Username can only contain letters, numbers, underscores, and dashes (3-20 characters)');
      return;
    }

    setUsernameStatus('checking');
    setUsernameError('');

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/check-username`, {
        username: value
      });

      if (response.data.available) {
        setUsernameStatus('available');
      } else {
        setUsernameStatus('taken');
        setUsernameError('This username is already taken');
      }
    } catch (err) {
      setUsernameStatus(null);
      setUsernameError('Error checking username availability');
    }
  };

  const handleUsernameChange = (value) => {
    setUsername(value);
    
    if (usernameCheckTimeoutRef.current) {
      clearTimeout(usernameCheckTimeoutRef.current);
    }
    
    usernameCheckTimeoutRef.current = setTimeout(() => {
      checkUsernameAvailability(value);
    }, 500);
  };

  // Set username
  const handleSetUsername = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    if (usernameStatus !== 'available') {
      setError('Please choose an available username');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/auth/set-username`, {
        username: username.trim()
      }, {
        headers: { Authorization: `Bearer ${verifiedToken}` }
      });

      await trackFunnelEvent('dating_onboarding_username_set', {
        context: {
          usernameLength: username.trim().length
        }
      });

      setStep(3); // Move to profile setup
      setSuccess('Username set! Now complete your dating profile.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to set username');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const nextValue = name === 'pincode' ? normalizePincodeInput(value) : value;
      const nextData = { ...prev, [name]: nextValue };

      if (['city', 'district', 'locality', 'pincode', 'keralaRegion', 'state', 'country'].includes(name)) {
        return {
          ...nextData,
          ...resolveKeralaLocation(nextData)
        };
      }

      return nextData;
    });
  };

  const handleInterestToggle = (interest) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const handleLanguageToggle = (language) => {
    setFormData((prev) => ({
      ...prev,
      languages: prev.languages.includes(language)
        ? prev.languages.filter((currentLanguage) => currentLanguage !== language)
        : [...prev.languages, language]
    }));
  };

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    setFormData(prev => ({
      ...prev,
      photos: [...prev.photos, ...files]
    }));
  };

  const handleNext = () => {
    setError('');
    const resolvedLocation = resolveKeralaLocation(formData);

    if (
      !formData.firstName ||
      !formData.age ||
      !resolvedLocation.city ||
      !formData.relationshipGoals ||
      !formData.languages.length ||
      !formData.conversationStyle ||
      !formData.weekendStyle ||
      !formData.planningStyle ||
      !formData.socialEnergy
    ) {
      setError('Add your intent, language, conversation rhythm, and dating style before continuing.');
      return;
    }

    if (formData.pincode && !isValidPincode(formData.pincode)) {
      setError('Enter a valid 6-digit pincode so nearby discovery can use it.');
      return;
    }

    void trackFunnelEvent('dating_onboarding_profile_details_saved', {
      context: {
        relationshipGoals: formData.relationshipGoals,
        languageCount: formData.languages.length,
        hasReligion: Boolean(formData.religion),
        hasCommunityPreference: Boolean(formData.communityPreference),
        hasDistrict: Boolean(resolvedLocation.district),
        hasLocality: Boolean(resolvedLocation.locality),
        hasPincode: Boolean(resolvedLocation.pincode),
        keralaRegion: resolvedLocation.keralaRegion || null,
        conversationStyle: formData.conversationStyle,
        weekendStyle: formData.weekendStyle,
        planningStyle: formData.planningStyle,
        socialEnergy: formData.socialEnergy,
        messageGating: formData.messageGating
      }
    });
    setStep(4);
  };

  // Submit complete signup
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const resolvedLocation = resolveKeralaLocation(formData);

    if (formData.pincode && !isValidPincode(formData.pincode)) {
      setLoading(false);
      setError('Enter a valid 6-digit pincode before creating your profile.');
      return;
    }

    try {
      // Create dating profile
      await axios.post(`${API_BASE_URL}/dating/profiles`, {
        firstName: formData.firstName,
        age: formData.age,
        gender: formData.gender,
        city: resolvedLocation.city,
        district: resolvedLocation.district,
        locality: resolvedLocation.locality,
        pincode: resolvedLocation.pincode,
        keralaRegion: resolvedLocation.keralaRegion,
        state: resolvedLocation.state,
        country: resolvedLocation.country,
        bio: formData.bio,
        relationshipGoals: formData.relationshipGoals,
        languages: formData.languages,
        religion: formData.religion,
        communityPreference: formData.communityPreference,
        conversationStyle: formData.conversationStyle,
        interests: formData.interests,
        height: formData.height,
        occupation: formData.occupation,
        education: formData.education,
      }, {
        headers: { Authorization: `Bearer ${verifiedToken}` }
      });

      await axios.put(`${API_BASE_URL}/dating/preferences`, {
        relationshipGoals: [formData.relationshipGoals],
        compatibilityAnswers: {
          communicationStyle: formData.conversationStyle,
          weekendStyle: formData.weekendStyle,
          planningStyle: formData.planningStyle,
          socialEnergy: formData.socialEnergy
        },
        preferenceFlexibility: {
          safetyControls: {
            messageGating: formData.messageGating
          }
        }
      }, {
        headers: { Authorization: `Bearer ${verifiedToken}` }
      });

      // Upload photos if any
      if (formData.photos.length > 0) {
        // Convert File objects to base64 data URLs
        const photoPromises = formData.photos.map((photo, index) => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                url: reader.result, // base64 data URL
                position: index
              });
            };
            reader.onerror = reject;
            reader.readAsDataURL(photo);
          });
        });

        const photoUrls = await Promise.all(photoPromises);

        await axios.post(`${API_BASE_URL}/dating/profiles/me/photos`, {
          photos: photoUrls
        }, {
          headers: {
            Authorization: `Bearer ${verifiedToken}`
          }
        });
      }

      let referralApplied = false;
      if (referralValidated && referralCode.trim()) {
        try {
          await axios.post(`${API_BASE_URL}/social/referral/complete`, {
            code: referralCode.trim().toUpperCase()
          }, {
            headers: { Authorization: `Bearer ${verifiedToken}` }
          });
          referralApplied = true;
        } catch (referralError) {
          console.error('Referral application error:', referralError);
        }
      }

      await trackFunnelEvent('dating_onboarding_completed', {
        context: {
          photoCount: formData.photos.length,
          relationshipGoals: formData.relationshipGoals,
          languageCount: formData.languages.length,
          hasDistrict: Boolean(resolvedLocation.district),
          hasLocality: Boolean(resolvedLocation.locality),
          hasPincode: Boolean(resolvedLocation.pincode),
          keralaRegion: resolvedLocation.keralaRegion || null,
          weekendStyle: formData.weekendStyle,
          planningStyle: formData.planningStyle,
          socialEnergy: formData.socialEnergy,
          messageGating: formData.messageGating
        }
      });

      setSuccess(
        referralApplied
          ? 'Account created successfully and referral rewards were applied.'
          : 'Account created successfully!'
      );
      onSignUpSuccess?.(verifiedToken, verifiedUser);
    } catch (err) {
      console.error('Signup error:', err);
      setError(err.response?.data?.error || 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dating-signup-container">
      <div className="signup-card">
        {onBackToLaunch && (
          <div className="signup-topbar">
            <button
              type="button"
              className="btn-back"
              onClick={onBackToLaunch}
              disabled={loading || otpSent}
            >
              ← Back
            </button>
          </div>
        )}
        <h1>Create Your Dating Profile</h1>
        <p className="signup-positioning">Real matches, safe dates, better conversations.</p>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {/* Step Indicators */}
        <div className="step-indicators">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`step ${s <= step ? 'active' : ''}`}>
              {s}
            </div>
          ))}
        </div>

        {/* Step 1: Email & OTP Verification */}
        {step === 1 && (
          <form className="signup-step" onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}>
            <h2>{otpSent ? 'Verify Your Email' : 'Create Your Account'}</h2>

            {!otpSent ? (
              <>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    disabled={loading}
                  />
                </div>
                <div className="form-group">
                  <label>Referral Code (Optional)</label>
                  <input
                    type="text"
                    value={referralCode}
                    onChange={(e) => {
                      setReferralCode(e.target.value.toUpperCase());
                      setReferralValidated(false);
                      setReferralMessage('');
                    }}
                    onBlur={() => {
                      if (referralCode.trim()) {
                        void validateReferralCode(referralCode, false);
                      }
                    }}
                    placeholder="Paste invite code"
                    disabled={loading || validatingReferral}
                  />
                  {referralMessage ? (
                    <small className="helper-text" style={{ color: referralValidated ? '#4CAF50' : '#F44336' }}>
                      {validatingReferral ? 'Validating referral code...' : referralMessage}
                    </small>
                  ) : null}
                </div>
                <button type="submit" className="btn-submit" disabled={loading}>
                  {loading ? 'Sending OTP...' : 'Send Email OTP'}
                </button>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label>Enter OTP</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit OTP"
                    maxLength="6"
                    autoComplete="one-time-code"
                    disabled={loading}
                  />
                </div>
                <button type="submit" className="btn-submit" disabled={loading}>
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>
                
                <div className="otp-actions">
                  <button
                    type="button"
                    className="btn-resend"
                    onClick={handleResendOtp}
                    disabled={loading || resendCooldown > 0}
                  >
                    {resendCooldown > 0 
                      ? `Resend OTP (${resendCooldown}s)` 
                      : 'Resend OTP'}
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => {
                      setOtpSent(false);
                      setOtp('');
                      setOtpId('');
                      if (resendTimerRef.current) {
                        clearInterval(resendTimerRef.current);
                      }
                      setResendCooldown(0);
                    }}
                    disabled={loading}
                  >
                    Change Email
                  </button>
                </div>
              </>
            )}
          </form>
        )}

        {/* Step 2: Set Username */}
        {step === 2 && (
          <form className="signup-step" onSubmit={handleSetUsername}>
            <h2>Choose Your Username</h2>
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="Choose a unique username"
                disabled={loading}
              />
              {usernameStatus === 'checking' && (
                <p className="helper-text" style={{ color: '#FF9500' }}>Checking availability...</p>
              )}
              {usernameStatus === 'available' && (
                <p className="helper-text" style={{ color: '#4CAF50' }}>✓ Username is available</p>
              )}
              {usernameStatus === 'taken' && (
                <p className="helper-text" style={{ color: '#F44336' }}>✗ {usernameError}</p>
              )}
              {usernameError && usernameStatus !== 'taken' && (
                <p className="helper-text" style={{ color: '#F44336' }}>{usernameError}</p>
              )}
            </div>
            <button type="submit" className="btn-submit" disabled={loading || usernameStatus !== 'available'}>
              {loading ? 'Setting Username...' : 'Continue'}
            </button>
          </form>
        )}

        {/* Step 3: Profile Info */}
        {step === 3 && (
          <div className="signup-step">
            <h2>Tell Us About Yourself</h2>
            <p>We use these answers to make your profile clearer and your first matches more relevant.</p>
            <div className="intent-capture-card">
              <strong>Intent snapshot</strong>
              <span>
                LinkUp now learns not just what you want, but how you want early dating to feel:
                direct, warm, low-pressure, and safe.
              </span>
            </div>
            <div className="form-group">
              <label>First Name *</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleProfileInputChange}
                placeholder="Your first name"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Age *</label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleProfileInputChange}
                  placeholder="Your age"
                  min="18"
                  max="120"
                />
              </div>
              <div className="form-group">
                <label>Gender</label>
                <select name="gender" value={formData.gender} onChange={handleProfileInputChange}>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>City *</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleProfileInputChange}
                placeholder="Kochi, Trivandrum, Kozhikode..."
              />
              <small className="helper-text">
                Use the city people nearby would actually search for.
              </small>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>District</label>
                <select
                  name="district"
                  value={formData.district}
                  onChange={handleProfileInputChange}
                >
                  <option value="">Select district</option>
                  {districtOptions.map((district) => (
                    <option key={district.value} value={district.value}>
                      {district.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Locality Or Neighborhood</label>
                <input
                  type="text"
                  name="locality"
                  value={formData.locality}
                  onChange={handleProfileInputChange}
                  placeholder="Fort Kochi, Kakkanad, Kowdiar..."
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Pincode</label>
                <input
                  type="text"
                  inputMode="numeric"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handleProfileInputChange}
                  placeholder="682030"
                  maxLength="6"
                />
              </div>
              <div className="form-group">
                <label>Kerala Region</label>
                <select
                  name="keralaRegion"
                  value={formData.keralaRegion}
                  onChange={handleProfileInputChange}
                >
                  <option value="">Select region</option>
                  {KERALA_REGION_OPTIONS.map((region) => (
                    <option key={region.value} value={region.value}>
                      {region.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>State</label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleProfileInputChange}
                  placeholder="Your state"
                />
              </div>
              <div className="form-group">
                <label>Country</label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleProfileInputChange}
                  placeholder="Your country"
                />
              </div>
            </div>
            <small className="helper-text">
              District, locality, pincode, and Kerala region help LinkUp make tighter Kochi,
              Trivandrum, and Calicut-area matches.
            </small>
            <div className="form-group">
              <label>Relationship Intent *</label>
              <select name="relationshipGoals" value={formData.relationshipGoals} onChange={handleProfileInputChange}>
                {RELATIONSHIP_INTENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Languages You Speak *</label>
              <div className="interests-grid">
                {LANGUAGE_OPTIONS.map((language) => (
                  <button
                    key={language}
                    type="button"
                    className={`interest-tag ${formData.languages.includes(language) ? 'selected' : ''}`}
                    onClick={() => handleLanguageToggle(language)}
                  >
                    {language}
                  </button>
                ))}
              </div>
              <small className="helper-text">Pick at least one so matches know how to start the conversation.</small>
            </div>
            <div className="form-group">
              <label>Conversation Style *</label>
              <div className="interests-grid">
                {CONVERSATION_STYLE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`interest-tag ${formData.conversationStyle === option.value ? 'selected' : ''}`}
                    onClick={() => setFormData((prev) => ({ ...prev, conversationStyle: option.value }))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Weekend Energy *</label>
              <div className="interests-grid">
                {WEEKEND_STYLE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`interest-tag ${formData.weekendStyle === option.value ? 'selected' : ''}`}
                    onClick={() => setFormData((prev) => ({ ...prev, weekendStyle: option.value }))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Planning Style *</label>
              <div className="interests-grid">
                {PLANNING_STYLE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`interest-tag ${formData.planningStyle === option.value ? 'selected' : ''}`}
                    onClick={() => setFormData((prev) => ({ ...prev, planningStyle: option.value }))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Social Rhythm *</label>
              <div className="interests-grid">
                {SOCIAL_ENERGY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`interest-tag ${formData.socialEnergy === option.value ? 'selected' : ''}`}
                    onClick={() => setFormData((prev) => ({ ...prev, socialEnergy: option.value }))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Who Can Send First Intros?</label>
              <div className="interests-grid">
                {MESSAGE_GATING_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`interest-tag ${formData.messageGating === option.value ? 'selected' : ''}`}
                    onClick={() => setFormData((prev) => ({ ...prev, messageGating: option.value }))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <small className="helper-text">
                This becomes your default trust setting for premium direct-intent intros.
              </small>
            </div>
            <div className="form-group">
              <label>Height</label>
              <input
                type="text"
                name="height"
                value={formData.height}
                onChange={handleProfileInputChange}
                placeholder="e.g., 5'8 inches"
              />
            </div>
            <div className="form-group">
              <label>Occupation</label>
              <input
                type="text"
                name="occupation"
                value={formData.occupation}
                onChange={handleProfileInputChange}
                placeholder="Your occupation"
              />
            </div>
            <div className="form-group">
              <label>Education</label>
              <input
                type="text"
                name="education"
                value={formData.education}
                onChange={handleProfileInputChange}
                placeholder="Your education"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Religion (Optional)</label>
                <input
                  type="text"
                  name="religion"
                  value={formData.religion}
                  onChange={handleProfileInputChange}
                  placeholder="Only if it matters to you"
                />
              </div>
              <div className="form-group">
                <label>Community Preference (Optional)</label>
                <input
                  type="text"
                  name="communityPreference"
                  value={formData.communityPreference}
                  onChange={handleProfileInputChange}
                  placeholder="Optional community preference"
                />
              </div>
            </div>
            <div className="form-group">
              <label>About You</label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleProfileInputChange}
                placeholder="Tell us about yourself..."
                rows="3"
              />
            </div>
            <div className="form-group">
              <label>Interests</label>
              <div className="interests-grid">
                {INTERESTS.map(interest => (
                  <button
                    key={interest}
                    type="button"
                    className={`interest-tag ${formData.interests.includes(interest) ? 'selected' : ''}`}
                    onClick={() => handleInterestToggle(interest)}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn-submit" onClick={handleNext}>
              Continue to Photos
            </button>
          </div>
        )}

        {/* Step 4: Photos */}
        {step === 4 && (
          <form className="signup-step" onSubmit={handleSubmit}>
            <h2>Add Your Photos</h2>
            <div className="form-group">
              <label>Upload Photos</label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={loading}
              />
              <p className="helper-text">Upload at least 1 photo (recommended: 3-5)</p>
              {formData.photos.length > 0 && (
                <div className="photo-preview">
                  {formData.photos.map((photo, idx) => (
                    <div key={idx} className="photo-item">
                      {photo.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button type="submit" className="btn-submit" disabled={loading || formData.photos.length === 0}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
        )}

        {/* Login Link */}
        {step === 1 && !otpSent && (
          <div className="login-link">
            Already have an account? <button onClick={onLoginClick} type="button">Log in</button>
          </div>
        )}

        <PublicLegalNotice language={language} message={legalNoticeMessage} />
      </div>
    </div>
  );
};

export default DatingSignUp;
