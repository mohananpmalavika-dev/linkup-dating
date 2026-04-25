import React from 'react';
import { getEntityId } from './utils';

const MessageThread = ({ 
  message, 
  replies = [],
  onReplyClick,
  onRepliesClick,
  currentUserId
}) => {
  if (!message.replyTo) {
    return null;
  }

  const parentMessage = message.replyTo;
  const isOwnReply = getEntityId(message.senderId) === currentUserId;
  const parentIsOwn = getEntityId(parentMessage.senderId) === currentUserId;

  return (
    <div className="message-thread">
      <div className={`thread-parent ${parentIsOwn ? 'own' : 'other'}`}>
        <div className="thread-avatar">
          {parentMessage.senderId?.avatar || 'U'}
        </div>
        <div className="thread-content">
          <p className="thread-sender">{parentMessage.senderId?.name}</p>
          <p className="thread-text">{parentMessage.content}</p>
        </div>
      </div>

      {replies && replies.length > 0 && (
        <div className="thread-replies-count">
          <button 
            className="btn-view-replies"
            onClick={onRepliesClick}
            type="button"
          >
            {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
          </button>
        </div>
      )}
    </div>
  );
};

export default MessageThread;
