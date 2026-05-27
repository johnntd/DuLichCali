'use strict';

(function(root) {
  var DATA = root.MobileBarberData;
  var BOOKING = root.MobileBarberBooking;
  var AGENT = root.MobileBarberAgent;

  var STRINGS = {
    en: {
      pageTitle: 'Mobile Barber | Du Lich Cali',
      languageLabel: 'Choose language',
      heroActionsLabel: 'Mobile barber actions',
      trustLabel: 'Mobile barber trust details',
      heroKicker: 'Orange County house calls',
      heroTitle: 'Mobile Barber — In-Home Haircuts',
      heroCopy: 'Book a verified barber to come to your home, hotel, office, or care facility with clear pricing before the appointment is confirmed.',
      heroStatus: 'Verified barber',
      heroCardTitle: 'Cuts at your address',
      heroCardSub: 'Service area, price, duration, and confirmation shown before booking.',
      bookNow: 'Book Now',
      chatAssistant: 'Chat with AI Barber Assistant',
      talkAssistant: 'Talk to AI Barber Assistant',
      trustChipLicensed: 'Licensed barber',
      trustChipHouseCall: 'House call',
      trustChipVerified: 'Verified vendor',
      trustChipTravel: 'Travel coverage',
      trustChipFamily: 'Family package',
      trustHomeTitle: 'In-home service',
      trustHomeCopy: 'The barber travels to your selected address.',
      trustVerifiedTitle: 'Verified barber',
      trustVerifiedCopy: 'Profiles show service area and language support.',
      trustPricingTitle: 'Transparent pricing',
      trustPricingCopy: 'Each card shows price, duration, and travel fee.',
      trustConfirmTitle: 'Appointment confirmation',
      trustConfirmCopy: 'Bookings stay pending until availability is checked.',
      promoKicker: 'Service preview',
      promoTitle: 'Latest AI Haircut Styles',
      promoCopy: 'Swipe through fade, taper, beard trim, kids cut, business cut, senior cut, line up, and family package previews.',
      promoCta: 'Book an in-home haircut today',
      beforeAfterKicker: 'Style previews',
      beforeAfterTitle: 'AI-generated mobile barber style previews',
      beforeAfterCopy: 'Curated AI previews of mobile barber styles. Real barber portfolio photos coming soon.',
      stylePreviewSuffix: 'Style Preview',
      convenienceKicker: 'Convenience',
      convenienceTitle: 'Mobile Haircut Convenience',
      promoClipsKicker: 'Promo clips',
      promoClipsTitle: 'Animated mobile barber promos',
      promoClipsCopy: 'Video generation is not wired on this page yet, so these cards use motion fallback instead of repeating the hero image.',
      servicesKicker: 'Services',
      servicesTitle: 'Choose a mobile barber service',
      vendorsKicker: 'Coverage',
      vendorsTitle: 'Where we serve',
      coverageCityListLabel: 'Cities served',
      coverageCta: 'Find My Barber',
      coverageRegionOC: 'Orange County coverage',
      coverageRegionBay: 'Bay Area coverage',
      regionGateBannerOC: 'Orange County coverage selected. Enter your city or ZIP to get matched with the nearest barber.',
      regionGateBannerBay: 'Bay Area coverage selected. Enter your city or ZIP to get matched with the nearest barber.',
      barberMatchedAnnounce: 'Got it. The AI assistant will confirm the right barber for {city}.',
      priceLabel: 'Price',
      durationLabel: 'Duration',
      travelBufferLabel: 'Travel buffer',
      cleanupLabel: 'Cleanup',
      minutes: 'min',
      selectService: 'Select Service',
      selectedServiceLabel: 'Selected service',
      bookThisService: 'Book this service',
      chatThisService: 'Chat with AI to book',
      talkThisService: 'Talk to AI to book',
      locationGateKicker: 'Service area',
      locationGateTitle: 'What city or ZIP should the barber come to?',
      locationGateCopy: 'Enter your city or 5-digit ZIP — either one is enough to match you with the right mobile barber.',
      cityLabel: 'City',
      zipLabel: 'ZIP code',
      findMyBarber: 'Find My Barber',
      changeLocation: 'Change location',
      emailLabel: 'Email',
      notifyMe: 'Notify me',
      noServiceArea: "We don't serve {city} yet. Leave your email and we'll let you know when we expand.",
      waitlistSaved: "Thanks. We'll let you know when we expand there.",
      locationRequired: 'Please enter a city or 5-digit ZIP code.',
      saveFailedRetry: "We couldn't save the booking just now. Please try again, or call the barber directly.",
      howMatchingKicker: 'How it works',
      howMatchingTitle: 'We match you with the right barber automatically',
      howMatchingIntro: "Tap Book Now or Chat below. You'll share your address with the AI assistant — we'll match you with the nearest available barber and send your request for confirmation.",
      howMatchingStep1Title: 'Enter your address',
      howMatchingStep1Body: " — Tell the assistant where the barber should come (the address you give decides who serves you).",
      howMatchingStep2Title: 'Pick service and time',
      howMatchingStep2Body: ' — Choose the haircut you want and when.',
      howMatchingStep3Title: 'Optional: preferred barber',
      howMatchingStep3Body: " — Pick a specific barber from the ones who serve your area, or leave it on 'no preference' for the best match.",
      howMatchingStep4Title: 'We route your request',
      howMatchingStep4Body: ' — Routed by service area, language, travel radius, and barber workload.',
      howMatchingStep5Title: 'Barber confirms',
      howMatchingStep5Body: " — Your matched barber accepts and you receive a confirmation with their name and arrival time.",
      homeAiPreviewKicker: 'Optional',
      homeAiPreviewTitle: 'See yourself in 3 AI haircut previews',
      homeAiPreviewIntro: "Upload a selfie and the AI will generate 3 photorealistic previews of your face with different hairstyles. Pick one and we'll attach it to your booking so the barber knows exactly what you want.",
      homeAiPreviewConsent: 'I agree the AI may use my selfie to generate haircut previews. The image is shared only with my assigned barber and is never used for marketing.',
      homeAiPreviewUploadLabel: 'Upload a selfie (face + hair visible, good light)',
      homeAiPreviewAnalyze: 'Get 3 AI hairstyle previews',
      homeAiPreviewRemove: 'Remove selfie',
      homeAiPreviewDisclosure: 'AI previews are suggestions only — final result may differ. Your selfie stays on this booking and is only shown to the assigned barber.',
      homeAiPreviewBadge: 'AI suggestion',
      homeAiPreviewBarberNotesLabel: 'Barber notes:',
      homeAiPreviewSelfieAlt: 'Your selfie preview',
      homeAiPreviewConsentRequired: 'Please tick the consent box first.',
      homeAiPreviewCompressing: 'Preparing image…',
      homeAiPreviewCompressFailed: 'Could not read that photo. Try a different one.',
      homeAiPreviewReady: 'Ready. Tap "Get 3 AI hairstyle previews".',
      homeAiPreviewAnalyzing: 'Generating 3 previews… this can take ~10 seconds.',
      homeAiPreviewDone: '3 previews ready. Pick one to attach to your booking, or scroll past.',
      homeAiPreviewProviderError: 'AI preview is temporarily unavailable. You can still book without it — the barber will discuss styles in person.',
      homeAiPreviewSelectedAck: 'Style attached. Continue booking with the chat below.',
      homeAiPreviewRemoved: 'Selfie removed.',
      homeAiPreviewAttachNote: 'Your selection will be attached to the booking automatically when you send it through the chat.',
      aiPreviewDisclosure: 'Sample AI-generated style preview. Real barber portfolio coming soon.',
      serviceAreaLabel: 'Service area',
      radiusLabel: 'Travel radius',
      travelFeeLabel: 'Base travel fee',
      languagesLabel: 'Languages',
      ratingLabel: 'Rating',
      emptyTitle: 'No mobile barber vendors are available yet.',
      emptyCopy: 'Please check the marketplace or ask Du Lich Cali for the next available in-home service option.',
      emptyCta: 'Back to Du Lich Cali',
      assistantKicker: 'AI assistant',
      assistantTitle: 'Chat with your AI barber assistant',
      assistantCopy: "Tell me what haircut you'd like and when. I'll route you to the nearest barber and confirm the appointment.",
      assistantClose: 'Close',
      assistantInputLabel: 'Type a message to the AI barber assistant',
      assistantSend: 'Send',
      assistantGreeting: "Hi! I'm the Mobile Barber assistant. What haircut would you like, and when?",
      assistantNeedLocation: 'Tell us your city or ZIP first so we can match you with the nearest barber. The chat will unlock right after.',
      assistantFallbackReply: 'Sorry, I did not catch that. Could you say it another way?',
      assistantErrorReply: "I'm having trouble reaching the assistant right now. Please try again in a moment, or call the barber directly.",
      preferredBarberLabel: 'Preferred barber (optional)',
      preferredBarberHint: 'Only barbers serving your area are listed. Leave on "No preference" for the best automatic match.',
      preferredBarberNoneOption: 'No preference — match me automatically',
      preferredBarberAckAuto: "Got it — I'll match you with the best available barber.",
      preferredBarberAckChosen: "Great — I'll route this to {name}.",
      preferredBarberNotAvailable: "{name} doesn't cover {city}. Would you like the next available barber?",
      serviceClassicName: 'Classic Mobile Haircut',
      serviceClassicDesc: 'In-home haircut with time reserved for setup and cleanup.',
      serviceComboName: 'Haircut and Beard Trim',
      serviceComboDesc: 'Mobile haircut, beard shaping, and light cleanup at your address.'
    },
    vi: {
      pageTitle: 'Thợ Cắt Tóc Tại Nhà | Du Lich Cali',
      languageLabel: 'Chọn ngôn ngữ',
      heroActionsLabel: 'Hành động đặt thợ cắt tóc tại nhà',
      trustLabel: 'Thông tin tin cậy cho dịch vụ cắt tóc tại nhà',
      heroKicker: 'Dịch vụ tận nhà tại Orange County',
      heroTitle: 'Mobile Barber — In-Home Haircuts',
      heroCopy: 'Đặt thợ cắt tóc đã xác minh đến nhà, khách sạn, văn phòng, hoặc cơ sở chăm sóc với giá rõ ràng trước khi xác nhận lịch.',
      heroStatus: 'Thợ đã xác minh',
      heroCardTitle: 'Cắt tóc tại địa chỉ của bạn',
      heroCardSub: 'Khu vực phục vụ, giá, thời lượng, và xác nhận được hiển thị trước khi đặt.',
      bookNow: 'Đặt Ngay',
      chatAssistant: 'Chat với Trợ Lý AI Barber',
      talkAssistant: 'Nói chuyện với Trợ Lý AI Barber',
      trustChipLicensed: 'Thợ có chứng chỉ',
      trustChipHouseCall: 'Phục vụ tại nhà',
      trustChipVerified: 'Vendor đã xác minh',
      trustChipTravel: 'Phạm vi di chuyển',
      trustChipFamily: 'Gói gia đình',
      trustHomeTitle: 'Dịch vụ tận nhà',
      trustHomeCopy: 'Thợ cắt tóc sẽ đến địa chỉ bạn chọn.',
      trustVerifiedTitle: 'Thợ đã xác minh',
      trustVerifiedCopy: 'Hồ sơ hiển thị khu vực phục vụ và ngôn ngữ hỗ trợ.',
      trustPricingTitle: 'Giá minh bạch',
      trustPricingCopy: 'Mỗi thẻ hiển thị giá, thời lượng, và phí di chuyển.',
      trustConfirmTitle: 'Xác nhận lịch hẹn',
      trustConfirmCopy: 'Lịch giữ trạng thái chờ cho đến khi kiểm tra chỗ trống.',
      promoKicker: 'Xem trước dịch vụ',
      promoTitle: 'Kiểu tóc AI mới nhất',
      promoCopy: 'Lướt qua fade, taper, tỉa râu, cắt tóc trẻ em, kiểu công sở, người lớn tuổi, line up, và gói gia đình.',
      promoCta: 'Đặt lịch cắt tóc tại nhà hôm nay',
      beforeAfterKicker: 'Mẫu kiểu tóc',
      beforeAfterTitle: 'Mẫu kiểu tóc thợ cắt tại nhà do AI tạo',
      beforeAfterCopy: 'Mẫu kiểu tóc thợ cắt tại nhà do AI tạo. Hình thật của thợ sẽ được cập nhật sau.',
      stylePreviewSuffix: 'Mẫu Kiểu Tóc',
      convenienceKicker: 'Tiện lợi',
      convenienceTitle: 'Sự tiện lợi của cắt tóc lưu động',
      promoClipsKicker: 'Clip quảng bá',
      promoClipsTitle: 'Thẻ quảng bá barber có chuyển động',
      promoClipsCopy: 'Trang này chưa nối pipeline tạo video, nên dùng thẻ chuyển động thay vì lặp lại hình hero.',
      servicesKicker: 'Dịch vụ',
      servicesTitle: 'Chọn dịch vụ cắt tóc tại nhà',
      vendorsKicker: 'Khu vực',
      vendorsTitle: 'Khu vực đang phục vụ',
      coverageCityListLabel: 'Thành phố phục vụ',
      coverageCta: 'Tìm Thợ Cắt Tóc',
      coverageRegionOC: 'Khu vực Orange County',
      coverageRegionBay: 'Khu vực Bay Area',
      regionGateBannerOC: 'Đã chọn khu vực Orange County. Nhập thành phố hoặc mã ZIP để được ghép với thợ gần nhất.',
      regionGateBannerBay: 'Đã chọn khu vực Bay Area. Nhập thành phố hoặc mã ZIP để được ghép với thợ gần nhất.',
      barberMatchedAnnounce: 'Đã ghi nhận. Trợ lý AI sẽ xác nhận thợ phù hợp cho {city}.',
      priceLabel: 'Giá',
      durationLabel: 'Thời lượng',
      travelBufferLabel: 'Thời gian di chuyển',
      cleanupLabel: 'Dọn dẹp',
      minutes: 'phút',
      selectService: 'Chọn Dịch Vụ',
      selectedServiceLabel: 'Dịch vụ đã chọn',
      bookThisService: 'Đặt dịch vụ này',
      chatThisService: 'Chat với AI để đặt',
      talkThisService: 'Nói với AI để đặt',
      locationGateKicker: 'Khu vực phục vụ',
      locationGateTitle: 'Thành phố hoặc mã ZIP nơi muốn thợ đến?',
      locationGateCopy: 'Nhập thành phố hoặc mã ZIP 5 số — chỉ cần một trong hai là đủ để chọn đúng thợ.',
      cityLabel: 'Thành phố',
      zipLabel: 'Mã ZIP',
      findMyBarber: 'Tìm Thợ Cắt Tóc',
      changeLocation: 'Đổi khu vực',
      emailLabel: 'Email',
      notifyMe: 'Báo cho tôi',
      noServiceArea: 'Hiện chưa phục vụ {city}. Để lại email, tụi em sẽ báo khi mở rộng khu vực.',
      waitlistSaved: 'Cảm ơn bạn. Tụi em sẽ báo khi mở rộng khu vực đó.',
      locationRequired: 'Vui lòng nhập thành phố hoặc mã ZIP 5 số.',
      saveFailedRetry: 'Tụi em chưa lưu được lịch hẹn. Vui lòng thử lại, hoặc gọi trực tiếp cho thợ.',
      howMatchingKicker: 'Cách hoạt động',
      howMatchingTitle: 'Tụi em tự động ghép bạn với thợ phù hợp',
      howMatchingIntro: 'Nhấn Đặt Ngay hoặc Chat bên dưới. Bạn chia sẻ địa chỉ với trợ lý AI — tụi em sẽ ghép với thợ gần nhất đang rảnh và gửi yêu cầu để thợ xác nhận.',
      howMatchingStep1Title: 'Nhập địa chỉ',
      howMatchingStep1Body: ' — Cho trợ lý biết địa chỉ thợ sẽ đến (địa chỉ này quyết định thợ nào phục vụ bạn).',
      howMatchingStep2Title: 'Chọn dịch vụ và thời gian',
      howMatchingStep2Body: ' — Chọn kiểu cắt và thời điểm bạn muốn.',
      howMatchingStep3Title: 'Không bắt buộc: chọn thợ',
      howMatchingStep3Body: ' — Chọn thợ cụ thể từ những thợ phục vụ khu vực của bạn, hoặc để mặc định "không yêu cầu" để tụi em ghép tốt nhất.',
      howMatchingStep4Title: 'Tụi em chuyển yêu cầu',
      howMatchingStep4Body: ' — Dựa trên khu vực phục vụ, ngôn ngữ, bán kính di chuyển, và lịch của thợ.',
      howMatchingStep5Title: 'Thợ xác nhận',
      howMatchingStep5Body: ' — Thợ được ghép sẽ chấp nhận và bạn nhận xác nhận có tên thợ và giờ đến.',
      homeAiPreviewKicker: 'Không bắt buộc',
      homeAiPreviewTitle: 'Xem chính bạn trong 3 kiểu tóc do AI tạo',
      homeAiPreviewIntro: 'Tải ảnh selfie và AI sẽ tạo 3 hình xem trước chân thực với các kiểu tóc khác nhau. Chọn một kiểu và tụi em sẽ đính kèm vào lịch hẹn để thợ biết chính xác bạn muốn gì.',
      homeAiPreviewConsent: 'Tôi đồng ý cho AI dùng ảnh selfie để tạo hình xem trước kiểu tóc. Ảnh chỉ chia sẻ với thợ phụ trách và không dùng cho mục đích quảng cáo.',
      homeAiPreviewUploadLabel: 'Tải ảnh selfie (thấy rõ mặt và tóc, đủ sáng)',
      homeAiPreviewAnalyze: 'Lấy 3 hình xem trước kiểu tóc từ AI',
      homeAiPreviewRemove: 'Xóa selfie',
      homeAiPreviewDisclosure: 'Hình AI chỉ mang tính tham khảo — kết quả thực tế có thể khác. Selfie chỉ lưu trên lịch hẹn này và chỉ thợ phụ trách xem được.',
      homeAiPreviewBadge: 'Gợi ý AI',
      homeAiPreviewBarberNotesLabel: 'Ghi chú cho thợ:',
      homeAiPreviewSelfieAlt: 'Ảnh selfie của bạn',
      homeAiPreviewConsentRequired: 'Vui lòng đồng ý điều khoản AI trước.',
      homeAiPreviewCompressing: 'Đang chuẩn bị ảnh…',
      homeAiPreviewCompressFailed: 'Không đọc được ảnh đó. Vui lòng thử ảnh khác.',
      homeAiPreviewReady: 'Sẵn sàng. Nhấn "Lấy 3 hình xem trước".',
      homeAiPreviewAnalyzing: 'Đang tạo 3 hình xem trước… mất khoảng 10 giây.',
      homeAiPreviewDone: '3 hình đã sẵn. Chọn một để đính kèm lịch hẹn, hoặc bỏ qua.',
      homeAiPreviewProviderError: 'AI preview tạm thời không khả dụng. Bạn vẫn có thể đặt lịch — thợ sẽ trao đổi kiểu tóc trực tiếp.',
      homeAiPreviewSelectedAck: 'Đã đính kèm kiểu tóc. Tiếp tục đặt lịch trong khung chat bên dưới.',
      homeAiPreviewRemoved: 'Đã xóa selfie.',
      homeAiPreviewAttachNote: 'Lựa chọn của bạn sẽ tự động đính kèm vào lịch hẹn khi gửi qua chat.',
      aiPreviewDisclosure: 'Ảnh mẫu tạo bằng AI. Portfolio thật của thợ sẽ có sau.',
      serviceAreaLabel: 'Khu vực phục vụ',
      radiusLabel: 'Bán kính di chuyển',
      travelFeeLabel: 'Phí di chuyển cơ bản',
      languagesLabel: 'Ngôn ngữ',
      ratingLabel: 'Đánh giá',
      emptyTitle: 'Hiện chưa có thợ cắt tóc tại nhà.',
      emptyCopy: 'Vui lòng xem marketplace hoặc hỏi Du Lich Cali về lựa chọn dịch vụ tận nhà sắp tới.',
      emptyCta: 'Về Du Lich Cali',
      assistantKicker: 'Trợ lý AI',
      assistantTitle: 'Trò chuyện với trợ lý AI thợ cắt tóc',
      assistantCopy: 'Hãy cho biết bạn muốn kiểu tóc nào và khi nào. Tôi sẽ kết nối bạn với thợ gần nhất và xác nhận lịch hẹn.',
      assistantClose: 'Đóng',
      assistantInputLabel: 'Nhập tin nhắn cho trợ lý AI',
      assistantSend: 'Gửi',
      assistantGreeting: 'Xin chào! Tôi là trợ lý Mobile Barber. Bạn muốn kiểu tóc nào và khi nào ạ?',
      assistantNeedLocation: 'Hãy cho biết thành phố hoặc mã ZIP để được ghép với thợ gần nhất. Sau đó khung chat sẽ mở.',
      assistantFallbackReply: 'Xin lỗi, tôi chưa hiểu rõ. Bạn có thể nói lại theo cách khác không?',
      assistantErrorReply: 'Hệ thống tạm thời gặp sự cố. Vui lòng thử lại trong giây lát, hoặc gọi trực tiếp cho thợ.',
      preferredBarberLabel: 'Thợ ưu tiên (không bắt buộc)',
      preferredBarberHint: 'Chỉ liệt kê thợ phục vụ khu vực của bạn. Để "Không yêu cầu" để được ghép tự động tốt nhất.',
      preferredBarberNoneOption: 'Không yêu cầu — ghép tự động giúp em',
      preferredBarberAckAuto: 'Đã rõ — tụi em sẽ ghép với thợ phù hợp nhất.',
      preferredBarberAckChosen: 'Tuyệt — tụi em sẽ chuyển yêu cầu cho {name}.',
      preferredBarberNotAvailable: '{name} không phục vụ {city}. Bạn có muốn dùng thợ kế tiếp đang rảnh không?',
      serviceClassicName: 'Cắt Tóc Tận Nhà Cơ Bản',
      serviceClassicDesc: 'Cắt tóc tại nhà với thời gian chuẩn bị và dọn dẹp.',
      serviceComboName: 'Cắt Tóc và Tỉa Râu',
      serviceComboDesc: 'Cắt tóc lưu động, tạo dáng râu, và dọn dẹp nhẹ tại địa chỉ của bạn.'
    },
    es: {
      pageTitle: 'Barbero Móvil | Du Lich Cali',
      languageLabel: 'Elegir idioma',
      heroActionsLabel: 'Acciones de barbero móvil',
      trustLabel: 'Detalles de confianza para barbero móvil',
      heroKicker: 'Servicio a domicilio en Orange County',
      heroTitle: 'Mobile Barber — In-Home Haircuts',
      heroCopy: 'Reserve un barbero verificado para su casa, hotel, oficina, o centro de cuidado con precios claros antes de confirmar la cita.',
      heroStatus: 'Barbero verificado',
      heroCardTitle: 'Cortes en su dirección',
      heroCardSub: 'Área de servicio, precio, duración, y confirmación antes de reservar.',
      bookNow: 'Reservar Ahora',
      chatAssistant: 'Chatear con el Asistente AI Barber',
      talkAssistant: 'Hablar con el Asistente AI Barber',
      trustChipLicensed: 'Barbero con licencia',
      trustChipHouseCall: 'Visita a domicilio',
      trustChipVerified: 'Vendedor verificado',
      trustChipTravel: 'Cobertura de viaje',
      trustChipFamily: 'Paquete familiar',
      trustHomeTitle: 'Servicio a domicilio',
      trustHomeCopy: 'El barbero viaja a la dirección seleccionada.',
      trustVerifiedTitle: 'Barbero verificado',
      trustVerifiedCopy: 'Los perfiles muestran área de servicio e idiomas.',
      trustPricingTitle: 'Precios transparentes',
      trustPricingCopy: 'Cada tarjeta muestra precio, duración, y tarifa de viaje.',
      trustConfirmTitle: 'Confirmación de cita',
      trustConfirmCopy: 'Las reservas quedan pendientes hasta revisar disponibilidad.',
      promoKicker: 'Vista de servicio',
      promoTitle: 'Últimos estilos de corte AI',
      promoCopy: 'Desliza por fade, taper, barba, niños, corte ejecutivo, senior, line up, y paquete familiar.',
      promoCta: 'Reservar corte en casa hoy',
      beforeAfterKicker: 'Estilos de muestra',
      beforeAfterTitle: 'Estilos de barbero móvil generados por AI',
      beforeAfterCopy: 'Vistas previas curadas de estilos de barbero móvil. Las fotos reales del portafolio del barbero estarán disponibles pronto.',
      stylePreviewSuffix: 'Vista de Estilo',
      convenienceKicker: 'Conveniencia',
      convenienceTitle: 'Conveniencia del corte móvil',
      promoClipsKicker: 'Clips promocionales',
      promoClipsTitle: 'Promos animadas de barbero móvil',
      promoClipsCopy: 'La generación de video aún no está conectada aquí, así que usamos tarjetas animadas en vez de repetir el hero.',
      servicesKicker: 'Servicios',
      servicesTitle: 'Elija un servicio de barbero móvil',
      vendorsKicker: 'Cobertura',
      vendorsTitle: 'Áreas donde servimos',
      coverageCityListLabel: 'Ciudades atendidas',
      coverageCta: 'Buscar Mi Barbero',
      coverageRegionOC: 'Cobertura en Orange County',
      coverageRegionBay: 'Cobertura en Bay Area',
      regionGateBannerOC: 'Cobertura en Orange County seleccionada. Ingrese su ciudad o código postal para conectarle con el barbero más cercano.',
      regionGateBannerBay: 'Cobertura en Bay Area seleccionada. Ingrese su ciudad o código postal para conectarle con el barbero más cercano.',
      barberMatchedAnnounce: 'Listo. El asistente AI confirmará el barbero adecuado para {city}.',
      priceLabel: 'Precio',
      durationLabel: 'Duración',
      travelBufferLabel: 'Tiempo de viaje',
      cleanupLabel: 'Limpieza',
      minutes: 'min',
      selectService: 'Seleccionar Servicio',
      selectedServiceLabel: 'Servicio seleccionado',
      bookThisService: 'Reservar este servicio',
      chatThisService: 'Chatear con AI para reservar',
      talkThisService: 'Hablar con AI para reservar',
      locationGateKicker: 'Área de servicio',
      locationGateTitle: '¿A qué ciudad o código postal debe ir el barbero?',
      locationGateCopy: 'Ingrese su ciudad o código postal de 5 dígitos — basta con uno para conectarle con el barbero correcto.',
      cityLabel: 'Ciudad',
      zipLabel: 'Código ZIP',
      findMyBarber: 'Buscar Mi Barbero',
      changeLocation: 'Cambiar ubicación',
      emailLabel: 'Email',
      notifyMe: 'Avisarme',
      noServiceArea: 'Todavía no servimos {city}. Deje su email y le avisaremos cuando lleguemos.',
      waitlistSaved: 'Gracias. Le avisaremos cuando ampliemos a esa zona.',
      locationRequired: 'Ingrese una ciudad o un código postal de 5 dígitos.',
      saveFailedRetry: 'No pudimos guardar la cita ahora. Inténtelo de nuevo o llame directamente al barbero.',
      howMatchingKicker: 'Cómo funciona',
      howMatchingTitle: 'Le emparejamos con el barbero correcto automáticamente',
      howMatchingIntro: 'Toque Reservar o Chat. Comparta su dirección con el asistente AI — le emparejamos con el barbero más cercano disponible y enviamos su solicitud para confirmación.',
      howMatchingStep1Title: 'Ingrese su dirección',
      howMatchingStep1Body: ' — Dígale al asistente a dónde debe ir el barbero (la dirección determina quién le sirve).',
      howMatchingStep2Title: 'Elija servicio y hora',
      howMatchingStep2Body: ' — Escoja el corte y el momento que desea.',
      howMatchingStep3Title: 'Opcional: barbero preferido',
      howMatchingStep3Body: ' — Elija un barbero específico de los que sirven su área, o deje "sin preferencia" para el mejor emparejamiento.',
      howMatchingStep4Title: 'Enrutamos su solicitud',
      howMatchingStep4Body: ' — Según área de servicio, idiomas, radio de viaje y carga de trabajo del barbero.',
      howMatchingStep5Title: 'El barbero confirma',
      howMatchingStep5Body: ' — El barbero asignado acepta y recibirá una confirmación con su nombre y hora de llegada.',
      homeAiPreviewKicker: 'Opcional',
      homeAiPreviewTitle: 'Vea su rostro en 3 cortes generados por AI',
      homeAiPreviewIntro: 'Suba una selfie y la AI generará 3 vistas previas fotorrealistas de su rostro con distintos cortes. Elija uno y lo adjuntaremos a su cita para que el barbero sepa exactamente qué quiere.',
      homeAiPreviewConsent: 'Acepto que la AI use mi selfie para generar vistas previas. La imagen se comparte solo con el barbero asignado y nunca se usa para marketing.',
      homeAiPreviewUploadLabel: 'Suba una selfie (cara y cabello visibles, buena luz)',
      homeAiPreviewAnalyze: 'Obtener 3 vistas previas con AI',
      homeAiPreviewRemove: 'Eliminar selfie',
      homeAiPreviewDisclosure: 'Las vistas previas AI son sólo sugerencias — el resultado real puede variar. Su selfie queda en esta cita y sólo la ve el barbero asignado.',
      homeAiPreviewBadge: 'Sugerencia AI',
      homeAiPreviewBarberNotesLabel: 'Notas para el barbero:',
      homeAiPreviewSelfieAlt: 'Vista previa de su selfie',
      homeAiPreviewConsentRequired: 'Por favor acepte el consentimiento de AI primero.',
      homeAiPreviewCompressing: 'Preparando imagen…',
      homeAiPreviewCompressFailed: 'No pudimos leer esa foto. Pruebe otra.',
      homeAiPreviewReady: 'Listo. Toque "Obtener 3 vistas previas con AI".',
      homeAiPreviewAnalyzing: 'Generando 3 vistas previas… toma ~10 segundos.',
      homeAiPreviewDone: '3 vistas listas. Elija una para adjuntar a su cita, o salte.',
      homeAiPreviewProviderError: 'La vista previa AI no está disponible. Puede reservar igualmente — el barbero conversará los estilos en persona.',
      homeAiPreviewSelectedAck: 'Estilo adjuntado. Continúe la reserva en el chat de abajo.',
      homeAiPreviewRemoved: 'Selfie eliminada.',
      homeAiPreviewAttachNote: 'Su selección se adjuntará automáticamente a la cita al enviarla por el chat.',
      aiPreviewDisclosure: 'Vista previa de estilo generada por AI. Portafolio real del barbero próximamente.',
      serviceAreaLabel: 'Área de servicio',
      radiusLabel: 'Radio de viaje',
      travelFeeLabel: 'Tarifa base de viaje',
      languagesLabel: 'Idiomas',
      ratingLabel: 'Calificación',
      emptyTitle: 'Todavía no hay barberos móviles disponibles.',
      emptyCopy: 'Revise el marketplace o pregunte a Du Lich Cali por la próxima opción de servicio a domicilio.',
      emptyCta: 'Volver a Du Lich Cali',
      assistantKicker: 'Asistente AI',
      assistantTitle: 'Chatea con tu asistente AI de barbero',
      assistantCopy: 'Dime qué corte quieres y cuándo. Te conecto con el barbero más cercano y confirmamos la cita.',
      assistantClose: 'Cerrar',
      assistantInputLabel: 'Escribe un mensaje al asistente AI',
      assistantSend: 'Enviar',
      assistantGreeting: 'Hola! Soy el asistente Mobile Barber. ¿Qué corte deseas y cuándo?',
      assistantNeedLocation: 'Indica tu ciudad o código postal primero para conectarte con el barbero más cercano. El chat se desbloquea enseguida.',
      assistantFallbackReply: 'Disculpa, no entendí. ¿Puedes decirlo de otra forma?',
      assistantErrorReply: 'Tengo problemas para conectar con el asistente. Intenta de nuevo en un momento o llama al barbero directamente.',
      preferredBarberLabel: 'Barbero preferido (opcional)',
      preferredBarberHint: 'Solo se listan los barberos que sirven su área. Deje "Sin preferencia" para el mejor emparejamiento automático.',
      preferredBarberNoneOption: 'Sin preferencia — empareja automáticamente',
      preferredBarberAckAuto: 'Entendido — le emparejaré con el mejor barbero disponible.',
      preferredBarberAckChosen: 'Genial — enviaré esto a {name}.',
      preferredBarberNotAvailable: '{name} no cubre {city}. ¿Quiere el siguiente barbero disponible?',
      serviceClassicName: 'Corte Móvil Clásico',
      serviceClassicDesc: 'Corte a domicilio con tiempo reservado para preparación y limpieza.',
      serviceComboName: 'Corte y Arreglo de Barba',
      serviceComboDesc: 'Corte móvil, perfilado de barba, y limpieza ligera en su dirección.'
    }
  };

  var SERVICE_COPY = {
    'classic-mobile-cut': { name: 'serviceClassicName', desc: 'serviceClassicDesc' },
    'mobile-haircut-beard': { name: 'serviceComboName', desc: 'serviceComboDesc' }
  };

  var LOCATION_STORAGE_KEY = 'mb_customer_location';
  var LOCATION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
  var state = {
    lang: 'en',
    selectedServiceId: '',
    pendingServiceId: '',
    agentSession: null,
    lastBooking: null,
    existingBookings: [],
    locationSubmitted: false,
    waitlistLocation: null,
    routedVendor: null,
    region: '',
    aiPreview: {
      consent: false,
      selfieDataUrl: '',
      summary: '',
      recommendations: [],
      selectedStyleId: '',
      selectedStylePreviewUrl: '',
      analyzing: false,
      sessionId: '',
      lastError: ''
    }
  };

  function getLang() {
    var param = new URLSearchParams(root.location.search).get('lang');
    if (param && STRINGS[param]) return param;
    try {
      var saved = localStorage.getItem('dlcLang') || localStorage.getItem('dlc_lang');
      if (saved && STRINGS[saved]) return saved;
    } catch (e) {}
    return 'en';
  }

  function t(key) {
    return (STRINGS[state.lang] && STRINGS[state.lang][key]) || STRINGS.en[key] || '';
  }

  function setText(selectorRoot) {
    selectorRoot.querySelectorAll('[data-i18n]').forEach(function(el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
  }

  function formatMoney(value) {
    return '$' + Number(value || 0).toFixed(0);
  }

  function interpolate(template, values) {
    return String(template || '').replace(/\{(\w+)\}/g, function(_, key) {
      return values[key] == null ? '' : values[key];
    });
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

  function serviceCopy(service, field) {
    var keys = SERVICE_COPY[service.id];
    if (!keys) return field === 'name' ? service.name : service.description;
    return field === 'name' ? t(keys.name) : t(keys.desc);
  }

  function selectedService() {
    var services = DATA && DATA.sampleServices ? DATA.sampleServices : [];
    return services.filter(function(service) { return service.id === state.selectedServiceId; })[0] || null;
  }

  function readSavedLocation() {
    try {
      var raw = root.localStorage && root.localStorage.getItem(LOCATION_STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.city || !parsed.savedAt) return null;
      if ((Date.now() - Number(parsed.savedAt)) > LOCATION_MAX_AGE_MS) {
        root.localStorage.removeItem(LOCATION_STORAGE_KEY);
        return null;
      }
      return { city: String(parsed.city || ''), zip: String(parsed.zip || ''), savedAt: Number(parsed.savedAt) };
    } catch (e) {
      return null;
    }
  }

  function saveCustomerLocation(location) {
    try {
      root.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify({
        city: String(location.city || '').trim(),
        zip: String(location.zip || '').trim(),
        savedAt: Date.now()
      }));
    } catch (e) {}
  }

  function clearCustomerLocation() {
    try { root.localStorage.removeItem(LOCATION_STORAGE_KEY); } catch (e) {}
  }

  function currentLocationInput() {
    var zip = String((document.getElementById('mbLocationZip') || {}).value || '').trim();
    var typedCity = String((document.getElementById('mbLocationCity') || {}).value || '').trim();
    // Either field is sufficient. If only ZIP is typed, derive city from
    // the embedded lookup so findVendorForAddress can match on city too.
    return { zip: zip, city: typedCity || cityForZip(zip) };
  }

  // Minimal zip → city fallback so we can keep findVendorForAddress() honest
  // when the gate only collects a ZIP. Covers every ZIP listed in
  // mobile-barber-data.js vendor.zipCoverage. Vendors can extend by adding
  // more zips to their data without code change here.
  var ZIP_TO_CITY = {
    // OC (Michael coverage)
    '92647': 'Huntington Beach', '92683': 'Westminster', '92627': 'Costa Mesa',
    '92704': 'Santa Ana', '92840': 'Garden Grove', '92843': 'Garden Grove',
    '92703': 'Santa Ana', '92868': 'Orange', '92614': 'Irvine',
    '92866': 'Orange', '92867': 'Orange', '92708': 'Fountain Valley',
    // Bay Area (Tim coverage)
    '95112': 'San Jose', '95121': 'San Jose', '95122': 'San Jose',
    '95050': 'Santa Clara', '95051': 'Santa Clara', '95035': 'Milpitas',
    '94085': 'Sunnyvale', '94040': 'Mountain View', '95014': 'Cupertino',
    '95030': 'Los Gatos', '95008': 'Campbell', '94536': 'Fremont'
  };
  function cityForZip(zip) {
    var z = String(zip || '').trim();
    if (!/^\d{5}$/.test(z)) return '';
    return ZIP_TO_CITY[z] || '';
  }

  function setLocationStatus(message) {
    var status = document.getElementById('mbLocationGateStatus');
    if (status) status.textContent = message || '';
  }

  function prefillLocationGate() {
    var saved = readSavedLocation();
    var city = document.getElementById('mbLocationCity');
    var zip = document.getElementById('mbLocationZip');
    var change = document.querySelector('[data-action="changeLocation"]');
    if (saved) {
      if (city && !city.value) city.value = saved.city;
      if (zip && !zip.value) zip.value = saved.zip;
      if (change) change.hidden = false;
    } else if (change) {
      change.hidden = true;
    }
  }

  function vendorUrlForRoute(vendor, serviceId, mode, location) {
    var params = new URLSearchParams();
    serviceId = serviceIdForVendor(vendor, serviceId);
    if (serviceId) params.set('serviceId', serviceId);
    if (mode) params.set('assistant', mode);
    if (location && location.city) params.set('city', location.city);
    if (location && location.zip) params.set('zip', location.zip);
    params.set('from', 'landing');
    if (state.lang) params.set('lang', state.lang);
    return '/mobile-barber/vendor/' + encodeURIComponent(vendor.id) + '?' + params.toString();
  }

  function serviceSlug(serviceId) {
    var vendors = DATA && DATA.sampleVendors ? DATA.sampleVendors : [];
    for (var i = 0; i < vendors.length; i++) {
      var prefix = vendors[i].id + '-';
      if (String(serviceId || '').indexOf(prefix) === 0) return String(serviceId).slice(prefix.length);
    }
    return String(serviceId || '');
  }

  function serviceIdForVendor(vendor, serviceId) {
    if (!vendor || !serviceId) return serviceId || '';
    if (String(serviceId).indexOf(vendor.id + '-') === 0) return serviceId;
    var selected = (DATA.sampleServices || []).filter(function(service) { return service.id === serviceId; })[0] || null;
    var slug = serviceSlug(serviceId);
    var services = DATA.listServicesForVendor ? DATA.listServicesForVendor(vendor.id) : [];
    var matched = services.filter(function(service) {
      return service.id === vendor.id + '-' + slug ||
        (selected && String(service.name || '').toLowerCase() === String(selected.name || '').toLowerCase());
    })[0];
    return (matched && matched.id) || serviceId;
  }

  function routeByLocation(location, serviceId, mode) {
    if (!location) {
      setLocationStatus(t('locationRequired'));
      return false;
    }
    var hasCity = !!(location.city && location.city.trim());
    var hasZip = !!(location.zip && /^\d{5}$/.test(location.zip));
    if (!hasCity && !hasZip) {
      setLocationStatus(t('locationRequired'));
      return false;
    }
    var vendor = BOOKING && BOOKING.findVendorForAddress ? BOOKING.findVendorForAddress(location, {
      vendors: DATA.sampleVendors
    }) : null;
    if (!vendor) {
      state.waitlistLocation = location;
      var copy = document.getElementById('mbWaitlistCopy');
      var waitlist = document.getElementById('mbWaitlistForm');
      if (copy) copy.textContent = interpolate(t('noServiceArea'), { city: location.city });
      if (waitlist) waitlist.hidden = false;
      setLocationStatus('');
      return false;
    }
    saveCustomerLocation(location);
    // Marketplace routing: never redirect to a per-vendor customer page.
    // The vendor is resolved by findVendorForAddress() and pinned in state;
    // the AI assistant takes over on the same page. Customers only learn
    // which barber they got at booking-confirmation time.
    state.routedVendor = vendor;
    if (state.agentSession && AGENT && typeof AGENT.mergeState === 'function') {
      try {
        state.agentSession.state = AGENT.mergeState(
          state.agentSession.state || AGENT.emptyState(state.lang),
          {
            city: location.city,
            zip: location.zip,
            lang: state.lang
          },
          new Date()
        );
      } catch (e) {}
    }
    var change = document.querySelector('[data-action="changeLocation"]');
    if (change) change.hidden = false;
    var announce = interpolate(t('barberMatchedAnnounce'), { city: location.city || location.zip });
    setLocationStatus(announce);
    if (mode === 'voice') {
      openVoiceAssistant();
    } else {
      openAssistantPanel('general');
    }
    return true;
  }

  // Legacy shim — the location gate is gone. Callers used to scroll the
  // gate into view + focus the city input. Now we just open the chat;
  // the agent will ask for the address via its slot-fill flow.
  function promptForLocation(serviceId) {
    state.pendingServiceId = serviceId || '';
    openAssistantPanel('general');
  }

  function submitWaitlist() {
    var email = String((document.getElementById('mbWaitlistEmail') || {}).value || '').trim();
    var location = state.waitlistLocation || currentLocationInput();
    if (!email || !location.city) return Promise.resolve(false);
    var db = root.firebase && root.firebase.firestore && root.firebase.apps && root.firebase.apps.length
      ? root.firebase.firestore()
      : null;
    if (!db) {
      setLocationStatus(t('waitlistSaved'));
      return Promise.resolve(false);
    }
    return db.collection('mobileBarberWaitlist').add({
      email: email,
      city: location.city,
      zip: location.zip || '',
      createdAt: root.firebase.firestore.FieldValue.serverTimestamp(),
      source: 'landing_no_match'
    }).then(function() {
      setLocationStatus(t('waitlistSaved'));
      document.getElementById('mbWaitlistForm').hidden = true;
      return true;
    }).catch(function() {
      setLocationStatus(t('waitlistSaved'));
      return false;
    });
  }

  function preferredVendor() {
    var vendors = DATA && DATA.sampleVendors ? DATA.sampleVendors.filter(function(vendor) { return vendor.active !== false; }) : [];
    // 1) An explicit Find-My-Barber gate match wins. This is the marketplace
    //    auto-routing result and reflects the customer's actual address.
    if (state.routedVendor && state.routedVendor.active !== false) {
      var stillValid = vendors.filter(function(vendor) { return vendor.id === state.routedVendor.id; })[0];
      if (stillValid) return stillValid;
    }
    // 2) Customer barber preference expressed to the AI agent (override).
    var sessionState = state.agentSession && state.agentSession.state;
    var preference = String(sessionState && sessionState.barberPreference || '').toLowerCase();
    if (preference) {
      var matched = vendors.filter(function(vendor) {
        return String(vendor.businessName + ' ' + vendor.barberName + ' ' + vendor.id).toLowerCase().indexOf(preference.split(/\s+/)[0]) >= 0;
      })[0];
      if (matched) return matched;
    }
    // 3) Address-based fallback before the customer has touched the gate, so
    //    a returning visitor with a saved location still talks to the right
    //    vendor on first message.
    var saved = readSavedLocation();
    if (saved && BOOKING && typeof BOOKING.findVendorForAddress === 'function') {
      var routed = BOOKING.findVendorForAddress(saved, { vendors: vendors });
      if (routed) return routed;
    }
    var service = selectedService();
    if (service && DATA.findVendorById) return DATA.findVendorById(service.vendorId);
    if (DATA.findVendorById && DATA.MICHAEL_VENDOR_ID) return DATA.findVendorById(DATA.MICHAEL_VENDOR_ID);
    return vendors[0] || null;
  }

  function servicesForVendor(vendorId) {
    if (DATA && typeof DATA.listServicesForVendor === 'function') return DATA.listServicesForVendor(vendorId);
    return (DATA && DATA.sampleServices ? DATA.sampleServices : []).filter(function(service) {
      return service.vendorId === vendorId && service.active !== false;
    });
  }

  function _buildAIBrainProvider() {
    if (!root.AIEngine || typeof root.AIEngine.call !== 'function') return null;
    return function(req) {
      return root.AIEngine.call('nails', '', req.systemPrompt, req.history || [], { intent: 'booking' })
        .then(function(resp) {
          var text = (resp && resp.content && resp.content[0] && resp.content[0].text) || '';
          return { text: text };
        });
    };
  }

  function agentContext(vendor) {
    vendor = vendor || preferredVendor();
    return {
      lang: state.lang,
      vendor: vendor,
      vendorId: vendor && vendor.id,
      services: servicesForVendor(vendor && vendor.id),
      availability: DATA && DATA.sampleAvailability,
      existingBookings: state.existingBookings,
      now: new Date(),
      phoneIntake: root.PhoneIntake || null,
      customerLookupProvider: function(phone) {
        if (!BOOKING || typeof BOOKING.lookupReturningCustomer !== 'function' || !vendor) return Promise.resolve(null);
        return BOOKING.lookupReturningCustomer(vendor.id, phone);
      },
      aiBrainProvider: _buildAIBrainProvider()
    };
  }

  function ensureAgentSession() {
    if (AGENT && !state.agentSession) {
      var vendor = preferredVendor();
      var historyKey = 'mb_h_' + ((vendor && vendor.id) || 'general');
      var restored = (root.AIEngine && typeof root.AIEngine.restoreHistory === 'function')
        ? root.AIEngine.restoreHistory(historyKey)
        : null;
      state.agentSession = {
        state: AGENT.emptyState(state.lang),
        history: restored || [],
        _historyKey: historyKey
      };
    }
    var service = selectedService();
    if (AGENT && service) {
      state.agentSession.state = AGENT.mergeState(
        state.agentSession.state || AGENT.emptyState(state.lang),
        { serviceId: service.id, intent: 'booking_request' },
        new Date()
      );
    }
    return state.agentSession;
  }

  function sendAgentMessage(message, options) {
    options = options || {};
    if (!AGENT || !BOOKING) return Promise.resolve({ response: t('assistantCopy') });
    var vendor = preferredVendor();
    if (!vendor) return Promise.resolve({ response: t('assistantCopy') });
    ensureAgentSession();
    var finish = function(existing) {
      state.existingBookings = existing || [];
      var ctx = agentContext(vendor);
      var runner = typeof AGENT.handleMessageAsync === 'function'
        ? AGENT.handleMessageAsync(state.agentSession, message, ctx)
        : Promise.resolve(AGENT.handleMessage(state.agentSession, message, ctx));
      return runner.then(function(result) {
        state.agentSession = result.session;
        if (state.agentSession && state.agentSession.history && state.agentSession._historyKey
            && root.AIEngine && typeof root.AIEngine.saveHistory === 'function') {
          root.AIEngine.saveHistory(state.agentSession._historyKey, state.agentSession.history.slice(-20));
        }
        if (result.booking) {
          if (options.source) result.booking.source = options.source;
          // Attach any optional AI haircut preview the customer selected
          // before submitting. The vendor dashboard reads selectedStyleId,
          // selectedStylePreviewUrl, and selfieDataUrl off the booking.
          attachAiPreviewToBooking(result.booking);
          // Require a real Firestore write. The previous default silently
          // fell back to localStorage when Firestore rejected, so the
          // customer saw "saved" but the vendor portal never received the
          // booking. Surface the failure to the customer + log it so the
          // root cause is visible instead of buried.
          return BOOKING.saveBooking(result.booking, { requireDatabase: true })
            .then(function(saved) {
              state.lastBooking = saved.booking;
              result.booking = saved.booking;
              if (root.console) root.console.info('[mobile-barber-agent] booking saved', { id: saved.booking.id, vendorId: saved.booking.vendorId, source: saved.source });
              return result;
            })
            .catch(function(error) {
              if (root.console) root.console.error('[mobile-barber-agent] booking save FAILED', error);
              result.booking = null;
              result.response = (result.response || '') + '\n\n⚠️ ' + t('saveFailedRetry');
              return result;
            });
        }
        return result;
      });
    };
    return BOOKING.loadExistingBookings(vendor.id).then(finish).catch(function() {
      return finish([]);
    });
  }

  function openAssistantPanel(mode) {
    ensureAgentSession();
    var panel = document.getElementById('mbAssistantPanel');
    if (!panel) return null;
    panel.hidden = false;
    var copy = panel.querySelector('[data-i18n="assistantCopy"]');
    if (copy && AGENT && typeof AGENT.initialPrompt === 'function') {
      copy.textContent = AGENT.initialPrompt(mode === 'vendor' ? { vendor: preferredVendor() } : {}, state.lang);
    }
    // No more upfront location gate — the chat agent collects address via
    // slot fill (ASK_ADDRESS) and routes to the right vendor via
    // BOOKING.findVendorForAddress at booking-build time. Chat opens
    // immediately with an active input.
    var needHint = panel.querySelector('#mbAssistantNeedLocation');
    var input    = panel.querySelector('#mbAssistantInput');
    var sendBtn  = panel.querySelector('.mb-chat-panel__send');
    if (needHint) needHint.hidden = true;
    if (input)    input.disabled  = false;
    if (sendBtn)  sendBtn.disabled = false;

    seedAssistantTranscriptIfEmpty();
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(function() {
      if (input && typeof input.focus === 'function') input.focus();
    }, 280);
    return panel;
  }

  // ── Chat transcript renderer (customer landing) ───────────────────────
  function appendChatMessage(role, text) {
    var transcript = document.getElementById('mbAssistantTranscript');
    if (!transcript || !text) return;
    var row = document.createElement('div');
    row.className = 'mb-chat-msg mb-chat-msg--' + (role === 'user' ? 'user' : 'ai');
    var bubble = document.createElement('div');
    bubble.className = 'mb-chat-msg__bubble';
    bubble.textContent = String(text);
    row.appendChild(bubble);
    transcript.appendChild(row);
    transcript.scrollTop = transcript.scrollHeight;
  }

  function seedAssistantTranscriptIfEmpty() {
    var transcript = document.getElementById('mbAssistantTranscript');
    if (!transcript || transcript.childElementCount > 0) return;
    var greeting = '';
    if (AGENT && typeof AGENT.initialPrompt === 'function') {
      greeting = AGENT.initialPrompt({ vendor: preferredVendor() }, state.lang) || '';
    }
    if (!greeting) greeting = t('assistantGreeting');
    appendChatMessage('ai', greeting);
  }

  function handleAssistantSubmit(event) {
    event.preventDefault();
    var input = document.getElementById('mbAssistantInput');
    if (!input) return;
    var message = String(input.value || '').trim();
    if (!message) return;
    input.value = '';
    appendChatMessage('user', message);

    var sendBtn = document.querySelector('.mb-chat-panel__send');
    if (sendBtn) sendBtn.disabled = true;
    if (input) input.disabled = true;

    var pending = sendAgentMessage(message, { source: 'ai_chat' });
    Promise.resolve(pending)
      .then(function(result) {
        var reply = (result && result.response) || t('assistantFallbackReply');
        appendChatMessage('ai', reply);
        // After every turn, re-evaluate whether the preferred-barber
        // dropdown should be visible (it appears once the agent has the
        // customer's address and we can scope the list to vendors who
        // actually serve that area).
        refreshPreferredBarberPicker();
      })
      .catch(function(err) {
        if (root.console) root.console.error('[mobile-barber] chat error', err);
        appendChatMessage('ai', t('assistantErrorReply'));
      })
      .then(function() {
        if (input) { input.disabled = false; input.focus(); }
        if (sendBtn) sendBtn.disabled = false;
      });
  }

  // ── Optional preferred-barber dropdown ────────────────────────────────
  // Hidden by default. Appears once the AI agent has captured the customer's
  // address (so we can scope the list to vendors who actually serve that
  // area). Default "No preference / Match me automatically".
  function refreshPreferredBarberPicker() {
    var wrap   = document.getElementById('mbPreferredBarberWrap');
    var select = document.getElementById('mbPreferredBarberSelect');
    if (!wrap || !select) return;
    var agentState = state.agentSession && state.agentSession.state;
    var hasAddress = !!(agentState && (agentState.city || agentState.zip || agentState.address));
    if (!hasAddress) { wrap.hidden = true; return; }

    var location = {
      city: (agentState && agentState.city) || '',
      zip:  (agentState && agentState.zip)  || ''
    };
    var allActive = (DATA && DATA.sampleVendors ? DATA.sampleVendors : [])
      .filter(function(v) { return v && v.active !== false; });
    var vendorsForArea = allActive.filter(function(v) {
      if (!BOOKING || typeof BOOKING.isWithinServiceArea !== 'function') return true;
      try { return BOOKING.isWithinServiceArea(v, location); }
      catch (e) { return false; }
    });
    // If no vendor matches the area, fall back to "no vendors here" — the
    // dropdown stays hidden because the agent will refuse out-of-area
    // bookings via service_area_out_of_range anyway.
    if (!vendorsForArea.length) { wrap.hidden = true; return; }

    var current = select.value;
    select.innerHTML = '';
    var noOpt = document.createElement('option');
    noOpt.value = '';
    noOpt.textContent = t('preferredBarberNoneOption') || 'No preference — match me automatically';
    select.appendChild(noOpt);
    vendorsForArea.forEach(function(v) {
      var opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = (v.barberName || v.businessName || v.id) +
        ((v.languages && v.languages.length) ? ' (' + v.languages.join('/').toUpperCase() + ')' : '');
      select.appendChild(opt);
    });
    // Restore prior selection if still valid; otherwise default to none.
    select.value = vendorsForArea.some(function(v) { return v.id === current; }) ? current : '';
    wrap.hidden = false;
  }

  function handlePreferredBarberChange() {
    var select = document.getElementById('mbPreferredBarberSelect');
    if (!select) return;
    var chosenId = select.value;
    var agentState = state.agentSession && state.agentSession.state;
    if (!agentState) return;

    if (!chosenId) {
      // "No preference" — clear any prior override; routing falls back to
      // automatic by address + service area + availability.
      agentState.barberPreference = '';
      state.routedVendor = null;
      appendChatMessage('ai', t('preferredBarberAckAuto') || "Got it — I'll match you with the best available barber.");
      return;
    }
    var vendor = (DATA && typeof DATA.findVendorById === 'function')
      ? DATA.findVendorById(chosenId)
      : null;
    if (!vendor) return;
    // Validate the chosen barber actually serves the customer's area.
    var location = {
      city: (agentState && agentState.city) || '',
      zip:  (agentState && agentState.zip)  || ''
    };
    var serves = (BOOKING && typeof BOOKING.isWithinServiceArea === 'function')
      ? BOOKING.isWithinServiceArea(vendor, location)
      : true;
    if (!serves) {
      // Show the explicit "not available" message and clear the override.
      appendChatMessage('ai', interpolate(t('preferredBarberNotAvailable') ||
        "{name} doesn't cover {city}. Would you like the next available barber?", {
          name: vendor.barberName || vendor.businessName || chosenId,
          city: location.city || location.zip || 'your area'
        }));
      select.value = '';
      agentState.barberPreference = '';
      return;
    }
    // Honor the override — mirror into both the agent's slot (which
    // preferredVendor() already reads) and state.routedVendor so the chat
    // flow + booking-build path use the chosen vendor.
    var preferenceKey = String(vendor.barberName || vendor.businessName || vendor.id).split(/\s+/)[0].toLowerCase();
    agentState.barberPreference = preferenceKey;
    state.routedVendor = vendor;
    appendChatMessage('ai', interpolate(t('preferredBarberAckChosen') ||
      "Great — I'll route this to {name}.", { name: vendor.barberName || vendor.businessName }));
  }

  function openVoiceAssistant() {
    openAssistantPanel('general');
    if (!root.MobileBarberVoice) return;
    var controller = {
      getLang: function() { return state.lang; },
      setLang: setLang,
      getSession: function() { return state.agentSession; },
      sendMessage: sendAgentMessage,
      initialPrompt: function() {
        return AGENT && typeof AGENT.initialPrompt === 'function'
          ? AGENT.initialPrompt({}, state.lang)
          : '';
      },
      openTextFallback: function() { openAssistantPanel('general'); },
      vendorId: function() {
        var vendor = preferredVendor();
        return vendor && vendor.id;
      }
    };
    root.MobileBarberVoice.open(controller);
  }

  function landingServices(services) {
    var source = services || [];
    var activeVendorIds = {};
    (DATA && DATA.sampleVendors ? DATA.sampleVendors : []).forEach(function(vendor) {
      if (vendor.active !== false) activeVendorIds[vendor.id] = true;
    });
    var seen = {};
    return source.filter(function(service) {
      var key = String(service.name || service.id).toLowerCase();
      if (service.active === false || !activeVendorIds[service.vendorId] || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function serviceImage(service) {
    if (DATA && DATA.findServiceImageByServiceId) {
      return DATA.findServiceImageByServiceId(service.id) || service;
    }
    return service;
  }

  function promoContentItems(services) {
    // Prefer the canonical style templates (DATA.listStyleTemplates) when
    // available — that's the single source of truth for displayOrder,
    // category, isAIGenerated, active, clipUrl. Fall back to per-vendor
    // services so vendor-specific menus still render.
    if (DATA && typeof DATA.listStyleTemplates === 'function') {
      var templates = DATA.listStyleTemplates();
      if (templates && templates.length) {
        return templates.map(function(tmpl) {
          var service = (services || []).filter(function(s) { return s.id === tmpl.id; })[0] || null;
          return {
            id: tmpl.id,
            title: service ? serviceCopy(service, 'name') : tmpl.title,
            category: tmpl.category,
            imageUrl: tmpl.imageUrl,
            clipUrl: tmpl.clipUrl || '',
            prompt: tmpl.imagePrompt || '',
            isAIGenerated: tmpl.isAIGenerated === true,
            active: tmpl.active !== false,
            displayOrder: tmpl.displayOrder,
            price: service && service.price,
            imageAlt: tmpl.imageAlt || tmpl.title
          };
        }).filter(function(item) { return item.active; });
      }
    }
    return (services || []).map(function(service, index) {
      var imageRecord = serviceImage(service);
      return {
        id: service.id,
        title: serviceCopy(service, 'name'),
        category: service.category || 'haircut',
        imageUrl: imageRecord.imageUrl || service.imageUrl || '',
        clipUrl: imageRecord.clipUrl || service.clipUrl || '',
        prompt: imageRecord.prompt || imageRecord.imagePrompt || service.prompt || service.imagePrompt || '',
        isAIGenerated: true,
        active: service.active !== false,
        displayOrder: index + 1,
        price: service.price,
        imageAlt: imageRecord.imageAlt || service.imageAlt || service.name
      };
    }).filter(function(item) {
      return item.active;
    });
  }

  function vendorUrl(service, mode) {
    // Marketplace routing: the "Book this service" CTA never navigates to a
    // per-vendor customer page. It either opens the location gate (if the
    // customer has not entered city/ZIP yet) or anchors to the AI assistant.
    // The click handler in renderSelectedService() short-circuits with
    // openAssistantPanel() when a vendor has already been routed.
    void mode;
    void service;
    return readSavedLocation() ? '#mbAssistantPanel' : '#mbLocationGate';
  }

  function renderServiceProgress(services) {
    var progress = document.getElementById('mbServiceProgress');
    if (!progress) return;
    progress.innerHTML = '';
    services.forEach(function(service, index) {
      var dot = el('button', 'mb-service-progress__dot');
      dot.type = 'button';
      dot.setAttribute('aria-label', service.name);
      dot.addEventListener('click', function() {
        var cards = document.querySelectorAll('#mbServiceList .mb-service-card');
        if (cards[index]) cards[index].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      });
      progress.appendChild(dot);
    });
  }

  function syncServiceProgress() {
    var list = document.getElementById('mbServiceList');
    var dots = document.querySelectorAll('#mbServiceProgress .mb-service-progress__dot');
    if (!list || !dots.length) return;
    var card = list.querySelector('.mb-service-card');
    var width = card ? card.getBoundingClientRect().width : list.clientWidth;
    var index = width ? Math.round(list.scrollLeft / width) : 0;
    dots.forEach(function(dot, i) {
      dot.classList.toggle('mb-service-progress__dot--active', i === index);
    });
  }

  function selectService(service) {
    state.selectedServiceId = service.id;
    document.querySelectorAll('#mbServiceList .mb-service-card').forEach(function(card) {
      card.classList.toggle('mb-service-card--selected', card.getAttribute('data-service-id') === service.id);
    });
    renderSelectedService(service);
  }

  function renderSelectedService(service) {
    var panel = document.getElementById('mbServiceSelection');
    if (!panel || !service) return;
    panel.innerHTML = '';

    var text = el('div', 'mb-service-selection__text');
    var label = el('span');
    var title = el('strong');
    var actions = el('div', 'mb-service-selection__actions');
    var book = el('a', 'mb-button mb-button--primary');
    var chat = el('button', 'mb-button mb-button--ghost');
    var voice = el('button', 'mb-button mb-button--ghost');

    label.textContent = t('selectedServiceLabel');
    title.textContent = serviceCopy(service, 'name') + ' · ' + formatMoney(service.price);
    book.href = vendorUrl(service, '');
    book.addEventListener('click', function(event) {
      event.preventDefault();
      state.selectedServiceId = service.id;
      var saved = readSavedLocation();
      var routed = saved && BOOKING && BOOKING.findVendorForAddress
        ? BOOKING.findVendorForAddress(saved, { vendors: DATA.sampleVendors })
        : null;
      if (routed) {
        state.routedVendor = routed;
        openAssistantPanel('general');
      } else {
        promptForLocation(service.id);
      }
    });
    chat.type = 'button';
    voice.type = 'button';
    chat.setAttribute('data-action', 'chatSelectedService');
    voice.setAttribute('data-action', 'voiceSelectedService');
    book.textContent = t('bookThisService');
    chat.textContent = t('chatThisService');
    voice.textContent = t('talkThisService');
    chat.addEventListener('click', function() {
      state.selectedServiceId = service.id;
      openAssistantPanel('general');
    });
    voice.addEventListener('click', function() {
      state.selectedServiceId = service.id;
      openVoiceAssistant();
    });

    text.appendChild(label);
    text.appendChild(title);
    actions.appendChild(book);
    actions.appendChild(chat);
    actions.appendChild(voice);
    panel.appendChild(text);
    panel.appendChild(actions);
    panel.hidden = false;
  }

  function renderServices() {
    var list = document.getElementById('mbServiceList');
    if (!list) return;
    list.innerHTML = '';
    var services = DATA && DATA.sampleServices ? DATA.sampleServices.filter(function(service) {
      return service.active !== false;
    }) : [];
    services = landingServices(services);
    services.forEach(function(service) {
      var card = el('article', 'mb-service-card');
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
      image.src = imageRecord.imageUrl || service.imageUrl || '';
      image.alt = imageRecord.imageAlt || service.imageAlt || service.name;
      disclosure.textContent = t('aiPreviewDisclosure');
      title.textContent = serviceCopy(service, 'name');
      desc.textContent = serviceCopy(service, 'desc');
      row.appendChild(metaChip(t('priceLabel'), formatMoney(service.price)));
      row.appendChild(metaChip(t('durationLabel'), service.durationMinutes + ' ' + t('minutes')));
      row.appendChild(metaChip(t('travelBufferLabel'), service.travelBufferMinutes + ' ' + t('minutes')));
      row.appendChild(metaChip(t('cleanupLabel'), service.cleanupBufferMinutes + ' ' + t('minutes')));
      cta.type = 'button';
      cta.textContent = t('selectService');
      cta.addEventListener('click', function() {
        selectService(service);
        var saved = readSavedLocation();
        if (!saved || !BOOKING.findVendorForAddress(saved, { vendors: DATA.sampleVendors })) {
          promptForLocation(service.id);
        }
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
    renderServiceProgress(services);
    if (state.selectedServiceId) {
      var selected = services.filter(function(service) { return service.id === state.selectedServiceId; })[0];
      if (selected) renderSelectedService(selected);
    } else {
      var selection = document.getElementById('mbServiceSelection');
      if (selection) selection.hidden = true;
    }
    syncServiceProgress();
  }

  function renderPromoPreview() {
    var list = document.getElementById('mbPromoPreview');
    if (!list) return;
    list.innerHTML = '';
    var services = DATA && DATA.sampleServices ? DATA.sampleServices.filter(function(service) {
      return service.active !== false;
    }) : [];
    promoContentItems(landingServices(services)).forEach(function(item) {
      var card = el('article', 'mb-promo__card');
      var img = document.createElement('img');
      var body = el('div', 'mb-promo__card-body');
      var title = el('strong');
      var price = el('span');
      card.setAttribute('data-promo-id', item.id);
      card.setAttribute('data-promo-category', item.category);
      img.src = item.imageUrl;
      img.alt = item.imageAlt;
      img.loading = 'lazy';
      title.textContent = item.title;
      price.textContent = formatMoney(item.price);
      body.appendChild(title);
      body.appendChild(price);
      card.appendChild(img);
      card.appendChild(body);
      list.appendChild(card);
    });
  }

  function renderStylePreviewGallery() {
    // Truth-first replacement for the old before/after gallery.
    // The image-to-image identity lock for AI before/after pairs is not
    // reliable enough to claim 'same person'. Showing one curated style
    // preview per category avoids misleading the customer until a real
    // barber portfolio is uploaded.
    var list = document.getElementById('mbBeforeAfterGallery');
    if (!list) return;
    list.innerHTML = '';
    var templates = (DATA && typeof DATA.listStyleTemplates === 'function')
      ? DATA.listStyleTemplates()
      : [];
    var picked = templates.filter(function(tmpl) {
      return tmpl && tmpl.active !== false && tmpl.imageUrl;
    }).slice(0, 6);

    picked.forEach(function(tmpl) {
      var card = el('article', 'mb-portfolio-card mb-portfolio-card--ai-sample mb-style-preview-card');

      var media = el('div', 'mb-style-preview-card__media');
      var badge = el('span', 'mb-portfolio-card__ai-badge mb-portfolio-card__ai-badge--clip');
      badge.textContent = 'AI preview';
      media.appendChild(badge);
      if (tmpl.imageUrl) {
        media.style.backgroundImage = "url('" + tmpl.imageUrl + "')";
        media.setAttribute('role', 'img');
        media.setAttribute('aria-label', tmpl.imageAlt || tmpl.title || '');
      }
      card.appendChild(media);

      var chip = el('span', 'mb-portfolio-card__category');
      var title = el('h3');
      var desc = el('p');
      chip.textContent = tmpl.category || 'style';
      title.textContent = (tmpl.title || '') + ' — ' + t('stylePreviewSuffix');
      desc.textContent = t('aiPreviewDisclosure');
      card.appendChild(chip);
      card.appendChild(title);
      card.appendChild(desc);
      list.appendChild(card);
    });
  }

  function renderConvenience() {
    var list = document.getElementById('mbConvenienceList');
    if (!list) return;
    list.innerHTML = '';
    [
      'Barber comes to your home',
      'Good for kids and seniors',
      'Hotel / office / care facility appointments',
      'Transparent pricing',
      'No waiting room',
      'Flexible scheduling',
      'English / Vietnamese support'
    ].forEach(function(text) {
      var card = el('article', 'mb-convenience-card');
      var icon = el('span');
      var body = el('strong');
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '✓';
      body.textContent = text;
      card.appendChild(icon);
      card.appendChild(body);
      list.appendChild(card);
    });
  }

  function renderPromoClips() {
    var list = document.getElementById('mbPromoClips');
    if (!list) return;
    list.innerHTML = '';
    var rails = [
      ['Fade at home', 'Fresh fade setup, cleanup, and finish without a waiting room.', '/assets/mobile-barber/clips/fade-1.mp4', '/assets/mobile-barber/portfolio/fade-1-after.jpg'],
      ['Family haircut stop', 'One mobile visit can cover kids, seniors, and parents.', '/assets/mobile-barber/clips/family-haircut-1.mp4', '/assets/mobile-barber/portfolio/family-haircut-1-after.jpg'],
      ['Hotel-ready grooming', 'Business cut and beard detail before meetings or events.', '/assets/mobile-barber/clips/business-haircut-1.mp4', '/assets/mobile-barber/portfolio/business-haircut-1-after.jpg']
    ];
    rails.forEach(function(row, index) {
      var card = el('article', 'mb-promo-clip-card mb-promo-clip-card--video');
      var title = el('strong');
      var copy = el('p');
      card.style.setProperty('--clip-delay', String(index * 120) + 'ms');
      var video = document.createElement('video');
      video.src = row[2];
      video.poster = row[3];
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('preload', 'metadata');
      video.setAttribute('aria-label', row[0]);
      title.textContent = row[0];
      copy.textContent = row[1];
      card.appendChild(video);
      card.appendChild(title);
      card.appendChild(copy);
      list.appendChild(card);
    });
  }

  function coverageRegionsFromVendors() {
    // Group active vendors into coverage regions instead of leaking individual
    // barber names. Each region card aggregates serviceAreas + languages +
    // travel radius so customers see *where* we serve, not *who* serves it.
    var vendors = DATA && DATA.sampleVendors ? DATA.sampleVendors.filter(function(vendor) {
      return vendor.active !== false;
    }) : [];
    var byRegion = {};
    vendors.forEach(function(vendor) {
      var key = vendor.region || 'general';
      if (!byRegion[key]) {
        byRegion[key] = {
          key: key,
          cities: {},
          languages: {},
          maxRadius: 0,
          minTravelFee: null,
          maxRating: 0,
          vendorCount: 0
        };
      }
      var region = byRegion[key];
      region.vendorCount += 1;
      (vendor.serviceAreas || []).forEach(function(city) { region.cities[city] = true; });
      (vendor.languages || []).forEach(function(lang) { region.languages[lang] = true; });
      if (Number(vendor.travelRadiusMiles || 0) > region.maxRadius) region.maxRadius = Number(vendor.travelRadiusMiles || 0);
      var fee = Number(vendor.baseTravelFee || 0);
      if (region.minTravelFee === null || fee < region.minTravelFee) region.minTravelFee = fee;
      if (Number(vendor.rating || 0) > region.maxRating) region.maxRating = Number(vendor.rating || 0);
    });
    return Object.keys(byRegion).map(function(key) {
      var r = byRegion[key];
      return {
        key: key,
        cities: Object.keys(r.cities),
        languages: Object.keys(r.languages),
        maxRadius: r.maxRadius,
        minTravelFee: r.minTravelFee || 0,
        maxRating: r.maxRating,
        vendorCount: r.vendorCount
      };
    });
  }

  function coverageRegionLabel(regionKey) {
    if (regionKey === 'oc') return t('coverageRegionOC');
    if (regionKey === 'bayarea' || regionKey === 'bay-area' || regionKey === 'bay') return t('coverageRegionBay');
    return t('vendorsTitle');
  }

  function renderVendors() {
    // Marketplace routing: render coverage-area cards instead of per-barber
    // profiles. No barber names. No /mobile-barber/vendor/ links. The CTA
    // scrolls to the Find-My-Barber gate which then auto-routes via
    // BOOKING.findVendorForAddress().
    var list = document.getElementById('mbVendorList');
    var empty = document.getElementById('mbEmptyState');
    if (!list || !empty) return;
    list.innerHTML = '';
    var regions = coverageRegionsFromVendors();
    empty.hidden = regions.length > 0;
    regions.forEach(function(region) {
      var card = el('article', 'mb-vendor-card mb-coverage-card');
      var top = el('div', 'mb-vendor-card__top');
      var headingWrap = el('div');
      var title = el('h3');
      var subtitle = el('p');
      var citiesLabel = el('p');
      var metaRow = el('div', 'mb-meta-row');
      var cta = el('button', 'mb-button mb-button--primary');

      title.textContent = coverageRegionLabel(region.key);
      subtitle.textContent = t('coverageCityListLabel');
      citiesLabel.textContent = region.cities.slice(0, 8).join(' · ');
      citiesLabel.className = 'mb-coverage-card__cities';
      metaRow.appendChild(metaChip(t('radiusLabel'), region.maxRadius + ' mi'));
      metaRow.appendChild(metaChip(t('travelFeeLabel'), formatMoney(region.minTravelFee)));
      metaRow.appendChild(metaChip(t('languagesLabel'), region.languages.join(', ').toUpperCase()));
      if (region.maxRating) metaRow.appendChild(metaChip(t('ratingLabel'), String(region.maxRating)));
      cta.type = 'button';
      cta.textContent = t('coverageCta');
      cta.addEventListener('click', function() {
        promptForLocation(state.selectedServiceId);
      });

      headingWrap.appendChild(title);
      headingWrap.appendChild(subtitle);
      top.appendChild(headingWrap);
      card.appendChild(top);
      card.appendChild(citiesLabel);
      card.appendChild(metaRow);
      card.appendChild(cta);
      list.appendChild(card);
    });
  }

  function setLang(lang) {
    if (!STRINGS[lang]) return;
    state.lang = lang;
    document.documentElement.lang = lang;
    document.title = t('pageTitle');
    document.getElementById('mbLanguage').setAttribute('aria-label', t('languageLabel'));
    document.querySelector('.mb-hero__actions').setAttribute('aria-label', t('heroActionsLabel'));
    document.querySelector('.mb-trust').setAttribute('aria-label', t('trustLabel'));
    document.querySelector('[data-action="voice"]').setAttribute('aria-label', t('talkAssistant'));
    setText(document);
    renderPromoPreview();
    renderStylePreviewGallery();
    renderConvenience();
    renderPromoClips();
    renderServices();
    renderVendors();
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

    document.querySelectorAll('[data-action="chat"], [data-action="voice"]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (btn.getAttribute('data-action') === 'voice') openVoiceAssistant();
        else openAssistantPanel('general');
      });
    });

    document.querySelector('[data-action="closeAssistant"]').addEventListener('click', function() {
      document.getElementById('mbAssistantPanel').hidden = true;
    });

    var assistantForm = document.getElementById('mbAssistantForm');
    if (assistantForm) assistantForm.addEventListener('submit', handleAssistantSubmit);

    var preferredSelect = document.getElementById('mbPreferredBarberSelect');
    if (preferredSelect) preferredSelect.addEventListener('change', handlePreferredBarberChange);

    var list = document.getElementById('mbServiceList');
    if (list) {
      list.addEventListener('scroll', function() {
        root.requestAnimationFrame(syncServiceProgress);
      }, { passive: true });
    }

    // Location gate is gone — the chat agent collects city/ZIP via slot
    // fill and routes via BOOKING.findVendorForAddress. No gateForm /
    // waitlist / changeLocation bindings needed on the marketplace landing.

    // Optional AI haircut preview — wires the new section between the trust
    // strip and the promo. Customer picks one style; selection is attached
    // to the next booking the chat agent submits (see attachAiPreviewToBooking).
    var aiConsent  = document.getElementById('mbHomeAiPreviewConsent');
    var aiUpload   = document.getElementById('mbHomeAiPreviewUpload');
    var aiAnalyze  = document.getElementById('mbHomeAiPreviewAnalyze');
    var aiRemove   = document.getElementById('mbHomeAiPreviewRemove');
    if (aiConsent) aiConsent.addEventListener('change', handleAiConsentChange);
    if (aiUpload)  aiUpload.addEventListener('change', handleAiUpload);
    if (aiAnalyze) aiAnalyze.addEventListener('click', handleAiAnalyze);
    if (aiRemove)  aiRemove.addEventListener('click', function() { resetAiPreviewSelfie(false); });
  }

  // ── AI Haircut Preview (marketplace landing) ──────────────────────────
  function setAiStatus(msg) {
    var node = document.getElementById('mbHomeAiPreviewStatus');
    if (node) node.textContent = msg || '';
  }

  function renderAiSelfie() {
    var node = document.getElementById('mbHomeAiPreviewSelfie');
    var remove = document.getElementById('mbHomeAiPreviewRemove');
    if (!node) return;
    if (!state.aiPreview.selfieDataUrl) {
      node.hidden = true; node.innerHTML = '';
      if (remove) remove.hidden = true;
      return;
    }
    node.hidden = false; node.innerHTML = '';
    var img = document.createElement('img');
    img.src = state.aiPreview.selfieDataUrl;
    img.alt = t('homeAiPreviewSelfieAlt') || 'Selfie preview';
    img.className = 'mb-ai-preview__selfie-img';
    node.appendChild(img);
    if (remove) remove.hidden = false;
  }

  function renderAiResults() {
    var list = document.getElementById('mbHomeAiPreviewResults');
    var attach = document.getElementById('mbHomeAiPreviewAttachNote');
    if (!list) return;
    list.innerHTML = '';
    var recs = state.aiPreview.recommendations || [];
    if (!recs.length) {
      list.hidden = true;
      if (attach) attach.hidden = true;
      return;
    }
    list.hidden = false;
    recs.forEach(function(rec, idx) {
      var imgSrc = rec.previewDataUrl || rec.previewUrl || '';
      var card = document.createElement('label');
      card.className = 'mb-ai-rec-card';
      var input = document.createElement('input');
      input.type = 'radio';
      input.name = 'mbHomeAiRec';
      input.value = rec.styleId || ('rec-' + idx);
      input.className = 'mb-ai-rec-card__radio';
      if (state.aiPreview.selectedStyleId === input.value) {
        input.checked = true;
        card.classList.add('mb-ai-rec-card--selected');
      }
      input.addEventListener('change', function() {
        handleAiSelect(rec, imgSrc);
      });
      var thumb = document.createElement('div');
      thumb.className = 'mb-ai-rec-card__thumb';
      var img = document.createElement('img');
      img.src = imgSrc;
      img.alt = rec.title || '';
      img.loading = 'lazy';
      thumb.appendChild(img);
      var body = document.createElement('div');
      body.className = 'mb-ai-rec-card__body';
      var title = document.createElement('strong'); title.textContent = rec.title || '';
      var meta = document.createElement('span');
      meta.className = 'mb-ai-rec-card__maintenance';
      meta.textContent = rec.maintenance || '';
      var desc = document.createElement('p'); desc.textContent = rec.explanation || '';
      var notes = document.createElement('p');
      notes.className = 'mb-ai-rec-card__barber-notes';
      notes.textContent = (t('homeAiPreviewBarberNotesLabel') || 'Barber notes:') + ' ' + (rec.barberNotes || '');
      var badge = document.createElement('span');
      badge.className = 'mb-ai-rec-card__ai-badge';
      badge.textContent = t('homeAiPreviewBadge') || 'AI suggestion';
      body.appendChild(title);
      body.appendChild(meta);
      body.appendChild(desc);
      body.appendChild(notes);
      body.appendChild(badge);
      card.appendChild(input);
      card.appendChild(thumb);
      card.appendChild(body);
      list.appendChild(card);
    });
    if (attach) attach.hidden = !state.aiPreview.selectedStyleId;
  }

  function handleAiConsentChange() {
    var checkbox = document.getElementById('mbHomeAiPreviewConsent');
    var upload   = document.getElementById('mbHomeAiPreviewUpload');
    var analyze  = document.getElementById('mbHomeAiPreviewAnalyze');
    state.aiPreview.consent = !!(checkbox && checkbox.checked);
    if (upload)  upload.disabled  = !state.aiPreview.consent;
    if (analyze) analyze.disabled = !state.aiPreview.consent || !state.aiPreview.selfieDataUrl;
    if (!state.aiPreview.consent) resetAiPreviewSelfie(true);
  }

  function handleAiUpload(event) {
    var file = event && event.target && event.target.files && event.target.files[0];
    if (!file) return;
    if (!state.aiPreview.consent) {
      setAiStatus(t('homeAiPreviewConsentRequired'));
      event.target.value = '';
      return;
    }
    if (!root.MobileBarberAIPreview || typeof root.MobileBarberAIPreview.compressImage !== 'function') {
      setAiStatus(t('homeAiPreviewProviderError'));
      return;
    }
    setAiStatus(t('homeAiPreviewCompressing'));
    root.MobileBarberAIPreview.compressImage(file)
      .then(function(dataUrl) {
        state.aiPreview.selfieDataUrl = dataUrl;
        state.aiPreview.lastError = '';
        renderAiSelfie();
        var analyze = document.getElementById('mbHomeAiPreviewAnalyze');
        if (analyze) analyze.disabled = false;
        setAiStatus(t('homeAiPreviewReady'));
      })
      .catch(function(err) {
        state.aiPreview.lastError = (err && (err.code || err.message)) || 'compress_failed';
        setAiStatus(t('homeAiPreviewCompressFailed'));
      });
  }

  function handleAiAnalyze() {
    if (!state.aiPreview.consent) { setAiStatus(t('homeAiPreviewConsentRequired')); return; }
    if (state.aiPreview.analyzing) return;
    if (!root.MobileBarberAIPreview || typeof root.MobileBarberAIPreview.generate !== 'function') {
      setAiStatus(t('homeAiPreviewProviderError'));
      return;
    }
    state.aiPreview.analyzing = true;
    state.aiPreview.recommendations = [];
    state.aiPreview.selectedStyleId = '';
    state.aiPreview.selectedStylePreviewUrl = '';
    state.aiPreview.sessionId = 'ses_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
    renderAiResults();
    setAiStatus(t('homeAiPreviewAnalyzing'));
    root.MobileBarberAIPreview.generate({
      dataUrl: state.aiPreview.selfieDataUrl,
      lang: state.lang
    }).then(function(result) {
      state.aiPreview.analyzing = false;
      if (!result || !result.ok) {
        if (root.console) root.console.warn('[mobile-barber] AI preview failed', result);
        state.aiPreview.recommendations = [];
        state.aiPreview.summary = '';
        state.aiPreview.lastError = (result && result.code) || 'unknown';
        renderAiResults();
        setAiStatus((result && result.message) || t('homeAiPreviewProviderError'));
        return;
      }
      state.aiPreview.summary = result.analysis || '';
      state.aiPreview.recommendations = result.recommendations || [];
      state.aiPreview.lastError = '';
      renderAiResults();
      setAiStatus(t('homeAiPreviewDone'));
    }).catch(function(err) {
      state.aiPreview.analyzing = false;
      state.aiPreview.recommendations = [];
      state.aiPreview.lastError = (err && err.message) || 'analyze_failed';
      renderAiResults();
      setAiStatus(t('homeAiPreviewProviderError'));
    });
  }

  function handleAiSelect(rec, fullDataUrl) {
    state.aiPreview.selectedStyleId = rec.styleId || '';
    var AIP = root.MobileBarberAIPreview;
    // Save the FULL-quality original to the customer's localStorage so they
    // can re-view their high-res preview later on this device.
    if (AIP && typeof AIP.saveLocalCopy === 'function' && fullDataUrl) {
      try { AIP.saveLocalCopy(state.aiPreview.sessionId || '', rec.styleId || '', fullDataUrl); } catch (e) {}
    }
    // Compress to ~400KB JPEG for the booking doc (Firestore 1MB cap).
    if (AIP && typeof AIP.compressDataUrl === 'function' && fullDataUrl && fullDataUrl.indexOf('data:image/') === 0) {
      AIP.compressDataUrl(fullDataUrl, { maxDimension: 512, quality: 0.78 })
        .then(function(small) { state.aiPreview.selectedStylePreviewUrl = small || fullDataUrl; })
        .catch(function() { state.aiPreview.selectedStylePreviewUrl = fullDataUrl; });
    } else {
      state.aiPreview.selectedStylePreviewUrl = fullDataUrl;
    }
    renderAiResults();
    setAiStatus(t('homeAiPreviewSelectedAck'));
  }

  function resetAiPreviewSelfie(silent) {
    state.aiPreview.selfieDataUrl = '';
    state.aiPreview.recommendations = [];
    state.aiPreview.selectedStyleId = '';
    state.aiPreview.selectedStylePreviewUrl = '';
    state.aiPreview.summary = '';
    var upload = document.getElementById('mbHomeAiPreviewUpload');
    if (upload) upload.value = '';
    var analyze = document.getElementById('mbHomeAiPreviewAnalyze');
    if (analyze) analyze.disabled = !state.aiPreview.consent;
    renderAiSelfie();
    renderAiResults();
    if (!silent) setAiStatus(t('homeAiPreviewRemoved'));
    else setAiStatus('');
  }

  // Caller-side enrichment: when the chat agent returns a freshly-built
  // booking, attach the customer's optional AI preview selection so the
  // vendor dashboard surfaces it alongside the appointment.
  function attachAiPreviewToBooking(booking) {
    if (!booking) return booking;
    var ai = state.aiPreview || {};
    if (!ai.selectedStyleId && !ai.selfieDataUrl) return booking;
    booking.selfieDataUrl = ai.selfieDataUrl || '';
    booking.aiAnalysisSummary = ai.summary || '';
    booking.aiAnalysisConsent = ai.consent ? 'true' : 'false';
    // Strip the bulk previewDataUrl from each rec — keep only metadata so
    // the booking doc stays under Firestore's 1 MB cap. The selected
    // preview is stored separately in selectedStylePreviewUrl (compressed).
    booking.recommendedStyles = (ai.recommendations || []).map(function(r) {
      return {
        styleId: r.styleId || '',
        title: r.title || '',
        explanation: r.explanation || '',
        maintenance: r.maintenance || '',
        barberNotes: r.barberNotes || ''
      };
    });
    booking.selectedStyleId = ai.selectedStyleId || '';
    booking.selectedStylePreviewUrl = ai.selectedStylePreviewUrl || '';
    return booking;
  }

  var HERO_SLIDES = [
    '/assets/mobile-barber/styles/classic-haircut.jpg',
    '/assets/mobile-barber/styles/fade-haircut.jpg',
    '/assets/mobile-barber/styles/business-haircut.jpg',
    '/assets/mobile-barber/styles/home-family-package.jpg',
    '/assets/mobile-barber/styles/kids-haircut.jpg',
    '/assets/mobile-barber/styles/modern-styling.jpg'
  ];

  function startHeroRotation() {
    var a = document.querySelector('.mb-hero__photo--a');
    var b = document.querySelector('.mb-hero__photo--b');
    if (!a || !b || HERO_SLIDES.length < 2) return;
    var gradient = 'linear-gradient(180deg, rgba(7, 31, 56, .12), rgba(7, 31, 56, .82))';
    var idx = 0;
    var showingA = true;
    a.style.backgroundImage = gradient + ', url("' + HERO_SLIDES[idx] + '")';
    a.style.opacity = '1';
    b.style.opacity = '0';
    setInterval(function() {
      idx = (idx + 1) % HERO_SLIDES.length;
      var next = showingA ? b : a;
      var current = showingA ? a : b;
      next.style.backgroundImage = gradient + ', url("' + HERO_SLIDES[idx] + '")';
      next.style.opacity = '1';
      current.style.opacity = '0';
      showingA = !showingA;
    }, 4500);
  }

  function init() {
    state.lang = getLang();
    var params = new URLSearchParams(root.location.search);
    state.selectedServiceId = params.get('serviceId') || '';
    state.region = String(params.get('region') || '').toLowerCase();
    bind();
    prefillLocationGate();
    setLang(state.lang);
    startHeroRotation();
    applyRegionDeepLink();
  }

  function applyRegionDeepLink() {
    if (!state.region) return;
    var bannerKey = state.region === 'oc' ? 'regionGateBannerOC'
      : (state.region === 'bayarea' || state.region === 'bay-area' || state.region === 'bay') ? 'regionGateBannerBay'
      : '';
    if (!bannerKey) return;
    setLocationStatus(t(bannerKey));
    var gate = document.getElementById('mbLocationGate');
    if (gate) {
      try { gate.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      gate.classList.add('mb-location-gate--active');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
