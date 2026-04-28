import React, { useState, useEffect } from 'react';
import { doubleDateService } from '../services/doubleDateService';
import '../styles/FriendVerification.css';

const FriendVerification = ({ userId }) => {
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('shared-with-me'); // 'shared-with-me' or 'share'
  const [shareModal, setShareModal] = useState(false);
  const [friendsList, setFriendsList] = useState([]);
  const [shareData, setShareData] = useState({
    matchId: '',
    friendId: ''
  });

  useEffect(() => {
    if (tab === 'shared-with-me') {
      loadVerifications();
    }
  }, [tab]);

  const loadVerifications = async () => {
    try {
      setLoading(true);
      const result = await doubleDateService.getFriendVerifications();
      if (result.success) {
        setVerifications(result.verifications);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (verificationId, feedback) => {
    try {
      const result = await doubleDateService.respondToVerification(
        verificationId,
        true,
        feedback
      );

      if (result.success) {
        loadVerifications();
        alert('✅ ' + result.message);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleReject = async (verificationId) => {
    if (!window.confirm('Are you sure? You can provide feedback.')) return;

    try {
      const result = await doubleDateService.respondToVerification(
        verificationId,
        false,
        'Not interested'
      );

      if (result.success) {
        loadVerifications();
        alert('✅ ' + result.message);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleShare = async () => {
    if (!shareData.matchId || !shareData.friendId) {
      alert('Please select both match and friend');
      return;
    }

    try {
      const result = await doubleDateService.enableFriendVerification(
        shareData.matchId,
        shareData.friendId
      );

      if (result.success) {
        alert('✅ ' + result.message);
        setShareModal(false);
        setShareData({ matchId: '', friendId: '' });
      } else {
        alert('❌ ' + result.message);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="friend-verification">
      <h3>Friend Verification</h3>

      <div className="tabs">
        <button
          className={`tab ${tab === 'shared-with-me' ? 'active' : ''}`}
          onClick={() => setTab('shared-with-me')}
        >
          👥 Shared With Me ({verifications.length})
        </button>
        <button
          className={`tab ${tab === 'share' ? 'active' : ''}`}
          onClick={() => setTab('share')}
        >
          📤 Share My Matches
        </button>
      </div>

      {tab === 'shared-with-me' && (
        <div className="shared-with-me-tab">
          {loading && <div className="loading">Loading...</div>}
          {error && <div className="error">{error}</div>}

          {verifications.length === 0 && !loading && (
            <div className="empty-state">
              <p>No matches shared with you yet</p>
              <small>Friends can share their matches for your opinion!</small>
            </div>
          )}

          <div className="verifications-list">
            {verifications.map(v => (
              <div key={v.id} className={`verification-card status-${v.verificationStatus}`}>
                <div className="shared-header">
                  <div className="shared-by">
                    {v.sharedByUser.photo && (
                      <img
                        src={v.sharedByUser.photo}
                        alt={v.sharedByUser.name}
                        className="avatar"
                      />
                    )}
                    <p className="shared-text">
                      <strong>{v.sharedByUser.name}</strong> shared their match
                    </p>
                  </div>
                </div>

                <div className="match-preview">
                  <div className="match-user">
                    {v.match.user1.photo && (
                      <img src={v.match.user1.photo} alt={v.match.user1.name} />
                    )}
                    <p>{v.match.user1.name}</p>
                  </div>
                  <span className="separator">+</span>
                  <div className="match-user">
                    {v.match.user2.photo && (
                      <img src={v.match.user2.photo} alt={v.match.user2.name} />
                    )}
                    <p>{v.match.user2.name}</p>
                  </div>
                </div>

                {v.verificationStatus === 'pending_approval' ? (
                  <div className="verification-actions">
                    <button
                      className="btn-approve"
                      onClick={() => handleApprove(v.id, 'Looks great! Good match!')}
                    >
                      👍 Approve
                    </button>
                    <button
                      className="btn-reject"
                      onClick={() => handleReject(v.id)}
                    >
                      👎 Pass
                    </button>
                  </div>
                ) : (
                  <div className="status-indicator">
                    {v.verificationStatus === 'approved' && (
                      <p className="approved">✅ You approved this match</p>
                    )}
                    {v.verificationStatus === 'rejected' && (
                      <p className="rejected">❌ You passed on this match</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'share' && (
        <div className="share-tab">
          <p className="info">
            💡 Share your matches with friends to get their opinion. They can help validate if this person is right for you!
          </p>

          <button
            className="btn-primary"
            onClick={() => setShareModal(true)}
          >
            + Share a Match
          </button>

          {shareModal && (
            <div className="modal-overlay">
              <div className="share-modal">
                <h4>Share Your Match with a Friend</h4>

                <div className="form-group">
                  <label>Select Match to Share</label>
                  <select
                    value={shareData.matchId}
                    onChange={(e) => setShareData({ ...shareData, matchId: e.target.value })}
                  >
                    <option value="">Choose a match...</option>
                    {/* This would be populated from currentMatches prop */}
                  </select>
                </div>

                <div className="form-group">
                  <label>Share With Friend</label>
                  <select
                    value={shareData.friendId}
                    onChange={(e) => setShareData({ ...shareData, friendId: e.target.value })}
                  >
                    <option value="">Choose friend...</option>
                    {/* This would be populated from friends prop */}
                  </select>
                </div>

                <div className="modal-actions">
                  <button
                    className="btn-cancel"
                    onClick={() => setShareModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-submit"
                    onClick={handleShare}
                  >
                    Share Match
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FriendVerification;
