import React, { useState, useEffect } from 'react';
import { referralService } from '../services/referralService';
import '../styles/ReferralRewardsCenter.css';

const ReferralRewardsCenter = ({ onClose }) => {
  const [rewards, setRewards] = useState({
    pending: [],
    claimed: [],
    expired: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claimingRewardId, setClaimingRewardId] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [totalStats, setTotalStats] = useState({
    premiumDaysPending: 0,
    superlikesPending: 0,
    premiumDaysClaimed: 0,
    superlikesClaimed: 0
  });

  useEffect(() => {
    loadRewards();
  }, []);

  const loadRewards = async () => {
    setLoading(true);
    try {
      const result = await referralService.getAllRewards();
      if (result.success) {
        const { pending = [], claimed = [], expired = [] } = result.data || {};
        setRewards({ pending, claimed, expired });

        // Calculate stats
        const premiumDaysPending = pending
          .filter(r => r.reward_type === 'premium_days')
          .reduce((sum, r) => sum + (r.reward_value || 0), 0);

        const superlikesPending = pending
          .filter(r => r.reward_type === 'super_likes')
          .reduce((sum, r) => sum + (r.reward_value || 0), 0);

        const premiumDaysClaimed = claimed
          .filter(r => r.reward_type === 'premium_days')
          .reduce((sum, r) => sum + (r.reward_value || 0), 0);

        const superlikesClaimed = claimed
          .filter(r => r.reward_type === 'super_likes')
          .reduce((sum, r) => sum + (r.reward_value || 0), 0);

        setTotalStats({
          premiumDaysPending,
          superlikesPending,
          premiumDaysClaimed,
          superlikesClaimed
        });
      } else {
        setError(result.message || 'Failed to load rewards');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimReward = async (rewardId) => {
    setClaimingRewardId(rewardId);
    try {
      const result = await referralService.claimReward(rewardId);
      if (result.success) {
        // Reload rewards after claiming
        await loadRewards();
      } else {
        setError(result.message || 'Failed to claim reward');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setClaimingRewardId(null);
    }
  };

  const handleClaimAll = async () => {
    try {
      setClaimingRewardId('all');
      const result = await referralService.claimAllRewards();
      if (result.success) {
        await loadRewards();
      } else {
        setError(result.message || 'Failed to claim rewards');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setClaimingRewardId(null);
    }
  };

  const getRewardIcon = (type) => {
    if (type === 'premium_days') return '💎';
    if (type === 'super_likes') return '⭐';
    if (type === 'coins') return '🪙';
    if (type === 'boost_token') return '⚡';
    return '🎁';
  };

  const getRewardLabel = (type) => {
    if (type === 'premium_days') return 'Days Premium';
    if (type === 'super_likes') return 'Superlikes';
    if (type === 'coins') return 'DatingHub Coins';
    if (type === 'boost_token') return 'Boost Tokens';
    return 'Reward';
  };

  const renderRewardCard = (reward, canClaim = false) => {
    const isExpired = reward.expires_at && new Date(reward.expires_at) < new Date();
    const daysUntilExpiry = reward.expires_at
      ? Math.ceil((new Date(reward.expires_at) - new Date()) / (1000 * 60 * 60 * 24))
      : null;

    return (
      <div key={reward.id} className={`reward-card ${isExpired ? 'expired' : ''}`}>
        <div className="reward-header">
          <span className="reward-icon">
            {getRewardIcon(reward.reward_type)}
          </span>
          <div className="reward-type-info">
            <div className="reward-type">{getRewardLabel(reward.reward_type)}</div>
            {reward.status && (
              <div className={`reward-status ${reward.status}`}>
                {reward.status.charAt(0).toUpperCase() + reward.status.slice(1)}
              </div>
            )}
          </div>
        </div>

        <div className="reward-value">
          <span className="value-amount">
            {reward.reward_value || 0}
          </span>
        </div>

        <div className="reward-details">
          {reward.referral_id && (
            <div className="detail-item">
              <span className="label">From Referral:</span>
              <span className="value">#{reward.referral_id}</span>
            </div>
          )}

          {reward.awarded_at && (
            <div className="detail-item">
              <span className="label">Awarded:</span>
              <span className="value">
                {new Date(reward.awarded_at).toLocaleDateString()}
              </span>
            </div>
          )}

          {isExpired ? (
            <div className="detail-item expired-notice">
              <span>⚠️ Expired on {new Date(reward.expires_at).toLocaleDateString()}</span>
            </div>
          ) : daysUntilExpiry && daysUntilExpiry <= 7 ? (
            <div className="detail-item expiring-soon">
              <span>⏰ Expires in {daysUntilExpiry} days</span>
            </div>
          ) : daysUntilExpiry ? (
            <div className="detail-item">
              <span className="label">Expires:</span>
              <span className="value">
                {new Date(reward.expires_at).toLocaleDateString()}
              </span>
            </div>
          ) : null}
        </div>

        {canClaim && !isExpired && (
          <button
            className="btn-claim"
            onClick={() => handleClaimReward(reward.id)}
            disabled={claimingRewardId === reward.id}
          >
            {claimingRewardId === reward.id ? '✓ Claiming...' : '🎁 Claim Reward'}
          </button>
        )}
      </div>
    );
  };

  if (!loading && rewards.pending.length === 0 && rewards.claimed.length === 0 && rewards.expired.length === 0) {
    return (
      <div className="rewards-center">
        <div className="rewards-header">
          <h2>🎁 Rewards Center</h2>
          {onClose && <button className="close-btn" onClick={onClose}>✕</button>}
        </div>
        <div className="empty-rewards">
          <p>📭 No rewards yet</p>
          <small>Invite friends and earn rewards!</small>
        </div>
      </div>
    );
  }

  return (
    <div className="rewards-center">
      <div className="rewards-header">
        <h2>🎁 Rewards Center</h2>
        {onClose && <button className="close-btn" onClick={onClose}>✕</button>}
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Summary Stats */}
      {!loading && (
        <div className="rewards-summary">
          <div className="summary-card pending">
            <div className="summary-icon">💎</div>
            <div className="summary-content">
              <div className="summary-label">Pending Premium</div>
              <div className="summary-value">{totalStats.premiumDaysPending} days</div>
            </div>
          </div>
          <div className="summary-card pending">
            <div className="summary-icon">⭐</div>
            <div className="summary-content">
              <div className="summary-label">Pending Superlikes</div>
              <div className="summary-value">{totalStats.superlikesPending}</div>
            </div>
          </div>
          <div className="summary-card claimed">
            <div className="summary-icon">✅</div>
            <div className="summary-content">
              <div className="summary-label">Claimed Premium</div>
              <div className="summary-value">{totalStats.premiumDaysClaimed} days</div>
            </div>
          </div>
          <div className="summary-card claimed">
            <div className="summary-icon">✨</div>
            <div className="summary-content">
              <div className="summary-label">Claimed Superlikes</div>
              <div className="summary-value">{totalStats.superlikesClaimed}</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="rewards-tabs">
        <button
          className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          <span className="tab-badge">{rewards.pending.length}</span>
          Pending
        </button>
        <button
          className={`tab-btn ${activeTab === 'claimed' ? 'active' : ''}`}
          onClick={() => setActiveTab('claimed')}
        >
          <span className="tab-badge">{rewards.claimed.length}</span>
          Claimed
        </button>
        {rewards.expired.length > 0 && (
          <button
            className={`tab-btn ${activeTab === 'expired' ? 'active' : ''}`}
            onClick={() => setActiveTab('expired')}
          >
            <span className="tab-badge">{rewards.expired.length}</span>
            Expired
          </button>
        )}
      </div>

      {/* Rewards Content */}
      <div className="rewards-content">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading rewards...</p>
          </div>
        ) : activeTab === 'pending' ? (
          <>
            {rewards.pending.length > 0 ? (
              <>
                {rewards.pending.length > 1 && (
                  <button
                    className="btn-claim-all"
                    onClick={handleClaimAll}
                    disabled={claimingRewardId === 'all'}
                  >
                    {claimingRewardId === 'all' ? '✓ Claiming All...' : `🎁 Claim All (${rewards.pending.length})`}
                  </button>
                )}
                <div className="rewards-grid">
                  {rewards.pending.map(reward => renderRewardCard(reward, true))}
                </div>
              </>
            ) : (
              <div className="empty-tab">
                <p>✨ No pending rewards</p>
              </div>
            )}
          </>
        ) : activeTab === 'claimed' ? (
          <>
            {rewards.claimed.length > 0 ? (
              <div className="rewards-grid">
                {rewards.claimed.map(reward => renderRewardCard(reward, false))}
              </div>
            ) : (
              <div className="empty-tab">
                <p>📭 No claimed rewards yet</p>
              </div>
            )}
          </>
        ) : (
          <>
            {rewards.expired.length > 0 ? (
              <div className="rewards-grid">
                {rewards.expired.map(reward => renderRewardCard(reward, false))}
              </div>
            ) : (
              <div className="empty-tab">
                <p>✅ No expired rewards</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* How It Works */}
      <div className="how-it-works">
        <h4>ℹ️ How Rewards Work</h4>
        <div className="steps">
          <div className="step">
            <span className="step-number">1</span>
            <span className="step-text">Invite friends with your code</span>
          </div>
          <div className="step">
            <span className="step-number">2</span>
            <span className="step-text">They complete signup & profile</span>
          </div>
          <div className="step">
            <span className="step-number">3</span>
            <span className="step-text">Rewards appear as "Pending"</span>
          </div>
          <div className="step">
            <span className="step-number">4</span>
            <span className="step-text">Claim rewards to use them</span>
          </div>
        </div>
      </div>

      {/* Terms Footer */}
      <div className="rewards-footer">
        <small>Rewards must be claimed within 30 days of being awarded. Unclaimed rewards will expire automatically.</small>
      </div>
    </div>
  );
};

export default ReferralRewardsCenter;
