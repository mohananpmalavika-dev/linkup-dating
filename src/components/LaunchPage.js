import React, { useEffect, useState } from "react";
import { getTranslation, languageOptions } from "../data/translations";
import { getStoredUserData } from "../utils/auth";
import "../styles/LaunchPage.css";

const launchSignals = [
  "Profiles with prompts",
  "Intent-based dating",
  "Verified community",
  "Voice notes and video",
];

const datingFeatureCards = [
  {
    key: "profiles",
    title: "Profiles That Feel Human",
    description:
      "Photos, bio, age, location, interests, preferences, and optional prompts that make people feel real.",
    badge: "MVP",
    moduleId: "dating",
  },
  {
    key: "matching",
    title: "Matching That Feels Familiar",
    description:
      "Swipe-based discovery or compatibility-led suggestions with filters for age, distance, and shared interests.",
    badge: "MVP",
    moduleId: "dating",
  },
  {
    key: "messaging",
    title: "Messaging After the Match",
    description:
      "Private chat with read receipts, typing indicators, media sharing, and voice notes once both people opt in.",
    badge: "MVP",
    moduleId: "dating",
  },
  {
    key: "discovery",
    title: "A Discovery Feed Worth Refreshing",
    description:
      "Curated profile stacks, algorithmic suggestions, and a smoother path from browse to meaningful connection.",
    badge: "MVP",
    moduleId: "dating",
  },
  {
    key: "verification",
    title: "Verification From the Start",
    description:
      "Phone or email checks, photo verification, reporting, and blocking reduce fake accounts before they spread.",
    badge: "Trust",
    moduleId: "dating",
  },
  {
    key: "moderation",
    title: "AI Moderation and Safety",
    description:
      "Detect harassment, spam, and scams early while giving people strong privacy controls over visibility and messages.",
    badge: "Trust",
    moduleId: "dating",
  },
];

const productBlueprint = [
  {
    eyebrow: "Core",
    title: "Profiles, matching, and chat",
    description:
      "These are table stakes. If the profile quality, match logic, or chat flow feels weak, retention will fall fast.",
  },
  {
    eyebrow: "Safety",
    title: "Trust is part of the product",
    description:
      "Verification, moderation, reporting, blocking, and privacy controls are not extras anymore. They shape whether people stay.",
  },
  {
    eyebrow: "Engagement",
    title: "Daily reasons to come back",
    description:
      "Curated suggestions, icebreakers, stories, and visibility tools create a rhythm that keeps the app from feeling empty.",
  },
  {
    eyebrow: "Differentiation",
    title: "Stand out with intent",
    description:
      "Intent-based dating, compatibility scores, event matching, and AI-assisted pairing give LinkUp a clearer identity than swipes alone.",
  },
];

const roadmapColumns = [
  {
    phase: "Launch Now",
    title: "Small, credible MVP",
    items: [
      "Profiles with photos, bio, interests, preferences, and prompts.",
      "Matching with age, distance, and interest filters.",
      "One-to-one chat with receipts, typing, and media sharing.",
      "Verification, reporting, blocking, and moderation basics.",
      "One standout twist: intent mode for casual, serious, or marriage-focused dating.",
    ],
  },
  {
    phase: "Next Up",
    title: "Retention and revenue",
    items: [
      "Daily curated suggestions that reward thoughtful choices.",
      "Super likes, boosts, and premium visibility tools.",
      "Stories, short videos, and richer self-expression.",
      "Icebreakers, quizzes, and AI help for better openers.",
      "Premium filters and see-who-liked-you features.",
    ],
  },
  {
    phase: "India First",
    title: "Localized fit",
    items: [
      "Language support for Malayalam, Hindi, and more.",
      "Serious relationship and family-minded filters.",
      "Carefully designed culture-specific preferences where appropriate.",
      "Optional horoscope matching for users who want it.",
      "A respectful path for intent-led matchmaking, not just casual browsing.",
    ],
  },
];

const trustHighlights = [
  {
    id: "safety",
    title: "Verification",
    description:
      "Phone or email verification plus selfie-based photo checks help reduce fake profiles before they enter the ecosystem.",
  },
  {
    id: "privacy",
    title: "Privacy Controls",
    description:
      "Let people hide their profile, soften location visibility, and decide who can contact them or see their activity.",
  },
  {
    id: "moderation",
    title: "Moderation",
    description:
      "A clear report and block flow, backed by AI review for harassment, spam, and scams, should be part of the first release.",
  },
];

