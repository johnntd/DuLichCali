(function () {
  'use strict';

  function _T(key) {
    return (window.SalonI18n && window.SalonI18n.t) ? window.SalonI18n.t(key) : key;
  }

  function DEDUCT_MODES() {
    return [
      { value: 'fixed',    label: _T('sm_mode_fixed') },
      { value: 'per_nail', label: _T('sm_mode_per_nail') },
      { value: 'manual',   label: _T('sm_mode_manual') }
    ];
  }

  var state = {
    vendorId: '',
    containerEl: null,
    db: null,
    mappings: [],          // docs from vendors/{id}/serviceMaterials (active==true)
    services: [],          // from services-data / Firestore vendor services
    inventory: [],         // from vendors/{id}/inventory (active==true)
    unsubscribe: null,
    editingServiceId: null,// serviceId whose inline editor is open, or null
    draftLines: [],        // in-memory material lines for the open editor
    loading: false,
    error: ''
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

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
    return Number.isFinite(n) ? n : fallback;
  }

  function selectHtml(id, options, selected) {
    return '<select class="sa-input sm-select" id="' + esc(id) + '">' +
      options.map(function (o) {
        return '<option value="' + esc(o.value) + '"' + (o.value === selected ? ' selected' : '') + '>' + esc(o.label) + '</option>';
      }).join('') +
    '</select>';
  }

  // ── Firestore refs ─────────────────────────────────────────────────────────

  function mappingsColRef() {
    return state.db.collection('vendors').doc(state.vendorId).collection('serviceMaterials');
  }

  function mappingDocRef(serviceId) {
    return mappingsColRef().doc(serviceId);
  }

  function inventoryColRef() {
    return state.db.collection('vendors').doc(state.vendorId).collection('inventory');
  }

  // ── Public API: loadMappings ───────────────────────────────────────────────

  function loadMappings() {
    if (!state.vendorId || !state.db) return Promise.reject(new Error(_T('sm_err_not_init')));
    state.loading = true;
    render();

    if (state.unsubscribe) {
      state.unsubscribe();
      state.unsubscribe = null;
    }

    return new Promise(function (resolve, reject) {
      state.unsubscribe = mappingsColRef()
        .where('active', '==', true)
        .onSnapshot(function (snap) {
          state.mappings = snap.docs.map(function (doc) {
            return Object.assign({ id: doc.id }, doc.data());
          });
          state.loading = false;
          state.error = '';
          render();
          resolve(state.mappings);
        }, function (err) {
          state.loading = false;
          state.error = err.message || _T('sm_err_load_failed');
          render();
          reject(err);
        });
    });
  }

  // ── Public API: loadServices ───────────────────────────────────────────────
  // Loads from Firestore vendor services sub-collection. Falls back to
  // window.SALON_SERVICES_DATA if present (services-data.js) keyed by vendorId.

  function loadServices() {
    if (!state.vendorId || !state.db) return Promise.reject(new Error(_T('sm_err_not_init')));

    return state.db.collection('vendors').doc(state.vendorId)
      .collection('services').where('active', '==', true)
      .get()
      .then(function (snap) {
        var rows = snap.docs.map(function (doc) {
          return Object.assign({ id: doc.id }, doc.data());
        });
        if (rows.length === 0 && window.SALON_SERVICES_DATA && window.SALON_SERVICES_DATA[state.vendorId]) {
          rows = window.SALON_SERVICES_DATA[state.vendorId].map(function (s) {
            return { id: s.id || s.serviceId, name: s.name || s.serviceName };
          });
        }
        state.services = rows;
        return rows;
      })
      .catch(function (err) {
        // Fallback to static data if Firestore access denied
        if (window.SALON_SERVICES_DATA && window.SALON_SERVICES_DATA[state.vendorId]) {
          state.services = window.SALON_SERVICES_DATA[state.vendorId].map(function (s) {
            return { id: s.id || s.serviceId, name: s.name || s.serviceName };
          });
        }
        return state.services;
      });
  }

  // ── Public API: loadInventory ──────────────────────────────────────────────

  function loadInventory() {
    if (!state.vendorId || !state.db) return Promise.reject(new Error(_T('sm_err_not_init')));
    return inventoryColRef()
      .where('active', '==', true)
      .orderBy('category')
      .orderBy('name')
      .get()
      .then(function (snap) {
        state.inventory = snap.docs.map(function (doc) {
          return Object.assign({ id: doc.id }, doc.data());
        });
        return state.inventory;
      })
      .catch(function () {
        state.inventory = [];
        return [];
      });
  }

  // ── Public API: saveMaterials ──────────────────────────────────────────────

  function saveMaterials(serviceId, serviceNameSnapshot, materialsArray) {
    if (!serviceId) return Promise.reject(new Error(_T('sm_err_missing_svc')));
    if (!state.vendorId || !state.db) return Promise.reject(new Error(_T('sm_err_not_init')));

    var now = firebase.firestore.FieldValue.serverTimestamp();
    var existing = state.mappings.find(function (m) { return m.id === serviceId; });

    var payload = {
      serviceId: serviceId,
      serviceNameSnapshot: String(serviceNameSnapshot || '').trim(),
      active: true,
      materials: (materialsArray || []).map(function (line) {
        return {
          productId:            String(line.productId || '').trim(),
          productNameSnapshot:  String(line.productNameSnapshot || '').trim(),
          qtyPerService:        asNumber(line.qtyPerService, 0),
          unit:                 String(line.unit || '').trim(),
          deductMode:           String(line.deductMode || 'fixed').trim(),
          required:             line.required !== false
        };
      }),
      updatedAt: now
    };
    if (!existing) payload.createdAt = now;
    return mappingDocRef(serviceId).set(payload, { merge: true });
  }

  // ── Public API: deleteMaterials ────────────────────────────────────────────

  function deleteMaterials(serviceId) {
    if (!serviceId) return Promise.reject(new Error(_T('sm_err_missing_svc')));
    return mappingDocRef(serviceId).update({
      active: false,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  // ── Public API: getMaterialsForService ────────────────────────────────────

  function getMaterialsForService(serviceId) {
    var doc = state.mappings.find(function (m) { return m.id === serviceId; });
    return doc ? (doc.materials || []) : [];
  }

  // ── Styles ─────────────────────────────────────────────────────────────────

  function renderStyles() {
    if (document.getElementById('smStyles')) return '';
    return '<style id="smStyles">' +
      '.sm-wrap{display:flex;flex-direction:column;gap:.9rem}' +
      '.sm-toolbar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.6rem}' +
      '.sm-summary{font-size:.72rem;color:var(--muted)}' +
      '.sm-row{border:1px solid var(--border);border-radius:8px;background:rgba(255,255,255,.02);overflow:hidden}' +
      '.sm-row__head{display:flex;align-items:center;justify-content:space-between;gap:.6rem;padding:.7rem .85rem;flex-wrap:wrap}' +
      '.sm-svc-name{font-weight:700;color:var(--cream);font-size:.88rem}' +
      '.sm-meta{font-size:.68rem;color:var(--muted)}' +
      '.sm-head-right{display:flex;align-items:center;gap:.45rem;flex-wrap:wrap}' +
      '.sm-editor{border-top:1px solid var(--border);padding:.8rem .85rem;display:flex;flex-direction:column;gap:.7rem;background:rgba(245,158,11,.045)}' +
      '.sm-line-list{display:flex;flex-direction:column;gap:.55rem}' +
      '.sm-line{display:grid;grid-template-columns:minmax(0,2fr) repeat(3,minmax(0,1fr)) auto auto;gap:.4rem;align-items:center}' +
      '.sm-line-num{font-size:.66rem;color:var(--muted);min-width:1.2rem;text-align:right}' +
      '.sm-select{font-size:.75rem;padding:.28rem .45rem;min-width:0}' +
      '.sm-qty-input{font-size:.75rem;padding:.28rem .45rem;min-width:0;width:100%}' +
      '.sm-line-del{width:26px;height:26px;border-radius:5px;border:1px solid var(--border);background:transparent;color:var(--danger);cursor:pointer;font-size:.85rem;flex-shrink:0}' +
      '.sm-line-req{display:flex;align-items:center;gap:.25rem;font-size:.66rem;color:var(--muted);white-space:nowrap}' +
      '.sm-add-line{font-size:.72rem;padding:.25rem .6rem}' +
      '.sm-editor-actions{display:flex;justify-content:flex-end;gap:.4rem;flex-wrap:wrap;padding-top:.4rem;border-top:1px solid var(--border)}' +
      '.sm-msg{font-size:.72rem;color:var(--danger)}' +
      '.sm-badge{font-size:.62rem;background:rgba(34,211,238,.15);color:var(--cyan);border-radius:99px;padding:.1rem .45rem;white-space:nowrap}' +
      '.sm-empty-row{font-size:.72rem;color:var(--muted);font-style:italic;padding:.4rem .2rem}' +
      '@media(max-width:600px){' +
        '.sm-line{grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto auto;grid-template-rows:auto auto}' +
        '.sm-line>:nth-child(1){grid-column:1/3}' +
        '.sm-line>:nth-child(2){grid-column:1/2}' +
        '.sm-line>:nth-child(3){grid-column:2/3}' +
        '.sm-line>:nth-child(4){grid-column:1/2}' +
        '.sm-line>:nth-child(5){grid-column:2/3}' +
        '.sm-line-del{margin-left:auto}' +
        '.sm-line-req{justify-content:flex-end}' +
      '}' +
    '</style>';
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  function inventorySelectOptions(selectedId) {
    var opts = '<option value="">' + esc(_T('sm_choose_product')) + '</option>';
    state.inventory.forEach(function (item) {
      opts += '<option value="' + esc(item.id) + '"' + (item.id === selectedId ? ' selected' : '') + '>' + esc(item.name) + (item.brand ? ' (' + esc(item.brand) + ')' : '') + '</option>';
    });
    return opts;
  }

  function renderEditorLine(line, idx) {
    var selectId = 'smProd_' + idx;
    var qtyId    = 'smQty_' + idx;
    var modeId   = 'smMode_' + idx;
    var reqId    = 'smReq_' + idx;

    var prodSelect = '<select class="sa-input sm-select" id="' + selectId + '">' + inventorySelectOptions(line.productId) + '</select>';
    var qtyInput   = '<input class="sa-input sm-qty-input" type="number" id="' + qtyId + '" step="0.01" min="0" value="' + esc(line.qtyPerService == null ? '' : line.qtyPerService) + '" placeholder="' + esc(_T('sm_qty_ph')) + '">';
    var modeSelect = selectHtml(modeId, DEDUCT_MODES(), line.deductMode || 'fixed');
    var reqCheck   = '<label class="sm-line-req"><input type="checkbox" id="' + reqId + '"' + (line.required !== false ? ' checked' : '') + '> ' + esc(_T('sm_required')) + '</label>';
    var delBtn     = '<button class="sm-line-del" type="button" data-sm-action="del-line" data-line-idx="' + idx + '" aria-label="' + esc(_T('sm_aria_del_line')) + '">×</button>';

    return '<div class="sm-line" data-line-idx="' + idx + '">' +
      prodSelect + qtyInput + modeSelect + reqCheck + delBtn +
    '</div>';
  }

  function renderEditor(serviceId, serviceName) {
    var lines = state.draftLines;
    var lineHtml = lines.length
      ? lines.map(function (line, i) { return renderEditorLine(line, i); }).join('')
      : '<div class="sm-empty-row">' + esc(_T('sm_empty_lines')) + '</div>';

    return '<div class="sm-editor" id="smEditor_' + esc(serviceId) + '">' +
      '<div style="font-size:.72rem;color:var(--muted);font-weight:700;margin-bottom:.2rem">' + esc(_T('sm_editor_for')) + ' <span style="color:var(--cream)">' + esc(serviceName) + '</span></div>' +
      '<div class="sm-line-list" id="smLineList_' + esc(serviceId) + '">' + lineHtml + '</div>' +
      '<button class="btn btn--outline btn--sm sm-add-line" type="button" data-sm-action="add-line" data-svc-id="' + esc(serviceId) + '">' + esc(_T('sm_btn_add_line')) + '</button>' +
      '<div class="sm-msg" id="smEditorMsg" style="display:none"></div>' +
      '<div class="sm-editor-actions">' +
        '<button class="btn btn--outline btn--sm" type="button" data-sm-action="cancel-edit">' + esc(_T('btn_cancel')) + '</button>' +
        '<button class="btn btn--primary btn--sm" type="button" data-sm-action="save-edit" data-svc-id="' + esc(serviceId) + '" data-svc-name="' + esc(serviceName) + '">' + esc(_T('sm_btn_save_lines')) + '</button>' +
      '</div>' +
    '</div>';
  }

  function renderServiceRow(svc) {
    var mapping = state.mappings.find(function (m) { return m.id === svc.id; });
    var matCount = mapping ? (mapping.materials || []).length : 0;
    var estCost  = 0;
    if (mapping && mapping.materials) {
      mapping.materials.forEach(function (mat) {
        var invItem = state.inventory.find(function (i) { return i.id === mat.productId; });
        if (invItem && invItem.costPerUnit != null) {
          estCost += asNumber(invItem.costPerUnit, 0) * asNumber(mat.qtyPerService, 0);
        }
      });
    }
    var isEditing = state.editingServiceId === svc.id;

    var matSummary = matCount
      ? _T('sm_meta_count').replace('{count}', matCount)
      : _T('sm_meta_no_materials');
    var costSummary = estCost > 0
      ? ' · ' + _T('sm_meta_est_cost').replace('{cost}', estCost.toFixed(2))
      : '';
    var badgeText = _T('sm_badge_count').replace('{count}', matCount);

    var head = '<div class="sm-row__head">' +
      '<div>' +
        '<div class="sm-svc-name">' + esc(svc.name || svc.serviceName || svc.id) + '</div>' +
        '<div class="sm-meta">' +
          esc(matSummary) + esc(costSummary) +
        '</div>' +
      '</div>' +
      '<div class="sm-head-right">' +
        (matCount ? '<span class="sm-badge">' + esc(badgeText) + '</span>' : '') +
        '<button class="btn btn--outline btn--sm" type="button" data-sm-action="edit-svc" data-svc-id="' + esc(svc.id) + '" data-svc-name="' + esc(svc.name || svc.serviceName || svc.id) + '">' + esc(isEditing ? _T('sm_btn_close') : _T('sm_btn_setup')) + '</button>' +
        (matCount ? '<button class="btn btn--outline btn--sm" type="button" data-sm-action="clear-svc" data-svc-id="' + esc(svc.id) + '" style="color:var(--danger)">' + esc(_T('btn_delete')) + '</button>' : '') +
      '</div>' +
    '</div>';

    var svcName = svc.name || svc.serviceName || svc.id;
    var editor  = isEditing ? renderEditor(svc.id, svcName) : '';

    return '<div class="sm-row" data-svc-id="' + esc(svc.id) + '">' + head + editor + '</div>';
  }

  function renderList() {
    if (!state.services.length) {
      return '<div class="sa-empty">' + esc(_T('sm_empty_services')) + '</div>';
    }
    return state.services.map(function (svc) { return renderServiceRow(svc); }).join('');
  }

  function render() {
    if (!state.containerEl) return;
    var totalMapped = state.mappings.length;
    var summary = _T('sm_summary')
      .replace('{services}', state.services.length)
      .replace('{mapped}', totalMapped);
    state.containerEl.innerHTML = renderStyles() +
      '<div class="sm-wrap">' +
        '<div class="sm-toolbar">' +
          '<div>' +
            '<div class="sa-section-title">' + esc(_T('sm_title')) + '</div>' +
            '<div class="sm-summary">' + esc(summary) + '</div>' +
          '</div>' +
        '</div>' +
        (state.error ? '<div class="sm-msg">' + esc(state.error) + '</div>' : '') +
        (state.loading ? '<div class="sa-empty">' + esc(_T('empty_loading')) + '</div>' : renderList()) +
      '</div>';
  }

  // ── Event delegation ───────────────────────────────────────────────────────

  function readDraftFromDOM() {
    var list = state.containerEl.querySelectorAll('.sm-line[data-line-idx]');
    var lines = [];
    list.forEach(function (row) {
      var idx = parseInt(row.getAttribute('data-line-idx'), 10);
      var prodEl = document.getElementById('smProd_' + idx);
      var qtyEl  = document.getElementById('smQty_'  + idx);
      var modeEl = document.getElementById('smMode_' + idx);
      var reqEl  = document.getElementById('smReq_'  + idx);
      if (!prodEl) return;
      var productId = prodEl.value;
      var invItem   = state.inventory.find(function (i) { return i.id === productId; });
      lines.push({
        productId:           productId,
        productNameSnapshot: invItem ? (invItem.name || '') : '',
        qtyPerService:       qtyEl  ? asNumber(qtyEl.value, 0) : 0,
        unit:                invItem ? (invItem.unit || '') : '',
        deductMode:          modeEl ? modeEl.value : 'fixed',
        required:            reqEl  ? reqEl.checked : true
      });
    });
    return lines;
  }

  function showEditorMsg(msg) {
    var el = document.getElementById('smEditorMsg');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
  }

  function bindEvents() {
    if (!state.containerEl || state.containerEl.__smBound) return;
    state.containerEl.__smBound = true;

    state.containerEl.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-sm-action]');
      if (!btn) return;
      var action  = btn.getAttribute('data-sm-action');
      var svcId   = btn.getAttribute('data-svc-id');
      var svcName = btn.getAttribute('data-svc-name');

      if (action === 'edit-svc') {
        if (state.editingServiceId === svcId) {
          // toggle close
          state.editingServiceId = null;
          state.draftLines = [];
          render();
          return;
        }
        // Save current draft before switching (silently discard)
        state.editingServiceId = svcId;
        state.draftLines = getMaterialsForService(svcId).map(function (m) { return Object.assign({}, m); });
        render();

      } else if (action === 'cancel-edit') {
        state.editingServiceId = null;
        state.draftLines = [];
        render();

      } else if (action === 'add-line') {
        // Sync draft from DOM before adding
        if (state.editingServiceId) state.draftLines = readDraftFromDOM();
        state.draftLines.push({ productId: '', productNameSnapshot: '', qtyPerService: 1, unit: '', deductMode: 'fixed', required: true });
        render();

      } else if (action === 'del-line') {
        var lineIdx = parseInt(btn.getAttribute('data-line-idx'), 10);
        if (state.editingServiceId) state.draftLines = readDraftFromDOM();
        state.draftLines.splice(lineIdx, 1);
        render();

      } else if (action === 'save-edit') {
        var lines = readDraftFromDOM();
        saveMaterials(state.editingServiceId, svcName || state.editingServiceId, lines)
          .then(function () {
            state.editingServiceId = null;
            state.draftLines = [];
          })
          .catch(function (err) {
            showEditorMsg(err.message || _T('sm_err_save_failed'));
          });

      } else if (action === 'clear-svc') {
        if (window.confirm(_T('sm_confirm_clear'))) {
          deleteMaterials(svcId).catch(function (err) {
            state.error = err.message || _T('sm_err_delete_failed');
            render();
          });
        }
      }
    });
  }

  // ── Public API: init ───────────────────────────────────────────────────────

  function init(vendorId, containerEl) {
    if (!vendorId)    throw new Error(_T('sm_err_init_vendor'));
    if (!containerEl) throw new Error(_T('sm_err_init_container'));
    if (!window.firebase || !firebase.firestore) throw new Error(_T('msg_firebase_not_ready'));

    if (state.unsubscribe && state.vendorId !== vendorId) {
      state.unsubscribe();
      state.unsubscribe = null;
    }

    state.vendorId    = vendorId;
    state.containerEl = containerEl;
    state.db          = firebase.firestore();
    state.error       = '';
    state.editingServiceId = null;
    state.draftLines       = [];

    bindEvents();
    state.loading = true;
    render();

    // Load services and inventory in parallel, then start real-time mappings listener
    return Promise.all([loadServices(), loadInventory()])
      .then(function () {
        return loadMappings();
      })
      .catch(function (err) {
        state.loading = false;
        state.error   = err.message || _T('sm_err_init_failed');
        render();
      });
  }

  // ── Expose ─────────────────────────────────────────────────────────────────

  window.SalonServiceMaterials = {
    init:                   init,
    loadMappings:           loadMappings,
    loadServices:           loadServices,
    loadInventory:          loadInventory,
    saveMaterials:          saveMaterials,
    deleteMaterials:        deleteMaterials,
    getMaterialsForService: getMaterialsForService
  };
})();
