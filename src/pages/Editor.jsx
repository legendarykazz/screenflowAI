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

  // Timeline clips state
  const [timelineClips, setTimelineClips] = useState([
    { id: 'screen', label: 'Screen Recording', start: 0, end: 0.85, color: '#667eea', track: 0 },
    { id: 'audio', label: 'Microphone Audio', start: 0, end: 0.85, color: '#00C48C', track: 1 },
    { id: 'webcam', label: 'Webcam Overlay', start: 0.05, end: 0.80, color: '#FF4D7E', track: 2 },
  ]);

  // Refs for real-time preview simulation
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const cursorEventsRef = useRef([]);
  const timelineRef = useRef(null);

  useEffect(() => {
    loadProjectData();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [projectId]);

  const loadProjectData = async () => {
    if (window.electron && window.electron.getProject) {
      const proj = await window.electron.getProject(projectId);
      setProject(proj);
      setSettings(proj.settings || {});
      if (proj?.duration) setDuration(proj.duration);
      
      const events = await window.electron.getCursorEvents(projectId);
      cursorEventsRef.current = events;

      const caps = await window.electron.getCaptions(projectId);
      setCaptions(caps);

      if (proj && proj.video_path && videoRef.current) {
        const path = proj.video_path;
        const previewVideo = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4';
        const source = path.startsWith('browser-preview-recording') || path === 'mock_screen.mp4'
          ? previewVideo
          : path.startsWith('http')
            ? path
            : `file:///${path.replace(/\\/g, '/')}`;
        videoRef.current.src = source;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current?.duration && isFinite(videoRef.current.duration)) {
            setDuration(videoRef.current.duration);
          }
        };
        // Always ensure render loop starts
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        animationRef.current = requestAnimationFrame(renderPreview);
        
        videoRef.current.onseeked = () => {
          if (!animationRef.current) animationRef.current = requestAnimationFrame(renderPreview);
        };
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

    const xs = events.map((event) => event.x);
    const ys = events.map((event) => event.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
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

  const drawCinematicCursor = (ctx, x, y, activeClick) => {
    if (settings.cursor_visible === false) return;

    const hSize = settings.cursor_size || 40;
    const hColor = settings.cursor_color || '#ff4500';
    const highlightMode = settings.cursor_highlight || 'ripple';

    if (highlightMode !== 'none') {
      ctx.save();
      ctx.globalAlpha = settings.cursor_opacity !== undefined ? settings.cursor_opacity : 0.8;

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

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 5;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    const cSize = (settings.cursor_size || 40) * (settings.cursor_scale || 1.0);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + cSize * 0.72, y + cSize * 0.7);
    ctx.lineTo(x + cSize * 0.26, y + cSize * 0.82);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
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
      grad.addColorStop(0, settings.background_value_start || '#6366f1');
      grad.addColorStop(1, settings.background_value_end || '#a855f7');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();

    // 2. Smooth cursor tracker and normalize it into the preview canvas.
    const events = cursorEventsRef.current;
    const cursorPoint = getCursorPointAtTime(events, timestamp, width, height, video);
    let currentX = cursorPoint.x;
    let currentY = cursorPoint.y;
    let activeClick = getActiveClick(events, timestamp, width, height, video);

    // 3. Zoom Easing Calculation
    let zoom = 1.0;
    let zoomX = width / 2;
    let zoomY = height / 2;

    // Check if we have active AI scene suggested zoom active
    let activeSceneZoom = null;
    if (smartZoomActive && sceneEvents.length > 0) {
      activeSceneZoom = sceneEvents.find(s => timestamp >= s.timestamp && timestamp < s.timestamp + 1.1);
    }

    if (activeSceneZoom) {
      const age = timestamp - activeSceneZoom.timestamp;
      const targetZoom = activeSceneZoom.zoom || settings.zoom_level || 1.5;
      if (age <= 0.3) {
        const t = age / 0.3;
        zoom = 1.0 + (targetZoom - 1.0) * easeInOutCubic(t);
      } else if (age <= 0.8) {
        zoom = targetZoom;
      } else if (age <= 1.1) {
        const t = (1.1 - age) / 0.3;
        zoom = 1.0 + (targetZoom - 1.0) * easeInOutCubic(t);
      }
      zoomX = currentX;
      zoomY = currentY;
    } else if (activeClick && settings.zoom_level > 1.0) {
      const age = timestamp - activeClick.timestamp;
      const inDuration = settings.zoom_in_duration || 0.35;
      const holdDuration = settings.zoom_hold_duration || 0.55;
      const outDuration = settings.zoom_out_duration || 0.35;
      if (age <= inDuration) {
        const t = age / inDuration;
        zoom = 1.0 + (settings.zoom_level - 1.0) * easeInOutCubic(t);
      } else if (age <= inDuration + holdDuration) {
        zoom = settings.zoom_level;
      } else if (age <= inDuration + holdDuration + outDuration) {
        const t = (inDuration + holdDuration + outDuration - age) / outDuration;
        zoom = 1.0 + (settings.zoom_level - 1.0) * easeInOutCubic(t);
      }
      zoomX = activeClick.x;
      zoomY = activeClick.y;
    }

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

    // Draw video frame inside rounded card
    const cardMargin = 40;
    const cardW = width - cardMargin * 2;
    const cardH = height - cardMargin * 2;
    const radius = 24;

    ctx.beginPath();
    ctx.moveTo(cardMargin + radius, cardMargin);
    ctx.lineTo(cardMargin + cardW - radius, cardMargin);
    ctx.quadraticCurveTo(cardMargin + cardW, cardMargin, cardMargin + cardW, cardMargin + radius);
    ctx.lineTo(cardMargin + cardW, cardMargin + cardH - radius);
    ctx.quadraticCurveTo(cardMargin + cardW, cardMargin + cardH, cardMargin + cardW - radius, cardMargin + cardH);
    ctx.lineTo(cardMargin + radius, cardMargin + cardH);
    ctx.quadraticCurveTo(cardMargin, cardMargin + cardH, cardMargin, cardMargin + cardH - radius);
    ctx.lineTo(cardMargin, cardMargin + radius);
    ctx.quadraticCurveTo(cardMargin, cardMargin, cardMargin + radius, cardMargin);
    ctx.closePath();
    ctx.clip();

    try {
      ctx.drawImage(video, 0, 0, width, height);
    } catch (e) {
      // Fallback if video isn't ready
      ctx.fillStyle = '#2d2d30';
      ctx.fillRect(0, 0, width, height);
    }

    drawCinematicCursor(ctx, currentX, currentY, activeClick);
    ctx.restore();

    // 5. Draw Webcam Overlay mockup
    const webcamPos = settings.webcam_position || 'bottom-right';
    const webcamScale = settings.webcam_size || 0.2; // 20% of width by default
    const webcamSize = width * webcamScale;
    const margin = 60;
    let camX = width - webcamSize - margin;
    let camY = height - webcamSize - margin;

    if (webcamPos === 'top-left') {
      camX = margin;
      camY = margin;
    } else if (webcamPos === 'top-right') {
      camX = width - webcamSize - margin;
      camY = margin;
    } else if (webcamPos === 'bottom-left') {
      camX = margin;
      camY = height - webcamSize - margin;
    }

    ctx.save();
    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 8;
    
    // Draw rounded container for webcam
    ctx.beginPath();
    ctx.arc(camX + webcamSize/2, camY + webcamSize/2, webcamSize/2, 0, Math.PI * 2);
    ctx.fillStyle = '#1e1e24';
    ctx.fill();
    ctx.strokeStyle = 'var(--accent-primary)';
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // Draw user avatar inside webcam circle
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.clip();
    
    ctx.fillStyle = '#4a4a5a';
    ctx.beginPath();
    ctx.arc(camX + webcamSize/2, camY + webcamSize * 0.45, webcamSize * 0.22, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(camX + webcamSize/2, camY + webcamSize * 1.1, webcamSize * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

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
        grad.addColorStop(1, '#a855f7'); // Violet
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
      
      // Draw watermark background card
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      
      const wWidth = 200;
      const wHeight = 44;
      const wX = width - wWidth - 60;
      const wY = 60;
      
      // Rounded card
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(wX, wY, wWidth, wHeight, 8) : ctx.rect(wX, wY, wWidth, wHeight);
      ctx.fill();
      ctx.stroke();
      
      // Logo placeholder text
      ctx.fillStyle = !isPro ? 'rgba(239, 68, 68, 0.9)' : 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 12px Inter';
      ctx.textAlign = 'center';
      
      const watermarkText = !isPro 
        ? 'SCREENFLOW AI (FREE TRIAL)' 
        : (settings.brand_name ? settings.brand_name.toUpperCase() : 'SCREENFLOW AI');

      ctx.fillText(watermarkText, wX + wWidth/2, wY + wHeight/2 + 5);
      ctx.restore();
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
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
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
      ctx.fillText(settings.brand_author || 'John Doe', slideX + 20, ltY + 32);

      ctx.fillStyle = 'var(--text-secondary)';
      ctx.font = '12px Inter';
      ctx.fillText(settings.brand_title || 'SaaS Founder / Speaker', slideX + 20, ltY + 54);
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
      ctx.fillText(settings.brand_name ? settings.brand_name.toUpperCase() : 'SCREENFLOW AI', 0, 10);
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
      ctx.fillText('THANKS FOR WATCHING', width/2, height/2 - 15);
      
      ctx.font = '16px Inter';
      ctx.fillStyle = `rgba(161,161,170,${opacity})`;
      ctx.fillText('Subscribe for more tutorials', width/2, height/2 + 20);
      ctx.restore();
    }

    // Recursively loop
    animationRef.current = requestAnimationFrame(renderPreview);
  };

  const handlePlayToggle = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      cancelAnimationFrame(animationRef.current);
    } else {
      video.play();
      animationRef.current = requestAnimationFrame(renderPreview);
    }
    setIsPlaying(!isPlaying);
  };

  // AI captions trigger
  const handleGenerateCaptions = async () => {
    if (!isPro) {
      alert("AI captions require a Pro Subscription.");
      return;
    }

    const apiKey = localStorage.getItem('openai_api_key') || '';
    setLoadingCaptions(true);
    if (window.electron && window.electron.generateAICaptions) {
      const result = await window.electron.generateAICaptions(projectId, apiKey);
      if (result.success) {
        setCaptions(result.captions);
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

  // Export start
  const handleExport = async () => {
    setShowExportModal(true);
    setIsExporting(true);
    setExportProgress(0);
    setExportDone(false);
    setExportStartTime(Date.now());

    // Simulate export progress if no real electron
    if (window.electron && window.electron.startExport) {
      const exportPath = `c:/Users/USER/Desktop/ScreenFlow_${projectId}.${exportFormat}`;
      await window.electron.startExport(projectId, exportPath, exportFormat, exportQuality);
      
      window.electron.onExportProgress((data) => {
        setExportProgress(data.progress);
        if (data.progress >= 100) {
          setIsExporting(false);
          setExportDone(true);
        }
      });
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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '0', background: 'var(--bg-secondary)' }}>
      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button onClick={onCloseProject} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div style={{ width: '1px', height: '28px', background: 'var(--border-color)' }} />
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{project?.name || 'Loading...'}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              <Clock size={10} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>{formatTime(duration)} · 1080p · {isPro ? 'Pro' : 'Free'}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Auto-save indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600,
            color: savedStatus === 'saved' ? '#00C48C' : savedStatus === 'saving' ? '#FFB800' : '#ef4444' }}>
            {savedStatus === 'saved' && <Check size={11} />}
            {savedStatus === 'saving' && <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />}
            {savedStatus === 'error' && <AlertCircle size={11} />}
            {savedStatus === 'saved' ? 'Saved' : savedStatus === 'saving' ? 'Saving...' : 'Error'}
          </div>

          <button onClick={handleGenerateCaptions} 
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}
            disabled={loadingCaptions}
          >
            <Type size={13} />
            {loadingCaptions ? 'Generating...' : 'AI Captions'}
          </button>

          {!isPro && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: '8px', padding: '5px 10px', fontSize: '11px', fontWeight: 700, color: '#a78bfa' }}>
              <Lock size={10} /> FREE PLAN
            </div>
          )}

          <button onClick={() => { setShowExportModal(true); setExportDone(false); setExportProgress(0); setIsExporting(false); }}
            style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #FF4D7E 100%)', border: 'none', borderRadius: '10px', color: '#fff', cursor: 'pointer', padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }}
          >
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {/* Main workspace panels */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 300px', minHeight: 0, overflow: 'hidden' }}>
        {/* Editor Screen & Canvas */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: '1px solid var(--border-color)' }}>
          {/* Canvas Wrapper */}
          <div 
            style={{ 
              flex: 1, 
              background: '#0a0a0f', 
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
              style={{ maxWidth: '100%', maxHeight: '100%', aspectRatio: '16/9', display: 'block', objectFit: 'contain' }}
            />
            {/* Hidden HTML5 video source */}
            <video 
              ref={videoRef} 
              src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4" 
              style={{ display: 'none' }}
              loop
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
              <div key={i} style={{ position: 'absolute', top: '14px', left: `${(ev.timestamp / duration) * 100}%`, transform: 'translateX(-50%)', background: 'rgba(124,58,237,0.8)', borderRadius: '6px', padding: '2px 8px', fontSize: '10px', fontWeight: 700, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
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
                style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #FF4D7E 100%)', border: 'none', borderRadius: '10px', color: '#fff', cursor: 'pointer', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }}>
                {isPlaying ? <Pause size={14} fill="#fff" /> : <Play size={14} fill="#fff" style={{ marginLeft: '1px' }} />}
              </button>

              <button onClick={() => { if(videoRef.current) videoRef.current.currentTime = Math.min(duration, currentTime + 10); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}>
                <SkipForward size={16} />
              </button>

              {/* Scrub bar */}
              <div 
                ref={timelineRef}
                style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', position: 'relative', cursor: 'pointer' }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  const newTime = pct * duration;
                  if (videoRef.current) videoRef.current.currentTime = newTime;
                  setCurrentTime(newTime);
                }}
              >
                {/* Progress fill */}
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${(currentTime / duration) * 100}%`, background: 'linear-gradient(90deg, #7C3AED, #FF4D7E)', borderRadius: '3px' }} />
                {/* Playhead */}
                <div style={{ position: 'absolute', left: `${(currentTime / duration) * 100}%`, top: '-5px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', border: '3px solid #7C3AED', transform: 'translateX(-50%)', boxShadow: '0 2px 8px rgba(0,0,0,0.4)', cursor: 'grab' }} />
              </div>

              {/* Volume */}
              <button onClick={() => { setIsMuted(!isMuted); if(videoRef.current) videoRef.current.muted = !isMuted; }}
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
                  <div style={{ flex: 1, height: '32px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden', minWidth: `${100 * timelineZoom}%` }}>
                    {/* Clip block */}
                    <div style={{
                      position: 'absolute',
                      left: `${clip.start * 100}%`,
                      width: `${(clip.end - clip.start) * 100}%`,
                      height: '100%',
                      background: `${clip.color}33`,
                      border: `1px solid ${clip.color}66`,
                      borderRadius: '5px',
                      display: 'flex', alignItems: 'center', padding: '0 8px',
                      cursor: 'pointer', transition: 'opacity 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                      <span style={{ fontSize: '9px', fontWeight: 700, color: clip.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clip.label}</span>
                    </div>

                    {/* Playhead line overlay */}
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${(currentTime / duration) * 100}%`, width: '2px', background: '#7C3AED', opacity: 0.8, pointerEvents: 'none' }} />

                    {/* Silence markers */}
                    {clip.id === 'screen' && silencePeriods.map((p, i) => (
                      <div key={i} style={{ position: 'absolute', left: `${(p.start / duration) * 100}%`, width: `${((p.end - p.start) / duration) * 100}%`, height: '100%', background: 'rgba(239,68,68,0.25)', borderRadius: '3px', border: '1px solid rgba(239,68,68,0.4)' }} />
                    ))}

                    {/* Scene zoom event markers */}
                    {clip.id === 'screen' && sceneEvents.map((ev, i) => (
                      <div key={i} style={{ position: 'absolute', top: '2px', left: `${(ev.timestamp / duration) * 100}%`, transform: 'translateX(-50%)', width: '8px', height: '8px', borderRadius: '50%', background: '#7C3AED', border: '2px solid rgba(255,255,255,0.5)', cursor: 'pointer', zIndex: 2 }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar panel */}
        <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'var(--bg-surface)' }}>
          {/* Compact icon-tab bar */}
          <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border-color)', padding: '8px 12px 0', overflowX: 'auto' }}>
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
                    color: sidebarTab === tab.id ? '#a78bfa' : 'var(--text-muted)',
                    borderBottom: sidebarTab === tab.id ? '2px solid #7C3AED' : '2px solid transparent',
                    fontSize: '10px', fontWeight: 600, transition: 'all 0.15s', flexShrink: 0
                  }}>
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {sidebarTab === 'zoom' || sidebarTab === 'bg' || sidebarTab === 'cursor' || sidebarTab === 'brand' ? (
            <>
              {/* Zoom Controls */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={14} /> Smart Zoom Easing
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Zoom Scale ({settings.zoom_level}x)</span>
              <input 
                type="range" 
                min="1.0" 
                max="3.0" 
                step="0.1" 
                value={settings.zoom_level || 1.5} 
                onChange={(e) => handleSaveSettings({ zoom_level: parseFloat(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
              />
              
              {/* Quick Presets */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                {[1.2, 1.5, 2.0, 3.0].map(val => (
                  <button
                    key={val}
                    onClick={() => handleSaveSettings({ zoom_level: val })}
                    style={{
                      flex: 1,
                      padding: '6px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: settings.zoom_level === val ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.02)',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {val}x
                  </button>
                ))}
              </div>

              {/* AI Scene Detection scanner */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>AI Auto-Zoom Engine</span>
                
                <button 
                  onClick={handleScanScene} 
                  className="btn-secondary" 
                  style={{ width: '100%', fontSize: '12px', padding: '6px', justifyContent: 'center' }}
                  disabled={analyzingScene}
                >
                  {analyzingScene ? 'Analyzing video actions...' : 'Auto-Generate Smart Zooms'}
                </button>

                {sceneEvents.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={smartZoomActive} 
                        onChange={(e) => setSmartZoomActive(e.target.checked)} 
                      />
                      Apply Smart Zoom Suggestions
                    </label>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                      <span style={{ fontSize: '10px', background: 'rgba(99,102,241,0.15)', color: 'var(--accent-primary)', padding: '2px 6px', borderRadius: '4px', fontWeight: 500 }}>
                        Keystroke Zoom: 1
                      </span>
                      <span style={{ fontSize: '10px', background: 'rgba(16,185,129,0.15)', color: 'var(--success)', padding: '2px 6px', borderRadius: '4px', fontWeight: 500 }}>
                        Click Zoom: 2
                      </span>
                      <span style={{ fontSize: '10px', background: 'rgba(245,158,11,0.15)', color: 'var(--warning)', padding: '2px 6px', borderRadius: '4px', fontWeight: 500 }}>
                        Navigation Zoom: 1
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Background Settings */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Image size={14} /> Canvas Background
            </h3>
            <select 
              value={settings.background_type || 'gradient'} 
              onChange={(e) => handleSaveSettings({ background_type: e.target.value })}
              className="input-control"
            >
              <option value="gradient">Gradient Background</option>
              <option value="solid">Solid Color</option>
              <option value="blur">Video Blur Backdrop</option>
              <option value="image">Custom Uploaded Image</option>
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
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Start Color</span>
                  <input 
                    type="color" 
                    value={settings.background_value_start || '#6366f1'} 
                    onChange={(e) => handleSaveSettings({ background_value_start: e.target.value })}
                    style={{ width: '100%', height: '36px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'transparent', cursor: 'pointer' }}
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>End Color</span>
                  <input 
                    type="color" 
                    value={settings.background_value_end || '#a855f7'} 
                    onChange={(e) => handleSaveSettings({ background_value_end: e.target.value })}
                    style={{ width: '100%', height: '36px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'transparent', cursor: 'pointer' }}
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
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MousePointer size={14} /> Cursor Highlight
            </h3>
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Pointer/Glow Size ({settings.cursor_size || 40}px)</span>
              <input 
                type="range" 
                min="10" 
                max="80" 
                step="1" 
                value={settings.cursor_size || 40} 
                onChange={(e) => handleSaveSettings({ cursor_size: parseInt(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Glow Opacity ({Math.round((settings.cursor_opacity !== undefined ? settings.cursor_opacity : 0.8) * 100)}%)</span>
              <input 
                type="range" 
                min="0.1" 
                max="1.0" 
                step="0.05" 
                value={settings.cursor_opacity !== undefined ? settings.cursor_opacity : 0.8} 
                onChange={(e) => handleSaveSettings({ cursor_opacity: parseFloat(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
              />
            </div>
          </div>

          {/* Webcam settings card */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Camera size={14} /> Webcam Overlay
            </h3>
            
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
                min="0.1" 
                max="0.4" 
                step="0.02" 
                value={settings.webcam_size || 0.2} 
                onChange={(e) => handleSaveSettings({ webcam_size: parseFloat(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
              />
            </div>
          </div>

          {/* Motion Blur settings card */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                  style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                />
              </div>
            )}
          </div>

          {/* Silence Cutter settings card */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
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
                    onChange={(e) => setAutoCutSilence(e.target.checked)} 
                  />
                  Auto-cut silence (Live Preview)
                </label>
              </div>
            )}
          </div>

          {/* Branding Settings Card */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={14} /> Brand Styling & Overlays
            </h3>

            {/* Brand Presets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Brand Presets</span>
              <select 
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'modern') {
                    handleSaveSettings({
                      brand_preset: 'modern',
                      brand_name: 'Modern Studio',
                      brand_author: 'Jane Doe',
                      brand_title: 'Creative Director',
                      watermark_enabled: true,
                      lower_third_enabled: true,
                      intro_enabled: true,
                      outro_enabled: true
                    });
                  } else if (val === 'creative') {
                    handleSaveSettings({
                      brand_preset: 'creative',
                      brand_name: 'Pixel & Code',
                      brand_author: 'Alex Smith',
                      brand_title: 'UX Lead',
                      watermark_enabled: true,
                      lower_third_enabled: true,
                      intro_enabled: true,
                      outro_enabled: true
                    });
                  } else if (val === 'corporate') {
                    handleSaveSettings({
                      brand_preset: 'corporate',
                      brand_name: 'CorpTech Inc',
                      brand_author: 'Robert Vance',
                      brand_title: 'Chief Officer',
                      watermark_enabled: true,
                      lower_third_enabled: true,
                      intro_enabled: true,
                      outro_enabled: true
                    });
                  } else {
                    handleSaveSettings({ brand_preset: 'none' });
                  }
                }}
                className="input-control"
                value={settings.brand_preset || 'none'}
              >
                <option value="none">No Preset (Custom)</option>
                <option value="modern">Modern Studio Preset</option>
                <option value="creative">Creative Pixel Preset</option>
                <option value="corporate">Corporate Tech Preset</option>
              </select>
            </div>

            {/* Watermark/Logo toggles */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: !isPro ? 'not-allowed' : 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={!isPro ? true : !!settings.watermark_enabled} 
                  disabled={!isPro}
                  onChange={(e) => handleSaveSettings({ watermark_enabled: e.target.checked })} 
                />
                Enable Logo Watermark {!isPro && <span style={{ color: '#f43f5e', fontSize: '10px', fontWeight: 600 }}>(PRO Feature / Forced Free)</span>}
              </label>

              {(settings.watermark_enabled || !isPro) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Watermark Logo Text</span>
                  <input 
                    type="text" 
                    value={settings.brand_name || 'SCREENFLOW AI'} 
                    onChange={(e) => handleSaveSettings({ brand_name: e.target.value })}
                    className="input-control"
                    style={{ fontSize: '12px', padding: '6px 10px' }}
                  />
                </div>
              )}
            </div>

            {/* Lower Thirds toggles */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                    No captions generated yet. Click "AI Captions" at the top to transcribe.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                    {captions.map((cap, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--accent-primary)', fontWeight: 600 }}>
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
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '24px', padding: '32px', width: '460px', display: 'flex', flexDirection: 'column', gap: '24px', boxShadow: '0 40px 80px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 800 }}>Export Video</h3>
              {!isExporting && <button onClick={() => setShowExportModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '22px', lineHeight: 1 }}>×</button>}
            </div>

            {exportDone ? (
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
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', border: '3px solid rgba(124,58,237,0.2)', borderTop: '3px solid #7C3AED', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700 }}>Encoding your video...</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {exportProgress < 30 ? 'Preparing frames...' : exportProgress < 60 ? 'Encoding video tracks...' : exportProgress < 85 ? 'Applying overlays...' : 'Finalizing...'}
                    </div>
                  </div>
                </div>
                <div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${exportProgress}%`, background: 'linear-gradient(90deg, #7C3AED, #FF4D7E)', transition: 'width 0.4s ease', borderRadius: '4px' }} />
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
                  <button onClick={handleExport} style={{ flex: 1, background: 'linear-gradient(135deg, #7C3AED 0%, #FF4D7E 100%)', border: 'none', borderRadius: '12px', color: '#fff', padding: '14px', fontWeight: 800, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 6px 20px rgba(124,58,237,0.35)' }}>
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
