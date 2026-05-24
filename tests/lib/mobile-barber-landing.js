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
    assertContains(html, '/mobile-barber/mobile-barber.css?v=20260524f');
    assertContains(html, '/mobile-barber/mobile-barber-data.js?v=20260524g');
    assertContains(html, '/mobile-barber/mobile-barber.js?v=20260524g');
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
    assertContains(vendorHtml, '/mobile-barber/mobile-barber.css?v=20260524f');
    assertContains(vendorHtml, 'id="mbVendorName"');
    assertContains(vendorHtml, 'id="mbVendorServices"');
    assertContains(vendorHtml, 'id="mbBookingTitle"');
    assertContains(vendorHtml, 'id="mbVendorPromoTitle"');
    assertContains(vendorHtml, 'id="mbSelectedServiceSummary"');
    assertContains(vendorHtml, '/mobile-barber/mobile-barber-booking.js?v=20260524a');
    assertContains(vendorHtml, '/ai-engine.js?v=20260523a');
    assertContains(vendorHtml, '/mobile-barber/mobile-barber-agent.js?v=20260524g');
    assertContains(vendorHtml, '/mobile-barber/mobile-barber-voice.js?v=20260524g');
    assertContains(vendorHtml, '/notifications.js?v=20260523a');
    assertContains(vendorHtml, '/mobile-barber/mobile-barber-vendor.js?v=20260524g');
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
    assertContains(vendorHtml, 'data-action="manualReview"');
    assertContains(vendorHtml, 'data-action="manualConfirm"');
    assertContains(vendorHtml, 'id="mbCustomerNotes"');
    assertContains(vendorHtml, 'id="mbBookingStylePreference"');
    assertContains(vendorHtml, 'type="file" accept="image/*"');
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
  });

  test('Mobile Barber voice agent uses existing TTS fallback chain and text fallback', function() {
    assertContains(voiceJs, 'root.MobileBarberVoice');
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
  });

  test('Mobile Barber notification hooks are idempotent and multilingual', function() {
    assertContains(notificationsJs, 'function queueMobileBarberConfirmation');
    assertContains(notificationsJs, "bookingType:       'mobile_barber'");
    assertContains(notificationsJs, "'mobile_barber_confirmed'");
    assertContains(vendorJs, 'root.DLCNotifications.queueMobileBarberConfirmation');
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
    assertContains(dashboardHtml, '/mobile-barber/mobile-barber-data.js?v=20260524g');
    assertContains(dashboardHtml, '/mobile-barber/mobile-barber-dashboard.js?v=20260524b');
    assertContains(dashboardHtml, '/mobile-barber/mobile-barber.css?v=20260524f');
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
