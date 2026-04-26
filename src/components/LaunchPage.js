import React, { useState, useEffect } from "react";
import { getTranslation, languageOptions } from "../data/translations";
import { getStoredUserData } from "../utils/auth";
import "../styles/LaunchPage.css";

const moduleFallbacks = {
  localmarket: {
    title: "Local Market",
    description: "Discover local vendors, fresh produce, handmade goods, and neighborhood services.",
  },
  astrology: {
    title: "AstroNila",
    description: "Daily horoscope, Vedic insights, and personalized astrology readings for all zodiac signs.",
  },
};

const openExternalLink = (url) => {
  window.open(url, "_blank", "noopener,noreferrer");
};

const LaunchPage = ({
  language,
  onLanguageChange,
  onSelectRegistrationType,
  enabledModules,
  customLinks = [],
  isAuthenticated = false,
  onLogout = null,
  userName = null,
}) => {
  const { launch, direction } = getTranslation(language);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [displayName, setDisplayName] = useState(userName);

  // Fetch user data from storage if not provided
  useEffect(() => {
    if (!displayName && isAuthenticated) {
      const userData = getStoredUserData();
      if (userData) {
        setDisplayName(userData.firstName || userData.username || userData.email || "User");
      }
    }
  }, [isAuthenticated, displayName]);

  const moduleMapping = {
    GlobeMart: "ecommerce",
    LinkUp: "messaging",
    TradePost: "classifieds",
    HomeSphere: "realestate",
    Feastly: "fooddelivery",
    "Local Market": "localmarket",
    SwiftRide: "ridesharing",
    SoulMatch: "matrimonial",
    VibeHub: "socialmedia",
    "ReminderAlert - Todo List": "reminderalert",
    "SOS Safety Center": "sosalert",
    "AstroNila": "astrology",
  };

  const filteredFeatures = launch.features.filter(([name]) => enabledModules.includes(moduleMapping[name]));
  const visibleModuleIds = new Set(
    filteredFeatures.map(([name]) => moduleMapping[name]).filter(Boolean)
  );
  const missingEnabledFeatures = Object.entries(moduleFallbacks)
    .filter(([moduleId]) => enabledModules.includes(moduleId) && !visibleModuleIds.has(moduleId))
    .map(([moduleId, feature]) => ({
      key: moduleId,
      title: feature.title,
      description: feature.description,
      type: "module",
      moduleId,
    }));
  const featureCards = [
    ...filteredFeatures.map(([title, description]) => ({
      key: title,
      title,
      description,
      type: "module",
      moduleId: moduleMapping[title],
    })),
    ...missingEnabledFeatures,
    ...customLinks.map((link) => ({
      key: link.id,
      title: link.title,
      description: link.description || link.url,
      type: "external",
      url: link.url,
    })),
  ];

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <main className="launch-page" dir={direction}>
      {/* Header with Auth Status and Logout */}
      {isAuthenticated && (
        <header className="launch-header">
          <div className="header-content">
            <div className="header-left">
              <img src="/logo.svg" alt="LinkUp" className="header-logo" />
              <span className="header-title">LinkUp Dating</span>
            </div>
            <div className="header-right">
              {displayName && <span className="user-greeting">Welcome, {displayName}! 👋</span>}
              <button
                className="logout-button"
                onClick={() => setShowLogoutConfirm(true)}
                title="Sign out from your account"
                aria-label="Logout"
              >
                <span>🚪</span> Sign Out
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="logout-modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="logout-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Sign Out?</h3>
            <p>Are you sure you want to sign out of your LinkUp account?</p>
            <div className="logout-modal-actions">
              <button
                className="btn-cancel"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="btn-logout-confirm"
                onClick={handleLogout}
              >
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="launch-hero">
        <div className="kerala-hero-art" aria-hidden="true" />
        <div className="launch-hero-content">
          <div className="language-control">
            <label htmlFor="language-select">{launch.languageLabel}</label>
            <select
              id="language-select"
              value={language}
              onChange={(event) => onLanguageChange(event.target.value)}
            >
              {languageOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
          {!isAuthenticated && <img src="/logo.svg" alt="LinkUp" className="launch-logo" />}
          {!isAuthenticated && <p className="launch-eyebrow">{launch.brand}</p>}
          <h1>{isAuthenticated ? "Welcome to LinkUp Dating" : launch.title}</h1>
          <p className="launch-intro">
            {isAuthenticated 
              ? "Find meaningful connections in your area" 
              : launch.intro}
          </p>

          {!isAuthenticated && (
            <div className="registration-actions" aria-label="Registration options">
              <button
                type="button"
                className="registration-option login-option"
                onClick={() => onSelectRegistrationType("login")}
              >
                <span>{launch.login || "Sign In"}</span>
                <small>{launch.loginHelp || "Already have an account?"}</small>
              </button>
              <button
                type="button"
                className="registration-option primary-option"
                onClick={() => onSelectRegistrationType("user")}
              >
                <span>{launch.user || "Sign Up"}</span>
                <small>{launch.userHelp || "Create a new dating profile"}</small>
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="launch-features" aria-labelledby="features-heading">
        <div className="launch-section-heading">
          <p>{launch.featuresLabel}</p>
          <h2 id="features-heading">{launch.featuresTitle}</h2>
        </div>

        <div className="feature-grid">
          {featureCards.map((feature) => (
            <button
              type="button"
              className="feature-card"
              key={feature.key}
              onClick={() =>
                feature.type === "external"
                  ? openExternalLink(feature.url)
                  : onSelectRegistrationType("login", feature.moduleId || moduleMapping[feature.title])
              }
            >
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              {feature.type === "external" ? (
                <span className="feature-card-link-badge">Open link</span>
              ) : null}
            </button>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="launch-footer">
        <div className="footer-content">
          <div className="footer-section">
            <h4>LinkUp Dating</h4>
            <p>Connect with singles in your area. Discover meaningful relationships.</p>
          </div>
          <div className="footer-section">
            <h4>Quick Links</h4>
            <ul>
              <li><a href="#about">About Us</a></li>
              <li><a href="#safety">Safety Tips</a></li>
              <li><a href="#privacy">Privacy Policy</a></li>
              <li><a href="#contact">Contact</a></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Follow Us</h4>
            <div className="social-links">
              <a href="#facebook" title="Facebook">f</a>
              <a href="#twitter" title="Twitter">𝕏</a>
              <a href="#instagram" title="Instagram">📷</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 LinkUp Dating. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
};

export default LaunchPage;
