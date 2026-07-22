import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowLeft, Save, Download, Sparkles, Sliders, Image, 
  MousePointer, Scissors, Film, RefreshCw, Type, Eye, Camera, Layers,
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  ZoomIn, ZoomOut, Wand2, Check, AlertCircle, Clock,
  ChevronDown, Plus, Trash2, Lock
} from 'lucide-react';

export default function Editor({ projectId, onCloseProject, license }) {
  const isPro = license?.plan === 'pro';
  const [project, setProject] = useState(null);
  const [settings, setSettings] = useState({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(30);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [savedStatus, setSavedStatus] = useState('saved'); // 'saved' | 'saving' | 'error'
  const [timelineZoom, setTimelineZoom] = useState(1);
  
  // Captions list
  const [captions, setCaptions] = useState([]);
  const [loadingCaptions, setLoadingCaptions] = useState(false);
  const [captionError, setCaptionError] = useState('');
  const [sidebarTab, setSidebarTab] = useState('zoom');
  
  // Silence Detection
  const [silencePeriods, setSilencePeriods] = useState([]);
  const [autoCutSilence, setAutoCutSilence] = useState(false);
  const [silenceSensitivity, setSilenceSensitivity] = useState(-40);
  const [detectingSilence, setDetectingSilence] = useState(false);

  // AI Scene Detection
  const [smartZoomActive, setSmartZoomActive] = useState(false);
  const [sceneEvents, setSceneEvents] = useState([]);
  const [analyzingScene, setAnalyzingScene] = useState(false);

  // Exporter modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('mp4');
  const [exportQuality, setExportQuality] = useState('high');
  const [exportProgress, setExportProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStartTime, setExportStartTime] = useState(0);
  const [exportDone, setExportDone] = useState(false);
  const [exportError, setExportError] = useState('');
  const [mediaPort, setMediaPort] = useState(10101);
  const [selectedClipId, setSelectedClipId] = useState('screen');
  const [timelineDrag, setTimelineDrag] = useState(null);
  const [previewStatus, setPreviewStatus] = useState('Loading video...');

  // Timeline clips state
  const [timelineClips, setTimelineClips] = useState([
    { id: 'screen', label: 'Screen Recording', start: 0, end: 1, color: '#f5f5f5', track: 0, enabled: true },
    { id: 'audio', label: 'Microphone Audio', start: 0, end: 1, color: '#a3a3a3', track: 1, enabled: true },
    { id: 'webcam', label: 'Webcam Overlay', start: 0.05, end: 1, color: '#737373', track: 2, enabled: true },
  ]);

  // Refs for real-time preview simulation
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const videoSourcesRef = useRef([]);
  const videoSourceIndexRef = useRef(0);
  const cursorEventsRef = useRef([]);
  const timelineRef = useRef(null);
  const exportProgressUnsubscribeRef = useRef(null);
  const timelineDragRef = useRef(null);
  const timelineClipsRef = useRef(timelineClips);
  const brandLogoRef = useRef(null);

  // Smooth Zoom state for Screen Studio continuous panning
  const smoothZoomRef = useRef(1.0);
  const smoothZoomXRef = useRef(960);
  const smoothZoomYRef = useRef(540);
  const smoothCursorXRef = useRef(960);
  const smoothCursorYRef = useRef(540);

  useEffect(() => {
    loadProjectData();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      exportProgressUnsubscribeRef.current?.();
    };
  }, [projectId]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      videoRef.current.volume = volume;
    }
  }, [isMuted, volume]);

  useEffect(() => {
    timelineDragRef.current = timelineDrag;
  }, [timelineDrag]);

  useEffect(() => {
    timelineClipsRef.current = timelineClips;
  }, [timelineClips]);

  useEffect(() => {
    if (!settings.brand_logo) {
      brandLogoRef.current = null;
      return;
    }
    const img = new window.Image();
    img.onload = () => { brandLogoRef.current = img; };
    img.onerror = () => { brandLogoRef.current = null; };
    img.src = settings.brand_logo.startsWith('data:') || settings.brand_logo.startsWith('http')
      ? settings.brand_logo
      : `file:///${settings.brand_logo.replace(/\\/g, '/')}`;
  }, [settings.brand_logo]);

  useEffect(() => {
    const handleMove = (event) => {
      const drag = timelineDragRef.current;
      if (!drag || !timelineRef.current || duration <= 0) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      const time = pct * duration;
      const minLength = Math.min(1, Math.max(0.15, duration * 0.04));

      setTimelineClips((clips) => {
        const nextClips = clips.map((clip) => {
        if (clip.id !== drag.id) return clip;

        if (drag.mode === 'move') {
          const length = drag.end - drag.start;
          const nextStart = Math.min(Math.max(0, time - drag.offset), Math.max(0, duration - length));
          return {
            ...clip,
            start: nextStart / duration,
            end: (nextStart + length) / duration
          };
        }

        if (drag.mode === 'trim-start') {
          const nextStart = Math.min(time, drag.end - minLength);
          return { ...clip, start: Math.max(0, nextStart) / duration };
        }

        if (drag.mode === 'trim-end') {
          const nextEnd = Math.max(time, drag.start + minLength);
          return { ...clip, end: Math.min(duration, nextEnd) / duration };
        }

        return clip;
        });
        timelineClipsRef.current = nextClips;
        return nextClips;
      });
    };

    const handleUp = () => {
      if (timelineDragRef.current) {
        saveTimelineClips(timelineClipsRef.current);
      }
      setTimelineDrag(null);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [duration]);

  const loadProjectData = async () => {
    if (window.electron && window.electron.getProject) {
      const proj = await window.electron.getProject(projectId);
      setProject(proj);
      setSettings(proj.settings || {});
      if (proj?.duration) setDuration(proj.duration);
      if (Array.isArray(proj?.settings?.timeline_clips)) {
        const repairedClips = proj.settings.timeline_clips.map((clip) => {
          if ((clip.id === 'screen' || clip.id === 'audio') && clip.start === 0 && clip.end < 0.99) {
            return { ...clip, end: 1 };
          }
          if (clip.id === 'webcam' && clip.end < 0.99) {
            return { ...clip, end: 1 };
          }
          return clip;
        });
        setTimelineClips(repairedClips);
        if (JSON.stringify(repairedClips) !== JSON.stringify(proj.settings.timeline_clips)) {
          await window.electron.updateProject(projectId, { timeline_clips: repairedClips });
        }
      }
      
      const events = await window.electron.getCursorEvents(projectId);
      cursorEventsRef.current = events;

      const caps = await window.electron.getCaptions(projectId);
      const placeholderPhrases = [
        'Opening section for',
        'Main point detected from the recording timeline.',
        'Important moment marked for review and editing.',
        'Closing takeaway ready for captions or chapters.'
      ];
      const realCaptions = (caps || []).filter((caption) => (
        !placeholderPhrases.some((phrase) => caption.text?.startsWith?.(phrase))
      ));
      setCaptions(realCaptions);
      if ((caps || []).length && realCaptions.length !== caps.length) {
        setCaptionError('Previous placeholder captions were removed. Click "AI Captions" to transcribe the actual recording.');
      }

      if (proj && proj.video_path && videoRef.current) {
        const previewVideo = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4';
        setPreviewStatus('Loading video...');
        
        let activePort = 10101;
        if (window.electron?.getMediaPort) {
          activePort = await window.electron.getMediaPort();
          setMediaPort(activePort);
        }
        
        const makeSources = (filePath) => {
          if (!filePath) return [];
          if (filePath.startsWith('browser-preview-recording') || filePath === 'mock_screen.mp4') return [previewVideo];
          if (filePath.startsWith('http') || filePath.startsWith('blob:')) return [filePath];

          const normalized = filePath.replace(/\\/g, '/');
          return [
            `file:///${normalized}`,
            `screenflow-media:///${encodeURIComponent(normalized)}`,
            `http://127.0.0.1:${activePort}/video?path=${encodeURIComponent(filePath)}`
          ];
        };

        const sourceList = [
          ...makeSources(proj.video_path),
          ...makeSources(proj.raw_video_path)
        ].filter((source, index, arr) => source && arr.indexOf(source) === index);

        videoSourcesRef.current = sourceList;
        videoSourceIndexRef.current = 0;
        const source = sourceList[0];
        if (!source) {
          setPreviewStatus('No playable video source is available for this project.');
          return;
        }

        const video = videoRef.current;
        video.pause();
        video.removeAttribute('src');
        video.load();
        video.src = source;
        video.muted = isMuted;
        video.preload = 'auto';
        video.onloadedmetadata = () => {
          if (proj.duration && proj.duration > 0) {
            setDuration(proj.duration);
          } else if (video.duration && isFinite(video.duration)) {
            setDuration(video.duration);
          }
        };
        video.onloadeddata = () => {
          setPreviewStatus('');
          if (animationRef.current) cancelAnimationFrame(animationRef.current);
          animationRef.current = requestAnimationFrame(renderPreview);
        };
        video.onended = () => {
          setIsPlaying(false);
          if (animationRef.current) cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
          setCurrentTime(video.duration && Number.isFinite(video.duration) ? video.duration : duration);
        };
        video.onerror = () => {
          const error = video.error;
          const nextIndex = videoSourceIndexRef.current + 1;
          if (nextIndex < videoSourcesRef.current.length) {
            videoSourceIndexRef.current = nextIndex;
            const nextSource = videoSourcesRef.current[nextIndex];
            setPreviewStatus('Trying alternate video source...');
            video.pause();
            video.src = nextSource;
            video.load();
            return;
          }

          setPreviewStatus(error?.message || 'Video could not be loaded. Check the recorded file path.');
          console.error('Editor video load failed:', { sources: videoSourcesRef.current, error });
        };
        video.load();
        // Always ensure render loop starts
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        animationRef.current = requestAnimationFrame(renderPreview);
        
        video.onseeked = () => {
          if (!animationRef.current) animationRef.current = requestAnimationFrame(renderPreview);
        };
      } else {
        setPreviewStatus('No video file is attached to this project.');
      }
    }
  };

  const handleSaveSettings = async (updatedFields) => {
    setSavedStatus('saving');
    const nextSettings = { ...settings, ...updatedFields };
    setSettings(nextSettings);
    if (window.electron && window.electron.updateProject) {
      await window.electron.updateProject(projectId, updatedFields);
    }
    setSavedStatus('saved');
  };

  const saveTimelineClips = async (nextClips) => {
    setTimelineClips(nextClips);
    setSettings((prev) => ({ ...prev, timeline_clips: nextClips }));
    if (window.electron?.updateProject) {
      await window.electron.updateProject(projectId, { timeline_clips: nextClips });
    }
  };

  const easeInOutCubic = (t) => (
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  );

  const getCursorPointAtTime = (events, timestamp, width, height, video) => {
    if (!events || events.length === 0) {
      return { x: width / 2, y: height / 2, source: null };
    }

    let previous = events[0];
    let next = null;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (event.timestamp <= timestamp) {
        previous = event;
      } else {
        next = event;
        break;
      }
    }

    const span = next ? Math.max(0.001, next.timestamp - previous.timestamp) : 1;
    const progress = next ? Math.min(1, Math.max(0, (timestamp - previous.timestamp) / span)) : 0;
    const eased = easeInOutCubic(progress);
    const rawX = next ? previous.x + (next.x - previous.x) * eased : previous.x;
    const rawY = next ? previous.y + (next.y - previous.y) * eased : previous.y;

    let minX = events[0].x;
    let maxX = events[0].x;
    let minY = events[0].y;
    let maxY = events[0].y;
    for (let i = 1; i < events.length; i++) {
      const ev = events[i];
      if (ev.x < minX) minX = ev.x;
      if (ev.x > maxX) maxX = ev.x;
      if (ev.y < minY) minY = ev.y;
      if (ev.y > maxY) maxY = ev.y;
    }
    const sourceWidth = video?.videoWidth || (maxX - minX) || width;
    const sourceHeight = video?.videoHeight || (maxY - minY) || height;
    const hasAbsoluteScreenCoords = minX < 0 || minY < 0 || maxX > sourceWidth || maxY > sourceHeight;

    const normalizedX = hasAbsoluteScreenCoords
      ? (rawX - minX) / Math.max(1, maxX - minX)
      : rawX / Math.max(1, sourceWidth);
    const normalizedY = hasAbsoluteScreenCoords
      ? (rawY - minY) / Math.max(1, maxY - minY)
      : rawY / Math.max(1, sourceHeight);

    return {
      x: Math.min(width, Math.max(0, normalizedX * width)),
      y: Math.min(height, Math.max(0, normalizedY * height)),
      source: previous
    };
  };

  const getActiveClick = (events, timestamp, width, height, video) => {
    const click = [...events]
      .reverse()
      .find((event) => event.event_type?.includes('click') && timestamp - event.timestamp >= 0 && timestamp - event.timestamp < 1.25);

    if (!click) return null;

    const point = getCursorPointAtTime(events, click.timestamp, width, height, video);
    return { ...click, x: point.x, y: point.y };
  };

  const getClipById = (id) => timelineClips.find((clip) => clip.id === id);

  const isClipActive = (id, timestamp = currentTime) => {
    const clip = getClipById(id);
    if (!clip || !duration) return true;
    if (clip.enabled === false) return false;
    const start = clip.start * duration;
    const end = clip.end * duration;
    return timestamp >= start && timestamp <= end;
  };

  const seekToTimelineEvent = (event) => {
    if (!timelineRef.current || duration <= 0) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const newTime = pct * duration;
    if (videoRef.current) videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = requestAnimationFrame(renderPreview);
  };

  const startClipDrag = (event, clip, mode) => {
    event.stopPropagation();
    setSelectedClipId(clip.id);
    const start = clip.start * duration;
    const end = clip.end * duration;
    const rect = timelineRef.current?.getBoundingClientRect();
    const pointerTime = rect ? (((event.clientX - rect.left) / rect.width) * duration) : start;
    setTimelineDrag({
      id: clip.id,
      mode,
      start,
      end,
      offset: Math.max(0, pointerTime - start)
    });
  };

  const drawCinematicCursor = (ctx, x, y, activeClick, cursorAlpha = 1) => {
    if (settings.cursor_baked) return;
    if (settings.cursor_visible === false) return;
    if (cursorAlpha <= 0.02) return;

    const hSize = settings.cursor_size || 40;
    const hColor = settings.cursor_color || '#ff4500';
    const highlightMode = settings.cursor_highlight || 'ripple';
    const cursorStyle = settings.cursor_style || 'arrow';

    if (highlightMode !== 'none') {
      ctx.save();
      ctx.globalAlpha = (settings.cursor_opacity !== undefined ? settings.cursor_opacity : 0.8) * cursorAlpha;

      if (activeClick && (highlightMode === 'ripple' || highlightMode === 'both')) {
        const age = videoRef.current ? videoRef.current.currentTime - activeClick.timestamp : 0;
        if (age < 0.7) {
          ctx.beginPath();
          ctx.arc(activeClick.x, activeClick.y, hSize * 2.2 * (age / 0.7), 0, 2 * Math.PI);
          ctx.strokeStyle = hColor;
          ctx.lineWidth = 5 * (1 - (age / 0.7));
          ctx.stroke();
        }
      }

      if (highlightMode === 'glow' || highlightMode === 'both' || highlightMode === 'spotlight') {
        const grad = ctx.createRadialGradient(x, y, 0, x, y, hSize * 1.7);
        grad.addColorStop(0, hColor);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, hSize * 1.7, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.restore();
    }

    const cSize = (settings.cursor_size || 40) * (settings.cursor_scale || 1.0);

    ctx.save();
    ctx.globalAlpha = cursorAlpha;
    ctx.shadowColor = 'rgba(0,0,0,0.42)';
    ctx.shadowBlur = 7;
    ctx.lineWidth = 2;

    if (cursorStyle === 'dot') {
      ctx.fillStyle = hColor;
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, cSize * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (cursorStyle === 'ring') {
      ctx.strokeStyle = hColor;
      ctx.lineWidth = Math.max(3, cSize * 0.08);
      ctx.beginPath();
      ctx.arc(x, y, cSize * 0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, Math.max(3, cSize * 0.08), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + cSize * 0.72, y + cSize * 0.7);
      ctx.lineTo(x + cSize * 0.26, y + cSize * 0.82);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  };

  // Real-time canvas rendering loop
  const renderPreview = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    // Live Auto-Cut Silence preview skipping
    if (autoCutSilence && silencePeriods.length > 0) {
      const t = video.currentTime;
      const matched = silencePeriods.find(p => t >= p.start && t < p.end);
      if (matched) {
        video.currentTime = matched.end;
      }
    }

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const timestamp = video.currentTime;
    setCurrentTime(timestamp);
    const mediaDuration = Number.isFinite(video.duration) ? video.duration : 0;
    const playbackEnd = Math.max(0, Math.min(
      mediaDuration || duration || 0,
      duration || mediaDuration || 0
    ));
    if (isPlaying && playbackEnd > 0 && timestamp >= playbackEnd - 0.05) {
      video.pause();
      video.currentTime = playbackEnd;
      setCurrentTime(playbackEnd);
      setIsPlaying(false);
      animationRef.current = null;
      return;
    }
    const videoReady = video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
    const screenActive = isClipActive('screen', timestamp);
    const audioActive = isClipActive('audio', timestamp);
    const webcamActive = isClipActive('webcam', timestamp);
    video.muted = isMuted || !audioActive;

    // 1. Draw Background
    ctx.save();
    if (settings.background_type === 'solid') {
      ctx.fillStyle = settings.background_value || '#1e1e2e';
      ctx.fillRect(0, 0, width, height);
    } else if (settings.background_type === 'blur') {
      ctx.filter = 'blur(40px) brightness(0.5)';
      try {
        ctx.drawImage(video, -50, -50, width + 100, height + 100);
      } catch (e) {
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, width, height);
      }
    } else if (settings.background_type === 'image') {
      ctx.fillStyle = '#141424';
      ctx.fillRect(0, 0, width, height);
      // Draw simulated grid/wallpaper background patterns
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)';
      ctx.lineWidth = 1;
      for (let i = 0; i < width; i += 60) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
      }
      for (let j = 0; j < height; j += 60) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(width, j);
        ctx.stroke();
      }
    } else {
      // Gradient
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, settings.background_value_start || '#ffffff');
      grad.addColorStop(1, settings.background_value_end || '#111111');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();

    if (!screenActive) {
      ctx.save();
      ctx.fillStyle = '#070912';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.font = '700 22px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('Screen track is trimmed here', width / 2, height / 2);
      ctx.restore();
      animationRef.current = requestAnimationFrame(renderPreview);
      return;
    }

    // 2. Smooth cursor tracker and normalize it into the preview canvas.
    const events = cursorEventsRef.current;
    const cursorPoint = getCursorPointAtTime(events, timestamp, width, height, video);
    let currentX = cursorPoint.x;
    let currentY = cursorPoint.y;
    let cursorAlpha = 1;
    let activeClick = getActiveClick(events, timestamp, width, height, video);

    if (settings.cursor_loop_to_start && duration > 1.5 && timestamp > duration - 1.2 && events.length > 0) {
      const loopT = Math.min(1, Math.max(0, (timestamp - (duration - 1.2)) / 1.2));
      const firstPoint = getCursorPointAtTime(events, 0, width, height, video);
      currentX = currentX + (firstPoint.x - currentX) * loopT;
      currentY = currentY + (firstPoint.y - currentY) * loopT;
    }

    if (settings.cursor_auto_hide !== false && cursorPoint.source && !activeClick) {
      const idleDelay = settings.cursor_idle_hide_delay !== undefined ? settings.cursor_idle_hide_delay : 1.2;
      const idleTime = timestamp - cursorPoint.source.timestamp;
      if (idleTime > idleDelay) {
        cursorAlpha = Math.max(0, 1 - ((idleTime - idleDelay) / 0.45));
      }
    }
    if (settings.auto_smooth_cursor !== false) {
      const cursorEase = settings.cursor_smoothing !== undefined ? settings.cursor_smoothing : 0.18;
      smoothCursorXRef.current += (currentX - smoothCursorXRef.current) * cursorEase;
      smoothCursorYRef.current += (currentY - smoothCursorYRef.current) * cursorEase;
      currentX = smoothCursorXRef.current;
      currentY = smoothCursorYRef.current;
    } else {
      smoothCursorXRef.current = currentX;
      smoothCursorYRef.current = currentY;
    }
    // 3. Zoom Easing Calculation
    let targetZoom = 1.0;
    let targetX = width / 2;
    let targetY = height / 2;

    // Check if we have active AI scene suggested zoom active
    let activeSceneZoom = null;
    if (smartZoomActive && sceneEvents.length > 0) {
      activeSceneZoom = sceneEvents.find(s => timestamp >= s.timestamp && timestamp < s.timestamp + 1.1);
    }

    if (activeSceneZoom) {
      const age = timestamp - activeSceneZoom.timestamp;
      const sceneTargetZoom = activeSceneZoom.zoom || settings.zoom_level || 1.5;
      if (age <= 0.3) {
        const t = age / 0.3;
        targetZoom = 1.0 + (sceneTargetZoom - 1.0) * easeInOutCubic(t);
      } else if (age <= 0.8) {
        targetZoom = sceneTargetZoom;
      } else if (age <= 1.1) {
        const t = (1.1 - age) / 0.3;
        targetZoom = 1.0 + (sceneTargetZoom - 1.0) * easeInOutCubic(t);
      }
      targetX = currentX;
      targetY = currentY;
    } else if (activeClick && settings.zoom_level > 1.0) {
      const age = timestamp - activeClick.timestamp;
      const inDuration = settings.zoom_in_duration || 0.35;
      const holdDuration = settings.zoom_hold_duration || 0.55;
      const outDuration = settings.zoom_out_duration || 0.35;
      if (age <= inDuration) {
        const t = age / inDuration;
        targetZoom = 1.0 + (settings.zoom_level - 1.0) * easeInOutCubic(t);
      } else if (age <= inDuration + holdDuration) {
        targetZoom = settings.zoom_level;
      } else if (age <= inDuration + holdDuration + outDuration) {
        const t = (inDuration + holdDuration + outDuration - age) / outDuration;
        targetZoom = 1.0 + (settings.zoom_level - 1.0) * easeInOutCubic(t);
      }
      targetX = activeClick.x;
      targetY = activeClick.y;
    } else if (settings.follow_cursor !== false && settings.zoom_level > 1.0) {
      // Screen Studio style: Continuous cursor tracking zoom
      targetZoom = settings.zoom_level || 1.35;
      targetX = currentX;
      targetY = currentY;
    } else if (settings.follow_cursor === false && settings.zoom_level > 1.0) {
      // Manual click-to-focus static zoom
      targetZoom = settings.zoom_level || 1.35;
      targetX = (settings.zoom_center_x !== undefined ? settings.zoom_center_x : 0.5) * width;
      targetY = (settings.zoom_center_y !== undefined ? settings.zoom_center_y : 0.5) * height;
    }

    // Smoothly ease the zoom factor and panning coordinates over frames
    const zoomEase = settings.zoom_smoothing !== undefined ? settings.zoom_smoothing : 0.08;
    smoothZoomRef.current += (targetZoom - smoothZoomRef.current) * zoomEase;
    smoothZoomXRef.current += (targetX - smoothZoomXRef.current) * zoomEase;
    smoothZoomYRef.current += (targetY - smoothZoomYRef.current) * zoomEase;

    let zoom = smoothZoomRef.current;
    let zoomX = smoothZoomXRef.current;
    let zoomY = smoothZoomYRef.current;

    // 4. Draw Screen Capture with Motion Blur
    let blurAmt = 0;
    if (activeClick && settings.motion_blur !== 0) {
      const age = timestamp - activeClick.timestamp;
      const intensity = settings.motion_blur_intensity !== undefined ? settings.motion_blur_intensity : 0.5;
      
      if (age > 0 && age < 0.3) {
        // Zooming in transition
        const progress = age / 0.3;
        blurAmt = Math.sin(progress * Math.PI) * 15 * intensity;
      } else if (age > 0.8 && age < 1.1) {
        // Zooming out transition
        const progress = (age - 0.8) / 0.3;
        blurAmt = Math.sin(progress * Math.PI) * 15 * intensity;
      }
    }

    ctx.save();
    if (blurAmt > 0.5) {
      ctx.filter = `blur(${blurAmt.toFixed(1)}px)`;
    }

    if (zoom > 1.0) {
      ctx.translate(width / 2, height / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-zoomX, -zoomY);
    }

    try {
      if (!videoReady) {
        throw new Error('Video frame is not ready');
      }
      const vAspectRatio = (video.videoWidth && video.videoHeight) ? (video.videoWidth / video.videoHeight) : (16 / 9);
      const canvasAspectRatio = width / height;
      
      let drawW = width;
      let drawH = height;
      let drawX = 0;
      let drawY = 0;
      
      if (vAspectRatio > canvasAspectRatio) {
        drawW = height * vAspectRatio;
        drawX = (width - drawW) / 2;
      } else {
        drawH = width / vAspectRatio;
        drawY = (height - drawH) / 2;
      }

      ctx.drawImage(video, drawX, drawY, drawW, drawH);
    } catch (e) {
      // Fallback if video isn't ready
      ctx.fillStyle = '#080808';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 24px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(previewStatus || 'Loading video...', width / 2, height / 2);
      ctx.fillStyle = '#a3a3a3';
      ctx.font = '600 15px Inter, system-ui, sans-serif';
      ctx.fillText('The preview will appear here once media frames are ready.', width / 2, height / 2 + 30);
    }

    drawCinematicCursor(ctx, currentX, currentY, activeClick, cursorAlpha);
    ctx.restore();

    // 5. Draw Webcam Overlay mockup (only if enabled in settings)
    if (settings.webcam_enabled && !settings.webcam_baked && webcamActive) {
      const webcamPos = settings.webcam_position || 'bottom-right';
      const webcamScale = settings.webcam_size || 0.22;
      const camW = Math.round(width * webcamScale);
      const camH = Math.round(camW * 0.68);
      const margin = 42;
      let camX = width - camW - margin;
      let camY = height - camH - margin;

      if (webcamPos === 'top-left') {
        camX = margin;
        camY = margin;
      } else if (webcamPos === 'top-right') {
        camX = width - camW - margin;
        camY = margin;
      } else if (webcamPos === 'bottom-left') {
        camX = margin;
        camY = height - camH - margin;
      }

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.32)';
      ctx.shadowBlur = 22;
      ctx.shadowOffsetY = 10;

      ctx.beginPath();
      ctx.roundRect(camX, camY, camW, camH, 18);
      ctx.fillStyle = '#111827';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.72)';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.clip();
      const tileGrad = ctx.createLinearGradient(camX, camY, camX + camW, camY + camH);
      tileGrad.addColorStop(0, '#1f2937');
      tileGrad.addColorStop(1, '#334155');
      ctx.fillStyle = tileGrad;
      ctx.fillRect(camX, camY, camW, camH);

      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.arc(camX + camW * 0.22, camY + camH * 0.18, camW * 0.38, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(camX + camW / 2, camY + camH * 0.42, camH * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.roundRect(camX + camW * 0.28, camY + camH * 0.64, camW * 0.44, camH * 0.28, 28);
      ctx.fill();

      ctx.fillStyle = 'rgba(15,23,42,0.58)';
      ctx.fillRect(camX, camY + camH - 28, camW, 28);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 13px Inter';
      ctx.textAlign = 'left';
      ctx.fillText(settings.webcam_label || 'Camera', camX + 14, camY + camH - 10);
      ctx.restore();
    }

    // 8. Draw Captions overlays
    const currentCaption = captions.find(c => timestamp >= c.start_time && timestamp <= c.end_time);
    if (currentCaption) {
      ctx.save();
      const style = settings.caption_style || 'tiktok';
      
      if (style === 'tiktok') {
        // TikTok Style: Uppercase Bold Yellow with Heavy Stroke
        ctx.font = 'bold 36px Inter';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#facc15'; // Yellow
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 8;
        ctx.strokeText(currentCaption.text.toUpperCase(), width / 2, height - 140);
        ctx.fillText(currentCaption.text.toUpperCase(), width / 2, height - 140);
      } else if (style === 'youtube') {
        // YouTube Style: White text inside dark bounding box
        ctx.font = 'bold 28px Inter';
        ctx.textAlign = 'center';
        const txt = currentCaption.text;
        const textWidth = ctx.measureText(txt).width;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(width / 2 - textWidth/2 - 16, height - 170, textWidth + 32, 50);
        
        ctx.fillStyle = '#ffffff';
        ctx.fillText(txt, width / 2, height - 135);
      } else if (style === 'instagram') {
        // Instagram Style: Outfit/Italic Gradient with Shadow
        ctx.font = 'italic bold 32px Outfit';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 8;
        
        const grad = ctx.createLinearGradient(0, height - 160, 0, height - 110);
        grad.addColorStop(0, '#f97316'); // Orange
        grad.addColorStop(1, '#ffffff');
        ctx.fillStyle = grad;
        ctx.fillText(currentCaption.text, width / 2, height - 130);
      } else if (style === 'professional') {
        // Professional Style: Small clean bottom title bar
        ctx.font = '24px Inter';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(currentCaption.text, width / 2, height - 100);
      }
      ctx.restore();
    }

    // 9. Draw Watermark/Logo (Forced on Free plan!)
    const isPro = license?.plan === 'pro';
    const showWatermark = settings.watermark_enabled || !isPro;

    if (showWatermark) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 8;

      ctx.fillStyle = `rgba(15,23,42,${settings.watermark_opacity ?? 0.7})`;
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;

      const logoScale = settings.watermark_scale || 0.1;
      const wWidth = Math.max(160, Math.min(360, width * logoScale * 1.9));
      const wHeight = Math.max(40, Math.min(82, width * logoScale * 0.42));
      const position = settings.watermark_position || 'top-right';
      const wX = position.includes('left') ? 60 : width - wWidth - 60;
      const wY = position.includes('bottom') ? height - wHeight - 60 : 60;

      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(wX, wY, wWidth, wHeight, 8) : ctx.rect(wX, wY, wWidth, wHeight);
      ctx.fill();
      ctx.stroke();

      const logoImg = brandLogoRef.current;
      if (logoImg?.complete && logoImg.naturalWidth > 0) {
        const logoMaxW = wWidth - 28;
        const logoMaxH = wHeight - 16;
        const logoRatio = logoImg.naturalWidth / logoImg.naturalHeight;
        let logoW = logoMaxW;
        let logoH = logoW / logoRatio;
        if (logoH > logoMaxH) {
          logoH = logoMaxH;
          logoW = logoH * logoRatio;
        }
        ctx.drawImage(logoImg, wX + (wWidth - logoW) / 2, wY + (wHeight - logoH) / 2, logoW, logoH);
      } else {
        ctx.fillStyle = settings.brand_primary_color || 'rgba(255,255,255,0.9)';
        ctx.font = `bold ${Math.max(11, Math.min(22, wHeight * 0.3))}px ${settings.watermark_font || 'Inter'}`;
        ctx.textAlign = 'center';
        const watermarkText = (settings.watermark_text || settings.brand_name || 'SCREENFLOW AI').toUpperCase();
        ctx.fillText(watermarkText, wX + wWidth/2, wY + wHeight/2 + 5);
      }
      ctx.restore();

      if (!isPro) {
        ctx.save();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.font = 'bold 11px Inter';
        ctx.textAlign = 'right';
        ctx.fillText('SCREENFLOW AI (FREE TRIAL)', width - 60, 34);
        ctx.restore();
      }
    }

    // 10. Draw Lower Thirds (Display between 2.0s and 6.0s of video)
    if (settings.lower_third_enabled && timestamp >= 2.0 && timestamp <= 6.0) {
      ctx.save();
      const age = timestamp - 2.0;
      let slideX = 60;
      
      // Slide-in easing: slide from left margin
      if (age < 0.5) {
        slideX = -320 + (380 * (age / 0.5));
      } else if (age > 3.5) {
        // Slide-out easing
        slideX = 60 - (380 * ((age - 3.5) / 0.5));
      }

      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 20;
      
      // Glass banner background
      ctx.fillStyle = 'rgba(24, 24, 27, 0.85)';
      ctx.strokeStyle = settings.brand_primary_color || 'rgba(99, 102, 241, 0.3)';
      ctx.lineWidth = 2;
      
      const ltW = 340;
      const ltH = 76;
      const ltY = height - ltH - 60;
      
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(slideX, ltY, ltW, ltH, 12) : ctx.rect(slideX, ltY, ltW, ltH);
      ctx.fill();
      ctx.stroke();

      // Lower Third text descriptions
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Inter';
      ctx.textAlign = 'left';
      ctx.fillText(settings.brand_author || 'Alex Morgan', slideX + 20, ltY + 32);

      ctx.fillStyle = settings.brand_secondary_color || '#cbd5e1';
      ctx.font = '12px Inter';
      ctx.fillText(settings.brand_title || 'SaaS Founder', slideX + 20, ltY + 54);
      ctx.restore();
    }

    // 11. Draw Intro / Outro Animation overlays
    if (settings.intro_enabled && timestamp < 2.0) {
      ctx.save();
      const opacity = Math.max(0, 1 - (timestamp / 2.0));
      ctx.fillStyle = `rgba(9, 9, 11, ${opacity})`;
      ctx.fillRect(0, 0, width, height);

      // Intro title slide scale
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 48px Outfit';
      ctx.textAlign = 'center';
      const scale = 1.0 + (timestamp * 0.1);
      
      ctx.translate(width/2, height/2);
      ctx.scale(scale, scale);
      ctx.fillStyle = `rgba(255,255,255,${opacity})`;
      ctx.fillText((settings.brand_name || 'SCREENFLOW AI').toUpperCase(), 0, 10);
      ctx.restore();
    } else if (settings.outro_enabled && timestamp > (project?.duration || 10) - 2.0) {
      ctx.save();
      const outroStart = (project?.duration || 10) - 2.0;
      const opacity = Math.min(1, (timestamp - outroStart) / 2.0);
      ctx.fillStyle = `rgba(9, 9, 11, ${opacity})`;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px Outfit';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255,255,255,${opacity})`;
      ctx.fillText((settings.outro_text || 'THANKS FOR WATCHING').toUpperCase(), width/2, height/2 - 15);
      
      ctx.font = '16px Inter';
      ctx.fillStyle = `rgba(161,161,170,${opacity})`;
      ctx.fillText('Subscribe for more tutorials', width/2, height/2 + 20);
      ctx.restore();
    }

    if (!video.paused && !video.ended) {
      animationRef.current = requestAnimationFrame(renderPreview);
    } else {
      animationRef.current = null;
    }
  };

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;
    
    handleSaveSettings({
      zoom_center_x: clickX,
      zoom_center_y: clickY,
      follow_cursor: false
    });
  };

  const handleCanvasWheel = (e) => {
    if (settings.zoom_level === undefined) return;
    const zoomDelta = -e.deltaY * 0.001;
    const nextZoom = Math.max(1.0, Math.min(4.0, settings.zoom_level + zoomDelta));
    handleSaveSettings({ zoom_level: parseFloat(nextZoom.toFixed(2)) });
  };

  const handlePlayToggle = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      cancelAnimationFrame(animationRef.current);
      setIsPlaying(false);
    } else {
      video.muted = isMuted;
      const playPromise = video.play();
      if (playPromise !== undefined && typeof playPromise.catch === 'function') {
        playPromise
          .then(() => {
            setPreviewStatus('');
            setIsPlaying(true);
          })
          .catch((err) => {
          console.warn("Video playback was blocked or interrupted. Muting and retrying...", err);
          video.muted = true;
          setIsMuted(true);
          video.play()
            .then(() => {
              setPreviewStatus('');
              setIsPlaying(true);
            })
            .catch((e) => {
              setPreviewStatus(e?.message || 'Video playback failed.');
              setIsPlaying(false);
              console.error("Video play retry failed:", e);
            });
          });
      } else {
        setIsPlaying(true);
      }
      animationRef.current = requestAnimationFrame(renderPreview);
    }
  };

  // AI captions trigger
  const handleGenerateCaptions = async () => {
    if (!isPro) {
      alert("AI captions require a Pro Subscription.");
      return;
    }

    const storedKeys = await window.electron?.getAIKeys?.();
    const geminiKey = storedKeys?.gemini || localStorage.getItem('gemini_api_key') || '';
    const openAIKey = storedKeys?.openai || localStorage.getItem('openai_api_key') || '';
    const provider = geminiKey ? 'gemini' : openAIKey ? 'openai' : '';
    const apiKey = geminiKey || openAIKey;
    setLoadingCaptions(true);
    setCaptionError('');
    if (window.electron && window.electron.generateAICaptions) {
      const result = await window.electron.generateAICaptions(projectId, apiKey, provider);
      if (result.success) {
        setCaptions(result.captions);
      } else {
        setCaptions([]);
        setCaptionError(result.error || 'Captions could not be generated from this recording.');
      }
    }
    setLoadingCaptions(false);
  };

  const handleDetectSilence = async () => {
    setDetectingSilence(true);
    if (window.electron && window.electron.detectSilence) {
      const periods = await window.electron.detectSilence(projectId, silenceSensitivity);
      setSilencePeriods(periods);
    }
    setDetectingSilence(false);
  };

  const applySilenceCutToTimeline = (enabled) => {
    setAutoCutSilence(enabled);
    if (!enabled || silencePeriods.length === 0 || duration <= 0) return;

    const firstGap = silencePeriods[0];
    const lastGap = silencePeriods[silencePeriods.length - 1];
    const nextStart = Math.max(0, Math.min((firstGap.end || 0) / duration, 0.92));
    const nextEnd = Math.min(1, Math.max((lastGap.start || duration) / duration, nextStart + 0.08));

    const nextClips = timelineClips.map((clip) => (
      clip.id === 'screen' || clip.id === 'audio'
        ? { ...clip, start: nextStart, end: nextEnd, enabled: true }
        : clip
    ));
    saveTimelineClips(nextClips);
  };

  const toggleTimelineLayer = (id, enabled) => {
    const nextClips = timelineClips.map((clip) => (
      clip.id === id
        ? { ...clip, enabled, start: enabled ? Math.min(clip.start, 0.05) : clip.start, end: enabled ? Math.max(clip.end, 0.85) : clip.end }
        : clip
    ));
    saveTimelineClips(nextClips);
  };

  const handleScanScene = async () => {
    if (license?.plan !== 'pro') {
      alert("AI Scene Auto-Zoom suggestions require a Pro Edition license activation key.");
      return;
    }
    setAnalyzingScene(true);
    // Simulate complex AI scene analysis
    await new Promise(r => setTimeout(r, 1500));
    
    const recordedClicks = cursorEventsRef.current
      .filter((event) => event.event_type?.includes('click'))
      .filter((event, index, list) => index === 0 || event.timestamp - list[index - 1].timestamp > 0.8);

    const suggestions = recordedClicks.length > 0
      ? recordedClicks.slice(0, 12).map((event, index) => ({
          timestamp: event.timestamp,
          type: event.event_type,
          desc: `${event.event_type === 'right-click' ? 'Right' : 'Left'} click focus point`,
          zoom: index % 3 === 0 ? 1.65 : index % 3 === 1 ? 1.5 : 1.8
        }))
      : [
          { timestamp: 1.5, type: 'click', desc: 'Demo click focus point', zoom: 1.5 },
          { timestamp: 5.2, type: 'click', desc: 'Demo interaction focus point', zoom: 1.8 },
          { timestamp: 9.8, type: 'click', desc: 'Demo button focus point', zoom: 2.0 }
        ];
    
    setSceneEvents(suggestions);
    setSmartZoomActive(true);
    setAnalyzingScene(false);
  };

  const applyBrandKitToProject = async () => {
    if (!window.electron?.getBrandKit) return;
    const kit = await window.electron.getBrandKit();
    await handleSaveSettings({
      brand_preset: 'brand-kit',
      brand_name: kit.brand_name || 'SCREENFLOW AI',
      brand_author: kit.lower_third_name || 'Alex Morgan',
      brand_title: kit.lower_third_title || 'SaaS Founder',
      brand_primary_color: kit.primary_color || '#ffffff',
      brand_secondary_color: kit.secondary_color || '#737373',
      brand_logo: kit.primary_logo || null,
      brand_white_logo: kit.white_logo || null,
      watermark_enabled: true,
      watermark_text: kit.watermark_text || kit.brand_name || 'SCREENFLOW AI',
      watermark_opacity: kit.watermark_opacity ?? 0.7,
      watermark_position: kit.watermark_position || 'top-right',
      watermark_font: kit.watermark_font || 'Inter',
      lower_third_enabled: true,
      lower_third_style: kit.lower_third_style || 'modern',
      intro_style: kit.intro_style || 'fade',
      outro_style: kit.outro_style || 'subscribe',
      outro_text: kit.outro_text || 'Thanks for Watching!'
    });
  };

  // Export start
  const handleExport = async () => {
    let exportPath = '';
    if (window.electron?.saveFile) {
      exportPath = await window.electron.saveFile(`ScreenFlow_${projectId}.${exportFormat}`, [
        { name: 'Video Files', extensions: [exportFormat] }
      ]);
      if (!exportPath) {
        return;
      }
    }

    setShowExportModal(true);
    setIsExporting(true);
    setExportProgress(0);
    setExportDone(false);
    setExportError('');
    setExportStartTime(Date.now());

    if (window.electron && window.electron.startExport && exportPath) {
      exportProgressUnsubscribeRef.current?.();
      exportProgressUnsubscribeRef.current = window.electron.onExportProgress((data) => {
        setExportProgress(data.progress);
        if (data.error) {
          setExportError(data.error);
          setIsExporting(false);
          exportProgressUnsubscribeRef.current?.();
          exportProgressUnsubscribeRef.current = null;
        } else if (data.progress >= 100) {
          setIsExporting(false);
          setExportDone(true);
          exportProgressUnsubscribeRef.current?.();
          exportProgressUnsubscribeRef.current = null;
        }
      });

      try {
        await window.electron.startExport(projectId, exportPath, exportFormat, exportQuality);
      } catch (err) {
        setExportError(err.message);
        setIsExporting(false);
      }
    } else {
      // Demo: simulate progress
      let pct = 0;
      const interval = setInterval(() => {
        pct += Math.random() * 8 + 2;
        if (pct >= 100) {
          pct = 100;
          clearInterval(interval);
          setExportProgress(100);
          setTimeout(() => { setIsExporting(false); setExportDone(true); }, 400);
        } else {
          setExportProgress(Math.round(pct));
        }
      }, 250);
    }
  };

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="editor-fullscreen" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '0', background: '#050505', color: '#f5f5f5' }}>
      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid #262626', background: '#111111', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button onClick={onCloseProject} style={{ background: '#050505', border: '1px solid #333333', borderRadius: '8px', color: '#f5f5f5', cursor: 'pointer', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div style={{ width: '1px', height: '28px', background: '#333333' }} />
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>{project?.name || 'Loading...'}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              <Clock size={10} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>{formatTime(duration)} · 1080p · {isPro ? 'Pro' : 'Free'}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Auto-save indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600,
            color: savedStatus === 'saved' ? '#ffffff' : savedStatus === 'saving' ? '#d4d4d4' : '#ef4444' }}>
            {savedStatus === 'saved' && <Check size={11} />}
            {savedStatus === 'saving' && <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />}
            {savedStatus === 'error' && <AlertCircle size={11} />}
            {savedStatus === 'saved' ? 'Saved' : savedStatus === 'saving' ? 'Saving...' : 'Error'}
          </div>

          <button onClick={handleGenerateCaptions} 
            style={{ background: '#050505', border: '1px solid #333333', borderRadius: '8px', color: '#f5f5f5', cursor: 'pointer', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}
            disabled={loadingCaptions}
          >
            <Type size={13} />
            {loadingCaptions ? 'Generating...' : 'AI Captions'}
          </button>

          {!isPro && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#050505', border: '1px solid #333333', borderRadius: '8px', padding: '5px 10px', fontSize: '11px', fontWeight: 700, color: '#d4d4d4' }}>
              <Lock size={10} /> FREE PLAN
            </div>
          )}

          <button onClick={() => { setShowExportModal(true); setExportDone(false); setExportProgress(0); setIsExporting(false); }}
            style={{ background: '#ffffff', border: 'none', borderRadius: '10px', color: '#050505', cursor: 'pointer', padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 800, boxShadow: 'none' }}
          >
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {/* Main workspace panels */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 300px', minHeight: 0, overflow: 'hidden' }}>
        {/* Editor Screen & Canvas */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: '1px solid #262626' }}>
          {/* Canvas Wrapper */}
          <div 
            style={{ 
              flex: 1, 
              background: '#000000', 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              position: 'relative',
              minHeight: 0
            }}
          >
            {/* Real HTML5 Canvas preview */}
            <canvas 
              ref={canvasRef} 
              width={1280} 
              height={720} 
              onClick={handleCanvasClick}
              onWheel={handleCanvasWheel}
              style={{ 
                maxWidth: '100%', 
                maxHeight: '100%', 
                aspectRatio: '16/9', 
                display: 'block', 
                objectFit: 'contain',
                cursor: settings.follow_cursor === false ? 'crosshair' : 'zoom-in'
              }}
            />
            {/* Hidden HTML5 video source */}
            <video 
              ref={videoRef} 
              src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4" 
              style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }}
              playsInline
            />

            {/* Playback overlay controls */}
            {!isPlaying && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)' }}>
                <button 
                  onClick={handlePlayToggle}
                  style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '2px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', color: '#fff' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                >
                  <Play size={22} fill="#fff" style={{ marginLeft: '3px' }} />
                </button>
              </div>
            )}

            {/* Time display overlay */}
            <div style={{ position: 'absolute', top: '14px', left: '14px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', borderRadius: '8px', padding: '4px 10px', fontSize: '12px', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>

            {/* Scene marker pills */}
            {smartZoomActive && sceneEvents.map((ev, i) => (
              <div key={i} style={{ position: 'absolute', top: '14px', left: `${(ev.timestamp / duration) * 100}%`, transform: 'translateX(-50%)', background: 'rgba(37,99,235,0.88)', borderRadius: '6px', padding: '2px 8px', fontSize: '10px', fontWeight: 700, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {ev.zoom}x
              </div>
            ))}
          </div>

          {/* Enhanced Timeline Panel */}
          <div style={{ background: 'rgba(0,0,0,0.3)', borderTop: '1px solid var(--border-color)', padding: '0', flexShrink: 0 }}>
            {/* Transport Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <button onClick={() => { if(videoRef.current) videoRef.current.currentTime = 0; setCurrentTime(0); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}>
                <SkipBack size={16} />
              </button>

              <button onClick={handlePlayToggle}
                style={{ background: '#ffffff', border: 'none', borderRadius: '10px', color: '#050505', cursor: 'pointer', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: 'none' }}>
                {isPlaying ? <Pause size={14} fill="#050505" /> : <Play size={14} fill="#050505" style={{ marginLeft: '1px' }} />}
              </button>

              <button onClick={() => { if(videoRef.current) videoRef.current.currentTime = Math.min(duration, currentTime + 10); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}>
                <SkipForward size={16} />
              </button>

              {/* Scrub bar */}
              <div 
                ref={timelineRef}
                style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', position: 'relative', cursor: 'pointer' }}
                onClick={seekToTimelineEvent}
              >
                {/* Progress fill */}
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${(currentTime / duration) * 100}%`, background: '#ffffff', borderRadius: '3px' }} />
                {/* Playhead */}
                <div style={{ position: 'absolute', left: `${(currentTime / duration) * 100}%`, top: '-5px', width: '16px', height: '16px', borderRadius: '50%', background: '#050505', border: '3px solid #ffffff', transform: 'translateX(-50%)', boxShadow: '0 2px 8px rgba(0,0,0,0.4)', cursor: 'grab' }} />
              </div>

              {/* Volume */}
              <button onClick={() => {
                setIsMuted((prevMuted) => {
                  const nextMuted = !prevMuted;
                  if (videoRef.current) videoRef.current.muted = nextMuted;
                  return nextMuted;
                });
              }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '4px' }}>
                {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>

              {/* Timeline zoom */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={() => setTimelineZoom(z => Math.max(0.5, z - 0.25))}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ZoomOut size={11} />
                </button>
                <button onClick={() => setTimelineZoom(z => Math.min(4, z + 0.25))}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ZoomIn size={11} />
                </button>
              </div>
            </div>

            {/* Visual Timeline Tracks */}
            <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: '6px', overflowX: 'auto' }}>
              {selectedClipId && (
                <div style={{ marginLeft: '88px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1', fontSize: '11px' }}>
                  {(() => {
                    const selectedClip = getClipById(selectedClipId);
                    if (!selectedClip) return null;
                    const start = selectedClip.start * duration;
                    const end = selectedClip.end * duration;
                    return (
                      <>
                        <strong style={{ color: selectedClip.color }}>{selectedClip.label}</strong>
                        <span>Start</span>
                        <input
                          type="number"
                          min="0"
                          max={duration}
                          step="0.1"
                          value={start.toFixed(1)}
                          onChange={(event) => {
                            const nextStart = Math.max(0, Math.min(parseFloat(event.target.value) || 0, end - 0.15));
                            saveTimelineClips(timelineClips.map((clip) => clip.id === selectedClip.id ? { ...clip, start: nextStart / duration, enabled: true } : clip));
                          }}
                          style={{ width: '58px', background: '#0f1322', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', padding: '4px 6px', fontSize: '11px' }}
                        />
                        <span>End</span>
                        <input
                          type="number"
                          min="0"
                          max={duration}
                          step="0.1"
                          value={end.toFixed(1)}
                          onChange={(event) => {
                            const nextEnd = Math.min(duration, Math.max(parseFloat(event.target.value) || duration, start + 0.15));
                            saveTimelineClips(timelineClips.map((clip) => clip.id === selectedClip.id ? { ...clip, end: nextEnd / duration, enabled: true } : clip));
                          }}
                          style={{ width: '58px', background: '#0f1322', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', padding: '4px 6px', fontSize: '11px' }}
                        />
                        <button
                          onClick={() => {
                            if (videoRef.current) videoRef.current.currentTime = start;
                            setCurrentTime(start);
                            animationRef.current = requestAnimationFrame(renderPreview);
                          }}
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', padding: '4px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}
                        >
                          Jump
                        </button>
                      </>
                    );
                  })()}
                </div>
              )}
              {/* Timecode ruler */}
              <div style={{ display: 'flex', gap: '0', position: 'relative', height: '18px', marginLeft: '80px' }}>
                {Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => i).filter(i => i % 5 === 0).map(sec => (
                  <div key={sec} style={{ position: 'absolute', left: `${(sec / duration) * 100 * timelineZoom}%`, fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', alignItems: 'center', userSelect: 'none' }}>
                    <div style={{ height: '6px', width: '1px', background: 'rgba(255,255,255,0.15)', marginBottom: '2px' }} />
                    {formatTime(sec)}
                  </div>
                ))}
              </div>

              {timelineClips.map(clip => (
                <div key={clip.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Track label */}
                  <div style={{ width: '80px', flexShrink: 0, fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textAlign: 'right', paddingRight: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {clip.label.split(' ')[0]}
                  </div>

                  {/* Track lane */}
                  <div
                    style={{ flex: 1, height: '32px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden', minWidth: `${100 * timelineZoom}%`, cursor: 'pointer' }}
                    onClick={seekToTimelineEvent}
                  >
                    {/* Clip block */}
                    <div style={{
                      position: 'absolute',
                      left: `${clip.start * 100}%`,
                      width: `${(clip.end - clip.start) * 100}%`,
                      height: '100%',
                      background: `${clip.color}33`,
                      border: selectedClipId === clip.id ? `2px solid ${clip.color}` : `1px solid ${clip.color}66`,
                      opacity: clip.enabled === false ? 0.35 : 1,
                      borderRadius: '5px',
                      display: 'flex', alignItems: 'center', padding: '0 8px',
                      cursor: timelineDrag?.id === clip.id ? 'grabbing' : 'grab', transition: 'opacity 0.2s, border 0.2s'
                    }}
                    onMouseDown={(event) => startClipDrag(event, clip, 'move')}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedClipId(clip.id);
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                      <div
                        onMouseDown={(event) => startClipDrag(event, clip, 'trim-start')}
                        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '8px', cursor: 'ew-resize', background: 'rgba(255,255,255,0.18)' }}
                      />
                      <span style={{ fontSize: '9px', fontWeight: 700, color: clip.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clip.label}</span>
                      <div
                        onMouseDown={(event) => startClipDrag(event, clip, 'trim-end')}
                        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '8px', cursor: 'ew-resize', background: 'rgba(255,255,255,0.18)' }}
                      />
                    </div>

                    {/* Playhead line overlay */}
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${(currentTime / duration) * 100}%`, width: '2px', background: '#ffffff', opacity: 0.9, pointerEvents: 'none' }} />

                    {/* Silence markers */}
                    {clip.id === 'screen' && silencePeriods.map((p, i) => (
                      <div key={i} style={{ position: 'absolute', left: `${(p.start / duration) * 100}%`, width: `${((p.end - p.start) / duration) * 100}%`, height: '100%', background: 'rgba(239,68,68,0.25)', borderRadius: '3px', border: '1px solid rgba(239,68,68,0.4)' }} />
                    ))}

                    {/* Scene zoom event markers */}
                    {clip.id === 'screen' && sceneEvents.map((ev, i) => (
                      <div key={i} style={{ position: 'absolute', top: '2px', left: `${(ev.timestamp / duration) * 100}%`, transform: 'translateX(-50%)', width: '8px', height: '8px', borderRadius: '50%', background: '#ffffff', border: '2px solid rgba(0,0,0,0.5)', cursor: 'pointer', zIndex: 2 }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar panel */}
        <div className="editor-inspector" style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* Compact icon-tab bar */}
          <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '10px 12px 0', overflowX: 'auto', background: 'rgba(10,13,24,0.36)' }}>
            {[
              { id: 'zoom', icon: ZoomIn, label: 'Zoom' },
              { id: 'bg', icon: Image, label: 'Background' },
              { id: 'cursor', icon: MousePointer, label: 'Cursor' },
              { id: 'brand', icon: Layers, label: 'Brand' },
              { id: 'captions', icon: Type, label: 'Captions' },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setSidebarTab(tab.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                    padding: '8px 12px 10px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: sidebarTab === tab.id ? '#ffffff' : '#a5aec6',
                    borderBottom: sidebarTab === tab.id ? '2px solid #ffffff' : '2px solid transparent',
                    fontSize: '10px', fontWeight: 600, transition: 'all 0.15s', flexShrink: 0
                  }}>
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {sidebarTab !== 'captions' ? (
            <>
          {sidebarTab === 'zoom' && (
            <>
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '9px' }}>
              <Sparkles size={14} /> Zoom
            </h3>
            <span style={{ fontSize: '12px', color: '#d7dcf0', fontWeight: 700 }}>Scale ({settings.zoom_level || 1}x)</span>
            <input 
              type="range" 
              min="1.0" 
              max="3.0" 
              step="0.1" 
              value={settings.zoom_level || 1} 
              onChange={(e) => handleSaveSettings({ zoom_level: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: '#ffffff' }}
            />
            <div style={{ display: 'flex', gap: '6px' }}>
              {[1, 1.5, 2, 3].map(val => (
                <button
                  key={val}
                  onClick={() => handleSaveSettings({ zoom_level: val })}
                  style={{
                    flex: 1,
                    padding: '9px 6px',
                    borderRadius: '9px',
                    border: settings.zoom_level === val ? '1px solid #ffffff' : '1px solid rgba(255,255,255,0.12)',
                    background: settings.zoom_level === val ? '#ffffff' : '#111111',
                    color: settings.zoom_level === val ? '#050505' : '#f5f5f5',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {val}x
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '6px', background: '#0a0a0a', border: '1px solid #333333', borderRadius: '12px', padding: '4px' }}>
              <button
                onClick={() => handleSaveSettings({ follow_cursor: true })}
                style={{
                  flex: 1,
                  padding: '10px 6px',
                  borderRadius: '9px',
                  border: 'none',
                  background: settings.follow_cursor !== false ? '#ffffff' : 'transparent',
                  color: settings.follow_cursor !== false ? '#050505' : '#d4d4d4',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Follow Cursor
              </button>
              <button
                onClick={() => handleSaveSettings({ follow_cursor: false })}
                style={{
                  flex: 1,
                  padding: '10px 6px',
                  borderRadius: '9px',
                  border: 'none',
                  background: settings.follow_cursor === false ? '#ffffff' : 'transparent',
                  color: settings.follow_cursor === false ? '#050505' : '#d4d4d4',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Click Zoom
              </button>
            </div>
            <span style={{ fontSize: '12px', color: '#d7dcf0', fontWeight: 700 }}>Smoothness ({Math.round((settings.zoom_smoothing !== undefined ? settings.zoom_smoothing : 0.08) * 100)}%)</span>
            <input
              type="range"
              min="0.03"
              max="0.22"
              step="0.01"
              value={settings.zoom_smoothing !== undefined ? settings.zoom_smoothing : 0.08}
              onChange={(e) => handleSaveSettings({ zoom_smoothing: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: '#ffffff' }}
            />
          </div>

          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Scissors size={14} /> Silence Cutter
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Sensitivity ({silenceSensitivity} dB)</span>
            <input 
              type="range" 
              min="-60" 
              max="-20" 
              step="1" 
              value={silenceSensitivity} 
              onChange={(e) => setSilenceSensitivity(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: '#ffffff' }}
            />
            <button 
              onClick={handleDetectSilence} 
              className="btn-secondary" 
              style={{ width: '100%', fontSize: '13px', padding: '8px', marginTop: '4px' }}
              disabled={detectingSilence}
            >
              {detectingSilence ? 'Analyzing audio...' : 'Scan Silence'}
            </button>
            {silencePeriods.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={autoCutSilence} 
                  onChange={(e) => applySilenceCutToTimeline(e.target.checked)} 
                />
                Remove detected silence
              </label>
            )}
          </div>
            </>
          )}

          {/* Background Settings */}
          <div className="glass-card" style={{ display: sidebarTab === 'bg' ? 'flex' : 'none', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '9px' }}>
              <Image size={14} /> Canvas Background
            </h3>
            <select 
              value={settings.background_type || 'gradient'} 
              onChange={(e) => handleSaveSettings({ background_type: e.target.value })}
              className="input-control"
            >
              <option style={{ background: '#252a42', color: '#fff' }} value="gradient">Gradient Background</option>
              <option style={{ background: '#252a42', color: '#fff' }} value="solid">Solid Color</option>
              <option style={{ background: '#252a42', color: '#fff' }} value="blur">Video Blur Backdrop</option>
              <option style={{ background: '#252a42', color: '#fff' }} value="image">Custom Uploaded Image</option>
            </select>

            {settings.background_type === 'solid' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Solid Color</span>
                <input 
                  type="color" 
                  value={settings.background_value || '#1e1e2e'} 
                  onChange={(e) => handleSaveSettings({ background_value: e.target.value })}
                  style={{ width: '100%', height: '36px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'transparent', cursor: 'pointer' }}
                />
              </div>
            )}

            {settings.background_type === 'gradient' && (
              <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#d7dcf0', fontWeight: 700 }}>Start Color</span>
                  <input 
                    type="color" 
                    value={settings.background_value_start || '#ffffff'} 
                    onChange={(e) => handleSaveSettings({ background_value_start: e.target.value })}
                    style={{ width: '100%', height: '44px', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '10px', background: 'rgba(16,20,36,0.54)', cursor: 'pointer', padding: '4px' }}
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#d7dcf0', fontWeight: 700 }}>End Color</span>
                  <input 
                    type="color" 
                    value={settings.background_value_end || '#111111'} 
                    onChange={(e) => handleSaveSettings({ background_value_end: e.target.value })}
                    style={{ width: '100%', height: '44px', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '10px', background: 'rgba(16,20,36,0.54)', cursor: 'pointer', padding: '4px' }}
                  />
                </div>
              </div>
            )}

            {settings.background_type === 'image' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Upload Background</span>
                <button 
                  onClick={async () => {
                    if (window.electron && window.electron.selectFile) {
                      const file = await window.electron.selectFile([{ name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'webp'] }]);
                      if (file) handleSaveSettings({ background_value: file });
                    } else {
                      alert("Web Preview: Image uploaded successfully.");
                    }
                  }} 
                  className="btn-secondary" 
                  style={{ width: '100%', fontSize: '12px', padding: '8px' }}
                >
                  Choose Custom Wallpaper
                </button>
              </div>
            )}
          </div>

          {/* Cursor Settings */}
          <div className="glass-card" style={{ display: sidebarTab === 'cursor' ? 'flex' : 'none', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MousePointer size={14} /> Cursor Highlight
            </h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.cursor_visible !== false}
                onChange={(e) => handleSaveSettings({ cursor_visible: e.target.checked })}
              />
              Show cursor in preview/export
            </label>

            <select
              value={settings.cursor_style || 'arrow'}
              onChange={(e) => handleSaveSettings({ cursor_style: e.target.value })}
              className="input-control"
            >
              <option value="arrow">White Arrow Pointer</option>
              <option value="dot">Colored Dot Pointer</option>
              <option value="ring">Minimal Ring Pointer</option>
            </select>

            <select 
              value={settings.cursor_highlight || 'ripple'} 
              onChange={(e) => handleSaveSettings({ cursor_highlight: e.target.value })}
              className="input-control"
            >
              <option value="none">None</option>
              <option value="ripple">Click Ripple</option>
              <option value="glow">Cursor Glow</option>
              <option value="both">Glow & Ripple</option>
            </select>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Highlight Color</span>
              <input 
                type="color" 
                value={settings.cursor_color || '#ff4500'} 
                onChange={(e) => handleSaveSettings({ cursor_color: e.target.value })}
                style={{ width: '100%', height: '36px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'transparent', cursor: 'pointer' }}
              />
            </div>

            <div style={{ display: 'none', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Pointer/Glow Size ({settings.cursor_size || 40}px)</span>
              <input 
                type="range" 
                min="10" 
                max="80" 
                step="1" 
                value={settings.cursor_size || 40} 
                onChange={(e) => handleSaveSettings({ cursor_size: parseInt(e.target.value) })}
                style={{ width: '100%', accentColor: '#ffffff' }}
              />
            </div>

            <div style={{ display: 'none', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Pointer Scale ({Math.round((settings.cursor_scale || 1) * 100)}%)</span>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.05"
                value={settings.cursor_scale || 1}
                onChange={(e) => handleSaveSettings({ cursor_scale: parseFloat(e.target.value) })}
                style={{ width: '100%', accentColor: '#ffffff' }}
              />
            </div>

            <div style={{ display: 'none', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Glow Opacity ({Math.round((settings.cursor_opacity !== undefined ? settings.cursor_opacity : 0.8) * 100)}%)</span>
              <input 
                type="range" 
                min="0.1" 
                max="1.0" 
                step="0.05" 
                value={settings.cursor_opacity !== undefined ? settings.cursor_opacity : 0.8} 
                onChange={(e) => handleSaveSettings({ cursor_opacity: parseFloat(e.target.value) })}
                style={{ width: '100%', accentColor: '#ffffff' }}
              />
            </div>

            <label style={{ display: 'none', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.auto_smooth_cursor !== false}
                onChange={(e) => handleSaveSettings({ auto_smooth_cursor: e.target.checked })}
              />
              Smooth cursor movement
            </label>

            {settings.auto_smooth_cursor !== false && (
              <div style={{ display: 'none', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Cursor Smoothness ({Math.round((settings.cursor_smoothing !== undefined ? settings.cursor_smoothing : 0.18) * 100)}%)</span>
                <input
                  type="range"
                  min="0.05"
                  max="0.45"
                  step="0.01"
                  value={settings.cursor_smoothing !== undefined ? settings.cursor_smoothing : 0.18}
                  onChange={(e) => handleSaveSettings({ cursor_smoothing: parseFloat(e.target.value) })}
                  style={{ width: '100%', accentColor: '#ffffff' }}
                />
              </div>
            )}

            <label style={{ display: 'none', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.cursor_auto_hide !== false}
                onChange={(e) => handleSaveSettings({ cursor_auto_hide: e.target.checked })}
              />
              Auto-hide cursor when idle
            </label>

            {settings.cursor_auto_hide !== false && (
              <div style={{ display: 'none', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Idle Hide Delay ({(settings.cursor_idle_hide_delay !== undefined ? settings.cursor_idle_hide_delay : 1.2).toFixed(1)}s)</span>
                <input
                  type="range"
                  min="0.4"
                  max="3"
                  step="0.1"
                  value={settings.cursor_idle_hide_delay !== undefined ? settings.cursor_idle_hide_delay : 1.2}
                  onChange={(e) => handleSaveSettings({ cursor_idle_hide_delay: parseFloat(e.target.value) })}
                  style={{ width: '100%', accentColor: '#ffffff' }}
                />
              </div>
            )}

            <label style={{ display: 'none', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!settings.cursor_loop_to_start}
                onChange={(e) => handleSaveSettings({ cursor_loop_to_start: e.target.checked })}
              />
              Loop cursor back to start
            </label>
          </div>

          {/* Webcam settings card */}
          <div className="glass-card" style={{ display: 'none', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Camera size={14} /> Webcam Overlay</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 'normal', fontSize: '12px' }}>
                <input 
                  type="checkbox" 
                  checked={!!settings.webcam_enabled} 
                  onChange={(e) => {
                    handleSaveSettings({ webcam_enabled: e.target.checked });
                    toggleTimelineLayer('webcam', e.target.checked);
                  }}
                  style={{ accentColor: '#ffffff' }}
                />
                Show
              </label>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Label</span>
              <input
                type="text"
                value={settings.webcam_label || 'Camera'}
                onChange={(e) => handleSaveSettings({ webcam_label: e.target.value })}
                className="input-control"
                placeholder="Camera"
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Position Alignment</span>
              <select 
                value={settings.webcam_position || 'bottom-right'} 
                onChange={(e) => handleSaveSettings({ webcam_position: e.target.value })}
                className="input-control"
              >
                <option value="top-left">Top Left</option>
                <option value="top-right">Top Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="bottom-right">Bottom Right</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Overlay Size ({Math.round((settings.webcam_size || 0.2) * 100)}%)</span>
              <input 
                type="range" 
                min="0.14" 
                max="0.36" 
                step="0.02" 
                value={settings.webcam_size || 0.22} 
                onChange={(e) => handleSaveSettings({ webcam_size: parseFloat(e.target.value) })}
                style={{ width: '100%', accentColor: '#ffffff' }}
              />
            </div>
          </div>

          {/* Motion Blur settings card */}
          <div className="glass-card" style={{ display: 'none', flexDirection: 'column', gap: '12px', order: -1 }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Film size={14} /> Camera Motion Blur
            </h3>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={settings.motion_blur !== 0} 
                onChange={(e) => handleSaveSettings({ motion_blur: e.target.checked ? 1 : 0 })} 
              />
              Enable Zoom Motion Blur
            </label>

            {settings.motion_blur !== 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Blur Intensity ({Math.round((settings.motion_blur_intensity !== undefined ? settings.motion_blur_intensity : 0.5) * 100)}%)</span>
                <input 
                  type="range" 
                  min="0.1" 
                  max="1.0" 
                  step="0.05" 
                  value={settings.motion_blur_intensity !== undefined ? settings.motion_blur_intensity : 0.5} 
                  onChange={(e) => handleSaveSettings({ motion_blur_intensity: parseFloat(e.target.value) })}
                  style={{ width: '100%', accentColor: '#ffffff' }}
                />
              </div>
            )}
          </div>

          {/* Silence Cutter settings card */}
          <div className="glass-card" style={{ display: 'none', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Scissors size={14} /> Smart Silence Cutter
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Sensitivity ({silenceSensitivity} dB)</span>
              <input 
                type="range" 
                min="-60" 
                max="-20" 
                step="1" 
                value={silenceSensitivity} 
                onChange={(e) => setSilenceSensitivity(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: '#ffffff' }}
              />
            </div>

            <button 
              onClick={handleDetectSilence} 
              className="btn-secondary" 
              style={{ width: '100%', fontSize: '13px', padding: '8px', marginTop: '4px' }}
              disabled={detectingSilence}
            >
              {detectingSilence ? 'Analyzing audio...' : 'Scan for silent pauses'}
            </button>

            {silencePeriods.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 500 }}>
                  ✓ {silencePeriods.length} silent gaps detected!
                </span>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={autoCutSilence} 
                    onChange={(e) => applySilenceCutToTimeline(e.target.checked)} 
                  />
                  Auto-cut silence and update timeline
                </label>
              </div>
            )}
          </div>

          {/* Branding Settings Card */}
          <div className="glass-card" style={{ display: sidebarTab === 'brand' ? 'flex' : 'none', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={14} /> Brand Styling & Overlays
            </h3>

            <button
              onClick={applyBrandKitToProject}
              style={{ background: '#ffffff', border: 'none', borderRadius: '12px', color: '#050505', padding: '11px 12px', fontWeight: 900, cursor: 'pointer' }}
            >
              Apply Saved Brand Kit
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Primary Color</span>
                <input type="color" value={settings.brand_primary_color || '#ffffff'} onChange={(e) => handleSaveSettings({ brand_primary_color: e.target.value })} style={{ width: '100%', height: '42px', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '10px', background: 'rgba(16,20,36,0.54)', cursor: 'pointer', padding: '4px' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Accent Color</span>
                <input type="color" value={settings.brand_secondary_color || '#737373'} onChange={(e) => handleSaveSettings({ brand_secondary_color: e.target.value })} style={{ width: '100%', height: '42px', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '10px', background: 'rgba(16,20,36,0.54)', cursor: 'pointer', padding: '4px' }} />
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Company Name</span>
              <input
                type="text"
                value={settings.brand_name || 'SCREENFLOW AI'}
                onChange={(e) => handleSaveSettings({ brand_name: e.target.value })}
                className="input-control"
                style={{ fontSize: '12px', padding: '8px 10px' }}
              />
            </div>

            {/* Watermark/Logo toggles */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={!!settings.watermark_enabled} 
                  onChange={(e) => handleSaveSettings({ watermark_enabled: e.target.checked })} 
                />
                Show watermark
              </label>

              {settings.watermark_enabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Watermark Text</span>
                    <input
                      type="text"
                      value={settings.watermark_text || settings.brand_name || 'SCREENFLOW AI'}
                      onChange={(e) => handleSaveSettings({ watermark_text: e.target.value })}
                      className="input-control"
                      style={{ fontSize: '12px', padding: '8px 10px' }}
                    />
                  </div>

                  <button
                    onClick={async () => {
                      const file = await window.electron?.selectFile?.([{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]);
                      if (file) handleSaveSettings({ brand_logo: file });
                    }}
                    style={{ background: 'rgba(16,20,36,0.54)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: '#fff', padding: '9px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: 800 }}
                  >
                    {settings.brand_logo ? 'Replace Logo File' : 'Choose Logo File'}
                  </button>

                  {settings.brand_logo && (
                    <div style={{ color: '#cbd5e1', fontSize: '10px', lineHeight: 1.4, wordBreak: 'break-all' }}>
                      Logo selected: {settings.brand_logo.split(/[\\/]/).pop()}
                    </div>
                  )}

                  <select
                    value={settings.watermark_position || 'top-right'}
                    onChange={(e) => handleSaveSettings({ watermark_position: e.target.value })}
                    className="input-control"
                  >
                    <option value="top-left">Top Left</option>
                    <option value="top-right">Top Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="bottom-right">Bottom Right</option>
                  </select>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Logo/Text Size ({Math.round((settings.watermark_scale || 0.1) * 100)}%)</span>
                    <input
                      type="range"
                      min="0.07"
                      max="0.22"
                      step="0.01"
                      value={settings.watermark_scale || 0.1}
                      onChange={(e) => handleSaveSettings({ watermark_scale: parseFloat(e.target.value) })}
                      style={{ width: '100%', accentColor: '#ffffff' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Opacity ({Math.round((settings.watermark_opacity ?? 0.7) * 100)}%)</span>
                    <input
                      type="range"
                      min="0.15"
                      max="1"
                      step="0.05"
                      value={settings.watermark_opacity ?? 0.7}
                      onChange={(e) => handleSaveSettings({ watermark_opacity: parseFloat(e.target.value) })}
                      style={{ width: '100%', accentColor: '#ffffff' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Lower Thirds toggles */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'none', flexDirection: 'column', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={!!settings.lower_third_enabled} 
                  onChange={(e) => handleSaveSettings({ lower_third_enabled: e.target.checked })} 
                />
                Enable Lower Third Overlay
              </label>

              {settings.lower_third_enabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Speaker Name</span>
                    <input 
                      type="text" 
                      value={settings.brand_author || 'John Doe'} 
                      onChange={(e) => handleSaveSettings({ brand_author: e.target.value })}
                      className="input-control"
                      style={{ fontSize: '12px', padding: '6px 10px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Speaker Title</span>
                    <input 
                      type="text" 
                      value={settings.brand_title || 'SaaS Founder'} 
                      onChange={(e) => handleSaveSettings({ brand_title: e.target.value })}
                      className="input-control"
                      style={{ fontSize: '12px', padding: '6px 10px' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Intro / Outro toggles */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'none', flexDirection: 'column', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={!!settings.intro_enabled} 
                  onChange={(e) => handleSaveSettings({ intro_enabled: e.target.checked })} 
                />
                Enable Brand Intro Overlay
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={!!settings.outro_enabled} 
                  onChange={(e) => handleSaveSettings({ outro_enabled: e.target.checked })} 
                />
                Enable Outro Card
              </label>
              {settings.outro_enabled && (
                <input
                  type="text"
                  value={settings.outro_text || 'Thanks for Watching'}
                  onChange={(e) => handleSaveSettings({ outro_text: e.target.value })}
                  className="input-control"
                  style={{ fontSize: '12px', padding: '8px 10px' }}
                />
              )}
            </div>
          </div>
          </>
          ) : (
            /* AI Captions Tab */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Caption Style Picker */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Caption Templates</h3>
                <select 
                  value={settings.caption_style || 'tiktok'} 
                  onChange={(e) => handleSaveSettings({ caption_style: e.target.value })}
                  className="input-control"
                >
                  <option value="tiktok">TikTok Style (Yellow Outline)</option>
                  <option value="youtube">YouTube Style (White with Dark Box)</option>
                  <option value="instagram">Instagram Style (Violet Gradient)</option>
                  <option value="professional">Professional Style (Clean Subtitle)</option>
                </select>
              </div>

              {/* Caption transcript editor */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Edit Transcript</h3>
                {captions.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                    {captionError || 'No captions generated yet. Click "AI Captions" at the top to transcribe your recording.'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                    {captions.map((cap, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                        <span style={{ fontSize: '10px', color: '#ffffff', fontWeight: 600 }}>
                          [{cap.start_time.toFixed(1)}s - {cap.end_time.toFixed(1)}s]
                        </span>
                        <input 
                          type="text" 
                          value={cap.text} 
                          onChange={(e) => {
                            const newCaps = [...captions];
                            newCaps[i].text = e.target.value;
                            setCaptions(newCaps);
                            if (window.electron && window.electron.saveCaptions) {
                              window.electron.saveCaptions(projectId, newCaps);
                            }
                          }}
                          className="input-control"
                          style={{ fontSize: '12px', padding: '6px 10px' }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Export Modal overlay */}
      {showExportModal && (
        <div 
          style={{ 
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.85)', 
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999
          }}
          onClick={e => { if (e.target === e.currentTarget && !isExporting) setShowExportModal(false); }}
        >
          <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '24px', padding: '32px', width: '460px', display: 'flex', flexDirection: 'column', gap: '24px', boxShadow: '0 40px 80px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 800 }}>Export Video</h3>
              {!isExporting && <button onClick={() => setShowExportModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '22px', lineHeight: 1 }}>×</button>}
            </div>

            {exportError ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
                <div style={{ color: '#f87171', fontSize: '14px', fontWeight: 800 }}>Export failed</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.5, maxHeight: '120px', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                  {exportError}
                </div>
                <button onClick={() => { setExportError(''); setExportProgress(0); }} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', padding: '12px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
                  Try Again
                </button>
              </div>
            ) : exportDone ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '16px 0', textAlign: 'center' }}>
                <div style={{ background: 'rgba(0,196,140,0.12)', color: '#00C48C', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={28} />
                </div>
                <div>
                  <h4 style={{ fontSize: '18px', fontWeight: 800 }}>Export Complete!</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Your video was saved to Desktop.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '4px' }}>
                  <button onClick={() => setShowExportModal(false)} style={{ flex: 1, background: 'rgba(0,196,140,0.1)', border: '1px solid rgba(0,196,140,0.2)', borderRadius: '12px', color: '#00C48C', padding: '12px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>Close</button>
                  <button onClick={() => { setExportDone(false); setExportProgress(0); }} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', padding: '12px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>Export Again</button>
                </div>
              </div>
            ) : isExporting ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.18)', borderTop: '3px solid #ffffff', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700 }}>Encoding your video...</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {exportProgress < 30 ? 'Preparing frames...' : exportProgress < 60 ? 'Encoding video tracks...' : exportProgress < 85 ? 'Applying overlays...' : 'Finalizing...'}
                    </div>
                  </div>
                </div>
                <div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${exportProgress}%`, background: '#ffffff', transition: 'width 0.4s ease', borderRadius: '4px' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                    <span>{Math.round(exportProgress)}% complete</span>
                    <span>{isPro ? '⚡ Multi-threaded' : 'Single-threaded'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Format</span>
                    <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} className="input-control" style={{ fontSize: '13px', padding: '10px 12px' }}>
                      <option value="mp4">MP4 (H.264)</option>
                      <option value="webm">WebM (VP9)</option>
                      <option value="mov">QuickTime MOV</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Quality</span>
                    <select value={exportQuality} onChange={(e) => setExportQuality(e.target.value)} className="input-control" style={{ fontSize: '13px', padding: '10px 12px' }}>
                      <option value="low">Low (Fast)</option>
                      <option value="medium">Medium</option>
                      <option value="high">High (Recommended)</option>
                      <option value="ultra">Ultra 4K</option>
                    </select>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { label: 'Resolution', value: '1920 × 1080' },
                    { label: 'Duration', value: formatTime(duration) },
                    { label: 'Est. File Size', value: exportQuality === 'ultra' ? '~800 MB' : exportQuality === 'high' ? '~280 MB' : '~90 MB' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                      <span style={{ fontWeight: 700 }}>{item.value}</span>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: '11px', color: isPro ? '#00C48C' : '#f87171', fontWeight: 700, padding: '8px 12px', background: isPro ? 'rgba(0,196,140,0.06)' : 'rgba(239,68,68,0.06)', borderRadius: '8px', border: `1px solid ${isPro ? 'rgba(0,196,140,0.15)' : 'rgba(239,68,68,0.15)'}` }}>
                  {isPro ? '⚡ Priority export — all CPU cores active' : '⚠️ Free plan: throttled speed · Watermark applied'}
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={handleExport} style={{ flex: 1, background: '#ffffff', border: 'none', borderRadius: '12px', color: '#050505', padding: '14px', fontWeight: 800, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: 'none' }}>
                    <Download size={16} /> Start Export
                  </button>
                  <button onClick={() => setShowExportModal(false)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-secondary)', padding: '14px 20px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}




