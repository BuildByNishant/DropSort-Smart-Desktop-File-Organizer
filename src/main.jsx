import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { AppProvider } from './hooks/AppContext.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <AppProvider>
    <App />
  </AppProvider>
);
