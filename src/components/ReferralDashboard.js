import React, { useState, useEffect } from 'react';
import { referralService } from '../services/referralService';
import '../styles/ReferralDashboard.css';

const ReferralDashboard = ({ onOpenShareModal, onOpenRedeemModal }) => {
  const [stats, setStats] = useState(null);
  const [pendingRewards, setPendingRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claimingRewards, setClaimingRewards] = useState(false);

  useEffect(() => {
    loadStats();
    loadRewards();
  }, []);

  const loadStats = async () => {
    try {
      const result = await referralService.getReferralStats();
      if (result.success) {
        setStats(result.stats);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadRewards = async () => {
    try {
      const result = await referralService.getPendingRewards();
      if (result.success) {
        setPendingRewards(result.rewards);
      }
    } catch (err) {
      console.error('Error loading rewards:', err);
    }
  };

  const handleClaimRewards = async () => {
    try {
      setClaimingRewards(true);
      const result = await referralService.claimRewards();

      if (result.success) {
        alert(`✅ Rewards claimed!\n+${result.rewards.premiumDays} days premium\n+${result.rewards.superlikes} superlikes`);
        setPendingRewards([]);
        loadStats(); // Refresh stats
      } else {
        alert(`❌ ${result.message}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setClaimingRewards(false);
    }
  };

  if (loading) {
    return <div className="referral-dashboard loading">Loading referral stats...</div>;
  }

  return (
    <div className="referral-dashboard">
      <div className="dashboard-container">
        <h2>🎉 Referral Program</h2>
        <p className="subtitle">Invite friends, earn rewards together!</p>

        {error && <div className="error-banner">{error}</div>}

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card invited">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <p className="stat-label">Friends Invited</p>
              <p className="stat-value">{stats?.totalInvited || 0}</p>
            </div>
          </div>

          <div className="stat-card successful">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <p className="stat-label">Successful Referrals</p>
              <p className="stat-value">{stats?.successfulReferrals || 0}</p>
            </div>
          </div>

          <div className="stat-card premium">
            <div className="stat-icon">💎</div>
            <div className="stat-content">
              <p className="stat-label">Premium Days Earned</p>
              <p className="stat-value">{stats?.rewardsEarned?.premium_days || 0}</p>
            </div>
          </div>

          <div className="stat-card superlikes">
            <div className="stat-icon">⭐</div>
            <div className="stat-content">
              <p className="stat-label">Superlikes Earned</p>
              <p className="stat-value">{stats?.rewardsEarned?.superlikes || 0}</p>
            </div>
          </div>
        </div>

        {/* Referral Code Section */}
        {stats?.referralCode && (
          <div className="referral-code-section">
            <h3>Your Referral Code</h3>
            <div className="code-display">
              <div className="code-box">
                <p className="code-label">Share this code with friends:</p>
                <p className="code-value">{stats.referralCode}</p>
                <button
                  className="btn-copy"
                  onClick={() => {
                    navigator.clipboard.writeText(stats.referralCode);
                    alert('Referral code copied to clipboard!');
                  }}
                >
                  📋 Copy Code
                </button>
              </div>

              <div className="link-box">
                <p className="link-label">Or share this link:</p>
                <input
                  type="text"
                  className="link-input"
                  value={stats.referralLink}
                  readOnly
                  onClick={(e) => e.target.select()}
                />
                <button
                  className="btn-copy"
                  onClick={() => {
                    navigator.clipboard.writeText(stats.referralLink);
                    alert('Referral link copied to clipboard!');
                  }}
                >
                  📋 Copy Link
                </button>
              </div>
            </div>

            <div className="share-buttons">
              <button
                className="btn-share facebook"
                onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(stats.referralLink)}`)}
              >
                📱 Share on Facebook
              </button>
              <button
                className="btn-share whatsapp"
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Join LinkUp! ${stats.referralLink}`)}`, '_blank')}
              >
                💬 Share on WhatsApp
              </button>
              <button
                className="btn-share twitter"
                onClick={() => window.open(`https://twitter.com/intent/tweet?text=Join LinkUp! ${encodeURIComponent(stats.referralLink)}`)}
              >
                𝕏 Share on X
              </button>
            </div>

            <button
              className="btn-primary btn-share-modal"
              onClick={onOpenShareModal}
            >
              📤 Share More Options
            </button>
          </div>
        )}

        {/* Pending Rewards */}
        {pendingRewards.length > 0 && (
          <div className="pending-rewards-section">
            <h3>💝 Pending Rewards ({pendingRewards.length})</h3>
            <div className="rewards-list">
              {pendingRewards.map(reward => (
                <div key={reward.id} className="reward-item">
                  <div className="reward-icon">
                    {reward.type === 'premium_days' ? '💎' : '⭐'}
                  </div>
                  <div className="reward-content">
                    <p className="reward-description">{reward.description}</p>
                    <p className="reward-from">
                      From referral by {reward.referrerName}
                    </p>
                  </div>
                  <div className="reward-amount">
                    +{reward.amount}
                  </div>
                </div>
              ))}
            </div>

            <button
              className="btn-claim-rewards"
              onClick={handleClaimRewards}
              disabled={claimingRewards}
            >
              {claimingRewards ? '⏳ Claiming...' : '🎁 Claim All Rewards'}
            </button>
          </div>
        )}

        {/* Referred Friends */}
        {stats?.referredFriends && stats.referredFriends.length > 0 && (
          <div className="referred-friends-section">
            <h3>👯 Friends You've Referred</h3>
            <div className="friends-grid">
              {stats.referredFriends.map(friend => (
                <div key={friend.id} className="friend-card">
                  {friend.photo && (
                    <img src={friend.photo} alt={friend.name} className="friend-photo" />
                  )}
                  <div className="friend-info">
                    <p className="friend-name">{friend.name}</p>
                    {friend.age && <p className="friend-age">{friend.age} years old</p>}
                    <p className="friend-joined">
                      Joined {new Date(friend.joinedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rewards Info */}
        <div className="rewards-info">
          <h3>🎯 How It Works</h3>
          <div className="info-grid">
            <div className="info-card">
              <p className="info-icon">1️⃣</p>
              <p className="info-text"><strong>Share your code</strong> with friends</p>
            </div>
            <div className="info-card">
              <p className="info-icon">2️⃣</p>
              <p className="info-text">They <strong>sign up with your code</strong></p>
            </div>
            <div className="info-card">
              <p className="info-icon">3️⃣</p>
              <p className="info-text"><strong>You both get rewards</strong> instantly</p>
            </div>
            <div className="info-card">
              <p className="info-icon">🎁</p>
              <p className="info-text"><strong>+7 days</strong> premium + <strong>+5</strong> superlikes each</p>
            </div>
          </div>
        </div>

        <button
          className="btn-redeem"
          onClick={onOpenRedeemModal}
        >
          Have a referral code? 📥 Redeem Here
        </button>
      </div>
    </div>
  );
};

export default ReferralDashboard;
