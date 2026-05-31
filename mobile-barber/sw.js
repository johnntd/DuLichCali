/* Mobile Barber Vendor Portal — Service Worker
 *
 * Scope: /mobile-barber/
 * Goals:
 *   - Make the dashboard installable + offline-resilient (app shell cache).
 *   - NEVER serve stale booking/Firestore data: Firebase/Google API requests
 *     bypass the cache entirely (network-only).
 *   - Static assets (icons, css, fonts) are cache-first for instant launch.
 *   - HTML navigations are network-first (fresh shell) with an offline fallback.
 *   - Receive Web Push booking alerts and focus the portal on tap.
 *
 * Versioning: bump CACHE_VERSION on any shell/asset change so old caches are
 * purged on activate. The SW file itself is served no-cache (see firebase.json).
 */
'use strict';

var CACHE_VERSION = 'mb-vendor-v2-20260531';
var SHELL_CACHE = 'mb-shell-' + CACHE_VERSION;
var ASSET_CACHE = 'mb-assets-' + CACHE_VERSION;

// Minimal app shell — keep small; everything else is fetched on demand.
var SHELL_URLS = [
  '/mobile-barber/dashboard.html',
  '/mobile-barber/manifest.webmanifest',
  '/assets/icons/mobile-barber-vendor-192.png',
  '/assets/icons/mobile-barber-vendor-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      // addAll fails the whole install if any URL 404s; add individually + tolerate.
      return Promise.all(SHELL_URLS.map(function (u) {
        return cache.add(u).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== SHELL_CACHE && k !== ASSET_CACHE && k.indexOf('mb-') === 0) {
          return caches.delete(k);
        }
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isApiRequest(url) {
  // Firebase/Google/auth/functions endpoints must always hit the network so the
  // portal never shows stale bookings/promotions.
  return /(?:firestore|firebaseio|googleapis|google-analytics|gstatic|firebaseinstallations|identitytoolkit|cloudfunctions|run\.app)\b/.test(url) ||
         /firebasejs|firebase-/.test(url);
}

function isStaticAsset(req) {
  return req.method === 'GET' && /\.(?:png|jpg|jpeg|webp|gif|svg|ico|css|woff2?|ttf)(?:\?|$)/.test(req.url);
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;            // never cache writes
  if (isApiRequest(req.url)) return;           // network-only (pass through)

  // HTML navigations: network-first, fall back to cached shell when offline.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') >= 0) {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(SHELL_CACHE).then(function (c) { c.put(req, copy).catch(function () {}); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (m) {
          return m || caches.match('/mobile-barber/dashboard.html');
        });
      })
    );
    return;
  }

  // Static assets: cache-first, refresh in background.
  if (isStaticAsset(req)) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        var network = fetch(req).then(function (res) {
          if (res && res.status === 200) {
            var copy = res.clone();
            caches.open(ASSET_CACHE).then(function (c) { c.put(req, copy).catch(function () {}); });
          }
          return res;
        }).catch(function () { return cached; });
        return cached || network;
      })
    );
    return;
  }
  // Everything else (e.g. versioned .js): network-first so updates always load.
  event.respondWith(fetch(req).catch(function () { return caches.match(req); }));
});

// ── Web Push — booking alerts ────────────────────────────────────────────────
self.addEventListener('push', function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {
    try { data = { body: event.data ? event.data.text() : '' }; } catch (e2) {}
  }
  var title = data.title || 'New booking request';
  var body = data.body || 'Tap to review the booking in your portal.';
  var url = data.url || '/mobile-barber/dashboard.html';
  var tasks = [
    self.registration.showNotification(title, {
      body: body,
      icon: '/assets/icons/mobile-barber-vendor-192.png',
      badge: '/assets/icons/mobile-barber-vendor-192.png',
      tag: data.tag || 'mb-booking',
      renotify: true,
      data: { url: url },
      vibrate: [120, 60, 120]
    })
  ];
  // Reflect the vendor's pending count on the HOME-SCREEN app icon while the app is
  // backgrounded/closed (PWA Badging API). badgeCount is supplied by the
  // sendMobileBarberBookingPush function; the foreground app reconciles to the true
  // unread count on next open. No-op where the API is unsupported.
  try {
    if (self.navigator && typeof self.navigator.setAppBadge === 'function' && typeof data.badgeCount === 'number') {
      var bp = data.badgeCount > 0 ? self.navigator.setAppBadge(data.badgeCount) : self.navigator.clearAppBadge();
      if (bp && bp.catch) tasks.push(bp.catch(function () {}));
    }
  } catch (e) {}
  event.waitUntil(Promise.all(tasks));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var target = (event.notification.data && event.notification.data.url) || '/mobile-barber/dashboard.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.indexOf('/mobile-barber/') >= 0 && 'focus' in list[i]) return list[i].focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
