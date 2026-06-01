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
const { doc, getDoc, setDoc, updateDoc } = require('firebase/firestore');

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
  });

  const cust1 = testEnv.authenticatedContext('cust-1').firestore();
  const cust2 = testEnv.authenticatedContext('cust-2').firestore();
  const vendorX = testEnv.authenticatedContext('vendorX-user').firestore();
  const vendorY = testEnv.authenticatedContext('vendorY-user').firestore();

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

  await testEnv.cleanup();
  console.log(`\n  RESULT: ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('rules test harness error:', e); process.exit(1); });
