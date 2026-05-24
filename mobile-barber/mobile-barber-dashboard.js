'use strict';

(function(root) {
  var DATA = root.MobileBarberData;
  var STORAGE = {
    vendor: 'dlc_mobile_barber_vendor_overrides',
    services: 'dlc_mobile_barber_service_overrides',
    availability: 'dlc_mobile_barber_availability_overrides',
    bookings: 'dlc_mobile_barber_bookings',
    blocks: 'dlc_mobile_barber_unavailable_blocks',
    portfolio: 'dlc_mobile_barber_portfolio_overrides',
    reviews: 'dlc_mobile_barber_review_overrides'
  };

  var STRINGS = {
    en: {
      pageTitle: 'Mobile Barber Dashboard | Du Lich Cali',
      languageLabel: 'Choose language',
      dashboardKicker: 'Vendor dashboard',
      dashboardTitle: 'Mobile Barber Dashboard',
      dashboardSubtitle: '{business} can manage profile, services, hours, blocks, and booking requests here.',
      publicVendorLink: 'View Public Page',
      statToday: 'Today',
      statUpcoming: 'Upcoming',
      statPending: 'Pending',
      todayTitle: "Today's appointments",
      pendingTitle: 'Pending confirmations',
      upcomingTitle: 'Upcoming bookings',
      refreshButton: 'Refresh',
      profileTitle: 'Profile and contact',
      saveButton: 'Save Profile',
      businessNameLabel: 'Business name',
      barberNameLabel: 'Barber name',
      phoneLabel: 'Phone',
      emailLabel: 'Email',
      serviceAreaLabel: 'Service areas',
      travelRadiusLabel: 'Travel radius miles',
      travelFeeLabel: 'Base travel fee',
      servicesManageTitle: 'Services and pricing',
      saveServiceButton: 'Save Service',
      serviceSelectLabel: 'Choose service',
      serviceNameLabel: 'Service name',
      servicePriceLabel: 'Price',
      serviceDurationLabel: 'Duration minutes',
      cleanupBufferLabel: 'Cleanup buffer minutes',
      travelBufferLabel: 'Travel buffer minutes',
      hoursTitle: 'Working hours',
      saveHoursButton: 'Save Hours',
      blocksTitle: 'Unavailable blocks',
      addBlockButton: 'Add Block',
      portfolioTitle: 'Portfolio images',
      portfolioUploadLabel: 'Upload portfolio image',
      portfolioTitleLabel: 'Image title',
      portfolioDescriptionLabel: 'Image description',
      portfolioOrderLabel: 'Display order',
      beforeImageLabel: 'Before image',
      afterImageLabel: 'After image',
      addPortfolioButton: 'Add Image',
      hideAction: 'Hide',
      showAction: 'Show',
      emptyPortfolio: 'No portfolio images yet.',
      reviewsManageTitle: 'Reviews and responses',
      reviewResponseLabel: 'Barber response',
      saveReviewResponsesButton: 'Save Responses',
      emptyReviews: 'No reviews yet.',
      blockDateLabel: 'Date',
      blockStartLabel: 'Start',
      blockEndLabel: 'End',
      blockReasonLabel: 'Reason',
      emptyBookings: 'No bookings in this section.',
      emptyBlocks: 'No unavailable blocks.',
      emptyServices: 'No services yet.',
      customerContact: 'Customer contact',
      customerAddress: 'Service address',
      customerNotes: 'Customer notes',
      customerCutHistory: 'Customer cut history',
      stylePreference: 'Style preference',
      previousService: 'Previous service',
      referencePhotos: 'Reference photos',
      mapLink: 'Map',
      acceptAction: 'Accept',
      rescheduleAction: 'Reschedule',
      cancelAction: 'Cancel',
      savedToast: 'Saved.',
      statusPending: 'Pending confirmation',
      statusConfirmed: 'Confirmed',
      statusVendorReview: 'Vendor review',
      statusRescheduled: 'Rescheduled',
      statusCancelled: 'Cancelled',
      statusCompleted: 'Completed',
      minutesShort: 'min',
      dayMonday: 'Monday',
      dayTuesday: 'Tuesday',
      dayWednesday: 'Wednesday',
      dayThursday: 'Thursday',
      dayFriday: 'Friday',
      daySaturday: 'Saturday',
      daySunday: 'Sunday',
      activeLabel: 'Open'
    },
    vi: {
      pageTitle: 'Bảng Điều Khiển Thợ Cắt Tóc Tại Nhà | Du Lich Cali',
      languageLabel: 'Chọn ngôn ngữ',
      dashboardKicker: 'Bảng điều khiển vendor',
      dashboardTitle: 'Bảng Điều Khiển Mobile Barber',
      dashboardSubtitle: '{business} có thể quản lý hồ sơ, dịch vụ, giờ làm, ngày bận, và yêu cầu đặt lịch tại đây.',
      publicVendorLink: 'Xem Trang Công Khai',
      statToday: 'Hôm nay',
      statUpcoming: 'Sắp tới',
      statPending: 'Chờ xác nhận',
      todayTitle: 'Lịch hẹn hôm nay',
      pendingTitle: 'Yêu cầu chờ xác nhận',
      upcomingTitle: 'Lịch hẹn sắp tới',
      refreshButton: 'Làm mới',
      profileTitle: 'Hồ sơ và liên hệ',
      saveButton: 'Lưu Hồ Sơ',
      businessNameLabel: 'Tên doanh nghiệp',
      barberNameLabel: 'Tên thợ',
      phoneLabel: 'Điện thoại',
      emailLabel: 'Email',
      serviceAreaLabel: 'Khu vực phục vụ',
      travelRadiusLabel: 'Bán kính di chuyển (dặm)',
      travelFeeLabel: 'Phí di chuyển cơ bản',
      servicesManageTitle: 'Dịch vụ và giá',
      saveServiceButton: 'Lưu Dịch Vụ',
      serviceSelectLabel: 'Chọn dịch vụ',
      serviceNameLabel: 'Tên dịch vụ',
      servicePriceLabel: 'Giá',
      serviceDurationLabel: 'Thời lượng (phút)',
      cleanupBufferLabel: 'Thời gian dọn dẹp (phút)',
      travelBufferLabel: 'Thời gian di chuyển (phút)',
      hoursTitle: 'Giờ làm việc',
      saveHoursButton: 'Lưu Giờ',
      blocksTitle: 'Thời gian không nhận lịch',
      addBlockButton: 'Thêm Lịch Bận',
      portfolioTitle: 'Hình portfolio',
      portfolioUploadLabel: 'Tải hình portfolio',
      portfolioTitleLabel: 'Tiêu đề hình',
      portfolioDescriptionLabel: 'Mô tả hình',
      portfolioOrderLabel: 'Thứ tự hiển thị',
      beforeImageLabel: 'Hình trước',
      afterImageLabel: 'Hình sau',
      addPortfolioButton: 'Thêm Hình',
      hideAction: 'Ẩn',
      showAction: 'Hiện',
      emptyPortfolio: 'Chưa có hình portfolio.',
      reviewsManageTitle: 'Đánh giá và phản hồi',
      reviewResponseLabel: 'Phản hồi của thợ',
      saveReviewResponsesButton: 'Lưu Phản Hồi',
      emptyReviews: 'Chưa có đánh giá.',
      blockDateLabel: 'Ngày',
      blockStartLabel: 'Bắt đầu',
      blockEndLabel: 'Kết thúc',
      blockReasonLabel: 'Lý do',
      emptyBookings: 'Không có lịch trong mục này.',
      emptyBlocks: 'Chưa có thời gian không nhận lịch.',
      emptyServices: 'Chưa có dịch vụ.',
      customerContact: 'Liên hệ khách',
      customerAddress: 'Địa chỉ phục vụ',
      customerNotes: 'Ghi chú khách hàng',
      customerCutHistory: 'Lịch sử cắt tóc của khách',
      stylePreference: 'Kiểu tóc ưa thích',
      previousService: 'Dịch vụ lần trước',
      referencePhotos: 'Ảnh tham khảo',
      mapLink: 'Bản đồ',
      acceptAction: 'Nhận lịch',
      rescheduleAction: 'Đổi lịch',
      cancelAction: 'Hủy',
      savedToast: 'Đã lưu.',
      statusPending: 'Chờ xác nhận',
      statusConfirmed: 'Đã xác nhận',
      statusVendorReview: 'Vendor xem xét',
      statusRescheduled: 'Đã đổi lịch',
      statusCancelled: 'Đã hủy',
      statusCompleted: 'Hoàn tất',
      minutesShort: 'phút',
      dayMonday: 'Thứ Hai',
      dayTuesday: 'Thứ Ba',
      dayWednesday: 'Thứ Tư',
      dayThursday: 'Thứ Năm',
      dayFriday: 'Thứ Sáu',
      daySaturday: 'Thứ Bảy',
      daySunday: 'Chủ Nhật',
      activeLabel: 'Mở'
    },
    es: {
      pageTitle: 'Panel de Barbero Móvil | Du Lich Cali',
      languageLabel: 'Elegir idioma',
      dashboardKicker: 'Panel del vendedor',
      dashboardTitle: 'Panel de Barbero Móvil',
      dashboardSubtitle: '{business} puede administrar perfil, servicios, horarios, bloqueos, y solicitudes de reserva aquí.',
      publicVendorLink: 'Ver Página Pública',
      statToday: 'Hoy',
      statUpcoming: 'Próximas',
      statPending: 'Pendientes',
      todayTitle: 'Citas de hoy',
      pendingTitle: 'Confirmaciones pendientes',
      upcomingTitle: 'Reservas próximas',
      refreshButton: 'Actualizar',
      profileTitle: 'Perfil y contacto',
      saveButton: 'Guardar Perfil',
      businessNameLabel: 'Nombre del negocio',
      barberNameLabel: 'Nombre del barbero',
      phoneLabel: 'Teléfono',
      emailLabel: 'Email',
      serviceAreaLabel: 'Áreas de servicio',
      travelRadiusLabel: 'Radio de viaje en millas',
      travelFeeLabel: 'Tarifa base de viaje',
      servicesManageTitle: 'Servicios y precios',
      saveServiceButton: 'Guardar Servicio',
      serviceSelectLabel: 'Elegir servicio',
      serviceNameLabel: 'Nombre del servicio',
      servicePriceLabel: 'Precio',
      serviceDurationLabel: 'Duración en minutos',
      cleanupBufferLabel: 'Tiempo de limpieza en minutos',
      travelBufferLabel: 'Tiempo de viaje en minutos',
      hoursTitle: 'Horario de trabajo',
      saveHoursButton: 'Guardar Horario',
      blocksTitle: 'Bloques no disponibles',
      addBlockButton: 'Agregar Bloque',
      portfolioTitle: 'Imágenes del portafolio',
      portfolioUploadLabel: 'Subir imagen del portafolio',
      portfolioTitleLabel: 'Título de la imagen',
      portfolioDescriptionLabel: 'Descripción de la imagen',
      portfolioOrderLabel: 'Orden de visualización',
      beforeImageLabel: 'Imagen antes',
      afterImageLabel: 'Imagen después',
      addPortfolioButton: 'Agregar Imagen',
      hideAction: 'Ocultar',
      showAction: 'Mostrar',
      emptyPortfolio: 'Todavía no hay imágenes.',
      reviewsManageTitle: 'Reseñas y respuestas',
      reviewResponseLabel: 'Respuesta del barbero',
      saveReviewResponsesButton: 'Guardar Respuestas',
      emptyReviews: 'Todavía no hay reseñas.',
      blockDateLabel: 'Fecha',
      blockStartLabel: 'Inicio',
      blockEndLabel: 'Fin',
      blockReasonLabel: 'Razón',
      emptyBookings: 'No hay reservas en esta sección.',
      emptyBlocks: 'No hay bloques no disponibles.',
      emptyServices: 'Todavía no hay servicios.',
      customerContact: 'Contacto del cliente',
      customerAddress: 'Dirección del servicio',
      customerNotes: 'Notas del cliente',
      customerCutHistory: 'Historial de cortes del cliente',
      stylePreference: 'Preferencia de estilo',
      previousService: 'Servicio anterior',
      referencePhotos: 'Fotos de referencia',
      mapLink: 'Mapa',
      acceptAction: 'Aceptar',
      rescheduleAction: 'Reprogramar',
      cancelAction: 'Cancelar',
      savedToast: 'Guardado.',
      statusPending: 'Pendiente de confirmación',
      statusConfirmed: 'Confirmada',
      statusVendorReview: 'Revisión del vendedor',
      statusRescheduled: 'Reprogramada',
      statusCancelled: 'Cancelada',
      statusCompleted: 'Completada',
      minutesShort: 'min',
      dayMonday: 'Lunes',
      dayTuesday: 'Martes',
      dayWednesday: 'Miércoles',
      dayThursday: 'Jueves',
      dayFriday: 'Viernes',
      daySaturday: 'Sábado',
      daySunday: 'Domingo',
      activeLabel: 'Abierto'
    }
  };

  var DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  var STATUS_LABELS = {
    pending_confirmation: 'statusPending',
    confirmed: 'statusConfirmed',
    vendor_review: 'statusVendorReview',
    rescheduled: 'statusRescheduled',
    cancelled: 'statusCancelled',
    completed: 'statusCompleted'
  };
  var state = {
    lang: 'en',
    vendorId: '',
    vendor: null,
    services: [],
    availability: null,
    bookings: [],
    blocks: [],
    portfolio: [],
    reviews: []
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function trim(value) {
    return String(value == null ? '' : value).trim();
  }

  function t(key) {
    return (STRINGS[state.lang] && STRINGS[state.lang][key]) || STRINGS.en[key] || '';
  }

  function interpolate(template, values) {
    return String(template || '').replace(/\{(\w+)\}/g, function(_, key) {
      return values[key] == null ? '' : values[key];
    });
  }

  function readJson(key, fallback) {
    try {
      var raw = root.localStorage && root.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      if (root.localStorage) root.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }

  function getVendorId() {
    var params = new URLSearchParams(root.location.search);
    return params.get('vendorId') || params.get('id') || (DATA && DATA.SAMPLE_VENDOR_ID) || '';
  }

  function getTodayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function canUseFirestore() {
    return typeof root.firebase !== 'undefined' && root.firebase.firestore && root.firebase.apps && root.firebase.apps.length;
  }

  function loadVendor() {
    var base = DATA && DATA.findVendorById ? DATA.findVendorById(state.vendorId) : null;
    var overrides = readJson(STORAGE.vendor, {});
    state.vendor = Object.assign({}, clone(base || {}), overrides[state.vendorId] || {});
  }

  function loadServices() {
    var base = DATA && DATA.listServicesForVendor ? DATA.listServicesForVendor(state.vendorId).map(clone) : [];
    var overrides = readJson(STORAGE.services, {});
    state.services = (overrides[state.vendorId] || base).filter(function(service) {
      return service.vendorId === state.vendorId;
    });
  }

  function loadAvailability() {
    var baseRows = DATA && DATA.sampleAvailability ? DATA.sampleAvailability : [];
    var base = baseRows.find(function(row) { return row.vendorId === state.vendorId; }) || { vendorId: state.vendorId, weeklyHours: {} };
    var overrides = readJson(STORAGE.availability, {});
    state.availability = Object.assign({}, clone(base), overrides[state.vendorId] || {});
    state.availability.weeklyHours = state.availability.weeklyHours || {};
  }

  function loadBookings() {
    state.bookings = readJson(STORAGE.bookings, []).filter(function(booking) {
      return booking.vendorId === state.vendorId;
    });
  }

  function loadBlocks() {
    var blocks = readJson(STORAGE.blocks, {});
    state.blocks = (blocks[state.vendorId] || []).slice();
  }

  function loadPortfolio() {
    var overrides = readJson(STORAGE.portfolio, {});
    var base = DATA && DATA.listPortfolioForVendor ? DATA.listPortfolioForVendor(state.vendorId, null, true).map(clone) : [];
    state.portfolio = (overrides[state.vendorId] || base).filter(function(image) {
      return image.vendorId === state.vendorId;
    }).sort(function(a, b) {
      return (Number(a.displayOrder || 0) - Number(b.displayOrder || 0));
    });
  }

  function loadReviews() {
    var overrides = readJson(STORAGE.reviews, {});
    var base = DATA && DATA.listReviewsForVendor ? DATA.listReviewsForVendor(state.vendorId, null, true).map(clone) : [];
    state.reviews = (overrides[state.vendorId] || base).filter(function(review) {
      return review.vendorId === state.vendorId;
    });
  }

  function persistVendor() {
    var rows = readJson(STORAGE.vendor, {});
    rows[state.vendorId] = state.vendor;
    writeJson(STORAGE.vendor, rows);
    if (canUseFirestore()) {
      root.firebase.firestore().collection(DATA.COLLECTIONS.vendors).doc(state.vendorId).set(state.vendor, { merge: true });
    }
  }

  function persistServices() {
    var rows = readJson(STORAGE.services, {});
    rows[state.vendorId] = state.services;
    writeJson(STORAGE.services, rows);
  }

  function persistAvailability() {
    var rows = readJson(STORAGE.availability, {});
    rows[state.vendorId] = state.availability;
    writeJson(STORAGE.availability, rows);
  }

  function persistBlocks() {
    var rows = readJson(STORAGE.blocks, {});
    rows[state.vendorId] = state.blocks;
    writeJson(STORAGE.blocks, rows);
  }

  function persistPortfolio() {
    var rows = readJson(STORAGE.portfolio, {});
    rows[state.vendorId] = state.portfolio;
    writeJson(STORAGE.portfolio, rows);
  }

  function persistReviews() {
    var rows = readJson(STORAGE.reviews, {});
    rows[state.vendorId] = state.reviews;
    writeJson(STORAGE.reviews, rows);
  }

  function updateBookingStatus(bookingId, status) {
    var all = readJson(STORAGE.bookings, []);
    all = all.map(function(booking) {
      if (booking.id !== bookingId) return booking;
      return Object.assign({}, booking, { status: status, updatedAt: new Date().toISOString() });
    });
    writeJson(STORAGE.bookings, all);
    if (canUseFirestore()) {
      root.firebase.firestore().collection(DATA.COLLECTIONS.bookings).doc(bookingId).set({
        status: status,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
    loadBookings();
    render();
  }

  function el(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function setTranslatedText() {
    document.querySelectorAll('[data-i18n]').forEach(function(node) {
      node.textContent = t(node.getAttribute('data-i18n'));
    });
  }

  function showToast() {
    var toast = document.getElementById('mbDashboardToast');
    toast.textContent = t('savedToast');
    toast.hidden = false;
    root.setTimeout(function() { toast.hidden = true; }, 1800);
  }

  function mapUrl(booking) {
    var address = [booking.address, booking.city, booking.zip].filter(Boolean).join(', ');
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address);
  }

  function statusLabel(status) {
    return t(STATUS_LABELS[status] || 'statusPending');
  }

  function bookingCard(booking) {
    var card = el('article', 'mb-booking-card');
    var title = el('h3');
    var meta = el('p', 'mb-booking-card__meta');
    var contact = el('p');
    var address = el('p');
    var actions = el('div', 'mb-booking-card__actions');

    title.textContent = booking.customerName || booking.serviceName || booking.id;
    meta.textContent = [booking.requestedDate, booking.startTime, booking.endTime, statusLabel(booking.status)].filter(Boolean).join(' • ');
    contact.textContent = t('customerContact') + ': ' + [booking.customerPhone, booking.customerEmail].filter(Boolean).join(' / ');
    address.textContent = t('customerAddress') + ': ' + [booking.address, booking.city, booking.zip].filter(Boolean).join(', ');

    if (trim(booking.address)) {
      var link = el('a', 'mb-button mb-button--ghost mb-button--sm');
      link.href = mapUrl(booking);
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = t('mapLink');
      actions.appendChild(link);
    }

    [
      ['confirmed', 'acceptAction'],
      ['rescheduled', 'rescheduleAction'],
      ['cancelled', 'cancelAction']
    ].forEach(function(pair) {
      var btn = el('button', 'mb-button mb-button--ghost mb-button--sm');
      btn.type = 'button';
      btn.textContent = t(pair[1]);
      btn.addEventListener('click', function() { updateBookingStatus(booking.id, pair[0]); });
      actions.appendChild(btn);
    });

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(contact);
    card.appendChild(address);
    if (trim(booking.notes)) {
      var notes = el('p');
      notes.textContent = t('customerNotes') + ': ' + booking.notes;
      card.appendChild(notes);
    }
    if (trim(booking.stylePreference) || trim(booking.previousServiceName) || trim(booking.rebookedFromBookingId)) {
      var history = el('p');
      history.textContent = t('customerCutHistory') + ': ' + [
        trim(booking.previousServiceName) ? t('previousService') + ' ' + booking.previousServiceName : '',
        trim(booking.stylePreference) ? t('stylePreference') + ' ' + booking.stylePreference : '',
        trim(booking.rebookedFromBookingId) ? booking.rebookedFromBookingId : ''
      ].filter(Boolean).join(' • ');
      card.appendChild(history);
    }
    if (Array.isArray(booking.photoUrls) && booking.photoUrls.length) {
      var photos = el('p');
      photos.textContent = t('referencePhotos') + ': ' + booking.photoUrls.join(', ');
      card.appendChild(photos);
    }
    card.appendChild(actions);
    return card;
  }

  function renderBookingList(id, rows) {
    var list = document.getElementById(id);
    list.innerHTML = '';
    if (!rows.length) {
      var empty = el('div', 'mb-empty');
      empty.textContent = t('emptyBookings');
      list.appendChild(empty);
      return;
    }
    rows.forEach(function(booking) {
      list.appendChild(bookingCard(booking));
    });
  }

  function renderBookings() {
    var today = getTodayIso();
    var active = state.bookings.filter(function(booking) { return booking.status !== 'cancelled' && booking.status !== 'completed'; });
    var todayRows = active.filter(function(booking) { return booking.requestedDate === today; });
    var upcomingRows = active.filter(function(booking) { return booking.requestedDate >= today; })
      .sort(function(a, b) { return (a.requestedDate + a.startTime).localeCompare(b.requestedDate + b.startTime); });
    var pendingRows = active.filter(function(booking) {
      return booking.status === 'pending_confirmation' || booking.status === 'vendor_review';
    });
    document.getElementById('mbStatToday').textContent = todayRows.length;
    document.getElementById('mbStatUpcoming').textContent = upcomingRows.length;
    document.getElementById('mbStatPending').textContent = pendingRows.length;
    renderBookingList('mbTodayList', todayRows);
    renderBookingList('mbPendingList', pendingRows);
    renderBookingList('mbUpcomingList', upcomingRows);
  }

  function renderProfileForm() {
    document.getElementById('mbDashboardSubtitle').textContent = interpolate(t('dashboardSubtitle'), { business: state.vendor.businessName || '' });
    var publicLink = document.getElementById('mbPublicVendorLink');
    publicLink.href = '/mobile-barber/vendor/' + encodeURIComponent(state.vendorId);
    publicLink.textContent = t('publicVendorLink');
    document.getElementById('mbDashBusinessName').value = state.vendor.businessName || '';
    document.getElementById('mbDashBarberName').value = state.vendor.barberName || '';
    document.getElementById('mbDashPhone').value = state.vendor.phone || '';
    document.getElementById('mbDashEmail').value = state.vendor.email || '';
    document.getElementById('mbDashServiceAreas').value = (state.vendor.serviceAreas || []).join(', ');
    document.getElementById('mbDashTravelRadius').value = state.vendor.travelRadiusMiles || 0;
    document.getElementById('mbDashTravelFee').value = state.vendor.baseTravelFee || 0;
  }

  function renderServiceForm() {
    var select = document.getElementById('mbDashServiceSelect');
    var selected = select.value || (state.services[0] && state.services[0].id) || '';
    select.innerHTML = '';
    state.services.forEach(function(service) {
      var option = document.createElement('option');
      option.value = service.id;
      option.textContent = service.name;
      select.appendChild(option);
    });
    select.value = state.services.some(function(service) { return service.id === selected; }) ? selected : ((state.services[0] && state.services[0].id) || '');
    fillSelectedService();

    var list = document.getElementById('mbServicesManageList');
    list.innerHTML = '';
    if (!state.services.length) {
      var empty = el('div', 'mb-empty');
      empty.textContent = t('emptyServices');
      list.appendChild(empty);
      return;
    }
    state.services.forEach(function(service) {
      var row = el('div', 'mb-service-admin-row');
      row.textContent = service.name + ' • $' + Number(service.price || 0).toFixed(0) + ' • ' + service.durationMinutes + ' ' + t('minutesShort');
      list.appendChild(row);
    });
  }

  function fillSelectedService() {
    var id = document.getElementById('mbDashServiceSelect').value;
    var service = state.services.find(function(row) { return row.id === id; }) || {};
    document.getElementById('mbDashServiceName').value = service.name || '';
    document.getElementById('mbDashServicePrice').value = service.price || 0;
    document.getElementById('mbDashServiceDuration').value = service.durationMinutes || 30;
    document.getElementById('mbDashCleanupBuffer').value = service.cleanupBufferMinutes || 0;
    document.getElementById('mbDashTravelBuffer').value = service.travelBufferMinutes || 0;
  }

  function renderHours() {
    var grid = document.getElementById('mbHoursGrid');
    grid.innerHTML = '';
    DAYS.forEach(function(day) {
      var row = el('div', 'mb-hours-row');
      var label = el('label');
      var active = document.createElement('input');
      var start = document.createElement('input');
      var end = document.createElement('input');
      var hours = state.availability.weeklyHours[day] || {};
      active.type = 'checkbox';
      active.checked = hours.active !== false;
      active.dataset.day = day;
      active.dataset.field = 'active';
      start.type = 'time';
      start.value = hours.start || '10:00';
      start.dataset.day = day;
      start.dataset.field = 'start';
      end.type = 'time';
      end.value = hours.end || '18:00';
      end.dataset.day = day;
      end.dataset.field = 'end';
      label.appendChild(active);
      label.appendChild(document.createTextNode(' ' + t('day' + day.charAt(0).toUpperCase() + day.slice(1))));
      row.appendChild(label);
      row.appendChild(start);
      row.appendChild(end);
      grid.appendChild(row);
    });
  }

  function renderBlocks() {
    var list = document.getElementById('mbBlocksList');
    list.innerHTML = '';
    if (!state.blocks.length) {
      var empty = el('div', 'mb-empty');
      empty.textContent = t('emptyBlocks');
      list.appendChild(empty);
      return;
    }
    state.blocks.forEach(function(block) {
      var row = el('div', 'mb-service-admin-row');
      row.textContent = [block.date, block.startTime, block.endTime, block.reason].filter(Boolean).join(' • ');
      list.appendChild(row);
    });
  }

  function selectedFileName(id) {
    var input = document.getElementById(id);
    return input && input.files && input.files[0] ? input.files[0].name : '';
  }

  function renderPortfolio() {
    var list = document.getElementById('mbPortfolioManageList');
    list.innerHTML = '';
    if (!state.portfolio.length) {
      var empty = el('div', 'mb-empty');
      empty.textContent = t('emptyPortfolio');
      list.appendChild(empty);
      return;
    }
    state.portfolio.forEach(function(image) {
      var row = el('div', 'mb-service-admin-row mb-portfolio-admin-row');
      var info = el('span');
      var toggle = el('button', 'mb-button mb-button--ghost mb-button--sm');
      info.textContent = [
        '#' + Number(image.displayOrder || 0),
        image.title,
        image.hidden ? t('hideAction') : ''
      ].filter(Boolean).join(' • ');
      toggle.type = 'button';
      toggle.textContent = image.hidden ? t('showAction') : t('hideAction');
      toggle.addEventListener('click', function() {
        image.hidden = !image.hidden;
        image.updatedAt = new Date().toISOString();
        persistPortfolio();
        renderPortfolio();
        showToast();
      });
      row.appendChild(info);
      row.appendChild(toggle);
      list.appendChild(row);
    });
  }

  function renderReviews() {
    var list = document.getElementById('mbReviewsManageList');
    list.innerHTML = '';
    if (!state.reviews.length) {
      var empty = el('div', 'mb-empty');
      empty.textContent = t('emptyReviews');
      list.appendChild(empty);
      return;
    }
    state.reviews.forEach(function(review) {
      var row = el('label', 'mb-review-admin-row');
      var title = el('span');
      var response = document.createElement('textarea');
      title.textContent = (review.customerName || review.id) + ' • ' + Number(review.rating || 0).toFixed(1) + ' ★';
      response.rows = 3;
      response.dataset.reviewId = review.id;
      response.value = review.vendorResponse || '';
      row.appendChild(title);
      row.appendChild(document.createTextNode(t('reviewResponseLabel')));
      row.appendChild(response);
      list.appendChild(row);
    });
  }

  function addPortfolioImage() {
    var title = trim(document.getElementById('mbPortfolioTitleInput').value);
    var imageFile = selectedFileName('mbPortfolioUpload');
    var beforeFile = selectedFileName('mbPortfolioBeforeUpload');
    var afterFile = selectedFileName('mbPortfolioAfterUpload');
    if (!title || (!imageFile && !beforeFile && !afterFile)) return;
    state.portfolio.push({
      id: 'portfolio-' + Date.now().toString(36),
      vendorId: state.vendorId,
      title: title,
      description: trim(document.getElementById('mbPortfolioDescription').value),
      imageUrl: imageFile,
      beforeImageUrl: beforeFile,
      afterImageUrl: afterFile,
      alt: title,
      displayOrder: Number(document.getElementById('mbPortfolioOrder').value || (state.portfolio.length + 1) * 10),
      hidden: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    persistPortfolio();
    renderPortfolio();
    showToast();
  }

  function saveReviewResponses() {
    var byId = {};
    document.querySelectorAll('#mbReviewsManageList textarea[data-review-id]').forEach(function(input) {
      byId[input.dataset.reviewId] = input.value;
    });
    state.reviews = state.reviews.map(function(review) {
      if (!Object.prototype.hasOwnProperty.call(byId, review.id)) return review;
      return Object.assign({}, review, {
        vendorResponse: trim(byId[review.id]),
        updatedAt: new Date().toISOString()
      });
    });
    persistReviews();
    renderReviews();
    showToast();
  }

  function saveProfile() {
    state.vendor.businessName = trim(document.getElementById('mbDashBusinessName').value);
    state.vendor.barberName = trim(document.getElementById('mbDashBarberName').value);
    state.vendor.phone = trim(document.getElementById('mbDashPhone').value);
    state.vendor.email = trim(document.getElementById('mbDashEmail').value);
    state.vendor.serviceAreas = trim(document.getElementById('mbDashServiceAreas').value).split(',').map(trim).filter(Boolean);
    state.vendor.travelRadiusMiles = Number(document.getElementById('mbDashTravelRadius').value || 0);
    state.vendor.baseTravelFee = Number(document.getElementById('mbDashTravelFee').value || 0);
    state.vendor.updatedAt = new Date().toISOString();
    persistVendor();
    renderProfileForm();
    showToast();
  }

  function saveService() {
    var id = document.getElementById('mbDashServiceSelect').value;
    state.services = state.services.map(function(service) {
      if (service.id !== id) return service;
      return Object.assign({}, service, {
        name: trim(document.getElementById('mbDashServiceName').value),
        price: Number(document.getElementById('mbDashServicePrice').value || 0),
        durationMinutes: Number(document.getElementById('mbDashServiceDuration').value || 0),
        cleanupBufferMinutes: Number(document.getElementById('mbDashCleanupBuffer').value || 0),
        travelBufferMinutes: Number(document.getElementById('mbDashTravelBuffer').value || 0)
      });
    });
    persistServices();
    renderServiceForm();
    showToast();
  }

  function saveHours() {
    state.availability.weeklyHours = state.availability.weeklyHours || {};
    document.querySelectorAll('#mbHoursGrid input').forEach(function(input) {
      var day = input.dataset.day;
      var field = input.dataset.field;
      state.availability.weeklyHours[day] = state.availability.weeklyHours[day] || {};
      state.availability.weeklyHours[day][field] = field === 'active' ? input.checked : input.value;
    });
    state.availability.updatedAt = new Date().toISOString();
    persistAvailability();
    showToast();
  }

  function addBlock() {
    var block = {
      id: 'block-' + Date.now().toString(36),
      vendorId: state.vendorId,
      date: document.getElementById('mbBlockDate').value,
      startTime: document.getElementById('mbBlockStart').value,
      endTime: document.getElementById('mbBlockEnd').value,
      reason: trim(document.getElementById('mbBlockReason').value),
      createdAt: new Date().toISOString()
    };
    if (!block.date || !block.startTime || !block.endTime) return;
    state.blocks.push(block);
    persistBlocks();
    renderBlocks();
    showToast();
  }

  function render() {
    setTranslatedText();
    document.title = t('pageTitle');
    document.documentElement.lang = state.lang;
    document.getElementById('mbDashboardLanguage').setAttribute('aria-label', t('languageLabel'));
    document.querySelectorAll('.mb-language__button').forEach(function(btn) {
      btn.classList.toggle('mb-language__button--active', btn.getAttribute('data-lang') === state.lang);
    });
    renderProfileForm();
    renderServiceForm();
    renderHours();
    renderBlocks();
    renderPortfolio();
    renderReviews();
    renderBookings();
  }

  function setLang(lang) {
    if (!STRINGS[lang]) return;
    state.lang = lang;
    try {
      root.localStorage.setItem('dlcLang', lang);
      root.localStorage.setItem('dlc_lang', lang);
    } catch (e) {}
    render();
  }

  function bind() {
    document.querySelectorAll('[data-lang]').forEach(function(btn) {
      btn.addEventListener('click', function() { setLang(btn.getAttribute('data-lang')); });
    });
    document.querySelector('[data-action="refresh"]').addEventListener('click', function() {
      loadBookings();
      renderBookings();
    });
    document.querySelector('[data-action="saveProfile"]').addEventListener('click', saveProfile);
    document.querySelector('[data-action="saveService"]').addEventListener('click', saveService);
    document.querySelector('[data-action="saveHours"]').addEventListener('click', saveHours);
    document.querySelector('[data-action="addBlock"]').addEventListener('click', addBlock);
    document.querySelector('[data-action="addPortfolio"]').addEventListener('click', addPortfolioImage);
    document.querySelector('[data-action="saveReviewResponses"]').addEventListener('click', saveReviewResponses);
    document.getElementById('mbDashServiceSelect').addEventListener('change', fillSelectedService);
  }

  function initLang() {
    var params = new URLSearchParams(root.location.search);
    var lang = params.get('lang');
    if (STRINGS[lang]) return lang;
    try {
      var saved = root.localStorage.getItem('dlc_lang') || root.localStorage.getItem('dlcLang');
      if (STRINGS[saved]) return saved;
    } catch (e) {}
    return 'en';
  }

  function init() {
    state.vendorId = getVendorId();
    state.lang = initLang();
    loadVendor();
    loadServices();
    loadAvailability();
    loadBookings();
    loadBlocks();
    loadPortfolio();
    loadReviews();
    bind();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
