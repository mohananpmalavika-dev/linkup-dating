/**
 * Razorpay Payment Component
 * Handles payment flow for call credits using Razorpay
 */

import React, { useState, useEffect } from 'react';
import { buildApiUrl } from '../utils/api';
import { getStoredAuthToken } from '../utils/auth';
import '../styles/RazorpayPayment.css';

const RazorpayPayment = ({
  isOpen,
  package: creditPackage,
  onClose,
  onSuccess,
  onError
}) => {
  const [loading, setLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Load Razorpay script
  useEffect(() => {
    if (!scriptLoaded && window.Razorpay) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) {
        setScriptLoaded(true);
      }
    };
    script.onerror = () => {
      onError?.('Failed to load Razorpay. Please refresh and try again.');
    };
    document.body.appendChild(script);

    return () => {
      // Don't remove the script as it may be needed for multiple transactions
    };
  }, [scriptLoaded, onError]);

  const handlePaymentClick = async () => {
    if (!creditPackage) return;

    setLoading(true);

    try {
      const authToken = getStoredAuthToken();
      const headers = {
        'Content-Type': 'application/json'
      };
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      // Step 1: Initiate purchase and get order details from backend
      const response = await fetch(buildApiUrl('/calling/wallet/purchase/initiate'), {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          packageId: creditPackage.id
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to initiate payment');
      }

      const {
        orderId,
        amount,
        credits,
        baseCredits,
        bonusCredits,
        key
      } = await response.json();

      // Verify Razorpay is available
      if (!window.Razorpay) {
        throw new Error('Razorpay script not loaded');
      }

      // Get Razorpay key from environment or backend
      const razorpayKey = process.env.REACT_APP_RAZORPAY_KEY_ID || key;
      if (!razorpayKey) {
        throw new Error('Razorpay key not configured');
      }

      // Get user details from localStorage or context
      const userEmail = localStorage.getItem('userEmail') || 'user@example.com';
      const userPhone = localStorage.getItem('userPhone') || '';

      // Step 2: Open Razorpay checkout
      const razorpayOptions = {
        key: razorpayKey,
        amount: amount * 100, // Razorpay expects amount in paise (multiply by 100)
        currency: 'INR',
        name: 'DatingHub Call Credits',
        description: `${baseCredits} Credits${bonusCredits > 0 ? ` + ${bonusCredits} Bonus` : ''}`,
        order_id: orderId,
        prefill: {
          email: userEmail,
          contact: userPhone
        },
        notes: {
          packageId: creditPackage.id,
          packageName: creditPackage.name,
          baseCredits,
          bonusCredits,
          totalCredits: credits
        },
        handler: async (response) => {
          try {
            const authToken = getStoredAuthToken();
            const verifyHeaders = {
              'Content-Type': 'application/json'
            };
            if (authToken) {
              verifyHeaders.Authorization = `Bearer ${authToken}`;
            }

            // Step 3: Verify payment on backend
            const verifyResponse = await fetch(buildApiUrl('/calling/wallet/purchase/verify'), {
              method: 'POST',
              headers: verifyHeaders,
              credentials: 'include',
              body: JSON.stringify({
                orderId,
                paymentId: response.razorpay_payment_id,
                signatureId: response.razorpay_signature,
                credits
              })
            });

            if (!verifyResponse.ok) {
              const error = await verifyResponse.json();
              throw new Error(error.error || 'Payment verification failed');
            }

            const verifyData = await verifyResponse.json();

            // Success!
            onSuccess?.({
              orderId,
              paymentId: response.razorpay_payment_id,
              balance: verifyData.balance,
              creditsAdded: verifyData.creditsAdded
            });

            onClose();
          } catch (error) {
            console.error('Payment verification error:', error);
            onError?.(`Payment verified but credits could not be added: ${error.message}`);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            onClose();
          }
        },
        theme: {
          color: '#102030'
        }
      };

      // Create and open checkout
      const rzp1 = new window.Razorpay(razorpayOptions);
      rzp1.open();
    } catch (error) {
      console.error('Payment initiation error:', error);
      onError?.(error.message || 'Failed to initiate payment');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !creditPackage) return null;

  return (
    <div className="razorpay-modal-overlay" onClick={onClose}>
      <div className="razorpay-modal" onClick={(e) => e.stopPropagation()}>
        <div className="razorpay-modal-header">
          <h2>Purchase Call Credits</h2>
          <button
            className="razorpay-close-btn"
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="razorpay-modal-body">
          <div className="payment-summary">
            <div className="summary-item">
              <span className="summary-label">Package:</span>
              <span className="summary-value">{creditPackage.name}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Base Credits:</span>
              <span className="summary-value">{creditPackage.credits}</span>
            </div>
            {creditPackage.bonus > 0 && (
              <div className="summary-item">
                <span className="summary-label">Bonus Credits:</span>
                <span className="summary-value bonus">+{creditPackage.bonus}</span>
              </div>
            )}
            <div className="summary-item total">
              <span className="summary-label">Total:</span>
              <span className="summary-value">
                {creditPackage.credits + creditPackage.bonus} credits
              </span>
            </div>
            <div className="summary-item price">
              <span className="summary-label">Amount:</span>
              <span className="summary-value">₹{creditPackage.price}</span>
            </div>
          </div>

          <p className="payment-notice">
            You will be redirected to Razorpay to complete the payment securely.
          </p>
        </div>

        <div className="razorpay-modal-footer">
          <button
            className="btn-cancel"
            onClick={onClose}
            type="button"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="btn-pay"
            onClick={handlePaymentClick}
            type="button"
            disabled={loading || !scriptLoaded}
          >
            {loading ? 'Processing...' : `Pay ₹${creditPackage.price}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RazorpayPayment;
