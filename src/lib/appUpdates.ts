import { registerSW } from 'virtual:pwa-register';

/**
 * Keeps the installed app / open tabs on the latest deploy.
 *
 * index.html always comes from the network (NetworkFirst), so a freshly opened
 * page already runs the newest version: the new service worker may take over in
 * the background, but that page is never reloaded. Only tabs that stay open
 * across a deploy reload, and only once they are left (hidden), so nobody loses
 * half-typed work. Checks run on open, when the tab becomes visible, and every
 * 15 minutes. A guard prevents more than one automatic reload per minute.
 */
const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const FRESH_LOAD_MS = 15 * 1000;
const RELOAD_GUARD_MS = 60 * 1000;
const RELOAD_GUARD_KEY = 'zenno:lastAutoReload';

function reloadOnce(): void {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_GUARD_MS) return;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    // Storage blocked: still reload, the visibility trigger keeps it rare.
  }
  window.location.reload();
}

export function keepAppUpdated(): void {
  if (!('serviceWorker' in navigator)) return;
  const loadedAt = Date.now();
  const isFreshLoad = () => Date.now() - loadedAt < FRESH_LOAD_MS;
  let reloadPending = false;

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Let the new worker take over without reloading this page (false = no reload).
      void updateSW(false);
      if (!isFreshLoad()) reloadPending = true;
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

  // A new worker took over. A page opened moments ago is already up to date;
  // an older tab reloads the next time it is left.
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || isFreshLoad()) return;
    if (document.visibilityState === 'hidden') reloadOnce();
    else reloadPending = true;
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && reloadPending) reloadOnce();
  });
}
