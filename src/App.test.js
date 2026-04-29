import { fireEvent, render, screen } from "@testing-library/react";
import axios from "axios";

jest.mock("axios");

const mockAxiosInstance = {
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
};

axios.create.mockReturnValue(mockAxiosInstance);

jest.mock("./components/AgeGate/AgeGate", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ onAgeVerified }) => {
      React.useEffect(() => {
        onAgeVerified?.({
          method: "dob",
          dateOfBirth: "2000-01-01",
          age: 26,
        });
      }, [onAgeVerified]);

      return <div />;
    },
  };
});

const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock("socket.io-client", () => {
  const mockSocketIo = jest.fn(() => mockSocket);
  mockSocketIo.io = mockSocketIo;
  return mockSocketIo;
});

jest.mock("./services/datingProfileService", () => ({
  __esModule: true,
  default: {
    getMatches: jest.fn(),
    getLikesReceived: jest.fn(),
    getWhoLikedMe: jest.fn(),
    getMessageRequests: jest.fn(),
    getDateProposals: jest.fn(),
    trackFunnelEvent: jest.fn(),
    sendHeartbeat: jest.fn(),
  },
}));

jest.mock("./services/datingMessagingService", () => ({
  __esModule: true,
  default: {
    getUnreadCount: jest.fn(),
  },
}));

jest.mock("./services/notificationService", () => ({
  __esModule: true,
  default: {
    getPermissionStatus: jest.fn(),
    notify: jest.fn(),
  },
}));

jest.mock("./services/videoCallService", () => ({
  __esModule: true,
  default: {
    deliverDueReminders: jest.fn(),
  },
}));

jest.mock("./services/dateSafetyService", () => ({
  __esModule: true,
  default: {
    startSession: jest.fn(),
    updateLocation: jest.fn(),
    sendCheckIn: jest.fn(),
    activateSOS: jest.fn(),
    endSession: jest.fn(),
    getSessionDetails: jest.fn(),
    getSharedLocation: jest.fn(),
    getSafetyTips: jest.fn(),
    acknowledgeSafetyTips: jest.fn(),
    getSessionHistory: jest.fn(),
    getUserLocation: jest.fn(),
    watchUserLocation: jest.fn(),
    stopWatchingLocation: jest.fn(),
    reverseGeocode: jest.fn(),
  },
}));

jest.mock("./services/remindersService", () => ({
  __esModule: true,
  default: {
    getAcceptedTrustedContacts: jest.fn(),
  },
  getAcceptedTrustedContacts: jest.fn(),
}));

const App = require("./App").default;
const datingProfileService = require("./services/datingProfileService").default;
const datingMessagingService = require("./services/datingMessagingService").default;
const notificationService = require("./services/notificationService").default;
const videoCallService = require("./services/videoCallService").default;
const dateSafetyService = require("./services/dateSafetyService").default;
const { getAcceptedTrustedContacts } = require("./services/remindersService");

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  window.history.pushState({}, "", "/");

  axios.get.mockResolvedValue({ data: { available: true } });
  axios.post.mockResolvedValue({ data: { success: true } });
  axios.put.mockResolvedValue({ data: { success: true } });
  axios.patch.mockResolvedValue({ data: { success: true } });

  datingProfileService.getMatches.mockResolvedValue({ matches: [] });
  datingProfileService.getLikesReceived.mockResolvedValue([]);
  datingProfileService.getWhoLikedMe.mockResolvedValue({ likers: [], isPremium: false });
  datingProfileService.getMessageRequests.mockResolvedValue({ requests: [] });
  datingProfileService.getDateProposals.mockResolvedValue({ proposals: [] });
  datingProfileService.trackFunnelEvent.mockResolvedValue({});
  datingProfileService.sendHeartbeat.mockResolvedValue({});

  datingMessagingService.getUnreadCount.mockResolvedValue({ unreadCount: 0 });
  notificationService.getPermissionStatus.mockReturnValue({ canNotify: false });
  videoCallService.deliverDueReminders.mockResolvedValue({ reminders: [] });
  getAcceptedTrustedContacts.mockResolvedValue({
    contacts: [
      { id: "contact-1", name: "Anu", relationship: "Sister" },
    ],
  });
  dateSafetyService.getSafetyTips.mockResolvedValue({
    success: true,
    tips: [
      {
        id: 1,
        title: "Meet in Public",
        description: "Pick a busy first-date venue.",
      },
    ],
  });
  dateSafetyService.getSessionHistory.mockResolvedValue({ success: true, sessions: [] });
  dateSafetyService.getUserLocation.mockResolvedValue({
    latitude: 9.9312,
    longitude: 76.2673,
    accuracy: 15,
  });
  dateSafetyService.watchUserLocation.mockReturnValue(1);
  dateSafetyService.reverseGeocode.mockResolvedValue("Kochi, Kerala");
});

