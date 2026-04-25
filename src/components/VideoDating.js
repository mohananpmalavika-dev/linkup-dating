import React, { useState, useEffect } from 'react';
import '../styles/VideoDating.css';

/**
 * VideoDating Component
 * Video call interface for matched users
 */
const VideoDating = ({ matchedProfile, onEndCall }) => {
  const [callActive, setCallActive] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    if (!callActive) return;

    const interval = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [callActive]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = () => {
    setCallActive(false);
    onEndCall?.(matchedProfile, callDuration);
  };

  if (!callActive) {
    return (
      <div className="call-ended">
        <div className="call-end-content">
          <h2>Call Ended</h2>
          <p>Duration: {formatDuration(callDuration)}</p>
          <button onClick={() => window.history.back()} className="btn-back">
            Back to Matches
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="video-dating-container">
      {/* Main Video Area */}
      <div className="video-main">
        {/* Remote Video */}
        <div className="remote-video">
          <div className="video-placeholder">
            {matchedProfile?.photos?.[0] ? (
              <img src={matchedProfile.photos[0]} alt={matchedProfile.firstName} />
            ) : (
              <span>📹</span>
            )}
          </div>
          <div className="remote-info">
            <h3>{matchedProfile?.firstName}</h3>
            <p className="online-indicator">●  Connected</p>
          </div>
        </div>

        {/* Local Video (PiP) */}
        <div className="local-video">
          <div className="video-placeholder">
            <span>📷</span>
          </div>
          <p className="label">You</p>
        </div>
      </div>

      {/* Call Header */}
      <div className="call-header">
        <span className="call-duration">{formatDuration(callDuration)}</span>
      </div>

      {/* Call Controls */}
      <div className="call-controls">
        <button
          className={`control-btn ${isMuted ? 'muted' : ''}`}
          onClick={() => setIsMuted(!isMuted)}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? '🔇' : '🎤'}
        </button>

        <button
          className={`control-btn ${!isVideoOn ? 'off' : ''}`}
          onClick={() => setIsVideoOn(!isVideoOn)}
          title={isVideoOn ? 'Turn off video' : 'Turn on video'}
        >
          {isVideoOn ? '📹' : '📹❌'}
        </button>

        <button
          className="control-btn chat"
          title="Send message"
        >
          💬
        </button>

        <button
          className="control-btn end-call"
          onClick={handleEndCall}
          title="End call"
        >
          📞
        </button>
      </div>
    </div>
  );
};

export default VideoDating;
