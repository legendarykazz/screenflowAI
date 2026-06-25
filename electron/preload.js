const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // Database / Project operations
  getProjects: () => ipcRenderer.invoke('db:get-projects'),
  getProject: (id) => ipcRenderer.invoke('db:get-project', id),
  createProject: (name) => ipcRenderer.invoke('db:create-project', name),
  updateProject: (id, fields) => ipcRenderer.invoke('db:update-project', id, fields),
  deleteProject: (id) => ipcRenderer.invoke('db:delete-project', id),
  getCursorEvents: (projectId) => ipcRenderer.invoke('db:get-cursor-events', projectId),
  saveCursorEvents: (projectId, events) => ipcRenderer.invoke('db:save-cursor-events', projectId, events),
  getCaptions: (projectId) => ipcRenderer.invoke('db:get-captions', projectId),
  saveCaptions: (projectId, captions) => ipcRenderer.invoke('db:save-captions', projectId, captions),
  
  // Recording functions
  getSources: () => ipcRenderer.invoke('recording:get-sources'),
  startRecording: (options) => ipcRenderer.invoke('recording:start', options),
  stopRecording: () => ipcRenderer.invoke('recording:stop'),
  saveRecordedFile: (arrayBuffer) => ipcRenderer.invoke('recording:save-file', arrayBuffer),
  onRecordingStatus: (callback) => ipcRenderer.on('recording:status-update', (_, status) => callback(status)),
  
  // Video processing & Exporting
  startExport: (projectId, exportPath, format, quality) => ipcRenderer.invoke('export:start', projectId, exportPath, format, quality),
  getExports: () => ipcRenderer.invoke('export:get-list'),
  onExportProgress: (callback) => ipcRenderer.on('export:progress', (_, data) => callback(data)),
  
  // AI Tools
  generateAICaptions: (projectId, apiKey) => ipcRenderer.invoke('ai:generate-captions', projectId, apiKey),
  detectSilence: (projectId, sensitivity) => ipcRenderer.invoke('ai:detect-silence', projectId, sensitivity),
  
  // System utils
  selectFolder: () => ipcRenderer.invoke('system:select-folder'),
  selectFile: (filters) => ipcRenderer.invoke('system:select-file', filters),
  
  // Licensing
  checkLicense: () => ipcRenderer.invoke('license:check'),
  activateLicense: (key) => ipcRenderer.invoke('license:activate', key),
  
  // Activity Logging
  getActivityLogs: () => ipcRenderer.invoke('logs:get'),
  clearActivityLogs: () => ipcRenderer.invoke('logs:clear'),

  // App state
  getAppVersion: () => ipcRenderer.invoke('app:version'),
});
