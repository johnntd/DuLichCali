(function () {
  'use strict';

  function _T(key) {
    return (window.SalonI18n && window.SalonI18n.t) ? window.SalonI18n.t(key) : key;
  }

  function CATEGORIES() {
    return [
      { value: 'gel_polish',     label: _T('cat_gel_polish') },
      { value: 'acrylic_powder', label: _T('cat_acrylic_powder') },
      { value: 'dip_powder',     label: _T('cat_dip_powder') },
      { value: 'nail_tips',      label: _T('cat_nail_tips') },
      { value: 'glue',           label: _T('cat_glue') },
      { value: 'files_buffers',  label: _T('cat_files_buffers') },
      { value: 'disposable',     label: _T('cat_disposable') },
      { value: 'sanitation',     label: _T('cat_sanitation') },
      { value: 'retail',         label: _T('cat_retail') },
      { value: 'other',          label: _T('cat_other') }
    ];
  }

  function UNITS() {
    return [
      { value: 'ml',     label: _T('unit_ml') },
      { value: 'oz',     label: _T('unit_oz') },
      { value: 'g',      label: _T('unit_g') },
      { value: 'piece',  label: _T('unit_piece') },
      { value: 'set',    label: _T('unit_set') },
      { value: 'bottle', label: _T('unit_bottle') },
      { value: 'box',    label: _T('unit_box') },
      { value: 'pack',   label: _T('unit_pack') }
    ];
  }

  var state = {
    vendorId: '',
    containerEl: null,
    db: null,
    items: [],
    unsubscribe: null,
    editingId: null,
    loading: false,
    error: ''
  };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function categoryLabel(value) {
    var cats = CATEGORIES();
    var found = cats.find(function (cat) { return cat.value === value; });
    return found ? found.label : _T('cat_other');
  }

  function unitLabel(value) {
    var units = UNITS();
    var found = units.find(function (unit) { return unit.value === value; });
    return found ? found.label : value;
  }

  function itemRef(itemId) {
    return state.db.collection('vendors').doc(state.vendorId).collection('inventory').doc(itemId);
  }

  function inventoryRef() {
    return state.db.collection('vendors').doc(state.vendorId).collection('inventory');
  }

  function asNumber(value, fallback) {
    var num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  function sanitizeItemData(itemData, isCreate) {
    var data = itemData || {};
    var name = String(data.name || '').trim();
    var category = String(data.category || 'other').trim();
    var unit = String(data.unit || 'piece').trim();
    var currentQty = asNumber(data.currentQty, NaN);
    var minQty = asNumber(data.minQty, NaN);

    var validCats = CATEGORIES().map(function (c) { return c.value; });
    var validUnits = UNITS().map(function (u) { return u.value; });

    if (!name) throw new Error(_T('inv_err_name_required'));
    if (validCats.indexOf(category) === -1) throw new Error(_T('inv_err_invalid_cat'));
    if (validUnits.indexOf(unit) === -1) throw new Error(_T('inv_err_invalid_unit'));
    if (!Number.isFinite(currentQty)) throw new Error(_T('inv_err_invalid_qty'));
    if (!Number.isFinite(minQty)) throw new Error(_T('inv_err_invalid_min'));

    var payload = {
      name: name,
      category: category,
      brand: String(data.brand || '').trim(),
      sku: String(data.sku || '').trim(),
      unit: unit,
      currentQty: currentQty,
      minQty: minQty,
      reorderQty: asNumber(data.reorderQty, 0),
      supplierId: String(data.supplierId || '').trim(),
      supplierUrl: String(data.supplierUrl || '').trim(),
      active: data.active !== false,
      trackStock: data.trackStock !== false,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    var costPerUnit = String(data.costPerUnit == null ? '' : data.costPerUnit).trim();
    if (costPerUnit !== '') payload.costPerUnit = asNumber(costPerUnit, 0);
    if (isCreate) payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    return payload;
  }

  function renderStyles() {
    if (document.getElementById('salonInventoryAdminStyles')) return '';
    return '<style id="salonInventoryAdminStyles">' +
      '.inv-admin{display:flex;flex-direction:column;gap:1rem}' +
      '.inv-toolbar{display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap}' +
      '.inv-summary{font-size:.72rem;color:var(--muted)}' +
      '.inv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(235px,1fr));gap:.75rem}' +
      '.inv-card{border:1px solid var(--border);background:rgba(255,255,255,.025);border-radius:8px;padding:.85rem;display:flex;flex-direction:column;gap:.65rem}' +
      '.inv-card__top{display:flex;justify-content:space-between;align-items:flex-start;gap:.6rem}' +
      '.inv-name{font-weight:700;color:var(--cream);line-height:1.25}' +
      '.inv-meta{font-size:.7rem;color:var(--muted);margin-top:.18rem}' +
      '.inv-badge{background:#dc2626;color:#fff;border-radius:99px;padding:.1rem .45rem;font-size:.62rem;font-weight:700;white-space:nowrap}' +
      '.inv-qty{display:flex;align-items:center;justify-content:space-between;gap:.6rem;border-top:1px solid var(--border);padding-top:.65rem}' +
      '.inv-qty__value{font-size:1.1rem;color:var(--cream);font-weight:700}' +
      '.inv-qty__unit{font-size:.68rem;color:var(--muted);margin-left:.2rem}' +
      '.inv-stepper{display:flex;align-items:center;gap:.35rem}' +
      '.inv-icon-btn{width:32px;height:32px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--cream);font-size:1rem;cursor:pointer}' +
      '.inv-actions{display:flex;gap:.4rem;flex-wrap:wrap}' +
      '.inv-form-card{border:1px solid var(--border-g);background:var(--gold-dim);border-radius:8px;padding:.9rem}' +
      '.inv-form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.65rem}' +
      '.inv-field{display:flex;flex-direction:column;gap:.22rem}' +
      '.inv-field label{font-size:.68rem;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.04em}' +
      '.inv-check{flex-direction:row;align-items:center;margin-top:1.35rem}' +
      '.inv-form-actions{display:flex;justify-content:flex-end;gap:.45rem;flex-wrap:wrap;margin-top:.75rem}' +
      '.inv-msg{font-size:.72rem;color:var(--danger);margin-top:.5rem}' +
      '@media(max-width:520px){.inv-grid{grid-template-columns:1fr}.inv-toolbar{align-items:stretch}.inv-toolbar .btn{width:100%}.inv-form-actions .btn{flex:1}.inv-card{padding:.75rem}}' +
      '</style>';
  }

  function renderForm(item) {
    var isEdit = !!item;
    var data = item || { category: 'gel_polish', unit: 'bottle', currentQty: 0, minQty: 1, reorderQty: 1, trackStock: true };
    return '<div class="inv-form-card" id="inventoryFormCard">' +
      '<div class="sa-section-header" style="margin-bottom:.65rem">' +
        '<div class="sa-section-title">' + (isEdit ? _T('inv_form_edit_title') : _T('inv_form_add_title')) + '</div>' +
      '</div>' +
      '<div class="inv-form-grid">' +
        field(_T('inv_field_name'), '<input class="sa-input" id="invName" value="' + esc(data.name || '') + '" autocomplete="off">') +
        field(_T('inv_field_category'), select('invCategory', CATEGORIES(), data.category || 'other')) +
        field(_T('inv_field_brand'), '<input class="sa-input" id="invBrand" value="' + esc(data.brand || '') + '" autocomplete="off">') +
        field(_T('inv_field_sku'), '<input class="sa-input" id="invSku" value="' + esc(data.sku || '') + '" autocomplete="off">') +
        field(_T('inv_field_unit'), select('invUnit', UNITS(), data.unit || 'piece')) +
        field(_T('inv_field_current_qty'), '<input class="sa-input" id="invCurrentQty" type="number" step="0.01" min="0" value="' + esc(data.currentQty || 0) + '">') +
        field(_T('inv_field_min_qty'), '<input class="sa-input" id="invMinQty" type="number" step="0.01" min="0" value="' + esc(data.minQty || 0) + '">') +
        field(_T('inv_field_reorder_qty'), '<input class="sa-input" id="invReorderQty" type="number" step="0.01" min="0" value="' + esc(data.reorderQty || 0) + '">') +
        field(_T('inv_field_cost_per_unit'), '<input class="sa-input" id="invCostPerUnit" type="number" step="0.01" min="0" value="' + esc(data.costPerUnit == null ? '' : data.costPerUnit) + '">') +
        field(_T('inv_field_supplier_id'), '<input class="sa-input" id="invSupplierId" value="' + esc(data.supplierId || '') + '" autocomplete="off">') +
        field(_T('inv_field_supplier_url'), '<input class="sa-input" id="invSupplierUrl" type="url" value="' + esc(data.supplierUrl || '') + '" autocomplete="off">') +
        '<label class="inv-field inv-check"><input id="invTrackStock" type="checkbox"' + (data.trackStock !== false ? ' checked' : '') + '> ' + esc(_T('inv_field_track_stock')) + '</label>' +
      '</div>' +
      '<div class="inv-msg" id="invFormMsg" style="display:none"></div>' +
      '<div class="inv-form-actions">' +
        '<button class="btn btn--outline btn--sm" type="button" data-inv-action="cancel-form">' + esc(_T('btn_cancel')) + '</button>' +
        '<button class="btn btn--primary btn--sm" type="button" data-inv-action="save-form">' + (isEdit ? esc(_T('btn_save_changes')) : esc(_T('inv_btn_save_add'))) + '</button>' +
      '</div>' +
    '</div>';
  }

  function field(label, controlHtml) {
    return '<div class="inv-field"><label>' + esc(label) + '</label>' + controlHtml + '</div>';
  }

  function select(id, options, selected) {
    return '<select class="sa-input" id="' + esc(id) + '">' + options.map(function (option) {
      return '<option value="' + esc(option.value) + '"' + (option.value === selected ? ' selected' : '') + '>' + esc(option.label) + '</option>';
    }).join('') + '</select>';
  }

  function renderList() {
    if (!state.items.length) {
      return '<div class="sa-empty">' + esc(_T('inv_empty')) + '</div>';
    }

    return '<div class="inv-grid">' + state.items.map(function (item) {
      var low = Number(item.currentQty) <= Number(item.minQty);
      return '<div class="inv-card" data-item-id="' + esc(item.id) + '">' +
        '<div class="inv-card__top">' +
          '<div>' +
            '<div class="inv-name">' + esc(item.name) + '</div>' +
            '<div class="inv-meta">' + esc(categoryLabel(item.category)) + (item.brand ? ' · ' + esc(item.brand) : '') + '</div>' +
          '</div>' +
          (low ? '<span class="inv-badge">' + esc(_T('inv_badge_low')) + '</span>' : '') +
        '</div>' +
        '<div class="inv-qty">' +
          '<div><span class="inv-qty__value">' + esc(item.currentQty) + '</span><span class="inv-qty__unit">' + esc(unitLabel(item.unit)) + '</span></div>' +
          '<div class="inv-stepper">' +
            '<button class="inv-icon-btn" type="button" data-inv-action="decrement" data-item-id="' + esc(item.id) + '" aria-label="' + esc(_T('inv_aria_decrement')) + '">−</button>' +
            '<button class="inv-icon-btn" type="button" data-inv-action="increment" data-item-id="' + esc(item.id) + '" aria-label="' + esc(_T('inv_aria_increment')) + '">+</button>' +
          '</div>' +
        '</div>' +
        '<div class="inv-actions">' +
          '<button class="btn btn--outline btn--sm" type="button" data-inv-action="edit" data-item-id="' + esc(item.id) + '">' + esc(_T('btn_edit')) + '</button>' +
          '<button class="btn btn--outline btn--sm" type="button" data-inv-action="delete" data-item-id="' + esc(item.id) + '">' + esc(_T('inv_btn_deactivate')) + '</button>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function render() {
    if (!state.containerEl) return;
    var lowCount = getLowStockItems().length;
    var editingItem = state.editingId ? state.items.find(function (item) { return item.id === state.editingId; }) : null;
    var summary = _T('inv_summary')
      .replace('{count}', state.items.length)
      .replace('{low}', lowCount);
    state.containerEl.innerHTML = renderStyles() +
      '<div class="inv-admin">' +
        '<div class="inv-toolbar">' +
          '<div>' +
            '<div class="sa-section-title">' + esc(_T('inv_title')) + '</div>' +
            '<div class="inv-summary">' + esc(summary) + '</div>' +
          '</div>' +
          '<button class="btn btn--primary btn--sm" type="button" data-inv-action="open-add">' + esc(_T('inv_btn_add')) + '</button>' +
        '</div>' +
        (state.error ? '<div class="inv-msg">' + esc(state.error) + '</div>' : '') +
        ((state.editingId === '__new__' || editingItem) ? renderForm(editingItem) : '') +
        (state.loading ? '<div class="sa-empty">' + esc(_T('inv_loading')) + '</div>' : renderList()) +
      '</div>';
  }

  function formData() {
    return {
      name: document.getElementById('invName').value,
      category: document.getElementById('invCategory').value,
      brand: document.getElementById('invBrand').value,
      sku: document.getElementById('invSku').value,
      unit: document.getElementById('invUnit').value,
      currentQty: document.getElementById('invCurrentQty').value,
      minQty: document.getElementById('invMinQty').value,
      reorderQty: document.getElementById('invReorderQty').value,
      costPerUnit: document.getElementById('invCostPerUnit').value,
      supplierId: document.getElementById('invSupplierId').value,
      supplierUrl: document.getElementById('invSupplierUrl').value,
      trackStock: document.getElementById('invTrackStock').checked
    };
  }

  function showFormError(message) {
    var el = document.getElementById('invFormMsg');
    if (!el) return;
    el.textContent = message;
    el.style.display = 'block';
  }

  function bindEvents() {
    if (!state.containerEl || state.containerEl.__inventoryBound) return;
    state.containerEl.__inventoryBound = true;
    state.containerEl.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-inv-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-inv-action');
      var itemId = btn.getAttribute('data-item-id');
      var item = itemId ? state.items.find(function (row) { return row.id === itemId; }) : null;

      if (action === 'open-add') {
        state.editingId = '__new__';
        render();
      } else if (action === 'cancel-form') {
        state.editingId = null;
        render();
      } else if (action === 'save-form') {
        saveForm();
      } else if (action === 'edit' && item) {
        state.editingId = item.id;
        render();
      } else if (action === 'increment' && item) {
        updateQty(item.id, asNumber(item.currentQty, 0) + 1);
      } else if (action === 'decrement' && item) {
        updateQty(item.id, Math.max(0, asNumber(item.currentQty, 0) - 1));
      } else if (action === 'delete' && item) {
        if (window.confirm(_T('inv_confirm_deactivate'))) deleteItem(item.id);
      }
    });
  }

  function saveForm() {
    try {
      var data = formData();
      var promise = state.editingId === '__new__'
        ? addItem(data)
        : updateItem(state.editingId, data);
      promise.then(function () {
        state.editingId = null;
      }).catch(function (err) {
        showFormError(err.message || _T('inv_err_save_failed'));
      });
    } catch (err) {
      showFormError(err.message || _T('msg_invalid_data'));
    }
  }

  function init(vendorId, containerEl) {
    if (!vendorId) throw new Error(_T('inv_err_init_vendor'));
    if (!containerEl) throw new Error(_T('inv_err_init_container'));
    if (!window.firebase || !firebase.firestore) throw new Error(_T('msg_firebase_not_ready'));

    if (state.unsubscribe && state.vendorId !== vendorId) {
      state.unsubscribe();
      state.unsubscribe = null;
    }

    state.vendorId = vendorId;
    state.containerEl = containerEl;
    state.db = firebase.firestore();
    state.error = '';
    bindEvents();
    return loadItems();
  }

  function loadItems() {
    if (!state.vendorId || !state.db) return Promise.reject(new Error(_T('inv_err_not_init')));
    state.loading = true;
    render();

    if (state.unsubscribe) {
      state.unsubscribe();
      state.unsubscribe = null;
    }

    return new Promise(function (resolve, reject) {
      state.unsubscribe = inventoryRef()
        .where('active', '==', true)
        .onSnapshot(function (snap) {
          state.items = snap.docs.map(function (doc) {
            return Object.assign({ id: doc.id }, doc.data());
          }).sort(function (a, b) {
            var ca = (a.category || '').toLowerCase(), cb = (b.category || '').toLowerCase();
            if (ca !== cb) return ca < cb ? -1 : 1;
            return (a.name || '').toLowerCase() < (b.name || '').toLowerCase() ? -1 : 1;
          });
          state.loading = false;
          state.error = '';
          render();
          resolve(state.items);
        }, function (err) {
          state.loading = false;
          state.error = err.message || _T('inv_err_load_failed');
          render();
          reject(err);
        });
    });
  }

  function addItem(itemData) {
    return inventoryRef().add(sanitizeItemData(itemData, true));
  }

  function updateItem(itemId, updates) {
    if (!itemId || itemId === '__new__') return Promise.reject(new Error(_T('inv_err_missing_id')));
    return itemRef(itemId).update(sanitizeItemData(updates, false));
  }

  function updateQty(itemId, newQty) {
    if (!itemId) return Promise.reject(new Error(_T('inv_err_missing_id')));
    var qty = asNumber(newQty, NaN);
    if (!Number.isFinite(qty)) return Promise.reject(new Error(_T('inv_err_qty_invalid')));
    return itemRef(itemId).update({
      currentQty: qty,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  function deleteItem(itemId) {
    if (!itemId) return Promise.reject(new Error(_T('inv_err_missing_id')));
    return itemRef(itemId).update({
      active: false,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  function getLowStockItems() {
    return state.items.filter(function (item) {
      return Number(item.currentQty) <= Number(item.minQty);
    });
  }

  window.SalonInventoryAdmin = {
    init: init,
    loadItems: loadItems,
    addItem: addItem,
    updateItem: updateItem,
    updateQty: updateQty,
    deleteItem: deleteItem,
    getLowStockItems: getLowStockItems
  };
})();
