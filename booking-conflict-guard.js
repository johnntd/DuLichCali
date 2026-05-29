'use strict';
/*
 * Shared owner-wide booking conflict guard.
 * UMD module: window.BookingGuard in browsers, module.exports in Node tests.
 */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BookingGuard = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function() {
  var root = (typeof window !== 'undefined') ? window : globalThis;

  var COLLECTIONS = Object.freeze({
    barber: 'mobileBarberBookings',
    bookings: 'bookings',
    travel: 'travel_bookings',
    locks: 'bookingConflictLocks'
  });
  var SERVICE_DEFAULTS = Object.freeze({
    barber: Object.freeze({ durationMinutes: 45, travelBufferMinutes: 20 }),
    ride: Object.freeze({ durationMinutes: 90, travelBufferMinutes: 15 }),
    tour: Object.freeze({ durationMinutes: 480, travelBufferMinutes: 30 })
  });
  var BLOCKING_STATUSES = Object.freeze([
    'pending',
    'pending_confirmation',
    'pending_barber_confirmation',
    'confirmed',
    'accepted',
    'in_progress',
    'traveling',
    'vendor_review'
  ]);
  var NON_BLOCKING_STATUSES = Object.freeze([
    'cancelled',
    'rejected',
    'completed',
    'expired',
    'no_show'
  ]);
  var SERVICE_RADIUS_MILES = 30;
  var SLOT_STEP_MINUTES = 30;
  var MAX_QUERY_LIMIT = 250;

  function _s(v) { return v == null ? '' : String(v).trim(); }
  function _lower(v) { return _s(v).toLowerCase(); }
  function _num(v) { var n = Number(v); return isFinite(n) ? n : null; }
  function _log() {
    if (root.console && root.console.info) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[booking-guard]');
      root.console.info.apply(root.console, args);
    }
  }
  function normalizeServiceType(serviceType) {
    var st = _lower(serviceType);
    if (st === 'airport' || st === 'pickup' || st === 'dropoff' || st === 'private_ride') return 'ride';
    if (st === 'travel') return 'tour';
    return st || '';
  }
  function normalizePhone(value) {
    var d = _s(value).replace(/\D/g, '');
    if (d.length > 10) d = d.slice(-10);
    return d;
  }
  function normalizeStatus(status) {
    var raw = _lower(status || 'pending');
    if (root.MobileBarberBooking && root.MobileBarberBooking.normalizeBookingStatus) {
      var barber = root.MobileBarberBooking.normalizeBookingStatus(raw);
      if (barber === 'pending_barber_confirmation') return raw === 'vendor_review' ? 'vendor_review' : raw === 'pending' ? 'pending' : barber;
    }
    return raw;
  }
  function isBlockingStatus(status) {
    var s = normalizeStatus(status);
    if (NON_BLOCKING_STATUSES.indexOf(s) >= 0) return false;
    return BLOCKING_STATUSES.indexOf(s) >= 0;
  }
  function parseTime(date, time) {
    var d = _s(date);
    var t = _s(time);
    if (!d || !t) return null;
    var parsed = Date.parse(d + 'T' + t.slice(0, 5) + ':00');
    return isNaN(parsed) ? null : parsed;
  }
  function toMillis(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'number' && isFinite(value)) return value;
    if (value instanceof Date && !isNaN(value.getTime())) return value.getTime();
    if (value && typeof value.toMillis === 'function') return value.toMillis();
    if (value && typeof value.seconds === 'number') return value.seconds * 1000;
    var parsed = Date.parse(String(value));
    return isNaN(parsed) ? null : parsed;
  }
  function dateString(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function minutesToTime(total) {
    var h = Math.floor(total / 60) % 24;
    var m = total % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
  function normalizeWindow(req) {
    var serviceType = normalizeServiceType(req.serviceType);
    var defaults = SERVICE_DEFAULTS[serviceType];
    if (!defaults) return null;
    var start = toMillis(req.requestedStart);
    if (start == null && req.requestedDate && req.startTime) start = parseTime(req.requestedDate, req.startTime);
    var duration = Number(req.serviceDurationMinutes || req.durationMinutes || defaults.durationMinutes);
    var end = toMillis(req.requestedEnd);
    if (end == null && req.endTime && req.requestedDate) end = parseTime(req.requestedDate, req.endTime);
    if (end == null && start != null) end = start + duration * 60000;
    var buffer = Number(req.travelBufferMinutes != null ? req.travelBufferMinutes : defaults.travelBufferMinutes);
    if (start == null || end == null || !isFinite(duration) || !isFinite(buffer) || end <= start) return null;
    return { start: start, end: end + buffer * 60000, rawStart: start, rawEnd: end, bufferMinutes: buffer, durationMinutes: duration };
  }
  function bookingWindow(row) {
    var serviceType = normalizeServiceType(row.serviceType || row.rawServiceType);
    if (!serviceType && row.sourceCollection === COLLECTIONS.barber) serviceType = 'barber';
    if (!serviceType && row.sourceCollection === COLLECTIONS.travel) serviceType = 'tour';
    var defaults = SERVICE_DEFAULTS[serviceType] || SERVICE_DEFAULTS.ride;
    var dateOnly = row.travel_date || row.date;
    var startSource = row.requestedStart || row.start || row.datetime || row.dateTime || row.appointmentStart;
    if (!startSource && dateOnly && /^\d{4}-\d{2}-\d{2}$/.test(String(dateOnly))) {
      startSource = null;
    }
    var start = toMillis(startSource);
    if (start == null) start = parseTime(row.requestedDate || row.arrivalDate || row.departureDate || row.rideDate || row.travel_date || row.date, row.startTime || row.arrivalTime || row.departureTime || row.rideTime || row.time || '09:00');
    var end = toMillis(row.requestedEnd || row.end || row.appointmentEnd);
    if (end == null && row.endTime) end = parseTime(row.requestedDate || row.arrivalDate || row.departureDate || row.rideDate || row.travel_date || row.date, row.endTime);
    var duration = Number(row.serviceDurationMinutes || row.durationMinutes || defaults.durationMinutes);
    if (end == null && start != null) end = start + duration * 60000;
    var buffer = Number(row.travelBufferMinutes != null ? row.travelBufferMinutes : defaults.travelBufferMinutes);
    if (start == null || end == null || end <= start) return null;
    return { start: start, end: end + buffer * 60000, rawStart: start, rawEnd: end, serviceType: serviceType, bufferMinutes: buffer };
  }
  function overlaps(a, b) {
    return a && b && a.start < b.end && b.start < a.end;
  }
  function conflictRow(row, win) {
    return {
      serviceType: normalizeServiceType(row.serviceType || row.rawServiceType) || (row.sourceCollection === COLLECTIONS.travel ? 'tour' : row.sourceCollection === COLLECTIONS.barber ? 'barber' : 'ride'),
      bookingId: _s(row.id || row.bookingId),
      collection: _s(row.sourceCollection || row.collection || COLLECTIONS.bookings),
      start: win.start,
      end: win.end,
      status: normalizeStatus(row.status),
      customerName: _s(row.customerName || row.name || row.customer_name || (row.customer && row.customer.name))
    };
  }
  function identityMatch(req, row) {
    var reqPhone = normalizePhone(req.customerPhone || req.phone);
    var rowPhone = normalizePhone(row.customerPhone || row.phone || row.customer_phone || (row.customer && row.customer.phone));
    if (reqPhone && rowPhone && reqPhone === rowPhone) return 'phone';
    var reqUid = _s(req.customerUid || req.uid);
    var rowUid = _s(row.customerUid || row.uid);
    if (reqUid && rowUid && reqUid === rowUid) return 'customerUid';
    var reqEmail = _lower(req.customerEmail || req.email);
    var rowEmail = _lower(row.customerEmail || row.email || row.customer_email || (row.customer && row.customer.email));
    if (reqEmail && rowEmail && reqEmail === rowEmail) return 'customerEmail';
    return '';
  }
  function serviceOrigin(req, options) {
    options = options || {};
    var origin = options.origin || req.origin || req.vendor || {};
    var lat = _num(origin.lat != null ? origin.lat : origin.latitude);
    var lng = _num(origin.lng != null ? origin.lng : origin.longitude);
    if (lat != null && lng != null) return { lat: lat, lng: lng, city: _lower(origin.city), zip: _s(origin.zip) };
    var owner = root.OwnerModel && root.OwnerModel.findOwner ? root.OwnerModel.findOwner(req.ownerId) : null;
    return { lat: null, lng: null, city: _lower(origin.city || (owner && owner.homeRegion)), zip: _s(origin.zip) };
  }
  function haversineMiles(a, b) {
    var R = 3958.8;
    var toRad = function(x) { return x * Math.PI / 180; };
    var dLat = toRad(b.lat - a.lat);
    var dLng = toRad(b.lng - a.lng);
    var s1 = Math.sin(dLat / 2);
    var s2 = Math.sin(dLng / 2);
    var h = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }
  function radiusDecision(req, options) {
    var lat = _num(req.lat != null ? req.lat : req.latitude);
    var lng = _num(req.lng != null ? req.lng : req.longitude);
    var origin = serviceOrigin(req, options);
    if (origin.lat != null && origin.lng != null && lat != null && lng != null) {
      var miles = haversineMiles(origin, { lat: lat, lng: lng });
      return { distanceMiles: miles, withinServiceRadius: miles <= SERVICE_RADIUS_MILES, resolvable: true };
    }
    var city = _lower(req.city);
    var zip = _s(req.zip);
    var owner = root.OwnerModel && root.OwnerModel.findOwner ? root.OwnerModel.findOwner(req.ownerId) : null;
    var ownerRegion = _lower(owner && owner.homeRegion);
    if ((city && origin.city && (origin.city.indexOf(city) >= 0 || city.indexOf(origin.city) >= 0)) || (zip && origin.zip && zip === origin.zip)) {
      return { distanceMiles: null, withinServiceRadius: true, resolvable: true };
    }
    if (zip && ownerRegion.indexOf('orange') >= 0 && /^(906|907|926|927|928)/.test(zip)) {
      return { distanceMiles: null, withinServiceRadius: true, resolvable: true };
    }
    if (zip && ownerRegion.indexOf('bay') >= 0 && /^(940|941|943|944|945|946|947|948|949|950|951)/.test(zip)) {
      return { distanceMiles: null, withinServiceRadius: true, resolvable: true };
    }
    if (city || zip || req.pickupAddress || req.serviceAddress) {
      return { distanceMiles: null, withinServiceRadius: null, resolvable: false };
    }
    return { distanceMiles: null, withinServiceRadius: null, resolvable: false };
  }
  function _docData(doc, collection) {
    var data = doc && typeof doc.data === 'function' ? (doc.data() || {}) : (doc || {});
    data = Object.assign({}, data);
    data.id = data.id || (doc && doc.id) || data.bookingId || '';
    data.sourceCollection = data.sourceCollection || collection;
    return data;
  }
  function _query(db, collection, field, value) {
    if (!db || !value) return Promise.resolve([]);
    var q = db.collection(collection).where(field, '==', value).limit(MAX_QUERY_LIMIT);
    return q.get().then(function(snap) {
      var rows = [];
      snap.forEach(function(doc) { rows.push(_docData(doc, collection)); });
      return rows;
    }).catch(function(error) {
      _log('query failed', collection, field, error && error.message ? error.message : String(error));
      return [];
    });
  }
  function loadOwnerBookings(req, options) {
    options = options || {};
    if (Array.isArray(options.existingBookings)) return Promise.resolve(options.existingBookings.slice());
    var db = options.db || (root.firebase && root.firebase.firestore && root.firebase.firestore());
    if (!db) return Promise.resolve([]);
    var ownerId = req.ownerId;
    var barberIds = options.barberVendorIds || (root.OwnerBookings && root.OwnerBookings.barberVendorIdsFor ? root.OwnerBookings.barberVendorIdsFor(ownerId) : []);
    if (req.vendorId && barberIds.indexOf(req.vendorId) < 0) barberIds.push(req.vendorId);
    var queries = barberIds.map(function(vid) { return _query(db, COLLECTIONS.barber, 'vendorId', vid); });
    queries.push(_query(db, COLLECTIONS.bookings, 'ownerId', ownerId));
    queries.push(_query(db, COLLECTIONS.travel, 'ownerId', ownerId));
    return Promise.all(queries).then(function(groups) {
      return groups.reduce(function(a, b) { return a.concat(b); }, []);
    });
  }
  function evaluate(req, rows, options) {
    options = options || {};
    var serviceType = normalizeServiceType(req.serviceType);
    var requested = normalizeWindow(req);
    var dup = { level: 'none', matchedBookingId: '', matchedBy: '' };
    var conflicts = [];
    var timeConflict = false;
    if (!req.ownerId || !serviceType || !requested) {
      return finish(false, 'invalid_request', [], requested, dup, { distanceMiles: null, withinServiceRadius: null }, req, rows, options);
    }
    var radius = radiusDecision(req, options);
    _log('input', { ownerId: req.ownerId, serviceType: serviceType, vendorId: req.vendorId || '', start: requested.start, end: requested.end, source: req.source || '' });
    (rows || []).forEach(function(row) {
      if (!isBlockingStatus(row.status)) return;
      var win = bookingWindow(row);
      if (!win || !overlaps(requested, win)) return;
      var cr = conflictRow(row, win);
      var sameService = normalizeServiceType(row.serviceType || row.rawServiceType) === serviceType;
      var matchedBy = sameService ? identityMatch(req, row) : '';
      if (matchedBy && dup.level === 'none') dup = { level: 'likely', matchedBookingId: cr.bookingId, matchedBy: matchedBy };
      conflicts.push(cr);
      timeConflict = true;
      _log('conflict', cr.collection, cr.bookingId, cr.status);
    });
    _log('distance', { distanceMiles: radius.distanceMiles, withinServiceRadius: radius.withinServiceRadius });
    var reason = 'available';
    if (dup.level === 'likely') reason = 'customer_duplicate';
    else if (timeConflict) reason = 'time_conflict';
    else if (radius.withinServiceRadius === false) reason = 'outside_service_radius';
    else if (radius.resolvable === false) reason = 'vendor_review_required';
    return finish(reason === 'available', reason, conflicts, requested, dup, radius, req, rows, options);
  }
  function finish(ok, reason, conflicts, requested, dup, radius, req, rows, options) {
    var out = {
      ok: !!ok,
      reason: reason,
      conflicts: conflicts || [],
      suggestedSlots: requested ? suggestedSlots(req, rows || [], options, requested) : [],
      normalizedWindow: requested ? { start: requested.start, end: requested.end } : { start: null, end: null },
      customerDuplicateRisk: dup || { level: 'none', matchedBookingId: '', matchedBy: '' },
      distanceMiles: radius ? radius.distanceMiles : null,
      withinServiceRadius: radius ? radius.withinServiceRadius : null
    };
    _log('verdict', { ok: out.ok, reason: out.reason, conflicts: out.conflicts.length });
    return out;
  }
  function suggestedSlots(req, rows, options, requested) {
    var out = [];
    var defaults = SERVICE_DEFAULTS[normalizeServiceType(req.serviceType)] || SERVICE_DEFAULTS.ride;
    var rawDuration = (requested.rawEnd - requested.rawStart) / 60000;
    var startDate = new Date(requested.rawStart);
    var dayStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 8, 0, 0, 0).getTime();
    var seedMinutes = Math.max(8 * 60, Math.ceil((startDate.getHours() * 60 + startDate.getMinutes()) / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES);
    for (var day = 0; day < 7 && out.length < 5; day++) {
      for (var minutes = day === 0 ? seedMinutes : 8 * 60; minutes <= 18 * 60 && out.length < 5; minutes += SLOT_STEP_MINUTES) {
        var rawStart = dayStart + day * 86400000 + minutes * 60000;
        if (rawStart <= requested.rawStart) continue;
        var candidateReq = Object.assign({}, req, {
          requestedStart: rawStart,
          requestedEnd: rawStart + rawDuration * 60000,
          serviceDurationMinutes: rawDuration || defaults.durationMinutes
        });
        var win = normalizeWindow(candidateReq);
        var blocked = rows.some(function(row) { return isBlockingStatus(row.status) && overlaps(win, bookingWindow(row)); });
        if (!blocked) out.push({ start: win.start, end: win.end });
      }
    }
    return out.slice(0, 5);
  }
  function validateUnifiedBookingRequest(req, options) {
    req = req || {};
    options = options || {};
    return loadOwnerBookings(req, options).then(function(rows) {
      return evaluate(req, rows, options);
    });
  }
  function lockKey(req, win) {
    return [req.ownerId, dateString(win.rawStart), Math.floor(win.rawStart / (15 * 60000))].join(':');
  }
  function guardedWrite(req, writeFn, options) {
    options = options || {};
    var db = options.db || (root.firebase && root.firebase.firestore && root.firebase.firestore());
    var first;
    return validateUnifiedBookingRequest(req, options).then(function(result) {
      first = result;
      if (!result.ok) return result;
      if (!db || typeof db.runTransaction !== 'function') {
        return Promise.resolve(writeFn()).then(function(writeResult) {
          return Object.assign({}, first, { writeResult: writeResult });
        });
      }
      var win = normalizeWindow(req);
      var ref = db.collection(COLLECTIONS.locks).doc(lockKey(req, win));
      return db.runTransaction(function(tx) {
        return tx.get(ref).then(function(snap) {
          if (snap && snap.exists) {
            return { locked: true };
          }
          tx.set(ref, { ownerId: req.ownerId, serviceType: normalizeServiceType(req.serviceType), start: win.start, end: win.end, createdAt: new Date().toISOString() });
          return validateUnifiedBookingRequest(req, options).then(function(second) {
            if (!second.ok) return second;
            return Promise.resolve(writeFn(tx)).then(function(writeResult) {
              return Object.assign({}, second, { writeResult: writeResult });
            });
          });
        });
      }).then(function(result) {
        if (result && result.locked) {
          return finish(false, 'time_conflict', [], win, { level: 'none', matchedBookingId: '', matchedBy: '' }, radiusDecision(req, options), req, [], options);
        }
        return result;
      });
    });
  }

  return {
    COLLECTIONS: COLLECTIONS,
    SERVICE_DEFAULTS: SERVICE_DEFAULTS,
    BLOCKING_STATUSES: BLOCKING_STATUSES,
    NON_BLOCKING_STATUSES: NON_BLOCKING_STATUSES,
    SERVICE_RADIUS_MILES: SERVICE_RADIUS_MILES,
    normalizeServiceType: normalizeServiceType,
    normalizePhone: normalizePhone,
    normalizeStatus: normalizeStatus,
    isBlockingStatus: isBlockingStatus,
    normalizeWindow: normalizeWindow,
    validateUnifiedBookingRequest: validateUnifiedBookingRequest,
    guardedWrite: guardedWrite,
    _evaluate: evaluate,
    _bookingWindow: bookingWindow,
    _overlaps: overlaps
  };
});
