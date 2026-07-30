import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  ScreenSharePresets,
  Track,
  VideoPresets,
  VideoQuality
} from 'livekit-client';
import { Camera, Expand, Mic, PhoneOff, Play, ScreenShare, SquarePen, Users, Video } from 'lucide-react';

export default function JoinCall() {
  const roomRef = useRef(null);
  const mediaRef = useRef(null);
  const cameraRef = useRef(null);
  const localCameraRef = useRef(null);
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
  const roomCode = useMemo(() => {
    const match = window.location.pathname.match(/\/join\/([^/]+)/i);
    return (match?.[1] || '').toUpperCase();
  }, []);

  const [name, setName] = useState('');
  const [status, setStatus] = useState('Ready to join');
  const [connected, setConnected] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [hasHostScreen, setHasHostScreen] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [fatalError, setFatalError] = useState('');

  useEffect(() => {
    if (localCameraRef.current) {
      localCameraRef.current.srcObject = cameraOn ? localCameraStreamRef.current : null;
    }
  }, [cameraOn]);

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

  const joinRoom = async () => {
    try {
      const participantName = name.trim();
      if (!participantName) {
        setStatus('Enter your name before joining.');
        return;
      }
      if (roomRef.current) {
        safeDisconnectRoom(roomRef.current);
        roomRef.current = null;
      }
      resetCallState('Ready to reconnect');
      setStatus('Getting access token...');
      const params = new URLSearchParams({ roomCode, participantName, role: 'participant' });
      const response = await fetch(`/api/livekit-token?${params.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode, participantName, role: 'participant' })
      });
      const text = await response.text();
      let result = {};
      try {
        result = text ? JSON.parse(text) : {};
      } catch (error) {
        throw new Error(`Token endpoint returned an invalid response (${response.status}).`);
      }
      if (!response.ok) throw new Error(result.error || 'Unable to get LiveKit token.');

      setStatus('Connecting...');
      const room = new Room({
        adaptiveStream: {
          pauseVideoInBackground: false,
          pixelDensity: 2
        },
        dynacast: true
      });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (roomRef.current !== room) return;
        try {
          if (track.kind === Track.Kind.Video) {
            publication?.setVideoQuality?.(VideoQuality.HIGH);
          }
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
      localIdentityRef.current = result.identity || room.localParticipant?.identity || '';
      setConnected(true);
      setStatus('Connected. Waiting for presenter output if nothing is visible yet.');
      attachExistingTracks(room);
      updateParticipants(room);
    } catch (error) {
      setStatus(getErrorMessage(error, 'Could not join the call.'));
    }
  };

  const leaveRoom = () => {
    safeDisconnectRoom(roomRef.current);
    roomRef.current = null;
  };

  const resetCallState = (nextStatus) => {
    setConnected(false);
    setStatus(nextStatus);
    setParticipants([]);
    localIdentityRef.current = '';
    setCameraOn(false);
    setMicOn(false);
    setScreenOn(false);
    setHasHostScreen(false);
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
        audio: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      const audioTrack = stream.getAudioTracks()[0];
      localMicStreamRef.current = stream;
      publishedMicTrackRef.current = audioTrack;
      await room.localParticipant.publishTrack(audioTrack, {
        name: 'participant-mic',
        source: Track.Source.Microphone
      });
      setMicOn(true);
      setStatus('Microphone is on.');
    } catch (error) {
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
    if (!room) return;

    if (screenOnRef.current) {
      await stopPublishingScreen(room);
      setStatus('Screen sharing stopped.');
      return;
    }

    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setStatus('Screen sharing is not available in this browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
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
      setStatus(getErrorMessage(error, 'Screen share permission was not granted.'));
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
      if (command.type === 'share-stopped') {
        clearHostScreen();
        setStatus('Host closed the shared screen.');
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
    setParticipants(remoteParticipants.map((participant) => participant.name || participant.identity));
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
          if (publication.track.kind === Track.Kind.Video) {
            publication.setVideoQuality?.(VideoQuality.HIGH);
          }
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

  const attachTrack = (track, participant) => {
    if (!mediaRef.current) return;
    const isScreen = track.kind === 'video' && (track.name?.includes('screen') || track.source === Track.Source.ScreenShare);
    const isCamera = track.kind === 'video' && !isScreen;
    const targetRef = track.kind === 'audio' ? audioRef : isCamera ? cameraRef : mediaRef;
    if (!targetRef.current) return;

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
      element.style.display = 'none';
    }

    const alreadyAttached = Array.from(targetRef.current.querySelectorAll('[data-track-sid]')).some((child) => child.dataset?.trackSid === track.sid);
    if (alreadyAttached) {
      detachTrackElements(track).forEach((attachedElement) => attachedElement.remove());
      return;
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
      element.play?.().catch(() => setStatus('Tap Mic or Join again if audio is blocked by the browser.'));
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
            <button disabled={!roomCode || !name.trim()} onClick={joinRoom} style={primaryButtonStyle}>
              <Play size={17} /> Join Call
            </button>
          </section>
        )}

        <p data-call-status="true" style={statusStyle}>{status}</p>
        <div ref={audioRef} aria-hidden="true" style={audioSinkStyle} />
        <canvas ref={whiteboardCanvasRef} aria-hidden="true" style={hiddenCanvasStyle} />

        <div
          data-call-content="true"
          data-has-presentation={hasHostScreen ? 'true' : 'false'}
          style={{ display: connected ? 'grid' : 'none', gap: '10px' }}
        >
          <section className="viewer-section" style={{ ...viewerStyle, display: hasHostScreen ? 'block' : 'none' }}>
            <div style={viewerHeaderStyle}>
              <span style={viewerTitleStyle}><Video size={18} /> Presentation</span>
              <button
                aria-label="Fullscreen presentation"
                onClick={() => mediaRef.current?.requestFullscreen?.()}
                style={viewerHeaderButtonStyle}
              >
                <Expand size={16} />
              </button>
            </div>
            <div className="media-box" ref={mediaRef} style={mediaBoxStyle}>
              <span data-placeholder="true">No presentation yet.</span>
            </div>
          </section>

          <section data-people-section="true" style={viewerStyle}>
            <div style={viewerHeaderStyle}>
              <span style={viewerTitleStyle}><Camera size={18} /> People</span>
              <span style={peopleCountStyle}>{participants.length + 1}</span>
            </div>
            <div className="camera-box" ref={cameraRef} style={cameraBoxStyle}>
              <div data-local-face="true" style={localFaceTileStyle}>
                <video ref={localCameraRef} autoPlay muted playsInline style={{ ...localCameraStyle, display: cameraOn ? 'block' : 'none' }} />
                {!cameraOn && <div style={faceOffStyle}>Your camera is off</div>}
                <span style={faceLabelStyle}>{name || 'You'} (You)</span>
              </div>
              <span data-placeholder="true">Waiting for other cameras.</span>
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
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  marginTop: '12px',
  padding: '8px',
  position: 'sticky',
  zIndex: 20
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
  gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
  justifyContent: 'stretch',
  minHeight: '132px',
  overflow: 'hidden',
  padding: '10px'
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

const sectionTitleStyle = {
  alignItems: 'center',
  display: 'flex',
  fontSize: '15px',
  fontWeight: 900,
  gap: '8px',
  marginBottom: '8px'
};

const responsiveStyles = `
  [data-call-panel="true"][data-connected="true"] {
    max-width: 1120px !important;
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

    .camera-box {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      min-height: 110px !important;
      overflow-x: auto !important;
    }

    .camera-box video {
      object-fit: cover;
      transform: none !important;
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
