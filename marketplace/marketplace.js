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
      '<div class="mp-footer__brand">Du Lịch Cali Services</div>' +
      '<div class="mp-footer__sub">© ' + new Date().getFullYear() + ' · dulichcali21.com · (714) 227-6007</div>' +
      '</footer>';
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

    var html =
      renderAppBar('/', 'Trang chủ', category.nameVi, null) +
      '<main class="mp-main">' +
        renderHero(
          'Du Lịch Cali · Services',
          category.nameVi,
          category.tagline,
          category.heroGradient,
          []
        ) +
        '<div class="mp-section">' +
          '<div class="mp-section-hdr">' +
            '<h2 class="mp-section-title">Danh sách dịch vụ</h2>' +
          '</div>' +
        '</div>' +
        '<div class="mp-grid">' + cardsHtml + '</div>' +
        '<div class="mp-spacer"></div>' +
      '</main>' +
      renderFooter();

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

  function renderHero(eyebrow, title, sub, gradient, ctas) {
    var ctasHtml = ctas.map(function (c) {
      return '<a href="' + c.href + '" class="mp-btn ' + c.cls + '">' +
        (c.icon || '') + escHtml(c.label) +
        '</a>';
    }).join('');

    return '<div class="mp-hero">' +
      '<div class="mp-hero__bg" style="background:' + gradient + '"></div>' +
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
        renderServicesSection(biz) +
        renderHoursSection(biz) +
        (biz.bookingEnabled ? renderBookingSection(biz) : '') +
        renderAiSection(biz) +
        renderContactSection(biz) +
        '<div class="mp-spacer"></div>' +
      '</main>' +
      renderFooter();

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
    return '<div class="mp-detail-hero">' +
      '<div class="mp-detail-hero__bg" style="background:' + biz.heroGradient + '"></div>' +
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
      '<div class="mp-booking-card">' +
        '<table class="mp-hours-table"><tbody>' + rowsHtml + '</tbody></table>' +
      '</div>' +
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
      '<div class="mp-booking-card">' +
        '<form id="bookingForm_' + biz.id + '" class="mp-booking-form">' +
          '<input type="hidden" name="_subject" value="Đặt lịch mới — ' + escAttr(biz.name) + '">' +
          '<input type="hidden" name="business" value="' + escAttr(biz.name) + '">' +
          '<input type="hidden" name="category" value="' + escAttr(biz.category) + '">' +
          '<input type="hidden" name="location" value="' + escAttr(biz.address) + '">' +
          '<div class="mp-form-row">' +
            '<label class="mp-label" for="bfName_' + biz.id + '">Họ & Tên</label>' +
            '<input class="mp-input" type="text" id="bfName_' + biz.id + '" name="name" placeholder="Nguyễn Văn A" required>' +
          '</div>' +
          '<div class="mp-form-row">' +
            '<label class="mp-label" for="bfPhone_' + biz.id + '">Số Điện Thoại</label>' +
            '<input class="mp-input" type="tel" id="bfPhone_' + biz.id + '" name="phone" placeholder="(714) 555-0000" required>' +
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
        if (vd.description) merged.description = vd.description;
        if (vd.heroImage)   merged.heroImage   = vd.heroImage;
        if (vd.active === false) merged.active  = false;
      }

      // Load menu items (no compound index required — filter client-side)
      vendorRef.collection('menuItems').get().then(function (snap) {
        if (!snap.empty) {
          var items = [];
          snap.forEach(function (d) {
            var item = d.data();
            if (item.active === false) return;   // skip inactive

            // Normalize variants: string[] or object[] → {id, label, labelEn}[]
            var variants = (item.variants || []).map(function (v, i) {
              if (v && typeof v === 'object' && v.id) return v;
              var s = String(v || '');
              var slug = s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || ('v' + i);
              return { id: slug, label: s, labelEn: s };
            });

            items.push({
              id: d.id,
              name: item.name || '',
              nameEn: item.nameEn || item.name || '',
              variants: variants,
              pricePerUnit: Number(item.price) || 0.50,
              unit: item.unit || 'each',
              unitEn: item.unit || 'each',
              minimumOrderQty: item.minimumOrderQty || 30,
              image: item.image || merged.heroImage || '',
              description: item.description || '',
              active: true,
              featured: !!item.featured,
              sortOrder: item.sortOrder || 0
            });
          });

          items.sort(function (a, b) { return a.sortOrder - b.sortOrder; });

          if (items.length > 0) {
            merged.products = items;

            // Refresh AI system prompt with live menu data
            if (merged.aiReceptionist) {
              var menuLines = items.map(function (it) {
                return it.name + ': $' + it.pricePerUnit.toFixed(2) + '/each, min ' + it.minimumOrderQty;
              }).join('; ');
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
        renderFoodVendorAbout(biz) +
        renderProductsSection(biz) +
        renderOrderInquirySection(biz) +
        renderAiSection(biz) +
        renderContactSection(biz) +
        '<div class="mp-spacer"></div>' +
      '</main>' +
      renderFooter();

    _container.innerHTML = html;

    if (biz.orderEnabled) {
      initOrderInquiryForm(biz);
    }

    if (biz.aiReceptionist && biz.aiReceptionist.enabled) {
      Receptionist.init(biz, 'aiWidget_' + biz.id);
    }
  }

  function renderFoodVendorHero(biz) {
    var bgStyle = biz.heroImage
      ? 'background-image:url(' + escAttr(biz.heroImage) + ');background-size:cover;background-position:center;'
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
      '<div class="mp-booking-card">' +
        '<p style="line-height:1.75;color:var(--text);font-size:.88rem">' + escHtml(biz.description) + '</p>' +
      '</div>' +
    '</div>';
  }

  function renderProductsSection(biz) {
    if (!biz.products || biz.products.length === 0) return '';

    var productsHtml = biz.products.filter(function (p) { return p.active; }).map(function (product) {
      var variantsHtml = (product.variants || []).map(function (v) {
        return '<span class="mp-product__variant">' + escHtml(v.labelEn) + '</span>';
      }).join('');

      var priceStr = '$' + product.pricePerUnit.toFixed(2) + ' / ' + escHtml(product.unitEn);
      var minTotal = '$' + (product.pricePerUnit * product.minimumOrderQty).toFixed(2);

      var imgHtml = product.image
        ? '<div class="mp-product-card__img-wrap">' +
            '<img class="mp-product-card__img" src="' + escAttr(product.image) + '" alt="' + escAttr(product.nameEn || product.name) + '" loading="lazy" onerror="this.parentElement.style.display=\'none\'">' +
          '</div>'
        : '';

      return '<div class="mp-product-card">' +
        imgHtml +
        '<div class="mp-product-card__body">' +
          '<div class="mp-product-card__name">' + escHtml(product.name) + '</div>' +
          '<p class="mp-product-card__desc">' + escHtml(product.description) + '</p>' +
          (variantsHtml ? '<div class="mp-product-card__variants">' + variantsHtml + '</div>' : '') +
          '<div class="mp-product-card__pricing">' +
            '<div class="mp-product-card__price">' + priceStr + '</div>' +
            '<div class="mp-product-card__minorder">' +
              'Min. order: <strong>' + product.minimumOrderQty + ' ' + escHtml(product.unitEn) + 's</strong> &nbsp;·&nbsp; ' + minTotal + ' minimum' +
            '</div>' +
          '</div>' +
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

    var variantOpts = (firstProduct && firstProduct.variants ? firstProduct.variants : []).map(function (v) {
      return '<option value="' + escAttr(v.id) + '">' + escHtml(v.labelEn) + '</option>';
    }).join('');

    return '<div class="mp-section" id="orderSection_' + biz.id + '">' +
      '<div class="mp-section-hdr">' +
        '<h2 class="mp-section-title">Đặt Hàng</h2>' +
      '</div>' +
      '<div class="mp-booking-card">' +
        '<p class="mp-form-note" style="margin-bottom:1.1rem">Điền thông tin để đặt hàng — chúng tôi sẽ xác nhận qua điện thoại. ' +
          '<strong style="color:var(--gold-lt)">Tối thiểu ' + minQty + ' cuốn (' + minTotal + ').</strong>' +
        '</p>' +
        '<form id="orderForm_' + biz.id + '" class="mp-booking-form">' +
          '<input type="hidden" name="_subject" value="Order Inquiry — ' + escAttr(biz.name) + '">' +
          '<input type="hidden" name="business" value="' + escAttr(biz.name) + '">' +
          '<input type="hidden" name="business_phone" value="' + escAttr(biz.phoneDisplay) + '">' +
          '<div class="mp-form-row">' +
            '<label class="mp-label" for="ofName_' + biz.id + '">Your Name</label>' +
            '<input class="mp-input" type="text" id="ofName_' + biz.id + '" name="customer_name" placeholder="Full name" required>' +
          '</div>' +
          '<div class="mp-form-row">' +
            '<label class="mp-label" for="ofPhone_' + biz.id + '">Phone Number</label>' +
            '<input class="mp-input" type="tel" id="ofPhone_' + biz.id + '" name="customer_phone" placeholder="(408) 555-0000" required>' +
          '</div>' +
          '<div class="mp-form-row">' +
            '<label class="mp-label" for="ofItem_' + biz.id + '">Item</label>' +
            '<select class="mp-input" id="ofItem_' + biz.id + '" name="item" required>' +
              '<option value="">— Select item —</option>' +
              itemOpts +
            '</select>' +
          '</div>' +
          '<div class="mp-form-row">' +
            '<label class="mp-label" for="ofVariant_' + biz.id + '">Type</label>' +
            '<select class="mp-input" id="ofVariant_' + biz.id + '" name="variant" required>' +
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
    var form = document.getElementById('orderForm_' + biz.id);
    var successDiv = document.getElementById('orderSuccess_' + biz.id);
    var qtyInput = document.getElementById('ofQty_' + biz.id);
    var subtotalDiv = document.getElementById('ofSubtotal_' + biz.id);
    var subtotalAmt = document.getElementById('ofSubtotalAmt_' + biz.id);
    var minWarn = document.getElementById('ofMinWarn_' + biz.id);
    var submitBtn = document.getElementById('ofSubmit_' + biz.id);

    if (!form || !successDiv) return;

    // Live estimated subtotal
    if (qtyInput && subtotalDiv && subtotalAmt) {
      qtyInput.addEventListener('input', function () {
        var qty = parseInt(qtyInput.value, 10) || 0;
        var price = parseFloat(qtyInput.getAttribute('data-price')) || 0.50;
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
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var qty = qtyInput ? (parseInt(qtyInput.value, 10) || 0) : 0;
      var minQty = qtyInput ? (parseInt(qtyInput.getAttribute('data-min'), 10) || 30) : 30;

      if (qty < minQty) {
        alert('Minimum order is ' + minQty + ' pieces. Please update the quantity.');
        if (qtyInput) qtyInput.focus();
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
      }

      var formData = new FormData(form);
      var price = qtyInput ? (parseFloat(qtyInput.getAttribute('data-price')) || 0.50) : 0.50;
      formData.set('estimated_total', '$' + (qty * price).toFixed(2));

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
              throw new Error((data.errors || []).map(function (err) { return err.message; }).join(', ') || 'Send failed');
            });
          }
        })
        .catch(function (err) {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Order Inquiry';
          }
          alert('Error: ' + err.message + '\nPlease call directly: ' + biz.phoneDisplay);
        });
    });
  }

  // ── AI Receptionist ────────────────────────────────────────────────────────────

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
    },

    _sendMessage: function (biz, text, messagesEl) {
      // Add user bubble
      Receptionist._appendMessage(messagesEl, text, 'user');

      // Show typing indicator
      var typingId = 'typing_' + Date.now();
      Receptionist._appendTyping(messagesEl, typingId);

      // Try Claude API first if key exists
      var apiKey = null;
      try {
        apiKey = localStorage.getItem('dlc_claude_key');
      } catch (e) {}

      if (apiKey) {
        Receptionist._askClaude(biz, text, apiKey)
          .then(function (reply) {
            Receptionist._removeTyping(messagesEl, typingId);
            Receptionist._appendMessage(messagesEl, reply, 'bot');
          })
          .catch(function () {
            // Fall back to rule-based
            Receptionist._removeTyping(messagesEl, typingId);
            var reply = Receptionist._ruleBasedReply(biz, text);
            Receptionist._appendMessage(messagesEl, reply, 'bot');
          });
      } else {
        // Simulate short delay for natural feel
        setTimeout(function () {
          Receptionist._removeTyping(messagesEl, typingId);
          var reply = Receptionist._ruleBasedReply(biz, text);
          Receptionist._appendMessage(messagesEl, reply, 'bot');
        }, 650);
      }
    },

    _ruleBasedReply: function (biz, text) {
      var t = text.toLowerCase();

      // Greetings
      if (/xin ch[àa]o|hello|hi\b|ch[àa]o|hey/.test(t)) {
        return biz.aiReceptionist.welcomeMessage;
      }

      // ── Food vendor specific ────────────────────────────────────────────────
      if (biz.vendorType === 'foodvendor' && biz.products && biz.products.length > 0) {
        var fp = biz.products[0];

        // Raw vs fresh / type selection
        if (/raw|s[ôo]ng|t[ươu][ởo]i|fresh|lo[ạa]i|types?|ki[êe]u|ch[ọo]n/.test(t)) {
          return 'We offer two types:\n• Raw (Sống) — uncooked, fry fresh at home for maximum crunch\n• Fresh (Tươi) — fully cooked and ready to eat\n\nBoth are $' + fp.pricePerUnit.toFixed(2) + ' each. Minimum ' + fp.minimumOrderQty + ' pieces per order.';
        }

        // Minimum order
        if (/minimum|t[ốo]i thi[ểe]u|[íi]t nh[ấa]t|less than|fewer|under|[íi]t h[ơo]n/.test(t)) {
          return 'Our minimum order is ' + fp.minimumOrderQty + ' eggrolls ($' + (fp.pricePerUnit * fp.minimumOrderQty).toFixed(2) + ' total). This ensures freshness and quality for every batch. We cannot process orders under ' + fp.minimumOrderQty + ' pieces.';
        }

        // Pricing
        if (/gi[áa]|price|cost|bao nhi[êe]u|how much|ph[íi]|ti[êề]n/.test(t)) {
          return 'Eggroll (Chả Giò): $' + fp.pricePerUnit.toFixed(2) + ' per piece\nMinimum order: ' + fp.minimumOrderQty + ' pieces\nMinimum total: $' + (fp.pricePerUnit * fp.minimumOrderQty).toFixed(2) + '\n\nScroll down to use the order form, or call Loan at ' + biz.phoneDisplay + '.';
        }

        // What is sold / menu
        if (/ch[ảa] gi[òo]|eggroll|egg.?roll|menu|b[áa]n g[ìi]|sell|what.*have/.test(t)) {
          return 'We make handmade Vietnamese Eggrolls (Chả Giò)!\n• Filling: pork, mushroom & carrot\n• Wrapped in thin crispy rice paper\n• Option: Raw (fry at home) or Fresh (ready to eat)\n• $0.50 each · Min 30 pieces ($15.00)\n\nPerfect for family dinners, gatherings & parties!';
        }

        // Pickup / delivery
        if (/pickup|pick.?up|l[ấa]y h[àà]ng|[đd][ếe]n l[ấa]y|delivery|giao h[àà]ng|ship/.test(t)) {
          return 'Pickup address:\n' + biz.address + '\n\nFor delivery arrangements, contact Loan at ' + biz.phoneDisplay + ' to coordinate.';
        }

        // How to order
        if (/[đd][ặa]t h[àà]ng|order|c[áa]ch [đd][ặa]t|mua|buy|how.*order/.test(t)) {
          return 'To place an order:\n1. Use the order inquiry form on this page (scroll down)\n2. Or call Loan directly at ' + biz.phoneDisplay + '\n\nMin order: ' + fp.minimumOrderQty + ' eggrolls ($' + (fp.pricePerUnit * fp.minimumOrderQty).toFixed(2) + ').';
        }
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

    _askClaude: function (biz, text, apiKey) {
      var ai = biz.aiReceptionist;
      var systemPrompt = 'You are ' + ai.name + ', receptionist for ' + biz.name + ' in ' + biz.city + '. ' +
        (ai.systemExtra || '') +
        ' Keep responses concise (2-3 sentences max). Always offer to help with booking.';

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
          max_tokens: 256,
          system: systemPrompt,
          messages: [{ role: 'user', content: text }]
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
