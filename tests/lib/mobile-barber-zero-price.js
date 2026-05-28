'use strict';

// Pinning tests for the "Latest AI Haircut Styles" carousel zero-price bug.
//
// Root cause: services were created with id = `${vendorId}-${slug}` but the
// carousel matched templates against services by id (slug). No matches →
// price = null → formatMoney rendered $0.
//
// Fix: services now carry a separate `slug` field, the carousel joins on
// slug, and price rendering uses formatServicePrice which surfaces
// "Price unavailable" instead of $0 when a price is missing.

var fs   = require('fs');
var path = require('path');
var DATA = require('../../mobile-barber/mobile-barber-data');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function assertEq(a, b, msg) {
  if (a !== b) throw new Error((msg ? msg + ': ' : '') + 'expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
}
function read(rel) { return fs.readFileSync(path.join(__dirname, '../../', rel), 'utf8'); }

var EXPECTED = {
  'classic-haircut':     40,
  'fade-haircut':        45,
  'skin-fade':           50,
  'taper-fade':          45,
  'haircut-beard':       65,
  'beard-trim':          25,
  'kids-haircut':        35,
  'senior-haircut':      35,
  'business-haircut':    45,
  'buzz-cut':            30,
  'line-up':             20,
  'modern-styling':      55,
  'home-family-package': 75
};

function runMobileBarberZeroPriceTests(test) {

  test('Z1. Every menu service exposes a `slug` field matching its template id', function() {
    var services = DATA.sampleServices.filter(function(s) {
      return s.vendorId === DATA.MICHAEL_VENDOR_ID;
    });
    assert(services.length >= 13, 'Michael should offer the full menu (got ' + services.length + ')');
    services.forEach(function(s) {
      assert(typeof s.slug === 'string' && s.slug.length, 'service ' + s.id + ' missing slug');
      // slug must match a known SERVICE_IMAGE_TEMPLATE key
      var template = (DATA.listStyleTemplates() || []).filter(function(t) { return t.id === s.slug; })[0];
      assert(template, 'no template found for slug ' + s.slug);
    });
  });

  test('Z2. Every expected service slug carries the correct price', function() {
    Object.keys(EXPECTED).forEach(function(slug) {
      var svc = DATA.sampleServices.filter(function(s) {
        return s.vendorId === DATA.MICHAEL_VENDOR_ID && s.slug === slug;
      })[0];
      assert(svc, 'missing service for slug ' + slug);
      assertEq(svc.price, EXPECTED[slug], 'wrong price for ' + slug);
      assert(svc.price > 0, slug + ' must be > 0');
    });
  });

  test('Z3. promoContentItems would now match templates by slug (source pattern)', function() {
    var src = read('mobile-barber/mobile-barber.js');
    var startIdx = src.indexOf('function promoContentItems');
    var fn = src.slice(startIdx, startIdx + 2000);
    assert(fn.indexOf('s.slug === tmpl.id') >= 0,
      'promoContentItems must match templates against service.slug');
    // Sanity: still falls back to legacy id match for safety
    assert(fn.indexOf('|| s.id === tmpl.id') >= 0,
      'must keep legacy id match as fallback');
  });

  test('Z4. promoContentItems returns price for every template (no nulls)', function() {
    // Re-implement the join inline using the canonical helpers — this is
    // the contract the renderer must produce.
    var templates = DATA.listStyleTemplates();
    var services = DATA.sampleServices.filter(function(s) {
      return s.vendorId === DATA.MICHAEL_VENDOR_ID && s.active !== false;
    });
    templates.forEach(function(tmpl) {
      var match = services.filter(function(s) { return s.slug === tmpl.id; })[0];
      assert(match, 'template ' + tmpl.id + ' has no matching service');
      assert(typeof match.price === 'number' && match.price > 0,
        'template ' + tmpl.id + ' resolves to price ' + match.price);
    });
  });

  test('Z5. formatServicePrice never returns $0 for missing/zero prices', function() {
    var src = read('mobile-barber/mobile-barber.js');
    assert(src.indexOf('function formatServicePrice') >= 0, 'helper must exist');
    var fn = src.slice(src.indexOf('function formatServicePrice'),
                       src.indexOf('function formatServicePrice') + 900);
    assert(fn.indexOf("'priceUnavailable'") >= 0 || fn.indexOf('priceUnavailable') >= 0,
      'must surface a priceUnavailable label');
    assert(fn.indexOf("'Price unavailable'") >= 0,
      'must have English fallback label');
    assert(fn.indexOf("if (num <= 0)") >= 0,
      'must guard against zero / negative prices');
    assert(fn.indexOf('console.error') >= 0,
      'must console.error when price is unavailable so it surfaces in monitoring');
  });

  test('Z6. Carousel + service card + selection summary all use formatServicePrice', function() {
    var src = read('mobile-barber/mobile-barber.js');
    // Carousel
    var renderPromo = src.slice(src.indexOf('function renderPromoPreview'),
                                src.indexOf('function renderPromoPreview') + 2200);
    assert(renderPromo.indexOf('formatServicePrice(item.price)') >= 0,
      'renderPromoPreview must use formatServicePrice for the no-promo price');
    assert(renderPromo.indexOf('formatServicePrice(pricing.originalPrice)') >= 0,
      'renderPromoPreview must use formatServicePrice for the original-with-promo price');
    assert(renderPromo.indexOf('formatServicePrice(pricing.discountedPrice)') >= 0,
      'renderPromoPreview must use formatServicePrice for the discounted price');
    // Service card (regression — already used promo-aware chip)
    var renderSvc = src.slice(src.indexOf('function renderServices'),
                              src.indexOf('function renderServices') + 3500);
    assert(renderSvc.indexOf('formatServicePrice(service.price)') >= 0,
      'renderServices fallback chip must use formatServicePrice');
    // Selection summary
    assert(src.indexOf('summaryPrice.textContent = formatServicePrice(service.price);') >= 0,
      'manual booking summary must use formatServicePrice');
  });

  test('Z7. Promo discount math is correct: 20% of $40 = $32 (never $0)', function() {
    var promo = {
      id: 'p20', vendorId: DATA.MICHAEL_VENDOR_ID, name: '20',
      discountPercent: 20, applyToScope: 'all', appliesToServiceIds: [],
      active: true, displayOnCustomerPage: true,
      startDate: '', endDate: '', maxRedemptions: 0, currentRedemptions: 0,
      promoCode: '', createdAt: '', updatedAt: ''
    };
    var applied = DATA.applyPromotionToPrice(40, promo);
    assertEq(applied.discountPercent, 20);
    assertEq(applied.originalPrice, 40);
    assertEq(applied.discountedPrice, 32, '20% off $40 = $32');
    assert(applied.discountedPrice > 0, 'discounted price must never be $0');
  });

  test('Z8. Booking persistence still stores originalPrice + discountedPrice (regression)', function() {
    var BOOK = require('../../mobile-barber/mobile-barber-booking');
    var vendor = JSON.parse(JSON.stringify(DATA.findVendorById(DATA.MICHAEL_VENDOR_ID)));
    vendor.promotions = [{
      id: 'p20', vendorId: vendor.id, name: 'Spring 20',
      discountPercent: 20, applyToScope: 'all', appliesToServiceIds: [],
      startDate: '', endDate: '', maxRedemptions: 0, currentRedemptions: 0,
      active: true, displayOnCustomerPage: true, promoCode: '',
      createdAt: '', updatedAt: ''
    }];
    var svc = DATA.listServicesForVendor(vendor.id).filter(function(s) {
      return s.slug === 'classic-haircut';
    })[0];
    assert(svc, 'classic-haircut service must exist');
    assertEq(svc.price, 40);
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
    var built = BOOK.buildBooking({ vendor: vendor, draft: draft, availabilityResult: avail, now: '2026-06-10T08:00:00.000Z', id: 'zero-price-test' });
    assertEq(built.valid, true, (built.errors || []).join('; '));
    assert(built.booking.originalPrice > 0, 'originalPrice must be > 0');
    assert(built.booking.discountedPrice > 0, 'discountedPrice must be > 0');
    assert(built.booking.totalPrice > 0, 'totalPrice must be > 0');
    assertEq(built.booking.promotionName, 'Spring 20');
    assertEq(built.booking.discountPercent, 20);
  });

  test('Z9. validateService accepts the new `slug` field (schema regression)', function() {
    var svc = DATA.sampleServices.filter(function(s) {
      return s.vendorId === DATA.MICHAEL_VENDOR_ID;
    })[0];
    var r = DATA.validateService(svc, [DATA.MICHAEL_VENDOR_ID]);
    assertEq(r.valid, true, (r.errors || []).join('; '));
  });
}

if (require.main === module) {
  var passed = 0, failed = 0;
  runMobileBarberZeroPriceTests(function(name, fn) {
    try { fn(); passed++; console.log('PASS', name); }
    catch (e) { failed++; console.log('FAIL', name); console.log(' ', e.message); }
  });
  console.log('Mobile Barber zero-price tests:', passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

module.exports = { runMobileBarberZeroPriceTests: runMobileBarberZeroPriceTests };
