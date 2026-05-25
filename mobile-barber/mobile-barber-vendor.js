'use strict';

(function(root) {
  var DATA = root.MobileBarberData;
  var BOOKING = root.MobileBarberBooking;
  var AGENT = root.MobileBarberAgent;

  var STRINGS = {
    en: {
      pageTitleSuffix: ' | Mobile Barber | Du Lich Cali',
      languageLabel: 'Choose language',
      vendorKicker: 'Single mobile barber profile',
      servicesKicker: 'Services',
      servicesTitle: 'Services and prices',
      trustKicker: 'Trust',
      portfolioTitle: 'Barber portfolio',
      portfolioEmpty: 'Portfolio photos are being updated. Bookings still use the verified service menu and availability check.',
      aiSampleDisclaimer: 'Sample AI-generated style preview. Real barber portfolio coming soon.',
      aiSampleBadge: 'AI sample preview',
      aiSampleBeforePlaceholder: 'Before — AI sample preview',
      aiSampleAfterPlaceholder: 'After — AI sample preview',
      beforeLabel: 'Before',
      afterLabel: 'After',
      reviewsTitle: 'Reviews and ratings',
      reviewsEmpty: 'Reviews are not published yet for this barber.',
      ratingLabel: 'Rating',
      reviewResponseLabel: 'Barber response',
      serviceBadgesLabel: 'Service badges',
      bookingKicker: 'Booking',
      bookingTitle: 'Request this barber',
      selectedServiceLabel: 'Selected service',
      selectService: 'Select Service',
      selectedServiceReady: '{service} selected for this barber.',
      aiBookingButton: 'AI Booking Assistant',
      voiceBookingButton: 'Talk to Barber Assistant',
      manualBookingButton: 'Manual Booking',
      promoKicker: 'Service preview',
      promoTitle: 'In-home cuts with a polished barber finish.',
      promoCopy: 'Swipe through this barber’s service menu — fades, beard work, kids cuts, and business styles.',
      promoCta: 'Book an in-home haircut today',
      manualBookingTitle: 'In-home haircut request',
      closeManualBooking: 'Close booking form',
      serviceLabel: 'Service',
      dateLabel: 'Preferred date',
      timeLabel: 'Preferred time',
      addressLabel: 'Home or service address',
      cityLabel: 'City',
      zipLabel: 'ZIP code',
      moreDetails: 'More details (optional)',
      notesLabel: 'Customer notes',
      photoLabel: 'Reference photo',
      customerAccountKicker: 'Customer account',
      customerAccountTitle: 'Your booking history',
      customerAccountCopy: 'Look up this barber only. Full service addresses stay private and are not shown on public lists.',
      stylePreferenceLabel: 'Style preference',
      savedNotesLabel: 'Saved notes',
      stylePhotosLabel: 'Style photos',
      loadHistoryButton: 'Load history',
      savePreferenceButton: 'Save preferences',
      upcomingHistoryTitle: 'Upcoming appointments',
      pastHistoryTitle: 'Past haircuts',
      historyEmpty: 'No bookings found for this phone yet.',
      rebookButton: 'Rebook',
      previousServiceLabel: 'Previous service',
      historyDateLabel: 'Date',
      preferenceSaved: 'Preferences saved on this device.',
      nameLabel: 'Name',
      phoneInputLabel: 'Phone',
      emailLabel: 'Email (optional)',
      backButton: 'Back',
      nextButton: 'Next',
      reviewButton: 'Check availability',
      confirmButton: 'Confirm request',
      step1Label: 'Step 1 / 3 — Service',
      step2Label: 'Step 2 / 3 — Address',
      step3Label: 'Step 3 / 3 — Contact',
      requiredError: 'Please complete the required fields for this step.',
      availabilityError: 'This time is not available. Please choose another date or time.',
      overlapError: 'This barber already has an appointment that overlaps with your request.',
      reviewAreaNotice: 'This address is outside the normal service area. You can send it for barber review before it is confirmed.',
      summaryTitle: 'Review before sending',
      summaryTime: '{date} from {start} to {end}',
      summaryPrice: 'Estimated total: {price}',
      summaryDuration: 'Estimated time: {minutes} min including cleanup and travel buffer.',
      pendingStatusCopy: 'Your request will be pending until this barber confirms the slot.',
      vendorReviewStatusCopy: 'This request will be marked for vendor review because the service area needs manual approval.',
      bookingSaved: 'Request sent. Booking ID: {id}',
      bookingQueuedLocal: 'Your request was queued on this device while we reconnect. The barber will see it once you are online. Booking ID: {id}',
      finalSummaryTitle: 'Booking request sent',
      finalSummaryNote: 'To cancel or reschedule, contact the barber before the appointment time.',
      finalSummaryCustomer: 'Customer',
      finalSummaryBarber: 'Barber',
      finalSummaryService: 'Service',
      finalSummaryDateTime: 'Date and time',
      finalSummaryDuration: 'Estimated duration',
      finalSummaryPrice: 'Price',
      finalSummaryAddress: 'Address',
      finalSummaryPhone: 'Contact phone',
      notificationQueued: 'Confirmation message prepared.',
      bookingSaveError: 'The request could not be saved. Please call the barber directly.',
      assistantKicker: 'Vendor-scoped AI assistant',
      assistantTitle: 'AI booking assistant for {vendor}',
      assistantCopy: 'This intake is scoped to {vendorId}. It checks service area, service price, schedule, travel buffer, and overlapping bookings before sending a request.',
      assistantClose: 'Close',
      agentInputLabel: 'Message',
      agentInputPlaceholder: 'Example: I need a haircut at home tomorrow after 5 PM in Westminster.',
      agentSendButton: 'Send',
      errorKicker: 'Mobile barber',
      errorTitle: 'Barber profile not found',
      errorCopy: 'This mobile barber vendor ID is not available. Please return to the mobile barber page and choose an active profile.',
      backToMobileBarber: 'Back to Mobile Barber',
      phoneLabel: 'Call',
      serviceAreaLabel: 'Service area',
      radiusLabel: 'Travel radius',
      travelFeeLabel: 'Base travel fee',
      languagesLabel: 'Languages',
      priceLabel: 'Price',
      durationLabel: 'Duration',
      travelBufferLabel: 'Travel buffer',
      cleanupLabel: 'Cleanup',
      minutes: 'min',
      availabilityOpen: 'Availability preview: {days} from {start} to {end}. Bookings stay pending until this barber confirms the slot.',
      availabilityClosed: 'Availability preview is not available for this barber yet.',
      serviceFallback: 'Service details are being updated.'
    },
    vi: {
      pageTitleSuffix: ' | Thợ Cắt Tóc Tại Nhà | Du Lich Cali',
      languageLabel: 'Chọn ngôn ngữ',
      vendorKicker: 'Hồ sơ một thợ cắt tóc',
      servicesKicker: 'Dịch vụ',
      servicesTitle: 'Dịch vụ và giá',
      trustKicker: 'Uy tín',
      portfolioTitle: 'Portfolio của thợ',
      portfolioEmpty: 'Hình portfolio đang được cập nhật. Việc đặt lịch vẫn dùng menu dịch vụ và kiểm tra lịch trống.',
      aiSampleDisclaimer: 'Mẫu xem trước phong cách do AI tạo. Portfolio thật của thợ sắp ra mắt.',
      aiSampleBadge: 'Mẫu xem trước do AI',
      aiSampleBeforePlaceholder: 'Trước — mẫu AI',
      aiSampleAfterPlaceholder: 'Sau — mẫu AI',
      beforeLabel: 'Trước',
      afterLabel: 'Sau',
      reviewsTitle: 'Đánh giá và điểm sao',
      reviewsEmpty: 'Thợ này chưa công khai đánh giá.',
      ratingLabel: 'Điểm đánh giá',
      reviewResponseLabel: 'Phản hồi của thợ',
      serviceBadgesLabel: 'Huy hiệu dịch vụ',
      bookingKicker: 'Đặt lịch',
      bookingTitle: 'Yêu cầu đúng thợ này',
      selectedServiceLabel: 'Dịch vụ đã chọn',
      selectService: 'Chọn Dịch Vụ',
      selectedServiceReady: 'Đã chọn {service} cho thợ này.',
      aiBookingButton: 'Trợ Lý AI Đặt Lịch',
      voiceBookingButton: 'Nói chuyện với Trợ Lý Barber',
      manualBookingButton: 'Đặt Lịch Thủ Công',
      promoKicker: 'Xem trước dịch vụ',
      promoTitle: 'Cắt tóc tận nhà với phong cách barber chuyên nghiệp.',
      promoCopy: 'Lướt qua menu dịch vụ của thợ — fade, tỉa râu, cắt tóc trẻ em, và kiểu công sở.',
      promoCta: 'Đặt lịch cắt tóc tại nhà hôm nay',
      manualBookingTitle: 'Yêu cầu cắt tóc tại nhà',
      closeManualBooking: 'Đóng form đặt lịch',
      serviceLabel: 'Dịch vụ',
      dateLabel: 'Ngày muốn đặt',
      timeLabel: 'Giờ muốn đặt',
      addressLabel: 'Địa chỉ nhà hoặc nơi phục vụ',
      cityLabel: 'Thành phố',
      zipLabel: 'Mã ZIP',
      moreDetails: 'Thêm chi tiết (không bắt buộc)',
      notesLabel: 'Ghi chú khách hàng',
      photoLabel: 'Ảnh tham khảo',
      customerAccountKicker: 'Tài khoản khách',
      customerAccountTitle: 'Lịch đặt của bạn',
      customerAccountCopy: 'Chỉ tra cứu cho đúng thợ này. Địa chỉ phục vụ đầy đủ được giữ riêng tư và không hiện trong danh sách công khai.',
      stylePreferenceLabel: 'Kiểu tóc ưa thích',
      savedNotesLabel: 'Ghi chú đã lưu',
      stylePhotosLabel: 'Ảnh kiểu tóc',
      loadHistoryButton: 'Tải lịch sử',
      savePreferenceButton: 'Lưu sở thích',
      upcomingHistoryTitle: 'Lịch hẹn sắp tới',
      pastHistoryTitle: 'Lần cắt tóc trước',
      historyEmpty: 'Chưa thấy lịch đặt nào với số điện thoại này.',
      rebookButton: 'Đặt lại',
      previousServiceLabel: 'Dịch vụ lần trước',
      historyDateLabel: 'Ngày',
      preferenceSaved: 'Đã lưu sở thích trên thiết bị này.',
      nameLabel: 'Tên',
      phoneInputLabel: 'Số điện thoại',
      emailLabel: 'Email (không bắt buộc)',
      backButton: 'Lùi lại',
      nextButton: 'Tiếp tục',
      reviewButton: 'Kiểm tra lịch trống',
      confirmButton: 'Xác nhận yêu cầu',
      step1Label: 'Bước 1 / 3 — Dịch vụ',
      step2Label: 'Bước 2 / 3 — Địa chỉ',
      step3Label: 'Bước 3 / 3 — Liên hệ',
      requiredError: 'Vui lòng điền đủ thông tin bắt buộc cho bước này.',
      availabilityError: 'Giờ này không còn trống. Vui lòng chọn ngày hoặc giờ khác.',
      overlapError: 'Thợ này đã có lịch trùng với yêu cầu của bạn.',
      reviewAreaNotice: 'Địa chỉ này ngoài khu vực phục vụ thường lệ. Bạn có thể gửi để thợ xem xét trước khi xác nhận.',
      summaryTitle: 'Xem lại trước khi gửi',
      summaryTime: '{date} từ {start} đến {end}',
      summaryPrice: 'Tổng ước tính: {price}',
      summaryDuration: 'Thời gian ước tính: {minutes} phút gồm dọn dẹp và di chuyển.',
      pendingStatusCopy: 'Yêu cầu sẽ chờ cho đến khi thợ xác nhận lịch trống.',
      vendorReviewStatusCopy: 'Yêu cầu này sẽ được chuyển cho thợ xem xét vì khu vực phục vụ cần xác nhận thủ công.',
      bookingSaved: 'Đã gửi yêu cầu. Mã đặt lịch: {id}',
      bookingQueuedLocal: 'Yêu cầu đã được lưu tạm trên thiết bị này trong lúc kết nối lại. Thợ sẽ thấy yêu cầu khi bạn có mạng. Mã đặt lịch: {id}',
      finalSummaryTitle: 'Đã gửi yêu cầu đặt lịch',
      finalSummaryNote: 'Muốn hủy hoặc đổi lịch, vui lòng liên hệ thợ trước giờ hẹn.',
      finalSummaryCustomer: 'Khách hàng',
      finalSummaryBarber: 'Thợ',
      finalSummaryService: 'Dịch vụ',
      finalSummaryDateTime: 'Ngày và giờ',
      finalSummaryDuration: 'Thời gian ước tính',
      finalSummaryPrice: 'Giá',
      finalSummaryAddress: 'Địa chỉ',
      finalSummaryPhone: 'Số điện thoại liên hệ',
      notificationQueued: 'Đã chuẩn bị tin nhắn xác nhận.',
      bookingSaveError: 'Không lưu được yêu cầu. Vui lòng gọi trực tiếp cho thợ.',
      assistantKicker: 'Trợ lý AI theo đúng thợ',
      assistantTitle: 'Trợ lý AI đặt lịch cho {vendor}',
      assistantCopy: 'Luồng này chỉ dùng cho {vendorId}. Trợ lý kiểm tra khu vực phục vụ, giá dịch vụ, lịch làm việc, thời gian di chuyển, và lịch trùng trước khi gửi yêu cầu.',
      assistantClose: 'Đóng',
      agentInputLabel: 'Tin nhắn',
      agentInputPlaceholder: 'Ví dụ: Tôi cần cắt tóc tại nhà ngày mai sau 5 giờ ở Westminster.',
      agentSendButton: 'Gửi',
      errorKicker: 'Thợ cắt tóc tại nhà',
      errorTitle: 'Không tìm thấy hồ sơ thợ',
      errorCopy: 'Vendor ID này chưa có trong dịch vụ mobile barber. Vui lòng quay lại trang mobile barber và chọn hồ sơ đang hoạt động.',
      backToMobileBarber: 'Về Mobile Barber',
      phoneLabel: 'Gọi',
      serviceAreaLabel: 'Khu vực phục vụ',
      radiusLabel: 'Bán kính di chuyển',
      travelFeeLabel: 'Phí di chuyển cơ bản',
      languagesLabel: 'Ngôn ngữ',
      priceLabel: 'Giá',
      durationLabel: 'Thời lượng',
      travelBufferLabel: 'Thời gian di chuyển',
      cleanupLabel: 'Dọn dẹp',
      minutes: 'phút',
      availabilityOpen: 'Lịch xem trước: {days} từ {start} đến {end}. Lịch hẹn vẫn chờ cho đến khi thợ xác nhận chỗ trống.',
      availabilityClosed: 'Hiện chưa có lịch xem trước cho thợ này.',
      serviceFallback: 'Thông tin dịch vụ đang được cập nhật.'
    },
    es: {
      pageTitleSuffix: ' | Barbero Móvil | Du Lich Cali',
      languageLabel: 'Elegir idioma',
      vendorKicker: 'Perfil de un barbero móvil',
      servicesKicker: 'Servicios',
      servicesTitle: 'Servicios y precios',
      trustKicker: 'Confianza',
      portfolioTitle: 'Portafolio del barbero',
      portfolioEmpty: 'Las fotos del portafolio se están actualizando. Las reservas todavía usan el menú verificado y revisión de disponibilidad.',
      aiSampleDisclaimer: 'Vista previa de estilo generada por IA. El portafolio real del barbero estará disponible pronto.',
      aiSampleBadge: 'Muestra IA',
      aiSampleBeforePlaceholder: 'Antes — muestra IA',
      aiSampleAfterPlaceholder: 'Después — muestra IA',
      beforeLabel: 'Antes',
      afterLabel: 'Después',
      reviewsTitle: 'Reseñas y calificaciones',
      reviewsEmpty: 'Las reseñas todavía no están publicadas para este barbero.',
      ratingLabel: 'Calificación',
      reviewResponseLabel: 'Respuesta del barbero',
      serviceBadgesLabel: 'Insignias de servicio',
      bookingKicker: 'Reserva',
      bookingTitle: 'Solicitar este barbero',
      selectedServiceLabel: 'Servicio seleccionado',
      selectService: 'Seleccionar Servicio',
      selectedServiceReady: '{service} seleccionado para este barbero.',
      aiBookingButton: 'Asistente AI de Reserva',
      voiceBookingButton: 'Hablar con el Asistente Barber',
      manualBookingButton: 'Reserva Manual',
      promoKicker: 'Vista de servicio',
      promoTitle: 'Cortes en casa con acabado profesional.',
      promoCopy: 'Desliza por el menú del barbero — fades, barba, cortes para niños, y estilos de negocio.',
      promoCta: 'Reservar corte en casa hoy',
      manualBookingTitle: 'Solicitud de corte en casa',
      closeManualBooking: 'Cerrar formulario de reserva',
      serviceLabel: 'Servicio',
      dateLabel: 'Fecha preferida',
      timeLabel: 'Hora preferida',
      addressLabel: 'Dirección de casa o servicio',
      cityLabel: 'Ciudad',
      zipLabel: 'Código ZIP',
      moreDetails: 'Más detalles (opcional)',
      notesLabel: 'Notas del cliente',
      photoLabel: 'Foto de referencia',
      customerAccountKicker: 'Cuenta del cliente',
      customerAccountTitle: 'Su historial de reservas',
      customerAccountCopy: 'Busca solo para este barbero. Las direcciones completas se mantienen privadas y no aparecen en listas públicas.',
      stylePreferenceLabel: 'Preferencia de estilo',
      savedNotesLabel: 'Notas guardadas',
      stylePhotosLabel: 'Fotos de estilo',
      loadHistoryButton: 'Cargar historial',
      savePreferenceButton: 'Guardar preferencias',
      upcomingHistoryTitle: 'Próximas citas',
      pastHistoryTitle: 'Cortes anteriores',
      historyEmpty: 'No se encontraron reservas para este teléfono.',
      rebookButton: 'Reservar de nuevo',
      previousServiceLabel: 'Servicio anterior',
      historyDateLabel: 'Fecha',
      preferenceSaved: 'Preferencias guardadas en este dispositivo.',
      nameLabel: 'Nombre',
      phoneInputLabel: 'Teléfono',
      emailLabel: 'Email (opcional)',
      backButton: 'Atrás',
      nextButton: 'Siguiente',
      reviewButton: 'Verificar disponibilidad',
      confirmButton: 'Confirmar solicitud',
      step1Label: 'Paso 1 / 3 — Servicio',
      step2Label: 'Paso 2 / 3 — Dirección',
      step3Label: 'Paso 3 / 3 — Contacto',
      requiredError: 'Complete los campos obligatorios de este paso.',
      availabilityError: 'Este horario no está disponible. Elija otra fecha u hora.',
      overlapError: 'Este barbero ya tiene una cita que se cruza con su solicitud.',
      reviewAreaNotice: 'Esta dirección está fuera del área normal de servicio. Puede enviarla para revisión del barbero antes de confirmarse.',
      summaryTitle: 'Revisar antes de enviar',
      summaryTime: '{date} de {start} a {end}',
      summaryPrice: 'Total estimado: {price}',
      summaryDuration: 'Tiempo estimado: {minutes} min incluyendo limpieza y viaje.',
      pendingStatusCopy: 'Su solicitud quedará pendiente hasta que este barbero confirme el horario.',
      vendorReviewStatusCopy: 'Esta solicitud se marcará para revisión del vendedor porque el área de servicio necesita aprobación manual.',
      bookingSaved: 'Solicitud enviada. ID de reserva: {id}',
      bookingQueuedLocal: 'Tu solicitud quedó en cola en este dispositivo mientras reconectamos. El barbero la verá cuando vuelvas a estar en línea. ID de reserva: {id}',
      finalSummaryTitle: 'Solicitud de reserva enviada',
      finalSummaryNote: 'Para cancelar o reprogramar, comuníquese con el barbero antes de la cita.',
      finalSummaryCustomer: 'Cliente',
      finalSummaryBarber: 'Barbero',
      finalSummaryService: 'Servicio',
      finalSummaryDateTime: 'Fecha y hora',
      finalSummaryDuration: 'Duración estimada',
      finalSummaryPrice: 'Precio',
      finalSummaryAddress: 'Dirección',
      finalSummaryPhone: 'Teléfono de contacto',
      notificationQueued: 'Mensaje de confirmación preparado.',
      bookingSaveError: 'No se pudo guardar la solicitud. Llame directamente al barbero.',
      assistantKicker: 'Asistente AI limitado a este vendedor',
      assistantTitle: 'Asistente AI para {vendor}',
      assistantCopy: 'Este flujo está limitado a {vendorId}. Revisa área de servicio, precio, horario, tiempo de viaje, y reservas cruzadas antes de enviar la solicitud.',
      assistantClose: 'Cerrar',
      agentInputLabel: 'Mensaje',
      agentInputPlaceholder: 'Ejemplo: Necesito un corte en casa mañana después de las 5 PM en Westminster.',
      agentSendButton: 'Enviar',
      errorKicker: 'Barbero móvil',
      errorTitle: 'Perfil no encontrado',
      errorCopy: 'Este vendor ID de barbero móvil no está disponible. Vuelva a la página de mobile barber y elija un perfil activo.',
      backToMobileBarber: 'Volver a Mobile Barber',
      phoneLabel: 'Llamar',
      serviceAreaLabel: 'Área de servicio',
      radiusLabel: 'Radio de viaje',
      travelFeeLabel: 'Tarifa base de viaje',
      languagesLabel: 'Idiomas',
      priceLabel: 'Precio',
      durationLabel: 'Duración',
      travelBufferLabel: 'Tiempo de viaje',
      cleanupLabel: 'Limpieza',
      minutes: 'min',
      availabilityOpen: 'Vista previa: {days} de {start} a {end}. Las reservas quedan pendientes hasta que este barbero confirme el horario.',
      availabilityClosed: 'La vista previa de disponibilidad todavía no está disponible para este barbero.',
      serviceFallback: 'Los detalles del servicio se están actualizando.'
    }
  };

  var state = {
    lang: 'en',
    vendor: null,
    services: [],
    manualStep: 1,
    availabilityResult: null,
    existingBookings: [],
    portfolio: [],
    reviews: [],
    lastBooking: null,
    agentSession: null,
    customerProfile: null,
    customerHistory: { upcoming: [], past: [], all: [] },
    rebookDraft: null,
    preselectedServiceId: '',
    preselectedAssistantMode: '',
    voiceProviderKeys: {},
    voiceProviderKeysPromise: null
  };
  var fallbackImage = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#09213a"/><path d="M0 610c190-120 390-130 600-35s405 98 600-45v270H0z" fill="#123d63"/><circle cx="845" cy="255" r="135" fill="#f5a623"/><text x="90" y="170" font-family="Arial" font-size="72" font-weight="700" fill="#f7efe1">Mobile Barber</text></svg>'
  );

  function getLang() {
    var param = new URLSearchParams(root.location.search).get('lang');
    if (STRINGS[param]) return param;
    try {
      var saved = localStorage.getItem('dlcLang') || localStorage.getItem('dlc_lang');
      if (STRINGS[saved]) return saved;
    } catch (e) {}
    return 'en';
  }

  function t(key) {
    return (STRINGS[state.lang] && STRINGS[state.lang][key]) || STRINGS.en[key] || '';
  }

  function interpolate(template, values) {
    return String(template || '').replace(/\{(\w+)\}/g, function(_, key) {
      return values[key] == null ? '' : values[key];
    });
  }

  function getVendorId() {
    var params = new URLSearchParams(root.location.search);
    var fromQuery = params.get('vendorId') || params.get('id');
    if (fromQuery) return fromQuery;
    var match = root.location.pathname.match(/\/mobile-barber\/vendor\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function getQueryParam(name) {
    var params = new URLSearchParams(root.location.search);
    return params.get(name) || '';
  }

  function getFirestoreDb() {
    if (root.dlcDb) return root.dlcDb;
    if (root.firebase && root.firebase.firestore && root.firebase.apps && root.firebase.apps.length) {
      return root.firebase.firestore();
    }
    return null;
  }

  function loadVoiceProviderKeys() {
    if (state.voiceProviderKeysPromise) return state.voiceProviderKeysPromise;
    var keys = {
      vendorGeminiKey: state.vendor && state.vendor.geminiKey || '',
      vendorOpenAiKey: state.vendor && state.vendor.openaiKey || '',
      firestoreGeminiKey: state.vendor && state.vendor.geminiKey || '',
      firestoreOpenAiKey: state.vendor && state.vendor.openaiKey || '',
      platformGeminiKey: '',
      platformOpenAiKey: ''
    };
    keys.geminiKey = keys.vendorGeminiKey;
    keys.openAiKey = keys.vendorOpenAiKey;
    state.voiceProviderKeys = keys;

    var db = getFirestoreDb();
    if (!db || !state.vendor || !state.vendor.id || !DATA || !DATA.COLLECTIONS) {
      state.voiceProviderKeysPromise = Promise.resolve(keys);
      return state.voiceProviderKeysPromise;
    }

    state.voiceProviderKeysPromise = Promise.all([
      db.collection(DATA.COLLECTIONS.vendors).doc(state.vendor.id).get().catch(function() { return null; }),
      db.collection('config').doc('platform').get().catch(function() { return null; })
    ]).then(function(results) {
      var vendorDoc = results[0];
      var platformDoc = results[1];
      if (vendorDoc && vendorDoc.exists) {
        var vd = vendorDoc.data() || {};
        if (vd.geminiKey) keys.vendorGeminiKey = keys.firestoreGeminiKey = vd.geminiKey;
        if (vd.openaiKey) keys.vendorOpenAiKey = keys.firestoreOpenAiKey = vd.openaiKey;
      }
      if (platformDoc && platformDoc.exists) {
        var pd = platformDoc.data() || {};
        if (pd.geminiKey) keys.platformGeminiKey = pd.geminiKey;
        if (pd.openaiKey) keys.platformOpenAiKey = pd.openaiKey;
      }
      keys.geminiKey = keys.vendorGeminiKey || keys.platformGeminiKey || '';
      keys.openAiKey = keys.vendorOpenAiKey || keys.platformOpenAiKey || '';
      state.voiceProviderKeys = keys;
      return keys;
    }).catch(function() {
      return keys;
    });
    return state.voiceProviderKeysPromise;
  }

  function validServiceId(serviceId) {
    return state.services.some(function(service) {
      return service.id === serviceId && service.active !== false;
    });
  }

  function selectedServiceName() {
    var serviceId = state.preselectedServiceId;
    var service = state.services.filter(function(row) { return row.id === serviceId; })[0];
    return service ? service.name : '';
  }

  function formatMoney(value) {
    return '$' + Number(value || 0).toFixed(0);
  }

  function storageRead(key, fallback) {
    try {
      var raw = root.localStorage && root.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function addressSummary(booking) {
    return [booking.address, booking.city, booking.zip].filter(Boolean).join(', ');
  }

  function customerProfileKey(phone) {
    var normalized = BOOKING && BOOKING.normalizePhone ? BOOKING.normalizePhone(phone) : String(phone || '').replace(/\D/g, '');
    return 'dlc_mobile_barber_customer_' + state.vendor.id + '_' + normalized;
  }

  function selectedStylePhotoNames() {
    var input = document.getElementById('mbStylePhotos');
    if (!input || !input.files) return [];
    return Array.prototype.slice.call(input.files).map(function(file) { return file.name; });
  }

  function readCustomerProfile() {
    var phone = document.getElementById('mbHistoryPhone').value;
    var normalized = BOOKING && BOOKING.normalizePhone ? BOOKING.normalizePhone(phone) : String(phone || '').replace(/\D/g, '');
    return {
      vendorId: state.vendor.id,
      customerPhone: normalized,
      customerPhoneNormalized: normalized,
      stylePreference: document.getElementById('mbStylePreference').value,
      notes: document.getElementById('mbSavedCustomerNotes').value,
      photoUrls: selectedStylePhotoNames()
    };
  }

  function saveCustomerProfile() {
    var profile = readCustomerProfile();
    if (!profile.customerPhoneNormalized) return;
    state.customerProfile = profile;
    var historyPhone = document.getElementById('mbHistoryPhone');
    if (historyPhone && !historyPhone.value) historyPhone.value = profile.customerPhoneNormalized;
    try {
      localStorage.setItem(customerProfileKey(profile.customerPhoneNormalized), JSON.stringify(profile));
    } catch (e) {}
    showManualError(t('preferenceSaved'));
  }

  function loadSavedCustomerProfile(phone) {
    var normalized = BOOKING && BOOKING.normalizePhone ? BOOKING.normalizePhone(phone) : String(phone || '').replace(/\D/g, '');
    if (!normalized) return null;
    try {
      var raw = localStorage.getItem(customerProfileKey(normalized));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function applyCustomerProfile(profile) {
    if (!profile) return;
    state.customerProfile = profile;
    document.getElementById('mbHistoryPhone').value = profile.customerPhone || profile.customerPhoneNormalized || '';
    document.getElementById('mbStylePreference').value = profile.stylePreference || '';
    document.getElementById('mbSavedCustomerNotes').value = profile.notes || '';
  }

  function rememberCustomerFromBooking(booking) {
    if (!booking || !booking.customerPhone) return;
    var profile = Object.assign({}, state.customerProfile || {}, {
      vendorId: booking.vendorId,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      customerPhoneNormalized: BOOKING.normalizePhone(booking.customerPhone),
      customerEmail: booking.customerEmail,
      stylePreference: booking.stylePreference || (state.customerProfile && state.customerProfile.stylePreference) || '',
      notes: booking.notes || (state.customerProfile && state.customerProfile.notes) || '',
      photoUrls: Array.isArray(booking.photoUrls) ? booking.photoUrls.slice() : [],
      lastServiceId: booking.serviceId,
      lastServiceName: booking.serviceName,
      lastBookingId: booking.id,
      updatedAt: new Date().toISOString()
    });
    state.customerProfile = profile;
    try {
      localStorage.setItem(customerProfileKey(profile.customerPhoneNormalized), JSON.stringify(profile));
    } catch (e) {}
  }

  function bookingService(booking) {
    return state.services.filter(function(service) {
      return service.id === booking.serviceId;
    })[0] || null;
  }

  function queueBookingNotifications(booking) {
    if (!root.DLCNotifications || !root.DLCNotifications.queueMobileBarberConfirmation) return;
    var service = bookingService(booking) || {};
    if (state.availabilityResult && state.availabilityResult.timing && state.availabilityResult.timing.totalMinutes) {
      service = Object.assign({}, service, { durationMinutes: state.availabilityResult.timing.totalMinutes });
    }
    root.DLCNotifications.queueMobileBarberConfirmation(booking, state.vendor, service, state.lang);
  }

  function renderFinalBookingSummary(booking, saveSource) {
    var summary = document.getElementById('mbBookingSummary');
    var service = bookingService(booking) || {};
    var duration = (state.availabilityResult && state.availabilityResult.timing && state.availabilityResult.timing.totalMinutes) ||
      booking.durationMinutes || service.durationMinutes || '';
    var when = [booking.requestedDate, [booking.startTime, booking.endTime].filter(Boolean).join(' - ')].filter(Boolean).join(' ');
    var savedOnline = saveSource !== 'local';
    var rows = [
      [t('finalSummaryCustomer'), booking.customerName],
      [t('finalSummaryBarber'), (state.vendor && (state.vendor.barberName || state.vendor.businessName)) || booking.vendorId],
      [t('finalSummaryService'), booking.serviceName],
      [t('finalSummaryDateTime'), when],
      [t('finalSummaryDuration'), duration ? duration + ' ' + t('minutes') : ''],
      [t('finalSummaryPrice'), formatMoney(booking.servicePrice)],
      [t('finalSummaryAddress'), addressSummary(booking)],
      [t('finalSummaryPhone'), (state.vendor && state.vendor.phone) || booking.customerPhone]
    ];
    summary.innerHTML = '<h3>' + t('finalSummaryTitle') + '</h3>' +
      '<p>' + interpolate(t(savedOnline ? 'bookingSaved' : 'bookingQueuedLocal'), { id: booking.id }) + '</p>' +
      '<dl class="mb-confirmation-list">' +
      rows.map(function(row) {
        if (!row[1]) return '';
        return '<div><dt>' + row[0] + '</dt><dd>' + row[1] + '</dd></div>';
      }).join('') +
      '</dl>' +
      '<p>' + t('finalSummaryNote') + '</p>' +
      (savedOnline ? '<p>' + t('notificationQueued') + '</p>' : '');
    summary.hidden = false;
  }

  function renderHistoryList(id, rows) {
    var list = document.getElementById(id);
    if (!list) return;
    list.innerHTML = '';
    if (!rows.length) {
      var empty = el('div', 'mb-empty');
      empty.textContent = t('historyEmpty');
      list.appendChild(empty);
      return;
    }
    rows.forEach(function(booking) {
      var card = el('article', 'mb-history-card');
      var title = el('h4');
      var meta = el('p');
      var rebook = el('button', 'mb-button mb-button--ghost mb-button--sm');
      title.textContent = booking.serviceName || booking.serviceId || t('previousServiceLabel');
      meta.textContent = [
        t('historyDateLabel') + ': ' + [booking.requestedDate, booking.startTime].filter(Boolean).join(' '),
        booking.city || '',
        booking.status || ''
      ].filter(Boolean).join(' • ');
      rebook.type = 'button';
      rebook.textContent = t('rebookButton');
      rebook.addEventListener('click', function() { startRebook(booking); });
      card.appendChild(title);
      card.appendChild(meta);
      if (booking.stylePreference) {
        var pref = el('p');
        pref.textContent = t('stylePreferenceLabel') + ': ' + booking.stylePreference;
        card.appendChild(pref);
      }
      card.appendChild(rebook);
      list.appendChild(card);
    });
  }

  function renderCustomerHistory() {
    renderHistoryList('mbUpcomingHistoryList', state.customerHistory.upcoming || []);
    renderHistoryList('mbPastHistoryList', state.customerHistory.past || []);
  }

  function el(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function metaChip(label, value) {
    var chip = el('span', 'mb-chip');
    chip.textContent = label + ': ' + value;
    return chip;
  }

  function serviceImage(service) {
    if (DATA && DATA.findServiceImageByServiceId) {
      return DATA.findServiceImageByServiceId(service.id) || service;
    }
    return service;
  }

  function setSelectedService(serviceId) {
    if (!validServiceId(serviceId)) return;
    state.preselectedServiceId = serviceId;
    document.querySelectorAll('#mbVendorServices .mb-service-card').forEach(function(card) {
      card.classList.toggle('mb-service-card--selected', card.getAttribute('data-service-id') === serviceId);
    });
    renderSelectedServiceSummary();
  }

  function renderSelectedServiceSummary() {
    var summary = document.getElementById('mbSelectedServiceSummary');
    if (!summary) return;
    var service = state.services.filter(function(row) { return row.id === state.preselectedServiceId; })[0];
    if (!service) {
      summary.hidden = true;
      summary.innerHTML = '';
      return;
    }
    summary.innerHTML = '<span>' + t('selectedServiceLabel') + '</span><strong>' +
      service.name + ' · ' + formatMoney(service.price) + '</strong><p>' +
      interpolate(t('selectedServiceReady'), { service: service.name }) + '</p>';
    summary.hidden = false;
  }

  function badgeLabel(badgeId) {
    var badge = DATA && DATA.SERVICE_BADGES && DATA.SERVICE_BADGES[badgeId];
    if (!badge || !badge.labels) return badgeId;
    return badge.labels[state.lang] || badge.labels.en || badgeId;
  }

  function readLocalPortfolio(vendorId) {
    var rows = storageRead('dlc_mobile_barber_portfolio_overrides', {});
    return rows[vendorId] || null;
  }

  function readLocalReviews(vendorId) {
    var rows = storageRead('dlc_mobile_barber_review_overrides', {});
    return rows[vendorId] || null;
  }

  function loadTrustData() {
    var vendorId = state.vendor && state.vendor.id;
    var localPortfolio = vendorId ? readLocalPortfolio(vendorId) : null;
    var localReviews = vendorId ? readLocalReviews(vendorId) : null;
    state.portfolio = localPortfolio || (DATA && DATA.listPortfolioForVendor ? DATA.listPortfolioForVendor(vendorId) : []);
    state.reviews = localReviews || (DATA && DATA.listReviewsForVendor ? DATA.listReviewsForVendor(vendorId) : []);
  }

  function setText(rootEl) {
    rootEl.querySelectorAll('[data-i18n]').forEach(function(node) {
      node.textContent = t(node.getAttribute('data-i18n'));
    });
    rootEl.querySelectorAll('[data-i18n-aria]').forEach(function(node) {
      node.setAttribute('aria-label', t(node.getAttribute('data-i18n-aria')));
    });
    rootEl.querySelectorAll('[data-i18n-placeholder]').forEach(function(node) {
      node.setAttribute('placeholder', t(node.getAttribute('data-i18n-placeholder')));
    });
  }

  function setImage(img, src, alt) {
    img.alt = alt || '';
    img.src = src || fallbackImage;
    img.onerror = function() {
      img.onerror = null;
      img.src = fallbackImage;
      img.classList.add('mb-image-fallback');
    };
  }

  function renderBadges() {
    var list = document.getElementById('mbServiceBadges');
    var vendor = state.vendor;
    if (!list || !vendor) return;
    list.innerHTML = '';
    (vendor.serviceBadges || []).forEach(function(badgeId) {
      var chip = el('span', 'mb-chip mb-chip--badge');
      chip.textContent = badgeLabel(badgeId);
      list.appendChild(chip);
    });
  }

  function portfolioImageCard(image) {
    var card = el('article', 'mb-portfolio-card');
    var hasBefore = !!image.beforeImageUrl;
    var hasAfter = !!image.afterImageUrl;
    var hasBeforeAfter = hasBefore || hasAfter;
    var hasMainImage = !!image.imageUrl;
    var isAIPlaceholder = image.isAIGenerated === true && !hasBeforeAfter && !hasMainImage;
    var media = el('div', hasBeforeAfter || isAIPlaceholder ? 'mb-portfolio-card__compare' : 'mb-portfolio-card__media');
    var chip = el('span', 'mb-portfolio-card__category');
    var title = el('h3');
    var desc = el('p');

    if (isAIPlaceholder) {
      card.classList.add('mb-portfolio-card--ai-sample');
      var categoryImage = DATA && DATA.findServiceImageByPortfolioCategory
        ? DATA.findServiceImageByPortfolioCategory(image.category)
        : null;
      [
        ['aiSampleBeforePlaceholder', 'before'],
        ['aiSampleAfterPlaceholder',  'after']
      ].forEach(function(pair) {
        var wrap = el('figure', 'mb-portfolio-card__ai-frame mb-portfolio-card__ai-frame--' + pair[1]);
        var badge = el('span', 'mb-portfolio-card__ai-badge');
        var caption = el('figcaption');
        badge.textContent = t('aiSampleBadge');
        caption.textContent = t(pair[0]);
        if (categoryImage && categoryImage.imageUrl) {
          // Use the matching service Unsplash photo as a representative style
          // preview. The "before" half is desaturated; the "after" half shows
          // full color. Both halves stay labelled as AI samples for honesty.
          wrap.style.backgroundImage = "url('" + categoryImage.imageUrl + "')";
          wrap.setAttribute('aria-label', categoryImage.imageAlt || '');
        }
        wrap.appendChild(badge);
        wrap.appendChild(caption);
        media.appendChild(wrap);
      });
    } else if (hasBeforeAfter) {
      [
        ['beforeImageUrl', 'beforeLabel'],
        ['afterImageUrl', 'afterLabel']
      ].forEach(function(pair) {
        var wrap = el('figure');
        var label = el('figcaption');
        var img = document.createElement('img');
        label.textContent = t(pair[1]);
        setImage(img, image[pair[0]], image.alt || image.title);
        wrap.appendChild(img);
        wrap.appendChild(label);
        media.appendChild(wrap);
      });
    } else {
      var img = document.createElement('img');
      setImage(img, image.imageUrl, image.alt || image.title);
      media.appendChild(img);
    }

    chip.textContent = image.category || 'Portfolio';
    title.textContent = image.title || t('portfolioTitle');
    desc.textContent = image.description || '';
    card.appendChild(media);
    card.appendChild(chip);
    card.appendChild(title);
    if (desc.textContent) card.appendChild(desc);
    return card;
  }

  function renderPromoPreview() {
    var list = document.getElementById('mbVendorPromoPreview');
    if (!list) return;
    list.innerHTML = '';
    (state.services || []).forEach(function(service) {
      if (service.active === false) return;
      var card = el('article', 'mb-promo__card');
      var img = document.createElement('img');
      var body = el('div', 'mb-promo__card-body');
      var title = el('strong');
      var price = el('span');
      var imageRecord = serviceImage(service);
      img.src = imageRecord.imageUrl || service.imageUrl || fallbackImage;
      img.alt = imageRecord.imageAlt || service.imageAlt || service.name;
      img.loading = 'lazy';
      img.onerror = function() {
        img.onerror = null;
        img.src = fallbackImage;
      };
      title.textContent = service.name;
      price.textContent = formatMoney(service.price);
      body.appendChild(title);
      body.appendChild(price);
      card.appendChild(img);
      card.appendChild(body);
      list.appendChild(card);
    });
  }

  function renderPortfolio() {
    var list = document.getElementById('mbPortfolioGallery');
    if (!list) return;
    list.innerHTML = '';
    var rows = (state.portfolio || []).filter(function(image) {
      return image.hidden !== true && image.active !== false;
    });
    if (!rows.length) {
      var empty = el('div', 'mb-empty');
      empty.textContent = t('portfolioEmpty');
      list.appendChild(empty);
      return;
    }
    var hasAI = rows.some(function(image) { return image.isAIGenerated === true; });
    if (hasAI) {
      var banner = el('div', 'mb-ai-sample-banner');
      banner.textContent = t('aiSampleDisclaimer');
      list.appendChild(banner);
    }
    rows.forEach(function(image) {
      list.appendChild(portfolioImageCard(image));
    });
  }

  function reviewStars(rating) {
    var value = Math.max(0, Math.min(5, Number(rating || 0)));
    return '★★★★★'.slice(0, Math.round(value)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(value));
  }

  function renderReviews() {
    var list = document.getElementById('mbReviewList');
    if (!list) return;
    list.innerHTML = '';
    var rows = (state.reviews || []).filter(function(review) { return review.hidden !== true; });
    if (!rows.length) {
      var empty = el('div', 'mb-empty');
      empty.textContent = t('reviewsEmpty');
      list.appendChild(empty);
      return;
    }
    rows.forEach(function(review) {
      var card = el('article', 'mb-review-card');
      var head = el('div', 'mb-review-card__head');
      var name = el('h3');
      var rating = el('span', 'mb-review-card__stars');
      var body = el('p');
      name.textContent = review.customerName || t('reviewsTitle');
      rating.textContent = reviewStars(review.rating) + ' ' + Number(review.rating || 0).toFixed(1);
      body.textContent = review.body || '';
      head.appendChild(name);
      head.appendChild(rating);
      card.appendChild(head);
      if (review.serviceName) {
        var service = el('p', 'mb-review-card__service');
        service.textContent = review.serviceName;
        card.appendChild(service);
      }
      card.appendChild(body);
      if (review.vendorResponse) {
        var response = el('p', 'mb-review-card__response');
        response.textContent = t('reviewResponseLabel') + ': ' + review.vendorResponse;
        card.appendChild(response);
      }
      list.appendChild(card);
    });
  }

  function activeAvailability(vendorId) {
    var rows = DATA && DATA.sampleAvailability ? DATA.sampleAvailability : [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].vendorId === vendorId) return rows[i];
    }
    return null;
  }

  function availabilityPreview(vendorId) {
    var availability = activeAvailability(vendorId);
    if (!availability || !availability.weeklyHours) return t('availabilityClosed');
    var days = Object.keys(availability.weeklyHours).filter(function(day) {
      return availability.weeklyHours[day] && availability.weeklyHours[day].active;
    });
    if (!days.length) return t('availabilityClosed');
    var first = availability.weeklyHours[days[0]];
    return interpolate(t('availabilityOpen'), {
      days: days.map(function(day) { return day.slice(0, 3); }).join(', '),
      start: first.start,
      end: first.end
    });
  }

  function renderServices() {
    var list = document.getElementById('mbVendorServices');
    list.innerHTML = '';
    state.services.forEach(function(service) {
      var card = el('article', 'mb-service-card mb-vendor-service-card');
      var media = el('div', 'mb-service-card__media');
      var image = el('img', 'mb-service-card__image');
      var disclosure = el('span', 'mb-service-card__disclosure');
      var body = el('div', 'mb-service-card__body');
      var title = el('h3');
      var desc = el('p');
      var row = el('div', 'mb-meta-row');
      var cta = el('button', 'mb-button mb-button--primary');
      var imageRecord = serviceImage(service);

      card.setAttribute('data-service-id', service.id);
      image.src = imageRecord.imageUrl || service.imageUrl || fallbackImage;
      image.alt = imageRecord.imageAlt || service.imageAlt || service.name;
      image.onerror = function() {
        image.onerror = null;
        image.src = fallbackImage;
        image.classList.add('mb-image-fallback');
      };
      disclosure.textContent = t('aiSampleDisclaimer');
      title.textContent = service.name;
      desc.textContent = service.description || t('serviceFallback');
      row.appendChild(metaChip(t('priceLabel'), formatMoney(service.price)));
      row.appendChild(metaChip(t('durationLabel'), service.durationMinutes + ' ' + t('minutes')));
      row.appendChild(metaChip(t('travelBufferLabel'), service.travelBufferMinutes + ' ' + t('minutes')));
      row.appendChild(metaChip(t('cleanupLabel'), service.cleanupBufferMinutes + ' ' + t('minutes')));
      cta.type = 'button';
      cta.textContent = t('selectService');
      cta.addEventListener('click', function() {
        setSelectedService(service.id);
        openManualBooking();
      });
      media.appendChild(image);
      media.appendChild(disclosure);
      body.appendChild(title);
      body.appendChild(desc);
      body.appendChild(row);
      body.appendChild(cta);
      card.appendChild(media);
      card.appendChild(body);
      list.appendChild(card);
    });
    renderSelectedServiceSummary();
  }

  function renderServiceOptions() {
    var select = document.getElementById('mbBookingService');
    if (!select) return;
    select.innerHTML = '';
    state.services.forEach(function(service) {
      var option = document.createElement('option');
      option.value = service.id;
      option.textContent = service.name + ' — ' + formatMoney(service.price);
      select.appendChild(option);
    });
  }

  function renderVendor() {
    var vendor = state.vendor;
    var detail = document.getElementById('mbVendorDetail');
    var error = document.getElementById('mbVendorError');
    setText(document);

    if (!vendor) {
      document.title = t('errorTitle') + t('pageTitleSuffix');
      detail.hidden = true;
      error.hidden = false;
      return;
    }

    error.hidden = true;
    detail.hidden = false;
    document.title = vendor.businessName + t('pageTitleSuffix');
    document.getElementById('mbVendorName').textContent = vendor.businessName;
    document.getElementById('mbVendorBarberName').textContent = vendor.barberName;
    document.getElementById('mbVendorPhone').href = 'tel:' + String(vendor.phone || '').replace(/[^\d+]/g, '');
    document.getElementById('mbVendorPhone').textContent = t('phoneLabel') + ' ' + vendor.phone;
    document.getElementById('mbAvailabilityPreview').textContent = availabilityPreview(vendor.id);
    document.getElementById('mbAssistantTitle').textContent = interpolate(t('assistantTitle'), { vendor: vendor.businessName });
    document.getElementById('mbAssistantCopy').textContent = interpolate(t('assistantCopy'), { vendorId: vendor.id });
    setImage(document.getElementById('mbVendorHeroImage'), vendor.heroImage, vendor.businessName);
    setImage(document.getElementById('mbVendorProfilePhoto'), vendor.profilePhoto, vendor.barberName);
    loadTrustData();

    var meta = document.getElementById('mbVendorMeta');
    meta.innerHTML = '';
    meta.appendChild(metaChip(t('ratingLabel'), Number(vendor.rating || 0).toFixed(1) + ' (' + Number(vendor.reviewCount || state.reviews.length || 0) + ')'));
    meta.appendChild(metaChip(t('serviceAreaLabel'), vendor.serviceAreas.join(', ')));
    meta.appendChild(metaChip(t('radiusLabel'), vendor.travelRadiusMiles + ' mi'));
    meta.appendChild(metaChip(t('travelFeeLabel'), formatMoney(vendor.baseTravelFee)));
    meta.appendChild(metaChip(t('languagesLabel'), vendor.languages.join(', ').toUpperCase()));
    renderBadges();
    renderPromoPreview();
    renderServices();
    renderPortfolio();
    renderReviews();
    renderServiceOptions();
    renderManualStep();
    renderCustomerHistory();
  }

  function getManualDraft() {
    var photo = document.getElementById('mbReferencePhoto');
    return {
      serviceId: document.getElementById('mbBookingService').value,
      requestedDate: document.getElementById('mbBookingDate').value,
      startTime: document.getElementById('mbBookingTime').value,
      address: document.getElementById('mbBookingAddress').value,
      city: document.getElementById('mbBookingCity').value,
      zip: document.getElementById('mbBookingZip').value,
      notes: document.getElementById('mbCustomerNotes').value,
      stylePreference: document.getElementById('mbBookingStylePreference').value,
      photoUrls: photo && photo.files && photo.files[0] ? [photo.files[0].name] :
        (state.rebookDraft && Array.isArray(state.rebookDraft.photoUrls) ? state.rebookDraft.photoUrls.slice() : []),
      customerName: document.getElementById('mbCustomerName').value,
      customerPhone: document.getElementById('mbCustomerPhone').value,
      customerEmail: document.getElementById('mbCustomerEmail').value,
      rebookedFromBookingId: state.rebookDraft && state.rebookDraft.rebookedFromBookingId,
      previousServiceName: state.rebookDraft && state.rebookDraft.previousServiceName
    };
  }

  function setManualDraft(draft) {
    draft = draft || {};
    [
      ['mbBookingService', 'serviceId'],
      ['mbBookingDate', 'requestedDate'],
      ['mbBookingTime', 'startTime'],
      ['mbBookingAddress', 'address'],
      ['mbBookingCity', 'city'],
      ['mbBookingZip', 'zip'],
      ['mbCustomerNotes', 'notes'],
      ['mbBookingStylePreference', 'stylePreference'],
      ['mbCustomerName', 'customerName'],
      ['mbCustomerPhone', 'customerPhone'],
      ['mbCustomerEmail', 'customerEmail']
    ].forEach(function(pair) {
      var node = document.getElementById(pair[0]);
      if (node && draft[pair[1]] != null) node.value = draft[pair[1]];
    });
  }

  function clearManualResult() {
    state.availabilityResult = null;
    state.lastBooking = null;
    var summary = document.getElementById('mbBookingSummary');
    var confirm = document.querySelector('[data-action="manualConfirm"]');
    if (summary) {
      summary.hidden = true;
      summary.innerHTML = '';
    }
    if (confirm) confirm.disabled = true;
  }

  function showManualError(message) {
    var error = document.getElementById('mbManualBookingError');
    error.textContent = message || '';
    error.hidden = !message;
  }

  function currentStepFields() {
    var map = {
      1: ['mbBookingService', 'mbBookingDate', 'mbBookingTime'],
      2: ['mbBookingAddress', 'mbBookingCity', 'mbBookingZip'],
      3: ['mbCustomerName', 'mbCustomerPhone']
    };
    return map[state.manualStep] || [];
  }

  function validateCurrentStep() {
    var ids = currentStepFields();
    var valid = ids.every(function(id) {
      var node = document.getElementById(id);
      return node && String(node.value || '').trim();
    });
    if (!valid) showManualError(t('requiredError'));
    return valid;
  }

  function renderManualStep() {
    var modal = document.getElementById('mbManualBookingModal');
    if (!modal) return;
    modal.querySelectorAll('.mb-form-step').forEach(function(step) {
      step.hidden = Number(step.getAttribute('data-step')) !== state.manualStep;
    });
    document.getElementById('mbManualStepLabel').textContent = t('step' + state.manualStep + 'Label');
    document.querySelector('[data-action="manualBack"]').hidden = state.manualStep === 1;
    document.querySelector('[data-action="manualNext"]').hidden = state.manualStep === 3;
    document.querySelector('[data-action="manualReview"]').hidden = state.manualStep !== 3;
    document.querySelector('[data-action="manualConfirm"]').hidden = state.manualStep !== 3;
  }

  function openManualBooking(options) {
    options = options || {};
    if (!options.keepRebook) state.rebookDraft = null;
    state.manualStep = 1;
    clearManualResult();
    showManualError('');
    renderManualStep();
    if (state.customerProfile) {
      setManualDraft({
        serviceId: state.preselectedServiceId,
        customerPhone: state.customerProfile.customerPhone || state.customerProfile.customerPhoneNormalized,
        notes: state.customerProfile.notes,
        stylePreference: state.customerProfile.stylePreference
      });
    } else if (state.preselectedServiceId) {
      setManualDraft({ serviceId: state.preselectedServiceId });
    }
    var modal = document.getElementById('mbManualBookingModal');
    modal.hidden = false;
    modal.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function closeManualBooking() {
    document.getElementById('mbManualBookingModal').hidden = true;
  }

  function startRebook(booking) {
    var profile = Object.assign({}, state.customerProfile || {}, {
      customerPhone: document.getElementById('mbHistoryPhone').value || booking.customerPhone
    });
    state.rebookDraft = BOOKING.buildRebookDraft(booking, profile);
    openManualBooking({ keepRebook: true });
    setManualDraft(state.rebookDraft);
    document.getElementById('mbBookingDate').focus();
  }

  function loadCustomerHistory() {
    var phone = document.getElementById('mbHistoryPhone').value;
    var saved = loadSavedCustomerProfile(phone);
    if (saved) applyCustomerProfile(saved);
    BOOKING.loadCustomerBookings(state.vendor.id, { phone: phone }).then(function(rows) {
      state.customerHistory = BOOKING.splitCustomerBookingHistory(rows, state.vendor.id, { phone: phone }, new Date());
      renderCustomerHistory();
    }).catch(function() {
      state.customerHistory = { upcoming: [], past: [], all: [] };
      renderCustomerHistory();
    });
  }

  function manualNext() {
    if (!validateCurrentStep()) return;
    showManualError('');
    state.manualStep = Math.min(3, state.manualStep + 1);
    renderManualStep();
  }

  function manualBack() {
    showManualError('');
    state.manualStep = Math.max(1, state.manualStep - 1);
    renderManualStep();
  }

  function renderSummary(result, draft) {
    var summary = document.getElementById('mbBookingSummary');
    var notice = result.reviewRequired ? t('vendorReviewStatusCopy') : t('pendingStatusCopy');
    summary.innerHTML = [
      '<h3>' + t('summaryTitle') + '</h3>',
      '<p><strong>' + result.service.name + '</strong></p>',
      '<p>' + interpolate(t('summaryTime'), { date: draft.requestedDate, start: draft.startTime, end: result.timing.endTime }) + '</p>',
      '<p>' + interpolate(t('summaryPrice'), { price: formatMoney(result.price.totalPrice) }) + '</p>',
      '<p>' + interpolate(t('summaryDuration'), { minutes: result.timing.totalMinutes }) + '</p>',
      result.reviewRequired ? '<p>' + t('reviewAreaNotice') + '</p>' : '',
      '<p>' + notice + '</p>'
    ].join('');
    summary.hidden = false;
    document.querySelector('[data-action="manualConfirm"]').disabled = false;
  }

  function reviewManualBooking() {
    if (!validateCurrentStep()) return;
    showManualError('');
    clearManualResult();
    var draft = getManualDraft();
    var finish = function(existing) {
      state.existingBookings = existing || [];
      var result = BOOKING.checkAvailability({
        vendor: state.vendor,
        draft: draft,
        services: state.services,
        availability: DATA.sampleAvailability,
        existingBookings: state.existingBookings
      });
      if (!result.canCreate) {
        var msg = result.key === 'booking_overlap' ? t('overlapError') : t('availabilityError');
        if (result.key === 'required_fields') msg = t('requiredError');
        showManualError(msg);
        return;
      }
      state.availabilityResult = result;
      renderSummary(result, draft);
    };
    BOOKING.loadExistingBookings(state.vendor.id).then(finish).catch(function() {
      finish([]);
    });
  }

  function confirmManualBooking() {
    var draft = getManualDraft();
    var built = BOOKING.buildBooking({
      vendor: state.vendor,
      draft: draft,
      availabilityResult: state.availabilityResult
    });
    if (!built.valid) {
      showManualError(t('requiredError'));
      return;
    }
    document.querySelector('[data-action="manualConfirm"]').disabled = true;
    BOOKING.saveBooking(built.booking).then(function(result) {
      state.lastBooking = result.booking;
      rememberCustomerFromBooking(result.booking);
      if (result.source === 'firestore') queueBookingNotifications(result.booking);
      showManualError('');
      renderFinalBookingSummary(result.booking, result.source);
      loadCustomerHistory();
    }).catch(function() {
      document.querySelector('[data-action="manualConfirm"]').disabled = false;
      showManualError(t('bookingSaveError'));
    });
  }

  function appendAgentMessage(role, text) {
    var log = document.getElementById('mbAgentLog');
    if (!log) return;
    var item = el('div', 'mb-chat__message mb-chat__message--' + role);
    item.textContent = text;
    log.appendChild(item);
    log.scrollTop = log.scrollHeight;
  }

  function _buildAIBrainProvider(vendorId) {
    if (!root.AIEngine || typeof root.AIEngine.call !== 'function') return null;
    return function(req) {
      // Use 'nails' service config (sonnet 4-6, 900 tokens) since mobile_barber
      // shares the conversational depth needed by the receptionist.
      return root.AIEngine.call('nails', '', req.systemPrompt, req.history || [], { intent: 'booking' })
        .then(function(resp) {
          var text = (resp && resp.content && resp.content[0] && resp.content[0].text) || '';
          return { text: text };
        });
    };
  }

  function agentContext() {
    return {
      lang: state.lang,
      vendor: state.vendor,
      vendorId: state.vendor && state.vendor.id,
      services: state.services,
      availability: DATA.sampleAvailability,
      existingBookings: state.existingBookings,
      now: new Date(),
      phoneIntake: root.PhoneIntake || null,
      customerLookupProvider: function(phone) {
        if (!BOOKING || typeof BOOKING.lookupReturningCustomer !== 'function') return Promise.resolve(null);
        return BOOKING.lookupReturningCustomer(state.vendor.id, phone);
      },
      aiBrainProvider: _buildAIBrainProvider(state.vendor && state.vendor.id)
    };
  }

  function sendAgentMessage(message, options) {
    options = options || {};
    if (!AGENT || !state.vendor) return Promise.resolve(null);
    appendAgentMessage('user', message);
    var photo = document.getElementById('mbAgentPhoto');
    if (photo && photo.files && photo.files[0]) {
      state.agentSession = state.agentSession || {};
      state.agentSession.state = AGENT.mergeState(
        (state.agentSession && state.agentSession.state) || AGENT.emptyState(state.lang),
        { photoUrls: [photo.files[0].name], notes: message || photo.files[0].name },
        new Date()
      );
    }
    var finish = function(existing) {
      state.existingBookings = existing || [];
      var runner = typeof AGENT.handleMessageAsync === 'function'
        ? AGENT.handleMessageAsync(state.agentSession, message, agentContext())
        : Promise.resolve(AGENT.handleMessage(state.agentSession, message, agentContext()));
      return runner.then(function(result) {
      state.agentSession = result.session;
      if (state.agentSession && state.agentSession.history && state.agentSession._historyKey
          && root.AIEngine && typeof root.AIEngine.saveHistory === 'function') {
        root.AIEngine.saveHistory(state.agentSession._historyKey, state.agentSession.history.slice(-20));
      }
      if (result.booking) {
        if (options.source) result.booking.source = options.source;
        return BOOKING.saveBooking(result.booking).then(function(saveResult) {
          state.lastBooking = saveResult.booking;
          rememberCustomerFromBooking(saveResult.booking);
          if (saveResult.source === 'firestore') queueBookingNotifications(saveResult.booking);
          appendAgentMessage('assistant', result.response);
          renderFinalBookingSummary(saveResult.booking, saveResult.source);
          loadCustomerHistory();
          result.booking = saveResult.booking;
          return result;
        }).catch(function() {
          appendAgentMessage('assistant', t('bookingSaveError'));
          return { session: state.agentSession, response: t('bookingSaveError'), error: true };
        });
      }
      appendAgentMessage('assistant', result.response);
      return result;
      });
    };
    return BOOKING.loadExistingBookings(state.vendor.id).then(finish).catch(function() {
      return finish([]);
    });
  }

  function openAssistantPanel() {
    var panel = document.getElementById('mbVendorAssistant');
    panel.hidden = false;
    if (AGENT && !state.agentSession) {
      var historyKey = 'mb_h_' + ((state.vendor && state.vendor.id) || 'general');
      var restoredHistory = (root.AIEngine && typeof root.AIEngine.restoreHistory === 'function')
        ? root.AIEngine.restoreHistory(historyKey)
        : null;
      state.agentSession = {
        state: AGENT.emptyState(state.lang),
        history: restoredHistory || [],
        _historyKey: historyKey
      };
    }
    if (AGENT && state.preselectedServiceId) {
      state.agentSession.state = AGENT.mergeState(
        state.agentSession.state || AGENT.emptyState(state.lang),
        { serviceId: state.preselectedServiceId, intent: 'booking_request' },
        new Date()
      );
      var input = document.getElementById('mbAgentInput');
      if (input && !input.value) input.value = selectedServiceName();
    }
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return panel;
  }

  function applyQuerySelection() {
    var serviceId = getQueryParam('serviceId');
    if (serviceId && validServiceId(serviceId)) state.preselectedServiceId = serviceId;
    var mode = getQueryParam('assistant');
    state.preselectedAssistantMode = mode === 'chat' || mode === 'voice' ? mode : '';
  }

  function openQueryMode() {
    if (state.preselectedAssistantMode === 'chat') {
      openTextFallback();
    } else if (state.preselectedAssistantMode === 'voice') {
      openVoiceAssistant();
    } else if (state.preselectedServiceId) {
      openManualBooking();
    }
  }

  function openTextFallback() {
    var panel = openAssistantPanel();
    var input = document.getElementById('mbAgentInput');
    if (input) setTimeout(function() { input.focus(); }, 120);
    return panel;
  }

  function openVoiceAssistant() {
    openAssistantPanel();
    if (!root.MobileBarberVoice) {
      openTextFallback();
      return;
    }
    var voiceController = {
      getLang: function() { return state.lang; },
      setLang: setLang,
      getSession: function() { return state.agentSession; },
      sendMessage: sendAgentMessage,
      initialPrompt: function() {
        return AGENT && typeof AGENT.initialPrompt === 'function'
          ? AGENT.initialPrompt({ vendor: state.vendor }, state.lang)
          : '';
      },
      openTextFallback: openTextFallback,
      vendorId: function() { return state.vendor && state.vendor.id; },
      geminiKey: state.voiceProviderKeys.geminiKey || '',
      openAiKey: state.voiceProviderKeys.openAiKey || '',
      platformGeminiKey: state.voiceProviderKeys.platformGeminiKey || '',
      platformOpenAiKey: state.voiceProviderKeys.platformOpenAiKey || '',
      firestoreGeminiKey: state.voiceProviderKeys.firestoreGeminiKey || '',
      firestoreOpenAiKey: state.voiceProviderKeys.firestoreOpenAiKey || '',
      vendorGeminiKey: state.voiceProviderKeys.vendorGeminiKey || '',
      vendorOpenAiKey: state.voiceProviderKeys.vendorOpenAiKey || ''
    };
    root.MobileBarberVoice.open(voiceController);
    loadVoiceProviderKeys().then(function(keys) {
      Object.assign(voiceController, {
        geminiKey: keys.geminiKey || '',
        openAiKey: keys.openAiKey || '',
        platformGeminiKey: keys.platformGeminiKey || '',
        platformOpenAiKey: keys.platformOpenAiKey || '',
        firestoreGeminiKey: keys.firestoreGeminiKey || '',
        firestoreOpenAiKey: keys.firestoreOpenAiKey || '',
        vendorGeminiKey: keys.vendorGeminiKey || '',
        vendorOpenAiKey: keys.vendorOpenAiKey || ''
      });
    });
  }

  function setLang(lang) {
    if (!STRINGS[lang]) return;
    state.lang = lang;
    document.documentElement.lang = lang;
    document.getElementById('mbVendorLanguage').setAttribute('aria-label', t('languageLabel'));
    renderVendor();
    document.querySelectorAll('.mb-language__button').forEach(function(btn) {
      btn.classList.toggle('mb-language__button--active', btn.getAttribute('data-lang') === lang);
    });
    try {
      localStorage.setItem('dlcLang', lang);
      localStorage.setItem('dlc_lang', lang);
    } catch (e) {}
  }

  function bind() {
    document.querySelectorAll('[data-lang]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        setLang(btn.getAttribute('data-lang'));
      });
    });
    document.querySelectorAll('[data-action="openAssistant"]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        openAssistantPanel();
      });
    });
    document.querySelectorAll('[data-action="openVoiceAssistant"]').forEach(function(btn) {
      btn.addEventListener('click', openVoiceAssistant);
    });
    document.querySelectorAll('[data-action="openManualBooking"]').forEach(function(btn) {
      btn.addEventListener('click', openManualBooking);
    });
    document.querySelector('[data-action="loadHistory"]').addEventListener('click', loadCustomerHistory);
    document.querySelector('[data-action="savePreference"]').addEventListener('click', saveCustomerProfile);
    document.querySelector('[data-action="closeManualBooking"]').addEventListener('click', closeManualBooking);
    document.querySelector('[data-action="manualNext"]').addEventListener('click', manualNext);
    document.querySelector('[data-action="manualBack"]').addEventListener('click', manualBack);
    document.querySelector('[data-action="manualReview"]').addEventListener('click', reviewManualBooking);
    document.querySelector('[data-action="manualConfirm"]').addEventListener('click', confirmManualBooking);
    document.getElementById('mbManualBookingForm').addEventListener('input', clearManualResult);
    document.querySelector('[data-action="closeAssistant"]').addEventListener('click', function() {
      document.getElementById('mbVendorAssistant').hidden = true;
    });
    document.getElementById('mbAgentForm').addEventListener('submit', function(event) {
      event.preventDefault();
      var input = document.getElementById('mbAgentInput');
      var message = String(input.value || '').trim();
      if (!message) return;
      input.value = '';
      sendAgentMessage(message);
    });
  }

  function init() {
    var vendorId = getVendorId();
    state.vendor = DATA && DATA.findVendorById ? DATA.findVendorById(vendorId) : null;
    state.services = state.vendor && DATA.listServicesForVendor ? DATA.listServicesForVendor(state.vendor.id) : [];
    applyQuerySelection();
    state.lang = getLang();
    bind();
    setLang(state.lang);
    loadVoiceProviderKeys();
    openQueryMode();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
