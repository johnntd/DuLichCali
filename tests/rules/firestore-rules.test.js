'use strict';
/*
 * Firestore SECURITY RULES unit tests (emulator-backed).
 *
 * Runs against the Firestore emulator with the real firestore.rules loaded, using
 * @firebase/rules-unit-testing. Run via:
 *
 *   npm run test:rules
 *   (= bash scripts/ai/rules_test.sh = firebase emulators:exec --only firestore "node …")
 *
 * Focus: the Mobile Barber customer-profile-memory access model, especially the
 * "vendor can read a customer profile ONLY for an assigned booking" rule that is
 * gated by an Admin-written mobileBarberCustomers/{id}/vendorAccess/{vendorId} marker.
 */
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } = require('firebase/firestore');

const PROJECT = process.env.GCLOUD_PROJECT || 'demo-dulichcali';
const RULES = fs.readFileSync(path.join(__dirname, '../../firestore.rules'), 'utf8');

let pass = 0, fail = 0;
function rec(name, ok, detail) { ok ? pass++ : fail++; console.log((ok ? '  PASS ' : '  FAIL ') + name + (detail ? ' — ' + detail : '')); }
async function allowed(name, p) { try { await assertSucceeds(p); rec(name, true); } catch (e) { rec(name, false, 'expected ALLOW but got: ' + (e && e.message)); } }
async function denied(name, p) { try { await assertFails(p); rec(name, true); } catch (e) { rec(name, false, 'expected DENY but it was allowed: ' + (e && e.message)); } }

