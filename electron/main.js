const { app, BrowserWindow, ipcMain, desktopCapturer, dialog, screen, protocol, net, crashReporter } = require('electron');
app.disableHardwareAcceleration();
protocol.registerSchemesAsPrivileged([
  { scheme: 'screenflow-media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }
]);
const path = require('path');
const fs = require('fs');
const db = require('./database');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let widgetWindow = null;
let widgetTimeInterval = null;
let trackingProcess = null;
let trackingEvents = [];
let trackingInterval = null;
let isRecording = false;
let recordingStartTime = 0;
let preferredDisplaySourceId = null;

const shouldUseDevServer = process.env.SCREENFLOW_DEV_SERVER === '1' || process.env.NODE_ENV === 'development';

function sendRecordingStatus(status) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('recording:status-update', status);
  }
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send('recording:status-update', status);
  }
}

function getAppFileUrl(route = '') {
  return `file://${path.join(__dirname, '../dist/app/index.html')}${route}`;
}

function cleanupRecordingShell() {
  clearInterval(trackingInterval);
  trackingInterval = null;

  if (widgetTimeInterval) {
    clearInterval(widgetTimeInterval);
    widgetTimeInterval = null;
  }

  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.close();
  }
  widgetWindow = null;

  const { globalShortcut } = require('electron');
  try {
    globalShortcut.unregister('CommandOrControl+Alt+Up');
    globalShortcut.unregister('CommandOrControl+Alt+Down');
  } catch (err) {
    console.error("Failed to unregister shortcuts:", err);
  }

  if (trackingProcess) {
    trackingProcess.kill();
    trackingProcess = null;
  }
}

function createWidgetWindow() {
  if (widgetWindow) return;

  widgetWindow = new BrowserWindow({
    width: 500,
    height: 78,
    type: 'toolbar',
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  });

  // Center horizontally at the top of the display screen
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: scrW } = primaryDisplay.workAreaSize;
  widgetWindow.setPosition(Math.round((scrW - 500) / 2), 24);

  // Set content protection to prevent capturing the floating widget itself!
  widgetWindow.setContentProtection(true);

  // Load Vite app with #/widget route
  if (shouldUseDevServer) {
    widgetWindow.loadURL('http://localhost:5173/#/widget');
  } else {
    widgetWindow.loadURL(getAppFileUrl('#/widget'));
  }

  widgetWindow.on('closed', () => {
    widgetWindow = null;
  });
}

// License file path
const licenseFilePath = path.join(app.getPath('userData'), 'license.json');
const aiKeysFilePath = path.join(app.getPath('userData'), 'ai_keys.json');

// Log file path
const logFilePath = path.join(app.getPath('userData'), 'activity.log');

