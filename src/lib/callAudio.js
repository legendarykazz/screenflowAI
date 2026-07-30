import { AudioPresets } from 'livekit-client';

export const CALL_AUDIO_CAPTURE_OPTIONS = {
  autoGainControl: true,
  channelCount: { ideal: 1 },
  echoCancellation: true,
  latency: { ideal: 0.02 },
  noiseSuppression: true,
  sampleRate: { ideal: 48000 },
  sampleSize: { ideal: 16 },
  voiceIsolation: { ideal: true }
};

export const CALL_AUDIO_PUBLISH_OPTIONS = {
  audioPreset: AudioPresets.musicHighQuality,
  dtx: false,
  forceStereo: false,
  red: true
};

export function prepareCallAudioTrack(track) {
  if (track) track.contentHint = 'speech';
  return track;
}

export async function resumeCallAudio(room) {
  if (!room?.startAudio) return false;
  await room.startAudio();
  return room.canPlaybackAudio !== false;
}
