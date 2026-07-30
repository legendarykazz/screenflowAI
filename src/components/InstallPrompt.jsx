import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { isStandaloneApp } from '../lib/pwa';

const DISMISS_KEY = 'screenflow-pwa-install-dismissed';

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null);
  const [hidden, setHidden] = useState(
    isStandaloneApp() || window.localStorage.getItem(DISMISS_KEY) === '1'
  );

  useEffect(() => {
    const handleInstallReady = (event) => {
      event.preventDefault();
      setInstallEvent(event);
    };

    const handleInstalled = () => {
      setInstallEvent(null);
      setHidden(true);
      window.localStorage.removeItem(DISMISS_KEY);
    };

    window.addEventListener('beforeinstallprompt', handleInstallReady);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallReady);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (!installEvent || hidden) return null;

  const install = async () => {
    await installEvent.prompt();
    const result = await installEvent.userChoice;
    if (result.outcome === 'accepted') {
      setHidden(true);
      setInstallEvent(null);
    }
  };

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, '1');
    setHidden(true);
  };

  return (
    <aside className="pwa-install-prompt" aria-label="Install ScreenFlow AI">
      <span className="pwa-install-icon">S</span>
      <span className="pwa-install-copy">
        <strong>Install ScreenFlow AI</strong>
        <span>Open from your home screen.</span>
      </span>
      <button className="pwa-install-action" onClick={install}>
        <Download size={15} />
        Install
      </button>
      <button className="pwa-install-close" onClick={dismiss} title="Dismiss install prompt">
        <X size={15} />
      </button>
    </aside>
  );
}
