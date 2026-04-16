// travel-booking.js — Travel booking wizard module.  v1.4
// Loaded by travel.html. Depends on:
//   DLC_TRAVEL_PACKAGES  (travel-packages.js)
//   DLCPricing           (pricing.js — must be loaded before this file)
//   firebase / db        (injected via TravelBooking.init({ db, lang }))

var TravelBooking = (function() {
  'use strict';

  // ── i18n strings ─────────────────────────────────────────────────────────
  var STRINGS = {
    en: {
      tpFromLabel:      'From',
      tpPerPersonLabel: 'per person (group)',
      tpPrivateLabel:   'Private from',
      tpHighlightsHead: 'Highlights',
      tpItineraryHead:  'Itinerary',
      tpVideoHead:      'Tour Preview',
      tpGroupPrice:     'Group from',
      tpBookNow:        'Book Now',
      tpTypeLabel:      'Tour type',
      tpPrivateType:    'Private (exclusive vehicle)',
      tpGroupType:      'Group (join a group)',
      tpNext:           'Next →',
      tpTravelersLabel: 'Number of travelers',
      tpDateLabel:      'Tour date',
      tpPickupLabel:    'Your pickup location',
      tpPickupPh:       'City or address (e.g. San Jose, CA)',
      tpQuoteLabel:     'Your quote',
      tpNameLabel:      'Your name',
      tpPhoneLabel:     'Phone number',
      tpEmailLabel:     'Email (optional — for confirmation)',
      tpEmailPh:        'you@email.com',
      tpConfirm:        'Confirm Booking',
      tpSuccessTitle:   'Booking Confirmed!',
      tpSuccessSub:     "We'll call you within 2 hours to confirm details.",
      tpSubtotal:       'Subtotal',
      tpTaxes:          'Taxes (8.75%)',
      tpTotal:          'Total',
      tpVehicle:        'Vehicle',
      tpDay:            'day',
      tpDays:           'days',
    },
    vi: {
      tpFromLabel:      'Từ',
      tpPerPersonLabel: 'mỗi người (nhóm)',
      tpPrivateLabel:   'Riêng từ',
      tpHighlightsHead: 'Điểm Nổi Bật',
      tpItineraryHead:  'Lịch Trình',
      tpVideoHead:      'Xem Trước Tour',
      tpGroupPrice:     'Nhóm từ',
      tpBookNow:        'Đặt Ngay',
      tpTypeLabel:      'Loại tour',
      tpPrivateType:    'Riêng (xe chuyên dụng)',
      tpGroupType:      'Nhóm (đi chung)',
      tpNext:           'Tiếp →',
      tpTravelersLabel: 'Số người',
      tpDateLabel:      'Ngày tour',
      tpPickupLabel:    'Điểm đón của bạn',
      tpPickupPh:       'Thành phố hoặc địa chỉ (ví dụ: San Jose, CA)',
      tpQuoteLabel:     'Báo giá',
      tpNameLabel:      'Họ tên',
      tpPhoneLabel:     'Điện thoại',
      tpEmailLabel:     'Email (tùy chọn — nhận xác nhận đặt tour)',
      tpEmailPh:        'ban@email.com',
      tpConfirm:        'Xác Nhận Đặt Tour',
      tpSuccessTitle:   'Đặt Tour Thành Công!',
      tpSuccessSub:     'Chúng tôi sẽ gọi cho bạn trong 2 giờ để xác nhận.',
      tpSubtotal:       'Tạm tính',
      tpTaxes:          'Thuế (8.75%)',
      tpTotal:          'Tổng cộng',
      tpVehicle:        'Phương tiện',
      tpDay:            'ngày',
      tpDays:           'ngày',
    },
    es: {
      tpFromLabel:      'Desde',
      tpPerPersonLabel: 'por persona (grupo)',
      tpPrivateLabel:   'Privado desde',
      tpHighlightsHead: 'Puntos Destacados',
      tpItineraryHead:  'Itinerario',
      tpVideoHead:      'Vista Previa',
      tpGroupPrice:     'Grupo desde',
      tpBookNow:        'Reservar Ahora',
      tpTypeLabel:      'Tipo de tour',
      tpPrivateType:    'Privado (vehículo exclusivo)',
      tpGroupType:      'Grupo (viaje compartido)',
      tpNext:           'Siguiente →',
      tpTravelersLabel: 'Viajeros',
      tpDateLabel:      'Fecha del tour',
      tpPickupLabel:    'Tu lugar de recogida',
      tpPickupPh:       'Ciudad o dirección (ej. San Jose, CA)',
      tpQuoteLabel:     'Tu cotización',
      tpNameLabel:      'Tu nombre',
      tpPhoneLabel:     'Teléfono',
      tpEmailLabel:     'Correo electrónico (opcional — para confirmación)',
      tpEmailPh:        'tu@correo.com',
      tpConfirm:        'Confirmar Reserva',
      tpSuccessTitle:   '¡Reserva Confirmada!',
      tpSuccessSub:     'Te llamaremos en 2 horas para confirmar los detalles.',
      tpSubtotal:       'Subtotal',
      tpTaxes:          'Impuestos (8.75%)',
      tpTotal:          'Total',
      tpVehicle:        'Vehículo',
      tpDay:            'día',
      tpDays:           'días',
    },
  };

  // ── Module state ──────────────────────────────────────────────────────────
  var _db, _lang, _pkg, _type, _travelers, _date, _pickupLocation, _email, _quote;

  function t(key) {
    var s = STRINGS[_lang] || STRINGS.en;
    return (s && s[key] != null) ? s[key] : ((STRINGS.en[key] != null) ? STRINGS.en[key] : key);
  }

  // ── Booking ID (TRV- prefix, distinct from DLC- ride bookings) ───────────
  function generateBookingId() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var id = 'TRV-';
    var arr = new Uint8Array(6);
    crypto.getRandomValues(arr);
    for (var i = 0; i < arr.length; i++) id += chars[arr[i] % chars.length];
    return id;
  }

  // ── Apply i18n to data-i18n / data-i18n-ph elements ──────────────────────
  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      var key = el.getAttribute('data-i18n');
      var val = t(key);
      if (val !== key) el.textContent = val;
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function(el) {
      var key = el.getAttribute('data-i18n-ph');
      var val = t(key);
      if (val !== key) el.placeholder = val;
    });
  }

  // ── Render package data into the page ────────────────────────────────────
  function renderPackage(pkg) {
    _pkg = pkg;

    // Localised name
    var nameKey = _lang === 'vi' ? 'name_vi' : (_lang === 'es' ? 'name_es' : 'name');
    var name = pkg[nameKey] || pkg.name;

    document.title = name + ' · Du Lich Cali';

    var nameEl = document.getElementById('tpPkgName');
    if (nameEl) nameEl.textContent = name;

    var durEl = document.getElementById('tpDurationBadge');
    if (durEl) durEl.textContent = pkg.duration_days + ' ' +
      (pkg.duration_days === 1 ? t('tpDay') : t('tpDays'));

    // Hero image
    var heroImg = document.getElementById('tpHeroImg');
    if (heroImg && pkg.images && pkg.images[0]) {
      heroImg.src = pkg.images[0];
      heroImg.alt = name;
    }

    // Resolve starting private price (1_2 tier if tiered, else flat)
    var privateFrom = (pkg.pricing_private && pkg.pricing_private['1_2'])
      ? pkg.pricing_private['1_2']
      : pkg.base_price_private;
    var privateDisplay = 'from $' + privateFrom;

    // Price bar
    var gpEl = document.getElementById('tpGroupPrice');
    var ppEl = document.getElementById('tpPrivatePrice');
    if (gpEl) gpEl.textContent = '$' + pkg.base_price_per_person_group;
    if (ppEl) ppEl.textContent = privateDisplay;

    // Panel price
    var panelEl = document.getElementById('tpPanelPrice');
    if (panelEl) panelEl.textContent = '$' + pkg.base_price_per_person_group + '/person';

    // Wizard type buttons
    var tpp = document.getElementById('tpTypePrivatePrice');
    var tpg = document.getElementById('tpTypeGroupPrice');
    if (tpp) tpp.textContent = privateDisplay;
    if (tpg) tpg.textContent = '$' + pkg.base_price_per_person_group + '/person';

    // Highlights
    var hlList = document.getElementById('tpHighlightsList');
    if (hlList) {
      hlList.innerHTML = '';
      (pkg.highlights || []).forEach(function(h) {
        var li = document.createElement('li');
        li.textContent = h[_lang] || h.en;
        hlList.appendChild(li);
      });
    }

    // Itinerary
    var itinEl = document.getElementById('tpItinerary');
    if (itinEl) {
      itinEl.innerHTML = '';
      (pkg.itinerary || []).forEach(function(item) {
        var div = document.createElement('div');
        div.className = 'tp-itin-item';
        div.innerHTML =
          '<span class="tp-itin-time">' + escapeHtml(item.time) + '</span>' +
          '<span class="tp-itin-desc">' + escapeHtml(item[_lang] || item.en) + '</span>';
        itinEl.appendChild(div);
      });
    }

    // Media strip + hero swap (image ↔ YouTube)
    // Try all field name variants: youtubeId (from generate-travel-promo.js Firestore update),
    // youtube_video_id (alias), or extract from promo_video_url full URL (static file fallback).
    var vidId = pkg.youtubeId || pkg.youtube_video_id ||
      _extractYouTubeId(pkg.promo_video_url) || '';
    _renderMediaStrip(pkg.images && pkg.images[0] ? pkg.images[0] : null, vidId);

    // ── Attractions (Phase 10) ─────────────────────────────────────────────
    var attrEl = document.getElementById('tpAttractions');
    if (attrEl) {
      var attrs = pkg.attractions || [];
      if (attrs.length) {
        attrEl.parentElement && attrEl.parentElement.classList.remove('tp-section--hidden');
        attrEl.innerHTML = '';
        attrs.forEach(function(a) {
          var nameStr = (_lang === 'vi' && a.name_vi) ? a.name_vi : a.name;
          var feeStr  = a.entry_fee === 0 ? 'Free' : (a.entry_fee ? '$' + a.entry_fee : '');
          var card = document.createElement('div');
          card.className = 'tp-attr-card';
          card.innerHTML =
            '<span class="tp-attr-name">' + escapeHtml(nameStr) + '</span>' +
            (feeStr ? '<span class="tp-attr-fee">' + escapeHtml(feeStr) + '</span>' : '') +
            (a.notes_en ? '<span class="tp-attr-note">' + escapeHtml(a.notes_en) + '</span>' : '');
          attrEl.appendChild(card);
        });
      } else {
        // Hide section if no attractions
        var attrSection = document.getElementById('tpAttractionsSection');
        if (attrSection) attrSection.style.display = 'none';
      }
    }

    // ── Hotel options (Phase 10) ───────────────────────────────────────────
    var hotelEl = document.getElementById('tpHotels');
    if (hotelEl) {
      var hotels = pkg.hotel_options || [];
      if (hotels.length) {
        hotelEl.innerHTML = '';
        hotels.forEach(function(h) {
          var tierBadge = h.tier === 'premium' ? '★ Premium' : 'Standard';
          var nightLabel = h.night ? ' · Night ' + h.night : '';
          var card = document.createElement('div');
          card.className = 'tp-hotel-card';
          card.innerHTML =
            '<div class="tp-hotel-card__header">' +
              '<span class="tp-hotel-card__name">' + escapeHtml(h.name) + '</span>' +
              '<span class="tp-hotel-card__tier">' + tierBadge + '</span>' +
            '</div>' +
            '<div class="tp-hotel-card__loc">' + escapeHtml(h.location) + nightLabel + '</div>' +
            '<div class="tp-hotel-card__price">~$' + h.price_per_night + '/night</div>' +
            (h.amenities_en ? '<div class="tp-hotel-card__amenities">' + escapeHtml(h.amenities_en) + '</div>' : '');
          hotelEl.appendChild(card);
        });
      } else {
        var hotelSection = document.getElementById('tpHotelsSection');
        if (hotelSection) hotelSection.style.display = 'none';
      }
    }
  }

  // ── Render related packages (Phase 12) ────────────────────────────────────
  function renderRelatedPackages(currentPkgId) {
    var el = document.getElementById('tpRelatedPkgs');
    if (!el) return;
    var all = window.DLC_TRAVEL_PACKAGES || [];
    var related = all.filter(function(p) { return p.active !== false && p.id !== currentPkgId; });
    if (!related.length) {
      var sec = document.getElementById('tpRelatedSection');
      if (sec) sec.style.display = 'none';
      return;
    }
    el.innerHTML = '';
    related.slice(0, 3).forEach(function(p) {
      var nameKey = _lang === 'vi' ? 'name_vi' : (_lang === 'es' ? 'name_es' : 'name');
      var pname = p[nameKey] || p.name;
      var privateFrom = (p.pricing_private && p.pricing_private['1_2']) ? p.pricing_private['1_2'] : p.base_price_private;
      var card = document.createElement('a');
      card.href    = '/travel?pkg=' + p.id;
      card.className = 'tp-related-card';
      card.innerHTML =
        '<div class="tp-related-card__img" style="background-image:url(' + escapeHtml(p.images && p.images[0] || '/monterey.jpg') + ')"></div>' +
        '<div class="tp-related-card__body">' +
          '<div class="tp-related-card__name">' + escapeHtml(pname) + '</div>' +
          '<div class="tp-related-card__price">from $' + (p.base_price_per_person_group) + '/person</div>' +
        '</div>';
      el.appendChild(card);
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ── YouTube ID extraction ─────────────────────────────────────────────────
  // Handles: https://www.youtube.com/watch?v=ID  |  https://youtu.be/ID
  function _extractYouTubeId(url) {
    if (!url || typeof url !== 'string') return '';
    var m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : '';
  }

  // ── Media thumbnail strip ─────────────────────────────────────────────────
  // Renders a strip of thumbnails (hero image + promo video) below the hero.
  // Clicking a thumb swaps the hero area between photo and YouTube iframe.
  function _renderMediaStrip(heroImgSrc, vidId) {
    var strip = document.getElementById('tpMediaStrip');
    if (!strip) return;
    // Only show strip if there is a video to pair with the image
    if (!vidId) { strip.style.display = 'none'; return; }

    strip.innerHTML = '';
    strip.style.display = 'flex';

    var items = [];
    if (heroImgSrc) items.push({ type: 'image', src: heroImgSrc });
    items.push({ type: 'video', vidId: vidId });

    items.forEach(function(item, i) {
      var thumb = document.createElement('div');
      thumb.className = 'tp-media-thumb' + (i === 0 ? ' tp-media-thumb--active' : '');

      var imgEl = document.createElement('img');
      imgEl.alt = '';
      thumb.appendChild(imgEl);

      if (item.type === 'image') {
        imgEl.src = item.src;
      } else {
        imgEl.src = 'https://img.youtube.com/vi/' + encodeURIComponent(item.vidId) + '/mqdefault.jpg';
        var playOverlay = document.createElement('div');
        playOverlay.className = 'tp-media-thumb__play';
        playOverlay.textContent = '▶';
        thumb.appendChild(playOverlay);
      }

      thumb.addEventListener('click', function() { _setActiveMedia(thumb, item); });
      strip.appendChild(thumb);
    });
  }

  function _setActiveMedia(clickedThumb, item) {
    var strip = document.getElementById('tpMediaStrip');
    if (strip) {
      var thumbs = strip.querySelectorAll('.tp-media-thumb');
      for (var i = 0; i < thumbs.length; i++) {
        thumbs[i].classList.remove('tp-media-thumb--active');
      }
      clickedThumb.classList.add('tp-media-thumb--active');
    }

    var heroImg     = document.getElementById('tpHeroImg');
    var heroOverlay = document.querySelector('.tp-hero__overlay');
    var heroVideo   = document.getElementById('tpHeroVideo');

    if (item.type === 'image') {
      if (heroVideo) { heroVideo.innerHTML = ''; heroVideo.classList.remove('tp-hero__video--visible'); }
      if (heroImg)   heroImg.style.display = 'block';
      if (heroOverlay) heroOverlay.style.display = '';
    } else {
      if (heroImg)   heroImg.style.display = 'none';
      if (heroOverlay) heroOverlay.style.display = 'none';
      if (heroVideo) {
        var src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(item.vidId) +
                  '?autoplay=1&playsinline=1&rel=0&modestbranding=1';
        var iframe = document.createElement('iframe');
        iframe.src = src;
        iframe.allow = 'autoplay; encrypted-media';
        iframe.allowFullscreen = true;
        heroVideo.innerHTML = '';
        heroVideo.appendChild(iframe);
        heroVideo.classList.add('tp-hero__video--visible');
      }
    }
  }

  // ── YouTube embed ─────────────────────────────────────────────────────────
  function loadTravelVideo(youtubeId) {
    var section = document.getElementById('tpVideoSection');
    var wrap    = document.getElementById('tpVideoWrap');
    if (!section || !wrap || !youtubeId) return;
    section.style.display = 'block';
    var src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(youtubeId) +
              '?autoplay=1&playsinline=1&rel=0&modestbranding=1';
    var iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.allow = 'autoplay; encrypted-media';
    iframe.allowFullscreen = true;
    iframe.setAttribute('loading', 'lazy');
    wrap.appendChild(iframe);
  }

  // ── Wizard step management ────────────────────────────────────────────────
  function showStep(n) {
    for (var i = 1; i <= 4; i++) {
      var el = document.getElementById('tpStep' + i);
      if (el) el.classList.toggle('tp-wizard__step--active', i === n);
    }
  }

  function openWizard() {
    var w = document.getElementById('tpWizard');
    if (w) w.classList.add('tp-wizard--open');
    // Reset to step 1 defaults
    _type           = 'private';
    _travelers      = 2;
    _pickupLocation = '';
    _email          = '';
    setTravelersDisplay(2);
    // Reset pickup and email fields
    var pickupEl = document.getElementById('tpPickupInput');
    if (pickupEl) pickupEl.value = '';
    var emailEl = document.getElementById('tpCustEmail');
    if (emailEl) emailEl.value = '';
    // Mark private as selected
    document.querySelectorAll('[data-type]').forEach(function(b) {
      b.classList.toggle('tp-opt-btn--selected', b.getAttribute('data-type') === 'private');
    });
    showStep(1);
  }

  function closeWizard() {
    var w = document.getElementById('tpWizard');
    if (w) w.classList.remove('tp-wizard--open');
  }

  function setTravelersDisplay(n) {
    var el = document.getElementById('tpTravelersVal');
    if (el) el.textContent = n;
  }

  // ── Build and render the price quote ─────────────────────────────────────
  function renderQuote() {
    if (!window.DLCPricing || !_pkg) return;
    _quote = DLCPricing.calculateTravelQuote(_pkg, _type, _travelers);
    var rows = document.getElementById('tpQuoteRows');
    if (!rows) return;

    var html = '';
    if (_type === 'group' && _quote.pricePerPerson) {
      html += '<div class="tp-quote-row"><span>' + t('tpGroupType') + ' ×' + _travelers + '</span>' +
              '<span>$' + _quote.pricePerPerson + '/person</span></div>';
    }
    html += '<div class="tp-quote-row"><span>' + t('tpSubtotal') + '</span><span>$' + _quote.subtotal + '</span></div>';
    html += '<div class="tp-quote-row"><span>' + t('tpTaxes') + '</span><span>$' + _quote.taxes + '</span></div>';
    html += '<div class="tp-quote-row tp-quote-row--total"><span>' + t('tpTotal') + '</span><span>$' + _quote.total + '</span></div>';
    html += '<div class="tp-quote-row"><span>' + t('tpVehicle') + '</span><span>' + escapeHtml(_quote.vehicle) + '</span></div>';
    rows.innerHTML = html;
  }

  // ── Phase 8: Booking Validation Engine ───────────────────────────────────

  /**
   * Show or clear an inline error message in the wizard.
   * If msg is empty/null, the error element is hidden.
   */
  function showWizardError(msg) {
    var el = document.getElementById('tpWizardError');
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.style.display = 'block';
    } else {
      el.textContent = '';
      el.style.display = 'none';
    }
  }

  /**
   * Validate all booking inputs against package rules.
   * Returns { valid: true } or { valid: false, error: '<human-readable message>' }
   *
   * @param {object} pkg      Package record from Firestore/local fallback
   * @param {string} type     'private' | 'group'
   * @param {number} travelers
   * @param {string} date     'YYYY-MM-DD' or ''
   */
  function validateTravelBooking(pkg, type, travelers, date) {
    if (!pkg) return { valid: false, error: 'Package not found.' };
    if (pkg.active === false) return { valid: false, error: 'This package is currently unavailable.' };

    // Date required
    if (!date) return { valid: false, error: 'Please select a tour date.' };

    var rules = pkg.booking_rules || {};
    var minAdvance = rules.min_advance_days || 1;
    var maxAdvance = rules.max_advance_days || 90;

    var today = new Date();
    today.setHours(0, 0, 0, 0);
    // Parse date in local time to avoid UTC offset shifting the day
    var parts  = date.split('-');
    var selDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    var daysAhead = Math.round((selDate - today) / 86400000);

    if (daysAhead < minAdvance) {
      return { valid: false, error: 'Please book at least ' + minAdvance + ' day' + (minAdvance === 1 ? '' : 's') + ' in advance.' };
    }
    if (daysAhead > maxAdvance) {
      return { valid: false, error: 'Tours can be booked up to ' + maxAdvance + ' days ahead.' };
    }

    // Traveler count
    var pax = Math.max(1, parseInt(travelers) || 1);
    if (type === 'private') {
      var maxPrivate = rules.max_travelers_private || pkg.max_group || 12;
      if (pax > maxPrivate) {
        return { valid: false, error: 'Private tours support up to ' + maxPrivate + ' travelers. Call us for larger groups.' };
      }
    } else {
      var maxGroup = rules.max_travelers_group || pkg.max_group || 40;
      var minGroup = pkg.min_group || 1;
      if (pax < minGroup) {
        return { valid: false, error: 'Group bookings require at least ' + minGroup + ' travelers.' };
      }
      if (pax > maxGroup) {
        return { valid: false, error: 'Group tours support up to ' + maxGroup + ' travelers.' };
      }
    }

    return { valid: true };
  }

  /**
   * Check Firestore for booking conflicts on the same package + date.
   * Soft check only — returns info but does not hard-block.
   * @returns {Promise<{ conflict: boolean, reason: string }>}
   */
  function detectTravelBookingConflict(packageId, dateStr) {
    return _db.collection('travel_bookings')
      .where('packageId', '==', packageId)
      .where('date', '==', dateStr)
      .where('status', 'in', ['pending', 'confirmed'])
      .get()
      .then(function(snap) {
        if (snap.empty) return { conflict: false };
        var totalPax = 0;
        snap.forEach(function(doc) { totalPax += (doc.data().travelers || 1); });
        // Warn if total travelers on same date is getting high (>= 20)
        if (totalPax >= 20) {
          return { conflict: true, reason: 'This date is filling up — call us to confirm availability.' };
        }
        return { conflict: false, totalPax: totalPax };
      })
      .catch(function() {
        return { conflict: false }; // don't block on query failure
      });
  }

  // ── Submit booking to Firestore ───────────────────────────────────────────
  function submitTravelBooking() {
    var nameEl  = document.getElementById('tpCustName');
    var phoneEl = document.getElementById('tpCustPhone');
    var emailEl = document.getElementById('tpCustEmail');
    var name    = nameEl  ? nameEl.value.trim()  : '';
    var phone   = phoneEl ? phoneEl.value.trim() : '';
    _email      = emailEl ? emailEl.value.trim() : '';

    if (!name) { showWizardError('Please enter your name.'); return; }
    if (!phone) { showWizardError('Please enter a phone number.'); return; }

    // Run validation engine (Phase 8)
    var validation = validateTravelBooking(_pkg, _type, _travelers, _date);
    if (!validation.valid) { showWizardError(validation.error); return; }

    showWizardError(null); // clear any previous error

    var btn = document.getElementById('tpConfirmBtn');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }

    var bookingId = generateBookingId();

    // Check for soft conflict first, then save
    detectTravelBookingConflict(_pkg.id, _date).then(function(conflictResult) {
      if (conflictResult.conflict) {
        showWizardError(conflictResult.reason + ' Your booking is still being submitted.');
      }

      var bookingDoc = {
        bookingId:    bookingId,
        packageId:    _pkg.id,
        package_id:   _pkg.id,    // spec field name alias
        packageName:  _pkg.name,
        package_slug: _pkg.slug || _pkg.id,
        booking_mode: _type,
        type:         _type,
        travelers:    _travelers,
        traveler_count: _travelers,
        date:            _date || '',
        travel_date:     _date || '',
        pickup_location: _pickupLocation || '',
        customer: {
          name:  name,
          phone: phone,
          email: _email || '',
        },
        customer_name:  name,
        customer_phone: phone,
        customer_email: _email || '',
        vehicle:   _quote ? _quote.vehicle  : '',
        quote_breakdown: _quote ? {
          base:     _quote.breakdown ? _quote.breakdown.base    : _quote.subtotal,
          tier_key: _quote.breakdown ? (_quote.breakdown.tierKey || null) : null,
          subtotal: _quote.subtotal,
          taxes:    _quote.taxes,
          total:    _quote.total,
        } : {},
        total:     _quote ? _quote.total    : 0,
        subtotal:  _quote ? _quote.subtotal : 0,
        taxes:     _quote ? _quote.taxes    : 0,
        status:    'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
      };
      return _db.collection('travel_bookings').doc(bookingId).set(bookingDoc)
        .then(function() { return bookingDoc; });
    }).then(function(bookingDoc) {
      // Send confirmation email (customer) + owner notification
      if (window.DLCNotifications) {
        DLCNotifications.queueTravelConfirmation(bookingDoc, _lang);
      }
      var idEl = document.getElementById('tpSuccessId');
      if (idEl) idEl.textContent = 'Booking ID: ' + bookingId;
      showStep(4);
    }).catch(function(err) {
      console.error('[TravelBooking] submit error', err);
      showWizardError('Booking failed — please call (408) 916-3439');
      if (btn) { btn.disabled = false; btn.textContent = t('tpConfirm'); }
    });
  }

  // ── Public init ───────────────────────────────────────────────────────────
  function init(opts) {
    _db   = opts.db;
    _lang = opts.lang || 'en';

    applyI18n();

    // Read ?pkg= from URL
    var params = new URLSearchParams(window.location.search);
    var slug   = params.get('pkg');

    function loadLocalPkg(s) {
      return (window.DLC_TRAVEL_PACKAGES || []).find(function(p) {
        return p.slug === s || p.id === s;
      }) || null;
    }

    function boot(pkg) {
      if (pkg) {
        renderPackage(pkg);
        renderRelatedPackages(pkg.id);
      } else {
        var nameEl = document.getElementById('tpPkgName');
        if (nameEl) nameEl.textContent = 'Package not found';
      }
    }

    if (slug) {
      _db.collection('travel_packages').doc(slug).get()
        .then(function(doc) {
          boot(doc.exists ? doc.data() : loadLocalPkg(slug));
        })
        .catch(function() {
          boot(loadLocalPkg(slug));
        });
    } else {
      boot((window.DLC_TRAVEL_PACKAGES || [])[0] || null);
    }

    // Set date minimum to tomorrow
    var tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    var minDate = tomorrow.toISOString().split('T')[0];
    var dateInput = document.getElementById('tpDateInput');
    if (dateInput) dateInput.min = minDate;

    // ── Event listeners ───────────────────────────────────────────────────

    var openBtn = document.getElementById('tpOpenWizardBtn');
    if (openBtn) openBtn.addEventListener('click', openWizard);

    // Close wizard on backdrop click
    var wizard = document.getElementById('tpWizard');
    if (wizard) wizard.addEventListener('click', function(e) {
      if (e.target === wizard) closeWizard();
    });

    // Tour type buttons
    document.querySelectorAll('[data-type]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        _type = btn.getAttribute('data-type');
        document.querySelectorAll('[data-type]').forEach(function(b) {
          b.classList.toggle('tp-opt-btn--selected', b === btn);
        });
      });
    });

    var step1Next = document.getElementById('tpStep1Next');
    if (step1Next) step1Next.addEventListener('click', function() { showStep(2); });

    // Travelers counter
    var decBtn = document.getElementById('tpDecBtn');
    var incBtn = document.getElementById('tpIncBtn');
    if (decBtn) decBtn.addEventListener('click', function() {
      _travelers = Math.max(1, _travelers - 1);
      setTravelersDisplay(_travelers);
    });
    if (incBtn) incBtn.addEventListener('click', function() {
      var maxPax = (_pkg && _pkg.max_group) ? _pkg.max_group : 12;
      _travelers = Math.min(maxPax, _travelers + 1);
      setTravelersDisplay(_travelers);
    });

    // Date input
    if (dateInput) dateInput.addEventListener('change', function() { _date = this.value; });

    // Pickup location text field
    var pickupInput = document.getElementById('tpPickupInput');
    if (pickupInput) pickupInput.addEventListener('input', function() {
      _pickupLocation = this.value.trim();
    });

    // Email field (optional)
    var emailInput = document.getElementById('tpCustEmail');
    if (emailInput) emailInput.addEventListener('input', function() {
      _email = this.value.trim();
    });

    var step2Next = document.getElementById('tpStep2Next');
    if (step2Next) step2Next.addEventListener('click', function() {
      renderQuote();
      showStep(3);
    });

    // Confirm booking
    var confirmBtn = document.getElementById('tpConfirmBtn');
    if (confirmBtn) confirmBtn.addEventListener('click', submitTravelBooking);
  }

  return { init: init };

})();
