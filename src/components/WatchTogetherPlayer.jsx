import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, FastForward, Pause, Play, RefreshCw, Rewind } from 'lucide-react';
import { projectedWatchTime } from '../lib/watchTogether';

const PLAYER_SYNC_INTERVAL = 1500;
const PLAYER_DRIFT_TOLERANCE = 0.55;

export default function WatchTogetherPlayer({
  controller = false,
  onPlaybackChange,
  onPlayerError,
  session
}) {
  const youtubeHostRef = useRef(null);
  const youtubePlayerRef = useRef(null);
  const directVideoRef = useRef(null);
  const sessionRef = useRef(session);
  const playbackCallbackRef = useRef(onPlaybackChange);
  const errorCallbackRef = useRef(onPlayerError);
  const applyingSyncRef = useRef(false);
  const [webReloadKey, setWebReloadKey] = useState(0);

  useEffect(() => {
    sessionRef.current = session;
    playbackCallbackRef.current = onPlaybackChange;
    errorCallbackRef.current = onPlayerError;
  }, [onPlaybackChange, onPlayerError, session]);

  useEffect(() => {
    setWebReloadKey(0);
  }, [session?.sessionId]);

  useEffect(() => {
    if (session?.kind !== 'youtube') return undefined;
    let disposed = false;

    loadYouTubeIframeApi()
      .then((YT) => {
        if (disposed || !youtubeHostRef.current) return;
        youtubeHostRef.current.innerHTML = '';
        const player = new YT.Player(youtubeHostRef.current, {
          height: '100%',
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            controls: controller ? 1 : 0,
            disablekb: controller ? 0 : 1,
            playsinline: 1,
            rel: 0
          },
          videoId: session.videoId,
          width: '100%',
          events: {
            onError: (event) => {
              errorCallbackRef.current?.(`YouTube could not play this video (error ${event.data}).`);
            },
            onReady: (event) => {
              youtubePlayerRef.current = event.target;
              applyYouTubeSession(event.target, sessionRef.current, controller, applyingSyncRef);
            },
            onStateChange: (event) => {
              if (!controller || applyingSyncRef.current) return;
              if (![YT.PlayerState.ENDED, YT.PlayerState.PLAYING, YT.PlayerState.PAUSED].includes(event.data)) return;
              playbackCallbackRef.current?.({
                currentTime: safePlayerTime(event.target),
                playing: event.data === YT.PlayerState.PLAYING,
                updatedAt: Date.now()
              });
            }
          }
        });
        youtubePlayerRef.current = player;
      })
      .catch((error) => errorCallbackRef.current?.(error.message || 'YouTube player could not load.'));

    return () => {
      disposed = true;
      try {
        youtubePlayerRef.current?.destroy?.();
      } catch (error) {}
      youtubePlayerRef.current = null;
    };
  }, [controller, session?.kind, session?.sessionId, session?.videoId]);

  useEffect(() => {
    if (controller || session?.kind !== 'youtube' || !youtubePlayerRef.current) return;
    applyYouTubeSession(youtubePlayerRef.current, session, false, applyingSyncRef);
  }, [controller, session?.currentTime, session?.kind, session?.playing, session?.updatedAt]);

  useEffect(() => {
    if (controller || session?.kind !== 'video') return;
    applyDirectVideoSession(directVideoRef.current, session);
  }, [controller, session?.currentTime, session?.kind, session?.playing, session?.updatedAt]);

  useEffect(() => {
    if (!controller || !session || session.kind === 'web') return undefined;
    const timer = setInterval(() => {
      if (session.kind === 'youtube') {
        const player = youtubePlayerRef.current;
        if (player?.getPlayerState) {
          playbackCallbackRef.current?.({
            currentTime: safePlayerTime(player),
            playing: player.getPlayerState() === window.YT?.PlayerState?.PLAYING,
            updatedAt: Date.now()
          });
        }
        return;
      }

      const video = directVideoRef.current;
      if (video) {
        playbackCallbackRef.current?.({
          currentTime: video.currentTime || 0,
          playing: !video.paused && !video.ended,
          updatedAt: Date.now()
        });
      }
    }, PLAYER_SYNC_INTERVAL);
    return () => clearInterval(timer);
  }, [controller, session?.kind, session?.sessionId]);

  const reportDirectVideoState = () => {
    const video = directVideoRef.current;
    if (!controller || !video) return;
    playbackCallbackRef.current?.({
      currentTime: video.currentTime || 0,
      playing: !video.paused && !video.ended,
      updatedAt: Date.now()
    });
  };

  const controlPlayback = (nextPlaying) => {
    const activeSession = sessionRef.current;
    if (!controller || !activeSession || activeSession.kind === 'web') return;
    const player = youtubePlayerRef.current;
    const video = directVideoRef.current;
    const currentTime = activeSession.kind === 'youtube'
      ? (player ? safePlayerTime(player) : projectedWatchTime(activeSession))
      : (video?.currentTime || projectedWatchTime(activeSession));

    applyingSyncRef.current = true;
    if (activeSession.kind === 'youtube') {
      if (nextPlaying) player?.playVideo?.();
      else player?.pauseVideo?.();
    } else if (video) {
      if (nextPlaying) video.play?.().catch(() => {});
      else video.pause?.();
    }
    playbackCallbackRef.current?.({ currentTime, playing: nextPlaying, updatedAt: Date.now() });
    setTimeout(() => {
      applyingSyncRef.current = false;
    }, 250);
  };

  const seekPlayback = (deltaSeconds) => {
    const activeSession = sessionRef.current;
    if (!controller || !activeSession || activeSession.kind === 'web') return;
    const player = youtubePlayerRef.current;
    const video = directVideoRef.current;
    const currentTime = activeSession.kind === 'youtube'
      ? (player ? safePlayerTime(player) : projectedWatchTime(activeSession))
      : (video?.currentTime || projectedWatchTime(activeSession));
    const targetTime = Math.max(0, currentTime + deltaSeconds);
    const playing = activeSession.kind === 'youtube'
      ? player?.getPlayerState?.() === window.YT?.PlayerState?.PLAYING
      : Boolean(video && !video.paused && !video.ended);

    applyingSyncRef.current = true;
    if (activeSession.kind === 'youtube') player?.seekTo?.(targetTime, true);
    else if (video) video.currentTime = Math.min(targetTime, Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.1) : targetTime);
    playbackCallbackRef.current?.({ currentTime: targetTime, playing, updatedAt: Date.now() });
    setTimeout(() => {
      applyingSyncRef.current = false;
    }, 250);
  };

  if (!session) return null;

  return (
    <div
      data-watch-kind={session.kind}
      data-watch-player="true"
      style={session.kind === 'web' ? webPlayerShellStyle : playerShellStyle}
    >
      {controller && session.kind !== 'web' && (
        <div data-shared-playback-controls="true" style={sharedControlsStyle}>
          <button aria-label="Rewind 10 seconds for everyone" onClick={() => seekPlayback(-10)} style={sharedControlButtonStyle} title="Back 10 seconds" type="button">
            <Rewind size={17} />
          </button>
          <button aria-label="Play for everyone" onClick={() => controlPlayback(true)} style={sharedControlButtonStyle} title="Play for everyone" type="button">
            <Play size={17} />
          </button>
          <button aria-label="Pause for everyone" onClick={() => controlPlayback(false)} style={sharedControlButtonStyle} title="Pause for everyone" type="button">
            <Pause size={17} />
          </button>
          <button aria-label="Forward 10 seconds for everyone" onClick={() => seekPlayback(10)} style={sharedControlButtonStyle} title="Forward 10 seconds" type="button">
            <FastForward size={17} />
          </button>
        </div>
      )}
      {session.kind === 'youtube' && <div ref={youtubeHostRef} style={playerSurfaceStyle} />}
      {session.kind === 'video' && (
        <video
          controls={controller}
          key={session.sessionId}
          onCanPlay={() => {
            if (!controller) applyDirectVideoSession(directVideoRef.current, sessionRef.current);
          }}
          onError={() => errorCallbackRef.current?.('This video link could not be played by the browser.')}
          onPause={reportDirectVideoState}
          onPlay={reportDirectVideoState}
          onSeeked={reportDirectVideoState}
          playsInline
          preload="metadata"
          ref={directVideoRef}
          src={session.url}
          style={directVideoStyle}
        />
      )}
      {session.kind === 'web' && (
        <div data-web-browser="true" style={webBrowserStyle}>
          <div style={webToolbarStyle}>
            <div style={webToolbarActionsStyle}>
              <button
                aria-label="Reload shared website"
                onClick={() => setWebReloadKey((current) => current + 1)}
                style={webToolButtonStyle}
                title="Reload website"
                type="button"
              >
                <RefreshCw size={16} />
              </button>
              <button
                aria-label="Open shared website in new tab"
                onClick={() => window.open(session.url, '_blank', 'noopener,noreferrer')}
                style={webToolButtonStyle}
                title="Open in new tab"
                type="button"
              >
                <ExternalLink size={16} />
              </button>
            </div>
            <span style={webAddressStyle}>{session.label}</span>
          </div>
          <iframe
            allow="autoplay; clipboard-read; clipboard-write; fullscreen; picture-in-picture"
            data-web-interactive="true"
            key={`${session.sessionId}-${webReloadKey}`}
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
            scrolling="yes"
            src={session.url}
            style={webFrameStyle}
            tabIndex={0}
            title={`Shared page: ${session.label}`}
          />
        </div>
      )}
    </div>
  );
}

