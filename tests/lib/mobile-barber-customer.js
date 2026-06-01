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
    assertContains(html, '/mobile-barber/mobile-barber-customer.js?v=20260601b');
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

  test('Mobile Barber login/signup closes the account modal instead of trapping the user', function() {
    assertContains(customerJs, 'function closeAccountModal()');
    // Success handlers must CLOSE the modal (+ toast), not re-open the account panel.
    assertContains(customerJs, "closeAccountModal(); toast(t('signedIn'))");
    assert(customerJs.indexOf('}).then(function() { openAccountPanel(); })') < 0,
      'signup/login success must close the account modal, not re-open it');
    // The auth-state listener must NOT auto-open the modal (no trap on refresh).
    var authIdx = customerJs.indexOf('onAuthStateChanged(function(user)');
    assert(authIdx >= 0, 'auth state listener must exist');
    assert(customerJs.slice(authIdx, authIdx + 350).indexOf('openAccountPanel(') < 0,
      'auth state listener must NOT auto-open the account modal');
    // Account panel opens only when the small account button is tapped.
    assertContains(customerJs, "addEventListener('click', openAccountPanel)");
    // The modal is dismissible (close X removes the panel).
    assertContains(customerJs, "querySelector('.mb-customer-panel__close').addEventListener('click', function() { panel.remove(); })");
  });

  test('Mobile Barber login persistence is set before auth and never cleared on the page', function() {
    // Persistence is LOCAL and applied BEFORE login/signup (ensureAuthReady wraps both).
    assertContains(customerJs, 'function ensureAuthReady()');
    assertContains(customerJs, 'a.setPersistence ? a.setPersistence(P)');
    assertContains(customerJs, 'ensureAuthReady().then(function(a) {');
    // No code path signs the user out except the explicit logout button.
    var signOutCount = (customerJs.match(/\.signOut\(\)/g) || []).length;
    assert(signOutCount === 1, 'exactly one signOut() — the explicit Log out button (found ' + signOutCount + ')');
    assertContains(customerJs, 'id="mbCustomerLogoutBtn"');
    assertContains(customerJs, "querySelector('#mbCustomerLogoutBtn').addEventListener('click', function() { auth().signOut(); })");
  });

  test('Mobile Barber notification settings expose status + 5 per-type toggles', function() {
    // Status indicator: Enabled / Disabled / Not supported.
    assertContains(customerJs, 'function notifPermissionStatus()');
    assertContains(customerJs, 'notifStatusLabel');
    assertContains(customerJs, 'notifEnabled');
    assertContains(customerJs, 'notifDisabled');
    assertContains(customerJs, 'notifUnsupported');
    // Permission requested only on tap (CTA only when status is undecided).
    assertContains(customerJs, "var showEnable = (st === 'default')");
    // Five typed toggles, default ON, matching the server gate keys.
    assertContains(customerJs, "var NOTIF_TYPE_KEYS = ['bookingUpdates', 'confirmations', 'reschedules', 'appointmentReminders', 'haircutReminders']");
    assertContains(customerJs, 'function notifTogglesHtml()');
    assertContains(customerJs, 'data-notif-key=');
    assertContains(customerJs, 'function wireSettings(body)');
    assertContains(customerJs, "set({ notificationPreferences: prefs, updatedAt: serverTimestamp() }, { merge: true })");
  });

  test('Mobile Barber haircut reminder offers 2/3/4/6/8 weeks + custom', function() {
    assertContains(customerJs, 'reminder2');
    assertContains(customerJs, 'reminder8');
    assertContains(customerJs, 'reminderCustom');
    assertContains(customerJs, 'mbReminderCustom');
    assertContains(customerJs, "opt(2, 'reminder2')");
    assertContains(customerJs, "opt(8, 'reminder8')");
    // The old literal-dotted-key bug is gone; nested-map merge is used instead.
    assert(customerJs.indexOf("'notificationPreferences.reminders'") < 0,
      'must not write a literal dotted key — use a nested map merge');
    assertContains(customerJs, 'notificationPreferences: { reminders: weeks > 0 }');
  });

  test('Mobile Barber unread count mirrors to the Home Screen app-icon badge', function() {
    assertContains(customerJs, 'function setAppBadgeSafe(count)');
    assertContains(customerJs, 'nav.setAppBadge(count)');
    assertContains(customerJs, 'nav.clearAppBadge()');
    assertContains(customerJs, 'setAppBadgeSafe(count);');
  });

  test('Mobile Barber My Bookings shows status, barber, payment and promotion', function() {
    assertContains(customerJs, 'function statusLabel(status)');
    assertContains(customerJs, "t('fPayment') + ': ' + b.paymentMethod");
    assertContains(customerJs, 'b.promoApplied');
    assertContains(customerJs, "t('fPromo') + ': ' + promo");
    assertContains(customerJs, "t('fBarber') + ': ' + barber");
  });

  test('Mobile Barber server gates customer notifications by per-type preference', function() {
    assertContains(functionsJs, 'function mbCustomerNotifPrefKey(type)');
    assertContains(functionsJs, 'function mbNotifTypeEnabled(prefs, prefKey)');
    assertContains(functionsJs, 'function mbGetCustomerNotifContext(customerId)');
    assertContains(functionsJs, 'mbNotifTypeEnabled(ctx.prefs, mbCustomerNotifPrefKey(copy.type))');
    // Haircut reminders + appointment reminders are gated too.
    assertContains(functionsJs, "mbNotifTypeEnabled(ctx.prefs, 'haircutReminders')");
    assertContains(functionsJs, "mbNotifTypeEnabled(ctx.prefs, 'appointmentReminders')");
    assertContains(functionsJs, "type: 'appointment_reminder'");
    assertContains(functionsJs, "where('requestedDate', '==', tomorrow)");
  });

  test('Mobile Barber server notification copy is multilingual (vi/en/es)', function() {
    assertContains(functionsJs, 'function mbCustomerNotifStrings(lang)');
    assertContains(functionsJs, 'function mbNormLang(lang)');
    // English (default) + Vietnamese + Spanish copies all present.
    assertContains(functionsJs, "confirmedBody: 'Your haircut appointment is confirmed.'");
    assertContains(functionsJs, 'Lịch cắt tóc của bạn đã được xác nhận.');
    assertContains(functionsJs, 'Su cita de corte está confirmada.');
    assertContains(functionsJs, 'mbCustomerNotificationCopy(nextStatus, ctx.lang)');
  });

  test('Mobile Barber new settings strings exist in all three languages', function() {
    var keys = ['settingsTitle', 'preferredBarber', 'notifConfirmations', 'notifAppointmentReminders', 'reminderCustomWeeks', 'fPayment', 'stConfirmed'];
    ['en', 'vi', 'es'].forEach(function(lng) {
      var blockStart = customerJs.indexOf(lng + ': {');
      assert(blockStart >= 0, lng + ' language block exists');
    });
    keys.forEach(function(k) {
      // Each key must appear at least 3 times (once per language table).
      var count = customerJs.split(k + ':').length - 1;
      assert(count >= 3, 'string "' + k + '" must exist in vi/en/es (found ' + count + ')');
    });
  });
}

module.exports = {
  runMobileBarberCustomerTests: runMobileBarberCustomerTests
};
