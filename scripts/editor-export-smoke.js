const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const db = require('../electron/database');
const { renderAndExport } = require('../electron/renderer-engine');
const { ffmpegPath, ffprobePath } = require('../electron/media-tools');

const root = path.resolve(__dirname, '..');
const tempDir = path.join(root, '.tmp-editor-export');
const sourcePath = path.join(tempDir, 'source.mp4');
const voicePath = path.join(tempDir, 'voice.wav');
const brollPath = path.join(tempDir, 'broll.mp4');
const outputPath = path.join(tempDir, 'edited-output.mp4');

function run(binary, args, label) {
  console.log(`${label}...`);
  const result = spawnSync(binary, args, { encoding: 'utf8', timeout: 120_000 });
  if (result.status !== 0) {
    throw new Error(`${label} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

async function main() {
  process.env.SCREENFLOW_EXPORT_TIMEOUT_MS = '45000';
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });

  console.log('Preparing synthetic media...');
  run(ffmpegPath, [
    '-y', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30',
    '-t', '6', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', sourcePath
  ], 'source generation');
  run(ffmpegPath, [
    '-y', '-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=48000',
    '-t', '6', '-c:a', 'pcm_s16le', voicePath
  ], 'voice generation');
  run(ffmpegPath, [
    '-y', '-f', 'lavfi', '-i', 'color=c=0x6d28d9:size=640x360:rate=30',
    '-t', '1', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', brollPath
  ], 'B-roll generation');

  db.initDatabase(tempDir);
  db.createProject('editor-smoke', 'Editor export smoke test');
  db.updateProject('editor-smoke', {
    video_path: sourcePath,
    raw_video_path: sourcePath,
    audio_path: voicePath,
    duration: 6,
    zoom_level: 1,
    cursor_baked: true,
    voice_cleanup_enabled: true,
    voice_isolation: 60,
    voice_gain: 1,
    normalize_audio: true,
    color_exposure: 4,
    color_contrast: 8,
    color_saturation: 12,
    color_temperature: 8,
    timeline_clips: [
      { id: 'screen-a', role: 'screen', kind: 'video', trackId: 'video-main', timelineStart: 0, timelineEnd: 2, sourceStart: 0, sourceEnd: 2, enabled: true, grade: { color_contrast: 12 } },
      { id: 'screen-b', role: 'screen', kind: 'video', trackId: 'video-main', timelineStart: 2, timelineEnd: 3, sourceStart: 4, sourceEnd: 6, speed: 2, enabled: true },
      { id: 'audio-a', role: 'audio', kind: 'voice', trackId: 'voice', timelineStart: 0, timelineEnd: 2, sourceStart: 0, sourceEnd: 2, enabled: true, audioCleanup: { noiseReduction: true, isolation: 60, fadeIn: 0.1 } },
      { id: 'audio-b', role: 'audio', kind: 'voice', trackId: 'voice', timelineStart: 2, timelineEnd: 3, sourceStart: 4, sourceEnd: 6, speed: 2, enabled: true, audioCleanup: { noiseReduction: true, isolation: 60, fadeOut: 0.1 } },
      { id: 'broll-smoke', role: 'broll', kind: 'video', trackId: 'video-overlay', sourcePath: brollPath, sourceStart: 0, sourceEnd: 1, timelineStart: 0.5, timelineEnd: 1.5, enabled: true },
      { id: 'sfx-smoke', role: 'sfx', kind: 'sfx', trackId: 'music', sfxKind: 'pop', timelineStart: 2.55, timelineEnd: 2.75, sourceStart: 0, sourceEnd: 0.2, volume: 0.7, enabled: true }
    ]
  });

  console.log('Rendering edited output...');
  await renderAndExport('editor-smoke', outputPath, 'mp4', 'low', true, () => {});
  console.log('Inspecting edited output...');
  const probeOutput = run(ffprobePath, [
    '-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type', '-of', 'json', outputPath
  ], 'output probe');
  const probe = JSON.parse(probeOutput);
  const duration = Number(probe.format?.duration || 0);
  const streamTypes = new Set((probe.streams || []).map((stream) => stream.codec_type));

  if (duration < 2.8 || duration > 3.2) throw new Error(`Unexpected output duration: ${duration}`);
  if (!streamTypes.has('video')) throw new Error('Rendered output is missing video');
  if (!streamTypes.has('audio')) throw new Error('Rendered output is missing audio');
  if (Number(probe.format?.size || 0) < 10_000) throw new Error('Rendered output file is unexpectedly small');

  console.log(`Editor export smoke test passed: ${duration.toFixed(2)}s, ${[...streamTypes].join(' + ')}, ${probe.format.size} bytes`);
  fs.rmSync(tempDir, { recursive: true, force: true });
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
