(function () {
  'use strict';

  // ── SalonSuppliers ─────────────────────────────────────────────────────────
  // Phase 4: Supplier records and restock order drafting.
  // NEVER auto-orders. All orders are DRAFTS until explicitly marked ordered.

  var ORDER_STATUSES = [
    { value: 'draft',     label: 'Nháp',        cls: 'sup-st--draft' },
    { value: 'ordered',   label: 'Đã đặt',      cls: 'sup-st--ordered' },
    { value: 'received',  label: 'Đã nhận',     cls: 'sup-st--received' },
    { value: 'cancelled', label: 'Đã huỷ',      cls: 'sup-st--cancelled' }
  ];

  var state = {
    vendorId: '',
    containerEl: null,
    db: null,
    suppliers: [],
    orders: [],
    unsubSuppliers: null,
    editingSupplierId: null,  // '__new__' or docId
    loading: false,
    error: ''
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────

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

  function fv() {
    return firebase.firestore.FieldValue;
  }

  function orderStatusLabel(status) {
    var found = ORDER_STATUSES.find(function (s) { return s.value === status; });
    return found ? found.label : status;
  }

  function orderStatusCls(status) {
    var found = ORDER_STATUSES.find(function (s) { return s.value === status; });
    return found ? found.cls : '';
  }

  // ── Firestore refs ──────────────────────────────────────────────────────────

  function suppliersColRef() {
    return state.db.collection('vendors').doc(state.vendorId).collection('suppliers');
  }

  function supplierDocRef(supplierId) {
    return suppliersColRef().doc(supplierId);
  }

  function ordersColRef() {
    return state.db.collection('vendors').doc(state.vendorId).collection('restockOrders');
  }

  function orderDocRef(orderId) {
    return ordersColRef().doc(orderId);
  }

  // ── Data validation ─────────────────────────────────────────────────────────

  function sanitizeSupplierData(data, isCreate) {
    var name = String(data.name || '').trim();
    if (!name) throw new Error('Vui lòng nhập tên nhà cung cấp.');

    var payload = {
      name: name,
      contactName:        String(data.contactName        || '').trim(),
      phone:              String(data.phone              || '').trim(),
      email:              String(data.email              || '').trim(),
      website:            String(data.website            || '').trim(),
      address:            String(data.address            || '').trim(),
      preferred:          data.preferred === true || data.preferred === 'true',
      notes:              String(data.notes              || '').trim(),
      active:             data.active !== false,
      updatedAt:          fv().serverTimestamp()
    };

    var leadTime = String(data.leadTimeDays == null ? '' : data.leadTimeDays).trim();
    if (leadTime !== '') payload.leadTimeDays = asNumber(leadTime, 0);

    var minOrder = String(data.minimumOrderAmount == null ? '' : data.minimumOrderAmount).trim();
    if (minOrder !== '') payload.minimumOrderAmount = asNumber(minOrder, 0);

    if (isCreate) payload.createdAt = fv().serverTimestamp();
    return payload;
  }

  // ── Public API: loadSuppliers ───────────────────────────────────────────────

  function loadSuppliers() {
    if (!state.vendorId || !state.db) return Promise.reject(new Error('SalonSuppliers chưa được khởi tạo.'));

    if (state.unsubSuppliers) {
      state.unsubSuppliers();
      state.unsubSuppliers = null;
    }

    return new Promise(function (resolve, reject) {
      state.unsubSuppliers = suppliersColRef()
        .where('active', '==', true)
        .orderBy('name')
        .onSnapshot(function (snap) {
          state.suppliers = snap.docs.map(function (doc) {
            return Object.assign({ id: doc.id }, doc.data());
          });
          state.error = '';
          render();
          resolve(state.suppliers);
        }, function (err) {
          state.error = err.message || 'Không thể tải nhà cung cấp.';
          render();
          reject(err);
        });
    });
  }

  // ── Public API: loadOrders ──────────────────────────────────────────────────

  function loadOrders() {
    if (!state.vendorId || !state.db) return Promise.reject(new Error('SalonSuppliers chưa được khởi tạo.'));
    return ordersColRef()
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()
      .then(function (snap) {
        state.orders = snap.docs.map(function (doc) {
          return Object.assign({ id: doc.id }, doc.data());
        });
        render();
        return state.orders;
      })
      .catch(function (err) {
        state.error = err.message || 'Không thể tải đơn đặt hàng.';
        render();
        return [];
      });
  }

  // ── Public API: addSupplier ─────────────────────────────────────────────────

  function addSupplier(data) {
    if (!state.vendorId || !state.db) return Promise.reject(new Error('SalonSuppliers chưa được khởi tạo.'));
    var payload = sanitizeSupplierData(data, true);
    return suppliersColRef().add(payload);
  }

  // ── Public API: updateSupplier ──────────────────────────────────────────────

  function updateSupplier(supplierId, data) {
    if (!supplierId) return Promise.reject(new Error('Thiếu mã nhà cung cấp.'));
    var payload = sanitizeSupplierData(data, false);
    return supplierDocRef(supplierId).update(payload);
  }

  // ── Public API: deleteSupplier (soft delete) ────────────────────────────────

  function deleteSupplier(supplierId) {
    if (!supplierId) return Promise.reject(new Error('Thiếu mã nhà cung cấp.'));
    return supplierDocRef(supplierId).update({
      active: false,
      updatedAt: fv().serverTimestamp()
    });
  }

  // ── Public API: createDraftOrder ────────────────────────────────────────────
  // NEVER auto-orders. Always creates status: 'draft'.

  function createDraftOrder(supplierId, items) {
    if (!supplierId) return Promise.reject(new Error('Thiếu mã nhà cung cấp.'));
    if (!state.vendorId || !state.db) return Promise.reject(new Error('SalonSuppliers chưa được khởi tạo.'));

    var supplier = state.suppliers.find(function (s) { return s.id === supplierId; });
    var supplierName = supplier ? supplier.name : supplierId;

    var sanitizedItems = (items || []).map(function (item) {
      return {
        productId:           String(item.productId           || '').trim(),
        productNameSnapshot: String(item.productNameSnapshot || '').trim(),
        qty:                 asNumber(item.qty, 0),
        unit:                String(item.unit || '').trim(),
        estimatedUnitCost:   asNumber(item.estimatedUnitCost, 0)
      };
    });

    var estimatedTotal = sanitizedItems.reduce(function (sum, item) {
      return sum + (item.qty * item.estimatedUnitCost);
    }, 0);

    var payload = {
      supplierId:            supplierId,
      supplierNameSnapshot:  supplierName,
      status:                'draft',
      source:                'manual',
      items:                 sanitizedItems,
      estimatedTotal:        estimatedTotal,
      createdAt:             fv().serverTimestamp(),
      updatedAt:             fv().serverTimestamp()
    };

    return ordersColRef().add(payload).then(function (docRef) {
      return loadOrders().then(function () { return docRef; });
    });
  }

  // ── Public API: markOrdered ─────────────────────────────────────────────────
  // Vendor must click explicitly — never called automatically.

  function markOrdered(orderId) {
    if (!orderId) return Promise.reject(new Error('Thiếu mã đơn hàng.'));
    return orderDocRef(orderId).update({
      status:    'ordered',
      orderedAt: fv().serverTimestamp(),
      updatedAt: fv().serverTimestamp()
    }).then(function () {
      return loadOrders();
    });
  }

  // ── Public API: markReceived ────────────────────────────────────────────────
  // Sets status received; updates inventory quantities via SalonInventoryAdmin.

  function markReceived(orderId, receivedItems) {
    if (!orderId) return Promise.reject(new Error('Thiếu mã đơn hàng.'));

    var updates = {
      status:     'received',
      receivedAt: fv().serverTimestamp(),
      updatedAt:  fv().serverTimestamp()
    };

    return orderDocRef(orderId).update(updates).then(function () {
      // Update inventory for each received item
      var promises = [];
      if (Array.isArray(receivedItems) && window.SalonInventoryAdmin) {
        receivedItems.forEach(function (item) {
          var productId = String(item.productId || '').trim();
          var qty = asNumber(item.qty, 0);
          if (!productId || qty <= 0) return;

          // Read current quantity then add received qty
          var invRef = state.db.collection('vendors').doc(state.vendorId)
            .collection('inventory').doc(productId);

          var p = invRef.get().then(function (snap) {
            if (!snap.exists) return;
            var currentQty = asNumber((snap.data() || {}).currentQty, 0);
            return window.SalonInventoryAdmin.updateQty(productId, currentQty + qty);
          }).catch(function () {});
          promises.push(p);
        });
      }
      return Promise.all(promises);
    }).then(function () {
      return loadOrders();
    });
  }

  // ── Public API: cancelOrder ─────────────────────────────────────────────────

  function cancelOrder(orderId) {
    if (!orderId) return Promise.reject(new Error('Thiếu mã đơn hàng.'));
    return orderDocRef(orderId).update({
      status:    'cancelled',
      updatedAt: fv().serverTimestamp()
    }).then(function () {
      return loadOrders();
    });
  }

  // ── Public API: generateLowStockDraft ──────────────────────────────────────
  // Reads low stock items, groups by supplierId, creates one draft order per
  // supplier with source: 'low_stock_alert'. Returns array of created order IDs.

  function generateLowStockDraft(vendorId) {
    if (!vendorId) return Promise.reject(new Error('Thiếu vendorId.'));
    if (!window.SalonInventoryDeduction) {
      return Promise.reject(new Error('SalonInventoryDeduction chưa sẵn sàng.'));
    }

    return window.SalonInventoryDeduction.getLowStockItems(vendorId).then(function (lowItems) {
      if (!lowItems || !lowItems.length) return [];

      // Group items by supplierId (skip items with no supplierId)
      var groups = {};
      lowItems.forEach(function (item) {
        var sid = String(item.supplierId || '').trim();
        if (!sid) return;
        if (!groups[sid]) groups[sid] = [];
        var reorderQty = asNumber(item.reorderQty, 1);
        groups[sid].push({
          productId:           item.id,
          productNameSnapshot: item.name || item.id,
          qty:                 reorderQty > 0 ? reorderQty : 1,
          unit:                item.unit || '',
          estimatedUnitCost:   asNumber(item.costPerUnit, 0)
        });
      });

      var supplierIds = Object.keys(groups);
      if (!supplierIds.length) return [];

      var createPromises = supplierIds.map(function (sid) {
        var orderItems = groups[sid];
        var supplier = state.suppliers.find(function (s) { return s.id === sid; });
        var supplierName = supplier ? supplier.name : sid;

        var estimatedTotal = orderItems.reduce(function (sum, item) {
          return sum + (item.qty * item.estimatedUnitCost);
        }, 0);

        var payload = {
          supplierId:           sid,
          supplierNameSnapshot: supplierName,
          status:               'draft',
          source:               'low_stock_alert',
          items:                orderItems,
          estimatedTotal:       estimatedTotal,
          createdAt:            fv().serverTimestamp(),
          updatedAt:            fv().serverTimestamp()
        };

        return state.db.collection('vendors').doc(vendorId)
          .collection('restockOrders').add(payload)
          .then(function (ref) { return ref.id; });
      });

      return Promise.all(createPromises).then(function (orderIds) {
        return loadOrders().then(function () { return orderIds; });
      });
    });
  }

  // ── Styles ──────────────────────────────────────────────────────────────────

  function renderStyles() {
    if (document.getElementById('salonSuppliersStyles')) return '';
    return '<style id="salonSuppliersStyles">' +
      /* Layout */
      '.sup-wrap{display:flex;flex-direction:column;gap:1.5rem}' +
      '.sup-panel{display:flex;flex-direction:column;gap:.85rem}' +
      '.sup-toolbar{display:flex;align-items:center;justify-content:space-between;gap:.6rem;flex-wrap:wrap}' +
      '.sup-summary{font-size:.72rem;color:var(--muted);margin-top:.1rem}' +
      /* Supplier table */
      '.sup-table{width:100%;border-collapse:collapse}' +
      '.sup-table thead tr{border-bottom:1px solid var(--border)}' +
      '.sup-table th{text-align:left;font-size:.6rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;padding:.3rem .4rem .3rem 0}' +
      '.sup-table td{padding:.55rem .4rem .55rem 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:.78rem;color:var(--text);vertical-align:top}' +
      '.sup-table tbody tr:last-child td{border-bottom:none}' +
      '.sup-name{font-weight:700;color:var(--cream)}' +
      '.sup-contact{font-size:.68rem;color:var(--muted);margin-top:.12rem}' +
      '.sup-preferred{display:inline-block;font-size:.56rem;font-weight:700;padding:1px 5px;border-radius:3px;text-transform:uppercase;letter-spacing:.04em;background:rgba(245,166,35,.12);border:1px solid rgba(245,166,35,.28);color:var(--gold);margin-left:.35rem;vertical-align:middle}' +
      '.sup-actions{display:flex;gap:.3rem;flex-wrap:wrap}' +
      /* Supplier form */
      '.sup-form{border:1px solid var(--border-g);background:var(--gold-dim);border-radius:8px;padding:.9rem}' +
      '.sup-form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.6rem}' +
      '.sup-field{display:flex;flex-direction:column;gap:.2rem}' +
      '.sup-field label{font-size:.62rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}' +
      '.sup-check{flex-direction:row;align-items:center;margin-top:1.2rem;gap:.4rem}' +
      '.sup-form-actions{display:flex;justify-content:flex-end;gap:.45rem;flex-wrap:wrap;margin-top:.75rem}' +
      '.sup-msg{font-size:.72rem;color:var(--danger);margin-top:.4rem}' +
      /* Order list */
      '.sup-order-list{display:flex;flex-direction:column;gap:.55rem}' +
      '.sup-order-row{border:1px solid var(--border);border-radius:8px;background:rgba(255,255,255,.02);overflow:hidden}' +
      '.sup-order-head{display:flex;align-items:flex-start;justify-content:space-between;gap:.6rem;padding:.7rem .85rem;flex-wrap:wrap}' +
      '.sup-order-info{}' +
      '.sup-order-supplier{font-weight:700;color:var(--cream);font-size:.88rem}' +
      '.sup-order-meta{font-size:.68rem;color:var(--muted);margin-top:.1rem}' +
      '.sup-order-right{display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;flex-shrink:0}' +
      '.sup-order-total{font-size:.76rem;font-weight:700;color:var(--success)}' +
      '.sup-order-items{border-top:1px solid var(--border);padding:.6rem .85rem;font-size:.72rem;color:var(--muted)}' +
      '.sup-order-items ul{margin:.25rem 0 0 1rem;display:flex;flex-direction:column;gap:.15rem}' +
      '.sup-order-items li{color:var(--text)}' +
      /* Status badges */
      '.sup-st{display:inline-block;font-size:.57rem;font-weight:700;padding:1px 5px;border-radius:3px;text-transform:uppercase;letter-spacing:.04em}' +
      '.sup-st--draft{background:rgba(148,163,184,.12);border:1px solid rgba(148,163,184,.28);color:var(--muted)}' +
      '.sup-st--ordered{background:rgba(96,165,250,.12);border:1px solid rgba(96,165,250,.28);color:#60a5fa}' +
      '.sup-st--received{background:rgba(74,222,128,.12);border:1px solid rgba(74,222,128,.28);color:var(--success)}' +
      '.sup-st--cancelled{background:transparent;border:1px solid rgba(248,113,113,.25);color:var(--danger)}' +
      '.sup-source-badge{display:inline-block;font-size:.54rem;font-weight:700;padding:1px 5px;border-radius:3px;text-transform:uppercase;letter-spacing:.04em;background:rgba(139,92,246,.12);border:1px solid rgba(139,92,246,.28);color:#a78bfa;margin-left:.3rem}' +
      /* Empty */
      '.sup-empty{text-align:center;padding:2rem 1rem;color:var(--muted);font-size:.83rem}' +
      /* Mobile overrides */
      '@media(max-width:560px){' +
        '.sup-table{display:block;overflow-x:auto;-webkit-overflow-scrolling:touch}' +
        '.sup-toolbar{align-items:stretch}' +
        '.sup-toolbar .btn{width:100%}' +
        '.sup-form-actions .btn{flex:1}' +
        '.sup-form-grid{grid-template-columns:1fr}' +
        '.sup-order-right{justify-content:flex-start}' +
      '}' +
    '</style>';
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  function supField(label, controlHtml) {
    return '<div class="sup-field"><label>' + esc(label) + '</label>' + controlHtml + '</div>';
  }

  function renderSupplierForm(supplier) {
    var isEdit = !!supplier;
    var d = supplier || { preferred: false, active: true };
    return '<div class="sup-form" id="supplierFormCard">' +
      '<div class="sa-section-header" style="margin-bottom:.55rem">' +
        '<div class="sa-section-title">' + (isEdit ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp') + '</div>' +
      '</div>' +
      '<div class="sup-form-grid">' +
        supField('Tên nhà cung cấp *', '<input class="sa-input" id="supName" value="' + esc(d.name || '') + '" autocomplete="off">') +
        supField('Người liên hệ', '<input class="sa-input" id="supContactName" value="' + esc(d.contactName || '') + '" autocomplete="off">') +
        supField('Điện thoại', '<input class="sa-input" id="supPhone" type="tel" value="' + esc(d.phone || '') + '" autocomplete="off">') +
        supField('Email', '<input class="sa-input" id="supEmail" type="email" value="' + esc(d.email || '') + '" autocomplete="off">') +
        supField('Website', '<input class="sa-input" id="supWebsite" type="url" value="' + esc(d.website || '') + '" autocomplete="off">') +
        supField('Địa chỉ', '<input class="sa-input" id="supAddress" value="' + esc(d.address || '') + '" autocomplete="off">') +
        supField('Thời gian giao hàng (ngày)', '<input class="sa-input" id="supLeadTimeDays" type="number" step="1" min="0" value="' + esc(d.leadTimeDays == null ? '' : d.leadTimeDays) + '">') +
        supField('Đơn hàng tối thiểu ($)', '<input class="sa-input" id="supMinOrder" type="number" step="0.01" min="0" value="' + esc(d.minimumOrderAmount == null ? '' : d.minimumOrderAmount) + '">') +
        supField('Ghi chú', '<input class="sa-input" id="supNotes" value="' + esc(d.notes || '') + '" autocomplete="off">') +
        '<label class="sup-field sup-check"><input id="supPreferred" type="checkbox"' + (d.preferred ? ' checked' : '') + '> Nhà cung cấp ưu tiên</label>' +
      '</div>' +
      '<div class="sup-msg" id="supFormMsg" style="display:none"></div>' +
      '<div class="sup-form-actions">' +
        '<button class="btn btn--outline btn--sm" type="button" data-sup-action="cancel-sup-form">Hủy</button>' +
        '<button class="btn btn--primary btn--sm" type="button" data-sup-action="save-sup-form">' + (isEdit ? 'Lưu thay đổi' : 'Thêm nhà cung cấp') + '</button>' +
      '</div>' +
    '</div>';
  }

  function renderSupplierTable() {
    if (!state.suppliers.length) {
      return '<div class="sup-empty">Chưa có nhà cung cấp nào. Bấm "+ Thêm" để thêm.</div>';
    }
    return '<div style="overflow-x:auto"><table class="sup-table">' +
      '<thead><tr>' +
        '<th>Nhà Cung Cấp</th>' +
        '<th>Liên Hệ</th>' +
        '<th>Giao Hàng</th>' +
        '<th>Thao Tác</th>' +
      '</tr></thead>' +
      '<tbody>' +
      state.suppliers.map(function (s) {
        return '<tr>' +
          '<td>' +
            '<div class="sup-name">' + esc(s.name) + (s.preferred ? '<span class="sup-preferred">Ưu tiên</span>' : '') + '</div>' +
            (s.address ? '<div class="sup-contact">' + esc(s.address) + '</div>' : '') +
          '</td>' +
          '<td>' +
            (s.contactName ? '<div>' + esc(s.contactName) + '</div>' : '') +
            (s.phone ? '<div class="sup-contact"><a href="tel:' + esc(s.phone) + '" style="color:var(--muted);text-decoration:none">' + esc(s.phone) + '</a></div>' : '') +
            (s.email ? '<div class="sup-contact"><a href="mailto:' + esc(s.email) + '" style="color:var(--muted);text-decoration:none">' + esc(s.email) + '</a></div>' : '') +
          '</td>' +
          '<td>' +
            (s.leadTimeDays != null ? esc(s.leadTimeDays) + ' ngày' : '—') +
            (s.minimumOrderAmount != null ? '<div class="sup-contact">Tối thiểu $' + esc(s.minimumOrderAmount) + '</div>' : '') +
          '</td>' +
          '<td>' +
            '<div class="sup-actions">' +
              '<button class="btn btn--outline btn--sm" type="button" data-sup-action="edit-sup" data-sup-id="' + esc(s.id) + '">Sửa</button>' +
              '<button class="btn btn--outline btn--sm" type="button" data-sup-action="delete-sup" data-sup-id="' + esc(s.id) + '" style="color:var(--danger)">Xóa</button>' +
            '</div>' +
          '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  function renderSupplierSection() {
    var editingSupplier = null;
    if (state.editingSupplierId && state.editingSupplierId !== '__new__') {
      editingSupplier = state.suppliers.find(function (s) { return s.id === state.editingSupplierId; });
    }

    var showForm = (state.editingSupplierId === '__new__' || editingSupplier);

    return '<div class="sup-panel">' +
      '<div class="sup-toolbar">' +
        '<div>' +
          '<div class="sa-section-title">Nhà Cung Cấp</div>' +
          '<div class="sup-summary">' + state.suppliers.length + ' nhà cung cấp</div>' +
        '</div>' +
        '<button class="btn btn--primary btn--sm" type="button" data-sup-action="open-add-sup">+ Thêm</button>' +
      '</div>' +
      (state.error ? '<div class="sup-msg">' + esc(state.error) + '</div>' : '') +
      (showForm ? renderSupplierForm(editingSupplier || null) : '') +
      (state.loading ? '<div class="sup-empty">Đang tải nhà cung cấp…</div>' : renderSupplierTable()) +
    '</div>';
  }

  function renderOrdersSection() {
    return '<div class="sup-panel">' +
      '<div class="sup-toolbar">' +
        '<div>' +
          '<div class="sa-section-title">Đơn Đặt Hàng</div>' +
          '<div class="sup-summary">' + state.orders.length + ' đơn hàng gần đây</div>' +
        '</div>' +
        '<div style="display:flex;gap:.4rem;flex-wrap:wrap">' +
          '<button class="btn btn--outline btn--sm" type="button" data-sup-action="open-manual-order">+ Thêm đơn thủ công</button>' +
          '<button class="btn btn--primary btn--sm" type="button" data-sup-action="gen-low-stock-draft">Tạo đơn từ hàng sắp hết</button>' +
        '</div>' +
      '</div>' +
      renderOrderList() +
    '</div>';
  }

  function renderOrderList() {
    if (!state.orders.length) {
      return '<div class="sup-empty">Chưa có đơn đặt hàng nào.</div>';
    }
    return '<div class="sup-order-list">' +
      state.orders.map(function (order) {
        var sourceLabel = order.source === 'low_stock_alert' ? '<span class="sup-source-badge">Hàng sắp hết</span>' : '';
        var itemCount = Array.isArray(order.items) ? order.items.length : 0;
        var total = order.estimatedTotal != null ? '$' + Number(order.estimatedTotal).toFixed(2) : '';

        var actionBtns = '';
        if (order.status === 'draft') {
          actionBtns =
            '<button class="btn btn--outline btn--sm" type="button" data-sup-action="mark-ordered" data-order-id="' + esc(order.id) + '">Đã đặt hàng</button>' +
            '<button class="btn btn--outline btn--sm" type="button" data-sup-action="cancel-order" data-order-id="' + esc(order.id) + '" style="color:var(--danger)">Huỷ</button>';
        } else if (order.status === 'ordered') {
          actionBtns =
            '<button class="btn btn--success btn--sm" type="button" data-sup-action="mark-received" data-order-id="' + esc(order.id) + '">Đã nhận hàng</button>' +
            '<button class="btn btn--outline btn--sm" type="button" data-sup-action="cancel-order" data-order-id="' + esc(order.id) + '" style="color:var(--danger)">Huỷ</button>';
        }

        var itemsHtml = '';
        if (itemCount > 0) {
          itemsHtml = '<div class="sup-order-items">' +
            '<ul>' +
            order.items.map(function (item) {
              return '<li>' + esc(item.productNameSnapshot || item.productId) +
                (item.qty ? ' — ' + esc(item.qty) + (item.unit ? ' ' + esc(item.unit) : '') : '') +
                (item.estimatedUnitCost ? ' (~$' + esc(Number(item.estimatedUnitCost).toFixed(2)) + '/đơn vị)' : '') +
                '</li>';
            }).join('') +
            '</ul></div>';
        }

        return '<div class="sup-order-row">' +
          '<div class="sup-order-head">' +
            '<div class="sup-order-info">' +
              '<div class="sup-order-supplier">' + esc(order.supplierNameSnapshot || order.supplierId) + '</div>' +
              '<div class="sup-order-meta">' +
                '<span class="sup-st ' + orderStatusCls(order.status) + '">' + esc(orderStatusLabel(order.status)) + '</span>' +
                sourceLabel +
                ' · ' + itemCount + ' vật tư' +
              '</div>' +
            '</div>' +
            '<div class="sup-order-right">' +
              (total ? '<span class="sup-order-total">' + esc(total) + '</span>' : '') +
              actionBtns +
            '</div>' +
          '</div>' +
          itemsHtml +
        '</div>';
      }).join('') +
    '</div>';
  }

  // ── Manual order modal ──────────────────────────────────────────────────────

  function openManualOrderModal() {
    if (!state.suppliers.length) {
      alert('Vui lòng thêm ít nhất một nhà cung cấp trước.');
      return;
    }

    var supplierOptions = state.suppliers.map(function (s) {
      return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>';
    }).join('');

    var modalHtml =
      '<div id="supOrderModal" style="' +
        'position:fixed;inset:0;z-index:250;background:rgba(0,0,0,.65);' +
        'display:flex;align-items:center;justify-content:center;padding:1rem">' +
        '<div style="background:var(--navy-800);border:1px solid var(--border-g);border-radius:12px;' +
          'padding:1.5rem 1.75rem;width:100%;max-width:480px;max-height:90vh;overflow-y:auto">' +
          '<h3 style="font-family:var(--font-d);font-size:1.1rem;color:var(--cream);margin-bottom:1rem">Thêm đơn đặt hàng thủ công</h3>' +
          '<div class="sa-field"><label class="sa-field label">Nhà cung cấp *</label>' +
            '<select class="sa-input" id="supModalSupplier"><option value="">— Chọn nhà cung cấp —</option>' + supplierOptions + '</select>' +
          '</div>' +
          '<div class="sa-field" style="margin-top:.6rem">' +
            '<label style="display:block;font-size:.65rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.3rem">' +
              'Sản phẩm cần đặt (mỗi dòng: Tên — Số lượng — Đơn vị)' +
            '</label>' +
            '<textarea class="sa-input" id="supModalItems" rows="5" ' +
              'style="resize:vertical" ' +
              'placeholder="Ví dụ:&#10;Gel polish đỏ — 10 — chai&#10;Buffer 180 grit — 50 — cái"></textarea>' +
          '</div>' +
          '<div class="sup-msg" id="supModalMsg" style="display:none;margin-top:.4rem"></div>' +
          '<div style="display:flex;gap:.6rem;justify-content:flex-end;margin-top:1rem">' +
            '<button class="btn btn--outline btn--sm" type="button" id="supModalCancel">Hủy</button>' +
            '<button class="btn btn--primary btn--sm" type="button" id="supModalSave">Tạo đơn nháp</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('supModalCancel').addEventListener('click', function () {
      var modal = document.getElementById('supOrderModal');
      if (modal) modal.remove();
    });

    document.getElementById('supModalSave').addEventListener('click', function () {
      var supplierId = document.getElementById('supModalSupplier').value;
      var itemsText  = document.getElementById('supModalItems').value;
      var msgEl      = document.getElementById('supModalMsg');

      if (!supplierId) {
        msgEl.textContent = 'Vui lòng chọn nhà cung cấp.';
        msgEl.style.display = 'block';
        return;
      }

      // Parse free-text items (Name — qty — unit)
      var items = [];
      itemsText.split('\n').forEach(function (line) {
        line = line.trim();
        if (!line) return;
        var parts = line.split('—');
        if (parts.length < 1) return;
        var name = (parts[0] || '').trim();
        var qty  = parts.length >= 2 ? asNumber(parts[1], 1) : 1;
        var unit = parts.length >= 3 ? (parts[2] || '').trim() : '';
        if (!name) return;
        items.push({
          productId:           '',
          productNameSnapshot: name,
          qty:                 qty,
          unit:                unit,
          estimatedUnitCost:   0
        });
      });

      if (!items.length) {
        msgEl.textContent = 'Vui lòng nhập ít nhất một sản phẩm.';
        msgEl.style.display = 'block';
        return;
      }

      createDraftOrder(supplierId, items).then(function () {
        var modal = document.getElementById('supOrderModal');
        if (modal) modal.remove();
      }).catch(function (err) {
        msgEl.textContent = err.message || 'Không thể tạo đơn hàng.';
        msgEl.style.display = 'block';
      });
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  function render() {
    if (!state.containerEl) return;
    state.containerEl.innerHTML = renderStyles() +
      '<div class="sup-wrap">' +
        renderSupplierSection() +
        renderOrdersSection() +
      '</div>';
  }

  // ── Event delegation ────────────────────────────────────────────────────────

  function formData() {
    return {
      name:                document.getElementById('supName').value,
      contactName:         document.getElementById('supContactName').value,
      phone:               document.getElementById('supPhone').value,
      email:               document.getElementById('supEmail').value,
      website:             document.getElementById('supWebsite').value,
      address:             document.getElementById('supAddress').value,
      leadTimeDays:        document.getElementById('supLeadTimeDays').value,
      minimumOrderAmount:  document.getElementById('supMinOrder').value,
      notes:               document.getElementById('supNotes').value,
      preferred:           document.getElementById('supPreferred').checked
    };
  }

  function showFormError(msg) {
    var el = document.getElementById('supFormMsg');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
  }

  function saveSupplierForm() {
    try {
      var data = formData();
      var promise = (state.editingSupplierId === '__new__')
        ? addSupplier(data)
        : updateSupplier(state.editingSupplierId, data);
      promise.then(function () {
        state.editingSupplierId = null;
        // loadSuppliers() real-time listener will update state and re-render
      }).catch(function (err) {
        showFormError(err.message || 'Không thể lưu nhà cung cấp.');
      });
    } catch (err) {
      showFormError(err.message || 'Dữ liệu không hợp lệ.');
    }
  }

  function bindEvents() {
    if (!state.containerEl || state.containerEl.__supBound) return;
    state.containerEl.__supBound = true;

    state.containerEl.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-sup-action]');
      if (!btn) return;
      var action  = btn.getAttribute('data-sup-action');
      var supId   = btn.getAttribute('data-sup-id');
      var orderId = btn.getAttribute('data-order-id');

      // ── Supplier actions ──
      if (action === 'open-add-sup') {
        state.editingSupplierId = '__new__';
        render();

      } else if (action === 'cancel-sup-form') {
        state.editingSupplierId = null;
        render();

      } else if (action === 'save-sup-form') {
        saveSupplierForm();

      } else if (action === 'edit-sup') {
        state.editingSupplierId = supId;
        render();

      } else if (action === 'delete-sup') {
        if (window.confirm('Xóa nhà cung cấp này khỏi danh sách?')) {
          deleteSupplier(supId).catch(function (err) {
            state.error = err.message || 'Không thể xóa nhà cung cấp.';
            render();
          });
        }

      // ── Order actions ──
      } else if (action === 'open-manual-order') {
        openManualOrderModal();

      } else if (action === 'gen-low-stock-draft') {
        if (!window.confirm('Tạo đơn đặt hàng nháp cho tất cả vật tư sắp hết?')) return;
        generateLowStockDraft(state.vendorId).then(function (ids) {
          if (!ids || !ids.length) {
            alert('Không có vật tư sắp hết nào được liên kết với nhà cung cấp.');
          } else {
            alert('Đã tạo ' + ids.length + ' đơn đặt hàng nháp.');
          }
        }).catch(function (err) {
          alert('Lỗi: ' + (err.message || 'Không thể tạo đơn hàng.'));
        });

      } else if (action === 'mark-ordered') {
        if (!window.confirm('Xác nhận đã đặt hàng này?')) return;
        markOrdered(orderId).catch(function (err) {
          alert('Lỗi: ' + (err.message || 'Không thể cập nhật đơn hàng.'));
        });

      } else if (action === 'mark-received') {
        // Use order items as receivedItems (all items fully received)
        var order = state.orders.find(function (o) { return o.id === orderId; });
        if (!order) return;
        if (!window.confirm('Xác nhận đã nhận hàng và cập nhật tồn kho?')) return;
        markReceived(orderId, order.items || []).catch(function (err) {
          alert('Lỗi: ' + (err.message || 'Không thể cập nhật nhận hàng.'));
        });

      } else if (action === 'cancel-order') {
        if (!window.confirm('Huỷ đơn hàng này?')) return;
        cancelOrder(orderId).catch(function (err) {
          alert('Lỗi: ' + (err.message || 'Không thể huỷ đơn hàng.'));
        });
      }
    });
  }

  // ── Public API: init ────────────────────────────────────────────────────────

  function init(vendorId, containerEl) {
    if (!vendorId)    throw new Error('Thiếu vendorId cho nhà cung cấp.');
    if (!containerEl) throw new Error('Thiếu vùng hiển thị nhà cung cấp.');
    if (!window.firebase || !firebase.firestore) throw new Error('Firebase chưa sẵn sàng.');

    if (state.unsubSuppliers && state.vendorId !== vendorId) {
      state.unsubSuppliers();
      state.unsubSuppliers = null;
    }

    state.vendorId    = vendorId;
    state.containerEl = containerEl;
    state.db          = firebase.firestore();
    state.error       = '';
    state.editingSupplierId = null;
    state.loading     = true;
    render();

    bindEvents();

    return Promise.all([loadSuppliers(), loadOrders()])
      .then(function () {
        state.loading = false;
        render();
      })
      .catch(function (err) {
        state.loading = false;
        state.error   = err.message || 'Không thể khởi tạo nhà cung cấp.';
        render();
      });
  }

  // ── Expose ──────────────────────────────────────────────────────────────────

  window.SalonSuppliers = {
    init:                  init,
    loadSuppliers:         loadSuppliers,
    loadOrders:            loadOrders,
    addSupplier:           addSupplier,
    updateSupplier:        updateSupplier,
    deleteSupplier:        deleteSupplier,
    createDraftOrder:      createDraftOrder,
    markOrdered:           markOrdered,
    markReceived:          markReceived,
    cancelOrder:           cancelOrder,
    generateLowStockDraft: generateLowStockDraft
  };
})();
