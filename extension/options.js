const DEFAULT_WORKSPACE_URL = 'https://screenflow-ai.vercel.app';
const input = document.getElementById('workspace-url');
const status = document.getElementById('status');

document.getElementById('save-button').addEventListener('click', saveSettings);
document.getElementById('open-button').addEventListener('click', async () => {
  const url = normalizeUrl(input.value || DEFAULT_WORKSPACE_URL);
  await chrome.tabs.create({ url });
});

loadSettings();

async function loadSettings() {
  const stored = await chrome.storage.sync.get(['workspaceUrl']);
  input.value = stored.workspaceUrl || DEFAULT_WORKSPACE_URL;
}

async function saveSettings() {
  try {
    const workspaceUrl = normalizeUrl(input.value);
    await chrome.storage.sync.set({ workspaceUrl });
    input.value = workspaceUrl;
    status.textContent = 'Saved';
  } catch (error) {
    status.textContent = error.message;
  }
}

function normalizeUrl(value) {
  const parsed = new URL(String(value || '').trim());
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Use an HTTP or HTTPS URL.');
  }
  return parsed.origin + parsed.pathname.replace(/\/+$/, '');
}
