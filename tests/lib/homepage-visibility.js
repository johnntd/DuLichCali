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

  test('Homepage filter helper exists in script.js', function() {
    assertContains(src, 'function _filterPubliclyVisibleVendors');
    assertContains(src, 'window._filterPubliclyVisibleVendors = _filterPubliclyVisibleVendors');
  });

  test('Inactive vendors hidden (active === false branch)', function() {
    assertContains(src, 'if (biz.active === false || biz.disabled === true) return false');
  });

  test('Inactive status hidden (status === "inactive" branch)', function() {
    assertContains(src, "if (biz.status && String(biz.status).toLowerCase() === 'inactive') return false");
  });

  test('Currently-closed vendors hidden (computeBizAvailability === closed branch)', function() {
    assertContains(src, "if (avail && avail.status === 'closed') return false");
  });

  test('Marketplace homepage entries (Mobile Barber region cards) bypass the closed check', function() {
    assertContains(src, 'if (biz._homepageMarketplaceEntry === true) return true');
  });

  test('Empty list hides the entire section instead of "Coming soon"', function() {
    // The fix replaces the previous "Coming soon" filler with section.hidden=true
    // when no publicly visible vendors remain.
    assertContains(src, '<a class="hp-vendor-card"');
    // Ensure the renderer applies the filter and sets section.hidden=true
    var rendererSlice = src.split('async function renderHomepageVendors')[1] || '';
    assertContains(rendererSlice, 'vendors = _filterPubliclyVisibleVendors(vendors)');
    assertContains(rendererSlice, 'section.hidden = true');
  });

  test('Firestore vendor docs preserve the active flag (not hardcoded true)', function() {
    // Regression: a previous version hardcoded `active: true` for every
    // Firestore-sourced vendor, defeating the downstream filter. Verify
    // the assembled object now reads from data.active.
    assertContains(src, 'active: data.active !== false');
    assertNotContains(src,
      'active: true\n      });\n    });\n\n    vendors = _withHomepageMarketplaceEntries',
      'Firestore vendor assembly must not hardcode active:true (regression guard)');
  });

  test('Hard active-check skips vendors before they enter the list', function() {
    // Belt-and-suspenders: even before the post-filter, the Firestore loop
    // discards `data.active === false` rows so they never get assembled.
    assertContains(src, 'if (data.active === false || data.disabled === true) return');
  });

  test('Region-scoped Mobile Barber entries still set availabilityStatus="now"', function() {
    // Guards against accidentally removing the always-available marker on
    // the marketplace region cards (which would hide them via the closed
    // filter).
    assertContains(src, "availabilityStatus: 'now'");
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
