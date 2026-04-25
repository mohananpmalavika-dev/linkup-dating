import axios from "axios";
import { normalizeReminderRecord, toDateInputValue } from "../modules/reminderalert/reminderUtils";
import { API_BASE_URL } from "../utils/api";

// Configure axios to send cookies with requests
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

const normalizeReminderResponse = (responseData) => {
  if (Array.isArray(responseData?.data)) {
    return {
      ...responseData,
      data: responseData.data.map((reminder) => normalizeReminderRecord(reminder)),
    };
  }

  if (responseData?.data && typeof responseData.data === "object") {
    return {
      ...responseData,
      data: normalizeReminderRecord(responseData.data),
    };
  }

  return responseData;
};

/**
 * Fetch all reminders for the current user
 * @param {Object} options - Query options
 * @param {string} options.category - Filter by category (Work, Personal, Urgent, All)
 * @param {boolean} options.completed - Filter by completion status
 * @param {number} options.limit - Limit results
 * @param {number} options.skip - Skip results for pagination
 * @returns {Promise<Object>} - Response with reminders and pagination info
 */
export const fetchReminders = async (options = {}) => {
  try {
    const params = {};
    if (options.category && options.category !== "All") {
      params.category = options.category;
    }
    if (options.completed !== undefined) {
      params.completed = options.completed;
    }
    if (options.limit) {
      params.limit = options.limit;
    }
    if (options.skip) {
      params.skip = options.skip;
    }

    const response = await axiosInstance.get("/reminders", { params });
    return normalizeReminderResponse(response.data);
  } catch (error) {
    console.error("Error fetching reminders:", error);
    throw new Error(
      error.response?.data?.message || "Failed to fetch reminders"
    );
  }
};

/**
 * Create a new reminder
 * @param {Object} reminderData - Reminder data
 * @returns {Promise<Object>} - Created reminder with ID
 */
export const createReminder = async (reminderData) => {
  try {
    const payload = {
      ...reminderData,
      dueDate: toDateInputValue(reminderData.dueDate),
    };
    const response = await axiosInstance.post("/reminders", payload);
    return normalizeReminderResponse(response.data);
  } catch (error) {
    console.error("Error creating reminder:", error);
    throw new Error(
      error.response?.data?.message || "Failed to create reminder"
    );
  }
};

/**
 * Update an existing reminder
 * @param {string} reminderId - ID of reminder to update
 * @param {Object} reminderData - Updated reminder data
 * @returns {Promise<Object>} - Updated reminder
 */
export const updateReminder = async (reminderId, reminderData) => {
  try {
    const payload = {
      ...reminderData,
    };
    // Convert dueDate if provided
    if (reminderData.dueDate) {
      payload.dueDate = toDateInputValue(reminderData.dueDate);
    }
    const response = await axiosInstance.put(
      `/reminders/${reminderId}`,
      payload
    );
    return normalizeReminderResponse(response.data);
  } catch (error) {
    console.error("Error updating reminder:", error);
    throw new Error(
      error.response?.data?.message || "Failed to update reminder"
    );
  }
};

/**
 * Delete a reminder
 * @param {string} reminderId - ID of reminder to delete
 * @returns {Promise<Object>} - Deletion confirmation
 */
