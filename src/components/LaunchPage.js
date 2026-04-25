import React from "react";
import { getTranslation, languageOptions } from "../data/translations";
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
}) => {
  const { launch, direction } = getTranslation(language);

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

  return (
    <main className="launch-page" dir={direction}>
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
          <img src="/logo.svg" alt="NilaHub" className="launch-logo" />
          <p className="launch-eyebrow">{launch.brand}</p>
          <h1>{launch.title}</h1>
          <p className="launch-intro">{launch.intro}</p>

          <div className="registration-actions" aria-label="Registration options">
            <button
              type="button"
              className="registration-option login-option"
              onClick={() => onSelectRegistrationType("login")}
            >
              <span>{launch.login}</span>
              <small>{launch.loginHelp}</small>
            </button>
            <button
              type="button"
              className="registration-option primary-option"
              onClick={() => onSelectRegistrationType("user")}
            >
              <span>{launch.user}</span>
              <small>{launch.userHelp}</small>
            </button>
            <button
              type="button"
              className="registration-option secondary-option"
              onClick={() => onSelectRegistrationType("entrepreneur")}
            >
              <span>{launch.entrepreneur}</span>
              <small>{launch.entrepreneurHelp}</small>
            </button>
          </div>
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
    </main>
  );
};

export default LaunchPage;
