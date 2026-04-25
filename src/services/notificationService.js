/**
 * Notification Service
 * Handles browser notifications, WebSocket listeners, and reminder alerts
 */

class NotificationService {
  constructor() {
    this.permission = Notification.permission;
    this.socket = null;
    this.activeReminders = new Map();
  }

  /**
   * Initialize notification permissions
   */
  async requestPermission() {
    if (!('Notification' in window)) {
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
    if (this.permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    const {
      title = 'Reminder',
      body = '',
      icon = '/reminder-icon.png',
      badge = '/reminder-badge.png',
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
        vibrate: [200, 100, 200], // Vibration pattern
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
      onNotificationClick = null,
    } = reminder;

    const body = note
      ? `${note.substring(0, 50)}${note.length > 50 ? '...' : ''}`
      : 'You have a reminder';

    const timeStr = new Date(reminderAt).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return this.notify({
      title: `🔔 ${title}`,
      body: `${timeStr} - ${body}`,
      icon: '/reminder-icon.png',
      badge: '/reminder-badge.png',
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
      const audio = new Audio(soundPath);
      audio.volume = 0.5;
      audio.play().catch((e) => {
        console.warn('Could not play notification sound:', e);
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

    // Listen for reminder notifications
    socketInstance.on('diary:reminder-due', (data) => {
      console.log('Received reminder notification:', data);

      // Play sound
      this.playSound();

      // Show browser notification
      this.notifyReminder(data);

      // Emit custom event for React components
      window.dispatchEvent(
        new CustomEvent('reminderNotification', {
          detail: data,
        })
      );
    });

    // Handle connection events
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
    // Clear any existing interval
    if (this.localCheckInterval) {
      clearInterval(this.localCheckInterval);
    }

    this.localCheckInterval = setInterval(() => {
      const now = new Date();

      for (const reminder of reminders) {
        const reminderTime = new Date(reminder.reminderAt);
        const timeDiff = reminderTime - now; // milliseconds

        // Check if reminder is within 1 minute window and hasn't been shown
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
    }, 30000); // Check every 30 seconds
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
    return {
      permission: this.permission,
      canNotify: this.permission === 'granted',
      available: 'Notification' in window,
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

// Create singleton instance
const notificationService = new NotificationService();

export default notificationService;
