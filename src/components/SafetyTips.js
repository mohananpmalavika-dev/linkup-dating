import React, { useState, useEffect } from 'react';
import dateSafetyService from '../services/dateSafetyService';
import './DateSafetyKit.css';

const SafetyTips = ({ onAcknowledge, sessionId }) => {
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedTip, setExpandedTip] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    fetchSafetyTips();
  }, []);

  const fetchSafetyTips = async () => {
    try {
      setLoading(true);
      const result = await dateSafetyService.getSafetyTips();
      setTips(result.tips || []);
    } catch (error) {
      console.error('Failed to fetch safety tips:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    try {
      if (sessionId) {
        await dateSafetyService.acknowledgeSafetyTips(sessionId);
      }
      setAcknowledged(true);
      if (onAcknowledge) {
        onAcknowledge();
      }
    } catch (error) {
      console.error('Failed to acknowledge tips:', error);
    }
  };

  const toggleTip = (tipId) => {
    setExpandedTip(expandedTip === tipId ? null : tipId);
  };

  const getIconEmoji = (icon) => {
    const iconMap = {
      location: '📍',
      share: '📤',
      shield: '🛡️',
      car: '🚗',
      message: '💬',
      battery: '🔋',
      clock: '⏰',
      alert: '⚠️',
    };
    return iconMap[icon] || '✨';
  };

  if (loading) {
    return (
      <div className="safety-tips-container loading">
        <div className="loading-spinner">Loading safety tips...</div>
      </div>
    );
  }

  return (
    <div className="safety-tips-container">
      <div className="safety-tips-header">
        <h2>📋 First Date Safety Tips</h2>
        <p className="safety-tips-subtitle">Essential guidelines to stay safe on your date</p>
      </div>

      <div className="safety-tips-grid">
        {tips.map((tip) => (
          <div
            key={tip.id}
            className={`safety-tip-card ${expandedTip === tip.id ? 'expanded' : ''}`}
            onClick={() => toggleTip(tip.id)}
          >
            <div className="safety-tip-header">
              <span className="safety-tip-icon">{getIconEmoji(tip.icon)}</span>
              <h3 className="safety-tip-title">{tip.title}</h3>
              <span className="expand-arrow">
                {expandedTip === tip.id ? '▼' : '▶'}
              </span>
            </div>

            {expandedTip === tip.id && (
              <div className="safety-tip-content">
                <p>{tip.description}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {!acknowledged && (
        <div className="safety-tips-acknowledgment">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            <span>I understand and will follow these safety tips</span>
          </label>

          <button
            className="btn-acknowledge-tips"
            onClick={handleAcknowledge}
            disabled={!acknowledged}
          >
            I'm Ready to Date Safely ✓
          </button>
        </div>
      )}

      {acknowledged && (
        <div className="safety-tips-confirmed">
          <span className="confirmed-icon">✓</span>
          <p>Great! You're all set to date safely. Enjoy your date!</p>
        </div>
      )}
    </div>
  );
};

export default SafetyTips;
