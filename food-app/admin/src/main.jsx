import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { applyAppearance, followDevice, loadAppearance } from './appearance.js';

// The chosen look is applied before the first paint, so the console does not flash light before going dark.
applyAppearance(loadAppearance());
followDevice();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
