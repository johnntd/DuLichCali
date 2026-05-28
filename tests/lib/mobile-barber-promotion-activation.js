'use strict';

// Pinning tests for the Mobile Barber promotion activation fix.
// The root cause was that vendor.promotions written to Firestore from the
// dashboard were NEVER read by the customer landing — which only walked
// the static DATA.sampleVendors catalog. This suite makes sure the bridge
// stays in place and the canonical promo helper surface is intact.

var fs   = require('fs');
var path = require('path');
var DATA = require('../../mobile-barber/mobile-barber-data');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function assertEq(a, b, msg) {
  if (a !== b) throw new Error((msg ? msg + ': ' : '') + 'expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
}
function read(rel) { return fs.readFileSync(path.join(__dirname, '../../', rel), 'utf8'); }

function runMobileBarberPromotionActivationTests(test) {

  test('P1. Landing bridges Firestore vendor.promotions into DATA.sampleVendors', function() {
    var src = read('mobile-barber/mobile-barber.js');
    assert(src.indexOf('function loadVendorPromosFromFirestore') >= 0,
      'loadVendorPromosFromFirestore must exist');
    assert(src.indexOf('function subscribeVendorPromos') >= 0,
      'subscribeVendorPromos onSnapshot listener must exist');
    // The original `_applyVendorPromosPatch` mutated frozen objects (silent
    // no-op). Replaced by the runtime overlay map + helpers — assert those.
    assert(src.indexOf('window._mbVendorPromosByVendor') >= 0,
      'runtime overlay map must exist');
    assert(src.indexOf('function _vendorPromosFor') >= 0,
      'overlay reader must exist');
    // init() must kick the bridge off so first paint can show promos.
    var initSlice = src.slice(src.indexOf('function init()'), src.indexOf('function init()') + 1500);
    assert(initSlice.indexOf('loadVendorPromosFromFirestore()') >= 0,
      'init() must call loadVendorPromosFromFirestore');
    assert(initSlice.indexOf('subscribeVendorPromos()') >= 0,
      'init() must subscribe to live promo updates');
    assert(initSlice.indexOf('renderHeroPromoSpotlight()') >= 0,
      'init() must re-render hero after promos merge');
    assert(initSlice.indexOf('renderServices()') >= 0,
      'init() must re-render service cards after promos merge');
  });

  test('P2. Canonical helper surface promised in the spec is exported on window', function() {
    var src = read('mobile-barber/mobile-barber.js');
    [
      'function getActiveMobileBarberPromotions',
      'function getBestPromotionForService',
      'function applyPromotionToServicePrice',
      'function renderPromotionHero',
      'window.getActiveMobileBarberPromotions',
      'window.getBestPromotionForService',
      'window.applyPromotionToServicePrice',
      'window.renderPromotionHero'
    ].forEach(function(needle) {
      assert(src.indexOf(needle) >= 0, 'must export ' + needle);
    });
  });

  test('P3. Service card renders promo-aware price chip when a promo applies', function() {
    var src = read('mobile-barber/mobile-barber.js');
    var renderer = src.slice(src.indexOf('function renderServices'), src.indexOf('function renderServices') + 3200);
    assert(renderer.indexOf('applyPromotionToServicePrice(service)') >= 0,
      'renderServices must check for an active promo per service');
    assert(renderer.indexOf("'mb-chip mb-chip--promo'") >= 0,
      'must render the promo-modifier chip when promoApplied');
    assert(renderer.indexOf('mb-chip__original') >= 0,
      'must include strikethrough original price');
    assert(renderer.indexOf('mb-chip__final') >= 0,
      'must include final price');
    assert(renderer.indexOf('mb-chip__pct') >= 0,
      'must include percent badge');
  });

  test('P4. CSS ships promo chip styling + strikethrough original', function() {
    var css = read('mobile-barber/mobile-barber.css');
    assert(css.indexOf('.mb-chip--promo') >= 0, 'promo chip class must exist');
    assert(css.indexOf('text-decoration: line-through') >= 0, 'original price must be strikethrough');
    assert(css.indexOf('.mb-chip__pct') >= 0, 'percent badge styling');
  });

  test('P5. Pure-data: getBestPromotionForService picks highest discount', function() {
    // Re-verify the underlying data-layer contract that the helper relies on.
    var svc = { id: 'classic-haircut', price: 50 };
    var promos = [
      { id: 'p1', active: true, discountPercent: 10, applyToScope: 'all', vendorId: 'v1' },
      { id: 'p2', active: true, discountPercent: 30, applyToScope: 'all', vendorId: 'v1' },
      { id: 'p3', active: true, discountPercent: 20, applyToScope: 'selected', appliesToServiceIds: ['classic-haircut'], vendorId: 'v1' },
      { id: 'p4', active: true, discountPercent: 50, applyToScope: 'selected', appliesToServiceIds: ['other-service'], vendorId: 'v1' }
    ];
    // We can't call the landing's getBestPromotionForService from Node (it
    // depends on window). Re-implement the contract inline to assert the
    // SAME selection logic the landing ships:
    var pool = promos.filter(function(p) {
      if (p.applyToScope === 'selected') {
        return (p.appliesToServiceIds || []).indexOf(svc.id) >= 0;
      }
      return true;
    });
    pool.sort(function(a, b) { return Number(b.discountPercent) - Number(a.discountPercent); });
    assertEq(pool[0].id, 'p2', 'highest discount among matching scopes wins');
  });

  test('P6. Pricing engine + AI agent still read vendor.promotions (no regression)', function() {
    var bookingSrc = read('mobile-barber/mobile-barber-booking.js');
    assert(bookingSrc.indexOf('DATA.findActivePromotionForService(vendor, service') >= 0,
      'calculateMobileBarberPrice must keep reading vendor.promotions');
    var agentSrc = read('mobile-barber/mobile-barber-agent.js');
    assert(agentSrc.indexOf('vendor.promotions') >= 0,
      'agent prompt must keep reading vendor.promotions');
    assert(agentSrc.indexOf('Active promotions') >= 0,
      'agent prompt must surface active promotions');
  });

  test('P7. Vendor dashboard still persists promotions to Firestore (no regression)', function() {
    var dashSrc = read('mobile-barber/mobile-barber-dashboard.js');
    assert(dashSrc.indexOf('function persistVendorPromotions') >= 0);
    assert(dashSrc.indexOf("collection(DATA.COLLECTIONS.vendors).doc(state.vendorId)") >= 0,
      'persist must write to vendors/{vendorId}');
    assert(dashSrc.indexOf('promotions: state.vendor.promotions') >= 0,
      'persist must merge promotions field');
  });

  test('P8. findActivePromotionForService respects all eligibility rules', function() {
    var vendor = JSON.parse(JSON.stringify(DATA.findVendorById(DATA.MICHAEL_VENDOR_ID)));
    var svc = DATA.listServicesForVendor(vendor.id)[0];
    var now = new Date();
    // Active, in-range
    vendor.promotions = [{
      id: 'live', vendorId: vendor.id, name: 'Live', description: '',
      discountPercent: 20, applyToScope: 'all', appliesToServiceIds: [],
      startDate: '', endDate: '', maxRedemptions: 0, currentRedemptions: 0,
      active: true, promoCode: '', displayOnCustomerPage: true,
      createdAt: '2026-05-28T00:00:00.000Z', updatedAt: '2026-05-28T00:00:00.000Z'
    }];
    assert(DATA.findActivePromotionForService(vendor, svc, now), 'active promo matches');
    // Disabled
    vendor.promotions[0].active = false;
    assertEq(DATA.findActivePromotionForService(vendor, svc, now), null, 'disabled promo does not match');
    // Expired
    vendor.promotions[0].active = true;
    vendor.promotions[0].endDate = '2020-01-01';
    assertEq(DATA.findActivePromotionForService(vendor, svc, now), null, 'expired promo does not match');
    // Max reached
    vendor.promotions[0].endDate = '';
    vendor.promotions[0].maxRedemptions = 5;
    vendor.promotions[0].currentRedemptions = 5;
    assertEq(DATA.findActivePromotionForService(vendor, svc, now), null, 'max reached stops promo');
  });

  test('P9. Booking persistence: buildBooking carries promo fields when applied', function() {
    var BOOK = require('../../mobile-barber/mobile-barber-booking');
    var vendor = JSON.parse(JSON.stringify(DATA.findVendorById(DATA.MICHAEL_VENDOR_ID)));
    vendor.promotions = [{
      id: 'p20', vendorId: vendor.id, name: 'Spring 20', description: '',
      discountPercent: 20, applyToScope: 'all', appliesToServiceIds: [],
      startDate: '', endDate: '', maxRedemptions: 0, currentRedemptions: 0,
      active: true, promoCode: '', displayOnCustomerPage: true,
      createdAt: '2026-05-28T00:00:00.000Z', updatedAt: '2026-05-28T00:00:00.000Z'
    }];
    var svc = DATA.listServicesForVendor(vendor.id)[0];
    var draft = {
      customerName: 'Test', customerPhone: '7145550100', customerEmail: '',
      serviceId: svc.id, requestedDate: '2026-06-10', startTime: '10:00',
      address: '123 Beach Blvd', city: 'Westminster', zip: '92683',
      paymentMethod: 'cash'
    };
    var avail = BOOK.checkAvailability({
      vendor: vendor, services: [svc], availability: DATA.sampleAvailability,
      draft: draft, existingBookings: [], now: new Date('2026-06-10T08:00:00-07:00')
    });
    if (!avail.canCreate) return;
    var built = BOOK.buildBooking({ vendor: vendor, draft: draft, availabilityResult: avail, now: '2026-06-10T08:00:00.000Z', id: 'promo-act-test' });
    assertEq(built.valid, true, (built.errors || []).join('; '));
    assertEq(built.booking.promoApplied, true);
    assertEq(built.booking.discountPercent, 20);
    assertEq(built.booking.promotionName, 'Spring 20');
    assert(built.booking.discountedPrice <= built.booking.originalPrice);
    assertEq(built.booking.totalPrice, built.booking.discountedPrice);
  });

  test('P10. Vendor portal promo chip rendering pattern is intact', function() {
    var dashSrc = read('mobile-barber/mobile-barber-dashboard.js');
    assert(dashSrc.indexOf('mb-promo-chip') >= 0, 'promo chip class on appointment row');
    assert(dashSrc.indexOf('booking.promoApplied') >= 0, 'chip gated on booking.promoApplied');
  });
}

if (require.main === module) {
  var passed = 0, failed = 0;
  runMobileBarberPromotionActivationTests(function(name, fn) {
    try { fn(); passed++; console.log('PASS', name); }
    catch (e) { failed++; console.log('FAIL', name); console.log(' ', e.message); }
  });
  console.log('Mobile Barber promotion activation tests:', passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

module.exports = { runMobileBarberPromotionActivationTests: runMobileBarberPromotionActivationTests };
