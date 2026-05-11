import React, { useState, useEffect } from 'react';
import { useNavigate } from '../../router';
import '../../styles/LegalPages.css';

const LegalDocumentViewer = ({ documentType = 'privacy' }) => {
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  const documentConfig = {
    privacy: {
      title: '🔐 Privacy Policy',
      filename: 'PRIVACY_POLICY.md',
      path: '/privacy-policy'
    },
    terms: {
      title: '📋 Terms of Service',
      filename: 'TERMS_OF_SERVICE.md',
      path: '/terms'
    },
    refund: {
      title: '💰 Refund & Subscription Policy',
      filename: 'REFUND_SUBSCRIPTION_POLICY.md',
      path: '/refund-policy'
    }
  };

  const config = documentConfig[documentType] || documentConfig.privacy;

  useEffect(() => {
    const loadDocument = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/${config.filename}`);
        if (!response.ok) throw new Error('Failed to load document');
        const text = await response.text();
        setContent(text);
      } catch (error) {
        console.error('Error loading legal document:', error);
        setContent('# Document Not Found\n\nWe could not load this document. Please contact support.');
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [documentType]);

  const renderMarkdown = (md) => {
    if (!md) return null;

    // Split content into lines
    const lines = md.split('\n');
    const elements = [];
    let currentList = [];
    let inCodeBlock = false;
    let codeBlockContent = '';

    lines.forEach((line, index) => {
      // Code blocks
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <pre key={`code-${index}`} className="legal-code-block">
              <code>{codeBlockContent}</code>
            </pre>
          );
          codeBlockContent = '';
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeBlockContent += line + '\n';
        return;
      }

      // Flush any pending list
      if (currentList.length > 0 && !line.startsWith('-') && !line.startsWith('•')) {
        elements.push(
          <ul key={`list-${index}`} className="legal-list">
            {currentList.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        );
        currentList = [];
      }

      // Headers
      if (line.startsWith('# ')) {
        elements.push(<h1 key={index} className="legal-h1">{line.replace(/^# /, '')}</h1>);
      } else if (line.startsWith('## ')) {
        elements.push(<h2 key={index} className="legal-h2">{line.replace(/^## /, '')}</h2>);
      } else if (line.startsWith('### ')) {
        elements.push(<h3 key={index} className="legal-h3">{line.replace(/^### /, '')}</h3>);
      } else if (line.startsWith('#### ')) {
        elements.push(<h4 key={index} className="legal-h4">{line.replace(/^#### /, '')}</h4>);
      }
      // Bullet lists
      else if (line.startsWith('- ') || line.startsWith('• ')) {
        currentList.push(line.replace(/^[-•]\s/, ''));
      }
      // Tables
      else if (line.includes('|')) {
        // Simple table detection - render as formatted text
        elements.push(
          <div key={index} className="legal-table-row">
            {line.split('|').map((cell, i) => (
              <div key={i} className="legal-table-cell">
                {cell.trim()}
              </div>
            ))}
          </div>
        );
      }
      // Bold text
      else if (line.trim() && !line.startsWith('---')) {
        const formatted = line
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          .replace(/`(.+?)`/g, '<code>$1</code>');

        if (formatted.trim()) {
          elements.push(
            <p key={index} className="legal-paragraph">
              {formatted.split('\n').map((part, i) => (
                <React.Fragment key={i}>
                  {part}
                  {i < formatted.split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
            </p>
          );
        }
      }
    });

    // Flush final list if exists
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-final`} className="legal-list">
          {currentList.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    }

    return elements;
  };

  return (
    <div className="legal-document-viewer">
      <div className="legal-header">
        <button className="legal-back-btn" onClick={() => navigate('/profile')}>
          ← Back
        </button>
        <h1>{config.title}</h1>
      </div>

      <div className="legal-content">
        {loading ? (
          <div className="legal-loading">
            <p>Loading document...</p>
          </div>
        ) : (
          <div className="legal-body">
            {renderMarkdown(content)}
          </div>
        )}
      </div>

      <div className="legal-footer">
        <p className="legal-last-updated">
          Last updated: April 28, 2026
        </p>
        <div className="legal-contacts">
          <p>
            <strong>Questions?</strong> Contact us at{' '}
            <a href="mailto:support@datinghub.app">support@datinghub.app</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LegalDocumentViewer;
