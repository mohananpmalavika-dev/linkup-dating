/**
 * LeaderboardDisplay Component
 * Shows ranked achievements leaderboards (Most Active, Best Conversation Starters)
 */

import React, { useState, useEffect } from 'react';
import './LeaderboardDisplay.css';

const LeaderboardDisplay = ({ type = 'most_active', city = null, interest = null }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCity, setSelectedCity] = useState(city);
  const [selectedInterest, setSelectedInterest] = useState(interest);
  const [userRank, setUserRank] = useState(null);
  const [cities, setCities] = useState([]);
  const [interests, setInterests] = useState([]);

  useEffect(() => {
    fetchLeaderboard();
    loadFilters();
  }, [type, selectedCity, selectedInterest]);

  const loadFilters = async () => {
    try {
      const response = await fetch('/api/filters');
      const data = await response.json();
      if (data.cities) setCities(data.cities);
      if (data.interests) setInterests(data.interests);
    } catch (err) {
      console.error('Error loading filters:', err);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      let url = '';

      if (type === 'conversation_starters') {
        url = '/api/leaderboards/conversation-starters?limit=50';
      } else if (selectedCity) {
        url = `/api/leaderboards/city/${selectedCity}?limit=50`;
      } else if (selectedInterest) {
        url = `/api/leaderboards/interest/${selectedInterest}?limit=50`;
      } else {
        url = '/api/leaderboards/city/global?limit=50';
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setLeaderboard(data.leaderboard || []);
      }
    } catch (err) {
      setError('Failed to load leaderboard');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getRankBadge = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank;
  };

  const handleVote = async (userId) => {
    try {
      const response = await fetch('/api/leaderboards/vote-conversation-starter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ votedForUserId: userId })
      });

      const data = await response.json();
      if (data.success) {
        fetchLeaderboard();
      }
    } catch (err) {
      console.error('Error voting:', err);
    }
  };

  const leaderboardTitle = {
    most_active: '🔥 Most Active',
    conversation_starters: '💬 Best Conversation Starters'
  };

  return (
    <div className="leaderboard-display">
      <div className="leaderboard-header">
        <h2 className="leaderboard-title">{leaderboardTitle[type]}</h2>

        {type === 'most_active' && (
          <div className="leaderboard-filters">
            {cities.length > 0 && (
              <select
                value={selectedCity || ''}
                onChange={(e) => setSelectedCity(e.target.value || null)}
                className="filter-select"
              >
                <option value="">All Cities</option>
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            )}

            {interests.length > 0 && (
              <select
                value={selectedInterest || ''}
                onChange={(e) => setSelectedInterest(e.target.value || null)}
                className="filter-select"
              >
                <option value="">All Interests</option>
                {interests.map((interest) => (
                  <option key={interest} value={interest}>
                    {interest}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="leaderboard-loading">Loading leaderboard...</div>
      ) : error ? (
        <div className="leaderboard-error">{error}</div>
      ) : leaderboard.length === 0 ? (
        <div className="leaderboard-empty">No entries yet</div>
      ) : (
        <div className="leaderboard-list">
          {leaderboard.map((entry, index) => (
            <div key={entry.user_id || index} className="leaderboard-entry">
              <div className="entry-rank">{getRankBadge(entry.rank)}</div>

              <div className="entry-user">
                {entry.avatar && (
                  <img src={entry.avatar} alt={entry.name} className="entry-avatar" />
                )}
                <div className="entry-info">
                  <div className="entry-name">{entry.name}</div>
                  {entry.city && <div className="entry-detail">📍 {entry.city}</div>}
                  {entry.interest && (
                    <div className="entry-detail">❤️ {entry.interest}</div>
                  )}
                </div>
              </div>

              <div className="entry-score">
                {type === 'conversation_starters' ? (
                  <>
                    <div className="score-value">{entry.vote_count || 0}</div>
                    <div className="score-label">votes</div>
                  </>
                ) : (
                  <>
                    <div className="score-value">{entry.score}</div>
                    <div className="score-label">activity</div>
                  </>
                )}
              </div>

              {type === 'conversation_starters' && (
                <button
                  onClick={() => handleVote(entry.user_id)}
                  className="vote-button"
                  title="Vote for this conversation starter"
                >
                  👍
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LeaderboardDisplay;
