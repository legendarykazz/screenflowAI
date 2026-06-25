import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Clapperboard,
  Crown,
  Focus,
  Gauge,
  Laptop,
  Mic,
  Monitor,
  MousePointer2,
  Play,
  RefreshCw,
  Sparkles,
  Square,
  Timer,
  Volume2,
  Wand2
} from 'lucide-react';

const cursorColors = ['#FF4D7E', '#00E0FF', '#FFB800', '#00C48C', '#7C3AED'];

const cinematicPresets = [
  {
    id: 'cinematic',
    name: 'Cinematic Focus',
    description: 'Smooth zooms, click ripples, soft cursor glow',
    settings: {
      zoom_level: 1.65,
      cursor_scale: 1.25,
      cursor_highlight: 'both',
      cursor_size: 42,
      background_type: 'gradient',
      background_value: 'linear-gradient(135deg, #151A2D 0%, #2A1F4C 45%, #FF4D7E 100%)'
    }
  },
  {
    id: 'product',
    name: 'Product Demo',
    description: 'Clean canvas, tighter zooms, crisp click emphasis',
    settings: {
      zoom_level: 1.45,
      cursor_scale: 1.15,
      cursor_highlight: 'ripple',
      cursor_size: 38,
      background_type: 'solid',
      background_value: '#F8FAFF'
    }
  },
  {
    id: 'tutorial',
    name: 'Tutorial Calm',
    description: 'Gentle motion and readable instructional pacing',
    settings: {
      zoom_level: 1.35,
      cursor_scale: 1.05,
      cursor_highlight: 'spotlight',
      cursor_size: 36,
      background_type: 'gradient',
      background_value: 'linear-gradient(135deg, #0F172A 0%, #14532D 100%)'
    }
  }
];

