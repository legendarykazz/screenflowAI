import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Camera,
  Check,
  Circle,
  Download,
  Eraser,
  Expand,
  Film,
  Gauge,
  Maximize2,
  Mic,
  Minus,
  MousePointer2,
  Pause,
  Pencil,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Ruler,
  Square,
  Trash2,
  Undo2,
  Upload,
  Video,
  Volume2
} from 'lucide-react';
import './FootballLab.css';

const STAGE_WIDTH = 1000;
const STAGE_HEIGHT = 562.5;

const TOOLS = {
  select: { label: 'Select', icon: MousePointer2 },
  pen: { label: 'Free draw', icon: Pencil },
  arrow: { label: 'Movement arrow', icon: ArrowRight },
  line: { label: 'Straight line', icon: Minus },
  var: { label: 'VAR line (90 / 180 degrees)', icon: Ruler },
  circle: { label: 'Circle area', icon: Circle }
};

const COLORS = ['#ffffff', '#111827', '#ff426f', '#00d4ff', '#ffb800', '#00c48c'];

const CAMERA_SIZES = {
  small: 0.18,
  medium: 0.24,
  large: 0.31
};

const OUTPUT_QUALITY = {
  '1080p': { width: 1920, height: 1080, bitRate: 12_000_000 },
  '720p': { width: 1280, height: 720, bitRate: 7_000_000 }
};

