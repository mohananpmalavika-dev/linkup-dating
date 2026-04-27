/**
 * EXAMPLE: How to Integrate IcereakerSuggestions into DatingProfileView.js
 * 
 * This shows the minimal changes needed to add the smart message feature
 * to your existing dating profile viewing component.
 */

import React, { useState } from 'react';
import IcereakerSuggestions from './IcereakerSuggestions';
import icereakerSuggestionService from '../services/icereakerSuggestionService';
import '../styles/DatingProfileView.css';

const DatingProfileView = ({ profile, onBack }) => {
  // ... existing state ...
  const [messageText, setMessageText] = useState('');
  
  // ✨ NEW: Add state for suggestions modal
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sending, setSending] = useState(false);
  const [templateUsed, setTemplateUsed] = useState(null);

  // ✨ NEW: Handle suggestion selection
  const handleSelectSuggestion = async (suggestion) => {
    try {
      setMessageText(suggestion.content);
      
      // Send message with template tracking
      setSending(true);
      const result = await icereakerSuggestionService.useSuggestion(
        profile.id,
        suggestion.content,
        suggestion.id,        // templateId if available
        suggestion.interestTrigger
      );
      
      setTemplateUsed(result.templateTracked);
      setShowSuggestions(false);
      
      // Clear message after send
      setTimeout(() => setMessageText(''), 1000);
      
      // Show success feedback
      console.log('Message sent with template tracking:', result);
    } catch (err) {
      console.error('Error sending message:', err);
      // Show error to user
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="dating-profile-view">
      {/* ... existing profile content ... */}
      
      {/* Profile Header */}
      <div className="profile-header">
        <h2>{profile.firstName}, {profile.age}</h2>
        <p className="location">{profile.locationCity}, {profile.locationState}</p>
      </div>

      {/* ... existing profile photos, bio, interests ... */}

      {/* Action Buttons - UPDATE THIS SECTION */}
      <div className="profile-actions">
        <button 
          onClick={onBack}
          className="button button-secondary"
        >
          ← Back
        </button>

        {/* ✨ NEW: Smart Message Button */}
        <button 
          onClick={() => setShowSuggestions(true)}
          className="button button-primary smart-message-btn"
          disabled={sending}
          title="Get AI-generated opening suggestions based on shared interests"
        >
          💡 Smart Message
        </button>

        {/* Existing Send Message Button (if any) */}
        <button 
          onClick={() => sendMessage(messageText)}
          className="button button-primary"
          disabled={!messageText.trim() || sending}
        >
          {sending ? 'Sending...' : 'Send Message'}
        </button>

        {/* Like/Pass buttons */}
        <button onClick={likeProfile} className="button button-success">
          ❤️ Like
        </button>
        <button onClick={passProfile} className="button button-danger">
          ✕ Pass
        </button>
      </div>

      {/* Message Input Area - KEEP EXISTING */}
      {messageText && (
        <div className="message-compose">
          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type your message..."
            maxLength={500}
          />
          <div className="char-count">
            {messageText.length}/500
          </div>
          {templateUsed && (
            <div className="template-used-badge">
              ✓ Using AI suggestion (response rate tracked)
            </div>
          )}
        </div>
      )}

      {/* ✨ NEW: Suggestions Modal */}
      {showSuggestions && (
        <div className="modal-overlay" onClick={() => setShowSuggestions(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close"
              onClick={() => setShowSuggestions(false)}
            >
              ✕
            </button>
            
            <IcereakerSuggestions
              recipientProfile={profile}
              onSelectSuggestion={handleSelectSuggestion}
              onClose={() => setShowSuggestions(false)}
            />
          </div>
        </div>
      )}

      {/* Additional Modal Styles */}
      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          position: relative;
          background: white;
          border-radius: 12px;
          max-height: 90vh;
          overflow-y: auto;
          max-width: 600px;
          width: 95%;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        }

        .modal-close {
          position: absolute;
          top: 12px;
          right: 12px;
          background: rgba(0, 0, 0, 0.1);
          border: none;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          cursor: pointer;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }

        .modal-close:hover {
          background: rgba(0, 0, 0, 0.2);
        }

        .smart-message-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          font-weight: 600;
        }

        .smart-message-btn:hover:not(:disabled) {
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .template-used-badge {
          padding: 8px 12px;
          background: #e8f5e9;
          color: #27ae60;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          margin-top: 8px;
        }
      `}</style>
    </div>
  );
};

export default DatingProfileView;

/**
 * EXAMPLE 2: Simplified Integration for Quick Start
 * 
 * If you just want to add a floating button, you can use this simpler approach:
 */

const DatingProfileView_SimpleVersion = ({ profile, onBack }) => {
  const [showSuggestions, setShowSuggestions] = useState(false);

  return (
    <div className="dating-profile-view">
      {/* ... existing profile content ... */}

      {/* Floating Action Button */}
      <button
        className="floating-smart-message-btn"
        onClick={() => setShowSuggestions(true)}
        title="Get personalized opening message suggestions"
      >
        💡
      </button>

      {/* Modal */}
      {showSuggestions && (
        <div className="suggestions-modal">
          <IcereakerSuggestions
            recipientProfile={profile}
            onSelectSuggestion={(suggestion) => {
              // Do something with selected suggestion
              console.log('Selected:', suggestion.content);
              setShowSuggestions(false);
            }}
            onClose={() => setShowSuggestions(false)}
          />
        </div>
      )}

      <style jsx>{`
        .floating-smart-message-btn {
          position: fixed;
          bottom: 30px;
          right: 30px;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          font-size: 28px;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
          transition: all 0.3s ease;
          z-index: 100;
        }

        .floating-smart-message-btn:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
        }

        .suggestions-modal {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 1000;
          background: rgba(0, 0, 0, 0.5);
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
    </div>
  );
};

/**
 * EXAMPLE 3: Integration with Message Tracking
 * 
 * This shows how to track when messages get responses
 */

const DatingMessaging = ({ matchId, recipientId }) => {
  const [messages, setMessages] = useState([]);

  // When a message is marked as read
  const handleMessageRead = async (message) => {
    if (message.templateId) {
      // Track the response to the template
      try {
        await icereakerSuggestionService.trackResponse(
          message.templateId,
          true // User responded to this template-based message
        );
      } catch (err) {
        console.warn('Failed to track template response:', err);
      }
    }
  };

  return (
    <div className="messaging">
      {/* Message list */}
      {messages.map((msg) => (
        <MessageItem
          key={msg.id}
          message={msg}
          onRead={() => handleMessageRead(msg)}
        />
      ))}

      {/* Message input with suggestions */}
      <div className="message-input">
        <button
          onClick={() => {/* show IcereakerSuggestions */}}
          title="Get smart message suggestions"
        >
          💡 Suggest
        </button>
        <textarea placeholder="Type message..." />
      </div>
    </div>
  );
};

/**
 * EXAMPLE 4: Add Analytics Dashboard Link
 */

const UserDashboard = () => {
  const [showAnalytics, setShowAnalytics] = useState(false);

  return (
    <div className="dashboard">
      {/* ... existing dashboard content ... */}

      <div className="dashboard-section">
        <h3>Messages</h3>
        <button onClick={() => setShowAnalytics(true)}>
          📊 View Message Analytics
        </button>
      </div>

      {/* Analytics Modal */}
      {showAnalytics && (
        <div className="modal">
          <TemplatePerformance
            onClose={() => setShowAnalytics(false)}
          />
        </div>
      )}
    </div>
  );
};

export { DatingProfileView_SimpleVersion, DatingMessaging, UserDashboard };
