/**
 * PriorityStatus Component
 * Displays priority subscription status badge
 */

import React, { useEffect, useState } from 'react';
import usePreferences from '../hooks/usePreferences';
import './PriorityStatus.css';

const PriorityStatus = ({ userId, showDetails = false, onSubscribeClick }) => {
  const { priorityStatus, analytics, loading } = usePreferences();
  const [showTooltip, setShowTooltip] = useState(false);

  if (loading || !priorityStatus) {
    return null;
  }

  // Not subscribed
  if (!priorityStatus.hasSubscription) {
    return (
      <div className="priority-status priority-status-inactive">
        <button
          className="priority-status-btn inactive"
          onClick={onSubscribeClick}
          title="Upgrade to Preferences Priority"
        >
          <span className="icon">⭐</span>
          <span className="text">Priority</span>
        </button>
      </div>
    );
  }

  const subscription = priorityStatus.subscription;

  // Subscription exists but not active
  if (!subscription.isActive) {
    return (
      <div className="priority-status priority-status-expired">
        <div
          className="priority-status-btn expired"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          title="Subscription expired"
        >
          <span className="icon">❌</span>
          <span className="text">Expired</span>
        </div>
        {showTooltip && (
          <div className="tooltip">
            Your subscription expired. Renew to get back in the rotation.
          </div>
        )}
      </div>
    );
  }

  // Active subscription
  return (
    <div className="priority-status priority-status-active">
      <div
        className={`priority-status-btn active ${subscription.currentWeekActive ? 'featured' : ''}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {subscription.currentWeekActive ? (
          <>
            <span className="icon pulse">🌟</span>
            <span className="text">Top Pick</span>
          </>
        ) : (
          <>
            <span className="icon">⭐</span>
            <span className="text">Priority</span>
          </>
        )}
      </div>

      {showTooltip && (
        <div className={`tooltip ${subscription.currentWeekActive ? 'featured' : ''}`}>
          {subscription.currentWeekActive ? (
            <div>
              <strong>🎯 Featured This Week!</strong>
              <p>Your profile is getting top placement in filtered searches.</p>
              {analytics?.thisMonth && (
                <div className="tooltip-stats">
                  <span>{analytics.thisMonth.impressions} impressions</span>
                  <span>{analytics.thisMonth.matches} matches</span>
                </div>
              )}
            </div>
          ) : (
            <div>
              <strong>In Rotation Pool</strong>
              <p>You're eligible for next week's priority placement.</p>
              <small>Rotation updates Monday UTC</small>
            </div>
          )}
        </div>
      )}

      {showDetails && analytics && (
        <div className="priority-details">
          <div className="detail-item">
            <span className="label">Billing Cycle:</span>
            <span className="value">
              {subscription.daysRemaining} days remaining
            </span>
          </div>
          {analytics.thisMonth && (
            <>
              <div className="detail-item">
                <span className="label">Impressions:</span>
                <span className="value">{analytics.thisMonth.impressions}</span>
              </div>
              <div className="detail-item">
                <span className="label">Engagement:</span>
                <span className="value">
                  {analytics.thisMonth.engagementRate}%
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PriorityStatus;
