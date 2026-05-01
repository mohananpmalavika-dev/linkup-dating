import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import '../styles/LobbyChat.css';
import lobbyService from '../services/lobbyService';
import { getStoredUserData, getStoredAuthToken } from '../utils/auth';
import { BACKEND_BASE_URL } from '../utils/api';

/**
 * LobbyChat Component
 * Global public chatroom where all users can communicate
 */
const LobbyChat = ({ onBack }) => {
  const currentUser = getStoredUserData();
  const currentUserId = currentUser?.id;
  const authToken = getStoredAuthToken();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  // Check authentication
  useEffect(() => {
    if (!currentUserId || !authToken) {
      setError('Authentication required. Please log in to use the lobby.');
      setLoading(false);
    }
  }, [currentUserId, authToken]);

  // Load messages and setup WebSocket
  useEffect(() => {
    const loadMessages = async () => {
      try {
        setLoading(true);
        const data = await lobbyService.getMessages(50, 0);
        setMessages(data);

        const onlineData = await lobbyService.getOnlineUsers();
        setOnlineCount(onlineData.onlineCount);
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();

    // Setup WebSocket connection
    socketRef.current = io(BACKEND_BASE_URL, {
      auth: {
        token: getStoredAuthToken()
      }
    });

    socketRef.current.emit('user_online', currentUserId);
    socketRef.current.emit('join_lobby');

    // Listen for new messages
    socketRef.current.on('new_lobby_message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    // Listen for user status changes
    socketRef.current.on('user_status', (data) => {
      // Update online count dynamically
      if (data.online) {
        setOnlineCount(prev => prev + 1);
      } else {
        setOnlineCount(prev => Math.max(0, prev - 1));
      }
    });

    // Handle connection errors
    socketRef.current.on('connect_error', (connectError) => {
      console.error('WebSocket connection error:', connectError);
      setError('Connection error. Please refresh the page.');
    });

    socketRef.current.on('disconnect', (reason) => {
      console.warn('WebSocket disconnected:', reason);
    });

    return () => {
      socketRef.current?.emit('leave_lobby');
      socketRef.current?.disconnect();
    };
  }, [currentUserId, authToken]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const handleSendMessage = async () => {
    // Check authentication first
    if (!currentUserId || !authToken) {
      setError('You must be logged in to send messages');
      return;
    }

    if (!inputMessage || !inputMessage.trim()) {
      setError('Message cannot be empty');
      return;
    }

    if (inputMessage.trim().length > 500) {
      setError('Message cannot exceed 500 characters');
      return;
    }

    const draftMessage = inputMessage;

    try {
      setError('');
      setInputMessage('');

      const response = await lobbyService.sendMessage(draftMessage);
      
      // Verify response has required fields
      if (!response || !response.id) {
        throw new Error('Invalid response from server');
      }

      // Message will be added via WebSocket
      console.log('Message sent successfully:', response.id);
    } catch (err) {
      console.error('Failed to send message:', err);
      setError(typeof err === 'string' ? err : err.message || 'Failed to send message');
      setInputMessage(draftMessage); // Restore message on error
    }
  };

  return (
    <div className="lobby-chat">
      {/* Header */}
      <div className="lobby-header">
        <button className="btn-back" onClick={onBack} title="Back">
          ←
        </button>
        <div className="header-info">
          <h2>🌍 Global Lounge</h2>
          <p className="online-status">🟢 {onlineCount} online</p>
        </div>
      </div>

      {/* Welcome Message */}
      <div className="lobby-welcome">
        <p>Welcome to the Global Lounge! Chat with people from around the world 🌎</p>
      </div>

      {/* Messages Area */}
      <div className="messages-area">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading lobby chat...</p>
          </div>
        ) : messages.length > 0 ? (
          <div className="messages-container">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`message ${message.from_user_id === currentUserId ? 'own' : 'other'}`}
              >
                {message.from_user_id !== currentUserId && (
                  <img
                    src={message.photo_url || 'https://via.placeholder.com/40'}
                    alt={message.first_name}
                    className="message-avatar"
                  />
                )}
                <div className="message-bubble">
                  {message.from_user_id !== currentUserId && (
                    <p className="message-sender">{message.first_name}</p>
                  )}
                  <p className="message-text">{message.message}</p>
                  <p className="message-time">
                    {new Date(message.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className="no-messages">
            <p>No messages yet. Be the first to say hi! 👋</p>
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="message-input-area">
        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => setError('')}>✕</button>
          </div>
        )}
        <div className="input-container">
          <input
            type="text"
            placeholder="Say something to the world..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            className="message-input"
            maxLength={500}
          />
          <button
            className="btn-send"
            onClick={handleSendMessage}
            disabled={!inputMessage.trim()}
            title="Send"
          >
            📤
          </button>
        </div>
      </div>
    </div>
  );
};

export default LobbyChat;
