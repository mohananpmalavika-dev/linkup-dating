import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { getTranslation, getTranslationValue } from "../data/translations";
import useVoice from "../hooks/useVoice";
import { API_BASE_URL } from "../utils/api";
import PublicLegalNotice from "./PublicLegalNotice";
import {
  isFirebaseConfigured,
  createRecaptchaVerifier,
  sendFirebasePhoneOTP
} from "../config/firebase";
import "../styles/Login.css";

const ADMIN_EMAIL = "mgdhanyamohan@gmail.com";

const isAdminUser = (userRecord) =>
  Boolean(
    userRecord &&
      (
        userRecord.isAdmin ||
        userRecord.is_admin ||
        userRecord.role === "admin" ||
        userRecord.registrationType === "admin"
      )
  );

const normalizeAuthenticatedUser = (userRecord, emailAddress) => {
  const adminSession = isAdminUser(userRecord) || emailAddress === ADMIN_EMAIL;

  if (adminSession) {
    return {
      ...userRecord,
      name: userRecord?.name || "LinkUp Admin",
      email: userRecord?.email || emailAddress,
      avatar: userRecord?.avatar || "A",
      role: "admin",
      registrationType: "admin",
      isAdmin: true,
    };
  }

  return {
    ...userRecord,
    role: userRecord?.role || "user",
    registrationType: userRecord?.registrationType || "user",
  };
};

