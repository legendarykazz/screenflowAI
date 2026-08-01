const VIDEO_FILE_PATTERN = /\.(mp4|m4v|webm|ogv|ogg|mov|m3u8)(?:$|[?#])/i;
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const BLOCKED_STREAMING_HOSTS = [
  'netflix.com',
  'disneyplus.com',
  'hulu.com',
  'primevideo.com',
  'max.com',
  'hbomax.com',
  'peacocktv.com',
  'paramountplus.com'
];

export function parseWatchSource(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) throw new Error('Paste a YouTube, direct video, or web page link.');
  if (value.length > 2048) throw new Error('The shared link is too long.');

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch (error) {
    throw new Error('Enter a valid web address.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP and HTTPS links can be shared.');
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  if (BLOCKED_STREAMING_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
    throw new Error('This subscription service blocks embedded watch rooms. Use a YouTube or direct video link.');
  }

  const videoId = getYouTubeVideoId(url);
  if (videoId) {
    return {
      kind: 'youtube',
      label: 'YouTube',
      url: url.href,
      videoId
    };
  }

  if (VIDEO_FILE_PATTERN.test(`${url.pathname}${url.search}`)) {
    const filename = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || 'Direct video');
    return {
      kind: 'video',
      label: filename,
      url: url.href
    };
  }

  return {
    kind: 'web',
    label: hostname,
    url: url.href
  };
}

export function createWatchSession(source) {
  return {
    ...source,
    currentTime: 0,
    playing: false,
    sessionId: createSessionId(),
    updatedAt: Date.now()
  };
}

export function normalizeWatchSession(value) {
  if (!value || typeof value !== 'object') return null;

  try {
    const source = parseWatchSource(value.url);
    if (source.kind !== value.kind) return null;
    if (source.kind === 'youtube' && source.videoId !== value.videoId) return null;

    const currentTime = Number(value.currentTime);
    const updatedAt = Number(value.updatedAt);
    return {
      ...source,
      currentTime: Number.isFinite(currentTime) ? clamp(currentTime, 0, 172800) : 0,
      playing: source.kind === 'web' ? false : Boolean(value.playing),
      sessionId: String(value.sessionId || '').slice(0, 80) || createSessionId(),
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now()
    };
  } catch (error) {
    return null;
  }
}

export function projectedWatchTime(session, now = Date.now()) {
  if (!session) return 0;
  const currentTime = Number(session.currentTime) || 0;
  if (!session.playing) return Math.max(0, currentTime);
  const elapsed = Math.max(0, now - (Number(session.updatedAt) || now)) / 1000;
  return Math.max(0, currentTime + elapsed);
}

function getYouTubeVideoId(url) {
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  let candidate = '';

  if (hostname === 'youtu.be') {
    candidate = url.pathname.split('/').filter(Boolean)[0] || '';
  } else if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com') || hostname === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') candidate = url.searchParams.get('v') || '';
    if (!candidate) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (['embed', 'shorts', 'live'].includes(parts[0])) candidate = parts[1] || '';
    }
  }

  return YOUTUBE_ID_PATTERN.test(candidate) ? candidate : '';
}

function createSessionId() {
  return globalThis.crypto?.randomUUID?.() || `watch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
