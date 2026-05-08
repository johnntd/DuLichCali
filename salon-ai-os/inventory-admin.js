(function () {
  'use strict';

  var CATEGORIES = [
    { value: 'gel_polish', label: 'Gel polish' },
    { value: 'acrylic_powder', label: 'Bột acrylic' },
    { value: 'dip_powder', label: 'Bột dip' },
    { value: 'nail_tips', label: 'Móng tip' },
    { value: 'glue', label: 'Keo' },
    { value: 'files_buffers', label: 'Dũa / buffer' },
    { value: 'disposable', label: 'Đồ dùng một lần' },
    { value: 'sanitation', label: 'Vệ sinh' },
    { value: 'retail', label: 'Bán lẻ' },
    { value: 'other', label: 'Khác' }
  ];

  var UNITS = [
    { value: 'ml', label: 'ml' },
    { value: 'oz', label: 'oz' },
    { value: 'g', label: 'g' },
    { value: 'piece', label: 'cái' },
    { value: 'set', label: 'bộ' },
    { value: 'bottle', label: 'chai' },
    { value: 'box', label: 'hộp' },
    { value: 'pack', label: 'gói' }
  ];

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
    var found = CATEGORIES.find(function (cat) { return cat.value === value; });
    return found ? found.label : 'Khác';
  }

  function unitLabel(value) {
    var found = UNITS.find(function (unit) { return unit.value === value; });
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

    if (!name) throw new Error('Vui lòng nhập tên vật tư.');
    if (!CATEGORIES.some(function (cat) { return cat.value === category; })) throw new Error('Danh mục không hợp lệ.');
    if (!UNITS.some(function (u) { return u.value === unit; })) throw new Error('Đơn vị không hợp lệ.');
    if (!Number.isFinite(currentQty)) throw new Error('Số lượng hiện tại không hợp lệ.');
    if (!Number.isFinite(minQty)) throw new Error('Mức tối thiểu không hợp lệ.');

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
        '<div class="sa-section-title">' + (isEdit ? 'Sửa vật tư' : 'Thêm vật tư') + '</div>' +
      '</div>' +
      '<div class="inv-form-grid">' +
        field('Tên vật tư *', '<input class="sa-input" id="invName" value="' + esc(data.name || '') + '" autocomplete="off">') +
        field('Danh mục *', select('invCategory', CATEGORIES, data.category || 'other')) +
        field('Thương hiệu', '<input class="sa-input" id="invBrand" value="' + esc(data.brand || '') + '" autocomplete="off">') +
        field('SKU', '<input class="sa-input" id="invSku" value="' + esc(data.sku || '') + '" autocomplete="off">') +
        field('Đơn vị *', select('invUnit', UNITS, data.unit || 'piece')) +
        field('Số lượng hiện tại *', '<input class="sa-input" id="invCurrentQty" type="number" step="0.01" min="0" value="' + esc(data.currentQty || 0) + '">') +
        field('Mức tối thiểu *', '<input class="sa-input" id="invMinQty" type="number" step="0.01" min="0" value="' + esc(data.minQty || 0) + '">') +
        field('Số lượng đặt thêm', '<input class="sa-input" id="invReorderQty" type="number" step="0.01" min="0" value="' + esc(data.reorderQty || 0) + '">') +
        field('Giá vốn / đơn vị', '<input class="sa-input" id="invCostPerUnit" type="number" step="0.01" min="0" value="' + esc(data.costPerUnit == null ? '' : data.costPerUnit) + '">') +
        field('Mã nhà cung cấp', '<input class="sa-input" id="invSupplierId" value="' + esc(data.supplierId || '') + '" autocomplete="off">') +
        field('Link đặt hàng thủ công', '<input class="sa-input" id="invSupplierUrl" type="url" value="' + esc(data.supplierUrl || '') + '" autocomplete="off">') +
        '<label class="inv-field inv-check"><input id="invTrackStock" type="checkbox"' + (data.trackStock !== false ? ' checked' : '') + '> Theo dõi tồn kho</label>' +
      '</div>' +
      '<div class="inv-msg" id="invFormMsg" style="display:none"></div>' +
      '<div class="inv-form-actions">' +
        '<button class="btn btn--outline btn--sm" type="button" data-inv-action="cancel-form">Hủy</button>' +
        '<button class="btn btn--primary btn--sm" type="button" data-inv-action="save-form">' + (isEdit ? 'Lưu thay đổi' : 'Thêm vật tư') + '</button>' +
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
      return '<div class="sa-empty">Chưa có vật tư nào. Bấm “Thêm vật tư” để tạo danh sách tồn kho.</div>';
    }

    return '<div class="inv-grid">' + state.items.map(function (item) {
      var low = Number(item.currentQty) <= Number(item.minQty);
      return '<div class="inv-card" data-item-id="' + esc(item.id) + '">' +
        '<div class="inv-card__top">' +
          '<div>' +
            '<div class="inv-name">' + esc(item.name) + '</div>' +
            '<div class="inv-meta">' + esc(categoryLabel(item.category)) + (item.brand ? ' · ' + esc(item.brand) : '') + '</div>' +
          '</div>' +
          (low ? '<span class="inv-badge">Sắp hết</span>' : '') +
        '</div>' +
        '<div class="inv-qty">' +
          '<div><span class="inv-qty__value">' + esc(item.currentQty) + '</span><span class="inv-qty__unit">' + esc(unitLabel(item.unit)) + '</span></div>' +
          '<div class="inv-stepper">' +
            '<button class="inv-icon-btn" type="button" data-inv-action="decrement" data-item-id="' + esc(item.id) + '" aria-label="Giảm số lượng">−</button>' +
            '<button class="inv-icon-btn" type="button" data-inv-action="increment" data-item-id="' + esc(item.id) + '" aria-label="Tăng số lượng">+</button>' +
          '</div>' +
        '</div>' +
        '<div class="inv-actions">' +
          '<button class="btn btn--outline btn--sm" type="button" data-inv-action="edit" data-item-id="' + esc(item.id) + '">Sửa</button>' +
          '<button class="btn btn--outline btn--sm" type="button" data-inv-action="delete" data-item-id="' + esc(item.id) + '">Ngưng dùng</button>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function render() {
    if (!state.containerEl) return;
    var lowCount = getLowStockItems().length;
    var editingItem = state.editingId ? state.items.find(function (item) { return item.id === state.editingId; }) : null;
    state.containerEl.innerHTML = renderStyles() +
      '<div class="inv-admin">' +
        '<div class="inv-toolbar">' +
          '<div>' +
            '<div class="sa-section-title">Kho vật tư</div>' +
            '<div class="inv-summary">' + state.items.length + ' vật tư · ' + lowCount + ' sắp hết</div>' +
          '</div>' +
          '<button class="btn btn--primary btn--sm" type="button" data-inv-action="open-add">+ Thêm vật tư</button>' +
        '</div>' +
        (state.error ? '<div class="inv-msg">' + esc(state.error) + '</div>' : '') +
        ((state.editingId === '__new__' || editingItem) ? renderForm(editingItem) : '') +
        (state.loading ? '<div class="sa-empty">Đang tải tồn kho…</div>' : renderList()) +
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
        if (window.confirm('Ngưng dùng vật tư này?')) deleteItem(item.id);
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
        showFormError(err.message || 'Không thể lưu vật tư.');
      });
    } catch (err) {
      showFormError(err.message || 'Dữ liệu không hợp lệ.');
    }
  }

  function init(vendorId, containerEl) {
    if (!vendorId) throw new Error('Thiếu vendorId cho tồn kho.');
    if (!containerEl) throw new Error('Thiếu vùng hiển thị tồn kho.');
    if (!window.firebase || !firebase.firestore) throw new Error('Firebase chưa sẵn sàng.');

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
    if (!state.vendorId || !state.db) return Promise.reject(new Error('Kho chưa được khởi tạo.'));
    state.loading = true;
    render();

    if (state.unsubscribe) {
      state.unsubscribe();
      state.unsubscribe = null;
    }

    return new Promise(function (resolve, reject) {
      state.unsubscribe = inventoryRef()
        .where('active', '==', true)
        .orderBy('category')
        .orderBy('name')
        .onSnapshot(function (snap) {
          state.items = snap.docs.map(function (doc) {
            return Object.assign({ id: doc.id }, doc.data());
          });
          state.loading = false;
          state.error = '';
          render();
          resolve(state.items);
        }, function (err) {
          state.loading = false;
          state.error = err.message || 'Không thể tải tồn kho.';
          render();
          reject(err);
        });
    });
  }

  function addItem(itemData) {
    return inventoryRef().add(sanitizeItemData(itemData, true));
  }

  function updateItem(itemId, updates) {
    if (!itemId || itemId === '__new__') return Promise.reject(new Error('Thiếu mã vật tư.'));
    return itemRef(itemId).update(sanitizeItemData(updates, false));
  }

  function updateQty(itemId, newQty) {
    if (!itemId) return Promise.reject(new Error('Thiếu mã vật tư.'));
    var qty = asNumber(newQty, NaN);
    if (!Number.isFinite(qty)) return Promise.reject(new Error('Số lượng không hợp lệ.'));
    return itemRef(itemId).update({
      currentQty: qty,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  function deleteItem(itemId) {
    if (!itemId) return Promise.reject(new Error('Thiếu mã vật tư.'));
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
