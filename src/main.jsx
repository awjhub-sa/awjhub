// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './context/AuthContext.jsx';
import { BrandProvider } from './context/BrandContext.jsx';
import App from './App';
import './index.css';

/* BrandProvider sits outside everything: it rewrites the --c-* variables on
   :root, so it must be mounted before any screen paints with them. */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrandProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrandProvider>
  </React.StrictMode>
);
