import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import CallWindow from './CallWindow';

jest.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    currentUser: {
      _id: 'user-1',
      name: 'Current User',
      email: 'current@example.com',
    },
  }),
}));

const baseCall = {
  _id: 'call-1',
  callType: 'audio',
  status: 'accepted',
  initiatorId: 'user-1',
  recipientId: 'user-2',
  currentUserId: 'user-1',
  recipient: {
    _id: 'user-2',
    name: 'Other User',
    email: 'other@example.com',
  },
};

const socketMock = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
};

let originalGetUserMedia;
let playSpy;
let peerConnections;

beforeAll(() => {
  Object.defineProperty(window.HTMLMediaElement.prototype, 'srcObject', {
    configurable: true,
    writable: true,
    value: null,
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  originalGetUserMedia = navigator.mediaDevices?.getUserMedia;
  playSpy = jest
    .spyOn(window.HTMLMediaElement.prototype, 'play')
    .mockResolvedValue(undefined);
  peerConnections = [];

  const audioTrack = {
    kind: 'audio',
    enabled: true,
    stop: jest.fn(),
  };

  navigator.mediaDevices = {
    ...navigator.mediaDevices,
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: () => [audioTrack],
      getAudioTracks: () => [audioTrack],
      getVideoTracks: () => [],
    }),
  };

  global.RTCPeerConnection = jest.fn(() => {
    const connection = {
      connectionState: 'new',
      localDescription: null,
      remoteDescription: null,
      onicecandidate: null,
      ontrack: null,
      onconnectionstatechange: null,
      addTrack: jest.fn(),
      getSenders: jest.fn(() => []),
      close: jest.fn(),
    };

    peerConnections.push(connection);
    return connection;
  });
});

afterEach(() => {
  playSpy.mockRestore();

  if (originalGetUserMedia) {
    navigator.mediaDevices = {
      ...navigator.mediaDevices,
      getUserMedia: originalGetUserMedia,
    };
  }

  delete global.RTCPeerConnection;
});

test('plays the remote media stream during accepted audio calls', async () => {
  const { container } = render(
    <CallWindow
      call={baseCall}
      socket={socketMock}
      onEndCall={jest.fn()}
      onAcceptCall={jest.fn()}
      onDeclineCall={jest.fn()}
    />
  );

  const remoteAudio = container.querySelector('audio.call-hidden-audio');
  expect(remoteAudio).not.toBeNull();

  await waitFor(() => {
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: true,
      video: false,
    });
    expect(global.RTCPeerConnection).toHaveBeenCalledTimes(1);
  });

  const remoteStream = { id: 'remote-stream' };

  act(() => {
    peerConnections[0].ontrack({
      streams: [remoteStream],
    });
  });

  expect(remoteAudio.srcObject).toBe(remoteStream);
  expect(playSpy).toHaveBeenCalled();
});
