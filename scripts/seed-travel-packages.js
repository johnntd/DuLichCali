#!/usr/bin/env node
/**
 * scripts/seed-travel-packages.js
 * Run ONCE: node scripts/seed-travel-packages.js
 * Writes DLC_TRAVEL_PACKAGES to Firestore travel_packages collection.
 * Idempotent — safe to re-run (uses doc.set which overwrites).
 *
 * Prerequisites:
 *   firebase login  (or set GOOGLE_APPLICATION_CREDENTIALS)
 *   npm install firebase-admin  (from DuLichCali/ root if not already installed)
 */
'use strict';

const admin = require('firebase-admin');
const { DLC_TRAVEL_PACKAGES } = require('../travel-packages.js');

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId:  'dulichcali-booking-calendar',
});
const db = admin.firestore();

async function seed() {
  console.log('Seeding ' + DLC_TRAVEL_PACKAGES.length + ' travel packages...');
  for (const pkg of DLC_TRAVEL_PACKAGES) {
    await db.collection('travel_packages').doc(pkg.id).set({
      ...pkg,
      seededAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('  ✓ ' + pkg.id);
  }
  console.log('Done. Firestore travel_packages updated.');
  process.exit(0);
}

seed().catch(function(err) { console.error(err); process.exit(1); });
