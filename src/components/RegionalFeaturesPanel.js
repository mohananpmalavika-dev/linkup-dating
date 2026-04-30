import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './RegionalFeaturesPanel.css';

/**
 * Regional Features Panel
 * Language selection, Kerala district preference, and regional safety info
 */

export default function RegionalFeaturesPanel() {
  const [languages, setLanguages] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [districts, setDistricts] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [safetyInfo, setSafetyInfo] = useState(null);
  const [helplines, setHelplines] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSafetyTips, setShowSafetyTips] = useState(false);

  useEffect(() => {
    fetchRegionalData();
  }, []);

  const fetchRegionalData = async () => {
    try {
      setLoading(true);

      // Get languages
      const langRes = await axios.get('/api/regional/languages');
      setLanguages(langRes.data.languages);

      // Get current language
      try {
        const currentLangRes = await axios.get('/api/regional/language');
        setSelectedLanguage(currentLangRes.data.language);
      } catch (err) {
        // Default to English
      }

      // Get districts
      const districtRes = await axios.get('/api/regional/districts');
      setDistricts(districtRes.data.districts);

      // Get helplines
      const helplineRes = await axios.get('/api/regional/helplines');
      setHelplines(helplineRes.data.helplines);
    } catch (err) {
      setError('Failed to load regional features');
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = async (langCode) => {
    try {
      setSelectedLanguage(langCode);
      await axios.post('/api/regional/language', {
        languageCode: langCode,
      });
      setSuccess('Language preference updated!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to update language preference');
    }
  };

  const handleDistrictChange = async (districtCode) => {
    try {
      setSelectedDistrict(districtCode);

      await axios.post('/api/regional/district', {
        districtCode: districtCode,
      });

      // Get safety info for selected district
      const safetyRes = await axios.get(`/api/regional/safety/${districtCode}`);
      setSafetyInfo(safetyRes.data.data);

      setSuccess('District preference updated!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to update district preference');
      setSafetyInfo(null);
    }
  };

  if (loading) {
    return <div className="regional-loading">Loading regional features...</div>;
  }

  return (
    <div className="regional-features-panel">
      <h1>🇮🇳 Regional Features & Safety</h1>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="regional-container">
        {/* Language Selection */}
        <section className="language-section">
          <h2>🌐 Select Language</h2>
          <p>Choose your preferred language for the app</p>

          <div className="language-grid">
            {languages.map((lang) => (
              <button
                key={lang.code}
                className={`language-card ${
                  selectedLanguage === lang.code ? 'active' : ''
                }`}
                onClick={() => handleLanguageChange(lang.code)}
              >
                <span className="flag">{lang.flag}</span>
                <div className="lang-info">
                  <h3>{lang.name}</h3>
                  <p>{lang.nativeName}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* District Selection */}
        <section className="district-section">
          <h2>📍 Select Your District</h2>
          <p>Choose your home district for better local connections</p>

          <div className="district-selector">
            <select
              value={selectedDistrict}
              onChange={(e) => handleDistrictChange(e.target.value)}
              className="district-dropdown"
            >
              <option value="">Select a district...</option>
              {districts.map((district) => (
                <option key={district.code} value={district.code}>
                  {district.name} ({district.malName})
                </option>
              ))}
            </select>
          </div>

          {selectedDistrict && (
            <div className="selected-district-info">
              <p>
                ✓ Your district preference has been saved. You'll see more
                profiles from {selectedDistrict}.
              </p>
            </div>
          )}
        </section>

        {/* Safety Information */}
        {safetyInfo && (
          <section className="safety-section">
            <h2>🛡️ Safety Information for {safetyInfo.district}</h2>

            <div className="safety-info-card">
              <h3>Local Police Headquarters</h3>
              <p>{safetyInfo.policeHeadquarters}</p>
            </div>

            <button
              className="btn btn-secondary"
              onClick={() => setShowSafetyTips(!showSafetyTips)}
            >
              {showSafetyTips ? '👁️ Hide' : '👁️ Show'} Dating Safety Tips
            </button>

            {showSafetyTips && (
              <div className="safety-tips">
                <div className="tips-category">
                  <h4>📋 Before Meeting</h4>
                  <ul>
                    {safetyInfo.safetyTips.beforeMeeting.map((tip, idx) => (
                      <li key={idx}>
                        <strong>{tip.title}</strong>
                        <p>{tip.desc}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="tips-category">
                  <h4>🎯 During Meeting</h4>
                  <ul>
                    {safetyInfo.safetyTips.duringMeeting.map((tip, idx) => (
                      <li key={idx}>
                        <strong>{tip.title}</strong>
                        <p>{tip.desc}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="tips-category">
                  <h4>✅ After Meeting</h4>
                  <ul>
                    {safetyInfo.safetyTips.afterMeeting.map((tip, idx) => (
                      <li key={idx}>
                        <strong>{tip.title}</strong>
                        <p>{tip.desc}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Emergency Helplines */}
        {helplines && (
          <section className="helplines-section">
            <h2>🆘 Emergency Helplines</h2>
            <p>Available 24/7 for assistance</p>

            <div className="helplines-grid">
              {Object.values(helplines).map((helpline, idx) => (
                <div key={idx} className="helpline-card">
                  <h4>{helpline.name}</h4>
                  <p className="helpline-number">{helpline.number}</p>
                  <p className="helpline-description">{helpline.description}</p>
                  <a href={`tel:${helpline.number}`} className="btn btn-small">
                    📞 Call Now
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Report Content */}
        <section className="report-section">
          <h2>🚨 Report Unsafe Content</h2>
          <p>If you see anything inappropriate or unsafe, report it immediately</p>

          <div className="report-types">
            <div className="report-type">
              <h4>🎭 Fake Profiles</h4>
              <p>Report profiles that appear to be catfishing or fraudulent</p>
            </div>

            <div className="report-type">
              <h4>💬 Inappropriate Messages</h4>
              <p>Report harassment, abuse, or inappropriate content</p>
            </div>

            <div className="report-type">
              <h4>📸 Inappropriate Photos</h4>
              <p>Report NSFW, violent, or exploitative images</p>
            </div>

            <div className="report-type">
              <h4>⚖️ Terms Violation</h4>
              <p>Report any violation of our community guidelines</p>
            </div>
          </div>

          <a href="/report-content" className="btn btn-primary">
            📝 File a Report
          </a>
        </section>

        {/* Privacy & Legal */}
        <section className="legal-section">
          <h2>📜 Legal Documents & Policies</h2>

          <div className="legal-links">
            <a href="/legal/privacy" className="legal-link">
              🔒 Privacy Policy
            </a>
            <a href="/legal/terms" className="legal-link">
              ⚖️ Terms of Service
            </a>
            <a href="/legal/safety-guidelines" className="legal-link">
              🛡️ Safety Guidelines
            </a>
            <a href="/legal/data-protection" className="legal-link">
              📋 DPDPA Compliance
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
