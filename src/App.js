import React, { useCallback, useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate
} from './router';
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
import ChatRooms from './components/ChatRooms';
import ChatRoomView from './components/ChatRoomView';
import LobbyChat from './components/LobbyChat';
import SocialHub from './components/SocialHub';
import AdminDashboard from './components/AdminDashboard';
import datingProfileService from './services/datingProfileService';
import datingMessagingService from './services/datingMessagingService';
import notificationService from './services/notificationService';
import videoCallService from './services/videoCallService';
import { BACKEND_BASE_URL } from './utils/api';
import {
  clearStoredAuthToken,
  clearStoredUserData,
  getStoredAuthToken,
  getStoredUserData,
  storeAuthToken,
  storeUserData
} from './utils/auth';

const ADMIN_DASHBOARD_ROUTE = '/admin-dashboard';
const DEFAULT_AUTHENTICATED_ROUTE = '/discover';
const DEFAULT_MESSAGES_ROUTE = '/messages';

const isAdminUser = (user) =>
  Boolean(user && (user.isAdmin || user.is_admin || user.role === 'admin' || user.registrationType === 'admin'));

const getDefaultAuthenticatedRouteForUser = (user) =>
  isAdminUser(user) ? ADMIN_DASHBOARD_ROUTE : DEFAULT_AUTHENTICATED_ROUTE;

const normalizeProfileContext = (profile) => {
  if (!profile) {
    return null;
  }

  return {
    ...profile,
    userId: profile.userId ?? profile.user_id ?? null,
    matchId: profile.matchId ?? profile.match_id ?? null
  };
};

const buildMatchRoute = (matchId) => `/matches/${matchId}/chat`;
const buildVideoCallRoute = (matchId) => `/matches/${matchId}/video`;
const buildProfileRoute = (userId) => `/profiles/${userId}`;

const inferNavigationPage = (pathname, returnPath = '') => {
  const targetPath = pathname.startsWith('/profiles/') && returnPath ? returnPath : pathname;

  if (/^\/matches\/[^/]+\/video$/i.test(pathname)) {
    return inferNavigationPage(returnPath || DEFAULT_MESSAGES_ROUTE);
  }

  if (/^\/matches\/[^/]+\/chat$/i.test(targetPath)) {
    return 'messages';
  }

  if (targetPath.startsWith('/messages')) {
    return 'messages';
  }

  if (targetPath.startsWith('/matches')) {
    return 'matches';
  }

  if (targetPath.startsWith('/browse')) {
    return 'browse';
  }

  if (targetPath.startsWith('/social')) {
    return 'social';
  }

  if (/^\/chatrooms\/[^/]+$/i.test(targetPath)) {
    return 'social';
  }

  if (targetPath.startsWith('/chatrooms')) {
    return 'social';
  }

  if (targetPath.startsWith('/lobby')) {
    return 'social';
  }

  if (targetPath.startsWith('/profile')) {
    return 'profile';
  }

  return 'discover';
};

const AuthenticatedDatingLayout = ({
  matchCount,
  onPageChange,
  unreadCount
}) => {
  const location = useLocation();
  const navigationPage = inferNavigationPage(location.pathname, location.state?.returnPath);
  const isVideoCallRoute = /^\/matches\/[^/]+\/video$/i.test(location.pathname);

  return (
    <div className="dating-app">
      {isVideoCallRoute ? (
        <Outlet />
      ) : (
        <>
          <div className="app-content">
            <Outlet />
          </div>

          <DatingNavigation
            currentPage={navigationPage}
            onPageChange={onPageChange}
            unreadCount={unreadCount}
            matchCount={matchCount}
          />
        </>
      )}
    </div>
  );
};

const MatchChatRoute = ({
  onConversationActivity,
  onNavigateToPath,
  onOpenProfile,
  onScheduleVideoCall,
  onVideoCall
}) => {
  const location = useLocation();
  const matchId = location.pathname.match(/^\/matches\/([^/]+)\/chat$/)?.[1] || null;

  return (
    <DatingMessaging
      matchId={matchId}
      matchedProfile={normalizeProfileContext(location.state?.match)}
      onScheduleVideoCall={onScheduleVideoCall}
      onVideoCall={onVideoCall}
      onBack={() => onNavigateToPath(location.state?.returnPath || DEFAULT_MESSAGES_ROUTE)}
      onViewProfile={(profile) => onOpenProfile(profile, location.pathname)}
      onConversationActivity={onConversationActivity}
    />
  );
};

