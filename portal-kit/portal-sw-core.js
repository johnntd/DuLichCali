'use strict';

(function () {
  var config = self.PORTAL_SW_CONFIG || {};
  var cacheVersion = String(config.cacheVersion || 'v1');
  var scope = String(config.scope || self.registration.scope || 'portal').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'portal';
  var prefix = 'portal-' + scope + '-';
  var shellCache = prefix + 'shell-' + cacheVersion;
  var assetCache = prefix + 'assets-' + cacheVersion;
  var shellUrls = Array.isArray(config.shellUrls) ? config.shellUrls.slice() : [];
  var startUrl = config.startUrl || shellUrls[0] || './';

  function isApiRequest(url) {
    return /(?:firestore|firebaseio|googleapis|google-analytics|gstatic|firebaseinstallations|identitytoolkit|cloudfunctions|run\.app)\b/.test(url) ||
      /firebasejs|firebase-/.test(url);
  }

  function isStaticAsset(request) {
    return request.method === 'GET' && /\.(?:png|jpg|jpeg|webp|gif|svg|ico|css|woff2?|ttf|json|webmanifest)(?:\?|$)/.test(request.url);
  }

  function cacheShellUrl(cache, url) {
    return cache.add(url).catch(function () {});
  }

  self.addEventListener('install', function (event) {
    event.waitUntil(
      caches.open(shellCache).then(function (cache) {
        return Promise.all(shellUrls.map(function (url) { return cacheShellUrl(cache, url); }));
      }).then(function () { return self.skipWaiting(); })
    );
  });

  self.addEventListener('activate', function (event) {
    event.waitUntil(
      caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (key) {
          if (key.indexOf(prefix) === 0 && key !== shellCache && key !== assetCache) {
            return caches.delete(key);
          }
          return null;
        }));
      }).then(function () { return self.clients.claim(); })
    );
  });

  function networkFirst(request, cacheName, fallbackUrl) {
    return fetch(request).then(function (response) {
      if (response && response.status === 200) {
        var copy = response.clone();
        caches.open(cacheName).then(function (cache) { cache.put(request, copy).catch(function () {}); });
      }
      return response;
    }).catch(function () {
      return caches.match(request).then(function (cached) {
        return cached || (fallbackUrl ? caches.match(fallbackUrl) : null);
      });
    });
  }

  function cacheFirst(request) {
    return caches.match(request).then(function (cached) {
      var network = fetch(request).then(function (response) {
        if (response && response.status === 200) {
          var copy = response.clone();
          caches.open(assetCache).then(function (cache) { cache.put(request, copy).catch(function () {}); });
        }
        return response;
      }).catch(function () { return cached; });
      return cached || network;
    });
  }

  self.addEventListener('fetch', function (event) {
    var request = event.request;
    if (!request || request.method !== 'GET') return;
    if (isApiRequest(request.url)) return;
    if (request.mode === 'navigate' || ((request.headers.get('accept') || '').indexOf('text/html') >= 0)) {
      event.respondWith(networkFirst(request, shellCache, startUrl));
      return;
    }
    if (isStaticAsset(request)) {
      event.respondWith(cacheFirst(request));
      return;
    }
    event.respondWith(networkFirst(request, assetCache));
  });

  function parsePushData(event) {
    try { return event.data ? event.data.json() : {}; } catch (e) {
      try { return { body: event.data ? event.data.text() : '' }; } catch (e2) { return {}; }
    }
  }

  self.addEventListener('push', function (event) {
    var data = parsePushData(event);
    var url = data.url || startUrl;
    var tasks = [
      self.registration.showNotification(data.title || '', {
        body: data.body || '',
        icon: data.icon || undefined,
        badge: data.badge || undefined,
        tag: data.tag || undefined,
        data: { url: url }
      })
    ];
    try {
      if (self.navigator && typeof data.badgeCount === 'number') {
        if (data.badgeCount > 0 && typeof self.navigator.setAppBadge === 'function') {
          tasks.push(self.navigator.setAppBadge(data.badgeCount).catch(function () {}));
        } else if (data.badgeCount <= 0 && typeof self.navigator.clearAppBadge === 'function') {
          tasks.push(self.navigator.clearAppBadge().catch(function () {}));
        }
      }
    } catch (e) {}
    event.waitUntil(Promise.all(tasks));
  });

  self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    var target = (event.notification.data && event.notification.data.url) || startUrl;
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
        for (var i = 0; i < clients.length; i += 1) {
          var client = clients[i];
          if (client.url && client.url.indexOf(config.scope || '') >= 0 && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
        return null;
      })
    );
  });
})();
