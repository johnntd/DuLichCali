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

function assertNotContains(haystack, needle, msg) {
  if (typeof haystack === 'string' && haystack.indexOf(needle) >= 0) {
    throw new Error((msg ? msg + ': ' : '') + 'must NOT contain: ' + needle);
  }
}

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, '../..', relPath), 'utf8');
}

function assertFirebaseLoadsBeforeMobileBarberScripts(html, label) {
  var appIndex = html.indexOf('firebase-app-compat.js');
  var firestoreIndex = html.indexOf('firebase-firestore-compat.js');
  var initIndex = html.indexOf('firebase.initializeApp(');
  var mbScriptIndex = html.indexOf('/mobile-barber/mobile-barber-');
  assert(appIndex >= 0, label + ' must load firebase-app-compat.js');
  assert(firestoreIndex >= 0, label + ' must load firebase-firestore-compat.js');
  assert(initIndex >= 0, label + ' must initialize Firebase');
  assert(mbScriptIndex >= 0, label + ' must load a Mobile Barber script');
  assert(appIndex < mbScriptIndex, label + ' firebase app SDK must load before Mobile Barber scripts');
  assert(firestoreIndex < mbScriptIndex, label + ' firestore SDK must load before Mobile Barber scripts');
  assert(initIndex < mbScriptIndex, label + ' Firebase init must run before Mobile Barber scripts');
}

