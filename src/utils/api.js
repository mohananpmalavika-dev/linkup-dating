import axios from 'axios';
import { getStoredAuthToken } from './auth';

const DEFAULT_API_BASE_URL = "http://localhost:5000/api";

const stripTrailingSlashes = (value = "") => String(value || "").trim().replace(/\/+$/, "");

export const normalizeApiBaseUrl = (value = "") => {
  const normalizedValue = stripTrailingSlashes(value);

  if (!normalizedValue) {
    return DEFAULT_API_BASE_URL;
  }

  return /\/api$/i.test(normalizedValue) ? normalizedValue : `${normalizedValue}/api`;
};

export const normalizeBackendBaseUrl = (value = "") => {
  const normalizedValue = stripTrailingSlashes(value);

  if (!normalizedValue) {
    return DEFAULT_API_BASE_URL.replace(/\/api$/i, "");
  }

  return normalizedValue.replace(/\/api$/i, "");
};

export const API_BASE_URL = normalizeApiBaseUrl(process.env.REACT_APP_API_URL || "");
export const BACKEND_BASE_URL = normalizeBackendBaseUrl(
  process.env.REACT_APP_BACKEND_URL || API_BASE_URL
);
export const API_ORIGIN = BACKEND_BASE_URL;

export const buildApiUrl = (path = "") => {
  const normalizedPath = String(path || "").startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

// Configure axios interceptor to add auth token to all requests
axios.interceptors.request.use((config) => {
  const token = getStoredAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});
