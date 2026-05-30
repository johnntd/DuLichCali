'use strict';
/**
 * Mobile Barber — GO-LIVE booking smoke test (live production Firestore).
 *
 * Exercises the REAL customer write path (anonymous auth → Firestore REST,
 * which IS subject to security rules — unlike the Admin SDK which bypasses
 * them) plus Admin-SDK verification and cleanup.
 *
 *   Phase 1  Anonymous create accepted by live rules (incl. new bookingRequestId
 *            + promo snapshot fields)                       → the prior-incident regression
 *   Phase 2  Booking visible in vendor owner-scoped query    → vendor portal receives it
 *   Phase 3  Duplicate submit (same deterministic id) blocked → no double booking
 *   Phase 4  Overlapping booking elevated to vendor_review by the live
 *            onMobileBarberBookingCreated Cloud Function      → server conflict guard
 *   Phase 5  Cleanup: delete every SMOKE_TEST_ doc (Admin)    → no residue
 *
 * Identity:  name "Smoke Test", phone 408-555-0199, all doc ids SMOKE_TEST_*.
 * No vendor notification is sent (the Cloud Function does not notify), and all
 * docs are deleted at the end.
 *
 *   node tests/live/mb-go-live-smoke.js
 */

const https = require('https');
const admin = require(require('path').join(__dirname, '../../functions/node_modules/firebase-admin'));

const PROJECT = 'dulichcali-booking-calendar';
const API_KEY = 'AIzaSyCo1FzDthSCXINRHlyJkqdcVKq_inM71SQ';
const COLLECTION = 'mobileBarberBookings';
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: PROJECT });
const db = admin.firestore();

let pass = 0, fail = 0;
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || '' });
  if (ok) { pass++; console.log('  PASS', name, detail ? '— ' + detail : ''); }
  else { fail++; console.log('  FAIL', name, detail ? '— ' + detail : ''); }
}

