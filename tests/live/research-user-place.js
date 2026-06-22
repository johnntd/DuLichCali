'use strict';
// OPT-IN live test for researchUserPlace. NOT run by the dry-run gate (live cost).
// Usage: TC_TOKEN=<idToken> TRIP_ID=<tripId> node tests/live/research-user-place.js
const https = require('https');
const TOKEN = process.env.TC_TOKEN, TRIP_ID = process.env.TRIP_ID;
const ENDPOINT = process.env.TC_ENDPOINT || 'https://us-central1-dulichcali-booking-calendar.cloudfunctions.net/researchUserPlace';
if (!TOKEN || !TRIP_ID) { console.error('Set TC_TOKEN and TRIP_ID.'); process.exit(2); }
function call(data) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ data });
    const u = new URL(ENDPOINT);
    const req = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN, 'Content-Length': Buffer.byteLength(body) } },
      (res) => { let d = ''; res.on('data', (c) => d += c); res.on('end', () => resolve(JSON.parse(d).result || {})); });
    req.on('error', (e) => resolve({ error: String(e) })); req.write(body); req.end();
  });
}
(async () => {
  const real = await call({ tripId: TRIP_ID, name: 'Pho 79', area: 'Garden Grove, CA', placeType: 'restaurant', mealType: 'dinner' });
  console.log('REAL place:', JSON.stringify(real.place || real, null, 2).slice(0, 800));
  const p = real.place || {};
  console.log('  honesty: dataSource =', p.dataSource, '| photos from google only:', (p.photos || []).every(x => x.source === 'google_places'));
  console.log('  no phone field:', p.phone === undefined, '| price labeled:', /pending|^\$|\d/.test(p.priceRange || ''));
  const fake = await call({ tripId: TRIP_ID, name: 'Zzqx Nonexistent Place 99999', area: 'Nowhere, CA', placeType: 'restaurant' });
  const fp = fake.place || {};
  console.log('FAKE place address blanked-or-empty:', !fp.address || fp.address.length < 30, '| rating empty:', !fp.rating);
})();
