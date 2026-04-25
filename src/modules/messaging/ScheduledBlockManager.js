import React, { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { getEntityId } from './utils';

const ScheduledBlockManager = ({ contact, onClose, onBlockAdded }) => {
  const { apiCall } = useApp();
  const [blockType, setBlockType] = useState('time'); // 'time' or 'period'
  const [startTime, setStartTime] = useState('22:00');
  const [endTime, setEndTime] = useState('06:00');
  const [selectedDays, setSelectedDays] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [blockStartDate, setBlockStartDate] = useState('');
  const [blockEndDate, setBlockEndDate] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [reason, setReason] = useState('');
  const [scheduledBlocks, setScheduledBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const contactId = getEntityId(contact.contactUserId || contact);

  useEffect(() => {
    loadScheduledBlocks();
  }, []);

  const loadScheduledBlocks = async () => {
    try {
      setLoading(true);
      const response = await apiCall(
        `/messaging/contacts/${contactId}/scheduled-blocks`,
        'GET'
      );
      if (response?.scheduledBlocks) {
        setScheduledBlocks(response.scheduledBlocks);
      }
    } catch (error) {
      console.error('Error loading scheduled blocks:', error);
      setError('Failed to load scheduled blocks');
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (day) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleAddBlock = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (blockType === 'time') {
      if (!startTime || !endTime) {
        setError('Please select start and end times');
        return;
      }
    } else {
      if (!blockStartDate || !blockEndDate) {
        setError('Please select block start and end dates');
        return;
      }
      if (new Date(blockStartDate) > new Date(blockEndDate)) {
        setError('Start date must be before end date');
        return;
      }
    }

    try {
      setLoading(true);
      const payload = {
        type: blockType,
        reason: reason || null,
        validUntil: validUntil || null,
      };

      if (blockType === 'time') {
        payload.startTime = startTime;
        payload.endTime = endTime;
        payload.daysOfWeek = selectedDays;
      } else {
        payload.blockStartDate = blockStartDate;
        payload.blockEndDate = blockEndDate;
      }

      const response = await apiCall(
        `/messaging/contacts/${contactId}/scheduled-block`,
        'POST',
        payload
      );

      if (response?.contact) {
        setSuccess('Block added successfully!');
        setScheduledBlocks(response.contact.scheduledBlocks || []);
        // Reset form
        setBlockType('time');
        setStartTime('22:00');
        setEndTime('06:00');
        setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
        setBlockStartDate('');
        setBlockEndDate('');
        setValidUntil('');
        setReason('');
        if (onBlockAdded) onBlockAdded();
      }
    } catch (error) {
      console.error('Error adding block:', error);
      setError(error?.message || 'Failed to add block');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBlock = async (blockId) => {
    try {
      const block = scheduledBlocks.find((b) => b._id === blockId);
      const response = await apiCall(
        `/messaging/contacts/${contactId}/scheduled-block/${blockId}`,
        'PUT',
        { isActive: !block.isActive }
      );

      if (response?.contact) {
        setScheduledBlocks(response.contact.scheduledBlocks || []);
      }
    } catch (error) {
      console.error('Error toggling block:', error);
      setError('Failed to update block');
    }
  };

  const handleDeleteBlock = async (blockId) => {
    if (!window.confirm('Are you sure you want to delete this block?')) return;

    try {
      const response = await apiCall(
        `/messaging/contacts/${contactId}/scheduled-block/${blockId}`,
        'DELETE'
      );

      if (response?.contact) {
        setScheduledBlocks(response.contact.scheduledBlocks || []);
        setSuccess('Block deleted successfully!');
      }
    } catch (error) {
      console.error('Error deleting block:', error);
      setError('Failed to delete block');
    }
  };

  const formatBlockDescription = (block) => {
    if (block.type === 'time') {
      const daysList = (block.daysOfWeek || []).map((d) => days[d]).join(', ');
      return `${block.startTime} - ${block.endTime} on ${daysList}`;
    } else {
      const start = new Date(block.blockStartDate).toLocaleDateString();
      const end = new Date(block.blockEndDate).toLocaleDateString();
      return `${start} to ${end}`;
    }
  };

  return (
    <div className="scheduled-block-manager">
      <div className="block-manager-header">
        <h3>Schedule Block for {contact.displayName || contact.contactUserId?.name}</h3>
        <button className="btn-close" onClick={onClose} type="button">
          ✕
        </button>
      </div>

      <div className="block-manager-content">
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {/* Add New Block Section */}
        <div className="add-block-section">
          <h4>Add New Block</h4>

          <div className="block-type-selection">
            <button
              className={`type-btn ${blockType === 'time' ? 'active' : ''}`}
              onClick={() => setBlockType('time')}
              type="button"
            >
              ⏰ Time-based
            </button>
            <button
              className={`type-btn ${blockType === 'period' ? 'active' : ''}`}
              onClick={() => setBlockType('period')}
              type="button"
            >
              📅 Period-based
            </button>
          </div>

          <form onSubmit={handleAddBlock} className="add-block-form">
            {blockType === 'time' ? (
              <>
                <div className="form-group">
                  <label>Block Times</label>
                  <div className="time-inputs">
                    <div className="time-input-group">
                      <label htmlFor="startTime">From:</label>
                      <input
                        id="startTime"
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                    <div className="time-input-group">
                      <label htmlFor="endTime">To:</label>
                      <input
                        id="endTime"
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label>Repeat on Days</label>
                  <div className="days-selector">
                    {days.map((day, index) => (
                      <button
                        key={index}
                        className={`day-btn ${selectedDays.includes(index) ? 'active' : ''}`}
                        onClick={() => toggleDay(index)}
                        type="button"
                        disabled={loading}
                        title={day}
                      >
                        {day.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label htmlFor="blockStartDate">Block Start Date</label>
                  <input
                    id="blockStartDate"
                    type="date"
                    value={blockStartDate}
                    onChange={(e) => setBlockStartDate(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="blockEndDate">Block End Date</label>
                  <input
                    id="blockEndDate"
                    type="date"
                    value={blockEndDate}
                    onChange={(e) => setBlockEndDate(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label htmlFor="validUntil">Auto-unblock Date (Optional)</label>
              <input
                id="validUntil"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                disabled={loading}
                title="Block will auto-expire on this date"
              />
            </div>

            <div className="form-group">
              <label htmlFor="reason">Reason (Optional)</label>
              <input
                id="reason"
                type="text"
                placeholder="e.g., Sleep time, Work hours"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={loading}
                maxLength="50"
              />
            </div>

            <button className="btn-add-block" type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Block'}
            </button>
          </form>
        </div>

        {/* Active Blocks Section */}
        <div className="active-blocks-section">
          <h4>Active Blocks</h4>
          {scheduledBlocks.length === 0 ? (
            <p className="no-blocks">No scheduled blocks yet.</p>
          ) : (
            <div className="blocks-list">
              {scheduledBlocks.map((block) => (
                <div key={block._id} className={`block-item ${!block.isActive ? 'inactive' : ''}`}>
                  <div className="block-info">
                    <div className="block-type-badge">{block.type === 'time' ? '⏰' : '📅'}</div>
                    <div className="block-details">
                      <p className="block-description">{formatBlockDescription(block)}</p>
                      {block.reason && <p className="block-reason">Reason: {block.reason}</p>}
                      {block.validUntil && (
                        <p className="block-expiry">
                          Auto-unblock: {new Date(block.validUntil).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="block-actions">
                    <button
                      className={`btn-toggle ${block.isActive ? 'enabled' : 'disabled'}`}
                      onClick={() => handleToggleBlock(block._id)}
                      type="button"
                      disabled={loading}
                      title={block.isActive ? 'Disable block' : 'Enable block'}
                    >
                      {block.isActive ? '✓' : '○'}
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => handleDeleteBlock(block._id)}
                      type="button"
                      disabled={loading}
                      title="Delete block"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduledBlockManager;