export const deleteReminder = async (reminderId) => {
  try {
    const response = await axiosInstance.delete(`/reminders/${reminderId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting reminder:", error);
    throw new Error(
      error.response?.data?.message || "Failed to delete reminder"
    );
  }
};

/**
 * Toggle reminder completion status
 * @param {string} reminderId - ID of reminder
 * @param {boolean} completed - New completion status
 * @returns {Promise<Object>} - Updated reminder
 */
export const toggleReminderCompletion = async (reminderId, completed) => {
  try {
    const response = await axiosInstance.put(`/reminders/${reminderId}`, {
      completed,
    });
    return normalizeReminderResponse(response.data);
  } catch (error) {
    console.error("Error toggling reminder completion:", error);
    throw new Error(
      error.response?.data?.message ||
        "Failed to update reminder completion status"
    );
  }
};

/**
 * Create a reminder with voice call
 * @param {Object} reminderData - Reminder data including voice call fields
 * @returns {Promise<Object>} - Created voice call reminder
 */
export const createVoiceCallReminder = async (reminderData) => {
  try {
    const payload = {
      ...reminderData,
      dueDate: toDateInputValue(reminderData.dueDate),
      reminders: ['Call']  // Voice call reminders use 'Call' type
    };
    const response = await axiosInstance.post("/reminders/voice-call", payload);
    return normalizeReminderResponse(response.data);
  } catch (error) {
    console.error("Error creating voice call reminder:", error);
    throw new Error(
      error.response?.data?.message || "Failed to create voice call reminder"
    );
  }
};

/**
 * Get voice call status for a reminder
 * @param {string} reminderId - ID of the reminder
 * @returns {Promise<Object>} - Voice call status details
 */
export const getVoiceCallStatus = async (reminderId) => {
  try {
    const response = await axiosInstance.get(
      `/reminders/${reminderId}/voice-call-status`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching voice call status:", error);
    throw new Error(
      error.response?.data?.message || "Failed to fetch voice call status"
    );
  }
};

/**
 * Manually trigger a voice call for a reminder
 * @param {string} reminderId - ID of the reminder
 * @returns {Promise<Object>} - Call trigger result
 */
export const triggerVoiceCall = async (reminderId) => {
  try {
    const response = await axiosInstance.post(
      `/reminders/${reminderId}/trigger-call`
    );
    return response.data;
  } catch (error) {
    console.error("Error triggering voice call:", error);
    throw new Error(
      error.response?.data?.message || "Failed to trigger voice call"
    );
  }
};

// ============ TRUSTED CONTACTS API FUNCTIONS ============

/**
 * Send invite to become a trusted contact
 * @param {string} recipientId - ID of the user to invite
 * @param {string} message - Optional invite message
 * @param {string} relationship - Relationship type
 * @returns {Promise<Object>} - Created invite
 */
export const sendTrustedContactInvite = async (recipientId, message = "", relationship = "other") => {
  try {
    const response = await axiosInstance.post("/reminders/trusted-contacts/invite", {
      recipientId,
      message,
      relationship,
    });
    return response.data;
  } catch (error) {
    console.error("Error sending trusted contact invite:", error);
    throw new Error(
      error.response?.data?.message || "Failed to send invite"
    );
  }
};

/**
 * Get sent invites
 * @returns {Promise<Object>} - List of sent invites
 */
export const getSentTrustedContactInvites = async () => {
  try {
    const response = await axiosInstance.get("/reminders/trusted-contacts/sent");
    return response.data;
  } catch (error) {
    console.error("Error fetching sent invites:", error);
    throw new Error(
      error.response?.data?.message || "Failed to fetch invites"
    );
  }
};

/**
 * Get received invites
 * @returns {Promise<Object>} - List of received invites
 */
export const getReceivedTrustedContactInvites = async () => {
  try {
    const response = await axiosInstance.get("/reminders/trusted-contacts/received");
    return response.data;
  } catch (error) {
    console.error("Error fetching received invites:", error);
    throw new Error(
      error.response?.data?.message || "Failed to fetch invites"
    );
  }
};

/**
 * Get list of accepted trusted contacts
 * @returns {Promise<Object>} - List of accepted trusted contacts
 */
export const getAcceptedTrustedContacts = async () => {
  try {
    const response = await axiosInstance.get("/reminders/trusted-contacts/accepted");
    return response.data;
  } catch (error) {
    console.error("Error fetching trusted contacts:", error);
    throw new Error(
      error.response?.data?.message || "Failed to fetch trusted contacts"
    );
  }
};

/**
 * Accept a trusted contact invite
 * @param {string} inviteId - ID of the invite
 * @returns {Promise<Object>} - Updated invite
 */
export const acceptTrustedContactInvite = async (inviteId) => {
  try {
    const response = await axiosInstance.post(
      `/reminders/trusted-contacts/${inviteId}/accept`
    );
    return response.data;
  } catch (error) {
    console.error("Error accepting invite:", error);
    throw new Error(
      error.response?.data?.message || "Failed to accept invite"
    );
  }
};

/**
 * Reject a trusted contact invite
 * @param {string} inviteId - ID of the invite
 * @returns {Promise<Object>} - Updated invite
 */
export const rejectTrustedContactInvite = async (inviteId) => {
  try {
    const response = await axiosInstance.post(
      `/reminders/trusted-contacts/${inviteId}/reject`
    );
    return response.data;
  } catch (error) {
    console.error("Error rejecting invite:", error);
    throw new Error(
      error.response?.data?.message || "Failed to reject invite"
    );
  }
};

/**
 * Remove a trusted contact
 * @param {string} contactId - ID of the contact to remove
 * @returns {Promise<Object>} - Success response
 */
export const removeTrustedContact = async (contactId) => {
  try {
    const response = await axiosInstance.delete(
      `/reminders/trusted-contacts/${contactId}`
    );
    return response.data;
  } catch (error) {
    console.error("Error removing trusted contact:", error);
    throw new Error(
      error.response?.data?.message || "Failed to remove trusted contact"
    );
  }
};

/**
 * Share a reminder with trusted contacts
 * @param {string} reminderId - ID of the reminder
 * @param {Array} contactIds - Array of contact IDs to share with
 * @returns {Promise<Object>} - Updated reminder
 */
export const shareReminderWithContacts = async (reminderId, contactIds = []) => {
  try {
    const response = await axiosInstance.put(
      `/reminders/${reminderId}/share-with-contacts`,
      { contactIds }
    );
    return normalizeReminderResponse(response.data);
  } catch (error) {
    console.error("Error sharing reminder:", error);
    throw new Error(
      error.response?.data?.message || "Failed to share reminder"
    );
  }
};

/**
 * Get reminders shared with me as a trusted contact
 * @returns {Promise<Object>} - List of shared reminders
 */
export const getRemindersSharedWithMe = async () => {
  try {
    const response = await axiosInstance.get("/reminders/shared-with-me/list");
    return normalizeReminderResponse(response.data);
  } catch (error) {
    console.error("Error fetching shared reminders:", error);
    throw new Error(
      error.response?.data?.message || "Failed to fetch shared reminders"
    );
  }
};

// ============ FILE ATTACHMENT FUNCTIONS ============

/**
 * Upload a file attachment to a reminder
 * @param {string} reminderId - ID of the reminder
 * @param {File} file - The file to upload
 * @param {string} description - Optional description
 * @param {number} duration - Optional duration for audio/video files
 * @returns {Promise<Object>} - Upload response with attachment data
 */
export const uploadReminderAttachment = async (
  reminderId,
  file,
  description = "",
  duration = null
) => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    if (description) {
      formData.append("description", description);
    }
    if (duration) {
      formData.append("duration", duration);
    }

    const response = await axiosInstance.post(
      `/reminders/${reminderId}/attachments`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error uploading attachment:", error);
    throw new Error(
      error.response?.data?.message || "Failed to upload attachment"
    );
  }
};

/**
 * Get all attachments for a reminder
 * @param {string} reminderId - ID of the reminder
 * @returns {Promise<Object>} - List of attachments
 */
export const getRemindersAttachments = async (reminderId) => {
  try {
    const response = await axiosInstance.get(
      `/reminders/${reminderId}/attachments`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching attachments:", error);
    throw new Error(
      error.response?.data?.message || "Failed to fetch attachments"
    );
  }
};

/**
 * Get attachments by type for a reminder
 * @param {string} reminderId - ID of the reminder
 * @param {string} fileType - File type to filter by (voice, image, document, video, audio)
 * @returns {Promise<Object>} - List of filtered attachments
 */
export const getAttachmentsByType = async (reminderId, fileType) => {
  try {
    const response = await axiosInstance.get(
      `/reminders/${reminderId}/attachments/type/${fileType}`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching attachments by type:", error);
    throw new Error(
      error.response?.data?.message || "Failed to fetch attachments"
    );
  }
};

/**
 * Delete an attachment from a reminder
 * @param {string} reminderId - ID of the reminder
 * @param {string} attachmentId - ID of the attachment to delete
 * @returns {Promise<Object>} - Success response
 */
export const deleteRemindersAttachment = async (reminderId, attachmentId) => {
  try {
    const response = await axiosInstance.delete(
      `/reminders/${reminderId}/attachments/${attachmentId}`
    );
    return response.data;
  } catch (error) {
    console.error("Error deleting attachment:", error);
    throw new Error(
      error.response?.data?.message || "Failed to delete attachment"
    );
  }
};

const remindersService = {
  fetchReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  toggleReminderCompletion,
  createVoiceCallReminder,
  getVoiceCallStatus,
  triggerVoiceCall,
  sendTrustedContactInvite,
  getSentTrustedContactInvites,
  getReceivedTrustedContactInvites,
  getAcceptedTrustedContacts,
  acceptTrustedContactInvite,
  rejectTrustedContactInvite,
  removeTrustedContact,
  shareReminderWithContacts,
  getRemindersSharedWithMe,
  uploadReminderAttachment,
  getRemindersAttachments,
  getAttachmentsByType,
  deleteRemindersAttachment,
};

export default remindersService;
