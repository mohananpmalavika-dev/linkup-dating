import React, { useRef, useState } from 'react';
import '../styles/AttachmentUpload.css';

/**
 * AttachmentUpload Component
 * Handle file attachments in messages
 */
const AttachmentUpload = ({ onAttachmentSelect, maxFileSize = 50, maxFiles = 5 }) => {
  const [attachments, setAttachments] = useState([]);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const MAX_FILE_SIZE_BYTES = maxFileSize * 1024 * 1024;

  const ALLOWED_TYPES = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    video: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'],
    document: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ],
    audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm']
  };

  const readPreview = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result || null);
    reader.onerror = () => reject(new Error('Preview generation failed'));
    reader.readAsDataURL(file);
  });

  const getAttachmentType = (file) => {
    for (const [type, mimeTypes] of Object.entries(ALLOWED_TYPES)) {
      if (mimeTypes.includes(file.type)) {
        return type;
      }
    }

    return 'other';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) {
      return '0 Bytes';
    }

    const units = ['Bytes', 'KB', 'MB'];
    const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round((bytes / (1024 ** unitIndex)) * 100) / 100} ${units[unitIndex]}`;
  };

  const handleFileSelect = async (files) => {
    setError('');

    const selectedFiles = Array.from(files || []);

    if (selectedFiles.length + attachments.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const nextAttachments = [];

    for (let index = 0; index < selectedFiles.length; index += 1) {
      const file = selectedFiles[index];

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError(`${file.name} is too large (max ${maxFileSize}MB)`);
        continue;
      }

      const isAllowed = Object.values(ALLOWED_TYPES).flat().includes(file.type);
      if (!isAllowed) {
        setError(`${file.name} type not supported`);
        continue;
      }

      nextAttachments.push({
        id: `${Date.now()}-${index}`,
        file,
        name: file.name,
        size: file.size,
        type: getAttachmentType(file),
        preview: null
      });
    }

    if (nextAttachments.length === 0) {
      return;
    }

    const preparedAttachments = await Promise.all(
      nextAttachments.map(async (attachment) => ({
        ...attachment,
        preview: attachment.type === 'image' ? await readPreview(attachment.file) : null
      }))
    );

    const updatedAttachments = [...attachments, ...preparedAttachments];
    setAttachments(updatedAttachments);
    onAttachmentSelect(updatedAttachments);
  };

  const handleRemoveAttachment = (attachmentId) => {
    const updatedAttachments = attachments.filter((attachment) => attachment.id !== attachmentId);
    setAttachments(updatedAttachments);
    onAttachmentSelect(updatedAttachments);
  };

  const getAttachmentIcon = (type) => {
    switch (type) {
      case 'image':
        return 'IMG';
      case 'video':
        return 'VID';
      case 'document':
        return 'DOC';
      case 'audio':
        return 'AUD';
      default:
        return 'FILE';
    }
  };

  return (
    <div className="attachment-upload">
      <div className="upload-area">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(event) => handleFileSelect(event.target.files)}
          className="file-input"
          accept={Object.values(ALLOWED_TYPES).flat().join(',')}
        />

        <div className="upload-trigger" onClick={() => fileInputRef.current?.click()}>
          <span className="upload-icon">+</span>
          <p>Click to upload files</p>
          <span className="upload-hint">
            Images, video, audio, documents. Max {maxFileSize}MB each.
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
                  x
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
