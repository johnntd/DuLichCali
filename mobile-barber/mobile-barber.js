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
      promoKicker: 'AI haircut previews',
      promoTitle: 'See Your Next Hairstyle Before You Book',
      promoCopy: 'AI-generated haircut previews personalized for every style — fade, taper, beard trim, kids, business, senior, line up, and family package.',
      promoCta: 'Book an in-home haircut today',
      convenienceKicker: 'Convenience',
      convenienceTitle: 'Mobile Haircut Convenience',
      heroShowcaseFadeTitle: 'Fade at home',
      heroShowcaseFadeCopy:  'Fresh fade setup, cleanup, and finish — no waiting room.',
      heroShowcaseFadeCta:   'Book a fade',
      heroShowcaseFamilyTitle: 'Family haircut stop',
      heroShowcaseFamilyCopy:  'One mobile visit covers kids, seniors, and parents.',
      heroShowcaseFamilyCta:   'Book family visit',
      heroShowcaseHotelTitle: 'Hotel-ready grooming',
      heroShowcaseHotelCopy:  'Business cut and beard detail before meetings or events.',
      heroShowcaseHotelCta:   'Book business cut',
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
      priceUnavailable: 'Price unavailable',
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
      homeAiPreviewTitle: 'See yourself in 5 AI hairstyle previews',
      homeAiPreviewIntro: "For men, women, and children. Upload a selfie, tell us who it's for and what to explore, and the AI generates 5 photorealistic previews of YOUR face with hairstyles matched to you. Pick one and we'll attach it to your booking so the barber knows exactly what you want.",
      homeAiPreviewWhoForLabel: 'Who is this style for?',
      homeAiPreviewAudienceMan: 'Man',
      homeAiPreviewAudienceWoman: 'Woman',
      homeAiPreviewAudienceChild: 'Child',
      homeAiPreviewAudienceNeutral: 'No preference',
      homeAiPreviewExploreLabel: 'What do you want to explore?',
      homeAiPreviewExploreHaircut: 'Haircut',
      homeAiPreviewExploreColor: 'Hair color',
      homeAiPreviewExploreHighlights: 'Highlights',
      homeAiPreviewExploreCurly: 'Curly style',
      homeAiPreviewExploreStraight: 'Straight style',
      homeAiPreviewVibeLabel: 'Style preference',
      homeAiPreviewVibeProfessional: 'Professional',
      homeAiPreviewVibeTrendy: 'Trendy',
      homeAiPreviewVibeLowMaintenance: 'Low maintenance',
      homeAiPreviewVibeNatural: 'Natural',
      homeAiPreviewVibeBold: 'Bold',
      homeAiPreviewAudienceLabel: 'For:',
      homeAiPreviewColorLabel: 'Color:',
      homeAiPreviewHighlightLabel: 'Highlights:',
      homeAiPreviewTextureLabel: 'Texture:',
      homeAiPreviewWhyLabel: 'Why it fits:',
      homeAiPreviewSafetyLabel: 'Note:',
      homeAiPreviewInspirationWarning: 'Style inspiration — your real result may differ.',
      lightboxOpen: 'Enlarge',
      lightboxClose: 'Close',
      lightboxLabel: 'Enlarged preview',
      lightboxHint: 'AI preview — final result may vary. Tap outside to close.',
      homeAiPreviewConsent: 'I agree the AI may use my selfie to generate haircut previews. The image is shared only with my assigned barber and is never used for marketing.',
      homeAiPreviewUploadLabel: 'Add a selfie (face + hair visible, good light)',
      homeAiPreviewAddPhoto: 'Add a photo or selfie',
      homeAiPreviewAddPhotoHint: "Your phone will let you take a new selfie or pick one from your library.",
      homeAiPreviewChooseFile: 'Choose from gallery',
      homeAiPreviewTakeSelfie: 'Take a selfie',
      homeAiPreviewAnalyze: 'Get 5 AI hairstyle previews',
      homeAiPreviewRemove: 'Remove selfie',
      homeAiPreviewDisclosure: 'AI previews are suggestions only — final result may differ. Your selfie stays on this booking and is only shown to the assigned barber.',
      homeAiPreviewBadge: 'AI suggestion',
      homeAiPreviewBarberNotesLabel: 'Barber notes:',
      homeAiPreviewSelfieAlt: 'Your selfie preview',
      homeAiPreviewConsentRequired: 'Please tick the consent box first.',
      homeAiPreviewCompressing: 'Preparing image…',
      homeAiPreviewCompressFailed: 'Could not read that photo. Try a different one.',
      homeAiPreviewReady: 'Ready. Tap "Get 3 AI hairstyle previews".',
      homeAiPreviewAnalyzing: 'Analyzing your photo and generating 5 previews… this can take ~15-20 seconds.',
      homeAiPreviewDone: '5 previews ready. Pick one to attach to your booking, or scroll past.',
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
      manualBookingHelpLabel: 'Need help?',
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
      preferredBarberNotAvailable: "{name} doesn't cover {city}. Would you like the next available barber?"
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
      promoKicker: 'Hình AI xem trước',
      promoTitle: 'Xem trước kiểu tóc trước khi đặt',
      promoCopy: 'Hình kiểu tóc do AI tạo cho từng phong cách — fade, taper, tỉa râu, trẻ em, công sở, người lớn tuổi, line up, và gói gia đình.',
      promoCta: 'Đặt lịch cắt tóc tại nhà hôm nay',
      convenienceKicker: 'Tiện lợi',
      convenienceTitle: 'Sự tiện lợi của cắt tóc lưu động',
      heroShowcaseFadeTitle: 'Fade tại nhà',
      heroShowcaseFadeCopy:  'Cắt fade gọn gàng tại nhà, không cần ra tiệm.',
      heroShowcaseFadeCta:   'Đặt cắt fade',
      heroShowcaseFamilyTitle: 'Cắt cả nhà một lần',
      heroShowcaseFamilyCopy:  'Một chuyến thợ tới nhà phục vụ cả trẻ em, người lớn tuổi và cha mẹ.',
      heroShowcaseFamilyCta:   'Đặt cắt cả nhà',
      heroShowcaseHotelTitle: 'Chỉnh chu trước buổi họp',
      heroShowcaseHotelCopy:  'Cắt tóc + tỉa râu trước cuộc họp hoặc sự kiện quan trọng.',
      heroShowcaseHotelCta:   'Đặt kiểu công sở',
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
      priceUnavailable: 'Giá đang cập nhật',
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
      homeAiPreviewTitle: 'Xem chính bạn trong 5 kiểu tóc do AI tạo',
      homeAiPreviewIntro: 'Dành cho nam, nữ và trẻ em. Tải ảnh selfie, cho biết kiểu này dành cho ai và muốn thử gì, AI sẽ tạo 5 hình xem trước chân thực trên KHUÔN MẶT của bạn với các kiểu tóc phù hợp. Chọn một kiểu và tụi em sẽ đính kèm vào lịch hẹn để thợ biết chính xác bạn muốn gì.',
      homeAiPreviewWhoForLabel: 'Kiểu tóc này dành cho ai?',
      homeAiPreviewAudienceMan: 'Nam',
      homeAiPreviewAudienceWoman: 'Nữ',
      homeAiPreviewAudienceChild: 'Trẻ em',
      homeAiPreviewAudienceNeutral: 'Không xác định',
      homeAiPreviewExploreLabel: 'Bạn muốn thử gì?',
      homeAiPreviewExploreHaircut: 'Cắt tóc',
      homeAiPreviewExploreColor: 'Nhuộm màu',
      homeAiPreviewExploreHighlights: 'Highlight',
      homeAiPreviewExploreCurly: 'Kiểu xoăn',
      homeAiPreviewExploreStraight: 'Kiểu thẳng',
      homeAiPreviewVibeLabel: 'Phong cách mong muốn',
      homeAiPreviewVibeProfessional: 'Lịch sự',
      homeAiPreviewVibeTrendy: 'Thời thượng',
      homeAiPreviewVibeLowMaintenance: 'Dễ chăm sóc',
      homeAiPreviewVibeNatural: 'Tự nhiên',
      homeAiPreviewVibeBold: 'Nổi bật',
      homeAiPreviewAudienceLabel: 'Dành cho:',
      homeAiPreviewColorLabel: 'Màu tóc:',
      homeAiPreviewHighlightLabel: 'Highlight:',
      homeAiPreviewTextureLabel: 'Kết cấu:',
      homeAiPreviewWhyLabel: 'Vì sao hợp:',
      homeAiPreviewSafetyLabel: 'Lưu ý:',
      homeAiPreviewInspirationWarning: 'Hình tham khảo — kết quả thật có thể khác.',
      lightboxOpen: 'Phóng to',
      lightboxClose: 'Đóng',
      lightboxLabel: 'Xem phóng to',
      lightboxHint: 'Hình AI — kết quả thật có thể khác. Chạm bên ngoài để đóng.',
      homeAiPreviewConsent: 'Tôi đồng ý cho AI dùng ảnh selfie để tạo hình xem trước kiểu tóc. Ảnh chỉ chia sẻ với thợ phụ trách và không dùng cho mục đích quảng cáo.',
      homeAiPreviewUploadLabel: 'Thêm ảnh selfie (thấy rõ mặt và tóc, đủ sáng)',
      homeAiPreviewAddPhoto: 'Thêm ảnh hoặc selfie',
      homeAiPreviewAddPhotoHint: 'Điện thoại sẽ cho bạn chụp selfie mới hoặc chọn từ thư viện.',
      homeAiPreviewChooseFile: 'Chọn từ thư viện',
      homeAiPreviewTakeSelfie: 'Chụp ảnh selfie',
      homeAiPreviewAnalyze: 'Lấy 5 hình xem trước kiểu tóc từ AI',
      homeAiPreviewRemove: 'Xóa selfie',
      homeAiPreviewDisclosure: 'Hình AI chỉ mang tính tham khảo — kết quả thực tế có thể khác. Selfie chỉ lưu trên lịch hẹn này và chỉ thợ phụ trách xem được.',
      homeAiPreviewBadge: 'Gợi ý AI',
      homeAiPreviewBarberNotesLabel: 'Ghi chú cho thợ:',
      homeAiPreviewSelfieAlt: 'Ảnh selfie của bạn',
      homeAiPreviewConsentRequired: 'Vui lòng đồng ý điều khoản AI trước.',
      homeAiPreviewCompressing: 'Đang chuẩn bị ảnh…',
      homeAiPreviewCompressFailed: 'Không đọc được ảnh đó. Vui lòng thử ảnh khác.',
      homeAiPreviewReady: 'Sẵn sàng. Nhấn "Lấy 3 hình xem trước".',
      homeAiPreviewAnalyzing: 'Đang phân tích ảnh và tạo 5 hình xem trước… mất khoảng 15-20 giây.',
      homeAiPreviewDone: '5 hình đã sẵn. Chọn một để đính kèm lịch hẹn, hoặc bỏ qua.',
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
      manualBookingHelpLabel: 'Cần trợ giúp?',
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
      preferredBarberNotAvailable: '{name} không phục vụ {city}. Bạn có muốn dùng thợ kế tiếp đang rảnh không?'
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
      promoKicker: 'Vistas previas con AI',
      promoTitle: 'Vea su próximo corte antes de reservar',
      promoCopy: 'Vistas previas de cortes generadas por AI para cada estilo — fade, taper, barba, niños, ejecutivo, senior, line up, y paquete familiar.',
      promoCta: 'Reservar corte en casa hoy',
      convenienceKicker: 'Conveniencia',
      convenienceTitle: 'Conveniencia del corte móvil',
      heroShowcaseFadeTitle: 'Fade en casa',
      heroShowcaseFadeCopy:  'Fade limpio y prolijo sin salir de casa.',
      heroShowcaseFadeCta:   'Reservar fade',
      heroShowcaseFamilyTitle: 'Cortes para toda la familia',
      heroShowcaseFamilyCopy:  'Una sola visita cubre niños, adultos mayores y padres.',
      heroShowcaseFamilyCta:   'Reservar familiar',
      heroShowcaseHotelTitle: 'Listo para una reunión',
      heroShowcaseHotelCopy:  'Corte de negocios y detalle de barba antes del evento.',
      heroShowcaseHotelCta:   'Reservar corte ejecutivo',
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
      priceUnavailable: 'Precio no disponible',
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
      homeAiPreviewTitle: 'Vea su rostro en 5 peinados generados por AI',
      homeAiPreviewIntro: 'Para hombres, mujeres y niños. Suba una selfie, indique para quién es y qué desea explorar, y la AI generará 5 vistas previas fotorrealistas de SU rostro con peinados a su medida. Elija uno y lo adjuntaremos a su cita para que el barbero sepa exactamente qué quiere.',
      homeAiPreviewWhoForLabel: '¿Para quién es este estilo?',
      homeAiPreviewAudienceMan: 'Hombre',
      homeAiPreviewAudienceWoman: 'Mujer',
      homeAiPreviewAudienceChild: 'Niño/a',
      homeAiPreviewAudienceNeutral: 'Sin preferencia',
      homeAiPreviewExploreLabel: '¿Qué desea explorar?',
      homeAiPreviewExploreHaircut: 'Corte',
      homeAiPreviewExploreColor: 'Color',
      homeAiPreviewExploreHighlights: 'Mechas',
      homeAiPreviewExploreCurly: 'Estilo rizado',
      homeAiPreviewExploreStraight: 'Estilo liso',
      homeAiPreviewVibeLabel: 'Preferencia de estilo',
      homeAiPreviewVibeProfessional: 'Profesional',
      homeAiPreviewVibeTrendy: 'Moderno',
      homeAiPreviewVibeLowMaintenance: 'Bajo mantenimiento',
      homeAiPreviewVibeNatural: 'Natural',
      homeAiPreviewVibeBold: 'Atrevido',
      homeAiPreviewAudienceLabel: 'Para:',
      homeAiPreviewColorLabel: 'Color:',
      homeAiPreviewHighlightLabel: 'Mechas:',
      homeAiPreviewTextureLabel: 'Textura:',
      homeAiPreviewWhyLabel: 'Por qué le queda:',
      homeAiPreviewSafetyLabel: 'Nota:',
      homeAiPreviewInspirationWarning: 'Estilo de inspiración — su resultado real puede variar.',
      lightboxOpen: 'Ampliar',
      lightboxClose: 'Cerrar',
      lightboxLabel: 'Vista ampliada',
      lightboxHint: 'Vista previa AI — el resultado real puede variar. Toque fuera para cerrar.',
      homeAiPreviewConsent: 'Acepto que la AI use mi selfie para generar vistas previas. La imagen se comparte solo con el barbero asignado y nunca se usa para marketing.',
      homeAiPreviewUploadLabel: 'Agregue una selfie (cara y cabello visibles, buena luz)',
      homeAiPreviewAddPhoto: 'Agregar foto o selfie',
      homeAiPreviewAddPhotoHint: 'Su teléfono le permitirá tomar una selfie o elegir una de la galería.',
      homeAiPreviewChooseFile: 'Elegir de la galería',
      homeAiPreviewTakeSelfie: 'Tomar una selfie',
      homeAiPreviewAnalyze: 'Obtener 5 vistas previas con AI',
      homeAiPreviewRemove: 'Eliminar selfie',
      homeAiPreviewDisclosure: 'Las vistas previas AI son sólo sugerencias — el resultado real puede variar. Su selfie queda en esta cita y sólo la ve el barbero asignado.',
      homeAiPreviewBadge: 'Sugerencia AI',
      homeAiPreviewBarberNotesLabel: 'Notas para el barbero:',
      homeAiPreviewSelfieAlt: 'Vista previa de su selfie',
      homeAiPreviewConsentRequired: 'Por favor acepte el consentimiento de AI primero.',
      homeAiPreviewCompressing: 'Preparando imagen…',
      homeAiPreviewCompressFailed: 'No pudimos leer esa foto. Pruebe otra.',
      homeAiPreviewReady: 'Listo. Toque "Obtener 3 vistas previas con AI".',
      homeAiPreviewAnalyzing: 'Analizando su foto y generando 5 vistas previas… toma ~15-20 segundos.',
      homeAiPreviewDone: '5 vistas listas. Elija una para adjuntar a su cita, o salte.',
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
      manualBookingHelpLabel: '¿Necesita ayuda?',
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
      preferredBarberNotAvailable: '{name} no cubre {city}. ¿Quiere el siguiente barbero disponible?'
    }
  };

  var SERVICE_COPY = {};

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
      // Who the style is for + what to explore + the desired vibe. Drives the
      // all-audience AI (men / women / children + haircut / color / highlights
      // / curly / straight). Defaults: neutral audience, haircut-only.
      options: { audience: 'neutral', explore: ['haircut'], preference: '' },
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

  // Use this everywhere a customer-facing price is rendered. Returns either
  // a real `$X` string or an explicit "Price unavailable" label — never
  // silently falls back to $0. Per the spec: a paid service must never
  // display $0; if the price is missing that is a data bug worth surfacing.
  function formatServicePrice(value) {
    var num = Number(value);
    if (!isFinite(num)) {
      if (root.console) root.console.error('[mobile-barber] missing service price', value);
      return t('priceUnavailable') || 'Price unavailable';
    }
    if (num <= 0) {
      // Service catalogue may legitimately include free add-ons in the
      // future, but today every menu item is paid. Treat 0 as a data bug
      // and surface it instead of pretending the haircut is free.
      if (root.console) root.console.error('[mobile-barber] service price <= 0 — treating as unavailable', value);
      return t('priceUnavailable') || 'Price unavailable';
    }
    return '$' + num.toFixed(0);
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

  // Inline SVG icon helpers (MBIcons). Degrade to text-only if the module is
  // unavailable so nothing disappears.
  function icoMarkup(name) {
    var I = root.MBIcons;
    return (I && I.markup) ? I.markup(name) : '';
  }
  function icoLabel(node, name, text) {
    var I = root.MBIcons;
    if (I && I.label) return I.label(node, name, text);
    node.textContent = (text == null) ? '' : String(text);
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
    var picked = null;
    // 1) An explicit Find-My-Barber gate match wins. This is the marketplace
    //    auto-routing result and reflects the customer's actual address.
    if (state.routedVendor && state.routedVendor.active !== false) {
      var stillValid = vendors.filter(function(vendor) { return vendor.id === state.routedVendor.id; })[0];
      if (stillValid) picked = stillValid;
    }
    // 2) Customer barber preference expressed to the AI agent (override).
    if (!picked) {
      var sessionState = state.agentSession && state.agentSession.state;
      var preference = String(sessionState && sessionState.barberPreference || '').toLowerCase();
      if (preference) {
        var matched = vendors.filter(function(vendor) {
          return String(vendor.businessName + ' ' + vendor.barberName + ' ' + vendor.id).toLowerCase().indexOf(preference.split(/\s+/)[0]) >= 0;
        })[0];
        if (matched) picked = matched;
      }
    }
    // 3) Address-based fallback before the customer has touched the gate, so
    //    a returning visitor with a saved location still talks to the right
    //    vendor on first message.
    if (!picked) {
      var saved = readSavedLocation();
      if (saved && BOOKING && typeof BOOKING.findVendorForAddress === 'function') {
        var routed = BOOKING.findVendorForAddress(saved, { vendors: vendors });
        if (routed) picked = routed;
      }
    }
    if (!picked) {
      var service = selectedService();
      if (service && DATA.findVendorById) picked = DATA.findVendorById(service.vendorId);
    }
    if (!picked && DATA.findVendorById && DATA.MICHAEL_VENDOR_ID) picked = DATA.findVendorById(DATA.MICHAEL_VENDOR_ID);
    if (!picked) picked = vendors[0] || null;
    // Always enrich with the runtime promo overlay so downstream consumers
    // (AGENT.buildPrompt, BOOKING.calculateMobileBarberPrice) see the
    // Firestore-saved vendor.promotions. The static catalog vendors are
    // Object.freeze'd so we cannot mutate them in place.
    return picked ? _vendorWithPromos(picked) : null;
  }

  // Route the operating vendor from the address the customer has provided in
  // the chat (current session + the incoming message), so the booking goes to
  // the barber who serves that area — Orange County → Michael, Bay Area → Tim,
  // both from the same landing page. Persists to state.routedVendor (priority 1
  // in preferredVendor) so the choice stays stable for the rest of the session
  // and the conversation never flips vendors mid-booking.
  function routeVendorFromConversation(message) {
    if (!AGENT || !BOOKING || typeof BOOKING.findVendorForAddress !== 'function') return;
    var vendors = DATA && DATA.sampleVendors
      ? DATA.sampleVendors.filter(function(v) { return v.active !== false; })
      : [];
    if (!vendors.length) return;
    var session = state.agentSession;
    var current = (session && session.state)
      || (typeof AGENT.emptyState === 'function' ? AGENT.emptyState(state.lang) : {});
    var draftState = current;
    // Fold the incoming message into a THROWAWAY clone so we can route on the
    // same turn the address arrives. mergeState mutates its first argument, so
    // we clone to avoid pre-applying the update to the live session state.
    if (message && typeof AGENT.extractUpdate === 'function' && typeof AGENT.mergeState === 'function') {
      try {
        var allAreas = [];
        vendors.forEach(function(v) {
          (v.serviceAreas || []).forEach(function(a) {
            if (allAreas.indexOf(a) < 0) allAreas.push(a);
          });
        });
        var liteCtx = { now: new Date(), services: [], vendor: { serviceAreas: allAreas } };
        var upd = AGENT.extractUpdate(message, liteCtx, current);
        draftState = AGENT.mergeState(Object.assign({}, current), upd, new Date());
      } catch (e) { draftState = current; }
    }
    var addr = {
      address: draftState.address || '',
      city: draftState.city || '',
      zip: draftState.zip || ''
    };
    if (!String(addr.city).trim() && !String(addr.zip).trim()) return;
    var routed = BOOKING.findVendorForAddress(addr, { vendors: vendors });
    if (routed) {
      state.routedVendor = routed;
      var area = String(addr.city || addr.zip || '').trim();
      state.routingReason = 'address_match ' + area + ' -> ' + (routed.id || '');
      if (root.console && root.console.log) {
        try {
          root.console.log('[mobile-barber-agent-routing]', JSON.stringify({
            phone: (current && current.phone) || (draftState && draftState.phone) || null,
            matchedCustomer: !!(current && current.customerLookupStatus === 'found'),
            address: addr.address || '',
            city: addr.city || '',
            zip: addr.zip || '',
            assignedBarberId: routed.assignedBarberId || routed.barberId || routed.id || null,
            routingReason: state.routingReason
          }));
        } catch (e) { /* logging is best-effort */ }
      }
    }
  }

  function servicesForVendor(vendorId) {
    if (root._mbVendorServicesByVendor && Array.isArray(root._mbVendorServicesByVendor[vendorId])) {
      return root._mbVendorServicesByVendor[vendorId].slice();
    }
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
      availability: _vendorAvailabilityRows(),
      unavailableBlocks: _vendorUnavailableBlocks(vendor && vendor.id),
      existingBookings: state.existingBookings,
      now: new Date(),
      phoneIntake: root.PhoneIntake || null,
      routingReason: state.routingReason || '',
      customerLookupProvider: function(phone) {
        if (!BOOKING || typeof BOOKING.lookupReturningCustomer !== 'function') return Promise.resolve(null);
        // Look up the phone across ALL barbers (omit vendorId) so a returning
        // Bay Area customer is recognized even before their address has routed
        // them to Tim — the default vendor before routing is Michael (OC).
        // Routing to the correct barber happens once the saved address is
        // applied, on the next turn.
        return BOOKING.lookupReturningCustomer(null, phone);
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
    ensureAgentSession();
    // Resolve the barber from the address the customer has given in this chat
    // BEFORE building the agent context, so services/promos/hours/blocks and
    // the availability check all run against the barber who serves that area.
    routeVendorFromConversation(message);
    var vendor = preferredVendor();
    if (!vendor) return Promise.resolve({ response: t('assistantCopy') });
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
    return refreshLiveBookingData(vendor)
      .then(function(live) {
        vendor = live.vendor || vendor;
        return BOOKING.loadExistingBookings(vendor.id).then(finish);
      })
      .catch(function() {
        return BOOKING.loadExistingBookings(vendor.id).then(finish).catch(function() {
          return finish([]);
        });
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
          // Services are created with id = `${vendorId}-${slug}` and now
          // carry a separate `slug` field. Match on slug first so the
          // template -> service join is deterministic regardless of vendor;
          // fall back to legacy id match for any caller that constructs
          // services without the slug field.
          var service = (services || []).filter(function(s) {
            return s && (s.slug === tmpl.id || s.id === tmpl.id);
          })[0] || null;
          if (!service && root.console) {
            root.console.warn('[mobile-barber] no matching service for template ' + tmpl.id +
              ' — carousel will show "Price unavailable" instead of a fake $0');
          }
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
            price: service && typeof service.price === 'number' ? service.price : null,
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

    // Just a summary line — the manual booking form opens immediately
    // beneath it (no intermediate Book/Chat/Talk three-button panel).
    // AI options live inside the form footer as secondary "Need help?"
    // links so the customer never has to choose a booking flow twice.
    var text = el('div', 'mb-service-selection__text');
    var label = el('span');
    var title = el('strong');
    label.textContent = t('selectedServiceLabel');
    title.textContent = serviceCopy(service, 'name') + ' · ' + formatServicePrice(service.price);
    text.appendChild(label);
    text.appendChild(title);
    panel.appendChild(text);

    // Manual booking form mount point. Filled by openManualBookingForm()
    // immediately after Select Service is tapped.
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
      // Promo-aware price chip: if any active vendor in the customer's
      // region has a promo applying to this service, show the discounted
      // final price with the original struck through.
      var pricing = applyPromotionToServicePrice(service);
      if (pricing.promoApplied) {
        var priceChip = el('span', 'mb-chip mb-chip--promo');
        priceChip.innerHTML =
          '<strong class="mb-chip__label">' + t('priceLabel') + ':</strong> ' +
          '<span class="mb-chip__original">' + formatServicePrice(pricing.originalPrice) + '</span> ' +
          '<span class="mb-chip__final">' + formatServicePrice(pricing.discountedPrice) + '</span> ' +
          '<span class="mb-chip__pct">-' + pricing.discountPercent + '%</span>';
        row.appendChild(priceChip);
      } else {
        row.appendChild(metaChip(t('priceLabel'), formatServicePrice(service.price)));
      }
      row.appendChild(metaChip(t('durationLabel'), service.durationMinutes + ' ' + t('minutes')));
      row.appendChild(metaChip(t('travelBufferLabel'), service.travelBufferMinutes + ' ' + t('minutes')));
      row.appendChild(metaChip(t('cleanupLabel'), service.cleanupBufferMinutes + ' ' + t('minutes')));
      cta.type = 'button';
      cta.textContent = t('selectService');
      // Tapping "Select Service" opens the manual booking form for that
      // service IMMEDIATELY. The previous intermediate Book/Chat/Talk panel
      // was unnecessary friction — the service is already chosen, so the
      // next step should be filling in the appointment details. The AI
      // options remain available as secondary "Need help?" links inside
      // the form footer.
      cta.addEventListener('click', function() {
        selectService(service);
        openManualBookingForm(service);
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
      var price = el('span', 'mb-promo__card-price');
      card.setAttribute('data-promo-id', item.id);
      card.setAttribute('data-promo-category', item.category);
      img.src = item.imageUrl;
      img.alt = item.imageAlt;
      img.loading = 'lazy';
      title.textContent = item.title;
      // Apply any active vendor promo for this slug so the carousel
      // mirrors the same price the customer would see when they book.
      var pricing = (typeof applyPromotionToServicePrice === 'function')
        ? applyPromotionToServicePrice({ id: item.id, slug: item.id, price: item.price })
        : null;
      if (pricing && pricing.promoApplied) {
        price.innerHTML =
          '<span class="mb-promo__card-original">' + formatServicePrice(pricing.originalPrice) + '</span> ' +
          '<span class="mb-promo__card-final">' + formatServicePrice(pricing.discountedPrice) + '</span> ' +
          '<span class="mb-promo__card-pct">-' + pricing.discountPercent + '%</span>';
      } else {
        price.textContent = formatServicePrice(item.price);
      }
      body.appendChild(title);
      body.appendChild(price);
      card.appendChild(img);
      card.appendChild(body);
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
      var icon = el('span', 'mb-ico');
      var body = el('strong');
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = icoMarkup('check');
      body.textContent = text;
      card.appendChild(icon);
      card.appendChild(body);
      list.appendChild(card);
    });
  }

  // Hero showcase strip — auto-rotating cards inside the hero section:
  // promo clips (Fade / Family / Hotel) plus an extra slide per active
  // vendor promotion. Each slide has a large visual + headline + CTA.
  // Replaces the previous lower-page "Animated mobile barber promos"
  // section AND the separate hero showcase strip below the trust chips —
  // this IS the main hero media now. When an active promo exists, the
  // promo slide leads the rotation; otherwise the default brand slide +
  // 3 service clip slides rotate.
  var _heroShowcaseTimer = null;
  var _heroShowcaseHash  = '';   // last rendered slide-set hash (skip identical rebuilds)
  var _heroShowcaseActiveKey = ''; // currently visible slide key (preserved across rebuilds)
  var _heroShowcaseHashHadPromo = false; // true if previous render had at least one promo slide
  var DEFAULT_HERO_POSTER  = '/assets/mobile-barber/styles/classic-haircut.jpg';
  var PROMO_HERO_FALLBACK  = '/assets/mobile-barber/styles/business-haircut.jpg';

  // Pick top 3 active services for a vendor (sort by price desc) so the
  // promo slide shows the most-discountable haircuts inline.
  function _topDiscountedServicesForPromo(promo, vendorId) {
    if (!DATA || typeof DATA.listServicesForVendor !== 'function') return [];
    var pct = Number(promo && promo.discountPercent || 0);
    if (pct <= 0) return [];
    var services = DATA.listServicesForVendor(vendorId) || [];
    var scoped = services.filter(function(svc) {
      if (!svc || svc.active === false) return false;
      if (typeof svc.price !== 'number' || svc.price <= 0) return false;
      if (promo.applyToScope === 'selected') {
        return Array.isArray(promo.appliesToServiceIds) &&
               promo.appliesToServiceIds.indexOf(svc.id) >= 0;
      }
      return true;
    });
    scoped.sort(function(a, b) { return Number(b.price) - Number(a.price); });
    return scoped.slice(0, 3).map(function(svc) {
      var final = Math.round(svc.price * (1 - pct / 100));
      return {
        slug: svc.slug || svc.id,
        name: serviceCopy(svc, 'name'),
        originalPrice: svc.price,
        discountedPrice: final
      };
    });
  }

  function _hashSlideSet(slides) {
    return JSON.stringify(slides.map(function(s) {
      return [s.key, s.title, s.copy, s.meta, s.badge, s.badgeIcon, s.poster, s.video,
              (s.services || []).map(function(x) {
                return [x.slug, x.name, x.originalPrice, x.discountedPrice];
              })];
    }));
  }

  function renderHeroShowcase() {
    var mount = document.getElementById('mbHeroMedia') || document.getElementById('mbHeroShowcase');
    if (!mount) return;

    // ── Build the slide set ────────────────────────────────────────────
    var slides = [];

    // Active vendor promotions LEAD the rotation. Each promo carries its
    // own service list + poster fallback so the slide never renders blank.
    (collectActiveCustomerPromos() || []).forEach(function(promo) {
      var pct = Number(promo.discountPercent || 0);
      var byline = promo.vendorBarberName ? promo.vendorBarberName : '';
      if (promo.endDate) {
        byline = (byline ? byline + ' · ' : '') +
          interpolate(t('heroPromoUntil') || 'Through {date}', { date: promo.endDate });
      }
      var services = _topDiscountedServicesForPromo(promo, promo.vendorId);
      slides.push({
        type:  'promo',
        key:   'heroShowcasePromo-' + (promo.id || ''),
        title: promo.name || (pct + '% OFF'),
        copy:  promo.description || '',
        meta:  byline,
        cta:   t('heroPromoCta') || 'Book this discount',
        badge: pct + '% ' + (t('heroPromoBadgeOff') || 'OFF'),
        badgeIcon: 'flame',
        poster: PROMO_HERO_FALLBACK,
        services: services,
        promo: promo,
        action: function() { openAssistantPanel('general'); }
      });
    });

    // Default brand slide — leads when no promo is active.
    slides.push({
      type:  'default',
      key:   'heroShowcaseDefault',
      title: t('heroCardTitle') || 'In-home haircuts at your address',
      copy:  t('heroCardSub')   || 'Service area, price, duration, and confirmation shown before booking.',
      cta:   t('bookNow')       || 'Book Now',
      badge: t('heroStatus') || 'Verified barber',
      badgeIcon: 'check',
      poster: DEFAULT_HERO_POSTER,
      action: function() { openAssistantPanel('general'); }
    });

    // 3 hardcoded mobile-barber promo clips.
    slides.push({
      type: 'clip', key: 'heroShowcaseFade',
      title: t('heroShowcaseFadeTitle') || 'Fade at home',
      copy:  t('heroShowcaseFadeCopy')  || 'Fresh fade setup, cleanup, and finish without a waiting room.',
      cta:   t('heroShowcaseFadeCta')   || 'Book a fade',
      video: '/assets/mobile-barber/clips/fade-1.mp4',
      poster:'/assets/mobile-barber/portfolio/fade-1-after.jpg',
      action: function() { openAssistantPanel('general'); }
    });
    slides.push({
      type: 'clip', key: 'heroShowcaseFamily',
      title: t('heroShowcaseFamilyTitle') || 'Family haircut stop',
      copy:  t('heroShowcaseFamilyCopy')  || 'One mobile visit can cover kids, seniors, and parents.',
      cta:   t('heroShowcaseFamilyCta')   || 'Book family visit',
      video: '/assets/mobile-barber/clips/family-haircut-1.mp4',
      poster:'/assets/mobile-barber/portfolio/family-haircut-1-after.jpg',
      action: function() { openAssistantPanel('general'); }
    });
    slides.push({
      type: 'clip', key: 'heroShowcaseHotel',
      title: t('heroShowcaseHotelTitle') || 'Hotel-ready grooming',
      copy:  t('heroShowcaseHotelCopy')  || 'Business cut and beard detail before meetings or events.',
      cta:   t('heroShowcaseHotelCta')   || 'Book business cut',
      video: '/assets/mobile-barber/clips/business-haircut-1.mp4',
      poster:'/assets/mobile-barber/portfolio/business-haircut-1-after.jpg',
      action: function() { openAssistantPanel('general'); }
    });

    if (!slides.length) { mount.hidden = true; return; }
    mount.hidden = false;

    // ── Skip if the slide set hasn't actually changed ──────────────────
    // Prevents the brief blank flash when init + Firestore-loaded fire
    // back-to-back with identical content.
    var hash = _hashSlideSet(slides);
    if (hash === _heroShowcaseHash && mount.children.length === slides.length) {
      return;
    }
    _heroShowcaseHash = hash;

    // ── Pick the slide key to keep visible across the rebuild ──────────
    // Rules:
    //  1. If a promo slide just appeared that wasn't visible before → lead
    //     with it (this is the moment the customer needs to notice the deal).
    //  2. Otherwise if the previously-active slide still exists → keep it.
    //  3. Otherwise lead with slide 0 (default brand or first promo).
    var firstPromoKey = '';
    for (var pi = 0; pi < slides.length; pi++) {
      if (slides[pi].type === 'promo') { firstPromoKey = slides[pi].key; break; }
    }
    var keepKey = _heroShowcaseActiveKey;
    var activeIdx = 0;
    if (firstPromoKey && !_heroShowcaseHashHadPromo) {
      // Promo just activated — lead with it on this render.
      for (var fi = 0; fi < slides.length; fi++) {
        if (slides[fi].key === firstPromoKey) { activeIdx = fi; break; }
      }
    } else if (keepKey) {
      for (var ki = 0; ki < slides.length; ki++) {
        if (slides[ki].key === keepKey) { activeIdx = ki; break; }
      }
    }
    _heroShowcaseHashHadPromo = !!firstPromoKey;
    _heroShowcaseActiveKey = slides[activeIdx].key;

    // ── Build into a fragment, then atomic swap (no blank frame) ───────
    var frag = document.createDocumentFragment();
    slides.forEach(function(slide, idx) {
      frag.appendChild(_buildHeroShowcaseCard(slide, idx === activeIdx));
    });

    // Persistent promo ribbon — sits ABOVE every slide via z-index so the
    // discount is visible regardless of which slide is currently active.
    // Customer never loses sight of the deal as the carousel rotates.
    var bestPromo = _bestActivePromo();
    if (bestPromo) {
      frag.appendChild(_buildHeroShowcaseRibbon(bestPromo));
    }

    mount.innerHTML = '';
    mount.appendChild(frag);

    // ── Restart auto-rotate ─────────────────────────────────────────────
    if (_heroShowcaseTimer) { clearInterval(_heroShowcaseTimer); _heroShowcaseTimer = null; }
    if (slides.length > 1) {
      var active = activeIdx;
      _heroShowcaseTimer = setInterval(function() {
        var cards = mount.querySelectorAll('.mb-hero-showcase-card');
        if (!cards.length) return;
        cards[active].classList.remove('mb-hero-showcase-card--visible');
        active = (active + 1) % cards.length;
        cards[active].classList.add('mb-hero-showcase-card--visible');
        _heroShowcaseActiveKey = cards[active].getAttribute('data-key') || _heroShowcaseActiveKey;
      }, 5000);
    }
  }

  // Highest-discount active promo. Drives the persistent ribbon visible
  // on every slide of the hero rotation.
  function _bestActivePromo() {
    var promos = collectActiveCustomerPromos() || [];
    if (!promos.length) return null;
    var sorted = promos.slice().sort(function(a, b) {
      return Number(b.discountPercent || 0) - Number(a.discountPercent || 0);
    });
    return sorted[0];
  }

  // Persistent ribbon that floats above every slide. Always visible while
  // any promo is active so the discount never disappears between rotations.
  function _buildHeroShowcaseRibbon(promo) {
    var ribbon = el('button', 'mb-hero-showcase__ribbon');
    ribbon.type = 'button';
    var pct = Number(promo.discountPercent || 0);
    var name = promo.name || '';
    var vendor = promo.vendorBarberName || '';
    var detailBits = [];
    if (vendor) detailBits.push(vendor);
    if (promo.endDate) {
      detailBits.push(interpolate(t('heroPromoUntil') || 'Through {date}', { date: promo.endDate }));
    }
    ribbon.innerHTML =
      '<span class="mb-hero-showcase__ribbon-badge mb-ico">' + icoMarkup('flame') + ' ' + pct + '% ' +
      (t('heroPromoBadgeOff') || 'OFF') + '</span>' +
      '<span class="mb-hero-showcase__ribbon-copy">' +
        '<strong>' + name + '</strong>' +
        (detailBits.length ? '<span>' + detailBits.join(' · ') + '</span>' : '') +
      '</span>' +
      '<span class="mb-hero-showcase__ribbon-cta">' +
        (t('heroPromoCta') || 'Book') + ' ' + icoMarkup('arrow-right') + '</span>';
    ribbon.setAttribute('aria-label',
      pct + '% off promotion — ' + name + (vendor ? ' by ' + vendor : '') + ' — tap to book');
    ribbon.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      openAssistantPanel('general');
    });
    return ribbon;
  }

  function _buildHeroShowcaseCard(slide, isActive) {
    var card = el('article', 'mb-hero-showcase-card mb-hero-showcase-card--' + slide.type);
    if (isActive) card.classList.add('mb-hero-showcase-card--visible');
    card.setAttribute('data-key', slide.key);

    var media = el('div', 'mb-hero-showcase-card__media');
    if (slide.type === 'clip' && slide.video) {
      var video = document.createElement('video');
      video.src = slide.video;
      if (slide.poster) video.poster = slide.poster;
      video.autoplay = true; video.loop = true; video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('preload', 'metadata');
      video.setAttribute('aria-hidden', 'true');
      media.appendChild(video);
    } else if (slide.poster) {
      // Promo slide: poster image PLUS the gold gradient overlay via CSS.
      media.style.backgroundImage = "url('" + slide.poster + "')";
      if (slide.type === 'promo') {
        media.classList.add('mb-hero-showcase-card__media--promo');
      }
    } else if (slide.type === 'promo') {
      media.classList.add('mb-hero-showcase-card__media--promo');
    }
    card.appendChild(media);

    if (slide.badge) {
      var badge = el('span', 'mb-hero-showcase-card__badge');
      if (slide.badgeIcon) { badge.classList.add('mb-ico'); icoLabel(badge, slide.badgeIcon, slide.badge); }
      else { badge.textContent = slide.badge; }
      card.appendChild(badge);
    }

    var body = el('div', 'mb-hero-showcase-card__body');
    var title = el('strong'); title.textContent = slide.title;
    body.appendChild(title);

    if (slide.copy) {
      var copy = el('p'); copy.textContent = slide.copy;
      body.appendChild(copy);
    }

    // Promo slide: inline service grid (top 3 discounted, original→final).
    if (slide.type === 'promo' && slide.services && slide.services.length) {
      var grid = el('ul', 'mb-hero-showcase-card__services');
      slide.services.forEach(function(svc) {
        var li = el('li', 'mb-hero-showcase-card__service-row');
        var nm = el('span', 'mb-hero-showcase-card__service-name');
        nm.textContent = svc.name;
        var pr = el('span', 'mb-hero-showcase-card__service-prices');
        pr.innerHTML =
          '<span class="mb-hero-showcase-card__service-original">' + formatMoney(svc.originalPrice) + '</span>' +
          ' <span class="mb-hero-showcase-card__service-arrow mb-ico">' + icoMarkup('arrow-right') + '</span> ' +
          '<span class="mb-hero-showcase-card__service-final">' + formatMoney(svc.discountedPrice) + '</span>';
        li.appendChild(nm); li.appendChild(pr);
        grid.appendChild(li);
      });
      body.appendChild(grid);
    }

    if (slide.meta) {
      var meta = el('span', 'mb-hero-showcase-card__meta');
      meta.textContent = slide.meta;
      body.appendChild(meta);
    }

    var cta = el('button', 'mb-button mb-button--primary mb-button--sm mb-hero-showcase-card__cta');
    cta.type = 'button';
    cta.textContent = slide.cta;
    cta.addEventListener('click', function(e) { e.preventDefault(); slide.action(); });
    body.appendChild(cta);

    card.appendChild(body);
    return card;
  }

  if (typeof window !== 'undefined') window._mbRenderHeroShowcase = renderHeroShowcase;

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
    renderConvenience();
    renderHeroShowcase();
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
    // Audience + explore + preference selectors (men / women / children +
    // haircut / color / highlights / curly / straight + vibe). A single change
    // listener on the container reads all three groups into state.
    var aiOptions = document.getElementById('mbHomeAiPreviewOptions');
    if (aiOptions) aiOptions.addEventListener('change', handleAiOptionsChange);
  }

  function handleAiOptionsChange() {
    var root2 = document.getElementById('mbHomeAiPreviewOptions');
    if (!root2) return;
    var audienceNode = root2.querySelector('input[name="mbAiAudience"]:checked');
    var prefNode = root2.querySelector('input[name="mbAiPref"]:checked');
    var explore = [];
    root2.querySelectorAll('input[name="mbAiExplore"]:checked').forEach(function(n) {
      if (n.value) explore.push(n.value);
    });
    if (!explore.length) explore = ['haircut'];
    state.aiPreview.options = {
      audience: audienceNode ? String(audienceNode.value || 'neutral') : 'neutral',
      explore: explore,
      preference: prefNode ? String(prefNode.value || '') : ''
    };
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

  function aiAudienceLabel(aud) {
    var map = {
      man: 'homeAiPreviewAudienceMan',
      woman: 'homeAiPreviewAudienceWoman',
      child: 'homeAiPreviewAudienceChild',
      neutral: 'homeAiPreviewAudienceNeutral'
    };
    return t(map[aud] || 'homeAiPreviewAudienceNeutral') || aud;
  }

  // Lean per-style metadata persisted on booking.recommendedStyles[] so the
  // vendor can review all 5 options (image bytes are NOT stored here — only the
  // selected preview is kept, compressed, in selectedStylePreviewUrl).
  function mapRecommendedStyles(recs) {
    return (recs || []).map(function(r) {
      return {
        styleId: r.styleId || '',
        title: r.title || '',
        targetAudience: r.targetAudience || '',
        explanation: r.explanation || '',
        maintenance: r.maintenance || '',
        barberNotes: r.barberNotes || '',
        colorRecommendation: r.colorRecommendation || '',
        highlightRecommendation: r.highlightRecommendation || '',
        curlStraightRecommendation: r.curlStraightRecommendation || '',
        whyItFitsFace: r.whyItFitsFace || '',
        safetyNotes: r.safetyNotes || ''
      };
    });
  }

  // Canonical all-audience attributes for the SELECTED style. Threaded into
  // every booking path (inline card, manual form, chat agent).
  function aiSelectedStyleFields(rec) {
    rec = rec || {};
    return {
      selectedAudienceType: rec.targetAudience || '',
      selectedColorRecommendation: rec.colorRecommendation || '',
      selectedHighlightRecommendation: rec.highlightRecommendation || '',
      selectedTexturePreference: rec.curlStraightRecommendation || ''
    };
  }

  // Append a "<label> value" paragraph to an AI rec card only when the value is
  // non-empty (color/highlight/texture recs are empty unless the customer
  // asked the AI to explore them).
  function appendAiRecRow(body, labelKey, value, className, icoName) {
    var val = (value == null) ? '' : String(value).trim();
    if (!val) return;
    var p = el('p', className || 'mb-ai-rec-card__rec-row');
    if (icoName) {
      var ic = (root.MBIcons && root.MBIcons.node) ? root.MBIcons.node(icoName) : null;
      if (ic) { ic.classList.add('mb-ai-rec-card__row-ico'); p.appendChild(ic); p.appendChild(document.createTextNode(' ')); }
    }
    var strong = el('strong'); strong.textContent = (t(labelKey) || '') + ' ';
    p.appendChild(strong);
    p.appendChild(document.createTextNode(val));
    body.appendChild(p);
  }

  // ── Full-screen image lightbox ────────────────────────────────────────
  // Tapping an AI preview image opens it full-screen for a detailed look.
  // Closes on backdrop tap, the X button, or Escape. Restores focus + scroll.
  function _lightboxKeydown(e) {
    if (e.key === 'Escape' || e.keyCode === 27) closeImageLightbox();
  }
  function closeImageLightbox() {
    var ov = document.getElementById('mbImageLightbox');
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    document.removeEventListener('keydown', _lightboxKeydown);
    try { document.body.style.overflow = state._lightboxPrevOverflow || ''; } catch (e) {}
    if (state._lightboxReturnFocus && state._lightboxReturnFocus.focus) {
      try { state._lightboxReturnFocus.focus(); } catch (e) {}
    }
    state._lightboxReturnFocus = null;
  }
  function openImageLightbox(src, caption, returnFocusEl) {
    if (!src) return;
    closeImageLightbox();
    state._lightboxReturnFocus = returnFocusEl || null;

    var overlay = el('div', 'mb-lightbox');
    overlay.id = 'mbImageLightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', caption || (t('lightboxLabel') || 'Enlarged preview'));

    var inner = el('div', 'mb-lightbox__inner');
    var img = document.createElement('img');
    img.className = 'mb-lightbox__img';
    img.src = src;
    img.alt = caption || '';
    inner.appendChild(img);
    if (caption) {
      var cap = el('p', 'mb-lightbox__caption');
      cap.textContent = caption;
      inner.appendChild(cap);
    }
    var hint = el('p', 'mb-lightbox__hint');
    hint.textContent = t('lightboxHint') || 'AI preview — final result may vary.';
    inner.appendChild(hint);

    var close = el('button', 'mb-lightbox__close mb-ico');
    close.type = 'button';
    close.setAttribute('aria-label', t('lightboxClose') || 'Close');
    close.innerHTML = icoMarkup('x');
    close.addEventListener('click', function(e) { e.stopPropagation(); closeImageLightbox(); });

    overlay.appendChild(inner);
    overlay.appendChild(close);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay || e.target === inner) closeImageLightbox();
    });

    try { state._lightboxPrevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; } catch (e) {}
    document.body.appendChild(overlay);
    document.addEventListener('keydown', _lightboxKeydown);
    requestAnimationFrame(function() {
      overlay.classList.add('mb-lightbox--open');
      try { close.focus({ preventScroll: true }); } catch (e) {}
    });
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
      // Tap the image (or the corner expand button) → full-screen detail view.
      if (imgSrc) {
        thumb.classList.add('mb-ai-rec-card__thumb--zoomable');
        img.addEventListener('click', function() { openImageLightbox(imgSrc, rec.title || '', img); });
        var expandBtn = el('button', 'mb-ai-rec-card__expand mb-ico');
        expandBtn.type = 'button';
        expandBtn.setAttribute('aria-label', (t('lightboxOpen') || 'Enlarge') + (rec.title ? ' — ' + rec.title : ''));
        expandBtn.innerHTML = icoMarkup('maximize');
        expandBtn.addEventListener('click', function(e) { e.stopPropagation(); openImageLightbox(imgSrc, rec.title || '', expandBtn); });
        thumb.appendChild(expandBtn);
      }
      var badge = el('span', 'mb-ai-rec-card__ai-badge mb-ico');
      icoLabel(badge, 'sparkles', t('homeAiPreviewBadge') || 'AI suggestion');
      thumb.appendChild(badge);
      // When the AI is not confident it preserved the exact person, the
      // preview is labelled "style inspiration" rather than "your preview".
      if (rec.previewKind === 'style_inspiration') {
        var inspWarn = el('span', 'mb-ai-rec-card__inspiration mb-ico');
        icoLabel(inspWarn, 'alert-triangle', t('homeAiPreviewInspirationWarning') || 'Style inspiration — your real result may differ.');
        thumb.appendChild(inspWarn);
      }

      var body = el('div', 'mb-ai-rec-card__body');
      var title = el('strong', 'mb-ai-rec-card__title'); title.textContent = rec.title || '';
      // Audience chip (man / woman / child / neutral) so the customer sees the
      // style is matched to the right person.
      if (rec.targetAudience) {
        var audChip = el('span', 'mb-ai-rec-card__audience mb-ico');
        icoLabel(audChip, 'user', aiAudienceLabel(rec.targetAudience));
        body.appendChild(title);
        body.appendChild(audChip);
      } else {
        body.appendChild(title);
      }
      var meta = el('span', 'mb-ai-rec-card__maintenance');
      if (rec.maintenance) {
        meta.classList.add('mb-ico');
        icoLabel(meta, 'clock', (t('homeAiPreviewMaintenanceLabel') || 'Maintenance:') + ' ' + rec.maintenance);
      }
      var desc = el('p', 'mb-ai-rec-card__desc'); desc.textContent = rec.explanation || '';
      var notes = el('p', 'mb-ai-rec-card__barber-notes');
      icoLabel(notes, 'scissors', (t('homeAiPreviewBarberNotesLabel') || 'Barber notes:') + ' ' + (rec.barberNotes || ''));
      if (notes.firstChild && notes.firstChild.classList) notes.firstChild.classList.add('mb-ai-rec-card__row-ico');
      if (rec.maintenance) body.appendChild(meta);
      body.appendChild(desc);
      // Why-it-fits + per-option recommendations (only shown when present). Each
      // row gets a small leading icon so the card scans like a spec sheet.
      appendAiRecRow(body, 'homeAiPreviewWhyLabel', rec.whyItFitsFace, 'mb-ai-rec-card__why', 'smile');
      appendAiRecRow(body, 'homeAiPreviewColorLabel', rec.colorRecommendation, 'mb-ai-rec-card__color', 'palette');
      appendAiRecRow(body, 'homeAiPreviewHighlightLabel', rec.highlightRecommendation, 'mb-ai-rec-card__highlight', 'sun');
      appendAiRecRow(body, 'homeAiPreviewTextureLabel', rec.curlStraightRecommendation, 'mb-ai-rec-card__texture', 'waves');
      body.appendChild(notes);
      appendAiRecRow(body, 'homeAiPreviewSafetyLabel', rec.safetyNotes, 'mb-ai-rec-card__safety', 'info');

      var actions = el('div', 'mb-ai-rec-card__actions');
      var bookBtn = el('button', 'mb-button mb-button--primary mb-ai-rec-card__cta');
      bookBtn.type = 'button';
      bookBtn.setAttribute('data-style-id', styleId);
      // "Book this style" carries a scissors icon; Close / Book-again are text-only.
      if (isExpanded) {
        bookBtn.textContent = t('homeAiPreviewBookCancel') || 'Close';
      } else if (isSubmitted) {
        bookBtn.textContent = t('homeAiPreviewBookAgain') || 'Book another time';
      } else {
        bookBtn.classList.add('mb-ico');
        icoLabel(bookBtn, 'scissors', t('homeAiPreviewBookCta') || 'Book this style');
      }
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
    summaryPrice.textContent = formatServicePrice(service.price);
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

    // Secondary "Need help? Chat with AI / Talk to AI" footer — keeps
    // the AI booking flows available without making them a required step.
    // The primary path is the form above; AI is an optional alternative.
    var help = el('div', 'mb-manual-booking__help');
    var helpLabel = el('span', 'mb-manual-booking__help-label');
    helpLabel.textContent = t('manualBookingHelpLabel') || 'Need help?';
    var chatBtn = el('button', 'mb-button mb-button--ghost mb-button--sm mb-manual-booking__help-btn');
    chatBtn.type = 'button';
    chatBtn.textContent = t('chatThisService') || 'Chat with AI to book';
    chatBtn.addEventListener('click', function() {
      state.selectedServiceId = service.id;
      openAssistantPanel('general');
    });
    var voiceBtn = el('button', 'mb-button mb-button--ghost mb-button--sm mb-manual-booking__help-btn');
    voiceBtn.type = 'button';
    voiceBtn.textContent = t('talkThisService') || 'Talk to AI to book';
    voiceBtn.addEventListener('click', function() {
      state.selectedServiceId = service.id;
      openVoiceAssistant();
    });
    help.appendChild(helpLabel);
    help.appendChild(chatBtn);
    help.appendChild(voiceBtn);
    panel.appendChild(help);

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
    var vendor = _vendorWithPromos(BOOKING.findVendorForAddress(addressObj));
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
    var availability = _vendorAvailabilityRows();
    var unavailableBlocks = _vendorUnavailableBlocks(vendor.id);

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
      aiAttachments = Object.assign({
        selfieDataUrl: aiSel.selfieDataUrl || '',
        aiAnalysisSummary: aiSel.summary || '',
        aiAnalysisConsent: aiSel.consent ? 'true' : 'false',
        recommendedStyles: mapRecommendedStyles(aiSel.recommendations),
        selectedAiStyleId: aiSel.selectedStyleId,
        selectedAiStyleName: rec ? rec.title || '' : '',
        selectedAiStyleImage: aiSel.selectedStylePreviewUrl || '',
        selectedAiStyleDescription: rec ? rec.explanation || '' : '',
        selectedAiBarberNotes: rec ? rec.barberNotes || '' : '',
        selectedAiMaintenanceLevel: rec ? rec.maintenance || '' : '',
        selectedHaircutGeneratedAt: new Date().toISOString(),
        selectedHaircutPromptSnapshot: aiSel.summary || '',
        // Parity with the inline-card path: carry the session id so the
        // booking-write step can pull the full-res preview from localStorage.
        aiPreviewSessionId: aiSel.sessionId || ''
      }, aiSelectedStyleFields(rec));
    }

    var finalDraft = Object.assign({
      customerEmail: '',
      serviceId: resolvedService.id,
      smsOptIn: false,
      confirmationPreference: 'text',
      source: 'customer_form'
    }, draft, aiAttachments);

    refreshLiveBookingData(vendor)
      .then(function(live) {
        vendor = live.vendor || vendor;
        services = live.services && live.services.length ? live.services : services;
        resolvedService = services.filter(function(s) { return s && s.id === resolvedService.id; })[0]
          || services.filter(function(s) { return s && s.slug === resolvedService.slug; })[0]
          || services.filter(function(s) { return s && s.name === resolvedService.name; })[0]
          || resolvedService;
        finalDraft.serviceId = resolvedService.id;
        finalDraft._liveDataSource = live.source;
        availability = _vendorAvailabilityRows();
        unavailableBlocks = _vendorUnavailableBlocks(vendor.id);
        return BOOKING.loadExistingBookings(vendor.id);
      })
      .catch(function() { return []; })
      .then(function(existing) {
        var avail = BOOKING.checkAvailability({
          vendor: vendor,
          services: services,
          availability: availability,
          unavailableBlocks: unavailableBlocks,
          draft: finalDraft,
          existingBookings: existing,
          now: new Date(),
          liveDataSource: finalDraft._liveDataSource || 'static-fallback'
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
    var vendor = _vendorWithPromos(BOOKING.findVendorForAddress(addressObj));
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
    var availability = _vendorAvailabilityRows();
    var unavailableBlocks = _vendorUnavailableBlocks(vendor.id);

    state.aiPreview.submitting = true;
    if (statusEl) {
      statusEl.classList.remove('mb-ai-rec-card__booking-status--error');
      statusEl.textContent = t('homeAiPreviewBookSubmitting') || 'Sending…';
    }
    var submitBtn = panel.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    // Build the AI-style draft once so both the chat-attach and direct paths
    // see the same canonical reference.
    var aiAttachments = Object.assign({
      selfieDataUrl: state.aiPreview.selfieDataUrl || '',
      aiAnalysisSummary: state.aiPreview.summary || '',
      aiAnalysisConsent: state.aiPreview.consent ? 'true' : 'false',
      recommendedStyles: mapRecommendedStyles(state.aiPreview.recommendations),
      selectedAiStyleId: styleId,
      selectedAiStyleName: rec.title || '',
      selectedAiStyleImage: state.aiPreview.selectedStylePreviewUrl || fullDataUrl || '',
      selectedAiStyleDescription: rec.explanation || '',
      selectedAiBarberNotes: rec.barberNotes || '',
      selectedAiMaintenanceLevel: rec.maintenance || '',
      selectedHaircutGeneratedAt: new Date().toISOString(),
      selectedHaircutPromptSnapshot: state.aiPreview.summary || '',
      aiPreviewSessionId: state.aiPreview.sessionId || ''
    }, aiSelectedStyleFields(rec));

    var finalDraft = Object.assign({
      customerEmail: '',
      serviceId: service.id,
      smsOptIn: false,
      confirmationPreference: 'text',
      source: 'customer_form'
    }, draft, aiAttachments);

    refreshLiveBookingData(vendor)
      .then(function(live) {
        vendor = live.vendor || vendor;
        services = live.services && live.services.length ? live.services : services;
        service = services.filter(function(s) { return s && s.id === service.id; })[0]
          || services.filter(function(s) { return s && s.slug === service.slug; })[0]
          || services.filter(function(s) { return s && s.name === service.name; })[0]
          || service;
        finalDraft.serviceId = service.id;
        finalDraft._liveDataSource = live.source;
        availability = _vendorAvailabilityRows();
        unavailableBlocks = _vendorUnavailableBlocks(vendor.id);
        return BOOKING.loadExistingBookings(vendor.id);
      })
      .catch(function() { return []; })
      .then(function(existing) {
        var avail = BOOKING.checkAvailability({
          vendor: vendor,
          services: services,
          availability: availability,
          unavailableBlocks: unavailableBlocks,
          draft: finalDraft,
          existingBookings: existing,
          now: new Date(),
          liveDataSource: finalDraft._liveDataSource || 'static-fallback'
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
    var optionsFieldset = document.getElementById('mbHomeAiPreviewOptionsFieldset');
    var fileInput = document.getElementById('mbHomeAiPreviewFile');
    var legacyUpload = document.getElementById('mbHomeAiPreviewUpload');
    var analyze  = document.getElementById('mbHomeAiPreviewAnalyze');
    state.aiPreview.consent = !!(checkbox && checkbox.checked);
    if (fieldset)     fieldset.disabled = !state.aiPreview.consent;
    if (optionsFieldset) optionsFieldset.disabled = !state.aiPreview.consent;
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
    var opts = state.aiPreview.options || { audience: 'neutral', explore: ['haircut'], preference: '' };
    root.MobileBarberAIPreview.generate({
      dataUrl: state.aiPreview.selfieDataUrl,
      lang: state.lang,
      audience: opts.audience || 'neutral',
      explore: (opts.explore && opts.explore.length) ? opts.explore : ['haircut'],
      preference: opts.preference || ''
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
    booking.recommendedStyles = mapRecommendedStyles(ai.recommendations);
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
    booking.selectedAudienceType = (selectedRec && selectedRec.targetAudience) || '';
    booking.selectedColorRecommendation = (selectedRec && selectedRec.colorRecommendation) || '';
    booking.selectedHighlightRecommendation = (selectedRec && selectedRec.highlightRecommendation) || '';
    booking.selectedTexturePreference = (selectedRec && selectedRec.curlStraightRecommendation) || '';
    booking.selectedHaircutSource = 'ai_generated';
    booking.selectedHaircutTitle = booking.selectedAiStyleName || booking.serviceName || '';
    booking.selectedHaircutDescription = booking.selectedAiStyleDescription || booking.aiAnalysisSummary || '';
    booking.selectedHaircutImageUrl = booking.selectedAiStyleImage || '';
    booking.selectedHaircutImageStoragePath = '';
    booking.selectedHaircutThumbnailUrl = booking.selectedAiStyleImage || '';
    booking.selectedHaircutBarberNotes = booking.selectedAiBarberNotes || booking.barberCuttingNotes || '';
    booking.selectedHaircutMaintenanceLevel = booking.selectedAiMaintenanceLevel || '';
    booking.selectedHaircutGeneratedAt = new Date().toISOString();
    booking.selectedHaircutPromptSnapshot = booking.aiAnalysisSummary || '';
    booking.customerSelfieUrl = ai.consent ? (ai.selfieDataUrl || '') : '';
    booking.customerSelfieStoragePath = '';
    booking.aiPreviewSessionId = ai.sessionId || '';
    if (root.console && root.console.log) {
      try {
        root.console.log('[haircut-reference]', JSON.stringify({
          bookingId: booking.id || null,
          source: booking.selectedHaircutSource,
          imageUrl: booking.selectedHaircutImageUrl,
          storagePath: booking.selectedHaircutImageStoragePath,
          barberNotes: booking.selectedHaircutBarberNotes
        }));
      } catch (e) {}
    }
    return booking;
  }

  function init() {
    state.lang = getLang();
    var params = new URLSearchParams(root.location.search);
    state.selectedServiceId = params.get('serviceId') || '';
    state.region = String(params.get('region') || '').toLowerCase();
    bind();
    prefillLocationGate();
    setLang(state.lang);
    renderHeroShowcase();
    applyRegionDeepLink();
    // Live-merge vendor.promotions from Firestore into the runtime overlay
    // so every code path (hero showcase, service-card pricing, AI agent,
    // booking quote) sees what the vendor just enabled in the portal — no
    // matter which device/tab made the change.
    loadVendorPromosFromFirestore()
      .then(function() {
        renderHeroShowcase();
        renderServices();
      })
      .then(function() { subscribeVendorPromos(); })
      .catch(function() { /* fail open — landing still works without promos */ });
  }

  // ── Vendor promotion bridge (Firestore → runtime map → renderers) ─────
  //
  // FIX HISTORY:
  // 1. First attempt mutated DATA.sampleVendors[i].promotions — silently
  //    failed because every entry is Object.freeze'd. The mutation was a
  //    no-op so nothing ever showed.
  // 2. Read from `db.collection('vendors')` — wrong collection. The
  //    dashboard writes to `mobileBarberVendors` (DATA.COLLECTIONS.vendors).
  //    These two never overlapped.
  //
  // This implementation stores loaded promos in a side map keyed by vendor
  // id and exposes _vendorPromosFor(id) so every renderer (hero, service
  // card, booking quote, AI agent) reads the runtime overlay instead of
  // hitting the frozen catalog. Every place that takes a vendor object goes
  // through _vendorWithPromos(vendor) to get a writable shallow clone with
  // .promotions populated from the overlay.
  window._mbVendorPromosByVendor = window._mbVendorPromosByVendor || {};
  window._mbVendorServicesByVendor = window._mbVendorServicesByVendor || {};
  // Parallel overlays for the other two pieces of live vendor data the
  // booking guard needs: working hours (availability) and calendar blocks.
  // Same Firestore source (mobileBarberVendors/{id}), same hydrate path as
  // promos, so every booking path reads what the vendor set in the portal.
  window._mbVendorAvailByVendor = window._mbVendorAvailByVendor || {};
  window._mbVendorBlocksByVendor = window._mbVendorBlocksByVendor || {};

  function _vendorPromosFor(vendorId) {
    if (!vendorId) return [];
    if (Array.isArray(window._mbVendorPromosByVendor[vendorId])) {
      return window._mbVendorPromosByVendor[vendorId];
    }
    // Fall back to whatever the static seed declared on the (frozen) vendor.
    var v = (DATA && typeof DATA.findVendorById === 'function')
      ? DATA.findVendorById(vendorId)
      : null;
    return (v && Array.isArray(v.promotions)) ? v.promotions : [];
  }

  // Returns a shallow clone of the vendor with `.promotions` set to the
  // current runtime overlay. Safe to pass to BOOKING / AGENT helpers that
  // expect to read vendor.promotions. Pass-through (returns same ref) when
  // the runtime overlay has nothing to add.
  function _vendorWithPromos(vendor) {
    if (!vendor || !vendor.id) return vendor;
    var promos = _vendorPromosFor(vendor.id);
    if (!promos || !promos.length) return vendor;
    var clone = {};
    for (var k in vendor) { if (Object.prototype.hasOwnProperty.call(vendor, k)) clone[k] = vendor[k]; }
    clone.promotions = promos.slice();
    return clone;
  }
  if (typeof window !== 'undefined') window._mbVendorWithPromos = _vendorWithPromos;

  // Builds the availabilityRows array checkAvailability expects, merging the
  // static seed (DATA.sampleAvailability) with any live per-vendor hours the
  // vendor published from the portal. Live overrides win; vendors with no
  // published hours keep their static seed → no behavior change. Fail-open.
  function _vendorAvailabilityRows() {
    var base = (DATA && Array.isArray(DATA.sampleAvailability)) ? DATA.sampleAvailability.slice() : [];
    var overlay = window._mbVendorAvailByVendor || {};
    var ids = Object.keys(overlay);
    if (!ids.length) return base;
    var rows = base.map(function(row) {
      return (row && overlay[row.vendorId]) ? overlay[row.vendorId] : row;
    });
    // Append live availability for vendors not present in the static seed.
    ids.forEach(function(vendorId) {
      var inBase = base.some(function(row) { return row && row.vendorId === vendorId; });
      if (!inBase) rows.push(overlay[vendorId]);
    });
    return rows;
  }
  if (typeof window !== 'undefined') window._mbVendorAvailabilityRows = _vendorAvailabilityRows;

  // Returns the live calendar blocks for one vendor (empty array = no blocks,
  // which is a no-op in checkUnavailableBlocks). Each block already carries
  // vendorId/date/startTime/endTime from the dashboard's addBlock().
  function _vendorUnavailableBlocks(vendorId) {
    if (!vendorId) return [];
    var blocks = (window._mbVendorBlocksByVendor || {})[vendorId];
    return Array.isArray(blocks) ? blocks.slice() : [];
  }
  if (typeof window !== 'undefined') window._mbVendorUnavailableBlocks = _vendorUnavailableBlocks;

  function _mbVendorIds() {
    var vendors = (DATA && DATA.sampleVendors) ? DATA.sampleVendors : [];
    var ids = [];
    vendors.forEach(function(v) {
      if (!v || !v.id) return;
      if (v.providerType && v.providerType !== 'mobile-barber') return;
      ids.push(v.id);
    });
    return ids;
  }

  function _setVendorPromos(vendorId, promos) {
    window._mbVendorPromosByVendor[vendorId] = Array.isArray(promos) ? promos.slice() : [];
  }

  function _setVendorServices(vendorId, services) {
    window._mbVendorServicesByVendor[vendorId] = (services || []).filter(function(service) {
      return service && service.active !== false;
    });
  }

  function _mbCollection() {
    return (DATA && DATA.COLLECTIONS && DATA.COLLECTIONS.vendors) || 'mobileBarberVendors';
  }

  function loadVendorPromosFromFirestore() {
    var diag = { collection: _mbCollection(), vendorIds: _mbVendorIds(), promosByVendor: {}, errors: {} };
    if (typeof firebase === 'undefined' || !firebase.firestore || !firebase.apps || !firebase.apps.length) {
      diag.skipped = 'firebase-unavailable';
      if (root.console) root.console.info('[mobile-barber-promo] load skipped', diag);
      return Promise.resolve(diag);
    }
    var db = firebase.firestore();
    var ids = diag.vendorIds;
    if (!ids.length) {
      if (root.console) root.console.info('[mobile-barber-promo] load skipped — no vendor ids', diag);
      return Promise.resolve(diag);
    }
    return Promise.all(ids.map(function(vendorId) {
      return db.collection(diag.collection).doc(vendorId).get()
        .then(function(doc) {
          var data = doc.exists ? (doc.data() || {}) : {};
          // ONLY override the runtime overlay when Firestore explicitly
          // carries a `promotions` array (even if empty — vendor may have
          // deliberately cleared everything). If the field is absent, leave
          // the runtime map untouched so _vendorPromosFor falls back to the
          // static seed and the demo promo continues to show.
          if (Array.isArray(data.promotions)) {
            _setVendorPromos(vendorId, data.promotions);
            diag.promosByVendor[vendorId] = data.promotions.length;
          } else {
            diag.promosByVendor[vendorId] = 'using-seed';
          }
          // Live working hours + calendar blocks ride on the same doc. Only
          // override when the field is present so a vendor who never opened
          // the hours/blocks tab still falls back to the static seed.
          if (data.availability && typeof data.availability === 'object') {
            window._mbVendorAvailByVendor[vendorId] = data.availability;
          }
          if (Array.isArray(data.unavailableBlocks)) {
            window._mbVendorBlocksByVendor[vendorId] = data.unavailableBlocks.slice();
          }
          return diag.promosByVendor[vendorId];
        })
        .catch(function(err) {
          diag.errors[vendorId] = (err && err.code) || (err && err.message) || 'error';
          return 0;
        });
    })).then(function() {
      if (root.console) root.console.info('[mobile-barber-promo] loaded from ' + diag.collection, diag);
      return diag;
    });
  }

  function refreshLiveBookingData(vendor) {
    var vendorId = vendor && vendor.id;
    var diag = {
      vendorId: vendorId || '',
      servicesLoaded: 0,
      promotionsLoaded: vendor && Array.isArray(vendor.promotions) ? vendor.promotions.length : 0,
      scheduleLoaded: false,
      source: 'static-fallback'
    };
    if (!vendorId || typeof firebase === 'undefined' || !firebase.firestore || !firebase.apps || !firebase.apps.length) {
      if (root.console) root.console.log('[booking-live-data]', JSON.stringify(diag));
      return Promise.resolve({ vendor: _vendorWithPromos(vendor), services: servicesForVendor(vendorId), source: 'static-fallback' });
    }
    var db = firebase.firestore();
    var liveVendor = vendor;
    var vendorRead = db.collection(_mbCollection()).doc(vendorId).get().then(function(doc) {
      var data = doc.exists ? (doc.data() || {}) : {};
      if (Array.isArray(data.promotions)) _setVendorPromos(vendorId, data.promotions);
      if (data.availability && typeof data.availability === 'object') window._mbVendorAvailByVendor[vendorId] = data.availability;
      if (Array.isArray(data.unavailableBlocks)) window._mbVendorBlocksByVendor[vendorId] = data.unavailableBlocks.slice();
      liveVendor = _vendorWithPromos(vendor);
      diag.promotionsLoaded = Array.isArray(_vendorPromosFor(vendorId)) ? _vendorPromosFor(vendorId).length : 0;
      diag.scheduleLoaded = !!(window._mbVendorAvailByVendor[vendorId] && window._mbVendorAvailByVendor[vendorId].weeklyHours);
    });
    var serviceRead = db.collection((DATA && DATA.COLLECTIONS && DATA.COLLECTIONS.services) || 'mobileBarberServices')
      .where('vendorId', '==', vendorId)
      .get()
      .then(function(snapshot) {
        var rows = [];
        snapshot.forEach(function(doc) {
          var data = doc.data() || {};
          data.id = data.id || doc.id;
          if (data.active !== false) rows.push(data);
        });
        if (rows.length) _setVendorServices(vendorId, rows);
        diag.servicesLoaded = rows.length || servicesForVendor(vendorId).length;
      });
    return Promise.all([vendorRead, serviceRead]).then(function() {
      diag.source = 'firestore';
      if (root.console) root.console.log('[booking-live-data]', JSON.stringify(diag));
      return { vendor: liveVendor, services: servicesForVendor(vendorId), source: 'firestore' };
    }).catch(function() {
      diag.servicesLoaded = servicesForVendor(vendorId).length;
      if (root.console) root.console.log('[booking-live-data]', JSON.stringify(diag));
      return { vendor: _vendorWithPromos(vendor), services: servicesForVendor(vendorId), source: 'static-fallback' };
    });
  }

  var _vendorPromoUnsubs = [];
  function subscribeVendorPromos() {
    if (typeof firebase === 'undefined' || !firebase.firestore || !firebase.apps || !firebase.apps.length) return;
    _vendorPromoUnsubs.forEach(function(fn) { try { fn(); } catch (e) {} });
    _vendorPromoUnsubs = [];
    var db = firebase.firestore();
    var collection = _mbCollection();
    _mbVendorIds().forEach(function(vendorId) {
      try {
        var unsub = db.collection(collection).doc(vendorId)
          .onSnapshot(function(doc) {
            if (!doc.exists) return;
            var data = doc.data() || {};
            var before = JSON.stringify(_vendorPromosFor(vendorId) || []);
            if (Array.isArray(data.promotions)) {
              _setVendorPromos(vendorId, data.promotions);
            }
            // Keep live hours + blocks in sync on every snapshot so a block
            // the vendor adds mid-session immediately gates new bookings.
            if (data.availability && typeof data.availability === 'object') {
              window._mbVendorAvailByVendor[vendorId] = data.availability;
            }
            if (Array.isArray(data.unavailableBlocks)) {
              window._mbVendorBlocksByVendor[vendorId] = data.unavailableBlocks.slice();
            }
            var after = JSON.stringify(_vendorPromosFor(vendorId) || []);
            if (before !== after) {
              if (root.console) root.console.info('[mobile-barber-promo] live update', {
                vendorId: vendorId, count: (_vendorPromosFor(vendorId) || []).length
              });
              renderHeroShowcase();
              renderServices();
            }
          }, function(err) {
            if (root.console) root.console.warn('[mobile-barber-promo] listener error', vendorId, err && err.code);
          });
        _vendorPromoUnsubs.push(unsub);
      } catch (e) {}
    });
  }

  // ── Canonical promo helpers (public surface promised by the spec) ──────
  // These wrap the existing DATA module so the customer-facing layer has a
  // simple, predictable API regardless of how the underlying lookup evolves.
  function getActiveMobileBarberPromotions(opts) {
    opts = opts || {};
    var now = opts.now || new Date();
    var iso = now.toISOString().slice(0, 10);
    var vendors = (DATA && DATA.sampleVendors) ? DATA.sampleVendors : [];
    var out = [];
    vendors.forEach(function(vendor) {
      if (!vendor || vendor.active === false) return;
      if (opts.vendorId && vendor.id !== opts.vendorId) return;
      // Read from the runtime overlay so Firestore-saved promos surface even
      // though the static vendor object is frozen.
      _vendorPromosFor(vendor.id).forEach(function(p) {
        if (!p || p.active !== true) return;
        if (p.displayOnCustomerPage === false) return;
        if (p.startDate && iso < p.startDate) return;
        if (p.endDate && iso > p.endDate) return;
        var max = Number(p.maxRedemptions || 0);
        var cur = Number(p.currentRedemptions || 0);
        if (max > 0 && cur >= max) return;
        if (opts.serviceId && p.applyToScope === 'selected') {
          if (!(Array.isArray(p.appliesToServiceIds) && p.appliesToServiceIds.indexOf(opts.serviceId) >= 0)) return;
        }
        out.push(Object.assign({}, p, { vendorId: vendor.id }));
      });
    });
    return out;
  }

  function getBestPromotionForService(service, promotions) {
    if (!service) return null;
    var pool = Array.isArray(promotions)
      ? promotions
      : getActiveMobileBarberPromotions({ serviceId: service.id });
    if (!pool.length) return null;
    var matching = pool.filter(function(p) {
      if (!p) return false;
      if (p.applyToScope === 'selected') {
        return Array.isArray(p.appliesToServiceIds) && p.appliesToServiceIds.indexOf(service.id) >= 0;
      }
      return true;
    });
    if (!matching.length) return null;
    matching.sort(function(a, b) {
      var pctDiff = Number(b.discountPercent || 0) - Number(a.discountPercent || 0);
      if (pctDiff !== 0) return pctDiff;
      var aEnd = a.endDate || '9999-12-31';
      var bEnd = b.endDate || '9999-12-31';
      return aEnd < bEnd ? -1 : (aEnd > bEnd ? 1 : 0);
    });
    return matching[0];
  }

  function applyPromotionToServicePrice(service, promotions) {
    var base = Number(service && service.price || 0);
    var best = getBestPromotionForService(service, promotions);
    if (!best) return { promotion: null, originalPrice: base, discountedPrice: base, discountPercent: 0, promoApplied: false };
    var applied = DATA && DATA.applyPromotionToPrice
      ? DATA.applyPromotionToPrice(base, best)
      : { discountPercent: Number(best.discountPercent || 0), originalPrice: base, discountedPrice: Math.round(base * (1 - Number(best.discountPercent || 0) / 100)) };
    return {
      promotion: best,
      originalPrice: applied.originalPrice,
      discountedPrice: applied.discountedPrice,
      discountPercent: applied.discountPercent,
      promoApplied: applied.discountPercent > 0
    };
  }

  function renderPromotionHero(promotions) {
    // Thin alias. If a caller passes an explicit promotions array we hand it
    // through window._mbForceHeroPromos so collectActiveCustomerPromos can
    // prefer it, then re-render the showcase rotation.
    if (Array.isArray(promotions)) window._mbForceHeroPromos = promotions;
    else window._mbForceHeroPromos = null;
    renderHeroShowcase();
  }

  if (typeof window !== 'undefined') {
    window.getActiveMobileBarberPromotions = getActiveMobileBarberPromotions;
    window.getBestPromotionForService     = getBestPromotionForService;
    window.applyPromotionToServicePrice   = applyPromotionToServicePrice;
    window.renderPromotionHero            = renderPromotionHero;
    window._mbLoadVendorPromosFromFirestore = loadVendorPromosFromFirestore;
  }

  // ── Hero promo spotlight ───────────────────────────────────────────────
  // Walks every active mobile-barber vendor and finds the best active promo
  // to feature in the hero. Priority: highest discountPercent, then nearest
  // expiration. If none → hide the slot. If 2+ → rotate every 7s.
  function collectActiveCustomerPromos() {
    // Allow callers to force a specific list via renderPromotionHero(arr).
    if (Array.isArray(window._mbForceHeroPromos)) return window._mbForceHeroPromos.slice();
    var vendors = (DATA && DATA.sampleVendors) ? DATA.sampleVendors : [];
    var now = new Date();
    var iso = now.toISOString().slice(0, 10);
    var promos = [];
    vendors.forEach(function(vendor) {
      if (!vendor || vendor.active === false) return;
      // Runtime overlay first (Firestore + seed); falls back to the
      // (frozen) static catalog when nothing is loaded yet.
      var list = _vendorPromosFor(vendor.id);
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

  // Expose collectActiveCustomerPromos for tests + the showcase renderer.
  // The old standalone floating hero spotlight card was removed — promos
  // now lead the renderHeroShowcase rotation as the single integrated
  // promo presentation in the hero.
  if (typeof window !== 'undefined') {
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
