'use strict';

// Mobile Barber — REAL AI Haircut Preview
//
// Image-to-image hairstyle preview via the `generateHaircutPreviews`
// Firebase Function, which proxies Google Gemini 2.5 Flash Image (Nano
// Banana) to produce 3 previews that preserve the same person, same face,
// same skin tone — only the hairstyle changes.
//
// EXPLICIT NON-FALLBACK CONTRACT
// ─────────────────────────────────────────────────────────────────────────
// If the Function is unreachable, the GEMINI_API_KEY secret is unset, the
// provider returns no usable image, the network fails, or anything else
// goes wrong: this module does NOT substitute a static catalog. It surfaces
// the failure to the caller via { ok: false, code, message } and the
// caller renders an explicit "AI preview unavailable" notice. The booking
// flow continues normally without the preview.
//
// Privacy
// ─────────────────────────────────────────────────────────────────────────
// - Selfie is compressed client-side (canvas) before upload.
// - Upload is over HTTPS via Firebase callable Functions; no third-party CDN.
// - Selfie + generated images are stored inline on the booking document.
// - Firestore rules gate the booking doc to vendor + customer.
// - Vendor dashboard offers a privacy-respecting delete button.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MobileBarberAIPreview = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {

  // Selfie upload: 800px / quality 0.85 — better identity preservation
  // than tiny thumbnails, still well under inline payload limits.
  var MAX_DIMENSION = 800;
  var JPEG_QUALITY  = 0.85;
  var MAX_UPLOAD_BYTES = 1_400_000; // ~1.4 MB cap on the base64 string we send

  // ── Selfie capture + compression ──────────────────────────────────────
  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !file.type || file.type.indexOf('image/') !== 0) {
        return reject({ code: 'not_image', message: 'Please choose a photo.' });
      }
      var reader = new FileReader();
      reader.onerror = function () { reject({ code: 'read_failed', message: 'Could not read that photo.' }); };
      reader.onload = function (event) {
        var img = new Image();
        img.onerror = function () { reject({ code: 'decode_failed', message: 'Photo format not supported.' }); };
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
          try { dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY); }
          catch (e) { return reject({ code: 'canvas_export_failed', message: 'Could not prepare that photo.' }); }
          if (dataUrl.length > MAX_UPLOAD_BYTES) {
            var cw2 = Math.round(cw * 0.75), ch2 = Math.round(ch * 0.75);
            canvas.width = cw2; canvas.height = ch2;
            ctx.drawImage(img, 0, 0, cw2, ch2);
            try { dataUrl = canvas.toDataURL('image/jpeg', 0.75); } catch (e2) {}
          }
          resolve(dataUrl);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // ── Real provider call (Firebase callable Function) ──────────────────
  // Returns the real generated images. NEVER substitutes static cards.
  function generate(opts) {
    opts = opts || {};
    var dataUrl = opts.dataUrl;
    var lang    = opts.lang || 'en';

    if (!dataUrl) {
      return Promise.resolve({
        ok: false,
        code: 'no_image',
        message: 'No selfie provided. Please upload or take a photo first.'
      });
    }
    if (typeof firebase === 'undefined' || !firebase.app || !firebase.app().options) {
      return Promise.resolve({
        ok: false,
        code: 'firebase_unavailable',
        message: 'AI preview requires Firebase Functions. Please reload the page or continue without the preview.'
      });
    }
    if (!firebase.functions || typeof firebase.functions !== 'function') {
      return Promise.resolve({
        ok: false,
        code: 'functions_unavailable',
        message: 'AI preview requires the Functions SDK. Please reload the page or continue without the preview.'
      });
    }

    var callable;
    try {
      callable = firebase.functions().httpsCallable('generateHaircutPreviews');
    } catch (e) {
      return Promise.resolve({
        ok: false,
        code: 'callable_init_failed',
        message: 'AI preview could not be initialized. Please continue without the preview.'
      });
    }

    return callable({ selfieDataUrl: dataUrl, lang: lang })
      .then(function (result) {
        var payload = (result && result.data) || {};
        if (!payload.ok) {
          return {
            ok: false,
            code: payload.debugCode || 'provider_error',
            message: payload.vendorMessage || 'AI preview is temporarily unavailable.',
            debug: payload.debug || null
          };
        }
        // Normalize: surface only entries with a real image. Caller renders
        // these as-is; no static substitution.
        var recs = (payload.recommendations || []).filter(function (r) {
          return r && r.previewDataUrl && !r.error;
        });
        if (!recs.length) {
          return {
            ok: false,
            code: 'empty_recommendations',
            message: 'AI preview did not return a usable image. Please try a different photo or continue without the preview.'
          };
        }
        return {
          ok: true,
          analysis: payload.analysis || '',
          recommendations: recs,
          provider: payload.provider || 'gemini',
          generationTimeMs: payload.generationTimeMs || 0
        };
      })
      .catch(function (err) {
        // onCall throws on network failure, Function not deployed, CORS, etc.
        var msg = (err && err.message) || 'Network error.';
        if (typeof console !== 'undefined') console.error('[mobile-barber-ai-preview] callable failed', err);
        return {
          ok: false,
          code: 'callable_threw',
          message: 'AI preview is temporarily unavailable (' + msg + '). Please continue your booking.'
        };
      });
  }

  return {
    compressImage: compressImage,
    generate: generate
  };
});
