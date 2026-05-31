'use strict';
/**
 * Live verification of the SCREENSHOT case: a booking created directly as
 * `vendor_review` that OVERLAPS an earlier confirmed booking must be auto-declined
 * by onMobileBarberBookingCreated (previously it was early-returned and lingered as
 * an actionable card). Admin SDK writes trigger the onDocumentCreated function.
 * Creates 2 docs, verifies, deletes them. Safe to run on production.
 *
 *   node tests/live/mb-vendor-review-conflict-verify.js
 */
const admin = require(require('path').join(__dirname, '../../functions/node_modules/firebase-admin'));
const PROJECT = 'dulichcali-booking-calendar';
const COLLECTION = 'mobileBarberBookings';
admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: PROJECT });
const db = admin.firestore();
const sleep = ms => new Promise(r => setTimeout(r, ms));

const A = 'SMOKE_VR_confirmed_A';
const B = 'SMOKE_VR_review_B';

function booking(id, startTime, endTime, status) {
  return {
    id, vendorId: 'michael-nguyen-oc', ownerId: 'michael-nguyen', serviceType: 'barber',
    assignedBarberId: 'michael-nguyen-oc', customerName: 'VR Conflict Test', customerPhone: '4085550199',
    serviceId: 'michael-nguyen-oc-classic-haircut', serviceName: 'Classic Haircut', servicePrice: 40,
    amountDue: 40, city: 'Westminster', zip: '92683', requestedDate: '2026-06-16',
    startTime, endTime, status, source: 'live_verify', notes: 'vendor_review conflict verify — safe to delete',
  };
}

(async () => {
  let pass = 0, fail = 0;
  const check = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? '  PASS ' : '  FAIL ') + n + (d ? ' — ' + d : '')); };
  // pre-clean
  for (const id of [A, B]) { try { await db.collection(COLLECTION).doc(id).delete(); } catch (e) {} }

  console.log('\n── Create earlier CONFIRMED booking A (10:00–10:45) ──');
  await db.collection(COLLECTION).doc(A).set(booking(A, '10:00', '10:45', 'confirmed'));
  await sleep(4000); // let A settle + its trigger run (no conflict yet)

  console.log('── Create later VENDOR_REVIEW booking B (10:15–11:00, overlaps A) ──');
  await db.collection(COLLECTION).doc(B).set(booking(B, '10:15', '11:00', 'vendor_review'));

  let declined = null, aStatus = null;
  for (let i = 0; i < 14; i++) {
    await sleep(2500);
    const [da, dbDoc] = await Promise.all([
      db.collection(COLLECTION).doc(A).get(),
      db.collection(COLLECTION).doc(B).get(),
    ]);
    aStatus = da.exists ? da.data().status : null;
    const s = dbDoc.exists ? dbDoc.data().status : null;
    if (s === 'declined') { declined = dbDoc.data(); break; }
  }

  console.log('\n── Results ──');
  check('Earlier CONFIRMED booking A still stands (not declined)', aStatus === 'confirmed', 'status=' + aStatus);
  check('Later VENDOR_REVIEW overlap B was AUTO-DECLINED (screenshot bug fixed)', !!declined,
    declined ? 'status=declined' : 'still ' + (declined === null ? 'not declined' : '') + ' after ~35s');
  check('decline reason is time_conflict', !!declined && declined.declineReason === 'time_conflict',
    declined ? (declined.declineReason || 'n/a') : 'n/a');
  check('records the booking it conflicts with', !!declined && !!declined.conflictBookingId,
    declined ? ('conflictBookingId=' + (declined.conflictBookingId || '')) : 'n/a');

  console.log('\n── Cleanup ──');
  let deleted = 0;
  for (const id of [A, B]) { try { await db.collection(COLLECTION).doc(id).delete(); deleted++; } catch (e) {} }
  check('Both verify docs deleted (no residue)', deleted === 2, 'deleted=' + deleted);

  console.log('\n==================================================');
  console.log('VENDOR_REVIEW CONFLICT VERIFY: ' + pass + ' passed, ' + fail + ' failed');
  console.log('==================================================');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
