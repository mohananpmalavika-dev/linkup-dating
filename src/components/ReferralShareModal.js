import React, { useEffect, useState } from 'react';
import socialService from '../services/socialService';
import '../styles/ReferralShareModal.css';

const ReferralShareModal = ({ onClose }) => {
  const [referralInfo, setReferralInfo] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadReferralInfo();
  }, []);

  const loadReferralInfo = async () => {
    setLoading(true);
    try {
      const [info, stats] = await Promise.all([
        socialService.getReferralInfo(),
        socialService.getReferralStats()
      ]);
      setReferralInfo(info);
      setStats(stats);
    } catch (err) {
      setError('Failed to load referral info');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (referralInfo?.link) {
      navigator.clipboard.writeText(referralInfo.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyCode = () => {
    if (referralInfo?.code) {
      navigator.clipboard.writeText(referralInfo.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = (platform) => {
    const message = `Join me on LinkUp Dating! Use my referral code ${referralInfo?.code} to get 7 free premium days.`;
    const link = referralInfo?.link || '';

    const shareUrls = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(message + ' ' + link)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(link)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
      copy: null
    };

    if (platform === 'copy') {
      handleCopyLink();
    } else if (shareUrls[platform]) {
      window.open(shareUrls[platform], '_blank', 'noopener,noreferrer');
    }
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
      <div className="referral-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✕</button>

        <h2>Share Your Profile</h2>
        <p className="subtitle">Invite friends and earn rewards together!</p>

        {error && <div className="error-banner">{error}</div>}

        {/* Referral Code Section */}
        <div className="referral-section">
          <h3>Your Referral Code</h3>
          <div className="code-display">
            <span className="code">{referralInfo?.code}</span>
            <button 
              className="copy-btn"
              onClick={handleCopyCode}
              title="Copy code"
            >
              {copied ? '✓ Copied!' : '📋 Copy'}
            </button>
          </div>
          <p className="code-desc">Share this code with friends - they'll get 7 free premium days!</p>
        </div>

        {/* Stats Section */}
        {stats && (
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-value">{stats.total_referrals || 0}</span>
              <span className="stat-label">Total Referrals</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.completed || 0}</span>
              <span className="stat-label">Completed</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.pending || 0}</span>
              <span className="stat-label">Pending</span>
            </div>
          </div>
        )}

        {/* Share Options */}
        <div className="share-section">
          <h3>Share With Friends</h3>
          <div className="share-options">
            <button 
              className="share-btn whatsapp"
              onClick={() => handleShare('whatsapp')}
              title="Share on WhatsApp"
            >
              📱 WhatsApp
            </button>
            <button 
              className="share-btn twitter"
              onClick={() => handleShare('twitter')}
              title="Share on Twitter"
            >
              𝕏 Twitter
            </button>
            <button 
              className="share-btn facebook"
              onClick={() => handleShare('facebook')}
              title="Share on Facebook"
            >
              f Facebook
            </button>
            <button 
              className="share-btn copy"
              onClick={() => handleShare('copy')}
              title="Copy link"
            >
              🔗 Copy Link
            </button>
          </div>
        </div>

        {/* Referral Link Display */}
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
              onClick={handleCopyLink}
              title="Copy full link"
            >
              📋
            </button>
          </div>
        </div>

        {/* Information */}
        <div className="info-section">
          <h4>How It Works</h4>
          <ul>
            <li>📤 Share your referral code or link with friends</li>
            <li>✅ They sign up and use your code</li>
            <li>🎁 You both get 7 days of premium features</li>
            <li>📊 Track your referrals in your stats</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ReferralShareModal;
