// travel-booking.js — Travel booking wizard module.  v1.0
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
      tpRegionLabel:    'Pickup region',
      tpBayArea:        'Bay Area (San Jose / SF)',
      tpSoCal:          'SoCal (LA / SD) +15%',
      tpQuoteLabel:     'Your quote',
      tpNameLabel:      'Your name',
      tpPhoneLabel:     'Phone number',
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
      tpRegionLabel:    'Điểm đón',
      tpBayArea:        'Bay Area (San Jose / SF)',
      tpSoCal:          'SoCal (LA / SD) +15%',
      tpQuoteLabel:     'Báo giá',
      tpNameLabel:      'Họ tên',
      tpPhoneLabel:     'Điện thoại',
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
      tpRegionLabel:    'Región de salida',
      tpBayArea:        'Bay Area (San Jose / SF)',
      tpSoCal:          'SoCal (LA / SD) +15%',
      tpQuoteLabel:     'Tu cotización',
      tpNameLabel:      'Tu nombre',
      tpPhoneLabel:     'Teléfono',
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
  var _db, _lang, _pkg, _type, _travelers, _date, _region, _quote;

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

    // Price bar
    var gpEl = document.getElementById('tpGroupPrice');
    var ppEl = document.getElementById('tpPrivatePrice');
    if (gpEl) gpEl.textContent = '$' + pkg.base_price_per_person_group;
    if (ppEl) ppEl.textContent = '$' + pkg.base_price_private;

    // Panel price
    var panelEl = document.getElementById('tpPanelPrice');
    if (panelEl) panelEl.textContent = '$' + pkg.base_price_per_person_group + '/person';

    // Wizard type buttons
    var tpp = document.getElementById('tpTypePrivatePrice');
    var tpg = document.getElementById('tpTypeGroupPrice');
    if (tpp) tpp.textContent = '$' + pkg.base_price_private;
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

    // YouTube embed (if youtubeId already stored on package)
    if (pkg.youtubeId) loadTravelVideo(pkg.youtubeId);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ── YouTube embed ─────────────────────────────────────────────────────────
  function loadTravelVideo(youtubeId) {
    var section = document.getElementById('tpVideoSection');
    var wrap    = document.getElementById('tpVideoWrap');
    if (!section || !wrap || !youtubeId) return;
    section.style.display = 'block';
    var src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(youtubeId) +
              '?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1';
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
    _type     = 'private';
    _travelers = 2;
    _region   = 'bayarea';
    setTravelersDisplay(2);
    // Mark private as selected
    document.querySelectorAll('[data-type]').forEach(function(b) {
      b.classList.toggle('tp-opt-btn--selected', b.getAttribute('data-type') === 'private');
    });
    document.querySelectorAll('[data-region]').forEach(function(b) {
      b.classList.toggle('tp-opt-btn--selected', b.getAttribute('data-region') === 'bayarea');
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
    _quote = DLCPricing.calculateTravelQuote(_pkg, _type, _travelers, _region);
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

  // ── Submit booking to Firestore ───────────────────────────────────────────
  function submitTravelBooking() {
    var nameEl  = document.getElementById('tpCustName');
    var phoneEl = document.getElementById('tpCustPhone');
    var name    = nameEl  ? nameEl.value.trim()  : '';
    var phone   = phoneEl ? phoneEl.value.trim() : '';

    if (!name || !phone) {
      alert(t('tpNameLabel') + ' & ' + t('tpPhoneLabel') + ' required');
      return;
    }

    var btn = document.getElementById('tpConfirmBtn');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }

    var bookingId = generateBookingId();

    _db.collection('travel_bookings').doc(bookingId).set({
      bookingId:   bookingId,
      packageId:   _pkg.id,
      packageName: _pkg.name,
      type:        _type,
      travelers:   _travelers,
      date:        _date || '',
      region:      _region,
      customer: {
        name:  name,
        phone: phone,
      },
      vehicle:   _quote ? _quote.vehicle  : '',
      total:     _quote ? _quote.total    : 0,
      subtotal:  _quote ? _quote.subtotal : 0,
      taxes:     _quote ? _quote.taxes    : 0,
      status:    'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    }).then(function() {
      var idEl = document.getElementById('tpSuccessId');
      if (idEl) idEl.textContent = 'Booking ID: ' + bookingId;
      showStep(4);
    }).catch(function(err) {
      console.error('[TravelBooking] submit error', err);
      alert('Booking failed — please call (408) 916-3439');
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
      if (pkg) { renderPackage(pkg); }
      else {
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

    // Region buttons
    document.querySelectorAll('[data-region]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        _region = btn.getAttribute('data-region');
        document.querySelectorAll('[data-region]').forEach(function(b) {
          b.classList.toggle('tp-opt-btn--selected', b === btn);
        });
      });
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
