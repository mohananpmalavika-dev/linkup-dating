import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ChatWindow from './ChatWindow';

jest.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    currentUser: {
      _id: 'user-1',
      name: 'Current User',
      email: 'current@example.com',
    },
  }),
}));

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  jest.clearAllMocks();
  window.confirm = jest.fn(() => true);
});

const baseChat = {
  _id: 'chat-1',
  type: 'direct',
  participants: [
    { _id: 'user-1', name: 'Current User', email: 'current@example.com' },
    { _id: 'user-2', name: 'Other User', email: 'other@example.com', isOnline: true },
  ],
};

const baseMessage = {
  _id: 'message-1',
  chatId: 'chat-1',
  senderId: { _id: 'user-1', name: 'Current User', email: 'current@example.com' },
  content: 'Need to recall this',
  messageType: 'text',
  createdAt: '2026-04-24T10:00:00.000Z',
  deliveryStatus: [],
};

const renderChatWindow = (props = {}) =>
  render(
    <ChatWindow
      chat={baseChat}
      messages={[baseMessage]}
      onSendMessage={jest.fn()}
      onTyping={jest.fn()}
      typingUsers={new Set()}
      encryptionEnabled={false}
      onToggleEncryption={jest.fn()}
      onStartCall={jest.fn()}
      onOpenFileUpload={jest.fn()}
      onEditMessage={jest.fn()}
      onDeleteMessage={jest.fn()}
      onAddReaction={jest.fn()}
      onSearchMessages={jest.fn()}
      focusedMessageId=""
      onFocusHandled={jest.fn()}
      onSendVoiceMessage={jest.fn()}
      sendingVoiceMessage={false}
      onShowOlderMessages={jest.fn()}
      onShowLatestOnly={jest.fn()}
      onClearChat={jest.fn()}
      onRestoreClearedChat={jest.fn()}
      {...props}
    />
  );

test('lets the user recall their own sent message', async () => {
  const onDeleteMessage = jest.fn().mockResolvedValue(undefined);

  renderChatWindow({ onDeleteMessage });

  fireEvent.click(screen.getByRole('button', { name: /recall/i }));

  await waitFor(() => {
    expect(window.confirm).toHaveBeenCalledWith('Recall this message for everyone?');
    expect(onDeleteMessage).toHaveBeenCalledWith('message-1');
  });
});

test('shows older-message controls without growing the chat UI', () => {
  renderChatWindow({
    totalMessages: 42,
    canShowOlderMessages: true,
    hasOlderMessagesLoaded: true,
  });

  expect(screen.getByText(/showing 1 of 42 messages/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /show older messages/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /show latest only/i })).toBeInTheDocument();
});

test('switches the header action to restore after the chat is cleared', () => {
  const onRestoreClearedChat = jest.fn();

  renderChatWindow({
    messages: [],
    isChatCleared: true,
    onRestoreClearedChat,
  });

  fireEvent.click(screen.getByRole('button', { name: /restore/i }));
  expect(onRestoreClearedChat).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: /show previous messages/i })).toBeInTheDocument();
});

test('renders voice notes with a playable audio source', () => {
  const voiceMessage = {
    ...baseMessage,
    _id: 'voice-1',
    content: 'Voice note',
    messageType: 'voice',
    media: {
      url: 'https://example.com/uploads/voice-note.webm',
      type: 'audio/webm',
    },
  };

  const { container } = renderChatWindow({
    messages: [voiceMessage],
  });

  expect(screen.getByText(/voice note/i)).toBeInTheDocument();
  const source = container.querySelector('audio source');
  expect(source).not.toBeNull();
  expect(source).toHaveAttribute('src', 'https://example.com/uploads/voice-note.webm');
  expect(source).toHaveAttribute('type', 'audio/webm');
});
