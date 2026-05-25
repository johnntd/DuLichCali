'use strict';

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
    serviceId: 'classic-mobile-cut',
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
    vendor: MobileBarberData.findVendorById(MobileBarberData.SAMPLE_VENDOR_ID),
    draft: draft,
    availabilityResult: result
  });
  if (!built.valid) throw new Error('sample booking failed to build: ' + built.errors.join('; '));
  return built.booking;
}

function check(draft, existingBookings, extra) {
  extra = extra || {};
  return MobileBarberBooking.checkAvailability({
    vendor: MobileBarberData.findVendorById(MobileBarberData.SAMPLE_VENDOR_ID),
    services: MobileBarberData.listServicesForVendor(MobileBarberData.SAMPLE_VENDOR_ID),
    availability: MobileBarberData.sampleAvailability,
    draft: draft,
    existingBookings: existingBookings || [],
    unavailableBlocks: extra.unavailableBlocks || [],
    now: extra.now
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
    now: extra.now
  });
}

function runMobileBarberBookingTests(test) {
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
    assertEq(result.price.totalPrice, 60);
  });

  test('Mobile Barber manual booking blocks double booking overlap', function() {
    var result = check(baseDraft(), [{
      id: 'existing-1',
      vendorId: MobileBarberData.SAMPLE_VENDOR_ID,
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
      vendorId: MobileBarberData.SAMPLE_VENDOR_ID,
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
      vendorId: MobileBarberData.SAMPLE_VENDOR_ID,
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
      vendorId: MobileBarberData.SAMPLE_VENDOR_ID,
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
    early.startTime = '09:30';
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
        vendorId: MobileBarberData.SAMPLE_VENDOR_ID,
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

  test('Mobile Barber non-service-area address is marked vendor_review', function() {
    var draft = baseDraft();
    draft.city = 'Irvine';
    draft.zip = '92614';
    var result = check(draft);
    assertEq(result.canCreate, true);
    assertEq(result.reviewRequired, true);
    assertEq(result.status, 'vendor_review');
  });

  test('Mobile Barber service-area helper rejects out-of-area address', function() {
    var vendor = MobileBarberData.findVendorById(MobileBarberData.SAMPLE_VENDOR_ID);
    assertEq(MobileBarberBooking.isWithinServiceArea(vendor, { city: 'Westminster', zip: '92683' }), true);
    assertEq(MobileBarberBooking.isWithinServiceArea(vendor, { city: 'Irvine', zip: '92614' }), false);
  });

  test('Mobile Barber named Phase 8 helpers calculate windows and price', function() {
    var vendor = MobileBarberData.findVendorById(MobileBarberData.SAMPLE_VENDOR_ID);
    var service = MobileBarberData.listServicesForVendor(MobileBarberData.SAMPLE_VENDOR_ID)[0];
    var window = MobileBarberBooking.calculateAppointmentWindow(service, { requestedDate: '2026-06-01', startTime: '10:00' }, vendor);
    var price = MobileBarberBooking.calculateMobileBarberPrice(vendor, service, { city: 'Westminster', zip: '92683' });
    assertEq(window.endTime, '11:15');
    assertEq(window.totalMinutes, 75);
    assertEq(price.totalPrice, 60);
    assertEq(price.reviewRequired, false);
  });

  test('Mobile Barber raw window availability detects overlap', function() {
    var result = MobileBarberBooking.checkMobileBarberAvailability(
      MobileBarberData.SAMPLE_VENDOR_ID,
      '2026-06-01T10:00:00',
      '2026-06-01T11:15:00',
      {
        existingBookings: [{
          id: 'existing-window',
          vendorId: MobileBarberData.SAMPLE_VENDOR_ID,
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
      MobileBarberData.SAMPLE_VENDOR_ID,
      'classic-mobile-cut',
      { start: '2026-06-01', end: '2026-06-01' },
      {
        limit: 3,
        existingBookings: [{
          id: 'existing-first',
          vendorId: MobileBarberData.SAMPLE_VENDOR_ID,
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
      vendor: MobileBarberData.findVendorById(MobileBarberData.SAMPLE_VENDOR_ID),
      draft: baseDraft(),
      availabilityResult: null
    });
    assertEq(built.valid, false);
    assert(built.errors.indexOf('availability_check_required') >= 0, 'must require availability check');
  });

  test('Mobile Barber builds pending booking only after availability check', function() {
    var draft = baseDraft();
    var result = check(draft);
    var built = MobileBarberBooking.buildBooking({
      id: 'manual-ok-1',
      now: '2026-05-23T00:00:00.000Z',
      vendor: MobileBarberData.findVendorById(MobileBarberData.SAMPLE_VENDOR_ID),
      draft: draft,
      availabilityResult: result
    });
    assertEq(built.valid, true, built.errors && built.errors.join('; '));
    assertEq(built.booking.status, 'pending_confirmation');
    assertEq(built.booking.source, 'customer_form');
    assertEq(built.booking.endTime, '11:15');
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
      { id: 'a', vendorId: MobileBarberData.SAMPLE_VENDOR_ID, customerPhone: '(714) 555-0100', requestedDate: '2026-06-01', startTime: '10:00' },
      { id: 'b', vendorId: 'other-vendor', customerPhone: '7145550100', requestedDate: '2026-06-02', startTime: '10:00' },
      { id: 'c', vendorId: MobileBarberData.SAMPLE_VENDOR_ID, customerPhone: '9995550100', requestedDate: '2026-06-03', startTime: '10:00' }
    ], MobileBarberData.SAMPLE_VENDOR_ID, { phone: '714-555-0100' });
    assertEq(rows.length, 1);
    assertEq(rows[0].id, 'a');
  });

  test('Mobile Barber customer history separates upcoming and past bookings', function() {
    var history = MobileBarberBooking.splitCustomerBookingHistory([
      { id: 'past', vendorId: MobileBarberData.SAMPLE_VENDOR_ID, customerPhone: '7145550100', requestedDate: '2026-05-20', startTime: '10:00', status: 'completed' },
      { id: 'future', vendorId: MobileBarberData.SAMPLE_VENDOR_ID, customerPhone: '7145550100', requestedDate: '2026-06-01', startTime: '10:00', status: 'confirmed' }
    ], MobileBarberData.SAMPLE_VENDOR_ID, { phone: '7145550100' }, new Date('2026-05-24T09:00:00'));
    assertEq(history.past.length, 1);
    assertEq(history.upcoming.length, 1);
    assertEq(history.upcoming[0].id, 'future');
  });

  test('Mobile Barber rebook draft preserves service and requires a new validated date/time', function() {
    var draft = MobileBarberBooking.buildRebookDraft({
      id: 'old-booking',
      vendorId: MobileBarberData.SAMPLE_VENDOR_ID,
      customerName: 'Test Customer',
      customerPhone: '7145550100',
      serviceId: 'classic-mobile-cut',
      serviceName: 'Classic Mobile Haircut',
      address: '123 Test St',
      city: 'Westminster',
      zip: '92683',
      notes: 'Low fade',
      stylePreference: 'Low fade'
    }, { stylePreference: 'Low fade, no hard part' });
    assertEq(draft.serviceId, 'classic-mobile-cut');
    assertEq(draft.requestedDate, '');
    assertEq(draft.startTime, '');
    assertEq(draft.rebookedFromBookingId, 'old-booking');
    assertEq(draft.previousServiceName, 'Classic Mobile Haircut');
    assertEq(MobileBarberBooking.checkAvailability({
      vendor: MobileBarberData.findVendorById(MobileBarberData.SAMPLE_VENDOR_ID),
      services: MobileBarberData.listServicesForVendor(MobileBarberData.SAMPLE_VENDOR_ID),
      availability: MobileBarberData.sampleAvailability,
      draft: draft
    }).canCreate, false);

    draft.requestedDate = '2026-06-01';
    draft.startTime = '10:00';
    var result = check(draft);
    var built = MobileBarberBooking.buildBooking({
      id: 'rebook-ok-1',
      vendor: MobileBarberData.findVendorById(MobileBarberData.SAMPLE_VENDOR_ID),
      draft: draft,
      availabilityResult: result,
      now: '2026-05-24T00:00:00.000Z'
    });
    assertEq(built.valid, true, built.errors && built.errors.join('; '));
    assertEq(built.booking.status, 'pending_confirmation');
    assertEq(built.booking.rebookedFromBookingId, 'old-booking');
    assertEq(built.booking.previousServiceName, 'Classic Mobile Haircut');
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
