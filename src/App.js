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
import PublicInfoPage from './components/PublicInfoPage';
import DatingNavigation from './components/DatingNavigation';
import DiscoveryCards from './components/DiscoveryCards';
import BrowseProfiles from './components/BrowseProfiles';
import Matches from './components/Matches';
import DatingMessaging from './components/DatingMessaging';
import DatingProfile from './components/DatingProfile';
import DatingProfileView from './components/DatingProfileView';
import MPINSetup from './components/MPINSetup';
import VideoDating from './components/VideoDating';
import ChatRooms from './components/ChatRooms';
import ChatRoomView from './components/ChatRoomView';
import LobbyChat from './components/LobbyChat';
import SocialHub from './components/SocialHub';
import AdminDashboard from './components/AdminDashboard';
import AdminModeration from './components/AdminModeration/AdminModeration';
import SOSAlert from './components/SOSAlert';
import AchievementsPage from './components/AchievementsPage';
import AchievementNotification from './components/AchievementNotification';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import CatfishDetectionDashboard from './components/CatfishDetectionDashboard';
import ConversationQualityMeter from './components/ConversationQualityMeter';
import DateSafetyKit from './components/DateSafetyKit';
import DoubleDateGroups from './components/DoubleDateGroups';
import EventsList from './components/EventsList';
import IcebreakerVideoRecorder from './components/IcebreakerVideoRecorder';
import MomentsFeed from './components/MomentsFeed';
import PhotoABTestDashboard from './components/PhotoABTestDashboard';
import ProfileResetPanel from './components/ProfileResetPanel';
import ReferralDashboard from './components/ReferralDashboard';
import VideoVerificationPrompt from './components/VideoVerificationPrompt';
import IntroductionsWidget from './components/IntroductionsWidget';
import StatusPreferenceManager from './components/StatusPreferenceManager';
import SubscriptionPage from './components/SubscriptionPage/SubscriptionPage';
import FeatureHub from './components/FeatureHub';
import DailyChallengesModal from './components/DailyChallengesModal';
import BoostPurchasePanel from './components/BoostPurchasePanel';
import StreakLeaderboard from './components/StreakLeaderboard';
import SmartRewindHistory from './components/dating/SmartRewindHistory';
import PrioritySubscriptionPanel from './components/PrioritySubscriptionPanel';
import TemplatePerformance from './components/TemplatePerformance';
import PrivacyPolicyPage from './components/LegalPages/PrivacyPolicyPage';
import TermsOfServicePage from './components/LegalPages/TermsOfServicePage';
import RefundPolicyPage from './components/LegalPages/RefundPolicyPage';
import useAchievements from './hooks/useAchievements';
import datingProfileService from './services/datingProfileService';
import datingMessagingService from './services/datingMessagingService';
import notificationService from './services/notificationService';
import videoCallService from './services/videoCallService';
import icebreakerVideoService from './services/icebreakerVideoService';
import { BACKEND_BASE_URL } from './utils/api';
import {
  clearStoredAuthData,
  getStoredAuthToken,
  getStoredUserData,
  storeAuthToken,
  storeUserData,
  setPreferredLoginMethod
} from './utils/auth';

const ADMIN_DASHBOARD_ROUTE = '/admin-dashboard';
const DEFAULT_AUTHENTICATED_ROUTE = '/discover';
const DEFAULT_MESSAGES_ROUTE = '/messages';
const PUBLIC_LANGUAGE_STORAGE_KEY = 'linkup-public-language';
const SUPPORTED_PUBLIC_LANGUAGES = new Set(['en', 'ml']);

const normalizePublicLanguage = (language) =>
  SUPPORTED_PUBLIC_LANGUAGES.has(language) ? language : 'en';

