(function () {
  'use strict';

  // ── SalonSupplyMarketplace ────────────────────────────────────────────────
  // Phase 11: AI Supply Marketplace — vendor-facing curated supply panel.
  //
  // IMPORTANT: This module does NOT auto-purchase anything. All "Tìm Mua"
  // links open external search pages (Amazon, BSG, etc.) in a new browser
  // tab. The vendor manually places any orders. No transactions are initiated
  // by this code.
  //
  // Firestore reads:
  //   vendors/{vendorId}/inventory  — to detect low-stock items
  //   vendors/{vendorId}/suppliers  — to show preferred suppliers first
  //
  // The static curated catalog is embedded below (SUPPLY_CATALOG).

  // ── Static curated catalog ───────────────────────────────────────────────
  var SUPPLY_CATALOG = [
    {
      id: 'gel_polish',
      name: 'Gel Polish',
      categoryLabel: 'Gel Polish',
      brands: ['Gelish', 'OPI', 'CND', 'Entity'],
      searchUrl: 'https://www.amazon.com/s?k=gelish+gel+polish+salon+professional',
      bsgUrl: 'https://www.bsgbeauty.com/search?type=product&q=gel+polish',
      avgPrice: '$12 – $18 / lọ',
      icon: '&#128137;'
    },
    {
      id: 'acrylic_powder',
      name: 'Bột Acrylic',
      categoryLabel: 'Acrylic Powder',
      brands: ['Young Nails', 'NSI', 'Tammy Taylor', 'Mia Secret'],
      searchUrl: 'https://www.amazon.com/s?k=nail+acrylic+powder+salon+professional',
      bsgUrl: 'https://www.bsgbeauty.com/search?type=product&q=acrylic+powder',
      avgPrice: '$20 – $35 / hộp',
      icon: '&#129398;'
    },
    {
      id: 'nail_tips',
      name: 'Móng Giả (Tips)',
      categoryLabel: 'Nail Tips',
      brands: ['Tammy Taylor', 'Elegant Touch', 'IBD', 'Young Nails'],
      searchUrl: 'https://www.amazon.com/s?k=nail+tips+salon+professional+500pcs',
      bsgUrl: 'https://www.bsgbeauty.com/search?type=product&q=nail+tips',
      avgPrice: '$8 – $15 / hộp',
      icon: '&#10024;'
    },
    {
      id: 'dip_powder',
      name: 'Bột Dip',
      categoryLabel: 'Dip Powder',
      brands: ['Kiara Sky', 'SNS', 'OPI', 'Revel Nail'],
      searchUrl: 'https://www.amazon.com/s?k=dip+powder+nails+salon+professional',
      bsgUrl: 'https://www.bsgbeauty.com/search?type=product&q=dip+powder',
      avgPrice: '$15 – $28 / lọ',
      icon: '&#127774;'
    },
    {
      id: 'nail_glue',
      name: 'Keo Dán Móng',
      categoryLabel: 'Nail Glue',
      brands: ['IBD', 'Nailene', 'Mia Secret', 'Star Nail'],
      searchUrl: 'https://www.amazon.com/s?k=professional+nail+glue+salon',
      bsgUrl: 'https://www.bsgbeauty.com/search?type=product&q=nail+glue',
      avgPrice: '$5 – $12 / tuýp',
      icon: '&#129521;'
    },
    {
      id: 'files_buffers',
      name: 'Giũa & Buffer',
      categoryLabel: 'Files & Buffers',
      brands: ['Kupa', 'Orly', 'OPI', 'Star Nail'],
      searchUrl: 'https://www.amazon.com/s?k=professional+nail+files+buffers+salon+bulk',
      bsgUrl: 'https://www.bsgbeauty.com/search?type=product&q=nail+files+buffers',
      avgPrice: '$8 – $20 / bộ',
      icon: '&#128296;'
    },
    {
      id: 'disposable',
      name: 'Vật Tư Dùng Một Lần',
      categoryLabel: 'Disposables',
      brands: ['Dynarex', 'Medpride', 'CleanStar'],
      searchUrl: 'https://www.amazon.com/s?k=nail+salon+disposable+supplies+bulk',
      bsgUrl: 'https://www.bsgbeauty.com/search?type=product&q=salon+disposables',
      avgPrice: '$15 – $40 / thùng',
      icon: '&#128716;'
    },
    {
      id: 'sanitation',
      name: 'Khử Trùng & Vệ Sinh',
      categoryLabel: 'Sanitation',
      brands: ['Barbicide', 'Marvy', 'Rejuvenate', 'CRC'],
      searchUrl: 'https://www.amazon.com/s?k=nail+salon+sanitation+disinfectant+professional',
      bsgUrl: 'https://www.bsgbeauty.com/search?type=product&q=salon+disinfectant',
      avgPrice: '$12 – $35 / chai',
      icon: '&#129529;'
    },
    {
      id: 'retail',
      name: 'Sản Phẩm Bán Lẻ',
      categoryLabel: 'Retail Products',
      brands: ['OPI', 'Essie', 'Sally Hansen', 'Seche Vite'],
      searchUrl: 'https://www.amazon.com/s?k=nail+salon+retail+top+coat+cuticle+oil',
      bsgUrl: 'https://www.bsgbeauty.com/search?type=product&q=retail+nail+products',
      avgPrice: '$8 – $22 / chai',
      icon: '&#127979;'
    }
  ];

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function _db() {
    if (!window.firebase || !firebase.firestore) throw new Error('Firebase chưa sẵn sàng.');
    return firebase.firestore();
  }

  // ── Module state ─────────────────────────────────────────────────────────────

  var state = {
    vendorId: '',
    containerEl: null,
    lowStockItems: [],
    suppliers: [],
    loading: false,
    error: ''
  };

  // ── init ─────────────────────────────────────────────────────────────────────
  // Call once when the panel is first shown.
  // vendorId  — Firestore vendor document ID
  // containerEl — DOM element to render into

  function init(vendorId, containerEl) {
    if (!vendorId || !containerEl) return;
    state.vendorId = vendorId;
    state.containerEl = containerEl;
    loadMarketplace();
  }

  // ── loadMarketplace ──────────────────────────────────────────────────────────
  // Fetches low-stock items and suppliers in parallel, then renders.

  function loadMarketplace() {
    if (!state.vendorId || !state.containerEl) return;
    state.loading = true;
    state.error = '';

    // Show loading state
    state.containerEl.innerHTML =
      '<div class="sa-empty">Đang tải thông tin vật tư…</div>';

    var lowStockPromise = (window.SalonInventoryDeduction)
      ? window.SalonInventoryDeduction.getLowStockItems(state.vendorId)
      : Promise.resolve([]);

    var suppliersPromise = _db()
      .collection('vendors').doc(state.vendorId).collection('suppliers')
      .orderBy('name')
      .get()
      .then(function (snap) {
        return snap.docs.map(function (doc) {
          return Object.assign({ id: doc.id }, doc.data());
        });
      })
      .catch(function () {
        return [];
      });

    Promise.all([lowStockPromise, suppliersPromise])
      .then(function (results) {
        state.lowStockItems = results[0] || [];
        state.suppliers     = results[1] || [];
        state.loading = false;
        render();
      })
      .catch(function (err) {
        state.loading = false;
        state.error = err && err.message ? err.message : 'Lỗi không xác định';
        if (state.containerEl) {
          state.containerEl.innerHTML =
            '<div class="sa-empty">Không thể tải trang vật tư. Vui lòng thử lại.</div>';
        }
      });
  }

  // ── _matchCatalogEntry ────────────────────────────────────────────────────────
  // Given a low-stock inventory item, find the best matching catalog entry.
  // Match by item.category field or a loose name match.

  function _matchCatalogEntry(item) {
    var cat  = String(item.category || '').toLowerCase().replace(/[\s\-]/g, '_');
    var name = String(item.name || '').toLowerCase();

    // Direct category match
    var byCategory = SUPPLY_CATALOG.filter(function (entry) {
      return entry.id === cat || cat.indexOf(entry.id) !== -1 || entry.id.indexOf(cat) !== -1;
    });
    if (byCategory.length) return byCategory[0];

    // Loose name match
    var byName = SUPPLY_CATALOG.filter(function (entry) {
      var lc = entry.name.toLowerCase();
      return name.indexOf(lc) !== -1 ||
             lc.indexOf(name) !== -1 ||
             name.indexOf(entry.id) !== -1;
    });
    if (byName.length) return byName[0];

    return null;
  }

  // ── _renderCatalogCard ────────────────────────────────────────────────────────
  // Returns HTML string for one catalog entry card.

  function _renderCatalogCard(entry, preferredSupplierName) {
    var brandsHtml = entry.brands.map(function (b) {
      return '<span class="sm-brand-chip">' + esc(b) + '</span>';
    }).join('');

    var supplierNote = preferredSupplierName
      ? '<div class="sm-preferred-supplier">&#11088; Nhà cung cấp ưu tiên: <strong>' + esc(preferredSupplierName) + '</strong></div>'
      : '';

    return (
      '<div class="sm-catalog-card">' +
        '<div class="sm-card-header">' +
          '<span class="sm-card-icon">' + entry.icon + '</span>' +
          '<div class="sm-card-info">' +
            '<div class="sm-card-name">' + esc(entry.name) + '</div>' +
            '<div class="sm-card-category">' + esc(entry.categoryLabel) + '</div>' +
          '</div>' +
          '<div class="sm-card-price">' + esc(entry.avgPrice) + '</div>' +
        '</div>' +
        '<div class="sm-brands">' + brandsHtml + '</div>' +
        supplierNote +
        '<div class="sm-card-actions">' +
          '<a href="' + esc(entry.searchUrl) + '" target="_blank" rel="noopener noreferrer" ' +
            'class="btn btn--primary btn--sm sm-order-btn">&#128722; Tìm Mua (Amazon)</a>' +
          '<a href="' + esc(entry.bsgUrl) + '" target="_blank" rel="noopener noreferrer" ' +
            'class="btn btn--outline btn--sm sm-order-btn">&#128722; BSG Beauty</a>' +
        '</div>' +
      '</div>'
    );
  }

  // ── render ───────────────────────────────────────────────────────────────────
  // Renders the full marketplace panel into state.containerEl.

  function render() {
    if (!state.containerEl) return;

    var html = '';

    // ── Section 1: Disclaimer ────────────────────────────────────────────────
    html +=
      '<div class="sm-disclaimer">' +
        '&#8505; Các liên kết trên mở trang tìm kiếm bên ngoài. ' +
        'Không có giao dịch tự động.' +
      '</div>';

    // ── Section 2: Cần Đặt Hàng Ngay (low stock) ────────────────────────────
    html += '<div class="sa-section-header" style="margin-top:1rem">';
    html += '<div class="sa-section-title">&#9888; Cần Đặt Hàng Ngay</div>';
    html += '<button class="btn btn--outline btn--sm" onclick="window.SalonSupplyMarketplace.loadMarketplace()">&#8635; Làm mới</button>';
    html += '</div>';

    if (!state.lowStockItems || !state.lowStockItems.length) {
      html +=
        '<div class="sa-card" style="margin-bottom:1.25rem">' +
          '<div class="sa-empty" style="padding:1.25rem 0">' +
            '&#10003; Không có vật tư nào sắp hết. Kho hàng đang ổn định.' +
          '</div>' +
        '</div>';
    } else {
      html += '<div class="sm-lowstock-list">';
      state.lowStockItems.forEach(function (item) {
        var catalogEntry = _matchCatalogEntry(item);
        var currentQty   = Number(item.currentQty) || 0;
        var minQty       = Number(item.minQty) || 0;
        var unit         = item.unit ? ' ' + esc(item.unit) : '';

        html +=
          '<div class="sm-lowstock-card">' +
            '<div class="sm-lowstock-header">' +
              '<div class="sm-lowstock-name">' + esc(item.name || item.id) + '</div>' +
              '<span class="sm-stock-badge sm-stock-badge--low">' +
                'Còn ' + currentQty + unit + ' / tối thiểu ' + minQty + unit +
              '</span>' +
            '</div>';

        if (item.supplierUrl) {
          html +=
            '<div class="sm-lowstock-actions">' +
              '<a href="' + esc(item.supplierUrl) + '" target="_blank" rel="noopener noreferrer" ' +
                'class="btn btn--primary btn--sm sm-order-btn">&#128722; Đặt Hàng Ngay</a>' +
            '</div>';
        } else if (catalogEntry) {
          html +=
            '<div style="font-size:.7rem;color:var(--muted);margin:.2rem 0 .4rem">' +
              'Phù hợp danh mục: <em>' + esc(catalogEntry.name) + '</em>' +
            '</div>' +
            '<div class="sm-lowstock-actions">' +
              '<a href="' + esc(catalogEntry.searchUrl) + '" target="_blank" rel="noopener noreferrer" ' +
                'class="btn btn--primary btn--sm sm-order-btn">&#128722; Tìm Mua (Amazon)</a>' +
              '<a href="' + esc(catalogEntry.bsgUrl) + '" target="_blank" rel="noopener noreferrer" ' +
                'class="btn btn--outline btn--sm sm-order-btn">&#128722; BSG Beauty</a>' +
            '</div>';
        } else {
          html +=
            '<div class="sm-lowstock-actions">' +
              '<a href="https://www.amazon.com/s?k=' + encodeURIComponent(item.name || 'nail salon supplies') + '" ' +
                'target="_blank" rel="noopener noreferrer" ' +
                'class="btn btn--outline btn--sm sm-order-btn">&#128722; Tìm Mua</a>' +
            '</div>';
        }

        html += '</div>'; // .sm-lowstock-card
      });
      html += '</div>'; // .sm-lowstock-list
    }

    // ── Section 3: Danh Mục Vật Tư (full catalog) ───────────────────────────
    html += '<div class="sa-section-header" style="margin-top:1.5rem">';
    html += '<div class="sa-section-title">&#128218; Danh Mục Vật Tư</div>';
    html += '</div>';

    // Build a set of preferred supplier names keyed by supply category
    // (simple heuristic: if a supplier's name contains a known brand, flag it)
    var preferredByCategory = {};
    if (state.suppliers && state.suppliers.length) {
      SUPPLY_CATALOG.forEach(function (entry) {
        state.suppliers.forEach(function (sup) {
          var supName = String(sup.name || '').toLowerCase();
          var matched = entry.brands.some(function (brand) {
            return supName.indexOf(brand.toLowerCase()) !== -1;
          });
          if (matched && !preferredByCategory[entry.id]) {
            preferredByCategory[entry.id] = sup.name;
          }
        });
      });
    }

    html += '<div class="sm-catalog-grid">';
    SUPPLY_CATALOG.forEach(function (entry) {
      html += _renderCatalogCard(entry, preferredByCategory[entry.id] || null);
    });
    html += '</div>';

    // ── Footer disclaimer ────────────────────────────────────────────────────
    html +=
      '<div class="sm-disclaimer sm-disclaimer--footer">' +
        '&#8505; Tất cả liên kết "Tìm Mua" chỉ mở trang tìm kiếm bên ngoài (Amazon, BSG Beauty). ' +
        'Không có giao dịch tự động xảy ra. Chủ tiệm tự quyết định mua hàng.' +
      '</div>';

    state.containerEl.innerHTML = html;
  }

  // ── CSS injection ────────────────────────────────────────────────────────────
  // Scoped styles for the supply marketplace panel. Injected once at load time.

  (function _injectStyles() {
    if (document.getElementById('sm-styles')) return;
    var style = document.createElement('style');
    style.id = 'sm-styles';
    style.textContent = [
      /* Disclaimer bar */
      '.sm-disclaimer{background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.22);border-radius:6px;padding:.5rem .9rem;font-size:.72rem;color:#d97706;margin-bottom:.5rem;line-height:1.5}',
      '.sm-disclaimer--footer{margin-top:1.5rem;margin-bottom:.5rem}',

      /* Low-stock section */
      '.sm-lowstock-list{display:flex;flex-direction:column;gap:.6rem;margin-bottom:.5rem}',
      '.sm-lowstock-card{background:rgba(248,113,113,.05);border:1px solid rgba(248,113,113,.22);border-radius:var(--r);padding:.8rem 1rem}',
      '.sm-lowstock-header{display:flex;align-items:center;justify-content:space-between;gap:.5rem;flex-wrap:wrap;margin-bottom:.45rem}',
      '.sm-lowstock-name{font-size:.9rem;font-weight:700;color:var(--cream)}',
      '.sm-stock-badge{display:inline-block;font-size:.62rem;font-weight:700;padding:2px 7px;border-radius:3px;white-space:nowrap}',
      '.sm-stock-badge--low{background:rgba(248,113,113,.12);border:1px solid rgba(248,113,113,.35);color:#f87171}',
      '.sm-lowstock-actions{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.4rem}',

      /* Catalog grid */
      '.sm-catalog-grid{display:grid;grid-template-columns:1fr;gap:.75rem;margin-bottom:.5rem}',
      '@media (min-width:640px){.sm-catalog-grid{grid-template-columns:repeat(2,1fr)}}',
      '@media (min-width:1200px){.sm-catalog-grid{grid-template-columns:repeat(3,1fr)}}',

      /* Catalog card */
      '.sm-catalog-card{background:var(--navy-800);border:1px solid var(--border);border-radius:var(--r);padding:.85rem 1rem;display:flex;flex-direction:column;gap:.45rem}',
      '.sm-card-header{display:flex;align-items:flex-start;gap:.55rem}',
      '.sm-card-icon{font-size:1.35rem;line-height:1;flex-shrink:0;padding-top:.05rem}',
      '.sm-card-info{flex:1;min-width:0}',
      '.sm-card-name{font-size:.88rem;font-weight:700;color:var(--cream);line-height:1.25}',
      '.sm-card-category{font-size:.64rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-top:.08rem}',
      '.sm-card-price{font-size:.72rem;font-weight:700;color:var(--success);white-space:nowrap}',

      /* Brand chips */
      '.sm-brands{display:flex;flex-wrap:wrap;gap:.28rem}',
      '.sm-brand-chip{display:inline-block;font-size:.58rem;padding:1px 6px;border-radius:3px;background:rgba(255,255,255,.06);border:1px solid var(--border);color:var(--muted)}',

      /* Preferred supplier note */
      '.sm-preferred-supplier{font-size:.66rem;color:var(--gold-lt);background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.18);border-radius:4px;padding:.2rem .5rem}',

      /* Action buttons */
      '.sm-card-actions{display:flex;gap:.35rem;flex-wrap:wrap;margin-top:.1rem}',
      '.sm-order-btn{white-space:nowrap}'
    ].join('\n');
    document.head.appendChild(style);
  })();

  // ── Public API ───────────────────────────────────────────────────────────────

  window.SalonSupplyMarketplace = {
    init:            init,
    loadMarketplace: loadMarketplace,
    render:          render
  };

})();
