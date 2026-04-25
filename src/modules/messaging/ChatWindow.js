import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../contexts/AppContext';
import MessageSearch from './MessageSearch';
import MessageContextMenu from './MessageContextMenu';
import EmojiPicker from './EmojiPicker';
import ReadReceipts from './ReadReceipts';
import MessagePagination from './MessagePagination';
import { getAvatarLabel, getEntityId, isSameEntity } from './utils';

const ChatWindow = ({
  chat,
  messages,
  onSendMessage,
  onTyping,
  typingUsers,
  encryptionEnabled,
  onToggleEncryption,
  onStartCall,
  onOpenFileUpload,
  onEditMessage,
  onDeleteMessage,
  onToggleImportant,
  onAddReaction,
  onSearchMessages,
  focusedMessageId,
  onFocusHandled,
  onSendVoiceMessage,
  sendingVoiceMessage,
  totalMessages = 0,
  canShowOlderMessages = false,
  hasOlderMessagesLoaded = false,
  loadingOlderMessages = false,
  onShowOlderMessages,
  onShowLatestOnly,
  onClearChat,
  onRestoreClearedChat,
  isChatCleared = false,
  onDeleteAllMessages,
}) => {
  const { currentUser } = useApp();
  const [messageInput, setMessageInput] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedMessageForReaction, setSelectedMessageForReaction] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [replyingToMessage, setReplyingToMessage] = useState(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const messagesEndRef = useRef(null);
  const messageContainerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const voiceChunksRef = useRef([]);
  const voiceRecordingStartedAtRef = useRef(0);
  const previousMessageSnapshotRef = useRef({ count: 0, lastId: '' });
  const currentUserId = getEntityId(currentUser);
  const resolvedCurrentUserId = getEntityId(
    chat?.participants?.find((participant) => isSameEntity(participant, currentUser))
  ) || currentUserId;

  useEffect(() => {
    const latestMessageId = getEntityId(messages[messages.length - 1]);
    const previousSnapshot = previousMessageSnapshotRef.current;
    const isFirstLoad = previousSnapshot.count === 0 && messages.length > 0;
    const appendedLatestMessage =
      messages.length > previousSnapshot.count &&
      latestMessageId &&
      latestMessageId !== previousSnapshot.lastId;

    if (isFirstLoad || appendedLatestMessage) {
      messagesEndRef.current?.scrollIntoView({ behavior: isFirstLoad ? 'auto' : 'smooth' });
    }

    previousMessageSnapshotRef.current = {
      count: messages.length,
      lastId: latestMessageId,
    };
  }, [messages]);

  useEffect(() => {
    if (!focusedMessageId) {
      return;
    }

    const messageElement = messageContainerRef.current?.querySelector(
      `[data-message-id="${focusedMessageId}"]`
    );

    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      messageElement.classList.add('highlight');
      window.setTimeout(() => {
        messageElement.classList.remove('highlight');
      }, 1800);
    }

    if (onFocusHandled) {
      onFocusHandled();
    }
  }, [focusedMessageId, onFocusHandled]);

  useEffect(() => () => {
    mediaRecorderRef.current = null;
    voiceRecordingStartedAtRef.current = 0;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const getOtherParticipants = () =>
    chat?.participants?.filter((participant) => !isSameEntity(participant, currentUser)) || [];

  const getChatTitle = () => {
    if (chat?.type === 'group') {
      return chat.groupName;
    }

    return getOtherParticipants()[0]?.name || 'Unknown User';
  };

  const getChatInfo = () => {
    if (chat?.type === 'group') {
      return `${chat.participants.length} members`;
    }

    return getOtherParticipants()[0]?.isOnline ? 'Active now' : 'Available';
  };

  const getChatAvatar = () => {
    if (chat?.type === 'group') {
      return getAvatarLabel(chat.groupName, 'GR');
    }

    const otherParticipant = getOtherParticipants()[0];
    return getAvatarLabel(
      otherParticipant?.name,
      otherParticipant?.username,
      otherParticipant?.avatar,
      'U'
    );
  };

  const handleSendMessage = () => {
    if (!messageInput.trim()) {
      return;
    }

    onSendMessage(
      messageInput.trim(),
      'text',
      null,
      replyingToMessage?._id || null
    );
    setMessageInput('');
    setReplyingToMessage(null);
    if (onTyping) {
      onTyping(false);
    }
  };

  const handleInputChange = (event) => {
    const nextValue = event.target.value;
    setMessageInput(nextValue);
    if (onTyping) {
      onTyping(nextValue.length > 0);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const stopVoiceCaptureStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const buildVoiceFileFromChunks = (mimeType = 'audio/webm') => {
    const voiceBlob = new Blob(voiceChunksRef.current, { type: mimeType });
    if (!voiceChunksRef.current.length || voiceBlob.size === 0) {
      return null;
    }

    const extension = mimeType.includes('ogg')
      ? 'ogg'
      : mimeType.includes('mp4')
        ? 'm4a'
        : 'webm';

    return new File([voiceBlob], `voice-note-${Date.now()}.${extension}`, { type: mimeType });
  };

  const startVoiceRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceError('Voice notes are not supported in this browser.');
      return;
    }

    try {
      setVoiceError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ].find((candidate) => (
        typeof MediaRecorder.isTypeSupported !== 'function' || MediaRecorder.isTypeSupported(candidate)
      ));

      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      voiceChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data?.size) {
          voiceChunksRef.current.push(event.data);
        }
      };

      recorder.start(250);
      voiceRecordingStartedAtRef.current = Date.now();
      setIsRecordingVoice(true);
    } catch (error) {
      setVoiceError('Microphone access is required to record a voice note.');
      voiceRecordingStartedAtRef.current = 0;
      stopVoiceCaptureStream();
    }
  };

  const stopVoiceRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      return;
    }

    const recordedFile = await new Promise((resolve, reject) => {
      recorder.onstop = () => {
        window.setTimeout(() => {
          const nextFile = buildVoiceFileFromChunks(recorder.mimeType || 'audio/webm');
          if (!nextFile) {
            const recordingDuration = Date.now() - voiceRecordingStartedAtRef.current;
            reject(
              new Error(
                recordingDuration < 400
                  ? 'Record for a little longer before sending the voice note.'
                  : 'No audio was captured. Please try recording again.'
              )
            );
            return;
          }

          resolve(nextFile);
        }, 0);
      };

      recorder.onerror = () => {
        reject(new Error('Voice recording failed.'));
      };

      if (typeof recorder.requestData === 'function' && recorder.state === 'recording') {
        try {
          recorder.requestData();
        } catch (error) {
          // Ignore requestData errors and fall back to the stop event.
        }
      }

      recorder.stop();
    });

    setIsRecordingVoice(false);
    stopVoiceCaptureStream();
    mediaRecorderRef.current = null;
    voiceChunksRef.current = [];
    voiceRecordingStartedAtRef.current = 0;

    if (recordedFile && onSendVoiceMessage) {
      await onSendVoiceMessage(recordedFile);
    }
  };

  const handleVoiceButtonClick = async () => {
    if (sendingVoiceMessage) {
      return;
    }

    try {
      if (isRecordingVoice) {
        await stopVoiceRecording();
        return;
      }

      await startVoiceRecording();
    } catch (error) {
      setVoiceError(error.message || 'Unable to send voice note.');
      setIsRecordingVoice(false);
      stopVoiceCaptureStream();
      mediaRecorderRef.current = null;
      voiceChunksRef.current = [];
      voiceRecordingStartedAtRef.current = 0;
    }
  };

  const openMessageActions = (message, isOwnMessage, position) => {
    setContextMenu({
      message,
      canEdit: isOwnMessage && message.messageType === 'text' && !message.isPending,
      canRecall: isOwnMessage && !message.isPending,
      position,
    });
  };

  const buildActionMenuPosition = (event) => {
    const targetRect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 200;
    const menuHeight = 220;

    return {
      x: Math.max(12, Math.min(targetRect.left, window.innerWidth - menuWidth - 12)),
      y: Math.max(12, Math.min(targetRect.bottom + 8, window.innerHeight - menuHeight - 12)),
    };
  };

  const handleContextMenu = (event, message, isOwnMessage) => {
    if (message.isDeleted) {
      return;
    }

    event.preventDefault();
    openMessageActions(message, isOwnMessage, { x: event.clientX, y: event.clientY });
  };

  const handleActionButtonClick = (event, message, isOwnMessage) => {
    if (message.isDeleted) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    openMessageActions(message, isOwnMessage, buildActionMenuPosition(event));
  };

  const handleEditMessage = (message) => {
    setEditingMessageId(message._id);
    setEditingContent(message.content || '');
  };

  const handleRecallMessage = async (message) => {
    if (!message?._id) {
      return;
    }

    if (!window.confirm('Recall this message for everyone?')) {
      return;
    }

    await onDeleteMessage(message._id);
  };

  const handleReplyMessage = (message) => {
    setReplyingToMessage(message);
    setContextMenu(null);
  };

  const handleToggleImportantMessage = async (message) => {
    if (onToggleImportant) {
      await onToggleImportant(message._id);
    }
    setContextMenu(null);
  };

  const handleAddReaction = (message, event) => {
    if (event) {
      event.stopPropagation();
    }

    setSelectedMessageForReaction(message);
    setShowEmojiPicker(true);
  };

  const handleEmojiSelect = async (emoji) => {
    if (selectedMessageForReaction?._id) {
      await onAddReaction(selectedMessageForReaction._id, emoji);
      setSelectedMessageForReaction(null);
      setShowEmojiPicker(false);
      return;
    }

    setMessageInput((currentValue) => `${currentValue}${emoji}`);
    setShowEmojiPicker(false);
  };

  const handleSearchSelect = (message) => {
    const messageElement = messageContainerRef.current?.querySelector(
      `[data-message-id="${message._id}"]`
    );
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      messageElement.classList.add('highlight');
      window.setTimeout(() => messageElement.classList.remove('highlight'), 1800);
    }
    setShowSearch(false);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const handleSaveEdit = async () => {
    if (!editingContent.trim() || !editingMessageId) {
      return;
    }

    await onEditMessage(editingMessageId, editingContent.trim());
    handleCancelEdit();
  };

  const renderReplyPreview = (message) => {
    if (!message?.replyTo) {
      return null;
    }

    const replyAuthor = message.replyTo?.senderId?.name || 'Previous message';
    const replyText = message.replyTo?.content || 'Attachment';

    return (
      <div className="message-reply-preview">
        <strong>{replyAuthor}</strong>
        <span>{replyText}</span>
      </div>
    );
  };

  if (!chat) {
    return (
      <div className="chat-window empty-chat">
        <div className="empty-state">
          <p>Select a chat to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      <div className="chat-window-header">
        <div className="chat-header-profile">
          <span className="chat-header-avatar">{getChatAvatar()}</span>
          <div className="chat-header-info">
            <h3>{getChatTitle()}</h3>
            <p className="chat-status">{getChatInfo()}</p>
          </div>
        </div>
        <div className="chat-header-actions">
          <button
            className={`btn-icon ${showSearch ? 'active' : ''}`}
            title="Search messages"
            onClick={() => setShowSearch((current) => !current)}
            type="button"
          >
            Search
          </button>
          <button
            className={`btn-icon ${isChatCleared ? 'active' : ''}`}
            title={isChatCleared ? 'Show cleared messages again' : 'Clear this chat from your view'}
            onClick={isChatCleared ? onRestoreClearedChat : onClearChat}
            type="button"
          >
            {isChatCleared ? 'Restore' : 'Clear'}
          </button>
          <button
            className="btn-icon"
            title="Delete all messages in this chat"
            onClick={onDeleteAllMessages}
            type="button"
          >
            Delete All
          </button>
          <button className="btn-icon" title="Voice Call" onClick={() => onStartCall('audio')} type="button">
            Audio
          </button>
          <button className="btn-icon" title="Video Call" onClick={() => onStartCall('video')} type="button">
            Video
          </button>
          <button
            className={`btn-icon ${encryptionEnabled ? 'active' : ''}`}
            title={`${encryptionEnabled ? 'Disable' : 'Enable'} end-to-end encryption`}
            onClick={onToggleEncryption}
            type="button"
          >
            Encrypt
          </button>
        </div>
      </div>

      {showSearch && (
        <MessageSearch
          chatId={chat?._id}
          messages={messages}
          onSearch={onSearchMessages}
          onSelectMessage={handleSearchSelect}
          onClose={() => setShowSearch(false)}
        />
      )}

      <div className="messages-container" ref={messageContainerRef}>
        {isChatCleared ? (
          <div className="message-history-state">
            <p className="message-history-copy">This chat history is hidden from your view.</p>
            <button className="btn-pagination" onClick={onRestoreClearedChat} type="button">
              Show previous messages
            </button>
          </div>
        ) : (
          <MessagePagination
            visibleMessages={messages.length}
            totalMessages={Math.max(totalMessages, messages.length)}
            canShowOlderMessages={canShowOlderMessages}
            hasOlderMessagesLoaded={hasOlderMessagesLoaded}
            loadingOlderMessages={loadingOlderMessages}
            onShowOlderMessages={onShowOlderMessages}
            onShowLatestOnly={onShowLatestOnly}
          />
        )}

        {messages.length === 0 ? (
          <div className="no-messages">
            <p>{isChatCleared ? 'New messages will appear here.' : 'No messages yet. Say hello!'}</p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isOwnMessage = isSameEntity(message.senderId, currentUser);
            const isEditing = editingMessageId === message._id;

            return (
              <div
                key={message._id || index}
                className={`message ${isOwnMessage ? 'sent' : 'received'} ${
                  message.isDeleted ? 'deleted' : ''
                } ${message.isPending ? 'pending' : ''}`}
                data-message-id={message._id}
                onContextMenu={(event) => handleContextMenu(event, message, isOwnMessage)}
              >
                {!isOwnMessage && (
                  <span className="message-avatar">
                    {getAvatarLabel(
                      message.senderId?.name,
                      message.senderId?.username,
                      message.senderId?.avatar,
                      'U'
                    )}
                  </span>
                )}

                <div className="message-content">
                  {chat.type === 'group' && !isOwnMessage && (
                    <p className="message-sender">{message.senderId?.name}</p>
                  )}

                  <div className="message-bubble">
                    {renderReplyPreview(message)}

                    {isEditing ? (
                      <div className="message-edit-form">
                        <textarea
                          value={editingContent}
                          onChange={(event) => setEditingContent(event.target.value)}
                          className="edit-textarea"
                          autoFocus
                        />
                        <div className="edit-actions">
                          <button className="btn-edit-save" onClick={handleSaveEdit} type="button">
                            Save
                          </button>
                          <button className="btn-edit-cancel" onClick={handleCancelEdit} type="button">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : message.isDeleted ? (
                      <p className="message-deleted-text">This message was recalled.</p>
                    ) : (
                      <>
                        {message.messageType === 'text' && <p>{message.content}</p>}
                        {message.messageType === 'image' && (
                          <div className="message-media">
                            <img src={message.media?.url} alt="" />
                          </div>
                        )}
                        {message.messageType === 'video' && (
                          <div className="message-media">
                            <video src={message.media?.url} controls />
                          </div>
                        )}
                        {(message.messageType === 'audio' || message.messageType === 'voice') && (
                          <div className="message-media">
                            {message.messageType === 'voice' && (
                              <span className="voice-note-label">Voice note</span>
                            )}
                            {message.media?.url ? (
                              <audio controls preload="metadata">
                                <source src={message.media.url} type={message.media?.type || undefined} />
                                Your browser could not play this audio file.
                              </audio>
                            ) : (
                              <p className="message-media-fallback">Audio file is not available.</p>
                            )}
                          </div>
                        )}
                        {message.messageType === 'file' && (
                          <div className="message-media">
                            <a href={message.media?.url} target="_blank" rel="noreferrer">
                              {message.content || 'Open file'}
                            </a>
                          </div>
                        )}

                        {message.reactions?.length > 0 && (
                          <div className="message-reactions">
                            {message.reactions.map((reaction, reactionIndex) => (
                              <button
                                key={`${reaction.emoji}-${reactionIndex}`}
                                className="reaction-chip"
                                onClick={(event) => handleAddReaction(message, event)}
                                type="button"
                              >
                                {reaction.emoji}
                              </button>
                            ))}
                          </div>
                        )}

                        {(message.markedAsImportantBy || []).some(
                          (id) => id === resolvedCurrentUserId || id._id === resolvedCurrentUserId
                        ) && (
                          <div className="message-important-badge">
                            ⭐ Marked as important
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="message-meta">
                    <span className="message-time">
                      {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {message.isPending && (
                      <span className="message-pending-label">Sending...</span>
                    )}
                    {message.edits?.length > 0 && !message.isDeleted && (
                      <span className="message-edited-label">Edited</span>
                    )}
                    {isOwnMessage && !message.isPending && (
                      <ReadReceipts
                        deliveryStatus={message.deliveryStatus}
                        currentUserId={resolvedCurrentUserId}
                      />
                    )}
                    {!message.isDeleted && !message.isPending && isOwnMessage && (
                      <button
                        className="message-inline-action danger"
                        onClick={() => handleRecallMessage(message)}
                        type="button"
                        title="Recall message"
                      >
                        Recall
                      </button>
                    )}
                    {!message.isDeleted && (
                      <>
                        <button
                          className="message-react-trigger"
                          onClick={(event) => handleAddReaction(message, event)}
                          type="button"
                          title="Add reaction"
                        >
                          +
                        </button>
                        <button
                          className="message-inline-action"
                          onClick={(event) => handleActionButtonClick(event, message, isOwnMessage)}
                          type="button"
                          title="More actions"
                        >
                          More
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {typingUsers.size > 0 && (
          <div className="typing-indicator">
            <span className="typing-text">
              {Array.from(typingUsers).length === 1 ? 'Someone is typing...' : 'People are typing...'}
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {contextMenu && (
        <MessageContextMenu
          message={contextMenu.message}
          position={contextMenu.position}
          canEdit={contextMenu.canEdit}
          canRecall={contextMenu.canRecall}
          isImportant={(contextMenu.message?.markedAsImportantBy || []).some(
            (id) => id === resolvedCurrentUserId || id._id === resolvedCurrentUserId
          )}
          onEdit={handleEditMessage}
          onRecall={handleRecallMessage}
          onReply={handleReplyMessage}
          onReact={handleAddReaction}
          onToggleImportant={handleToggleImportantMessage}
          onDelete={handleRecallMessage}
          onClose={() => setContextMenu(null)}
        />
      )}

      {showEmojiPicker && (
        <EmojiPicker
          onSelectEmoji={handleEmojiSelect}
          onClose={() => {
            setShowEmojiPicker(false);
            setSelectedMessageForReaction(null);
          }}
        />
      )}

      <div className="message-input-area">
        {replyingToMessage && (
          <div className="replying-banner">
            <div className="replying-banner-content">
              <strong>Replying to {replyingToMessage.senderId?.name || 'message'}</strong>
              <span>{replyingToMessage.content || 'Attachment'}</span>
            </div>
            <button
              className="replying-banner-close"
              onClick={() => setReplyingToMessage(null)}
              type="button"
            >
              X
            </button>
          </div>
        )}

        <textarea
          value={messageInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="message-textarea"
          rows="1"
        />
        <div className="message-actions">
          <button
            className="btn-action"
            title="Emoji picker"
            onClick={() => {
              setSelectedMessageForReaction(null);
              setShowEmojiPicker((current) => !current);
            }}
            type="button"
          >
            Emoji
          </button>
          <button className="btn-action" title="Attach file" onClick={onOpenFileUpload} type="button">
            File
          </button>
          <button
            className={`btn-action ${isRecordingVoice ? 'voice-recording' : ''}`}
            title={isRecordingVoice ? 'Stop and send voice note' : 'Record voice note'}
            onClick={handleVoiceButtonClick}
            disabled={sendingVoiceMessage}
            type="button"
          >
            {sendingVoiceMessage ? 'Sending...' : isRecordingVoice ? 'Stop Voice' : 'Voice'}
          </button>
          <button
            className="btn-send"
            onClick={handleSendMessage}
            disabled={!messageInput.trim()}
            title="Send message"
            type="button"
          >
            Send
          </button>
        </div>
        {(isRecordingVoice || voiceError) && (
          <div className={`voice-note-status ${voiceError ? 'error' : ''}`}>
            {voiceError || 'Recording voice note... tap "Stop Voice" to send.'}
          </div>
        )}
        {encryptionEnabled && (
          <div className="encryption-indicator">
            <span className="encryption-text">Encryption enabled</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatWindow;
