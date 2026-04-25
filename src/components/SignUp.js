import React, { useState } from 'react';
import axios from 'axios';
import './SignUp.css';
import { storeUserData, storeAuthToken } from '../utils/auth';

function SignUp({ onSignUpSuccess }) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    avatar: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // Step 1: Basic info, Step 2: Profile
  const [validationErrors, setValidationErrors] = useState({});

  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

  // Validation functions
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password) => {
    // At least 8 chars, 1 uppercase, 1 lowercase, 1 number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return passwordRegex.test(password);
  };

  const validatePhone = (phone) => {
    // Basic phone validation - 10+ digits
    const phoneRegex = /^\d{10,}$/;
    return phoneRegex.test(phone.replace(/\D/g, ''));
  };

  const validateStep1 = () => {
    const errors = {};

    if (!formData.fullName.trim()) {
      errors.fullName = 'Full name is required';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      errors.email = 'Invalid email format';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (!validatePassword(formData.password)) {
      errors.password = 'Password must be at least 8 characters with uppercase, lowercase, and number';
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = () => {
    const errors = {};

    if (formData.phone && !validatePhone(formData.phone)) {
      errors.phone = 'Invalid phone number format';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field
    if (validationErrors[name]) {
      setValidationErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleNextStep = (e) => {
    e.preventDefault();
    if (validateStep1()) {
      setStep(2);
      setError('');
    }
  };

  const handleBackStep = (e) => {
    e.preventDefault();
    setStep(1);
    setError('');
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          avatar: reader.result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateStep2()) {
      return;
    }

    setError('');
    setLoading(true);

    try {
      const signupData = {
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        phone: formData.phone || undefined,
        avatar: formData.avatar || undefined,
      };

      console.log('Sending signup request:', { ...signupData, password: '***' });

      const response = await axios.post(`${backendUrl}/auth/signup`, signupData);

      console.log('Signup response:', response.data);

      const { token, user } = response.data;

      if (token && user) {
        storeAuthToken(token);
        storeUserData(user);
        onSignUpSuccess(token, user);
      } else {
        setError('Signup successful but no token received');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 
                          err.response?.data?.error ||
                          'Signup failed. Please try again.';
      setError(errorMessage);
      console.error('Signup error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-card">
        {/* Header */}
        <div className="signup-header">
          <div className="app-logo">LinkUp</div>
          <h1>Create Account</h1>
          <p>Join LinkUp to start messaging and chatting</p>
        </div>

        {/* Progress Indicator */}
        <div className="signup-progress">
          <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>
            <div className="step-number">1</div>
            <div className="step-label">Account</div>
          </div>
          <div className="progress-line"></div>
          <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>
            <div className="step-number">2</div>
            <div className="step-label">Profile</div>
          </div>
        </div>

        {/* Step 1: Account Details */}
        {step === 1 && (
          <form onSubmit={handleNextStep} className="signup-form">
            <div className="form-group">
              <label htmlFor="fullName">Full Name *</label>
              <input
                id="fullName"
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                placeholder="John Doe"
                disabled={loading}
                className={validationErrors.fullName ? 'error' : ''}
              />
              {validationErrors.fullName && (
                <span className="error-text">{validationErrors.fullName}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="you@example.com"
                disabled={loading}
                className={validationErrors.email ? 'error' : ''}
              />
              {validationErrors.email && (
                <span className="error-text">{validationErrors.email}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <input
                id="password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Min 8 chars, 1 uppercase, 1 lowercase, 1 number"
                disabled={loading}
                className={validationErrors.password ? 'error' : ''}
              />
              {validationErrors.password && (
                <span className="error-text">{validationErrors.password}</span>
              )}
              <small className="password-hint">
                Must contain at least 8 characters, including uppercase, lowercase, and numbers
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Re-enter your password"
                disabled={loading}
                className={validationErrors.confirmPassword ? 'error' : ''}
              />
              {validationErrors.confirmPassword && (
                <span className="error-text">{validationErrors.confirmPassword}</span>
              )}
            </div>

            {error && <div className="error-message">{error}</div>}

            <button type="submit" disabled={loading} className="signup-button">
              {loading ? 'Creating...' : 'Next: Complete Profile'}
            </button>
          </form>
        )}

        {/* Step 2: Profile Details */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="signup-form">
            <div className="avatar-upload">
              <div className="avatar-preview">
                {formData.avatar ? (
                  <img src={formData.avatar} alt="Profile" />
                ) : (
                  <div className="avatar-placeholder">
                    <span>+</span>
                  </div>
                )}
              </div>
              <label htmlFor="avatar" className="avatar-label">
                Upload Profile Picture (Optional)
              </label>
              <input
                id="avatar"
                type="file"
                name="avatar"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={loading}
                className="avatar-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone">Phone Number (Optional)</label>
              <input
                id="phone"
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="+1 (555) 000-0000"
                disabled={loading}
                className={validationErrors.phone ? 'error' : ''}
              />
              {validationErrors.phone && (
                <span className="error-text">{validationErrors.phone}</span>
              )}
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="form-buttons">
              <button
                type="button"
                onClick={handleBackStep}
                disabled={loading}
                className="back-button"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="signup-button"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <div className="signup-footer">
          <p>
            Already have an account?{' '}
            <button
              type="button"
              className="login-link"
              disabled={loading}
              onClick={() => {
                // This will be handled by parent component
                window.history.back();
              }}
            >
              Login here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default SignUp;
