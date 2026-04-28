import React, { useState, useEffect } from 'react';
import { doubleDateService } from '../services/doubleDateService';
import '../styles/DoubleDateRequests.css';

const DoubleDateRequests = ({ userId }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const result = await doubleDateService.getPendingRequests();
      if (result.success) {
        setRequests(result.requests);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId) => {
    try {
      setActionLoading(requestId);
      const result = await doubleDateService.approveRequest(requestId);

      if (result.success) {
        // Remove request from list on success
        setRequests(requests.filter(r => r.id !== requestId));

        // Show success message
        if (result.status === 'all_accepted') {
          alert(`✅ All approved! Your double date group has been created!\nGroup Chat ID: ${result.chatroomId}`);
        } else {
          alert(`✅ You approved! Waiting for others to approve.`);
        }
      } else {
        alert(`❌ ${result.message}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId) => {
    if (!window.confirm('Are you sure you want to reject this request?')) return;

    try {
      setActionLoading(requestId);
      const result = await doubleDateService.rejectRequest(requestId);

      if (result.success) {
        setRequests(requests.filter(r => r.id !== requestId));
        alert('Request rejected');
      } else {
        alert(`❌ ${result.message}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="loading">Loading requests...</div>;
  if (error) return <div className="error">{error}</div>;

  if (requests.length === 0) {
    return (
      <div className="no-requests">
        <p>No pending double date requests</p>
      </div>
    );
  }

  return (
    <div className="double-date-requests">
      <h3>Double Date Requests ({requests.length})</h3>

      <div className="requests-list">
        {requests.map(request => (
          <div key={request.id} className="request-card">
            <div className="request-header">
              <h4>Double Date Proposal</h4>
              <span className="request-time">
                {new Date(request.createdAt).toLocaleDateString()}
              </span>
            </div>

            <div className="pair-info">
              <div className="pair">
                <div className="user">
                  {request.pairs.pair1.user1.firstName}
                </div>
                <span className="heart">❤️</span>
                <div className="user">
                  {request.pairs.pair1.user2.firstName}
                </div>
              </div>

              <span className="vs">+</span>

              <div className="pair">
                <div className="user">
                  {request.pairs.pair2.friend1.firstName}
                </div>
                <span className="heart">❤️</span>
                <div className="user">
                  {request.pairs.pair2.friend2.firstName}
                </div>
              </div>
            </div>

            {request.proposedDate && (
              <div className="details">
                <p>
                  <strong>Proposed Date:</strong> {new Date(request.proposedDate).toLocaleDateString()}
                </p>
                {request.proposedLocation && (
                  <p><strong>Location:</strong> {request.proposedLocation}</p>
                )}
                {request.proposedActivity && (
                  <p><strong>Activity:</strong> {request.proposedActivity}</p>
                )}
                {request.message && (
                  <p className="message">
                    <strong>Message:</strong> "{request.message}"
                  </p>
                )}
              </div>
            )}

            <div className="request-actions">
              <button
                className="btn-approve"
                onClick={() => handleApprove(request.id)}
                disabled={actionLoading === request.id}
              >
                {actionLoading === request.id ? '⏳' : '👍'} Approve
              </button>
              <button
                className="btn-reject"
                onClick={() => handleReject(request.id)}
                disabled={actionLoading === request.id}
              >
                {actionLoading === request.id ? '⏳' : '👎'} Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DoubleDateRequests;
