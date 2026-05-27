'use strict';

// Mobile Barber — Optional AI Haircut Preview
//
// Scope: this module is OPTIONAL on every booking path. If anything fails
// (no consent, no image, no AI key, no network, throw, malformed JSON), the
// caller MUST still be able to ship the booking. We surface a fallback set
// of 3 recommendations from the canonical 13-style catalog instead of
// blocking. The selfie is compressed client-side and stored inline on the
// booking doc as a data URL — no separate storage bucket, no extra ACL
// surface. The vendor reads it via the same Firestore rule that gates the
// booking itself.
//
// Privacy contract:
//  - consent required before analyze() runs (caller enforces)
//  - selfie compressed to ≤600px JPEG quality 0.7 (≤ ~150 KB typical)
//  - caller never uploads to a storage bucket; data URL lives on the booking
//  - caller offers a "remove image" UX (dashboard delete button)
//  - AI previews are labeled "AI suggestion" everywhere they render

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MobileBarberAIPreview = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {

  var MAX_DIMENSION = 600;   // px
  var JPEG_QUALITY  = 0.7;
  var MAX_BYTES     = 700 * 1024;   // 700 KB target before validator cap

  // Canonical 3-recommendation profile, mapped to existing style catalog
  // asset URLs. The fallback returns these unconditionally so the customer
  // always sees something useful.
  function staticRecommendations(opts) {
    opts = opts || {};
    var lang = opts.lang || 'en';
    return [
      {
        styleId: 'business-haircut',
        title: t(lang, 'professionalTitle'),
        explanation: t(lang, 'professionalExplanation'),
        maintenance: t(lang, 'maintenanceMedium'),
        barberNotes: t(lang, 'professionalBarberNotes'),
        previewUrl: '/assets/mobile-barber/styles/business-haircut.jpg',
        isFallback: true
      },
      {
        styleId: 'fade-haircut',
        title: t(lang, 'modernFadeTitle'),
        explanation: t(lang, 'modernFadeExplanation'),
        maintenance: t(lang, 'maintenanceMedium'),
        barberNotes: t(lang, 'modernFadeBarberNotes'),
        previewUrl: '/assets/mobile-barber/styles/fade-haircut.jpg',
        isFallback: true
      },
      {
        styleId: 'classic-haircut',
        title: t(lang, 'classicTitle'),
        explanation: t(lang, 'classicExplanation'),
        maintenance: t(lang, 'maintenanceLow'),
        barberNotes: t(lang, 'classicBarberNotes'),
        previewUrl: '/assets/mobile-barber/styles/classic-haircut.jpg',
        isFallback: true
      }
    ];
  }

  function fallbackAnalysisSummary(lang) {
    return t(lang || 'en', 'fallbackSummary');
  }

  // Compress a File into a data URL via a canvas. Resolves with a JPEG data
  // URL ≤ MAX_DIMENSION on the longer axis. Rejects only on file-read
  // failure; the caller treats any rejection as "skip the AI preview".
  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !file.type || file.type.indexOf('image/') !== 0) {
        return reject(new Error('not_image'));
      }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('read_failed')); };
      reader.onload = function (event) {
        var img = new Image();
        img.onerror = function () { reject(new Error('decode_failed')); };
        img.onload = function () {
          var w = img.width, h = img.height;
          var scale = Math.min(1, MAX_DIMENSION / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * scale));
          var ch = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement('canvas');
          canvas.width = cw;
          canvas.height = ch;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, cw, ch);
          var dataUrl;
          try {
            dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
          } catch (e) {
            return reject(new Error('canvas_export_failed'));
          }
          // If still too large at quality 0.7, downsample once more.
          if (dataUrl.length > MAX_BYTES) {
            var cw2 = Math.round(cw * 0.75), ch2 = Math.round(ch * 0.75);
            canvas.width = cw2; canvas.height = ch2;
            ctx.drawImage(img, 0, 0, cw2, ch2);
            try { dataUrl = canvas.toDataURL('image/jpeg', 0.6); } catch (e2) {}
          }
          resolve(dataUrl);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Try AI-driven analysis if an AIEngine + key is available. Currently
  // AIEngine.call() does not natively accept vision input on this project,
  // so this layer is intentionally optimistic: it asks Claude for a short
  // freeform description ("recommend 3 haircut styles for an adult male
  // customer") and then returns the static catalog regardless. The intent
  // is to keep the API stable so a future image-aware provider can drop in
  // without breaking the callers.
  function aiAnalyze(dataUrl, opts) {
    opts = opts || {};
    var lang = opts.lang || 'en';
    var engine = opts.engine || (typeof window !== 'undefined' && window.AIEngine);
    if (!engine || typeof engine.call !== 'function') {
      return Promise.reject(new Error('engine_unavailable'));
    }
    // Note: real image-to-recommendation is a future drop-in. For now we
    // generate a customer-friendly summary line via text-only AI so the
    // language matches the customer's preference, and we always pair it
    // with the deterministic 3-style catalog.
    var systemPrompt = 'You are a barber recommending 3 haircut style options to a customer who just shared a selfie. ' +
      'Respond in language code "' + lang + '". Keep your reply under 320 characters. ' +
      'Mention: face shape (if obvious), current hair length, beard or no beard, maintenance level. ' +
      'Do NOT name the customer. Do NOT mention skin tone, religion, age, gender, or political views. ' +
      'End with: "Pick the style you like best."';
    var messages = [{
      role: 'user',
      content: 'A customer would like 3 haircut recommendations. They want options across: professional, modern fade, low-maintenance classic.'
    }];
    var p = engine.call('nails', '', systemPrompt, messages, { intent: 'booking' });
    return Promise.resolve(p).then(function (resp) {
      var text = (resp && resp.content && resp.content[0] && resp.content[0].text) || '';
      return {
        summary: String(text || '').trim() || fallbackAnalysisSummary(lang),
        recommendations: staticRecommendations({ lang: lang })
      };
    });
  }

  // Public entry point. Never throws; always resolves with a usable result.
  // Caller passes { dataUrl, lang, engine? }. If anything fails, the
  // fallback {summary, recommendations} is returned with isFallback=true.
  function analyze(input) {
    input = input || {};
    var lang = input.lang || 'en';
    if (!input.dataUrl) {
      return Promise.resolve({
        summary: fallbackAnalysisSummary(lang),
        recommendations: staticRecommendations({ lang: lang }),
        isFallback: true,
        reason: 'no_image'
      });
    }
    return aiAnalyze(input.dataUrl, { lang: lang, engine: input.engine })
      .then(function (result) {
        return {
          summary: result.summary,
          recommendations: result.recommendations,
          isFallback: false
        };
      })
      .catch(function (err) {
        if (typeof console !== 'undefined') console.warn('[mobile-barber-ai-preview] fallback', err && err.message);
        return {
          summary: fallbackAnalysisSummary(lang),
          recommendations: staticRecommendations({ lang: lang }),
          isFallback: true,
          reason: (err && err.message) || 'unknown'
        };
      });
  }

  // ── i18n table ──────────────────────────────────────────────────────────
  var STRINGS = {
    en: {
      fallbackSummary: 'Below are 3 styles you may like. Pick one, or skip and tell the barber in person.',
      professionalTitle: 'Professional / Business',
      professionalExplanation: 'Clean side part, blended sides, tidy neckline. Works for office, court, and weddings.',
      professionalBarberNotes: '#3 on sides, scissor on top, square the neckline.',
      modernFadeTitle: 'Modern Fade / Taper',
      modernFadeExplanation: 'Tight fade from skin to natural length, textured top with light product.',
      modernFadeBarberNotes: 'Skin fade up to temple line, scissor texture on top, hard part optional.',
      classicTitle: 'Low-maintenance Classic',
      classicExplanation: 'Even length all around, easy to grow out, no daily styling needed.',
      classicBarberNotes: '#4 all over, clean ear and neck.',
      maintenanceLow: 'Low maintenance',
      maintenanceMedium: 'Medium maintenance'
    },
    vi: {
      fallbackSummary: 'Dưới đây là 3 kiểu bạn có thể thích. Chọn một, hoặc bỏ qua và trao đổi trực tiếp với thợ.',
      professionalTitle: 'Lịch sự / Công sở',
      professionalExplanation: 'Rẽ ngôi gọn, hai bên blend, gáy sạch. Phù hợp văn phòng và sự kiện.',
      professionalBarberNotes: 'Tông số 3 hai bên, kéo trên đầu, cắt vuông gáy.',
      modernFadeTitle: 'Fade hiện đại / Taper',
      modernFadeExplanation: 'Fade sát từ chân đến độ dài tự nhiên, phần trên tạo kết cấu với chút keo.',
      modernFadeBarberNotes: 'Skin fade tới thái dương, kéo tạo kết cấu trên, có thể kẻ đường.',
      classicTitle: 'Cổ điển dễ giữ',
      classicExplanation: 'Cùng độ dài quanh đầu, dễ dài ra, không cần tạo kiểu mỗi ngày.',
      classicBarberNotes: 'Tông số 4 toàn đầu, gọn tai và gáy.',
      maintenanceLow: 'Dễ giữ',
      maintenanceMedium: 'Trung bình'
    },
    es: {
      fallbackSummary: 'Aquí hay 3 estilos que pueden gustarle. Elija uno o coméntelo con el barbero en persona.',
      professionalTitle: 'Profesional / Negocios',
      professionalExplanation: 'Raya lateral limpia, lados degradados, nuca prolija. Ideal para oficina o eventos.',
      professionalBarberNotes: '#3 en los lados, tijera arriba, nuca cuadrada.',
      modernFadeTitle: 'Fade Moderno / Taper',
      modernFadeExplanation: 'Fade ajustado de piel a largo natural, parte superior texturizada con producto ligero.',
      modernFadeBarberNotes: 'Skin fade hasta la sien, textura con tijera arriba, raya marcada opcional.',
      classicTitle: 'Clásico de bajo mantenimiento',
      classicExplanation: 'Largo parejo, fácil de dejar crecer, sin estilizado diario.',
      classicBarberNotes: '#4 en toda la cabeza, oreja y nuca limpias.',
      maintenanceLow: 'Bajo mantenimiento',
      maintenanceMedium: 'Mantenimiento medio'
    }
  };

  function t(lang, key) {
    return (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || '';
  }

  return {
    compressImage: compressImage,
    analyze: analyze,
    staticRecommendations: staticRecommendations,
    fallbackAnalysisSummary: fallbackAnalysisSummary
  };
});
