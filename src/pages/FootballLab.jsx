import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Camera,
  Check,
  ClipboardCopy,
  Clock3,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FileText,
  Flag,
  Footprints,
  Layers3,
  ListPlus,
  Map,
  Maximize2,
  Mic,
  Minimize2,
  Minus,
  MonitorUp,
  MousePointer2,
  MoveRight,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Route,
  Shield,
  Square,
  Target,
  Trash2,
  Undo2,
  Upload,
  Users,
  Video,
  Volume2
} from 'lucide-react';
import './FootballLab.css';

const STORAGE_KEY = 'screenflow-football-lab-v2';

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
  pen: { label: 'Pen', icon: Pencil, color: '#00a878' },
  pass: { label: 'Pass', icon: ArrowRight, color: '#00a878' },
  run: { label: 'Run', icon: Route, color: '#2563eb' },
  move: { label: 'Move', icon: MoveRight, color: '#f59e0b' },
  defend: { label: 'Defend', icon: Shield, color: '#ef4444' },
  press: { label: 'Press', icon: Target, color: '#dc2626' },
  var: { label: 'VAR line', icon: Minus, color: '#facc15' }
};

const eventTypes = {
  goal: { label: 'Goal', icon: Target, color: '#059669', outcomes: ['Goal'] },
  shot: { label: 'Shot', icon: Activity, color: '#7c3aed', outcomes: ['On target', 'Off target', 'Blocked'] },
  pass: { label: 'Pass', icon: ArrowRight, color: '#2563eb', outcomes: ['Complete', 'Incomplete', 'Key pass'] },
  recovery: { label: 'Recovery', icon: Shield, color: '#0891b2', outcomes: ['Won', 'Lost'] },
  foul: { label: 'Foul', icon: Flag, color: '#d97706', outcomes: ['Committed', 'Won'] },
  save: { label: 'Save', icon: Check, color: '#0f766e', outcomes: ['Saved', 'Parried', 'Claimed'] },
  substitution: { label: 'Sub', icon: Users, color: '#64748b', outcomes: ['Completed'] }
};

const reactionPresets = {
  coach: { label: 'Coach breakdown', webcamSize: 0.22, mic: true, systemAudio: true },
  creator: { label: 'Creator reaction', webcamSize: 0.28, mic: true, systemAudio: true },
  voiceover: { label: 'Voiceover only', webcamSize: 0, mic: true, systemAudio: true }
};

const defaultMatch = {
  title: 'New match analysis',
  competition: 'Friendly',
  date: new Date().toISOString().slice(0, 10),
  period: 'First half',
  homeName: 'Home',
  awayName: 'Away',
  homeScore: 0,
  awayScore: 0
};

function buildTeam(teamKey, formationName, existingPlayers = []) {
  const isHome = teamKey === 'home';
  return formations[formationName].map(([role, x, y], index) => {
    const existing = existingPlayers[index];
    return {
      id: `${teamKey}-${index + 1}`,
      number: existing?.number || index + 1,
      name: existing?.name || `Player ${index + 1}`,
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
    };
  });
}

function createDefaultPlayers() {
  return [
    ...buildTeam('home', '4-3-3'),
    ...buildTeam('away', '4-2-3-1')
  ];
}

