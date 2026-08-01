const { performance } = require('perf_hooks');

process.env.LIVEKIT_URL = 'wss://scale-check.livekit.cloud';
process.env.LIVEKIT_API_KEY = 'APIscalecheck1234';
process.env.LIVEKIT_API_SECRET = 'scale-check-secret-1234567890-abcdefghijklmn';

const handler = require('../api/livekit-token');
const requestCount = Math.max(1, Number(process.env.CALL_LOAD_REQUESTS) || 250);

function invokeTokenHandler(index) {
  return new Promise((resolve, reject) => {
    const req = {
      body: {
        participantName: `Load Guest ${index}`,
        role: index === 0 ? 'presenter' : 'participant',
        roomCode: 'SF-LOAD1'
      },
      headers: {},
      method: 'POST',
      query: {}
    };
    const res = {
      headers: {},
      statusCode: 200,
      setHeader(name, value) {
        this.headers[name.toLowerCase()] = value;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ headers: this.headers, payload, statusCode: this.statusCode });
      },
      end() {
        resolve({ headers: this.headers, payload: null, statusCode: this.statusCode });
      }
    };

    Promise.resolve(handler(req, res)).catch(reject);
  });
}

async function main() {
  const startedAt = performance.now();
  const results = await Promise.all(Array.from({ length: requestCount }, (_, index) => invokeTokenHandler(index)));
  const elapsedMs = performance.now() - startedAt;
  const failures = results.filter((result) => result.statusCode !== 200 || !result.payload?.token);
  const identities = new Set(results.map((result) => result.payload?.identity));
  const noStoreResponses = results.filter((result) => result.headers['cache-control'] === 'no-store').length;

  if (failures.length) throw new Error(`${failures.length} token requests failed.`);
  if (identities.size !== requestCount) throw new Error('Token identities were not unique.');
  if (noStoreResponses !== requestCount) throw new Error('Some token responses were cacheable.');

  console.log(`OK  ${requestCount} concurrent token requests completed in ${Math.round(elapsedMs)} ms.`);
  console.log(`OK  ${identities.size} unique participant identities were generated.`);
  console.log('OK  Every token response was marked no-store.');
}

main().catch((error) => {
  console.error(`ERR ${error.message || error}`);
  process.exit(1);
});
