/**
 * landing-nav.js — DuLichCali service landing pages shared module
 * Handles: vendor availability, card rendering, bottom nav, empty state
 * v1.0 2026-04
 */
(function (global) {
  'use strict';

  // ── Availability helpers (mirrors script.js logic) ────────────────────────────
  function _hoursForDay(biz, jsDay) {
    var h = biz.hours;
    if (!h) return null;
    var thuNum = jsDay === 0 ? null : jsDay + 1;
    var keys = Object.keys(h);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k === 'Chủ Nhật') { if (jsDay === 0) return h[k]; continue; }
      var m = k.match(/Thứ\s*(\d+)(?:[–\-](\d+))?/);
      if (!m || thuNum === null) continue;
      var s = parseInt(m[1], 10), e = m[2] ? parseInt(m[2], 10) : s;
      if (thuNum >= s && thuNum <= e) return h[k];
    }
    return null;
  }

  function _parseTime(str) {
    var m = (str || '').trim().match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return null;
    var h = parseInt(m[1], 10), min = parseInt(m[2], 10), pm = m[3].toUpperCase() === 'PM';
    if (pm && h !== 12) h += 12;
    if (!pm && h === 12) h = 0;
    return h * 60 + min;
  }

  function _fmtMins(t) {
    var h = Math.floor(t / 60), m = t % 60, sfx = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12; if (h === 0) h = 12;
    return h + (m ? ':' + String(m).padStart(2, '0') : '') + '\u202f' + sfx;
  }

  function computeAvail(biz) {
    if (biz.availabilityType === 'order_window')
      return { status: 'order', label: 'Đang nhận đơn', sub: 'Giao cuối tuần' };
    var now = new Date(), day = now.getDay(), cur = now.getHours() * 60 + now.getMinutes();
    var hs = _hoursForDay(biz, day);
    if (hs && hs !== 'Nghỉ') {
      var parts = hs.split('–').map(function (s) { return s.trim(); });
      var op = _parseTime(parts[0]), cl = _parseTime(parts[1]);
      if (op !== null && cl !== null) {
        if (cur >= op && cur < cl) return { status: 'now',  label: 'Đang mở cửa', sub: 'Đến ' + _fmtMins(cl) };
        if (cur < op)              return { status: 'soon', label: 'Mở cửa sớm',  sub: 'Lúc ' + _fmtMins(op) };
      }
    }
    var VI = ['Chủ Nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
    for (var i = 1; i <= 6; i++) {
      var d = (day + i) % 7, dh = _hoursForDay(biz, d);
      if (dh && dh !== 'Nghỉ') return { status: 'soon', label: 'Mở ' + VI[d], sub: '' };
    }
    return { status: 'closed', label: 'Tạm đóng', sub: '' };
  }

  // ── Vendor admin-status from Firestore ────────────────────────────────────────
  var _adminStatus = {};

  function loadAdminStatus() {
    if (typeof firebase === 'undefined' || !firebase.firestore) return Promise.resolve();
    return firebase.firestore().collection('vendors').get()
      .then(function (snap) {
        snap.docs.forEach(function (doc) {
          var s = doc.data().adminStatus;
          if (s) _adminStatus[doc.id] = s;
        });
      })
      .catch(function () {}); // fail open
  }

  function isVendorActive(id) {
    var s = _adminStatus[id];
    return !s || s === 'active';
  }

  // ── HTML escape ───────────────────────────────────────────────────────────────
  function esc(v) {
    return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Vendor card ───────────────────────────────────────────────────────────────
  var _CAT_PATH = { nails: '/nailsalon/', hair: '/hairsalon/', food: '/foods/' };

  function buildVendorCard(biz) {
    var av   = computeAvail(biz);
    var href = (_CAT_PATH[biz.category] || ('/marketplace/?cat=' + biz.category)) + '?id=' + esc(biz.id);
    var bg   = biz.heroImage
      ? 'background:' + biz.heroGradient + ';background-image:url(' + biz.heroImage + ');background-size:cover;background-position:center'
      : 'background:' + (biz.heroGradient || 'var(--navy-800)');
    var ph  = (biz.hosts && biz.hosts[0]) ? biz.hosts[0].phone    : (biz.phone || '');
    var phD = (biz.hosts && biz.hosts[0]) ? (biz.hosts[0].display || ph) : (biz.phoneDisplay || ph);

    return (
      '<div class="lp-vendor-card" onclick="location.href=\'' + href + '\'" tabindex="0"' +
           ' onkeydown="if(event.key===\'Enter\')location.href=\'' + href + '\'">' +
        '<div class="lp-vendor-card__img" style="' + bg + '">' +
          '<span class="lp-avail lp-avail--' + av.status + '">' + esc(av.label) + '</span>' +
        '</div>' +
        '<div class="lp-vendor-card__body">' +
          '<div class="lp-vendor-card__name">' + esc(biz.name) + '</div>' +
          '<div class="lp-vendor-card__city">' + esc(biz.city) + '</div>' +
          (biz.shortPromoText ? '<div class="lp-vendor-card__promo">' + esc(biz.shortPromoText) + '</div>' : '') +
          (av.sub ? '<div class="lp-vendor-card__hours">' + esc(av.sub) + '</div>' : '') +
          (phD ? '<a class="lp-vendor-card__phone" href="tel:' + ph + '" onclick="event.stopPropagation()">' + esc(phD) + '</a>' : '') +
        '</div>' +
      '</div>'
    );
  }

  // ── Status panels ─────────────────────────────────────────────────────────────
  function _loading(el) {
    el.innerHTML = '<div class="lp-status-panel lp-loading">' +
      '<div class="lp-loading__dot"></div><div class="lp-loading__dot"></div><div class="lp-loading__dot"></div>' +
    '</div>';
  }

  function _empty(el, category, aiEntry) {
    var nm = { food:'cửa hàng ăn uống', hair:'tiệm tóc', nails:'tiệm nail', rides:'dịch vụ xe', tour:'tour du lịch' };
    el.innerHTML = (
      '<div class="lp-status-panel lp-empty">' +
        '<div class="lp-empty__icon">🔍</div>' +
        '<p class="lp-empty__title">Hiện không có ' + (nm[category] || 'dịch vụ') + ' khả dụng</p>' +
        '<p class="lp-empty__sub">Vui lòng thử lại sau hoặc liên hệ trực tiếp.</p>' +
        '<a href="tel:4089163439" class="lp-empty__cta">📞 Gọi: 408-916-3439</a>' +
        '<a href="/?entry=' + esc(aiEntry) + '" class="lp-empty__ai">Hỏi AI để được hỗ trợ</a>' +
      '</div>'
    );
  }

  // ── Vendor grid ───────────────────────────────────────────────────────────────
  function renderVendors(el, category, aiEntry) {
    if (!global.MARKETPLACE) { _empty(el, category, aiEntry); return; }
    var avOrder = { now: 0, order: 1, soon: 2, closed: 3 };
    var vendors = global.MARKETPLACE.businesses
      .filter(function (b) { return b.category === category && b.active && isVendorActive(b.id); })
      .sort(function (a, b) {
        return (avOrder[computeAvail(a).status] || 9) - (avOrder[computeAvail(b).status] || 9);
      });

    if (!vendors.length) { _empty(el, category, aiEntry); return; }
    el.innerHTML = '<div class="lp-vendor-grid">' + vendors.map(buildVendorCard).join('') + '</div>';
  }

  // ── Rides availability ────────────────────────────────────────────────────────
  function renderRidesReady(el, driver) {
    var vName = (driver && driver.vehicle)
      ? [driver.vehicle.make, driver.vehicle.model, driver.vehicle.year].filter(Boolean).join(' ')
      : 'Tesla Model Y';
    var seats = (driver && driver.vehicle && driver.vehicle.seats) ? driver.vehicle.seats : 4;
    el.innerHTML = (
      '<div class="lp-rides-ready">' +
        '<div class="lp-rides-ready__hdr">' +
          '<span class="lp-avail lp-avail--now" style="position:static;display:inline-block">Xe Sẵn Sàng</span>' +
          '<div class="lp-rides-ready__vehicle">' + esc(vName) + ' &middot; ' + seats + ' chỗ &middot; <span style="color:var(--gold)">−20% Uber</span></div>' +
        '</div>' +
        '<div class="lp-rides-ready__grid">' +
          '<button class="lp-rides-tile" onclick="window.RideIntake&&RideIntake.open?RideIntake.open(\'pickup\'):location.href=\'/?entry=airport\'">' +
            '<span>🛬</span><strong>Đón Sân Bay</strong><em>Bay đến · Arrivals</em>' +
          '</button>' +
          '<button class="lp-rides-tile" onclick="window.RideIntake&&RideIntake.open?RideIntake.open(\'dropoff\'):location.href=\'/?entry=airport\'">' +
            '<span>🛫</span><strong>Ra Sân Bay</strong><em>Bay đi · Đón tại nhà</em>' +
          '</button>' +
          '<button class="lp-rides-tile lp-rides-tile--wide" onclick="window.RideIntake&&RideIntake.open?RideIntake.open(\'ride\'):location.href=\'/?entry=airport\'">' +
            '<span>🚗</span><strong>Xe Riêng Cao Cấp</strong><em>Bất kỳ điểm nào</em>' +
          '</button>' +
        '</div>' +
      '</div>'
    );
  }

  function checkRides(el, aiEntry) {
    if (typeof firebase === 'undefined' || !firebase.firestore) {
      // Firebase not available — show CTAs anyway (fail open)
      renderRidesReady(el, null);
      return;
    }
    firebase.firestore().collection('drivers').where('active', '==', true).get()
      .then(function (snap) {
        var now = new Date(), day = now.getDay(), nowMins = now.getHours() * 60 + now.getMinutes();
        var todayStr = now.toISOString().split('T')[0];
        var regionId = (global.DLCRegion && global.DLCRegion.current) ? global.DLCRegion.current.id : '';

        var avail = snap.docs.filter(function (doc) {
          var d = doc.data();
          if (regionId && !(d.regions || []).includes(regionId)) return false;
          if (((d.availability || {}).blackoutDates || []).includes(todayStr)) return false;
          var sched = ((d.availability || {}).weeklySchedule || {})[day];
          if (!sched || !sched.enabled) return false;
          var p = function (t) { var a = (t || '0:0').split(':'); return parseInt(a[0]) * 60 + (parseInt(a[1]) || 0); };
          return nowMins >= p(sched.start) && nowMins <= p(sched.end);
        }).map(function (d) { return Object.assign({ id: d.id }, d.data()); });

        global._rideServiceAvailable = avail.length > 0;
        global._availableDrivers = avail;
        global._activeDrivers = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });

        if (avail.length) {
          renderRidesReady(el, avail[0]);
        } else {
          el.innerHTML = (
            '<div class="lp-status-panel lp-empty">' +
              '<div class="lp-empty__icon">🚫</div>' +
              '<p class="lp-empty__title">Hiện không có tài xế khả dụng</p>' +
              '<p class="lp-empty__sub">Tài xế chưa có lịch trống.<br>Liên hệ để đặt xe trước.</p>' +
              '<a href="tel:4089163439" class="lp-empty__cta">📞 Gọi: 408-916-3439</a>' +
              '<a href="/?entry=' + esc(aiEntry) + '" class="lp-empty__ai">Đặt lịch qua AI</a>' +
            '</div>'
          );
        }
      })
      .catch(function () { renderRidesReady(el, null); }); // fail open
  }

  // ── SVG icons ─────────────────────────────────────────────────────────────────
  var I = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    food: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>',
    scissors: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>',
    nails: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a5 5 0 015 5v6a5 5 0 01-10 0V7a5 5 0 015-5z"/><path d="M9 17v2a3 3 0 006 0v-2"/></svg>',
    car:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17H3a2 2 0 01-2-2v-3a2 2 0 012-2h13l3 4v3a2 2 0 01-2 2h-1"/><circle cx="7" cy="17" r="2"/><circle cx="15" cy="17" r="2"/></svg>',
    map:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 00-8 8c0 5.25 7.5 12 8 12s8-6.75 8-12a8 8 0 00-8-8z"/></svg>',
    plane:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>',
  };

  // ── Bottom nav ────────────────────────────────────────────────────────────────
  function injectNav(cfg) {
    var wrap = document.getElementById('lpNav');
    if (!wrap) return;

    var scrollAction = "var s=document.getElementById('lpVendorSection');if(s)s.scrollIntoView({behavior:'smooth'})";
    var aiHref = '/?entry=' + cfg.aiEntry;

    var tabs = [
      { icon: cfg.tab1Icon || I.home,     label: cfg.tab1Label || 'Trang Chủ', action: 'location.href="' + cfg.tab1Href + '"',                       active: true  },
      { icon: cfg.tab2Icon || I.book,     label: cfg.tab2Label || 'Đặt Ngay',  action: cfg.tab2Action || ('location.href="' + (cfg.tab2Href||'/') + '"'), active: false },
      { icon: I.chat,                     label: 'AI',                          action: 'location.href="' + aiHref + '"',                              center: true  },
      { icon: cfg.tab4Icon || I.grid,     label: cfg.tab4Label || 'Dịch Vụ',   action: scrollAction,                                                  active: false },
      { icon: I.home,                     label: 'Du Lịch Cali',               action: 'location.href="/"',                                           active: false },
    ];

    var html = '<nav class="bottom-nav lp-nav-fixed" role="navigation" aria-label="' + esc(cfg.tab1Label || 'Service') + ' navigation">';
    tabs.forEach(function (tab) {
      var cls = 'nav-tab' + (tab.active ? ' nav-tab--active' : '') + (tab.center ? ' nav-tab--center' : '');
      if (tab.center) {
        html += '<button class="' + cls + '" onclick="' + tab.action + '" aria-label="Mở AI">' +
          '<div class="nav-center-btn" aria-hidden="true">' + tab.icon + '</div>' +
          '<span>' + tab.label + '</span></button>';
      } else {
        html += '<button class="' + cls + '" onclick="' + tab.action + '">' +
          tab.icon + '<span>' + tab.label + '</span></button>';
      }
    });
    html += '</nav>';
    wrap.innerHTML = html;
  }

  // ── Public init ───────────────────────────────────────────────────────────────
  global.LandingNav = {
    init: function (cfg) {
      // Add bottom-nav padding to body
      document.body.style.paddingBottom = 'calc(64px + env(safe-area-inset-bottom,0px))';

      injectNav(cfg);

      var el = document.getElementById('lpVendorGrid');
      if (!el) return;
      _loading(el);

      if (cfg.category === 'rides') {
        checkRides(el, cfg.aiEntry);
      } else if (cfg.category && cfg.category !== 'tour') {
        if (typeof firebase !== 'undefined' && firebase.firestore) {
          loadAdminStatus().then(function () { renderVendors(el, cfg.category, cfg.aiEntry); });
        } else {
          renderVendors(el, cfg.category, cfg.aiEntry);
        }
      }
    }
  };

}(window));
