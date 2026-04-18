/* driver-notif.js — Real-time booking alert popup for driver portal
 * Exposes DLCNotif global. Call DLCNotif.init(db, driverId) after auth.
 * Call DLCNotif.showAlert(data) from Firestore docChanges listeners.
 */
(function(global) {
  'use strict';

  // ── State ─────────────────────────────────────────────────────────────────
  var _db         = null;
  var _driverId   = null;
  var _showing    = null;   // data object currently in popup, or null
  var _queue      = [];     // alerts waiting while one is displayed
  var _unread     = 0;      // current tour unread count
  var _audioCtx   = null;
  var _FieldValue = null;

  var COL_TOURS = 'travelAssignments';

  // ── Public API ─────────────────────────────────────────────────────────────

  function init(db, driverId) {
    _db       = db;
    _driverId = driverId;
    try { _FieldValue = firebase.firestore.FieldValue; } catch(e) {}
    _buildDOM();
    _audioUnlock();
  }

  /**
   * Show a booking alert popup.
   * @param {object} data
   *   Required: id (doc ID), type ('ride' | 'tour')
   *   Optional: customerName, customerPhone, pickupAddress, travelDate,
   *             datetime, travelers, passengers, packageName, serviceLabel,
   *             serviceType, bookingId, total, estimatedPrice, duration_days,
   *             airport, notes
   */
  function showAlert(data) {
    if (_showing) {
      _queue.push(data);
      return;
    }
    _showing = data;
    _renderPopup(data);
    document.getElementById('dlcNotifOverlay').style.display = 'flex';
    _playSound();
    // Auto-dismiss after 60 s if driver takes no action
    if (global._dlcNotifAutoTimer) clearTimeout(global._dlcNotifAutoTimer);
    global._dlcNotifAutoTimer = setTimeout(function() { dismiss(); }, 60000);
  }

  function confirm() {
    if (!_showing) return;
    var data = _showing;
    _hide();
    if (data.type === 'tour' && _db && data.id) {
      _db.collection(COL_TOURS).doc(data.id).update({
        notif_status:       'confirmed',
        notif_confirmedAt:  (_FieldValue || firebase.firestore.FieldValue).serverTimestamp(),
      }).catch(function(e) {
        console.warn('[DLCNotif] confirm write:', e.message);
      });
      updateBadge(Math.max(0, _unread - 1));
    }
  }

  function dismiss() {
    if (!_showing) return;
    var data = _showing;
    _hide();
    if (data.type === 'tour' && _db && data.id) {
      _db.collection(COL_TOURS).doc(data.id).update({
        notif_status:      'dismissed',
        notif_dismissedAt: (_FieldValue || firebase.firestore.FieldValue).serverTimestamp(),
      }).catch(function(e) {
        console.warn('[DLCNotif] dismiss write:', e.message);
      });
      // Dismissed tours still need attention — do NOT decrement badge
    }
  }

  function viewBooking() {
    if (!_showing) return;
    var data = _showing;
    _hide();
    if (data.type === 'tour' && _db && data.id) {
      _db.collection(COL_TOURS).doc(data.id).update({
        notif_status:    'viewed',
        notif_viewedAt:  (_FieldValue || firebase.firestore.FieldValue).serverTimestamp(),
      }).catch(function() {});
      updateBadge(Math.max(0, _unread - 1));
    }
    // Switch to home tab and scroll to the booking card
    if (typeof drvTab === 'function') drvTab('home');
    var cardId = data.type === 'tour' ? ('tour-card-' + data.id) : ('rn-' + data.id);
    setTimeout(function() {
      var el = document.getElementById(cardId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 350);
  }

  function updateBadge(n) {
    _unread = n;
    var badge = document.getElementById('dlcTourBadge');
    if (!badge) return;
    badge.textContent = n > 9 ? '9+' : (n > 0 ? String(n) : '');
    badge.classList.toggle('hidden', n <= 0);
  }

  // ── Private: DOM ───────────────────────────────────────────────────────────

  function _buildDOM() {
    if (document.getElementById('dlcNotifOverlay')) return;

    var overlay = document.createElement('div');
    overlay.id = 'dlcNotifOverlay';
    overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.68);z-index:9999;' +
      'align-items:flex-start;justify-content:center;padding:max(1rem,env(safe-area-inset-top,1rem)) 1rem 1rem;';

    overlay.innerHTML =
      '<div style="background:var(--navy-800,#1a2234);border:1.5px solid rgba(245,166,35,.45);border-radius:16px;' +
          'width:100%;max-width:420px;overflow:hidden;box-shadow:0 24px 56px rgba(0,0,0,.55);margin-top:.25rem">' +

        // ── Header ──
        '<div style="background:rgba(245,166,35,.1);padding:.7rem 1rem;display:flex;align-items:center;gap:.6rem">' +
          '<span id="dlcNIcon" style="font-size:1.4rem;line-height:1">🔔</span>' +
          '<div style="flex:1;min-width:0">' +
            '<div id="dlcNTypeLabel" style="font-size:.58rem;color:#8e9bb3;text-transform:uppercase;letter-spacing:.09em;font-weight:700">Đặt Tour Mới</div>' +
            '<div id="dlcNTitle" style="font-size:.95rem;font-weight:700;color:var(--gold,#f5a623);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">—</div>' +
          '</div>' +
          '<button onclick="DLCNotif.dismiss()" style="background:none;border:none;color:#8e9bb3;font-size:1.5rem;cursor:pointer;padding:.2rem .3rem;line-height:1;flex-shrink:0" aria-label="Đóng">×</button>' +
        '</div>' +

        // ── Fields grid ──
        '<div id="dlcNFields" style="padding:.8rem 1rem;display:grid;grid-template-columns:1fr 1fr;gap:.45rem .8rem"></div>' +

        // ── Action buttons ──
        '<div style="padding:.5rem 1rem 1rem;display:flex;flex-wrap:wrap;gap:.5rem">' +
          '<button onclick="DLCNotif.confirm()" ' +
            'style="flex:1;min-width:90px;height:42px;background:var(--gold,#f5a623);color:var(--navy-900,#0d1520);' +
            'border:none;border-radius:8px;font-weight:700;font-size:.8rem;letter-spacing:.04em;cursor:pointer">' +
            '✓ Xác Nhận' +
          '</button>' +
          '<button onclick="DLCNotif.viewBooking()" ' +
            'style="flex:1;min-width:90px;height:42px;background:rgba(56,189,248,.13);color:#38bdf8;' +
            'border:1px solid rgba(56,189,248,.3);border-radius:8px;font-weight:700;font-size:.8rem;cursor:pointer">' +
            'Xem Chi Tiết' +
          '</button>' +
          '<a id="dlcNCallBtn" href="#" ' +
            'style="flex:1;min-width:90px;height:42px;background:rgba(74,222,128,.1);color:#4ade80;' +
            'border:1px solid rgba(74,222,128,.28);border-radius:8px;font-weight:700;font-size:.8rem;cursor:pointer;' +
            'display:none;align-items:center;justify-content:center;text-decoration:none">' +
            '📞 Gọi Khách' +
          '</a>' +
          '<button onclick="DLCNotif.dismiss()" ' +
            'style="flex:1;min-width:90px;height:42px;background:rgba(148,163,184,.08);color:#94a3b8;' +
            'border:1px solid rgba(148,163,184,.2);border-radius:8px;font-weight:700;font-size:.8rem;cursor:pointer">' +
            'Bỏ Qua' +
          '</button>' +
        '</div>' +

      '</div>';

    document.body.appendChild(overlay);
  }

  function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _field(label, value) {
    if (value === null || value === undefined || value === '') return '';
    return '<div>' +
      '<div style="font-size:.56rem;color:#8e9bb3;text-transform:uppercase;letter-spacing:.07em;font-weight:700;margin-bottom:.1rem">' + _esc(label) + '</div>' +
      '<div style="font-size:.83rem;color:#e2e8f0;font-weight:600;line-height:1.35">' + _esc(String(value)) + '</div>' +
    '</div>';
  }

  function _renderPopup(data) {
    var isTour = data.type === 'tour';

    document.getElementById('dlcNIcon').textContent      = isTour ? '🗺' : '🚗';
    document.getElementById('dlcNTypeLabel').textContent = isTour ? 'Đặt Tour Mới' : 'Chuyến Xe Mới';
    document.getElementById('dlcNTitle').textContent     =
      data.packageName || data.serviceLabel || (isTour ? 'California Tour' : 'Chuyến Xe');

    var fields = '';
    fields += _field('Khách Hàng',  data.customerName);
    fields += _field('Điện Thoại',  data.customerPhone);
    var dateVal = data.travelDate || data.arrivalDate
      ? (data.travelDate || data.arrivalDate || '') + (data.arrivalTime ? ' ' + data.arrivalTime : '')
      : (data.datetime || '');
    fields += _field('Ngày / Giờ',  dateVal || null);
    fields += _field('Điểm Đón',    data.pickupAddress || data.airport);
    fields += _field('Hành Khách',  String(data.travelers || data.passengers || 1) + ' người');
    if (isTour && (data.duration_days || 1) > 1) {
      fields += _field('Thời Gian', String(data.duration_days) + ' ngày');
    }
    var rawPrice = data.total || data.estimatedPrice;
    var numPrice = Number(rawPrice);
    if (rawPrice && !isNaN(numPrice)) {
      fields += _field('Ước Tính', '$' + numPrice.toFixed(0));
    }
    fields += _field('Mã Booking',  data.bookingId || data.id);
    document.getElementById('dlcNFields').innerHTML = fields;

    // Call button — only if phone number available
    var ph = (data.customerPhone || '').replace(/\D/g, '');
    var callBtn = document.getElementById('dlcNCallBtn');
    if (ph) {
      callBtn.href = 'tel:+1' + ph;
      callBtn.style.display = 'flex';
    } else {
      callBtn.style.display = 'none';
    }
  }

  function _hide() {
    if (global._dlcNotifAutoTimer) { clearTimeout(global._dlcNotifAutoTimer); global._dlcNotifAutoTimer = null; }
    document.getElementById('dlcNotifOverlay').style.display = 'none';
    _showing = null;
    if (_queue.length) {
      var next = _queue.shift();
      setTimeout(function() { showAlert(next); }, 450);
    }
  }

  // ── Private: Web Audio ────────────────────────────────────────────────────

  function _audioUnlock() {
    // Mobile browsers require a user gesture before AudioContext can play.
    // We create (and immediately resume) the context on the first tap/click.
    function unlock() { _getAudioCtx(); }
    document.addEventListener('touchstart', unlock, { once: true, passive: true });
    document.addEventListener('click',      unlock, { once: true, passive: true });
  }

  function _getAudioCtx() {
    if (!_audioCtx) {
      try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch(e) { return null; }
    }
    if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(function(){});
    return _audioCtx;
  }

  function _playSound() {
    try {
      var ctx = _getAudioCtx();
      if (!ctx) return;
      // 4-note ascending beep — identical to vendor portal sound
      function beep(freq, startAt, dur) {
        var osc  = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startAt);
        gain.gain.setValueAtTime(0.38, ctx.currentTime + startAt);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + dur);
        osc.start(ctx.currentTime + startAt);
        osc.onended = function() { osc.disconnect(); gain.disconnect(); };
        osc.stop(ctx.currentTime  + startAt + dur);
      }
      beep(880,  0,    0.18);
      beep(1100, 0.20, 0.22);
      beep(880,  0.52, 0.18);
      beep(1320, 0.72, 0.28);
    } catch(e) {
      console.warn('[DLCNotif] sound error:', e.message);
    }
  }

  // ── Export ─────────────────────────────────────────────────────────────────
  global.DLCNotif = {
    init:         init,
    showAlert:    showAlert,
    confirm:      confirm,
    dismiss:      dismiss,
    viewBooking:  viewBooking,
    updateBadge:  updateBadge,
  };

})(window);
