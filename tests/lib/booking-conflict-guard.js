'use strict';

var BG = require('../../booking-conflict-guard');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertEq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg ? msg + ': ' : '') + 'expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual));
  }
}

function withOwnerModel(ownerModel, fn) {
  var prior = globalThis.OwnerModel;
  globalThis.OwnerModel = ownerModel;
  try {
    return fn();
  } finally {
    globalThis.OwnerModel = prior;
  }
}

function req(overrides) {
  return Object.assign({
    ownerId: 'michael-nguyen',
    serviceType: 'ride',
    customerName: 'Alex Tran',
    customerPhone: '4089163439',
    requestedStart: '2026-06-01T10:00:00',
    serviceDurationMinutes: 45,
    city: 'Garden Grove',
    zip: '92840',
    source: 'phase-b-test'
  }, overrides || {});
}

function tour(overrides) {
  return Object.assign({
    id: 'tour-existing',
    bookingId: 'tour-existing',
    sourceCollection: 'travel_bookings',
    serviceType: 'tour',
    ownerId: 'michael-nguyen',
    customerName: 'Other Customer',
    customerPhone: '7145550002',
    travel_date: '2026-06-01',
    startTime: '08:00',
    endTime: '09:00',
    status: 'confirmed',
    serviceDurationMinutes: 60,
    travelBufferMinutes: 0
  }, overrides || {});
}

function barber(overrides) {
  return Object.assign({
    id: 'barber-existing',
    bookingId: 'barber-existing',
    sourceCollection: 'mobileBarberBookings',
    serviceType: 'barber',
    vendorId: 'michael-nguyen-oc',
    ownerId: 'michael-nguyen',
    customerName: 'Other Customer',
    customerPhone: '7145550000',
    requestedDate: '2026-06-01',
    startTime: '06:00',
    endTime: '06:45',
    status: 'confirmed'
  }, overrides || {});
}

function evaluate(request, rows) {
  return BG._evaluate(request, rows || [], {
    origin: { city: 'Garden Grove', zip: '92840', lat: 33.7743, lng: -117.9379 }
  });
}

function config(cap) {
  return {
    workingHoursFor: function() { return { start: '08:00', end: '18:00' }; },
    tourDailyCapFor: function() { return cap == null ? 1 : cap; },
    findOwner: function() { return { homeRegion: 'Orange County' }; }
  };
}

function runBookingConflictGuardTests(test) {
  test('BG-PB-01: outside working hours routes to review', function() {
    withOwnerModel(config(1), function() {
      var r = evaluate(req({ requestedStart: '2026-06-01T06:00:00' }), []);
      assertEq(r.disposition, 'review');
      assertEq(r.reason, 'outside_working_hours');
    });
  });

  test('BG-PB-02: inside working hours with no other issue confirms', function() {
    withOwnerModel(config(1), function() {
      var r = evaluate(req({ requestedStart: '2026-06-01T10:00:00' }), []);
      assertEq(r.disposition, 'confirm');
      assertEq(r.reason, 'available');
      assertEq(r.ok, true);
    });
  });

  test('BG-PB-03: second tour on capped date routes to review', function() {
    withOwnerModel(config(1), function() {
      var r = evaluate(req({ serviceType: 'tour', requestedStart: '2026-06-01T10:00:00' }), [tour()]);
      assertEq(r.disposition, 'review');
      assertEq(r.reason, 'tour_daily_cap');
    });
  });

  test('BG-PB-04: first tour on empty date confirms', function() {
    withOwnerModel(config(1), function() {
      var r = evaluate(req({ serviceType: 'tour', requestedStart: '2026-06-01T10:00:00' }), []);
      assertEq(r.disposition, 'confirm');
      assertEq(r.reason, 'available');
    });
  });

  test('BG-PB-05: configured tour cap allows second tour and reviews third', function() {
    withOwnerModel(config(2), function() {
      var request = req({ serviceType: 'tour', requestedStart: '2026-06-01T10:00:00' });
      var second = evaluate(request, [tour()]);
      var third = evaluate(request, [
        tour({ id: 'tour-a', bookingId: 'tour-a', startTime: '08:00', endTime: '09:00' }),
        tour({ id: 'tour-b', bookingId: 'tour-b', startTime: '12:00', endTime: '13:00' })
      ]);
      assertEq(second.disposition, 'confirm');
      assertEq(second.reason, 'available');
      assertEq(third.disposition, 'review');
      assertEq(third.reason, 'tour_daily_cap');
    });
  });

  test('BG-PB-06: hard precedence beats soft hours and cap checks', function() {
    withOwnerModel(config(1), function() {
      var overlap = evaluate(req({ requestedStart: '2026-06-01T06:15:00' }), [barber()]);
      assertEq(overlap.disposition, 'review');
      assertEq(overlap.reason, 'time_conflict');

      var duplicate = evaluate(req({
        serviceType: 'barber',
        vendorId: 'michael-nguyen-oc',
        requestedStart: '2026-06-01T06:15:00'
      }), [barber({ customerPhone: '4089163439' })]);
      assertEq(duplicate.disposition, 'block');
      assertEq(duplicate.reason, 'customer_duplicate');
    });
  });

  test('BG-PB-07: new soft reasons map to review', function() {
    assertEq(BG.dispositionFor('outside_working_hours'), 'review');
    assertEq(BG.dispositionFor('tour_daily_cap'), 'review');
    assert(BG.dispositionFor('outside_working_hours') !== 'block');
    assert(BG.dispositionFor('tour_daily_cap') !== 'block');
  });
}

module.exports = { runBookingConflictGuardTests: runBookingConflictGuardTests };