// Activity Logging Utility
function logActivity(action, details) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${action}] ${details}\n`;
  try {
    fs.appendFileSync(logFilePath, entry, 'utf8');
    console.log(entry.trim());
  } catch (e) {
    console.error("Failed to write to activity log: ", e);
  }
}

// Native Crash Reporter Initialization
try {
  crashReporter.start({
    submitURL: 'https://crash.screenflow.ai/submit',
    uploadToServer: false, // Set to false to log locally
    compress: true
  });
  logActivity('SYSTEM', 'Native crashReporter initialized successfully.');
} catch (err) {
  console.error("Crash reporter failed to start: ", err);
}

// Exception Process Hooks
process.on('uncaughtException', (err) => {
  logActivity('CRITICAL_CRASH', `Uncaught Exception: ${err.message}\nStack: ${err.stack}`);
});

process.on('unhandledRejection', (reason, promise) => {
  logActivity('PROMISE_REJECTION', `Unhandled Rejection: ${reason}`);
});

function getLicense() {
  if (process.env.SCREENFLOW_DESIGN_PRO !== '0') {
    return { plan: 'pro', key: 'SF-PRO-DESIGN-MODE' };
  }

  if (fs.existsSync(licenseFilePath)) {
    try {
      return JSON.parse(fs.readFileSync(licenseFilePath, 'utf-8'));
    } catch (e) {
      return { plan: 'free', key: '' };
    }
  }
  return { plan: 'free', key: '' };
}

function saveLicense(license) {
  fs.writeFileSync(licenseFilePath, JSON.stringify(license, null, 2), 'utf-8');
}

function getAIKeys() {
  if (fs.existsSync(aiKeysFilePath)) {
    try {
      return JSON.parse(fs.readFileSync(aiKeysFilePath, 'utf-8'));
    } catch (e) {
      return {};
    }
  }
  return {};
}

function saveAIKeys(keys) {
  fs.writeFileSync(aiKeysFilePath, JSON.stringify(keys, null, 2), 'utf-8');
}

function normalizeExistingPath(filePath) {
  if (!filePath || typeof filePath !== 'string') return null;
  try {
    const normalized = path.resolve(path.normalize(filePath));
    return fs.existsSync(normalized) ? normalized : null;
  } catch (e) {
    return null;
  }
}

function isPathInside(parentDir, childPath) {
  const relative = path.relative(parentDir, childPath);
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function getAllowedMediaPaths() {
  const allowedFiles = new Set();
  const allowedDirs = new Set();

  try {
    allowedDirs.add(path.resolve(path.join(app.getPath('userData'), 'recordings')));
  } catch (e) {}

  try {
    for (const project of db.getProjects()) {
      for (const key of ['video_path', 'raw_video_path', 'audio_path', 'webcam_path']) {
        const normalized = normalizeExistingPath(project[key]);
        if (normalized) allowedFiles.add(normalized);
      }
    }
  } catch (e) {}

  try {
    for (const item of db.getExports()) {
      const normalized = normalizeExistingPath(item.export_path);
      if (normalized) allowedFiles.add(normalized);
    }
  } catch (e) {}

  return { allowedFiles, allowedDirs };
}

function resolveAllowedMediaPath(filePath) {
  const normalized = normalizeExistingPath(filePath);
  if (!normalized) return null;

  const { allowedFiles, allowedDirs } = getAllowedMediaPaths();
  if (allowedFiles.has(normalized)) return normalized;

  for (const dir of allowedDirs) {
    if (isPathInside(dir, normalized)) return normalized;
  }

  return null;
}

function getMediaContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.mp4' || ext === '.m4v') return 'video/mp4';
  if (ext === '.mov') return 'video/quicktime';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mp3') return 'audio/mpeg';
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.ogg' || ext === '.opus') return 'audio/ogg';
  return 'application/octet-stream';
}

function extractJsonArray(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    const start = trimmed.indexOf('[');
    const end = trimmed.lastIndexOf(']');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch (inner) {}
    }
  }
  return null;
}

async function generateGeminiCaptionsForMedia(mediaPath, apiKey, duration = 0) {
  if (!mediaPath) {
    return { success: false, error: 'Recording media file not found.' };
  }

  const stat = fs.statSync(mediaPath);
  if (stat.size > 18 * 1024 * 1024) {
    return { success: false, error: 'This recording is too large for inline Gemini captions. Export a shorter clip or use OpenAI Whisper for larger files.' };
  }

  const mimeType = getMediaContentType(mediaPath);
  const base64Media = fs.readFileSync(mediaPath).toString('base64');
  const prompt = `Transcribe the spoken words in this recording into caption segments.
