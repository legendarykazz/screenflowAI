import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { Camera, Mic, PhoneOff, Play, ScreenShare, Users, Video } from 'lucide-react';

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
  const activeVideoSidRef = useRef(null);
  const activeCameraSidRef = useRef(null);
  const roomCode = useMemo(() => {
    const match = window.location.pathname.match(/\/join\/([^/]+)/i);
    return (match?.[1] || '').toUpperCase();
  }, []);

  const [name, setName] = useState('Guest');
  const [status, setStatus] = useState('Ready to join');
  const [connected, setConnected] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [fatalError, setFatalError] = useState('');

  useEffect(() => {
    if (localCameraRef.current) {
      localCameraRef.current.srcObject = cameraOn ? localCameraStreamRef.current : null;
    }
  }, [cameraOn]);

  useEffect(() => {
    const handleError = (event) => {
      setFatalError(event.error?.message || event.message || 'The call page hit an unexpected error.');
    };
    const handleRejection = (event) => {
      setFatalError(event.reason?.message || String(event.reason || 'The call page hit an unexpected error.'));
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
      setStatus('Getting access token...');
      const params = new URLSearchParams({ roomCode, participantName: name, role: 'participant' });
      const response = await fetch(`/api/livekit-token?${params.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode, participantName: name, role: 'participant' })
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
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        try {
          attachTrack(track, participant);
        } catch (error) {
          setStatus(error.message || 'Could not attach participant media.');
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        try {
          track.detach().forEach((element) => {
            const tile = element.closest?.('[data-face-tile="true"]');
            if (tile) tile.remove();
            else element.remove();
          });
        } catch (error) {
          setStatus(error.message || 'Could not clean up participant media.');
        }
        if (activeVideoSidRef.current === track.sid) activeVideoSidRef.current = null;
        if (activeCameraSidRef.current === track.sid) activeCameraSidRef.current = null;
      });

      room.on(RoomEvent.ParticipantConnected, updateParticipants);
      room.on(RoomEvent.ParticipantDisconnected, updateParticipants);
      room.on(RoomEvent.Disconnected, () => {
        setConnected(false);
        setStatus('Disconnected');
        setParticipants([]);
        setCameraOn(false);
        setMicOn(false);
        activeVideoSidRef.current = null;
        activeCameraSidRef.current = null;
        publishedCameraTrackRef.current = null;
        publishedMicTrackRef.current = null;
        publishedScreenTrackRef.current = null;
        localCameraStreamRef.current?.getTracks().forEach((track) => track.stop());
        localMicStreamRef.current?.getTracks().forEach((track) => track.stop());
        localCameraStreamRef.current = null;
        localMicStreamRef.current = null;
        if (localCameraRef.current) localCameraRef.current.srcObject = null;
        mediaRef.current?.querySelectorAll('[data-track-sid]').forEach((element) => element.remove());
        cameraRef.current?.querySelectorAll('[data-face-tile="true"]').forEach((element) => element.remove());
      });

      await room.connect(result.url, result.token);
      setConnected(true);
      setStatus('Connected. Waiting for presenter output if nothing is visible yet.');
      attachExistingTracks(room);
      updateParticipants(room);
    } catch (error) {
      setStatus(error.message || 'Could not join the call.');
    }
  };

  const leaveRoom = () => {
    roomRef.current?.disconnect();
    roomRef.current = null;
  };

  const toggleMic = async () => {
    const room = roomRef.current;
    if (!room) return;

    if (micOn) {
      if (publishedMicTrackRef.current) await room.localParticipant.unpublishTrack(publishedMicTrackRef.current);
      localMicStreamRef.current?.getTracks().forEach((track) => track.stop());
      localMicStreamRef.current = null;
      publishedMicTrackRef.current = null;
      setMicOn(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioTrack = stream.getAudioTracks()[0];
      localMicStreamRef.current = stream;
      publishedMicTrackRef.current = audioTrack;
      await room.localParticipant.publishTrack(audioTrack, {
        name: 'participant-mic',
        source: Track.Source.Microphone
      });
      setMicOn(true);
    } catch (error) {
      setStatus(error.message || 'Microphone permission was not granted.');
    }
  };

  const toggleCamera = async () => {
    const room = roomRef.current;
    if (!room) return;

    if (cameraOn) {
      if (publishedCameraTrackRef.current) await room.localParticipant.unpublishTrack(publishedCameraTrackRef.current);
      localCameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      localCameraStreamRef.current = null;
      publishedCameraTrackRef.current = null;
      if (localCameraRef.current) localCameraRef.current.srcObject = null;
      setCameraOn(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: false
      });
      const cameraTrack = stream.getVideoTracks()[0];
      localCameraStreamRef.current = stream;
      publishedCameraTrackRef.current = cameraTrack;
      if (localCameraRef.current) localCameraRef.current.srcObject = stream;
      await room.localParticipant.publishTrack(cameraTrack, {
        name: 'participant-camera',
        source: Track.Source.Camera,
        videoEncoding: {
          maxBitrate: 1_200_000,
          maxFramerate: 30
        }
      });
      setCameraOn(true);
    } catch (error) {
      setStatus(error.message || 'Camera permission was not granted.');
    }
  };

  const toggleScreenShare = async () => {
    const room = roomRef.current;
    if (!room) return;

    if (screenOn) {
      if (publishedScreenTrackRef.current) await room.localParticipant.unpublishTrack(publishedScreenTrackRef.current);
      publishedScreenTrackRef.current?.stop?.();
      publishedScreenTrackRef.current = null;
      setScreenOn(false);
      return;
    }

    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setStatus('Screen sharing is not available in this mobile browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const screenTrack = stream.getVideoTracks()[0];
      screenTrack.onended = () => {
        publishedScreenTrackRef.current = null;
        setScreenOn(false);
      };
      publishedScreenTrackRef.current = screenTrack;
      await room.localParticipant.publishTrack(screenTrack, {
        name: 'participant-screen',
        source: Track.Source.ScreenShare,
        simulcast: false,
        videoEncoding: {
          maxBitrate: 2_000_000,
          maxFramerate: 24
        }
      });
      setScreenOn(true);
      setStatus('Sharing your screen.');
    } catch (error) {
      setStatus(error.message || 'Screen share permission was not granted.');
    }
  };

  const updateParticipants = (room = roomRef.current) => {
    if (!room) return;
    setParticipants(Array.from(room.remoteParticipants.values()).map((participant) => participant.name || participant.identity));
  };

  const attachExistingTracks = (room) => {
    room.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((publication) => {
        if (publication.track) attachTrack(publication.track);
      });
    });
  };

  const attachTrack = (track, participant) => {
    if (!mediaRef.current) return;
    const isScreen = track.kind === 'video' && track.name?.includes('screen');
    const isCamera = track.kind === 'video' && !isScreen;
    const targetRef = isCamera ? cameraRef : mediaRef;
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
    if (track.kind === 'audio') element.style.display = 'none';

    const alreadyAttached = Array.from(targetRef.current.children).some((child) => child.dataset?.trackSid === track.sid);
    if (alreadyAttached) return;

    element.dataset.trackSid = track.sid;
    targetRef.current.querySelector('[data-placeholder="true"]')?.remove();

    if (track.kind === 'video') {
      if (isCamera) activeCameraSidRef.current = track.sid;
      else {
        activeVideoSidRef.current = track.sid;
        Array.from(targetRef.current.querySelectorAll('video')).forEach((video) => {
          video.remove();
        });
      }
      element.muted = false;
      element.play?.().catch(() => {});
    }

    if (isCamera) {
      const tile = document.createElement('div');
      tile.dataset.trackSid = track.sid;
      tile.dataset.faceTile = 'true';
      tile.style.aspectRatio = '1 / 1';
      tile.style.background = '#050505';
      tile.style.border = '1px solid #2A2A2A';
      tile.style.borderRadius = '8px';
      tile.style.overflow = 'hidden';
      tile.style.position = 'relative';
      tile.appendChild(element);

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
      targetRef.current.appendChild(tile);
      return;
    }

    targetRef.current.appendChild(element);
  };

  return (
    <div style={pageStyle}>
      <style>{responsiveStyles}</style>
      <main style={panelStyle}>
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

        <label style={labelStyle}>
          Your name
          <input value={name} onChange={(event) => setName(event.target.value)} disabled={connected} style={inputStyle} />
        </label>

        <div className="join-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button disabled={connected || !roomCode} onClick={joinRoom} style={primaryButtonStyle}>
            <Play size={17} /> Join
          </button>
          <button disabled={!connected} onClick={leaveRoom} style={secondaryButtonStyle}>
            <PhoneOff size={17} /> Leave
          </button>
        </div>

        {connected && (
          <div className="join-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
            <button onClick={toggleMic} style={secondaryButtonStyle}>
              <Mic size={17} /> {micOn ? 'Mute' : 'Mic'}
            </button>
            <button onClick={toggleCamera} style={secondaryButtonStyle}>
              <Camera size={17} /> {cameraOn ? 'Camera On' : 'Camera'}
            </button>
            <button onClick={toggleScreenShare} style={secondaryButtonStyle}>
              <ScreenShare size={17} /> {screenOn ? 'Stop Share' : 'Share Screen'}
            </button>
          </div>
        )}

        <p style={statusStyle}>{status}</p>

        <section className="viewer-section" style={viewerStyle}>
          <div style={viewerHeaderStyle}>
            <Video size={18} />
            Host Screen
          </div>
          <div className="media-box" ref={mediaRef} style={mediaBoxStyle}>
            {!connected && <span data-placeholder="true">Join to view the live screen or whiteboard.</span>}
          </div>
        </section>

        <section style={viewerStyle}>
          <div style={viewerHeaderStyle}>
            <Camera size={18} />
            People
          </div>
          <div className="camera-box" ref={cameraRef} style={cameraBoxStyle}>
            {connected && (
              <div style={localFaceTileStyle}>
                <video ref={localCameraRef} autoPlay muted playsInline style={{ ...localCameraStyle, display: cameraOn ? 'block' : 'none' }} />
                {!cameraOn && <div style={faceOffStyle}>Your camera is off</div>}
                <span style={faceLabelStyle}>You</span>
              </div>
            )}
            <span data-placeholder="true">Camera appears here when the presenter turns it on.</span>
          </div>
        </section>

        <section style={participantsStyle}>
          <h2 style={sectionTitleStyle}><Users size={17} /> Participants</h2>
          <p style={mutedStyle}>{participants.length ? participants.join(', ') : 'No remote participants yet.'}</p>
        </section>
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
  minHeight: '100vh',
  padding: '18px',
  WebkitTextSizeAdjust: '100%'
};

const panelStyle = {
  background: '#0D0D0D',
  border: '1px solid #242424',
  borderRadius: '8px',
  color: '#FFFFFF',
  maxWidth: '760px',
  padding: '18px',
  width: '100%',
  minHeight: 'auto'
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
  fontSize: 'clamp(24px, 7vw, 30px)',
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

const statusStyle = {
  color: '#D4D4D4',
  fontSize: '13px',
  fontWeight: 700,
  lineHeight: 1.45,
  margin: '14px 0'
};

const viewerStyle = {
  background: '#050505',
  border: '1px solid #2A2A2A',
  borderRadius: '8px',
  overflow: 'hidden',
  marginTop: '12px'
};

const viewerHeaderStyle = {
  alignItems: 'center',
  borderBottom: '1px solid #2A2A2A',
  display: 'flex',
  fontSize: '14px',
  fontWeight: 900,
  gap: '8px',
  padding: '12px'
};

const mediaBoxStyle = {
  alignItems: 'center',
  aspectRatio: '16 / 9',
  background: '#000000',
  color: '#D4D4D4',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  minHeight: '220px',
  overflow: 'hidden',
  padding: '10px'
};

const cameraBoxStyle = {
  alignItems: 'center',
  background: '#000000',
  color: '#D4D4D4',
  display: 'grid',
  gap: '10px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  justifyContent: 'stretch',
  minHeight: '150px',
  overflow: 'hidden',
  padding: '10px'
};

const localCameraStyle = {
  background: '#000000',
  display: 'block',
  objectFit: 'cover',
  height: '100%',
  width: '100%'
};

const localFaceTileStyle = {
  aspectRatio: '1 / 1',
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
  marginTop: '16px',
  paddingTop: '16px'
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
  @media (max-width: 640px) {
    body {
      overflow: auto !important;
    }

    #root {
      min-height: 100vh;
    }

    .join-actions {
      bottom: 0;
      grid-template-columns: 1fr 1fr !important;
      left: 0;
      padding: 10px 0 0;
      position: sticky;
      z-index: 10;
    }

    .viewer-section {
      margin-left: -10px;
      margin-right: -10px;
    }

    .media-box {
      aspect-ratio: 9 / 16 !important;
      min-height: min(68vh, 620px) !important;
      padding: 8px !important;
    }

    .media-box video {
      max-height: 68vh !important;
      object-fit: contain;
    }

    .camera-box {
      aspect-ratio: 16 / 9 !important;
      min-height: 180px !important;
    }

    .camera-box video {
      object-fit: cover;
    }

    input,
    button {
      font-size: 16px !important;
    }
  }
`;
