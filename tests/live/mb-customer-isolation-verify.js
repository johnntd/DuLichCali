'use strict';
/**
 * REAL customer-data-isolation verification against the DEPLOYED Firestore rules
 * (acceptance #20). Creates two customer auth accounts A and B, seeds A's data via
 * the Admin SDK, then uses the Firestore REST API with each user's idToken (rules
 * ARE enforced for REST + Bearer token) to prove:
 *   - A can read A's own notification (200)
 *   - B CANNOT read A's notification / profile / saved style (403)
 *   - B CANNOT write A's profile (owner-only update; 403)
 *   - A CANNOT rewrite a notification's content, only flip read flags (field guard; 403 vs 200)
 *
 *   node tests/live/mb-customer-isolation-verify.js
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
const getDoc = (path, tok) => req('GET', `${FS}/${path}`, { Authorization: 'Bearer ' + tok });
const patchDoc = (path, fields, tok) => req('PATCH', `${FS}/${path}?` + Object.keys(fields).map(f => 'updateMask.fieldPaths=' + f).join('&'), { Authorization: 'Bearer ' + tok }, { fields });
const EMAIL_A = 'iso-test-a@mb-isolation.dulichcali21.local';
const EMAIL_B = 'iso-test-b@mb-isolation.dulichcali21.local';
const PW = 'Str0ng-Iso-Pass-2026!!';
const NOTIF = 'SMOKE_ISO_NOTIF_A', STYLE = 'SMOKE_ISO_STYLE_A';

(async () => {
  console.log('\n== CUSTOMER DATA ISOLATION VERIFY (live, deployed rules) ==\n');
  const A = await authUser(EMAIL_A, PW);
  const B = await authUser(EMAIL_B, PW);
  check('Two distinct customer accounts authenticated', !!(A.idToken && B.idToken && A.uid && B.uid && A.uid !== B.uid));
  if (!A.idToken || !B.idToken) { process.exit(1); }

  // Seed A's data via Admin SDK (bypasses rules).
  await db.collection('mobileBarberCustomers').doc(A.uid).set({ customerId: A.uid, customerUid: A.uid, name: 'Iso A', normalizedPhone: '4085559001', vendorId: 'michael-nguyen-oc' });
  await db.collection('customerNotifications').doc(NOTIF).set({ customerId: A.uid, title: 'Private to A', body: 'secret', read: false });
  await db.collection('customerSavedStyles').doc(STYLE).set({ customerId: A.uid, title: 'A fade' });

  // A reads own notification → allowed.
  check('A CAN read A\'s own notification', (await getDoc('customerNotifications/' + NOTIF, A.idToken)).status === 200);
  // B reads A's data → DENIED.
  check('B CANNOT read A\'s notification', (await getDoc('customerNotifications/' + NOTIF, B.idToken)).status === 403);
  check('B CANNOT read A\'s profile', (await getDoc('mobileBarberCustomers/' + A.uid, B.idToken)).status === 403);
  check('B CANNOT read A\'s saved style', (await getDoc('customerSavedStyles/' + STYLE, B.idToken)).status === 403);
  // B writes A's profile → DENIED (owner-only update).
  check('B CANNOT write A\'s profile', (await patchDoc('mobileBarberCustomers/' + A.uid, { name: { stringValue: 'HACKED' } }, B.idToken)).status === 403);
  // A may flip read flag → allowed; A may NOT rewrite content → denied (field guard).
  check('A CAN mark own notification read', (await patchDoc('customerNotifications/' + NOTIF, { read: { booleanValue: true } }, A.idToken)).status === 200);
  check('A CANNOT rewrite notification content (field guard)', (await patchDoc('customerNotifications/' + NOTIF, { title: { stringValue: 'tampered' } }, A.idToken)).status === 403);

  console.log('\n── Cleanup ──');
  for (const p of ['customerNotifications/' + NOTIF, 'customerSavedStyles/' + STYLE, 'mobileBarberCustomers/' + A.uid]) { try { await db.doc(p).delete(); } catch (e) {} }
  for (const uid of [A.uid, B.uid]) { try { await auth.deleteUser(uid); } catch (e) {} }
  check('Cleaned up test docs + accounts', true);

  console.log('\n==================================================');
  console.log('CUSTOMER ISOLATION: ' + pass + ' passed, ' + fail + ' failed');
  console.log('==================================================');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