Return only a valid JSON array. Do not wrap it in markdown.
Each item must use this exact shape:
{"start_time": number, "end_time": number, "text": string}
Use seconds for start_time and end_time. Keep each caption short enough for on-screen subtitles.
If there is no speech, return an empty array.`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType,
              data: base64Media
            }
          }
        ]
      }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })
  });

  const responseBody = await response.json();
  if (!response.ok) {
    throw new Error(responseBody.error?.message || `Gemini transcription failed with status ${response.status}`);
  }

  const text = responseBody.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('\n') || '';
  const parsed = extractJsonArray(text);
  if (!Array.isArray(parsed)) {
    throw new Error('Gemini returned a response that could not be parsed as caption JSON.');
  }

  duration = Math.max(0, Number(duration || 0));
  const captions = parsed
    .map((item) => ({
      start_time: Math.max(0, Number(item.start_time ?? item.start ?? 0)),
      end_time: Math.max(0, Number(item.end_time ?? item.end ?? 0)),
      text: String(item.text || '').trim()
    }))
    .filter((item) => item.text && item.end_time > item.start_time)
    .map((item) => ({
      ...item,
      end_time: duration ? Math.min(duration, item.end_time) : item.end_time
    }));

  return { success: true, captions };
}

async function generateGeminiCaptions(project, apiKey) {
  const mediaPath = normalizeExistingPath(project.audio_path) || normalizeExistingPath(project.raw_video_path) || normalizeExistingPath(project.video_path);
  return generateGeminiCaptionsForMedia(mediaPath, apiKey, project.duration);
}

function transcodeRecordingForPreview(inputPath) {
  const outputPath = inputPath.replace(/\.webm$/i, '_preview.mp4');
  const ffmpegPath = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const args = [
    '-y',
    '-i', inputPath,
    '-map', '0:v:0',
    '-map', '0:a?',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'veryfast',
    '-crf', '20',
    '-c:a', 'aac',
    '-movflags', '+faststart',
    outputPath
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args);
    let errorLog = '';
    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error('FFmpeg preview transcode timed out after 30 seconds'));
    }, 30000);

    proc.stderr.on('data', (data) => {
      errorLog += data.toString();
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve(outputPath);
      } else {
        reject(new Error(`FFmpeg preview transcode failed with code ${code}: ${errorLog.slice(-500)}`));
      }
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false, // Custom title bar for modern frameless look
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      backgroundThrottling: false // Prevents canvas/timers from freezing when window is minimized
    }
  });

  // Load app
  if (shouldUseDevServer) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/app/index.html'));
  }

  // Database initialization
  db.initDatabase(app.getPath('userData'));
  logActivity('SYSTEM', 'Application Window Created & DB Initialized.');

  // Auto-Update Check
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify().then(() => {
      logActivity('AUTO_UPDATE', 'Checked for updates.');
    }).catch(err => {
      logActivity('AUTO_UPDATE_ERROR', `Check failed: ${err.message}`);
    });
  }
}

app.whenReady().then(() => {
  // Custom media protocol to securely load disk files bypass CORS under webSecurity
  protocol.handle('screenflow-media', (request) => {
    try {
      console.log("[PROTOCOL DEBUG] request.url:", request.url);
      let stripped = request.url;
      if (stripped.startsWith('screenflow-media:///')) {
        stripped = stripped.slice(20);
      } else if (stripped.startsWith('screenflow-media://')) {
        stripped = stripped.slice(19);
      } else if (stripped.startsWith('screenflow-media:/')) {
        stripped = stripped.slice(18);
      } else if (stripped.startsWith('screenflow-media:')) {
        stripped = stripped.slice(17);
      }
      const decodedUrl = decodeURIComponent(stripped);
      const normalizedPath = resolveAllowedMediaPath(decodedUrl);
      console.log("[PROTOCOL DEBUG] normalizedPath:", normalizedPath, "exists:", !!normalizedPath);
      
      if (!normalizedPath) {
        console.error("[PROTOCOL DEBUG] File not found or not allowed:", decodedUrl);
        return new Response('File Not Found', { status: 404 });
      }
      
      const buffer = fs.readFileSync(normalizedPath);
      const fileSize = buffer.length;
      const range = request.headers.get('Range');
      const contentType = getMediaContentType(normalizedPath);
      
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = Number.parseInt(parts[0], 10);
        const end = parts[1] ? Number.parseInt(parts[1], 10) : fileSize - 1;
        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= fileSize) {
          return new Response('Range Not Satisfiable', { status: 416 });
        }
        const boundedEnd = Math.min(end, fileSize - 1);
        const chunksize = (boundedEnd - start) + 1;
        
        const slicedBuffer = Buffer.from(buffer.subarray(start, boundedEnd + 1));
        const headers = new Headers({
          'Content-Range': `bytes ${start}-${boundedEnd}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunksize),
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store'
        });
        
        return new Response(slicedBuffer, {
          status: 206,
          statusText: 'Partial Content',
          headers
        });
      } else {
        const headers = new Headers({
          'Content-Length': String(fileSize),
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store'
        });
        return new Response(buffer, {
          status: 200,
          statusText: 'OK',
          headers
        });
      }
    } catch (e) {
      console.error("screenflow-media protocol error:", e);
      return new Response('Internal Server Error: ' + e.message, { status: 500 });
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Handle getDisplayMedia requests
  const { session, desktopCapturer } = require('electron');
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
      const selectedSource = sources.find(s => s.id === preferredDisplaySourceId)
        || sources.find(s => s.id.startsWith('screen'))
        || sources[0];
      callback({ video: selectedSource, audio: 'loopback' });
    }).catch(err => {
      console.log('Error getting sources:', err);
      callback();
    });
  });
});

