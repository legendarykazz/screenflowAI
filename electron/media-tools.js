const fs = require('fs');

function unpackedPath(binaryPath) {
  if (!binaryPath) return null;
  const candidate = binaryPath.includes('app.asar')
    ? binaryPath.replace('app.asar', 'app.asar.unpacked')
    : binaryPath;
  return fs.existsSync(candidate) ? candidate : binaryPath;
}

function resolveBundledBinary(loader, fallback) {
  try {
    return unpackedPath(loader());
  } catch (error) {
    return fallback;
  }
}

const ffmpegPath = resolveBundledBinary(
  () => require('ffmpeg-static'),
  process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
);

const ffprobePath = resolveBundledBinary(
  () => require('ffprobe-static').path,
  process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe'
);

module.exports = {
  ffmpegPath,
  ffprobePath
};
