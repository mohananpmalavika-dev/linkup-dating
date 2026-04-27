import React, { useCallback, useEffect, useState } from 'react';
import messagingEnhancedService from '../services/messagingEnhancedService';
import '../styles/MessageTemplates.css';

/**
 * MessageTemplates Component
 * Display and manage quick reply templates
 */
const MessageTemplates = ({ onSelectTemplate, onClose }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'general',
    emoji: 'Hi'
  });
  const [filter, setFilter] = useState('all');

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await messagingEnhancedService.getTemplates({
        category: filter === 'all' ? null : filter,
        pinned: filter === 'pinned' ? 'true' : null
      });
      setTemplates(data);
    } catch (loadError) {
      setError(loadError || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleCreateTemplate = async (event) => {
    event.preventDefault();

    if (!formData.title.trim() || !formData.content.trim()) {
      setError('Title and content are required');
      return;
    }

    try {
      setError('');
      await messagingEnhancedService.createTemplate(formData);
      setFormData({ title: '', content: '', category: 'general', emoji: 'Hi' });
      setShowForm(false);
      await loadTemplates();
    } catch (createError) {
      setError(createError || 'Failed to create template');
    }
  };

  const handleSelectTemplate = async (template) => {
    try {
      await messagingEnhancedService.useTemplate(template.id);
    } catch (usageError) {
      console.error('Error using template:', usageError);
    } finally {
      onSelectTemplate(template.content);
      onClose();
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('Delete this template?')) {
      return;
    }

    try {
      await messagingEnhancedService.deleteTemplate(templateId);
      await loadTemplates();
    } catch (deleteError) {
      setError(deleteError || 'Failed to delete template');
    }
  };

  if (loading) {
    return (
      <div className="message-templates loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="message-templates">
      <div className="templates-header">
        <h3>Quick Reply Templates</h3>
        <button type="button" className="close-btn" onClick={onClose}>x</button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="templates-controls">
        <div className="filter-buttons">
          <button
            type="button"
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            type="button"
            className={`filter-btn ${filter === 'pinned' ? 'active' : ''}`}
            onClick={() => setFilter('pinned')}
          >
            Pinned
          </button>
        </div>
        <button
          type="button"
          className="new-template-btn"
          onClick={() => setShowForm((currentState) => !currentState)}
        >
          {showForm ? 'Cancel' : '+ New'}
        </button>
      </div>

      {showForm && (
        <form className="template-form" onSubmit={handleCreateTemplate}>
          <input
            type="text"
            placeholder="Template title"
            value={formData.title}
            onChange={(event) => setFormData({ ...formData, title: event.target.value })}
            className="form-input"
          />
          <textarea
            placeholder="Template content"
            value={formData.content}
            onChange={(event) => setFormData({ ...formData, content: event.target.value })}
            className="form-textarea"
            rows="3"
          />
          <div className="form-row">
            <select
              value={formData.category}
              onChange={(event) => setFormData({ ...formData, category: event.target.value })}
              className="form-select"
            >
              <option value="general">General</option>
              <option value="greeting">Greeting</option>
              <option value="question">Question</option>
              <option value="flirtation">Flirtation</option>
              <option value="location">Location</option>
            </select>
            <input
              type="text"
              placeholder="Label"
              maxLength="4"
              value={formData.emoji}
              onChange={(event) => setFormData({ ...formData, emoji: event.target.value })}
              className="form-input emoji-input"
            />
          </div>
          <button type="submit" className="submit-btn">
            Save Template
          </button>
        </form>
      )}

      <div className="templates-list">
        {templates.length > 0 ? (
          templates.map((template) => (
            <div key={template.id} className="template-card">
              <div className="template-header">
                <div className="template-title">
                  <span className="emoji">{template.emoji || 'Msg'}</span>
                  <h4>{template.title}</h4>
                </div>
                <div className="template-meta">
                  <span className="category">{template.category}</span>
                  <span className="usage">Used {template.usage_count || 0}x</span>
                </div>
              </div>
              <p className="template-content">{template.content}</p>
              <div className="template-actions">
                <button
                  type="button"
                  className="use-btn"
                  onClick={() => handleSelectTemplate(template)}
                >
                  Use
                </button>
                <button
                  type="button"
                  className="delete-btn"
                  onClick={() => handleDeleteTemplate(template.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <p>No templates yet. Create one to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageTemplates;
