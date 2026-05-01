import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { getTranslation, getTranslationValue } from "../data/translations";
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
const DEFAULT_LOGIN_METHOD = "firebase_phone";
const SIMPLE_LOGIN_METHODS = new Set([DEFAULT_LOGIN_METHOD, "gmail", "mpin"]);

const getInitialLoginMethod = () => {
  if (typeof window === "undefined") {
    return DEFAULT_LOGIN_METHOD;
  }

  try {
    const savedMethod = window.localStorage.getItem("linkup_preferred_login_method");
    return SIMPLE_LOGIN_METHODS.has(savedMethod) ? savedMethod : DEFAULT_LOGIN_METHOD;
  } catch {
    return DEFAULT_LOGIN_METHOD;
  }
};

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [needsUsernameSetup, setNeedsUsernameSetup] = useState(false);
  const [setupUsername, setSetupUsername] = useState("");
  const [setupUsernameStatus, setSetupUsernameStatus] = useState(null);
  const [setupUsernameError, setSetupUsernameError] = useState("");
  const [verifiedUser, setVerifiedUser] = useState(null);
  const [verifiedToken, setVerifiedToken] = useState(null);
  const [loginMethod, setLoginMethod] = useState(getInitialLoginMethod);
  const [mpin, setMpin] = useState("");

  // Firebase Phone Auth state
  const [firebaseOtpSent, setFirebaseOtpSent] = useState(false);
  const [firebaseConfirmationResult, setFirebaseConfirmationResult] = useState(null);
  const recaptchaVerifierRef = useRef(null);

  const { direction } = getTranslation(language);
  const legalNoticeMessage = getTranslationValue(language, "public.loginNotice");

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const validateUsername = (value) => /^[a-zA-Z0-9_-]{3,20}$/.test(value);
  const looksLikePhoneNumber = (value) => /^\+?[0-9\s()-]{7,}$/.test(String(value || "").trim());
  const formatPhoneNumberForLogin = (value) => {
    const trimmedValue = String(value || "").trim();
    const digitsOnly = trimmedValue.replace(/\D/g, "");

    if (!digitsOnly) {
      return "";
    }

    if (trimmedValue.startsWith("+")) {
      return `+${digitsOnly}`;
    }

    if (digitsOnly.length === 10) {
      return `+91${digitsOnly}`;
    }

    if (digitsOnly.length > 10 && digitsOnly.length <= 15) {
      return `+${digitsOnly}`;
    }

    return "";
  };
  const trimmedIdentifier = identifier.trim();
  const normalizedEmail = validateEmail(trimmedIdentifier) ? trimmedIdentifier.toLowerCase() : "";
  const normalizedPhone =
    !normalizedEmail && looksLikePhoneNumber(trimmedIdentifier) ? formatPhoneNumberForLogin(trimmedIdentifier) : "";

  const resetOtpFlow = () => {
    setOtp("");
    setOtpId("");
    setOtpSent(false);
    clearMessages();
  };

  const resetMpinFlow = () => {
    setMpin("");
    clearMessages();
  };

  const resetFirebaseFlow = () => {
    setFirebaseOtpSent(false);
    setFirebaseConfirmationResult(null);
    setOtp("");
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
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, []);

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
        channel: "email",
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
        phone: null
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
      event.preventDefault();
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
    if (isUsernameStep) return loading ? "Finishing..." : "Finish Login";
    if (loginMethod === "mpin") return loading ? "Checking..." : "Login with MPIN";
    if (loginMethod === "gmail") return loading ? "Opening Google..." : "Continue with Google";
    if (isFirebaseStep) return loading ? "Checking code..." : "Continue";
    if (otpSent) return loading ? "Checking code..." : "Continue";
    if (loginMethod === "firebase_phone") return loading ? "Sending code..." : "Send SMS Code";
    return loading ? "Sending code..." : "Send Code";
  };

  const showHomeButton = !otpSent && !isUsernameStep && !isFirebaseStep && onBackToLaunch;
  const showMethodChoices = !isUsernameStep && !otpSent && !isFirebaseStep;

  return (
    <div className="login-fresh-container login-simple-container" dir={direction}>
      <div className="login-fresh-card login-simple-card">
        <div className="login-simple-topbar">
          {showHomeButton ? (
            <button
              type="button"
              className="login-simple-back-btn"
              onClick={onBackToLaunch}
              disabled={loading}
            >
              Back
            </button>
          ) : (
            <span aria-hidden="true" />
          )}
        </div>

        <header className="login-fresh-header login-simple-header">
          <img src="/logo.svg" alt="LinkUp" className="login-simple-logo" />
          <p className="login-simple-kicker">Welcome to LinkUp</p>
          <h1>Login</h1>
          <p>Use your mobile number. We will send a 6 digit SMS code.</p>
        </header>

        {showMethodChoices && (
          <div className="login-fresh-methods login-simple-methods" role="group" aria-label="Choose login method">
            <button
              type="button"
              className={`login-fresh-method-tab ${loginMethod === "firebase_phone" ? "active" : ""}`}
              aria-pressed={loginMethod === "firebase_phone"}
              onClick={() => {
                setLoginMethod("firebase_phone");
                resetOtpFlow();
                resetMpinFlow();
              }}
            >
              <span>Mobile OTP</span>
              <small>Recommended</small>
            </button>
            <button
              type="button"
              className={`login-fresh-method-tab ${loginMethod === "gmail" ? "active" : ""}`}
              aria-pressed={loginMethod === "gmail"}
              onClick={() => {
                setLoginMethod("gmail");
                resetOtpFlow();
                resetMpinFlow();
                resetFirebaseFlow();
              }}
            >
              <span>Google</span>
              <small>One tap</small>
            </button>
            <button
              type="button"
              className={`login-fresh-method-tab ${loginMethod === "mpin" ? "active" : ""}`}
              aria-pressed={loginMethod === "mpin"}
              onClick={() => {
                setLoginMethod("mpin");
                resetOtpFlow();
                resetFirebaseFlow();
              }}
            >
              <span>MPIN</span>
              <small>4 to 6 digits</small>
            </button>
          </div>
        )}

        <div className="login-fresh-content">
          <form className="login-fresh-form login-simple-form" onSubmit={handleFormSubmit}>
            {loginMethod === "firebase_phone" && !isFirebaseStep && !isUsernameStep && (
              <section className="login-simple-panel" aria-labelledby="phone-login-title">
                <div className="login-simple-steps" aria-label="Login progress">
                  <span className="active">1 Mobile</span>
                  <span>2 Code</span>
                  <span>3 Done</span>
                </div>

                <div className="login-fresh-form-group">
                  <h2 id="phone-login-title" className="login-fresh-section-title">Enter mobile number</h2>
                  <p className="login-fresh-section-desc">No password needed.</p>
                </div>

                <div className="login-fresh-form-group">
                  <label className="login-fresh-form-label" htmlFor="login-phone">Mobile number</label>
                  <input
                    id="login-phone"
                    type="tel"
                    placeholder="98765 43210"
                    value={identifier}
                    onChange={(event) => {
                      setIdentifier(event.target.value);
                      clearMessages();
                    }}
                    className="login-fresh-input"
                    autoComplete="tel"
                    aria-describedby="login-phone-help"
                    autoFocus
                  />
                  <p id="login-phone-help" className="login-fresh-help-text">
                    Type 10 digits. If outside India, start with + and country code.
                  </p>
                </div>

                <div id="firebase-recaptcha-container" className="login-simple-recaptcha"></div>

                {error && <div className="login-fresh-message error" role="alert">{error}</div>}
                {success && <div className="login-fresh-message success" role="status">{success}</div>}

                <button
                  type="submit"
                  className="login-fresh-btn login-fresh-btn-primary"
                  disabled={loading || !identifier}
                >
                  {loading && <span className="login-fresh-loading"></span>}
                  {getButtonText()}
                </button>
              </section>
            )}

            {isFirebaseStep && (
              <section className="login-simple-panel" aria-labelledby="otp-login-title">
                <div className="login-simple-steps" aria-label="Login progress">
                  <span>1 Mobile</span>
                  <span className="active">2 Code</span>
                  <span>3 Done</span>
                </div>

                <div className="login-fresh-form-group">
                  <h2 id="otp-login-title" className="login-fresh-section-title">Enter SMS code</h2>
                  <p className="login-fresh-section-desc">The code was sent to {identifier}.</p>
                </div>

                <div className="login-fresh-form-group">
                  <label className="login-fresh-form-label" htmlFor="login-otp">6 digit code</label>
                  <input
                    id="login-otp"
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    value={otp}
                    onChange={(event) => {
                      setOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
                      clearMessages();
                    }}
                    maxLength="6"
                    className="login-fresh-input login-simple-otp-input"
                    autoComplete="one-time-code"
                    autoFocus
                  />
                </div>

                {error && <div className="login-fresh-message error" role="alert">{error}</div>}
                {success && <div className="login-fresh-message success" role="status">{success}</div>}

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
                  Change mobile number
                </button>
              </section>
            )}

            {loginMethod === "gmail" && !isUsernameStep && (
              <section className="login-simple-panel" aria-labelledby="google-login-title">
                <div className="login-fresh-form-group">
                  <h2 id="google-login-title" className="login-fresh-section-title">Use Google</h2>
                  <p className="login-fresh-section-desc">Choose your Google account in the next window.</p>
                </div>

                {error && <div className="login-fresh-message error" role="alert">{error}</div>}
                {success && <div className="login-fresh-message success" role="status">{success}</div>}

                <button
                  type="button"
                  className="login-fresh-btn login-fresh-btn-primary"
                  onClick={handleGmailSignIn}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="login-fresh-loading"></span>
                      Opening Google...
                    </>
                  ) : (
                    "Continue with Google"
                  )}
                </button>

                <button
                  type="button"
                  className="login-simple-text-button"
                  onClick={() => {
                    setLoginMethod(DEFAULT_LOGIN_METHOD);
                    resetFirebaseFlow();
                  }}
                  disabled={loading}
                >
                  Use mobile OTP instead
                </button>
              </section>
            )}

            {loginMethod === "mpin" && !isUsernameStep && (
              <section className="login-simple-panel" aria-labelledby="mpin-login-title">
                <div className="login-fresh-form-group">
                  <h2 id="mpin-login-title" className="login-fresh-section-title">Use MPIN</h2>
                  <p className="login-fresh-section-desc">Enter the mobile number or email linked to your account.</p>
                </div>

                <div className="login-fresh-form-group">
                  <label className="login-fresh-form-label" htmlFor="login-identifier">Mobile number or email</label>
                  <input
                    id="login-identifier"
                    type="text"
                    placeholder="98765 43210"
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
                  <label className="login-fresh-form-label" htmlFor="login-mpin">MPIN</label>
                  <input
                    id="login-mpin"
                    type="password"
                    inputMode="numeric"
                    placeholder="4 to 6 digits"
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

                {error && <div className="login-fresh-message error" role="alert">{error}</div>}
                {success && <div className="login-fresh-message success" role="status">{success}</div>}

                <button
                  type="submit"
                  className="login-fresh-btn login-fresh-btn-primary"
                  disabled={loading || !identifier || !mpin}
                >
                  {loading && <span className="login-fresh-loading"></span>}
                  {getButtonText()}
                </button>

                <button
                  type="button"
                  className="login-simple-text-button"
                  onClick={() => {
                    setLoginMethod(DEFAULT_LOGIN_METHOD);
                    resetMpinFlow();
                  }}
                  disabled={loading}
                >
                  Use mobile OTP instead
                </button>
              </section>
            )}

            {isUsernameStep && (
              <section className="login-simple-panel" aria-labelledby="username-login-title">
                <div className="login-simple-steps" aria-label="Login progress">
                  <span>1 Mobile</span>
                  <span>2 Code</span>
                  <span className="active">3 Done</span>
                </div>

                <div className="login-fresh-form-group">
                  <h2 id="username-login-title" className="login-fresh-section-title">Choose a username</h2>
                  <p className="login-fresh-section-desc">This is shown on your LinkUp profile.</p>
                </div>

                <div className="login-fresh-form-group">
                  <label className="login-fresh-form-label" htmlFor="setup-username">Username</label>
                  <input
                    id="setup-username"
                    type="text"
                    placeholder="john_doe_24"
                    value={setupUsername}
                    onChange={async (event) => {
                      const value = event.target.value;
                      setSetupUsername(value);
                      clearMessages();
                      await checkSetupUsernameAvailability(value);
                    }}
                    className="login-fresh-input"
                    autoComplete="username"
                    autoFocus
                  />
                  <p className="login-fresh-help-text">3-20 characters: letters, numbers, _ and -</p>

                  {setupUsernameStatus === "checking" && (
                    <div className="login-fresh-message info" role="status">Checking availability...</div>
                  )}
                  {setupUsernameStatus === "available" && (
                    <div className="login-fresh-message success" role="status">Username is available.</div>
                  )}
                  {setupUsernameError && (
                    <div className="login-fresh-message error" role="alert">{setupUsernameError}</div>
                  )}
                </div>

                {error && <div className="login-fresh-message error" role="alert">{error}</div>}
                {success && <div className="login-fresh-message success" role="status">{success}</div>}

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
              </section>
            )}
          </form>
        </div>

        <footer className="login-fresh-bottom login-simple-bottom">
          <p className="login-fresh-bottom-text">
            New to LinkUp?{" "}
            {onSignUpClick ? (
              <button
                type="button"
                className="login-simple-link-button"
                onClick={onSignUpClick}
              >
                Create account
              </button>
            ) : (
              "Create account"
            )}
          </p>
          <PublicLegalNotice language={language} message={legalNoticeMessage} />
        </footer>
      </div>
    </div>
  );
};

export default Login;
