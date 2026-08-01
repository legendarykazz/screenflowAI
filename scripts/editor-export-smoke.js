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
    '-t', '4', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', sourcePath
  ], 'source generation');
  run(ffmpegPath, [
    '-y', '-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=48000',
    '-t', '4', '-c:a', 'pcm_s16le', voicePath
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
    duration: 4,
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
      { id: 'screen', role: 'screen', kind: 'video', start: 0, end: 1, enabled: true },
      { id: 'audio', role: 'audio', kind: 'voice', start: 0, end: 1, enabled: true },
      { id: 'broll-smoke', role: 'broll', kind: 'video', sourcePath: brollPath, sourceStart: 0, sourceEnd: 1, start: 0.25, end: 0.5, enabled: true },
      { id: 'sfx-smoke', role: 'sfx', kind: 'sfx', sfxKind: 'pop', start: 0.65, end: 0.75, volume: 0.7, enabled: true }
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

  if (duration < 3.8 || duration > 4.2) throw new Error(`Unexpected output duration: ${duration}`);
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
