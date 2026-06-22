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
const { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } = require('firebase/firestore');

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
    // AI Group Travel Concierge seed trip (collaboration requires a real account).
    await setDoc(doc(adb, 'groupTrips/trip-1'), { id: 'trip-1', groupName: 'Seed Trip', destination: 'San Diego', ownerUid: 'tripper-1', liveSharingEnabled: true });
    // trip-2: same owner, live sharing DISABLED (for the "cannot share when off" test).
    await setDoc(doc(adb, 'groupTrips/trip-2'), { id: 'trip-2', groupName: 'No-Share Trip', destination: 'LA', ownerUid: 'tripper-1', liveSharingEnabled: false });
    // tripMember-1 is a joined member of trip-1 (membership written by Admin SDK only).
    await setDoc(doc(adb, 'tripMembers/trip-1/members/member-1'), { displayName: 'Mia', familyId: 'f1', role: 'member' });
    await setDoc(doc(adb, 'tripMembers/trip-1/members/member-2'), { displayName: 'Bo', familyId: 'f2', role: 'member' });
    // Trip Album media (V2): a group item + a PRIVATE item (both by member-1) + a group item by member-2.
    await setDoc(doc(adb, 'groupTrips/trip-1/media/m-group'), { id: 'm-group', uploadedBy: 'member-1', familyId: 'f1', mediaType: 'link', visibility: 'group', caption: 'beach', url: 'https://x' });
    await setDoc(doc(adb, 'groupTrips/trip-1/media/m-private'), { id: 'm-private', uploadedBy: 'member-1', familyId: 'f1', mediaType: 'link', visibility: 'private', url: 'https://y' });
    await setDoc(doc(adb, 'groupTrips/trip-1/media/m-m2'), { id: 'm-m2', uploadedBy: 'member-2', familyId: 'f2', mediaType: 'photo', visibility: 'group', url: 'https://z' });
    // Seed live-location docs (latest-only, per uid) for read/delete tests.
    await setDoc(doc(adb, 'groupTrips/trip-1/liveLocations/member-1'), { memberId: 'member-1', familyId: 'f1', latitude: 32.71, longitude: -117.16, expiresAt: 9999999999999 });
    await setDoc(doc(adb, 'groupTrips/trip-1/liveLocations/member-2'), { memberId: 'member-2', latitude: 33.0, longitude: -117.2, expiresAt: 9999999999999 });
    await setDoc(doc(adb, 'tripShareAccess/tok-1'), { tripId: 'trip-1', passcodeHash: 'x', enabled: true });
    // Owner-only member contact info (phone/email) — must NOT be readable by other members.
    await setDoc(doc(adb, 'tripMemberContacts/trip-1/members/member-1'), { phone: '4085550009', email: 'm1@x' });
    await setDoc(doc(adb, 'tripMemberContacts/trip-1/members/member-2'), { phone: '4085550010' });
    // Driver profile doc — for admin-enable + driver-self-write tests.
    await setDoc(doc(adb, 'drivers/driverA'), { fullName: 'Driver A', phone: '4080000001', adminStatus: 'active', complianceStatus: 'approved', active: false, rideServiceEnabled: false, regions: ['bayarea'] });

    // Style Studio promo config + per-uid usage counters (server-written).
    await setDoc(doc(adb, 'config/styleStudioPromo'), { active: true, startDate: '2026-06-13', endDate: '2026-06-27', freeGenerationsPerUser: 5 });
    await setDoc(doc(adb, 'styleStudioUsage/cust-1'), { lastDay: '2026-06-13' });
    await setDoc(doc(adb, 'styleStudioUsage/cust-1/days/2026-06-13'), { count: 2 });

    // Cross-trip personal travel memory (Travel Concierge Step 6) — one doc per uid.
    await setDoc(doc(adb, 'travelMemory/tripper-1'), { uid: 'tripper-1', cuisines: ['vietnamese'], pace: 'relaxed', updatedAt: 1 });
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
  // ── Ride dispatch fan-out (root cause of the "Booking failed" bug) ──
  // The web ride-intake fans out 4 writes after the booking. These document which the customer
  // (authed-anonymous) may perform. The admin-notification write is DENIED (vendor-member/admin
  // only) — that denial used to reject the whole submit chain → "Booking failed" + no dispatch.
  // The fix makes the fan-out best-effort; the auth-gated dispatch writes below succeed for an
  // (anonymous) authed session, so onDispatchQueue can reach drivers like Michael.
  await allowed('authed-anon CAN enqueue ride dispatch (rideNotifications)', setDoc(doc(anon, 'rideNotifications/rn1'), { bookingId: 'new1', status: 'new', passengers: 10 }));
  await allowed('authed-anon CAN enqueue ride dispatch (dispatchQueue)', setDoc(doc(anon, 'dispatchQueue/new1_0'), { bookingId: 'new1', status: 'pending', attempt: 1 }));
  await denied('customer CANNOT write the admin-dlc notification (root cause — must move server-side)', setDoc(doc(anon, 'vendors/admin-dlc/notifications/n1'), { type: 'new_booking', bookingId: 'new1' }));

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

  // ── Style Studio public promo config + per-uid usage counters ──
  // Promo config is server-read only: NO browser (authed or anon) may read it.
  await denied('authed client CANNOT read styleStudioPromo config', getDoc(doc(cust1, 'config/styleStudioPromo')));
  await denied('anon client CANNOT read styleStudioPromo config', getDoc(doc(anon, 'config/styleStudioPromo')));
  await denied('non-admin client CANNOT write styleStudioPromo config', setDoc(doc(cust1, 'config/styleStudioPromo'), { active: false }));
  // Admin manages the promo window/quota.
  await allowed('admin CAN write styleStudioPromo config', setDoc(doc(admin, 'config/styleStudioPromo'), { active: true, startDate: '2026-06-13', endDate: '2026-06-30', freeGenerationsPerUser: 3 }));
  // Usage counters: owner may READ own; client may NEVER write (Admin SDK only).
  await allowed('owner CAN read OWN styleStudioUsage parent doc', getDoc(doc(cust1, 'styleStudioUsage/cust-1')));
  await allowed('owner CAN read OWN daily usage counter', getDoc(doc(cust1, 'styleStudioUsage/cust-1/days/2026-06-13')));
  await denied('other uid CANNOT read another user usage parent', getDoc(doc(cust2, 'styleStudioUsage/cust-1')));
  await denied('other uid CANNOT read another user daily counter', getDoc(doc(cust2, 'styleStudioUsage/cust-1/days/2026-06-13')));
  await denied('owner CANNOT write OWN daily usage counter (no self-reset)', setDoc(doc(cust1, 'styleStudioUsage/cust-1/days/2026-06-13'), { count: 0 }));
  await denied('owner CANNOT write OWN usage parent doc', setDoc(doc(cust1, 'styleStudioUsage/cust-1'), { lastDay: '2026-06-14' }));

  // ── AI Group Travel Concierge: groupTrips require a real (non-anonymous) account ──
  // The /travel-concierge view is login-gated in the UI; these rules must enforce it
  // server-side so an anonymous session can neither read nor write any trip.
  const tripper = testEnv.authenticatedContext('tripper-1', nonAnonToken).firestore();
  const tripMember = testEnv.authenticatedContext('member-1', nonAnonToken).firestore();
  const tripMember2 = testEnv.authenticatedContext('member-2', nonAnonToken).firestore();
  const stranger = testEnv.authenticatedContext('stranger-1', nonAnonToken).firestore();
  // Owner (ownerUid) — full access to own trip.
  await allowed('trip OWNER CAN read own trip', getDoc(doc(tripper, 'groupTrips/trip-1')));
  await allowed('trip OWNER CAN update own trip', updateDoc(doc(tripper, 'groupTrips/trip-1'), { notes: [{ text: 'hi' }] }));
  await allowed('signed-in user CAN create a trip they own', setDoc(doc(tripper, 'groupTrips/trip-new'), { id: 'trip-new', groupName: 'New', destination: 'Vegas', ownerUid: 'tripper-1' }));
  await denied('CANNOT create a trip owned by someone else', setDoc(doc(stranger, 'groupTrips/trip-evil'), { id: 'trip-evil', destination: 'X', ownerUid: 'tripper-1' }));
  // Joined member — access via server-written membership.
  await allowed('joined MEMBER CAN read the trip', getDoc(doc(tripMember, 'groupTrips/trip-1')));
  await allowed('joined MEMBER CAN collaborate (update)', updateDoc(doc(tripMember, 'groupTrips/trip-1'), { notes: [{ text: 'yo' }] }));
  await allowed('joined MEMBER CAN check off a task (update bookings)', updateDoc(doc(tripMember, 'groupTrips/trip-1'), { bookings: [{ id: 'bk1', title: 'Book Xe Do Hoang', bookingStatus: 'completed', completedBy: 'member-1' }] }));
  await allowed('member CAN read own membership doc', getDoc(doc(tripMember, 'tripMembers/trip-1/members/member-1')));
  await allowed('member CAN read another member (member list)', getDoc(doc(tripMember, 'tripMembers/trip-1/members/member-1')));
  // Non-member, non-owner stranger — scoped OUT even though signed in.
  await denied('non-member stranger CANNOT read the trip', getDoc(doc(stranger, 'groupTrips/trip-1')));
  await denied('non-member stranger CANNOT update the trip', updateDoc(doc(stranger, 'groupTrips/trip-1'), { notes: [{ text: 'x' }] }));
  await denied('non-member CANNOT read someone\'s membership', getDoc(doc(stranger, 'tripMembers/trip-1/members/member-1')));
  // Membership + share-access are server-written only (no self-promotion).
  await denied('client CANNOT write membership (self-add)', setDoc(doc(stranger, 'tripMembers/trip-1/members/stranger-1'), { role: 'owner' }));
  await denied('member CANNOT promote self via membership write', setDoc(doc(tripMember, 'tripMembers/trip-1/members/member-1'), { role: 'owner' }));
  await denied('client CANNOT read tripShareAccess (passcode hash)', getDoc(doc(tripper, 'tripShareAccess/tok-1')));
  await denied('client CANNOT write tripShareAccess', setDoc(doc(tripper, 'tripShareAccess/tok-evil'), { tripId: 'trip-1', enabled: true }));
  // Anonymous — locked out entirely.
  await denied('anonymous session CANNOT read a group trip', getDoc(doc(anon, 'groupTrips/trip-1')));
  await denied('anonymous session CANNOT update a group trip', updateDoc(doc(anon, 'groupTrips/trip-1'), { notes: [{ text: 'x' }] }));
  await denied('anonymous session CANNOT create a group trip', setDoc(doc(anon, 'groupTrips/trip-anon'), { id: 'trip-anon', destination: 'X', ownerUid: 'anon-customer' }));
  await denied('group trips cannot be deleted by anyone', deleteDoc(doc(tripper, 'groupTrips/trip-1')));
  // "Your trips" list: owner may query their own trips; nobody can scrape all trips.
  await allowed('owner CAN query OWN trips (ownerUid==uid)', getDocs(query(collection(tripper, 'groupTrips'), where('ownerUid', '==', 'tripper-1'))));
  await denied('CANNOT query ALL group trips unfiltered', getDocs(collection(stranger, 'groupTrips')));
  await denied('CANNOT query another owner\'s trips', getDocs(query(collection(stranger, 'groupTrips'), where('ownerUid', '==', 'tripper-1'))));
  // Member CONTACT info (phone/email): owner + self only, never other members.
  await allowed('owner CAN read member contact (phone)', getDoc(doc(tripper, 'tripMemberContacts/trip-1/members/member-1')));
  await allowed('member CAN read OWN contact', getDoc(doc(tripMember, 'tripMemberContacts/trip-1/members/member-1')));
  await denied('member CANNOT read ANOTHER member\'s contact (phone privacy)', getDoc(doc(tripMember, 'tripMemberContacts/trip-1/members/member-2')));
  await denied('stranger CANNOT read member contact', getDoc(doc(stranger, 'tripMemberContacts/trip-1/members/member-1')));
  await denied('client CANNOT write member contact', setDoc(doc(tripper, 'tripMemberContacts/trip-1/members/member-9'), { phone: '4080000000' }));

  // ── Live trip location sharing: members-only, self-write, organizer-gated, self/owner delete ──
  var liveLoc = { memberId: 'member-1', familyId: 'f1', latitude: 32.72, longitude: -117.15, accuracy: 20, sharingStatus: 'on_the_way', expiresAt: 9999999999999 };
  // Read: owner + members only; strangers/anon never.
  await allowed('owner CAN read a member live location', getDoc(doc(tripper, 'groupTrips/trip-1/liveLocations/member-1')));
  await allowed('member CAN read a live location (group map)', getDoc(doc(tripMember, 'groupTrips/trip-1/liveLocations/member-2')));
  await denied('stranger CANNOT read a live location', getDoc(doc(stranger, 'groupTrips/trip-1/liveLocations/member-1')));
  await denied('anonymous CANNOT read a live location', getDoc(doc(anon, 'groupTrips/trip-1/liveLocations/member-1')));
  // Write: only your OWN doc, only while organizer enabled sharing, memberId must == uid.
  await allowed('member CAN write OWN live location (sharing on)', setDoc(doc(tripMember, 'groupTrips/trip-1/liveLocations/member-1'), liveLoc));
  await denied('member CANNOT write ANOTHER member location', setDoc(doc(tripMember, 'groupTrips/trip-1/liveLocations/member-2'), { memberId: 'member-2', latitude: 1, longitude: 2 }));
  await denied('member CANNOT spoof memberId != uid', setDoc(doc(tripMember, 'groupTrips/trip-1/liveLocations/member-1'), { memberId: 'someone-else', latitude: 1, longitude: 2 }));
  await denied('write DENIED when organizer sharing is OFF', setDoc(doc(tripper, 'groupTrips/trip-2/liveLocations/tripper-1'), { memberId: 'tripper-1', latitude: 1, longitude: 2 }));
  await denied('stranger CANNOT write a live location', setDoc(doc(stranger, 'groupTrips/trip-1/liveLocations/stranger-1'), { memberId: 'stranger-1', latitude: 1, longitude: 2 }));
  await denied('non-number coords rejected', setDoc(doc(tripMember, 'groupTrips/trip-1/liveLocations/member-1'), { memberId: 'member-1', latitude: 'x', longitude: 'y' }));
  // Delete: own (stop sharing) or owner (clear); never strangers.
  await denied('stranger CANNOT delete a live location', deleteDoc(doc(stranger, 'groupTrips/trip-1/liveLocations/member-1')));
  await allowed('owner CAN clear a member live location', deleteDoc(doc(tripper, 'groupTrips/trip-1/liveLocations/member-2')));
  await allowed('member CAN stop sharing (delete own)', deleteDoc(doc(tripMember, 'groupTrips/trip-1/liveLocations/member-1')));

  // ── Trip Album media (V2): members-only read, PRIVATE hidden from other members, author/owner moderation ──
  await allowed('owner CAN read group media', getDoc(doc(tripper, 'groupTrips/trip-1/media/m-group')));
  await allowed('member CAN read group media', getDoc(doc(tripMember, 'groupTrips/trip-1/media/m-group')));
  await denied('stranger CANNOT read media', getDoc(doc(stranger, 'groupTrips/trip-1/media/m-group')));
  await denied('anonymous CANNOT read media', getDoc(doc(anon, 'groupTrips/trip-1/media/m-group')));
  await allowed('author CAN read OWN private media', getDoc(doc(tripMember, 'groupTrips/trip-1/media/m-private')));
  await allowed('owner CAN read a private media (moderation)', getDoc(doc(tripper, 'groupTrips/trip-1/media/m-private')));
  await denied('another member CANNOT read a PRIVATE media (privacy)', getDoc(doc(tripMember2, 'groupTrips/trip-1/media/m-private')));
  await allowed('member CAN add own media', setDoc(doc(tripMember, 'groupTrips/trip-1/media/m-new'), { id: 'm-new', uploadedBy: 'member-1', mediaType: 'link', visibility: 'group', url: 'https://n' }));
  await denied('member CANNOT add media as someone else', setDoc(doc(tripMember, 'groupTrips/trip-1/media/m-evil'), { id: 'm-evil', uploadedBy: 'member-2', mediaType: 'link', visibility: 'group' }));
  await denied('invalid mediaType rejected', setDoc(doc(tripMember, 'groupTrips/trip-1/media/m-bad'), { id: 'm-bad', uploadedBy: 'member-1', mediaType: 'exe', visibility: 'group' }));
  await denied('invalid visibility rejected', setDoc(doc(tripMember, 'groupTrips/trip-1/media/m-bad2'), { id: 'm-bad2', uploadedBy: 'member-1', mediaType: 'link', visibility: 'public' }));
  await denied('stranger CANNOT add media', setDoc(doc(stranger, 'groupTrips/trip-1/media/m-strg'), { id: 'm-strg', uploadedBy: 'stranger-1', mediaType: 'link', visibility: 'group' }));
  await allowed('author CAN update own media', updateDoc(doc(tripMember, 'groupTrips/trip-1/media/m-group'), { caption: 'edited' }));
  await denied('member CANNOT reassign author', updateDoc(doc(tripMember, 'groupTrips/trip-1/media/m-group'), { uploadedBy: 'member-2' }));
  await denied('other member CANNOT edit someone else media', updateDoc(doc(tripMember2, 'groupTrips/trip-1/media/m-group'), { caption: 'x' }));
  await allowed('owner CAN moderate (delete) any media', deleteDoc(doc(tripper, 'groupTrips/trip-1/media/m-m2')));
  await allowed('author CAN delete own media', deleteDoc(doc(tripMember, 'groupTrips/trip-1/media/m-new')));

  // ── Cross-trip travel memory (Step 6): strictly own-only, non-anonymous, no cross-member reads ──
  await allowed('user CAN read OWN travel memory', getDoc(doc(tripper, 'travelMemory/tripper-1')));
  await allowed('user CAN update OWN travel memory', updateDoc(doc(tripper, 'travelMemory/tripper-1'), { pace: 'fast', cuisines: ['vietnamese', 'seafood'] }));
  await allowed('user CAN create OWN fresh travel memory', setDoc(doc(tripMember, 'travelMemory/member-1'), { uid: 'member-1', cuisines: ['mexican'], pace: 'moderate' }));
  await allowed('user CAN clear (delete) OWN travel memory', deleteDoc(doc(tripMember, 'travelMemory/member-1')));
  await denied('user CANNOT read ANOTHER user\'s travel memory', getDoc(doc(stranger, 'travelMemory/tripper-1')));
  await denied('user CANNOT write ANOTHER user\'s travel memory', setDoc(doc(stranger, 'travelMemory/tripper-1'), { uid: 'tripper-1', pace: 'hacked' }));
  await denied('user CANNOT delete ANOTHER user\'s travel memory', deleteDoc(doc(stranger, 'travelMemory/tripper-1')));
  await denied('anonymous CANNOT read travel memory', getDoc(doc(anon, 'travelMemory/anon-customer')));
  await denied('anonymous CANNOT write OWN travel memory (needs real account)', setDoc(doc(anon, 'travelMemory/anon-customer'), { uid: 'anon-customer', pace: 'relaxed' }));
  await denied('stranger CANNOT delete media', deleteDoc(doc(stranger, 'groupTrips/trip-1/media/m-private')));

  await testEnv.cleanup();
  console.log(`\n  RESULT: ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('rules test harness error:', e); process.exit(1); });
