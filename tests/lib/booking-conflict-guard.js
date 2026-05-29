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

function fakeDbWithLock(lockData, request) {
  var locks = {};
  if (lockData) {
    var win = BG.normalizeWindow(request || req({ requestedStart: '2026-06-01T15:00:00' }));
    locks[['michael-nguyen', '2026-06-01', Math.floor(win.rawStart / (15 * 60000))].join(':')] = lockData;
  }
  return {
    locks: locks,
    collection: function() {
      return {
        doc: function(id) { return { id: id }; }
      };
    },
    runTransaction: function(fn) {
      var tx = {
        get: function(ref) {
          return Promise.resolve({
            exists: !!locks[ref.id],
            data: function() { return locks[ref.id] || {}; }
          });
        },
        set: function(ref, data) { locks[ref.id] = data; },
        delete: function(ref) { delete locks[ref.id]; }
      };
      return Promise.resolve(fn(tx));
    }
  };
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

  test('BG-PC-01: 3-day tour blocks a haircut on day 2', function() {
    withOwnerModel(config(3), function() {
      var r = evaluate(req({
        serviceType: 'barber',
        vendorId: 'michael-nguyen-oc',
        requestedStart: '2026-06-02T11:00:00',
        serviceDurationMinutes: 45
      }), [tour({
        id: 'tour-3-day',
        bookingId: 'tour-3-day',
        travel_date: '2026-06-01',
        startTime: '09:00',
        duration_days: 3,
        serviceDurationMinutes: 1440
      })]);
      assertEq(r.reason, 'time_conflict');
      assertEq(r.disposition, 'review');
    });
  });

  test('BG-PC-02: 1-day tour does not spill into next day', function() {
    withOwnerModel(config(3), function() {
      var r = evaluate(req({
        serviceType: 'barber',
        vendorId: 'michael-nguyen-oc',
        requestedStart: '2026-06-02T11:00:00',
        serviceDurationMinutes: 45
      }), [tour({
        id: 'tour-1-day',
        bookingId: 'tour-1-day',
        travel_date: '2026-06-01',
        startTime: '09:00',
        duration_days: 1,
        serviceDurationMinutes: 480
      })]);
      assertEq(r.reason, 'available');
      assertEq(r.disposition, 'confirm');
    });
  });

  test('BG-PC-03: distance-scaled travel buffer catches far-apart haircuts', function() {
    withOwnerModel(config(1), function() {
      var far = evaluate(req({
        serviceType: 'barber',
        vendorId: 'michael-nguyen-oc',
        requestedStart: '2026-06-01T10:25:00',
        serviceDurationMinutes: 45,
        lat: 33.6595,
        lng: -117.9988
      }), [barber({
        startTime: '09:00',
        endTime: '09:45',
        lat: 34.0522,
        lng: -118.2437
      })]);
      assertEq(far.reason, 'time_conflict');
      assertEq(far.disposition, 'review');

      var samePoint = evaluate(req({
        serviceType: 'barber',
        vendorId: 'michael-nguyen-oc',
        requestedStart: '2026-06-01T10:10:00',
        serviceDurationMinutes: 45,
        lat: 33.7743,
        lng: -117.9379
      }), [barber({
        startTime: '09:00',
        endTime: '09:45',
        lat: 33.7743,
        lng: -117.9379
      })]);
      assertEq(samePoint.reason, 'available');
      assertEq(samePoint.disposition, 'confirm');
    });
  });

  test('BG-PC-04: travelBufferMinutesBetween returns floor when geo is missing', function() {
    assertEq(BG.travelBufferMinutesBetween({ serviceType: 'barber' }, { serviceType: 'barber', lat: 33.7, lng: -117.9 }), 20);
  });

  test('BG-PC-05: stale locks are overwritten, fresh locks route to review', function() {
    var request = req({ requestedStart: '2026-06-01T15:00:00' });
    var staleDb = fakeDbWithLock({ createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString() }, request);
    var freshDb = fakeDbWithLock({ createdAt: new Date(Date.now() - 10 * 1000).toISOString() }, request);
    return BG.guardedWrite(request, function() {
      return Promise.resolve({ saved: true });
    }, { db: staleDb, existingBookings: [], origin: { city: 'Garden Grove', zip: '92840', lat: 33.7743, lng: -117.9379 } })
      .then(function(stale) {
        assertEq(stale.disposition, 'confirm');
        assertEq(stale.writeResult.saved, true);
        assertEq(Object.keys(staleDb.locks).length, 0, 'successful stale-lock write should clean up lock');
        return BG.guardedWrite(request, function() {
          throw new Error('fresh lock should not write');
        }, { db: freshDb, existingBookings: [], origin: { city: 'Garden Grove', zip: '92840', lat: 33.7743, lng: -117.9379 } });
      })
      .then(function(fresh) {
        assertEq(fresh.disposition, 'review');
        assertEq(fresh.reason, 'time_conflict');
      });
  });
}

module.exports = { runBookingConflictGuardTests: runBookingConflictGuardTests };
