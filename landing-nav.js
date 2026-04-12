/**
 * landing-nav.js — DuLichCali service landing pages shared module
 * Handles: vendor availability, card rendering, bottom nav, in-page AI overlay
 * v2.0 2026-04
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
      .catch(function () {});
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
    var nm = { food:'restaurants', hair:'hair salons', nails:'nail salons', rides:'ride services', tour:'tours' };
    el.innerHTML = (
      '<div class="lp-status-panel lp-empty">' +
        '<div class="lp-empty__icon">🔍</div>' +
        '<p class="lp-empty__title">No ' + (nm[category] || 'services') + ' currently available</p>' +
        '<p class="lp-empty__sub">Please try again later or contact us directly.</p>' +
        '<a href="tel:4089163439" class="lp-empty__cta">Call: 408-916-3439</a>' +
        '<button onclick="LandingNav.openChat()" class="lp-empty__ai" style="background:none;border:none;cursor:pointer;text-decoration:underline;color:var(--gold,#f5a623);font-size:.8rem">Ask AI for help</button>' +
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
      renderRidesReady(el, null);
      return;
    }
    firebase.firestore().collection('drivers').where('adminStatus', '==', 'active').get()
      .then(function (snap) {
        var now = new Date(), day = now.getDay(), nowMins = now.getHours() * 60 + now.getMinutes();
        var todayStr = now.toISOString().split('T')[0];
        var regionId = (global.DLCRegion && global.DLCRegion.current) ? global.DLCRegion.current.id : '';

        var avail = snap.docs.filter(function (doc) {
          var d = doc.data();
          // Compliance gate — must be fully approved
          if (d.complianceStatus !== 'approved') return false;
          // Admin status gate
          if (d.adminStatus && d.adminStatus !== 'active') return false;
          // Real-time expiration enforcement (mirrors set by admin on approval)
          if (d.licExpiry && d.licExpiry < todayStr) return false;
          if (d.regExpiry && d.regExpiry < todayStr) return false;
          if (d.insExpiry && d.insExpiry < todayStr) return false;
          // Schedule / region checks
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
              '<p class="lp-empty__title">No drivers currently available</p>' +
              '<p class="lp-empty__sub">No drivers have open slots right now.<br>Contact us to schedule ahead.</p>' +
              '<a href="tel:4089163439" class="lp-empty__cta">Call: 408-916-3439</a>' +
              '<a href="/?entry=' + esc(aiEntry) + '" class="lp-empty__ai">Book via AI</a>' +
            '</div>'
          );
        }
      })
      .catch(function () { renderRidesReady(el, null); });
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
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  };

  // ── In-page AI chat overlay ────────────────────────────────────────────────────

  // Inject overlay CSS once
  function _injectChatStyles() {
    if (document.getElementById('lp-chat-styles')) return;
    var s = document.createElement('style');
    s.id = 'lp-chat-styles';
    s.textContent = [
      '#lpChatOverlay{position:fixed;inset:0;z-index:2000;background:rgba(10,35,68,.72);display:flex;',
        'align-items:flex-end;justify-content:center;',
        'animation:lpFdIn .18s ease;}',
      '@keyframes lpFdIn{from{opacity:0}to{opacity:1}}',

      '#lpChatPanel{width:100%;max-width:500px;background:#0d2f50;',
        'border-radius:20px 20px 0 0;border-top:1px solid rgba(245,166,35,.4);',
        'max-height:82vh;display:flex;flex-direction:column;',
        'animation:lpSlUp .28s cubic-bezier(.32,.72,0,1);',
        'padding-bottom:env(safe-area-inset-bottom,0px);}',
      '@keyframes lpSlUp{from{transform:translateY(100%)}to{transform:translateY(0)}}',

      '.lp-ch__hdr{display:flex;align-items:center;gap:.6rem;padding:.9rem 1rem .75rem;',
        'border-bottom:1px solid rgba(255,255,255,.1);flex-shrink:0;}',
      '.lp-ch__back{background:none;border:none;color:#6ab0d4;cursor:pointer;',
        'font-size:1.3rem;padding:0 .3rem;line-height:1;display:none;',
        '-webkit-tap-highlight-color:transparent;}',
      '.lp-ch__back.vis{display:block;}',
      '.lp-ch__info{flex:1;min-width:0;}',
      '.lp-ch__title{font-family:"Bodoni Moda",Georgia,serif;font-size:.95rem;color:#fff8ee;',
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.lp-ch__sub{font-size:.6rem;color:#6ab0d4;text-transform:uppercase;letter-spacing:.08em;}',
      '.lp-ch__close{background:none;border:none;color:#6ab0d4;cursor:pointer;',
        'font-size:1rem;padding:.3rem .5rem;margin-left:auto;flex-shrink:0;',
        '-webkit-tap-highlight-color:transparent;}',

      '.lp-ch__msgs{flex:1;overflow-y:auto;padding:.75rem 1rem;',
        'display:flex;flex-direction:column;gap:.55rem;',
        '-webkit-overflow-scrolling:touch;}',

      '.lp-ch__bbl{max-width:84%;padding:.6rem .85rem;border-radius:14px;',
        'font-size:.84rem;line-height:1.55;white-space:pre-wrap;word-break:break-word;',
        'font-family:"Jost",system-ui,sans-serif;}',
      '.lp-ch__bbl--bot{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);',
        'color:#c8e4f8;align-self:flex-start;}',
      '.lp-ch__bbl--usr{background:#f5a623;color:#0a2344;align-self:flex-end;font-weight:500;}',

      '.lp-ch__typing{display:flex;gap:4px;align-items:center;',
        'padding:.45rem .85rem;align-self:flex-start;}',
      '.lp-ch__typing span{width:7px;height:7px;background:#6ab0d4;border-radius:50%;',
        'animation:lpDot .9s infinite;}',
      '.lp-ch__typing span:nth-child(2){animation-delay:.15s;}',
      '.lp-ch__typing span:nth-child(3){animation-delay:.3s;}',
      '@keyframes lpDot{0%,80%,100%{transform:scale(.6);opacity:.35}40%{transform:scale(1);opacity:1}}',

      '.lp-ch__vpick{display:flex;flex-direction:column;gap:.5rem;',
        'padding:.5rem 1rem .75rem;overflow-y:auto;flex-shrink:0;}',
      '.lp-ch__vpick-lbl{font-size:.68rem;font-weight:700;letter-spacing:.1em;',
        'text-transform:uppercase;color:#6ab0d4;margin-bottom:.1rem;}',
      '.lp-ch__vbtn{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.13);',
        'border-radius:10px;padding:.8rem 1rem;text-align:left;cursor:pointer;',
        'color:#c8e4f8;font-size:.85rem;font-family:"Jost",system-ui,sans-serif;',
        'transition:border-color .15s,background .15s;',
        '-webkit-tap-highlight-color:transparent;}',
      '.lp-ch__vbtn:hover,.lp-ch__vbtn:active{border-color:rgba(245,166,35,.45);',
        'background:rgba(245,166,35,.08);}',
      '.lp-ch__vbtn__nm{font-weight:600;color:#fff8ee;margin-bottom:.2rem;}',
      '.lp-ch__vbtn__sub{font-size:.71rem;color:#6ab0d4;}',

      '.lp-ch__chips{display:flex;flex-wrap:wrap;gap:.4rem;',
        'padding:.4rem 1rem .35rem;flex-shrink:0;}',
      '.lp-ch__chip{background:rgba(245,166,35,.1);border:1px solid rgba(245,166,35,.28);',
        'color:#ffc857;border-radius:20px;font-size:.72rem;padding:.32rem .75rem;',
        'cursor:pointer;white-space:nowrap;font-family:"Jost",system-ui,sans-serif;',
        'transition:background .15s;-webkit-tap-highlight-color:transparent;}',
      '.lp-ch__chip:hover,.lp-ch__chip:active{background:rgba(245,166,35,.2);}',

      '.lp-ch__row{display:flex;gap:.5rem;padding:.6rem 1rem .75rem;',
        'border-top:1px solid rgba(255,255,255,.08);flex-shrink:0;}',
      '.lp-ch__inp{flex:1;background:rgba(255,255,255,.06);',
        'border:1px solid rgba(255,255,255,.14);border-radius:22px;',
        'padding:.55rem 1rem;color:#fff8ee;font-size:.88rem;',
        'font-family:"Jost",system-ui,sans-serif;outline:none;}',
      '.lp-ch__inp:focus{border-color:rgba(245,166,35,.5);}',
      '.lp-ch__inp::placeholder{color:#6ab0d4;}',
      '.lp-ch__snd{background:#f5a623;border:none;border-radius:50%;',
        'width:42px;height:42px;cursor:pointer;flex-shrink:0;',
        'display:flex;align-items:center;justify-content:center;',
        'color:#0a2344;-webkit-tap-highlight-color:transparent;}',
      '.lp-ch__snd svg{pointer-events:none;}',

      '.lp-ch__no-vendor{padding:1.5rem 1rem;text-align:center;color:#6ab0d4;font-size:.85rem;',
        'line-height:1.6;}',
      '.lp-ch__no-vendor a{color:#f5a623;}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── Get active vendors for a category ────────────────────────────────────────
  function _activeVendors(category) {
    if (!global.MARKETPLACE) return [];
    return global.MARKETPLACE.businesses.filter(function (b) {
      if (b.category !== category) return false;
      if (b.active === false) return false;
      if (!isVendorActive(b.id)) return false;
      // Must have at least one active service
      var svcs = (b.services || []);
      if (svcs.length && !svcs.some(function (s) { return s.active !== false; })) return false;
      return true;
    });
  }

  // ── Rule-based reply using live vendor data ───────────────────────────────────
  function _lpReply(biz, text) {
    var t = text.toLowerCase();
    var activeSvcs  = (biz.services || []).filter(function (s) { return s.active !== false; });
    var activeStaff = (biz.staff    || []).filter(function (m) { return m.active !== false; });
    var ai  = biz.aiReceptionist || {};
    var isVi = /[\u00C0-\u024F\u1E00-\u1EFF]|h[ôo]m nay|c[óo] ai|r[ảa]nh|ti[ệe]m|gi[áa]|ch[àa]o|b[ạa]n/.test(text);

    // Greetings
    if (/xin ch[àa]o|hello|hi\b|ch[àa]o|hey/.test(t)) {
      return ai.welcomeMessage || ('Hi! How can I help you at ' + biz.name + '?');
    }

    // Staff today helper
    function _workingToday(staffList) {
      var dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];
      return staffList.filter(function (m) {
        if (!m.schedule || !m.schedule.days || !m.schedule.days.length) return true;
        return m.schedule.days.indexOf(dow) !== -1;
      });
    }

    // Staff availability
    if (/\bavail|who.*(?:work|free|in\b|on\b|today|now)\b|(?:free|work).*\btoday\b|ai.*r[ảa]nh|r[ảa]nh.*kh[ôo]ng|c[óo]\s*ai|h[ôo]m nay.*ai|ai.*h[ôo]m nay|is\s+\w+\s+(?:available|in|working|free)|staff\b|th[ợ]|th[àa]nh vi[êe]n/i.test(text) ||
        /(?:helen|tracy)\s*(?:available|free|in|working|today|r[ảa]nh|c[óo])/i.test(text)) {

      var todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long' });

      // Check for specific person
      var person = null;
      activeStaff.forEach(function (m) {
        if (new RegExp('\\b' + m.name + '\\b', 'i').test(text)) person = m;
      });
      if (person) {
        var pw = _workingToday([person]).length > 0;
        return isVi
          ? (pw ? person.name + ' có mặt hôm nay.\nChuyên môn: ' + (person.specialties || []).join(', ') + '.'
                : person.name + ' không có lịch hôm nay. Gọi ' + biz.phoneDisplay + ' để hỏi thêm.')
          : (pw ? person.name + ' is available today.\nSpecialties: ' + (person.specialties || []).join(', ') + '.'
                : person.name + ' is not scheduled today. Call ' + biz.phoneDisplay + '.');
      }

      if (!activeStaff.length) {
        return isVi ? 'Gọi ' + biz.phoneDisplay + ' để hỏi lịch thợ nhé.' : 'Call ' + biz.phoneDisplay + ' to check staff schedule.';
      }
      var working = _workingToday(activeStaff);
      if (!working.length) {
        return isVi ? 'Hôm nay chưa có thợ. Gọi ' + biz.phoneDisplay : 'No staff scheduled today. Call ' + biz.phoneDisplay;
      }
      var staffLines = working.map(function (m) {
        return '• ' + m.name + (m.role ? ' — ' + m.role : '') +
               (m.specialties && m.specialties.length ? '\n  ' + m.specialties.join(', ') : '');
      }).join('\n');
      return isVi
        ? 'Hôm nay (' + todayLabel + '):\n' + staffLines
        : 'Available today (' + todayLabel + '):\n' + staffLines;
    }

    // Specific service inquiry
    if (/do\s+you\s+(?:do|offer|have)|can\s+you\s+do|c[óo]\s+(?:d[ịi]ch|l[àa]m)|b[ạa]n\s+c[óo]\s+l[àa]m/.test(t)) {
      var svcKws = ['gel','acrylic','pedicure','manicure','nail art','spa','ombre','dip'];
      var mSvc = null;
      svcKws.forEach(function (kw) {
        if (!mSvc && t.indexOf(kw) !== -1) {
          mSvc = activeSvcs.find(function (s) { return s.name.toLowerCase().indexOf(kw) !== -1; });
        }
      });
      if (mSvc) {
        return (isVi ? 'Có! ' : 'Yes! ') + mSvc.name + ': ' + mSvc.price +
          (mSvc.duration ? ' (' + mSvc.duration + ')' : '') +
          (mSvc.desc ? '\n' + mSvc.desc : '');
      }
    }

    // Walk-in
    if (/walk.?in|kh[ôo]ng.*h[ẹe]n|drop.?in/.test(t)) {
      return isVi
        ? biz.name + ' nhận walk-in và đặt lịch trước. Đặt trước được ưu tiên.'
        : biz.name + ' accepts walk-ins and appointments. Appointments are prioritized.';
    }

    // Hours
    if (/gi[ờo]\s*(?:m[ởo]|l[àa]m)|hours?|m[ởo]\s*c[ửu]a|open|close|[đd][óo]ng/.test(t)) {
      if (!biz.hours) return isVi ? 'Gọi ' + biz.phoneDisplay + ' để hỏi giờ.' : 'Call ' + biz.phoneDisplay + ' for hours.';
      var ht = (isVi ? 'Giờ mở cửa:\n' : 'Hours:\n');
      Object.keys(biz.hours).forEach(function (d) { ht += '• ' + d + ': ' + biz.hours[d] + '\n'; });
      return ht.trim();
    }

    // Pricing — specific service first, then full list
    if (/gi[áa]|price|b[ảa]ng gi[áa]|how much|cost|ph[íi]|bao nhi[êe]u/.test(t)) {
      var spSvc = null;
      activeSvcs.forEach(function (s) {
        if (!spSvc) {
          var words = s.name.toLowerCase().split(/\s+/);
          if (words.some(function (w) { return w.length > 3 && t.indexOf(w) !== -1; })) spSvc = s;
        }
      });
      if (spSvc) {
        return spSvc.name + ': ' + spSvc.price +
          (spSvc.duration ? ' (' + spSvc.duration + ')' : '') +
          (spSvc.desc ? '\n' + spSvc.desc : '');
      }
      var pt = (isVi ? 'Bảng giá:\n' : 'Services & Pricing:\n');
      activeSvcs.forEach(function (s) { pt += '• ' + s.name + ': ' + s.price + (s.duration ? ' (' + s.duration + ')' : '') + '\n'; });
      return pt.trim();
    }

    // Address / location
    if (/[đd][ịi]a ch[ỉi]|address|location|[đd][âa]u|where/.test(t)) {
      return (biz.address || biz.city || '') + (biz.phoneDisplay ? '\n' + biz.phoneDisplay : '');
    }

    // Services menu
    if (/d[ịi]ch v[ụu]|service|what.*(?:do|offer)|menu|danh s[áa]ch/.test(t)) {
      var sl = (isVi ? 'Dịch vụ của ' + biz.name + ':\n' : biz.name + ' services:\n');
      activeSvcs.forEach(function (s) { sl += '• ' + s.name + ' — ' + s.price + (s.duration ? ' (' + s.duration + ')' : '') + '\n'; });
      return sl.trim();
    }

    // Booking
    if (/[đd][ặa]t\s*l[ịi]ch|book|appointment|h[ẹe]n|schedule/.test(t)) {
      return isVi
        ? 'Nhấn "Đặt Lịch" bên dưới để đặt trực tuyến, hoặc gọi ' + biz.phoneDisplay
        : 'Tap "Book Appointment" below or call ' + biz.phoneDisplay;
    }

    // Phone / contact
    if (/phone|g[ọo]i|call|[đd]i[ệe]n|contact|li[êe]n h[ệe]/.test(t)) {
      return (biz.hosts && biz.hosts[0] ? biz.hosts[0].name + ': ' : '') + biz.phoneDisplay;
    }

    // Default — bilingual
    return isVi
      ? 'Tôi có thể giúp bạn:\n• Ai rảnh hôm nay?\n• Bảng giá dịch vụ\n• Giờ mở cửa\n• Đặt lịch hẹn\n\nHỏi trực tiếp nhé!'
      : 'I can help with:\n• Who\'s available today\n• Services & pricing\n• Hours\n• Book appointment\n\nJust ask!';
  }

  // ── Chat overlay DOM helpers ──────────────────────────────────────────────────
  function _appendMsg(msgsEl, text, role) {
    var d = document.createElement('div');
    d.className = 'lp-ch__bbl lp-ch__bbl--' + role;
    d.textContent = text;
    msgsEl.appendChild(d);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return d;
  }

  function _showTyping(msgsEl) {
    var d = document.createElement('div');
    d.className = 'lp-ch__typing';
    d.id = 'lpTyping_' + Date.now();
    d.innerHTML = '<span></span><span></span><span></span>';
    msgsEl.appendChild(d);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return d.id;
  }

  function _removeTyping(id) {
    var t = document.getElementById(id);
    if (t) t.remove();
  }

  function _setChips(chipsEl, chips, msgsEl, biz, vendorUrl) {
    chipsEl.innerHTML = '';
    chips.forEach(function (chip) {
      var btn = document.createElement('button');
      btn.className = 'lp-ch__chip';
      btn.textContent = chip.label;
      btn.addEventListener('click', function () {
        if (chip.href) { location.href = chip.href; return; }
        var val = chip.value || chip.label;
        _appendMsg(msgsEl, val, 'usr');
        chipsEl.innerHTML = '';
        var tid = _showTyping(msgsEl);
        setTimeout(function () {
          _removeTyping(tid);
          var reply = _lpReply(biz, val);
          _appendMsg(msgsEl, reply, 'bot');
          // After booking chip, offer action chips
          if (/book|đặt|appointment/i.test(val)) {
            _setChips(chipsEl, [
              { label: 'Book online', href: vendorUrl },
              { label: biz.phoneDisplay || 'Call', href: 'tel:' + (biz.phone || biz.hosts && biz.hosts[0] && biz.hosts[0].phone || '') },
            ], msgsEl, biz, vendorUrl);
          }
        }, 450);
      });
      chipsEl.appendChild(btn);
    });
  }

  // ── Open vendor chat (post-selection) ────────────────────────────────────────
  function _openVendorChat(biz, panel, catLabel) {
    var ai = biz.aiReceptionist || {};
    var catPath = _CAT_PATH[biz.category] || ('/marketplace/?cat=' + biz.category);
    var vendorUrl = catPath + '?id=' + biz.id;

    // Update header
    panel.querySelector('.lp-ch__title').textContent = biz.name;
    panel.querySelector('.lp-ch__sub').textContent = ai.name ? ('Assistant: ' + ai.name) : 'AI Assistant';
    var backBtn = panel.querySelector('.lp-ch__back');
    if (backBtn) backBtn.classList.add('vis');

    var vpick   = panel.querySelector('.lp-ch__vpick');
    var msgsEl  = panel.querySelector('.lp-ch__msgs');
    var chipsEl = panel.querySelector('.lp-ch__chips');
    var row     = panel.querySelector('.lp-ch__row');

    if (vpick)   vpick.style.display   = 'none';
    if (msgsEl)  msgsEl.style.display  = '';
    if (row)     row.style.display     = '';

    // Welcome message
    var welcome = ai.welcomeMessage || ('Hi! I\'m ' + (ai.name || 'the assistant') + ' at ' + biz.name + '. How can I help you?');
    _appendMsg(msgsEl, welcome, 'bot');

    // Initial chips
    _setChips(chipsEl, [
      { label: 'Who\'s available today?', value: 'Who is available today?' },
      { label: 'Pricing',                  value: 'What are the prices?' },
      { label: 'Services',                 value: 'What services do you offer?' },
      { label: 'Book appointment',         href: vendorUrl },
    ], msgsEl, biz, vendorUrl);

    // Input
    var inputEl = panel.querySelector('.lp-ch__inp');
    var sendBtn = panel.querySelector('.lp-ch__snd');

    function doSend() {
      var txt = (inputEl.value || '').trim();
      if (!txt) return;
      inputEl.value = '';
      chipsEl.innerHTML = '';
      _appendMsg(msgsEl, txt, 'usr');
      var tid = _showTyping(msgsEl);
      setTimeout(function () {
        _removeTyping(tid);
        var reply = _lpReply(biz, txt);
        _appendMsg(msgsEl, reply, 'bot');
        // Offer booking if they asked about it
        if (/book|appointment|đặt|h[ẹe]n|schedule/i.test(txt)) {
          _setChips(chipsEl, [
            { label: 'Book online', href: vendorUrl },
            { label: '📞 ' + (biz.phoneDisplay || 'Call'), href: 'tel:' + (biz.phone || '') },
          ], msgsEl, biz, vendorUrl);
        }
      }, 420);
    }

    sendBtn.addEventListener('click', doSend);
    inputEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doSend(); } });
    // Small delay so keyboard doesn't interfere with animation on iOS
    setTimeout(function () { try { inputEl.focus(); } catch (e) {} }, 350);
  }

  // ── Open the overlay ──────────────────────────────────────────────────────────
  var _currentCfg = null;

  function _openOverlay(cfg) {
    if (!cfg) cfg = _currentCfg || {};
    _injectChatStyles();

    // Remove any existing overlay
    var existing = document.getElementById('lpChatOverlay');
    if (existing) existing.remove();

    var category  = cfg.category || 'nails';
    var catLabels = { nails: 'Nail Salon AI', hair: 'Hair Salon AI', food: 'Food AI', rides: 'Ride AI', tour: 'Tour AI' };
    var catLabel  = catLabels[category] || 'AI Assistant';

    var vendors = _activeVendors(category);

    var overlay = document.createElement('div');
    overlay.id  = 'lpChatOverlay';

    overlay.innerHTML = (
      '<div id="lpChatPanel">' +
        '<div class="lp-ch__hdr">' +
          '<button class="lp-ch__back" id="lpChBack" aria-label="Back">&#8249;</button>' +
          '<div class="lp-ch__info">' +
            '<div class="lp-ch__title">' + esc(catLabel) + '</div>' +
            '<div class="lp-ch__sub">Du Lịch Cali</div>' +
          '</div>' +
          '<button class="lp-ch__close" id="lpChClose" aria-label="Close">&#10005;</button>' +
        '</div>' +
        '<div class="lp-ch__msgs" style="display:none"></div>' +
        '<div class="lp-ch__vpick"></div>' +
        '<div class="lp-ch__chips"></div>' +
        '<div class="lp-ch__row" style="display:none">' +
          '<input class="lp-ch__inp" type="text" placeholder="Ask a question..." autocomplete="off" enterkeyhint="send">' +
          '<button class="lp-ch__snd" aria-label="Gửi">' + I.send + '</button>' +
        '</div>' +
      '</div>'
    );
    document.body.appendChild(overlay);

    var panel = document.getElementById('lpChatPanel');

    // Close via X or backdrop
    document.getElementById('lpChClose').addEventListener('click', _closeOverlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) _closeOverlay(); });

    // Back button — go back to vendor picker
    document.getElementById('lpChBack').addEventListener('click', function () {
      var msgsEl  = panel.querySelector('.lp-ch__msgs');
      var row     = panel.querySelector('.lp-ch__row');
      var chipsEl = panel.querySelector('.lp-ch__chips');
      var vpick   = panel.querySelector('.lp-ch__vpick');
      msgsEl.innerHTML = '';
      msgsEl.style.display = 'none';
      row.style.display    = 'none';
      chipsEl.innerHTML    = '';
      vpick.style.display  = '';
      document.getElementById('lpChBack').classList.remove('vis');
      panel.querySelector('.lp-ch__title').textContent = catLabel;
      panel.querySelector('.lp-ch__sub').textContent   = 'Du Lịch Cali';
    });

    // Keyboard ESC to close
    function onKey(e) { if (e.key === 'Escape') { _closeOverlay(); document.removeEventListener('keydown', onKey); } }
    document.addEventListener('keydown', onKey);

    var vpick = panel.querySelector('.lp-ch__vpick');

    // ── CASE 1: No vendors ──────────────────────────────────────────────────────
    if (vendors.length === 0) {
      vpick.innerHTML = (
        '<div class="lp-ch__no-vendor">' +
          '<div style="font-size:1.6rem;margin-bottom:.5rem">🔍</div>' +
          '<strong>No services currently available.</strong><br>' +
          'Please try again later or call us directly:<br>' +
          '<a href="tel:4089163439" style="color:#f5a623;font-weight:600">408-916-3439</a>' +
        '</div>'
      );
      return;
    }

    // ── CASE 2: Single vendor — go straight to chat ─────────────────────────────
    if (vendors.length === 1) {
      _openVendorChat(vendors[0], panel, catLabel);
      return;
    }

    // ── CASE 3: Multiple vendors — show picker ──────────────────────────────────
    var pHtml = '<div class="lp-ch__vpick-lbl">Select a location:</div>';
    vendors.forEach(function (biz, idx) {
      var av = computeAvail(biz);
      var avColor = { now: '#4ade80', order: '#fb923c', soon: '#818cf8', closed: '#94a3b8' }[av.status] || '#94a3b8';
      pHtml += (
        '<button class="lp-ch__vbtn" data-idx="' + idx + '">' +
          '<div class="lp-ch__vbtn__nm">' + esc(biz.name) + '</div>' +
          '<div class="lp-ch__vbtn__sub">' +
            esc(biz.city || biz.region || '') +
            ' &nbsp;·&nbsp; <span style="color:' + avColor + '">' + esc(av.label) + '</span>' +
          '</div>' +
        '</button>'
      );
    });
    vpick.innerHTML = pHtml;

    vpick.querySelectorAll('.lp-ch__vbtn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.dataset.idx, 10);
        _openVendorChat(vendors[idx], panel, catLabel);
      });
    });
  }

  function _closeOverlay() {
    var o = document.getElementById('lpChatOverlay');
    if (o) {
      o.style.animation = 'lpFdIn .15s ease reverse forwards';
      setTimeout(function () { if (o.parentNode) o.remove(); }, 140);
    }
  }

  // ── Bottom nav ────────────────────────────────────────────────────────────────
  function injectNav(cfg) {
    var wrap = document.getElementById('lpNav');
    if (!wrap) return;

    var scrollAction = "var s=document.getElementById('lpVendorSection');if(s)s.scrollIntoView({behavior:'smooth'})";
    // AI button opens overlay — no page navigation
    var aiAction = 'LandingNav.openChat()';

    var tabs = [
      { icon: cfg.tab1Icon || I.home,     label: cfg.tab1Label || 'Home',      action: 'location.href="' + (cfg.tab1Href || '/') + '"',                 active: true  },
      { icon: cfg.tab2Icon || I.book,     label: cfg.tab2Label || 'Book Now',  action: cfg.tab2Action || ('location.href="' + (cfg.tab2Href||'/') + '"'), active: false },
      { icon: I.chat,                     label: 'AI',                          action: aiAction,                                                          center: true  },
      { icon: cfg.tab4Icon || I.grid,     label: cfg.tab4Label || 'Services',  action: scrollAction,                                                      active: false },
      { icon: I.home,                     label: 'Du Lich Cali',               action: 'location.href="/"',                                               active: false },
    ];

    var html = '<nav class="bottom-nav lp-nav-fixed" role="navigation" aria-label="' + esc(cfg.tab1Label || 'Service') + ' navigation">';
    tabs.forEach(function (tab) {
      var cls = 'nav-tab' + (tab.active ? ' nav-tab--active' : '') + (tab.center ? ' nav-tab--center' : '');
      if (tab.center) {
        html += '<button class="' + cls + '" onclick="' + tab.action + '" aria-label="Open AI chat">' +
          '<div class="nav-center-btn" aria-hidden="true">' + tab.icon + '</div>' +
          '<span>' + tab.label + '</span></button>';
      } else {
        html += '<button class="' + cls + '" onclick="' + tab.action + '">' +
          tab.icon + '<span>' + tab.label + '</span></button>';
      }
    });
    html += '</nav>';
    var footerHtml = '<div class="lp-legal-footer" role="contentinfo">' +
      '<a href="/privacy">Privacy Policy</a>' +
      '<span class="lp-legal-footer__sep" aria-hidden="true">\xb7</span>' +
      '<a href="/terms">Terms of Service</a>' +
      '<span class="lp-legal-footer__sep" aria-hidden="true">\xb7</span>' +
      '\xa9 ' + new Date().getFullYear() + ' JDNETWORKS AI SERVICES LLC' +
      '</div>';
    wrap.innerHTML = footerHtml + html;
  }

  // ── Public API ────────────────────────────────────────────────────────────────
  global.LandingNav = {
    _cfg: null,

    init: function (cfg) {
      global.LandingNav._cfg = cfg;
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
    },

    openChat: function (cfg) {
      _openOverlay(cfg || global.LandingNav._cfg);
    }
  };

}(window));
