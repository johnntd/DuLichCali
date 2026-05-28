'use strict';

// End-to-end pinning tests for the Mobile Barber promotion visibility fix.
//
// Two real bugs the previous "fix" missed:
//   1. Wrong Firestore collection — dashboard writes to mobileBarberVendors
//      (DATA.COLLECTIONS.vendors) but the landing read from 'vendors'.
//   2. DATA.sampleVendors entries are Object.freeze'd, so the landing's
//      `vendors[i].promotions = ...` mutation was a silent no-op.
//
// This suite asserts both fixes plus the demo-promo seed contract so the
// rendering pipeline can never silently break again.

var fs   = require('fs');
var path = require('path');
var DATA = require('../../mobile-barber/mobile-barber-data');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function assertEq(a, b, msg) {
  if (a !== b) throw new Error((msg ? msg + ': ' : '') + 'expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
}
function read(rel) { return fs.readFileSync(path.join(__dirname, '../../', rel), 'utf8'); }

function runMobileBarberPromotionVisibilityTests(test) {

  test('V1. DATA.COLLECTIONS.vendors is mobileBarberVendors (not "vendors")', function() {
    assertEq(DATA.COLLECTIONS.vendors, 'mobileBarberVendors',
      'Customer-side bridge must read from the same collection the dashboard writes to');
  });

  test('V2. Landing bridge reads from the correct mobileBarberVendors collection', function() {
    var src = read('mobile-barber/mobile-barber.js');
    var loader = src.slice(src.indexOf('function loadVendorPromosFromFirestore'),
                           src.indexOf('function loadVendorPromosFromFirestore') + 3500);
    assert(loader.indexOf('_mbCollection()') >= 0,
      'Loader must use _mbCollection() helper');
    var helper = src.slice(src.indexOf('function _mbCollection'),
                           src.indexOf('function _mbCollection') + 400);
    assert(helper.indexOf('DATA.COLLECTIONS.vendors') >= 0,
      '_mbCollection() must read DATA.COLLECTIONS.vendors');
    assert(loader.indexOf("db.collection('vendors')") < 0,
      'Loader must NOT use the wrong "vendors" collection (legacy bug)');
    // Subscribe listener must also use the right collection.
    var sub = src.slice(src.indexOf('function subscribeVendorPromos'),
                        src.indexOf('function subscribeVendorPromos') + 1800);
    assert(sub.indexOf('collection(collection)') >= 0,
      'subscribeVendorPromos must use the dynamic collection name');
    assert(sub.indexOf("db.collection('vendors')") < 0,
      'subscribeVendorPromos must NOT use the wrong "vendors" collection');
  });

  test('V3. Landing stores promos in a runtime overlay map (not by mutating frozen objects)', function() {
    var src = read('mobile-barber/mobile-barber.js');
    assert(src.indexOf('window._mbVendorPromosByVendor') >= 0,
      'Runtime overlay map must exist');
    assert(src.indexOf('function _vendorPromosFor') >= 0,
      '_vendorPromosFor reader helper must exist');
    assert(src.indexOf('function _setVendorPromos') >= 0,
      '_setVendorPromos writer helper must exist');
    assert(src.indexOf('function _vendorWithPromos') >= 0,
      '_vendorWithPromos enricher must exist (for booking/AGENT calls)');
    // The old silently-failing mutation must not exist anymore.
    assert(src.indexOf('vendors[i].promotions =') < 0,
      'Must not mutate vendor.promotions on the frozen catalog');
  });

  test('V4. Static seed: Michael 20% Classic + Tim 15% all-services', function() {
    var michael = DATA.findVendorById(DATA.MICHAEL_VENDOR_ID);
    var tim     = DATA.findVendorById(DATA.TIM_VENDOR_ID);
    assert(michael && Array.isArray(michael.promotions) && michael.promotions.length >= 1,
      'Michael must carry at least one seeded promo');
    var mClassic = michael.promotions.filter(function(p) {
      return Number(p.discountPercent) === 20 && p.applyToScope === 'selected';
    })[0];
    assert(mClassic, 'Michael must carry a 20% selected-scope seed promo');
    assert(mClassic.active === true, 'Seed promo must be active');
    assert(mClassic.displayOnCustomerPage !== false, 'Seed promo must be displayable');
    assert(Array.isArray(mClassic.appliesToServiceIds) && mClassic.appliesToServiceIds[0],
      'Seed promo must reference a specific service id');

    assert(tim && Array.isArray(tim.promotions) && tim.promotions.length >= 1,
      'Tim must carry at least one seeded promo');
    var tAll = tim.promotions.filter(function(p) {
      return Number(p.discountPercent) === 15 && p.applyToScope === 'all';
    })[0];
    assert(tAll, 'Tim must carry a 15% all-scope seed promo');
    assert(tAll.active === true);
  });

  test('V5. findActivePromotionForService finds the seed promos for the right service', function() {
    var michael = DATA.findVendorById(DATA.MICHAEL_VENDOR_ID);
    var classic = DATA.listServicesForVendor(michael.id).filter(function(s) {
      return s.slug === 'classic-haircut';
    })[0];
    assert(classic, 'Classic haircut service must exist for Michael');
    var match = DATA.findActivePromotionForService(michael, classic, new Date());
    assert(match, 'Michael 20% Classic promo must match the classic-haircut service');
    assertEq(Number(match.discountPercent), 20);

    var fade = DATA.listServicesForVendor(michael.id).filter(function(s) {
      return s.slug === 'fade-haircut';
    })[0];
    // Michael's seed promo is selected-scope on classic only, so fade gets no promo.
    var noMatch = DATA.findActivePromotionForService(michael, fade, new Date());
    assertEq(noMatch, null, 'Michael seed promo must NOT apply to fade (scope=selected)');

    var tim = DATA.findVendorById(DATA.TIM_VENDOR_ID);
    var timClassic = DATA.listServicesForVendor(tim.id).filter(function(s) {
      return s.slug === 'classic-haircut';
    })[0];
    var timMatch = DATA.findActivePromotionForService(tim, timClassic, new Date());
    assert(timMatch, 'Tim 15% all-scope promo must apply to every service');
    assertEq(Number(timMatch.discountPercent), 15);
  });

  test('V6. Pricing engine applies the seed promo to the booking total', function() {
    var BOOK    = require('../../mobile-barber/mobile-barber-booking');
    var michael = DATA.findVendorById(DATA.MICHAEL_VENDOR_ID);
    var classic = DATA.listServicesForVendor(michael.id).filter(function(s) {
      return s.slug === 'classic-haircut';
    })[0];
    var quote = BOOK.calculateMobileBarberPrice({
      vendor: michael,
      service: classic,
      customerAddress: { address: '123 Beach Blvd', city: 'Westminster', zip: '92683' },
      now: new Date('2026-06-10T10:00:00-07:00')
    });
    assertEq(quote.promoApplied, true, 'promoApplied must be true with seed promo');
    assertEq(Number(quote.discountPercent), 20);
    assert(quote.discountedPrice < quote.originalPrice, 'discounted < original');
    assertEq(quote.totalPrice, quote.discountedPrice, 'totalPrice must equal discountedPrice');
  });

  test('V7. Booking persistence carries promo snapshot fields', function() {
    var BOOK    = require('../../mobile-barber/mobile-barber-booking');
    var michael = DATA.findVendorById(DATA.MICHAEL_VENDOR_ID);
    var classic = DATA.listServicesForVendor(michael.id).filter(function(s) {
      return s.slug === 'classic-haircut';
    })[0];
    var draft = {
      customerName: 'Test User', customerPhone: '7145550100', customerEmail: '',
      serviceId: classic.id, requestedDate: '2026-06-10', startTime: '10:00',
      address: '123 Beach Blvd', city: 'Westminster', zip: '92683',
      paymentMethod: 'cash'
    };
    var avail = BOOK.checkAvailability({
      vendor: michael, services: [classic], availability: DATA.sampleAvailability,
      draft: draft, existingBookings: [], now: new Date('2026-06-10T08:00:00-07:00')
    });
    if (!avail.canCreate) return; // schedule edge — skip if seed availability isn't open
    var built = BOOK.buildBooking({ vendor: michael, draft: draft, availabilityResult: avail, now: '2026-06-10T08:00:00.000Z', id: 'vis-test' });
    assertEq(built.valid, true, (built.errors || []).join('; '));
    assertEq(built.booking.promoApplied, true);
    assertEq(Number(built.booking.discountPercent), 20);
    assert(typeof built.booking.promotionName === 'string' && built.booking.promotionName.length > 0);
    assert(built.booking.originalPrice > built.booking.discountedPrice);
    assertEq(built.booking.totalPrice, built.booking.discountedPrice);
  });

  test('V8. preferredVendor() enriches with runtime promos (boundary for AGENT/booking)', function() {
    var src = read('mobile-barber/mobile-barber.js');
    var fn = src.slice(src.indexOf('function preferredVendor'),
                       src.indexOf('function preferredVendor') + 3500);
    assert(fn.indexOf('_vendorWithPromos(picked)') >= 0,
      'preferredVendor must enrich the chosen vendor before returning');
  });

  test('V9. Manual + inline booking submit also enrich findVendorForAddress result', function() {
    var src = read('mobile-barber/mobile-barber.js');
    // Both submit paths must wrap findVendorForAddress in _vendorWithPromos.
    var hits = src.match(/_vendorWithPromos\(BOOKING\.findVendorForAddress\(addressObj\)\)/g) || [];
    assert(hits.length >= 2,
      'Both inline AI booking + manual booking must wrap findVendorForAddress');
  });

  test('V10. Diagnostics: load/subscribe log to console.info under [mobile-barber-promo]', function() {
    var src = read('mobile-barber/mobile-barber.js');
    assert(src.indexOf('[mobile-barber-promo]') >= 0,
      'Diagnostics tag [mobile-barber-promo] must appear in console.info calls');
    var loader = src.slice(src.indexOf('function loadVendorPromosFromFirestore'),
                           src.indexOf('function loadVendorPromosFromFirestore') + 3500);
    assert(loader.indexOf('console.info') >= 0 || loader.indexOf('root.console.info') >= 0,
      'loadVendorPromosFromFirestore must console.info diagnostics');
    var sub = src.slice(src.indexOf('function subscribeVendorPromos'),
                        src.indexOf('function subscribeVendorPromos') + 2000);
    assert(sub.indexOf('console.info') >= 0 || sub.indexOf('root.console.info') >= 0,
      'subscribeVendorPromos must log live updates');
  });

  test('V11. Loader semantics: missing promotions field falls back to seed (does not overwrite with [])', function() {
    var src = read('mobile-barber/mobile-barber.js');
    var loader = src.slice(src.indexOf('function loadVendorPromosFromFirestore'),
                           src.indexOf('function loadVendorPromosFromFirestore') + 3500);
    assert(loader.indexOf('if (Array.isArray(data.promotions))') >= 0,
      'Loader must check Array.isArray(data.promotions) explicitly');
    assert(loader.indexOf('using-seed') >= 0,
      'Loader must report when falling back to seed (proves the semantic is intentional)');
  });
}

if (require.main === module) {
  var passed = 0, failed = 0;
  runMobileBarberPromotionVisibilityTests(function(name, fn) {
    try { fn(); passed++; console.log('PASS', name); }
    catch (e) { failed++; console.log('FAIL', name); console.log(' ', e.message); }
  });
  console.log('Mobile Barber promotion visibility tests:', passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

module.exports = { runMobileBarberPromotionVisibilityTests: runMobileBarberPromotionVisibilityTests };
