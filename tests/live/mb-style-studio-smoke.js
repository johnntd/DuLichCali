'use strict';
// OPT-IN live smoke for generateStyleStudio. Requires: a deployed function, a
// vendor ID-token, and a base64 selfie. NOT run by the dry-run gate (live cost).
// Usage: STUDIO_TOKEN=<vendorIdToken> SELFIE=./fixture.jpg node tests/live/mb-style-studio-smoke.js
const fs = require('fs');
const https = require('https');
const MODES = ['haircut','color','texture','eyebrow','beard','wig','hairsystem','event','vacation'];
const TOKEN = process.env.STUDIO_TOKEN;
const SELFIE = process.env.SELFIE;
const ENDPOINT = process.env.STUDIO_ENDPOINT || 'https://us-central1-dulichcali-booking-calendar.cloudfunctions.net/generateStyleStudio';
if (!TOKEN || !SELFIE) { console.error('Set STUDIO_TOKEN and SELFIE env vars.'); process.exit(2); }
const b64 = fs.readFileSync(SELFIE).toString('base64');
const selfieDataUrl = 'data:image/jpeg;base64,' + b64;

function call(mode) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ data: { mode, selfieDataUrl, lang: 'en', audience: 'neutral' } });
    const u = new URL(ENDPOINT);
    const req = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN, 'Content-Length': Buffer.byteLength(body) } },
      (res) => { let d = ''; res.on('data', (c) => d += c); res.on('end', () => resolve({ mode, status: res.statusCode, body: d.slice(0, 240) })); });
    req.on('error', (e) => resolve({ mode, status: 0, body: String(e) }));
    req.write(body); req.end();
  });
}
(async () => {
  for (const m of MODES) { const r = await call(m); console.log(r.mode.padEnd(11), r.status, r.body); }
})();
