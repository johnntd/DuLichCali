'use strict';

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

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '../..', relPath), 'utf8');
}

function runMobileBarberCustomerTests(test) {
  var html = read('mobile-barber/index.html');
  var customerJs = read('mobile-barber/mobile-barber-customer.js');
  var bookingJs = read('mobile-barber/mobile-barber-booking.js');
  var dataJs = read('mobile-barber/mobile-barber-data.js');
  var swJs = read('mobile-barber/sw.js');
  var manifest = read('mobile-barber/manifest-customer.webmanifest');
  var rules = read('firestore.rules');
  var functionsJs = read('functions/index.js');
  var css = read('mobile-barber/mobile-barber.css');

  test('Mobile Barber customer PWA manifest and iOS tags are wired', function() {
    assertContains(html, 'apple-mobile-web-app-capable');
    assertContains(html, 'apple-mobile-web-app-title');
    assertContains(html, 'apple-touch-icon');
    assertContains(html, '/mobile-barber/manifest-customer.webmanifest');
    assertContains(manifest, '"name": "DuLichCali Mobile Barber"');
    assertContains(manifest, '"short_name": "Mobile Barber"');
    assertContains(manifest, '"start_url": "/mobile-barber"');
    assertContains(manifest, '"scope": "/mobile-barber/"');
    assertContains(manifest, '"display": "standalone"');
    assertContains(manifest, 'mobile-barber-customer-maskable-512.png');
    assertContains(swJs, 'manifest-customer.webmanifest');
    assertContains(swJs, "audience || '') === 'customer'");
  });

  test('Mobile Barber customer auth uses LOCAL persistence and phone-derived identity', function() {
    assertContains(html, '/mobile-barber/mobile-barber-customer.js?v=20260531i');
    assertContains(customerJs, 'Auth.Persistence.LOCAL');
    assertContains(customerJs, 'customerEmailForPhone');
    assertContains(customerJs, '@mobile-barber.dulichcali21.local');
    assertContains(customerJs, 'createUserWithEmailAndPassword');
    assertContains(customerJs, 'signInWithEmailAndPassword');
    assertContains(customerJs, 'sendPasswordResetEmail');
    assertContains(customerJs, 'passwordScore');
    assertContains(customerJs, 'pass.length >= 12');
    assertContains(customerJs, 'commonPassword');
  });

  test('Mobile Barber AI hairstyle generation is gated to logged-in customers', function() {
    assertContains(customerJs, 'login_required');
    assertContains(customerJs, 'AIP.generate = function(opts)');
    assertContains(customerJs, 'if (!isCustomerUser())');
    assertContains(customerJs, 'mb-ai-login-gate');
    assertContains(customerJs, 'saveStyleFromCard');
    assertContains(customerJs, "collection('customerSavedStyles')");
    assertContains(css, '.mb-ai-preview--locked');
  });

  test('Mobile Barber customer booking records link customer profile fields', function() {
    assertContains(dataJs, 'customerNotifications');
    assertContains(dataJs, 'customerSavedStyles');
    assertContains(dataJs, 'customerReminderPreferences');
    assertContains(dataJs, 'customerProfileSnapshot');
    assertContains(bookingJs, 'customerId: trim(draft.customerId || draft.customerUid)');
    assertContains(bookingJs, 'normalizedPhone: normalizePhone');
    assertContains(customerJs, 'customerProfileSnapshot');
    assertContains(customerJs, 'BOOKING.buildBooking = function(input)');
  });

  test('Mobile Barber customer notifications and reminders are scoped and server-backed', function() {
    assertContains(customerJs, "collection('customerNotifications')");
    assertContains(customerJs, "where('customerId', '==', user.uid)");
    assertContains(customerJs, 'mbCustomerBadge');
    assertContains(customerJs, 'enablePush');
    assertContains(functionsJs, 'onMobileBarberCustomerBookingStatus');
    assertContains(functionsJs, 'sendMobileBarberCustomerPush');
    assertContains(functionsJs, 'checkMobileBarberCustomerReminders');
    assertContains(functionsJs, 'Your haircut appointment is confirmed.');
    assertContains(functionsJs, 'Your barber needs more information about your appointment.');
    assertContains(functionsJs, 'It may be time for your next haircut. Would you like to book again?');
  });

  test('Mobile Barber Firestore rules protect customer-owned account data', function() {
    assertContains(rules, 'match /customerNotifications/{notificationId}');
    assertContains(rules, 'match /customerSavedStyles/{styleId}');
    assertContains(rules, 'match /customerReminderPreferences/{prefId}');
    assertContains(rules, 'match /pushSubscriptions/{subId}');
    assertContains(rules, 'customerId == request.auth.uid');
    assertContains(rules, 'resource.data.customerId == request.auth.uid');
    assertContains(rules, 'request.resource.data.customerId == request.auth.uid');
  });

  test('Mobile Barber new customer-facing strings are multilingual', function() {
    assertContains(customerJs, 'en: {');
    assertContains(customerJs, 'vi: {');
    assertContains(customerJs, 'es: {');
    assertContains(customerJs, 'loginForAi');
    assertContains(customerJs, 'enableNotifications');
    assertContains(customerJs, 'bookingAccountPrompt');
  });
}

module.exports = {
  runMobileBarberCustomerTests: runMobileBarberCustomerTests
};
