'use strict';
// ─────────────────────────────────────────────────────────────────────────
// AI Style Studio — PUBLIC client  (style-studio-public.js?v=20260613b)
//
// Powers /style-studio: the one-click AI Master Stylist hero + the 9 manual
// modes. Signs the visitor in with Firebase ANONYMOUS auth, then calls the
// public callable `generateStyleStudioPublic` (anon-auth OK, promo-gated,
// per-uid daily counter). Reuses window.MobileBarberAIPreview (selfie
// compression / local cache) and window.MBLightbox (image zoom).
//
// PRIVACY-FIRST — this module NEVER writes selfies or generated images to
// Firestore/Storage. Save/export/share are native + local only; the only
// server-side state is an integer counter written by the Function (Admin SDK).
//
// MULTILINGUAL — every user-facing string is in vi/en/es via SS_STRINGS; no
// hardcoded text. AI natural-language fields (explanation/why) come back in
// the visitor's language from the callable. Server error English is never
// shown raw — errors are mapped to a localized message by debugCode/code.
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
      goal_professional: 'Professional', goal_youthful: 'Youthful', goal_elegant: 'Elegant',
      goal_executive: 'Executive', goal_natural: 'Natural', goal_confident: 'Confident',
      goal_wedding: 'Wedding', goal_vacation: 'Vacation', goal_party: 'Party',
      goal_business: 'Business', goal_soft: 'Soft', goal_masculine: 'Masculine',
      goal_feminine: 'Feminine', goal_cute: 'Cute', goal_glamorous: 'Glamorous',
      generateBest: 'Generate My Best Look',
      generating: 'Designing your best look…',
      signingIn: 'Starting your free session…',
      ready: 'Ready — upload a selfie to begin.',
      masterTitle: 'Your AI Master Stylist look',
      explanationLabel: 'Why this look suits you',
      attr_haircut: 'Haircut', attr_color: 'Color', attr_texture: 'Texture', attr_bangs: 'Bangs',
      attr_eyebrows: 'Eyebrows', attr_beard: 'Beard', attr_wigOrSystem: 'Wig / Hair system',
      banner: 'Free AI style preview during launch.',
      saveToPhone: 'Save to phone', share: 'Share', favorite: 'Favorite', unfavorite: 'Saved ✓',
      modesTitle: 'Explore more looks',
      modesSub: 'Pick a studio and generate five looks to compare — same engine, more control.',
      audienceLabel: 'Audience',
      aud_neutral: 'Auto', aud_man: 'Man', aud_woman: 'Woman', aud_child: 'Child',
      mode_haircut: 'Hair Styles', mode_color: 'Hair Colors', mode_texture: 'Texture',
      mode_eyebrow: 'Eyebrows', mode_beard: 'Beards', mode_wig: 'Wigs',
      mode_hairsystem: 'Hair Systems', mode_event: 'Event Looks', mode_vacation: 'Vacation Looks',
      modeGenerate: 'Generate looks',
      membershipTitle: 'Keep your momentum going',
      membershipPrompt: 'You have used your free previews. Create a free account to keep generating new looks.',
      membershipCta: 'Create a free account',
      privacyNote: 'Your selfie is used only to generate your style preview. We do not store your photo or the result — you can save the look to your phone yourself.',
      backHome: '← Back to Du Lich Cali',
      error: 'Something went wrong. Please try again.',
      loginWall: 'You have reached your free preview limit. Create a free account to continue.',
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
      goal_professional: 'Chuyên nghiệp', goal_youthful: 'Trẻ trung', goal_elegant: 'Thanh lịch',
      goal_executive: 'Lãnh đạo', goal_natural: 'Tự nhiên', goal_confident: 'Tự tin',
      goal_wedding: 'Đám cưới', goal_vacation: 'Du lịch', goal_party: 'Tiệc tùng',
      goal_business: 'Công sở', goal_soft: 'Dịu dàng', goal_masculine: 'Nam tính',
      goal_feminine: 'Nữ tính', goal_cute: 'Dễ thương', goal_glamorous: 'Quyến rũ',
      generateBest: 'Tạo Diện Mạo Đẹp Nhất',
      generating: 'Đang thiết kế diện mạo đẹp nhất cho bạn…',
      signingIn: 'Đang bắt đầu phiên miễn phí của bạn…',
      ready: 'Sẵn sàng — tải ảnh selfie để bắt đầu.',
      masterTitle: 'Diện mạo từ Chuyên Gia Tạo Kiểu AI',
      explanationLabel: 'Vì sao kiểu này hợp với bạn',
      attr_haircut: 'Kiểu tóc', attr_color: 'Màu tóc', attr_texture: 'Kết cấu tóc', attr_bangs: 'Mái tóc',
      attr_eyebrows: 'Chân mày', attr_beard: 'Râu', attr_wigOrSystem: 'Tóc giả / Hệ thống tóc',
      banner: 'Xem trước kiểu dáng AI miễn phí trong thời gian ra mắt.',
      saveToPhone: 'Lưu về máy', share: 'Chia sẻ', favorite: 'Yêu thích', unfavorite: 'Đã lưu ✓',
      modesTitle: 'Khám phá thêm kiểu dáng',
      modesSub: 'Chọn một studio và tạo năm kiểu để so sánh — cùng công nghệ, nhiều tùy chọn hơn.',
      audienceLabel: 'Đối tượng',
      aud_neutral: 'Tự động', aud_man: 'Nam', aud_woman: 'Nữ', aud_child: 'Trẻ em',
      mode_haircut: 'Kiểu Tóc', mode_color: 'Màu Tóc', mode_texture: 'Kết Cấu Tóc',
      mode_eyebrow: 'Chân Mày', mode_beard: 'Râu', mode_wig: 'Tóc Giả',
      mode_hairsystem: 'Hệ Thống Tóc', mode_event: 'Kiểu Sự Kiện', mode_vacation: 'Kiểu Du Lịch',
      modeGenerate: 'Tạo kiểu',
      membershipTitle: 'Tiếp tục khám phá',
      membershipPrompt: 'Bạn đã dùng hết lượt xem trước miễn phí. Tạo tài khoản miễn phí để tiếp tục tạo kiểu mới.',
      membershipCta: 'Tạo tài khoản miễn phí',
      privacyNote: 'Ảnh selfie của bạn chỉ được dùng để tạo bản xem trước kiểu dáng. Chúng tôi không lưu ảnh hay kết quả — bạn có thể tự lưu kiểu về máy.',
      backHome: '← Quay lại Du Lich Cali',
      error: 'Đã có lỗi xảy ra. Vui lòng thử lại.',
      loginWall: 'Bạn đã đạt giới hạn xem trước miễn phí. Tạo tài khoản miễn phí để tiếp tục.',
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
      goal_professional: 'Profesional', goal_youthful: 'Juvenil', goal_elegant: 'Elegante',
      goal_executive: 'Ejecutivo', goal_natural: 'Natural', goal_confident: 'Seguro',
      goal_wedding: 'Boda', goal_vacation: 'Vacaciones', goal_party: 'Fiesta',
      goal_business: 'Negocios', goal_soft: 'Suave', goal_masculine: 'Masculino',
      goal_feminine: 'Femenino', goal_cute: 'Tierno', goal_glamorous: 'Glamoroso',
      generateBest: 'Generar Mi Mejor Look',
      generating: 'Diseñando tu mejor look…',
      signingIn: 'Iniciando tu sesión gratuita…',
      ready: 'Listo — sube una selfie para empezar.',
      masterTitle: 'Tu look del Estilista Maestro AI',
      explanationLabel: 'Por qué este look te favorece',
      attr_haircut: 'Corte', attr_color: 'Color', attr_texture: 'Textura', attr_bangs: 'Flequillo',
      attr_eyebrows: 'Cejas', attr_beard: 'Barba', attr_wigOrSystem: 'Peluca / Sistema capilar',
      banner: 'Vista previa de estilo AI gratis durante el lanzamiento.',
      saveToPhone: 'Guardar en el teléfono', share: 'Compartir', favorite: 'Favorito', unfavorite: 'Guardado ✓',
      modesTitle: 'Explora más looks',
      modesSub: 'Elige un estudio y genera cinco looks para comparar — el mismo motor, más control.',
      audienceLabel: 'Audiencia',
      aud_neutral: 'Automático', aud_man: 'Hombre', aud_woman: 'Mujer', aud_child: 'Niño',
      mode_haircut: 'Cortes', mode_color: 'Colores', mode_texture: 'Textura',
      mode_eyebrow: 'Cejas', mode_beard: 'Barbas', mode_wig: 'Pelucas',
      mode_hairsystem: 'Sistemas Capilares', mode_event: 'Looks de Evento', mode_vacation: 'Looks de Vacaciones',
      modeGenerate: 'Generar looks',
      membershipTitle: 'Mantén el impulso',
      membershipPrompt: 'Has usado tus vistas previas gratuitas. Crea una cuenta gratis para seguir generando nuevos looks.',
      membershipCta: 'Crear una cuenta gratis',
      privacyNote: 'Tu selfie se usa solo para generar tu vista previa de estilo. No guardamos tu foto ni el resultado — puedes guardar el look en tu teléfono tú mismo.',
      backHome: '← Volver a Du Lich Cali',
      error: 'Algo salió mal. Por favor inténtalo de nuevo.',
      loginWall: 'Has alcanzado tu límite de vistas previas gratuitas. Crea una cuenta gratis para continuar.',
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
    },
  };

  // 15 style goals (mirror functions/style-studio-lib.js STUDIO_GOALS).
  var GOALS = ['professional', 'youthful', 'elegant', 'executive', 'natural', 'confident',
               'wedding', 'vacation', 'party', 'business', 'soft', 'masculine',
               'feminine', 'cute', 'glamorous'];

  // 9 manual studios + their option controls (mirror the vendor studio defs).
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
  };

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
    return 'vi'; // project default
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
    populateGoalSelect();
    populateAudienceSelect();
    buildAccordion();
    syncLangButtons();
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

  // ── Select population ──────────────────────────────────────────────────
  function populateGoalSelect() {
    var sel = doc.getElementById('ssGoal');
    if (!sel) return;
    var prev = state.goal;
    sel.innerHTML = '';
    var auto = doc.createElement('option'); auto.value = ''; auto.textContent = t('goalAuto'); sel.appendChild(auto);
    GOALS.forEach(function (g) {
      var o = doc.createElement('option'); o.value = g; o.textContent = t('goal_' + g);
      if (g === prev) o.selected = true;
      sel.appendChild(o);
    });
    sel.value = prev || '';
    sel.onchange = function () { state.goal = sel.value; };
  }
  function populateAudienceSelect() {
    var sel = doc.getElementById('ssAudience');
    if (!sel) return;
    var prev = state.audience;
    sel.innerHTML = '';
    [['neutral', 'aud_neutral'], ['man', 'aud_man'], ['woman', 'aud_woman'], ['child', 'aud_child']].forEach(function (pair) {
      var o = doc.createElement('option'); o.value = pair[0]; o.textContent = t(pair[1]);
      if (pair[0] === prev) o.selected = true;
      sel.appendChild(o);
    });
    sel.value = prev || 'neutral';
    sel.onchange = function () { state.audience = sel.value; };
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
        var sel = doc.createElement('select'); sel.className = 'ss-select'; sel.setAttribute('data-ctrl', ctrl.key);
        ctrl.values.forEach(function (v) {
          var o = doc.createElement('option'); o.value = v; o.textContent = v.replace(/_/g, ' '); sel.appendChild(o);
        });
        body.appendChild(sel);
      });

      var gen = elt('button', 'ss-cta', t('modeGenerate'));
      gen.type = 'button';
      gen.disabled = !canGenerate();
      gen.setAttribute('data-mode-generate', def.mode);
      var results = elt('div', 'ss-mode-results');
      results.setAttribute('data-results-for', def.mode);
      gen.addEventListener('click', function () { onModeGenerate(def, body, results); });
      body.appendChild(gen);
      body.appendChild(results);

      d.appendChild(body); acc.appendChild(d);
    });
  }

  function canGenerate() { return !!(state.consent && state.selfieDataUrl && state.signedIn && !state.busy); }
  function refreshButtons() {
    var ok = canGenerate();
    var best = doc.getElementById('ssGenerateBest');
    if (best) best.disabled = !ok;
    doc.querySelectorAll('[data-mode-generate]').forEach(function (b) { b.disabled = !ok; });
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
  // Returns a normalized { ok, ...payload } or { ok:false, code, message,
  // requireLogin }. Server English (vendorMessage) is NEVER surfaced; we map
  // code/debugCode → a localized string.
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
      // Login wall (free limit reached).
      if (p.requireLogin || p.code === 'LIMIT_REACHED') {
        return { ok: false, requireLogin: true, message: t('loginWall') };
      }
      // Map the server's debugCode/code to a localized message; fall back generic.
      var code = p.debugCode || p.code || '';
      var localized = t('err_' + code) || t('error');
      return { ok: false, code: code, message: localized };
    }).catch(function (err) {
      if (root.console) root.console.error('[style-studio] callable failed', err);
      return { ok: false, message: t('error') };
    });
  }

  // ── Master Stylist flow ────────────────────────────────────────────────
  function onGenerateBest() {
    if (!canGenerate()) {
      if (!state.consent) setStatus(t('consentRequired'), true);
      return;
    }
    state.busy = true; refreshButtons();
    state.sessionId = 'ss_master_' + Math.random().toString(36).slice(2, 9);
    setStatus(t('generating'));
    var resultEl = doc.getElementById('ssMasterResult');
    if (resultEl) resultEl.innerHTML = '';
    callPublic({
      selfieDataUrl: state.selfieDataUrl, lang: state.lang,
      mode: 'master', goal: state.goal, audience: state.audience,
    }).then(function (res) {
      state.busy = false; refreshButtons();
      if (res.requireLogin) { revealMembership(); setStatus(t('loginWall'), true); return; }
      if (!res.ok || !res.masterpiece) { setStatus(res.message || t('error'), true); return; }
      setStatus('');
      renderMasterpiece(res.masterpiece);
    });
  }

  function renderMasterpiece(mp) {
    var host = doc.getElementById('ssMasterResult');
    if (!host) return;
    host.innerHTML = '';
    var src = mp.previewDataUrl || '';
    var card = elt('article', 'ss-master-card');

    if (src) {
      var img = doc.createElement('img'); img.className = 'ss-master-card__img';
      img.src = src; img.alt = mp.title || t('masterTitle'); img.loading = 'lazy';
      img.addEventListener('click', function () { openLightbox(src, mp.title || t('masterTitle')); });
      card.appendChild(img);
    }

    var body = elt('div', 'ss-master-card__body');
    body.appendChild(elt('strong', 'ss-master-card__title', mp.title || t('masterTitle')));

    if (mp.explanation) {
      var ex = elt('div', 'ss-explain');
      ex.appendChild(elt('span', 'ss-explain__label', t('explanationLabel')));
      var p = elt('p', 'ss-explain__text'); p.id = 'ssExplanation'; p.textContent = mp.explanation;
      ex.appendChild(p);
      body.appendChild(ex);
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

    body.appendChild(buildActions(src, mp.title || 'best-look', 'master'));
    card.appendChild(body);
    host.appendChild(card);

    cacheLocal(state.sessionId, 'master', src);
  }

  // ── Manual mode flow ───────────────────────────────────────────────────
  function onModeGenerate(def, bodyEl, resultsEl) {
    if (!canGenerate()) { if (!state.consent) setStatus(t('consentRequired'), true); return; }
    state.busy = true; refreshButtons();
    state.sessionId = 'ss_' + def.mode + '_' + Math.random().toString(36).slice(2, 9);
    var opts = {};
    bodyEl.querySelectorAll('select[data-ctrl]').forEach(function (s) { opts[s.getAttribute('data-ctrl')] = s.value; });
    resultsEl.innerHTML = '';
    resultsEl.appendChild(elt('p', 'ss-mode-results__status', t('generating')));
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
      renderModeResults(resultsEl, recs);
    });
  }

  function renderModeResults(container, recs) {
    container.innerHTML = '';
    recs.forEach(function (rec) {
      var src = rec.previewDataUrl || '';
      var card = elt('article', 'ss-card');
      if (src) {
        var img = doc.createElement('img'); img.className = 'ss-card__img';
        img.src = src; img.alt = rec.title || ''; img.loading = 'lazy';
        img.addEventListener('click', function () { openLightbox(src, rec.title || ''); });
        card.appendChild(img);
      }
      var body = elt('div', 'ss-card__body');
      if (rec.title) body.appendChild(elt('strong', 'ss-card__title', rec.title));
      if (rec.whyItFitsFace) body.appendChild(elt('p', 'ss-card__why', rec.whyItFitsFace));
      if (rec.maintenance) body.appendChild(elt('p', 'ss-card__meta', rec.maintenance));
      if (rec.barberNotes) body.appendChild(elt('p', 'ss-card__notes', rec.barberNotes));
      ['colorRecommendation', 'highlightRecommendation', 'curlStraightRecommendation'].forEach(function (k) {
        if (rec[k]) body.appendChild(elt('p', 'ss-card__rec', rec[k]));
      });
      body.appendChild(buildCardActions(src, rec));
      card.appendChild(body);
      container.appendChild(card);
      cacheLocal(state.sessionId, rec.styleId || '', src);
    });
  }

  // ── Save / export / share + favorites (native + local only) ────────────
  function buildActions(src, baseName, idLabel) {
    var actions = elt('div', 'ss-actions');
    var save = elt('button', 'ss-action-btn');
    save.type = 'button';
    save.innerHTML = downloadIcon() + '<span>' + t('saveToPhone') + '</span>';
    save.addEventListener('click', function () { saveToPhone(src, baseName); });
    actions.appendChild(save);
    if (root.navigator && typeof root.navigator.share === 'function') {
      var sh = elt('button', 'ss-action-btn');
      sh.type = 'button';
      sh.innerHTML = shareIcon() + '<span>' + t('share') + '</span>';
      sh.addEventListener('click', function () { shareImage(src, baseName); });
      actions.appendChild(sh);
    }
    return actions;
  }
  function buildCardActions(src, rec) {
    var actions = elt('div', 'ss-card__actions');
    var save = elt('button', 'ss-card__btn', t('saveToPhone')); save.type = 'button';
    save.addEventListener('click', function () { saveToPhone(src, rec.styleId || rec.title || 'style'); });
    actions.appendChild(save);
    var fav = elt('button', 'ss-card__btn', isFav(rec.styleId) ? t('unfavorite') : t('favorite')); fav.type = 'button';
    fav.addEventListener('click', function () { toggleFav(rec); fav.textContent = isFav(rec.styleId) ? t('unfavorite') : t('favorite'); });
    actions.appendChild(fav);
    if (root.navigator && typeof root.navigator.share === 'function') {
      var sh = elt('button', 'ss-card__btn', t('share')); sh.type = 'button';
      sh.addEventListener('click', function () { shareImage(src, rec.styleId || rec.title || 'style'); });
      actions.appendChild(sh);
    }
    return actions;
  }
  function downloadIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'; }
  function shareIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>'; }

  function extFromDataUrl(src) { var m = /^data:image\/(\w+)/.exec(src || ''); return m ? (m[1] === 'jpeg' ? 'jpg' : m[1]) : 'jpg'; }
  function saveToPhone(src, baseName) {
    if (!src) return;
    var a = doc.createElement('a');
    a.href = src; a.download = (String(baseName || 'style').replace(/[^a-z0-9_-]+/gi, '-')) + '.' + extFromDataUrl(src);
    doc.body.appendChild(a); a.click(); doc.body.removeChild(a);
  }
  function shareImage(src, baseName) {
    if (!src) return;
    try {
      // Prefer sharing the image file when supported; fall back to a link share.
      if (root.navigator.canShare && typeof fetch === 'function') {
        fetch(src).then(function (r) { return r.blob(); }).then(function (blob) {
          var file = new File([blob], (String(baseName || 'style')) + '.' + extFromDataUrl(src), { type: blob.type || 'image/jpeg' });
          if (root.navigator.canShare({ files: [file] })) {
            return root.navigator.share({ files: [file], title: t('heroChip') });
          }
          return root.navigator.share({ title: t('heroChip'), text: t('heroSub') });
        }).catch(function () {});
      } else {
        root.navigator.share({ title: t('heroChip'), text: t('heroSub') }).catch(function () {});
      }
    } catch (e) {}
  }

  // Favorites: text reference + on-device cached key only. NO Firestore.
  var FAV_KEY = 'ss_public_favorites';
  function readFavs() { try { return JSON.parse(root.localStorage.getItem(FAV_KEY) || '[]'); } catch (e) { return []; } }
  function writeFavs(list) { try { root.localStorage.setItem(FAV_KEY, JSON.stringify(list.slice(0, 60))); } catch (e) {} }
  function isFav(id) { return !!id && readFavs().some(function (f) { return f.styleId === id; }); }
  function toggleFav(rec) {
    if (!rec || !rec.styleId) return;
    var list = readFavs(); var id = rec.styleId;
    if (list.some(function (f) { return f.styleId === id; })) {
      list = list.filter(function (f) { return f.styleId !== id; });
    } else {
      list.push({ styleId: id, title: rec.title || '', sessionId: state.sessionId });
    }
    writeFavs(list);
  }

  // Cache the full-res preview locally (on this device only) via the AIP helper.
  function cacheLocal(sessionId, styleId, src) {
    var AIP = root.MobileBarberAIPreview;
    if (AIP && typeof AIP.saveLocalCopy === 'function' && src) {
      try { AIP.saveLocalCopy(sessionId, styleId || '', src); } catch (e) {}
    }
  }

  function openLightbox(src, caption) {
    if (!src || !root.MBLightbox || !root.MBLightbox.open) return;
    root.MBLightbox.open(src, { caption: caption || '', ariaLabel: caption || t('masterTitle') });
  }

  function revealMembership() {
    var el = doc.getElementById('ssMembershipPrompt');
    if (el) { el.hidden = false; try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {} }
  }

  // ── Anonymous auth ─────────────────────────────────────────────────────
  function initAuth() {
    if (typeof root.firebase === 'undefined' || !root.firebase.auth) { return; }
    setStatus(t('signingIn'));
    try {
      root.firebase.auth().onAuthStateChanged(function (user) {
        if (user) {
          state.signedIn = true;
          refreshButtons();
          setStatus(state.selfieDataUrl ? t('photoReady') : t('ready'));
        } else {
          state.signedIn = false;
          refreshButtons();
          root.firebase.auth().signInAnonymously().catch(function (err) {
            if (root.console) root.console.error('[style-studio] anon sign-in failed', err);
            setStatus(t('error'), true);
          });
        }
      });
    } catch (e) {
      if (root.console) root.console.error('[style-studio] auth init failed', e);
    }
  }

  // ── Wire up ────────────────────────────────────────────────────────────
  function init() {
    state.lang = detectLang();
    doc.documentElement.setAttribute('lang', state.lang);

    // Language buttons
    doc.querySelectorAll('#ssLang .ss-lang__btn').forEach(function (btn) {
      btn.addEventListener('click', function () { setLang(btn.getAttribute('data-lang')); });
    });

    // Consent + upload + master CTA
    var consent = doc.getElementById('ssConsent');
    if (consent) consent.addEventListener('change', function () { state.consent = consent.checked; refreshButtons(); });
    var upload = doc.getElementById('ssSelfieInput');
    if (upload) upload.addEventListener('change', onUpload);
    var best = doc.getElementById('ssGenerateBest');
    if (best) best.addEventListener('click', onGenerateBest);

    applyI18n();
    populateGoalSelect();
    populateAudienceSelect();
    buildAccordion();
    syncLangButtons();
    refreshButtons();
    initAuth();
  }

  // Expose for testing / external lang sync (additive).
  root.StyleStudioPublic = { init: init, setLang: setLang, _t: t, _state: state, _strings: SS_STRINGS };

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})(typeof window !== 'undefined' ? window : this);