const ProfileDetailRoute = ({
  onNavigateToPath,
  onOpenMessages,
  onScheduleVideoCall,
  onVideoCall
}) => {
  const location = useLocation();
  const userId = location.pathname.match(/^\/profiles\/([^/]+)$/)?.[1] || null;

  return (
    <DatingProfileView
      profileId={userId}
      profile={normalizeProfileContext(location.state?.profile)}
      onBack={() => onNavigateToPath(location.state?.returnPath || DEFAULT_AUTHENTICATED_ROUTE)}
      onMessage={(profile, prefillMessage) => onOpenMessages(profile, location.pathname, { prefillMessage })}
      onScheduleVideoCall={onScheduleVideoCall}
      onVideoCall={onVideoCall}
    />
  );
};

const MatchVideoRoute = ({
  onNavigateToPath,
  onOpenMessages
}) => {
  const location = useLocation();
  const matchId = location.pathname.match(/^\/matches\/([^/]+)\/video$/)?.[1] || null;

  return (
    <VideoDating
      matchId={matchId}
      matchedProfile={normalizeProfileContext(location.state?.match)}
      callMode={location.state?.callMode || 'outgoing'}
      autoAccepted={Boolean(location.state?.autoAccepted)}
      callerName={location.state?.incomingCall?.fromUserName || ''}
      incomingCall={location.state?.incomingCall || null}
      startImmediately={location.state?.startImmediately !== false}
      focusSchedule={Boolean(location.state?.focusSchedule)}
      scheduledVideoDateId={location.state?.scheduledVideoDateId || null}
      onBack={() => onNavigateToPath(location.state?.returnPath || buildMatchRoute(matchId))}
      onOpenMessages={(profile) => onOpenMessages(profile, location.state?.returnPath || DEFAULT_MESSAGES_ROUTE)}
    />
  );
};

const ChatRoomDetailRoute = ({
  onNavigateToChatrooms
}) => {
  const location = useLocation();
  const chatroomId = location.pathname.match(/^\/chatrooms\/([^/]+)$/)?.[1] || null;

  return (
    <ChatRoomView
      chatroomId={chatroomId}
      onBack={() => onNavigateToChatrooms(location.state?.returnPath || '/chatrooms')}
    />
  );
};

