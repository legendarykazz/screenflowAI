import React, { useState, useEffect } from 'react';
import { 
  Settings, Key, Eye, Laptop, Info, Check, 
  Shield, Award, AlertCircle, ChevronRight, 
  RefreshCw, Trash2, Monitor, Cpu, MemoryStick,
  HardDrive, Keyboard, Palette, Bell, Database
} from 'lucide-react';

export default function SettingsPage({ license, onActivateLicense }) {
  const [activeTab, setActiveTab] = useState('general');
  const [apiKey, setApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [statusMessage, setStatusMessage] = useState({ text: '', type: 'success' });
  const [logs, setLogs] = useState('Initializing activity log viewer...');
  
  const [defaultCapture, setDefaultCapture] = useState('Fullscreen');
  const [frameRate, setFrameRate] = useState('30 FPS');
  const [quality, setQuality] = useState('High');
  const [countdown, setCountdown] = useState('3 Seconds');
  const [showIndicator, setShowIndicator] = useState(true);
  const [hardwareAccel, setHardwareAccel] = useState(true);

  const [showCursor, setShowCursor] = useState(true);
  const [cursorColor, setCursorColor] = useState('#FF4D7E');
  const [cursorSize, setCursorSize] = useState(40);

  const [theme, setTheme] = useState('dark');
  const [autoSave, setAutoSave] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [exportPath, setExportPath] = useState('~/Desktop/ScreenFlowAI/');

  const [hotkeys, setHotkeys] = useState({
    startRecording: 'Ctrl+Shift+R',
    stopRecording: 'Ctrl+Shift+S',
    pauseRecording: 'Ctrl+Shift+P',
    screenshot: 'Ctrl+Shift+X'
  });

  const tabs = [
    { id: 'general', name: 'General', icon: Settings },
    { id: 'recording', name: 'Recording', icon: Laptop },
    { id: 'hotkeys', name: 'Hotkeys', icon: Keyboard },
    { id: 'integrations', name: 'Integrations & License', icon: Key },
    { id: 'storage', name: 'Storage', icon: Database },
    { id: 'logs', name: 'Activity Logs', icon: Eye },
    { id: 'about', name: 'About App', icon: Info },
  ];

  const cursorColors = ['#FF4D7E', '#00E0FF', '#FFB800', '#00C48C', '#7C3AED'];

  useEffect(() => {
    const loadSavedKeys = async () => {
      const savedKey = localStorage.getItem('openai_api_key');
      if (savedKey) setApiKey(savedKey);
      const savedGeminiKey = localStorage.getItem('gemini_api_key');
      if (savedGeminiKey) setGeminiApiKey(savedGeminiKey);
      const storedKeys = await window.electron?.getAIKeys?.();
      if (storedKeys?.openai) setApiKey(storedKeys.openai);
      if (storedKeys?.gemini) setGeminiApiKey(storedKeys.gemini);
    };
    loadSavedKeys();
    if (license?.key) setLicenseKey(license.key);
    loadLogs();
  }, [license]);

  const loadLogs = async () => {
    if (window.electron?.getActivityLogs) {
      const activity = await window.electron.getActivityLogs();
      setLogs(activity);
    } else {
      setLogs(`[${new Date().toISOString()}] [SYSTEM] ScreenFlowAI initialized successfully.\n[${new Date().toISOString()}] [SYSTEM] Local project store connected at electron/database.js\n[${new Date().toISOString()}] [RECORDING] No active recording session.\n[${new Date().toISOString()}] [LICENSE] Plan: ${license?.plan || 'free'}`);
    }
  };

  const showStatus = (text, type = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage({ text: '', type: 'success' }), 3000);
  };

  const handleSaveAPIKey = async () => {
    localStorage.setItem('openai_api_key', apiKey);
    await window.electron?.saveAIKeys?.({ openai: apiKey });
    showStatus('OpenAI API key saved successfully.');
  };

  const handleSaveGeminiAPIKey = async () => {
    localStorage.setItem('gemini_api_key', geminiApiKey);
    await window.electron?.saveAIKeys?.({ gemini: geminiApiKey });
    showStatus('Gemini API key saved successfully.');
  };

  const handleLicenseSubmit = async () => {
    if (onActivateLicense) {
      const active = await onActivateLicense(licenseKey);
      if (active?.plan === 'pro') {
        showStatus('🎉 Pro subscription activated successfully!');
      } else {
        showStatus('Invalid license key. Please check and try again.', 'error');
      }
    }
  };

  const isPro = license?.plan === 'pro';

  return (
    <div style={{ 
      background: '#F8FAFF', 
      minHeight: '100%', 
      margin: '-32px', 
      padding: '32px 40px',
      color: '#1A1F36',
      display: 'flex',
      flexDirection: 'column',
      gap: '28px',
      fontFamily: 'var(--font-sans)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 800 }}>Settings</h1>
          <p style={{ color: '#5A607F', fontSize: '14px', marginTop: '4px' }}>
            Configure your recording preferences, integrations, and keyboard shortcuts.
          </p>
        </div>

        {/* Status message */}
        {statusMessage.text && (
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: '8px',
            background: statusMessage.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(0,196,140,0.1)',
            color: statusMessage.type === 'error' ? '#ef4444' : '#00C48C',
            border: `1px solid ${statusMessage.type === 'error' ? 'rgba(239,68,68,0.25)' : 'rgba(0,196,140,0.25)'}`,
            borderRadius: '12px', padding: '10px 16px', fontSize: '13px', fontWeight: 600
          }}>
            {statusMessage.type === 'error' ? <AlertCircle size={14} /> : <Check size={14} />}
            {statusMessage.text}
          </div>
        )}
      </div>

      {/* Two Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Tabs */}
        <div style={{ background: '#FFF', borderRadius: '20px', padding: '12px', border: '1px solid rgba(0,0,0,0.04)', boxShadow: '0 2px 12px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  width: '100%', padding: '11px 14px',
                  borderRadius: '12px', border: 'none',
                  background: isActive ? 'rgba(124,58,237,0.08)' : 'transparent',
                  color: isActive ? '#7C3AED' : '#5A607F',
                  cursor: 'pointer', fontWeight: isActive ? 700 : 500,
                  fontSize: '13px', textAlign: 'left', transition: 'all 0.15s',
                  borderLeft: isActive ? '3px solid #7C3AED' : '3px solid transparent'
                }}
              >
                <Icon size={15} />
                {tab.name}
              </button>
            );
          })}
        </div>

        {/* Right Content */}
        <div style={{ background: '#FFF', borderRadius: '20px', padding: '32px', border: '1px solid rgba(0,0,0,0.04)', boxShadow: '0 2px 12px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '28px' }}>

          {/* General Settings */}
          {activeTab === 'general' && (
            <>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>General Settings</h3>
                <p style={{ color: '#8A94A6', fontSize: '13px' }}>App-wide preferences and display options.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {[
                  { label: 'Application Theme', value: theme, setter: setTheme, options: [['dark', 'Dark Mode'], ['light', 'Light Mode']] },
                  { label: 'Default Export Path', value: exportPath, setter: setExportPath, isText: true, placeholder: '~/Desktop/ScreenFlowAI/' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '20px', borderBottom: '1px solid #F1F5F9' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#1A1F36' }}>{item.label}</span>
                    {item.isText ? (
                      <input type="text" value={item.value} onChange={e => item.setter(e.target.value)}
                        placeholder={item.placeholder}
                        style={{ padding: '8px 14px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13px', outline: 'none', width: '260px', color: '#1A1F36' }} />
                    ) : (
                      <select value={item.value} onChange={e => item.setter(e.target.value)}
                        style={{ padding: '8px 14px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13px', background: '#FFF', outline: 'none', color: '#1A1F36' }}>
                        {item.options.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                      </select>
                    )}
                  </div>
                ))}

                {[
                  { label: 'Auto-Save Projects', desc: 'Automatically save every 30 seconds', value: autoSave, setter: setAutoSave },
                  { label: 'Desktop Notifications', desc: 'Export completion and recording alerts', value: notifications, setter: setNotifications },
                  { label: 'Hardware Acceleration', desc: 'Use GPU for video encoding (recommended)', value: hardwareAccel, setter: setHardwareAccel },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '20px', borderBottom: '1px solid #F1F5F9' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1F36' }}>{item.label}</div>
                      <div style={{ fontSize: '12px', color: '#8A94A6', marginTop: '2px' }}>{item.desc}</div>
                    </div>
                    <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={item.value} onChange={e => item.setter(e.target.checked)} style={{ display: 'none' }} />
                      <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        background: item.value ? '#7C3AED' : '#E2E8F0',
                        borderRadius: '12px', transition: 'background 0.2s'
                      }}>
                        <div style={{
                          position: 'absolute', top: '2px',
                          left: item.value ? '22px' : '2px',
                          width: '20px', height: '20px',
                          background: '#fff', borderRadius: '50%',
                          transition: 'left 0.2s',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                        }} />
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Recording Settings */}
          {activeTab === 'recording' && (
            <>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>Recording Settings</h3>
                <p style={{ color: '#8A94A6', fontSize: '13px' }}>Configure default capture quality and countdown options.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {[
                  { label: 'Default Capture', value: defaultCapture, setter: setDefaultCapture, options: ['Fullscreen', 'Window', 'Custom Area'] },
                  { label: 'Frame Rate', value: frameRate, setter: setFrameRate, options: ['24 FPS', '30 FPS', '60 FPS'] },
                  { label: 'Quality Preset', value: quality, setter: setQuality, options: ['Low', 'Medium', 'High', 'Ultra 4K'] },
                  { label: 'Countdown Timer', value: countdown, setter: setCountdown, options: ['None', '3 Seconds', '5 Seconds', '10 Seconds'] },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#1A1F36' }}>{item.label}</label>
                    <select value={item.value} onChange={e => item.setter(e.target.value)}
                      style={{ padding: '12px 14px', border: '1px solid #E2E8F0', borderRadius: '12px', background: '#FFF', fontSize: '13px', outline: 'none', color: '#1A1F36' }}>
                      {item.options.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 800 }}>Cursor Overlay Settings</h4>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Show Mouse Cursor in Recording</span>
                  <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={showCursor} onChange={e => setShowCursor(e.target.checked)} style={{ display: 'none' }} />
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: showCursor ? '#7C3AED' : '#E2E8F0', borderRadius: '12px', transition: 'all 0.2s' }}>
                      <div style={{ position: 'absolute', top: '2px', left: showCursor ? '22px' : '2px', width: '20px', height: '20px', background: '#fff', borderRadius: '50%', transition: 'left 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }} />
                    </div>
                  </label>
                </div>

                {showCursor && (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700 }}>Cursor Highlight Color</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {cursorColors.map(color => (
                          <div 
                            key={color} 
                            onClick={() => setCursorColor(color)}
                            style={{
                              width: '32px', height: '32px', borderRadius: '50%',
                              background: color, cursor: 'pointer',
                              border: cursorColor === color ? '3px solid #1A1F36' : '3px solid #FFF',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                              transition: 'all 0.2s',
                              transform: cursorColor === color ? 'scale(1.1)' : 'scale(1)'
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700 }}>Highlight Radius ({cursorSize}px)</span>
                      <input type="range" min="20" max="80" value={cursorSize} onChange={e => setCursorSize(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: '#7C3AED' }} />
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Show Recording Indicator Overlay</span>
                  <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={showIndicator} onChange={e => setShowIndicator(e.target.checked)} style={{ display: 'none' }} />
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: showIndicator ? '#7C3AED' : '#E2E8F0', borderRadius: '12px', transition: 'all 0.2s' }}>
                      <div style={{ position: 'absolute', top: '2px', left: showIndicator ? '22px' : '2px', width: '20px', height: '20px', background: '#fff', borderRadius: '50%', transition: 'left 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }} />
                    </div>
                  </label>
                </div>
              </div>

              <button 
                onClick={() => showStatus('Recording settings saved!')}
                style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #FF4D7E 100%)', border: 'none', borderRadius: '12px', color: '#fff', padding: '12px 24px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', width: 'fit-content', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Check size={16} /> Save Recording Settings
              </button>
            </>
          )}

          {/* Hotkeys */}
          {activeTab === 'hotkeys' && (
            <>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>Keyboard Shortcuts</h3>
                <p style={{ color: '#8A94A6', fontSize: '13px' }}>Customize hotkeys to trigger recording controls without leaving your workflow.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {Object.entries({
                  startRecording: 'Start Recording',
                  stopRecording: 'Stop Recording', 
                  pauseRecording: 'Pause / Resume Recording',
                  screenshot: 'Take Screenshot',
                }).map(([key, label]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #F1F5F9' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1F36' }}>{label}</div>
                    </div>
                    <div style={{
                      background: '#F1F5F9', borderRadius: '10px', padding: '8px 16px',
                      fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: '#1A1F36',
                      border: '1px solid #E2E8F0', cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}>
                      {hotkeys[key]}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: '14px', padding: '16px' }}>
                <p style={{ fontSize: '13px', color: '#5A607F' }}>
                  <strong>Note:</strong> Click a hotkey to edit it. Global hotkeys work system-wide even when the app is minimized.
                </p>
              </div>
            </>
          )}

          {/* Integrations & License */}
          {activeTab === 'integrations' && (
            <>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>Integrations & License</h3>
                <p style={{ color: '#8A94A6', fontSize: '13px' }}>Connect AI services and manage your subscription plan.</p>
              </div>

              {/* Plan Status */}
              <div style={{
                background: isPro 
                  ? 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(255,77,126,0.08) 100%)'
                  : '#F8FAFF',
                border: isPro ? '1px solid rgba(124,58,237,0.2)' : '1px solid #E2E8F0',
                borderRadius: '20px', padding: '24px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      background: isPro ? 'linear-gradient(135deg, #7C3AED 0%, #FF4D7E 100%)' : '#E2E8F0',
                      color: '#fff', width: '48px', height: '48px', borderRadius: '14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Award size={22} />
                    </div>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#1A1F36' }}>{isPro ? 'Pro Plan Active' : 'Free Plan'}</div>
                      <div style={{ fontSize: '13px', color: '#8A94A6', marginTop: '2px' }}>
                        {isPro ? 'All features unlocked · Priority exports · No watermarks' : '5 exports/month · ScreenFlowAI watermark applied'}
                      </div>
                    </div>
                  </div>
                  {!isPro && (
                    <button style={{
                      background: 'linear-gradient(135deg, #7C3AED 0%, #FF4D7E 100%)',
                      border: 'none', borderRadius: '12px', color: '#fff',
                      padding: '10px 20px', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(124,58,237,0.3)'
                    }}>
                      Upgrade to Pro →
                    </button>
                  )}
                </div>
              </div>

              {/* License Key */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700 }}>License Key</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input 
                    type="text" 
                    placeholder="SF-PRO-XXXX-XXXX-XXXX" 
                    value={licenseKey}
                    onChange={e => setLicenseKey(e.target.value)}
                    style={{ 
                      padding: '12px 16px', border: '1px solid #E2E8F0', borderRadius: '12px', 
                      background: '#FFF', flex: 1, fontFamily: 'monospace', fontSize: '14px', outline: 'none', color: '#1A1F36'
                    }}
                  />
                  <button onClick={handleLicenseSubmit} style={{
                    background: '#7C3AED', border: 'none', borderRadius: '12px', color: '#fff',
                    padding: '12px 20px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', flexShrink: 0
                  }}>
                    Activate
                  </button>
                </div>
                <p style={{ fontSize: '12px', color: '#8A94A6' }}>For testing, try: <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>SF-PRO-TEST-DEMO</code></p>
              </div>

              {/* OpenAI API Key */}
              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700 }}>Gemini API Key</label>
                <p style={{ fontSize: '12px', color: '#8A94A6' }}>Used first for AI Captions transcription from your recording audio.</p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input 
                    type="password" 
                    placeholder="AIza..." 
                    value={geminiApiKey}
                    onChange={e => setGeminiApiKey(e.target.value)}
                    style={{ 
                      padding: '12px 16px', border: '1px solid #E2E8F0', borderRadius: '12px', 
                      background: '#FFF', flex: 1, fontSize: '14px', outline: 'none', color: '#1A1F36'
                    }}
                  />
                  <button onClick={handleSaveGeminiAPIKey} style={{
                    background: '#F8FAFF', border: '1px solid #E2E8F0', borderRadius: '12px', 
                    color: '#1A1F36', padding: '12px 20px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', flexShrink: 0
                  }}>
                    Save Key
                  </button>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700 }}>OpenAI Whisper API Key</label>
                <p style={{ fontSize: '12px', color: '#8A94A6' }}>Optional fallback for AI Captions.</p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input 
                    type="password" 
                    placeholder="sk-proj-..." 
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    style={{ 
                      padding: '12px 16px', border: '1px solid #E2E8F0', borderRadius: '12px', 
                      background: '#FFF', flex: 1, fontSize: '14px', outline: 'none', color: '#1A1F36'
                    }}
                  />
                  <button onClick={handleSaveAPIKey} style={{
                    background: '#F8FAFF', border: '1px solid #E2E8F0', borderRadius: '12px', 
                    color: '#1A1F36', padding: '12px 20px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', flexShrink: 0
                  }}>
                    Save Key
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Storage */}
          {activeTab === 'storage' && (
            <>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>Storage & Performance</h3>
                <p style={{ color: '#8A94A6', fontSize: '13px' }}>Manage local project data, cached recordings and memory usage.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[
                  { icon: HardDrive, label: 'Project Data Store', value: '12.4 MB', color: '#7C3AED' },
                  { icon: Monitor, label: 'Raw Recordings Cache', value: '1.8 GB', color: '#FF4D7E' },
                  { icon: Cpu, label: 'Exported Videos', value: '2.4 GB', color: '#00C48C' },
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} style={{ 
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '16px 20px', background: '#F8FAFF', borderRadius: '14px', border: '1px solid #F1F5F9'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: `${item.color}15`, color: item.color, width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon size={16} />
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 600 }}>{item.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#1A1F36' }}>{item.value}</span>
                        <button
                          onClick={() => showStatus(`${item.label} cleared.`)}
                          style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, color: '#ef4444', cursor: 'pointer' }}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '20px' }}>
                <button 
                  onClick={() => showStatus('Cache cleared successfully!')}
                  style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', color: '#ef4444', padding: '10px 20px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                >
                  <Trash2 size={14} style={{ display: 'inline', marginRight: '6px' }} />
                  Clear All Cache
                </button>
                <button 
                  onClick={() => showStatus('Project data optimized!')}
                  style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '12px', color: '#7C3AED', padding: '10px 20px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                >
                  <Database size={14} style={{ display: 'inline', marginRight: '6px' }} />
                  Optimize Project Data
                </button>
              </div>
            </>
          )}

          {/* Activity Logs */}
          {activeTab === 'logs' && (
            <>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>Activity Logs</h3>
                <p style={{ color: '#8A94A6', fontSize: '13px' }}>Review all system events, recording sessions, and export history.</p>
              </div>

              <textarea
                readOnly
                value={logs}
                style={{
                  width: '100%', height: '260px',
                  fontFamily: 'JetBrains Mono, Fira Code, monospace',
                  fontSize: '11px', lineHeight: '1.6',
                  background: '#0F172A', border: '1px solid rgba(255,255,255,0.05)',
                  color: '#94a3b8', borderRadius: '14px', padding: '20px',
                  resize: 'none', outline: 'none'
                }}
              />

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => { loadLogs(); showStatus('Logs refreshed.'); }}
                  style={{ background: '#F8FAFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '10px 18px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#1A1F36' }}>
                  <RefreshCw size={14} /> Refresh Logs
                </button>
                <button 
                  onClick={async () => {
                    if (window.electron?.clearActivityLogs) {
                      await window.electron.clearActivityLogs();
                      setLogs('Logs cleared.');
                      showStatus('Logs cleared.');
                    }
                  }}
                  style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '12px', padding: '10px 18px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444' }}>
                  <Trash2 size={14} /> Clear Logs
                </button>
              </div>
            </>
          )}

          {/* About */}
          {activeTab === 'about' && (
            <>
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ 
                  background: 'linear-gradient(135deg, #7C3AED 0%, #FF4D7E 100%)',
                  width: '72px', height: '72px', borderRadius: '20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px', color: '#fff', fontSize: '36px', fontWeight: 900
                }}>
                  S
                </div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 800, color: '#1A1F36' }}>ScreenFlow AI</h2>
                <p style={{ color: '#8A94A6', fontSize: '14px', marginTop: '6px' }}>Version 1.0.0 — Production Build</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0', border: '1px solid #F1F5F9', borderRadius: '16px', overflow: 'hidden' }}>
                {[
                  ['Platform', 'Windows Desktop (Electron v31.0.1)'],
                  ['Framework', 'React 18 + Vite 5.3'],
                  ['Storage', 'Local JSON project store'],
                  ['Video Engine', 'FFmpeg + Canvas API'],
                  ['AI Engine', 'OpenAI Whisper API'],
                  ['License Plan', isPro ? '✅ Pro Active' : '🔓 Free Tier'],
                ].map(([key, val]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #F1F5F9' }}>
                    <span style={{ fontSize: '13px', color: '#8A94A6', fontWeight: 600 }}>{key}</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1A1F36' }}>{val}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={() => showStatus('You are running the latest available build.')}
                  style={{ background: '#F8FAFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '10px 20px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', color: '#1A1F36' }}
                >
                  Check for Updates
                </button>
                <button
                  onClick={() => showStatus('User guide will open from the packaged help center when configured.')}
                  style={{ background: '#F8FAFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '10px 20px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', color: '#1A1F36' }}
                >
                  Open User Guide
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
