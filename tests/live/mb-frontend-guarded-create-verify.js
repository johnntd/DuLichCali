'use strict';
/**
 * REAL frontend-path verification: the customer booking flow now calls the
 * onCall function `createMobileBarberBookingGuarded` (same protocol the browser
 * SDK uses) which runs the conflict guard BEFORE writing. This test:
 *   A. anon sign-in (like the public page)
 *   B. create booking A (clear slot) via the callable        → ok:true, A written
 *   C. create booking B (same vendor/date/time, diff service) → ok:false time_conflict,
 *      with suggested alternate times, and B is NEVER written (pre-write block)
 *   D. cleanup
 * Proves the double-booking is blocked at submission, not auto-declined after success.
 *
 *   node tests/live/mb-frontend-guarded-create-verify.js
 */
const https = require('https');
const admin = require(require('path').join(__dirname, '../../functions/node_modules/firebase-admin'));

const PROJECT = 'dulichcali-booking-calendar';
const API_KEY = 'AIzaSyCo1FzDthSCXINRHlyJkqdcVKq_inM71SQ';
const COLLECTION = 'mobileBarberBookings';
const CALLABLE = `https://us-central1-${PROJECT}.cloudfunctions.net/createMobileBarberBookingGuarded`;
const ORIGIN = 'https://www.dulichcali21.com';

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: PROJECT });
const db = admin.firestore();

let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? '  PASS ' : '  FAIL ') + n + (d ? ' — ' + d : '')); };

function req(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: u.hostname, path: u.pathname + u.search,
      headers: Object.assign({ 'Content-Type': 'application/json', Referer: ORIGIN, Origin: ORIGIN }, headers || {}) };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const r = https.request(opts, res => { let c = ''; res.on('data', d => c += d); res.on('end', () => { let j = null; try { j = JSON.parse(c); } catch (e) {} resolve({ status: res.statusCode, body: j, raw: c }); }); });
    r.on('error', reject); if (data) r.write(data); r.end();
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const ID_A = 'SMOKE_FE_A_classic';
const ID_B = 'SMOKE_FE_B_lineup';
function booking(id, serviceId, serviceName, startTime, endTime, phone, name) {
  return {
    id, bookingRequestId: id, vendorId: 'michael-nguyen-oc', ownerId: 'michael-nguyen',
    serviceType: 'barber', assignedBarberId: 'michael-nguyen-oc',
    customerName: name || 'Frontend Guard Test', customerPhone: phone || '4085550199',
    serviceId, serviceName, servicePrice: 40, amountDue: 40,
    address: '14001 FE Way', city: 'Westminster', zip: '92683',
    requestedDate: '2026-06-17', startTime, endTime,
    status: 'pending_barber_confirmation', source: 'customer_form',
    notes: 'frontend guarded-create verify — safe to delete',
  };
}
function callGuarded(idToken, bk) {
  return req('POST', CALLABLE, { Authorization: 'Bearer ' + idToken }, { data: { booking: bk } });
}

(async () => {
  console.log('\n== FRONTEND GUARDED-CREATE VERIFY (live callable) ==\n');
  for (const id of [ID_A, ID_B]) { try { await db.collection(COLLECTION).doc(id).delete(); } catch (e) {} }

  const auth = await req('POST', `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {}, { returnSecureToken: true });
  const idToken = auth.body && auth.body.idToken;
  check('Anonymous sign-in (like the public page)', !!idToken, idToken ? 'ok' : JSON.stringify(auth.body));
  if (!idToken) { process.exit(1); }

  // B — first booking on a CLEAR slot → must succeed + write
  const rA = await callGuarded(idToken, booking(ID_A, 'michael-nguyen-oc-classic-haircut', 'Classic Haircut', '14:00', '14:45'));
  const okA = rA.body && rA.body.result && rA.body.result.ok === true;
  check('Booking A on a clear slot is accepted (ok:true)', okA, 'HTTP ' + rA.status + ' ' + JSON.stringify(rA.body && rA.body.result || rA.body));
  await sleep(1500);
  const aSnap = await db.collection(COLLECTION).doc(ID_A).get();
  check('Booking A was written to Firestore', aSnap.exists, aSnap.exists ? 'status=' + aSnap.data().status : 'missing');

  // C — a DIFFERENT customer wants the SAME vendor/date/time → pure time_conflict, no write.
  // (Same-customer duplicates are exercised by mb-duplicate-intent-verify.js.)
  const rB = await callGuarded(idToken, booking(ID_B, 'michael-nguyen-oc-line-up', 'Line Up', '14:00', '14:45', '4085550111', 'Different Customer'));
  const resB = (rB.body && rB.body.result) || {};
  check('Overlapping booking B is BLOCKED before write (ok:false)', resB.ok === false, 'HTTP ' + rB.status + ' ' + JSON.stringify(resB));
  check('Block reason is time_conflict', resB.code === 'time_conflict', resB.code || 'n/a');
  check('Alternate times are suggested', Array.isArray(resB.suggestions) && resB.suggestions.length > 0,
    resB.suggestions ? resB.suggestions.join(', ') : 'none');
  await sleep(1500);
  const bSnap = await db.collection(COLLECTION).doc(ID_B).get();
  check('Booking B was NEVER written (no duplicate/active booking)', !bSnap.exists, bSnap.exists ? 'LEAKED status=' + bSnap.data().status : 'absent');

  console.log('\n── Cleanup ──');
  let del = 0;
  for (const id of [ID_A, ID_B]) { try { const s = await db.collection(COLLECTION).doc(id).get(); if (s.exists) { await s.ref.delete(); del++; } } catch (e) {} }
  check('Test docs cleaned up', true, 'deleted=' + del);

  console.log('\n==================================================');
  console.log('FRONTEND GUARDED-CREATE: ' + pass + ' passed, ' + fail + ' failed');
  console.log('==================================================');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
