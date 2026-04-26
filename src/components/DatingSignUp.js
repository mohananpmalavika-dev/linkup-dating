import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../utils/api';
import '../styles/DatingSignUp.css';

/**
 * DatingSignUp Component
 * Sign up for dating app with profile creation
 * Uses OTP-based authentication matching the Login flow
 */
const DatingSignUp = ({ onSignUpSuccess, onLoginClick, onBackToLaunch }) => {
  const [step, setStep] = useState(1); // 1: Email OTP, 2: Username, 3: Profile, 4: Photos
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // OTP verification state
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState('');
  const [verifiedToken, setVerifiedToken] = useState(null);
  const [verifiedUser, setVerifiedUser] = useState(null);
  
  // Username state
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState(null); // 'checking', 'available', 'taken'
  const [usernameError, setUsernameError] = useState('');
  const usernameCheckTimeoutRef = React.useRef(null);

  const [formData, setFormData] = useState({
    firstName: '',
    age: '',
    gender: 'female',
    city: '',
    state: '',
    country: '',
    bio: '',
    relationshipGoals: 'dating',
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

  const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const validateUsername = (value) => {
    return /^[a-zA-Z0-9_-]{3,20}$/.test(value);
  };

  // Send OTP to email
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setDevOtp('');

    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/send-otp`, {
        email: email.trim().toLowerCase(),
        purpose: 'signup'
      });

      if (response.data.devOtp) {
        setDevOtp(response.data.devOtp);
      }

      setOtpSent(true);
      setSuccess('OTP sent to your email!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP');
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

    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/verify-otp`, {
        email: email.trim().toLowerCase(),
        otp: otp.trim()
      });

      const { token, user } = response.data;
      setVerifiedToken(token);
      setVerifiedUser(user);
      setStep(2); // Move to username setup
      setSuccess('Email verified! Now set your username.');
      setOtp('');
      setOtpSent(false);
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
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleInterestToggle = (interest) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
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
    if (!formData.firstName || !formData.age || !formData.city) {
      setError('Please fill in all required fields');
      return;
    }
    setStep(4);
  };

  // Submit complete signup
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Create dating profile
      const profileResponse = await axios.post(`${API_BASE_URL}/dating/profiles`, {
        firstName: formData.firstName,
        age: formData.age,
        gender: formData.gender,
        city: formData.city,
        state: formData.state,
        country: formData.country,
        bio: formData.bio,
        relationshipGoals: formData.relationshipGoals,
        interests: formData.interests,
        height: formData.height,
        occupation: formData.occupation,
        education: formData.education,
      }, {
        headers: { Authorization: `Bearer ${verifiedToken}` }
      });

      // Upload photos if any
      if (formData.photos.length > 0) {
        const photoFormData = new FormData();
        formData.photos.forEach((photo) => {
          photoFormData.append('photos', photo);
        });

        await axios.post(`${API_BASE_URL}/dating/profiles/me/photos`, photoFormData, {
          headers: {
            Authorization: `Bearer ${verifiedToken}`,
            'Content-Type': 'multipart/form-data'
          }
        });
      }

      setSuccess('Account created successfully!');
      onSignUpSuccess?.(verifiedToken, verifiedUser);
    } catch (err) {
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
                <button type="submit" className="btn-submit" disabled={loading}>
                  {loading ? 'Sending OTP...' : 'Send OTP'}
                </button>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label>Enter OTP</label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter 6-digit OTP"
                    maxLength="6"
                    disabled={loading}
                  />
                </div>
                {devOtp && (
                  <div className="dev-otp-message">
                    <small>Dev OTP: <strong>{devOtp}</strong></small>
                  </div>
                )}
                <button type="submit" className="btn-submit" disabled={loading}>
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => {
                    setOtpSent(false);
                    setOtp('');
                  }}
                  disabled={loading}
                >
                  Back
                </button>
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
                placeholder="Your city"
              />
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
              <label>Relationship Goals</label>
              <select name="relationshipGoals" value={formData.relationshipGoals} onChange={handleProfileInputChange}>
                <option value="dating">Dating</option>
                <option value="relationship">Serious Relationship</option>
                <option value="casual">Casual</option>
                <option value="unsure">Not Sure</option>
              </select>
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
      </div>
    </div>
  );
};

export default DatingSignUp;
