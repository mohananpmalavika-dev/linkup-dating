import axios from "axios";
import { API_BASE_URL } from "../utils/api";

// Configure axios to send cookies with requests
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

const appendFormValue = (formData, key, value) => {
  if (value === undefined || value === null) {
    return;
  }

  if (Array.isArray(value) || (typeof value === "object" && !(value instanceof Date))) {
    formData.append(key, JSON.stringify(value));
    return;
  }

  formData.append(key, value);
};

export const buildLocalDateParam = (value = new Date()) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const buildTimezoneOffsetParam = (value = new Date()) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return String(date.getTimezoneOffset());
};

/**
 * Fetch all diary entries
 * @param {Object} options - Query options
 * @param {string} options.category - Filter by category
 * @param {string} options.mood - Filter by mood
 * @param {string} options.search - Search query
 * @param {number} options.limit - Limit results
 * @param {number} options.skip - Skip results for pagination
 * @returns {Promise<Object>} - Response with diary entries and pagination info
 */
export const fetchDiaryEntries = async (options = {}) => {
  try {
    const params = {};
    if (options.category) params.category = options.category;
    if (options.mood) params.mood = options.mood;
    if (options.search) params.search = options.search;
    if (options.limit) params.limit = options.limit;
    if (options.skip) params.skip = options.skip;
    if (options.sortBy) params.sortBy = options.sortBy;

    const response = await axiosInstance.get("/diary", { params });
    return response.data;
  } catch (error) {
    console.error("Error fetching diary entries:", error);
    throw new Error(
      error.response?.data?.message || "Failed to fetch diary entries"
    );
  }
};

/**
 * Fetch draft entries
 * @returns {Promise<Object>} - Response with draft entries
 */
export const fetchDraftEntries = async (options = {}) => {
  try {
    const params = {};
    if (options.limit) params.limit = options.limit;
    if (options.skip) params.skip = options.skip;

    const response = await axiosInstance.get("/diary/drafts", { params });
    return response.data;
  } catch (error) {
    console.error("Error fetching draft entries:", error);
    throw new Error(
      error.response?.data?.message || "Failed to fetch draft entries"
    );
  }
};

/**
 * Fetch all unique tags
 * @returns {Promise<Object>} - Response with tags and their counts
 */
export const fetchTags = async () => {
  try {
    const response = await axiosInstance.get("/diary/tags");
    return response.data;
  } catch (error) {
    console.error("Error fetching tags:", error);
    throw new Error(error.response?.data?.message || "Failed to fetch tags");
  }
};

/**
 * Fetch mood statistics
 * @param {number} days - Number of days to analyze (default: 30)
 * @returns {Promise<Object>} - Response with mood statistics
 */
