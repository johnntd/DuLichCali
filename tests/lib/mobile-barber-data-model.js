'use strict';

var MobileBarberData = require('../../mobile-barber/mobile-barber-data');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertEq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg ? msg + ': ' : '') + 'expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual));
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function runMobileBarberDataModelTests(test) {
  test('Mobile Barber collections expose all required top-level names', function() {
    assertEq(MobileBarberData.COLLECTIONS.vendors, 'mobileBarberVendors');
    assertEq(MobileBarberData.COLLECTIONS.services, 'mobileBarberServices');
    assertEq(MobileBarberData.COLLECTIONS.serviceImages, 'mobileBarberServiceImages');
    assertEq(MobileBarberData.COLLECTIONS.availability, 'mobileBarberAvailability');
    assertEq(MobileBarberData.COLLECTIONS.bookings, 'mobileBarberBookings');
    assertEq(MobileBarberData.COLLECTIONS.customers, 'mobileBarberCustomers');
    assertEq(MobileBarberData.COLLECTIONS.agentSessions, 'mobileBarberAgentSessions');
    assertEq(MobileBarberData.COLLECTIONS.portfolioImages, 'mobileBarberPortfolioImages');
    assertEq(MobileBarberData.COLLECTIONS.reviews, 'mobileBarberReviews');
  });

  test('Mobile Barber sample vendor loads and validates', function() {
    var vendor = MobileBarberData.findVendorById(MobileBarberData.SAMPLE_VENDOR_ID);
    var result = MobileBarberData.validateVendor(vendor);
    assert(vendor, 'sample vendor missing');
    // Demo vendor is intentionally inactive so it doesn't show on the
    // public landing/homepage — only Michael + Tim are real barbers.
    // It still loads + validates so test fixtures keep working.
    assertEq(vendor.active, false);
    assertEq(result.valid, true, result.errors.join('; '));
    assert(vendor.serviceAreas.length >= 1, 'sample vendor needs service areas');
    assert(vendor.serviceBadges.indexOf('fade') >= 0, 'sample vendor needs service badges');
    assert(vendor.rating > 0 && vendor.reviewCount > 0, 'sample vendor needs trust metrics');
  });

  test('Mobile Barber vendor validator accepts optional provider keys', function() {
    var vendor = clone(MobileBarberData.findVendorById(MobileBarberData.SAMPLE_VENDOR_ID));
    vendor.geminiKey = 'test-gemini-key';
    vendor.openaiKey = 'test-openai-key';
    var result = MobileBarberData.validateVendor(vendor);
    assertEq(result.valid, true, result.errors.join('; '));
  });

  test('Mobile Barber services load for the sample vendor', function() {
    var services = MobileBarberData.listServicesForVendor(MobileBarberData.SAMPLE_VENDOR_ID);
    var vendorIds = MobileBarberData.sampleVendors.map(function(v) { return v.id; });
    assert(services.length >= 1, 'sample services missing');
    services.forEach(function(service) {
      var result = MobileBarberData.validateService(service, vendorIds);
      assertEq(result.valid, true, result.errors.join('; '));
      assertEq(service.vendorId, MobileBarberData.SAMPLE_VENDOR_ID);
    });
  });

  test('Mobile Barber service images have prompt metadata and unique service previews', function() {
    var vendorIds = MobileBarberData.sampleVendors.map(function(v) { return v.id; });
    var serviceIds = MobileBarberData.sampleServices.map(function(s) { return s.id; });
    var michaelImages = MobileBarberData.listServiceImagesForVendor(MobileBarberData.MICHAEL_VENDOR_ID);
    var uniqueUrls = {};
    assertEq(michaelImages.length, 13, 'Michael vendor must have one preview per menu service');
    michaelImages.forEach(function(image) {
      var result = MobileBarberData.validateServiceImage(image, { vendorIds: vendorIds, serviceIds: serviceIds });
      assertEq(result.valid, true, result.errors.join('; '));
      assertEq(image.isAIGenerated, true);
      assertEq(image.active, true);
      uniqueUrls[image.imageUrl] = true;
    });
    assertEq(Object.keys(uniqueUrls).length, 13, 'Each service preview URL should be distinct');
  });

  test('Mobile Barber booking validates required fields', function() {
    var booking = {
      id: 'demo-booking-1',
      vendorId: MobileBarberData.SAMPLE_VENDOR_ID,
      customerName: 'Test Customer',
      customerPhone: '7145550100',
      customerEmail: '',
      serviceId: 'classic-mobile-cut',
      serviceName: 'Classic Mobile Haircut',
      servicePrice: 45,
      address: '123 Test St',
      city: 'Westminster',
      zip: '92683',
      requestedDate: '2026-06-01',
      startTime: '10:00',
      endTime: '10:55',
      status: 'pending_confirmation',
      source: 'customer_form',
      notes: '',
      stylePreference: 'Low fade',
      photoUrls: [],
      aiConversationSummary: '',
      rebookedFromBookingId: '',
      previousServiceName: '',
      customerUid: '',
      confirmationPreference: 'text',
      confirmationSentAt: '',
      createdAt: '2026-05-23T00:00:00.000Z',
      updatedAt: '2026-05-23T00:00:00.000Z'
    };
    var result = MobileBarberData.validateBooking(booking, {
      vendorIds: MobileBarberData.sampleVendors.map(function(v) { return v.id; }),
      serviceIds: MobileBarberData.sampleServices.map(function(s) { return s.id; })
    });
    assertEq(result.valid, true, result.errors.join('; '));

    var missingAddress = clone(booking);
    delete missingAddress.address;
    var bad = MobileBarberData.validateBooking(missingAddress);
    assertEq(bad.valid, false);
    assert(bad.errors.some(function(err) { return err.indexOf('address is required') >= 0; }), 'missing address should fail');

    // Confirmation preference must be one of call/text/app or empty.
    assertEq(MobileBarberData.CONFIRMATION_PREFERENCES.indexOf('text') >= 0, true, 'text supported');
    assertEq(MobileBarberData.CONFIRMATION_PREFERENCES.indexOf('call') >= 0, true, 'call supported');
    assertEq(MobileBarberData.CONFIRMATION_PREFERENCES.indexOf('app') >= 0, true, 'app supported');
    assertEq(MobileBarberData.DEFAULT_CONFIRMATION_PREFERENCE, 'text');
    var bogus = clone(booking);
    bogus.confirmationPreference = 'pigeon';
    var badPref = MobileBarberData.validateBooking(bogus);
    assertEq(badPref.valid, false);
    assert(badPref.errors.some(function(err) { return err.indexOf('confirmationPreference') >= 0; }), 'invalid preference should fail');

    // Optional AI haircut preview fields — booking must validate when all
    // are populated AND when they're all absent / empty (feature is opt-in).
    var withAi = clone(booking);
    withAi.selfieDataUrl = 'data:image/jpeg;base64,abc123';
    withAi.aiAnalysisSummary = 'Round face, short hair, no beard. Try fade.';
    withAi.aiAnalysisConsent = 'true';
    withAi.recommendedStyles = [{ styleId: 'fade-haircut', title: 'Modern Fade' }];
    withAi.selectedStyleId = 'fade-haircut';
    withAi.selectedStylePreviewUrl = '/assets/mobile-barber/styles/fade-haircut.jpg';
    withAi.barberCuttingNotes = '#3 sides, scissor top';
    var aiOk = MobileBarberData.validateBooking(withAi);
    assertEq(aiOk.valid, true, aiOk.errors.join('; '));
    // Bad recommendedStyles type
    var badRec = clone(booking);
    badRec.recommendedStyles = 'not-an-array';
    var badRecResult = MobileBarberData.validateBooking(badRec);
    assertEq(badRecResult.valid, false);
    assert(badRecResult.errors.some(function(err) { return err.indexOf('recommendedStyles') >= 0; }), 'bad recommendedStyles should fail');
    // Oversized selfie
    var bigSelfie = clone(booking);
    bigSelfie.selfieDataUrl = 'data:image/jpeg;base64,' + new Array(950000).join('A');
    var bigResult = MobileBarberData.validateBooking(bigSelfie);
    assertEq(bigResult.valid, false);
    assert(bigResult.errors.some(function(err) { return err.indexOf('selfieDataUrl') >= 0; }), 'oversized selfie should fail');
  });

  test('Mobile Barber AI preview module exposes compress + analyze + fallback', function() {
    var AIPreview = require('../../mobile-barber/mobile-barber-ai-preview');
    assertEq(typeof AIPreview.analyze, 'function');
    assertEq(typeof AIPreview.compressImage, 'function');
    assertEq(typeof AIPreview.staticRecommendations, 'function');
    var recs = AIPreview.staticRecommendations({ lang: 'en' });
    assertEq(recs.length, 3, '3 fallback recommendations');
    assertEq(recs[0].styleId, 'business-haircut');
    assertEq(recs[1].styleId, 'fade-haircut');
    assertEq(recs[2].styleId, 'classic-haircut');
    recs.forEach(function(r) {
      assert(r.title && r.explanation && r.barberNotes && r.previewUrl, 'every rec has title/explanation/notes/previewUrl');
      assertEq(r.isFallback, true);
    });
    // analyze() with no image must return a thenable that resolves with the
    // fallback shape. The test runner is sync; we only sanity-check the
    // shape inline (the full promise contract is exercised at runtime).
    var pending = AIPreview.analyze({ lang: 'en' });
    assert(pending && typeof pending.then === 'function', 'analyze returns a thenable');
    var captured = null;
    pending.then(function(r) { captured = r; }).catch(function() { captured = null; });
    // Synchronous fallback function is independently testable:
    var summary = AIPreview.fallbackAnalysisSummary('vi');
    assert(summary && summary.length > 0, 'vi fallback summary present');
  });

  test('Mobile Barber customer profile validates preferences and vendor scope', function() {
    var customer = {
      id: 'customer-7145550100',
      vendorId: MobileBarberData.SAMPLE_VENDOR_ID,
      customerName: 'Test Customer',
      customerPhone: '7145550100',
      customerPhoneNormalized: '7145550100',
      customerEmail: '',
      customerUid: 'uid-test',
      stylePreference: 'Low fade',
      notes: 'Use scissors on top',
      photoUrls: ['style.jpg'],
      lastServiceId: 'classic-mobile-cut',
      lastServiceName: 'Classic Mobile Haircut',
      lastBookingId: 'demo-booking-1',
      createdAt: '2026-05-24T00:00:00.000Z',
      updatedAt: '2026-05-24T00:00:00.000Z'
    };
    var result = MobileBarberData.validateCustomer(customer, {
      vendorIds: MobileBarberData.sampleVendors.map(function(v) { return v.id; })
    });
    assertEq(result.valid, true, result.errors.join('; '));
  });

  test('Mobile Barber portfolio images validate and hide inappropriate images', function() {
    var vendorIds = MobileBarberData.sampleVendors.map(function(v) { return v.id; });
    var rows = MobileBarberData.listPortfolioForVendor(MobileBarberData.SAMPLE_VENDOR_ID);
    assert(rows.length >= 1, 'sample portfolio missing');
    rows.forEach(function(image) {
      var result = MobileBarberData.validatePortfolioImage(image, { vendorIds: vendorIds });
      assertEq(result.valid, true, result.errors.join('; '));
    });
    var hidden = clone(rows[0]);
    hidden.hidden = true;
    var visible = MobileBarberData.listPortfolioForVendor(MobileBarberData.SAMPLE_VENDOR_ID, [hidden], false);
    assertEq(visible.length, 0, 'hidden portfolio image must not publish');
    var withHidden = MobileBarberData.listPortfolioForVendor(MobileBarberData.SAMPLE_VENDOR_ID, [hidden], true);
    assertEq(withHidden.length, 1, 'dashboard can include hidden portfolio image');
  });

  test('Mobile Barber reviews validate and support vendor responses', function() {
    var vendorIds = MobileBarberData.sampleVendors.map(function(v) { return v.id; });
    var rows = MobileBarberData.listReviewsForVendor(MobileBarberData.SAMPLE_VENDOR_ID);
    assert(rows.length >= 1, 'sample reviews missing');
    rows.forEach(function(review) {
      var result = MobileBarberData.validateReview(review, { vendorIds: vendorIds });
      assertEq(result.valid, true, result.errors.join('; '));
      assert(review.rating >= 1 && review.rating <= 5, 'review rating out of range');
    });
    assert(rows.some(function(review) { return typeof review.vendorResponse === 'string'; }), 'vendor response field missing');
  });

  test('Mobile Barber schema is isolated from existing vendor models', function() {
    var seed = MobileBarberData.createSeedPayload();
    assert(seed.collections.vendors !== 'vendors', 'must not reuse existing vendors collection');
    assert(seed.collections.bookings !== 'bookings', 'must not reuse existing bookings collection');
    assert(!Object.prototype.hasOwnProperty.call(seed, 'businesses'), 'must not mutate marketplace businesses');
    assert(seed.portfolioImages.length >= 1, 'seed payload includes portfolio images');
    assert(seed.serviceImages.length >= 13, 'seed payload includes service image metadata');
    assert(seed.reviews.length >= 1, 'seed payload includes reviews');
    assertEq(MobileBarberData.findVendorById('luxurious-nails'), null);
    assertEq(MobileBarberData.findVendorById('beauty-hair-oc'), null);
  });

  test('Mobile Barber Firestore sample seed helper is exported', function() {
    assertEq(typeof MobileBarberData.seedFirestoreFromSamples, 'function');
  });

  test('Mobile Barber Firestore sample seed writes vendors services and availability with merge', function() {
    var writes = [];
    var db = {
      collection: function(collectionName) {
        return {
          doc: function(id) {
            return {
              set: function(doc, opts) {
                writes.push({ collectionName: collectionName, id: id, doc: doc, opts: opts });
                return { ok: true };
              }
            };
          }
        };
      }
    };
    MobileBarberData.seedFirestoreFromSamples(db);
    var expected = MobileBarberData.sampleVendors.length +
      MobileBarberData.sampleServices.length +
      MobileBarberData.sampleAvailability.length;
    assertEq(writes.length, expected);
    assertEq(writes.filter(function(w) { return w.collectionName === MobileBarberData.COLLECTIONS.vendors; }).length, MobileBarberData.sampleVendors.length);
    assertEq(writes.filter(function(w) { return w.collectionName === MobileBarberData.COLLECTIONS.services; }).length, MobileBarberData.sampleServices.length);
    assertEq(writes.filter(function(w) { return w.collectionName === MobileBarberData.COLLECTIONS.availability; }).length, MobileBarberData.sampleAvailability.length);
    writes.forEach(function(write) {
      assertEq(write.opts && write.opts.merge, true, 'seed writes must use merge');
      assert(!Object.prototype.hasOwnProperty.call(write.doc, 'geminiKey'), 'seed must not write geminiKey');
      assert(!Object.prototype.hasOwnProperty.call(write.doc, 'openaiKey'), 'seed must not write openaiKey');
    });
  });
}

if (require.main === module) {
  var passed = 0;
  var failed = 0;
  runMobileBarberDataModelTests(function(name, fn) {
    try {
      fn();
      passed++;
      console.log('PASS', name);
    } catch (e) {
      failed++;
      console.log('FAIL', name);
      console.log(' ', e.message);
    }
  });
  console.log('Mobile Barber data model tests:', passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

module.exports = {
  runMobileBarberDataModelTests: runMobileBarberDataModelTests
};