(async () => {
  console.log('\n== FIRESTORE RULES UNIT TESTS (emulator) ==\n');
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: RULES, host: '127.0.0.1', port: 8080 },
  });

  // ── Seed with rules disabled (simulates Admin SDK / trigger writes) ──
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const adb = ctx.firestore();
    await setDoc(doc(adb, 'vendorUsers/vendorX-user'), { vendorId: 'vendor-x' });
    await setDoc(doc(adb, 'vendorUsers/vendorY-user'), { vendorId: 'vendor-y' });
    // cust-1: assigned to vendor-x AND has the vendorAccess marker.
    await setDoc(doc(adb, 'mobileBarberCustomers/cust-1'), { customerId: 'cust-1', customerUid: 'cust-1', vendorId: 'vendor-x', name: 'Alice', normalizedPhone: '4085550001' });
    await setDoc(doc(adb, 'mobileBarberCustomers/cust-1/vendorAccess/vendor-x'), { vendorId: 'vendor-x' });
    // cust-2: profile stores vendor-x but NO vendorAccess marker (no assigned booking).
    await setDoc(doc(adb, 'mobileBarberCustomers/cust-2'), { customerId: 'cust-2', customerUid: 'cust-2', vendorId: 'vendor-x', name: 'Bob', normalizedPhone: '4085550002' });
    await setDoc(doc(adb, 'customerNotifications/n1'), { customerId: 'cust-1', title: 'x', body: 'y', read: false });

    await setDoc(doc(adb, 'vendorUsers/michael-uid'), { vendorId: 'michael-nguyen-oc' });
    await setDoc(doc(adb, 'driverUsers/driverA'), { driverId: 'driverA' });
    await setDoc(doc(adb, 'driverUsers/driverB'), { driverId: 'driverB' });
    await setDoc(doc(adb, 'bookings/rideA'), { driver: { driverId: 'driverA' }, ownerId: 'michael-nguyen', status: 'assigned', paymentStatus: 'unpaid' });
    await setDoc(doc(adb, 'bookings/rideB'), { driver: { driverId: 'driverB' }, ownerId: 'michael-nguyen', status: 'assigned' });
    await setDoc(doc(adb, 'travel_bookings/tourA'), { ownerId: 'michael-nguyen', status: 'confirmed' });
    await setDoc(doc(adb, 'travelAssignments/taA'), { travel_driver_id: 'driverA' });
    await setDoc(doc(adb, 'travelAssignments/taB'), { travel_driver_id: 'driverB' });
    // Driver profile doc — for admin-enable + driver-self-write tests.
    await setDoc(doc(adb, 'drivers/driverA'), { fullName: 'Driver A', phone: '4080000001', adminStatus: 'active', complianceStatus: 'approved', active: false, rideServiceEnabled: false, regions: ['bayarea'] });
  });

  const cust1 = testEnv.authenticatedContext('cust-1').firestore();
  const cust2 = testEnv.authenticatedContext('cust-2').firestore();
  const vendorX = testEnv.authenticatedContext('vendorX-user').firestore();
  const vendorY = testEnv.authenticatedContext('vendorY-user').firestore();
  const nonAnonToken = { firebase: { sign_in_provider: 'password' } };
  const anonToken = { firebase: { sign_in_provider: 'anonymous' } };
  const driverA = testEnv.authenticatedContext('driverA', nonAnonToken).firestore();
  const driverB = testEnv.authenticatedContext('driverB', nonAnonToken).firestore();
  const michael = testEnv.authenticatedContext('michael-uid', nonAnonToken).firestore();
  const anon = testEnv.authenticatedContext('anon-customer', anonToken).firestore();
  const admin = testEnv.authenticatedContext('admin-uid', { email: 'johnntd@gmail.com', firebase: { sign_in_provider: 'password' } }).firestore();
  // Owner operator account (iCloud) — must be in the isAdmin() allowlist alongside the gmail account.
  const adminIcloud = testEnv.authenticatedContext('admin-icloud-uid', { email: 'johnntd21@icloud.com', firebase: { sign_in_provider: 'password' } }).firestore();

  // ── Customer owns their profile ──
  await allowed('customer reads OWN profile', getDoc(doc(cust1, 'mobileBarberCustomers/cust-1')));
  await denied('customer CANNOT read another customer profile', getDoc(doc(cust1, 'mobileBarberCustomers/cust-2')));
  await allowed('customer can UPDATE own profile', updateDoc(doc(cust1, 'mobileBarberCustomers/cust-1'), { preferredBarber: 'Tim' }));

  // ── Vendor read scoped to assigned bookings (the new vendorAccess gate) ──
  await allowed('vendor reads ASSIGNED customer (vendorAccess marker present)', getDoc(doc(vendorX, 'mobileBarberCustomers/cust-1')));
  await denied('vendor CANNOT read customer with NO vendorAccess marker', getDoc(doc(vendorX, 'mobileBarberCustomers/cust-2')));
  await denied('NON-assigned vendor (vendor-y) CANNOT read the profile', getDoc(doc(vendorY, 'mobileBarberCustomers/cust-1')));
  await denied('vendor CANNOT modify the customer-owned profile', updateDoc(doc(vendorX, 'mobileBarberCustomers/cust-1'), { preferredBarber: 'Hacked' }));
  await denied('vendorAccess marker is NOT client-readable', getDoc(doc(vendorX, 'mobileBarberCustomers/cust-1/vendorAccess/vendor-x')));

  // ── Customer notification isolation (broader customer-data isolation) ──
  await allowed('customer reads OWN notification', getDoc(doc(cust1, 'customerNotifications/n1')));
  await denied('customer CANNOT read another customer notification', getDoc(doc(cust2, 'customerNotifications/n1')));
  await allowed('customer can flip read flag on own notification', updateDoc(doc(cust1, 'customerNotifications/n1'), { read: true }));
  await denied('customer CANNOT rewrite notification content', updateDoc(doc(cust1, 'customerNotifications/n1'), { title: 'tampered' }));

  // ── Driver isolation, owner portal preservation, customer booking/tracking ──
  await allowed(
    'driverA lists ONLY assigned rides',
    getDocs(query(collection(driverA, 'bookings'), where('driver.driverId', '==', 'driverA')))
  );
  await denied('driverA CANNOT list all rides', getDocs(collection(driverA, 'bookings')));
  await denied(
    'driverA CANNOT list driverB rides',
    getDocs(query(collection(driverA, 'bookings'), where('driver.driverId', '==', 'driverB')))
  );

  await allowed(
    'driverA can update pinned status fields on own ride',
    updateDoc(doc(driverA, 'bookings/rideA'), { status: 'on_the_way', statusUpdatedAt: '2026-06-06T12:00:00.000Z' })
  );
  await denied('driverA CANNOT update paymentStatus', updateDoc(doc(driverA, 'bookings/rideA'), { paymentStatus: 'paid' }));
  await denied('driverA CANNOT reassign driver field', updateDoc(doc(driverA, 'bookings/rideA'), { 'driver.driverId': 'x' }));
  await denied('driverA CANNOT rewrite ownerId', updateDoc(doc(driverA, 'bookings/rideA'), { ownerId: 'x' }));
  await denied('driverA CANNOT update driverB ride', updateDoc(doc(driverA, 'bookings/rideB'), { status: 'on_the_way' }));

  await allowed(
    'Michael owner portal lists own ride bookings',
    getDocs(query(collection(michael, 'bookings'), where('ownerId', '==', 'michael-nguyen')))
  );
  await allowed(
    'Michael owner portal lists own travel bookings',
    getDocs(query(collection(michael, 'travel_bookings'), where('ownerId', '==', 'michael-nguyen')))
  );
  await allowed('Michael legacy travel bookings compat scan still works', getDocs(collection(michael, 'travel_bookings')));

  await allowed(
    'anonymous customer can create booking',
    setDoc(doc(anon, 'bookings/new1'), { customerName: 'Anon', status: 'pending', pickup: 'SNA', dropoff: 'Westminster' })
  );
  await allowed('anonymous customer can track booking by id', getDoc(doc(anon, 'bookings/rideA')));
  await denied(
    'anonymous customer CANNOT list bookings',
    getDocs(query(collection(anon, 'bookings'), where('ownerId', '==', 'michael-nguyen')))
  );

  await allowed('driverA reads own travel assignment', getDoc(doc(driverA, 'travelAssignments/taA')));
  await denied('driverA CANNOT read driverB travel assignment', getDoc(doc(driverA, 'travelAssignments/taB')));
  await allowed('Michael reads travel assignment', getDoc(doc(michael, 'travelAssignments/taA')));

  await allowed(
    'driverA can write own push subscription',
    setDoc(doc(driverA, 'drivers/driverA/pushSubscriptions/s1'), { endpoint: 'https://push.example/a', createdAt: '2026-06-06T12:00:00.000Z' })
  );
  await denied(
    'driverA CANNOT self-enable (write active on own driver doc)',
    updateDoc(doc(driverA, 'drivers/driverA'), { active: true })
  );
  await denied(
    'driverA CANNOT self-enable rideServiceEnabled',
    updateDoc(doc(driverA, 'drivers/driverA'), { rideServiceEnabled: true })
  );
  await allowed(
    'driverA CAN still edit allowed profile fields (phone)',
    updateDoc(doc(driverA, 'drivers/driverA'), { phone: '4080000099' })
  );
  await allowed(
    'admin CAN enable a driver (active + rideServiceEnabled)',
    updateDoc(doc(admin, 'drivers/driverA'), { active: true, rideServiceEnabled: true })
  );
  await allowed(
    'iCloud owner (admin allowlist) CAN enable a driver (active + rideServiceEnabled)',
    updateDoc(doc(adminIcloud, 'drivers/driverA'), { active: false, rideServiceEnabled: false })
  );

  await denied(
    'driverA CANNOT write driverB push subscription',
    setDoc(doc(driverA, 'drivers/driverB/pushSubscriptions/s1'), { endpoint: 'https://push.example/b', createdAt: '2026-06-06T12:00:00.000Z' })
  );

  await testEnv.cleanup();
  console.log(`\n  RESULT: ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('rules test harness error:', e); process.exit(1); });
