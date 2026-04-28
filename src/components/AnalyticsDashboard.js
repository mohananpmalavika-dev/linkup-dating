import React, { useState, useEffect, useCallback } from 'react';
import '../styles/AnalyticsDashboard.css';
import PersonalStatsCard from './PersonalStatsCard';
import ProfilePerformanceCard from './ProfilePerformanceCard';
import MonthlyReportCard from './MonthlyReportCard';
import RecommendationsCard from './RecommendationsCard';
import ProfileComparisonCard from './ProfileComparisonCard';
import analyticsService from '../services/analyticsService';

/**
 * Personal Dating Analytics Dashboard
 * Displays comprehensive analytics about user's dating profile performance
 */
const AnalyticsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardData, setDashboardData] = useState({
    personalStats: null,
    profilePerformance: null,
    recommendations: null,
    comparison: null
  });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1
    };
  });

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [stats, performance, recommendations, comparison] = await Promise.all([
          analyticsService.getPersonalStats(),
          analyticsService.getProfilePerformance(),
          analyticsService.getRecommendations(),
          analyticsService.getProfileComparison()
        ]);

        setDashboardData({
          personalStats: stats,
          profilePerformance: performance,
          recommendations,
          comparison
        });
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load analytics dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handlePreviousMonth = useCallback(() => {
    setSelectedMonth(prev => {
      if (prev.month === 1) {
        return { year: prev.year - 1, month: 12 };
      }
      return { ...prev, month: prev.month - 1 };
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    setSelectedMonth(prev => {
      if (prev.month === 12) {
        return { year: prev.year + 1, month: 1 };
      }
      return { ...prev, month: prev.month + 1 };
    });
  }, []);

  const handleRefresh = useCallback(async () => {
    try {
      setLoading(true);
      const [stats, performance, recommendations, comparison] = await Promise.all([
        analyticsService.getPersonalStats(),
        analyticsService.getProfilePerformance(),
        analyticsService.getRecommendations(),
        analyticsService.getProfileComparison()
      ]);

      setDashboardData({
        personalStats: stats,
        profilePerformance: performance,
        recommendations,
        comparison
      });
    } catch (err) {
      console.error('Error refreshing data:', err);
      setError('Failed to refresh analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading && !dashboardData.personalStats) {
    return (
      <div className="analytics-dashboard analytics-loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading your analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
      {/* Header */}
      <div className="analytics-header">
        <h1>📊 Your Dating Analytics</h1>
        <p>Discover how your profile performs and get personalized recommendations</p>
        <div className="analytics-actions">
          <button 
            className="refresh-btn" 
            onClick={handleRefresh}
            disabled={loading}
          >
            🔄 {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="analytics-error">
          <p>{error}</p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="analytics-tabs">
        <button 
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📈 Overview
        </button>
        <button 
          className={`tab-btn ${activeTab === 'performance' ? 'active' : ''}`}
          onClick={() => setActiveTab('performance')}
        >
          ⭐ Performance
        </button>
        <button 
          className={`tab-btn ${activeTab === 'trends' ? 'active' : ''}`}
          onClick={() => setActiveTab('trends')}
        >
          📊 Trends
        </button>
        <button 
          className={`tab-btn ${activeTab === 'recommendations' ? 'active' : ''}`}
          onClick={() => setActiveTab('recommendations')}
        >
          💡 Tips
        </button>
      </div>

      {/* Content */}
      <div className="analytics-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="tab-content overview-tab">
            <div className="stats-grid">
              <PersonalStatsCard 
                stats={dashboardData.personalStats}
                loading={loading}
              />
              <ProfilePerformanceCard 
                performance={dashboardData.profilePerformance}
                loading={loading}
              />
            </div>
          </div>
        )}

        {/* Performance Tab */}
        {activeTab === 'performance' && (
          <div className="tab-content performance-tab">
            <ProfileComparisonCard 
              comparison={dashboardData.comparison}
              loading={loading}
            />
          </div>
        )}

        {/* Trends Tab */}
        {activeTab === 'trends' && (
          <div className="tab-content trends-tab">
            <div className="trends-header">
              <h3>Monthly Trends</h3>
              <div className="month-navigation">
                <button onClick={handlePreviousMonth}>← Previous</button>
                <span className="month-display">
                  {new Date(selectedMonth.year, selectedMonth.month - 1).toLocaleDateString('default', {
                    month: 'long',
                    year: 'numeric'
                  })}
                </span>
                <button onClick={handleNextMonth}>Next →</button>
              </div>
            </div>
            <MonthlyReportCard 
              year={selectedMonth.year}
              month={selectedMonth.month}
              loading={loading}
            />
          </div>
        )}

        {/* Recommendations Tab */}
        {activeTab === 'recommendations' && (
          <div className="tab-content recommendations-tab">
            <RecommendationsCard 
              recommendations={dashboardData.recommendations}
              loading={loading}
            />
          </div>
        )}
      </div>

      {/* Summary Footer */}
      <div className="analytics-footer">
        <div className="footer-info">
          <p>💡 Tip: Check back regularly to track your progress</p>
          <p>✨ Try implementing our recommendations to improve your match rate</p>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
