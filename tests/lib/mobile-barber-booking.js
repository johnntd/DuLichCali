'use strict';

var fs = require('fs');
var path = require('path');
var MobileBarberData = require('../../mobile-barber/mobile-barber-data');
var MobileBarberBooking = require('../../mobile-barber/mobile-barber-booking');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertEq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg ? msg + ': ' : '') + 'expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual));
  }
}

function baseDraft() {
  return {
    customerName: 'Test Customer',
    customerPhone: '714-555-0100',
    customerEmail: '',
    smsOptIn: false,
    serviceId: 'michael-nguyen-oc-classic-haircut',
    requestedDate: '2026-06-01',
    startTime: '10:00',
    address: '123 Test St',
    city: 'Westminster',
    zip: '92683',
    notes: '',
    photoUrls: []
  };
}

function sampleBuiltBooking(id) {
  var draft = baseDraft();
  var result = check(draft);
  var built = MobileBarberBooking.buildBooking({
    id: id || 'save-source-test',
    now: '2026-05-24T00:00:00.000Z',
    vendor: MobileBarberData.findVendorById(MobileBarberData.MICHAEL_VENDOR_ID),
    draft: draft,
    availabilityResult: result
  });
  if (!built.valid) throw new Error('sample booking failed to build: ' + built.errors.join('; '));
  return built.booking;
}

// Fixture bookings sit on 2026-06-01; pin "now" a week earlier by default so the
// same-day cutoff never fires (and tests are deterministic regardless of the real
// calendar date). Individual tests can still override with extra.now.
// Must be a Date — checkSameDayCutoff ignores a string `now` and uses the real
// clock, which would make these fixtures fail once the calendar reaches 2026-06-01.
var FIXTURE_NOW = new Date('2026-05-24T00:00:00.000Z');

function check(draft, existingBookings, extra) {
  extra = extra || {};
  return MobileBarberBooking.checkAvailability({
    vendor: MobileBarberData.findVendorById(MobileBarberData.MICHAEL_VENDOR_ID),
    services: MobileBarberData.listServicesForVendor(MobileBarberData.MICHAEL_VENDOR_ID),
    availability: MobileBarberData.sampleAvailability,
    draft: draft,
    existingBookings: existingBookings || [],
    unavailableBlocks: extra.unavailableBlocks || [],
    now: extra.now || FIXTURE_NOW
  });
}

function checkVendor(vendorId, draft, existingBookings, extra) {
  extra = extra || {};
  return MobileBarberBooking.checkAvailability({
    vendor: MobileBarberData.findVendorById(vendorId),
    services: MobileBarberData.listServicesForVendor(vendorId),
    availability: MobileBarberData.sampleAvailability,
    draft: draft,
    existingBookings: existingBookings || [],
    unavailableBlocks: extra.unavailableBlocks || [],
    now: extra.now || FIXTURE_NOW
  });
}

