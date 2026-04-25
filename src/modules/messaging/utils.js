export const getEntityId = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (value._id) {
    return getEntityId(value._id);
  }

  if (value.id) {
    return getEntityId(value.id);
  }

  return "";
};

export const getEntityEmail = (value) => {
  if (!value || typeof value === "string") {
    return "";
  }

  if (value.email) {
    return String(value.email).trim().toLowerCase();
  }

  return "";
};

export const isSameEntity = (left, right) => {
  const leftId = getEntityId(left);
  const rightId = getEntityId(right);

  if (leftId && rightId && leftId === rightId) {
    return true;
  }

  const leftEmail = getEntityEmail(left);
  const rightEmail = getEntityEmail(right);

  return Boolean(leftEmail && rightEmail && leftEmail === rightEmail);
};

const isUrlLike = (value = "") => /^(https?:\/\/|data:)/i.test(String(value || "").trim());

export const getAvatarLabel = (...values) => {
  for (const value of values) {
    const normalizedValue = String(value || "").trim();

    if (!normalizedValue || isUrlLike(normalizedValue)) {
      continue;
    }

    if (normalizedValue.length <= 2) {
      return normalizedValue.toUpperCase();
    }

    const initials = normalizedValue
      .replace(/[_@.+-]+/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((segment) => segment[0])
      .slice(0, 2)
      .join("");

    if (initials) {
      return initials.toUpperCase();
    }

    const compactValue = normalizedValue.replace(/[^a-zA-Z0-9]/g, "");
    if (compactValue) {
      return compactValue.slice(0, 2).toUpperCase();
    }

    return normalizedValue.slice(0, 2).toUpperCase();
  }

  return "U";
};

const CLEARED_CHATS_STORAGE_KEY = "linkup-cleared-chats";

const toTimestamp = (value) => {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const loadClearedChats = () => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const storedValue = window.localStorage.getItem(CLEARED_CHATS_STORAGE_KEY);
    const parsedValue = storedValue ? JSON.parse(storedValue) : {};
    return parsedValue && typeof parsedValue === "object" ? parsedValue : {};
  } catch (error) {
    return {};
  }
};

export const saveClearedChats = (clearedChats = {}) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(CLEARED_CHATS_STORAGE_KEY, JSON.stringify(clearedChats));
  } catch (error) {
    // Ignore storage failures and keep the chat usable.
  }
};

export const getChatClearTimestamp = (chatId, clearedChats = {}) => {
  const resolvedChatId = getEntityId(chatId);
  if (!resolvedChatId) {
    return 0;
  }

  return toTimestamp(clearedChats[resolvedChatId]);
};

export const isMessageHiddenByClear = (message, clearedAt) => {
  const clearedTimestamp = toTimestamp(clearedAt);
  if (!clearedTimestamp) {
    return false;
  }

  return toTimestamp(message?.createdAt) <= clearedTimestamp;
};

export const filterMessagesByClearTimestamp = (messages = [], clearedAt) =>
  (Array.isArray(messages) ? messages : []).filter(
    (message) => !isMessageHiddenByClear(message, clearedAt)
  );

export const mergePagedMessages = (olderMessages = [], newerMessages = []) => {
  const seenMessageIds = new Set();

  return [...olderMessages, ...newerMessages].filter((message) => {
    const messageKey =
      getEntityId(message) ||
      [
        message?.createdAt || "",
        message?.messageType || "",
        message?.content || "",
        getEntityId(message?.senderId) || "",
      ].join("::");

    if (!messageKey || seenMessageIds.has(messageKey)) {
      return false;
    }

    seenMessageIds.add(messageKey);
    return true;
  });
};

export const inferMessageTypeFromMimeType = (mimeType = "", { preferVoice = false } = {}) => {
  const normalizedMimeType = String(mimeType || "").toLowerCase();

  if (preferVoice && normalizedMimeType.startsWith("audio/")) {
    return "voice";
  }

  if (normalizedMimeType.startsWith("image/")) {
    return "image";
  }

  if (normalizedMimeType.startsWith("video/")) {
    return "video";
  }

  if (normalizedMimeType.startsWith("audio/")) {
    return "audio";
  }

  return "file";
};
