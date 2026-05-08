(function () {
  'use strict';

  // ── SalonRetentionInsights ───────────────────────────────────────────────────
  // Phase 6: AI Upsell Recommendations & Customer Retention Insights.
  // VENDOR-FACING only — surfaces suggestions to vendor staff; nothing auto-sent
  // to customers. All logic is rule-based (no LLM calls).
  //
  // Data sources:
  //   vendors/{vendorId}/bookings  — last 90 days, limit 200
  //   vendors/{vendorId}/services  — active services for upsell suggestions

  function _T(key) {
    return (window.SalonI18n && window.SalonI18n.t) ? window.SalonI18n.t(key) : key;
  }

  var DAYS_90 = 90 * 24 * 60 * 60 * 1000;   // 90 days in ms
  var RETURN_THRESHOLD_DAYS = 28;            // 28+ days → "due for return"

  // ── Upsell rule map ──────────────────────────────────────────────────────────
  // Each entry maps a lowercase keyword fragment → an i18n key for the
  // suggested add-on label so the upsell text can switch language.
  var UPSELL_RULES = [
    { match: 'gel manicure', key: 'upsell_gel_manicure' },
    { match: 'manicure',     key: 'upsell_manicure' },
    { match: 'gel pedicure', key: 'upsell_gel_pedicure' },
    { match: 'pedicure',     key: 'upsell_pedicure' },
    { match: 'acrylic',      key: 'upsell_acrylic' },
    { match: 'nail art',     key: 'upsell_nail_art' },
    { match: 'dipping',      key: 'upsell_dipping' },
    { match: 'waxing',       key: 'upsell_waxing' },
    { match: 'eyebrow',      key: 'upsell_eyebrow' },
    { match: 'eyelash',      key: 'upsell_eyelash' },
    { match: 'massage',      key: 'upsell_massage' },
    { match: 'facial',       key: 'upsell_facial' }
  ];

  // ── State ────────────────────────────────────────────────────────────────────

  var state = {
    vendorId:   '',
    containerEl: null,
    db:          null,
    loading:     false,
    error:       '',
    loyal:       [],   // customers with 2+ visits in 90 days
    dueReturn:   [],   // last booking 28+ days ago
    topServices: []    // [{name, count, upsell}] top 5
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function maskPhone(phone) {
    var s = String(phone || '').replace(/\D/g, '');
    if (s.length >= 4) return '****' + s.slice(-4);
    if (s.length > 0)  return '****' + s;
    return '****';
  }

  function tsMillis(ts) {
    if (!ts) return 0;
    if (ts && typeof ts.toMillis === 'function') return ts.toMillis();
    if (ts && typeof ts.seconds === 'number')    return ts.seconds * 1000;
    var n = Number(ts);
    if (Number.isFinite(n) && n > 1e9) return n;
    var parsed = Date.parse(ts);
    return isNaN(parsed) ? 0 : parsed;
  }

  function serviceLabel(doc) {
    if (Array.isArray(doc.services) && doc.services.length)         return doc.services.join(', ');
    if (Array.isArray(doc.selectedServices) && doc.selectedServices.length) return doc.selectedServices.join(', ');
    return doc.serviceType || doc.service || '—';
  }

  function fmtDate(ms) {
    if (!ms) return '—';
    var d = new Date(ms);
    return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
  }

  function daysSince(ms) {
    return Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
  }

  function findUpsell(serviceName) {
    var lower = String(serviceName || '').toLowerCase();
    for (var i = 0; i < UPSELL_RULES.length; i++) {
      if (lower.indexOf(UPSELL_RULES[i].match) !== -1) return _T(UPSELL_RULES[i].key);
    }
    return _T('ri_default_upsell');
  }

  // ── computeInsights ──────────────────────────────────────────────────────────
  // Loads bookings (last 90 days) and services, then derives the 3 insight sets.

  function computeInsights() {
    if (!state.vendorId || !state.db) {
      return Promise.reject(new Error(_T('ri_err_not_init')));
    }

    var cutoff = new Date(Date.now() - DAYS_90);
    var vendorRef = state.db.collection('vendors').doc(state.vendorId);

    // 1. Bookings — last 90 days, newest first, limit 200
    var pBookings = vendorRef.collection('bookings')
      .where('createdAt', '>=', cutoff)
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get()
      .then(function (snap) {
        return snap.docs.map(function (doc) {
          var d = doc.data();
          d._id = doc.id;
          return d;
        });
      })
      .catch(function () {
        // Fallback: load without ordering in case index is missing
        return vendorRef.collection('bookings').limit(200).get()
          .then(function (snap) {
            var now = Date.now();
            return snap.docs
              .map(function (doc) { var d = doc.data(); d._id = doc.id; return d; })
              .filter(function (d) { return (now - tsMillis(d.createdAt)) <= DAYS_90; });
          })
          .catch(function () { return []; });
      });

    // 2. Active services — for upsell context
    var pServices = vendorRef.collection('services')
      .where('active', '==', true)
      .get()
      .then(function (snap) {
        return snap.docs.map(function (doc) {
          return Object.assign({ id: doc.id }, doc.data());
        });
      })
      .catch(function () { return []; });

    return Promise.all([pBookings, pServices]).then(function (results) {
      var bookings = results[0];
      var customerFallback = _T('ri_customer_fallback');

      // Group bookings by phone → { phone: { name, visits: [{ms, service}] } }
      var byPhone = {};
      bookings.forEach(function (b) {
        var rawPhone = b.customerPhone || b.phone || b.customerPhoneNormalized || '';
        var digits = rawPhone.replace(/\D/g, '');
        if (digits.length === 11 && digits.charAt(0) === '1') digits = digits.slice(1);
        if (digits.length !== 10) return;  // skip unparseable

        var ms = tsMillis(b.createdAt);
        if (!byPhone[digits]) {
          byPhone[digits] = {
            phone:     digits,
            name:      b.customerName || b.name || customerFallback,
            visits:    []
          };
        }
        // Update name if we now have a real value
        if ((b.customerName || b.name) && byPhone[digits].name === customerFallback) {
          byPhone[digits].name = b.customerName || b.name;
        }
        byPhone[digits].visits.push({ ms: ms, service: serviceLabel(b) });
      });

      // Sort each customer's visits newest first
      Object.keys(byPhone).forEach(function (ph) {
        byPhone[ph].visits.sort(function (a, b) { return b.ms - a.ms; });
      });

      // ── Panel 1: Loyal customers (2+ visits in 90 days) ──
      var loyal = [];
      Object.keys(byPhone).forEach(function (ph) {
        var c = byPhone[ph];
        if (c.visits.length >= 2) {
          loyal.push({
            phone:       c.phone,
            name:        c.name,
            visits:      c.visits.length,
            lastService: c.visits[0].service,
            lastMs:      c.visits[0].ms
          });
        }
      });
      // Sort by visit count descending
      loyal.sort(function (a, b) { return b.visits - a.visits; });
      state.loyal = loyal;

      // ── Panel 2: Due for return (last booking 28+ days ago) ──
      var threshold = RETURN_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
      var dueReturn = [];
      Object.keys(byPhone).forEach(function (ph) {
        var c = byPhone[ph];
        var lastMs = c.visits[0] ? c.visits[0].ms : 0;
        if (lastMs > 0 && (Date.now() - lastMs) >= threshold) {
          dueReturn.push({
            phone:       c.phone,
            name:        c.name,
            daysSince:   daysSince(lastMs),
            lastService: c.visits[0].service,
            lastMs:      lastMs
          });
        }
      });
      // Sort by days since last visit descending (longest absent first)
      dueReturn.sort(function (a, b) { return b.daysSince - a.daysSince; });
      state.dueReturn = dueReturn;

      // ── Panel 3: Top 5 services + upsell opportunities ──
      var svcCount = {};
      bookings.forEach(function (b) {
        var svc = serviceLabel(b);
        if (svc && svc !== '—') {
          svcCount[svc] = (svcCount[svc] || 0) + 1;
        }
      });
      var svcArr = Object.keys(svcCount).map(function (name) {
        return { name: name, count: svcCount[name], upsell: findUpsell(name) };
      });
      svcArr.sort(function (a, b) { return b.count - a.count; });
      state.topServices = svcArr.slice(0, 5);

      return {
        loyal:       state.loyal,
        dueReturn:   state.dueReturn,
        topServices: state.topServices
      };
    });
  }

  // ── Styles ───────────────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('riStyles')) return;
    var s = document.createElement('style');
    s.id = 'riStyles';
    s.textContent =
      '.ri-wrap{display:flex;flex-direction:column;gap:1.25rem}' +
      '.ri-toolbar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.6rem;margin-bottom:.25rem}' +
      '.ri-title{font-family:var(--font-d);font-size:1.5rem;color:var(--cream)}' +
      '.ri-subtitle{font-size:.72rem;color:var(--muted);margin-top:.15rem}' +
      '.ri-loading{text-align:center;padding:2.5rem 1rem;color:var(--muted);font-size:.85rem}' +
      '.ri-error{background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.25);' +
        'border-radius:8px;padding:.75rem 1rem;font-size:.78rem;color:var(--danger)}' +
      // Panel card
      '.ri-panel{background:var(--navy-800);border:1px solid var(--border);' +
        'border-radius:10px;padding:1rem 1.25rem;margin-bottom:0}' +
      '.ri-panel-hdr{display:flex;align-items:center;justify-content:space-between;' +
        'margin-bottom:.75rem;flex-wrap:wrap;gap:.4rem}' +
      '.ri-panel-title{font-size:.78rem;font-weight:700;color:var(--cream);' +
        'text-transform:uppercase;letter-spacing:.06em}' +
      '.ri-panel-count{font-size:.68rem;color:var(--muted);background:rgba(255,255,255,.06);' +
        'border:1px solid var(--border);border-radius:99px;padding:1px 8px}' +
      // Table
      '.ri-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}' +
      '.ri-table{width:100%;border-collapse:collapse;font-size:.77rem;min-width:360px}' +
      '.ri-table th{text-align:left;font-size:.58rem;font-weight:700;color:var(--muted);' +
        'text-transform:uppercase;letter-spacing:.05em;padding:.28rem .4rem .28rem 0;' +
        'border-bottom:1px solid var(--border);white-space:nowrap}' +
      '.ri-table td{padding:.42rem .4rem .42rem 0;border-bottom:1px solid rgba(255,255,255,.04);' +
        'color:var(--text);vertical-align:middle}' +
      '.ri-table tbody tr:last-child td{border-bottom:none}' +
      '.ri-name{font-weight:600;color:var(--cream)}' +
      '.ri-phone{font-size:.66rem;color:var(--muted);font-family:var(--font-mono,monospace)}' +
      '.ri-badge-visits{display:inline-flex;align-items:center;justify-content:center;' +
        'min-width:1.6rem;height:1.6rem;border-radius:99px;font-size:.7rem;font-weight:700;' +
        'background:rgba(74,222,128,.12);border:1px solid rgba(74,222,128,.3);color:var(--success)}' +
      '.ri-badge-days{display:inline-flex;align-items:center;' +
        'font-size:.66rem;font-weight:700;padding:1px 6px;border-radius:3px;' +
        'background:rgba(251,146,60,.12);border:1px solid rgba(251,146,60,.3);color:#fb923c}' +
      '.ri-svc-name{font-weight:600;color:var(--cream)}' +
      '.ri-upsell{font-size:.65rem;color:var(--gold-lt);margin-top:.1rem;font-style:italic}' +
      '.ri-count-pill{display:inline-flex;align-items:center;justify-content:center;' +
        'min-width:1.8rem;height:1.6rem;border-radius:4px;font-size:.7rem;font-weight:700;' +
        'background:rgba(34,211,238,.1);border:1px solid rgba(34,211,238,.28);color:var(--cyan)}' +
      // Note / disclaimer block
      '.ri-note{font-size:.66rem;color:var(--muted);margin-top:.65rem;' +
        'padding:.45rem .65rem;background:rgba(255,255,255,.03);' +
        'border-left:2px solid var(--border-g);border-radius:0 4px 4px 0;' +
        'font-style:italic;line-height:1.5}' +
      '.ri-empty{text-align:center;padding:1.5rem 1rem;color:var(--muted);font-size:.82rem}' +
      '@media(max-width:599px){.ri-table{font-size:.73rem;min-width:300px}}';
    document.head.appendChild(s);
  }

  // ── Render helpers ────────────────────────────────────────────────────────────

  function renderLoyal() {
    var rows = state.loyal;
    if (!rows.length) {
      return '<div class="ri-empty">' + esc(_T('ri_empty_loyal')) + '</div>';
    }
    var html =
      '<div class="ri-table-wrap"><table class="ri-table">' +
      '<thead><tr>' +
        '<th>' + esc(_T('ri_col_name_phone')) + '</th>' +
        '<th>' + esc(_T('ri_col_visits')) + '</th>' +
        '<th>' + esc(_T('ri_col_last_service')) + '</th>' +
        '<th>' + esc(_T('ri_col_last_date')) + '</th>' +
      '</tr></thead><tbody>';

    rows.forEach(function (c) {
      html +=
        '<tr>' +
          '<td>' +
            '<div class="ri-name">' + esc(c.name) + '</div>' +
            '<div class="ri-phone">' + esc(maskPhone(c.phone)) + '</div>' +
          '</td>' +
          '<td><span class="ri-badge-visits">' + c.visits + '</span></td>' +
          '<td>' + esc(c.lastService) + '</td>' +
          '<td style="white-space:nowrap;font-size:.72rem">' + esc(fmtDate(c.lastMs)) + '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    return html;
  }

  function renderDueReturn() {
    var rows = state.dueReturn;
    if (!rows.length) {
      return '<div class="ri-empty">' + esc(_T('ri_empty_due')) + '</div>';
    }
    var html =
      '<div class="ri-table-wrap"><table class="ri-table">' +
      '<thead><tr>' +
        '<th>' + esc(_T('ri_col_name_phone')) + '</th>' +
        '<th>' + esc(_T('ri_col_absent')) + '</th>' +
        '<th>' + esc(_T('ri_col_last_service')) + '</th>' +
        '<th>' + esc(_T('ri_col_last_date')) + '</th>' +
      '</tr></thead><tbody>';

    rows.forEach(function (c) {
      html +=
        '<tr>' +
          '<td>' +
            '<div class="ri-name">' + esc(c.name) + '</div>' +
            '<div class="ri-phone">' + esc(maskPhone(c.phone)) + '</div>' +
          '</td>' +
          '<td><span class="ri-badge-days">' + c.daysSince + ' ' + esc(_T('ri_days_suffix')) + '</span></td>' +
          '<td>' + esc(c.lastService) + '</td>' +
          '<td style="white-space:nowrap;font-size:.72rem">' + esc(fmtDate(c.lastMs)) + '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    html += '<div class="ri-note">' + esc(_T('ri_note_due')) + '</div>';
    return html;
  }

  function renderTopServices() {
    var rows = state.topServices;
    if (!rows.length) {
      return '<div class="ri-empty">' + esc(_T('ri_empty_top')) + '</div>';
    }
    var maxCount = rows[0].count || 1;
    var html =
      '<div class="ri-table-wrap"><table class="ri-table">' +
      '<thead><tr>' +
        '<th>' + esc(_T('ri_col_service')) + '</th>' +
        '<th>' + esc(_T('ri_col_visits_short')) + '</th>' +
        '<th>' + esc(_T('ri_col_upsell')) + '</th>' +
      '</tr></thead><tbody>';

    rows.forEach(function (row, idx) {
      var barWidth = Math.round((row.count / maxCount) * 100);
      html +=
        '<tr>' +
          '<td>' +
            '<div class="ri-svc-name">#' + (idx + 1) + ' ' + esc(row.name) + '</div>' +
            '<div style="height:3px;border-radius:2px;background:rgba(255,255,255,.06);margin-top:4px">' +
              '<div style="width:' + barWidth + '%;height:100%;border-radius:2px;background:var(--cyan);opacity:.7"></div>' +
            '</div>' +
          '</td>' +
          '<td><span class="ri-count-pill">' + row.count + '</span></td>' +
          '<td>' +
            '<div class="ri-upsell">✦ ' + esc(row.upsell) + '</div>' +
          '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    html += '<div class="ri-note">' + esc(_T('ri_note_top')) + '</div>';
    return html;
  }

  // ── render ────────────────────────────────────────────────────────────────────

  function render() {
    var el = state.containerEl;
    if (!el) return;

    injectStyles();

    if (state.loading) {
      el.innerHTML =
        '<div class="ri-wrap">' +
          '<div class="ri-loading">⏳ ' + esc(_T('ri_loading')) + '</div>' +
        '</div>';
      return;
    }

    if (state.error) {
      el.innerHTML =
        '<div class="ri-wrap">' +
          '<div class="ri-error">✕ ' + esc(state.error) + '</div>' +
          '<div style="margin-top:.75rem">' +
            '<button class="btn btn--outline btn--sm" onclick="window.SalonRetentionInsights.refresh()">' + esc(_T('btn_refresh')) + '</button>' +
          '</div>' +
        '</div>';
      return;
    }

    var loyalCount = _T('ri_count_customers').replace('{count}', state.loyal.length);
    var dueCount   = _T('ri_count_customers').replace('{count}', state.dueReturn.length);
    var topCount   = _T('ri_count_top').replace('{count}', state.topServices.length);

    el.innerHTML =
      '<div class="ri-wrap">' +

        // ── Toolbar ──
        '<div class="ri-toolbar">' +
          '<div>' +
            '<div class="ri-title">' + esc(_T('ri_title')) + '</div>' +
            '<div class="ri-subtitle">' + esc(_T('ri_subtitle')) + '</div>' +
          '</div>' +
          '<button class="btn btn--outline btn--sm" onclick="window.SalonRetentionInsights.refresh()" style="flex-shrink:0">↻ ' + esc(_T('btn_refresh')) + '</button>' +
        '</div>' +

        // ── Panel 1: Loyal ──
        '<div class="ri-panel">' +
          '<div class="ri-panel-hdr">' +
            '<span class="ri-panel-title">' + esc(_T('ri_panel_loyal')) + '</span>' +
            '<span class="ri-panel-count">' + esc(loyalCount) + '</span>' +
          '</div>' +
          renderLoyal() +
        '</div>' +

        // ── Panel 2: Due for return ──
        '<div class="ri-panel">' +
          '<div class="ri-panel-hdr">' +
            '<span class="ri-panel-title">' + esc(_T('ri_panel_due')) + '</span>' +
            '<span class="ri-panel-count">' + esc(dueCount) + '</span>' +
          '</div>' +
          renderDueReturn() +
        '</div>' +

        // ── Panel 3: Top services + upsell ──
        '<div class="ri-panel">' +
          '<div class="ri-panel-hdr">' +
            '<span class="ri-panel-title">' + esc(_T('ri_panel_top')) + '</span>' +
            '<span class="ri-panel-count">' + esc(topCount) + '</span>' +
          '</div>' +
          renderTopServices() +
        '</div>' +

      '</div>';
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  function init(vendorId, containerEl) {
    if (!vendorId || !containerEl) {
      console.warn('[retention-insights] init requires vendorId and containerEl');
      return;
    }
    if (!window.firebase || !window.firebase.firestore) {
      console.warn('[retention-insights] Firebase not available');
      return;
    }
    state.vendorId    = vendorId;
    state.containerEl = containerEl;
    state.db          = firebase.firestore();
    state.loading     = false;
    state.error       = '';
    state.loyal       = [];
    state.dueReturn   = [];
    state.topServices = [];

    refresh();
  }

  function refresh() {
    state.loading = true;
    state.error   = '';
    render();

    computeInsights()
      .then(function () {
        state.loading = false;
        render();
      })
      .catch(function (err) {
        state.loading = false;
        state.error   = (err && err.message) ? err.message : _T('ri_err_load_failed');
        render();
      });
  }

  function loadInsights() { return computeInsights(); }

  window.SalonRetentionInsights = {
    init:         init,
    loadInsights: loadInsights,
    render:       render,
    refresh:      refresh
  };

}());
