import React, { useCallback, useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import '../styles/ChatRoomView.css';
import ModerationWarning from './ModerationWarning';
import chatroomService from '../services/chatroomService';
import moderationService from '../services/moderationService';
import { getStoredUserData, getStoredAuthToken } from '../utils/auth';
import { BACKEND_BASE_URL } from '../utils/api';

/**
 * ChatRoomView Component
 * View and chat in a specific chatroom
 */
const ChatRoomView = ({ chatroomId, onBack }) => {
  const currentUser = getStoredUserData();
  const currentUserId = currentUser?.id;
  const [chatroom, setChatroom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loadingChatroom, setLoadingChatroom] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState('');
  const [moderationWarningOpen, setModerationWarningOpen] = useState(false);
  const [moderationWarningData, setModerationWarningData] = useState({
    severity: 'medium',
    issues: [],
    contentType: 'message'
  });
  const [pendingMessage, setPendingMessage] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const [showMembers, setShowMembers] = useState(false);

  // Fetch chatroom details
  useEffect(() => {
    const loadChatroom = async () => {
      try {
        setLoadingChatroom(true);
        const data = await chatroomService.getChatroom(chatroomId);
        setChatroom(data);
      } catch (err) {
        setError('Failed to load chatroom');
        console.error(err);
      } finally {
        setLoadingChatroom(false);
      }
    };

    loadChatroom();
  }, [chatroomId]);

  // Fetch messages
  useEffect(() => {
    if (!chatroom) return;

    const loadMessages = async () => {
      try {
        setLoadingMessages(true);
        const data = await chatroomService.getMessages(chatroomId, 50, 0);
        setMessages(data);
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        setLoadingMessages(false);
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

    // Join room
    socketRef.current.emit('join_chatroom', chatroomId);

    // Listen for new messages
    socketRef.current.on('new_chatroom_message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    // Load members
    loadMembers();

    return () => {
      socketRef.current?.emit('leave_chatroom', chatroomId);
      socketRef.current?.disconnect();
    };
  }, [chatroomId, currentUserId]);

  // Load members
  const loadMembers = async () => {
    try {
      const data = await chatroomService.getMembers(chatroomId, 100, 0);
      setMembers(data);
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    setError('');

    try {
      // Scan content for moderation flags
      const scanResult = await moderationService.scanText(inputMessage);

      // If content is flagged with medium or high severity, show warning
      if (moderationService.shouldShowWarning(scanResult.severity)) {
        setPendingMessage(inputMessage);
        setModerationWarningData({
          severity: scanResult.severity,
          issues: scanResult.issues,
          contentType: 'message'
        });
        setModerationWarningOpen(true);
        return; // Stop here - user must confirm
      }

      // Content is clean, proceed with sending
      await sendMessageNow(inputMessage);
    } catch (err) {
      console.error('Moderation scan error:', err);
      // On scan error, proceed anyway
      await sendMessageNow(inputMessage);
    }
  };

  const sendMessageNow = async (messageText) => {
    const draftMessage = messageText;

    try {
      setSendingMessage(true);
      setInputMessage('');

      await chatroomService.sendMessage(chatroomId, draftMessage);
      // Message will be added via WebSocket
    } catch (err) {
      setError('Failed to send message');
      setInputMessage(draftMessage); // Restore message on error
      console.error(err);
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

  if (loadingChatroom) {
    return (
      <div className="chatroom-view">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading chatroom...</p>
        </div>
      </div>
    );
  }

  if (!chatroom) {
    return (
      <div className="chatroom-view">
        <div className="error-state">
          <p>Chatroom not found</p>
          <button onClick={onBack}>Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="chatroom-view">
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

      {/* Header */}
      <div className="chatroom-view-header">
        <div className="header-left">
          <button className="btn-back" onClick={onBack} title="Back">
            ←
          </button>
          <div>
            <h2>{chatroom.name}</h2>
            <p className="members-info">{members.length} members</p>
          </div>
        </div>
        <button
          className={`btn-members ${showMembers ? 'active' : ''}`}
          onClick={() => setShowMembers(!showMembers)}
          title="Members"
        >
          👥 ({members.length})
        </button>
      </div>

      <div className="chatroom-content">
        {/* Members Sidebar */}
        {showMembers && (
          <div className="members-sidebar">
            <h3>Members</h3>
            <div className="members-list">
              {members.map((member) => (
                <div key={member.user_id} className="member-item">
                  {member.photo_url && (
                    <img src={member.photo_url} alt={member.first_name} />
                  )}
                  <div className="member-info">
                    <p className="member-name">{member.first_name}</p>
                    {member.location_city && (
                      <p className="member-location">{member.location_city}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div className="messages-area">
          {/* Description */}
          {chatroom.description && (
            <div className="chatroom-description-box">
              <p>{chatroom.description}</p>
            </div>
          )}

          {/* Messages */}
          {loadingMessages ? (
            <div className="loading-messages">
              <div className="spinner"></div>
            </div>
          ) : messages.length > 0 ? (
            <div className="messages-container">
              {messages.map((message, idx) => (
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
              <p>No messages yet. Start the conversation!</p>
            </div>
          )}
        </div>
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
            placeholder="Type a message..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            className="message-input"
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

export default ChatRoomView;
