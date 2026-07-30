const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const failures = [];
const passes = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function pass(message) {
  passes.push(message);
}

function fail(message) {
  failures.push(message);
}

function assertIncludes(source, needle, message) {
  if (source.includes(needle)) pass(message);
  else fail(`${message} (missing: ${needle})`);
}

function assertMatches(source, pattern, message) {
  if (pattern.test(source)) pass(message);
  else fail(`${message} (missing pattern: ${pattern})`);
}

function checkRequiredFiles() {
  [
    'src/main.jsx',
    'src/pages/Recording.jsx',
    'src/pages/Editor.jsx',
    'src/pages/AITools.jsx',
    'src/pages/FootballLab.jsx',
    'src/pages/LiveCall.jsx',
    'src/pages/JoinCall.jsx',
    'src/lib/callAudio.js',
    'src/lib/pwa.js',
    'public/manifest.webmanifest',
    'public/sw.js',
    'extension/manifest.json',
    'extension/background.js',
    'extension/offscreen.js',
    'api/livekit-token.js',
    'electron/main.js',
    'electron/preload.js'
  ].forEach((file) => {
    if (fs.existsSync(path.join(root, file))) pass(`Required file exists: ${file}`);
    else fail(`Required file is missing: ${file}`);
  });
}

function checkRouting() {
  const main = read('src/main.jsx');
  assertIncludes(main, "window.location.pathname.startsWith('/join/')", 'Join links render the mobile JoinCall page');
  assertIncludes(main, "case 'recording':", 'Recording page is routed');
  assertIncludes(main, "case 'projects':", 'Projects page is routed');
  assertIncludes(main, "case 'aitools':", 'AI Tools page is routed');
  assertIncludes(main, "case 'livecall':", 'Live Call page is routed');
  assertIncludes(main, "case 'football':", 'Football Lab page is routed');
}

