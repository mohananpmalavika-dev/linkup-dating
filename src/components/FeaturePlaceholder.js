import React from 'react';
import { useNavigate } from '../router';
import '../styles/FeatureHub.css';

const FeaturePlaceholder = ({ title, emoji, description }) => {
  const navigate = useNavigate();
  return (
    <div className="feature-placeholder">
      <div className="feature-placeholder-header">
        <button className="btn-back" onClick={() => navigate('/more')}>Back</button>
      </div>
      <div className="feature-placeholder-content">
        <span className="placeholder-emoji">{emoji || 'Wrench'}</span>
        <h1>{title}</h1>
        <p>{description || 'This feature is being integrated.'}</p>
      </div>
    </div>
  );
};

export default FeaturePlaceholder;
