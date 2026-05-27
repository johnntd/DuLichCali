'use strict';

(function(root) {
  var DATA = root.MobileBarberData;
  var BOOKING = root.MobileBarberBooking;
  var STORAGE = {
    vendor: 'dlc_mobile_barber_vendor_overrides',
    services: 'dlc_mobile_barber_service_overrides',
    availability: 'dlc_mobile_barber_availability_overrides',
    bookings: 'dlc_mobile_barber_bookings',
    blocks: 'dlc_mobile_barber_unavailable_blocks',
    portfolio: 'dlc_mobile_barber_portfolio_overrides',
    reviews: 'dlc_mobile_barber_review_overrides',
    notified: 'dlc_mobile_barber_notified_booking_ids',
    sound: 'dlc_mobile_barber_sound_alerts'
  };

  var STRINGS = {
    en: {
      pageTitle: 'Mobile Barber Dashboard | Du Lich Cali',
      languageLabel: 'Choose language',
      dashboardKicker: 'Vendor dashboard',
      dashboardTitle: 'Mobile Barber Dashboard',
      dashboardSubtitle: '{business} can manage profile, services, hours, blocks, and booking requests here.',
      publicVendorLink: 'View Public Page',
      notificationTitle: 'Booking alerts',
      soundAlertsLabel: 'Sound alerts:',
      notificationPermissionLabel: 'Browser notifications:',
      lastBookingAlertLabel: 'Last booking alert:',
      enableSoundAlerts: 'Enable Sound Alerts',
      soundAlertsOn: 'On',
      soundAlertsOff: 'Off',
      soundAlertsBlocked: 'Needs enable',
      permissionGranted: 'Granted',
      permissionDenied: 'Denied',
      permissionDefault: 'Not requested',
      permissionUnsupported: 'Not supported',
      lastAlertNone: 'None yet',
      toggleSoundOn: 'Turn sound on',
      toggleSoundOff: 'Turn sound off',
      newBookingAlertTitle: 'New Mobile Barber Booking',
      viewBookingAction: 'View Booking',
      dismissAction: 'Dismiss',
      statToday: 'Today',
      statUpcoming: 'Upcoming',
      statPending: 'Pending',
      statInProgress: 'In progress',
      statCompleted: 'Completed today',
      appointmentListTitle: 'Appointments',
      appointmentListHint: 'Tap a card above to switch the list.',
      appointmentListHintToday: 'Showing appointments scheduled for today.',
      appointmentListHintUpcoming: 'Showing future bookings not yet started.',
      appointmentListHintPending: 'Showing requests waiting for your confirmation.',
      appointmentListHintInProgress: 'Showing appointments currently in progress or traveling.',
      appointmentListHintCompleted: "Showing today's completed appointments.",
      confirmTextChip: 'TEXT CONFIRMATION REQUIRED',
      confirmTextChipAria: 'Customer requested SMS confirmation',
      confirmCallChip: 'CALL TO CONFIRM',
      confirmAppChip: 'APP NOTIFICATION',
      confirmationPreferenceLabel: 'Customer preference',
      confirmPrefText: 'SMS (text message)',
      confirmPrefCall: 'Phone call',
      confirmPrefApp: 'In-app notification',
      sendConfirmationTextAction: 'Send Confirmation Text',
      sendConfirmationTextAria: 'Open SMS compose with prefilled confirmation',
      smsConfirmationBody: 'Hi {customer},\n\nThis is {barber} Mobile Barber.\n\nConfirming your appointment:\n\nService: {service}\nDate: {date}\nTime: {time}\n\nReply YES to confirm.\n\nThank you.',
      todayTitle: "Today's appointments",
      pendingTitle: 'Pending confirmations',
      upcomingTitle: 'Upcoming bookings',
      filterUpcoming: 'Upcoming',
      filterAll: 'All',
      filterCompleted: 'Completed',
      filterCancelled: 'Cancelled',
      refreshButton: 'Refresh',
      settingsTitle: 'Settings',
      settingsHint: 'Profile, services, hours, blocks, portfolio, and reviews. Tap a panel to expand.',
      settingsProfileTitle: 'Profile & contact',
      settingsProfileSub: 'Business name, barber, phone, email, service area',
      settingsServicesTitle: 'Services & pricing',
      settingsServicesSub: 'Service menu, prices, durations, buffers',
      settingsHoursTitle: 'Working hours',
      settingsHoursSub: 'Recurring weekly schedule',
      settingsBlocksTitle: 'Unavailable blocks',
      settingsBlocksSub: 'Days off, time off, vacation',
      settingsPortfolioTitle: 'Portfolio images',
      settingsPortfolioSub: 'Photos shown on the public vendor page',
      settingsReviewsTitle: 'Reviews & responses',
      settingsReviewsSub: 'Customer reviews and your replies',
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
      appointmentDetails: 'Appointment',
      pricingDetails: 'Pricing',
      paymentDetails: 'Payment',
      serviceType: 'Service type',
      servicePrice: 'Service price',
      travelFee: 'Travel fee',
      amountDue: 'Total amount due',
      paymentMethod: 'Payment method',
      paymentStatus: 'Payment status',
      zelleNumber: 'Zelle number',
      vehicleWearCost: 'Vehicle/travel cost included',
      quoteType: 'Quote type',
      paymentNote: 'Payment note',
      paymentCash: 'Cash',
      paymentZelle: 'Zelle',
      paymentUnknown: 'Unknown',
      paymentPaid: 'Paid',
      paymentUnpaid: 'Unpaid',
      paymentPending: 'Pending',
      paymentWaived: 'Waived',
      markPaidAction: 'Mark paid',
      markUnpaidAction: 'Mark unpaid',
      setCashAction: 'Set cash',
      setZelleAction: 'Set Zelle',
      addPaymentNoteAction: 'Payment note',
      completeAction: 'Complete',
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
      notificationTitle: 'Thông báo đặt lịch',
      soundAlertsLabel: 'Âm thanh báo lịch:',
      notificationPermissionLabel: 'Thông báo trình duyệt:',
      lastBookingAlertLabel: 'Báo lịch gần nhất:',
      enableSoundAlerts: 'Bật Âm Thanh Báo Lịch',
      soundAlertsOn: 'Bật',
      soundAlertsOff: 'Tắt',
      soundAlertsBlocked: 'Cần bật',
      permissionGranted: 'Đã cho phép',
      permissionDenied: 'Đã chặn',
      permissionDefault: 'Chưa xin quyền',
      permissionUnsupported: 'Không hỗ trợ',
      lastAlertNone: 'Chưa có',
      toggleSoundOn: 'Bật âm thanh',
      toggleSoundOff: 'Tắt âm thanh',
      newBookingAlertTitle: 'Lịch Mobile Barber Mới',
      viewBookingAction: 'Xem Lịch',
      dismissAction: 'Bỏ qua',
      statToday: 'Hôm nay',
      statUpcoming: 'Sắp tới',
      statPending: 'Chờ xác nhận',
      statInProgress: 'Đang làm',
      statCompleted: 'Hoàn tất hôm nay',
      appointmentListTitle: 'Lịch hẹn',
      appointmentListHint: 'Bấm thẻ ở trên để chuyển danh sách.',
      appointmentListHintToday: 'Hiển thị lịch hẹn cho hôm nay.',
      appointmentListHintUpcoming: 'Hiển thị lịch sắp tới chưa bắt đầu.',
      appointmentListHintPending: 'Hiển thị yêu cầu đang chờ bạn xác nhận.',
      appointmentListHintInProgress: 'Hiển thị lịch đang làm hoặc đang trên đường.',
      appointmentListHintCompleted: 'Hiển thị lịch đã hoàn tất hôm nay.',
      confirmTextChip: 'CẦN XÁC NHẬN QUA TIN NHẮN',
      confirmTextChipAria: 'Khách yêu cầu xác nhận bằng SMS',
      confirmCallChip: 'GỌI ĐIỆN XÁC NHẬN',
      confirmAppChip: 'THÔNG BÁO TRONG APP',
      confirmationPreferenceLabel: 'Khách muốn xác nhận qua',
      confirmPrefText: 'Tin nhắn (SMS)',
      confirmPrefCall: 'Gọi điện',
      confirmPrefApp: 'Thông báo trong app',
      sendConfirmationTextAction: 'Gửi tin xác nhận',
      sendConfirmationTextAria: 'Mở ứng dụng SMS với nội dung xác nhận đã điền sẵn',
      smsConfirmationBody: 'Chào {customer},\n\nĐây là {barber} Mobile Barber.\n\nXác nhận lịch hẹn của bạn:\n\nDịch vụ: {service}\nNgày: {date}\nGiờ: {time}\n\nVui lòng trả lời YES để xác nhận.\n\nCảm ơn bạn.',
      todayTitle: 'Lịch hẹn hôm nay',
      pendingTitle: 'Yêu cầu chờ xác nhận',
      upcomingTitle: 'Lịch hẹn sắp tới',
      filterUpcoming: 'Sắp tới',
      filterAll: 'Tất cả',
      filterCompleted: 'Hoàn tất',
      filterCancelled: 'Đã hủy',
      refreshButton: 'Làm mới',
      settingsTitle: 'Cài đặt',
      settingsHint: 'Hồ sơ, dịch vụ, giờ làm, ngày nghỉ, portfolio, và đánh giá. Bấm vào từng mục để mở rộng.',
      settingsProfileTitle: 'Hồ sơ & liên hệ',
      settingsProfileSub: 'Tên tiệm, thợ, số điện thoại, email, khu vực phục vụ',
      settingsServicesTitle: 'Dịch vụ & giá',
      settingsServicesSub: 'Danh mục dịch vụ, giá, thời lượng, thời gian đệm',
      settingsHoursTitle: 'Giờ làm việc',
      settingsHoursSub: 'Lịch hàng tuần lặp lại',
      settingsBlocksTitle: 'Khoảng thời gian không nhận lịch',
      settingsBlocksSub: 'Ngày nghỉ, giờ nghỉ, kỳ nghỉ',
      settingsPortfolioTitle: 'Hình portfolio',
      settingsPortfolioSub: 'Hình hiển thị trên trang vendor',
      settingsReviewsTitle: 'Đánh giá & phản hồi',
      settingsReviewsSub: 'Đánh giá khách và phản hồi của bạn',
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
      appointmentDetails: 'Lịch hẹn',
      pricingDetails: 'Giá tiền',
      paymentDetails: 'Thanh toán',
      serviceType: 'Loại dịch vụ',
      servicePrice: 'Giá dịch vụ',
      travelFee: 'Phí di chuyển',
      amountDue: 'Tổng cần thu',
      paymentMethod: 'Cách thanh toán',
      paymentStatus: 'Trạng thái thanh toán',
      zelleNumber: 'Số Zelle',
      vehicleWearCost: 'Chi phí xe/di chuyển đã gồm',
      quoteType: 'Loại báo giá',
      paymentNote: 'Ghi chú thanh toán',
      paymentCash: 'Tiền mặt',
      paymentZelle: 'Zelle',
      paymentUnknown: 'Chưa rõ',
      paymentPaid: 'Đã thu',
      paymentUnpaid: 'Chưa thu',
      paymentPending: 'Đang chờ',
      paymentWaived: 'Đã miễn',
      markPaidAction: 'Đánh dấu đã thu',
      markUnpaidAction: 'Đánh dấu chưa thu',
      setCashAction: 'Chọn tiền mặt',
      setZelleAction: 'Chọn Zelle',
      addPaymentNoteAction: 'Ghi chú thanh toán',
      completeAction: 'Hoàn tất',
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
      notificationTitle: 'Alertas de reservas',
      soundAlertsLabel: 'Alertas con sonido:',
      notificationPermissionLabel: 'Notificaciones del navegador:',
      lastBookingAlertLabel: 'Última alerta:',
      enableSoundAlerts: 'Activar Sonido',
      soundAlertsOn: 'Activo',
      soundAlertsOff: 'Inactivo',
      soundAlertsBlocked: 'Necesita activar',
      permissionGranted: 'Permitido',
      permissionDenied: 'Denegado',
      permissionDefault: 'No solicitado',
      permissionUnsupported: 'No compatible',
      lastAlertNone: 'Ninguna',
      toggleSoundOn: 'Activar sonido',
      toggleSoundOff: 'Desactivar sonido',
      newBookingAlertTitle: 'Nueva Reserva de Barbero Móvil',
      viewBookingAction: 'Ver Reserva',
      dismissAction: 'Descartar',
      statToday: 'Hoy',
      statUpcoming: 'Próximas',
      statPending: 'Pendientes',
      statInProgress: 'En curso',
      statCompleted: 'Completadas hoy',
      appointmentListTitle: 'Citas',
      appointmentListHint: 'Toca una tarjeta arriba para cambiar la lista.',
      appointmentListHintToday: 'Mostrando citas programadas para hoy.',
      appointmentListHintUpcoming: 'Mostrando reservas futuras aún no iniciadas.',
      appointmentListHintPending: 'Mostrando solicitudes esperando tu confirmación.',
      appointmentListHintInProgress: 'Mostrando citas en curso o en camino.',
      appointmentListHintCompleted: 'Mostrando las citas completadas de hoy.',
      confirmTextChip: 'CONFIRMACIÓN POR SMS REQUERIDA',
      confirmTextChipAria: 'Cliente solicitó confirmación por SMS',
      confirmCallChip: 'LLAMAR PARA CONFIRMAR',
      confirmAppChip: 'NOTIFICACIÓN EN APP',
      confirmationPreferenceLabel: 'Preferencia del cliente',
      confirmPrefText: 'SMS (mensaje de texto)',
      confirmPrefCall: 'Llamada',
      confirmPrefApp: 'Notificación en la app',
      sendConfirmationTextAction: 'Enviar SMS de confirmación',
      sendConfirmationTextAria: 'Abrir SMS con la confirmación rellenada',
      smsConfirmationBody: 'Hola {customer},\n\nSoy {barber} de Mobile Barber.\n\nConfirmando su cita:\n\nServicio: {service}\nFecha: {date}\nHora: {time}\n\nResponda YES para confirmar.\n\nGracias.',
      todayTitle: 'Citas de hoy',
      pendingTitle: 'Confirmaciones pendientes',
      upcomingTitle: 'Reservas próximas',
      filterUpcoming: 'Próximas',
      filterAll: 'Todas',
      filterCompleted: 'Completadas',
      filterCancelled: 'Canceladas',
      refreshButton: 'Actualizar',
      settingsTitle: 'Ajustes',
      settingsHint: 'Perfil, servicios, horario, bloques, portafolio y reseñas. Toca un panel para expandir.',
      settingsProfileTitle: 'Perfil y contacto',
      settingsProfileSub: 'Nombre del negocio, barbero, teléfono, correo, área de servicio',
      settingsServicesTitle: 'Servicios y precios',
      settingsServicesSub: 'Menú de servicios, precios, duración, márgenes',
      settingsHoursTitle: 'Horario de trabajo',
      settingsHoursSub: 'Horario semanal recurrente',
      settingsBlocksTitle: 'Bloques no disponibles',
      settingsBlocksSub: 'Días libres, tiempo libre, vacaciones',
      settingsPortfolioTitle: 'Imágenes del portafolio',
      settingsPortfolioSub: 'Fotos mostradas en la página pública del barbero',
      settingsReviewsTitle: 'Reseñas y respuestas',
      settingsReviewsSub: 'Reseñas de clientes y tus respuestas',
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
      appointmentDetails: 'Cita',
      pricingDetails: 'Precio',
      paymentDetails: 'Pago',
      serviceType: 'Tipo de servicio',
      servicePrice: 'Precio del servicio',
      travelFee: 'Tarifa de viaje',
      amountDue: 'Total a pagar',
      paymentMethod: 'Metodo de pago',
      paymentStatus: 'Estado de pago',
      zelleNumber: 'Numero Zelle',
      vehicleWearCost: 'Costo de viaje incluido',
      quoteType: 'Tipo de cotización',
      paymentNote: 'Nota de pago',
      paymentCash: 'Efectivo',
      paymentZelle: 'Zelle',
      paymentUnknown: 'Desconocido',
      paymentPaid: 'Pagado',
      paymentUnpaid: 'No pagado',
      paymentPending: 'Pendiente',
      paymentWaived: 'Exento',
      markPaidAction: 'Marcar pagado',
      markUnpaidAction: 'Marcar no pagado',
      setCashAction: 'Usar efectivo',
      setZelleAction: 'Usar Zelle',
      addPaymentNoteAction: 'Nota de pago',
      completeAction: 'Completar',
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
    pending_barber_confirmation: 'statusPending',
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
    reviews: [],
    bookingFilter: 'upcoming',
    summaryFilter: 'today',
    bookingAlertUnsubscribe: null,
    bookingAlertInitialSnapshot: true,
    notifiedBookingIds: {},
    soundAlertsEnabled: true,
    soundReady: false,
    soundBlocked: false,
    lastBookingAlert: '',
    expandedBookingId: null
  };
  var audioCtx = null;

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

  function readString(key, fallback) {
    try {
      var raw = root.localStorage && root.localStorage.getItem(key);
      return raw == null ? fallback : raw;
    } catch (e) {
      return fallback;
    }
  }

  function writeString(key, value) {
    try {
      if (root.localStorage) root.localStorage.setItem(key, String(value));
    } catch (e) {}
  }

  function notifiedStorageKey() {
    return STORAGE.notified + '_' + (state.vendorId || 'unknown');
  }

  function soundStorageKey() {
    return STORAGE.sound + '_' + (state.vendorId || 'unknown');
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

  function noop() {}

  function firestoreDb() {
    return canUseFirestore() ? root.firebase.firestore() : null;
  }

  function seedSamplesOnce() {
    var db = firestoreDb();
    if (!db || !DATA || typeof DATA.seedFirestoreFromSamples !== 'function') return Promise.resolve();
    try {
      if (root.sessionStorage && root.sessionStorage.getItem('dlc_mb_seeded') === '1') return Promise.resolve();
    } catch (e) {}
    return DATA.seedFirestoreFromSamples(db).then(function() {
      try {
        if (root.sessionStorage) root.sessionStorage.setItem('dlc_mb_seeded', '1');
      } catch (e) {}
    });
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
    function normalizeRows(rows) {
      state.bookings = (rows || []).map(function(booking) {
        return BOOKING && BOOKING.withPaymentDefaults
          ? BOOKING.withPaymentDefaults(booking, state.vendor)
          : booking;
      });
      return state.bookings;
    }
    var localRows = function() {
      return normalizeRows(readJson(STORAGE.bookings, []).filter(function(booking) {
        return booking.vendorId === state.vendorId;
      }));
    };
    var db = firestoreDb();
    if (!db) return Promise.resolve(localRows());
    return db.collection(DATA.COLLECTIONS.bookings)
      .where('vendorId', '==', state.vendorId)
      .get()
      .then(function(snapshot) {
        var rows = [];
        snapshot.forEach(function(doc) {
          var data = doc.data() || {};
          data.id = data.id || doc.id;
          rows.push(data);
        });
        return normalizeRows(rows);
      })
      .catch(function() {
        return localRows();
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
    var booking = (state.bookings || []).filter(function(b) { return b.id === bookingId; })[0] || null;
    var all = readJson(STORAGE.bookings, []);
    all = all.map(function(b) {
      if (b.id !== bookingId) return b;
      return Object.assign({}, b, { status: status, updatedAt: new Date().toISOString() });
    });
    writeJson(STORAGE.bookings, all);
    var writePromise = canUseFirestore()
      ? root.firebase.firestore().collection(DATA.COLLECTIONS.bookings).doc(bookingId).set({
          status: status,
          updatedAt: new Date().toISOString()
        }, { merge: true })
      : Promise.resolve();
    writePromise.then(function() {
      if (booking && root.DLCNotifications && typeof root.DLCNotifications.queueMobileBarberStatusChange === 'function') {
        try {
          root.DLCNotifications.queueMobileBarberStatusChange(
            Object.assign({}, booking, { status: status }),
            state.vendor || {},
            status,
            state.lang || 'en'
          );
        } catch (e) {
          if (root.console) root.console.warn('[mobile-barber-dashboard] notify failed', e);
        }
      }
    }).catch(function(err) {
      if (root.console) root.console.error('[mobile-barber-dashboard] status write failed', err);
    });
    loadBookings().then(render);
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

  function notificationPermissionLabel() {
    if (!('Notification' in root)) return t('permissionUnsupported');
    return t({
      granted: 'permissionGranted',
      denied: 'permissionDenied',
      default: 'permissionDefault'
    }[root.Notification.permission] || 'permissionDefault');
  }

  function getAudioCtx() {
    if (!audioCtx) {
      try {
        audioCtx = new (root.AudioContext || root.webkitAudioContext)();
      } catch (e) {
        audioCtx = null;
      }
    }
    return audioCtx;
  }

  function renderNotificationControls() {
    var soundState = document.getElementById('mbSoundAlertState');
    var permission = document.getElementById('mbNotificationPermissionState');
    var last = document.getElementById('mbLastBookingAlert');
    var toggle = document.getElementById('mbToggleSoundAlerts');
    var enable = document.querySelector('[data-action="enableSoundAlerts"]');
    if (soundState) {
      soundState.textContent = state.soundBlocked ? t('soundAlertsBlocked') : (state.soundAlertsEnabled ? t('soundAlertsOn') : t('soundAlertsOff'));
    }
    if (permission) permission.textContent = notificationPermissionLabel();
    if (last) last.textContent = state.lastBookingAlert || t('lastAlertNone');
    if (toggle) toggle.textContent = state.soundAlertsEnabled ? t('toggleSoundOff') : t('toggleSoundOn');
    if (enable) enable.hidden = state.soundReady && !state.soundBlocked;
  }

  function unlockSoundAlerts() {
    state.soundAlertsEnabled = true;
    state.soundBlocked = false;
    writeString(soundStorageKey(), 'on');
    if ('Notification' in root && root.Notification.permission === 'default' && root.Notification.requestPermission) {
      try {
        root.Notification.requestPermission().then(renderNotificationControls).catch(noop);
      } catch (e) {}
    }
    var ctx = getAudioCtx();
    if (!ctx) {
      state.soundReady = false;
      state.soundBlocked = true;
      renderNotificationControls();
      return Promise.resolve(false);
    }
    var ready = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
    return ready.then(function() {
      state.soundReady = ctx.state !== 'suspended';
      renderNotificationControls();
      return state.soundReady;
    }).catch(function() {
      state.soundReady = false;
      state.soundBlocked = true;
      renderNotificationControls();
      return false;
    });
  }

  function playBookingChime() {
    if (!state.soundAlertsEnabled) return;
    var ctx = getAudioCtx();
    if (!ctx) return;
    function doPlay() {
      try {
        [523.25, 659.25, 783.99].forEach(function(freq, i) {
          var osc = ctx.createOscillator();
          var gain = ctx.createGain();
          var start = ctx.currentTime + i * 0.18;
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.001, start);
          gain.gain.exponentialRampToValueAtTime(0.24, start + 0.035);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.55);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.58);
        });
        state.soundReady = true;
        state.soundBlocked = false;
      } catch (e) {
        state.soundBlocked = true;
      }
      renderNotificationControls();
    }
    if (ctx.state === 'suspended') {
      ctx.resume().then(doPlay).catch(function() {
        state.soundReady = false;
        state.soundBlocked = true;
        renderNotificationControls();
      });
    } else {
      doPlay();
    }
  }

  function mapUrl(booking) {
    var address = [booking.address, booking.city, booking.zip].filter(Boolean).join(', ');
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address);
  }

  function statusLabel(status) {
    return t(STATUS_LABELS[status] || 'statusPending');
  }

  function formatMoney(value) {
    return '$' + Number(value || 0).toFixed(0);
  }

  function formatTime12Hour(value) {
    return BOOKING && BOOKING.formatTime12Hour ? BOOKING.formatTime12Hour(value) : String(value || '');
  }

  function bookingStartMillis(booking) {
    var raw = [booking.requestedDate || '', booking.startTime || '00:00'].join('T');
    var parsed = Date.parse(raw);
    return isNaN(parsed) ? 0 : parsed;
  }

  function isUpcomingBooking(booking, now) {
    var status = booking.status || '';
    return status !== 'cancelled' && status !== 'completed' && bookingStartMillis(booking) >= now.getTime();
  }

  function filteredBookings(now) {
    now = now || new Date();
    var rows = (state.bookings || []).slice();
    if (state.bookingFilter === 'completed') rows = rows.filter(function(b) { return b.status === 'completed'; });
    else if (state.bookingFilter === 'cancelled') rows = rows.filter(function(b) { return b.status === 'cancelled'; });
    else if (state.bookingFilter === 'upcoming') rows = rows.filter(function(b) { return isUpcomingBooking(b, now); });
    return rows.sort(function(a, b) { return bookingStartMillis(a) - bookingStartMillis(b); });
  }

  function serviceForBooking(booking) {
    return (state.services || []).filter(function(service) {
      return service.id === booking.serviceId;
    })[0] || {};
  }

  function paymentMethodLabel(method) {
    method = BOOKING && BOOKING.normalizePaymentMethod ? BOOKING.normalizePaymentMethod(method) : (method || 'unknown');
    return t({ cash: 'paymentCash', zelle: 'paymentZelle', unknown: 'paymentUnknown' }[method] || 'paymentUnknown');
  }

  function paymentStatusLabel(status) {
    status = BOOKING && BOOKING.normalizePaymentStatus ? BOOKING.normalizePaymentStatus(status) : (status || 'unpaid');
    return t({ paid: 'paymentPaid', unpaid: 'paymentUnpaid', pending: 'paymentPending', waived: 'paymentWaived' }[status] || 'paymentUnpaid');
  }

  function confirmationPreferenceLabel(pref) {
    var key = { text: 'confirmPrefText', call: 'confirmPrefCall', app: 'confirmPrefApp' }[String(pref || '').toLowerCase()] || 'confirmPrefText';
    return t(key);
  }

  // Phone-friendly digits only (preserves leading + if present).
  function smsAddress(phone) {
    var s = String(phone || '').trim();
    if (!s) return '';
    var plus = s.charAt(0) === '+' ? '+' : '';
    return plus + s.replace(/[^\d]/g, '');
  }

  function buildConfirmationSmsHref(booking) {
    var customerPhone = smsAddress(booking.customerPhone);
    if (!customerPhone) return '#';
    var body = buildConfirmationSmsBody(booking);
    // iOS uses ?&body=; Android tolerates ?body=. ?&body= works for both.
    return 'sms:' + customerPhone + '?&body=' + encodeURIComponent(body);
  }

  function buildConfirmationSmsBody(booking) {
    var firstName = String(booking.customerName || '').trim().split(/\s+/)[0] || 'there';
    var barber = (state.vendor && (state.vendor.barberName || state.vendor.businessName)) || 'your barber';
    var serviceName = booking.serviceName || '';
    var date = booking.requestedDate || '';
    var time = formatTime12Hour(booking.startTime) || booking.startTime || '';
    return interpolate(t('smsConfirmationBody'), {
      customer: firstName,
      barber: barber,
      service: serviceName,
      date: date,
      time: time
    });
  }

  function detailSection(title, rows) {
    var section = el('div', 'mb-booking-card__section');
    var heading = el('h4');
    var dl = el('dl', 'mb-booking-card__details');
    heading.textContent = title;
    rows.forEach(function(row) {
      if (row[1] == null || row[1] === '') return;
      var wrap = el('div');
      var dt = el('dt');
      var dd = el('dd');
      dt.textContent = row[0];
      dd.textContent = row[1];
      wrap.appendChild(dt);
      wrap.appendChild(dd);
      dl.appendChild(wrap);
    });
    section.appendChild(heading);
    section.appendChild(dl);
    return section;
  }

  function updateBookingPatch(bookingId, patch) {
    var now = new Date().toISOString();
    patch = Object.assign({}, patch || {}, { updatedAt: now });
    var all = readJson(STORAGE.bookings, []);
    all = all.map(function(b) {
      return b.id === bookingId ? Object.assign({}, b, patch) : b;
    });
    writeJson(STORAGE.bookings, all);
    state.bookings = state.bookings.map(function(b) {
      return b.id === bookingId ? (BOOKING.withPaymentDefaults ? BOOKING.withPaymentDefaults(Object.assign({}, b, patch), state.vendor) : Object.assign({}, b, patch)) : b;
    });
    render();
    if (canUseFirestore()) {
      root.firebase.firestore().collection(DATA.COLLECTIONS.bookings).doc(bookingId).set(patch, { merge: true })
        .catch(function(err) {
          if (root.console) root.console.error('[mobile-barber-dashboard] booking patch failed', err);
        });
    }
  }

  function updateBookingPayment(bookingId, patch) {
    if (patch.paymentMethod != null && BOOKING && BOOKING.normalizePaymentMethod) {
      patch.paymentMethod = BOOKING.normalizePaymentMethod(patch.paymentMethod);
    }
    if (patch.paymentStatus != null && BOOKING && BOOKING.normalizePaymentStatus) {
      patch.paymentStatus = BOOKING.normalizePaymentStatus(patch.paymentStatus);
    }
    updateBookingPatch(bookingId, patch);
  }

  // Map a booking status onto one of six visual buckets used by the row
  // (pending / confirmed / traveling / completed / cancelled / repeat).
  function statusBucket(status) {
    switch (status) {
      case 'pending_confirmation':
      case 'pending_barber_confirmation':
      case 'vendor_review': return 'pending';
      case 'confirmed': return 'confirmed';
      case 'in_progress':
      case 'traveling':    return 'traveling';
      case 'completed':    return 'completed';
      case 'cancelled':    return 'cancelled';
      default:             return 'pending';
    }
  }

  function bookingCard(booking) {
    // Compact list row + click-to-expand detail panel. The function name
    // stays bookingCard() so existing callers (renderBookingList, viewBooking,
    // realtime alerts) keep working without changes.
    var row = el('article', 'mb-booking-row');
    var bucket = statusBucket(booking.status);
    row.classList.add('mb-booking-row--' + bucket);
    row.id = 'mbBookingCard-' + String(booking.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
    row.setAttribute('data-booking-id', booking.id || '');
    row.setAttribute('data-status', booking.status || '');
    var isExpanded = state.expandedBookingId === booking.id;
    if (isExpanded) row.classList.add('mb-booking-row--expanded');

    var service = serviceForBooking(booking);
    var duration = booking.durationMinutes || service.durationMinutes || '';
    var total = booking.amountDue != null ? booking.amountDue : Number(booking.servicePrice || 0) + Number(booking.travelFee || 0);
    var zellePhone = booking.zellePhone || (state.vendor && state.vendor.phone) || '';
    var locationStr = [booking.city, booking.zip].filter(Boolean).join(' • ');
    var serviceStr = booking.serviceName || booking.serviceId || '';

    // Head — single tappable button so the whole row toggles expansion
    var head = el('button', 'mb-booking-row__head');
    head.type = 'button';
    head.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');

    var pill = el('span', 'mb-booking-row__status mb-status-pill mb-status-pill--' + bucket);
    pill.textContent = statusLabel(booking.status);
    head.appendChild(pill);

    var time = el('span', 'mb-booking-row__time');
    time.textContent = formatTime12Hour(booking.startTime) || booking.requestedDate || '';
    head.appendChild(time);

    var meat = el('span', 'mb-booking-row__meat');
    var who = el('strong', 'mb-booking-row__customer');
    who.textContent = booking.customerName || '—';
    meat.appendChild(who);
    var svc = el('span', 'mb-booking-row__service');
    svc.textContent = serviceStr;
    meat.appendChild(svc);
    if (locationStr) {
      var loc = el('span', 'mb-booking-row__city');
      loc.textContent = locationStr;
      meat.appendChild(loc);
    }
    head.appendChild(meat);

    var price = el('span', 'mb-booking-row__price');
    price.textContent = formatMoney(total);
    head.appendChild(price);

    // Confirmation preference chip — highlighted when customer wants TEXT
    // so the vendor can see at a glance which rows need an SMS confirmation.
    var pref = String(booking.confirmationPreference || 'text').toLowerCase();
    if (pref === 'text') {
      var smsChip = el('span', 'mb-confirmation-chip mb-confirmation-chip--text');
      smsChip.setAttribute('aria-label', t('confirmTextChipAria'));
      smsChip.textContent = '📱 ' + t('confirmTextChip');
      head.appendChild(smsChip);
    } else if (pref === 'call') {
      var callChip = el('span', 'mb-confirmation-chip mb-confirmation-chip--call');
      callChip.textContent = '📞 ' + t('confirmCallChip');
      head.appendChild(callChip);
    } else if (pref === 'app') {
      var appChip = el('span', 'mb-confirmation-chip mb-confirmation-chip--app');
      appChip.textContent = '🔔 ' + t('confirmAppChip');
      head.appendChild(appChip);
    }

    var chevron = el('span', 'mb-booking-row__chevron');
    chevron.setAttribute('aria-hidden', 'true');
    chevron.textContent = '▾';
    head.appendChild(chevron);

    head.addEventListener('click', function() {
      toggleBookingRow(booking.id);
    });
    row.appendChild(head);

    // Detail panel — built lazily but always in DOM (hidden when collapsed)
    var detail = el('div', 'mb-booking-row__detail');
    detail.hidden = !isExpanded;

    var actions = el('div', 'mb-booking-card__actions mb-booking-row__actions');
    if (trim(booking.address)) {
      var link = el('a', 'mb-button mb-button--ghost mb-button--sm');
      link.href = mapUrl(booking);
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = t('mapLink');
      actions.appendChild(link);
    }
    // SMS confirmation launcher — opens the vendor's native SMS app composing
    // to the customer with a prefilled confirmation template. Shown only when
    // (a) the customer asked for text confirmation AND (b) we have a phone.
    if (pref === 'text' && trim(booking.customerPhone)) {
      var smsBtn = el('a', 'mb-button mb-button--primary mb-button--sm mb-sms-button');
      smsBtn.href = buildConfirmationSmsHref(booking);
      smsBtn.textContent = '📱 ' + t('sendConfirmationTextAction');
      smsBtn.setAttribute('aria-label', t('sendConfirmationTextAria'));
      actions.appendChild(smsBtn);
    }
    [
      ['confirmed', 'acceptAction'],
      ['rescheduled', 'rescheduleAction'],
      ['cancelled', 'cancelAction'],
      ['completed', 'completeAction']
    ].forEach(function(pair) {
      var btn = el('button', 'mb-button mb-button--ghost mb-button--sm');
      btn.type = 'button';
      btn.textContent = t(pair[1]);
      btn.addEventListener('click', function() { updateBookingStatus(booking.id, pair[0]); });
      actions.appendChild(btn);
    });
    [
      ['paid', 'markPaidAction'],
      ['unpaid', 'markUnpaidAction']
    ].forEach(function(pair) {
      var btn = el('button', 'mb-button mb-button--ghost mb-button--sm');
      btn.type = 'button';
      btn.textContent = t(pair[1]);
      btn.addEventListener('click', function() { updateBookingPayment(booking.id, { paymentStatus: pair[0] }); });
      actions.appendChild(btn);
    });
    [
      ['cash', 'setCashAction'],
      ['zelle', 'setZelleAction']
    ].forEach(function(pair) {
      var btn = el('button', 'mb-button mb-button--ghost mb-button--sm');
      btn.type = 'button';
      btn.textContent = t(pair[1]);
      btn.addEventListener('click', function() { updateBookingPayment(booking.id, { paymentMethod: pair[0], zellePhone: zellePhone }); });
      actions.appendChild(btn);
    });
    var noteBtn = el('button', 'mb-button mb-button--ghost mb-button--sm');
    noteBtn.type = 'button';
    noteBtn.textContent = t('addPaymentNoteAction');
    noteBtn.addEventListener('click', function() {
      var note = root.prompt ? root.prompt(t('paymentNote'), booking.paymentNote || '') : null;
      if (note != null) updateBookingPayment(booking.id, { paymentNote: note });
    });
    actions.appendChild(noteBtn);

    detail.appendChild(detailSection(t('customerContact'), [
      ['Name', booking.customerName],
      [t('phoneLabel'), booking.customerPhone],
      [t('emailLabel'), booking.customerEmail],
      [t('confirmationPreferenceLabel'), confirmationPreferenceLabel(pref)]
    ]));
    detail.appendChild(detailSection(t('appointmentDetails'), [
      [t('serviceNameLabel'), serviceStr],
      [t('serviceType'), service.category || booking.serviceCategory || ''],
      [t('serviceDurationLabel'), duration ? duration + ' ' + t('minutesShort') : ''],
      [t('blockDateLabel'), booking.requestedDate],
      [t('blockStartLabel'), formatTime12Hour(booking.startTime)],
      [t('blockEndLabel'), formatTime12Hour(booking.endTime)],
      ['Status', statusLabel(booking.status)]
    ]));
    detail.appendChild(detailSection(t('customerAddress'), [
      [t('customerAddress'), [booking.address, booking.city, booking.zip].filter(Boolean).join(', ')]
    ]));
    detail.appendChild(detailSection(t('pricingDetails'), [
      [t('servicePrice'), formatMoney(booking.servicePrice)],
      [t('travelFee'), formatMoney(booking.travelFee)],
      [t('vehicleWearCost'), booking.vehicleWearCost ? formatMoney(booking.vehicleWearCost) : formatMoney(0)],
      [t('amountDue'), formatMoney(total)],
      [t('quoteType'), booking.quoteType || 'standard']
    ]));
    detail.appendChild(detailSection(t('paymentDetails'), [
      [t('paymentMethod'), paymentMethodLabel(booking.paymentMethod)],
      [t('paymentStatus'), paymentStatusLabel(booking.paymentStatus)],
      [t('zelleNumber'), zellePhone],
      [t('paymentNote'), booking.paymentNote]
    ]));
    if (trim(booking.notes)) {
      var notes = el('p');
      notes.textContent = t('customerNotes') + ': ' + booking.notes;
      detail.appendChild(notes);
    }
    if (trim(booking.aiConversationSummary)) {
      var aiSummary = el('p');
      aiSummary.textContent = 'AI: ' + booking.aiConversationSummary;
      detail.appendChild(aiSummary);
    }
    if (trim(booking.stylePreference) || trim(booking.previousServiceName) || trim(booking.rebookedFromBookingId)) {
      var history = el('p');
      history.textContent = t('customerCutHistory') + ': ' + [
        trim(booking.previousServiceName) ? t('previousService') + ' ' + booking.previousServiceName : '',
        trim(booking.stylePreference) ? t('stylePreference') + ' ' + booking.stylePreference : '',
        trim(booking.rebookedFromBookingId) ? booking.rebookedFromBookingId : ''
      ].filter(Boolean).join(' • ');
      detail.appendChild(history);
    }
    if (Array.isArray(booking.photoUrls) && booking.photoUrls.length) {
      var photos = el('p');
      photos.textContent = t('referencePhotos') + ': ' + booking.photoUrls.join(', ');
      detail.appendChild(photos);
    }
    detail.appendChild(actions);
    row.appendChild(detail);
    return row;
  }

  function toggleBookingRow(bookingId) {
    if (!bookingId) return;
    state.expandedBookingId = state.expandedBookingId === bookingId ? null : bookingId;
    renderBookings();
  }

  function markBookingNotified(bookingId) {
    if (!bookingId) return;
    state.notifiedBookingIds[bookingId] = Date.now();
    var ids = Object.keys(state.notifiedBookingIds).sort(function(a, b) {
      return Number(state.notifiedBookingIds[b] || 0) - Number(state.notifiedBookingIds[a] || 0);
    }).slice(0, 80);
    var trimmed = {};
    ids.forEach(function(id) { trimmed[id] = state.notifiedBookingIds[id]; });
    state.notifiedBookingIds = trimmed;
    writeJson(notifiedStorageKey(), trimmed);
  }

  function shouldAlertForBooking(booking, changeType) {
    if (!booking || booking.vendorId !== state.vendorId) return false;
    var bookingId = booking.id || booking.bookingId || '';
    if (!bookingId || state.notifiedBookingIds[bookingId]) return false;
    var status = booking.status || '';
    var alertStatuses = {
      pending_barber_confirmation: true,
      pending_confirmation: true,
      vendor_review: true,
      confirmed: true
    };
    return changeType === 'added' || !!alertStatuses[status];
  }

  function formatAlertAddress(booking) {
    return [booking.address, booking.city, booking.zip].filter(Boolean).join(', ');
  }

  function formatAlertMessage(booking) {
    var amount = booking.amountDue != null ? booking.amountDue : Number(booking.servicePrice || 0) + Number(booking.travelFee || 0);
    return [
      'Customer: ' + (booking.customerName || ''),
      'Phone: ' + (booking.customerPhone || ''),
      'Service: ' + (booking.serviceName || booking.serviceId || ''),
      'Date: ' + (booking.requestedDate || ''),
      'Time: ' + formatTime12Hour(booking.startTime),
      'Address: ' + formatAlertAddress(booking),
      'Payment: ' + paymentMethodLabel(booking.paymentMethod),
      'Amount Due: ' + formatMoney(amount)
    ].filter(function(line) { return !/: $/.test(line); }).join('\n');
  }

  function viewBooking(bookingId) {
    state.bookingFilter = 'all';
    renderBookings();
    root.setTimeout(function() {
      var card = null;
      document.querySelectorAll('[data-booking-id]').forEach(function(node) {
        if (node.getAttribute('data-booking-id') === String(bookingId)) card = node;
      });
      if (!card) return;
      card.classList.add('mb-booking-card--highlight');
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      root.setTimeout(function() { card.classList.remove('mb-booking-card--highlight'); }, 2800);
    }, 30);
  }

  function showBookingAlert(booking) {
    var region = document.getElementById('mbBookingAlertRegion');
    if (!region) return;
    var bookingId = booking.id || booking.bookingId || '';
    var popup = el('article', 'mb-booking-alert');
    var title = el('h3');
    var message = el('pre');
    var actions = el('div', 'mb-booking-alert__actions');
    var view = el('button', 'mb-button mb-button--primary mb-button--sm');
    var dismiss = el('button', 'mb-button mb-button--ghost mb-button--sm');
    title.textContent = t('newBookingAlertTitle');
    message.textContent = formatAlertMessage(booking);
    view.type = 'button';
    view.textContent = t('viewBookingAction');
    view.addEventListener('click', function() {
      popup.remove();
      viewBooking(bookingId);
    });
    dismiss.type = 'button';
    dismiss.textContent = t('dismissAction');
    dismiss.addEventListener('click', function() { popup.remove(); });
    actions.appendChild(view);
    actions.appendChild(dismiss);
    popup.appendChild(title);
    popup.appendChild(message);
    popup.appendChild(actions);
    region.appendChild(popup);
    state.lastBookingAlert = [booking.customerName || bookingId, booking.requestedDate, formatTime12Hour(booking.startTime)].filter(Boolean).join(' • ');
    renderNotificationControls();
    if ('Notification' in root && root.Notification.permission === 'granted') {
      try {
        var nativeNotice = new root.Notification(t('newBookingAlertTitle'), {
          body: [booking.customerName || '', booking.serviceName || '', booking.requestedDate || '', formatTime12Hour(booking.startTime)].filter(Boolean).join(' • '),
          tag: 'mobile-barber-' + bookingId
        });
        nativeNotice.onclick = function() {
          try { root.focus(); } catch (e) {}
          viewBooking(bookingId);
          nativeNotice.close();
        };
      } catch (e) {}
    }
    root.setTimeout(function() {
      if (popup && popup.parentNode) popup.remove();
    }, 45000);
  }

  function handleBookingAlert(booking, changeType) {
    var bookingId = booking && (booking.id || booking.bookingId || '');
    if (bookingId && state.bookingAlertInitialSnapshot) {
      markBookingNotified(bookingId);
      return;
    }
    if (!shouldAlertForBooking(booking, changeType)) {
      return;
    }
    markBookingNotified(bookingId);
    showBookingAlert(booking);
    playBookingChime();
  }

  function subscribeBookingAlerts() {
    var db = firestoreDb();
    if (!db || !DATA || !DATA.COLLECTIONS || !DATA.COLLECTIONS.bookings || !state.vendorId) return;
    if (state.bookingAlertUnsubscribe) state.bookingAlertUnsubscribe();
    state.bookingAlertInitialSnapshot = true;
    var query = db.collection(DATA.COLLECTIONS.bookings)
      .where('vendorId', '==', state.vendorId)
      .orderBy('createdAt', 'desc')
      .limit(25);
    state.bookingAlertUnsubscribe = query.onSnapshot(function(snapshot) {
      snapshot.docChanges().forEach(function(change) {
        var data = change.doc.data() || {};
        data.id = data.id || change.doc.id;
        handleBookingAlert(data, change.type);
      });
      state.bookingAlertInitialSnapshot = false;
      loadBookings().then(renderBookings);
    }, function(err) {
      if (root.console) root.console.warn('[mobile-barber-dashboard] booking alert listener failed', err);
      if (state.bookingAlertUnsubscribe) state.bookingAlertUnsubscribe();
      state.bookingAlertUnsubscribe = db.collection(DATA.COLLECTIONS.bookings)
        .where('vendorId', '==', state.vendorId)
        .limit(25)
        .onSnapshot(function(snapshot) {
          snapshot.docChanges().forEach(function(change) {
            var data = change.doc.data() || {};
            data.id = data.id || change.doc.id;
            handleBookingAlert(data, change.type);
          });
          state.bookingAlertInitialSnapshot = false;
          loadBookings().then(renderBookings);
        });
    });
  }

  function renderBookingList(id, rows) {
    var list = document.getElementById(id);
    if (!list) return;
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

  // Bucket rows by summary-card filter. Sorting is by start time except for
  // completed_today which sorts most-recent first since the operator usually
  // wants to see the freshly finished bookings at the top.
  function bookingsForSummaryFilter(filter, now) {
    now = now || new Date();
    var today = getTodayIso();
    var active = (state.bookings || []).filter(function(b) {
      return b.status !== 'cancelled' && b.status !== 'completed';
    });
    var rows;
    if (filter === 'today') {
      rows = active.filter(function(b) { return b.requestedDate === today; });
    } else if (filter === 'upcoming') {
      rows = active.filter(function(b) { return isUpcomingBooking(b, now); });
    } else if (filter === 'pending') {
      rows = active.filter(function(b) {
        return b.status === 'pending_confirmation' || b.status === 'pending_barber_confirmation' || b.status === 'vendor_review';
      });
    } else if (filter === 'in_progress') {
      rows = active.filter(function(b) {
        return b.status === 'in_progress' || b.status === 'traveling';
      });
    } else if (filter === 'completed_today') {
      rows = (state.bookings || []).filter(function(b) {
        return b.status === 'completed' && b.requestedDate === today;
      });
      return rows.sort(function(a, b) { return bookingStartMillis(b) - bookingStartMillis(a); });
    } else {
      rows = active;
    }
    return rows.sort(function(a, b) { return bookingStartMillis(a) - bookingStartMillis(b); });
  }

  function renderBookings() {
    var now = new Date();
    var today = getTodayIso();
    var active = state.bookings.filter(function(booking) { return booking.status !== 'cancelled' && booking.status !== 'completed'; });
    var todayRows = active.filter(function(booking) { return booking.requestedDate === today; });
    var upcomingRows = active.filter(function(booking) { return isUpcomingBooking(booking, now); });
    var pendingRows = active.filter(function(booking) {
      return booking.status === 'pending_confirmation' || booking.status === 'pending_barber_confirmation' || booking.status === 'vendor_review';
    });
    var inProgressRows = active.filter(function(booking) {
      return booking.status === 'in_progress' || booking.status === 'traveling';
    });
    var completedTodayRows = state.bookings.filter(function(booking) {
      return booking.status === 'completed' && booking.requestedDate === today;
    });
    // Counters stay live and synced regardless of which filter is active.
    document.getElementById('mbStatToday').textContent = todayRows.length;
    document.getElementById('mbStatUpcoming').textContent = upcomingRows.length;
    document.getElementById('mbStatPending').textContent = pendingRows.length;
    var inProg = document.getElementById('mbStatInProgress');
    if (inProg) inProg.textContent = inProgressRows.length;
    var completed = document.getElementById('mbStatCompleted');
    if (completed) completed.textContent = completedTodayRows.length;

    // Single appointment list driven by the active summary card.
    var activeFilter = state.summaryFilter || 'today';
    var rows = bookingsForSummaryFilter(activeFilter, now);
    renderBookingList('mbAppointmentList', rows);
    var title = document.getElementById('mbAppointmentListTitle');
    if (title) title.textContent = summaryFilterTitle(activeFilter, rows.length);
    var hint = document.getElementById('mbAppointmentListHint');
    if (hint) hint.textContent = summaryFilterHint(activeFilter);
    // Sync card active states (CSS + ARIA).
    document.querySelectorAll('[data-summary-filter]').forEach(function(btn) {
      var isActive = btn.getAttribute('data-summary-filter') === activeFilter;
      btn.classList.toggle('mb-dashboard-stats__article--active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    // Legacy chip filter (now unused in DOM but tolerated).
    document.querySelectorAll('[data-booking-filter]').forEach(function(btn) {
      btn.classList.toggle('mb-button--primary', btn.getAttribute('data-booking-filter') === state.bookingFilter);
    });
  }

  function summaryFilterTitle(filter, count) {
    var labelKey;
    if (filter === 'today') labelKey = 'statToday';
    else if (filter === 'upcoming') labelKey = 'statUpcoming';
    else if (filter === 'pending') labelKey = 'statPending';
    else if (filter === 'in_progress') labelKey = 'statInProgress';
    else if (filter === 'completed_today') labelKey = 'statCompleted';
    else labelKey = 'upcomingTitle';
    return t(labelKey) + ' (' + (count || 0) + ')';
  }

  function summaryFilterHint(filter) {
    var key;
    if (filter === 'today') key = 'appointmentListHintToday';
    else if (filter === 'upcoming') key = 'appointmentListHintUpcoming';
    else if (filter === 'pending') key = 'appointmentListHintPending';
    else if (filter === 'in_progress') key = 'appointmentListHintInProgress';
    else if (filter === 'completed_today') key = 'appointmentListHintCompleted';
    else key = 'appointmentListHint';
    return t(key);
  }

  function setSummaryFilter(filter) {
    if (!filter) return;
    state.summaryFilter = filter;
    state.expandedBookingId = null;
    renderBookings();
    var list = document.getElementById('mbAppointmentList');
    if (list && typeof list.scrollIntoView === 'function') {
      try { list.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
    }
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
    var card = document.getElementById('mbDashboardVendorCard');
    if (card) {
      card.innerHTML = '<strong>Vendor:</strong> ' + [
        state.vendor.businessName || state.vendorId,
        state.vendor.barberName || '',
        state.vendor.region || (state.vendor.serviceAreas || []).slice(0, 2).join(', '),
        'Zelle: ' + (state.vendor.phone || '')
      ].filter(Boolean).map(function(part) { return String(part).replace(/</g, '&lt;').replace(/>/g, '&gt;'); }).join('<br>');
    }
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
    renderNotificationControls();
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
      loadBookings().then(renderBookings);
    });
    document.querySelectorAll('[data-booking-filter]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        state.bookingFilter = btn.getAttribute('data-booking-filter') || 'upcoming';
        renderBookings();
      });
    });
    document.querySelectorAll('[data-summary-filter]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        setSummaryFilter(btn.getAttribute('data-summary-filter'));
      });
      btn.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setSummaryFilter(btn.getAttribute('data-summary-filter'));
        }
      });
    });
    document.querySelector('[data-action="saveProfile"]').addEventListener('click', saveProfile);
    document.querySelector('[data-action="saveService"]').addEventListener('click', saveService);
    document.querySelector('[data-action="saveHours"]').addEventListener('click', saveHours);
    document.querySelector('[data-action="addBlock"]').addEventListener('click', addBlock);
    document.querySelector('[data-action="addPortfolio"]').addEventListener('click', addPortfolioImage);
    document.querySelector('[data-action="saveReviewResponses"]').addEventListener('click', saveReviewResponses);
    document.querySelector('[data-action="enableSoundAlerts"]').addEventListener('click', unlockSoundAlerts);
    document.querySelector('[data-action="toggleSoundAlerts"]').addEventListener('click', function() {
      state.soundAlertsEnabled = !state.soundAlertsEnabled;
      state.soundBlocked = false;
      writeString(soundStorageKey(), state.soundAlertsEnabled ? 'on' : 'off');
      if (state.soundAlertsEnabled) unlockSoundAlerts();
      renderNotificationControls();
    });
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
    state.notifiedBookingIds = readJson(notifiedStorageKey(), {});
    state.soundAlertsEnabled = readString(soundStorageKey(), 'on') !== 'off';
    loadVendor();
    loadServices();
    loadAvailability();
    loadBlocks();
    loadPortfolio();
    loadReviews();
    bind();
    seedSamplesOnce().catch(noop).then(function() {
      return loadBookings();
    }).then(function() {
      render();
      subscribeBookingAlerts();
    });
  }

  function redirectToLogin(vendorId) {
    var dest = '/vendor-login.html';
    if (vendorId) dest += '?id=' + encodeURIComponent(vendorId);
    root.location.href = dest;
  }

  function gateAndInit() {
    var requestedVendorId = getVendorId();
    if (typeof firebase === 'undefined' || !firebase.auth) {
      console.error('[mobile-barber-dashboard] Firebase Auth SDK not loaded');
      redirectToLogin(requestedVendorId);
      return;
    }
    if (!requestedVendorId) {
      redirectToLogin('');
      return;
    }
    var auth = firebase.auth();
    var db = firebase.firestore();
    var unsub = auth.onAuthStateChanged(function(user) {
      unsub();
      if (!user) {
        redirectToLogin(requestedVendorId);
        return;
      }
      Promise.all([
        db.collection('vendorUsers').doc(user.uid).get(),
        db.collection('vendors').doc(requestedVendorId).get()
      ]).then(function(results) {
        var uDoc = results[0];
        var vDoc = results[1];
        if (!uDoc.exists) {
          console.warn('[mobile-barber-dashboard] no vendorUsers/{uid} mapping for', user.uid);
          auth.signOut().then(function() { redirectToLogin(requestedVendorId); });
          return;
        }
        var uData = uDoc.data() || {};
        var allowed = uData.vendorId === requestedVendorId
                   || (Array.isArray(uData.vendorIds) && uData.vendorIds.indexOf(requestedVendorId) >= 0);
        if (!allowed) {
          console.warn('[mobile-barber-dashboard] user not authorized for vendor', requestedVendorId);
          auth.signOut().then(function() { redirectToLogin(requestedVendorId); });
          return;
        }
        if (!vDoc.exists) {
          console.warn('[mobile-barber-dashboard] vendor doc missing for', requestedVendorId);
          redirectToLogin(requestedVendorId);
          return;
        }
        var vData = vDoc.data() || {};
        if (vData.adminStatus && vData.adminStatus !== 'active') {
          console.warn('[mobile-barber-dashboard] vendor adminStatus=', vData.adminStatus);
          auth.signOut().then(function() { redirectToLogin(requestedVendorId); });
          return;
        }
        init();
      }).catch(function(err) {
        console.error('[mobile-barber-dashboard] auth check failed', err);
        redirectToLogin(requestedVendorId);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', gateAndInit);
  } else {
    gateAndInit();
  }
})(window);
