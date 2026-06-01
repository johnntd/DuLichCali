'use strict';
/**
 * LIVE verification of customer profile memory against the DEPLOYED
 * onMobileBarberCustomerBookingStatus trigger (mbUpsertCustomerProfileFromBooking).
 *
 * Proves, for an ANONYMOUS (phone-keyed) customer:
 *   - a booking create builds mobileBarberCustomers/phone_<n> with name/address/
 *     lastService/bookingHistory + TEXT-only style memory (NO AI image persisted)
 *   - a vendorAccess/<vendorId> marker is written (for the assigned-booking read rule)
 *   - a later booking with a NEW address updates the profile (merge), and a
 *     customer-set preferredLanguage is NOT overwritten by a later booking
 *
 *   node tests/live/mb-customer-profile-memory-verify.js
 */
const admin = require(require('path').join(__dirname, '../../functions/node_modules/firebase-admin'));
const PROJECT = 'dulichcali-booking-calendar';
admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: PROJECT });
const db = admin.firestore();
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? '  PASS ' : '  FAIL ') + n + (d ? ' — ' + d : '')); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const PHONE = '4085550143';
const NORM = '4085550143';
const PROFILE_ID = 'phone_' + NORM;
const VENDOR = 'michael-nguyen-oc';
const bid1 = 'mb-pm-' + Date.now();
const bid2 = 'mb-pm-' + (Date.now() + 1);

async function waitForProfile(predicate, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const s = await db.collection('mobileBarberCustomers').doc(PROFILE_ID).get();
    if (s.exists && predicate(s.data() || {})) return s.data();
    await sleep(1500);
  }
  const s = await db.collection('mobileBarberCustomers').doc(PROFILE_ID).get();
  return s.exists ? s.data() : null;
}

(async () => {
  console.log('\n== CUSTOMER PROFILE MEMORY VERIFY (live, deployed trigger) ==\n');
  try {
    // 1) Anonymous booking create with a style + a (fake) AI image URL we must NOT persist.
    await db.collection('mobileBarberBookings').doc(bid1).set({
      customerPhone: PHONE, customerName: 'Memory Tester',
      address: '100 First St', city: 'San Jose', zip: '95113',
      serviceId: 'classic-haircut', serviceName: 'Classic Haircut',
      vendorId: VENDOR, ownerId: VENDOR, status: 'pending_barber_confirmation',
      requestedDate: '2026-07-02', startTime: '10:00', totalPrice: 35,
      paymentMethod: 'zelle', confirmationPreference: 'sms',
      selectedAiStyleId: 'fade-01', selectedAiStyleName: 'Mid Fade',
      selectedAiStyleDescription: 'Tapered mid fade', selectedColorRecommendation: 'natural black',
      selectedAiStyleImage: 'https://example.com/SHOULD_NOT_BE_STORED.png',
    }, { merge: true });

    const p1 = await waitForProfile(d => !!d.lastServiceName, 30000);
    check('Profile created for anonymous customer (phone-keyed)', !!p1, p1 ? PROFILE_ID : 'missing');
    check('Profile stored name + last service + vendor', !!p1 && p1.name === 'Memory Tester' && p1.lastServiceName === 'Classic Haircut' && p1.vendorId === VENDOR);
    check('Profile stored address/city/zip', !!p1 && p1.address === '100 First St' && p1.city === 'San Jose' && p1.zip === '95113');
    check('Profile stored payment preference', !!p1 && (p1.paymentMethod === 'zelle' || p1.paymentPreference === 'zelle'));
    check('Profile has a bookingHistory entry', !!p1 && Array.isArray(p1.bookingHistory) && p1.bookingHistory.some(h => h.bookingId === bid1));
    check('Style memory persisted as TEXT (styleId + color)', !!p1 && p1.haircutPreferences && p1.haircutPreferences.styleId === 'fade-01' && p1.haircutPreferences.color === 'natural black');
    const blob = JSON.stringify(p1 || {});
    check('NO AI hairstyle image persisted to the profile', blob.indexOf('SHOULD_NOT_BE_STORED') < 0 && blob.indexOf('selectedAiStyleImage') < 0);

    // vendorAccess marker for the assigned-booking read rule.
    const va = await db.collection('mobileBarberCustomers').doc(PROFILE_ID).collection('vendorAccess').doc(VENDOR).get();
    check('vendorAccess marker written for the assigned vendor', va.exists, va.exists ? '' : 'missing');

    // Simulate a customer-set language, then a NEW booking with a NEW address.
    await db.collection('mobileBarberCustomers').doc(PROFILE_ID).set({ preferredLanguage: 'vi' }, { merge: true });
    await db.collection('mobileBarberBookings').doc(bid2).set({
      customerPhone: PHONE, customerName: 'Memory Tester',
      address: '999 Updated Ave', city: 'San Jose', zip: '95112',
      serviceId: 'classic-haircut', serviceName: 'Classic Haircut',
      vendorId: VENDOR, ownerId: VENDOR, status: 'pending_barber_confirmation',
      requestedDate: '2026-07-09', startTime: '11:00', totalPrice: 35,
      preferredLanguage: 'es', // a later booking must NOT overwrite the customer-set 'vi'
    }, { merge: true });

    const p2 = await waitForProfile(d => d.address === '999 Updated Ave', 30000);
    check('Updated address saved back to profile (merge)', !!p2 && p2.address === '999 Updated Ave' && p2.zip === '95112');
    check('Customer-set preferredLanguage NOT overwritten by a later booking', !!p2 && p2.preferredLanguage === 'vi', p2 ? 'lang=' + p2.preferredLanguage : 'n/a');
    check('bookingHistory accumulates both bookings', !!p2 && Array.isArray(p2.bookingHistory) && p2.bookingHistory.length >= 2);
  } finally {
    await db.collection('mobileBarberBookings').doc(bid1).delete().catch(() => {});
    await db.collection('mobileBarberBookings').doc(bid2).delete().catch(() => {});
    await db.collection('mobileBarberCustomers').doc(PROFILE_ID).collection('vendorAccess').doc(VENDOR).delete().catch(() => {});
    await db.collection('mobileBarberCustomers').doc(PROFILE_ID).delete().catch(() => {});
    console.log('  (cleaned bookings + profile + vendorAccess)');
  }
  console.log(`\n  RESULT: ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
