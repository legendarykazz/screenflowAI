export function registerScreenFlowServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;
  if (!['http:', 'https:'].includes(window.location.protocol)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      console.warn('ScreenFlow service worker registration failed:', error);
    });
  });
}

export function isStandaloneApp() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}
