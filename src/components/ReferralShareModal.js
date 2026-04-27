import React, { useEffect, useState } from 'react';
import socialService from '../services/socialService';
import '../styles/ReferralShareModal.css';

const ReferralShareModal = ({ onClose }) => {
  const [referralInfo, setReferralInfo] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copyFeedback, setCopyFeedback] = useState('');

  useEffect(() => {
    loadReferralInfo();
  }, []);

  const loadReferralInfo = async () => {
    setLoading(true);
    try {
      const [info, statsData] = await Promise.all([
        socialService.getReferralInfo(),
        socialService.getReferralStats()
      ]);
      setReferralInfo(info);
      setStats(statsData);
    } catch (err) {
      setError('Failed to load referral info');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const rewardOffer = referralInfo?.rewardOffer || stats?.reward_offer || {};

  const withCopyFeedback = async (value, feedbackLabel) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyFeedback(feedbackLabel);
      window.setTimeout(() => setCopyFeedback(''), 1800);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  const handleShare = async () => {
    const message = [
      'Join me on LinkUp Dating.',
      `Use my code ${referralInfo?.code}.`,
      `You get ${rewardOffer.premiumTrialDays || 0} premium days, ${rewardOffer.superlikeCredits || 0} extra superlikes, and ${rewardOffer.boostCredits || 0} boost credit.`
    ].join(' ');
    const url = referralInfo?.link || '';

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on LinkUp',
          text: message,
          url
        });
        return;
      } catch (err) {
        if (err?.name !== 'AbortError') {
          setError('Sharing failed');
        }
      }
    }

    await withCopyFeedback(`${message} ${url}`.trim(), 'Invite copied');
  };

  if (loading) {
    return (
      <div className="referral-modal-overlay">
        <div className="referral-modal">
          <div className="loading">Loading referral info...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="referral-modal-overlay" onClick={onClose}>
      <div className="referral-modal" onClick={(event) => event.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>x</button>

        <h2>Invite Friends</h2>
        <p className="subtitle">Referral rewards are shared on both sides once someone joins successfully.</p>

        {error ? <div className="error-banner">{error}</div> : null}
        {copyFeedback ? <div className="success-message">{copyFeedback}</div> : null}

        <div className="referral-section">
          <h3>Your Referral Code</h3>
          <div className="code-display">
            <span className="code">{referralInfo?.code}</span>
            <button
              className="copy-btn"
              onClick={() => withCopyFeedback(referralInfo?.code || '', 'Code copied')}
              title="Copy code"
            >
              Copy
            </button>
          </div>
          <p className="code-desc">Share this code or your full invite link with someone new to LinkUp.</p>
        </div>

        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-value">{stats?.total_referrals || 0}</span>
            <span className="stat-label">Total Invites</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats?.completed || 0}</span>
            <span className="stat-label">Completed</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats?.pending || 0}</span>
            <span className="stat-label">Pending</span>
          </div>
        </div>

        <div className="share-section">
          <h3>Reward Bundle</h3>
          <div className="share-options">
            <button className="share-btn copy" type="button" disabled>
              {rewardOffer.boostCredits || 0} boost credit
            </button>
            <button className="share-btn copy" type="button" disabled>
              {rewardOffer.superlikeCredits || 0} extra superlikes
            </button>
            <button className="share-btn copy" type="button" disabled>
              {rewardOffer.premiumTrialDays || 0} premium days
            </button>
          </div>
        </div>

        {stats?.earnedRewards ? (
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-value">{stats.earnedRewards.boostCredits || 0}</span>
              <span className="stat-label">Boost Credits Earned</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.earnedRewards.superlikeCredits || 0}</span>
              <span className="stat-label">Extra Superlikes Earned</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.earnedRewards.premiumDaysAwarded || 0}</span>
              <span className="stat-label">Premium Days Earned</span>
            </div>
          </div>
        ) : null}

        <div className="share-section">
          <h3>Share Your Invite</h3>
          <div className="share-options">
            <button className="share-btn whatsapp" onClick={handleShare} type="button">
              Share invite
            </button>
            <button
              className="share-btn copy"
              onClick={() => withCopyFeedback(referralInfo?.link || '', 'Link copied')}
              type="button"
            >
              Copy link
            </button>
          </div>
        </div>

        <div className="referral-link-section">
          <h3>Your Referral Link</h3>
          <div className="link-display">
            <input
              type="text"
              value={referralInfo?.link || ''}
              readOnly
              className="link-input"
            />
            <button
              className="copy-link-btn"
              onClick={() => withCopyFeedback(referralInfo?.link || '', 'Link copied')}
              title="Copy full link"
              type="button"
            >
              Copy
            </button>
          </div>
        </div>

        <div className="info-section">
          <h4>How It Works</h4>
          <ul>
            <li>Share your code or invite link with someone new to LinkUp.</li>
            <li>They sign up and complete profile creation with your code applied.</li>
            <li>You both receive boost credits, extra superlikes, and premium trial time.</li>
            <li>Your earned balances show up in the social hub and dating profile limits.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ReferralShareModal;
