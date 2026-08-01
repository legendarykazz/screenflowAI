const MIN_CLIP_LENGTH = 0.08;

const TRACK_DEFINITIONS = [
  { id: 'video-main', label: 'Screen', type: 'video', order: 0, color: '#e5e7eb' },
  { id: 'video-overlay', label: 'B-roll', type: 'video', order: 1, color: '#a78bfa' },
  { id: 'camera', label: 'Camera', type: 'video', order: 2, color: '#60a5fa' },
  { id: 'voice', label: 'Voice', type: 'audio', order: 3, color: '#f59e0b' },
  { id: 'music', label: 'Music & SFX', type: 'audio', order: 4, color: '#34d399' },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function roundTime(value) {
  return Math.round(Math.max(0, Number(value) || 0) * 1000) / 1000;
}

function samePath(left, right) {
  if (!left || !right) return false;
  return String(left).replace(/\\/g, '/').toLowerCase() === String(right).replace(/\\/g, '/').toLowerCase();
}

function inferRole(clip = {}) {
  if (clip.role) return clip.role;
  if (clip.id === 'screen') return 'screen';
  if (clip.id === 'audio') return 'audio';
  if (clip.id === 'webcam') return 'webcam';
  if (clip.kind === 'sfx') return 'sfx';
  if (clip.kind === 'audio' || clip.kind === 'voice') return 'music';
  return 'broll';
}

function inferKind(clip = {}, role = inferRole(clip)) {
  if (clip.kind) return clip.kind;
  if (role === 'audio') return 'voice';
  if (role === 'webcam') return 'webcam';
  if (role === 'sfx') return 'sfx';
  return 'video';
}

function inferTrackId(clip = {}, role = inferRole(clip), kind = inferKind(clip, role)) {
  if (clip.trackId) return clip.trackId;
  if (role === 'screen') return 'video-main';
  if (role === 'webcam' || kind === 'webcam') return 'camera';
  if (role === 'audio' || kind === 'voice') return 'voice';
  if (role === 'music' || role === 'sfx' || kind === 'audio' || kind === 'sfx') return 'music';
  return 'video-overlay';
}

function getTrackDefinition(trackId) {
  return TRACK_DEFINITIONS.find((track) => track.id === trackId) || TRACK_DEFINITIONS[1];
}

function getProjectDuration(project, fallback = 0) {
  return Math.max(MIN_CLIP_LENGTH, Number(project?.duration) || Number(fallback) || MIN_CLIP_LENGTH);
}

function getPrimaryVideoPath(project = {}) {
  return project.raw_video_path || project.video_path || '';
}

function hasSeparateWebcam(project = {}, settings = project.settings || {}) {
  const cameraPath = project.webcam_path;
  const primaryPath = getPrimaryVideoPath(project);
  return Boolean(cameraPath && settings.webcam_baked !== true && !samePath(cameraPath, primaryPath) && !samePath(cameraPath, project.video_path));
}

function syncLegacyBounds(clip, projectDuration) {
  const duration = Math.max(MIN_CLIP_LENGTH, Number(projectDuration) || Number(clip.timelineEnd) || MIN_CLIP_LENGTH);
  return {
    ...clip,
    timelineStart: roundTime(clip.timelineStart),
    timelineEnd: roundTime(clip.timelineEnd),
    sourceStart: roundTime(clip.sourceStart),
    sourceEnd: roundTime(clip.sourceEnd),
    start: clamp(clip.timelineStart / duration, 0, 1),
    end: clamp(clip.timelineEnd / duration, 0, 1),
  };
}

function normalizeClip(clip, project, projectDuration) {
  const duration = getProjectDuration(project, projectDuration);
  const role = inferRole(clip);
  const kind = inferKind(clip, role);
  const trackId = inferTrackId(clip, role, kind);
  const track = getTrackDefinition(trackId);
  const timelineStart = Number.isFinite(Number(clip.timelineStart))
    ? clamp(clip.timelineStart, 0, Number.MAX_SAFE_INTEGER)
    : clamp((Number(clip.start) || 0) * duration, 0, duration);
  const legacyEnd = Number.isFinite(Number(clip.end)) ? Number(clip.end) * duration : duration;
  const timelineEnd = Number.isFinite(Number(clip.timelineEnd))
    ? Math.max(timelineStart + MIN_CLIP_LENGTH, Number(clip.timelineEnd))
    : Math.max(timelineStart + MIN_CLIP_LENGTH, legacyEnd);
  const clipLength = timelineEnd - timelineStart;
  const primaryRole = role === 'screen' || role === 'audio' || role === 'webcam';
  const sourceStart = Number.isFinite(Number(clip.sourceStart))
    ? Math.max(0, Number(clip.sourceStart))
    : primaryRole ? timelineStart : 0;
  const sourceEnd = Number.isFinite(Number(clip.sourceEnd))
    ? Math.max(sourceStart + MIN_CLIP_LENGTH, Number(clip.sourceEnd))
    : sourceStart + clipLength;
  const sourcePath = clip.sourcePath
    || (role === 'screen' ? getPrimaryVideoPath(project) : '')
    || (role === 'audio' ? project.audio_path || getPrimaryVideoPath(project) : '')
    || (role === 'webcam' ? project.webcam_path : '');

  const clipId = String(clip.id || `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const defaultLinkGroup = /^(screen|audio|webcam)(-split-.*)?$/.test(clipId) ? 'recording-main' : null;

  return syncLegacyBounds({
    ...clip,
    id: clipId,
    role,
    kind,
    trackId,
    track: track.order,
    color: clip.color || track.color,
    label: clip.label || (role === 'screen' ? 'Screen Recording' : role === 'audio' ? 'Microphone' : track.label),
    sourcePath,
    timelineStart,
    timelineEnd,
    sourceStart,
    sourceEnd,
    speed: Math.max(0.1, Number(clip.speed) || 1),
    volume: clip.volume == null ? (kind === 'video' ? 0 : 1) : clamp(clip.volume, 0, 2),
    enabled: clip.enabled !== false,
    linkGroupId: clip.linkGroupId || defaultLinkGroup,
  }, duration);
}

function createDefaultTimeline(project = {}, projectDuration) {
  const duration = getProjectDuration(project, projectDuration);
  const primaryPath = getPrimaryVideoPath(project);
  const clips = [];

  if (primaryPath) {
    clips.push(normalizeClip({
      id: 'screen',
      role: 'screen',
      kind: 'video',
      label: 'Screen Recording',
      sourcePath: primaryPath,
      timelineStart: 0,
      timelineEnd: duration,
      sourceStart: 0,
      sourceEnd: duration,
      volume: 0,
    }, project, duration));
  }

  if (project.audio_path) {
    clips.push(normalizeClip({
      id: 'audio',
      role: 'audio',
      kind: 'voice',
      label: 'Microphone',
      sourcePath: project.audio_path,
      timelineStart: 0,
      timelineEnd: duration,
      sourceStart: 0,
      sourceEnd: duration,
      volume: 1,
    }, project, duration));
  }

  if (hasSeparateWebcam(project)) {
    clips.push(normalizeClip({
      id: 'webcam',
      role: 'webcam',
      kind: 'webcam',
      label: 'Camera',
      sourcePath: project.webcam_path,
      timelineStart: 0,
      timelineEnd: duration,
      sourceStart: 0,
      sourceEnd: duration,
      volume: 0,
    }, project, duration));
  }

  return clips;
}

function migrateTimelineClips(clips, project = {}, projectDuration) {
  const source = Array.isArray(clips) && clips.length ? clips : createDefaultTimeline(project, projectDuration);
  const separateWebcam = hasSeparateWebcam(project);
  const migrated = source
    .map((clip) => normalizeClip(clip, project, projectDuration))
    .filter((clip) => clip.role !== 'webcam' || (separateWebcam && clip.sourcePath));
  const seen = new Set();
  return migrated.map((clip) => {
    if (!seen.has(clip.id)) {
      seen.add(clip.id);
      return clip;
    }
    const next = { ...clip, id: `${clip.id}-${seen.size + 1}` };
    seen.add(next.id);
    return next;
  });
}

function createMediaLibrary(project = {}, existing = [], projectDuration) {
  const duration = getProjectDuration(project, projectDuration);
  const primaryPath = getPrimaryVideoPath(project);
  const builtIns = [];
  if (primaryPath) {
    builtIns.push({
      id: 'asset-screen',
      name: 'Screen Recording',
      kind: 'video',
      role: 'screen',
      sourcePath: primaryPath,
      duration,
      builtin: true,
    });
  }
  if (project.audio_path) {
    builtIns.push({
      id: 'asset-voice',
      name: 'Microphone',
      kind: 'audio',
      role: 'audio',
      sourcePath: project.audio_path,
      duration,
      builtin: true,
    });
  }
  if (hasSeparateWebcam(project)) {
    builtIns.push({
      id: 'asset-camera',
      name: 'Camera',
      kind: 'webcam',
      role: 'webcam',
      sourcePath: project.webcam_path,
      duration,
      builtin: true,
    });
  }

  const byPath = new Map();
  [...builtIns, ...(Array.isArray(existing) ? existing : [])].forEach((asset) => {
    if (!asset?.sourcePath) return;
    const key = String(asset.sourcePath).replace(/\\/g, '/').toLowerCase();
    if (!byPath.has(key)) {
      byPath.set(key, {
        ...asset,
        id: String(asset.id || `asset-${Date.now()}-${byPath.size}`),
        name: asset.name || asset.label || 'Untitled media',
        duration: Math.max(MIN_CLIP_LENGTH, Number(asset.duration) || duration),
      });
    }
  });
  return [...byPath.values()];
}

function clipStartSeconds(clip, projectDuration) {
  if (Number.isFinite(Number(clip?.timelineStart))) return Math.max(0, Number(clip.timelineStart));
  return Math.max(0, (Number(clip?.start) || 0) * Math.max(MIN_CLIP_LENGTH, Number(projectDuration) || MIN_CLIP_LENGTH));
}

function clipEndSeconds(clip, projectDuration) {
  if (Number.isFinite(Number(clip?.timelineEnd))) return Math.max(clipStartSeconds(clip, projectDuration), Number(clip.timelineEnd));
  return Math.max(clipStartSeconds(clip, projectDuration), (Number(clip?.end) || 0) * Math.max(MIN_CLIP_LENGTH, Number(projectDuration) || MIN_CLIP_LENGTH));
}

function getTimelineDuration(clips, fallback = 0) {
  const enabled = Array.isArray(clips) ? clips.filter((clip) => clip?.enabled !== false) : [];
  const end = enabled.reduce((maximum, clip) => Math.max(maximum, clipEndSeconds(clip, fallback)), 0);
  return Math.max(MIN_CLIP_LENGTH, end || Number(fallback) || MIN_CLIP_LENGTH);
}

function timelineToSourceTime(clip, timelineTime, projectDuration) {
  const start = clipStartSeconds(clip, projectDuration);
  const sourceStart = Math.max(0, Number(clip?.sourceStart) || 0);
  const speed = Math.max(0.1, Number(clip?.speed) || 1);
  return sourceStart + Math.max(0, Number(timelineTime) - start) * speed;
}

function splitClipAt(clips, clipId, timelineTime, projectDuration) {
  const list = Array.isArray(clips) ? clips : [];
  const index = list.findIndex((clip) => clip.id === clipId);
  if (index < 0) return { clips: list, rightClipId: null, changed: false };
  const clip = normalizeClip(list[index], {}, projectDuration);
  const start = clipStartSeconds(clip, projectDuration);
  const end = clipEndSeconds(clip, projectDuration);
  const cut = Number(timelineTime);
  if (!Number.isFinite(cut) || cut <= start + MIN_CLIP_LENGTH || cut >= end - MIN_CLIP_LENGTH) {
    return { clips: list, rightClipId: null, changed: false };
  }
  const sourceCut = timelineToSourceTime(clip, cut, projectDuration);
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const left = syncLegacyBounds({ ...clip, timelineEnd: cut, sourceEnd: sourceCut }, projectDuration);
  const right = syncLegacyBounds({
    ...clip,
    id: `${clip.id}-split-${suffix}`,
    label: clip.label,
    timelineStart: cut,
    sourceStart: sourceCut,
  }, projectDuration);
  const next = [...list];
  next.splice(index, 1, left, right);
  return { clips: next, rightClipId: right.id, changed: true };
}

function splitLinkedClipsAt(clips, clipId, timelineTime, projectDuration) {
  const list = Array.isArray(clips) ? clips : [];
  const selected = list.find((clip) => clip.id === clipId);
  if (!selected) return { clips: list, rightClipId: null, changed: false, splitCount: 0 };
  const normalizedSelected = normalizeClip(selected, {}, projectDuration);
  const linkedIds = normalizedSelected.linkGroupId
    ? list
      .map((clip) => normalizeClip(clip, {}, projectDuration))
      .filter((clip) => clip.linkGroupId === normalizedSelected.linkGroupId)
      .map((clip) => clip.id)
    : [normalizedSelected.id];

  let next = list;
  let rightClipId = null;
  let splitCount = 0;
  linkedIds.forEach((targetId) => {
    const result = splitClipAt(next, targetId, timelineTime, projectDuration);
    if (!result.changed) return;
    next = result.clips;
    splitCount += 1;
    if (targetId === normalizedSelected.id) rightClipId = result.rightClipId;
  });

  return {
    clips: next,
    rightClipId,
    changed: splitCount > 0,
    splitCount,
  };
}

function rippleDeleteRange(clips, deleteStart, deleteEnd, projectDuration, options = {}) {
  const start = Math.max(0, Number(deleteStart) || 0);
  const end = Math.max(start, Number(deleteEnd) || start);
  const gap = end - start;
  if (gap < MIN_CLIP_LENGTH) return Array.isArray(clips) ? clips : [];
  const excludedId = options.excludeId || null;
  const result = [];

  (Array.isArray(clips) ? clips : []).forEach((sourceClip) => {
    if (sourceClip.id === excludedId) return;
    const clip = normalizeClip(sourceClip, {}, projectDuration);
    const clipStart = clipStartSeconds(clip, projectDuration);
    const clipEnd = clipEndSeconds(clip, projectDuration);

    if (clipEnd <= start) {
      result.push(clip);
      return;
    }
    if (clipStart >= end) {
      result.push(syncLegacyBounds({
        ...clip,
        timelineStart: clipStart - gap,
        timelineEnd: clipEnd - gap,
      }, projectDuration));
      return;
    }
    if (clipStart >= start && clipEnd <= end) return;

    if (clipStart < start && clipEnd > end) {
      const leftSourceEnd = timelineToSourceTime(clip, start, projectDuration);
      const rightSourceStart = timelineToSourceTime(clip, end, projectDuration);
      result.push(syncLegacyBounds({
        ...clip,
        timelineEnd: start,
        sourceEnd: leftSourceEnd,
      }, projectDuration));
      result.push(syncLegacyBounds({
        ...clip,
        id: `${clip.id}-ripple-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        timelineStart: start,
        timelineEnd: clipEnd - gap,
        sourceStart: rightSourceStart,
      }, projectDuration));
      return;
    }

    if (clipStart < start) {
      result.push(syncLegacyBounds({
        ...clip,
        timelineEnd: start,
        sourceEnd: timelineToSourceTime(clip, start, projectDuration),
      }, projectDuration));
      return;
    }

    result.push(syncLegacyBounds({
      ...clip,
      timelineStart: start,
      timelineEnd: clipEnd - gap,
      sourceStart: timelineToSourceTime(clip, end, projectDuration),
    }, projectDuration));
  });

  return result.filter((clip) => clip.timelineEnd - clip.timelineStart >= MIN_CLIP_LENGTH);
}

