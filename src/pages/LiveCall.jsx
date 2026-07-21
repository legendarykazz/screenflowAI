import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import {
  Bot,
  Camera,
  Circle,
  Copy,
  Eraser,
  Expand,
  EyeOff,
  Highlighter,
  Monitor,
  Mic,
  Minus,
  MousePointer2,
  Pencil,
  PhoneOff,
  Play,
  Plus,
  RotateCcw,
  ScreenShare,
  Sparkles,
  Square,
  Type,
  Users,
  Video
} from 'lucide-react';

const toolOptions = [
  { id: 'pointer', label: 'Pointer', icon: MousePointer2 },
  { id: 'pen', label: 'Pen', icon: Pencil },
  { id: 'underline', label: 'Underline', icon: Highlighter },
  { id: 'circle', label: 'Circle', icon: Circle },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'spotlight', label: 'Spotlight', icon: Square },
  { id: 'hide', label: 'Hide', icon: EyeOff },
  { id: 'erase', label: 'Eraser', icon: Eraser }
];

const noteSeeds = [
  'AI is listening for decisions, blockers, and follow-ups.',
  'Screen annotations are included in the live output stream.',
  'Ask AI can summarize the current call context for participants.'
];

const boardColors = ['#111827', '#FF4D7E', '#00E0FF', '#FFB800', '#00C48C'];

