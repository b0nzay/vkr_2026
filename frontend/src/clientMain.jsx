import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import ClientApp from './client/ClientApp.jsx';

const root = document.getElementById('client-root');

if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <BrowserRouter>
        <ClientApp />
      </BrowserRouter>
    </React.StrictMode>,
  );
}
