import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ConfirmProvider } from './context/ConfirmContext';
import StaticDemoNotice from './components/StaticDemoNotice';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ConfirmProvider>
          <StaticDemoNotice />
          <App />
        </ConfirmProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);