function checkLiveKitTokenRoles() {
  const token = read('api/livekit-token.js');
  assertIncludes(token, "role === 'presenter' || role === 'participant'", 'Presenter and participant roles can publish media');
  assertIncludes(token, 'canSubscribe: true', 'LiveKit tokens can subscribe to remote tracks');
  assertIncludes(token, 'canPublishData: canPublish', 'LiveKit data publishing follows media publishing role');
  assertMatches(token, /identity\s*=\s*`\$\{name \|\| 'Guest'\}-\$\{Math\.random\(\)/, 'LiveKit identities are unique per connection');
}

function checkJoinCallMedia() {
  const join = read('src/pages/JoinCall.jsx');
  const callAudio = read('src/lib/callAudio.js');
  assertIncludes(join, "role: 'participant'", 'Join page requests participant role');
  assertIncludes(callAudio, 'echoCancellation: true', 'Join page can request call-optimized microphone audio');
  assertIncludes(callAudio, 'sampleRate: { ideal: 48000 }', 'Conference microphones request 48 kHz voice capture');
  assertIncludes(callAudio, 'AudioPresets.musicHighQuality', 'Conference microphones publish high-quality Opus audio');
  assertIncludes(callAudio, 'red: true', 'Conference voice publishing enables packet redundancy');
  assertIncludes(join, "name: 'participant-mic'", 'Join page publishes participant microphone track');
  assertIncludes(join, "name: 'participant-camera'", 'Join page publishes participant camera track');
  assertIncludes(join, 'VideoQuality.HIGH', 'Join page requests high-quality remote video');
  assertIncludes(join, 'maxBitrate: 5_000_000', 'Join page publishes adaptive high-quality screen video');
  assertIncludes(join, 'const audioRef = useRef(null)', 'Join page has a separate remote audio sink');
  assertIncludes(join, "track.kind === 'audio' ? audioRef", 'Join page routes remote audio away from screen/camera containers');
  assertIncludes(join, 'getRemoteParticipants(room)', 'Join page handles LiveKit remote participant collection defensively');
  assertIncludes(join, "track.source === Track.Source.ScreenShare", 'Join page identifies screen share tracks by source');
  assertIncludes(join, 'controlButtonStyle(micOn)', 'Join page shows active microphone state');
  assertIncludes(join, 'controlButtonStyle(cameraOn)', 'Join page shows active camera state');
  assertIncludes(join, 'RoomEvent.AudioPlaybackStatusChanged', 'Join page detects browser audio playback blocking');
  assertIncludes(join, 'resumeCallAudio(room)', 'Join page can explicitly resume call audio');
  assertIncludes(join, 'targetRef.current.querySelector(`[data-track-sid="${track.sid}"]`)', 'Join page does not detach duplicate remote audio tracks');
}

function checkPresenterLiveCall() {
  const live = read('src/pages/LiveCall.jsx');
  assertIncludes(live, "'screenflow-enhanced-output'", 'Presenter publishes enhanced screen output');
  assertIncludes(live, "'screenflow-raw-output'", 'Presenter can switch to a raw screen output');
  assertIncludes(live, 'const LIVE_OUTPUT_WIDTH = 1920', 'Presenter renders the enhanced output at 1080p');
  assertIncludes(live, 'VideoQuality.HIGH', 'Presenter requests high-quality participant video');
  assertIncludes(live, "name: 'presenter-mic'", 'Presenter publishes microphone track');
  assertIncludes(live, "name: 'presenter-camera'", 'Presenter publishes camera track');
  assertIncludes(live, 'RoomEvent.TrackSubscribed', 'Presenter subscribes to remote participant tracks');
  assertIncludes(live, 'attachRemoteTrack(track, participant)', 'Presenter renders remote media tracks');
  assertIncludes(live, 'updateRemoteParticipants(room)', 'Presenter updates participant count/list');
  assertIncludes(live, 'RoomEvent.AudioPlaybackStatusChanged', 'Presenter detects browser audio playback blocking');
  assertIncludes(live, 'audioSink.querySelector(`[data-track-sid="${track.sid}"]`)', 'Presenter attaches each remote microphone once');
}

function checkElectronBridge() {
  const preload = read('electron/preload.js');
  const main = read('electron/main.js');
  const settings = read('src/pages/Settings.jsx');
  assertIncludes(preload, 'createLiveKitToken', 'Preload exposes LiveKit token bridge');
  assertIncludes(preload, 'saveRecordedFile', 'Preload exposes recording save bridge');
  assertIncludes(preload, 'saveAIKeys', 'Preload exposes saved settings bridge');
  assertIncludes(main, 'livekit-server-sdk', 'Electron main can mint LiveKit presenter tokens');
  assertIncludes(main, 'savedLiveKit', 'Electron main can read saved LiveKit settings');
  assertIncludes(main, 'https://screenflow-ai.vercel.app/api/livekit-token', 'Electron main can fall back to hosted LiveKit token service');
  assertIncludes(main, 'desktopCapturer.getSources', 'Electron main can list screen/window sources');
  assertIncludes(main, "ipcMain.handle('recording:save-file'", 'Electron main can save recorded videos');
  assertIncludes(settings, 'handleSaveLiveKit', 'Settings page can save LiveKit credentials');
}

function checkRecordingPipeline() {
  const recording = read('src/pages/Recording.jsx');
  const editor = read('src/pages/Editor.jsx');
  const main = read('electron/main.js');
  const renderer = read('electron/renderer-engine.js');
  const database = read('electron/database.js');

  assertIncludes(recording, 'videoBitsPerSecond: 12_000_000', '1080p recording uses an explicit high-quality bitrate');
  assertIncludes(recording, "sampleRate: { ideal: 48000 }", 'Microphone capture requests 48 kHz audio');
  assertIncludes(recording, 'createDynamicsCompressor()', 'Mixed audio is protected from clipping');
  assertIncludes(recording, 'mediaRecorder.start(1000)', 'Recorder flushes media chunks throughout capture');
  assertIncludes(recording, 'recorder.requestData()', 'Recorder requests the final media chunk before stopping');
  assertIncludes(main, "coordinate_space: 'normalized'", 'Global cursor tracking stores DPI-safe normalized coordinates');
  assertIncludes(database, 'coordinate_space: e.coordinate_space || null', 'Cursor coordinate metadata persists with projects');
  assertIncludes(editor, "previous.coordinate_space === 'normalized'", 'Editor understands normalized cursor coordinates');
  assertIncludes(editor, 'mediaDuration || duration || 0', 'Editor playback follows the actual media duration');
  assertIncludes(renderer, 'project.raw_video_path && fs.existsSync(project.raw_video_path)', 'Exports use the untouched source recording');
}

function checkPlatformShells() {
  const main = read('src/main.jsx');
  const pwa = read('src/lib/pwa.js');
  const serviceWorker = read('public/sw.js');
  const extensionManifest = JSON.parse(read('extension/manifest.json'));
  const extensionBackground = read('extension/background.js');
  const extensionRecorder = read('extension/offscreen.js');
  const packageJson = JSON.parse(read('package.json'));
  const viteConfig = read('vite.config.js');
  const releaseWorkflow = read('.github/workflows/release-platforms.yml');

  assertIncludes(main, 'getInitialPage', 'PWA shortcuts can open a specific ScreenFlow workspace');
  assertIncludes(main, '<InstallPrompt />', 'Web app exposes an install action when the browser permits it');
  assertIncludes(pwa, "navigator.serviceWorker.register('/sw.js'", 'Production web app registers the service worker');
  assertIncludes(serviceWorker, "caches.match('/offline.html')", 'PWA provides an offline navigation fallback');
  if (extensionManifest.manifest_version === 3) pass('Chrome companion uses Manifest V3');
  else fail('Chrome companion must use Manifest V3');
  if (Number(extensionManifest.minimum_chrome_version) >= 116) pass('Chrome companion requires offscreen-capable Chrome');
  else fail('Chrome companion must require Chrome 116 or newer');
  if (extensionManifest.permissions?.includes('tabCapture') && extensionManifest.permissions?.includes('offscreen')) {
    pass('Chrome companion declares tab capture and offscreen permissions');
  } else {
    fail('Chrome companion is missing tab capture or offscreen permission');
  }
  assertIncludes(extensionBackground, 'chrome.tabCapture.getMediaStreamId', 'Chrome companion requests the active tab stream');
  assertIncludes(extensionRecorder, 'videoBitsPerSecond: 12_000_000', 'Chrome companion records high-quality tab video');
  assertIncludes(extensionRecorder, 'recorder.requestData()', 'Chrome companion flushes the final media chunk');
  assertIncludes(viteConfig, "mode === 'desktop'", 'Web and desktop builds use platform-safe asset paths');
  if (packageJson.scripts?.['build:desktop']?.includes('--mode desktop')) {
    pass('Windows packaging selects the desktop Vite mode');
  } else {
    fail('Windows packaging does not select the desktop Vite mode');
  }
  assertIncludes(releaseWorkflow, 'run: npm run dist:win', 'CI packages Windows with the desktop build');
  assertIncludes(releaseWorkflow, 'run: npm run release:win', 'Tagged CI releases use the desktop build');
  if (packageJson.build?.publish?.owner === 'legendarykazz' && packageJson.build?.publish?.repo === 'screenflowAI') {
    pass('Windows updater targets the ScreenFlowAI GitHub repository');
  } else {
    fail('Windows updater GitHub repository is not configured correctly');
  }
}

function runBuild() {
  if (process.argv.includes('--skip-build')) {
    pass('Production Vite build skipped by --skip-build');
    return;
  }

  const command = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm.cmd run vercel-build']
    : ['run', 'vercel-build'];
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe'
  });

  if (result.status === 0) {
    pass('Production Vite build passes');
    return;
  }

  fail([
    'Production Vite build failed.',
    result.error?.message,
    result.stdout?.trim(),
    result.stderr?.trim()
  ].filter(Boolean).join('\n'));
}

function main() {
  console.log('ScreenFlowAI health check\n');
  checkRequiredFiles();
  checkRouting();
  checkLiveKitTokenRoles();
  checkJoinCallMedia();
  checkPresenterLiveCall();
  checkElectronBridge();
  checkRecordingPipeline();
  checkPlatformShells();
  runBuild();

  passes.forEach((message) => console.log(`OK  ${message}`));

  if (failures.length) {
    console.error('\nHealth check failed:\n');
    failures.forEach((message) => console.error(`ERR ${message}`));
    process.exit(1);
  }

  console.log('\nAll critical app checks passed.');
}

main();
