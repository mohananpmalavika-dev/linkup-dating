import React, { useState } from 'react';
import { doubleDateService } from '../services/doubleDateService';
import '../styles/DoubleDateProposal.css';

const DoubleDateProposal = ({ currentMatch, friends, onSuccess, onClose }) => {
  const [formData, setFormData] = useState({
    friendId: '',
    friendMatchId: '',
    proposedDate: '',
    proposedLocation: '',
    proposedActivity: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // Multi-step form

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validation
      if (!formData.friendId || !formData.friendMatchId) {
        throw new Error('Please select both friend and their match');
      }

      const result = await doubleDateService.createRequest(
        currentMatch.id,
        formData.friendId,
        formData.friendMatchId,
        {
          proposedDate: formData.proposedDate,
          proposedLocation: formData.proposedLocation,
          proposedActivity: formData.proposedActivity,
          message: formData.message
        }
      );

      if (result.success) {
        onSuccess(result);
        onClose();
      } else {
        setError(result.message || 'Failed to create request');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="double-date-proposal modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Propose Double Date</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <div className="form-step">
              <h3>Select Your Friend & Their Match</h3>

              <div className="form-group">
                <label>Friend</label>
                <select
                  name="friendId"
                  value={formData.friendId}
                  onChange={handleChange}
                  required
                >
                  <option value="">Choose a friend...</option>
                  {friends && friends.map(friend => (
                    <option key={friend.id} value={friend.id}>
                      {friend.firstName} {friend.lastName}
                    </option>
                  ))}
                </select>
              </div>

              {formData.friendId && (
                <div className="form-group">
                  <label>Their Match (if available)</label>
                  <select
                    name="friendMatchId"
                    value={formData.friendMatchId}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Loading matches...</option>
                    {/* This would be populated with friend's matches from parent */}
                  </select>
                  <small>Ask your friend who they're matched with!</small>
                </div>
              )}

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setStep(2)}
                  disabled={!formData.friendId || !formData.friendMatchId}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="form-step">
              <h3>Plan Your Double Date</h3>

              <div className="form-group">
                <label>Proposed Date</label>
                <input
                  type="datetime-local"
                  name="proposedDate"
                  value={formData.proposedDate}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  name="proposedLocation"
                  placeholder="Restaurant, park, etc."
                  value={formData.proposedLocation}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Activity</label>
                <select
                  name="proposedActivity"
                  value={formData.proposedActivity}
                  onChange={handleChange}
                >
                  <option value="">Select activity...</option>
                  <option value="dinner">Dinner</option>
                  <option value="drinks">Drinks</option>
                  <option value="movie">Movie</option>
                  <option value="concert">Concert</option>
                  <option value="hiking">Hiking</option>
                  <option value="game_night">Game Night</option>
                  <option value="cooking">Cooking Together</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Personal Message (Optional)</label>
                <textarea
                  name="message"
                  placeholder="Add a personal note about why you think this would be fun..."
                  value={formData.message}
                  onChange={handleChange}
                  rows={3}
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setStep(1)}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Proposing...' : 'Propose Date'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default DoubleDateProposal;
