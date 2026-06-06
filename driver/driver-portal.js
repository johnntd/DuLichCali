(function (root) {
  'use strict';

  var STRINGS = {
    en: {
      appTitle: 'Driver Portal', loading: 'Loading', signOut: 'Sign out', activeToggle: 'Available for work', rideToggle: 'Ride service', enableAlerts: 'Enable alerts',
      on: 'On', off: 'Off', all: 'All', rides: 'Rides', tours: 'Tours', today: 'Today', upcoming: 'Upcoming', pending: 'Pending', inProgress: 'In progress', completedToday: 'Completed today',
      profileAccordion: 'Profile & contact', vehicleAccordion: 'Vehicle', regionsAccordion: 'Service regions', hoursAccordion: 'Working hours', blackoutAccordion: 'Blackout dates',
      complianceAccordion: 'Compliance documents', alertsAccordion: 'Alerts', gpsAccordion: 'GPS sharing', calendarAccordion: 'Calendar', earningsAccordion: 'Earnings & ratings', languageAccordion: 'Language',
      nameLabel: 'Name', phoneLabel: 'Phone', makeLabel: 'Make', modelLabel: 'Model', yearLabel: 'Year', colorLabel: 'Color', seatsLabel: 'Seats', plateLabel: 'Plate',
      save: 'Save', add: 'Add', blackoutDateLabel: 'Date', bayarea: 'Bay Area', oc: 'Orange County', enabled: 'Enabled', start: 'Start', end: 'End',
      notificationsTitle: 'Notifications', close: 'Close', toggleSound: 'Toggle sound', enablePush: 'Enable Push', pushLater: 'Push subscription is coming in Phase 3.',
      gpsStart: 'Start GPS', gpsStop: 'Stop GPS', gpsOff: 'Location sharing is off.', gpsLoading: 'Getting location', gpsUnsupported: 'GPS is not supported on this device.', gpsError: 'GPS error',
      saved: 'Saved', saveError: 'Save failed', emptyList: 'No driver work matches this filter.', rideAlreadyTaken: 'This ride was already taken by another driver.', offerAccepted: 'Ride accepted. Contact the customer.',
      skipped: 'Skipped for now.', declined: 'Declined', map: 'Map', navigate: 'Navigate', accept: 'Accept', decline: 'Decline', advance: 'Advance status', call: 'Call', text: 'Text', email: 'Email',
      customer: 'Customer', pickup: 'Pickup', dropoff: 'Dropoff', dateTime: 'Date/time', flight: 'Flight', passengers: 'Passengers', luggage: 'Luggage', fare: 'Fare', notes: 'Notes',
      status_assigned: 'Assigned', status_driver_confirmed: 'Confirmed', status_new: 'New', status_accepted: 'Accepted', status_offered_to_driver: 'Offered', status_on_the_way: 'On the way',
      status_arrived: 'Arrived', status_in_progress: 'In progress', status_completed: 'Completed', status_cancelled: 'Cancelled', status_confirmed: 'Confirmed', status_picked_up: 'Picked up',
      next_on_the_way: 'Start driving to customer', next_arrived: 'Arrived at pickup', next_in_progress: 'Start trip', next_completed: 'Complete trip',
      tour_next_confirmed: 'Confirm tour', tour_next_picked_up: 'Picked up guests', tour_next_in_progress: 'Start tour', tour_next_completed: 'Complete tour',
      complianceTitle: 'Compliance status', legalName: 'Legal name', licenseNumber: 'License number', expiry: 'Expiration date', frontUrl: 'Front image URL', backUrl: 'Back image URL',
      registrationPlate: 'Registration plate', vin: 'VIN', fileUrl: 'File URL', insurer: 'Insurance company', policy: 'Policy number', insured: 'Named insured', submitDocs: 'Submit documents',
      comp_pending_documents: 'Missing documents', comp_pending_review: 'Pending review', comp_approved: 'Approved', comp_rejected: 'Rejected', comp_expired: 'Expired',
      day0: 'Sunday', day1: 'Monday', day2: 'Tuesday', day3: 'Wednesday', day4: 'Thursday', day5: 'Friday', day6: 'Saturday',
      earningsNoticeTitle: 'Estimated gross fare', earningsNoticeBody: 'Amounts shown are customer-facing estimates. Final payment is confirmed by management.', refresh: 'Refresh', estimated: 'estimated', completedHistory: 'Completed history',
      noCompleted: 'No completed trips yet.', ratingsTitle: 'Customer ratings', reviewCount: 'ratings', notFound: 'Driver account was not found.'
    },
    vi: {
      appTitle: 'Cổng Tài Xế', loading: 'Đang tải', signOut: 'Đăng xuất', activeToggle: 'Sẵn sàng làm việc', rideToggle: 'Dịch vụ xe', enableAlerts: 'Bật thông báo',
      on: 'Bật', off: 'Tắt', all: 'Tất cả', rides: 'Chuyến xe', tours: 'Tour', today: 'Hôm nay', upcoming: 'Sắp tới', pending: 'Đang chờ', inProgress: 'Đang chạy', completedToday: 'Hoàn tất hôm nay',
      profileAccordion: 'Hồ sơ & liên hệ', vehicleAccordion: 'Xe', regionsAccordion: 'Khu vực phục vụ', hoursAccordion: 'Giờ làm việc', blackoutAccordion: 'Ngày nghỉ',
      complianceAccordion: 'Hồ sơ pháp lý', alertsAccordion: 'Thông báo', gpsAccordion: 'Chia sẻ GPS', calendarAccordion: 'Lịch', earningsAccordion: 'Thu nhập & đánh giá', languageAccordion: 'Ngôn ngữ',
      nameLabel: 'Tên', phoneLabel: 'Điện thoại', makeLabel: 'Hãng xe', modelLabel: 'Đời xe', yearLabel: 'Năm', colorLabel: 'Màu', seatsLabel: 'Số ghế', plateLabel: 'Biển số',
      save: 'Lưu', add: 'Thêm', blackoutDateLabel: 'Ngày', bayarea: 'Bay Area', oc: 'Orange County', enabled: 'Bật', start: 'Bắt đầu', end: 'Kết thúc',
      notificationsTitle: 'Thông báo', close: 'Đóng', toggleSound: 'Bật/tắt âm thanh', enablePush: 'Bật Push', pushLater: 'Đăng ký push sẽ được thêm ở Phase 3.',
      gpsStart: 'Bật GPS', gpsStop: 'Dừng GPS', gpsOff: 'Vị trí đang tắt.', gpsLoading: 'Đang lấy vị trí', gpsUnsupported: 'Thiết bị không hỗ trợ GPS.', gpsError: 'Lỗi GPS',
      saved: 'Đã lưu', saveError: 'Lưu thất bại', emptyList: 'Không có việc nào khớp bộ lọc.', rideAlreadyTaken: 'Chuyến này đã có tài xế khác nhận.', offerAccepted: 'Đã nhận chuyến. Liên hệ khách ngay.',
      skipped: 'Đã bỏ qua tạm thời.', declined: 'Đã từ chối', map: 'Bản đồ', navigate: 'Chỉ đường', accept: 'Nhận chuyến', decline: 'Từ chối', advance: 'Cập nhật trạng thái', call: 'Gọi', text: 'Nhắn tin', email: 'Email',
      customer: 'Khách', pickup: 'Điểm đón', dropoff: 'Điểm đến', dateTime: 'Ngày/giờ', flight: 'Chuyến bay', passengers: 'Hành khách', luggage: 'Hành lý', fare: 'Giá', notes: 'Ghi chú',
      status_assigned: 'Được giao', status_driver_confirmed: 'Đã xác nhận', status_new: 'Mới', status_accepted: 'Đã nhận', status_offered_to_driver: 'Được mời', status_on_the_way: 'Đang đến',
      status_arrived: 'Đã đến', status_in_progress: 'Đang chạy', status_completed: 'Hoàn thành', status_cancelled: 'Đã hủy', status_confirmed: 'Đã xác nhận', status_picked_up: 'Đã đón khách',
      next_on_the_way: 'Bắt đầu di chuyển đến khách', next_arrived: 'Đã đến điểm đón', next_in_progress: 'Bắt đầu chuyến đi', next_completed: 'Hoàn thành chuyến',
      tour_next_confirmed: 'Xác nhận tour', tour_next_picked_up: 'Đã đón khách', tour_next_in_progress: 'Bắt đầu tour', tour_next_completed: 'Hoàn thành tour',
      complianceTitle: 'Tình trạng hồ sơ', legalName: 'Tên pháp lý', licenseNumber: 'Số bằng lái', expiry: 'Ngày hết hạn', frontUrl: 'Link mặt trước', backUrl: 'Link mặt sau',
      registrationPlate: 'Biển số đăng kiểm', vin: 'VIN', fileUrl: 'Link tài liệu', insurer: 'Hãng bảo hiểm', policy: 'Số hợp đồng', insured: 'Người được bảo hiểm', submitDocs: 'Nộp tài liệu',
      comp_pending_documents: 'Thiếu tài liệu', comp_pending_review: 'Chờ duyệt', comp_approved: 'Đã duyệt', comp_rejected: 'Bị từ chối', comp_expired: 'Hết hạn',
      day0: 'Chủ Nhật', day1: 'Thứ Hai', day2: 'Thứ Ba', day3: 'Thứ Tư', day4: 'Thứ Năm', day5: 'Thứ Sáu', day6: 'Thứ Bảy',
      earningsNoticeTitle: 'Giá ước tính', earningsNoticeBody: 'Số tiền hiển thị là giá báo cho khách. Thanh toán thực tế do quản lý xác nhận.', refresh: 'Làm mới', estimated: 'ước tính', completedHistory: 'Lịch sử hoàn thành',
      noCompleted: 'Chưa có chuyến hoàn thành.', ratingsTitle: 'Đánh giá của khách', reviewCount: 'đánh giá', notFound: 'Tài khoản tài xế không tồn tại.'
    },
    es: {
      appTitle: 'Portal de Conductores', loading: 'Cargando', signOut: 'Salir', activeToggle: 'Disponible', rideToggle: 'Servicio de viajes', enableAlerts: 'Activar alertas',
      on: 'Activo', off: 'Inactivo', all: 'Todo', rides: 'Viajes', tours: 'Tours', today: 'Hoy', upcoming: 'Próximos', pending: 'Pendientes', inProgress: 'En curso', completedToday: 'Completados hoy',
      profileAccordion: 'Perfil y contacto', vehicleAccordion: 'Vehículo', regionsAccordion: 'Zonas de servicio', hoursAccordion: 'Horario', blackoutAccordion: 'Días bloqueados',
      complianceAccordion: 'Documentos', alertsAccordion: 'Alertas', gpsAccordion: 'GPS', calendarAccordion: 'Calendario', earningsAccordion: 'Ingresos y calificaciones', languageAccordion: 'Idioma',
      nameLabel: 'Nombre', phoneLabel: 'Teléfono', makeLabel: 'Marca', modelLabel: 'Modelo', yearLabel: 'Año', colorLabel: 'Color', seatsLabel: 'Asientos', plateLabel: 'Placa',
      save: 'Guardar', add: 'Agregar', blackoutDateLabel: 'Fecha', bayarea: 'Bay Area', oc: 'Orange County', enabled: 'Activo', start: 'Inicio', end: 'Fin',
      notificationsTitle: 'Notificaciones', close: 'Cerrar', toggleSound: 'Activar sonido', enablePush: 'Activar Push', pushLater: 'La suscripción push llega en Phase 3.',
      gpsStart: 'Iniciar GPS', gpsStop: 'Detener GPS', gpsOff: 'Ubicación desactivada.', gpsLoading: 'Obteniendo ubicación', gpsUnsupported: 'Este dispositivo no soporta GPS.', gpsError: 'Error de GPS',
      saved: 'Guardado', saveError: 'No se pudo guardar', emptyList: 'No hay trabajos para este filtro.', rideAlreadyTaken: 'Otro conductor ya tomó este viaje.', offerAccepted: 'Viaje aceptado. Contacta al cliente.',
      skipped: 'Omitido por ahora.', declined: 'Rechazado', map: 'Mapa', navigate: 'Navegar', accept: 'Aceptar', decline: 'Rechazar', advance: 'Avanzar estado', call: 'Llamar', text: 'Texto', email: 'Email',
      customer: 'Cliente', pickup: 'Recogida', dropoff: 'Destino', dateTime: 'Fecha/hora', flight: 'Vuelo', passengers: 'Pasajeros', luggage: 'Equipaje', fare: 'Tarifa', notes: 'Notas',
      status_assigned: 'Asignado', status_driver_confirmed: 'Confirmado', status_new: 'Nuevo', status_accepted: 'Aceptado', status_offered_to_driver: 'Ofrecido', status_on_the_way: 'En camino',
      status_arrived: 'Llegó', status_in_progress: 'En curso', status_completed: 'Completado', status_cancelled: 'Cancelado', status_confirmed: 'Confirmado', status_picked_up: 'Recogido',
      next_on_the_way: 'Ir al cliente', next_arrived: 'Llegué', next_in_progress: 'Iniciar viaje', next_completed: 'Completar viaje',
      tour_next_confirmed: 'Confirmar tour', tour_next_picked_up: 'Pasajeros recogidos', tour_next_in_progress: 'Iniciar tour', tour_next_completed: 'Completar tour',
      complianceTitle: 'Estado de documentos', legalName: 'Nombre legal', licenseNumber: 'Licencia', expiry: 'Vencimiento', frontUrl: 'URL frontal', backUrl: 'URL posterior',
      registrationPlate: 'Placa', vin: 'VIN', fileUrl: 'URL de archivo', insurer: 'Aseguradora', policy: 'Póliza', insured: 'Asegurado', submitDocs: 'Enviar documentos',
      comp_pending_documents: 'Faltan documentos', comp_pending_review: 'Pendiente de revisión', comp_approved: 'Aprobado', comp_rejected: 'Rechazado', comp_expired: 'Vencido',
      day0: 'Domingo', day1: 'Lunes', day2: 'Martes', day3: 'Miércoles', day4: 'Jueves', day5: 'Viernes', day6: 'Sábado',
      earningsNoticeTitle: 'Tarifa estimada', earningsNoticeBody: 'Los montos son estimados para el cliente. Administración confirma el pago final.', refresh: 'Actualizar', estimated: 'estimado', completedHistory: 'Historial completado',
      noCompleted: 'Aún no hay viajes completados.', ratingsTitle: 'Calificaciones', reviewCount: 'calificaciones', notFound: 'No se encontró la cuenta del conductor.'
    }
  };

  var firebaseConfig = {
    apiKey: 'AIzaSyCo1FzDthSCXINRHlyJkqdcVKq_inM71SQ',
    authDomain: 'dulichcali-booking-calendar.firebaseapp.com',
    projectId: 'dulichcali-booking-calendar',
    storageBucket: 'dulichcali-booking-calendar.appspot.com',
    messagingSenderId: '623460884698',
    appId: '1:623460884698:web:a08bd435c453a7b4db05e3'
  };
  if (!root.firebase.apps.length) root.firebase.initializeApp(firebaseConfig);

  var db = root.firebase.firestore();
  var auth = root.firebase.auth();
  var FieldValue = root.firebase.firestore.FieldValue;
  var state = {
    lang: readLang(), driverId: '', user: null, driver: {}, driverName: '', driverPhone: '',
    active: false, rideServiceEnabled: false, regions: [], weeklySchedule: defaultSchedule(), blackoutDates: [],
    travelDriverIds: [], rides: {}, offers: {}, rideNotifs: {}, tours: {}, skipped: {}, expandedId: '', filter: 'all',
    unsubscribes: [], gpsWatchId: null, gpsAutoRegionSet: false, compData: null, earningsLoaded: false, ratingsLoaded: false
  };
  var TRIP_STATUS_NEXT = { assigned: 'on_the_way', driver_confirmed: 'on_the_way', on_the_way: 'arrived', arrived: 'in_progress', in_progress: 'completed' };
  var TOUR_STATUS_NEXT = { assigned: 'confirmed', confirmed: 'picked_up', picked_up: 'in_progress', in_progress: 'completed' };
  var ACTIVE_STATUSES = ['assigned', 'driver_confirmed', 'on_the_way', 'arrived', 'in_progress'];
  var IN_PROGRESS = ['on_the_way', 'arrived', 'in_progress'];

  function readLang() {
    try { return root.localStorage.getItem('dlc_lang') || root.localStorage.getItem('dlcLang') || 'vi'; } catch (e) { return 'vi'; }
  }
  function setLang(lang) {
    state.lang = STRINGS[lang] ? lang : 'vi';
    try { root.localStorage.setItem('dlc_lang', state.lang); root.localStorage.setItem('dlcLang', state.lang); } catch (e) {}
    applyI18n();
    renderAll();
  }
  function t(key) { return (STRINGS[state.lang] && STRINGS[state.lang][key]) || STRINGS.en[key] || key; }
  function applyI18n() {
    root.document.documentElement.lang = state.lang;
    root.document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    renderToggles();
  }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }
  function $(id) { return root.document.getElementById(id); }
  function showToast(key, error) {
    var el = $('toast');
    if (!el) return;
    el.textContent = t(key) || key;
    el.dataset.tone = error ? 'error' : 'ok';
    el.hidden = false;
    root.setTimeout(function () { el.hidden = true; }, 3200);
  }
  function defaultSchedule() {
    return {
      0: { enabled: false, start: '09:00', end: '22:00' },
      1: { enabled: true, start: '08:00', end: '22:00' },
      2: { enabled: true, start: '08:00', end: '22:00' },
      3: { enabled: true, start: '08:00', end: '22:00' },
      4: { enabled: true, start: '08:00', end: '22:00' },
      5: { enabled: true, start: '08:00', end: '22:00' },
      6: { enabled: true, start: '08:00', end: '22:00' }
    };
  }
  function copySchedule(source) {
    var out = defaultSchedule();
    Object.keys(out).forEach(function (day) {
      if (source && source[day]) out[day] = { enabled: !!source[day].enabled, start: source[day].start || '08:00', end: source[day].end || '22:00' };
    });
    return out;
  }

  function initAuth() {
    root.PortalPWA.register({ swUrl: '/driver/sw.js', scope: '/driver/' });
    root.PortalAuth.enableLocalPersistence(auth);
    root.PortalAuth.guard({
      auth: auth,
      readContext: function (user) {
        return db.collection('driverUsers').doc(user.uid).get().then(function (userDoc) {
          var driverId = userDoc.exists ? ((userDoc.data() || {}).driverId || user.uid) : user.uid;
          return db.collection('drivers').doc(driverId).get().then(function (driverDoc) {
            return { userDoc: userDoc, driverDoc: driverDoc, driverId: driverId };
          });
        });
      },
      isValid: function (ctx) {
        if (!ctx || !ctx.userDoc || !ctx.userDoc.exists || !ctx.driverDoc || !ctx.driverDoc.exists) return 'not_found';
        var data = ctx.driverDoc.data() || {};
        if (data.deleted) return 'not_found';
        if (data.adminStatus === 'blocked') return 'blocked';
        if (data.adminStatus === 'deactivated') return 'deactivated';
        if (data.adminStatus === 'archived') return 'archived';
        return true;
      },
      onReady: function (ctx, user) { init(ctx.driverId, ctx.driverDoc.data() || {}, user); },
      onReject: function () { root.location.href = '/driver/login'; }
    });
  }

  function init(driverId, driverData, user) {
    state.driverId = driverId;
    state.user = user;
    state.driver = driverData || {};
    hydrateDriver(state.driver);
    bindEvents();
    applyI18n();
    renderSettings();
    initNotify();
    attachDataListeners();
    loadComplianceDocs();
    loadEarnings();
    renderCalendarPanel();
  }
  function hydrateDriver(d) {
    state.driverName = d.fullName || (state.user && state.user.email) || '';
    state.driverPhone = d.phone || '';
    state.active = !!d.active;
    state.rideServiceEnabled = !!d.rideServiceEnabled;
    state.regions = Array.isArray(d.regions) ? d.regions.slice() : [];
    state.weeklySchedule = copySchedule(d.availability && d.availability.weeklySchedule);
    state.blackoutDates = (d.availability && Array.isArray(d.availability.blackoutDates)) ? d.availability.blackoutDates.slice() : [];
    var rawTravel = d.travel_driver_ids || d.travel_driver_id || null;
    state.travelDriverIds = Array.isArray(rawTravel) ? rawTravel.slice(0, 30) : (rawTravel ? [rawTravel] : []);
    if ($('driverName')) $('driverName').textContent = state.driverName || t('appTitle');
    setValue('fName', d.fullName || '');
    setValue('fPhone', d.phone || '');
    setValue('fMake', d.vehicle && d.vehicle.make || '');
    setValue('fModel', d.vehicle && d.vehicle.model || '');
    setValue('fYear', d.vehicle && d.vehicle.year || '');
    setValue('fColor', d.vehicle && d.vehicle.color || '');
    setValue('fSeats', d.vehicle && d.vehicle.seats || 4);
    setValue('fPlate', d.vehicle && d.vehicle.plate || '');
  }
  function setValue(id, value) { var el = $(id); if (el) el.value = value == null ? '' : value; }
  function getValue(id) { var el = $(id); return el ? el.value.trim() : ''; }

  function bindEvents() {
    if (state.bound) return;
    state.bound = true;
    root.document.addEventListener('click', function (event) {
      var node = event.target.closest('[data-action]');
      if (!node) return;
      var action = node.getAttribute('data-action');
      if (action === 'lang') setLang(node.getAttribute('data-lang'));
      if (action === 'signOut') auth.signOut().then(function () { root.location.href = '/driver/login'; });
      if (action === 'toggleActive') toggleDriverField('active');
      if (action === 'toggleRide') toggleDriverField('rideServiceEnabled');
      if (action === 'enableAlerts') enableAlerts();
      if (action === 'toggleSound') enableAlerts();
      if (action === 'pushPlaceholder') showToast('pushLater');
      if (action === 'closeDrawer') root.PortalNotify.closeDrawer();
      if (action === 'saveProfile') saveProfile();
      if (action === 'addBlackout') addBlackout();
      if (action === 'toggleGps') toggleGps();
      if (action === 'submitDocs') submitComplianceDocs();
      if (action === 'refreshEarnings') { state.earningsLoaded = false; state.ratingsLoaded = false; loadEarnings(); }
      if (action === 'accept') acceptItem(node.getAttribute('data-id'));
      if (action === 'decline') declineItem(node.getAttribute('data-id'));
      if (action === 'advanceRide') advanceRide(node.getAttribute('data-id'));
      if (action === 'advanceTour') advanceTour(node.getAttribute('data-id'));
      if (action === 'removeBlackout') removeBlackout(node.getAttribute('data-date'));
    });
  }

  function initNotify() {
    var listeners = [
      {
        query: db.collection('rideNotifications').where('status', 'in', ['new', 'accepted']),
        mapDoc: function (d, id) { return mapNotify('rideNotifications', id, d, d.serviceLabel || d.serviceType || t('rides'), d.customerName || '', d.status || 'new', d.bookingId || id); }
      },
      {
        query: db.collection('bookingOffers').where('driverId', '==', state.driverId).where('status', '==', 'pending'),
        mapDoc: function (d, id) { return mapNotify('bookingOffers', id, d, t('pending'), d.bookingId || '', 'offered_to_driver', d.bookingId || id); }
      },
      {
        query: db.collection('bookings').where('driver.driverId', '==', state.driverId),
        mapDoc: function (d, id) { return mapNotify('bookings', id, d, t('rides'), d.customerName || d.name || '', d.status || 'assigned', id); }
      },
      {
        query: db.collection('vendors').doc('admin-dlc').collection('notifications').where('targetId', '==', state.driverId),
        mapDoc: function (d, id) { return mapNotify('driverNotifications', id, d, d.title || t('notificationsTitle'), d.message || '', d.status || 'assigned', d.bookingId || id); }
      }
    ];
    if (state.travelDriverIds.length) {
      listeners.push({
        query: db.collection('travelAssignments').where('travel_driver_id', 'in', state.travelDriverIds),
        mapDoc: function (d, id) { return mapNotify('travelAssignments', id, d, d.packageName || t('tours'), d.customerName || '', 'tour-assigned', d.bookingId || id); }
      });
    }
    root.PortalNotify.init({
      scopeId: state.driverId,
      storagePrefix: 'dlc_driver',
      listeners: listeners,
      dedupeKeyFn: function (item) { return item.kind + ':' + item.id; },
      statusWhitelist: ['new', 'offered_to_driver', 'assigned', 'driver_confirmed', 'on_the_way', 'arrived', 'in_progress', 'tour-assigned'],
      els: { bell: $('notifBell'), badge: $('notifBadge'), drawer: $('notifDrawer'), list: $('notifList'), enableBtn: $('enableAlertsBtn') },
      renderItem: function (item) {
        return '<button class="pk-notif-item" type="button"><strong>' + esc(item.title) + '</strong><span>' + esc(item.message) + '</span></button>';
      },
      onOpenItem: function (item) {
        state.expandedId = item.kind + ':' + (item.bookingId || item.id);
        renderAll();
      }
    });
  }
  function mapNotify(collection, id, data, title, message, status, bookingId) {
    return { id: collection + ':' + id, kind: collection, title: title, message: message, status: status, bookingId: bookingId, raw: data, createdAt: toMs(data.createdAt || data.updatedAt) || Date.now() };
  }
  function enableAlerts() {
    root.PortalNotify.enableAlerts().then(function () {
      var el = $('alertsStatus');
      if (el) el.textContent = t('enableAlerts') + ': ' + t('on');
    });
  }

  function attachDataListeners() {
    clearListeners();
    listen('rideNotifications', db.collection('rideNotifications').where('status', 'in', ['new', 'accepted']), state.rideNotifs);
    listen('bookingOffers', db.collection('bookingOffers').where('driverId', '==', state.driverId).where('status', '==', 'pending'), state.offers);
    listen('bookings', db.collection('bookings').where('driver.driverId', '==', state.driverId), state.rides);
    if (state.travelDriverIds.length) listen('travelAssignments', db.collection('travelAssignments').where('travel_driver_id', 'in', state.travelDriverIds), state.tours);
  }
  function clearListeners() { state.unsubscribes.forEach(function (fn) { try { fn(); } catch (e) {} }); state.unsubscribes = []; }
  function listen(kind, query, bucket) {
    try {
      state.unsubscribes.push(query.onSnapshot(function (snap) {
        snap.docChanges().forEach(function (change) {
          if (change.type === 'removed') delete bucket[change.doc.id];
          else bucket[change.doc.id] = Object.assign({ _id: change.doc.id, _kind: kind }, change.doc.data() || {});
        });
        renderAll();
      }, function () {}));
    } catch (e) {}
  }

  function renderAll() {
    renderToggles();
    renderSettings();
    renderCounters();
    renderFilters();
    renderCards();
    renderCalendarPanel();
  }
  function renderToggles() {
    var active = $('activeToggle'), ride = $('rideToggle');
    if (active) active.setAttribute('aria-pressed', state.active ? 'true' : 'false');
    if (ride) ride.setAttribute('aria-pressed', state.rideServiceEnabled ? 'true' : 'false');
    if ($('activeToggleState')) $('activeToggleState').textContent = state.active ? t('on') : t('off');
    if ($('rideToggleState')) $('rideToggleState').textContent = state.rideServiceEnabled ? t('on') : t('off');
  }
  function renderCounters() {
    var counts = computeCounts();
    root.PortalShell.summaryCounters({
      mount: '#counterMount',
      activeKey: state.filter,
      tabs: [
        { key: 'today', label: t('today'), count: counts.today },
        { key: 'upcoming', label: t('upcoming'), count: counts.upcoming },
        { key: 'pending', label: t('pending'), count: counts.pending },
        { key: 'in_progress', label: t('inProgress'), count: counts.in_progress },
        { key: 'completed_today', label: t('completedToday'), count: counts.completed_today }
      ],
      onSelect: function (key) { state.filter = key; state.expandedId = ''; renderAll(); }
    });
  }
  function renderFilters() {
    root.PortalShell.filterChips({
      mount: '#filterMount',
      activeKey: state.filter,
      chips: [
        { key: 'all', label: t('all') }, { key: 'rides', label: t('rides') }, { key: 'tours', label: t('tours') },
        { key: 'pending', label: t('pending') }, { key: 'in_progress', label: t('inProgress') }
      ],
      onSelect: function (key) { state.filter = key; state.expandedId = ''; renderAll(); }
    });
  }
  function renderCards() {
    var items = filteredItems();
    if (!items.length) {
      $('cardMount').innerHTML = '<div class="pk-card driver-empty">' + esc(t('emptyList')) + '</div>';
      return;
    }
    root.PortalShell.cardList({
      mount: '#cardMount',
      items: items,
      expandedId: state.expandedId,
      onToggle: function (id) { state.expandedId = state.expandedId === id ? '' : id; renderCards(); },
      renderCollapsed: renderCollapsed,
      renderExpanded: renderExpanded
    });
  }
  function allItems() {
    var out = [];
    Object.keys(state.rideNotifs).forEach(function (id) {
      var d = state.rideNotifs[id];
      if (state.skipped['rideNotifications:' + id]) return;
      out.push(normalizeRide('rideNotifications:' + id, d, 'offer'));
    });
    Object.keys(state.offers).forEach(function (id) {
      var d = state.offers[id];
      if (state.skipped['bookingOffers:' + id]) return;
      out.push(normalizeRide('bookingOffers:' + id, d, 'offer'));
    });
    Object.keys(state.rides).forEach(function (id) { out.push(normalizeRide('bookings:' + id, state.rides[id], 'ride')); });
    Object.keys(state.tours).forEach(function (id) { out.push(normalizeTour('travelAssignments:' + id, state.tours[id])); });
    out.sort(function (a, b) { return (a.pickupMs || 9e15) - (b.pickupMs || 9e15); });
    return out;
  }
  function filteredItems() {
    return allItems().filter(function (item) {
      if (state.filter === 'all') return !isTerminalOld(item);
      if (state.filter === 'rides') return item.type === 'ride' || item.type === 'offer';
      if (state.filter === 'tours') return item.type === 'tour';
      if (state.filter === 'today') return isToday(item.pickupMs) && ACTIVE_STATUSES.indexOf(item.status) >= 0;
      if (state.filter === 'upcoming') return ['assigned', 'driver_confirmed'].indexOf(item.status) >= 0 && (!item.pickupMs || item.pickupMs >= startOfToday() + 86400000);
      if (state.filter === 'pending') return item.type === 'offer' || item.status === 'offered_to_driver' || item.status === 'new';
      if (state.filter === 'in_progress') return IN_PROGRESS.indexOf(item.status) >= 0;
      if (state.filter === 'completed_today') return item.status === 'completed' && isToday(item.pickupMs || item.updatedMs || item.createdMs);
      return true;
    });
  }
  function computeCounts() {
    var c = { today: 0, upcoming: 0, pending: 0, in_progress: 0, completed_today: 0 };
    allItems().forEach(function (item) {
      if (isToday(item.pickupMs) && ACTIVE_STATUSES.indexOf(item.status) >= 0) c.today += 1;
      if (['assigned', 'driver_confirmed'].indexOf(item.status) >= 0 && (!item.pickupMs || item.pickupMs >= startOfToday() + 86400000)) c.upcoming += 1;
      if (item.type === 'offer' || item.status === 'offered_to_driver' || item.status === 'new') c.pending += 1;
      if (IN_PROGRESS.indexOf(item.status) >= 0) c.in_progress += 1;
      if (item.status === 'completed' && isToday(item.pickupMs || item.updatedMs || item.createdMs)) c.completed_today += 1;
    });
    return c;
  }
  function isTerminalOld(item) {
    return ['completed', 'cancelled'].indexOf(item.status) >= 0 && !isToday(item.pickupMs || item.updatedMs || item.createdMs);
  }

  function normalizeRide(id, d, type) {
    var bookingId = d.bookingId || (type === 'ride' ? d._id : '');
    var pickup = pickupAddress(d);
    var dropoff = dropoffAddress(d);
    return {
      id: id, docId: d._id, bookingId: bookingId, type: type, raw: d,
      status: d.status || (type === 'offer' ? 'new' : 'assigned'),
      customerName: d.customerName || d.name || '', customerPhone: d.customerPhone || d.phone || '',
      pickupAddress: pickup, dropoffAddress: dropoff, pickupMs: parsePickupMs(d), createdMs: toMs(d.createdAt), updatedMs: toMs(d.updatedAt || d.statusUpdatedAt),
      passengers: d.passengers || d.passengerCount || 1, luggage: d.luggage || d.bags || d.suitcases || '',
      fare: d.estimatedPrice || d.estimatedFare || d.total || '', notes: d.notes || d.riderNotes || '', airport: d.airport || '', airline: d.airline || '', flight: d.flightNumber || d.flight || '', terminal: d.terminal || '', serviceType: d.serviceType || d.serviceLabel || ''
    };
  }
  function normalizeTour(id, d) {
    return {
      id: id, docId: d._id, bookingId: d.bookingId || d._id, type: 'tour', raw: d, status: d.status || 'assigned',
      customerName: d.customerName || '', customerPhone: d.customerPhone || '', customerEmail: d.customerEmail || '',
      pickupAddress: d.pickupAddress || '', dropoffAddress: d.packageName || '', pickupMs: d.travelDate ? new Date(d.travelDate + 'T00:00:00').getTime() : 0,
      createdMs: toMs(d.assignedAt || d.createdAt), updatedMs: toMs(d.updatedAt || d.statusUpdatedAt), passengers: d.travelers || 1, luggage: '',
      fare: d.total || '', notes: d.notes || '', serviceType: 'tour', durationDays: Math.max(1, parseInt(d.duration_days || 1, 10))
    };
  }
  function pickupAddress(d) {
    if (d.serviceType === 'airport_pickup' || d.serviceType === 'pickup') return [d.airport, d.terminal].filter(Boolean).join(' ');
    return d.pickupAddress || d.address || '';
  }
  function dropoffAddress(d) {
    if (d.serviceType === 'airport_dropoff' || d.serviceType === 'dropoff') return [d.airport, d.terminal].filter(Boolean).join(' ');
    return d.dropoffAddress || d.destinationAddress || '';
  }
  function renderCollapsed(item) {
    return '<div class="driver-card-main">' +
      '<div class="driver-card-line"><span class="pk-status ' + statusClass(item.status) + '">' + esc(statusLabel(item.status)) + '</span><strong>' + esc(formatWhen(item.pickupMs)) + '</strong></div>' +
      '<div class="driver-card-title">' + esc(item.customerName || t('customer')) + '</div>' +
      '<div class="driver-card-meta"><span>' + esc(shortPlace(item.pickupAddress)) + ' -> ' + esc(shortPlace(item.dropoffAddress)) + '</span><span>' + esc(passengerSummary(item)) + '</span></div>' +
    '</div>';
  }
  function renderExpanded(item) {
    var map = mapLink(item);
    var nav = navLink(item);
    var nextRide = TRIP_STATUS_NEXT[item.status];
    var nextTour = TOUR_STATUS_NEXT[item.status];
    return '<div class="driver-detail-grid">' +
      kv('customer', item.customerName) + kv('phoneLabel', item.customerPhone) + kv('pickup', item.pickupAddress) + kv('dropoff', item.dropoffAddress) +
      kv('dateTime', formatWhen(item.pickupMs)) + kv('flight', [item.airline, item.flight, item.terminal].filter(Boolean).join(' ')) +
      kv('passengers', passengerSummary(item)) + kv('fare', item.fare ? '$' + Number(item.fare).toFixed(0) : '') + kv('notes', item.notes) +
      '<div class="pk-card__actions wide">' +
        (map ? '<a class="pk-btn" target="_blank" rel="noopener" href="' + esc(map) + '">' + esc(t('map')) + '</a>' : '') +
        (nav ? '<a class="pk-btn" target="_blank" rel="noopener" href="' + esc(nav) + '">' + esc(t('navigate')) + '</a>' : '') +
        (item.type === 'offer' && item.status !== 'accepted' ? '<button class="pk-btn pk-btn--primary" type="button" data-action="accept" data-id="' + esc(item.id) + '">' + esc(t('accept')) + '</button><button class="pk-btn pk-btn--danger" type="button" data-action="decline" data-id="' + esc(item.id) + '">' + esc(t('decline')) + '</button>' : '') +
        (item.type !== 'tour' && nextRide ? '<button class="pk-btn pk-btn--primary" type="button" data-action="advanceRide" data-id="' + esc(item.id) + '">' + esc(t('next_' + nextRide) || t('advance')) + '</button>' : '') +
        (item.type === 'tour' && nextTour ? '<button class="pk-btn pk-btn--primary" type="button" data-action="advanceTour" data-id="' + esc(item.id) + '">' + esc(t('tour_next_' + nextTour) || t('advance')) + '</button>' : '') +
        (item.customerPhone ? '<a class="pk-btn" href="tel:' + esc(cleanPhone(item.customerPhone)) + '">' + esc(t('call')) + '</a><a class="pk-btn" href="sms:' + esc(cleanPhone(item.customerPhone)) + '">' + esc(t('text')) + '</a>' : '') +
        (item.type === 'tour' && item.raw.customerEmail ? '<a class="pk-btn" href="mailto:' + esc(item.raw.customerEmail) + '">' + esc(t('email')) + '</a>' : '') +
      '</div></div>';
  }
  function kv(labelKey, value) {
    return '<div class="driver-kv"><span>' + esc(t(labelKey)) + '</span><strong>' + esc(value || '-') + '</strong></div>';
  }
  function statusLabel(status) { return t('status_' + status) || status; }
  function statusClass(status) {
    if (status === 'new' || status === 'offered_to_driver') return 'pk-status--pending';
    if (IN_PROGRESS.indexOf(status) >= 0) return 'pk-status--progress';
    if (status === 'completed') return 'pk-status--done';
    if (status === 'cancelled') return 'pk-status--cancelled';
    return 'pk-status--active';
  }
  function passengerSummary(item) {
    return String(item.passengers || 1) + ' ' + t('passengers') + (item.luggage ? ' · ' + item.luggage + ' ' + t('luggage') : '');
  }
  function shortPlace(value) {
    var s = String(value || '').split(',')[0].trim();
    return s || '-';
  }
  function cleanPhone(value) { return String(value || '').replace(/[^\d+]/g, ''); }
  function mapLink(item) {
    var ride = { pickupLocation: item.pickupAddress, dropoffLocation: item.dropoffAddress };
    if (root.DLCRide && root.DLCRide.generateMapLink) return root.DLCRide.generateMapLink(ride) || '';
    return item.pickupAddress ? 'https://maps.google.com/?q=' + encodeURIComponent(item.pickupAddress) : '';
  }
  function navLink(item) {
    var ride = { pickupLocation: item.pickupAddress, dropoffLocation: item.dropoffAddress };
    if (root.DLCRide && root.DLCRide.generateNavLink) return root.DLCRide.generateNavLink(ride) || '';
    return mapLink(item);
  }

  function acceptItem(id) {
    var item = allItems().filter(function (row) { return row.id === id; })[0];
    if (!item) return;
    if (id.indexOf('bookingOffers:') === 0 || item.raw.offerId || item.status === 'offered_to_driver') {
      root.firebase.functions().httpsCallable('acceptOffer')({ bookingId: item.bookingId }).then(function () {
        showToast('offerAccepted');
      }).catch(function (err) {
        showToast(err && err.message && err.message.indexOf('offer_not_pending') >= 0 ? 'rideAlreadyTaken' : 'saveError', true);
      });
      return;
    }
    acceptBroadcast(item);
  }
  function acceptBroadcast(item) {
    var ts = FieldValue.serverTimestamp();
    db.collection('rideNotifications').doc(item.docId).update({ status: 'accepted', acceptedBy: state.driverId, acceptedByName: state.driverName, acceptedAt: ts }).then(function () {
      if (!item.bookingId) return null;
      var driverPayload = { driverId: state.driverId, name: state.driverName, phone: state.driverPhone };
      return db.collection('bookings').doc(item.bookingId).update({
        status: 'driver_confirmed',
        driver: driverPayload,
        statusUpdatedAt: ts,
        statusUpdatedBy: 'driver:' + state.driverId,
        statusHistory: FieldValue.arrayUnion({ status: 'driver_confirmed', by: 'driver:' + state.driverId, at: new Date().toISOString() })
      }).then(function () {
        db.collection('bookings').doc(item.bookingId).get().then(function (snap) {
          if (snap.exists && root.DLCNotifications && root.DLCNotifications.queueStatusChangeNotification) root.DLCNotifications.queueStatusChangeNotification(item.bookingId, 'driver_confirmed', snap.data(), state.lang);
        }).catch(function () {});
      });
    }).then(function () { showToast('offerAccepted'); }).catch(function () { showToast('saveError', true); });
  }
  function declineItem(id) {
    state.skipped[id] = true;
    if (id.indexOf('bookingOffers:') === 0) {
      var docId = id.split(':')[1];
      db.collection('bookingOffers').doc(docId).update({ status: 'declined', declinedAt: FieldValue.serverTimestamp(), declinedBy: 'driver:' + state.driverId }).catch(function () {});
    }
    showToast('skipped');
    renderAll();
  }
  function advanceRide(id) {
    var item = allItems().filter(function (row) { return row.id === id; })[0];
    if (!item) return;
    var bookingId = item.bookingId || item.docId;
    var next = TRIP_STATUS_NEXT[item.status];
    if (!bookingId || !next) return;
    db.collection('bookings').doc(bookingId).update({
      status: next,
      statusUpdatedAt: FieldValue.serverTimestamp(),
      statusUpdatedBy: 'driver:' + state.driverId,
      statusHistory: FieldValue.arrayUnion({ status: next, by: 'driver:' + state.driverId, at: new Date().toISOString() })
    }).then(function () {
      if (root.DLCNotifications && root.DLCNotifications.queueStatusChangeNotification) root.DLCNotifications.queueStatusChangeNotification(bookingId, next, item.raw, state.lang);
    }).catch(function () { showToast('saveError', true); });
  }
  function advanceTour(id) {
    var item = allItems().filter(function (row) { return row.id === id; })[0];
    if (!item) return;
    var next = TOUR_STATUS_NEXT[item.status];
    if (!next) return;
    db.collection('travelAssignments').doc(item.docId).update({
      status: next,
      statusUpdatedAt: FieldValue.serverTimestamp(),
      statusHistory: FieldValue.arrayUnion({ status: next, by: 'driver:' + state.driverId, at: new Date().toISOString() })
    }).catch(function () { showToast('saveError', true); });
  }

  function toggleDriverField(field) {
    var key = field === 'active' ? 'active' : 'rideServiceEnabled';
    state[key] = !state[key];
    renderToggles();
    var payload = {};
    payload[key] = state[key];
    payload.updatedAt = FieldValue.serverTimestamp();
    db.collection('drivers').doc(state.driverId).update(payload).catch(function () { showToast('saveError', true); });
  }
  function saveProfile() {
    var weeklySchedule = {};
    Object.keys(state.weeklySchedule).forEach(function (day) {
      weeklySchedule[day] = { enabled: !!state.weeklySchedule[day].enabled, start: state.weeklySchedule[day].start, end: state.weeklySchedule[day].end };
    });
    var payload = {
      fullName: getValue('fName'),
      phone: getValue('fPhone'),
      active: state.active,
      rideServiceEnabled: state.rideServiceEnabled,
      regions: state.regions.slice(),
      vehicle: { make: getValue('fMake'), model: getValue('fModel'), year: getValue('fYear'), color: getValue('fColor'), seats: parseInt(getValue('fSeats'), 10) || 4, plate: getValue('fPlate') },
      availability: { timezone: 'America/Los_Angeles', weeklySchedule: weeklySchedule, blackoutDates: state.blackoutDates.slice() },
      updatedAt: FieldValue.serverTimestamp()
    };
    db.collection('drivers').doc(state.driverId).update(payload).then(function () {
      state.driverName = payload.fullName;
      state.driverPhone = payload.phone;
      if ($('driverName')) $('driverName').textContent = state.driverName || t('appTitle');
      showToast('saved');
    }).catch(function () { showToast('saveError', true); });
  }
  function renderSettings() {
    renderRegions();
    renderSchedule();
    renderBlackout();
  }
  function renderRegions() {
    var mount = $('regionsMount');
    if (!mount) return;
    mount.innerHTML = ['bayarea', 'oc'].map(function (rid) {
      return '<label class="driver-check"><input type="checkbox" data-region="' + rid + '"' + (state.regions.indexOf(rid) >= 0 ? ' checked' : '') + '><span>' + esc(t(rid)) + '</span></label>';
    }).join('') + '<div class="pk-card__actions"><button class="pk-btn pk-btn--primary" type="button" data-action="saveProfile">' + esc(t('save')) + '</button></div>';
    mount.querySelectorAll('[data-region]').forEach(function (el) {
      el.addEventListener('change', function () {
        var rid = el.getAttribute('data-region');
        if (el.checked && state.regions.indexOf(rid) < 0) state.regions.push(rid);
        if (!el.checked) state.regions = state.regions.filter(function (x) { return x !== rid; });
      });
    });
  }
  function renderSchedule() {
    var mount = $('scheduleMount');
    if (!mount) return;
    mount.innerHTML = '';
    for (var i = 0; i <= 6; i += 1) {
      var sched = state.weeklySchedule[i];
      var row = root.document.createElement('label');
      row.className = 'driver-day';
      row.innerHTML = '<input type="checkbox" data-day="' + i + '" data-type="enabled"' + (sched.enabled ? ' checked' : '') + '><span>' + esc(t('day' + i)) + '</span><input type="time" data-day="' + i + '" data-type="start" value="' + esc(sched.start) + '"><input type="time" data-day="' + i + '" data-type="end" value="' + esc(sched.end) + '">';
      mount.appendChild(row);
    }
    mount.insertAdjacentHTML('beforeend', '<div class="pk-card__actions"><button class="pk-btn pk-btn--primary" type="button" data-action="saveProfile">' + esc(t('save')) + '</button></div>');
    mount.querySelectorAll('[data-day]').forEach(function (el) {
      el.addEventListener('change', function () {
        var day = el.getAttribute('data-day');
        var type = el.getAttribute('data-type');
        state.weeklySchedule[day][type] = type === 'enabled' ? el.checked : el.value;
      });
    });
  }
  function addBlackout() {
    var val = getValue('newBlackout');
    if (val && state.blackoutDates.indexOf(val) < 0) state.blackoutDates.push(val);
    setValue('newBlackout', '');
    renderBlackout();
  }
  function removeBlackout(date) {
    state.blackoutDates = state.blackoutDates.filter(function (x) { return x !== date; });
    renderBlackout();
  }
  function renderBlackout() {
    var mount = $('blackoutMount');
    if (!mount) return;
    mount.innerHTML = state.blackoutDates.slice().sort().map(function (date) {
      return '<span class="driver-chip">' + esc(date) + '<button class="pk-btn pk-btn--sm" type="button" data-action="removeBlackout" data-date="' + esc(date) + '">x</button></span>';
    }).join('') + '<div class="pk-card__actions"><button class="pk-btn pk-btn--primary" type="button" data-action="saveProfile">' + esc(t('save')) + '</button></div>';
  }

  function toggleGps() { state.gpsWatchId === null ? startGps() : stopGps(); }
  function startGps() {
    if (!root.navigator.geolocation) { if ($('gpsStatus')) $('gpsStatus').textContent = t('gpsUnsupported'); return; }
    if ($('gpsBtn')) $('gpsBtn').textContent = t('gpsStop');
    if ($('gpsStatus')) $('gpsStatus').textContent = t('gpsLoading');
    state.gpsWatchId = root.navigator.geolocation.watchPosition(function (pos) {
      var lat = pos.coords.latitude, lng = pos.coords.longitude;
      db.collection('drivers').doc(state.driverId).update({ driverLat: lat, driverLng: lng, driverLocAt: FieldValue.serverTimestamp() }).catch(function () {});
      detectRegionFromGps(lat, lng);
      if ($('gpsStatus')) $('gpsStatus').textContent = lat.toFixed(4) + ', ' + lng.toFixed(4);
    }, function (err) {
      if ($('gpsStatus')) $('gpsStatus').textContent = t('gpsError') + ': ' + err.message;
      stopGps();
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
  }
  function stopGps() {
    if (state.gpsWatchId !== null) root.navigator.geolocation.clearWatch(state.gpsWatchId);
    state.gpsWatchId = null;
    state.gpsAutoRegionSet = false;
    if ($('gpsBtn')) $('gpsBtn').textContent = t('gpsStart');
    if ($('gpsStatus')) $('gpsStatus').textContent = t('gpsOff');
    db.collection('drivers').doc(state.driverId).update({ driverLat: FieldValue.delete(), driverLng: FieldValue.delete(), driverLocAt: FieldValue.delete() }).catch(function () {});
  }
  function detectRegionFromGps(lat, lng) {
    if (state.gpsAutoRegionSet) return;
    var bounds = { bayarea: { latMin: 36.8, latMax: 38.5, lngMin: -123.0, lngMax: -121.5 }, oc: { latMin: 32.5, latMax: 34.8, lngMin: -118.6, lngMax: -116.0 } };
    Object.keys(bounds).forEach(function (rid) {
      var b = bounds[rid];
      if (lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax && state.regions.indexOf(rid) < 0) {
        state.regions = [rid];
        state.gpsAutoRegionSet = true;
        renderRegions();
      }
    });
  }

  function loadComplianceDocs() {
    db.collection('driver_compliance').doc(state.driverId).get().then(function (doc) {
      state.compData = doc.exists ? doc.data() : root.DLCCompliance.blankDoc(state.driverId);
      renderComplianceDocs();
    }).catch(function () {
      state.compData = root.DLCCompliance.blankDoc(state.driverId);
      renderComplianceDocs();
    });
  }
  function renderComplianceDocs() {
    var comp = state.compData || root.DLCCompliance.blankDoc(state.driverId);
    var overall = root.DLCCompliance.computeOverall(comp);
    var mount = $('complianceMount');
    if (!mount) return;
    mount.innerHTML = '<div class="comp-banner ' + esc(root.DLCCompliance.overallClass(overall)) + '"><strong>' + esc(t('complianceTitle')) + ': ' + esc(t('comp_' + overall)) + '</strong></div>' +
      docFields('lic', comp.license || {}, [['legalName', 'legalName'], ['number', 'licenseNumber'], ['expirationDate', 'expiry'], ['fileFrontUrl', 'frontUrl'], ['fileBackUrl', 'backUrl']]) +
      docFields('reg', comp.registration || {}, [['plate', 'registrationPlate'], ['vin', 'vin'], ['expirationDate', 'expiry'], ['fileUrl', 'fileUrl']]) +
      docFields('ins', comp.insurance || {}, [['insurer', 'insurer'], ['policyNumber', 'policy'], ['namedInsured', 'insured'], ['expirationDate', 'expiry'], ['fileUrl', 'fileUrl']]) +
      '<div class="pk-card__actions"><button class="pk-btn pk-btn--primary" type="button" data-action="submitDocs">' + esc(t('submitDocs')) + '</button></div>';
  }
  function docFields(prefix, data, fields) {
    return '<div class="driver-form-grid">' + fields.map(function (pair) {
      var type = pair[0].indexOf('expirationDate') >= 0 ? 'date' : 'text';
      return '<label><span>' + esc(t(pair[1])) + '</span><input id="' + prefix + '-' + pair[0] + '" type="' + type + '" value="' + esc(data[pair[0]] || '') + '"></label>';
    }).join('') + '</div>';
  }
  function submitComplianceDocs() {
    var comp = state.compData ? JSON.parse(JSON.stringify(state.compData)) : root.DLCCompliance.blankDoc(state.driverId);
    comp.license = Object.assign(comp.license || {}, { legalName: getValue('lic-legalName'), number: getValue('lic-number'), expirationDate: getValue('lic-expirationDate'), fileFrontUrl: getValue('lic-fileFrontUrl'), fileBackUrl: getValue('lic-fileBackUrl') });
    comp.registration = Object.assign(comp.registration || {}, { plate: getValue('reg-plate'), vin: getValue('reg-vin'), expirationDate: getValue('reg-expirationDate'), fileUrl: getValue('reg-fileUrl') });
    comp.insurance = Object.assign(comp.insurance || {}, { insurer: getValue('ins-insurer'), policyNumber: getValue('ins-policyNumber'), namedInsured: getValue('ins-namedInsured'), expirationDate: getValue('ins-expirationDate'), fileUrl: getValue('ins-fileUrl') });
    ['license', 'registration', 'insurance'].forEach(function (key) {
      if (comp[key].status !== 'approved') comp[key].status = hasMinimumDoc(key, comp[key]) ? 'pending' : 'not_submitted';
    });
    comp.driverId = state.driverId;
    comp.overallStatus = root.DLCCompliance.computeOverall(comp);
    comp.expirationWarning = root.DLCCompliance.computeExpirationWarning(comp);
    comp.updatedAt = FieldValue.serverTimestamp();
    var batch = db.batch();
    batch.set(db.collection('driver_compliance').doc(state.driverId), comp, { merge: true });
    batch.update(db.collection('drivers').doc(state.driverId), { complianceStatus: comp.overallStatus, licExpiry: comp.license.expirationDate || '', regExpiry: comp.registration.expirationDate || '', insExpiry: comp.insurance.expirationDate || '', updatedAt: FieldValue.serverTimestamp() });
    batch.commit().then(function () { state.compData = comp; renderComplianceDocs(); showToast('saved'); }).catch(function () { showToast('saveError', true); });
  }
  function hasMinimumDoc(key, doc) {
    if (key === 'license') return doc.legalName && doc.number && doc.expirationDate;
    if (key === 'registration') return doc.plate && doc.expirationDate;
    return doc.insurer && doc.policyNumber && doc.expirationDate;
  }

  function loadEarnings() {
    if (state.earningsLoaded || !state.driverId) return;
    var ridePromise = db.collection('bookings').where('driver.driverId', '==', state.driverId).limit(500).get().then(function (snap) {
      var rows = [];
      snap.forEach(function (doc) { var d = doc.data(); if (d.status === 'completed') rows.push(Object.assign({ _id: doc.id, _earningType: 'ride' }, d)); });
      return rows;
    });
    var tourPromise = state.travelDriverIds.length ? db.collection('travelAssignments').where('travel_driver_id', 'in', state.travelDriverIds).where('status', '==', 'completed').limit(200).get().then(function (snap) {
      return snap.docs.map(function (doc) { var d = doc.data(); return { _id: doc.id, _earningType: 'tour', serviceType: 'tour', estimatedPrice: d.total, customerName: d.customerName, pickupAddress: d.pickupAddress, packageName: d.packageName, travelDate: d.travelDate, createdAt: d.assignedAt }; });
    }) : Promise.resolve([]);
    Promise.all([ridePromise, tourPromise]).then(function (results) {
      renderEarnings(results[0].concat(results[1]));
      state.earningsLoaded = true;
      loadDriverRatings();
    }).catch(function () {});
  }
  function renderEarnings(rows) {
    var body = $('earningsTripBlock');
    if (!body) return;
    rows.sort(function (a, b) { return earningMs(b) - earningMs(a); });
    var today = startOfToday(), week = startOfWeek(), month = startOfMonth();
    var periods = [{ key: 'today', start: today }, { key: 'upcoming', start: week }, { key: 'completedToday', start: month }];
    body.innerHTML = '<div class="driver-kv"><strong>' + esc(t('earningsNoticeTitle')) + '</strong><span>' + esc(t('earningsNoticeBody')) + '</span></div>' +
      '<div class="pk-card__actions"><button class="pk-btn" type="button" data-action="refreshEarnings">' + esc(t('refresh')) + '</button></div>' +
      '<div class="pk-stats">' + periods.map(function (p) {
        var list = rows.filter(function (r) { return earningMs(r) >= p.start; });
        return '<div class="pk-stat"><span class="pk-stat__num">$' + sumFare(list).toFixed(0) + '</span><span class="pk-stat__label">' + esc(t(p.key)) + ' · ' + list.length + '</span></div>';
      }).join('') + '</div><h3>' + esc(t('completedHistory')) + '</h3>' +
      (rows.length ? rows.slice(0, 50).map(earningRow).join('') : '<div class="driver-empty">' + esc(t('noCompleted')) + '</div>');
  }
  function earningRow(r) {
    var route = r._earningType === 'tour' ? (r.packageName || r.pickupAddress || '') : (r.dropoffAddress || r.pickupAddress || r.airport || '');
    return '<div class="driver-kv"><strong>' + esc(r.customerName || '') + '</strong><span>' + esc(route) + ' · $' + Number(r.estimatedPrice || 0).toFixed(0) + '</span></div>';
  }
  function loadDriverRatings() {
    if (state.ratingsLoaded) return;
    db.collection('rideRatings').where('driverId', '==', state.driverId).limit(100).get().then(function (snap) {
      var rows = [];
      snap.forEach(function (doc) { rows.push(doc.data()); });
      renderRatings(rows);
      state.ratingsLoaded = true;
    }).catch(function () {});
  }
  function renderRatings(rows) {
    var block = $('earningsRatingsBlock');
    if (!block || !rows.length) return;
    var total = rows.reduce(function (sum, r) { return sum + (Number(r.rating) || 0); }, 0);
    var avg = total / rows.length;
    block.innerHTML = '<div class="driver-kv"><strong>' + esc(t('ratingsTitle')) + ': ' + avg.toFixed(1) + '</strong><span>' + rows.length + ' ' + esc(t('reviewCount')) + '</span></div>' +
      rows.filter(function (r) { return r.note; }).slice(0, 5).map(function (r) { return '<div class="driver-kv"><strong>' + esc(stars(r.rating)) + '</strong><span>' + esc(r.note) + '</span></div>'; }).join('');
  }

  function renderCalendarPanel() {
    if (!root.DLCCalendar || !$('calendarContent')) return;
    var tours = Object.keys(state.tours).map(function (id) { return Object.assign({ docId: id }, state.tours[id]); });
    var rides = Object.keys(state.rides).map(function (id) { var d = state.rides[id]; return Object.assign({ _id: id, _pickupMs: parsePickupMs(d), _parsedTime: formatTime(parsePickupMs(d)) }, d); });
    root.DLCCalendar.setRefreshFn(renderCalendarPanel);
    root.DLCCalendar.renderCalendar(tours, rides);
  }

  function parsePickupMs(ride) {
    var raw = ride.datetime ||
      (ride.arrivalDate ? ride.arrivalDate + (ride.arrivalTime ? 'T' + ride.arrivalTime : '') : null) ||
      (ride.departureDate ? ride.departureDate + (ride.departureTime ? 'T' + ride.departureTime : '') : null) ||
      (ride.rideDate ? ride.rideDate + (ride.rideTime ? 'T' + ride.rideTime : '') : null) ||
      ride.travelDate || '';
    if (!raw) return 0;
    var s = String(raw).replace(' ', 'T');
    if (s.length <= 10) s += 'T00:00:00';
    var dt = new Date(s);
    return isNaN(dt.getTime()) ? 0 : dt.getTime();
  }
  function toMs(value) {
    if (!value) return 0;
    if (value.toDate) return value.toDate().getTime();
    if (value.seconds) return value.seconds * 1000;
    var ms = new Date(value).getTime();
    return isNaN(ms) ? 0 : ms;
  }
  function formatWhen(ms) { return ms ? new Date(ms).toLocaleString(state.lang === 'vi' ? 'vi-VN' : state.lang === 'es' ? 'es-US' : 'en-US', { month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit' }) : '-'; }
  function formatTime(ms) { return ms ? new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''; }
  function startOfToday() { var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function startOfWeek() { var d = new Date(); d.setHours(0, 0, 0, 0); var day = d.getDay(); d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); return d.getTime(); }
  function startOfMonth() { var d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function isToday(ms) { return !!ms && ms >= startOfToday() && ms < startOfToday() + 86400000; }
  function earningMs(r) { return toMs(r.createdAt) || (r.travelDate ? new Date(r.travelDate + 'T00:00:00').getTime() : 0); }
  function sumFare(rows) { return rows.reduce(function (sum, r) { return sum + (Number(r.estimatedPrice) || 0); }, 0); }
  function stars(n) { var out = ''; var rating = Math.round(Number(n) || 0); for (var i = 1; i <= 5; i += 1) out += i <= rating ? '*' : '-'; return out; }

  initAuth();
})(window);
