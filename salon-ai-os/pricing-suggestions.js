(function () {
  'use strict';

  // ── SalonPricingSuggestions ──────────────────────────────────────────────────
  // Phase 7: Smart Pricing Suggestions & Demand Tracking — READ-ONLY.
  // Rule-based only (no LLM calls). NEVER auto-changes prices.
  // Vendor must explicitly click Save to update any price.
  //
  // Data sources (all Firestore, sub-collections under vendors/{vendorId}):
  //   bookings          — last 60 days, limit 300
  //   services          — active services with priceFrom
  //   serviceMaterials  — material costs per service
  //   inventory         — costPerUnit per product

  function _T(key) {
    return (window.SalonI18n && window.SalonI18n.t) ? window.SalonI18n.t(key) : key;
  }

  var DAYS_60 = 60 * 24 * 60 * 60 * 1000;

  // Thresholds
  var MARGIN_THRESHOLD_LOW  = 0.40;   // < 40% margin on high-demand → suggest raise
  var COST_MULTIPLE_FLOOR   = 3;      // price < cost × 3 → suggest raise
  var HIGH_DEMAND_MIN       = 5;      // 5+ bookings in 60 days → high
  var MEDIUM_DEMAND_MIN     = 2;      // 2-4 → medium; 1 → low; 0 → none

  // ── State ─────────────────────────────────────────────────────────────────────

  var state = {
    vendorId:   '',
    containerEl: null,
    db:          null,
    loading:     false,
    error:       '',
    suggestions: []
  };

  // ── Helpers ───────────────────────────────────────────────────────────────────

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

  function parsePrice(service) {
    if (service.priceFrom !== undefined && service.priceFrom !== null) {
      var n = asNumber(service.priceFrom, -1);
      if (n >= 0) return n;
    }
    if (service.price !== undefined && service.price !== null) {
      var str = String(service.price).replace(/\$/g, '').trim();
      var match = str.match(/[\d.]+/);
      if (match) {
        var p = parseFloat(match[0]);
        if (Number.isFinite(p) && p >= 0) return p;
      }
    }
    return 0;
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
    if (Array.isArray(doc.services)         && doc.services.length)         return doc.services[0];
    if (Array.isArray(doc.selectedServices) && doc.selectedServices.length) return doc.selectedServices[0];
    return doc.serviceType || doc.service || '';
  }

  function fmtCurrency(n) {
    if (!n && n !== 0) return '—';
    return '$' + Number(n).toFixed(2);
  }

  function fmtPct(n) {
    if (!Number.isFinite(n)) return '—';
    return Math.round(n * 100) + '%';
  }

  // ── Firestore helpers ─────────────────────────────────────────────────────────

  function vendorDoc() {
    return state.db.collection('vendors').doc(state.vendorId);
  }

  // ── computeSuggestions ────────────────────────────────────────────────────────
  // Loads bookings + services + serviceMaterials + inventory, then derives
  // demand and pricing suggestions for each active service.

  function computeSuggestions() {
    if (!state.vendorId || !state.db) {
      return Promise.reject(new Error(_T('ps_err_not_init')));
    }

    var cutoff = new Date(Date.now() - DAYS_60);
    var vRef   = vendorDoc();

    // 1. Bookings — last 60 days, limit 300
    var pBookings = vRef.collection('bookings')
      .where('createdAt', '>=', cutoff)
      .orderBy('createdAt', 'desc')
      .limit(300)
      .get()
      .then(function (snap) {
        return snap.docs.map(function (d) { return d.data(); });
      })
      .catch(function () {
        return vRef.collection('bookings').limit(300).get()
          .then(function (snap) {
            var now = Date.now();
            return snap.docs
              .map(function (d) { return d.data(); })
              .filter(function (d) { return (now - tsMillis(d.createdAt)) <= DAYS_60; });
          })
          .catch(function () { return []; });
      });

    // 2. Active services
    var pServices = vRef.collection('services')
      .where('active', '==', true)
      .get()
      .then(function (snap) {
        return snap.docs.map(function (d) {
          return Object.assign({ id: d.id }, d.data());
        });
      })
      .catch(function () { return []; });

    // 3. Service materials (cost per service)
    var pMaterials = vRef.collection('serviceMaterials')
      .get()
      .then(function (snap) {
        var map = {};
        snap.docs.forEach(function (d) {
          map[d.id] = d.data();
        });
        return map;
      })
      .catch(function () { return {}; });

    // 4. Inventory (costPerUnit per product)
    var pInventory = vRef.collection('inventory')
      .get()
      .then(function (snap) {
        var map = {};
        snap.docs.forEach(function (d) {
          map[d.id] = d.data();
        });
        return map;
      })
      .catch(function () { return {}; });

    return Promise.all([pBookings, pServices, pMaterials, pInventory])
      .then(function (results) {
        var bookings  = results[0];
        var services  = results[1];
        var materials = results[2];
        var inventory = results[3];

        // ── Step 1: Count bookings per service name ──
        var bookingCount = {};
        bookings.forEach(function (b) {
          var svc = serviceLabel(b);
          // Also try multi-service arrays
          var names = [];
          if (Array.isArray(b.services)         && b.services.length)         names = b.services;
          else if (Array.isArray(b.selectedServices) && b.selectedServices.length) names = b.selectedServices;
          else if (svc) names = [svc];

          names.forEach(function (n) {
            if (n) bookingCount[n] = (bookingCount[n] || 0) + 1;
          });
        });

        // ── Step 2: Compute material cost per service ──
        // materials doc structure: { items: [{inventoryId, qty}], totalCost? }
        function computeMaterialCost(serviceId) {
          var mat = materials[serviceId];
          if (!mat) return 0;
          // If totalCost is already stored, use it
          if (mat.totalCost !== undefined && mat.totalCost !== null) {
            var tc = asNumber(mat.totalCost, -1);
            if (tc >= 0) return tc;
          }
          // Otherwise sum up items
          var total = 0;
          var items = mat.items || mat.materials || [];
          if (!Array.isArray(items)) return 0;
          items.forEach(function (item) {
            var invId = item.inventoryId || item.id || item.productId;
            var qty   = asNumber(item.qty || item.quantity, 1);
            var inv   = inventory[invId];
            if (inv) {
              var cpu = asNumber(inv.costPerUnit || inv.cost || 0, 0);
              total += cpu * qty;
            } else {
              // If the item itself has a cost field
              var itemCost = asNumber(item.cost || item.unitCost, 0);
              total += itemCost * qty;
            }
          });
          return total;
        }

        // ── Step 3: Build suggestion per service ──
        var suggestions = services.map(function (svc) {
          var name         = svc.name || svc.serviceName || svc.id || _T('ps_no_name');
          var currentPrice = parsePrice(svc);
          var materialCost = computeMaterialCost(svc.id);

          // Booking count — try exact name match, then partial
          var count = bookingCount[name] || 0;
          if (!count) {
            // Partial match: find any booking key that contains/is-contained-by this name
            Object.keys(bookingCount).forEach(function (k) {
              var kLower = k.toLowerCase();
              var nLower = name.toLowerCase();
              if (kLower.indexOf(nLower) !== -1 || nLower.indexOf(kLower) !== -1) {
                count += bookingCount[k];
              }
            });
          }

          // Demand tier
          var demand;
          if (count >= HIGH_DEMAND_MIN)        demand = 'high';
          else if (count >= MEDIUM_DEMAND_MIN) demand = 'medium';
          else if (count >= 1)                  demand = 'low';
          else                                  demand = 'none';

          // Margin
          var marginPct = (currentPrice > 0)
            ? (currentPrice - materialCost) / currentPrice
            : null;

          // ── Suggestion logic ──
          var suggestion    = 'ok';
          var suggestedPrice = null;
          var reasoning     = '';

          if (count === 0) {
            // 0 bookings in 60 days — needs promotion or price drop
            suggestion = 'promote';
            if (currentPrice > 0 && materialCost > 0) {
              // Suggest small price drop to attract interest
              suggestedPrice = Math.max(materialCost * 2.5, currentPrice * 0.9);
              suggestedPrice = Math.round(suggestedPrice);
              reasoning = _T('ps_reason_no_bookings_drop');
            } else {
              reasoning = _T('ps_reason_no_bookings_promote');
            }
          } else if (demand === 'high' && marginPct !== null && marginPct < MARGIN_THRESHOLD_LOW) {
            // High demand but margin below 40% → raise price
            suggestion = 'raise_price';
            if (currentPrice > 0 && materialCost > 0) {
              // Target ~50% margin: price = cost / (1 - 0.50) = cost × 2
              suggestedPrice = Math.ceil(materialCost / 0.50);
              // But also ensure at least a 10% bump from current
              suggestedPrice = Math.max(suggestedPrice, Math.ceil(currentPrice * 1.10));
              reasoning = _T('ps_reason_high_low_margin')
                .replace('{count}', count)
                .replace('{pct}', fmtPct(marginPct));
            } else {
              reasoning = _T('ps_reason_high_low_margin_simple').replace('{count}', count);
            }
          } else if (materialCost > 0 && currentPrice > 0 && currentPrice < materialCost * COST_MULTIPLE_FLOOR) {
            // Price below 3× cost floor → likely underpriced
            suggestion = 'raise_price';
            suggestedPrice = Math.ceil(materialCost * COST_MULTIPLE_FLOOR);
            reasoning = _T('ps_reason_below_floor')
              .replace('{price}', fmtCurrency(currentPrice))
              .replace('{mult}', COST_MULTIPLE_FLOOR)
              .replace('{cost}', fmtCurrency(materialCost));
          } else {
            // Default: ok
            suggestion = 'ok';
            if (demand === 'high') {
              reasoning = _T('ps_reason_ok_high');
            } else if (demand === 'medium') {
              reasoning = _T('ps_reason_ok_med');
            } else {
              reasoning = _T('ps_reason_ok_low');
            }
          }

          return {
            serviceId:     svc.id,
            serviceName:   name,
            currentPrice:  currentPrice,
            materialCost:  materialCost,
            marginPct:     marginPct,
            bookingCount60d: count,
            demand:        demand,
            suggestion:    suggestion,
            suggestedPrice: suggestedPrice,
            reasoning:     reasoning
          };
        });

        // Sort: promote first, then raise_price, then lower_price, then ok
        var ORDER = { promote: 0, raise_price: 1, lower_price: 2, ok: 3 };
        suggestions.sort(function (a, b) {
          var oa = ORDER[a.suggestion] !== undefined ? ORDER[a.suggestion] : 99;
          var ob = ORDER[b.suggestion] !== undefined ? ORDER[b.suggestion] : 99;
          if (oa !== ob) return oa - ob;
          return b.bookingCount60d - a.bookingCount60d;
        });

        state.suggestions = suggestions;
        return suggestions;
      });
  }

  // ── Styles ────────────────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('psStyles')) return;
    var s = document.createElement('style');
    s.id = 'psStyles';
    s.textContent =
      '.ps-wrap{display:flex;flex-direction:column;gap:1.25rem}' +
      '.ps-toolbar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.6rem;margin-bottom:.25rem}' +
      '.ps-title{font-family:var(--font-d);font-size:1.5rem;color:var(--cream)}' +
      '.ps-subtitle{font-size:.72rem;color:var(--muted);margin-top:.15rem}' +
      '.ps-loading{text-align:center;padding:2.5rem 1rem;color:var(--muted);font-size:.85rem}' +
      '.ps-error{background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.25);' +
        'border-radius:8px;padding:.75rem 1rem;font-size:.78rem;color:var(--danger)}' +
      // Table wrapper
      '.ps-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}' +
      '.ps-table{width:100%;border-collapse:collapse;font-size:.77rem;min-width:560px}' +
      '.ps-table th{text-align:left;font-size:.58rem;font-weight:700;color:var(--muted);' +
        'text-transform:uppercase;letter-spacing:.05em;padding:.28rem .5rem .28rem 0;' +
        'border-bottom:1px solid var(--border);white-space:nowrap}' +
      '.ps-table th:not(:first-child){text-align:right}' +
      '.ps-table td{padding:.5rem .5rem .5rem 0;border-bottom:1px solid rgba(255,255,255,.04);' +
        'color:var(--text);vertical-align:middle}' +
      '.ps-table td:not(:first-child):not(:last-child){text-align:right}' +
      '.ps-table tbody tr:last-child td{border-bottom:none}' +
      // Service name cell
      '.ps-svc-name{font-weight:600;color:var(--cream);line-height:1.35}' +
      '.ps-reasoning{font-size:.64rem;color:var(--muted);margin-top:.18rem;font-style:italic;line-height:1.4;max-width:220px}' +
      // Demand badge
      '.ps-demand{display:inline-flex;align-items:center;font-size:.62rem;font-weight:700;' +
        'padding:1px 6px;border-radius:3px;letter-spacing:.03em;white-space:nowrap}' +
      '.ps-demand--high{background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);color:#4ade80}' +
      '.ps-demand--medium{background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.3);color:#fbbf24}' +
      '.ps-demand--low{background:rgba(148,163,184,.08);border:1px solid rgba(148,163,184,.2);color:var(--muted)}' +
      '.ps-demand--none{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.22);color:#f87171}' +
      // Suggestion badge
      '.ps-sug{display:inline-flex;align-items:center;font-size:.62rem;font-weight:700;' +
        'padding:2px 7px;border-radius:4px;letter-spacing:.03em;white-space:nowrap}' +
      '.ps-sug--raise_price{background:rgba(251,146,60,.12);border:1px solid rgba(251,146,60,.32);color:#fb923c}' +
      '.ps-sug--lower_price{background:rgba(96,165,250,.1);border:1px solid rgba(96,165,250,.3);color:#60a5fa}' +
      '.ps-sug--promote{background:rgba(167,139,250,.1);border:1px solid rgba(167,139,250,.3);color:#a78bfa}' +
      '.ps-sug--ok{background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.25);color:#4ade80}' +
      // Inline price edit
      '.ps-edit-row{display:inline-flex;align-items:center;gap:.35rem;margin-top:.25rem}' +
      '.ps-price-input{width:72px;background:var(--navy-900);border:1px solid var(--border);' +
        'border-radius:5px;color:var(--cream);font-family:var(--font-b);font-size:.78rem;' +
        'padding:.28rem .4rem;text-align:right}' +
      '.ps-price-input:focus{outline:none;border-color:var(--gold)}' +
      '.ps-save-btn{font-family:var(--font-b);font-size:.68rem;font-weight:700;' +
        'padding:.28rem .6rem;border-radius:5px;background:rgba(245,166,35,.12);' +
        'border:1px solid rgba(245,166,35,.38);color:var(--gold-lt);cursor:pointer;' +
        'white-space:nowrap;transition:opacity .15s}' +
      '.ps-save-btn:hover{opacity:.8}' +
      '.ps-save-btn:disabled{opacity:.45;cursor:default}' +
      '.ps-cancel-btn{font-family:var(--font-b);font-size:.68rem;font-weight:700;' +
        'padding:.28rem .55rem;border-radius:5px;background:transparent;' +
        'border:1px solid var(--border);color:var(--muted);cursor:pointer;transition:opacity .15s}' +
      '.ps-cancel-btn:hover{opacity:.8}' +
      '.ps-edit-btn{font-family:var(--font-b);font-size:.68rem;font-weight:700;' +
        'padding:.28rem .6rem;border-radius:5px;background:transparent;' +
        'border:1px solid var(--border);color:var(--muted);cursor:pointer;white-space:nowrap;' +
        'transition:border-color .15s,color .15s}' +
      '.ps-edit-btn:hover{border-color:rgba(255,255,255,.25);color:var(--text)}' +
      '.ps-saved-msg{font-size:.65rem;color:var(--success);font-weight:600}' +
      // Disclaimer note
      '.ps-note{font-size:.66rem;color:var(--muted);margin-top:.65rem;' +
        'padding:.45rem .65rem;background:rgba(255,255,255,.03);' +
        'border-left:2px solid var(--border-g);border-radius:0 4px 4px 0;' +
        'font-style:italic;line-height:1.5}' +
      '.ps-empty{text-align:center;padding:2rem 1rem;color:var(--muted);font-size:.82rem}' +
      '@media(max-width:599px){.ps-table{font-size:.72rem;min-width:420px}.ps-reasoning{display:none}}';
    document.head.appendChild(s);
  }

  // ── Render helpers ────────────────────────────────────────────────────────────

  function demandLabel(d) {
    return _T('ps_demand_' + d);
  }

  function suggestionLabel(s) {
    if (s === 'raise_price') return _T('ps_sugg_raise');
    if (s === 'lower_price') return _T('ps_sugg_lower');
    if (s === 'promote')     return _T('ps_sugg_promote');
    return _T('ps_sugg_ok');
  }

  function demandBadge(demand) {
    return '<span class="ps-demand ps-demand--' + esc(demand) + '">' +
      esc(demandLabel(demand)) + '</span>';
  }

  function suggestionBadge(suggestion) {
    return '<span class="ps-sug ps-sug--' + esc(suggestion) + '">' +
      esc(suggestionLabel(suggestion)) + '</span>';
  }

  // openEditRow: show inline price edit for a row
  function openEditRow(serviceId, currentPrice, suggestedPrice) {
    var editZone = document.getElementById('ps-edit-zone-' + serviceId);
    if (!editZone) return;
    var initVal = suggestedPrice !== null ? suggestedPrice : currentPrice;
    editZone.innerHTML =
      '<div class="ps-edit-row">' +
        '<span style="font-size:.65rem;color:var(--muted)">$</span>' +
        '<input id="ps-inp-' + esc(serviceId) + '" class="ps-price-input" type="number" min="0" step="1" value="' + esc(initVal || '') + '">' +
        '<button class="ps-save-btn" onclick="window._psSave(' + "'" + esc(serviceId) + "'" + ')">' + esc(_T('ps_btn_save')) + '</button>' +
        '<button class="ps-cancel-btn" onclick="window._psCancel(' + "'" + esc(serviceId) + "'" + ')">' + esc(_T('ps_btn_cancel')) + '</button>' +
      '</div>';
  }

  // _psSave: save price update to Firestore
  window._psSave = function (serviceId) {
    if (!state.vendorId || !state.db) return;
    var inp = document.getElementById('ps-inp-' + serviceId);
    if (!inp) return;
    var newPrice = parseFloat(inp.value);
    if (!Number.isFinite(newPrice) || newPrice < 0) {
      inp.style.borderColor = '#f87171';
      inp.focus();
      return;
    }
    inp.style.borderColor = '';
    var saveBtn = inp.parentElement.querySelector('.ps-save-btn');
    if (saveBtn) saveBtn.disabled = true;

    state.db.collection('vendors').doc(state.vendorId)
      .collection('services').doc(serviceId)
      .update({ priceFrom: newPrice })
      .then(function () {
        var editZone = document.getElementById('ps-edit-zone-' + serviceId);
        if (editZone) {
          editZone.innerHTML =
            '<span class="ps-saved-msg">' + esc(_T('ps_msg_saved').replace('{price}', newPrice.toFixed(2))) + '</span>';
        }
        // Update local state so the price cell reflects the change
        state.suggestions.forEach(function (s) {
          if (s.serviceId === serviceId) s.currentPrice = newPrice;
        });
        // Update price cell in table
        var priceCell = document.getElementById('ps-price-' + serviceId);
        if (priceCell) priceCell.textContent = '$' + newPrice.toFixed(2);
      })
      .catch(function (err) {
        var editZone = document.getElementById('ps-edit-zone-' + serviceId);
        if (editZone) {
          editZone.innerHTML =
            '<span style="color:#f87171;font-size:.65rem">' + esc(_T('ps_msg_save_failed')) + '</span>' +
            '<button class="ps-edit-btn" onclick="window._psOpenEdit(' +
              "'" + esc(serviceId) + "', " + newPrice + ', null' +
            ')">' + esc(_T('ps_btn_edit_again')) + '</button>';
        }
        console.warn('[pricing-suggestions] save failed:', err && err.message ? err.message : err);
      });
  };

  // _psCancel: restore the "Update Price" button
  window._psCancel = function (serviceId) {
    var found = null;
    state.suggestions.forEach(function (s) {
      if (s.serviceId === serviceId) found = s;
    });
    if (!found) return;
    var editZone = document.getElementById('ps-edit-zone-' + serviceId);
    if (editZone) {
      editZone.innerHTML = renderEditButton(found);
    }
  };

  // _psOpenEdit: open edit zone (called from inline onclick)
  window._psOpenEdit = function (serviceId, currentPrice, suggestedPrice) {
    openEditRow(serviceId, currentPrice, suggestedPrice);
  };

  function renderEditButton(row) {
    return '<button class="ps-edit-btn" onclick="window._psOpenEdit(' +
        "'" + esc(row.serviceId) + "'," +
        row.currentPrice + ',' +
        (row.suggestedPrice !== null ? row.suggestedPrice : 'null') +
      ')">' + esc(_T('ps_btn_update_price')) + '</button>';
  }

  // ── render ────────────────────────────────────────────────────────────────────

  function render() {
    var el = state.containerEl;
    if (!el) return;

    injectStyles();

    if (state.loading) {
      el.innerHTML =
        '<div class="ps-wrap">' +
          '<div class="ps-loading">⏳ ' + esc(_T('ps_loading')) + '</div>' +
        '</div>';
      return;
    }

    if (state.error) {
      el.innerHTML =
        '<div class="ps-wrap">' +
          '<div class="ps-error">✕ ' + esc(state.error) + '</div>' +
          '<div style="margin-top:.75rem">' +
            '<button class="btn btn--outline btn--sm" onclick="window.SalonPricingSuggestions.refresh()">' + esc(_T('btn_refresh')) + '</button>' +
          '</div>' +
        '</div>';
      return;
    }

    var rows = state.suggestions;

    var tableRows = '';
    if (!rows.length) {
      tableRows = '<tr><td colspan="7"><div class="ps-empty">' + esc(_T('ps_empty')) + '</div></td></tr>';
    } else {
      rows.forEach(function (row) {
        tableRows +=
          '<tr>' +
            // Service
            '<td style="min-width:160px">' +
              '<div class="ps-svc-name">' + esc(row.serviceName) + '</div>' +
              '<div class="ps-reasoning">' + esc(row.reasoning) + '</div>' +
            '</td>' +
            // Current price
            '<td><span id="ps-price-' + esc(row.serviceId) + '">' +
              (row.currentPrice > 0 ? '$' + row.currentPrice.toFixed(2) : '—') +
            '</span></td>' +
            // Material cost
            '<td>' + (row.materialCost > 0 ? '$' + row.materialCost.toFixed(2) : '—') + '</td>' +
            // Margin %
            '<td>' +
              (row.marginPct !== null && Number.isFinite(row.marginPct)
                ? '<span style="color:' + (row.marginPct < 0.40 ? '#fb923c' : '#4ade80') + '">' +
                    Math.round(row.marginPct * 100) + '%' +
                  '</span>'
                : '—') +
            '</td>' +
            // Bookings 60d
            '<td>' +
              '<span style="font-weight:700;color:' +
                (row.bookingCount60d === 0 ? '#f87171' : row.bookingCount60d >= HIGH_DEMAND_MIN ? '#4ade80' : 'var(--text)') +
              '">' + row.bookingCount60d + '</span>' +
              ' ' + demandBadge(row.demand) +
            '</td>' +
            // Suggestion (badge)
            '<td>' + suggestionBadge(row.suggestion) + '</td>' +
            // Update price (action)
            '<td>' +
              '<div id="ps-edit-zone-' + esc(row.serviceId) + '">' +
                renderEditButton(row) +
              '</div>' +
            '</td>' +
          '</tr>';
      });
    }

    el.innerHTML =
      '<div class="ps-wrap">' +

        // ── Toolbar ──
        '<div class="ps-toolbar">' +
          '<div>' +
            '<div class="ps-title">' + esc(_T('ps_title')) + '</div>' +
            '<div class="ps-subtitle">' + esc(_T('ps_subtitle')) + '</div>' +
          '</div>' +
          '<button class="btn btn--outline btn--sm" onclick="window.SalonPricingSuggestions.refresh()" style="flex-shrink:0">↻ ' + esc(_T('btn_refresh')) + '</button>' +
        '</div>' +

        // ── Table ──
        '<div class="ps-table-wrap">' +
          '<table class="ps-table">' +
          '<thead><tr>' +
            '<th>' + esc(_T('ps_col_service')) + '</th>' +
            '<th>' + esc(_T('ps_col_price_now')) + '</th>' +
            '<th>' + esc(_T('ps_col_mat_cost')) + '</th>' +
            '<th>' + esc(_T('ps_col_margin')) + '</th>' +
            '<th>' + esc(_T('ps_col_bookings_60d')) + '</th>' +
            '<th>' + esc(_T('ps_col_suggestion')) + '</th>' +
            '<th></th>' +
          '</tr></thead>' +
          '<tbody>' + tableRows + '</tbody>' +
          '</table>' +
        '</div>' +

        // ── Disclaimer ──
        '<div class="ps-note">' + _T('ps_disclaimer') + '</div>' +

      '</div>';
  }

  // ── Public API ─────────────────────────────────────────────────────────────────

  function init(vendorId, containerEl) {
    if (!vendorId || !containerEl) {
      console.warn('[pricing-suggestions] init requires vendorId and containerEl');
      return;
    }
    if (!window.firebase || !window.firebase.firestore) {
      console.warn('[pricing-suggestions] Firebase not available');
      return;
    }
    state.vendorId    = vendorId;
    state.containerEl = containerEl;
    state.db          = firebase.firestore();
    state.loading     = false;
    state.error       = '';
    state.suggestions = [];

    refresh();
  }

  function refresh() {
    state.loading = true;
    state.error   = '';
    render();

    computeSuggestions()
      .then(function () {
        state.loading = false;
        render();
      })
      .catch(function (err) {
        state.loading = false;
        state.error   = (err && err.message) ? err.message : _T('ps_err_load_failed');
        render();
      });
  }

  window.SalonPricingSuggestions = {
    init:              init,
    computeSuggestions: computeSuggestions,
    render:            render,
    refresh:           refresh
  };

}());
