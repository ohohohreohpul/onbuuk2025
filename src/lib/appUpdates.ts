import { registerSW } from 'virtual:pwa-register';

/**
 * Keeps the installed app / open tabs on the latest deploy.
 *
 * The service worker serves the cached app first, so without this a new version
 * only showed up after some later reload (days, for the installed admin app).
 * Now: check on open, when the tab becomes visible again, and every 15 minutes.
 * A new version is applied right away if the page was just opened, otherwise the
 * next time the tab is left, so nobody loses half-typed work.
 */
const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const FRESH_LOAD_MS = 10 * 1000;

export function keepAppUpdated(): void {
  if (!('serviceWorker' in navigator)) return;
  const loadedAt = Date.now();
  let updatePending = false;

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updatePending = true;
      if (Date.now() - loadedAt < FRESH_LOAD_MS || document.visibilityState === 'hidden') {
        void updateSW(true);
      }
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => registration.update().catch((error) => console.error('App update check failed:', error));
      setInterval(check, CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
    onRegisterError(error) {
      console.error('Service worker registration failed:', error);
    },
  });

  document.addEventListener('visibilitychange', () => {
    if (updatePending && document.visibilityState === 'hidden') void updateSW(true);
  });
}
