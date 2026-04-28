import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { installAppPrompt, register as registerServiceWorker } from './pwaConfig';
import reportWebVitals from './reportWebVitals';

void registerServiceWorker();
installAppPrompt();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();