test("renders the dating-only launch screen", async () => {
  render(<App />);

  expect(
    await screen.findByRole("heading", { level: 1, name: /real matches start here/i })
  ).toBeInTheDocument();
  expect(screen.getByText(/^linkup dating$/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /sign up/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /register as an entrepreneur/i })).not.toBeInTheDocument();
  expect(screen.queryByText(/kerala super app/i)).not.toBeInTheDocument();
});

test("opens the public privacy policy from the launch screen", async () => {
  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: /privacy policy/i }));

  expect(
    await screen.findByRole("heading", { level: 1, name: /privacy policy/i })
  ).toBeInTheDocument();
  expect(screen.getByText(/audio or video dating tools/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /support/i })).toBeInTheDocument();
});

test("opens the public delete-account resource from the launch screen", async () => {
  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: /delete account/i }));

  expect(
    await screen.findByRole("heading", { level: 1, name: /delete account/i })
  ).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 2, name: /request deletion without app access/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /email deletion request/i })).toHaveAttribute(
    "href",
    expect.stringContaining("Account%20Deletion%20Request")
  );
});

test("opens the simplified login flow", async () => {
  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: /login/i }));

  expect(
    screen.getByRole("heading", { level: 2, name: /verify your account/i })
  ).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1, name: /linkup/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /send login otp/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/email address or phone number/i)).toBeInTheDocument();
  expect(screen.queryByRole("group", { name: /business categories/i })).not.toBeInTheDocument();
  expect(screen.queryByText(/seller dashboard/i)).not.toBeInTheDocument();
});

test("opens the dating signup flow from the launch screen", async () => {
  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: /sign up/i }));

  expect(
    screen.getByRole("heading", { level: 1, name: /create your dating profile/i })
  ).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 2, name: /create your account/i })).toBeInTheDocument();
  // DatingSignUp uses a <label> not wired with htmlFor -> input, so assert by visible text.
  expect(screen.getByText(/phone number \(optional\)/i)).toBeInTheDocument();
  expect(screen.getByText(/real matches, safe dates, better conversations/i)).toBeInTheDocument();
});

test("authenticated users only see dating navigation and inbox content", async () => {
  localStorage.setItem("mb_auth_token", "token");
  localStorage.setItem(
    "linkup_user_data",
    JSON.stringify({
      email: "person@example.com",
      name: "Person",
      avatar: "P",
      registrationType: "user",
      role: "user",
    })
  );
  window.history.pushState({}, "", "/messages");

  render(<App />);

  expect(await screen.findByRole("heading", { level: 2, name: /inbox/i })).toBeInTheDocument();
  expect(screen.getByText(/no messages yet\. start a conversation from your matches!/i)).toBeInTheDocument();

  // DatingNavigation uses role="tab" with aria-labels
  expect(screen.getByRole("tab", { name: /discover/i })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /browse/i })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /matches/i })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /inbox/i })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /social/i })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /sos/i })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /profile/i })).toBeInTheDocument();

  expect(screen.queryByRole("button", { name: /local market/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /globemart/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /feastly/i })).not.toBeInTheDocument();
});

test("authenticated users can open the Kerala SOS safety center", async () => {
  localStorage.setItem("mb_auth_token", "token");
  localStorage.setItem(
    "linkup_user_data",
    JSON.stringify({
      email: "person@example.com",
      name: "Person",
      city: "Kochi",
      district: "ernakulam",
      keralaRegion: "central",
      registrationType: "user",
      role: "user",
    })
  );
  window.history.pushState({}, "", "/messages");

  render(<App />);

  fireEvent.click(await screen.findByRole("tab", { name: /sos/i }));

  expect(
    await screen.findByRole("heading", { level: 1, name: /kerala sos safety center/i })
  ).toBeInTheDocument();
  expect(screen.getByText(/official kerala help paths/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /call kerala emergency 112/i })).toBeInTheDocument();
});
