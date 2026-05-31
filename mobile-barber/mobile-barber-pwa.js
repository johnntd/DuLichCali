/* Mobile Barber Vendor Portal — PWA + Web Push client helper
 *
 * Self-contained, additive module (does NOT touch the dashboard auth/gate or the
 * existing sound system — sound is already handled by unlockSoundAlerts() /
 * playBookingChime() in mobile-barber-dashboard.js).
 *
 * What this adds:
 *   - Registers the service worker (/mobile-barber/sw.js, scope /mobile-barber/).
 *   - "Enable Booking Alerts": requests Notification permission, subscribes to
 *     Web Push (VAPID) and stores the subscription scoped to the authenticated
 *     vendor. This is the iOS-compatible path (the dashboard's `new Notification()`
 *     only works foreground/desktop; iOS needs SW + Push, available once the
 *     portal is added to the Home Screen on iOS 16.4+).
 *   - Graceful fallback copy when push is unsupported (e.g. an iOS Safari tab).
 *
 * Security: the VAPID *public* key is safe to ship. Subscription writes target
 * mobileBarberVendors/{vendorId}/pushSubscriptions/{id}; Firestore rules restrict
 * writes to the authenticated vendor member, so customers can't self-register.
 */
(function (root) {
  'use strict';
  var doc = root.document;

  var VAPID_PUBLIC = 'BBHEU_YqwysrntO1a6JPvWn8YSQmKumg6fcgLipNPcOVC-0LbZc8SU-1q0Nf_ilI7B3pFs_OXPCf-ajrSO8c0V8';
  var SW_URL = '/mobile-barber/sw.js';
  var SW_SCOPE = '/mobile-barber/';
  var VENDOR_ID_KEY = 'dlc_mb_vendor_id';
  var swReg = null;

  function nav() { return root.navigator || {}; }
  function isStandalone() {
    try {
      return (root.matchMedia && root.matchMedia('(display-mode: standalone)').matches) || nav().standalone === true;
    } catch (e) { return false; }
  }
  function notifPermission() { return ('Notification' in root) ? root.Notification.permission : 'unsupported'; }
  function pushSupported() {
    return ('serviceWorker' in nav()) && ('PushManager' in root) && ('Notification' in root);
  }
  function vendorId() {
    try {
      var p = new root.URLSearchParams(root.location.search);
      var id = p.get('vendorId') || p.get('id') || '';
      if (id) { try { root.localStorage.setItem(VENDOR_ID_KEY, id); } catch (e) {} return id; }
      return root.localStorage.getItem(VENDOR_ID_KEY) || '';
    } catch (e) { return ''; }
  }
  function currentUser() {
    try { return (typeof root.firebase !== 'undefined' && root.firebase.auth) ? root.firebase.auth().currentUser : null; }
    catch (e) { return null; }
  }
  function urlBase64ToUint8Array(b64) {
    var padding = '='.repeat((4 - (b64.length % 4)) % 4);
    var base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = root.atob(base64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function hashEndpoint(ep) {
    var h = 5381, i = ep.length;
    while (i) { h = (h * 33) ^ ep.charCodeAt(--i); }
    return 'sub_' + (h >>> 0).toString(36);
  }

  function registerSW() {
    if (!('serviceWorker' in nav())) return Promise.resolve(null);
    return nav().serviceWorker.register(SW_URL, { scope: SW_SCOPE })
      .then(function (reg) { swReg = reg; return reg; })
      .catch(function () { return null; });
  }
  function readyReg() {
    if (swReg) return Promise.resolve(swReg);
    if (!('serviceWorker' in nav())) return Promise.resolve(null);
    return Promise.resolve(nav().serviceWorker.ready || registerSW())
      .then(function (r) { swReg = r || swReg; return swReg; })
      .catch(function () { return registerSW(); });
  }

  function storeSubscription(sub) {
    var vid = vendorId(), user = currentUser();
    if (!vid || !user || typeof root.firebase === 'undefined' || !root.firebase.firestore) {
      return Promise.reject(new Error('not_ready'));
    }
    var json = sub.toJSON();
    var id = hashEndpoint(json.endpoint || '');
    return root.firebase.firestore()
      .collection('mobileBarberVendors').doc(vid)
      .collection('pushSubscriptions').doc(id)
      .set({
        endpoint: json.endpoint || '',
        keys: json.keys || {},
        vendorId: vid,
        uid: user.uid,
        platform: isStandalone() ? 'home-screen' : 'browser',
        userAgent: (nav().userAgent || '').slice(0, 300),
        updatedAt: root.firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
  }

  function enableAlerts() {
    if (!pushSupported()) return Promise.resolve({ status: 'unsupported', standalone: isStandalone() });
    return root.Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') return { status: perm };
      return readyReg().then(function (reg) {
        if (!reg || !reg.pushManager) return { status: 'unsupported' };
        return reg.pushManager.getSubscription().then(function (existing) {
          if (existing) return existing;
          return reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC)
          });
        }).then(function (sub) {
          return storeSubscription(sub).then(function () { return { status: 'granted' }; });
        });
      });
    }).catch(function (e) { return { status: 'error', message: (e && e.message) || 'subscribe_failed' }; });
  }

  function t(en, vi, es) {
    var lang = '';
    try { lang = (root.localStorage && root.localStorage.getItem('dlc_lang')) || 'en'; } catch (e) { lang = 'en'; }
    return lang === 'vi' ? vi : (lang === 'es' ? es : en);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
  }); }

  // In-scope login screen (PWA-safe). The dashboard gate calls this in standalone
  // mode instead of redirecting to /vendor-login.html (which would leave scope and
  // lose the session). Email+password sign-in for already-registered vendors;
  // first-time PIN setup still uses the full /vendor-login.html. Persistence LOCAL.
  function showLogin(vendorId) {
    var existing = doc.getElementById('mbLoginOverlay');
    if (existing) { existing.style.display = 'flex'; return; }
    var ov = doc.createElement('div');
    ov.id = 'mbLoginOverlay';
    ov.setAttribute('style', 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;background:#061b33;');
    var inp = 'width:100%;box-sizing:border-box;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#08233f;color:#fff;font-size:1rem;';
    ov.innerHTML = '' +
      '<div style="width:100%;max-width:380px;background:#0c2c50;border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:26px 22px;box-shadow:0 24px 60px rgba(0,0,0,.45);font-family:Jost,system-ui,sans-serif;color:#eaf1fb;">' +
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">' +
          '<img src="/assets/icons/mobile-barber-vendor-192.png" alt="" width="44" height="44" style="border-radius:11px;">' +
          '<div><div style="font-weight:600;font-size:1.05rem;">' + esc(t('Barber Vendor Login', 'Đăng nhập Thợ Cắt Tóc', 'Acceso del barbero')) + '</div>' +
          '<div style="font-size:.82rem;opacity:.75;">' + esc(t('Sign in to manage your bookings.', 'Đăng nhập để quản lý lịch đặt.', 'Inicie sesión para gestionar reservas.')) + '</div></div>' +
        '</div>' +
        '<label style="display:block;font-size:.8rem;opacity:.85;margin:10px 0 4px;">' + esc(t('Email', 'Email', 'Correo')) + '</label>' +
        '<input id="mbLoginEmail" type="email" autocomplete="username" inputmode="email" autocapitalize="off" style="' + inp + '">' +
        '<label style="display:block;font-size:.8rem;opacity:.85;margin:12px 0 4px;">' + esc(t('Password', 'Mật khẩu', 'Contraseña')) + '</label>' +
        '<input id="mbLoginPassword" type="password" autocomplete="current-password" style="' + inp + '">' +
        '<p id="mbLoginError" style="display:none;color:#ffb3b3;font-size:.84rem;margin:10px 0 0;"></p>' +
        '<button id="mbLoginSubmit" type="button" style="width:100%;margin-top:18px;padding:13px;border:none;border-radius:11px;background:#f0be60;color:#08233f;font-weight:700;font-size:1rem;cursor:pointer;">' + esc(t('Sign in', 'Đăng nhập', 'Iniciar sesión')) + '</button>' +
        '<a id="mbLoginSetupLink" href="/vendor-login.html" style="display:block;text-align:center;margin-top:14px;font-size:.84rem;color:#8fb4e6;text-decoration:none;">' + esc(t('First time? Set up your account', 'Lần đầu? Thiết lập tài khoản', '¿Primera vez? Configure su cuenta')) + '</a>' +
      '</div>';
    doc.body.appendChild(ov);
    var setupLink = doc.getElementById('mbLoginSetupLink');
    if (setupLink && vendorId) setupLink.href = '/vendor-login.html?id=' + encodeURIComponent(vendorId);
    var emailEl = doc.getElementById('mbLoginEmail');
    var passEl = doc.getElementById('mbLoginPassword');
    var errEl = doc.getElementById('mbLoginError');
    var btn = doc.getElementById('mbLoginSubmit');
    function submit() {
      var email = (emailEl.value || '').trim(), pass = passEl.value || '';
      if (!email || !pass) { errEl.style.display = 'block'; errEl.textContent = t('Enter your email and password.', 'Nhập email và mật khẩu.', 'Ingrese correo y contraseña.'); return; }
      if (typeof root.firebase === 'undefined' || !root.firebase.auth) { errEl.style.display = 'block'; errEl.textContent = t('Login is unavailable right now.', 'Đăng nhập không khả dụng.', 'Acceso no disponible.'); return; }
      btn.disabled = true; errEl.style.display = 'none';
      var auth = root.firebase.auth();
      var P = root.firebase.auth.Auth.Persistence.LOCAL;
      Promise.resolve(auth.setPersistence ? auth.setPersistence(P) : null)
        .then(function () { return auth.signInWithEmailAndPassword(email, pass); })
        .then(function () { root.location.reload(); })
        .catch(function () {
          btn.disabled = false; errEl.style.display = 'block';
          errEl.textContent = t('Sign in failed. Check your email and password.', 'Đăng nhập thất bại. Kiểm tra lại email và mật khẩu.', 'Error al iniciar sesión. Verifique correo y contraseña.');
        });
    }
    btn.addEventListener('click', submit);
    passEl.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') submit(); });
    try { emailEl.focus(); } catch (e) {}
  }
  function setStatus(msg, tone) {
    var el = doc.getElementById('mbAlertsStatus');
    if (!el) return;
    el.textContent = msg;
    el.setAttribute('data-tone', tone || 'info');
  }
  function refreshStatus() {
    if (!pushSupported()) {
      setStatus(isStandalone()
        ? t('Push notifications are not available on this device. Keep this app open for live booking alerts.',
            'Thiết bị không hỗ trợ thông báo đẩy. Giữ ứng dụng mở để nhận thông báo trực tiếp.',
            'Las notificaciones push no están disponibles. Mantenga la app abierta para alertas en vivo.')
        : t('Add this portal to your Home Screen to enable push alerts (iOS 16.4+). Until then, keep it open for live alerts.',
            'Thêm cổng này vào Màn hình chính để bật thông báo đẩy (iOS 16.4+). Trong lúc đó, giữ mở để nhận thông báo.',
            'Agregue este portal a la pantalla de inicio para alertas push (iOS 16.4+). Mientras tanto, manténgalo abierto.'),
        'warn');
      return;
    }
    var p = notifPermission();
    if (p === 'granted') setStatus(t('Booking push alerts are on.', 'Thông báo đẩy đang bật.', 'Las alertas push están activadas.'), 'ok');
    else if (p === 'denied') setStatus(t('Push blocked. Enable notifications for this app in your settings.', 'Thông báo bị chặn. Bật trong cài đặt.', 'Push bloqueado. Actívelo en ajustes.'), 'warn');
    else setStatus(t('Tap “Enable Booking Alerts” to get notified of new bookings.', 'Nhấn “Bật Thông Báo Đặt Lịch”.', 'Toque “Activar alertas de reservas”.'), 'info');
  }
  function wireButton() {
    var btn = doc.getElementById('mbEnableAlertsBtn');
    if (btn) btn.textContent = t('Enable Booking Alerts', 'Bật Thông Báo Đặt Lịch', 'Activar alertas de reservas');
    if (btn && !btn._mbWired) {
      btn._mbWired = true;
      btn.addEventListener('click', function () {
        btn.disabled = true;
        setStatus(t('Requesting permission…', 'Đang yêu cầu quyền…', 'Solicitando permiso…'), 'info');
        enableAlerts().then(function (r) {
          btn.disabled = false;
          if (r.status === 'granted') setStatus(t('Booking alerts enabled ✓', 'Đã bật thông báo ✓', 'Alertas activadas ✓'), 'ok');
          else if (r.status === 'denied') setStatus(t('Permission denied. Enable notifications in settings.', 'Quyền bị từ chối. Bật trong cài đặt.', 'Permiso denegado. Actívelo en ajustes.'), 'warn');
          else if (r.status === 'unsupported') refreshStatus();
          else setStatus(t('Could not enable push. Keep the app open for live alerts.', 'Không thể bật. Giữ app mở để nhận thông báo.', 'No se pudo activar. Mantenga la app abierta.'), 'warn');
        });
      });
    }
    refreshStatus();
  }

  function init() { registerSW(); wireButton(); }

  root.MBVendorPWA = {
    init: init,
    isStandalone: isStandalone,
    pushSupported: pushSupported,
    permission: notifPermission,
    enableAlerts: enableAlerts,
    refreshStatus: refreshStatus,
    showLogin: showLogin
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
