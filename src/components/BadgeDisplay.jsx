/**
 * BadgeDisplay Component
 * Shows user's badges/achievements on their profile
 */

import React, { useState, useEffect } from 'react';
import './BadgeDisplay.css';

const BadgeDisplay = ({ userId, maxBadges = 6, compact = false }) => {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAchievements();
  }, [userId]);

  const fetchAchievements = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/achievements/user/${userId}`);
      const data = await response.json();
      
      if (data.success) {
        const sorted = data.achievements.sort((a, b) => {
          // Featured first, then by rarity
          if (a.is_featured) return -1;
          if (b.is_featured) return 1;
          const rarityOrder = { legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
          return (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0);
        });
        setAchievements(sorted.slice(0, maxBadges));
      }
    } catch (err) {
      setError('Failed to load achievements');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getRarityColor = (rarity) => {
    const colors = {
      legendary: '#FFD700',
      epic: '#9C27F0',
      rare: '#2196F3',
      uncommon: '#4CAF50',
      common: '#999'
    };
    return colors[rarity] || '#999';
  };

  if (loading) {
    return <div className="badge-display loading">Loading achievements...</div>;
  }

  if (error || achievements.length === 0) {
    return null;
  }

  return (
    <div className={`badge-display ${compact ? 'compact' : ''}`}>
      {!compact && <h3 className="badge-title">Achievements</h3>}
      <div className={`badge-container ${compact ? 'compact' : ''}`}>
        {achievements.map((achievement) => (
          <div
            key={achievement.code}
            className={`badge-item rarity-${achievement.rarity} ${
              achievement.is_featured ? 'featured' : ''
            }`}
            title={`${achievement.name} - ${achievement.description}`}
            style={{ borderColor: getRarityColor(achievement.rarity) }}
          >
            <div className="badge-emoji">{achievement.emoji}</div>
            {!compact && (
              <>
                <div className="badge-name">{achievement.name}</div>
                <div className="badge-category">{achievement.category}</div>
              </>
            )}
            {achievement.is_featured && (
              <div className="badge-featured-badge">⭐</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BadgeDisplay;
