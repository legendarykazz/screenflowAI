import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Clapperboard,
  Focus,
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
  const [countdownVal, setCountdownVal] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Ready to capture a polished screen recording.');
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [brandKit, setBrandKit] = useState(null);

  // Custom Area Crop Selector State
  const [showCropSelector, setShowCropSelector] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragRect, setDragRect] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, w: 1, h: 1 }); // fractions of full screen

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordTimeRef = useRef(0);
  const timerIntervalRef = useRef(null);
  const trackingEventsRef = useRef([]);
  const audioCtxRef = useRef(null);

  // Live Canvas Zoom References & Refs
  const canvasRef = useRef(null);
  const hiddenVideoRef = useRef(null);
  const cropVideoRef = useRef(null);
  const cropStreamRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const animationFrameIdRef = useRef(null);

  const zoomLevelRef = useRef(1.0);
  const targetZoomLevelRef = useRef(1.0);
  const zoomCenterRef = useRef({ x: 0.5, y: 0.5 });
  const targetZoomCenterRef = useRef({ x: 0.5, y: 0.5 });
  const screenResolutionRef = useRef({ width: 1920, height: 1080 });
  const latestCursorRef = useRef({ x: 960, y: 540 });
  const latestClickAtRef = useRef(0);
  const latestZoomLabelAtRef = useRef(0);

  const activePreset = cinematicPresets.find((preset) => preset.id === presetId) || cinematicPresets[0];
  const withTimeout = (promise, ms, label) => (
    Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)} seconds`)), ms);
      })
    ])
  );

  const handleStopRef = useRef(null);
  useEffect(() => {
    handleStopRef.current = handleStop;
  });

  useEffect(() => {
    loadDevices();
    loadBrandKit();
    let unsubscribeRecordingStatus = null;

    // Register IPC listener for live cursor movements and zoom triggers from main process
    if (window.electron?.onRecordingStatus) {
      unsubscribeRecordingStatus = window.electron.onRecordingStatus((status) => {
        if (status.type === 'cursor-move') {
          latestCursorRef.current = { x: status.x, y: status.y };
          if (status.screenWidth && status.screenHeight) {
            screenResolutionRef.current = { width: status.screenWidth, height: status.screenHeight };
          }
        } else if (status.type === 'zoom') {
          if (status.direction === 'in') {
            targetZoomLevelRef.current = Math.min(3.0, targetZoomLevelRef.current + 0.25);
          } else if (status.direction === 'out') {
            targetZoomLevelRef.current = Math.max(1.0, targetZoomLevelRef.current - 0.25);
          }
          latestZoomLabelAtRef.current = performance.now();
        } else if (status.type === 'cursor-click') {
          latestClickAtRef.current = performance.now();
          if (typeof status.x === 'number' && typeof status.y === 'number') {
            latestCursorRef.current = { x: status.x, y: status.y };
          }
        } else if (status.type === 'stop-recording-request') {
          handleStopRef.current?.();
        }
      });
    }

    // Local wheel event listener for live zoom control when window has focus
    const handleGlobalWheel = (e) => {
      if (!isRecording) return;
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          targetZoomLevelRef.current = Math.min(3.0, targetZoomLevelRef.current + 0.1);
        } else {
          targetZoomLevelRef.current = Math.max(1.0, targetZoomLevelRef.current - 0.1);
        }
        latestZoomLabelAtRef.current = performance.now();
      }
    };
    window.addEventListener('wheel', handleGlobalWheel, { passive: false });

    return () => {
      unsubscribeRecordingStatus?.();
      window.removeEventListener('wheel', handleGlobalWheel);
    };
  }, [isRecording]);

  // Dedicated component unmount cleanup (only runs once on unmount)
  useEffect(() => {
    return () => {
      stopStreams();
      clearInterval(timerIntervalRef.current);
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
    };
  }, []);

  const loadDevices = async () => {
    let foundSources = 0;
    if (window.electron?.getSources) {
      const srcList = await window.electron.getSources();
      foundSources = srcList.length;
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
      setStatusMessage(`Devices refreshed: ${foundSources || sources.length || 0} capture sources, ${mics.length} microphones, ${cams.length} cameras.`);
    } catch (error) {
      console.warn('Failed to list media devices:', error);
      setStatusMessage('Device refresh failed. You can still use the system screen picker.');
    }
  };

  const loadBrandKit = async () => {
    if (window.electron?.getBrandKit) {
      const kit = await window.electron.getBrandKit();
      setBrandKit(kit);
      if (kit?.primary_color) setCursorColor(kit.primary_color);
    }
  };

  const stopStreams = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (cropStreamRef.current) {
      cropStreamRef.current.getTracks().forEach((track) => track.stop());
      cropStreamRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
  };

  const buildProjectSettings = () => ({
    ...activePreset.settings,
    brand_preset: 'brand-kit',
    brand_name: brandKit?.brand_name || 'SCREENFLOW AI',
    brand_author: brandKit?.lower_third_name || 'Alex Morgan',
    brand_title: brandKit?.lower_third_title || 'SaaS Founder',
    brand_primary_color: brandKit?.primary_color || cursorColor,
    brand_secondary_color: brandKit?.secondary_color || activePreset.settings.cursor_color || '#FF4D7E',
    brand_logo: brandKit?.primary_logo || null,
    brand_white_logo: brandKit?.white_logo || null,
    watermark_enabled: true,
    watermark_text: brandKit?.watermark_text || brandKit?.brand_name || 'SCREENFLOW AI',
    watermark_opacity: brandKit?.watermark_opacity ?? 0.7,
    watermark_position: brandKit?.watermark_position || 'top-right',
    watermark_font: brandKit?.watermark_font || 'Inter',
    lower_third_enabled: !!brandKit,
    lower_third_style: brandKit?.lower_third_style || 'modern',
    intro_enabled: false,
    intro_style: brandKit?.intro_style || 'fade',
    outro_enabled: false,
    outro_style: brandKit?.outro_style || 'subscribe',
    outro_text: brandKit?.outro_text || 'Thanks for Watching!',
    zoom_level: 1,
    follow_cursor: false,
    cursor_color: cursorColor,
    cursor_visible: false,
    cursor_baked: showCursor,
    cursor_style: 'arrow',
    cursor_smoothing: 0.18,
    cursor_auto_hide: true,
    cursor_idle_hide_delay: 1.2,
    cursor_loop_to_start: false,
    recording_mode: recordingMode,
    recording_source: selectedSource,
    cinematic_preset: presetId,
    resolution,
    system_audio: systemAudio,
    webcam_enabled: webcamEnabled,
    webcam_baked: webcamEnabled,
    auto_zoom: false,
    auto_smooth_cursor: true,
    zoom_smoothing: 0.08,
    click_emphasis: showCursor ? activePreset.settings.cursor_highlight : 'none'
  });

  const getMimeType = (hasAudio) => {
    const types = hasAudio 
      ? [
          'video/webm;codecs=vp8,opus',
          'video/webm;codecs=vp9,opus',
          'video/webm'
        ]
      : [
          'video/webm;codecs=vp8',
          'video/webm;codecs=vp9',
          'video/webm'
        ];
    return types.find((type) => MediaRecorder.isTypeSupported(type)) || '';
  };

  const createComposedVideoStream = async (screenStream, cropRegion, cameraStream) => {
    const sourceTrack = screenStream.getVideoTracks()[0];
    const trackSettings = sourceTrack?.getSettings?.() || {};
    const sourceWidth = trackSettings.width || 1920;
    const sourceHeight = trackSettings.height || 1080;
    const fps = resolution.includes('60fps') ? 60 : 30;

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = screenStream;
    video.style.position = 'fixed';
    video.style.left = '-10000px';
    video.style.top = '-10000px';
    document.body.appendChild(video);
    hiddenVideoRef.current = video;

    await video.play();

    let cameraVideo = null;
    if (cameraStream?.getVideoTracks?.().length) {
      cameraVideo = document.createElement('video');
      cameraVideo.muted = true;
      cameraVideo.playsInline = true;
      cameraVideo.srcObject = cameraStream;
      cameraVideo.style.position = 'fixed';
      cameraVideo.style.left = '-10000px';
      cameraVideo.style.top = '-10000px';
      document.body.appendChild(cameraVideo);
      cameraVideoRef.current = cameraVideo;
      await cameraVideo.play();
    }

    const canvas = document.createElement('canvas');
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
    canvas.style.position = 'fixed';
    canvas.style.left = '-10000px';
    canvas.style.top = '-10000px';
    document.body.appendChild(canvas);
    canvasRef.current = canvas;

    const ctx = canvas.getContext('2d');
    const crop = cropRegion || { x: 0, y: 0, w: 1, h: 1 };

    const drawCursor = (x, y, clickActive) => {
      if (!showCursor) return;
      const size = 46;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;

      if (clickActive) {
        ctx.globalAlpha = 0.32;
        ctx.fillStyle = cursorColor;
        ctx.beginPath();
        ctx.arc(x, y, 54, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + size * 0.82, y + size * 0.76);
      ctx.lineTo(x + size * 0.34, y + size * 0.9);
      ctx.lineTo(x + size * 0.17, y + size * 1.34);
      ctx.lineTo(x - size * 0.02, y + size * 1.26);
      ctx.lineTo(x + size * 0.15, y + size * 0.84);
      ctx.lineTo(x, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    const drawWebcamOverlay = () => {
      if (!cameraVideo || cameraVideo.readyState < 2) return;

      const webcamScale = 0.22;
      const camW = Math.round(canvas.width * webcamScale);
      const camH = Math.round(camW * 0.68);
      const margin = 42;
      const camX = canvas.width - camW - margin;
      const camY = canvas.height - camH - margin;

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.36)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 12;
      ctx.beginPath();
      ctx.roundRect(camX, camY, camW, camH, 18);
      ctx.fillStyle = '#111827';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.76)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.clip();

      const videoRatio = (cameraVideo.videoWidth || 16) / (cameraVideo.videoHeight || 9);
      const tileRatio = camW / camH;
      let sxCam = 0;
      let syCam = 0;
      let swCam = cameraVideo.videoWidth || 1280;
      let shCam = cameraVideo.videoHeight || 720;
      if (videoRatio > tileRatio) {
        swCam = shCam * tileRatio;
        sxCam = ((cameraVideo.videoWidth || swCam) - swCam) / 2;
      } else {
        shCam = swCam / tileRatio;
        syCam = ((cameraVideo.videoHeight || shCam) - shCam) / 2;
      }

      ctx.drawImage(cameraVideo, sxCam, syCam, swCam, shCam, camX, camY, camW, camH);
      ctx.fillStyle = 'rgba(15,23,42,0.56)';
      ctx.fillRect(camX, camY + camH - 28, camW, 28);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Camera', camX + 14, camY + camH - 10);
      ctx.restore();
    };

    const render = () => {
      const cursor = latestCursorRef.current;
      const screenSize = screenResolutionRef.current;
      const normalizedX = Math.max(0, Math.min(1, cursor.x / Math.max(1, screenSize.width)));
      const normalizedY = Math.max(0, Math.min(1, cursor.y / Math.max(1, screenSize.height)));

      targetZoomCenterRef.current = { x: normalizedX, y: normalizedY };
      zoomLevelRef.current += (targetZoomLevelRef.current - zoomLevelRef.current) * 0.12;
      zoomCenterRef.current.x += (targetZoomCenterRef.current.x - zoomCenterRef.current.x) * 0.12;
      zoomCenterRef.current.y += (targetZoomCenterRef.current.y - zoomCenterRef.current.y) * 0.12;

      const zoom = zoomLevelRef.current;
      const sx = crop.x * sourceWidth;
      const sy = crop.y * sourceHeight;
      const sw = crop.w * sourceWidth;
      const sh = crop.h * sourceHeight;
      const zoomSw = sw / zoom;
      const zoomSh = sh / zoom;
      const centerX = sx + sw * zoomCenterRef.current.x;
      const centerY = sy + sh * zoomCenterRef.current.y;
      const drawSx = Math.max(sx, Math.min(sx + sw - zoomSw, centerX - zoomSw / 2));
      const drawSy = Math.max(sy, Math.min(sy + sh - zoomSh, centerY - zoomSh / 2));

      ctx.fillStyle = '#090b12';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, drawSx, drawSy, zoomSw, zoomSh, 0, 0, canvas.width, canvas.height);
      drawWebcamOverlay();

      const cursorX = ((cursor.x - drawSx) / zoomSw) * canvas.width;
      const cursorY = ((cursor.y - drawSy) / zoomSh) * canvas.height;
      const clickActive = performance.now() - latestClickAtRef.current < 420;
      drawCursor(cursorX, cursorY, clickActive);

      const shouldShowZoomLabel = performance.now() - latestZoomLabelAtRef.current < 1800;
      if (shouldShowZoomLabel) {
        const isUnzoomed = targetZoomLevelRef.current <= 1.01;
        const label = isUnzoomed ? '1x unzoom' : `${targetZoomLevelRef.current.toFixed(1)}x zoom`;
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
        ctx.strokeStyle = 'rgba(255,255,255,0.16)';
        ctx.lineWidth = 1;
        ctx.roundRect(28, 28, isUnzoomed ? 188 : 174, 58, 16);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 26px system-ui, sans-serif';
        ctx.fillText(label, 50, 66);
        ctx.restore();
      }

      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    render();
    return canvas.captureStream(fps);
  };

  // Drag-and-drop Crop UI handlers
  const handleCropMouseDown = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setDragStart({ x, y });
    setDragRect({ left: x, top: y, width: 0, height: 0 });
    setIsDragging(true);
  };

  const handleCropMouseMove = (e) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    const left = Math.min(dragStart.x, x);
    const top = Math.min(dragStart.y, y);
    const width = Math.abs(dragStart.x - x);
    const height = Math.abs(dragStart.y - y);

    setDragRect({ left, top, width, height });
  };

  const handleCropMouseUp = () => {
    setIsDragging(false);
  };

  const confirmCrop = () => {
    if (!dragRect || dragRect.width < 20 || dragRect.height < 20) {
      alert('Please drag a larger box to crop the screen.');
      return;
    }

    const video = cropVideoRef.current;
    if (!video) return;

    const container = video.getBoundingClientRect();
    const videoWidth = video.videoWidth || 1920;
    const videoHeight = video.videoHeight || 1080;
    const videoRatio = videoWidth / videoHeight;
    const containerRatio = container.width / container.height;

    let contentWidth = container.width;
    let contentHeight = container.height;
    let contentLeft = 0;
    let contentTop = 0;

    if (containerRatio > videoRatio) {
      contentHeight = container.height;
      contentWidth = container.height * videoRatio;
      contentLeft = (container.width - contentWidth) / 2;
      contentTop = 0;
    } else {
      contentWidth = container.width;
      contentHeight = container.width / videoRatio;
      contentLeft = 0;
      contentTop = (container.height - contentHeight) / 2;
    }

    // Guard against zero dimensions to avoid division by zero
    if (contentWidth <= 0) contentWidth = 1920;
    if (contentHeight <= 0) contentHeight = 1080;

    const relativeX = (dragRect.left - contentLeft) / contentWidth;
    const relativeY = (dragRect.top - contentTop) / contentHeight;
    const relativeW = dragRect.width / contentWidth;
    const relativeH = dragRect.height / contentHeight;

    const x = Math.max(0, Math.min(isNaN(relativeX) ? 0 : relativeX, 1));
    const y = Math.max(0, Math.min(isNaN(relativeY) ? 0 : relativeY, 1));
    const w = Math.max(0.05, Math.min(isNaN(relativeW) ? 1 : relativeW, 1 - x));
    const h = Math.max(0.05, Math.min(isNaN(relativeH) ? 1 : relativeH, 1 - y));

    const finalArea = { x, y, w, h };
    setCropArea(finalArea);
    setShowCropSelector(false);

    startRecordingPipeline(cropStreamRef.current, finalArea);
  };

  const handleStart = async () => {
    console.log("Recording.handleStart() called. Current Mode:", recordingMode, "Selected Source:", selectedSource);
    if (isRecording) {
      console.warn("Already recording, ignoring start click.");
      return;
    }

    // Initialize AudioContext under a direct user gesture to bypass Chrome's autoplay/suspension policies
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtxClass();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      audioCtxRef.current = ctx;
    } catch (err) {
      console.warn("Failed to pre-initialize AudioContext on click:", err);
    }

    if (countdown) {
      setCountdownVal(5);
      setStatusMessage('Starting in 5 seconds...');
      const interval = setInterval(() => {
        setCountdownVal((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setCountdownVal(0);
            initiateRecordingCapture();
            return 0;
          }
          setStatusMessage(`Starting in ${prev - 1} seconds...`);
          return prev - 1;
        });
      }, 1000);
    } else {
      initiateRecordingCapture();
    }
  };

  const initiateRecordingCapture = async () => {
    chunksRef.current = [];
    trackingEventsRef.current = [];
    recordTimeRef.current = 0;
    setRecordTime(0);
    setStatusMessage('Hiding ScreenFlowAI before capture starts...');

    try {
      if (webcamEnabled && !cameraStreamRef.current) {
        setStatusMessage('Starting webcam overlay...');
        try {
          cameraStreamRef.current = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: selectedCamera === 'default'
              ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
              : { deviceId: { exact: selectedCamera }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
          });
        } catch (error) {
          console.warn('Webcam overlay capture failed:', error);
          setStatusMessage(`Webcam unavailable, recording screen only: ${error.message}`);
        }
      }

      if (window.electron?.hideForRecording) {
        await window.electron.hideForRecording();
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      setStatusMessage('Bypassing capture prompts and preparing screen capture...');

      let screenStream;
      const targetSource = selectedSource || (sources.length > 0 ? sources[0].id : null);

      if (targetSource && window.electron?.getSources) {
        // Programmatic direct screen capture without any picker prompts
        try {
          screenStream = await navigator.mediaDevices.getUserMedia({
            audio: systemAudio ? {
              mandatory: {
                chromeMediaSource: 'desktop'
              }
            } : false,
            video: {
              cursor: 'never',
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: targetSource,
                cursor: 'never',
                minFrameRate: 30,
                maxFrameRate: 60
              }
            }
          });
        } catch (e) {
          console.warn("Direct capture with system audio failed, retrying video only...", e);
          try {
            screenStream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: {
                cursor: 'never',
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: targetSource,
                  cursor: 'never',
                  minFrameRate: 30,
                  maxFrameRate: 60
                }
              }
            });
          } catch (e2) {
            console.warn("Direct capture failed completely, falling back to getDisplayMedia picker...", e2);
            screenStream = await navigator.mediaDevices.getDisplayMedia({
              video: {
                cursor: 'never',
                frameRate: resolution.includes('60fps') ? 60 : 30
              },
              audio: systemAudio
            });
          }
        }
      } else {
        // Fallback for browser/standard context
        try {
          screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              cursor: 'never',
              frameRate: resolution.includes('60fps') ? 60 : 30
            },
            audio: systemAudio
          });
        } catch (e) {
          console.warn("Browser getDisplayMedia with audio failed, retrying video-only...", e);
          screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              cursor: 'never',
              frameRate: resolution.includes('60fps') ? 60 : 30
            },
            audio: false
          });
        }
      }

      if (recordingMode === 'Custom Area') {
        cropStreamRef.current = screenStream;
        setShowCropSelector(true);
        // Wait for video load in crop preview
        setTimeout(() => {
          if (cropVideoRef.current) {
            cropVideoRef.current.srcObject = screenStream;
          }
        }, 100);
      } else {
        // Fullscreen or default window mode
        cropStreamRef.current = screenStream;
        setCropArea({ x: 0, y: 0, w: 1, h: 1 });
        startRecordingPipeline(screenStream, { x: 0, y: 0, w: 1, h: 1 });
      }
    } catch (error) {
      alert("Recording initialization failed: " + error.stack);
      console.error('Recording initialization failed:', error);
      setStatusMessage(`Could not start recording: ${error.message}`);
      window.electron?.restoreWindow?.();
    }
  };

  const startRecordingPipeline = async (screenStream, cropRegion) => {
    console.log("startRecordingPipeline() called. Stream tracks:", screenStream.getTracks().map(t => t.kind), "Crop Region:", cropRegion);
    try {
      const combinedTracks = [];
      let cameraStream = null;

      if (webcamEnabled) {
        cameraStream = cameraStreamRef.current;
      }

      const composedVideoStream = await createComposedVideoStream(screenStream, cropRegion, cameraStream);
      const composedVideoTrack = composedVideoStream.getVideoTracks()[0];
      if (composedVideoTrack) {
        combinedTracks.push(composedVideoTrack);
      }

      // 2. Mix microphone and system audio into a single track
      let micStream = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: selectedMic === 'default' ? true : { deviceId: selectedMic }
        });
      } catch (error) {
        console.warn('Microphone capture bypassed or failed:', error);
      }

      const systemAudioTrack = screenStream.getAudioTracks()[0];

      // Use Web Audio API to mix audio tracks to prevent container corruption (multiple audio tracks in WebM is unsupported)
      const audioCtx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)();
      const dest = audioCtx.createMediaStreamDestination();
      let hasAudio = false;

      if (micStream && micStream.getAudioTracks().length > 0) {
        try {
          const micSource = audioCtx.createMediaStreamSource(micStream);
          micSource.connect(dest);
          hasAudio = true;
        } catch (e) {
          console.warn("Could not connect microphone to AudioContext:", e);
          combinedTracks.push(...micStream.getAudioTracks()); // Direct fallback
        }
      }

      if (systemAudio && systemAudioTrack) {
        try {
          const sysStream = new MediaStream([systemAudioTrack]);
          const sysSource = audioCtx.createMediaStreamSource(sysStream);
          sysSource.connect(dest);
          hasAudio = true;
        } catch (e) {
          console.warn("Could not connect system audio to AudioContext:", e);
          combinedTracks.push(systemAudioTrack); // Direct fallback
        }
      }

      if (hasAudio && dest.stream.getAudioTracks().length > 0) {
        combinedTracks.push(dest.stream.getAudioTracks()[0]);
      }

      combinedTracks.forEach(track => {
        if (track) {
          track.onended = () => {
            console.warn(`Track ended silently: kind=${track.kind}, label=${track.label}, enabled=${track.enabled}, readyState=${track.readyState}`);
            alert(`Track ended silently: kind=${track.kind}, label=${track.label}`);
          };
        }
      });

      const combinedStream = new MediaStream(combinedTracks.filter(Boolean));
      streamRef.current = combinedStream;

      let mediaRecorder;
      try {
        const mimeType = getMimeType(hasAudio);
        mediaRecorder = new MediaRecorder(combinedStream, mimeType ? { mimeType } : undefined);
      } catch (mimeErr) {
        console.warn("MediaRecorder creation with preferred MIME type failed, trying default format...", mimeErr);
        try {
          mediaRecorder = new MediaRecorder(combinedStream);
        } catch (defaultErr) {
          throw new Error(`MediaRecorder initialization failed: ${defaultErr.message}`);
        }
      }
      recorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data?.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorder.onerror = (e) => {
        console.error("MediaRecorder error event fired:", e);
      };

      mediaRecorder.onstop = async () => {
        // Restore and focus the app window when recording stops to show the editor
        if (window.electron?.restoreWindow) {
          try {
            await window.electron.restoreWindow();
          } catch (e) {}
        }

        console.log("MediaRecorder.onstop triggered! Chunks count:", chunksRef.current.length);
        combinedStream.getTracks().forEach(t => {
          console.log(`Track state in onstop: kind=${t.kind}, label=${t.label}, readyState=${t.readyState}, enabled=${t.enabled}`);
        });

        try {
          if (chunksRef.current.length === 0) {
            setStatusMessage('Recording failed: No video data was captured. Please check screen permissions.');
            return;
          }

          setStatusMessage('Saving capture and preparing cinematic edit...');
          const blob = new Blob(chunksRef.current, { type: getMimeType(hasAudio) || 'video/webm' });
          const arrayBuffer = await blob.arrayBuffer();

          if (!window.electron?.saveRecordedFile) {
            setStatusMessage('Recording finished, but file saving is unavailable in this preview.');
            return;
          }

          const res = await withTimeout(
            window.electron.saveRecordedFile(arrayBuffer),
            45000,
            'Saving recording'
          );

          if (!res.success) {
            setStatusMessage(`Could not save recording: ${res.error}`);
            return;
          }

          const project = await window.electron.createProject(`Cinematic Recording - ${new Date().toLocaleTimeString()}`);
          const settings = buildProjectSettings();

          await window.electron.updateProject(project.id, {
            video_path: res.filePath,
            raw_video_path: res.rawFilePath || res.filePath,
            audio_path: hasAudio ? res.filePath : null,
            webcam_path: webcamEnabled && cameraStream ? res.filePath : null,
            duration: recordTimeRef.current,
            ...settings,
            webcam_enabled: webcamEnabled && !!cameraStream,
            webcam_baked: webcamEnabled && !!cameraStream,
            settings
          });
          await window.electron.saveCursorEvents(project.id, trackingEventsRef.current);
          setStatusMessage('Capture saved. Opening editor...');
          onOpenProject(project.id);
        } catch (err) {
          console.error("Failed to finish recording:", err);
          setStatusMessage(`Recording stopped, but saving failed: ${err.message}`);
        } finally {
          setIsRecording(false);
          stopStreams();
        }
      };

      await window.electron?.startRecording?.(buildProjectSettings());

      mediaRecorder.start();
      setIsRecording(true);
      setStatusMessage('Recording! Ctrl+Alt+Up to zoom, Ctrl+Alt+Down to zoom out. Move mouse to track.');

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        recordTimeRef.current += 1;
        setRecordTime(recordTimeRef.current);
      }, 1000);
    } catch (err) {
      alert("Failed to start canvas stream recording pipeline: " + err.stack);
      console.error("Failed to start canvas stream recording pipeline:", err);
      setStatusMessage(`Recording start failed: ${err.message}`);
      setIsRecording(false);
      
      // Clean up DOM video element
      if (hiddenVideoRef.current) {
        try {
          hiddenVideoRef.current.pause();
          document.body.removeChild(hiddenVideoRef.current);
        } catch (e) {}
        hiddenVideoRef.current = null;
      }

      if (cameraVideoRef.current) {
        try {
          cameraVideoRef.current.pause();
          document.body.removeChild(cameraVideoRef.current);
        } catch (e) {}
        cameraVideoRef.current = null;
      }

      // Clean up DOM canvas element
      if (canvasRef.current) {
        try {
          document.body.removeChild(canvasRef.current);
        } catch (e) {}
        canvasRef.current = null;
      }

      if (screenStream) {
        try {
          screenStream.getTracks().forEach(track => track.stop());
        } catch (e) {}
      }
    }
  };

  const handleStop = async () => {
    if (!isRecording) return;

    if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
    clearInterval(timerIntervalRef.current);
    setIsRecording(false);
    setStatusMessage('Stopping capture and saving recording...');

    // Stop recorder properly to flush final video chunks
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch (err) {
        console.error("MediaRecorder stop failed:", err);
        setStatusMessage(`Could not stop recorder cleanly: ${err.message}`);
        stopStreams();
      }
    } else {
      stopStreams();
    }

    // Cursor/widget cleanup should never block the video from flushing and saving.
    if (window.electron?.stopRecording) {
      withTimeout(window.electron.stopRecording(), 3000, 'Stopping recorder shell')
        .then((res) => {
          if (res?.events) trackingEventsRef.current = res.events;
        })
        .catch((err) => {
          console.warn("Electron stopRecording cleanup warning:", err);
        });
    }

    // Clean up DOM video decoding element
    if (hiddenVideoRef.current) {
      try {
        hiddenVideoRef.current.pause();
        document.body.removeChild(hiddenVideoRef.current);
      } catch (e) {}
      hiddenVideoRef.current = null;
    }

    if (cameraVideoRef.current) {
      try {
        cameraVideoRef.current.pause();
        document.body.removeChild(cameraVideoRef.current);
      } catch (e) {}
      cameraVideoRef.current = null;
    }

    // Clean up DOM canvas element
    if (canvasRef.current) {
      try {
        document.body.removeChild(canvasRef.current);
      } catch (e) {}
      canvasRef.current = null;
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
    boxShadow: '0 10px 28px rgba(15, 23, 42, 0.05)'
  };

  const selectedSourceName = sources.find((source) => source.id === selectedSource)?.name || 'System picker';
  const selectedMicName = selectedMic === 'default'
    ? 'Default microphone'
    : microphones.find((mic) => mic.deviceId === selectedMic)?.label || 'Selected microphone';
  const selectedCameraName = selectedCamera === 'default'
    ? 'Default camera'
    : cameras.find((camera) => camera.deviceId === selectedCamera)?.label || 'Selected camera';

  const captureSummary = [
    ['Source', recordingMode === 'Custom Area' ? 'Custom area after start' : selectedSourceName],
    ['Quality', resolution],
    ['Microphone', selectedMicName],
    ['System audio', systemAudio ? 'On' : 'Off'],
    ['Webcam', webcamEnabled ? selectedCameraName : 'Off'],
    ['Cursor', showCursor ? 'Recorded with highlight' : 'Hidden']
  ];

  return (
    <div style={{
      background: '#F5F7FB',
      color: '#172033',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-sans)',
      gap: '20px',
      margin: '-32px',
      minHeight: '100%',
      padding: '28px 32px'
    }}>
      <header style={{ alignItems: 'flex-start', display: 'flex', justifyContent: 'space-between', gap: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 800, letterSpacing: 0 }}>
            Recorder
          </h1>
          <p style={{ color: '#5A657B', fontSize: '14px', marginTop: '4px' }}>
            Choose the source, audio, cursor, and optional camera before recording.
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
          Refresh
        </button>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(520px, 1fr) 340px', gap: '22px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ ...controlCard, padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 800 }}>Capture</h2>
                <p style={{ color: '#647087', fontSize: '13px', marginTop: '3px' }}>Pick what to record. Custom area asks you to draw the crop after Start.</p>
              </div>
              <Clapperboard size={21} color="#334155" />
            </div>

            <div style={{ background: '#EEF2F8', borderRadius: '8px', display: 'grid', gap: '6px', gridTemplateColumns: 'repeat(3, 1fr)', padding: '5px' }}>
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
                    minHeight: '42px'
                  }}
                >
                  <Icon size={16} />
                  {mode}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '18px' }}>
              <Field label="Source">
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
                <h2 style={{ fontSize: '16px', fontWeight: 800 }}>Motion preset</h2>
                <p style={{ color: '#647087', fontSize: '13px', marginTop: '3px' }}>Saved with the project for cursor emphasis and the edit preset.</p>
              </div>
              <Wand2 size={21} color="#334155" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
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
                    minHeight: '104px',
                    padding: '13px',
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
              <ToggleRow checked={showCursor} icon={MousePointer2} label="Cursor highlight" onChange={setShowCursor} />
              <ToggleRow checked={countdown} icon={Timer} label="5 second countdown" onChange={setCountdown} />
            </div>

            {brandKit && (
              <div style={{ marginTop: '18px', background: '#F8FAFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <div style={{ color: '#172033', fontSize: '13px', fontWeight: 900 }}>Brand Kit active</div>
                  <div style={{ color: '#647087', fontSize: '12px', marginTop: '2px' }}>{brandKit.brand_name || 'Saved brand'} will be applied to this recording.</div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[brandKit.primary_color, brandKit.secondary_color].filter(Boolean).map((color) => (
                    <div key={color} style={{ width: '24px', height: '24px', borderRadius: '999px', background: color, border: '2px solid #fff', boxShadow: '0 3px 8px rgba(15,23,42,0.16)' }} />
                  ))}
                </div>
              </div>
            )}

            {showCursor && (
              <div style={{ borderTop: '1px solid #EDF1F7', marginTop: '18px', paddingTop: '18px' }}>
                <span style={{ color: '#26344D', display: 'block', fontSize: '13px', fontWeight: 800, marginBottom: '10px' }}>Cursor color</span>
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
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 800 }}>Audio and camera</h2>
              <p style={{ color: '#647087', fontSize: '13px', marginTop: '3px' }}>Choose what gets recorded into the edit.</p>
            </div>
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

        <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'sticky', top: '0' }}>
          <div style={{ ...controlCard, padding: '20px' }}>
            <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', gap: '14px' }}>
              <div>
                <span style={{ color: '#647087', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}>Status</span>
                <h2 style={{ fontSize: '18px', fontWeight: 900, marginTop: '4px' }}>{isRecording ? 'Recording now' : 'Ready to record'}</h2>
              </div>
              <span style={{
                background: isRecording ? '#FEE2E2' : '#DCFCE7',
                borderRadius: '999px',
                color: isRecording ? '#991B1B' : '#166534',
                fontSize: '12px',
                fontWeight: 900,
                padding: '7px 10px'
              }}>
                {isRecording ? 'Live' : 'Idle'}
              </span>
            </div>

            <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '38px', fontWeight: 900, marginTop: '18px' }}>
                {formatTime(recordTime)}
            </div>
            <p style={{ color: '#647087', fontSize: '13px', lineHeight: 1.45, margin: '8px 0 18px' }}>{statusMessage}</p>

            {isRecording ? (
              <button onClick={handleStop} style={recordButtonStyle('#DC2626')}>
                <Square size={17} fill="#FFFFFF" />
                Stop recording
              </button>
            ) : (
              <button onClick={handleStart} style={recordButtonStyle('#172033')}>
                <Play size={17} fill="#FFFFFF" />
                Start recording
              </button>
            )}
          </div>

          <div style={{ ...controlCard, padding: '18px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 900, marginBottom: '12px' }}>Current setup</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {captureSummary.map(([label, value]) => (
                <div key={label} style={{ alignItems: 'flex-start', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <span style={{ color: '#647087', fontSize: '12px', fontWeight: 800 }}>{label}</span>
                  <span style={{ color: '#172033', fontSize: '12px', fontWeight: 800, lineHeight: 1.35, maxWidth: '190px', textAlign: 'right' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...controlCard, padding: '18px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 900 }}>{activePreset.name}</h3>
            <p style={{ color: '#647087', fontSize: '13px', lineHeight: 1.45, marginTop: '6px' }}>{activePreset.description}</p>
            <div style={{ alignItems: 'center', display: 'flex', gap: '8px', marginTop: '14px' }}>
              <span style={{ background: cursorColor, border: '2px solid #FFFFFF', borderRadius: '999px', boxShadow: '0 4px 12px rgba(15,23,42,0.14)', height: '24px', width: '24px' }} />
              <span style={{ color: '#647087', fontSize: '12px', fontWeight: 800 }}>{showCursor ? 'Cursor highlight enabled' : 'Cursor highlight disabled'}</span>
            </div>
          </div>
        </aside>
      </section>

      {showCropSelector && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.85)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          fontFamily: 'var(--font-sans)',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '6px' }}>Select Capture Area</h2>
            <p style={{ color: '#94A3B8', fontSize: '14px' }}>Click and drag your mouse across the preview below to highlight the recorded area.</p>
          </div>
          
          <div 
            style={{
              position: 'relative',
              width: '80%',
              height: '65%',
              background: '#0B0F19',
              borderRadius: '12px',
              border: '2px dashed #7C3AED',
              cursor: 'crosshair',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
            onMouseDown={handleCropMouseDown}
            onMouseMove={handleCropMouseMove}
            onMouseUp={handleCropMouseUp}
          >
            <video 
              ref={cropVideoRef} 
              autoPlay 
              muted 
              style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} 
            />
            {dragRect && (
              <div style={{
                position: 'absolute',
                border: '2px solid #FF4D7E',
                background: 'rgba(255, 77, 126, 0.15)',
                left: dragRect.left,
                top: dragRect.top,
                width: dragRect.width,
                height: dragRect.height,
                pointerEvents: 'none',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)'
              }} />
            )}
          </div>
          
          <div style={{ marginTop: '24px', display: 'flex', gap: '16px' }}>
            <button 
              onClick={confirmCrop} 
              style={{ 
                padding: '12px 24px', 
                background: '#7C3AED', 
                border: 'none', 
                borderRadius: '8px', 
                color: '#FFFFFF', 
                cursor: 'pointer', 
                fontWeight: 800,
                boxShadow: '0 4px 14px rgba(124, 58, 237, 0.4)',
                transition: 'all 0.2s'
              }}
            >
              Confirm Capture Area
            </button>
            <button 
              onClick={() => {
                setShowCropSelector(false);
                stopStreams();
              }} 
              style={{ 
                padding: '12px 24px', 
                background: '#334155', 
                border: 'none', 
                borderRadius: '8px', 
                color: '#E2E8F0', 
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {/* 5-second countdown overlay */}
      {countdownVal > 0 && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(16px)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#FF4D7E', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '16px' }}>
            Preparing Screen Capture
          </div>
          <div style={{ 
            fontSize: '120px', 
            fontWeight: 900, 
            color: '#FFFFFF',
            animation: 'pulseScale 1s infinite'
          }}>
            {countdownVal}
          </div>
          <div style={{ fontSize: '14px', color: '#94A3B8', marginTop: '16px' }}>
            Get ready to record your desktop!
          </div>
          <style>
            {`
              @keyframes pulseScale {
                0% { transform: scale(0.9); opacity: 0.5; }
                50% { transform: scale(1.1); opacity: 1; }
                100% { transform: scale(0.9); opacity: 0.5; }
              }
            `}
          </style>
        </div>
      )}
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
