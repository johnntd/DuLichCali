(function (root) {
  'use strict';

  var activeRegistration = null;

  function nav() {
    return root.navigator || {};
  }

  function hasServiceWorker() {
    return !!(nav() && 'serviceWorker' in nav());
  }

  function isStandalone() {
    try {
      return !!((root.matchMedia && root.matchMedia('(display-mode: standalone)').matches) || nav().standalone === true);
    } catch (e) {
      return false;
    }
  }

  function toUint8Array(value) {
    if (!value || !root.atob || !root.Uint8Array) return null;
    try {
      var padding = '='.repeat((4 - (value.length % 4)) % 4);
      var base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
      var raw = root.atob(base64);
      var out = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
      return out;
    } catch (e) {
      return null;
    }
  }

  function register(options) {
    options = options || {};
    if (!hasServiceWorker() || !options.swUrl) return Promise.resolve(null);
    try {
      return nav().serviceWorker.register(options.swUrl, options.scope ? { scope: options.scope } : undefined)
        .then(function (registration) {
          activeRegistration = registration || null;
          return activeRegistration;
        })
        .catch(function () { return null; });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  function readyRegistration() {
    if (activeRegistration) return Promise.resolve(activeRegistration);
    if (!hasServiceWorker()) return Promise.resolve(null);
    try {
      return Promise.resolve(nav().serviceWorker.ready)
        .then(function (registration) {
          activeRegistration = registration || null;
          return activeRegistration;
        })
        .catch(function () { return null; });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  function setBadge(count) {
    try {
      if (!nav() || typeof nav().setAppBadge !== 'function') return Promise.resolve(false);
      return Promise.resolve(nav().setAppBadge(Math.max(0, Number(count) || 0))).then(function () { return true; }).catch(function () { return false; });
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  function clearBadge() {
    try {
      if (!nav() || typeof nav().clearAppBadge !== 'function') return Promise.resolve(false);
      return Promise.resolve(nav().clearAppBadge()).then(function () { return true; }).catch(function () { return false; });
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  function permission() {
    if (!('Notification' in root) || !root.Notification || typeof root.Notification.requestPermission !== 'function') {
      return Promise.resolve(null);
    }
    try {
      return Promise.resolve(root.Notification.requestPermission()).catch(function () { return null; });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  function subscriptionJson(subscription) {
    if (!subscription) return null;
    try {
      var json = typeof subscription.toJSON === 'function' ? subscription.toJSON() : subscription;
      return {
        endpoint: json.endpoint || '',
        keys: json.keys || {}
      };
    } catch (e) {
      return null;
    }
  }

  function subscribePush(options) {
    options = options || {};
    if (!hasServiceWorker() || !('Notification' in root) || !('PushManager' in root) || !options.vapidPublicKey) {
      return Promise.resolve(null);
    }
    return permission().then(function (result) {
      if (result !== 'granted') return null;
      return readyRegistration();
    }).then(function (registration) {
      if (!registration || !registration.pushManager) return null;
      return registration.pushManager.getSubscription().then(function (existing) {
        if (existing) return existing;
        var key = toUint8Array(options.vapidPublicKey);
        if (!key) return null;
        return registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key
        });
      });
    }).then(subscriptionJson).catch(function () { return null; });
  }

  function unsubscribePush() {
    if (!hasServiceWorker() || !('PushManager' in root)) return Promise.resolve(false);
    return readyRegistration().then(function (registration) {
      if (!registration || !registration.pushManager) return false;
      return registration.pushManager.getSubscription();
    }).then(function (subscription) {
      if (!subscription || typeof subscription.unsubscribe !== 'function') return false;
      return subscription.unsubscribe().then(function (ok) { return !!ok; }).catch(function () { return false; });
    }).catch(function () { return false; });
  }

  root.PortalPWA = {
    register: register,
    isStandalone: isStandalone,
    setBadge: setBadge,
    clearBadge: clearBadge,
    subscribePush: subscribePush,
    unsubscribePush: unsubscribePush
  };
})(window);