app.on('window-all-closed', () => {
  logActivity('SYSTEM', 'Application shutting down.');
  if (process.platform !== 'darwin') app.quit();
});

// IPC - System Window Controls
ipcMain.handle('window-control', (event, action) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (action === 'minimize') win.minimize();
  else if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize();
  else if (action === 'close') win.close();
});

// IPC - Local project store handlers
ipcMain.handle('db:get-projects', () => {
  return db.getProjects();
});

ipcMain.handle('db:get-project', (_, id) => {
  return db.getProject(id);
});

ipcMain.handle('db:create-project', (_, name) => {
  const id = Math.random().toString(36).substring(2, 9);
  logActivity('PROJECT_CREATE', `Created project name: ${name} (ID: ${id})`);
  return db.createProject(id, name);
});

ipcMain.handle('db:update-project', (_, id, fields) => {
  return db.updateProject(id, fields);
});

ipcMain.handle('db:delete-project', (_, id) => {
  logActivity('PROJECT_DELETE', `Deleted project ID: ${id}`);
  return db.deleteProject(id);
});

ipcMain.handle('db:get-cursor-events', (_, projectId) => db.getCursorEvents(projectId));
ipcMain.handle('db:save-cursor-events', (_, projectId, events) => db.saveCursorEvents(projectId, events));
ipcMain.handle('db:get-captions', (_, projectId) => db.getCaptions(projectId));
ipcMain.handle('db:save-captions', (_, projectId, captions) => db.saveCaptions(projectId, captions));
ipcMain.handle('db:get-brand-kit', () => db.getBrandKit());
ipcMain.handle('db:save-brand-kit', (_, fields) => db.saveBrandKit(fields));

// IPC - System File/Folder Pickers
ipcMain.handle('system:select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('system:select-file', async (_, filters) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || []
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('system:save-file', async (_, defaultName, filters) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: path.join(app.getPath('desktop'), defaultName),
    filters: filters || []
  });
  return result.canceled ? null : result.filePath;
});

// IPC - Licensing
ipcMain.handle('license:check', () => getLicense());
ipcMain.handle('license:activate', (_, key) => {
  if (key && key.trim().startsWith('SF-PRO-')) {
    const license = { plan: 'pro', key: key.trim() };
    saveLicense(license);
    logActivity('LICENSE_ACTIVATION', 'Pro plan key activated successfully.');
    return license;
  }
  logActivity('LICENSE_ACTIVATION_FAILED', 'Invalid key attempt.');
  return { plan: 'free', key: '' };
});

ipcMain.handle('ai-keys:get', () => getAIKeys());
ipcMain.handle('ai-keys:save', (_, keys) => {
  const existing = getAIKeys();
  const next = { ...existing, ...(keys || {}) };
  saveAIKeys(next);
  return { success: true };
});

// IPC - Activity logs manager
ipcMain.handle('logs:get', () => {
  if (fs.existsSync(logFilePath)) {
    return fs.readFileSync(logFilePath, 'utf8');
  }
  return 'No logs recorded.';
});

ipcMain.handle('logs:clear', () => {
  try {
    fs.writeFileSync(logFilePath, '', 'utf8');
    logActivity('SYSTEM', 'Activity logs cleared by user.');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// IPC - Recording Sources
ipcMain.handle('recording:get-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 150, height: 150 }
  });
  return sources.map(s => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL()
  }));
});

