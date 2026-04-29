import { useState, useCallback, useEffect } from 'react';

/**
 * useEventDetails Hook
 * Manages event details state and operations
 * Provides event data for profile display
 */
const useEventDetails = () => {
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [eventStats, setEventStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch upcoming events for user
  const fetchUpcomingEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // In a real app, this would call an API endpoint
      // For now, we're using mock data
      const mockEvents = [
        {
          id: 1,
          name: 'Coffee Meetup',
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          location: 'Kochi, Kerala',
          attendees: 5,
          category: 'Coffee',
          rating: 4.5
        },
        {
          id: 2,
          name: 'Weekend Hike',
          date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          location: 'Munnar, Kerala',
          attendees: 12,
          category: 'Adventure',
          rating: 4.8
        }
      ];

      setUpcomingEvents(mockEvents);

      // Calculate event stats
      const stats = {
        totalEvents: mockEvents.length,
        totalAttendees: mockEvents.reduce((sum, e) => sum + e.attendees, 0),
        averageRating: (mockEvents.reduce((sum, e) => sum + e.rating, 0) / mockEvents.length).toFixed(1),
        nextEventDate: mockEvents.length > 0 ? mockEvents[0].date : null
      };

      setEventStats(stats);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err.message || 'Failed to fetch events');
      setUpcomingEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    fetchUpcomingEvents();
  }, [fetchUpcomingEvents]);

  // Derived stats for quick access
  const hasUpcomingEvents = upcomingEvents.length > 0;
  const nextEvent = upcomingEvents.length > 0 ? upcomingEvents[0] : null;
  const totalUpcomingEvents = upcomingEvents.length;
  const totalEventAttendees = eventStats?.totalAttendees || 0;
  const averageEventRating = eventStats?.averageRating || 0;

  return {
    // Data
    upcomingEvents,
    eventStats,
    loading,
    error,

    // Methods
    fetchUpcomingEvents,

    // Derived stats (quick access)
    hasUpcomingEvents,
    nextEvent,
    totalUpcomingEvents,
    totalEventAttendees,
    averageEventRating,

    // Helpers
    isLoading: loading,
    hasError: !!error
  };
};

export default useEventDetails;
