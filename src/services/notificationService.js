/**
 * Notification Service
 * Handles browser notifications, WebSocket listeners, and reminder alerts
 */

class NotificationService {
  constructor() {
    this.permission = typeof Notification !== 'undefined' ? Notification.permission : 'default';
    this.socket = null;
    this.activeReminders = new Map();
    this.localCheckInterval = null;
  }

  resolveAssetPath(assetPath = '') {
    const normalizedAssetPath = String(assetPath || '').startsWith('/') ? assetPath : `/${assetPath}`;
    const publicUrl = String(process.env.PUBLIC_URL || '').trim().replace(/\/+$/, '');

    return publicUrl ? `${publicUrl}${normalizedAssetPath}` : normalizedAssetPath;
  }

  /**
   * Initialize notification permissions
   */
  async requestPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.log('Browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      this.permission = 'granted';
      return true;
    }

    if (Notification.permission !== 'denied') {
      const result = await Notification.requestPermission();
      this.permission = result;
      return result === 'granted';
    }

    return false;
  }

  /**
   * Show browser notification
   */
  notify(options = {}) {
    const livePermission = typeof Notification !== 'undefined' ? Notification.permission : this.permission;
    this.permission = livePermission;

    if (livePermission !== 'granted') {
      console.warn('Notification permission not granted');
      return null;
    }

    const {
      title = 'LinkUp',
      body = '',
      icon = this.resolveAssetPath('/icon-192.png'),
      badge = this.resolveAssetPath('/icon-192.png'),
      tag = 'reminder',
      requireInteraction = true,
      onClose = null,
      onShow = null,
      onError = null,
    } = options;

    try {
      const notification = new Notification(title, {
        body,
        icon,
        badge,
        tag,
        requireInteraction,
        timestamp: Date.now(),
        vibrate: [200, 100, 200],
      });

      if (onShow) notification.onshow = onShow;
      if (onClose) notification.onclose = onClose;
      if (onError) notification.onerror = onError;

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    } catch (error) {
      console.error('Error showing notification:', error);
      if (onError) onError(error);
      return null;
    }
  }

  /**
   * Show reminder notification
   */
  notifyReminder(reminder = {}) {
    const {
      reminderId,
      title,
      note,
      reminderAt,
    } = reminder;

    const body = note
      ? `${note.substring(0, 50)}${note.length > 50 ? '...' : ''}`
      : 'You have a reminder';

    const timeStr = new Date(reminderAt).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return this.notify({
      title: `Reminder: ${title}`,
      body: `${timeStr} - ${body}`,
      icon: this.resolveAssetPath('/icon-192.png'),
      badge: this.resolveAssetPath('/icon-192.png'),
      tag: `reminder-${reminderId}`,
      requireInteraction: true,
      onShow: () => {
        console.log(`Reminder notification shown: ${title}`);
        this.activeReminders.set(reminderId, {
          title,
          notifiedAt: new Date(),
        });
      },
      onClose: () => {
        this.activeReminders.delete(reminderId);
      },
    });
  }

  /**
   * Play notification sound
   */
  playSound(soundPath = '/notification-sound.mp3') {
    try {
      const audio = new Audio(this.resolveAssetPath(soundPath));
      audio.volume = 0.5;
      audio.play().catch((error) => {
        console.warn('Could not play notification sound:', error);
      });
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }

  /**
   * Set up WebSocket listeners for reminders
   */
  setupWebSocketListeners(socketInstance) {
    if (!socketInstance) {
      console.warn('Socket instance not provided');
      return;
    }

    this.socket = socketInstance;

    socketInstance.on('diary:reminder-due', (data) => {
      console.log('Received reminder notification:', data);

      this.playSound();
      this.notifyReminder(data);

      window.dispatchEvent(
        new CustomEvent('reminderNotification', {
          detail: data,
        })
      );
    });

    socketInstance.on('connect', () => {
      console.log('Connected to reminder notification service');
    });

    socketInstance.on('disconnect', () => {
      console.warn('Disconnected from reminder notification service');
    });

    socketInstance.on('error', (error) => {
      console.error('Reminder notification service error:', error);
    });
  }

  /**
   * Check for reminders periodically
   */
  startLocalReminderCheck(reminders = [], onReminderDue = null) {
    if (this.localCheckInterval) {
      clearInterval(this.localCheckInterval);
    }

    this.localCheckInterval = setInterval(() => {
      const now = new Date();

      for (const reminder of reminders) {
        const reminderTime = new Date(reminder.reminderAt);
        const timeDiff = reminderTime - now;

        if (
          timeDiff <= 60000 &&
          timeDiff > 0 &&
          !this.activeReminders.has(reminder._id)
        ) {
          console.log(`Local reminder due: ${reminder.title}`);
          this.notifyReminder(reminder);

          if (onReminderDue) {
            onReminderDue(reminder);
          }
        }
      }
    }, 30000);
  }

  /**
   * Stop local reminder check
   */
  stopLocalReminderCheck() {
    if (this.localCheckInterval) {
      clearInterval(this.localCheckInterval);
      this.localCheckInterval = null;
    }
  }

  /**
   * Get notification permission status
   */
  getPermissionStatus() {
    const livePermission = typeof Notification !== 'undefined' ? Notification.permission : this.permission;
    this.permission = livePermission;

    return {
      permission: livePermission,
      canNotify: livePermission === 'granted',
      available: typeof window !== 'undefined' && 'Notification' in window,
    };
  }

  /**
   * Clear all active reminders from display
   */
  clearActiveReminders() {
    this.activeReminders.clear();
  }

  /**
   * Cleanup on unload
   */
  destroy() {
    this.stopLocalReminderCheck();
    if (this.socket) {
      this.socket.off('diary:reminder-due');
      this.socket.off('connect');
      this.socket.off('disconnect');
      this.socket.off('error');
    }
  }
}

const notificationService = new NotificationService();

export default notificationService;
