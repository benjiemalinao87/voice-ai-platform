import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext';
import { VapiProvider } from './contexts/VapiContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <VapiProvider>
        <App />
      </VapiProvider>
    </AuthProvider>
  </StrictMode>
);
