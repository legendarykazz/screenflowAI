const elements = {
  settingsButton: document.getElementById('settings-button'),
  recordButton: document.getElementById('record-button'),
  recordLabel: document.getElementById('record-label'),
  statusDot: document.getElementById('status-dot'),
  statusTitle: document.getElementById('status-title'),
  statusDetail: document.getElementById('status-detail'),
  recordingTime: document.getElementById('recording-time'),
  errorMessage: document.getElementById('error-message')
};
const extensionRuntime = globalThis.chrome?.runtime;

let captureState = {
  isRecording: false,
  phase: 'idle',
  startedAt: null,
  tabTitle: '',
  message: 'Ready',
  error: ''
};
let actionPending = false;

elements.recordButton.addEventListener('click', async () => {
  actionPending = true;
  render();
  const type = captureState.isRecording ? 'STOP_RECORDING' : 'START_RECORDING';
  const result = await sendToBackground(type);
  actionPending = false;
  if (result?.state) captureState = result.state;
  if (!result?.ok && result?.error) {
    captureState = { ...captureState, phase: 'error', error: result.error };
  }
  render();
});

elements.settingsButton.addEventListener('click', () => {
  if (extensionRuntime?.openOptionsPage) {
    extensionRuntime.openOptionsPage();
  }
});

document.querySelectorAll('[data-path]').forEach((button) => {
  button.addEventListener('click', async () => {
    await sendToBackground('OPEN_WORKSPACE', { path: button.dataset.path });
    window.close();
  });
});

if (extensionRuntime?.onMessage) {
  extensionRuntime.onMessage.addListener((message) => {
    if (message?.target !== 'popup' || message.type !== 'STATE_CHANGED') return;
    captureState = { ...captureState, ...(message.data || {}) };
    render();
  });
}

window.setInterval(renderElapsedTime, 1000);
refreshState();

async function refreshState() {
  const result = await sendToBackground('GET_STATE');
  if (result?.state) captureState = result.state;
  render();
}

function render() {
  const recording = captureState.isRecording;
  elements.recordButton.disabled = actionPending || captureState.phase === 'finalizing';
  elements.recordButton.classList.toggle('stop', recording);
  elements.recordLabel.textContent = recording ? 'Stop and save recording' : 'Record active tab';
  elements.statusDot.className = `status-dot${recording ? ' recording' : captureState.phase === 'error' ? ' error' : ''}`;
  elements.statusTitle.textContent = captureState.message || (recording ? 'Recording active tab' : 'Ready');
  elements.statusDetail.textContent = recording && captureState.tabTitle
    ? captureState.tabTitle
    : 'Active tab + audio';
  elements.errorMessage.hidden = !captureState.error;
  elements.errorMessage.textContent = captureState.error || '';
  renderElapsedTime();
}

function renderElapsedTime() {
  if (!captureState.isRecording || !captureState.startedAt) {
    elements.recordingTime.textContent = '00:00';
    return;
  }
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - captureState.startedAt) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  elements.recordingTime.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function sendToBackground(type, data = {}) {
  if (!extensionRuntime?.sendMessage) {
    return Promise.resolve({
      ok: false,
      error: 'Install this folder as a Chrome extension to start recording.'
    });
  }

  return extensionRuntime.sendMessage({
    target: 'background',
    type,
    data
  });
}
