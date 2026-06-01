'use strict';

// Pinning tests for the "Book this service" → manual booking form path.
// This bug was caused by the Book CTA sharing a handler with the AI chat
// panel. These tests assert the three flows are wired to three distinct
// helpers so they cannot collapse back into a single handler.

var fs = require('fs');
var path = require('path');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function read(rel) { return fs.readFileSync(path.join(__dirname, '../../', rel), 'utf8'); }

function runMobileBarberManualBookingTests(test) {

  test('M1. renderSelectedService renders summary only — no Book/Chat/Talk three-button row', function() {
    // The intermediate Book/Chat/Talk panel was removed. Select Service now
    // opens the manual booking form immediately; AI options live as small
    // secondary "Need help?" links inside the form footer.
    var src = read('mobile-barber/mobile-barber.js');
    var startIdx = src.indexOf('function renderSelectedService');
    assert(startIdx > 0, 'renderSelectedService must exist');
    var fn = src.slice(startIdx, startIdx + 3000);
    assert(fn.indexOf("t('bookThisService')") < 0,
      'renderSelectedService must NOT include the Book this service three-button row');
    assert(fn.indexOf("t('chatThisService')") < 0,
      'renderSelectedService must NOT include the chat-with-AI button in the panel');
    assert(fn.indexOf("t('talkThisService')") < 0,
      'renderSelectedService must NOT include the talk-with-AI button in the panel');
    assert(fn.indexOf('manualMount') >= 0,
      'renderSelectedService must still mount the manual booking form container');
  });

  test('M2. Per-card "Select Service" CTA opens manual form immediately (no AI redirect)', function() {
    var src = read('mobile-barber/mobile-barber.js');
    var startIdx = src.indexOf('cta.textContent = t(\'selectService\');');
    assert(startIdx > 0, 'select-service CTA must exist');
    var handler = src.slice(startIdx, startIdx + 1500);
    assert(handler.indexOf('selectService(service)') >= 0, 'Select still selects the service');
    assert(handler.indexOf('openManualBookingForm(service)') >= 0,
      'Select Service MUST open the manual booking form immediately (no intermediate panel)');
    assert(handler.indexOf('promptForLocation') < 0,
      'Select Service MUST NOT call promptForLocation — that opens the AI panel.');
    assert(handler.indexOf('openAssistantPanel') < 0,
      'Select Service MUST NOT directly open the AI panel.');
  });

  test('M2b. Manual booking form has a "Need help?" footer with Chat + Talk AI buttons', function() {
    var src = read('mobile-barber/mobile-barber.js');
    var fn  = src.slice(src.indexOf('function renderManualBookingPanel'),
                        src.indexOf('function renderManualBookingPanel') + 8000);
    assert(fn.indexOf('mb-manual-booking__help') >= 0,
      'Need-help footer must exist');
    assert(fn.indexOf("openAssistantPanel('general')") >= 0,
      'Footer chat button must open AI assistant');
    assert(fn.indexOf('openVoiceAssistant()') >= 0,
      'Footer voice button must open voice assistant');
    assert(fn.indexOf("'manualBookingHelpLabel'") >= 0,
      'Need-help label i18n key must be used');
    // i18n key defined in all 3 languages
    var keyCount = src.split('manualBookingHelpLabel:').length - 1;
    assert(keyCount >= 3, 'manualBookingHelpLabel must exist in vi/en/es (found ' + keyCount + ')');
  });

  test('M3. openManualBookingForm + renderManualBookingPanel + submitManualBooking exist', function() {
    var src = read('mobile-barber/mobile-barber.js');
    assert(src.indexOf('function openManualBookingForm') >= 0, 'openManualBookingForm must exist');
    assert(src.indexOf('function renderManualBookingPanel') >= 0, 'renderManualBookingPanel must exist');
    assert(src.indexOf('function submitManualBooking') >= 0, 'submitManualBooking must exist');
    assert(src.indexOf('state.manualBooking') >= 0, 'manualBooking state slice must exist');
  });

  test('M4. submitManualBooking goes direct (no chat agent)', function() {
    var src = read('mobile-barber/mobile-barber.js');
    var startIdx = src.indexOf('function submitManualBooking');
    // Window covers the whole function — it grew when route-aware address
    // validation + best-slot alternates were added before the buildBooking call.
    var fn = src.slice(startIdx, startIdx + 11500);
    assert(fn.indexOf('BOOKING.findVendorForAddress') >= 0, 'must route via findVendorForAddress');
    assert(fn.indexOf('BOOKING.checkAvailability') >= 0, 'must call checkAvailability');
    assert(fn.indexOf('BOOKING.buildBooking') >= 0, 'must call buildBooking');
    assert(fn.indexOf('BOOKING.saveBooking') >= 0, 'must call saveBooking');
    assert(fn.indexOf('requireDatabase: true') >= 0, 'must require Firestore write');
    assert(fn.indexOf('AGENT.handleMessage') < 0, 'must NOT route through chat agent');
    assert(fn.indexOf('openAssistantPanel') < 0, 'must NOT open the AI panel');
  });

  test('M5. Manual booking attaches selected AI hairstyle if present', function() {
    var src = read('mobile-barber/mobile-barber.js');
    var startIdx = src.indexOf('function submitManualBooking');
    // Window covers the whole function — it grew when route-aware address
    // validation + best-slot alternates were added before the buildBooking call.
    var fn = src.slice(startIdx, startIdx + 11500);
    assert(fn.indexOf('state.aiPreview') >= 0, 'must read AI preview state');
    assert(fn.indexOf('selectedAiStyleId') >= 0, 'must attach selectedAiStyleId');
    assert(fn.indexOf('selectedAiStyleName') >= 0, 'must attach selectedAiStyleName');
    assert(fn.indexOf('selectedAiStyleImage') >= 0, 'must attach selectedAiStyleImage');
    assert(fn.indexOf('selectedAiBarberNotes') >= 0, 'must attach selectedAiBarberNotes');
  });

  test('M6. i18n: manualBooking* keys present in en, vi, es', function() {
    var src = read('mobile-barber/mobile-barber.js');
    var keys = [
      'manualBookingFormTitle', 'manualBookingPhone', 'manualBookingName',
      'manualBookingAddress', 'manualBookingCity', 'manualBookingZip',
      'manualBookingDate', 'manualBookingTime', 'manualBookingNotes',
      'manualBookingSubmit', 'manualBookingSuccess', 'manualBookingMissing',
      'manualBookingNoVendor', 'manualBookingCancel'
    ];
    keys.forEach(function(k) {
      // each key should appear at least 3 times (en + vi + es definitions)
      var count = src.split(k + ':').length - 1;
      assert(count >= 3, 'i18n key ' + k + ' must be defined in all 3 languages (found ' + count + ')');
    });
  });

  test('M7. CSS ships manual booking panel + expand animation', function() {
    var css = read('mobile-barber/mobile-barber.css');
    assert(css.indexOf('.mb-manual-booking') >= 0, 'manual-booking selector must exist');
    assert(css.indexOf('.mb-manual-booking__submit') >= 0, 'submit class must exist');
    assert(css.indexOf('.mb-manual-booking__success') >= 0, 'success class must exist');
    assert(css.indexOf('mbManualBookingExpand') >= 0, 'expand keyframe must exist');
    assert(css.indexOf('prefers-reduced-motion') >= 0, 'must respect reduced motion');
  });

  test('M8. Hero/CTA chat/voice triggers still open AI assistants', function() {
    // Regression check: do not accidentally rewire the legitimate AI CTAs.
    var src = read('mobile-barber/mobile-barber.js');
    assert(src.indexOf("openVoiceAssistant()") >= 0, 'voice CTA wiring must remain');
    assert(src.indexOf("openAssistantPanel('general')") >= 0, 'chat CTA wiring must remain');
  });
}

if (require.main === module) {
  var passed = 0, failed = 0;
  runMobileBarberManualBookingTests(function(name, fn) {
    try { fn(); passed++; console.log('PASS', name); }
    catch (e) { failed++; console.log('FAIL', name); console.log(' ', e.message); }
  });
  console.log('Mobile Barber manual booking tests:', passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

module.exports = { runMobileBarberManualBookingTests: runMobileBarberManualBookingTests };
