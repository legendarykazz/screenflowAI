import React, { useState, useEffect } from 'react';

export default function Widget() {
  const [time, setTime] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomLabel, setZoomLabel] = useState('1x unzoom');
  const [isStopping, setIsStopping] = useState(false);

  useEffect(() => {
    let unsubscribeRecordingStatus = null;

    // Listen for recording status updates to sync timer
    if (window.electron?.onRecordingStatus) {
      unsubscribeRecordingStatus = window.electron.onRecordingStatus((status) => {
        if (status.type === 'time') {
          setTime(status.value);
        } else if (status.type === 'zoom') {
          setZoomLevel((current) => {
            const next = status.direction === 'in'
              ? Math.min(3, current + 0.25)
              : Math.max(1, current - 0.25);
            setZoomLabel(next <= 1 ? '1x unzoom' : `${next.toFixed(1)}x zoom`);
            return next;
          });
        }
      });
    }

    // Start a local timer tick fallback just in case IPC is delayed
    const interval = setInterval(() => {
      setTime((prev) => prev + 1);
    }, 1000);

    return () => {
      unsubscribeRecordingStatus?.();
      clearInterval(interval);
    };
  }, []);

  const handleStop = async () => {
    if (isStopping) return;
    setIsStopping(true);
    try {
      if (window.electron?.stopRecordingFromWidget) {
        await window.electron.stopRecordingFromWidget();
      }
    } catch (err) {
      console.error("Failed to stop recording from widget:", err);
      setIsStopping(false);
    }
  };

  const handleZoom = async (direction) => {
    try {
      await window.electron?.manualZoom?.(direction);
    } catch (err) {
      console.error("Failed to change zoom:", err);
    }
  };

  const formatTime = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        background: 'rgba(15, 23, 42, 0.9)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '28px',
        color: '#FFFFFF',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        boxSizing: 'border-box',
        overflow: 'hidden',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
        cursor: 'grab',
        WebkitAppRegion: 'drag' // Makes the entire pill draggable on the screen!
      }}
    >
      {/* Draggable recording indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', WebkitAppRegion: 'drag' }}>
        <div 
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#EF4444',
            animation: 'pulse 1.2s infinite'
          }}
        />
        <style>
          {`
            @keyframes pulse {
              0% { transform: scale(0.9); opacity: 0.6; }
              50% { transform: scale(1.15); opacity: 1; }
              100% { transform: scale(0.9); opacity: 0.6; }
            }
          `}
        </style>
        <span style={{ fontSize: '15px', fontWeight: 800, color: '#94A3B8' }}>REC</span>
      </div>

      {/* Monospace Timer */}
      <div style={{ fontSize: '20px', fontWeight: 900, fontFamily: 'monospace', letterSpacing: '0.5px' }}>
        {formatTime(time)}
      </div>

      {/* Divider */}
      <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255,255,255,0.15)' }} />

      <div
        style={{
          minWidth: '110px',
          textAlign: 'center',
          background: zoomLevel <= 1 ? 'rgba(255,255,255,0.08)' : 'rgba(124,58,237,0.28)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: '16px',
          padding: '11px 12px',
          color: '#FFFFFF',
          fontSize: '15px',
          fontWeight: 900,
          WebkitAppRegion: 'drag'
        }}
      >
        {zoomLabel}
      </div>

      <button
        onClick={() => handleZoom('out')}
        style={{
          width: '28px',
          height: '46px',
          minWidth: '58px',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'rgba(255,255,255,0.08)',
          color: '#FFFFFF',
          fontSize: '30px',
          fontWeight: 900,
          cursor: 'pointer',
          lineHeight: 1,
          WebkitAppRegion: 'no-drag'
        }}
        title="Zoom out"
      >
        -
      </button>

      <button
        onClick={() => handleZoom('in')}
        style={{
          width: '58px',
          height: '46px',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'rgba(124,58,237,0.75)',
          color: '#FFFFFF',
          fontSize: '30px',
          fontWeight: 900,
          cursor: 'pointer',
          lineHeight: 1,
          WebkitAppRegion: 'no-drag'
        }}
        title="Zoom in"
      >
        +
      </button>

      {/* Divider */}
      <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255,255,255,0.15)' }} />

      {/* Stop Button */}
      <button
        onClick={handleStop}
        disabled={isStopping}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          padding: '12px 18px',
          borderRadius: '16px',
          border: 'none',
          backgroundColor: isStopping ? '#475569' : '#EF4444',
          color: '#FFFFFF',
          fontSize: '14px',
          fontWeight: 900,
          cursor: isStopping ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          WebkitAppRegion: 'no-drag' // Excludes button from window drag hook
        }}
        onMouseEnter={(e) => { if(!isStopping) e.currentTarget.style.backgroundColor = '#DC2626'; }}
        onMouseLeave={(e) => { if(!isStopping) e.currentTarget.style.backgroundColor = '#EF4444'; }}
      >
        <div style={{ width: '8px', height: '8px', borderRadius: '1px', backgroundColor: '#FFFFFF' }} />
        {isStopping ? 'Saving...' : 'Stop'}
      </button>
    </div>
  );
}
