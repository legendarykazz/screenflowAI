const { AccessToken } = require('livekit-server-sdk');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET' && req.query?.debug === '1') {
    return handleDebug(req, res);
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const livekitUrl = cleanEnvValue(process.env.LIVEKIT_URL, 'LIVEKIT_URL');
  const apiKey = cleanEnvValue(process.env.LIVEKIT_API_KEY, 'LIVEKIT_API_KEY');
  const apiSecret = cleanEnvValue(process.env.LIVEKIT_API_SECRET, 'LIVEKIT_API_SECRET');

  if (!livekitUrl || !apiKey || !apiSecret) {
    res.status(500).json({ error: 'LiveKit environment variables are not configured.' });
    return;
  }

  if (req.query?.debug === '1') return handleDebug(req, res);

  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}');
    } catch (err) {
      res.status(400).json({ error: 'Invalid JSON body.' });
      return;
    }
  }
  const query = req.query || {};
  const { roomCode, participantName } = {
    roomCode: body.roomCode || query.roomCode,
    participantName: body.participantName || query.participantName
  };
  const room = String(roomCode || '').trim().toUpperCase();
  const name = String(participantName || 'Guest').trim().slice(0, 48);

  if (!room || !/^SF-[A-Z0-9-]{3,24}$/.test(room)) {
    res.status(400).json({ error: 'Invalid room code.' });
    return;
  }

  const identity = `${name || 'Guest'}-${Math.random().toString(36).slice(2, 8)}`.replace(/[^\w.-]/g, '-');
  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name: name || identity,
    ttl: '2h'
  });

  token.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true
  });

  res.status(200).json({
    url: livekitUrl,
    token: await token.toJwt(),
    identity
  });
};

function handleDebug(req, res) {
  const livekitUrl = cleanEnvValue(process.env.LIVEKIT_URL, 'LIVEKIT_URL');
  const apiKey = cleanEnvValue(process.env.LIVEKIT_API_KEY, 'LIVEKIT_API_KEY');
  const apiSecret = cleanEnvValue(process.env.LIVEKIT_API_SECRET, 'LIVEKIT_API_SECRET');

  res.status(200).json({
    livekitUrl,
    apiKeyPreview: maskValue(apiKey),
    apiKeyLength: apiKey.length,
    hasApiSecret: Boolean(apiSecret),
    apiSecretLength: apiSecret.length,
    apiSecretFingerprint: fingerprintValue(apiSecret)
  });
}

function cleanEnvValue(value, name) {
  return String(value || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(new RegExp(`^${name}\\s*=\\s*`), '')
    .trim();
}

function maskValue(value) {
  if (!value) return '';
  if (value.length <= 8) return `${value.slice(0, 2)}...`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function fingerprintValue(value) {
  if (!value) return '';
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
}
