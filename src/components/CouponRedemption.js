import React, { useState } from 'react';
import axios from 'axios';
import '../styles/CouponRedemption.css';

/**
 * Coupon Redemption Component
 * Allows users to redeem coupon codes to get additional likes/superlikes
 */

const CouponRedemption = ({ onRedemptionSuccess, isOpen, onClose }) => {
  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [redemptionDetails, setRedemptionDetails] = useState(null);

  const token = localStorage.getItem('token');

  const apiClient = axios.create({
    baseURL: '/api',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const handleRedeemCoupon = async (e) => {
    e.preventDefault();

    if (!couponCode.trim()) {
      setError('Please enter a coupon code');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const response = await apiClient.post('/redeem-coupon', {
        couponCode: couponCode.toUpperCase()
      });

      setRedemptionDetails(response.data);
      setSuccess(`✓ Coupon redeemed successfully!`);
      setCouponCode('');

      // Call parent callback after short delay
      setTimeout(() => {
        if (onRedemptionSuccess) {
          onRedemptionSuccess(response.data);
        }
      }, 1500);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to redeem coupon';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCouponCode('');
    setError('');
    setSuccess('');
    setRedemptionDetails(null);
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="coupon-modal-overlay" onClick={handleClose}>
      <div className="coupon-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={handleClose}>
          ✕
        </button>

        <div className="modal-header">
          <h2>Redeem Coupon Code</h2>
          <p>Get extra likes, superlikes, or call credits</p>
        </div>

        {success && redemptionDetails ? (
          <div className="success-content">
            <div className="success-icon">✓</div>
            <h3>Coupon Redeemed!</h3>

            <div className="redemption-summary">
              {redemptionDetails.likesGranted > 0 && (
                <div className="credit-item">
                  <span className="label">Likes Granted</span>
                  <span className="value">+{redemptionDetails.likesGranted}</span>
                </div>
              )}
              {redemptionDetails.superlikesGranted > 0 && (
                <div className="credit-item">
                  <span className="label">Superlikes Granted</span>
                  <span className="value">+{redemptionDetails.superlikesGranted}</span>
                </div>
              )}
              {redemptionDetails.creditsGranted > 0 && (
                <div className="credit-item">
                  <span className="label">Call Credits Granted</span>
                  <span className="value">+{redemptionDetails.creditsGranted}</span>
                </div>
              )}
            </div>

            {redemptionDetails.updatedLimits && (
              <div className="updated-limits">
                <h4>Your Updated Credits:</h4>
                <div className="limits-grid">
                  <div className="limit-card">
                    <span className="limit-label">Remaining Likes</span>
                    <span className="limit-value">
                      {redemptionDetails.updatedLimits.remainingLikes}
                    </span>
                  </div>
                  <div className="limit-card">
                    <span className="limit-label">Remaining Superlikes</span>
                    <span className="limit-value">
                      {redemptionDetails.updatedLimits.remainingSuperlikes}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <button className="btn btn-primary btn-large" onClick={handleClose}>
              Start Discovering
            </button>
          </div>
        ) : (
          <>
            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleRedeemCoupon} className="coupon-form">
              <div className="form-group">
                <label htmlFor="coupon-code">Coupon Code</label>
                <input
                  id="coupon-code"
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Enter coupon code"
                  disabled={loading}
                  maxLength="50"
                  autoComplete="off"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-large"
                disabled={loading || !couponCode.trim()}
              >
                {loading ? 'Redeeming...' : 'Redeem Coupon'}
              </button>
            </form>

            <div className="coupon-tips">
              <h4>Tips:</h4>
              <ul>
                <li>Coupon codes are case-insensitive</li>
                <li>Each code can typically only be used once per account</li>
                <li>Some coupons may have expiration dates</li>
                <li>Credits are added to your account immediately</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CouponRedemption;
