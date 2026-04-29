import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { getTranslation, getTranslationValue } from "../data/translations";
import useVoice from "../hooks/useVoice";
import { API_BASE_URL } from "../utils/api";
import PublicLegalNotice from "./PublicLegalNotice";
import {
  isFirebaseConfigured,
  createRecaptchaVerifier,
  sendFirebasePhoneOTP,
  signInWithGmail
} from "../config/firebase";
import "../styles/Login.css";
import "../styles/LoginFresh.css";

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
  const fetchAuthMethodsTimeoutRef = useRef(null);

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

  // Cleanup reCAPTCHA and debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (fetchAuthMethodsTimeoutRef.current) {
        clearTimeout(fetchAuthMethodsTimeoutRef.current);
      }
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

  const fetchAuthMethods = (value) => {
    if (fetchAuthMethodsTimeoutRef.current) {
      clearTimeout(fetchAuthMethodsTimeoutRef.current);
    }

    const trimmed = value.trim();
    if (!trimmed) {
      setAuthMethods(null);
      return;
    }

    fetchAuthMethodsTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/auth/auth-methods`, {
          params: { identifier: trimmed }
        });
        setAuthMethods(response.data);
      } catch {
        setAuthMethods(null);
      }
    }, 500);
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

  const handleGmailSignIn = async () => {
    clearMessages();
    setLoading(true);

    try {
      // Step 1: Sign in with Google using Firebase popup
      const gmailResult = await signInWithGmail();

      if (!gmailResult.success) {
        setError(gmailResult.error || "Failed to sign in with Gmail");
        return;
      }

      const { user: gmailUser, idToken } = gmailResult;

      // Step 2: Send to backend for verification and account creation/login
      const response = await axios.post(`${API_BASE_URL}/auth/google-signup`, {
        idToken,
        firebaseUid: gmailUser.uid,
        email: gmailUser.email,
        displayName: gmailUser.displayName,
        photoURL: gmailUser.photoURL,
        phone: null,
        ageVerification: {
          dateOfBirth: new Date(new Date().getFullYear() - 21, 0, 1).toISOString()
        }
      });

      if (!response.data?.success || !response.data?.token) {
        setError(response.data?.error || "Failed to sign in with Gmail");
        return;
      }

      // Store Gmail as preferred login method
      try {
        localStorage.setItem("linkup_preferred_login_method", "gmail");
      } catch {}

      setSuccess("Signed in with Gmail successfully!");
      
      completeLogin(
        response.data.user,
        response.data.token,
        gmailUser.email
      );
    } catch (gmailError) {
      console.error('Gmail sign-in error:', gmailError);
      if (!gmailError.response) {
        setError("Backend is not running. Please start the API server and try again.");
      } else {
        setError(
          gmailError.response.data?.error ||
            gmailError.response.data?.message ||
            "Failed to sign in with Gmail. Please try again."
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

  const handleFormSubmit = (event) => {
    if (isUsernameStep) {
      return handleSetUsername(event);
    }
    if (loginMethod === "mpin") {
      return handleLoginMpin(event);
    }
    if (loginMethod === "gmail") {
      return handleGmailSignIn();
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

  const getButtonText = () => {
    if (isUsernameStep) return loading ? "Completing..." : "Complete Login";
    if (loginMethod === "mpin") return loading ? "Logging in..." : "Login with MPIN";
    if (loginMethod === "gmail") return loading ? "Opening Google..." : "Sign in with Google";
    if (isFirebaseStep) return loading ? "Verifying..." : "Verify Phone OTP";
    if (otpSent) return loading ? "Verifying..." : "Verify OTP";
    if (loginMethod === "firebase_phone") return loading ? "Sending OTP..." : "Send Phone OTP";
    return loading ? "Sending OTP..." : "Send OTP";
  };

  const isBackVisible = otpSent || isFirebaseStep || isUsernameStep;

  return (
    <div className="login-fresh-container" dir={direction}>
      <div className="login-fresh-card">
        {/* Header */}
        <div className="login-fresh-header">
          <div className="login-fresh-header-top">
            <div></div>
            {!otpSent && !isUsernameStep && !isFirebaseStep && onBackToLaunch && (
              <button
                type="button"
                className="login-fresh-back-btn"
                onClick={onBackToLaunch}
                disabled={loading}
                title="Go back"
              >
                ←
              </button>
            )}
            <div></div>
          </div>
          <h1>🔐 LinkUp</h1>
          <p>Secure login with Phone OTP or Gmail</p>
        </div>

        {/* Method Tabs */}
        {!isUsernameStep && !otpSent && !isFirebaseStep && (
          <div className="login-fresh-methods">
            <button
              type="button"
              className={`login-fresh-method-tab ${loginMethod === "firebase_phone" ? "active" : ""}`}
              onClick={() => {
                setLoginMethod("firebase_phone");
                resetOtpFlow();
                resetMpinFlow();
              }}
              title="Login with Phone OTP via Firebase"
            >
              <span className="login-fresh-method-icon">📱</span>
              <span>Phone OTP</span>
            </button>
            <button
              type="button"
              className={`login-fresh-method-tab ${loginMethod === "gmail" ? "active" : ""}`}
              onClick={() => {
                setLoginMethod("gmail");
                resetOtpFlow();
                resetMpinFlow();
                resetFirebaseFlow();
              }}
              title="Sign in with Google"
            >
              <span className="login-fresh-method-icon">🔗</span>
              <span>Gmail</span>
            </button>
            <button
              type="button"
              className={`login-fresh-method-tab ${loginMethod === "mpin" ? "active" : ""}`}
              onClick={() => {
                setLoginMethod("mpin");
                resetOtpFlow();
                resetFirebaseFlow();
              }}
              title="Login with MPIN"
            >
              <span className="login-fresh-method-icon">🔑</span>
              <span>MPIN</span>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="login-fresh-content">
          <form className="login-fresh-form" onSubmit={handleFormSubmit}>
            {/* Phone OTP Flow */}
            {loginMethod === "firebase_phone" && !isFirebaseStep && !isUsernameStep && (
              <div>
                <div className="login-fresh-form-group">
                  <label className="login-fresh-section-title">📱 Phone Number</label>
                  <p className="login-fresh-section-desc">Enter your phone number to receive an OTP</p>
                </div>

                <div className="login-fresh-form-group">
                  <label className="login-fresh-form-label">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="e.g., +91 98765 43210"
                    value={identifier}
                    onChange={(event) => {
                      setIdentifier(event.target.value);
                      clearMessages();
                    }}
                    className="login-fresh-input"
                    autoComplete="tel"
                  />
                  <p className="login-fresh-help-text">Include country code (e.g., +91 for India)</p>
                </div>

                <div id="firebase-recaptcha-container" style={{ marginBottom: "1rem" }}></div>

                {error && <div className="login-fresh-message error">⚠️ {error}</div>}
                {success && <div className="login-fresh-message success">✓ {success}</div>}

                <button
                  type="submit"
                  className="login-fresh-btn login-fresh-btn-primary"
                  disabled={loading || !identifier}
                >
                  {loading && <span className="login-fresh-loading"></span>}
                  {getButtonText()}
                </button>
              </div>
            )}

            {/* Phone OTP Verification */}
            {isFirebaseStep && (
              <div>
                <div className="login-fresh-form-group">
                  <label className="login-fresh-section-title">✓ Verify OTP</label>
                  <p className="login-fresh-section-desc">Enter the 6-digit code sent to {identifier}</p>
                </div>

                <div className="login-fresh-form-group">
                  <label className="login-fresh-form-label">Enter OTP</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    value={otp}
                    onChange={(event) => {
                      setOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
                      clearMessages();
                    }}
                    maxLength="6"
                    className="login-fresh-input"
                    autoComplete="one-time-code"
                    style={{ textAlign: "center", fontSize: "1.5rem", letterSpacing: "0.5rem" }}
                  />
                </div>

                {error && <div className="login-fresh-message error">⚠️ {error}</div>}
                {success && <div className="login-fresh-message success">✓ {success}</div>}

                <button
                  type="submit"
                  className="login-fresh-btn login-fresh-btn-primary"
                  disabled={loading || otp.length !== 6}
                >
                  {loading && <span className="login-fresh-loading"></span>}
                  {getButtonText()}
                </button>

                <button
                  type="button"
                  className="login-fresh-btn login-fresh-btn-outline"
                  onClick={() => resetFirebaseFlow()}
                  disabled={loading}
                >
                  Back
                </button>
              </div>
            )}

            {/* Gmail Sign-In */}
            {loginMethod === "gmail" && !isUsernameStep && (
              <div>
                <div className="login-fresh-form-group">
                  <label className="login-fresh-section-title">🔗 Sign in with Google</label>
                  <p className="login-fresh-section-desc">Quick and secure login using your Gmail account</p>
                </div>

                {error && <div className="login-fresh-message error">⚠️ {error}</div>}
                {success && <div className="login-fresh-message success">✓ {success}</div>}

                <button
                  type="button"
                  className="login-fresh-social-btn"
                  onClick={handleGmailSignIn}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="login-fresh-loading"></span>
                      Opening Google...
                    </>
                  ) : (
                    <>
                      <span>🔐</span>
                      Sign in with Google
                    </>
                  )}
                </button>

                <p className="login-fresh-help-text" style={{ textAlign: "center", marginTop: "1rem" }}>
                  You'll be redirected to Google's secure login page
                </p>
              </div>
            )}

            {/* MPIN Login */}
            {loginMethod === "mpin" && !isUsernameStep && (
              <div>
                <div className="login-fresh-form-group">
                  <label className="login-fresh-section-title">🔑 MPIN Login</label>
                  <p className="login-fresh-section-desc">Enter your email/phone and MPIN to sign in</p>
                </div>

                <div className="login-fresh-form-group">
                  <label className="login-fresh-form-label">Email or Phone</label>
                  <input
                    type="text"
                    placeholder="your@email.com or +91 98765 43210"
                    value={identifier}
                    onChange={(event) => {
                      setIdentifier(event.target.value);
                      clearMessages();
                    }}
                    className="login-fresh-input"
                    autoComplete="username"
                  />
                </div>

                <div className="login-fresh-form-group">
                  <label className="login-fresh-form-label">MPIN (4-6 digits)</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="••••••"
                    value={mpin}
                    onChange={(event) => {
                      setMpin(event.target.value.replace(/\D/g, "").slice(0, 6));
                      clearMessages();
                    }}
                    maxLength="6"
                    className="login-fresh-input"
                    autoComplete="current-password"
                  />
                </div>

                {error && <div className="login-fresh-message error">⚠️ {error}</div>}
                {success && <div className="login-fresh-message success">✓ {success}</div>}

                <button
                  type="submit"
                  className="login-fresh-btn login-fresh-btn-primary"
                  disabled={loading || !identifier || !mpin}
                >
                  {loading && <span className="login-fresh-loading"></span>}
                  {getButtonText()}
                </button>
              </div>
            )}

            {/* Username Setup */}
            {isUsernameStep && (
              <div>
                <div className="login-fresh-form-group">
                  <label className="login-fresh-section-title">✓ Create Username</label>
                  <p className="login-fresh-section-desc">Set a unique username for your LinkUp account</p>
                </div>

                <div className="login-fresh-form-group">
                  <label className="login-fresh-form-label">Global Username</label>
                  <input
                    type="text"
                    placeholder="e.g., john_doe_24"
                    value={setupUsername}
                    onChange={async (event) => {
                      const value = event.target.value;
                      setSetupUsername(value);
                      clearMessages();
                      await checkSetupUsernameAvailability(value);
                    }}
                    className="login-fresh-input"
                    autoComplete="username"
                  />
                  <p className="login-fresh-help-text">3-20 characters: letters, numbers, _ and -</p>

                  {setupUsernameStatus === "checking" && (
                    <div className="login-fresh-message info">⏳ Checking availability...</div>
                  )}
                  {setupUsernameStatus === "available" && (
                    <div className="login-fresh-message success">✓ Username is available!</div>
                  )}
                  {setupUsernameError && (
                    <div className="login-fresh-message error">⚠️ {setupUsernameError}</div>
                  )}
                </div>

                {error && <div className="login-fresh-message error">⚠️ {error}</div>}
                {success && <div className="login-fresh-message success">✓ {success}</div>}

                <button
                  type="submit"
                  className="login-fresh-btn login-fresh-btn-primary"
                  disabled={loading || setupUsernameStatus !== "available"}
                >
                  {loading && <span className="login-fresh-loading"></span>}
                  {getButtonText()}
                </button>

                <button
                  type="button"
                  className="login-fresh-btn login-fresh-btn-outline"
                  onClick={resetUsernameSetup}
                  disabled={loading}
                >
                  Back
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="login-fresh-bottom">
          <p className="login-fresh-bottom-text">
            Don't have an account?{" "}
            {onSignUpClick ? (
              <button
                type="button"
                className="login-fresh-bottom-text"
                onClick={onSignUpClick}
                style={{
                  background: "none",
                  border: "none",
                  color: "#d946a6",
                  cursor: "pointer",
                  textDecoration: "none",
                  padding: 0,
                  font: "inherit",
                }}
              >
                Sign Up Free
              </button>
            ) : (
              "Sign Up Free"
            )}
          </p>
          <PublicLegalNotice language={language} message={legalNoticeMessage} />
        </div>
      </div>
    </div>
  );
};

export default Login;