const realityChecks = [
  "Too many fake users early on will damage trust faster than any missing premium feature.",
  "Poor matching quality and weak onboarding will hurt retention more than a small feature set.",
  "Gender balance, profile quality, and safety perception matter as much as the code you ship.",
  "The strongest first release is profiles, matching, chat, verification, and one memorable twist.",
];

const heroChecklist = [
  "Profiles with photos, prompts, and preferences",
  "Matching that supports both swiping and compatibility",
  "Chat, voice notes, and video-ready connection",
  "Intent-led dating for casual, serious, or marriage goals",
];

const openExternalLink = (url) => {
  window.open(url, "_blank", "noopener,noreferrer");
};

const LaunchPage = ({
  language,
  onLanguageChange,
  onSelectRegistrationType,
  enabledModules = [],
  customLinks = [],
  isAuthenticated = false,
  onLogout = null,
  userName = null,
}) => {
  const { launch, direction } = getTranslation(language);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [displayName, setDisplayName] = useState(userName);

  useEffect(() => {
    setDisplayName(userName);
  }, [userName]);

  useEffect(() => {
    if (!displayName && isAuthenticated) {
      const userData = getStoredUserData();
      if (userData) {
        setDisplayName(userData.firstName || userData.username || userData.email || "User");
      }
    }
  }, [displayName, isAuthenticated]);

  const datingEnabled = enabledModules.length === 0 || enabledModules.includes("dating");
  const featureCards = [
    ...(datingEnabled ? datingFeatureCards : []),
    ...customLinks.map((link) => ({
      key: link.id,
      title: link.title,
      description: link.description || link.url,
      type: "external",
      url: link.url,
      badge: "Link",
    })),
  ];

  const handleFeatureCardClick = (feature) => {
    if (feature.type === "external") {
      openExternalLink(feature.url);
      return;
    }

    onSelectRegistrationType(isAuthenticated ? "login" : "user", feature.moduleId);
  };

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <main className="launch-page" dir={direction}>
      {isAuthenticated && (
        <header className="launch-header">
          <div className="header-content">
            <div className="header-left">
              <img src="/logo.svg" alt="LinkUp" className="header-logo" />
              <span className="header-title">LinkUp Dating</span>
            </div>
            <div className="header-right">
              {displayName && <span className="user-greeting">Welcome back, {displayName}</span>}
              <button
                className="logout-button"
                onClick={() => setShowLogoutConfirm(true)}
                title="Sign out from your account"
                aria-label="Logout"
              >
                <span className="logout-button-mark" aria-hidden="true">
                  x
                </span>
                Sign Out
              </button>
            </div>
          </div>
        </header>
      )}

      {showLogoutConfirm && (
        <div className="logout-modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="logout-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Sign Out?</h3>
            <p>Are you sure you want to sign out of your LinkUp account?</p>
            <div className="logout-modal-actions">
              <button className="btn-cancel" onClick={() => setShowLogoutConfirm(false)}>
                Cancel
              </button>
              <button className="btn-logout-confirm" onClick={handleLogout}>
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="launch-hero">
        <div className="dating-hero-art" aria-hidden="true" />
        <div className="launch-hero-content">
          <div className="launch-hero-copy">
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
                ? "Find meaningful connections, safer conversations, and better matches in your area."
                : launch.intro}
            </p>

            <div className="launch-signal-row" aria-label="Key strengths">
              {launchSignals.map((signal) => (
                <span className="launch-signal" key={signal}>
                  {signal}
                </span>
              ))}
            </div>

            {!isAuthenticated && (
              <div className="registration-actions" aria-label="Registration options">
                <button
                  type="button"
                  className="registration-option primary-option"
                  onClick={() => onSelectRegistrationType("user")}
                >
                  <span>{launch.user || "Get Started"}</span>
                  <small>{launch.userHelp || "Join LinkUp and find your match"}</small>
                </button>

                <button
                  type="button"
                  className="registration-option secondary-option"
                  onClick={() => onSelectRegistrationType("login")}
                >
                  <span>{launch.login || "Login"}</span>
                  <small>{launch.loginHelp || "Access your existing account"}</small>
                </button>
              </div>
            )}
          </div>

          <aside className="launch-hero-preview" aria-labelledby="launch-preview-heading">
            <p className="launch-preview-tag">MVP Focus</p>
            <h2 id="launch-preview-heading">Ship trust before scale.</h2>
            <p className="launch-preview-copy">
              The strongest first version is not every feature on your wish list. It is a product
              loop that feels safe, familiar, and worth returning to.
            </p>
            <ul className="launch-preview-list">
              {heroChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      {featureCards.length > 0 && (
        <section className="launch-panel launch-features" aria-labelledby="features-heading">
          <div className="launch-section-heading">
            <p>{launch.featuresLabel}</p>
            <h2 id="features-heading">What users expect from day one</h2>
          </div>

          <div className="feature-grid">
            {featureCards.map((feature) => (
              <button
                type="button"
                className="feature-card"
                key={feature.key}
                onClick={() => handleFeatureCardClick(feature)}
              >
                <div className="feature-card-top">
                  <span className="feature-card-badge">{feature.badge || "Included"}</span>
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                {feature.type === "external" ? (
                  <span className="feature-card-link-badge">Open link</span>
                ) : (
                  <span className="feature-card-link-badge">Start here</span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="launch-panel launch-blueprint" id="about" aria-labelledby="blueprint-heading">
        <div className="launch-section-heading">
          <p>Product Blueprint</p>
          <h2 id="blueprint-heading">Table stakes first, differentiation second</h2>
        </div>

        <div className="blueprint-grid">
          {productBlueprint.map((card) => (
            <article className="blueprint-card" key={card.title}>
              <p className="blueprint-eyebrow">{card.eyebrow}</p>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="launch-panel launch-roadmap" aria-labelledby="roadmap-heading">
        <div className="launch-section-heading">
          <p>Roadmap</p>
          <h2 id="roadmap-heading">A practical path from MVP to growth</h2>
        </div>

        <div className="roadmap-grid">
          {roadmapColumns.map((column) => (
            <article className="roadmap-column" key={column.title}>
              <p className="roadmap-phase">{column.phase}</p>
              <h3>{column.title}</h3>
              <ul className="roadmap-list">
                {column.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="launch-panel launch-trust" id="safety" aria-labelledby="safety-heading">
        <div className="launch-section-heading">
          <p>Safety and Trust</p>
          <h2 id="safety-heading">The features that protect adoption</h2>
        </div>

        <div className="trust-grid">
          {trustHighlights.map((item) => (
            <article className="trust-card" id={item.id} key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="launch-panel launch-reality" aria-labelledby="reality-heading">
        <div className="launch-section-heading">
          <p>Reality Check</p>
          <h2 id="reality-heading">Why dating apps usually lose momentum</h2>
        </div>

        <ul className="reality-list">
          {realityChecks.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      {!isAuthenticated && (
        <section className="launch-panel launch-cta" id="contact" aria-labelledby="cta-heading">
          <div className="launch-cta-copy">
            <p className="launch-cta-tag">Launch direction</p>
            <h2 id="cta-heading">Build the trustworthy version first.</h2>
            <p>
              LinkUp does not need every advanced idea to start strong. It needs real profiles,
              better matching, safer chat, and one clear reason people remember it.
            </p>
          </div>

          <div className="launch-cta-actions">
            <button
              type="button"
              className="registration-option primary-option"
              onClick={() => onSelectRegistrationType("user")}
            >
              <span>Create Your Profile</span>
              <small>Start with the MVP experience and build from there.</small>
            </button>

            <button
              type="button"
              className="registration-option secondary-option"
              onClick={() => onSelectRegistrationType("login")}
            >
              <span>Sign In</span>
              <small>Jump back into your conversations and matches.</small>
            </button>
          </div>
        </section>
      )}

      <footer className="launch-footer">
        <div className="footer-content">
          <div className="footer-section">
            <h4>LinkUp Dating</h4>
            <p>Designed for meaningful connections, safer conversations, and clearer dating intent.</p>
          </div>
          <div className="footer-section">
            <h4>Quick Links</h4>
            <ul>
              <li>
                <a href="#about">About the product</a>
              </li>
              <li>
                <a href="#safety">Safety and trust</a>
              </li>
              <li>
                <a href="#privacy">Privacy controls</a>
              </li>
              <li>
                <a href="#contact">Launch focus</a>
              </li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Launch Lens</h4>
            <p>Profiles plus matching plus chat plus verification plus one strong twist beats feature overload.</p>
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
