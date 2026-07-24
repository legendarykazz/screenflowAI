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
  getBrandKit: () => ipcRenderer.invoke('db:get-brand-kit'),
  saveBrandKit: (fields) => ipcRenderer.invoke('db:save-brand-kit', fields),
  
  // Recording functions
  getSources: () => ipcRenderer.invoke('recording:get-sources'),
  setLiveDisplaySource: (sourceId) => ipcRenderer.invoke('live:set-display-source', sourceId),
  createLiveKitToken: (roomName, participantName) => ipcRenderer.invoke('livekit:create-token', roomName, participantName),
  startRecording: (options) => ipcRenderer.invoke('recording:start', options),
  stopRecording: () => ipcRenderer.invoke('recording:stop'),
  stopRecordingFromWidget: () => ipcRenderer.invoke('recording:stop-from-widget'),
  manualZoom: (direction) => ipcRenderer.invoke('recording:manual-zoom', direction),
  saveRecordedFile: (arrayBuffer, fileName) => ipcRenderer.invoke('recording:save-file', arrayBuffer, fileName),
  getMediaPort: () => ipcRenderer.invoke('recording:get-media-port'),
  onRecordingStatus: (callback) => {
    const listener = (_, status) => callback(status);
    ipcRenderer.on('recording:status-update', listener);
    return () => ipcRenderer.removeListener('recording:status-update', listener);
  },
  
  // Video processing & Exporting
  startExport: (projectId, exportPath, format, quality) => ipcRenderer.invoke('export:start', projectId, exportPath, format, quality),
  getExports: () => ipcRenderer.invoke('export:get-list'),
  onExportProgress: (callback) => {
    const listener = (_, data) => callback(data);
    ipcRenderer.on('export:progress', listener);
    return () => ipcRenderer.removeListener('export:progress', listener);
  },
  
  // AI Tools
  generateAICaptions: (projectId, apiKey, provider) => ipcRenderer.invoke('ai:generate-captions', projectId, apiKey, provider),
  generateCallCaptions: (arrayBuffer, mimeType, duration, apiKey) => ipcRenderer.invoke('ai:generate-call-captions', arrayBuffer, mimeType, duration, apiKey),
  detectSilence: (projectId, sensitivity) => ipcRenderer.invoke('ai:detect-silence', projectId, sensitivity),
  
  // System utils
  selectFolder: () => ipcRenderer.invoke('system:select-folder'),
  selectFile: (filters) => ipcRenderer.invoke('system:select-file', filters),
  saveFile: (defaultName, filters) => ipcRenderer.invoke('system:save-file', defaultName, filters),
  
  // Licensing
  checkLicense: () => ipcRenderer.invoke('license:check'),
  activateLicense: (key) => ipcRenderer.invoke('license:activate', key),
  getAIKeys: () => ipcRenderer.invoke('ai-keys:get'),
  saveAIKeys: (keys) => ipcRenderer.invoke('ai-keys:save', keys),
  
  // Activity Logging
  getActivityLogs: () => ipcRenderer.invoke('logs:get'),
  clearActivityLogs: () => ipcRenderer.invoke('logs:clear'),

  // App state / Window control
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  windowControl: (action) => ipcRenderer.invoke('window-control', action),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  hideForRecording: () => ipcRenderer.invoke('window:hide-for-recording'),
  restoreWindow: () => ipcRenderer.invoke('window:restore'),
});
