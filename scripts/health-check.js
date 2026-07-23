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
  assertIncludes(join, "role: 'participant'", 'Join page requests participant role');
  assertIncludes(join, 'navigator.mediaDevices.getUserMedia({ audio: true })', 'Join page can request microphone');
  assertIncludes(join, "name: 'participant-mic'", 'Join page publishes participant microphone track');
  assertIncludes(join, "name: 'participant-camera'", 'Join page publishes participant camera track');
  assertIncludes(join, 'const audioRef = useRef(null)', 'Join page has a separate remote audio sink');
  assertIncludes(join, "track.kind === 'audio' ? audioRef", 'Join page routes remote audio away from screen/camera containers');
  assertIncludes(join, 'getRemoteParticipants(room)', 'Join page handles LiveKit remote participant collection defensively');
  assertIncludes(join, "track.source === Track.Source.ScreenShare", 'Join page identifies screen share tracks by source');
  assertIncludes(join, 'controlButtonStyle(micOn)', 'Join page shows active microphone state');
  assertIncludes(join, 'controlButtonStyle(cameraOn)', 'Join page shows active camera state');
}

function checkPresenterLiveCall() {
  const live = read('src/pages/LiveCall.jsx');
  assertIncludes(live, "name: 'screenflow-enhanced-output'", 'Presenter publishes enhanced screen output');
  assertIncludes(live, "name: 'presenter-mic'", 'Presenter publishes microphone track');
  assertIncludes(live, "name: 'presenter-camera'", 'Presenter publishes camera track');
  assertIncludes(live, 'RoomEvent.TrackSubscribed', 'Presenter subscribes to remote participant tracks');
  assertIncludes(live, 'attachRemoteTrack(track, participant)', 'Presenter renders remote media tracks');
  assertIncludes(live, 'updateRemoteParticipants(room)', 'Presenter updates participant count/list');
}

function checkElectronBridge() {
  const preload = read('electron/preload.js');
  const main = read('electron/main.js');
  assertIncludes(preload, 'createLiveKitToken', 'Preload exposes LiveKit token bridge');
  assertIncludes(preload, 'saveRecordedFile', 'Preload exposes recording save bridge');
  assertIncludes(main, 'livekit-server-sdk', 'Electron main can mint LiveKit presenter tokens');
  assertIncludes(main, 'desktopCapturer.getSources', 'Electron main can list screen/window sources');
  assertIncludes(main, "ipcMain.handle('recording:save-file'", 'Electron main can save recorded videos');
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
