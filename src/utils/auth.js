export const AUTH_TOKEN_STORAGE_KEY = "mb_auth_token";
export const LEGACY_AUTH_TOKEN_STORAGE_KEY = "token";
export const USER_DATA_KEY = "linkup_user_data";
export const PREFERRED_LOGIN_METHOD_KEY = "linkup_preferred_login_method";
export const HAS_MPIN_KEY = "linkup_has_mpin";

export const getStoredAuthToken = () =>
  localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || localStorage.getItem(LEGACY_AUTH_TOKEN_STORAGE_KEY) || "";

export const storeAuthToken = (token) => {
  if (!token) {
    return;
  }

  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  localStorage.setItem(LEGACY_AUTH_TOKEN_STORAGE_KEY, token);
};

export const clearStoredAuthToken = () => {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(LEGACY_AUTH_TOKEN_STORAGE_KEY);
};

export const clearStoredUserData = () => {
  localStorage.removeItem(USER_DATA_KEY);
};

export const clearStoredAuthData = () => {
  clearStoredAuthToken();
  clearStoredUserData();
  localStorage.removeItem(PREFERRED_LOGIN_METHOD_KEY);
  localStorage.removeItem(HAS_MPIN_KEY);
};

export const storeUserData = (userData) => {
  try {
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
    if (userData?.hasMpin) {
      localStorage.setItem(HAS_MPIN_KEY, "true");
    }
  } catch (error) {
    console.error('Failed to store user data:', error);
  }
};

export const getStoredUserData = () => {
  try {
    const data = localStorage.getItem(USER_DATA_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to retrieve user data:', error);
    return null;
  }
};

export const getPreferredLoginMethod = () => {
  try {
    return localStorage.getItem(PREFERRED_LOGIN_METHOD_KEY) || "otp";
  } catch {
    return "otp";
  }
};

export const setPreferredLoginMethod = (method) => {
  try {
    localStorage.setItem(PREFERRED_LOGIN_METHOD_KEY, method);
  } catch {
    // ignore
  }
};

export const getHasMpin = () => {
  try {
    return localStorage.getItem(HAS_MPIN_KEY) === "true";
  } catch {
    return false;
  }
};
