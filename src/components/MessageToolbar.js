import React, { useState } from 'react';
import MessageTemplates from './MessageTemplates';
import MessageSearch from './MessageSearch';
import MessageExport from './MessageExport';
import AttachmentUpload from './AttachmentUpload';
import LocationShare from './LocationShare';
import '../styles/MessageToolbar.css';

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

  const closePanels = () => {
    setShowTemplates(false);
    setShowSearch(false);
    setShowExport(false);
    setShowAttachments(false);
    setShowLocation(false);
    setShowMenu(false);
  };

  const togglePanel = (panelName) => {
    const currentState = {
      templates: showTemplates,
      search: showSearch,
      export: showExport,
      attachments: showAttachments,
      location: showLocation,
      menu: showMenu
    }[panelName];

    closePanels();

    if (currentState) {
      return;
    }

    switch (panelName) {
      case 'templates':
        setShowTemplates(true);
        break;
      case 'search':
        setShowSearch(true);
        break;
      case 'export':
        setShowExport(true);
        break;
      case 'attachments':
        setShowAttachments(true);
        break;
      case 'location':
        setShowLocation(true);
        break;
      case 'menu':
        setShowMenu(true);
        break;
      default:
        break;
    }
  };

  const handleSelectTemplate = (content) => {
    onSelectTemplate?.(content);
    closePanels();
  };

  const handleSelectAttachment = (attachments) => {
    onAttachment?.(attachments);
    closePanels();
  };

  const handleSelectLocation = (location) => {
    onLocation?.(location);
    closePanels();
  };

  return (
    <>
      <div className="message-toolbar">
        <div className="toolbar-actions">
          <button
            type="button"
            className="toolbar-btn templates-btn"
            onClick={() => togglePanel('templates')}
            title="Quick reply templates"
          >
            Tpl
          </button>

          <button
            type="button"
            className="toolbar-btn search-btn"
            onClick={() => togglePanel('search')}
            title="Search messages"
          >
            Find
          </button>

          <button
            type="button"
            className="toolbar-btn attachment-btn"
            onClick={() => togglePanel('attachments')}
            title="Attach files"
          >
            File
          </button>

          <button
            type="button"
            className="toolbar-btn location-btn"
            onClick={() => togglePanel('location')}
            title="Share location"
          >
            Map
          </button>

          <button
            type="button"
            className="toolbar-btn menu-btn"
            onClick={() => togglePanel('menu')}
            title="More options"
          >
            More
          </button>
        </div>

        {showMenu && (
          <div className="toolbar-menu">
            <button
              type="button"
              className="menu-item"
              onClick={() => togglePanel('export')}
            >
              Export chat
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                onMore?.('encrypt');
                closePanels();
              }}
            >
              Security setup
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                onMore?.('disappearing');
                closePanels();
              }}
            >
              Disappearing mode
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                onMore?.('backup');
                closePanels();
              }}
            >
              Backup chat
            </button>
          </div>
        )}
      </div>

      {showTemplates && (
        <MessageTemplates
          onSelectTemplate={handleSelectTemplate}
          onClose={closePanels}
        />
      )}

      {showSearch && (
        <MessageSearch
          matchId={matchId}
          onSelectMessage={(message) => {
            onSearch?.(message);
            closePanels();
          }}
          onClose={closePanels}
        />
      )}

      {showAttachments && (
        <div className="toolbar-panel">
          <AttachmentUpload
            onAttachmentSelect={handleSelectAttachment}
            maxFileSize={10}
            maxFiles={5}
          />
        </div>
      )}

      {showLocation && (
        <LocationShare
          onLocationSelect={handleSelectLocation}
          onClose={closePanels}
        />
      )}

      {showExport && (
        <MessageExport
          matchId={matchId}
          onClose={closePanels}
        />
      )}
    </>
  );
};

export default MessageToolbar;
