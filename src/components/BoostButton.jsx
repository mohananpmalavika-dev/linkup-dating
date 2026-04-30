/**
 * BoostButton Component
 * Quick access button to purchase boosts
 */

import React, { useState } from 'react';
import { useNavigate } from '../router';
import useBoosts from '../hooks/useBoosts';
import BoostPurchasePanel from './BoostPurchasePanel';
import './BoostButton.css';

const BoostButton = ({ onBoostActivated, compact = false }) => {
  const navigate = useNavigate();
  const [showPanel, setShowPanel] = useState(false);
  const { activeBoosts, canUseBoosts } = useBoosts();

  const hasActiveBoost = activeBoosts && activeBoosts.length > 0;

  if (!canUseBoosts) {
    return (
      <button 
        className="boost-btn upgrade-btn" 
        title="Upgrade to premium to use boosts"
        onClick={() => navigate('/subscription')}
      >
        <span className="boost-icon">📈</span>
        <span className="boost-text">Upgrade</span>
      </button>
    );
  }

  if (compact) {
    return (
      <>
        <button
          className={`boost-btn compact ${hasActiveBoost ? 'active' : ''}`}
          onClick={() => setShowPanel(true)}
          title={hasActiveBoost ? 'Boost active!' : 'Boost your profile'}
        >
          <span className="boost-icon">📈</span>
          {hasActiveBoost && <span className="active-indicator"></span>}
        </button>

        {showPanel && (
          <div className="boost-modal-overlay" onClick={() => setShowPanel(false)}>
            <div className="boost-modal-content" onClick={(e) => e.stopPropagation()}>
              <BoostPurchasePanel
                onClose={() => setShowPanel(false)}
                onSuccess={onBoostActivated}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <button
        className={`boost-btn full-btn ${hasActiveBoost ? 'active' : ''}`}
        onClick={() => setShowPanel(true)}
      >
        <span className="boost-icon">📈</span>
        <div className="boost-btn-content">
          <span className="boost-title">
            {hasActiveBoost ? '🚀 Boost Active!' : 'Boost Your Profile'}
          </span>
          <span className="boost-subtitle">
            {hasActiveBoost ? `${activeBoosts.length} active boost(s)` : 'Get 3x-10x visibility'}
          </span>
        </div>
        <span className="boost-arrow">→</span>
      </button>

      {showPanel && (
        <div className="boost-modal-overlay" onClick={() => setShowPanel(false)}>
          <div className="boost-modal-content" onClick={(e) => e.stopPropagation()}>
            <BoostPurchasePanel
              onClose={() => setShowPanel(false)}
              onSuccess={onBoostActivated}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default BoostButton;
