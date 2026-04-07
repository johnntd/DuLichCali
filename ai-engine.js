// ── DLC Shared AI Engine v1.0 ─────────────────────────────────────────────────
// Single source of truth for all AI behavior in DuLichCali.
//
// Used by:
//   nailsalon/receptionist.js  — salon AI receptionist (adapts salon-specific prompt)
//   marketplace/marketplace.js  — food / hair vendor chat
//   (future) ride, tour, voice receptionist
//
// Contract:
//   AIEngine.detectLang(text)               → 'en' | 'vi' | 'es'
//   AIEngine.fetchWithRetry(apiKey, body)   → Promise<API response JSON>
//   AIEngine.saveHistory(storageKey, arr)   → void  (sessionStorage)
//   AIEngine.restoreHistory(storageKey)     → Array | null
//
// Adapters (receptionist.js, marketplace.js) own:
//   - system prompt building
//   - booking / order state machine
//   - fallback responses
//   - result parsing
//
// This engine owns:
//   - language detection (one implementation for the whole app)
//   - HTTP transport + retry (one fetch loop for the whole app)
//   - conversation history persistence helpers
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  var _API_URL      = 'https://api.anthropic.com/v1/messages';
  var _RETRY_DELAYS = [800, 1500, 2500]; // ms between retry attempts (3 total retries)

  // ── Language Detection ────────────────────────────────────────────────────────
  // Fast client-side hint — used by both salon and marketplace adapters.
  // Claude always confirms/overrides via STATE marker in its response.
  //
  // Previously duplicated in:
  //   receptionist.js _detectLang()   — tonal-diacritics + word list
  //   marketplace.js  _detectLang()   — Unicode range + word list
  // Now one implementation used by both.
  function detectLang(text) {
    if (!text) return 'en';
    // Vietnamese: precomposed tone marks (U+1EA0–U+1EF9) or ơ ư đ/Đ, or common words
    if (/[\u1EA0-\u1EF9]|[ơưđĐ]/i.test(text) ||
        /\b(mình|tôi|bạn|muốn|đặt lịch|làm móng|tiệm|dịch vụ|hôm nay|ngày mai|bao nhiêu|cảm ơn|xin chào|được không|cho tôi|cho mình|nhé|nha|vậy|ơi|thứ|tuần|lịch hẹn)\b/i.test(text)) {
      return 'vi';
    }
    // Spanish: inverted punctuation / ñ, or high-frequency Spanish words
    if (/[¿¡ñÑ]/.test(text) ||
        /\b(hola|cuánto|cuanto|cómo|como|qué|que tal|cuando|tiene|tengo|quisiera|quiero|gracias|buenos|precio|cita|disponible|puedo|podría|servicios|uñas|reservar|trabaja|trabajar|abierto|cerrado|mañana)\b/i.test(text)) {
      return 'es';
    }
    return 'en';
  }

  // ── HTTP Transport with Retry ─────────────────────────────────────────────────
  // Unified fetch + retry for ALL Claude API calls in the app.
  //
  // Previously duplicated in:
  //   receptionist.js _doFetch() + _fetchWithRetry() — 3-attempt retry
  //   marketplace.js  inline fetch()                  — no retry
  // Now one implementation used by both, giving marketplace.js retry for free.
  //
  // Rules:
  //   - Network errors (ERR_NETWORK_CHANGED etc.) → retry up to 3× with backoff
  //   - API errors (4xx/5xx) → throw immediately, never retry
  //   - Returns parsed JSON on success
  function _doFetch(apiKey, body) {
    return fetch(_API_URL, {
      method:  'POST',
      headers: {
        'Content-Type':                             'application/json',
        'x-api-key':                                apiKey,
        'anthropic-version':                        '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          var e = new Error('API ' + res.status + ': ' + t.slice(0, 120));
          e.isApiError = true;
          throw e;
        });
      }
      return res.json();
    });
  }

  function fetchWithRetry(apiKey, body, attempt) {
    attempt = attempt || 0;
    return _doFetch(apiKey, body).catch(function (err) {
      if (err.isApiError)                 throw err; // structured API error — don't retry
      if (attempt >= _RETRY_DELAYS.length) throw err; // exhausted retries
      return new Promise(function (resolve) { setTimeout(resolve, _RETRY_DELAYS[attempt]); })
        .then(function () { return fetchWithRetry(apiKey, body, attempt + 1); });
    });
  }

  // ── Conversation History Persistence ─────────────────────────────────────────
  // Shared sessionStorage helpers for all adapters.
  // Adapters pass their own storage key (e.g. 'lily_h_nails', 'mp_h_hair-oc').
  function saveHistory(storageKey, history) {
    try { sessionStorage.setItem(storageKey, JSON.stringify(history)); } catch (e) {}
  }

  function restoreHistory(storageKey) {
    try {
      var raw = sessionStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  // ── Public API ────────────────────────────────────────────────────────────────
  window.AIEngine = {
    detectLang:     detectLang,
    fetchWithRetry: fetchWithRetry,
    saveHistory:    saveHistory,
    restoreHistory: restoreHistory
  };

})();
