import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import WpApp from './WpApp';
import './index.css';
import { Toaster } from '@/components/ui/toaster';
import { ErrorBoundary } from './components/ErrorBoundary';

window.addEventListener('error', (event) => {
  console.error('[Buuk] Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Buuk] Unhandled rejection:', event.reason);
});

const container = document.getElementById('buuk-booking-widget');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <ErrorBoundary>
        <WpApp />
        <Toaster />
      </ErrorBoundary>
    </StrictMode>
  );
} else {
  console.error('[Buuk] Could not find #buuk-booking-widget container.');
}
