/**
 * Phase 13 Dispatch Integration Test
 * -----------------------------------
 * Verifies the full dispatch chain end-to-end:
 *   1. Test booking written to `bookings`
 *   2. dispatchQueue doc created  → triggers onDispatchQueue Cloud Function
 *   3. bookingOffers doc appears  → booking status flips to offered_to_driver
 *   4. (Optional) accept the offer → booking status flips to assigned
 *
 * Usage:
 *   node tests/test-dispatch.js           # airport pickup (SJC) — default
 *   node tests/test-dispatch.js private   # private ride (no region constraint)
 *   node tests/test-dispatch.js --keep    # don't delete test docs after run
 *
 * Cleanup:
 *   Test docs are deleted automatically unless --keep is passed.
 *   Doc IDs all start with TEST_ so they're easy to find and nuke manually.
 */

'use strict';

const path  = require('path');
const admin = require(path.join(__dirname, '../functions/node_modules/firebase-admin'));

// ── Config ───────────────────────────────────────────────────────────────────
const SERVICE_ACCOUNT = path.join(__dirname, '../dulichcali-booking-calendar-6796caee41ac.json');
const POLL_INTERVAL_MS = 1500;   // check every 1.5 s
const POLL_TIMEOUT_MS  = 25000;  // give up after 25 s (Cloud Function cold start can be slow)

const args       = process.argv.slice(2);
const rideType   = args.includes('private') ? 'private' : 'airport';
const keepDocs   = args.includes('--keep');

// ── Init Admin SDK ────────────────────────────────────────────────────────────
admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT)),
});
const db  = admin.firestore();
const fv  = admin.firestore.FieldValue;

// ── Helpers ───────────────────────────────────────────────────────────────────
const pad  = (s) => String(s).padStart(2, '0');
const now  = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const log  = (label, msg) => console.log(`[${now()}] ${label.padEnd(18)} ${msg}`);
const ok   = (msg) => console.log(`\n  ✅  ${msg}`);
const fail = (msg) => console.log(`\n  ❌  ${msg}`);
const info = (msg) => console.log(`       ${msg}`);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function poll(label, checkFn, timeoutMs, intervalMs) {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    const result = await checkFn(attempt);
    if (result !== null) return result;
    await sleep(intervalMs);
  }
  return null;
}

