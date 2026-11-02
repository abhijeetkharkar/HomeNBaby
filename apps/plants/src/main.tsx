import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import awsExports from './aws-exports';
import { AuthProvider } from './context/AuthContext';
import './index.css';
import App from './App.tsx';

Amplify.configure(awsExports);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
