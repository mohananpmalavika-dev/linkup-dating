/**
 * BoostPurchasePanel Component
 * Browse and purchase profile boosts
 */

import React, { useState, useEffect } from 'react';
import useBoosts from '../hooks/useBoosts';
import './BoostPurchasePanel.css';

const BoostPurchasePanel = ({ onClose, onSuccess }) => {
  const {
    packages,
    bulkPricing,
    purchaseBoost,
    calculatePrice,
    loading,
    error,
    canUseBoosts
  } = useBoosts();

  const [selectedType, setSelectedType] = useState('premium');
  const [quantity, setQuantity] = useState(1);
  const [pricing, setPricing] = useState(null);
  const [smartSchedule, setSmartSchedule] = useState(true);
  const [scheduledTime, setScheduledTime] = useState(null);
  const [purchasing, setPurchasing] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  // Update pricing when selections change
  useEffect(() => {
    const updatePricing = async () => {
      const price = await calculatePrice(selectedType, quantity);
      setPricing(price);
    };

    updatePricing();
  }, [selectedType, quantity, calculatePrice]);

  const handlePurchase = async () => {
    setPurchasing(true);
    const result = await purchaseBoost(
      selectedType,
      smartSchedule,
      smartSchedule ? null : scheduledTime
    );

    if (result.success) {
      setSuccessMessage(result.boost.message);
      setTimeout(() => {
        onSuccess?.(result.boost);
        onClose?.();
      }, 2000);
    }
    setPurchasing(false);
  };

  if (!canUseBoosts) {
    return (
      <div className="boost-panel not-eligible">
        <div className="boost-panel-header">
          <h2>📈 Visibility Boosts</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div className="not-eligible-content">
          <div className="icon">🔒</div>
          <h3>Premium Feature</h3>
          <p>Upgrade to Premium to boost your profile visibility!</p>
          <button className="btn btn-primary">Upgrade Now</button>
        </div>
      </div>
    );
  }

  const selectedPackage = packages.find((p) => p.type === selectedType);

  return (
    <div className="boost-panel">
      {/* Header */}
      <div className="boost-panel-header">
        <h2>📈 Boost Your Profile</h2>
        <p className="boost-subtitle">Get 3x-10x more visibility for 1-3 hours</p>
        <button className="btn-close" onClick={onClose}>✕</button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="boost-success">
          <div className="success-icon">✓</div>
          <p>{successMessage}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="boost-error">
          <p>⚠️ {error}</p>
        </div>
      )}

      <div className="boost-content">
        {/* Boost Packages */}
        <div className="boost-section">
          <h3>Select Boost Type</h3>
          <div className="package-grid">
            {packages.map((pkg) => (
              <div
                key={pkg.type}
                className={`package-card ${selectedType === pkg.type ? 'selected' : ''} ${pkg.badge ? 'badge' : ''}`}
                onClick={() => setSelectedType(pkg.type)}
              >
                {pkg.badge && <div className="package-badge">{pkg.badge}</div>}
                <h4>{pkg.name}</h4>
                <p className="package-desc">{pkg.description}</p>
                <div className="package-specs">
                  <div className="spec">
                    <span className="spec-label">Multiplier</span>
                    <span className="spec-value">{pkg.multiplier}x</span>
                  </div>
                  <div className="spec">
                    <span className="spec-label">Duration</span>
                    <span className="spec-value">{pkg.duration}m</span>
                  </div>
                  <div className="spec">
                    <span className="spec-label">Price</span>
                    <span className="spec-value">${pkg.basePrice}</span>
                  </div>
                </div>
                <ul className="package-features">
                  {pkg.features.slice(0, 3).map((feature, idx) => (
                    <li key={idx}>
                      <span className="feature-icon">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Quantity Selection */}
        <div className="boost-section">
          <h3>Bulk Purchase (Save More!)</h3>
          <div className="quantity-selector">
            {bulkPricing.map((option) => (
              <button
                key={option.quantity}
                className={`qty-btn ${quantity === option.quantity ? 'active' : ''}`}
                onClick={() => setQuantity(option.quantity)}
              >
                <span className="qty-label">{option.label}</span>
                {option.discount > 0 && (
                  <span className="qty-savings">Save {Math.round(option.discount * 100)}%</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Scheduling */}
        <div className="boost-section">
          <h3>⏰ Schedule Your Boost</h3>
          <div className="scheduling-options">
            <label className="schedule-option">
              <input
                type="radio"
                name="schedule"
                checked={smartSchedule}
                onChange={() => setSmartSchedule(true)}
              />
              <div className="option-content">
                <span className="option-title">🤖 Smart Schedule</span>
                <span className="option-desc">Boost when your audience is most active (Friday 8PM)</span>
              </div>
            </label>
            <label className="schedule-option">
              <input
                type="radio"
                name="schedule"
                checked={!smartSchedule}
                onChange={() => setSmartSchedule(false)}
              />
              <div className="option-content">
                <span className="option-title">⏱️ Custom Time</span>
                <span className="option-desc">Choose exactly when to boost</span>
              </div>
            </label>
            {!smartSchedule && (
              <input
                type="datetime-local"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="datetime-input"
                min={new Date().toISOString().slice(0, 16)}
              />
            )}
          </div>
        </div>

        {/* Pricing Summary */}
        {pricing && (
          <div className="boost-section pricing-summary">
            <h3>💰 Pricing Summary</h3>
            <div className="price-breakdown">
              <div className="price-row">
                <span>Base Price ({quantity}x)</span>
                <span>${pricing.basePrice.toFixed(2)}</span>
              </div>
              {pricing.discount > 0 && (
                <>
                  <div className="price-row discount">
                    <span>Bulk Discount (-{pricing.discount}%)</span>
                    <span>-${pricing.discountAmount.toFixed(2)}</span>
                  </div>
                  <div className="price-divider"></div>
                </>
              )}
              <div className="price-row total">
                <span className="price-label">Total</span>
                <span className="price-value">${pricing.finalPrice.toFixed(2)}</span>
              </div>
              {pricing.savings > 0 && (
                <div className="price-savings">
                  💚 You're saving ${pricing.savings.toFixed(2)}!
                </div>
              )}
            </div>
          </div>
        )}

        {/* Features */}
        <div className="boost-section features">
          <h3>✨ What You Get</h3>
          <div className="features-grid">
            <div className="feature-item">
              <span className="feature-emoji">👁️</span>
              <span className="feature-text">3-10x More Visibility</span>
            </div>
            <div className="feature-item">
              <span className="feature-emoji">📊</span>
              <span className="feature-text">Real-time Analytics</span>
            </div>
            <div className="feature-item">
              <span className="feature-emoji">💬</span>
              <span className="feature-text">Track Likes & Messages</span>
            </div>
            <div className="feature-item">
              <span className="feature-emoji">⏰</span>
              <span className="feature-text">Smart Scheduling</span>
            </div>
            <div className="feature-item">
              <span className="feature-emoji">💰</span>
              <span className="feature-text">ROI Tracking</span>
            </div>
            <div className="feature-item">
              <span className="feature-emoji">🎯</span>
              <span className="feature-text">Targeted Placement</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="boost-actions">
        <button className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn btn-primary btn-large"
          onClick={handlePurchase}
          disabled={purchasing || loading}
        >
          {purchasing ? '⏳ Processing...' : `🚀 Boost Now - $${pricing?.finalPrice.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
};

export default BoostPurchasePanel;
