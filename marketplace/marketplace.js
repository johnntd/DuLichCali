// Du Lịch Cali — Marketplace JS
// SPA router + renderer for business directory and detail pages
// Exposed globally as window.Marketplace

(function () {
  'use strict';

  // ── SVG Icons ──────────────────────────────────────────────────────────────────

  var phoneIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 012 .18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.72 6.72l1.79-1.35a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7a2 2 0 011.72 2.09z"/></svg>';
  var arrowLeftIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>';
  var arrowRightIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>';
  var mapPinIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  var clockIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
  var calendarIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
  var sendIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
  var micIcon  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0014 0"/><line x1="12" y1="21" x2="12" y2="17"/><line x1="8" y1="21" x2="16" y2="21"/></svg>';
  var checkIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>';
  var starIcon = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';

  // ── State ──────────────────────────────────────────────────────────────────────

  var _categoryId = null;
  var _container = null;

  // ── Capacity Engine ────────────────────────────────────────────────────────────
  // Queries Firestore to determine how many slots remain on a given date.

  var CapacityEngine = {

    // Returns Promise<number> — total booked (non-cancelled) qty for a vendor+date
    getBookedQty: function (vendorId, dateStr) {
      if (!window.dlcDb || !dateStr) return Promise.resolve(0);
      return window.dlcDb
        .collection('vendors').doc(vendorId)
        .collection('bookings')
        .where('requestedDate', '==', dateStr)
        .get()
        .then(function (snap) {
          var total = 0;
          snap.forEach(function (d) {
            var o = d.data();
            if (o.status !== 'cancelled') total += Number(o.quantity) || 0;
          });
          return total;
        })
        .catch(function () { return 0; });
    },

    // Returns Promise<{date, max, booked, remaining}>
    getCapacityInfo: function (biz, dateStr) {
      var maxCap = Number(biz.defaultDailyCapacity) || 300;
      return CapacityEngine.getBookedQty(biz.id, dateStr).then(function (booked) {
        return {
          date:      dateStr,
          max:       maxCap,
          booked:    booked,
          remaining: Math.max(0, maxCap - booked)
        };
      });
    }
  };

  // ── Date helpers ───────────────────────────────────────────────────────────────

  function _parseDateFromText(text) {
    var t = (text || '').toLowerCase();
    var today = new Date();
    var dow = today.getDay();

    // dayNames[i] = keywords that map to weekday index i (0=Sun … 6=Sat)
    var dayNames = [
      ['sunday', 'chủ nhật', 'chu nhat'],
      ['monday', 'thứ hai', 'thu hai'],
      ['tuesday', 'thứ ba', 'thu ba'],
      ['wednesday', 'thứ tư', 'thu tu', 'thu 4'],
      ['thursday', 'thứ năm', 'thu nam', 'thu 5'],
      ['friday', 'thứ sáu', 'thu sau', 'thu 6'],
      ['saturday', 'thứ bảy', 'thu bay', 'thu 7']
    ];

    for (var i = 0; i < dayNames.length; i++) {
      for (var j = 0; j < dayNames[i].length; j++) {
        if (t.indexOf(dayNames[i][j]) !== -1) {
          var diff = i - dow;
          if (diff <= 0) diff += 7; // always look forward to the next occurrence
          var d = new Date(today);
          d.setDate(today.getDate() + diff);
          return _fmtDate(d);
        }
      }
    }

    if (/tomorrow|ng[àa]y mai/.test(t)) {
      var d2 = new Date(today);
      d2.setDate(today.getDate() + 1);
      return _fmtDate(d2);
    }
    if (/\btoday\b|h[ôo]m nay/.test(t)) return _fmtDate(today);
    return null;
  }

  function _fmtDate(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function _dayLabel(dateStr) {
    var d = new Date(dateStr + 'T12:00:00');
    var days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return days[d.getDay()] + ' (' + months[d.getMonth()] + ' ' + d.getDate() + ')';
  }

  // ── Init ───────────────────────────────────────────────────────────────────────

  function init(categoryId) {
    _categoryId = categoryId;
    _container = document.getElementById('mpApp');

    if (!_container) {
      console.error('Marketplace: #mpApp container not found');
      return;
    }

    var params = new URLSearchParams(window.location.search);
    var id = params.get('id');

    if (id) {
      renderDetail(id);
    } else {
      renderDirectory(categoryId);
    }
  }

  // ── Navigation Helpers ─────────────────────────────────────────────────────────

  function renderAppBar(backUrl, backLabel, title, phone) {
    var callBtn = phone
      ? '<a href="tel:' + phone + '" class="mp-bar__call">' + phoneIcon + 'Gọi ngay</a>'
      : '';

    return '<div class="mp-bar">' +
      '<a href="' + backUrl + '" class="mp-bar__back">' + arrowLeftIcon + backLabel + '</a>' +
      '<span class="mp-bar__title">' + escHtml(title) + '</span>' +
      callBtn +
      '</div>';
  }

  // Clean vendor-owned top bar for salon pages — only vendor name, no global contact
  function renderSalonBar(biz) {
    return '<div class="mp-bar mp-bar--vendor">' +
      '<button type="button" class="mp-bar__back mp-bar__back--icon" onclick="history.back()" aria-label="Back">' + arrowLeftIcon + '</button>' +
      '<span class="mp-bar__title">' + escHtml(biz.name) + '</span>' +
      '<div class="mp-bar__spacer"></div>' +
    '</div>';
  }

  function renderFooter() {
    return '<footer class="mp-footer">' +
      '<button class="mp-footer__back-btn" onclick="history.back()" aria-label="Quay lại trang trước">' +
        arrowLeftIcon + 'Quay lại' +
      '</button>' +
      '<div class="mp-footer__brand">Du Lịch Cali Services</div>' +
      '<div class="mp-footer__sub">\xa9 ' + new Date().getFullYear() + ' JDNETWORKS AI SERVICES LLC. All rights reserved.</div>' +
      '<div class="mp-footer__sub">DulichCali21 is operated by JDNETWORKS AI SERVICES LLC \xb7 dulichcali21.com \xb7 (714) 227-6007</div>' +
      '</footer>';
  }

  // Mobile-only persistent bottom utility nav for standalone submenu pages.
  // Provides Back, Home, and Marketplace shortcuts — hidden at 768px+ via CSS.
  function renderBottomNav(backHref) {
    var homeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><polyline points="9 21 9 12 15 12 15 21"/></svg>';
    var gridIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';
    // Back uses browser history so the correct previous page is always restored,
    // regardless of whether the user arrived from homepage, marketplace hub, or elsewhere.
    return '<nav class="mp-bottom-nav" aria-label="Điều hướng trang">' +
      '<button type="button" class="mp-bottom-nav__tab" onclick="history.back()" aria-label="Quay lại trang trước">' +
        arrowLeftIcon + '<span>Quay lại</span>' +
      '</button>' +
      '<a href="/" class="mp-bottom-nav__tab">' +
        homeIcon + '<span>Trang chủ</span>' +
      '</a>' +
      '<a href="/marketplace/" class="mp-bottom-nav__tab">' +
        gridIcon + '<span>Dịch vụ</span>' +
      '</a>' +
    '</nav>';
  }

  // ── Vendor Bottom Nav (Salon pages) ───────────────────────────────────────────
  // 5-button persistent nav: Home · Book · AI (center) · Interpreter · Call
  // Only used for nails/hair vendor detail pages. No links to main site.

  function renderVendorBottomNav(biz) {
    var homeIco = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><polyline points="9 21 9 12 15 12 15 21"/></svg>';
    var sparkIco = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2z"/></svg>';
    var globeIco = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>';

    return '<nav class="mp-vnav" aria-label="Quick actions">' +
      '<button type="button" class="mp-vnav__tab" onclick="window._vnav.scrollTop()" aria-label="Scroll to top">' +
        homeIco + '<span>Home</span>' +
      '</button>' +
      '<button type="button" class="mp-vnav__tab" onclick="window._vnav.scrollBook()" aria-label="Book appointment">' +
        calendarIcon + '<span>Book</span>' +
      '</button>' +
      '<button type="button" class="mp-vnav__tab mp-vnav__tab--ai" onclick="window._vnav.focusAi()" aria-label="Chat with AI receptionist">' +
        '<div class="mp-vnav__ai-ring">' + sparkIco + '</div>' +
        '<span>AI</span>' +
      '</button>' +
      '<button type="button" class="mp-vnav__tab" onclick="window._vnav.toggleInterp()" aria-label="Live interpreter">' +
        globeIco + '<span>Interpret</span>' +
      '</button>' +
      '<a href="tel:' + (biz.phone || '') + '" class="mp-vnav__tab mp-vnav__tab--call" aria-label="Call shop">' +
        phoneIcon + '<span>Call</span>' +
      '</a>' +
    '</nav>';
  }

  function renderInterpPanel(biz) {
    return '<div id="interpBackdrop_' + biz.id + '" class="mp-interp__backdrop" onclick="window._interp.close()"></div>' +
      '<div id="interpPanel_' + biz.id + '" class="mp-interp" role="dialog" aria-label="Live Interpreter">' +
        '<div class="mp-interp__handle"></div>' +
        '<div class="mp-interp__header">' +
          '<span class="mp-interp__title">Live Interpreter</span>' +
          '<button type="button" class="mp-interp__close" onclick="window._interp.close()" aria-label="Close">&#10005;</button>' +
        '</div>' +
        '<div class="mp-interp__langs">' +
          '<select id="interpFrom_' + biz.id + '" class="mp-interp__select" onchange="window._interp.syncLangs()">' +
            '<option value="en">English</option>' +
            '<option value="vi">Ti&#7871;ng Vi&#7879;t</option>' +
            '<option value="es">Espa&#241;ol</option>' +
          '</select>' +
          '<span class="mp-interp__arrow">&#8594;</span>' +
          '<select id="interpTo_' + biz.id + '" class="mp-interp__select">' +
            '<option value="vi">Ti&#7871;ng Vi&#7879;t</option>' +
            '<option value="en">English</option>' +
            '<option value="es">Espa&#241;ol</option>' +
          '</select>' +
        '</div>' +
        '<textarea id="interpInput_' + biz.id + '" class="mp-interp__input" placeholder="Type message to translate..." rows="3"></textarea>' +
        '<button type="button" class="mp-interp__btn" onclick="window._interp.translate()">Translate</button>' +
        '<div id="interpOutput_' + biz.id + '" class="mp-interp__output"></div>' +
      '</div>';
  }

  function _interpFallback(fromLang, toLang, text, output) {
    var url = 'https://translate.google.com/?sl=' + fromLang + '&tl=' + toLang +
      '&text=' + encodeURIComponent(text) + '&op=translate';
    output.innerHTML = '<a href="' + url + '" target="_blank" rel="noopener" style="color:var(--gold)">Open in Google Translate &#8599;</a>';
  }

  function _initVendorNav(biz) {
    window._vnav = {
      scrollTop: function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      scrollBook: function () {
        var el = document.getElementById('bookingSection_' + biz.id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      focusAi: function () {
        var el = document.getElementById('aiWidget_' + biz.id);
        if (!el) return;
        if (window.innerWidth < 768 && el._fsOpen) {
          el._fsOpen();
        } else {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setTimeout(function () {
            var inp = el.querySelector('input[type="text"],textarea,.mp-ai__input');
            if (inp) inp.focus();
          }, 420);
        }
      },
      toggleInterp: function () {
        window._interp.toggle();
      }
    };

    window._interp = (function () {
      var panel    = document.getElementById('interpPanel_'    + biz.id);
      var backdrop = document.getElementById('interpBackdrop_' + biz.id);
      var fromSel  = document.getElementById('interpFrom_'     + biz.id);
      var toSel    = document.getElementById('interpTo_'       + biz.id);
      var inputEl  = document.getElementById('interpInput_'    + biz.id);
      var outputEl = document.getElementById('interpOutput_'   + biz.id);

      return {
        open: function () {
          panel.classList.add('is-open');
          backdrop.classList.add('is-open');
        },
        close: function () {
          panel.classList.remove('is-open');
          backdrop.classList.remove('is-open');
        },
        toggle: function () {
          if (panel.classList.contains('is-open')) this.close(); else this.open();
        },
        // Prevent From == To by swapping To when From changes
        syncLangs: function () {
          var from = fromSel.value;
          var to   = toSel.value;
          if (from === to) {
            var opts = ['en', 'vi', 'es'];
            toSel.value = opts.find(function (o) { return o !== from; }) || 'en';
          }
        },
        translate: function () {
          var from = fromSel.value;
          var to   = toSel.value;
          var text = (inputEl.value || '').trim();
          if (!text) return;
          if (from === to) { outputEl.textContent = text; return; }

          outputEl.textContent = '...';

          var apiKey = localStorage.getItem('dlc_claude_key');
          if (!apiKey) { _interpFallback(from, to, text, outputEl); return; }

          var labels = { en: 'English', vi: 'Vietnamese', es: 'Spanish' };
          // ── via unified dispatcher (model + retry from AIEngine.SERVICE_CONFIG.translation) ──
          AIEngine.call('translation', apiKey, null, [{
            role: 'user',
            content: 'Translate from ' + labels[from] + ' to ' + labels[to] +
              '. Return only the translated text, no explanation:\n\n' + text
          }])
          .then(function (d) {
            outputEl.textContent =
              (d.content && d.content[0] && d.content[0].text) || 'Translation error.';
          })
          .catch(function () { _interpFallback(from, to, text, outputEl); });
        }
      };
    }());
  }

  // ── Directory ──────────────────────────────────────────────────────────────────

  function renderDirectory(categoryId) {
    var category = MARKETPLACE.getCategoryMeta(categoryId);
    if (!category) {
      _container.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--muted)">Không tìm thấy danh mục.</div>';
      return;
    }

    var bizList = MARKETPLACE.getBusinesses(categoryId);

    var cardsHtml = bizList.map(function (biz) {
      return renderBizCard(biz);
    }).join('');

    var _catHeroImages = {
      nails: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=1400&auto=format&fit=crop&q=80',
      hair:  'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1400&auto=format&fit=crop&q=80',
      food:  '/nha-bep-emily-eggroll.jpg'
    };

    var html =
      renderAppBar('/', 'Trang chủ', category.nameVi, null) +
      '<main class="mp-main">' +
        renderHero(
          'Du Lịch Cali · Services',
          category.nameVi,
          category.tagline,
          category.heroGradient,
          [],
          _catHeroImages[categoryId] || null
        ) +
        '<div class="mp-section">' +
          '<div class="mp-section-hdr">' +
            '<h2 class="mp-section-title">Danh sách dịch vụ</h2>' +
          '</div>' +
        '</div>' +
        '<div class="mp-grid">' + cardsHtml + '</div>' +
        '<div class="mp-spacer"></div>' +
      '</main>' +
      renderFooter() +
      renderBottomNav('/');

    _container.innerHTML = html;

    // Attach card click handlers
    var cards = _container.querySelectorAll('.mp-biz-card');
    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        var bizId = card.getAttribute('data-id');
        window.location.href = '?id=' + bizId;
      });
    });
  }

  function renderHero(eyebrow, title, sub, gradient, ctas, bgImage) {
    var heroBgStyle = bgImage
      ? 'background-image:url(' + escAttr(bgImage) + ');background-size:cover;background-position:center;'
      : 'background:' + gradient + ';';
    var ctasHtml = ctas.map(function (c) {
      return '<a href="' + c.href + '" class="mp-btn ' + c.cls + '">' +
        (c.icon || '') + escHtml(c.label) +
        '</a>';
    }).join('');

    return '<div class="mp-hero">' +
      '<div class="mp-hero__bg" style="' + heroBgStyle + '"></div>' +
      '<div class="mp-hero__overlay"></div>' +
      '<div class="mp-hero__content">' +
        '<div class="mp-hero__eyebrow">' + escHtml(eyebrow) + '</div>' +
        '<h1 class="mp-hero__title">' + escHtml(title) + '</h1>' +
        '<p class="mp-hero__sub">' + escHtml(sub) + '</p>' +
        (ctasHtml ? '<div class="mp-hero__ctas">' + ctasHtml + '</div>' : '') +
      '</div>' +
    '</div>';
  }

  function renderBizCard(biz) {
    var heroBgStyle = biz.heroImage
      ? 'background-image:url(' + escAttr(biz.heroImage) + ');background-size:cover;background-position:center;'
      : 'background:' + biz.heroGradient + ';';

    return '<div class="mp-biz-card" data-id="' + escHtml(biz.id) + '">' +
      '<div class="mp-biz-card__hero">' +
        '<div class="mp-biz-card__hero-bg" style="' + heroBgStyle + '"></div>' +
        '<div class="mp-biz-card__hero-overlay"></div>' +
        '<div class="mp-biz-card__badge">' + escHtml(biz.region) + '</div>' +
      '</div>' +
      '<div class="mp-biz-card__body">' +
        '<div class="mp-biz-card__name">' + escHtml(biz.name) + '</div>' +
        '<div class="mp-biz-card__tagline">' + escHtml(biz.tagline) + '</div>' +
        '<div class="mp-biz-card__footer">' +
          '<span class="mp-biz-card__city">' + mapPinIcon + escHtml(biz.city) + '</span>' +
          '<span class="mp-biz-card__cta">Xem Chi Tiết ' + arrowRightIcon + '</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ── Detail Page ────────────────────────────────────────────────────────────────

  function renderDetail(businessId) {
    var biz = MARKETPLACE.getBusiness(businessId);

    if (!biz) {
      _container.innerHTML =
        renderAppBar(window.location.pathname, 'Quay lại', 'Không tìm thấy', null) +
        '<div style="padding:3rem 1rem;text-align:center;color:var(--muted)">' +
          '<div style="font-size:3rem;margin-bottom:1rem">🔍</div>' +
          '<p>Không tìm thấy thông tin doanh nghiệp này.</p>' +
          '<a href="' + window.location.pathname + '" style="color:var(--sky-lt);margin-top:1rem;display:inline-block">← Quay lại danh sách</a>' +
        '</div>';
      return;
    }

    var backUrl = window.location.pathname;

    // Route food vendors to their own renderer
    if (biz.vendorType === 'foodvendor') {
      renderFoodVendorDetail(biz);
      return;
    }

    // Route salon vendors through async Firestore loader
    if (biz.category === 'nails' || biz.category === 'hair') {
      renderSalonVendorDetail(biz);
      return;
    }

    var html =
      renderAppBar(backUrl, 'Danh sách', biz.name, biz.phone) +
      '<main class="mp-main">' +
        renderDetailHero(biz) +
        renderInfoStrip(biz) +
        '<div class="mp-detail-body">' +
          '<div class="mp-detail-col mp-detail-col--left">' +
            renderServicesSection(biz) +
            renderHoursSection(biz) +
          '</div>' +
          '<div class="mp-detail-col mp-detail-col--right">' +
            (biz.bookingEnabled ? renderBookingSection(biz) : '') +
            renderAiSection(biz) +
            renderContactSection(biz) +
          '</div>' +
        '</div>' +
        '<div class="mp-spacer"></div>' +
      '</main>' +
      renderFooter() +
      renderBottomNav(backUrl);

    _container.innerHTML = html;

    // Init booking form
    if (biz.bookingEnabled) {
      initBookingForm(biz);
    }

    // Init AI receptionist
    if (biz.aiReceptionist && biz.aiReceptionist.enabled) {
      Receptionist.init(biz, 'aiWidget_' + biz.id);
    }
  }

  function renderDetailHero(biz) {
    var heroBgStyle = biz.heroImage
      ? 'background-image:url(' + escAttr(biz.heroImage) + ');background-size:cover;background-position:center;'
      : 'background:' + biz.heroGradient + ';';
    return '<div class="mp-detail-hero">' +
      '<div class="mp-detail-hero__bg" style="' + heroBgStyle + '"></div>' +
      '<div class="mp-detail-hero__overlay"></div>' +
      '<div class="mp-detail-hero__content">' +
        '<div class="mp-detail-hero__region">' + escHtml(biz.region) + ' · ' + escHtml(biz.city) + '</div>' +
        '<h1 class="mp-detail-hero__name">' + escHtml(biz.name) + '</h1>' +
        '<p class="mp-detail-hero__tagline">' + escHtml(biz.tagline) + '</p>' +
        '<div style="display:flex;gap:.5rem;margin-top:1.1rem;flex-wrap:wrap;">' +
          '<button class="mp-btn mp-btn--primary" onclick="document.getElementById(\'bookingSection_' + biz.id + '\').scrollIntoView({behavior:\'smooth\'})">' +
            calendarIcon + (biz.bookingType === 'reservation' ? 'Đặt Bàn' : 'Đặt Lịch') +
          '</button>' +
          '<a href="tel:' + biz.phone + '" class="mp-btn mp-btn--ghost">' +
            phoneIcon + 'Gọi ngay' +
          '</a>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ── Nail Salon Premium Rendering ──────────────────────────────────────────────
  // These functions render the premium redesign for .mp-main--nails pages.
  // They do NOT affect hair or food vendor pages.

  // Category tab toggle — exposed globally for inline onclick handlers
  function nsShowCat(btn, cat, bizId) {
    var tabs = btn.closest ? btn.closest('.ns-tabs') : null;
    if (tabs) {
      var allTabs = tabs.querySelectorAll('.ns-tab');
      for (var i = 0; i < allTabs.length; i++) { allTabs[i].classList.remove('active'); }
    }
    btn.classList.add('active');
    var container = document.getElementById('nbServices_' + bizId);
    if (!container) return;
    var catDivs = container.querySelectorAll('.nb-cat[data-cat]');
    for (var j = 0; j < catDivs.length; j++) {
      catDivs[j].style.display = (cat === 'all' || catDivs[j].getAttribute('data-cat') === cat) ? '' : 'none';
    }
  }
  window.nsShowCat = nsShowCat;

  // Scroll to booking section then open the service list for that category (step 2)
  function nsScrollToBooking(bizId, cat) {
    var el = document.getElementById('nailBookSection_' + bizId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (cat) {
      setTimeout(function () {
        if (window.nsShowServiceList) window.nsShowServiceList(bizId, cat);
      }, 400);
    }
  }
  window.nsScrollToBooking = nsScrollToBooking;

  // ── 3-step booking navigation ─────────────────────────────────────────────────
  // Step 1: category grid + featured carousel  (id: nbCatView_X)
  // Step 2: service list for selected category (id: nbSvcView_X)
  // Step 3: booking form with pre-selected service (id: nbFormView_X)

  // Step 1 → Step 2: show service list for a category
  function nsShowServiceList(bizId, catKey) {
    var catView  = document.getElementById('nbCatView_'      + bizId);
    var svcView  = document.getElementById('nbSvcView_'      + bizId);
    var formView = document.getElementById('nbFormView_'     + bizId);
    var titleEl  = document.getElementById('nbSvcViewTitle_' + bizId);
    var listsEl  = document.getElementById('nbSvcLists_'     + bizId);
    if (!svcView || !listsEl) return;

    // Show the matching service-list group, hide all others
    var groups = listsEl.querySelectorAll('.ns-svc-list-group');
    var activeGroup = null;
    for (var i = 0; i < groups.length; i++) {
      var match = groups[i].getAttribute('data-cat') === catKey;
      groups[i].style.display = match ? '' : 'none';
      if (match) activeGroup = groups[i];
    }
    if (titleEl) {
      titleEl.textContent = activeGroup ? (activeGroup.getAttribute('data-label') || catKey) : catKey;
    }

    // Remember current category so back-from-form works correctly
    window._nbState = window._nbState || {};
    if (!window._nbState[bizId]) window._nbState[bizId] = {};
    window._nbState[bizId].cat = catKey;

    if (catView)  catView.style.display  = 'none';
    if (formView) formView.style.display = 'none';
    svcView.style.display = '';

    _nsUpdateSelectionUI(bizId);

    var section = document.getElementById('nailBookSection_' + bizId);
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  window.nsShowServiceList = nsShowServiceList;

  // Step 2 → toggle selection: tap adds/removes service, sticky bar lets user confirm
  function nsSelectService(bizId, serviceName, durationMins, catKey) {
    window._nbSelections = window._nbSelections || {};
    if (!window._nbSelections[bizId]) window._nbSelections[bizId] = [];

    window._nbState = window._nbState || {};
    if (!window._nbState[bizId]) window._nbState[bizId] = {};
    window._nbState[bizId].cat = catKey || (window._nbState[bizId] && window._nbState[bizId].cat);

    // Toggle: remove if already selected, add if not
    var sels = window._nbSelections[bizId];
    var idx = -1;
    for (var i = 0; i < sels.length; i++) {
      if (sels[i].name === serviceName) { idx = i; break; }
    }
    if (idx >= 0) {
      sels.splice(idx, 1);
    } else {
      sels.push({ name: serviceName, durationMins: durationMins || 60, catKey: catKey });
    }

    _nsUpdateSelectionUI(bizId);
  }
  window.nsSelectService = nsSelectService;

  // Update item highlights + sticky confirm bar based on current selections
  function _nsUpdateSelectionUI(bizId) {
    var sels = (window._nbSelections && window._nbSelections[bizId]) || [];
    var svcLists = document.getElementById('nbSvcLists_' + bizId);
    if (svcLists) {
      var items = svcLists.querySelectorAll('.ns-book-svc-item');
      for (var i = 0; i < items.length; i++) {
        var svcName = items[i].getAttribute('data-svc-name');
        var isSelected = false;
        for (var j = 0; j < sels.length; j++) {
          if (sels[j].name === svcName) { isSelected = true; break; }
        }
        items[i].classList.toggle('ns-book-svc-item--selected', isSelected);
      }
    }
    var bar = document.getElementById('nbSelectBar_' + bizId);
    if (bar) {
      if (sels.length > 0) {
        var totalMins = 0;
        for (var m = 0; m < sels.length; m++) { totalMins += (sels[m].durationMins || 0); }
        var countEl = document.getElementById('nbSelectCount_' + bizId);
        var durEl   = document.getElementById('nbSelectDur_'   + bizId);
        if (countEl) countEl.textContent = sels.length + ' d\u1ecbch v\u1ee5';
        if (durEl)   durEl.textContent   = totalMins + ' ph\xfat';
        bar.style.display = 'flex';
      } else {
        bar.style.display = 'none';
      }
    }
  }

  // Confirm selection: sync checkboxes, build badge, show booking form
  function nsConfirmSelection(bizId) {
    var sels = (window._nbSelections && window._nbSelections[bizId]) || [];
    if (!sels.length) return;

    var svcDiv  = document.getElementById('nbServices_'    + bizId);
    var badgeEl = document.getElementById('nbSelectedSvc_' + bizId);
    var catView  = document.getElementById('nbCatView_'    + bizId);
    var svcView  = document.getElementById('nbSvcView_'    + bizId);
    var formView = document.getElementById('nbFormView_'   + bizId);

    // Sync hidden checkboxes to selection state
    if (svcDiv) {
      var allChks = svcDiv.querySelectorAll('.nb-svc-chk');
      for (var i = 0; i < allChks.length; i++) { allChks[i].checked = false; }
      for (var i = 0; i < allChks.length; i++) {
        for (var j = 0; j < sels.length; j++) {
          if (allChks[i].value === sels[j].name) {
            allChks[i].checked = true;
            var evt = document.createEvent('Event');
            evt.initEvent('change', true, true);
            allChks[i].dispatchEvent(evt);
            break;
          }
        }
      }
    }

    // Build badge showing all selected services + change button
    if (badgeEl) {
      badgeEl.innerHTML = sels.map(function (sel) {
        return '<div class="ns-svc-badge">' +
          '<span class="ns-svc-badge__name">' + escHtml(sel.name) + '</span>' +
          (sel.durationMins ? '<span class="ns-svc-badge__meta">' + sel.durationMins + ' min</span>' : '') +
        '</div>';
      }).join('') +
      '<button type="button" class="ns-svc-badge__change" ' +
        'onclick="window.nsBackToSvcList(\'' + escAttr(bizId) + '\')">' +
        '\u0110\u1ed5i d\u1ecbch v\u1ee5' +
      '</button>';
      badgeEl.style.display = '';
    }

    if (catView)  catView.style.display  = 'none';
    if (svcView)  svcView.style.display  = 'none';
    if (formView) formView.style.display = '';

    var section = document.getElementById('nailBookSection_' + bizId);
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  window.nsConfirmSelection = nsConfirmSelection;

  // Any view → Step 1: back to category grid — clears selections
  function nsBackToCats(bizId) {
    if (window._nbSelections) window._nbSelections[bizId] = [];
    var catView  = document.getElementById('nbCatView_'  + bizId);
    var svcView  = document.getElementById('nbSvcView_'  + bizId);
    var formView = document.getElementById('nbFormView_' + bizId);
    if (svcView)  svcView.style.display  = 'none';
    if (formView) formView.style.display = 'none';
    if (catView)  catView.style.display  = '';
    var section = document.getElementById('nailBookSection_' + bizId);
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  window.nsBackToCats = nsBackToCats;

  // Step 3 → Step 2: back to service list for current category
  function nsBackToSvcList(bizId) {
    var state = (window._nbState && window._nbState[bizId]) || {};
    nsShowServiceList(bizId, state.cat || 'manicure');
  }
  window.nsBackToSvcList = nsBackToSvcList;

  // ── Category hero carousel: slide navigation ──────────────────────────────
  // _nsCatHcGoto — activate slide idx, sync dot indicators.
  // Called by dot buttons (onclick) and touch-swipe handler.
  function _nsCatHcGoto(bizId, idx) {
    var hcEl = document.getElementById('nsCatHc_' + bizId);
    if (!hcEl) return;
    var slides = hcEl.querySelectorAll('.ns-cat-hc__slide');
    var dots   = hcEl.querySelectorAll('.ns-cat-hc__dot');
    slides.forEach(function (s, i) { s.classList.toggle('ns-cat-hc__slide--active', i === idx); });
    dots.forEach(function   (d, i) { d.classList.toggle('ns-cat-hc__dot--active',   i === idx); });
  }
  window._nsCatHcGoto = _nsCatHcGoto;

  // _initNsCatHc — attach touch-swipe event listeners after DOM insertion.
  // Called from the renderSalonVendorDetail post-render block.
  function _initNsCatHc(bizId) {
    var hcEl = document.getElementById('nsCatHc_' + bizId);
    if (!hcEl) return;
    var slides  = hcEl.querySelectorAll('.ns-cat-hc__slide');
    var n       = slides.length;
    if (n < 2) return;
    var current = 0, startX = 0;
    hcEl.addEventListener('touchstart', function (e) {
      startX = e.changedTouches[0].clientX;
    }, { passive: true });
    hcEl.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) < 44) return;
      current = dx < 0
        ? Math.min(current + 1, n - 1)
        : Math.max(current - 1, 0);
      _nsCatHcGoto(bizId, current);
    }, { passive: true });
  }

  // ── Featured hero carousel: slide navigation + touch-swipe + auto-advance ──
  function _nsFeatHcGoto(bizId, idx) {
    var hcEl = document.getElementById('nsFeatHc_' + bizId);
    if (!hcEl) return;
    var slides = hcEl.querySelectorAll('.ns-feat-hc__slide');
    var dots   = hcEl.querySelectorAll('.ns-feat-hc__dot');
    slides.forEach(function (s, i) { s.classList.toggle('ns-feat-hc__slide--active', i === idx); });
    dots.forEach(function   (d, i) { d.classList.toggle('ns-feat-hc__dot--active',   i === idx); });
  }
  window._nsFeatHcGoto = _nsFeatHcGoto;

  function _initNsFeatHc(bizId) {
    var hcEl = document.getElementById('nsFeatHc_' + bizId);
    if (!hcEl) return;
    var slides  = hcEl.querySelectorAll('.ns-feat-hc__slide');
    var n       = slides.length;
    if (n < 2) return;
    var current = 0, startX = 0;
    hcEl.addEventListener('touchstart', function (e) {
      startX = e.changedTouches[0].clientX;
    }, { passive: true });
    hcEl.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) < 44) return;
      current = dx < 0 ? Math.min(current + 1, n - 1) : Math.max(current - 1, 0);
      _nsFeatHcGoto(bizId, current);
    }, { passive: true });
    // Auto-advance every 5 seconds
    setInterval(function () {
      current = (current + 1) % n;
      _nsFeatHcGoto(bizId, current);
    }, 5000);
  }
  window._initNsFeatHc = _initNsFeatHc;

  function renderNailsHero(biz) {
    // Use local owned asset for hero; multi-layer bg so gradient shows if image fails
    var HERO_IMG = '/images/nails-1.jpg';
    var heroBg = 'background-image:url(' + HERO_IMG + '),' +
      (biz.heroGradient || 'linear-gradient(135deg,#831843,#4c1d95)') + ';' +
      'background-size:cover;background-position:center 25%;';
    var hasAddr = !!(biz.address || biz.phone);
    var addrHtml = hasAddr
      ? '<div class="ns-hero__address">' +
          (biz.address ? '<span class="ns-hero__address-item">' + mapPinIcon + escHtml(biz.address) + '</span>' : '') +
          (biz.phone ? '<span class="ns-hero__address-item">' + phoneIcon + '<a href="tel:' + biz.phone + '">' + escHtml(biz.phoneDisplay || biz.phone) + '</a></span>' : '') +
        '</div>'
      : '';

    var chipsHtml = '<div class="ns-hero__chips">' +
      '<span class="ns-hero__chip">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M12 2l2.09 6.26L20 9.27l-4.91 4.79 1.18 6.88L12 17.77l-6.27 3.17 1.18-6.88L2 9.27l5.91-1.01z"/></svg>' +
        ' 10+ N\u0103m Kinh Nghi\u1ec7m' +
      '</span>' +
      '<span class="ns-hero__chip">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' +
        ' S\u1ea3n Ph\u1ea9m An To\xe0n' +
      '</span>' +
      '<span class="ns-hero__chip">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
        ' Walk-in Welcome' +
      '</span>' +
    '</div>';

    var arrowRightIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';

    return '<div class="ns-hero' + (hasAddr ? ' ns-hero--has-address' : '') + '">' +
      '<div class="ns-hero__bg" style="' + heroBg + '"></div>' +
      '<div class="ns-hero__overlay"></div>' +
      '<div class="ns-hero__content">' +
        '<div class="ns-hero__region">' + escHtml(biz.region || 'Bay Area') + ' \xb7 ' + escHtml(biz.city || 'San Jose') + '</div>' +
        '<h1 class="ns-hero__name">' + escHtml(biz.name) + '</h1>' +
        '<p class="ns-hero__tagline">' + escHtml(biz.tagline || 'Premium nail care \xb7 Luxurious spa treatments') + '</p>' +
        chipsHtml +
        '<div class="ns-hero__ctas">' +
          '<button class="ns-btn-book" type="button" ' +
            'onclick="document.getElementById(\'nailBookSection_' + biz.id + '\').scrollIntoView({behavior:\'smooth\'})">' +
            calendarIcon + ' \u0110\u1eb7t L\u1ecbch Ngay' +
          '</button>' +
          (biz.phone ? '<a href="tel:' + biz.phone + '" class="ns-btn-call">' + phoneIcon + ' G\u1ecdi ngay</a>' : '') +
          '<button class="ns-btn-services" type="button" ' +
            'onclick="document.getElementById(\'ns-feat-' + biz.id + '\').scrollIntoView({behavior:\'smooth\'})">' +
            arrowRightIcon + ' Xem D\u1ecbch V\u1ee5' +
          '</button>' +
        '</div>' +
      '</div>' +
      addrHtml +
    '</div>';
  }

  function renderNailsFeatured(biz) {
    // Horizontal scroll-snap flow panel — mirrors main page .hp-vendor-row pattern.
    // ~76% wide portrait cards on mobile; swipe to reveal next card.
    // Each card = featured service. Tapping CTA → nsScrollToBooking → opens category.
    var CAT_LABELS = {
      manicure: 'Manicure', pedicure: 'Pedicure', gel: 'Gel & Shellac',
      acrylic: 'Acrylic & Extensions', nailart: 'Nail Art', dip: 'Dip Powder',
      spa: 'Spa Treatments', addon: 'Add-ons', other: 'D\u1ecbch V\u1ee5'
    };
    var CAT_IMAGES = {
      manicure: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&auto=format&fit=crop&q=82',
      pedicure: 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?w=600&auto=format&fit=crop&q=82',
      acrylic:  'https://images.unsplash.com/photo-1632345031435-8727f592d8db?w=600&auto=format&fit=crop&q=82',
      gel:      'https://images.unsplash.com/photo-1604902396830-aca29e19b067?w=600&auto=format&fit=crop&q=82',
      nailart:  'https://images.unsplash.com/photo-1636018492665-21ce4ac4e0f1?w=600&auto=format&fit=crop&q=82',
      dip:      'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&auto=format&fit=crop&q=82',
      addon:    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=600&auto=format&fit=crop&q=82',
      spa:      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=600&auto=format&fit=crop&q=82',
      other:    'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&auto=format&fit=crop&q=82'
    };
    var FALLBACK = 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&auto=format&fit=crop&q=60';

    // Live data: featured:true first, then one-per-category, then first 6
    var liveSvcs = biz._staticServices || biz.services || [];
    var cards;
    if (liveSvcs.length) {
      var flagged = liveSvcs.filter(function (s) { return s.featured === true; });
      if (flagged.length >= 3) {
        cards = flagged.slice(0, 6);
      } else {
        var seenCat = {}, picks = [];
        liveSvcs.forEach(function (s) {
          if (picks.length >= 6) return;
          var cat = s.category || 'other';
          if (!seenCat[cat] && s.imageUrl) { seenCat[cat] = true; picks.push(s); }
        });
        if (picks.length < 3) {
          seenCat = {}; picks = [];
          liveSvcs.forEach(function (s) {
            if (picks.length >= 6) return;
            var cat = s.category || 'other';
            if (!seenCat[cat]) { seenCat[cat] = true; picks.push(s); }
          });
        }
        cards = picks.length ? picks : liveSvcs.slice(0, 6);
      }
      cards = cards.map(function (s) {
        var cat = s.category || 'other';
        var imgSrc = s.imageUrl || CAT_IMAGES[cat] || FALLBACK;
        var durText = s.durationMins ? s.durationMins + ' min' : (s.duration || '');
        var priceText = (s.price != null && s.price !== '')
          ? (typeof s.price === 'number' ? 'T\u1eeb $' + s.price : String(s.price))
          : (s.priceFrom ? 'T\u1eeb $' + s.priceFrom : '');
        var metaParts = [durText, priceText].filter(Boolean);
        return { catKey: cat, label: s.name, catLabel: CAT_LABELS[cat] || cat,
                 img: imgSrc, meta: metaParts.join(' \xb7 '), desc: s.desc || '' };
      });
    } else {
      // Static fallback
      cards = [
        { catKey: 'manicure', label: 'Classic Manicure', catLabel: 'Manicure',
          img: CAT_IMAGES.manicure, meta: '45 min \xb7 T\u1eeb $18', desc: 'Shaped, buffed & perfectly polished' },
        { catKey: 'gel', label: 'Gel Manicure', catLabel: 'Gel & Shellac',
          img: CAT_IMAGES.gel, meta: '60 min \xb7 T\u1eeb $38', desc: 'Chip-free up to 3 weeks' },
        { catKey: 'pedicure', label: 'Pedicure', catLabel: 'Foot Care',
          img: CAT_IMAGES.pedicure, meta: '50 min \xb7 T\u1eeb $30', desc: 'Soak, exfoliate & refresh' },
        { catKey: 'acrylic', label: 'Acrylic Extensions', catLabel: 'Extensions',
          img: CAT_IMAGES.acrylic, meta: '75 min \xb7 T\u1eeb $45', desc: 'Sculpted for strength & shape' },
        { catKey: 'nailart', label: 'Nail Art', catLabel: 'Design & Art',
          img: CAT_IMAGES.nailart, meta: '90 min \xb7 T\u1eeb $25', desc: 'Bespoke hand-painted designs' },
        { catKey: 'spa', label: 'Spa Package', catLabel: 'Luxury Spa',
          img: CAT_IMAGES.spa, meta: '90 min \xb7 T\u1eeb $65', desc: 'Mani + pedi + hot stone ritual' }
      ];
    }

    if (!cards.length) return '';

    var cardsHtml = cards.map(function (c, i) {
      return '<div class="ns-flow-card" role="button" tabindex="0" ' +
        'onclick="window.nsScrollToBooking(\'' + escAttr(biz.id) + '\',\'' + escAttr(c.catKey) + '\')" ' +
        'onkeydown="if(event.key===\'Enter\'||event.key===\' \')this.click()" ' +
        'aria-label="' + escAttr(c.label) + '">' +
        '<img class="ns-flow-card__bg" src="' + escAttr(c.img) + '" ' +
          'onerror="this.onerror=null;this.src=\'' + FALLBACK + '\'" ' +
          'alt="" ' + (i === 0 ? '' : 'loading="lazy" ') + 'aria-hidden="true">' +
        '<div class="ns-flow-card__gradient"></div>' +
        '<div class="ns-flow-card__content">' +
          '<span class="ns-flow-card__chip">' + escHtml(c.catLabel) + '</span>' +
          '<div class="ns-flow-card__name">' + escHtml(c.label) + '</div>' +
          (c.meta ? '<div class="ns-flow-card__meta">' + escHtml(c.meta) + '</div>' : '') +
          (c.desc ? '<div class="ns-flow-card__desc">' + escHtml(c.desc) + '</div>' : '') +
          '<button class="ns-flow-card__cta" type="button" ' +
            'onclick="event.stopPropagation();window.nsScrollToBooking(\'' + escAttr(biz.id) + '\',\'' + escAttr(c.catKey) + '\')">' +
            '\u0110\u1eb7t L\u1ecbch \u2192' +
          '</button>' +
        '</div>' +
      '</div>';
    }).join('');

    return '<section class="ns-featured" id="ns-feat-' + biz.id + '">' +
      '<div class="ns-section-heading-wrap">' +
        '<h2 class="ns-section-heading">D\u1ecbch V\u1ee5 C\u1ee7a Ch\xfang T\xf4i</h2>' +
        '<p class="ns-section-sub">Ch\u1ecdn d\u1ecbch v\u1ee5 \u2014 h\u1eb9n l\u1ecbch ch\xed trong 30 gi\xe2y</p>' +
      '</div>' +
      '<div class="ns-flow-row">' + cardsHtml + '</div>' +
    '</section>';
  }

  function renderNailsPromoSlot(biz) {
    // Ambient Ken Burns image — no fake play button.
    // When /videos/salon-promo.mp4 (Remotion SalonPromo) is ready, replace <img> with:
    //   <video class="ns-promo-slot__video" autoplay muted loop playsinline src="/videos/salon-promo.mp4"></video>
    var ctaOnclick = 'document.getElementById(\'nailBookSection_' + biz.id + '\').scrollIntoView({behavior:\'smooth\'})';
    return '<section class="ns-promo-slot">' +
      '<div class="ns-promo-slot__card">' +
        '<img class="ns-promo-slot__bg" src="/images/nails-2.jpg" ' +
          'onerror="this.onerror=null;this.src=\'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=900&auto=format&fit=crop&q=80\'" ' +
          'alt="" loading="lazy" aria-hidden="true">' +
        '<div class="ns-promo-slot__overlay"></div>' +
        '<div class="ns-promo-slot__badge">Salon Showcase</div>' +
        '<div class="ns-promo-slot__content">' +
          '<p class="ns-promo-slot__headline">Kh\xf4ng gian sang tr\u1ecdng</p>' +
          '<p class="ns-promo-slot__tagline">Premium tools \xb7 Safe products \xb7 Expert team</p>' +
          '<button class="ns-promo-slot__cta" type="button" onclick="' + ctaOnclick + '">' +
            '\u0110\u1eb7t L\u1ecbch Ngay \u2192' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function renderNailsBookingSection(biz) {
    // ── Service catalog ────────────────────────────────────────────────────────
    // _staticServices: set after Firestore loads (all 59 static services)
    // biz.services:    Firestore-active if Firestore ran; full static if it didn't
    var staticSvcs    = biz._staticServices || biz.services || [];
    var firestoreSvcs = (biz._staticServices && biz.services && biz.services.length > 0)
      ? biz.services : [];

    if (!staticSvcs.length && !firestoreSvcs.length) return '';

    var catLabels = {
      manicure: 'Manicure', pedicure: 'Pedicure', gel: 'Gel & Shellac',
      acrylic: 'Acrylic & Extensions', nailart: 'Nail Art', dip: 'Dip Powder',
      spa: 'Spa Treatments', addon: 'Add-ons / Care', other: 'D\u1ecbch V\u1ee5'
    };

    // Per-category maps: Firestore-active first, static as fallback
    var firestoreCatMap = {}, staticCatMap = {};
    firestoreSvcs.forEach(function (s) {
      var cat = s.category || 'other';
      if (!firestoreCatMap[cat]) firestoreCatMap[cat] = [];
      firestoreCatMap[cat].push(s);
    });
    staticSvcs.forEach(function (s) {
      var cat = s.category || 'other';
      if (!staticCatMap[cat]) staticCatMap[cat] = [];
      staticCatMap[cat].push(s);
    });

    // Best services for a category: Firestore-active (has prices) → static fallback
    function _svcsFor(catKey) {
      return (firestoreCatMap[catKey] && firestoreCatMap[catKey].length)
        ? firestoreCatMap[catKey]
        : (staticCatMap[catKey] || []);
    }

    // Show all defined categories that have services (static ensures all 7 always populated)
    var allCats = (biz.serviceCategories && biz.serviceCategories.length)
      ? biz.serviceCategories.filter(function (c) { return _svcsFor(c.key).length > 0; })
      : Object.keys(staticCatMap).map(function (k) { return { key: k, label: catLabels[k] || k }; });

    if (!allCats.length) return '';

    // ── Category images (same art direction as ns-feat-card) ──────────────────
    var catImages = {
      manicure: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&auto=format&fit=crop&q=82',
      pedicure: 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?w=600&auto=format&fit=crop&q=82',
      acrylic:  'https://images.unsplash.com/photo-1632345031435-8727f592d8db?w=600&auto=format&fit=crop&q=82',
      gel:      'https://images.unsplash.com/photo-1604902396830-aca29e19b067?w=600&auto=format&fit=crop&q=82',
      nailart:  'https://images.unsplash.com/photo-1636018492665-21ce4ac4e0f1?w=600&auto=format&fit=crop&q=82',
      dip:      'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&auto=format&fit=crop&q=82',
      addon:    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=600&auto=format&fit=crop&q=82',
      spa:      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=600&auto=format&fit=crop&q=82',
      other:    'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&auto=format&fit=crop&q=82'
    };
    var FALLBACK = 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&auto=format&fit=crop&q=60';

    // ── VIEW 1a: Featured showcase carousel — live from vendor service data ─────
    // Priority: featured:true flags → one-per-category with imageUrl → one-per-category → first 6
    // Falls back to static services only when Firestore has no active services.
    var _showcaseSrc = firestoreSvcs.length > 0 ? firestoreSvcs : staticSvcs;
    var _featItems = (function () {
      var flagged = _showcaseSrc.filter(function (s) { return s.featured === true; });
      if (flagged.length >= 3) return flagged.slice(0, 6);
      // one per category, prefer those with an image
      var seenCat = {}, picks = [];
      _showcaseSrc.forEach(function (s) {
        if (picks.length >= 6) return;
        var cat = s.category || 'other';
        if (!seenCat[cat] && s.imageUrl) { seenCat[cat] = true; picks.push(s); }
      });
      if (picks.length < 3) {
        seenCat = {}; picks = [];
        _showcaseSrc.forEach(function (s) {
          if (picks.length >= 6) return;
          var cat = s.category || 'other';
          if (!seenCat[cat]) { seenCat[cat] = true; picks.push(s); }
        });
      }
      if (!picks.length) picks = _showcaseSrc.slice(0, 6);
      return picks;
    }());
    var featCardsHtml = _featItems
      .filter(function (s) { return _svcsFor(s.category || 'other').length > 0; })
      .map(function (s) {
        var cat       = s.category || 'other';
        var imgSrc    = s.imageUrl || catImages[cat] || FALLBACK;
        var durText   = s.durationMins ? s.durationMins + ' min' : (s.duration || '');
        var priceText = (s.price != null && s.price !== '')
          ? (typeof s.price === 'number' ? 'T\u1eeb $' + s.price : String(s.price))
          : (s.priceFrom ? 'T\u1eeb $' + s.priceFrom : '');
        var metaParts = [durText, priceText].filter(Boolean);
        return '<div class="ns-book-feat-card" role="button" tabindex="0" ' +
          'onclick="window.nsShowServiceList(\'' + escAttr(biz.id) + '\',\'' + escAttr(cat) + '\')" ' +
          'onkeydown="if(event.key===\'Enter\'||event.key===\' \')this.click()" ' +
          'aria-label="' + escAttr(s.name) + '">' +
          '<img class="ns-book-feat-card__img" src="' + escAttr(imgSrc) + '" ' +
            'onerror="this.onerror=null;this.src=\'' + FALLBACK + '\'" alt="" loading="lazy" aria-hidden="true">' +
          '<div class="ns-book-feat-card__body">' +
            '<div class="ns-book-feat-card__name">' + escHtml(s.name) + '</div>' +
            (metaParts.length ? '<div class="ns-book-feat-card__meta">' + escHtml(metaParts.join(' \xb7 ')) + '</div>' : '') +
          '</div>' +
        '</div>';
      }).join('');
    var featuredHtml = featCardsHtml
      ? '<div class="ns-book-featured-wrap">' +
          '<div class="ns-book-featured-label">Ph\u1ed5 Bi\u1ebfn Nh\u1ea5t</div>' +
          '<div class="ns-book-featured">' + featCardsHtml + '</div>' +
        '</div>'
      : '';

    // ── VIEW 1b: Category hero card grid ──────────────────────────────────────
    var catCardsHtml = allCats.map(function (c) {
      var img   = catImages[c.key] || FALLBACK;
      var count = _svcsFor(c.key).length;
      return '<div class="ns-book-cat-card" role="button" tabindex="0" ' +
        'onclick="window.nsShowServiceList(\'' + escAttr(biz.id) + '\',\'' + escAttr(c.key) + '\')" ' +
        'onkeydown="if(event.key===\'Enter\'||event.key===\' \')this.click()" ' +
        'aria-label="' + escAttr(c.label) + '">' +
        '<img class="ns-book-cat-card__img" src="' + escAttr(img) + '" ' +
          'onerror="this.onerror=null;this.src=\'' + FALLBACK + '\'" alt="" loading="lazy" aria-hidden="true">' +
        '<div class="ns-book-cat-card__overlay"></div>' +
        '<div class="ns-book-cat-card__body">' +
          '<div class="ns-book-cat-card__label">' + escHtml(c.label) + '</div>' +
          '<div class="ns-book-cat-card__count">' + count + ' d\u1ecbch v\u1ee5</div>' +
        '</div>' +
      '</div>';
    }).join('');

    // ── VIEW 2: Pre-rendered service lists (all hidden — nsShowServiceList reveals one) ─
    var svcListsHtml = allCats.map(function (c) {
      var svcs = _svcsFor(c.key);
      if (!svcs.length) return '';
      var itemsHtml = svcs.map(function (s) {
        var meta = [];
        if (s.durationMins) meta.push(s.durationMins + ' min');
        if (s.price != null && s.price !== '') {
          meta.push(typeof s.price === 'number' ? '$' + s.price : s.price);
        }
        return '<div class="ns-book-svc-item" role="button" tabindex="0" ' +
          'data-svc-name="' + escAttr(s.name) + '" ' +
          'onclick="window.nsSelectService(\'' + escAttr(biz.id) + '\',\'' + escAttr(s.name) + '\',' + (s.durationMins || 60) + ',\'' + escAttr(c.key) + '\')" ' +
          'onkeydown="if(event.key===\'Enter\'||event.key===\' \')this.click()" ' +
          'aria-label="' + escAttr(s.name) + (meta.length ? ' \u2014 ' + escAttr(meta.join(' \xb7 ')) : '') + '">' +
          '<img class="ns-book-svc-item__img" src="' + escAttr(s.imageUrl || catImages[c.key] || FALLBACK) + '" alt="" loading="lazy" aria-hidden="true" onerror="this.onerror=null;this.src=\'' + FALLBACK + '\'">' +
          '<div class="ns-book-svc-item__info">' +
            '<div class="ns-book-svc-item__name">' + escHtml(s.name) + '</div>' +
            (meta.length ? '<div class="ns-book-svc-item__meta">' + escHtml(meta.join(' \xb7 ')) + '</div>' : '') +
            (s.desc ? '<div class="ns-book-svc-item__desc">' + escHtml(s.desc) + '</div>' : '') +
          '</div>' +
          '<div class="ns-book-svc-item__arrow" aria-hidden="true">\u2192</div>' +
        '</div>';
      }).join('');
      return '<div class="ns-svc-list-group" id="nbSvcGroup_' + escAttr(biz.id) + '_' + escAttr(c.key) + '" ' +
        'data-cat="' + escAttr(c.key) + '" data-label="' + escAttr(c.label) + '" style="display:none">' +
        '<div class="ns-book-svc-list">' + itemsHtml + '</div>' +
      '</div>';
    }).join('');

    // ── VIEW 3: Hidden checkboxes for initNailBookingForm ─────────────────────
    // One checkbox per service name — nsSelectService checks the right one programmatically.
    // Using all static services ensures every possible service name is covered.
    var chkboxSeen = {}, allChkboxSvcs = [];
    staticSvcs.forEach(function (s) {
      if (s.name && !chkboxSeen[s.name]) { chkboxSeen[s.name] = true; allChkboxSvcs.push(s); }
    });
    firestoreSvcs.forEach(function (s) {
      if (s.name && !chkboxSeen[s.name]) { chkboxSeen[s.name] = true; allChkboxSvcs.push(s); }
    });
    var checkboxesHtml = allChkboxSvcs.map(function (s) {
      return '<input type="checkbox" class="nb-svc-chk" name="services" ' +
        'value="' + escAttr(s.name) + '" data-mins="' + (s.durationMins || 60) + '">';
    }).join('');

    var activeStaff = (biz.staff || []).filter(function (m) { return m.active !== false; });
    var staffOpts = '<option value="Any">B\u1ea5t k\u1ef3 (salon s\u1eafp x\u1ebfp)</option>' +
      activeStaff.map(function (m) {
        return '<option value="' + escAttr(m.name) + '">' + escHtml(m.name) + (m.role ? ' \u2014 ' + escHtml(m.role) : '') + '</option>';
      }).join('');
    var today = new Date().toISOString().slice(0, 10);

    // ── Category hero carousel — VIEW 1 discovery (mirrors main page .hc pattern) ──
    // Ordered: categories with featured:true services first, then remaining.
    // Each slide: category bg image + gradient overlay + name + count + CTA.
    // Touch-swipe and dot nav wired in _initNsCatHc() after DOM insertion.
    var _featCatOrder = (function () {
      var src = firestoreSvcs.length > 0 ? firestoreSvcs : staticSvcs;
      var seen = {}, keys = [];
      src.filter(function (s) { return s.featured === true; }).forEach(function (s) {
        if (s.category && !seen[s.category]) { seen[s.category] = true; keys.push(s.category); }
      });
      return keys;
    }());
    var _sortedCats = allCats.slice().sort(function (a, b) {
      var ai = _featCatOrder.indexOf(a.key), bi = _featCatOrder.indexOf(b.key);
      if (ai < 0 && bi < 0) return 0;
      if (ai < 0) return 1;
      if (bi < 0) return -1;
      return ai - bi;
    });
    var _catSlides = _sortedCats.filter(function (c) { return _svcsFor(c.key).length > 0; });
    var catSlidesHtml = _catSlides.map(function (c, i) {
      var img      = catImages[c.key] || FALLBACK;
      var count    = _svcsFor(c.key).length;
      var previews = _svcsFor(c.key).slice(0, 3).map(function (s) { return s.name; }).join(' \xb7 ');
      return '<div class="ns-cat-hc__slide' + (i === 0 ? ' ns-cat-hc__slide--active' : '') + '" ' +
        'data-cat="' + escAttr(c.key) + '" data-idx="' + i + '">' +
        '<img class="ns-cat-hc__bg" src="' + escAttr(img) + '" ' +
          'onerror="this.onerror=null;this.src=\'' + FALLBACK + '\'" ' +
          'alt="" ' + (i === 0 ? '' : 'loading="lazy" ') + 'aria-hidden="true">' +
        '<div class="ns-cat-hc__gradient"></div>' +
        '<div class="ns-cat-hc__body">' +
          '<span class="ns-cat-hc__chip">' + count + ' d\u1ecbch v\u1ee5</span>' +
          '<h3 class="ns-cat-hc__title">' + escHtml(c.label) + '</h3>' +
          '<p class="ns-cat-hc__sub">' + escHtml(previews) + '</p>' +
          '<button class="ns-cat-hc__cta" type="button" ' +
            'onclick="window.nsShowServiceList(\'' + escAttr(biz.id) + '\',\'' + escAttr(c.key) + '\')">' +
            'Xem D\u1ecbch V\u1ee5 \u2192' +
          '</button>' +
        '</div>' +
      '</div>';
    }).join('');
    var catDotsHtml = _catSlides.length > 1
      ? _catSlides.map(function (c, i) {
          return '<span class="ns-cat-hc__dot' + (i === 0 ? ' ns-cat-hc__dot--active' : '') + '" ' +
            'data-dot="' + i + '" role="button" tabindex="0" aria-label="' + escAttr(c.label) + '" ' +
            'onclick="window._nsCatHcGoto(\'' + escAttr(biz.id) + '\',' + i + ')" ' +
            'onkeydown="if(event.key===\'Enter\')window._nsCatHcGoto(\'' + escAttr(biz.id) + '\',' + i + ')"></span>';
        }).join('')
      : '';
    var catHeroHtml = catSlidesHtml
      ? '<div class="ns-cat-hc" id="nsCatHc_' + biz.id + '">' +
          catSlidesHtml +
          (catDotsHtml ? '<div class="ns-cat-hc__dots">' + catDotsHtml + '</div>' : '') +
        '</div>'
      : '';

    return '<section class="ns-booking-section" id="nailBookSection_' + biz.id + '">' +

      // ── VIEW 1: Category hero carousel ───────────────────────────────────────
      '<div class="ns-book-step" id="nbCatView_' + biz.id + '">' +
        '<div class="ns-section-heading-wrap">' +
          '<h2 class="ns-section-heading">\u0110\u1eb7t L\u1ecbch Ngay</h2>' +
          '<p class="ns-section-sub">Ch\u1ecdn d\u1ecbch v\u1ee5 v\xe0 th\u1eddi gian ph\xf9 h\u1ee3p</p>' +
        '</div>' +
        catHeroHtml +
      '</div>' +

      // ── VIEW 2: Service list for selected category ───────────────────────────
      '<div class="ns-book-step" id="nbSvcView_' + biz.id + '" style="display:none">' +
        '<div class="ns-book-step-header">' +
          '<button class="ns-book-back-btn" type="button" ' +
            'onclick="window.nsBackToCats(\'' + escAttr(biz.id) + '\')">' +
            '\u2190 Danh M\u1ee5c' +
          '</button>' +
          '<h3 class="ns-book-cat-heading" id="nbSvcViewTitle_' + biz.id + '"></h3>' +
        '</div>' +
        '<div id="nbSvcLists_' + biz.id + '">' + svcListsHtml + '</div>' +
        '<div class="ns-svc-select-bar" id="nbSelectBar_' + biz.id + '" style="display:none">' +
          '<div class="ns-svc-select-bar__info">' +
            '<div class="ns-svc-select-bar__count" id="nbSelectCount_' + biz.id + '"></div>' +
            '<div class="ns-svc-select-bar__dur" id="nbSelectDur_' + biz.id + '"></div>' +
          '</div>' +
          '<button class="ns-svc-select-bar__cta" type="button" ' +
            'onclick="window.nsConfirmSelection(\'' + escAttr(biz.id) + '\')">' +
            '\u0110\u1eb7t L\u1ecbch \u2192' +
          '</button>' +
        '</div>' +
      '</div>' +

      // ── VIEW 3: Booking form ─────────────────────────────────────────────────
      '<div class="ns-book-step" id="nbFormView_' + biz.id + '" style="display:none">' +
        '<div class="ns-book-step-header">' +
          '<button class="ns-book-back-btn" type="button" ' +
            'onclick="window.nsBackToSvcList(\'' + escAttr(biz.id) + '\')">' +
            '\u2190 \u0110\u1ed5i D\u1ecbch V\u1ee5' +
          '</button>' +
          '<h3 class="ns-book-cat-heading">Th\xf4ng Tin H\u1eb9n</h3>' +
        '</div>' +
        '<div class="ns-selected-svc-badge" id="nbSelectedSvc_' + biz.id + '" style="display:none"></div>' +
        '<div class="ns-book-panel">' +
          '<div class="ns-book-panel__body">' +
            '<form id="nailBookForm_' + biz.id + '">' +
              '<div id="nbServices_' + biz.id + '" style="display:none">' + checkboxesHtml + '</div>' +
              '<div class="ns-dur-badge" id="nbDurRow_' + biz.id + '" style="display:none">' +
                clockIcon + ' <span>T\u1ed5ng th\u1eddi gian: </span>' +
                '<strong id="nbDurVal_' + biz.id + '">0</strong><span> ph\xfat</span>' +
              '</div>' +
              '<div class="mp-form-row">' +
                '<label class="mp-label" for="nbStaff_' + biz.id + '">K\u1ef9 thu\u1eadt vi\xean</label>' +
                '<select class="mp-input" id="nbStaff_' + biz.id + '">' + staffOpts + '</select>' +
              '</div>' +
              '<div class="mp-form-row-duo">' +
                '<div class="mp-form-row">' +
                  '<label class="mp-label" for="nbDate_' + biz.id + '">Ng\xe0y h\u1eb9n</label>' +
                  '<input class="mp-input" type="date" id="nbDate_' + biz.id + '" min="' + today + '" required>' +
                '</div>' +
                '<div class="mp-form-row">' +
                  '<label class="mp-label" for="nbTime_' + biz.id + '">Gi\u1edd h\u1eb9n</label>' +
                  '<input class="mp-input" type="time" id="nbTime_' + biz.id + '" required>' +
                '</div>' +
              '</div>' +
              '<div class="mp-form-row-duo">' +
                '<div class="mp-form-row">' +
                  '<label class="mp-label" for="nbName_' + biz.id + '">H\u1ecd &amp; T\xean</label>' +
                  '<input class="mp-input" type="text" id="nbName_' + biz.id + '" placeholder="Nguy\u1ec5n V\u0103n A" required>' +
                '</div>' +
                '<div class="mp-form-row">' +
                  '<label class="mp-label" for="nbPhone_' + biz.id + '">S\u1ed1 \u0111i\u1ec7n tho\u1ea1i</label>' +
                  '<input class="mp-input" type="tel" id="nbPhone_' + biz.id + '" placeholder="(408) 555-0000" required>' +
                '</div>' +
              '</div>' +
              '<div class="mp-form-row">' +
                '<label class="mp-label" for="nbNotes_' + biz.id + '">Ghi ch\xfa (t\xf9y ch\u1ecdn)</label>' +
                '<textarea class="mp-input" id="nbNotes_' + biz.id + '" rows="2" placeholder="Y\xeau c\u1ea7u \u0111\u1eb7c bi\u1ec7t..."></textarea>' +
              '</div>' +
              '<div class="mp-form-row">' +
                '<label class="mp-label" for="nbPhotoUrl_' + biz.id + '">\u1ea2nh tham kh\u1ea3o (t\xf9y ch\u1ecdn)</label>' +
                '<input class="mp-input" type="url" id="nbPhotoUrl_' + biz.id + '" placeholder="https://... (link \u1ea3nh m\u1eabu nail b\u1ea1n mu\u1ed1n)">' +
              '</div>' +
              '<div class="nb-avail-msg" id="nbMsg_' + biz.id + '" style="display:none"></div>' +
              '<button type="submit" class="mp-btn mp-btn--primary mp-btn--full" id="nbSubmit_' + biz.id + '">' +
                calendarIcon + ' G\u1eedi \u0110\u1eb7t L\u1ecbch' +
              '</button>' +
              '<div class="mp-form-success" id="nbSuccess_' + biz.id + '">' +
                checkIcon +
                '<p>\u0110\u1eb7t l\u1ecbch th\xe0nh c\xf4ng!</p>' +
                '<p style="margin-top:.5rem;font-size:.8rem;">' +
                  'Ch\xfang t\xf4i s\u1ebd li\xean h\u1ec7 x\xe1c nh\u1eadn s\u1edbm nh\u1ea5t.' +
                '</p>' +
              '</div>' +
            '</form>' +
          '</div>' +
        '</div>' +
      '</div>' +

    '</section>';
  }

  function renderNailsTrust(biz) {
    var icons = [
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.09 6.26L20 9.27l-4.91 4.79 1.18 6.88L12 17.77l-6.27 3.17 1.18-6.88L2 9.27l5.91-1.01z"/></svg>',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
    ];
    var features = biz.features || [];
    var featHtml = features.map(function (f, i) {
      return '<div class="ns-feature-item">' +
        '<span class="ns-feature-icon">' + icons[i % icons.length] + '</span>' +
        escHtml(f) +
      '</div>';
    }).join('');

    var hoursHtml = '';
    if (biz.hours) {
      var rowsHtml = Object.keys(biz.hours).map(function (day) {
        return '<div class="ns-hours__row">' +
          '<span class="ns-hours__day">' + escHtml(day) + '</span>' +
          '<span>' + escHtml(biz.hours[day]) + '</span>' +
        '</div>';
      }).join('');
      hoursHtml = '<div class="ns-hours">' +
        '<div class="ns-hours__header">Gi\u1edd M\u1edf C\u1eeda</div>' +
        rowsHtml +
      '</div>';
    }

    return '<section class="ns-trust">' +
      '<h2 class="ns-section-heading">T\u1ea1i Sao Ch\u1ecdn Ch\xfang T\xf4i</h2>' +
      '<p class="ns-section-sub">H\u01a1n 10 n\u0103m ch\u0103m s\xf3c s\u1eafc \u0111\u1eb9p t\u1ea1i Bay Area</p>' +
      '<div class="ns-stats">' +
        '<div class="ns-stat"><span class="ns-stat__num">10+</span><span class="ns-stat__label">N\u0103m kinh nghi\u1ec7m</span></div>' +
        '<div class="ns-stat"><span class="ns-stat__num">5\u2605</span><span class="ns-stat__label">\u0110\xe1nh gi\xe1 kh\xe1ch</span></div>' +
        '<div class="ns-stat"><span class="ns-stat__num">100%</span><span class="ns-stat__label">S\u1ea3n ph\u1ea9m an to\xe0n</span></div>' +
      '</div>' +
      (featHtml ? '<div class="ns-features">' + featHtml + '</div>' : '') +
      hoursHtml +
    '</section>';
  }

  function renderNailsInspiration() {
    var localFallback = [
      { src: '/images/nails-1.jpg',  fb: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=500&auto=format&fit=crop&q=80' },
      { src: '/images/nails-2.jpg',  fb: 'https://images.unsplash.com/photo-1636018492665-21ce4ac4e0f1?w=500&auto=format&fit=crop&q=80' },
      { src: '/images/nails-3.jpg',  fb: 'https://images.unsplash.com/photo-1632345031435-8727f592d8db?w=500&auto=format&fit=crop&q=80' }
    ];
    var unsplash = [
      'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=500&auto=format&fit=crop&q=80'
    ];
    var localHtml = localFallback.map(function (item) {
      return '<img class="ns-gallery__img" src="' + item.src + '" ' +
        'onerror="this.src=\'' + item.fb + '\'" ' +
        'alt="" loading="lazy" aria-hidden="true">';
    }).join('');
    var unsplashHtml = unsplash.map(function (src) {
      return '<img class="ns-gallery__img" src="' + src + '" alt="" loading="lazy" aria-hidden="true">';
    }).join('');

    return '<section class="ns-gallery">' +
      '<div class="ns-gallery__header">' +
        '<h2 class="ns-section-heading">C\u1ea3m H\u1ee9ng Nail</h2>' +
        '<p class="ns-section-sub">H\xecnh \u1ea3nh th\u1ef1c t\u1ebf t\u1eeb salon</p>' +
      '</div>' +
      '<div class="ns-gallery__scroll">' + localHtml + unsplashHtml + '</div>' +
    '</section>';
  }

  function renderInfoStrip(biz) {
    return '<div class="mp-info-strip">' +
      '<div class="mp-info-strip__item">' + mapPinIcon + escHtml(biz.address) + '</div>' +
      '<div class="mp-info-strip__item">' + phoneIcon +
        '<a href="tel:' + biz.phone + '">' + escHtml(biz.phoneDisplay) + '</a>' +
      '</div>' +
    '</div>';
  }

  function renderServicesSection(biz) {
    var activeSvcs = (biz.services || []).filter(function (svc) { return svc.active !== false; });

    if (!activeSvcs.length) {
      return '<div class="mp-section">' +
        '<div class="mp-section-hdr"><h2 class="mp-section-title">Dịch vụ & Giá</h2></div>' +
        '<p style="color:var(--muted-lt,#8ab5cc);padding:.75rem 0;font-size:.9rem;">Vui lòng liên hệ trực tiếp để biết thêm thông tin dịch vụ.</p>' +
      '</div>';
    }

    var itemsHtml = activeSvcs.map(function (svc) {
      return '<div class="mp-svc-item">' +
        '<div class="mp-svc-item__name">' + escHtml(svc.name) + '</div>' +
        '<div class="mp-svc-item__meta">' +
          '<span class="mp-svc-item__price">' + escHtml(svc.price) + '</span>' +
          '<span class="mp-svc-item__dur">' + clockIcon + ' ' + escHtml(svc.duration) + '</span>' +
        '</div>' +
        '<div class="mp-svc-item__desc">' + escHtml(svc.desc) + '</div>' +
      '</div>';
    }).join('');

    return '<div class="mp-section">' +
      '<div class="mp-section-hdr">' +
        '<h2 class="mp-section-title">Dịch vụ & Giá</h2>' +
      '</div>' +
      '<div class="mp-services-grid">' + itemsHtml + '</div>' +
    '</div>';
  }

  function renderHoursSection(biz) {
    var rowsHtml = Object.keys(biz.hours).map(function (day) {
      return '<tr><td>' + escHtml(day) + '</td><td>' + escHtml(biz.hours[day]) + '</td></tr>';
    }).join('');

    return '<div class="mp-section">' +
      '<div class="mp-section-hdr">' +
        '<h2 class="mp-section-title">Giờ Mở Cửa</h2>' +
      '</div>' +
      '<table class="mp-hours-table"><tbody>' + rowsHtml + '</tbody></table>' +
    '</div>';
  }

  function renderBookingSection(biz) {
    var isReservation = biz.bookingType === 'reservation';
    var title = isReservation ? 'Đặt Bàn' : 'Đặt Lịch Hẹn';
    var note = isReservation
      ? 'Chúng tôi sẽ xác nhận đặt bàn qua điện thoại trong vòng 30 phút.'
      : 'Chúng tôi sẽ liên hệ xác nhận lịch hẹn trong vòng 1-2 giờ.';

    var specificFields = isReservation
      ? renderReservationFields(biz)
      : renderAppointmentFields(biz);

    return '<div class="mp-section" id="bookingSection_' + biz.id + '">' +
      '<div class="mp-section-hdr">' +
        '<h2 class="mp-section-title">' + title + '</h2>' +
      '</div>' +
      '<div class="mp-panel-form">' +
        '<form id="bookingForm_' + biz.id + '" class="mp-booking-form">' +
          '<input type="hidden" name="_subject" value="Đặt lịch mới — ' + escAttr(biz.name) + '">' +
          '<input type="hidden" name="business" value="' + escAttr(biz.name) + '">' +
          '<input type="hidden" name="category" value="' + escAttr(biz.category) + '">' +
          '<input type="hidden" name="location" value="' + escAttr(biz.address) + '">' +
          '<div class="mp-form-row-duo">' +
            '<div class="mp-form-row">' +
              '<label class="mp-label" for="bfName_' + biz.id + '">Họ & Tên</label>' +
              '<input class="mp-input" type="text" id="bfName_' + biz.id + '" name="name" placeholder="Nguyễn Văn A" required>' +
            '</div>' +
            '<div class="mp-form-row">' +
              '<label class="mp-label" for="bfPhone_' + biz.id + '">Số Điện Thoại</label>' +
              '<input class="mp-input" type="tel" id="bfPhone_' + biz.id + '" name="phone" placeholder="(714) 555-0000" required>' +
            '</div>' +
          '</div>' +
          specificFields +
          '<div class="mp-form-row">' +
            '<label class="mp-label" for="bfDate_' + biz.id + '">Ngày Hẹn</label>' +
            '<input class="mp-input" type="date" id="bfDate_' + biz.id + '" name="date" required>' +
          '</div>' +
          '<div class="mp-form-row">' +
            '<label class="mp-label" for="bfTime_' + biz.id + '">Giờ Hẹn</label>' +
            '<input class="mp-input" type="time" id="bfTime_' + biz.id + '" name="time" required>' +
          '</div>' +
          '<div class="mp-form-row">' +
            '<label class="mp-label" for="bfNotes_' + biz.id + '">Ghi Chú (tùy chọn)</label>' +
            '<textarea class="mp-input" id="bfNotes_' + biz.id + '" name="notes" placeholder="Yêu cầu đặc biệt hoặc thông tin thêm..."></textarea>' +
          '</div>' +
          '<p class="mp-form-note">' + note + '</p>' +
          '<div class="mp-spacer"></div>' +
          '<button type="submit" class="mp-btn mp-btn--primary mp-btn--full">' +
            calendarIcon + ' Gửi Đặt ' + (isReservation ? 'Bàn' : 'Lịch') +
          '</button>' +
          '<div class="mp-form-success" id="bookingSuccess_' + biz.id + '">' +
            checkIcon +
            '<p>Đặt ' + (isReservation ? 'bàn' : 'lịch') + ' thành công!</p>' +
            '<p style="margin-top:.5rem;font-size:.8rem;color:var(--muted)">Chúng tôi sẽ liên hệ xác nhận sớm nhất.</p>' +
          '</div>' +
        '</form>' +
      '</div>' +
    '</div>';
  }

  function renderAppointmentFields(biz) {
    var opts = biz.services.map(function (svc) {
      return '<option value="' + escAttr(svc.name) + '">' + escHtml(svc.name) + ' — ' + escHtml(svc.price) + '</option>';
    }).join('');

    return '<div class="mp-form-row">' +
      '<label class="mp-label" for="bfService_' + biz.id + '">Dịch Vụ</label>' +
      '<select class="mp-input" id="bfService_' + biz.id + '" name="service" required>' +
        '<option value="">— Chọn dịch vụ —</option>' +
        opts +
      '</select>' +
    '</div>';
  }

  function renderReservationFields() {
    var sizeOpts = '';
    for (var i = 1; i <= 20; i++) {
      sizeOpts += '<option value="' + i + '">' + i + ' người</option>';
    }

    return '<div class="mp-form-row">' +
      '<label class="mp-label" for="bfParty">Số Người</label>' +
      '<select class="mp-input" id="bfParty" name="party_size" required>' +
        '<option value="">— Chọn số người —</option>' +
        sizeOpts +
      '</select>' +
    '</div>';
  }

  function renderAiSection(biz) {
    if (!biz.aiReceptionist || !biz.aiReceptionist.enabled) return '';

    var ai = biz.aiReceptionist;
    var chipsHtml = (ai.quickReplies || []).map(function (chip) {
      return '<button class="mp-ai__chip" type="button">' + escHtml(chip) + '</button>';
    }).join('');

    var _botAvatar = '<div class="mp-ai__msg__avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></div>';
    var initial = '<div class="mp-ai__msg mp-ai__msg--bot">' +
      _botAvatar +
      '<div class="mp-ai__bubble">' + escHtml(ai.welcomeMessage) + '</div>' +
    '</div>';

    return '<div class="mp-section">' +
      '<div class="mp-section-hdr">' +
        '<h2 class="mp-section-title">Trợ Lý AI</h2>' +
      '</div>' +
      '<div class="mp-ai" id="aiWidget_' + biz.id + '">' +
        '<div class="mp-ai__header">' +
          '<button type="button" class="mp-ai__header-back" aria-label="Close chat">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>' +
          '</button>' +
          '<div class="mp-ai__avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></div>' +
          '<div class="mp-ai__info">' +
            '<strong>' + escHtml(ai.name) + '</strong>' +
            '<div class="mp-ai__status"><span class="mp-ai__dot"></span>Online · Sẵn sàng hỗ trợ</div>' +
          '</div>' +
        '</div>' +
        '<div class="mp-ai__chips">' + chipsHtml + '</div>' +
        '<div class="mp-ai__messages" id="aiMessages_' + biz.id + '">' + initial + '</div>' +
        '<div class="mp-ai__input-bar">' +
          '<input class="mp-ai__input" type="text" id="aiInput_' + biz.id + '" placeholder="Nhập câu hỏi..." autocomplete="off">' +
          '<button class="mp-ai__mic-lang" type="button" title="Ngôn ngữ giọng nói" style="display:none">VI</button>' +
          '<button class="mp-ai__mic" type="button" title="Nói chuyện với AI" style="display:none">' + micIcon + '</button>' +
          '<button class="mp-ai__send" type="button" id="aiSend_' + biz.id + '">' + sendIcon + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function renderContactSection(biz) {
    var hostsHtml = biz.hosts.map(function (host) {
      var initial = host.name.charAt(0).toUpperCase();
      return '<div class="mp-contact-card__host">' +
        '<div class="mp-contact-card__avatar">' + initial + '</div>' +
        '<div class="mp-contact-card__info">' +
          '<div class="mp-contact-card__name">' + escHtml(host.name) + '</div>' +
          '<div class="mp-contact-card__role">' + escHtml(host.role) + '</div>' +
          '<a href="tel:' + host.phone + '" class="mp-contact-card__phone">' + escHtml(host.display) + '</a>' +
        '</div>' +
      '</div>';
    }).join('');

    return '<div class="mp-section">' +
      '<div class="mp-section-hdr">' +
        '<h2 class="mp-section-title">Liên Hệ</h2>' +
      '</div>' +
      '<div class="mp-contact-card">' +
        '<div class="mp-contact-card__title">Chủ tiệm & Quản lý</div>' +
        hostsHtml +
      '</div>' +
    '</div>';
  }

  // ── Nail multi-service booking form ──────────────────────────────────────────

  function renderNailBookingSection(biz) {
    // Prefer active Firestore services; fall back to full static catalog
    var catalog = (biz.services && biz.services.length > 0)
      ? biz.services
      : (biz._staticServices || []);
    if (!catalog.length) return '';

    // Group by category, preserving insertion order
    var cats = {}, catOrder = [];
    catalog.forEach(function (s) {
      var cat = s.category || 'other';
      if (!cats[cat]) { cats[cat] = []; catOrder.push(cat); }
      cats[cat].push(s);
    });

    var catLabels = {
      manicure: 'Manicure', pedicure: 'Pedicure', gel: 'Gel & Shellac',
      acrylic: 'Acrylic & Extensions', nailart: 'Nail Art',
      spa: 'Spa Treatments', addon: 'Add-ons & Extras', other: 'Other'
    };

    var svcHtml = catOrder.map(function (cat) {
      var label = catLabels[cat] || (cat.charAt(0).toUpperCase() + cat.slice(1));
      var items = cats[cat].map(function (s) {
        var meta = [];
        if (s.durationMins) meta.push(s.durationMins + ' min');
        if (s.price)        meta.push('$' + s.price);
        return '<label class="nb-svc-card">' +
          '<input type="checkbox" class="nb-svc-chk" name="services" value="' + escAttr(s.name) + '" data-mins="' + (s.durationMins || 60) + '">' +
          '<span class="nb-svc-name">' + escHtml(s.name) + '</span>' +
          (meta.length ? '<span class="nb-svc-meta">' + escHtml(meta.join(' · ')) + '</span>' : '') +
        '</label>';
      }).join('');
      return '<div class="nb-cat">' +
        '<div class="nb-cat-label">' + escHtml(label) + '</div>' +
        '<div class="nb-svc-grid">' + items + '</div>' +
      '</div>';
    }).join('');

    var activeStaff = (biz.staff || []).filter(function (m) { return m.active !== false; });
    var staffOpts = '<option value="Any">Bất kỳ (salon sắp xếp)</option>' +
      activeStaff.map(function (m) {
        return '<option value="' + escAttr(m.name) + '">' + escHtml(m.name) + (m.role ? ' — ' + escHtml(m.role) : '') + '</option>';
      }).join('');

    var today = new Date().toISOString().slice(0, 10);

    return '<div class="mp-section" id="nailBookSection_' + biz.id + '">' +
      '<div class="mp-section-hdr"><h2 class="mp-section-title">Đặt Lịch Ngay</h2></div>' +
      '<div class="mp-panel-form">' +
        '<form id="nailBookForm_' + biz.id + '">' +
          '<p class="nb-instruction">Chọn một hoặc nhiều dịch vụ:</p>' +
          '<div id="nbServices_' + biz.id + '">' + svcHtml + '</div>' +
          '<div class="nb-duration-row" id="nbDurRow_' + biz.id + '" style="display:none">' +
            '<span>Tổng thời gian: </span>' +
            '<strong id="nbDurVal_' + biz.id + '">0</strong>' +
            '<span> phút</span>' +
          '</div>' +
          '<div class="mp-form-row">' +
            '<label class="mp-label">Kỹ thuật viên</label>' +
            '<select class="mp-input" id="nbStaff_' + biz.id + '">' + staffOpts + '</select>' +
          '</div>' +
          '<div class="mp-form-row-duo">' +
            '<div class="mp-form-row">' +
              '<label class="mp-label">Ngày hẹn</label>' +
              '<input class="mp-input" type="date" id="nbDate_' + biz.id + '" min="' + today + '" required>' +
            '</div>' +
            '<div class="mp-form-row">' +
              '<label class="mp-label">Giờ hẹn</label>' +
              '<input class="mp-input" type="time" id="nbTime_' + biz.id + '" required>' +
            '</div>' +
          '</div>' +
          '<div class="mp-form-row-duo">' +
            '<div class="mp-form-row">' +
              '<label class="mp-label">Họ & Tên</label>' +
              '<input class="mp-input" type="text" id="nbName_' + biz.id + '" placeholder="Nguyễn Văn A" required>' +
            '</div>' +
            '<div class="mp-form-row">' +
              '<label class="mp-label">Số điện thoại</label>' +
              '<input class="mp-input" type="tel" id="nbPhone_' + biz.id + '" placeholder="(408) 555-0000" required>' +
            '</div>' +
          '</div>' +
          '<div class="mp-form-row">' +
            '<label class="mp-label">Ghi chú (tùy chọn)</label>' +
            '<textarea class="mp-input" id="nbNotes_' + biz.id + '" rows="2" placeholder="Yêu cầu đặc biệt..."></textarea>' +
          '</div>' +
          '<div class="nb-avail-msg" id="nbMsg_' + biz.id + '" style="display:none"></div>' +
          '<button type="submit" class="mp-btn mp-btn--primary mp-btn--full" id="nbSubmit_' + biz.id + '">' + calendarIcon + ' Gửi Đặt Lịch</button>' +
          '<div class="mp-form-success" id="nbSuccess_' + biz.id + '">' +
            checkIcon +
            '<p>Đặt lịch thành công!</p>' +
            '<p style="margin-top:.5rem;font-size:.8rem;color:var(--muted)">Chúng tôi sẽ liên hệ xác nhận sớm nhất.</p>' +
          '</div>' +
        '</form>' +
      '</div>' +
    '</div>';
  }

  function initNailBookingForm(biz) {
    var form       = document.getElementById('nailBookForm_' + biz.id);
    var durRow     = document.getElementById('nbDurRow_' + biz.id);
    var durVal     = document.getElementById('nbDurVal_' + biz.id);
    var msgEl      = document.getElementById('nbMsg_' + biz.id);
    var successDiv = document.getElementById('nbSuccess_' + biz.id);
    var submitBtn  = document.getElementById('nbSubmit_' + biz.id);
    if (!form) return;

    function showMsg(text, isError) {
      if (!msgEl) return;
      msgEl.textContent = text;
      msgEl.className = 'nb-avail-msg' + (isError === false ? ' nb-avail-msg--ok' : '');
      msgEl.style.display = text ? 'block' : 'none';
    }

    // Live duration sum as services are checked/unchecked
    function updateDuration() {
      var total = 0;
      form.querySelectorAll('.nb-svc-chk:checked').forEach(function (chk) {
        total += parseInt(chk.getAttribute('data-mins') || '60', 10);
      });
      if (total > 0 && durVal) {
        durVal.textContent = total;
        if (durRow) durRow.style.display = 'flex';
      } else {
        if (durRow) durRow.style.display = 'none';
      }
    }
    form.querySelectorAll('.nb-svc-chk').forEach(function (chk) {
      chk.addEventListener('change', updateDuration);
    });

    // ── Helper: verify at least one active staff member works on this date/time ───
    // Used for "Any" staff requests. Named staff uses NailAvailabilityChecker.check() directly.
    function _anyStaffOnDuty(biz, dateStr, timeStr, durationMins) {
      var DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
      var DAY3 = { sunday:'sun', monday:'mon', tuesday:'tue', wednesday:'wed', thursday:'thu', friday:'fri', saturday:'sat' };
      function _m(t) {
        if (!t || typeof t !== 'string') return 0;
        var p = t.split(':');
        return parseInt(p[0] || '0', 10) * 60 + parseInt(p[1] || '0', 10);
      }
      var d = new Date(dateStr + 'T12:00:00');
      var day = DAYS[d.getDay()];
      var reqStart = _m(timeStr);
      var reqEnd   = reqStart + (durationMins || 60);
      var activeStaff = (biz.staff || []).filter(function (m) { return m.active !== false; });
      if (!activeStaff.length) return false;
      return activeStaff.some(function (m) {
        var sch   = m.schedule || {};
        var shift = sch[day] || sch[DAY3[day]];
        if (!shift) return false;
        if (shift.active === false || shift.closed === true) return false;
        // If shift has no time bounds, treat the day as open
        var openT  = shift.open  || shift.start;
        var closeT = shift.close || shift.end;
        if (!openT && !closeT) return true;
        var shiftOpen  = _m(openT  || '09:00');
        var shiftClose = _m(closeT || '19:30');
        return reqStart >= shiftOpen && reqEnd <= shiftClose;
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var selectedServices = [];
      var totalMins = 0;
      form.querySelectorAll('.nb-svc-chk:checked').forEach(function (chk) {
        selectedServices.push(chk.value);
        totalMins += parseInt(chk.getAttribute('data-mins') || '60', 10);
      });

      if (!selectedServices.length) { showMsg('Vui lòng chọn ít nhất một dịch vụ.', true); return; }

      var staff    = (document.getElementById('nbStaff_' + biz.id) || {}).value || 'Any';
      var date     = (document.getElementById('nbDate_' + biz.id) || {}).value || '';
      var time     = (document.getElementById('nbTime_' + biz.id) || {}).value || '';
      var name     = ((document.getElementById('nbName_' + biz.id) || {}).value || '').trim();
      var phone    = ((document.getElementById('nbPhone_' + biz.id) || {}).value || '').trim();
      var notesEl    = document.getElementById('nbNotes_' + biz.id);
      var notes      = notesEl ? notesEl.value.trim() : '';
      var photoUrlEl = document.getElementById('nbPhotoUrl_' + biz.id);
      var photoUrl   = photoUrlEl ? photoUrlEl.value.trim() : '';

      if (!date || !time || !name || !phone) { showMsg('Vui lòng điền đầy đủ thông tin.', true); return; }

      showMsg('', true);
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Đang kiểm tra...'; }

      var db = window.dlcDb;
      if (!db) {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = calendarIcon + ' Gửi Đặt Lịch'; }
        showMsg('Vui lòng gọi trực tiếp: ' + (biz.phoneDisplay || biz.phone || ''), true);
        return;
      }

      var escId    = 'esc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      var durLabel = totalMins >= 60
        ? Math.floor(totalMins / 60) + 'h' + (totalMins % 60 ? (totalMins % 60) + 'm' : '')
        : totalMins + ' min';
      var isAny    = !staff || staff.toLowerCase() === 'any';

      // ── Shared validation — same logic as AI booking flow ───────────────────────
      function _doWrite() {
        if (submitBtn) submitBtn.textContent = 'Đang gửi...';
        db.collection('escalations').doc(escId).set({
          vendorId:        biz.id || '',
          vendorName:      biz.name || '',
          escalationType:  'appointment',
          source:          'booking_form',
          appointmentData: {
            services:             selectedServices,
            totalDurationMins:    totalMins,
            staff:                staff,
            date:                 date,
            time:                 time,
            name:                 name,
            phone:                phone,
            notes:                notes,
            inspirationPhotoUrl:  photoUrl || null,
            lang:                 'en'
          },
          summary:        name + ' — ' + selectedServices.join(', ') + ' (' + durLabel + ') on ' + date + ' at ' + time + ' with ' + staff,
          status:         'pending_vendor_response',
          vendorMessage:  null,
          lang:           'en',
          createdAt:      firebase.firestore.FieldValue.serverTimestamp()
        }).then(function () {
          if (form) form.style.display = 'none';
          if (successDiv) successDiv.classList.add('show');
        }).catch(function () {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = calendarIcon + ' Gửi Đặt Lịch'; }
          showMsg('Có lỗi xảy ra. Vui lòng gọi: ' + (biz.phoneDisplay || biz.phone || ''), true);
        });
      }

      function _blockWith(msg) {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = calendarIcon + ' Gửi Đặt Lịch'; }
        showMsg(msg || 'Thời gian này không còn trống. Vui lòng chọn thời gian khác.', true);
      }

      var checker = window.NailAvailabilityChecker;
      if (!checker) {
        // Checker not ready (receptionist.js not loaded) — fail-open, same as AI Firestore error
        _doWrite();
        return;
      }

      var draft = {
        services:          selectedServices,
        staff:             staff,
        date:              date,
        time:              time,
        totalDurationMins: totalMins,
        name:              name,
        phone:             phone
      };

      checker.check(biz, draft)
        .then(function (avail) {
          if (!avail.valid) {
            _blockWith(avail.message);
            return;
          }
          // For "Any" staff: additionally verify at least one tech works that day/time.
          // Named staff conflicts are fully handled by NailAvailabilityChecker.check() above.
          if (isAny && !_anyStaffOnDuty(biz, date, time, totalMins)) {
            _blockWith('No technicians are available at that time. Please choose a different date or time.');
            return;
          }
          _doWrite();
        })
        .catch(function () {
          // Fail-open: never block a valid customer due to a Firestore query error
          _doWrite();
        });
    });
  }

  // ── Salon Vendor Detail Page ──────────────────────────────────────────────────

  function renderSalonVendorDetail(biz) {
    var backUrl = window.location.pathname;
    _container.innerHTML =
      renderAppBar(backUrl, 'Danh sách', biz.name, biz.phone) +
      '<div class="mp-fv-loading">' +
        '<div class="mp-fv-spinner"></div>' +
        '<p>Đang tải dịch vụ...</p>' +
      '</div>';

    if (window.dlcDb) {
      loadSalonVendorFirestore(biz, function (mergedBiz) {
        _renderSalonDetailContent(mergedBiz, backUrl);
      });
    } else {
      _renderSalonDetailContent(biz, backUrl);
    }
  }

  // Convert vendor-admin hoursSchedule {mon:{open,close,closed},...} → display hours {label: 'H AM – H PM'}
  function _hoursScheduleToHours(hs) {
    var keys      = ['mon','tue','wed','thu','fri','sat','sun'];
    var labels    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    function fmt(t) {
      if (!t) return '';
      var p = t.split(':'), h = +p[0], m = +p[1];
      var ap = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12;
      return h + (m ? ':' + (m < 10 ? '0' : '') + m : '') + ' ' + ap;
    }
    var result = {};
    keys.forEach(function (k, i) {
      var d = hs[k];
      if (!d) return;
      result[labels[i]] = d.closed ? 'Closed' : (fmt(d.open) + ' – ' + fmt(d.close));
    });
    return Object.keys(result).length ? result : null;
  }

  function loadSalonVendorFirestore(biz, callback) {
    var db = window.dlcDb;
    var vendorRef = db.collection('vendors').doc(biz.id);

    vendorRef.get().then(function (vendorDoc) {
      // Start from a shallow copy of the static biz object
      var merged = {};
      for (var k in biz) { if (Object.prototype.hasOwnProperty.call(biz, k)) merged[k] = biz[k]; }

      // Save full static service catalog as AI knowledge base.
      // Used when Firestore has no active services configured yet — AI still knows service types/durations.
      merged._staticServices = biz.services ? biz.services.slice() : [];

      if (vendorDoc.exists) {
        var vd = vendorDoc.data();
        if (vd.businessName)             merged.name        = vd.businessName;
        if (vd.phoneDisplay)             merged.phoneDisplay = vd.phoneDisplay;
        if (vd.phone)                    merged.phone        = vd.phone;
        if (vd.address)                  merged.address      = vd.address;
        if (vd.description)              merged.description  = vd.description;
        if (vd.heroImage)                merged.heroImage    = vd.heroImage;
        if (vd.active === false)         merged.active       = false;
        // Map hoursSchedule (vendor-admin format) → biz.hours (display format)
        // This ensures hours saved in vendor-admin appear on public page + AI
        if (vd.hoursSchedule) {
          var mapped = _hoursScheduleToHours(vd.hoursSchedule);
          if (mapped) merged.hours = mapped;
        }
      }

      // ── Load services + staff in parallel ─────────────────────────────────────
      // Both subcollections are authoritative: vendor-admin writes here, public page reads here.
      Promise.all([
        vendorRef.collection('services').where('active', '==', true).get(),
        vendorRef.collection('staff').get()
      ]).then(function (results) {
        var svcSnap   = results[0];
        var staffSnap = results[1];

        // ── SERVICES ────────────────────────────────────────────────────────────
        if (!svcSnap.empty) {
          var svcs = [];
          svcSnap.forEach(function (d) {
            var s = d.data();
            svcs.push({
              id:            d.id,
              name:          s.name          || '',
              category:      s.category      || '',
              price:         s.price         || '',
              priceFrom:     s.priceFrom     || 0,
              duration:      s.duration      || '',
              durationMins:  s.durationMins  || 0,
              desc:          s.desc          || '',
              imageUrl:      s.imageUrl      || '',
              assignedStaff: s.assignedStaff || [],
              active:        true,
              sortOrder:     s.sortOrder     || 0,
              featured:      s.featured === true
            });
          });
          svcs.sort(function (a, b) { return a.sortOrder - b.sortOrder; });
          merged.services = svcs;
        } else {
          // No active services enabled yet — show empty list, not the disabled static catalog
          merged.services = [];
        }

        // ── STAFF ────────────────────────────────────────────────────────────────
        // Firestore staff subcollection is the authoritative source.
        // Vendor-admin saves here; public page + AI must read from here.
        if (!staffSnap.empty) {
          var staffArr = [];
          staffSnap.forEach(function (d) {
            var s = d.data();
            staffArr.push({
              id:               d.id,
              name:             s.name             || '',
              role:             s.role             || 'Nail Tech',
              specialties:      s.specialties      || [],
              assignedServices: s.assignedServices || [],
              schedule:         s.schedule         || {},
              active:           s.active !== false,
              sortOrder:        s.sortOrder        || 0
            });
          });
          staffArr.sort(function (a, b) { return a.sortOrder - b.sortOrder; });
          merged.staff = staffArr;
        }
        // If Firestore staff subcollection is empty, keep static biz.staff as last-resort fallback

        callback(merged);
      }).catch(function (err) {
        console.warn('[DLC] salon Firestore load error:', err);
        callback(merged);
      });
    }).catch(function () { callback(biz); });
  }

  function _renderSalonDetailContent(biz, backUrl) {
    var isNails = biz.category === 'nails';
    var html;

    if (isNails) {
      // Premium nails redesign — stacked full-width sections
      // Order: Hero → InfoStrip → Promo → Featured → Booking → Trust → AI → Inspiration Gallery
      html =
        renderSalonBar(biz) +
        '<main class="mp-main mp-main--nails">' +
          renderNailsHero(biz) +
          renderInfoStrip(biz) +
          renderNailsPromoSlot(biz) +
          renderNailsFeatured(biz) +
          '<div class="ns-divider"></div>' +
          renderNailsBookingSection(biz) +
          '<div class="ns-divider"></div>' +
          renderNailsTrust(biz) +
          '<div class="ns-divider"></div>' +
          '<div class="ns-ai-section">' + renderAiSection(biz) + '</div>' +
          renderNailsInspiration() +
          '<div class="mp-spacer"></div>' +
        '</main>' +
        renderInterpPanel(biz) +
        renderVendorBottomNav(biz);
    } else {
      // Standard hair/other salon 2-column layout
      html =
        renderSalonBar(biz) +
        '<main class="mp-main">' +
          renderDetailHero(biz) +
          renderInfoStrip(biz) +
          '<div class="mp-detail-body">' +
            '<div class="mp-detail-col mp-detail-col--left">' +
              renderServicesSection(biz) +
              renderHoursSection(biz) +
            '</div>' +
            '<div class="mp-detail-col mp-detail-col--right">' +
              (biz.bookingEnabled ? renderBookingSection(biz) : '') +
              renderAiSection(biz) +
            '</div>' +
          '</div>' +
          '<div class="mp-spacer"></div>' +
        '</main>' +
        renderInterpPanel(biz) +
        renderVendorBottomNav(biz);
    }

    _container.innerHTML = html;

    if (isNails) {
      initNailBookingForm(biz);
      _initNsCatHc(biz.id);
      _initNsFeatHc(biz.id);
    } else if (biz.bookingEnabled) {
      initBookingForm(biz);
    }

    if (biz.aiReceptionist && biz.aiReceptionist.enabled) {
      var _R = (window.LilyReceptionist && biz.id === 'luxurious-nails')
        ? window.LilyReceptionist
        : Receptionist;
      _R.init(biz, 'aiWidget_' + biz.id);
    }

    _initVendorNav(biz);

    // For nails: override the generic scrollBook (targets bookingSection_) with nails-specific target
    if (isNails && window._vnav) {
      window._vnav.scrollBook = function () {
        var el = document.getElementById('nailBookSection_' + biz.id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
    }
  }

  // ── Food Vendor Detail Page ────────────────────────────────────────────────────

  // Public entry point — shows loading state, then fetches Firestore data if available
  function renderFoodVendorDetail(biz) {
    var backUrl = window.location.pathname;

    // Immediate skeleton so the page isn't blank
    _container.innerHTML =
      renderAppBar(backUrl, 'Danh sách', biz.name, biz.phone) +
      '<div class="mp-fv-loading">' +
        '<div class="mp-fv-spinner"></div>' +
        '<p>Đang tải thực đơn...</p>' +
      '</div>';

    if (window.dlcDb) {
      loadFoodVendorFirestore(biz, function (mergedBiz) {
        _renderFoodVendorContent(mergedBiz);
      });
    } else {
      _renderFoodVendorContent(biz);
    }
  }

  // Fetch vendor doc + menuItems subcollection from Firestore and merge with static data
  function loadFoodVendorFirestore(biz, callback) {
    var db = window.dlcDb;
    var vendorRef = db.collection('vendors').doc(biz.id);

    vendorRef.get().then(function (vendorDoc) {
      // Start from a shallow copy of the static biz object
      var merged = {};
      for (var k in biz) { if (Object.prototype.hasOwnProperty.call(biz, k)) merged[k] = biz[k]; }

      if (vendorDoc.exists) {
        var vd = vendorDoc.data();
        if (vd.businessName)             merged.name                 = vd.businessName;
        if (vd.phoneDisplay)             merged.phoneDisplay         = vd.phoneDisplay;
        if (vd.phone)                    merged.phone                = vd.phone;
        if (vd.address)                  merged.address              = vd.address;
        if (vd.description)              merged.description          = vd.description;
        if (vd.heroImage)                merged.heroImage            = vd.heroImage;
        if (vd.heroImagePositionX != null) merged.heroImagePositionX = vd.heroImagePositionX;
        if (vd.heroImagePositionY != null) merged.heroImagePositionY = vd.heroImagePositionY;
        if (vd.active === false)         merged.active               = false;
        if (vd.defaultDailyCapacity != null) merged.defaultDailyCapacity = Number(vd.defaultDailyCapacity);
      }

      // Build a lookup of static product images so Firestore items with image:''
      // (from canonical seed data) can still show the static fallback image.
      // Keyed by product id / canonicalId (both are 'eggroll', 'chuoi-dau-nau-oc', etc.)
      var staticProdMap = {};
      (biz.products || []).forEach(function(p) {
        if (p.id) staticProdMap[p.id] = p;
      });

      // Load menu items (no compound index required — filter client-side)
      vendorRef.collection('menuItems').get().then(function (snap) {
        if (!snap.empty) {
          var items = [];
          snap.forEach(function (d) {
            var item = d.data();
            if (item.active === false) return;   // skip inactive

            // Normalize variants → {id, label, labelEn, imageUrl, price}[]
            // Supports legacy string[], old {id,label} objects, and new {key,label,imageUrl,price} objects
            var variants = (item.variants || []).map(function (v, i) {
              if (v && typeof v === 'object') {
                var id  = v.id || v.key || ('v' + i);
                // Support both label (legacy) and name (new API-compat field)
                var lbl = v.label || v.name || v.labelEn || String(v);
                var vPrice = (v.price != null && !isNaN(Number(v.price))) ? Number(v.price) : null;
                // Support both imageUrl (camelCase) and image_url (snake_case)
                var vImg = v.imageUrl || v.image_url || '';
                return { id: id, label: lbl, labelEn: lbl, imageUrl: vImg, price: vPrice };
              }
              var s    = String(v || '');
              var slug = s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || ('v' + i);
              return { id: slug, label: s, labelEn: s, imageUrl: '', price: null };
            });

            // Image fallback: Firestore item.image → item.imageUrl → matching static product image
            // Canonical seed items are seeded with image:'' — this ensures the static photo still shows
            // until the vendor uploads their own via vendor-admin.
            var staticMatch = staticProdMap[item.canonicalId] || staticProdMap[d.id] || null;
            var resolvedImage = item.image || item.imageUrl ||
                                (staticMatch && staticMatch.image ? staticMatch.image : '') || '';

            items.push({
              id: d.id,
              name: item.name || '',
              displayNameVi: item.displayNameVi || '',
              nameEn: item.nameEn || item.name || '',
              variants: variants,
              pricePerUnit: Number(item.price != null ? item.price : item.pricePerUnit) || 0,
              unit: item.unit || 'each',
              unitEn: item.unit || 'each',
              minimumOrderQty: item.minimumOrderQty || 30,
              // Image: Firestore upload URL → static fallback (see resolvedImage above)
              image: resolvedImage,
              imagePositionX: item.imagePositionX != null ? item.imagePositionX : 50,
              imagePositionY: item.imagePositionY != null ? item.imagePositionY : 50,
              videoUrl: item.videoUrl || null,
              tags: item.tags || [],
              shortDescription: item.shortDescription || '',
              description: item.description || '',
              active: true,
              featured: !!item.featured,
              sortOrder: item.sortOrder || 0,
              preparationInstructions: item.preparationInstructions || '',
              reheatingInstructions:   item.reheatingInstructions   || '',
              storageInstructions:     item.storageInstructions      || '',
              servingNotes:            item.servingNotes             || '',
              allergenNotes:           item.allergenNotes            || ''
            });
          });

          items.sort(function (a, b) { return a.sortOrder - b.sortOrder; });

          if (items.length > 0) {
            // Preserve the richer static product list so _askClaude can use it
            // even after Firestore items replace merged.products
            merged._staticProducts = (biz.products || []).slice();
            merged.products = items;

            // Refresh AI system prompt with live menu data
            if (merged.aiReceptionist) {
              var menuLines = items.map(function (it) {
                var line = it.name + ': $' + it.pricePerUnit.toFixed(2) + '/each, min ' + it.minimumOrderQty;
                if (it.preparationInstructions) line += '; how to cook: ' + it.preparationInstructions;
                if (it.reheatingInstructions)   line += '; how to reheat: ' + it.reheatingInstructions;
                if (it.storageInstructions)      line += '; storage: ' + it.storageInstructions;
                if (it.servingNotes)             line += '; serving: ' + it.servingNotes;
                if (it.allergenNotes)            line += '; allergens: ' + it.allergenNotes;
                return line;
              }).join(' | ');
              merged.aiReceptionist = {};
              for (var ak in biz.aiReceptionist) {
                if (Object.prototype.hasOwnProperty.call(biz.aiReceptionist, ak)) {
                  merged.aiReceptionist[ak] = biz.aiReceptionist[ak];
                }
              }
              merged.aiReceptionist.systemExtra =
                'You are the AI receptionist for ' + merged.name + ' in ' + merged.city + ' Bay Area. ' +
                'Contact: ' + (merged.hosts && merged.hosts[0] ? merged.hosts[0].name : 'Loan') + ' at ' + merged.phoneDisplay + '. ' +
                'Address: ' + merged.address + '. ' +
                'Current menu: ' + menuLines + '. ' +
                'Variants per item (if any) are listed as product options such as Raw or Fresh. ' +
                'Be warm and helpful. Answer in the same language as the customer (Vietnamese or English).';
            }
          }
        }

        callback(merged);
      }).catch(function (err) {
        console.warn('[DLC] menuItems load error:', err.message);
        callback(merged);
      });
    }).catch(function (err) {
      console.warn('[DLC] vendor load error:', err.message);
      callback(biz);
    });
  }

  // Internal renderer — called after Firestore data is ready (or on fallback)
  function _renderFoodVendorContent(biz) {
    var backUrl = window.location.pathname;

    var html =
      renderSalonBar(biz) +
      '<main class="mp-main">' +
        renderFoodVendorHero(biz) +
        renderInfoStrip(biz) +
        '<div class="mp-detail-body">' +
          '<div class="mp-detail-col mp-detail-col--left">' +
            renderProductsSection(biz) +
            renderFoodVendorAbout(biz) +
          '</div>' +
          '<div class="mp-detail-col mp-detail-col--right">' +
            renderOrderInquirySection(biz) +
            renderAiSection(biz) +
          '</div>' +
        '</div>' +
        '<div class="mp-spacer"></div>' +
      '</main>' +
      renderInterpPanel(biz) +
      renderVendorBottomNav(biz);

    _container.innerHTML = html;

    if (biz.orderEnabled) {
      initOrderInquiryForm(biz);
    }

    if (biz.aiReceptionist && biz.aiReceptionist.enabled) {
      Receptionist.init(biz, 'aiWidget_' + biz.id);
    }

    _initVendorNav(biz);
  }

  function renderFoodVendorHero(biz) {
    var posX = biz.heroImagePositionX != null ? biz.heroImagePositionX : 50;
    var posY = biz.heroImagePositionY != null ? biz.heroImagePositionY : 50;
    var bgStyle = biz.heroImage
      ? 'background-image:url(' + escAttr(biz.heroImage) + ');background-size:cover;background-position:' + posX + '% ' + posY + '%;'
      : 'background:' + biz.heroGradient + ';';

    return '<div class="mp-detail-hero mp-food-hero">' +
      '<div class="mp-detail-hero__bg" style="' + bgStyle + '"></div>' +
      '<div class="mp-food-hero__overlay"></div>' +
      '<div class="mp-detail-hero__content">' +
        '<div class="mp-detail-hero__region">' + escHtml(biz.region) + ' · ' + escHtml(biz.city) + '</div>' +
        '<h1 class="mp-detail-hero__name">' + escHtml(biz.name) + '</h1>' +
        '<p class="mp-detail-hero__tagline">' + escHtml(biz.tagline) + '</p>' +
        '<div style="display:flex;gap:.5rem;margin-top:1.1rem;flex-wrap:wrap;">' +
          '<button class="mp-btn mp-btn--primary" onclick="document.getElementById(\'orderSection_' + biz.id + '\').scrollIntoView({behavior:\'smooth\'})">' +
            calendarIcon + 'Đặt Đơn Ngay' +
          '</button>' +
          '<a href="tel:' + biz.phone + '" class="mp-btn mp-btn--ghost">' +
            phoneIcon + escHtml(biz.phoneDisplay) +
          '</a>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function renderFoodVendorAbout(biz) {
    return '<div class="mp-section">' +
      '<div class="mp-section-hdr">' +
        '<h2 class="mp-section-title">Về Chúng Tôi</h2>' +
      '</div>' +
      '<p class="mp-about-prose">' + escHtml(biz.description) + '</p>' +
    '</div>';
  }

  function buildInstructionsHtml(product) {
    var rows = [
      { key: 'preparationInstructions', icon: '🍳', label: 'Cách Chế Biến' },
      { key: 'reheatingInstructions',   icon: '♨️', label: 'Hâm Nóng'      },
      { key: 'storageInstructions',     icon: '🧊', label: 'Bảo Quản'       },
      { key: 'servingNotes',            icon: '🍽️', label: 'Ghi Chú'        },
      { key: 'allergenNotes',           icon: '⚠️', label: 'Thành Phần'     },
    ].filter(function (r) { return product[r.key]; })
     .map(function (r) {
       return '<div class="mp-instr-row">' +
         '<span class="mp-instr-icon">' + r.icon + '</span>' +
         '<div>' +
           '<div class="mp-instr-label">' + r.label + '</div>' +
           '<div class="mp-instr-text">'  + escHtml(product[r.key]) + '</div>' +
         '</div>' +
       '</div>';
     });
    if (!rows.length) return '';
    return '<details class="mp-instr-details">' +
      '<summary class="mp-instr-summary">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="mp-instr-summary__chevron"><polyline points="6 9 12 15 18 9"/></svg>' +
        'Hướng Dẫn Sử Dụng' +
      '</summary>' +
      '<div class="mp-instr-block">' + rows.join('') + '</div>' +
    '</details>';
  }

  function renderProductsSection(biz) {
    if (!biz.products || biz.products.length === 0) return '';

    var productsHtml = biz.products.filter(function (p) { return p.active; }).map(function (product) {
      var variantsHtml = (product.variants || []).map(function (v) {
        var imgAttr = v.imageUrl
          ? ' data-img="' + escAttr(v.imageUrl) + '" data-prod="' + escAttr(product.id) + '" ' +
            'onclick="dlcSwapVariantImg(this)" style="cursor:pointer" title="' + escAttr(v.labelEn) + '"'
          : '';
        var vPriceHtml = (v.price != null && v.price > 0)
          ? ' <span class="mp-product__variant-price">$' + v.price.toFixed(2) + '</span>'
          : '';
        return '<span class="mp-product__variant"' + imgAttr + '>' + escHtml(v.labelEn) + vPriceHtml + '</span>';
      }).join('');

      // ISSUE 2 FIX: Display variant prices as "$X.XX (raw) / $Y.YY (fresh)" when available.
      // Falls back to base pricePerUnit when no variant prices are set.
      var variantsWithPrice = (product.variants || []).filter(function(v) {
        return v.price != null && v.price > 0;
      });
      var effectivePrice = product.pricePerUnit; // used for minTotal calculation
      var priceStr;
      if (variantsWithPrice.length > 1) {
        // Multiple variants with prices: show as "$0.75 (raw) / $1.25 (fresh)"
        priceStr = variantsWithPrice.map(function(v) {
          var shortLabel = (v.labelEn || '').split(/[\s\u2014\-]+/)[0].toLowerCase();
          return '$' + v.price.toFixed(2) + ' (' + escHtml(shortLabel) + ')';
        }).join(' / ');
        // Use the lowest variant price for minTotal estimate
        effectivePrice = variantsWithPrice.reduce(function(mn, v) { return Math.min(mn, v.price); }, Infinity);
      } else if (variantsWithPrice.length === 1) {
        priceStr = '$' + variantsWithPrice[0].price.toFixed(2) + ' / ' + escHtml(product.unitEn);
        effectivePrice = variantsWithPrice[0].price;
      } else {
        priceStr = '$' + product.pricePerUnit.toFixed(2) + ' / ' + escHtml(product.unitEn);
      }
      var minTotal = '$' + (effectivePrice * product.minimumOrderQty).toFixed(2);

      // object-position drives the focal point set in vendor-admin
      var posX  = (product.imagePositionX != null ? product.imagePositionX : 50) + '%';
      var posY  = (product.imagePositionY != null ? product.imagePositionY : 50) + '%';
      var imgPos = 'object-position:' + posX + ' ' + posY + ';';

      // Default display image: item.image first; fall back to first variant that has imageUrl
      var defaultImg = product.image || '';
      if (!defaultImg) {
        var firstVariantWithImg = (product.variants || []).find(function (v) { return v.imageUrl; });
        if (firstVariantWithImg) defaultImg = firstVariantWithImg.imageUrl;
      }

      // Build variant image map as JSON for JS-driven image swapping
      var varImgMap = {};
      (product.variants || []).forEach(function (v) {
        if (v.imageUrl) varImgMap[v.id] = v.imageUrl;
      });
      var hasVariantImgs = Object.keys(varImgMap).length > 0;

      // Reusable SVG image-placeholder icon (no emoji, per design guidelines)
      var _phIcon =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" class="mp-product-img-placeholder__icon">' +
          '<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>' +
          '<circle cx="12" cy="13" r="4"/>' +
        '</svg>';
      var _ph =
        '<div class="mp-product-img-placeholder" id="pcard-ph-' + escAttr(product.id) + '">' +
          _phIcon +
          '<span class="mp-product-img-placeholder__text">Ảnh chưa có</span>' +
        '</div>';

      var mediaHtml = '';
      if (product.videoUrl) {
        // Click-to-play: inline preview (muted/loop) + click opens unmuted modal
        mediaHtml =
          '<div class="mp-product-card__media-wrap mp-product-card__media-wrap--video" ' +
            'onclick="dlcOpenVideoModal(\'' + escAttr(product.videoUrl) + '\',\'' + escAttr(product.nameEn || product.name) + '\')" ' +
            'title="Nhấn để xem video">' +
            '<video class="mp-product-card__promo-video" autoplay muted loop playsinline ' +
              'style="' + imgPos + '" ' +
              'poster="' + escAttr(defaultImg) + '">' +
              '<source src="' + escAttr(product.videoUrl) + '" type="video/mp4">' +
            '</video>' +
            '<span class="mp-product-card__video-badge">▶ Xem Video</span>' +
          '</div>';
      } else if (defaultImg) {
        // Image exists: render it + hidden placeholder; onerror swaps them
        var pendingBadge = (product.videoStatus === 'pending')
          ? '<span class="mp-product-card__video-pending">&#127902; Promo Video Coming</span>'
          : '';
        mediaHtml =
          '<div class="mp-product-card__media-wrap" id="pcard-media-' + escAttr(product.id) + '">' +
            '<img class="mp-product-card__img" ' +
              'id="pcard-img-' + escAttr(product.id) + '" ' +
              'src="' + escAttr(defaultImg) + '" ' +
              'style="' + imgPos + '" ' +
              'alt="' + escAttr(product.nameEn || product.name) + '" loading="lazy" ' +
              'onerror="this.style.display=\'none\';var ph=document.getElementById(\'pcard-ph-' + escAttr(product.id) + '\');if(ph)ph.style.display=\'flex\'">' +
            _ph.replace('id="pcard-ph-' + escAttr(product.id) + '"',
                        'id="pcard-ph-' + escAttr(product.id) + '" style="display:none"') +
            pendingBadge +
          '</div>';
      } else {
        // No image URL — show placeholder immediately
        mediaHtml =
          '<div class="mp-product-card__media-wrap">' +
            _ph +
          '</div>';
      }
      var imgHtml = mediaHtml; // keep variable name for compatibility below

      // Encode variant→image map as data attribute for JS swapping in order form
      var varImgAttr = hasVariantImgs
        ? ' data-var-images="' + escAttr(JSON.stringify(varImgMap)) + '" data-default-img="' + escAttr(defaultImg) + '"'
        : '';

      // Tags: shown when the product has tags defined
      var tagsHtml = (product.tags && product.tags.length > 0)
        ? '<div class="mp-product-tags">' +
            product.tags.map(function (t) {
              return '<span class="mp-product-tag">' + escHtml(t) + '</span>';
            }).join('') +
          '</div>'
        : '';

      // Min-order line: skip when minimumOrderQty === 1 (per-serving dish)
      var minOrderHtml = product.minimumOrderQty > 1
        ? '<div class="mp-product-card__minorder">' +
            'Min. order: <strong>' + product.minimumOrderQty + ' ' + escHtml(product.unitEn) + (product.minimumOrderQty > 1 ? 's' : '') + '</strong>' +
            ' &nbsp;·&nbsp; ' + minTotal + ' minimum' +
          '</div>'
        : '';

      var instrHtml = buildInstructionsHtml(product);

      return '<div class="mp-product-card" data-product-id="' + escAttr(product.id) + '"' + varImgAttr + '>' +
        imgHtml +
        '<div class="mp-product-card__body">' +
          '<div class="mp-product-card__name">' + escHtml(product.name) + '</div>' +
          tagsHtml +
          '<p class="mp-product-card__desc">' + escHtml(product.description) + '</p>' +
          (variantsHtml ? '<div class="mp-product-card__variants">' + variantsHtml + '</div>' : '') +
          '<div class="mp-product-card__pricing">' +
            '<div class="mp-product-card__price">' + priceStr + '</div>' +
            minOrderHtml +
          '</div>' +
          instrHtml +
        '</div>' +
      '</div>';
    }).join('');

    return '<div class="mp-section">' +
      '<div class="mp-section-hdr">' +
        '<h2 class="mp-section-title">Thực Đơn & Giá</h2>' +
      '</div>' +
      '<div class="mp-products-list">' + productsHtml + '</div>' +
    '</div>';
  }

  function renderOrderInquirySection(biz) {
    if (!biz.orderEnabled || !biz.products || biz.products.length === 0) return '';

    var activeProducts = biz.products.filter(function (p) { return p.active; });
    var firstProduct = activeProducts[0] || null;
    var minQty = firstProduct ? firstProduct.minimumOrderQty : 30;
    var pricePerUnit = firstProduct ? firstProduct.pricePerUnit : 0.50;
    var minTotal = '$' + (pricePerUnit * minQty).toFixed(2);

    var itemOpts = activeProducts.map(function (p) {
      return '<option value="' + escAttr(p.id) + '" data-price="' + p.pricePerUnit + '" data-min="' + p.minimumOrderQty + '">' +
        escHtml(p.name) +
      '</option>';
    }).join('');

    var firstVariants = (firstProduct && firstProduct.variants) ? firstProduct.variants : [];
    var variantOpts = firstVariants.map(function (v) {
      var priceAttr = (v.price != null && v.price > 0) ? ' data-price="' + v.price + '"' : '';
      return '<option value="' + escAttr(v.id) + '" data-img="' + escAttr(v.imageUrl || '') + '"' + priceAttr + '>' + escHtml(v.labelEn) + '</option>';
    }).join('');
    // Hide variant row initially if first product has no variants
    var variantRowStyle = firstVariants.length === 0 ? ' style="display:none"' : '';

    return '<div class="mp-section" id="orderSection_' + biz.id + '">' +
      '<div class="mp-section-hdr">' +
        '<h2 class="mp-section-title">Đặt Hàng</h2>' +
      '</div>' +
      '<div class="mp-panel-form">' +
        '<p class="mp-form-note" style="margin-bottom:1rem">Điền thông tin để đặt hàng — chúng tôi sẽ xác nhận qua điện thoại. ' +
          (activeProducts.length === 1 && minQty > 1
            ? '<strong style="color:var(--gold-lt)">Tối thiểu ' + minQty + ' ' + escHtml((firstProduct && firstProduct.unit) || 'phần') + ' (' + minTotal + ').</strong>'
            : '<strong style="color:var(--gold-lt)">Chọn sản phẩm để xem giá.</strong>') +
        '</p>' +
        '<form id="orderForm_' + biz.id + '" class="mp-booking-form">' +
          '<input type="hidden" name="_subject" value="Order Inquiry — ' + escAttr(biz.name) + '">' +
          '<input type="hidden" name="business" value="' + escAttr(biz.name) + '">' +
          '<input type="hidden" name="business_phone" value="' + escAttr(biz.phoneDisplay) + '">' +
          '<div class="mp-form-row-duo">' +
            '<div class="mp-form-row">' +
              '<label class="mp-label" for="ofName_' + biz.id + '">Your Name</label>' +
              '<input class="mp-input" type="text" id="ofName_' + biz.id + '" name="customer_name" placeholder="Full name" required>' +
            '</div>' +
            '<div class="mp-form-row">' +
              '<label class="mp-label" for="ofPhone_' + biz.id + '">Phone Number</label>' +
              '<input class="mp-input" type="tel" id="ofPhone_' + biz.id + '" name="customer_phone" placeholder="(408) 555-0000" required>' +
            '</div>' +
          '</div>' +
          '<div class="mp-form-row">' +
            '<label class="mp-label" for="ofItem_' + biz.id + '">Item</label>' +
            '<select class="mp-input" id="ofItem_' + biz.id + '" name="item" required>' +
              '<option value="">— Select item —</option>' +
              itemOpts +
            '</select>' +
          '</div>' +
          '<div class="mp-form-row" id="ofVariantRow_' + biz.id + '"' + variantRowStyle + '>' +
            '<label class="mp-label" for="ofVariant_' + biz.id + '">Type</label>' +
            '<select class="mp-input" id="ofVariant_' + biz.id + '" name="variant"' + (firstVariants.length > 0 ? ' required' : '') + '>' +
              '<option value="">— Select type —</option>' +
              variantOpts +
            '</select>' +
          '</div>' +
          '<div class="mp-form-row">' +
            '<label class="mp-label" for="ofQty_' + biz.id + '">' +
              'Quantity <span class="mp-minorder-badge">Min. ' + minQty + '</span>' +
            '</label>' +
            '<input class="mp-input" type="number" id="ofQty_' + biz.id + '" name="quantity" ' +
              'min="' + minQty + '" step="1" placeholder="' + minQty + '" required ' +
              'data-price="' + pricePerUnit + '" data-min="' + minQty + '">' +
            '<div class="mp-minorder-warn" id="ofMinWarn_' + biz.id + '">' +
              'Minimum order is ' + minQty + ' pieces.' +
            '</div>' +
            '<div class="mp-subtotal" id="ofSubtotal_' + biz.id + '">' +
              'Estimated total: <strong id="ofSubtotalAmt_' + biz.id + '"></strong>' +
            '</div>' +
          '</div>' +
          '<div class="mp-form-row">' +
            '<label class="mp-label" for="ofDate_' + biz.id + '">Requested Date *</label>' +
            '<input class="mp-input" type="date" id="ofDate_' + biz.id + '" name="requested_date" ' +
              'min="' + _fmtDate(new Date()) + '" required>' +
            '<div class="mp-capacity-info" id="ofCap_' + biz.id + '" style="display:none"></div>' +
          '</div>' +
          '<div class="mp-form-row">' +
            '<label class="mp-label" for="ofDelivery_' + biz.id + '">Pickup / Delivery</label>' +
            '<select class="mp-input" id="ofDelivery_' + biz.id + '" name="pickup_delivery">' +
              '<option value="pickup">Pickup at vendor address</option>' +
              '<option value="delivery">Delivery (discuss with vendor)</option>' +
            '</select>' +
          '</div>' +
          '<div class="mp-form-row">' +
            '<label class="mp-label" for="ofNotes_' + biz.id + '">Notes (optional)</label>' +
            '<textarea class="mp-input" id="ofNotes_' + biz.id + '" name="notes" placeholder="Preferred pickup date/time, special requests..."></textarea>' +
          '</div>' +
          '<p class="mp-form-note">We\'ll confirm your order by phone. Or call us directly: <a href="tel:' + biz.phone + '" style="color:var(--gold-lt)">' + escHtml(biz.phoneDisplay) + '</a>.</p>' +
          '<div class="mp-spacer"></div>' +
          '<button type="submit" class="mp-btn mp-btn--primary mp-btn--full" id="ofSubmit_' + biz.id + '">' +
            sendIcon + ' Send Order Inquiry' +
          '</button>' +
          '<div class="mp-form-success" id="orderSuccess_' + biz.id + '">' +
            checkIcon +
            '<p>Order inquiry sent!</p>' +
            '<p style="margin-top:.5rem;font-size:.8rem;color:var(--muted)">We\'ll call you soon to confirm. Or reach Loan at <a href="tel:' + biz.phone + '" style="color:var(--gold-lt)">' + escHtml(biz.phoneDisplay) + '</a>.</p>' +
          '</div>' +
        '</form>' +
      '</div>' +
    '</div>';
  }

  // ── Booking Form Logic ─────────────────────────────────────────────────────────

  function initBookingForm(biz) {
    var form = document.getElementById('bookingForm_' + biz.id);
    var successDiv = document.getElementById('bookingSuccess_' + biz.id);
    if (!form || !successDiv) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang gửi...';
      }

      var formData = new FormData(form);

      fetch('https://formspree.io/f/' + biz.formspreeId, {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' }
      })
        .then(function (res) {
          if (res.ok) {
            form.style.display = 'none';
            successDiv.classList.add('show');
          } else {
            return res.json().then(function (data) {
              throw new Error((data.errors || []).map(function (e) { return e.message; }).join(', ') || 'Gửi thất bại');
            });
          }
        })
        .catch(function (err) {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Gửi Đặt Lịch';
          }
          alert('Có lỗi xảy ra: ' + err.message + '\nVui lòng gọi trực tiếp: ' + biz.phoneDisplay);
        });
    });
  }

  function initOrderInquiryForm(biz) {
    var form       = document.getElementById('orderForm_' + biz.id);
    var successDiv = document.getElementById('orderSuccess_' + biz.id);
    var qtyInput   = document.getElementById('ofQty_' + biz.id);
    var dateInput  = document.getElementById('ofDate_' + biz.id);
    var capDiv     = document.getElementById('ofCap_' + biz.id);
    var subtotalDiv= document.getElementById('ofSubtotal_' + biz.id);
    var subtotalAmt= document.getElementById('ofSubtotalAmt_' + biz.id);
    var minWarn    = document.getElementById('ofMinWarn_' + biz.id);
    var submitBtn  = document.getElementById('ofSubmit_' + biz.id);

    if (!form || !successDiv) return;

    var _capCache = {}; // dateStr → {max,booked,remaining}

    // Live estimated subtotal
    function updateSubtotal() {
      if (!qtyInput || !subtotalDiv || !subtotalAmt) return;
      var qty    = parseInt(qtyInput.value, 10) || 0;
      var price  = parseFloat(qtyInput.getAttribute('data-price')) || 0;
      var minQty = parseInt(qtyInput.getAttribute('data-min'), 10) || 30;
      if (qty > 0) {
        subtotalAmt.textContent = '$' + (qty * price).toFixed(2);
        subtotalDiv.style.display = 'block';
        if (qty < minQty) {
          if (minWarn) minWarn.style.display = 'block';
          subtotalDiv.classList.add('mp-subtotal--warn');
        } else {
          if (minWarn) minWarn.style.display = 'none';
          subtotalDiv.classList.remove('mp-subtotal--warn');
        }
      } else {
        subtotalDiv.style.display = 'none';
        if (minWarn) minWarn.style.display = 'none';
      }
    }

    if (qtyInput) qtyInput.addEventListener('input', updateSubtotal);

    // Dynamically update variant select + min qty when item selection changes
    var itemSelectEl   = document.getElementById('ofItem_' + biz.id);
    var variantRowEl   = document.getElementById('ofVariantRow_' + biz.id);
    var variantSelectEl = document.getElementById('ofVariant_' + biz.id);

    if (itemSelectEl) {
      itemSelectEl.addEventListener('change', function () {
        var selectedId = itemSelectEl.value;
        var product = null;
        if (biz.products) {
          for (var pi = 0; pi < biz.products.length; pi++) {
            if (biz.products[pi].id === selectedId) { product = biz.products[pi]; break; }
          }
        }
        if (!product) return;

        // Update qty input min/price attributes
        if (qtyInput) {
          var newMin = product.minimumOrderQty;
          qtyInput.setAttribute('data-price', product.pricePerUnit);
          qtyInput.setAttribute('data-min',   newMin);
          qtyInput.min         = newMin;
          qtyInput.placeholder = newMin;
          if (!qtyInput.value || parseInt(qtyInput.value, 10) < newMin) {
            qtyInput.value = newMin;
          }
          updateSubtotal();
        }

        // Update min-order badge label
        var minBadge = qtyInput ? qtyInput.parentElement.querySelector('.mp-minorder-badge') : null;
        if (minBadge && product.minimumOrderQty > 1) {
          minBadge.textContent = 'Min. ' + product.minimumOrderQty;
        }

        // Update variant select (store imageUrl + price on each option for later swap)
        if (variantSelectEl && variantRowEl) {
          var variants = product.variants || [];
          if (variants.length === 0) {
            variantRowEl.style.display  = 'none';
            variantSelectEl.required    = false;
            variantSelectEl.innerHTML   = '';
          } else {
            variantRowEl.style.display  = '';
            variantSelectEl.required    = true;
            variantSelectEl.innerHTML   =
              '<option value="">— Select type —</option>' +
              variants.map(function (v) {
                var priceAttr = (v.price != null && v.price > 0) ? ' data-price="' + v.price + '"' : '';
                return '<option value="' + escAttr(v.id) + '" data-img="' + escAttr(v.imageUrl || '') + '"' + priceAttr + '>' + escHtml(v.labelEn) + '</option>';
              }).join('');
          }
        }

        // Reset product card image to this product's default when item changes
        dlcResetProductImg(product);
      });
    }

    // Swap product card image + update price when variant is selected
    if (variantSelectEl) {
      variantSelectEl.addEventListener('change', function () {
        var selOpt = variantSelectEl.options[variantSelectEl.selectedIndex];
        if (!selOpt) return;
        var selectedId = itemSelectEl ? itemSelectEl.value : '';
        var product = null;
        if (biz.products) {
          for (var pi = 0; pi < biz.products.length; pi++) {
            if (biz.products[pi].id === selectedId) { product = biz.products[pi]; break; }
          }
        }
        if (!product) return;

        // ISSUE 2 FIX: Update price when variant has its own price
        var variantPrice = selOpt.dataset.price ? parseFloat(selOpt.dataset.price) : NaN;
        if (!isNaN(variantPrice) && variantPrice > 0 && qtyInput) {
          qtyInput.setAttribute('data-price', variantPrice);
          updateSubtotal();
        }

        // Swap product card image
        var varImg = selOpt.dataset.img || '';
        var imgEl  = document.getElementById('pcard-img-' + product.id);
        if (imgEl) {
          imgEl.src = varImg || product.image || (function () {
            // fall back to first variant with image
            var fb = (product.variants || []).find(function (v) { return v.imageUrl; });
            return fb ? fb.imageUrl : '';
          })();
        }
      });
    }

    // Show capacity info for selected date
    function showCapInfo(info) {
      if (!capDiv) return;
      capDiv.style.display = 'block';
      if (info.remaining <= 0) {
        capDiv.textContent = 'Fully booked on this date. Please choose another date.';
        capDiv.className = 'mp-capacity-info mp-capacity-info--full';
      } else if (info.remaining < 60) {
        capDiv.textContent = 'Only ' + info.remaining + ' spots left (max ' + info.max + '/day).';
        capDiv.className = 'mp-capacity-info mp-capacity-info--low';
      } else {
        capDiv.textContent = info.remaining + ' spots available on this date (max ' + info.max + '/day).';
        capDiv.className = 'mp-capacity-info mp-capacity-info--ok';
      }
    }

    if (dateInput) {
      dateInput.addEventListener('change', function () {
        var ds = dateInput.value;
        if (!ds) { if (capDiv) capDiv.style.display = 'none'; return; }
        if (_capCache[ds]) { showCapInfo(_capCache[ds]); return; }
        if (capDiv) { capDiv.textContent = 'Checking availability…'; capDiv.style.display = 'block'; capDiv.className = 'mp-capacity-info'; }
        CapacityEngine.getCapacityInfo(biz, ds).then(function (info) {
          _capCache[ds] = info;
          showCapInfo(info);
        });
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var qty    = qtyInput ? (parseInt(qtyInput.value, 10) || 0) : 0;
      var minQty = qtyInput ? (parseInt(qtyInput.getAttribute('data-min'), 10) || 30) : 30;
      var price  = qtyInput ? (parseFloat(qtyInput.getAttribute('data-price')) || 0.75) : 0.75;
      var dateStr = dateInput ? dateInput.value : '';

      if (qty < minQty) {
        alert('Minimum order is ' + minQty + '. Please update the quantity.');
        if (qtyInput) qtyInput.focus();
        return;
      }

      function doSubmit(capInfo) {
        if (capInfo && qty > capInfo.remaining) {
          var msg = capInfo.remaining <= 0
            ? 'Sorry, ' + _dayLabel(capInfo.date) + ' is fully booked (max ' + capInfo.max + '/day). Please choose another date.'
            : 'Only ' + capInfo.remaining + ' spots left on ' + _dayLabel(capInfo.date) + ' (max ' + capInfo.max + '/day). Please reduce your quantity or choose another date.';
          alert(msg);
          return;
        }

        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }

        // Build order data
        var itemSelect = document.getElementById('ofItem_' + biz.id);
        var variantSel = document.getElementById('ofVariant_' + biz.id);
        var nameInput  = document.getElementById('ofName_' + biz.id);
        var phoneInput = document.getElementById('ofPhone_' + biz.id);
        var notesInput = document.getElementById('ofNotes_' + biz.id);

        var itemId = itemSelect ? itemSelect.value : (biz.products && biz.products[0] ? biz.products[0].id : '');
        var itemName = '';
        if (biz.products) {
          for (var pi = 0; pi < biz.products.length; pi++) {
            if (biz.products[pi].id === itemId) { itemName = biz.products[pi].name; break; }
          }
        }

        var orderData = {
          customerName:  nameInput  ? nameInput.value.trim()  : '',
          customerPhone: phoneInput ? phoneInput.value.trim() : '',
          itemId:        itemId,
          itemName:      itemName,
          variant:       variantSel ? variantSel.value : '',
          quantity:      qty,
          requestedDate: dateStr,
          subtotal:      parseFloat((qty * price).toFixed(2)),
          status:        'pending',
          notes:         notesInput ? notesInput.value.trim() : '',
          bookingType:   'order',
          capacityUnitsUsed: qty
        };

        // Save to Firestore
        if (window.dlcDb && window.firebase) {
          orderData.createdAt = window.firebase.firestore.FieldValue.serverTimestamp();
          orderData.updatedAt = window.firebase.firestore.FieldValue.serverTimestamp();
          window.dlcDb.collection('vendors').doc(biz.id).collection('bookings').add(orderData)
            .then(function (docRef) {
              // Write real-time notification so vendor sees it instantly
              var notifMsg = String(orderData.quantity) + ' ' +
                             (orderData.variant || orderData.itemName || '') +
                             (orderData.customerName ? ' · ' + orderData.customerName : '');
              var notifData = {
                type:          'new_booking',
                title:         'Đơn hàng mới!',
                message:       notifMsg.trim(),
                bookingId:     docRef.id,
                customerName:  orderData.customerName  || '',
                customerPhone: orderData.customerPhone || '',
                requestedDate: orderData.requestedDate || '',
                itemName:      orderData.variant || orderData.itemName || '',
                quantity:      orderData.quantity,
                subtotal:      orderData.subtotal,
                read:          false,
                acknowledged:  false,
                createdAt:     window.firebase.firestore.FieldValue.serverTimestamp(),
                // Extension points — set true when sent via those channels
                pushSent:  false,
                emailSent: false,
                smsSent:   false
              };
              window.dlcDb.collection('vendors').doc(biz.id)
                .collection('notifications').add(notifData)
                .catch(function (e) { console.warn('[notif] write failed:', e.message); });
              form.style.display = 'none';
              successDiv.classList.add('show');
            })
            .catch(function (err) {
              console.warn('[order] Firestore save failed:', err.message);
              // Show success anyway — customer will call to confirm
              form.style.display = 'none';
              successDiv.classList.add('show');
            });
        } else {
          form.style.display = 'none';
          successDiv.classList.add('show');
        }
      }

      // Validate capacity then submit
      if (dateStr) {
        if (_capCache[dateStr]) {
          doSubmit(_capCache[dateStr]);
        } else {
          CapacityEngine.getCapacityInfo(biz, dateStr).then(function (info) {
            _capCache[dateStr] = info;
            doSubmit(info);
          });
        }
      } else {
        doSubmit(null);
      }
    });
  }

  // ── AI Receptionist ────────────────────────────────────────────────────────────

  // Build an opener message when the homepage router hands off to this vendor page.
  // Uses extracted context fields so the specialist continues where the user left off.
  function _buildHandoffOpener(biz, ctx) {
    var fields = ctx.extractedFields || {};
    var text   = (ctx.originalMessage || '').toLowerCase();
    var ai     = biz.aiReceptionist || {};

    // Try to match product name from the original message
    var itemName = '';
    if (biz.products) {
      for (var i = 0; i < biz.products.length; i++) {
        var p    = biz.products[i];
        var pn   = (p.nameEn || p.name || '').toLowerCase();
        var pid  = (p.id || p.canonicalId || '').toLowerCase().replace(/-/g, ' ');
        var words = (pn + ' ' + pid).split(/\s+/).filter(function(w) { return w.length >= 4; });
        if (words.some(function(w) { return text.includes(w); })) {
          itemName = p.nameEn || p.name;
          break;
        }
      }
    }

    var parts = [];
    if (itemName)                  parts.push(itemName);
    if (fields.quantity)           parts.push(fields.quantity + ' phần');
    if (fields.requestedDateLabel) parts.push('for ' + fields.requestedDateLabel);

    if (parts.length > 0) {
      var confirmed = parts.join(', ');
      // Determine next missing field
      if (!fields.requestedDate) {
        return 'I can help with ' + confirmed + '. What date would you like?';
      }
      return 'I can help with ' + confirmed + '. Would you like pickup or delivery?';
    }

    return 'Hi! I\'m ' + (ai.name || 'here') + '. How can I help with your order today?';
  }

  // ── EscalationEngine ─────────────────────────────────────────────────────
  // Handles AI → vendor escalation and real-time response relay.
  //
  // Flow:
  //   1. AI appends [ESCALATE:type] to its reply when intake is complete
  //   2. _sendMessage detects marker, strips it, shows the AI summary to user
  //   3. EscalationEngine.create() writes a doc to Firestore escalations/
  //   4. Vendor sees the request in admin → Confirm / Decline / Reply
  //   5. onSnapshot fires → vendor response rendered in user chat
  //   6. 20-minute timeout → fallback "please call directly" message
  //
  var EscalationEngine = {
    TIMEOUT_MS: 20 * 60 * 1000,

    parseMarker: function (reply) {
      var m = reply.match(/\[ESCALATE:(order|appointment|reservation|question)\]/i);
      return m ? m[1].toLowerCase() : null;
    },

    stripMarker: function (reply) {
      return reply.replace(/\s*\[ESCALATE:[^\]]+\]/gi, '').trim();
    },

    create: function (biz, messagesEl, escalationType, bookingData) {
      var db = window.dlcDb;
      if (!db) {
        console.warn('[escalation] No Firestore db — escalation skipped');
        return;
      }

      // Build a compact summary from the last 4 history messages (2 turns)
      var history = biz._aiHistory || [];
      var summary = history.slice(-4).map(function (m) {
        return (m.role === 'user' ? 'Khách: ' : 'AI: ') + m.content.slice(0, 150);
      }).join('\n');

      var escId     = 'esc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      var hostName  = (biz.aiReceptionist && biz.aiReceptionist.hostName) || biz.name || 'Cửa hàng';
      var escLang   = (biz._bookingState && biz._bookingState.lang) || 'en';
      var pendingId = EscalationEngine._showPending(messagesEl, hostName, escLang);
      var phone     = biz.phone || biz.phoneDisplay || '';

      db.collection('escalations').doc(escId).set({
        vendorId:        biz.id || biz.slug || '',
        vendorName:      biz.name || '',
        escalationType:  escalationType,
        summary:         summary,
        status:          'pending_vendor_response',
        createdAt:       firebase.firestore.FieldValue.serverTimestamp(),
        vendorMessage:   null,
        appointmentData: bookingData || null,
        lang:            (biz._bookingState && biz._bookingState.lang) || 'en'
      }).then(function () {
        var unsub;
        var timerHandle = setTimeout(function () {
          if (unsub) unsub();
          EscalationEngine._removePending(messagesEl, pendingId);
          db.collection('escalations').doc(escId)
            .update({ status: 'vendor_timeout' }).catch(function () {});
          var timeoutMsgs = {
            vi: 'Rất tiếc, ' + hostName + ' chưa phản hồi kịp lúc. Vui lòng liên hệ trực tiếp qua số ' + phone + '.',
            en: 'Sorry, ' + hostName + ' has not responded in time. Please contact them directly at ' + phone + '.',
            es: 'Lo sentimos, ' + hostName + ' no respondió a tiempo. Por favor contáctalos directamente al ' + phone + '.',
          };
          EscalationEngine._appendVendorMsg(messagesEl,
            timeoutMsgs[escLang] || timeoutMsgs.en,
            'timeout');
        }, EscalationEngine.TIMEOUT_MS);

        unsub = db.collection('escalations').doc(escId).onSnapshot(function (snap) {
          if (!snap.exists) return;
          var data   = snap.data();
          var status = data.status;
          if (status === 'pending_vendor_response') return; // still waiting

          clearTimeout(timerHandle);
          unsub();
          EscalationEngine._removePending(messagesEl, pendingId);

          var vmsg = data.vendorMessage ? ' — ' + data.vendorMessage : '';
          if (status === 'vendor_confirmed') {
            var confirmMsgs = {
              vi: '✓ ' + hostName + ' đã xác nhận!' + vmsg,
              en: '✓ ' + hostName + ' confirmed your appointment!' + vmsg,
              es: '✓ ' + hostName + ' confirmó tu cita.' + vmsg,
            };
            EscalationEngine._appendVendorMsg(messagesEl,
              confirmMsgs[escLang] || confirmMsgs.en,
              'confirmed');
            // Show booking packet card with calendar links
            EscalationEngine._appendConfirmedPacket(messagesEl, data);
          } else if (status === 'vendor_declined') {
            var declineMsgs = {
              vi: hostName + ' xin lỗi, không thể thực hiện.' + vmsg + ' Vui lòng liên hệ ' + phone + '.',
              en: hostName + ' is sorry, but cannot accommodate your request.' + vmsg + ' Please contact them at ' + phone + '.',
              es: hostName + ' lamenta no poder atenderte.' + vmsg + ' Por favor contacta al ' + phone + '.',
            };
            EscalationEngine._appendVendorMsg(messagesEl,
              declineMsgs[escLang] || declineMsgs.en,
              'declined');
          } else if (status === 'vendor_replied') {
            EscalationEngine._appendVendorMsg(messagesEl,
              hostName + ': ' + (data.vendorMessage || ''),
              'replied');
          }
        }, function (err) {
          console.warn('[escalation] listener error:', err.message);
        });

      }).catch(function (err) {
        console.warn('[escalation] create failed:', err.message);
        EscalationEngine._removePending(messagesEl, pendingId);
      });
    },

    _showPending: function (messagesEl, hostName, lang) {
      var id     = 'esc_p_' + Date.now();
      var labels = {
        vi: hostName ? 'Đang chờ xác nhận từ ' + hostName + '\u2026' : 'Đang chờ xác nhận\u2026',
        en: hostName ? 'Waiting for confirmation from ' + hostName + '\u2026' : 'Waiting for confirmation\u2026',
        es: hostName ? 'Esperando confirmación de ' + hostName + '\u2026' : 'Esperando confirmación\u2026',
      };
      var label  = labels[lang] || labels.en;
      var _bav  = '<div class="mp-ai__msg__avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></div>';
      var div   = document.createElement('div');
      div.className = 'mp-ai__msg mp-ai__msg--bot';
      div.id        = id;
      div.innerHTML = _bav +
        '<div class="mp-ai__bubble mp-ai__bubble--pending">' +
          '<span class="mp-ai__pending-dot"></span>' +
          '<span class="mp-ai__pending-dot"></span>' +
          '<span class="mp-ai__pending-dot"></span>' +
          '&nbsp;' + label +
        '</div>';
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return id;
    },

    _removePending: function (messagesEl, id) {
      var el = document.getElementById(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    },

    _appendVendorMsg: function (messagesEl, text, type) {
      var div    = document.createElement('div');
      div.className = 'mp-ai__msg mp-ai__msg--bot';
      div.innerHTML = '<div class="mp-ai__msg__avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></div>';
      var bubble = document.createElement('div');
      bubble.className = 'mp-ai__bubble mp-ai__bubble--vendor mp-ai__bubble--vendor-' + (type || 'replied');
      bubble.textContent = text;
      div.appendChild(bubble);
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    },

    // Build and append booking packet card (calendar links) after vendor_confirmed
    _appendConfirmedPacket: function (messagesEl, escData) {
      var appt = escData.appointmentData || {};
      var lang = escData.lang || 'en';
      var date = appt.date || appt.requestedDate || '';
      var time = appt.time || appt.requestedTime || '09:00';
      if (!date || !time) return;

      var svcs    = appt.services || (appt.service ? [appt.service] : []);
      var svcStr  = svcs.join(' + ') || '—';
      var staff   = appt.staff   || '';
      var durMins = appt.totalDurationMins || 60;
      var vendor  = escData.vendorName || 'Du Lịch Cali';

      // ── Calendar URL helpers ────────────────────────────────────────────────
      function pN(n) { return ('0' + n).slice(-2); }
      function fmtIcs(d, t) { return d.replace(/-/g,'') + 'T' + t.replace(':','') + '00'; }
      var endD = new Date(date + 'T' + time + ':00');
      endD.setTime(endD.getTime() + durMins * 60000);
      var endDate = endD.getFullYear() + '-' + pN(endD.getMonth()+1) + '-' + pN(endD.getDate());
      var endTime = pN(endD.getHours()) + ':' + pN(endD.getMinutes());
      var desc = ['Services: ' + svcStr,
        staff && staff.toLowerCase() !== 'any' ? 'Technician: ' + staff : null
      ].filter(Boolean).join('\n');
      var gcalUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
        '&text='     + encodeURIComponent(vendor + ' — ' + svcStr) +
        '&dates='    + fmtIcs(date, time) + '/' + fmtIcs(endDate, endTime) +
        '&details='  + encodeURIComponent(desc) +
        '&location=' + encodeURIComponent(vendor + ', Bay Area, CA');
      var icsLines = [
        'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//DuLichCali//EN',
        'BEGIN:VEVENT',
        'DTSTART:' + fmtIcs(date, time),
        'DTEND:'   + fmtIcs(endDate, endTime),
        'SUMMARY:' + (vendor + ' — ' + svcStr),
        'LOCATION:' + vendor,
        'END:VEVENT','END:VCALENDAR'
      ];
      var icsUrl = 'data:text/calendar;charset=utf8,' + encodeURIComponent(icsLines.join('\r\n'));

      // ── Date / time display ─────────────────────────────────────────────────
      var dateStr = '';
      try {
        var dd = new Date(date + 'T12:00:00');
        var MONS = { vi:['tháng 1','tháng 2','tháng 3','tháng 4','tháng 5','tháng 6','tháng 7','tháng 8','tháng 9','tháng 10','tháng 11','tháng 12'], en:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] };
        var DOWS = { vi:['CN','T2','T3','T4','T5','T6','T7'], en:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] };
        var ml = MONS[lang] || MONS.en, dl = DOWS[lang] || DOWS.en;
        dateStr = lang === 'vi' ? dl[dd.getDay()] + ', ' + dd.getDate() + ' ' + ml[dd.getMonth()] : dl[dd.getDay()] + ', ' + ml[dd.getMonth()] + ' ' + dd.getDate();
      } catch(e) { dateStr = date; }
      var tp  = time.split(':'), th = parseInt(tp[0]), tm2 = parseInt(tp[1]||0);
      var timeStr = (th%12||12) + ':' + (tm2<10?'0':'') + tm2 + (th<12?' AM':' PM');

      var L = {
        vi:{ header:'✅ Lịch Hẹn Đã Xác Nhận', svc:'Dịch vụ', staff:'Kỹ thuật viên', date:'Ngày', time:'Giờ', foot:'Nếu có thay đổi, chúng tôi sẽ nhắn tin cho bạn.', gcal:'📅 Google Calendar', ics:'⬇ Lưu vào Calendar' },
        en:{ header:'✅ Appointment Confirmed', svc:'Service', staff:'Technician', date:'Date', time:'Time', foot:"If anything changes, we'll text you.", gcal:'📅 Google Calendar', ics:'⬇ Save to Calendar' },
        es:{ header:'✅ Cita Confirmada', svc:'Servicio', staff:'Técnica', date:'Fecha', time:'Hora', foot:'Si algo cambia, te avisaremos por mensaje.', gcal:'📅 Google Calendar', ics:'⬇ Guardar en Calendario' }
      };
      var lbl = L[lang] || L.en;
      var S = 'style=';

      var rows = [
        [lbl.svc, svcStr],
        staff && staff.toLowerCase() !== 'any' ? [lbl.staff, staff] : null,
        dateStr ? [lbl.date, dateStr] : null,
        timeStr ? [lbl.time, timeStr] : null
      ].filter(Boolean);

      var rowHtml = rows.map(function(r) {
        return '<div ' + S + '"display:flex;justify-content:space-between;gap:.5rem;padding:.34rem 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:.8rem">' +
          '<span ' + S + '"color:#718096;white-space:nowrap;flex-shrink:0">' + r[0] + '</span>' +
          '<span ' + S + '"color:#f0e6d3;text-align:right;font-weight:500">' + r[1] + '</span>' +
          '</div>';
      }).join('');

      var html =
        '<div ' + S + '"background:linear-gradient(135deg,rgba(8,18,40,.96),rgba(14,25,52,.96));border:1px solid rgba(200,146,42,.35);border-radius:12px;padding:1rem 1.1rem;max-width:340px">' +
          '<div ' + S + '"font-size:.88rem;font-weight:700;color:#e8b84b;margin-bottom:.75rem;letter-spacing:.02em">' + lbl.header + '</div>' +
          rowHtml +
          '<div ' + S + '"margin-top:.7rem;font-size:.76rem;color:#718096;font-style:italic">' + lbl.foot + '</div>' +
          '<div ' + S + '"display:flex;gap:.5rem;margin-top:.85rem">' +
            '<a href="' + gcalUrl + '" target="_blank" rel="noopener" ' + S + '"flex:1;display:block;text-align:center;padding:.48rem .4rem;border-radius:6px;background:rgba(200,146,42,.18);border:1px solid rgba(200,146,42,.4);color:#e8b84b;font-size:.72rem;font-weight:700;text-decoration:none;letter-spacing:.03em">' + lbl.gcal + '</a>' +
            '<a href="' + icsUrl + '" download="appointment.ics" ' + S + '"flex:1;display:block;text-align:center;padding:.48rem .4rem;border-radius:6px;background:rgba(200,146,42,.08);border:1px solid rgba(200,146,42,.28);color:#e8b84b;font-size:.72rem;font-weight:700;text-decoration:none;letter-spacing:.03em">' + lbl.ics + '</a>' +
          '</div>' +
        '</div>';

      var div = document.createElement('div');
      div.className = 'mp-ai__msg mp-ai__msg--bot';
      div.innerHTML = '<div class="mp-ai__msg__avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></div>';
      var bubble = document.createElement('div');
      bubble.className = 'mp-ai__bubble mp-ai__bubble--packet';
      bubble.innerHTML = html;
      div.appendChild(bubble);
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  };

  // ── Voice Input Module ────────────────────────────────────────────────────────
  // Attaches multilingual mic button to AI input bar.
  // Requires Web Speech API; silently does nothing if not available.
  window.DLCVoiceInput = (function () {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    var _LANGS  = ['vi-VN', 'en-US', 'es-US'];
    var _LABELS = ['VI', 'EN', 'ES'];
    var _PH     = ['Đang nghe…', 'Listening…', 'Escuchando…'];
    var _BLOCKED = ['Mic bị chặn · Cho phép trong cài đặt',
                    'Mic blocked · Allow in settings',
                    'Micrófono bloqueado · Permite en ajustes'];

    function _langIdx(biz) {
      var l = (biz && biz._bookingState && biz._bookingState.lang) || 'vi';
      if (l === 'en') return 1;
      if (l === 'es') return 2;
      return 0;
    }

    function attach(biz, container, input) {
      if (!SR) return; // unsupported — buttons stay hidden
      var micBtn  = container.querySelector('.mp-ai__mic');
      var langBtn = container.querySelector('.mp-ai__mic-lang');
      if (!micBtn || !langBtn) return;

      // Show buttons
      micBtn.style.display  = '';
      langBtn.style.display = '';

      var _idx = _langIdx(biz);
      langBtn.textContent = _LABELS[_idx];

      var _rec       = null;
      var _listening = false;

      function _stop() {
        _listening = false;
        micBtn.classList.remove('mp-ai__mic--listening');
        input.disabled    = false;
        input.placeholder = 'Nhập câu hỏi...';
        if (_rec) { try { _rec.stop(); } catch (e) {} _rec = null; }
      }

      function _start() {
        if (_listening) { _stop(); return; }
        try {
          _rec = new SR();
          _rec.lang             = _LANGS[_idx];
          _rec.interimResults   = true;
          _rec.maxAlternatives  = 1;
          _rec.continuous       = false;

          _rec.onstart = function () {
            _listening = true;
            micBtn.classList.add('mp-ai__mic--listening');
            input.disabled    = true;
            input.placeholder = _PH[_idx];
          };

          _rec.onresult = function (e) {
            var t = '';
            for (var i = e.resultIndex; i < e.results.length; i++) {
              t += e.results[i][0].transcript;
            }
            input.value = t;
          };

          _rec.onend = function () {
            _stop();
            if (input.value.trim()) input.focus();
          };

          _rec.onerror = function (e) {
            _stop();
            if (e.error === 'not-allowed' || e.error === 'permission-denied') {
              input.placeholder = _BLOCKED[_idx];
              setTimeout(function () { input.placeholder = 'Nhập câu hỏi...'; }, 3500);
            }
          };

          _rec.start();
        } catch (err) { _stop(); }
      }

      micBtn.addEventListener('click', _start);

      langBtn.addEventListener('click', function () {
        _idx = (_idx + 1) % _LANGS.length;
        langBtn.textContent = _LABELS[_idx];
        if (_listening) _stop();
      });
    }

    return { attach: attach };
  })();

  var Receptionist = {

    init: function (biz, containerId) {
      var container = document.getElementById(containerId);
      if (!container) return;

      var input = container.querySelector('.mp-ai__input');
      var sendBtn = container.querySelector('.mp-ai__send');
      var chips = container.querySelectorAll('.mp-ai__chip');
      var messagesEl = container.querySelector('.mp-ai__messages');

      if (!input || !sendBtn || !messagesEl) return;

      // Send button
      sendBtn.addEventListener('click', function () {
        var text = input.value.trim();
        if (!text) return;
        Receptionist._sendMessage(biz, text, messagesEl);
        input.value = '';
      });

      // Enter key
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          var text = input.value.trim();
          if (!text) return;
          Receptionist._sendMessage(biz, text, messagesEl);
          input.value = '';
        }
      });

      // Quick reply chips
      chips.forEach(function (chip) {
        chip.addEventListener('click', function () {
          var text = chip.textContent.trim();
          Receptionist._sendMessage(biz, text, messagesEl);
        });
      });

      // ── Context handoff from homepage router ──────────────────────
      // When the homepage routes "I want bun cha hanoi tomorrow" → this
      // vendor page, the context is in sessionStorage. We seed the AI
      // history so the specialist continues from where the user left off.
      try {
        var rawCtx = sessionStorage.getItem('dlc_agent_ctx');
        if (rawCtx) {
          sessionStorage.removeItem('dlc_agent_ctx');
          var ctx = JSON.parse(rawCtx);
          if (ctx.vendorId === biz.id && ctx.originalMessage) {
            // Seed history: user's original message is turn 1
            biz._aiHistory = [{ role: 'user', content: ctx.originalMessage }];
            // Build context-aware opener without an extra API call
            var opener = _buildHandoffOpener(biz, ctx);
            Receptionist._appendMessage(messagesEl, opener, 'bot');
            // Push opener as turn 2 so future Claude calls see the full thread
            biz._aiHistory.push({ role: 'assistant', content: opener });
            // Scroll chat into view smoothly
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
        }
      } catch(e) { console.warn('[DLC] handoff context error:', e); }

      // Voice input
      if (window.DLCVoiceInput) window.DLCVoiceInput.attach(biz, container, input);

      // ── Full-screen mode (mobile only) ───────────────────────────────────
      (function _initFullScreen() {
        var backBtn = container.querySelector('.mp-ai__header-back');

        function _fsUpdateVH() {
          var vv = window.visualViewport;
          if (!vv || !container.classList.contains('mp-ai--fs')) return;
          container.style.height = vv.height + 'px';
          container.style.top    = vv.offsetTop + 'px';
        }

        function _fsOpen() {
          if (window.innerWidth >= 768) return;
          container.classList.add('mp-ai--fs');
          document.body.classList.add('mp-ai-open');
          _fsUpdateVH();
          setTimeout(function () {
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }, 50);
        }

        function _fsClose() {
          container.classList.remove('mp-ai--fs');
          document.body.classList.remove('mp-ai-open');
          container.style.height = '';
          container.style.top    = '';
        }

        // Open on any tap/click inside the widget (not just input focus)
        container.addEventListener('click', function (e) {
          if (backBtn && backBtn.contains(e.target)) return; // back button closes, not opens
          _fsOpen();
        });
        input.addEventListener('focus', _fsOpen);

        // Close on back button
        if (backBtn) backBtn.addEventListener('click', _fsClose);

        // Handle iOS keyboard resize
        if (window.visualViewport) {
          window.visualViewport.addEventListener('resize', _fsUpdateVH);
          window.visualViewport.addEventListener('scroll', _fsUpdateVH);
        }

        // Expose so focusAi can trigger it
        container._fsOpen = _fsOpen;
      }());
    },

    _sendMessage: function (biz, text, messagesEl) {
      // ── Conversation history (per vendor, per page session) ─────────────
      if (!biz._aiHistory) biz._aiHistory = [];
      biz._aiHistory.push({ role: 'user', content: text });

      // ── Staff memory: track named staff across conversation turns ─────────
      // Allows follow-up questions ("when will SHE be available?") to resolve correctly
      if (biz.staff) {
        var _allSt = biz.staff.filter(function (m) { return m.active !== false; });
        _allSt.forEach(function (m) {
          if (new RegExp('\\b' + m.name + '\\b', 'i').test(text)) {
            biz._selectedStaff = m;
          }
        });
      }

      // Add user bubble
      Receptionist._appendMessage(messagesEl, text, 'user');

      // Show typing indicator
      var typingId = 'typing_' + Date.now();
      Receptionist._appendTyping(messagesEl, typingId);

      var apiKey = null;
      try { apiKey = localStorage.getItem('dlc_claude_key'); } catch (e) {}

      // Pre-fetch capacity if food vendor + date found in message
      var capPromise = Promise.resolve(null);
      if (biz.vendorType === 'foodvendor') {
        var ds = _parseDateFromText(text);
        if (ds) capPromise = CapacityEngine.getCapacityInfo(biz, ds);
      }

      capPromise.then(function (capInfo) {
        if (apiKey) {
          return Receptionist._askClaude(biz, text, apiKey, capInfo)
            .catch(function () {
              return Receptionist._ruleBasedReply(biz, text, capInfo);
            });
        } else {
          return new Promise(function (resolve) {
            setTimeout(function () {
              resolve(Receptionist._ruleBasedReply(biz, text, capInfo));
            }, capInfo ? 200 : 650);
          });
        }
      }).then(function (reply) {
        // Detect escalation marker — strip it before storing/displaying
        var escalationType = EscalationEngine.parseMarker(reply);
        var cleanReply     = escalationType ? EscalationEngine.stripMarker(reply) : reply;

        // Record assistant reply; cap history at 20 messages (10 turns)
        biz._aiHistory.push({ role: 'assistant', content: cleanReply });
        if (biz._aiHistory.length > 20) biz._aiHistory = biz._aiHistory.slice(-20);
        Receptionist._removeTyping(messagesEl, typingId);
        if (cleanReply) Receptionist._appendMessage(messagesEl, cleanReply, 'bot');

        // If escalation requested, forward to vendor via Firestore
        if (escalationType) {
          EscalationEngine.create(biz, messagesEl, escalationType);
        }
      });
    },

    _ruleBasedReply: function (biz, text, capInfo) {
      var t = text.toLowerCase();

      // Greetings
      if (/xin ch[àa]o|hello|hi\b|ch[àa]o|hey/.test(t)) {
        return biz.aiReceptionist.welcomeMessage;
      }

      // ── Food vendor: deterministic answers ─────────────────────────────────
      // Always use live Firestore products (biz.products) when the vendor has any items
      // Always use live Firestore data. If vendor has no items configured, tell the customer.
      var _bestProducts = (biz.products && biz.products.length > 0) ? biz.products : [];
      if (biz.vendorType === 'foodvendor' && _bestProducts.length === 0) {
        return 'Hiện tại nhà hàng chưa có món nào trong thực đơn. Vui lòng quay lại sau hoặc liên hệ trực tiếp với chúng tôi để biết thêm thông tin.';
      }
      if (biz.vendorType === 'foodvendor' && _bestProducts.length > 0) {

        // 0. DATE + CAPACITY (capInfo pre-fetched by _sendMessage)
        if (capInfo) {
          var label  = _dayLabel(capInfo.date);
          var calc0  = Receptionist._computePrice(biz, t);
          var isVi   = /[\u1E00-\u1EFF]|tôi|mu[ốo]n|v[àa]o|th[ứu]|bao nhi[êe]u|ch[ảa]\s*gi[oò]/.test(text);
          var lines  = [];

          if (calc0) {
            var pLbl = calc0.product.nameEn || calc0.product.name;
            lines.push(calc0.qty + ' ' + pLbl + (calc0.qty !== 1 ? 's' : '') +
              ' = $' + calc0.subtotal.toFixed(2) +
              ' (at $' + calc0.price.toFixed(2) + ' each)');
            if (calc0.belowMin) {
              lines.push(isVi
                ? 'Lưu ý: số lượng tối thiểu là ' + calc0.minQty + ' cái ($' + calc0.minSubtotal.toFixed(2) + ').'
                : 'Note: minimum order is ' + calc0.minQty + ' pieces ($' + calc0.minSubtotal.toFixed(2) + ').');
            }
          }

          if (capInfo.remaining <= 0) {
            lines.push(isVi
              ? label + ' đã hết chỗ (' + capInfo.booked + '/' + capInfo.max + '). Vui lòng chọn ngày khác.'
              : label + ' is fully booked (' + capInfo.booked + '/' + capInfo.max + '). Please choose another date.');
          } else if (calc0 && !calc0.belowMin && calc0.qty > capInfo.remaining) {
            lines.push(isVi
              ? 'Ngày ' + label + ' chỉ còn ' + capInfo.remaining + ' cuốn (tối đa ' + capInfo.max + '/ngày, đã đặt ' + capInfo.booked + '). Bạn muốn đặt ' + capInfo.remaining + ' cuốn hoặc chọn ngày khác?'
              : 'For ' + label + ': only ' + capInfo.remaining + ' left (max ' + capInfo.max + '/day, ' + capInfo.booked + ' already booked). Would you like to order ' + capInfo.remaining + ' instead, or choose another date?');
          } else {
            lines.push(isVi
              ? 'Ngày ' + label + ': còn ' + capInfo.remaining + ' cuốn (tối đa ' + capInfo.max + '/ngày).'
              : label + ': ' + capInfo.remaining + ' spots available (max ' + capInfo.max + '/day).');
            if (calc0 && !calc0.belowMin) {
              lines.push(isVi
                ? 'Điền form bên dưới để đặt hàng hoặc gọi Loan: ' + biz.phoneDisplay
                : 'Use the form below to place your order, or call Loan: ' + biz.phoneDisplay);
            }
          }

          return lines.join('\n\n');
        }

        // 1. QUANTITY PRICING — highest priority (no date)
        // Catches: "how much is 30 egg rolls?", "price for 50?", "100 pieces?"
        var calc = Receptionist._computePrice(biz, t);
        if (calc) {
          var pLabel = calc.product.nameEn || calc.product.name;
          var ans = calc.qty + ' ' + pLabel + (calc.qty !== 1 ? 's' : '') +
            ' = $' + calc.subtotal.toFixed(2) +
            ' (at $' + calc.price.toFixed(2) + ' each)';
          if (calc.belowMin) {
            ans += '.\n\nNote: the minimum order is ' + calc.minQty + ' pieces' +
              ' ($' + calc.minSubtotal.toFixed(2) + ' total) — you\'d need to order at least ' + calc.minQty + '.';
          } else {
            ans += '.\n\nTo order, use the form below or call Loan at ' + biz.phoneDisplay + '.';
          }
          return ans;
        }

        // 2. Variants / types
        if (/raw|s[ôo]ng|t[ươu][ởo]i|fresh|lo[ạa]i|types?|variant|ki[êe]u|ch[ọo]n/.test(t)) {
          var varLines = [];
          _bestProducts.forEach(function (p) {
            (p.variants || []).forEach(function (v) {
              varLines.push('• ' + (typeof v === 'object' ? (v.labelEn || v.label) : v));
            });
          });
          var fp2 = _bestProducts[0];
          return (fp2.nameEn || fp2.name) + ' is available in:\n' +
            (varLines.length ? varLines.join('\n') : '• Contact us for options') +
            '\n\n$' + Number(fp2.pricePerUnit).toFixed(2) + ' each · Min ' + fp2.minimumOrderQty + ' pieces';
        }

        // 3. Minimum order
        if (/minimum|min order|t[ốo]i thi[ểe]u|[íi]t nh[ấa]t|less than|fewer|under/.test(t)) {
          var fp3 = _bestProducts[0];
          return 'Minimum order is ' + fp3.minimumOrderQty + ' pieces' +
            ' ($' + (Number(fp3.pricePerUnit) * fp3.minimumOrderQty).toFixed(2) + ' total).' +
            ' This ensures every batch is made fresh.';
        }

        // 4. Price per unit (no quantity specified)
        if (/gi[áa]|price|cost|bao nhi[êe]u|how much|ph[íi]|ti[êề]n/.test(t)) {
          var prLines = _bestProducts.map(function (p) {
            var baseP = Number(p.pricePerUnit || p.price || 0);
            return '• ' + (p.nameEn || p.name) + ': $' + baseP.toFixed(2) + ' each' +
              ' (min ' + p.minimumOrderQty + ' ' + (p.unitEn || p.unit || 'pcs') +
              ' = $' + (baseP * p.minimumOrderQty).toFixed(2) + ')';
          });
          return prLines.join('\n') + '\n\nAsk me about any specific dish for more details!';
        }

        // 5. Menu / what do you sell
        if (/menu|sell|have|available|b[áa]n g[ìi]|what.*have|what.*sell/.test(t)) {
          var mLines = _bestProducts.map(function (p) {
            var baseP = Number(p.pricePerUnit || p.price || 0);
            var vNames = (p.variants || []).map(function (v) {
              return typeof v === 'object' ? (v.labelEn || v.label) : v;
            });
            var line = '• ' + (p.nameEn || p.name) +
              ' — $' + baseP.toFixed(2) + '/each, min ' + p.minimumOrderQty +
              ' ' + (p.unitEn || p.unit || 'pcs');
            if (vNames.length) line += ' · Options: ' + vNames.join(', ');
            return line;
          });
          return biz.name + ' menu:\n' + mLines.join('\n') +
            '\n\nHandmade, no preservatives. Perfect for parties & family dinners!';
        }

        // 6. Pickup / delivery
        if (/pickup|pick.?up|l[ấa]y h[àà]ng|delivery|giao|ship/.test(t)) {
          return 'Pickup at:\n' + biz.address + '\n\nFor delivery, contact Loan: ' + biz.phoneDisplay;
        }

        // 7. How to order
        if (/order|[đd][ặa]t|mua|buy|how.*get/.test(t)) {
          var fp7 = _bestProducts[0];
          return 'To order:\n1. Use the inquiry form on this page\n2. Or call Loan at ' + biz.phoneDisplay +
            '\n\nMin order: ' + fp7.minimumOrderQty + ' ' + (fp7.unitEn || fp7.unit || 'pcs') +
            ' ($' + (Number(fp7.pricePerUnit || fp7.price || 0) * fp7.minimumOrderQty).toFixed(2) + ').';
        }

        // 8. Contact / phone
        if (/phone|call|contact|s[ốo]|g[ọo]i|[đd]i[ệe]n/.test(t)) {
          var cLines = (biz.hosts || []).map(function (h) { return h.name + ': ' + h.display; });
          return 'Contact ' + biz.name + ':\n' + (cLines.length ? cLines.join('\n') : biz.phoneDisplay);
        }

        // 9. Address / location
        if (/address|location|where|[đd][ịi]a ch[ỉi]|[ởo] [đd][âa]u/.test(t)) {
          return biz.name + ' is at:\n' + biz.address;
        }

        // 10. Food vendor default
        return 'Hi! I can answer questions about ' + biz.name + ':\n' +
          '• Pricing (try: "How much is 50 egg rolls?")\n' +
          '• Menu items & variants\n' +
          '• Minimum order & how to order\n' +
          '• Pickup address & contact\n\n' +
          'Or call Loan directly: ' + biz.phoneDisplay;
      }
      // ── End food vendor ─────────────────────────────────────────────────────

      // ── Appointment / nail / hair vendor handlers ─────────────────────────────

      var _activeSvcs  = (biz.services || []).filter(function (s) { return s.active !== false; });
      var _activeStaff = (biz.staff   || []).filter(function (m) { return m.active !== false; });
      // When no live Firestore services are configured yet, use the full static catalog for
      // category-awareness so the AI can confirm "yes we do gel / acrylic / etc."
      var _catalogSvcs = _activeSvcs.length ? _activeSvcs : (biz._staticServices || []);

      // ── Language detection — shared AIEngine (single source of truth for the app) ──
      var lang = AIEngine.detectLang(text);

      // ── Staff schedule helpers ────────────────────────────────────────────────
      function _staffWorkingToday(staffList) {
        var now    = new Date();
        var keyMap = ['sun','mon','tue','wed','thu','fri','sat'];
        var oldKey = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][now.getDay()];
        var newKey = keyMap[now.getDay()];
        return staffList.filter(function (m) {
          if (!m.schedule) return true;
          if (m.schedule[newKey] !== undefined) return m.schedule[newKey].active === true;
          if (m.schedule.days && m.schedule.days.length) return m.schedule.days.indexOf(oldKey) !== -1;
          return true;
        });
      }
      function _staffWorkingNow(staffList) {
        var now     = new Date();
        var newKey  = ['sun','mon','tue','wed','thu','fri','sat'][now.getDay()];
        var nowMins = now.getHours() * 60 + now.getMinutes();
        function toMins(t) { if (!t) return 0; var p = t.split(':'); return +p[0]*60 + +p[1]; }
        return _staffWorkingToday(staffList).filter(function (m) {
          if (!m.schedule || !m.schedule[newKey]) return false;
          var ds = m.schedule[newKey];
          if (!ds.start || !ds.end) return false;
          return nowMins >= toMins(ds.start) && nowMins < toMins(ds.end);
        });
      }

      // ── Category-aware service matcher ───────────────────────────────────────
      var _CAT_KW = [
        { words:['gel polish','gel x','builder gel','hard gel','shellac','gel nail','gel manicure','gel pedicure','gel on hand','gel on feet','gel extension'], cat:'gel',      label:'Gel / Extensions' },
        { words:['acrylic','pink & white','pink and white','ombre acrylic','color powder','acrílico','acrilico'],                                              cat:'acrylic',  label:'Acrylic' },
        { words:['dip powder','dip ','polvo'],                                                                                                                 cat:'dip',      label:'Dip Powder' },
        { words:['nail art','chrome','rhinestone','3d nail','cat eye','ombre add','french tip add','hand-paint','diseño','arte en uña'],                       cat:'nailart',  label:'Nail Art' },
        { words:['manicure','mani ','french manicure','american manicure','paraffin manicure','classic manicure','spa manicure','manicura'],                   cat:'manicure', label:'Manicure' },
        { words:['pedicure','pedi ','spa pedicure','deluxe pedicure','luxury pedicure','jelly pedicure','callus treatment','pedicura'],                        cat:'pedicure', label:'Pedicure' },
        { words:['removal','remov','repair','cuticle','paraffin wax','hand massage','foot massage','callus removal','shape change','extra length','relleno'],  cat:'addon',    label:'Add-ons / Care' }
      ];
      function _catFromText(str) {
        var sl = str.toLowerCase();
        for (var ci = 0; ci < _CAT_KW.length; ci++) {
          var e = _CAT_KW[ci];
          for (var wi = 0; wi < e.words.length; wi++) {
            if (sl.indexOf(e.words[wi]) !== -1) return e;
          }
        }
        return null;
      }
      // Returns: { type:'exact', svc } | { type:'category', svcs, catLabel } | { type:'category-empty', catLabel } | null
      function _matchSvc(str) {
        if (!str) return null;
        var sl = str.toLowerCase();
        // 1. Direct active service name match (live services only)
        var exactSvc = null;
        for (var si = 0; si < _activeSvcs.length; si++) {
          var sn = _activeSvcs[si].name.toLowerCase();
          var longWords = sn.split(' ').filter(function (w) { return w.length > 4; });
          if (sl.indexOf(sn) !== -1 || longWords.some(function (w) { return sl.indexOf(w) !== -1; })) {
            exactSvc = _activeSvcs[si]; break;
          }
        }
        if (exactSvc) return { type:'exact', svc:exactSvc };
        // 2. Category match — use catalog (live services if any, static catalog otherwise)
        var catEntry = _catFromText(str);
        if (catEntry) {
          var catSvcs = _catalogSvcs.filter(function (sv) { return sv.category === catEntry.cat; });
          if (catSvcs.length) return { type:'category', svcs:catSvcs, catLabel:catEntry.label };
          return { type:'category-empty', catLabel:catEntry.label };
        }
        return null;
      }

      var _now         = new Date();
      var _todayDow    = _now.toLocaleDateString('en-US', { weekday:'long' });
      var _todayDowEs  = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'][_now.getDay()];
      var _todayDowKey = ['sun','mon','tue','wed','thu','fri','sat'][_now.getDay()];
      var _dowKeys     = ['sun','mon','tue','wed','thu','fri','sat'];
      var _dowLong     = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      var _dowLongEs   = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
      var _dowLongVi   = ['Chủ Nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];

      // Returns { dayIndex, dowLong, dowLongEs, dowLongVi, schedule } for a staff member's
      // next working day after `fromDate` (today by default). Returns null if never works.
      function _getNextWorkDay(member, fromDate) {
        var base = fromDate || _now;
        for (var i = 1; i <= 7; i++) {
          var d   = new Date(base);
          d.setDate(base.getDate() + i);
          var key = _dowKeys[d.getDay()];
          if (!member.schedule) return { dayIndex: d.getDay(), dowLong: _dowLong[d.getDay()], dowLongEs: _dowLongEs[d.getDay()], dowLongVi: _dowLongVi[d.getDay()], schedule: null };
          var ds  = member.schedule[key];
          if (ds && ds.active === true) {
            return { dayIndex: d.getDay(), dowLong: _dowLong[d.getDay()], dowLongEs: _dowLongEs[d.getDay()], dowLongVi: _dowLongVi[d.getDay()], schedule: ds };
          }
        }
        return null;
      }

      // Returns human-readable work hours string for a schedule entry, e.g. "10 AM – 6 PM"
      function _fmtHrs(ds) {
        if (!ds || !ds.start) return '';
        function _fmt(t) {
          var p = t.split(':'), h = +p[0], m = +p[1];
          var ampm = h < 12 ? 'AM' : 'PM';
          h = h % 12 || 12;
          return h + (m ? ':' + (m < 10 ? '0' : '') + m : '') + ' ' + ampm;
        }
        return _fmt(ds.start) + ' – ' + _fmt(ds.end);
      }

      // ── 1. STAFF AVAILABILITY ─────────────────────────────────────────────────
      // Covers:
      //   "is Tracy available?", "is Helen working today?", "who's available this afternoon?"
      //   "when will Tracy be available?", "what time does Tracy work?"
      //   "is Tracy available tomorrow?", "is she/he working?"
      //   "can Tracy do gel manicure tomorrow?", "who can do acrylic today?"
      //   Spanish / Vietnamese equivalents

      // Resolve pronouns using stored staff context from prior turns
      var _pronounRef = biz._selectedStaff && /\b(she|he|her|him|they)\b/i.test(text) ? biz._selectedStaff : null;

      var _namedStaff = null;
      _activeStaff.forEach(function (m) { if (new RegExp('\\b' + m.name + '\\b', 'i').test(text)) _namedStaff = m; });
      var _targetStaff = _namedStaff || _pronounRef;

      // Target day: "today", "tomorrow", a day of week, or default to today
      var _targetDayOffset = 0;
      var _targetDayLabel  = _todayDow;
      var _targetDayKey    = _todayDowKey;
      var _targetDayLabelEs = _todayDowEs;
      var _targetDayLabelVi = _dowLongVi[_now.getDay()];
      (function () {
        var tl2 = text.toLowerCase();
        if (/tomorrow|mañana|manana|ngày mai/i.test(tl2)) {
          _targetDayOffset = 1;
        } else {
          for (var di = 0; di < _dowKeys.length; di++) {
            if (new RegExp(_dowLong[di], 'i').test(tl2) || new RegExp(_dowLongEs[di], 'i').test(tl2) || new RegExp(_dowLongVi[di].toLowerCase(), 'i').test(tl2)) {
              var diff = ((di - _now.getDay()) + 7) % 7 || 7;
              _targetDayOffset = diff;
              break;
            }
          }
        }
        if (_targetDayOffset > 0) {
          var td = new Date(_now); td.setDate(_now.getDate() + _targetDayOffset);
          _targetDayLabel   = _dowLong[td.getDay()];
          _targetDayKey     = _dowKeys[td.getDay()];
          _targetDayLabelEs = _dowLongEs[td.getDay()];
          _targetDayLabelVi = _dowLongVi[td.getDay()];
        }
      }());

      var _isStaffQ =
        // availability / working status
        /\bavail|\bwho\s+(?:is|are|can|'s)\b|who.*(?:work|free|today|tomorrow)\b|is\s+\w+\s+(?:avail|in|working|free|there)/i.test(text) ||
        /can\s+I\s+(?:book|see|get)\s+with|staff\s*today|working\s*(today|tomorrow)/i.test(text) ||
        // "when will X be available", "what time does X work", "what days does X work"
        /when\s+(?:will|is|can|does)\s+\w+\s+(?:be\s+(?:avail|in|working|free)|work|come\s+in)/i.test(text) ||
        /what\s+(?:time|days?|hours?)\s+does\s+\w+\s+work/i.test(text) ||
        /what\s+(?:time|days?|hours?)\s+(?:is|are)\s+\w+\s+(?:avail|working|in)/i.test(text) ||
        // pronoun follow-ups: "when will she be available?", "is he working tomorrow?"
        (_pronounRef && /when|avail|work|free|time|schedule|tomorrow|today/i.test(text)) ||
        // "can Tracy do gel manicure tomorrow", "who can do acrylic today"
        /can\s+\w+\s+do\b|who\s+can\s+do\b/i.test(text) ||
        // Spanish
        /(quién|quien).*(disponible|trabaja|está|esta)|(está|esta|trabaja).*(hoy|mañana|disponible|libre)/i.test(text) ||
        /disponible.*(?:hoy|mañana)|hay.*disponible|cuándo.*trabaja|cuando.*trabaja/i.test(text) ||
        // Vietnamese
        /ai\s*r[ảa]nh|r[ảa]nh.*kh[ôo]ng|c[óo]\s*ai\b|h[ôo]m nay.*ai|ai.*h[ôo]m nay/i.test(text) ||
        /khi\s*n[àa]o.*r[ảa]nh|r[ảa]nh.*ng[àa]y/i.test(text) ||
        // named staff + any schedule/time intent
        (_namedStaff !== null && /avail|work|free|today|tomorrow|when|time|schedule|hours?|r[ảa]nh|h[ôo]m|ng[àa]y mai|disponible|trabaja|mañana/i.test(text));

      if (_isStaffQ) {
        var _isFutureQ = /when\s+will|when\s+(?:is|does)|next\s+(?:time|day|avail)|khi\s*n[àa]o|cuándo/i.test(text) || _targetDayOffset > 0;

        // ── Specific person named or resolved by pronoun ───────────────────────
        if (_targetStaff) {
          var sp    = _targetStaff;
          var spSp  = (sp.specialties || []).join(', ') || 'general nail services';
          var targetDate = _targetDayOffset > 0 ? (function () { var d = new Date(_now); d.setDate(_now.getDate() + _targetDayOffset); return d; }()) : _now;
          var spDs  = sp.schedule && sp.schedule[_targetDayKey];
          var spOn  = sp.schedule
            ? (spDs && spDs.active === true)
            : true; // no schedule = always available

          if (spOn) {
            // Working on target day — report hours
            var spHrs = _fmtHrs(spDs);
            if (lang === 'es') return sp.name + ' trabaja el ' + _targetDayLabelEs + (spHrs ? ' de ' + spHrs : '') + '.\nEspecialidades: ' + spSp + '.\n¿Le gustaría reservar una cita?';
            if (lang === 'vi') return sp.name + ' làm việc ' + (_targetDayOffset === 0 ? 'hôm nay' : _targetDayLabelVi) + (spHrs ? ' từ ' + spHrs : '') + '.\nChuyên môn: ' + spSp + '.\nBạn muốn đặt lịch không?';
            return sp.name + ' is working ' + (_targetDayOffset === 0 ? 'today (' + _todayDow + ')' : _targetDayLabel) + (spHrs ? ' from ' + spHrs : '') + '.\nSpecialties: ' + spSp + '.\nWould you like to book an appointment?';
          } else {
            // Not working on target day — find next available day
            var next = _getNextWorkDay(sp, targetDate);
            if (next) {
              var nextHrs = _fmtHrs(next.schedule);
              if (_isFutureQ || _targetDayOffset === 0) {
                // User asked "when will she be available" or "is Tracy available today" (and she's not)
                if (lang === 'es') return sp.name + ' no trabaja ' + (_targetDayOffset === 0 ? 'hoy (' + _todayDowEs + ')' : 'el ' + _targetDayLabelEs) + '.\nSu próximo día disponible es el ' + next.dowLongEs + (nextHrs ? ' de ' + nextHrs : '') + '.';
                if (lang === 'vi') return sp.name + ' không làm ' + (_targetDayOffset === 0 ? 'hôm nay (' + _todayDow + ')' : _targetDayLabelVi) + '.\nNgày làm việc tiếp theo: ' + next.dowLongVi + (nextHrs ? ' từ ' + nextHrs : '') + '.';
                return sp.name + ' is not working ' + (_targetDayOffset === 0 ? 'today (' + _todayDow + ')' : _targetDayLabel) + '.\nNext available: ' + next.dowLong + (nextHrs ? ' from ' + nextHrs : '') + '.';
              } else {
                if (lang === 'es') return sp.name + ' no trabaja el ' + _targetDayLabelEs + '.\nPróximo día: ' + next.dowLongEs + (nextHrs ? ' de ' + nextHrs : '') + '.';
                if (lang === 'vi') return sp.name + ' không làm ' + _targetDayLabelVi + '.\nNgày tiếp theo: ' + next.dowLongVi + (nextHrs ? ' từ ' + nextHrs : '') + '.';
                return sp.name + ' is not working ' + _targetDayLabel + '.\nNext available: ' + next.dowLong + (nextHrs ? ' from ' + nextHrs : '') + '.';
              }
            } else {
              // Extremely rare: staff works no days at all
              if (lang === 'es') return sp.name + ' no está disponible esta semana. Llame para confirmar: ' + biz.phoneDisplay;
              if (lang === 'vi') return sp.name + ' không có lịch tuần này. Gọi: ' + biz.phoneDisplay;
              return sp.name + ' has no scheduled days this week. Call: ' + biz.phoneDisplay;
            }
          }
        }

        // ── No specific person — list all staff available on target day ─────────
        var targetDateAll = _targetDayOffset > 0 ? (function () { var d = new Date(_now); d.setDate(_now.getDate() + _targetDayOffset); return d; }()) : _now;
        var _staffOnTargetDay = _activeStaff.filter(function (m) {
          if (!m.schedule) return true;
          var ds2 = m.schedule[_targetDayKey];
          return ds2 && ds2.active === true;
        });

        if (!_staffOnTargetDay.length) {
          if (lang === 'es') return 'No hay técnicos programados para el ' + _targetDayLabelEs + '.\nLlame para confirmar disponibilidad: ' + biz.phoneDisplay;
          if (lang === 'vi') return 'Không có thợ vào ' + (_targetDayOffset === 0 ? 'hôm nay (' + _todayDow + ')' : _targetDayLabelVi) + '.\nGọi để xác nhận: ' + biz.phoneDisplay;
          return 'No staff scheduled ' + (_targetDayOffset === 0 ? 'today (' + _todayDow + ')' : _targetDayLabel) + '.\nCall to confirm: ' + biz.phoneDisplay;
        }
        var staffLines = _staffOnTargetDay.map(function (m) {
          var ds  = m.schedule && m.schedule[_targetDayKey];
          var hrs = _fmtHrs(ds);
          var sp  = m.specialties && m.specialties.length ? ' · ' + m.specialties.join(', ') : '';
          return '• ' + m.name + ' — ' + (m.role || 'Nail Tech') + sp + (hrs ? ' (' + hrs + ')' : '');
        }).join('\n');
        var dayRef = _targetDayOffset === 0 ? _todayDow : _targetDayLabel;
        var dayRefEs = _targetDayOffset === 0 ? _todayDowEs : _targetDayLabelEs;
        var dayRefVi = _targetDayOffset === 0 ? _dowLongVi[_now.getDay()] : _targetDayLabelVi;
        if (lang === 'es') return 'Personal disponible el ' + dayRefEs + ':\n' + staffLines + '\n\n¿Con quién le gustaría reservar?';
        if (lang === 'vi') return 'Thợ có mặt ' + (_targetDayOffset === 0 ? 'hôm nay' : dayRefVi) + ':\n' + staffLines + '\n\nBạn muốn đặt với ai?';
        return 'Staff available ' + (_targetDayOffset === 0 ? 'today' : dayRef) + ':\n' + staffLines + '\n\nWho would you like to book with?';
      }

      // ── 2. DO YOU DO / OFFER X ────────────────────────────────────────────────
      // EN: "do you do gel", "do you offer pedicure", "can you do acrylic fill"
      // ES: "¿hacen gel?", "¿tienen pedicura?", "¿hacen relleno de acrílico?"
      // VI: "có làm gel không", "bạn có làm acrylic không"
      if (/do\s+you\s+(?:do|offer|have)|can\s+you\s+do|you\s+do\s+\w/i.test(text) ||
          /(hacen|tienen|ofrecen)\s+\w|(hacen|ofrecen|tienen)\s+(el|la|los|las)/i.test(text) ||
          /c[óo]\s+(?:d[ịi]ch\s+v[ụu]|l[àa]m)|c[óo]\s+l[àa]m\s+kh[ôo]ng|b[ạa]n\s+c[óo]\s+l[àa]m/i.test(text)) {
        var sm2 = _matchSvc(t);
        if (sm2) {
          if (sm2.type === 'exact') {
            var s2 = sm2.svc;
            var pr2 = s2.price || (lang==='es' ? 'Llame para precio' : lang==='vi' ? 'Gọi để hỏi giá' : 'Call for pricing');
            if (lang === 'es') return '¡Sí! Ofrecemos ' + s2.name + ': ' + pr2 + (s2.duration?' ('+s2.duration+')':'') + (s2.desc?'\n'+s2.desc:'') + '\nReserve: ' + biz.phoneDisplay;
            if (lang === 'vi') return 'Có! Tiệm có ' + s2.name + ': ' + pr2 + (s2.duration?' ('+s2.duration+')':'') + (s2.desc?'\n'+s2.desc:'') + '\nĐặt lịch: ' + biz.phoneDisplay;
            return 'Yes! We offer ' + s2.name + ': ' + pr2 + (s2.duration?' ('+s2.duration+')':'') + (s2.desc?'\n'+s2.desc:'') + '\nBook: ' + biz.phoneDisplay;
          }
          if (sm2.type === 'category') {
            var cl = sm2.svcs.slice(0,4).map(function (s) { return '• ' + s.name + (s.price?' — '+s.price:''); }).join('\n');
            if (lang==='es') return '¡Sí! Ofrecemos servicios de ' + sm2.catLabel + ':\n' + cl + '\nReserve: ' + biz.phoneDisplay;
            if (lang==='vi') return 'Có! Tiệm có dịch vụ ' + sm2.catLabel + ':\n' + cl + '\nĐặt lịch: ' + biz.phoneDisplay;
            return 'Yes! We offer ' + sm2.catLabel + ' services:\n' + cl + '\nBook: ' + biz.phoneDisplay;
          }
          if (sm2.type === 'category-empty') {
            if (lang==='es') return '¡Sí! Ofrecemos ' + sm2.catLabel + '. Llame para precios y disponibilidad: ' + biz.phoneDisplay;
            if (lang==='vi') return 'Có! Tiệm có dịch vụ ' + sm2.catLabel + '. Gọi để biết giá: ' + biz.phoneDisplay;
            return 'Yes! We offer ' + sm2.catLabel + ' services. Call for current pricing & availability: ' + biz.phoneDisplay;
          }
        }
      }

      // ── 3. WALK-IN ────────────────────────────────────────────────────────────
      if (/walk.?in|drop.?in|without.*appoint|no.*appoint/i.test(text) ||
          /sin\s+cita|sin\s+reserva|sin\s+previa/i.test(text) ||
          /kh[ôo]ng\s+c[ầa]n\s+h[ẹe]n|kh[ôo]ng\s+[đd][ặa]t\s+tr[ướ]c/i.test(text)) {
        if (lang==='es') return biz.name + ' acepta clientes sin cita y con cita previa. Se da prioridad a las citas — llame al ' + biz.phoneDisplay + ' o use el formulario de reserva.';
        if (lang==='vi') return biz.name + ' nhận cả walk-in và đặt lịch trước. Đặt lịch trước được ưu tiên — gọi ' + biz.phoneDisplay + ' hoặc dùng form bên dưới.';
        return biz.name + ' accepts walk-ins and appointments. Appointments are prioritized — call ' + biz.phoneDisplay + ' or use the booking form below.';
      }

      // ── 4. HOURS ──────────────────────────────────────────────────────────────
      if (/gi[ờo]|hours?|m[ởo]\s*c[ửu]a|open|[đd][óo]ng\s*c[ửu]a|close/i.test(text) ||
          /horario|hora.*(abren|cierran)|cuando.*(abren|cierran)/i.test(text)) {
        var hoursText = biz.hours
          ? Object.keys(biz.hours).map(function (d) { return '• ' + d + ': ' + biz.hours[d]; }).join('\n')
          : biz.phoneDisplay;
        if (lang==='es') return 'Horario de ' + biz.name + ':\n' + hoursText;
        if (lang==='vi') return 'Giờ mở cửa ' + biz.name + ':\n' + hoursText;
        return biz.name + ' hours:\n' + hoursText;
      }

      // ── 5. ADDRESS / LOCATION ─────────────────────────────────────────────────
      if (/address|location|where\s+(?:are|is|do)|[đd][ịi]a\s*ch[ỉi]|[ởo]\s*[đd][âa]u/i.test(text) ||
          /direcci[oó]n|ubicaci[oó]n|(dónde|donde)\s+(est[aá]n|quedan)/i.test(text)) {
        if (lang==='es') return biz.name + ' está en:\n' + biz.address + '\nTeléfono: ' + biz.phoneDisplay;
        if (lang==='vi') return biz.name + ' ở:\n' + biz.address + '\nLiên hệ: ' + biz.phoneDisplay;
        return biz.name + ' is at:\n' + biz.address + '\nCall: ' + biz.phoneDisplay;
      }

      // ── 6. PRICING ────────────────────────────────────────────────────────────
      if (/price|cost|how\s+much|gi[áa]|bao\s+nhi[êe]u|ph[íi]/i.test(text) ||
          /cu[aá]nto\s*(cuesta|es|cobran|cuestan)?|precio/i.test(text)) {
        var sm3 = _matchSvc(t);
        if (sm3 && sm3.type === 'exact') {
          var s3  = sm3.svc;
          var pr3 = s3.price ? s3.price : (lang==='es'?'Llame para precio':lang==='vi'?'Gọi để hỏi giá':'Call for current pricing');
          if (lang==='es') return s3.name + ': ' + pr3 + (s3.duration?' ('+s3.duration+')':'') + (s3.desc?'\n'+s3.desc:'') + '\n\nReserve: ' + biz.phoneDisplay;
          if (lang==='vi') return s3.name + ': ' + pr3 + (s3.duration?' ('+s3.duration+')':'') + (s3.desc?'\n'+s3.desc:'') + '\n\nĐặt lịch: ' + biz.phoneDisplay;
          return s3.name + ': ' + pr3 + (s3.duration?' ('+s3.duration+')':'') + (s3.desc?'\n'+s3.desc:'') + '\n\nBook: ' + biz.phoneDisplay;
        }
        if (sm3 && sm3.type === 'category') {
          var cPr = sm3.svcs.slice(0,5).map(function (s) { return '• ' + s.name + (s.price?' — '+s.price:'') + (s.duration?' ('+s.duration+')':''); }).join('\n');
          if (lang==='es') return sm3.catLabel + ' — Precios:\n' + cPr + '\n\nReserve: ' + biz.phoneDisplay;
          if (lang==='vi') return sm3.catLabel + ' — Giá:\n' + cPr + '\n\nĐặt lịch: ' + biz.phoneDisplay;
          return sm3.catLabel + ' — Pricing:\n' + cPr + '\n\nBook: ' + biz.phoneDisplay;
        }
        if (sm3 && sm3.type === 'category-empty') {
          if (lang==='es') return 'Ofrecemos ' + sm3.catLabel + '. Llame para precios actuales: ' + biz.phoneDisplay;
          if (lang==='vi') return 'Tiệm có dịch vụ ' + sm3.catLabel + '. Gọi để biết giá: ' + biz.phoneDisplay;
          return 'We offer ' + sm3.catLabel + '. Call for current pricing: ' + biz.phoneDisplay;
        }
        if (_activeSvcs.length) {
          var allP = _activeSvcs.map(function (s) { return '• ' + s.name + (s.price?' — '+s.price:'') + (s.duration?' ('+s.duration+')':''); }).join('\n');
          if (lang==='es') return 'Precios de ' + biz.name + ':\n' + allP;
          if (lang==='vi') return 'Bảng giá ' + biz.name + ':\n' + allP;
          return biz.name + ' pricing:\n' + allP;
        }
        if (lang==='es') return 'Contáctenos para precios: ' + biz.phoneDisplay;
        if (lang==='vi') return 'Vui lòng gọi để hỏi giá: ' + biz.phoneDisplay;
        return 'Call for current pricing: ' + biz.phoneDisplay;
      }

      // ── 7. BOOKING ────────────────────────────────────────────────────────────
      if (/book|appointment|schedule|\breserv|h[ẹe]n|\b[đd][ặa]t\b/i.test(text) ||
          /(puedo|quiero|quisiera|necesito)\s+(reservar|hacer\s+una\s+cita|agendar)/i.test(text) ||
          /reservar?\s+(una\s+cita|turno|hora)/i.test(text)) {
        var bSvc = _matchSvc(t);
        var bHasSvc  = bSvc && (bSvc.type==='exact'||bSvc.type==='category');
        var bHasTime = /tomorrow|today|tonight|this\s+(?:week|sat|sun|mon|tue|wed|thu|fri)|at\s+\d|\d:\d\d|\d\s*(?:am|pm)/i.test(t) ||
                       /mañana|manana|hoy|sábado|sabado|domingo|lunes|martes|miércoles|miercoles|jueves|viernes/i.test(t) ||
                       /ngày\s*mai|h[ôo]m\s*nay|th[ứu]\s*[2-7]/i.test(t);
        if (bHasSvc && bHasTime) {
          var bLbl = bSvc.type==='exact' ? bSvc.svc.name : bSvc.svcs[0].name;
          if (lang==='es') return 'Entendido — ' + bLbl + '. ¿Puede darnos su nombre y número de teléfono para confirmar la cita?';
          if (lang==='vi') return 'Đã hiểu — ' + bLbl + '. Cho tôi biết tên và số điện thoại để xác nhận lịch hẹn?';
          return 'Got it — ' + bLbl + '. What\'s your name and phone number to confirm the appointment?';
        }
        if (bHasSvc) {
          var bLbl2 = bSvc.type==='exact' ? bSvc.svc.name : bSvc.catLabel;
          if (lang==='es') return '¡Perfecto! ' + bLbl2 + ' — ¿Qué día y hora prefiere?';
          if (lang==='vi') return 'Tuyệt! ' + bLbl2 + ' — Bạn muốn đặt vào ngày và giờ nào?';
          return 'Perfect! ' + bLbl2 + ' — what day and time works for you?';
        }
        if (bHasTime) {
          if (lang==='es') return '¡Claro! ¿Qué servicio le gustaría reservar?';
          if (lang==='vi') return 'Được! Bạn muốn đặt dịch vụ gì?';
          return 'Of course! Which service would you like to book?';
        }
        if (lang==='es') return 'Para reservar en ' + biz.name + ':\n1. Use el formulario de reserva abajo\n2. O llame al: ' + biz.phoneDisplay + '\n\n¿Qué servicio le interesa?';
        if (lang==='vi') return 'Để đặt lịch tại ' + biz.name + ':\n1. Điền form bên dưới\n2. Gọi: ' + biz.phoneDisplay + '\n\nBạn muốn đặt dịch vụ gì?';
        return 'To book at ' + biz.name + ':\n1. Use the booking form below\n2. Or call: ' + biz.phoneDisplay + '\n\nWhich service are you interested in?';
      }

      // ── 8. SERVICES LIST ─────────────────────────────────────────────────────
      if (/service|what.*(?:do|offer|have)|nail.*(?:type|option|style)|menu/i.test(text) ||
          /d[ịi]ch\s+v[ụu]|c[óo]\s+nh[ữu]ng|danh\s+s[áa]ch/i.test(text) ||
          /servicios|que\s+ofrecen|que\s+tienen|tipos?\s+de\s+(servicio|u[nñ]as)/i.test(text)) {
        var _displaySvcs = _activeSvcs.length ? _activeSvcs : _catalogSvcs;
        if (_displaySvcs.length) {
          var byCat = {};
          _displaySvcs.forEach(function (s) { var c = s.category||'other'; if (!byCat[c]) byCat[c]=[]; byCat[c].push(s); });
          var catLbls = { manicure:'Manicure', pedicure:'Pedicure', acrylic:'Acrylic', gel:'Gel / Extensions', dip:'Dip Powder', nailart:'Nail Art', addon:'Add-ons / Care', cut:'Cut & Style', color:'Color', treatment:'Treatment', styling:'Styling', highlights:'Highlights', keratin:'Keratin' };
          var svcList = '';
          Object.keys(byCat).forEach(function (c) { svcList += '\n' + (catLbls[c]||c) + ':\n'; byCat[c].slice(0,5).forEach(function (s) { svcList += '  • ' + s.name + (s.price?' — '+s.price:'') + (s.duration?' ('+s.duration+')':'') + '\n'; }); });
          var pricingNote = _activeSvcs.length ? '' : ('\nPricing not listed — call for rates: ' + biz.phoneDisplay);
          if (lang==='es') return 'Servicios de ' + biz.name + ':' + svcList + pricingNote + '\nReserve: ' + biz.phoneDisplay;
          if (lang==='vi') return 'Dịch vụ của ' + biz.name + ':' + svcList + pricingNote + '\nĐặt lịch: ' + biz.phoneDisplay;
          return biz.name + ' services:' + svcList + pricingNote + '\nBook: ' + biz.phoneDisplay;
        }
        if (lang==='es') return 'Contáctenos para información sobre servicios disponibles: ' + biz.phoneDisplay;
        if (lang==='vi') return 'Vui lòng liên hệ để biết thêm về dịch vụ: ' + biz.phoneDisplay;
        return 'Contact us for current service availability: ' + biz.phoneDisplay;
      }

      // ── 9. PHONE / CONTACT ────────────────────────────────────────────────────
      if (/phone|call|contact|teléfono|telefono|numero|g[ọo]i|[đd]i[ệe]n.*tho[ại]i|li[êe]n.*h[ệe]/i.test(text)) {
        var cLines2 = (biz.hosts||[]).map(function (h) { return h.name + ': ' + (h.display||h.phone); }).join('\n');
        if (lang==='es') return 'Contacto ' + biz.name + ':\n' + (cLines2||biz.phoneDisplay);
        if (lang==='vi') return 'Liên hệ ' + biz.name + ':\n' + (cLines2||biz.phoneDisplay);
        return biz.name + ' contact:\n' + (cLines2||biz.phoneDisplay);
      }

      // ── Default ───────────────────────────────────────────────────────────────
      if (lang === 'es') {
        return '¡Hola! Soy Lily, la recepcionista virtual de ' + biz.name + '. Puedo ayudarle con:\n' +
          '• Servicios y precios\n' +
          '• Quién está disponible hoy\n' +
          '• Horario y ubicación\n' +
          '• Reservar una cita\n\n' +
          '¿En qué le puedo ayudar? También puede llamar al: ' + biz.phoneDisplay;
      } else if (lang === 'vi') {
        return 'Tôi có thể giúp bạn tại ' + biz.name + ':\n' +
          '• Xem giá dịch vụ\n' +
          '• Kiểm tra thợ rảnh hôm nay\n' +
          '• Giờ mở cửa & địa chỉ\n' +
          '• Đặt lịch hẹn\n\n' +
          'Hỏi bất kỳ thứ gì, hoặc gọi: ' + biz.phoneDisplay;
      } else {
        return 'Hi! I\'m Lily, your AI receptionist at ' + biz.name + '. I can help with:\n' +
          '• Services & pricing\n' +
          '• Staff availability today\n' +
          '• Hours & location\n' +
          '• Booking an appointment\n\n' +
          'Ask me anything, or call: ' + biz.phoneDisplay;
      }
    },

    _askClaude: function (biz, text, apiKey, capInfo) {
      var ai = biz.aiReceptionist;
      var systemPrompt;

      // ── Shared date context (all agent types) ─────────────────────────────────
      var today       = new Date();
      var todayStr    = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      var tomorrow    = new Date(today); tomorrow.setDate(today.getDate() + 1);
      var tomorrowStr = tomorrow.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      var hostName    = biz.hosts && biz.hosts[0] ? biz.hosts[0].name : (ai.name || 'the owner');
      var phone       = biz.phoneDisplay || '';

      // ── Shared booking-agent rules (all slot-filling agents) ─────────────────
      var sharedRules =
        'CRITICAL RULES:\n' +
        '- MEMORY: Never forget what the customer already told you. Do not reset context between turns.\n' +
        '- NEXT FIELD ONLY: Ask for the next missing field only — never dump all questions at once.\n' +
        '- DATE RESOLUTION: Resolve relative dates ("tomorrow", "this Saturday") to actual calendar dates using TODAY.\n' +
        '- RESET FORBIDDEN: Never pivot to "how can I help?" until the booking/order is fully confirmed.\n' +
        '- Respond in the same language as the customer. Keep answers brief and action-oriented.\n';

      if (biz.vendorType === 'foodvendor') {
        // ── ORDER INTAKE AGENT (food vendors: Emily, etc.) ────────────────────
        // Always use live Firestore products. If vendor has nothing configured, tell customer.
        var products = (biz.products || []).filter(function(p) { return p.active !== false; });
        if (!products.length) {
          return Promise.resolve('Hiện tại nhà hàng chưa có món nào trong thực đơn. Vui lòng quay lại sau hoặc liên hệ trực tiếp với chúng tôi để biết thêm thông tin.');
        }

        var menuBlock = 'MENU & PRICING:\n';
        products.forEach(function (p) {
          var basePrice = Number(p.pricePerUnit || p.price || 0);
          var minQty    = Number(p.minimumOrderQty || 1);
          var pName     = p.nameEn || p.name || p.displayNameVi || '';
          var variantsWithPrice = (p.variants || []).filter(function (v) {
            return v && typeof v === 'object' && v.price != null && Number(v.price) > 0;
          });
          if (variantsWithPrice.length > 0) {
            menuBlock += '- ' + pName + ' (min ' + minQty + ' pieces):\n';
            variantsWithPrice.forEach(function (v) {
              var vPrice = Number(v.price);
              var lbl    = v.labelEn || v.label || '';
              menuBlock += '    • ' + lbl + ': $' + vPrice.toFixed(2) + '/each (min total $' + (vPrice * minQty).toFixed(2) + ')\n';
            });
            (p.variants || []).filter(function (v) {
              return !(v && typeof v === 'object' && v.price != null && Number(v.price) > 0);
            }).forEach(function (v) {
              var lbl = (v && typeof v === 'object') ? (v.labelEn || v.label) : String(v);
              if (lbl) menuBlock += '    • ' + lbl + ': $' + basePrice.toFixed(2) + '/each\n';
            });
          } else if (basePrice > 0) {
            var vLabels = (p.variants || []).map(function (v) {
              return typeof v === 'object' ? (v.labelEn || v.label) : v;
            }).filter(Boolean).join(', ');
            menuBlock += '- ' + pName + ': $' + basePrice.toFixed(2) + '/each, min ' + minQty + ' pcs ($' + (basePrice * minQty).toFixed(2) + ' min)';
            if (vLabels) menuBlock += '; options: ' + vLabels;
            menuBlock += '\n';
          }
        });

        systemPrompt =
          'You are ' + ai.name + ', order assistant for ' + biz.name + '.\n\n' +
          'TODAY: ' + todayStr + '\n"Tomorrow" = ' + tomorrowStr + '\n\n' +
          menuBlock + '\n' +
          'CONTACT & LOGISTICS:\n' +
          '- ' + hostName + ': ' + phone + '\n' +
          '- Address: ' + biz.address + '\n' +
          '- Pickup available. Delivery: ask customer, vendor confirms. Order 1+ day in advance.\n\n' +
          'YOUR JOB — ORDER INTAKE AGENT:\n' +
          'Collect these fields in order, asking only the next missing one:\n' +
          '  1. ITEM (which dish)\n  2. VARIANT (if applicable)\n  3. QTY (check minimum)\n' +
          '  4. DATE  5. METHOD (pickup/delivery)  6. NAME + PHONE\n\n' +
          sharedRules +
          '- SELECTED ITEM: Once a dish is chosen, never ask "which dish?" again.\n' +
          '- PRICING: Quote exact prices above — never say "contact vendor" for listed items.\n' +
          '- ORDER COMPLETE: Summarize all 6 fields, then end your message with [ESCALATE:order] on its own line — this forwards the order to the vendor for real-time confirmation.';

        if (capInfo) {
          var capLbl = _dayLabel(capInfo.date);
          systemPrompt += '\n\nCAPACITY for ' + capLbl + ': max=' + capInfo.max + ', booked=' + capInfo.booked + ', remaining=' + capInfo.remaining + '.';
          if (capInfo.remaining <= 0) systemPrompt += ' FULLY BOOKED — tell customer to choose a different date.';
        }

      } else if (biz.bookingType === 'appointment' || biz.availabilityType === 'appointment') {
        // ── APPOINTMENT INTAKE AGENT (nail/hair salons, any future appointment vendor) ──
        var activeServices = (biz.services || []).filter(function (s) { return s.active !== false; });
        // When no live services are configured yet, use the full static catalog as knowledge base
        var catalogServices = activeServices.length ? activeServices : (biz._staticServices || []);
        var servicesBlock = '';
        if (activeServices.length) {
          servicesBlock = 'SERVICES & PRICING:\n';
          activeServices.forEach(function (s) {
            servicesBlock += '- ' + s.name + ': ' + (s.price || '');
            if (s.duration) servicesBlock += ' (' + s.duration + ')';
            if (s.desc)     servicesBlock += ' — ' + s.desc;
            servicesBlock += '\n';
          });
          servicesBlock += '\n';
        } else if (catalogServices.length) {
          // No live pricing yet — build service type catalog from static data
          var catGroups = {};
          var catOrder = ['manicure','pedicure','gel','acrylic','dip','nailart','addon','cut','color','treatment','styling','highlights','keratin'];
          var catNames = { manicure:'Manicure', pedicure:'Pedicure', gel:'Gel / Extensions', acrylic:'Acrylic', dip:'Dip Powder', nailart:'Nail Art', addon:'Add-ons / Care', cut:'Cut & Style', color:'Color', treatment:'Treatment', styling:'Styling', highlights:'Highlights', keratin:'Keratin' };
          catalogServices.forEach(function (s) {
            var c = s.category || 'other';
            if (!catGroups[c]) catGroups[c] = [];
            catGroups[c].push(s);
          });
          servicesBlock = 'SERVICE CATALOG (call for current pricing — ' + biz.phoneDisplay + '):\n';
          catOrder.forEach(function (c) {
            if (catGroups[c] && catGroups[c].length) {
              servicesBlock += '\n' + (catNames[c] || c) + ':\n';
              catGroups[c].slice(0, 6).forEach(function (s) {
                servicesBlock += '- ' + s.name;
                if (s.duration) servicesBlock += ' (' + s.duration + ')';
                if (s.desc) servicesBlock += ' — ' + s.desc;
                servicesBlock += '\n';
              });
            }
          });
          servicesBlock += '\n';
        } else {
          servicesBlock = 'SERVICES: Please contact the salon directly for current service availability and pricing.\n\n';
        }
        var hoursBlock = '';
        if (biz.hours) {
          hoursBlock = 'HOURS:\n';
          Object.keys(biz.hours).forEach(function (day) { hoursBlock += '- ' + day + ': ' + biz.hours[day] + '\n'; });
          hoursBlock += '\n';
        }
        var activeStaffArr = (biz.staff || []).filter(function (m) { return m.active !== false; });
        var _clDowKeys  = ['sun','mon','tue','wed','thu','fri','sat'];
        var _clDowLabel = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        var todayDowKey = _clDowKeys[today.getDay()];
        // Build FULL weekly schedule for every staff member — gives Claude everything needed
        // to answer temporal questions: "when will Tracy be available?", "is she working tomorrow?"
        var staffBlock = '';
        if (activeStaffArr.length) {
          staffBlock = 'STAFF — FULL WEEKLY SCHEDULES (TODAY is ' + _clDowLabel[today.getDay()] + '):\n';
          activeStaffArr.forEach(function (m) {
            staffBlock += '- ' + m.name + ' (' + (m.role || 'Nail Tech') + ')';
            if (m.specialties && m.specialties.length) staffBlock += ' · specialties: ' + m.specialties.join(', ');
            staffBlock += '\n  Works: ';
            if (m.schedule) {
              var workDays = _clDowKeys.filter(function (k) { return m.schedule[k] && m.schedule[k].active === true; });
              if (workDays.length) {
                workDays.forEach(function (k, i) {
                  var ds2 = m.schedule[k];
                  staffBlock += _clDowLabel[_clDowKeys.indexOf(k)] + ' ' + ds2.start + '-' + ds2.end;
                  if (i < workDays.length - 1) staffBlock += ', ';
                });
              } else {
                staffBlock += 'no days scheduled this week';
              }
              var todayDs = m.schedule[todayDowKey];
              staffBlock += todayDs && todayDs.active ? ' | TODAY: working ' + todayDs.start + '-' + todayDs.end : ' | TODAY: OFF';
            } else {
              staffBlock += 'all days (no fixed schedule)';
            }
            staffBlock += '\n';
          });
          staffBlock += '\n';
        }
        var featuresBlock = '';
        if (biz.features && biz.features.length) {
          featuresBlock = 'SALON HIGHLIGHTS: ' + biz.features.join(' · ') + '\n\n';
        }
        // Nail domain knowledge — always injected so AI can answer general questions
        // even when specific services have no price yet
        var nailKnowledge =
          'NAIL SERVICE KNOWLEDGE (for general questions when service not priced above):\n' +
          'Manicure: nail shaping, cuticle care, hand massage, polish — 30-75 min\n' +
          'Pedicure: foot soak, scrub, callus, massage, polish — 40-105 min\n' +
          'Acrylic: strong extensions — full set 75-90 min, fill every 2-3 weeks (50 min)\n' +
          'Gel: chip-free polish 2-3 weeks or gel extensions (builder/hard/gel-x) — 45-90 min\n' +
          'Dip Powder: no UV, odorless, lasts 3-4 weeks — 60-75 min\n' +
          'Nail Art add-ons: ombre, chrome, cat eye, rhinestones, 3D — +15-45 min\n' +
          'Add-ons: removal, repair, paraffin wax, cuticle care, massage\n' +
          'Walk-ins accepted. Appointments are prioritized.\n\n';

        systemPrompt =
          'You are ' + ai.name + ', premium nail salon AI receptionist for ' + biz.name + '.\n\n' +
          'TODAY: ' + todayStr + '\n"Tomorrow" = ' + tomorrowStr + '\n\n' +
          servicesBlock +
          hoursBlock +
          staffBlock +
          featuresBlock +
          nailKnowledge +
          'CONTACT:\n- ' + hostName + ': ' + phone + '\n- Address: ' + (biz.address || 'San Jose, CA') + '\n\n' +
          'YOUR DUAL ROLE:\n' +
          '1. NAIL SPECIALIST — Answer every question directly and immediately. Use SERVICES list for exact prices. Use NAIL SERVICE KNOWLEDGE for general questions. Never say "I don\'t know" or deflect when data is present.\n' +
          '2. APPOINTMENT BOOKING — Collect one field at a time: SERVICE → PREFERRED STAFF (optional) → DATE & TIME → NAME + PHONE\n\n' +
          'DIRECT ANSWER RULES:\n' +
          '- Staff availability TODAY: Check "TODAY: working/OFF" in STAFF section above. List working staff with their hours.\n' +
          '- Staff availability FUTURE ("when will Tracy be available?", "is she working tomorrow?"): Use the weekly schedule to find their next working day and report it with hours. NEVER say "call to confirm" when schedule data is present.\n' +
          '- Staff follow-up ("when will she be available?"): "she/he" refers to the most recently named staff member in conversation history.\n' +
          '- Staff + service ("can Tracy do gel manicure tomorrow?"): Check Tracy\'s schedule for tomorrow AND her specialties.\n' +
          '- Pricing: Quote exact price from SERVICES if listed. If not listed, say "Call for current pricing: ' + phone + '"\n' +
          '- Walk-ins: Yes, accepted. Appointments prioritized.\n' +
          '- Service not in list: "We don\'t currently offer that — please call: ' + phone + '"\n' +
          '- NO GENERIC OPENER: Never reply with "How can I help?" to a specific question. Answer the question directly.\n' +
          '- NO UNNECESSARY ESCALATION: Only say "call owner" for truly unknown info. Schedule is known — use it.\n\n' +
          sharedRules +
          '- LANGUAGE: You are fully fluent in English, Spanish, and Vietnamese. Always respond in the exact language the customer writes in. Never switch languages.\n' +
          '- VOICE READY: Keep responses concise and natural — no markdown asterisks or headers.\n' +
          '- APPOINTMENT COMPLETE: Once service, date/time, name, and phone are collected, summarize and end with [ESCALATE:appointment] on its own line.';

      } else if (biz.bookingType === 'reservation') {
        // ── RESERVATION INTAKE AGENT (restaurants, any future reservation vendor) ──
        var resHoursBlock = '';
        if (biz.hours) {
          resHoursBlock = 'HOURS:\n';
          Object.keys(biz.hours).forEach(function (day) { resHoursBlock += '- ' + day + ': ' + biz.hours[day] + '\n'; });
          resHoursBlock += '\n';
        }
        systemPrompt =
          'You are ' + ai.name + ', reservation assistant for ' + biz.name + '.\n\n' +
          'TODAY: ' + todayStr + '\n"Tomorrow" = ' + tomorrowStr + '\n\n' +
          resHoursBlock +
          'CONTACT:\n- ' + hostName + ': ' + phone + '\n- Address: ' + biz.address + '\n\n' +
          (ai.systemExtra ? 'ABOUT: ' + ai.systemExtra + '\n\n' : '') +
          'YOUR JOB — RESERVATION INTAKE AGENT:\n' +
          'Collect these fields in order, asking only the next missing one:\n' +
          '  1. PARTY SIZE  2. DATE & TIME (must be within hours above)  3. CUSTOMER NAME + PHONE  4. SPECIAL REQUESTS (optional)\n\n' +
          sharedRules +
          '- HOURS: Never accept a reservation outside listed hours.\n' +
          '- RESERVATION COMPLETE: Summarize all details, then end your message with [ESCALATE:reservation] on its own line — this forwards the reservation to the vendor for confirmation.';

      } else {
        // ── GENERIC FALLBACK (unknown vendor type — still history-aware) ─────────
        systemPrompt =
          'You are ' + ai.name + ', AI assistant for ' + biz.name + '. ' +
          (ai.systemExtra || '') + '\n\n' +
          'TODAY: ' + todayStr + '.\n' +
          'Use the conversation history — never repeat questions already answered.\n' +
          'Respond in the same language as the customer. Keep it concise.';
      }

      // Use full conversation history (already includes current user message)
      var messages = (biz._aiHistory || []).slice(-20);

      // ── API call via unified dispatcher (model + tokens from AIEngine.SERVICE_CONFIG) ──
      // 'food' → food order intake; 'appointment' → hair/nail salon booking
      var svcType = biz.vendorType === 'foodvendor' ? 'food' : 'appointment';
      return AIEngine.call(svcType, apiKey, systemPrompt, messages)
      .then(function (data) {
        return data.content && data.content[0] && data.content[0].text
          ? data.content[0].text
          : 'Xin lỗi, tôi không thể trả lời ngay lúc này.';
      });
    },

    // ── Deterministic pricing engine ──────────────────────────────────────────
    // Extracts a quantity from the message, matches to a product, returns calc.
    // Returns null if no quantity or no product could be determined.
    _computePrice: function (biz, text) {
      // Always use live Firestore products only — no static fallback
      var _products = (biz.products && biz.products.length > 0) ? biz.products : [];
      if (!_products.length) return null;

      // Must contain at least one number
      var qtyMatch = text.match(/\b(\d+)\b/);
      if (!qtyMatch) return null;
      var qty = parseInt(qtyMatch[1], 10);
      if (qty <= 0 || qty > 9999) return null;

      var tl = text.toLowerCase();
      var product = null;

      // Try to match by product id / name / nameEn
      for (var i = 0; i < _products.length; i++) {
        var p = _products[i];
        var keys = [
          (p.id      || '').toLowerCase(),
          (p.name    || '').toLowerCase(),
          (p.nameEn  || '').toLowerCase()
        ];
        for (var j = 0; j < keys.length; j++) {
          if (keys[j] && tl.indexOf(keys[j]) !== -1) { product = p; break; }
        }
        if (product) break;
      }

      // Common keyword fallbacks (egg roll variants)
      if (!product && /egg.?roll|ch[aả]\s*gi[oò]|eggroll/.test(tl)) {
        product = _products[0];
      }

      // Single-product vendor: assume the product if message has price/quantity intent
      if (!product && _products.length === 1) {
        var intent = /how much|price|cost|gi[áa]|bao nhi[êe]u|ph[íi]|\$|each|per|piece|roll|item|order/.test(tl);
        if (intent) product = _products[0];
      }

      if (!product) return null;

      var price  = Number(product.pricePerUnit || product.price) || 0;
      var minQty = Number(product.minimumOrderQty) || 1;
      return {
        product:     product,
        qty:         qty,
        price:       price,
        subtotal:    qty * price,
        belowMin:    qty < minQty,
        minQty:      minQty,
        minSubtotal: minQty * price
      };
    },

    _appendMessage: function (container, text, type) {
      var _av = type === 'bot' ? '<div class="mp-ai__msg__avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></div>' : '';
      var div = document.createElement('div');
      div.className = 'mp-ai__msg mp-ai__msg--' + type;
      div.innerHTML = _av + '<div class="mp-ai__bubble">' + escHtml(text) + '</div>';
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    },

    _appendTyping: function (container, id) {
      var div = document.createElement('div');
      div.className = 'mp-ai__msg mp-ai__msg--bot mp-ai__msg--typing';
      div.id = id;
      div.innerHTML = '<div class="mp-ai__msg__avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></div><div class="mp-ai__bubble"><span class="mp-ai__typing-dot"></span><span class="mp-ai__typing-dot"></span><span class="mp-ai__typing-dot"></span></div>';
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    },

    _removeTyping: function (container, id) {
      var el = document.getElementById(id);
      if (el) el.parentNode.removeChild(el);
    },

    send: function (biz, text) {
      var messagesEl = document.getElementById('aiMessages_' + biz.id);
      if (messagesEl) {
        Receptionist._sendMessage(biz, text, messagesEl);
      }
    }
  };

  // ── Utility ────────────────────────────────────────────────────────────────────

  function escHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escAttr(str) {
    return escHtml(str);
  }

  // ── Public API ─────────────────────────────────────────────────────────────────

  window.Marketplace = {
    init: init,
    renderDirectory: renderDirectory,
    renderDetail: renderDetail,
    Receptionist: Receptionist
  };

  // Also expose Receptionist at top level for external use
  window.Receptionist = Receptionist;

  // Expose EscalationEngine for external receptionist modules (e.g. LilyReceptionist)
  window.EscalationEngine = EscalationEngine;

})();