const Login = ({
  language = "en",
  onBackToLaunch,
  onLoginSuccess,
  onSignUpClick,
}) => {
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [otpId, setOtpId] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpChannel, setOtpChannel] = useState("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [needsUsernameSetup, setNeedsUsernameSetup] = useState(false);
  const [setupUsername, setSetupUsername] = useState("");
  const [setupUsernameStatus, setSetupUsernameStatus] = useState(null);
  const [setupUsernameError, setSetupUsernameError] = useState("");
  const [verifiedUser, setVerifiedUser] = useState(null);
  const [verifiedToken, setVerifiedToken] = useState(null);
  const [loginMethod, setLoginMethod] = useState("otp");
  const [mpin, setMpin] = useState("");
  const [authMethods, setAuthMethods] = useState(null);

  // Firebase Phone Auth state
  const [firebaseOtpSent, setFirebaseOtpSent] = useState(false);
  const [firebaseConfirmationResult, setFirebaseConfirmationResult] = useState(null);
  const recaptchaContainerRef = useRef(null);
  const recaptchaVerifierRef = useRef(null);

  const {
    recognitionSupported,
    speechSupported,
    listeningKey,
    speaking,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  } = useVoice(language);

  const { login: loginCopy, direction } = getTranslation(language);
  const legalNoticeMessage = getTranslationValue(language, "public.loginNotice");

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const validateUsername = (value) => /^[a-zA-Z0-9_-]{3,20}$/.test(value);
  const looksLikePhoneNumber = (value) => /^\+?[0-9\s()-]{7,}$/.test(String(value || "").trim());
  const trimmedIdentifier = identifier.trim();
  const normalizedEmail = validateEmail(trimmedIdentifier) ? trimmedIdentifier.toLowerCase() : "";
  const normalizedPhone =
    !normalizedEmail && looksLikePhoneNumber(trimmedIdentifier) ? trimmedIdentifier : "";

  const resetOtpFlow = () => {
    setOtp("");
    setOtpId("");
    setOtpSent(false);
    setAuthMethods(null);
    clearMessages();
  };

  const resetMpinFlow = () => {
    setMpin("");
    setAuthMethods(null);
    clearMessages();
  };

  const resetFirebaseFlow = () => {
    setFirebaseOtpSent(false);
    setFirebaseConfirmationResult(null);
    setOtp("");
    setAuthMethods(null);
    clearMessages();
  };

  const resetUsernameSetup = () => {
    setNeedsUsernameSetup(false);
    setSetupUsername("");
    setSetupUsernameStatus(null);
    setSetupUsernameError("");
    setVerifiedUser(null);
    setVerifiedToken(null);
    resetOtpFlow();
    resetMpinFlow();
    resetFirebaseFlow();
  };

  // Cleanup reCAPTCHA on unmount
  useEffect(() => {
    return () => {
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  const handleVoiceFill = (fieldKey, updateValue) => {
    if (listeningKey === fieldKey) {
      stopListening();
      return;
    }

    startListening(fieldKey, updateValue);
  };

  const fetchAuthMethods = async (value) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setAuthMethods(null);
      return;
    }
    try {
      const response = await axios.get(`${API_BASE_URL}/auth/auth-methods`, {
        params: { identifier: trimmed }
      });
      setAuthMethods(response.data);
    } catch {
      setAuthMethods(null);
    }
  };

  const renderFieldVoiceActions = (fieldKey, speakText, onVoiceResult) => (
    <span className="field-actions">
      {recognitionSupported ? (
        <button
          type="button"
          className={`voice-btn ${listeningKey === fieldKey ? "active" : ""}`}
          onClick={() => handleVoiceFill(fieldKey, onVoiceResult)}
          aria-label={listeningKey === fieldKey ? "Stop voice input" : "Start voice input"}
          title={listeningKey === fieldKey ? "Stop voice input" : "Start voice input"}
        >
          {listeningKey === fieldKey ? "Stop Mic" : "Mic"}
        </button>
      ) : null}
      {speechSupported ? (
        <button
          type="button"
          className={`voice-btn ${speaking ? "active" : ""}`}
          onClick={() => (speaking ? stopSpeaking() : speak(speakText))}
          aria-label={speaking ? "Stop voice playback" : "Read aloud"}
          title={speaking ? "Stop voice playback" : "Read aloud"}
        >
          {speaking ? "Stop Audio" : "Speak"}
        </button>
      ) : null}
    </span>
  );

  const checkSetupUsernameAvailability = async (username) => {
    const trimmedUsername = String(username || "").trim().toLowerCase();

    if (!trimmedUsername) {
      setSetupUsernameStatus(null);
      setSetupUsernameError("");
      return false;
    }

    if (!validateUsername(trimmedUsername)) {
      setSetupUsernameStatus(null);
      setSetupUsernameError(
        "Username can only contain letters, numbers, underscores, and dashes (3-20 characters)"
      );
      return false;
    }

    try {
      setSetupUsernameStatus("checking");
      setSetupUsernameError("");

      const response = await axios.post(`${API_BASE_URL}/auth/check-username`, {
        username: trimmedUsername,
      });

      if (response.data?.available) {
        setSetupUsernameStatus("available");
        return true;
      }

      setSetupUsernameStatus("taken");
      setSetupUsernameError(response.data?.message || "Username is already taken");
      return false;
    } catch (availabilityError) {
      setSetupUsernameStatus(null);
      setSetupUsernameError("Error checking username availability");
      return false;
    }
  };

  const completeLogin = (userRecord, token, emailAddress) => {
    onLoginSuccess?.(normalizeAuthenticatedUser(userRecord, emailAddress), token);
  };

  const handleSendOtp = async (event) => {
    event.preventDefault();
    clearMessages();

    if (!trimmedIdentifier) {
      setError("Please enter your email address or phone number");
      return;
    }

    if (!normalizedEmail && !normalizedPhone) {
      setError("Please enter a valid email address or phone number");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/send-otp`, {
        identifier: normalizedPhone || normalizedEmail,
        purpose: "login",
        channel: otpChannel,
      });

      if (!response.data?.success) {
        setError(response.data?.message || response.data?.error || "Failed to send OTP");
        return;
      }

      setOtpId(response.data.otpId || "");
      setOtpSent(true);
      setSuccess(response.data.message || "OTP sent successfully");
    } catch (sendError) {
      if (!sendError.response) {
        setError("Backend is not running. Please start the API server and try again.");
      } else {
        setError(
          sendError.response.data?.message ||
            sendError.response.data?.error ||
            "Unable to send OTP. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    clearMessages();

    if (!otp.trim()) {
      setError("Please enter the OTP");
      return;
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Please enter the 6-digit OTP");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/verify-otp`, {
        identifier: trimmedIdentifier,
        otp: otp.trim(),
        otpId,
      });

      if (!response.data?.success || !response.data?.token || !response.data?.user) {
        setError(response.data?.message || response.data?.error || "Failed to verify OTP");
        return;
      }

      if (response.data.needsUsernameSetup) {
        setVerifiedUser(response.data.user);
        setVerifiedToken(response.data.token);
        setNeedsUsernameSetup(true);
        setSuccess("OTP verified. Create your username to finish logging in.");
        setOtpSent(false);
        setOtp("");
        return;
      }

      completeLogin(
        response.data.user,
        response.data.token,
        response.data.user?.email || normalizedEmail || trimmedIdentifier
      );
    } catch (verifyError) {
      if (!verifyError.response) {
        setError("Backend is not running. Please start the API server and try again.");
      } else {
        setError(
          verifyError.response.data?.message ||
            verifyError.response.data?.error ||
            "Unable to verify OTP. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLoginMpin = async (event) => {
    event.preventDefault();
    clearMessages();

    if (!trimmedIdentifier) {
      setError("Please enter your email or phone number");
      return;
    }

    if (!mpin.trim()) {
      setError("Please enter your MPIN");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login-mpin`, {
        identifier: trimmedIdentifier,
        mpin: mpin.trim(),
      });

      if (!response.data?.token || !response.data?.user) {
        setError(response.data?.message || response.data?.error || "Failed to login with MPIN");
        return;
      }

      try {
        localStorage.setItem("linkup_preferred_login_method", "mpin");
      } catch {}

      completeLogin(
        response.data.user,
        response.data.token,
        response.data.user?.email || trimmedIdentifier
      );
    } catch (loginError) {
      if (!loginError.response) {
        setError("Backend is not running. Please start the API server and try again.");
      } else {
        setError(
          loginError.response.data?.message ||
            loginError.response.data?.error ||
            "Unable to login with MPIN. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetUsername = async (event) => {
    event.preventDefault();
    clearMessages();

    const trimmedUsername = setupUsername.trim().toLowerCase();

    if (!trimmedUsername) {
      setSetupUsernameError("Please enter a username");
      return;
    }

    if (!validateUsername(trimmedUsername)) {
      setSetupUsernameError(
        "Username can only contain letters, numbers, underscores, and dashes (3-20 characters)"
      );
      return;
    }

    if (setupUsernameStatus !== "available") {
      setSetupUsernameError("Please choose an available username");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/auth/set-username`,
        { username: trimmedUsername },
        {
          headers: {
            Authorization: `Bearer ${verifiedToken}`,
          },
        }
      );

      if (!response.data?.success) {
        setSetupUsernameError(response.data?.message || response.data?.error || "Failed to set username");
        return;
      }

      completeLogin(
        {
          ...verifiedUser,
          ...response.data.user,
          username: response.data.user?.username || trimmedUsername,
        },
        verifiedToken,
        verifiedUser?.email || normalizedEmail || trimmedIdentifier
      );
    } catch (setUsernameError) {
      if (!setUsernameError.response) {
        setSetupUsernameError("Backend is not running. Please start the API server and try again.");
      } else {
        setSetupUsernameError(
          setUsernameError.response.data?.message ||
            setUsernameError.response.data?.error ||
            "Unable to set username. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Firebase Phone Auth handlers
  const handleSendFirebasePhoneOTP = async (event) => {
    event.preventDefault();
    clearMessages();

    if (!normalizedPhone) {
      setError("Please enter a valid phone number with country code (e.g., +91xxxxxxxxxx)");
      return;
    }

    if (!isFirebaseConfigured()) {
      setError("Firebase Phone Auth is not configured. Please contact support.");
      return;
    }

    setLoading(true);

    try {
      // Clean up existing reCAPTCHA verifier
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch {}
        recaptchaVerifierRef.current = null;
      }

      // Create new invisible reCAPTCHA verifier
      const verifier = createRecaptchaVerifier('firebase-recaptcha-container', (response) => {
        console.log('reCAPTCHA verified:', response);
      });

      if (!verifier) {
        setError("Failed to initialize reCAPTCHA. Please try again.");
        return;
      }

      recaptchaVerifierRef.current = verifier;

      // Send OTP via Firebase
      const result = await sendFirebasePhoneOTP(normalizedPhone, verifier);

      if (!result.success) {
        setError(result.error || "Failed to send SMS. Please try again.");
        return;
      }

      setFirebaseConfirmationResult(result.confirmationResult);
      setFirebaseOtpSent(true);
      setSuccess("OTP sent to your phone via SMS");
    } catch (firebaseError) {
      console.error('Firebase phone OTP error:', firebaseError);
      setError(firebaseError.message || "Failed to send phone verification SMS");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyFirebasePhoneOTP = async (event) => {
    event.preventDefault();
    clearMessages();

    if (!otp.trim()) {
      setError("Please enter the OTP");
      return;
    }

    if (!firebaseConfirmationResult) {
      setError("No active verification session. Please request a new OTP.");
      return;
    }

    setLoading(true);

    try {
      // Confirm the OTP with Firebase
      const userCredential = await firebaseConfirmationResult.confirm(otp.trim());

      if (!userCredential || !userCredential.user) {
        setError("Failed to verify OTP with Firebase");
        return;
      }

      // Get Firebase ID token
      const idToken = await userCredential.user.getIdToken();

      // Send to our backend for verification and login
      const response = await axios.post(`${API_BASE_URL}/auth/firebase-verify-phone`, {
        idToken,
        email: normalizedEmail || undefined
      });

      if (!response.data?.success || !response.data?.token || !response.data?.user) {
        setError(response.data?.message || response.data?.error || "Failed to verify phone");
        return;
      }

      if (response.data.needsUsernameSetup) {
        setVerifiedUser(response.data.user);
        setVerifiedToken(response.data.token);
        setNeedsUsernameSetup(true);
        setSuccess("Phone verified. Create your username to finish logging in.");
        setFirebaseOtpSent(false);
        setOtp("");
        return;
      }

      // Store preferred login method
      try {
        localStorage.setItem("linkup_preferred_login_method", "firebase_phone");
      } catch {}

      completeLogin(
        response.data.user,
        response.data.token,
        response.data.user?.email || normalizedEmail || trimmedIdentifier
      );
    } catch (verifyError) {
      console.error('Firebase OTP verification error:', verifyError);
      if (!verifyError.response) {
        setError("Backend is not running. Please start the API server and try again.");
      } else {
        setError(
          verifyError.response.data?.message ||
            verifyError.response.data?.error ||
            "Unable to verify OTP. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const isUsernameStep = needsUsernameSetup;
  const isFirebaseStep = loginMethod === "firebase_phone" && firebaseOtpSent;

  const formTitle = isUsernameStep
    ? "Create your username"
    : loginMethod === "mpin"
      ? "Login with MPIN"
      : isFirebaseStep
        ? "Verify your phone"
        : otpSent
          ? "Verify your account"
          : "Verify your account";

  const formDescription = isUsernameStep
    ? "Set a unique username before you continue to your LinkUp account."
    : loginMethod === "mpin"
      ? "Enter your email or phone number and MPIN to sign in."
      : isFirebaseStep
        ? "Enter the one-time password sent to your phone via SMS."
        : otpSent
          ? "Enter the one-time password sent to your device."
          : "Enter your email address or phone number and choose how to receive your OTP.";

  const handleFormSubmit = (event) => {
    if (isUsernameStep) {
      return handleSetUsername(event);
    }
    if (loginMethod === "mpin") {
      return handleLoginMpin(event);
    }
    if (isFirebaseStep) {
      return handleVerifyFirebasePhoneOTP(event);
    }
    if (otpSent) {
      return handleVerifyOtp(event);
    }
    if (loginMethod === "firebase_phone") {
      return handleSendFirebasePhoneOTP(event);
    }
    return handleSendOtp(event);
  };

  const isBackVisible = otpSent || isFirebaseStep || isUsernameStep;

  return (
    <div className="login-container" dir={direction}>
      <div className="login-card">
        {!otpSent && !isUsernameStep && !isFirebaseStep && onBackToLaunch ? (
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
        ) : null}

        <div className="login-header">
          <img src="/logo.svg" alt="LinkUp" className="login-logo" />
          <p className="login-kicker">{loginCopy.welcomeBack || "Welcome back"}</p>
          <h1>LinkUp</h1>
          <p className="login-subtitle">
            Use your email address, phone number, or MPIN to sign in to LinkUp.
          </p>
        </div>

        {!isUsernameStep && !otpSent && !isFirebaseStep ? (
          <div className="login-method-tabs">
            <button
              type="button"
              className={`method-tab ${loginMethod === "otp" ? "active" : ""}`}
              onClick={() => {
                setLoginMethod("otp");
                resetMpinFlow();
                resetFirebaseFlow();
              }}
            >
              OTP Login
            </button>
            <button
              type="button"
              className={`method-tab ${loginMethod === "mpin" ? "active" : ""}`}
              onClick={() => {
                setLoginMethod("mpin");
                resetOtpFlow();
                resetFirebaseFlow();
              }}
            >
              MPIN Login
            </button>
            {isFirebaseConfigured() ? (
              <button
                type="button"
                className={`method-tab ${loginMethod === "firebase_phone" ? "active" : ""}`}
                onClick={() => {
                  setLoginMethod("firebase_phone");
                  resetOtpFlow();
                  resetMpinFlow();
                }}
              >
                Phone (SMS)
              </button>
            ) : null}
          </div>
        ) : null}

        <form className="login-form" onSubmit={handleFormSubmit}>
          <div className="form-intro">
            <div className="intro-heading-row">
              <h2>{formTitle}</h2>
              {(recognitionSupported || speechSupported) ? renderFieldVoiceActions(
                "form-intro",
                `${formTitle}. ${formDescription}`,
                () => {}
              ) : null}
            </div>
            <p>{formDescription}</p>
          </div>

          {!otpSent && !isUsernameStep && !isFirebaseStep ? (
            <div className="form-group">
              <label htmlFor="identifier">
                <span>
                  {loginMethod === "firebase_phone"
                    ? "Phone Number"
                    : "Email Address or Phone Number"}
                </span>
                {renderFieldVoiceActions("identifier", trimmedIdentifier || "Email address or phone number", (value) => {
                  setIdentifier(value);
                  clearMessages();
                  fetchAuthMethods(value);
                })}
              </label>
              <input
                type="text"
                id="identifier"
                placeholder={
                  loginMethod === "firebase_phone"
                    ? "Enter your phone number with country code (e.g., +91xxxxxxxxxx)"
                    : "Enter your email address or phone number"
                }
                value={identifier}
                onChange={(event) => {
                  setIdentifier(event.target.value);
                  clearMessages();
                  fetchAuthMethods(event.target.value);
                }}
                className="form-input"
                autoComplete="username"
              />
              {authMethods?.exists ? (
                <div className="auth-methods-hint">
                  {authMethods.hasMpin ? (
                    <span className="hint-item">MPIN available</span>
                  ) : null}
                  {authMethods.emailVerified ? (
                    <span className="hint-item">Email verified</span>
                  ) : null}
                  {authMethods.phoneVerified ? (
                    <span className="hint-item">Phone verified</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {loginMethod === "otp" && !otpSent && !isUsernameStep ? (
            <div className="form-group">
              <label>
                <span>Send OTP via</span>
              </label>
              <div className="channel-selector">
                <button
                  type="button"
                  className={`channel-btn ${otpChannel === "email" ? "active" : ""}`}
                  onClick={() => setOtpChannel("email")}
                >
                  Email
                </button>
                <button
                  type="button"
                  className={`channel-btn ${otpChannel === "phone" ? "active" : ""}`}
                  onClick={() => setOtpChannel("phone")}
                  disabled={
                    authMethods?.exists &&
                    !authMethods.phoneVerified
                  }
                  title={
                    authMethods?.exists && !authMethods.phoneVerified
                      ? "Phone not verified. Verify via email first."
                      : "Send OTP to phone"
                  }
                >
                  Phone
                </button>
              </div>
            </div>
          ) : null}

          {loginMethod === "firebase_phone" && !firebaseOtpSent && !isUsernameStep ? (
            <div className="form-group">
              <div id="firebase-recaptcha-container" className="recaptcha-container"></div>
              {isFirebaseConfigured() ? null : (
                <div className="firebase-notice">
                  Firebase Phone Auth is not configured. SMS login is unavailable.
                </div>
              )}
            </div>
          ) : null}

          {loginMethod === "mpin" && !isUsernameStep ? (
            <div className="form-group">
              <label htmlFor="mpin">
                <span>MPIN</span>
                {renderFieldVoiceActions("mpin", mpin || "M P I N", (value) => {
                  setMpin(value.replace(/\D/g, "").slice(0, 6));
                  clearMessages();
                })}
              </label>
              <input
                type="password"
                inputMode="numeric"
                id="mpin"
                placeholder="Enter your 4-6 digit MPIN"
                value={mpin}
                onChange={(event) => {
                  setMpin(event.target.value.replace(/\D/g, "").slice(0, 6));
                  clearMessages();
                }}
                className="form-input"
                maxLength="6"
                autoComplete="current-password"
              />
            </div>
          ) : null}

          {otpSent || isFirebaseStep ? (
            <div className="form-group">
              <label htmlFor="otp">
                <span>One-Time Password</span>
                <span className="field-actions">
                  {renderFieldVoiceActions("otp", otp || "OTP", (value) => {
                    setOtp(value.replace(/\D/g, "").slice(0, 6));
                    clearMessages();
                  })}
                  <button
                    type="button"
                    className="resend-otp"
                    onClick={isFirebaseStep ? handleSendFirebasePhoneOTP : handleSendOtp}
                    disabled={loading}
                  >
                    Resend
                  </button>
                </span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                id="otp"
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(event) => {
                  setOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
                  clearMessages();
                }}
                className="form-input"
                maxLength="6"
                autoComplete="one-time-code"
              />
            </div>
          ) : null}

          {isUsernameStep ? (
            <div className="form-group">
              <label htmlFor="setupUsername">
                <span>Create your global username</span>
                {renderFieldVoiceActions("setupUsername", setupUsername || "Username", (value) => {
                  setSetupUsername(value);
                  setSetupUsernameError("");
                  clearMessages();
                })}
              </label>
              <input
                type="text"
                id="setupUsername"
                placeholder="Enter a unique username (3-20 characters)"
                value={setupUsername}
                onChange={async (event) => {
                  const value = event.target.value;
                  setSetupUsername(value);
                  clearMessages();
                  await checkSetupUsernameAvailability(value);
                }}
                className="form-input"
                autoComplete="username"
              />
              {setupUsernameStatus === "checking" ? (
                <div className="username-status checking">Checking availability...</div>
              ) : null}
              {setupUsernameStatus === "available" ? (
                <div className="username-status available">Username is available</div>
              ) : null}
              {setupUsernameStatus === "taken" ? (
                <div className="username-status taken">Username is taken</div>
              ) : null}
              {setupUsernameError ? (
                <div className="username-error">{setupUsernameError}</div>
              ) : null}
            </div>
          ) : null}

          {error ? <div className="error-message">{error}</div> : null}
          {success ? <div className="success-message">{success}</div> : null}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {isUsernameStep
                ? loading ? "Completing login..." : "Complete Login"
                : loginMethod === "mpin"
                  ? loading ? "Logging in..." : "Login with MPIN"
                  : isFirebaseStep
                    ? loading ? "Verifying..." : "Verify SMS OTP"
                    : otpSent
                      ? loading ? "Verifying..." : "Verify OTP"
                      : loginMethod === "firebase_phone"
                        ? loading ? "Sending OTP..." : "Send SMS OTP"
                        : loading
                          ? "Sending OTP..."
                          : "Send Login OTP"}
            </button>

            {isBackVisible ? (
              <button
                type="button"
                className="btn btn-outline"
                onClick={isUsernameStep ? resetUsernameSetup : (
                  isFirebaseStep ? resetFirebaseFlow : resetOtpFlow
                )}
                disabled={loading}
              >
                Back
              </button>
            ) : null}
          </div>
        </form>

        <div className="login-footer">
          <p className="security-info">
            {loginCopy.footer || "Your login is verified by a server-issued OTP."}
          </p>
          <PublicLegalNotice language={language} message={legalNoticeMessage} />
          {!otpSent && !isUsernameStep && !isFirebaseStep && onSignUpClick ? (
            <p className="signup-prompt">
              Don't have an account?{" "}
              <button
                type="button"
                className="signup-link"
                onClick={onSignUpClick}
                style={{
                  background: "none",
                  border: "none",
                  color: "#FF6B6B",
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: 0,
                  font: "inherit",
                }}
              >
                Sign Up
              </button>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Login;
