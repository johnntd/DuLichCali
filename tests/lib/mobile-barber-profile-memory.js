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
// Slice out a function body by name so we can assert what is / is NOT inside it.
function fnBody(src, signature) {
  var start = src.indexOf(signature);
  if (start < 0) return '';
  var nextExport = src.indexOf('\nexports.', start + signature.length);
  var nextFn = src.indexOf('\nasync function ', start + signature.length);
  var nextFn2 = src.indexOf('\nfunction ', start + signature.length);
  var ends = [nextExport, nextFn, nextFn2].filter(function(n) { return n > 0; });
  var end = ends.length ? Math.min.apply(null, ends) : src.length;
  return src.slice(start, end);
}

function runMobileBarberProfileMemoryTests(test) {
  var agentJs = read('mobile-barber/mobile-barber-agent.js');
  var bookingJs = read('mobile-barber/mobile-barber-booking.js');
  var customerJs = read('mobile-barber/mobile-barber-customer.js');
  var vendorJs = read('mobile-barber/mobile-barber-vendor.js');
  var functionsJs = read('functions/index.js');
  var rules = read('firestore.rules');

  // Test 1 — new customer creates a profile after a booking (server, every write).
  test('Profile memory: server upserts a customer profile on EVERY booking write', function() {
    assertContains(functionsJs, 'async function mbUpsertCustomerProfileFromBooking(booking, bookingId)');
    // Called before the status-change short-circuit so it fires on create too.
    assertContains(functionsJs, 'await mbUpsertCustomerProfileFromBooking(after, event.params.bookingId)');
    var body = fnBody(functionsJs, 'async function mbUpsertCustomerProfileFromBooking');
    // Keys on the doc id for both logged-in (uid) and anonymous (phone).
    assertContains(body, "const docId = uid || ('phone_' + phone)");
    assertContains(body, "db.collection('mobileBarberCustomers').doc(docId)");
    assertContains(body, 'lastServiceId');
    assertContains(body, 'lastBookingId');
    assertContains(body, 'bookingHistory');
  });

  // Test 2 — returning phone loads the richer profile via lookup projection.
  test('Profile memory: lookup projection returns the richer memory fields', function() {
    assertContains(bookingJs, 'function lookupReturningCustomer(vendorId, phone, options)');
    var body = fnBody(bookingJs, 'function safeCustomerRecord(data, vendorId, phone)');
    assertContains(body, 'preferredLanguage');
    assertContains(body, 'paymentMethod');
    assertContains(body, 'confirmationPreference');
    assertContains(body, 'reminderPreferenceWeeks');
    assertContains(body, 'haircutPreferences');
    assertContains(body, 'bookingHistory');
  });

  // Test 3 — manual (vendor) booking pre-fills from the saved profile.
  test('Profile memory: vendor portal loads + applies saved customer profile (manual prefill)', function() {
    assertContains(vendorJs, 'lookupReturningCustomer');
  });

  // Tests 4 & 5 — AI chat AND voice (shared brain) inject profile context.
  test('Profile memory: AI brain prompt injects sanitized returning-customer context', function() {
    assertContains(agentJs, 'function _sanitizeForPrompt(v)');
    assertContains(agentJs, "slotLines.push('preferredBarber: ' + _sanitizeForPrompt(state.barberPreference))");
    assertContains(agentJs, "slotLines.push('previousService: ' + _sanitizeForPrompt(state.previousServiceName))");
    assertContains(agentJs, "slotLines.push('previousAddress: ' + _sanitizeForPrompt(_prevAddr))");
    assertContains(agentJs, 'bookingHistorySummary: ');
    // Sanitizer strips bracket/brace/newline so a stored value can't forge a STATE marker.
    assertContains(agentJs, "replace(/[\\[\\]{}\\n\\r]/g, ' ')");
  });

  test('Profile memory: explicit "same address AND same style as last time?" confirmation exists', function() {
    // String present in all three languages.
    assert((agentJs.split('foundCustomerStyle:').length - 1) >= 3, 'foundCustomerStyle in vi/en/es');
    assertContains(agentJs, 'styleConfirmed');
    assertContains(agentJs, "reply(lang, 'foundCustomerStyle'");
    // Affirming at the confirm step adopts the previous service (gated on the step).
    assertContains(agentJs, "previousStep === 'IF_EXISTING_CUSTOMER_CONFIRM_PROFILE' && !state.styleConfirmed");
    assertContains(agentJs, 'state.serviceId = state.previousServiceId');
  });

  // Test 6 — updated address saves back; language never overwritten.
  test('Profile memory: server saves updated address back, never overwrites a set language', function() {
    var body = fnBody(functionsJs, 'async function mbUpsertCustomerProfileFromBooking');
    assertContains(body, "put('address', booking.address)");
    assertContains(body, "put('city', booking.city)");
    assertContains(body, "put('zip', booking.zip)");
    assertContains(body, 'if (!trimv(existing.preferredLanguage))');
  });

  // Test 7 — selected haircut style saves to profile; NO image/selfie persisted.
  test('Profile memory: style memory is TEXT-only (no AI image/selfie persisted)', function() {
    var body = fnBody(functionsJs, 'async function mbUpsertCustomerProfileFromBooking');
    assertContains(body, 'styleId: booking.selectedAiStyleId');
    assertContains(body, 'color: booking.selectedColorRecommendation');
    assertContains(body, 'styleDescription: booking.selectedAiStyleDescription');
    assert(body.indexOf('selectedAiStyleImage') < 0,
      'profile upsert must NOT persist selectedAiStyleImage (no stored AI hairstyle images)');
  });

  // Test 8 — vendor reads a profile only for assigned bookings (rule + trigger marker).
  test('Profile memory: vendor read is scoped to assigned bookings via vendorAccess marker', function() {
    assertContains(rules, 'match /vendorAccess/{vid}');
    assertContains(rules, '/vendorAccess/$(resource.data.vendorId)');
    assertContains(rules, 'exists(/databases/$(database)/documents/mobileBarberCustomers/$(customerId)/vendorAccess/');
    // The trigger writes the marker so the rule has something to check.
    var body = fnBody(functionsJs, 'async function mbUpsertCustomerProfileFromBooking');
    assertContains(body, ".collection('vendorAccess').doc(vendorId)");
  });
}

module.exports = { runMobileBarberProfileMemoryTests: runMobileBarberProfileMemoryTests };
