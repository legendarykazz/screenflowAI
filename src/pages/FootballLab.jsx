import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  CircleDot,
  Download,
  Eraser,
  Maximize2,
  Minimize2,
  Monitor,
  Footprints,
  MousePointer2,
  MoveRight,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Route,
  Square,
  Trash2,
  Upload,
  Video
} from 'lucide-react';

const formations = {
  '4-3-3': [
    ['GK', 8, 50], ['LB', 22, 18], ['LCB', 21, 40], ['RCB', 21, 60], ['RB', 22, 82],
    ['LCM', 38, 32], ['DM', 35, 50], ['RCM', 38, 68], ['LW', 58, 22], ['ST', 65, 50], ['RW', 58, 78]
  ],
  '4-2-3-1': [
    ['GK', 8, 50], ['LB', 22, 18], ['LCB', 21, 40], ['RCB', 21, 60], ['RB', 22, 82],
    ['LDM', 35, 42], ['RDM', 35, 58], ['LW', 52, 24], ['AM', 55, 50], ['RW', 52, 76], ['ST', 68, 50]
  ],
  '3-5-2': [
    ['GK', 8, 50], ['LCB', 21, 32], ['CB', 20, 50], ['RCB', 21, 68],
    ['LWB', 42, 14], ['LCM', 40, 36], ['DM', 36, 50], ['RCM', 40, 64], ['RWB', 42, 86],
    ['LS', 64, 42], ['RS', 64, 58]
  ],
  '4-4-2': [
    ['GK', 8, 50], ['LB', 22, 18], ['LCB', 21, 40], ['RCB', 21, 60], ['RB', 22, 82],
    ['LM', 43, 22], ['LCM', 39, 42], ['RCM', 39, 58], ['RM', 43, 78], ['LS', 63, 42], ['RS', 63, 58]
  ]
};

const toolConfig = {
  select: { label: 'Select', icon: MousePointer2, color: '#334155' },
  pen: { label: 'Free pen', icon: Pencil, color: '#00A878' },
  var: { label: 'VAR line', icon: MoveRight, color: '#FACC15' },
  pass: { label: 'Pass direction', icon: ArrowRight, color: '#00A878' },
  run: { label: 'Player run', icon: Route, color: '#2563EB' },
  move: { label: 'Could go', icon: MoveRight, color: '#F59E0B' },
  defend: { label: 'Defence direction', icon: CircleDot, color: '#EF4444' },
  press: { label: 'Press trigger', icon: CircleDot, color: '#DC2626' }
};

const reactionPresets = {
  coach: { label: 'Coach breakdown', webcamSize: 0.2, webcamPosition: 'bottom-right', mic: true, systemAudio: true },
  creator: { label: 'Creator reaction', webcamSize: 0.28, webcamPosition: 'bottom-left', mic: true, systemAudio: true },
  voiceover: { label: 'Voiceover only', webcamSize: 0, webcamPosition: 'bottom-right', mic: true, systemAudio: true }
};

const sampleActions = [
  { id: 'sample-1', type: 'pass', label: 'Split pass', start: { x: 31, y: 55 }, end: { x: 56, y: 42 }, time: 4.2, duration: 3, color: '#00A878', strokeWidth: 5 },
  { id: 'sample-2', type: 'run', label: 'Overlap run', start: { x: 58, y: 66 }, end: { x: 79, y: 52 }, time: 5.1, duration: 3, color: '#2563EB', strokeWidth: 4 },
  { id: 'sample-3', type: 'press', label: 'Press trigger', start: { x: 43, y: 36 }, end: { x: 43, y: 36 }, time: 6.3, duration: 2.5, color: '#EF4444', strokeWidth: 5 }
];

function buildTeam(teamKey, formationName) {
  const isHome = teamKey === 'home';
  return formations[formationName].map(([role, x, y], index) => ({
    id: `${teamKey}-${index + 1}`,
    number: index + 1,
    role,
    team: teamKey,
    base: {
      x: isHome ? x : 100 - x,
      y: isHome ? y : 100 - y
    },
    target: {
      x: isHome ? x : 100 - x,
      y: isHome ? y : 100 - y
    }
  }));
}

