/**
 * "Cài lối tắt" (add to home screen). Chrome / Edge / Samsung Internet fire `beforeinstallprompt`
 * once, early, and only if a service worker controls the page: so the worker is registered and the
 * event kept from main.jsx, before React mounts. iOS has no such event: the user adds it from the
 * Share menu (we show the steps).
 */
let deferred = null;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export function initInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // keep it for our button instead of the browser's mini bar
    deferred = e;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    emit();
  });
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}

export function subscribeInstall(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const canPromptInstall = () => !!deferred;

/** Native install dialog (Android / desktop Chromium). @returns {Promise<'accepted'|'dismissed'>} */
export async function promptInstall() {
  const e = deferred;
  if (!e) return 'dismissed';
  deferred = null; // a prompt event can be used once
  emit();
  await e.prompt();
  const { outcome } = await e.userChoice;
  return outcome;
}

/** Already opened from the home screen icon. */
export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

/** 'ios' | 'android' | 'desktop' (iPadOS 13+ reports itself as a Mac with touch). */
export function detectPlatform() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

/** iOS only installs from Safari before iOS 16.4; other iOS browsers show the Share sheet too since. */
export const isIosSafari = () =>
  /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);
