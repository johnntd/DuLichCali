/**
 * Quick Firestore state check — reads recent bookings + dispatchQueue docs
 * to see what's actually landing after a real booking attempt.
 *
 * Usage: node tests/check-firestore.js
 */
'use strict';
const path  = require('path');
const admin = require(path.join(__dirname, '../functions/node_modules/firebase-admin'));
admin.initializeApp({ credential: admin.credential.cert(require(path.join(__dirname, '../dulichcali-booking-calendar-6796caee41ac.json'))) });
const db = admin.firestore();

(async () => {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000); // last 30 min

  // ── Recent bookings ──────────────────────────────────────────────────────────
  console.log('\n━━ Recent bookings (last 30 min) ━━━━━━━━━━━━━━━━━━');
  const bkSnap = await db.collection('bookings').orderBy('createdAt', 'desc').limit(10).get();
  bkSnap.docs.forEach(d => {
    const b = d.data();
    const ts = b.createdAt ? b.createdAt.toDate().toISOString().replace('T',' ').slice(0,19) : '?';
    if (d.id.startsWith('TEST_')) return; // skip test docs
    console.log(`  ${ts}  id=${d.id.slice(0,20)}  status=${b.status}  type=${b.serviceType}  airport=${b.airport||'—'}`);
  });

  // ── Recent dispatchQueue docs ────────────────────────────────────────────────
  console.log('\n━━ Recent dispatchQueue docs (last 30 min) ━━━━━━━━━');
  const dqSnap = await db.collection('dispatchQueue').orderBy('createdAt', 'desc').limit(10).get();
  if (dqSnap.empty) {
    console.log('  (empty — no dispatchQueue docs exist at all)');
  } else {
    dqSnap.docs.forEach(d => {
      const q = d.data();
      const ts = q.createdAt ? q.createdAt.toDate().toISOString().replace('T',' ').slice(0,19) : '?';
      if (d.id.startsWith('TEST_')) return;
      console.log(`  ${ts}  id=${d.id.slice(0,30)}  status=${q.status}  bookingId=${(q.bookingId||'').slice(0,20)}`);
    });
  }

  // ── Recent bookingOffers ─────────────────────────────────────────────────────
  console.log('\n━━ Recent bookingOffers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const ofSnap = await db.collection('bookingOffers').orderBy('createdAt', 'desc').limit(5).get();
  if (ofSnap.empty) {
    console.log('  (empty)');
  } else {
    ofSnap.docs.forEach(d => {
      const o = d.data();
      const ts = o.createdAt ? o.createdAt.toDate().toISOString().replace('T',' ').slice(0,19) : '?';
      console.log(`  ${ts}  id=${d.id.slice(0,20)}  driver=${o.driverId||'?'}  status=${o.status}`);
    });
  }

  console.log('');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
