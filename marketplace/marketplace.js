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

  function renderFooter() {
    return '<footer class="mp-footer">' +
      '<button class="mp-footer__back-btn" onclick="history.back()" aria-label="Quay lại trang trước">' +
        arrowLeftIcon + 'Quay lại' +
      '</button>' +
      '<div class="mp-footer__brand">Du Lịch Cali Services</div>' +
      '<div class="mp-footer__sub">© ' + new Date().getFullYear() + ' · dulichcali21.com · (714) 227-6007</div>' +
      '</footer>';
  }

  // Mobile-only persistent bottom utility nav for standalone submenu pages.
  // Provides Back, Home, and Marketplace shortcuts — hidden at 768px+ via CSS.
  function renderBottomNav(backHref) {
    var homeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><polyline points="9 21 9 12 15 12 15 21"/></svg>';
    var gridIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';
    return '<nav class="mp-bottom-nav" aria-label="Điều hướng trang">' +
      '<a href="' + escAttr(backHref) + '" class="mp-bottom-nav__tab">' +
        arrowLeftIcon + '<span>Quay lại</span>' +
      '</a>' +
      '<a href="/" class="mp-bottom-nav__tab">' +
        homeIcon + '<span>Trang chủ</span>' +
      '</a>' +
      '<a href="/marketplace/" class="mp-bottom-nav__tab">' +
        gridIcon + '<span>Dịch vụ</span>' +
      '</a>' +
    '</nav>';
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

  function renderInfoStrip(biz) {
    return '<div class="mp-info-strip">' +
      '<div class="mp-info-strip__item">' + mapPinIcon + escHtml(biz.address) + '</div>' +
      '<div class="mp-info-strip__item">' + phoneIcon +
        '<a href="tel:' + biz.phone + '">' + escHtml(biz.phoneDisplay) + '</a>' +
      '</div>' +
    '</div>';
  }

  function renderServicesSection(biz) {
    var itemsHtml = biz.services.map(function (svc) {
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

    var initial = '<div class="mp-ai__msg mp-ai__msg--bot">' +
      '<div class="mp-ai__bubble">' + escHtml(ai.welcomeMessage) + '</div>' +
    '</div>';

    return '<div class="mp-section">' +
      '<div class="mp-section-hdr">' +
        '<h2 class="mp-section-title">Trợ Lý AI</h2>' +
      '</div>' +
      '<div class="mp-ai" id="aiWidget_' + biz.id + '">' +
        '<div class="mp-ai__header">' +
          '<div class="mp-ai__avatar">🤖</div>' +
          '<div class="mp-ai__info">' +
            '<strong>' + escHtml(ai.name) + '</strong>' +
            '<div class="mp-ai__status"><span class="mp-ai__dot"></span>Online · Sẵn sàng hỗ trợ</div>' +
          '</div>' +
        '</div>' +
        '<div class="mp-ai__chips">' + chipsHtml + '</div>' +
        '<div class="mp-ai__messages" id="aiMessages_' + biz.id + '">' + initial + '</div>' +
        '<div class="mp-ai__input-bar">' +
          '<input class="mp-ai__input" type="text" id="aiInput_' + biz.id + '" placeholder="Nhập câu hỏi..." autocomplete="off">' +
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
      renderAppBar(backUrl, 'Danh sách', biz.name, biz.phone) +
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
            renderContactSection(biz) +
          '</div>' +
        '</div>' +
        '<div class="mp-spacer"></div>' +
      '</main>' +
      renderFooter() +
      renderBottomNav(backUrl);

    _container.innerHTML = html;

    if (biz.orderEnabled) {
      initOrderInquiryForm(biz);
    }

    if (biz.aiReceptionist && biz.aiReceptionist.enabled) {
      Receptionist.init(biz, 'aiWidget_' + biz.id);
    }
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
      return '<option value="' + escAttr(v.id) + '">' + escHtml(v.labelEn) + '</option>';
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
      var price  = parseFloat(qtyInput.getAttribute('data-price')) || 0.75;
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

    create: function (biz, messagesEl, escalationType) {
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
      var pendingId = EscalationEngine._showPending(messagesEl);
      var hostName  = (biz.aiReceptionist && biz.aiReceptionist.hostName) || biz.name || 'Nhà hàng';
      var phone     = biz.phone || biz.phoneDisplay || '';

      db.collection('escalations').doc(escId).set({
        vendorId:       biz.id || biz.slug || '',
        vendorName:     biz.name || '',
        escalationType: escalationType,
        summary:        summary,
        status:         'pending_vendor_response',
        createdAt:      firebase.firestore.FieldValue.serverTimestamp(),
        vendorMessage:  null
      }).then(function () {
        var unsub;
        var timerHandle = setTimeout(function () {
          if (unsub) unsub();
          EscalationEngine._removePending(messagesEl, pendingId);
          db.collection('escalations').doc(escId)
            .update({ status: 'vendor_timeout' }).catch(function () {});
          EscalationEngine._appendVendorMsg(messagesEl,
            'Rất tiếc, ' + hostName + ' chưa phản hồi kịp lúc. ' +
            'Vui lòng liên hệ trực tiếp qua số ' + phone + '.',
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
            EscalationEngine._appendVendorMsg(messagesEl,
              '✓ ' + hostName + ' đã xác nhận!' + vmsg,
              'confirmed');
          } else if (status === 'vendor_declined') {
            EscalationEngine._appendVendorMsg(messagesEl,
              hostName + ' xin lỗi, không thể thực hiện.' + vmsg +
              ' Vui lòng liên hệ ' + phone + '.',
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

    _showPending: function (messagesEl) {
      var id  = 'esc_p_' + Date.now();
      var div = document.createElement('div');
      div.className = 'mp-ai__msg mp-ai__msg--bot';
      div.id        = id;
      div.innerHTML =
        '<div class="mp-ai__bubble mp-ai__bubble--pending">' +
          '<span class="mp-ai__pending-dot"></span>' +
          '<span class="mp-ai__pending-dot"></span>' +
          '<span class="mp-ai__pending-dot"></span>' +
          '&nbsp;Đang chờ xác nhận từ nhà hàng\u2026' +
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
      var bubble = document.createElement('div');
      bubble.className = 'mp-ai__bubble mp-ai__bubble--vendor mp-ai__bubble--vendor-' + (type || 'replied');
      bubble.textContent = text;
      div.appendChild(bubble);
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  };

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
    },

    _sendMessage: function (biz, text, messagesEl) {
      // ── Conversation history (per vendor, per page session) ─────────────
      if (!biz._aiHistory) biz._aiHistory = [];
      biz._aiHistory.push({ role: 'user', content: text });

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
      // Prefer _staticProducts (always current from services-data.js) when Firestore
      // items are sparse or still loading — same source-selection logic as _askClaude.
      var _bestProducts = (biz._staticProducts && biz._staticProducts.length > (biz.products || []).length)
        ? biz._staticProducts : (biz.products || []);
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

      // Hours / opening
      if (/gi[ờo]|hours?|m[ởo] c[ửu]a|open/.test(t)) {
        var hoursText = 'Giờ mở cửa:\n';
        Object.keys(biz.hours).forEach(function (day) {
          hoursText += '• ' + day + ': ' + biz.hours[day] + '\n';
        });
        return hoursText.trim();
      }

      // Pricing / services list
      if (/gi[áa]|price|b[ảa]ng gi[áa]|pricing|cost|ph[íi]/.test(t)) {
        var priceText = 'Bảng giá dịch vụ:\n';
        biz.services.forEach(function (svc) {
          priceText += '• ' + svc.name + ': ' + svc.price + ' (' + svc.duration + ')\n';
        });
        return priceText.trim();
      }

      // Address / location
      if (/[đd][ịi]a ch[ỉi]|address|location|[ởo] [đd][âa]u|[đd][ườo]ng/.test(t)) {
        return biz.name + ' tọa lạc tại ' + biz.address + '.\nĐặt hẹn và thắc mắc xin liên hệ: ' + biz.phoneDisplay;
      }

      // Booking
      if (/[đd][ặa]t l[ịi]ch|[đd][ặa]t b[àa]n|book|appointment|reservation|h[ẹe]n/.test(t)) {
        return 'Cuộn xuống phần đặt lịch phía dưới để đặt ' +
          (biz.bookingType === 'reservation' ? 'bàn' : 'lịch hẹn') +
          ' trực tuyến. Hoặc gọi trực tiếp: ' + biz.phoneDisplay + ' để được hỗ trợ ngay.';
      }

      // Services / menu
      if (/d[ịi]ch v[ụu]|service|l[àa]m g[ìi]|menu|th[ựu]c [đd][ơo]n/.test(t)) {
        var svcText = 'Dịch vụ của ' + biz.name + ':\n';
        biz.services.forEach(function (svc) {
          svcText += '• ' + svc.name + ' — ' + svc.price + '\n';
        });
        return svcText.trim();
      }

      // Phone / call
      if (/[đd]i[ệe]n tho[ại]i|phone|g[ọo]i|call|s[ốo] m[áa]y/.test(t)) {
        var phones = biz.hosts.map(function (h) {
          return h.name + ': ' + h.display + ' (' + h.role + ')';
        }).join('\n');
        return 'Liên hệ ' + biz.name + ':\n' + phones;
      }

      // Default
      return 'Cảm ơn bạn đã liên hệ ' + biz.name + '! Tôi có thể giúp bạn:\n' +
        '• Xem bảng giá dịch vụ\n' +
        '• Đặt lịch hẹn\n' +
        '• Giờ mở cửa\n' +
        '• Thông tin liên hệ\n\n' +
        'Bạn muốn hỏi gì ạ? Hoặc gọi trực tiếp: ' + biz.phoneDisplay;
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
        // Use the richer product list: _staticProducts (has full descriptions) vs Firestore products
        var products = (biz._staticProducts && biz._staticProducts.length > (biz.products || []).length)
          ? biz._staticProducts
          : (biz.products || []);

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
        var servicesBlock = '';
        if (biz.services && biz.services.length) {
          servicesBlock = 'SERVICES & PRICING:\n';
          biz.services.forEach(function (s) {
            servicesBlock += '- ' + s.name + ': ' + (s.price || '');
            if (s.duration) servicesBlock += ' (' + s.duration + ')';
            if (s.desc)     servicesBlock += ' — ' + s.desc;
            servicesBlock += '\n';
          });
          servicesBlock += '\n';
        }
        var hoursBlock = '';
        if (biz.hours) {
          hoursBlock = 'HOURS:\n';
          Object.keys(biz.hours).forEach(function (day) { hoursBlock += '- ' + day + ': ' + biz.hours[day] + '\n'; });
          hoursBlock += '\n';
        }
        systemPrompt =
          'You are ' + ai.name + ', appointment assistant for ' + biz.name + '.\n\n' +
          'TODAY: ' + todayStr + '\n"Tomorrow" = ' + tomorrowStr + '\n\n' +
          servicesBlock +
          hoursBlock +
          'CONTACT:\n- ' + hostName + ': ' + phone + '\n- Address: ' + biz.address + '\n\n' +
          'YOUR JOB — APPOINTMENT INTAKE AGENT:\n' +
          'Collect these fields in order, asking only the next missing one:\n' +
          '  1. SERVICE wanted  2. PREFERRED DATE & TIME  3. CUSTOMER NAME + PHONE\n\n' +
          sharedRules +
          '- PRICING: Answer pricing/hours questions directly from the data above.\n' +
          '- APPOINTMENT COMPLETE: Summarize service, date/time, name/phone, then end your message with [ESCALATE:appointment] on its own line — this forwards the request to the vendor for confirmation.';

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

      return fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 384,
          system: systemPrompt,
          messages: messages
        })
      }).then(function (res) {
        if (!res.ok) throw new Error('API error ' + res.status);
        return res.json();
      }).then(function (data) {
        return data.content && data.content[0] && data.content[0].text
          ? data.content[0].text
          : 'Xin lỗi, tôi không thể trả lời ngay lúc này.';
      });
    },

    // ── Deterministic pricing engine ──────────────────────────────────────────
    // Extracts a quantity from the message, matches to a product, returns calc.
    // Returns null if no quantity or no product could be determined.
    _computePrice: function (biz, text) {
      // Use richer of static vs Firestore products — same logic as _askClaude / _ruleBasedReply
      var _products = (biz._staticProducts && biz._staticProducts.length > (biz.products || []).length)
        ? biz._staticProducts : (biz.products || []);
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
      var div = document.createElement('div');
      div.className = 'mp-ai__msg mp-ai__msg--' + type;
      div.innerHTML = '<div class="mp-ai__bubble">' + escHtml(text) + '</div>';
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    },

    _appendTyping: function (container, id) {
      var div = document.createElement('div');
      div.className = 'mp-ai__msg mp-ai__msg--bot mp-ai__msg--typing';
      div.id = id;
      div.innerHTML = '<div class="mp-ai__bubble">•••</div>';
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
