'use strict';
/**
 * ADVERSARIAL attack probes against firestore.rules — skeptical auditor.
 * Run: firebase emulators:exec --only firestore "node tests/security-rules/attack.test.js"
 *
 * Each "attack" tries to perform a fraud write/read. We record SUCCEEDED (bypass
 * found, BAD) or BLOCKED (rule held, GOOD). We never throw — we record reality.
 */
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');

const RULES = fs.readFileSync(path.join(__dirname, '../../firestore.rules'), 'utf8');
const PROJECT = 'demo-dulichcali-attack';

const results = [];
async function attack(label, promise) {
  try {
    await promise;
    results.push({ label, outcome: 'SUCCEEDED' });
    console.log('  [SUCCEEDED BYPASS]', label);
  } catch (e) {
    results.push({ label, outcome: 'BLOCKED' });
    console.log('  [BLOCKED]', label, '—', (e && e.code || e && e.message || '').toString().split('\n')[0]);
  }
}

(async () => {
  const env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: RULES, host: '127.0.0.1', port: 8080 }
  });

  const anonAttacker = env.authenticatedContext('attackerUid', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  const unauth = env.unauthenticatedContext().firestore();
  const emailAttacker = env.authenticatedContext('emailAttackerUid', { email: 'evil@x.com', firebase: { sign_in_provider: 'password' } }).firestore();

  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc('vendorUsers/legitOwnerUid').set({ vendorId: 'michael-nguyen-oc', email: 'm@x.com' });
    await db.doc('mobileBarberVendors/michael-nguyen-oc').set({ active: true, ownerId: 'michael-nguyen' });
    await db.doc('mobileBarberBookings/victimBooking').set({
      vendorId: 'michael-nguyen-oc', customerUid: 'victimUid', customerName: 'Victim', customerPhone: '111',
      serviceId: 's', serviceName: 'S', address: 'x', city: 'c', zip: 'z',
      requestedDate: '2026-06-01', startTime: '10:00', endTime: '10:40',
      status: 'pending_barber_confirmation', source: 'customer_form',
      servicePrice: 40, amountDue: 40, totalPrice: 40, paymentStatus: 'unpaid',
      assignedBarberId: 'michael-nguyen-oc', ownerId: 'michael-nguyen'
    });
    await db.doc('mobileBarberBookings/attackerOwned').set({
      vendorId: 'michael-nguyen-oc', customerUid: 'attackerUid', customerName: 'Atk', customerPhone: '222',
      serviceId: 's', serviceName: 'S', address: 'x', city: 'c', zip: 'z',
      requestedDate: '2026-06-03', startTime: '12:00', endTime: '12:40',
      status: 'pending_barber_confirmation', source: 'customer_form',
      servicePrice: 40, amountDue: 40, totalPrice: 40, paymentStatus: 'unpaid'
    });
    await db.doc('bookings/ride1').set({
      customerName: 'RideVictim', customerPhone: '999', ownerId: 'o',
      status: 'pending', fare: 120, driverId: '', datetime: '2026-06-01T10:00'
    });
  });

  const baseValidCreate = {
    vendorId: 'michael-nguyen-oc', customerName: 'New', customerPhone: '2', serviceId: 's', serviceName: 'S',
    address: 'x', city: 'c', zip: 'z', requestedDate: '2026-06-09', startTime: '11:00', endTime: '11:40',
    status: 'pending_barber_confirmation', source: 'customer_form'
  };

  console.log('\n== SET A: mobileBarberBookings CREATE-path fraud ==');
  await attack('A1 create booking servicePrice=0 (free haircut)',
    anonAttacker.doc('mobileBarberBookings/atkFree').set(Object.assign({}, baseValidCreate, { servicePrice: 0, amountDue: 0, totalPrice: 0 })));
  await attack('A2 create booking paymentStatus=paid baked in at create',
    anonAttacker.doc('mobileBarberBookings/atkPaid').set(Object.assign({}, baseValidCreate, { servicePrice: 40, amountDue: 40, paymentStatus: 'paid' })));
  await attack('A3 create booking status=confirmed',
    anonAttacker.doc('mobileBarberBookings/atkConf').set(Object.assign({}, baseValidCreate, { status: 'confirmed' })));
  await attack('A4 create booking status=completed',
    anonAttacker.doc('mobileBarberBookings/atkComp').set(Object.assign({}, baseValidCreate, { status: 'completed' })));
  await attack('A5 create vendor_review booking discountPercent=100 + price 0',
    anonAttacker.doc('mobileBarberBookings/atkDisc').set(Object.assign({}, baseValidCreate, { status: 'vendor_review', discountPercent: 100, servicePrice: 0, amountDue: 0 })));
  await attack('A6 create booking customerUid=victimUid (impersonation)',
    anonAttacker.doc('mobileBarberBookings/atkImp').set(Object.assign({}, baseValidCreate, { customerUid: 'victimUid' })));
  await attack('A7 create booking with no customerUid field (orphan)',
    anonAttacker.doc('mobileBarberBookings/atkNoUid').set(Object.assign({}, baseValidCreate)));
  await attack('A8 create booking forged assignedBarberId+ownerId',
    anonAttacker.doc('mobileBarberBookings/atkForge').set(Object.assign({}, baseValidCreate, { assignedBarberId: 'attacker-barber', ownerId: 'attacker-owner' })));
  await attack('A9 UNAUTHENTICATED create booking (no auth token)',
    unauth.doc('mobileBarberBookings/atkUnauth').set(Object.assign({}, baseValidCreate)));

  console.log('\n== SET B: mobileBarberBookings UPDATE-path fraud (owner) ==');
  await attack('B1 owner flips own booking status->confirmed',
    anonAttacker.doc('mobileBarberBookings/attackerOwned').update({ status: 'confirmed' }));
  await attack('B2 owner flips own booking status->completed',
    anonAttacker.doc('mobileBarberBookings/attackerOwned').update({ status: 'completed' }));
  await attack('B3 owner sets paymentStatus=paid on own booking',
    anonAttacker.doc('mobileBarberBookings/attackerOwned').update({ paymentStatus: 'paid' }));
  await attack('B4 owner sets servicePrice=0 on own booking',
    anonAttacker.doc('mobileBarberBookings/attackerOwned').update({ servicePrice: 0, amountDue: 0 }));
  await attack('B5 owner cancels own booking (benign, expected SUCCEED)',
    anonAttacker.doc('mobileBarberBookings/attackerOwned').update({ status: 'cancelled' }));

  console.log('\n== SET C: cross-customer UPDATE/READ (not owner) ==');
  await attack('C1 attacker cancels victimBooking (not owner)',
    anonAttacker.doc('mobileBarberBookings/victimBooking').update({ status: 'cancelled' }));
  await attack('C2 attacker edits victimBooking notes (not owner)',
    anonAttacker.doc('mobileBarberBookings/victimBooking').update({ notes: 'griefed' }));
  await attack('C3 attacker reads victimBooking PII/address (not owner)',
    anonAttacker.doc('mobileBarberBookings/victimBooking').get());

  console.log('\n== SET D: vendor takeover -> full booking control ==');
  await attack('D1 email-attacker self-maps OWN uid to michael-nguyen-oc',
    emailAttacker.doc('vendorUsers/emailAttackerUid').set({ vendorId: 'michael-nguyen-oc', email: 'evil@x.com' }));
  await attack('D2 (post-takeover) confirm+paid+reprice victimBooking as vendor',
    emailAttacker.doc('mobileBarberBookings/victimBooking').update({ status: 'confirmed', paymentStatus: 'paid', servicePrice: 999 }));
  await attack('D3 (post-takeover) read victimBooking PII as vendor',
    emailAttacker.doc('mobileBarberBookings/victimBooking').get());
  await attack('D4 (post-takeover) rewrite vendor zelle/payout',
    emailAttacker.doc('mobileBarberVendors/michael-nguyen-oc').update({ zellePhone: '5555555555' }));

  console.log('\n== SET E: airport/ride bookings UPDATE fraud ==');
  await attack('E1 anon updates ride1 status->completed',
    anonAttacker.doc('bookings/ride1').update({ status: 'completed' }));
  await attack('E2 anon sets ride1 fare=0',
    anonAttacker.doc('bookings/ride1').update({ fare: 0 }));
  await attack('E3 anon assigns ride1 to attacker driver',
    anonAttacker.doc('bookings/ride1').update({ driverId: 'attacker-driver', status: 'assigned' }));
  await attack('E4 anon reads ride1 by id',
    anonAttacker.doc('bookings/ride1').get());

  console.log('\n======== ATTACK SUMMARY ========');
  const bypasses = results.filter(r => r.outcome === 'SUCCEEDED');
  results.forEach(r => console.log(' ', r.outcome.padEnd(10), r.label));
  console.log('\nTOTAL SUCCEEDED (bypass/allowed):', bypasses.length, 'of', results.length);
  console.log('SUCCEEDED LABELS:', bypasses.map(b => b.label).join(' | ') || '(none)');

  await env.cleanup();
  process.exit(0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
