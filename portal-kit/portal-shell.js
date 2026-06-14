(function (root) {
  'use strict';

  function noop() {}

  function clear(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function text(value) {
    return value == null ? '' : String(value);
  }

  function mountNode(mount) {
    if (!mount) return null;
    if (typeof mount === 'string') return root.document.querySelector(mount);
    return mount;
  }

  function appendRenderer(parent, renderer, item) {
    if (!parent || typeof renderer !== 'function') return;
    var result = renderer(item, parent);
    if (result == null) return;
    if (typeof result === 'string') {
      var wrap = root.document.createElement('div');
      wrap.innerHTML = result;
      while (wrap.firstChild) parent.appendChild(wrap.firstChild);
      return;
    }
    if (result.nodeType) parent.appendChild(result);
  }

  function summaryCounters(options) {
    options = options || {};
    var mount = mountNode(options.mount);
    var tabs = Array.isArray(options.tabs) ? options.tabs : [];
    var activeKey = text(options.activeKey);
    var onSelect = typeof options.onSelect === 'function' ? options.onSelect : noop;
    if (!mount) return null;
    clear(mount);
    var row = root.document.createElement('div');
    row.className = 'pk-stats';
    row.setAttribute('role', 'tablist');
    tabs.forEach(function (tab) {
      var key = text(tab.key);
      var active = key === activeKey;
      var btn = root.document.createElement('button');
      btn.type = 'button';
      btn.className = 'pk-stat' + (active ? ' pk-stat--active' : '');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.setAttribute('data-pk-key', key);
      var num = root.document.createElement('span');
      num.className = 'pk-stat__num';
      num.textContent = text(tab.count == null ? 0 : tab.count);
      var label = root.document.createElement('span');
      label.className = 'pk-stat__label';
      label.textContent = text(tab.label);
      btn.appendChild(num);
      btn.appendChild(label);
      btn.addEventListener('click', function () { onSelect(key); });
      row.appendChild(btn);
    });
    mount.appendChild(row);
    return row;
  }

  function filterChips(options) {
    options = options || {};
    var mount = mountNode(options.mount);
    var chips = Array.isArray(options.chips) ? options.chips : [];
    var activeKey = text(options.activeKey);
    var onSelect = typeof options.onSelect === 'function' ? options.onSelect : noop;
    if (!mount) return null;
    clear(mount);
    var row = root.document.createElement('div');
    row.className = 'pk-chips';
    chips.forEach(function (chip) {
      var key = text(chip.key);
      var active = key === activeKey;
      var btn = root.document.createElement('button');
      btn.type = 'button';
      btn.className = 'pk-chip' + (active ? ' pk-chip--active' : '');
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.setAttribute('data-pk-key', key);
      btn.textContent = text(chip.label);
      btn.addEventListener('click', function () { onSelect(key); });
      row.appendChild(btn);
    });
    mount.appendChild(row);
    return row;
  }

  function cardList(options) {
    options = options || {};
    var mount = mountNode(options.mount);
    var items = Array.isArray(options.items) ? options.items : [];
    var expandedId = text(options.expandedId);
    var renderCollapsed = typeof options.renderCollapsed === 'function' ? options.renderCollapsed : null;
    var renderExpanded = typeof options.renderExpanded === 'function' ? options.renderExpanded : null;
    var onToggle = typeof options.onToggle === 'function' ? options.onToggle : noop;
    if (!mount) return null;
    clear(mount);
    var list = root.document.createElement('div');
    list.className = 'pk-card-list';
    items.forEach(function (item) {
      item = item || {};
      var id = text(item.id);
      var expanded = id && id === expandedId;
      var card = root.document.createElement('article');
      card.className = 'pk-card' + (expanded ? ' pk-card--expanded' : '');
      card.setAttribute('data-pk-id', id);

      var head = root.document.createElement('button');
      head.type = 'button';
      head.className = 'pk-card__head';
      head.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      appendRenderer(head, renderCollapsed, item);
      head.addEventListener('click', function () { onToggle(id); });
      card.appendChild(head);

      var detail = root.document.createElement('div');
      detail.className = 'pk-card__detail';
      if (expanded) appendRenderer(detail, renderExpanded, item);
      card.appendChild(detail);
      list.appendChild(card);
    });
    mount.appendChild(list);
    return list;
  }

  root.PortalShell = {
    summaryCounters: summaryCounters,
    filterChips: filterChips,
    cardList: cardList
  };
})(window);
