import React, { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import {
  getAvatarLabel,
  getChatClearTimestamp,
  isMessageHiddenByClear,
  isSameEntity,
} from './utils';

const ChatList = ({
  chats,
  selectedChat,
  onSelectChat,
  onNewChat,
  searchQuery,
  onSearchChange,
  clearedChats = {},
}) => {
  const { currentUser } = useApp();
  const [filteredChats, setFilteredChats] = useState(chats);

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      setFilteredChats(
        chats.filter(
          (chat) =>
            chat.groupName?.toLowerCase().includes(query) ||
            chat.participants?.some((participant) => participant.name?.toLowerCase().includes(query))
        )
      );
      return;
    }

    setFilteredChats(chats);
  }, [searchQuery, chats]);

  const getOtherUser = (chat) =>
    chat.participants?.find((participant) => !isSameEntity(participant, currentUser));

  const getChatTitle = (chat) => {
    if (chat.type === 'group') {
      return chat.groupName;
    }

    return getOtherUser(chat)?.name || 'Unknown User';
  };

  const getChatAvatar = (chat) => {
    if (chat.type === 'group') {
      return getAvatarLabel(chat.groupName, 'GR');
    }

    const otherUser = getOtherUser(chat);
    return getAvatarLabel(otherUser?.name, otherUser?.username, otherUser?.avatar, 'U');
  };

  const getChatPreview = (chat) => {
    const lastMessage = chat.lastMessage;
    const clearedAt = getChatClearTimestamp(chat?._id, clearedChats);
    const lastVisibleCandidate = lastMessage || { createdAt: chat?.lastMessageAt };

    if (isMessageHiddenByClear(lastVisibleCandidate, clearedAt)) {
      return 'Chat cleared. New messages will appear here.';
    }

    if (!lastMessage) {
      return 'No messages yet';
    }

    switch (lastMessage.messageType) {
      case 'voice':
        return 'Voice note';
      case 'audio':
        return 'Audio message';
      case 'image':
        return 'Photo shared';
      case 'video':
        return 'Video shared';
      case 'file':
        return lastMessage.content || 'File shared';
      default:
        return lastMessage.content?.substring(0, 50) || 'No messages yet';
    }
  };

  const getChatTime = (chat) => {
    const clearedAt = getChatClearTimestamp(chat?._id, clearedChats);
    if (isMessageHiddenByClear(chat?.lastMessage || { createdAt: chat?.lastMessageAt }, clearedAt)) {
      return '';
    }

    return chat.lastMessageAt
      ? new Date(chat.lastMessageAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';
  };

  return (
    <div className="chat-list-container">
      <div className="chat-list-header">
        <div className="chat-list-header-copy">
          <h2>LinkUp</h2>
          <p className="chat-list-subtitle">Private chats, voice notes, and quick replies</p>
        </div>
        <button className="btn-new-chat" onClick={onNewChat} title="Start new chat" type="button">
          New Chat
        </button>
      </div>

      <div className="chat-search">
        <input
          type="text"
          placeholder="Search chats or names..."
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          className="search-input"
        />
      </div>

      <div className="chats-list">
        {filteredChats.length > 0 ? (
          filteredChats.map((chat) => (
            <div
              key={chat._id}
              className={`chat-item ${selectedChat?._id === chat._id ? 'active' : ''}`}
              onClick={() => onSelectChat(chat)}
            >
              <span className="chat-avatar">{getChatAvatar(chat)}</span>
              <div className="chat-item-info">
                <h4 className="chat-title">{getChatTitle(chat)}</h4>
                <p className="chat-preview">{getChatPreview(chat)}</p>
              </div>
              <div className="chat-item-meta">
                {chat.unreadCount > 0 && <span className="unread-badge">{chat.unreadCount}</span>}
                <span className="chat-time">{getChatTime(chat)}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-chats">
            <p>No conversations yet</p>
            <button className="btn-start-chat" onClick={onNewChat} type="button">
              Start a chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatList;
