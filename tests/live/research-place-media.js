'use strict';
// OPT-IN live test for researchPlaceMedia. NOT run by the dry-run gate (live cost).
// Usage: TC_TOKEN=<idToken> TRIP_ID=<tripId> node tests/live/research-place-media.js
const https = require('https');
const TOKEN = process.env.TC_TOKEN, TRIP_ID = process.env.TRIP_ID;
const ENDPOINT = process.env.TC_ENDPOINT || 'https://us-central1-dulichcali-booking-calendar.cloudfunctions.net/researchPlaceMedia';
if (!TOKEN || !TRIP_ID) { console.error('Set TC_TOKEN and TRIP_ID.'); process.exit(2); }
function call(data) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ data });
    const u = new URL(ENDPOINT);
    const req = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN, 'Content-Length': Buffer.byteLength(body) } },
      (res) => { let s = ''; res.on('data', (c) => s += c); res.on('end', () => resolve(JSON.parse(s).result || {})); });
    req.on('error', (e) => resolve({ error: String(e) })); req.write(body); req.end();
  });
}
(async () => {
  for (const t of [{ name: 'San Diego SEAL Tour', type: 'tour', city: 'San Diego' },
                   { name: 'Pho 79', type: 'restaurant', city: 'Garden Grove' },
                   { name: 'La Jolla Cove', type: 'scenic', city: 'San Diego' }]) {
    const r = await call({ tripId: TRIP_ID, name: t.name, type: t.type, city: t.city });
    const media = r.media || [];
    console.log('\n' + t.name + ' (' + t.type + '):', media.map(m => m.type + ':' + m.verificationStatus).join(', '));
    console.log('  HONESTY: no watch/embed video URL:', media.every(m => !/watch\?v=|youtu\.be|\/embed\//.test(m.url || '')));
    console.log('  videos are search links:', media.filter(m => /youtube|tiktok/.test(m.type)).every(m => /results\?search_query=|tiktok\.com\/search/.test(m.url || '')));
    console.log('  why:', (r.why || '').slice(0, 80), '| bestTime:', r.bestTime || '(none)', '| timeNeeded:', r.timeNeeded || '(none)');
  }
})();