// The web API key is HTTP-referrer-restricted to the production domain (good
// security), so every REST call must present the production Referer/Origin —
// exactly what a real browser on www.dulichcali21.com sends.
const ORIGIN = 'https://www.dulichcali21.com';
function req(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: u.hostname, path: u.pathname + u.search,
      headers: Object.assign({ 'Content-Type': 'application/json', Referer: ORIGIN, Origin: ORIGIN }, headers || {}) };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const r = https.request(opts, res => {
      let chunks = '';
      res.on('data', d => chunks += d);
      res.on('end', () => { let j = null; try { j = JSON.parse(chunks); } catch (e) {} resolve({ status: res.statusCode, body: j, raw: chunks }); });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

// JS value -> Firestore REST typed Value
function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}
function toFields(obj) { const f = {}; Object.keys(obj).forEach(k => { f[k] = toValue(obj[k]); }); return f; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Realistic Michael (OC) booking — Westminster routes to Michael. 20% promo applied.
function michaelBooking(id, startTime, endTime) {
  const original = 40, percent = 20, discounted = Math.round(original * (1 - percent / 100));
  return {
    id: id,
    bookingRequestId: id.replace('SMOKE_TEST_', ''),
    vendorId: 'michael-nguyen-oc',
    ownerId: 'michael-nguyen',
    serviceType: 'barber',
    assignedBarberId: 'michael-nguyen-oc',
    customerName: 'Smoke Test',
    customerPhone: '4085550199',
    customerEmail: '',
    serviceId: 'michael-nguyen-oc-classic-haircut',
    serviceName: 'Classic Haircut',
    servicePrice: discounted,
    travelFee: 0,
    amountDue: discounted,
    totalPrice: discounted,
    paymentMethod: 'cash',
    paymentStatus: 'unpaid',
    address: '14001 Smoke Test Way',
    city: 'Westminster',
    zip: '92683',
    requestedDate: '2026-06-15',
    startTime: startTime,
    endTime: endTime,
    status: 'pending_barber_confirmation',
    source: 'customer_form',
    notes: 'GO-LIVE smoke test — safe to delete',
    promotionId: 'promo-mpq5rn0f-v1e8',
    promotionName: "Father's Day 20% off",
    discountPercent: percent,
    originalPrice: original,
    discountedPrice: discounted,
    promoApplied: true,
    createdAt: '2026-05-30T18:00:00.000Z',
    updatedAt: '2026-05-30T18:00:00.000Z'
  };
}

async function anonCreate(idToken, docId, booking) {
  return req('POST', `${FS_BASE}/${COLLECTION}?documentId=${docId}`,
    { Authorization: 'Bearer ' + idToken }, { fields: toFields(booking) });
}

(async () => {
  console.log('\n==================================================');
  console.log('MOBILE BARBER — GO-LIVE BOOKING SMOKE (live Firestore)');
  console.log('==================================================\n');

  // Pre-clean any residue from a prior aborted run
  const pre = await db.collection(COLLECTION).get();
  for (const d of pre.docs) { if (d.id.startsWith('SMOKE_TEST_')) await d.ref.delete(); }

  // Anonymous sign-in (same as a real customer page)
  const auth = await req('POST', `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {}, { returnSecureToken: true });
  check('Anonymous auth (signInAnonymously)', auth.status === 200 && auth.body && auth.body.idToken, 'status ' + auth.status);
  if (!auth.body || !auth.body.idToken) { console.log('\nABORT: no anon token'); process.exit(1); }
  const idToken = auth.body.idToken;

  const ID1 = 'SMOKE_TEST_mb_primary_1015';
  const ID2 = 'SMOKE_TEST_mb_conflict_1025';

  // ── PHASE 1 — live rules accept the real customer booking shape ──────────────
  console.log('\n── Phase 1: anonymous create accepted by live rules ──');
  const c1 = await anonCreate(idToken, ID1, michaelBooking(ID1, '10:00', '10:40'));
  check('Anon create accepted by live security rules', c1.status === 200,
    'HTTP ' + c1.status + (c1.status !== 200 ? ' ' + (c1.raw || '').slice(0, 200) : ''));
  check('bookingRequestId field accepted (no rules rejection)', c1.status === 200);
  check('Promo snapshot fields accepted on create', c1.status === 200);

  // ── PHASE 2 — vendor owner-scoped query sees it ─────────────────────────────
  console.log('\n── Phase 2: vendor portal (owner-scoped) receives it ──');
  const ownerSnap = await db.collection(COLLECTION).where('ownerId', '==', 'michael-nguyen').get();
  const found = ownerSnap.docs.find(d => d.id === ID1);
  check('Booking visible in Michael owner-scoped query', !!found);
  if (found) {
    const b = found.data();
    check('Stored status is a pending/review status', ['pending_barber_confirmation', 'pending_confirmation', 'vendor_review'].indexOf(b.status) >= 0, b.status);
    check('Promo snapshot persisted (id + discounted + original)', b.promotionId === 'promo-mpq5rn0f-v1e8' && b.discountedPrice === 32 && b.originalPrice === 40, `promo=${b.promotionId} ${b.originalPrice}→${b.discountedPrice}`);
    check('Discounted price is not $0 (sanity)', Number(b.discountedPrice) > 0, '$' + b.discountedPrice);
    check('bookingRequestId stored on doc', !!b.bookingRequestId, b.bookingRequestId);
  }

  // ── PHASE 3 — duplicate submit blocked (deterministic id → ALREADY_EXISTS) ───
  console.log('\n── Phase 3: duplicate submit blocked (no double booking) ──');
  const dup = await anonCreate(idToken, ID1, michaelBooking(ID1, '10:00', '10:40'));
  check('Duplicate create (same deterministic id) is rejected', dup.status === 409 || dup.status === 403,
    'HTTP ' + dup.status + ' (expect 409 ALREADY_EXISTS)');
  const afterDup = await db.collection(COLLECTION).where('ownerId', '==', 'michael-nguyen').get();
  const dupCount = afterDup.docs.filter(d => d.id === ID1).length;
  check('Exactly one document exists for the duplicate id', dupCount === 1, 'count=' + dupCount);

  // ── PHASE 4 — overlapping booking elevated by live Cloud Function ────────────
  console.log('\n── Phase 4: overlapping booking → server conflict guard ──');
  const c2 = await anonCreate(idToken, ID2, michaelBooking(ID2, '10:20', '11:00'));
  check('Overlapping booking created (pending) for conflict test', c2.status === 200, 'HTTP ' + c2.status);
  let elevated = null;
  for (let i = 0; i < 12 && c2.status === 200; i++) {
    await sleep(2500);
    const d2 = await db.collection(COLLECTION).doc(ID2).get();
    const s = d2.exists ? d2.data().status : null;
    if (s === 'vendor_review') { elevated = d2.data(); break; }
  }
  check('onMobileBarberBookingCreated elevated overlap to vendor_review', !!elevated,
    elevated ? ('reviewReason=' + (elevated.reviewReason || '')) : 'still not vendor_review after ~30s');

  // ── PHASE 5 — cleanup ───────────────────────────────────────────────────────
  console.log('\n── Phase 5: cleanup (delete all SMOKE_TEST_ docs) ──');
  const post = await db.collection(COLLECTION).get();
  let deleted = 0;
  for (const d of post.docs) { if (d.id.startsWith('SMOKE_TEST_')) { await d.ref.delete(); deleted++; } }
  const verify = await db.collection(COLLECTION).get();
  const remaining = verify.docs.filter(d => d.id.startsWith('SMOKE_TEST_')).length;
  check('All smoke-test docs deleted (cleanup)', remaining === 0, 'deleted=' + deleted + ', remaining=' + remaining);

  console.log('\n==================================================');
  console.log('SMOKE RESULT:', pass + ' passed, ' + fail + ' failed');
  console.log('==================================================\n');
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('SMOKE ERROR', e && e.stack || e); process.exit(1); });
