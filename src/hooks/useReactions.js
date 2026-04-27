/**
 * Custom React Hooks for Message Reactions and Streaks
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import io from 'socket.io-client';

/**
 * useMessageReactions Hook
 * Manages reactions for a specific message
 */
export const useMessageReactions = (messageId, matchId) => {
  const [reactions, setReactions] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    socketRef.current = io(process.env.REACT_APP_API_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  // Fetch initial reactions
  useEffect(() => {
    const fetchReactions = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/messages/${messageId}/reactions`);
        const data = await response.json();
        if (data.success) {
          setReactions(data.reactions);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchReactions();

    // Listen for real-time reaction updates
    socketRef.current?.on('message_reaction_added', (data) => {
      if (data.messageId === messageId) {
        setReactions(data.reactions);
      }
    });

    socketRef.current?.on('message_reaction_removed', (data) => {
      if (data.messageId === messageId) {
        setReactions(data.reactions);
      }
    });

    return () => {
      socketRef.current?.off('message_reaction_added');
      socketRef.current?.off('message_reaction_removed');
    };
  }, [messageId]);

  const addEmojiReaction = useCallback(async (emoji) => {
    try {
      const response = await fetch(`/api/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji })
      });
      const data = await response.json();
      if (data.success) {
        socketRef.current?.emit('emoji_reaction_added', {
          messageId,
          emoji,
          matchId
        });
      }
      return data;
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, [messageId, matchId]);

  const addCustomReaction = useCallback(async (photoUrl, photoId, displayName) => {
    try {
      const response = await fetch(`/api/messages/${messageId}/custom-reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl, photoId, displayName })
      });
      const data = await response.json();
      if (data.success) {
        socketRef.current?.emit('custom_reaction_added', {
          messageId,
          photoUrl,
          photoId,
          displayName,
          matchId
        });
      }
      return data;
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, [messageId, matchId]);

  const removeReaction = useCallback(async (emoji) => {
    try {
      const response = await fetch(
        `/api/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
        { method: 'DELETE' }
      );
      const data = await response.json();
      if (data.success) {
        socketRef.current?.emit('reaction_removed', {
          messageId,
          emoji,
          matchId
        });
      }
      return data;
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, [messageId, matchId]);

  return {
    reactions,
    loading,
    error,
    addEmojiReaction,
    addCustomReaction,
    removeReaction
  };
};

/**
 * useStreak Hook
 * Gets streak information for a match
 */
export const useStreak = (matchId) => {
  const [streak, setStreak] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = io(process.env.REACT_APP_API_URL);
  }, []);

  useEffect(() => {
    const fetchStreak = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/matches/${matchId}/streak`);
        const data = await response.json();
        if (data.success) {
          setStreak(data.streak);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStreak();

    // Listen for streak updates
    socketRef.current?.on('streak_milestone_3days', (data) => {
      if (data.matchId === matchId) {
        setStreak(prev => ({ ...prev, ...data.streak }));
      }
    });

    socketRef.current?.on('streak_milestone_7days', (data) => {
      if (data.matchId === matchId) {
        setStreak(prev => ({ ...prev, ...data.streak }));
      }
    });

    socketRef.current?.on('streak_milestone_30days', (data) => {
      if (data.matchId === matchId) {
        setStreak(prev => ({ ...prev, ...data.streak }));
      }
    });

    return () => {
      socketRef.current?.off('streak_milestone_3days');
      socketRef.current?.off('streak_milestone_7days');
      socketRef.current?.off('streak_milestone_30days');
    };
  }, [matchId]);

  return { streak, loading, error };
};

/**
 * useEngagementScore Hook
 * Gets engagement score for a match
 */
export const useEngagementScore = (matchId) => {
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = io(process.env.REACT_APP_API_URL);
  }, []);

  useEffect(() => {
    const fetchScore = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/matches/${matchId}/engagement-score`);
        const data = await response.json();
        if (data.success) {
          setScore(data.engagementScore);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchScore();

    // Listen for score updates
    socketRef.current?.on('engagement_score_updated', (data) => {
      if (data.matchId === matchId) {
        setScore(data.engagementScore);
      }
    });

    return () => {
      socketRef.current?.off('engagement_score_updated');
    };
  }, [matchId]);

  return { score, loading, error };
};

/**
 * useSuggestedReactions Hook
 * Gets suggested reactions based on user history
 */
export const useSuggestedReactions = (matchId, userId) => {
  const [suggestions, setSuggestions] = useState(['👍', '❤️', '😂', '🔥']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/reactions/suggested/${matchId}`);
        const data = await response.json();
        if (data.success) {
          setSuggestions(data.reactions);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, [matchId]);

  return { suggestions, loading, error };
};

/**
 * useActiveStreaks Hook
 * Gets all active streaks for the current user
 */
export const useActiveStreaks = () => {
  const [streaks, setStreaks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStreaks = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/streaks/active-streaks');
        const data = await response.json();
        if (data.success) {
          setStreaks(data.streaks);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStreaks();

    // Refresh every 5 minutes
    const interval = setInterval(fetchStreaks, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return { streaks, loading, error };
};

/**
 * useTopReactions Hook
 * Gets most popular reactions in a match conversation
 */
export const useTopReactions = (matchId, limit = 5) => {
  const [topReactions, setTopReactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTopReactions = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/matches/${matchId}/top-reactions?limit=${limit}`);
        const data = await response.json();
        if (data.success) {
          setTopReactions(data.reactions);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTopReactions();
  }, [matchId, limit]);

  return { topReactions, loading, error };
};
