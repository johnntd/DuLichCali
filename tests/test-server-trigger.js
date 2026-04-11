/**
 * Tests the NEW onRideBookingCreated server-side trigger path.
 * Only writes the booking doc — NO dispatchQueue write.
 * Verifies that the server trigger alone drives the full dispatch chain.
 *
 * This simulates old cached clients (status=awaiting_driver, no dispatchQueue write).
 * Usage: node tests/test-server-trigger.js
 */
'use strict';
const path  = require('path');
const admin = require(path.join(__dirname, '../functions/node_modules/firebase-admin'));
admin.initializeApp({ credential: admin.credential.cert(require(path.join(__dirname, '../dulichcali-booking-calendar-6796caee41ac.json'))) });
const db = admin.firestore();
const fv = admin.firestore.FieldValue;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
const now = () => new Date().toISOString().replace('T',' ').slice(0,19);
const log = (label, msg) => console.log(`[${now()}] ${label.padEnd(20)} ${msg}`);
const ok  = (msg) => console.log(`\n  ✅  ${msg}`);
const fail= (msg) => { console.log(`\n  ❌  ${msg}`); process.exitCode = 1; };

(async () => {
  const ts        = Date.now();
  const bookingId = `TEST_srv_${ts}`;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' Server-Trigger Test — onRideBookingCreated path');
  console.log(' Simulates: old client that writes booking but NOT dispatchQueue');
  console.log(` Booking ID: ${bookingId}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const toClean = [];

  try {
    // STEP 1: Write ONLY the booking (no dispatchQueue) — simulates old cached client
    log('STEP 1', 'Writing booking only (no dispatchQueue write)...');
    await db.collection('bookings').doc(bookingId).set({
      bookingId,
      status:       'awaiting_driver',  // old code status
      serviceType:  'pickup',
      airport:      'SJC',
      terminal:     'B',
      datetime:     '2026-04-20 09:00',
      customerName: 'TEST Server Trigger',
      customerPhone:'4089163439',
      passengers:   1,
      createdAt:    fv.serverTimestamp(),
    });
    toClean.push({ col: 'bookings', id: bookingId });
    ok(`bookings/${bookingId} written (status=awaiting_driver, NO dispatchQueue)`);

    // STEP 2: Wait — onRideBookingCreated should create the dispatchQueue doc
    log('STEP 2', 'Waiting for server trigger to create dispatchQueue doc...');
    let queueDoc = null;
    for (let i = 0; i < 20; i++) {
      await sleep(1500);
      process.stdout.write('·');
      const s = await db.collection('dispatchQueue').doc(bookingId + '_0').get();
      if (s.exists) { queueDoc = s.data(); process.stdout.write('\n'); break; }
    }
    toClean.push({ col: 'dispatchQueue', id: bookingId + '_0' });

    if (!queueDoc) {
      fail('onRideBookingCreated never created dispatchQueue doc');
      return;
    }
    ok(`dispatchQueue/${bookingId}_0 created by server trigger!`);
    console.log(`       source   = ${queueDoc.source}`);
    console.log(`       status   = ${queueDoc.status}`);

    // STEP 3: Poll for bookingOffers
    log('STEP 3', 'Polling bookingOffers (onDispatchQueue should fire now)...');
    let offer = null;
    for (let i = 0; i < 20; i++) {
      await sleep(1500);
      process.stdout.write('·');
      const s = await db.collection('bookingOffers').doc(bookingId).get();
      if (s.exists) { offer = s.data(); process.stdout.write('\n'); break; }
    }
    toClean.push({ col: 'bookingOffers', id: bookingId });

    if (!offer) {
      fail('bookingOffers doc never appeared — onDispatchQueue did not complete');
      return;
    }
    ok(`bookingOffers created!  driverId=${offer.driverId}  status=${offer.status}`);

    // STEP 4: Check booking status
    const bk = (await db.collection('bookings').doc(bookingId).get()).data();
    if (bk.status === 'offered_to_driver') {
      ok(`booking.status = offered_to_driver ✓`);
    } else {
      fail(`booking.status = ${bk.status} — expected offered_to_driver`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(' RESULT: PASS ✅');
    console.log(' Server trigger works for old clients that skip dispatchQueue write');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } finally {
    console.log('  Cleaning up...');
    await Promise.all(toClean.map(({ col, id }) => db.collection(col).doc(id).delete().catch(() => {})));
    console.log(`  Done.\n`);
    process.exit(process.exitCode || 0);
  }
})();
