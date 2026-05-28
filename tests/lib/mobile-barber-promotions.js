'use strict';

// Pure-data tests for the Mobile Barber vendor promotion feature.
// Covers the 9 spec scenarios + hero-spotlight + agent-mention.

var DATA = require('../../mobile-barber/mobile-barber-data');
var BOOKING = require('../../mobile-barber/mobile-barber-booking');
var AGENT = require('../../mobile-barber/mobile-barber-agent');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}
function assertEq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg ? msg + ': ' : '') + 'expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual));
  }
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function basePromo(overrides) {
  return Object.assign({
    id: 'promo-test-1',
    vendorId: DATA.MICHAEL_VENDOR_ID,
    name: 'Test Promo',
    description: '',
    discountPercent: 20,
    applyToScope: 'all',
    appliesToServiceIds: [],
    startDate: '',
    endDate: '',
    maxRedemptions: 0,
    currentRedemptions: 0,
    active: true,
    promoCode: '',
    displayOnCustomerPage: true,
    createdAt: '2026-05-27T00:00:00.000Z',
    updatedAt: '2026-05-27T00:00:00.000Z'
  }, overrides || {});
}

function vendorWith(promos) {
  var v = clone(DATA.findVendorById(DATA.MICHAEL_VENDOR_ID));
  v.promotions = promos;
  return v;
}

function classicService(vendor) {
  return DATA.listServicesForVendor(vendor.id).filter(function(s) {
    return s.name && s.name.toLowerCase().indexOf('classic') >= 0;
  })[0] || DATA.listServicesForVendor(vendor.id)[0];
}

