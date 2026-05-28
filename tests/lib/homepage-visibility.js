'use strict';

// Source-pattern tests for the homepage public-visibility filter shipped on
// 2026-05-27. Verifies script.js carries the required filter logic + the
// renderer wires it correctly. Matches the lightweight test style used by
// tests/lib/mobile-barber-landing.js (no DOM sandbox).

var fs = require('fs');
var path = require('path');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}
function assertContains(haystack, needle, msg) {
  if (typeof haystack !== 'string' || haystack.indexOf(needle) < 0) {
    throw new Error((msg ? msg + ': ' : '') + 'expected to contain: ' + needle);
  }
}
function assertNotContains(haystack, needle, msg) {
  if (typeof haystack === 'string' && haystack.indexOf(needle) >= 0) {
    throw new Error((msg ? msg + ': ' : '') + 'must NOT contain: ' + needle);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8');
}

function runHomepageVisibilityTests(test) {
  var src = read('script.js');
  var html = read('index.html');

  test('Homepage filter helper exists in script.js', function() {
    assertContains(src, 'function _filterPubliclyVisibleVendors');
    assertContains(src, 'window._filterPubliclyVisibleVendors = _filterPubliclyVisibleVendors');
  });

  test('Canonical isPublicProviderVisible is the single source of truth', function() {
    // Per the spec: one shared filter applied to every homepage surface.
    assertContains(src, 'function isPublicProviderVisible');
    assertContains(src, 'window.isPublicProviderVisible = isPublicProviderVisible');
    // _filterPubliclyVisibleVendors delegates to isPublicProviderVisible
    var filterFn = src.slice(src.indexOf('function _filterPubliclyVisibleVendors'),
                             src.indexOf('function _filterPubliclyVisibleVendors') + 600);
    assertContains(filterFn, 'isPublicProviderVisible(biz, regionId',
      '_filterPubliclyVisibleVendors must delegate to isPublicProviderVisible');
  });

  test('isPublicProviderVisible covers all inactive cases', function() {
    var fn = src.slice(src.indexOf('function isPublicProviderVisible'),
                       src.indexOf('function isPublicProviderVisible') + 1600);
    assertContains(fn, 'if (biz.active === false || biz.disabled === true) return false');
    assertContains(fn, "if (biz.status && String(biz.status).toLowerCase() === 'inactive') return false");
    assertContains(fn, 'if (biz.id && !_isVendorActive(biz.id)) return false');
    assertContains(fn, 'if (biz._homepageMarketplaceEntry === true) return true');
    assertContains(fn, "if (avail && avail.status === 'closed') return false");
  });

  test('Region-aware filter — vendor region or featuredRegions must match', function() {
    var fn = src.slice(src.indexOf('function isPublicProviderVisible'),
                       src.indexOf('function isPublicProviderVisible') + 1600);
    assertContains(fn, 'if (regionId)');
    assertContains(fn, '_regionMatchesId(regionStr, regionId)');
    assertContains(fn, 'featured.indexOf(regionId) < 0');
  });

  test('Firestore admin-cache load returns a Promise and is awaited before first render', function() {
    // Cache load must be a Promise stored on window so the renderer can await it.
    assertContains(src, 'window._vendorAdminCacheReady');
    var loaderFn = src.slice(src.indexOf('function loadVendorAdminStatuses'),
                             src.indexOf('function loadVendorAdminStatuses') + 800);
    assertContains(loaderFn, 'window._vendorAdminCacheReady = (async function()');
    // Renderer must await the cache before assembling vendors.
    var rendererSlice = src.split('async function renderHomepageVendors')[1] || '';
    assertContains(rendererSlice, 'await window._vendorAdminCacheReady',
      'renderHomepageVendors must await the admin cache to prevent first-paint leak');
  });

  test('Boot order: admin cache load fires before DLCRegion.init', function() {
    // The fix moves loadVendorAdminStatuses() ABOVE DLCRegion.init in the
    // DOMContentLoaded handler so the cache is loading before any render
    // callback runs.
    // Anchor on setUiLang(_siteLang) — only the second DOMContentLoaded
    // handler in script.js calls it. Slice forward from there to capture
    // the region + cache init block.
    var anchor = 'setUiLang(_siteLang);';
    var bootHandler = src.slice(src.indexOf(anchor), src.indexOf(anchor) + 2500);
    var loadIdx = bootHandler.indexOf('loadVendorAdminStatuses();');
    var initIdx = bootHandler.indexOf('DLCRegion.init(');
    assert(loadIdx > 0 && initIdx > 0, 'both calls must exist in DOMContentLoaded');
    assert(loadIdx < initIdx, 'loadVendorAdminStatuses() must run before DLCRegion.init() to populate cache early');
  });

  test('Vendor admin cache stores category + region (drives _hasActiveVendorInCategory)', function() {
    var loaderFn = src.slice(src.indexOf('function loadVendorAdminStatuses'),
                             src.indexOf('function loadVendorAdminStatuses') + 1500);
    assertContains(loaderFn, '_vendorAdminMeta');
    assertContains(loaderFn, 'category:');
    assertContains(loaderFn, 'region:');
    assertContains(src, 'function _hasActiveVendorInCategory');
    assertContains(src, 'window._hasActiveVendorInCategory = _hasActiveVendorInCategory');
  });

  test('HOMEPAGE_MARKETPLACE_ENTRIES gated on real active provider in region', function() {
    var withFn = src.slice(src.indexOf('function _withHomepageMarketplaceEntries'),
                           src.indexOf('function _withHomepageMarketplaceEntries') + 1400);
    assertContains(withFn, '_hasActiveVendorInCategory(entry.category',
      'marketplace region entries must require at least one active vendor in that category/region');
    assertContains(withFn, "_homepageMarketplaceEntry: true",
      'merged entries must be tagged so the filter knows to bypass the closed check');
  });

  test('Hero carousel slides 2-4 carry data-hc-category for active filtering', function() {
    assertContains(html, 'data-hc-category="food"');
    assertContains(html, 'data-hc-category="hair"');
    assertContains(html, 'data-hc-category="nails"');
  });

  test('applyHeroSlideVisibility hides inactive-category slides', function() {
    assertContains(src, 'function applyHeroSlideVisibility');
    assertContains(src, 'window.applyHeroSlideVisibility = applyHeroSlideVisibility');
    var fn = src.slice(src.indexOf('function applyHeroSlideVisibility'),
                       src.indexOf('function applyHeroSlideVisibility') + 1200);
    assertContains(fn, "getAttribute('data-hc-category')");
    assertContains(fn, '_hasActiveVendorInCategory(cat');
    assertContains(fn, 'slide.hidden = !visible');
    // Triggered from renderHomepageVendors so it runs on initial paint too.
    var rendererSlice = src.split('async function renderHomepageVendors')[1] || '';
    assertContains(rendererSlice, 'applyHeroSlideVisibility(regionId)');
  });

  test('HeroCarousel re-syncs to visible slides after filter runs', function() {
    var slice = src.slice(src.indexOf('var HeroCarousel = (function'),
                          src.indexOf('var HeroCarousel = (function') + 6000);
    assertContains(slice, 'function refresh()');
    assertContains(slice, 'function visibleSlides()');
    assertContains(slice, 'refresh: refresh');
    assertContains(slice, 'if (len < 2) return',
      'carousel must not auto-rotate when only one slide is visible');
  });

  test('Empty list hides the entire section instead of "Coming soon"', function() {
    assertContains(src, '<a class="hp-vendor-card"');
    var rendererSlice = src.split('async function renderHomepageVendors')[1] || '';
    assertContains(rendererSlice, 'vendors = _filterPubliclyVisibleVendors(vendors');
    assertContains(rendererSlice, 'section.hidden = true');
  });

  test('Firestore vendor docs preserve the active flag (not hardcoded true)', function() {
    assertContains(src, 'active: data.active !== false');
    assertNotContains(src,
      'active: true\n      });\n    });\n\n    vendors = _withHomepageMarketplaceEntries',
      'Firestore vendor assembly must not hardcode active:true (regression guard)');
  });

  test('Hard active-check skips vendors before they enter the list', function() {
    assertContains(src, 'if (data.active === false || data.disabled === true) return');
  });

  test('Region-scoped Mobile Barber entries still set availabilityStatus="now"', function() {
    assertContains(src, "availabilityStatus: 'now'");
  });

  test('_hasActiveVendorInCategory has Pass 3 for mobile-barber vendors', function() {
    // Mobile barber vendors live in MobileBarberData.sampleVendors, NOT in
    // MARKETPLACE and not always with a category field on the Firestore doc.
    // Without Pass 3, _hasActiveVendorInCategory("barber", region) returned
    // false even when active barbers served the region, hiding the routing
    // card from the homepage marketplace. Pin Pass 3 + region heuristics.
    var fn = src.slice(src.indexOf('function _hasActiveVendorInCategory'),
                       src.indexOf('function _hasActiveVendorInCategory') + 5500);
    assertContains(fn, 'window.MobileBarberData', 'Pass 3 must consult MobileBarberData');
    assertContains(fn, 'sampleVendors', 'Pass 3 must walk sampleVendors');
    assertContains(fn, 'serviceAreas', 'Pass 3 must check serviceAreas');
    assertContains(fn, "endsWith('-' + mbRegionKey)", 'Pass 3 must fall back to id-suffix hint');
    assertContains(fn, "synonyms", 'category synonyms must allow barber === mobile-barber');
    assertContains(fn, 'return !sawMatchingData',
      'Filter must fall OPEN when no source had data ABOUT THIS CATEGORY (prevents silent blanking of categories whose data module is not loaded on a given page — e.g. Mobile Barber on the main homepage which does NOT load mobile-barber-data.js)');
  });
}

if (require.main === module) {
  var passed = 0, failed = 0;
  runHomepageVisibilityTests(function(name, fn) {
    try { fn(); passed++; console.log('PASS', name); }
    catch (e) { failed++; console.log('FAIL', name); console.log(' ', e.message); }
  });
  console.log('Homepage visibility tests:', passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

module.exports = { runHomepageVisibilityTests: runHomepageVisibilityTests };
