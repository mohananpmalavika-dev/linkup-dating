/**
 * Calling Dashboard - FRND-style paid calling interface
 * Users can buy credits and make/receive voice/video calls
 */

import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import callWalletService from '../services/callWalletService';
import '../styles/CallingDashboard.css';

const CREDIT_PACKAGES = [
  { id: 'starter', name: 'Starter', credits: 50, price: 50, bonus: 0 },
  { id: 'basic', name: 'Basic', credits: 100, price: 95, bonus: 5 },
  { id: 'popular', name: 'Popular', credits: 250, price: 225, bonus: 25 },
  { id: 'pro', name: 'Pro', credits: 500, price: 425, bonus: 75 },
  { id: 'premium', name: 'Premium', credits: 1000, price: 800, bonus: 200 }
];

const CallDashboard = () => {
  const { currentUser, apiCall } = useApp();
  const [balance, setBalance] = useState(0);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [callingUsers, setCallingUsers] = useState([]);
  const [loadingMarket, setLoadingMarket] = useState(false);
  const [callModal, setCallModal] = useState(null);
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    loadBalance();
    loadCallingMarket();
  }, []);

  const loadBalance = async () => {
    setLoadingBalance(true);
    try {
      const data = await callWalletService.getBalance();
      setBalance(data.balance || 0);
    } catch (error) {
      console.error('Failed to load balance:', error);
    } finally {
      setLoadingBalance(false);
    }
  };

  const loadCallingMarket = async () => {
    setLoadingMarket(true);
    try {
      const data = await apiCall('/calling/market', 'GET');
      setCallingUsers(data.users || []);
    } catch (error) {
      console.error('Failed to load market:', error);
    } finally {
      setLoadingMarket(false);
    }
  };

  const handlePurchase = async (pkg) => {
    if (!currentUser) return;
    setSelectedPackage(pkg);
    setPurchasing(true);
    setPurchaseSuccess(false);

    try {
      // Step 1: Initiate purchase
      const initiate = await callWalletService.initiatePurchase(pkg.id);
      if (initiate.checkoutUrl) {
        // In production, redirect to payment checkout
        // window.location.href = initiate.checkoutUrl;
        console.log('Would redirect to payment:', initiate.checkoutUrl);
        alert(`Payment gateway integration needed for ${pkg.price} INR`);
      }
    } catch (error) {
      console.error('Purchase failed:', error);
    } finally {
      setPurchasing(false);
    }
  };

  const handleStartCall = async (user) => {
    if (!user || balance < 5) {
      alert('Insufficient credits. Please purchase credits first.');
      return;
    }

    setCallModal(user);
    setCalling(true);

    try {
      // Deduct initial credits (first minute estimate)
      const deduct = await callWalletService.deductCredits(null, 5, 'voice');
      if (deduct.success) {
        // Navigate to call interface
        console.log('Starting call with:', user.name);
        // In production, open call interface
        alert(`Starting call with ${user.name}...`);
      }
    } catch (error) {
      console.error('Failed to start call:', error);
    } finally {
      setCalling(false);
      setCallModal(null);
    }
  };

  return (
    <div className="calling-dashboard">
      <div className="calling-header">
        <h1>📞 FRND Calling</h1>
        <p>Make friends through voice and video calls</p>
      </div>

      {/* Balance Card */}
      <div className="balance-card">
        <div className="balance-info">
          <span className="balance-label">Your Credits</span>
          {loadingBalance ? (
            <span className="balance-amount">Loading...</span>
          ) : (
            <span className="balance-amount">{balance} credits</span>
          )}
        </div>
        <button 
          className="btn-reload"
          onClick={() => document.getElementById('credits-section')?.scrollIntoView({ behavior: 'smooth' })}
        >
          Reload Credits
        </button>
      </div>

      {/* Credit Packages */}
      <section id="credits-section" className="credits-section">
        <h2>Buy Credits</h2>
        <div className="packages-grid">
          {CREDIT_PACKAGES.map((pkg) => (
            <div 
              key={pkg.id} 
              className={`package-card ${selectedPackage?.id === pkg.id ? 'selected' : ''}`}
              onClick={() => handlePurchase(pkg)}
            >
              <div className="package-badge">{pkg.name}</div>
              <div className="package-credits">{pkg.credits + pkg.bonus} credits</div>
              {pkg.bonus > 0 && (
                <div className="package-bonus">+{pkg.bonus} bonus</div>
              )}
              <div className="package-price">₹{pkg.price}</div>
              <button 
                className="btn-buy-package"
                onClick={(e) => { e.stopPropagation(); handlePurchase(pkg); }}
                disabled={purchasing}
              >
                {purchasing && selectedPackage?.id === pkg.id ? 'Processing...' : 'Buy Now'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Calling Market */}
      <section className="market-section">
        <h2>People Ready to Talk</h2>
        <p className="market-hint">Browse profiles and start a call with someone interesting</p>
        
        {loadingMarket ? (
          <div className="loading-market">Loading available callers...</div>
        ) : callingUsers.length === 0 ? (
          <div className="empty-market">
            <p>No callers available right now.</p>
            <p>Check back soon or be the first to go live!</p>
          </div>
        ) : (
          <div className="callers-list">
            {callingUsers.map((user) => (
              <div key={user.id} className="caller-card">
                <div className="caller-avatar">
                  {user.photoUrl ? (
                    <img src={user.photoUrl} alt={user.name} />
                  ) : (
                    <span>{user.name?.charAt(0) || '?'}</span>
                  )}
                </div>
                <div className="caller-info">
                  <h3>{user.name}</h3>
                  <p className="caller-bio">{user.bio || 'Looking to chat!'}</p>
                  <div className="caller-tags">
                    <span className="caller-rate">₹{user.voiceRate}/min</span>
                    {user.interests?.slice(0, 2).map((tag, i) => (
                      <span key={i} className="caller-tag">{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="caller-actions">
                  <button 
                    className="btn-voice-call"
                    onClick={() => handleStartCall(user)}
                    disabled={balance < 5}
                    title={`Start voice call (${user.voiceRate}/min)`}
                  >
                    📞 Call
                  </button>
                  <button 
                    className="btn-video-call"
                    onClick={() => handleStartCall({ ...user, callType: 'video' })}
                    disabled={balance < 10}
                    title={`Start video call (${user.videoRate}/min)`}
                  >
                    📹 Video
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button className="btn-go-live" onClick={() => alert('Go Live feature coming soon!')}>
          🎤 Become a Caller - Earn Credits
        </button>
      </section>

      {/* Pricing Info */}
      <section className="pricing-section">
        <h2>How It Works</h2>
        <div className="pricing-steps">
          <div className="pricing-step">
            <span className="step-number">1</span>
            <h3>Buy Credits</h3>
            <p>Choose a package that fits your budget</p>
          </div>
          <div className="pricing-step">
            <span className="step-number">2</span>
            <h3>Browse Callers</h3>
            <p>Find interesting people to chat with</p>
          </div>
          <div className="pricing-step">
            <span className="step-number">3</span>
            <h3>Start a Call</h3>
            <p>Voice or video - credits are deducted per minute</p>
          </div>
          <div className="pricing-step">
            <span className="step-number">4</span>
            <h3>Earn as a Caller</h3>
            <p>Go live and earn credits when others call you</p>
          </div>
        </div>
        <div className="pricing-rates">
          <h3>Current Rates</h3>
          <p>Voice: ₹5/min | Video: ₹10/min</p>
          <p>Callers earn 70% of each call</p>
        </div>
      </section>
    </div>
  );
};

export default CallDashboard;