function applyYouTubeSession(player, session, controller, applyingRef) {
  if (!player || !session) return;
  const targetTime = projectedWatchTime(session);
  const currentTime = safePlayerTime(player);
  applyingRef.current = true;
  try {
    if (Math.abs(currentTime - targetTime) > PLAYER_DRIFT_TOLERANCE) player.seekTo(targetTime, true);
    if (!controller) {
      if (session.playing) player.playVideo?.();
      else player.pauseVideo?.();
    }
  } finally {
    setTimeout(() => {
      applyingRef.current = false;
    }, 250);
  }
}

function applyDirectVideoSession(video, session) {
  if (!video || !session) return;
  const targetTime = projectedWatchTime(session);
  if (Number.isFinite(video.duration) && Math.abs((video.currentTime || 0) - targetTime) > PLAYER_DRIFT_TOLERANCE) {
    video.currentTime = Math.min(targetTime, Math.max(0, video.duration - 0.1));
  }
  if (session.playing && video.paused) video.play?.().catch(() => {});
  if (!session.playing && !video.paused) video.pause?.();
}

function safePlayerTime(player) {
  const value = Number(player?.getCurrentTime?.());
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function loadYouTubeIframeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (window.__screenFlowYouTubeApiPromise) return window.__screenFlowYouTubeApiPromise;

  window.__screenFlowYouTubeApiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve(window.YT);
    };

    let script = document.querySelector('script[data-screenflow-youtube-api="true"]');
    if (!script) {
      script = document.createElement('script');
      script.async = true;
      script.dataset.screenflowYoutubeApi = 'true';
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    }
    script.addEventListener('error', () => reject(new Error('YouTube player could not load.')), { once: true });
  });

  return window.__screenFlowYouTubeApiPromise;
}

