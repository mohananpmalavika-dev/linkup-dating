import React, { createContext, useCallback, useContext, useMemo } from "react";
import axios from "axios";
import { API_BASE_URL } from "../utils/api";

const AppContext = createContext();

axios.defaults.withCredentials = true;

export const AppProvider = ({ children, loggedInUser = null, language = "en", authToken = "" }) => {
  const currentUser = useMemo(() => loggedInUser || null, [loggedInUser]);
  const authHeaders = useMemo(
    () => (authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    [authToken]
  );

  // Keep the shared context focused on dating auth state and API helpers.
  const apiCall = useCallback(async (endpoint, method = "GET", data = null) => {
    const normalizedMethod = String(method || "GET").toUpperCase();
    const config = {
      method: normalizedMethod,
      url: `${API_BASE_URL}${endpoint}`,
      headers: authHeaders,
    };

    if (data !== null && data !== undefined) {
      if (normalizedMethod === "GET") {
        config.params = data;
      } else {
        config.data = data;
      }
    }

    const response = await axios(config);
    return response.data;
  }, [authHeaders]);

  const contextValue = useMemo(() => ({
    apiCall,
    currentUser,
    language,
  }), [apiCall, currentUser, language]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }

  return context;
};
