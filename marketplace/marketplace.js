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
    return '<div class="mp-biz-card" data-id="' + escHtml(biz.id) + '">' +
      '<div class="mp-biz-card__hero">' +
        '<div class="mp-biz-card__hero-bg" style="background:' + biz.heroGradient + '"></div>' +
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
