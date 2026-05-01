import React, { useState } from 'react';
import { useNavigate } from '../router';
import CouponRedemption from './CouponRedemption';
import '../styles/FeatureHub.css';

const FEATURE_SECTIONS = [
  {
    id: 'account',
    title: 'Account & Profile',
    features: [
      { key: 'editProfile', label: 'Edit Profile', emoji: 'Me', path: '/profile', description: 'Update your bio, interests, goals, and profile basics.' },
      { key: 'accountSettings', label: 'Account Settings', emoji: 'Set', path: '/account-settings', description: 'Manage privacy, notification, legal, and account controls.' },
      { key: 'subscription', label: 'Subscription', emoji: 'Plan', path: '/subscription', description: 'View or manage your premium plan.' },
      { key: 'coupon', label: 'Redeem Coupon', emoji: 'Code', action: 'coupon', description: 'Apply a coupon or promotional code.' }
    ]
  },
  {
    id: 'social',
    title: 'Social & Events',
    features: [
      { key: 'chatrooms', label: 'Chatrooms', emoji: '💬', path: '/chatrooms', description: 'Browse public chatrooms and reopen rooms you have already joined.' },
      { key: 'lobby', label: 'Lobby Chat', emoji: '🗨️', path: '/lobby', description: 'Jump into the shared public lobby and meet people live.' },
      { key: 'events', label: 'Dating Events', emoji: '🎉', path: '/events', description: 'Browse and join upcoming dating events near you.' },
      { key: 'doubleDates', label: 'Double Dates', emoji: '👯', path: '/double-dates', description: 'Match with other couples for group dates.' },
      { key: 'moments', label: 'Moments (Stories)', emoji: '⏳', path: '/moments', description: 'Share ephemeral photos that disappear in 24 hours.' },
      { key: 'icebreakerVideos', label: 'Icebreaker Videos', emoji: '🎬', path: '/icebreaker-videos', description: 'Record 5-second video intros to show your personality.' }
    ]
  },
  {
    id: 'growth',
    title: 'Profile Growth & Insights',
    features: [
      { key: 'analytics', label: 'Analytics Dashboard', emoji: '📊', path: '/analytics', description: 'See how your profile performs and get recommendations.' },
      { key: 'photoABTesting', label: 'Photo A/B Testing', emoji: '📸', path: '/photo-ab-testing', description: 'Test two photos to see which gets more likes.' },
      { key: 'boost', label: 'Boost Profile', emoji: '🚀', path: '/boost', description: 'Get more visibility for 30 minutes.' },
      { key: 'videoVerification', label: 'Video Verification', emoji: '✅', path: '/video-verification', description: 'Verify your profile with a short video for a trust badge.' }
    ]
  },
  {
    id: 'engagement',
    title: 'Engagement & Gamification',
    features: [
      { key: 'achievements', label: 'Achievements & Badges', emoji: '🏆', path: '/achievements', description: 'Track your milestones and unlock badges.' },
      { key: 'leaderboards', label: 'Leaderboards', emoji: '🥇', path: '/leaderboards', description: 'See top-ranked users in your city and interests.' },
      { key: 'dailyChallenges', label: 'Daily Challenges', emoji: '🎯', path: '/daily-challenges', description: 'Complete daily tasks to earn rewards.' },
      { key: 'streaks', label: 'Streak Tracking', emoji: '🔥', path: '/streaks', description: 'Keep your conversation streaks alive.' }
    ]
  },
  {
    id: 'safety',
    title: 'Safety & Trust',
    features: [
      { key: 'dateSafety', label: 'Date Safety Kit', emoji: '🛡️', path: '/date-safety', description: 'Share your live location and set up safety check-ins.' },
      { key: 'catfishDetection', label: 'Catfish Prevention', emoji: '🎣', path: '/catfish-detection', description: 'Review AI-detected suspicious messages and red flags.' },
      { key: 'preferencesPriority', label: 'Priority Preferences', emoji: '⭐', path: '/preferences-priority', description: 'Manage your dating preferences and priority status.' }
    ]
  },
  {
    id: 'tools',
    title: 'Tools & Utilities',
    features: [
      { key: 'referrals', label: 'Referral Program', emoji: '🎁', path: '/referrals', description: 'Invite friends and earn premium rewards.' },
      { key: 'profileReset', label: 'Profile Reset', emoji: '🔄', path: '/profile-reset', description: 'Start fresh while keeping your account.' },
      { key: 'smartRewind', label: 'Smart Rewind History', emoji: '⏪', path: '/smart-rewind', description: 'Review and restore passed profiles.' },
      { key: 'openingTemplates', label: 'Opening Templates', emoji: '💬', path: '/opening-templates', description: 'AI-powered message suggestions based on mutual interests.' }
    ]
  }
];

const FeatureHub = () => {
  const navigate = useNavigate();
  const [showCoupon, setShowCoupon] = useState(false);

  const handleFeatureClick = (feature) => {
    if (feature.action === 'coupon') {
      setShowCoupon(true);
      return;
    }

    navigate(feature.path);
  };

  return (
    <div className="feature-hub">
      <div className="feature-hub-header">
        <h1>More</h1>
        <p>All features and tools in one place</p>
      </div>

      <div className="feature-hub-grid">
        {FEATURE_SECTIONS.map((section) => (
          <div key={section.id} className="feature-section">
            <h2 className="feature-section-title">{section.title}</h2>
            <div className="feature-cards">
              {section.features.map((feature) => (
                <button
                  key={feature.key}
                  type="button"
                  className="feature-card"
                  onClick={() => handleFeatureClick(feature)}
                >
                  <span className="feature-emoji">{feature.emoji}</span>
                  <div className="feature-card-content">
                    <strong>{feature.label}</strong>
                    <span>{feature.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <CouponRedemption
        isOpen={showCoupon}
        onClose={() => setShowCoupon(false)}
        onRedemptionSuccess={() => setShowCoupon(false)}
      />
    </div>
  );
};

export default FeatureHub;
