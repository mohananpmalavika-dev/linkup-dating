import React from 'react';

const MessagePagination = ({
  visibleMessages = 0,
  totalMessages = 0,
  canShowOlderMessages = false,
  hasOlderMessagesLoaded = false,
  loadingOlderMessages = false,
  onShowOlderMessages,
  onShowLatestOnly,
}) => {
  if (!canShowOlderMessages && !hasOlderMessagesLoaded) {
    return null;
  }

  const hiddenOlderMessages = Math.max(totalMessages - visibleMessages, 0);

  return (
    <div className="message-pagination">
      <div className="pagination-info">
        <span className="message-count">
          {totalMessages > 0
            ? `Showing ${visibleMessages} of ${totalMessages} messages`
            : 'No messages'}
        </span>
      </div>
      <div className="pagination-controls">
        {canShowOlderMessages && (
          <button
            className="btn-pagination"
            onClick={onShowOlderMessages}
            disabled={loadingOlderMessages}
            title="Show older messages"
            type="button"
          >
            {loadingOlderMessages
              ? 'Loading...'
              : hiddenOlderMessages > 0
                ? `Show older messages (${hiddenOlderMessages})`
                : 'Show older messages'}
          </button>
        )}
        {hasOlderMessagesLoaded && (
          <button
            className="btn-pagination"
            onClick={onShowLatestOnly}
            title="Hide older messages"
            type="button"
          >
            Show latest only
          </button>
        )}
      </div>
    </div>
  );
};

export default MessagePagination;
