let deferredPrompt = null;
let installPromptAttached = false;

export async function register() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
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
  title = "Malabar Bazaar",
  body = "",
  tag = "",
  data = {},
  icon = "/logo192.png",
  badge = "/favicon.ico",
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

    if (registration.active) {
      registration.active.postMessage({
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

export default {
  register,
  installAppPrompt,
  handleInstall,
  requestNotificationPermission,
  getNotificationPermission,
  showServiceWorkerNotification,
};
