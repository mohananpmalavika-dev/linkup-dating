import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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
jest.mock('./ChatroomCreation', () => () => <div>Chatroom Creation</div>);
jest.mock('./ChatroomBrowser', () => () => <div>Chatroom Browser</div>);
jest.mock('./ChatroomList', () => () => <div>Chatroom List</div>);
jest.mock('./ChatroomPanel', () => () => <div>Chatroom Panel</div>);

const Messaging = require('./Messaging').default;

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();

  mockApiCall.mockImplementation((endpoint) => {
    if (endpoint === '/messaging/chats') {
      return Promise.resolve({ chats: [] });
    }

    if (endpoint === '/messaging/chatrooms/my-rooms') {
      return Promise.resolve({ chatrooms: [] });
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

test('opens the chatrooms workspace from the LinkUp sidebar', async () => {
  render(<Messaging />);

  fireEvent.click(screen.getByRole('button', { name: /chatrooms/i }));

  expect(await screen.findByText('Chatroom List')).toBeInTheDocument();
  expect(screen.getByText('Chatroom Panel')).toBeInTheDocument();

  await waitFor(() => {
    expect(mockApiCall).toHaveBeenCalledWith('/messaging/chatrooms/my-rooms', 'GET');
  });
});
