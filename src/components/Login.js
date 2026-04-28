import React, { useState } from "react";
import axios from "axios";
import { getTranslation } from "../data/translations";
import useVoice from "../hooks/useVoice";
import { API_BASE_URL } from "../utils/api";
import PublicLegalNotice from "./PublicLegalNotice";
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
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpId, setOtpId] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [needsUsernameSetup, setNeedsUsernameSetup] = useState(false);
  const [setupUsername, setSetupUsername] = useState("");
  const [setupUsernameStatus, setSetupUsernameStatus] = useState(null);
  const [setupUsernameError, setSetupUsernameError] = useState("");
  const [verifiedUser, setVerifiedUser] = useState(null);
  const [verifiedToken, setVerifiedToken] = useState(null);

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
  const normalizedEmail = email.trim().toLowerCase();

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const validateUsername = (value) => /^[a-zA-Z0-9_-]{3,20}$/.test(value);

  const resetOtpFlow = () => {
    setOtp("");
    setOtpId("");
    setOtpSent(false);
    setDevOtp("");
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
  };

  const handleVoiceFill = (fieldKey, updateValue) => {
    if (listeningKey === fieldKey) {
      stopListening();
      return;
    }

    startListening(fieldKey, updateValue);
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
    setDevOtp("");

    if (!normalizedEmail) {
      setError("Please enter your email address");
      return;
    }

    if (!validateEmail(normalizedEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/send-otp`, {
        email: normalizedEmail,
        purpose: "login",
      });

      if (!response.data?.success) {
        setError(response.data?.message || response.data?.error || "Failed to send OTP");
        return;
      }

      setOtpId(response.data.otpId || "");
      setOtpSent(true);
      setSuccess(response.data.message || "OTP sent to your email");
      setDevOtp(response.data.devOtp || response.data.otp || "");
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
        email: normalizedEmail,
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

      completeLogin(response.data.user, response.data.token, normalizedEmail);
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
        normalizedEmail
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

  const isUsernameStep = needsUsernameSetup;
  const formTitle = isUsernameStep ? "Create your username" : "Verify your email";
  const formDescription = isUsernameStep
    ? "Set a unique username before you continue to your LinkUp account."
    : "Enter your email and confirm the one-time password to continue.";

  return (
    <div className="login-container" dir={direction}>
      <div className="login-card">
        {!otpSent && !isUsernameStep && onBackToLaunch ? (
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
            {loginCopy.loginSubtitle || "Verify your email to log in to LinkUp."}
          </p>
        </div>

        <form
          className="login-form"
          onSubmit={isUsernameStep ? handleSetUsername : otpSent ? handleVerifyOtp : handleSendOtp}
        >
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

          {!otpSent && !isUsernameStep ? (
            <div className="form-group">
              <label htmlFor="email">
                <span>Email Address</span>
                {renderFieldVoiceActions("email", normalizedEmail || "Email Address", (value) => {
                  setEmail(value);
                  clearMessages();
                })}
              </label>
              <input
                type="email"
                id="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  clearMessages();
                }}
                className="form-input"
                autoComplete="email"
              />
            </div>
          ) : null}

          {otpSent ? (
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
                    onClick={handleSendOtp}
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
          {devOtp ? (
            <div className="dev-otp-message">
              <span>Development OTP</span>
              <strong>{devOtp}</strong>
            </div>
          ) : null}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {isUsernameStep
                ? loading ? "Completing login..." : "Complete Login"
                : otpSent
                  ? loading ? "Verifying..." : "Verify OTP"
                  : loading
                    ? "Sending OTP..."
                    : "Send Login OTP"}
            </button>

            {otpSent || isUsernameStep ? (
              <button
                type="button"
                className="btn btn-outline"
                onClick={isUsernameStep ? resetUsernameSetup : resetOtpFlow}
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
          <PublicLegalNotice message="By continuing, you agree to the Terms and acknowledge the Privacy Policy. Support and grievance channels are public, and optional ID, location, camera, and microphone features are covered there." />
          {!otpSent && !isUsernameStep && onSignUpClick ? (
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
