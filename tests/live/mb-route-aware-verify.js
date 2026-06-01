'use strict';
/**
 * LIVE verification of the route-aware booking engine against DEPLOYED functions:
 *   - validateAddressAndDistance: degrades to city/ZIP centroid fallback when no
 *     real Maps key is configured (addressValidationStatus 'city_zip_only',
 *     googleMapsUsed:false) and marks an empty address 'invalid' (tests 3, 13).
 *   - createMobileBarberBookingGuarded route gate: an unvalidated address and a
 *     beyond-radius distance are routed to vendor_review (test 4, server side).
 *
 *   node tests/live/mb-route-aware-verify.js
 */
const https = require('https');
const admin = require(require('path').join(__dirname, '../../functions/node_modules/firebase-admin'));
const PROJECT = 'dulichcali-booking-calendar';
const REGION = 'us-central1';
admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: PROJECT });
const db = admin.firestore();
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? '  PASS ' : '  FAIL ') + n + (d ? ' — ' + d : '')); };

function callable(name, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ data });
    const ORIGIN = 'https://www.dulichcali21.com';
    const opts = {
      method: 'POST', hostname: `${REGION}-${PROJECT}.cloudfunctions.net`, path: `/${name}`,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), Referer: ORIGIN, Origin: ORIGIN },
    };
    const r = https.request(opts, (res) => { let c = ''; res.on('data', (d) => c += d); res.on('end', () => { let j = null; try { j = JSON.parse(c); } catch (e) {} resolve({ status: res.statusCode, result: j && j.result }); }); });
    r.on('error', reject); r.write(body); r.end();
  });
}

(async () => {
  console.log('\n== ROUTE-AWARE BOOKING ENGINE VERIFY (live, deployed) ==\n');

  // 1) Maps proxy fallback (no real key → city/ZIP centroid).
  const v1 = await callable('validateAddressAndDistance', {
    serviceAddress: { address: '100 First St', city: 'San Jose', zip: '95113' },
    vendorOrigin: { city: 'Fremont', zip: '94538' },
  });
  const r1 = v1.result || {};
  check('validateAddressAndDistance responds ok', !!r1.ok, 'status=' + v1.status);
  check('Maps-unavailable → city_zip_only fallback (googleMapsUsed=false)', r1.addressValidationStatus === 'city_zip_only' && r1.googleMapsUsed === false, 'status=' + r1.addressValidationStatus + ' maps=' + r1.googleMapsUsed);
  check('Fallback estimates a distance from city centroids', typeof r1.distanceMiles === 'number' && r1.distanceMiles > 0, 'dist=' + r1.distanceMiles);

  // 2) Empty address → invalid (ask correction).
  const v2 = await callable('validateAddressAndDistance', { serviceAddress: { address: '', city: '', zip: '' }, vendorOrigin: {} });
  check('Empty address → addressValidationStatus invalid', (v2.result || {}).addressValidationStatus === 'invalid', 'status=' + (v2.result || {}).addressValidationStatus);

  // 3) Guard route gate — unvalidated address → vendor_review.
  const VENDOR = 'michael-nguyen-oc';
  const bid1 = 'mb-ra-unval-' + Date.now();
  const bid2 = 'mb-ra-far-' + (Date.now() + 1);
  function bookingPayload(id, extra) {
    return Object.assign({
      id, bookingId: id, vendorId: VENDOR, ownerId: VENDOR, serviceType: 'barber',
      customerName: 'Route Tester', customerPhone: '7145550199',
      serviceId: 'classic-haircut', serviceName: 'Classic Haircut',
      address: '1 Test Ave', city: 'Westminster', zip: '92683',
      requestedDate: '2026-09-15', startTime: '13:00', endTime: '14:15', totalPrice: 35,
      status: 'pending_barber_confirmation',
    }, extra);
  }
  try {
    const g1 = await callable('createMobileBarberBookingGuarded', { booking: bookingPayload(bid1, {}) });
    const b1 = (g1.result && g1.result.booking) || {};
    check('Unvalidated address → guard routes to vendor_review', g1.result && g1.result.ok && b1.status === 'vendor_review' && b1.reviewReason === 'address_unvalidated', 'status=' + b1.status + ' reason=' + b1.reviewReason);

    // Distinct customer + day so the duplicate/spam guard doesn't pre-empt the route gate.
    const g2 = await callable('createMobileBarberBookingGuarded', { booking: bookingPayload(bid2, { customerPhone: '7145550288', customerName: 'Far Tester', requestedDate: '2026-09-20', startTime: '15:00', endTime: '16:15', addressValidationStatus: 'precise', distanceMiles: 50 }) });
    const b2 = (g2.result && g2.result.booking) || {};
    check('Beyond-radius (50mi) → guard routes to vendor_review', g2.result && g2.result.ok && b2.status === 'vendor_review' && b2.reviewReason === 'beyond_service_radius', 'status=' + b2.status + ' reason=' + b2.reviewReason);
  } finally {
    await db.collection('mobileBarberBookings').doc(bid1).delete().catch(() => {});
    await db.collection('mobileBarberBookings').doc(bid2).delete().catch(() => {});
    console.log('  (cleaned guard test bookings)');
  }

  console.log(`\n  RESULT: ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
