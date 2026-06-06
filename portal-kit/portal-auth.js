(function (root) {
  'use strict';

  function noop() {}

  function enableLocalPersistence(firebaseAuth) {
    if (!firebaseAuth || typeof firebaseAuth.setPersistence !== 'function') return Promise.resolve(false);
    try {
      var persistence = root.firebase && root.firebase.auth && root.firebase.auth.Auth && root.firebase.auth.Auth.Persistence
        ? root.firebase.auth.Auth.Persistence.LOCAL
        : 'local';
      return Promise.resolve(firebaseAuth.setPersistence(persistence))
        .then(function () { return true; })
        .catch(function () { return false; });
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  function signOut(auth) {
    try {
      if (auth && typeof auth.signOut === 'function') {
        var result = auth.signOut();
        if (result && typeof result.then === 'function') return result.catch(noop);
      }
    } catch (e) {}
    return Promise.resolve();
  }

  function guard(options) {
    options = options || {};
    var auth = options.auth;
    var readContext = typeof options.readContext === 'function' ? options.readContext : null;
    var isValid = typeof options.isValid === 'function' ? options.isValid : null;
    var onReady = typeof options.onReady === 'function' ? options.onReady : noop;
    var onReject = typeof options.onReject === 'function' ? options.onReject : noop;
    var maxDelayMs = Math.max(1, Number(options.maxDelayMs) || 15000);
    var cancelled = false;
    var timer = null;
    var unsubscribe = noop;

    function stopTimer() {
      if (timer) {
        root.clearTimeout(timer);
        timer = null;
      }
    }

    function reject(reason) {
      if (cancelled) return;
      stopTimer();
      onReject(reason);
    }

    function run(user, attempt) {
      if (cancelled || !readContext || !isValid) return;
      Promise.resolve()
        .then(function () { return readContext(user); })
        .then(function (data) {
          if (cancelled) return;
          var verdict = isValid(data, user);
          if (typeof verdict === 'string') {
            signOut(auth).then(function () { reject(verdict); });
            return;
          }
          if (verdict) {
            stopTimer();
            onReady(data, user);
            return;
          }
          signOut(auth).then(function () { reject('invalid'); });
        })
        .catch(function () {
          if (cancelled) return;
          var delay = Math.min(maxDelayMs, 600 * Math.pow(2, Math.max(0, attempt)));
          timer = root.setTimeout(function () {
            timer = null;
            run(user, attempt + 1);
          }, delay);
        });
    }

    if (!auth || typeof auth.onAuthStateChanged !== 'function') {
      reject('auth_unavailable');
      return noop;
    }

    try {
      unsubscribe = auth.onAuthStateChanged(function (user) {
        try { unsubscribe(); } catch (e) {}
        if (cancelled) return;
        if (!user) {
          reject('no_user');
          return;
        }
        run(user, 0);
      });
    } catch (e) {
      reject('auth_unavailable');
    }

    return function cancelGuard() {
      cancelled = true;
      stopTimer();
      try { unsubscribe(); } catch (e) {}
    };
  }

  root.PortalAuth = {
    enableLocalPersistence: enableLocalPersistence,
    guard: guard
  };
})(window);
