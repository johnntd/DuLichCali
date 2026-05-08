(function () {
  'use strict';

  function _T(key) {
    return (window.SalonI18n && window.SalonI18n.t) ? window.SalonI18n.t(key) : key;
  }

  // ── SalonNailDesignAssistant ─────────────────────────────────────────────────
  // Phase 8: AI Nail Design Assistant — READ-ONLY analytics + design matching.
  // Customer-facing: _detectDesignRequest helper (in receptionist.js) enriches
  //   AI context when a design request is detected in the chat flow.
  // Vendor-facing: admin panel showing last 30 design requests with matched services.
  //
  // Rules:
  //   - NO auto-deduction of materials from design requests
  //   - NO hardcoded vendor IDs
  //   - matchDesignToServices is a pure function (no network calls)
  //   - saveDesignRequest is additive only — does NOT modify booking status

  // ── Keyword → service mapping ─────────────────────────────────────────────────
  // Maps lowercase keyword fragments to canonical service names.
  // Longest / most-specific entries should come first so the match order is
  // deterministic when multiple rules would match the same text.
  var DESIGN_KEYWORD_MAP = [
    { keywords: ['nail art', 'nail design', 'design', 'nail designs'],     service: 'Nail Art' },
    { keywords: ['3d nail', '3-d nail', '3d art'],                          service: '3D Nail Art' },
    { keywords: ['ombre', 'gradient', 'fade nails'],                        service: 'Ombre Nails' },
    { keywords: ['chrome', 'mirror nail', 'mirror powder'],                 service: 'Chrome Powder' },
    { keywords: ['acrylic', 'acrylics', 'full set'],                        service: 'Acrylic Full Set' },
    { keywords: ['french tip', 'french manicure', 'french nail', 'french'], service: 'French Manicure' },
    { keywords: ['gel', 'gel nails', 'gel color', 'gel polish'],            service: 'Gel Manicure' },
    { keywords: ['glitter', 'sparkle', 'shimmer'],                          service: 'Nail Art' },
    { keywords: ['pedicure', 'pedi', 'foot nails', 'toe nails'],            service: 'Pedicure' },
    { keywords: ['manicure', 'mani'],                                       service: 'Manicure' },
    // Vietnamese keywords
    { keywords: ['mẫu móng', 'mau mong', 'thiết kế móng', 'thiet ke mong', 'nail đẹp', 'nail dep'],
                                                                             service: 'Nail Art' },
    { keywords: ['nhũ', 'bột nhũ', 'chrome', 'kim loại'],                  service: 'Chrome Powder' },
    { keywords: ['ombre móng', 'ombre mong', 'gradient móng'],              service: 'Ombre Nails' },
    { keywords: ['móng giả', 'mong gia', 'đắp móng', 'dap mong'],          service: 'Acrylic Full Set' },
    { keywords: ['gel móng', 'gel mong', 'sơn gel', 'son gel'],             service: 'Gel Manicure' },
    { keywords: ['pháp', 'phap', 'móng pháp', 'mong phap'],                service: 'French Manicure' },
    { keywords: ['chân', 'chan', 'làm chân', 'lam chan', 'móng chân', 'mong chan'],
                                                                             service: 'Pedicure' },
    { keywords: ['làm tay', 'lam tay', 'móng tay', 'mong tay'],            service: 'Manicure' },
    // Spanish keywords
    { keywords: ['diseño de uñas', 'diseño de unas', 'arte de uñas', 'arte de unas'],
                                                                             service: 'Nail Art' },
    { keywords: ['uñas acrílicas', 'unas acrilicas', 'acrílicas', 'acrilicas'],
                                                                             service: 'Acrylic Full Set' },
    { keywords: ['uñas de gel', 'unas de gel', 'gel uñas', 'gel unas'],     service: 'Gel Manicure' },
    { keywords: ['francés', 'frances', 'uñas francesas', 'unas francesas'], service: 'French Manicure' },
    { keywords: ['pedicura', 'pedicure', 'uñas del pie', 'unas del pie'],   service: 'Pedicure' },
    { keywords: ['manicura', 'manicure'],                                   service: 'Manicure' }
  ];

  // Detection keywords — if any of these appear in a message, it is likely a design request
  var DESIGN_TRIGGER_KEYWORDS = [
    // English
    'nail design', 'nail art', 'nail idea', 'nail inspo', 'nail inspiration',
    'nail style', 'nail look', 'nail color', 'ombre', 'glitter nail', 'chrome nail',
    'acrylic', 'gel nail', 'french tip', '3d nail', 'nail design',
    // Vietnamese
    'mẫu móng', 'mau mong', 'thiết kế móng', 'thiet ke mong', 'nail đẹp', 'nail dep',
    'móng đẹp', 'mong dep', 'kiểu móng', 'kieu mong', 'mẫu nail', 'mau nail',
    'ombre móng', 'nhũ móng', 'đắp móng',
    // Spanish
    'diseño de uñas', 'diseño de unas', 'arte de uñas', 'arte de unas',
    'uñas bonitas', 'unas bonitas', 'uñas decoradas', 'unas decoradas',
    'uñas acrílicas', 'unas acrilicas', 'uñas de gel', 'pedicura'
  ];

  // ── State ─────────────────────────────────────────────────────────────────────
  var state = {
    vendorId:   '',
    containerEl: null,
    db:          null,
    loading:     false,
    error:       '',
    requests:    []
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

  function tsMillis(ts) {
    if (!ts) return 0;
    if (ts && typeof ts.toMillis === 'function') return ts.toMillis();
    if (ts && typeof ts.seconds === 'number')    return ts.seconds * 1000;
    var n = Number(ts);
    if (Number.isFinite(n) && n > 1e9) return n;
    var parsed = Date.parse(ts);
    return isNaN(parsed) ? 0 : parsed;
  }

  function fmtDate(ts) {
    var ms = tsMillis(ts);
    if (!ms) return '—';
    var d = new Date(ms);
    var lang = (window.SalonI18n && window.SalonI18n.getLang) ? window.SalonI18n.getLang() : 'vi';
    var locale = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-US' : 'vi-VN';
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function maskPhone(phone) {
    var s = String(phone || '');
    if (s.length < 4) return s || '—';
    return s.slice(0, 3) + '-****-' + s.slice(-2);
  }

  // ── Pure: matchDesignToServices ───────────────────────────────────────────────
  // Given a freeform design description and an array of service objects (each with
  // a `name` field), returns the top 2–3 matching service names.
  // Falls back to DESIGN_KEYWORD_MAP canonical names when no vendor services provided.
  function matchDesignToServices(designText, availableServices) {
    if (!designText) return [];
    var text = String(designText).toLowerCase();

    var matched = [];
    var seen    = {};

    DESIGN_KEYWORD_MAP.forEach(function (rule) {
      if (matched.length >= 3) return;
      var hit = rule.keywords.some(function (kw) {
        return text.indexOf(kw) !== -1;
      });
      if (!hit) return;

      // Try to find the service name in the vendor's catalog first
      var resolved = rule.service;
      if (Array.isArray(availableServices) && availableServices.length) {
        var lower = rule.service.toLowerCase();
        var found = availableServices.find(function (svc) {
          return svc && svc.name && String(svc.name).toLowerCase().indexOf(lower) !== -1;
        });
        if (found) resolved = found.name;
      }

      if (!seen[resolved]) {
        seen[resolved] = true;
        matched.push(resolved);
      }
    });

    return matched;
  }

  // ── Pure: formatDesignContext ─────────────────────────────────────────────────
  // Returns a [SYSTEM: ...] context string to inject into the AI receptionist.
  function formatDesignContext(designText, matchedServices) {
    var svcs = Array.isArray(matchedServices) && matchedServices.length
      ? matchedServices.join(', ')
      : 'general nail services';
    return '[SYSTEM: Customer appears to be describing a nail design request: "' +
      String(designText || '').replace(/"/g, "'") +
      '". Suggested services based on description: ' + svcs +
      '. Mention the matched services naturally and ask if they would like to book one of them. Do not skip the normal booking flow.]';
  }

  // ── Firestore: loadDesignRequests ─────────────────────────────────────────────
  // Loads last 30 bookings that have a `designRequest` field.
  function loadDesignRequests() {
    if (!state.vendorId || !state.db) {
      return Promise.reject(new Error('SalonNailDesignAssistant not initialized'));
    }

    return state.db
      .collection('vendors').doc(state.vendorId)
      .collection('bookings')
      .orderBy('createdAt', 'desc')
      .limit(150)   // fetch more, filter client-side (Firestore lacks != null filter on all SDK versions)
      .get()
      .then(function (snap) {
        var results = [];
        snap.docs.forEach(function (d) {
          var data = d.data();
          if (data.designRequest) {
            results.push(Object.assign({ _id: d.id }, data));
          }
          if (results.length >= 30) return;
        });
        return results.slice(0, 30);
      })
      .catch(function () {
        // Fallback: no orderBy (index may not exist yet)
        return state.db
          .collection('vendors').doc(state.vendorId)
          .collection('bookings')
          .limit(150)
          .get()
          .then(function (snap) {
            var results = [];
            snap.docs.forEach(function (d) {
              var data = d.data();
              if (data.designRequest) {
                results.push(Object.assign({ _id: d.id }, data));
              }
            });
            // Sort by createdAt desc client-side
            results.sort(function (a, b) { return tsMillis(b.createdAt) - tsMillis(a.createdAt); });
            return results.slice(0, 30);
          })
          .catch(function () { return []; });
      });
  }

  // ── Firestore: saveDesignRequest ──────────────────────────────────────────────
  // Additively updates a booking doc with design analysis fields.
  // Does NOT change booking status or trigger any deductions.
  function saveDesignRequest(vendorId, bookingId, designRequest, suggestedServices) {
    var db = window.dlcDb || (window.firebase && window.firebase.firestore && window.firebase.firestore());
    if (!db || !vendorId || !bookingId) {
      console.warn('[nail-design-assistant] saveDesignRequest: missing db or IDs');
      return Promise.resolve();
    }
    var fv = window.firebase && window.firebase.firestore
      ? window.firebase.firestore.FieldValue
      : null;
    var update = {
      designRequest:       String(designRequest || ''),
      suggestedServices:   Array.isArray(suggestedServices) ? suggestedServices : [],
      designAnalyzedAt:    fv ? fv.serverTimestamp() : new Date().toISOString()
    };
    return db.collection('vendors').doc(vendorId)
      .collection('bookings').doc(bookingId)
      .update(update)
      .catch(function (e) {
        console.warn('[nail-design-assistant] saveDesignRequest failed:', e && e.message ? e.message : e);
      });
  }

  // ── Styles ────────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('ndaStyles')) return;
    var s = document.createElement('style');
    s.id = 'ndaStyles';
    s.textContent =
      '.nda-wrap{display:flex;flex-direction:column;gap:1.25rem}' +
      '.nda-toolbar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.6rem;margin-bottom:.25rem}' +
      '.nda-title{font-family:var(--font-d);font-size:1.5rem;color:var(--cream)}' +
      '.nda-subtitle{font-size:.72rem;color:var(--muted);margin-top:.15rem}' +
      '.nda-loading{text-align:center;padding:2.5rem 1rem;color:var(--muted);font-size:.85rem}' +
      '.nda-error{background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.25);' +
        'border-radius:8px;padding:.75rem 1rem;font-size:.78rem;color:var(--danger)}' +
      '.nda-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}' +
      '.nda-table{width:100%;border-collapse:collapse;font-size:.77rem;min-width:480px}' +
      '.nda-table th{text-align:left;font-size:.58rem;font-weight:700;color:var(--muted);' +
        'text-transform:uppercase;letter-spacing:.05em;padding:.28rem .5rem .28rem 0;' +
        'border-bottom:1px solid var(--border);white-space:nowrap}' +
      '.nda-table td{padding:.5rem .5rem .5rem 0;border-bottom:1px solid rgba(255,255,255,.04);' +
        'color:var(--text);vertical-align:middle}' +
      '.nda-table tbody tr:last-child td{border-bottom:none}' +
      '.nda-design-text{font-size:.75rem;color:var(--cream);line-height:1.4;max-width:240px;' +
        'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
      '.nda-svc-pills{display:flex;flex-wrap:wrap;gap:.2rem;margin-top:.2rem}' +
      '.nda-svc-pill{display:inline-flex;align-items:center;font-size:.6rem;font-weight:700;' +
        'padding:1px 6px;border-radius:3px;letter-spacing:.03em;white-space:nowrap;' +
        'background:rgba(167,139,250,.1);border:1px solid rgba(167,139,250,.3);color:#a78bfa}' +
      '.nda-phone{font-size:.72rem;color:var(--muted);font-family:var(--font-mono)}' +
      '.nda-note{font-size:.66rem;color:var(--muted);margin-top:.65rem;' +
        'padding:.45rem .65rem;background:rgba(255,255,255,.03);' +
        'border-left:2px solid var(--border-g);border-radius:0 4px 4px 0;' +
        'font-style:italic;line-height:1.5}' +
      '.nda-empty{text-align:center;padding:2rem 1rem;color:var(--muted);font-size:.82rem}' +
      '@media(max-width:599px){.nda-table{font-size:.72rem;min-width:360px}.nda-design-text{-webkit-line-clamp:3}}';
    document.head.appendChild(s);
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  function render() {
    var el = state.containerEl;
    if (!el) return;

    injectStyles();

    if (state.loading) {
      el.innerHTML =
        '<div class="nda-wrap">' +
          '<div class="nda-loading">⏳ ' + esc(_T('nda_loading')) + '</div>' +
        '</div>';
      return;
    }

    if (state.error) {
      el.innerHTML =
        '<div class="nda-wrap">' +
          '<div class="nda-error">✕ ' + esc(state.error) + '</div>' +
          '<div style="margin-top:.75rem">' +
            '<button class="btn btn--outline btn--sm" onclick="window.SalonNailDesignAssistant.refresh()">' + esc(_T('btn_refresh')) + '</button>' +
          '</div>' +
        '</div>';
      return;
    }

    var rows = state.requests;
    var tableRows = '';

    if (!rows.length) {
      tableRows =
        '<tr><td colspan="4">' +
          '<div class="nda-empty">' + esc(_T('nda_empty')) + '</div>' +
        '</td></tr>';
    } else {
      rows.forEach(function (row) {
        var svcs = Array.isArray(row.suggestedServices) ? row.suggestedServices : [];
        var pillsHtml = svcs.length
          ? '<div class="nda-svc-pills">' +
              svcs.map(function (s) { return '<span class="nda-svc-pill">' + esc(s) + '</span>'; }).join('') +
            '</div>'
          : '<span style="color:var(--muted);font-size:.68rem">—</span>';

        tableRows +=
          '<tr>' +
            '<td>' + esc(fmtDate(row.createdAt)) + '</td>' +
            '<td class="nda-phone">' + esc(maskPhone(row.customerPhone || row.phone)) + '</td>' +
            '<td><div class="nda-design-text">' + esc(row.designRequest) + '</div></td>' +
            '<td>' + pillsHtml + '</td>' +
          '</tr>';
      });
    }

    el.innerHTML =
      '<div class="nda-wrap">' +

        '<div class="nda-toolbar">' +
          '<div>' +
            '<div class="nda-title">' + esc(_T('nda_title')) + '</div>' +
            '<div class="nda-subtitle">' + esc(_T('nda_subtitle')) + '</div>' +
          '</div>' +
          '<button class="btn btn--outline btn--sm" onclick="window.SalonNailDesignAssistant.refresh()" style="flex-shrink:0">↻ ' + esc(_T('btn_refresh')) + '</button>' +
        '</div>' +

        '<div class="nda-table-wrap">' +
          '<table class="nda-table">' +
          '<thead><tr>' +
            '<th>' + esc(_T('nda_col_date')) + '</th>' +
            '<th>' + esc(_T('nda_col_customer')) + '</th>' +
            '<th>' + esc(_T('nda_col_design')) + '</th>' +
            '<th>' + esc(_T('nda_col_services')) + '</th>' +
          '</tr></thead>' +
          '<tbody>' + tableRows + '</tbody>' +
          '</table>' +
        '</div>' +

        '<div class="nda-note">' + esc(_T('nda_note')) + '</div>' +

      '</div>';
  }

  // ── Public API ─────────────────────────────────────────────────────────────────

  function init(vendorId, containerEl) {
    if (!vendorId || !containerEl) {
      console.warn('[nail-design-assistant] init requires vendorId and containerEl');
      return;
    }
    if (!window.firebase || !window.firebase.firestore) {
      console.warn('[nail-design-assistant] Firebase not available');
      return;
    }
    state.vendorId    = vendorId;
    state.containerEl = containerEl;
    state.db          = firebase.firestore();
    state.loading     = false;
    state.error       = '';
    state.requests    = [];

    refresh();
  }

  function refresh() {
    state.loading = true;
    state.error   = '';
    render();

    loadDesignRequests()
      .then(function (results) {
        state.loading  = false;
        state.requests = results || [];
        render();
      })
      .catch(function (err) {
        state.loading = false;
        state.error   = (err && err.message) ? err.message : _T('nda_err_load_failed');
        render();
      });
  }

  window.SalonNailDesignAssistant = {
    init:                   init,
    refresh:                refresh,
    loadDesignRequests:     loadDesignRequests,
    matchDesignToServices:  matchDesignToServices,
    formatDesignContext:    formatDesignContext,
    saveDesignRequest:      saveDesignRequest,
    // Exposed for receptionist.js _detectDesignRequest helper
    DESIGN_TRIGGER_KEYWORDS: DESIGN_TRIGGER_KEYWORDS
  };

}());