const playerShellStyle = {
  aspectRatio: '16 / 9',
  background: '#000000',
  height: '100%',
  minHeight: 0,
  overflow: 'hidden',
  position: 'relative',
  width: '100%'
};

const sharedControlsStyle = {
  alignItems: 'center',
  background: 'rgba(9, 11, 18, 0.9)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: '8px',
  display: 'flex',
  gap: '4px',
  left: '12px',
  padding: '5px',
  position: 'absolute',
  top: '12px',
  zIndex: 12
};

const sharedControlButtonStyle = {
  alignItems: 'center',
  background: '#FFFFFF',
  border: 0,
  borderRadius: '6px',
  color: '#111827',
  cursor: 'pointer',
  display: 'inline-flex',
  height: '34px',
  justifyContent: 'center',
  padding: 0,
  width: '34px'
};

const webPlayerShellStyle = {
  ...playerShellStyle,
  aspectRatio: '4 / 3',
  minHeight: 'min(440px, 56dvh)'
};

const playerSurfaceStyle = {
  height: '100%',
  width: '100%'
};

const directVideoStyle = {
  background: '#000000',
  display: 'block',
  height: '100%',
  objectFit: 'contain',
  width: '100%'
};

const webFrameStyle = {
  background: '#FFFFFF',
  border: 0,
  display: 'block',
  height: '100%',
  minHeight: 0,
  overscrollBehavior: 'contain',
  pointerEvents: 'auto',
  touchAction: 'auto',
  width: '100%'
};

const webBrowserStyle = {
  background: '#FFFFFF',
  display: 'grid',
  gridTemplateRows: '42px minmax(0, 1fr)',
  height: '100%',
  minHeight: 0,
  width: '100%'
};

const webToolbarStyle = {
  alignItems: 'center',
  background: '#F8FAFC',
  borderBottom: '1px solid #DDE4EE',
  color: '#26344D',
  display: 'flex',
  gap: '8px',
  justifyContent: 'flex-start',
  padding: '5px 7px 5px 12px'
};

const webAddressStyle = {
  fontSize: '12px',
  fontWeight: 800,
  maxWidth: '45%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
};

const webToolbarActionsStyle = {
  display: 'flex',
  flexShrink: 0,
  gap: '4px'
};

const webToolButtonStyle = {
  alignItems: 'center',
  background: '#FFFFFF',
  border: '1px solid #DDE4EE',
  borderRadius: '7px',
  color: '#26344D',
  cursor: 'pointer',
  display: 'inline-flex',
  height: '30px',
  justifyContent: 'center',
  padding: 0,
  width: '30px'
};
