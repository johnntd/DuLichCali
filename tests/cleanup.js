'use strict';
/**
 * Cleanup script:
 * 1. Deletes stale driverUsers docs where uid === driverId (old wrong mapping)
 * 2. Deletes old PLAY_ test booking docs (bookings, dispatchQueue, bookingOffers)
 */
const path  = require('path');
const admin = require(path.join(__dirname, '../functions/node_modules/firebase-admin'));
admin.initializeApp({ credential: admin.credential.cert(require(path.join(__dirname, '../dulichcali-booking-calendar-6796caee41ac.json'))) });
const db = admin.firestore();

(async () => {
  // ── 1. Remove stale driverUsers docs (uid === driverId) ────────────────────
  console.log('\n── Stale driverUsers cleanup ──────────────────────────────');
  const duSnap = await db.collection('driverUsers').get();
  for (const d of duSnap.docs) {
    if (d.id === d.data().driverId) {
      await d.ref.delete();
      console.log(`  ✅ Deleted stale driverUsers/${d.id}  (uid === driverId)`);
    } else {
      console.log(`  ✔  Kept  driverUsers/${d.id}  → driverId=${d.data().driverId}`);
    }
  }

  // ── 2. Remove PLAY_ test docs ───────────────────────────────────────────────
  console.log('\n── PLAY_ test doc cleanup ─────────────────────────────────');
  let deleted = 0;

  const bSnap = await db.collection('bookings').get();
  for (const d of bSnap.docs) {
    if (d.id.startsWith('PLAY_')) {
      await d.ref.delete(); deleted++;
      console.log(`  ✅ Deleted booking/${d.id}`);
    }
  }

  const dqSnap = await db.collection('dispatchQueue').get();
  for (const d of dqSnap.docs) {
    const bid = d.data().bookingId || '';
    if (d.id.includes('PLAY_') || bid.startsWith('PLAY_')) {
      await d.ref.delete(); deleted++;
      console.log(`  ✅ Deleted dispatchQueue/${d.id}`);
    }
  }

  const boSnap = await db.collection('bookingOffers').get();
  for (const d of boSnap.docs) {
    const bid = d.data().bookingId || d.id;
    if (d.id.startsWith('PLAY_') || bid.startsWith('PLAY_')) {
      await d.ref.delete(); deleted++;
      console.log(`  ✅ Deleted bookingOffers/${d.id}`);
    }
  }

  console.log(`\n  Total test docs deleted: ${deleted}`);
  console.log('\nDone.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
