import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// Components & Pages
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Recording from './pages/Recording';
import Projects from './pages/Projects';
import Exports from './pages/Exports';
import SettingsPage from './pages/Settings';
import Editor from './pages/Editor';
import BrandKit from './pages/BrandKit';
import AITools from './pages/AITools';
import Widget from './pages/Widget';
import FootballLab from './pages/FootballLab';
import LiveCall from './pages/LiveCall';
import JoinCall from './pages/JoinCall';

// Safe browser mock stubs if running outside of Electron
if (!window.electron) {
  console.warn("Electron API not found. Activating web-browser fallback simulation mock.");
  
  const mockProjects = [
    {
      id: 'demo-1',
      name: 'Product Walkthrough Video',
      created_at: Date.now() - 3600000 * 24,
      updated_at: Date.now() - 3600000 * 2,
      video_path: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      audio_path: 'mock_audio.wav',
      duration: 15,
      aspect_ratio: '16:9',
      settings: {
        zoom_level: 1.6,
        cursor_scale: 1.2,
        cursor_highlight: 'both',
        cursor_color: '#6366f1',
        cursor_size: 40,
        background_type: 'gradient',
        background_value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }
    }
  ];

  const mockCursorEvents = [
    { timestamp: 0.0, x: 180, y: 160, event_type: 'move' },
    { timestamp: 0.7, x: 320, y: 220, event_type: 'move' },
    { timestamp: 1.4, x: 450, y: 300, event_type: 'move' },
    { timestamp: 1.5, x: 450, y: 300, event_type: 'click' },
    { timestamp: 2.3, x: 620, y: 360, event_type: 'move' },
    { timestamp: 4.4, x: 760, y: 460, event_type: 'move' },
    { timestamp: 5.2, x: 800, y: 500, event_type: 'click' },
    { timestamp: 6.4, x: 520, y: 420, event_type: 'move' },
    { timestamp: 8.8, x: 260, y: 360, event_type: 'move' },
    { timestamp: 9.8, x: 200, y: 400, event_type: 'click' },
    { timestamp: 11.0, x: 420, y: 260, event_type: 'move' }
  ];

  window.electron = {
    getProjects: async () => {
      const stored = localStorage.getItem('mock_projects');
      return stored ? JSON.parse(stored) : mockProjects;
    },
    getProject: async (id) => {
      const stored = localStorage.getItem('mock_projects');
      const list = stored ? JSON.parse(stored) : mockProjects;
      return list.find(p => p.id === id) || mockProjects[0];
    },
    createProject: async (name) => {
      const stored = localStorage.getItem('mock_projects');
      const list = stored ? JSON.parse(stored) : mockProjects;
      const newProj = {
        id: Math.random().toString(36).substring(2, 9),
        name,
        created_at: Date.now(),
        updated_at: Date.now(),
        video_path: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        duration: 10,
        settings: {
          zoom_level: 1.5,
          cursor_scale: 1.0,
          cursor_highlight: 'ripple',
          cursor_color: '#ff4500',
          cursor_size: 40,
          background_type: 'gradient'
        }
      };
      list.push(newProj);
      localStorage.setItem('mock_projects', JSON.stringify(list));
      return newProj;
    },
    updateProject: async (id, fields) => {
      const stored = localStorage.getItem('mock_projects');
      const list = stored ? JSON.parse(stored) : mockProjects;
      const idx = list.findIndex(p => p.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...fields, settings: { ...list[idx].settings, ...fields } };
        localStorage.setItem('mock_projects', JSON.stringify(list));
      }
      return list[idx];
    },
    deleteProject: async (id) => {
      const stored = localStorage.getItem('mock_projects');
      const list = stored ? JSON.parse(stored) : mockProjects;
      const filtered = list.filter(p => p.id !== id);
      localStorage.setItem('mock_projects', JSON.stringify(filtered));
      return { success: true };
    },
    getCursorEvents: async () => mockCursorEvents,
    saveCursorEvents: async () => {},
    getCaptions: async () => [],
    saveCaptions: async () => {},
    getSources: async () => [
      { id: 'screen-1', name: 'Primary Monitor (1080p)', thumbnail: '' },
      { id: 'window-1', name: 'Chrome Browser Window', thumbnail: '' }
    ],
    setLiveDisplaySource: async () => ({ success: true }),
    createLiveKitToken: async (roomName, participantName) => {
      try {
        const response = await fetch('/api/livekit-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomCode: roomName, participantName })
        });
        const result = await response.json();
        if (!response.ok) {
          return { success: false, error: result.error || 'Unable to create LiveKit token.' };
        }
        return { success: true, ...result };
      } catch (err) {
        return { success: false, error: err.message || 'LiveKit token endpoint is unavailable.' };
      }
    },
    startRecording: async () => ({ success: true }),
    stopRecording: async () => ({ events: mockCursorEvents }),
    saveRecordedFile: async (uint8Array) => {
      try {
        const blob = new Blob([uint8Array], { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        return {
          success: true,
          filePath: url
        };
      } catch (err) {
        console.error("Mock file save failed:", err);
        return {
          success: false,
          error: err.message
        };
      }
    },
    startExport: async (projectId, path, format, quality) => {
      // Simulate progress
      let p = 0;
      const iv = setInterval(() => {
        p += 10;
        if (window.electron._onExportProgressCallback) {
          window.electron._onExportProgressCallback({ progress: p });
        }
        if (p >= 100) clearInterval(iv);
      }, 500);
    },
    onExportProgress: (callback) => {
      window.electron._onExportProgressCallback = callback;
    },
    getExports: async () => [],
    checkLicense: async () => ({ plan: 'free', key: '' }),
    activateLicense: async (key) => ({ plan: key.startsWith('SF-PRO-') ? 'pro' : 'free', key }),
    windowControl: (action) => console.log(`Window control action: ${action}`)
  };
}

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [license, setLicense] = useState({ plan: 'free', key: '' });

  useEffect(() => {
    checkLicenseStatus();
  }, []);

  const checkLicenseStatus = async () => {
    if (window.electron && window.electron.checkLicense) {
      const lic = await window.electron.checkLicense();
      setLicense(lic);
    }
  };

  const handleActivateLicense = async (key) => {
    if (window.electron && window.electron.activateLicense) {
      const active = await window.electron.activateLicense(key);
      setLicense(active);
      return active;
    }
    return { plan: 'free', key: '' };
  };

  const handleOpenProject = (id) => {
    setActiveProjectId(id);
    setCurrentPage('editor');
  };

  const handleCloseProject = () => {
    setActiveProjectId(null);
    setCurrentPage('dashboard');
  };

  const renderContent = () => {
    if (currentPage === 'editor' && activeProjectId) {
      return (
        <Editor 
          projectId={activeProjectId} 
          onCloseProject={handleCloseProject}
          license={license}
        />
      );
    }

    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard 
            onCreateProject={handleOpenProject} 
            onOpenProject={handleOpenProject}
            navigateTo={setCurrentPage}
          />
        );
      case 'recording':
        return <Recording onOpenProject={handleOpenProject} license={license} />;
      case 'projects':
        return <Projects onOpenProject={handleOpenProject} />;
      case 'exports':
        return <Exports />;
      case 'brandkit':
        return <BrandKit />;
      case 'aitools':
        return <AITools navigateTo={setCurrentPage} />;
      case 'livecall':
        return <LiveCall />;
      case 'football':
        return <FootballLab />;
      case 'settings':
        return (
          <SettingsPage 
            license={license} 
            onActivateLicense={handleActivateLicense}
          />
        );
      default:
        return <Dashboard onCreateProject={handleOpenProject} onOpenProject={handleOpenProject} navigateTo={setCurrentPage} />;
    }
  };

  return (
    <div className="app-container">
      <TitleBar />
      <div className="main-shell">
        {currentPage !== 'editor' && (
          <Sidebar 
            currentPage={currentPage} 
            setCurrentPage={setCurrentPage} 
            license={license}
          />
        )}
        <main className="content-area">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

const isWidget = window.location.hash === '#/widget' || window.location.search.includes('widget=true');
const isJoinPage = window.location.pathname.startsWith('/join/');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isJoinPage ? <JoinCall /> : isWidget ? <Widget /> : <App />}
  </React.StrictMode>
);