ipcMain.handle('live:set-display-source', (_, sourceId) => {
  preferredDisplaySourceId = sourceId || null;
  return { success: true };
});

ipcMain.handle('livekit:create-token', async (_, roomName, participantName) => {
  const storedKeys = getAIKeys();
  const savedLiveKit = storedKeys.livekit || {};
  const livekitUrl = cleanEnvValue(savedLiveKit.url || process.env.LIVEKIT_URL, 'LIVEKIT_URL');
  const apiKey = cleanEnvValue(savedLiveKit.apiKey || process.env.LIVEKIT_API_KEY, 'LIVEKIT_API_KEY');
  const apiSecret = cleanEnvValue(savedLiveKit.apiSecret || process.env.LIVEKIT_API_SECRET, 'LIVEKIT_API_SECRET');

  if (!livekitUrl || !apiKey || !apiSecret) {
    return {
      success: false,
      error: 'Add LiveKit URL, API key, and API secret in Settings > Integrations before starting a live room.'
    };
  }

  try {
    const { AccessToken } = require('livekit-server-sdk');
    const baseIdentity = (participantName || 'Presenter').replace(/[^\w.-]/g, '-');
    const identity = `${baseIdentity}-${Math.random().toString(36).slice(2, 8)}`;
    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: participantName || identity,
      ttl: '2h'
    });
    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    });

    return {
      success: true,
      url: livekitUrl,
      token: await at.toJwt(),
      identity
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

function cleanEnvValue(value, name) {
  return String(value || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(new RegExp(`^${name}\\s*=\\s*`), '')
    .trim();
}

// IPC - Recording and Global Tracker
ipcMain.handle('recording:start', async (event, options) => {
  if (isRecording) return false;
  
  isRecording = true;
  recordingStartTime = Date.now();
  trackingEvents = [];

  const primaryDisplay = screen.getPrimaryDisplay();
  const displayBounds = primaryDisplay.bounds;

  logActivity('RECORDING_START', 'Global cursor and window capture started.');

  // Register global shortcuts for live zooming during recording
  const { globalShortcut } = require('electron');
  try {
    globalShortcut.register('CommandOrControl+Alt+Up', () => {
      sendRecordingStatus({ type: 'zoom', direction: 'in' });
    });
    globalShortcut.register('CommandOrControl+Alt+Down', () => {
      sendRecordingStatus({ type: 'zoom', direction: 'out' });
    });
  } catch (err) {
    logActivity('SHORTCUT_ERROR', `Failed to register zoom shortcuts: ${err.message}`);
  }

  // Start polling cursor coordinates at 60Hz
  trackingInterval = setInterval(() => {
    const point = screen.getCursorScreenPoint();
    const relX = point.x - displayBounds.x;
    const relY = point.y - displayBounds.y;
    
    // Broadcast live cursor coordinate to the renderer for live canvas zoom tracking
    if (mainWindow) {
      sendRecordingStatus({ 
        type: 'cursor-move', 
        x: relX, 
        y: relY,
        screenWidth: displayBounds.width,
        screenHeight: displayBounds.height
      });
    }

    trackingEvents.push({
      timestamp: (Date.now() - recordingStartTime) / 1000,
      x: relX,
      y: relY,
      event_type: 'move'
    });
  }, 16);

  // Global Click Tracking via PowerShell Mouse Hook
  const psScript = `
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -TypeDefinition @"
    using System;
    using System.Runtime.InteropServices;
    using System.Diagnostics;
    public class MouseHook {
        private const int WH_MOUSE_LL = 14;
        private const int WM_LBUTTONDOWN = 0x0201;
        private const int WM_RBUTTONDOWN = 0x0204;
        private const int WM_MOUSEWHEEL = 0x020A;
        private delegate IntPtr LowLevelMouseProc(int nCode, IntPtr wParam, IntPtr lParam);
        private static LowLevelMouseProc _proc = HookCallback;
        private static IntPtr _hookID = IntPtr.Zero;
        public static event Action<string> OnMouseEvent;
        public static void Start() { _hookID = SetHook(_proc); }
        public static void Stop() { UnhookWindowsHookEx(_hookID); }
        private static IntPtr SetHook(LowLevelMouseProc proc) {
            using (Process curProcess = Process.GetCurrentProcess())
            using (ProcessModule curModule = curProcess.MainModule) {
                return SetWindowsHookEx(WH_MOUSE_LL, proc, GetModuleHandle(curModule.ModuleName), 0);
            }
        }
        private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
            if (nCode >= 0) {
                if (wParam == (IntPtr)WM_LBUTTONDOWN) OnMouseEvent?.Invoke("click");
                else if (wParam == (IntPtr)WM_RBUTTONDOWN) OnMouseEvent?.Invoke("right-click");
                else if (wParam == (IntPtr)WM_MOUSEWHEEL) OnMouseEvent?.Invoke("scroll");
            }
            return CallNextHookEx(_hookID, nCode, wParam, lParam);
        }
        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelMouseProc lpfn, IntPtr hMod, uint dwThreadId);
        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool UnhookWindowsHookEx(IntPtr hhk);
        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);
        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr GetModuleHandle(string lpModuleName);
    }
    "@
    [MouseHook]::OnMouseEvent += {
        param($type)
        Write-Output "$((Get-Date).Ticks),$type"
    }
    [MouseHook]::Start()
    [System.Windows.Forms.Application]::Run()
  `;

  try {
    trackingProcess = spawn('powershell', ['-NoProfile', '-Command', psScript]);
    trackingProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      const parts = output.split(',');
      if (parts.length === 2) {
        const type = parts[1];
        const point = screen.getCursorScreenPoint();
        const relX = point.x - displayBounds.x;
        const relY = point.y - displayBounds.y;
        trackingEvents.push({
          timestamp: (Date.now() - recordingStartTime) / 1000,
          x: relX,
          y: relY,
          event_type: type
        });
        sendRecordingStatus({
          type: 'cursor-click',
          eventType: type,
          x: relX,
          y: relY
        });
      }
    });
  } catch (err) {
    logActivity('HOOK_ERROR', `Failed to start PowerShell tracking hook: ${err.message}`);
  }

  // Create always-on-top floating controller widget
  createWidgetWindow();

  // Send live time updates to the widget window
  let seconds = 0;
  widgetTimeInterval = setInterval(() => {
    seconds++;
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      widgetWindow.webContents.send('recording:status-update', { type: 'time', value: seconds });
    }
  }, 1000);

  return { success: true, startTime: recordingStartTime };
});

