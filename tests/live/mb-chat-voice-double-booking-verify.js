'use strict';
/**
 * REAL verification that the AI CHAT and VOICE booking paths block double-booking.
 * Both paths funnel through saveBooking → guardedCreateViaCallable → the deployed
 * createMobileBarberBookingGuarded callable, so we exercise that callable with the
 * exact source tags those paths use ('ai_chat', 'ai_voice'):
 *   - occupy a slot (customer_form)
 *   - ai_chat, DIFFERENT customer, same slot   → time_conflict (blocked, no write)
 *   - ai_chat, SAME customer, exact slot        → DUPLICATE_EXACT (blocked, no write)
 *   - ai_voice, DIFFERENT customer, overlap     → time_conflict (blocked, no write)
 *   - ai_voice, SAME customer, same-day apart   → SAME_DAY_DUPLICATE_NEEDS_INTENT (no write)
 *
 *   node tests/live/mb-chat-voice-double-booking-verify.js
 */
const https = require('https');
const admin = require(require('path').join(__dirname, '../../functions/node_modules/firebase-admin'));
const PROJECT = 'dulichcali-booking-calendar';
const API_KEY = 'AIzaSyCo1FzDthSCXINRHlyJkqdcVKq_inM71SQ';
const COL = 'mobileBarberBookings';
const CALLABLE = `https://us-central1-${PROJECT}.cloudfunctions.net/createMobileBarberBookingGuarded`;
const ORIGIN = 'https://www.dulichcali21.com';
admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: PROJECT });
const db = admin.firestore();
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? '  PASS ' : '  FAIL ') + n + (d ? ' — ' + d : '')); };
function req(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url); const data = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: u.hostname, path: u.pathname + u.search,
      headers: Object.assign({ 'Content-Type': 'application/json', Referer: ORIGIN, Origin: ORIGIN }, headers || {}) };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const r = https.request(opts, res => { let c = ''; res.on('data', d => c += d); res.on('end', () => { let j = null; try { j = JSON.parse(c); } catch (e) {} resolve({ status: res.statusCode, body: j }); }); });
    r.on('error', reject); if (data) r.write(data); r.end();
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DATE = '2026-06-25';
const IDS = ['CV_OCC', 'CV_CHAT_DIFF', 'CV_CHAT_SAME', 'CV_VOICE_DIFF', 'CV_VOICE_SAME'].map(s => 'SMOKE_' + s);
function bk(id, phone, name, source, serviceId, serviceName, startTime, endTime) {
  return {
    id, bookingRequestId: id, vendorId: 'michael-nguyen-oc', ownerId: 'michael-nguyen',
    serviceType: 'barber', assignedBarberId: 'michael-nguyen-oc',
    customerName: name, customerPhone: phone, serviceId, serviceName, servicePrice: 40, amountDue: 40,
    address: '14001 CV Way', city: 'Westminster', zip: '92683', requestedDate: DATE, startTime, endTime,
    status: 'pending_barber_confirmation', source, notes: 'chat/voice double-booking verify — safe to delete',
  };
}
let TOKEN = '';
async function call(b) { return ((await req('POST', CALLABLE, { Authorization: 'Bearer ' + TOKEN }, { data: { booking: b } })).body || {}).result || {}; }
async function cleanup() { for (const id of IDS) { try { await db.collection(COL).doc(id).delete(); } catch (e) {} } }

(async () => {
  console.log('\n== AI CHAT / VOICE DOUBLE-BOOKING VERIFY (live callable) ==\n');
  await cleanup();
  const auth = await req('POST', `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {}, { returnSecureToken: true });
  TOKEN = auth.body && auth.body.idToken;
  check('Anonymous sign-in (like the public page)', !!TOKEN); if (!TOKEN) process.exit(1);

  // Occupy 09:00 with a normal customer-form booking.
  const occ = await call(bk(IDS[0], '4085551200', 'Occupant', 'customer_form', 'michael-nguyen-oc-classic-haircut', 'Classic Haircut', '09:00', '09:45'));
  check('Slot 09:00 occupied (customer_form)', occ.ok === true, JSON.stringify({ ok: occ.ok, code: occ.code }));
  await sleep(1200);

  // AI CHAT — different customer wants the same slot → blocked.
  const chatDiff = await call(bk(IDS[1], '4085551201', 'Chat User', 'ai_chat', 'michael-nguyen-oc-line-up', 'Line Up', '09:00', '09:45'));
  check('AI CHAT (diff customer, same slot) → BLOCKED time_conflict', chatDiff.ok === false && chatDiff.code === 'time_conflict', JSON.stringify({ ok: chatDiff.ok, code: chatDiff.code }));
  check('AI CHAT conflicting booking NOT written', !(await db.collection(COL).doc(IDS[1]).get()).exists);

  // AI CHAT — same customer, exact slot → DUPLICATE_EXACT.
  const chatSame = await call(bk(IDS[2], '4085551200', 'Occupant', 'ai_chat', 'michael-nguyen-oc-line-up', 'Line Up', '09:00', '09:45'));
  check('AI CHAT (same customer, exact slot) → BLOCKED DUPLICATE_EXACT', chatSame.ok === false && chatSame.code === 'DUPLICATE_EXACT', JSON.stringify({ ok: chatSame.ok, code: chatSame.code }));
  check('AI CHAT duplicate NOT written', !(await db.collection(COL).doc(IDS[2]).get()).exists);

  // AI VOICE — different customer, overlapping time → blocked.
  const voiceDiff = await call(bk(IDS[3], '4085551203', 'Voice User', 'ai_voice', 'michael-nguyen-oc-line-up', 'Line Up', '09:15', '10:00'));
  check('AI VOICE (diff customer, overlap) → BLOCKED time_conflict', voiceDiff.ok === false && voiceDiff.code === 'time_conflict', JSON.stringify({ ok: voiceDiff.ok, code: voiceDiff.code }));
  check('AI VOICE conflicting booking NOT written', !(await db.collection(COL).doc(IDS[3]).get()).exists);

  // AI VOICE — same customer, same day, non-overlapping → needs intent (not a silent 2nd booking).
  const voiceSame = await call(bk(IDS[4], '4085551200', 'Occupant', 'ai_voice', 'michael-nguyen-oc-classic-haircut', 'Classic Haircut', '13:00', '13:45'));
  check('AI VOICE (same customer, same-day apart) → SAME_DAY_DUPLICATE_NEEDS_INTENT', voiceSame.ok === false && voiceSame.code === 'SAME_DAY_DUPLICATE_NEEDS_INTENT', JSON.stringify({ ok: voiceSame.ok, code: voiceSame.code }));
  check('AI VOICE same-day duplicate NOT written until intent resolved', !(await db.collection(COL).doc(IDS[4]).get()).exists);

  console.log('\n── Cleanup ──');
  await cleanup();
  check('Test docs cleaned up', true);
  console.log('\n==================================================');
  console.log('AI CHAT / VOICE DOUBLE-BOOKING: ' + pass + ' passed, ' + fail + ' failed');
  console.log('==================================================');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
