import React, { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './App.css';
import { AppProvider } from './contexts/AppContext';
import ErrorBoundary from './components/ErrorBoundary';
import LaunchPage from './components/LaunchPage';
import DatingSignUp from './components/DatingSignUp';
import Login from './components/Login';
import DatingNavigation from './components/DatingNavigation';
import DiscoveryCards from './components/DiscoveryCards';
import BrowseProfiles from './components/BrowseProfiles';
import Matches from './components/Matches';
import DatingMessaging from './components/DatingMessaging';
import DatingProfile from './components/DatingProfile';
import DatingProfileView from './components/DatingProfileView';
import VideoDating from './components/VideoDating';
import datingProfileService from './services/datingProfileService';
import datingMessagingService from './services/datingMessagingService';
import { getStoredAuthToken, storeAuthToken, clearStoredAuthToken, storeUserData, getStoredUserData } from './utils/auth';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('launch');
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [viewedProfile, setViewedProfile] = useState(null);
  const [profileReturnPage, setProfileReturnPage] = useState('discover');
  const [messagesReturnPage, setMessagesReturnPage] = useState('matches');
  const [videoCallActive, setVideoCallActive] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState(null);
  const [userName, setUserName] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [matchCount, setMatchCount] = useState(0);

  const normalizeMatchContext = (profile) => {
    if (!profile) {
      return null;
    }

    return {
      ...profile,
      matchId: profile.matchId || profile.id || null
    };
  };

  const loadStoredUserName = useCallback(() => {
    const userData = getStoredUserData();

    if (userData) {
      setUserName(userData.firstName || userData.username || userData.email || '');
    }
  }, []);

  const refreshDatingCounts = useCallback(async () => {
    if (!getStoredAuthToken()) {
      setUnreadCount(0);
      setMatchCount(0);
      return;
    }

    try {
      const [matchesData, unreadData] = await Promise.all([
        datingProfileService.getMatches(100),
        datingMessagingService.getUnreadCount()
      ]);

      setMatchCount(matchesData.matches?.length || 0);
      setUnreadCount(unreadData.unreadCount || 0);
    } catch (countError) {
      console.error('Failed to refresh dating counts:', countError);
    }
  }, []);

  useEffect(() => {
    const token = getStoredAuthToken();
    const authenticated = !!token;
    setIsAuthenticated(authenticated);
    setCurrentPage(authenticated ? 'discover' : 'launch');

    if (authenticated) {
      loadStoredUserName();
    }

    setLoading(false);
  }, [loadStoredUserName]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    refreshDatingCounts();
  }, [currentPage, isAuthenticated, refreshDatingCounts]);

  const handleLoginSuccess = (userData, token) => {
    if (!token) {
      return;
    }

    storeAuthToken(token);
    if (userData) {
      storeUserData(userData);
    }

    setIsAuthenticated(true);
    setSelectedMatch(null);
    setViewedProfile(null);
    loadStoredUserName();
    setCurrentPage('discover');
    refreshDatingCounts();
  };

  const handleLogout = () => {
    clearStoredAuthToken();
    setIsAuthenticated(false);
    setSelectedMatch(null);
    setViewedProfile(null);
    setMatchedProfile(null);
    setUnreadCount(0);
    setMatchCount(0);
    setUserName('');
    setCurrentPage('launch');
  };

  const handleSignUpSuccess = (token, userData) => {
    if (!token) {
      return;
    }

    storeAuthToken(token);
    if (userData) {
      storeUserData(userData);
    }

    setIsAuthenticated(true);
    setSelectedMatch(null);
    setViewedProfile(null);
    loadStoredUserName();
    setCurrentPage('discover');
    refreshDatingCounts();
  };

  const handleVideoCall = (profile) => {
    setMatchedProfile(normalizeMatchContext(profile));
    setVideoCallActive(true);
  };

  const handleEndVideoCall = () => {
    setVideoCallActive(false);
  };

  const handleMatch = (profile) => {
    setSelectedMatch(normalizeMatchContext(profile));
    refreshDatingCounts();
    setCurrentPage('matches');
  };

  const handleOpenMessages = (profile, returnPage = 'matches') => {
    const nextMatch = normalizeMatchContext(profile);

    if (!nextMatch) {
      return;
    }

    setSelectedMatch(nextMatch);
    setMessagesReturnPage(returnPage);
    setCurrentPage('messages');
  };

  const handleOpenProfile = (profile, returnPage = currentPage) => {
    const contextProfile = normalizeMatchContext(profile);

    if (!contextProfile) {
      return;
    }

    setViewedProfile(contextProfile);
    setProfileReturnPage(returnPage);

    if (contextProfile.matchId) {
      setSelectedMatch((currentMatch) => ({
        ...(currentMatch || {}),
        ...contextProfile
      }));
    }

    setCurrentPage('profile-detail');
  };

  const handleProfileBack = () => {
    setCurrentPage(profileReturnPage || 'discover');
  };

  const handleMessagesBack = () => {
    if (messagesReturnPage === 'profile-detail' && viewedProfile) {
      setCurrentPage('profile-detail');
      return;
    }

    setCurrentPage(messagesReturnPage || 'matches');
  };

  const handleConversationActivity = useCallback(() => {
    refreshDatingCounts();
  }, [refreshDatingCounts]);

  const handleUnmatch = (matchId) => {
    setSelectedMatch((currentMatch) => {
      if (!currentMatch) {
        return currentMatch;
      }

      return currentMatch.matchId === matchId || currentMatch.id === matchId ? null : currentMatch;
    });

    setViewedProfile((currentProfile) => {
      if (!currentProfile) {
        return currentProfile;
      }

      if (currentProfile.matchId === matchId || currentProfile.id === matchId) {
        return {
          ...currentProfile,
          matchId: null
        };
      }

      return currentProfile;
    });

    if (currentPage === 'messages') {
      setCurrentPage('matches');
    }

    refreshDatingCounts();
  };

  const handleNavigationChange = (page) => {
    if (page === 'messages' && !selectedMatch) {
      setCurrentPage('matches');
      return;
    }

    if (page !== 'profile-detail') {
      setViewedProfile(null);
    }

    setCurrentPage(page);
  };

  const navigationPage = currentPage === 'profile-detail' ? profileReturnPage : currentPage;

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
        <p>LinkUp Dating Loading...</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AppProvider onLogout={handleLogout}>
        <BrowserRouter>
          <Routes>
            {/* Unauthenticated Routes */}
            <Route
              path="/"
              element={
                !isAuthenticated ? (
                  currentPage === 'launch' ? (
                    <LaunchPage
                      onSelectRegistrationType={(type) => {
                        if (type === 'login') {
                          setCurrentPage('login');
                        } else if (type === 'user') {
                          setCurrentPage('signup');
                        }
                      }}
                      enabledModules={['dating']}
                      language="en"
                      onLanguageChange={() => {}}
                      isAuthenticated={isAuthenticated}
                      onLogout={handleLogout}
                      userName={userName}
                    />
                  ) : currentPage === 'signup' ? (
                    <DatingSignUp
                      onSignUpSuccess={handleSignUpSuccess}
                      onLoginClick={() => setCurrentPage('login')}
                      onBackToLaunch={() => setCurrentPage('launch')}
                    />
                  ) : currentPage === 'login' ? (
                    <Login
                      registrationType="login"
                      onLoginSuccess={handleLoginSuccess}
                      onBackToLaunch={() => setCurrentPage('launch')}
                      onSignUpClick={() => setCurrentPage('signup')}
                    />
                  ) : (
                    <LaunchPage
                      onSelectRegistrationType={(type) => {
                        if (type === 'login') {
                          setCurrentPage('login');
                        } else if (type === 'user') {
                          setCurrentPage('signup');
                        }
                      }}
                      enabledModules={['dating']}
                      language="en"
                      onLanguageChange={() => {}}
                      isAuthenticated={isAuthenticated}
                      onLogout={handleLogout}
                      userName={userName}
                    />
                  )
                ) : (
                  <div className="dating-app">
                    {videoCallActive && matchedProfile ? (
                      <VideoDating
                        matchedProfile={matchedProfile}
                        onEndCall={handleEndVideoCall}
                      />
                    ) : (
                      <>
                        <div className="app-content">
                          {currentPage === 'discover' && (
                            <DiscoveryCards
                              onMatch={handleMatch}
                              onProfileView={(profile) => handleOpenProfile(profile, 'discover')}
                            />
                          )}
                          {currentPage === 'browse' && (
                            <BrowseProfiles
                              onProfileSelect={(profile) => handleOpenProfile(profile, 'browse')}
                              onMatch={handleMatch}
                            />
                          )}
                          {currentPage === 'matches' && (
                            <Matches
                              onSelectMatch={(match) => handleOpenMessages(match, 'matches')}
                              onUnmatch={handleUnmatch}
                              onViewProfile={(profile) => handleOpenProfile(profile, 'matches')}
                              onStartVideoCall={handleVideoCall}
                            />
                          )}
                          {currentPage === 'messages' && (
                            <DatingMessaging
                              matchedProfile={selectedMatch}
                              onVideoCall={handleVideoCall}
                              onBack={handleMessagesBack}
                              onViewProfile={(profile) => handleOpenProfile(profile, 'messages')}
                              onConversationActivity={handleConversationActivity}
                            />
                          )}
                          {currentPage === 'profile-detail' && viewedProfile && (
                            <DatingProfileView
                              profile={viewedProfile}
                              onBack={handleProfileBack}
                              onMessage={(profile) => handleOpenMessages(profile, 'profile-detail')}
                              onVideoCall={handleVideoCall}
                            />
                          )}
                          {currentPage === 'profile' && (
                            <DatingProfile onLogout={handleLogout} />
                          )}
                        </div>

                        <DatingNavigation
                          currentPage={navigationPage}
                          onPageChange={handleNavigationChange}
                          unreadCount={unreadCount}
                          matchCount={matchCount}
                        />
                      </>
                    )}
                  </div>
                )
              }
            />
            {/* Catch-all route */}
            <Route path="*" element={
              isAuthenticated ? (
                <div className="dating-app">
                  <DiscoveryCards onMatch={handleMatch} onProfileView={(profile) => handleOpenProfile(profile, 'discover')} />
                  <DatingNavigation
                    currentPage="discover"
                    onPageChange={handleNavigationChange}
                    unreadCount={unreadCount}
                    matchCount={matchCount}
                  />
                </div>
              ) : (
                <LaunchPage
                  onSelectRegistrationType={(type) => {
                    if (type === 'login') {
                      setCurrentPage('login');
                    } else if (type === 'user') {
                      setCurrentPage('signup');
                    }
                  }}
                  enabledModules={['dating']}
                  language="en"
                  onLanguageChange={() => {}}
                  isAuthenticated={isAuthenticated}
                  onLogout={handleLogout}
                  userName={userName}
                />
              )
            } />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
