import React, { useState, useEffect, useRef } from 'react';
import '../styles/DatingMessaging.css';

/**
 * DatingMessaging Component
 * Messaging between matched profiles
 */
const DatingMessaging = ({ matchedProfile, onVideoCall }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  // Load messages on mount
  useEffect(() => {
    if (matchedProfile) {
      loadMessages();
    }
  }, [matchedProfile]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    setLoading(true);
    setError('');
    try {
      // TODO: Implement actual message loading from service
      setMessages([]);
    } catch (err) {
      setError('Failed to load messages');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !matchedProfile) return;

    const newMessage = {
      id: Date.now().toString(),
      text: inputMessage,
      senderId: 'current-user', // Replace with actual user ID
      timestamp: new Date(),
      isOwn: true,
    };

    setMessages((currentMessages) => [...currentMessages, newMessage]);
    setInputMessage('');
    setError('');

    try {
      // TODO: Implement actual message sending
      console.log('Message sent:', newMessage);
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message');
    }
  };

  const handleTyping = (e) => {
    setInputMessage(e.target.value);
    if (!isTyping) {
      setIsTyping(true);
      // TODO: Emit typing indicator
      setTimeout(() => setIsTyping(false), 3000);
    }
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
      {/* Header */}
      <div className="messaging-header">
        <div className="profile-info">
          {matchedProfile.photos?.[0] && (
            <img src={matchedProfile.photos[0]} alt={matchedProfile.firstName} />
          )}
          <div>
            <h3>{matchedProfile.firstName}</h3>
            <span className="online-status">Online</span>
          </div>
        </div>
        <button
          className="btn-video-call"
          onClick={() => onVideoCall?.(matchedProfile)}
          title="Start video call"
        >
          📹
        </button>
      </div>

      {error && (
        <div className="messaging-error" role="alert">
          {error}
        </div>
      )}

      {/* Messages */}
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-messages">
            <p>Say hello to {matchedProfile.firstName}! 👋</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.isOwn ? 'own' : 'other'}`}>
              <div className="message-content">
                <p>{msg.text}</p>
                <span className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="message-input-container">
        <input
          type="text"
          placeholder="Say something nice..."
          value={inputMessage}
          onChange={handleTyping}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleSendMessage();
            }
          }}
          disabled={loading}
        />
        <button
          onClick={handleSendMessage}
          disabled={!inputMessage.trim() || loading}
          className="btn-send"
        >
          ➤
        </button>
      </div>
    </div>
  );
};

export default DatingMessaging;
