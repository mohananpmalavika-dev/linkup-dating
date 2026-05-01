import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getTranslationValue } from '../data/translations';
import { API_BASE_URL } from '../utils/api';
import { isValidPincode } from '../utils/ecommerceHelpers';
import { formatPhoneForFirebase, isValidPhoneFormat, getPhoneErrorMessage } from '../utils/phoneFormatter';
import {
  KERALA_REGION_OPTIONS,
  getDistrictOptionsForRegion,
  normalizePincodeInput,
  resolveKeralaLocation
} from '../utils/keralaLocation';
import PublicLegalNotice from './PublicLegalNotice';
import AgeGate from './AgeGate/AgeGate';
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

const SIMPLE_SIGNUP_STEPS = [
  { number: 1, label: 'Account' },
  { number: 2, label: 'Details' },
  { number: 3, label: 'Photo' }
];

/**
 * DatingSignUp Component
 * Sign up for dating app with profile creation
 * Uses OTP-based authentication matching the Login flow
 */
const DatingSignUp = ({ language = 'en', onSignUpSuccess, onLoginClick, onBackToLaunch }) => {
  const [step, setStep] = useState(1); // 1: contact code, 2: basic details, 3: optional photo
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // OTP verification state
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpId, setOtpId] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpMethod, setOtpMethod] = useState('email'); // 'email' or 'phone'
  const [verifiedToken, setVerifiedToken] = useState(null);
  const [verifiedUser, setVerifiedUser] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [referralCode, setReferralCode] = useState('');
  const [referralValidated, setReferralValidated] = useState(false);
  const [referralMessage, setReferralMessage] = useState('');
  const [validatingReferral, setValidatingReferral] = useState(false);
  const [showReferralCode, setShowReferralCode] = useState(false);
  const [ageVerification, setAgeVerification] = useState(null);
  const [gmailSigningIn, setGmailSigningIn] = useState(false);
  
  // Hidden account handle used by older-user friendly signup. Users can change it later.
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState(''); // 'checking', 'available', 'taken'
  const [usernameError, setUsernameError] = useState('');
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
    conversationStyle: 'steady',
    weekendStyle: 'cozy',
    planningStyle: 'balanced',
    socialEnergy: 'balanced',
    messageGating: 'balanced',
    interests: [],
    height: '',
    occupation: '',
    education: '',
    photos: [],
  });

  // MPIN state for optional screen lock
  const [mpin, setMpin] = useState('');
  const [confirmMpin, setConfirmMpin] = useState('');
  const [mpinError, setMpinError] = useState('');
  const [mpinSuccess, setMpinSuccess] = useState('');

  const INTERESTS = [
    'Travel', 'Fitness', 'Music', 'Art', 'Cooking', 'Gaming', 'Sports',
    'Hiking', 'Photography', 'Reading', 'Movies', 'Yoga', 'Meditation',
  ];
  const districtOptions = getDistrictOptionsForRegion(formData.keralaRegion);

  const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const looksLikePhoneNumber = (value) => /^\+?[0-9\s()-]{7,}$/.test(String(value || '').trim());
  const legalNoticeMessage = getTranslationValue(language, 'public.signupNotice');

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

  // Handle Gmail/Google signup
  const handleGoogleSignup = async () => {
    setError('');
    setSuccess('');
    setGmailSigningIn(true);

    try {
      // Initialize Firebase Auth
      const firebaseConfig = {
        apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
        authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
        storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.REACT_APP_FIREBASE_APP_ID
      };

      // Dynamic import to avoid build issues if Firebase not configured
      const { initializeApp } = await import('firebase/app');
      const { getAuth, signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');

      const app = initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');

      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const idToken = await user.getIdToken();

      // Send Firebase ID token to backend with age verification
      const response = await axios.post(`${API_BASE_URL}/auth/google-signup`, {
        idToken,
        firebaseUid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        phone: user.phoneNumber || '',
        ageVerification: ageVerification // Pass age verification collected from AgeGate
      });

      if (response.data.success) {
        const { token, user: backendUser } = response.data;
        setVerifiedToken(token);
        setVerifiedUser(backendUser);
        setEmail(user.email);
        setOtpSent(false);
        setStep(2);
        setSuccess('✓ Google signup successful! Now set your username.');

        setSuccess('Google sign up successful. Please add your basic details.');

        // Track event
        try {
          await axios.post(
            `${API_BASE_URL}/dating/funnel/events`,
            { eventName: 'dating_google_signup_success' },
            { headers: { Authorization: `Bearer ${token}` } }
          ).catch(() => {});
        } catch (trackErr) {
          console.error('Failed to track event:', trackErr);
        }
      } else {
        setError(response.data.error || 'Google signup failed');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Google signup failed';
      setError(errorMessage);
      console.error('Google signup error:', err);
    } finally {
      setGmailSigningIn(false);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlCode = urlParams.get('ref') || urlParams.get('referral');
    if (urlCode) {
      const normalizedCode = urlCode.trim().toUpperCase();
      setReferralCode(normalizedCode);
      setShowReferralCode(true);
      void validateReferralCode(normalizedCode, true);
    }

    return () => {
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

  // Send OTP to email or phone
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const normalizedEmail = email.trim().toLowerCase();

if (referralCode.trim()) {
      // Make referral non-blocking - allow to continue even if invalid
      const validReferral = await validateReferralCode(referralCode, true);
      if (!validReferral) {
        // Show warning but don't block - user can still sign up
        setSuccess('Referral code could not be validated. You can still sign up.');
      }
    }

    if (otpMethod === 'phone' && !phone.trim()) {
      setError('Please enter your mobile number to receive the SMS code.');
      return;
    }

    // Format and validate phone for Firebase SMS
    if (otpMethod === 'phone') {
      const formattedPhone = formatPhoneForFirebase(phone);
      const phoneError = getPhoneErrorMessage(formattedPhone);
      
      if (phoneError) {
        setError(phoneError);
        return;
      }
      
      // Update phone state with formatted version
      setPhone(formattedPhone);
    }

    if (otpMethod === 'email' && !normalizedEmail) {
      setError('Please enter your email');
      return;
    }

    if (otpMethod === 'email' && looksLikePhoneNumber(email) && !validateEmail(normalizedEmail)) {
setError('That looks like a phone number. Please use your email (like yourname@example.com) or switch to phone OTP method.');
      return;
    }

    if (otpMethod === 'email' && !validateEmail(normalizedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    if (phone.trim() && !looksLikePhoneNumber(phone)) {
      setError('Please enter a valid phone number or leave it blank.');
      return;
    }

    if (!ageVerification?.dateOfBirth || !ageVerification?.method) {
      setError('Please confirm your age before requesting a code.');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/send-otp`, {
        email: normalizedEmail,
        phone: phone.trim(),
        purpose: 'signup',
        channel: otpMethod, // 'email' or 'phone'
        ageVerification: {
          method: ageVerification.method,
          dateOfBirth: ageVerification.dateOfBirth
        }
      });

      setOtpId(response.data.otpId || '');
      setOtpSent(true);
      const channel = otpMethod === 'phone' ? 'SMS' : 'email';
      setSuccess(response.data?.message || `Code sent by ${channel}.`);
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
      setError(err.response?.data?.error || 'Failed to send the code');
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
        phone: phone.trim(),
        purpose: 'signup',
        channel: otpMethod, // 'email' or 'phone'
        ageVerification: {
          method: ageVerification?.method,
          dateOfBirth: ageVerification?.dateOfBirth
        }
      });

      setOtpId(response.data.otpId || '');
      const channel = otpMethod === 'phone' ? 'SMS' : 'email';
      setSuccess(response.data?.message || `Code sent again by ${channel}.`);
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
      setError(err.response?.data?.error || 'Failed to resend the code');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');

    if (!otp.trim()) {
      setError('Please enter the code');
      return;
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/verify-otp`, {
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        otp: otp.trim(),
        otpId
      });

      const { token, user } = response.data;
      setVerifiedToken(token);
      setVerifiedUser(user);
      setStep(2);
      setSuccess('Code verified. Please add your basic details.');
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
      setError(err.response?.data?.error || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const getUsernameBase = () => {
    const emailName = email.split('@')[0];
    const preferred = formData.firstName || verifiedUser?.name || emailName || 'datinghub';
    const cleaned = String(preferred)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, '')
      .replace(/^[_.-]+|[_.-]+$/g, '')
      .slice(0, 14);

    if (cleaned.length >= 3) {
      return cleaned;
    }

    return `${cleaned || 'user'}123`.slice(0, 14);
  };

  const ensureUsernameQuietly = async () => {
    const existingUsername = username || verifiedUser?.username;

    if (existingUsername || !verifiedToken) {
      return existingUsername || null;
    }

    const base = getUsernameBase();
    const suffixes = [
      '',
      formData.age || '',
      Math.floor(1000 + Math.random() * 9000).toString(),
      Date.now().toString().slice(-5)
    ];
    const candidates = [...new Set(
      suffixes.map((suffix) => `${base}${suffix}`.slice(0, 20))
    )].filter((candidate) => /^[a-zA-Z0-9_.-]{3,20}$/.test(candidate));

    for (const candidate of candidates) {
      try {
        const availability = await axios.post(`${API_BASE_URL}/auth/check-username`, {
          username: candidate
        });

        if (availability.data && availability.data.available === false) {
          continue;
        }

        const response = await axios.post(`${API_BASE_URL}/auth/set-username`, {
          username: candidate
        }, {
          headers: { Authorization: `Bearer ${verifiedToken}` }
        });

        setUsername(candidate);
        setVerifiedUser((previousUser) => ({
          ...(previousUser || {}),
          ...(response.data?.user || {}),
          username: response.data?.user?.username || candidate
        }));

        await trackFunnelEvent('dating_onboarding_username_set', {
          context: {
            usernameLength: candidate.length,
            autoGenerated: true
          }
        });

        return candidate;
      } catch (usernameError) {
        if (usernameError.response?.status !== 409) {
          console.error('Automatic username setup failed:', usernameError);
        }
      }
    }

    return null;
  };

  const handleUsernameChange = async (value) => {
    setUsername(value);
    
    if (!value.trim()) {
      setUsernameStatus('');
      setUsernameError('');
      return;
    }

    if (!/^[a-zA-Z0-9_.-]{3,20}$/.test(value)) {
      setUsernameStatus('');
      setUsernameError('Username must be 3-20 characters (letters, numbers, _, ., -)');
      return;
    }

    setUsernameStatus('checking');
    setUsernameError('');

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/check-username`, {
        username: value
      });

      if (response.data?.available) {
        setUsernameStatus('available');
        setUsernameError('');
      } else {
        setUsernameStatus('taken');
        setUsernameError('Username already taken');
      }
    } catch (err) {
      setUsernameStatus('');
      setUsernameError(err.response?.data?.error || 'Error checking username');
    }
  };

  const handleSetUsername = async (e) => {
    e.preventDefault();
    
    if (!username.trim() || usernameStatus !== 'available') {
      setError('Please choose an available username');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/auth/set-username`,
        { username },
        { headers: { Authorization: `Bearer ${verifiedToken}` } }
      );

      setUsername(response.data?.user?.username || username);
      setVerifiedUser({
        ...(verifiedUser || {}),
        ...response.data?.user
      });
      setSuccess('✓ Username set successfully');
      setStep(3);

      await trackFunnelEvent('dating_onboarding_username_set', {
        context: { usernameLength: username.length }
      });
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
    const photoPromises = files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve({
            file,
            name: file.name,
            preview: event.target.result
          });
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(photoPromises).then(newPhotos => {
      setFormData(prev => ({
        ...prev,
        photos: [...prev.photos, ...newPhotos]
      }));
    });
  };

  const handleRemovePhoto = (idx) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== idx)
    }));
  };

  const handleNext = () => {
    setError('');
    const resolvedLocation = resolveKeralaLocation(formData);

    if (
      !formData.firstName ||
      !formData.age ||
      !resolvedLocation.city ||
      !formData.gender ||
      !formData.relationshipGoals
    ) {
      setError('Please add your name, gender, city, and what you are looking for.');
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
    setStep(3);
  };

// Submit complete signup
  const handleSubmit = async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    setLoading(true);
    setError('');
    setMpinError('');
    setMpinSuccess('');
    const resolvedLocation = resolveKeralaLocation(formData);

    if (formData.pincode && !isValidPincode(formData.pincode)) {
      setLoading(false);
      setError('Enter a valid 6-digit pincode before creating your profile.');
      return;
    }

    // Validate MPIN if provided
    if (mpin && mpin.length > 0) {
      if (mpin.length < 4) {
        setLoading(false);
        setMpinError('MPIN must be at least 4 digits');
        return;
      }
      if (mpin !== confirmMpin) {
        setLoading(false);
        setMpinError('MPINs do not match');
        return;
      }
    }

    try {
      const ensuredUsername = await ensureUsernameQuietly();

      // Create dating profile
      const profileResponse = await axios.post(`${API_BASE_URL}/dating/profiles`, {
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
        // Use already-generated preview data URLs
        const photoUrls = formData.photos.map((photo, index) => ({
          url: photo.preview, // Already a base64 data URL
          position: index
        }));

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
      const completedUser = {
        ...(verifiedUser || {}),
        username: ensuredUsername || verifiedUser?.username,
        firstName: formData.firstName,
        name: formData.firstName,
        city: resolvedLocation.city,
        profile: profileResponse.data?.profile || verifiedUser?.profile || null
      };
      setVerifiedUser(completedUser);
      onSignUpSuccess?.(verifiedToken, completedUser);
    } catch (err) {
      console.error('Signup error:', err);
      setError(err.response?.data?.error || 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAgeVerified = (verification) => {
    setAgeVerification(verification);
    setFormData((prev) => ({
      ...prev,
      age: verification?.age ? String(verification.age) : prev.age
    }));
    setError('');
    setSuccess('Age confirmed. Now create your account.');
  };

  if (!ageVerification) {
    return (
      <AgeGate
        onAgeVerified={handleAgeVerified}
        onCancel={() => {
          if (onBackToLaunch) {
            onBackToLaunch();
            return;
          }

          onLoginClick?.();
        }}
      />
    );
  }

  return (
    <div className="dating-signup-container">
      <div className="signup-card">
        {onBackToLaunch && (
          <div className="signup-topbar">
            <button
              type="button"
              className="btn-back"
              aria-label="Back"
              onClick={onBackToLaunch}
              disabled={loading || otpSent}
            >
              ← Back
            </button>
          </div>
        )}
        <img src="/datinghub-logo.png" alt="DatingHub" className="signup-brand-logo" />
        <h1>Create your profile</h1>
        <p className="signup-positioning">A few simple details to start meeting real people.</p>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {/* Step Indicators */}
        <div className="signup-progress" aria-label="Signup progress">
          <span>Step {step} of {SIMPLE_SIGNUP_STEPS.length}</span>
          <div className="step-indicators">
            {SIMPLE_SIGNUP_STEPS.map((signupStep) => (
              <div
                key={signupStep.number}
                className={`step ${signupStep.number <= step ? 'active' : ''}`}
                title={signupStep.label}
              >
                <strong>{signupStep.number}</strong>
                <small>{signupStep.label}</small>
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Contact verification */}
        {step === 1 && (
          <form className="signup-step simplified-step" onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}>
            <h2>{otpSent ? 'Enter your 6-digit code' : 'Create your account'}</h2>
            <p className="signup-step-note">
              We will send one short code. No password is needed.
            </p>

            {!otpSent ? (
              <>
                <button
                  type="button"
                  className="btn-google-signup"
                  onClick={handleGoogleSignup}
                  disabled={loading || gmailSigningIn}
                >
                  <span className="google-icon" aria-hidden="true">G</span>
                  {gmailSigningIn ? 'Opening Google...' : 'Continue with Google'}
                </button>

                <div className="divider-or">
                  <span>or use email</span>
                </div>

                <div className="form-group">
                  <label htmlFor="signup-email">Email address</label>
                  <input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>

                <div className="form-group">
                  <label>Where should we send the code?</label>
                  <div className="method-toggle" role="group" aria-label="Code delivery method">
                    <button
                      type="button"
                      className={otpMethod === 'email' ? 'selected' : ''}
                      onClick={() => setOtpMethod('email')}
                      disabled={loading}
                    >
                      Email
                    </button>
                    <button
                      type="button"
                      className={otpMethod === 'phone' ? 'selected' : ''}
                      onClick={() => setOtpMethod('phone')}
                      disabled={loading}
                    >
                      SMS
                    </button>
                  </div>
                </div>

                {otpMethod === 'phone' && (
                  <div className="form-group">
                    <label htmlFor="signup-phone">Mobile number</label>
                    <input
                      id="signup-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      disabled={loading}
                      autoComplete="tel"
                    />
                    <small className="helper-text">SMS sign up still needs your email for the account.</small>
                  </div>
                )}

                {showReferralCode ? (
                  <div className="form-group">
                    <label htmlFor="signup-referral">Invite code (optional)</label>
                    <input
                      id="signup-referral"
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
                      placeholder="Invite code"
                      disabled={loading || validatingReferral}
                    />
                    {referralMessage ? (
                      <small className="helper-text" style={{ color: referralValidated ? '#166534' : '#9f1239' }}>
                        {validatingReferral ? 'Checking invite code...' : referralMessage}
                      </small>
                    ) : null}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-text"
                    onClick={() => setShowReferralCode(true)}
                    disabled={loading}
                  >
                    I have an invite code
                  </button>
                )}

                <button
                  type="submit"
                  className="btn-submit"
                  disabled={loading || (otpMethod === 'phone' && !phone.trim())}
                >
                  {loading ? 'Sending code...' : `Send code by ${otpMethod === 'phone' ? 'SMS' : 'email'}`}
                </button>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label htmlFor="signup-code">6-digit code</label>
                  <input
                    id="signup-code"
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    maxLength="6"
                    autoComplete="one-time-code"
                    disabled={loading}
                  />
                  <small className="helper-text">
                    Code sent to {otpMethod === 'phone' ? phone : email}
                  </small>
                </div>

                <button type="submit" className="btn-submit" disabled={loading}>
                  {loading ? 'Checking code...' : 'Continue'}
                </button>

                <div className="otp-actions">
                  <button
                    type="button"
                    className="btn-resend"
                    onClick={handleResendOtp}
                    disabled={loading || resendCooldown > 0}
                  >
                    {resendCooldown > 0
                      ? `Send again in ${resendCooldown}s`
                      : 'Send code again'}
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => {
                      setOtpSent(false);
                      setOtp('');
                      setOtpId('');
                      setError('');
                      setSuccess('');
                      if (resendTimerRef.current) {
                        clearInterval(resendTimerRef.current);
                      }
                      setResendCooldown(0);
                    }}
                    disabled={loading}
                  >
                    Change email or phone
                  </button>
                </div>
              </>
            )}
          </form>
        )}

        {/* Step 2: Basic profile */}
        {step === 2 && (
          <div className="signup-step simplified-step">
            <h2>Your basic details</h2>
            <p className="signup-step-note">Only the important details are needed now.</p>

            <div className="form-group">
              <label htmlFor="signup-first-name">First name</label>
              <input
                id="signup-first-name"
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleProfileInputChange}
                placeholder="Your first name"
                autoComplete="given-name"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="signup-age">Age</label>
                <input
                  id="signup-age"
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleProfileInputChange}
                  min="18"
                  max="120"
                  readOnly={Boolean(ageVerification)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="signup-gender">Gender</label>
                <select id="signup-gender" name="gender" value={formData.gender} onChange={handleProfileInputChange}>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="signup-city">City</label>
              <input
                id="signup-city"
                type="text"
                name="city"
                value={formData.city}
                onChange={handleProfileInputChange}
                placeholder="Kochi, Trivandrum, Kozhikode..."
                autoComplete="address-level2"
              />
            </div>

            <div className="form-group">
              <label htmlFor="signup-intent">I am looking for</label>
              <select
                id="signup-intent"
                name="relationshipGoals"
                value={formData.relationshipGoals}
                onChange={handleProfileInputChange}
              >
                {RELATIONSHIP_INTENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Languages</label>
              <div className="interests-grid simple-grid">
                {LANGUAGE_OPTIONS.slice(0, 4).map((currentLanguage) => (
                  <button
                    key={currentLanguage}
                    type="button"
                    className={`interest-tag ${formData.languages.includes(currentLanguage) ? 'selected' : ''}`}
                    onClick={() => handleLanguageToggle(currentLanguage)}
                  >
                    {currentLanguage}
                  </button>
                ))}
              </div>
            </div>

            <details className="optional-profile-details">
              <summary>Add more details now</summary>
              <div className="optional-profile-body">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="signup-district">District</label>
                    <select
                      id="signup-district"
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
                    <label htmlFor="signup-pincode">Pincode</label>
                    <input
                      id="signup-pincode"
                      type="text"
                      inputMode="numeric"
                      name="pincode"
                      value={formData.pincode}
                      onChange={handleProfileInputChange}
                      placeholder="682030"
                      maxLength="6"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="signup-occupation">Occupation</label>
                    <input
                      id="signup-occupation"
                      type="text"
                      name="occupation"
                      value={formData.occupation}
                      onChange={handleProfileInputChange}
                      placeholder="Your occupation"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="signup-education">Education</label>
                    <input
                      id="signup-education"
                      type="text"
                      name="education"
                      value={formData.education}
                      onChange={handleProfileInputChange}
                      placeholder="Your education"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="signup-bio">About you</label>
                  <textarea
                    id="signup-bio"
                    name="bio"
                    value={formData.bio}
                    onChange={handleProfileInputChange}
                    placeholder="A short line about yourself"
                    rows="3"
                  />
                </div>

                <div className="form-group">
                  <label>Interests</label>
                  <div className="interests-grid">
                    {INTERESTS.map((interest) => (
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
              </div>
            </details>

            <button type="button" className="btn-submit" onClick={handleNext}>
              Continue
            </button>
          </div>
        )}

        {/* Step 3: Optional photo */}
        {step === 3 && (
          <form className="signup-step simplified-step" onSubmit={handleSubmit}>
            <h2>Add a photo</h2>
            <p className="signup-step-note">A photo helps trust, but you can add it later.</p>

            <div className="form-group">
              <label htmlFor="signup-photos">Choose photo</label>
              <input
                id="signup-photos"
                type="file"
                multiple
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={loading}
              />
              {formData.photos.length > 0 && (
                <div className="photo-preview">
                  <div className="photos-grid">
                    {formData.photos.map((photo, idx) => (
                      <div key={idx} className="photo-item">
                        <img src={photo.preview} alt={`Profile upload ${idx + 1}`} />
                        <button
                          type="button"
                          className="btn-remove"
                          onClick={() => handleRemovePhoto(idx)}
                          title="Remove photo"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Creating profile...' : 'Create my profile'}
            </button>
            <button type="button" className="btn-outline" onClick={handleSubmit} disabled={loading}>
              Skip photo for now
            </button>
          </form>
        )}

        {/* Step 1: Email & OTP Verification */}
        {false && step === 1 && (
          <form className="signup-step" onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}>
            <h2>{otpSent ? 'Verify Your Email' : 'Create Your Account'}</h2>

            {!otpSent ? (
              <>
                <div className="form-group">
                  <label>Sign Up Method</label>
                  <div className="signup-method-options">
                    <button
                      type="button"
                      className="btn-google-signup"
                      onClick={handleGoogleSignup}
                      disabled={loading || gmailSigningIn}
                    >
                      <span className="google-icon">🔐</span>
                      {gmailSigningIn ? 'Signing in...' : 'Sign up with Google'}
                    </button>
                    <div className="divider-or">
                      <span>OR</span>
                    </div>
                  </div>
                </div>

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
                  <label>OTP Delivery Method</label>
                  <div className="radio-group">
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="otpMethod"
                        value="email"
                        checked={otpMethod === 'email'}
                        onChange={(e) => setOtpMethod(e.target.value)}
                        disabled={loading}
                      />
                      <span className="radio-label">📧 Email OTP</span>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="otpMethod"
                        value="phone"
                        checked={otpMethod === 'phone'}
                        onChange={(e) => setOtpMethod(e.target.value)}
                        disabled={loading || !phone.trim()}
                      />
                      <span className="radio-label">📱 SMS OTP (requires phone number below)</span>
                    </label>
                  </div>
                </div>

                {otpMethod === 'phone' && (
                  <div className="form-group">
                    <label>Phone Number (Required for SMS)</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 9876543210 or 10-digit number"
                      disabled={loading}
                      autoComplete="tel"
                    />
                    <small className="helper-text">
                      Indian phone numbers supported. Format: +91XXXXXXXXXX (country code + 10 digits)
                    </small>
                  </div>
                )}

                {otpMethod === 'email' && (
                  <div className="form-group">
                    <label>Phone Number (Optional)</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      disabled={loading}
                      autoComplete="tel"
                    />
                    <small className="helper-text">
                      Add a phone number now so you can log in with email or phone later.
                    </small>
                  </div>
                )}

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
                <button 
                  type="submit" 
                  className="btn-submit" 
                  disabled={loading || (otpMethod === 'phone' && !phone.trim())}
                >
                  {loading ? `Sending ${otpMethod === 'phone' ? 'SMS' : 'Email'} OTP...` : `Send ${otpMethod === 'phone' ? 'SMS' : 'Email'} OTP`}
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
                  <small className="helper-text">
                    OTP sent to {otpMethod === 'phone' ? '📱 ' + phone : '📧 ' + email}
                  </small>
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
                      setError('');
                      setSuccess('');
                      if (resendTimerRef.current) {
                        clearInterval(resendTimerRef.current);
                      }
                      setResendCooldown(0);
                    }}
                    disabled={loading}
                  >
                    Change Method or Start Over
                  </button>
                </div>
              </>
            )}
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
                DatingHub now learns not just what you want, but how you want early dating to feel:
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
                  placeholder="Verified from your date of birth"
                  min="18"
                  max="120"
                  readOnly={Boolean(ageVerification)}
                />
                {ageVerification ? (
                  <small className="helper-text">
                    Pulled from your verified date of birth.
                  </small>
                ) : null}
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
              District, locality, pincode, and Kerala region help DatingHub make tighter Kochi,
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
        {false && step === 4 && (
          <form className="signup-step" onSubmit={(e) => { e.preventDefault(); setStep(5); }}>
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
                  <div className="photos-grid">
                    {formData.photos.map((photo, idx) => (
                      <div key={idx} className="photo-item">
                        <img src={photo.preview} alt={`Photo ${idx + 1}`} />
                        <button
                          type="button"
                          className="btn-remove"
                          onClick={() => handleRemovePhoto(idx)}
                          title="Remove photo"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button type="submit" className="btn-submit" disabled={loading || formData.photos.length === 0}>
              {loading ? 'Saving...' : `Continue (${formData.photos.length} photo${formData.photos.length !== 1 ? 's' : ''})`}
            </button>
            <button type="button" className="btn-outline" onClick={() => setStep(5)} disabled={loading}>
              Skip Photo Upload
            </button>
          </form>
        )}

        {/* Step 5: Security (MPIN - Optional) */}
        {false && step === 5 && (
          <form className="signup-step" onSubmit={handleSubmit}>
            <h2>Secure Your Account</h2>
            <p className="helper-text">Add an MPIN for quick login instead of password</p>
            
            <div className="form-group">
              <label>MPIN (4-6 digits)</label>
              <input
                type="password"
                inputMode="numeric"
                value={mpin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setMpin(value);
                  setMpinError('');
                  setMpinSuccess('');
                }}
                placeholder="Enter 4-6 digit MPIN"
                maxLength="6"
                disabled={loading}
              />
              <small className="helper-text">Optional - you can always add this later</small>
            </div>

            <div className="form-group">
              <label>Confirm MPIN</label>
              <input
                type="password"
                inputMode="numeric"
                value={confirmMpin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setConfirmMpin(value);
                  setMpinError('');
                  setMpinSuccess('');
                }}
                placeholder="Re-enter MPIN"
                maxLength="6"
                disabled={loading}
              />
            </div>

            {mpinError && <div className="error-message">{mpinError}</div>}
            {mpinSuccess && <div className="success-message">{mpinSuccess}</div>}

            <button 
              type="submit" 
              className="btn-submit" 
              disabled={loading || (mpin !== '' && mpin !== confirmMpin)}
            >
              {loading ? 'Creating Account...' : (mpin ? 'Create Account with MPIN' : 'Create Account (No MPIN)')}
            </button>
            
            <button 
              type="button" 
              className="btn-outline" 
              onClick={() => {
                setMpin('');
                setConfirmMpin('');
                handleSubmit(new Event('submit'));
              }}
              disabled={loading}
            >
              Skip MPIN
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