const AppContent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(() => getStoredUserData());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [lastOpenedMatchRoute, setLastOpenedMatchRoute] = useState('');
  const [incomingCall, setIncomingCall] = useState(null);
  const appSocketRef = useRef(null);
  const isAdminSession = isAdminUser(currentUser);
  const defaultAuthenticatedRoute = getDefaultAuthenticatedRouteForUser(currentUser);

  const loadStoredUserName = useCallback((userData) => {
    if (userData) {
      setUserName(userData.firstName || userData.username || userData.name || userData.email || '');
      return;
    }

    setUserName('');
  }, []);

  const refreshDatingCounts = useCallback(async () => {
    if (!getStoredAuthToken() || isAdminSession) {
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
  }, [isAdminSession]);

  useEffect(() => {
    const token = getStoredAuthToken();
    const authenticated = Boolean(token);
    const storedUser = getStoredUserData();

    setCurrentUser(storedUser);
    setIsAuthenticated(authenticated);
    if (authenticated) {
      loadStoredUserName(storedUser);
    } else {
      setUserName('');
    }

    setLoading(false);
  }, [loadStoredUserName]);

  useEffect(() => {
    if (!isAuthenticated || isAdminSession) {
      return;
    }

    refreshDatingCounts();
  }, [isAdminSession, isAuthenticated, location.pathname, refreshDatingCounts]);

  useEffect(() => {
    if (!isAuthenticated || isAdminSession) {
      return undefined;
    }

    let isDisposed = false;

    const pollVideoCallReminders = async () => {
      try {
        const response = await videoCallService.deliverDueReminders();
        const reminders = Array.isArray(response?.reminders) ? response.reminders : [];

        if (isDisposed || reminders.length === 0) {
          return;
        }

        if (notificationService.getPermissionStatus().canNotify) {
          reminders.forEach(({ session }) => {
            if (!session?.id) {
              return;
            }

            notificationService.notify({
              title: 'Video date reminder',
              body: `${session.partner?.name || 'Your match'} is coming up soon.`,
              tag: `video-call-reminder-${session.id}`,
              requireInteraction: false
            });
          });
        }
      } catch (reminderError) {
        console.error('Failed to poll video call reminders:', reminderError);
      }
    };

    void pollVideoCallReminders();
    const reminderInterval = window.setInterval(pollVideoCallReminders, 60 * 1000);

    return () => {
      isDisposed = true;
      window.clearInterval(reminderInterval);
    };
  }, [isAdminSession, isAuthenticated]);

  useEffect(() => {
    if (/^\/matches\/[^/]+\/chat$/i.test(location.pathname)) {
      setLastOpenedMatchRoute(location.pathname);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!isAuthenticated || isAdminSession) {
      appSocketRef.current?.disconnect();
      appSocketRef.current = null;
      setIncomingCall(null);
      return undefined;
    }

    if (!currentUser?.id) {
      return undefined;
    }

    const socket = io(BACKEND_BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 8,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 5000,
      timeout: 10000
    });

    appSocketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('user_online', currentUser.id);
    });

    socket.on('call:incoming', (payload) => {
      if (!payload?.callId || String(payload.fromUserId) === String(currentUser.id)) {
        return;
      }

      setIncomingCall(payload);
    });

    socket.on('call:ended', (payload) => {
      setIncomingCall((currentCall) => (
        currentCall && String(currentCall.callId) === String(payload?.callId)
          ? null
          : currentCall
      ));
    });

    socket.on('new_message', (payload) => {
      refreshDatingCounts();

      if (document.hidden && notificationService.getPermissionStatus().canNotify) {
        notificationService.notify({
          title: `New message from ${payload?.fromUserName || 'your match'}`,
          body: payload?.message || 'Open LinkUp to reply.',
          tag: `dating-message-${payload?.matchId || 'inbox'}`,
          requireInteraction: false
        });
      }
    });

    socket.on('new_match', () => {
      refreshDatingCounts();

      if (document.hidden && notificationService.getPermissionStatus().canNotify) {
        notificationService.notify({
          title: 'New match on LinkUp',
          body: 'Someone liked you back. Open the app to start chatting.',
          tag: 'dating-match',
          requireInteraction: false
        });
      }
    });

    return () => {
      socket.disconnect();
      if (appSocketRef.current === socket) {
        appSocketRef.current = null;
      }
    };
  }, [currentUser, isAdminSession, isAuthenticated, refreshDatingCounts]);

  useEffect(() => {
    if (!isAuthenticated || isAdminSession) {
      return undefined;
    }

    // Send heartbeat every 5 minutes to update last active
    const heartbeatInterval = window.setInterval(() => {
      datingProfileService.sendHeartbeat().catch(() => {});
    }, 5 * 60 * 1000);

    // Send initial heartbeat
    datingProfileService.sendHeartbeat().catch(() => {});

    return () => {
      window.clearInterval(heartbeatInterval);
    };
  }, [isAuthenticated, isAdminSession]);

  const handleLoginSuccess = (userData, token) => {
    if (!token) {
      return;
    }

    storeAuthToken(token);
    if (userData) {
      storeUserData(userData);
    }

    const nextUser = userData || null;

    setCurrentUser(nextUser);
    setIsAuthenticated(true);
    loadStoredUserName(nextUser);

    if (isAdminUser(nextUser)) {
      setUnreadCount(0);
      setMatchCount(0);
    } else {
      refreshDatingCounts();
    }

    navigate(getDefaultAuthenticatedRouteForUser(nextUser), { replace: true });
  };

  const handleLogout = () => {
    clearStoredAuthToken();
    clearStoredUserData();
    setCurrentUser(null);
    setIsAuthenticated(false);
    setUnreadCount(0);
    setMatchCount(0);
    setUserName('');
    setLastOpenedMatchRoute('');
    setIncomingCall(null);
    navigate('/', { replace: true });
  };

  const handleSignUpSuccess = (token, userData) => {
    if (!token) {
      return;
    }

    storeAuthToken(token);
    if (userData) {
      storeUserData(userData);
    }

    const nextUser = userData || null;

    setCurrentUser(nextUser);
    setIsAuthenticated(true);
    loadStoredUserName(nextUser);

    if (isAdminUser(nextUser)) {
      setUnreadCount(0);
      setMatchCount(0);
    } else {
      refreshDatingCounts();
    }

    navigate(getDefaultAuthenticatedRouteForUser(nextUser), { replace: true });
  };

  const handleVideoCall = (profile, returnPath = location.pathname, options = {}) => {
    const nextMatchedProfile = normalizeProfileContext(profile);

    if (!nextMatchedProfile?.matchId) {
      return;
    }

    navigate(buildVideoCallRoute(nextMatchedProfile.matchId), {
      state: {
        match: nextMatchedProfile,
        returnPath,
        callMode: 'outgoing',
        focusSchedule: Boolean(options.focusSchedule),
        scheduledVideoDateId: options.scheduledVideoDateId || null,
        startImmediately: options.startImmediately !== false
      }
    });
  };

  const handleMatch = (profile) => {
    const nextMatch = normalizeProfileContext(profile);

    if (nextMatch?.matchId) {
      setLastOpenedMatchRoute(buildMatchRoute(nextMatch.matchId));
    }

    refreshDatingCounts();
    navigate('/matches');
  };

  const handleOpenMessages = (profile, returnPath = DEFAULT_MESSAGES_ROUTE, options = {}) => {
    const nextMatch = normalizeProfileContext(profile);

    if (!nextMatch?.matchId) {
      return;
    }

    const nextRoute = buildMatchRoute(nextMatch.matchId);
    setLastOpenedMatchRoute(nextRoute);
    navigate(nextRoute, {
      state: {
        match: nextMatch,
        returnPath,
        focusPlanner: Boolean(options.focusPlanner),
        prefillMessage: options.prefillMessage || ''
      }
    });
  };

  const handleOpenProfile = (profile, returnPath = location.pathname) => {
    const nextProfile = normalizeProfileContext(profile);

    if (!nextProfile?.userId) {
      return;
    }

    navigate(buildProfileRoute(nextProfile.userId), {
      state: {
        profile: nextProfile,
        returnPath
      }
    });
  };

  const handleConversationActivity = useCallback(() => {
    refreshDatingCounts();
  }, [refreshDatingCounts]);

  const handleUnmatch = (matchId) => {
    const matchRoute = buildMatchRoute(matchId);
    const videoRoute = buildVideoCallRoute(matchId);

    if (location.pathname === matchRoute || location.pathname === videoRoute) {
      navigate('/matches', { replace: true });
    }

    if (lastOpenedMatchRoute === matchRoute) {
      setLastOpenedMatchRoute('');
    }

    refreshDatingCounts();
  };

  const handleAcceptIncomingCall = () => {
    if (!incomingCall?.callId || !incomingCall?.matchId) {
      setIncomingCall(null);
      return;
    }

    appSocketRef.current?.emit('call:accept', {
      callId: incomingCall.callId,
      matchId: incomingCall.matchId,
      targetUserId: incomingCall.fromUserId
    });

    const acceptedCall = incomingCall;
    setIncomingCall(null);
    navigate(buildVideoCallRoute(acceptedCall.matchId), {
      state: {
        callMode: 'incoming',
        autoAccepted: true,
        incomingCall: acceptedCall,
        returnPath: buildMatchRoute(acceptedCall.matchId)
      }
    });
  };

  const handleDeclineIncomingCall = () => {
    if (incomingCall?.callId && incomingCall?.fromUserId) {
      appSocketRef.current?.emit('call:decline', {
        callId: incomingCall.callId,
        matchId: incomingCall.matchId,
        targetUserId: incomingCall.fromUserId
      });
    }

    setIncomingCall(null);
  };

  const handleNavigationChange = async (page) => {
    switch (page) {
      case 'browse':
        navigate('/browse');
        break;
      case 'matches':
        navigate('/matches');
        break;
      case 'messages':
        navigate('/messages', {
          state: {
            focusMessages: true,
            messagesRequestedAt: Date.now()
          }
        });
        break;
      case 'social':
        navigate('/social');
        break;
      case 'profile':
        navigate('/profile');
        break;
      case 'discover':
      default:
        navigate('/discover');
        break;
    }
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
      <AppProvider
        onLogout={handleLogout}
        loggedInUser={currentUser}
        authToken={getStoredAuthToken()}
      >
        <Routes>
          <Route
            path="/"
            element={
              !isAuthenticated ? (
                <LaunchPage
                  onSelectRegistrationType={(type) => {
                    if (type === 'login') {
                      navigate('/login');
                    } else if (type === 'user') {
                      navigate('/signup');
                    }
                  }}
                  enabledModules={['dating']}
                  language="en"
                  onLanguageChange={() => {}}
                  isAuthenticated={isAuthenticated}
                  onLogout={handleLogout}
                  userName={userName}
                />
              ) : (
                <Navigate to={defaultAuthenticatedRoute} replace />
              )
            }
          />
          <Route
            path="/login"
            element={
              !isAuthenticated ? (
                <Login
                  registrationType="login"
                  onLoginSuccess={handleLoginSuccess}
                  onBackToLaunch={() => navigate('/')}
                  onSignUpClick={() => navigate('/signup')}
                />
              ) : (
                <Navigate to={defaultAuthenticatedRoute} replace />
              )
            }
          />
          <Route
            path="/signup"
            element={
              !isAuthenticated ? (
                <DatingSignUp
                  onSignUpSuccess={handleSignUpSuccess}
                  onLoginClick={() => navigate('/login')}
                  onBackToLaunch={() => navigate('/')}
                />
              ) : (
                <Navigate to={defaultAuthenticatedRoute} replace />
              )
            }
          />
          <Route
            path="/admin-dashboard"
            element={
              isAuthenticated ? (
                isAdminSession ? (
                  <AdminDashboard onLogout={handleLogout} />
                ) : (
                  <Navigate to={DEFAULT_AUTHENTICATED_ROUTE} replace />
                )
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/*"
            element={
              isAuthenticated && !isAdminSession ? (
                <AuthenticatedDatingLayout
                  matchCount={matchCount}
                  onPageChange={handleNavigationChange}
                  unreadCount={unreadCount}
                />
              ) : isAuthenticated ? (
                <Navigate to={defaultAuthenticatedRoute} replace />
              ) : (
                <Navigate to="/" replace />
              )
            }
          >
            <Route
              path="discover"
              element={
                <DiscoveryCards
                  onMatch={handleMatch}
                  onProfileView={(profile) => handleOpenProfile(profile, '/discover')}
                />
              }
            />
            <Route
              path="dating"
              element={
                <DiscoveryCards
                  onMatch={handleMatch}
                  onProfileView={(profile) => handleOpenProfile(profile, '/dating')}
                />
              }
            />
            <Route
              path="browse"
              element={
                <BrowseProfiles
                  onProfileSelect={(profile) => handleOpenProfile(profile, '/browse')}
                  onMatch={handleMatch}
                />
              }
            />
            <Route
              path="messages"
              element={
                <Matches
                  pageLabel="Messages"
                  onSelectMatch={(match) => handleOpenMessages(match, '/messages')}
                  onPlanDate={(match) => handleOpenMessages(match, '/messages', { focusPlanner: true })}
                  onMatchCreated={refreshDatingCounts}
                  onUnmatch={handleUnmatch}
                  onViewProfile={(profile) => handleOpenProfile(profile, '/messages')}
                  onScheduleVideoCall={(profile) =>
                    handleVideoCall(profile, '/messages', {
                      focusSchedule: true,
                      startImmediately: false
                    })
                  }
                  onStartVideoCall={handleVideoCall}
                />
              }
            />
            <Route
              path="matches"
              element={
                <Matches
                  pageLabel="Matches"
                  onSelectMatch={(match) => handleOpenMessages(match, '/matches')}
                  onPlanDate={(match) => handleOpenMessages(match, '/matches', { focusPlanner: true })}
                  onMatchCreated={refreshDatingCounts}
                  onUnmatch={handleUnmatch}
                  onViewProfile={(profile) => handleOpenProfile(profile, '/matches')}
                  onScheduleVideoCall={(profile) =>
                    handleVideoCall(profile, '/matches', {
                      focusSchedule: true,
                      startImmediately: false
                    })
                  }
                  onStartVideoCall={handleVideoCall}
                />
              }
            />
            <Route
              path="matches/:matchId/chat"
              element={
                <MatchChatRoute
                  onConversationActivity={handleConversationActivity}
                  onNavigateToPath={(path) => navigate(path)}
                  onOpenProfile={handleOpenProfile}
                  onScheduleVideoCall={(profile, returnPath) =>
                    handleVideoCall(profile, returnPath, {
                      focusSchedule: true,
                      startImmediately: false
                    })
                  }
                  onVideoCall={handleVideoCall}
                />
              }
            />
            <Route
              path="matches/:matchId/video"
              element={
                <MatchVideoRoute
                  onNavigateToPath={(path) => navigate(path)}
                  onOpenMessages={handleOpenMessages}
                />
              }
            />
            <Route
              path="profiles/:userId"
              element={
                <ProfileDetailRoute
                  onNavigateToPath={(path) => navigate(path)}
                  onOpenMessages={handleOpenMessages}
                  onScheduleVideoCall={(profile, returnPath) =>
                    handleVideoCall(profile, returnPath, {
                      focusSchedule: true,
                      startImmediately: false
                    })
                  }
                  onVideoCall={handleVideoCall}
                />
              }
            />
            <Route
              path="social"
              element={
                <SocialHub
                  onMatchCreated={refreshDatingCounts}
                  onOpenLobby={() => navigate('/lobby', { state: { returnPath: '/social' } })}
                  onOpenChatroom={(chatroomId) =>
                    navigate(`/chatrooms/${chatroomId}`, { state: { returnPath: '/social' } })
                  }
                  onOpenProfile={(profile) => handleOpenProfile(profile, '/social')}
                />
              }
            />
            <Route
              path="chatrooms"
              element={
                <ChatRooms
                  onSelectChatroom={(chatroom) => {
                    navigate(`/chatrooms/${chatroom.id}`, {
                      state: { returnPath: '/chatrooms' }
                    });
                  }}
                  onBack={() => navigate(location.state?.returnPath || '/social')}
                />
              }
            />
            <Route
              path="chatrooms/:chatroomId"
              element={
                <ChatRoomDetailRoute
                  onNavigateToChatrooms={() => {
                    navigate('/chatrooms');
                  }}
                />
              }
            />
            <Route
              path="lobby"
              element={
                <LobbyChat
                  onBack={() => navigate(location.state?.returnPath || '/social')}
                />
              }
            />
            <Route path="profile" element={<DatingProfile onLogout={handleLogout} />} />
            <Route path="*" element={<Navigate to={DEFAULT_AUTHENTICATED_ROUTE} replace />} />
          </Route>
        </Routes>
        {isAuthenticated && incomingCall && !/^\/matches\/[^/]+\/video$/i.test(location.pathname) ? (
          <div className="incoming-call-overlay" role="dialog" aria-modal="true" aria-label="Incoming video call">
            <div className="incoming-call-card">
              <p className="incoming-call-eyebrow">Incoming video call</p>
              <h2>{incomingCall.fromUserName || 'A match'} is calling</h2>
              <p>Open the call now or decline it.</p>
              <div className="incoming-call-actions">
                <button type="button" className="incoming-call-decline" onClick={handleDeclineIncomingCall}>
                  Decline
                </button>
                <button type="button" className="incoming-call-accept" onClick={handleAcceptIncomingCall}>
                  Answer
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </AppProvider>
    </ErrorBoundary>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
