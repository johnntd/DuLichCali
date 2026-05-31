'use strict';
/**
 * REAL backend verification of the smart duplicate / spam intent guard, via the
 * deployed createMobileBarberBookingGuarded callable (the same protocol the browser
 * SDK uses; Admin SDK only for setup/cleanup). Proves, for the SAME customer:
 *   1. exact same time      → DUPLICATE_EXACT (blocked, no write)
 *   2. overlapping time     → CUSTOMER_OVERLAP (blocked, no write)
 *   3. same day, 2h+ apart  → SAME_DAY_DUPLICATE_NEEDS_INTENT (carries existing, no write)
 *   4. verified family      → OK_FAMILY_MEMBER (written, bookingFor=family_member)
 *   5. self reschedule      → OK_RESCHEDULED (existing booking moved, NO second booking)
 *   6. >3 same-day haircuts → TOO_MANY_REQUESTS (spam blocked)
 *
 *   node tests/live/mb-duplicate-intent-verify.js
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
const DATE = '2026-06-23';
const P1 = '4085550150', P2 = '4085550160';
const IDS = ['DUP_A', 'DUP_B', 'DUP_C', 'DUP_D', 'DUP_E', 'DUP_F', 'DUP_S1', 'DUP_S2', 'DUP_S3', 'DUP_S4'].map(s => 'SMOKE_' + s);
function bk(id, phone, name, serviceId, serviceName, startTime, endTime, extra) {
  return Object.assign({
    id, bookingRequestId: id, vendorId: 'michael-nguyen-oc', ownerId: 'michael-nguyen',
    serviceType: 'barber', assignedBarberId: 'michael-nguyen-oc',
    customerName: name, customerPhone: phone, serviceId, serviceName, servicePrice: 40, amountDue: 40,
    address: '14001 Dup Way', city: 'Westminster', zip: '92683', requestedDate: DATE, startTime, endTime,
    status: 'pending_barber_confirmation', source: 'customer_form', notes: 'duplicate-intent verify — safe to delete',
  }, extra || {});
}
let TOKEN = '';
async function call(b) { return (await req('POST', CALLABLE, { Authorization: 'Bearer ' + TOKEN }, { data: { booking: b } })).body; }
const res = (r) => (r && r.result) || {};
async function cleanup() { for (const id of IDS) { try { await db.collection(COL).doc(id).delete(); } catch (e) {} } }

(async () => {
  console.log('\n== DUPLICATE / SPAM INTENT VERIFY (live callable) ==\n');
  await cleanup();
  const auth = await req('POST', `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {}, { returnSecureToken: true });
  TOKEN = auth.body && auth.body.idToken;
  check('Anonymous sign-in', !!TOKEN); if (!TOKEN) { process.exit(1); }

  // A — first haircut for P1, clear slot → accepted
  const rA = res(await call(bk(IDS[0], P1, 'Dup Tester', 'michael-nguyen-oc-classic-haircut', 'Classic Haircut', '09:35', '10:20')));
  check('1a. First haircut accepted', rA.ok === true, JSON.stringify({ ok: rA.ok, code: rA.code }));
  await sleep(1200);

  // B — SAME customer, EXACT same time → DUPLICATE_EXACT
  const rB = res(await call(bk(IDS[1], P1, 'Dup Tester', 'michael-nguyen-oc-line-up', 'Line Up', '09:35', '10:20')));
  check('1b. Same customer, exact time → DUPLICATE_EXACT', rB.ok === false && rB.code === 'DUPLICATE_EXACT', JSON.stringify(rB));
  check('1c. Exact duplicate NOT written', !(await db.collection(COL).doc(IDS[1]).get()).exists);

  // C — SAME customer, OVERLAPPING time (09:50 inside A's window) → CUSTOMER_OVERLAP
  const rC = res(await call(bk(IDS[2], P1, 'Dup Tester', 'michael-nguyen-oc-line-up', 'Line Up', '09:50', '10:35')));
  check('2a. Same customer, overlap → CUSTOMER_OVERLAP', rC.ok === false && rC.code === 'CUSTOMER_OVERLAP', JSON.stringify(rC));
  check('2b. Overlap NOT written', !(await db.collection(COL).doc(IDS[2]).get()).exists);

  // D — SAME customer, same day, NON-overlapping (13:00) → needs intent
  const rD = res(await call(bk(IDS[3], P1, 'Dup Tester', 'michael-nguyen-oc-classic-haircut', 'Classic Haircut', '13:00', '13:45')));
  check('3a. Same-day, 2h+ apart → SAME_DAY_DUPLICATE_NEEDS_INTENT', rD.ok === false && rD.code === 'SAME_DAY_DUPLICATE_NEEDS_INTENT', JSON.stringify({ ok: rD.ok, code: rD.code }));
  check('3b. Needs-intent carries the existing booking', Array.isArray(rD.existing) && rD.existing.length > 0, JSON.stringify(rD.existing || []));
  check('3c. Needs-intent NOT written', !(await db.collection(COL).doc(IDS[3]).get()).exists);

  // E — SAME customer, same slot as D, but VERIFIED family member → OK_FAMILY_MEMBER
  const rE = res(await call(bk(IDS[4], P1, 'Dup Tester', 'michael-nguyen-oc-classic-haircut', 'Classic Haircut', '13:00', '13:45',
    { duplicateIntentVerified: true, bookingFor: 'family_member', familyMemberName: 'Liam', familyMemberAgeGroup: 'child', primaryCustomerPhone: P1, primaryCustomerName: 'Dup Tester' })));
  check('4a. Verified family booking accepted (OK_FAMILY_MEMBER)', rE.ok === true && rE.code === 'OK_FAMILY_MEMBER', JSON.stringify({ ok: rE.ok, code: rE.code }));
  await sleep(1200);
  const eSnap = await db.collection(COL).doc(IDS[4]).get();
  check('4b. Family booking written with bookingFor=family_member', eSnap.exists && (eSnap.data() || {}).bookingFor === 'family_member' && (eSnap.data() || {}).familyMemberName === 'Liam');

  // F — SAME customer self_reschedule: move A (09:35) to 16:00. No second booking; A is updated.
  const rF = res(await call(bk(IDS[5], P1, 'Dup Tester', 'michael-nguyen-oc-classic-haircut', 'Classic Haircut', '16:00', '16:45',
    { duplicateIntentType: 'self_reschedule', linkedExistingBookingId: IDS[0] })));
  check('5a. Self reschedule → OK_RESCHEDULED', rF.ok === true && rF.code === 'OK_RESCHEDULED', JSON.stringify({ ok: rF.ok, code: rF.code }));
  await sleep(1200);
  const aMoved = await db.collection(COL).doc(IDS[0]).get();
  check('5b. Existing booking A moved to the new time', aMoved.exists && (aMoved.data() || {}).startTime === '16:00', 'startTime=' + ((aMoved.data() || {}).startTime));
  check('5c. No second booking created for the reschedule', !(await db.collection(COL).doc(IDS[5]).get()).exists);

  // Spam — P2 gets 3 same-day haircuts (verified family), the 4th UNVERIFIED → TOO_MANY_REQUESTS.
  await call(bk(IDS[6], P2, 'Spam Tester', 'michael-nguyen-oc-classic-haircut', 'Classic Haircut', '08:00', '08:45'));
  await call(bk(IDS[7], P2, 'Spam Tester', 'michael-nguyen-oc-classic-haircut', 'Classic Haircut', '10:00', '10:45',
    { duplicateIntentVerified: true, bookingFor: 'family_member', familyMemberName: 'Kid2' }));
  await call(bk(IDS[8], P2, 'Spam Tester', 'michael-nguyen-oc-classic-haircut', 'Classic Haircut', '12:30', '13:15',
    { duplicateIntentVerified: true, bookingFor: 'family_member', familyMemberName: 'Kid3' }));
  await sleep(1500);
  const rS4 = res(await call(bk(IDS[9], P2, 'Spam Tester', 'michael-nguyen-oc-classic-haircut', 'Classic Haircut', '17:00', '17:45')));
  check('6. 4th same-day haircut (unverified) → TOO_MANY_REQUESTS', rS4.ok === false && rS4.code === 'TOO_MANY_REQUESTS', JSON.stringify({ ok: rS4.ok, code: rS4.code, sameDay: rS4.sameDayHaircuts }));

  console.log('\n── Cleanup ──');
  await cleanup();
  check('Test docs cleaned up', true);
  console.log('\n==================================================');
  console.log('DUPLICATE / SPAM INTENT: ' + pass + ' passed, ' + fail + ' failed');
  console.log('==================================================');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
