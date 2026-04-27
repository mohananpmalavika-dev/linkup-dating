import React from "react";
import { getTranslation } from "../data/translations";
import "../styles/LaunchPage.css";

const LaunchPage = ({ language, onSelectRegistrationType }) => {
  const { launch, direction } = getTranslation(language);

  return (
    <main className="launch-page" dir={direction}>
      <section className="launch-card">
        <img src="/logo.svg" alt="LinkUp" className="launch-logo" />
        <p className="launch-brand">{launch.brand}</p>
        <h1>{launch.title}</h1>
        <p className="launch-promise">{launch.promise || "Real matches, safe dates, better conversations."}</p>
        <p className="launch-intro">{launch.intro}</p>
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
      </section>
    </main>
  );
};

export default LaunchPage;
