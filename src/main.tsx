import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary, renderFatalError } from './app/ErrorBoundary';
import './styles/global.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);

window.addEventListener('error', (event) => {
  renderFatalError(event.error ?? new Error(event.message));
});

window.addEventListener('unhandledrejection', (event) => {
  renderFatalError(event.reason);
});

import('./app/App')
  .then(({ App }) => {
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>,
    );
  })
  .catch(renderFatalError);
