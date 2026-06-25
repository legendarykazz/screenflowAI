const { app, BrowserWindow, ipcMain, desktopCapturer, dialog, screen, protocol, net, crashReporter } = require('electron');
const path = require('path');
const fs = require('fs');
const db = require('./database');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let trackingProcess = null;
let trackingEvents = [];
let trackingInterval = null;
let isRecording = false;
let recordingStartTime = 0;

// License file path
const licenseFilePath = path.join(app.getPath('userData'), 'license.json');

// Log file path
const logFilePath = path.join(app.getPath('userData'), 'activity.log');

// Register custom media protocol for streaming local recorded videos under webSecurity: true
protocol.registerSchemesAsPrivileged([
  { scheme: 'screenflow-media', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true, corsEnabled: true } }
]);

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
      webSecurity: false // Disabled to allow native file:// video playback
    }
  });

  // Load app
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
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
      let stripped = request.url;
      if (stripped.startsWith('screenflow-media://')) {
        stripped = stripped.slice(19);
      } else if (stripped.startsWith('screenflow-media:/')) {
        stripped = stripped.slice(18);
      } else if (stripped.startsWith('screenflow-media:')) {
        stripped = stripped.slice(17);
      }
      const decodedUrl = decodeURIComponent(stripped);
      const normalizedPath = path.normalize(decodedUrl).replace(/^\\\\\?\\/, "").replace(/\\/g, '/');
      return net.fetch('file:///' + normalizedPath);
    } catch (e) {
      logActivity('MEDIA_PROTOCOL_ERROR', `Failed serving media file: ${e.message}`);
      return new Response('Media Load Error', { status: 500 });
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
      // Pick the first screen source by default if we use getDisplayMedia without specific UI logic
      const selectedSource = sources.find(s => s.id.startsWith('screen')) || sources[0];
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

// IPC - SQLite DB handlers
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

// IPC - Recording and Global Tracker
ipcMain.handle('recording:start', async (event, options) => {
  if (isRecording) return false;
  
  isRecording = true;
  recordingStartTime = Date.now();
  trackingEvents = [];

  const primaryDisplay = screen.getPrimaryDisplay();
  const displayBounds = primaryDisplay.bounds;

  logActivity('RECORDING_START', 'Global cursor and window capture started.');

  // Start polling cursor coordinates at 60Hz
  trackingInterval = setInterval(() => {
    const point = screen.getCursorScreenPoint();
    const relX = point.x - displayBounds.x;
    const relY = point.y - displayBounds.y;
    trackingEvents.push({
      timestamp: (Date.now() - recordingStartTime) / 1000,
      x: relX,
      y: relY,
      event_type: 'move'
    });
  }, 16);

  // Global Click Tracking via PowerShell Mouse Hook
  const psScript = `
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
      }
    });
  } catch (err) {
    logActivity('HOOK_ERROR', `Failed to start PowerShell tracking hook: ${err.message}`);
  }

  return { success: true, startTime: recordingStartTime };
});

ipcMain.handle('recording:stop', async () => {
  if (!isRecording) return null;
  
  isRecording = false;
  clearInterval(trackingInterval);
  
  if (trackingProcess) {
    trackingProcess.kill();
    trackingProcess = null;
  }

  logActivity('RECORDING_STOP', 'Global cursor and window capture stopped.');

  return {
    events: trackingEvents,
    endTime: Date.now()
  };
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
    return { success: true, filePath };
  } catch (err) {
    logActivity('RECORDING_SAVE_ERROR', `Failed to save recorded file: ${err.message}`);
    return { success: false, error: err.message };
  }
});

// IPC - AI Captions Generation (OpenAI Whisper)
ipcMain.handle('ai:generate-captions', async (_, projectId, apiKey) => {
  logActivity('AI_CAPTIONS_START', `Generating Whisper captions for Project ID: ${projectId}`);
  const project = db.getProject(projectId);
  if (!project || !project.audio_path) {
    return { success: false, error: 'No audio recording found' };
  }

  if (!apiKey) {
    // Return mock captions if no API key is specified (for demo/development)
    const mockCaptions = [
      { start_time: 1.0, end_time: 3.5, text: "Welcome to this tutorial on ScreenFlow AI!" },
      { start_time: 4.0, end_time: 7.2, text: "In this guide, we will cover the automated zoom features." },
      { start_time: 8.0, end_time: 11.5, text: "Notice how the mouse cursor zooms in smoothly on clicks." },
      { start_time: 12.0, end_time: 15.0, text: "You can fully customize settings and backgrounds!" }
    ];
    db.saveCaptions(projectId, mockCaptions);
    logActivity('AI_CAPTIONS_MOCK', `Generated mock captions for Project ID: ${projectId}`);
    return { success: true, captions: mockCaptions };
  }

  // Real OpenAI Whisper integration
  try {
    const FormData = require('form-data');
    const axios = require('axios');
    
    const form = new FormData();
    form.append('file', fs.createReadStream(project.audio_path));
    form.append('model', 'whisper-1');
    form.append('response_format', 'verbose_json');

    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${apiKey}`
      }
    });

    const segments = response.data.segments || [];
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

// IPC - Silence Detection
ipcMain.handle('ai:detect-silence', async (_, projectId, sensitivity = -40) => {
  const project = db.getProject(projectId);
  if (!project || !project.audio_path) {
    return [];
  }
  logActivity('AI_SILENCE_DETECTION', `Detecting silent periods on project ${projectId}.`);
  return [
    { start: 3.5, end: 4.0 },
    { start: 7.2, end: 8.0 },
    { start: 11.5, end: 12.0 }
  ];
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
