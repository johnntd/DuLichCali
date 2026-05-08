(function () {
  'use strict';

  function _T(key) {
    return (window.SalonI18n && window.SalonI18n.t) ? window.SalonI18n.t(key) : key;
  }

  // ── SalonBusinessDashboard ───────────────────────────────────────────────────
  // Phase 9: Consolidated vendor business dashboard — aggregates key KPIs
  // from bookings, inventory, suppliers/restockOrders, margins, and retention
  // into one summary panel.
  //
  // VENDOR-FACING only. Read-only — no auto-actions of any kind.
  // All writes are done by the vendor or other AI OS modules, never this one.
  //
  // Data sources:
  //   vendors/{vendorId}/bookings      — today / this week / this month counts + revenue
  //   vendors/{vendorId}/inventory     — low stock count (via SalonInventoryDeduction)
  //   vendors/{vendorId}/restockOrders — draft/pending order count
  //   SalonMarginAnalysis              — top / bottom margin service (optional)
  //   SalonRetentionInsights           — at-risk customer count (last seen > 28 days)

  var AT_RISK_DAYS = 28;  // days since last booking → "needs follow-up"

  // ── State ────────────────────────────────────────────────────────────────────

  var state = {
    vendorId:    '',
    containerEl: null,
    db:          null,
    loading:     false,
    error:       ''
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

  // Parse priceFrom from a booking — handles number or string formats
  function parseBookingPrice(booking) {
    if (booking.priceFrom !== undefined && booking.priceFrom !== null) {
      var n = asNumber(booking.priceFrom, -1);
      if (n >= 0) return n;
    }
    if (booking.price !== undefined && booking.price !== null) {
      var str = String(booking.price).replace(/\$/g, '').trim();
      var match = str.match(/[\d.]+/);
      if (match) {
        var p = parseFloat(match[0]);
        if (Number.isFinite(p) && p >= 0) return p;
      }
    }
    return 0;
  }

  // Get start-of-day timestamp for a Date
  function startOfDay(date) {
    var d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Get start-of-week (Monday) for a Date
  function startOfWeek(date) {
    var d = new Date(date);
    var day = d.getDay();           // 0 = Sunday
    var diff = (day === 0) ? -6 : 1 - day;  // shift to Monday
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Normalize a Firestore Timestamp / seconds-object / millis / ISO string → ms
  function tsMillis(ts) {
    if (!ts) return 0;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.seconds === 'number')    return ts.seconds * 1000;
    var n = Number(ts);
    if (Number.isFinite(n) && n > 1e9) return n;
    var parsed = Date.parse(ts);
    return isNaN(parsed) ? 0 : parsed;
  }

  // Format currency — simple $ + comma integer
  function fmtCurrency(n) {
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  // ── Firestore refs ────────────────────────────────────────────────────────────

  function vendorRef() {
    return state.db.collection('vendors').doc(state.vendorId);
  }

  // ── Data loaders ─────────────────────────────────────────────────────────────

  // Load bookings for the current week (Mon 00:00 → now).
  // Returns array of raw booking objects.
  function loadWeekBookings() {
    var weekStart = startOfWeek(new Date());
    return vendorRef().collection('bookings')
      .where('createdAt', '>=', weekStart)
      .orderBy('createdAt', 'desc')
      .limit(300)
      .get()
      .then(function (snap) {
        return snap.docs.map(function (doc) {
          var d = doc.data();
          d._id = doc.id;
          return d;
        });
      })
      .catch(function () {
        // Fallback: no index — load recent and filter client-side
        var weekStartMs = weekStart.getTime();
        return vendorRef().collection('bookings')
          .orderBy('createdAt', 'desc')
          .limit(300)
          .get()
          .then(function (snap) {
            return snap.docs
              .map(function (doc) { var d = doc.data(); d._id = doc.id; return d; })
              .filter(function (d) { return tsMillis(d.createdAt) >= weekStartMs; });
          })
          .catch(function () { return []; });
      });
  }

  // Load low-stock inventory item count.
  // Delegates to SalonInventoryDeduction.getLowStockItems if available,
  // otherwise queries directly.
  function loadLowStockCount() {
    if (window.SalonInventoryDeduction && window.SalonInventoryDeduction.getLowStockItems) {
      return window.SalonInventoryDeduction.getLowStockItems(state.vendorId)
        .then(function (items) { return items ? items.length : 0; })
        .catch(function () { return 0; });
    }
    // Direct query fallback
    return vendorRef().collection('inventory')
      .where('active', '==', true)
      .get()
      .then(function (snap) {
        var count = 0;
        snap.docs.forEach(function (doc) {
          var d = doc.data();
          if (Number(d.currentQty) <= Number(d.minQty)) count++;
        });
        return count;
      })
      .catch(function () { return 0; });
  }

  // Load count of draft / pending restock orders.
  function loadPendingOrderCount() {
    return vendorRef().collection('restockOrders')
      .where('status', 'in', ['draft', 'pending'])
      .get()
      .then(function (snap) { return snap.size; })
      .catch(function () { return 0; });
  }

  // ── Derive metrics from bookings ─────────────────────────────────────────────

  function deriveBookingMetrics(bookings) {
    var now = Date.now();
    var todayStart = startOfDay(new Date()).getTime();
    var weekStart  = startOfWeek(new Date()).getTime();

    var todayCount  = 0;
    var weekCount   = 0;
    var weekRevenue = 0;

    // For at-risk customers: track last booking ts per phone
    var lastSeenByPhone = {};

    bookings.forEach(function (b) {
      var bts = tsMillis(b.createdAt);

      // Count per period
      if (bts >= todayStart) todayCount++;
      if (bts >= weekStart)  weekCount++;

      // Revenue: only completed bookings this week
      if (bts >= weekStart) {
        var status = (b.status || '').toLowerCase();
        if (status === 'completed' || status === 'done') {
          weekRevenue += parseBookingPrice(b);
        }
      }

      // Track last seen per customer phone (masked to raw digits)
      var phone = String(b.phone || b.customerPhone || '').replace(/\D/g, '');
      if (phone) {
        var existing = lastSeenByPhone[phone] || 0;
        if (bts > existing) lastSeenByPhone[phone] = bts;
      }
    });

    // At-risk customers: last seen > AT_RISK_DAYS ago
    var atRiskThreshold = now - (AT_RISK_DAYS * 24 * 60 * 60 * 1000);
    var atRiskCount = 0;
    Object.keys(lastSeenByPhone).forEach(function (phone) {
      if (lastSeenByPhone[phone] < atRiskThreshold) atRiskCount++;
    });

    return {
      todayCount:  todayCount,
      weekCount:   weekCount,
      weekRevenue: weekRevenue,
      atRiskCount: atRiskCount
    };
  }

  // ── Margin summary from SalonMarginAnalysis ──────────────────────────────────

  function loadMarginSummary() {
    if (!window.SalonMarginAnalysis || typeof window.SalonMarginAnalysis.computeMargins !== 'function') {
      return Promise.resolve(null);
    }
    return window.SalonMarginAnalysis.computeMargins()
      .then(function (results) {
        if (!results || !results.length) return null;
        // computeMargins returns sorted ascending by marginPct (worst first)
        var worst = results[0];
        var best  = results[results.length - 1];
        return { worst: worst, best: best };
      })
      .catch(function () { return null; });
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  function renderLoading() {
    if (!state.containerEl) return;
    state.containerEl.innerHTML =
      '<div style="padding:2rem 1rem;text-align:center;color:var(--muted);font-size:.85rem">' +
        '<div style="display:inline-block;width:28px;height:28px;border:2px solid var(--border);' +
          'border-top-color:var(--gold);border-radius:50%;animation:spin .8s linear infinite;margin-bottom:.75rem"></div>' +
        '<div>' + esc(_T('bdb_loading')) + '</div>' +
      '</div>';
  }

  function renderError(msg) {
    if (!state.containerEl) return;
    state.containerEl.innerHTML =
      '<div style="padding:1.5rem 1rem;text-align:center;color:var(--danger);font-size:.82rem">' +
        '<div style="font-size:1.1rem;margin-bottom:.4rem">⚠</div>' +
        '<div>' + esc(msg || _T('bdb_err_load_failed')) + '</div>' +
        '<button class="btn btn--outline btn--sm" onclick="window.SalonBusinessDashboard.refresh()" ' +
          'style="margin-top:.75rem">' + esc(_T('bdb_btn_retry')) + '</button>' +
      '</div>';
  }

  function renderDashboard(data) {
    if (!state.containerEl) return;

    var metrics     = data.metrics;
    var lowStock    = data.lowStockCount;
    var pendingOrds = data.pendingOrderCount;
    var marginSummary = data.marginSummary;

    // ── KPI tiles ────────────────────────────────────────────────────────────
    var tiles = [
      {
        id: 'tile-today',
        num: metrics.todayCount,
        lbl: _T('bdb_tile_today'),
        icon: '&#128197;',
        alert: false
      },
      {
        id: 'tile-week',
        num: metrics.weekCount,
        lbl: _T('bdb_tile_week'),
        icon: '&#128336;',
        alert: false
      },
      {
        id: 'tile-revenue',
        num: fmtCurrency(metrics.weekRevenue),
        lbl: _T('bdb_tile_revenue'),
        icon: '&#128178;',
        alert: false,
        sub: _T('bdb_tile_revenue_sub')
      },
      {
        id: 'tile-lowstock',
        num: lowStock,
        lbl: _T('bdb_tile_lowstock'),
        icon: '&#9638;',
        alert: lowStock > 0,
        alertColor: '#f87171'
      },
      {
        id: 'tile-orders',
        num: pendingOrds,
        lbl: _T('bdb_tile_orders'),
        icon: '&#128666;',
        alert: pendingOrds > 0,
        alertColor: '#fbbf24'
      },
      {
        id: 'tile-atrisk',
        num: metrics.atRiskCount,
        lbl: _T('bdb_tile_atrisk'),
        icon: '&#128101;',
        alert: metrics.atRiskCount > 0,
        alertColor: '#fb923c',
        sub: _T('bdb_tile_atrisk_sub')
      }
    ];

    var tilesHtml = tiles.map(function (t) {
      var borderStyle = t.alert
        ? 'border-color:' + t.alertColor + ';background:rgba(248,113,113,.04)'
        : '';
      var numStyle = t.alert
        ? 'color:' + t.alertColor
        : 'color:var(--cream)';
      var subHtml = t.sub
        ? '<div style="font-size:.6rem;color:var(--muted);margin-top:.18rem;opacity:.8">' + esc(t.sub) + '</div>'
        : '';
      return (
        '<div class="bdb-tile" id="' + t.id + '" style="' + borderStyle + '">' +
          '<div class="bdb-tile__icon">' + t.icon + '</div>' +
          '<div class="bdb-tile__num" style="' + numStyle + '">' + esc(String(t.num)) + '</div>' +
          '<div class="bdb-tile__lbl">' + esc(t.lbl) + '</div>' +
          subHtml +
        '</div>'
      );
    }).join('');

    // ── Margin insight ────────────────────────────────────────────────────────
    var marginHtml = '';
    if (marginSummary) {
      var worstName = marginSummary.worst && marginSummary.worst.name ? marginSummary.worst.name : '—';
      var worstPct  = marginSummary.worst && marginSummary.worst.marginPct != null
        ? Math.round(marginSummary.worst.marginPct) + '%' : '—';
      var bestName  = marginSummary.best  && marginSummary.best.name  ? marginSummary.best.name  : '—';
      var bestPct   = marginSummary.best  && marginSummary.best.marginPct != null
        ? Math.round(marginSummary.best.marginPct) + '%' : '—';
      marginHtml =
        '<div class="bdb-insight">' +
          '<div class="bdb-insight__title">' + esc(_T('bdb_margin_title')) + '</div>' +
          '<div class="bdb-insight__row">' +
            '<span class="bdb-insight__badge bdb-insight__badge--low">' + esc(_T('bdb_margin_low')) + '</span>' +
            '<span class="bdb-insight__val">' + esc(worstName) + '</span>' +
            '<span class="bdb-insight__pct" style="color:var(--danger)">' + esc(worstPct) + '</span>' +
          '</div>' +
          '<div class="bdb-insight__row">' +
            '<span class="bdb-insight__badge bdb-insight__badge--high">' + esc(_T('bdb_margin_high')) + '</span>' +
            '<span class="bdb-insight__val">' + esc(bestName) + '</span>' +
            '<span class="bdb-insight__pct" style="color:var(--success)">' + esc(bestPct) + '</span>' +
          '</div>' +
        '</div>';
    }

    // ── Quick actions ─────────────────────────────────────────────────────────
    var actionsHtml =
      '<div class="bdb-actions">' +
        '<button class="btn btn--outline btn--sm bdb-action-btn" ' +
          'onclick="typeof switchTab===\'function\' && switchTab(\'inventory\')">' +
          '&#9638; ' + esc(_T('bdb_action_inventory')) +
        '</button>' +
        '<button class="btn btn--outline btn--sm bdb-action-btn" ' +
          'onclick="typeof switchTab===\'function\' && switchTab(\'pricing\')">' +
          '&#128178; ' + esc(_T('bdb_action_pricing')) +
        '</button>' +
        '<button class="btn btn--outline btn--sm bdb-action-btn" ' +
          'onclick="window.SalonBusinessDashboard.refresh()">' +
          '&#8635; ' + esc(_T('bdb_action_refresh')) +
        '</button>' +
      '</div>';

    // ── Full render ───────────────────────────────────────────────────────────
    state.containerEl.innerHTML =
      // Scoped styles
      '<style>' +
        '.bdb-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.65rem;margin-bottom:1rem}' +
        '@media(min-width:480px){.bdb-grid{grid-template-columns:repeat(3,1fr)}}' +
        '@media(min-width:900px){.bdb-grid{grid-template-columns:repeat(6,1fr)}}' +
        '.bdb-tile{background:var(--navy-800);border:1px solid var(--border);border-radius:var(--r);' +
          'padding:.9rem .75rem;text-align:center;transition:border-color .2s}' +
        '.bdb-tile__icon{font-size:1.2rem;line-height:1;margin-bottom:.3rem;opacity:.7}' +
        '.bdb-tile__num{font-family:var(--font-d);font-size:1.7rem;font-weight:400;line-height:1;margin-bottom:.22rem}' +
        '.bdb-tile__lbl{font-size:.58rem;font-weight:700;color:var(--muted);text-transform:uppercase;' +
          'letter-spacing:.05em;line-height:1.35}' +
        '.bdb-insight{background:var(--navy-800);border:1px solid var(--border);border-radius:var(--r);' +
          'padding:.85rem 1rem;margin-bottom:.75rem}' +
        '.bdb-insight__title{font-size:.68rem;font-weight:700;color:var(--gold);text-transform:uppercase;' +
          'letter-spacing:.06em;margin-bottom:.55rem}' +
        '.bdb-insight__row{display:flex;align-items:center;gap:.45rem;padding:.22rem 0;' +
          'border-bottom:1px solid var(--border)}' +
        '.bdb-insight__row:last-child{border-bottom:none}' +
        '.bdb-insight__badge{font-size:.54rem;font-weight:700;padding:1px 5px;border-radius:3px;' +
          'text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;flex-shrink:0}' +
        '.bdb-insight__badge--low{background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.3);color:#f87171}' +
        '.bdb-insight__badge--high{background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.3);color:#4ade80}' +
        '.bdb-insight__val{flex:1;font-size:.78rem;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '.bdb-insight__pct{font-size:.82rem;font-weight:700;flex-shrink:0}' +
        '.bdb-actions{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.25rem}' +
        '.bdb-action-btn{flex:1;min-width:7rem;text-align:center}' +
      '</style>' +

      // Section header
      '<div class="sa-section-header">' +
        '<div class="sa-section-title">' + esc(_T('bdb_title')) + '</div>' +
      '</div>' +

      // KPI tiles
      '<div class="bdb-grid">' + tilesHtml + '</div>' +

      // Margin insight (only if data available)
      marginHtml +

      // Quick actions
      actionsHtml;
  }

  // ── loadDashboard ─────────────────────────────────────────────────────────────

  function loadDashboard() {
    if (!state.vendorId || !state.db) {
      renderError(_T('bdb_err_not_init'));
      return Promise.resolve();
    }
    if (state.loading) return Promise.resolve();
    state.loading = true;
    state.error = '';
    renderLoading();

    var p1 = loadWeekBookings();
    var p2 = loadLowStockCount();
    var p3 = loadPendingOrderCount();
    var p4 = loadMarginSummary();

    return Promise.all([p1, p2, p3, p4])
      .then(function (results) {
        var bookings          = results[0];
        var lowStockCount     = results[1];
        var pendingOrderCount = results[2];
        var marginSummary     = results[3];

        var metrics = deriveBookingMetrics(bookings);

        state.loading = false;
        renderDashboard({
          metrics:           metrics,
          lowStockCount:     lowStockCount,
          pendingOrderCount: pendingOrderCount,
          marginSummary:     marginSummary
        });
      })
      .catch(function (err) {
        state.loading = false;
        state.error = err && err.message ? err.message : _T('bdb_err_unknown');
        renderError(state.error);
        console.warn('[business-dashboard] loadDashboard error:', state.error);
      });
  }

  // ── init ─────────────────────────────────────────────────────────────────────

  function init(vendorId, containerEl) {
    if (!vendorId) {
      console.warn('[business-dashboard] init: missing vendorId');
      return;
    }
    if (!containerEl) {
      console.warn('[business-dashboard] init: missing containerEl');
      return;
    }
    if (!window.firebase || !window.firebase.firestore) {
      if (containerEl) {
        containerEl.innerHTML = '<div class="sa-empty">' + (window.SalonI18n && window.SalonI18n.t ? window.SalonI18n.t('bdb_err_firebase') : 'Firebase chưa sẵn sàng.') + '</div>';
      }
      console.warn('[business-dashboard] init: Firebase Firestore not available');
      return;
    }

    state.vendorId    = vendorId;
    state.containerEl = containerEl;
    state.db          = window.firebase.firestore();
    state.loading     = false;
    state.error       = '';

    loadDashboard();
  }

  // ── refresh ───────────────────────────────────────────────────────────────────

  function refresh() {
    state.loading = false;  // allow re-run
    loadDashboard();
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  window.SalonBusinessDashboard = {
    init:          init,
    loadDashboard: loadDashboard,
    refresh:       refresh
  };

}());
