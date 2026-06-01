'use strict';

(function(root) {
  var DATA = root.MobileBarberData || {};
  var BOOKING = root.MobileBarberBooking || {};
  var AIP = root.MobileBarberAIPreview || {};
  var doc = root.document;
  var VAPID_PUBLIC = 'BBHEU_YqwysrntO1a6JPvWn8YSQmKumg6fcgLipNPcOVC-0LbZc8SU-1q0Nf_ilI7B3pFs_OXPCf-ajrSO8c0V8';
  var SW_URL = '/mobile-barber/sw.js';
  var SW_SCOPE = '/mobile-barber/';

  var STRINGS = {
    en: {
      account: 'Account',
      login: 'Log in',
      signup: 'Create account',
      logout: 'Log out',
      name: 'Name',
      phone: 'Phone number',
      email: 'Email optional',
      password: 'Password',
      forgot: 'Reset password',
      accountTitle: 'Mobile Barber account',
      accountIntro: 'Use your phone number to track bookings, save AI styles, and receive appointment updates.',
      passwordHelp: 'Use at least 12 characters with upper and lower case letters, a number, and a symbol.',
      weakPassword: 'Password is too weak.',
      commonPassword: 'Choose a less common password.',
      strengthWeak: 'Weak',
      strengthOk: 'Good',
      strengthStrong: 'Strong',
      authFailed: 'Account action failed. Check your phone and password.',
      resetSent: 'If this account has an email address, a reset email was sent.',
      loggedInAs: 'Logged in as {phone}',
      loginForAi: 'Log in to try AI hairstyle preview',
      aiLockedTitle: 'AI hairstyle preview is for logged-in customers',
      aiLockedCopy: 'Create an account to generate previews, save styles, and attach a style to your booking.',
      saveStyle: 'Save style',
      styleSaved: 'Style saved.',
      historyTitle: 'My bookings',
      bookHaircut: 'Book a haircut',
      upcoming: 'Upcoming',
      past: 'Past',
      noBookings: 'No bookings yet.',
      notifications: 'Notifications',
      markRead: 'Mark read',
      close: 'Close',
      noNotifications: 'No notifications yet.',
      enableNotifications: 'Enable Notifications',
      pushUnsupported: 'Keep app open or check notifications here.',
      pushEnabled: 'Notifications enabled.',
      pushDenied: 'Notifications are blocked in settings.',
      reminderTitle: 'Haircut reminders',
      reminderWeeks: 'Reminder timing',
      reminder3: '3 weeks',
      reminder4: '4 weeks',
      reminder6: '6 weeks',
      reminderOff: 'Off',
      reminderSaved: 'Reminder preference saved.',
      bookAgain: 'Book again',
      remindLater: 'Remind me later',
      turnOffReminders: 'Turn off reminders',
      bookingAccountPrompt: 'Create an account to track this booking and receive updates?'
    },
    vi: {
      account: 'Tài khoản',
      login: 'Đăng nhập',
      signup: 'Tạo tài khoản',
      logout: 'Đăng xuất',
      name: 'Tên',
      phone: 'Số điện thoại',
      email: 'Email không bắt buộc',
      password: 'Mật khẩu',
      forgot: 'Đặt lại mật khẩu',
      accountTitle: 'Tài khoản Mobile Barber',
      accountIntro: 'Dùng số điện thoại để theo dõi lịch, lưu kiểu tóc AI và nhận cập nhật.',
      passwordHelp: 'Dùng ít nhất 12 ký tự gồm chữ hoa, chữ thường, số và ký hiệu.',
      weakPassword: 'Mật khẩu quá yếu.',
      commonPassword: 'Vui lòng chọn mật khẩu ít phổ biến hơn.',
      strengthWeak: 'Yếu',
      strengthOk: 'Tốt',
      strengthStrong: 'Mạnh',
      authFailed: 'Không thể xử lý tài khoản. Kiểm tra số điện thoại và mật khẩu.',
      resetSent: 'Nếu tài khoản có email, email đặt lại mật khẩu đã được gửi.',
      loggedInAs: 'Đã đăng nhập: {phone}',
      loginForAi: 'Đăng nhập để thử kiểu tóc AI',
      aiLockedTitle: 'Tính năng kiểu tóc AI dành cho khách đã đăng nhập',
      aiLockedCopy: 'Tạo tài khoản để tạo hình thử, lưu kiểu tóc và đính kèm vào lịch đặt.',
      saveStyle: 'Lưu kiểu',
      styleSaved: 'Đã lưu kiểu tóc.',
      historyTitle: 'Lịch đặt của tôi',
      bookHaircut: 'Đặt lịch cắt tóc',
      upcoming: 'Sắp tới',
      past: 'Đã qua',
      noBookings: 'Chưa có lịch đặt.',
      notifications: 'Thông báo',
      markRead: 'Đánh dấu đã đọc',
      close: 'Đóng',
      noNotifications: 'Chưa có thông báo.',
      enableNotifications: 'Bật thông báo',
      pushUnsupported: 'Hãy giữ app mở hoặc kiểm tra thông báo tại đây.',
      pushEnabled: 'Đã bật thông báo.',
      pushDenied: 'Thông báo bị chặn trong cài đặt.',
      reminderTitle: 'Nhắc cắt tóc',
      reminderWeeks: 'Thời gian nhắc',
      reminder3: '3 tuần',
      reminder4: '4 tuần',
      reminder6: '6 tuần',
      reminderOff: 'Tắt',
      reminderSaved: 'Đã lưu tuỳ chọn nhắc.',
      bookAgain: 'Đặt lại',
      remindLater: 'Nhắc sau',
      turnOffReminders: 'Tắt nhắc nhở',
      bookingAccountPrompt: 'Tạo tài khoản để theo dõi lịch này và nhận cập nhật?'
    },
    es: {
      account: 'Cuenta',
      login: 'Iniciar sesión',
      signup: 'Crear cuenta',
      logout: 'Cerrar sesión',
      name: 'Nombre',
      phone: 'Teléfono',
      email: 'Email opcional',
      password: 'Contraseña',
      forgot: 'Restablecer contraseña',
      accountTitle: 'Cuenta de Mobile Barber',
      accountIntro: 'Use su teléfono para seguir reservas, guardar estilos IA y recibir actualizaciones.',
      passwordHelp: 'Use al menos 12 caracteres con mayúsculas, minúsculas, número y símbolo.',
      weakPassword: 'La contraseña es muy débil.',
      commonPassword: 'Elija una contraseña menos común.',
      strengthWeak: 'Débil',
      strengthOk: 'Buena',
      strengthStrong: 'Fuerte',
      authFailed: 'No se pudo completar la acción. Revise teléfono y contraseña.',
      resetSent: 'Si esta cuenta tiene email, se envió un correo de restablecimiento.',
      loggedInAs: 'Sesión iniciada como {phone}',
      loginForAi: 'Iniciar sesión para probar vista previa IA',
      aiLockedTitle: 'La vista previa IA es para clientes conectados',
      aiLockedCopy: 'Cree una cuenta para generar vistas, guardar estilos y adjuntar un estilo a su reserva.',
      saveStyle: 'Guardar estilo',
      styleSaved: 'Estilo guardado.',
      historyTitle: 'Mis reservas',
      bookHaircut: 'Reservar un corte',
      upcoming: 'Próximas',
      past: 'Pasadas',
      noBookings: 'Aún no hay reservas.',
      notifications: 'Notificaciones',
      markRead: 'Marcar leída',
      close: 'Cerrar',
      noNotifications: 'Aún no hay notificaciones.',
      enableNotifications: 'Activar notificaciones',
      pushUnsupported: 'Mantenga la app abierta o revise notificaciones aquí.',
      pushEnabled: 'Notificaciones activadas.',
      pushDenied: 'Las notificaciones están bloqueadas en ajustes.',
      reminderTitle: 'Recordatorios de corte',
      reminderWeeks: 'Tiempo del recordatorio',
      reminder3: '3 semanas',
      reminder4: '4 semanas',
      reminder6: '6 semanas',
      reminderOff: 'Apagado',
      reminderSaved: 'Preferencia de recordatorio guardada.',
      bookAgain: 'Reservar otra vez',
      remindLater: 'Recordarme después',
      turnOffReminders: 'Desactivar recordatorios',
      bookingAccountPrompt: '¿Crear una cuenta para seguir esta reserva y recibir actualizaciones?'
    }
  };

  var state = {
    lang: 'en',
    user: null,
    profile: null,
    notifications: [],
    bookings: [],
    unsubNotifications: null,
    unsubBookings: null,
    originalGenerate: AIP.generate || null,
    originalBuildBooking: BOOKING.buildBooking || null
  };

  function lang() {
    try { return root.localStorage.getItem('dlc_lang') || root.localStorage.getItem('dlcLang') || doc.documentElement.lang || 'en'; }
    catch (e) { return 'en'; }
  }
  function t(key, values) {
    state.lang = STRINGS[lang()] ? lang() : 'en';
    var s = (STRINGS[state.lang] && STRINGS[state.lang][key]) || STRINGS.en[key] || key;
    Object.keys(values || {}).forEach(function(k) { s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), values[k]); });
    return s;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
  }); }
  function normalizePhone(phone) {
    var d = String(phone || '').replace(/\D/g, '');
    if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
    return d.slice(-10);
  }
  function customerEmailForPhone(phone) {
    return normalizePhone(phone) + '@mobile-barber.dulichcali21.local';
  }
  function isCustomerUser(user) {
    user = user || state.user;
    return !!(user && !user.isAnonymous && user.uid);
  }
  function db() { return root.firebase && root.firebase.firestore ? root.firebase.firestore() : null; }
  function auth() { return root.firebase && root.firebase.auth ? root.firebase.auth() : null; }
  function serverTimestamp() {
    return root.firebase.firestore.FieldValue.serverTimestamp();
  }

  function passwordScore(pass) {
    pass = String(pass || '');
    var common = /^(password|password123|123456789012|qwerty123456|iloveyou123|abc123456789)$/i.test(pass);
    var score = 0;
    if (pass.length >= 12) score++;
    if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score++;
    if (/\d/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    if (pass.length >= 16) score++;
    if (common) score = 0;
    return { score: score, common: common, ok: score >= 4 && !common };
  }

  function renderChrome() {
    if (doc.getElementById('mbCustomerBar')) return;
    var bar = doc.createElement('div');
    bar.id = 'mbCustomerBar';
    bar.className = 'mb-customer-bar';
    bar.innerHTML =
      '<button class="mb-icon-button mb-customer-bell" type="button" id="mbCustomerBell" aria-label="' + esc(t('notifications')) + '">' +
        '<span class="mb-ico" data-mb-ico="bell" aria-hidden="true"></span><span class="mb-customer-badge" id="mbCustomerBadge" hidden>0</span>' +
      '</button>' +
      '<button class="mb-button mb-button--ghost mb-button--sm" type="button" id="mbCustomerAccountBtn">' + esc(t('account')) + '</button>';
    var langNode = doc.getElementById('mbLanguage');
    if (langNode && langNode.parentNode) langNode.parentNode.insertBefore(bar, langNode.nextSibling);
    else doc.body.appendChild(bar);
    doc.getElementById('mbCustomerAccountBtn').addEventListener('click', openAccountPanel);
    doc.getElementById('mbCustomerBell').addEventListener('click', openNotificationsPanel);
  }

  function panelShell(id, titleKey) {
    var old = doc.getElementById(id);
    if (old) old.remove();
    var panel = doc.createElement('section');
    panel.id = id;
    panel.className = 'mb-customer-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.innerHTML =
      '<div class="mb-customer-panel__card">' +
        '<button class="mb-customer-panel__close" type="button" aria-label="' + esc(t('close')) + '">×</button>' +
        '<h2>' + esc(t(titleKey)) + '</h2>' +
        '<div class="mb-customer-panel__body"></div>' +
      '</div>';
    panel.querySelector('.mb-customer-panel__close').addEventListener('click', function() { panel.remove(); });
    doc.body.appendChild(panel);
    return panel.querySelector('.mb-customer-panel__body');
  }

  function authForm(mode) {
    var body = panelShell('mbCustomerAccountPanel', 'accountTitle');
    var signedIn = isCustomerUser();
    if (signedIn) {
      body.innerHTML =
        '<p class="mb-customer-muted">' + esc(t('loggedInAs', { phone: state.profile && state.profile.phone || state.user.email || '' })) + '</p>' +
        '<div class="mb-customer-actions">' +
          '<button class="mb-button mb-button--primary" type="button" id="mbCustomerBookBtn">' + esc(t('bookHaircut')) + '</button>' +
        '</div>' +
        '<div class="mb-customer-actions">' +
          '<button class="mb-button mb-button--ghost" type="button" id="mbCustomerHistoryBtn">' + esc(t('historyTitle')) + '</button>' +
          '<button class="mb-button mb-button--ghost" type="button" id="mbCustomerLogoutBtn">' + esc(t('logout')) + '</button>' +
        '</div>' +
        reminderHtml();
      // The clear "next step" after sign-up/login: close the account panel and jump to
      // the service list so the customer can actually book (fixes the dead-end where the
      // panel ended at the reminder dropdown with nowhere to go).
      body.querySelector('#mbCustomerBookBtn').addEventListener('click', function() {
        var panel = body.closest('.mb-customer-panel'); if (panel) panel.remove();
        var svc = doc.getElementById('mbServices');
        if (svc && svc.scrollIntoView) svc.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      body.querySelector('#mbCustomerLogoutBtn').addEventListener('click', function() { auth().signOut(); });
      body.querySelector('#mbCustomerHistoryBtn').addEventListener('click', openHistoryPanel);
      wireReminder(body);
      return;
    }
    body.innerHTML =
      '<p class="mb-customer-muted">' + esc(t('accountIntro')) + '</p>' +
      '<form class="mb-customer-form" id="mbCustomerAuthForm">' +
        (mode === 'signup' ? '<label>' + esc(t('name')) + '<input name="name" autocomplete="name"></label>' : '') +
        '<label>' + esc(t('phone')) + '<input name="phone" inputmode="tel" autocomplete="tel" required></label>' +
        (mode === 'signup' ? '<label>' + esc(t('email')) + '<input name="email" type="email" autocomplete="email"></label>' : '') +
        '<label>' + esc(t('password')) + '<input name="password" type="password" autocomplete="' + (mode === 'signup' ? 'new-password' : 'current-password') + '" required></label>' +
        '<meter class="mb-customer-strength" min="0" max="5" low="2" high="4" optimum="5" value="0"></meter>' +
        '<p class="mb-customer-muted" id="mbCustomerStrengthText">' + esc(t('passwordHelp')) + '</p>' +
        '<p class="mb-customer-error" id="mbCustomerAuthError" hidden></p>' +
        '<button class="mb-button mb-button--primary" type="submit">' + esc(mode === 'signup' ? t('signup') : t('login')) + '</button>' +
      '</form>' +
      '<div class="mb-customer-actions">' +
        '<button class="mb-button mb-button--ghost mb-button--sm" type="button" id="mbCustomerSwitchMode">' + esc(mode === 'signup' ? t('login') : t('signup')) + '</button>' +
        '<button class="mb-button mb-button--ghost mb-button--sm" type="button" id="mbCustomerResetBtn">' + esc(t('forgot')) + '</button>' +
      '</div>';
    var form = body.querySelector('#mbCustomerAuthForm');
    var pass = form.querySelector('[name="password"]');
    pass.addEventListener('input', function() { updateStrength(form); });
    body.querySelector('#mbCustomerSwitchMode').addEventListener('click', function() { authForm(mode === 'signup' ? 'login' : 'signup'); });
    body.querySelector('#mbCustomerResetBtn').addEventListener('click', function() { resetPassword(form); });
    form.addEventListener('submit', function(ev) {
      ev.preventDefault();
      if (mode === 'signup') signup(form);
      else login(form);
    });
  }

  function updateStrength(form) {
    var pass = form.querySelector('[name="password"]').value;
    var meter = form.querySelector('.mb-customer-strength');
    var text = form.querySelector('#mbCustomerStrengthText');
    var score = passwordScore(pass);
    meter.value = score.score;
    text.textContent = score.common ? t('commonPassword') : (score.score >= 4 ? t('strengthStrong') : (score.score >= 3 ? t('strengthOk') : t('strengthWeak')));
  }
  function showAuthError(form, msg) {
    var node = form.querySelector('#mbCustomerAuthError');
    node.hidden = false;
    node.textContent = msg;
  }
  function formData(form) {
    var out = {};
    Array.prototype.forEach.call(form.elements, function(el) {
      if (el.name) out[el.name] = String(el.value || '').trim();
    });
    return out;
  }
  function ensureAuthReady() {
    var a = auth();
    if (!a) return Promise.reject(new Error('auth_unavailable'));
    var P = root.firebase.auth.Auth.Persistence.LOCAL;
    return Promise.resolve(a.setPersistence ? a.setPersistence(P) : null).then(function() { return a; });
  }
  function profilePayload(uid, data) {
    var phone = data.phone || '';
    var normalized = normalizePhone(phone);
    return {
      id: uid,
      customerId: uid,
      customerUid: uid,
      phone: phone,
      normalizedPhone: normalized,
      customerPhone: phone,
      customerPhoneNormalized: normalized,
      name: data.name || '',
      customerName: data.name || '',
      email: data.email || '',
      customerEmail: data.email || '',
      preferredLanguage: lang(),
      preferredAddress: data.preferredAddress || '',
      savedAddresses: data.savedAddresses || [],
      bookingHistory: data.bookingHistory || [],
      preferredBarber: data.preferredBarber || '',
      haircutPreferences: data.haircutPreferences || {},
      notificationPreferences: data.notificationPreferences || { app: true, push: false, reminders: true },
      reminderPreferenceWeeks: data.reminderPreferenceWeeks || 4,
      createdAt: data.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp()
    };
  }
  function saveProfile(uid, data) {
    return db().collection('mobileBarberCustomers').doc(uid).set(profilePayload(uid, data), { merge: true });
  }
  function signup(form) {
    var data = formData(form);
    var score = passwordScore(data.password);
    if (!score.ok) { showAuthError(form, score.common ? t('commonPassword') : t('weakPassword')); return; }
    ensureAuthReady().then(function(a) {
      return a.createUserWithEmailAndPassword(customerEmailForPhone(data.phone), data.password);
    }).then(function(cred) {
      state.user = cred.user;
      return saveProfile(cred.user.uid, data);
    }).then(function() { openAccountPanel(); })
      .catch(function() { showAuthError(form, t('authFailed')); });
  }
  function login(form) {
    var data = formData(form);
    ensureAuthReady().then(function(a) {
      return a.signInWithEmailAndPassword(customerEmailForPhone(data.phone), data.password);
    }).then(function() { openAccountPanel(); })
      .catch(function() { showAuthError(form, t('authFailed')); });
  }
  function resetPassword(form) {
    var data = formData(form);
    var email = data.email || customerEmailForPhone(data.phone);
    ensureAuthReady().then(function(a) { return a.sendPasswordResetEmail(email); })
      .catch(function() {})
      .then(function() {
        var err = form.querySelector('#mbCustomerAuthError');
        err.hidden = false;
        err.textContent = t('resetSent');
      });
  }
  function openAccountPanel() { authForm(isCustomerUser() ? 'signedin' : 'login'); }

  function reminderHtml() {
    var current = state.profile && state.profile.reminderPreferenceWeeks;
    return '<div class="mb-customer-reminders">' +
      '<h3>' + esc(t('reminderTitle')) + '</h3>' +
      '<label>' + esc(t('reminderWeeks')) +
        '<select id="mbReminderWeeks">' +
          '<option value="3"' + (current === 3 ? ' selected' : '') + '>' + esc(t('reminder3')) + '</option>' +
          '<option value="4"' + (!current || current === 4 ? ' selected' : '') + '>' + esc(t('reminder4')) + '</option>' +
          '<option value="6"' + (current === 6 ? ' selected' : '') + '>' + esc(t('reminder6')) + '</option>' +
          '<option value="0"' + (current === 0 ? ' selected' : '') + '>' + esc(t('reminderOff')) + '</option>' +
        '</select>' +
      '</label>' +
      '<p class="mb-customer-muted" id="mbReminderStatus"></p>' +
    '</div>';
  }
  function wireReminder(body) {
    var sel = body.querySelector('#mbReminderWeeks');
    if (!sel || !isCustomerUser()) return;
    sel.addEventListener('change', function() {
      var weeks = Number(sel.value || 0);
      var payload = {
        id: state.user.uid,
        customerId: state.user.uid,
        reminderPreferenceWeeks: weeks,
        enabled: weeks > 0,
        updatedAt: serverTimestamp()
      };
      db().collection('customerReminderPreferences').doc(state.user.uid).set(payload, { merge: true });
      db().collection('mobileBarberCustomers').doc(state.user.uid).set({
        reminderPreferenceWeeks: weeks,
        'notificationPreferences.reminders': weeks > 0,
        updatedAt: serverTimestamp()
      }, { merge: true });
      body.querySelector('#mbReminderStatus').textContent = t('reminderSaved');
    });
  }

  function openHistoryPanel() {
    var body = panelShell('mbCustomerHistoryPanel', 'historyTitle');
    body.innerHTML = historyHtml();
  }
  function historyHtml() {
    if (!state.bookings.length) return '<p class="mb-customer-muted">' + esc(t('noBookings')) + '</p>';
    var upcoming = [], past = [];
    state.bookings.forEach(function(b) {
      if (['completed', 'cancelled', 'declined', 'rejected'].indexOf(String(b.status || '').toLowerCase()) >= 0) past.push(b);
      else upcoming.push(b);
    });
    return bookingListHtml(t('upcoming'), upcoming) + bookingListHtml(t('past'), past);
  }
  function bookingListHtml(label, rows) {
    return '<h3>' + esc(label) + '</h3>' + (rows.length ? rows.map(function(b) {
      return '<article class="mb-customer-booking" id="booking-' + esc(b.id || '') + '">' +
        '<strong>' + esc(b.serviceName || '') + '</strong>' +
        '<span>' + esc([b.requestedDate, b.startTime, b.status].filter(Boolean).join(' · ')) + '</span>' +
        '<span>' + esc([b.assignedBarberId || b.vendorId, b.address, b.totalPrice ? '$' + b.totalPrice : ''].filter(Boolean).join(' · ')) + '</span>' +
      '</article>';
    }).join('') : '<p class="mb-customer-muted">' + esc(t('noBookings')) + '</p>');
  }

  function openNotificationsPanel() {
    var body = panelShell('mbCustomerNotificationsPanel', 'notifications');
    body.innerHTML =
      '<button class="mb-button mb-button--primary mb-button--sm" type="button" id="mbEnableCustomerPush">' + esc(t('enableNotifications')) + '</button>' +
      '<p class="mb-customer-muted" id="mbCustomerPushStatus"></p>' +
      '<div class="mb-customer-notification-list">' + notificationsHtml() + '</div>';
    body.querySelector('#mbEnableCustomerPush').addEventListener('click', enablePush);
    // Wire clicks on the FIRST render too (not only on later refreshes) so tapping a
    // notification opens its booking immediately.
    wireNotificationClicks(body.querySelector('.mb-customer-notification-list'));
  }
  function notificationsHtml() {
    if (!state.notifications.length) return '<p class="mb-customer-muted">' + esc(t('noNotifications')) + '</p>';
    return state.notifications.map(function(n) {
      return '<article class="mb-customer-notification' + (n.read ? '' : ' mb-customer-notification--unread') + '" data-id="' + esc(n.id || '') + '" data-booking-id="' + esc(n.bookingId || '') + '">' +
        '<button type="button" class="mb-customer-notification__open">' +
          '<strong>' + esc(n.title || '') + '</strong><span>' + esc(n.body || '') + '</span>' +
        '</button>' +
        (n.read ? '' : '<button type="button" class="mb-button mb-button--ghost mb-button--sm mb-customer-notification__read">' + esc(t('markRead')) + '</button>') +
      '</article>';
    }).join('');
  }
  function refreshNotificationsPanel() {
    var list = doc.querySelector('#mbCustomerNotificationsPanel .mb-customer-notification-list');
    if (list) {
      list.innerHTML = notificationsHtml();
      wireNotificationClicks(list);
    }
    var badge = doc.getElementById('mbCustomerBadge');
    var count = state.notifications.filter(function(n) { return !n.read; }).length;
    if (badge) { badge.hidden = count <= 0; badge.textContent = String(count); }
  }
  function wireNotificationClicks(rootNode) {
    Array.prototype.forEach.call(rootNode.querySelectorAll('.mb-customer-notification'), function(row) {
      var id = row.getAttribute('data-id');
      var bookingId = row.getAttribute('data-booking-id');
      var open = row.querySelector('.mb-customer-notification__open');
      var mark = row.querySelector('.mb-customer-notification__read');
      if (open) open.addEventListener('click', function() {
        markRead(id);
        openHistoryPanel();
        setTimeout(function() {
          var target = doc.getElementById('booking-' + bookingId);
          if (target && target.scrollIntoView) target.scrollIntoView({ block: 'center' });
        }, 40);
      });
      if (mark) mark.addEventListener('click', function() { markRead(id); });
    });
  }
  function markRead(id) {
    if (!id || !isCustomerUser()) return;
    db().collection('customerNotifications').doc(id).set({ read: true, updatedAt: serverTimestamp() }, { merge: true });
  }
  function toast(msg) {
    var node = doc.createElement('div');
    node.className = 'mb-customer-toast';
    node.textContent = msg;
    doc.body.appendChild(node);
    setTimeout(function() { node.remove(); }, 4200);
  }

  function registerSW() {
    var nav = root.navigator || {};
    if (!('serviceWorker' in nav)) return Promise.resolve(null);
    return nav.serviceWorker.register(SW_URL, { scope: SW_SCOPE }).catch(function() { return null; });
  }
  function pushSupported() {
    var nav = root.navigator || {};
    return ('serviceWorker' in nav) && ('PushManager' in root) && ('Notification' in root);
  }
  function urlBase64ToUint8Array(b64) {
    var padding = '='.repeat((4 - (b64.length % 4)) % 4);
    var raw = root.atob((b64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function hashEndpoint(ep) {
    var h = 5381, i = ep.length;
    while (i) h = (h * 33) ^ ep.charCodeAt(--i);
    return 'sub_' + (h >>> 0).toString(36);
  }
  function enablePush() {
    var status = doc.getElementById('mbCustomerPushStatus');
    if (!isCustomerUser() || !pushSupported()) { if (status) status.textContent = t('pushUnsupported'); return; }
    root.Notification.requestPermission().then(function(perm) {
      if (perm !== 'granted') { if (status) status.textContent = t('pushDenied'); return null; }
      return registerSW().then(function() { return root.navigator.serviceWorker.ready; })
        .then(function(reg) {
          return reg.pushManager.getSubscription().then(function(existing) {
            return existing || reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC)
            });
          });
        })
        .then(function(sub) {
          var json = sub.toJSON();
          return db().collection('mobileBarberCustomers').doc(state.user.uid)
            .collection('pushSubscriptions').doc(hashEndpoint(json.endpoint || '')).set({
              endpoint: json.endpoint || '',
              keys: json.keys || {},
              customerId: state.user.uid,
              platform: ((root.matchMedia && root.matchMedia('(display-mode: standalone)').matches) || root.navigator.standalone) ? 'home-screen' : 'browser',
              updatedAt: serverTimestamp()
            }, { merge: true });
        })
        .then(function() { if (status) status.textContent = t('pushEnabled'); });
    }).catch(function() { if (status) status.textContent = t('pushUnsupported'); });
  }

  function setupAiGate() {
    if (AIP && typeof AIP.generate === 'function' && !AIP._customerGateWrapped) {
      state.originalGenerate = AIP.generate;
      AIP.generate = function(opts) {
        if (!isCustomerUser()) {
          openAccountPanel();
          return Promise.resolve({ ok: false, code: 'login_required', message: t('loginForAi') });
        }
        return state.originalGenerate.call(AIP, opts);
      };
      AIP._customerGateWrapped = true;
    }
    refreshAiGateUi();
  }
  function refreshAiGateUi() {
    var box = doc.getElementById('mbHomeAiPreviewBox');
    if (!box) return;
    var old = doc.getElementById('mbAiLoginGate');
    if (old) old.remove();
    box.classList.toggle('mb-ai-preview--locked', !isCustomerUser());
    if (isCustomerUser()) return;
    var gate = doc.createElement('div');
    gate.id = 'mbAiLoginGate';
    gate.className = 'mb-ai-login-gate';
    gate.innerHTML = '<strong>' + esc(t('aiLockedTitle')) + '</strong><p>' + esc(t('aiLockedCopy')) + '</p><button class="mb-button mb-button--primary" type="button">' + esc(t('loginForAi')) + '</button>';
    gate.querySelector('button').addEventListener('click', openAccountPanel);
    box.appendChild(gate);
  }
  function addSaveStyleButtons() {
    if (!isCustomerUser()) return;
    Array.prototype.forEach.call(doc.querySelectorAll('.mb-ai-rec-card'), function(card) {
      if (card.querySelector('.mb-ai-rec-card__save')) return;
      var styleId = card.getAttribute('data-style-id') || '';
      var actions = card.querySelector('.mb-ai-rec-card__actions');
      if (!actions || !styleId) return;
      var btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'mb-button mb-button--ghost mb-button--sm mb-ai-rec-card__save';
      btn.textContent = t('saveStyle');
      btn.addEventListener('click', function() { saveStyleFromCard(card, styleId); });
      actions.appendChild(btn);
    });
  }
  function saveStyleFromCard(card, styleId) {
    var img = card.querySelector('img');
    var title = card.querySelector('.mb-ai-rec-card__title');
    var desc = card.querySelector('.mb-ai-rec-card__desc');
    var payload = {
      id: state.user.uid + '_' + styleId,
      customerId: state.user.uid,
      styleId: styleId,
      title: title ? title.textContent : '',
      previewUrl: img ? img.src : '',
      description: desc ? desc.textContent : '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    db().collection('customerSavedStyles').doc(payload.id).set(payload, { merge: true })
      .then(function() { toast(t('styleSaved')); });
  }

  function patchBookingBuilder() {
    if (!BOOKING || typeof BOOKING.buildBooking !== 'function' || BOOKING._customerWrapped) return;
    state.originalBuildBooking = BOOKING.buildBooking;
    BOOKING.buildBooking = function(input) {
      input = input || {};
      if (isCustomerUser()) {
        input.draft = Object.assign({}, input.draft || {}, {
          customerUid: state.user.uid,
          customerId: state.user.uid,
          normalizedPhone: state.profile && state.profile.normalizedPhone,
          customerProfileSnapshot: {
            customerId: state.user.uid,
            phone: state.profile && state.profile.phone || '',
            normalizedPhone: state.profile && state.profile.normalizedPhone || '',
            name: state.profile && state.profile.name || '',
            preferredLanguage: lang(),
            preferredBarber: state.profile && state.profile.preferredBarber || '',
            haircutPreferences: state.profile && state.profile.haircutPreferences || {}
          }
        });
      }
      var built = state.originalBuildBooking.call(BOOKING, input);
      if (built && built.booking && isCustomerUser()) {
        built.booking.customerId = state.user.uid;
        built.booking.normalizedPhone = state.profile && state.profile.normalizedPhone || normalizePhone(built.booking.customerPhone);
        built.booking.customerProfileSnapshot = input.draft.customerProfileSnapshot || {};
      }
      return built;
    };
    BOOKING._customerWrapped = true;
  }

  function subscribeCustomer(user) {
    if (state.unsubNotifications) state.unsubNotifications();
    if (state.unsubBookings) state.unsubBookings();
    state.notifications = [];
    state.bookings = [];
    if (!isCustomerUser(user) || !db()) { refreshNotificationsPanel(); return; }
    db().collection('mobileBarberCustomers').doc(user.uid).onSnapshot(function(snap) {
      state.profile = snap.exists ? snap.data() : null;
      renderAccountButton();
      patchBookingBuilder();
    }, function(e) { if (root.console && root.console.warn) root.console.warn('[mb-customer] profile listener', e && e.code); });
    state.unsubNotifications = db().collection('customerNotifications')
      .where('customerId', '==', user.uid)
      .limit(50)
      .onSnapshot(function(qs) {
        var previousUnread = state.notifications.filter(function(n) { return !n.read; }).length;
        state.notifications = [];
        qs.forEach(function(d) { state.notifications.push(Object.assign({ id: d.id }, d.data() || {})); });
        state.notifications.sort(function(a, b) { return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); });
        refreshNotificationsPanel();
        var unread = state.notifications.filter(function(n) { return !n.read; }).length;
        if (unread > previousUnread && state.notifications[0]) toast(state.notifications[0].body || state.notifications[0].title || t('notifications'));
      }, function(e) { if (root.console && root.console.warn) root.console.warn('[mb-customer] notifications listener', e && e.code); });
    state.unsubBookings = db().collection('mobileBarberBookings')
      .where('customerId', '==', user.uid)
      .limit(50)
      .onSnapshot(function(qs) {
        state.bookings = [];
        qs.forEach(function(d) { state.bookings.push(Object.assign({ id: d.id }, d.data() || {})); });
        state.bookings.sort(function(a, b) { return String(b.requestedDate || '').localeCompare(String(a.requestedDate || '')); });
      }, function(e) { if (root.console && root.console.warn) root.console.warn('[mb-customer] bookings listener', e && e.code); });
  }
  function renderAccountButton() {
    var btn = doc.getElementById('mbCustomerAccountBtn');
    if (!btn) return;
    btn.textContent = isCustomerUser() ? t('account') : t('login');
    btn.setAttribute('title', isCustomerUser() ? t('loggedInAs', { phone: state.profile && state.profile.phone || '' }) : t('login'));
  }

  function initAuth() {
    var a = auth();
    if (!a) return;
    ensureAuthReady().catch(function() {});
    a.onAuthStateChanged(function(user) {
      state.user = user || null;
      if (isCustomerUser(user)) {
        subscribeCustomer(user);
      } else {
        state.profile = null;
        subscribeCustomer(null);
      }
      renderAccountButton();
      setupAiGate();
    });
  }

  function init() {
    renderChrome();
    registerSW();
    setupAiGate();
    patchBookingBuilder();
    initAuth();
    setInterval(addSaveStyleButtons, 1200);
    if (new URLSearchParams(root.location.search).get('panel') === 'notifications') openNotificationsPanel();
  }

  root.MobileBarberCustomer = {
    init: init,
    normalizePhone: normalizePhone,
    passwordScore: passwordScore,
    isCustomerUser: isCustomerUser,
    customerEmailForPhone: customerEmailForPhone
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
