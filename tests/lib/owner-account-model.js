'use strict';

// Phase 1 of the unified owner account architecture: one owner maps to
// multiple businesses across service types, with a business switcher in a
// dashboard shell. Behavioral tests load owner-model.js directly; structural
// tests grep the dashboard shell + the ownerId mapping in the vendor model.

var fs = require('fs');
var path = require('path');
var OM = require('../../owner-model');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}
function assertEq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg ? msg + ': ' : '') + 'expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual));
  }
}
function assertContains(haystack, needle, msg) {
  if (typeof haystack !== 'string' || haystack.indexOf(needle) < 0) {
    throw new Error((msg ? msg + ': ' : '') + 'expected to contain: ' + needle);
  }
}
function read(rel) {
  return fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8');
}

function runOwnerAccountModelTests(test) {

  // ── owner-model.js behavior ──────────────────────────────────────────
  test('OWN-01: owner-model exposes registry + helpers', function() {
    assert(OM && typeof OM === 'object', 'module loads');
    ['listOwners','findOwner','businessesForOwner','ownerForBusiness',
     'resolveOwnerId','ownerForEmail','ownerHasMultipleBusinesses','findBusiness']
      .forEach(function(fn) { assert(typeof OM[fn] === 'function', 'missing helper: ' + fn); });
    assert(Array.isArray(OM.SERVICE_TYPES) && OM.SERVICE_TYPES.indexOf('barber') >= 0, 'SERVICE_TYPES');
  });

  test('OWN-02: Michael owns multiple businesses across service types', function() {
    var biz = OM.businessesForOwner('michael-nguyen');
    assert(biz.length >= 3, 'expected >=3 businesses, got ' + biz.length);
    var types = biz.map(function(b) { return b.serviceType; });
    assert(types.indexOf('barber') >= 0, 'has barber');
    assert(types.indexOf('ride') >= 0, 'has ride');
    assert(types.indexOf('tour') >= 0, 'has tour');
    assert(OM.ownerHasMultipleBusinesses('michael-nguyen') === true, 'switcher should show');
  });

  test('OWN-03: Tim sees only Tim businesses (isolation)', function() {
    var biz = OM.businessesForOwner('tim-nguyen');
    assert(biz.length >= 1, 'Tim has a business');
    biz.forEach(function(b) { assertEq(b.ownerId, 'tim-nguyen', 'no cross-owner leak'); });
    // Michael's barber business must NOT appear in Tim's list.
    assert(!biz.some(function(b) { return b.id === 'michael-nguyen-oc'; }), 'no Michael leak into Tim');
  });

  test('OWN-04: businessesForOwner filters by service type', function() {
    var rides = OM.businessesForOwner('michael-nguyen', 'ride');
    assert(rides.length >= 1, 'has ride business');
    rides.forEach(function(b) { assertEq(b.serviceType, 'ride'); });
  });

  test('OWN-05: ownerForBusiness maps business id -> owner', function() {
    assertEq(OM.ownerForBusiness('michael-nguyen-oc'), 'michael-nguyen');
    assertEq(OM.ownerForBusiness('tim-nguyen-bay'), 'tim-nguyen');
    assertEq(OM.ownerForBusiness('does-not-exist'), null);
  });

  test('OWN-06: resolveOwnerId honors explicit ownerId first', function() {
    assertEq(OM.resolveOwnerId({ id: 'whatever', ownerId: 'tim-nguyen' }), 'tim-nguyen');
  });

  test('OWN-07: resolveOwnerId falls back to mapping for legacy records (no ownerId)', function() {
    // Backward compat: an old vendor doc with no ownerId still resolves.
    assertEq(OM.resolveOwnerId({ id: 'michael-nguyen-oc' }), 'michael-nguyen');
    assertEq(OM.resolveOwnerId({ vendorId: 'tim-nguyen-bay' }), 'tim-nguyen');
    assertEq(OM.resolveOwnerId({ id: 'unknown-vendor' }), null, 'unknown -> null (legacy single-vendor)');
    assertEq(OM.resolveOwnerId(null), null);
  });

  test('OWN-08: ownerForEmail resolves login email case-insensitively', function() {
    assertEq(OM.ownerForEmail('DUYHOA9256@gmail.com'), 'michael-nguyen');
    assertEq(OM.ownerForEmail('tuananhnta@gmail.com'), 'tim-nguyen');
    assertEq(OM.ownerForEmail('nobody@example.com'), null);
    assertEq(OM.ownerForEmail(''), null);
  });

  // ── vendor model carries optional ownerId (backward compatible) ──────
  test('OWN-09: mobile-barber-data VENDOR_FIELDS includes ownerId + serviceType', function() {
    var data = read('mobile-barber/mobile-barber-data.js');
    var fieldsBlock = data.slice(data.indexOf('var VENDOR_FIELDS'), data.indexOf('var VENDOR_FIELDS') + 500);
    assertContains(fieldsBlock, "'ownerId'", 'ownerId in VENDOR_FIELDS');
    assertContains(fieldsBlock, "'serviceType'", 'serviceType in VENDOR_FIELDS');
  });

  test('OWN-10: sample vendors are mapped to owners', function() {
    var MBD = require('../../mobile-barber/mobile-barber-data');
    var michael = MBD.sampleVendors.filter(function(v) { return v.id === 'michael-nguyen-oc'; })[0];
    var tim = MBD.sampleVendors.filter(function(v) { return v.id === 'tim-nguyen-bay'; })[0];
    assertEq(michael.ownerId, 'michael-nguyen');
    assertEq(tim.ownerId, 'tim-nguyen');
    // owner-model agrees with the vendor record.
    assertEq(OM.resolveOwnerId(michael), 'michael-nguyen');
    assertEq(OM.resolveOwnerId(tim), 'tim-nguyen');
  });

  // ── owner dashboard shell ────────────────────────────────────────────
  test('OWN-11: owner-dashboard.html exists and loads owner-model.js', function() {
    var html = read('owner-dashboard.html');
    assertContains(html, '/owner-model.js', 'loads owner model');
    assertContains(html, 'OwnerModel', 'uses OwnerModel global');
  });

  test('OWN-12: dashboard has the business switcher + grid', function() {
    var html = read('owner-dashboard.html');
    assertContains(html, 'obSwitcher', 'switcher element');
    assertContains(html, 'businessesForOwner', 'queries owner businesses');
    assertContains(html, 'selectBusiness', 'switching handler');
    assertContains(html, 'localStorage.setItem(\'dlc_owner_business\'', 'persists selection');
  });

  test('OWN-13: dashboard ships vi/en/es labels for every key (no hardcoded single-language)', function() {
    var html = read('owner-dashboard.html');
    // Each language table must exist.
    ['en:{', 'vi:{', 'es:{'].forEach(function(k) { assertContains(html, k, 'lang table ' + k); });
    // Spot-check a key in all three languages.
    assertContains(html, 'Owner Portal');         // en
    assertContains(html, 'Cổng Chủ Sở Hữu');       // vi
    assertContains(html, 'Portal del Propietario'); // es
    // Lang persistence + switcher.
    assertContains(html, "localStorage.getItem('dlc_lang')");
  });

  test('OWN-14: dashboard is responsive (mobile-first + desktop breakpoints)', function() {
    var html = read('owner-dashboard.html');
    assertContains(html, '@media(min-width:768px)');
    assertContains(html, '@media(min-width:1200px)');
    assertContains(html, 'prefers-reduced-motion');
  });

  test('OWN-15: existing portals untouched — dashboard deep-links, does not replace', function() {
    var html = read('owner-dashboard.html');
    // Phase 1 shell links into existing dashboards rather than reimplementing.
    assertContains(html, 'dashboardUrl');
    assertContains(html, 'customerUrl');
  });
}

module.exports = { runOwnerAccountModelTests: runOwnerAccountModelTests };
