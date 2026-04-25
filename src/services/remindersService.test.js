jest.mock("axios", () => {
  const mockAxiosInstance = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  };

  return {
    __esModule: true,
    default: {
      create: jest.fn(() => mockAxiosInstance),
    },
  };
});

import axios from "axios";

import {
  createReminder,
  fetchReminders,
  toggleReminderCompletion,
  updateReminder,
} from "./remindersService";

const mockAxiosInstance = axios.create();

describe("remindersService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("normalizes ISO due dates returned by the API", async () => {
    mockAxiosInstance.get.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            _id: "rem-1",
            title: "Doctor follow-up",
            dueDate: "2030-05-12T00:00:00.000Z",
            dueTime: "09:00",
            reminders: ["In-app"],
            completed: false,
          },
        ],
      },
    });

    const response = await fetchReminders({ limit: 20 });

    expect(mockAxiosInstance.get).toHaveBeenCalledWith("/reminders", {
      params: { limit: 20 },
    });
    expect(response.data).toEqual([
      expect.objectContaining({
        _id: "rem-1",
        dueDate: "2030-05-12",
        dueTime: "09:00",
      }),
    ]);
  });

  test("sends create and update payloads with date-input values", async () => {
    mockAxiosInstance.post.mockResolvedValue({
      data: {
        success: true,
        data: {
          _id: "rem-2",
          title: "Pay vendor",
          dueDate: "2030-05-14T00:00:00.000Z",
          reminders: ["SMS"],
        },
      },
    });
    mockAxiosInstance.put.mockResolvedValue({
      data: {
        success: true,
        data: {
          _id: "rem-2",
          title: "Pay vendor",
          dueDate: "2030-05-15T00:00:00.000Z",
          reminders: ["SMS"],
          completed: true,
        },
      },
    });

    await createReminder({
      title: "Pay vendor",
      dueDate: new Date("2030-05-14T00:00:00.000Z"),
      reminders: ["SMS"],
    });
    await updateReminder("rem-2", {
      dueDate: "2030-05-15T00:00:00.000Z",
      reminders: ["SMS"],
    });
    await toggleReminderCompletion("rem-2", true);

    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      "/reminders",
      expect.objectContaining({
        title: "Pay vendor",
        dueDate: "2030-05-14",
      })
    );
    expect(mockAxiosInstance.put).toHaveBeenNthCalledWith(
      1,
      "/reminders/rem-2",
      expect.objectContaining({
        dueDate: "2030-05-15",
      })
    );
    expect(mockAxiosInstance.put).toHaveBeenNthCalledWith(
      2,
      "/reminders/rem-2",
      { completed: true }
    );
  });
});
