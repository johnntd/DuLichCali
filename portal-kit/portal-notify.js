(function (root) {
  'use strict';

  var state = null;

  function noop() {}

  function storage() {
    try { return root.localStorage || null; } catch (e) { return null; }
  }

  function readJson(key, fallback) {
    var store = storage();
    if (!store) return fallback;
    try {
      var parsed = JSON.parse(store.getItem(key) || '');
      return parsed == null ? fallback : parsed;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    var store = storage();
    if (!store) return;
    try { store.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function writeString(key, value) {
    var store = storage();
    if (!store) return;
    try { store.setItem(key, String(value)); } catch (e) {}
  }

  function readString(key, fallback) {
    var store = storage();
    if (!store) return fallback;
    try {
      var value = store.getItem(key);
      return value == null ? fallback : value;
    } catch (e) {
      return fallback;
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function keyFor(item) {
    if (!state || !item) return '';
    try {
      var key = state.dedupeKeyFn(item);
      return key == null ? '' : String(key);
    } catch (e) {
      return '';
    }
  }

  function persistNotified() {
    if (!state) return;
    var keys = Object.keys(state.notified).sort(function (a, b) {
      return Number(state.notified[b] || 0) - Number(state.notified[a] || 0);
    }).slice(0, 80);
    var trimmed = {};
    keys.forEach(function (key) { trimmed[key] = state.notified[key]; });
    state.notified = trimmed;
    writeJson(state.notifiedKey, trimmed);
  }

  function persistList() {
    if (!state) return;
    state.items = state.items.slice(0, 120);
    writeJson(state.listKey, state.items);
  }

  function markNotified(item) {
    var key = keyFor(item);
    if (!key) return;
    state.notified[key] = Date.now();
    persistNotified();
  }

  function shouldAlert(item) {
    if (!state || !item) return false;
    var key = keyFor(item);
    if (!key || state.notified[key]) return false;
    if (!state.statusWhitelist.length) return true;
    return state.statusWhitelist.indexOf(item.status || '') >= 0;
  }

  function normalizeItem(item) {
    item = item || {};
    return {
      id: String(item.id || item.bookingId || Date.now()),
      title: item.title == null ? '' : String(item.title),
      message: item.message == null ? '' : String(item.message),
      kind: item.kind == null ? '' : String(item.kind),
      status: item.status == null ? '' : String(item.status),
      bookingId: item.bookingId == null ? '' : String(item.bookingId),
      raw: item.raw || null,
      read: !!item.read,
      createdAt: Number(item.createdAt || Date.now())
    };
  }

  function upsertItem(item, unread) {
    var normalized = normalizeItem(item);
    normalized.read = unread ? false : !!normalized.read;
    state.items = state.items.filter(function (row) { return row.id !== normalized.id; });
    state.items.unshift(normalized);
    persistList();
    return normalized;
  }

  function renderFallbackItem(item) {
    return '<button class="pk-notif-item' + (item.read ? '' : ' pk-notif-item--unread') + '" type="button" data-pk-notif-id="' + escapeHtml(item.id) + '">' +
      '<strong>' + escapeHtml(item.title) + '</strong>' +
      '<span>' + escapeHtml(item.message) + '</span>' +
    '</button>';
  }

  function renderDrawer() {
    if (!state || !state.els || !state.els.list) return;
    var list = state.els.list;
    list.innerHTML = '';
    state.items.forEach(function (item) {
      var wrap = root.document.createElement('div');
      var html = '';
      try {
        html = state.renderItem ? state.renderItem(item) : renderFallbackItem(item);
      } catch (e) {
        html = renderFallbackItem(item);
      }
      wrap.innerHTML = html || renderFallbackItem(item);
      while (wrap.firstElementChild) {
        var node = wrap.firstElementChild;
        node.setAttribute('data-pk-notif-id', item.id);
        node.classList.toggle('pk-notif-item--unread', !item.read);
        node.addEventListener('click', function () {
          markRead(item.id);
          state.onOpenItem(item);
        });
        list.appendChild(node);
      }
    });
  }

  function refreshBadge() {
    if (!state) return 0;
    var unread = unreadCount();
    var badge = state.els && state.els.badge;
    if (badge) {
      badge.textContent = String(unread > 99 ? '99+' : unread);
      badge.hidden = unread <= 0;
    }
    if (root.PortalPWA) {
      if (unread > 0 && typeof root.PortalPWA.setBadge === 'function') root.PortalPWA.setBadge(unread);
      else if (typeof root.PortalPWA.clearBadge === 'function') root.PortalPWA.clearBadge();
    }
    return unread;
  }

  function notifyBrowser(item) {
    if (!state || !state.alertsEnabled || !('Notification' in root) || root.Notification.permission !== 'granted') return;
    try {
      var notification = new root.Notification(item.title || '', {
        body: item.message || '',
        tag: item.id || item.bookingId || undefined,
        data: { id: item.id, bookingId: item.bookingId }
      });
      notification.onclick = function () {
        try { root.focus(); } catch (e) {}
        markRead(item.id);
        state.onOpenItem(item);
        try { notification.close(); } catch (e2) {}
      };
    } catch (e) {}
  }

  function handleItem(item, initialSnapshot) {
    item = normalizeItem(item);
    if (initialSnapshot) {
      markNotified(item);
      upsertItem(Object.assign({}, item, { read: true }), false);
      return;
    }
    if (!shouldAlert(item)) return;
    markNotified(item);
    item = upsertItem(item, true);
    renderDrawer();
    refreshBadge();
    playChime();
    notifyBrowser(item);
  }

  function attachListener(listener) {
    var initial = true;
    if (!listener || !listener.query || typeof listener.query.onSnapshot !== 'function') return noop;
    try {
      return listener.query.onSnapshot(function (snapshot) {
        if (!snapshot || typeof snapshot.docChanges !== 'function') return;
        snapshot.docChanges().forEach(function (change) {
          var doc = change.doc;
          if (!doc) return;
          var data = typeof doc.data === 'function' ? doc.data() : {};
          var mapped = listener.mapDoc ? listener.mapDoc(data || {}, doc.id) : data;
          if (mapped) handleItem(mapped, initial);
        });
        initial = false;
        persistList();
        renderDrawer();
        refreshBadge();
      }, function () {});
    } catch (e) {
      return noop;
    }
  }

  function audioContext() {
    if (!state) return null;
    if (state.audioContext) return state.audioContext;
    var Ctor = root.AudioContext || root.webkitAudioContext;
    if (!Ctor) return null;
    try {
      state.audioContext = new Ctor();
      return state.audioContext;
    } catch (e) {
      return null;
    }
  }

  function enableAlerts() {
    if (!state) return Promise.resolve(false);
    state.alertsEnabled = true;
    writeString(state.enabledKey, 'on');
    var ctx = audioContext();
    var ready = ctx && ctx.state === 'suspended' ? ctx.resume().catch(noop) : Promise.resolve();
    return ready.then(function () {
      if ('Notification' in root && root.Notification && typeof root.Notification.requestPermission === 'function' && root.Notification.permission === 'default') {
        return root.Notification.requestPermission().catch(function () { return null; });
      }
      return null;
    }).then(function () {
      refreshBadge();
      return true;
    }).catch(function () { return false; });
  }

  function playChime() {
    if (!state || !state.alertsEnabled) return;
    if (state.sound && typeof state.sound.play === 'function') {
      try { state.sound.play(); return; } catch (e) {}
    }
    var ctx = audioContext();
    if (!ctx) return;
    function play() {
      try {
        [523.25, 659.25, 783.99].forEach(function (freq, index) {
          var osc = ctx.createOscillator();
          var gain = ctx.createGain();
          var start = ctx.currentTime + index * 0.18;
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.001, start);
          gain.gain.exponentialRampToValueAtTime(0.24, start + 0.035);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.55);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.58);
        });
      } catch (e) {}
    }
    if (ctx.state === 'suspended') ctx.resume().then(play).catch(noop);
    else play();
  }

  function openDrawer() {
    if (!state || !state.els || !state.els.drawer) return;
    state.els.drawer.hidden = false;
    state.els.drawer.classList.add('pk-drawer--open');
    renderDrawer();
  }

  function closeDrawer() {
    if (!state || !state.els || !state.els.drawer) return;
    state.els.drawer.hidden = true;
    state.els.drawer.classList.remove('pk-drawer--open');
  }

  function markRead(id) {
    if (!state) return;
    state.items.forEach(function (item) {
      if (item.id === String(id)) item.read = true;
    });
    persistList();
    renderDrawer();
    refreshBadge();
  }

  function markAllRead() {
    if (!state) return;
    state.items.forEach(function (item) { item.read = true; });
    persistList();
    renderDrawer();
    refreshBadge();
  }

  function unreadCount() {
    if (!state) return 0;
    return state.items.filter(function (item) { return !item.read; }).length;
  }

  function destroy() {
    if (!state) return;
    state.unsubscribes.forEach(function (fn) { try { fn(); } catch (e) {} });
    state = null;
  }

  function init(options) {
    destroy();
    options = options || {};
    var scopeId = String(options.scopeId || 'default');
    var storagePrefix = String(options.storagePrefix || 'portal_notify');
    state = {
      listeners: Array.isArray(options.listeners) ? options.listeners : [],
      scopeId: scopeId,
      storagePrefix: storagePrefix,
      dedupeKeyFn: typeof options.dedupeKeyFn === 'function' ? options.dedupeKeyFn : function (item) { return item.id; },
      statusWhitelist: Array.isArray(options.statusWhitelist) ? options.statusWhitelist.slice() : [],
      renderItem: typeof options.renderItem === 'function' ? options.renderItem : null,
      onOpenItem: typeof options.onOpenItem === 'function' ? options.onOpenItem : noop,
      sound: options.sound || null,
      els: options.els || {},
      notifiedKey: storagePrefix + '_notified_' + scopeId,
      listKey: storagePrefix + '_list_' + scopeId,
      enabledKey: storagePrefix + '_alerts_' + scopeId,
      notified: readJson(storagePrefix + '_notified_' + scopeId, {}),
      items: readJson(storagePrefix + '_list_' + scopeId, []),
      alertsEnabled: readString(storagePrefix + '_alerts_' + scopeId, 'off') === 'on',
      unsubscribes: [],
      audioContext: null
    };
    if (!Array.isArray(state.items)) state.items = [];
    state.items = state.items.map(normalizeItem).slice(0, 120);

    if (state.els.bell) state.els.bell.addEventListener('click', openDrawer);
    if (state.els.enableBtn) state.els.enableBtn.addEventListener('click', enableAlerts);
    if (state.els.drawer) {
      state.els.drawer.addEventListener('click', function (event) {
        if (event.target && event.target.classList && event.target.classList.contains('pk-drawer__backdrop')) closeDrawer();
      });
    }
    state.unsubscribes = state.listeners.map(attachListener);
    renderDrawer();
    refreshBadge();
    return api;
  }

  var api = {
    init: init,
    enableAlerts: enableAlerts,
    playChime: playChime,
    openDrawer: openDrawer,
    closeDrawer: closeDrawer,
    markRead: markRead,
    markAllRead: markAllRead,
    unreadCount: unreadCount,
    refreshBadge: refreshBadge,
    destroy: destroy
  };

  root.PortalNotify = api;
})(window);
