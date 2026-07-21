const { AccessToken } = require('livekit-server-sdk');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const livekitUrl = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!livekitUrl || !apiKey || !apiSecret) {
    res.status(500).json({ error: 'LiveKit environment variables are not configured.' });
    return;
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}');
    } catch (err) {
      res.status(400).json({ error: 'Invalid JSON body.' });
      return;
    }
  }
  const { roomCode, participantName } = body;
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
