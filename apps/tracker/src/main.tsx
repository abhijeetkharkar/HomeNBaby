import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Amplify } from 'aws-amplify';
import awsExports from './aws-exports';
import '@aws-amplify/ui-react/styles.css';
import { BabyProfileProvider } from './hooks/useBabyProfile';

Amplify.configure(awsExports);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BabyProfileProvider>
      <App />
    </BabyProfileProvider>
  </React.StrictMode>
);
