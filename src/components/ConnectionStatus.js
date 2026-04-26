/**
 * ConnectionStatus Component
 * Displays connection health and latency
 */
import React from 'react';
import { useConnectionHealth } from '../hooks/useRealTime';
import './ConnectionStatus.css';

const ConnectionStatus = ({ showLatency = true, compact = false }) => {
  const { connected, latency, lastCheck } = useConnectionHealth();

  const getLatencyColor = () => {
    if (!latency) return 'unknown';
    if (latency < 50) return 'excellent';
    if (latency < 100) return 'good';
    if (latency < 200) return 'fair';
    return 'poor';
  };

  const getLatencyLabel = () => {
    if (!latency) return 'N/A';
    if (latency < 50) return 'Excellent';
    if (latency < 100) return 'Good';
    if (latency < 200) return 'Fair';
    return 'Poor';
  };

  if (compact) {
    return (
      <div className={`connection-status-compact ${connected ? 'connected' : 'disconnected'}`}>
        <span className="status-dot" />
        {showLatency && latency && (
          <span className="latency">{latency}ms</span>
        )}
      </div>
    );
  }

  return (
    <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
      <div className="status-content">
        <div className="status-header">
          <span className="status-dot" />
          <span className="status-text">
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {showLatency && (
          <div className="latency-info">
            <span className={`latency-value ${getLatencyColor()}`}>
              {latency ? `${latency}ms` : 'Checking...'}
            </span>
            <span className="latency-label">{getLatencyLabel()}</span>
          </div>
        )}

        {lastCheck && (
          <div className="last-check">
            Last checked: {lastCheck.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectionStatus;
