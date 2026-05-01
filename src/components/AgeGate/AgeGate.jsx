import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../utils/api';
import './AgeGate.css';

/**
 * AgeGate Component
 * Enforces 18+ age requirement before allowing signup
 * Supports multiple verification methods: DOB entry
 */
const AgeGate = ({ onAgeVerified, onCancel }) => {
  const [step, setStep] = useState('method'); // method, dob, confirm
  const [verificationMethod, setVerificationMethod] = useState('dob');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ageBracket, setAgeBracket] = useState(null);

  const calculateAge = (dobString) => {
    if (!dobString) return null;
    const dob = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    return age;
  };

  const handleMethodSelect = (method) => {
    setVerificationMethod(method);
    setStep('dob');
    setError('');
  };

  const handleDateChange = (e) => {
    setDateOfBirth(e.target.value);
    setError('');

    if (e.target.value) {
      const age = calculateAge(e.target.value);
      setAgeBracket(age);
    } else {
      setAgeBracket(null);
    }
  };

  const validateDateOfBirth = () => {
    if (!dateOfBirth) {
      setError('Please enter your date of birth');
      return false;
    }

    const dob = new Date(dateOfBirth);
    const today = new Date();

    // Check if date is in the future
    if (dob > today) {
      setError('Date of birth cannot be in the future');
      return false;
    }

    // Check if date is reasonable (not more than 120 years ago)
    const age = calculateAge(dateOfBirth);
    if (age < 0 || age > 120) {
      setError('Please enter a valid date of birth');
      return false;
    }

    // Check if user is 18+
    if (age < 18) {
      setError(`You must be at least 18 years old. (You are ${age} years old)`);
      return false;
    }

    return true;
  };

  const handleVerify = async () => {
    if (!validateDateOfBirth()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const ageVerification = {
        method: verificationMethod,
        dateOfBirth: dateOfBirth
      };

      // Call backend to verify age
      const response = await axios.post(`${API_BASE_URL}/auth/verify-age`, {
        ageVerification
      });

      if (response.data.verified || response.data.success) {
        onAgeVerified({
          method: verificationMethod,
          dateOfBirth: dateOfBirth,
          age: calculateAge(dateOfBirth)
        });
      } else {
        setError(response.data.error || 'Age verification failed');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Age verification failed';
      setError(errorMessage);

      // Check for underage user
      if (err.response?.data?.code === 'UNDERAGE_USER') {
        setError(`You must be at least 18 years old. (You are ${ageBracket} years old)`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    // Pass verified data to parent
    onAgeVerified({
      method: verificationMethod,
      dateOfBirth: dateOfBirth,
      age: ageBracket
    });
  };

  return (
    <div className="age-gate-container">
      <div className="age-gate-card simple-age-card">
        <div className="age-gate-header">
          <h1>Confirm your age</h1>
          <p className="age-gate-subtitle">LinkUp is for adults 18 and older.</p>
        </div>

        <div className="age-gate-step">
          <div className="form-group">
            <label htmlFor="age-date-of-birth">Date of birth</label>
            <input
              id="age-date-of-birth"
              type="date"
              value={dateOfBirth}
              onChange={handleDateChange}
              max={new Date().toISOString().split('T')[0]}
              className="dob-input"
            />
            {ageBracket !== null && (
              <div className={`age-display ${ageBracket >= 18 ? 'valid' : 'invalid'}`}>
                You are {ageBracket} years old
              </div>
            )}
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button
            className="button-primary"
            onClick={handleVerify}
            disabled={!dateOfBirth || loading}
          >
            {loading ? 'Checking...' : 'Continue'}
          </button>

          <button
            className="button-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Back
          </button>

          <p className="privacy-note">
            Your birth date is used only to confirm the 18+ requirement.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="age-gate-container">
      <div className="age-gate-card">
        <div className="age-gate-header">
          <h1>LinkUp Age Verification</h1>
          <p className="age-gate-subtitle">You must be 18+ to use LinkUp</p>
        </div>

        {/* Step 1: Choose Verification Method */}
        {step === 'method' && (
          <div className="age-gate-step">
            <h2>How would you like to verify your age?</h2>
            <div className="verification-methods">
              <button
                className="method-button"
                onClick={() => handleMethodSelect('dob')}
              >
                <div className="method-icon">📅</div>
                <div className="method-title">Date of Birth</div>
                <div className="method-description">Enter your birth date</div>
              </button>

              <button
                className="method-button"
                onClick={() => handleMethodSelect('id_verification')}
                disabled
                title="Coming soon"
              >
                <div className="method-icon">🆔</div>
                <div className="method-title">ID Verification</div>
                <div className="method-description">Upload government ID</div>
              </button>

              <button
                className="method-button"
                onClick={() => handleMethodSelect('selfie_dob')}
                disabled
                title="Coming soon"
              >
                <div className="method-icon">🤳</div>
                <div className="method-title">Selfie + DOB</div>
                <div className="method-description">Take a selfie</div>
              </button>
            </div>

            <button
              className="button-secondary"
              onClick={onCancel}
            >
              Not ready? Cancel
            </button>
          </div>
        )}

        {/* Step 2: Enter Date of Birth */}
        {step === 'dob' && (
          <div className="age-gate-step">
            <button
              className="button-back"
              onClick={() => {
                setStep('method');
                setError('');
              }}
            >
              ← Back
            </button>

            <h2>What's your date of birth?</h2>

            <div className="dob-input-container">
              <input
                type="date"
                value={dateOfBirth}
                onChange={handleDateChange}
                max={new Date().toISOString().split('T')[0]}
                className="dob-input"
              />
              {ageBracket !== null && (
                <div className={`age-display ${ageBracket >= 18 ? 'valid' : 'invalid'}`}>
                  You are {ageBracket} years old
                </div>
              )}
            </div>

            {error && (
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}

            <button
              className="button-primary"
              onClick={handleVerify}
              disabled={!dateOfBirth || loading}
            >
              {loading ? 'Verifying...' : 'Verify Age'}
            </button>

            <p className="privacy-note">
              Your date of birth is encrypted and used only for age verification.
            </p>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 'confirm' && (
          <div className="age-gate-step">
            <div className="confirmation-box">
              <div className="success-icon">✅</div>
              <h2>Age Verification Successful!</h2>
              <p className="confirmation-text">
                You have verified that you are {ageBracket} years old and meet the 18+ requirement to use LinkUp.
              </p>

              <div className="confirmation-details">
                <div className="detail-row">
                  <span className="detail-label">Method:</span>
                  <span className="detail-value">Date of Birth</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Age:</span>
                  <span className="detail-value">{ageBracket} years</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">DOB:</span>
                  <span className="detail-value">
                    {new Date(dateOfBirth).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            </div>

            <button
              className="button-primary"
              onClick={handleConfirm}
            >
              Continue to Signup
            </button>

            <p className="confirmation-footer">
              By continuing, you agree to LinkUp's Terms of Service and Privacy Policy
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="age-gate-footer">
          <p>🔒 Your information is encrypted and secure</p>
        </div>
      </div>

      {/* Safety Info */}
      <div className="safety-info">
        <h3>Why Age Verification?</h3>
        <ul>
          <li>LinkUp is designed for adults 18 and older</li>
          <li>Age verification protects minors from inappropriate content</li>
          <li>Your date of birth is encrypted and never shared</li>
          <li>Falsifying age information may result in permanent ban</li>
        </ul>
      </div>
    </div>
  );
};

export default AgeGate;
