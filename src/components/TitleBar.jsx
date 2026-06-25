import React from 'react';
import { Minus, Square, X, Sparkles } from 'lucide-react';

export default function TitleBar() {
  const handleControl = (action) => {
    if (window.electron && window.electron.windowControl) {
      window.electron.windowControl(action);
    }
  };

  return (
    <div 
      style={{
        height: 'var(--titlebar-height)',
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        WebkitAppRegion: 'drag',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Sparkles size={16} className="text-indigo-500" style={{ color: 'var(--accent-primary)' }} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '14px', letterSpacing: '0.5px' }}>
          ScreenFlow AI
        </span>
      </div>

      <div style={{ display: 'flex', gap: '4px', WebkitAppRegion: 'no-drag' }}>
        <button 
          onClick={() => handleControl('minimize')}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Minus size={14} />
        </button>
        <button 
          onClick={() => handleControl('maximize')}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Square size={12} />
        </button>
        <button 
          onClick={() => handleControl('close')}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
