import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { Toaster } from '@/components/ui/toaster';
import { ErrorBoundary } from './components/ErrorBoundary';
import { captureAttribution } from './lib/attribution';
import { keepAppUpdated } from './lib/appUpdates';
import { classifyHost } from './lib/tenantHost';
import { isOwnerSurface } from './lib/ownerTracking';
import OwnerConsentBanner from './components/OwnerConsentBanner';

window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

captureAttribution();
keepAppUpdated();

// Zenno's own Meta pixel: owner pages on the app host only, never a shop's customer pages.
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;
const showOwnerConsent = Boolean(META_PIXEL_ID) && isOwnerSurface(window.location.pathname, classifyHost(window.location.hostname));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <Toaster />
      {showOwnerConsent && META_PIXEL_ID && <OwnerConsentBanner pixelId={META_PIXEL_ID} />}
    </ErrorBoundary>
  </StrictMode>
);
