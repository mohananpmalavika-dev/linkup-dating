import React, { useEffect, useState } from 'react';
import socialService from '../services/socialService';
import '../styles/GroupChat.css';

const GroupChat = ({ groupId, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [groupInfo, setGroupInfo] = useState(null);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [groupId]);

  const loadMessages = async () => {
    try {
      const data = await socialService.getGroupMessages(groupId, 50);
      setMessages(data || []);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    setSending(true);
    try {
      const result = await socialService.sendGroupMessage(groupId, messageInput.trim());
      setMessages([...messages, result]);
      setMessageInput('');
      setError('');
    } catch (err) {
      setError('Failed to send message');
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm('Leave this group?')) return;

    try {
      await socialService.leaveGroupChat(groupId);
      onClose && onClose();
    } catch (err) {
      setError('Failed to leave group');
    }
  };

  return (
    <div className="group-chat-container">
      <div className="group-chat-header">
        <h2>{groupInfo?.name || 'Group Chat'}</h2>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="group-chat-messages">
        {loading ? (
          <div className="loading">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="empty-state">No messages yet. Start a conversation!</div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.is_own ? 'own' : 'other'}`}>
              <div className="message-content">
                {msg.message && <p className="message-text">{msg.message}</p>}
                {msg.media_url && (
                  <div className="message-media">
                    {msg.media_type === 'image' ? (
                      <img src={msg.media_url} alt="Message media" />
                    ) : msg.media_type === 'video' ? (
                      <video controls src={msg.media_url} />
                    ) : (
                      <a href={msg.media_url} target="_blank" rel="noopener noreferrer">
                        📎 {msg.media_type}
                      </a>
                    )}
                  </div>
                )}
              </div>
              <span className="message-time">
                {new Date(msg.created_at).toLocaleTimeString()}
              </span>
            </div>
          ))
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <form className="group-chat-input" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          placeholder="Type a message..."
          className="message-input"
          disabled={sending}
        />
        <button type="submit" className="send-btn" disabled={sending}>
          {sending ? '...' : '➤'}
        </button>
      </form>

      <button className="leave-btn" onClick={handleLeaveGroup}>
        Leave Group
      </button>
    </div>
  );
};

export default GroupChat;