export default function FootballLab() {
  const [videoUrl, setVideoUrl] = useState('');
  const [videoName, setVideoName] = useState('No match video loaded');
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTool, setActiveTool] = useState('pen');
  const [actions, setActions] = useState(sampleActions);
  const [draftStart, setDraftStart] = useState(null);
  const [draftPath, setDraftPath] = useState([]);
  const [selectedActionId, setSelectedActionId] = useState(null);
  const [note, setNote] = useState('Build tactical edits by dragging on the video: pass here, run here, move here, press here.');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [slowSegments, setSlowSegments] = useState([]);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [homeFormation, setHomeFormation] = useState('4-3-3');
  const [awayFormation, setAwayFormation] = useState('4-2-3-1');
  const [players, setPlayers] = useState([
    ...buildTeam('home', '4-3-3'),
    ...buildTeam('away', '4-2-3-1')
  ]);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [draggingPlayerId, setDraggingPlayerId] = useState(null);
  const [simulationPhase, setSimulationPhase] = useState('base');
  const [showFormations, setShowFormations] = useState(false);
  const [showPitchGuide, setShowPitchGuide] = useState(false);
  const [showTacticalLayers, setShowTacticalLayers] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomAnchor, setZoomAnchor] = useState({ x: 50, y: 50 });
  const [reactionPresetId, setReactionPresetId] = useState('coach');
  const [webcamEnabled, setWebcamEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [systemAudioEnabled, setSystemAudioEnabled] = useState(true);
  const [isReactionRecording, setIsReactionRecording] = useState(false);
  const [recordedReactionUrl, setRecordedReactionUrl] = useState('');
  const [savedRecordingPath, setSavedRecordingPath] = useState('');
  const [recordingStatus, setRecordingStatus] = useState('Ready to record your football reaction.');

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const stageRef = useRef(null);
  const reviewShellRef = useRef(null);
  const webcamPreviewRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const captureStreamsRef = useRef([]);
  const cameraPreviewStreamRef = useRef(null);

  const selectedAction = useMemo(
    () => actions.find((action) => action.id === selectedActionId) || null,
    [actions, selectedActionId]
  );

  const selectedPlayer = useMemo(
    () => players.find((player) => player.id === selectedPlayerId) || null,
    [players, selectedPlayerId]
  );

  const visibleActions = useMemo(
    () => actions,
    [actions]
  );

  const reactionPreset = reactionPresets[reactionPresetId];

  useEffect(() => {
    return () => {
      captureStreamsRef.current.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
      cameraPreviewStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (recordedReactionUrl?.startsWith('blob:')) URL.revokeObjectURL(recordedReactionUrl);
    };
  }, [recordedReactionUrl]);

  useEffect(() => {
    let cancelled = false;

    const startWebcamPreview = async () => {
      if (!webcamEnabled || reactionPreset.webcamSize <= 0 || !navigator.mediaDevices?.getUserMedia) {
        cameraPreviewStreamRef.current?.getTracks().forEach((track) => track.stop());
        cameraPreviewStreamRef.current = null;
        if (webcamPreviewRef.current) webcamPreviewRef.current.srcObject = null;
        return;
      }

      if (cameraPreviewStreamRef.current) {
        if (webcamPreviewRef.current) webcamPreviewRef.current.srcObject = cameraPreviewStreamRef.current;
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        cameraPreviewStreamRef.current = stream;
        if (webcamPreviewRef.current) webcamPreviewRef.current.srcObject = stream;
      } catch (error) {
        setWebcamEnabled(false);
        setRecordingStatus(`Webcam preview could not start: ${error.message}`);
      }
    };

    startWebcamPreview();

    return () => {
      cancelled = true;
    };
  }, [reactionPreset.webcamSize, webcamEnabled]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedActionId) {
        event.preventDefault();
        deleteSelected();
      }
      if (event.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, selectedActionId]);

  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (videoUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(videoUrl);
    }

    const nextUrl = URL.createObjectURL(file);
    setVideoUrl(nextUrl);
    setVideoName(file.name);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setShowFormations(false);
    setShowPitchGuide(false);
    setShowTacticalLayers(true);
    setNote('Match loaded. Pause at a moment, draw tactical layers, then edit timing/style from the right panel.');
  };

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    if (video.paused) {
      await video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const setVideoSpeed = (speed) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setNote(`Playback speed set to ${speed}x.`);
  };

  const setReviewZoom = (level) => {
    setZoomLevel(level);
    setNote(level === 1 ? 'Review zoom reset.' : `Review zoom set to ${level}x. Click the video to move the zoom focus.`);
  };

  const getPointFromEvent = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))
    };
  };

  const handleBoardPointerDown = (event) => {
    setZoomAnchor(getPointFromEvent(event));
    if (draggingPlayerId) return;
    const point = getPointFromEvent(event);

    if (activeTool === 'select') {
      setSelectedActionId(null);
      return;
    }

    if (activeTool === 'pen') {
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setDraftPath([point]);
      setDraftStart(point);
      return;
    }

    setDraftStart(point);
  };

  const handleBoardPointerUp = (event) => {
    if (draggingPlayerId) {
      handleBoardPointerRelease();
      return;
    }

    if (!draftStart || activeTool === 'select') return;

    const rawEnd = getPointFromEvent(event);
    const end = activeTool === 'var'
      ? { x: draftStart.x, y: rawEnd.y }
      : rawEnd;
    const points = activeTool === 'pen' ? [...draftPath, end] : undefined;
    const action = {
      id: `${activeTool}-${Date.now()}`,
      type: activeTool,
      label: toolConfig[activeTool].label,
      start: draftStart,
      end,
      points,
      time: Number((videoRef.current?.currentTime || currentTime || 0).toFixed(2)),
      duration: activeTool === 'press' ? 2 : 3,
      color: toolConfig[activeTool].color,
      strokeWidth: activeTool === 'pen' ? 6 : (activeTool === 'run' || activeTool === 'defend' ? 4 : 5)
    };

    setActions((prev) => [...prev, action]);
    setSelectedActionId(action.id);
    setDraftStart(null);
    setDraftPath([]);
    setNote(`${toolConfig[activeTool].label} instruction added at ${formatTime(action.time)}.`);
  };

  const deleteSelected = () => {
    if (!selectedActionId) return;
    setActions((prev) => prev.filter((action) => action.id !== selectedActionId));
    setSelectedActionId(null);
    setNote('Selected tactical instruction deleted.');
  };

  const applyFormation = (teamKey, formationName) => {
    if (teamKey === 'home') setHomeFormation(formationName);
    if (teamKey === 'away') setAwayFormation(formationName);
    setPlayers((prev) => [
      ...prev.filter((player) => player.team !== teamKey),
      ...buildTeam(teamKey, formationName)
    ]);
    setSelectedPlayerId(null);
    setNote(`${teamKey === 'home' ? 'Home' : 'Away'} team changed to ${formationName}.`);
  };

  const resetShape = () => {
    setPlayers((prev) => prev.map((player) => ({ ...player, target: { ...player.base } })));
    setSimulationPhase('base');
    setNote('Tactical movement targets reset to formation shape.');
  };

  const handlePlayerPointerDown = (event, playerId) => {
    event.stopPropagation();
    if (activeTool !== 'select') return;
    setDraggingPlayerId(playerId);
    setSelectedPlayerId(playerId);
    setSelectedActionId(null);
  };

  const handleBoardPointerMove = (event) => {
    if (activeTool === 'pen' && draftStart) {
      const point = getPointFromEvent(event);
      setDraftPath((prev) => {
        const last = prev[prev.length - 1];
        if (last && Math.abs(last.x - point.x) < 0.35 && Math.abs(last.y - point.y) < 0.35) return prev;
        return [...prev, point];
      });
      return;
    }

    if (!draggingPlayerId) return;
    const point = getPointFromEvent(event);
    setPlayers((prev) => prev.map((player) => (
      player.id === draggingPlayerId
        ? { ...player, target: point }
        : player
    )));
  };

  const handleBoardPointerRelease = () => {
    if (!draggingPlayerId) return;
    setDraggingPlayerId(null);
    setSimulationPhase('target');
    setNote('Movement target updated. Toggle Base/Movement to simulate the tactical shift.');
  };

  const updateSelectedRole = (role) => {
    if (!selectedPlayerId) return;
    setPlayers((prev) => prev.map((player) => (
      player.id === selectedPlayerId ? { ...player, role } : player
    )));
  };

  const updateSelectedAction = (fields) => {
    if (!selectedActionId) return;
    setActions((prev) => prev.map((action) => (
      action.id === selectedActionId ? { ...action, ...fields } : action
    )));
  };

  const addSlowSegment = () => {
    const start = Math.max(0, Number((currentTime - 1).toFixed(2)));
    const segment = {
      id: `slow-${Date.now()}`,
      start,
      end: Number((start + 3).toFixed(2)),
      speed: playbackSpeed === 1 ? 0.5 : playbackSpeed
    };
    setSlowSegments((prev) => [...prev, segment]);
    setNote(`${segment.speed < 1 ? 'Slow-motion' : 'Fast-motion'} segment added from ${formatTime(segment.start)} to ${formatTime(segment.end)}.`);
  };

  const removeSlowSegment = (id) => {
    setSlowSegments((prev) => prev.filter((segment) => segment.id !== id));
  };

  const handleTimeUpdate = (event) => {
    const time = event.currentTarget.currentTime;
    setCurrentTime(time);
    const activeSlow = slowSegments.find((segment) => time >= segment.start && time <= segment.end);
    event.currentTarget.playbackRate = activeSlow ? activeSlow.speed : playbackSpeed;
  };

  const seekTo = (time) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Number(time);
    setCurrentTime(Number(time));
  };

  const exportPlan = () => {
    const payload = {
      videoName,
      exportedAt: new Date().toISOString(),
      formations: {
        home: homeFormation,
        away: awayFormation
      },
      players,
      actions,
      slowSegments,
      reactionPreset: reactionPresetId,
      zoomLevel
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${videoName.replace(/\.[^.]+$/, '') || 'football-edit'}-analysis.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNote('Tactical edit plan exported as JSON.');
  };

  const toggleFullscreen = async () => {
    const next = !isFullscreen;
    setIsFullscreen(next);
    if (next) {
      try {
        await reviewShellRef.current?.requestFullscreen?.();
      } catch {
        // The fixed theatre layout still works when native fullscreen is blocked.
      }
    } else if (document.fullscreenElement && document.exitFullscreen) {
      try {
        await document.exitFullscreen();
      } catch {
        // Ignore native fullscreen exit errors; the in-app state still exits.
      }
    }
    setNote(next ? 'Big screen review mode opened with recording controls beside the video.' : 'Returned to normal football edit layout.');
  };

  const getSupportedMimeType = () => {
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    return types.find((type) => window.MediaRecorder?.isTypeSupported(type)) || '';
  };

  const startReactionRecording = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setRecordingStatus('Screen recording is not available in this browser.');
      return;
    }

    try {
      setRecordingStatus('Choose this app window or your full screen to record the analysis.');
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: systemAudioEnabled
      });
      const streams = [displayStream];
      const tracks = [...displayStream.getVideoTracks(), ...displayStream.getAudioTracks()];

      if (micEnabled) {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        streams.push(micStream);
        tracks.push(...micStream.getAudioTracks());
      }

      if (webcamEnabled && reactionPreset.webcamSize > 0 && !cameraPreviewStreamRef.current) {
        const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        cameraPreviewStreamRef.current = cameraStream;
        if (webcamPreviewRef.current) webcamPreviewRef.current.srcObject = cameraStream;
      }

      const recordingStream = new MediaStream(tracks);
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(recordingStream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 8000000
      });

      recordedChunksRef.current = [];
      captureStreamsRef.current = streams;
      mediaRecorderRef.current = recorder;
      setSavedRecordingPath('');

      recorder.ondataavailable = (event) => {
        if (event.data?.size) recordedChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        if (recordedReactionUrl?.startsWith('blob:')) URL.revokeObjectURL(recordedReactionUrl);
        setRecordedReactionUrl(url);

        if (window.electron?.saveRecordedFile) {
          const buffer = await blob.arrayBuffer();
          const result = await window.electron.saveRecordedFile(buffer);
          if (result?.success) {
            setSavedRecordingPath(result.filePath);
            setRecordingStatus(`Saved locally: ${result.filePath}`);
          } else {
            setRecordingStatus(`Recording preview is ready, but local save failed: ${result?.error || 'Unknown error'}`);
          }
        } else {
          setRecordingStatus('Reaction recording ready for preview.');
        }

        captureStreamsRef.current.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
        captureStreamsRef.current = [];
        if (webcamPreviewRef.current && cameraPreviewStreamRef.current) webcamPreviewRef.current.srcObject = cameraPreviewStreamRef.current;
      };

      recorder.start(1000);
      setIsReactionRecording(true);
      setRecordingStatus('Recording reaction. Press Stop Reaction Recording to save it locally.');
      displayStream.getVideoTracks()[0].addEventListener('ended', stopReactionRecording);
    } catch (error) {
      setRecordingStatus(`Could not start reaction recording: ${error.message}`);
      captureStreamsRef.current.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
      captureStreamsRef.current = [];
    }
  };

  const stopReactionRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsReactionRecording(false);
    setRecordingStatus('Finishing reaction recording...');
  };

  const renderPlayer = (player) => {
    const isSelected = player.id === selectedPlayerId;
    const color = player.team === 'home' ? '#2563EB' : '#EF4444';
    const current = simulationPhase === 'target' ? player.target : player.base;
    const hasMovement = Math.abs(player.target.x - player.base.x) > 1 || Math.abs(player.target.y - player.base.y) > 1;
    const dx = player.target.x - player.base.x;
    const dy = player.target.y - player.base.y;
    const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    return (
      <React.Fragment key={player.id}>
        {hasMovement && (
          <span
            style={{
              background: `${color}99`,
              borderRadius: 999,
              height: 3,
              left: `${player.base.x}%`,
              pointerEvents: 'none',
              position: 'absolute',
              top: `${player.base.y}%`,
              transform: `rotate(${angle}deg)`,
              transformOrigin: '0 50%',
              width: `${length}%`,
              zIndex: 3
            }}
          />
        )}
        <button
          onPointerDown={(event) => handlePlayerPointerDown(event, player.id)}
          style={{
            alignItems: 'center',
            background: color,
            border: isSelected ? '3px solid #FFFFFF' : '2px solid rgba(255,255,255,0.9)',
            borderRadius: '999px',
            boxShadow: isSelected ? `0 0 0 5px ${color}44` : '0 8px 16px rgba(0,0,0,0.28)',
            color: '#FFFFFF',
            cursor: 'grab',
            display: 'flex',
            flexDirection: 'column',
            fontSize: 10,
            fontWeight: 900,
            height: 38,
            justifyContent: 'center',
            left: `${current.x}%`,
            lineHeight: 1,
            padding: 0,
            pointerEvents: activeTool === 'select' ? 'auto' : 'none',
            position: 'absolute',
            top: `${current.y}%`,
            transform: 'translate(-50%, -50%)',
            transition: draggingPlayerId === player.id ? 'none' : 'left 0.35s ease, top 0.35s ease',
            width: 38,
            zIndex: isSelected ? 10 : 8
          }}
          title={`${player.team} ${player.role}`}
        >
          <span>{player.number}</span>
          <span style={{ fontSize: 8, marginTop: 2 }}>{player.role}</span>
        </button>
      </React.Fragment>
    );
  };

  const formatTime = (seconds) => {
    const safe = Number.isFinite(seconds) ? seconds : 0;
    const mins = Math.floor(safe / 60);
    const secs = Math.floor(safe % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderAction = (action) => {
    const cfg = { ...(toolConfig[action.type] || toolConfig.move), color: action.color || (toolConfig[action.type] || toolConfig.move).color };
    const isSelected = selectedActionId === action.id;
    const dx = action.end.x - action.start.x;
    const dy = action.end.y - action.start.y;
    const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const isPoint = action.type === 'press' || length < 3;
    const isDashed = action.type === 'defend';
    const strokeWidth = action.strokeWidth || (action.type === 'run' ? 4 : 5);
    const markerId = `arrow-${action.id}`;
    const points = action.points?.length ? action.points : [action.start, action.end];
    const pointString = points.map((point) => `${point.x},${point.y}`).join(' ');

    const selectAction = (event) => {
      event.stopPropagation();
      if (activeTool !== 'select') return;
      setSelectedActionId(action.id);
    };

    return (
      <svg
        key={action.id}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          height: '100%',
          inset: 0,
          overflow: 'visible',
          pointerEvents: activeTool === 'select' ? 'auto' : 'none',
          position: 'absolute',
          width: '100%',
          zIndex: isSelected ? 6 : 5
        }}
      >
        <defs>
          <marker id={markerId} markerHeight="6" markerWidth="8" orient="auto" refX="7" refY="3">
            <path d="M0,0 L8,3 L0,6 Z" fill={cfg.color} />
          </marker>
        </defs>
        {isPoint ? (
          <circle
            cx={action.start.x}
            cy={action.start.y}
            fill={`${cfg.color}33`}
            onPointerDown={selectAction}
            pointerEvents={activeTool === 'select' ? 'all' : 'none'}
            r={isSelected ? 3.2 : 2.6}
            stroke={cfg.color}
            strokeWidth={isSelected ? 0.9 : 0.65}
          />
        ) : (
          <>
            <polyline
              fill="none"
              onPointerDown={selectAction}
              pointerEvents={activeTool === 'select' ? 'stroke' : 'none'}
              points={pointString}
              stroke="transparent"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="14"
              vectorEffect="non-scaling-stroke"
            />
            {isSelected && (
              <polyline
                fill="none"
                points={pointString}
                stroke="#FFFFFF"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={(strokeWidth / 2) + 2}
                opacity="0.52"
                vectorEffect="non-scaling-stroke"
              />
            )}
            <polyline
              fill="none"
              markerEnd={action.type === 'pen' || action.type === 'var' ? undefined : `url(#${markerId})`}
              onPointerDown={selectAction}
              pointerEvents={activeTool === 'select' ? 'stroke' : 'none'}
              points={pointString}
              stroke={cfg.color}
              strokeDasharray={isDashed ? '2 2' : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={strokeWidth / 2}
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>
    );
  };

  const renderDraftPath = () => {
    if (!draftPath.length) return null;
    const cfg = toolConfig[activeTool] || toolConfig.pen;
    const pointString = draftPath.map((point) => `${point.x},${point.y}`).join(' ');
    return (
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ height: '100%', inset: 0, overflow: 'visible', pointerEvents: 'none', position: 'absolute', width: '100%', zIndex: 12 }}
      >
        <polyline
          fill="none"
          points={pointString}
          stroke={cfg.color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  };

  return (
    <div style={{
      background: isFullscreen ? '#EEF2F8' : '#F6F8FC',
      color: '#172033',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-sans)',
      gap: isFullscreen ? 0 : 18,
      margin: '-32px',
      minHeight: '100%',
      padding: isFullscreen ? 0 : '24px 28px'
    }}>
      <header style={{ alignItems: 'center', display: isFullscreen ? 'none' : 'flex', justifyContent: 'space-between', gap: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 900 }}>Football Edit Lab</h1>
          <p style={{ color: '#5A657B', fontSize: 13, marginTop: 4 }}>
            Upload match footage, draw tactical layers, edit timings, and add slow-motion moments.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input accept="video/*" onChange={handleUpload} ref={fileInputRef} style={{ display: 'none' }} type="file" />
          <button onClick={() => fileInputRef.current?.click()} style={buttonStyle('#FFFFFF', '#26344D', '#D9E1EF')}>
            <Upload size={16} /> Upload Match
          </button>
          <button onClick={toggleFullscreen} style={buttonStyle('#FFFFFF', '#26344D', '#D9E1EF')}>
            <Maximize2 size={16} /> Big Screen
          </button>
          <button onClick={exportPlan} style={buttonStyle('#172033', '#FFFFFF', '#172033')}>
            <Download size={16} /> Export Plan
          </button>
        </div>
      </header>

      <section ref={reviewShellRef} style={{
        alignItems: 'start',
        background: isFullscreen ? '#EEF2F8' : 'transparent',
        display: 'grid',
        gap: isFullscreen ? 14 : 18,
        gridTemplateColumns: isFullscreen ? 'minmax(0, 1fr) 360px' : 'minmax(0, 1fr) 320px',
        inset: isFullscreen ? 0 : 'auto',
        overflow: isFullscreen ? 'hidden' : 'visible',
        padding: isFullscreen ? 12 : 0,
        position: isFullscreen ? 'fixed' : 'relative',
        zIndex: isFullscreen ? 99999 : 'auto'
      }}>
        <div ref={stageRef} style={{
          background: '#FFFFFF',
          border: '1px solid #E1E7F2',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          height: isFullscreen ? 'calc(100vh - 24px)' : 'auto',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div
            onPointerDown={handleBoardPointerDown}
            onPointerMove={handleBoardPointerMove}
            onPointerUp={handleBoardPointerUp}
            onPointerLeave={handleBoardPointerRelease}
            style={{
              aspectRatio: isFullscreen ? 'auto' : '16 / 9',
              background: '#103B24',
              cursor: activeTool === 'select' ? 'default' : 'crosshair',
              flex: isFullscreen ? 1 : 'unset',
              height: isFullscreen ? 'auto' : 'auto',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            {videoUrl ? (
              <video
                controls={false}
                onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
                onPause={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onTimeUpdate={handleTimeUpdate}
                ref={videoRef}
                src={videoUrl}
                style={{
                  height: '100%',
                  objectFit: 'cover',
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: `${zoomAnchor.x}% ${zoomAnchor.y}%`,
                  transition: 'transform 0.18s ease',
                  width: '100%'
                }}
              />
            ) : (
              <div style={{ height: '100%', position: 'relative' }}>
                <PitchLines />
                <div style={{
                  alignItems: 'center',
                  color: '#DCEBE2',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  inset: 0,
                  justifyContent: 'center',
                  position: 'absolute'
                }}>
                  <Video size={42} />
                  <strong>Upload a real match video</strong>
                  <span style={{ color: '#B7C9C0', fontSize: 13 }}>The pitch preview stays usable for planning before video is loaded.</span>
                </div>
              </div>
            )}
            {showPitchGuide && <PitchOverlay />}
            {showFormations && players.map(renderPlayer)}
            {showTacticalLayers && visibleActions.map(renderAction)}
            {renderDraftPath()}
            {webcamEnabled && reactionPreset.webcamSize > 0 && (
              <div style={webcamOverlayStyle(reactionPreset)}>
                <video autoPlay muted playsInline ref={webcamPreviewRef} style={{ height: '100%', objectFit: 'cover', width: '100%' }} />
                <span style={{
                  background: 'rgba(15,23,42,0.72)',
                  borderRadius: 999,
                  bottom: 8,
                  color: '#FFFFFF',
                  fontSize: 10,
                  fontWeight: 900,
                  left: 8,
                  padding: '4px 7px',
                  position: 'absolute'
                }}>Live cam</span>
              </div>
            )}
            {isReactionRecording && (
              <div style={{
                alignItems: 'center',
                background: 'rgba(220,38,38,0.92)',
                borderRadius: 999,
                color: '#FFFFFF',
                display: 'flex',
                fontSize: 12,
                fontWeight: 900,
                gap: 7,
                left: 14,
                padding: '8px 11px',
                position: 'absolute',
                top: 14,
                zIndex: 20
              }}>
                <span className="recording-dot" /> Recording reaction
              </div>
            )}
          </div>

          <div style={{
            alignItems: 'center',
            borderTop: '1px solid #E7EDF6',
            display: 'flex',
            gap: 12,
            justifyContent: 'space-between',
            padding: '12px 14px'
          }}>
            <div style={{ alignItems: 'center', display: 'flex', gap: 10 }}>
              <button disabled={!videoUrl} onClick={togglePlay} style={iconButtonStyle(!videoUrl)}>
                {isPlaying ? <Pause size={17} /> : <Play size={17} />}
              </button>
              <span style={{ color: '#5A657B', fontSize: 13, fontWeight: 800 }}>{formatTime(currentTime)}</span>
              <span style={{ color: '#8A94A6', fontSize: 12 }}>{videoName}</span>
            </div>
            <div style={{ alignItems: 'center', display: 'flex', gap: 8 }}>
              <div style={{ alignItems: 'center', display: 'flex', gap: 4, marginRight: 4 }}>
                {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                  <button
                    key={speed}
                    disabled={!videoUrl}
                    onClick={() => setVideoSpeed(speed)}
                    style={{
                      ...smallButtonStyle,
                      background: playbackSpeed === speed ? '#172033' : '#FFFFFF',
                      color: playbackSpeed === speed ? '#FFFFFF' : '#26344D',
                      padding: '8px 9px'
                    }}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
              <button onClick={toggleFullscreen} style={smallButtonStyle}>
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                {isFullscreen ? 'Exit Big Screen' : 'Big Screen'}
              </button>
              <button onClick={() => setActions(sampleActions)} style={smallButtonStyle}>
                <RefreshCw size={14} /> Sample
              </button>
            <button onClick={() => { setActions([]); setSelectedActionId(null); }} style={smallButtonStyle}>
                <Eraser size={14} /> Clear
              </button>
              <button disabled={!selectedActionId} onClick={deleteSelected} style={smallButtonStyle}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
          <div style={{ borderTop: '1px solid #EEF2F8', padding: '0 14px 14px' }}>
            <input
              disabled={!videoUrl}
              max={duration || 0}
              min="0"
              onChange={(event) => seekTo(event.target.value)}
              step="0.01"
              type="range"
              value={currentTime}
              style={{ accentColor: '#7C3AED', width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', fontSize: 11, fontWeight: 800 }}>
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <div style={{ height: 28, position: 'relative', marginTop: 8, background: '#F1F5F9', borderRadius: 8, overflow: 'hidden' }}>
              {actions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => {
                    setSelectedActionId(action.id);
                    seekTo(action.time);
                  }}
                  title={action.label}
                  style={{
                    background: action.color || toolConfig[action.type]?.color || '#7C3AED',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    height: 18,
                    left: `${duration ? (action.time / duration) * 100 : 0}%`,
                    minWidth: 10,
                    opacity: selectedActionId === action.id ? 1 : 0.75,
                    position: 'absolute',
                    top: 5,
                    width: `${duration ? Math.max(1.5, ((action.duration || 3) / duration) * 100) : 6}%`
                  }}
                />
              ))}
              {slowSegments.map((segment) => (
                <button
                  key={segment.id}
                  onClick={() => seekTo(segment.start)}
                  title={`Speed segment ${segment.speed}x`}
                  style={{
                    background: '#111827',
                    border: 'none',
                    borderRadius: 6,
                    bottom: 4,
                    cursor: 'pointer',
                    height: 6,
                    left: `${duration ? (segment.start / duration) * 100 : 0}%`,
                    position: 'absolute',
                    width: `${duration ? Math.max(1.5, ((segment.end - segment.start) / duration) * 100) : 6}%`
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <aside style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          maxHeight: isFullscreen ? 'calc(100vh - 24px)' : 'none',
          overflowY: isFullscreen ? 'auto' : 'visible',
          paddingRight: isFullscreen ? 4 : 0
        }}>
          <div style={panelStyle}>
            <h2 style={panelTitleStyle}><Monitor size={16} /> Reaction Recording</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
              <label style={fieldLabelStyle}>
                Recording preset
                <select
                  disabled={isReactionRecording}
                  value={reactionPresetId}
                  onChange={(event) => {
                    const nextPreset = reactionPresets[event.target.value];
                    setReactionPresetId(event.target.value);
                    setWebcamEnabled(nextPreset.webcamSize > 0);
                    setMicEnabled(nextPreset.mic);
                    setSystemAudioEnabled(nextPreset.systemAudio);
                  }}
                  style={fieldInputStyle}
                >
                  {Object.entries(reactionPresets).map(([id, preset]) => (
                    <option key={id} value={id}>{preset.label}</option>
                  ))}
                </select>
              </label>
              <LayerToggle checked={webcamEnabled} label="Live webcam overlay" onChange={setWebcamEnabled} />
              <LayerToggle checked={micEnabled} label="Microphone reaction" onChange={setMicEnabled} />
              <LayerToggle checked={systemAudioEnabled} label="Screen/system audio" onChange={setSystemAudioEnabled} />
              <button
                onClick={toggleFullscreen}
                style={{
                  ...smallButtonStyle,
                  justifyContent: 'center',
                  width: '100%'
                }}
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                {isFullscreen ? 'Exit Big Screen' : 'Open Big Screen'}
              </button>
              <button
                onClick={isReactionRecording ? stopReactionRecording : startReactionRecording}
                style={{
                  ...smallButtonStyle,
                  background: isReactionRecording ? '#EF4444' : '#172033',
                  borderColor: isReactionRecording ? '#EF4444' : '#172033',
                  color: '#FFFFFF',
                  justifyContent: 'center',
                  marginTop: 4,
                  width: '100%'
                }}
              >
                {isReactionRecording ? <Square size={14} /> : <Video size={14} />}
                {isReactionRecording ? 'Stop Reaction Recording' : 'Record Reaction'}
              </button>
              <p style={{ color: '#64748B', fontSize: 12, lineHeight: 1.45 }}>{recordingStatus}</p>
              {savedRecordingPath && (
                <div style={{
                  background: '#F8FAFC',
                  border: '1px solid #D9E1EF',
                  borderRadius: 8,
                  color: '#26344D',
                  fontSize: 11,
                  lineHeight: 1.45,
                  padding: 10,
                  wordBreak: 'break-all'
                }}>
                  Local file: {savedRecordingPath}
                </div>
              )}
              {recordedReactionUrl && (
                <video controls src={recordedReactionUrl} style={{ background: '#0F172A', borderRadius: 8, width: '100%' }} />
              )}
            </div>
          </div>

          <div style={panelStyle}>
            <h2 style={panelTitleStyle}><Activity size={16} /> Overlay Layers</h2>
            <LayerToggle checked={showTacticalLayers} label="Tactical drawings" onChange={setShowTacticalLayers} />
            <LayerToggle checked={showFormations} label="Formation players" onChange={setShowFormations} />
            <LayerToggle checked={showPitchGuide} label="Pitch guide lines" onChange={setShowPitchGuide} />
          </div>

          <div style={panelStyle}>
            <h2 style={panelTitleStyle}><Route size={16} /> Formations</h2>
            {!showFormations && (
              <p style={{ color: '#64748B', fontSize: 12, lineHeight: 1.45, marginBottom: 10 }}>
                Turn on Formation players above when you want to simulate team shape over the video.
              </p>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <FormationPicker label="Home" value={homeFormation} onChange={(value) => applyFormation('home', value)} />
              <FormationPicker label="Away" value={awayFormation} onChange={(value) => applyFormation('away', value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
              <button onClick={() => setSimulationPhase('base')} style={{ ...toolButtonStyle, background: simulationPhase === 'base' ? '#E8F0FF' : '#F8FAFC', color: '#2563EB' }}>
                Base Shape
              </button>
              <button onClick={() => setSimulationPhase('target')} style={{ ...toolButtonStyle, background: simulationPhase === 'target' ? '#FFF3DD' : '#F8FAFC', color: '#D97706' }}>
                Movement
              </button>
            </div>
            <button onClick={resetShape} style={{ ...smallButtonStyle, justifyContent: 'center', marginTop: 10, width: '100%' }}>
              <RefreshCw size={14} /> Reset Movement Targets
            </button>
          </div>

          <div style={panelStyle}>
            <h2 style={panelTitleStyle}><Footprints size={16} /> Player Roles</h2>
            {selectedPlayer ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ color: '#475569', fontSize: 13 }}>
                  Player {selectedPlayer.number} - {selectedPlayer.team === 'home' ? 'Home Team' : 'Away Team'}
                </div>
                <input
                  value={selectedPlayer.role}
                  onChange={(event) => updateSelectedRole(event.target.value.toUpperCase().slice(0, 6))}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #D9E1EF',
                    borderRadius: 8,
                    color: '#172033',
                    fontSize: 13,
                    fontWeight: 900,
                    minHeight: 40,
                    outline: 'none',
                    padding: '0 10px'
                  }}
                />
                <p style={{ color: '#64748B', fontSize: 12, lineHeight: 1.45 }}>
                  Drag the player on the video to set a movement target. Use Base Shape and Movement to simulate the shift.
                </p>
              </div>
            ) : (
              <p style={{ color: '#64748B', fontSize: 13, lineHeight: 1.45 }}>Click a player to edit their role or drag them into a tactical movement.</p>
            )}
          </div>

          <div style={panelStyle}>
            <h2 style={panelTitleStyle}><Footprints size={16} /> Tools</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {Object.entries(toolConfig).map(([id, tool]) => {
                const Icon = tool.icon;
                const active = activeTool === id;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      setActiveTool(id);
                      setDraftStart(null);
                    }}
                    style={{
                      ...toolButtonStyle,
                      background: active ? `${tool.color}14` : '#F8FAFC',
                      borderColor: active ? `${tool.color}66` : '#E2E8F0',
                      color: active ? tool.color : '#475569'
                    }}
                  >
                    <Icon size={15} /> {tool.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={panelStyle}>
            <h2 style={panelTitleStyle}><Maximize2 size={16} /> Review Zoom</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {[1, 1.25, 1.5, 2].map((level) => (
                <button
                  key={level}
                  disabled={!videoUrl}
                  onClick={() => setReviewZoom(level)}
                  style={{
                    ...toolButtonStyle,
                    background: zoomLevel === level ? '#E8F0FF' : '#F8FAFC',
                    color: zoomLevel === level ? '#2563EB' : '#475569',
                    minHeight: 36
                  }}
                >
                  {level}x
                </button>
              ))}
            </div>
            <p style={{ color: '#64748B', fontSize: 12, lineHeight: 1.45, marginTop: 10 }}>
              Click the player or space you are explaining, then zoom in while recording.
            </p>
          </div>

          <div style={panelStyle}>
            <h2 style={panelTitleStyle}><Activity size={16} /> Edit Instructions</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
              {actions.length === 0 ? (
                <div style={{ color: '#64748B', fontSize: 13, lineHeight: 1.45, padding: '10px 0' }}>
                  No instructions yet. Pick a tool and drag across the video.
                </div>
              ) : actions.map((action, index) => {
                const cfg = toolConfig[action.type] || toolConfig.move;
                return (
                  <button
                    key={action.id}
                    onClick={() => {
                      setSelectedActionId(action.id);
                    }}
                    style={{
                      alignItems: 'center',
                      background: selectedActionId === action.id ? `${cfg.color}12` : '#F8FAFC',
                      border: `1px solid ${selectedActionId === action.id ? `${cfg.color}55` : '#E2E8F0'}`,
                      borderRadius: 8,
                      color: '#172033',
                      cursor: 'pointer',
                      display: 'flex',
                      gap: 10,
                      padding: 10,
                      textAlign: 'left'
                    }}
                  >
                    <span style={{ background: cfg.color, borderRadius: 999, height: 10, width: 10 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ display: 'block', fontSize: 13 }}>{index + 1}. {action.label}</strong>
                      <span style={{ color: '#64748B', fontSize: 11 }}>{formatTime(action.time)} - {formatTime(action.time + (action.duration || 3))}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={panelStyle}>
            <h2 style={panelTitleStyle}><Plus size={16} /> Layer Editor</h2>
            {selectedAction ? (
              <div style={{ color: '#475569', display: 'flex', flexDirection: 'column', fontSize: 13, gap: 10 }}>
                <label style={fieldLabelStyle}>
                  Label
                  <input value={selectedAction.label} onChange={(event) => updateSelectedAction({ label: event.target.value })} style={fieldInputStyle} />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label style={fieldLabelStyle}>
                    Start
                    <input type="number" min="0" step="0.1" value={selectedAction.time} onChange={(event) => updateSelectedAction({ time: Number(event.target.value) })} style={fieldInputStyle} />
                  </label>
                  <label style={fieldLabelStyle}>
                    Duration
                    <input type="number" min="0.3" step="0.1" value={selectedAction.duration || 3} onChange={(event) => updateSelectedAction({ duration: Number(event.target.value) })} style={fieldInputStyle} />
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label style={fieldLabelStyle}>
                    Color
                    <input type="color" value={selectedAction.color || toolConfig[selectedAction.type]?.color || '#00A878'} onChange={(event) => updateSelectedAction({ color: event.target.value })} style={{ ...fieldInputStyle, padding: 4 }} />
                  </label>
                  <label style={fieldLabelStyle}>
                    Width
                    <input type="number" min="2" max="12" step="1" value={selectedAction.strokeWidth || 5} onChange={(event) => updateSelectedAction({ strokeWidth: Number(event.target.value) })} style={fieldInputStyle} />
                  </label>
                </div>
                <button onClick={deleteSelected} style={{ ...smallButtonStyle, justifyContent: 'center', color: '#EF4444' }}>
                  <Trash2 size={14} /> Delete Layer
                </button>
              </div>
            ) : (
              <p style={{ color: '#64748B', fontSize: 13, lineHeight: 1.45 }}>Select a tactical layer to edit its timing, color, width, and label.</p>
            )}
          </div>

          <div style={panelStyle}>
            <h2 style={panelTitleStyle}><Play size={16} /> Video Speed Edits</h2>
            <button onClick={addSlowSegment} disabled={!videoUrl} style={{ ...smallButtonStyle, justifyContent: 'center', width: '100%' }}>
              Add Speed Segment at Playhead
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, maxHeight: 180, overflowY: 'auto' }}>
              {slowSegments.length === 0 ? (
                <p style={{ color: '#64748B', fontSize: 12, lineHeight: 1.45 }}>Set playback to slow or fast, pause at a key moment, then add a timed speed segment.</p>
              ) : slowSegments.map((segment) => (
                <div key={segment.id} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#172033', fontSize: 12, fontWeight: 900 }}>
                    <span>{formatTime(segment.start)} - {formatTime(segment.end)} at {segment.speed}x</span>
                    <button onClick={() => removeSlowSegment(segment.id)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontWeight: 900 }}>Remove</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    {[
                      ['start', 'Start'],
                      ['end', 'End'],
                      ['speed', 'Speed']
                    ].map(([key, label]) => (
                      <label key={key} style={fieldLabelStyle}>
                        {label}
                        <input
                          type="number"
                          min={key === 'speed' ? 0.25 : 0}
                          max={key === 'speed' ? 2 : undefined}
                          step={key === 'speed' ? 0.05 : 0.1}
                          value={segment[key]}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            setSlowSegments((prev) => prev.map((item) => item.id === segment.id ? { ...item, [key]: value } : item));
                          }}
                          style={{ ...fieldInputStyle, padding: '7px 8px' }}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...panelStyle, background: '#172033', borderColor: '#172033', color: '#FFFFFF' }}>
            <p style={{ color: '#D6DEE9', fontSize: 13, lineHeight: 1.5 }}>{note}</p>
          </div>
        </aside>
      </section>
    </div>
  );
}

function PitchOverlay() {
  return <div style={{ inset: 0, pointerEvents: 'none', position: 'absolute' }}><PitchLines /></div>;
}

function PitchLines() {
  return (
    <>
      <div style={{ border: '2px solid rgba(255,255,255,0.32)', inset: '7%', position: 'absolute' }} />
      <div style={{ background: 'rgba(255,255,255,0.32)', bottom: '7%', left: '50%', position: 'absolute', top: '7%', width: 2 }} />
      <div style={{ border: '2px solid rgba(255,255,255,0.32)', borderRadius: '50%', height: '20%', left: '50%', position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)', width: '11.25%' }} />
      <div style={{ border: '2px solid rgba(255,255,255,0.32)', bottom: '30%', left: '7%', position: 'absolute', top: '30%', width: '13%' }} />
      <div style={{ border: '2px solid rgba(255,255,255,0.32)', bottom: '30%', position: 'absolute', right: '7%', top: '30%', width: '13%' }} />
    </>
  );
}

function FormationPicker({ label, value, onChange }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ color: '#475569', fontSize: 12, fontWeight: 900 }}>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          background: '#FFFFFF',
          border: '1px solid #D9E1EF',
          borderRadius: 8,
          color: '#172033',
          fontSize: 13,
          fontWeight: 900,
          minHeight: 40,
          outline: 'none',
          padding: '0 10px'
        }}
      >
        {Object.keys(formations).map((formation) => (
          <option key={formation} value={formation}>{formation}</option>
        ))}
      </select>
    </label>
  );
}

function LayerToggle({ checked, label, onChange }) {
  return (
    <label style={{
      alignItems: 'center',
      background: checked ? '#EEF4FF' : '#F8FAFC',
      border: `1px solid ${checked ? '#BFD3FF' : '#E2E8F0'}`,
      borderRadius: 8,
      color: '#172033',
      cursor: 'pointer',
      display: 'flex',
      fontSize: 13,
      fontWeight: 800,
      justifyContent: 'space-between',
      marginTop: 8,
      padding: '10px 12px'
    }}>
      <span>{label}</span>
      <input
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  );
}

const webcamOverlayStyle = (preset) => {
  const size = `${Math.max(14, preset.webcamSize * 100)}%`;
  const position = {
    bottom: 18,
    height: size,
    position: 'absolute',
    width: size,
    zIndex: 18
  };

  if (preset.webcamPosition.includes('right')) position.right = 18;
  if (preset.webcamPosition.includes('left')) position.left = 18;
  if (preset.webcamPosition.includes('top')) position.top = 18;
  if (preset.webcamPosition.includes('bottom')) position.bottom = 18;

  return {
    ...position,
    aspectRatio: '1 / 1',
    background: '#0F172A',
    border: '3px solid rgba(255,255,255,0.9)',
    borderRadius: 8,
    boxShadow: '0 18px 32px rgba(0,0,0,0.35)',
    overflow: 'hidden',
    pointerEvents: 'none'
  };
};

const panelStyle = {
  background: '#FFFFFF',
  border: '1px solid #E1E7F2',
  borderRadius: 8,
  padding: 16
};

const panelTitleStyle = {
  alignItems: 'center',
  color: '#172033',
  display: 'flex',
  fontSize: 14,
  fontWeight: 900,
  gap: 8,
  marginBottom: 12
};

const toolButtonStyle = {
  alignItems: 'center',
  border: '1px solid #E2E8F0',
  borderRadius: 8,
  cursor: 'pointer',
  display: 'flex',
  fontSize: 12,
  fontWeight: 900,
  gap: 7,
  justifyContent: 'center',
  minHeight: 40
};

const smallButtonStyle = {
  alignItems: 'center',
  background: '#FFFFFF',
  border: '1px solid #D9E1EF',
  borderRadius: 8,
  color: '#26344D',
  cursor: 'pointer',
  display: 'inline-flex',
  fontSize: 12,
  fontWeight: 800,
  gap: 6,
  padding: '8px 10px'
};

const fieldLabelStyle = {
  color: '#475569',
  display: 'flex',
  flexDirection: 'column',
  fontSize: 11,
  fontWeight: 900,
  gap: 5
};

const fieldInputStyle = {
  background: '#FFFFFF',
  border: '1px solid #D9E1EF',
  borderRadius: 8,
  color: '#172033',
  fontSize: 12,
  fontWeight: 800,
  minHeight: 34,
  outline: 'none',
  padding: '0 9px'
};

const iconButtonStyle = (disabled) => ({
  alignItems: 'center',
  background: disabled ? '#E2E8F0' : '#172033',
  border: 'none',
  borderRadius: 8,
  color: disabled ? '#94A3B8' : '#FFFFFF',
  cursor: disabled ? 'not-allowed' : 'pointer',
  display: 'inline-flex',
  height: 36,
  justifyContent: 'center',
  width: 36
});

const buttonStyle = (background, color, borderColor) => ({
  alignItems: 'center',
  background,
  border: `1px solid ${borderColor}`,
  borderRadius: 8,
  color,
  cursor: 'pointer',
  display: 'inline-flex',
  fontSize: 13,
  fontWeight: 900,
  gap: 8,
  padding: '10px 14px'
});
