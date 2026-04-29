import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import io from 'socket.io-client';
import MessageToolbar from './MessageToolbar';
import DateJourneyPanel from './DateJourneyPanel';
import ReactionPicker from './ReactionPicker';
import MessageReactionDisplay from './MessageReactionDisplay';
import StreakBadge from './StreakBadge';
import IcebreakerVideoPlayer from './IcebreakerVideoPlayer';
import MilestoneNotification from './MilestoneNotification';
import EngagementScoreDisplay from './EngagementScoreDisplay';
import ModerationWarning from './ModerationWarning';
import ConversationQualityMeter from './ConversationQualityMeter';
import { useLocation } from '../router';
import datingMessagingService from '../services/datingMessagingService';
import datingProfileService from '../services/datingProfileService';
import messagingEnhancedService from '../services/messagingEnhancedService';
import notificationService from '../services/notificationService';
import moderationService from '../services/moderationService';
import useStreaks from '../hooks/useStreaks';
import useIcebreakerVideos from '../hooks/useIcebreakerVideos';
import { getStoredUserData } from '../utils/auth';
import { BACKEND_BASE_URL } from '../utils/api';
import { getConversationRescuePlan } from '../utils/datingRescue';
import {
  buildLocalIdentityPack,
  buildSmartRevivePrompts,
  calculateConversationHealth
} from '../utils/datingPhaseTwo';
import '../styles/DatingMessaging.css';

const REACTION_OPTIONS = ['❤️', '👍', '😂', '🔥', '👏'];
const SEARCH_LOAD_LIMIT = 200;
const DISAPPEARING_DURATION_OPTIONS = [
  { value: 3600, label: '1 hour' },
  { value: 86400, label: '24 hours' },
  { value: 604800, label: '7 days' }
];

const unwrapMessagePayload = (payload) => payload?.data ?? payload ?? null;

const inferMessageType = (message) => {
  if (message.message_type || message.messageType) {
    return message.message_type || message.messageType;
  }

  const mediaType = message.media_type || message.mediaType;
  if (mediaType === 'voice') {
    return 'audio';
  }

  return mediaType || 'text';
};

const normalizeMessage = (message, currentUserId) => ({
  id: message.id,
  text: message.message || message.text || '',
  senderId: message.from_user_id ?? message.fromUserId ?? message.senderId,
  toUserId: message.to_user_id ?? message.toUserId ?? null,
  timestamp: message.created_at || message.createdAt || message.timestamp || new Date().toISOString(),
  isRead: Boolean(message.is_read ?? message.isRead),
  readAt: message.read_at || message.readAt || null,
  mediaType: message.media_type || message.mediaType || null,
  mediaUrl: message.media_url || message.mediaUrl || null,
  messageType: inferMessageType(message),
  duration: message.duration ?? null,
  isDisappearing: Boolean(message.is_disappearing ?? message.isDisappearing),
  disappearsAt: message.disappears_at || message.disappearsAt || null,
  disappearAfterSeconds: Number.parseInt(
    message.disappear_after_seconds ?? message.disappearAfterSeconds,
    10
  ) || null,
  locationName: message.location_name || message.locationName || null,
  reactions: Array.isArray(message.reactions)
    ? message.reactions.map((reaction) => ({
        emoji: reaction.emoji,
        count: Number.parseInt(reaction.count, 10) || 0,
        reactedByCurrentUser: Boolean(
          reaction.reactedByCurrentUser ?? reaction.reacted_by_current_user
        )
      }))
    : [],
  isOwn: Number(message.from_user_id ?? message.fromUserId ?? message.senderId) === Number(currentUserId)
});

const buildIcebreakers = (match = {}) => {
  const interestList = Array.isArray(match.interests) ? match.interests.filter(Boolean) : [];
  const suggestions = [];

  if (interestList[0]) {
    suggestions.push(`I saw you're into ${interestList[0]}. What do you enjoy most about it?`);
  }

  if (match.occupation) {
    suggestions.push(`What do you enjoy most about working in ${match.occupation}?`);
  }

  if (match.relationshipGoals) {
    suggestions.push(`What does a great ${match.relationshipGoals} connection look like to you?`);
  }

  if (match.location?.city) {
    suggestions.push(`What's something fun to do in ${match.location.city}?`);
  }

  suggestions.push('What usually makes a conversation feel easy for you?');
  suggestions.push('What is something simple that always improves your day?');

  return [...new Set(suggestions)].slice(0, 4);
};

const getReadReceiptLabel = (message) => {
  if (!message?.isOwn) {
    return '';
  }

  if (!message.isRead) {
    return 'Sent';
  }

  if (!message.readAt) {
    return 'Read';
  }

  return `Read ${new Date(message.readAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })}`;
};

const getDisappearingLabel = (message, now) => {
  if (!message?.isDisappearing) {
    return '';
  }

  if (!message.disappearsAt) {
    return 'Disappearing message';
  }

  const remainingMs = new Date(message.disappearsAt).getTime() - now;
  if (remainingMs <= 0) {
    return 'Disappearing now';
  }

  const totalMinutes = Math.ceil(remainingMs / 60000);
  if (totalMinutes < 60) {
    return `Disappears in ${totalMinutes}m`;
  }

  const totalHours = Math.ceil(totalMinutes / 60);
  if (totalHours < 24) {
    return `Disappears in ${totalHours}h`;
  }

  return `Disappears in ${Math.ceil(totalHours / 24)}d`;
};

const parseLocationMessage = (text) => {
  if (!text || !text.includes('https://maps.google.com/?q=')) {
    return null;
  }

  const lines = text.split('\n').filter(Boolean);
  const mapUrl = lines.find((line) => line.startsWith('https://maps.google.com/?q='));
  if (!mapUrl) {
    return null;
  }

  const label = lines
    .filter((line) => line !== mapUrl)
    .join('\n')
    .trim();

  return {
    label: label || 'Shared location',
    mapUrl
  };
};