function runMobileBarberLandingTests(test) {
  var html = read('mobile-barber/index.html');
  var vendorHtml = read('mobile-barber/vendor.html');
  var dashboardHtml = read('mobile-barber/dashboard.html');
  var css = read('mobile-barber/mobile-barber.css');
  var js = read('mobile-barber/mobile-barber.js');
  var vendorJs = read('mobile-barber/mobile-barber-vendor.js');
  var voiceJs = read('mobile-barber/mobile-barber-voice.js');
  var dashboardJs = read('mobile-barber/mobile-barber-dashboard.js');
  var notificationsJs = read('notifications.js');
  var functionsJs = read('functions/index.js');
  var firebase = read('firebase.json');
  var firestoreRules = read('firestore.rules');

  test('Mobile Barber route has a static index page', function() {
    assertContains(html, 'id="mobileBarberApp"');
    assertContains(firebase, '"source": "/mobile-barber"');
    assertContains(firebase, '"destination": "/mobile-barber/index.html"');
  });

  test('Mobile Barber page loads scoped CSS and versioned JS', function() {
    assertContains(html, '/mobile-barber/mobile-barber.css?v=20260525p');
    assertContains(html, '/mobile-barber/mobile-barber-data.js?v=20260524o');
    assertContains(html, '/mobile-barber/mobile-barber-booking.js?v=20260525f');
    assertContains(html, '/mobile-barber/mobile-barber-agent.js?v=20260525e');
    assertContains(html, '/mobile-barber/mobile-barber-voice.js?v=20260525f');
    assertContains(html, '/mobile-barber/mobile-barber.js?v=20260525f');
  });

  test('Mobile Barber pages load Firebase before local runtime scripts', function() {
    assertFirebaseLoadsBeforeMobileBarberScripts(html, 'index.html');
    assertFirebaseLoadsBeforeMobileBarberScripts(vendorHtml, 'vendor.html');
    assertFirebaseLoadsBeforeMobileBarberScripts(dashboardHtml, 'dashboard.html');
  });

  test('Mobile Barber landing content is translation-table driven', function() {
    assertContains(js, 'var STRINGS = {');
    assertContains(js, 'en: {');
    assertContains(js, 'vi: {');
    assertContains(js, 'es: {');
    assertContains(js, "heroTitle: 'Mobile Barber — In-Home Haircuts'");
    assertContains(html, 'data-i18n="heroTitle"');
  });

  test('Mobile Barber page includes required customer CTAs', function() {
    assertContains(js, "bookNow: 'Book Now'");
    assertContains(js, "chatAssistant: 'Chat with AI Barber Assistant'");
    assertContains(js, "talkAssistant: 'Talk to AI Barber Assistant'");
    assertContains(html, 'data-action="chat"');
    assertContains(html, 'data-action="voice"');
  });

  test('Mobile Barber page renders from Phase 1 data model', function() {
    assertContains(html, '/mobile-barber/mobile-barber-data.js');
    assertContains(js, 'DATA.sampleServices');
    assertContains(js, 'DATA.sampleVendors');
    assertContains(js, 'DATA.findServiceImageByServiceId');
    assertContains(js, 'empty.hidden = vendors.length > 0');
    assertContains(js, "'/mobile-barber/vendor/' + encodeURIComponent(vendor.id)");
  });

  test('Mobile Barber landing has mobile service slider and selection CTAs', function() {
    assertContains(html, 'mb-service-selector');
    assertContains(html, 'id="mbServiceProgress"');
    assertContains(html, 'id="mbServiceSelection"');
    assertContains(js, 'selectedServiceId');
    assertContains(js, 'selectService(service)');
    assertContains(js, 'vendorUrl(service,');
    assertContains(js, "params.set('assistant', mode)");
    assertContains(js, "params.set('lang'");
    assertContains(js, 'openVoiceAssistant()');
    assertContains(js, 'voiceSelectedService');
    assertContains(html, 'id="mbPromoTitle"');
    assertContains(html, 'id="mbPromoPreview"');
    assertContains(js, 'promoTitle');
    assertContains(js, 'renderPromoPreview');
    assertContains(css, 'mb-promo__preview');
    assertContains(css, 'mb-promo__card');
    assertContains(css, '@media (max-width: 768px)');
    assertContains(css, 'scroll-snap-type: x mandatory');
    assertContains(css, 'mb-service-card--selected');
    assertContains(css, '@media (prefers-reduced-motion: reduce)');
  });

  test('Mobile Barber page does not duplicate global bottom navigation', function() {
    assertNotContains(html, 'bottom-nav');
    assertNotContains(html, 'tabHome');
    assertNotContains(html, 'navHome');
  });

  test('Mobile Barber CSS covers mobile and desktop layouts', function() {
    assertContains(css, '@media (min-width: 680px)');
    assertContains(css, '@media (min-width: 1200px)');
    assertContains(css, '100dvh');
    assertContains(css, 'env(safe-area-inset');
  });

  test('Mobile Barber vendor route has a single-vendor page', function() {
    assertContains(firebase, '"source": "/mobile-barber/vendor/**"');
    assertContains(firebase, '"destination": "/mobile-barber/vendor.html"');
    assertContains(vendorHtml, 'id="mobileBarberVendorApp"');
    assertContains(vendorHtml, '/mobile-barber/mobile-barber.css?v=20260525p');
    assertContains(vendorHtml, 'id="mbVendorName"');
    assertContains(vendorHtml, 'id="mbVendorServices"');
    assertContains(vendorHtml, 'id="mbBookingTitle"');
    assertContains(vendorHtml, 'id="mbVendorPromoTitle"');
    assertContains(vendorHtml, 'id="mbSelectedServiceSummary"');
    assertContains(vendorHtml, 'class="mb-mobile-sticky-cta"');
    assertContains(vendorHtml, '/mobile-barber/mobile-barber-data.js?v=20260524o');
    assertContains(vendorHtml, '/mobile-barber/mobile-barber-booking.js?v=20260525f');
    assertContains(vendorHtml, '/ai-engine.js?v=20260524a');
    assertContains(vendorHtml, '/mobile-barber/mobile-barber-agent.js?v=20260525e');
    assertContains(vendorHtml, '/mobile-barber/mobile-barber-voice.js?v=20260525f');
    assertContains(vendorHtml, 'firebase-functions-compat.js');
    assertContains(vendorHtml, '/notifications.js?v=20260525a');
    assertContains(vendorHtml, '/mobile-barber/mobile-barber-vendor.js?v=20260525n');
    assert(vendorHtml.indexOf('/ai-engine.js?v=') < vendorHtml.indexOf('/mobile-barber/mobile-barber-agent.js'), 'ai-engine.js must load before mobile-barber-agent.js');
  });

  test('Mobile Barber vendor page is vendor-id scoped', function() {
    assertContains(vendorJs, 'function getVendorId()');
    assertContains(vendorJs, "DATA.findVendorById(vendorId)");
    assertContains(vendorJs, 'DATA.listServicesForVendor(state.vendor.id)');
    assertContains(vendorJs, 'interpolate(t(\'assistantCopy\'), { vendorId: vendor.id })');
    assertNotContains(vendorHtml, 'mbVendorList', 'vendor page must not render a marketplace listing grid');
  });

  test('Mobile Barber vendor page covers error, fallback image, booking, and upload states', function() {
    assertContains(vendorJs, 'Barber profile not found');
    assertContains(vendorJs, 'fallbackImage');
    assertContains(vendorJs, 'img.onerror');
    assertContains(vendorHtml, 'data-action="openAssistant"');
    assertContains(vendorHtml, 'data-action="openVoiceAssistant"');
    assertContains(vendorHtml, 'id="mbAgentForm"');
    assertContains(vendorHtml, 'id="mbAgentLog"');
    assertContains(vendorHtml, 'data-action="openManualBooking"');
    assertContains(vendorHtml, 'id="mbManualBookingModal"');
    assertContains(vendorHtml, 'data-step="1"');
    assertContains(vendorHtml, 'data-step="2"');
    assertContains(vendorHtml, 'data-step="3"');
    assertContains(vendorHtml, 'data-step="4"');
    assertContains(vendorHtml, 'data-action="manualReview"');
    assertContains(vendorHtml, 'data-action="manualConfirm"');
    assertContains(vendorHtml, 'id="mbCustomerNotes"');
    assertContains(vendorHtml, 'id="mbBookingStylePreference"');
    assertContains(vendorHtml, 'id="mbEmailWarning"');
    assertContains(vendorHtml, 'id="mbSmsOptIn"');
    assertContains(vendorHtml, 'type="file" accept="image/*"');
  });

  test('Mobile Barber manual booking modal uses contact, address, date/time, review flow', function() {
    assertContains(vendorHtml, 'mb-selected-service-field');
    assert(vendorHtml.indexOf('data-step="1"') < vendorHtml.indexOf('id="mbCustomerName"'), 'step 1 should contain customer contact fields');
    assert(vendorHtml.indexOf('id="mbCustomerName"') < vendorHtml.indexOf('data-step="2"'), 'contact fields must come before address step');
    assert(vendorHtml.indexOf('id="mbBookingAddress"') < vendorHtml.indexOf('data-step="3"'), 'address step must come before date/time step');
    assert(vendorHtml.indexOf('id="mbBookingDate"') < vendorHtml.indexOf('data-step="4"'), 'date/time step must come before review step');
    assert(vendorJs.indexOf("1: ['mbCustomerName', 'mbCustomerPhone']") >= 0, 'step 1 validation must require contact');
    assert(vendorJs.indexOf("2: ['mbBookingAddress', 'mbBookingCity', 'mbBookingZip']") >= 0, 'step 2 validation must require address');
    assert(vendorJs.indexOf("3: ['mbBookingService', 'mbBookingDate', 'mbBookingTime']") >= 0, 'step 3 validation must require service and date/time');
    assertContains(vendorJs, "state.manualStep = 4");
    assertContains(vendorJs, "state.manualStep !== 4 || !state.availabilityResult || !state.availabilityResult.canCreate");
    assertContains(vendorJs, "confirm.hidden = true");
    assertContains(vendorJs, "confirm.disabled = true");
    assertContains(vendorJs, "state.manualSuccess = true");
    assertContains(vendorJs, "manualNewBooking");
    assertContains(vendorJs, "copyBookingId");
    assertContains(vendorJs, "navigator.share");
    assertContains(vendorJs, "BOOKING.saveBooking(built.booking, { requireDatabase: true })");
    assertContains(vendorJs, "[mobile-barber-manual-booking]");
    assertContains(vendorJs, "bookingId");
    assertContains(vendorJs, "submitStatus: 'error'");
    assertContains(vendorJs, "step4Label");
    assertContains(vendorJs, "Confirm Booking");
  });

  test('Mobile Barber manual modal has progress bar, scrollable body, and service pill', function() {
    assertContains(vendorHtml, 'id="mbManualProgressBar"');
    assertContains(vendorHtml, 'role="progressbar"');
    assertContains(vendorHtml, 'id="mbManualProgressFill"');
    assertContains(vendorHtml, 'class="mb-booking-modal__body"');
    assertContains(vendorHtml, 'id="mbServicePill"');
    assertContains(vendorHtml, 'data-action="manualChangeService"');
    assertContains(vendorHtml, 'class="mb-form-actions mb-booking-modal__footer"');
    assertContains(vendorJs, "servicePillChangeLabel: 'Change'");
    assertContains(vendorJs, "servicePillChangeLabel: 'Đổi'");
    assertContains(vendorJs, "servicePillChangeLabel: 'Cambiar'");
    assertContains(vendorJs, 'function manualChangeService()');
    assertContains(vendorJs, "progressFill.style.width = pct + '%'");
    assertContains(vendorJs, 'body.scrollTo');
    assertContains(vendorJs, "scrollReset: true");
    assertContains(vendorJs, 'progressPct: pct');
    assertContains(vendorJs, 'servicePillVisible:');
  });

  test('Mobile Barber CSS uses full-viewport modal on mobile and centered on desktop', function() {
    assertContains(css, '.mb-booking-modal__body');
    assertContains(css, '.mb-booking-modal__footer.mb-form-actions');
    assertContains(css, '.mb-progress-bar');
    assertContains(css, '.mb-progress-bar__fill');
    assertContains(css, '.mb-service-pill');
    assertContains(css, '.mb-service-pill__change');
    assertContains(css, 'env(safe-area-inset-bottom)');
    assertContains(css, '@media (min-width: 768px)');
  });

  test('Mobile Barber manual booking remains data-driven for Michael and Tim vendor pages', function() {
    var data = read('mobile-barber/mobile-barber-data.js');
    assertContains(data, "MICHAEL_VENDOR_ID = 'michael-nguyen-oc'");
    assertContains(data, "TIM_VENDOR_ID = 'tim-nguyen-bay'");
    assertContains(vendorJs, 'DATA.findVendorById(vendorId)');
    assertContains(vendorJs, 'DATA.listServicesForVendor(state.vendor.id)');
    assertContains(vendorJs, 'renderServiceOptions()');
    assertContains(vendorJs, 'state.services.forEach(function(service)');
  });

  test('Mobile Barber vendor page supports en vi es translations', function() {
    assertContains(vendorJs, 'en: {');
    assertContains(vendorJs, 'vi: {');
    assertContains(vendorJs, 'es: {');
    assertContains(vendorJs, 'availabilityPreview');
    assertContains(vendorJs, 'BOOKING.checkAvailability');
    assertContains(vendorJs, 'BOOKING.buildBooking');
    assertContains(vendorJs, 'BOOKING.saveBooking');
    assertContains(vendorJs, 'AGENT.handleMessage');
    assertContains(vendorJs, 'root.MobileBarberVoice.open');
    assertContains(vendorJs, 'MobileBarberVoice.open(voiceController)');
    assertContains(vendorJs, 'geminiKey:');
    assertContains(vendorJs, 'loadCustomerHistory');
    assertContains(vendorJs, 'BOOKING.buildRebookDraft');
    assertContains(vendorJs, 'BOOKING.splitCustomerBookingHistory');
    assertContains(vendorJs, 'DATA.listPortfolioForVendor');
    assertContains(vendorJs, 'DATA.listReviewsForVendor');
    assertContains(vendorJs, 'SERVICE_BADGES');
    assertContains(vendorJs, 'manualBookingButton');
    assertContains(vendorJs, 'aiBookingButton');
    assertContains(vendorJs, 'voiceBookingButton');
  });

  test('Mobile Barber vendor page shows portfolio, reviews, ratings, and multilingual badges', function() {
    assertContains(vendorHtml, 'id="mbServiceBadges"');
    assertContains(vendorHtml, 'id="mbPortfolioGallery"');
    assertContains(vendorHtml, 'id="mbReviewList"');
    assertContains(vendorJs, 'portfolioTitle');
    assertContains(vendorJs, 'reviewsTitle');
    assertContains(vendorJs, 'beforeLabel');
    assertContains(vendorJs, 'afterLabel');
    assertContains(vendorJs, 'portfolioEmpty');
    assertContains(vendorJs, 'reviewsEmpty');
    assertContains(vendorJs, 'renderBadges');
    assertContains(vendorJs, 'renderPortfolio');
    assertContains(vendorJs, 'renderReviews');
    assertContains(vendorJs, 'setSelectedService');
    assertContains(vendorJs, 'renderSelectedServiceSummary');
    assertContains(vendorJs, 'DATA.findServiceImageByServiceId');
    assertContains(vendorJs, 'mb-portfolio-card__category');
    assertContains(vendorJs, 'reviewStars');
    assertContains(vendorJs, 'reviewResponseLabel');
    assertContains(vendorJs, 'ratingLabel');
    assertContains(css, 'mb-portfolio-grid');
    assertContains(css, 'mb-review-list');
    assertContains(css, 'mb-chip--badge');
    assertContains(css, '.mb-mobile-sticky-cta');
    assertContains(css, 'grid-template-columns: 1.1fr .95fr .95fr');
    assertContains(css, 'flex: 0 0 min(88vw, 23rem)');
    assertContains(css, '.mb-vendor-shell');
    assertContains(css, 'overflow-x: hidden');
  });

  test('Mobile Barber voice agent uses existing TTS fallback chain and text fallback', function() {
    assertContains(voiceJs, 'root.MobileBarberVoice');
    assertContains(voiceJs, '[voice-session]');
    assertContains(voiceJs, '[tts-turn]');
    assertContains(voiceJs, 'voiceSession');
    assertContains(voiceJs, 'getControllerVendorId()');
    assertContains(voiceJs, "overlay.classList.add('mb-voice--open');\n      createVoiceSession(lang)");
    assertContains(voiceJs, 'safeRepairFragment');
    assertContains(voiceJs, '_speakViaOpenAi');
    assertContains(voiceJs, '_speakViaGemini');
    assertContains(voiceJs, "lang === 'vi'");
    assertContains(voiceJs, 'speechSynthesis');
    assertContains(voiceJs, "voice: 'nova'");
    assertContains(voiceJs, 'gemini-2.5-flash-preview-tts');
    assertContains(voiceJs, 'SpeechRecognition || root.webkitSpeechRecognition');
    assertContains(voiceJs, "source: 'ai_voice'");
    assertContains(voiceJs, 'openTextFallback');
    assertContains(voiceJs, 'statusListening');
    assertContains(voiceJs, 'statusThinking');
    assertContains(voiceJs, 'statusConfirming');
    assertContains(voiceJs, 'statusBooked');
    assertContains(voiceJs, 'data-lang="vi"');
    assertContains(voiceJs, 'data-lang="es"');
    assertContains(js, 'vendorId: function()');
    assertContains(vendorJs, 'vendorId: function()');
  });

  test('Mobile Barber notification hooks are idempotent and multilingual', function() {
    assertContains(notificationsJs, 'function queueMobileBarberConfirmation');
    assertContains(notificationsJs, 'function queueMobileBarberStatusChange');
    assertContains(notificationsJs, "bookingType:       'mobile_barber'");
    assertContains(notificationsJs, "'mobile_barber_confirmed'");
    assertContains(notificationsJs, 'mobile_barber_sms_confirmation');
    assertContains(notificationsJs, '[mobile-barber-notification]');
    assertContains(vendorJs, 'root.DLCNotifications.queueMobileBarberConfirmation');
    assertContains(vendorJs, 'queueMobileBarberStatusChange');
    assertContains(vendorJs, "where('createdAt', '>'");
    assertContains(vendorJs, 'state.realtimeUnsubscribe');
    assertContains(vendorJs, '[mobile-barber-vendor-realtime]');
    assertContains(vendorJs, 'queueBookingNotifications(result.booking)');
    assertContains(vendorJs, 'queueBookingNotifications(saveResult.booking)');
    assertContains(vendorJs, 'finalSummaryTitle');
    assertContains(functionsJs, "data.bookingType === 'mobile_barber'");
    assertContains(functionsJs, 'buildMobileBarberConfirmationEmail');
    assertContains(functionsJs, "vi: {");
    assertContains(functionsJs, "es: {");
    assertContains(functionsJs, 'SMS disabled');
  });

  test('Mobile Barber dashboard route and assets are isolated', function() {
    assertContains(firebase, '"source": "/mobile-barber/dashboard"');
    assertContains(firebase, '"destination": "/mobile-barber/dashboard.html"');
    assertContains(dashboardHtml, 'id="mobileBarberDashboardApp"');
    assertContains(dashboardHtml, '/mobile-barber/mobile-barber-data.js?v=20260524o');
    assertContains(dashboardHtml, '/mobile-barber/mobile-barber-dashboard.js?v=20260524h');
    assertContains(dashboardHtml, '/mobile-barber/mobile-barber.css?v=20260524o');
    assertNotContains(dashboardHtml, 'vendor-admin.html');
    assertNotContains(dashboardHtml, 'salon-admin.html');
    assertNotContains(dashboardHtml, 'admin.html');
  });

  test('Mobile Barber dashboard supports required vendor management areas', function() {
    assertContains(dashboardHtml, 'mbProfileForm');
    assertContains(dashboardHtml, 'mbDashPhone');
    assertContains(dashboardHtml, 'mbDashServiceAreas');
    assertContains(dashboardHtml, 'mbDashTravelRadius');
    assertContains(dashboardHtml, 'mbServiceForm');
    assertContains(dashboardHtml, 'mbDashServicePrice');
    assertContains(dashboardHtml, 'mbDashServiceDuration');
    assertContains(dashboardHtml, 'mbDashCleanupBuffer');
    assertContains(dashboardHtml, 'mbDashTravelBuffer');
    assertContains(dashboardHtml, 'mbHoursGrid');
    assertContains(dashboardHtml, 'mbBlockForm');
    assertContains(dashboardJs, 'persistVendor');
    assertContains(dashboardJs, 'persistServices');
    assertContains(dashboardJs, 'persistAvailability');
    assertContains(dashboardJs, 'persistBlocks');
  });

  test('Mobile Barber dashboard manages portfolio visibility, ordering, uploads, and review responses', function() {
    assertContains(dashboardHtml, 'id="mbPortfolioForm"');
    assertContains(dashboardHtml, 'id="mbPortfolioUpload"');
    assertContains(dashboardHtml, 'id="mbPortfolioBeforeUpload"');
    assertContains(dashboardHtml, 'id="mbPortfolioAfterUpload"');
    assertContains(dashboardHtml, 'id="mbPortfolioOrder"');
    assertContains(dashboardHtml, 'id="mbPortfolioManageList"');
    assertContains(dashboardHtml, 'data-action="addPortfolio"');
    assertContains(dashboardHtml, 'id="mbReviewsManageList"');
    assertContains(dashboardHtml, 'data-action="saveReviewResponses"');
    assertContains(dashboardJs, 'dlc_mobile_barber_portfolio_overrides');
    assertContains(dashboardJs, 'dlc_mobile_barber_review_overrides');
    assertContains(dashboardJs, 'persistPortfolio');
    assertContains(dashboardJs, 'persistReviews');
    assertContains(dashboardJs, 'displayOrder');
    assertContains(dashboardJs, 'image.hidden = !image.hidden');
    assertContains(dashboardJs, 'vendorResponse');
  });

  test('Mobile Barber dashboard covers booking views and status actions', function() {
    assertContains(dashboardHtml, 'mbTodayList');
    assertContains(dashboardHtml, 'mbUpcomingList');
    assertContains(dashboardHtml, 'mbPendingList');
    assertContains(dashboardJs, "['confirmed', 'acceptAction']");
    assertContains(dashboardJs, "['rescheduled', 'rescheduleAction']");
    assertContains(dashboardJs, "['cancelled', 'cancelAction']");
    assertContains(dashboardJs, 'updateBookingStatus');
    assertContains(dashboardJs, 'customerPhone');
    assertContains(dashboardJs, 'customerEmail');
    assertContains(dashboardJs, 'photoUrls');
  });

  test('Mobile Barber dashboard keeps customer address vendor-only', function() {
    assertContains(dashboardJs, 'customerAddress');
    assertContains(dashboardJs, 'mapUrl');
    assertContains(dashboardJs, 'https://www.google.com/maps/search/?api=1&query=');
    assertNotContains(html, 'customerAddress');
    assertNotContains(vendorHtml, 'customerAddress');
    assertNotContains(js, 'customerAddress');
    assertNotContains(vendorJs, 'customerAddress');
  });

  test('Mobile Barber customer history and rebooking are customer-scoped', function() {
    assertContains(vendorHtml, 'id="mbCustomerAccountForm"');
    assertContains(vendorHtml, 'id="mbUpcomingHistoryList"');
    assertContains(vendorHtml, 'id="mbPastHistoryList"');
    assertContains(vendorHtml, 'data-action="loadHistory"');
    assertContains(vendorHtml, 'data-action="savePreference"');
    assertContains(vendorJs, 'loadCustomerBookings(state.vendor.id, { phone: phone })');
    assertContains(vendorJs, 'startRebook');
    assertContains(vendorJs, 'setManualDraft(state.rebookDraft)');
    assertContains(vendorJs, 'rebookedFromBookingId');
    assertContains(vendorJs, 'previousServiceName');
    assertNotContains(vendorHtml, 'customerAddress');
  });

  test('Mobile Barber vendor dashboard exposes cut history without making it public', function() {
    assertContains(dashboardJs, 'customerCutHistory');
    assertContains(dashboardJs, 'stylePreference');
    assertContains(dashboardJs, 'previousServiceName');
    assertContains(dashboardJs, 'rebookedFromBookingId');
    assertNotContains(html, 'customerCutHistory');
    assertNotContains(vendorHtml, 'customerCutHistory');
  });

  test('Mobile Barber Firestore rules deny public private reads and scope vendor/customer access', function() {
    assertContains(firestoreRules, 'match /mobileBarberBookings/{bookingId}');
    assertContains(firestoreRules, 'allow create: if isValidMobileBarberBookingCreate()');
    assertContains(firestoreRules, 'allow read: if isMobileBarberBookingCustomer()');
    assertContains(firestoreRules, '|| isVendorMember(resource.data.vendorId)');
    assertContains(firestoreRules, 'match /mobileBarberCustomers/{customerId}');
    assertContains(firestoreRules, 'allow read, update: if isMobileBarberCustomerOwner()');
    assertContains(firestoreRules, 'allow read:  if true;');
  });

  test('Mobile Barber dashboard supports en vi es translations', function() {
    assertContains(dashboardJs, 'var STRINGS = {');
    assertContains(dashboardJs, 'en: {');
    assertContains(dashboardJs, 'vi: {');
    assertContains(dashboardJs, 'es: {');
    assertContains(dashboardJs, 'setTranslatedText');
    assertContains(dashboardHtml, 'data-i18n="dashboardTitle"');
    assertContains(dashboardHtml, 'data-i18n="todayTitle"');
    assertContains(dashboardHtml, 'data-i18n="servicesManageTitle"');
    assertContains(dashboardHtml, 'data-i18n="hoursTitle"');
    assertContains(dashboardHtml, 'data-i18n="portfolioTitle"');
    assertContains(dashboardHtml, 'data-i18n="reviewsManageTitle"');
  });
}

module.exports = {
  runMobileBarberLandingTests: runMobileBarberLandingTests
};
