/**
 * NotificationSettingsModal Component
 * Allows users to control notification preferences and opt-in/out
 */

import React, { useState, useEffect } from 'react';
import './NotificationSettingsModal.css';

const NotificationSettingsModal = ({ isOpen, onClose, onSave }) => {
  const [settings, setSettings] = useState({
    notify_new_likes: true,
    notify_new_matches: true,
    notify_messages: true,
    notify_superlike: true,
    notify_milestones: true,
    notify_events: true,
    notify_reminders: false,
    max_notifications_per_day: 5,
    min_hours_between_notifications: 6,
    quiet_hours_enabled: true,
    quiet_hours_start: 22,
    quiet_hours_end: 8,
    include_compatibility_score: true,
    include_photo_preview: true,
    use_smart_timing: true
  });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notifications/preferences', {
        method: 'GET'
      });
      const data = await response.json();
      if (data.success) {
        setSettings(data.preferences);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleNumberChange = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: Math.max(0, parseInt(value, 10) || 0)
    }));
  };

  const handleHourChange = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: Math.max(0, Math.min(23, parseInt(value, 10) || 0))
    }));
  };

  const handleSave = async () => {
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      const data = await response.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        onSave?.(settings);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="notification-settings-overlay" onClick={onClose}>
      <div className="notification-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Notification Settings</h2>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        {loading ? (
          <div className="settings-loading">Loading settings...</div>
        ) : (
          <div className="settings-content">
            {/* Notification Types */}
            <section className="settings-section">
              <h3 className="section-title">📬 Notification Types</h3>
              <p className="section-description">
                Choose which notifications you want to receive
              </p>

              <div className="setting-item">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={settings.notify_new_likes}
                    onChange={() => handleToggle('notify_new_likes')}
                    className="setting-checkbox"
                  />
                  <span className="label-text">❤️ New Likes</span>
                </label>
                <span className="setting-description">Get notified when someone likes you</span>
              </div>

              <div className="setting-item">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={settings.notify_new_matches}
                    onChange={() => handleToggle('notify_new_matches')}
                    className="setting-checkbox"
                  />
                  <span className="label-text">💘 New Matches</span>
                </label>
                <span className="setting-description">Get notified when you have a new match</span>
              </div>

              <div className="setting-item">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={settings.notify_messages}
                    onChange={() => handleToggle('notify_messages')}
                    className="setting-checkbox"
                  />
                  <span className="label-text">💬 New Messages</span>
                </label>
                <span className="setting-description">Get notified of new messages from matches</span>
              </div>

              <div className="setting-item">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={settings.notify_superlike}
                    onChange={() => handleToggle('notify_superlike')}
                    className="setting-checkbox"
                  />
                  <span className="label-text">✨ Superlikes</span>
                </label>
                <span className="setting-description">Get notified when you receive a superlike</span>
              </div>

              <div className="setting-item">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={settings.notify_milestones}
                    onChange={() => handleToggle('notify_milestones')}
                    className="setting-checkbox"
                  />
                  <span className="label-text">🏆 Achievements & Milestones</span>
                </label>
                <span className="setting-description">Get notified of achievements unlocked</span>
              </div>

              <div className="setting-item">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={settings.notify_events}
                    onChange={() => handleToggle('notify_events')}
                    className="setting-checkbox"
                  />
                  <span className="label-text">📅 Dating Events</span>
                </label>
                <span className="setting-description">Get notified about dating events</span>
              </div>

              <div className="setting-item">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={settings.notify_reminders}
                    onChange={() => handleToggle('notify_reminders')}
                    className="setting-checkbox"
                  />
                  <span className="label-text">🔔 Reminders</span>
                </label>
                <span className="setting-description">Get reminders to check the app</span>
              </div>
            </section>

            {/* Frequency & Timing */}
            <section className="settings-section">
              <h3 className="section-title">⏰ Frequency & Timing</h3>

              <div className="setting-item">
                <label className="setting-label">Max Notifications Per Day</label>
                <div className="input-group">
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={settings.max_notifications_per_day}
                    onChange={(e) => handleNumberChange('max_notifications_per_day', e.target.value)}
                    className="setting-input"
                  />
                  <span className="input-hint">notifications/day</span>
                </div>
              </div>

              <div className="setting-item">
                <label className="setting-label">Minimum Hours Between Notifications</label>
                <div className="input-group">
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={settings.min_hours_between_notifications}
                    onChange={(e) =>
                      handleNumberChange('min_hours_between_notifications', e.target.value)
                    }
                    className="setting-input"
                  />
                  <span className="input-hint">hours</span>
                </div>
              </div>
            </section>

            {/* Quiet Hours */}
            <section className="settings-section">
              <h3 className="section-title">🌙 Quiet Hours</h3>
              <p className="section-description">
                Don't send notifications during these hours
              </p>

              <div className="setting-item">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={settings.quiet_hours_enabled}
                    onChange={() => handleToggle('quiet_hours_enabled')}
                    className="setting-checkbox"
                  />
                  <span className="label-text">Enable Quiet Hours</span>
                </label>
              </div>

              {settings.quiet_hours_enabled && (
                <div className="quiet-hours-inputs">
                  <div className="time-input-group">
                    <label>From</label>
                    <select
                      value={settings.quiet_hours_start}
                      onChange={(e) => handleHourChange('quiet_hours_start', e.target.value)}
                      className="time-select"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {String(i).padStart(2, '0')}:00
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="time-input-group">
                    <label>To</label>
                    <select
                      value={settings.quiet_hours_end}
                      onChange={(e) => handleHourChange('quiet_hours_end', e.target.value)}
                      className="time-select"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {String(i).padStart(2, '0')}:00
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </section>

            {/* Personalization */}
            <section className="settings-section">
              <h3 className="section-title">🎯 Personalization</h3>

              <div className="setting-item">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={settings.use_smart_timing}
                    onChange={() => handleToggle('use_smart_timing')}
                    className="setting-checkbox"
                  />
                  <span className="label-text">✨ Smart Timing</span>
                </label>
                <span className="setting-description">
                  Send notifications at times you're most likely to open them
                </span>
              </div>

              <div className="setting-item">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={settings.include_compatibility_score}
                    onChange={() => handleToggle('include_compatibility_score')}
                    className="setting-checkbox"
                  />
                  <span className="label-text">Show Compatibility %</span>
                </label>
                <span className="setting-description">
                  Include compatibility score in notifications
                </span>
              </div>

              <div className="setting-item">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={settings.include_photo_preview}
                    onChange={() => handleToggle('include_photo_preview')}
                    className="setting-checkbox"
                  />
                  <span className="label-text">Show Photo Preview</span>
                </label>
                <span className="setting-description">Include photos in push notifications</span>
              </div>
            </section>

            {/* Save Status */}
            {saved && (
              <div className="settings-saved">
                ✓ Settings saved successfully
              </div>
            )}
          </div>
        )}

        <div className="settings-footer">
          <button className="button-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="button-save" onClick={handleSave} disabled={loading}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettingsModal;
