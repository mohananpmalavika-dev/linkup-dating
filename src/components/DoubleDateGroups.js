import React, { useState, useEffect } from 'react';
import { doubleDateService } from '../services/doubleDateService';
import '../styles/DoubleDateGroups.css';

const DoubleDateGroups = ({ userId, onOpenChat }) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [ratingModal, setRatingModal] = useState(null);
  const [ratings, setRatings] = useState({
    overallRating: 5,
    ratingForUser2: 5,
    ratingForFriend1: 5,
    ratingForFriend2: 5,
    review: '',
    wouldDoAgain: true
  });

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const result = await doubleDateService.getActiveGroups();
      if (result.success) {
        setGroups(result.groups);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkCompleted = async (groupId) => {
    try {
      const result = await doubleDateService.markCompleted(groupId);
      if (result.success) {
        // Update group status
        setGroups(groups.map(g =>
          g.id === groupId ? { ...g, status: 'completed' } : g
        ));
        alert('✅ Double date marked as completed!');
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleOpenRating = (group) => {
    setSelectedGroup(group);
    setRatingModal(true);
    setRatings({
      overallRating: 5,
      ratingForUser2: 5,
      ratingForFriend1: 5,
      ratingForFriend2: 5,
      review: '',
      wouldDoAgain: true
    });
  };

  const handleSubmitRating = async () => {
    try {
      const result = await doubleDateService.rateDoubleDate(selectedGroup.id, ratings);
      if (result.success) {
        alert(`✅ Thanks for rating! Group average: ${result.groupAverageRating}⭐`);
        setRatingModal(null);
        setSelectedGroup(null);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  if (loading) return <div className="loading">Loading your double dates...</div>;

  return (
    <div className="double-date-groups">
      <h3>My Double Dates</h3>

      {error && <div className="error">{error}</div>}

      {groups.length === 0 ? (
        <div className="no-groups">
          <p>No active double dates yet. Propose one with friends!</p>
        </div>
      ) : (
        <div className="groups-container">
          {groups.map(group => (
            <div key={group.id} className={`group-card status-${group.status}`}>
              <div className="group-header">
                <h4>{group.activity || 'Double Date'}</h4>
                <span className={`status-badge ${group.status}`}>
                  {group.status.toUpperCase()}
                </span>
              </div>

              <div className="participants">
                <h5>Participants</h5>
                <div className="avatars">
                  {group.participants.map((p, idx) => (
                    <div key={idx} className="avatar" title={p.name}>
                      {p.photo ? (
                        <img src={p.photo} alt={p.name} />
                      ) : (
                        <div className="avatar-initial">{p.name.charAt(0)}</div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="participant-names">
                  {group.participants.map(p => p.name).join(' • ')}
                </p>
              </div>

              <div className="details">
                {group.scheduledDate && (
                  <p>
                    <span className="icon">📅</span>
                    {new Date(group.scheduledDate).toLocaleDateString()}
                  </p>
                )}
                {group.location && (
                  <p>
                    <span className="icon">📍</span>
                    {group.location}
                  </p>
                )}
              </div>

              <div className="group-actions">
                {group.chatroomId && (
                  <button
                    className="btn-chat"
                    onClick={() => onOpenChat(group.chatroomId)}
                  >
                    💬 Group Chat
                  </button>
                )}

                {group.status === 'scheduled' && (
                  <button
                    className="btn-complete"
                    onClick={() => handleMarkCompleted(group.id)}
                  >
                    ✓ Mark Completed
                  </button>
                )}

                {group.status === 'completed' && (
                  <button
                    className="btn-rate"
                    onClick={() => handleOpenRating(group)}
                  >
                    ⭐ Rate Experience
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rating Modal */}
      {ratingModal && selectedGroup && (
        <div className="modal-overlay">
          <div className="rating-modal">
            <h3>Rate Your Double Date Experience</h3>

            <div className="rating-group">
              <label>Overall Experience</label>
              <div className="star-rating">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    className={`star ${ratings.overallRating >= star ? 'active' : ''}`}
                    onClick={() => setRatings({ ...ratings, overallRating: star })}
                  >
                    ⭐
                  </button>
                ))}
              </div>
              <span className="rating-value">{ratings.overallRating}/5</span>
            </div>

            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={ratings.wouldDoAgain}
                  onChange={(e) => setRatings({ ...ratings, wouldDoAgain: e.target.checked })}
                />
                I'd do this again
              </label>
            </div>

            <div className="textarea-group">
              <label>Review (Optional)</label>
              <textarea
                placeholder="Share your thoughts about the experience..."
                value={ratings.review}
                onChange={(e) => setRatings({ ...ratings, review: e.target.value })}
                rows={3}
              />
            </div>

            <p className="note">
              Your rating helps improve future match suggestions!
            </p>

            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={() => setRatingModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn-submit"
                onClick={handleSubmitRating}
              >
                Submit Rating
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoubleDateGroups;