function runMobileBarberPromotionsTests(test) {

  test('1. create active promo passes validatePromotion', function() {
    var p = basePromo();
    var r = DATA.validatePromotion(p);
    assertEq(r.valid, true, r.errors.join('; '));
  });

  test('1b. validatePromotion rejects discount < 1, > 90, endDate < startDate', function() {
    var tooLow = basePromo({ discountPercent: 0 });
    assertEq(DATA.validatePromotion(tooLow).valid, false);
    var tooHigh = basePromo({ discountPercent: 91 });
    assertEq(DATA.validatePromotion(tooHigh).valid, false);
    var reversed = basePromo({ startDate: '2026-06-10', endDate: '2026-06-01' });
    var r = DATA.validatePromotion(reversed);
    assertEq(r.valid, false);
    assert(r.errors.join(' ').indexOf('endDate') >= 0);
  });

  test('1c. validatePromotion requires services when scope=selected', function() {
    var r = DATA.validatePromotion(basePromo({ applyToScope: 'selected', appliesToServiceIds: [] }));
    assertEq(r.valid, false);
    assert(r.errors.join(' ').indexOf('appliesToServiceIds') >= 0);
  });

  test('2. expired promo does not apply', function() {
    var yesterday = '2020-01-01';
    var vendor = vendorWith([basePromo({ endDate: yesterday })]);
    var match = DATA.findActivePromotionForService(vendor, classicService(vendor), new Date());
    assertEq(match, null, 'expired promo must not match');
  });

  test('2b. promo before startDate does not apply', function() {
    var farFuture = '2099-01-01';
    var vendor = vendorWith([basePromo({ startDate: farFuture })]);
    var match = DATA.findActivePromotionForService(vendor, classicService(vendor), new Date());
    assertEq(match, null);
  });

  test('3. max redemption promo stops after limit reached', function() {
    var vendor = vendorWith([basePromo({ maxRedemptions: 5, currentRedemptions: 5 })]);
    var match = DATA.findActivePromotionForService(vendor, classicService(vendor), new Date());
    assertEq(match, null, 'should stop matching at max');

    // One slot remaining → matches
    var vendor2 = vendorWith([basePromo({ maxRedemptions: 5, currentRedemptions: 4 })]);
    var match2 = DATA.findActivePromotionForService(vendor2, classicService(vendor2), new Date());
    assert(match2, 'one slot left should still match');
  });

  test('4. selected-service promo only applies to whitelisted services', function() {
    var vendor = clone(DATA.findVendorById(DATA.MICHAEL_VENDOR_ID));
    var services = DATA.listServicesForVendor(vendor.id);
    var target = services[0], skip = services[1] || services[0];
    if (target.id === skip.id) return; // need >= 2 services to test
    vendor.promotions = [basePromo({ applyToScope: 'selected', appliesToServiceIds: [target.id] })];
    assert(DATA.findActivePromotionForService(vendor, target, new Date()), 'matches whitelisted service');
    assertEq(DATA.findActivePromotionForService(vendor, skip, new Date()), null, 'skips non-whitelisted');
  });

  test('5. all-service promo applies to every service', function() {
    var vendor = clone(DATA.findVendorById(DATA.MICHAEL_VENDOR_ID));
    vendor.promotions = [basePromo({ applyToScope: 'all', discountPercent: 15 })];
    var services = DATA.listServicesForVendor(vendor.id);
    services.forEach(function(s) {
      assert(DATA.findActivePromotionForService(vendor, s, new Date()), 'every service should match: ' + s.id);
    });
  });

  test('5b. multiple active promos: highest discount wins', function() {
    var vendor = vendorWith([
      basePromo({ id: 'p1', discountPercent: 10 }),
      basePromo({ id: 'p2', discountPercent: 30 }),
      basePromo({ id: 'p3', discountPercent: 5 })
    ]);
    var match = DATA.findActivePromotionForService(vendor, classicService(vendor), new Date());
    assertEq(match.id, 'p2', 'p2 has the highest discount');
  });

  test('6. applyPromotionToPrice returns correct discounted price', function() {
    var promo = basePromo({ discountPercent: 25 });
    var r = DATA.applyPromotionToPrice(80, promo);
    assertEq(r.discountPercent, 25);
    assertEq(r.originalPrice, 80);
    assertEq(r.discountedPrice, 60, '25% off $80 = $60');
  });

  test('6b. inactive promo returns no discount via applyPromotionToPrice', function() {
    var promo = basePromo({ discountPercent: 25, active: false });
    var r = DATA.applyPromotionToPrice(80, promo);
    assertEq(r.discountPercent, 0);
    assertEq(r.discountedPrice, 80);
  });

  test('6c. calculateMobileBarberPrice picks up vendor promo into total', function() {
    var vendor = vendorWith([basePromo({ discountPercent: 20 })]);
    var svc = classicService(vendor);
    var quote = BOOKING.calculateMobileBarberPrice({
      vendor: vendor,
      service: svc,
      customerAddress: { address: '123 Westminster Ave', city: 'Westminster', zip: '92683' },
      now: new Date()
    });
    assert(quote.promoApplied === true, 'promo should apply');
    assertEq(quote.discountPercent, 20);
    assert(quote.discountedPrice <= quote.originalPrice, 'discounted <= original');
    assertEq(quote.totalPrice, quote.discountedPrice, 'final totalPrice is discounted price');
  });

  test('6d. buildBooking persists promo fields onto the booking doc', function() {
    var vendor = vendorWith([basePromo({ discountPercent: 25, name: 'Father Day' })]);
    var svc = classicService(vendor);
    var draft = {
      customerName: 'Test',
      customerPhone: '7145550100',
      customerEmail: '',
      serviceId: svc.id,
      requestedDate: '2026-06-10',
      startTime: '10:00',
      address: '123 Westminster Ave',
      city: 'Westminster',
      zip: '92683',
      paymentMethod: 'cash'
    };
    var avail = BOOKING.checkAvailability({
      vendor: vendor, services: [svc], availability: DATA.sampleAvailability,
      draft: draft, existingBookings: [], now: new Date('2026-06-10T08:00:00-07:00')
    });
    if (!avail.canCreate) return;
    var built = BOOKING.buildBooking({ vendor: vendor, draft: draft, availabilityResult: avail, now: '2026-06-10T08:00:00.000Z', id: 'promo-test-booking' });
    assertEq(built.valid, true, (built.errors || []).join('; '));
    assertEq(built.booking.promoApplied, true);
    assertEq(built.booking.discountPercent, 25);
    assertEq(built.booking.promotionName, 'Father Day');
    assert(built.booking.discountedPrice <= built.booking.originalPrice);
    assertEq(built.booking.totalPrice, built.booking.discountedPrice);
    assertEq(built.booking.amountDue, built.booking.discountedPrice);
  });

  test('7. vendor portal renders promo chip on booking row (source pattern)', function() {
    var fs = require('fs');
    var path = require('path');
    var src = fs.readFileSync(path.join(__dirname, '../../mobile-barber/mobile-barber-dashboard.js'), 'utf8');
    assert(src.indexOf('mb-promo-chip') >= 0, 'promo chip class must be rendered');
    assert(src.indexOf('promoChipApplied') >= 0, 'promo chip uses i18n key');
    assert(src.indexOf('booking.promoApplied') >= 0, 'chip gated on booking.promoApplied');
  });

  test('8. AI agent prompt + saved reply mention active promo', function() {
    var fs = require('fs');
    var path = require('path');
    var src = fs.readFileSync(path.join(__dirname, '../../mobile-barber/mobile-barber-agent.js'), 'utf8');
    assert(src.indexOf('Active promotions') >= 0, 'buildPrompt must list active promos');
    assert(src.indexOf('promoApplied:') >= 0, 'saved reply key promoApplied must exist (en/vi/es)');
    assert(src.indexOf('availability.price.promoApplied') >= 0, 'agent must check promoApplied before prepending');
  });

  test('9. landing hero showcase collects + renders active promos as lead slide', function() {
    var fs = require('fs');
    var path = require('path');
    var src = fs.readFileSync(path.join(__dirname, '../../mobile-barber/mobile-barber.js'), 'utf8');
    assert(src.indexOf('collectActiveCustomerPromos') >= 0, 'helper exists');
    // The duplicate floating spotlight card was removed; promos now lead
    // the hero showcase rotation as a single integrated promo surface.
    assert(src.indexOf('renderHeroShowcase') >= 0, 'hero showcase renderer exists');
    assert(src.indexOf('renderHeroPromoSpotlight') < 0,
      'duplicate hero spotlight must stay removed');
    assert(src.indexOf('displayOnCustomerPage === false') >= 0, 'respects displayOnCustomerPage flag');
    var html = fs.readFileSync(path.join(__dirname, '../../mobile-barber/index.html'), 'utf8');
    assert(html.indexOf('id="mbHeroMedia"') >= 0,
      'hero media (which IS the showcase carousel) exists in landing HTML');
    assert(html.indexOf('id="mbHeroPromo"') < 0,
      'duplicate hero promo slot must stay removed');
    assert(html.indexOf('id="mbHeroShowcase"') < 0,
      'separate showcase strip removed — it is now merged into .mb-hero__media');
  });
}

if (require.main === module) {
  var passed = 0, failed = 0;
  runMobileBarberPromotionsTests(function(name, fn) {
    try { fn(); passed++; console.log('PASS', name); }
    catch (e) { failed++; console.log('FAIL', name); console.log(' ', e.message); }
  });
  console.log('Mobile Barber promotions tests:', passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

module.exports = { runMobileBarberPromotionsTests: runMobileBarberPromotionsTests };
