import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import { AppProvider, useApp } from "./AppContext";
import { API_BASE_URL } from "../utils/api";

jest.mock("axios");

const ContextProbe = () => {
  const { apiCall, currentUser, language } = useApp();

  return (
    <div>
      <div data-testid="current-user">{currentUser?.name || "anonymous"}</div>
      <div data-testid="current-language">{language}</div>
      <button
        type="button"
        onClick={() => apiCall("/voice-input/process", "POST", { sample: "hello" })}
      >
        Call API
      </button>
    </div>
  );
};

describe("AppContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.mockResolvedValue({ data: { success: true } });
  });

  test("exposes the logged-in user and selected language", () => {
    render(
      <AppProvider
        loggedInUser={{ id: "user-1", name: "Asha" }}
        language="ml"
      >
        <ContextProbe />
      </AppProvider>
    );

    expect(screen.getByTestId("current-user")).toHaveTextContent("Asha");
    expect(screen.getByTestId("current-language")).toHaveTextContent("ml");
  });

  test("builds authenticated API requests for the dating app", async () => {
    render(
      <AppProvider authToken="secret-token">
        <ContextProbe />
      </AppProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: /call api/i }));

    await waitFor(() => {
      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: `${API_BASE_URL}/voice-input/process`,
          headers: { Authorization: "Bearer secret-token" },
          data: { sample: "hello" },
        })
      );
    });
  });
});
