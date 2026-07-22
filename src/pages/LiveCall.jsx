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
  MoreHorizontal,
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
  const callCaptionRecorderRef = useRef(null);
  const callCaptionChunksRef = useRef([]);
  const callCaptionStartedAtRef = useRef(0);
  const meetingRecorderRef = useRef(null);
  const meetingChunksRef = useRef([]);
  const meetingStartedAtRef = useRef(0);
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
  const [captionRecording, setCaptionRecording] = useState(false);
  const [captionGenerating, setCaptionGenerating] = useState(false);
  const [callCaptions, setCallCaptions] = useState([]);
  const [meetingRecording, setMeetingRecording] = useState(false);
  const [meetingSaving, setMeetingSaving] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const isBrowserPresenter = !window.navigator?.userAgent?.toLowerCase?.().includes('electron') && !window.electron?.getAppVersion;

  const [roomCode, setRoomCode] = useState(() => `SF-${Math.random().toString(36).slice(2, 7).toUpperCase()}`);
  const joinBaseUrl = import.meta.env.VITE_JOIN_BASE_URL || 'https://screenflow-ai.vercel.app';
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
      if (captionRecording) {
        await stopCallCaptionRecording();
      }
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
    if (captionRecording) {
      stopCallCaptionRecording();
    }
    if (meetingRecording) {
      stopMeetingRecording();
    }
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

  const getCaptionMimeType = () => {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
    return types.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || '';
  };

  const getMeetingMimeType = () => {
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    return types.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || '';
  };

  const startMeetingRecording = async () => {
    try {
      const outputTracks = outputStreamRef.current?.getVideoTracks?.() || [];
      if (!outputTracks.length) {
        setStatus('Start the live room before recording the meeting.');
        return;
      }

      const tracks = [...outputTracks];
      const audioTrack = audioStreamRef.current?.getAudioTracks?.()[0];
      if (audioTrack) tracks.push(audioTrack);

      meetingChunksRef.current = [];
      const mimeType = getMeetingMimeType();
      const recorder = new MediaRecorder(new MediaStream(tracks), mimeType ? { mimeType } : undefined);
      meetingRecorderRef.current = recorder;
      meetingStartedAtRef.current = Date.now();
      recorder.ondataavailable = (event) => {
        if (event.data?.size) meetingChunksRef.current.push(event.data);
      };
      recorder.start(1000);
      setMeetingRecording(true);
      setNotes((current) => ['Host recording started. ScreenFlow is saving the presenter feed and host mic.', ...current]);
    } catch (error) {
      setStatus(error?.message || 'Could not start meeting recording.');
    }
  };

  const stopMeetingRecording = async () => (
    new Promise((resolve) => {
      const recorder = meetingRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        setMeetingRecording(false);
        resolve();
        return;
      }

      recorder.onstop = async () => {
        setMeetingRecording(false);
        setMeetingSaving(true);
        try {
          const blob = new Blob(meetingChunksRef.current, { type: recorder.mimeType || 'video/webm' });
          if (!blob.size) {
            setNotes((current) => ['No meeting video was captured.', ...current]);
            return;
          }

          const duration = (Date.now() - meetingStartedAtRef.current) / 1000;
          const saved = await window.electron?.saveRecordedFile?.(await blob.arrayBuffer());
          if (!saved?.success) {
            setNotes((current) => [`Meeting recording failed: ${saved?.error || 'Unable to save file.'}`, ...current]);
            return;
          }

          const project = await window.electron?.createProject?.(`Conference Recording - ${new Date().toLocaleTimeString()}`);
          if (project?.id) {
            await window.electron?.updateProject?.(project.id, {
              video_path: saved.filePath,
              raw_video_path: saved.rawFilePath || saved.filePath,
              audio_path: saved.filePath,
              duration,
              resolution: '1080p',
              fps: 30,
              captions: callCaptions,
              chapters: []
            });
          }

          setNotes((current) => [
            project?.id
              ? 'Meeting recording saved as an editable project.'
              : `Meeting recording saved: ${saved.filePath}`,
            ...current
          ]);
        } catch (error) {
          setNotes((current) => [`Meeting recording failed: ${error.message}`, ...current]);
        } finally {
          setMeetingSaving(false);
          meetingRecorderRef.current = null;
          meetingChunksRef.current = [];
          resolve();
        }
      };
      recorder.stop();
    })
  );

  const startCallCaptionRecording = async () => {
    try {
      let audioStream = audioStreamRef.current;
      if (!audioStream?.getAudioTracks?.().length) {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = audioStream;
        setMicOn(true);
        await publishMicStream(audioStream);
      }

      callCaptionChunksRef.current = [];
      const mimeType = getCaptionMimeType();
      const recorder = new MediaRecorder(audioStream, mimeType ? { mimeType } : undefined);
      callCaptionRecorderRef.current = recorder;
      callCaptionStartedAtRef.current = Date.now();
      recorder.ondataavailable = (event) => {
        if (event.data?.size) callCaptionChunksRef.current.push(event.data);
      };
      recorder.start(1000);
      setCaptionRecording(true);
      setNotes((current) => ['Meeting captions are listening to your microphone.', ...current]);
    } catch (error) {
      setStatus(error?.message || 'Could not start meeting captions.');
    }
  };

  const stopCallCaptionRecording = async () => (
    new Promise((resolve) => {
      const recorder = callCaptionRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        setCaptionRecording(false);
        resolve();
        return;
      }

      recorder.onstop = async () => {
        setCaptionRecording(false);
        setCaptionGenerating(true);
        try {
          const mimeType = recorder.mimeType || 'audio/webm';
          const blob = new Blob(callCaptionChunksRef.current, { type: mimeType });
          if (!blob.size) {
            setNotes((current) => ['No call audio was captured for captions.', ...current]);
            return;
          }
          const duration = (Date.now() - callCaptionStartedAtRef.current) / 1000;
          const result = await window.electron?.generateCallCaptions?.(await blob.arrayBuffer(), mimeType, duration);
          if (!result?.success) {
            setNotes((current) => [`Caption transcription failed: ${result?.error || 'Unknown error'}`, ...current]);
            return;
          }
          setCallCaptions(result.captions || []);
          setNotes((current) => [
            `Generated ${result.captions?.length || 0} real captions from the call audio.`,
            ...current
          ]);
        } catch (error) {
          setNotes((current) => [`Caption transcription failed: ${error.message}`, ...current]);
        } finally {
          setCaptionGenerating(false);
          callCaptionRecorderRef.current = null;
          callCaptionChunksRef.current = [];
          resolve();
        }
      };
      recorder.stop();
    })
  );

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
      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        attachRemoteTrack(track, participant);
        updateRemoteParticipants();
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((element) => element.remove());
        remoteMediaRef.current?.querySelector(`[data-track-sid="${track.sid}"]`)?.remove();
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

  const attachRemoteTrack = (track, participant) => {
    if (!remoteMediaRef.current) return;
    const participantId = participant?.identity || 'remote';
    const isRemoteScreen = track.kind === 'video' && track.name?.includes('screen');
    let tile = remoteMediaRef.current.querySelector(`[data-participant-id="${participantId}"]`);
    if (!tile) {
      tile = document.createElement('div');
      tile.dataset.participantId = participantId;
      tile.style.background = '#090B12';
      tile.style.border = '1px solid #26344D';
      tile.style.borderRadius = '8px';
      tile.style.color = '#F8FAFC';
      tile.style.minHeight = '150px';
      tile.style.overflow = 'hidden';
      tile.style.position = 'relative';
      tile.style.cursor = 'pointer';
      tile.onclick = () => {
        const isExpanded = tile.dataset.expanded === 'true';
        Array.from(remoteMediaRef.current.querySelectorAll('[data-participant-id]')).forEach((item) => {
          item.dataset.expanded = 'false';
          item.style.gridColumn = 'auto';
          item.style.gridRow = 'auto';
          item.style.minHeight = '180px';
        });
        tile.dataset.expanded = isExpanded ? 'false' : 'true';
        tile.style.gridColumn = isExpanded ? 'auto' : 'span 2';
        tile.style.gridRow = isExpanded ? 'auto' : 'span 2';
        tile.style.minHeight = isExpanded ? '180px' : '360px';
      };

      const label = document.createElement('div');
      label.dataset.tileLabel = 'true';
      label.textContent = participant?.name || participantId;
      label.style.background = 'rgba(9, 11, 18, 0.72)';
      label.style.borderRadius = '999px';
      label.style.bottom = '8px';
      label.style.fontSize = '12px';
      label.style.fontWeight = '900';
      label.style.left = '8px';
      label.style.padding = '5px 9px';
      label.style.position = 'absolute';
      label.style.zIndex = '2';
      tile.appendChild(label);

      remoteMediaRef.current.appendChild(tile);
    }

    const element = track.attach();
    element.dataset.trackSid = track.sid;
    element.style.width = '100%';
    element.style.height = track.kind === 'video' ? '100%' : '0';
    element.style.background = '#0B0F19';
    element.style.display = track.kind === 'video' ? 'block' : 'none';
    element.style.objectFit = isRemoteScreen ? 'contain' : 'cover';
    if (track.kind === 'audio') element.style.display = 'none';

    if (track.kind === 'video') {
      Array.from(tile.querySelectorAll('video')).forEach((video) => video.remove());
      const label = tile.querySelector('[data-tile-label="true"]');
      if (label) label.textContent = `${participant?.name || participantId}${isRemoteScreen ? ' - Screen' : ''}`;
    }
    tile.appendChild(element);
    element.play?.().catch(() => {});
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
          <p style={subtitleStyle}>{participantName} presenting in room {roomCode}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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
        <section style={conferenceStageStyle}>
          <div style={conferenceHeaderStyle}>
            <div>
              <h2 style={stageTitleStyle}><Users size={18} /> Meeting Room</h2>
              <p style={stageSubtitleStyle}>Everyone appears here. Click any participant tile to focus it.</p>
            </div>
            <span style={meetingCountStyle}>{remoteParticipants.length + 1} in call</span>
          </div>
          <div style={peopleGridStyle}>
            <div style={localPresenterTileStyle}>
              {cameraOn ? (
                <video ref={cameraPreviewRef} autoPlay muted playsInline style={stageVideoStyle} />
              ) : (
                <div style={emptyTileStyle}>Camera is off</div>
              )}
              <span style={tileLabelStyle}>You - Host</span>
            </div>
            {(isLive || shareMode === 'whiteboard') && (
              <div style={shareTileStyle}>
                <div style={compactToolBarStyle}>
                  {toolOptions.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        aria-label={item.label}
                        className="tooltip"
                        data-tooltip={item.label}
                        key={item.id}
                        onClick={() => setTool((current) => current === item.id ? 'pointer' : item.id)}
                        style={miniIconButtonStyle(tool === item.id)}
                      >
                        <Icon size={15} />
                      </button>
                    );
                  })}
                  <button aria-label="Zoom out" className="tooltip" data-tooltip="Zoom out" onClick={() => adjustZoom(-0.2)} style={miniIconButtonStyle(false)}><Minus size={15} /></button>
                  <span style={miniZoomPillStyle}>{zoom.toFixed(1)}x</span>
                  <button aria-label="Zoom in" className="tooltip" data-tooltip="Zoom in" onClick={() => adjustZoom(0.2)} style={miniIconButtonStyle(false)}><Plus size={15} /></button>
                </div>
                <div
                  onKeyDown={handleBoardKeyDown}
                  onPointerDown={(event) => event.currentTarget.focus()}
                  tabIndex={0}
                  style={shareCanvasWrapStyle}
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
                </div>
                <span style={tileLabelStyle}>Host Share - {sourceName}</span>
              </div>
            )}
            <div ref={remoteMediaRef} style={remoteGridStyle}>
              {!remoteParticipants.length && <div style={emptyTileStyle}>Waiting for people to join</div>}
            </div>
          </div>
          <div style={meetControlDockStyle}>
            <button onClick={toggleMic} style={dockButtonStyle(micOn)} className="tooltip" data-tooltip={micOn ? 'Mute microphone' : 'Turn microphone on'}>
              <Mic size={18} />
            </button>
            <button onClick={toggleCamera} style={dockButtonStyle(cameraOn)} className="tooltip" data-tooltip={cameraOn ? 'Turn camera off' : 'Turn camera on'}>
              <Camera size={18} />
            </button>
            <button onClick={() => switchScreen(selectedSourceId)} style={dockButtonStyle(isLive)} className="tooltip" data-tooltip="Share screen">
              <ScreenShare size={18} />
            </button>
            <button onClick={isLiveKitConnected ? disconnectLiveKit : connectLiveKit} style={dockButtonStyle(isLiveKitConnected)} className="tooltip" data-tooltip={isLiveKitConnected ? 'Disconnect room' : 'Go online'}>
              <Users size={18} />
            </button>
            <button onClick={isLive ? stopRoom : () => startRoom()} style={dockLeaveButtonStyle} className="tooltip" data-tooltip={isLive ? 'End call' : 'Start live room'}>
              {isLive ? <PhoneOff size={19} /> : <Play size={19} />}
            </button>
            <div style={moreMenuWrapStyle}>
              <button onClick={() => setMoreMenuOpen((open) => !open)} style={dockButtonStyle(moreMenuOpen)} className="tooltip" data-tooltip="More">
                <MoreHorizontal size={19} />
              </button>
              {moreMenuOpen && (
                <div style={dockMenuStyle}>
                  <button onClick={copyInvite} style={menuItemStyle}><Copy size={15} /> Copy Invite</button>
                  <button onClick={askAi} style={menuItemStyle}><Bot size={15} /> Ask AI</button>
                  <button
                    onClick={captionRecording ? stopCallCaptionRecording : startCallCaptionRecording}
                    disabled={captionGenerating}
                    style={menuItemStyle}
                  >
                    <Type size={15} /> {captionGenerating ? 'Generating Captions' : captionRecording ? 'Stop & Transcribe' : 'Meeting Captions'}
                  </button>
                  <button
                    onClick={meetingRecording ? stopMeetingRecording : startMeetingRecording}
                    disabled={meetingSaving}
                    style={menuItemStyle}
                  >
                    {meetingRecording ? <Square size={15} /> : <Play size={15} />} {meetingSaving ? 'Saving Meeting' : meetingRecording ? 'Stop Recording' : 'Record Meeting'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <video ref={outputVideoRef} autoPlay muted playsInline style={hiddenPreviewStyle} />

        <aside style={presenterMode ? presenterSidePanelStyle : sidePanelStyle}>
          <section style={sourceControlCardStyle}>
            <div style={cardHeaderRowStyle}>
              <h2 style={sideTitleStyle}><Monitor size={17} /> Setup</h2>
              <button onClick={loadSources} style={compactButtonStyle}>
                <RotateCcw size={15} /> Refresh
              </button>
            </div>
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
            {shareMode === 'screen' && (
              <label style={compactLabelStyle}>
                Source
                <select
                  value={selectedSourceId}
                  onChange={(event) => {
                    const source = sources.find((item) => item.id === event.target.value);
                    if (source) selectSource(source);
                  }}
                  style={selectStyle}
                >
                  {sources.map((source) => (
                    <option key={source.id} value={source.id}>{source.name}</option>
                  ))}
                </select>
              </label>
            )}
            <button onClick={() => switchScreen(selectedSourceId)} style={{ ...secondaryButtonStyle(false), width: '100%', marginTop: '10px' }}>
              <ScreenShare size={16} /> {shareMode === 'whiteboard' ? (isLive ? 'Switch To Whiteboard' : 'Share Whiteboard') : (isLive ? 'Switch To Selected' : 'Share Selected')}
            </button>
            <div style={segmentedStyle}>
              <button onClick={() => setOutputMode('enhanced')} style={segmentButtonStyle(outputMode === 'enhanced')}>Enhanced</button>
              <button onClick={() => setOutputMode('raw')} style={segmentButtonStyle(outputMode === 'raw')}>Raw</button>
            </div>
          </section>

          <section style={controlCenterCardStyle}>
            <div style={cardHeaderRowStyle}>
              <h2 style={sideTitleStyle}><Users size={17} /> Room</h2>
              <span style={connectionPillStyle(isLiveKitConnected)}>{isLiveKitConnected ? 'Online' : 'Offline'}</span>
            </div>
            <div style={inviteCompactStyle}>
              <div style={inviteTextStyle}>
                <span style={inviteLabelStyle}>Invite link</span>
                <strong>{roomCode}</strong>
                <span style={inviteUrlStyle}>{inviteLink}</span>
              </div>
              <button onClick={copyInvite} style={compactButtonStyle}><Copy size={15} /> {copiedInvite ? 'Copied' : 'Copy'}</button>
            </div>
            <div style={formGridStyle}>
              <label style={compactLabelStyle}>
                Room
                <input
                  value={roomCode}
                  onChange={(event) => setRoomCode(event.target.value.trim().toUpperCase())}
                  disabled={isLiveKitConnected}
                  style={inputStyle}
                />
              </label>
              <label style={compactLabelStyle}>
                Name
                <input
                  value={participantName}
                  onChange={(event) => setParticipantName(event.target.value)}
                  style={inputStyle}
                />
              </label>
            </div>
            <div style={participantsInlineStyle}>
              {[
                { name: 'You - Host', kind: 'presenter' },
                ...remoteParticipants.map((participant) => ({ name: participant.name, kind: 'remote' })),
                { name: 'AI Notetaker', kind: 'ai' }
              ].map((participant) => (
                <div key={participant.name} style={participantChipStyle}>
                  <div style={{ ...avatarStyle, background: participant.kind === 'ai' ? '#172033' : participant.kind === 'presenter' ? '#111827' : '#2F855A' }}>
                    {participant.kind === 'ai' ? <Bot size={14} /> : participant.name.slice(0, 1)}
                  </div>
                  <span>{participant.name}</span>
                </div>
              ))}
            </div>
            <p style={smallTextStyle}>LiveKit: {liveKitStatus}</p>
            {callCaptions.length > 0 && (
              <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', marginBottom: '12px', maxHeight: '180px', overflowY: 'auto', padding: '10px' }}>
                {callCaptions.map((caption, index) => (
                  <p key={`${caption.start_time}-${index}`} style={{ ...noteStyle, marginBottom: '8px' }}>
                    <strong>{Number(caption.start_time || 0).toFixed(1)}s</strong> {caption.text}
                  </p>
                ))}
              </div>
            )}
            <div style={notesCompactStyle}>
              {notes.slice(0, 3).map((note) => (
                <p key={note} style={noteStyle}>{note}</p>
              ))}
            </div>
            {isBrowserPresenter && (
              <p style={smallTextStyle}>Web presenter mode works best in Chrome/Edge desktop.</p>
            )}
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
  background: '#F4F6F8',
  color: '#172033',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'var(--font-sans)',
  gap: '16px',
  margin: '-32px',
  minHeight: '100%',
  padding: '22px'
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
  gap: '14px'
};

const titleStyle = {
  color: '#172033',
  fontFamily: 'var(--font-display)',
  fontSize: '26px',
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
  gap: '16px',
  gridTemplateColumns: '1fr'
};

const presenterWorkspaceStyle = {
  ...workspaceStyle,
  gridTemplateColumns: '1fr'
};

const canvasStyle = {
  cursor: 'crosshair',
  display: 'block',
  height: '100%',
  width: '100%'
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
  display: 'grid',
  gap: '16px',
  gridColumn: '1 / -1',
  gridTemplateColumns: '360px minmax(0, 1fr)'
};

const presenterSidePanelStyle = {
  ...sidePanelStyle,
  maxHeight: 'calc(100vh - 116px)',
  overflowY: 'auto'
};

const callCardStyle = {
  background: '#FFFFFF',
  border: '1px solid #DDE4EE',
  borderRadius: '8px',
  boxShadow: '0 10px 26px rgba(15, 23, 42, 0.035)',
  padding: '18px'
};

const sourceControlCardStyle = {
  ...callCardStyle,
  alignSelf: 'start'
};

const controlCenterCardStyle = {
  ...callCardStyle,
  alignSelf: 'start'
};

const cardHeaderRowStyle = {
  alignItems: 'center',
  display: 'flex',
  gap: '10px',
  justifyContent: 'space-between',
  marginBottom: '10px'
};

const conferenceStageStyle = {
  background: '#FFFFFF',
  border: '1px solid #E2E8F0',
  borderRadius: '8px',
  boxShadow: '0 6px 18px rgba(15, 23, 42, 0.035)',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  gridColumn: '1 / -1',
  gridRow: '1',
  padding: '18px'
};

const conferenceHeaderStyle = {
  alignItems: 'center',
  display: 'flex',
  gap: '12px',
  justifyContent: 'space-between'
};

const stageTitleStyle = {
  alignItems: 'center',
  color: '#172033',
  display: 'flex',
  fontSize: '18px',
  fontWeight: 900,
  gap: '8px',
  margin: 0
};

const stageSubtitleStyle = {
  color: '#667085',
  fontSize: '13px',
  lineHeight: 1.4,
  marginTop: '4px'
};

const meetingCountStyle = {
  background: '#F8FAFC',
  border: '1px solid #DDE4EE',
  borderRadius: '999px',
  color: '#26344D',
  flexShrink: 0,
  fontSize: '12px',
  fontWeight: 900,
  padding: '7px 10px'
};

const peopleGridStyle = {
  background: '#0A0B0F',
  border: '1px solid #DDE5F1',
  borderRadius: '8px',
  display: 'grid',
  gap: '12px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  minHeight: '400px',
  padding: '12px'
};

const meetControlDockStyle = {
  alignItems: 'center',
  alignSelf: 'center',
  background: '#FFFFFF',
  border: '1px solid #DDE4EE',
  borderRadius: '999px',
  boxShadow: '0 18px 42px rgba(15, 23, 42, 0.12)',
  display: 'flex',
  gap: '8px',
  marginTop: '2px',
  padding: '8px'
};

const dockButtonStyle = (active) => ({
  alignItems: 'center',
  background: active ? '#172033' : '#F8FAFC',
  border: `1px solid ${active ? '#172033' : '#DDE4EE'}`,
  borderRadius: '999px',
  color: active ? '#FFFFFF' : '#26344D',
  cursor: 'pointer',
  display: 'flex',
  height: '44px',
  justifyContent: 'center',
  width: '44px'
});

const dockLeaveButtonStyle = {
  alignItems: 'center',
  background: '#B42318',
  border: '1px solid #B42318',
  borderRadius: '999px',
  color: '#FFFFFF',
  cursor: 'pointer',
  display: 'flex',
  height: '44px',
  justifyContent: 'center',
  width: '58px'
};

const localPresenterTileStyle = {
  aspectRatio: '16 / 9',
  background: '#090B12',
  border: '1px solid #2A3446',
  borderRadius: '8px',
  minHeight: '210px',
  overflow: 'hidden',
  position: 'relative'
};

const shareTileStyle = {
  ...localPresenterTileStyle,
  gridColumn: 'span 2',
  minHeight: '300px'
};

const compactToolBarStyle = {
  alignItems: 'center',
  background: 'rgba(255, 255, 255, 0.94)',
  border: '1px solid rgba(221, 228, 238, 0.9)',
  borderRadius: '999px',
  display: 'flex',
  gap: '5px',
  left: '12px',
  maxWidth: 'calc(100% - 24px)',
  overflowX: 'auto',
  padding: '6px',
  position: 'absolute',
  top: '12px',
  zIndex: 3
};

const shareCanvasWrapStyle = {
  background: '#090B12',
  height: '100%',
  position: 'relative',
  width: '100%'
};

const miniIconButtonStyle = (active) => ({
  alignItems: 'center',
  background: active ? '#172033' : '#FFFFFF',
  border: `1px solid ${active ? '#172033' : '#DDE4EE'}`,
  borderRadius: '999px',
  color: active ? '#FFFFFF' : '#4E5A70',
  cursor: 'pointer',
  display: 'flex',
  flexShrink: 0,
  height: '30px',
  justifyContent: 'center',
  width: '30px'
});

const miniZoomPillStyle = {
  color: '#26344D',
  flexShrink: 0,
  fontSize: '12px',
  fontWeight: 900,
  minWidth: '38px',
  textAlign: 'center'
};

const remoteGridStyle = {
  display: 'contents'
};

const stageVideoStyle = {
  background: '#090B12',
  display: 'block',
  height: '100%',
  objectFit: 'cover',
  width: '100%'
};

const emptyTileStyle = {
  alignItems: 'center',
  background: '#090B12',
  border: '1px solid #2A3446',
  borderRadius: '8px',
  color: '#CBD5E1',
  display: 'flex',
  fontSize: '13px',
  fontWeight: 800,
  height: '100%',
  justifyContent: 'center',
  minHeight: '150px',
  padding: '16px',
  textAlign: 'center'
};

const tileLabelStyle = {
  background: 'rgba(9, 11, 18, 0.72)',
  borderRadius: '999px',
  bottom: '8px',
  color: '#F8FAFC',
  fontSize: '12px',
  fontWeight: 900,
  left: '8px',
  padding: '5px 9px',
  position: 'absolute'
};

const sideTitleStyle = {
  alignItems: 'center',
  color: '#172033',
  display: 'flex',
  fontSize: '14px',
  fontWeight: 900,
  gap: '8px',
  marginBottom: 0
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

const participantsInlineStyle = {
  borderTop: '1px solid #E6EBF2',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  marginTop: '14px',
  paddingTop: '14px'
};

const participantChipStyle = {
  alignItems: 'center',
  background: '#FFFFFF',
  border: '1px solid #DDE4EE',
  borderRadius: '999px',
  color: '#26344D',
  display: 'inline-flex',
  fontSize: '12px',
  fontWeight: 900,
  gap: '8px',
  minHeight: '34px',
  padding: '4px 10px 4px 4px'
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

const hiddenPreviewStyle = {
  height: 0,
  opacity: 0,
  pointerEvents: 'none',
  position: 'absolute',
  width: 0
};

const smallTextStyle = {
  color: '#667085',
  fontSize: '12px',
  lineHeight: 1.45,
  marginTop: '10px'
};

const connectionPillStyle = (active) => ({
  background: active ? '#E9F8F0' : '#F2F4F7',
  border: `1px solid ${active ? '#BFE8CF' : '#E2E8F0'}`,
  borderRadius: '999px',
  color: active ? '#05603A' : '#647087',
  fontSize: '12px',
  fontWeight: 900,
  padding: '6px 10px'
});

const inviteBoxStyle = {
  background: '#F8FAFF',
  border: '1px solid #E8EDF5',
  borderRadius: '8px',
  display: 'flex',
  flexDirection: 'column',
  gap: '5px',
  padding: '12px'
};

const inviteCompactStyle = {
  alignItems: 'center',
  background: '#F8FAFC',
  border: '1px solid #DDE4EE',
  borderRadius: '8px',
  display: 'grid',
  gap: '12px',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  padding: '12px'
};

const inviteTextStyle = {
  display: 'grid',
  gap: '3px',
  overflow: 'hidden',
  minWidth: 0
};

const inviteLabelStyle = {
  color: '#667085',
  fontSize: '11px',
  fontWeight: 900,
  textTransform: 'uppercase'
};

const inviteUrlStyle = {
  color: '#344054',
  display: 'block',
  fontSize: '13px',
  fontWeight: 700,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
};

const formGridStyle = {
  display: 'grid',
  gap: '10px',
  gridTemplateColumns: '1fr 1fr',
  marginTop: '10px'
};

const compactLabelStyle = {
  color: '#26344D',
  display: 'flex',
  flexDirection: 'column',
  fontSize: '12px',
  fontWeight: 900,
  gap: '7px'
};

const sourceBoxStyle = {
  background: '#F8FAFC',
  border: '1px solid #DDE4EE',
  borderRadius: '8px',
  display: 'flex',
  flexDirection: 'column',
  gap: '5px',
  padding: '12px',
  marginTop: '10px'
};

const segmentedStyle = {
  background: '#EEF2F6',
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
  background: '#F8FAFC',
  border: '1px solid #E6EBF2',
  borderRadius: '8px',
  color: '#4E5A70',
  fontSize: '12px',
  lineHeight: 1.45,
  padding: '9px 10px'
};

const notesCompactStyle = {
  display: 'grid',
  gap: '8px',
  marginTop: '10px'
};

const inputStyle = {
  background: '#FFFFFF',
  border: '1px solid #D8E0EA',
  borderRadius: '8px',
  color: '#172033',
  fontSize: '13px',
  fontWeight: 800,
  minHeight: '38px',
  outline: 'none',
  padding: '0 10px',
  width: '100%'
};

const selectStyle = {
  ...inputStyle,
  appearance: 'none',
  background: '#FFFFFF',
  cursor: 'pointer',
  marginTop: 0
};

const primaryButtonStyle = {
  alignItems: 'center',
  background: '#172033',
  border: 'none',
  borderRadius: '8px',
  color: '#FFFFFF',
  cursor: 'pointer',
  display: 'inline-flex',
  fontWeight: 900,
  gap: '8px',
  minHeight: '42px',
  padding: '0 16px',
  whiteSpace: 'nowrap'
};

const compactButtonStyle = {
  alignItems: 'center',
  background: '#FFFFFF',
  border: '1px solid #DDE5F1',
  borderRadius: '8px',
  color: '#26344D',
  cursor: 'pointer',
  display: 'inline-flex',
  fontSize: '12px',
  fontWeight: 900,
  gap: '7px',
  minHeight: '34px',
  padding: '0 10px',
  whiteSpace: 'nowrap'
};

const moreMenuWrapStyle = {
  position: 'relative'
};

const moreMenuStyle = {
  background: '#FFFFFF',
  border: '1px solid #DDE4EE',
  borderRadius: '8px',
  boxShadow: '0 18px 36px rgba(15, 23, 42, 0.14)',
  display: 'grid',
  gap: '4px',
  minWidth: '230px',
  padding: '6px',
  position: 'absolute',
  right: 0,
  top: '48px',
  zIndex: 20
};

const dockMenuStyle = {
  ...moreMenuStyle,
  bottom: '54px',
  top: 'auto'
};

const menuItemStyle = {
  alignItems: 'center',
  background: 'transparent',
  border: 'none',
  borderRadius: '6px',
  color: '#172033',
  cursor: 'pointer',
  display: 'flex',
  fontSize: '13px',
  fontWeight: 900,
  gap: '9px',
  minHeight: '38px',
  padding: '0 10px',
  textAlign: 'left'
};

const dangerButtonStyle = {
  ...primaryButtonStyle,
  background: '#B42318'
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
  padding: '0 13px',
  whiteSpace: 'nowrap'
};

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
