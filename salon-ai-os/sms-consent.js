(function () {
  'use strict';

  // ── SalonSmsConsent ──────────────────────────────────────────────────────────
  // Phase 10: SMS Opt-In / Opt-Out consent tracking infrastructure.
  //
  // IMPORTANT: SMS is intentionally DISABLED globally (SMS_ENABLED = false in
  // functions/index.js). This module ONLY manages consent records so that when
  // SMS is eventually re-enabled, a proper opt-in/opt-out history is in place.
  //
  // This module does NOT send any messages. It does NOT enable SMS. It does NOT
  // trigger any Twilio calls.
  //
  // Firestore path:
  //   vendors/{vendorId}/smsConsent/{phoneHash}
  //
  // Fields per document:
  //   phoneHash    — first 12 hex chars of a non-crypto XOR hash of normalized phone
  //   phoneLastFour— last 4 digits of phone (display only)
  //   consentStatus— 'opted_in' | 'opted_out' | 'unknown'
  //   consentSource— 'booking_form' | 'manual_admin' | 'stop_reply'
  //   consentAt    — Firestore Timestamp (when opted in)
  //   optOutAt     — Firestore Timestamp (when opted out, optional)
  //   updatedAt    — Firestore Timestamp

  // ── Simple non-crypto hash ───────────────────────────────────────────────────
  // Uses a djb2-style XOR + multiply hash, output as hex string.
  // Not cryptographically secure; adequate for privacy-safe phone bucketing.
  function hashPhone(normalizedPhone) {
    var h = 5381;
    for (var i = 0; i < normalizedPhone.length; i++) {
      h = (((h << 5) + h) ^ normalizedPhone.charCodeAt(i)) >>> 0;
    }
    // Second pass for better distribution
    for (var j = normalizedPhone.length - 1; j >= 0; j--) {
      h = (((h << 3) + h) ^ normalizedPhone.charCodeAt(j)) >>> 0;
    }
    var hex = h.toString(16);
    // Pad to 8 chars then double to get 12 chars using both passes combined
    while (hex.length < 8) hex = '0' + hex;
    // Add 4 more chars from a second seed
    var h2 = 0x811c9dc5;
    for (var k = 0; k < normalizedPhone.length; k++) {
      h2 = (h2 ^ normalizedPhone.charCodeAt(k)) >>> 0;
      h2 = Math.imul(h2, 0x01000193) >>> 0;
    }
    var hex2 = h2.toString(16);
    while (hex2.length < 4) hex2 = '0' + hex2;
    return (hex + hex2).slice(0, 12);
  }

  // ── Firestore helpers ────────────────────────────────────────────────────────
  function _db() {
    return firebase.firestore();
  }

  function _consentRef(vendorId, phoneHash) {
    return _db()
      .collection('vendors').doc(vendorId)
      .collection('smsConsent').doc(phoneHash);
  }

  // ── getConsent ───────────────────────────────────────────────────────────────
  // Returns the consent document data or null if not found.
  function getConsent(vendorId, phoneHash) {
    return _consentRef(vendorId, phoneHash).get().then(function (snap) {
      return snap.exists ? snap.data() : null;
    });
  }

  // ── setConsent ───────────────────────────────────────────────────────────────
  // Writes (merges) a consent record.
  // status: 'opted_in' | 'opted_out' | 'unknown'
  // source: 'booking_form' | 'manual_admin' | 'stop_reply'
  function setConsent(vendorId, phoneHash, phoneLastFour, status, source) {
    var now = firebase.firestore.FieldValue.serverTimestamp();
    var data = {
      phoneHash: phoneHash,
      phoneLastFour: phoneLastFour || '',
      consentStatus: status,
      consentSource: source,
      updatedAt: now
    };
    if (status === 'opted_in') {
      data.consentAt = now;
    }
    if (status === 'opted_out') {
      data.optOutAt = now;
    }
    return _consentRef(vendorId, phoneHash).set(data, { merge: true });
  }

  // ── hasOptedOut ──────────────────────────────────────────────────────────────
  // Returns a Promise<boolean> — true if the phone has opted out.
  function hasOptedOut(vendorId, phoneHash) {
    return getConsent(vendorId, phoneHash).then(function (record) {
      return record ? record.consentStatus === 'opted_out' : false;
    });
  }

  // ── recordStopReply ──────────────────────────────────────────────────────────
  // Records an opt-out triggered by a STOP reply from the customer.
  function recordStopReply(vendorId, phoneHash) {
    var now = firebase.firestore.FieldValue.serverTimestamp();
    return _consentRef(vendorId, phoneHash).set({
      consentStatus: 'opted_out',
      consentSource: 'stop_reply',
      optOutAt: now,
      updatedAt: now
    }, { merge: true });
  }

  // ── loadConsentList ──────────────────────────────────────────────────────────
  // Loads up to 500 consent records for a vendor, ordered by updatedAt desc.
  // Returns Promise<Array> of document data objects.
  function loadConsentList(vendorId) {
    return _db()
      .collection('vendors').doc(vendorId)
      .collection('smsConsent')
      .orderBy('updatedAt', 'desc')
      .limit(500)
      .get()
      .then(function (snap) {
        var results = [];
        snap.forEach(function (doc) { results.push(doc.data()); });
        return results;
      });
  }

  // ── exportConsentSummary ─────────────────────────────────────────────────────
  // Returns Promise<{ total, opted_in, opted_out, unknown }> counts.
  function exportConsentSummary(vendorId) {
    return loadConsentList(vendorId).then(function (records) {
      var summary = { total: records.length, opted_in: 0, opted_out: 0, unknown: 0 };
      records.forEach(function (r) {
        var s = r.consentStatus || 'unknown';
        if (s === 'opted_in')  summary.opted_in++;
        else if (s === 'opted_out') summary.opted_out++;
        else summary.unknown++;
      });
      return summary;
    });
  }

  // ── Vendor admin panel UI renderer ──────────────────────────────────────────
  // Called by salon-admin.html when the smsconsent tab is activated.
  // Renders into the element with id="smsConsentPanel".
  function init(vendorId, containerEl) {
    if (!vendorId || !containerEl) return;

    // Render skeleton with notice banner, summary stats placeholder, table
    containerEl.innerHTML =
      '<div style="max-width:780px">' +

        // Disabled notice banner
        '<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);' +
            'border-radius:8px;padding:.85rem 1rem;margin-bottom:1.25rem;' +
            'font-size:.78rem;color:#fbbf24;line-height:1.5">' +
          '&#9888;&#65039; SMS hiện đang tắt. Danh sách này dùng để chuẩn bị cho khi SMS được bật lại.' +
        '</div>' +

        // Summary stats row
        '<div id="smsConsentStats" style="display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:1rem">' +
          '<div style="background:var(--navy-700);border:1px solid var(--border);border-radius:8px;padding:.6rem .9rem;min-width:110px">' +
            '<div id="smsStatOptedIn" style="font-size:1.4rem;font-weight:700;color:var(--success)">—</div>' +
            '<div style="font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-top:2px">Đồng Ý</div>' +
          '</div>' +
          '<div style="background:var(--navy-700);border:1px solid var(--border);border-radius:8px;padding:.6rem .9rem;min-width:110px">' +
            '<div id="smsStatOptedOut" style="font-size:1.4rem;font-weight:700;color:var(--danger)">—</div>' +
            '<div style="font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-top:2px">Từ Chối</div>' +
          '</div>' +
          '<div style="background:var(--navy-700);border:1px solid var(--border);border-radius:8px;padding:.6rem .9rem;min-width:110px">' +
            '<div id="smsStatUnknown" style="font-size:1.4rem;font-weight:700;color:var(--text)">—</div>' +
            '<div style="font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-top:2px">Chưa Rõ</div>' +
          '</div>' +
          '<div style="background:var(--navy-700);border:1px solid var(--border);border-radius:8px;padding:.6rem .9rem;min-width:110px">' +
            '<div id="smsStatTotal" style="font-size:1.4rem;font-weight:700;color:var(--gold)">—</div>' +
            '<div style="font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-top:2px">Tổng</div>' +
          '</div>' +
        '</div>' +

        // Header + refresh button
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.6rem;flex-wrap:wrap;gap:.5rem">' +
          '<div style="font-size:.8rem;color:var(--text);font-weight:500">Danh Sách Đồng Ý SMS</div>' +
          '<button onclick="window.SalonSmsConsent._refreshPanel(\'' + vendorId + '\')" ' +
              'style="background:transparent;border:1px solid var(--border-g);color:var(--gold);' +
                     'border-radius:6px;font-size:.72rem;padding:.28rem .75rem;cursor:pointer;' +
                     'font-family:var(--font-b);transition:border-color .2s,color .2s">' +
            'Tải Danh Sách' +
          '</button>' +
        '</div>' +

        // Table wrapper
        '<div id="smsConsentTableWrap" style="overflow-x:auto">' +
          '<div class="sa-empty">Nhấn "Tải Danh Sách" để xem dữ liệu.</div>' +
        '</div>' +

      '</div>';

    // Auto-load on first open
    _refreshPanel(vendorId);
  }

  // ── _refreshPanel ────────────────────────────────────────────────────────────
  // Loads consent list and summary, then re-renders table + stats.
  function _refreshPanel(vendorId) {
    var tableWrap = document.getElementById('smsConsentTableWrap');
    if (tableWrap) {
      tableWrap.innerHTML = '<div class="sa-empty">Đang tải…</div>';
    }

    loadConsentList(vendorId).then(function (records) {
      // Update stats
      var summary = { total: records.length, opted_in: 0, opted_out: 0, unknown: 0 };
      records.forEach(function (r) {
        var s = r.consentStatus || 'unknown';
        if (s === 'opted_in')       summary.opted_in++;
        else if (s === 'opted_out') summary.opted_out++;
        else                        summary.unknown++;
      });
      var el;
      el = document.getElementById('smsStatOptedIn');  if (el) el.textContent = summary.opted_in;
      el = document.getElementById('smsStatOptedOut'); if (el) el.textContent = summary.opted_out;
      el = document.getElementById('smsStatUnknown');  if (el) el.textContent = summary.unknown;
      el = document.getElementById('smsStatTotal');    if (el) el.textContent = summary.total;

      // Render table
      var wrap = document.getElementById('smsConsentTableWrap');
      if (!wrap) return;

      if (!records.length) {
        wrap.innerHTML = '<div class="sa-empty">Chưa có dữ liệu đồng ý SMS.</div>';
        return;
      }

      var rows = records.map(function (r) {
        var status = r.consentStatus || 'unknown';
        var badge;
        if (status === 'opted_in') {
          badge = '<span style="background:rgba(74,222,128,.12);color:#4ade80;border:1px solid rgba(74,222,128,.3);' +
                  'border-radius:99px;padding:2px 8px;font-size:.65rem;font-weight:600">Đồng Ý</span>';
        } else if (status === 'opted_out') {
          badge = '<span style="background:rgba(248,113,113,.12);color:#f87171;border:1px solid rgba(248,113,113,.3);' +
                  'border-radius:99px;padding:2px 8px;font-size:.65rem;font-weight:600">Từ Chối</span>';
        } else {
          badge = '<span style="background:rgba(148,163,184,.1);color:#94a3b8;border:1px solid rgba(148,163,184,.2);' +
                  'border-radius:99px;padding:2px 8px;font-size:.65rem;font-weight:600">Chưa Rõ</span>';
        }

        var sourceLabel = {
          'booking_form': 'Đặt lịch',
          'manual_admin': 'Admin',
          'stop_reply':   'STOP Reply'
        }[r.consentSource || ''] || (r.consentSource || '—');

        var dateStr = '—';
        var ts = r.consentAt || r.updatedAt;
        if (ts && ts.toDate) {
          var d = ts.toDate();
          dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }

        var lastFour = r.phoneLastFour ? '••••' + r.phoneLastFour : '—';

        return '<tr>' +
          '<td style="padding:.5rem .75rem;color:var(--cream);font-family:var(--font-mono);font-size:.78rem">' + lastFour + '</td>' +
          '<td style="padding:.5rem .75rem">' + badge + '</td>' +
          '<td style="padding:.5rem .75rem;font-size:.72rem;color:var(--muted)">' + sourceLabel + '</td>' +
          '<td style="padding:.5rem .75rem;font-size:.72rem;color:var(--muted)">' + dateStr + '</td>' +
        '</tr>';
      }).join('');

      wrap.innerHTML =
        '<table style="width:100%;border-collapse:collapse;min-width:340px">' +
          '<thead>' +
            '<tr style="border-bottom:1px solid var(--border)">' +
              '<th style="padding:.4rem .75rem;text-align:left;font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;font-weight:500">SĐT (4 số cuối)</th>' +
              '<th style="padding:.4rem .75rem;text-align:left;font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;font-weight:500">Trạng Thái</th>' +
              '<th style="padding:.4rem .75rem;text-align:left;font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;font-weight:500">Nguồn</th>' +
              '<th style="padding:.4rem .75rem;text-align:left;font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;font-weight:500">Ngày</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>';

    }).catch(function (err) {
      var wrap = document.getElementById('smsConsentTableWrap');
      if (wrap) wrap.innerHTML = '<div class="sa-empty">Lỗi tải dữ liệu: ' + (err && err.message ? err.message : 'unknown') + '</div>';
      console.warn('[sms-consent] loadConsentList failed:', err);
    });
  }

  // ── Public API ───────────────────────────────────────────────────────────────
  window.SalonSmsConsent = {
    hashPhone:            hashPhone,
    getConsent:           getConsent,
    setConsent:           setConsent,
    hasOptedOut:          hasOptedOut,
    recordStopReply:      recordStopReply,
    loadConsentList:      loadConsentList,
    exportConsentSummary: exportConsentSummary,
    init:                 init,
    _refreshPanel:        _refreshPanel   // exposed for inline onclick
  };

}());
