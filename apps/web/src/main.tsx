import '@fontsource-variable/inter';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

async function prepareApp() {
  if (import.meta.env.VITE_ENABLE_MSW === 'true') {
    try {
      const { worker } = await import('./mocks/browser');
      await worker.start({
        onUnhandledRequest: 'bypass',
        serviceWorker: {
          url: '/mockServiceWorker.js',
        },
      });
    } catch (err) {
      console.warn('[DenimFlow] ServiceWorker failed to start, falling back to direct mode:', err);
    }
  }
}

function mount() {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element #root not found in document');
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

prepareApp()
  .then(mount)
  .catch((err) => {
    console.error('[DenimFlow] Failed to initialize app:', err);
    mount();
  });
