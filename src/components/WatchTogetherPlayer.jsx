import React, { useEffect, useRef } from 'react';
import { projectedWatchTime } from '../lib/watchTogether';

const PLAYER_SYNC_INTERVAL = 4000;
const PLAYER_DRIFT_TOLERANCE = 1.25;

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

  useEffect(() => {
    sessionRef.current = session;
    playbackCallbackRef.current = onPlaybackChange;
    errorCallbackRef.current = onPlayerError;
  }, [onPlaybackChange, onPlayerError, session]);

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
            controls: 1,
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
        if (player?.getPlayerState?.() === window.YT?.PlayerState?.PLAYING) {
          playbackCallbackRef.current?.({ currentTime: safePlayerTime(player), playing: true, updatedAt: Date.now() });
        }
        return;
      }

      const video = directVideoRef.current;
      if (video && !video.paused && !video.ended) {
        playbackCallbackRef.current?.({ currentTime: video.currentTime || 0, playing: true, updatedAt: Date.now() });
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

  if (!session) return null;

  return (
    <div data-watch-kind={session.kind} data-watch-player="true" style={playerShellStyle}>
      {session.kind === 'youtube' && <div ref={youtubeHostRef} style={playerSurfaceStyle} />}
      {session.kind === 'video' && (
        <video
          controls
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
        <iframe
          allow="autoplay; clipboard-read; clipboard-write; fullscreen; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
          src={session.url}
          style={webFrameStyle}
          title={`Shared page: ${session.label}`}
        />
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
  width: '100%'
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
  width: '100%'
};
