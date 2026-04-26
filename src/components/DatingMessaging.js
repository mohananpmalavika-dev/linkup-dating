import React, { useCallback, useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import datingMessagingService from '../services/datingMessagingService';
import { getStoredUserData } from '../utils/auth';
import { BACKEND_BASE_URL } from '../utils/api';
import '../styles/DatingMessaging.css';

const normalizeMessage = (message, currentUserId) => ({
  id: message.id,
  text: message.message || message.text || '',
  senderId: message.from_user_id ?? message.fromUserId ?? message.senderId,
  timestamp: message.created_at || message.createdAt || message.timestamp || new Date().toISOString(),
  isOwn: Number(message.from_user_id ?? message.fromUserId ?? message.senderId) === Number(currentUserId)
});

const DatingMessaging = ({ matchedProfile, onVideoCall, onBack, onViewProfile, onConversationActivity }) => {
  const currentUser = getStoredUserData();
  const currentUserId = currentUser?.id;
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState('');
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const notifyConversationActivity = useCallback(() => {
    onConversationActivity?.();
  }, [onConversationActivity]);

  const loadMessages = useCallback(async (showLoader = true) => {
    if (!matchedProfile?.matchId || !currentUserId) {
      setMessages([]);
      return;
    }

    if (showLoader) {
      setLoadingMessages(true);
    }

    setError('');

    try {
      const response = await datingMessagingService.getMessages(matchedProfile.matchId);
      setMessages((response || []).map((message) => normalizeMessage(message, currentUserId)));
      notifyConversationActivity();
    } catch (loadError) {
      setError(typeof loadError === 'string' ? loadError : 'Failed to load messages');
    } finally {
      if (showLoader) {
        setLoadingMessages(false);
      }
    }
  }, [currentUserId, matchedProfile?.matchId, notifyConversationActivity]);

  useEffect(() => {
    if (matchedProfile?.matchId && currentUserId) {
      loadMessages();
    } else {
      setMessages([]);
    }
  }, [currentUserId, loadMessages, matchedProfile?.matchId]);

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
      if (Number(userId) === Number(matchedProfile?.userId)) {
        setOtherUserOnline(Boolean(online));
      }
    });

    socket.on('new_message', (payload) => {
      if (Number(payload.matchId) !== Number(matchedProfile?.matchId)) {
        return;
      }

      const nextMessage = normalizeMessage(
        {
          id: `${payload.matchId}-${payload.fromUserId}-${payload.timestamp}`,
          text: payload.message,
          fromUserId: payload.fromUserId,
          createdAt: payload.timestamp
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

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      socket.disconnect();
      socketRef.current = null;
    };
  }, [currentUserId, loadMessages, matchedProfile?.matchId, matchedProfile?.userId]);

  const stopTypingSignal = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (socketRef.current && matchedProfile?.userId) {
      socketRef.current.emit('typing', {
        toUserId: matchedProfile.userId,
        isTyping: false
      });
    }
  };

  const handleSendMessage = async () => {
    const trimmedMessage = inputMessage.trim();

    if (!trimmedMessage || !matchedProfile?.matchId) {
      return;
    }

    setSendingMessage(true);
    setError('');

    try {
      const response = await datingMessagingService.sendMessage(matchedProfile.matchId, trimmedMessage);
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

    if (!socketRef.current || !matchedProfile?.userId) {
      return;
    }

    socketRef.current.emit('typing', {
      toUserId: matchedProfile.userId,
      isTyping: true
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTypingSignal();
    }, 1500);
  };

  if (!matchedProfile) {
    return (
      <div className="messaging-empty">
        <p>Select a match to start messaging</p>
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
            onClick={() => onViewProfile?.(matchedProfile)}
          >
            {matchedProfile.photos?.[0] ? (
              <img src={matchedProfile.photos[0]} alt={matchedProfile.firstName} />
            ) : (
              <div className="profile-avatar-fallback">{matchedProfile.firstName?.charAt(0) || '?'}</div>
            )}
            <div>
              <h3>{matchedProfile.firstName}</h3>
              <span className="online-status">
                {otherUserTyping ? 'Typing...' : otherUserOnline ? 'Online' : 'Chat ready'}
              </span>
            </div>
          </button>
        </div>

        <button
          className="btn-video-call"
          onClick={() => onVideoCall?.(matchedProfile)}
          title="Start video call"
        >
          Video
        </button>
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
          <div className="empty-messages">
            <p>Say hello to {matchedProfile.firstName}!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`message ${message.isOwn ? 'own' : 'other'}`}>
              <div className="message-content">
                <p>{message.text}</p>
                <span className="message-time">
                  {new Date(message.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
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
          disabled={loadingMessages || sendingMessage}
        />
        <button
          onClick={handleSendMessage}
          disabled={!inputMessage.trim() || sendingMessage || loadingMessages}
          className="btn-send"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default DatingMessaging;
