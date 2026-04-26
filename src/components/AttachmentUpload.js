import React, { useRef, useState } from 'react';
import '../../styles/AttachmentUpload.css';

/**
 * AttachmentUpload Component
 * Handle file attachments in messages
 */
const AttachmentUpload = ({ onAttachmentSelect, maxFileSize = 50, maxFiles = 5 }) => {
  const [attachments, setAttachments] = useState([]);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const MAX_FILE_SIZE_MB = maxFileSize; // 50MB
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

  const ALLOWED_TYPES = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    video: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
    document: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ],
    audio: ['audio/mpeg', 'audio/wav', 'audio/ogg']
  };

  const getAttachmentType = (file) => {
    for (const [type, mimes] of Object.entries(ALLOWED_TYPES)) {
      if (mimes.includes(file.type)) {
        return type;
      }
    }
    return 'other';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleFileSelect = (files) => {
    setError('');

    if (files.length + attachments.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const newAttachments = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Check file size
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError(`${file.name} is too large (max ${MAX_FILE_SIZE_MB}MB)`);
        continue;
      }

      // Check file type
      const isAllowed = Object.values(ALLOWED_TYPES).flat().includes(file.type);
      if (!isAllowed) {
        setError(`${file.name} type not supported`);
        continue;
      }

      newAttachments.push({
        id: `${Date.now()}-${i}`,
        file: file,
        name: file.name,
        size: file.size,
        type: getAttachmentType(file),
        preview: null
      });

      // Generate preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          newAttachments[i].preview = e.target.result;
          setAttachments([...attachments, ...newAttachments]);
          onAttachmentSelect([...attachments, ...newAttachments]);
        };
        reader.readAsDataURL(file);
      }
    }

    if (newAttachments.length > 0 && !newAttachments.some((a) => a.type === 'image')) {
      setAttachments([...attachments, ...newAttachments]);
      onAttachmentSelect([...attachments, ...newAttachments]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    handleFileSelect(files);
  };

  const handleRemoveAttachment = (id) => {
    const updated = attachments.filter((att) => att.id !== id);
    setAttachments(updated);
    onAttachmentSelect(updated);
  };

  const getAttachmentIcon = (type) => {
    switch (type) {
      case 'image':
        return '📷';
      case 'video':
        return '🎬';
      case 'document':
        return '📄';
      case 'audio':
        return '🎵';
      default:
        return '📎';
    }
  };

  return (
    <div className="attachment-upload">
      <div className="upload-area">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="file-input"
          accept={Object.values(ALLOWED_TYPES).flat().join(',')}
        />

        <div className="upload-trigger" onClick={() => fileInputRef.current?.click()}>
          <span className="upload-icon">📎</span>
          <p>Click to upload or drag and drop</p>
          <span className="upload-hint">
            Images, videos, documents • Max {MAX_FILE_SIZE_MB}MB
          </span>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {attachments.length > 0 && (
        <div className="attachments-list">
          <div className="attachments-title">
            Attached ({attachments.length}/{maxFiles})
          </div>
          <div className="attachments-items">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="attachment-item">
                {attachment.preview ? (
                  <img
                    src={attachment.preview}
                    alt={attachment.name}
                    className="attachment-preview"
                  />
                ) : (
                  <div className="attachment-icon">
                    {getAttachmentIcon(attachment.type)}
                  </div>
                )}
                <div className="attachment-info">
                  <p className="attachment-name" title={attachment.name}>
                    {attachment.name}
                  </p>
                  <p className="attachment-size">
                    {formatFileSize(attachment.size)}
                  </p>
                </div>
                <button
                  type="button"
                  className="remove-btn"
                  onClick={() => handleRemoveAttachment(attachment.id)}
                  title="Remove attachment"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttachmentUpload;
