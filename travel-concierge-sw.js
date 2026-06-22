/* Travel Concierge — Web Push service worker
 *
 * Scope: /travel-concierge  (registered by travel-concierge.js via PortalPWA.register)
 * Purpose: receive Deal Hunter "better deal" Web Push alerts and focus the trip on tap.
 *   Push-only + lifecycle — NO fetch/caching handler, so it never interferes with the
 *   SPA's versioned-asset network behavior. Served no-cache (see firebase.json).
 *   Mirrors the proven inline pattern in /mobile-barber/sw.js.
 */
'use strict';

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {
    try { data = { body: event.data ? event.data.text() : '' }; } catch (e2) {}
  }
  var title = data.title || 'Du Lich Cali';
  var body = data.body || 'Tap to open your trip.';
  var url = data.url || '/travel-concierge';
  var tasks = [
    self.registration.showNotification(title, {
      body: body,
      tag: data.tag || 'dlc-deal',
      renotify: true,
      data: { url: url },
      vibrate: [120, 60, 120]
    })
  ];
  // Reflect the deal-alert count on the home-screen app icon while backgrounded (Badging API).
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
  var target = (event.notification.data && event.notification.data.url) || '/travel-concierge';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.indexOf('/travel-concierge') >= 0 && 'focus' in list[i]) return list[i].focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
