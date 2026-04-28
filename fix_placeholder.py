+with open('src/components/FeaturePlaceholder.js', 'w', encoding='utf-8') as f:
    f.write("""import React from 'react';
import { useNavigate } from '../router';
import '../styles/FeatureHub.css';

const FeaturePlaceholder = ({ title, emoji, description }) => {
  const navigate = useNavigate();
  return React.createElement('div', { className: 'feature-placeholder' },
    React.createElement('div', { className: 'feature-placeholder-header' },
      React.createElement('button', { className: 'btn-back', onClick: () => navigate('/more') }, 'Back')
    ),
    React.createElement('div', { className: 'feature-placeholder-content' },
      React.createElement('span', { className: 'placeholder-emoji' }, emoji || ''),
      React.createElement('h1', null, title),
      React.createElement('p', null, description || 'This feature is being integrated.')
    )
  );
};

export default FeaturePlaceholder;
""")
print('Fixed FeaturePlaceholder.js')

