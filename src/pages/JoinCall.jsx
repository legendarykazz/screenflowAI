import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  ScreenSharePresets,
  Track,
  VideoPresets
} from 'livekit-client';
import { Camera, Expand, Eye, EyeOff, Hand, Heart, Laugh, Mic, PhoneOff, Play, ScreenShare, Smile, Sparkles, SquarePen, ThumbsUp, Users, Video, Volume2 } from 'lucide-react';
import {
  CALL_AUDIO_CAPTURE_OPTIONS,
  CALL_AUDIO_PUBLISH_OPTIONS,
  prepareCallAudioTrack,
  resumeCallAudio
} from '../lib/callAudio';
import WatchTogetherPlayer from '../components/WatchTogetherPlayer';
import { createCallRoomOptions } from '../lib/callRoom';
import { getParticipantLayout } from '../lib/callLayout';
import { normalizeWatchSession } from '../lib/watchTogether';

export default function JoinCall() {
  const roomRef = useRef(null);
  const mediaRef = useRef(null);
  const cameraRef = useRef(null);
  const localCameraRef = useRef(null);
  const presentationRef = useRef(null);
  const localCameraStreamRef = useRef(null);
  const localMicStreamRef = useRef(null);
  const publishedCameraTrackRef = useRef(null);
  const publishedMicTrackRef = useRef(null);
  const publishedScreenTrackRef = useRef(null);
  const whiteboardCanvasRef = useRef(null);
  const whiteboardAnimationRef = useRef(null);
  const audioRef = useRef(null);
  const micOnRef = useRef(false);
  const cameraOnRef = useRef(false);
  const screenOnRef = useRef(false);
  const localIdentityRef = useRef('');
  const activeVideoSidRef = useRef(null);
  const activeCameraSidRef = useRef(null);
  const joinAttemptRef = useRef(0);
  const joinPendingRef = useRef(false);
  const roomCode = useMemo(() => {
    const match = window.location.pathname.match(/\/join\/([^/]+)/i);
    return (match?.[1] || '').toUpperCase();
  }, []);
  const previewFaceCount = useMemo(() => {
    if (!import.meta.env.DEV) return 0;
    const requested = Number(new URLSearchParams(window.location.search).get('previewFaces'));
    return Number.isFinite(requested) ? Math.max(0, Math.min(8, Math.floor(requested))) : 0;
  }, []);
  const previewParticipantNames = useMemo(
    () => ['Maya', 'Jordan', 'Sam', 'Taylor', 'Chris', 'Avery', 'Morgan'].slice(0, Math.max(0, previewFaceCount - 1)),
    [previewFaceCount]
  );
  const previewUnsupportedMobileShare = useMemo(
    () => import.meta.env.DEV && new URLSearchParams(window.location.search).get('previewMobileShare') === 'unsupported',
    []
  );
  const previewWatchSession = useMemo(() => {
    const previewWatch = new URLSearchParams(window.location.search).get('previewWatch');
    if (!import.meta.env.DEV || !previewWatch) return null;
    if (previewWatch === 'web') {
      return normalizeWatchSession({
        kind: 'web',
        label: 'Example website',
        revision: 1,
        sessionId: 'preview-web',
        updatedAt: Date.now(),
        url: 'https://example.com'
      });
    }
    if (previewWatch !== 'youtube') return null;
    return normalizeWatchSession({
      currentTime: 0,
      kind: 'youtube',
      playing: false,
      sessionId: 'preview-youtube',
      updatedAt: Date.now(),
      url: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
      videoId: 'M7lc1UVf-VE'
    });
  }, []);
  const isMobileBrowser = useMemo(
    () => previewUnsupportedMobileShare || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
    [previewUnsupportedMobileShare]
  );
  const supportsBrowserScreenShare = () => !previewUnsupportedMobileShare && typeof navigator.mediaDevices?.getDisplayMedia === 'function';

  const [name, setName] = useState(previewFaceCount || previewWatchSession ? 'Alex' : '');
  const [status, setStatus] = useState(previewFaceCount || previewWatchSession ? 'Mobile call layout preview' : 'Ready to join');
  const [connected, setConnected] = useState(previewFaceCount > 0 || Boolean(previewWatchSession));
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [hasHostScreen, setHasHostScreen] = useState(false);
  const [participants, setParticipants] = useState(previewParticipantNames);
  const [fatalError, setFatalError] = useState('');
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState(false);
  const [screenShareNotice, setScreenShareNotice] = useState('');
  const [watchSession, setWatchSession] = useState(previewWatchSession);
  const [joining, setJoining] = useState(false);
  const [showSelfView, setShowSelfView] = useState(true);
  const [reactionMenuOpen, setReactionMenuOpen] = useState(false);
  const [stageReactions, setStageReactions] = useState([]);
  const [handRaised, setHandRaised] = useState(false);

  useEffect(() => {
    if (localCameraRef.current) {
      localCameraRef.current.srcObject = cameraOn ? localCameraStreamRef.current : null;
    }
  }, [cameraOn, showSelfView]);

  useEffect(() => {
    micOnRef.current = micOn;
  }, [micOn]);

  useEffect(() => {
    cameraOnRef.current = cameraOn;
  }, [cameraOn]);

  useEffect(() => {
    screenOnRef.current = screenOn;
  }, [screenOn]);

  useEffect(() => {
    const handleError = (event) => {
      setFatalError(getErrorMessage(event.error || event, 'The call page hit an unexpected error.'));
    };
    const handleRejection = (event) => {
      setFatalError(getErrorMessage(event.reason || event, 'The call page hit an unexpected error.'));
    };
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  useEffect(() => () => {
    joinAttemptRef.current += 1;
    joinPendingRef.current = false;
    const room = roomRef.current;
    roomRef.current = null;
    try {
      room?.disconnect();
    } catch (error) {
      console.warn('Could not disconnect the call during page cleanup:', error);
    }

    if (whiteboardAnimationRef.current) cancelAnimationFrame(whiteboardAnimationRef.current);
    whiteboardAnimationRef.current = null;
    publishedScreenTrackRef.current?.stop?.();
    publishedScreenTrackRef.current = null;
    [localCameraStreamRef.current, localMicStreamRef.current].forEach((stream) => {
      stream?.getTracks?.().forEach((track) => track.stop());
    });
    localCameraStreamRef.current = null;
    localMicStreamRef.current = null;
    publishedCameraTrackRef.current = null;
    publishedMicTrackRef.current = null;
    if (localCameraRef.current) localCameraRef.current.srcObject = null;
  }, []);

  const joinRoom = async () => {
    if (joinPendingRef.current) return;
    let room = null;
    let attemptId = 0;
    try {
      const participantName = name.trim();
      if (!participantName) {
        setStatus('Enter your name before joining.');
        return;
      }
      attemptId = ++joinAttemptRef.current;
      if (roomRef.current) {
        safeDisconnectRoom(roomRef.current);
        roomRef.current = null;
      }
      resetCallState('Ready to reconnect');
      joinPendingRef.current = true;
      setJoining(true);
      room = new Room(createCallRoomOptions());
      roomRef.current = room;
      resumeCallAudio(room)
        .then((canPlay) => setAudioPlaybackBlocked(!canPlay))
        .catch(() => setAudioPlaybackBlocked(true));

      setStatus('Getting access token...');
      const response = await fetch('/api/livekit-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode, participantName, role: 'participant' }),
        signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(10_000) : undefined
      });
      const text = await response.text();
      let result = {};
      try {
        result = text ? JSON.parse(text) : {};
      } catch (error) {
        throw new Error(`Token endpoint returned an invalid response (${response.status}).`);
      }
      if (!response.ok) throw new Error(result.error || 'Unable to get LiveKit token.');
      if (joinAttemptRef.current !== attemptId || roomRef.current !== room) {
        safeDisconnectRoom(room);
        return;
      }

      setStatus('Connecting...');

      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (roomRef.current !== room) return;
        try {
          attachTrack(track, participant);
          updateParticipants(room);
        } catch (error) {
          setStatus(error.message || 'Could not attach participant media.');
        }
      });
      room.on(RoomEvent.DataReceived, (payload, participant) => {
        if (roomRef.current !== room) return;
        handleRoomCommand(payload, participant);
      });
      room.on(RoomEvent.AudioPlaybackStatusChanged, (canPlay) => {
        if (roomRef.current !== room) return;
        setAudioPlaybackBlocked(!canPlay);
      });

      room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        if (roomRef.current !== room) return;
        try {
          detachTrackElements(track).forEach((element) => {
            const tile = element.closest?.('[data-face-tile="true"]');
            element.remove();
            if (tile) ensureParticipantTile(participant);
          });
        } catch (error) {
          setStatus(getErrorMessage(error, 'Could not clean up participant media.'));
        }
        if (activeVideoSidRef.current === track.sid) activeVideoSidRef.current = null;
        if (activeCameraSidRef.current === track.sid) activeCameraSidRef.current = null;
        if (activeVideoSidRef.current === null && !mediaRef.current?.querySelector('video')) clearHostScreen();
      });

      room.on(RoomEvent.ParticipantConnected, () => {
        if (roomRef.current !== room) return;
        try {
          updateParticipants(room);
        } catch (error) {
          setStatus(error.message || 'Could not update participants.');
        }
      });
      room.on(RoomEvent.ParticipantDisconnected, (participant) => {
        if (roomRef.current !== room) return;
        try {
          removeParticipantTile(participant?.identity);
          updateParticipants(room);
        } catch (error) {
          setStatus(error.message || 'Could not update participants.');
        }
      });
      room.on(RoomEvent.Disconnected, () => {
        if (roomRef.current !== room) return;
        resetCallState('Disconnected');
      });

      await room.connect(result.url, result.token);
      if (joinAttemptRef.current !== attemptId || roomRef.current !== room) {
        safeDisconnectRoom(room);
        return;
      }
      localIdentityRef.current = result.identity || room.localParticipant?.identity || '';
      setConnected(true);
      setAudioPlaybackBlocked(!room.canPlaybackAudio);
      setStatus('Connected. Waiting for presenter output if nothing is visible yet.');
      attachExistingTracks(room);
      updateParticipants(room);
    } catch (error) {
      safeDisconnectRoom(room);
      if (joinAttemptRef.current === attemptId) {
        if (roomRef.current === room) roomRef.current = null;
        setConnected(false);
        setStatus(getErrorMessage(error, 'Could not join the call.'));
      }
    } finally {
      if (joinAttemptRef.current === attemptId) {
        joinPendingRef.current = false;
        setJoining(false);
      }
    }
  };

  const leaveRoom = () => {
    joinAttemptRef.current += 1;
    joinPendingRef.current = false;
    setJoining(false);
    safeDisconnectRoom(roomRef.current);
    roomRef.current = null;
    resetCallState('Disconnected');
  };

  const enableCallAudio = async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await resumeCallAudio(room);
      setAudioPlaybackBlocked(false);
      setStatus('Call audio is on.');
    } catch (error) {
      setAudioPlaybackBlocked(true);
      setStatus('Your browser blocked call audio. Tap Enable sound again.');
    }
  };

  const addStageReaction = (emoji, reactionName = name || 'Guest') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setStageReactions((current) => [...current.slice(-4), { emoji, id, name: reactionName }]);
    window.setTimeout(() => {
      setStageReactions((current) => current.filter((reaction) => reaction.id !== id));
    }, 4200);
  };

  const sendRoomEvent = async (type, details) => {
    const room = roomRef.current;
    if (!room) return;
    const payload = new TextEncoder().encode(JSON.stringify({ type, ...details }));
    await room.localParticipant.publishData(payload, { reliable: true });
  };

  const sendReaction = async (emoji) => {
    addStageReaction(emoji);
    setReactionMenuOpen(false);
    try {
      await sendRoomEvent('reaction', { emoji, name: name || 'Guest' });
    } catch (error) {
      setStatus('Your reaction could not be sent.');
    }
  };

  const toggleRaisedHand = async () => {
    const nextRaised = !handRaised;
    setHandRaised(nextRaised);
    try {
      await sendRoomEvent('raise-hand', {
        identity: localIdentityRef.current,
        name: name || 'Guest',
        raised: nextRaised
      });
    } catch (error) {
      setHandRaised(!nextRaised);
      setStatus('Your hand status could not be sent.');
    }
  };

  const resetCallState = (nextStatus) => {
    joinPendingRef.current = false;
    setJoining(false);
    setConnected(false);
    setStatus(nextStatus);
    setParticipants([]);
    localIdentityRef.current = '';
    setCameraOn(false);
    setMicOn(false);
    setScreenOn(false);
    setHasHostScreen(false);
    setAudioPlaybackBlocked(false);
    setScreenShareNotice('');
    setWatchSession(null);
    setReactionMenuOpen(false);
    setStageReactions([]);
    setHandRaised(false);
    activeVideoSidRef.current = null;
    activeCameraSidRef.current = null;
    publishedCameraTrackRef.current = null;
    publishedMicTrackRef.current = null;
    publishedScreenTrackRef.current = null;
    stopMediaStream(localCameraStreamRef.current);
    stopMediaStream(localMicStreamRef.current);
    localCameraStreamRef.current = null;
    localMicStreamRef.current = null;
    if (localCameraRef.current) localCameraRef.current.srcObject = null;
    clearNode(audioRef.current);
    stopGuestWhiteboard();
    mediaRef.current?.querySelectorAll('[data-track-sid]').forEach((element) => element.remove());
    cameraRef.current?.querySelectorAll('[data-face-tile="true"]').forEach((element) => element.remove());
    setTrackPlaceholderVisible(mediaRef.current, true);
    setTrackPlaceholderVisible(cameraRef.current, true);
  };

  const toggleMic = async () => {
    const room = roomRef.current;
    if (!room) return;

    if (micOnRef.current) {
      await safeUnpublishTrack(room, publishedMicTrackRef.current);
      localMicStreamRef.current?.getTracks().forEach((track) => track.stop());
      localMicStreamRef.current = null;
      publishedMicTrackRef.current = null;
      setMicOn(false);
      setStatus('Microphone is muted.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: CALL_AUDIO_CAPTURE_OPTIONS
      });
      const audioTrack = prepareCallAudioTrack(stream.getAudioTracks()[0]);
      localMicStreamRef.current = stream;
      publishedMicTrackRef.current = audioTrack;
      await room.localParticipant.publishTrack(audioTrack, {
        name: 'participant-mic',
        source: Track.Source.Microphone,
        ...CALL_AUDIO_PUBLISH_OPTIONS
      });
      await resumeCallAudio(room).catch(() => {});
      setAudioPlaybackBlocked(!room.canPlaybackAudio);
      setMicOn(true);
      setStatus('Microphone is on.');
    } catch (error) {
      localMicStreamRef.current?.getTracks().forEach((track) => track.stop());
      localMicStreamRef.current = null;
      publishedMicTrackRef.current = null;
      setMicOn(false);
      setStatus(getErrorMessage(error, 'Microphone permission was not granted.'));
    }
  };

  const toggleCamera = async () => {
    const room = roomRef.current;
    if (!room) return;

    if (cameraOnRef.current) {
      await safeUnpublishTrack(room, publishedCameraTrackRef.current);
      localCameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      localCameraStreamRef.current = null;
      publishedCameraTrackRef.current = null;
      if (localCameraRef.current) localCameraRef.current.srcObject = null;
      setCameraOn(false);
      setStatus('Camera is off.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30, max: 30 },
          aspectRatio: { ideal: 16 / 9 }
        },
        audio: false
      });
      const cameraTrack = stream.getVideoTracks()[0];
      cameraTrack.contentHint = 'motion';
      localCameraStreamRef.current = stream;
      publishedCameraTrackRef.current = cameraTrack;
      if (localCameraRef.current) localCameraRef.current.srcObject = stream;
      await room.localParticipant.publishTrack(cameraTrack, {
        name: 'participant-camera',
        source: Track.Source.Camera,
        simulcast: true,
        videoSimulcastLayers: [
          VideoPresets.h180,
          VideoPresets.h360
        ],
        videoEncoding: {
          maxBitrate: 2_500_000,
          maxFramerate: 30,
          priority: 'high'
        }
      });
      setCameraOn(true);
      setStatus('Camera is on.');
    } catch (error) {
      setStatus(getErrorMessage(error, 'Camera permission was not granted.'));
    }
  };

  const toggleScreenShare = async () => {
    const room = roomRef.current;

    if (!supportsBrowserScreenShare()) {
      const message = isMobileBrowser
        ? 'This phone browser cannot capture other apps or your whole phone screen. Google Meet and WhatsApp use native Android or iPhone screen-capture permission. Use the whiteboard here, or join from the ScreenFlow desktop app until the native mobile app is available.'
        : 'This browser cannot capture your screen. Open the call in current Chrome, Edge, Firefox, or desktop Safari.';
      setScreenShareNotice(message);
      setStatus('Screen sharing is unavailable on this device.');
      return;
    }

    if (!room) return;

    if (screenOnRef.current) {
      await stopPublishingScreen(room);
      setStatus('Screen sharing stopped.');
      return;
    }

    try {
      setScreenShareNotice('');
      const stream = await navigator.mediaDevices.getDisplayMedia(isMobileBrowser
        ? { video: true, audio: false }
        : {
            video: {
              displaySurface: 'monitor',
              frameRate: { ideal: 30, max: 30 },
              height: { ideal: 1080 },
              width: { ideal: 1920 }
            },
            audio: false
          });
      const screenTrack = stream.getVideoTracks()[0];
      screenTrack.contentHint = 'text';
      screenTrack.onended = () => {
        publishedScreenTrackRef.current = null;
        setScreenOn(false);
      };
      publishedScreenTrackRef.current = screenTrack;
      await room.localParticipant.publishTrack(screenTrack, {
        name: 'participant-screen',
        source: Track.Source.ScreenShare,
        simulcast: true,
        screenShareSimulcastLayers: [
          ScreenSharePresets.h360fps15,
          ScreenSharePresets.h720fps15
        ],
        videoEncoding: {
          maxBitrate: 5_000_000,
          maxFramerate: 30,
          priority: 'high'
        }
      });
      setScreenOn(true);
      setStatus('Sharing your screen.');
    } catch (error) {
      const message = describeScreenShareError(error, isMobileBrowser);
      setScreenShareNotice(message);
      setStatus(message);
    }
  };

  const toggleWhiteboard = async () => {
    const room = roomRef.current;
    if (!room) return;

    if (screenOnRef.current) {
      await stopPublishingScreen(room);
      setStatus('Whiteboard sharing stopped.');
      return;
    }

    try {
      const canvas = whiteboardCanvasRef.current;
      if (!canvas?.captureStream) {
        setStatus('Whiteboard sharing is not available in this browser.');
        return;
      }
      canvas.width = 1920;
      canvas.height = 1080;
      renderGuestWhiteboard();
      const stream = canvas.captureStream(30);
      const whiteboardTrack = stream.getVideoTracks()[0];
      whiteboardTrack.contentHint = 'text';
      whiteboardTrack.onended = () => {
        stopGuestWhiteboard();
        publishedScreenTrackRef.current = null;
        setScreenOn(false);
      };
      publishedScreenTrackRef.current = whiteboardTrack;
      await room.localParticipant.publishTrack(whiteboardTrack, {
        name: 'participant-whiteboard',
        source: Track.Source.ScreenShare,
        simulcast: true,
        screenShareSimulcastLayers: [
          ScreenSharePresets.h360fps15,
          ScreenSharePresets.h720fps15
        ],
        videoEncoding: {
          maxBitrate: 5_000_000,
          maxFramerate: 30,
          priority: 'high'
        }
      });
      setScreenOn(true);
      setStatus('Sharing your whiteboard.');
    } catch (error) {
      setStatus(getErrorMessage(error, 'Could not share whiteboard.'));
    }
  };

  const stopPublishingScreen = async (room = roomRef.current) => {
    await safeUnpublishTrack(room, publishedScreenTrackRef.current);
    publishedScreenTrackRef.current?.stop?.();
    publishedScreenTrackRef.current = null;
    stopGuestWhiteboard();
    setScreenOn(false);
  };

  const renderGuestWhiteboard = () => {
    const canvas = whiteboardCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#111827';
    ctx.font = '700 34px Inter, system-ui, sans-serif';
    ctx.fillText(`${name || 'Guest'} whiteboard`, 48, 72);
    whiteboardAnimationRef.current = requestAnimationFrame(renderGuestWhiteboard);
  };

  const stopGuestWhiteboard = () => {
    if (whiteboardAnimationRef.current) cancelAnimationFrame(whiteboardAnimationRef.current);
    whiteboardAnimationRef.current = null;
  };

  const handleRoomCommand = async (payload) => {
    try {
      const command = JSON.parse(new TextDecoder().decode(payload));
      if (!command?.type) return;
      if (command.targetIdentity && command.targetIdentity !== localIdentityRef.current) return;
      if (command.type === 'room-ended') {
        setStatus('Host ended the call.');
        safeDisconnectRoom(roomRef.current);
      }
      if (command.type === 'reaction' && command.emoji) {
        addStageReaction(command.emoji, command.name || participant?.name || participant?.identity || 'Guest');
      }
      if (command.type === 'share-stopped') {
        clearHostScreen();
        setWatchSession(null);
        setStatus('Host closed the shared screen.');
      }
      if (command.type === 'watch-sync') {
        const nextWatchSession = normalizeWatchSession(command.watch);
        if (nextWatchSession) {
          setWatchSession((current) => {
            if (
              current?.sessionId === nextWatchSession.sessionId
              && Number(nextWatchSession.revision || 0) < Number(current.revision || 0)
            ) return current;
            return nextWatchSession;
          });
          setStatus(`${nextWatchSession.label} is synced with the host.`);
        }
      }
      if (command.type === 'watch-close') {
        setWatchSession(null);
        setStatus('Host closed Watch Together.');
      }
      if (command.type === 'mute') {
        if (micOnRef.current || publishedMicTrackRef.current) await toggleMic();
        setStatus('Host muted your microphone.');
      }
      if (command.type === 'unmute') {
        if (!micOnRef.current && !publishedMicTrackRef.current) await toggleMic();
        setStatus('Host requested your microphone.');
      }
      if (command.type === 'camera-off') {
        if (cameraOnRef.current || publishedCameraTrackRef.current) await toggleCamera();
        setStatus('Host turned your camera off.');
      }
      if (command.type === 'camera-on-request') {
        if (!cameraOnRef.current && !publishedCameraTrackRef.current) await toggleCamera();
        setStatus('Host requested your camera.');
      }
    } catch (error) {
      setStatus(getErrorMessage(error, 'Could not apply host command.'));
    }
  };

  const updateParticipants = (room = roomRef.current) => {
    if (!room) return;
    const remoteParticipants = getRemoteParticipants(room);
    const nextParticipants = remoteParticipants.map((participant) => participant.name || participant.identity);
    setParticipants((current) => (
      current.length === nextParticipants.length && current.every((name, index) => name === nextParticipants[index])
        ? current
        : nextParticipants
    ));
    remoteParticipants.forEach((participant) => ensureParticipantTile(participant));
    setTrackPlaceholderVisible(cameraRef.current, remoteParticipants.length === 0);
  };

  const clearHostScreen = () => {
    activeVideoSidRef.current = null;
    setHasHostScreen(false);
    mediaRef.current?.querySelectorAll('[data-track-sid]').forEach((element) => element.remove());
    const existingPlaceholder = mediaRef.current?.querySelector('[data-placeholder="true"]');
    if (existingPlaceholder) {
      existingPlaceholder.style.display = '';
      existingPlaceholder.textContent = 'No host screen yet.';
    } else if (mediaRef.current) {
      const placeholder = document.createElement('span');
      placeholder.dataset.placeholder = 'true';
      placeholder.textContent = 'No host screen yet.';
      mediaRef.current.appendChild(placeholder);
    }
  };

  const attachExistingTracks = (room) => {
    getRemoteParticipants(room).forEach((participant) => {
      participant.trackPublications.forEach((publication) => {
        if (publication.track) {
          attachTrack(publication.track, participant);
        }
      });
    });
  };

  const getRemoteParticipants = (room) => {
    const remotes = room?.remoteParticipants;
    if (!remotes) return [];
    if (typeof remotes.values === 'function') return Array.from(remotes.values());
    if (Array.isArray(remotes)) return remotes;
    return Object.values(remotes);
  };

  const getErrorMessage = (error, fallback) => {
    if (!error) return fallback;
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    if (error.reason?.message) return error.reason.message;
    if (error.type) return `${fallback} (${error.type})`;
    return fallback;
  };

  const describeScreenShareError = (error, mobileBrowser) => {
    if (error?.name === 'NotAllowedError') {
      return 'Screen sharing was cancelled or blocked. Tap Share again and allow screen capture when the browser asks.';
    }
    if (mobileBrowser && ['NotSupportedError', 'TypeError'].includes(error?.name)) {
      return 'This phone browser cannot capture the phone screen. Full mobile sharing requires the native ScreenFlow app.';
    }
    return getErrorMessage(error, 'Screen share permission was not granted.');
  };

  const attachTrack = (track, participant) => {
    if (track.kind !== 'audio' && !mediaRef.current) return;
    const isScreen = track.kind === 'video' && (track.name?.includes('screen') || track.source === Track.Source.ScreenShare);
    const isCamera = track.kind === 'video' && !isScreen;
    const targetRef = track.kind === 'audio' ? audioRef : isCamera ? cameraRef : mediaRef;
    if (!targetRef.current) return;
    if (targetRef.current.querySelector(`[data-track-sid="${track.sid}"]`)) return;

    const element = track.attach();
    element.autoplay = true;
    element.playsInline = true;
    element.controls = false;
    element.style.width = '100%';
    element.style.height = '100%';
    element.style.maxHeight = 'none';
    element.style.borderRadius = '8px';
    element.style.background = '#090B12';
    element.style.marginTop = '0';
    element.style.objectFit = isCamera ? 'cover' : 'contain';
    element.style.transform = 'none';
    if (track.kind === 'audio') {
      element.controls = false;
      element.muted = false;
      element.volume = 1;
      element.style.display = 'none';
    }

    element.dataset.trackSid = track.sid;
    setTrackPlaceholderVisible(targetRef.current, false);

    if (track.kind === 'video') {
      if (isCamera) activeCameraSidRef.current = track.sid;
      else {
        activeVideoSidRef.current = track.sid;
        setHasHostScreen(true);
        Array.from(targetRef.current.querySelectorAll('video')).forEach((video) => {
          video.remove();
        });
      }
      element.muted = false;
    }

    if (track.kind === 'audio') {
      targetRef.current.appendChild(element);
      element.play?.()
        .then(() => setAudioPlaybackBlocked(false))
        .catch(() => {
          setAudioPlaybackBlocked(true);
          setStatus('Connected. Enable sound to hear the call.');
        });
      return;
    }

    if (isCamera) {
      const tile = ensureParticipantTile(participant);
      if (!tile) {
        element.remove?.();
        return;
      }
      tile.querySelector('[data-empty-participant="true"]')?.remove();
      Array.from(tile.querySelectorAll('video')).forEach((video) => video.remove());
      tile.dataset.trackSid = track.sid;
      tile.appendChild(element);
      return;
    }

    targetRef.current.appendChild(element);
  };

  const ensureParticipantTile = (participant) => {
    if (!cameraRef.current) return null;
    const participantId = participant?.identity || participant?.sid || 'remote';
    let tile = Array.from(cameraRef.current?.querySelectorAll('[data-face-tile="true"]') || [])
      .find((item) => item.dataset.participantId === participantId);
    if (tile) {
      ensureParticipantTilePlaceholder(tile, participant);
      return tile;
    }

    tile = document.createElement('div');
    tile.dataset.participantId = participantId;
    tile.dataset.faceTile = 'true';
    tile.style.aspectRatio = '16 / 9';
    tile.style.background = '#050505';
    tile.style.border = '1px solid #2A2A2A';
    tile.style.borderRadius = '8px';
    tile.style.overflow = 'hidden';
    tile.style.position = 'relative';
    ensureParticipantTilePlaceholder(tile, participant);

    const label = document.createElement('span');
    label.textContent = participant?.name || participant?.identity || 'Guest';
    label.style.background = 'rgba(0,0,0,0.7)';
    label.style.borderRadius = '999px';
    label.style.bottom = '8px';
    label.style.color = '#FFFFFF';
    label.style.fontSize = '12px';
    label.style.fontWeight = '900';
    label.style.left = '8px';
    label.style.padding = '5px 8px';
    label.style.position = 'absolute';
    tile.appendChild(label);

    cameraRef.current?.appendChild(tile);
    return tile;
  };

  const ensureParticipantTilePlaceholder = (tile, participant) => {
    if (!tile || tile.querySelector('video') || tile.querySelector('[data-empty-participant="true"]')) return;
    const participantId = participant?.identity || tile.dataset.participantId || 'Guest';
    const empty = document.createElement('div');
    empty.dataset.emptyParticipant = 'true';
    empty.style.alignItems = 'center';
    empty.style.color = '#D4D4D4';
    empty.style.display = 'flex';
    empty.style.flexDirection = 'column';
    empty.style.fontSize = '13px';
    empty.style.fontWeight = '900';
    empty.style.gap = '8px';
    empty.style.height = '100%';
    empty.style.justifyContent = 'center';
    empty.style.padding = '12px';
    empty.style.textAlign = 'center';
    const initial = document.createElement('strong');
    initial.textContent = (participant?.name || participantId).slice(0, 1).toUpperCase();
    initial.style.alignItems = 'center';
    initial.style.background = '#1D4ED8';
    initial.style.borderRadius = '999px';
    initial.style.color = '#FFFFFF';
    initial.style.display = 'flex';
    initial.style.fontSize = '18px';
    initial.style.height = '40px';
    initial.style.justifyContent = 'center';
    initial.style.width = '40px';
    const emptyText = document.createElement('span');
    emptyText.textContent = 'Camera is off';
    empty.appendChild(initial);
    empty.appendChild(emptyText);
    tile.appendChild(empty);
  };

  const removeParticipantTile = (participantId) => {
    if (!participantId) return;
    Array.from(cameraRef.current?.querySelectorAll('[data-face-tile="true"]') || [])
      .find((tile) => tile.dataset.participantId === participantId)
      ?.remove();
  };

  const detachTrackElements = (track) => {
    if (!track || typeof track.detach !== 'function') return [];
    try {
      const detached = track.detach();
      return Array.isArray(detached) ? detached : [];
    } catch (error) {
      return [];
    }
  };

  const setTrackPlaceholderVisible = (node, visible) => {
    node?.querySelectorAll?.('[data-placeholder="true"]').forEach((element) => {
      element.style.display = visible ? '' : 'none';
    });
  };

  const safeDisconnectRoom = (room) => {
    if (!room) return;
    try {
      room.disconnect();
    } catch (error) {
      console.warn('Ignoring stale LiveKit disconnect error:', error);
    }
  };

  const safeUnpublishTrack = async (room, track) => {
    if (!room || !track) return;
    try {
      await room.localParticipant?.unpublishTrack?.(track);
    } catch (error) {
      console.warn('Ignoring stale LiveKit unpublish error:', error);
    }
  };

  const stopMediaStream = (stream) => {
    stream?.getTracks?.().forEach((track) => {
      try {
        track.stop();
      } catch (error) {}
    });
  };

  const clearNode = (node) => {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  };

  const showSyncedWatchPlayer = Boolean(watchSession) && !(watchSession.kind === 'web' && hasHostScreen);
  const hasPresentation = hasHostScreen || showSyncedWatchPlayer;

  return (
    <div data-join-call-root="true" style={pageStyle}>
      <style>{responsiveStyles}</style>
      <main data-call-panel="true" data-connected={connected ? 'true' : 'false'} style={panelStyle}>
        {fatalError && (
          <section style={fatalErrorStyle}>
            <strong>Call page error</strong>
            <span>{fatalError}</span>
          </section>
        )}
        <div style={topBarStyle}>
          <div>
            <div style={brandStyle}>ScreenFlow AI</div>
            <h1 style={titleStyle}>Conference Call</h1>
          </div>
          <span style={roomPillStyle}>{roomCode}</span>
        </div>

        {!connected && (
          <section data-prejoin="true" style={prejoinStyle}>
            <label style={labelStyle}>
              Your name
              <input value={name} onChange={(event) => setName(event.target.value)} required placeholder="Enter your name" style={inputStyle} />
            </label>
            <button disabled={joining || !roomCode || !name.trim()} onClick={joinRoom} style={primaryButtonStyle}>
              <Play size={17} /> {joining ? 'Joining...' : 'Join Call'}
            </button>
          </section>
        )}

        <p data-call-status="true" style={statusStyle}>{status}</p>
        {screenShareNotice && (
          <section data-screen-share-notice="true" style={screenShareNoticeStyle}>
            <strong>Screen sharing</strong>
            <span>{screenShareNotice}</span>
          </section>
        )}
        {connected && audioPlaybackBlocked && (
          <button onClick={enableCallAudio} style={{ ...primaryButtonStyle, marginBottom: '10px', width: '100%' }}>
            <Volume2 size={17} /> Enable sound
          </button>
        )}
        <div ref={audioRef} aria-hidden="true" style={audioSinkStyle} />
        <canvas ref={whiteboardCanvasRef} aria-hidden="true" style={hiddenCanvasStyle} />

        <div
          data-call-content="true"
          data-has-presentation={hasPresentation ? 'true' : 'false'}
          style={{ display: connected ? 'grid' : 'none', gap: '10px' }}
        >
          {stageReactions.length > 0 && (
            <div aria-live="polite" style={reactionTrayStyle}>
              {stageReactions.map((reaction) => (
                <span key={reaction.id} style={reactionBubbleStyle} title={reaction.name}>
                  <span aria-hidden="true">{reaction.emoji}</span><small>{reaction.name}</small>
                </span>
              ))}
            </div>
          )}
          <section className="viewer-section" ref={presentationRef} style={{ ...viewerStyle, display: hasPresentation ? 'block' : 'none' }}>
            <div style={viewerHeaderStyle}>
              <span style={viewerTitleStyle}><Video size={18} /> {showSyncedWatchPlayer ? 'Watch Together' : 'Presentation'}</span>
              <button
                aria-label="Fullscreen presentation"
                onClick={() => presentationRef.current?.requestFullscreen?.()}
                style={viewerHeaderButtonStyle}
              >
                <Expand size={16} />
              </button>
            </div>
            <div className="media-box" ref={mediaRef} style={{ ...mediaBoxStyle, display: showSyncedWatchPlayer ? 'none' : 'flex' }}>
              <span data-placeholder="true">No presentation yet.</span>
            </div>
            {showSyncedWatchPlayer && (
              <WatchTogetherPlayer
                onPlayerError={(message) => setStatus(message)}
                session={watchSession}
              />
            )}
          </section>

          <section data-people-section="true" style={viewerStyle}>
            <div style={viewerHeaderStyle}>
              <span style={viewerTitleStyle}><Camera size={18} /> People</span>
              <div style={peopleHeaderActionsStyle}>
                <button
                  aria-label={showSelfView ? 'Hide self view' : 'Show self view'}
                  onClick={() => setShowSelfView((visible) => !visible)}
                  style={viewerHeaderButtonStyle}
                  title={showSelfView ? 'Hide self view' : 'Show self view'}
                >
                  {showSelfView ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <span style={peopleCountStyle}>{participants.length + 1}</span>
              </div>
            </div>
            <div
              className="camera-box"
              data-face-count={participants.length}
              data-face-layout={getParticipantLayout(participants.length)}
              ref={cameraRef}
              style={cameraBoxStyle}
            >
              {showSelfView && (
                <div data-local-face="true" data-self-view="true" style={selfPreviewStyle}>
                  <video ref={localCameraRef} autoPlay muted playsInline style={{ ...localCameraStyle, display: cameraOn ? 'block' : 'none' }} />
                  {!cameraOn && <div style={faceOffStyle}>Camera off</div>}
                  <span style={faceLabelStyle}>You</span>
                </div>
              )}
              {previewParticipantNames.map((participant) => (
                <div data-face-tile="true" data-participant-id={`preview-${participant}`} key={participant} style={localFaceTileStyle}>
                  <div style={faceOffStyle}>{participant.slice(0, 1)}</div>
                  <span style={faceLabelStyle}>{participant}</span>
                </div>
              ))}
              {previewFaceCount === 0 && <span data-placeholder="true">Waiting for other cameras.</span>}
            </div>
          </section>

          <section data-participants-summary="true" style={participantsStyle}>
            <h2 style={sectionTitleStyle}><Users size={17} /> {participants.length + 1} in call</h2>
            <p style={mutedStyle}>{participants.length ? participants.join(', ') : 'Waiting for others to join.'}</p>
          </section>
        </div>

        {connected && (
          <div data-call-control-dock="true" style={callControlDockStyle}>
            <button aria-label={micOn ? 'Mute microphone' : 'Turn microphone on'} onClick={toggleMic} style={controlButtonStyle(micOn)}>
              <Mic size={18} /><span>{micOn ? 'Mute' : 'Mic'}</span>
            </button>
            <button aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'} onClick={toggleCamera} style={controlButtonStyle(cameraOn)}>
              <Camera size={18} /><span>{cameraOn ? 'Camera Off' : 'Camera'}</span>
            </button>
            <button aria-label={screenOn ? 'Stop sharing' : 'Share screen'} onClick={toggleScreenShare} style={controlButtonStyle(screenOn)}>
              <ScreenShare size={18} /><span>{screenOn ? 'Stop Share' : 'Share'}</span>
            </button>
            <button aria-label={screenOn ? 'Stop whiteboard' : 'Share whiteboard'} onClick={toggleWhiteboard} style={controlButtonStyle(screenOn)}>
              <SquarePen size={18} /><span>{screenOn ? 'Stop Board' : 'Board'}</span>
            </button>
            <button aria-label={handRaised ? 'Lower hand' : 'Raise hand'} onClick={toggleRaisedHand} style={controlButtonStyle(handRaised)}>
              <Hand size={18} /><span>{handRaised ? 'Lower Hand' : 'Raise Hand'}</span>
            </button>
            <div style={reactionControlWrapStyle}>
              <button aria-label="Send a reaction" onClick={() => setReactionMenuOpen((open) => !open)} style={controlButtonStyle(reactionMenuOpen)}>
                <Smile size={18} /><span>React</span>
              </button>
              {reactionMenuOpen && (
                <div style={reactionMenuStyle}>
                  {[['👍', ThumbsUp], ['❤️', Heart], ['😂', Laugh], ['👏', Sparkles]].map(([emoji, Icon]) => (
                    <button key={emoji} onClick={() => sendReaction(emoji)} style={reactionButtonStyle} title={`Send ${emoji}`}>
                      <Icon size={16} /><span>{emoji}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button aria-label="Leave call" onClick={leaveRoom} style={leaveButtonStyle}>
              <PhoneOff size={19} /><span>Leave</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

const pageStyle = {
  alignItems: 'flex-start',
  background: '#000000',
  color: '#F8FAFC',
  display: 'flex',
  fontFamily: 'Inter, system-ui, sans-serif',
  justifyContent: 'center',
  minHeight: '100dvh',
  padding: '18px',
  WebkitTextSizeAdjust: '100%'
};

const panelStyle = {
  background: '#0D0D0D',
  border: '1px solid #242424',
  borderRadius: '8px',
  color: '#FFFFFF',
  maxWidth: '520px',
  padding: '18px',
  width: '100%',
  minHeight: 'auto'
};

const prejoinStyle = {
  display: 'grid',
  gap: '12px'
};

const fatalErrorStyle = {
  background: '#2A0F12',
  border: '1px solid #7F1D1D',
  borderRadius: '8px',
  color: '#FEE2E2',
  display: 'grid',
  fontSize: '13px',
  gap: '6px',
  lineHeight: 1.45,
  marginBottom: '14px',
  padding: '12px'
};

const topBarStyle = {
  alignItems: 'center',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '14px',
  marginBottom: '14px'
};

const brandStyle = {
  color: '#A3A3A3',
  fontSize: '13px',
  fontWeight: 900,
  marginBottom: '4px'
};

const titleStyle = {
  fontSize: '28px',
  fontWeight: 900,
  letterSpacing: 0,
  marginBottom: 0
};

const mutedStyle = {
  color: '#A3A3A3',
  fontSize: '14px',
  lineHeight: 1.45,
  margin: '0 0 16px'
};

const roomPillStyle = {
  background: '#FFFFFF',
  borderRadius: '999px',
  color: '#000000',
  flexShrink: 0,
  fontSize: '12px',
  fontWeight: 900,
  padding: '7px 10px'
};

const labelStyle = {
  color: '#D4D4D4',
  display: 'flex',
  flexDirection: 'column',
  fontSize: '13px',
  fontWeight: 900,
  gap: '8px',
  marginBottom: '14px'
};

const inputStyle = {
  background: '#000000',
  border: '1px solid #333333',
  borderRadius: '8px',
  color: '#FFFFFF',
  fontSize: '16px',
  fontWeight: 800,
  minHeight: '44px',
  outline: 'none',
  padding: '0 12px'
};

const primaryButtonStyle = {
  alignItems: 'center',
  background: '#FFFFFF',
  border: 'none',
  borderRadius: '8px',
  color: '#000000',
  cursor: 'pointer',
  display: 'inline-flex',
  fontWeight: 900,
  gap: '8px',
  justifyContent: 'center',
  minHeight: '48px',
  touchAction: 'manipulation'
};

const secondaryButtonStyle = {
  ...primaryButtonStyle,
  background: '#000000',
  border: '1px solid #333333',
  color: '#FFFFFF'
};

const controlButtonStyle = (active) => ({
  ...secondaryButtonStyle,
  background: active ? '#FFFFFF' : '#000000',
  border: `1px solid ${active ? '#FFFFFF' : '#333333'}`,
  color: active ? '#000000' : '#FFFFFF',
  flexDirection: 'column',
  fontSize: '11px',
  gap: '4px',
  minHeight: '54px',
  padding: '6px'
});

const leaveButtonStyle = {
  ...controlButtonStyle(false),
  background: '#B42318',
  border: '1px solid #B42318'
};

const callControlDockStyle = {
  background: 'rgba(13, 13, 13, 0.96)',
  border: '1px solid #2A2A2A',
  borderRadius: '8px',
  bottom: '10px',
  display: 'grid',
  gap: '8px',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  marginTop: '12px',
  padding: '8px',
  position: 'sticky',
  zIndex: 20
};

const reactionControlWrapStyle = {
  position: 'relative'
};

const reactionMenuStyle = {
  alignItems: 'center',
  background: '#161616',
  border: '1px solid #333333',
  borderRadius: '8px',
  bottom: '62px',
  boxShadow: '0 16px 34px rgba(0, 0, 0, 0.38)',
  display: 'flex',
  gap: '5px',
  padding: '6px',
  position: 'absolute',
  right: 0,
  zIndex: 30
};

const reactionButtonStyle = {
  alignItems: 'center',
  background: '#242424',
  border: '1px solid #3A3A3A',
  borderRadius: '999px',
  color: '#FFFFFF',
  cursor: 'pointer',
  display: 'inline-flex',
  fontSize: '14px',
  gap: '2px',
  height: '34px',
  justifyContent: 'center',
  padding: 0,
  width: '34px'
};

const reactionTrayStyle = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '7px',
  justifyContent: 'center',
  pointerEvents: 'none',
  position: 'relative',
  zIndex: 8
};

const reactionBubbleStyle = {
  alignItems: 'center',
  animation: 'screenflowGuestReaction 4.2s ease both',
  background: '#FFFFFF',
  borderRadius: '999px',
  boxShadow: '0 12px 30px rgba(0, 0, 0, 0.3)',
  color: '#000000',
  display: 'inline-flex',
  fontSize: '18px',
  gap: '6px',
  padding: '6px 10px'
};

const statusStyle = {
  color: '#D4D4D4',
  fontSize: '13px',
  fontWeight: 700,
  lineHeight: 1.45,
  margin: '14px 0'
};

const audioSinkStyle = {
  height: 0,
  overflow: 'hidden',
  width: 0
};

const hiddenCanvasStyle = {
  height: 0,
  opacity: 0,
  pointerEvents: 'none',
  position: 'absolute',
  width: 0
};

const viewerStyle = {
  background: '#050505',
  border: '1px solid #2A2A2A',
  borderRadius: '8px',
  overflow: 'hidden',
  marginTop: 0
};

const viewerHeaderStyle = {
  alignItems: 'center',
  borderBottom: '1px solid #2A2A2A',
  display: 'flex',
  fontSize: '14px',
  fontWeight: 900,
  gap: '8px',
  justifyContent: 'space-between',
  padding: '12px'
};

const peopleHeaderActionsStyle = {
  alignItems: 'center',
  display: 'flex',
  gap: '8px'
};

const viewerTitleStyle = {
  alignItems: 'center',
  display: 'inline-flex',
  gap: '8px'
};

const viewerHeaderButtonStyle = {
  alignItems: 'center',
  background: '#FFFFFF',
  border: 'none',
  borderRadius: '999px',
  color: '#000000',
  cursor: 'pointer',
  display: 'inline-flex',
  height: '32px',
  justifyContent: 'center',
  padding: 0,
  width: '32px'
};

const peopleCountStyle = {
  alignItems: 'center',
  background: '#FFFFFF',
  borderRadius: '999px',
  color: '#000000',
  display: 'inline-flex',
  fontSize: '12px',
  fontWeight: 900,
  height: '28px',
  justifyContent: 'center',
  minWidth: '28px',
  padding: '0 8px'
};

const mediaBoxStyle = {
  alignItems: 'center',
  aspectRatio: '16 / 9',
  background: '#000000',
  color: '#D4D4D4',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  minHeight: 0,
  overflow: 'hidden',
  padding: '10px'
};

const cameraBoxStyle = {
  alignItems: 'center',
  background: '#000000',
  color: '#D4D4D4',
  display: 'grid',
  gap: '10px',
  gridTemplateColumns: 'minmax(0, 1fr)',
  justifyContent: 'stretch',
  minHeight: '220px',
  maxHeight: 'min(72dvh, 760px)',
  overflow: 'auto',
  padding: '12px',
  position: 'relative'
};

const localCameraStyle = {
  background: '#000000',
  display: 'block',
  objectFit: 'cover',
  transform: 'none',
  height: '100%',
  width: '100%'
};

const localFaceTileStyle = {
  aspectRatio: '16 / 9',
  background: '#050505',
  border: '1px solid #2A2A2A',
  borderRadius: '8px',
  overflow: 'hidden',
  position: 'relative'
};

const selfPreviewStyle = {
  ...localFaceTileStyle,
  bottom: '18px',
  boxShadow: '0 16px 38px rgba(0, 0, 0, 0.42)',
  height: '126px',
  position: 'absolute',
  right: '18px',
  width: '224px',
  zIndex: 8
};

const faceOffStyle = {
  alignItems: 'center',
  color: '#D4D4D4',
  display: 'flex',
  fontSize: '13px',
  fontWeight: 900,
  height: '100%',
  justifyContent: 'center',
  padding: '12px',
  textAlign: 'center'
};

const faceLabelStyle = {
  background: 'rgba(0,0,0,0.7)',
  borderRadius: '999px',
  bottom: '8px',
  color: '#FFFFFF',
  fontSize: '12px',
  fontWeight: 900,
  left: '8px',
  padding: '5px 8px',
  position: 'absolute'
};

const participantsStyle = {
  borderTop: '1px solid #2A2A2A',
  marginTop: 0,
  paddingTop: '12px'
};

const screenShareNoticeStyle = {
  background: '#171717',
  border: '1px solid #404040',
  borderRadius: '8px',
  color: '#D4D4D4',
  display: 'grid',
  fontSize: '13px',
  gap: '5px',
  lineHeight: 1.45,
  margin: '0 0 12px',
  padding: '11px 12px'
};

const sectionTitleStyle = {
  alignItems: 'center',
  display: 'flex',
  fontSize: '15px',
  fontWeight: 900,
  gap: '8px',
  marginBottom: '8px'
};

const responsiveStyles = `
  @keyframes screenflowGuestReaction {
    0% { opacity: 0; transform: translateY(12px) scale(0.9); }
    16% { opacity: 1; transform: translateY(0) scale(1); }
    84% { opacity: 1; transform: translateY(-10px) scale(1); }
    100% { opacity: 0; transform: translateY(-24px) scale(0.96); }
  }

  [data-call-panel="true"][data-connected="true"] {
    max-width: 1380px !important;
  }

  .camera-box > [data-face-tile="true"] {
    aspect-ratio: 16 / 9 !important;
    min-height: 0 !important;
    scroll-snap-align: start;
    width: 100% !important;
  }

  .camera-box[data-face-layout="solo"] {
    grid-template-columns: minmax(0, min(960px, 100%)) !important;
    justify-content: center !important;
  }

  .camera-box[data-face-layout="solo"] > [data-face-tile="true"] {
    min-height: min(56dvh, 540px) !important;
  }

  .camera-box[data-face-layout="pair"],
  .camera-box[data-face-layout="quad"] {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .camera-box[data-face-layout="compact"] {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  }

  .camera-box[data-face-layout="dense"] {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }

  [data-call-content="true"][data-has-presentation="true"] {
    align-items: start;
    grid-template-columns: minmax(0, 1.7fr) minmax(280px, 0.7fr);
  }

  [data-call-content="true"][data-has-presentation="false"] [data-people-section="true"] {
    grid-column: 1 / -1;
  }

  [data-participants-summary="true"] {
    grid-column: 1 / -1;
  }

  @media (max-width: 720px) {
    body {
      overflow: auto !important;
    }

    #root {
      min-height: 100dvh;
    }

    [data-join-call-root="true"] {
      min-height: 100dvh !important;
      padding: 0 !important;
    }

    [data-call-panel="true"] {
      border: 0 !important;
      border-radius: 0 !important;
      min-height: 100dvh !important;
      padding: 14px !important;
    }

    [data-call-panel="true"] h1 {
      font-size: 24px !important;
    }

    [data-call-panel="true"][data-connected="true"] {
      padding-bottom: 86px !important;
    }

    [data-call-content="true"] {
      grid-template-columns: minmax(0, 1fr) !important;
    }

    [data-call-content="true"] > * {
      grid-column: 1 !important;
    }

    .viewer-section {
      margin-left: -6px;
      margin-right: -6px;
    }

    .media-box {
      aspect-ratio: 16 / 9 !important;
      min-height: 0 !important;
      max-height: none !important;
      padding: 8px !important;
    }

    .media-box video {
      max-height: none !important;
      object-fit: contain;
      transform: none !important;
    }

    [data-people-section="true"] {
      margin-left: -6px;
      margin-right: -6px;
    }

    .camera-box {
      align-content: start !important;
      gap: 8px !important;
      min-height: 0 !important;
      max-height: none !important;
      overflow-y: visible !important;
      padding: 8px !important;
    }

    .camera-box > [data-face-tile="true"] {
      min-height: 0 !important;
      width: 100% !important;
    }

    .camera-box[data-face-layout="solo"] {
      grid-template-columns: minmax(0, 1fr) !important;
    }

    .camera-box[data-face-layout="solo"] > [data-face-tile="true"] {
      aspect-ratio: 3 / 4 !important;
      max-height: 58dvh !important;
      min-height: min(360px, 52dvh) !important;
    }

    .camera-box > [data-placeholder="true"] {
      display: none !important;
    }

    .camera-box[data-face-layout="pair"] {
      grid-template-columns: minmax(0, 1fr) !important;
    }

    .camera-box[data-face-layout="pair"] > [data-face-tile="true"] {
      aspect-ratio: 16 / 9 !important;
    }

    .camera-box[data-face-layout="quad"] {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }

    .camera-box[data-face-layout="quad"] > [data-face-tile="true"] {
      aspect-ratio: 4 / 3 !important;
    }

    .camera-box[data-face-layout="compact"],
    .camera-box[data-face-layout="dense"] {
      grid-auto-columns: min(74vw, 320px) !important;
      grid-auto-flow: column !important;
      grid-template-columns: none !important;
      overflow-x: auto !important;
      overflow-y: hidden !important;
      scroll-snap-type: x mandatory;
    }

    .camera-box[data-face-layout="compact"] > [data-face-tile="true"],
    .camera-box[data-face-layout="dense"] > [data-face-tile="true"] {
      aspect-ratio: 4 / 3 !important;
    }

    [data-call-content="true"][data-has-presentation="true"] .camera-box {
      grid-auto-columns: min(72vw, 320px) !important;
      grid-auto-flow: column !important;
      grid-template-columns: none !important;
      overflow-x: auto !important;
      overflow-y: hidden !important;
      scroll-snap-type: x mandatory;
    }

    [data-call-content="true"][data-has-presentation="true"] .camera-box > [data-face-tile="true"] {
      aspect-ratio: 16 / 9 !important;
      max-height: none !important;
      min-height: 156px !important;
    }

    [data-self-view="true"] {
      bottom: 12px !important;
      height: 82px !important;
      right: 12px !important;
      width: 132px !important;
    }

    .camera-box video {
      object-fit: cover;
      transform: none !important;
    }

    [data-participants-summary="true"] {
      display: none !important;
    }

    input {
      font-size: 16px !important;
    }

    [data-call-control-dock="true"] {
      border-bottom: 0 !important;
      border-bottom-left-radius: 0 !important;
      border-bottom-right-radius: 0 !important;
      bottom: 0 !important;
      left: 0 !important;
      margin: 0 !important;
      padding: 8px 10px calc(8px + env(safe-area-inset-bottom)) !important;
      position: fixed !important;
      right: 0 !important;
    }

    [data-call-control-dock="true"] button {
      min-height: 48px !important;
    }

    [data-call-control-dock="true"] button span {
      display: none !important;
    }

    [data-call-status="true"] {
      margin: 10px 0 !important;
    }
  }
`;