const CAMERA_POSITIONS = [
  ['top-left', 'TL'],
  ['top-right', 'TR'],
  ['bottom-left', 'BL'],
  ['bottom-right', 'BR']
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function snapToAxis(start, point) {
  const horizontalDistance = Math.abs(point.x - start.x);
  const verticalDistance = Math.abs(point.y - start.y);
  return horizontalDistance >= verticalDistance
    ? { x: point.x, y: start.y }
    : { x: start.x, y: point.y };
}

function formatTime(seconds, showHours = false) {
  const safeSeconds = Number.isFinite(Number(seconds)) ? Math.max(0, Math.floor(Number(seconds))) : 0;
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  if (showHours || hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function safeFileName(value) {
  return String(value || 'football-reaction')
    .replace(/\.[^/.]+$/, '')
    .trim()
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'football-reaction';
}

function getRecordingMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4'
  ];
  return candidates.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || '';
}

function roundedRectPath(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function drawMediaCover(context, media, x, y, width, height) {
  const mediaWidth = media.videoWidth || width;
  const mediaHeight = media.videoHeight || height;
  const scale = Math.max(width / mediaWidth, height / mediaHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (mediaWidth - sourceWidth) / 2;
  const sourceY = (mediaHeight - sourceHeight) / 2;
  context.drawImage(media, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function SettingToggle({ checked, disabled, icon: Icon, label, onChange }) {
  return (
    <label className={`reaction-setting-toggle ${disabled ? 'disabled' : ''}`}>
      <span className="reaction-setting-label"><Icon size={16} />{label}</span>
      <input
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span aria-hidden="true" className="reaction-toggle-track"><span /></span>
    </label>
  );
}

export default function FootballLab() {
  const [videoUrl, setVideoUrl] = useState('');
  const [videoName, setVideoName] = useState('No clip loaded');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [fitMode, setFitMode] = useState('contain');

  const [activeTool, setActiveTool] = useState('select');
  const [activeColor, setActiveColor] = useState('#ff426f');
  const [strokeWidth, setStrokeWidth] = useState(6);
  const [annotations, setAnnotations] = useState([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState(null);
  const [draftAnnotation, setDraftAnnotation] = useState(null);

  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraPosition, setCameraPosition] = useState('bottom-right');
  const [cameraSize, setCameraSize] = useState('medium');
  const [micEnabled, setMicEnabled] = useState(true);
  const [clipAudioEnabled, setClipAudioEnabled] = useState(true);
  const [recordingQuality, setRecordingQuality] = useState('1080p');

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingStatus, setRecordingStatus] = useState('Ready to record');
  const [recordedReactionUrl, setRecordedReactionUrl] = useState('');
  const [savedRecordingPath, setSavedRecordingPath] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const stageShellRef = useRef(null);
  const recordCanvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingResourcesRef = useRef(null);
  const drawingRef = useRef(false);
  const draftRef = useRef(null);
  const animationFrameRef = useRef(0);
  const recordingTimerRef = useRef(0);
  const videoObjectUrlRef = useRef('');
  const recordedObjectUrlRef = useRef('');
  const annotationsRef = useRef(annotations);
  const settingsRef = useRef({});

  annotationsRef.current = annotations;
  draftRef.current = draftAnnotation;
  settingsRef.current = {
    cameraEnabled,
    cameraPosition,
    cameraSize,
    fitMode,
    zoomLevel
  };

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(document.fullscreenElement === stageShellRef.current);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const tagName = event.target?.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'select' || tagName === 'textarea') return;
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedAnnotationId) {
        event.preventDefault();
        setAnnotations((items) => items.filter((item) => item.id !== selectedAnnotationId));
        setSelectedAnnotationId(null);
      }
      if (event.key.toLowerCase() === 'k' && videoUrl) {
        event.preventDefault();
        togglePlayback();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  useEffect(() => () => {
    if (mediaRecorderRef.current?.state && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    window.cancelAnimationFrame(animationFrameRef.current);
    window.clearInterval(recordingTimerRef.current);
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingResourcesRef.current?.streams?.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
    recordingResourcesRef.current?.audioContext?.close?.();
    if (videoObjectUrlRef.current) URL.revokeObjectURL(videoObjectUrlRef.current);
    if (recordedObjectUrlRef.current) URL.revokeObjectURL(recordedObjectUrlRef.current);
  }, []);

  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setRecordingStatus('Choose a video file to continue');
      return;
    }

    if (videoObjectUrlRef.current) URL.revokeObjectURL(videoObjectUrlRef.current);
    const nextUrl = URL.createObjectURL(file);
    videoObjectUrlRef.current = nextUrl;
    setVideoUrl(nextUrl);
    setVideoName(file.name);
    setDuration(0);
    setCurrentTime(0);
    setIsPlaying(false);
    setZoomLevel(1);
    setAnnotations([]);
    setSelectedAnnotationId(null);
    setRecordingStatus('Clip ready');
    setSavedRecordingPath('');
  };

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;
    if (video.paused || video.ended) {
      try {
        await video.play();
      } catch (error) {
        setRecordingStatus(`Playback could not start: ${error.message}`);
      }
    } else {
      video.pause();
    }
  };

  const seekTo = (value) => {
    const nextTime = clamp(Number(value) || 0, 0, duration || 0);
    if (videoRef.current) videoRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const skipBy = (seconds) => seekTo(currentTime + seconds);

  const changePlaybackSpeed = (speed) => {
    const nextSpeed = Number(speed) || 1;
    setPlaybackSpeed(nextSpeed);
    if (videoRef.current) videoRef.current.playbackRate = nextSpeed;
  };

  const syncVideoDuration = (video) => {
    const nativeDuration = Number(video?.duration);
    let resolvedDuration = Number.isFinite(nativeDuration) && nativeDuration > 0 ? nativeDuration : 0;
    if (!resolvedDuration && video?.seekable?.length) {
      const seekableEnd = Number(video.seekable.end(video.seekable.length - 1));
      if (Number.isFinite(seekableEnd) && seekableEnd > 0) resolvedDuration = seekableEnd;
    }
    if (resolvedDuration) setDuration(resolvedDuration);
  };

  const getStagePoint = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1)
    };
  };

  const handleStagePointerDown = (event) => {
    if (!videoUrl || activeTool === 'select' || event.button !== 0) {
      if (activeTool === 'select') setSelectedAnnotationId(null);
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (isPlaying) videoRef.current?.pause();
    const point = getStagePoint(event);
    const nextDraft = {
      id: `drawing-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: activeTool,
      color: activeColor,
      width: strokeWidth,
      start: point,
      end: point,
      points: activeTool === 'pen' ? [point] : undefined
    };
    drawingRef.current = true;
    draftRef.current = nextDraft;
    setDraftAnnotation(nextDraft);
  };

  const handleStagePointerMove = (event) => {
    if (!drawingRef.current || !draftRef.current) return;
    const point = getStagePoint(event);
    const endPoint = draftRef.current.type === 'var'
      ? snapToAxis(draftRef.current.start, point)
      : point;
    const nextDraft = {
      ...draftRef.current,
      end: endPoint,
      points: draftRef.current.type === 'pen'
        ? [...(draftRef.current.points || []), point]
        : draftRef.current.points
    };
    draftRef.current = nextDraft;
    setDraftAnnotation(nextDraft);
  };

  const handleStagePointerUp = (event) => {
    if (!drawingRef.current || !draftRef.current) return;
    const point = getStagePoint(event);
    const endPoint = draftRef.current.type === 'var'
      ? snapToAxis(draftRef.current.start, point)
      : point;
    const finished = {
      ...draftRef.current,
      end: endPoint,
      points: draftRef.current.type === 'pen'
        ? [...(draftRef.current.points || []), point]
        : draftRef.current.points
    };
    const distance = Math.hypot(finished.end.x - finished.start.x, finished.end.y - finished.start.y);
    const enoughPenPoints = finished.type === 'pen' && finished.points?.length > 2;
    if (distance > 0.008 || enoughPenPoints) {
      setAnnotations((items) => [...items, finished]);
      setSelectedAnnotationId(finished.id);
    }
    drawingRef.current = false;
    draftRef.current = null;
    setDraftAnnotation(null);
  };

  const undoAnnotation = () => {
    setAnnotations((items) => items.slice(0, -1));
    setSelectedAnnotationId(null);
  };

  const clearAnnotations = () => {
    setAnnotations([]);
    setSelectedAnnotationId(null);
    setDraftAnnotation(null);
  };

  const toggleCamera = async () => {
    if (isRecording) return;
    if (cameraEnabled) {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
      setCameraEnabled(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setRecordingStatus('Camera access is unavailable in this browser');
      return;
    }

    try {
      setRecordingStatus('Requesting camera access');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: false
      });
      cameraStreamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        await cameraVideoRef.current.play().catch(() => {});
      }
      setCameraEnabled(true);
      setRecordingStatus('Camera ready');
    } catch (error) {
      setCameraEnabled(false);
      setRecordingStatus(`Camera could not start: ${error.message}`);
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await stageShellRef.current?.requestFullscreen?.();
      }
    } catch (error) {
      setRecordingStatus(`Fullscreen could not start: ${error.message}`);
    }
  };

  const drawAnnotationToCanvas = (context, annotation, canvasWidth, canvasHeight) => {
    if (!annotation) return;
    const start = { x: annotation.start.x * canvasWidth, y: annotation.start.y * canvasHeight };
    const end = { x: annotation.end.x * canvasWidth, y: annotation.end.y * canvasHeight };
    const lineWidth = Math.max(3, annotation.width * (canvasWidth / STAGE_WIDTH));
    context.save();
    context.strokeStyle = annotation.color;
    context.fillStyle = annotation.color;
    context.lineWidth = lineWidth;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.shadowColor = 'rgba(0, 0, 0, 0.42)';
    context.shadowBlur = lineWidth * 0.8;

    if (annotation.type === 'pen') {
      const points = annotation.points || [];
      if (points.length > 1) {
        context.beginPath();
        context.moveTo(points[0].x * canvasWidth, points[0].y * canvasHeight);
        points.slice(1).forEach((point) => context.lineTo(point.x * canvasWidth, point.y * canvasHeight));
        context.stroke();
      }
    } else if (annotation.type === 'circle') {
      const centerX = (start.x + end.x) / 2;
      const centerY = (start.y + end.y) / 2;
      context.beginPath();
      context.ellipse(centerX, centerY, Math.abs(end.x - start.x) / 2, Math.abs(end.y - start.y) / 2, 0, 0, Math.PI * 2);
      context.stroke();
    } else {
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();

      if (annotation.type === 'arrow') {
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const headLength = Math.max(18, lineWidth * 4);
        context.beginPath();
        context.moveTo(end.x, end.y);
        context.lineTo(end.x - headLength * Math.cos(angle - Math.PI / 6), end.y - headLength * Math.sin(angle - Math.PI / 6));
        context.lineTo(end.x - headLength * Math.cos(angle + Math.PI / 6), end.y - headLength * Math.sin(angle + Math.PI / 6));
        context.closePath();
        context.fill();
      }
    }
    context.restore();
  };

  const drawCompositeFrame = () => {
    const canvas = recordCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const context = canvas.getContext('2d', { alpha: false });
    const width = canvas.width;
    const height = canvas.height;
    const settings = settingsRef.current;

    context.save();
    context.fillStyle = '#080b12';
    context.fillRect(0, 0, width, height);

    if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
      const baseScale = settings.fitMode === 'cover'
        ? Math.max(width / video.videoWidth, height / video.videoHeight)
        : Math.min(width / video.videoWidth, height / video.videoHeight);
      const scale = baseScale * settings.zoomLevel;
      const drawWidth = video.videoWidth * scale;
      const drawHeight = video.videoHeight * scale;
      context.drawImage(video, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    }

    annotationsRef.current.forEach((annotation) => drawAnnotationToCanvas(context, annotation, width, height));
    if (draftRef.current) drawAnnotationToCanvas(context, draftRef.current, width, height);

    const cameraVideo = cameraVideoRef.current;
    if (settings.cameraEnabled && cameraVideo?.readyState >= 2) {
      const cameraWidth = Math.round(width * CAMERA_SIZES[settings.cameraSize]);
      const cameraHeight = Math.round(cameraWidth * (9 / 16));
      const margin = Math.round(width * 0.018);
      const cameraX = settings.cameraPosition.endsWith('right') ? width - cameraWidth - margin : margin;
      const cameraY = settings.cameraPosition.startsWith('bottom') ? height - cameraHeight - margin : margin;
      const radius = Math.round(width * 0.008);
      context.save();
      roundedRectPath(context, cameraX, cameraY, cameraWidth, cameraHeight, radius);
      context.clip();
      drawMediaCover(context, cameraVideo, cameraX, cameraY, cameraWidth, cameraHeight);
      context.restore();
      context.save();
      roundedRectPath(context, cameraX, cameraY, cameraWidth, cameraHeight, radius);
      context.strokeStyle = '#ffffff';
      context.lineWidth = Math.max(3, width * 0.0025);
      context.shadowColor = 'rgba(0, 0, 0, 0.55)';
      context.shadowBlur = width * 0.012;
      context.stroke();
      context.restore();
    }
    context.restore();
  };

  const buildMixedAudio = async () => {
    const streams = [];
    const sources = [];
    let clipAudioCaptured = false;

    if (clipAudioEnabled) {
      try {
        const captureStream = videoRef.current?.captureStream?.() || videoRef.current?.mozCaptureStream?.();
        if (captureStream?.getAudioTracks().length) {
          streams.push(captureStream);
          sources.push({ stream: captureStream, gain: 0.88 });
          clipAudioCaptured = true;
        }
      } catch {
        clipAudioCaptured = false;
      }
    }

    if (micEnabled) {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access is unavailable');
      const micStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000
        }
      });
      streams.push(micStream);
      sources.push({ stream: micStream, gain: 1 });
    }

    if (!sources.length) return { audioTracks: [], audioContext: null, streams, clipAudioCaptured };
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return {
        audioTracks: sources.flatMap((source) => source.stream.getAudioTracks()),
        audioContext: null,
        streams,
        clipAudioCaptured
      };
    }

    const audioContext = new AudioContextClass({ sampleRate: 48000 });
    await audioContext.resume();
    const destination = audioContext.createMediaStreamDestination();
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.2;
    compressor.connect(destination);

    sources.forEach(({ stream, gain }) => {
      const sourceNode = audioContext.createMediaStreamSource(stream);
      const gainNode = audioContext.createGain();
      gainNode.gain.value = gain;
      sourceNode.connect(gainNode);
      gainNode.connect(compressor);
    });

    return {
      audioTracks: destination.stream.getAudioTracks(),
      audioContext,
      streams,
      clipAudioCaptured
    };
  };

  const cleanupRecordingResources = async () => {
    window.cancelAnimationFrame(animationFrameRef.current);
    window.clearInterval(recordingTimerRef.current);
    const resources = recordingResourcesRef.current;
    resources?.streams?.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
    resources?.canvasStream?.getTracks().forEach((track) => track.stop());
    await resources?.audioContext?.close?.().catch?.(() => {});
    recordingResourcesRef.current = null;
  };

  const startReactionRecording = async () => {
    if (!videoUrl) {
      setRecordingStatus('Upload a match clip first');
      return;
    }
    if (!window.MediaRecorder || !recordCanvasRef.current?.captureStream) {
      setRecordingStatus('Clean video recording is unavailable in this browser');
      return;
    }

    try {
      setRecordingStatus('Preparing reaction');
      setSavedRecordingPath('');
      if (recordedObjectUrlRef.current) {
        URL.revokeObjectURL(recordedObjectUrlRef.current);
        recordedObjectUrlRef.current = '';
      }
      setRecordedReactionUrl('');

      const quality = OUTPUT_QUALITY[recordingQuality];
      const canvas = recordCanvasRef.current;
      canvas.width = quality.width;
      canvas.height = quality.height;
      drawCompositeFrame();
      const canvasStream = canvas.captureStream(30);
      const audio = await buildMixedAudio();
      const recordingStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audio.audioTracks
      ]);
      const mimeType = getRecordingMimeType();
      const recorder = new MediaRecorder(recordingStream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: quality.bitRate,
        audioBitsPerSecond: 192_000
      });

      recordingResourcesRef.current = {
        audioContext: audio.audioContext,
        canvasStream,
        recordingStream,
        streams: audio.streams
      };
      recordingChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data?.size) recordingChunksRef.current.push(event.data);
      };

      recorder.onerror = async (event) => {
        setIsRecording(false);
        setRecordingStatus(`Recording error: ${event.error?.message || 'Unknown error'}`);
        await cleanupRecordingResources();
      };

      recorder.onstop = async () => {
        const finalType = recorder.mimeType || mimeType || 'video/webm';
        const blob = new Blob(recordingChunksRef.current, { type: finalType });
        const nextUrl = URL.createObjectURL(blob);
        recordedObjectUrlRef.current = nextUrl;
        setRecordedReactionUrl(nextUrl);
        setRecordingStatus('Reaction ready');

        const isElectron = /Electron/i.test(navigator.userAgent);
        if (isElectron && window.electron?.saveRecordedFile) {
          setRecordingStatus('Saving reaction');
          const result = await window.electron.saveRecordedFile(
            await blob.arrayBuffer(),
            `${safeFileName(videoName)}-reaction`
          );
          if (result?.success) {
            setSavedRecordingPath(result.filePath || result.rawFilePath || 'Saved locally');
            setRecordingStatus('Reaction saved locally');
          } else {
            setRecordingStatus(`Preview ready. Save failed: ${result?.error || 'Unknown error'}`);
          }
        }
        await cleanupRecordingResources();
      };

      const drawLoop = () => {
        drawCompositeFrame();
        animationFrameRef.current = window.requestAnimationFrame(drawLoop);
      };
      drawLoop();
      recorder.start(1000);
      setRecordingSeconds(0);
      setIsRecording(true);
      setRecordingStatus(audio.clipAudioCaptured || !clipAudioEnabled
        ? 'Recording reaction'
        : 'Recording reaction without clip audio');
      const startedAt = Date.now();
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds(Math.floor((Date.now() - startedAt) / 1000));
      }, 250);
    } catch (error) {
      setIsRecording(false);
      setRecordingStatus(`Could not start: ${error.message}`);
      await cleanupRecordingResources();
    }
  };

  const stopReactionRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
    videoRef.current?.pause();
    drawCompositeFrame();
    setIsRecording(false);
    setRecordingStatus('Finalizing reaction');
    window.clearInterval(recordingTimerRef.current);
    mediaRecorderRef.current.stop();
  };

  const downloadRecording = () => {
    if (!recordedReactionUrl) return;
    const link = document.createElement('a');
    const type = mediaRecorderRef.current?.mimeType || 'video/webm';
    link.href = recordedReactionUrl;
    link.download = `${safeFileName(videoName)}-reaction.${type.includes('mp4') ? 'mp4' : 'webm'}`;
    link.click();
  };

  const renderAnnotation = (annotation, isDraft = false) => {
    if (!annotation) return null;
    const selected = !isDraft && selectedAnnotationId === annotation.id;
    const startX = annotation.start.x * STAGE_WIDTH;
    const startY = annotation.start.y * STAGE_HEIGHT;
    const endX = annotation.end.x * STAGE_WIDTH;
    const endY = annotation.end.y * STAGE_HEIGHT;
    const markerId = `reaction-arrow-${annotation.id}`;
    const commonProps = {
      fill: 'none',
      stroke: annotation.color,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: annotation.width,
      vectorEffect: 'non-scaling-stroke'
    };
    const selectAnnotation = (event) => {
      if (activeTool !== 'select') return;
      event.stopPropagation();
      setSelectedAnnotationId(annotation.id);
    };

    let visibleShape;
    let hitShape;
    if (annotation.type === 'pen') {
      const points = (annotation.points || []).map((point) => `${point.x * STAGE_WIDTH},${point.y * STAGE_HEIGHT}`).join(' ');
      visibleShape = <polyline {...commonProps} points={points} />;
      hitShape = <polyline fill="none" onPointerDown={selectAnnotation} points={points} stroke="transparent" strokeWidth="22" />;
    } else if (annotation.type === 'circle') {
      const cx = (startX + endX) / 2;
      const cy = (startY + endY) / 2;
      const rx = Math.abs(endX - startX) / 2;
      const ry = Math.abs(endY - startY) / 2;
      visibleShape = <ellipse {...commonProps} cx={cx} cy={cy} rx={rx} ry={ry} />;
      hitShape = <ellipse cx={cx} cy={cy} fill="none" onPointerDown={selectAnnotation} rx={rx} ry={ry} stroke="transparent" strokeWidth="22" />;
    } else {
      visibleShape = (
        <line
          {...commonProps}
          markerEnd={annotation.type === 'arrow' ? `url(#${markerId})` : undefined}
          x1={startX}
          x2={endX}
          y1={startY}
          y2={endY}
        />
      );
      hitShape = <line onPointerDown={selectAnnotation} stroke="transparent" strokeWidth="22" x1={startX} x2={endX} y1={startY} y2={endY} />;
    }

    return (
      <g className={selected ? 'selected' : ''} key={annotation.id}>
        <defs>
          <marker id={markerId} markerHeight="9" markerWidth="11" orient="auto" refX="9" refY="4.5">
            <path d="M0,0 L11,4.5 L0,9 Z" fill={annotation.color} />
          </marker>
        </defs>
        {selected && React.cloneElement(visibleShape, {
          markerEnd: undefined,
          opacity: 0.8,
          stroke: annotation.color === '#ffffff' ? '#111827' : '#ffffff',
          strokeDasharray: '5 7',
          strokeWidth: annotation.width + 5
        })}
        {visibleShape}
        {!isDraft && activeTool === 'select' && hitShape}
      </g>
    );
  };

  const hasRecording = Boolean(recordedReactionUrl);
  const cameraWidth = `${CAMERA_SIZES[cameraSize] * 100}%`;

  return (
    <div className="football-lab reaction-studio responsive-page">
      <input accept="video/*" onChange={handleUpload} ref={fileInputRef} type="file" />
      <canvas aria-hidden="true" className="reaction-record-canvas" ref={recordCanvasRef} />

      <header className="reaction-header">
        <div className="reaction-header-copy">
          <span className="reaction-eyebrow">Football Lab</span>
          <h1>Football Reaction Studio</h1>
          <p>{videoUrl ? videoName : 'Create a post-match video breakdown'}</p>
        </div>
        <div className="reaction-header-actions">
          <button className="reaction-button" disabled={isRecording} onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} /><span>{videoUrl ? 'Replace clip' : 'Upload clip'}</span>
          </button>
          <button className="reaction-button" onClick={toggleFullscreen}>
            <Maximize2 size={16} /><span>Fullscreen</span>
          </button>
          <button
            className={`reaction-button primary ${isRecording ? 'recording' : ''}`}
            disabled={!videoUrl}
            onClick={isRecording ? stopReactionRecording : startReactionRecording}
          >
            {isRecording ? <Square size={15} fill="currentColor" /> : <span className="reaction-record-dot" />}
            <span>{isRecording ? 'Stop reaction' : 'Record reaction'}</span>
          </button>
        </div>
      </header>

      <div className="reaction-workspace">
        <main className="reaction-stage-shell" ref={stageShellRef}>
          <div className="reaction-toolbar">
            <div className="reaction-tool-group" aria-label="Drawing tools">
              {Object.entries(TOOLS).map(([toolId, tool]) => {
                const Icon = tool.icon;
                return (
                  <button
                    aria-label={tool.label}
                    className={`reaction-icon-button ${activeTool === toolId ? 'active' : ''}`}
                    disabled={!videoUrl}
                    key={toolId}
                    onClick={() => {
                      setActiveTool(toolId);
                      setDraftAnnotation(null);
                    }}
                    title={tool.label}
                  >
                    <Icon size={18} />
                  </button>
                );
              })}
            </div>

            <span className="reaction-toolbar-divider" />

            <div className="reaction-color-group" aria-label="Drawing colors">
              {COLORS.map((color) => (
                <button
                  aria-label={`Use ${color} drawing color`}
                  className={`reaction-color-swatch ${activeColor === color ? 'active' : ''}`}
                  key={color}
                  onClick={() => setActiveColor(color)}
                  style={{ '--swatch-color': color }}
                  title={color}
                />
              ))}
            </div>

            <label className="reaction-width-control" title="Drawing width">
              <span>Width</span>
              <input max="12" min="3" onChange={(event) => setStrokeWidth(Number(event.target.value))} type="range" value={strokeWidth} />
            </label>

            <div className="reaction-toolbar-actions">
              <button className="reaction-icon-button" disabled={!annotations.length} onClick={undoAnnotation} title="Undo last drawing"><Undo2 size={17} /></button>
              <button
                className="reaction-icon-button"
                disabled={!selectedAnnotationId}
                onClick={() => {
                  setAnnotations((items) => items.filter((item) => item.id !== selectedAnnotationId));
                  setSelectedAnnotationId(null);
                }}
                title="Delete selected drawing"
              >
                <Eraser size={17} />
              </button>
              <button className="reaction-icon-button" disabled={!annotations.length} onClick={clearAnnotations} title="Clear all drawings"><Trash2 size={17} /></button>
              <button className="reaction-icon-button fullscreen-control" onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}><Expand size={17} /></button>
            </div>
          </div>

          <div
            className={`reaction-stage ${activeTool !== 'select' ? 'drawing' : ''}`}
            onPointerCancel={handleStagePointerUp}
            onPointerDown={handleStagePointerDown}
            onPointerMove={handleStagePointerMove}
            onPointerUp={handleStagePointerUp}
          >
            {videoUrl ? (
              <video
                className="reaction-match-video"
                muted={!clipAudioEnabled}
                onEnded={() => setIsPlaying(false)}
                onDurationChange={(event) => syncVideoDuration(event.currentTarget)}
                onLoadedMetadata={(event) => {
                  syncVideoDuration(event.currentTarget);
                  event.currentTarget.playbackRate = playbackSpeed;
                }}
                onPause={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onTimeUpdate={(event) => {
                  setCurrentTime(event.currentTarget.currentTime || 0);
                  syncVideoDuration(event.currentTarget);
                }}
                playsInline
                ref={videoRef}
                src={videoUrl}
                style={{ objectFit: fitMode, transform: `scale(${zoomLevel})` }}
              />
            ) : (
              <div className="reaction-empty-state">
                <span className="reaction-empty-icon"><Film size={34} /></span>
                <strong>Upload your match clip</strong>
                <p>MP4, WebM, MOV, or any browser-supported video</p>
                <button className="reaction-button light" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={16} /> Choose footage
                </button>
              </div>
            )}

            <svg
              aria-label="Video annotations"
              className="reaction-annotation-layer"
              preserveAspectRatio="none"
              style={{ pointerEvents: activeTool === 'select' ? 'auto' : 'none' }}
              viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`}
            >
              {annotations.map((annotation) => renderAnnotation(annotation))}
              {renderAnnotation(draftAnnotation, true)}
            </svg>

            {cameraEnabled && (
              <div className={`reaction-camera-frame ${cameraPosition}`} style={{ width: cameraWidth }}>
                <video autoPlay muted playsInline ref={cameraVideoRef} />
                <span><Camera size={12} /> Creator</span>
              </div>
            )}

            {isRecording && (
              <div className="reaction-live-badge"><span /> REC {formatTime(recordingSeconds, true)}</div>
            )}
          </div>

          <div className="reaction-transport">
            <div className="reaction-playback-buttons">
              <button className="reaction-icon-button" disabled={!videoUrl} onClick={() => skipBy(-5)} title="Back 5 seconds"><RotateCcw size={17} /></button>
              <button className="reaction-play-button" disabled={!videoUrl} onClick={togglePlayback} title={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
              </button>
              <button className="reaction-icon-button" disabled={!videoUrl} onClick={() => skipBy(5)} title="Forward 5 seconds"><Redo2 size={17} /></button>
            </div>

            <span className="reaction-timecode">{formatTime(currentTime)} / {formatTime(duration)}</span>
            <input
              aria-label="Video timeline"
              className="reaction-scrubber"
              disabled={!videoUrl}
              max={duration || 1}
              min="0"
              onChange={(event) => seekTo(event.target.value)}
              step="0.01"
              type="range"
              value={clamp(currentTime, 0, duration || 1)}
            />

            <select aria-label="Playback speed" className="reaction-select compact" disabled={!videoUrl} onChange={(event) => changePlaybackSpeed(event.target.value)} value={playbackSpeed}>
              <option value="0.5">0.5x</option>
              <option value="0.75">0.75x</option>
              <option value="1">1x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
            </select>

            <div className="reaction-zoom-controls">
              <button className="reaction-icon-button" disabled={!videoUrl || zoomLevel <= 1} onClick={() => setZoomLevel((value) => clamp(Number((value - 0.25).toFixed(2)), 1, 3))} title="Zoom out"><Minus size={16} /></button>
              <span>{zoomLevel.toFixed(2)}x</span>
              <button className="reaction-icon-button" disabled={!videoUrl || zoomLevel >= 3} onClick={() => setZoomLevel((value) => clamp(Number((value + 0.25).toFixed(2)), 1, 3))} title="Zoom in"><Plus size={16} /></button>
            </div>
          </div>

          <div className="reaction-stage-status">
            <span className={isRecording ? 'recording' : ''}>{recordingStatus}</span>
            <span>{annotations.length} drawing{annotations.length === 1 ? '' : 's'}</span>
          </div>
        </main>

        <aside className="reaction-control-rail">
          <section className="reaction-panel-section">
            <div className="reaction-panel-heading">
              <div><Camera size={17} /><h2>Creator</h2></div>
              <span className={cameraEnabled ? 'ready' : ''}>{cameraEnabled ? 'Camera on' : 'Optional'}</span>
            </div>
            <div className="reaction-setting-list">
              <SettingToggle checked={cameraEnabled} disabled={isRecording} icon={Video} label="Face camera" onChange={toggleCamera} />
              <SettingToggle checked={micEnabled} disabled={isRecording} icon={Mic} label="Microphone" onChange={setMicEnabled} />
              <SettingToggle checked={clipAudioEnabled} disabled={isRecording} icon={Volume2} label="Clip audio" onChange={setClipAudioEnabled} />
            </div>

            <div className={`reaction-camera-options ${cameraEnabled ? '' : 'disabled'}`}>
              <div className="reaction-option-row">
                <span>Face position</span>
                <div className="reaction-position-control">
                  {CAMERA_POSITIONS.map(([position, label]) => (
                    <button
                      aria-label={`Place camera ${position.replace('-', ' ')}`}
                      className={cameraPosition === position ? 'active' : ''}
                      disabled={!cameraEnabled || isRecording}
                      key={position}
                      onClick={() => setCameraPosition(position)}
                      title={position.replace('-', ' ')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="reaction-option-row">
                <span>Face size</span>
                <div className="reaction-segmented compact">
                  {['small', 'medium', 'large'].map((size) => (
                    <button className={cameraSize === size ? 'active' : ''} disabled={!cameraEnabled || isRecording} key={size} onClick={() => setCameraSize(size)}>
                      {size[0].toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="reaction-panel-section">
            <div className="reaction-panel-heading">
              <div><Gauge size={17} /><h2>Output</h2></div>
              <span>{recordingQuality}</span>
            </div>
            <label className="reaction-field">
              <span>Recording quality</span>
              <select className="reaction-select" disabled={isRecording} onChange={(event) => setRecordingQuality(event.target.value)} value={recordingQuality}>
                <option value="1080p">1080p Full HD</option>
                <option value="720p">720p performance</option>
              </select>
            </label>
            <div className="reaction-option-row frame-fit-row">
              <span>Clip fit</span>
              <div className="reaction-segmented">
                <button className={fitMode === 'contain' ? 'active' : ''} disabled={isRecording} onClick={() => setFitMode('contain')}>Fit</button>
                <button className={fitMode === 'cover' ? 'active' : ''} disabled={isRecording} onClick={() => setFitMode('cover')}>Fill</button>
              </div>
            </div>
          </section>

          <section className="reaction-panel-section reaction-recording-panel">
            <div className="reaction-panel-heading">
              <div><span className={`reaction-status-light ${isRecording ? 'live' : hasRecording ? 'complete' : ''}`} /><h2>Recording</h2></div>
              <span>{isRecording ? formatTime(recordingSeconds, true) : hasRecording ? 'Complete' : 'Ready'}</span>
            </div>
            <button
              className={`reaction-record-button ${isRecording ? 'recording' : ''}`}
              disabled={!videoUrl}
              onClick={isRecording ? stopReactionRecording : startReactionRecording}
            >
              {isRecording ? <Square size={16} fill="currentColor" /> : <span />}
              {isRecording ? 'Stop and save' : 'Start reaction'}
            </button>
            <p className="reaction-capture-status">{recordingStatus}</p>
            {savedRecordingPath && <p className="reaction-saved-path" title={savedRecordingPath}><Check size={13} /> {savedRecordingPath}</p>}
          </section>

          {recordedReactionUrl && (
            <section className="reaction-panel-section reaction-latest-output">
              <div className="reaction-panel-heading">
                <div><Play size={17} /><h2>Latest reaction</h2></div>
              </div>
              <video controls playsInline src={recordedReactionUrl} />
              <button className="reaction-button download" onClick={downloadRecording}>
                <Download size={16} /> Download video
              </button>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
