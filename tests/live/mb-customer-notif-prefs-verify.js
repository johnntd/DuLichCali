'use strict';
/**
 * LIVE verification of the customer notification PREFERENCE GATE + multilingual copy
 * against the DEPLOYED onMobileBarberCustomerBookingStatus trigger.
 *
 * Proves:
 *   - A status change to a type the customer DISABLED ('confirmations' off) produces
 *     NO customerNotifications doc (server gate suppresses it).
 *   - A status change to an ENABLED type ('reschedules' on) DOES produce a doc, and the
 *     copy is localized to the customer's preferredLanguage (vi).
 *   - Owner can persist a settings value (reminderPreferenceWeeks) under deployed rules.
 *
 *   node tests/live/mb-customer-notif-prefs-verify.js
 */
const https = require('https');
const admin = require(require('path').join(__dirname, '../../functions/node_modules/firebase-admin'));
const PROJECT = 'dulichcali-booking-calendar';
const API_KEY = 'AIzaSyCo1FzDthSCXINRHlyJkqdcVKq_inM71SQ';
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: PROJECT });
const db = admin.firestore();
const auth = admin.auth();
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? '  PASS ' : '  FAIL ') + n + (d ? ' — ' + d : '')); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function req(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url); const data = body ? JSON.stringify(body) : null;
    const ORIGIN = 'https://www.dulichcali21.com';
    const opts = { method, hostname: u.hostname, path: u.pathname + u.search, headers: Object.assign({ 'Content-Type': 'application/json', Referer: ORIGIN, Origin: ORIGIN }, headers || {}) };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const r = https.request(opts, res => { let c = ''; res.on('data', d => c += d); res.on('end', () => { let j = null; try { j = JSON.parse(c); } catch (e) {} resolve({ status: res.statusCode, body: j }); }); });
    r.on('error', reject); if (data) r.write(data); r.end();
  });
}
async function authUser(email, password) {
  let r = await req('POST', `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {}, { email, password, returnSecureToken: true });
  if (!(r.body && r.body.idToken)) r = await req('POST', `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {}, { email, password, returnSecureToken: true });
  return { idToken: r.body && r.body.idToken, uid: r.body && r.body.localId };
}
const patchDoc = (path, fields, tok) => req('PATCH', `${FS}/${path}?` + Object.keys(fields).map(f => 'updateMask.fieldPaths=' + f).join('&'), { Authorization: 'Bearer ' + tok }, { fields });

const EMAIL = 'notifpref-test@mb-prefs.dulichcali21.local';
const PW = 'Str0ng-Pref-Pass-2026!!';

async function waitForDoc(id, wantPresent, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const snap = await db.collection('customerNotifications').doc(id).get();
    if (snap.exists === wantPresent) return snap.exists ? (snap.data() || {}) : null;
    await sleep(1500);
  }
  const snap = await db.collection('customerNotifications').doc(id).get();
  return snap.exists ? (snap.data() || {}) : null;
}

(async () => {
  console.log('\n== CUSTOMER NOTIFICATION-PREFERENCE GATE VERIFY (live, deployed trigger) ==\n');
  const C = await authUser(EMAIL, PW);
  check('Customer account authenticated', !!(C.idToken && C.uid));
  if (!C.uid) process.exit(1);

  const bid = 'mb-pn-' + Date.now();
  const confirmedId = `${bid}_booking_confirmed`;
  const reschedId = `${bid}_booking_rescheduled`;

  try {
    // Seed profile: confirmations OFF, reschedules ON, language = vi.
    await db.collection('mobileBarberCustomers').doc(C.uid).set({
      customerId: C.uid, customerUid: C.uid, name: 'Pref Test', normalizedPhone: '4085559777',
      preferredLanguage: 'vi', reminderPreferenceWeeks: 4,
      notificationPreferences: { app: true, push: false, reminders: true, bookingUpdates: true, confirmations: false, reschedules: true, appointmentReminders: true, haircutReminders: true },
    }, { merge: true });

    // Owner can persist a settings value under deployed rules (custom reminder interval = 5).
    const ow = await patchDoc('mobileBarberCustomers/' + C.uid, { reminderPreferenceWeeks: { integerValue: 5 } }, C.idToken);
    check('Owner CAN persist a settings value (reminderPreferenceWeeks) under deployed rules', ow.status === 200, 'status=' + ow.status);

    // Create the booking (no notification expected for the pending status).
    await db.collection('mobileBarberBookings').doc(bid).set({
      customerId: C.uid, customerUid: C.uid, status: 'pending_barber_confirmation',
      serviceName: 'Classic Haircut', requestedDate: '2026-07-01', startTime: '10:00',
      vendorId: 'michael-nguyen-oc', ownerId: 'michael-nguyen-oc', totalPrice: 35,
    }, { merge: true });
    await sleep(2000);

    // 1) confirmations OFF → flip to confirmed → expect NO booking_confirmed notification.
    await db.collection('mobileBarberBookings').doc(bid).set({ status: 'confirmed' }, { merge: true });
    const confirmedDoc = await waitForDoc(confirmedId, true, 28000); // give the trigger time; want it to STAY absent
    check('Disabled type (confirmations OFF) → confirmation notification SUPPRESSED', confirmedDoc === null,
      confirmedDoc ? 'unexpected doc: ' + JSON.stringify(confirmedDoc.title) : 'no doc (correct)');

    // 2) reschedules ON → flip to rescheduled → expect a localized (vi) notification.
    await db.collection('mobileBarberBookings').doc(bid).set({ status: 'rescheduled' }, { merge: true });
    const reschedDoc = await waitForDoc(reschedId, true, 28000);
    check('Enabled type (reschedules ON) → reschedule notification CREATED', !!reschedDoc, reschedDoc ? 'present' : 'missing');
    check('Reschedule copy is localized to vi', !!reschedDoc && reschedDoc.body === 'Giờ hẹn của bạn đã thay đổi.',
      reschedDoc ? 'body=' + JSON.stringify(reschedDoc.body) : 'n/a');
    check('Notification is scoped to the customer', !!reschedDoc && reschedDoc.customerId === C.uid);
  } finally {
    // Cleanup
    await db.collection('mobileBarberBookings').doc(bid).delete().catch(() => {});
    await db.collection('customerNotifications').doc(confirmedId).delete().catch(() => {});
    await db.collection('customerNotifications').doc(reschedId).delete().catch(() => {});
    await db.collection('mobileBarberCustomers').doc(C.uid).delete().catch(() => {});
    await auth.deleteUser(C.uid).catch(() => {});
    console.log('  (cleaned booking + notifications + profile + auth user)');
  }

  console.log(`\n  RESULT: ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