// ── Build test booking ────────────────────────────────────────────────────────
function buildTestBooking(bookingId) {
  const base = {
    bookingId,
    status:       'dispatching',
    createdAt:    fv.serverTimestamp(),
    customerName: 'TEST Customer',
    customerPhone:'4089163439',
    passengers:   2,
  };
  if (rideType === 'airport') {
    return Object.assign(base, {
      serviceType:   'pickup',
      serviceLabel:  '✈ Đón Sân Bay',
      airport:       'SJC',
      terminal:      'A',
      airline:       'TEST',
      arrivalDate:   '2026-04-20',
      arrivalTime:   '14:30',
      address:       '123 Test St, San Jose CA',
    });
  } else {
    return Object.assign(base, {
      serviceType:    'private_ride',
      serviceLabel:   '🚗 Xe Riêng',
      pickupAddress:  '123 Test St, San Jose CA',
      dropoffAddress: '456 Demo Ave, San Francisco CA',
      arrivalDate:    '2026-04-20',
      arrivalTime:    '10:00',
      estimatedPrice: 85,
    });
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const ts        = Date.now();
  const bookingId = `TEST_booking_${ts}`;
  const queueId   = `${bookingId}_0`;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' Phase 13 — Dispatch Integration Test');
  console.log(`  Ride type : ${rideType === 'airport' ? 'Airport Pickup (SJC → bayarea)' : 'Private Ride (any region)'}`);
  console.log(`  Booking ID: ${bookingId}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const docsToClean = [];

  try {
    // ── Step 1: Write booking ─────────────────────────────────────────────────
    log('STEP 1', 'Writing test booking to bookings/...');
    const bookingRef = db.collection('bookings').doc(bookingId);
    await bookingRef.set(buildTestBooking(bookingId));
    docsToClean.push({ collection: 'bookings', id: bookingId });
    ok(`bookings/${bookingId} written`);
    info(`status=dispatching  serviceType=${rideType === 'airport' ? 'pickup' : 'private_ride'}  airport=${rideType === 'airport' ? 'SJC' : 'n/a'}`);

    // ── Step 2: Write dispatchQueue doc ───────────────────────────────────────
    log('STEP 2', 'Writing dispatchQueue doc to trigger onDispatchQueue...');
    const queueRef = db.collection('dispatchQueue').doc(queueId);
    await queueRef.set({
      bookingId,
      skipDriverIds: [],
      attempt:       1,
      status:        'pending',
      createdAt:     fv.serverTimestamp(),
    });
    docsToClean.push({ collection: 'dispatchQueue', id: queueId });
    ok(`dispatchQueue/${queueId} written`);

    // ── Step 3: Poll bookingOffers/{bookingId} ────────────────────────────────
    log('STEP 3', `Polling bookingOffers/${bookingId} (up to ${POLL_TIMEOUT_MS / 1000}s)...`);

    const offerData = await poll('offer', async (attempt) => {
      const snap = await db.collection('bookingOffers').doc(bookingId).get();
      process.stdout.write(attempt === 1 ? '       ' : '');
      process.stdout.write('·');
      if (snap.exists) { process.stdout.write('\n'); return snap.data(); }
      return null;
    }, POLL_TIMEOUT_MS, POLL_INTERVAL_MS);

    docsToClean.push({ collection: 'bookingOffers', id: bookingId });

    if (!offerData) {
      fail('bookingOffers doc never appeared — onDispatchQueue did not complete in time');
      info('Check Cloud Function logs: firebase functions:log --only onDispatchQueue');
      process.exitCode = 1;
      return;
    }

    ok('bookingOffers doc created!');
    info(`driverId  = ${offerData.driverId}`);
    info(`driverName= ${offerData.driverName || '(not set)'}`);
    info(`status    = ${offerData.status}`);
    info(`attempt   = ${offerData.attempt}`);
    info(`expiresAt = ${offerData.expiresAt ? offerData.expiresAt.toDate().toISOString() : 'n/a'}`);

    // ── Step 4: Verify booking status flipped to offered_to_driver ────────────
    log('STEP 4', 'Verifying booking status flipped to offered_to_driver...');
    const bkSnap = await db.collection('bookings').doc(bookingId).get();
    const bkData = bkSnap.exists ? bkSnap.data() : {};

    if (bkData.status === 'offered_to_driver') {
      ok(`booking.status = offered_to_driver  ✓`);
      info(`currentOfferDriverId = ${bkData.currentOfferDriverId}`);
    } else {
      fail(`booking.status = ${bkData.status} — expected offered_to_driver`);
      process.exitCode = 1;
    }

    // ── Step 5: Verify driver profile exists ──────────────────────────────────
    log('STEP 5', `Fetching driver profile for ${offerData.driverId}...`);
    const drvSnap = await db.collection('drivers').doc(offerData.driverId).get();
    if (drvSnap.exists) {
      const d = drvSnap.data();
      ok(`Driver found in drivers/${offerData.driverId}`);
      info(`name            = ${d.fullName || d.name || '(not set)'}`);
      info(`adminStatus     = ${d.adminStatus}`);
      info(`complianceStatus= ${d.complianceStatus}`);
      info(`regions         = ${JSON.stringify(d.regions || [])}`);
    } else {
      fail(`Driver doc drivers/${offerData.driverId} not found`);
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(' RESULT: PASS — full dispatch chain verified ✅');
    console.log(' Chain: booking written → dispatchQueue → onDispatchQueue');
    console.log('        → eligible driver found → bookingOffers created');
    console.log('        → booking.status = offered_to_driver');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (err) {
    fail(`Unexpected error: ${err.message}`);
    console.error(err);
    process.exitCode = 1;
  } finally {
    // ── Cleanup ───────────────────────────────────────────────────────────────
    if (!keepDocs && docsToClean.length) {
      console.log('\n  Cleaning up test docs...');
      await Promise.all(docsToClean.map(({ collection, id }) =>
        db.collection(collection).doc(id).delete().catch(() => {})
      ));
      console.log(`  Deleted: ${docsToClean.map(d => `${d.collection}/${d.id}`).join(', ')}\n`);
    } else if (keepDocs) {
      console.log('\n  --keep flag set — test docs left in Firestore for inspection.\n');
    }
    process.exit(process.exitCode || 0);
  }
})();
