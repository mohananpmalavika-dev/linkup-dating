import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import io from 'socket.io-client';
import { useLocation } from '../router';
import datingMessagingService from '../services/datingMessagingService';
import datingProfileService from '../services/datingProfileService';
import notificationService from '../services/notificationService';
import { getStoredUserData } from '../utils/auth';
import { BACKEND_BASE_URL } from '../utils/api';
import '../styles/DatingMessaging.css';

const REACTION_OPTIONS = ['❤️', '👍', '😂', '🔥', '👏'];

const normalizeMessage = (message, currentUserId) => ({
  id: message.id,
  text: message.message || message.text || '',
  senderId: message.from_user_id ?? message.fromUserId ?? message.senderId,
  toUserId: message.to_user_id ?? message.toUserId ?? null,
  timestamp: message.created_at || message.createdAt || message.timestamp || new Date().toISOString(),
  isRead: Boolean(message.is_read ?? message.isRead),
  readAt: message.read_at || message.readAt || null,
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
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(() =>
    notificationService.getPermissionStatus().permission
  );
  const [activeReactionPickerMessageId, setActiveReactionPickerMessageId] = useState(null);
  const [reactionLoadingMessageId, setReactionLoadingMessageId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const activeMatch = conversationMatch || matchedProfile || null;
  const activeMatchId = activeMatch?.matchId || matchId || null;
  const activeMatchUserId = activeMatch?.userId || null;
  const notificationsAvailable = notificationService.getPermissionStatus().available;
  const icebreakers = useMemo(() => buildIcebreakers(activeMatch), [activeMatch]);

  const notifyConversationActivity = useCallback(() => {
    onConversationActivity?.();
  }, [onConversationActivity]);

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
  }, [activeMatchId]);

  const loadMessages = useCallback(async (showLoader = true) => {
    if (!activeMatchId || !currentUserId) {
      setMessages([]);
      return;
    }

    if (showLoader) {
      setLoadingMessages(true);
    }

    setError('');

    try {
      const response = await datingMessagingService.getMessages(activeMatchId);
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

      const nextMessage = normalizeMessage(
        {
          id: payload.messageId || `${payload.matchId}-${payload.fromUserId}-${payload.timestamp}`,
          text: payload.message,
          fromUserId: payload.fromUserId,
          createdAt: payload.timestamp,
          reactions: payload.reactions || []
        },
        currentUserId
      );

      setMessages((currentMessages) => (
        currentMessages.some((message) => message.id === nextMessage.id)
          ? currentMessages
          : [...currentMessages, nextMessage]
      ));
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

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      socket.disconnect();
      socketRef.current = null;
    };
  }, [activeMatchId, activeMatchUserId, currentUserId, loadMessages]);

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

  const handleSendMessage = async () => {
    const trimmedMessage = inputMessage.trim();

    if (!trimmedMessage || !activeMatchId) {
      return;
    }

    setSendingMessage(true);
    setError('');

    try {
      const response = await datingMessagingService.sendMessage(activeMatchId, trimmedMessage);
      const createdMessage = normalizeMessage(response.data, currentUserId);

      setMessages((currentMessages) => [...currentMessages, createdMessage]);
      setInputMessage('');
      stopTypingSignal();
      notifyConversationActivity();
    } catch (sendError) {
      setError(typeof sendError === 'string' ? sendError : 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
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
      const nextReactions = response?.data?.reactions || [];

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
        </div>

        <div className="messaging-header-actions">
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
            className="btn-schedule-call"
            onClick={() => onScheduleVideoCall?.(activeMatch, location.pathname)}
            title="Schedule video call"
          >
            Plan
          </button>

          <button
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
            <div key={message.id} className={`message ${message.isOwn ? 'own' : 'other'}`}>
              <div className="message-stack">
                <div className="message-content">
                  <p>{message.text}</p>
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
                  <div className="message-reactions">
                    {message.reactions.map((reaction) => (
                      <button
                        key={`${message.id}-${reaction.emoji}`}
                        type="button"
                        className={`reaction-chip ${reaction.reactedByCurrentUser ? 'reacted' : ''}`}
                        onClick={() => handleToggleReaction(message.id, reaction.emoji)}
                        disabled={reactionLoadingMessageId === message.id}
                      >
                        <span>{reaction.emoji}</span>
                        <span>{reaction.count}</span>
                      </button>
                    ))}
                  </div>
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
                    React
                  </button>
                </div>

                {activeReactionPickerMessageId === message.id ? (
                  <div className="reaction-picker">
                    {REACTION_OPTIONS.map((emoji) => (
                      <button
                        key={`${message.id}-${emoji}`}
                        type="button"
                        className="reaction-option"
                        onClick={() => handleToggleReaction(message.id, emoji)}
                        disabled={reactionLoadingMessageId === message.id}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
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

      <div className="message-input-container">
        <input
          ref={inputRef}
          type="text"
          placeholder="Say something nice..."
          value={inputMessage}
          onChange={handleTyping}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              handleSendMessage();
            }
          }}
          disabled={loadingMatch || loadingMessages || sendingMessage}
        />
        <button
          onClick={handleSendMessage}
          disabled={!inputMessage.trim() || loadingMatch || sendingMessage || loadingMessages}
          className="btn-send"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default DatingMessaging;