export default function LiveCall() {
  const canvasRef = useRef(null);
  const outputVideoRef = useRef(null);
  const sourceVideoRef = useRef(null);
  const streamRef = useRef(null);
  const outputStreamRef = useRef(null);
  const audioStreamRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const cameraPreviewRef = useRef(null);
  const animationRef = useRef(null);
  const liveKitRoomRef = useRef(null);
  const liveKitVideoTrackRef = useRef(null);
  const liveKitAudioTrackRef = useRef(null);
  const liveKitCameraTrackRef = useRef(null);
  const remoteMediaRef = useRef(null);
  const pathsRef = useRef([]);
  const draftRef = useRef(null);
  const spotlightRef = useRef(null);
  const hideZonesRef = useRef([]);
  const textNotesRef = useRef([]);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0.5, y: 0.5 });
  const shareModeRef = useRef('screen');

  const [isLive, setIsLive] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [tool, setTool] = useState('pointer');
  const [zoom, setZoom] = useState(1);
  const [color, setColor] = useState('#FF4D7E');
  const [status, setStatus] = useState('Start a live room to share an enhanced screen feed.');
  const [notes, setNotes] = useState(noteSeeds);
  const [isDrawing, setIsDrawing] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [presenterMode, setPresenterMode] = useState(false);
  const [outputMode, setOutputMode] = useState('enhanced');
  const [shareMode, setShareMode] = useState('screen');
  const [sourceName, setSourceName] = useState('No screen selected');
  const [sources, setSources] = useState([]);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [textDraft, setTextDraft] = useState(null);
  const [keyboardTextAnchor, setKeyboardTextAnchor] = useState({ x: 0.08, y: 0.18 });
  const [participantName, setParticipantName] = useState('Alex Presenter');
  const [liveKitStatus, setLiveKitStatus] = useState('Not connected');
  const [remoteParticipants, setRemoteParticipants] = useState([]);
  const [isLiveKitConnected, setIsLiveKitConnected] = useState(false);
  const isBrowserPresenter = !window.navigator?.userAgent?.toLowerCase?.().includes('electron') && !window.electron?.getAppVersion;

  const [roomCode, setRoomCode] = useState(() => `SF-${Math.random().toString(36).slice(2, 7).toUpperCase()}`);
  const joinBaseUrl = import.meta.env.VITE_JOIN_BASE_URL || 'https://screenflow.ai';
  const inviteLink = useMemo(() => `${joinBaseUrl.replace(/\/$/, '')}/join/${roomCode}`, [joinBaseUrl, roomCode]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    shareModeRef.current = shareMode;
  }, [shareMode]);

  useEffect(() => {
    if (cameraPreviewRef.current) {
      cameraPreviewRef.current.srcObject = cameraOn ? cameraStreamRef.current : null;
    }
  }, [cameraOn]);

  useEffect(() => {
    loadSources();
    return () => {
      stopRoom();
    };
  }, []);

  const loadSources = async () => {
    if (!window.electron?.getSources) return;
    const sourceList = await window.electron.getSources();
    setSources(sourceList);
    if (!selectedSourceId && sourceList.length > 0) {
      setSelectedSourceId(sourceList[0].id);
      setSourceName(sourceList[0].name);
    }
  };

  const startRoom = async (sourceId = selectedSourceId) => {
    try {
      const selectedSource = sources.find((source) => source.id === sourceId);
      if (shareModeRef.current === 'whiteboard') {
        setIsLive(true);
        setSourceName('Whiteboard');
        setStatus('Live whiteboard feed is running.');
        const canvas = canvasRef.current;
        canvas.width = 1920;
        canvas.height = 1080;
        const outputStream = canvas.captureStream(30);
        outputStreamRef.current = outputStream;
        if (outputVideoRef.current) outputVideoRef.current.srcObject = outputStream;
        await publishOutputStream(outputStream);
        renderFrame();
        return;
      }

      if (sourceId && window.electron?.setLiveDisplaySource) {
        await window.electron.setLiveDisplaySource(sourceId);
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true
      });
      const trackLabel = screenStream.getVideoTracks()[0]?.label || 'Selected screen';

      streamRef.current = screenStream;
      setIsLive(true);
      setSelectedSourceId(sourceId || '');
      setSourceName(selectedSource?.name || trackLabel);
      setStatus('Live enhanced screen feed is running.');

      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = screenStream;
      sourceVideoRef.current = video;
      await video.play();

      const canvas = canvasRef.current;
      const trackSettings = screenStream.getVideoTracks()[0]?.getSettings?.() || {};
      canvas.width = trackSettings.width || 1920;
      canvas.height = trackSettings.height || 1080;

      const outputStream = canvas.captureStream(30);
      outputStreamRef.current = outputStream;
      if (outputVideoRef.current) {
        outputVideoRef.current.srcObject = outputStream;
      }
      await publishOutputStream(outputStream);

      screenStream.getVideoTracks()[0]?.addEventListener('ended', stopRoom);
      renderFrame();
    } catch (error) {
      setStatus(error?.message || 'Screen sharing was cancelled.');
    }
  };

  const toggleMic = async () => {
    if (micOn) {
      if (liveKitAudioTrackRef.current && liveKitRoomRef.current) {
        await liveKitRoomRef.current.localParticipant.unpublishTrack(liveKitAudioTrackRef.current);
        liveKitAudioTrackRef.current = null;
      }
      audioStreamRef.current?.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
      setMicOn(false);
      setNotes((current) => ['Microphone muted. AI notetaker remains ready.', ...current]);
      return;
    }

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = audioStream;
      setMicOn(true);
      await publishMicStream(audioStream);
      setNotes((current) => ['Microphone enabled. AI notetaker can attach live transcription later.', ...current]);
    } catch (error) {
      setStatus(error?.message || 'Microphone permission was not granted.');
    }
  };

  const toggleCamera = async () => {
    if (cameraOn) {
      if (liveKitCameraTrackRef.current && liveKitRoomRef.current) {
        await liveKitRoomRef.current.localParticipant.unpublishTrack(liveKitCameraTrackRef.current);
        liveKitCameraTrackRef.current = null;
      }
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = null;
      setCameraOn(false);
      setNotes((current) => ['Presenter camera turned off.', ...current]);
      return;
    }

    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: false
      });
      cameraStreamRef.current = cameraStream;
      if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = cameraStream;
      setCameraOn(true);
      await publishCameraStream(cameraStream);
      setNotes((current) => ['Presenter camera is live.', ...current]);
    } catch (error) {
      setStatus(error?.message || 'Camera permission was not granted.');
    }
  };

  const stopRoom = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    audioStreamRef.current = null;
    cameraStreamRef.current = null;
    sourceVideoRef.current = null;
    outputStreamRef.current = null;
    if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = null;
    if (outputVideoRef.current) outputVideoRef.current.srcObject = null;
    setIsLive(false);
    setMicOn(false);
    setCameraOn(false);
    setSourceName(shareMode === 'whiteboard' ? 'Whiteboard' : 'No screen selected');
    setStatus('Live room ended.');
  };

  const connectLiveKit = async () => {
    if (liveKitRoomRef.current) return liveKitRoomRef.current;
    try {
      if (!window.electron?.createLiveKitToken) {
        setLiveKitStatus('LiveKit token bridge is unavailable.');
        return null;
      }

      setLiveKitStatus('Creating LiveKit token...');
      const tokenResult = await window.electron.createLiveKitToken(roomCode, participantName || 'Presenter');
      if (!tokenResult.success) {
        setLiveKitStatus(tokenResult.error);
        return null;
      }

      setLiveKitStatus(`Connecting to ${tokenResult.url}...`);
      const room = new Room({
        adaptiveStream: true,
        dynacast: true
      });

      room.on(RoomEvent.ParticipantConnected, updateRemoteParticipants);
      room.on(RoomEvent.ParticipantDisconnected, updateRemoteParticipants);
      room.on(RoomEvent.TrackSubscribed, (track) => {
        attachRemoteTrack(track);
        updateRemoteParticipants();
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((element) => element.remove());
        updateRemoteParticipants();
      });
      room.on(RoomEvent.Disconnected, (reason) => {
        liveKitRoomRef.current = null;
        liveKitVideoTrackRef.current = null;
        liveKitAudioTrackRef.current = null;
        liveKitCameraTrackRef.current = null;
        setIsLiveKitConnected(false);
        setLiveKitStatus(reason ? `Disconnected: ${String(reason)}` : 'Disconnected');
        setRemoteParticipants([]);
      });

      await room.connect(tokenResult.url, tokenResult.token);
      room.engine?.client?.on?.('signalDisconnected', () => {
        setLiveKitStatus('Signal disconnected. Check browser WebRTC/network permissions.');
      });
      liveKitRoomRef.current = room;
      setIsLiveKitConnected(true);
      setLiveKitStatus(`Connected as ${tokenResult.identity}`);
      updateRemoteParticipants(room);

      if (outputStreamRef.current) await publishOutputStream(outputStreamRef.current);
      if (audioStreamRef.current) await publishMicStream(audioStreamRef.current);
      if (cameraStreamRef.current) await publishCameraStream(cameraStreamRef.current);
      return room;
    } catch (error) {
      setIsLiveKitConnected(false);
      const message = error?.message || error?.reason || error?.toString?.() || 'LiveKit connection failed.';
      setLiveKitStatus(`Connect failed: ${message}`);
      return null;
    }
  };

  const disconnectLiveKit = () => {
    liveKitRoomRef.current?.disconnect();
    liveKitRoomRef.current = null;
    liveKitVideoTrackRef.current = null;
    liveKitAudioTrackRef.current = null;
    liveKitCameraTrackRef.current = null;
    setIsLiveKitConnected(false);
    setLiveKitStatus('Disconnected');
    setRemoteParticipants([]);
    if (remoteMediaRef.current) remoteMediaRef.current.innerHTML = '';
  };

  const publishOutputStream = async (outputStream) => {
    const room = liveKitRoomRef.current;
    const videoTrack = outputStream?.getVideoTracks?.()[0];
    if (!room || !videoTrack) return;

    if (liveKitVideoTrackRef.current) {
      await room.localParticipant.unpublishTrack(liveKitVideoTrackRef.current);
    }

    liveKitVideoTrackRef.current = videoTrack;
    await room.localParticipant.publishTrack(videoTrack, {
      name: 'screenflow-enhanced-output',
      source: Track.Source.ScreenShare,
      simulcast: false,
      videoEncoding: {
        maxBitrate: 3_500_000,
        maxFramerate: 30
      }
    });
    setLiveKitStatus('Publishing enhanced output');
  };

  const publishMicStream = async (audioStream) => {
    const room = liveKitRoomRef.current;
    const audioTrack = audioStream?.getAudioTracks?.()[0];
    if (!room || !audioTrack) return;

    if (liveKitAudioTrackRef.current) {
      await room.localParticipant.unpublishTrack(liveKitAudioTrackRef.current);
    }

    liveKitAudioTrackRef.current = audioTrack;
    await room.localParticipant.publishTrack(audioTrack, {
      name: 'presenter-mic',
      source: Track.Source.Microphone
    });
  };

  const publishCameraStream = async (cameraStream) => {
    const room = liveKitRoomRef.current;
    const cameraTrack = cameraStream?.getVideoTracks?.()[0];
    if (!room || !cameraTrack) return;

    if (liveKitCameraTrackRef.current) {
      await room.localParticipant.unpublishTrack(liveKitCameraTrackRef.current);
    }

    liveKitCameraTrackRef.current = cameraTrack;
    await room.localParticipant.publishTrack(cameraTrack, {
      name: 'presenter-camera',
      source: Track.Source.Camera,
      videoEncoding: {
        maxBitrate: 1_200_000,
        maxFramerate: 30
      }
    });
  };

  const attachRemoteTrack = (track) => {
    if (!remoteMediaRef.current) return;
    const element = track.attach();
    element.style.width = '100%';
    element.style.borderRadius = '8px';
    element.style.background = '#0B0F19';
    element.style.marginTop = '8px';
    if (track.kind === 'audio') element.style.display = 'none';
    remoteMediaRef.current.appendChild(element);
  };

  const updateRemoteParticipants = (room = liveKitRoomRef.current) => {
    if (!room) return;
    const participants = Array.from(room.remoteParticipants.values()).map((participant) => ({
      identity: participant.identity,
      name: participant.name || participant.identity
    }));
    setRemoteParticipants(participants);
  };

  const renderFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const currentZoom = zoomRef.current;

    if (shareModeRef.current === 'whiteboard') {
      drawWhiteboard(ctx, width, height);
      drawAnnotations(ctx, width, height);
      drawLiveBadge(ctx, width);
      animationRef.current = requestAnimationFrame(renderFrame);
      return;
    }

    const video = sourceVideoRef.current;
    if (!video) return;

    const sourceWidth = video.videoWidth || width;
    const sourceHeight = video.videoHeight || height;
    const sourceRatio = sourceWidth / sourceHeight;
    const outputRatio = width / height;

    let baseW = sourceWidth;
    let baseH = sourceHeight;
    let baseX = 0;
    let baseY = 0;

    if (sourceRatio > outputRatio) {
      baseW = sourceHeight * outputRatio;
      baseX = (sourceWidth - baseW) / 2;
    } else {
      baseH = sourceWidth / outputRatio;
      baseY = (sourceHeight - baseH) / 2;
    }

    const drawW = baseW / currentZoom;
    const drawH = baseH / currentZoom;
    const maxX = baseX + baseW - drawW;
    const maxY = baseY + baseH - drawH;
    const sx = clamp(baseX + baseW * panRef.current.x - drawW / 2, baseX, maxX);
    const sy = clamp(baseY + baseH * panRef.current.y - drawH / 2, baseY, maxY);

    ctx.fillStyle = '#090B12';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(video, sx, sy, drawW, drawH, 0, 0, width, height);

    drawAnnotations(ctx, width, height);
    drawSpotlight(ctx, width, height);
    drawHideZones(ctx, width, height);
    drawLiveBadge(ctx, width);

    animationRef.current = requestAnimationFrame(renderFrame);
  };

  const drawWhiteboard = (ctx, width, height) => {
    ctx.fillStyle = '#FBFCFF';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#E8EDF5';
    ctx.lineWidth = 2;
    for (let x = 0; x < width; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#172033';
    ctx.font = '900 42px system-ui, sans-serif';
    ctx.fillText('Live Whiteboard', 56, 82);
    textNotesRef.current.forEach((note) => {
      ctx.fillStyle = note.color;
      ctx.font = '800 34px system-ui, sans-serif';
      note.text.split('\n').forEach((line, index) => {
        ctx.fillText(line, note.x * width, note.y * height + index * 42);
      });
    });
  };

  const drawAnnotations = (ctx, width, height) => {
    const allPaths = draftRef.current ? [...pathsRef.current, draftRef.current] : pathsRef.current;
    allPaths.forEach((path) => {
      ctx.save();
      ctx.strokeStyle = path.color;
      ctx.fillStyle = path.color;
      ctx.lineWidth = path.kind === 'underline' ? 10 : 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (path.kind === 'circle' || path.kind === 'hide' || path.kind === 'spotlight') {
        const box = getBox(path.points[0], path.points[path.points.length - 1], width, height);
        if (path.kind === 'circle') {
          ctx.beginPath();
          ctx.ellipse(box.x + box.w / 2, box.y + box.h / 2, Math.max(12, box.w / 2), Math.max(12, box.h / 2), 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
        return;
      }

      ctx.beginPath();
      path.points.forEach((point, index) => {
        const x = point.x * width;
        const y = point.y * height;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    });
  };

  const drawSpotlight = (ctx, width, height) => {
    const activeSpotlight = draftRef.current?.kind === 'spotlight' ? draftRef.current : spotlightRef.current;
    if (!activeSpotlight) return;

    const box = getBox(activeSpotlight.points[0], activeSpotlight.points[activeSpotlight.points.length - 1], width, height);
    ctx.save();
    ctx.fillStyle = 'rgba(4, 8, 16, 0.62)';
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, Math.max(24, box.w), Math.max(24, box.h), 24);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#00E0FF';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();
  };

  const drawHideZones = (ctx, width, height) => {
    const zones = draftRef.current?.kind === 'hide' ? [...hideZonesRef.current, draftRef.current] : hideZonesRef.current;
    zones.forEach((zone) => {
      const box = getBox(zone.points[0], zone.points[zone.points.length - 1], width, height);
      ctx.save();
      ctx.fillStyle = 'rgba(10, 14, 25, 0.94)';
      ctx.beginPath();
      ctx.roundRect(box.x, box.y, Math.max(18, box.w), Math.max(18, box.h), 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    });
  };

  const drawLiveBadge = (ctx, width) => {
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(28, 28, 178, 52, 14);
    ctx.fill();
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(56, 54, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 18px system-ui, sans-serif';
    ctx.fillText(`${zoomRef.current.toFixed(1)}x live`, 76, 61);
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('ScreenFlow AI', width - 32, 62);
    ctx.restore();
  };

  const handlePointerDown = (event) => {
    if ((!isLive && shareMode !== 'whiteboard') || tool === 'pointer') return;
    const point = eventToPoint(event);
    setIsDrawing(true);

    if (tool === 'text') {
      setTextDraft({ text: '', color, x: point.x, y: point.y });
      setIsDrawing(false);
      return;
    }

    if (tool === 'erase') {
      eraseAt(point);
      return;
    }

    draftRef.current = { kind: tool, color, points: [point] };
  };

  const handlePointerMove = (event) => {
    if (!isLive && shareMode !== 'whiteboard') return;
    const point = eventToPoint(event);

    if (tool === 'pointer' && event.buttons === 1) {
      panRef.current = point;
      return;
    }

    if (!isDrawing || !draftRef.current) return;
    if (['circle', 'spotlight', 'hide', 'underline'].includes(draftRef.current.kind)) {
      draftRef.current.points = [draftRef.current.points[0], point];
    } else {
      draftRef.current.points = [...draftRef.current.points, point];
    }
  };

  const handlePointerUp = () => {
    if (!draftRef.current) {
      setIsDrawing(false);
      return;
    }

    if (draftRef.current.kind === 'spotlight') {
      spotlightRef.current = draftRef.current;
    } else if (draftRef.current.kind === 'hide') {
      hideZonesRef.current = [...hideZonesRef.current, draftRef.current];
    } else {
      pathsRef.current = [...pathsRef.current, draftRef.current];
    }

    draftRef.current = null;
    setIsDrawing(false);
  };

  const eventToPoint = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1)
    };
  };

  const eraseAt = (point) => {
    pathsRef.current = pathsRef.current.filter((path) => (
      path.points.every((pathPoint) => distance(point, pathPoint) > 0.04)
    ));
    hideZonesRef.current = hideZonesRef.current.filter((zone) => {
      const start = zone.points[0];
      const end = zone.points[zone.points.length - 1];
      return point.x < Math.min(start.x, end.x) || point.x > Math.max(start.x, end.x) || point.y < Math.min(start.y, end.y) || point.y > Math.max(start.y, end.y);
    });
  };

  const clearMarks = () => {
    pathsRef.current = [];
    hideZonesRef.current = [];
    spotlightRef.current = null;
    textNotesRef.current = [];
    draftRef.current = null;
    setNotes((current) => ['Presenter cleared all live annotations.', ...current]);
  };

  const askAi = () => {
    setNotes((current) => [
      'AI draft: The presenter is walking through a live screen with guided zoom and visibility controls. Current follow-up: connect this canvas stream to the call provider.',
      ...current
    ]);
  };

  const adjustZoom = (delta) => {
    setZoom((current) => clamp(Number((current + delta).toFixed(1)), 1, 3));
  };

  const commitTextDraft = ({ continueTyping = false } = {}) => {
    if (!textDraft) return;
    const text = textDraft.text.trim();
    const nextDraft = {
      text: '',
      color: textDraft.color,
      x: textDraft.x,
      y: clamp(textDraft.y + 0.055, 0.04, 0.94)
    };
    if (text) {
      textNotesRef.current = [...textNotesRef.current, { ...textDraft, text }];
      setNotes((current) => [`Whiteboard note added: ${text}`, ...current]);
    }
    setKeyboardTextAnchor({ x: nextDraft.x, y: nextDraft.y });
    setTextDraft(continueTyping ? nextDraft : null);
    if (continueTyping) setTool('text');
  };

  const handleBoardKeyDown = (event) => {
    if (shareMode !== 'whiteboard' || textDraft) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length !== 1) return;

    event.preventDefault();
    setTool('text');
    setTextDraft({
      text: event.key,
      color,
      x: keyboardTextAnchor.x,
      y: keyboardTextAnchor.y
    });
  };

  const selectSource = async (source) => {
    setSelectedSourceId(source.id);
    setSourceName(source.name);
    if (window.electron?.setLiveDisplaySource) {
      await window.electron.setLiveDisplaySource(source.id);
    }
  };

  const activateWhiteboard = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    sourceVideoRef.current = null;
    shareModeRef.current = 'whiteboard';
    setShareMode('whiteboard');
    setSourceName('Whiteboard');
    setStatus('Whiteboard ready. Type, draw, circle, or underline points.');

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvas.width || 1920;
      canvas.height = canvas.height || 1080;
    }

    requestAnimationFrame(renderFrame);
  };

  const switchScreen = async (sourceId = selectedSourceId) => {
    if (isLive) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      sourceVideoRef.current = null;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
    await startRoom(sourceId);
    setNotes((current) => ['Presenter switched the shared screen source.', ...current]);
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedInvite(true);
      setNotes((current) => [`Invite copied: ${inviteLink}`, ...current]);
      setTimeout(() => setCopiedInvite(false), 1800);
    } catch (error) {
      setStatus('Could not copy the invite link. You can copy it manually from the invite box.');
    }
  };

  const enterPresenterMode = async () => {
    setPresenterMode(true);
    setTimeout(async () => {
      try {
        await document.documentElement.requestFullscreen?.();
      } catch (error) {
        setStatus('Presenter mode is active. Fullscreen permission was not granted by the window.');
      }
    }, 0);
  };

  const exitPresenterMode = async () => {
    setPresenterMode(false);
    if (document.fullscreenElement) {
      await document.exitFullscreen?.();
    }
  };

  return (
    <div style={presenterMode ? presenterPageStyle : pageStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Live Call Studio</h1>
          <p style={subtitleStyle}>Human calls with an AI notetaker and a presenter-controlled screen feed.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={roomBadgeStyle}><Users size={15} /> {roomCode}</span>
          <button onClick={copyInvite} style={secondaryHeaderButtonStyle}><Copy size={16} /> {copiedInvite ? 'Copied' : 'Invite'}</button>
          {presenterMode ? (
            <button onClick={exitPresenterMode} style={secondaryHeaderButtonStyle}><Expand size={16} /> Exit Fullscreen</button>
          ) : (
            <button onClick={enterPresenterMode} style={secondaryHeaderButtonStyle}><Expand size={16} /> Fullscreen</button>
          )}
          {isLive ? (
            <button onClick={stopRoom} style={dangerButtonStyle}><PhoneOff size={17} /> End Call</button>
          ) : (
            <button onClick={() => startRoom()} style={primaryButtonStyle}><ScreenShare size={17} /> Start Live Room</button>
          )}
        </div>
      </header>

      <section style={presenterMode ? presenterWorkspaceStyle : workspaceStyle}>
        <div style={presenterMode ? presenterStagePanelStyle : stagePanelStyle}>
          <div style={toolBarStyle}>
            {toolOptions.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  aria-label={item.label}
                  className="tooltip"
                  data-tooltip={item.label}
                  key={item.id}
                  onClick={() => setTool((current) => current === item.id ? 'pointer' : item.id)}
                  style={iconButtonStyle(tool === item.id)}
                >
                  <Icon size={18} />
                </button>
              );
            })}
            <div style={dividerStyle} />
            {boardColors.map((swatch) => (
              <button
                aria-label={`Use ${swatch}`}
                key={swatch}
                onClick={() => setColor(swatch)}
                style={swatchStyle(swatch, color === swatch)}
              />
            ))}
            <div style={dividerStyle} />
            <button aria-label="Zoom out" className="tooltip" data-tooltip="Zoom out" onClick={() => adjustZoom(-0.2)} style={iconButtonStyle(false)}><Minus size={18} /></button>
            <span style={zoomPillStyle}>{zoom.toFixed(1)}x</span>
            <button aria-label="Zoom in" className="tooltip" data-tooltip="Zoom in" onClick={() => adjustZoom(0.2)} style={iconButtonStyle(false)}><Plus size={18} /></button>
            <button aria-label="Clear" className="tooltip" data-tooltip="Clear marks" onClick={clearMarks} style={iconButtonStyle(false)}><RotateCcw size={18} /></button>
          </div>

          <div
            onKeyDown={handleBoardKeyDown}
            onPointerDown={(event) => event.currentTarget.focus()}
            tabIndex={0}
            style={canvasWrapStyle}
          >
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onPointerMove={(event) => {
                if (shareMode === 'whiteboard') {
                  setKeyboardTextAnchor(eventToPoint(event));
                }
                handlePointerMove(event);
              }}
              style={canvasStyle}
            />
            {textDraft && (
              <textarea
                autoFocus
                key={`${textDraft.x}-${textDraft.y}`}
                value={textDraft.text}
                onChange={(event) => setTextDraft((draft) => ({ ...draft, text: event.target.value }))}
                onBlur={() => commitTextDraft()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    commitTextDraft({ continueTyping: true });
                  }
                  if (event.key === 'Escape') {
                    setTextDraft(null);
                  }
                }}
                placeholder="Type point"
                style={{
                  ...whiteboardTextInputStyle,
                  color: textDraft.color,
                  left: `${textDraft.x * 100}%`,
                  top: `${textDraft.y * 100}%`
                }}
              />
            )}
            {!isLive && shareMode !== 'whiteboard' && (
              <div style={emptyStateStyle}>
                <Video size={42} />
                <strong>Enhanced live output appears here</strong>
                <span>Start the room, choose a screen, then draw, zoom, spotlight, or hide parts while viewers watch.</span>
              </div>
            )}
          </div>

          <div style={statusRowStyle}>
            <span style={{ color: isLive ? '#00A878' : '#647087', fontWeight: 800 }}>{isLive ? 'Live output active' : 'Waiting'}</span>
            <span>{presenterMode ? 'Presenter controls are visible only to you. Viewers receive the clean canvas feed.' : status}</span>
          </div>
        </div>

        <aside style={presenterMode ? presenterSidePanelStyle : sidePanelStyle}>
          <section style={callCardStyle}>
            <h2 style={sideTitleStyle}><Monitor size={17} /> Share Source</h2>
            <div style={segmentedStyle}>
              <button onClick={() => {
                shareModeRef.current = 'screen';
                setShareMode('screen');
                setSourceName(sources.find((source) => source.id === selectedSourceId)?.name || 'No screen selected');
              }} style={segmentButtonStyle(shareMode === 'screen')}>Screen</button>
              <button onClick={activateWhiteboard} style={segmentButtonStyle(shareMode === 'whiteboard')}>Whiteboard</button>
            </div>
            <div style={sourceBoxStyle}>
              <span>Current source</span>
              <strong>{sourceName}</strong>
            </div>
            {shareMode === 'screen' && <div style={sourceListStyle}>
              {sources.map((source) => (
                <button
                  key={source.id}
                  onClick={() => selectSource(source)}
                  onDoubleClick={() => switchScreen(source.id)}
                  style={sourceItemStyle(selectedSourceId === source.id)}
                >
                  {source.thumbnail ? (
                    <img alt="" src={source.thumbnail} style={sourceThumbStyle} />
                  ) : (
                    <span style={sourceThumbFallbackStyle}><Monitor size={18} /></span>
                  )}
                  <span>{source.name}</span>
                </button>
              ))}
            </div>}
            <button onClick={() => switchScreen(selectedSourceId)} style={{ ...secondaryButtonStyle(false), width: '100%', marginTop: '10px' }}>
              <ScreenShare size={16} /> {shareMode === 'whiteboard' ? (isLive ? 'Switch To Whiteboard' : 'Share Whiteboard') : (isLive ? 'Switch To Selected' : 'Share Selected')}
            </button>
            {shareMode === 'screen' && <button onClick={loadSources} style={{ ...secondaryButtonStyle(false), width: '100%', marginTop: '8px' }}>
              <RotateCcw size={16} /> Refresh Sources
            </button>}
            <div style={segmentedStyle}>
              <button onClick={() => setOutputMode('enhanced')} style={segmentButtonStyle(outputMode === 'enhanced')}>Enhanced</button>
              <button onClick={() => setOutputMode('raw')} style={segmentButtonStyle(outputMode === 'raw')}>Raw</button>
            </div>
            <p style={smallTextStyle}>
              {outputMode === 'enhanced'
                ? 'Viewers see zoom, circles, underlines, spotlight, and hidden areas.'
                : 'Raw mode is planned for sending the unedited screen feed when you do not need presentation tools.'}
            </p>
          </section>

          <section style={callCardStyle}>
            <h2 style={sideTitleStyle}><Users size={17} /> Join Call</h2>
            <div style={inviteBoxStyle}>
              <strong>{roomCode}</strong>
              <span>{isLiveKitConnected ? 'Use this room code in another ScreenFlowAI app.' : inviteLink}</span>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '10px' }}>
              <span style={{ color: '#26344D', fontSize: '12px', fontWeight: 900 }}>Room code</span>
              <input
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value.trim().toUpperCase())}
                disabled={isLiveKitConnected}
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '10px' }}>
              <span style={{ color: '#26344D', fontSize: '12px', fontWeight: 900 }}>Your name</span>
              <input
                value={participantName}
                onChange={(event) => setParticipantName(event.target.value)}
                style={inputStyle}
              />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
              <button onClick={connectLiveKit} style={secondaryButtonStyle(isLiveKitConnected)}>
                <Users size={16} /> {isLiveKitConnected ? 'Connected' : 'Go Online'}
              </button>
              <button onClick={disconnectLiveKit} style={secondaryButtonStyle(false)}>
                <PhoneOff size={16} /> Leave
              </button>
            </div>
            <button onClick={copyInvite} style={{ ...secondaryButtonStyle(false), width: '100%', marginTop: '10px' }}>
              <Copy size={16} /> {copiedInvite ? 'Invite Copied' : 'Copy Invite Link'}
            </button>
            <p style={smallTextStyle}>LiveKit: {liveKitStatus}</p>
            {isBrowserPresenter && (
              <p style={smallTextStyle}>Web presenter mode works best in Chrome/Edge desktop. If it disconnects, use the desktop app as presenter and the website as viewer.</p>
            )}
          </section>

          <section style={callCardStyle}>
            <h2 style={sideTitleStyle}><Users size={17} /> Participants</h2>
            {[
              { name: 'You - Presenter', kind: 'presenter' },
              ...remoteParticipants.map((participant) => ({ name: participant.name, kind: 'remote' })),
              { name: 'AI Notetaker', kind: 'ai' }
            ].map((participant) => (
              <div key={participant.name} style={participantStyle}>
                <div style={{ ...avatarStyle, background: participant.kind === 'ai' ? '#172033' : participant.kind === 'presenter' ? '#7C3AED' : '#00A878' }}>
                  {participant.kind === 'ai' ? <Bot size={16} /> : participant.name.slice(0, 1)}
                </div>
                <span>{participant.name}</span>
                {participant.kind === 'ai' && <Sparkles size={14} color="#FFB800" />}
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' }}>
              <button onClick={toggleMic} style={secondaryButtonStyle(micOn)}><Mic size={16} /> {micOn ? 'Mute' : 'Mic'}</button>
              <button onClick={toggleCamera} style={secondaryButtonStyle(cameraOn)}><Camera size={16} /> {cameraOn ? 'Camera On' : 'Camera'}</button>
            </div>
            <button onClick={askAi} style={{ ...secondaryButtonStyle(false), width: '100%', marginTop: '10px' }}><Bot size={16} /> Ask AI</button>
          </section>

          {cameraOn && (
            <section style={callCardStyle}>
              <h2 style={sideTitleStyle}><Camera size={17} /> Presenter Camera</h2>
              <video ref={cameraPreviewRef} autoPlay muted playsInline style={previewVideoStyle} />
              <p style={smallTextStyle}>Your camera is published as a separate presenter video tile.</p>
            </section>
          )}

          <section style={callCardStyle}>
            <h2 style={sideTitleStyle}><Play size={17} /> Viewer Feed</h2>
            <video ref={outputVideoRef} autoPlay muted playsInline style={previewVideoStyle} />
            <p style={smallTextStyle}>This is the processed stream that can be published to a real conference provider.</p>
            <div ref={remoteMediaRef} />
          </section>

          <section style={callCardStyle}>
            <h2 style={sideTitleStyle}><Sparkles size={17} /> AI Notes</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              {notes.slice(0, 5).map((note) => (
                <p key={note} style={noteStyle}>{note}</p>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getBox(start, end, width, height) {
  const x1 = start.x * width;
  const y1 = start.y * height;
  const x2 = end.x * width;
  const y2 = end.y * height;
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x1 - x2),
    h: Math.abs(y1 - y2)
  };
}

const pageStyle = {
  background: '#F8FAFF',
  color: '#172033',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'var(--font-sans)',
  gap: '22px',
  margin: '-32px',
  minHeight: '100%',
  padding: '28px'
};

const presenterPageStyle = {
  ...pageStyle,
  inset: 0,
  margin: 0,
  minHeight: '100vh',
  overflow: 'auto',
  padding: '18px',
  position: 'fixed',
  zIndex: 9999
};

const headerStyle = {
  alignItems: 'center',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '18px'
};

const titleStyle = {
  color: '#172033',
  fontFamily: 'var(--font-display)',
  fontSize: '28px',
  fontWeight: 850,
  letterSpacing: 0
};

const subtitleStyle = {
  color: '#647087',
  fontSize: '14px',
  marginTop: '5px'
};

const workspaceStyle = {
  alignItems: 'start',
  display: 'grid',
  gap: '20px',
  gridTemplateColumns: 'minmax(0, 1fr) 340px'
};

const presenterWorkspaceStyle = {
  ...workspaceStyle,
  gridTemplateColumns: 'minmax(0, 1fr) 300px'
};

const stagePanelStyle = {
  background: '#FFFFFF',
  border: '1px solid #E2E8F0',
  borderRadius: '8px',
  boxShadow: '0 12px 28px rgba(15, 23, 42, 0.06)',
  overflow: 'hidden'
};

const presenterStagePanelStyle = {
  ...stagePanelStyle,
  alignSelf: 'stretch'
};

const toolBarStyle = {
  alignItems: 'center',
  background: '#FFFFFF',
  borderBottom: '1px solid #E8EDF5',
  display: 'flex',
  gap: '8px',
  minHeight: '64px',
  padding: '10px 14px'
};

const canvasWrapStyle = {
  aspectRatio: '16 / 9',
  background: '#090B12',
  position: 'relative',
  width: '100%'
};

const canvasStyle = {
  cursor: 'crosshair',
  display: 'block',
  height: '100%',
  width: '100%'
};

const emptyStateStyle = {
  alignItems: 'center',
  color: '#D8E0F0',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  inset: 0,
  justifyContent: 'center',
  padding: '24px',
  position: 'absolute',
  textAlign: 'center'
};

const whiteboardTextInputStyle = {
  background: 'rgba(255, 255, 255, 0.94)',
  border: '2px solid #172033',
  borderRadius: '8px',
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.16)',
  fontFamily: 'system-ui, sans-serif',
  fontSize: '24px',
  fontWeight: 800,
  minHeight: '48px',
  minWidth: '220px',
  outline: 'none',
  padding: '8px 10px',
  position: 'absolute',
  resize: 'both',
  transform: 'translateY(-8px)',
  zIndex: 4
};

const statusRowStyle = {
  alignItems: 'center',
  color: '#647087',
  display: 'flex',
  fontSize: '13px',
  gap: '10px',
  justifyContent: 'space-between',
  minHeight: '50px',
  padding: '0 16px'
};

const sidePanelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '14px'
};

const presenterSidePanelStyle = {
  ...sidePanelStyle,
  maxHeight: 'calc(100vh - 116px)',
  overflowY: 'auto'
};

const callCardStyle = {
  background: '#FFFFFF',
  border: '1px solid #E2E8F0',
  borderRadius: '8px',
  boxShadow: '0 8px 22px rgba(15, 23, 42, 0.05)',
  padding: '16px'
};

const sideTitleStyle = {
  alignItems: 'center',
  color: '#172033',
  display: 'flex',
  fontSize: '14px',
  fontWeight: 900,
  gap: '8px',
  marginBottom: '12px'
};

const participantStyle = {
  alignItems: 'center',
  color: '#26344D',
  display: 'flex',
  fontSize: '13px',
  fontWeight: 800,
  gap: '10px',
  minHeight: '42px'
};

const avatarStyle = {
  alignItems: 'center',
  borderRadius: '999px',
  color: '#FFFFFF',
  display: 'flex',
  fontSize: '12px',
  fontWeight: 900,
  height: '30px',
  justifyContent: 'center',
  width: '30px'
};

const previewVideoStyle = {
  aspectRatio: '16 / 9',
  background: '#0B0F19',
  borderRadius: '8px',
  display: 'block',
  objectFit: 'cover',
  width: '100%'
};

const smallTextStyle = {
  color: '#647087',
  fontSize: '12px',
  lineHeight: 1.45,
  marginTop: '10px'
};

const inviteBoxStyle = {
  background: '#F8FAFF',
  border: '1px solid #E8EDF5',
  borderRadius: '8px',
  display: 'flex',
  flexDirection: 'column',
  gap: '5px',
  padding: '12px'
};

const sourceBoxStyle = {
  background: '#F8FAFF',
  border: '1px solid #E8EDF5',
  borderRadius: '8px',
  display: 'flex',
  flexDirection: 'column',
  gap: '5px',
  padding: '12px'
};

const sourceListStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  marginTop: '10px',
  maxHeight: '190px',
  overflowY: 'auto',
  paddingRight: '2px'
};

const sourceItemStyle = (active) => ({
  alignItems: 'center',
  background: active ? '#172033' : '#F8FAFF',
  border: `1px solid ${active ? '#172033' : '#E2E8F0'}`,
  borderRadius: '8px',
  color: active ? '#FFFFFF' : '#26344D',
  cursor: 'pointer',
  display: 'grid',
  fontSize: '12px',
  fontWeight: 800,
  gap: '10px',
  gridTemplateColumns: '56px minmax(0, 1fr)',
  minHeight: '54px',
  padding: '7px',
  textAlign: 'left'
});

const sourceThumbStyle = {
  aspectRatio: '16 / 10',
  background: '#0B0F19',
  borderRadius: '6px',
  objectFit: 'cover',
  width: '56px'
};

const sourceThumbFallbackStyle = {
  alignItems: 'center',
  aspectRatio: '16 / 10',
  background: '#E8EDF5',
  borderRadius: '6px',
  display: 'flex',
  justifyContent: 'center',
  width: '56px'
};

const segmentedStyle = {
  background: '#EEF2F8',
  borderRadius: '8px',
  display: 'grid',
  gap: '6px',
  gridTemplateColumns: '1fr 1fr',
  marginTop: '10px',
  padding: '6px'
};

const segmentButtonStyle = (active) => ({
  background: active ? '#FFFFFF' : 'transparent',
  border: 'none',
  borderRadius: '6px',
  boxShadow: active ? '0 4px 12px rgba(15, 23, 42, 0.08)' : 'none',
  color: active ? '#172033' : '#647087',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 900,
  minHeight: '34px'
});

const noteStyle = {
  background: '#F8FAFF',
  border: '1px solid #E8EDF5',
  borderRadius: '8px',
  color: '#4E5A70',
  fontSize: '12px',
  lineHeight: 1.45,
  padding: '10px'
};

const inputStyle = {
  background: '#FFFFFF',
  border: '1px solid #DCE3EF',
  borderRadius: '8px',
  color: '#172033',
  fontSize: '13px',
  fontWeight: 800,
  minHeight: '38px',
  outline: 'none',
  padding: '0 10px',
  width: '100%'
};

const primaryButtonStyle = {
  alignItems: 'center',
  background: 'linear-gradient(135deg, #7C3AED 0%, #FF4D7E 100%)',
  border: 'none',
  borderRadius: '8px',
  color: '#FFFFFF',
  cursor: 'pointer',
  display: 'inline-flex',
  fontWeight: 900,
  gap: '8px',
  minHeight: '42px',
  padding: '0 16px'
};

const dangerButtonStyle = {
  ...primaryButtonStyle,
  background: '#EF4444'
};

const secondaryHeaderButtonStyle = {
  alignItems: 'center',
  background: '#FFFFFF',
  border: '1px solid #E2E8F0',
  borderRadius: '8px',
  color: '#26344D',
  cursor: 'pointer',
  display: 'inline-flex',
  fontWeight: 900,
  gap: '8px',
  minHeight: '42px',
  padding: '0 13px'
};

const roomBadgeStyle = {
  alignItems: 'center',
  background: '#FFFFFF',
  border: '1px solid #E2E8F0',
  borderRadius: '8px',
  color: '#26344D',
  display: 'inline-flex',
  fontSize: '13px',
  fontWeight: 900,
  gap: '8px',
  minHeight: '42px',
  padding: '0 12px'
};

const dividerStyle = {
  background: '#E8EDF5',
  height: '30px',
  margin: '0 4px',
  width: '1px'
};

const zoomPillStyle = {
  color: '#26344D',
  fontSize: '13px',
  fontWeight: 900,
  minWidth: '44px',
  textAlign: 'center'
};

const iconButtonStyle = (active) => ({
  alignItems: 'center',
  background: active ? '#172033' : '#F8FAFF',
  border: `1px solid ${active ? '#172033' : '#DDE5F1'}`,
  borderRadius: '8px',
  color: active ? '#FFFFFF' : '#4E5A70',
  cursor: 'pointer',
  display: 'inline-flex',
  height: '38px',
  justifyContent: 'center',
  width: '38px'
});

const secondaryButtonStyle = (active) => ({
  alignItems: 'center',
  background: active ? '#172033' : '#F8FAFF',
  border: `1px solid ${active ? '#172033' : '#DDE5F1'}`,
  borderRadius: '8px',
  color: active ? '#FFFFFF' : '#26344D',
  cursor: 'pointer',
  display: 'inline-flex',
  fontSize: '13px',
  fontWeight: 900,
  gap: '8px',
  justifyContent: 'center',
  minHeight: '40px'
});

const swatchStyle = (swatch, active) => ({
  background: swatch,
  border: active ? '3px solid #172033' : '3px solid #FFFFFF',
  borderRadius: '999px',
  boxShadow: '0 3px 10px rgba(15,23,42,0.16)',
  cursor: 'pointer',
  height: '26px',
  width: '26px'
});
