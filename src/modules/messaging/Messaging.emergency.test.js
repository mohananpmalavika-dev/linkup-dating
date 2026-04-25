import React from 'react';
import { render, screen } from '@testing-library/react';

const mockApiCall = jest.fn();
jest.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    currentUser: {
      _id: 'user-1',
      name: 'Current User',
      email: 'current@example.com',
    },
    apiCall: mockApiCall,
  }),
}));

jest.mock('../../utils/auth', () => ({
  getStoredAuthToken: () => 'test-token',
}));

jest.mock('socket.io-client', () => {
  const mockSocketInstance = {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
  const mockSocketIo = jest.fn(() => mockSocketInstance);
  mockSocketIo.io = mockSocketIo;
  return mockSocketIo;
});

jest.mock('../../pwaConfig', () => ({
  getNotificationPermission: () => 'denied',
  requestNotificationPermission: jest.fn(async () => 'denied'),
  showServiceWorkerNotification: jest.fn(),
}));

jest.mock('./ChatList', () => () => <div>Chat List</div>);
jest.mock('./ChatWindow', () => () => <div>Chat Window</div>);
jest.mock('./ContactsList', () => () => <div>Contacts List</div>);
jest.mock('./CallWindow', () => () => <div>Call Window</div>);
jest.mock('./AISmartReplies', () => () => null);
jest.mock('./FileUpload', () => () => null);
jest.mock('./NotificationBell', () => () => <div>Notification Bell</div>);
jest.mock('./InvitationPanel', () => () => <div>Invitation Panel</div>);
jest.mock('./VisibilitySettings', () => () => <div>Visibility Settings</div>);
jest.mock('./ContactMeansSettings', () => () => <div>Contact Means Settings</div>);
jest.mock('./GroupCreation', () => () => <div>Group Creation</div>);
jest.mock('./ScheduledBlockManager', () => () => <div>Scheduled Block Manager</div>);
jest.mock('./ChatroomCreation', () => () => null);
jest.mock('./ChatroomBrowser', () => () => null);
jest.mock('./ChatroomList', () => () => null);
jest.mock('./ChatroomPanel', () => () => null);

const Messaging = require('./Messaging').default;

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();

  mockApiCall.mockImplementation((endpoint) => {
    if (endpoint === '/messaging/chats') {
      return Promise.resolve({ chats: [] });
    }

    if (endpoint === '/messaging/contacts') {
      return Promise.resolve({ contacts: [] });
    }

    if (endpoint === '/messaging/notifications') {
      return Promise.resolve({ notifications: [] });
    }

    if (endpoint === '/invitations/pending') {
      return Promise.resolve({ invitations: [] });
    }

    return Promise.resolve({});
  });
});

test('hydrates a pending emergency video call from session storage', async () => {
  window.sessionStorage.setItem(
    'malabarbazaar-emergency-call',
    JSON.stringify({
      _id: 'call-1',
      callId: 'call-1',
      chatId: 'chat-1',
      initiatorId: 'user-2',
      recipientId: 'user-1',
      callType: 'video',
      status: 'ringing',
      emergency: true,
      caller: {
        _id: 'user-2',
        name: 'Emergency Contact',
        email: 'emergency@example.com',
      },
      sosAlert: {
        reason: 'Unsafe situation',
        location: '9.93120, 76.26730 (12m accuracy)',
      },
    })
  );

  render(<Messaging />);

  expect(await screen.findByText(/Emergency Contact/i)).toBeInTheDocument();
  expect(screen.getByText(/Incoming video call/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
});