const getInitialPublicLanguage = () => {
  if (typeof window === 'undefined') {
    return 'en';
  }

  const storedLanguage = window.localStorage.getItem(PUBLIC_LANGUAGE_STORAGE_KEY);
  if (storedLanguage) {
    return normalizePublicLanguage(storedLanguage);
  }

  const browserLanguage = String(window.navigator?.language || '').toLowerCase();
  return browserLanguage.startsWith('ml') ? 'ml' : 'en';
};

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

  if (targetPath.startsWith('/sosalert') || targetPath.startsWith('/date-safety')) {
    return 'sosalert';
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

  if (targetPath.startsWith('/more')) {
    return 'more';
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

const DailyChallengesRoute = ({ onNavigateToPath }) => (
  <DailyChallengesModal
    isOpen
    onClose={() => onNavigateToPath('/more')}
  />
);

const PreferencesPriorityRoute = ({ onNavigateToPath }) => (
  <PrioritySubscriptionPanel
    onClose={() => onNavigateToPath('/more')}
  />
);

const SmartRewindRoute = () => (
  <SmartRewindHistory />
);

const OpeningTemplatesRoute = ({ onNavigateToPath }) => (
  <TemplatePerformance
    onClose={() => onNavigateToPath('/more')}
  />
);

const IcebreakerVideosRoute = ({ onNavigateToPath }) => (
  <IcebreakerVideoRecorder
    onUploadSuccess={async (uploadPayload) => {
      await icebreakerVideoService.uploadVideo(uploadPayload);
      onNavigateToPath('/more');
    }}
    onCancel={() => onNavigateToPath('/more')}
  />
);

const StatusPreferencesRoute = ({ onNavigateToPath }) => {
  const location = useLocation();
  const pathMatch = location.pathname.match(/^\/status-preferences\/([^/]+)$/i);
  const queryParams = new URLSearchParams(location.search);
  const matchId = pathMatch?.[1] || queryParams.get('matchId') || location.state?.matchId || null;

  if (!matchId) {
    return (
      <div className="feature-route-empty-state">
        <h1>Status Preferences</h1>
        <p>Open this screen from a specific match to manage activity-sharing privacy.</p>
        <button type="button" onClick={() => onNavigateToPath('/messages')}>
          Choose a match
        </button>
      </div>
    );
  }

  return (
    <StatusPreferenceManager
      matchId={matchId}
      isOpen
      onClose={() => onNavigateToPath(location.state?.returnPath || '/messages')}
    />
  );
};

const AppContent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(() => getStoredUserData());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [lastOpenedMatchRoute, setLastOpenedMatchRoute] = useState('');
  const [incomingCall, setIncomingCall] = useState(null);
  const [publicLanguage, setPublicLanguage] = useState(getInitialPublicLanguage);
  const { achievementNotification, rankNotification } = useAchievements(currentUser?.id);
  const appSocketRef = useRef(null);
  const isAdminSession = isAdminUser(currentUser);
  const defaultAuthenticatedRoute = getDefaultAuthenticatedRouteForUser(currentUser);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(PUBLIC_LANGUAGE_STORAGE_KEY, publicLanguage);
  }, [publicLanguage]);

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

    setLoading(false);
  }, []);

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

    if (isAdminUser(nextUser)) {
      setUnreadCount(0);
      setMatchCount(0);
    } else {
      refreshDatingCounts();
    }

    navigate(getDefaultAuthenticatedRouteForUser(nextUser), { replace: true });
  };

  const handleLogout = () => {
    clearStoredAuthData();
    setCurrentUser(null);
    setIsAuthenticated(false);
    setUnreadCount(0);
    setMatchCount(0);
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
      case 'sosalert':
        navigate('/sosalert');
        break;
      case 'profile':
        navigate('/profile');
        break;
      case 'more':
        navigate('/more');
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
          <Route path="/privacy-policy" element={<PublicInfoPage pageKey="privacy" language={publicLanguage} />} />
          <Route path="/terms" element={<PublicInfoPage pageKey="terms" language={publicLanguage} />} />
          <Route path="/account-deletion" element={<PublicInfoPage pageKey="deletion" language={publicLanguage} />} />
          <Route path="/grievance" element={<PublicInfoPage pageKey="grievance" language={publicLanguage} />} />
          <Route path="/support" element={<PublicInfoPage pageKey="support" language={publicLanguage} />} />
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
                  language={publicLanguage}
                  onLanguageChange={setPublicLanguage}
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
                  language={publicLanguage}
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
                  language={publicLanguage}
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
            path="/admin/moderation"
            element={
              isAuthenticated ? (
                isAdminSession ? (
                  <AdminModeration onLogout={handleLogout} />
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
                  onSelectMatch={(match, returnPath = '/messages', options = {}) =>
                    handleOpenMessages(match, returnPath, options)
                  }
                  onPlanDate={(match, returnPath = '/messages', options = {}) =>
                    handleOpenMessages(match, returnPath, {
                      ...options,
                      focusPlanner: true
                    })
                  }
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
                  onSelectMatch={(match, returnPath = '/matches', options = {}) =>
                    handleOpenMessages(match, returnPath, options)
                  }
                  onPlanDate={(match, returnPath = '/matches', options = {}) =>
                    handleOpenMessages(match, returnPath, {
                      ...options,
                      focusPlanner: true
                    })
                  }
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
              path="sosalert"
              element={<SOSAlert currentUser={currentUser} />}
            />
            <Route
              path="date-safety"
              element={<Navigate to="/sosalert" replace />}
            />
            <Route
              path="social"
              element={
                <SocialHub
                  onMatchCreated={refreshDatingCounts}
                  onBrowseChatrooms={() => navigate('/chatrooms', { state: { returnPath: '/social' } })}
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
            <Route
              path="mpin-setup"
              element={
                <MPINSetup
                  onComplete={() => navigate('/profile')}
                  onCancel={() => navigate('/profile')}
                />
              }
            />
            <Route path="legal/privacy" element={<PrivacyPolicyPage />} />
            <Route path="legal/terms" element={<TermsOfServicePage />} />
            <Route path="legal/refund" element={<RefundPolicyPage />} />
            <Route path="achievements" element={<AchievementsPage />} />
            <Route path="leaderboards" element={<AchievementsPage defaultTab="leaderboards" />} />
            <Route
              path="daily-challenges"
              element={<DailyChallengesRoute onNavigateToPath={(path) => navigate(path)} />}
            />
            <Route path="boost" element={<BoostPurchasePanel />} />
            <Route path="boosts" element={<BoostPurchasePanel />} />
            <Route path="analytics" element={<AnalyticsDashboard />} />
            <Route path="conversation-quality" element={<ConversationQualityMeter />} />
            <Route path="referrals" element={<ReferralDashboard />} />
            <Route path="profile-reset" element={<ProfileResetPanel />} />
            <Route path="moments" element={<MomentsFeed />} />
            <Route
              path="icebreaker-videos"
              element={<IcebreakerVideosRoute onNavigateToPath={(path) => navigate(path)} />}
            />
            <Route
              path="icebreaker-recorder"
              element={<IcebreakerVideosRoute onNavigateToPath={(path) => navigate(path)} />}
            />
            <Route path="events" element={<EventsList />} />
            <Route path="double-dates" element={<DoubleDateGroups />} />
            <Route path="date-safety-guide" element={<DateSafetyKit />} />
            <Route path="video-verification" element={<VideoVerificationPrompt />} />
            <Route path="catfish-detection" element={<CatfishDetectionDashboard />} />
            <Route path="streaks" element={<StreakLeaderboard />} />
            <Route path="introductions" element={<IntroductionsWidget />} />
            <Route
              path="preferences-priority"
              element={<PreferencesPriorityRoute onNavigateToPath={(path) => navigate(path)} />}
            />
            <Route
              path="smart-rewind"
              element={<SmartRewindRoute />}
            />
            <Route
              path="opening-templates"
              element={<OpeningTemplatesRoute onNavigateToPath={(path) => navigate(path)} />}
            />
            <Route
              path="status-preferences"
              element={<StatusPreferencesRoute onNavigateToPath={(path) => navigate(path)} />}
            />
            <Route
              path="status-preferences/:matchId"
              element={<StatusPreferencesRoute onNavigateToPath={(path) => navigate(path)} />}
            />
            <Route path="photo-ab-testing" element={<PhotoABTestDashboard />} />
            <Route path="photo-ab-test" element={<PhotoABTestDashboard />} />
            <Route path="subscription" element={<SubscriptionPage />} />
            <Route path="more" element={<FeatureHub />} />
            <Route path="*" element={<Navigate to={DEFAULT_AUTHENTICATED_ROUTE} replace />} />
          </Route>
        </Routes>
        
        {/* Achievement & Rank Notifications */}
        {isAuthenticated && !isAdminSession ? (
          <>
            <AchievementNotification notification={achievementNotification} type="achievement" />
            <AchievementNotification notification={rankNotification} type="rank" />
          </>
        ) : null}

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
