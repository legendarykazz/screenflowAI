const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const sourceDir = path.resolve(projectRoot, 'extension');
const distRoot = path.resolve(projectRoot, 'dist');
const outputDir = path.resolve(distRoot, 'extension');
const requiredFiles = [
  'manifest.json',
  'background.js',
  'offscreen.html',
  'offscreen.js',
  'popup.html',
  'popup.css',
  'popup.js',
  'options.html',
  'options.css',
  'options.js',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png'
];

if (!outputDir.startsWith(`${distRoot}${path.sep}`)) {
  throw new Error(`Refusing to replace output outside dist: ${outputDir}`);
}

for (const relativePath of requiredFiles) {
  const sourcePath = path.resolve(sourceDir, relativePath);
  if (!sourcePath.startsWith(`${sourceDir}${path.sep}`) || !fs.existsSync(sourcePath)) {
    throw new Error(`Missing extension file: ${relativePath}`);
  }
}

const manifest = JSON.parse(fs.readFileSync(path.join(sourceDir, 'manifest.json'), 'utf8'));
if (manifest.manifest_version !== 3) {
  throw new Error('Chrome extension must use Manifest V3.');
}
if (Number(manifest.minimum_chrome_version) < 116) {
  throw new Error('Chrome 116 or newer is required for offscreen tab capture.');
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.cpSync(sourceDir, outputDir, { recursive: true });

console.log(`Chrome extension built at ${outputDir}`);
