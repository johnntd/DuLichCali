'use strict';
/*
 * Unified Owner Account model — Phase 1.
 *
 * One owner account (e.g. "michael-nguyen") can map to multiple businesses
 * across different service types (barber / ride / tour). This module is the
 * single source of truth for the owner -> businesses relationship and the
 * backward-compatible helpers used by the owner dashboard shell.
 *
 * Additive + backward compatible:
 *  - Existing per-vendor / per-driver portals are untouched.
 *  - `ownerId` is an OPTIONAL field on provider records. When a record has no
 *    ownerId, `resolveOwnerId(record)` falls back to this static mapping so
 *    legacy Firestore docs still resolve to the right owner.
 *  - Nothing here mutates vendor, driver, or booking models.
 */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.OwnerModel = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function() {

  // Canonical service types an owner can operate. Matches the customer-facing
  // categories but is INTERNAL only (customers still see separate services).
  var SERVICE_TYPES = Object.freeze(['barber', 'ride', 'tour']);

  // Owner accounts. `emails` lists every email that should resolve to this
  // owner on login (the owner's personal email plus any business emails).
  var OWNERS = Object.freeze({
    'michael-nguyen': Object.freeze({
      id: 'michael-nguyen',
      displayName: 'Michael Nguyen',
      email: 'duyhoa9256@gmail.com',
      emails: Object.freeze(['duyhoa9256@gmail.com']),
      phone: '(714) 227-6007',
      defaultLang: 'en',
      homeRegion: 'Orange County'
    }),
    'tim-nguyen': Object.freeze({
      id: 'tim-nguyen',
      displayName: 'Tim Nguyen',
      email: 'tuananhnta@gmail.com',
      emails: Object.freeze(['tuananhnta@gmail.com']),
      phone: '(408) 504-3684',
      defaultLang: 'en',
      homeRegion: 'Bay Area'
    })
  });

  // Businesses owned by each owner. `providerId` links to the underlying
  // provider record (e.g. a mobileBarberVendors doc) when one exists.
  // `status` is 'active' | 'coming_soon' so the dashboard can show a roadmap
  // without pretending non-existent services are bookable.
  var BUSINESSES = Object.freeze([
    Object.freeze({
      id: 'michael-nguyen-oc',
      ownerId: 'michael-nguyen',
      serviceType: 'barber',
      providerId: 'michael-nguyen-oc',
      name: 'Michael Mobile Barber OC',
      region: 'Orange County',
      status: 'active',
      dashboardUrl: '/mobile-barber/dashboard.html',
      customerUrl: '/mobile-barber?id=michael-nguyen-oc'
    }),
    Object.freeze({
      id: 'michael-rides-oc',
      ownerId: 'michael-nguyen',
      serviceType: 'ride',
      providerId: null,
      name: 'Michael Airport & Rides OC',
      region: 'Orange County',
      status: 'coming_soon',
      dashboardUrl: '/driver-admin.html',
      customerUrl: '/airport'
    }),
    Object.freeze({
      id: 'michael-tours-oc',
      ownerId: 'michael-nguyen',
      serviceType: 'tour',
      providerId: null,
      name: 'Michael Private Tours OC',
      region: 'Orange County',
      status: 'coming_soon',
      dashboardUrl: '/tour',
      customerUrl: '/tour'
    }),
    Object.freeze({
      id: 'tim-nguyen-bay',
      ownerId: 'tim-nguyen',
      serviceType: 'barber',
      providerId: 'tim-nguyen-bay',
      name: 'Tim Mobile Barber Bay Area',
      region: 'Bay Area',
      status: 'active',
      dashboardUrl: '/mobile-barber/dashboard.html',
      customerUrl: '/mobile-barber?id=tim-nguyen-bay'
    })
  ]);

  function _norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

  function listOwners() {
    return Object.keys(OWNERS).map(function(k) { return OWNERS[k]; });
  }

  function findOwner(ownerId) {
    if (!ownerId) return null;
    return OWNERS[ownerId] || null;
  }

  // All businesses for an owner, optionally filtered by service type.
  function businessesForOwner(ownerId, serviceType) {
    if (!ownerId) return [];
    return BUSINESSES.filter(function(b) {
      if (b.ownerId !== ownerId) return false;
      if (serviceType && b.serviceType !== serviceType) return false;
      return true;
    });
  }

  function findBusiness(businessId) {
    if (!businessId) return null;
    for (var i = 0; i < BUSINESSES.length; i++) {
      if (BUSINESSES[i].id === businessId) return BUSINESSES[i];
    }
    return null;
  }

  // ownerId for a given business id (or null if unknown).
  function ownerForBusiness(businessId) {
    var b = findBusiness(businessId);
    return b ? b.ownerId : null;
  }

  // Backward-compatible owner resolution for an arbitrary provider record.
  // 1) explicit record.ownerId wins;
  // 2) else map by the record's id / providerId / vendorId via BUSINESSES;
  // 3) else null (caller decides — legacy single-vendor behavior).
  function resolveOwnerId(record) {
    if (!record || typeof record !== 'object') return null;
    if (record.ownerId) return record.ownerId;
    var id = record.id || record.vendorId || record.providerId || record.businessId;
    if (!id) return null;
    var direct = ownerForBusiness(id);
    if (direct) return direct;
    // Match against providerId links too.
    for (var i = 0; i < BUSINESSES.length; i++) {
      if (BUSINESSES[i].providerId && BUSINESSES[i].providerId === id) {
        return BUSINESSES[i].ownerId;
      }
    }
    return null;
  }

  // Resolve an owner from a login email (case-insensitive). Returns ownerId
  // or null. Used by the dashboard shell to greet the right owner without a
  // new auth system in Phase 1.
  function ownerForEmail(email) {
    var e = _norm(email);
    if (!e) return null;
    var ids = Object.keys(OWNERS);
    for (var i = 0; i < ids.length; i++) {
      var o = OWNERS[ids[i]];
      var emails = (o.emails || []).map(_norm);
      if (emails.indexOf(e) !== -1) return o.id;
    }
    return null;
  }

  // Does this owner operate more than one business? Drives whether the
  // business switcher is shown at all.
  function ownerHasMultipleBusinesses(ownerId) {
    return businessesForOwner(ownerId).length > 1;
  }

  return {
    SERVICE_TYPES: SERVICE_TYPES,
    OWNERS: OWNERS,
    BUSINESSES: BUSINESSES,
    listOwners: listOwners,
    findOwner: findOwner,
    businessesForOwner: businessesForOwner,
    findBusiness: findBusiness,
    ownerForBusiness: ownerForBusiness,
    resolveOwnerId: resolveOwnerId,
    ownerForEmail: ownerForEmail,
    ownerHasMultipleBusinesses: ownerHasMultipleBusinesses
  };
});