// ── Video modal (click-to-play unmuted) ───────────────────────────────────────
function dlcOpenVideoModal(videoUrl, title) {
  var existing = document.getElementById('dlcVideoModal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'dlcVideoModal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', title || 'Video');
  modal.innerHTML =
    '<div class="dlc-video-modal__backdrop" onclick="dlcCloseVideoModal()"></div>' +
    '<div class="dlc-video-modal__box">' +
      '<button class="dlc-video-modal__close" onclick="dlcCloseVideoModal()" aria-label="Đóng">&#215;</button>' +
      (title ? '<div class="dlc-video-modal__title">' + title + '</div>' : '') +
      '<video class="dlc-video-modal__video" controls autoplay playsinline>' +
        '<source src="' + videoUrl + '" type="video/mp4">' +
      '</video>' +
    '</div>';

  document.body.appendChild(modal);
  document.addEventListener('keydown', _dlcVideoModalKeydown);
  // Prevent body scroll
  document.body.style.overflow = 'hidden';
}

function dlcCloseVideoModal() {
  var modal = document.getElementById('dlcVideoModal');
  if (modal) {
    var vid = modal.querySelector('video');
    if (vid) { vid.pause(); vid.src = ''; }
    modal.remove();
  }
  document.removeEventListener('keydown', _dlcVideoModalKeydown);
  document.body.style.overflow = '';
}

function _dlcVideoModalKeydown(e) {
  if (e.key === 'Escape') dlcCloseVideoModal();
}

// ── Variant image swap helpers (global, called from onclick attributes) ──────
// Swap product card image when a variant chip is clicked
function dlcSwapVariantImg(chip) {
  var img   = chip.dataset.img;
  var prodId = chip.dataset.prod;
  if (!img || !prodId) return;
  var imgEl = document.getElementById('pcard-img-' + prodId);
  if (imgEl) imgEl.src = img;
  // Mark selected chip
  var wrap = chip.closest('.mp-product-card__variants');
  if (wrap) {
    wrap.querySelectorAll('.mp-product__variant').forEach(function (c) { c.style.opacity = '0.55'; });
    chip.style.opacity = '1';
  }
}

// Reset product card to its default image (called when item changes in order form)
function dlcResetProductImg(product) {
  if (!product) return;
  var imgEl = document.getElementById('pcard-img-' + product.id);
  if (!imgEl) return;
  var defaultImg = product.image || '';
  if (!defaultImg) {
    var fb = (product.variants || []).find(function (v) { return v.imageUrl; });
    if (fb) defaultImg = fb.imageUrl;
  }
  if (defaultImg) imgEl.src = defaultImg;
}
