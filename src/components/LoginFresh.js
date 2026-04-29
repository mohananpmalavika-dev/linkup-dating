import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import PublicLegalNotice from './PublicLegalNotice';
import { signInWithGmail } from '../firebase';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

const LoginFresh = ({ language = 'en', onBackToLaunch, onLoginSuccess, onSignUpClick }) => {
  const [loginMethod, setLoginMethod] = useState('phone');
  
  // Phone OTP (Firebase)
  const [phone, setPhone] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState('');
  const recaptchaContainerRef = useRef(null);
  const confirmationResultRef = useRef(null);

  // MPIN
  const [mpin, setMpin] = useState('');

  // Gmail
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Username setup
  const [needsUsernameSetup, setNeedsUsernameSetup] = useState(false);
  const [setupUsername, setSetupUsername] = useState('');
  const [setupUsernameStatus, setSetupUsernameStatus] = useState(null);
  const [setupUsernameError, setSetupUsernameError] = useState('');

  // Verified user token
  const [verifiedToken, setVerifiedToken] = useState(null);

  const direction = language === 'ar' || language === 'hi' ? 'rtl' : 'ltr';
  const legalNoticeMessage = 'By continuing, you agree to the Terms and acknowledge the Privacy Policy.';

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const validateUsername = (username) => {
    return /^[a-z0-9_-]{3,20}$/.test(username);
  };

  const completeLogin = (user, token, email) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('userEmail', email || user?.email || '');
    if (onLoginSuccess) {
      onLoginSuccess(user, token);
    }
  };

  // ============ PHONE OTP (FIREBASE) ============
  const initializeFirebaseRecaptcha = async () => {
    try {
      const { initializeAppCheck, ReCaptchaV3Provider } = await import('firebase/app-check');
      const { getAuth, RecaptchaVerifier } = await import('firebase/auth');
      
      if (recaptchaContainerRef.current && !window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier('firebase-recaptcha', {
          size: 'invisible',
          callback: () => {}
        }, getAuth());
      }
    } catch (err) {
      console.error('RecaptchaVerifier error:', err);
    }
  };

  const handlePhoneOtpSend = async (e) => {
    e?.preventDefault();
    clearMessages();

    const trimmedPhone = phone.trim();
    if (!trimmedPhone || trimmedPhone.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    try {
      const { getAuth, signInWithPhoneNumber } = await import('firebase/auth');
      const auth = getAuth();

      if (!window.recaptchaVerifier) {
        await initializeFirebaseRecaptcha();
      }

      const confirmationResult = await signInWithPhoneNumber(
        auth,
        trimmedPhone.startsWith('+') ? trimmedPhone : '+91' + trimmedPhone.slice(-10),
        window.recaptchaVerifier
      );

      confirmationResultRef.current = confirmationResult;
      setPhoneOtpSent(true);
      setSuccess('OTP sent to your phone');
    } catch (err) {
      console.error('Phone OTP send error:', err);
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneOtpVerify = async (e) => {
    e?.preventDefault();
    clearMessages();

    if (!phoneOtp || phoneOtp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await confirmationResultRef.current.confirm(phoneOtp);
      const idToken = await userCredential.user.getIdToken();

      const response = await axios.post(
        `${API_BASE_URL}/auth/firebase-verify-phone`,
        { idToken, phone: userCredential.user.phoneNumber },
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (response.data?.user) {
        if (response.data.user.username) {
          completeLogin(response.data.user, response.data.token, response.data.user.email);
        } else {
          setVerifiedToken(response.data.token);
          setNeedsUsernameSetup(true);
          setSuccess('Phone verified! Please set up your username');
        }
      }
    } catch (err) {
      console.error('Phone OTP verification error:', err);
      setError(err.response?.data?.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  // ============ MPIN ============
  const handleMpinLogin = async (e) => {
    e?.preventDefault();
    clearMessages();

    if (!mpin || mpin.length < 4 || mpin.length > 6) {
      setError('MPIN must be 4-6 digits');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/auth/login-mpin`,
        { mpin },
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (response.data?.user) {
        completeLogin(response.data.user, response.data.token, response.data.user.email);
      }
    } catch (err) {
      console.error('MPIN login error:', err);
      setError(err.response?.data?.error || 'Invalid MPIN');
    } finally {
      setLoading(false);
    }
  };

  // ============ GMAIL ============
  const handleGmailSignIn = async () => {
    clearMessages();
    setLoading(true);
    try {
      const gmailUser = await signInWithGmail();
      if (!gmailUser?.email) {
        setError('Failed to get email from Gmail');
        return;
      }

      const idToken = await gmailUser.getIdToken();
      const response = await axios.post(
        `${API_BASE_URL}/auth/google-signup`,
        { idToken, email: gmailUser.email },
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (response.data?.user) {
        if (response.data.user.username) {
          completeLogin(response.data.user, response.data.token, gmailUser.email);
        } else {
          setVerifiedToken(response.data.token);
          setNeedsUsernameSetup(true);
          setSuccess('Gmail verified! Please set up your username');
        }
      }
    } catch (err) {
      console.error('Gmail sign-in error:', err);
      setError(err.response?.data?.error || 'Failed to sign in with Gmail');
    } finally {
      setLoading(false);
    }
  };

  // ============ USERNAME SETUP ============
  const checkUsernameAvailability = async (username) => {
    const trimmed = String(username || '').trim().toLowerCase();

    if (!trimmed) {
      setSetupUsernameStatus(null);
      setSetupUsernameError('');
      return false;
    }

    if (!validateUsername(trimmed)) {
      setSetupUsernameStatus(null);
      setSetupUsernameError('Username: 3-20 chars (letters, numbers, _, -)');
      return false;
    }

    setSetupUsernameStatus('checking');
    try {
      const response = await axios.post(
        `${API_BASE_URL}/auth/check-username`,
        { username: trimmed },
        { headers: { Authorization: `Bearer ${verifiedToken}` } }
      );

      if (response.data?.available) {
        setSetupUsernameStatus('available');
        setSetupUsernameError('');
        return true;
      } else {
        setSetupUsernameStatus('taken');
        setSetupUsernameError('Username already taken');
        return false;
      }
    } catch (err) {
      setSetupUsernameStatus(null);
      setSetupUsernameError('Error checking username');
      return false;
    }
  };

  const handleSetUsername = async (event) => {
    event.preventDefault();
    clearMessages();

    const trimmed = setupUsername.trim().toLowerCase();

    if (!trimmed || setupUsernameStatus !== 'available') {
      setSetupUsernameError('Please choose an available username');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/auth/set-username`,
        { username: trimmed },
        { headers: { Authorization: `Bearer ${verifiedToken}` } }
      );

      if (response.data?.success && response.data?.token) {
        completeLogin(response.data.user, response.data.token, response.data.user?.email);
      }
    } catch (err) {
      setSetupUsernameError(err.response?.data?.message || 'Failed to set username');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (event) => {
    if (needsUsernameSetup) return handleSetUsername(event);
    if (loginMethod === 'phone') {
      return phoneOtpSent ? handlePhoneOtpVerify(event) : handlePhoneOtpSend(event);
    }
    if (loginMethod === 'mpin') return handleMpinLogin(event);
    if (loginMethod === 'gmail') return handleGmailSignIn();
  };

  return (
    <div className="login-container" dir={direction}>
      <div className="login-card">
        {!needsUsernameSetup && !phoneOtpSent && onBackToLaunch && (
          <div className="login-topbar">
            <button
              type="button"
              className="btn btn-outline login-home-btn"
              onClick={onBackToLaunch}
              disabled={loading}
            >
              Home
            </button>
          </div>
        )}

        <div className="login-header">
          <img src="/logo.svg" alt="LinkUp" className="login-logo" />
          <h1>LinkUp</h1>
          <p className="login-subtitle">Sign in to continue</p>
        </div>

        {!needsUsernameSetup && !phoneOtpSent && (
          <div className="login-method-tabs">
            <button
              type="button"
              className={`method-tab ${loginMethod === 'phone' ? 'active' : ''}`}
              onClick={() => {
                setLoginMethod('phone');
                clearMessages();
                setPhone('');
                setPhoneOtp('');
                setPhoneOtpSent(false);
              }}
            >
              Phone OTP
            </button>
            <button
              type="button"
              className={`method-tab ${loginMethod === 'mpin' ? 'active' : ''}`}
              onClick={() => {
                setLoginMethod('mpin');
                clearMessages();
                setMpin('');
              }}
            >
              MPIN
            </button>
            <button
              type="button"
              className={`method-tab ${loginMethod === 'gmail' ? 'active' : ''}`}
              onClick={() => {
                setLoginMethod('gmail');
                clearMessages();
              }}
            >
              Gmail
            </button>
          </div>
        )}

        <form className="login-form" onSubmit={handleFormSubmit}>
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          {!needsUsernameSetup && !phoneOtpSent && loginMethod === 'phone' && (
            <div className="form-group">
              <label htmlFor="phone">Phone Number</label>
              <input
                type="tel"
                id="phone"
                placeholder="+91xxxxxxxxxx"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  clearMessages();
                }}
                className="form-input"
              />
              <div id="firebase-recaptcha-container" ref={recaptchaContainerRef} className="recaptcha-container" />
            </div>
          )}

          {!needsUsernameSetup && !phoneOtpSent && loginMethod === 'mpin' && (
            <div className="form-group">
              <label htmlFor="mpin">MPIN</label>
              <input
                type="password"
                inputMode="numeric"
                id="mpin"
                placeholder="4-6 digits"
                value={mpin}
                onChange={(e) => {
                  setMpin(e.target.value.replace(/\D/g, '').slice(0, 6));
                  clearMessages();
                }}
                maxLength="6"
                className="form-input"
              />
            </div>
          )}

          {phoneOtpSent && (
            <div className="form-group">
              <label htmlFor="otp">One-Time Password</label>
              <input
                type="text"
                inputMode="numeric"
                id="otp"
                placeholder="6-digit OTP"
                value={phoneOtp}
                onChange={(e) => {
                  setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                  clearMessages();
                }}
                maxLength="6"
                className="form-input"
              />
            </div>
          )}

          {needsUsernameSetup && (
            <div className="form-group">
              <label htmlFor="setupUsername">Create Username</label>
              <input
                type="text"
                id="setupUsername"
                placeholder="3-20 characters"
                value={setupUsername}
                onChange={async (e) => {
                  setSetupUsername(e.target.value);
                  clearMessages();
                  await checkUsernameAvailability(e.target.value);
                }}
                className="form-input"
              />
              {setupUsernameStatus === 'checking' && <div className="username-status checking">Checking...</div>}
              {setupUsernameStatus === 'available' && <div className="username-status available">✓ Available</div>}
              {setupUsernameStatus === 'taken' && <div className="username-status taken">✗ Taken</div>}
              {setupUsernameError && <div className="username-error">{setupUsernameError}</div>}
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {needsUsernameSetup
                ? loading ? 'Setting up...' : 'Complete Login'
                : phoneOtpSent
                  ? loading ? 'Verifying...' : 'Verify OTP'
                  : loginMethod === 'gmail'
                    ? loading ? 'Opening Google...' : 'Sign in with Google'
                    : loginMethod === 'mpin'
                      ? loading ? 'Logging in...' : 'Login with MPIN'
                      : loading ? 'Sending OTP...' : 'Send OTP'}
            </button>

            {(phoneOtpSent || needsUsernameSetup) && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setPhoneOtp('');
                  setPhoneOtpSent(false);
                  setNeedsUsernameSetup(false);
                  setSetupUsername('');
                  setSetupUsernameStatus(null);
                  setSetupUsernameError('');
                  setVerifiedToken(null);
                  clearMessages();
                }}
                disabled={loading}
              >
                Back
              </button>
            )}
          </div>
        </form>

        <div className="login-footer">
          <p className="security-info">Secure login with OTP verification</p>
          <PublicLegalNotice language={language} message={legalNoticeMessage} />
          {!phoneOtpSent && !needsUsernameSetup && onSignUpClick && (
            <p className="signup-prompt">
              Don't have an account?{' '}
              <button
                type="button"
                className="signup-link"
                onClick={onSignUpClick}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#FF6B6B',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                  font: 'inherit',
                }}
              >
                Sign Up
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginFresh;
