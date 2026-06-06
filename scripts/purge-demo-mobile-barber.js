'use strict';
/**
 * ONE-TIME purge: remove the demo mobile-barber vendor and ALL of its child
 * documents from the live Firestore database `dulichcali-booking-calendar`.
 *
 * "demo" is not a valid concept in this system. The demo vendor
 * (`oc-mobile-barber-demo`) and any docs referencing it are removed so they
 * cannot pollute routing, scheduling, or dashboard vendor defaults.
 *
 * Scans every mobile-barber collection for docs that EITHER:
 *   - have id === 'oc-mobile-barber-demo', OR
 *   - reference the demo vendor via vendorId / assignedBarberId, OR
 *   - have an id beginning with 'demo-' (demo-weekly-default, demo-review-*, etc.)
 *
 * Usage:
 *   node scripts/purge-demo-mobile-barber.js          # dry run — report only
 *   node scripts/purge-demo-mobile-barber.js --delete # actually delete
 */
const path  = require('path');
const admin = require(path.join(__dirname, '../functions/node_modules/firebase-admin'));
// The repo service-account key (dulichcali-booking-calendar-6796caee41ac.json) is
// disabled/revoked (ACCOUNT_STATE_INVALID). Use Application Default Credentials
// from `gcloud auth application-default login` instead.
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'dulichcali-booking-calendar'
});
const db = admin.firestore();

const DEMO_VENDOR_ID = 'oc-mobile-barber-demo';
const COLLECTIONS = [
  'mobileBarberVendors',
  'mobileBarberServices',
  'mobileBarberServiceImages',
  'mobileBarberAvailability',
  'mobileBarberBookings',
  'mobileBarberCustomers',
  'mobileBarberAgentSessions',
  'mobileBarberPortfolioImages',
  'mobileBarberReviews'
];

const DO_DELETE = process.argv.includes('--delete');

function isDemoDoc(coll, id, data) {
  if (id === DEMO_VENDOR_ID) return true;
  if (id && id.startsWith('demo-')) return true;
  if (data && (data.vendorId === DEMO_VENDOR_ID || data.assignedBarberId === DEMO_VENDOR_ID)) return true;
  // customers may hold a per-vendor map of barber preferences
  if (data && data.vendorId === undefined && data.barberId === DEMO_VENDOR_ID) return true;
  return false;
}

(async () => {
  console.log(`\n${DO_DELETE ? '🔴 DELETE MODE' : '🔍 DRY RUN (no deletes)'} — demo vendor "${DEMO_VENDOR_ID}"\n`);
  let totalFound = 0;
  let totalDeleted = 0;

  for (const coll of COLLECTIONS) {
    const snap = await db.collection(coll).get();
    const hits = snap.docs.filter(d => isDemoDoc(coll, d.id, d.data()));
    if (hits.length === 0) {
      console.log(`  ✔  ${coll}: clean (0 demo docs of ${snap.size})`);
      continue;
    }
    console.log(`  ⚠  ${coll}: ${hits.length} demo doc(s) found`);
    for (const d of hits) {
      totalFound++;
      const dt = d.data() || {};
      const label = dt.name || dt.serviceName || dt.title || dt.customerName || dt.reviewerName || '';
      console.log(`       - ${coll}/${d.id}${label ? '  («' + label + '»)' : ''}`);
      if (DO_DELETE) {
        await d.ref.delete();
        totalDeleted++;
        console.log(`         ✅ deleted`);
      }
    }
  }

  console.log(`\n  Demo docs found:   ${totalFound}`);
  console.log(`  Demo docs deleted: ${totalDeleted}${DO_DELETE ? '' : '  (dry run — re-run with --delete)'}`);
  console.log('\nDone.\n');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
