import React, { useMemo, useRef, useState } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { PhoneOff, Play, Users, Video } from 'lucide-react';

export default function JoinCall() {
  const roomRef = useRef(null);
  const mediaRef = useRef(null);
  const roomCode = useMemo(() => {
    const match = window.location.pathname.match(/\/join\/([^/]+)/i);
    return (match?.[1] || '').toUpperCase();
  }, []);

  const [name, setName] = useState('Guest');
  const [status, setStatus] = useState('Ready to join');
  const [connected, setConnected] = useState(false);
  const [participants, setParticipants] = useState([]);

  const joinRoom = async () => {
    try {
      setStatus('Getting access token...');
      const response = await fetch('/api/livekit-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode, participantName: name })
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
      });

      room.on(RoomEvent.ParticipantConnected, updateParticipants);
      room.on(RoomEvent.ParticipantDisconnected, updateParticipants);
      room.on(RoomEvent.Disconnected, () => {
        setConnected(false);
        setStatus('Disconnected');
        setParticipants([]);
        if (mediaRef.current) mediaRef.current.innerHTML = '';
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

    const element = track.attach();
    element.autoplay = true;
    element.playsInline = true;
    element.controls = track.kind === 'video';
    element.style.width = '100%';
    element.style.maxHeight = '70vh';
    element.style.borderRadius = '8px';
    element.style.background = '#090B12';
    element.style.marginTop = '12px';
    if (track.kind === 'audio') element.style.display = 'none';

    const alreadyAttached = Array.from(mediaRef.current.children).some((child) => child.dataset?.trackSid === track.sid);
    if (alreadyAttached) return;

    element.dataset.trackSid = track.sid;
    mediaRef.current.querySelector('[data-placeholder="true"]')?.remove();
    mediaRef.current.style.display = 'block';
    mediaRef.current.appendChild(element);
  };

  return (
    <div style={pageStyle}>
      <main style={panelStyle}>
        <div style={brandStyle}>ScreenFlow AI</div>
        <h1 style={titleStyle}>Join Live Call</h1>
        <p style={mutedStyle}>Room <strong>{roomCode}</strong></p>

        <label style={labelStyle}>
          Your name
          <input value={name} onChange={(event) => setName(event.target.value)} disabled={connected} style={inputStyle} />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button disabled={connected || !roomCode} onClick={joinRoom} style={primaryButtonStyle}>
            <Play size={17} /> Join
          </button>
          <button disabled={!connected} onClick={leaveRoom} style={secondaryButtonStyle}>
            <PhoneOff size={17} /> Leave
          </button>
        </div>

        <p style={statusStyle}>{status}</p>

        <section style={viewerStyle}>
          <div style={viewerHeaderStyle}>
            <Video size={18} />
            Presenter Feed
          </div>
          <div ref={mediaRef} style={mediaBoxStyle}>
            {!connected && <span data-placeholder="true">Join to view the live screen or whiteboard.</span>}
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
  alignItems: 'center',
  background: '#0B0F19',
  color: '#F8FAFC',
  display: 'flex',
  fontFamily: 'Inter, system-ui, sans-serif',
  justifyContent: 'center',
  minHeight: '100vh',
  padding: '18px'
};

const panelStyle = {
  background: '#FFFFFF',
  borderRadius: '8px',
  color: '#172033',
  maxWidth: '720px',
  padding: '22px',
  width: '100%'
};

const brandStyle = {
  color: '#7C3AED',
  fontSize: '13px',
  fontWeight: 900,
  marginBottom: '8px'
};

const titleStyle = {
  fontSize: '28px',
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
  minHeight: '46px'
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
  overflow: 'hidden'
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
  padding: '12px'
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
