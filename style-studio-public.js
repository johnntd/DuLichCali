'use strict';
// ─────────────────────────────────────────────────────────────────────────
// AI Style Studio — PUBLIC client  (style-studio-public.js?v=20260613f)
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

  var MASTER_ATTR_KEYS = ['haircut', 'color', 'texture', 'bangs', 'eyebrows', 'beard', 'wigOrSystem'];

  var state = {
    lang: 'en', consent: false, selfieDataUrl: '',
    audience: 'neutral', goal: '',
    signedIn: false, busy: false, sessionId: '',
    lastResultCount: 0,
    // Customer account (reuses mobile-barber customer auth). isCustomer = a real
    // (non-anonymous) signed-in customer; account = display name / phone of that user.
    user: null, isCustomer: false, account: { name: '', phone: '' },
    authMode: 'login', authBusy: false,
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
    buildAccordion();
    buildShowcase();
    refreshWigUi();
    syncLangButtons();
    renderAccount();
    var authPanel = doc.getElementById('ssAuthPanel');
    if (authPanel && !authPanel.hidden) renderAuthPanel();
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

  // ── Accordion of 9 manual modes ────────────────────────────────────────
  function buildAccordion() {
    var acc = doc.getElementById('ssAccordion');
    if (!acc) return;
    acc.innerHTML = '';
    STUDIO_DEFS.forEach(function (def) {
      var d = doc.createElement('details'); d.className = 'ss-panel'; d.setAttribute('data-mode', def.mode);
      var sum = doc.createElement('summary'); sum.className = 'ss-panel__summary';
      sum.appendChild(elt('span', null, t(def.label)));
      d.appendChild(sum);
      var body = elt('div', 'ss-panel__body');
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
        body.appendChild(group);
      });
      var gen = elt('button', 'ss-cta', t('modeGenerate'));
      gen.type = 'button'; gen.disabled = !canSubmit();
      gen.setAttribute('data-mode-generate', def.mode);
      var results = elt('div', 'ss-mode-results');
      results.setAttribute('data-results-for', def.mode);
      gen.addEventListener('click', function () { onModeGenerate(def, body, results); });
      body.appendChild(gen); body.appendChild(results);
      d.appendChild(body); acc.appendChild(d);
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
      if (p.requireLogin || p.code === 'LIMIT_REACHED') {
        return { ok: false, requireLogin: true, message: t('loginWall') };
      }
      var code = p.debugCode || p.code || '';
      return { ok: false, code: code, message: t('err_' + code) || t('error') };
    }).catch(function (err) {
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
    if (a.currentUser) return; // onAuthStateChanged already fired / will fire
    try {
      a.signInAnonymously().catch(function (err) {
        if (root.console) root.console.error('[style-studio] anon sign-in failed', err);
        state.pendingGenerate = '';
        logMaster('error', { message: 'session_' + ((err && err.message) || String(err)) });
        setStatus(t('sessionError'), true);
      });
    } catch (e) {
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
      if (res.requireLogin) { revealMembership(); setStatus(t('loginWall'), true); return; }
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
    var item = { src: src, title: mp.title || t('masterTitle'), why: mp.explanation || '' };
    var card = elt('article', 'ss-master-card');

    if (src) {
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
    body.appendChild(buildActions(src, item.title || 'best-look', [item], 0));
    card.appendChild(body);
    host.appendChild(card);
    cacheLocal(state.sessionId, 'master', src);
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
      if (res.requireLogin) { revealMembership(); resultsEl.appendChild(elt('p', 'ss-mode-results__status', t('loginWall'))); return; }
      if (!res.ok) { resultsEl.appendChild(elt('p', 'ss-mode-results__status', res.message || t('error'))); return; }
      var recs = (res.recommendations || []).filter(function (r) { return r && r.previewDataUrl && !r.error; });
      if (!recs.length) { resultsEl.appendChild(elt('p', 'ss-mode-results__status', t('err_PLAN_EMPTY'))); return; }
      renderCarousel(resultsEl, recs);
    });
  }

  function renderCarousel(container, recs) {
    container.innerHTML = '';
    state.lastResultCount = recs.length;
    var items = recs.map(function (rec) {
      return { src: rec.previewDataUrl || '', title: rec.title || '', why: rec.whyItFitsFace || '' };
    });
    var track = elt('div', 'ss-carousel');
    track.setAttribute('role', 'list');
    recs.forEach(function (rec, i) {
      var src = items[i].src;
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
      body.appendChild(buildActions(src, rec.styleId || rec.title || ('look-' + (i + 1)), items, i));
      card.appendChild(body);
      track.appendChild(card);
      cacheLocal(state.sessionId, rec.styleId || '', src);
    });
    container.appendChild(track);
    if (recs.length > 1) {
      var hint = elt('p', 'ss-carousel__hint'); hint.textContent = '‹ ' + recs.length + ' ›';
      container.appendChild(hint);
    }
    logUi({ event: 'carousel-rendered' });
  }

  function zoomBadge() {
    var b = elt('span', 'ss-zoom-badge');
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>';
    return b;
  }

  // ── Actions (Save / Share / Expand) ────────────────────────────────────
  function buildActions(src, baseName, items, index) {
    var actions = elt('div', 'ss-actions');
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
  function icon(name) {
    var P = {
      download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
      share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
      expand: '<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>',
      x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || '') + '</svg>';
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

  // ── Favorites (local only) ─────────────────────────────────────────────
  function cacheLocal(sessionId, styleId, src) {
    var AIP = root.MobileBarberAIPreview;
    if (AIP && typeof AIP.saveLocalCopy === 'function' && src) {
      try { AIP.saveLocalCopy(sessionId, styleId || '', src); } catch (e) {}
    }
  }

  // ── Self-contained full-screen VIEWER (pinch / swipe / close) ──────────
  var viewer = { open: false, items: [], index: 0, scrollY: 0, scale: 1, tx: 0, ty: 0,
                 startDist: 0, startScale: 1, lastX: 0, lastY: 0, lastTap: 0, moved: false, panStart: null };

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
    var vSave = elt('button', 'ss-viewer__btn'); vSave.type = 'button';
    vSave.innerHTML = icon('download') + '<span>' + t('saveToPhone') + '</span>';
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
    resetZoom(img);
    img.src = it.src; img.alt = it.title || '';
    var titleEl = doc.querySelector('#ssViewer .ss-viewer__title');
    if (titleEl) titleEl.textContent = (it.title || '') + (viewer.items.length > 1 ? '  (' + (viewer.index + 1) + '/' + viewer.items.length + ')' : '');
  }
  function navViewer(dir) {
    if (viewer.items.length < 2) return;
    viewer.index = (viewer.index + dir + viewer.items.length) % viewer.items.length;
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
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || '') + '</svg>';
  }
  function buildShowcase() {
    var host = doc.getElementById('ssShowcase');
    if (!host) return;
    host.innerHTML = '';
    var slides = [
      { key: 'sc1', icon: 'stylist', accent: 'a', action: scrollToFlagship },
      { key: 'sc2', icon: 'wig', accent: 'b', action: scrollToWigMatch },
      { key: 'sc3', icon: 'color', accent: 'c', action: function () { openModePanel('color'); } },
      { key: 'sc4', icon: 'groom', accent: 'd', action: function () { openModePanel('eyebrow'); } },
      { key: 'sc5', icon: 'event', accent: 'e', action: function () { openModePanel('event'); } },
    ];
    slides.forEach(function (s) {
      var card = elt('div', 'ss-showcase-card ss-showcase-card--' + s.accent);
      card.setAttribute('role', 'listitem');
      var ic = elt('span', 'ss-showcase-card__icon'); ic.innerHTML = showcaseIcon(s.icon);
      card.appendChild(ic);
      card.appendChild(elt('h3', 'ss-showcase-card__title', t(s.key + '_title')));
      card.appendChild(elt('p', 'ss-showcase-card__benefit', t(s.key + '_benefit')));
      var cta = elt('button', 'ss-showcase-card__cta', t(s.key + '_cta'));
      cta.type = 'button';
      cta.addEventListener('click', s.action);
      card.appendChild(cta);
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
    var panel = doc.querySelector('.ss-panel[data-mode="' + mode + '"]');
    if (!panel) {
      var modes = doc.getElementById('ssModes');
      if (modes) try { modes.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
      return;
    }
    panel.open = true;
    try { panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
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
      if (res.requireLogin) { revealMembership(); wigStatus(t('loginWall'), true); return; }
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
    var allItems = sorted.map(function (rec) {
      return { src: rec.previewDataUrl || '', title: rec.title || '', why: rec.whyItFitsFace || '' };
    });
    var hasScores = !!(analysis && analysis.scores && typeof analysis.scores === 'object' &&
                       Object.keys(analysis.scores).length);

    // Featured best match.
    var bestCard = elt('article', 'ss-wig-best');
    var bSrc = best.previewDataUrl || '';
    if (bSrc) {
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
    bBody.appendChild(buildActions(bSrc, best.styleId || best.title || 'best-wig', allItems, 0));
    bestCard.appendChild(bBody);
    host.appendChild(bestCard);
    cacheLocal(state.sessionId, best.styleId || '', bSrc);

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
        body.appendChild(buildActions(src, rec.styleId || rec.title || ('wig-' + idx), allItems, idx));
        card.appendChild(body);
        track.appendChild(card);
        cacheLocal(state.sessionId, rec.styleId || '', src);
      });
      host.appendChild(track);
      if (sorted.length > 1) {
        var hint = elt('p', 'ss-carousel__hint'); hint.textContent = '‹ ' + sorted.length + ' ›';
        host.appendChild(hint);
      }
    }
    try { bestCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
    logUi({ event: 'wig-rendered' });
  }

  function revealMembership() {
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
  function renderAccount() {
    var host = doc.getElementById('ssAccount');
    if (!host) return;
    host.innerHTML = '';
    if (state.isCustomer) {
      var label = state.account.name || state.account.phone || t('myAccount');
      var chip = elt('span', 'ss-account__chip', label);
      chip.setAttribute('title', label);
      var out = elt('button', 'ss-account__logout', t('logout'));
      out.type = 'button';
      out.addEventListener('click', onLogout);
      host.appendChild(chip);
      host.appendChild(out);
    } else {
      var login = elt('button', 'ss-account__login', t('logInOrSignUp'));
      login.type = 'button';
      login.addEventListener('click', function () { openAuthPanel('login'); });
      host.appendChild(login);
    }
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
      closeAuthPanel();
    }).catch(function (err) {
      setAuthBusy(form, false);
      showAuthError(form, mapAuthError(err));
    });
  }

  function onLogout() {
    var a = (root.firebase && root.firebase.auth) ? root.firebase.auth() : null;
    if (a) a.signOut().catch(function () {});
    // onAuthStateChanged then re-signs-in anonymously → account UI resets to
    // "Log in / Sign up" and the anonymous guest flow continues uninterrupted.
  }

  // ── Anonymous auth + customer account state ────────────────────────────
  function applyAccountFromUser(user) {
    state.user = user || null;
    state.isCustomer = isCustomerUser(user);
    if (!state.isCustomer) {
      state.account = { name: '', phone: '' };
      renderAccount();
      return;
    }
    // Seed the chip from the derived email so it shows immediately, then refine
    // with the customer's saved name/phone from their profile doc (best-effort).
    var derivedPhone = '';
    try { derivedPhone = String(user.email || '').split('@')[0] || ''; } catch (e) {}
    state.account = { name: '', phone: derivedPhone };
    renderAccount();
    try {
      var db = authDb();
      if (db && user.uid) {
        db.collection('mobileBarberCustomers').doc(user.uid).get().then(function (snap) {
          if (!snap || !snap.exists) return;
          var d = snap.data() || {};
          state.account = {
            name: d.name || d.customerName || '',
            phone: d.phone || d.customerPhone || derivedPhone,
          };
          if (state.isCustomer) renderAccount();
        }).catch(function () {});
      }
    } catch (e) {}
  }

  function initAuth() {
    if (typeof root.firebase === 'undefined' || !root.firebase.auth) { renderAccount(); return; }
    setStatus(t('signingIn'));
    try {
      root.firebase.auth().onAuthStateChanged(function (user) {
        if (user) {
          state.signedIn = true; refreshButtons();
          // Generate flows now run under whatever uid is current (anon guest OR
          // the real customer — member quota — automatically).
          applyAccountFromUser(user);
          if (state.pendingGenerate) {
            // A generation was queued while auth was still completing — run it now
            // so the user never has to tap twice (seamless).
            runPendingGenerate();
          } else if (!state.busy) {
            setStatus(state.selfieDataUrl ? t('photoReady') : t('ready'));
          }
        } else {
          state.signedIn = false; refreshButtons();
          applyAccountFromUser(null);
          root.firebase.auth().signInAnonymously().catch(function (err) {
            if (root.console) root.console.error('[style-studio] anon sign-in failed', err);
            setStatus(t('error'), true);
          });
        }
      });
    } catch (e) {
      if (root.console) root.console.error('[style-studio] auth init failed', e);
      renderAccount();
    }
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
    buildAccordion();
    buildShowcase();
    syncLangButtons();
    renderAccount();
    refreshButtons();
    refreshWigUi();
    initAuth();
    logUi({ event: 'init' });
  }

  root.StyleStudioPublic = { init: init, setLang: setLang, _t: t, _state: state, _strings: SS_STRINGS, _openViewer: openViewer, _closeViewer: closeViewer, _onWigGenerate: onWigGenerate, _buildShowcase: buildShowcase, _openAuthPanel: openAuthPanel, _closeAuthPanel: closeAuthPanel, _customerEmailForPhone: customerEmailForPhone, _normalizePhone: normalizePhone, _isCustomerUser: isCustomerUser };

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})(typeof window !== 'undefined' ? window : this);
