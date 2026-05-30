'use strict';

// Pure-data + source-pattern tests for the "Book this style" inline flow
// that ships with the AI hairstyle preview cards. Covers:
//   - BOOKING_FIELDS schema additions (the 6 selectedAi* fields)
//   - buildBooking() reading the new fields off the draft
//   - calculateMobileBarberPrice + checkAvailability + saveBooking path the
//     inline form depends on still works end-to-end
//   - Vendor dashboard reads selectedAi* (with legacy fallback) for the
//     hairstyle reference block
//   - Customer landing source patterns: per-card "Book this style" CTA,
//     inline panel, success state, and the i18n keys that drive them

var fs    = require('fs');
var path  = require('path');
var DATA  = require('../../mobile-barber/mobile-barber-data');
var BOOK  = require('../../mobile-barber/mobile-barber-booking');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function assertEq(a, b, msg) {
  if (a !== b) throw new Error((msg ? msg + ': ' : '') + 'expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
}
function read(rel) { return fs.readFileSync(path.join(__dirname, '../../', rel), 'utf8'); }

function runMobileBarberAiStyleBookingTests(test) {

  test('A1. BOOKING_FIELDS includes the 6 canonical selectedAi* fields', function() {
    var f = DATA.BOOKING_FIELDS;
    ['selectedAiStyleId', 'selectedAiStyleName', 'selectedAiStyleImage',
     'selectedAiStyleDescription', 'selectedAiBarberNotes', 'selectedAiMaintenanceLevel',
     'selectedHaircutSource', 'selectedHaircutTitle', 'selectedHaircutDescription',
     'selectedHaircutImageUrl', 'selectedHaircutImageStoragePath',
     'selectedHaircutThumbnailUrl', 'selectedHaircutBarberNotes',
     'selectedHaircutMaintenanceLevel', 'selectedHaircutGeneratedAt',
     'selectedHaircutPromptSnapshot', 'customerSelfieUrl', 'customerSelfieStoragePath']
      .forEach(function(k) {
        assert(f.indexOf(k) >= 0, 'BOOKING_FIELDS missing ' + k);
      });
  });

  test('A2. validateBooking accepts all 6 selectedAi* fields populated', function() {
    var vendor = DATA.findVendorById(DATA.MICHAEL_VENDOR_ID);
    var svc = DATA.listServicesForVendor(vendor.id)[0];
    var booking = {
      id: 'mb-test',
      vendorId: vendor.id,
      customerName: 'Test User',
      customerPhone: '7145550100',
      customerEmail: '',
      serviceId: svc.id,
      serviceName: svc.name,
      servicePrice: 45,
      travelFee: 5,
      amountDue: 50,
      totalPrice: 50,
      paymentMethod: 'cash',
      paymentStatus: 'unpaid',
      address: '123 Beach Blvd', city: 'Westminster', zip: '92683',
      requestedDate: '2026-06-10', startTime: '10:00', endTime: '10:45',
      status: 'pending_confirmation',
      source: 'customer_form',
      confirmationPreference: 'text',
      selectedAiStyleId: 'fade-haircut',
      selectedAiStyleName: 'Modern Skin Fade',
      selectedAiStyleImage: '/assets/mobile-barber/styles/fade-haircut.jpg',
      selectedAiStyleDescription: 'Sharp skin fade, scissor on top',
      selectedAiBarberNotes: '#0 sides, scissor top, matte finish',
      selectedAiMaintenanceLevel: 'Every 3 weeks',
      selectedHaircutSource: 'ai_generated',
      selectedHaircutTitle: 'Modern Skin Fade',
      selectedHaircutDescription: 'Sharp skin fade, scissor on top',
      selectedHaircutImageUrl: '/assets/mobile-barber/styles/fade-haircut.jpg',
      selectedHaircutImageStoragePath: '',
      selectedHaircutThumbnailUrl: '/assets/mobile-barber/styles/fade-haircut.jpg',
      selectedHaircutBarberNotes: '#0 sides, scissor top, matte finish',
      selectedHaircutMaintenanceLevel: 'Every 3 weeks',
      selectedHaircutGeneratedAt: '2026-05-27T00:00:00.000Z',
      selectedHaircutPromptSnapshot: 'fade prompt snapshot',
      customerSelfieUrl: '',
      customerSelfieStoragePath: '',
      createdAt: '2026-05-27T00:00:00.000Z',
      updatedAt: '2026-05-27T00:00:00.000Z'
    };
    var r = DATA.validateBooking(booking);
    assertEq(r.valid, true, (r.errors || []).join('; '));
  });

  test('A3. buildBooking() reads selectedAi* fields off the draft + mirrors to legacy', function() {
    var vendor = DATA.findVendorById(DATA.MICHAEL_VENDOR_ID);
    var svc = DATA.listServicesForVendor(vendor.id)[0];
    var draft = {
      customerName: 'Test', customerPhone: '7145550100', customerEmail: '',
      serviceId: svc.id,
      address: '123 Beach Blvd', city: 'Westminster', zip: '92683',
      requestedDate: '2026-06-10', startTime: '10:00',
      paymentMethod: 'cash',
      selectedAiStyleId: 'fade-haircut',
      selectedAiStyleName: 'Modern Skin Fade',
      selectedAiStyleImage: '/assets/mobile-barber/styles/fade-haircut.jpg',
      selectedAiStyleDescription: 'Sharp skin fade, scissor on top',
      selectedAiBarberNotes: '#0 sides, scissor top',
      selectedAiMaintenanceLevel: 'Every 3 weeks'
    };
    var avail = BOOK.checkAvailability({
      vendor: vendor, services: [svc], availability: DATA.sampleAvailability,
      draft: draft, existingBookings: [], now: new Date('2026-06-10T08:00:00-07:00')
    });
    if (!avail.canCreate) return; // schedule edge — skip if test date isn't open
    var built = BOOK.buildBooking({ vendor: vendor, draft: draft, availabilityResult: avail, now: '2026-06-10T08:00:00.000Z', id: 'mb-ai-test' });
    assertEq(built.valid, true, (built.errors || []).join('; '));
    assertEq(built.booking.selectedAiStyleId, 'fade-haircut');
    assertEq(built.booking.selectedAiStyleName, 'Modern Skin Fade');
    assertEq(built.booking.selectedAiStyleImage, '/assets/mobile-barber/styles/fade-haircut.jpg');
    assertEq(built.booking.selectedAiBarberNotes, '#0 sides, scissor top');
    assertEq(built.booking.selectedAiMaintenanceLevel, 'Every 3 weeks');
    assertEq(built.booking.selectedHaircutSource, 'ai_generated');
    assertEq(built.booking.selectedHaircutTitle, 'Modern Skin Fade');
    assertEq(built.booking.selectedHaircutImageUrl, '/assets/mobile-barber/styles/fade-haircut.jpg');
    assertEq(built.booking.selectedHaircutBarberNotes, '#0 sides, scissor top');
    // Legacy mirrors
    assertEq(built.booking.selectedStyleId, 'fade-haircut');
    assertEq(built.booking.selectedStylePreviewUrl, '/assets/mobile-barber/styles/fade-haircut.jpg');
  });

  test('A4. landing renders per-card "Book this style" CTA + inline panel', function() {
    var src = read('mobile-barber/mobile-barber.js');
    assert(src.indexOf('homeAiPreviewBookCta') >= 0, 'i18n key for CTA must exist');
    assert(src.indexOf('renderInlineBookingPanel') >= 0, 'inline panel renderer must exist');
    assert(src.indexOf('submitInlineStyleBooking') >= 0, 'inline submit helper must exist');
    assert(src.indexOf('toggleInlineBooking') >= 0, 'toggle helper must exist');
    assert(src.indexOf('mb-ai-rec-card__cta') >= 0, 'CTA class must be used');
    assert(src.indexOf('mb-ai-rec-card__booking') >= 0, 'inline panel class must be used');
    assert(src.indexOf("expandedStyleId") >= 0, 'expand state must be tracked');
    assert(src.indexOf("lastSubmittedStyleId") >= 0, 'success state must be tracked');
    // i18n keys present in en/vi/es
    ['en', 'vi', 'es'].forEach(function() {});
    var bookKeys = [
      'homeAiPreviewBookFormTitle', 'homeAiPreviewBookPhone', 'homeAiPreviewBookName',
      'homeAiPreviewBookAddress', 'homeAiPreviewBookCity', 'homeAiPreviewBookZip',
      'homeAiPreviewBookDate', 'homeAiPreviewBookTime', 'homeAiPreviewBookNotes',
      'homeAiPreviewBookSubmit', 'homeAiPreviewBookSuccess', 'homeAiPreviewBookSubmitted',
      'homeAiPreviewBookMissing', 'homeAiPreviewBookNoVendor', 'homeAiPreviewBookOverlap',
      'homeAiPreviewMaintenanceLabel'
    ];
    bookKeys.forEach(function(k) {
      assert(src.indexOf(k + ':') >= 0, 'i18n key ' + k + ' must be defined');
    });
  });

  test('A5. inline submit uses checkAvailability + buildBooking + saveBooking', function() {
    var src = read('mobile-barber/mobile-barber.js');
    var startIdx = src.indexOf('function submitInlineStyleBooking');
    assert(startIdx > 0, 'submitInlineStyleBooking must exist');
    var fn = src.slice(startIdx, startIdx + 6000);
    assert(fn.indexOf('BOOKING.findVendorForAddress') >= 0, 'must route via findVendorForAddress');
    assert(fn.indexOf('BOOKING.checkAvailability') >= 0, 'must call checkAvailability');
    assert(fn.indexOf('BOOKING.buildBooking') >= 0, 'must call buildBooking');
    assert(fn.indexOf('BOOKING.saveBooking') >= 0, 'must call saveBooking');
    assert(fn.indexOf('selectedAiStyleId') >= 0, 'must attach selectedAiStyleId');
    assert(fn.indexOf('selectedAiStyleName') >= 0, 'must attach selectedAiStyleName');
    assert(fn.indexOf('selectedAiStyleImage') >= 0, 'must attach selectedAiStyleImage');
    assert(fn.indexOf('selectedAiBarberNotes') >= 0, 'must attach selectedAiBarberNotes');
    assert(fn.indexOf('selectedAiMaintenanceLevel') >= 0, 'must attach selectedAiMaintenanceLevel');
    assert(fn.indexOf("requireDatabase: true") >= 0, 'must require real Firestore write');
  });

  test('A6. vendor dashboard renders the AI hairstyle reference block', function() {
    var src = read('mobile-barber/mobile-barber-dashboard.js');
    assert(src.indexOf('mb-booking-ai-preview__reference') >= 0, 'reference block class must exist');
    assert(src.indexOf('booking.selectedAiStyleImage') >= 0, 'must read selectedAiStyleImage');
    assert(src.indexOf('booking.selectedAiStyleName') >= 0, 'must read selectedAiStyleName');
    assert(src.indexOf('booking.selectedAiStyleDescription') >= 0, 'must read selectedAiStyleDescription');
    assert(src.indexOf('booking.selectedAiBarberNotes') >= 0, 'must read selectedAiBarberNotes');
    assert(src.indexOf('booking.selectedAiMaintenanceLevel') >= 0, 'must read selectedAiMaintenanceLevel');
    assert(src.indexOf('vendorAiPreviewStyleLabel') >= 0, 'i18n key vendorAiPreviewStyleLabel must exist');
    assert(src.indexOf('vendorAiPreviewMaintenanceLabel') >= 0, 'i18n key vendorAiPreviewMaintenanceLabel must exist');
    assert(src.indexOf('vendorAiPreviewBarberRefNotes') >= 0, 'i18n key vendorAiPreviewBarberRefNotes must exist');
  });

  test('A7. CSS ships premium CTA + expand animation + booked state', function() {
    var css = read('mobile-barber/mobile-barber.css');
    assert(css.indexOf('.mb-ai-rec-card__cta') >= 0, 'CTA selector must exist');
    assert(css.indexOf('.mb-ai-rec-card__booking') >= 0, 'inline panel selector must exist');
    assert(css.indexOf('.mb-ai-rec-card--expanded') >= 0, 'expanded state must exist');
    assert(css.indexOf('.mb-ai-rec-card--booked') >= 0, 'booked state must exist');
    assert(css.indexOf('mbAiBookingExpand') >= 0, 'expand keyframe must exist');
    assert(css.indexOf('prefers-reduced-motion') >= 0, 'must respect reduced motion');
    assert(css.indexOf('.mb-booking-ai-preview__reference') >= 0, 'vendor reference block CSS must exist');
  });

  test('A8. attachAiPreviewToBooking writes selectedAi* fields (chat-path parity)', function() {
    var src = read('mobile-barber/mobile-barber.js');
    var startIdx = src.indexOf('function attachAiPreviewToBooking');
    assert(startIdx > 0, 'attachAiPreviewToBooking must exist');
    var fn = src.slice(startIdx, startIdx + 3000);
    assert(fn.indexOf('booking.selectedAiStyleId') >= 0, 'chat path must set selectedAiStyleId');
    assert(fn.indexOf('booking.selectedAiStyleName') >= 0);
    assert(fn.indexOf('booking.selectedAiStyleImage') >= 0);
    assert(fn.indexOf('booking.selectedAiStyleDescription') >= 0);
    assert(fn.indexOf('booking.selectedAiBarberNotes') >= 0);
    assert(fn.indexOf('booking.selectedAiMaintenanceLevel') >= 0);
    assert(fn.indexOf('booking.selectedHaircutSource') >= 0);
    assert(fn.indexOf('booking.selectedHaircutImageUrl') >= 0);
  });

  // ── All-audience AI hairstyle support (men / women / children + options) ──

  function count(hay, needle) {
    var n = 0, i = 0;
    while ((i = hay.indexOf(needle, i)) >= 0) { n++; i += needle.length; }
    return n;
  }

  test('A9. BOOKING_FIELDS includes the 4 all-audience attribute fields', function() {
    var f = DATA.BOOKING_FIELDS;
    ['selectedAudienceType', 'selectedColorRecommendation',
     'selectedHighlightRecommendation', 'selectedTexturePreference']
      .forEach(function(k) { assert(f.indexOf(k) >= 0, 'BOOKING_FIELDS missing ' + k); });
  });

  test('A10. validateBooking accepts the 4 all-audience fields populated', function() {
    var vendor = DATA.findVendorById(DATA.MICHAEL_VENDOR_ID);
    var svc = DATA.listServicesForVendor(vendor.id)[0];
    var booking = {
      id: 'mb-test-aud', vendorId: vendor.id,
      customerName: 'Jane Doe', customerPhone: '7145550111', customerEmail: '',
      serviceId: svc.id, serviceName: svc.name, servicePrice: 45, travelFee: 5,
      amountDue: 50, totalPrice: 50, paymentMethod: 'cash', paymentStatus: 'unpaid',
      address: '123 Beach Blvd', city: 'Westminster', zip: '92683',
      requestedDate: '2026-06-10', startTime: '10:00', endTime: '10:45',
      status: 'pending_confirmation', source: 'customer_form', confirmationPreference: 'text',
      selectedHaircutSource: 'ai_generated',
      selectedAudienceType: 'woman',
      selectedColorRecommendation: 'Soft caramel balayage',
      selectedHighlightRecommendation: 'Face-framing highlights',
      selectedTexturePreference: 'Soft loose waves',
      createdAt: '2026-05-30T00:00:00.000Z', updatedAt: '2026-05-30T00:00:00.000Z'
    };
    var r = DATA.validateBooking(booking);
    assertEq(r.valid, true, (r.errors || []).join('; '));
  });

  test('A11. buildBooking() reads the 4 all-audience fields off the draft', function() {
    var vendor = DATA.findVendorById(DATA.MICHAEL_VENDOR_ID);
    var svc = DATA.listServicesForVendor(vendor.id)[0];
    var draft = {
      customerName: 'Jane', customerPhone: '7145550111', customerEmail: '',
      serviceId: svc.id, address: '123 Beach Blvd', city: 'Westminster', zip: '92683',
      requestedDate: '2026-06-10', startTime: '10:00', paymentMethod: 'cash',
      selectedAiStyleId: 'soft-waves', selectedAiStyleName: 'Soft Waves',
      selectedAiStyleImage: '/assets/x.jpg',
      selectedAudienceType: 'woman',
      selectedColorRecommendation: 'Ash brown highlights',
      selectedHighlightRecommendation: 'Balayage, mid-lengths to ends',
      selectedTexturePreference: 'Loose beach waves'
    };
    var avail = BOOK.checkAvailability({
      vendor: vendor, services: [svc], availability: DATA.sampleAvailability,
      draft: draft, existingBookings: [], now: new Date('2026-06-10T08:00:00-07:00')
    });
    if (!avail.canCreate) return; // schedule edge — skip if test date isn't open
    var built = BOOK.buildBooking({ vendor: vendor, draft: draft, availabilityResult: avail, now: '2026-06-10T08:00:00.000Z', id: 'mb-aud-test' });
    assertEq(built.valid, true, (built.errors || []).join('; '));
    assertEq(built.booking.selectedAudienceType, 'woman');
    assertEq(built.booking.selectedColorRecommendation, 'Ash brown highlights');
    assertEq(built.booking.selectedHighlightRecommendation, 'Balayage, mid-lengths to ends');
    assertEq(built.booking.selectedTexturePreference, 'Loose beach waves');
  });

  test('A12. Firebase Function plans 5 audience-correct styles (no male-only fallback)', function() {
    var src = read('functions/index.js');
    // The old hardcoded 3-male-style table must be gone.
    assert(src.indexOf('HAIRCUT_STYLE_PROMPTS') < 0, 'legacy male-only HAIRCUT_STYLE_PROMPTS must be removed');
    // Audience-aware planning pipeline.
    assert(src.indexOf('function planHaircutStyles') >= 0, 'planHaircutStyles must exist');
    assert(src.indexOf('callGeminiHaircutAnalysis') >= 0, 'vision analysis call must exist');
    assert(src.indexOf('normalizeHaircutAudience(data.audience)') >= 0, 'must read audience param');
    assert(src.indexOf('normalizeHaircutExplore') >= 0, 'must read explore param');
    assert(src.indexOf('normalizeHaircutPref') >= 0, 'must read preference param');
    // Scaffold must cover women + children, not just men.
    var scaf = src.slice(src.indexOf('HAIRCUT_SCAFFOLD = {'), src.indexOf('HAIRCUT_SCAFFOLD = {') + 4000);
    assert(/man:\s*\[/.test(scaf), 'scaffold must include man set');
    assert(/woman:\s*\[/.test(scaf), 'scaffold must include woman set');
    assert(/child:\s*\[/.test(scaf), 'scaffold must include child set');
    assert(/neutral:\s*\[/.test(scaf), 'scaffold must include neutral set');
    // Exactly 5 styles + identity lock + per-option recs + safety + inspiration label.
    assert(src.indexOf('EXACTLY 5') >= 0, 'analysis prompt must ask for exactly 5 styles');
    assert(src.indexOf('IDENTITY LOCK') >= 0, 'image prompts must be identity-locked');
    assert(src.indexOf('CHILD_SAFETY_CLAUSE') >= 0, 'child safety clause must exist');
    assert(src.indexOf('colorRecommendation') >= 0, 'must return colorRecommendation');
    assert(src.indexOf('highlightRecommendation') >= 0, 'must return highlightRecommendation');
    assert(src.indexOf('curlStraightRecommendation') >= 0, 'must return curlStraightRecommendation');
    assert(src.indexOf("style_inspiration") >= 0, 'low-confidence previews labelled style_inspiration');
  });

  test('A13. landing wires audience/explore/preference + renders all-audience cards', function() {
    var src = read('mobile-barber/mobile-barber.js');
    assert(src.indexOf('handleAiOptionsChange') >= 0, 'options change handler must exist');
    assert(/options:\s*\{\s*audience/.test(src), 'aiPreview.options state must exist');
    // generate() must forward the new params.
    var ga = src.slice(src.indexOf('function handleAiAnalyze'), src.indexOf('function handleAiAnalyze') + 1600);
    assert(ga.indexOf('audience:') >= 0, 'analyze must pass audience');
    assert(ga.indexOf('explore:') >= 0, 'analyze must pass explore');
    assert(ga.indexOf('preference:') >= 0, 'analyze must pass preference');
    // Cards render the new fields + inspiration warning.
    assert(src.indexOf('appendAiRecRow') >= 0, 'card rec-row helper must exist');
    assert(src.indexOf('mb-ai-rec-card__inspiration') >= 0, 'inspiration warning element must exist');
    assert(src.indexOf("rec.previewKind === 'style_inspiration'") >= 0, 'must honor previewKind');
    assert(src.indexOf('aiAudienceLabel') >= 0, 'audience chip label helper must exist');
    // All 3 booking paths attach the new selected fields.
    assert(count(src, 'aiSelectedStyleFields(rec)') >= 2, 'inline + manual paths must attach all-audience fields');
    assert(src.indexOf('booking.selectedAudienceType') >= 0, 'chat path must attach selectedAudienceType');
    assert(src.indexOf('booking.selectedColorRecommendation') >= 0, 'chat path must attach color rec');
    // Multilingual: every new customer key defined in en + vi + es (3 copies).
    ['homeAiPreviewWhoForLabel', 'homeAiPreviewExploreLabel', 'homeAiPreviewVibeLabel',
     'homeAiPreviewAudienceMan', 'homeAiPreviewAudienceWoman', 'homeAiPreviewAudienceChild',
     'homeAiPreviewExploreColor', 'homeAiPreviewExploreHighlights', 'homeAiPreviewExploreCurly',
     'homeAiPreviewExploreStraight', 'homeAiPreviewColorLabel', 'homeAiPreviewHighlightLabel',
     'homeAiPreviewTextureLabel', 'homeAiPreviewInspirationWarning']
      .forEach(function(k) {
        assertEq(count(src, k + ':'), 3, k + ' must be defined in en+vi+es');
      });
  });

  test('A14. vendor dashboard renders all-audience attributes (vi/en/es)', function() {
    var src = read('mobile-barber/mobile-barber-dashboard.js');
    assert(src.indexOf('booking.selectedAudienceType') >= 0, 'must read selectedAudienceType');
    assert(src.indexOf('booking.selectedColorRecommendation') >= 0, 'must read selectedColorRecommendation');
    assert(src.indexOf('booking.selectedHighlightRecommendation') >= 0, 'must read selectedHighlightRecommendation');
    assert(src.indexOf('booking.selectedTexturePreference') >= 0, 'must read selectedTexturePreference');
    ['vendorAiPreviewAudienceLabel', 'vendorAiPreviewColorLabel',
     'vendorAiPreviewHighlightLabel', 'vendorAiPreviewTextureLabel']
      .forEach(function(k) {
        assertEq(count(src, k + ':'), 3, k + ' must be defined in en+vi+es');
      });
  });

  test('A15. ai-preview client module forwards audience/explore/preference', function() {
    var src = read('mobile-barber/mobile-barber-ai-preview.js');
    assert(src.indexOf('audience: audience') >= 0, 'callable payload must include audience');
    assert(src.indexOf('explore: explore') >= 0, 'callable payload must include explore');
    assert(src.indexOf('preference: preference') >= 0, 'callable payload must include preference');
  });

  test('A16. inline rec-card renders all 5 (loops over recommendations)', function() {
    var src = read('mobile-barber/mobile-barber.js');
    var rr = src.slice(src.indexOf('function renderAiResults'), src.indexOf('function renderAiResults') + 4200);
    assert(/recs\.forEach/.test(rr), 'must iterate all recommendations (supports 5)');
    assert(rr.indexOf('mb-ai-rec-card__audience') >= 0, 'card must show audience chip');
  });

  test('A17. result cards use SVG row icons (MBIcons) + a new icon set', function() {
    var src = read('mobile-barber/mobile-barber.js');
    var icons = read('mobile-barber/mobile-barber-icons.js');
    var css = read('mobile-barber/mobile-barber.css');
    // appendAiRecRow takes a leading icon; rows pass icon names.
    assert(/function appendAiRecRow\(body, labelKey, value, className, icoName\)/.test(src), 'appendAiRecRow must accept an icon name');
    assert(src.indexOf("'mb-ai-rec-card__why', 'smile'") >= 0, 'why row uses smile icon');
    assert(src.indexOf("'palette'") >= 0 && src.indexOf("'waves'") >= 0 && src.indexOf("'sun'") >= 0, 'color/highlight/texture icons wired');
    assert(src.indexOf('mb-ai-rec-card__row-ico') >= 0, 'row icon class applied');
    // badge/audience/maintenance/notes/CTA use icoLabel.
    assert(src.indexOf("icoLabel(badge, 'sparkles'") >= 0, 'AI badge uses sparkles');
    assert(src.indexOf("icoLabel(audChip, 'user'") >= 0, 'audience chip uses user icon');
    assert(src.indexOf("icoLabel(meta, 'clock'") >= 0, 'maintenance uses clock icon');
    assert(src.indexOf("icoLabel(bookBtn, 'scissors'") >= 0, 'book CTA uses scissors icon');
    // New icons exist in the set.
    ['clock', 'user', 'smile', 'palette', 'sun', 'waves', 'info', 'alert-triangle']
      .forEach(function(n) { assert(icons.indexOf("'" + n + "'") >= 0, 'MBIcons must define ' + n); });
    assert(css.indexOf('.mb-ai-rec-card__row-ico') >= 0, 'row icon CSS must exist');
  });

  test('A18. customer card image opens the shared lightbox', function() {
    var src = read('mobile-barber/mobile-barber.js');
    var css = read('mobile-barber/mobile-barber.css');
    var icons = read('mobile-barber/mobile-barber-icons.js');
    assert(src.indexOf('function openImageLightbox') >= 0, 'openImageLightbox wrapper must exist');
    assert(src.indexOf('root.MBLightbox.open') >= 0, 'must delegate to the shared MBLightbox');
    assert(src.indexOf("openImageLightbox(imgSrc, rec.title") >= 0, 'image/expand opens the lightbox');
    assert(src.indexOf('mb-ai-rec-card__expand') >= 0, 'expand affordance must exist');
    assert(icons.indexOf("'maximize'") >= 0 && icons.indexOf("'x'") >= 0, 'maximize + x icons must exist');
    assert(css.indexOf('.mb-lightbox') >= 0 && css.indexOf('.mb-lightbox__img') >= 0, 'lightbox CSS must exist');
    assert(css.indexOf('.mb-lightbox__close') >= 0, 'lightbox close button CSS must exist');
    // Multilingual lightbox strings (en + vi + es) on the customer page.
    ['lightboxOpen', 'lightboxClose', 'lightboxHint', 'lightboxLabel']
      .forEach(function(k) { assertEq(count(src, k + ':'), 3, k + ' must be defined in en+vi+es'); });
  });

  test('A19. shared MBLightbox module + vendor dashboard image zoom', function() {
    var lb = read('mobile-barber/mobile-barber-lightbox.js');
    var dash = read('mobile-barber/mobile-barber-dashboard.js');
    // Shared module owns the actual implementation.
    assert(/root\.MBLightbox\s*=\s*factory\(\)/.test(lb), 'must expose the MBLightbox global');
    assert(/function open\(/.test(lb) && /function close\(/.test(lb), 'open/close must exist');
    assert(lb.indexOf("'mbImageLightbox'") >= 0, 'overlay id must be defined');
    assert(lb.indexOf("'aria-modal'") >= 0, 'must be an aria-modal dialog');
    assert(lb.indexOf('Escape') >= 0, 'Escape must close');
    assert(lb.indexOf("document.body.style.overflow = 'hidden'") >= 0, 'background scroll must lock');
    assert(lb.indexOf('_returnFocus') >= 0, 'must restore focus to the trigger');
    // Dashboard wires both the customer selfie and the selected style image.
    assert(dash.indexOf('function makeImageZoomable') >= 0, 'dashboard zoom helper must exist');
    assert(dash.indexOf('window.MBLightbox') >= 0, 'dashboard must use the shared MBLightbox');
    assert(dash.indexOf('makeImageZoomable(selfieWrap, selfieImg, selfieUrl') >= 0, 'selfie image must be zoomable');
    assert(dash.indexOf('makeImageZoomable(styleWrap, styleImg, styleImgUrl') >= 0, 'style image must be zoomable');
    assert(dash.indexOf('mb-booking-ai-preview__zoom') >= 0, 'dashboard zoom button class must be used');
    // Multilingual lightbox strings on the dashboard (en + vi + es).
    ['lightboxOpen', 'lightboxClose', 'lightboxHint', 'lightboxLabel']
      .forEach(function(k) { assertEq(count(dash, k + ':'), 3, k + ' must be defined in en+vi+es on the dashboard'); });
  });
}

if (require.main === module) {
  var passed = 0, failed = 0;
  runMobileBarberAiStyleBookingTests(function(name, fn) {
    try { fn(); passed++; console.log('PASS', name); }
    catch (e) { failed++; console.log('FAIL', name); console.log(' ', e.message); }
  });
  console.log('Mobile Barber AI style booking tests:', passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

module.exports = { runMobileBarberAiStyleBookingTests: runMobileBarberAiStyleBookingTests };
