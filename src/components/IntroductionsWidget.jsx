/**
 * IntroductionsWidget Component
 * Displays pending introductions (Concierge Light feature)
 */

import React, { useEffect, useState } from 'react';
import useIntroductions from '../hooks/useIntroductions';
import IntroductionCard from './IntroductionCard';
import './IntroductionsWidget.css';

const IntroductionsWidget = ({ maxVisible = 3, compact = false }) => {
  const {
    introductions,
    stats,
    eligible,
    readyForNew,
    loading,
    error,
    generateIntroductions,
    respondToIntro,
    rateIntroduction,
    refetch
  } = useIntroductions();

  const [showAll, setShowAll] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleGenerateIntros = async () => {
    setGenerating(true);
    const result = await generateIntroductions(3);
    setGenerating(false);

    if (!result.success) {
      console.error('Failed to generate:', result.message);
    }
  };

  const handleLike = async (introId) => {
    const result = await respondToIntro(introId, 'liked');
    if (result.success) {
      // Optional: Show toast notification
      console.log('Liked introduction!');
    }
  };

  const handlePass = async (introId, feedback) => {
    const result = await respondToIntro(introId, 'passed', feedback);
    if (result.success) {
      console.log('Passed introduction');
    }
  };

  const handleRate = async (introId, rating) => {
    const result = await rateIntroduction(introId, rating);
    if (result.success) {
      console.log('Rated introduction');
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="introductions-widget loading">
        <div className="loading-spinner">Loading introductions...</div>
      </div>
    );
  }

  // Show not eligible message
  if (!eligible) {
    return (
      <div className="introductions-widget not-eligible">
        <div className="not-eligible-content">
          <div className="not-eligible-icon">🎯</div>
          <h3>Introductions Coming Soon</h3>
          <p>Complete your profile and upgrade to Premium to get curated introductions!</p>
          <button className="btn btn-primary">Upgrade Now</button>
        </div>
      </div>
    );
  }

  const displayedIntros = showAll ? introductions : introductions.slice(0, maxVisible);
  const hasMoreIntros = introductions.length > maxVisible && !showAll;

  return (
    <div className={`introductions-widget ${compact ? 'compact' : 'full'}`}>
      {/* Header */}
      <div className="intro-widget-header">
        <div className="intro-title-section">
          <h2>🎯 Your Curated Introductions</h2>
          <p className="intro-subtitle">
            Based on your profile, we matched you with {stats.total} people so far
          </p>
        </div>

        {/* Stats */}
        {stats.total > 0 && (
          <div className="intro-stats">
            <div className="stat-item">
              <span className="stat-label">Pending</span>
              <span className="stat-value">{stats.pending}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Liked</span>
              <span className="stat-value">{stats.liked}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Quality</span>
              <span className="stat-value">⭐ {stats.averageQuality}</span>
            </div>
          </div>
        )}
      </div>

      {/* No Introductions State */}
      {introductions.length === 0 && (
        <div className="intro-empty-state">
          <div className="empty-icon">💌</div>
          <h3>No Pending Introductions</h3>
          <p>
            {readyForNew
              ? 'Generate new suggestions to get matched!'
              : 'New suggestions available next week. Check back soon!'}
          </p>

          {readyForNew && (
            <button
              className="btn btn-primary"
              onClick={handleGenerateIntros}
              disabled={generating}
            >
              {generating ? '⏳ Generating...' : '✨ Generate Introductions'}
            </button>
          )}
        </div>
      )}

      {/* Introduction Cards */}
      {introductions.length > 0 && (
        <>
          <div className="introductions-list">
            {displayedIntros.map((intro) => (
              <IntroductionCard
                key={intro.id}
                introduction={intro}
                onLike={handleLike}
                onPass={handlePass}
                onRate={handleRate}
                compact={compact}
              />
            ))}
          </div>

          {/* Show More Button */}
          {hasMoreIntros && (
            <button
              className="btn btn-secondary btn-full"
              onClick={() => setShowAll(true)}
            >
              Show All {introductions.length} Introductions
            </button>
          )}

          {/* Generate New Button */}
          {readyForNew && (
            <div className="intro-generate-section">
              <button
                className="btn btn-primary btn-full"
                onClick={handleGenerateIntros}
                disabled={generating}
              >
                {generating ? '⏳ Generating...' : '✨ Get New Introductions'}
              </button>
              <p className="intro-generate-note">
                Next batch of personalized matches will be ready in a few days
              </p>
            </div>
          )}
        </>
      )}

      {/* Error Message */}
      {error && (
        <div className="intro-error">
          <p>⚠️ {error}</p>
        </div>
      )}
    </div>
  );
};

export default IntroductionsWidget;
