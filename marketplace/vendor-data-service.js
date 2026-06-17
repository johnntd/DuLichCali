// ============================================================
// VENDOR DATA SERVICE — marketplace/vendor-data-service.js
//
// Single source of truth for fetching vendor lists.
// Merges static services-data.js vendors (legacy/seed data)
// with live Firestore vendors (adminStatus === 'active').
//
// Exposed globally as window.VendorDataService.
// Load AFTER services-data.js, BEFORE marketplace.js.
// ============================================================

(function () {
  'use strict';

  // ── Hero gradient defaults by category ──────────────────
  var _HERO = {
    nails: 'linear-gradient(135deg,#831843 0%,#9d174d 50%,#4c1d95 100%)',
    hair:  'linear-gradient(135deg,#064e3b 0%,#065f46 50%,#1e40af 100%)',
    food:  'linear-gradient(135deg,#7f1d1d 0%,#b45309 50%,#92400e 100%)'
  };

  // ── Canonical vendor page paths by category ─────────────
  var _CATEGORY_PATHS = {
    nails: '/nailsalon/',
    hair:  '/hairsalon/',
    food:  '/foods/'
  };

  // ── Normalize Firestore vendor doc → renderBizCard schema ─
  //
  // renderBizCard(biz) reads:
  //   biz.id, biz.name, biz.tagline, biz.city, biz.region,
  //   biz.heroImage, biz.heroGradient
  //
  // renderSalonVendorDetail / renderFoodVendorDetail merge
  // further Firestore data on top, so only the card fields
  // need to be correct here.
  //
  function normalize(data, docId) {
    var d        = data;
    var sf       = d.storefront  || {};
    var category = d.category    || 'nails';

    return {
      // Identity
      id:          docId || d.id || '',
      category:    category,
      vendorType:  d.vendorType || (category === 'food' ? 'foodvendor' : undefined),
      name:        d.name         || d.businessName || '',
      nameVi:      d.nameVi       || d.name         || '',
      tagline:     sf.tagline     || d.description  || '',
      city:        d.city         || '',
      region:      d.region       || '',
      address:     d.address      || '',
      phone:       d.phone        || '',
      languages:   d.languages    || ['vi', 'en'],
      hours:       d.hours        || {},

      // Hero visuals (renderBizCard reads these at the top level)
      heroImage:    sf.heroImage    || d.heroImage    || '',
      heroGradient: sf.heroGradient || d.heroGradient || _HERO[category] || _HERO.nails,

      // Capabilities
      active:         true,
      bookingEnabled: true,
      aiReceptionist: { enabled: true },
      tags:           d.tags     || [],
      services:       [],  // detail page fetches from subcollection

      // Source marker so callers can distinguish Firestore vendors
      _fromFirestore: true
    };
  }

  // ── Region equality check ────────────────────────────────
  // Handles "Bay Area" vs "bay-area" vs "bayarea" variations.
  function _regionsMatch(a, b) {
    if (!a || !b) return true; // missing region = show all
    var clean = function (s) { return s.toLowerCase().replace(/[\s-]+/g, ''); };
    return clean(a) === clean(b);
  }

  // ============================================================
  // fetchVendors(category, region)
  //
  // Returns Promise<vendor[]> — static vendors first (zero
  // latency), then Firestore-only vendors appended at the end.
  // Fail-open: if Firestore errors, only static list is returned.
  // ============================================================

  function fetchVendors(category, region) {
    return new Promise(function (resolve) {

      // ── Static vendors (synchronous) ──────────────────────
      var staticList = [];
      if (window.MARKETPLACE) {
        staticList = MARKETPLACE.businesses.filter(function (b) {
          if (b.category !== category || !b.active) return false;
          if (region) return _regionsMatch(b.region, region);
          return true;
        });
      }

      var staticIds = {};
      staticList.forEach(function (b) { staticIds[b.id] = true; });

      if (!window.dlcDb) {
        resolve(staticList);
        return;
      }

      // ── Firestore vendors (async) ─────────────────────────
      dlcDb.collection('vendors')
        .where('adminStatus', '==', 'active')
        .where('category',    '==', category)
        .get()
        .then(function (snap) {
          var firestoreVendors = [];
          snap.forEach(function (doc) {
            if (staticIds[doc.id]) return; // already in static list — skip
            var biz = normalize(doc.data(), doc.id);
            if (region && !_regionsMatch(biz.region, region)) return;
            firestoreVendors.push(biz);
          });
          // Static vendors first (existing UX unchanged), new vendors at end
          resolve(staticList.concat(firestoreVendors));
        })
        .catch(function (err) {
          if (window.console) console.warn('[VendorDataService] fetchVendors failed:', err.message);
          resolve(staticList); // fail-open
        });
    });
  }

  // ============================================================
  // fetchVendor(id)
  //
  // Returns Promise<vendor|null>.
  // Checks static array first (synchronous fast path), then
  // Firestore for vendors only in the database.
  // ============================================================

  function fetchVendor(id) {
    return new Promise(function (resolve) {

      // ── Static fast path ──────────────────────────────────
      if (window.MARKETPLACE) {
        var staticBiz = MARKETPLACE.getBusiness(id);
        if (staticBiz) { resolve(staticBiz); return; }
      }

      if (!window.dlcDb) { resolve(null); return; }

      // ── Firestore lookup ──────────────────────────────────
      dlcDb.collection('vendors').doc(id).get()
        .then(function (doc) {
          if (!doc.exists) { resolve(null); return; }
          resolve(normalize(doc.data(), doc.id));
        })
        .catch(function (err) {
          if (window.console) console.warn('[VendorDataService] fetchVendor failed:', err.message);
          resolve(null);
        });
    });
  }

  // ============================================================
  // categoryPath(category)
  //
  // Returns the canonical URL path for a vendor category,
  // used by vendor-detail.html to set the correct back URL.
  // ============================================================

  function categoryPath(category) {
    return _CATEGORY_PATHS[category] || '/';
  }

  // ── Public API ───────────────────────────────────────────
  window.VendorDataService = {
    fetchVendors:  fetchVendors,
    fetchVendor:   fetchVendor,
    normalize:     normalize,
    categoryPath:  categoryPath
  };

})();