const DatingMessaging = ({
  matchedProfile,
  matchId,
  onScheduleVideoCall,
  onVideoCall,
  onBack,
  onViewProfile,
  onConversationActivity
}) => {
  const currentUser = getStoredUserData();
  const location = useLocation();
  const currentUserId = currentUser?.id;
  const [conversationMatch, setConversationMatch] = useState(matchedProfile || null);
  const [loadingMatch, setLoadingMatch] = useState(Boolean(matchId) && !matchedProfile);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState('');
  const [statusBanner, setStatusBanner] = useState(null);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(() =>
    notificationService.getPermissionStatus().permission
  );
  const [activeReactionPickerMessageId, setActiveReactionPickerMessageId] = useState(null);
  const [reactionLoadingMessageId, setReactionLoadingMessageId] = useState(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceRecordingDuration, setVoiceRecordingDuration] = useState(0);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [disappearingEnabled, setDisappearingEnabled] = useState(false);
  const [disappearAfterSeconds, setDisappearAfterSeconds] = useState(3600);
  const [securitySetupReady, setSecuritySetupReady] = useState(false);
  const [countdownNow, setCountdownNow] = useState(Date.now());
  const [showDatePlanner, setShowDatePlanner] = useState(Boolean(location.state?.focusPlanner));
  const [matchStatePending, setMatchStatePending] = useState('');
  const [streakDays, setStreakDays] = useState(0);
  const [engagementScore, setEngagementScore] = useState(0);
  const [streakActive, setStreakActive] = useState(false);
  const [totalReactions, setTotalReactions] = useState(0);
  const [milestoneNotification, setMilestoneNotification] = useState(null);
  const [moderationWarningOpen, setModerationWarningOpen] = useState(false);
  const [moderationWarningData, setModerationWarningData] = useState({
    severity: 'medium',
    issues: [],
    contentType: 'message'
  });
  const [pendingMessage, setPendingMessage] = useState(null);
  const [showQualityMeter, setShowQualityMeter] = useState(false);
  const [showIcebreakerPlayer, setShowIcebreakerPlayer] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const mediaInputRef = useRef(null);
  const voiceRecorderRef = useRef(null);
  const voiceIntervalRef = useRef(null);
  const statusTimeoutRef = useRef(null);
  const messageRefs = useRef({});
  const activeMatch = conversationMatch || matchedProfile || null;
  const activeMatchId = activeMatch?.matchId || matchId || null;
  const activeMatchUserId = activeMatch?.userId || null;
  const { currentStreak } = useStreaks(activeMatchId);
  const { matchVideo, fetchMatchVideo, rateVideo } = useIcebreakerVideos();
  const journey = activeMatch?.journey || null;
  const sharedActionSuggestions = Array.isArray(journey?.sharedActions) ? journey.sharedActions : [];
  const notificationsAvailable = notificationService.getPermissionStatus().available;
  const icebreakers = useMemo(() => buildIcebreakers(activeMatch), [activeMatch]);
  const identityPack = useMemo(() => buildLocalIdentityPack(activeMatch || {}, currentUser || {}), [activeMatch, currentUser]);
  const conversationRescuePlan = useMemo(
    () => getConversationRescuePlan(activeMatch, messages),
    [activeMatch, messages]
  );
  const conversationHealth = useMemo(
    () => calculateConversationHealth({
      match: activeMatch || {},
      messages,
      currentUserId
    }),
    [activeMatch, currentUserId, messages]
  );
  const revivePrompts = useMemo(
    () => buildSmartRevivePrompts({
      match: activeMatch || {},
      health: conversationHealth,
      identityPack
    }),
    [activeMatch, conversationHealth, identityPack]
  );
  const phaseTwoRescueActions = useMemo(() => {
    const baseActions = Array.isArray(conversationRescuePlan?.actions)
      ? [...conversationRescuePlan.actions]
      : [];

    if (conversationHealth.readyForCall) {
      baseActions.unshift({
        id: 'ready-for-call',
        type: 'message',
        label: 'Ready for a call?',
        message: 'This has felt easy so far. Want to do a quick 15-minute video vibe check this week?'
      });
    }

    revivePrompts.slice(0, 2).forEach((prompt, index) => {
      if (!baseActions.some((action) => action.message === prompt)) {
        baseActions.push({
          id: `phase-two-revive-${index}`,
          type: 'message',
          label: index === 0 ? 'Revive gently' : 'Try a better opener',
          message: prompt
        });
      }
    });

    if (activeMatchId) {
      baseActions.push({
        id: 'match-archive',
        type: 'archive',
        label: 'Archive for now'
      });
      baseActions.push({
        id: 'match-snooze',
        type: 'snooze',
        label: 'Snooze 3 days'
      });
    }

    return baseActions;
  }, [activeMatchId, conversationHealth.readyForCall, conversationRescuePlan, revivePrompts]);
  const identityStarterChips = useMemo(
    () => [
      ...(identityPack.languageIcebreakers || []).slice(0, 1),
      ...(identityPack.cityBasedPrompts || []).slice(0, 1)
    ].filter(Boolean),
    [identityPack]
  );
  const showPhaseTwoRescueStrip = Boolean(
    !showDatePlanner &&
      phaseTwoRescueActions.length > 0 &&
      (
        conversationHealth.readyForCall ||
        conversationHealth.needsRevive ||
        (conversationRescuePlan?.actions?.length || 0) > 0
      )
  );
  const showComposerStarters = messages.length < 3 && icebreakers.length > 0;

  const showStatus = useCallback((message, tone = 'info') => {
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }

    setStatusBanner({ message, tone });
    statusTimeoutRef.current = setTimeout(() => {
      setStatusBanner(null);
      statusTimeoutRef.current = null;
    }, 4000);
  }, []);

  const notifyConversationActivity = useCallback(() => {
    onConversationActivity?.();
  }, [onConversationActivity]);

  const appendMessage = useCallback((rawMessage) => {
    if (!rawMessage) {
      return;
    }

    const nextMessage = normalizeMessage(rawMessage, currentUserId);
    setMessages((currentMessages) => (
      currentMessages.some((message) => String(message.id) === String(nextMessage.id))
        ? currentMessages
        : [...currentMessages, nextMessage]
    ));
  }, [currentUserId]);

  const loadMessages = useCallback(async (showLoader = true, options = {}) => {
    if (!activeMatchId || !currentUserId) {
      setMessages([]);
      return;
    }

    if (showLoader) {
      setLoadingMessages(true);
    }

    setError('');

    try {
      const response = await datingMessagingService.getMessages(activeMatchId, {
        limit: options.limit || 50,
        offset: options.offset || 0
      });
      setMessages((response || []).map((message) => normalizeMessage(message, currentUserId)));
      notifyConversationActivity();
    } catch (loadError) {
      setError(typeof loadError === 'string' ? loadError : 'Failed to load messages');
    } finally {
      if (showLoader) {
        setLoadingMessages(false);
      }
    }
  }, [activeMatchId, currentUserId, notifyConversationActivity]);

  // Fetch streak and engagement score data
  const loadStreakData = useCallback(async () => {
    if (!activeMatchId) {
      return;
    }

    try {
      // Fetch streak information
      const streakResponse = await fetch(`/api/matches/${activeMatchId}/streak`);
      if (streakResponse.ok) {
        const streakData = await streakResponse.json();
        if (streakData.success && streakData.streak) {
          setStreakDays(streakData.streak.streakDays || 0);
          setStreakActive(streakData.streak.isActive !== false);
        }
      }

      // Fetch engagement score
      const scoreResponse = await fetch(`/api/matches/${activeMatchId}/engagement-score`);
      if (scoreResponse.ok) {
        const scoreData = await scoreResponse.json();
        if (scoreData.success) {
          setEngagementScore(scoreData.engagementScore || 0);
          setTotalReactions(scoreData.totalReactions || 0);
        }
      }
    } catch (error) {
      console.error('Error loading streak data:', error);
    }
  }, [activeMatchId]);

  // Load streak data when match changes
  useEffect(() => {
    loadStreakData();
  }, [activeMatchId, loadStreakData]);

  useEffect(() => () => {
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }
    if (voiceIntervalRef.current) {
      clearInterval(voiceIntervalRef.current);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadConversationMatch = async () => {
      if (matchedProfile && (!matchId || String(matchedProfile.matchId) === String(matchId))) {
        setConversationMatch(matchedProfile);
        setLoadingMatch(false);
        return;
      }

      if (!matchId) {
        setConversationMatch(matchedProfile || null);
        setLoadingMatch(false);
        return;
      }

      setConversationMatch(null);
      setLoadingMatch(true);
      setError('');

      try {
        const resolvedMatch = await datingProfileService.getMatchById(matchId);
        if (!cancelled) {
          setConversationMatch(resolvedMatch);
        }
      } catch (matchError) {
        if (!cancelled) {
          setError(typeof matchError === 'string' ? matchError : 'Failed to load conversation');
        }
      } finally {
        if (!cancelled) {
          setLoadingMatch(false);
        }
      }
    };

    loadConversationMatch();

    return () => {
      cancelled = true;
    };
  }, [matchId, matchedProfile]);

  useEffect(() => {
    setOtherUserOnline(false);
    setOtherUserTyping(false);
    setActiveReactionPickerMessageId(null);
    setHighlightedMessageId(null);
    setDisappearingEnabled(false);
    setSecuritySetupReady(false);
    setStatusBanner(null);
    setInputMessage(location.state?.prefillMessage || '');
  }, [activeMatchId, location.state?.prefillMessage]);

  useEffect(() => {
    setShowDatePlanner(Boolean(location.state?.focusPlanner));
  }, [activeMatchId, location.state?.focusPlanner, location.state?.prefillMessage]);

  useEffect(() => {
    if (activeMatchId && currentUserId) {
      loadMessages();
    } else {
      setMessages([]);
    }
  }, [activeMatchId, currentUserId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, otherUserTyping]);

  useEffect(() => {
    if (!highlightedMessageId) {
      return undefined;
    }

    const messageElement = messageRefs.current[String(highlightedMessageId)];
    if (!messageElement) {
      return undefined;
    }

    messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timeoutId = window.setTimeout(() => {
      setHighlightedMessageId(null);
    }, 2500);

    return () => window.clearTimeout(timeoutId);
  }, [highlightedMessageId, messages]);

  useEffect(() => {
    const hasActiveDisappearingMessages = messages.some(
      (message) => message.isDisappearing && message.disappearsAt
    );

    if (!hasActiveDisappearingMessages) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setCountdownNow(Date.now());
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [messages]);

  useEffect(() => {
    if (!currentUserId) {
      return undefined;
    }

    const socket = io(BACKEND_BASE_URL, {
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('user_online', currentUserId);
    });

    socket.on('user_status', ({ userId, online }) => {
      if (Number(userId) === Number(activeMatchUserId)) {
        setOtherUserOnline(Boolean(online));
      }
    });

    socket.on('new_message', (payload) => {
      if (Number(payload.matchId) !== Number(activeMatchId)) {
        return;
      }

      appendMessage({
        id: payload.messageId || `${payload.matchId}-${payload.fromUserId}-${payload.timestamp}`,
        message: payload.message,
        fromUserId: payload.fromUserId,
        createdAt: payload.timestamp,
        mediaType: payload.mediaType,
        mediaUrl: payload.mediaUrl,
        duration: payload.duration,
        messageType: payload.messageType,
        isDisappearing: payload.isDisappearing,
        disappearsAt: payload.disappearsAt,
        disappearAfterSeconds: payload.disappearAfterSeconds,
        reactions: payload.reactions || []
      });
      setOtherUserTyping(false);
      loadMessages(false);
    });

    socket.on('user_typing', ({ isTyping }) => {
      setOtherUserTyping(Boolean(isTyping));
    });

    socket.on('messages_read', (payload = {}) => {
      if (Number(payload.matchId) !== Number(activeMatchId)) {
        return;
      }

      const readMessageIds = new Set((payload.messageIds || []).map((messageId) => String(messageId)));

      setMessages((currentMessages) =>
        currentMessages.map((message) => (
          readMessageIds.has(String(message.id))
            ? {
                ...message,
                isRead: true,
                readAt: payload.readAt || message.readAt
              }
            : message
        ))
      );
    });

    socket.on('message_reaction_updated', (payload = {}) => {
      if (Number(payload.matchId) !== Number(activeMatchId)) {
        return;
      }

      setMessages((currentMessages) =>
        currentMessages.map((message) => (
          String(message.id) === String(payload.messageId)
            ? {
                ...message,
                reactions: Array.isArray(payload.reactions) ? payload.reactions : []
              }
            : message
        ))
      );
    });

    // Real-time streak milestone notifications
    socket.on('streak_milestone_reached', (payload = {}) => {
      if (Number(payload.matchId) !== Number(activeMatchId)) {
        return;
      }

      // Update streak data
      setStreakDays(payload.streakDays || 0);
      setStreakActive(payload.isActive !== false);

      // Show milestone notification
      setMilestoneNotification({
        milestone: payload.milestone || payload.streakDays,
        userName: payload.userName || activeMatch?.firstName || 'Your match'
      });

      // Play notification sound if enabled
      notificationService.playNotificationSound?.();
    });

    // Real-time engagement score updates
    socket.on('engagement_score_updated', (payload = {}) => {
      if (Number(payload.matchId) !== Number(activeMatchId)) {
        return;
      }

      setEngagementScore(payload.engagementScore || 0);
      setStreakDays(payload.streakDays || 0);
      setTotalReactions(payload.totalReactions || 0);
    });

    // Streak data sync
    socket.on('streak_data_sync', (payload = {}) => {
      if (Number(payload.matchId) !== Number(activeMatchId)) {
        return;
      }

      setStreakDays(payload.streakDays || 0);
      setEngagementScore(payload.engagementScore || 0);
      setStreakActive(payload.isActive !== false);
      setTotalReactions(payload.totalReactions || 0);
    });

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      socket.disconnect();
      socketRef.current = null;
    };
  }, [activeMatchId, activeMatchUserId, appendMessage, currentUserId, loadMessages]);

  const stopTypingSignal = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (socketRef.current && activeMatchUserId) {
      socketRef.current.emit('typing', {
        toUserId: activeMatchUserId,
        isTyping: false
      });
    }
  };

  const sendTextMessage = useCallback(async (messageText, options = {}) => {
    if (!activeMatchId) {
      return null;
    }

    const trimmedMessage = messageText.trim();
    if (!trimmedMessage) {
      return null;
    }

    if (options.disappearing) {
      return messagingEnhancedService.sendDisappearingMessage(
        activeMatchId,
        trimmedMessage,
        options.disappearAfterSeconds || disappearAfterSeconds
      );
    }

    const response = await datingMessagingService.sendMessage(activeMatchId, trimmedMessage);
    return unwrapMessagePayload(response);
  }, [activeMatchId, disappearAfterSeconds]);

  const sendMediaAsset = useCallback(async (file, mediaType, options = {}) => {
    if (!activeMatchId) {
      return null;
    }

    const response = await datingMessagingService.sendMediaMessage(activeMatchId, file, mediaType, options);
    return unwrapMessagePayload(response);
  }, [activeMatchId]);

  const handleSendMessage = async () => {
    const trimmedMessage = inputMessage.trim();

    if (!trimmedMessage || !activeMatchId) {
      return;
    }

    setError('');

    // Scan content for moderation flags
    try {
      const scanResult = await moderationService.scanText(trimmedMessage);

      // If content is flagged with medium or high severity, show warning
      if (moderationService.shouldShowWarning(scanResult.severity)) {
        setPendingMessage(trimmedMessage);
        setModerationWarningData({
          severity: scanResult.severity,
          issues: scanResult.issues,
          contentType: 'message'
        });
        setModerationWarningOpen(true);
        return; // Stop here - user must confirm
      }

      // Content is clean or low-severity, proceed with sending
      await sendMessageNow(trimmedMessage);
    } catch (err) {
      console.error('Moderation scan error:', err);
      // On scan error, proceed anyway to not block users
      await sendMessageNow(trimmedMessage);
    }
  };

  const sendMessageNow = async (messageText) => {
    setSendingMessage(true);

    try {
      const createdMessage = await sendTextMessage(messageText, {
        disappearing: disappearingEnabled,
        disappearAfterSeconds
      });

      appendMessage(createdMessage);
      setInputMessage('');
      stopTypingSignal();
      notifyConversationActivity();

      if (disappearingEnabled) {
        const activeDuration = DISAPPEARING_DURATION_OPTIONS.find(
          (option) => option.value === disappearAfterSeconds
        );
        showStatus(
          `Disappearing message sent${activeDuration ? ` (${activeDuration.label})` : ''}.`,
          'success'
        );
      }
    } catch (sendError) {
      setError(typeof sendError === 'string' ? sendError : 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleModerationContinue = async () => {
    if (!pendingMessage) return;

    setModerationWarningOpen(false);
    await sendMessageNow(pendingMessage);
    setPendingMessage(null);
  };

  const handleModerationCancel = () => {
    setModerationWarningOpen(false);
    setPendingMessage(null);
  };

  const handleTyping = (event) => {
    const { value } = event.target;
    setInputMessage(value);

    if (!socketRef.current || !activeMatchUserId) {
      return;
    }

    socketRef.current.emit('typing', {
      toUserId: activeMatchUserId,
      isTyping: true
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTypingSignal();
    }, 1500);
  };

  const handleUseIcebreaker = (text) => {
    setInputMessage(text);
    inputRef.current?.focus();
  };

  const handleSharedAction = (action) => {
    if (!action?.message) {
      return;
    }

    if (action.type === 'vote') {
      setShowDatePlanner(true);
    }

    setInputMessage(action.message);
    inputRef.current?.focus();
  };

  const handleMatchStateUpdate = async (state) => {
    if (!activeMatchId) {
      return;
    }

    setMatchStatePending(state);
    setError('');

    try {
      const response = await datingProfileService.updateMatchState(activeMatchId, {
        state,
        snoozedUntil:
          state === 'snoozed'
            ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
            : null
      });

      setConversationMatch((currentMatch) => (
        currentMatch
          ? {
              ...currentMatch,
              management: response.management
            }
          : currentMatch
      ));
      showStatus(
        state === 'archived'
          ? 'Conversation archived. You can bring it back from your matches list.'
          : state === 'snoozed'
            ? 'Conversation snoozed for 3 days.'
            : 'Conversation moved back to active.',
        'success'
      );
    } catch (stateError) {
      setError(typeof stateError === 'string' ? stateError : 'Failed to update conversation state');
    } finally {
      setMatchStatePending('');
    }
  };

  const handleConversationRescueAction = (action) => {
    if (!action) {
      return;
    }

    if (action.type === 'plan') {
      setShowDatePlanner(true);
      return;
    }

    if (action.type === 'archive') {
      void handleMatchStateUpdate('archived');
      return;
    }

    if (action.type === 'snooze') {
      void handleMatchStateUpdate('snoozed');
      return;
    }

    if (action.message) {
      setInputMessage(action.message);
      inputRef.current?.focus();
    }
  };

  const handleEnableNotifications = async () => {
    const granted = await notificationService.requestPermission();
    setNotificationPermission(notificationService.getPermissionStatus().permission);

    if (!granted && notificationService.getPermissionStatus().permission === 'denied') {
      setError('Notifications are blocked in your browser settings.');
    }
  };

  const handleToggleReaction = async (messageId, emoji) => {
    setReactionLoadingMessageId(messageId);

    try {
      const response = await datingMessagingService.toggleReaction(messageId, emoji);
      const nextReactions = unwrapMessagePayload(response)?.reactions || [];

      setMessages((currentMessages) =>
        currentMessages.map((message) => (
          String(message.id) === String(messageId)
            ? {
                ...message,
                reactions: nextReactions
              }
            : message
        ))
      );
      setActiveReactionPickerMessageId(null);
    } catch (reactionError) {
      setError(typeof reactionError === 'string' ? reactionError : 'Failed to update reaction');
    } finally {
      setReactionLoadingMessageId(null);
    }
  };

  const handleImageSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !activeMatchId) {
      return;
    }

    setSendingMedia(true);
    setError('');

    try {
      const createdMessage = await sendMediaAsset(file, 'image');
      appendMessage(createdMessage);
      notifyConversationActivity();
    } catch (sendError) {
      setError(typeof sendError === 'string' ? sendError : 'Failed to send image');
    } finally {
      setSendingMedia(false);
      if (mediaInputRef.current) {
        mediaInputRef.current.value = '';
      }
    }
  };

  const startVoiceRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice recording is not supported on this device or browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const duration = voiceRecordingDuration;

        setSendingMedia(true);
        try {
          const createdMessage = unwrapMessagePayload(
            await datingMessagingService.sendVoiceNote(activeMatchId, audioBlob, duration)
          );
          appendMessage(createdMessage);
          notifyConversationActivity();
        } catch (sendError) {
          setError(typeof sendError === 'string' ? sendError : 'Failed to send voice note');
        } finally {
          setSendingMedia(false);
        }

        stream.getTracks().forEach((track) => track.stop());
        setIsRecordingVoice(false);
        setVoiceRecordingDuration(0);
      };

      voiceRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecordingVoice(true);
      setVoiceRecordingDuration(0);

      voiceIntervalRef.current = setInterval(() => {
        setVoiceRecordingDuration((currentValue) => currentValue + 1);
      }, 1000);
    } catch (recordingError) {
      setError('Could not access microphone. Please check permissions.');
      console.error(recordingError);
    }
  };

  const stopVoiceRecording = () => {
    if (voiceIntervalRef.current) {
      clearInterval(voiceIntervalRef.current);
      voiceIntervalRef.current = null;
    }

    if (voiceRecorderRef.current && voiceRecorderRef.current.state !== 'inactive') {
      voiceRecorderRef.current.stop();
    }
  };

  const handleToolbarAttachments = async (attachments) => {
    if (!activeMatchId || !Array.isArray(attachments) || attachments.length === 0) {
      return;
    }

    setSendingMedia(true);
    setError('');

    try {
      for (const attachment of attachments) {
        const createdMessage = await sendMediaAsset(attachment.file, attachment.type);
        appendMessage(createdMessage);
      }

      notifyConversationActivity();
      showStatus(
        `${attachments.length} attachment${attachments.length === 1 ? '' : 's'} sent.`,
        'success'
      );
    } catch (attachmentError) {
      setError(typeof attachmentError === 'string' ? attachmentError : 'Failed to send attachment');
    } finally {
      setSendingMedia(false);
    }
  };

  const handleShareLocation = async (sharedLocation) => {
    if (!activeMatchId || !sharedLocation) {
      return;
    }

    setSendingMessage(true);
    setError('');

    try {
      const locationMessage = [
        `Shared location: ${sharedLocation.name}`,
        `https://maps.google.com/?q=${sharedLocation.lat},${sharedLocation.lng}`
      ].join('\n');

      const createdMessage = await sendTextMessage(locationMessage);
      appendMessage(createdMessage);
      notifyConversationActivity();
      showStatus('Location shared in chat.', 'success');
    } catch (locationError) {
      setError(typeof locationError === 'string' ? locationError : 'Failed to share location');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleToolbarMore = async (action) => {
    if (!activeMatchId) {
      return;
    }

    setError('');

    try {
      if (action === 'encrypt') {
        const response = await messagingEnhancedService.initializeEncryption(activeMatchId);
        setSecuritySetupReady(true);
        showStatus(response.message || 'Secure chat keys initialized for this match.', 'success');
        return;
      }

      if (action === 'backup') {
        await messagingEnhancedService.createBackup(activeMatchId);
        showStatus('Chat backup created.', 'success');
        return;
      }

      if (action === 'disappearing') {
        setDisappearingEnabled((currentValue) => {
          const nextValue = !currentValue;
          showStatus(
            nextValue ? 'Disappearing mode is on for new messages.' : 'Disappearing mode is off.',
            nextValue ? 'success' : 'info'
          );
          return nextValue;
        });
      }
    } catch (actionError) {
      setError(typeof actionError === 'string' ? actionError : 'Unable to complete that action');
    }
  };

  const handleSearchSelect = async (message) => {
    if (!message?.id) {
      return;
    }

    if (!messages.some((currentMessage) => String(currentMessage.id) === String(message.id))) {
      await loadMessages(false, { limit: SEARCH_LOAD_LIMIT });
    }

    setHighlightedMessageId(String(message.id));
    showStatus('Jumped to the matching message.', 'success');
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderTextMessage = (message) => {
    const locationPayload = parseLocationMessage(message.text);

    if (locationPayload) {
      return (
        <div className="message-location-card">
          <span className="message-location-label">{locationPayload.label}</span>
          <a
            href={locationPayload.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="message-location-link"
          >
            Open in Maps
          </a>
        </div>
      );
    }

    return <p>{message.text}</p>;
  };

  const renderMessageBody = (message) => {
    if (message.mediaType === 'image' && message.mediaUrl) {
      return (
        <div className="message-media">
          <img
            src={message.mediaUrl}
            alt="Shared"
            className="message-image"
            onClick={() => window.open(message.mediaUrl, '_blank')}
          />
        </div>
      );
    }

    if ((message.mediaType === 'voice' || message.mediaType === 'audio') && message.mediaUrl) {
      return (
        <div className="message-media voice-message">
          <audio controls src={message.mediaUrl} className="voice-audio" />
          {message.duration ? (
            <span className="voice-duration">{formatDuration(message.duration)}</span>
          ) : null}
        </div>
      );
    }

    if (message.mediaType === 'video' && message.mediaUrl) {
      return (
        <div className="message-media">
          <video controls src={message.mediaUrl} className="message-video" />
        </div>
      );
    }

    if (message.mediaType === 'document' && message.mediaUrl) {
      return (
        <div className="message-media message-document">
          <span className="message-document-label">Document attachment</span>
          <a
            href={message.mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="message-document-link"
          >
            Open document
          </a>
        </div>
      );
    }

    return renderTextMessage(message);
  };

  if (loadingMatch && !activeMatch) {
    return (
      <div className="messaging-empty">
        <p>Loading conversation...</p>
      </div>
    );
  }

  if (!activeMatch) {
    return (
      <div className="messaging-empty">
        <p>{error || 'Select a match to start messaging'}</p>
        {onBack ? (
          <button type="button" className="btn-message-back" onClick={onBack}>
            Back
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="dating-messaging-container">
      {milestoneNotification && (
        <MilestoneNotification
          milestone={milestoneNotification.milestone}
          userName={milestoneNotification.userName}
          onDismiss={() => setMilestoneNotification(null)}
        />
      )}

      {moderationWarningOpen && (
        <ModerationWarning
          isOpen={moderationWarningOpen}
          severity={moderationWarningData.severity}
          issues={moderationWarningData.issues}
          contentType={moderationWarningData.contentType}
          onContinue={handleModerationContinue}
          onCancel={handleModerationCancel}
          loading={sendingMessage}
        />
      )}

      <div className="messaging-header">
        <div className="messaging-header-left">
          {onBack ? (
            <button type="button" className="btn-message-back" onClick={onBack}>
              Back
            </button>
          ) : null}

          <button
            type="button"
            className="profile-info profile-info-button"
            onClick={() => onViewProfile?.(activeMatch)}
          >
            {activeMatch.photos?.[0] ? (
              <img src={activeMatch.photos[0]} alt={activeMatch.firstName} />
            ) : (
              <div className="profile-avatar-fallback">{activeMatch.firstName?.charAt(0) || '?'}</div>
            )}
            <div>
              <h3>{activeMatch.firstName}</h3>
              <span className="online-status">
                {otherUserTyping ? 'Typing...' : otherUserOnline ? 'Online' : 'Chat ready'}
              </span>
            </div>
          </button>

          {activeMatchId && currentStreak && (
            <StreakBadge
              matchId={activeMatchId}
              matchName={activeMatch?.firstName}
              compact={true}
            />
          )}
        </div>

        <div className="messaging-header-actions">
          {securitySetupReady ? (
            <span className="messaging-badge">Secure setup ready</span>
          ) : null}

          {notificationsAvailable && notificationPermission !== 'granted' ? (
            <button
              type="button"
              className="btn-enable-notifications"
              onClick={handleEnableNotifications}
            >
              Enable Alerts
            </button>
          ) : null}

          <button
            type="button"
            className="btn-schedule-call"
            onClick={() => setShowDatePlanner((currentValue) => !currentValue)}
            title="Plan a date"
          >
            {journey?.pendingProposal?.isReceived ? 'Review Plan' : showDatePlanner ? 'Hide Plan' : 'Plan Date'}
          </button>

          <button
            type="button"
            className="btn-quality-meter"
            onClick={() => setShowQualityMeter((current) => !current)}
            title="Conversation quality insights"
          >
            {showQualityMeter ? 'Hide Quality' : 'Quality'}
          </button>

          <button
            type="button"
            className="btn-icebreaker-video"
            onClick={async () => {
              if (!matchVideo) {
                await fetchMatchVideo(activeMatchUserId);
              }
              setShowIcebreakerPlayer(true);
            }}
            title="Watch icebreaker video"
          >
            📹 Video Intro
          </button>

          <button
            type="button"
            className="btn-video-call"
            onClick={() => onVideoCall?.(activeMatch, location.pathname)}
            title="Start video call"
          >
            Video
          </button>
        </div>
      </div>

      {error ? (
        <div className="messaging-error" role="alert">
          {error}
        </div>
      ) : null}

      {statusBanner ? (
        <div className={`messaging-status messaging-status-${statusBanner.tone}`}>
          {statusBanner.message}
        </div>
      ) : null}

      {streakDays > 0 && (
        <StreakBadge
          matchId={activeMatchId}
          streakDays={streakDays}
          emoji={streakDays >= 30 ? '🔥' : '❤️'}
          isActive={streakActive}
          totalMessages={messages.length}
          engagementScore={engagementScore}
        />
      )}

      {(engagementScore > 0 || totalReactions > 0) && (
        <EngagementScoreDisplay
          matchId={activeMatchId}
          streakDays={streakDays}
          engagementScore={engagementScore}
          totalMessages={messages.length}
          reactionCount={totalReactions}
          isActive={streakActive}
        />
      )}

      {journey ? (
        <div className="messaging-journey-card">
          <div className="messaging-journey-top">
            <div>
              <strong>Date Journey</strong>
              <p>
                {journey.progressCount || 0}/{journey.milestones?.length || 5} milestones reached with {activeMatch.firstName}.
              </p>
            </div>
            {journey.nudge ? (
              <span className="messaging-journey-nudge-pill">{journey.nudge.title}</span>
            ) : null}
          </div>

          {journey.milestones?.length ? (
            <div className="messaging-journey-milestones">
              {journey.milestones.map((milestone) => (
                <span
                  key={milestone.key}
                  className={`messaging-journey-milestone ${milestone.achieved ? 'achieved' : ''}`}
                >
                  {milestone.label}
                </span>
              ))}
            </div>
          ) : null}

          {journey.nudge ? (
            <p className="messaging-journey-copy">{journey.nudge.message}</p>
          ) : null}
        </div>
      ) : null}

      {showDatePlanner ? (
        <div className="messaging-planner-wrap">
          <DateJourneyPanel
            matchId={activeMatchId}
            match={activeMatch}
            onMatchUpdated={setConversationMatch}
            onScheduleVideoCall={(profile) => onScheduleVideoCall?.(profile, location.pathname)}
          />
        </div>
      ) : null}

      {showQualityMeter ? (
        <div className="messaging-quality-meter-wrap">
          <ConversationQualityMeter
            matchId={activeMatchId}
            messages={messages}
            currentUserId={currentUserId}
            onClose={() => setShowQualityMeter(false)}
          />
        </div>
      ) : null}

      <div className="messages-container">
        {loadingMessages ? (
          <div className="empty-messages">
            <p>Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="empty-messages empty-messages-start">
            <p>Say hello to {activeMatch.firstName}!</p>
            {icebreakers.length > 0 ? (
              <div className="icebreaker-list">
                {icebreakers.map((icebreaker) => (
                  <button
                    key={icebreaker}
                    type="button"
                    className="icebreaker-chip"
                    onClick={() => handleUseIcebreaker(icebreaker)}
                  >
                    {icebreaker}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              ref={(node) => {
                if (node) {
                  messageRefs.current[String(message.id)] = node;
                } else {
                  delete messageRefs.current[String(message.id)];
                }
              }}
              className={`message ${message.isOwn ? 'own' : 'other'} ${
                highlightedMessageId === String(message.id) ? 'message-highlighted' : ''
              }`}
            >
              <div className="message-stack">
                <div className="message-content">
                  {renderMessageBody(message)}
                  {message.isDisappearing ? (
                    <div className="message-flags">
                      <span className="message-flag">
                        {getDisappearingLabel(message, countdownNow)}
                      </span>
                    </div>
                  ) : null}
                  <div className="message-meta">
                    <span className="message-time">
                      {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    {message.isOwn ? (
                      <span className={`message-status ${message.isRead ? 'read' : ''}`}>
                        {getReadReceiptLabel(message)}
                      </span>
                    ) : null}
                  </div>
                </div>

                {message.reactions?.length > 0 ? (
                  <MessageReactionDisplay
                    messageId={message.id}
                    reactions={message.reactions}
                    onRemoveReaction={(emoji) => handleToggleReaction(message.id, emoji)}
                    currentUserId={currentUserId}
                  />
                ) : null}

                <div className={`message-tools ${message.isOwn ? 'own' : 'other'}`}>
                  <button
                    type="button"
                    className="message-reaction-toggle"
                    onClick={() => setActiveReactionPickerMessageId((currentMessageId) => (
                      currentMessageId === message.id ? null : message.id
                    ))}
                    disabled={reactionLoadingMessageId === message.id}
                  >
                    😊
                  </button>
                </div>

                {activeReactionPickerMessageId === message.id ? (
                  <ReactionPicker
                    messageId={message.id}
                    matchId={activeMatchId}
                    onReactionSelected={(emoji) => {
                      handleToggleReaction(message.id, emoji);
                      setActiveReactionPickerMessageId(null);
                    }}
                  />
                ) : null}
              </div>
            </div>
          ))
        )}

        {otherUserTyping ? (
          <div className="typing-state">Typing...</div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      <MessageToolbar
        matchId={activeMatchId}
        onSelectTemplate={(content) => {
          setInputMessage(content);
          inputRef.current?.focus();
        }}
        onSearch={handleSearchSelect}
        onAttachment={handleToolbarAttachments}
        onLocation={handleShareLocation}
        onMore={handleToolbarMore}
      />

      {sharedActionSuggestions.length > 0 ? (
        <div className="shared-actions-strip">
          <span className="composer-starters-label">Shared-interest actions:</span>
          <div className="composer-starters-list">
            {sharedActionSuggestions.map((action) => (
              <button
                key={`${action.type}-${action.label}`}
                type="button"
                className="composer-starter-chip"
                onClick={() => handleSharedAction(action)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {identityStarterChips.length > 0 && !showDatePlanner ? (
        <div className="identity-pack-strip">
          <span className="composer-starters-label">Local and language angle:</span>
          <div className="composer-starters-list">
            {identityStarterChips.map((starter) => (
              <button
                key={starter}
                type="button"
                className="composer-starter-chip identity-starter-chip"
                onClick={() => handleUseIcebreaker(starter)}
              >
                {starter}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {showPhaseTwoRescueStrip ? (
        <div className="conversation-rescue-strip">
          <span className="composer-starters-label">
            {conversationHealth.readyForCall ? 'Best next move:' : conversationRescuePlan?.label || 'Conversation rescue:'}
          </span>
          <div className="composer-starters-list">
            {phaseTwoRescueActions.map((action) => (
              <button
                key={action.id}
                type="button"
                className="composer-starter-chip conversation-rescue-chip"
                onClick={() => handleConversationRescueAction(action)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {showComposerStarters ? (
        <div className="composer-starters">
          <span className="composer-starters-label">Try an opener:</span>
          <div className="composer-starters-list">
            {icebreakers.map((icebreaker) => (
              <button
                key={`composer-${icebreaker}`}
                type="button"
                className="composer-starter-chip"
                onClick={() => handleUseIcebreaker(icebreaker)}
              >
                {icebreaker}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {disappearingEnabled ? (
        <div className="disappearing-strip">
          <span className="disappearing-strip-label">Disappearing mode</span>
          <select
            value={disappearAfterSeconds}
            onChange={(event) => setDisappearAfterSeconds(Number.parseInt(event.target.value, 10))}
            className="disappearing-select"
          >
            {DISAPPEARING_DURATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="disappearing-toggle-btn"
            onClick={() => setDisappearingEnabled(false)}
          >
            Turn off
          </button>
        </div>
      ) : null}

      <div className="message-input-container">
        <input
          ref={mediaInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          style={{ display: 'none' }}
        />

        <button
          type="button"
          className="btn-media"
          onClick={() => mediaInputRef.current?.click()}
          disabled={sendingMedia || isRecordingVoice || loadingMatch}
          title="Send image"
        >
          Img
        </button>

        {isRecordingVoice ? (
          <div className="voice-recording-indicator">
            <span className="recording-dot" />
            <span className="recording-time">{formatDuration(voiceRecordingDuration)}</span>
            <button
              type="button"
              className="btn-stop-recording"
              onClick={stopVoiceRecording}
              title="Stop recording"
            >
              Stop
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn-voice"
            onClick={startVoiceRecording}
            disabled={sendingMedia || loadingMatch}
            title="Record voice note"
          >
            Mic
          </button>
        )}

        <input
          ref={inputRef}
          type="text"
          placeholder={disappearingEnabled ? 'Send a disappearing message...' : 'Say something nice...'}
          value={inputMessage}
          onChange={handleTyping}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              handleSendMessage();
            }
          }}
          disabled={
            loadingMatch ||
            loadingMessages ||
            sendingMessage ||
            sendingMedia ||
            isRecordingVoice
          }
        />
        <button
          type="button"
          onClick={handleSendMessage}
          disabled={
            !inputMessage.trim() ||
            loadingMatch ||
            loadingMessages ||
            sendingMessage ||
            sendingMedia ||
            isRecordingVoice
          }
          className="btn-send"
        >
          {sendingMessage || sendingMedia ? '...' : 'Send'}
        </button>
      </div>

      {/* Icebreaker Video Player */}
      {showIcebreakerPlayer && matchVideo && (
        <IcebreakerVideoPlayer 
          video={matchVideo}
          user={{
            first_name: activeMatch?.firstName,
            age: activeMatch?.age,
            photo_url: activeMatch?.photos?.[0]
          }}
          onRate={async (ratingData) => {
            await rateVideo(matchVideo.id, ratingData);
          }}
          onClose={() => setShowIcebreakerPlayer(false)}
        />
      )}
    </div>
  );
};

export default DatingMessaging;
