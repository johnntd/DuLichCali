'use strict';
/*
 * Unified owner booking loader + normalizer — Phase 1.
 *
 * Michael Nguyen's owner portal reuses the existing mobile-barber dashboard
 * row/card UI. That UI reads a barber-shaped booking object (customerName,
 * serviceName, requestedDate, startTime, address, servicePrice, status, ...).
 * This module pulls bookings from THREE sources and normalizes every row into
 * that same barber-shaped object, plus discriminator fields the dashboard uses
 * to render type-specific badges/actions:
 *
 *   serviceType      'barber' | 'ride' | 'tour'   (the internal bucket)
 *   rawServiceType   original serviceType string from the source doc
 *   sourceCollection 'mobileBarberBookings' | 'bookings' | 'travel_bookings'
 *   serviceLabelKey  i18n key for the service label (no hardcoded UI strings)
 *   _raw             the untouched source document (for type-specific actions)
 *
 * Sources:
 *   barber → mobileBarberBookings  (queried by vendorId; ownerId is redundant
 *            there because vendorId already maps to the owner)
 *   ride/airport → bookings        (queried by ownerId; new docs are stamped)
 *   tour → travel_bookings + bookings (chat-created tours land in `bookings`)
 *
 * Additive + backward compatible: this module never writes. It only reads and
 * shapes rows. Legacy docs lacking ownerId are picked up by the compat paths
 * (barber by vendorId; ride/tour by a serviceType scan when opts.compat true).
 */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.OwnerBookings = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function() {

  var root = (typeof window !== 'undefined') ? window : globalThis;

  function _s(v) { return v == null ? '' : String(v); }
  function _num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  // Pick the first non-empty value from a list of candidate fields.
  function _pick(obj) {
    for (var i = 1; i < arguments.length; i++) {
      var v = obj[arguments[i]];
      if (v != null && v !== '') return v;
    }
    return '';
  }

  function _bucket(serviceType) {
    if (root.OwnerModel && root.OwnerModel.serviceBucket) {
      return root.OwnerModel.serviceBucket(serviceType);
    }
    var st = _s(serviceType).trim().toLowerCase();
    if (st === 'barber') return 'barber';
    if (st === 'tour') return 'tour';
    if (st === 'ride' || st === 'private_ride' || st === 'pickup' || st === 'dropoff') return 'ride';
    return st || null;
  }

  // ── Normalizers ──────────────────────────────────────────────────────────
  // Each returns a row whose barber-shaped fields the existing dashboard card
  // can render unchanged, plus the discriminator fields listed in the header.

  function normalizeBarber(doc) {
    var d = Object.assign({}, doc);
    d.serviceType = 'barber';
    d.rawServiceType = _s(doc.serviceType || 'barber');
    d.sourceCollection = 'mobileBarberBookings';
    d.serviceLabelKey = '';
    d._raw = doc;
    return d;
  }

  // Ride / airport rows from the `bookings` collection.
  function normalizeRide(doc) {
    var raw = _s(doc.serviceType).toLowerCase();
    var labelKey = raw === 'pickup' ? 'svcAirportPickup'
      : raw === 'dropoff' ? 'svcAirportDropoff'
      : 'svcPrivateRide';
    var date = _pick(doc, 'arrivalDate', 'departureDate', 'rideDate', 'requestedDate');
    var time = _pick(doc, 'arrivalTime', 'departureTime', 'rideTime');
    // datetime is an ISO-ish "YYYY-MM-DDTHH:mm:00"; split if explicit fields absent
    if ((!date || !time) && doc.datetime && String(doc.datetime).indexOf('T') !== -1) {
      var parts = String(doc.datetime).split('T');
      if (!date) date = parts[0] || '';
      if (!time) time = (parts[1] || '').slice(0, 5);
    }
    var addr = _pick(doc, 'pickupAddress', 'dropoffAddress', 'address');
    var price = _pick(doc, 'estimatedPrice', 'estimatedfare', 'fare', 'price');
    return {
      id: doc.id || doc.bookingId || '',
      bookingId: doc.bookingId || doc.id || '',
      ownerId: doc.ownerId || null,
      serviceType: 'ride',
      rawServiceType: raw,
      sourceCollection: 'bookings',
      serviceLabelKey: labelKey,
      serviceName: '',
      serviceId: raw,
      customerName: _pick(doc, 'customerName', 'name'),
      customerPhone: _pick(doc, 'customerPhone', 'phone'),
      customerEmail: _pick(doc, 'customerEmail', 'email'),
      requestedDate: date,
      startTime: time,
      endTime: '',
      address: _s(addr),
      city: _s(doc.city),
      zip: _s(doc.zip),
      servicePrice: _num(price),
      travelFee: 0,
      amountDue: _num(price),
      status: _s(doc.status || 'pending'),
      notes: _s(doc.notes),
      assignedDriverId: doc.assignedDriverId || doc.driverId || doc.driver || null,
      region: doc.region || null,
      routeLink: doc.routeLink || null,
      passengers: doc.passengers || null,
      vehicleType: doc.vehicleType || doc.vehicle || null,
      airport: doc.airport || '',
      confirmationPreference: doc.confirmationPreference || 'call',
      _raw: doc
    };
  }

  // Tour rows. travel_bookings uses snake_case + a `customer` object; chat-created
  // tours in `bookings` use a flatter shape. Handle both.
  function normalizeTour(doc, sourceCollection) {
    var cust = doc.customer || {};
    var date = _pick(doc, 'travel_date', 'date', 'datetime', 'requestedDate');
    var addr = _pick(doc, 'pickup_address', 'pickup_location', 'address');
    var price = _pick(doc, 'total', 'estimatedPrice', 'price');
    return {
      id: doc.id || doc.bookingId || '',
      bookingId: doc.bookingId || doc.id || '',
      ownerId: doc.ownerId || null,
      serviceType: 'tour',
      rawServiceType: _s(doc.serviceType || doc.packageId || 'tour'),
      sourceCollection: sourceCollection || 'travel_bookings',
      serviceLabelKey: 'svcTour',
      serviceName: _pick(doc, 'packageName', 'package_slug', 'packageId'),
      serviceId: _s(doc.packageId || doc.serviceType || 'tour'),
      customerName: _pick(doc, 'customer_name', 'name') || _s(cust.name),
      customerPhone: _pick(doc, 'customer_phone', 'phone') || _s(cust.phone),
      customerEmail: _pick(doc, 'customer_email', 'email') || _s(cust.email),
      requestedDate: date,
      startTime: '',
      endTime: '',
      address: _s(addr),
      city: '',
      zip: '',
      servicePrice: _num(price),
      travelFee: 0,
      amountDue: _num(price),
      status: _s(doc.status || 'pending'),
      notes: _s(doc.notes),
      passengers: doc.travelers || doc.traveler_count || doc.passengers || null,
      durationDays: doc.duration_days || doc.days || null,
      region: doc.pickup_region || doc.region || null,
      confirmationPreference: doc.confirmationPreference || 'call',
      _raw: doc
    };
  }

  // ── Loaders ──────────────────────────────────────────────────────────────

  function _dedupeById(rows) {
    var seen = {};
    var out = [];
    rows.forEach(function(r) {
      var key = r.sourceCollection + ':' + (r.id || r.bookingId || '');
      if (!r.id && !r.bookingId) { out.push(r); return; }
      if (seen[key]) return;
      seen[key] = true;
      out.push(r);
    });
    return out;
  }

  function _docData(doc) {
    var data = (doc && doc.data) ? (doc.data() || {}) : (doc || {});
    data.id = data.id || (doc && doc.id) || '';
    return data;
  }

  // Barber: query mobileBarberBookings for each of the owner's barber vendorIds.
  function _loadBarber(db, vendorIds) {
    if (!db || !vendorIds || !vendorIds.length) return Promise.resolve([]);
    var queries = vendorIds.map(function(vid) {
      return db.collection('mobileBarberBookings').where('vendorId', '==', vid).get()
        .then(function(snap) {
          var rows = [];
          snap.forEach(function(doc) { rows.push(normalizeBarber(_docData(doc))); });
          return rows;
        })
        .catch(function() { return []; });
    });
    return Promise.all(queries).then(function(groups) {
      return groups.reduce(function(a, b) { return a.concat(b); }, []);
    });
  }

  // Ride/airport + chat-tours: query `bookings` by ownerId, then bucket.
  function _loadBookingsCollection(db, ownerId, compat) {
    if (!db || !ownerId) return Promise.resolve([]);
    var primary = db.collection('bookings').where('ownerId', '==', ownerId).get()
      .then(function(snap) {
        var rows = [];
        snap.forEach(function(doc) {
          var data = _docData(doc);
          var bucket = _bucket(data.serviceType);
          if (bucket === 'ride') rows.push(normalizeRide(data));
          else if (bucket === 'tour') rows.push(normalizeTour(data, 'bookings'));
          // barber/nail/hair/unknown in `bookings` are ignored here.
        });
        return rows;
      })
      .catch(function() { return []; });
    if (!compat) return primary;
    // Compat: legacy ride docs lacking ownerId. Michael is the sole ride
    // operator today, so a serviceType scan with ownerId==null is safe.
    var compatQ = db.collection('bookings').where('serviceType', 'in', ['pickup', 'dropoff', 'private_ride']).get()
      .then(function(snap) {
        var rows = [];
        snap.forEach(function(doc) {
          var data = _docData(doc);
          if (data.ownerId == null) rows.push(normalizeRide(data));
        });
        return rows;
      })
      .catch(function() { return []; });
    return Promise.all([primary, compatQ]).then(function(g) { return g[0].concat(g[1]); });
  }

  // Tours from the canonical travel_bookings collection.
  function _loadTravelBookings(db, ownerId, compat) {
    if (!db || !ownerId) return Promise.resolve([]);
    var primary = db.collection('travel_bookings').where('ownerId', '==', ownerId).get()
      .then(function(snap) {
        var rows = [];
        snap.forEach(function(doc) { rows.push(normalizeTour(_docData(doc), 'travel_bookings')); });
        return rows;
      })
      .catch(function() { return []; });
    if (!compat) return primary;
    // Compat: legacy tour docs lacking ownerId. Michael is the sole tour
    // operator today, so including unowned travel_bookings is safe.
    var compatQ = db.collection('travel_bookings').get()
      .then(function(snap) {
        var rows = [];
        snap.forEach(function(doc) {
          var data = _docData(doc);
          if (data.ownerId == null) rows.push(normalizeTour(data, 'travel_bookings'));
        });
        return rows;
      })
      .catch(function() { return []; });
    return Promise.all([primary, compatQ]).then(function(g) { return g[0].concat(g[1]); });
  }

  /*
   * Load all bookings an owner can manage, normalized for the dashboard.
   * opts.barberVendorIds : string[]  barber vendor/provider ids for this owner
   * opts.compat          : boolean   also pull legacy (unowned) ride/tour docs
   * Returns Promise<row[]>.
   */
  function load(db, ownerId, opts) {
    opts = opts || {};
    var barberIds = opts.barberVendorIds || _barberVendorIdsFor(ownerId);
    var compat = opts.compat !== false; // default ON for Phase 1 (legacy data)
    return Promise.all([
      _loadBarber(db, barberIds),
      _loadBookingsCollection(db, ownerId, compat),
      _loadTravelBookings(db, ownerId, compat)
    ]).then(function(groups) {
      var all = groups.reduce(function(a, b) { return a.concat(b); }, []);
      return _dedupeById(all);
    });
  }

  // Derive an owner's barber vendor ids from the OwnerModel BUSINESSES table.
  function _barberVendorIdsFor(ownerId) {
    if (!ownerId || !root.OwnerModel || !root.OwnerModel.businessesForOwner) return [];
    return root.OwnerModel.businessesForOwner(ownerId, 'barber')
      .map(function(b) { return b.providerId || b.id; })
      .filter(Boolean);
  }

  return {
    load: load,
    normalizeBarber: normalizeBarber,
    normalizeRide: normalizeRide,
    normalizeTour: normalizeTour,
    barberVendorIdsFor: _barberVendorIdsFor
  };
});
