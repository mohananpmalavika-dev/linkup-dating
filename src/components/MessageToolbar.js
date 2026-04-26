import React, { useState } from 'react';
import MessageTemplates from './MessageTemplates';
import MessageSearch from './MessageSearch';
import MessageExport from './MessageExport';
import AttachmentUpload from './AttachmentUpload';
import LocationShare from './LocationShare';
import '../../styles/MessageToolbar.css';

/**
 * MessageToolbar Component
 * Unified toolbar for messaging enhancements
 */
const MessageToolbar = ({
  matchId,
  onSelectTemplate,
  onSearch,
  onAttachment,
  onLocation,
  onMore
}) => {
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleSelectTemplate = (content) => {
    onSelectTemplate?.(content);
    setShowTemplates(false);
  };

  const handleSelectAttachment = (attachments) => {
    onAttachment?.(attachments);
    setShowAttachments(false);
  };

  const handleSelectLocation = (location) => {
    onLocation?.(location);
    setShowLocation(false);
  };

  return (
    <>
      <div className="message-toolbar">
        <div className="toolbar-actions">
          <button
            className="toolbar-btn templates-btn"
            onClick={() => setShowTemplates(!showTemplates)}
            title="Quick Reply Templates"
          >
            💬
          </button>

          <button
            className="toolbar-btn search-btn"
            onClick={() => setShowSearch(!showSearch)}
            title="Search Messages"
          >
            🔍
          </button>

          <button
            className="toolbar-btn attachment-btn"
            onClick={() => setShowAttachments(!showAttachments)}
            title="Attach Files"
          >
            📎
          </button>

          <button
            className="toolbar-btn location-btn"
            onClick={() => setShowLocation(!showLocation)}
            title="Share Location"
          >
            📍
          </button>

          <button
            className="toolbar-btn menu-btn"
            onClick={() => setShowMenu(!showMenu)}
            title="More Options"
          >
            ⋮
          </button>
        </div>

        {showMenu && (
          <div className="toolbar-menu">
            <button
              className="menu-item"
              onClick={() => {
                setShowExport(true);
                setShowMenu(false);
              }}
            >
              📥 Export Chat
            </button>
            <button
              className="menu-item"
              onClick={() => {
                onMore?.('encrypt');
                setShowMenu(false);
              }}
            >
              🔐 Encryption Settings
            </button>
            <button
              className="menu-item"
              onClick={() => {
                onMore?.('disappearing');
                setShowMenu(false);
              }}
            >
              ⏰ Disappearing Messages
            </button>
            <button
              className="menu-item"
              onClick={() => {
                onMore?.('backup');
                setShowMenu(false);
              }}
            >
              💾 Backup Chat
            </button>
          </div>
        )}
      </div>

      {showTemplates && (
        <MessageTemplates
          onSelectTemplate={handleSelectTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {showSearch && (
        <MessageSearch
          matchId={matchId}
          onSelectMessage={onSearch}
          onClose={() => setShowSearch(false)}
        />
      )}

      {showAttachments && (
        <div className="toolbar-panel">
          <AttachmentUpload
            onAttachmentSelect={handleSelectAttachment}
            maxFileSize={50}
            maxFiles={5}
          />
        </div>
      )}

      {showLocation && (
        <LocationShare
          onLocationSelect={handleSelectLocation}
          onClose={() => setShowLocation(false)}
        />
      )}

      {showExport && (
        <MessageExport
          matchId={matchId}
          onClose={() => setShowExport(false)}
        />
      )}
    </>
  );
};

export default MessageToolbar;
