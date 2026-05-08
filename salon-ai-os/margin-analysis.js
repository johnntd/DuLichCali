(function () {
  'use strict';

  // ── SalonMarginAnalysis ──────────────────────────────────────────────────────
  // Phase 5: AI Cost & Margin Analysis — read-only, vendor-only.
  // Computes per-service material cost vs service price locally from Firestore.
  // NEVER auto-changes prices. Suggestions only.

  function _T(key) {
    return (window.SalonI18n && window.SalonI18n.t) ? window.SalonI18n.t(key) : key;
  }

  var state = {
    vendorId: '',
    containerEl: null,
    db: null,
    loading: false,
    error: '',
    results: []   // sorted worst margin first
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

  function asNumber(v, fallback) {
    var n = Number(v);
    return Number.isFinite(n) ? n : (fallback !== undefined ? fallback : 0);
  }

  // Parse price from various formats:
  //   priceFrom (number), price (string like "$25" or "25", or "25-40")
  function parsePrice(service) {
    if (service.priceFrom !== undefined && service.priceFrom !== null) {
      var n = asNumber(service.priceFrom, -1);
      if (n >= 0) return n;
    }
    if (service.price !== undefined && service.price !== null) {
      // Strip leading $ and take first number in range "25-40" → 25
      var str = String(service.price).replace(/\$/g, '').trim();
      var match = str.match(/[\d.]+/);
      if (match) {
        var p = parseFloat(match[0]);
        if (Number.isFinite(p) && p >= 0) return p;
      }
    }
    return 0;
  }

  // ── Firestore refs ────────────────────────────────────────────────────────────

  function vendorDoc() {
    return state.db.collection('vendors').doc(state.vendorId);
  }

  function servicesColRef() {
    return vendorDoc().collection('services');
  }

  function serviceMaterialsColRef() {
    return vendorDoc().collection('serviceMaterials');
  }

  function inventoryColRef() {
    return vendorDoc().collection('inventory');
  }

  // ── computeMargins ───────────────────────────────────────────────────────────
  // Loads all three collections, computes per-service margins,
  // returns array sorted ascending by marginPct (worst first).
  // Services with no price are listed last, not first.

  function computeMargins() {
    if (!state.vendorId || !state.db) {
      return Promise.reject(new Error(_T('ma_err_not_init')));
    }

    // 1. Load services (active)
    var p1 = servicesColRef().where('active', '==', true).get()
      .then(function (snap) {
        return snap.docs.map(function (doc) {
          return Object.assign({ id: doc.id }, doc.data());
        });
      })
      .catch(function () { return []; });

    // 2. Load serviceMaterials (active)
    var p2 = serviceMaterialsColRef().where('active', '==', true).get()
      .then(function (snap) {
        return snap.docs.map(function (doc) {
          return Object.assign({ id: doc.id }, doc.data());
        });
      })
      .catch(function () { return []; });

    // 3. Load inventory (active)
    var p3 = inventoryColRef().where('active', '==', true).get()
      .then(function (snap) {
        return snap.docs.map(function (doc) {
          return Object.assign({ id: doc.id }, doc.data());
        });
      })
      .catch(function () { return []; });

    return Promise.all([p1, p2, p3]).then(function (results) {
      var services        = results[0];
      var materialMappings = results[1];
      var inventory       = results[2];

      // Build lookup: productId → inventory item
      var invMap = {};
      inventory.forEach(function (item) {
        invMap[item.id] = item;
      });

      // Build lookup: serviceId → materials array
      var matMap = {};
      materialMappings.forEach(function (mapping) {
        matMap[mapping.id] = mapping.materials || [];
      });

      // Compute per-service
      var rows = services.map(function (svc) {
        var revenueEstimate = parsePrice(svc);
        var materials = matMap[svc.id] || [];

        var materialCost = 0;
        var materialDetails = [];
        materials.forEach(function (mat) {
          var invItem = invMap[mat.productId];
          if (!invItem) return;
          var costPerUnit = asNumber(invItem.costPerUnit, 0);
          var qty = asNumber(mat.qtyPerService, 0);
          var lineCost = costPerUnit * qty;
          materialCost += lineCost;
          materialDetails.push({
            name: mat.productNameSnapshot || invItem.name || mat.productId,
            qty: qty,
            unit: mat.unit || invItem.unit || '',
            costPerUnit: costPerUnit,
            lineCost: lineCost
          });
        });

        var grossMargin = revenueEstimate - materialCost;
        var marginPct = (revenueEstimate > 0)
          ? (grossMargin / revenueEstimate) * 100
          : null;

        return {
          serviceId:       svc.id,
          serviceName:     svc.name || svc.id,
          revenueEstimate: revenueEstimate,
          materialCost:    materialCost,
          grossMargin:     grossMargin,
          marginPct:       marginPct,
          materialDetails: materialDetails,
          hasMaterials:    materials.length > 0
        };
      });

      // Sort: null marginPct (no price) last; then ascending by marginPct (worst first)
      rows.sort(function (a, b) {
        if (a.marginPct === null && b.marginPct === null) return 0;
        if (a.marginPct === null) return 1;
        if (b.marginPct === null) return -1;
        return a.marginPct - b.marginPct;
      });

      state.results = rows;
      return rows;
    });
  }

  // ── Styles ───────────────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('maStyles')) return;
    var s = document.createElement('style');
    s.id = 'maStyles';
    s.textContent =
      '.ma-wrap{display:flex;flex-direction:column;gap:1rem}' +
      '.ma-toolbar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.6rem}' +
      '.ma-title{font-family:var(--font-d);font-size:1.5rem;color:var(--cream)}' +
      '.ma-subtitle{font-size:.72rem;color:var(--muted);margin-top:.15rem}' +
      '.ma-loading{text-align:center;padding:2.5rem 1rem;color:var(--muted);font-size:.85rem}' +
      '.ma-error{background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.25);' +
        'border-radius:8px;padding:.75rem 1rem;font-size:.78rem;color:var(--danger)}' +
      '.ma-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}' +
      '.ma-table{width:100%;border-collapse:collapse;font-size:.78rem;min-width:420px}' +
      '.ma-table th{text-align:left;font-size:.6rem;font-weight:700;color:var(--muted);' +
        'text-transform:uppercase;letter-spacing:.05em;padding:.32rem .45rem .32rem 0;' +
        'border-bottom:1px solid var(--border);white-space:nowrap}' +
      '.ma-table th:not(:first-child){text-align:right}' +
      '.ma-table td{padding:.45rem .45rem .45rem 0;border-bottom:1px solid rgba(255,255,255,.04);' +
        'color:var(--text);vertical-align:middle}' +
      '.ma-table td:not(:first-child){text-align:right}' +
      '.ma-table tbody tr:last-child td{border-bottom:none}' +
      '.ma-svc-name{font-weight:600;color:var(--cream);font-size:.82rem}' +
      '.ma-svc-note{font-size:.64rem;color:var(--muted);margin-top:.1rem;font-style:italic}' +
      '.ma-pct-cell{font-weight:700;font-size:.82rem;white-space:nowrap}' +
      '.ma-pct--green{color:#4ade80}' +
      '.ma-pct--yellow{color:#fbbf24}' +
      '.ma-pct--red{color:#f87171}' +
      '.ma-pct--na{color:var(--muted);font-style:italic;font-weight:400}' +
      '.ma-pct-bar{height:4px;border-radius:2px;margin-top:3px;background:rgba(255,255,255,.06);min-width:40px}' +
      '.ma-pct-fill{height:100%;border-radius:2px;transition:width .3s}' +
      '.ma-suggestions{background:rgba(245,166,35,.06);border:1px solid rgba(245,166,35,.22);' +
        'border-radius:8px;padding:.75rem 1rem}' +
      '.ma-sugg-title{font-size:.62rem;font-weight:700;color:var(--gold);text-transform:uppercase;' +
        'letter-spacing:.08em;margin-bottom:.55rem}' +
      '.ma-sugg-item{font-size:.76rem;color:var(--text);padding:.3rem 0;' +
        'border-bottom:1px solid rgba(255,255,255,.05);line-height:1.5}' +
      '.ma-sugg-item:last-child{border-bottom:none}' +
      '.ma-sugg-icon{display:inline-block;margin-right:.35rem;opacity:.75}' +
      '.ma-empty{text-align:center;padding:2.5rem 1rem;color:var(--muted);font-size:.85rem}' +
      '@media(max-width:599px){' +
        '.ma-table{font-size:.73rem;min-width:340px}' +
      '}';
    document.head.appendChild(s);
  }

  // ── Render helpers ────────────────────────────────────────────────────────────

  function fmtCurrency(n) {
    if (n === 0) return '$0';
    return '$' + n.toFixed(2);
  }

  function pctClass(pct) {
    if (pct === null) return 'ma-pct--na';
    if (pct >= 60) return 'ma-pct--green';
    if (pct >= 30) return 'ma-pct--yellow';
    return 'ma-pct--red';
  }

  function pctFillColor(pct) {
    if (pct === null) return 'rgba(255,255,255,.15)';
    if (pct >= 60) return '#4ade80';
    if (pct >= 30) return '#fbbf24';
    return '#f87171';
  }

  function renderTable(rows) {
    if (!rows || !rows.length) {
      return '<div class="ma-empty">' + esc(_T('ma_empty')) + '</div>';
    }

    var html =
      '<div class="ma-table-wrap">' +
      '<table class="ma-table">' +
      '<thead><tr>' +
        '<th>' + esc(_T('ma_col_service')) + '</th>' +
        '<th>' + esc(_T('ma_col_price')) + '</th>' +
        '<th>' + esc(_T('ma_col_mat_cost')) + '</th>' +
        '<th>' + esc(_T('ma_col_gross')) + '</th>' +
        '<th>' + esc(_T('ma_col_pct')) + '</th>' +
      '</tr></thead>' +
      '<tbody>';

    rows.forEach(function (row) {
      var pctDisplay = row.marginPct !== null
        ? (row.marginPct.toFixed(1) + '%')
        : 'N/A';
      var barWidth = row.marginPct !== null
        ? Math.max(0, Math.min(100, row.marginPct)).toFixed(1)
        : '0';

      var noMatsNote = !row.hasMaterials
        ? '<div class="ma-svc-note">' + esc(_T('ma_no_materials')) + '</div>'
        : '';

      html +=
        '<tr>' +
          '<td>' +
            '<div class="ma-svc-name">' + esc(row.serviceName) + '</div>' +
            noMatsNote +
          '</td>' +
          '<td>' + (row.revenueEstimate > 0 ? fmtCurrency(row.revenueEstimate) : '<span style="color:var(--muted)">–</span>') + '</td>' +
          '<td>' + (row.materialCost > 0 ? fmtCurrency(row.materialCost) : '<span style="color:var(--muted)">$0</span>') + '</td>' +
          '<td style="color:' + (row.grossMargin >= 0 ? '#4ade80' : '#f87171') + '">' +
            fmtCurrency(row.grossMargin) +
          '</td>' +
          '<td>' +
            '<div class="ma-pct-cell ' + pctClass(row.marginPct) + '">' + esc(pctDisplay) + '</div>' +
            '<div class="ma-pct-bar"><div class="ma-pct-fill" style="width:' + barWidth + '%;background:' + pctFillColor(row.marginPct) + '"></div></div>' +
          '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    return html;
  }

  function renderSuggestions(rows) {
    // Find up to top 3 worst-margin services that have a price set
    var candidates = rows.filter(function (r) {
      return r.marginPct !== null;
    }).slice(0, 3);

    if (!candidates.length) return '';

    var items = candidates.map(function (row) {
      var pct = row.marginPct.toFixed(1);
      var icon = row.marginPct < 30 ? '⚠' : '∘';
      var msg;
      var safeName = esc(row.serviceName);
      if (row.materialCost === 0 && !row.hasMaterials) {
        msg = _T('ma_sugg_no_mats').replace('{name}', safeName);
      } else if (row.marginPct < 30) {
        msg = _T('ma_sugg_low').replace('{name}', safeName).replace('{pct}', pct);
      } else {
        msg = _T('ma_sugg_med').replace('{name}', safeName).replace('{pct}', pct);
      }
      return '<div class="ma-sugg-item"><span class="ma-sugg-icon">' + icon + '</span>' + msg + '</div>';
    }).join('');

    return (
      '<div class="ma-suggestions">' +
        '<div class="ma-sugg-title">' + esc(_T('ma_sugg_title')) + '</div>' +
        items +
        '<div style="font-size:.64rem;color:var(--muted);margin-top:.5rem;font-style:italic">' +
          esc(_T('ma_sugg_disclaimer')) +
        '</div>' +
      '</div>'
    );
  }

  // ── render ────────────────────────────────────────────────────────────────────

  function render() {
    var el = state.containerEl;
    if (!el) return;

    injectStyles();

    if (state.loading) {
      el.innerHTML =
        '<div class="ma-wrap">' +
          '<div class="ma-loading">⏳ ' + esc(_T('ma_loading')) + '</div>' +
        '</div>';
      return;
    }

    if (state.error) {
      el.innerHTML =
        '<div class="ma-wrap">' +
          '<div class="ma-error">✕ ' + esc(state.error) + '</div>' +
          '<div style="margin-top:.75rem">' +
            '<button class="btn btn--outline btn--sm" onclick="window.SalonMarginAnalysis.refresh()">' + esc(_T('btn_recalc')) + '</button>' +
          '</div>' +
        '</div>';
      return;
    }

    var tableHtml      = renderTable(state.results);
    var suggestionsHtml = renderSuggestions(state.results);

    el.innerHTML =
      '<div class="ma-wrap">' +
        '<div class="ma-toolbar">' +
          '<div>' +
            '<div class="ma-title">' + esc(_T('ma_title')) + '</div>' +
            '<div class="ma-subtitle">' + esc(_T('ma_subtitle')) + '</div>' +
          '</div>' +
          '<button class="btn btn--outline btn--sm" onclick="window.SalonMarginAnalysis.refresh()" style="flex-shrink:0">↻ ' + esc(_T('btn_recalc')) + '</button>' +
        '</div>' +
        tableHtml +
        suggestionsHtml +
      '</div>';
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  function init(vendorId, containerEl) {
    if (!vendorId || !containerEl) {
      console.warn('[margin-analysis] init requires vendorId and containerEl');
      return;
    }
    if (!window.firebase || !window.firebase.firestore) {
      console.warn('[margin-analysis] Firebase not available');
      return;
    }
    state.vendorId    = vendorId;
    state.containerEl = containerEl;
    state.db          = firebase.firestore();
    state.loading     = false;
    state.error       = '';
    state.results     = [];

    // Auto-load on init
    refresh();
  }

  function refresh() {
    state.loading = true;
    state.error   = '';
    render();

    computeMargins()
      .then(function (rows) {
        state.loading = false;
        state.results = rows;
        render();
      })
      .catch(function (err) {
        state.loading = false;
        state.error   = (err && err.message) ? err.message : _T('ma_err_load_failed');
        render();
      });
  }

  window.SalonMarginAnalysis = {
    init: init,
    computeMargins: computeMargins,
    render: render,
    refresh: refresh
  };

}());