export default function Recording({ onOpenProject, license }) {
  const [recordingMode, setRecordingMode] = useState('Fullscreen');
  const [sources, setSources] = useState([]);
  const [selectedSource, setSelectedSource] = useState(null);
  const [microphones, setMicrophones] = useState([]);
  const [selectedMic, setSelectedMic] = useState('default');
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('default');
  const [systemAudio, setSystemAudio] = useState(true);
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const [cursorColor, setCursorColor] = useState('#FF4D7E');
  const [presetId, setPresetId] = useState('cinematic');
  const [resolution, setResolution] = useState('1080p - 60fps');
  const [countdown, setCountdown] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Ready to capture a polished screen recording.');
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordTimeRef = useRef(0);
  const timerIntervalRef = useRef(null);
  const trackingEventsRef = useRef([]);

  const activePreset = cinematicPresets.find((preset) => preset.id === presetId) || cinematicPresets[0];
  const isPro = license?.plan === 'pro';

  useEffect(() => {
    loadDevices();
    return () => {
      stopStreams();
      clearInterval(timerIntervalRef.current);
    };
  }, []);

  const loadDevices = async () => {
    if (window.electron?.getSources) {
      const srcList = await window.electron.getSources();
      setSources(srcList);
      if (srcList.length > 0) setSelectedSource(srcList[0].id);
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter((device) => device.kind === 'audioinput');
      const cams = devices.filter((device) => device.kind === 'videoinput');
      setMicrophones(mics);
      setCameras(cams);
      if (mics.length > 0) setSelectedMic(mics[0].deviceId);
      if (cams.length > 0) setSelectedCamera(cams[0].deviceId);
    } catch (error) {
      console.warn('Failed to list media devices:', error);
    }
  };

  const stopStreams = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const buildProjectSettings = () => ({
    ...activePreset.settings,
    cursor_color: cursorColor,
    cursor_visible: showCursor,
    recording_mode: recordingMode,
    recording_source: selectedSource,
    cinematic_preset: presetId,
    resolution,
    system_audio: systemAudio,
    webcam_enabled: webcamEnabled,
    auto_zoom: true,
    auto_smooth_cursor: true,
    click_emphasis: showCursor ? activePreset.settings.cursor_highlight : 'none'
  });

  const getMimeType = () => {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    return types.find((type) => MediaRecorder.isTypeSupported(type)) || '';
  };

  const handleStart = async () => {
    if (isRecording) return;

    chunksRef.current = [];
    trackingEventsRef.current = [];
    recordTimeRef.current = 0;
    setRecordTime(0);
    setStatusMessage(countdown ? 'Choose the screen or window, then capture begins.' : 'Choose the screen or window to capture.');

    try {
      let screenStream;
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: resolution.includes('60fps') ? 60 : 30
          },
          audio: systemAudio
        });
      } catch (err) {
        throw new Error(`Screen capture failed: ${err.message}`);
      }

      const combinedTracks = [...screenStream.getVideoTracks(), ...screenStream.getAudioTracks()];

      try {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: selectedMic === 'default' ? true : { deviceId: selectedMic }
        });
        combinedTracks.push(...micStream.getAudioTracks());
      } catch (error) {
        console.warn('Microphone capture bypassed or failed:', error);
      }

      if (webcamEnabled) {
        try {
          const cameraStream = await navigator.mediaDevices.getUserMedia({
            video: selectedCamera === 'default' ? true : { deviceId: selectedCamera }
          });
          cameraStream.getTracks().forEach((track) => track.stop());
        } catch (error) {
          console.warn('Webcam preview permission bypassed or failed:', error);
        }
      }

      const combinedStream = new MediaStream(combinedTracks);
      streamRef.current = combinedStream;

      const mimeType = getMimeType();
      const mediaRecorder = new MediaRecorder(combinedStream, mimeType ? { mimeType } : undefined);
      recorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data?.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        if (chunksRef.current.length === 0) {
          setStatusMessage('Recording failed: No video data was captured. Please check screen permissions.');
          setIsRecording(false);
          return;
        }
        
        setStatusMessage('Saving capture and preparing cinematic edit...');
        const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        if (!window.electron?.saveRecordedFile) {
          setStatusMessage('Recording finished, but file saving is unavailable in this preview.');
          return;
        }

        const res = await window.electron.saveRecordedFile(uint8Array);
        if (!res.success) {
          setStatusMessage(`Could not save recording: ${res.error}`);
          return;
        }

        const project = await window.electron.createProject(`Cinematic Recording - ${new Date().toLocaleTimeString()}`);
        const settings = buildProjectSettings();

        await window.electron.updateProject(project.id, {
          video_path: res.filePath,
          duration: recordTimeRef.current,
          ...settings,
          settings
        });
        await window.electron.saveCursorEvents(project.id, trackingEventsRef.current);
        setStatusMessage('Capture saved. Opening editor...');
        onOpenProject(project.id);
      };

      await window.electron?.startRecording?.(buildProjectSettings());

      mediaRecorder.start(100);
      setIsRecording(true);
      setStatusMessage('Recording cursor movement, clicks, audio, and screen motion.');

      timerIntervalRef.current = setInterval(() => {
        recordTimeRef.current += 1;
        setRecordTime(recordTimeRef.current);
      }, 1000);
    } catch (error) {
      console.error('Recording initialization failed:', error);
      setStatusMessage(`Could not start recording: ${error.message}`);
    }
  };

  const handleStop = async () => {
    if (!isRecording) return;

    clearInterval(timerIntervalRef.current);
    setIsRecording(false);
    setStatusMessage('Stopping capture and collecting cursor events...');

    // Await electron stop first to ensure trackingEventsRef is fully populated
    if (window.electron?.stopRecording) {
      const res = await window.electron.stopRecording();
      if (res?.events) trackingEventsRef.current = res.events;
    }

    // Stop recorder properly to flush final video chunks
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    
    // Stop camera/screen hardware tracks AFTER recorder closes
    setTimeout(stopStreams, 500);
  };

  const formatTime = (sec) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const controlCard = {
    background: '#FFFFFF',
    border: '1px solid #E5EAF4',
    borderRadius: '8px',
    boxShadow: '0 10px 28px rgba(15, 23, 42, 0.06)'
  };

  return (
    <div style={{
      background: '#F6F8FC',
      color: '#172033',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-sans)',
      gap: '24px',
      margin: '-32px',
      minHeight: '100%',
      padding: '28px 32px'
    }}>
      <header style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', gap: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 800 }}>
            Cinematic Recorder
          </h1>
          <p style={{ color: '#5A657B', fontSize: '14px', marginTop: '4px' }}>
            Capture your screen with cursor data, audio, and zoom-ready edit settings.
          </p>
        </div>
        <button
          onClick={loadDevices}
          style={{
            alignItems: 'center',
            background: '#FFFFFF',
            border: '1px solid #D9E1EF',
            borderRadius: '8px',
            color: '#26344D',
            cursor: 'pointer',
            display: 'inline-flex',
            fontWeight: 700,
            gap: '8px',
            padding: '10px 14px'
          }}
        >
          <RefreshCw size={16} />
          Refresh Devices
        </button>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: '24px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ ...controlCard, padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 800 }}>Capture Source</h2>
                <p style={{ color: '#647087', fontSize: '13px', marginTop: '3px' }}>Pick how the recording starts. The system picker appears after Start.</p>
              </div>
              <Clapperboard size={22} color="#7C3AED" />
            </div>

            <div style={{ background: '#EEF2F8', borderRadius: '8px', display: 'grid', gap: '6px', gridTemplateColumns: 'repeat(3, 1fr)', padding: '6px' }}>
              {[
                ['Fullscreen', Monitor],
                ['Window', Laptop],
                ['Custom Area', Focus]
              ].map(([mode, Icon]) => (
                <button
                  key={mode}
                  onClick={() => setRecordingMode(mode)}
                  style={{
                    alignItems: 'center',
                    background: recordingMode === mode ? '#FFFFFF' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    boxShadow: recordingMode === mode ? '0 4px 12px rgba(15, 23, 42, 0.08)' : 'none',
                    color: recordingMode === mode ? '#172033' : '#647087',
                    cursor: 'pointer',
                    display: 'flex',
                    fontWeight: 800,
                    gap: '8px',
                    justifyContent: 'center',
                    minHeight: '44px'
                  }}
                >
                  <Icon size={16} />
                  {mode}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '18px' }}>
              <Field label="Detected Source">
                <select value={selectedSource || ''} onChange={(event) => setSelectedSource(event.target.value)} style={selectStyle}>
                  {sources.length > 0 ? sources.map((source) => (
                    <option key={source.id} value={source.id}>{source.name}</option>
                  )) : (
                    <option value="">Browser screen picker</option>
                  )}
                </select>
              </Field>
              <Field label="Resolution">
                <select value={resolution} onChange={(event) => setResolution(event.target.value)} style={selectStyle}>
                  <option>1080p - 60fps</option>
                  <option>1080p - 30fps</option>
                  <option>4K UHD - 30fps</option>
                </select>
              </Field>
            </div>
          </div>

          <div style={{ ...controlCard, padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 800 }}>Cinematic Treatment</h2>
                <p style={{ color: '#647087', fontSize: '13px', marginTop: '3px' }}>These settings are saved into the project for zooms, cursor styling, and export composition.</p>
              </div>
              <Wand2 size={22} color="#FF4D7E" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {cinematicPresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setPresetId(preset.id)}
                  style={{
                    background: presetId === preset.id ? '#181F33' : '#F8FAFF',
                    border: `1px solid ${presetId === preset.id ? '#181F33' : '#E2E8F0'}`,
                    borderRadius: '8px',
                    color: presetId === preset.id ? '#FFFFFF' : '#172033',
                    cursor: 'pointer',
                    minHeight: '118px',
                    padding: '14px',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <Sparkles size={17} color={presetId === preset.id ? '#FFB800' : '#7C3AED'} />
                    {presetId === preset.id && <Check size={16} />}
                  </div>
                  <strong style={{ display: 'block', fontSize: '14px' }}>{preset.name}</strong>
                  <span style={{ color: presetId === preset.id ? '#C9D2E6' : '#647087', display: 'block', fontSize: '12px', lineHeight: 1.45, marginTop: '6px' }}>
                    {preset.description}
                  </span>
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginTop: '20px' }}>
              <ToggleRow checked={showCursor} icon={MousePointer2} label="Record cursor path" onChange={setShowCursor} />
              <ToggleRow checked={countdown} icon={Timer} label="Countdown before capture" onChange={setCountdown} />
            </div>

            {showCursor && (
              <div style={{ borderTop: '1px solid #EDF1F7', marginTop: '18px', paddingTop: '18px' }}>
                <span style={{ color: '#26344D', display: 'block', fontSize: '13px', fontWeight: 800, marginBottom: '10px' }}>Cursor highlight color</span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {cursorColors.map((color) => (
                    <button
                      aria-label={`Use cursor color ${color}`}
                      key={color}
                      onClick={() => setCursorColor(color)}
                      style={{
                        background: color,
                        border: cursorColor === color ? '3px solid #172033' : '3px solid #FFFFFF',
                        borderRadius: '999px',
                        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.14)',
                        cursor: 'pointer',
                        height: '30px',
                        width: '30px'
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ ...controlCard, padding: '22px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Field icon={Mic} label="Microphone">
                <select value={selectedMic} onChange={(event) => setSelectedMic(event.target.value)} style={selectStyle}>
                  {microphones.length > 0 ? microphones.map((mic) => (
                    <option key={mic.deviceId} value={mic.deviceId}>{mic.label || `Microphone ${mic.deviceId.slice(0, 5)}`}</option>
                  )) : (
                    <option value="default">Default microphone</option>
                  )}
                </select>
              </Field>
              <Field icon={Camera} label="Webcam">
                <select disabled={!webcamEnabled} value={selectedCamera} onChange={(event) => setSelectedCamera(event.target.value)} style={{ ...selectStyle, opacity: webcamEnabled ? 1 : 0.55 }}>
                  {cameras.length > 0 ? cameras.map((camera) => (
                    <option key={camera.deviceId} value={camera.deviceId}>{camera.label || `Camera ${camera.deviceId.slice(0, 5)}`}</option>
                  )) : (
                    <option value="default">Default camera</option>
                  )}
                </select>
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginTop: '18px' }}>
              <ToggleRow checked={systemAudio} icon={Volume2} label="System audio" onChange={setSystemAudio} />
              <ToggleRow checked={webcamEnabled} icon={Camera} label="Webcam overlay" onChange={setWebcamEnabled} />
            </div>
          </div>
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ ...controlCard, overflow: 'hidden' }}>
            <div style={{
              background: activePreset.settings.background_value,
              color: '#FFFFFF',
              minHeight: '190px',
              padding: '22px',
              position: 'relative'
            }}>
              <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ background: 'rgba(255,255,255,0.16)', borderRadius: '999px', fontSize: '12px', fontWeight: 800, padding: '7px 10px' }}>
                  {activePreset.name}
                </span>
                {isPro ? <Crown size={18} /> : <Gauge size={18} />}
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.9)',
                borderRadius: '8px',
                bottom: '22px',
                boxShadow: '0 18px 40px rgba(0,0,0,0.24)',
                height: '74px',
                left: '22px',
                position: 'absolute',
                right: '22px'
              }}>
                <div style={{ background: '#E5EAF4', borderRadius: '6px', height: '10px', left: '14px', position: 'absolute', right: '72px', top: '16px' }} />
                <div style={{ background: cursorColor, borderRadius: '999px', height: '18px', left: '58%', position: 'absolute', top: '38px', width: '18px' }} />
              </div>
            </div>

            <div style={{ padding: '24px', textAlign: 'center' }}>
              <span style={{ color: '#647087', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}>Capture Timer</span>
              <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '42px', fontWeight: 900, marginTop: '8px' }}>
                {formatTime(recordTime)}
              </div>
              <p style={{ color: '#647087', fontSize: '13px', lineHeight: 1.45, margin: '8px 0 18px' }}>{statusMessage}</p>

              {isRecording ? (
                <button onClick={handleStop} style={recordButtonStyle('#EF4444')}>
                  <Square size={17} fill="#FFFFFF" />
                  Stop Recording
                </button>
              ) : (
                <button onClick={handleStart} style={recordButtonStyle('#FF4D7E')}>
                  <Play size={17} fill="#FFFFFF" />
                  Start Cinematic Capture
                </button>
              )}
            </div>
          </div>

          <div style={{ ...controlCard, padding: '18px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 900, marginBottom: '12px' }}>What gets saved</h3>
            {[
              'Screen video as editable project media',
              'Mouse movement timeline and click moments',
              'Auto zoom and cursor styling preset',
              'Audio and webcam choices for the edit'
            ].map((item) => (
              <div key={item} style={{ alignItems: 'center', display: 'flex', gap: '10px', marginTop: '10px' }}>
                <Check size={15} color="#00A878" />
                <span style={{ color: '#4E5A70', fontSize: '13px', lineHeight: 1.35 }}>{item}</span>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}

function Field({ children, icon: Icon, label }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <span style={{ alignItems: 'center', color: '#26344D', display: 'inline-flex', fontSize: '13px', fontWeight: 800, gap: '7px' }}>
        {Icon && <Icon size={15} />}
        {label}
      </span>
      {children}
    </label>
  );
}

function ToggleRow({ checked, icon: Icon, label, onChange }) {
  return (
    <label style={{
      alignItems: 'center',
      background: checked ? '#F4F0FF' : '#F8FAFF',
      border: `1px solid ${checked ? '#D8C9FF' : '#E2E8F0'}`,
      borderRadius: '8px',
      cursor: 'pointer',
      display: 'flex',
      gap: '12px',
      justifyContent: 'space-between',
      minHeight: '54px',
      padding: '12px 14px'
    }}>
      <span style={{ alignItems: 'center', color: '#26344D', display: 'inline-flex', fontSize: '13px', fontWeight: 800, gap: '9px' }}>
        <Icon size={16} color={checked ? '#7C3AED' : '#647087'} />
        {label}
      </span>
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
    </label>
  );
}

const selectStyle = {
  background: '#FFFFFF',
  border: '1px solid #DCE3EF',
  borderRadius: '8px',
  color: '#172033',
  fontSize: '14px',
  fontWeight: 700,
  minHeight: '44px',
  outline: 'none',
  padding: '0 12px',
  width: '100%'
};

const recordButtonStyle = (background) => ({
  alignItems: 'center',
  background,
  border: 'none',
  borderRadius: '8px',
  color: '#FFFFFF',
  cursor: 'pointer',
  display: 'inline-flex',
  fontSize: '14px',
  fontWeight: 900,
  gap: '9px',
  justifyContent: 'center',
  minHeight: '50px',
  padding: '0 18px',
  width: '100%'
});
