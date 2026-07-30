let recorder = null;
let captureStream = null;
let audioContext = null;
let recordedChunks = [];
let activeRecordingUrl = '';
let recordingTitle = 'Chrome tab';
let stopTimer = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== 'offscreen') return undefined;

  const run = async () => {
    switch (message.type) {
      case 'START_RECORDING':
        await startRecording(message.data || {});
        return { ok: true };
      case 'STOP_RECORDING':
        await stopRecording();
        return { ok: true };
      case 'RELEASE_RECORDING_URL':
        releaseRecordingUrl(message.data?.url);
        return { ok: true };
      default:
        return { ok: false };
    }
  };

  run()
    .then(sendResponse)
    .catch(async (error) => {
      await notifyBackground('RECORDING_ERROR', { message: error.message || String(error) });
      sendResponse({ ok: false, error: error.message || String(error) });
    });
  return true;
});

async function startRecording({ streamId, tabTitle }) {
  if (!streamId) throw new Error('Chrome did not provide a tab capture stream.');
  if (recorder && recorder.state !== 'inactive') throw new Error('A tab recording is already running.');

  recordingTitle = tabTitle || 'Chrome tab';
  recordedChunks = [];

  captureStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    },
    video: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
        minWidth: 1280,
        minHeight: 720,
        maxWidth: 3840,
        maxHeight: 2160,
        maxFrameRate: 60
      }
    }
  });

  if (captureStream.getAudioTracks().length) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioContext = new AudioContextClass();
      await audioContext.resume();
      const source = audioContext.createMediaStreamSource(captureStream);
      source.connect(audioContext.destination);
    }
  }

  const mimeType = getSupportedMimeType();
  recorder = new MediaRecorder(captureStream, {
    ...(mimeType ? { mimeType } : {}),
    videoBitsPerSecond: 12_000_000,
    audioBitsPerSecond: 192_000
  });

  recorder.ondataavailable = (event) => {
    if (event.data?.size) recordedChunks.push(event.data);
  };

  recorder.onerror = async (event) => {
    await notifyBackground('RECORDING_ERROR', {
      message: event.error?.message || 'The tab recorder stopped unexpectedly.'
    });
    cleanupCapture();
  };

  recorder.onstop = finalizeRecording;
  captureStream.getVideoTracks()[0]?.addEventListener('ended', () => {
    if (recorder?.state !== 'inactive') stopRecording();
  }, { once: true });

  recorder.start(1000);
  await notifyBackground('RECORDING_STATUS', {
    isRecording: true,
    phase: 'recording',
    message: 'Recording active tab',
    error: ''
  });
}

async function stopRecording() {
  if (!recorder || recorder.state === 'inactive') return;
  if (stopTimer) return;

  await notifyBackground('RECORDING_STATUS', {
    isRecording: true,
    phase: 'finalizing',
    message: 'Finalizing recording',
    error: ''
  });

  try {
    recorder.requestData();
  } catch {
    // Some MediaRecorder implementations flush automatically on stop.
  }

  stopTimer = window.setTimeout(() => {
    stopTimer = null;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }, 180);
}

async function finalizeRecording() {
  const mimeType = recorder?.mimeType || 'video/webm';
  const blob = new Blob(recordedChunks, { type: mimeType });
  if (!blob.size) {
    await notifyBackground('RECORDING_ERROR', { message: 'The recorded tab file was empty.' });
    cleanupCapture();
    return;
  }

  releaseRecordingUrl(activeRecordingUrl);
  activeRecordingUrl = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${sanitizeFileName(recordingTitle)}-${timestamp}.webm`;

  cleanupCapture();
  await notifyBackground('RECORDING_COMPLETE', {
    url: activeRecordingUrl,
    filename,
    size: blob.size,
    mimeType
  });
}

function cleanupCapture() {
  if (stopTimer) {
    window.clearTimeout(stopTimer);
    stopTimer = null;
  }
  captureStream?.getTracks().forEach((track) => track.stop());
  captureStream = null;
  recorder = null;
  recordedChunks = [];
  audioContext?.close?.();
  audioContext = null;
}

function releaseRecordingUrl(url) {
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    // Ignore URLs that have already been released.
  }
  if (activeRecordingUrl === url) activeRecordingUrl = '';
}

function getSupportedMimeType() {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function sanitizeFileName(value) {
  return String(value)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'Chrome-tab';
}

function notifyBackground(type, data) {
  return chrome.runtime.sendMessage({
    target: 'background',
    type,
    data
  });
}
