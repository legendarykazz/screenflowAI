const OFFSCREEN_PATH = 'offscreen.html';
const DEFAULT_WORKSPACE_URL = 'https://screenflow-ai.vercel.app';
const DEFAULT_STATE = {
  isRecording: false,
  phase: 'idle',
  startedAt: null,
  tabId: null,
  tabTitle: '',
  message: 'Ready',
  error: '',
  lastDownloadId: null
};

let creatingOffscreenDocument = null;

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await chrome.storage.sync.get(['workspaceUrl']);
  if (!settings.workspaceUrl) {
    await chrome.storage.sync.set({ workspaceUrl: DEFAULT_WORKSPACE_URL });
  }
  await setState(DEFAULT_STATE);
});

chrome.runtime.onStartup.addListener(async () => {
  await setState(DEFAULT_STATE);
  await updateBadge(DEFAULT_STATE);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== 'background') return undefined;

  const run = async () => {
    switch (message.type) {
      case 'GET_STATE':
        return { ok: true, state: await getState() };
      case 'START_RECORDING':
        return { ok: true, state: await startRecording() };
      case 'STOP_RECORDING':
        return { ok: true, state: await stopRecording() };
      case 'OPEN_WORKSPACE':
        return { ok: true, url: await openWorkspace(message.data?.path || '/') };
      case 'RECORDING_STATUS':
        return { ok: true, state: await setState(message.data || {}) };
      case 'RECORDING_COMPLETE':
        return await saveRecording(message.data || {});
      case 'RECORDING_ERROR':
        return { ok: false, state: await failRecording(message.data?.message || 'Recording failed.') };
      default:
        return { ok: false, error: 'Unknown extension message.' };
    }
  };

  run()
    .then(sendResponse)
    .catch(async (error) => {
      await failRecording(error.message || String(error));
      sendResponse({ ok: false, error: error.message || String(error), state: await getState() });
    });
  return true;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-recording') return;
  try {
    const state = await getState();
    if (state.isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  } catch (error) {
    await failRecording(error.message || String(error));
  }
});

chrome.tabCapture.onStatusChanged.addListener(async (captureInfo) => {
  const state = await getState();
  if (!state.isRecording || state.tabId !== captureInfo.tabId) return;
  if (captureInfo.status === 'stopped' || captureInfo.status === 'error') {
    await setState({
      isRecording: false,
      phase: captureInfo.status === 'error' ? 'error' : 'idle',
      message: captureInfo.status === 'error' ? 'Tab capture stopped with an error.' : 'Capture stopped',
      error: captureInfo.status === 'error' ? 'Chrome stopped the tab capture.' : ''
    });
  }
});

async function startRecording() {
  const currentState = await getState();
  if (currentState.isRecording) return currentState;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab is available.');
  if (!isRecordableUrl(tab.url || '')) {
    throw new Error('Chrome system pages cannot be recorded. Open a normal website and try again.');
  }

  await ensureOffscreenDocument();
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
  const nextState = await setState({
    isRecording: true,
    phase: 'starting',
    startedAt: Date.now(),
    tabId: tab.id,
    tabTitle: tab.title || 'Chrome tab',
    message: 'Starting capture',
    error: '',
    lastDownloadId: null
  });

  await chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'START_RECORDING',
    data: {
      streamId,
      tabId: tab.id,
      tabTitle: tab.title || 'Chrome tab'
    }
  });

  return nextState;
}

async function stopRecording() {
  const state = await getState();
  if (!state.isRecording) return state;

  const nextState = await setState({
    phase: 'finalizing',
    message: 'Finalizing recording',
    error: ''
  });
  await chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'STOP_RECORDING'
  });
  return nextState;
}

async function saveRecording(data) {
  if (!data.url) throw new Error('The recorded file was empty.');
  const filename = `ScreenFlowAI/${sanitizeFileName(data.filename || 'screenflow-tab-recording.webm')}`;

  try {
    const downloadId = await chrome.downloads.download({
      url: data.url,
      filename,
      conflictAction: 'uniquify',
      saveAs: true
    });
    const state = await setState({
      isRecording: false,
      phase: 'saved',
      startedAt: null,
      message: 'Recording saved',
      error: '',
      lastDownloadId: downloadId
    });
    await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'RELEASE_RECORDING_URL',
      data: { url: data.url }
    });
    return { ok: true, downloadId, state };
  } catch (error) {
    await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'RELEASE_RECORDING_URL',
      data: { url: data.url }
    });
    throw error;
  }
}

async function openWorkspace(path) {
  const settings = await chrome.storage.sync.get(['workspaceUrl']);
  const baseUrl = normalizeWorkspaceUrl(settings.workspaceUrl || DEFAULT_WORKSPACE_URL);
  const destination = new URL(path, `${baseUrl}/`).toString();
  await chrome.tabs.create({ url: destination });
  return destination;
}

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_PATH);
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });
  if (contexts.length > 0) return;

  if (creatingOffscreenDocument) {
    await creatingOffscreenDocument;
    return;
  }

  creatingOffscreenDocument = chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ['USER_MEDIA', 'BLOBS'],
    justification: 'Record active tab media and prepare the completed WebM file.'
  });
  await creatingOffscreenDocument;
  creatingOffscreenDocument = null;
}

async function getState() {
  const stored = await chrome.storage.session.get(['captureState']);
  return { ...DEFAULT_STATE, ...(stored.captureState || {}) };
}

async function setState(fields) {
  const current = await getState();
  const next = { ...current, ...fields };
  await chrome.storage.session.set({ captureState: next });
  await updateBadge(next);
  chrome.runtime.sendMessage({
    target: 'popup',
    type: 'STATE_CHANGED',
    data: next
  }).catch(() => {});
  return next;
}

async function failRecording(message) {
  return setState({
    isRecording: false,
    phase: 'error',
    startedAt: null,
    message: 'Recording unavailable',
    error: message
  });
}

async function updateBadge(state) {
  if (state.isRecording) {
    await chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    await chrome.action.setBadgeText({ text: 'REC' });
  } else {
    await chrome.action.setBadgeText({ text: '' });
  }
}

function normalizeWorkspaceUrl(value) {
  const parsed = new URL(String(value || DEFAULT_WORKSPACE_URL).trim());
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Workspace URL must use HTTP or HTTPS.');
  }
  return parsed.origin + parsed.pathname.replace(/\/+$/, '');
}

function isRecordableUrl(url) {
  return /^https?:/i.test(url) || /^file:/i.test(url);
}

function sanitizeFileName(value) {
  return String(value)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160) || 'screenflow-tab-recording.webm';
}