function runMobileBarberBookingTests(test) {
  test('Mobile Barber address lookup routes covered cities to the matching vendor', function() {
    var sanJose = MobileBarberBooking.findVendorForAddress({ city: 'San Jose' }, {
      vendors: MobileBarberData.sampleVendors
    });
    var westminster = MobileBarberBooking.findVendorForAddress({ city: 'Westminster' }, {
      vendors: MobileBarberData.sampleVendors
    });
    var boston = MobileBarberBooking.findVendorForAddress({ city: 'Boston' }, {
      vendors: MobileBarberData.sampleVendors
    });
    assertEq(sanJose && sanJose.id, MobileBarberData.TIM_VENDOR_ID);
    assertEq(westminster && westminster.id, MobileBarberData.MICHAEL_VENDOR_ID);
    assertEq(boston, null);
  });

  test('Mobile Barber manual booking blocks missing phone and address', function() {
    var missingPhone = baseDraft();
    missingPhone.customerPhone = '';
    var result = check(missingPhone);
    assertEq(result.canCreate, false);
    assert(result.errors.indexOf('missing_phone') >= 0, 'missing phone should block booking');

    var missingAddress = baseDraft();
    missingAddress.address = '';
    result = check(missingAddress);
    assertEq(result.canCreate, false);
    assert(result.errors.indexOf('missing_address') >= 0, 'missing address should block booking');
  });

  test('Mobile Barber manual booking loads service duration and buffers before estimate', function() {
    var result = check(baseDraft());
    assertEq(result.canCreate, true);
    assertEq(result.timing.serviceMinutes, 45);
    assertEq(result.timing.cleanupMinutes, 10);
    assertEq(result.timing.travelMinutes, 20);
    assertEq(result.timing.totalMinutes, 75);
    assertEq(result.timing.endTime, '11:15');
    assertEq(result.price.totalPrice, 50);
  });

  test('Mobile Barber manual booking blocks double booking overlap', function() {
    var result = check(baseDraft(), [{
      id: 'existing-1',
      vendorId: MobileBarberData.MICHAEL_VENDOR_ID,
      requestedDate: '2026-06-01',
      startTime: '10:30',
      endTime: '11:00',
      status: 'confirmed'
    }]);
    assertEq(result.canCreate, false);
    assertEq(result.key, 'booking_overlap');
  });

  test('Mobile Barber manual booking allows back-to-back appointment', function() {
    var result = check(baseDraft(), [{
      id: 'existing-2',
      vendorId: MobileBarberData.MICHAEL_VENDOR_ID,
      requestedDate: '2026-06-01',
      startTime: '11:15',
      endTime: '12:00',
      status: 'confirmed'
    }]);
    assertEq(result.canCreate, true);
  });

  test('Mobile Barber back-to-back check includes cleanup buffer', function() {
    var result = check(baseDraft(), [{
      id: 'existing-cleanup',
      vendorId: MobileBarberData.MICHAEL_VENDOR_ID,
      requestedDate: '2026-06-01',
      startTime: '10:50',
      endTime: '11:30',
      status: 'confirmed'
    }]);
    assertEq(result.canCreate, false);
    assertEq(result.key, 'booking_overlap');
  });

  test('Mobile Barber travel buffer blocks appointments between service locations', function() {
    var result = check(baseDraft(), [{
      id: 'existing-travel',
      vendorId: MobileBarberData.MICHAEL_VENDOR_ID,
      requestedDate: '2026-06-01',
      startTime: '11:00',
      endTime: '11:45',
      status: 'confirmed'
    }]);
    assertEq(result.canCreate, false);
    assertEq(result.key, 'booking_overlap');
  });

  test('Mobile Barber blocks outside working hours and unavailable days', function() {
    var early = baseDraft();
    early.startTime = '08:30';
    var result = check(early);
    assertEq(result.canCreate, false);
    assertEq(result.key, 'outside_hours');

    var sunday = baseDraft();
    sunday.requestedDate = '2026-06-07';
    result = check(sunday);
    assertEq(result.canCreate, false);
    assertEq(result.key, 'closed_day');
  });

  test('Mobile Barber blocks unavailable date/time blocks', function() {
    var result = check(baseDraft(), [], {
      unavailableBlocks: [{
        id: 'block-lunch',
        vendorId: MobileBarberData.MICHAEL_VENDOR_ID,
        date: '2026-06-01',
        startTime: '10:30',
        endTime: '12:00',
        reason: 'Personal block'
      }]
    });
    assertEq(result.canCreate, false);
    assertEq(result.key, 'unavailable_block');
  });

  test('Mobile Barber enforces same-day booking cutoff', function() {
    var draft = baseDraft();
    draft.requestedDate = '2026-06-01';
    draft.startTime = '10:00';
    var result = check(draft, [], { now: new Date('2026-06-01T09:00:00') });
    assertEq(result.canCreate, false);
    assertEq(result.key, 'same_day_cutoff');
  });

  test('Mobile Barber rejects out-of-service-area address (strict)', function() {
    var draft = baseDraft();
    draft.city = 'San Jose';
    draft.zip = '95121';
    var result = check(draft);
    assertEq(result.canCreate, false);
    assertEq(result.key, 'service_area_out_of_range');
    assertEq(result.reviewRequired, false);
  });

  test('Mobile Barber service-area helper rejects out-of-area address', function() {
    var vendor = MobileBarberData.findVendorById(MobileBarberData.MICHAEL_VENDOR_ID);
    assertEq(MobileBarberBooking.isWithinServiceArea(vendor, { city: 'Westminster', zip: '92683' }), true);
    assertEq(MobileBarberBooking.isWithinServiceArea(vendor, { city: 'San Jose', zip: '95121' }), false);
  });

  test('Mobile Barber named Phase 8 helpers calculate windows and price', function() {
    var vendor = MobileBarberData.findVendorById(MobileBarberData.MICHAEL_VENDOR_ID);
    var service = MobileBarberData.listServicesForVendor(MobileBarberData.MICHAEL_VENDOR_ID)[0];
    var window = MobileBarberBooking.calculateAppointmentWindow(service, { requestedDate: '2026-06-01', startTime: '10:00' }, vendor);
    var price = MobileBarberBooking.calculateMobileBarberPrice(vendor, service, { city: 'Westminster', zip: '92683' });
    assertEq(window.endTime, '11:15');
    assertEq(window.totalMinutes, 75);
    assertEq(price.totalPrice, 50);
    assertEq(price.reviewRequired, false);
  });

  test('Mobile Barber profit pricing tiers include travel, wear, minimums, and custom quote', function() {
    var vendor = Object.assign({}, MobileBarberData.findVendorById(MobileBarberData.MICHAEL_VENDOR_ID), {
      baseTravelFee: 0,
      travelFeeTiers: null
    });
    var service = MobileBarberData.listServicesForVendor(MobileBarberData.MICHAEL_VENDOR_ID).filter(function(row) {
      return row.id.indexOf('fade-haircut') >= 0;
    })[0];
    var p3 = MobileBarberBooking.calculateMobileBarberPrice({ vendor: vendor, service: service, distanceMiles: 3, travelMinutes: 20 });
    var p8 = MobileBarberBooking.calculateMobileBarberPrice({ vendor: vendor, service: service, distanceMiles: 8, travelMinutes: 20 });
    var p14 = MobileBarberBooking.calculateMobileBarberPrice({ vendor: vendor, service: service, distanceMiles: 14, travelMinutes: 25 });
    var p19 = MobileBarberBooking.calculateMobileBarberPrice({ vendor: vendor, service: service, distanceMiles: 19, travelMinutes: 30 });
    var p25 = MobileBarberBooking.calculateMobileBarberPrice({ vendor: vendor, service: service, distanceMiles: 25, travelMinutes: 40 });
    assertEq(p3.travelFee, 0);
    assertEq(p3.totalPrice, 50);
    assertEq(p8.travelFee, 8);
    assertEq(p14.travelFee, 15);
    assertEq(p19.travelFee, 25);
    assertEq(p25.quoteType, 'vendor_review');
    assert(p14.vehicleWearCost > 0, 'vehicle wear cost should be estimated');
    assert(p19.pricingExplanation.indexOf('payment due after service') >= 0, 'pricing explanation should be customer safe');
  });

  test('Mobile Barber booking saves complete pricing and payment fields', function() {
    var vendor = MobileBarberData.findVendorById(MobileBarberData.MICHAEL_VENDOR_ID);
    var service = MobileBarberData.listServicesForVendor(MobileBarberData.MICHAEL_VENDOR_ID)[0];
    var draft = Object.assign(baseDraft(), {
      serviceId: service.id,
      city: 'Westminster',
      zip: '92683',
      distanceMiles: 8,
      paymentMethod: 'zelle'
    });
    var availability = MobileBarberBooking.checkAvailability({
      vendor: vendor,
      services: MobileBarberData.listServicesForVendor(vendor.id),
      availability: MobileBarberData.sampleAvailability,
      draft: draft,
      existingBookings: [],
      now: FIXTURE_NOW
    });
    var built = MobileBarberBooking.buildBooking({
      id: 'pricing-fields-test',
      vendor: vendor,
      draft: draft,
      availabilityResult: availability,
      now: '2026-05-25T12:00:00.000Z'
    });
    assertEq(built.valid, true);
    assertEq(built.booking.amountDue, built.booking.totalPrice);
    assert(built.booking.travelFee >= 0, 'travel fee should be saved');
    assert(built.booking.vehicleWearCost >= 0, 'vehicle wear should be saved');
    assertEq(built.booking.paymentStatus, 'unpaid');
    assertEq(built.booking.zellePhone, vendor.phone);
    assert(built.booking.pricingExplanation.indexOf('Service price') >= 0, 'pricing explanation should be saved');
  });

  test('Mobile Barber 12-hour time formatter normalizes appointment display', function() {
    assertEq(MobileBarberBooking.formatTime12Hour('09:00'), '9:00 AM');
    assertEq(MobileBarberBooking.formatTime12Hour('10:30'), '10:30 AM');
    assertEq(MobileBarberBooking.formatTime12Hour('14:15'), '2:15 PM');
  });

  test('Mobile Barber raw window availability detects overlap', function() {
    var result = MobileBarberBooking.checkMobileBarberAvailability(
      MobileBarberData.MICHAEL_VENDOR_ID,
      '2026-06-01T10:00:00',
      '2026-06-01T11:15:00',
      {
        now: FIXTURE_NOW,
        existingBookings: [{
          id: 'existing-window',
          vendorId: MobileBarberData.MICHAEL_VENDOR_ID,
          requestedDate: '2026-06-01',
          startTime: '10:30',
          endTime: '11:00',
          status: 'confirmed'
        }]
      }
    );
    assertEq(result.available, false);
    assertEq(result.key, 'booking_overlap');
  });

  test('Mobile Barber suggests next available slots', function() {
    var slots = MobileBarberBooking.findNextAvailableSlots(
      MobileBarberData.MICHAEL_VENDOR_ID,
      'michael-nguyen-oc-classic-haircut',
      { start: '2026-06-01', end: '2026-06-01' },
      {
        limit: 3,
        now: FIXTURE_NOW,
        existingBookings: [{
          id: 'existing-first',
          vendorId: MobileBarberData.MICHAEL_VENDOR_ID,
          requestedDate: '2026-06-01',
          startTime: '10:00',
          endTime: '11:15',
          status: 'confirmed'
        }]
      }
    );
    assertEq(slots.length, 3);
    assertEq(slots[0].startTime, '11:30');
    assertEq(slots[0].endTime, '12:45');
  });

  test('Mobile Barber cannot build booking without availability check', function() {
    var built = MobileBarberBooking.buildBooking({
      vendor: MobileBarberData.findVendorById(MobileBarberData.MICHAEL_VENDOR_ID),
      draft: baseDraft(),
      availabilityResult: null
    });
    assertEq(built.valid, false);
    assert(built.errors.indexOf('availability_check_required') >= 0, 'must require availability check');
  });

  test('Mobile Barber builds pending booking only after availability check', function() {
    var draft = baseDraft();
    draft.smsOptIn = true;
    var result = check(draft);
    var built = MobileBarberBooking.buildBooking({
      id: 'manual-ok-1',
      now: '2026-05-23T00:00:00.000Z',
      vendor: MobileBarberData.findVendorById(MobileBarberData.MICHAEL_VENDOR_ID),
      draft: draft,
      availabilityResult: result
    });
    assertEq(built.valid, true, built.errors && built.errors.join('; '));
    assertEq(built.booking.status, 'pending_barber_confirmation');
    assertEq(built.booking.smsOptIn, true);
    assertEq(built.booking.source, 'customer_form');
    assertEq(built.booking.endTime, '11:15');
    assertEq(built.booking.servicePrice, 40);
    assertEq(built.booking.travelFee, 0);
    assertEq(built.booking.amountDue, 50);
    assertEq(built.booking.paymentMethod, 'cash');
    assertEq(built.booking.paymentStatus, 'unpaid');
    assertEq(built.booking.zellePhone, '(714) 227-6007');
    assertEq(built.booking.selectedHaircutSource, 'service_list');
    assertEq(built.booking.selectedHaircutTitle, 'Classic Haircut');
    assert(built.booking.selectedHaircutImageUrl.indexOf('/assets/mobile-barber/styles/classic-haircut.jpg') >= 0,
      'service-list booking must carry the selected haircut image');
    assert(built.booking.selectedHaircutPromptSnapshot,
      'service-list booking should preserve the service image prompt as barber reference context');
  });

  test('Mobile Barber repeated submits use the same idempotency key and document id', function() {
    var draft = baseDraft();
    var result = check(draft);
    var vendor = MobileBarberData.findVendorById(MobileBarberData.MICHAEL_VENDOR_ID);
    var first = MobileBarberBooking.buildBooking({
      now: '2026-05-30T00:00:00.000Z',
      vendor: vendor,
      draft: draft,
      availabilityResult: result
    });
    var second = MobileBarberBooking.buildBooking({
      now: '2026-05-30T00:00:01.000Z',
      vendor: vendor,
      draft: Object.assign({}, draft),
      availabilityResult: result
    });
    assertEq(first.valid, true, first.errors && first.errors.join('; '));
    assertEq(second.valid, true, second.errors && second.errors.join('; '));
    assert(first.booking.id.indexOf('mb-') === 0, 'generated booking id must keep mobile barber prefix');
    assertEq(first.booking.id, second.booking.id, 'same request must target the same Firestore doc');
    assertEq(first.booking.bookingRequestId, second.booking.bookingRequestId, 'same request must carry same idempotency key');
  });

  test('Mobile Barber explicit bookingRequestId is honored for stronger client idempotency', function() {
    var draft = Object.assign(baseDraft(), {
      bookingRequestId: 'client-req-4085550199-michael-20260601-1000'
    });
    var result = check(draft);
    var built = MobileBarberBooking.buildBooking({
      now: '2026-05-30T00:00:00.000Z',
      vendor: MobileBarberData.findVendorById(MobileBarberData.MICHAEL_VENDOR_ID),
      draft: draft,
      availabilityResult: result
    });
    assertEq(built.valid, true, built.errors && built.errors.join('; '));
    assertEq(built.booking.id, 'mb-client-req-4085550199-michael-20260601-1000');
    assertEq(built.booking.bookingRequestId, 'client-req-4085550199-michael-20260601-1000');
  });

  test('Mobile Barber AI-generated booking carries durable haircut reference fields', function() {
    var vendor = MobileBarberData.findVendorById(MobileBarberData.MICHAEL_VENDOR_ID);
    var draft = Object.assign(baseDraft(), {
      selectedAiStyleId: 'ai-style-1',
      selectedAiStyleName: 'Low Taper AI Preview',
      selectedAiStyleImage: 'data:image/jpeg;base64,abc123',
      selectedAiStyleDescription: 'Low taper with textured top.',
      selectedAiBarberNotes: 'Keep bulk on top; low taper around ears.',
      selectedAiMaintenanceLevel: 'Every 3 weeks',
      selectedHaircutPromptSnapshot: 'customer requested low taper preview',
      aiAnalysisConsent: 'true',
      selfieDataUrl: 'data:image/jpeg;base64,selfie123'
    });
    var result = check(draft);
    var built = MobileBarberBooking.buildBooking({
      id: 'haircut-ref-ai',
      now: '2026-06-01T08:00:00.000Z',
      vendor: vendor,
      draft: draft,
      availabilityResult: result
    });
    assertEq(built.valid, true, built.errors && built.errors.join('; '));
    assertEq(built.booking.selectedHaircutSource, 'ai_generated');
    assertEq(built.booking.selectedHaircutTitle, 'Low Taper AI Preview');
    assertEq(built.booking.selectedHaircutImageUrl, 'data:image/jpeg;base64,abc123');
    assertEq(built.booking.selectedHaircutPromptSnapshot, 'customer requested low taper preview');
    assertEq(built.booking.customerSelfieUrl, 'data:image/jpeg;base64,selfie123');
  });

  test('Mobile Barber in-progress bookings block overlapping slots', function() {
    var draft = baseDraft();
    var result = check(draft, [{
      id: 'in-progress-1',
      vendorId: MobileBarberData.MICHAEL_VENDOR_ID,
      requestedDate: draft.requestedDate,
      startTime: '10:15',
      endTime: '10:45',
      status: 'in_progress'
    }]);
    assertEq(result.canCreate, false);
    assertEq(result.key, 'booking_overlap');
  });

  test('Mobile Barber manual booking stores cash and Zelle payment preferences from vendor phone', function() {
    ['cash', 'zelle', ''].forEach(function(method) {
      var draft = baseDraft();
      draft.paymentMethod = method;
      var result = check(draft);
      var built = MobileBarberBooking.buildBooking({
        id: 'payment-' + (method || 'cash'),
        now: '2026-05-25T00:00:00.000Z',
        vendor: MobileBarberData.findVendorById(MobileBarberData.MICHAEL_VENDOR_ID),
        draft: draft,
        availabilityResult: result
      });
      assertEq(built.valid, true, built.errors && built.errors.join('; '));
      assertEq(built.booking.paymentMethod, method || 'cash');
      assertEq(built.booking.paymentStatus, 'unpaid');
      assertEq(built.booking.zellePhone, '(714) 227-6007');
      assertEq(built.booking.amountDue, built.booking.totalPrice);
    });
  });

  test('Mobile Barber status lifecycle normalizes legacy statuses', function() {
    assertEq(MobileBarberBooking.normalizeBookingStatus('pending_confirmation'), 'pending_barber_confirmation');
    assertEq(MobileBarberBooking.normalizeBookingStatus('vendor_review'), 'vendor_review');
    assertEq(MobileBarberBooking.normalizeBookingStatus('confirmed'), 'confirmed');
    assertEq(MobileBarberBooking.normalizeBookingStatus('unknown'), 'pending_barber_confirmation');
  });

  test('Mobile Barber manual booking works for Michael and Tim vendor data', function() {
    [
      {
        vendorId: MobileBarberData.MICHAEL_VENDOR_ID,
        draft: Object.assign(baseDraft(), {
          serviceId: MobileBarberData.MICHAEL_VENDOR_ID + '-classic-haircut',
          city: 'Westminster',
          zip: '92683',
          requestedDate: '2026-06-01',
          startTime: '10:00'
        })
      },
      {
        vendorId: MobileBarberData.TIM_VENDOR_ID,
        draft: Object.assign(baseDraft(), {
          serviceId: MobileBarberData.TIM_VENDOR_ID + '-classic-haircut',
          city: 'San Jose',
          zip: '95112',
          requestedDate: '2026-06-01',
          startTime: '10:00'
        })
      }
    ].forEach(function(row) {
      var vendor = MobileBarberData.findVendorById(row.vendorId);
      var result = checkVendor(row.vendorId, row.draft);
      assertEq(result.canCreate, true, row.vendorId + ' availability must pass');
      var built = MobileBarberBooking.buildBooking({
        id: row.vendorId + '-manual-ok',
        now: '2026-05-25T00:00:00.000Z',
        vendor: vendor,
        draft: row.draft,
        availabilityResult: result
      });
      assertEq(built.valid, true, row.vendorId + ' booking must build after availability');
      assertEq(built.booking.vendorId, row.vendorId);
      assertEq(built.booking.source, 'customer_form');
      assertEq(built.booking.zellePhone, vendor.phone);
    });
  });

  test('Mobile Barber confirm booking calls create/write path after availability', function() {
    var originalFirebase = global.firebase;
    var writes = [];
    global.firebase = {
      apps: [{}],
      firestore: function() {
        return {
          collection: function(collectionName) {
            return {
              doc: function(id) {
                return {
                  set: function(doc) {
                    writes.push({ collectionName: collectionName, id: id, doc: doc });
                    return {
                      then: function(cb) {
                        var value = cb();
                        return { catch: function() { return value; } };
                      }
                    };
                  }
                };
              }
            };
          }
        };
      }
    };
    try {
      var booking = sampleBuiltBooking('manual-create-path-1');
      var saved = MobileBarberBooking.saveBooking(booking, { requireDatabase: true });
      assertEq(saved.source, 'firestore');
      assertEq(writes.length, 1);
      assertEq(writes[0].id, booking.id);
      assertEq(writes[0].doc.source, 'customer_form');
    } finally {
      global.firebase = originalFirebase;
    }
  });

  test('Mobile Barber customer history filters by vendor and phone', function() {
    var rows = MobileBarberBooking.filterCustomerBookings([
      { id: 'a', vendorId: MobileBarberData.MICHAEL_VENDOR_ID, customerPhone: '(714) 555-0100', requestedDate: '2026-06-01', startTime: '10:00' },
      { id: 'b', vendorId: 'other-vendor', customerPhone: '7145550100', requestedDate: '2026-06-02', startTime: '10:00' },
      { id: 'c', vendorId: MobileBarberData.MICHAEL_VENDOR_ID, customerPhone: '9995550100', requestedDate: '2026-06-03', startTime: '10:00' }
    ], MobileBarberData.MICHAEL_VENDOR_ID, { phone: '714-555-0100' });
    assertEq(rows.length, 1);
    assertEq(rows[0].id, 'a');
  });

  test('Mobile Barber customer history separates upcoming and past bookings', function() {
    var history = MobileBarberBooking.splitCustomerBookingHistory([
      { id: 'past', vendorId: MobileBarberData.MICHAEL_VENDOR_ID, customerPhone: '7145550100', requestedDate: '2026-05-20', startTime: '10:00', status: 'completed' },
      { id: 'future', vendorId: MobileBarberData.MICHAEL_VENDOR_ID, customerPhone: '7145550100', requestedDate: '2026-06-01', startTime: '10:00', status: 'confirmed' }
    ], MobileBarberData.MICHAEL_VENDOR_ID, { phone: '7145550100' }, new Date('2026-05-24T09:00:00'));
    assertEq(history.past.length, 1);
    assertEq(history.upcoming.length, 1);
    assertEq(history.upcoming[0].id, 'future');
  });

  test('Mobile Barber rebook draft preserves service and requires a new validated date/time', function() {
    var draft = MobileBarberBooking.buildRebookDraft({
      id: 'old-booking',
      vendorId: MobileBarberData.MICHAEL_VENDOR_ID,
      customerName: 'Test Customer',
      customerPhone: '7145550100',
      serviceId: 'michael-nguyen-oc-classic-haircut',
      serviceName: 'Classic Haircut',
      address: '123 Test St',
      city: 'Westminster',
      zip: '92683',
      notes: 'Low fade',
      stylePreference: 'Low fade'
    }, { stylePreference: 'Low fade, no hard part' });
    assertEq(draft.serviceId, 'michael-nguyen-oc-classic-haircut');
    assertEq(draft.requestedDate, '');
    assertEq(draft.startTime, '');
    assertEq(draft.rebookedFromBookingId, 'old-booking');
    assertEq(draft.previousServiceName, 'Classic Haircut');
    assertEq(MobileBarberBooking.checkAvailability({
      vendor: MobileBarberData.findVendorById(MobileBarberData.MICHAEL_VENDOR_ID),
      services: MobileBarberData.listServicesForVendor(MobileBarberData.MICHAEL_VENDOR_ID),
      availability: MobileBarberData.sampleAvailability,
      draft: draft
    }).canCreate, false);

    draft.requestedDate = '2026-06-01';
    draft.startTime = '10:00';
    var result = check(draft);
    var built = MobileBarberBooking.buildBooking({
      id: 'rebook-ok-1',
      vendor: MobileBarberData.findVendorById(MobileBarberData.MICHAEL_VENDOR_ID),
      draft: draft,
      availabilityResult: result,
      now: '2026-05-24T00:00:00.000Z'
    });
    assertEq(built.valid, true, built.errors && built.errors.join('; '));
    assertEq(built.booking.status, 'pending_barber_confirmation');
    assertEq(built.booking.rebookedFromBookingId, 'old-booking');
    assertEq(built.booking.previousServiceName, 'Classic Haircut');
    assertEq(built.booking.stylePreference, 'Low fade, no hard part');
  });

  test('Mobile Barber saveBooking reports firestore source when Firebase write resolves', function() {
    var originalFirebase = global.firebase;
    var writes = [];
    global.firebase = {
      apps: [{}],
      firestore: function() {
        return {
          collection: function(collectionName) {
            return {
              doc: function(id) {
                return {
                  set: function(doc) {
                    writes.push({ collectionName: collectionName, id: id, doc: doc });
                    return {
                      then: function(cb) {
                        var value = cb();
                        return { catch: function() { return value; } };
                      }
                    };
                  }
                };
              }
            };
          }
        };
      }
    };
    try {
      var booking = sampleBuiltBooking('firestore-source-1');
      var saved = MobileBarberBooking.saveBooking(booking);
      assertEq(saved.saved, true);
      assertEq(saved.source, 'firestore');
      assertEq(writes.length, 1);
      assertEq(writes[0].collectionName, MobileBarberData.COLLECTIONS.bookings);
      assertEq(writes[0].id, booking.id);
    } finally {
      global.firebase = originalFirebase;
    }
  });

  test('Mobile Barber saveBooking reports local source when Firestore is unavailable', function() {
    var originalFirebase = global.firebase;
    var originalLocalStorage = global.localStorage;
    var originalPromiseResolve = Promise.resolve;
    var store = {};
    global.firebase = undefined;
    global.localStorage = {
      getItem: function(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
      setItem: function(key, value) { store[key] = value; }
    };
    Promise.resolve = function(value) { return value; };
    try {
      var booking = sampleBuiltBooking('local-source-1');
      var saved = MobileBarberBooking.saveBooking(booking);
      assertEq(saved.saved, true);
      assertEq(saved.source, 'local');
      var localRows = JSON.parse(store.dlc_mobile_barber_bookings || '[]');
      assertEq(localRows.length, 1);
      assertEq(localRows[0].id, booking.id);
    } finally {
      global.firebase = originalFirebase;
      global.localStorage = originalLocalStorage;
      Promise.resolve = originalPromiseResolve;
    }
  });

  // ── Guarded customer booking (anonymous flow → createMobileBarberBookingGuarded) ──
  // The public booking flow signs in anonymously and cannot run the owner-scoped
  // conflict query under Firestore rules, so the server callable is the ONLY safe
  // pre-write gate. These three tests pin the contract: a conflict is BLOCKED, a clear
  // slot saves through the callable, and a guard that cannot run NEVER reports success.
  function guardedFirebaseMock(callableImpl, directWriteCounter) {
    return {
      apps: [{}],
      firestore: function() {
        return {
          collection: function() {
            return { doc: function() { return { set: function() { directWriteCounter.n++; return Promise.resolve(); } }; } };
          }
        };
      },
      functions: function() {
        return {
          httpsCallable: function(name) {
            assertEq(name, 'createMobileBarberBookingGuarded', 'customer booking must call the guarded callable');
            return callableImpl;
          }
        };
      }
    };
  }

  test('Mobile Barber customer booking is BLOCKED when the server guard reports a time conflict', function() {
    var originalFirebase = global.firebase;
    var direct = { n: 0 };
    global.firebase = guardedFirebaseMock(function() {
      return Promise.resolve({ data: { ok: false, code: 'time_conflict', suggestions: ['10:45', '11:30'] } });
    }, direct);
    return MobileBarberBooking.saveBooking(sampleBuiltBooking('guard-conflict-1'), { requireDatabase: true })
      .then(function() { throw new Error('a conflicting slot must NOT save'); })
      .catch(function(error) {
        assert(error && error.bookingConflict, 'rejection must be a bookingConflict the UI can show as "slot taken"');
        assert((error.suggestions || []).length > 0, 'conflict must carry alternate times to offer the customer');
        assertEq(direct.n, 0, 'a blocked booking must never fall back to a direct write');
      })
      .then(function() { global.firebase = originalFirebase; }, function(e) { global.firebase = originalFirebase; throw e; });
  });

  test('Mobile Barber customer booking saves through the server guard (callable source)', function() {
    var originalFirebase = global.firebase;
    var direct = { n: 0 };
    global.firebase = guardedFirebaseMock(function(payload) {
      return Promise.resolve({ data: { ok: true, booking: payload.booking } });
    }, direct);
    return MobileBarberBooking.saveBooking(sampleBuiltBooking('guard-ok-1'), { requireDatabase: true })
      .then(function(saved) {
        assertEq(saved.saved, true);
        assertEq(saved.source, 'callable', 'a guarded customer booking must report the callable as the write source');
        assertEq(direct.n, 0, 'the callable writes server-side; the client must not ALSO direct-write');
      })
      .then(function() { global.firebase = originalFirebase; }, function(e) { global.firebase = originalFirebase; throw e; });
  });

  test('Mobile Barber customer booking refuses (no false success) when the guard callable is unreachable', function() {
    var originalFirebase = global.firebase;
    var direct = { n: 0 };
    global.firebase = guardedFirebaseMock(function() {
      return Promise.reject(new Error('functions/internal'));
    }, direct);
    return MobileBarberBooking.saveBooking(sampleBuiltBooking('guard-down-1'), { requireDatabase: true })
      .then(function() { throw new Error('an unguarded write must NOT report success'); })
      .catch(function(error) {
        assert(error, 'a guard that cannot run must reject');
        assert(!error.bookingConflict, 'an outage is not a time conflict');
        assertEq(direct.n, 0, 'NO SUCCESS BEFORE SAFE WRITE: must not silently direct-write when the guard cannot run');
      })
      .then(function() { global.firebase = originalFirebase; }, function(e) { global.firebase = originalFirebase; throw e; });
  });

  // ── Smart duplicate / spam intent — client surfacing of guard response codes ──
  test('Mobile Barber duplicate-intent: SAME_DAY_DUPLICATE_NEEDS_INTENT surfaces an intent error (no write)', function() {
    var originalFirebase = global.firebase; var direct = { n: 0 };
    global.firebase = guardedFirebaseMock(function() {
      return Promise.resolve({ data: { ok: false, code: 'SAME_DAY_DUPLICATE_NEEDS_INTENT',
        riskReasons: ['same_service_same_day'],
        existing: [{ bookingId: 'B1', serviceName: 'Classic Haircut', date: '2026-06-01', startTime: '09:35', time: '09:35' }] } });
    }, direct);
    return MobileBarberBooking.saveBooking(sampleBuiltBooking('dup-intent-1'), { requireDatabase: true })
      .then(function() { throw new Error('a same-day duplicate must NOT silently save'); })
      .catch(function(error) {
        assert(error && error.duplicateIntent, 'must reject with a duplicateIntent error the UI can act on');
        assert(!error.bookingConflict, 'a same-day duplicate is not a hard time conflict');
        assert((error.existing || []).length > 0, 'carries the existing booking so the UI can name the time');
        assertEq(direct.n, 0, 'NO booking written until the customer resolves intent');
      })
      .then(function() { global.firebase = originalFirebase; }, function(e) { global.firebase = originalFirebase; throw e; });
  });

  test('Mobile Barber duplicate-intent: DUPLICATE_EXACT is surfaced as a hard conflict (no write)', function() {
    var originalFirebase = global.firebase; var direct = { n: 0 };
    global.firebase = guardedFirebaseMock(function() {
      return Promise.resolve({ data: { ok: false, code: 'DUPLICATE_EXACT', existing: [{ bookingId: 'B1' }] } });
    }, direct);
    return MobileBarberBooking.saveBooking(sampleBuiltBooking('dup-exact-1'), { requireDatabase: true })
      .then(function() { throw new Error('an exact same-customer duplicate must be blocked'); })
      .catch(function(error) {
        assert(error && error.bookingConflict, 'exact/overlap duplicate is surfaced as a hard conflict');
        assertEq(direct.n, 0, 'no booking written');
      })
      .then(function() { global.firebase = originalFirebase; }, function(e) { global.firebase = originalFirebase; throw e; });
  });

  test('Mobile Barber duplicate-intent: TOO_MANY_REQUESTS surfaces a spam error (no write)', function() {
    var originalFirebase = global.firebase; var direct = { n: 0 };
    global.firebase = guardedFirebaseMock(function() {
      return Promise.resolve({ data: { ok: false, code: 'TOO_MANY_REQUESTS', recent24h: 6 } });
    }, direct);
    return MobileBarberBooking.saveBooking(sampleBuiltBooking('dup-spam-1'), { requireDatabase: true })
      .then(function() { throw new Error('spam must be blocked'); })
      .catch(function(error) {
        assert(error && error.bookingSpam, 'rate limit surfaces a spam error');
        assertEq(direct.n, 0, 'no booking written');
      })
      .then(function() { global.firebase = originalFirebase; }, function(e) { global.firebase = originalFirebase; throw e; });
  });

  test('Mobile Barber duplicate-intent: verified family booking is accepted (OK_FAMILY_MEMBER)', function() {
    var originalFirebase = global.firebase; var direct = { n: 0 }; var sent = null;
    global.firebase = guardedFirebaseMock(function(payload) {
      sent = payload.booking;
      return Promise.resolve({ data: { ok: true, code: 'OK_FAMILY_MEMBER', booking: payload.booking } });
    }, direct);
    var fam = MobileBarberBooking.applyDuplicateIntent(sampleBuiltBooking('dup-fam-1'), { type: 'family_member', familyMemberName: 'Liam', familyMemberAgeGroup: 'child' });
    assertEq(fam.bookingFor, 'family_member');
    assertEq(fam.familyMemberName, 'Liam');
    assertEq(fam.duplicateIntentVerified, true);
    return MobileBarberBooking.saveBooking(fam, { requireDatabase: true })
      .then(function(saved) {
        assertEq(saved.saved, true);
        assertEq(saved.source, 'callable');
        assert(sent && sent.duplicateIntentVerified === true, 'verified intent is sent to the guard');
        assertEq(sent.familyMemberName, 'Liam');
      })
      .then(function() { global.firebase = originalFirebase; }, function(e) { global.firebase = originalFirebase; throw e; });
  });

  test('Mobile Barber duplicate-intent: self_reschedule sends the linked id (no second booking)', function() {
    var originalFirebase = global.firebase; var direct = { n: 0 }; var sent = null;
    global.firebase = guardedFirebaseMock(function(payload) {
      sent = payload.booking;
      return Promise.resolve({ data: { ok: true, code: 'OK_RESCHEDULED', rescheduled: true, booking: payload.booking } });
    }, direct);
    var re = MobileBarberBooking.applyDuplicateIntent(sampleBuiltBooking('dup-resched-1'), { type: 'self_reschedule', linkedExistingBookingId: 'B1' });
    assertEq(re.duplicateIntentType, 'self_reschedule');
    assertEq(re.linkedExistingBookingId, 'B1');
    return MobileBarberBooking.saveBooking(re, { requireDatabase: true })
      .then(function(saved) {
        assertEq(saved.saved, true);
        assertEq(saved.rescheduled, true, 'result flags a reschedule, not a new booking');
        assert(sent && sent.linkedExistingBookingId === 'B1', 'linked existing id is sent to the guard');
        assertEq(direct.n, 0, 'no direct client write');
      })
      .then(function() { global.firebase = originalFirebase; }, function(e) { global.firebase = originalFirebase; throw e; });
  });

  test('Mobile Barber manual confirm can require database write failure to reject', function() {
    var originalFirebase = global.firebase;
    var originalLocalStorage = global.localStorage;
    var wroteLocal = false;
    global.firebase = {
      apps: [{}],
      firestore: function() {
        return {
          collection: function() {
            return {
              doc: function() {
                return {
                  set: function() {
                    return Promise.reject(new Error('permission-denied'));
                  }
                };
              }
            };
          }
        };
      }
    };
    global.localStorage = {
      getItem: function() { return '[]'; },
      setItem: function() { wroteLocal = true; }
    };
    return MobileBarberBooking.saveBooking(sampleBuiltBooking('firestore-required-fail'), { requireDatabase: true })
      .then(function() {
        throw new Error('database failure should reject');
      })
      .catch(function(error) {
        assert(error, 'database failure should produce an error');
        assertEq(wroteLocal, false, 'manual confirm must not silently queue local booking after database failure');
      })
      .then(function() {
        global.firebase = originalFirebase;
        global.localStorage = originalLocalStorage;
      }, function(error) {
        global.firebase = originalFirebase;
        global.localStorage = originalLocalStorage;
        throw error;
      });
  });

  test('Mobile Barber chat save failure replaces confirmation copy', function() {
    var src = fs.readFileSync(path.join(__dirname, '../../mobile-barber/mobile-barber.js'), 'utf8');
    var failIdx = src.indexOf("booking save FAILED");
    assert(failIdx >= 0, 'chat booking save failure handler must exist');
    var block = src.slice(failIdx, failIdx + 1400);
    assert(block.indexOf('result.booking = null') >= 0, 'failure handler must clear booking before responding');
    assert(block.indexOf("t('saveFailedRetry')") >= 0,
      'failure handler must replace the confirmation copy with the save-failed copy');
    assert(block.indexOf('error.bookingConflict') >= 0,
      'failure handler must distinguish a time conflict (slot taken) and offer alternate times');
    assert(block.indexOf('(result.response || \'\') +') < 0,
      'failure handler must not append save-failed text to a success confirmation');
  });

  function storageStub(behavior) {
    behavior = behavior || {};
    return {
      apps: [{}],
      firestore: function() { return {}; },
      storage: function() {
        return {
          ref: function(path) {
            return {
              putString: function(dataUrl, format) {
                if (behavior.onPutString) behavior.onPutString(dataUrl, format, path);
                if (behavior.fail) return Promise.reject(new Error('upload-failed'));
                return Promise.resolve();
              },
              getDownloadURL: function() {
                return Promise.resolve('https://storage.example/' + path);
              }
            };
          }
        };
      }
    };
  }

  test('Mobile Barber uploadBookingImages is a synchronous no-op when Firebase Storage is unavailable', function() {
    var originalFirebase = global.firebase;
    global.firebase = { apps: [{}], firestore: function() { return {}; } };
    try {
      var booking = sampleBuiltBooking('storage-noop-1');
      booking.selectedHaircutImageUrl = 'data:image/png;base64,AAAA';
      booking.selectedHaircutImageStoragePath = '';
      var ran = false;
      var ret = MobileBarberBooking.uploadBookingImages(booking);
      ret.then(function(b) { ran = (b === booking); });
      assertEq(ran, true, 'no-op upload must resolve synchronously when Storage is unavailable');
      assert(booking.selectedHaircutImageUrl.indexOf('data:') === 0, 'inline data URL must be preserved when Storage is unavailable');
      assertEq(booking.selectedHaircutImageStoragePath, '', 'no storage path should be set without an upload');
    } finally {
      global.firebase = originalFirebase;
    }
  });

  test('Mobile Barber uploadBookingImages uploads inline haircut data URL and rewrites fields to the download URL', function() {
    var originalFirebase = global.firebase;
    global.firebase = storageStub();
    try {
      var booking = sampleBuiltBooking('storage-haircut-1');
      booking.selectedHaircutImageUrl = 'data:image/png;base64,AAAA';
      booking.selectedHaircutImageStoragePath = '';
      return MobileBarberBooking.uploadBookingImages(booking).then(function(result) {
        assertEq(result, booking, 'uploadBookingImages should resolve with the same booking');
        assert(booking.selectedHaircutImageUrl.indexOf('https://') === 0, 'haircut field should be rewritten to the download URL');
        assert(booking.selectedHaircutImageStoragePath.indexOf('vendors/' + booking.vendorId + '/bookings/' + booking.id) === 0, 'storage path should follow the canonical vendor booking path');
        assert(booking.selectedHaircutImageStoragePath.indexOf('/ai_haircut_') > -1, 'storage path should name the haircut image');
      }).then(function() {
        global.firebase = originalFirebase;
      }, function(error) {
        global.firebase = originalFirebase;
        throw error;
      });
    } catch (e) {
      global.firebase = originalFirebase;
      throw e;
    }
  });

  test('Mobile Barber uploadBookingImages uploads a consented selfie to a durable URL', function() {
    var originalFirebase = global.firebase;
    global.firebase = storageStub();
    try {
      var booking = sampleBuiltBooking('storage-selfie-1');
      booking.selectedHaircutImageUrl = '';
      booking.selectedHaircutThumbnailUrl = '';
      booking.customerSelfieUrl = 'data:image/jpeg;base64,BBBB';
      booking.customerSelfieStoragePath = '';
      return MobileBarberBooking.uploadBookingImages(booking).then(function() {
        assert(booking.customerSelfieUrl.indexOf('https://') === 0, 'selfie field should be rewritten to the download URL');
        assert(booking.customerSelfieStoragePath.indexOf('/selfie_') > -1, 'selfie storage path should name the selfie image');
      }).then(function() {
        global.firebase = originalFirebase;
      }, function(error) {
        global.firebase = originalFirebase;
        throw error;
      });
    } catch (e) {
      global.firebase = originalFirebase;
      throw e;
    }
  });

  test('Mobile Barber uploadBookingImages keeps the inline data URL when the upload fails', function() {
    var originalFirebase = global.firebase;
    global.firebase = storageStub({ fail: true });
    try {
      var booking = sampleBuiltBooking('storage-fail-1');
      booking.selectedHaircutImageUrl = 'data:image/png;base64,AAAA';
      booking.selectedHaircutImageStoragePath = '';
      return MobileBarberBooking.uploadBookingImages(booking).then(function() {
        assert(booking.selectedHaircutImageUrl.indexOf('data:') === 0, 'inline data URL must survive a failed upload (fallback)');
        assertEq(booking.selectedHaircutImageStoragePath, '', 'no storage path should be recorded after a failed upload');
      }).then(function() {
        global.firebase = originalFirebase;
      }, function(error) {
        global.firebase = originalFirebase;
        throw error;
      });
    } catch (e) {
      global.firebase = originalFirebase;
      throw e;
    }
  });

  test('Mobile Barber uploadBookingImages prefers the full-resolution cached copy over the inline thumbnail', function() {
    var originalFirebase = global.firebase;
    var originalAIPreview = global.MobileBarberAIPreview;
    var captured = '';
    global.firebase = storageStub({ onPutString: function(dataUrl) { if (!captured) captured = dataUrl; } });
    global.MobileBarberAIPreview = {
      readLocalCopy: function() { return 'data:image/png;base64,FULLRES'; }
    };
    try {
      var booking = sampleBuiltBooking('storage-fullres-1');
      booking.aiPreviewSessionId = 'sess-1';
      booking.selectedHaircutImageUrl = 'data:image/png;base64,SMALL';
      booking.selectedHaircutImageStoragePath = '';
      return MobileBarberBooking.uploadBookingImages(booking).then(function() {
        assertEq(captured, 'data:image/png;base64,FULLRES', 'upload should use the full-resolution cached copy, not the compressed inline thumbnail');
      }).then(function() {
        global.firebase = originalFirebase;
        global.MobileBarberAIPreview = originalAIPreview;
      }, function(error) {
        global.firebase = originalFirebase;
        global.MobileBarberAIPreview = originalAIPreview;
        throw error;
      });
    } catch (e) {
      global.firebase = originalFirebase;
      global.MobileBarberAIPreview = originalAIPreview;
      throw e;
    }
  });

  test('Live-data: static-fallback availability routes booking to vendor_review', function() {
    var draft = baseDraft();
    var availability = MobileBarberBooking.checkAvailability({
      vendor: MobileBarberData.findVendorById(MobileBarberData.MICHAEL_VENDOR_ID),
      services: MobileBarberData.listServicesForVendor(MobileBarberData.MICHAEL_VENDOR_ID),
      availability: MobileBarberData.sampleAvailability,
      draft: draft,
      existingBookings: [],
      now: FIXTURE_NOW,
      liveDataSource: 'static-fallback'
    });
    assert(availability.canCreate, 'availability should still allow create on static fallback');
    assertEq(availability.liveDataSource, 'static-fallback', 'checkAvailability must echo liveDataSource');
    var built = MobileBarberBooking.buildBooking({
      id: 'stale-data-test',
      now: '2026-05-24T00:00:00.000Z',
      vendor: MobileBarberData.findVendorById(MobileBarberData.MICHAEL_VENDOR_ID),
      draft: draft,
      availabilityResult: availability
    });
    assert(built.valid, 'booking should still build on static fallback');
    assertEq(built.booking.status, 'vendor_review', 'stale live data must route to vendor_review, never auto-confirm');
    assertEq(built.booking.reviewReason, 'stale_vendor_data', 'review reason must flag stale vendor data');
  });

  test('Live-data: firestore-sourced availability confirms normally (no false review)', function() {
    var draft = baseDraft();
    var availability = MobileBarberBooking.checkAvailability({
      vendor: MobileBarberData.findVendorById(MobileBarberData.MICHAEL_VENDOR_ID),
      services: MobileBarberData.listServicesForVendor(MobileBarberData.MICHAEL_VENDOR_ID),
      availability: MobileBarberData.sampleAvailability,
      draft: draft,
      existingBookings: [],
      now: FIXTURE_NOW,
      liveDataSource: 'firestore'
    });
    var built = MobileBarberBooking.buildBooking({
      id: 'firestore-data-test',
      now: '2026-05-24T00:00:00.000Z',
      vendor: MobileBarberData.findVendorById(MobileBarberData.MICHAEL_VENDOR_ID),
      draft: draft,
      availabilityResult: availability
    });
    assert(built.valid, 'booking should build on live firestore data');
    assert(built.booking.status !== 'vendor_review', 'live firestore data must NOT force vendor_review');
    assert(!built.booking.reviewReason, 'no stale review reason when data is live');
  });

  // ── Route-aware booking engine (13 spec tests) ─────────────────────────────
  var RV = MobileBarberData.MICHAEL_VENDOR_ID;
  var RSVC = 'michael-nguyen-oc-classic-haircut';
  function rVendor() { return MobileBarberData.findVendorById(RV); }
  function rSvcList() { return MobileBarberData.listServicesForVendor(RV); }
  function rAvail() { return MobileBarberData.sampleAvailability; }
  function rScore(o) { return MobileBarberBooking.scoreMobileBarberSlot(o); }
  function rExisting(start, end, id) { return { id: id || 'p', vendorId: RV, requestedDate: '2026-06-01', startTime: start, endTime: end, status: 'confirmed' }; }

  test('Route 1: an all-day request returns 3–5 best slots sorted by score', function() {
    var best = MobileBarberBooking.findBestMobileBarberSlots({
      vendorId: RV, serviceId: RSVC, vendor: rVendor(), services: rSvcList(), availability: rAvail(),
      existingBookings: [], now: new Date('2026-05-30T08:00:00'), dateRange: { start: '2026-06-01', end: '2026-06-01' }, limit: 5
    });
    assert(best.length >= 3 && best.length <= 5, 'expected 3–5 slots, got ' + best.length);
    for (var i = 1; i < best.length; i++) assert(best[i - 1].score >= best[i].score, 'slots sorted by score desc');
    assert(best[0].reasons && best[0].reasons.length, 'each slot carries a reason');
    assert(best.every(function(s) { return s.slot && s.slot.startTime; }), 'each result has a slot');
  });

  test('Route 2: a requested-time conflict still yields conflict-free alternates', function() {
    var existing = [rExisting('10:00', '11:15', 'x')];
    var avail0 = check(baseDraft(), existing);
    assertEq(avail0.canCreate, false);
    var best = MobileBarberBooking.findBestMobileBarberSlots({
      vendorId: RV, serviceId: RSVC, vendor: rVendor(), services: rSvcList(), availability: rAvail(),
      existingBookings: existing, now: new Date('2026-05-30T08:00:00'), dateRange: { start: '2026-06-01', end: '2026-06-01' }, limit: 5
    });
    assert(best.length >= 1, 'alternates returned');
    assert(best.every(function(s) { return s.slot.startTime !== '10:00'; }), 'alternates exclude the conflicting 10:00 window');
  });

  test('Route 3: an invalid address is never recommended', function() {
    var s = rScore({ slot: { requestedDate: '2026-06-01', startTime: '10:00', endTime: '10:45' }, candidateStart: '10:00', candidateEnd: '10:45', serviceDuration: 45, existingBookings: [], addressValidationStatus: 'invalid' });
    assertEq(s.isRecommended, false);
  });

  test('Route 4: an address beyond the service radius is flagged + not recommended (+ guard gate)', function() {
    var s = rScore({ slot: { requestedDate: '2026-06-01', startTime: '10:00', endTime: '10:45' }, candidateStart: '10:00', candidateEnd: '10:45', serviceDuration: 45, existingBookings: [], distanceMiles: 35, serviceRadiusMiles: 30 });
    assert(s.reasons.indexOf('beyond_service_radius') >= 0, 'beyond_service_radius reason');
    assertEq(s.isRecommended, false);
    var fns = fs.readFileSync(path.join(__dirname, '../../functions/index.js'), 'utf8');
    assert(fns.indexOf("reviewReason = writeDoc.reviewReason || 'beyond_service_radius'") >= 0, 'guard routes beyond-radius to vendor_review');
  });

  test('Route 5: a nearby existing booking makes the adjacent slot rank highest', function() {
    var existing = [rExisting('10:00', '10:45')];
    var travel = { p: 10 };
    var adj = rScore({ slot: { requestedDate: '2026-06-01', startTime: '11:00', endTime: '11:45' }, candidateStart: '11:00', candidateEnd: '11:45', serviceDuration: 45, cleanupBuffer: 0, travelBuffer: 0, existingBookings: existing, googleMapsTravelTimes: travel });
    var far = rScore({ slot: { requestedDate: '2026-06-01', startTime: '15:00', endTime: '15:45' }, candidateStart: '15:00', candidateEnd: '15:45', serviceDuration: 45, cleanupBuffer: 0, travelBuffer: 0, existingBookings: existing, googleMapsTravelTimes: travel });
    assert(adj.reasons.indexOf('efficient_route_adjacent') >= 0, 'adjacent slot flagged');
    assert(adj.score > far.score, 'adjacent slot scores higher than the isolated one');
  });

  test('Route 6: a far previous appointment downgrades the candidate', function() {
    var existing = [rExisting('09:00', '09:45')];
    var near = rScore({ slot: { requestedDate: '2026-06-01', startTime: '10:30', endTime: '11:15' }, candidateStart: '10:30', candidateEnd: '11:15', serviceDuration: 45, cleanupBuffer: 0, travelBuffer: 0, existingBookings: existing, googleMapsTravelTimes: { p: 10 } });
    var far = rScore({ slot: { requestedDate: '2026-06-01', startTime: '10:30', endTime: '11:15' }, candidateStart: '10:30', candidateEnd: '11:15', serviceDuration: 45, cleanupBuffer: 0, travelBuffer: 0, existingBookings: existing, googleMapsTravelTimes: { p: 40 } });
    assert(far.score < near.score, 'far travel scores lower than near travel');
  });

  test('Route 7: a gap too short for travel is a hard fail (slot excluded)', function() {
    var existing = [rExisting('10:00', '10:40')];
    var s = rScore({ slot: { requestedDate: '2026-06-01', startTime: '11:00', endTime: '11:45' }, candidateStart: '11:00', candidateEnd: '11:45', serviceDuration: 45, cleanupBuffer: 0, travelBuffer: 0, existingBookings: existing, googleMapsTravelTimes: { p: 35 } });
    assertEq(s.score, -Infinity);
    assert(s.reasons.indexOf('travel_gap_insufficient') >= 0, 'travel_gap_insufficient reason');
    assertEq(s.isRecommended, false);
  });

  test('Route 8: a dead gap lowers the slot score', function() {
    var existing = [rExisting('10:00', '10:45')];
    var dead = rScore({ slot: { requestedDate: '2026-06-01', startTime: '14:00', endTime: '14:45' }, candidateStart: '14:00', candidateEnd: '14:45', serviceDuration: 45, cleanupBuffer: 0, travelBuffer: 0, existingBookings: existing, googleMapsTravelTimes: { p: 15 } });
    var tight = rScore({ slot: { requestedDate: '2026-06-01', startTime: '11:00', endTime: '11:45' }, candidateStart: '11:00', candidateEnd: '11:45', serviceDuration: 45, cleanupBuffer: 0, travelBuffer: 0, existingBookings: existing, googleMapsTravelTimes: { p: 15 } });
    assert(dead.reasons.indexOf('dead_gap') >= 0, 'dead gap flagged');
    assert(dead.score < tight.score, 'dead-gap slot scores lower than a tightly-packed slot');
  });

  test('Route 9: the manual booking flow uses the slot engine + address validation', function() {
    var src = fs.readFileSync(path.join(__dirname, '../../mobile-barber/mobile-barber.js'), 'utf8');
    assert(src.indexOf('BOOKING.findBestMobileBarberSlots') >= 0, 'manual flow calls findBestMobileBarberSlots');
    assert(src.indexOf('BOOKING.validateAddressAndDistance') >= 0, 'manual flow validates the address');
    assert(src.indexOf('ue.bestSlots') >= 0, 'manual failure surfaces alternates');
  });

  test('Route 10: the AI chat agent offers ranked route-aware slots', function() {
    var src = fs.readFileSync(path.join(__dirname, '../../mobile-barber/mobile-barber-agent.js'), 'utf8');
    assert(src.indexOf('BOOKING.findBestMobileBarberSlots') >= 0, 'agent uses findBestMobileBarberSlots');
    assert(src.indexOf('slotReasonLabel') >= 0, 'agent renders localized slot reasons');
    assert(src.indexOf('state.routeContext = Object.assign') >= 0, 'agent carries route context into the booking');
  });

  test('Route 11: the voice agent reuses the same chat/agent slot engine', function() {
    var src = fs.readFileSync(path.join(__dirname, '../../mobile-barber/mobile-barber-voice.js'), 'utf8');
    assert(src.indexOf("controller.sendMessage(transcript, { source: 'ai_voice' })") >= 0, 'voice delegates to the shared chat controller (same engine)');
  });

  test('Route 12: a built booking carries the routeOptimizationSnapshot + address fields', function() {
    var draft = baseDraft();
    draft.routeContext = {
      formattedAddress: '123 Test St, Westminster, CA', lat: 33.75, lng: -117.99, placeId: 'abc',
      addressValidationStatus: 'precise', distanceMiles: 5.2, routeConfidence: 'high', googleMapsUsed: true,
      selectedSlotScore: 115, selectedSlotReasons: ['efficient_route_adjacent'],
      travelFromPreviousMinutes: 10, travelToNextMinutes: 0, gapBeforeMinutes: 15, gapAfterMinutes: null
    };
    var built = MobileBarberBooking.buildBooking({ id: 'route-snap-test', now: '2026-05-24T00:00:00.000Z', vendor: rVendor(), draft: draft, availabilityResult: check(draft) });
    assert(built.valid, 'booking builds with route context: ' + (built.errors || []).join(','));
    var b = built.booking;
    assertEq(b.addressValidationStatus, 'precise');
    assertEq(b.distanceMiles, 5.2);
    assertEq(b.formattedAddress, '123 Test St, Westminster, CA');
    assert(b.routeOptimizationSnapshot && b.routeOptimizationSnapshot.selectedSlotScore === 115, 'snapshot score persisted');
    assert(Array.isArray(b.routeOptimizationSnapshot.selectedSlotReasons), 'snapshot reasons persisted');
    assertEq(b.routeOptimizationSnapshot.googleMapsUsed, true);
  });

  test('Route 13: Maps-unavailable fallback (city_zip_only) still builds + scores via travelBuffer', function() {
    var draft = baseDraft();
    draft.routeContext = { addressValidationStatus: 'city_zip_only', distanceMiles: 0, routeConfidence: 'low', googleMapsUsed: false };
    var built = MobileBarberBooking.buildBooking({ id: 'route-fallback-test', now: '2026-05-24T00:00:00.000Z', vendor: rVendor(), draft: draft, availabilityResult: check(draft) });
    assert(built.valid, 'fallback booking still builds');
    assertEq(built.booking.addressValidationStatus, 'city_zip_only');
    assertEq(built.booking.routeConfidence, 'low');
    var s = rScore({ slot: { requestedDate: '2026-06-01', startTime: '11:00', endTime: '11:45' }, candidateStart: '11:00', candidateEnd: '11:45', serviceDuration: 45, cleanupBuffer: 0, travelBuffer: 20, existingBookings: [rExisting('10:00', '10:45')] });
    assert(s.score !== -Infinity, 'fallback uses travelBuffer; a normal gap is feasible');
    // Server proxy degrades safely too.
    var fns = fs.readFileSync(path.join(__dirname, '../../functions/index.js'), 'utf8');
    assert(fns.indexOf('exports.validateAddressAndDistance') >= 0, 'server Maps proxy exists');
    assert(fns.indexOf("return fallback('no_maps_key')") >= 0, 'proxy falls back when no Maps key');
  });
}

if (require.main === module) {
  var passed = 0;
  var failed = 0;
  runMobileBarberBookingTests(function(name, fn) {
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
  console.log('Mobile Barber booking tests:', passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

module.exports = {
  runMobileBarberBookingTests: runMobileBarberBookingTests
};
