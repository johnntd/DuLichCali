#!/usr/bin/env node
/**
 * scripts/ai/backfill-owner-id.js
 *
 * One-off, idempotent backfill that stamps the canonical `ownerId` field onto
 * legacy bookings that predate the unified owner portal (Phase 1). The portal
 * queries bookings by ownerId; legacy docs created before the stamping change
 * have no ownerId and would be invisible to the owner dashboard until they are
 * backfilled.
 *
 * It NEVER runs automatically and is NOT wired into any deploy or dry-run.
 * Default mode is a DRY RUN (reports what it would change, writes nothing).
 * Pass --apply to actually write. Re-running is safe: docs that already carry a
 * non-empty ownerId are skipped.
 *
 * Owner resolution is delegated entirely to OwnerModel.resolveBookingOwner so
 * the script and the runtime stay in lockstep (single source of truth).
 *
 * Collections covered:
 *   mobileBarberBookings  → resolve by serviceType 'barber' + vendorId
 *   bookings              → resolve by the doc's own serviceType + region
 *   travel_bookings       → resolve by serviceType 'tour' + pickup region
 *
 * Prerequisites:
 *   firebase login   (or export GOOGLE_APPLICATION_CREDENTIALS=<service-acct.json>)
 *   npm install firebase-admin   (from DuLichCali/ root)
 *
 * Usage:
 *   node scripts/ai/backfill-owner-id.js            # dry run (default)
 *   node scripts/ai/backfill-owner-id.js --apply    # write changes
 */
'use strict';

const admin = require('firebase-admin');
const OwnerModel = require('../../owner-model.js');

const APPLY = process.argv.indexOf('--apply') !== -1;

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId:  'dulichcali-booking-calendar',
});
const db = admin.firestore();

function s(v) { return v == null ? '' : String(v); }

// Per-collection: derive the resolveBookingOwner() input from a raw doc.
function resolveArgsFor(collection, data) {
  if (collection === 'mobileBarberBookings') {
    return { serviceType: 'barber', vendorId: data.vendorId || data.providerId, region: data.region };
  }
  if (collection === 'travel_bookings') {
    return { serviceType: 'tour', region: data.pickup_region || data.region };
  }
  // bookings: trust the doc's own serviceType (pickup/dropoff/private_ride/tour/...)
  return { serviceType: data.serviceType, vendorId: data.vendorId, region: data.region };
}

async function backfillCollection(collection) {
  const snap = await db.collection(collection).get();
  let scanned = 0, already = 0, stamped = 0, unresolved = 0;
  const batchLimit = 400;
  let batch = db.batch();
  let pending = 0;

  for (const doc of snap.docs) {
    scanned++;
    const data = doc.data() || {};
    if (s(data.ownerId)) { already++; continue; }

    const ownerId = OwnerModel.resolveBookingOwner(resolveArgsFor(collection, data));
    if (!ownerId) {
      unresolved++;
      console.log('    ? ' + collection + '/' + doc.id + ' — could not resolve owner (serviceType=' + s(data.serviceType) + ', vendorId=' + s(data.vendorId) + ', region=' + s(data.region) + ')');
      continue;
    }

    stamped++;
    console.log('    + ' + collection + '/' + doc.id + ' → ownerId=' + ownerId);
    if (APPLY) {
      batch.set(doc.ref, { ownerId: ownerId }, { merge: true });
      pending++;
      if (pending >= batchLimit) { await batch.commit(); batch = db.batch(); pending = 0; }
    }
  }
  if (APPLY && pending > 0) await batch.commit();

  console.log('  ' + collection + ': scanned=' + scanned + ' alreadyOwned=' + already +
    ' stamped=' + stamped + ' unresolved=' + unresolved);
  return { collection, scanned, already, stamped, unresolved };
}

async function run() {
  console.log(APPLY ? '=== BACKFILL ownerId (APPLY — writing) ===' : '=== BACKFILL ownerId (DRY RUN — no writes; pass --apply to write) ===');
  const collections = ['mobileBarberBookings', 'bookings', 'travel_bookings'];
  const results = [];
  for (const c of collections) {
    console.log('Scanning ' + c + ' ...');
    results.push(await backfillCollection(c));
  }
  const totalStamped = results.reduce((a, r) => a + r.stamped, 0);
  const totalUnresolved = results.reduce((a, r) => a + r.unresolved, 0);
  console.log('---');
  console.log((APPLY ? 'Stamped ' : 'Would stamp ') + totalStamped + ' doc(s); ' + totalUnresolved + ' unresolved.');
  if (!APPLY && totalStamped > 0) console.log('Re-run with --apply to write these changes.');
  process.exit(0);
}

run().catch(function(err) { console.error(err); process.exit(1); });
