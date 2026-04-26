import React, { useEffect, useState } from 'react';
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
import VideoDating from './components/VideoDating';
import { getStoredAuthToken, storeAuthToken, clearStoredAuthToken, storeUserData, getStoredUserData } from './utils/auth';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('launch'); // launch, login, signup, discover, browse, matches, messages, profile
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [videoCallActive, setVideoCallActive] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState(null);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const token = getStoredAuthToken();
    const authenticated = !!token;
    setIsAuthenticated(authenticated);
    setCurrentPage(authenticated ? 'discover' : 'launch');
    
    // Get user data if authenticated
    if (authenticated) {
      const userData = getStoredUserData();
      if (userData) {
        setUserName(userData.firstName || userData.username || userData.email || '');
      }
    }
    
    setLoading(false);
  }, []);

  const handleLoginSuccess = (userData, token) => {
    if (!token) {
      return;
    }

    storeAuthToken(token);
    if (userData) {
      storeUserData(userData);
    }

    setIsAuthenticated(true);
    setCurrentPage('discover');
  };

  const handleLogout = () => {
    clearStoredAuthToken();
    setIsAuthenticated(false);
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
    setCurrentPage('discover');
  };

  const handleVideoCall = (profile) => {
    setMatchedProfile(profile);
    setVideoCallActive(true);
  };

  const handleEndVideoCall = (profile, duration) => {
    setVideoCallActive(false);
    setCurrentPage('matches');
  };

  const handleMatch = (profile) => {
    setSelectedMatch(profile);
    setCurrentPage('matches');
  };

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
                              onProfileView={(profile) => setSelectedMatch(profile)}
                            />
                          )}
                          {currentPage === 'browse' && (
                            <BrowseProfiles
                              onProfileSelect={setSelectedMatch}
                              onMatch={handleMatch}
                            />
                          )}
                          {currentPage === 'matches' && (
                            <Matches
                              onSelectMatch={(match) => {
                                setSelectedMatch(match);
                                setCurrentPage('messages');
                              }}
                              onUnmatch={() => setCurrentPage('discover')}
                            />
                          )}
                          {currentPage === 'messages' && (
                            <DatingMessaging
                              matchedProfile={selectedMatch}
                              onVideoCall={handleVideoCall}
                            />
                          )}
                          {currentPage === 'profile' && (
                            <DatingProfile onLogout={handleLogout} />
                          )}
                        </div>

                        <DatingNavigation
                          currentPage={currentPage}
                          onPageChange={setCurrentPage}
                          unreadCount={0}
                          matchCount={0}
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
                  <DiscoveryCards onMatch={handleMatch} onProfileView={(profile) => setSelectedMatch(profile)} />
                  <DatingNavigation currentPage="discover" onPageChange={setCurrentPage} unreadCount={0} matchCount={0} />
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
