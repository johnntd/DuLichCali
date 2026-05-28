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
      homeAiPreviewUploadLabel: 'Add a selfie (face + hair visible, good light)',
      homeAiPreviewAddPhoto: 'Add a photo or selfie',
      homeAiPreviewAddPhotoHint: "Your phone will let you take a new selfie or pick one from your library.",
      homeAiPreviewChooseFile: 'Choose from gallery',
      homeAiPreviewTakeSelfie: 'Take a selfie',
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
      homeAiPreviewMaintenanceLabel: 'Maintenance:',
      homeAiPreviewBookCta: 'Book this style',
      homeAiPreviewBookCancel: 'Close booking form',
      homeAiPreviewBookAgain: 'Book another time',
      homeAiPreviewBookFormTitle: 'Book this style',
      homeAiPreviewBookFormSub: 'Quick details — the barber confirms after.',
      homeAiPreviewBookPhone: 'Phone number',
      homeAiPreviewBookName: 'Your name',
      homeAiPreviewBookAddress: 'Street address',
      homeAiPreviewBookCity: 'City',
      homeAiPreviewBookZip: 'ZIP',
      homeAiPreviewBookDate: 'Preferred date',
      homeAiPreviewBookTime: 'Preferred time',
      homeAiPreviewBookNotes: 'Optional notes',
      homeAiPreviewBookNotesPlaceholder: 'Anything the barber should know',
      homeAiPreviewBookSubmit: 'Send booking request',
      homeAiPreviewBookSubmitting: 'Sending…',
      homeAiPreviewBookSuccess: 'Booking sent. The barber will confirm shortly.',
      homeAiPreviewBookSubmitted: 'Booking submitted. The barber will confirm shortly.',
      homeAiPreviewBookMissing: 'Please fill the highlighted fields.',
      homeAiPreviewBookNoVendor: 'No barber covers this address yet. Try a different ZIP.',
      homeAiPreviewBookNoService: 'No service available for this barber right now.',
      homeAiPreviewBookBlackout: 'That date is unavailable. Please pick another.',
      homeAiPreviewBookClosed: 'The barber is closed that day. Please pick another.',
      homeAiPreviewBookOutsideHours: 'That time is outside the barber’s hours.',
      homeAiPreviewBookCutoff: 'Too close to your time. Please pick a later slot.',
      homeAiPreviewBookOverlap: 'That slot was just taken. Please pick another.',
      homeAiPreviewBookGeneric: 'Could not send the booking. Please try again.',
      manualBookingFormTitle: 'Book this service',
      manualBookingFormSub: 'Fill these once — the barber confirms after.',
      manualBookingAiAttached: 'AI hairstyle attached',
      manualBookingPhone: 'Phone number',
      manualBookingName: 'Your name',
      manualBookingAddress: 'Street address',
      manualBookingCity: 'City',
      manualBookingZip: 'ZIP',
      manualBookingDate: 'Preferred date',
      manualBookingTime: 'Preferred time',
      manualBookingNotes: 'Optional notes',
      manualBookingNotesPlaceholder: 'Anything the barber should know',
      manualBookingSubmit: 'Send booking request',
      manualBookingSubmitting: 'Sending…',
      manualBookingSuccess: 'Booking sent. The barber will confirm shortly.',
      manualBookingCancel: 'Cancel',
      manualBookingMissing: 'Please fill the required fields.',
      manualBookingNoVendor: 'No barber covers this address yet. Try a different ZIP.',
      manualBookingNoService: 'No service available for this barber right now.',
      manualBookingBlackout: 'That date is unavailable. Please pick another.',
      manualBookingClosed: 'The barber is closed that day. Please pick another.',
      manualBookingOutsideHours: 'That time is outside the barber’s hours.',
      manualBookingCutoff: 'Too close to your time. Please pick a later slot.',
      manualBookingOverlap: 'That slot was just taken. Please pick another.',
      manualBookingGeneric: 'Could not send the booking. Please try again.',
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
      paymentChoiceLegend: 'Preferred payment method',
      paymentCash: 'Cash',
      paymentZelle: 'Zelle',
      zellePayPanelTitle: 'Pay with Zelle',
      zelleSendPaymentTo: 'Send payment to:',
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
      homeAiPreviewUploadLabel: 'Thêm ảnh selfie (thấy rõ mặt và tóc, đủ sáng)',
      homeAiPreviewAddPhoto: 'Thêm ảnh hoặc selfie',
      homeAiPreviewAddPhotoHint: 'Điện thoại sẽ cho bạn chụp selfie mới hoặc chọn từ thư viện.',
      homeAiPreviewChooseFile: 'Chọn từ thư viện',
      homeAiPreviewTakeSelfie: 'Chụp ảnh selfie',
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
      homeAiPreviewMaintenanceLabel: 'Mức độ chăm sóc:',
      homeAiPreviewBookCta: 'Đặt kiểu tóc này',
      homeAiPreviewBookCancel: 'Đóng phiếu đặt',
      homeAiPreviewBookAgain: 'Đặt lịch khác',
      homeAiPreviewBookFormTitle: 'Đặt kiểu tóc này',
      homeAiPreviewBookFormSub: 'Vài thông tin nhanh — thợ sẽ xác nhận sau.',
      homeAiPreviewBookPhone: 'Số điện thoại',
      homeAiPreviewBookName: 'Họ và tên',
      homeAiPreviewBookAddress: 'Địa chỉ',
      homeAiPreviewBookCity: 'Thành phố',
      homeAiPreviewBookZip: 'Mã ZIP',
      homeAiPreviewBookDate: 'Ngày mong muốn',
      homeAiPreviewBookTime: 'Giờ mong muốn',
      homeAiPreviewBookNotes: 'Ghi chú thêm',
      homeAiPreviewBookNotesPlaceholder: 'Điều gì cần thợ lưu ý',
      homeAiPreviewBookSubmit: 'Gửi yêu cầu đặt',
      homeAiPreviewBookSubmitting: 'Đang gửi…',
      homeAiPreviewBookSuccess: 'Đã gửi lịch hẹn. Thợ sẽ xác nhận sớm.',
      homeAiPreviewBookSubmitted: 'Đã gửi lịch hẹn. Thợ sẽ xác nhận sớm.',
      homeAiPreviewBookMissing: 'Vui lòng điền các ô được yêu cầu.',
      homeAiPreviewBookNoVendor: 'Hiện chưa có thợ phục vụ địa chỉ này. Thử ZIP khác giúp em.',
      homeAiPreviewBookNoService: 'Hiện không có dịch vụ phù hợp cho thợ này.',
      homeAiPreviewBookBlackout: 'Ngày này thợ nghỉ. Vui lòng chọn ngày khác.',
      homeAiPreviewBookClosed: 'Thợ không làm việc ngày này. Vui lòng chọn ngày khác.',
      homeAiPreviewBookOutsideHours: 'Giờ này nằm ngoài khung làm việc của thợ.',
      homeAiPreviewBookCutoff: 'Quá gần với giờ bạn chọn. Vui lòng chọn giờ trễ hơn.',
      homeAiPreviewBookOverlap: 'Khung giờ này vừa có người đặt. Vui lòng chọn giờ khác.',
      homeAiPreviewBookGeneric: 'Không gửi được lịch hẹn. Vui lòng thử lại.',
      manualBookingFormTitle: 'Đặt dịch vụ này',
      manualBookingFormSub: 'Điền một lần — thợ sẽ xác nhận sau.',
      manualBookingAiAttached: 'Đã đính kèm kiểu tóc AI',
      manualBookingPhone: 'Số điện thoại',
      manualBookingName: 'Họ và tên',
      manualBookingAddress: 'Địa chỉ',
      manualBookingCity: 'Thành phố',
      manualBookingZip: 'Mã ZIP',
      manualBookingDate: 'Ngày mong muốn',
      manualBookingTime: 'Giờ mong muốn',
      manualBookingNotes: 'Ghi chú thêm',
      manualBookingNotesPlaceholder: 'Điều gì cần thợ lưu ý',
      manualBookingSubmit: 'Gửi yêu cầu đặt',
      manualBookingSubmitting: 'Đang gửi…',
      manualBookingSuccess: 'Đã gửi lịch hẹn. Thợ sẽ xác nhận sớm.',
      manualBookingCancel: 'Hủy',
      manualBookingMissing: 'Vui lòng điền các ô bắt buộc.',
      manualBookingNoVendor: 'Hiện chưa có thợ phục vụ địa chỉ này. Thử ZIP khác giúp em.',
      manualBookingNoService: 'Hiện không có dịch vụ phù hợp cho thợ này.',
      manualBookingBlackout: 'Ngày này thợ nghỉ. Vui lòng chọn ngày khác.',
      manualBookingClosed: 'Thợ không làm việc ngày này. Vui lòng chọn ngày khác.',
      manualBookingOutsideHours: 'Giờ này nằm ngoài khung làm việc của thợ.',
      manualBookingCutoff: 'Quá gần với giờ bạn chọn. Vui lòng chọn giờ trễ hơn.',
      manualBookingOverlap: 'Khung giờ này vừa có người đặt. Vui lòng chọn giờ khác.',
      manualBookingGeneric: 'Không gửi được lịch hẹn. Vui lòng thử lại.',
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
      paymentChoiceLegend: 'Cách thanh toán muốn dùng',
      paymentCash: 'Tiền mặt',
      paymentZelle: 'Zelle',
      zellePayPanelTitle: 'Thanh toán bằng Zelle',
      zelleSendPaymentTo: 'Gửi thanh toán đến:',
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
      homeAiPreviewUploadLabel: 'Agregue una selfie (cara y cabello visibles, buena luz)',
      homeAiPreviewAddPhoto: 'Agregar foto o selfie',
      homeAiPreviewAddPhotoHint: 'Su teléfono le permitirá tomar una selfie o elegir una de la galería.',
      homeAiPreviewChooseFile: 'Elegir de la galería',
      homeAiPreviewTakeSelfie: 'Tomar una selfie',
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
      homeAiPreviewMaintenanceLabel: 'Mantenimiento:',
      homeAiPreviewBookCta: 'Reservar este estilo',
      homeAiPreviewBookCancel: 'Cerrar formulario',
      homeAiPreviewBookAgain: 'Reservar de nuevo',
      homeAiPreviewBookFormTitle: 'Reservar este estilo',
      homeAiPreviewBookFormSub: 'Datos rápidos — el barbero confirma después.',
      homeAiPreviewBookPhone: 'Teléfono',
      homeAiPreviewBookName: 'Su nombre',
      homeAiPreviewBookAddress: 'Dirección',
      homeAiPreviewBookCity: 'Ciudad',
      homeAiPreviewBookZip: 'Código postal',
      homeAiPreviewBookDate: 'Fecha preferida',
      homeAiPreviewBookTime: 'Hora preferida',
      homeAiPreviewBookNotes: 'Notas (opcional)',
      homeAiPreviewBookNotesPlaceholder: 'Algo que el barbero deba saber',
      homeAiPreviewBookSubmit: 'Enviar solicitud',
      homeAiPreviewBookSubmitting: 'Enviando…',
      homeAiPreviewBookSuccess: 'Solicitud enviada. El barbero confirmará pronto.',
      homeAiPreviewBookSubmitted: 'Solicitud enviada. El barbero confirmará pronto.',
      homeAiPreviewBookMissing: 'Por favor complete los campos requeridos.',
      homeAiPreviewBookNoVendor: 'Ningún barbero cubre esta dirección. Pruebe otro código postal.',
      homeAiPreviewBookNoService: 'No hay servicio disponible para este barbero ahora.',
      homeAiPreviewBookBlackout: 'Esa fecha no está disponible. Elija otra.',
      homeAiPreviewBookClosed: 'El barbero no trabaja ese día. Elija otro.',
      homeAiPreviewBookOutsideHours: 'Esa hora está fuera del horario del barbero.',
      homeAiPreviewBookCutoff: 'Demasiado cerca de la hora. Elija una más tarde.',
      homeAiPreviewBookOverlap: 'Ese horario ya fue tomado. Elija otro.',
      homeAiPreviewBookGeneric: 'No se pudo enviar la solicitud. Intente de nuevo.',
      manualBookingFormTitle: 'Reservar este servicio',
      manualBookingFormSub: 'Complete una vez — el barbero confirma después.',
      manualBookingAiAttached: 'Estilo AI adjuntado',
      manualBookingPhone: 'Teléfono',
      manualBookingName: 'Su nombre',
      manualBookingAddress: 'Dirección',
      manualBookingCity: 'Ciudad',
      manualBookingZip: 'Código postal',
      manualBookingDate: 'Fecha preferida',
      manualBookingTime: 'Hora preferida',
      manualBookingNotes: 'Notas (opcional)',
      manualBookingNotesPlaceholder: 'Algo que el barbero deba saber',
      manualBookingSubmit: 'Enviar solicitud',
      manualBookingSubmitting: 'Enviando…',
      manualBookingSuccess: 'Solicitud enviada. El barbero confirmará pronto.',
      manualBookingCancel: 'Cancelar',
      manualBookingMissing: 'Por favor complete los campos requeridos.',
      manualBookingNoVendor: 'Ningún barbero cubre esta dirección. Pruebe otro código postal.',
      manualBookingNoService: 'No hay servicio disponible para este barbero ahora.',
      manualBookingBlackout: 'Esa fecha no está disponible. Elija otra.',
      manualBookingClosed: 'El barbero no trabaja ese día. Elija otro.',
      manualBookingOutsideHours: 'Esa hora está fuera del horario del barbero.',
      manualBookingCutoff: 'Demasiado cerca de la hora. Elija una más tarde.',
      manualBookingOverlap: 'Ese horario ya fue tomado. Elija otro.',
      manualBookingGeneric: 'No se pudo enviar la solicitud. Intente de nuevo.',
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
      paymentChoiceLegend: 'Metodo de pago preferido',
      paymentCash: 'Efectivo',
      paymentZelle: 'Zelle',
      zellePayPanelTitle: 'Pagar con Zelle',
      zelleSendPaymentTo: 'Enviar pago a:',
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
    // Inline manual-booking-form state. Tied to the currently-selected
    // service. Kept separate from aiPreview so the manual flow does NOT
    // share any handler with the AI hairstyle inline booking.
    manualBooking: {
      expandedServiceId: '',
      submitting: false,
      lastSubmittedServiceId: '',
      lastSubmissionError: '',
      formDraft: {}
    },
    aiPreview: {
      consent: false,
      selfieDataUrl: '',
      summary: '',
      recommendations: [],
      selectedStyleId: '',
      selectedStylePreviewUrl: '',
      analyzing: false,
      sessionId: '',
      lastError: '',
      // Inline booking-from-card state. expandedStyleId is the styleId whose
      // inline booking form is open. lastSubmittedStyleId is set after a
      // successful direct save so we can render a success state on that card.
      expandedStyleId: '',
      submitting: false,
      lastSubmittedStyleId: '',
      lastSubmissionError: '',
      formDrafts: {}
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
    var selectedPayment = selectedPaymentMethod();
    if (selectedPayment && state.agentSession && state.agentSession.state) {
      state.agentSession.state = AGENT.mergeState(
        state.agentSession.state,
        { paymentMethod: selectedPayment },
        new Date()
      );
    }
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

  function selectedPaymentMethod() {
    var checked = document.querySelector('input[name="mbPaymentMethod"]:checked');
    var value = checked ? String(checked.value || '').toLowerCase() : 'cash';
    return value === 'zelle' ? 'zelle' : 'cash';
  }

  function bookingVendor(booking) {
    var vendorId = booking && booking.vendorId;
    var vendors = (DATA && DATA.sampleVendors) || [];
    return vendors.filter(function(v) { return v.id === vendorId; })[0] || preferredVendor() || {};
  }

  function appendZellePaymentPanel(booking) {
    if (!booking || String(booking.paymentMethod || '').toLowerCase() !== 'zelle') return;
    if (String(booking.paymentStatus || 'unpaid').toLowerCase() === 'paid') return;
    var transcript = document.getElementById('mbAssistantTranscript');
    if (!transcript) return;
    var vendor = bookingVendor(booking);
    var qr = String(vendor.zelleQrUrl || '').trim();
    var phone = String(vendor.zellePhone || vendor.phone || booking.zellePhone || '').trim();
    var email = String(vendor.zelleEmail || vendor.email || '').trim();
    var row = document.createElement('div');
    var panel = document.createElement('div');
    row.className = 'mb-chat-msg mb-chat-msg--ai';
    panel.className = 'mb-zelle-panel';
    var title = document.createElement('h4');
    title.textContent = t('zellePayPanelTitle');
    panel.appendChild(title);
    if (qr) {
      var img = document.createElement('img');
      img.src = qr;
      img.alt = t('zellePayPanelTitle');
      panel.appendChild(img);
    }
    var label = document.createElement('p');
    label.className = 'mb-zelle-panel__label';
    label.textContent = t('zelleSendPaymentTo');
    panel.appendChild(label);
    var value = document.createElement('p');
    value.className = 'mb-zelle-panel__value';
    value.textContent = qr ? (phone || email) : (phone || email);
    panel.appendChild(value);
    if (!qr && phone && email) {
      var emailValue = document.createElement('p');
      emailValue.className = 'mb-zelle-panel__value';
      emailValue.textContent = email;
      panel.appendChild(emailValue);
    }
    row.appendChild(panel);
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
        if (result && result.booking) appendZellePaymentPanel(result.booking);
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
    var book = el('button', 'mb-button mb-button--primary');
    var chat = el('button', 'mb-button mb-button--ghost');
    var voice = el('button', 'mb-button mb-button--ghost');

    label.textContent = t('selectedServiceLabel');
    title.textContent = serviceCopy(service, 'name') + ' · ' + formatMoney(service.price);
    book.type = 'button';
    chat.type = 'button';
    voice.type = 'button';
    book.setAttribute('data-action', 'bookSelectedService');
    chat.setAttribute('data-action', 'chatSelectedService');
    voice.setAttribute('data-action', 'voiceSelectedService');
    book.textContent = t('bookThisService');
    chat.textContent = t('chatThisService');
    voice.textContent = t('talkThisService');

    // "Book this service" → MANUAL booking form, NOT the AI assistant.
    // These three CTAs are intentionally three separate flows: manual,
    // text AI, voice AI. Do not collapse them into a shared handler.
    book.addEventListener('click', function(event) {
      event.preventDefault();
      event.stopPropagation();
      state.selectedServiceId = service.id;
      openManualBookingForm(service);
    });
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
    // Manual booking form mount point. Rendered on demand by the Book CTA;
    // hidden by default so the three-CTA row stays minimal.
    var manualMount = el('div', 'mb-manual-booking-mount');
    manualMount.id = 'mbManualBookingMount';
    manualMount.hidden = true;
    panel.appendChild(manualMount);
    panel.hidden = false;
    // Re-mount the form if the customer flipped between services while it was open.
    if (state.manualBooking && state.manualBooking.expandedServiceId === service.id) {
      openManualBookingForm(service);
    }
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
      // Selecting a service ONLY surfaces the selection panel with the three
      // CTAs (Book / Chat / Talk). It must NOT auto-open the AI assistant —
      // location is collected inside the manual booking form itself, or
      // asked by the AI assistant if the customer chooses chat/voice.
      cta.addEventListener('click', function() {
        selectService(service);
        var sel = document.getElementById('mbServiceSelection');
        if (sel && sel.scrollIntoView) {
          try { sel.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
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
    var aiFile     = document.getElementById('mbHomeAiPreviewFile');
    var aiAnalyze  = document.getElementById('mbHomeAiPreviewAnalyze');
    var aiRemove   = document.getElementById('mbHomeAiPreviewRemove');
    if (aiConsent) aiConsent.addEventListener('change', handleAiConsentChange);
    if (aiUpload)  aiUpload.addEventListener('change', handleAiUpload);
    if (aiFile)    aiFile.addEventListener('change', handleAiUpload);
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
    var expandedId = state.aiPreview.expandedStyleId || '';
    var lastSubmitted = state.aiPreview.lastSubmittedStyleId || '';
    recs.forEach(function(rec, idx) {
      var imgSrc = rec.previewDataUrl || rec.previewUrl || '';
      var styleId = rec.styleId || ('rec-' + idx);
      var card = document.createElement('article');
      card.className = 'mb-ai-rec-card';
      card.setAttribute('data-style-id', styleId);
      var isExpanded = expandedId === styleId;
      var isSubmitted = lastSubmitted === styleId;
      if (state.aiPreview.selectedStyleId === styleId) card.classList.add('mb-ai-rec-card--selected');
      if (isExpanded) card.classList.add('mb-ai-rec-card--expanded');
      if (isSubmitted) card.classList.add('mb-ai-rec-card--booked');

      var thumb = el('div', 'mb-ai-rec-card__thumb');
      var img = document.createElement('img');
      img.src = imgSrc;
      img.alt = rec.title || '';
      img.loading = 'lazy';
      thumb.appendChild(img);
      var badge = el('span', 'mb-ai-rec-card__ai-badge');
      badge.textContent = t('homeAiPreviewBadge') || 'AI suggestion';
      thumb.appendChild(badge);

      var body = el('div', 'mb-ai-rec-card__body');
      var title = el('strong', 'mb-ai-rec-card__title'); title.textContent = rec.title || '';
      var meta = el('span', 'mb-ai-rec-card__maintenance');
      if (rec.maintenance) {
        meta.textContent = (t('homeAiPreviewMaintenanceLabel') || 'Maintenance:') + ' ' + rec.maintenance;
      }
      var desc = el('p', 'mb-ai-rec-card__desc'); desc.textContent = rec.explanation || '';
      var notes = el('p', 'mb-ai-rec-card__barber-notes');
      notes.textContent = (t('homeAiPreviewBarberNotesLabel') || 'Barber notes:') + ' ' + (rec.barberNotes || '');
      body.appendChild(title);
      if (rec.maintenance) body.appendChild(meta);
      body.appendChild(desc);
      body.appendChild(notes);

      var actions = el('div', 'mb-ai-rec-card__actions');
      var bookBtn = el('button', 'mb-button mb-button--primary mb-ai-rec-card__cta');
      bookBtn.type = 'button';
      bookBtn.setAttribute('data-style-id', styleId);
      bookBtn.textContent = isExpanded
        ? (t('homeAiPreviewBookCancel') || 'Close')
        : (isSubmitted
          ? (t('homeAiPreviewBookAgain') || 'Book another time')
          : (t('homeAiPreviewBookCta') || 'Book this style'));
      bookBtn.addEventListener('click', function() {
        toggleInlineBooking(rec, imgSrc);
      });
      actions.appendChild(bookBtn);

      body.appendChild(actions);
      card.appendChild(thumb);
      card.appendChild(body);

      // Inline booking panel (only the expanded card renders it)
      if (isExpanded) {
        card.appendChild(renderInlineBookingPanel(rec, imgSrc));
      } else if (isSubmitted) {
        var success = el('div', 'mb-ai-rec-card__success');
        success.setAttribute('role', 'status');
        success.textContent = t('homeAiPreviewBookSubmitted')
          || 'Booking submitted. The barber will confirm shortly.';
        card.appendChild(success);
      }
      list.appendChild(card);
    });
    if (attach) attach.hidden = !state.aiPreview.selectedStyleId;
  }

  // ── Manual booking form (Book this service CTA) ───────────────────────
  // Mounts an inline manual booking form inside the selected-service panel.
  // Completely independent of the AI assistant; tapping Book here must
  // never open the chat or voice panel.
  function openManualBookingForm(service) {
    if (!service) return;
    var mount = document.getElementById('mbManualBookingMount');
    if (!mount) return;
    state.manualBooking.expandedServiceId = service.id;
    state.manualBooking.lastSubmissionError = '';
    mount.hidden = false;
    mount.innerHTML = '';
    mount.appendChild(renderManualBookingPanel(service));
    requestAnimationFrame(function() {
      if (mount.scrollIntoView) {
        try { mount.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
      }
      var firstInput = mount.querySelector('input,textarea,select');
      if (firstInput && firstInput.focus) { try { firstInput.focus({ preventScroll: true }); } catch (e) {} }
    });
  }

  function renderManualBookingPanel(service) {
    var panel = el('form', 'mb-manual-booking');
    panel.setAttribute('novalidate', 'novalidate');
    panel.setAttribute('data-service-id', service.id);

    var draft = state.manualBooking.formDraft || {};
    var savedLoc = readSavedLocation() || {};
    var lastBooking = state.lastBooking || {};
    var aiStyle = (state.aiPreview && state.aiPreview.selectedStyleId)
      ? (state.aiPreview.recommendations || []).filter(function(r) {
          return r && r.styleId === state.aiPreview.selectedStyleId;
        })[0] || null
      : null;
    var phonePrefill = draft.customerPhone || lastBooking.customerPhone || '';
    var namePrefill = draft.customerName || lastBooking.customerName || '';
    var addressPrefill = draft.address || lastBooking.address || '';
    var cityPrefill = draft.city || lastBooking.city || savedLoc.city || '';
    var zipPrefill = draft.zip || lastBooking.zip || savedLoc.zip || '';
    var datePrefill = draft.requestedDate || '';
    var timePrefill = draft.startTime || '';
    var notesPrefill = draft.notes || '';
    var paymentPrefill = draft.paymentMethod || lastBooking.paymentMethod || 'cash';

    var head = el('div', 'mb-manual-booking__head');
    var headTitle = el('strong');
    headTitle.textContent = t('manualBookingFormTitle') || 'Book this service';
    var headSub = el('span', 'mb-manual-booking__sub');
    headSub.textContent = t('manualBookingFormSub') || 'Quick details — the barber confirms after.';
    head.appendChild(headTitle); head.appendChild(headSub);
    panel.appendChild(head);

    // Summary of selected service so the customer keeps context.
    var summary = el('div', 'mb-manual-booking__summary');
    var summaryName = el('span', 'mb-manual-booking__summary-name');
    summaryName.textContent = serviceCopy(service, 'name');
    var summaryPrice = el('span', 'mb-manual-booking__summary-price');
    summaryPrice.textContent = formatMoney(service.price);
    summary.appendChild(summaryName);
    summary.appendChild(summaryPrice);
    panel.appendChild(summary);

    if (aiStyle) {
      var aiBadge = el('div', 'mb-manual-booking__ai-attach');
      aiBadge.innerHTML = '<strong>' + (t('manualBookingAiAttached') || 'AI hairstyle attached') + ':</strong> ' + (aiStyle.title || '');
      panel.appendChild(aiBadge);
    }

    function fieldWrap(labelText, inputNode) {
      var wrap = el('label', 'mb-manual-booking__field');
      var l = el('span'); l.textContent = labelText;
      wrap.appendChild(l); wrap.appendChild(inputNode);
      return wrap;
    }
    function mkInput(type, name, value, attrs) {
      var n = document.createElement('input');
      n.type = type; n.name = name; n.value = value || '';
      if (attrs) Object.keys(attrs).forEach(function(k) { n.setAttribute(k, attrs[k]); });
      return n;
    }

    var phone = mkInput('tel', 'customerPhone', phonePrefill, { autocomplete: 'tel', inputmode: 'tel', required: 'required', placeholder: '(714) 555-0123' });
    var name = mkInput('text', 'customerName', namePrefill, { autocomplete: 'name', required: 'required' });
    var address = mkInput('text', 'address', addressPrefill, { autocomplete: 'street-address', required: 'required' });
    var city = mkInput('text', 'city', cityPrefill, { autocomplete: 'address-level2', required: 'required' });
    var zip = mkInput('text', 'zip', zipPrefill, { autocomplete: 'postal-code', inputmode: 'numeric', required: 'required', pattern: '[0-9]{5}' });
    var date = mkInput('date', 'requestedDate', datePrefill, { required: 'required' });
    var time = mkInput('time', 'startTime', timePrefill, { required: 'required' });
    var notes = document.createElement('textarea');
    notes.name = 'notes'; notes.rows = 2; notes.value = notesPrefill;
    notes.placeholder = t('manualBookingNotesPlaceholder') || 'Anything the barber should know';

    var paymentWrap = el('fieldset', 'mb-manual-booking__payment');
    var paymentLegend = el('legend');
    paymentLegend.textContent = t('paymentChoiceLegend') || 'Preferred payment method';
    paymentWrap.appendChild(paymentLegend);
    ['cash', 'zelle'].forEach(function(method) {
      var lbl = el('label', 'mb-manual-booking__payment-option');
      var radio = document.createElement('input');
      radio.type = 'radio'; radio.name = 'paymentMethod'; radio.value = method;
      radio.checked = paymentPrefill === method;
      var span = el('span'); span.textContent = method === 'cash' ? (t('paymentCash') || 'Cash') : (t('paymentZelle') || 'Zelle');
      lbl.appendChild(radio); lbl.appendChild(span);
      paymentWrap.appendChild(lbl);
    });

    panel.appendChild(fieldWrap(t('manualBookingPhone') || 'Phone number', phone));
    panel.appendChild(fieldWrap(t('manualBookingName') || 'Your name', name));
    panel.appendChild(fieldWrap(t('manualBookingAddress') || 'Street address', address));
    var cityZipRow = el('div', 'mb-manual-booking__row');
    cityZipRow.appendChild(fieldWrap(t('manualBookingCity') || 'City', city));
    cityZipRow.appendChild(fieldWrap(t('manualBookingZip') || 'ZIP', zip));
    panel.appendChild(cityZipRow);
    var dateTimeRow = el('div', 'mb-manual-booking__row');
    dateTimeRow.appendChild(fieldWrap(t('manualBookingDate') || 'Preferred date', date));
    dateTimeRow.appendChild(fieldWrap(t('manualBookingTime') || 'Preferred time', time));
    panel.appendChild(dateTimeRow);
    panel.appendChild(fieldWrap(t('manualBookingNotes') || 'Optional notes', notes));
    panel.appendChild(paymentWrap);

    var status = el('p', 'mb-manual-booking__status');
    status.setAttribute('aria-live', 'polite');
    if (state.manualBooking.lastSubmissionError) {
      status.textContent = state.manualBooking.lastSubmissionError;
      status.classList.add('mb-manual-booking__status--error');
    }
    panel.appendChild(status);

    var actions = el('div', 'mb-manual-booking__actions');
    var submit = el('button', 'mb-button mb-button--primary mb-manual-booking__submit');
    submit.type = 'submit';
    submit.textContent = state.manualBooking.submitting
      ? (t('manualBookingSubmitting') || 'Sending…')
      : (t('manualBookingSubmit') || 'Send booking request');
    submit.disabled = !!state.manualBooking.submitting;
    var cancel = el('button', 'mb-button mb-button--ghost mb-button--sm mb-manual-booking__cancel');
    cancel.type = 'button';
    cancel.textContent = t('manualBookingCancel') || 'Cancel';
    cancel.addEventListener('click', function() {
      state.manualBooking.expandedServiceId = '';
      var mount = document.getElementById('mbManualBookingMount');
      if (mount) { mount.hidden = true; mount.innerHTML = ''; }
    });
    actions.appendChild(submit);
    actions.appendChild(cancel);
    panel.appendChild(actions);

    panel.addEventListener('input', function() {
      state.manualBooking.formDraft = readManualBookingDraft(panel);
    });

    panel.addEventListener('submit', function(event) {
      event.preventDefault();
      submitManualBooking(service, panel);
    });

    return panel;
  }

  function readManualBookingDraft(panel) {
    var get = function(name) {
      var n = panel.querySelector('[name="' + name + '"]');
      return n ? String(n.value || '').trim() : '';
    };
    var paymentNode = panel.querySelector('[name="paymentMethod"]:checked');
    return {
      customerPhone: get('customerPhone'),
      customerName: get('customerName'),
      address: get('address'),
      city: get('city'),
      zip: get('zip'),
      requestedDate: get('requestedDate'),
      startTime: get('startTime'),
      notes: get('notes'),
      paymentMethod: paymentNode ? String(paymentNode.value || 'cash') : 'cash'
    };
  }

  function submitManualBooking(service, panel) {
    if (!BOOKING || !service) return;
    if (state.manualBooking.submitting) return;
    var draft = readManualBookingDraft(panel);
    state.manualBooking.formDraft = draft;
    var statusEl = panel.querySelector('.mb-manual-booking__status');

    var required = ['customerPhone', 'customerName', 'address', 'city', 'zip', 'requestedDate', 'startTime'];
    var missing = required.filter(function(k) { return !draft[k]; });
    if (missing.length) {
      var msg = t('manualBookingMissing') || 'Please fill the required fields.';
      state.manualBooking.lastSubmissionError = msg;
      if (statusEl) { statusEl.textContent = msg; statusEl.classList.add('mb-manual-booking__status--error'); }
      return;
    }

    var addressObj = { address: draft.address, city: draft.city, zip: draft.zip };
    var vendor = BOOKING.findVendorForAddress(addressObj);
    if (!vendor) {
      var msgV = t('manualBookingNoVendor') || 'No barber covers this address yet. Try a different ZIP.';
      state.manualBooking.lastSubmissionError = msgV;
      if (statusEl) { statusEl.textContent = msgV; statusEl.classList.add('mb-manual-booking__status--error'); }
      return;
    }
    var services = DATA && typeof DATA.listServicesForVendor === 'function'
      ? DATA.listServicesForVendor(vendor.id)
      : (DATA && DATA.sampleServices) || [];
    // Use the originally-selected service if the vendor offers it, otherwise
    // fall back to the vendor's matching service or the first one.
    var resolvedService = services.filter(function(s) { return s && s.id === service.id; })[0]
      || services.filter(function(s) { return s && s.name === service.name; })[0]
      || services[0];
    if (!resolvedService) {
      var msgS = t('manualBookingNoService') || 'No service available for this barber right now.';
      state.manualBooking.lastSubmissionError = msgS;
      if (statusEl) { statusEl.textContent = msgS; statusEl.classList.add('mb-manual-booking__status--error'); }
      return;
    }
    var availability = (DATA && DATA.sampleAvailability) || [];

    state.manualBooking.submitting = true;
    if (statusEl) {
      statusEl.classList.remove('mb-manual-booking__status--error');
      statusEl.textContent = t('manualBookingSubmitting') || 'Sending…';
    }
    var submitBtn = panel.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    // Optional AI hairstyle attachment — same canonical contract as the
    // inline-from-AI-card flow. Only attached when the customer has
    // actually selected an AI preview earlier on the page.
    var aiAttachments = {};
    var aiSel = (state.aiPreview && state.aiPreview.selectedStyleId) ? state.aiPreview : null;
    if (aiSel && aiSel.selectedStyleId) {
      var rec = (aiSel.recommendations || []).filter(function(r) {
        return r && r.styleId === aiSel.selectedStyleId;
      })[0] || null;
      aiAttachments = {
        selfieDataUrl: aiSel.selfieDataUrl || '',
        aiAnalysisSummary: aiSel.summary || '',
        aiAnalysisConsent: aiSel.consent ? 'true' : 'false',
        recommendedStyles: (aiSel.recommendations || []).map(function(r) {
          return {
            styleId: r.styleId || '',
            title: r.title || '',
            explanation: r.explanation || '',
            maintenance: r.maintenance || '',
            barberNotes: r.barberNotes || ''
          };
        }),
        selectedAiStyleId: aiSel.selectedStyleId,
        selectedAiStyleName: rec ? rec.title || '' : '',
        selectedAiStyleImage: aiSel.selectedStylePreviewUrl || '',
        selectedAiStyleDescription: rec ? rec.explanation || '' : '',
        selectedAiBarberNotes: rec ? rec.barberNotes || '' : '',
        selectedAiMaintenanceLevel: rec ? rec.maintenance || '' : ''
      };
    }

    var finalDraft = Object.assign({
      customerEmail: '',
      serviceId: resolvedService.id,
      smsOptIn: false,
      confirmationPreference: 'text',
      source: 'customer_form'
    }, draft, aiAttachments);

    BOOKING.loadExistingBookings(vendor.id)
      .catch(function() { return []; })
      .then(function(existing) {
        var avail = BOOKING.checkAvailability({
          vendor: vendor,
          services: services,
          availability: availability,
          draft: finalDraft,
          existingBookings: existing,
          now: new Date()
        });
        if (!avail || !avail.canCreate) {
          throw new Error(avail && avail.key ? avail.key : 'unavailable');
        }
        var built = BOOKING.buildBooking({ vendor: vendor, draft: finalDraft, availabilityResult: avail });
        if (!built || !built.valid) {
          throw new Error((built && built.errors && built.errors.join(', ')) || 'invalid_booking');
        }
        built.booking.source = 'customer_form';
        return BOOKING.saveBooking(built.booking, { requireDatabase: true });
      })
      .then(function(saved) {
        state.manualBooking.submitting = false;
        state.lastBooking = saved.booking;
        state.manualBooking.lastSubmittedServiceId = service.id;
        state.manualBooking.expandedServiceId = '';
        state.manualBooking.lastSubmissionError = '';
        if (draft.city || draft.zip) saveCustomerLocation({ city: draft.city, zip: draft.zip });
        var mount = document.getElementById('mbManualBookingMount');
        if (mount) {
          mount.innerHTML = '';
          var success = el('div', 'mb-manual-booking__success');
          success.setAttribute('role', 'status');
          success.textContent = t('manualBookingSuccess') || 'Booking sent. The barber will confirm shortly.';
          mount.appendChild(success);
        }
      })
      .catch(function(error) {
        state.manualBooking.submitting = false;
        var rawMessage = (error && error.message) || 'submit_failed';
        var human = manualBookingErrorMessage(rawMessage);
        state.manualBooking.lastSubmissionError = human;
        if (statusEl) {
          statusEl.textContent = human;
          statusEl.classList.add('mb-manual-booking__status--error');
        }
        if (submitBtn) submitBtn.disabled = false;
        if (root.console) root.console.error('[mobile-barber] manual booking failed', rawMessage);
      });
  }

  function manualBookingErrorMessage(key) {
    var map = {
      service_area_out_of_range: t('manualBookingNoVendor') || 'No barber covers this address yet.',
      blackout_date: t('manualBookingBlackout') || 'That date is unavailable. Please pick another.',
      closed_day: t('manualBookingClosed') || 'The barber is closed that day. Please pick another.',
      outside_hours: t('manualBookingOutsideHours') || 'That time is outside the barber’s hours.',
      same_day_cutoff: t('manualBookingCutoff') || 'Too close to your time. Please pick a later slot.',
      booking_overlap: t('manualBookingOverlap') || 'That slot was just taken. Please pick another.',
      service_missing: t('manualBookingNoService') || 'No service available for this barber right now.'
    };
    return map[key] || (t('manualBookingGeneric') || 'Could not send the booking. Please try again.');
  }

  // Toggle the inline booking panel under an AI hairstyle card.
  function toggleInlineBooking(rec, fullDataUrl) {
    var styleId = rec.styleId || '';
    if (state.aiPreview.expandedStyleId === styleId) {
      state.aiPreview.expandedStyleId = '';
      renderAiResults();
      return;
    }
    // Selecting a style for booking also marks it as the selected style for
    // the legacy chat-attach flow, so behaviour is consistent if the customer
    // later sends through chat instead of submitting the inline form.
    handleAiSelect(rec, fullDataUrl);
    state.aiPreview.expandedStyleId = styleId;
    state.aiPreview.lastSubmissionError = '';
    renderAiResults();
    // Scroll the panel into view on mobile so the form is in the thumb zone.
    requestAnimationFrame(function() {
      var card = document.querySelector('.mb-ai-rec-card--expanded');
      if (card && card.scrollIntoView) {
        try { card.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
      }
    });
  }

  function renderInlineBookingPanel(rec, fullDataUrl) {
    var styleId = rec.styleId || '';
    var panel = el('form', 'mb-ai-rec-card__booking');
    panel.setAttribute('data-style-id', styleId);
    panel.setAttribute('novalidate', 'novalidate');
    var draft = state.aiPreview.formDrafts[styleId] || {};
    var savedLoc = readSavedLocation() || {};
    var lastBooking = state.lastBooking || {};
    var phonePrefill = draft.customerPhone || lastBooking.customerPhone || '';
    var namePrefill = draft.customerName || lastBooking.customerName || '';
    var addressPrefill = draft.address || lastBooking.address || '';
    var cityPrefill = draft.city || lastBooking.city || savedLoc.city || '';
    var zipPrefill = draft.zip || lastBooking.zip || savedLoc.zip || '';
    var datePrefill = draft.requestedDate || '';
    var timePrefill = draft.startTime || '';
    var notesPrefill = draft.notes || '';
    var paymentPrefill = draft.paymentMethod || lastBooking.paymentMethod || 'cash';

    var head = el('div', 'mb-ai-rec-card__booking-head');
    var headTitle = el('strong'); headTitle.textContent = t('homeAiPreviewBookFormTitle') || 'Book this style';
    var headSub = el('span', 'mb-ai-rec-card__booking-sub');
    headSub.textContent = t('homeAiPreviewBookFormSub') || 'Quick details — the barber confirms after.';
    head.appendChild(headTitle); head.appendChild(headSub);
    panel.appendChild(head);

    function field(labelText, input) {
      var wrap = el('label', 'mb-ai-rec-card__field');
      var l = el('span'); l.textContent = labelText;
      wrap.appendChild(l); wrap.appendChild(input);
      return wrap;
    }
    function input(type, name, value, attrs) {
      var n = document.createElement('input');
      n.type = type; n.name = name; n.value = value || '';
      if (attrs) Object.keys(attrs).forEach(function(k) { n.setAttribute(k, attrs[k]); });
      return n;
    }

    var phone = input('tel', 'customerPhone', phonePrefill, { autocomplete: 'tel', inputmode: 'tel', required: 'required', placeholder: '(714) 555-0123' });
    var name = input('text', 'customerName', namePrefill, { autocomplete: 'name', required: 'required' });
    var address = input('text', 'address', addressPrefill, { autocomplete: 'street-address', required: 'required' });
    var city = input('text', 'city', cityPrefill, { autocomplete: 'address-level2', required: 'required' });
    var zip = input('text', 'zip', zipPrefill, { autocomplete: 'postal-code', inputmode: 'numeric', required: 'required', pattern: '[0-9]{5}' });
    var date = input('date', 'requestedDate', datePrefill, { required: 'required' });
    var time = input('time', 'startTime', timePrefill, { required: 'required' });
    var notes = document.createElement('textarea');
    notes.name = 'notes'; notes.rows = 2; notes.value = notesPrefill;
    notes.placeholder = t('homeAiPreviewBookNotesPlaceholder') || 'Anything the barber should know';

    var paymentWrap = el('fieldset', 'mb-ai-rec-card__payment');
    var paymentLegend = el('legend'); paymentLegend.textContent = t('paymentChoiceLegend') || 'Preferred payment method';
    paymentWrap.appendChild(paymentLegend);
    ['cash', 'zelle'].forEach(function(method) {
      var lbl = el('label', 'mb-ai-rec-card__payment-option');
      var radio = document.createElement('input');
      radio.type = 'radio'; radio.name = 'paymentMethod'; radio.value = method;
      radio.checked = paymentPrefill === method;
      var span = el('span'); span.textContent = method === 'cash' ? (t('paymentCash') || 'Cash') : (t('paymentZelle') || 'Zelle');
      lbl.appendChild(radio); lbl.appendChild(span);
      paymentWrap.appendChild(lbl);
    });

    panel.appendChild(field(t('homeAiPreviewBookPhone') || 'Phone number', phone));
    panel.appendChild(field(t('homeAiPreviewBookName') || 'Your name', name));
    panel.appendChild(field(t('homeAiPreviewBookAddress') || 'Street address', address));
    var cityZipRow = el('div', 'mb-ai-rec-card__row');
    cityZipRow.appendChild(field(t('homeAiPreviewBookCity') || 'City', city));
    cityZipRow.appendChild(field(t('homeAiPreviewBookZip') || 'ZIP', zip));
    panel.appendChild(cityZipRow);
    var dateTimeRow = el('div', 'mb-ai-rec-card__row');
    dateTimeRow.appendChild(field(t('homeAiPreviewBookDate') || 'Preferred date', date));
    dateTimeRow.appendChild(field(t('homeAiPreviewBookTime') || 'Preferred time', time));
    panel.appendChild(dateTimeRow);
    panel.appendChild(field(t('homeAiPreviewBookNotes') || 'Optional notes', notes));
    panel.appendChild(paymentWrap);

    var status = el('p', 'mb-ai-rec-card__booking-status');
    status.setAttribute('aria-live', 'polite');
    status.id = 'mbAiBookStatus-' + styleId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (state.aiPreview.lastSubmissionError) {
      status.textContent = state.aiPreview.lastSubmissionError;
      status.classList.add('mb-ai-rec-card__booking-status--error');
    }
    panel.appendChild(status);

    var submitRow = el('div', 'mb-ai-rec-card__booking-actions');
    var submit = el('button', 'mb-button mb-button--primary mb-ai-rec-card__submit');
    submit.type = 'submit';
    submit.textContent = state.aiPreview.submitting
      ? (t('homeAiPreviewBookSubmitting') || 'Sending…')
      : (t('homeAiPreviewBookSubmit') || 'Send booking request');
    submit.disabled = !!state.aiPreview.submitting;
    submitRow.appendChild(submit);
    panel.appendChild(submitRow);

    // Persist user input back to formDrafts as they type so re-renders don't wipe it
    panel.addEventListener('input', function() {
      state.aiPreview.formDrafts[styleId] = readInlineFormDraft(panel);
    });

    panel.addEventListener('submit', function(event) {
      event.preventDefault();
      submitInlineStyleBooking(rec, fullDataUrl, panel);
    });

    return panel;
  }

  function readInlineFormDraft(panel) {
    var get = function(name) {
      var n = panel.querySelector('[name="' + name + '"]');
      return n ? String(n.value || '').trim() : '';
    };
    var paymentNode = panel.querySelector('[name="paymentMethod"]:checked');
    return {
      customerPhone: get('customerPhone'),
      customerName: get('customerName'),
      address: get('address'),
      city: get('city'),
      zip: get('zip'),
      requestedDate: get('requestedDate'),
      startTime: get('startTime'),
      notes: get('notes'),
      paymentMethod: paymentNode ? String(paymentNode.value || 'cash') : 'cash'
    };
  }

  function submitInlineStyleBooking(rec, fullDataUrl, panel) {
    if (!BOOKING) return;
    if (state.aiPreview.submitting) return;
    var styleId = rec.styleId || '';
    var draft = readInlineFormDraft(panel);
    state.aiPreview.formDrafts[styleId] = draft;
    var statusEl = panel.querySelector('.mb-ai-rec-card__booking-status');

    // Required-field guard (mirrors the legacy customer form so we can give
    // a friendly message before hitting BOOKING.checkAvailability).
    var required = ['customerPhone', 'customerName', 'address', 'city', 'zip', 'requestedDate', 'startTime'];
    var missing = required.filter(function(k) { return !draft[k]; });
    if (missing.length) {
      var msg = t('homeAiPreviewBookMissing') || 'Please fill the highlighted fields.';
      state.aiPreview.lastSubmissionError = msg;
      if (statusEl) { statusEl.textContent = msg; statusEl.classList.add('mb-ai-rec-card__booking-status--error'); }
      return;
    }
    // Find the right vendor by service area
    var addressObj = { address: draft.address, city: draft.city, zip: draft.zip };
    var vendor = BOOKING.findVendorForAddress(addressObj);
    if (!vendor) {
      var msgV = t('homeAiPreviewBookNoVendor') || 'No barber covers this address yet. Try a different ZIP.';
      state.aiPreview.lastSubmissionError = msgV;
      if (statusEl) { statusEl.textContent = msgV; statusEl.classList.add('mb-ai-rec-card__booking-status--error'); }
      return;
    }
    var services = DATA && typeof DATA.listServicesForVendor === 'function'
      ? DATA.listServicesForVendor(vendor.id)
      : (DATA && DATA.sampleServices) || [];
    var service = services.filter(function(s) { return s && s.id === state.selectedServiceId; })[0] || services[0];
    if (!service) {
      var msgS = t('homeAiPreviewBookNoService') || 'No service available for this barber right now.';
      state.aiPreview.lastSubmissionError = msgS;
      if (statusEl) { statusEl.textContent = msgS; statusEl.classList.add('mb-ai-rec-card__booking-status--error'); }
      return;
    }
    var availability = (DATA && DATA.sampleAvailability) || [];

    state.aiPreview.submitting = true;
    if (statusEl) {
      statusEl.classList.remove('mb-ai-rec-card__booking-status--error');
      statusEl.textContent = t('homeAiPreviewBookSubmitting') || 'Sending…';
    }
    var submitBtn = panel.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    // Build the AI-style draft once so both the chat-attach and direct paths
    // see the same canonical reference.
    var aiAttachments = {
      selfieDataUrl: state.aiPreview.selfieDataUrl || '',
      aiAnalysisSummary: state.aiPreview.summary || '',
      aiAnalysisConsent: state.aiPreview.consent ? 'true' : 'false',
      recommendedStyles: (state.aiPreview.recommendations || []).map(function(r) {
        return {
          styleId: r.styleId || '',
          title: r.title || '',
          explanation: r.explanation || '',
          maintenance: r.maintenance || '',
          barberNotes: r.barberNotes || ''
        };
      }),
      selectedAiStyleId: styleId,
      selectedAiStyleName: rec.title || '',
      selectedAiStyleImage: state.aiPreview.selectedStylePreviewUrl || fullDataUrl || '',
      selectedAiStyleDescription: rec.explanation || '',
      selectedAiBarberNotes: rec.barberNotes || '',
      selectedAiMaintenanceLevel: rec.maintenance || ''
    };

    var finalDraft = Object.assign({
      customerEmail: '',
      serviceId: service.id,
      smsOptIn: false,
      confirmationPreference: 'text',
      source: 'customer_form'
    }, draft, aiAttachments);

    BOOKING.loadExistingBookings(vendor.id)
      .catch(function() { return []; })
      .then(function(existing) {
        var avail = BOOKING.checkAvailability({
          vendor: vendor,
          services: services,
          availability: availability,
          draft: finalDraft,
          existingBookings: existing,
          now: new Date()
        });
        if (!avail || !avail.canCreate) {
          throw new Error(avail && avail.key ? avail.key : 'unavailable');
        }
        var built = BOOKING.buildBooking({ vendor: vendor, draft: finalDraft, availabilityResult: avail });
        if (!built || !built.valid) {
          throw new Error((built && built.errors && built.errors.join(', ')) || 'invalid_booking');
        }
        built.booking.source = 'customer_form';
        return BOOKING.saveBooking(built.booking, { requireDatabase: true });
      })
      .then(function(saved) {
        state.aiPreview.submitting = false;
        state.lastBooking = saved.booking;
        state.aiPreview.lastSubmittedStyleId = styleId;
        state.aiPreview.expandedStyleId = '';
        state.aiPreview.lastSubmissionError = '';
        // Persist customer location for next session
        if (draft.city || draft.zip) saveCustomerLocation({ city: draft.city, zip: draft.zip });
        renderAiResults();
        setAiStatus(t('homeAiPreviewBookSuccess') || 'Booking sent. The barber will confirm shortly.');
      })
      .catch(function(error) {
        state.aiPreview.submitting = false;
        var rawMessage = (error && error.message) || 'submit_failed';
        var human = inlineBookingErrorMessage(rawMessage);
        state.aiPreview.lastSubmissionError = human;
        if (statusEl) {
          statusEl.textContent = human;
          statusEl.classList.add('mb-ai-rec-card__booking-status--error');
        }
        if (submitBtn) submitBtn.disabled = false;
        if (root.console) root.console.error('[mobile-barber] inline AI booking failed', rawMessage);
      });
  }

  function inlineBookingErrorMessage(key) {
    var map = {
      service_area_out_of_range: t('homeAiPreviewBookNoVendor') || 'No barber covers this address yet.',
      blackout_date: t('homeAiPreviewBookBlackout') || 'That date is unavailable. Please pick another.',
      closed_day: t('homeAiPreviewBookClosed') || 'The barber is closed that day. Please pick another.',
      outside_hours: t('homeAiPreviewBookOutsideHours') || 'That time is outside the barber’s hours.',
      same_day_cutoff: t('homeAiPreviewBookCutoff') || 'Too close to your time. Please pick a later slot.',
      booking_overlap: t('homeAiPreviewBookOverlap') || 'That slot was just taken. Please pick another.',
      service_missing: t('homeAiPreviewBookNoService') || 'No service available for this barber right now.'
    };
    return map[key] || (t('homeAiPreviewBookGeneric') || 'Could not send the booking. Please try again.');
  }

  function handleAiConsentChange() {
    var checkbox = document.getElementById('mbHomeAiPreviewConsent');
    // After the split-source refactor: gallery + camera inputs live inside
    // a <fieldset disabled> that we toggle. Fall back to the legacy single
    // input ID if it's still present anywhere.
    var fieldset = document.getElementById('mbHomeAiPreviewSourceFieldset');
    var fileInput = document.getElementById('mbHomeAiPreviewFile');
    var legacyUpload = document.getElementById('mbHomeAiPreviewUpload');
    var analyze  = document.getElementById('mbHomeAiPreviewAnalyze');
    state.aiPreview.consent = !!(checkbox && checkbox.checked);
    if (fieldset)     fieldset.disabled = !state.aiPreview.consent;
    if (fileInput)    fileInput.disabled = !state.aiPreview.consent;
    if (legacyUpload) legacyUpload.disabled = !state.aiPreview.consent;
    if (analyze)      analyze.disabled = !state.aiPreview.consent || !state.aiPreview.selfieDataUrl;
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
    state.aiPreview.expandedStyleId = '';
    state.aiPreview.lastSubmittedStyleId = '';
    state.aiPreview.lastSubmissionError = '';
    state.aiPreview.submitting = false;
    state.aiPreview.formDrafts = {};
    ['mbHomeAiPreviewUpload', 'mbHomeAiPreviewFile'].forEach(function(id) {
      var node = document.getElementById(id);
      if (node) node.value = '';
    });
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
    // Mirror the canonical AI-style reference fields so the vendor portal
    // can render the hairstyle reference uniformly regardless of which path
    // submitted the booking (inline form vs chat agent).
    var selectedRec = (ai.recommendations || []).filter(function(r) {
      return r && r.styleId === ai.selectedStyleId;
    })[0];
    booking.selectedAiStyleId = ai.selectedStyleId || '';
    booking.selectedAiStyleImage = ai.selectedStylePreviewUrl || '';
    booking.selectedAiStyleName = (selectedRec && selectedRec.title) || '';
    booking.selectedAiStyleDescription = (selectedRec && selectedRec.explanation) || '';
    booking.selectedAiBarberNotes = (selectedRec && selectedRec.barberNotes) || '';
    booking.selectedAiMaintenanceLevel = (selectedRec && selectedRec.maintenance) || '';
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
    renderHeroPromoSpotlight();
    applyRegionDeepLink();
  }

  // ── Hero promo spotlight ───────────────────────────────────────────────
  // Walks every active mobile-barber vendor and finds the best active promo
  // to feature in the hero. Priority: highest discountPercent, then nearest
  // expiration. If none → hide the slot. If 2+ → rotate every 7s.
  function collectActiveCustomerPromos() {
    var vendors = (DATA && DATA.sampleVendors) ? DATA.sampleVendors : [];
    var now = new Date();
    var iso = now.toISOString().slice(0, 10);
    var promos = [];
    vendors.forEach(function(vendor) {
      if (!vendor || vendor.active === false) return;
      var list = Array.isArray(vendor.promotions) ? vendor.promotions : [];
      list.forEach(function(p) {
        if (!p || p.active !== true) return;
        if (p.displayOnCustomerPage === false) return;
        if (p.startDate && iso < p.startDate) return;
        if (p.endDate && iso > p.endDate) return;
        var max = Number(p.maxRedemptions || 0);
        var cur = Number(p.currentRedemptions || 0);
        if (max > 0 && cur >= max) return;
        promos.push(Object.assign({}, p, {
          vendorBarberName: vendor.barberName || vendor.businessName || ''
        }));
      });
    });
    // Highest discount first, then nearest expiration (earliest endDate),
    // then quickest to sell out (max-cur ratio).
    promos.sort(function(a, b) {
      var pctDiff = Number(b.discountPercent || 0) - Number(a.discountPercent || 0);
      if (pctDiff !== 0) return pctDiff;
      var aEnd = a.endDate || '9999-12-31';
      var bEnd = b.endDate || '9999-12-31';
      if (aEnd !== bEnd) return aEnd < bEnd ? -1 : 1;
      return 0;
    });
    return promos;
  }

  function _heroPromoCardHtml(promo, idx) {
    var pctTxt = Number(promo.discountPercent || 0) + '%';
    var serviceLabel = promo.applyToScope === 'selected'
      ? interpolate(t('heroPromoSelectedServices') || 'on selected services', {})
      : (t('heroPromoAllServices') || 'on all services');
    var rangeBits = [];
    if (promo.startDate || promo.endDate) {
      rangeBits.push((promo.endDate
        ? interpolate(t('heroPromoUntil') || 'Through {date}', { date: promo.endDate })
        : interpolate(t('heroPromoFrom') || 'From {date}', { date: promo.startDate })));
    }
    if (promo.maxRedemptions && Number(promo.maxRedemptions) > 0) {
      var left = Math.max(0, Number(promo.maxRedemptions) - Number(promo.currentRedemptions || 0));
      rangeBits.push(interpolate(t('heroPromoSpotsLeft') || 'Only {n} discounted slots left', { n: left }));
    }
    var meta = rangeBits.join(' · ');
    return '<div class="mb-hero__promo-card" data-idx="' + idx + '">' +
      '<div class="mb-hero__promo-badge">🔥 ' + pctTxt + ' ' + (t('heroPromoBadgeOff') || 'OFF') + '</div>' +
      '<div class="mb-hero__promo-title">' + (promo.name || '') + '</div>' +
      '<div class="mb-hero__promo-meta">' + serviceLabel + (promo.vendorBarberName ? ' · ' + promo.vendorBarberName : '') + '</div>' +
      (meta ? '<div class="mb-hero__promo-meta">' + meta + '</div>' : '') +
      (promo.description ? '<div class="mb-hero__promo-desc">' + promo.description + '</div>' : '') +
      '<button class="mb-button mb-button--primary mb-button--sm mb-hero__promo-cta" type="button" data-action="chat">' +
      (t('heroPromoCta') || 'Book this discount') + '</button>' +
    '</div>';
  }

  var _heroPromoRotateTimer = null;
  function renderHeroPromoSpotlight() {
    var node = document.getElementById('mbHeroPromo');
    if (!node) return;
    var promos = collectActiveCustomerPromos();
    if (_heroPromoRotateTimer) { clearInterval(_heroPromoRotateTimer); _heroPromoRotateTimer = null; }
    if (!promos.length) {
      node.hidden = true;
      node.innerHTML = '';
      return;
    }
    node.hidden = false;
    node.innerHTML = promos.map(_heroPromoCardHtml).join('');
    // Wire CTA(s) to open chat.
    node.querySelectorAll('[data-action="chat"]').forEach(function(btn) {
      btn.addEventListener('click', function() { openAssistantPanel('general'); });
    });
    // If more than one promo, rotate every 7s by hiding all but the active one.
    if (promos.length > 1) {
      var cards = node.querySelectorAll('.mb-hero__promo-card');
      cards.forEach(function(c, i) { c.classList.toggle('mb-hero__promo-card--visible', i === 0); });
      var active = 0;
      _heroPromoRotateTimer = setInterval(function() {
        cards[active].classList.remove('mb-hero__promo-card--visible');
        active = (active + 1) % cards.length;
        cards[active].classList.add('mb-hero__promo-card--visible');
      }, 7000);
    } else {
      var only = node.querySelector('.mb-hero__promo-card');
      if (only) only.classList.add('mb-hero__promo-card--visible');
    }
  }
  // Expose for tests + manual triggering after vendor updates.
  if (typeof window !== 'undefined') {
    window._mbRenderHeroPromoSpotlight = renderHeroPromoSpotlight;
    window._mbCollectActiveCustomerPromos = collectActiveCustomerPromos;
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