function loadStoredSession() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function formatTime(seconds) {
  const safe = Number.isFinite(Number(seconds)) ? Math.max(0, Number(seconds)) : 0;
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function safeFileName(value) {
  return (value || 'football-analysis')
    .trim()
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'football-analysis';
}

function teamStats(events, team) {
  const teamEvents = events.filter((event) => event.team === team);
  const shots = teamEvents.filter((event) => event.type === 'shot' || event.type === 'goal');
  const passes = teamEvents.filter((event) => event.type === 'pass');
  const completedPasses = passes.filter((event) => event.outcome === 'Complete' || event.outcome === 'Key pass');
  return {
    events: teamEvents.length,
    shots: shots.length,
    onTarget: shots.filter((event) => event.type === 'goal' || event.outcome === 'On target').length,
    goals: teamEvents.filter((event) => event.type === 'goal').length,
    passes: passes.length,
    passCompletion: passes.length ? Math.round((completedPasses.length / passes.length) * 100) : 0,
    recoveries: teamEvents.filter((event) => event.type === 'recovery' && event.outcome === 'Won').length,
    fouls: teamEvents.filter((event) => event.type === 'foul' && event.outcome === 'Committed').length,
    saves: teamEvents.filter((event) => event.type === 'save').length
  };
}

export default function FootballLab() {
  const [initialSession] = useState(loadStoredSession);
  const [match, setMatch] = useState({ ...defaultMatch, ...(initialSession.match || {}) });
  const [homeFormation, setHomeFormation] = useState(initialSession.homeFormation || '4-3-3');
  const [awayFormation, setAwayFormation] = useState(initialSession.awayFormation || '4-2-3-1');
  const [players, setPlayers] = useState(
    Array.isArray(initialSession.players) && initialSession.players.length === 22
      ? initialSession.players
      : createDefaultPlayers()
  );
  const [events, setEvents] = useState(Array.isArray(initialSession.events) ? initialSession.events : []);
  const [actions, setActions] = useState(Array.isArray(initialSession.actions) ? initialSession.actions : []);
  const [slowSegments, setSlowSegments] = useState(Array.isArray(initialSession.slowSegments) ? initialSession.slowSegments : []);

  const [sourceMode, setSourceMode] = useState('board');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoName, setVideoName] = useState('No footage loaded');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomAnchor, setZoomAnchor] = useState({ x: 50, y: 50 });

  const [activeTool, setActiveTool] = useState('select');
  const [draftStart, setDraftStart] = useState(null);
  const [draftPath, setDraftPath] = useState([]);
  const [selectedActionId, setSelectedActionId] = useState(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [draggingPlayerId, setDraggingPlayerId] = useState(null);
  const [simulationPhase, setSimulationPhase] = useState('base');
  const [showFormations, setShowFormations] = useState(true);
  const [showPitchGuide, setShowPitchGuide] = useState(false);
  const [showTacticalLayers, setShowTacticalLayers] = useState(true);
  const [showEventMarkers, setShowEventMarkers] = useState(true);

  const [inspectorTab, setInspectorTab] = useState('tactics');
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [eventPoint, setEventPoint] = useState(null);
  const [eventFilterTeam, setEventFilterTeam] = useState('all');
  const [eventFilterType, setEventFilterType] = useState('all');
  const [eventDraft, setEventDraft] = useState({
    type: 'shot',
    team: 'home',
    playerId: '',
    outcome: 'On target',
    minute: 1,
    note: ''
  });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [status, setStatus] = useState('Analysis ready');
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const [reactionPresetId, setReactionPresetId] = useState('coach');
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [systemAudioEnabled, setSystemAudioEnabled] = useState(true);
  const [isReactionRecording, setIsReactionRecording] = useState(false);
  const [recordedReactionUrl, setRecordedReactionUrl] = useState('');
  const [savedRecordingPath, setSavedRecordingPath] = useState('');
  const [recordingStatus, setRecordingStatus] = useState('Ready');

  const labRef = useRef(null);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const webcamPreviewRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const captureStreamsRef = useRef([]);
  const cameraPreviewStreamRef = useRef(null);
  const audioMixRef = useRef(null);

  const selectedAction = useMemo(
    () => actions.find((action) => action.id === selectedActionId) || null,
    [actions, selectedActionId]
  );

  const selectedPlayer = useMemo(
    () => players.find((player) => player.id === selectedPlayerId) || null,
    [players, selectedPlayerId]
  );

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) || null,
    [events, selectedEventId]
  );

  const filteredEvents = useMemo(
    () => events
      .filter((event) => eventFilterTeam === 'all' || event.team === eventFilterTeam)
      .filter((event) => eventFilterType === 'all' || event.type === eventFilterType)
      .sort((a, b) => a.time - b.time),
    [eventFilterTeam, eventFilterType, events]
  );

  const homeStats = useMemo(() => teamStats(events, 'home'), [events]);
  const awayStats = useMemo(() => teamStats(events, 'away'), [events]);
  const reactionPreset = reactionPresets[reactionPresetId];
  const timelineDuration = useMemo(() => {
    const latestAction = actions.reduce((max, action) => Math.max(max, action.time + (action.duration || 0)), 0);
    const latestEvent = events.reduce((max, event) => Math.max(max, event.time || 0), 0);
    return Math.max(duration || 0, latestAction, latestEvent, videoUrl ? 1 : 90 * 60);
  }, [actions, duration, events, videoUrl]);

  const insights = useMemo(() => {
    if (!events.length) return ['No event data available.'];
    const next = [];
    if (homeStats.shots !== awayStats.shots) {
      const leadingTeam = homeStats.shots > awayStats.shots ? match.homeName : match.awayName;
      next.push(`${leadingTeam} leads the shot count ${Math.max(homeStats.shots, awayStats.shots)} to ${Math.min(homeStats.shots, awayStats.shots)}.`);
    } else {
      next.push(`Shot volume is level at ${homeStats.shots} each.`);
    }
    if (homeStats.passes || awayStats.passes) {
      const betterTeam = homeStats.passCompletion >= awayStats.passCompletion ? match.homeName : match.awayName;
      const betterRate = Math.max(homeStats.passCompletion, awayStats.passCompletion);
      next.push(`${betterTeam} has the stronger logged pass completion at ${betterRate}%.`);
    }
    if (homeStats.recoveries !== awayStats.recoveries) {
      const team = homeStats.recoveries > awayStats.recoveries ? match.homeName : match.awayName;
      next.push(`${team} has recorded more ball recoveries.`);
    }
    next.push(`${events.length} events are tagged across ${new Set(events.map((event) => event.playerId).filter(Boolean)).size} players.`);
    return next.slice(0, 4);
  }, [awayStats, events, homeStats, match.awayName, match.homeName]);

  useEffect(() => {
    const saveTimer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
          match,
          homeFormation,
          awayFormation,
          players,
          events,
          actions,
          slowSegments
        }));
        setLastSavedAt(Date.now());
      } catch {
        setStatus('Local save unavailable');
      }
    }, 350);

    return () => window.clearTimeout(saveTimer);
  }, [actions, awayFormation, events, homeFormation, match, players, slowSegments]);

  useEffect(() => {
    return () => {
      captureStreamsRef.current.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
      cameraPreviewStreamRef.current?.getTracks().forEach((track) => track.stop());
      audioMixRef.current?.context?.close?.();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (videoUrl?.startsWith('blob:')) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  useEffect(() => {
    return () => {
      if (recordedReactionUrl?.startsWith('blob:')) URL.revokeObjectURL(recordedReactionUrl);
    };
  }, [recordedReactionUrl]);

  useEffect(() => {
    let cancelled = false;

    const syncWebcamPreview = async () => {
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
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 60 }
          },
          audio: false
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        cameraPreviewStreamRef.current = stream;
        if (webcamPreviewRef.current) webcamPreviewRef.current.srcObject = stream;
      } catch (error) {
        setWebcamEnabled(false);
        setRecordingStatus(`Camera unavailable: ${error.message}`);
      }
    };

    syncWebcamPreview();
    return () => {
      cancelled = true;
    };
  }, [reactionPreset.webcamSize, webcamEnabled]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target;
      const isEditing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
      if (!isEditing && (event.key === 'Delete' || event.key === 'Backspace') && selectedActionId) {
        event.preventDefault();
        deleteSelectedAction();
      }
      if (event.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, selectedActionId]);

  const updateMatch = (fields) => {
    setMatch((previous) => ({ ...previous, ...fields }));
  };

  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (videoUrl?.startsWith('blob:')) URL.revokeObjectURL(videoUrl);

    const nextUrl = URL.createObjectURL(file);
    setVideoUrl(nextUrl);
    setVideoName(file.name);
    setSourceMode('video');
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setZoomLevel(1);
    setShowFormations(false);
    setShowPitchGuide(false);
    setInspectorTab('events');
    setStatus('Footage loaded');
    event.target.value = '';
  };

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;
    if (video.paused) {
      await video.play();
    } else {
      video.pause();
    }
  };

  const seekTo = (time) => {
    const nextTime = clamp(Number(time) || 0, 0, timelineDuration);
    if (videoRef.current) videoRef.current.currentTime = Math.min(nextTime, duration || nextTime);
    setCurrentTime(nextTime);
  };

  const setVideoSpeed = (speed) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) videoRef.current.playbackRate = speed;
    setStatus(`Playback ${speed}x`);
  };

  const handleTimeUpdate = (event) => {
    const time = event.currentTarget.currentTime;
    setCurrentTime(time);
    const segment = slowSegments.find((item) => time >= item.start && time <= item.end);
    event.currentTarget.playbackRate = segment ? segment.speed : playbackSpeed;
  };

  const addSpeedSegment = () => {
    const start = Math.max(0, Number((currentTime - 1).toFixed(2)));
    const segment = {
      id: `speed-${Date.now()}`,
      start,
      end: Number((start + 3).toFixed(2)),
      speed: playbackSpeed === 1 ? 0.5 : playbackSpeed
    };
    setSlowSegments((previous) => [...previous, segment]);
    setStatus(`${segment.speed}x segment added at ${formatTime(start)}`);
  };

  const getPointFromEvent = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100)
    };
  };

  const handleBoardPointerDown = (event) => {
    const point = getPointFromEvent(event);
    setZoomAnchor(point);
    if (draggingPlayerId) return;

    if (activeTool === 'event') {
      setEventPoint(point);
      setInspectorTab('events');
      setSelectedEventId(null);
      setStatus('Event position set');
      return;
    }

    if (activeTool === 'select') {
      setSelectedActionId(null);
      return;
    }

    setDraftStart(point);
    if (activeTool === 'pen') {
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setDraftPath([point]);
    }
  };

  const handleBoardPointerMove = (event) => {
    if (activeTool === 'pen' && draftStart) {
      const point = getPointFromEvent(event);
      setDraftPath((previous) => {
        const last = previous[previous.length - 1];
        if (last && Math.abs(last.x - point.x) < 0.35 && Math.abs(last.y - point.y) < 0.35) return previous;
        return [...previous, point];
      });
      return;
    }

    if (!draggingPlayerId) return;
    const point = getPointFromEvent(event);
    setPlayers((previous) => previous.map((player) => (
      player.id === draggingPlayerId ? { ...player, target: point } : player
    )));
  };

  const handleBoardPointerUp = (event) => {
    if (draggingPlayerId) {
      setDraggingPlayerId(null);
      setSimulationPhase('target');
      setStatus('Player movement updated');
      return;
    }

    if (!draftStart || activeTool === 'select' || activeTool === 'event') return;
    const rawEnd = getPointFromEvent(event);
    const end = activeTool === 'var' ? { x: draftStart.x, y: rawEnd.y } : rawEnd;
    const points = activeTool === 'pen' ? [...draftPath, end] : undefined;
    const config = toolConfig[activeTool] || toolConfig.pen;
    const action = {
      id: `${activeTool}-${Date.now()}`,
      type: activeTool,
      label: config.label,
      start: draftStart,
      end,
      points,
      time: Number(currentTime.toFixed(2)),
      duration: activeTool === 'press' ? 2 : 3,
      color: config.color,
      strokeWidth: activeTool === 'pen' ? 6 : (activeTool === 'run' || activeTool === 'defend' ? 4 : 5)
    };

    setActions((previous) => [...previous, action]);
    setSelectedActionId(action.id);
    setDraftStart(null);
    setDraftPath([]);
    setStatus(`${config.label} added at ${formatTime(action.time)}`);
  };

  const handlePlayerPointerDown = (event, playerId) => {
    event.stopPropagation();
    if (activeTool !== 'select') return;
    setDraggingPlayerId(playerId);
    setSelectedPlayerId(playerId);
    setSelectedActionId(null);
    setInspectorTab('tactics');
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const updateSelectedPlayer = (fields) => {
    if (!selectedPlayerId) return;
    setPlayers((previous) => previous.map((player) => (
      player.id === selectedPlayerId ? { ...player, ...fields } : player
    )));
  };

  const updateSelectedAction = (fields) => {
    if (!selectedActionId) return;
    setActions((previous) => previous.map((action) => (
      action.id === selectedActionId ? { ...action, ...fields } : action
    )));
  };

  const deleteSelectedAction = () => {
    if (!selectedActionId) return;
    setActions((previous) => previous.filter((action) => action.id !== selectedActionId));
    setSelectedActionId(null);
    setStatus('Layer deleted');
  };

  const undoLastAction = () => {
    setActions((previous) => previous.slice(0, -1));
    setSelectedActionId(null);
    setStatus('Last layer removed');
  };

  const applyFormation = (team, formationName) => {
    if (team === 'home') setHomeFormation(formationName);
    if (team === 'away') setAwayFormation(formationName);
    setPlayers((previous) => {
      const existingTeam = previous.filter((player) => player.team === team);
      return [
        ...previous.filter((player) => player.team !== team),
        ...buildTeam(team, formationName, existingTeam)
      ];
    });
    setSelectedPlayerId(null);
    setStatus(`${team === 'home' ? match.homeName : match.awayName} set to ${formationName}`);
  };

  const resetPlayerShape = () => {
    setPlayers((previous) => previous.map((player) => ({ ...player, target: { ...player.base } })));
    setSimulationPhase('base');
    setStatus('Player movement reset');
  };

  const chooseEventType = (type) => {
    setEventDraft((previous) => ({
      ...previous,
      type,
      outcome: eventTypes[type].outcomes[0],
      minute: videoUrl ? Math.floor(currentTime / 60) + 1 : previous.minute
    }));
    setInspectorTab('events');
  };

  const activateEventTool = () => {
    setActiveTool('event');
    setInspectorTab('events');
    setEventDraft((previous) => ({
      ...previous,
      minute: videoUrl ? Math.floor(currentTime / 60) + 1 : previous.minute
    }));
    setStatus('Event tagging active');
  };

  const addMatchEvent = () => {
    const config = eventTypes[eventDraft.type];
    const eventTime = videoUrl
      ? currentTime
      : Math.max(0, (Math.max(1, Number(eventDraft.minute) || 1) - 1) * 60);
    const player = players.find((item) => item.id === eventDraft.playerId);
    const nextEvent = {
      id: `event-${Date.now()}`,
      type: eventDraft.type,
      team: eventDraft.team,
      playerId: eventDraft.playerId,
      playerName: player?.name || '',
      outcome: eventDraft.outcome,
      minute: Math.max(1, Number(eventDraft.minute) || Math.floor(eventTime / 60) + 1),
      time: Number(eventTime.toFixed(2)),
      note: eventDraft.note.trim(),
      point: eventPoint || zoomAnchor || { x: 50, y: 50 }
    };

    setEvents((previous) => [...previous, nextEvent]);
    if (nextEvent.type === 'goal') {
      const scoreKey = nextEvent.team === 'home' ? 'homeScore' : 'awayScore';
      updateMatch({ [scoreKey]: Math.max(0, Number(match[scoreKey]) || 0) + 1 });
    }
    setSelectedEventId(nextEvent.id);
    setEventPoint(null);
    setEventDraft((previous) => ({ ...previous, playerId: '', note: '' }));
    setStatus(`${config.label} logged for ${nextEvent.team === 'home' ? match.homeName : match.awayName}`);
  };

  const deleteSelectedEvent = () => {
    if (!selectedEvent) return;
    setEvents((previous) => previous.filter((event) => event.id !== selectedEvent.id));
    if (selectedEvent.type === 'goal') {
      const scoreKey = selectedEvent.team === 'home' ? 'homeScore' : 'awayScore';
      updateMatch({ [scoreKey]: Math.max(0, (Number(match[scoreKey]) || 0) - 1) });
    }
    setSelectedEventId(null);
    setStatus('Event deleted');
  };

  const openEvent = (event) => {
    setSelectedEventId(event.id);
    setInspectorTab('events');
    setEventPoint(null);
    seekTo(event.time);
  };

  const toggleFullscreen = async () => {
    const next = !isFullscreen;
    setIsFullscreen(next);
    if (next) {
      try {
        await labRef.current?.requestFullscreen?.();
      } catch {
        // The fixed full-window layout remains available when native fullscreen is blocked.
      }
    } else if (document.fullscreenElement && document.exitFullscreen) {
      try {
        await document.exitFullscreen();
      } catch {
        // The local layout state still exits fullscreen.
      }
    }
  };

  const createReportText = () => {
    const lines = [
      match.title,
      `${match.competition} | ${match.date}`,
      `${match.homeName} ${match.homeScore} - ${match.awayScore} ${match.awayName}`,
      '',
      'MATCH DATA',
      `Shots: ${homeStats.shots} - ${awayStats.shots}`,
      `Shots on target: ${homeStats.onTarget} - ${awayStats.onTarget}`,
      `Pass completion: ${homeStats.passCompletion}% - ${awayStats.passCompletion}%`,
      `Recoveries: ${homeStats.recoveries} - ${awayStats.recoveries}`,
      `Fouls: ${homeStats.fouls} - ${awayStats.fouls}`,
      '',
      'KEY READ',
      ...insights.map((insight) => `- ${insight}`),
      '',
      'EVENTS',
      ...[...events]
        .sort((a, b) => a.time - b.time)
        .map((event) => `${event.minute}' ${event.team === 'home' ? match.homeName : match.awayName} - ${eventTypes[event.type]?.label || event.type} (${event.outcome})${event.playerName ? ` - ${event.playerName}` : ''}${event.note ? `: ${event.note}` : ''}`)
    ];
    return lines.join('\n');
  };

  const exportAnalysis = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      match,
      formations: { home: homeFormation, away: awayFormation },
      stats: { home: homeStats, away: awayStats },
      insights,
      players,
      events,
      tacticalLayers: actions,
      speedSegments: slowSegments
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeFileName(match.title)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus('Analysis exported');
  };

  const copyReport = async () => {
    const report = createReportText();
    try {
      await navigator.clipboard.writeText(report);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = report;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      textArea.remove();
    }
    setStatus('Match report copied');
  };

  const resetAnalysis = () => {
    if (!window.confirm('Start a new football analysis? This clears the current saved session.')) return;
    if (videoUrl?.startsWith('blob:')) URL.revokeObjectURL(videoUrl);
    setMatch({ ...defaultMatch, date: new Date().toISOString().slice(0, 10) });
    setHomeFormation('4-3-3');
    setAwayFormation('4-2-3-1');
    setPlayers(createDefaultPlayers());
    setEvents([]);
    setActions([]);
    setSlowSegments([]);
    setVideoUrl('');
    setVideoName('No footage loaded');
    setCurrentTime(0);
    setDuration(0);
    setSourceMode('board');
    setSelectedActionId(null);
    setSelectedEventId(null);
    setSelectedPlayerId(null);
    window.localStorage.removeItem(STORAGE_KEY);
    setStatus('New analysis ready');
  };

  const getSupportedMimeType = () => {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    return types.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || '';
  };

  const buildMixedAudioTrack = async (displayStream, micStream) => {
    const sources = [
      ...(displayStream?.getAudioTracks().length ? [{ stream: displayStream, gain: 0.82 }] : []),
      ...(micStream?.getAudioTracks().length ? [{ stream: micStream, gain: 1 }] : [])
    ];
    if (!sources.length) return [];
    if (sources.length === 1) return sources[0].stream.getAudioTracks();

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return sources.flatMap((source) => source.stream.getAudioTracks());

    const context = new AudioContextClass();
    await context.resume();
    const destination = context.createMediaStreamDestination();
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.2;
    compressor.connect(destination);

    const nodes = sources.map(({ stream, gain }) => {
      const sourceNode = context.createMediaStreamSource(stream);
      const gainNode = context.createGain();
      gainNode.gain.value = gain;
      sourceNode.connect(gainNode);
      gainNode.connect(compressor);
      return { sourceNode, gainNode };
    });

    audioMixRef.current = { context, destination, compressor, nodes };
    return destination.stream.getAudioTracks();
  };

  const startReactionRecording = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder) {
      setRecordingStatus('Screen capture is unavailable.');
      return;
    }

    try {
      setRecordingStatus('Waiting for a screen source');
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 60, max: 60 }
        },
        audio: systemAudioEnabled
      });
      const streams = [displayStream];
      let micStream = null;

      if (micEnabled) {
        micStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1
          }
        });
        streams.push(micStream);
      }

      const audioTracks = await buildMixedAudioTrack(displayStream, micStream);
      const recordingStream = new MediaStream([
        ...displayStream.getVideoTracks(),
        ...audioTracks
      ]);
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(recordingStream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 12_000_000,
        audioBitsPerSecond: 192_000
      });

      captureStreamsRef.current = streams;
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];
      setSavedRecordingPath('');

      recorder.ondataavailable = (event) => {
        if (event.data?.size) recordedChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType || 'video/webm' });
        const nextUrl = URL.createObjectURL(blob);
        setRecordedReactionUrl(nextUrl);

        const isElectron = navigator.userAgent.toLowerCase().includes('electron');
        if (isElectron && window.electron?.saveRecordedFile) {
          const result = await window.electron.saveRecordedFile(
            await blob.arrayBuffer(),
            `${safeFileName(match.title)}-reaction`
          );
          if (result?.success) {
            setSavedRecordingPath(result.filePath);
            setRecordingStatus('Recording saved locally');
          } else {
            setRecordingStatus(`Preview ready. Save failed: ${result?.error || 'Unknown error'}`);
          }
        } else {
          setRecordingStatus('Recording ready');
        }

        captureStreamsRef.current.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
        captureStreamsRef.current = [];
        await audioMixRef.current?.context?.close?.();
        audioMixRef.current = null;
      };

      recorder.onerror = (event) => {
        setRecordingStatus(`Recording error: ${event.error?.message || 'Unknown error'}`);
      };

      recorder.start(1000);
      setIsReactionRecording(true);
      setRecordingStatus('Recording');
      displayStream.getVideoTracks()[0]?.addEventListener('ended', stopReactionRecording, { once: true });
    } catch (error) {
      setRecordingStatus(`Could not record: ${error.message}`);
      captureStreamsRef.current.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
      captureStreamsRef.current = [];
      await audioMixRef.current?.context?.close?.();
      audioMixRef.current = null;
    }
  };

  const stopReactionRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsReactionRecording(false);
    setRecordingStatus('Finalizing recording');
  };

  const downloadRecording = () => {
    if (!recordedReactionUrl) return;
    const link = document.createElement('a');
    link.href = recordedReactionUrl;
    link.download = `${safeFileName(match.title)}-reaction.webm`;
    link.click();
  };

  const renderAction = (action) => {
    const config = { ...(toolConfig[action.type] || toolConfig.move), color: action.color || toolConfig[action.type]?.color };
    const isSelected = selectedActionId === action.id;
    const dx = action.end.x - action.start.x;
    const dy = action.end.y - action.start.y;
    const length = Math.max(1, Math.sqrt((dx * dx) + (dy * dy)));
    const isPoint = action.type === 'press' || length < 3;
    const isDashed = action.type === 'defend';
    const strokeWidth = action.strokeWidth || 5;
    const markerId = `football-arrow-${action.id}`;
    const points = action.points?.length ? action.points : [action.start, action.end];
    const pointString = points.map((point) => `${point.x},${point.y}`).join(' ');

    const selectAction = (event) => {
      event.stopPropagation();
      if (activeTool !== 'select') return;
      setSelectedActionId(action.id);
      setSelectedPlayerId(null);
      setInspectorTab('tactics');
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
          zIndex: isSelected ? 7 : 5
        }}
      >
        <defs>
          <marker id={markerId} markerHeight="6" markerWidth="8" orient="auto" refX="7" refY="3">
            <path d="M0,0 L8,3 L0,6 Z" fill={config.color} />
          </marker>
        </defs>
        {isPoint ? (
          <circle
            cx={action.start.x}
            cy={action.start.y}
            fill={`${config.color}33`}
            onPointerDown={selectAction}
            pointerEvents={activeTool === 'select' ? 'all' : 'none'}
            r={isSelected ? 3.2 : 2.6}
            stroke={config.color}
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
                stroke="#ffffff"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={(strokeWidth / 2) + 2}
                opacity="0.55"
                vectorEffect="non-scaling-stroke"
              />
            )}
            <polyline
              fill="none"
              markerEnd={action.type === 'pen' || action.type === 'var' ? undefined : `url(#${markerId})`}
              onPointerDown={selectAction}
              pointerEvents={activeTool === 'select' ? 'stroke' : 'none'}
              points={pointString}
              stroke={config.color}
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
    const config = toolConfig[activeTool] || toolConfig.pen;
    return (
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ height: '100%', inset: 0, pointerEvents: 'none', position: 'absolute', width: '100%', zIndex: 12 }}
      >
        <polyline
          fill="none"
          points={draftPath.map((point) => `${point.x},${point.y}`).join(' ')}
          stroke={config.color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  };

  const renderPlayer = (player) => {
    const current = simulationPhase === 'target' ? player.target : player.base;
    const dx = player.target.x - player.base.x;
    const dy = player.target.y - player.base.y;
    const hasMovement = Math.abs(dx) > 1 || Math.abs(dy) > 1;
    const length = Math.max(1, Math.sqrt((dx * dx) + (dy * dy)));
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const color = player.team === 'home' ? '#2563eb' : '#ef4444';

    return (
      <React.Fragment key={player.id}>
        {hasMovement && (
          <span
            className="football-movement-line"
            style={{
              background: `${color}aa`,
              left: `${player.base.x}%`,
              top: `${player.base.y}%`,
              transform: `rotate(${angle}deg)`,
              width: `${length}%`
            }}
          />
        )}
        <button
          className={`football-player ${player.team} ${selectedPlayerId === player.id ? 'selected' : ''}`}
          onPointerDown={(event) => handlePlayerPointerDown(event, player.id)}
          style={{
            cursor: activeTool === 'select' ? 'grab' : 'default',
            left: `${current.x}%`,
            pointerEvents: activeTool === 'select' ? 'auto' : 'none',
            top: `${current.y}%`,
            transition: draggingPlayerId === player.id ? 'none' : undefined
          }}
          title={`${player.name}, ${player.role}`}
        >
          <span>{player.number}</span>
          <span>{player.role}</span>
        </button>
      </React.Fragment>
    );
  };

  const stageEvents = sourceMode === 'board'
    ? filteredEvents
    : filteredEvents.filter((event) => selectedEventId === event.id || Math.abs(event.time - currentTime) <= 5);

  const renderEventMarker = (event) => {
    const config = eventTypes[event.type] || eventTypes.shot;
    const Icon = config.icon;
    return (
      <button
        className={`football-event-marker ${selectedEventId === event.id ? 'selected' : ''}`}
        key={event.id}
        onPointerDown={(pointerEvent) => {
          pointerEvent.stopPropagation();
          openEvent(event);
        }}
        style={{
          color: config.color,
          left: `${event.point?.x ?? 50}%`,
          top: `${event.point?.y ?? 50}%`
        }}
        title={`${config.label}, ${event.minute}'`}
      >
        <Icon size={12} strokeWidth={3} />
      </button>
    );
  };

  const renderAnalysisTab = () => {
    const rows = [
      ['Shots', homeStats.shots, awayStats.shots],
      ['On target', homeStats.onTarget, awayStats.onTarget],
      ['Pass completion', homeStats.passCompletion, awayStats.passCompletion, '%'],
      ['Recoveries', homeStats.recoveries, awayStats.recoveries],
      ['Fouls', homeStats.fouls, awayStats.fouls]
    ];

    return (
      <>
        <section className="football-panel-section">
          <div className="football-panel-heading">
            <h2><BarChart3 size={15} /> Match comparison</h2>
            <span>{events.length} events</span>
          </div>
          <div className="football-stat-list">
            {rows.map(([label, homeValue, awayValue, suffix = '']) => {
              const total = Number(homeValue) + Number(awayValue);
              const homeWidth = total ? (Number(homeValue) / total) * 100 : 0;
              const awayWidth = total ? (Number(awayValue) / total) * 100 : 0;
              return (
                <div className="football-stat-row" key={label}>
                  <strong>{homeValue}{suffix}</strong>
                  <div>
                    <div className="football-stat-copy">{label}</div>
                    <div className="football-stat-bars">
                      <div className="football-stat-bar"><div className="football-stat-fill" style={{ width: `${homeWidth}%` }} /></div>
                      <div className="football-stat-bar"><div className="football-stat-fill" style={{ width: `${awayWidth}%` }} /></div>
                    </div>
                  </div>
                  <strong>{awayValue}{suffix}</strong>
                </div>
              );
            })}
          </div>
        </section>

        <section className="football-panel-section">
          <div className="football-panel-heading">
            <h2><Activity size={15} /> Match read</h2>
          </div>
          <div className="football-insight-list">
            {insights.map((insight) => (
              <div className="football-insight" key={insight}>
                <Check size={14} />
                <span>{insight}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="football-panel-section">
          <div className="football-panel-heading">
            <h2><FileText size={15} /> Match details</h2>
          </div>
          <div className="football-field-grid">
            <label className="football-field">
              Analysis title
              <input value={match.title} onChange={(event) => updateMatch({ title: event.target.value })} />
            </label>
            <label className="football-field">
              Competition
              <input value={match.competition} onChange={(event) => updateMatch({ competition: event.target.value })} />
            </label>
            <label className="football-field">
              Match date
              <input type="date" value={match.date} onChange={(event) => updateMatch({ date: event.target.value })} />
            </label>
            <label className="football-field">
              Period
              <select value={match.period} onChange={(event) => updateMatch({ period: event.target.value })}>
                <option>Pre-match</option>
                <option>First half</option>
                <option>Half-time</option>
                <option>Second half</option>
                <option>Extra time</option>
                <option>Full-time</option>
              </select>
            </label>
          </div>
          <div className="football-inline-actions">
            <button className="football-button" onClick={copyReport}><ClipboardCopy size={14} /> Copy report</button>
            <button className="football-button danger" onClick={resetAnalysis}><RefreshCw size={14} /> New</button>
          </div>
        </section>
      </>
    );
  };

  const renderEventsTab = () => {
    const availablePlayers = players.filter((player) => player.team === eventDraft.team);
    return (
      <>
        <section className="football-panel-section">
          <div className="football-panel-heading">
            <h2><ListPlus size={15} /> Tag event</h2>
            <span>{eventPoint ? `${Math.round(eventPoint.x)}, ${Math.round(eventPoint.y)}` : formatTime(currentTime)}</span>
          </div>
          <div className="football-event-types">
            {Object.entries(eventTypes).map(([type, config]) => {
              const Icon = config.icon;
              return (
                <button
                  className={`football-event-chip ${eventDraft.type === type ? 'active' : ''}`}
                  key={type}
                  onClick={() => chooseEventType(type)}
                >
                  <Icon size={15} />
                  {config.label}
                </button>
              );
            })}
          </div>
          <div className="football-formation-phase">
            <button
              className={`football-segment ${eventDraft.team === 'home' ? 'active' : ''}`}
              onClick={() => setEventDraft((previous) => ({ ...previous, team: 'home', playerId: '' }))}
            >
              {match.homeName}
            </button>
            <button
              className={`football-segment ${eventDraft.team === 'away' ? 'active' : ''}`}
              onClick={() => setEventDraft((previous) => ({ ...previous, team: 'away', playerId: '' }))}
            >
              {match.awayName}
            </button>
          </div>
          <div className="football-field-grid" style={{ marginTop: 9 }}>
            <label className="football-field">
              Player
              <select value={eventDraft.playerId} onChange={(event) => setEventDraft((previous) => ({ ...previous, playerId: event.target.value }))}>
                <option value="">Unassigned</option>
                {availablePlayers.map((player) => (
                  <option key={player.id} value={player.id}>{player.number}. {player.name} ({player.role})</option>
                ))}
              </select>
            </label>
            <label className="football-field">
              Outcome
              <select value={eventDraft.outcome} onChange={(event) => setEventDraft((previous) => ({ ...previous, outcome: event.target.value }))}>
                {eventTypes[eventDraft.type].outcomes.map((outcome) => <option key={outcome}>{outcome}</option>)}
              </select>
            </label>
            <label className="football-field">
              Minute
              <input
                min="1"
                onChange={(event) => setEventDraft((previous) => ({ ...previous, minute: event.target.value }))}
                type="number"
                value={eventDraft.minute}
              />
            </label>
            <label className="football-field">
              Position
              <input
                readOnly
                value={eventPoint ? `${Math.round(eventPoint.x)}%, ${Math.round(eventPoint.y)}%` : 'Center'}
              />
            </label>
          </div>
          <label className="football-field" style={{ marginTop: 8 }}>
            Note
            <textarea value={eventDraft.note} onChange={(event) => setEventDraft((previous) => ({ ...previous, note: event.target.value }))} />
          </label>
          <div className="football-inline-actions">
            <button className="football-button primary" onClick={addMatchEvent}><Plus size={14} /> Add event</button>
            <button className="football-button" onClick={activateEventTool}><Map size={14} /> Set position</button>
          </div>
        </section>

        <section className="football-panel-section">
          <div className="football-panel-heading">
            <h2><Clock3 size={15} /> Event log</h2>
            <span>{filteredEvents.length}</span>
          </div>
          <div className="football-filter-row">
            <select aria-label="Filter events by team" value={eventFilterTeam} onChange={(event) => setEventFilterTeam(event.target.value)}>
              <option value="all">Both teams</option>
              <option value="home">{match.homeName}</option>
              <option value="away">{match.awayName}</option>
            </select>
            <select aria-label="Filter events by type" value={eventFilterType} onChange={(event) => setEventFilterType(event.target.value)}>
              <option value="all">All events</option>
              {Object.entries(eventTypes).map(([type, config]) => <option key={type} value={type}>{config.label}</option>)}
            </select>
          </div>
          <div className="football-event-list">
            {!filteredEvents.length && <div className="football-empty-state">No events in this view.</div>}
            {filteredEvents.map((event) => {
              const config = eventTypes[event.type] || eventTypes.shot;
              const Icon = config.icon;
              return (
                <button
                  className={`football-event-row ${selectedEventId === event.id ? 'selected' : ''}`}
                  key={event.id}
                  onClick={() => openEvent(event)}
                  style={{ borderLeftColor: event.team === 'home' ? '#2563eb' : '#ef4444' }}
                >
                  <span className="football-event-title">
                    <Icon color={config.color} size={13} />
                    <strong>{event.playerName || (event.team === 'home' ? match.homeName : match.awayName)} - {config.label}</strong>
                  </span>
                  <span className="football-event-minute">{event.minute}'</span>
                  <span className="football-event-meta">{event.outcome} | {formatTime(event.time)}</span>
                  {event.note && <span className="football-event-note">{event.note}</span>}
                </button>
              );
            })}
          </div>
          {selectedEvent && (
            <button className="football-button danger" onClick={deleteSelectedEvent} style={{ marginTop: 10, width: '100%' }}>
              <Trash2 size={14} /> Delete selected event
            </button>
          )}
        </section>
      </>
    );
  };

  const renderTacticsTab = () => (
    <>
      <section className="football-panel-section">
        <div className="football-panel-heading">
          <h2><Layers3 size={15} /> Visible layers</h2>
        </div>
        <div className="football-setting-list">
          <SettingToggle checked={showTacticalLayers} label="Tactical drawings" onChange={setShowTacticalLayers} />
          <SettingToggle checked={showFormations} label="Formation players" onChange={setShowFormations} />
          <SettingToggle checked={showEventMarkers} label="Event markers" onChange={setShowEventMarkers} />
          <SettingToggle checked={showPitchGuide} label="Pitch guide on footage" onChange={setShowPitchGuide} />
        </div>
      </section>

      <section className="football-panel-section">
        <div className="football-panel-heading">
          <h2><Users size={15} /> Team shape</h2>
        </div>
        <div className="football-formation-switch">
          <FormationPicker label={match.homeName} value={homeFormation} onChange={(value) => applyFormation('home', value)} />
          <FormationPicker label={match.awayName} value={awayFormation} onChange={(value) => applyFormation('away', value)} />
        </div>
        <div className="football-formation-phase">
          <button className={`football-segment ${simulationPhase === 'base' ? 'active' : ''}`} onClick={() => setSimulationPhase('base')}>Base shape</button>
          <button className={`football-segment ${simulationPhase === 'target' ? 'active' : ''}`} onClick={() => setSimulationPhase('target')}>Movement</button>
        </div>
        <div className="football-inline-actions">
          <button className="football-button" onClick={resetPlayerShape}><RefreshCw size={14} /> Reset movement</button>
        </div>
        <div className="football-roster-summary">
          <span>{match.homeName}: {homeFormation}</span>
          <span>{match.awayName}: {awayFormation}</span>
        </div>
      </section>

      <section className="football-panel-section">
        <div className="football-panel-heading">
          <h2><Footprints size={15} /> Player inspector</h2>
          <span>{selectedPlayer ? `#${selectedPlayer.number}` : 'None'}</span>
        </div>
        {selectedPlayer ? (
          <div className="football-field-grid">
            <label className="football-field">
              Name
              <input value={selectedPlayer.name} onChange={(event) => updateSelectedPlayer({ name: event.target.value })} />
            </label>
            <label className="football-field">
              Number
              <input min="1" max="99" type="number" value={selectedPlayer.number} onChange={(event) => updateSelectedPlayer({ number: Number(event.target.value) || 1 })} />
            </label>
            <label className="football-field">
              Role
              <input value={selectedPlayer.role} onChange={(event) => updateSelectedPlayer({ role: event.target.value.toUpperCase().slice(0, 7) })} />
            </label>
            <label className="football-field">
              Team
              <input readOnly value={selectedPlayer.team === 'home' ? match.homeName : match.awayName} />
            </label>
          </div>
        ) : (
          <div className="football-empty-state">No player selected.</div>
        )}
      </section>

      <section className="football-panel-section">
        <div className="football-panel-heading">
          <h2><Route size={15} /> Tactical layers</h2>
          <span>{actions.length}</span>
        </div>
        <div className="football-event-list">
          {!actions.length && <div className="football-empty-state">No tactical layers.</div>}
          {actions.map((action, index) => (
            <button
              className={`football-event-row ${selectedActionId === action.id ? 'selected' : ''}`}
              key={action.id}
              onClick={() => {
                setSelectedActionId(action.id);
                setSelectedPlayerId(null);
                seekTo(action.time);
              }}
              style={{ borderLeftColor: action.color || toolConfig[action.type]?.color }}
            >
              <span className="football-event-title"><strong>{index + 1}. {action.label}</strong></span>
              <span className="football-event-minute">{formatTime(action.time)}</span>
              <span className="football-event-meta">{toolConfig[action.type]?.label || action.type} | {action.duration || 3}s</span>
            </button>
          ))}
        </div>
      </section>

      {selectedAction && (
        <section className="football-panel-section">
          <div className="football-panel-heading">
            <h2><Pencil size={15} /> Layer inspector</h2>
          </div>
          <label className="football-field">
            Label
            <input value={selectedAction.label} onChange={(event) => updateSelectedAction({ label: event.target.value })} />
          </label>
          <div className="football-field-grid" style={{ marginTop: 8 }}>
            <label className="football-field">
              Start
              <input min="0" step="0.1" type="number" value={selectedAction.time} onChange={(event) => updateSelectedAction({ time: Number(event.target.value) || 0 })} />
            </label>
            <label className="football-field">
              Duration
              <input min="0.3" step="0.1" type="number" value={selectedAction.duration || 3} onChange={(event) => updateSelectedAction({ duration: Number(event.target.value) || 0.3 })} />
            </label>
          </div>
          <div className="football-color-row" style={{ marginTop: 8 }}>
            <label className="football-field">
              Color
              <input type="color" value={selectedAction.color || '#00a878'} onChange={(event) => updateSelectedAction({ color: event.target.value })} />
            </label>
            <label className="football-field">
              Width
              <input min="2" max="12" type="number" value={selectedAction.strokeWidth || 5} onChange={(event) => updateSelectedAction({ strokeWidth: Number(event.target.value) || 2 })} />
            </label>
          </div>
          <button className="football-button danger" onClick={deleteSelectedAction} style={{ marginTop: 10, width: '100%' }}>
            <Trash2 size={14} /> Delete layer
          </button>
        </section>
      )}
    </>
  );

  const renderCaptureTab = () => (
    <>
      <section className="football-panel-section">
        <div className="football-panel-heading">
          <h2><MonitorUp size={15} /> Reaction capture</h2>
          <span>{isReactionRecording ? 'Live' : 'Ready'}</span>
        </div>
        <label className="football-field">
          Preset
          <select
            disabled={isReactionRecording}
            value={reactionPresetId}
            onChange={(event) => {
              const preset = reactionPresets[event.target.value];
              setReactionPresetId(event.target.value);
              setWebcamEnabled(preset.webcamSize > 0);
              setMicEnabled(preset.mic);
              setSystemAudioEnabled(preset.systemAudio);
            }}
          >
            {Object.entries(reactionPresets).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}
          </select>
        </label>
        <div className="football-setting-list" style={{ marginTop: 9 }}>
          <SettingToggle checked={webcamEnabled} icon={Camera} label="Camera overlay" onChange={setWebcamEnabled} />
          <SettingToggle checked={micEnabled} icon={Mic} label="Microphone" onChange={setMicEnabled} />
          <SettingToggle checked={systemAudioEnabled} icon={Volume2} label="Screen audio" onChange={setSystemAudioEnabled} />
        </div>
        <button
          className={`football-button ${isReactionRecording ? 'recording' : 'primary'}`}
          onClick={isReactionRecording ? stopReactionRecording : startReactionRecording}
          style={{ marginTop: 10, width: '100%' }}
        >
          {isReactionRecording ? <Square size={14} /> : <Video size={14} />}
          {isReactionRecording ? 'Stop recording' : 'Record analysis'}
        </button>
        <div className="football-capture-status">{recordingStatus}</div>
        {savedRecordingPath && <div className="football-capture-status" style={{ wordBreak: 'break-all' }}>{savedRecordingPath}</div>}
      </section>

      {recordedReactionUrl && (
        <section className="football-panel-section">
          <div className="football-panel-heading">
            <h2><Play size={15} /> Latest recording</h2>
          </div>
          <video className="football-recording-preview" controls src={recordedReactionUrl} />
          <button className="football-button" onClick={downloadRecording} style={{ marginTop: 9, width: '100%' }}>
            <Download size={14} /> Download WebM
          </button>
        </section>
      )}

      <section className="football-panel-section">
        <div className="football-panel-heading">
          <h2><Clock3 size={15} /> Speed segments</h2>
          <span>{slowSegments.length}</span>
        </div>
        <button className="football-button" disabled={!videoUrl} onClick={addSpeedSegment} style={{ width: '100%' }}>
          <Plus size={14} /> Add at playhead
        </button>
        <div className="football-event-list" style={{ marginTop: 9 }}>
          {slowSegments.map((segment) => (
            <div className="football-event-row" key={segment.id} style={{ borderLeftColor: '#172033', cursor: 'default' }}>
              <span className="football-event-title"><strong>{segment.speed}x playback</strong></span>
              <button className="football-plain-button" onClick={() => setSlowSegments((previous) => previous.filter((item) => item.id !== segment.id))}>
                <Trash2 size={12} />
              </button>
              <span className="football-event-meta">{formatTime(segment.start)} - {formatTime(segment.end)}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );

  const inspectorTabs = [
    ['analysis', 'Analysis', BarChart3],
    ['events', 'Events', ListPlus],
    ['tactics', 'Tactics', Layers3],
    ['capture', 'Capture', Video]
  ];

  return (
    <div className={`football-lab ${isFullscreen ? 'is-fullscreen' : ''}`} ref={labRef}>
      <input accept="video/*" onChange={handleUpload} ref={fileInputRef} style={{ display: 'none' }} type="file" />

      <header className="football-header">
        <div className="football-header-copy">
          <h1>Football Lab</h1>
          <div className="football-header-meta">
            {match.title} | {match.competition} | {lastSavedAt ? 'Saved locally' : 'Local session'}
          </div>
        </div>
        <div className="football-header-actions">
          <button className="football-button" onClick={() => fileInputRef.current?.click()}>
            <Upload size={15} /><span>Upload footage</span>
          </button>
          <button className="football-button" onClick={toggleFullscreen}>
            <Maximize2 size={15} /><span>Fullscreen</span>
          </button>
          <button className="football-button primary" onClick={exportAnalysis}>
            <Download size={15} /><span>Export analysis</span>
          </button>
        </div>
      </header>

      <section className="football-scoreboard">
        <div className="football-score-team">
          <span className="football-team-mark">H</span>
          <label style={{ minWidth: 0, width: '100%' }}>
            <input aria-label="Home team name" className="football-team-input" value={match.homeName} onChange={(event) => updateMatch({ homeName: event.target.value })} />
            <span className="football-team-label">{homeFormation}</span>
          </label>
        </div>
        <div className="football-score-center">
          <input
            aria-label={`${match.homeName} score`}
            className="football-score-input"
            min="0"
            type="number"
            value={match.homeScore}
            onChange={(event) => updateMatch({ homeScore: Math.max(0, Number(event.target.value) || 0) })}
          />
          <span className="football-score-divider">-</span>
          <input
            aria-label={`${match.awayName} score`}
            className="football-score-input"
            min="0"
            type="number"
            value={match.awayScore}
            onChange={(event) => updateMatch({ awayScore: Math.max(0, Number(event.target.value) || 0) })}
          />
        </div>
        <div className="football-score-team away">
          <span className="football-team-mark">A</span>
          <label style={{ minWidth: 0, width: '100%' }}>
            <input aria-label="Away team name" className="football-team-input" value={match.awayName} onChange={(event) => updateMatch({ awayName: event.target.value })} />
            <span className="football-team-label">{awayFormation}</span>
          </label>
        </div>
        <div className="football-match-clock">
          <Clock3 size={18} />
          <strong>{match.period}</strong>
          <span>{formatTime(currentTime)} | {events.length} tagged events</span>
        </div>
      </section>

      <div className="football-workspace">
        <main className="football-review">
          <div className="football-review-bar">
            <div className="football-view-switch">
              <button
                className={`football-segment ${sourceMode === 'video' ? 'active' : ''}`}
                onClick={() => {
                  setSourceMode('video');
                  setInspectorTab(videoUrl ? 'events' : 'analysis');
                  if (videoUrl) setShowFormations(false);
                }}
              >
                <Video size={13} /> Footage
              </button>
              <button
                className={`football-segment ${sourceMode === 'board' ? 'active' : ''}`}
                onClick={() => {
                  setSourceMode('board');
                  setInspectorTab('tactics');
                  setShowFormations(true);
                }}
              >
                <Map size={13} /> Tactics board
              </button>
            </div>
            <div className="football-stage-meta">
              <Video size={13} />
              <span>{sourceMode === 'video' ? videoName : `${match.homeName} vs ${match.awayName}`}</span>
            </div>
            <div className="football-layer-actions">
              <button className="football-icon-button" onClick={() => setShowTacticalLayers((value) => !value)} title={showTacticalLayers ? 'Hide tactical layers' : 'Show tactical layers'}>
                {showTacticalLayers ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
              <button className="football-icon-button" onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
            </div>
          </div>

          <div className="football-tool-strip">
            <div className="football-tool-scroll">
              {Object.entries(toolConfig).map(([toolId, tool]) => {
                const Icon = tool.icon;
                return (
                  <button
                    className={`football-tool ${activeTool === toolId ? 'active' : ''}`}
                    key={toolId}
                    onClick={() => {
                      setActiveTool(toolId);
                      setDraftStart(null);
                      setDraftPath([]);
                    }}
                    title={tool.label}
                  >
                    <Icon size={14} />
                    <span>{tool.label}</span>
                  </button>
                );
              })}
              <span className="football-tool-divider" />
              <button className={`football-tool event-tool ${activeTool === 'event' ? 'active' : ''}`} onClick={activateEventTool} title="Tag match event">
                <ListPlus size={14} /><span>Tag event</span>
              </button>
            </div>
            <div className="football-tool-actions">
              <button className="football-icon-button" disabled={!actions.length} onClick={undoLastAction} title="Undo last layer"><Undo2 size={15} /></button>
              <button
                className="football-icon-button"
                disabled={!actions.length}
                onClick={() => {
                  setActions([]);
                  setSelectedActionId(null);
                  setStatus('Tactical layers cleared');
                }}
                title="Clear tactical layers"
              >
                <Eraser size={15} />
              </button>
            </div>
          </div>

          <div
            className={`football-stage ${activeTool !== 'select' ? 'is-drawing' : ''}`}
            onPointerCancel={handleBoardPointerUp}
            onPointerDown={handleBoardPointerDown}
            onPointerMove={handleBoardPointerMove}
            onPointerUp={handleBoardPointerUp}
          >
            {sourceMode === 'board' ? (
              <div className="football-board">
                <PitchLines />
              </div>
            ) : videoUrl ? (
              <video
                className="football-match-video"
                onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
                onPause={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onTimeUpdate={handleTimeUpdate}
                ref={videoRef}
                src={videoUrl}
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: `${zoomAnchor.x}% ${zoomAnchor.y}%`,
                  transition: 'transform 0.16s ease'
                }}
              />
            ) : (
              <div className="football-stage-empty">
                <Video size={34} />
                <strong>No footage loaded</strong>
                <button className="football-button" onClick={(event) => {
                  event.stopPropagation();
                  fileInputRef.current?.click();
                }}>
                  <Upload size={14} /> Upload footage
                </button>
              </div>
            )}

            {sourceMode === 'video' && showPitchGuide && <PitchLines />}
            {showFormations && players.map(renderPlayer)}
            {showTacticalLayers && actions.map(renderAction)}
            {showTacticalLayers && renderDraftPath()}
            {showEventMarkers && stageEvents.map(renderEventMarker)}
            {eventPoint && <span className="football-event-point" style={{ left: `${eventPoint.x}%`, top: `${eventPoint.y}%` }} />}

            {webcamEnabled && reactionPreset.webcamSize > 0 && (
              <div className="football-camera-preview" style={{ width: `${reactionPreset.webcamSize * 100}%` }}>
                <video autoPlay muted playsInline ref={webcamPreviewRef} />
              </div>
            )}
            {isReactionRecording && (
              <div className="football-live-badge">
                <span className="football-live-dot" /> Recording
              </div>
            )}
          </div>

          <div className="football-transport">
            <div className="football-transport-group">
              <button className="football-icon-button" disabled={!videoUrl || sourceMode !== 'video'} onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <span className="football-timecode">{formatTime(currentTime)} / {formatTime(duration)}</span>
            </div>
            <div className="football-transport-group">
              {[0.5, 1, 1.5, 2].map((speed) => (
                <button
                  className={`football-segment football-speed ${playbackSpeed === speed ? 'active' : ''}`}
                  disabled={!videoUrl}
                  key={speed}
                  onClick={() => setVideoSpeed(speed)}
                >
                  {speed}x
                </button>
              ))}
              <span className="football-tool-divider" />
              <button className="football-icon-button" disabled={!videoUrl} onClick={() => setZoomLevel((value) => clamp(Number((value - 0.25).toFixed(2)), 1, 3))} title="Zoom out"><Minus size={15} /></button>
              <span className="football-timecode">{zoomLevel.toFixed(2)}x</span>
              <button className="football-icon-button" disabled={!videoUrl} onClick={() => setZoomLevel((value) => clamp(Number((value + 0.25).toFixed(2)), 1, 3))} title="Zoom in"><Plus size={15} /></button>
            </div>
          </div>

          <div className="football-timeline">
            <input
              max={timelineDuration}
              min="0"
              onChange={(event) => seekTo(event.target.value)}
              step="0.01"
              type="range"
              value={clamp(currentTime, 0, timelineDuration)}
            />
            <div className="football-timeline-ruler">
              <span>{formatTime(currentTime)}</span>
              <span>{videoUrl ? formatTime(duration) : '90:00'}</span>
            </div>
            <div className="football-timeline-track">
              {actions.map((action) => (
                <button
                  className="football-timeline-item layer"
                  key={action.id}
                  onClick={() => {
                    setSelectedActionId(action.id);
                    setInspectorTab('tactics');
                    seekTo(action.time);
                  }}
                  style={{
                    background: action.color || toolConfig[action.type]?.color,
                    left: `${(action.time / timelineDuration) * 100}%`,
                    width: `${Math.max(0.8, ((action.duration || 3) / timelineDuration) * 100)}%`
                  }}
                  title={`${action.label} at ${formatTime(action.time)}`}
                />
              ))}
              {events.map((event) => (
                <button
                  className="football-timeline-item event"
                  key={event.id}
                  onClick={() => openEvent(event)}
                  style={{
                    background: eventTypes[event.type]?.color || '#7c3aed',
                    left: `${(event.time / timelineDuration) * 100}%`
                  }}
                  title={`${eventTypes[event.type]?.label || event.type} at ${event.minute}'`}
                />
              ))}
            </div>
          </div>

          <div className="football-status-line">
            <strong>{status}</strong>
            <span>{actions.length} layers | {events.length} events | {lastSavedAt ? 'Autosaved' : 'Saving'}</span>
          </div>
        </main>

        <aside className="football-inspector">
          <div className="football-tabs">
            {inspectorTabs.map(([tabId, label, Icon]) => (
              <button
                aria-label={`${label} inspector`}
                className={`football-tab ${inspectorTab === tabId ? 'active' : ''}`}
                key={tabId}
                onClick={() => setInspectorTab(tabId)}
                title={label}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
          <div className="football-inspector-body">
            {inspectorTab === 'analysis' && renderAnalysisTab()}
            {inspectorTab === 'events' && renderEventsTab()}
            {inspectorTab === 'tactics' && renderTacticsTab()}
            {inspectorTab === 'capture' && renderCaptureTab()}
          </div>
        </aside>
      </div>
    </div>
  );
}

function PitchLines() {
  return (
    <svg className="football-pitch-lines" viewBox="0 0 160 90" preserveAspectRatio="none" aria-hidden="true">
      <rect x="6" y="6" width="148" height="78" fill="none" stroke="rgba(255,255,255,0.58)" strokeWidth="0.6" />
      <line x1="80" y1="6" x2="80" y2="84" stroke="rgba(255,255,255,0.58)" strokeWidth="0.6" />
      <ellipse cx="80" cy="45" rx="10" ry="10" fill="none" stroke="rgba(255,255,255,0.58)" strokeWidth="0.6" />
      <circle cx="80" cy="45" r="0.8" fill="rgba(255,255,255,0.7)" />
      <rect x="6" y="24" width="22" height="42" fill="none" stroke="rgba(255,255,255,0.58)" strokeWidth="0.6" />
      <rect x="132" y="24" width="22" height="42" fill="none" stroke="rgba(255,255,255,0.58)" strokeWidth="0.6" />
      <rect x="6" y="34" width="8" height="22" fill="none" stroke="rgba(255,255,255,0.58)" strokeWidth="0.6" />
      <rect x="146" y="34" width="8" height="22" fill="none" stroke="rgba(255,255,255,0.58)" strokeWidth="0.6" />
      <circle cx="21" cy="45" r="0.8" fill="rgba(255,255,255,0.7)" />
      <circle cx="139" cy="45" r="0.8" fill="rgba(255,255,255,0.7)" />
      <path d="M28 36 A10 10 0 0 1 28 54" fill="none" stroke="rgba(255,255,255,0.58)" strokeWidth="0.6" />
      <path d="M132 36 A10 10 0 0 0 132 54" fill="none" stroke="rgba(255,255,255,0.58)" strokeWidth="0.6" />
    </svg>
  );
}

function FormationPicker({ label, value, onChange }) {
  return (
    <label className="football-field">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {Object.keys(formations).map((formation) => (
          <option key={formation} value={formation}>{formation}</option>
        ))}
      </select>
    </label>
  );
}

function SettingToggle({ checked, icon: Icon, label, onChange }) {
  return (
    <label className="football-setting-row">
      <span style={{ alignItems: 'center', display: 'flex', gap: 7 }}>
        {Icon && <Icon size={14} />}
        {label}
      </span>
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
    </label>
  );
}
