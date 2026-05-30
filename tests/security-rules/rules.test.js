'use strict';
/**
 * Firestore security-rules tests (Firebase emulator).
 * Run from project root:
 *   firebase emulators:exec --only firestore "node tests/security-rules/rules.test.js"
 *
 * Verifies the pre-production audit fixes against the LIVE rule engine.
 */
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

const RULES = fs.readFileSync(path.join(__dirname, '../../firestore.rules'), 'utf8');
const PROJECT = 'demo-dulichcali-rules';

let pass = 0, fail = 0;
async function check(name, promise) {
  try { await promise; pass++; console.log('  PASS', name); }
  catch (e) { fail++; console.log('  FAIL', name, '—', (e && e.message || e).split('\n')[0]); }
}

(async () => {
  const env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: RULES, host: '127.0.0.1', port: 8080 }
  });

  const unauth = env.unauthenticatedContext().firestore();
  const anon = env.authenticatedContext('anonA', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  const anonB = env.authenticatedContext('anonB', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  const emailUser = env.authenticatedContext('evilEmailUser', { email: 'evil@x.com', firebase: { sign_in_provider: 'password' } }).firestore();
  const admin = env.authenticatedContext('adminUser', { email: 'johnntd@gmail.com', firebase: { sign_in_provider: 'password' } }).firestore();
  const vendorMember = env.authenticatedContext('michaelUid', { email: 'm@x.com', firebase: { sign_in_provider: 'password' } }).firestore();
  const driver = env.authenticatedContext('driver1', { email: 'd1@x.com', firebase: { sign_in_provider: 'password' } }).firestore();

  // Seed fixtures with rules disabled.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc('vendorUsers/michaelUid').set({ vendorId: 'michael-nguyen-oc', email: 'm@x.com' });
    await db.doc('mobileBarberVendors/michael-nguyen-oc').set({ active: true, ownerId: 'michael-nguyen' });
    await db.doc('mobileBarberBookings/bk1').set({
      vendorId: 'michael-nguyen-oc', customerUid: 'anonA', customerName: 'A', customerPhone: '1',
      serviceId: 's', serviceName: 'S', address: 'x', city: 'c', zip: 'z',
      requestedDate: '2026-06-01', startTime: '10:00', endTime: '10:40',
      status: 'pending_barber_confirmation', source: 'customer_form',
      servicePrice: 40, amountDue: 40, paymentStatus: 'unpaid'
    });
    await db.doc('bookings/ride1').set({ customerName: 'C', customerPhone: '999', ownerId: 'o', datetime: '2026-06-01T10:00' });
    await db.doc('vendors/michael-nguyen-oc/menuItems/item1').set({ name: 'cut' });
    await db.doc('auditLogs/log1').set({ vendorId: 'michael-nguyen-oc', action: 'update', changedFields: ['status'], at: new Date().toISOString() });
    await db.doc('drivers/driver1').set({ name: 'Driver One', complianceStatus: 'pending_documents', adminStatus: 'pending', licExpiry: '2027-01-01' });
    await db.doc('driver_compliance/driver1').set({ overallStatus: 'approved' });
  });

  const validBooking = {
    vendorId: 'michael-nguyen-oc', customerName: 'New', customerPhone: '2', serviceId: 's', serviceName: 'S',
    address: 'x', city: 'c', zip: 'z', requestedDate: '2026-06-02', startTime: '11:00', endTime: '11:40',
    status: 'pending_barber_confirmation', source: 'customer_form', servicePrice: 30, amountDue: 30, discountPercent: 10
  };

  console.log('\n── bookings (airport/ride) ──');
  await check('UNAUTHENTICATED cannot read /bookings (PII)', assertFails(unauth.doc('bookings/ride1').get()));
  await check('UNAUTHENTICATED cannot write /bookings', assertFails(unauth.doc('bookings/ride1').update({ status: 'paid' })));
  await check('anon CAN get its booking by id (tracking link)', assertSucceeds(anon.doc('bookings/ride1').get()));
  await check('anon CANNOT list/enumerate all bookings', assertFails(anon.collection('bookings').get()));
  await check('staff (non-anon) CAN list bookings', assertSucceeds(emailUser.collection('bookings').get()));
  await check('admin CAN list bookings', assertSucceeds(admin.collection('bookings').get()));

  console.log('\n── vendorUsers self-map (vendor takeover) ──');
  await check('ANONYMOUS cannot create a vendorUsers mapping', assertFails(anon.doc('vendorUsers/anonA').set({ vendorId: 'michael-nguyen-oc' })));
  await check('non-anon NON-member CANNOT self-map to a vendor (CRITICAL fix)', assertFails(emailUser.doc('vendorUsers/evilEmailUser').set({ vendorId: 'michael-nguyen-oc' })));
  await check('non-anon user CANNOT write ANOTHER uid mapping (hijack)', assertFails(emailUser.doc('vendorUsers/michaelUid').set({ vendorId: 'evil' })));
  await check('existing vendor MEMBER can add staff for their OWN vendor', assertSucceeds(vendorMember.doc('vendorUsers/newStaffUid').set({ vendorId: 'michael-nguyen-oc', email: 's@x.com' })));
  await check('vendor member CANNOT add a mapping for a DIFFERENT vendor', assertFails(vendorMember.doc('vendorUsers/x2').set({ vendorId: 'tim-nguyen-bay' })));
  await check('admin CAN write any vendorUsers mapping', assertSucceeds(admin.doc('vendorUsers/someVendorUid').set({ vendorId: 'michael-nguyen-oc' })));

  console.log('\n── mobileBarberBookings field-level update ──');
  await check('customer (owner) CANNOT set paymentStatus=paid', assertFails(anon.doc('mobileBarberBookings/bk1').update({ paymentStatus: 'paid' })));
  await check('customer (owner) CANNOT change servicePrice', assertFails(anon.doc('mobileBarberBookings/bk1').update({ servicePrice: 0 })));
  await check('customer (owner) CANNOT flip status to confirmed', assertFails(anon.doc('mobileBarberBookings/bk1').update({ status: 'confirmed' })));
  await check('customer (owner) CAN cancel', assertSucceeds(anon.doc('mobileBarberBookings/bk1').update({ status: 'cancelled' })));
  await check('vendor member CAN confirm booking', assertSucceeds(vendorMember.doc('mobileBarberBookings/bk1').update({ status: 'confirmed', paymentStatus: 'paid' })));
  await check('OTHER anon cannot read a booking they do not own', assertFails(anonB.doc('mobileBarberBookings/bk1').get()));

  console.log('\n── mobileBarberBookings create validation ──');
  await check('create with valid price is allowed', assertSucceeds(anon.doc('mobileBarberBookings/new1').set(Object.assign({}, validBooking, { customerUid: 'anonA' }))));
  await check('create with NEGATIVE price is denied', assertFails(anon.doc('mobileBarberBookings/new2').set(Object.assign({}, validBooking, { servicePrice: -5 }))));
  await check('create with >100% discount is denied', assertFails(anon.doc('mobileBarberBookings/new3').set(Object.assign({}, validBooking, { discountPercent: 150 }))));
  await check('create with confirmed status is denied', assertFails(anon.doc('mobileBarberBookings/new4').set(Object.assign({}, validBooking, { status: 'confirmed' }))));

  console.log('\n── cross-vendor subcollection write + admin ──');
  await check('anonymous CANNOT write another vendor subcollection', assertFails(anon.doc('vendors/michael-nguyen-oc/menuItems/x').set({ name: 'hacked' })));
  await check('non-member email user CANNOT write vendor data', assertFails(emailUser.doc('mobileBarberVendors/michael-nguyen-oc').set({ active: false })));
  await check('vendor member CAN write own vendor data', assertSucceeds(vendorMember.doc('mobileBarberVendors/michael-nguyen-oc').update({ active: true })));
  await check('ADMIN (johnntd) CAN write any vendor data', assertSucceeds(admin.doc('mobileBarberVendors/michael-nguyen-oc').update({ active: true })));
  await check('ADMIN can write vendor subcollection', assertSucceeds(admin.doc('vendors/michael-nguyen-oc/menuItems/x').set({ name: 'ok' })));

  console.log('\n── securityAlerts (defense-in-depth log) ──');
  var validAlert = { severity: 'high', type: 'xss_payload_detected', message: 'test', resolved: false, createdAt: '2026-05-30T00:00:00Z', vendorId: 'michael-nguyen-oc' };
  await check('anon client CAN create a validated alert', assertSucceeds(anon.doc('securityAlerts/a1').set(validAlert)));
  await check('create with bad severity is denied', assertFails(anon.doc('securityAlerts/a2').set(Object.assign({}, validAlert, { severity: 'boom' }))));
  await check('create with resolved=true is denied', assertFails(anon.doc('securityAlerts/a3').set(Object.assign({}, validAlert, { resolved: true }))));
  await check('public/anon CANNOT read alerts', assertFails(anonB.doc('securityAlerts/a1').get()));
  await check('admin CAN read alerts', assertSucceeds(admin.doc('securityAlerts/a1').get()));
  await check('vendor member CAN read alerts scoped to their vendor', assertSucceeds(vendorMember.doc('securityAlerts/a1').get()));
  await check('admin CAN mark resolved', assertSucceeds(admin.doc('securityAlerts/a1').update({ resolved: true, resolvedAt: 'x', resolvedBy: 'a' })));
  await check('anon CANNOT mark resolved', assertFails(anon.doc('securityAlerts/a1').update({ resolved: true })));

  console.log('\n── config/aiSecrets (secured server-only key store) ──');
  await check('config/aiSecrets is NOT readable by anyone (even admin)', assertFails(admin.doc('config/aiSecrets').get()));
  await check('config/aiSecrets is NOT readable by anon', assertFails(anon.doc('config/aiSecrets').get()));
  await check('admin CAN write (set/rotate) keys', assertSucceeds(admin.doc('config/aiSecrets').set({ claudeKey: 'sk-x', openaiKey: 'sk-y', geminiKey: 'AIza-z' })));
  await check('non-admin email user CANNOT write keys', assertFails(emailUser.doc('config/aiSecrets').set({ claudeKey: 'sk-x' })));
  await check('anon CANNOT write keys', assertFails(anon.doc('config/aiSecrets').set({ claudeKey: 'sk-x' })));

  console.log('\n── airport/ride bookings + driver fraud (workflow findings) ──');
  await check('anon CANNOT forge a bookings update (status/paid)', assertFails(anon.doc('bookings/ride1').update({ status: 'completed', paymentStatus: 'paid' })));
  await check('staff (non-anon) CAN update a bookings doc', assertSucceeds(emailUser.doc('bookings/ride1').update({ status: 'assigned' })));
  await check('anon CANNOT self-insert an approved driver', assertFails(anon.doc('drivers/attacker').set({ complianceStatus: 'approved', adminStatus: 'active' })));
  await check('driver CANNOT self-approve (complianceStatus admin-only)', assertFails(driver.doc('drivers/driver1').update({ complianceStatus: 'approved' })));
  await check('driver CAN edit own non-approval field', assertSucceeds(driver.doc('drivers/driver1').update({ name: 'Renamed' })));
  await check('admin CAN approve a driver', assertSucceeds(admin.doc('drivers/driver1').update({ complianceStatus: 'approved' })));
  await check('anon CANNOT write driver_compliance', assertFails(anon.doc('driver_compliance/driver1').set({ overallStatus: 'approved' })));
  await check('create with paymentStatus=paid is denied', assertFails(anon.doc('mobileBarberBookings/payfraud').set(Object.assign({}, validBooking, { customerUid: 'anonA', paymentStatus: 'paid' }))));

  console.log('\n── auditLogs (immutable, server-written) ──');
  await check('client CANNOT create/forge an audit log', assertFails(anon.doc('auditLogs/forged').set({ vendorId: 'michael-nguyen-oc', action: 'update' })));
  await check('admin CAN read audit logs', assertSucceeds(admin.doc('auditLogs/log1').get()));
  await check('vendor CAN read their own audit log', assertSucceeds(vendorMember.doc('auditLogs/log1').get()));
  await check('unrelated anon CANNOT read audit logs', assertFails(anonB.doc('auditLogs/log1').get()));
  await check('NO ONE can delete an audit log (immutable)', assertFails(admin.doc('auditLogs/log1').delete()));

  console.log('\n=== RULE TESTS:', pass + ' passed,', fail + ' failed ===');
  await env.cleanup();
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