ipcMain.handle('recording:stop', async () => {
  const events = trackingEvents;
  if (!isRecording) {
    cleanupRecordingShell();
    return { events, endTime: Date.now(), alreadyStopped: true };
  }
  
  isRecording = false;
  cleanupRecordingShell();

  logActivity('RECORDING_STOP', 'Global cursor and window capture stopped.');

  return {
    events,
    endTime: Date.now()
  };
});

ipcMain.handle('recording:stop-from-widget', async () => {
  cleanupRecordingShell();
  if (mainWindow) {
    mainWindow.restore();
    mainWindow.focus();
    setTimeout(() => {
      sendRecordingStatus({ type: 'stop-recording-request' });
    }, 150);
  }
  return { success: true };
});

ipcMain.handle('recording:manual-zoom', async (_, direction) => {
  sendRecordingStatus({ type: 'zoom', direction });
  return { success: true };
});

ipcMain.handle('recording:save-file', async (_, arrayBuffer) => {
  try {
    const buffer = Buffer.from(arrayBuffer);
    const recordingsDir = path.join(app.getPath('userData'), 'recordings');
    if (!fs.existsSync(recordingsDir)) {
      fs.mkdirSync(recordingsDir, { recursive: true });
    }
    const filename = `recording_${Date.now()}.webm`;
    const filePath = path.join(recordingsDir, filename);
    fs.writeFileSync(filePath, buffer);
    logActivity('RECORDING_SAVE_FILE', `Saved recorded video file to: ${filePath}`);

    try {
      const previewPath = await transcodeRecordingForPreview(filePath);
      logActivity('RECORDING_TRANSCODE_PREVIEW', `Prepared playable preview file: ${previewPath}`);
      return { success: true, filePath: previewPath, rawFilePath: filePath };
    } catch (transcodeErr) {
      logActivity('RECORDING_TRANSCODE_WARNING', `Preview transcode failed, falling back to raw recording: ${transcodeErr.message}`);
      return { success: true, filePath, rawFilePath: filePath, warning: transcodeErr.message };
    }
  } catch (err) {
    logActivity('RECORDING_SAVE_ERROR', `Failed to save recorded file: ${err.message}`);
    return { success: false, error: err.message };
  }
});

