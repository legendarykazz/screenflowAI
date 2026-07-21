import React, { useMemo, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { Camera, Mic, PhoneOff, Play, Users, Video } from 'lucide-react';

export default function JoinCall() {
  const roomRef = useRef(null);
  const mediaRef = useRef(null);
  const cameraRef = useRef(null);
  const localCameraRef = useRef(null);
  const localCameraStreamRef = useRef(null);
  const localMicStreamRef = useRef(null);
  const publishedCameraTrackRef = useRef(null);
  const publishedMicTrackRef = useRef(null);
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
  const [participants, setParticipants] = useState([]);

  const joinRoom = async () => {
    try {
      setStatus('Getting access token...');
      const params = new URLSearchParams({ roomCode, participantName: name, role: 'participant' });
      const response = await fetch(`/api/livekit-token?${params.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode, participantName: name, role: 'participant' })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to get LiveKit token.');

      setStatus('Connecting...');
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track) => {
        attachTrack(track);
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((element) => element.remove());
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
        localCameraStreamRef.current?.getTracks().forEach((track) => track.stop());
        localMicStreamRef.current?.getTracks().forEach((track) => track.stop());
        localCameraStreamRef.current = null;
        localMicStreamRef.current = null;
        if (localCameraRef.current) localCameraRef.current.srcObject = null;
        if (mediaRef.current) mediaRef.current.innerHTML = '';
        if (cameraRef.current) cameraRef.current.innerHTML = '';
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

  const attachTrack = (track) => {
    if (!mediaRef.current) return;
    const isCamera = track.kind === 'video' && track.name === 'presenter-camera';
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
    element.style.objectFit = 'contain';
    if (track.kind === 'audio') element.style.display = 'none';

    const alreadyAttached = Array.from(targetRef.current.children).some((child) => child.dataset?.trackSid === track.sid);
    if (alreadyAttached) return;

    element.dataset.trackSid = track.sid;
    targetRef.current.querySelector('[data-placeholder="true"]')?.remove();

    if (track.kind === 'video') {
      if (isCamera) activeCameraSidRef.current = track.sid;
      else activeVideoSidRef.current = track.sid;
      Array.from(targetRef.current.querySelectorAll('video')).forEach((video) => {
        video.remove();
      });
      element.muted = false;
      element.play?.().catch(() => {});
    }

    targetRef.current.style.display = track.kind === 'video' ? 'block' : targetRef.current.style.display;
    targetRef.current.appendChild(element);
  };

  return (
    <div style={pageStyle}>
      <style>{responsiveStyles}</style>
      <main style={panelStyle}>
        <div style={brandStyle}>ScreenFlow AI</div>
        <h1 style={titleStyle}>Join Live Call</h1>
        <p style={mutedStyle}>Room <strong>{roomCode}</strong></p>

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
          </div>
        )}

        <p style={statusStyle}>{status}</p>

        <section className="viewer-section" style={viewerStyle}>
          <div style={viewerHeaderStyle}>
            <Video size={18} />
            Presenter Feed
          </div>
          <div className="media-box" ref={mediaRef} style={mediaBoxStyle}>
            {!connected && <span data-placeholder="true">Join to view the live screen or whiteboard.</span>}
          </div>
        </section>

        <section style={viewerStyle}>
          <div style={viewerHeaderStyle}>
            <Camera size={18} />
            Camera
          </div>
          {connected && (
            <video ref={localCameraRef} autoPlay muted playsInline style={localCameraStyle} />
          )}
          <div className="camera-box" ref={cameraRef} style={cameraBoxStyle}>
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
  background: '#0B0F19',
  color: '#F8FAFC',
  display: 'flex',
  fontFamily: 'Inter, system-ui, sans-serif',
  justifyContent: 'center',
  minHeight: '100vh',
  padding: '18px',
  WebkitTextSizeAdjust: '100%'
};

const panelStyle = {
  background: '#FFFFFF',
  borderRadius: '8px',
  color: '#172033',
  maxWidth: '720px',
  padding: '22px',
  width: '100%',
  minHeight: 'auto'
};

const brandStyle = {
  color: '#7C3AED',
  fontSize: '13px',
  fontWeight: 900,
  marginBottom: '8px'
};

const titleStyle = {
  fontSize: 'clamp(24px, 7vw, 30px)',
  fontWeight: 900,
  letterSpacing: 0,
  marginBottom: '6px'
};

const mutedStyle = {
  color: '#647087',
  fontSize: '14px',
  lineHeight: 1.45,
  margin: '0 0 16px'
};

const labelStyle = {
  color: '#26344D',
  display: 'flex',
  flexDirection: 'column',
  fontSize: '13px',
  fontWeight: 900,
  gap: '8px',
  marginBottom: '14px'
};

const inputStyle = {
  border: '1px solid #DCE3EF',
  borderRadius: '8px',
  color: '#172033',
  fontSize: '16px',
  fontWeight: 800,
  minHeight: '44px',
  outline: 'none',
  padding: '0 12px'
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
  justifyContent: 'center',
  minHeight: '48px',
  touchAction: 'manipulation'
};

const secondaryButtonStyle = {
  ...primaryButtonStyle,
  background: '#F8FAFF',
  border: '1px solid #DCE3EF',
  color: '#26344D'
};

const statusStyle = {
  color: '#4E5A70',
  fontSize: '13px',
  fontWeight: 700,
  lineHeight: 1.45,
  margin: '14px 0'
};

const viewerStyle = {
  border: '1px solid #E2E8F0',
  borderRadius: '8px',
  overflow: 'hidden',
  marginTop: '12px'
};

const viewerHeaderStyle = {
  alignItems: 'center',
  borderBottom: '1px solid #E2E8F0',
  display: 'flex',
  fontSize: '14px',
  fontWeight: 900,
  gap: '8px',
  padding: '12px'
};

const mediaBoxStyle = {
  alignItems: 'center',
  aspectRatio: '16 / 9',
  background: '#090B12',
  color: '#CBD5E1',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  minHeight: '220px',
  overflow: 'hidden',
  padding: '10px'
};

const cameraBoxStyle = {
  alignItems: 'center',
  aspectRatio: '16 / 9',
  background: '#090B12',
  color: '#CBD5E1',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  minHeight: '150px',
  overflow: 'hidden',
  padding: '10px'
};

const localCameraStyle = {
  aspectRatio: '16 / 9',
  background: '#090B12',
  display: 'block',
  objectFit: 'cover',
  width: '100%'
};

const participantsStyle = {
  borderTop: '1px solid #E2E8F0',
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
