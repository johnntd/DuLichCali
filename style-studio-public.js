'use strict';
// ─────────────────────────────────────────────────────────────────────────
// AI Style Studio — PUBLIC client  (style-studio-public.js?v=20260614a)
//
// Powers /style-studio: the one-click AI Master Stylist hero + the 9 manual
// modes. Signs the visitor in with Firebase ANONYMOUS auth, then calls the
// public callable `generateStyleStudioPublic` (anon-auth OK, promo-gated,
// per-uid daily counter). Reuses window.MobileBarberAIPreview (selfie
// compression / local cache). Image viewing uses a SELF-CONTAINED full-screen
// viewer (ss-viewer) — NOT the vendor MBLightbox (whose CSS isn't on this page,
// which caused the post-generate scroll-lock/freeze).
//
// CUSTOMER ACCOUNT — REUSES the mobile-barber customer auth scheme exactly:
// derived email = normalizePhone(phone) + '@mobile-barber.dulichcali21.local',
// Firebase email/password auth with LOCAL persistence, profile written to
// mobileBarberCustomers/{uid} (matching isValidMobileBarberCustomerCreate). The
// SAME account works on /mobile-barber and here — no new auth identity. The
// account UI is a non-trapping inline panel (no scroll lock). Anonymous guest
// flow is preserved: logout re-signs-in anonymously.
//
// MOBILE UX: full-screen viewer with pinch-zoom + swipe + close; iOS-safe
// scroll lock that RESTORES on close (position:fixed technique); goal chips
// (not a thin select); swipeable result carousel; iOS-robust save (Web Share
// file → desktop download → "press & hold to save" fallback — never silent).
//
// PRIVACY-FIRST — NEVER writes selfies or generated images to Firestore/Storage.
// Save/export/share are native + local only; the only server-side state is an
// integer counter written by the Function (Admin SDK).
//
// MULTILINGUAL — every user-facing string is in vi/en/es via SS_STRINGS.
// ─────────────────────────────────────────────────────────────────────────
(function (root) {
  if (!root || !root.document) return;
  var doc = root.document;

  // ── i18n tables: en / vi / es ─────────────────────────────────────────
  var SS_STRINGS = {
    en: {
      heroChip: 'AI Master Stylist',
      heroTitle: 'Your Best Look, by AI',
      heroSub: 'Upload a selfie and let AI create your best look — one masterpiece, designed for your face.',
      consent: 'I consent to AI analysing my photo to design a style preview.',
      uploadCta: 'Upload or take a selfie',
      photoReady: 'Photo ready — pick a goal and generate.',
      consentRequired: 'Please confirm consent first.',
      goalLabel: 'Style goal (optional)',
      goalAuto: 'Most flattering overall (auto)',
      goalBest: 'Best Overall',
      goal_professional: 'Professional', goal_youthful: 'Youthful', goal_elegant: 'Elegant',
      goal_executive: 'Executive', goal_natural: 'Natural', goal_confident: 'Confident',
      goal_wedding: 'Wedding', goal_vacation: 'Vacation', goal_party: 'Party',
      goal_business: 'Business', goal_soft: 'Soft', goal_masculine: 'Masculine',
      goal_feminine: 'Feminine', goal_cute: 'Cute', goal_glamorous: 'Glamorous',
      generateBest: 'Generate My Best Look',
      generating: 'Designing your best look…',
      signingIn: 'Starting your free session…',
      ready: 'Ready — upload a selfie to begin.',
      // Never-silent feedback + progress + retry (P0 fix).
      busyWait: 'A look is still generating — please wait…',
      needSelfie: 'Please upload a selfie first.',
      preparingSession: 'Starting your free session…',
      sessionError: 'Couldn’t start your session. Please refresh and try again.',
      prog_analyzing: 'Analyzing your face…',
      prog_harmony: 'Studying facial harmony…',
      prog_designing: 'Designing your best look…',
      prog_generating: 'Generating your masterpiece…',
      genFailed: 'We couldn’t create your look right now.',
      retry: 'Try again',
      masterTitle: 'Your AI Master Stylist look',
      explanationLabel: 'Why this look suits you',
      attr_haircut: 'Haircut', attr_color: 'Color', attr_texture: 'Texture', attr_bangs: 'Bangs',
      attr_eyebrows: 'Eyebrows', attr_beard: 'Beard', attr_wigOrSystem: 'Wig / Hair system',
      banner: 'Free AI style preview during launch.',
      saveToPhone: 'Save', share: 'Share', expand: 'Expand', favorite: 'Favorite', unfavorite: 'Saved ✓',
      modesTitle: 'Explore more looks',
      modesSub: 'Pick a studio and generate five looks to compare — same engine, more control.',
      audienceLabel: 'Audience',
      aud_neutral: 'Auto', aud_man: 'Man', aud_woman: 'Woman', aud_child: 'Child',
      mode_haircut: 'Hair Styles', mode_color: 'Hair Colors', mode_texture: 'Texture',
      mode_eyebrow: 'Eyebrows', mode_beard: 'Beards', mode_wig: 'Wigs',
      mode_hairsystem: 'Hair Systems', mode_event: 'Event Looks', mode_vacation: 'Vacation Looks',
      modeGenerate: 'Generate looks',
      showcaseTitle: 'What AI can design for you',
      sc1_title: 'AI Master Stylist', sc1_benefit: 'One perfect look, designed for your face.', sc1_cta: 'Create my look',
      sc2_title: 'AI Wig Match', sc2_benefit: 'Find the most natural wig for you.', sc2_cta: 'Match a wig',
      sc3_title: 'Hair Color Preview', sc3_benefit: 'See yourself in a new shade — risk-free.', sc3_cta: 'Try colors',
      sc4_title: 'Eyebrow & Beard', sc4_benefit: 'Refine your grooming with AI.', sc4_cta: 'Groom',
      sc5_title: 'Event & Vacation Look', sc5_benefit: 'Get ready for the big day or the getaway.', sc5_cta: 'Get the look',
      wigChip: 'AI Wig Match',
      wigTitle: 'AI Wig Match',
      wigSub: 'AI analyses your face and finds the most natural wig for you — see yourself wearing each one.',
      wigCta: 'Find My Best Wig',
      wigBest: 'Best natural match',
      wigNeedSelfie: 'Upload a selfie above to start.',
      wigGenerating: 'Matching the most natural wig for you…',
      wigNaturalFit: 'Natural fit',
      wigMore: 'More wig options',
      membershipTitle: 'Keep your momentum going',
      membershipPrompt: 'You have used your free previews. Create a free account to keep generating new looks.',
      membershipCta: 'Create a free account',
      privacyNote: 'Your selfie is used only to generate your style preview. We do not store your photo or the result — you can save the look to your phone yourself.',
      backHome: '← Back to Du Lich Cali',
      error: 'Something went wrong. Please try again.',
      loginWall: 'You have reached your free preview limit. Create a free account to continue.',
      viewerClose: 'Close', viewerPrev: 'Previous look', viewerNext: 'Next look',
      pressHold: 'Press and hold the image to save to Photos.',
      err_INVALID_INPUT: 'Please choose a valid photo.',
      err_BAD_MIME: 'That photo format is not supported. Use JPEG, PNG or WebP.',
      err_IMAGE_TOO_LARGE: 'That photo is too large. Please use a smaller one.',
      err_NO_GEMINI_KEY: 'AI Style Studio is temporarily unavailable. Please try again later.',
      err_MASTER_PLAN_ERROR: 'The Master Stylist could not analyse that photo. Try a clearer, well-lit selfie.',
      err_MASTER_EMPTY: 'The Master Stylist could not design a look. Try a clearer, front-facing selfie.',
      err_MASTER_EDIT_ERROR: 'The Master Stylist could not render the look. Please try again.',
      err_PLAN_ERROR: 'Style analysis failed. Please try again.',
      err_PLAN_EMPTY: 'No styles could be generated. Try a clearer photo.',
      err_EDIT_ERROR: 'The previews could not be rendered. Please try again.',
      err_EDIT_ALL_FAILED: 'Could not generate a preview image. Please try again with a clear, well-lit photo.',
      err_REALISM_FAILED: 'We couldn’t create a natural-looking result from this photo. Please try a clearer selfie with good lighting (face the camera, hair visible, no hat or sunglasses).',
      // Wig-intelligence: explains why a wig was / was not recommended.
      wigNote_none: 'Your current hair volume looks workable — AI recommends a natural haircut/style improvement instead of added hair.',
      wigNote_optional: 'A fuller look may help, but a subtle natural hairstyle may be enough.',
      wigNote_recommended: 'A natural fuller-hair option may create a more balanced, youthful look.',
      // Pre-upload photo guidance for the best, most natural results.
      selfieTips: 'For best results: face the camera, good lighting, hair & hairline visible, no hat or sunglasses, simple background.',
      err_DAILY_LIMIT: 'You’ve reached today’s limit — please try again tomorrow.',
      // Customer account (reuses the mobile-barber customer auth).
      logIn: 'Log in', signUp: 'Sign up', logInOrSignUp: 'Log in / Sign up',
      myAccount: 'My account', logout: 'Log out', close: 'Close',
      authTitleLogin: 'Log in to your account',
      authTitleSignup: 'Create a free account',
      authIntro: 'Your account works across Du Lich Cali — keep your looks and book with one tap.',
      name: 'Your name', phone: 'Phone number', password: 'Password',
      authToggleToSignup: 'New here? Create an account',
      authToggleToLogin: 'Already have an account? Log in',
      submitLogin: 'Log in', submitSignup: 'Create account',
      passwordHelp: 'Use at least 8 characters with a mix of letters and numbers.',
      welcomeBack: 'Welcome back',
      authMissingFields: 'Please enter your phone and password.',
      authWeakPassword: 'Please choose a stronger password (at least 8 characters).',
      authInvalidPhone: 'Please enter a valid phone number.',
      authError: 'We could not sign you in. Please check your details and try again.',
      authEmailInUse: 'An account already exists for this phone. Try logging in instead.',
      authWrongPassword: 'Incorrect phone or password. Please try again.',
      authUserNotFound: 'No account found for this phone. Create one to continue.',
      authTooManyRequests: 'Too many attempts. Please wait a moment and try again.',
      working: 'Please wait…',
      // SP-3 — emotional taglines + section framing.
      heroTagline: 'Discover your best look.',
      heroBenefit: 'Look younger. Feel confident.',
      // SP-3 — AI Wig Match co-flagship benefits checklist.
      wigBenefit1: 'Fuller hair',
      wigBenefit2: 'Younger appearance',
      wigBenefit3: 'Natural look',
      wigBenefit4: 'Professional style',
      // SP-4 — Wig Match example strip (style inspiration, not AI output).
      wigExHeader: 'See the look',
      wigExMale: 'Modern Korean — full, natural hair',
      wigExFemale: 'Elegant layers — youthful volume',
      // SP-3 — Studio Gallery (Netflix-style cards): emotional one-liners.
      gallery_haircut: 'Find the cut that frames your face.',
      gallery_color: 'See a new shade before you commit.',
      gallery_texture: 'Curly, straight or wavy — try it on.',
      gallery_eyebrow: 'Frame your eyes with the perfect brow.',
      gallery_beard: 'Shape the beard that suits your jaw.',
      gallery_wig: 'Discover the most natural wig for you.',
      gallery_hairsystem: 'Restore fuller hair, naturally.',
      gallery_event: 'Get ready for the big day.',
      gallery_vacation: 'Pack your best look for the trip.',
      galleryTitle: 'The Studio',
      gallerySub: 'Nine ways to reimagine your look — same AI engine, more control.',
      optionsLabel: 'Choose a style',
      generate: 'Generate',
      // SP-3 — Before / After (real selfie → AI result).
      before: 'Before', after: 'After',
      beforeAfter: 'Before / After', dragToCompare: 'Drag to compare',
      showOriginal: 'Show original', showResult: 'Show result',
      viewerToggleBefore: 'See your photo', viewerToggleAfter: 'See the result',
      // SP-3 — Testimonials (LAUNCH PLACEHOLDERS — replace with real reviews).
      testimonialsTitle: 'Loved by people like you',
      testimonial1: 'I never knew this hairstyle would fit me so well.',
      testimonial2: 'This helped me decide on a wig before buying.',
      testimonial3: 'I looked years younger — and finally felt confident.',
      testimonialName1: 'Lan', testimonialName2: 'Maria', testimonialName3: 'David',
      // SP-3 — Account panel (favorites + history, all local).
      accountTitle: 'My account',
      tabFavorites: 'Favorites', tabHistory: 'Saved looks',
      noFavorites: 'Tap the heart on any look to save it here.',
      noHistory: 'Your generated looks will appear here.',
      favoritesHint: 'Saved on this device only.',
      removeFavorite: 'Remove',
    },
    vi: {
      heroChip: 'Chuyên Gia Tạo Kiểu AI',
      heroTitle: 'Diện Mạo Đẹp Nhất Của Bạn, Bằng AI',
      heroSub: 'Tải lên ảnh selfie và để AI tạo nên diện mạo đẹp nhất cho bạn — một tác phẩm hoàn hảo, thiết kế riêng cho gương mặt bạn.',
      consent: 'Tôi đồng ý để AI phân tích ảnh của tôi nhằm tạo bản xem trước kiểu dáng.',
      uploadCta: 'Tải lên hoặc chụp ảnh selfie',
      photoReady: 'Ảnh đã sẵn sàng — chọn mục tiêu và tạo kiểu.',
      consentRequired: 'Vui lòng xác nhận đồng ý trước.',
      goalLabel: 'Mục tiêu phong cách (tùy chọn)',
      goalAuto: 'Đẹp hài hòa nhất (tự động)',
      goalBest: 'Đẹp Nhất Tổng Thể',
      goal_professional: 'Chuyên nghiệp', goal_youthful: 'Trẻ trung', goal_elegant: 'Thanh lịch',
      goal_executive: 'Lãnh đạo', goal_natural: 'Tự nhiên', goal_confident: 'Tự tin',
      goal_wedding: 'Đám cưới', goal_vacation: 'Du lịch', goal_party: 'Tiệc tùng',
      goal_business: 'Công sở', goal_soft: 'Dịu dàng', goal_masculine: 'Nam tính',
      goal_feminine: 'Nữ tính', goal_cute: 'Dễ thương', goal_glamorous: 'Quyến rũ',
      generateBest: 'Tạo Diện Mạo Đẹp Nhất',
      generating: 'Đang thiết kế diện mạo đẹp nhất cho bạn…',
      signingIn: 'Đang bắt đầu phiên miễn phí của bạn…',
      ready: 'Sẵn sàng — tải ảnh selfie để bắt đầu.',
      // Phản hồi luôn hiển thị + tiến trình + thử lại (sửa lỗi P0).
      busyWait: 'Một kiểu đang được tạo — vui lòng đợi…',
      needSelfie: 'Vui lòng tải ảnh selfie trước.',
      preparingSession: 'Đang bắt đầu phiên miễn phí của bạn…',
      sessionError: 'Không thể bắt đầu phiên. Vui lòng tải lại trang và thử lại.',
      prog_analyzing: 'Đang phân tích gương mặt của bạn…',
      prog_harmony: 'Đang nghiên cứu sự hài hòa khuôn mặt…',
      prog_designing: 'Đang thiết kế diện mạo đẹp nhất cho bạn…',
      prog_generating: 'Đang tạo tác phẩm của bạn…',
      genFailed: 'Hiện chúng tôi chưa thể tạo diện mạo cho bạn.',
      retry: 'Thử lại',
      masterTitle: 'Diện mạo từ Chuyên Gia Tạo Kiểu AI',
      explanationLabel: 'Vì sao kiểu này hợp với bạn',
      attr_haircut: 'Kiểu tóc', attr_color: 'Màu tóc', attr_texture: 'Kết cấu tóc', attr_bangs: 'Mái tóc',
      attr_eyebrows: 'Chân mày', attr_beard: 'Râu', attr_wigOrSystem: 'Tóc giả / Hệ thống tóc',
      banner: 'Xem trước kiểu dáng AI miễn phí trong thời gian ra mắt.',
      saveToPhone: 'Lưu', share: 'Chia sẻ', expand: 'Phóng to', favorite: 'Yêu thích', unfavorite: 'Đã lưu ✓',
      modesTitle: 'Khám phá thêm kiểu dáng',
      modesSub: 'Chọn một studio và tạo năm kiểu để so sánh — cùng công nghệ, nhiều tùy chọn hơn.',
      audienceLabel: 'Đối tượng',
      aud_neutral: 'Tự động', aud_man: 'Nam', aud_woman: 'Nữ', aud_child: 'Trẻ em',
      mode_haircut: 'Kiểu Tóc', mode_color: 'Màu Tóc', mode_texture: 'Kết Cấu Tóc',
      mode_eyebrow: 'Chân Mày', mode_beard: 'Râu', mode_wig: 'Tóc Giả',
      mode_hairsystem: 'Hệ Thống Tóc', mode_event: 'Kiểu Sự Kiện', mode_vacation: 'Kiểu Du Lịch',
      modeGenerate: 'Tạo kiểu',
      showcaseTitle: 'AI có thể thiết kế gì cho bạn',
      sc1_title: 'Chuyên Gia Tạo Kiểu AI', sc1_benefit: 'Một diện mạo hoàn hảo, thiết kế cho gương mặt bạn.', sc1_cta: 'Tạo diện mạo',
      sc2_title: 'Ghép Tóc Giả AI', sc2_benefit: 'Tìm bộ tóc giả tự nhiên nhất cho bạn.', sc2_cta: 'Ghép tóc giả',
      sc3_title: 'Xem Trước Màu Tóc', sc3_benefit: 'Thử màu tóc mới — không rủi ro.', sc3_cta: 'Thử màu',
      sc4_title: 'Chân Mày & Râu', sc4_benefit: 'Tinh chỉnh diện mạo cùng AI.', sc4_cta: 'Chỉnh tỉa',
      sc5_title: 'Kiểu Sự Kiện & Du Lịch', sc5_benefit: 'Sẵn sàng cho ngày trọng đại hay chuyến đi.', sc5_cta: 'Xem kiểu',
      wigChip: 'Ghép Tóc Giả AI',
      wigTitle: 'Ghép Tóc Giả AI',
      wigSub: 'AI phân tích gương mặt và tìm bộ tóc giả tự nhiên nhất cho bạn — thấy chính bạn đang đội từng kiểu.',
      wigCta: 'Tìm Tóc Giả Đẹp Nhất',
      wigBest: 'Ghép tự nhiên nhất',
      wigNeedSelfie: 'Tải ảnh selfie ở trên để bắt đầu.',
      wigGenerating: 'Đang ghép bộ tóc giả tự nhiên nhất cho bạn…',
      wigNaturalFit: 'Hợp tự nhiên',
      wigMore: 'Thêm lựa chọn tóc giả',
      membershipTitle: 'Tiếp tục khám phá',
      membershipPrompt: 'Bạn đã dùng hết lượt xem trước miễn phí. Tạo tài khoản miễn phí để tiếp tục tạo kiểu mới.',
      membershipCta: 'Tạo tài khoản miễn phí',
      privacyNote: 'Ảnh selfie của bạn chỉ được dùng để tạo bản xem trước kiểu dáng. Chúng tôi không lưu ảnh hay kết quả — bạn có thể tự lưu kiểu về máy.',
      backHome: '← Quay lại Du Lich Cali',
      error: 'Đã có lỗi xảy ra. Vui lòng thử lại.',
      loginWall: 'Bạn đã đạt giới hạn xem trước miễn phí. Tạo tài khoản miễn phí để tiếp tục.',
      viewerClose: 'Đóng', viewerPrev: 'Kiểu trước', viewerNext: 'Kiểu tiếp',
      pressHold: 'Nhấn giữ ảnh để lưu vào Ảnh.',
      err_INVALID_INPUT: 'Vui lòng chọn một ảnh hợp lệ.',
      err_BAD_MIME: 'Định dạng ảnh không được hỗ trợ. Hãy dùng JPEG, PNG hoặc WebP.',
      err_IMAGE_TOO_LARGE: 'Ảnh quá lớn. Vui lòng dùng ảnh nhỏ hơn.',
      err_NO_GEMINI_KEY: 'Studio Tạo Kiểu AI tạm thời không khả dụng. Vui lòng thử lại sau.',
      err_MASTER_PLAN_ERROR: 'Chuyên gia AI không thể phân tích ảnh đó. Hãy thử ảnh selfie rõ nét, đủ sáng hơn.',
      err_MASTER_EMPTY: 'Chuyên gia AI không thể thiết kế kiểu. Hãy thử ảnh selfie rõ nét, nhìn thẳng.',
      err_MASTER_EDIT_ERROR: 'Chuyên gia AI không thể dựng kiểu. Vui lòng thử lại.',
      err_PLAN_ERROR: 'Phân tích kiểu dáng thất bại. Vui lòng thử lại.',
      err_PLAN_EMPTY: 'Không tạo được kiểu nào. Hãy thử ảnh rõ nét hơn.',
      err_EDIT_ERROR: 'Không thể dựng bản xem trước. Vui lòng thử lại.',
      err_EDIT_ALL_FAILED: 'Không tạo được ảnh xem trước. Vui lòng thử lại với ảnh rõ nét, đủ sáng.',
      err_REALISM_FAILED: 'Chưa tạo được kết quả trông tự nhiên từ ảnh này. Vui lòng thử ảnh selfie rõ hơn, đủ sáng (nhìn thẳng máy ảnh, thấy rõ tóc, không đội mũ hay đeo kính râm).',
      wigNote_none: 'Lượng tóc hiện tại của bạn khá ổn — AI gợi ý cải thiện kiểu cắt/tạo kiểu tự nhiên thay vì thêm tóc.',
      wigNote_optional: 'Tóc dày hơn có thể đẹp hơn, nhưng một kiểu tóc tự nhiên nhẹ nhàng có thể đã đủ.',
      wigNote_recommended: 'Lựa chọn tóc dày tự nhiên có thể tạo diện mạo cân đối và trẻ trung hơn.',
      selfieTips: 'Để có kết quả tốt nhất: nhìn thẳng máy ảnh, đủ sáng, thấy rõ tóc và chân tóc, không đội mũ hay kính râm, nền đơn giản.',
      err_DAILY_LIMIT: 'Bạn đã đạt giới hạn hôm nay — vui lòng thử lại vào ngày mai.',
      // Tài khoản khách hàng (dùng chung hệ thống đăng nhập Mobile Barber).
      logIn: 'Đăng nhập', signUp: 'Đăng ký', logInOrSignUp: 'Đăng nhập / Đăng ký',
      myAccount: 'Tài khoản', logout: 'Đăng xuất', close: 'Đóng',
      authTitleLogin: 'Đăng nhập tài khoản',
      authTitleSignup: 'Tạo tài khoản miễn phí',
      authIntro: 'Tài khoản của bạn dùng chung trên Du Lich Cali — lưu kiểu dáng và đặt lịch chỉ với một chạm.',
      name: 'Tên của bạn', phone: 'Số điện thoại', password: 'Mật khẩu',
      authToggleToSignup: 'Lần đầu? Tạo tài khoản',
      authToggleToLogin: 'Đã có tài khoản? Đăng nhập',
      submitLogin: 'Đăng nhập', submitSignup: 'Tạo tài khoản',
      passwordHelp: 'Dùng ít nhất 8 ký tự, kết hợp chữ và số.',
      welcomeBack: 'Chào mừng trở lại',
      authMissingFields: 'Vui lòng nhập số điện thoại và mật khẩu.',
      authWeakPassword: 'Vui lòng chọn mật khẩu mạnh hơn (ít nhất 8 ký tự).',
      authInvalidPhone: 'Vui lòng nhập số điện thoại hợp lệ.',
      authError: 'Không thể đăng nhập. Vui lòng kiểm tra lại thông tin và thử lại.',
      authEmailInUse: 'Đã có tài khoản cho số này. Hãy thử đăng nhập.',
      authWrongPassword: 'Sai số điện thoại hoặc mật khẩu. Vui lòng thử lại.',
      authUserNotFound: 'Không tìm thấy tài khoản cho số này. Hãy tạo mới để tiếp tục.',
      authTooManyRequests: 'Quá nhiều lần thử. Vui lòng chờ một chút rồi thử lại.',
      working: 'Vui lòng đợi…',
      // SP-3 — câu khẩu hiệu cảm xúc + khung mô tả.
      heroTagline: 'Khám phá diện mạo đẹp nhất của bạn.',
      heroBenefit: 'Trẻ trung hơn. Tự tin hơn.',
      // SP-3 — danh sách lợi ích của Ghép Tóc Giả AI.
      wigBenefit1: 'Tóc dày hơn',
      wigBenefit2: 'Diện mạo trẻ trung',
      wigBenefit3: 'Trông tự nhiên',
      wigBenefit4: 'Phong cách chuyên nghiệp',
      // SP-4 — dải ví dụ Ghép Tóc (gợi ý phong cách, không phải ảnh AI).
      wigExHeader: 'Xem diện mạo',
      wigExMale: 'Hàn Quốc hiện đại — tóc dày, tự nhiên',
      wigExFemale: 'Lớp tóc thanh lịch — bồng bềnh trẻ trung',
      // SP-3 — Studio (thẻ kiểu Netflix): câu mô tả cảm xúc.
      gallery_haircut: 'Tìm kiểu tóc tôn lên gương mặt bạn.',
      gallery_color: 'Xem màu tóc mới trước khi quyết định.',
      gallery_texture: 'Xoăn, thẳng hay gợn sóng — thử ngay.',
      gallery_eyebrow: 'Định hình chân mày hoàn hảo cho đôi mắt.',
      gallery_beard: 'Tạo dáng bộ râu hợp với khuôn hàm bạn.',
      gallery_wig: 'Khám phá bộ tóc giả tự nhiên nhất cho bạn.',
      gallery_hairsystem: 'Phục hồi mái tóc dày một cách tự nhiên.',
      gallery_event: 'Sẵn sàng cho ngày trọng đại.',
      gallery_vacation: 'Mang theo diện mạo đẹp nhất cho chuyến đi.',
      galleryTitle: 'Studio',
      gallerySub: 'Chín cách làm mới diện mạo — cùng công nghệ AI, nhiều tùy chọn hơn.',
      optionsLabel: 'Chọn một kiểu',
      generate: 'Tạo kiểu',
      // SP-3 — Trước / Sau (ảnh selfie thật → kết quả AI).
      before: 'Trước', after: 'Sau',
      beforeAfter: 'Trước / Sau', dragToCompare: 'Kéo để so sánh',
      showOriginal: 'Xem ảnh gốc', showResult: 'Xem kết quả',
      viewerToggleBefore: 'Xem ảnh của bạn', viewerToggleAfter: 'Xem kết quả',
      // SP-3 — Đánh giá (CHỖ TRỐNG RA MẮT — thay bằng đánh giá thật).
      testimonialsTitle: 'Được yêu thích bởi những người như bạn',
      testimonial1: 'Tôi chưa từng nghĩ kiểu tóc này lại hợp với mình đến vậy.',
      testimonial2: 'Điều này giúp tôi chọn được bộ tóc giả trước khi mua.',
      testimonial3: 'Tôi trông trẻ hơn nhiều — và cuối cùng đã thấy tự tin.',
      testimonialName1: 'Lan', testimonialName2: 'Maria', testimonialName3: 'David',
      // SP-3 — Bảng tài khoản (yêu thích + lịch sử, đều lưu cục bộ).
      accountTitle: 'Tài khoản của tôi',
      tabFavorites: 'Yêu thích', tabHistory: 'Kiểu đã lưu',
      noFavorites: 'Chạm vào trái tim trên bất kỳ kiểu nào để lưu vào đây.',
      noHistory: 'Các kiểu bạn tạo sẽ hiển thị tại đây.',
      favoritesHint: 'Chỉ lưu trên thiết bị này.',
      removeFavorite: 'Xóa',
    },
    es: {
      heroChip: 'Estilista Maestro AI',
      heroTitle: 'Tu Mejor Look, con AI',
      heroSub: 'Sube una selfie y deja que la AI cree tu mejor look — una obra maestra, diseñada para tu rostro.',
      consent: 'Doy mi consentimiento para que la AI analice mi foto y diseñe una vista previa de estilo.',
      uploadCta: 'Sube o toma una selfie',
      photoReady: 'Foto lista — elige un objetivo y genera.',
      consentRequired: 'Por favor confirma el consentimiento primero.',
      goalLabel: 'Objetivo de estilo (opcional)',
      goalAuto: 'El más favorecedor en general (automático)',
      goalBest: 'Mejor en General',
      goal_professional: 'Profesional', goal_youthful: 'Juvenil', goal_elegant: 'Elegante',
      goal_executive: 'Ejecutivo', goal_natural: 'Natural', goal_confident: 'Seguro',
      goal_wedding: 'Boda', goal_vacation: 'Vacaciones', goal_party: 'Fiesta',
      goal_business: 'Negocios', goal_soft: 'Suave', goal_masculine: 'Masculino',
      goal_feminine: 'Femenino', goal_cute: 'Tierno', goal_glamorous: 'Glamoroso',
      generateBest: 'Generar Mi Mejor Look',
      generating: 'Diseñando tu mejor look…',
      signingIn: 'Iniciando tu sesión gratuita…',
      ready: 'Listo — sube una selfie para empezar.',
      // Retroalimentación siempre visible + progreso + reintento (corrección P0).
      busyWait: 'Aún se está generando un look — por favor espera…',
      needSelfie: 'Por favor sube una selfie primero.',
      preparingSession: 'Iniciando tu sesión gratuita…',
      sessionError: 'No pudimos iniciar tu sesión. Actualiza la página e inténtalo de nuevo.',
      prog_analyzing: 'Analizando tu rostro…',
      prog_harmony: 'Estudiando la armonía facial…',
      prog_designing: 'Diseñando tu mejor look…',
      prog_generating: 'Generando tu obra maestra…',
      genFailed: 'No pudimos crear tu look en este momento.',
      retry: 'Intentar de nuevo',
      masterTitle: 'Tu look del Estilista Maestro AI',
      explanationLabel: 'Por qué este look te favorece',
      attr_haircut: 'Corte', attr_color: 'Color', attr_texture: 'Textura', attr_bangs: 'Flequillo',
      attr_eyebrows: 'Cejas', attr_beard: 'Barba', attr_wigOrSystem: 'Peluca / Sistema capilar',
      banner: 'Vista previa de estilo AI gratis durante el lanzamiento.',
      saveToPhone: 'Guardar', share: 'Compartir', expand: 'Ampliar', favorite: 'Favorito', unfavorite: 'Guardado ✓',
      modesTitle: 'Explora más looks',
      modesSub: 'Elige un estudio y genera cinco looks para comparar — el mismo motor, más control.',
      audienceLabel: 'Audiencia',
      aud_neutral: 'Automático', aud_man: 'Hombre', aud_woman: 'Mujer', aud_child: 'Niño',
      mode_haircut: 'Cortes', mode_color: 'Colores', mode_texture: 'Textura',
      mode_eyebrow: 'Cejas', mode_beard: 'Barbas', mode_wig: 'Pelucas',
      mode_hairsystem: 'Sistemas Capilares', mode_event: 'Looks de Evento', mode_vacation: 'Looks de Vacaciones',
      modeGenerate: 'Generar looks',
      showcaseTitle: 'Lo que la AI puede diseñar para ti',
      sc1_title: 'Estilista Maestro AI', sc1_benefit: 'Un look perfecto, diseñado para tu rostro.', sc1_cta: 'Crear mi look',
      sc2_title: 'Match de Peluca AI', sc2_benefit: 'Encuentra la peluca más natural para ti.', sc2_cta: 'Buscar peluca',
      sc3_title: 'Vista Previa de Color', sc3_benefit: 'Mírate con un nuevo tono — sin riesgo.', sc3_cta: 'Probar colores',
      sc4_title: 'Cejas y Barba', sc4_benefit: 'Refina tu arreglo con AI.', sc4_cta: 'Arreglar',
      sc5_title: 'Look de Evento y Vacaciones', sc5_benefit: 'Prepárate para el gran día o la escapada.', sc5_cta: 'Ver el look',
      wigChip: 'Match de Peluca AI',
      wigTitle: 'Match de Peluca AI',
      wigSub: 'La AI analiza tu rostro y encuentra la peluca más natural para ti — mírate usando cada una.',
      wigCta: 'Encontrar Mi Mejor Peluca',
      wigBest: 'Match más natural',
      wigNeedSelfie: 'Sube una selfie arriba para empezar.',
      wigGenerating: 'Buscando la peluca más natural para ti…',
      wigNaturalFit: 'Ajuste natural',
      wigMore: 'Más opciones de peluca',
      membershipTitle: 'Mantén el impulso',
      membershipPrompt: 'Has usado tus vistas previas gratuitas. Crea una cuenta gratis para seguir generando nuevos looks.',
      membershipCta: 'Crear una cuenta gratis',
      privacyNote: 'Tu selfie se usa solo para generar tu vista previa de estilo. No guardamos tu foto ni el resultado — puedes guardar el look en tu teléfono tú mismo.',
      backHome: '← Volver a Du Lich Cali',
      error: 'Algo salió mal. Por favor inténtalo de nuevo.',
      loginWall: 'Has alcanzado tu límite de vistas previas gratuitas. Crea una cuenta gratis para continuar.',
      viewerClose: 'Cerrar', viewerPrev: 'Look anterior', viewerNext: 'Look siguiente',
      pressHold: 'Mantén presionada la imagen para guardarla en Fotos.',
      err_INVALID_INPUT: 'Por favor elige una foto válida.',
      err_BAD_MIME: 'Ese formato de foto no es compatible. Usa JPEG, PNG o WebP.',
      err_IMAGE_TOO_LARGE: 'Esa foto es demasiado grande. Usa una más pequeña.',
      err_NO_GEMINI_KEY: 'El Estudio de Estilo AI no está disponible temporalmente. Inténtalo más tarde.',
      err_MASTER_PLAN_ERROR: 'El Estilista Maestro no pudo analizar esa foto. Prueba una selfie más nítida y bien iluminada.',
      err_MASTER_EMPTY: 'El Estilista Maestro no pudo diseñar un look. Prueba una selfie nítida y de frente.',
      err_MASTER_EDIT_ERROR: 'El Estilista Maestro no pudo generar el look. Inténtalo de nuevo.',
      err_PLAN_ERROR: 'El análisis de estilo falló. Inténtalo de nuevo.',
      err_PLAN_EMPTY: 'No se pudo generar ningún estilo. Prueba una foto más nítida.',
      err_EDIT_ERROR: 'No se pudieron generar las vistas previas. Inténtalo de nuevo.',
      err_EDIT_ALL_FAILED: 'No se pudo generar una imagen de vista previa. Inténtalo de nuevo con una foto nítida y bien iluminada.',
      err_REALISM_FAILED: 'No pudimos crear un resultado de aspecto natural con esta foto. Prueba una selfie más nítida con buena luz (mira a la cámara, cabello visible, sin gorra ni gafas de sol).',
      wigNote_none: 'Tu volumen de cabello actual se ve aprovechable — la IA recomienda mejorar el corte/estilo natural en lugar de añadir cabello.',
      wigNote_optional: 'Un look más abundante puede ayudar, pero un peinado natural sutil podría ser suficiente.',
      wigNote_recommended: 'Una opción de cabello más abundante y natural puede crear un look más equilibrado y juvenil.',
      selfieTips: 'Para mejores resultados: mira a la cámara, buena luz, cabello y nacimiento del pelo visibles, sin gorra ni gafas de sol, fondo simple.',
      err_DAILY_LIMIT: 'Has alcanzado el límite de hoy — inténtalo de nuevo mañana.',
      // Cuenta de cliente (reutiliza el inicio de sesión de Mobile Barber).
      logIn: 'Iniciar sesión', signUp: 'Registrarse', logInOrSignUp: 'Iniciar sesión / Registrarse',
      myAccount: 'Mi cuenta', logout: 'Cerrar sesión', close: 'Cerrar',
      authTitleLogin: 'Inicia sesión en tu cuenta',
      authTitleSignup: 'Crea una cuenta gratis',
      authIntro: 'Tu cuenta funciona en todo Du Lich Cali — guarda tus looks y reserva con un toque.',
      name: 'Tu nombre', phone: 'Número de teléfono', password: 'Contraseña',
      authToggleToSignup: '¿Nuevo aquí? Crea una cuenta',
      authToggleToLogin: '¿Ya tienes cuenta? Inicia sesión',
      submitLogin: 'Iniciar sesión', submitSignup: 'Crear cuenta',
      passwordHelp: 'Usa al menos 8 caracteres combinando letras y números.',
      welcomeBack: 'Bienvenido de nuevo',
      authMissingFields: 'Por favor ingresa tu teléfono y contraseña.',
      authWeakPassword: 'Por favor elige una contraseña más segura (al menos 8 caracteres).',
      authInvalidPhone: 'Por favor ingresa un número de teléfono válido.',
      authError: 'No pudimos iniciar tu sesión. Revisa tus datos e inténtalo de nuevo.',
      authEmailInUse: 'Ya existe una cuenta para este teléfono. Intenta iniciar sesión.',
      authWrongPassword: 'Teléfono o contraseña incorrectos. Inténtalo de nuevo.',
      authUserNotFound: 'No se encontró una cuenta para este teléfono. Crea una para continuar.',
      authTooManyRequests: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
      working: 'Por favor espera…',
      // SP-3 — eslóganes emocionales + marco de secciones.
      heroTagline: 'Descubre tu mejor look.',
      heroBenefit: 'Luce más joven. Siéntete seguro.',
      // SP-3 — lista de beneficios de Match de Peluca AI.
      wigBenefit1: 'Cabello más abundante',
      wigBenefit2: 'Apariencia más joven',
      wigBenefit3: 'Aspecto natural',
      wigBenefit4: 'Estilo profesional',
      // SP-4 — tira de ejemplos de Peluca (inspiración de estilo, no salida de IA).
      wigExHeader: 'Mira el look',
      wigExMale: 'Coreano moderno — cabello abundante y natural',
      wigExFemale: 'Capas elegantes — volumen juvenil',
      // SP-3 — Estudio (tarjetas estilo Netflix): frases emocionales.
      gallery_haircut: 'Encuentra el corte que enmarca tu rostro.',
      gallery_color: 'Mira un nuevo tono antes de decidir.',
      gallery_texture: 'Rizado, liso u ondulado — pruébalo.',
      gallery_eyebrow: 'Enmarca tus ojos con la ceja perfecta.',
      gallery_beard: 'Da forma a la barba que favorece tu mandíbula.',
      gallery_wig: 'Descubre la peluca más natural para ti.',
      gallery_hairsystem: 'Recupera un cabello más abundante, con naturalidad.',
      gallery_event: 'Prepárate para el gran día.',
      gallery_vacation: 'Lleva tu mejor look al viaje.',
      galleryTitle: 'El Estudio',
      gallerySub: 'Nueve formas de reinventar tu look — el mismo motor AI, más control.',
      optionsLabel: 'Elige un estilo',
      generate: 'Generar',
      // SP-3 — Antes / Después (selfie real → resultado AI).
      before: 'Antes', after: 'Después',
      beforeAfter: 'Antes / Después', dragToCompare: 'Arrastra para comparar',
      showOriginal: 'Ver original', showResult: 'Ver resultado',
      viewerToggleBefore: 'Ver tu foto', viewerToggleAfter: 'Ver el resultado',
      // SP-3 — Testimonios (MARCADORES DE LANZAMIENTO — reemplazar con reseñas reales).
      testimonialsTitle: 'Amado por personas como tú',
      testimonial1: 'Nunca imaginé que este peinado me quedaría tan bien.',
      testimonial2: 'Esto me ayudó a decidir una peluca antes de comprarla.',
      testimonial3: 'Me veía años más joven — y por fin me sentí seguro.',
      testimonialName1: 'Lan', testimonialName2: 'Maria', testimonialName3: 'David',
      // SP-3 — Panel de cuenta (favoritos + historial, todo local).
      accountTitle: 'Mi cuenta',
      tabFavorites: 'Favoritos', tabHistory: 'Looks guardados',
      noFavorites: 'Toca el corazón en cualquier look para guardarlo aquí.',
      noHistory: 'Tus looks generados aparecerán aquí.',
      favoritesHint: 'Guardado solo en este dispositivo.',
      removeFavorite: 'Quitar',
    },
  };

  // 15 style goals (mirror functions/style-studio-lib.js STUDIO_GOALS).
  var GOALS = ['professional', 'youthful', 'elegant', 'executive', 'natural', 'confident',
               'wedding', 'vacation', 'party', 'business', 'soft', 'masculine',
               'feminine', 'cute', 'glamorous'];

  var STUDIO_DEFS = [
    { mode: 'haircut', label: 'mode_haircut', controls: [] },
    { mode: 'color', label: 'mode_color', controls: [{ key: 'type', values: ['highlight', 'balayage', 'ombre', 'gray_blend', 'fashion'] }] },
    { mode: 'texture', label: 'mode_texture', controls: [{ key: 'texture', values: ['curly', 'straight', 'wavy'] }] },
    { mode: 'eyebrow', label: 'mode_eyebrow', controls: [{ key: 'shape', values: ['natural', 'arched', 'straight', 'rounded', 'soft_angled'] }] },
    { mode: 'beard', label: 'mode_beard', controls: [{ key: 'length', values: ['stubble', 'short', 'medium', 'full'] }, { key: 'shape', values: ['rounded', 'angular', 'tapered'] }] },
    { mode: 'wig', label: 'mode_wig', controls: [{ key: 'family', values: ['natural', 'business', 'modern', 'long', 'layered', 'curly', 'elegant', 'glamorous', 'cute', 'simple', 'school'] }] },
    { mode: 'hairsystem', label: 'mode_hairsystem', controls: [{ key: 'type', values: ['frontal', 'partial', 'full', 'topper', 'crown'] }] },
    { mode: 'event', label: 'mode_event', controls: [{ key: 'occasion', values: ['wedding', 'cruise', 'disneyland', 'vegas', 'beach', 'birthday', 'graduation', 'holiday'] }] },
    { mode: 'vacation', label: 'mode_vacation', controls: [{ key: 'destination', values: ['hawaii', 'europe', 'california_coast', 'theme_parks', 'luxury_resorts'] }] },
  ];

  // SP-4 — Studio Gallery card imagery. Every mode now has a real, on-brand
  // photo (Asian-majority, beauty-magazine quality, hair/face as the hero) so
  // NO card is ever blank. Curated free-license stock (Pexels/Unsplash, free
  // for commercial use) lives in /assets/style-studio/showcase/. The card still
  // never MISLABELS — each photo shows the actual look that mode produces
  // (e.g. balayage for color, full natural hair for hair systems). 'beard'
  // keeps an existing in-repo grooming photo (the diversity slot). If a webp
  // is ever missing the card falls back to a premium gradient (never broken).
  var GALLERY_CARDS = {
    haircut:    { img: '/assets/style-studio/showcase/hair-styles-asian-female.webp',   icon: 'stylist', accent: 'a' },
    color:      { img: '/assets/style-studio/showcase/hair-color-asian-female.webp',    icon: 'color',   accent: 'c' },
    texture:    { img: '/assets/style-studio/showcase/hair-texture-asian-female.webp',  icon: 'texture', accent: 'a' },
    eyebrow:    { img: '/assets/style-studio/showcase/eyebrow-beard-asian-male.webp',   icon: 'groom',   accent: 'd' },
    beard:      { img: '/assets/mobile-barber/styles/haircut-beard.jpg',                icon: 'groom',   accent: 'd' },
    wig:        { img: '/assets/style-studio/showcase/wig-match-asian-female.webp',     icon: 'wig',     accent: 'b' },
    hairsystem: { img: '/assets/style-studio/showcase/wig-match-asian-male.webp',       icon: 'wig',     accent: 'b' },
    event:      { img: '/assets/style-studio/showcase/event-vacation-asian-female.webp', icon: 'event',  accent: 'e' },
    vacation:   { img: '/assets/style-studio/showcase/event-vacation-asian-male.webp',  icon: 'event',   accent: 'e' },
  };

  var MASTER_ATTR_KEYS = ['haircut', 'color', 'texture', 'bangs', 'eyebrows', 'beard', 'wigOrSystem'];

  // SP-3 — local-only stores (NEVER Firestore/Storage). Favorites = looks the
  // user hearted; recent looks = a rolling history of generated looks. Both keep
  // a text reference + an on-device cache key (image stays in MobileBarberAIPreview
  // localStorage). No selfie/result image is ever uploaded.
  var FAV_KEY = 'ss_public_favorites';
  var HISTORY_KEY = 'ss_recent_looks';
  var HISTORY_MAX = 24;

  var state = {
    lang: 'en', consent: false, selfieDataUrl: '',
    audience: 'neutral', goal: '',
    signedIn: false, busy: false, sessionId: '',
    lastResultCount: 0,
    // Auth identity. isAnonymous mirrors user.isAnonymous; a logged-in real
    // customer = signedIn && !isAnonymous. _anonInFlight guards against duplicate
    // anonymous sign-ins. profileExists tracks whether the customer's
    // mobileBarberCustomers/{uid} doc has been confirmed/created (best-effort).
    isAnonymous: true, _anonInFlight: false, profileExists: false,
    // Customer account (reuses mobile-barber customer auth). isCustomer = a real
    // (non-anonymous) signed-in customer; account = display name / phone of that user.
    user: null, isCustomer: false, account: { name: '', phone: '' },
    authMode: 'login', authBusy: false, acctTab: 'history',
    // P0 never-silent: queued generation while anon auth completes, plus the
    // live progress-cycle interval + watchdog timer handles (so busy can never stick).
    pendingGenerate: '', progressTimer: 0, watchdogTimer: 0,
  };

  var IS_IOS = (function () {
    try {
      var ua = root.navigator.userAgent || '';
      return /iP(hone|ad|od)/.test(ua) ||
        (/Macintosh/.test(ua) && root.navigator.maxTouchPoints > 1); // iPadOS desktop UA
    } catch (e) { return false; }
  })();

  // ── Diagnostic logs (required) ─────────────────────────────────────────
  function logUi(extra) {
    try {
      root.console && root.console.log('[style-studio-ui]', Object.assign({
        state: state.busy ? 'busy' : (state.signedIn ? 'ready' : 'auth'),
        modalOpen: !!viewer.open,
        bodyOverflow: doc.body.style.overflow || (doc.body.style.position === 'fixed' ? 'locked(fixed)' : 'auto'),
        resultCount: state.lastResultCount,
        activeResultIndex: viewer.open ? viewer.index : -1,
      }, extra || {}));
    } catch (e) {}
  }
  function logDl(o) { try { root.console && root.console.log('[style-studio-download]', o || {}); } catch (e) {} }
  // Master Stylist lifecycle log — every step is observable; nothing is swallowed.
  function logMaster(event, data) { try { root.console && root.console.log('[master-stylist]', event, data || {}); } catch (e) {} }
  // Auth-state log — fires on EVERY onAuthStateChanged (and after login/signup/logout).
  // promoUsage/generationCount are server-side counters not exposed to the client; the
  // keys are included with best-effort values (null when unknown) so the shape is stable.
  function logAuth(extra) {
    var u = state.user || {};
    try {
      root.console && root.console.log('[style-auth]', Object.assign({
        uid: u.uid || null,
        isAnonymous: state.isAnonymous,
        email: u.email || null,
        profileLoaded: !!state.profileExists,
        membershipTier: (state.signedIn && !state.isAnonymous) ? 'member' : 'guest',
        promoUsage: null,
        generationCount: null,
        gateReason: null,
      }, extra || {}));
    } catch (e) {}
  }
  // Gate-decision log — fires whenever a generation response yields a gate decision.
  function logGate(res) {
    res = res || {};
    try {
      root.console && root.console.log('[style-gate]', {
        signedIn: state.signedIn,
        isAnonymous: state.isAnonymous,
        profileExists: !!state.profileExists,
        allowed: !!res.ok,
        reason: res.code || (res.requireLogin ? 'requireLogin' : (res.ok ? 'ok' : 'error')),
      });
    } catch (e) {}
  }

  // ── i18n helpers ───────────────────────────────────────────────────────
  function t(key) {
    return (SS_STRINGS[state.lang] && SS_STRINGS[state.lang][key]) || SS_STRINGS.en[key] || '';
  }
  function detectLang() {
    try {
      var p = new URLSearchParams(root.location.search).get('lang');
      if (SS_STRINGS[p]) return p;
      var saved = root.localStorage.getItem('dlc_lang') || root.localStorage.getItem('dlcLang');
      if (SS_STRINGS[saved]) return saved;
      var nav = (root.navigator && (root.navigator.language || '')).slice(0, 2).toLowerCase();
      if (SS_STRINGS[nav]) return nav;
    } catch (e) {}
    return 'vi';
  }
  function applyI18n(scope) {
    (scope || doc).querySelectorAll('[data-ss-i18n]').forEach(function (node) {
      node.textContent = t(node.getAttribute('data-ss-i18n'));
    });
  }
  function setLang(lang) {
    if (!SS_STRINGS[lang]) return;
    state.lang = lang;
    try { root.localStorage.setItem('dlc_lang', lang); } catch (e) {}
    doc.documentElement.setAttribute('lang', lang);
    applyI18n();
    buildGoalChips();
    buildAudienceSeg();
    buildGallery();
    buildShowcase();
    buildWigExamples();
    buildTestimonials();
    refreshWigUi();
    syncLangButtons();
    renderAccount();
    var authPanel = doc.getElementById('ssAuthPanel');
    if (authPanel && !authPanel.hidden) renderAuthPanel();
    var acctPanel = doc.getElementById('ssAccountPanel');
    if (acctPanel && !acctPanel.hidden) renderAccountPanel();
    setStatus(state.busy ? t('generating') : (state.selfieDataUrl ? t('photoReady') : t('ready')));
  }
  function syncLangButtons() {
    doc.querySelectorAll('#ssLang .ss-lang__btn').forEach(function (b) {
      b.classList.toggle('ss-lang__btn--active', b.getAttribute('data-lang') === state.lang);
    });
  }

  function elt(tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function setStatus(msg, isError) {
    var s = doc.getElementById('ssStatus');
    if (!s) return;
    s.textContent = msg || '';
    s.classList.toggle('ss-status--error', !!isError);
  }
  // Toggle the inline loading spinner on the status line (used during progress).
  function setStatusLoading(on) {
    var s = doc.getElementById('ssStatus');
    if (s) s.classList.toggle('ss-status--loading', !!on);
  }

  // ── Goal chips (replaces the thin select) ──────────────────────────────
  function buildGoalChips() {
    var wrap = doc.getElementById('ssGoalChips');
    if (!wrap) return;
    wrap.innerHTML = '';
    var items = [{ v: '', label: t('goalBest') }];
    GOALS.forEach(function (g) { items.push({ v: g, label: t('goal_' + g) }); });
    items.forEach(function (it) {
      var chip = elt('button', 'ss-chip', it.label);
      chip.type = 'button';
      chip.setAttribute('data-goal', it.v);
      chip.setAttribute('aria-pressed', String(it.v === state.goal));
      if (it.v === state.goal) chip.classList.add('ss-chip--active');
      chip.addEventListener('click', function () {
        state.goal = it.v;
        wrap.querySelectorAll('.ss-chip').forEach(function (c) {
          var on = c.getAttribute('data-goal') === state.goal;
          c.classList.toggle('ss-chip--active', on);
          c.setAttribute('aria-pressed', String(on));
        });
      });
      wrap.appendChild(chip);
    });
  }
  // ── Audience segmented control (replaces the native select) ────────────
  function buildAudienceSeg() {
    var seg = doc.getElementById('ssAudienceSeg');
    if (!seg) return;
    seg.innerHTML = '';
    [['neutral', 'aud_neutral'], ['man', 'aud_man'], ['woman', 'aud_woman'], ['child', 'aud_child']].forEach(function (pair) {
      var btn = elt('button', 'ss-seg__btn', t(pair[1]));
      btn.type = 'button';
      btn.setAttribute('data-aud', pair[0]);
      var on = pair[0] === state.audience;
      btn.setAttribute('aria-pressed', String(on));
      if (on) btn.classList.add('ss-seg__btn--active');
      btn.addEventListener('click', function () {
        state.audience = pair[0];
        seg.querySelectorAll('.ss-seg__btn').forEach(function (b) {
          var active = b.getAttribute('data-aud') === state.audience;
          b.classList.toggle('ss-seg__btn--active', active);
          b.setAttribute('aria-pressed', String(active));
        });
      });
      seg.appendChild(btn);
    });
  }

  // ── Studio Gallery — large Netflix-style cards (replaces the accordion) ──
  // Each of the 9 modes is a big image/gradient card with a title, an emotional
  // one-liner and a Generate button that runs that mode via the EXISTING
  // onModeGenerate(def, body, results). Modes with meaningful options reveal
  // chips (tap "Choose a style") before Generate — never a native select. The
  // per-card body/results contract that onModeGenerate reads is unchanged.
  function buildGallery() {
    var grid = doc.getElementById('ssGallery');
    if (!grid) return;
    grid.innerHTML = '';
    STUDIO_DEFS.forEach(function (def) {
      var meta = GALLERY_CARDS[def.mode] || { img: '', icon: 'stylist', accent: 'a' };
      var card = elt('article', 'ss-gcard ss-gcard--' + meta.accent);
      card.setAttribute('data-mode', def.mode);

      // Visual: an honest photo when one exists, else a premium gradient + icon.
      var media = elt('div', 'ss-gcard__media');
      if (meta.img) {
        var img = doc.createElement('img'); img.className = 'ss-gcard__img';
        img.src = meta.img; img.alt = t(def.label); img.loading = 'lazy';
        // Premium gradient fallback if a curated photo ever fails to load — a
        // card is never left visibly broken (and never silently blank).
        img.addEventListener('error', function () {
          media.classList.add('ss-gcard__media--gradient');
          if (!media.querySelector('.ss-gcard__icon')) {
            var fico = elt('span', 'ss-gcard__icon'); fico.innerHTML = showcaseIcon(meta.icon);
            media.insertBefore(fico, media.firstChild);
          }
          if (img.parentNode) img.parentNode.removeChild(img);
        });
        media.appendChild(img);
      } else {
        media.classList.add('ss-gcard__media--gradient');
        var ico = elt('span', 'ss-gcard__icon'); ico.innerHTML = showcaseIcon(meta.icon);
        media.appendChild(ico);
      }
      media.appendChild(elt('span', 'ss-gcard__media-title', t(def.label)));
      card.appendChild(media);

      var body = elt('div', 'ss-gcard__body');
      body.appendChild(elt('p', 'ss-gcard__desc', t('gallery_' + def.mode)));

      // Option chips revealed on demand (kept collapsed so the card stays clean).
      if (def.controls.length) {
        var optWrap = elt('div', 'ss-gcard__opts'); optWrap.hidden = true;
        def.controls.forEach(function (ctrl) {
          var group = elt('div', 'ss-optchips'); group.setAttribute('data-ctrl', ctrl.key);
          ctrl.values.forEach(function (v, vi) {
            var chip = elt('button', 'ss-optchips__chip', v.replace(/_/g, ' '));
            chip.type = 'button';
            chip.setAttribute('data-value', v);
            var on = vi === 0;
            chip.setAttribute('aria-pressed', String(on));
            if (on) { chip.classList.add('ss-optchips__chip--active'); group.setAttribute('data-selected', v); }
            chip.addEventListener('click', function () {
              group.setAttribute('data-selected', v);
              group.querySelectorAll('.ss-optchips__chip').forEach(function (c) {
                var active = c.getAttribute('data-value') === v;
                c.classList.toggle('ss-optchips__chip--active', active);
                c.setAttribute('aria-pressed', String(active));
              });
            });
            group.appendChild(chip);
          });
          optWrap.appendChild(group);
        });
        var optToggle = elt('button', 'ss-gcard__optbtn', t('optionsLabel'));
        optToggle.type = 'button';
        optToggle.setAttribute('aria-expanded', 'false');
        optToggle.addEventListener('click', function () {
          var show = optWrap.hidden;
          optWrap.hidden = !show;
          optToggle.setAttribute('aria-expanded', String(show));
          optToggle.classList.toggle('ss-gcard__optbtn--open', show);
        });
        body.appendChild(optToggle);
        body.appendChild(optWrap);
      }

      var gen = elt('button', 'ss-cta ss-gcard__gen', t('generate'));
      gen.type = 'button'; gen.disabled = !canSubmit();
      gen.setAttribute('data-mode-generate', def.mode);
      var results = elt('div', 'ss-mode-results');
      results.setAttribute('data-results-for', def.mode);
      // The body element passed to onModeGenerate must contain the option chips it
      // reads (.ss-optchips[data-ctrl]) — for cards with options that's optWrap,
      // for option-less cards it's the body itself.
      var optHost = body.querySelector('.ss-gcard__opts') || body;
      gen.addEventListener('click', function () { onModeGenerate(def, optHost, results); });
      body.appendChild(gen); body.appendChild(results);
      card.appendChild(body);
      grid.appendChild(card);
    });
  }

  // Internal readiness check (includes signedIn) — used by generation entry points.
  function canGenerate() { return !!(state.consent && state.selfieDataUrl && state.signedIn && !state.busy); }
  // Button-enable check: deliberately does NOT require signedIn, so the buttons are
  // tappable as soon as consent + selfie are set, even while anonymous auth is still
  // completing in the background. The handlers then queue via pendingGenerate. This is
  // the core of the P0 fix — the flagship button is never dead/silent.
  function canSubmit() { return !!(state.consent && state.selfieDataUrl && !state.busy); }
  function refreshButtons() {
    var ok = canSubmit();
    var best = doc.getElementById('ssGenerateBest');
    if (best) best.disabled = !ok;
    var wig = doc.getElementById('ssWigGenerate');
    if (wig) wig.disabled = !ok;
    doc.querySelectorAll('[data-mode-generate]').forEach(function (b) { b.disabled = !ok; });
  }
  // Wig section status hint (depends on consent/selfie, not on busy).
  function refreshWigUi() {
    var s = doc.getElementById('ssWigStatus');
    if (!s) return;
    if (state.busy) return;             // a live generation message owns the status line
    if (!state.selfieDataUrl) { s.textContent = t('wigNeedSelfie'); s.classList.remove('ss-status--error'); }
    else s.textContent = '';
  }

  // ── Selfie upload ──────────────────────────────────────────────────────
  function onUpload(ev) {
    var file = ev && ev.target && ev.target.files && ev.target.files[0];
    if (!file) return;
    if (!state.consent) { setStatus(t('consentRequired'), true); ev.target.value = ''; return; }
    var AIP = root.MobileBarberAIPreview;
    if (!AIP || typeof AIP.compressImage !== 'function') { setStatus(t('error'), true); return; }
    AIP.compressImage(file).then(function (dataUrl) {
      state.selfieDataUrl = dataUrl;
      showSelfiePreview(dataUrl);
      setStatus(t('photoReady'));
      refreshButtons();
      refreshWigUi();
    }).catch(function () { setStatus(t('error'), true); });
  }
  function showSelfiePreview(dataUrl) {
    var btn = doc.getElementById('ssUploadBtn');
    if (!btn) return;
    btn.innerHTML = '';
    var img = doc.createElement('img'); img.src = dataUrl; img.alt = '';
    btn.appendChild(img);
  }

  // ── The public callable ────────────────────────────────────────────────
  function callPublic(payload) {
    if (typeof root.firebase === 'undefined' || !root.firebase.functions) {
      return Promise.resolve({ ok: false, message: t('error') });
    }
    var callable;
    try {
      callable = root.firebase.functions().httpsCallable('generateStyleStudioPublic', { timeout: 180000 });
    } catch (e) {
      return Promise.resolve({ ok: false, message: t('error') });
    }
    return callable(payload).then(function (result) {
      var p = (result && result.data) || {};
      if (p.ok) return p;
      // GUEST over the free-preview limit → the create-account wall. Only anonymous
      // guests get requireLogin:true from the backend (members never do).
      if (p.requireLogin === true || p.code === 'LIMIT_REACHED') {
        return { ok: false, code: p.code || 'LIMIT_REACHED', requireLogin: true, message: t('loginWall') };
      }
      // Everything else (including the new member-only DAILY_LIMIT) → localized
      // message by code, with no create-account prompt. requireLogin stays false.
      var code = p.debugCode || p.code || '';
      return { ok: false, code: code, requireLogin: false, message: t('err_' + code) || t('error') };
    }).catch(function (err) {
      // The callable itself threw (network / transport) — distinct from an AI
      // service error. Surface the generic error string; never swallow.
      if (root.console) root.console.error('[style-studio] callable failed', err);
      return { ok: false, message: t('error') };
    });
  }

  // ── Master Stylist flow ────────────────────────────────────────────────
  // P0: the flagship button must NEVER silently fail. Every blocked state shows
  // explicit feedback, busy can never stick (always-reset + watchdog), and a
  // pending generation auto-runs once anonymous auth completes (no double-tap).
  function onGenerateBest() {
    logMaster('buttonClicked', { consent: state.consent, hasSelfie: !!state.selfieDataUrl, signedIn: state.signedIn, busy: state.busy });
    if (state.busy)           { setStatus(t('busyWait'), false); return; }
    if (!state.consent)       { setStatus(t('consentRequired'), true); return; }
    if (!state.selfieDataUrl) { setStatus(t('needSelfie'), true); return; }
    if (!state.signedIn)      { setStatus(t('preparingSession'), false); state.pendingGenerate = 'master'; ensureSignedIn(); return; }
    startMasterGeneration();
  }

  // Kick anonymous sign-in if Firebase Auth has no current user yet. Never silent
  // on failure — logs and surfaces sessionError. onAuthStateChanged drains the
  // pendingGenerate queue when a user appears.
  function ensureSignedIn() {
    var a = (root.firebase && root.firebase.auth) ? root.firebase.auth() : null;
    if (!a) { state.pendingGenerate = ''; setStatus(t('sessionError'), true); return; }
    if (a.currentUser) return; // onAuthStateChanged already fired / will fire — never anon-over them
    if (state._anonInFlight) return; // an anon sign-in is already running; don't duplicate
    try {
      state._anonInFlight = true;
      a.signInAnonymously().catch(function (err) {
        if (root.console) root.console.error('[style-studio] anon sign-in failed', err);
        state.pendingGenerate = '';
        logMaster('error', { message: 'session_' + ((err && err.message) || String(err)) });
        setStatus(t('sessionError'), true);
      }).finally(function () { state._anonInFlight = false; });
    } catch (e) {
      state._anonInFlight = false;
      state.pendingGenerate = '';
      logMaster('error', { message: 'session_' + ((e && e.message) || String(e)) });
      setStatus(t('sessionError'), true);
    }
  }

  // Drain a queued generation once we are signed in (called from onAuthStateChanged).
  function runPendingGenerate() {
    var pending = state.pendingGenerate;
    if (!pending) return;
    state.pendingGenerate = '';
    if (pending === 'master') { startMasterGeneration(); return; }
    if (pending === 'wig') { onWigGenerate(); return; }
  }

  // ── Loading progress (cycles the staged messages with a spinner) ───────
  function startProgress() {
    stopProgress(true); // clear any stale interval without removing the spinner
    var steps = ['prog_analyzing', 'prog_harmony', 'prog_designing', 'prog_generating'];
    var i = 0;
    setStatusLoading(true);
    setStatus(t(steps[0]), false);
    state.progressTimer = root.setInterval(function () {
      if (i < steps.length - 1) i++; // hold on the last message
      setStatus(t(steps[i]), false);
    }, 4000);
  }
  function stopProgress(keepSpinner) {
    if (state.progressTimer) { root.clearInterval(state.progressTimer); state.progressTimer = 0; }
    if (!keepSpinner) setStatusLoading(false);
  }

  // Always-clears guard so busy can NEVER stick: stop progress, reset busy, clear
  // the watchdog and re-enable the buttons. Called from every terminal branch.
  function endMasterBusy() {
    stopProgress();
    state.busy = false;
    if (state.watchdogTimer) { root.clearTimeout(state.watchdogTimer); state.watchdogTimer = 0; }
    refreshButtons();
  }

  // Error card with a Retry button, rendered into the master result host.
  function masterError(msg) {
    var text = msg || t('genFailed');
    logMaster('error', { message: text });
    setStatus('');
    var host = doc.getElementById('ssMasterResult');
    if (!host) { setStatus(text, true); return; }
    host.innerHTML = '';
    var card = elt('div', 'ss-error-card');
    card.appendChild(elt('p', 'ss-error-card__msg', text));
    var retry = elt('button', 'ss-error-card__retry', t('retry'));
    retry.type = 'button';
    retry.addEventListener('click', function () { onGenerateBest(); });
    card.appendChild(retry);
    host.appendChild(card);
  }

  function startMasterGeneration() {
    state.busy = true; refreshButtons();
    state.sessionId = 'ss_master_' + Math.random().toString(36).slice(2, 9);
    var thisSession = state.sessionId;
    var resultEl = doc.getElementById('ssMasterResult');
    if (resultEl) resultEl.innerHTML = '';
    startProgress();
    logUi({ event: 'generate-master' });
    logMaster('payloadBuilt', { mode: 'master', goal: state.goal || 'auto', audience: state.audience, lang: state.lang });

    // Watchdog: if the request never resolves, busy must still be released and the
    // user shown an error — busy can NEVER stick permanently.
    state.watchdogTimer = root.setTimeout(function () {
      if (state.busy && state.sessionId === thisSession) {
        logMaster('error', { message: 'watchdog_timeout' });
        endMasterBusy();
        masterError(t('genFailed'));
      }
    }, 185000);

    logMaster('requestSent', {});
    callPublic({
      selfieDataUrl: state.selfieDataUrl, lang: state.lang,
      mode: 'master', goal: state.goal, audience: state.audience,
    }).then(function (res) {
      // Ignore a late response if the watchdog already fired for this session.
      if (!state.busy || state.sessionId !== thisSession) { return; }
      endMasterBusy();
      logMaster('responseReceived', { ok: !!(res && res.ok), code: (res && res.code) || '', requireLogin: !!(res && res.requireLogin) });
      logGate(res);
      // GUEST-only create-account wall: fire ONLY when the backend returned
      // requireLogin:true (anonymous guest over the free-preview limit).
      if (res.requireLogin === true) { revealMembership(); setStatus(t('loginWall'), true); return; }
      // MEMBER over their generous daily limit (code DAILY_LIMIT): a localized
      // "try again tomorrow" message — never the membership prompt.
      if (res.code === 'DAILY_LIMIT') { masterError(t('err_DAILY_LIMIT')); return; }
      if (!res.ok || !res.masterpiece) {
        logMaster('error', { message: res.message || '', code: res.code || '' });
        masterError(res.message || t('genFailed'));
        return;
      }
      logMaster('imageGenerated', { has: !!res.masterpiece.previewDataUrl });
      setStatus('');
      renderMasterpiece(res.masterpiece);
      logMaster('carouselUpdated', {});
    }).catch(function (err) {
      // callPublic resolves rather than rejects, but never swallow anything.
      if (state.sessionId !== thisSession) { return; }
      endMasterBusy();
      logMaster('error', { message: (err && err.message) || String(err) });
      masterError(t('genFailed'));
    });
  }

  function renderMasterpiece(mp) {
    var host = doc.getElementById('ssMasterResult');
    if (!host) return;
    host.innerHTML = '';
    var src = mp.previewDataUrl || '';
    state.lastResultCount = src ? 1 : 0;
    // Honest before/after: before = the user's real selfie, after = the result.
    var before = state.selfieDataUrl || '';
    var item = { src: src, before: before, title: mp.title || t('masterTitle'), why: mp.explanation || '' };
    var lookRec = { mode: 'master', title: item.title, why: item.why, sessionId: state.sessionId, styleId: 'master' };
    var card = elt('article', 'ss-master-card');

    if (src && before) {
      // Draggable before→after comparison; tap the result to open the viewer.
      var ba = buildBeforeAfter(src, before, function () { logMaster('viewerReady', {}); openViewer([item], 0); });
      card.appendChild(ba);
    } else if (src) {
      var figure = elt('button', 'ss-master-card__figure'); figure.type = 'button';
      figure.setAttribute('aria-label', t('expand'));
      var img = doc.createElement('img'); img.className = 'ss-master-card__img';
      img.src = src; img.alt = item.title; img.loading = 'lazy';
      figure.appendChild(img);
      figure.appendChild(zoomBadge());
      figure.addEventListener('click', function () { logMaster('viewerReady', {}); openViewer([item], 0); });
      card.appendChild(figure);
    }

    var body = elt('div', 'ss-master-card__body');
    body.appendChild(elt('strong', 'ss-master-card__title', item.title));
    if (mp.explanation) {
      var ex = elt('div', 'ss-explain');
      ex.appendChild(elt('span', 'ss-explain__label', t('explanationLabel')));
      var p = elt('p', 'ss-explain__text'); p.id = 'ssExplanation'; p.textContent = mp.explanation;
      ex.appendChild(p); body.appendChild(ex);
    }
    // Wig-intelligence: transparent note on WHY a wig was / was not recommended
    // (Master Stylist must not silently default to a wig).
    var wd = mp.wigDecision || {};
    var wnKey = { none: 'wigNote_none', optional: 'wigNote_optional', recommended: 'wigNote_recommended', strong_recommend: 'wigNote_recommended' }[wd.needed];
    if (wnKey) body.appendChild(elt('p', 'ss-card__meta', t(wnKey)));
    var attrs = mp.attributes || {};
    var attrKeys = MASTER_ATTR_KEYS.filter(function (k) { return attrs[k]; });
    if (attrKeys.length) {
      var wrap = elt('div', 'ss-attrs');
      attrKeys.forEach(function (k) {
        var chip = elt('div', 'ss-attr');
        chip.appendChild(elt('span', 'ss-attr__k', t('attr_' + k)));
        chip.appendChild(elt('span', 'ss-attr__v', String(attrs[k])));
        wrap.appendChild(chip);
      });
      body.appendChild(wrap);
    }
    body.appendChild(buildActions(src, item.title || 'best-look', [item], 0, lookRec));
    card.appendChild(body);
    host.appendChild(card);
    cacheLocal(state.sessionId, 'master', src);
    recordLook('master', item.title, item.why, state.sessionId, 'master');
    if (state.isCustomer) { var ap = doc.getElementById('ssAccountPanel'); if (ap && !ap.hidden) renderAccountPanel(); }
    try { card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
    logUi({ event: 'master-rendered' });
  }

  // ── Manual mode flow → swipeable carousel ──────────────────────────────
  function onModeGenerate(def, bodyEl, resultsEl) {
    // Never-silent guards (mirror the master flow). Show feedback in the mode's own
    // results slot so it's visible right by the button the user tapped.
    function modeMsg(msg, isError) {
      resultsEl.innerHTML = '';
      var p = elt('p', 'ss-mode-results__status', msg);
      if (isError) p.classList.add('ss-status--error');
      resultsEl.appendChild(p);
    }
    if (state.busy)           { modeMsg(t('busyWait'), false); return; }
    if (!state.consent)       { setStatus(t('consentRequired'), true); modeMsg(t('consentRequired'), true); return; }
    if (!state.selfieDataUrl) { modeMsg(t('needSelfie'), true); return; }
    if (!state.signedIn)      { modeMsg(t('preparingSession'), false); ensureSignedIn(); return; }
    state.busy = true; refreshButtons();
    state.sessionId = 'ss_' + def.mode + '_' + Math.random().toString(36).slice(2, 9);
    var opts = {};
    bodyEl.querySelectorAll('.ss-optchips[data-ctrl]').forEach(function (g) {
      var sel = g.getAttribute('data-selected');
      var active = g.querySelector('.ss-optchips__chip--active');
      opts[g.getAttribute('data-ctrl')] = sel || (active && active.getAttribute('data-value')) || '';
    });
    resultsEl.innerHTML = '';
    resultsEl.appendChild(elt('p', 'ss-mode-results__status', t('generating')));
    logUi({ event: 'generate-mode', mode: def.mode });
    callPublic({
      selfieDataUrl: state.selfieDataUrl, lang: state.lang,
      mode: def.mode, options: opts, audience: state.audience, goal: state.goal,
    }).then(function (res) {
      state.busy = false; refreshButtons();
      resultsEl.innerHTML = '';
      logGate(res);
      // Guest-only create-account wall (requireLogin:true). Members never see it.
      if (res.requireLogin === true) { revealMembership(); resultsEl.appendChild(elt('p', 'ss-mode-results__status', t('loginWall'))); return; }
      // Member daily-limit (DAILY_LIMIT): localized "try tomorrow", no prompt.
      if (res.code === 'DAILY_LIMIT') { resultsEl.appendChild(elt('p', 'ss-mode-results__status', t('err_DAILY_LIMIT'))); return; }
      if (!res.ok) { resultsEl.appendChild(elt('p', 'ss-mode-results__status', res.message || t('error'))); return; }
      var recs = (res.recommendations || []).filter(function (r) { return r && r.previewDataUrl && !r.error; });
      if (!recs.length) { resultsEl.appendChild(elt('p', 'ss-mode-results__status', t('err_PLAN_EMPTY'))); return; }
      renderCarousel(resultsEl, recs, def.mode);
    });
  }

  function renderCarousel(container, recs, mode) {
    container.innerHTML = '';
    state.lastResultCount = recs.length;
    var before = state.selfieDataUrl || '';
    // items carry the real selfie as `before` so the viewer's before/after
    // toggle shows the honest pairing for every look in the carousel.
    var items = recs.map(function (rec) {
      return { src: rec.previewDataUrl || '', before: before, title: rec.title || '', why: rec.whyItFitsFace || '' };
    });
    var track = elt('div', 'ss-carousel');
    track.setAttribute('role', 'list');
    recs.forEach(function (rec, i) {
      var src = items[i].src;
      var styleId = rec.styleId || rec.title || ('look-' + (i + 1));
      var card = elt('article', 'ss-card'); card.setAttribute('role', 'listitem');
      if (src) {
        var figure = elt('button', 'ss-card__figure'); figure.type = 'button'; figure.setAttribute('aria-label', t('expand'));
        var img = doc.createElement('img'); img.className = 'ss-card__img';
        img.src = src; img.alt = rec.title || ''; img.loading = 'lazy';
        figure.appendChild(img); figure.appendChild(zoomBadge());
        figure.addEventListener('click', function () { openViewer(items, i); });
        card.appendChild(figure);
      }
      var body = elt('div', 'ss-card__body');
      if (rec.title) body.appendChild(elt('strong', 'ss-card__title', rec.title));
      if (rec.whyItFitsFace) body.appendChild(elt('p', 'ss-card__why', rec.whyItFitsFace));
      if (rec.maintenance) body.appendChild(elt('p', 'ss-card__meta', rec.maintenance));
      var lookRec = { mode: mode || '', title: rec.title || styleId, why: rec.whyItFitsFace || '', sessionId: state.sessionId, styleId: rec.styleId || '' };
      body.appendChild(buildActions(src, styleId, items, i, lookRec));
      card.appendChild(body);
      track.appendChild(card);
      cacheLocal(state.sessionId, rec.styleId || '', src);
      recordLook(mode || '', rec.title || styleId, rec.whyItFitsFace || '', state.sessionId, rec.styleId || '');
    });
    container.appendChild(track);
    if (recs.length > 1) {
      var hint = elt('p', 'ss-carousel__hint'); hint.textContent = '‹ ' + recs.length + ' ›';
      container.appendChild(hint);
    }
    if (state.isCustomer) { var ap = doc.getElementById('ssAccountPanel'); if (ap && !ap.hidden) renderAccountPanel(); }
    logUi({ event: 'carousel-rendered' });
  }

  function zoomBadge() {
    var b = elt('span', 'ss-zoom-badge');
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>';
    return b;
  }

  // ── Actions (Favorite / Save / Share / Expand) ─────────────────────────
  // lookRec (optional) carries the text reference for the local Favorites store:
  // { mode, title, why, sessionId, styleId }. When present, a heart toggle is
  // shown — favorites are localStorage only (never Firestore/Storage).
  function buildActions(src, baseName, items, index, lookRec) {
    var actions = elt('div', 'ss-actions');

    if (lookRec && (lookRec.title || lookRec.styleId)) {
      var fav = elt('button', 'ss-action-btn ss-action-btn--fav');
      fav.type = 'button';
      var paint = function () {
        var on = isFavorited(lookRec);
        fav.classList.toggle('ss-action-btn--faved', on);
        fav.setAttribute('aria-pressed', String(on));
        fav.innerHTML = (on ? heartFilledIcon() : icon('heart')) +
          '<span>' + t(on ? 'unfavorite' : 'favorite') + '</span>';
      };
      paint();
      fav.addEventListener('click', function () {
        toggleFavorite(lookRec);
        paint();
        var ap = doc.getElementById('ssAccountPanel');
        if (ap && !ap.hidden) renderAccountPanel();
      });
      actions.appendChild(fav);
    }

    var save = elt('button', 'ss-action-btn');
    save.type = 'button';
    save.innerHTML = icon('download') + '<span>' + t('saveToPhone') + '</span>';
    save.addEventListener('click', function () { saveImage(src, baseName, items, index); });
    actions.appendChild(save);

    var sh = elt('button', 'ss-action-btn');
    sh.type = 'button';
    sh.innerHTML = icon('share') + '<span>' + t('share') + '</span>';
    sh.addEventListener('click', function () { shareImage(src, baseName); });
    actions.appendChild(sh);

    var ex = elt('button', 'ss-action-btn');
    ex.type = 'button';
    ex.innerHTML = icon('expand') + '<span>' + t('expand') + '</span>';
    ex.addEventListener('click', function () { openViewer(items, index); });
    actions.appendChild(ex);
    return actions;
  }
  // ── Before / After (honest: real selfie → AI result) ───────────────────
  // A draggable comparison slider. "Before" = the user's uploaded selfie
  // (state.selfieDataUrl), "After" = the generated result. Used in the master
  // result, the wig result, and the full-screen viewer. If there is no selfie,
  // callers simply render the plain result image (no fake before).
  function buildBeforeAfter(afterSrc, beforeSrc, onExpand) {
    var ba = elt('div', 'ss-ba');
    var pos = 55; // % shown of the "after" layer

    var imgAfter = doc.createElement('img');
    imgAfter.className = 'ss-ba__img ss-ba__img--after'; imgAfter.src = afterSrc; imgAfter.alt = ''; imgAfter.loading = 'lazy';
    ba.appendChild(imgAfter);

    var clip = elt('div', 'ss-ba__clip');
    var imgBefore = doc.createElement('img');
    imgBefore.className = 'ss-ba__img ss-ba__img--before'; imgBefore.src = beforeSrc; imgBefore.alt = ''; imgBefore.loading = 'lazy';
    clip.appendChild(imgBefore);
    ba.appendChild(clip);

    var lblB = elt('span', 'ss-ba__label ss-ba__label--before', t('before'));
    var lblA = elt('span', 'ss-ba__label ss-ba__label--after', t('after'));
    ba.appendChild(lblB); ba.appendChild(lblA);

    var handle = elt('div', 'ss-ba__handle');
    handle.setAttribute('role', 'slider');
    handle.setAttribute('aria-label', t('dragToCompare'));
    handle.setAttribute('tabindex', '0');
    handle.innerHTML = '<span class="ss-ba__grip">' + icon('compare') + '</span>';
    ba.appendChild(handle);

    function setPos(p) {
      pos = Math.max(0, Math.min(100, p));
      // Reveal the "before" layer left-to-right via clip-path inset (both layers
      // stay full-size and aligned). Handle tracks the divider position.
      clip.style.clipPath = 'inset(0 ' + (100 - pos) + '% 0 0)';
      handle.style.left = pos + '%';
      handle.setAttribute('aria-valuenow', String(Math.round(pos)));
    }
    setPos(pos);

    var dragging = false;
    function clientToPos(clientX) {
      var rect = ba.getBoundingClientRect();
      if (!rect.width) return pos;
      return ((clientX - rect.left) / rect.width) * 100;
    }
    function onDown(e) { dragging = true; ba.classList.add('ss-ba--drag'); move(e); }
    function move(e) {
      if (!dragging) return;
      var x = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
      if (typeof x === 'number') { setPos(clientToPos(x)); if (e.cancelable) e.preventDefault(); }
    }
    function onUp() { dragging = false; ba.classList.remove('ss-ba--drag'); }
    handle.addEventListener('mousedown', onDown);
    ba.addEventListener('mousemove', move);
    root.addEventListener('mouseup', onUp);
    handle.addEventListener('touchstart', onDown, { passive: true });
    ba.addEventListener('touchmove', move, { passive: false });
    root.addEventListener('touchend', onUp);
    handle.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { setPos(pos - 5); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { setPos(pos + 5); e.preventDefault(); }
    });
    // Tapping the after image (not the handle) opens the full-screen viewer.
    if (typeof onExpand === 'function') {
      imgAfter.style.cursor = 'zoom-in';
      imgAfter.addEventListener('click', function () { onExpand(); });
    }
    return ba;
  }

  function icon(name) {
    var P = {
      download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
      share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
      expand: '<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>',
      heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
      compare: '<rect x="3" y="5" width="18" height="14" rx="2"/><line x1="12" y1="5" x2="12" y2="19"/>',
      x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || '') + '</svg>';
  }
  // Filled heart variant (favorited state).
  function heartFilledIcon() {
    return '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
  }

  // ── iOS-robust Save: Web Share file → desktop download → press&hold ─────
  function extFromDataUrl(src) { var m = /^data:image\/(\w+)/.exec(src || ''); return m ? (m[1] === 'jpeg' ? 'jpg' : m[1]) : 'jpg'; }
  function dataUrlToFile(src, name) {
    return fetch(src).then(function (r) { return r.blob(); }).then(function (blob) {
      return new File([blob], name, { type: blob.type || 'image/jpeg' });
    });
  }
  function saveImage(src, baseName, items, index) {
    if (!src) { logDl({ method: 'none', supported: false, success: false, fallbackUsed: false }); return; }
    var name = String(baseName || 'style').replace(/[^a-z0-9_-]+/gi, '-') + '.' + extFromDataUrl(src);
    var canFile = !!(root.navigator && root.navigator.canShare && typeof File !== 'undefined' && typeof fetch === 'function');

    // 1) Web Share with file — the reliable iOS "save to Photos / share sheet".
    if (canFile) {
      dataUrlToFile(src, name).then(function (file) {
        if (root.navigator.canShare({ files: [file] })) {
          return root.navigator.share({ files: [file], title: t('heroChip') }).then(function () {
            logDl({ method: 'web-share-file', supported: true, success: true, fallbackUsed: false });
          });
        }
        throw new Error('cannot-share-file');
      }).catch(function () { saveFallback(src, name, items, index); });
      return;
    }
    saveFallback(src, name, items, index);
  }
  function saveFallback(src, name, items, index) {
    // 2) Desktop / browsers that honour the download attribute.
    if (!IS_IOS) {
      try {
        var a = doc.createElement('a'); a.href = src; a.download = name;
        doc.body.appendChild(a); a.click(); doc.body.removeChild(a);
        logDl({ method: 'anchor-download', supported: true, success: true, fallbackUsed: false });
        return;
      } catch (e) {}
    }
    // 3) iOS fallback — open the viewer full-screen and tell the user to press & hold.
    if (items && items.length) { openViewer(items, index || 0, true); }
    logDl({ method: 'fullscreen-press-hold', supported: false, success: false, fallbackUsed: true });
  }
  function shareImage(src, baseName) {
    if (!src || !root.navigator || typeof root.navigator.share !== 'function') {
      // No Share API → route to the save flow so the user still gets the image.
      saveImage(src, baseName, [{ src: src, title: '', why: '' }], 0); return;
    }
    var name = String(baseName || 'style').replace(/[^a-z0-9_-]+/gi, '-') + '.' + extFromDataUrl(src);
    if (root.navigator.canShare && typeof File !== 'undefined' && typeof fetch === 'function') {
      dataUrlToFile(src, name).then(function (file) {
        if (root.navigator.canShare({ files: [file] })) return root.navigator.share({ files: [file], title: t('heroChip') });
        return root.navigator.share({ title: t('heroChip'), text: t('heroSub') });
      }).catch(function () {});
    } else {
      root.navigator.share({ title: t('heroChip'), text: t('heroSub') }).catch(function () {});
    }
  }

  // ── On-device image cache (full-quality look stays in localStorage) ─────
  function cacheLocal(sessionId, styleId, src) {
    var AIP = root.MobileBarberAIPreview;
    if (AIP && typeof AIP.saveLocalCopy === 'function' && src) {
      try { AIP.saveLocalCopy(sessionId, styleId || '', src); } catch (e) {}
    }
  }
  function readCachedImage(sessionId, styleId) {
    var AIP = root.MobileBarberAIPreview;
    if (AIP && typeof AIP.readLocalCopy === 'function') {
      try { return AIP.readLocalCopy(sessionId, styleId || '') || ''; } catch (e) {}
    }
    return '';
  }

  // ── Favorites + History (LOCAL ONLY — never Firestore/Storage) ──────────
  // Each record stores a text reference (title + mode) and a pointer to the
  // on-device image cache (sessionId + styleId) — NOT the image bytes inline.
  // The image is read back from MobileBarberAIPreview.readLocalCopy on demand.
  function loadStore(key) {
    try {
      var raw = root.localStorage.getItem(key);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function saveStore(key, arr) {
    try { root.localStorage.setItem(key, JSON.stringify(arr || [])); } catch (e) {}
  }
  function lookKey(rec) { return (rec.sessionId || '') + '__' + (rec.styleId || '') + '__' + (rec.title || ''); }

  // Record a generated look into the rolling history (newest first, capped).
  function recordLook(mode, title, why, sessionId, styleId) {
    if (!title && !styleId) return;
    var list = loadStore(HISTORY_KEY);
    var rec = { mode: mode || '', title: title || '', why: why || '',
                sessionId: sessionId || '', styleId: styleId || '', savedAt: Date.now() };
    var k = lookKey(rec);
    list = list.filter(function (r) { return lookKey(r) !== k; });
    list.unshift(rec);
    if (list.length > HISTORY_MAX) list = list.slice(0, HISTORY_MAX);
    saveStore(HISTORY_KEY, list);
  }
  function isFavorited(rec) {
    var k = lookKey(rec);
    return loadStore(FAV_KEY).some(function (r) { return lookKey(r) === k; });
  }
  function toggleFavorite(rec) {
    var list = loadStore(FAV_KEY);
    var k = lookKey(rec);
    var existed = list.some(function (r) { return lookKey(r) === k; });
    if (existed) { list = list.filter(function (r) { return lookKey(r) !== k; }); }
    else {
      list.unshift({ mode: rec.mode || '', title: rec.title || '', why: rec.why || '',
                     sessionId: rec.sessionId || '', styleId: rec.styleId || '', savedAt: Date.now() });
    }
    saveStore(FAV_KEY, list);
    return !existed; // true = now favorited
  }
  function removeFavorite(rec) {
    var k = lookKey(rec);
    saveStore(FAV_KEY, loadStore(FAV_KEY).filter(function (r) { return lookKey(r) !== k; }));
  }

  // ── Self-contained full-screen VIEWER (pinch / swipe / close) ──────────
  var viewer = { open: false, items: [], index: 0, scrollY: 0, scale: 1, tx: 0, ty: 0,
                 startDist: 0, startScale: 1, lastX: 0, lastY: 0, lastTap: 0, moved: false, panStart: null,
                 showingBefore: false };

  function lockScroll() {
    viewer.scrollY = root.scrollY || root.pageYOffset || 0;
    doc.body.style.position = 'fixed';
    doc.body.style.top = (-viewer.scrollY) + 'px';
    doc.body.style.left = '0'; doc.body.style.right = '0'; doc.body.style.width = '100%';
    doc.body.classList.add('ss-viewer-open');
  }
  function unlockScroll() {
    doc.body.style.position = ''; doc.body.style.top = '';
    doc.body.style.left = ''; doc.body.style.right = ''; doc.body.style.width = '';
    doc.body.classList.remove('ss-viewer-open');
    try { root.scrollTo(0, viewer.scrollY); } catch (e) {}
  }

  function openViewer(items, index, withSaveHint) {
    items = (items || []).filter(function (it) { return it && it.src; });
    if (!items.length) return;
    closeViewer(); // single instance
    viewer.open = true; viewer.items = items; viewer.index = Math.max(0, Math.min(index || 0, items.length - 1));

    var ov = elt('div', 'ss-viewer'); ov.id = 'ssViewer';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');

    var stage = elt('div', 'ss-viewer__stage');
    var img = doc.createElement('img'); img.className = 'ss-viewer__img'; img.id = 'ssViewerImg'; img.alt = '';
    stage.appendChild(img);
    ov.appendChild(stage);

    var close = elt('button', 'ss-viewer__close'); close.type = 'button';
    close.setAttribute('aria-label', t('viewerClose')); close.innerHTML = icon('x');
    close.addEventListener('click', closeViewer);
    ov.appendChild(close);

    if (items.length > 1) {
      var prev = elt('button', 'ss-viewer__nav ss-viewer__nav--prev'); prev.type = 'button';
      prev.setAttribute('aria-label', t('viewerPrev')); prev.innerHTML = '‹';
      prev.addEventListener('click', function () { navViewer(-1); });
      var next = elt('button', 'ss-viewer__nav ss-viewer__nav--next'); next.type = 'button';
      next.setAttribute('aria-label', t('viewerNext')); next.innerHTML = '›';
      next.addEventListener('click', function () { navViewer(1); });
      ov.appendChild(prev); ov.appendChild(next);
    }

    var bar = elt('div', 'ss-viewer__bar');
    bar.appendChild(elt('p', 'ss-viewer__title', '')); // filled by show()
    if (withSaveHint || IS_IOS) bar.appendChild(elt('p', 'ss-viewer__hint', t('pressHold')));
    var barActions = elt('div', 'ss-viewer__actions');

    // Before/After toggle — swaps between the user's selfie and the AI result.
    // Only meaningful when the current item carries a real `before` selfie.
    viewer.showingBefore = false;
    var vToggle = elt('button', 'ss-viewer__btn ss-viewer__btn--toggle'); vToggle.type = 'button'; vToggle.id = 'ssViewerToggle';
    vToggle.addEventListener('click', function () {
      var it = viewer.items[viewer.index] || {};
      if (!it.before) return;
      viewer.showingBefore = !viewer.showingBefore;
      showViewerImage();
    });
    barActions.appendChild(vToggle);

    var vSave = elt('button', 'ss-viewer__btn'); vSave.type = 'button';
    vSave.innerHTML = icon('download') + '<span>' + t('saveToPhone') + '</span>';
    // Save always exports the AI RESULT (never the original selfie).
    vSave.addEventListener('click', function () { saveImage(viewer.items[viewer.index].src, viewer.items[viewer.index].title || 'look', viewer.items, viewer.index); });
    barActions.appendChild(vSave);
    if (root.navigator && typeof root.navigator.share === 'function') {
      var vShare = elt('button', 'ss-viewer__btn'); vShare.type = 'button';
      vShare.innerHTML = icon('share') + '<span>' + t('share') + '</span>';
      vShare.addEventListener('click', function () { shareImage(viewer.items[viewer.index].src, viewer.items[viewer.index].title || 'look'); });
      barActions.appendChild(vShare);
    }
    bar.appendChild(barActions);
    ov.appendChild(bar);

    // Tap on empty stage backdrop closes (but not when zoomed).
    stage.addEventListener('click', function (e) {
      if (e.target === stage && viewer.scale <= 1.02) closeViewer();
    });

    attachGestures(stage, img);
    doc.addEventListener('keydown', onViewerKey);
    lockScroll();
    doc.body.appendChild(ov);
    showViewerImage();
    logUi({ event: 'viewer-open' });
  }

  function showViewerImage() {
    var img = doc.getElementById('ssViewerImg');
    if (!img) return;
    var it = viewer.items[viewer.index] || {};
    var hasBefore = !!it.before;
    var showingBefore = hasBefore && viewer.showingBefore;
    resetZoom(img);
    img.src = showingBefore ? it.before : it.src;
    img.alt = it.title || '';
    var titleEl = doc.querySelector('#ssViewer .ss-viewer__title');
    if (titleEl) titleEl.textContent = (it.title || '') + (viewer.items.length > 1 ? '  (' + (viewer.index + 1) + '/' + viewer.items.length + ')' : '');
    // Before/After toggle: show only when an honest selfie exists for this item.
    var toggle = doc.getElementById('ssViewerToggle');
    if (toggle) {
      toggle.hidden = !hasBefore;
      toggle.innerHTML = icon('compare') + '<span>' + t(showingBefore ? 'viewerToggleAfter' : 'viewerToggleBefore') + '</span>';
      toggle.classList.toggle('ss-viewer__btn--toggle-on', showingBefore);
    }
  }
  function navViewer(dir) {
    if (viewer.items.length < 2) return;
    viewer.index = (viewer.index + dir + viewer.items.length) % viewer.items.length;
    viewer.showingBefore = false; // reset to the result when moving between looks
    showViewerImage();
    logUi({ event: 'viewer-nav' });
  }
  function resetZoom(img) {
    viewer.scale = 1; viewer.tx = 0; viewer.ty = 0;
    if (img) img.style.transform = 'translate(0px,0px) scale(1)';
  }
  function applyTransform(img) {
    img.style.transform = 'translate(' + viewer.tx + 'px,' + viewer.ty + 'px) scale(' + viewer.scale + ')';
  }
  function onViewerKey(e) {
    if (e.key === 'Escape') closeViewer();
    else if (e.key === 'ArrowRight') navViewer(1);
    else if (e.key === 'ArrowLeft') navViewer(-1);
  }

  function attachGestures(stage, img) {
    function dist(t1, t2) { var dx = t1.clientX - t2.clientX, dy = t1.clientY - t2.clientY; return Math.sqrt(dx * dx + dy * dy); }
    img.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        viewer.startDist = dist(e.touches[0], e.touches[1]);
        viewer.startScale = viewer.scale;
      } else if (e.touches.length === 1) {
        viewer.lastX = e.touches[0].clientX; viewer.lastY = e.touches[0].clientY;
        viewer.moved = false;
        viewer.panStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, tx: viewer.tx, ty: viewer.ty };
      }
    }, { passive: true });

    img.addEventListener('touchmove', function (e) {
      if (e.touches.length === 2 && viewer.startDist) {
        e.preventDefault();
        var d = dist(e.touches[0], e.touches[1]);
        viewer.scale = Math.max(1, Math.min(4, viewer.startScale * (d / viewer.startDist)));
        applyTransform(img);
        viewer.moved = true;
      } else if (e.touches.length === 1) {
        var x = e.touches[0].clientX, y = e.touches[0].clientY;
        if (viewer.scale > 1.02 && viewer.panStart) { // pan while zoomed
          e.preventDefault();
          viewer.tx = viewer.panStart.tx + (x - viewer.panStart.x);
          viewer.ty = viewer.panStart.ty + (y - viewer.panStart.y);
          applyTransform(img);
          viewer.moved = true;
        } else {
          if (Math.abs(x - viewer.lastX) > 8 || Math.abs(y - viewer.lastY) > 8) viewer.moved = true;
        }
      }
    }, { passive: false });

    img.addEventListener('touchend', function (e) {
      var endX = (e.changedTouches[0] || {}).clientX, endY = (e.changedTouches[0] || {}).clientY;
      // Double-tap to toggle zoom.
      var now = Date.now();
      if (!viewer.moved && viewer.scale <= 1.02) {
        if (now - viewer.lastTap < 300) { viewer.scale = 2.4; viewer.tx = 0; viewer.ty = 0; applyTransform(img); viewer.lastTap = 0; return; }
        viewer.lastTap = now;
      }
      if (viewer.scale > 1.02) return; // zoomed: no swipe-nav/close
      var dx = endX - viewer.lastX, dy = endY - viewer.lastY;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) { navViewer(dx < 0 ? 1 : -1); }
      else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) { closeViewer(); } // swipe down to close
    }, { passive: true });
  }

  function closeViewer() {
    var ov = doc.getElementById('ssViewer');
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    doc.removeEventListener('keydown', onViewerKey);
    if (viewer.open) { unlockScroll(); }
    viewer.open = false; resetZoom(null);
    logUi({ event: 'viewer-close' });
  }

  // ── AI Style Showcase carousel ─────────────────────────────────────────
  function showcaseIcon(name) {
    var P = {
      stylist: '<path d="M12 3 9.5 9.5 3 12l6.5 2.5L12 21l2.5-6.5L21 12l-6.5-2.5Z"/>',
      wig: '<path d="M12 3a7 7 0 0 0-7 7v4a3 3 0 0 0 3 3h.5"/><path d="M12 3a7 7 0 0 1 7 7v4a3 3 0 0 1-3 3h-.5"/><path d="M9 20a3 3 0 0 0 6 0"/><circle cx="12" cy="11" r="2.2"/>',
      color: '<path d="M12 21a9 9 0 1 1 9-9c0 2-1.6 3-3.5 3H16a2 2 0 0 0-1.6 3.2A1.8 1.8 0 0 1 12 21Z"/><circle cx="7.5" cy="10.5" r="1.1"/><circle cx="12" cy="7.5" r="1.1"/><circle cx="16.5" cy="10.5" r="1.1"/>',
      groom: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>',
      event: '<path d="M12 2 9 9l-7 .5 5.5 4.5L6 21l6-3.5L18 21l-1.5-7L22 9.5 15 9Z"/>',
      texture: '<path d="M4 7c2-3 6-3 8 0s6 3 8 0"/><path d="M4 13c2-3 6-3 8 0s6 3 8 0"/><path d="M4 19c2-3 6-3 8 0s6 3 8 0"/>',
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || '') + '</svg>';
  }
  function buildShowcase() {
    var host = doc.getElementById('ssShowcase');
    if (!host) return;
    host.innerHTML = '';
    // Larger swipeable image cards. Honest photos where they exist; premium
    // gradient + icon otherwise. CTA wiring is preserved exactly (sc1 →
    // scroll-to-flagship+generate, sc2 → wig, sc3 color, sc4 groom, sc5 event).
    var slides = [
      { key: 'sc1', icon: 'stylist', accent: 'a', img: '/assets/style-studio/showcase/master-stylist-asian-male.webp', action: function () { scrollToFlagship(); onGenerateBest(); } },
      { key: 'sc2', icon: 'wig', accent: 'b', img: '/assets/style-studio/showcase/wig-match-asian-female.webp', action: scrollToWigMatch },
      { key: 'sc3', icon: 'color', accent: 'c', img: '/assets/style-studio/showcase/hair-color-asian-female.webp', action: function () { openModePanel('color'); } },
      { key: 'sc4', icon: 'groom', accent: 'd', img: '/assets/style-studio/showcase/eyebrow-beard-asian-male.webp', action: function () { openModePanel('eyebrow'); } },
      { key: 'sc5', icon: 'event', accent: 'e', img: '/assets/style-studio/showcase/event-vacation-asian-female.webp', action: function () { openModePanel('event'); } },
    ];
    slides.forEach(function (s) {
      var card = elt('div', 'ss-showcase-card ss-showcase-card--' + s.accent);
      card.setAttribute('role', 'listitem');
      var media = elt('div', 'ss-showcase-card__media');
      if (s.img) {
        var img = doc.createElement('img'); img.className = 'ss-showcase-card__bg';
        img.src = s.img; img.alt = t(s.key + '_title'); img.loading = 'lazy';
        img.addEventListener('error', function () { media.classList.add('ss-showcase-card__media--gradient'); if (img.parentNode) img.parentNode.removeChild(img); });
        media.appendChild(img);
      } else {
        media.classList.add('ss-showcase-card__media--gradient');
      }
      var ic = elt('span', 'ss-showcase-card__icon'); ic.innerHTML = showcaseIcon(s.icon);
      media.appendChild(ic);
      card.appendChild(media);
      var info = elt('div', 'ss-showcase-card__info');
      info.appendChild(elt('h3', 'ss-showcase-card__title', t(s.key + '_title')));
      info.appendChild(elt('p', 'ss-showcase-card__benefit', t(s.key + '_benefit')));
      var cta = elt('button', 'ss-showcase-card__cta', t(s.key + '_cta'));
      cta.type = 'button';
      cta.addEventListener('click', s.action);
      info.appendChild(cta);
      card.appendChild(info);
      host.appendChild(card);
    });
  }

  // ── Wig Match example strip ─────────────────────────────────────────────
  // SP-4: the flagship Wig Match section shows two beautiful example looks (an
  // Asian man + an Asian woman) so the value is visible before the user taps.
  // These are STYLE INSPIRATION photos (curated free-license stock), NOT AI
  // outputs — labelled as "the look", never as a fake before/after result.
  function buildWigExamples() {
    var host = doc.getElementById('ssWigExamples');
    if (!host) return;
    host.innerHTML = '';
    host.appendChild(elt('span', 'ss-wigex-header', t('wigExHeader')));
    var EX = [
      { img: '/assets/style-studio/showcase/wig-match-asian-male.webp', cap: 'wigExMale' },
      { img: '/assets/style-studio/showcase/wig-match-asian-female.webp', cap: 'wigExFemale' },
    ];
    EX.forEach(function (e) {
      var fig = elt('figure', 'ss-wigex');
      var img = doc.createElement('img'); img.className = 'ss-wigex__img';
      img.src = e.img; img.alt = t(e.cap); img.loading = 'lazy';
      img.addEventListener('error', function () { fig.classList.add('ss-wigex--gradient'); if (img.parentNode) img.parentNode.removeChild(img); });
      fig.appendChild(img);
      fig.appendChild(elt('figcaption', 'ss-wigex__cap', t(e.cap)));
      host.appendChild(fig);
    });
  }

  // ── Testimonials (LAUNCH PLACEHOLDERS) ─────────────────────────────────
  // SVG stars (never emoji). Quotes are clearly-marked launch placeholders in
  // SS_STRINGS — replace testimonial1/2/3 with real reviews before scaling.
  function starRow() {
    var wrap = elt('span', 'ss-stars');
    wrap.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 5; i++) {
      var s = elt('span', 'ss-star');
      s.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 9.2 8.6 2 9.2l5.4 4.7L5.8 21 12 17.3 18.2 21l-1.6-7.1L22 9.2l-7.2-.6Z"/></svg>';
      wrap.appendChild(s);
    }
    return wrap;
  }
  function buildTestimonials() {
    var host = doc.getElementById('ssTestimonials');
    if (!host) return;
    host.innerHTML = '';
    [1, 2, 3].forEach(function (n) {
      var card = elt('figure', 'ss-tcard');
      card.appendChild(starRow());
      var q = elt('blockquote', 'ss-tcard__quote', '“' + t('testimonial' + n) + '”');
      card.appendChild(q);
      card.appendChild(elt('figcaption', 'ss-tcard__name', '— ' + t('testimonialName' + n)));
      host.appendChild(card);
    });
  }
  function scrollToFlagship() {
    var el = doc.getElementById('ssGenerateBest') || doc.querySelector('.ss-flagship');
    if (el) try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
  }
  function scrollToWigMatch() {
    var el = doc.getElementById('ssWigMatch');
    if (el) try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
  }
  function openModePanel(mode) {
    var card = doc.querySelector('.ss-gcard[data-mode="' + mode + '"]');
    if (!card) {
      var modes = doc.getElementById('ssModes');
      if (modes) try { modes.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
      return;
    }
    // Reveal the option chips (if any) so the user lands ready to generate.
    var opts = card.querySelector('.ss-gcard__opts');
    var toggle = card.querySelector('.ss-gcard__optbtn');
    if (opts && opts.hidden) {
      opts.hidden = false;
      if (toggle) { toggle.setAttribute('aria-expanded', 'true'); toggle.classList.add('ss-gcard__optbtn--open'); }
    }
    card.classList.add('ss-gcard--highlight');
    root.setTimeout(function () { card.classList.remove('ss-gcard--highlight'); }, 1600);
    try { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
  }

  // ── AI Wig Match flagship flow ─────────────────────────────────────────
  function onWigGenerate() {
    // Never-silent guards (mirror the master flow).
    if (state.busy)           { wigStatus(t('busyWait'), false); return; }
    if (!state.consent)       { setStatus(t('consentRequired'), true); wigStatus(t('consentRequired'), true); return; }
    if (!state.selfieDataUrl) { wigStatus(t('needSelfie'), true); return; }
    if (!state.signedIn)      { wigStatus(t('preparingSession'), false); state.pendingGenerate = 'wig'; ensureSignedIn(); return; }
    state.busy = true; refreshButtons();
    state.sessionId = 'ss_wig_' + Math.random().toString(36).slice(2, 9);
    wigStatus(t('wigGenerating'));
    var resultEl = doc.getElementById('ssWigResult');
    if (resultEl) resultEl.innerHTML = '';
    logUi({ event: 'generate-wig' });
    callPublic({
      selfieDataUrl: state.selfieDataUrl, lang: state.lang,
      mode: 'wig', audience: state.audience, goal: state.goal,
    }).then(function (res) {
      state.busy = false; refreshButtons();
      logGate(res);
      // Guest-only create-account wall (requireLogin:true). Members never see it.
      if (res.requireLogin === true) { revealMembership(); wigStatus(t('loginWall'), true); return; }
      // Member daily-limit (DAILY_LIMIT): localized "try tomorrow", no prompt.
      if (res.code === 'DAILY_LIMIT') { wigStatus(t('err_DAILY_LIMIT'), true); return; }
      if (!res.ok) { wigStatus(res.message || t('error'), true); return; }
      var recs = (res.recommendations || []).filter(function (r) { return r && r.previewDataUrl && !r.error; });
      if (!recs.length) { wigStatus(t('err_PLAN_EMPTY'), true); return; }
      wigStatus('');
      renderWigResult(recs, res.analysis);
    });
  }
  function wigStatus(msg, isError) {
    var s = doc.getElementById('ssWigStatus');
    if (!s) return;
    s.textContent = msg || '';
    s.classList.toggle('ss-status--error', !!isError);
  }
  function renderWigResult(recs, analysis) {
    var host = doc.getElementById('ssWigResult');
    if (!host) return;
    host.innerHTML = '';
    // Highest-confidence rec is the featured "best match".
    var sorted = recs.slice().sort(function (a, b) {
      return (Number(b.confidence) || 0) - (Number(a.confidence) || 0);
    });
    var best = sorted[0];
    var rest = sorted.slice(1);
    state.lastResultCount = sorted.length;
    var before = state.selfieDataUrl || '';
    var allItems = sorted.map(function (rec) {
      return { src: rec.previewDataUrl || '', before: before, title: rec.title || '', why: rec.whyItFitsFace || '' };
    });
    var hasScores = !!(analysis && analysis.scores && typeof analysis.scores === 'object' &&
                       Object.keys(analysis.scores).length);

    // Featured best match — honest before→after slider (selfie → AI wig result).
    var bestCard = elt('article', 'ss-wig-best');
    var bSrc = best.previewDataUrl || '';
    if (bSrc && before) {
      var baWrap = elt('div', 'ss-wig-best__figure ss-wig-best__figure--ba');
      var ba = buildBeforeAfter(bSrc, before, function () { openViewer(allItems, 0); });
      baWrap.appendChild(ba);
      baWrap.appendChild(elt('span', 'ss-wig-best__badge', t('wigBest')));
      bestCard.appendChild(baWrap);
    } else if (bSrc) {
      var fig = elt('button', 'ss-wig-best__figure'); fig.type = 'button';
      fig.setAttribute('aria-label', t('expand'));
      var img = doc.createElement('img'); img.className = 'ss-wig-best__img';
      img.src = bSrc; img.alt = best.title || ''; img.loading = 'lazy';
      fig.appendChild(img); fig.appendChild(zoomBadge());
      fig.appendChild(elt('span', 'ss-wig-best__badge', t('wigBest')));
      fig.addEventListener('click', function () { openViewer(allItems, 0); });
      bestCard.appendChild(fig);
    }
    var bBody = elt('div', 'ss-wig-best__body');
    if (best.title) bBody.appendChild(elt('strong', 'ss-wig-best__title', best.title));
    if (hasScores) bBody.appendChild(elt('span', 'ss-wig-fit-chip', t('wigNaturalFit')));
    if (best.whyItFitsFace) bBody.appendChild(elt('p', 'ss-wig-best__why', best.whyItFitsFace));
    if (best.maintenance) bBody.appendChild(elt('p', 'ss-card__meta', best.maintenance));
    var bestRec = { mode: 'wig', title: best.title || 'best-wig', why: best.whyItFitsFace || '', sessionId: state.sessionId, styleId: best.styleId || '' };
    bBody.appendChild(buildActions(bSrc, best.styleId || best.title || 'best-wig', allItems, 0, bestRec));
    bestCard.appendChild(bBody);
    host.appendChild(bestCard);
    cacheLocal(state.sessionId, best.styleId || '', bSrc);
    recordLook('wig', best.title || 'best-wig', best.whyItFitsFace || '', state.sessionId, best.styleId || '');

    // Remaining wig options as a swipeable carousel (indexes 1..n into allItems).
    if (rest.length) {
      host.appendChild(elt('p', 'ss-wig-more', t('wigMore')));
      var track = elt('div', 'ss-carousel'); track.setAttribute('role', 'list');
      rest.forEach(function (rec, ri) {
        var idx = ri + 1; // position within allItems
        var src = rec.previewDataUrl || '';
        var card = elt('article', 'ss-card'); card.setAttribute('role', 'listitem');
        if (src) {
          var figure = elt('button', 'ss-card__figure'); figure.type = 'button';
          figure.setAttribute('aria-label', t('expand'));
          var cimg = doc.createElement('img'); cimg.className = 'ss-card__img';
          cimg.src = src; cimg.alt = rec.title || ''; cimg.loading = 'lazy';
          figure.appendChild(cimg); figure.appendChild(zoomBadge());
          figure.addEventListener('click', function () { openViewer(allItems, idx); });
          card.appendChild(figure);
        }
        var body = elt('div', 'ss-card__body');
        if (rec.title) body.appendChild(elt('strong', 'ss-card__title', rec.title));
        if (hasScores) body.appendChild(elt('span', 'ss-wig-fit-chip', t('wigNaturalFit')));
        if (rec.whyItFitsFace) body.appendChild(elt('p', 'ss-card__why', rec.whyItFitsFace));
        if (rec.maintenance) body.appendChild(elt('p', 'ss-card__meta', rec.maintenance));
        var rRec = { mode: 'wig', title: rec.title || ('wig-' + idx), why: rec.whyItFitsFace || '', sessionId: state.sessionId, styleId: rec.styleId || '' };
        body.appendChild(buildActions(src, rec.styleId || rec.title || ('wig-' + idx), allItems, idx, rRec));
        card.appendChild(body);
        track.appendChild(card);
        cacheLocal(state.sessionId, rec.styleId || '', src);
        recordLook('wig', rec.title || ('wig-' + idx), rec.whyItFitsFace || '', state.sessionId, rec.styleId || '');
      });
      host.appendChild(track);
      if (sorted.length > 1) {
        var hint = elt('p', 'ss-carousel__hint'); hint.textContent = '‹ ' + sorted.length + ' ›';
        host.appendChild(hint);
      }
    }
    if (state.isCustomer) { var ap = doc.getElementById('ssAccountPanel'); if (ap && !ap.hidden) renderAccountPanel(); }
    try { bestCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
    logUi({ event: 'wig-rendered' });
  }

  function revealMembership() {
    // The create-account prompt is for ANONYMOUS guests only. A logged-in member
    // already has an account — defensively no-op so they can never see it, even if
    // a caller reaches here by mistake.
    if (!state.isAnonymous) { logGate({ ok: false, code: 'membership_suppressed_member' }); return; }
    var el = doc.getElementById('ssMembershipPrompt');
    if (el) { el.hidden = false; try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {} }
  }

  // ── Customer account ───────────────────────────────────────────────────
  // REUSE of the mobile-barber customer auth scheme (do NOT invent a new
  // identity): the same derived email + Firebase email/password account works
  // on /mobile-barber and here. See mobile-barber-customer.js.
  function normalizePhone(phone) {
    var d = String(phone || '').replace(/\D/g, '');
    if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
    return d.slice(-10);
  }
  function customerEmailForPhone(phone) {
    return normalizePhone(phone) + '@mobile-barber.dulichcali21.local';
  }
  function isCustomerUser(user) {
    return !!(user && !user.isAnonymous && user.uid);
  }
  function authDb() { return root.firebase && root.firebase.firestore ? root.firebase.firestore() : null; }
  function ensureAuthPersistence() {
    var a = (root.firebase && root.firebase.auth) ? root.firebase.auth() : null;
    if (!a) return Promise.reject(new Error('auth_unavailable'));
    var P = root.firebase.auth.Auth.Persistence.LOCAL;
    return Promise.resolve(a.setPersistence ? a.setPersistence(P) : null).then(function () { return a; });
  }
  // Build the profile payload that satisfies isValidMobileBarberCustomerCreate
  // (customerUid/customerId == uid, and customerPhoneNormalized/normalizedPhone
  // is a string). Mirrors profilePayload() in mobile-barber-customer.js. No image
  // fields are ever written — privacy-first.
  function customerProfilePayload(uid, name, phone) {
    var normalized = normalizePhone(phone);
    var ts = root.firebase.firestore.FieldValue.serverTimestamp();
    return {
      id: uid, customerId: uid, customerUid: uid,
      phone: phone, normalizedPhone: normalized,
      customerPhone: phone, customerPhoneNormalized: normalized,
      name: name || '', customerName: name || '',
      email: '', customerEmail: '',
      preferredLanguage: state.lang,
      preferredAddress: '', savedAddresses: [], bookingHistory: [],
      preferredBarber: '', paymentPreference: '', confirmationPreference: '',
      haircutPreferences: {},
      createdAt: ts, updatedAt: ts,
    };
  }
  function mapAuthError(err) {
    var code = (err && err.code) || '';
    if (code === 'auth/email-already-in-use') return t('authEmailInUse');
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') return t('authWrongPassword');
    if (code === 'auth/user-not-found') return t('authUserNotFound');
    if (code === 'auth/too-many-requests') return t('authTooManyRequests');
    if (code === 'auth/weak-password') return t('authWeakPassword');
    if (code === 'auth/invalid-email') return t('authInvalidPhone');
    return t('authError');
  }

  // ── Account control (top bar) ──────────────────────────────────────────
  function profileIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.4"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>';
  }
  function renderAccount() {
    var host = doc.getElementById('ssAccount');
    if (!host) return;
    host.innerHTML = '';
    if (state.isCustomer) {
      var label = state.account.name || state.account.phone || t('myAccount');
      // The chip is now a button: tapping it opens the account panel
      // (profile + Favorites + Saved looks). Stays signed in until Logout.
      var chip = elt('button', 'ss-account__chip ss-account__chip--btn');
      chip.type = 'button';
      chip.setAttribute('title', label);
      chip.setAttribute('aria-label', t('myAccount'));
      var ic = elt('span', 'ss-account__avatar'); ic.innerHTML = profileIcon();
      chip.appendChild(ic);
      chip.appendChild(elt('span', 'ss-account__name', label));
      chip.addEventListener('click', openAccountPanel);
      var out = elt('button', 'ss-account__logout', t('logout'));
      out.type = 'button';
      out.addEventListener('click', onLogout);
      host.appendChild(chip);
      host.appendChild(out);
    } else {
      var login = elt('button', 'ss-account__login');
      login.type = 'button';
      var lic = elt('span', 'ss-account__login-ic'); lic.innerHTML = profileIcon();
      login.appendChild(lic);
      login.appendChild(elt('span', null, t('logInOrSignUp')));
      login.addEventListener('click', function () { openAuthPanel('login'); });
      host.appendChild(login);
    }
  }

  // ── Customer account panel (profile + Favorites + Saved looks) ──────────
  // Inline, non-trapping panel (like the auth panel). Favorites + history are
  // LOCAL only (localStorage) — no Firestore reads/writes, no image uploads.
  function openAccountPanel() {
    state.acctTab = state.acctTab || 'history';
    renderAccountPanel();
    var panel = doc.getElementById('ssAccountPanel');
    if (panel) {
      panel.hidden = false;
      try { panel.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    }
  }
  function closeAccountPanel() {
    var panel = doc.getElementById('ssAccountPanel');
    if (panel) { panel.hidden = true; panel.innerHTML = ''; }
  }
  function renderAccountPanel() {
    var panel = doc.getElementById('ssAccountPanel');
    if (!panel) return;
    panel.innerHTML = '';
    var tab = state.acctTab === 'favorites' ? 'favorites' : 'history';

    var card = elt('div', 'ss-acct__card');
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', t('accountTitle'));

    var head = elt('div', 'ss-acct__head');
    var who = elt('div', 'ss-acct__who');
    var av = elt('span', 'ss-acct__avatar'); av.innerHTML = profileIcon();
    who.appendChild(av);
    var meta = elt('div', 'ss-acct__meta');
    meta.appendChild(elt('strong', 'ss-acct__name', state.account.name || t('myAccount')));
    if (state.account.phone) meta.appendChild(elt('span', 'ss-acct__phone', state.account.phone));
    who.appendChild(meta);
    head.appendChild(who);
    var close = elt('button', 'ss-auth__close', '×');
    close.type = 'button'; close.setAttribute('aria-label', t('close'));
    close.addEventListener('click', closeAccountPanel);
    head.appendChild(close);
    card.appendChild(head);

    // Tabs (segmented, never a select).
    var tabs = elt('div', 'ss-acct__tabs'); tabs.setAttribute('role', 'group');
    [['history', 'tabHistory'], ['favorites', 'tabFavorites']].forEach(function (pair) {
      var b = elt('button', 'ss-acct__tab', t(pair[1]));
      b.type = 'button';
      var on = pair[0] === tab;
      b.classList.toggle('ss-acct__tab--active', on);
      b.setAttribute('aria-pressed', String(on));
      b.addEventListener('click', function () { state.acctTab = pair[0]; renderAccountPanel(); });
      tabs.appendChild(b);
    });
    card.appendChild(tabs);

    var list = loadStore(tab === 'favorites' ? FAV_KEY : HISTORY_KEY);
    if (!list.length) {
      card.appendChild(elt('p', 'ss-acct__empty', t(tab === 'favorites' ? 'noFavorites' : 'noHistory')));
    } else {
      var grid = elt('div', 'ss-acct__grid');
      list.forEach(function (rec) {
        grid.appendChild(buildAccountLook(rec, tab));
      });
      card.appendChild(grid);
      if (tab === 'favorites') card.appendChild(elt('p', 'ss-acct__hint', t('favoritesHint')));
    }
    panel.appendChild(card);
  }
  // A saved/favorited look tile. The image is read back from the on-device
  // cache (MobileBarberAIPreview) — text reference only is persisted in the store.
  function buildAccountLook(rec, tab) {
    var tile = elt('article', 'ss-acct__look');
    var cached = readCachedImage(rec.sessionId, rec.styleId);
    var item = { src: cached, before: state.selfieDataUrl || '', title: rec.title || '', why: rec.why || '' };
    if (cached) {
      var fig = elt('button', 'ss-acct__look-fig'); fig.type = 'button';
      fig.setAttribute('aria-label', t('expand'));
      var img = doc.createElement('img'); img.className = 'ss-acct__look-img';
      img.src = cached; img.alt = rec.title || ''; img.loading = 'lazy';
      fig.appendChild(img);
      fig.addEventListener('click', function () { openAccountPanelLook(item); });
      tile.appendChild(fig);
    } else {
      var ph = elt('div', 'ss-acct__look-ph'); ph.innerHTML = showcaseIcon('stylist');
      tile.appendChild(ph);
    }
    var body = elt('div', 'ss-acct__look-body');
    if (rec.title) body.appendChild(elt('strong', 'ss-acct__look-title', rec.title));
    if (tab === 'favorites') {
      var rm = elt('button', 'ss-acct__look-rm', t('removeFavorite'));
      rm.type = 'button';
      rm.addEventListener('click', function () { removeFavorite(rec); renderAccountPanel(); });
      body.appendChild(rm);
    }
    tile.appendChild(body);
    return tile;
  }
  function openAccountPanelLook(item) {
    if (!item || !item.src) return;
    openViewer([item], 0);
  }

  // ── Inline (non-trapping) login / signup panel ─────────────────────────
  function openAuthPanel(mode) {
    state.authMode = (mode === 'signup') ? 'signup' : 'login';
    state.authBusy = false;
    renderAuthPanel();
    var panel = doc.getElementById('ssAuthPanel');
    if (panel) {
      panel.hidden = false;
      try { panel.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      var firstInput = panel.querySelector('input');
      if (firstInput) try { firstInput.focus(); } catch (e) {}
    }
  }
  function closeAuthPanel() {
    var panel = doc.getElementById('ssAuthPanel');
    if (panel) { panel.hidden = true; panel.innerHTML = ''; }
  }
  function renderAuthPanel() {
    var panel = doc.getElementById('ssAuthPanel');
    if (!panel) return;
    var signup = state.authMode === 'signup';
    panel.innerHTML = '';

    var card = elt('div', 'ss-auth__card');
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', t(signup ? 'authTitleSignup' : 'authTitleLogin'));

    var head = elt('div', 'ss-auth__head');
    head.appendChild(elt('h2', 'ss-auth__title', t(signup ? 'authTitleSignup' : 'authTitleLogin')));
    var close = elt('button', 'ss-auth__close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', t('close'));
    close.addEventListener('click', closeAuthPanel);
    head.appendChild(close);
    card.appendChild(head);

    card.appendChild(elt('p', 'ss-auth__intro', t('authIntro')));

    var form = doc.createElement('form');
    form.className = 'ss-auth__form';
    form.setAttribute('novalidate', 'novalidate');

    if (signup) {
      form.appendChild(authField('name', t('name'), 'text', 'name'));
    }
    form.appendChild(authField('phone', t('phone'), 'tel', 'tel'));
    form.appendChild(authField('password', t('password'), 'password', signup ? 'new-password' : 'current-password'));

    if (signup) {
      form.appendChild(elt('p', 'ss-auth__help', t('passwordHelp')));
    }

    var err = elt('p', 'ss-auth__error', '');
    err.id = 'ssAuthError';
    err.hidden = true;
    form.appendChild(err);

    var submit = elt('button', 'ss-cta ss-auth__submit', t(signup ? 'submitSignup' : 'submitLogin'));
    submit.type = 'submit';
    form.appendChild(submit);

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (state.authBusy) return;
      if (signup) doSignup(form); else doLogin(form);
    });
    card.appendChild(form);

    var toggle = elt('button', 'ss-auth__toggle', t(signup ? 'authToggleToLogin' : 'authToggleToSignup'));
    toggle.type = 'button';
    toggle.addEventListener('click', function () { openAuthPanel(signup ? 'login' : 'signup'); });
    card.appendChild(toggle);

    panel.appendChild(card);
  }
  function authField(name, label, type, autocomplete) {
    var wrap = elt('label', 'ss-auth__field');
    wrap.appendChild(elt('span', 'ss-auth__label', label));
    var input = doc.createElement('input');
    input.className = 'ss-auth__input';
    input.name = name;
    input.type = type;
    if (type === 'tel') input.setAttribute('inputmode', 'tel');
    if (autocomplete) input.setAttribute('autocomplete', autocomplete);
    wrap.appendChild(input);
    return wrap;
  }
  function authValue(form, name) {
    var el = form.querySelector('[name="' + name + '"]');
    return el ? String(el.value || '').trim() : '';
  }
  function showAuthError(form, msg) {
    var node = form.querySelector('#ssAuthError');
    if (!node) return;
    node.hidden = false;
    node.textContent = msg || '';
  }
  function clearAuthError(form) {
    var node = form.querySelector('#ssAuthError');
    if (node) { node.hidden = true; node.textContent = ''; }
  }
  function setAuthBusy(form, busy) {
    state.authBusy = !!busy;
    var submit = form.querySelector('.ss-auth__submit');
    if (submit) {
      submit.disabled = !!busy;
      if (busy) {
        submit.setAttribute('data-label', submit.textContent);
        submit.textContent = t('working');
      } else {
        var prev = submit.getAttribute('data-label');
        if (prev) submit.textContent = prev;
      }
    }
  }

  function doLogin(form) {
    clearAuthError(form);
    var phone = authValue(form, 'phone');
    var pass = form.querySelector('[name="password"]') ? form.querySelector('[name="password"]').value : '';
    if (!phone || !pass) { showAuthError(form, t('authMissingFields')); return; }
    if (normalizePhone(phone).length < 10) { showAuthError(form, t('authInvalidPhone')); return; }
    setAuthBusy(form, true);
    ensureAuthPersistence().then(function (a) {
      return a.signInWithEmailAndPassword(customerEmailForPhone(phone), pass);
    }).then(function () {
      // onAuthStateChanged refreshes the UI; just close the panel.
      logAuth({ gateReason: 'login_success' });
      closeAuthPanel();
    }).catch(function (err) {
      setAuthBusy(form, false);
      showAuthError(form, mapAuthError(err));
    });
  }

  function doSignup(form) {
    clearAuthError(form);
    var name = authValue(form, 'name');
    var phone = authValue(form, 'phone');
    var pass = form.querySelector('[name="password"]') ? form.querySelector('[name="password"]').value : '';
    if (!phone || !pass) { showAuthError(form, t('authMissingFields')); return; }
    if (normalizePhone(phone).length < 10) { showAuthError(form, t('authInvalidPhone')); return; }
    if (String(pass).length < 8) { showAuthError(form, t('authWeakPassword')); return; }
    setAuthBusy(form, true);
    ensureAuthPersistence().then(function (a) {
      return a.createUserWithEmailAndPassword(customerEmailForPhone(phone), pass);
    }).then(function (cred) {
      var uid = cred && cred.user && cred.user.uid;
      // Auth account + LOCAL persistence are the core requirement — a profile
      // write hiccup must NOT block account creation. Best-effort, fire-and-forget.
      try {
        var db = authDb();
        if (db && uid) {
          db.collection('mobileBarberCustomers').doc(uid)
            .set(customerProfilePayload(uid, name, phone), { merge: true })
            .catch(function (e) { if (root.console) root.console.warn('[style-studio] profile write skipped', e); });
        }
      } catch (e) { if (root.console) root.console.warn('[style-studio] profile write error', e); }
      // The signup write IS the profile — mark it present so repair won't re-create.
      state.profileExists = true;
      logAuth({ gateReason: 'signup_success' });
      closeAuthPanel();
    }).catch(function (err) {
      setAuthBusy(form, false);
      showAuthError(form, mapAuthError(err));
    });
  }

  // The ONLY place signOut is ever called — explicit user logout. Everything else
  // (language switch, generation, modal close, reload) leaves the session intact.
  function onLogout() {
    logAuth({ gateReason: 'logout_requested' });
    var a = (root.firebase && root.firebase.auth) ? root.firebase.auth() : null;
    if (a) a.signOut().catch(function () {});
    // onAuthStateChanged then re-signs-in anonymously → account UI resets to
    // "Log in / Sign up" and the anonymous guest flow continues uninterrupted.
  }

  // ── Anonymous auth + customer account state ────────────────────────────
  function applyAccountFromUser(user) {
    state.user = user || null;
    // isAnonymous mirrors the Firebase user. No user (signed out) is treated as
    // anonymous for gating purposes (the create-account wall remains available).
    state.isAnonymous = user ? !!user.isAnonymous : true;
    // SP-5 (goal 6): the moment a guest becomes a logged-in member (signup/login
    // via the wall's own CTA, or a restored session on reload), clear any stale
    // "Create a free account" wall. revealMembership() only re-shows it for an
    // anonymous guest, so a member never sees it again. Guests are untouched.
    if (!state.isAnonymous) {
      var _mp = doc.getElementById('ssMembershipPrompt');
      if (_mp) _mp.hidden = true;
    }
    state.isCustomer = isCustomerUser(user);
    if (!state.isCustomer) {
      state.account = { name: '', phone: '' };
      state.profileExists = false;
      renderAccount();
      return;
    }
    // Seed the chip from the derived email so it shows immediately, then refine
    // with the customer's saved name/phone from their profile doc (best-effort).
    var derivedPhone = '';
    try { derivedPhone = String(user.email || '').split('@')[0] || ''; } catch (e) {}
    state.account = { name: '', phone: derivedPhone };
    renderAccount();
    repairCustomerProfile(user, derivedPhone);
  }

  // PROFILE AUTO-REPAIR — when a real (non-anonymous) customer signs in, make sure
  // their mobileBarberCustomers/{uid} doc exists. If the read shows it missing,
  // create it from the known name/phone (derive phone from the account email when a
  // saved phone isn't available). Best-effort; never blocks the UI. NO image writes.
  function repairCustomerProfile(user, derivedPhone) {
    state.profileExists = false;
    if (!user || user.isAnonymous || !user.uid) return;
    var db = authDb();
    if (!db) return;
    var ref = db.collection('mobileBarberCustomers').doc(user.uid);
    try {
      ref.get().then(function (snap) {
        if (snap && snap.exists) {
          state.profileExists = true;
          var d = snap.data() || {};
          state.account = {
            name: d.name || d.customerName || '',
            phone: d.phone || d.customerPhone || derivedPhone,
          };
          if (state.isCustomer) renderAccount();
          logAuth({ gateReason: 'profile_loaded' });
          return;
        }
        // Doc missing — create it (logged in but no profile). Use the known name
        // (none yet) and the phone derived from the account email.
        var phone = state.account.phone || derivedPhone || '';
        ref.set(customerProfilePayload(user.uid, state.account.name || '', phone), { merge: true })
          .then(function () {
            state.profileExists = true;
            if (state.isCustomer) renderAccount();
            logAuth({ gateReason: 'profile_created' });
          })
          .catch(function (e) { if (root.console) root.console.warn('[style-studio] profile repair write skipped', e); });
      }).catch(function (e) { if (root.console) root.console.warn('[style-studio] profile repair read skipped', e); });
    } catch (e) { if (root.console) root.console.warn('[style-studio] profile repair error', e); }
  }

  function initAuth() {
    if (typeof root.firebase === 'undefined' || !root.firebase.auth) { renderAccount(); return; }
    setStatus(t('signingIn'));
    var auth = root.firebase.auth();
    // PERSISTENCE — set LOCAL globally, BEFORE any auth listener/sign-in, so the
    // session survives reloads and tab closes until an EXPLICIT logout. Never
    // SESSION/NONE. We do NOT clear auth/local/sessionStorage on load, and we do
    // NOT sign out anywhere except the Logout button. If setPersistence fails we
    // still attach the listener (Firebase default is already LOCAL).
    var P = (root.firebase.auth.Auth && root.firebase.auth.Auth.Persistence)
      ? root.firebase.auth.Auth.Persistence.LOCAL : null;
    var ready = (P && auth.setPersistence)
      ? auth.setPersistence(P).catch(function (e) { if (root.console) root.console.warn('[style-studio] setPersistence failed', e); })
      : Promise.resolve();
    ready.then(function () {
      try {
        auth.onAuthStateChanged(function (user) {
          if (user) {
            state.signedIn = true; refreshButtons();
            // Generate flows run under whatever uid is current (anon guest OR a real
            // customer — member quota — automatically). We NEVER sign a real user out
            // or replace them with an anonymous session here.
            applyAccountFromUser(user);
            logAuth({ gateReason: state.pendingGenerate ? 'pending_generate' : 'auth_ready' });
            if (state.pendingGenerate) {
              // A generation was queued while auth was still completing — run it now
              // so the user never has to tap twice (seamless).
              runPendingGenerate();
            } else if (!state.busy) {
              setStatus(state.selfieDataUrl ? t('photoReady') : t('ready'));
            }
          } else {
            // Only kick anonymous sign-in when there is genuinely NO user. The guard
            // prevents duplicate anon sign-ins and guarantees we never anon-over a
            // real user (a real user is never null here).
            state.signedIn = false; refreshButtons();
            applyAccountFromUser(null);
            logAuth({ gateReason: 'no_user_signing_in_anon' });
            if (!state._anonInFlight) {
              state._anonInFlight = true;
              auth.signInAnonymously().catch(function (err) {
                if (root.console) root.console.error('[style-studio] anon sign-in failed', err);
                setStatus(t('error'), true);
              }).finally(function () { state._anonInFlight = false; });
            }
          }
        });
      } catch (e) {
        if (root.console) root.console.error('[style-studio] auth init failed', e);
        renderAccount();
      }
    });
  }

  // ── Wire up ────────────────────────────────────────────────────────────
  function init() {
    state.lang = detectLang();
    doc.documentElement.setAttribute('lang', state.lang);
    doc.querySelectorAll('#ssLang .ss-lang__btn').forEach(function (btn) {
      btn.addEventListener('click', function () { setLang(btn.getAttribute('data-lang')); });
    });
    var consent = doc.getElementById('ssConsent');
    if (consent) consent.addEventListener('change', function () { state.consent = consent.checked; refreshButtons(); });
    var upload = doc.getElementById('ssSelfieInput');
    if (upload) upload.addEventListener('change', onUpload);
    // Belt-and-suspenders for iOS Safari: the file input lives inside a <label>
    // (native tap-to-open), but iOS occasionally fails to fire that activation.
    // Trigger the input EXPLICITLY from this trusted tap so the picker reliably
    // opens. preventDefault + stopPropagation suppress the label's own native
    // activation so the picker can NEVER open twice; a short re-entrancy guard is
    // a second safeguard. The <label> stays in the markup as a no-JS fallback, so
    // native behavior is preserved if this handler ever fails to attach. Works on
    // desktop (click) and iPhone (tap), and on the preview <img> after re-upload.
    var uploadBtn = doc.getElementById('ssUploadBtn');
    if (uploadBtn && upload) {
      var pickerOpening = false;
      uploadBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (pickerOpening) return;          // ignore a duplicate within the window
        pickerOpening = true;
        logUi({ event: 'upload-tap' });
        try { upload.click(); } catch (err) { if (root.console) root.console.error('[style-studio] upload.click failed', err); }
        root.setTimeout(function () { pickerOpening = false; }, 800);
      });
    }
    var best = doc.getElementById('ssGenerateBest');
    if (best) best.addEventListener('click', onGenerateBest);
    var wig = doc.getElementById('ssWigGenerate');
    if (wig) wig.addEventListener('click', onWigGenerate);
    // Login wall CTA → open the inline signup panel (no more link to /mobile-barber/).
    var memberCta = doc.getElementById('ssMembershipCta');
    if (memberCta) memberCta.addEventListener('click', function () { openAuthPanel('signup'); });

    applyI18n();
    buildGoalChips();
    buildAudienceSeg();
    buildGallery();
    buildShowcase();
    buildWigExamples();
    buildTestimonials();
    syncLangButtons();
    renderAccount();
    refreshButtons();
    refreshWigUi();
    initAuth();
    logUi({ event: 'init' });
  }

  root.StyleStudioPublic = { init: init, setLang: setLang, _t: t, _state: state, _strings: SS_STRINGS, _openViewer: openViewer, _closeViewer: closeViewer, _onWigGenerate: onWigGenerate, _buildShowcase: buildShowcase, _buildGallery: buildGallery, _buildWigExamples: buildWigExamples, _buildTestimonials: buildTestimonials, _openAuthPanel: openAuthPanel, _closeAuthPanel: closeAuthPanel, _openAccountPanel: openAccountPanel, _closeAccountPanel: closeAccountPanel, _customerEmailForPhone: customerEmailForPhone, _normalizePhone: normalizePhone, _isCustomerUser: isCustomerUser };

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})(typeof window !== 'undefined' ? window : this);