export const fetchMoodStats = async (days = 30) => {
  try {
    const response = await axiosInstance.get("/diary/mood-stats", {
      params: { days }
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching mood stats:", error);
    throw new Error(
      error.response?.data?.message || "Failed to fetch mood statistics"
    );
  }
};

/**
 * Fetch single diary entry
 * @param {string} entryId - ID of entry to fetch
 * @returns {Promise<Object>} - Response with diary entry
 */
export const fetchDiaryEntry = async (entryId) => {
  try {
    const response = await axiosInstance.get(`/diary/${entryId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching diary entry:", error);
    throw new Error(
      error.response?.data?.message || "Failed to fetch diary entry"
    );
  }
};

/**
 * Create a new diary entry (multipart for files)
 * @param {Object} entryData - Entry data
 * @param {File[]} files - Optional files
 * @returns {Promise<Object>} - Created diary entry
 */
export const createDiaryEntry = async (entryData, files = []) => {
  const formData = new FormData();
  Object.keys(entryData).forEach((key) => {
    appendFormValue(formData, key, entryData[key]);
  });
  files.forEach((file) => formData.append("attachments", file));
  
  try {
    const response = await axiosInstance.post("/diary", formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error creating diary entry:", error);
    throw new Error(
      error.response?.data?.message || "Failed to create diary entry"
    );
  }
};

/**
 * Update an existing diary entry (multipart for files)
 * @param {string} entryId - ID of entry to update
 * @param {Object} entryData - Updated entry data
 * @param {File[]} files - Optional new files
 * @returns {Promise<Object>} - Updated diary entry
 */
export const updateDiaryEntry = async (entryId, entryData, files = []) => {
  const formData = new FormData();
  Object.keys(entryData).forEach((key) => {
    appendFormValue(formData, key, entryData[key]);
  });
  files.forEach((file) => formData.append("attachments", file));
  
  try {
    const response = await axiosInstance.put(`/diary/${entryId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error updating diary entry:", error);
    throw new Error(
      error.response?.data?.message || "Failed to update diary entry"
    );
  }
};

/**
 * Delete a diary entry
 * @param {string} entryId - ID of entry to delete
 * @returns {Promise<Object>} - Deletion confirmation
 */
export const deleteDiaryEntry = async (entryId) => {
  try {
    const response = await axiosInstance.delete(`/diary/${entryId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting diary entry:", error);
    throw new Error(
      error.response?.data?.message || "Failed to delete diary entry"
    );
  }
};

/**
 * Get entries for a specific date
 * @param {Date} date - Date to fetch entries for
 * @returns {Promise<Object>} - Entries for that date
 */
export const fetchEntriesByDate = async (date) => {
  try {
    const dateString = new Date(date).toISOString().split("T")[0];
    const response = await axiosInstance.get(`/diary/by-date/${dateString}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching entries by date:", error);
    throw new Error(
      error.response?.data?.message || "Failed to fetch entries by date"
    );
  }
};

/**
 * Fetch diary calendar notes and reminders
 * @param {Object} options - Optional filters
 * @returns {Promise<Object>} - Response with calendar items
 */
export const fetchDiaryCalendarItems = async (options = {}) => {
  try {
    const params = {};
    if (options.date) params.date = options.date;
    if (options.month) params.month = options.month;
    if (options.startDate) params.startDate = options.startDate;
    if (options.endDate) params.endDate = options.endDate;
    if (options.limit) params.limit = options.limit;

    const response = await axiosInstance.get("/diary/calendar-items", { params });
    return response.data;
  } catch (error) {
    console.error("Error fetching diary calendar items:", error);
    throw new Error(
      error.response?.data?.message || "Failed to fetch diary calendar items"
    );
  }
};

/**
 * Create a diary calendar note or reminder
 * @param {Object} itemData - Calendar item payload
 * @returns {Promise<Object>} - Created calendar item
 */
export const createDiaryCalendarItem = async (itemData) => {
  try {
    const response = await axiosInstance.post("/diary/calendar-items", itemData);
    return response.data;
  } catch (error) {
    console.error("Error creating diary calendar item:", error);
    throw new Error(
      error.response?.data?.message || "Failed to create diary calendar item"
    );
  }
};

/**
 * Update a diary calendar note or reminder
 * @param {string} itemId - Calendar item ID
 * @param {Object} itemData - Updated calendar item payload
 * @returns {Promise<Object>} - Updated calendar item
 */
export const updateDiaryCalendarItem = async (itemId, itemData) => {
  try {
    const response = await axiosInstance.put(`/diary/calendar-items/${itemId}`, itemData);
    return response.data;
  } catch (error) {
    console.error("Error updating diary calendar item:", error);
    throw new Error(
      error.response?.data?.message || "Failed to update diary calendar item"
    );
  }
};

/**
 * Delete a diary calendar note or reminder
 * @param {string} itemId - Calendar item ID
 * @returns {Promise<Object>} - Deletion confirmation
 */
export const deleteDiaryCalendarItem = async (itemId) => {
  try {
    const response = await axiosInstance.delete(`/diary/calendar-items/${itemId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting diary calendar item:", error);
    throw new Error(
      error.response?.data?.message || "Failed to delete diary calendar item"
    );
  }
};

/**
 * Fetch today's diary entries, notes, and reminders
 * @returns {Promise<Object>} - Today's items summary
 */
export const fetchTodaysSummary = async (date = new Date()) => {
  try {
    const response = await axiosInstance.get("/diary/today/summary", {
      params: {
        date: buildLocalDateParam(date),
        timezoneOffsetMinutes: buildTimezoneOffsetParam(date),
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching today's summary:", error);
    throw new Error(
      error.response?.data?.message || "Failed to fetch today's summary"
    );
  }
};

/**
 * Fetch upcoming reminders
 * @param {number} daysAhead - Number of days to look ahead
 * @param {Date|string} startDate - Local day to use as the window start
 * @returns {Promise<Object>} - Upcoming reminders
 */
export const fetchUpcomingReminders = async (
  daysAhead = 7,
  startDate = new Date()
) => {
  try {
    const response = await axiosInstance.get("/diary/upcoming-reminders", {
      params: {
        daysAhead,
        startDate: buildLocalDateParam(startDate),
        timezoneOffsetMinutes: buildTimezoneOffsetParam(startDate),
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching upcoming reminders:", error);
    throw new Error(
      error.response?.data?.message || "Failed to fetch upcoming reminders"
    );
  }
};

/**
 * Mark reminder as notified
 * @param {string} reminderId - Reminder ID
 * @returns {Promise<Object>} - Updated reminder
 */
export const markReminderAsNotified = async (reminderId) => {
  try {
    const response = await axiosInstance.put(
      `/diary/calendar-items/${reminderId}/mark-notified`
    );
    return response.data;
  } catch (error) {
    console.error("Error marking reminder as notified:", error);
    throw new Error(
      error.response?.data?.message || "Failed to mark reminder as notified"
    );
  }
};

export default {
  buildLocalDateParam,
  buildTimezoneOffsetParam,
  fetchDiaryEntries,
  fetchDraftEntries,
  fetchTags,
  fetchMoodStats,
  fetchDiaryEntry,
  createDiaryEntry,
  updateDiaryEntry,
  deleteDiaryEntry,
  fetchEntriesByDate,
  fetchDiaryCalendarItems,
  createDiaryCalendarItem,
  updateDiaryCalendarItem,
  deleteDiaryCalendarItem,
  fetchTodaysSummary,
  fetchUpcomingReminders,
  markReminderAsNotified,
};
