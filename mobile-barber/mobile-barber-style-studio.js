'use strict';
// Mobile Barber — AI STYLE STUDIO (vendor-only).
// Self-initialising module rendered into #mbStyleStudioRoot on dashboard.html.
// Reuses window.MobileBarberAIPreview (compression/cache) + window.MBLightbox.
// Calls the vendor-authed `generateStyleStudio` callable. NOTHING persists to
// Firestore/Storage: favorites + save history are localStorage/session only.
(function (root) {
  if (!root || !root.document) return;

  // ── i18n: vi / en / es (no hardcoded user-facing strings) ───────────────
  var STUDIO_STRINGS = {
    en: {
      studioTitle: 'AI Style Studio', studioSub: 'Vendor consult — analyse a selfie, explore looks',
      studioConsent: 'I have the customer’s consent to analyse this photo.',
      studioUpload: 'Upload / take selfie', studioGenerate: 'Generate looks', studioGenerating: 'Generating…',
      studioReady: 'Photo ready — pick a studio and generate.', studioConsentRequired: 'Confirm consent first.',
      studioError: 'AI Style Studio is temporarily unavailable.',
      modeHaircut: 'Hair Styles', modeColor: 'Hair Colors', modeTexture: 'Texture', modeEyebrow: 'Eyebrows',
      modeBeard: 'Beards', modeWig: 'Wigs', modeHairsystem: 'Hair Systems', modeEvent: 'Event Styles',
      modeVacation: 'Vacation Styles', favorites: 'Favorites', consult: 'Consultation',
      consultFeatures: 'Features', consultScores: 'Harmony (vendor-only)', consultStrategy: 'Strategy',
      consultEphemeral: 'Vendor-only · not saved · not shown to customer',
      saveToPhone: 'Save to phone', favorite: 'Favorite', unfavorite: 'Saved ✓', compare: 'Compare',
      scoreSymmetry: 'Symmetry', scoreYouthfulness: 'Youthfulness', scoreProfessional: 'Professional',
      scoreConfidence: 'Confidence', scoreSoftness: 'Softness', scoreMaintenance: 'Maintenance',
      emphasize: 'Emphasize', balance: 'Balance', thinning: 'Hair fullness',
    },
    vi: {
      studioTitle: 'Studio Tạo Kiểu AI', studioSub: 'Tư vấn cho thợ — phân tích ảnh, khám phá kiểu',
      studioConsent: 'Tôi đã được khách đồng ý phân tích ảnh này.',
      studioUpload: 'Tải / chụp ảnh', studioGenerate: 'Tạo kiểu', studioGenerating: 'Đang tạo…',
      studioReady: 'Ảnh đã sẵn sàng — chọn studio và tạo kiểu.', studioConsentRequired: 'Hãy xác nhận đồng ý trước.',
      studioError: 'Studio Tạo Kiểu AI tạm thời không khả dụng.',
      modeHaircut: 'Kiểu Tóc', modeColor: 'Màu Tóc', modeTexture: 'Kết Cấu Tóc', modeEyebrow: 'Chân Mày',
      modeBeard: 'Râu', modeWig: 'Tóc Giả', modeHairsystem: 'Hệ Thống Tóc', modeEvent: 'Kiểu Sự Kiện',
      modeVacation: 'Kiểu Du Lịch', favorites: 'Yêu Thích', consult: 'Tư Vấn',
      consultFeatures: 'Đặc Điểm', consultScores: 'Hài Hòa (chỉ thợ xem)', consultStrategy: 'Chiến Lược',
      consultEphemeral: 'Chỉ thợ xem · không lưu · không hiển thị cho khách',
      saveToPhone: 'Lưu về máy', favorite: 'Yêu thích', unfavorite: 'Đã lưu ✓', compare: 'So sánh',
      scoreSymmetry: 'Cân Đối', scoreYouthfulness: 'Trẻ Trung', scoreProfessional: 'Chuyên Nghiệp',
      scoreConfidence: 'Tự Tin', scoreSoftness: 'Mềm Mại', scoreMaintenance: 'Bảo Dưỡng',
      emphasize: 'Nhấn Mạnh', balance: 'Cân Bằng', thinning: 'Độ Dày Tóc',
    },
    es: {
      studioTitle: 'Estudio de Estilo AI', studioSub: 'Consulta del vendedor — analiza una selfie, explora looks',
      studioConsent: 'Tengo el consentimiento del cliente para analizar esta foto.',
      studioUpload: 'Subir / tomar selfie', studioGenerate: 'Generar looks', studioGenerating: 'Generando…',
      studioReady: 'Foto lista — elige un estudio y genera.', studioConsentRequired: 'Confirma el consentimiento primero.',
      studioError: 'El Estudio de Estilo AI no está disponible temporalmente.',
      modeHaircut: 'Cortes', modeColor: 'Colores', modeTexture: 'Textura', modeEyebrow: 'Cejas',
      modeBeard: 'Barbas', modeWig: 'Pelucas', modeHairsystem: 'Sistemas Capilares', modeEvent: 'Estilos de Evento',
      modeVacation: 'Estilos de Vacaciones', favorites: 'Favoritos', consult: 'Consulta',
      consultFeatures: 'Rasgos', consultScores: 'Armonía (solo vendedor)', consultStrategy: 'Estrategia',
      consultEphemeral: 'Solo vendedor · no se guarda · no se muestra al cliente',
      saveToPhone: 'Guardar en el teléfono', favorite: 'Favorito', unfavorite: 'Guardado ✓', compare: 'Comparar',
      scoreSymmetry: 'Simetría', scoreYouthfulness: 'Juventud', scoreProfessional: 'Profesional',
      scoreConfidence: 'Confianza', scoreSoftness: 'Suavidad', scoreMaintenance: 'Mantenimiento',
      emphasize: 'Destacar', balance: 'Equilibrar', thinning: 'Densidad capilar',
    },
  };

  var state = { lang: 'en', consent: false, selfieDataUrl: '', mode: 'haircut', options: {},
                analyzing: false, analysis: null, recommendations: [], sessionId: '',
                favorites: [], compareIds: [] };

  function t(key) {
    return (STUDIO_STRINGS[state.lang] && STUDIO_STRINGS[state.lang][key]) || STUDIO_STRINGS.en[key] || '';
  }
  function detectLang() {
    try {
      var p = new URLSearchParams(root.location.search).get('lang');
      if (STUDIO_STRINGS[p]) return p;
      var saved = root.localStorage.getItem('dlc_lang') || root.localStorage.getItem('dlcLang');
      if (STUDIO_STRINGS[saved]) return saved;
    } catch (e) {}
    return 'en';
  }
  function applyI18n(scope) {
    (scope || root.document).querySelectorAll('[data-studio-i18n]').forEach(function (node) {
      node.textContent = t(node.getAttribute('data-studio-i18n'));
    });
  }

  // Public: re-render on external lang change (additive; dashboard keeps its own).
  function setLang(lang) {
    if (!STUDIO_STRINGS[lang]) return;
    state.lang = lang;
    render();
  }

  function init() {
    var rootEl = root.document.getElementById('mbStyleStudioRoot');
    if (!rootEl) return; // not on this page
    state.lang = detectLang();
    // Re-translate when the dashboard's language buttons are clicked (additive).
    root.document.querySelectorAll('.mb-language__button[data-lang]').forEach(function (btn) {
      btn.addEventListener('click', function () { setLang(btn.getAttribute('data-lang')); });
    });
    render();
  }

  // 9 studios + their option controls. Data-driven so each mode is declared once.
  var STUDIO_DEFS = [
    { mode: 'haircut', label: 'modeHaircut', controls: [] },
    { mode: 'color', label: 'modeColor', controls: [{ key: 'type', values: ['highlight', 'balayage', 'ombre', 'gray_blend', 'fashion'] }] },
    { mode: 'texture', label: 'modeTexture', controls: [{ key: 'texture', values: ['curly', 'straight', 'wavy'] }] },
    { mode: 'eyebrow', label: 'modeEyebrow', controls: [{ key: 'shape', values: ['natural', 'arched', 'straight', 'rounded', 'soft_angled'] }] },
    { mode: 'beard', label: 'modeBeard', controls: [{ key: 'length', values: ['stubble', 'short', 'medium', 'full'] }, { key: 'shape', values: ['rounded', 'angular', 'tapered'] }] },
    { mode: 'wig', label: 'modeWig', controls: [{ key: 'family', values: ['natural', 'business', 'modern', 'long', 'layered', 'curly', 'elegant', 'glamorous', 'cute', 'simple', 'school'] }] },
    { mode: 'hairsystem', label: 'modeHairsystem', controls: [{ key: 'type', values: ['frontal', 'partial', 'full', 'topper', 'crown'] }] },
    { mode: 'event', label: 'modeEvent', controls: [{ key: 'occasion', values: ['wedding', 'cruise', 'disneyland', 'vegas', 'beach', 'birthday', 'graduation', 'holiday'] }] },
    { mode: 'vacation', label: 'modeVacation', controls: [{ key: 'destination', values: ['hawaii', 'europe', 'california_coast', 'theme_parks', 'luxury_resorts'] }] },
  ];

  function elt(tag, cls, text) { var e = root.document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function render() {
    var host = root.document.getElementById('mbStyleStudioRoot');
    if (!host) return;
    host.innerHTML = '';

    // Header + consent + upload + generate
    var head = elt('div', 'mb-studio-head');
    head.appendChild(elt('h2', 'mb-studio-title', t('studioTitle')));
    head.appendChild(elt('p', 'mb-studio-sub', t('studioSub')));
    var consent = elt('label', 'mb-studio-consent');
    var cb = root.document.createElement('input'); cb.type = 'checkbox';
    cb.addEventListener('change', function () { state.consent = cb.checked; refreshControls(); });
    consent.appendChild(cb); consent.appendChild(elt('span', null, t('studioConsent')));
    head.appendChild(consent);

    var upload = root.document.createElement('input');
    upload.type = 'file'; upload.accept = 'image/*'; upload.className = 'mb-studio-upload'; upload.id = 'mbStudioUpload';
    upload.addEventListener('change', onUpload);
    var uploadBtn = elt('label', 'mb-button mb-button--ghost', t('studioUpload')); uploadBtn.setAttribute('for', 'mbStudioUpload');
    head.appendChild(uploadBtn); head.appendChild(upload);
    host.appendChild(head);

    var selfiePreview = elt('div', 'mb-studio-selfie'); selfiePreview.id = 'mbStudioSelfie';
    if (state.selfieDataUrl) { var im = root.document.createElement('img'); im.src = state.selfieDataUrl; im.alt = ''; selfiePreview.appendChild(im); }
    host.appendChild(selfiePreview);

    host.appendChild(renderConsultation()); // Task 9

    // Accordion of 9 studios
    var acc = elt('div', 'mb-studio-accordion');
    STUDIO_DEFS.forEach(function (def) {
      var d = root.document.createElement('details'); d.className = 'mb-studio-panel'; d.setAttribute('data-mode', def.mode);
      var sum = root.document.createElement('summary'); sum.className = 'mb-studio-panel__summary';
      sum.appendChild(elt('span', 'mb-studio-panel__title', t(def.label)));
      d.appendChild(sum);
      var body = elt('div', 'mb-studio-panel__body');
      def.controls.forEach(function (ctrl) {
        var sel = root.document.createElement('select'); sel.className = 'mb-studio-select'; sel.setAttribute('data-ctrl', ctrl.key);
        ctrl.values.forEach(function (v) { var o = root.document.createElement('option'); o.value = v; o.textContent = v.replace(/_/g, ' '); sel.appendChild(o); });
        body.appendChild(sel);
      });
      var gen = elt('button', 'mb-button mb-button--primary mb-studio-generate', t('studioGenerate'));
      gen.type = 'button'; gen.disabled = !(state.consent && state.selfieDataUrl);
      gen.addEventListener('click', function () { onGenerate(def, body); });
      body.appendChild(gen);
      body.appendChild(elt('div', 'mb-studio-results', '')); // results container
      d.appendChild(body); acc.appendChild(d);
    });
    // Favorites panel (session/local; no Firestore)
    var fav = root.document.createElement('details'); fav.className = 'mb-studio-panel mb-studio-panel--favorites';
    var fsum = root.document.createElement('summary'); fsum.className = 'mb-studio-panel__summary';
    fsum.appendChild(elt('span', 'mb-studio-panel__title', t('favorites')));
    fav.appendChild(fsum);
    fav.appendChild(renderFavorites()); // Task 8
    acc.appendChild(fav);
    host.appendChild(acc);

    applyI18n(host);
  }

  function refreshControls() {
    root.document.querySelectorAll('.mb-studio-generate').forEach(function (b) {
      b.disabled = !(state.consent && state.selfieDataUrl);
    });
  }

  function onUpload(ev) {
    var file = ev && ev.target && ev.target.files && ev.target.files[0];
    if (!file) return;
    if (!state.consent) { toast(t('studioConsentRequired')); ev.target.value = ''; return; }
    var AIP = root.MobileBarberAIPreview;
    if (!AIP || typeof AIP.compressImage !== 'function') { toast(t('studioError')); return; }
    AIP.compressImage(file).then(function (dataUrl) {
      state.selfieDataUrl = dataUrl; toast(t('studioReady')); render();
    }).catch(function () { toast(t('studioError')); });
  }

  function onGenerate(def, bodyEl) {
    if (state.analyzing) return;
    state.analyzing = true; state.mode = def.mode;
    var opts = {};
    bodyEl.querySelectorAll('.mb-studio-select').forEach(function (s) { opts[s.getAttribute('data-ctrl')] = s.value; });
    state.options = opts;
    state.sessionId = 'studio_' + def.mode + '_' + Math.random().toString(36).slice(2, 9);
    var resultsEl = bodyEl.querySelector('.mb-studio-results');
    if (resultsEl) resultsEl.textContent = t('studioGenerating');
    callStudio({ dataUrl: state.selfieDataUrl, mode: def.mode, options: opts,
                 audience: state.options.audience || 'neutral' }).then(function (res) {
      state.analyzing = false;
      if (!res.ok) { if (resultsEl) resultsEl.textContent = res.message || t('studioError'); return; }
      state.analysis = res.analysis || null;
      state.recommendations = res.recommendations || [];
      renderResults(resultsEl, res.recommendations); // Task 8
      renderConsultationInto(); // Task 9 refresh
    });
  }

  function toast(msg) {
    var el = root.document.getElementById('mbDashboardToast');
    if (!el) { if (root.console) root.console.log('[style-studio]', msg); return; }
    el.textContent = msg; el.hidden = false;
    root.setTimeout(function () { el.hidden = true; }, 2600);
  }

  // Thin client for the vendor callable. Mirrors mobile-barber-ai-preview.js
  // generate() but targets generateStyleStudio and passes mode/options/goal.
  function callStudio(opts) {
    opts = opts || {};
    if (!opts.dataUrl) return Promise.resolve({ ok: false, code: 'no_image', message: 'No selfie.' });
    if (typeof root.firebase === 'undefined' || !root.firebase.functions) {
      return Promise.resolve({ ok: false, code: 'firebase_unavailable', message: t('studioError') });
    }
    var callable;
    try {
      callable = root.firebase.functions().httpsCallable('generateStyleStudio', { timeout: 180000 });
    } catch (e) {
      return Promise.resolve({ ok: false, code: 'callable_init_failed', message: t('studioError') });
    }
    return callable({
      selfieDataUrl: opts.dataUrl, lang: state.lang, mode: opts.mode,
      options: opts.options || {}, audience: opts.audience || 'neutral',
      preference: opts.preference || '', goal: opts.goal || '',
    }).then(function (result) {
      var p = (result && result.data) || {};
      if (!p.ok) return { ok: false, code: p.debugCode || 'provider_error', message: p.vendorMessage || t('studioError') };
      var recs = (p.recommendations || []).filter(function (r) { return r && r.previewDataUrl && !r.error; });
      if (!recs.length) return { ok: false, code: 'empty', message: t('studioError') };
      return { ok: true, mode: p.mode, analysis: p.analysis || null, recommendations: recs,
               provider: p.provider || 'gemini', generationTimeMs: p.generationTimeMs || 0 };
    }).catch(function (err) {
      if (root.console) root.console.error('[style-studio] callable failed', err);
      return { ok: false, code: 'callable_threw', message: t('studioError') };
    });
  }

  root.MobileBarberStyleStudio = { init: init, setLang: setLang, _t: t, _state: state };

  if (root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})(typeof window !== 'undefined' ? window : this);
