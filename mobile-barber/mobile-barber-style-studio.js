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

  function render() { /* implemented in Task 7–9 */ applyI18n(); }

  root.MobileBarberStyleStudio = { init: init, setLang: setLang, _t: t, _state: state };

  if (root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})(typeof window !== 'undefined' ? window : this);
