import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../utils/api';
import axios from 'axios';
import './RewindQuotaBar.css';

/**
 * RewindQuotaBar Component
 * Displays current rewind quota status in a compact format
 * Shows for free users: X/3 rewinds used today
 * Shows for premium users: Unlimited rewinds
 */
const RewindQuotaBar = ({ refreshTrigger }) => {
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuota();
  }, [refreshTrigger]);

  const loadQuota = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/dating/rewind/quota`, {
        withCredentials: true
      });
      setQuota(response.data.quota);
    } catch (err) {
      console.error('Failed to load rewind quota:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !quota) return null;

  const isPremium = quota.isPremium;
  const usagePercent = isPremium ? 100 : (quota.usedToday / quota.dailyLimit) * 100;
  const isLimited = !isPremium && quota.remainingToday === 0;

  return (
    <div className={`rewind-quota-bar ${isPremium ? 'premium' : ''} ${isLimited ? 'limited' : ''}`}>
      <div className="quota-content">
        <div className="quota-left">
          <span className="quota-icon">🔄</span>
          <div className="quota-text">
            <span className="quota-label">Rewinds</span>
            {isPremium ? (
              <span className="quota-value premium">♾️ Unlimited</span>
            ) : (
              <span className="quota-value">
                {quota.usedToday}/{quota.dailyLimit}
              </span>
            )}
          </div>
        </div>

        {!isPremium && (
          <div className="quota-right">
            <div className="progress-mini">
              <div 
                className="progress-bar-mini"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>
        )}

        {isPremium && (
          <div className="premium-indicator">
            <span className="crown">👑</span>
          </div>
        )}
      </div>

      {isLimited && (
        <div className="quota-message-limited">
          Rewind limit reached! Upgrade to Premium for unlimited.
          <a href="/premium-plans" className="upgrade-link-mini">Upgrade</a>
        </div>
      )}
    </div>
  );
};

export default RewindQuotaBar;
