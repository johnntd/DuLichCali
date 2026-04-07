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

  // ── Local ISO Date ────────────────────────────────────────────────────────────
  // toISOString() always returns UTC, which is off by one day for Pacific-time users
  // after ~5 PM (UTC-7). This helper uses local time components instead.
  function localISODate(d) {
    var y   = d.getFullYear();
    var m   = ('0' + (d.getMonth() + 1)).slice(-2);
    var day = ('0' + d.getDate()).slice(-2);
    return y + '-' + m + '-' + day;
  }

  // ── Service Configuration ─────────────────────────────────────────────────────
  // Central registry: one place to change model or token limits per service type.
  // Adding a new AI feature? Add an entry here — do not hardcode model strings elsewhere.
  var SERVICE_CONFIG = {
    travel:      { model: 'claude-haiku-4-5-20251001', maxTokens: 900 }, // chat.js — airport/tour/general
    food:        { model: 'claude-haiku-4-5-20251001', maxTokens: 384 }, // marketplace.js — food order intake
    appointment: { model: 'claude-haiku-4-5-20251001', maxTokens: 384 }, // marketplace.js — hair/salon booking
    nails:       { model: 'claude-sonnet-4-6',         maxTokens: 900 }, // receptionist.js — nail salon (stateful)
    translation: { model: 'claude-haiku-4-5-20251001', maxTokens: 512 }  // marketplace.js — in-app translator
  };
  var _DEFAULT_CFG = { model: 'claude-haiku-4-5-20251001', maxTokens: 600 };

  // ── Unified AI Dispatcher ─────────────────────────────────────────────────────
  // Single entry point for ALL AI calls in the app.
  // Routes through fetchWithRetry using model + maxTokens from SERVICE_CONFIG.
  // System prompt is optional (pass null to omit).
  // Returns the raw API JSON — callers read data.content[0].text as before.
  //
  // All service types map to the same underlying Claude API; behavior differs only
  // through the system prompt, data injected, and context passed by each caller.
  //
  // Callers:
  //   chat.js          → AIEngine.call('travel', ...)
  //   marketplace.js   → AIEngine.call('food' | 'appointment' | 'translation', ...)
  //   receptionist.js  → AIEngine.call('nails', ...)
  function call(serviceType, apiKey, systemPrompt, messages) {
    var cfg  = SERVICE_CONFIG[serviceType] || _DEFAULT_CFG;
    var body = { model: cfg.model, max_tokens: cfg.maxTokens, messages: messages };
    if (systemPrompt) body.system = systemPrompt;
    return fetchWithRetry(apiKey, body);
  }

  // ── Public API ────────────────────────────────────────────────────────────────
  window.AIEngine = {
    detectLang:     detectLang,
    fetchWithRetry: fetchWithRetry,   // kept for backward compatibility; prefer AIEngine.call()
    call:           call,             // unified dispatcher — call(serviceType, apiKey, systemPrompt, messages)
    SERVICE_CONFIG: SERVICE_CONFIG,   // read-only reference to per-service model/token config
    saveHistory:    saveHistory,
    restoreHistory: restoreHistory,
    localISODate:   localISODate
  };

})();
