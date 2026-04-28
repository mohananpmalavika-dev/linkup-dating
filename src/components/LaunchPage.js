import React from "react";
import { getTranslation, getTranslationValue, languageOptions } from "../data/translations";
import PublicLegalNotice from "./PublicLegalNotice";
import "../styles/LaunchPage.css";

const SUPPORTED_LAUNCH_LANGUAGES = ["en", "ml"];

const LaunchPage = ({ language, onLanguageChange, onSelectRegistrationType }) => {
  const { launch, direction } = getTranslation(language);
  const legalNoticeMessage = getTranslationValue(language, "public.launchNotice");
  const launchLanguageOptions = languageOptions.filter(({ code }) => SUPPORTED_LAUNCH_LANGUAGES.includes(code));

  return (
    <main className="launch-page" dir={direction}>
      <section className="launch-card">
        <img src="/logo.svg" alt="LinkUp" className="launch-logo" />
        <p className="launch-brand">{launch.brand}</p>
        <h1>{launch.title}</h1>
        <p className="launch-promise">{launch.promise || "Real matches, safe dates, better conversations."}</p>
        <p className="launch-intro">{launch.intro}</p>
        <div className="launch-language" aria-label={launch.languageLabel || "Language"}>
          <div className="launch-language-header">
            <span className="launch-language-label">{launch.languageLabel || "Language"}</span>
            <span className="launch-language-help">
              {launch.languageHelper || "Choose English or Malayalam before you continue."}
            </span>
          </div>
          <div className="launch-language-options" role="group" aria-label={launch.languageLabel || "Language"}>
            {launchLanguageOptions.map((option) => (
              <button
                key={option.code}
                type="button"
                className={`launch-language-option ${language === option.code ? "is-active" : ""}`}
                onClick={() => onLanguageChange?.(option.code)}
                aria-pressed={language === option.code}
              >
                {option.name}
              </button>
            ))}
          </div>
        </div>
        <div className="launch-highlights" aria-label="Product promise">
          {(launch.highlights || ["Real matches", "Safe dates", "Better conversations"]).map((highlight) => (
            <span key={highlight} className="launch-highlight">
              {highlight}
            </span>
          ))}
        </div>

        <div className="launch-actions" aria-label="Registration options">
          <button
            type="button"
            className="launch-button launch-button-primary"
            onClick={() => onSelectRegistrationType("user")}
          >
            <span>{launch.user || "Sign Up"}</span>
            <small>{launch.userHelp || "Create your profile and get started."}</small>
          </button>

          <button
            type="button"
            className="launch-button launch-button-secondary"
            onClick={() => onSelectRegistrationType("login")}
          >
            <span>{launch.login || "Login"}</span>
            <small>{launch.loginHelp || "Sign in to your existing account."}</small>
          </button>
        </div>

        <PublicLegalNotice language={language} message={legalNoticeMessage} />
      </section>
    </main>
  );
};

export default LaunchPage;
