export function registerScreenFlowServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;
  if (!['http:', 'https:'].includes(window.location.protocol)) return;

  window.addEventListener('load', () => {
    const hadController = !!navigator.serviceWorker.controller;
    let refreshing = false;

    if (hadController) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    }

    navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none'
    }).then((registration) => registration.update()).catch((error) => {
      console.warn('ScreenFlow service worker registration failed:', error);
    });
  });
}

export function isStandaloneApp() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}
