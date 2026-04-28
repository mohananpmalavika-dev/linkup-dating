let deferredPrompt = null;
let installPromptAttached = false;

const normalizePublicAssetPath = (assetPath = '') => {
  const normalizedAssetPath = String(assetPath || '').startsWith('/') ? assetPath : `/${assetPath}`;
  const publicUrl = String(process.env.PUBLIC_URL || '').trim().replace(/\/+$/, '');

  return publicUrl ? `${publicUrl}${normalizedAssetPath}` : normalizedAssetPath;
};

export async function register() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(normalizePublicAssetPath('/sw.js'));
    await navigator.serviceWorker.ready;
    return registration;
  } catch (error) {
    console.log("SW registration failed", error);
    return null;
  }
}

export function installAppPrompt() {
  if (typeof window === "undefined" || installPromptAttached) {
    return;
  }

  installPromptAttached = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    document.dispatchEvent(
      new CustomEvent("appinstallavailable", {
        detail: { available: true },
      })
    );
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    document.dispatchEvent(
      new CustomEvent("appinstallavailable", {
        detail: { available: false },
      })
    );
  });
}

export function getInstallPromptAvailability() {
  return Boolean(deferredPrompt);
}

export async function handleInstall() {
  if (!deferredPrompt) {
    return false;
  }

  deferredPrompt.prompt();
  const choiceResult = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return choiceResult?.outcome === "accepted";
}

export function getNotificationPermission() {
  if (typeof Notification === "undefined") {
    return "unsupported";
  }

  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (typeof Notification === "undefined") {
    return "unsupported";
  }

  if (Notification.permission === "granted") {
    return "granted";
  }

  if (Notification.permission === "denied") {
    return "denied";
  }

  return Notification.requestPermission();
}

export async function showServiceWorkerNotification({
  title = "LinkUp",
  body = "",
  tag = "",
  data = {},
  icon = normalizePublicAssetPath('/icon-192.png'),
  badge = normalizePublicAssetPath('/icon-192.png'),
} = {}) {
  const permission = await requestNotificationPermission();
  if (permission !== "granted") {
    return false;
  }

  const options = {
    body,
    tag,
    data,
    icon,
    badge,
  };

  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready;

    const activeWorker =
      navigator.serviceWorker.controller ||
      registration.active ||
      registration.waiting ||
      registration.installing;

    if (activeWorker) {
      activeWorker.postMessage({
        type: "SHOW_NOTIFICATION",
        payload: {
          title,
          options,
        },
      });
      return true;
    }

    if (registration.showNotification) {
      await registration.showNotification(title, options);
      return true;
    }
  }

  if (typeof Notification !== "undefined") {
    new Notification(title, options);
    return true;
  }

  return false;
}

const pwaConfig = {
  register,
  installAppPrompt,
  handleInstall,
  requestNotificationPermission,
  getNotificationPermission,
  showServiceWorkerNotification,
};

export default pwaConfig;