function rippleDeleteClip(clips, clipId, projectDuration) {
  const selected = (Array.isArray(clips) ? clips : []).find((clip) => clip.id === clipId);
  if (!selected) return Array.isArray(clips) ? clips : [];
  return rippleDeleteRange(
    clips,
    clipStartSeconds(selected, projectDuration),
    clipEndSeconds(selected, projectDuration),
    projectDuration,
    { excludeId: clipId }
  );
}

function snapTime(value, clips, projectDuration, options = {}) {
  const raw = Math.max(0, Number(value) || 0);
  if (options.enabled === false) return raw;
  const threshold = Math.max(0.02, Number(options.threshold) || 0.12);
  const points = [0, Number(projectDuration) || 0, Number(options.playhead) || 0];
  (Array.isArray(clips) ? clips : []).forEach((clip) => {
    if (clip.id === options.excludeId) return;
    points.push(clipStartSeconds(clip, projectDuration), clipEndSeconds(clip, projectDuration));
  });
  let snapped = raw;
  let distance = threshold;
  points.forEach((point) => {
    const nextDistance = Math.abs(raw - point);
    if (nextDistance <= distance) {
      snapped = point;
      distance = nextDistance;
    }
  });
  return Math.max(0, snapped);
}

function updateClipTiming(clip, updates, projectDuration) {
  const current = normalizeClip(clip, {}, projectDuration);
  const nextStart = Number.isFinite(Number(updates.timelineStart)) ? Number(updates.timelineStart) : current.timelineStart;
  const nextEnd = Number.isFinite(Number(updates.timelineEnd)) ? Number(updates.timelineEnd) : current.timelineEnd;
  const mode = updates.mode || 'move';
  let sourceStart = current.sourceStart;
  let sourceEnd = current.sourceEnd;
  if (mode === 'trim-start') sourceStart += (nextStart - current.timelineStart) * current.speed;
  if (mode === 'trim-end') sourceEnd += (nextEnd - current.timelineEnd) * current.speed;
  return syncLegacyBounds({
    ...current,
    ...updates,
    timelineStart: roundTime(nextStart),
    timelineEnd: roundTime(Math.max(nextStart + MIN_CLIP_LENGTH, nextEnd)),
    sourceStart: roundTime(Math.max(0, sourceStart)),
    sourceEnd: roundTime(Math.max(sourceStart + MIN_CLIP_LENGTH, sourceEnd)),
  }, projectDuration);
}

function getVisibleTracks(clips) {
  const ids = new Set((Array.isArray(clips) ? clips : []).map((clip) => inferTrackId(clip)));
  return TRACK_DEFINITIONS.filter((track) => ids.has(track.id));
}

const editorTimelineTools = {
  MIN_CLIP_LENGTH,
  TRACK_DEFINITIONS,
  createDefaultTimeline,
  createMediaLibrary,
  migrateTimelineClips,
  normalizeClip,
  syncLegacyBounds,
  clipStartSeconds,
  clipEndSeconds,
  getTimelineDuration,
  timelineToSourceTime,
  splitClipAt,
  splitLinkedClipsAt,
  rippleDeleteRange,
  rippleDeleteClip,
  snapTime,
  updateClipTiming,
  getVisibleTracks,
  hasSeparateWebcam,
  getPrimaryVideoPath,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = editorTimelineTools;
}

if (typeof globalThis !== 'undefined') {
  globalThis.ScreenFlowEditorTimeline = editorTimelineTools;
}
