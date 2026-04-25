import React, { useState, useRef } from 'react';
import { useApp } from '../../contexts/AppContext';
import './FileUpload.css';

const FileUpload = ({ chatId, onFileUploaded, onClose }) => {
  const { apiCall } = useApp();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const allowedTypes = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    video: ['video/mp4', 'video/webm', 'video/ogg'],
    audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm', 'audio/x-m4a'],
    document: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ],
  };

  const maxFileSize = 100 * 1024 * 1024;

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter((file) => {
      if (file.size > maxFileSize) {
        setError(`File "${file.name}" is too large. Maximum size is 100MB.`);
        return false;
      }

      const isAllowed = Object.values(allowedTypes).flat().includes(file.type);
      if (!isAllowed) {
        setError(`File type "${file.type}" is not supported.`);
        return false;
      }

      return true;
    });

    if (validFiles.length > 0) {
      setSelectedFiles(validFiles);
      setError('');
    }
  };

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = String(reader.result || '').split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
    });

  const uploadFile = async (file) => {
    const base64Data = await fileToBase64(file);
    const response = await apiCall('/messaging/files/upload', 'POST', {
      chatId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      fileData: base64Data,
    });

    return response.file;
  };

  const handleUpload = async () => {
    if (!chatId || selectedFiles.length === 0) {
      return;
    }

    setUploading(true);
    setError('');

    const initialProgress = {};
    selectedFiles.forEach((file) => {
      initialProgress[file.name] = 0;
    });
    setUploadProgress(initialProgress);

    try {
      const uploadedFiles = [];

      for (const file of selectedFiles) {
        const uploadedFile = await uploadFile(file);
        uploadedFiles.push(uploadedFile);
        setUploadProgress((currentProgress) => ({
          ...currentProgress,
          [file.name]: 100,
        }));
      }

      if (onFileUploaded) {
        onFileUploaded(uploadedFiles);
      }

      setSelectedFiles([]);
      setUploadProgress({});
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      if (onClose) {
        onClose();
      }
    } catch (uploadError) {
      setError(uploadError.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index) => {
    setSelectedFiles((currentFiles) => currentFiles.filter((_, fileIndex) => fileIndex !== index));
  };

  const getFileIcon = (file) => {
    const type = file.type.split('/')[0];
    switch (type) {
      case 'image':
        return 'IMG';
      case 'video':
        return 'VID';
      case 'audio':
        return 'AUD';
      default:
        return 'FILE';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) {
      return '0 Bytes';
    }

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const index = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, index)).toFixed(2))} ${sizes[index]}`;
  };

  return (
    <div className="file-upload-overlay">
      <div className="file-upload-modal">
        <div className="upload-header">
          <h3>Share Files</h3>
          <button className="btn-close" onClick={onClose} type="button">
            X
          </button>
        </div>

        <div className="upload-content">
          <div className="file-input-section">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              accept={Object.values(allowedTypes).flat().join(',')}
              className="file-input"
              id="file-input"
            />
            <label htmlFor="file-input" className="file-input-label">
              <span>Choose files</span>
              <span className="file-limits">Max 100MB per file</span>
            </label>
          </div>

          {selectedFiles.length > 0 && (
            <div className="selected-files">
              <h4>Selected Files ({selectedFiles.length})</h4>
              <div className="files-list">
                {selectedFiles.map((file, index) => (
                  <div key={file.name} className="file-item">
                    <div className="file-info">
                      <span className="file-icon">{getFileIcon(file)}</span>
                      <div className="file-details">
                        <span className="file-name">{file.name}</span>
                        <span className="file-size">{formatFileSize(file.size)}</span>
                      </div>
                    </div>
                    <div className="file-actions">
                      {uploadProgress[file.name] !== undefined && (
                        <div className="upload-progress">
                          <div
                            className="progress-bar"
                            style={{ width: `${uploadProgress[file.name]}%` }}
                          ></div>
                          <span className="progress-text">{uploadProgress[file.name]}%</span>
                        </div>
                      )}
                      {!uploading && (
                        <button
                          className="btn-remove-file"
                          onClick={() => removeFile(index)}
                          type="button"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="upload-error">
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="upload-footer">
          <button className="btn-cancel" onClick={onClose} disabled={uploading} type="button">
            Cancel
          </button>
          <button
            className="btn-upload"
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || uploading}
            type="button"
          >
            {uploading ? 'Uploading...' : `Upload ${selectedFiles.length} File${selectedFiles.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
