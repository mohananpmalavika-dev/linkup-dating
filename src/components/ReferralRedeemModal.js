import React, { useState } from 'react';
import { referralService } from '../services/referralService';
import '../styles/ReferralRedeemModal.css';

const ReferralRedeemModal = ({ isOpen, onClose, onSuccess }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      if (!code.trim()) {
        throw new Error('Please enter a referral code');
      }

      const result = await referralService.acceptReferralCode(code.trim());

      if (result.success) {
        setSuccess(true);
        setCode('');

        // Show rewards info
        setTimeout(() => {
          alert(`🎉 Referral accepted!\n\nYou both receive:\n+7 days premium\n+5 superlikes`);
          onClose();
          if (onSuccess) onSuccess();
        }, 1500);
      } else {
        setError(result.message || 'Failed to accept referral code');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="referral-redeem-modal modal-overlay">
      <div className="modal-content">
        <button className="close-btn" onClick={onClose}>&times;</button>

        <div className="modal-header">
          <h2>📥 Redeem Referral Code</h2>
          <p className="modal-subtitle">Have a friend's referral code? Enter it here to get rewards!</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        {success && (
          <div className="success-message">
            ✅ Referral code accepted! Your rewards are being applied...
          </div>
        )}

        <form onSubmit={handleSubmit} className={success ? 'hidden' : ''}>
          <div className="form-group">
            <label htmlFor="code">Referral Code</label>
            <input
              id="code"
              type="text"
              placeholder="Enter referral code (e.g., LINK12345ABC)"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError('');
              }}
              disabled={loading}
              maxLength="20"
            />
            <small>Codes are case-insensitive and found in emails or shared links</small>
          </div>

          <div className="info-box">
            <p>💡 By redeeming this code, both you and your friend will receive:</p>
            <ul>
              <li>💎 7 extra days of premium access</li>
              <li>⭐ 5 bonus superlikes</li>
            </ul>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-redeem"
              disabled={loading || !code.trim()}
            >
              {loading ? '⏳ Redeeming...' : '✨ Redeem Code'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReferralRedeemModal;
