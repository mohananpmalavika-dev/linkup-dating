export const CUSTOM_LINKS_STORAGE_KEY = "malabarbazaar-custom-links";

export const LINK_PRESETS = {
  custom: {
    label: "Custom",
    title: "",
    url: "",
    description: "",
  },
  facebook: {
    label: "Facebook",
    title: "Facebook",
    url: "https://www.facebook.com/",
    description: "Open your Facebook feed, pages, and community updates.",
  },
  gmail: {
    label: "Gmail",
    title: "Gmail",
    url: "https://mail.google.com/",
    description: "Jump into Gmail for inbox, drafts, and important mail.",
  },
};

const ensureProtocol = (value) => {
  const trimmedValue = String(value || "").trim();

  if (!trimmedValue) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmedValue)) {
    return trimmedValue;
  }

  return `https://${trimmedValue}`;
};

export const normalizeCustomLink = (link = {}) => {
  const preset = LINK_PRESETS[link.preset] || LINK_PRESETS.custom;

  return {
    id: String(link.id || `custom-link-${Date.now()}`),
    preset: link.preset || "custom",
    title: String(link.title || preset.title || "").trim(),
    url: ensureProtocol(link.url || preset.url || ""),
    description: String(link.description || preset.description || "").trim(),
  };
};

export const sanitizeCustomLinks = (links) =>
  (Array.isArray(links) ? links : [])
    .map((link) => normalizeCustomLink(link))
    .filter((link) => link.title && link.url);

