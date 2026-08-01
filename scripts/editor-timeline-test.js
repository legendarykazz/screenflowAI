const assert = require('assert');
const timeline = require('../shared/editor-timeline.cjs');

function clip(id, role, trackId, start, end, sourceStart = start, sourceEnd = end) {
  return timeline.normalizeClip({
    id,
    role,
    kind: role === 'audio' ? 'voice' : 'video',
    trackId,
    timelineStart: start,
    timelineEnd: end,
    sourceStart,
    sourceEnd,
  }, {}, 10);
}

const bakedProject = {
  video_path: 'C:\\recording.mp4',
  raw_video_path: 'C:\\recording.mp4',
  audio_path: 'C:\\recording.mp4',
  webcam_path: 'C:\\recording.mp4',
  duration: 10,
  settings: { webcam_baked: true },
};
const bakedTimeline = timeline.createDefaultTimeline(bakedProject);
assert.deepStrictEqual(bakedTimeline.map((item) => item.trackId), ['video-main', 'voice']);
assert.ok(!bakedTimeline.some((item) => item.trackId === 'camera'), 'baked camera must not create a camera track');

const separateCameraTimeline = timeline.createDefaultTimeline({
  ...bakedProject,
  webcam_path: 'C:\\camera.mp4',
  settings: { webcam_baked: false },
});
assert.ok(separateCameraTimeline.some((item) => item.trackId === 'camera'), 'separate camera media must create a camera track');

const migrated = timeline.migrateTimelineClips([
  { id: 'screen', role: 'screen', kind: 'video', start: 0.2, end: 0.8 },
  { id: 'webcam', role: 'webcam', kind: 'webcam', start: 0, end: 1 },
], bakedProject, 10);
assert.strictEqual(migrated.length, 1, 'phantom legacy camera clip should be removed');
assert.strictEqual(migrated[0].timelineStart, 2);
assert.strictEqual(migrated[0].timelineEnd, 8);
assert.strictEqual(migrated[0].sourceStart, 2);

const original = clip('screen', 'screen', 'video-main', 0, 10, 0, 10);
const split = timeline.splitClipAt([original], 'screen', 4.25, 10);
assert.ok(split.changed);
assert.strictEqual(split.clips.length, 2);
assert.strictEqual(split.clips[0].sourceEnd, 4.25);
assert.strictEqual(split.clips[1].sourceStart, 4.25);

const linkedSplit = timeline.splitLinkedClipsAt([
  timeline.normalizeClip({ ...original, linkGroupId: 'recording-main' }, {}, 10),
  timeline.normalizeClip({
    id: 'audio',
    role: 'audio',
    kind: 'voice',
    trackId: 'voice',
    timelineStart: 0,
    timelineEnd: 10,
    sourceStart: 0,
    sourceEnd: 10,
    linkGroupId: 'recording-main',
  }, {}, 10),
], 'screen', 6, 10);
assert.ok(linkedSplit.changed);
assert.strictEqual(linkedSplit.splitCount, 2, 'linked screen and voice clips should split together');
assert.strictEqual(linkedSplit.clips.filter((item) => item.trackId === 'video-main').length, 2);
assert.strictEqual(linkedSplit.clips.filter((item) => item.trackId === 'voice').length, 2);

const rippled = timeline.rippleDeleteRange([
  clip('screen', 'screen', 'video-main', 0, 10, 0, 10),
  clip('voice', 'audio', 'voice', 0, 10, 0, 10),
  clip('title', 'broll', 'video-overlay', 6, 8, 0, 2),
], 2, 4, 10);
assert.strictEqual(timeline.getTimelineDuration(rippled, 0), 8);
const screenPieces = rippled.filter((item) => item.role === 'screen');
assert.strictEqual(screenPieces.length, 2);
assert.deepStrictEqual(screenPieces.map((item) => [item.timelineStart, item.timelineEnd]), [[0, 2], [2, 8]]);
assert.deepStrictEqual(screenPieces.map((item) => [item.sourceStart, item.sourceEnd]), [[0, 2], [4, 10]]);
const shiftedTitle = rippled.find((item) => item.id === 'title');
assert.deepStrictEqual([shiftedTitle.timelineStart, shiftedTitle.timelineEnd], [4, 6]);

assert.strictEqual(timeline.snapTime(4.92, [clip('a', 'screen', 'video-main', 0, 5)], 10, { threshold: 0.12 }), 5);
assert.strictEqual(timeline.snapTime(4.7, [clip('a', 'screen', 'video-main', 0, 5)], 10, { threshold: 0.12 }), 4.7);

console.log('Editor timeline tests passed');
