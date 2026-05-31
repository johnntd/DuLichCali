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
  var homeHtml = read('index.html');
  var homeJs = read('script.js');
  var homeCss = read('style.css');

  test('Mobile Barber route has a static index page', function() {
    assertContains(html, 'id="mobileBarberApp"');
    assertContains(firebase, '"source": "/mobile-barber"');
    assertContains(firebase, '"destination": "/mobile-barber/index.html"');
  });

  test('Homepage Marketplace panel lists Mobile Barber through existing vendor renderer', function() {
    assertContains(homeHtml, 'id="hpFeatured"', 'homepage must keep Marketplace panel');
    assertContains(homeHtml, 'id="hpVendorCards"', 'homepage must keep vendor-card mount');
    assertContains(homeHtml, 'style.css?v=20260526b', 'homepage must load bumped stylesheet');
    assertContains(homeHtml, 'script.js?v=20260530n', 'homepage must load bumped script.js');
    assertContains(homeJs, 'HOMEPAGE_MARKETPLACE_ENTRIES');
    // Region-scoped marketplace routing: cards land on /mobile-barber (with
    // ?region=...) and never expose individual barber names or vendor pages.
    assertContains(homeJs, "id: 'mobile-barber-oc'");
    assertContains(homeJs, "name: 'Mobile Barber — Orange County'");
    assertContains(homeJs, "featuredRegions: ['oc']");
    assertContains(homeJs, "href: 'https://www.dulichcali21.com/mobile-barber?region=oc'");
    assertContains(homeJs, "id: 'mobile-barber-bayarea'");
    assertContains(homeJs, "name: 'Mobile Barber — Bay Area'");
    assertContains(homeJs, "featuredRegions: ['bayarea']");
    assertContains(homeJs, "href: 'https://www.dulichcali21.com/mobile-barber?region=bayarea'");
    assertNotContains(homeJs, '/mobile-barber/vendor/michael-nguyen-oc', 'homepage must not link customers to vendor customer page');
    assertNotContains(homeJs, '/mobile-barber/vendor/tim-nguyen-bay', 'homepage must not link customers to vendor customer page');
    assertContains(homeJs, "heroImage: '/assets/mobile-barber/styles/classic-haircut.jpg'");
    assertContains(homeJs, "heroImage: '/assets/mobile-barber/styles/fade-haircut.jpg'");
    assertContains(homeJs, 'vendors = _withHomepageMarketplaceEntries(vendors, regionId).slice(0, 8)');
    assertContains(homeJs, 'container.innerHTML = vendors.map(buildVendorCardHtml).join');
    assertContains(homeJs, 'class="hp-vendor-card" role="listitem" href="${href}"');
    assertContains(homeCss, '.hp-vendor-card__cta');
    assertContains(homeCss, 'flex: 0 0 calc(72% - .5rem)');
  });

  test('Homepage marketplace shows ONLY active vendors (launch guard — no stale content)', function() {
    // Phase 4 launch invariant: inactive vendors/services/promos must never
    // appear on the homepage. These guards already exist in script.js; this
    // test locks them so they cannot silently regress before production.
    assertContains(homeJs, ".where('adminStatus', '==', 'active')",
      'marketplace must query only adminStatus=active vendors');
    assertContains(homeJs, 'data.active === false || data.disabled === true',
      'must hard-skip vendors flagged active:false / disabled');
    assertContains(homeJs, '_filterPubliclyVisibleVendors(vendors',
      'must apply the public-visibility gate (inactive / closed / out-of-region)');
    assertContains(homeJs, 'await window._vendorAdminCacheReady',
      'must await the admin-status cache so inactive vendors do not leak on first paint');
    assertContains(homeJs, 'section.hidden = true',
      'must hide the marketplace section entirely when no active vendors are visible');
    assertContains(homeJs, 'applyHeroSlideVisibility',
      'hero carousel must sync to the active-vendor set');
    // Static fallback path must also enforce active + homepageActive.
    assertContains(homeJs, 'b.active && b.homepageActive',
      'static-fallback marketplace must require active + homepageActive');
  });

  test('Mobile Barber page loads scoped CSS and versioned JS', function() {
    assertContains(html, '/mobile-barber/mobile-barber.css?v=20260531f');
    assertContains(html, '/mobile-barber/mobile-barber-data.js?v=20260530k');
    assertContains(html, '/mobile-barber/mobile-barber-booking.js?v=20260531f');
    assertContains(html, '/mobile-barber/mobile-barber-agent.js?v=20260530l');
    assertContains(html, '/mobile-barber/mobile-barber-voice.js?v=20260530m');
    assertContains(html, '/mobile-barber/mobile-barber-icons.js?v=20260530g');
    assertContains(html, '/mobile-barber/mobile-barber-lightbox.js?v=20260530f');
    assertContains(html, '/mobile-barber/mobile-barber.js?v=20260531f');
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
    // Coverage cards drive empty-state visibility; per-barber vendor URLs are
    // gone from the customer-facing landing (vendorUrlForRoute() still exists
    // for backwards compat / debug but is no longer invoked on customer paths).
    assertContains(js, 'empty.hidden = regions.length > 0');
    assertNotContains(js, "cta.href = '/mobile-barber/vendor/'", 'landing CTA must not navigate to per-vendor page');
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
    // The 'voiceSelectedService' data-action used to live on the old
    // selected-service three-button row that got removed when Select
    // Service started opening the manual booking form directly. Voice
    // booking still works — it's now the "Talk to AI" link inside the
    // manual form's Need-help? footer.
    assertContains(html, 'id="mbPromoTitle"');
    assertContains(html, 'id="mbPromoPreview"');
    assertContains(js, "promoTitle: 'See Your Next Hairstyle Before You Book'");
    assertContains(js, 'renderPromoPreview');
    assertContains(js, 'promoContentItems');
    assertContains(js, 'clipUrl');
    assertContains(js, 'displayOrder');
    assertContains(css, 'mb-promo__preview');
    assertContains(css, 'mb-promo__card');
    assertContains(css, '@media (max-width: 768px)');
    assertContains(css, 'scroll-snap-type: x mandatory');
    assertContains(css, 'mb-service-card--selected');
    assertContains(css, '@media (prefers-reduced-motion: reduce)');
  });

  test('Mobile Barber landing no longer shows the Find My Barber gate', function() {
    // 2026-05-27: the upfront location gate was removed. The chat agent
    // collects city/ZIP via slot fill (ASK_ADDRESS) and routes via
    // BOOKING.findVendorForAddress at booking-build time. The gate's DOM
    // ids must all be absent from the rendered landing.
    assertNotContains(html, 'id="mbLocationGate"', 'location gate section removed');
    assertNotContains(html, 'id="mbLocationGateForm"', 'gate form removed');
    assertNotContains(html, 'id="mbLocationCity"', 'gate city input removed');
    assertNotContains(html, 'id="mbLocationZip"', 'gate zip input removed');
    assertNotContains(html, 'id="mbWaitlistForm"', 'waitlist form removed');
    assertNotContains(html, 'data-action="changeLocation"', 'change location button removed');
    // Replaced with a compact educational "How matching works" section.
    assertContains(html, 'mb-how-matching');
    assertContains(html, 'data-i18n="howMatchingTitle"');
    assertContains(html, 'data-i18n="howMatchingStep1Title"');
    assertContains(html, 'data-i18n="howMatchingStep4Title"');
    // Internal helpers stay (used by saved-location restore for routing).
    assertContains(js, 'BOOKING.findVendorForAddress');
    assertContains(js, 'function readSavedLocation');
  });

  test('Mobile Barber landing routes booking through the AI chat agent', function() {
    // 2026-05-27: customer no longer hits a gate before chatting. The
    // chat button opens the assistant directly; the agent asks for city/
    // ZIP via its own ASK_ADDRESS step and routes via findVendorForAddress.
    assertContains(js, 'function promptForLocation(serviceId)');
    assertContains(js, 'state.pendingServiceId = serviceId ||');
    assertContains(js, 'openAssistantPanel');
    assertContains(js, 'serviceIdForVendor(vendor, serviceId)');
    // vendorUrlForRoute() is preserved for SEO/debug deep-links but customer
    // navigation no longer calls it.
    assertContains(js, "params.get('serviceId')");
    assertContains(js, "state.region = String(params.get('region')");
    assertNotContains(js, 'var preferredVendor = DATA && DATA.MICHAEL_VENDOR_ID', 'landingServices must not prefer Michael');
  });

  test('Mobile Barber landing has hero showcase + convenience; promo-clips lower section removed', function() {
    // Style-preview gallery + lower promo-clips section both removed:
    // promo clips moved INTO the hero showcase strip so they live in the
    // first impression rather than buried lower on the page.
    assertNotContains(html, 'id="mbBeforeAfterGallery"',
      'redundant style-preview gallery must not be re-added');
    assertNotContains(html, 'data-i18n="beforeAfterTitle"',
      'redundant gallery title key must not be re-added');
    assertNotContains(js, 'function renderStylePreviewGallery',
      'redundant gallery renderer must stay removed');
    assertNotContains(js, "stylePreviewSuffix:",
      'redundant gallery i18n must stay removed');

    // Lower promo-clips section removed in favor of the hero showcase.
    assertNotContains(html, 'id="mbPromoClips"',
      'lower promo-clips section must NOT exist — content moved into hero showcase');
    assertNotContains(html, 'data-i18n="promoClipsTitle"',
      'promoClipsTitle i18n must be removed');
    assertNotContains(js, 'function renderPromoClips',
      'renderPromoClips must be removed');
    assertNotContains(css, '.mb-promo-clips__track',
      'lower promo-clips track CSS must be removed');

    // Hero showcase merged INTO the main hero media — no separate strip.
    assertContains(html, 'id="mbHeroMedia"',
      '.mb-hero__media is now the showcase mount point');
    assertNotContains(html, 'id="mbHeroShowcase"',
      'separate showcase strip removed — merged into .mb-hero__media');
    assertContains(js, 'function renderHeroShowcase');
    assertContains(js, 'heroShowcaseFadeTitle');
    assertContains(js, 'heroShowcaseFamilyTitle');
    assertContains(js, 'heroShowcaseHotelTitle');
    // Default brand slide added so a promo-less rotation still shows the
    // brand framing in the hero rather than a blank media area.
    assertContains(js, "type:  'default'",
      'default brand slide must exist for promo-less rotation');
    assertContains(css, '.mb-hero-showcase-card');
    assertContains(css, '.mb-hero-showcase-card--promo');

    // Convenience kept but compact (still present, moved near the bottom).
    assertContains(html, 'id="mbConvenienceList"');
    assertContains(html, 'data-i18n="convenienceTitle"');
    assertContains(js, 'renderConvenience');
    assertContains(css, 'mb-convenience-grid');
  });

  test('Section order: hero → AI haircut styles → services → AI preview → trust → how-matching → convenience', function() {
    var pos = function(needle) {
      var i = html.indexOf(needle);
      if (i < 0) throw new Error('missing marker: ' + needle);
      return i;
    };
    var heroShowcase = pos('id="mbHeroMedia"');
    var promo        = pos('class="mb-section mb-promo"');
    var services     = pos('id="mbServices"');
    var aiPreview    = pos('id="mbHomeAiPreview"');
    var trust        = pos('class="mb-trust"');
    var howMatching  = pos('class="mb-section mb-how-matching"');
    var convenience  = pos('class="mb-section mb-convenience"');
    // "Latest AI Haircut Styles" moved RIGHT AFTER the hero — it is the
    // platform's flagship visual feature and drives conversion.
    assert(heroShowcase < promo,        'hero must come before AI haircut styles carousel');
    assert(promo        < services,     'AI haircut styles must come BEFORE services (flagship feature)');
    assert(services     < aiPreview,    'services must come before AI preview/upload');
    assert(aiPreview    < trust,        'AI preview must come before trust strip');
    assert(trust        < howMatching,  'trust strip must come before How Matching Works');
    assert(howMatching  < convenience,  'How Matching Works must come before Convenience');
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
    assertContains(vendorHtml, '/mobile-barber/mobile-barber.css?v=20260531f');
    assertContains(vendorHtml, 'id="mbVendorName"');
    assertContains(vendorHtml, 'id="mbVendorServices"');
    assertContains(vendorHtml, 'id="mbBookingTitle"');
    assertContains(vendorHtml, 'id="mbVendorPromoTitle"');
    assertContains(vendorHtml, 'id="mbSelectedServiceSummary"');
    assertContains(vendorHtml, 'class="mb-mobile-sticky-cta"');
    assertContains(vendorHtml, '/mobile-barber/mobile-barber-data.js?v=20260530k');
    assertContains(vendorHtml, '/mobile-barber/mobile-barber-booking.js?v=20260531f');
    assertContains(vendorHtml, '/ai-engine.js?v=20260530m');
    assertContains(vendorHtml, '/mobile-barber/mobile-barber-agent.js?v=20260530l');
    assertContains(vendorHtml, '/mobile-barber/mobile-barber-voice.js?v=20260530m');
    assertContains(vendorHtml, 'firebase-functions-compat.js');
    assertContains(vendorHtml, '/notifications.js?v=20260525a');
    assertContains(vendorHtml, '/mobile-barber/mobile-barber-vendor.js?v=20260530k');
    assert(vendorHtml.indexOf('/ai-engine.js?v=') < vendorHtml.indexOf('/mobile-barber/mobile-barber-agent.js'), 'ai-engine.js must load before mobile-barber-agent.js');
  });

  test('Mobile Barber vendor page is vendor-id scoped', function() {
    assertContains(vendorJs, 'function getVendorId()');
    assertContains(vendorJs, "DATA.findVendorById(vendorId)");
    assertContains(vendorJs, 'DATA.listServicesForVendor(state.vendor.id)');
    assertContains(vendorJs, 'interpolate(t(\'assistantCopy\'), { vendorId: vendor.id })');
    assertContains(vendorJs, "card.setAttribute('data-promo-id'");
    assertContains(vendorJs, "card.setAttribute('data-prompt'");
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
    assertContains(vendorJs, "LOCATION_STORAGE_KEY = 'mb_customer_location'");
    assertContains(vendorJs, 'readSavedLocation()');
    assertContains(vendorJs, 'if (cityInput && !cityInput.value) cityInput.value = savedLocation.city');
  });

  test('Mobile Barber vendor page auto-switches to matching vendor after address mismatch', function() {
    assertContains(vendorJs, "vendorSwitchCountdown: 'Switching to {name} in 2s");
    assertContains(vendorJs, "vendorSwitchCountdown: 'Đang chuyển sang {name} trong 2 giây");
    assertContains(vendorJs, "vendorSwitchCountdown: 'Cambiando a {name} en 2s");
    assertContains(vendorJs, "vendorSwitchStay: 'Stay'");
    assertContains(vendorJs, "vendorSwitchStay: 'Ở lại'");
    assertContains(vendorJs, "vendorSwitchStay: 'Quedarse'");
    assertContains(vendorJs, 'state.vendorSwitchTimer = setTimeout(function()');
    assertContains(vendorJs, 'persistDraftForSwitch();');
    assertContains(vendorJs, 'root.location.href = state.vendorSwitchTargetUrl');
    assertContains(vendorJs, 'cancelVendorAutoSwitch();');
    assertContains(vendorJs, "action === 'stayVendor'");
    assertContains(vendorJs, "action === 'switchVendor'");
  });

  test('Mobile Barber canonical style schema exposes required fields at the data layer', function() {
    var dataJs = read('mobile-barber/mobile-barber-data.js');
    assertContains(dataJs, 'function listStyleTemplates');
    assertContains(dataJs, 'listStyleTemplates: listStyleTemplates');
    assertContains(dataJs, "id: 'classic-haircut'");
    assertContains(dataJs, "id: 'fade-haircut'");
    assertContains(dataJs, "category: 'fade'");
    assertContains(dataJs, "category: 'beard'");
    assertContains(dataJs, "category: 'kids'");
    assertContains(dataJs, "category: 'senior'");
    assertContains(dataJs, "category: 'business'");
    assertContains(dataJs, "category: 'lineup'");
    assertContains(dataJs, "category: 'family'");
    assertContains(dataJs, 'displayOrder: 1');
    assertContains(dataJs, 'displayOrder: 13');
    assertContains(dataJs, 'isAIGenerated: true');
    assertContains(dataJs, 'active: true');
    assertContains(dataJs, "clipUrl: ''");
    assertContains(js, 'DATA.listStyleTemplates');
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

  test('Server-side owner-wide conflict guard for anonymous customer bookings', function() {
    // Anonymous customer bookings skip the client BookingGuard (rules deny its
    // reads), so a Cloud Function restores owner-wide cross-vendor conflict
    // detection on the server (Admin SDK bypasses rules).
    assertContains(functionsJs, "exports.onMobileBarberBookingCreated = onDocumentCreated(",
      'must add the server-side conflict-check trigger');
    assertContains(functionsJs, "document:       'mobileBarberBookings/{bookingId}'",
      'must fire on mobileBarberBookings creation');
    assertContains(functionsJs, "where('ownerId', '==', ownerId)",
      'must sweep owner-wide bookings');
    // Sweeps all three service collections (barber + ride + tour).
    assertContains(functionsJs, "['mobileBarberBookings', 'bookings', 'travel_bookings']",
      'must check barber + ride + tour collections for the owner');
    // Auto-declines the LATER booking on a real time overlap (race-safe by createTime);
    // never deletes the doc.
    assertContains(functionsJs, "status: 'declined'", 'time overlap must auto-decline the later booking');
    assertContains(functionsJs, "declineReason: 'time_conflict'", 'must record the decline reason');
    assertContains(functionsJs, 'conflictBookingId', 'must record which booking it conflicts with');
    assertNotContains(functionsJs, 'snap.ref.delete(', 'must NOT delete the customer booking');
    // vendor_review bookings must NOT be early-returned — a booking created directly
    // as vendor_review (client guard / agent) must still be conflict-checked so a true
    // time overlap auto-declines it instead of lingering as an actionable Upcoming card.
    assertNotContains(functionsJs, 'skip — already vendor_review',
      'must NOT early-return on vendor_review — it must be conflict-checked');
    assertContains(functionsJs, 'vendor_review — still running owner-wide conflict check',
      'vendor_review must proceed to the owner-wide conflict check');
    assertContains(functionsJs, 'MB_NON_BLOCKING', 'must ignore terminal/cancelled bookings');
  });

  test('Mobile Barber customer booking is guarded BEFORE the write via a callable', function() {
    var bookingJs = read('mobile-barber/mobile-barber-booking.js');
    // Server: a callable that conflict-checks BEFORE writing and refuses overlaps.
    assertContains(functionsJs, 'exports.createMobileBarberBookingGuarded = onCall(',
      'must add the pre-write guarded create callable');
    assertContains(functionsJs, "code: 'time_conflict'", 'callable must return a time_conflict code on overlap');
    assertContains(functionsJs, 'mbSuggestAlternativeTimes(win, allBusy)', 'callable must return alternate times');
    assertContains(functionsJs, '[booking-write-guarded]', 'callable must log a guarded write');
    // The conflict path must NOT write the booking (set is only on the clear branch).
    var callIdx = functionsJs.indexOf('exports.createMobileBarberBookingGuarded');
    var blockIdx = functionsJs.indexOf("code: 'time_conflict', reason: 'slot_unavailable'", callIdx);
    var setIdx = functionsJs.indexOf('await ref.set(Object.assign({}, booking', callIdx);
    assert(blockIdx >= 0 && setIdx >= 0 && blockIdx < setIdx,
      'the conflict return must come BEFORE (and instead of) the booking write');
    // Frontend: the customer write path routes through the callable, surfaces conflicts.
    assertContains(bookingJs, "httpsCallable('createMobileBarberBookingGuarded')",
      'frontend must call the guarded create callable');
    assertContains(bookingJs, 'function guardedCreateViaCallable(',
      'frontend must route customer writes through the guarded callable');
    assertContains(bookingJs, "if (canUseFunctions() && options.skipGuardedCallable !== true)",
      'persistBooking must prefer the guarded callable for the customer path');
    assertContains(bookingJs, 'err.bookingConflict = true', 'a blocked slot must reject with a conflict flag (not success)');
    // UI: every booking surface shows the conflict + alternate times, never success.
    assertContains(js, 'function bookingConflictMessage(', 'UI must build a conflict + alternate-times message');
    assertContains(js, 'error.bookingConflict', 'manual/inline/agent catch must detect a booking conflict');
    assertContains(js, "bookingConflictNextTimes: 'That time is no longer available. Next available: {times}.'", 'en conflict copy');
    assertContains(js, 'bookingConflictNextTimes:', 'conflict copy present');
  });

  test('Mobile Barber unread badge renders unconditionally + hidden attr actually hides', function() {
    // BLOCKER 2: popup worked but the badge never showed. Lock the fixes.
    assertContains(dashboardJs, 'badge.hidden = !(active && unread > 0);',
      'badge must be computed/rendered before any early return');
    assertContains(dashboardJs, "root.console.info('[badge-render]'",
      'must emit the [badge-render] diagnostic');
    assertContains(dashboardJs, '!!(notifyScopeId() || state.vendor)',
      'notificationsActive must be true whenever the vendor portal is loaded');
    assertContains(css, '.mb-notif-badge[hidden] { display: none; }',
      'the hidden attribute must override display:inline-flex so 0 is truly hidden');
  });

  test('Mobile Barber dashboard excludes conflict/declined bookings from Upcoming + seeds badge', function() {
    // Screenshot regression: an overlapping booking showed as a second "Upcoming"
    // card and the unread badge stayed empty. Lock the fixes so they cannot regress.
    // 1) 'declined' (what the server conflict guard writes) is terminal/inactive.
    assertContains(dashboardJs, "['cancelled', 'completed', 'rejected', 'declined', 'expired', 'no_show']",
      'isInactiveStatus must treat server-written declined as terminal');
    // 2) Upcoming excludes vendor_review (and every terminal status).
    assertContains(dashboardJs, "if (isInactiveStatus(status) || status === 'vendor_review') return false;",
      'isUpcomingBooking must exclude vendor_review + terminal statuses');
    // 3) declined maps to the cancelled (red) bucket, not the default pending bucket.
    assertContains(dashboardJs, "case 'declined':     return 'cancelled';",
      'statusBucket must bucket declined as cancelled (red), not pending');
    // 4) Badge seeded from existing actionable bookings on load (persists across refresh).
    assertContains(dashboardJs, 'function seedInitialNotifications()',
      'must seed the unread badge from existing actionable bookings');
    assertContains(dashboardJs, 'seedInitialNotifications();',
      'init must call seedInitialNotifications after the first render');
    // 5) "DECLINED — TIME CONFLICT" label exists in all three languages.
    assertContains(dashboardJs, "statusDeclinedTimeConflict: 'DECLINED — TIME CONFLICT'", 'en conflict label');
    assertContains(dashboardJs, "statusDeclinedTimeConflict: 'ĐÃ TỪ CHỐI — TRÙNG GIỜ'", 'vi conflict label');
    assertContains(dashboardJs, "statusDeclinedTimeConflict: 'RECHAZADA — CONFLICTO DE HORARIO'", 'es conflict label');
  });

  test('Mobile Barber dashboard route and assets are isolated', function() {
    assertContains(firebase, '"source": "/mobile-barber/dashboard"');
    assertContains(firebase, '"destination": "/mobile-barber/dashboard.html"');
    assertContains(dashboardHtml, 'id="mobileBarberDashboardApp"');
    assertContains(dashboardHtml, '/mobile-barber/mobile-barber-data.js?v=20260530k');
    assertContains(dashboardHtml, '/mobile-barber/mobile-barber-booking.js?v=20260531f');
    assertContains(dashboardHtml, '/mobile-barber/mobile-barber-lightbox.js?v=20260530f');
    assertContains(dashboardHtml, '/mobile-barber/mobile-barber-dashboard.js?v=20260531g');
    assertContains(dashboardHtml, '/mobile-barber/mobile-barber.css?v=20260531f');
    assertContains(dashboardHtml, 'firebase-auth-compat.js');
    assertContains(dashboardHtml, '/notifications.js?v=20260525a');
    assertContains(dashboardHtml, 'id="mbBookingAlertRegion"');
    assertContains(dashboardHtml, 'id="mbNotifBell"');
    assertContains(dashboardHtml, 'id="mbNotifBadge"');
    assertContains(dashboardHtml, 'id="mbNotifDrawer"');
    assertContains(dashboardHtml, 'id="mbNotifList"');
    assertContains(dashboardHtml, 'data-owner-review-queue="appointments"');
    assertContains(dashboardHtml, 'data-action="enableSoundAlerts"');
    assertContains(dashboardJs, 'function gateAndInit');
    assertContains(dashboardJs, "vendorUsers");
    assertContains(dashboardJs, "adminStatus");
    assertContains(dashboardJs, 'queueMobileBarberStatusChange');
    assertContains(dashboardJs, 'function subscribeBookingAlerts');
    assertContains(dashboardJs, "db.collection(DATA.COLLECTIONS.bookings)");
    assertContains(dashboardJs, "where('vendorId', '==', state.vendorId)");
    assertContains(dashboardJs, 'markBookingNotified');
    assertContains(dashboardJs, 'playBookingChime');
    assertContains(dashboardJs, 'new root.Notification');
    assertContains(dashboardJs, 'function subscribeOwnerBookingAlerts');
    assertContains(dashboardJs, 'function attachOwnerAlertListener(db, collectionName, query, unsubscribes, bucketHint)');
    assertContains(dashboardJs, 'function normalizeOwnerAlertBooking(data, sourceCollection, bucketHint)');
    assertContains(dashboardJs, "bucketHint === 'barber'");
    assertContains(dashboardJs, "bucketHint === 'ride_tour'");
    assertContains(dashboardJs, "bucketHint === 'travel_tour'");
    assertContains(dashboardJs, "db.collection('bookings').where('ownerId', '==', state.ownerId)");
    assertContains(dashboardJs, "db.collection('travel_bookings').where('ownerId', '==', state.ownerId)");
    assertContains(dashboardJs, "db.collection(DATA.COLLECTIONS.bookings).where('vendorId', '==', vendorId)");
    assertContains(dashboardJs, "if (state.ownerMode && state.ownerId) {\n      subscribeOwnerBookingAlerts(db);\n      return;\n    }");
    assertContains(dashboardJs, "notificationDedupeKey");
    assertContains(dashboardJs, "serviceTypeForBooking(booking) + ':' + bookingId");
    assertContains(dashboardJs, "return state.ownerMode ? serviceTypeForBooking(booking) + ':' + bookingId : bookingId");
    assertContains(dashboardJs, 'state.ownerNotifications.slice(0, 120)');
    assertContains(dashboardJs, 'state.ownerNotifications = state.ownerNotifications.slice(0, 120)');
    assertContains(dashboardJs, 'function addNotification');
    assertContains(dashboardJs, 'function renderNotificationDrawer');
    assertContains(dashboardJs, 'if (!state.soundReady) unlockSoundAlerts()');
    assertContains(dashboardJs, 'beforeUnloadBound: false');
    assertContains(dashboardJs, 'if (!state.beforeUnloadBound)');
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
    // The 5 stat cards are now clickable filters; the 3 separate lists
    // (today/pending/upcoming) collapsed into one dynamic list bound to
    // state.summaryFilter. Counter IDs are preserved.
    assertContains(dashboardHtml, 'data-summary-filter="today"');
    assertContains(dashboardHtml, 'data-summary-filter="upcoming"');
    assertContains(dashboardHtml, 'data-summary-filter="pending"');
    assertContains(dashboardHtml, 'data-summary-filter="in_progress"');
    assertContains(dashboardHtml, 'data-summary-filter="completed_today"');
    assertContains(dashboardHtml, 'id="mbAppointmentList"');
    assertContains(dashboardHtml, 'id="mbAppointmentListTitle"');
    assertContains(dashboardHtml, 'id="mbStatToday"');
    assertContains(dashboardHtml, 'id="mbStatUpcoming"');
    assertContains(dashboardHtml, 'id="mbStatPending"');
    assertContains(dashboardHtml, 'id="mbStatInProgress"');
    assertContains(dashboardHtml, 'id="mbStatCompleted"');
    assertContains(dashboardJs, "summaryFilter: 'today'");
    assertContains(dashboardJs, 'function bookingsForSummaryFilter');
    assertContains(dashboardJs, 'function setSummaryFilter');
    assertContains(dashboardJs, "renderBookingList('mbAppointmentList'");
    assertContains(dashboardJs, 'function formatTime12Hour');
    assertContains(dashboardJs, 'isUpcomingBooking');
    assertContains(dashboardJs, 'formatTime12Hour(booking.startTime)');
    assertContains(dashboardJs, "['confirmed', 'acceptAction']");
    assertContains(dashboardJs, "['rescheduled', 'rescheduleAction']");
    assertContains(dashboardJs, "['cancelled', 'cancelAction']");
    assertContains(dashboardJs, 'updateBookingStatus');
    assertContains(dashboardJs, 'customerPhone');
    assertContains(dashboardJs, 'customerEmail');
    assertContains(dashboardJs, 'photoUrls');
  });

  test('Mobile Barber owner review queue is i18n driven and guard validated', function() {
    var reviewKeys = [
      'filterNeedsReview',
      'appointmentListHintNeedsReview',
      'reviewQueueBadge',
      'reviewReasonLabel',
      'reviewConflictsLabel',
      'reviewReasonTimeConflict',
      'reviewReasonOutsideServiceRadius',
      'reviewReasonVendorReviewRequired',
      'reviewReasonTourDailyCap',
      'reviewReasonOutsideWorkingHours',
      'reviewReasonUnknown',
      'reviewApproveAction',
      'reviewRescheduleAction',
      'reviewDeclineAction',
      'reviewRescheduleDateLabel',
      'reviewRescheduleTimeLabel',
      'reviewApproveOverrideConfirm',
      'reviewDeclinePrompt',
      'reviewApproveSuccess',
      'reviewRescheduleConfirmSuccess',
      'reviewRescheduleReviewSuccess',
      'reviewDeclineSuccess',
      'reviewApproveBlocked',
      'reviewGuardUnavailable',
      'reviewOwnerOnly',
      'reviewRescheduleMissing',
      'statusRejected'
    ];
    ['en', 'vi', 'es'].forEach(function(lang, idx, langs) {
      var langPos = dashboardJs.indexOf(lang + ': {');
      assert(langPos >= 0, 'dashboard i18n missing language: ' + lang);
      var nextPos = idx + 1 < langs.length ? dashboardJs.indexOf(langs[idx + 1] + ': {', langPos + 1) : dashboardJs.indexOf('  };', langPos);
      var langBlock = dashboardJs.slice(langPos, nextPos >= 0 ? nextPos : dashboardJs.length);
      reviewKeys.forEach(function(key) {
        assertContains(langBlock, key + ':', lang + ' missing review key ' + key);
      });
    });
    [
      "time_conflict: 'reviewReasonTimeConflict'",
      "outside_service_radius: 'reviewReasonOutsideServiceRadius'",
      "vendor_review_required: 'reviewReasonVendorReviewRequired'",
      "tour_daily_cap: 'reviewReasonTourDailyCap'",
      "outside_working_hours: 'reviewReasonOutsideWorkingHours'"
    ].forEach(function(mapping) {
      assertContains(dashboardJs, mapping);
    });
    assertContains(dashboardHtml, 'data-owner-review-queue="appointments"');
    assertContains(dashboardJs, "{ key: 'needs_review', label: 'filterNeedsReview', icon: '' }");
    assertContains(dashboardJs, "state.serviceTypeFilter === 'needs_review'");
    assertContains(dashboardJs, 'function approveReviewBooking');
    assertContains(dashboardJs, 'function rescheduleReviewBooking');
    assertContains(dashboardJs, 'function declineReviewBooking');
    assertContains(dashboardJs, 'function buildReviewActions');
    assertContains(dashboardJs, "data-review-actions");
    assertContains(dashboardJs, "data-review-action");
    assertContains(dashboardJs, 'BookingGuard.validateUnifiedBookingRequest');
    assertContains(dashboardJs, "existingBookings: ownerReviewRowsExcept");
    assertContains(dashboardJs, "status: 'confirmed'");
    assertContains(dashboardJs, "status: 'rejected'");
    assertContains(dashboardJs, "reviewReason: null");
    assertContains(css, '.mb-booking-row--vendor-review');
    assertContains(css, '.mb-review-actions');
    assertContains(css, '.mb-review-chip');
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
    assertContains(firestoreRules, 'match /mobileBarberWaitlist/{waitlistId}');
    assertContains(firestoreRules, 'allow create: if request.resource.data.email is string');
    assertContains(firestoreRules, 'allow read, update, delete: if false;');
  });

  test('Mobile Barber dashboard supports en vi es translations', function() {
    assertContains(dashboardJs, 'var STRINGS = {');
    assertContains(dashboardJs, 'en: {');
    assertContains(dashboardJs, 'vi: {');
    assertContains(dashboardJs, 'es: {');
    assertContains(dashboardJs, 'setTranslatedText');
    assertContains(dashboardHtml, 'data-i18n="dashboardTitle"');
    // The standalone "Today" panel title is gone (clickable filter cards
    // drive the single appointment list now). Header is dynamic.
    assertContains(dashboardHtml, 'data-i18n="appointmentListTitle"');
    assertContains(dashboardHtml, 'data-i18n="statToday"');
    assertContains(dashboardHtml, 'data-i18n="servicesManageTitle"');
    assertContains(dashboardHtml, 'data-i18n="hoursTitle"');
    assertContains(dashboardHtml, 'data-i18n="portfolioTitle"');
    assertContains(dashboardHtml, 'data-i18n="reviewsManageTitle"');
  });
}

module.exports = {
  runMobileBarberLandingTests: runMobileBarberLandingTests
};
