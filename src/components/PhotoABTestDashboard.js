import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/PhotoABTestDashboard.css';

const PhotoABTestDashboard = ({ onSelectTest }) => {
  const [tests, setTests] = useState([]);
  const [activeTests, setActiveTests] = useState([]);
  const [completedTests, setCompletedTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('active');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTests();
    const interval = setInterval(fetchTests, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchTests = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/photo-ab-testing/user/all`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const allTests = response.data.tests;
      setTests(allTests);

      // Separate by status
      setActiveTests(allTests.filter(t => t.status === 'active'));
      setCompletedTests(allTests.filter(t => t.status === 'completed'));
    } catch (err) {
      setError('Failed to load tests');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePauseTest = async (testId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${process.env.REACT_APP_API_URL}/api/photo-ab-testing/${testId}/pause`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      fetchTests();
    } catch (err) {
      setError('Failed to pause test');
    }
  };

  const handleResumeTest = async (testId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${process.env.REACT_APP_API_URL}/api/photo-ab-testing/${testId}/resume`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      fetchTests();
    } catch (err) {
      setError('Failed to resume test');
    }
  };

  const handleEndTest = async (testId) => {
    if (window.confirm('End this test now? The winner will be determined.')) {
      try {
        const token = localStorage.getItem('token');
        await axios.put(
          `${process.env.REACT_APP_API_URL}/api/photo-ab-testing/${testId}/end`,
          {},
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        fetchTests();
      } catch (err) {
        setError('Failed to end test');
      }
    }
  };

  const getTimeRemaining = (startedAt, durationHours) => {
    const start = new Date(startedAt);
    const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
    const now = new Date();
    const diff = end - now;

    if (diff <= 0) return 'Completed';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m remaining`;
  };

  const renderTestCard = (test) => (
    <div key={test.id} className="test-card">
      <div className="test-header">
        <div className="test-title-section">
          <h3>{test.testName || `Test #${test.id}`}</h3>
          <span className={`status-badge ${test.status}`}>{test.status}</span>
        </div>
        <p className="test-date">Started {new Date(test.startedAt).toLocaleDateString()}</p>
      </div>

      {/* Metrics Grid */}
      <div className="metrics-grid">
        <div className="metric-item">
          <span className="metric-label">Photo A</span>
          <div className="metric-value">
            <span className="likes-count">{test.likesA} ❤️</span>
            <span className="engagement">{test.engagementA.toFixed(1)}% engagement</span>
          </div>
        </div>

        <div className="metric-divider">vs</div>

        <div className="metric-item">
          <span className="metric-label">Photo B</span>
          <div className="metric-value">
            <span className="likes-count">{test.likesB} ❤️</span>
            <span className="engagement">{test.engagementB.toFixed(1)}% engagement</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {test.status === 'active' && (
        <div className="progress-section">
          <div className="time-remaining">
            ⏱️ {getTimeRemaining(test.startedAt, test.testDurationHours)}
          </div>
          <div className="progress-bar">
            <div className="progress-fill"></div>
          </div>
        </div>
      )}

      {/* Winner Display */}
      {test.winner && (
        <div className={`winner-section winner-${test.winner}`}>
          <span className="winner-badge">🏆 Winner: Photo {test.winner}</span>
          <span className="win-margin">
            {test.winMargin.toFixed(1)}% better engagement
          </span>
        </div>
      )}

      {/* Auto-Promoted Badge */}
      {test.autoPromoted && (
        <div className="auto-promoted-badge">
          ✨ Auto-promoted to position 1
        </div>
      )}

      {/* Actions */}
      <div className="test-actions">
        <button
          className="action-button primary"
          onClick={() => onSelectTest && onSelectTest(test.id)}
        >
          📊 View Details
        </button>

        {test.status === 'active' && (
          <>
            <button
              className="action-button secondary"
              onClick={() => handlePauseTest(test.id)}
            >
              ⏸️ Pause
            </button>
            <button
              className="action-button danger"
              onClick={() => handleEndTest(test.id)}
            >
              🏁 End Now
            </button>
          </>
        )}

        {test.status === 'paused' && (
          <button
            className="action-button primary"
            onClick={() => handleResumeTest(test.id)}
          >
            ▶️ Resume
          </button>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="photo-ab-test-dashboard loading">
        <div className="spinner-container">
          <div className="spinner"></div>
          <p>Loading your tests...</p>
        </div>
      </div>
    );
  }

  const displayTests = selectedTab === 'active' ? activeTests : completedTests;

  return (
    <div className="photo-ab-test-dashboard">
      <h2>Photo A/B Testing Dashboard</h2>

      {error && <div className="error-message">{error}</div>}

      {/* Tab Selector */}
      <div className="tab-selector">
        <button
          className={`tab-button ${selectedTab === 'active' ? 'active' : ''}`}
          onClick={() => setSelectedTab('active')}
        >
          🔴 Active ({activeTests.length})
        </button>
        <button
          className={`tab-button ${selectedTab === 'completed' ? 'active' : ''}`}
          onClick={() => setSelectedTab('completed')}
        >
          ✅ Completed ({completedTests.length})
        </button>
      </div>

      {/* Tests List */}
      <div className="tests-container">
        {displayTests.length === 0 ? (
          <div className="empty-state">
            <p>
              {selectedTab === 'active'
                ? 'No active tests. Create one to get started!'
                : 'No completed tests yet.'}
            </p>
          </div>
        ) : (
          <div className="tests-grid">
            {displayTests.map(renderTestCard)}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {tests.length > 0 && (
        <div className="summary-stats">
          <div className="stat">
            <span className="stat-value">{activeTests.length}</span>
            <span className="stat-label">Active Tests</span>
          </div>
          <div className="stat">
            <span className="stat-value">{completedTests.length}</span>
            <span className="stat-label">Completed Tests</span>
          </div>
          <div className="stat">
            <span className="stat-value">{tests.length}</span>
            <span className="stat-label">Total Tests</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoABTestDashboard;
