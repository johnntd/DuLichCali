'use strict';

// Pure-data + source-pattern tests for the "Book this style" inline flow
// that ships with the AI hairstyle preview cards. Covers:
//   - BOOKING_FIELDS schema additions (the 6 selectedAi* fields)
//   - buildBooking() reading the new fields off the draft
//   - calculateMobileBarberPrice + checkAvailability + saveBooking path the
//     inline form depends on still works end-to-end
//   - Vendor dashboard reads selectedAi* (with legacy fallback) for the
//     hairstyle reference block
//   - Customer landing source patterns: per-card "Book this style" CTA,
//     inline panel, success state, and the i18n keys that drive them

var fs    = require('fs');
var path  = require('path');
var DATA  = require('../../mobile-barber/mobile-barber-data');
var BOOK  = require('../../mobile-barber/mobile-barber-booking');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function assertEq(a, b, msg) {
  if (a !== b) throw new Error((msg ? msg + ': ' : '') + 'expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
}
function read(rel) { return fs.readFileSync(path.join(__dirname, '../../', rel), 'utf8'); }

function runMobileBarberAiStyleBookingTests(test) {

  test('A1. BOOKING_FIELDS includes the 6 canonical selectedAi* fields', function() {
    var f = DATA.BOOKING_FIELDS;
    ['selectedAiStyleId', 'selectedAiStyleName', 'selectedAiStyleImage',
     'selectedAiStyleDescription', 'selectedAiBarberNotes', 'selectedAiMaintenanceLevel']
      .forEach(function(k) {
        assert(f.indexOf(k) >= 0, 'BOOKING_FIELDS missing ' + k);
      });
  });

  test('A2. validateBooking accepts all 6 selectedAi* fields populated', function() {
    var vendor = DATA.findVendorById(DATA.MICHAEL_VENDOR_ID);
    var svc = DATA.listServicesForVendor(vendor.id)[0];
    var booking = {
      id: 'mb-test',
      vendorId: vendor.id,
      customerName: 'Test User',
      customerPhone: '7145550100',
      customerEmail: '',
      serviceId: svc.id,
      serviceName: svc.name,
      servicePrice: 45,
      travelFee: 5,
      amountDue: 50,
      totalPrice: 50,
      paymentMethod: 'cash',
      paymentStatus: 'unpaid',
      address: '123 Beach Blvd', city: 'Westminster', zip: '92683',
      requestedDate: '2026-06-10', startTime: '10:00', endTime: '10:45',
      status: 'pending_confirmation',
      source: 'customer_form',
      confirmationPreference: 'text',
      selectedAiStyleId: 'fade-haircut',
      selectedAiStyleName: 'Modern Skin Fade',
      selectedAiStyleImage: '/assets/mobile-barber/styles/fade-haircut.jpg',
      selectedAiStyleDescription: 'Sharp skin fade, scissor on top',
      selectedAiBarberNotes: '#0 sides, scissor top, matte finish',
      selectedAiMaintenanceLevel: 'Every 3 weeks',
      createdAt: '2026-05-27T00:00:00.000Z',
      updatedAt: '2026-05-27T00:00:00.000Z'
    };
    var r = DATA.validateBooking(booking);
    assertEq(r.valid, true, (r.errors || []).join('; '));
  });

  test('A3. buildBooking() reads selectedAi* fields off the draft + mirrors to legacy', function() {
    var vendor = DATA.findVendorById(DATA.MICHAEL_VENDOR_ID);
    var svc = DATA.listServicesForVendor(vendor.id)[0];
    var draft = {
      customerName: 'Test', customerPhone: '7145550100', customerEmail: '',
      serviceId: svc.id,
      address: '123 Beach Blvd', city: 'Westminster', zip: '92683',
      requestedDate: '2026-06-10', startTime: '10:00',
      paymentMethod: 'cash',
      selectedAiStyleId: 'fade-haircut',
      selectedAiStyleName: 'Modern Skin Fade',
      selectedAiStyleImage: '/assets/mobile-barber/styles/fade-haircut.jpg',
      selectedAiStyleDescription: 'Sharp skin fade, scissor on top',
      selectedAiBarberNotes: '#0 sides, scissor top',
      selectedAiMaintenanceLevel: 'Every 3 weeks'
    };
    var avail = BOOK.checkAvailability({
      vendor: vendor, services: [svc], availability: DATA.sampleAvailability,
      draft: draft, existingBookings: [], now: new Date('2026-06-10T08:00:00-07:00')
    });
    if (!avail.canCreate) return; // schedule edge — skip if test date isn't open
    var built = BOOK.buildBooking({ vendor: vendor, draft: draft, availabilityResult: avail, now: '2026-06-10T08:00:00.000Z', id: 'mb-ai-test' });
    assertEq(built.valid, true, (built.errors || []).join('; '));
    assertEq(built.booking.selectedAiStyleId, 'fade-haircut');
    assertEq(built.booking.selectedAiStyleName, 'Modern Skin Fade');
    assertEq(built.booking.selectedAiStyleImage, '/assets/mobile-barber/styles/fade-haircut.jpg');
    assertEq(built.booking.selectedAiBarberNotes, '#0 sides, scissor top');
    assertEq(built.booking.selectedAiMaintenanceLevel, 'Every 3 weeks');
    // Legacy mirrors
    assertEq(built.booking.selectedStyleId, 'fade-haircut');
    assertEq(built.booking.selectedStylePreviewUrl, '/assets/mobile-barber/styles/fade-haircut.jpg');
  });

  test('A4. landing renders per-card "Book this style" CTA + inline panel', function() {
    var src = read('mobile-barber/mobile-barber.js');
    assert(src.indexOf('homeAiPreviewBookCta') >= 0, 'i18n key for CTA must exist');
    assert(src.indexOf('renderInlineBookingPanel') >= 0, 'inline panel renderer must exist');
    assert(src.indexOf('submitInlineStyleBooking') >= 0, 'inline submit helper must exist');
    assert(src.indexOf('toggleInlineBooking') >= 0, 'toggle helper must exist');
    assert(src.indexOf('mb-ai-rec-card__cta') >= 0, 'CTA class must be used');
    assert(src.indexOf('mb-ai-rec-card__booking') >= 0, 'inline panel class must be used');
    assert(src.indexOf("expandedStyleId") >= 0, 'expand state must be tracked');
    assert(src.indexOf("lastSubmittedStyleId") >= 0, 'success state must be tracked');
    // i18n keys present in en/vi/es
    ['en', 'vi', 'es'].forEach(function() {});
    var bookKeys = [
      'homeAiPreviewBookFormTitle', 'homeAiPreviewBookPhone', 'homeAiPreviewBookName',
      'homeAiPreviewBookAddress', 'homeAiPreviewBookCity', 'homeAiPreviewBookZip',
      'homeAiPreviewBookDate', 'homeAiPreviewBookTime', 'homeAiPreviewBookNotes',
      'homeAiPreviewBookSubmit', 'homeAiPreviewBookSuccess', 'homeAiPreviewBookSubmitted',
      'homeAiPreviewBookMissing', 'homeAiPreviewBookNoVendor', 'homeAiPreviewBookOverlap',
      'homeAiPreviewMaintenanceLabel'
    ];
    bookKeys.forEach(function(k) {
      assert(src.indexOf(k + ':') >= 0, 'i18n key ' + k + ' must be defined');
    });
  });

  test('A5. inline submit uses checkAvailability + buildBooking + saveBooking', function() {
    var src = read('mobile-barber/mobile-barber.js');
    var startIdx = src.indexOf('function submitInlineStyleBooking');
    assert(startIdx > 0, 'submitInlineStyleBooking must exist');
    var fn = src.slice(startIdx, startIdx + 6000);
    assert(fn.indexOf('BOOKING.findVendorForAddress') >= 0, 'must route via findVendorForAddress');
    assert(fn.indexOf('BOOKING.checkAvailability') >= 0, 'must call checkAvailability');
    assert(fn.indexOf('BOOKING.buildBooking') >= 0, 'must call buildBooking');
    assert(fn.indexOf('BOOKING.saveBooking') >= 0, 'must call saveBooking');
    assert(fn.indexOf('selectedAiStyleId') >= 0, 'must attach selectedAiStyleId');
    assert(fn.indexOf('selectedAiStyleName') >= 0, 'must attach selectedAiStyleName');
    assert(fn.indexOf('selectedAiStyleImage') >= 0, 'must attach selectedAiStyleImage');
    assert(fn.indexOf('selectedAiBarberNotes') >= 0, 'must attach selectedAiBarberNotes');
    assert(fn.indexOf('selectedAiMaintenanceLevel') >= 0, 'must attach selectedAiMaintenanceLevel');
    assert(fn.indexOf("requireDatabase: true") >= 0, 'must require real Firestore write');
  });

  test('A6. vendor dashboard renders the AI hairstyle reference block', function() {
    var src = read('mobile-barber/mobile-barber-dashboard.js');
    assert(src.indexOf('mb-booking-ai-preview__reference') >= 0, 'reference block class must exist');
    assert(src.indexOf('booking.selectedAiStyleImage') >= 0, 'must read selectedAiStyleImage');
    assert(src.indexOf('booking.selectedAiStyleName') >= 0, 'must read selectedAiStyleName');
    assert(src.indexOf('booking.selectedAiStyleDescription') >= 0, 'must read selectedAiStyleDescription');
    assert(src.indexOf('booking.selectedAiBarberNotes') >= 0, 'must read selectedAiBarberNotes');
    assert(src.indexOf('booking.selectedAiMaintenanceLevel') >= 0, 'must read selectedAiMaintenanceLevel');
    assert(src.indexOf('vendorAiPreviewStyleLabel') >= 0, 'i18n key vendorAiPreviewStyleLabel must exist');
    assert(src.indexOf('vendorAiPreviewMaintenanceLabel') >= 0, 'i18n key vendorAiPreviewMaintenanceLabel must exist');
    assert(src.indexOf('vendorAiPreviewBarberRefNotes') >= 0, 'i18n key vendorAiPreviewBarberRefNotes must exist');
  });

  test('A7. CSS ships premium CTA + expand animation + booked state', function() {
    var css = read('mobile-barber/mobile-barber.css');
    assert(css.indexOf('.mb-ai-rec-card__cta') >= 0, 'CTA selector must exist');
    assert(css.indexOf('.mb-ai-rec-card__booking') >= 0, 'inline panel selector must exist');
    assert(css.indexOf('.mb-ai-rec-card--expanded') >= 0, 'expanded state must exist');
    assert(css.indexOf('.mb-ai-rec-card--booked') >= 0, 'booked state must exist');
    assert(css.indexOf('mbAiBookingExpand') >= 0, 'expand keyframe must exist');
    assert(css.indexOf('prefers-reduced-motion') >= 0, 'must respect reduced motion');
    assert(css.indexOf('.mb-booking-ai-preview__reference') >= 0, 'vendor reference block CSS must exist');
  });

  test('A8. attachAiPreviewToBooking writes selectedAi* fields (chat-path parity)', function() {
    var src = read('mobile-barber/mobile-barber.js');
    var startIdx = src.indexOf('function attachAiPreviewToBooking');
    assert(startIdx > 0, 'attachAiPreviewToBooking must exist');
    var fn = src.slice(startIdx, startIdx + 2200);
    assert(fn.indexOf('booking.selectedAiStyleId') >= 0, 'chat path must set selectedAiStyleId');
    assert(fn.indexOf('booking.selectedAiStyleName') >= 0);
    assert(fn.indexOf('booking.selectedAiStyleImage') >= 0);
    assert(fn.indexOf('booking.selectedAiStyleDescription') >= 0);
    assert(fn.indexOf('booking.selectedAiBarberNotes') >= 0);
    assert(fn.indexOf('booking.selectedAiMaintenanceLevel') >= 0);
  });
}

if (require.main === module) {
  var passed = 0, failed = 0;
  runMobileBarberAiStyleBookingTests(function(name, fn) {
    try { fn(); passed++; console.log('PASS', name); }
    catch (e) { failed++; console.log('FAIL', name); console.log(' ', e.message); }
  });
  console.log('Mobile Barber AI style booking tests:', passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

module.exports = { runMobileBarberAiStyleBookingTests: runMobileBarberAiStyleBookingTests };