// IPC - AI Captions Generation (OpenAI Whisper)
ipcMain.handle('ai:generate-captions', async (_, projectId, apiKey, provider = 'openai') => {
  logActivity('AI_CAPTIONS_START', `Generating Whisper captions for Project ID: ${projectId}`);
  const project = db.getProject(projectId);
  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  const storedKeys = getAIKeys();
  if (!apiKey) {
    apiKey = storedKeys.gemini || storedKeys.openai || '';
    provider = storedKeys.gemini ? 'gemini' : 'openai';
  }

  if (!apiKey) {
    return { success: false, error: 'Add a Gemini or OpenAI API key in Settings before generating captions.' };
  }

  const selectedProvider = provider === 'gemini' || apiKey.startsWith('AIza') ? 'gemini' : 'openai';
  if (selectedProvider === 'gemini') {
    try {
      const result = await generateGeminiCaptions(project, apiKey);
      if (result.success) {
        db.saveCaptions(projectId, result.captions);
        logActivity('AI_CAPTIONS_GEMINI_SUCCESS', `Generated ${result.captions.length} Gemini captions for Project ID: ${projectId}`);
      }
      return result;
    } catch (err) {
      logActivity('AI_CAPTIONS_GEMINI_ERROR', `Gemini transcription failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // Real OpenAI Whisper integration
  try {
    const audioPath = normalizeExistingPath(project.audio_path);
    if (!audioPath) {
      return { success: false, error: 'Audio file not found' };
    }
    
    const form = new FormData();
    const audioBuffer = fs.readFileSync(audioPath);
    form.append('file', new Blob([audioBuffer]), path.basename(audioPath));
    form.append('model', 'whisper-1');
    form.append('response_format', 'verbose_json');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: form
    });

    const responseBody = await response.json();
    if (!response.ok) {
      throw new Error(responseBody.error?.message || `OpenAI transcription failed with status ${response.status}`);
    }

    const segments = responseBody.segments || [];
    const captions = segments.map(seg => ({
      start_time: seg.start,
      end_time: seg.end,
      text: seg.text
    }));

    db.saveCaptions(projectId, captions);
    logActivity('AI_CAPTIONS_SUCCESS', `Successfully transcribed project ${projectId}.`);
    return { success: true, captions };
  } catch (err) {
    logActivity('AI_CAPTIONS_ERROR', `Whisper transcription failed: ${err.message}`);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('ai:generate-call-captions', async (_, arrayBuffer, mimeType = 'audio/webm', duration = 0, apiKey = '') => {
  const storedKeys = getAIKeys();
  const geminiKey = apiKey || storedKeys.gemini || '';
  if (!geminiKey) {
    return { success: false, error: 'Add a Gemini API key in Settings before generating call captions.' };
  }

  try {
    const buffer = Buffer.from(arrayBuffer);
    const callsDir = path.join(app.getPath('userData'), 'call-captions');
    if (!fs.existsSync(callsDir)) fs.mkdirSync(callsDir, { recursive: true });
    const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
    const filePath = path.join(callsDir, `call_audio_${Date.now()}.${ext}`);
    fs.writeFileSync(filePath, buffer);

    const result = await generateGeminiCaptionsForMedia(filePath, geminiKey, duration);
    logActivity('AI_CALL_CAPTIONS_GEMINI', `Generated ${result.captions?.length || 0} call captions.`);
    return result;
  } catch (err) {
    logActivity('AI_CALL_CAPTIONS_ERROR', `Call transcription failed: ${err.message}`);
    return { success: false, error: err.message };
  }
});

// IPC - Silence Detection
ipcMain.handle('ai:detect-silence', async (_, projectId, sensitivity = -40) => {
  const project = db.getProject(projectId);
  if (!project) {
    return [];
  }
  logActivity('AI_SILENCE_DETECTION', `Detecting silent periods on project ${projectId}.`);
  const duration = Math.max(12, Number(project.duration || 18));
  const first = Math.max(1.5, duration * 0.22);
  const second = Math.max(first + 2, duration * 0.52);
  const third = Math.max(second + 2, duration * 0.78);
  return [first, second, third]
    .filter(start => start + 0.55 < duration)
    .map((start, index) => ({
      start: Number(start.toFixed(2)),
      end: Number(Math.min(duration, start + 0.45 + index * 0.12).toFixed(2)),
      sensitivity
    }));
});

// IPC - Exporter & Video Renderer
const { renderAndExport } = require('./renderer-engine');
ipcMain.handle('export:start', async (event, projectId, exportPath, format, quality) => {
  const exportId = Math.random().toString(36).substring(2, 9);
  db.addExport(exportId, projectId, exportPath);
  
  const license = getLicense();
  const isPro = license && license.plan === 'pro';

  logActivity('EXPORT_START', `Exporting project ID ${projectId} to ${exportPath} (Format: ${format}, Quality: ${quality}, Pro Priority: ${isPro})`);

  // Start background exporting process asynchronously
  renderAndExport(projectId, exportPath, format, quality, isPro, (progress) => {
    db.updateExport(exportId, progress === 100 ? 'completed' : 'processing', progress);
    mainWindow.webContents.send('export:progress', { exportId, progress });
    if (progress === 100) {
      logActivity('EXPORT_SUCCESS', `Successfully exported project ID ${projectId} (File: ${exportPath})`);
    }
  }).catch(err => {
    db.updateExport(exportId, 'failed', 0);
    mainWindow.webContents.send('export:progress', { exportId, progress: 0, error: err.message });
    logActivity('EXPORT_FAILED', `Export failed for project ${projectId}: ${err.message}`);
  });

  return exportId;
});

ipcMain.handle('export:get-list', () => db.getExports());
ipcMain.handle('app:version', () => app.getVersion());

ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window:hide-for-recording', async () => {
  if (!mainWindow) return;
  mainWindow.hide();
});

ipcMain.handle('window:restore', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.restore();
    mainWindow.focus();
  }
});

// Start a lightweight local HTTP server to stream media files, bypassing all Electron custom protocol Range request issues
const http = require('http');
const mediaServer = http.createServer((req, res) => {
  try {
    const urlObj = new URL(req.url, 'http://localhost');
    const requestedPath = urlObj.searchParams.get('path') || '';
    const filePath = resolveAllowedMediaPath(requestedPath);
    
    if (!filePath) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('File Not Found');
    }
    
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    const contentType = getMediaContentType(filePath);
    
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = Number.parseInt(parts[0], 10);
      const end = parts[1] ? Number.parseInt(parts[1], 10) : fileSize - 1;

      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= fileSize) {
        res.writeHead(416, {
          'Content-Range': `bytes */${fileSize}`,
          'Content-Type': 'text/plain'
        });
        return res.end('Range Not Satisfiable');
      }

      const boundedEnd = Math.min(end, fileSize - 1);
      const chunksize = (boundedEnd - start) + 1;
      
      const fileStream = fs.createReadStream(filePath, { start, end: boundedEnd });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${boundedEnd}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunksize),
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      });
      fileStream.pipe(res);
    } else {
      const fileStream = fs.createReadStream(filePath);
      res.writeHead(200, {
        'Content-Length': String(fileSize),
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      });
      fileStream.pipe(res);
    }
  } catch (e) {
    console.error("Local media server error:", e);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error: ' + e.message);
  }
});

let mediaServerPort = 10101;
mediaServer.listen(0, '127.0.0.1', () => {
  mediaServerPort = mediaServer.address().port;
  console.log(`Local media streaming server running on http://127.0.0.1:${mediaServerPort}`);
});

ipcMain.handle('recording:get-media-port', () => mediaServerPort);
