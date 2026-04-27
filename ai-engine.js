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

  // ── Provider Adapters — Phase 5 Hybrid Router ────────────────────────────────
  // Normalise every provider response to Claude format: { content: [{ text }] }
  // so all downstream code (receptionist.js data.content[0].text) is unchanged.
  //
  // Intents classified as HIGH_RISK (booking-changing actions) prefer OpenAI when
  // a key is available.  INFORMATIONAL intents prefer Gemini.  Both fall back to
  // Claude if the preferred provider key is absent or the request fails.

  // HIGH_RISK_INTENTS kept for reference; OpenAI removed from browser routing
  // because OpenAI blocks direct browser CORS requests. Booking intents use Claude.
  var _HIGH_RISK_INTENTS = { booking_request: 1, modify_booking: 1, booking_offer: 1 };

  // ── Claude adapter (existing) — returns native Claude JSON unchanged ──────────
  function _callClaude(apiKey, model, maxTokens, systemPrompt, messages) {
    var body = { model: model, max_tokens: maxTokens, messages: messages };
    if (systemPrompt) body.system = systemPrompt;
    return fetchWithRetry(apiKey, body);
  }

  // ── OpenAI adapter — normalises to { content: [{ text }] } ──────────────────
  // Uses gpt-4o-mini by default (fast, inexpensive, handles structured output).
  // System prompt → prepended as role:'system' message (standard OpenAI convention).
  var _OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

  function _callOpenAI(apiKey, model, maxTokens, systemPrompt, messages) {
    var oaiMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }].concat(messages)
      : messages.slice();
    return fetch(_OPENAI_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body:    JSON.stringify({ model: model, max_tokens: maxTokens, messages: oaiMessages })
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          var e = new Error('OpenAI ' + res.status + ': ' + t.slice(0, 120));
          e.isApiError = true; throw e;
        });
      }
      return res.json();
    }).then(function (data) {
      var text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!text) throw new Error('OpenAI: empty response');
      return { content: [{ text: text }] }; // normalised to Claude format
    });
  }

  // ── Gemini adapter — normalises to { content: [{ text }] } ──────────────────
  // Converts Claude-style messages [{role,content}] to Gemini contents format.
  // 'assistant' maps to Gemini role 'model'.
  // System prompt → system_instruction.parts[0].text (Gemini 1.5+).
  var _GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

  function _callGemini(apiKey, model, maxTokens, systemPrompt, messages) {
    var contents = messages.map(function (m) {
      return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] };
    });
    var body = {
      contents: contents,
      generationConfig: { maxOutputTokens: maxTokens }
    };
    if (systemPrompt) body.system_instruction = { parts: [{ text: systemPrompt }] };
    return fetch(_GEMINI_BASE + model + ':generateContent?key=' + apiKey, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          var e = new Error('Gemini ' + res.status + ': ' + t.slice(0, 120));
          e.isApiError = true; throw e;
        });
      }
      return res.json();
    }).then(function (data) {
      var text = data.candidates && data.candidates[0] &&
                 data.candidates[0].content && data.candidates[0].content.parts &&
                 data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
      if (!text) throw new Error('Gemini: empty response');
      return { content: [{ text: text }] }; // normalised to Claude format
    });
  }

  // ── Intent-based provider router ────────────────────────────────────────────
  // opts.intent: the current booking intent from biz._bookingState.intent
  // opts.altKeys: { openai: '...', gemini: '...' } — optional provider API keys
  // Keys are also read from localStorage (dlc_openai_key, dlc_gemini_key) as fallback.
  // Safe fallback: if preferred provider fails, retries with Claude.
  function _resolveProvider(intent, altKeys) {
    // All browser-side AI calls use Claude exclusively:
    //   - OpenAI: blocked by CORS (no Access-Control-Allow-Origin)
    //   - Gemini: v1beta model IDs change frequently causing 404s
    //   - Claude: reliable, no CORS issues (Anthropic allows cross-origin)
    return { provider: 'claude', keys: altKeys || {} };
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
  // Phase 5: added openaiModel and geminiModel per-service overrides (optional).
  // If a provider key is not available, _resolveProvider falls back to Claude.
  var SERVICE_CONFIG = {
    travel:      { model: 'claude-haiku-4-5-20251001', maxTokens: 900, openaiModel: 'gpt-4o-mini', geminiModel: 'gemini-2.0-flash' }, // chat.js
    food:        { model: 'claude-haiku-4-5-20251001', maxTokens: 384, openaiModel: 'gpt-4o-mini', geminiModel: 'gemini-2.0-flash' }, // marketplace.js
    appointment: { model: 'claude-haiku-4-5-20251001', maxTokens: 384, openaiModel: 'gpt-4o-mini', geminiModel: 'gemini-2.0-flash' }, // marketplace.js
    nails:       { model: 'claude-sonnet-4-6',         maxTokens: 900, openaiModel: 'gpt-4o-mini', geminiModel: 'gemini-2.0-flash' }, // receptionist.js
    translation: { model: 'claude-haiku-4-5-20251001', maxTokens: 512, openaiModel: 'gpt-4o-mini', geminiModel: 'gemini-2.0-flash' }  // marketplace.js
  };
  var _DEFAULT_CFG = { model: 'claude-haiku-4-5-20251001', maxTokens: 600, openaiModel: 'gpt-4o-mini', geminiModel: 'gemini-2.0-flash' };

  // ── Unified AI Dispatcher — Phase 5: Hybrid Router ───────────────────────────
  // Single entry point for ALL AI calls in the app.
  // Routes by intent: booking-critical → OpenAI (if key supplied), informational → Gemini,
  // default → Claude. All adapters normalise to { content: [{ text }] }.
  //
  // opts (optional 5th param): { intent: string, altKeys: { openai, gemini } }
  //   intent:  booking state intent — used for routing decisions
  //   altKeys: provider API keys — supplemented from localStorage if absent
  //
  // Backward compat: callers that omit opts get Claude (no routing change).
  //
  // Callers:
  //   chat.js          → AIEngine.call('travel', ...)
  //   marketplace.js   → AIEngine.call('food' | 'appointment' | 'translation', ...)
  //   receptionist.js  → AIEngine.call('nails', ..., { intent })
  function call(serviceType, apiKey, systemPrompt, messages, opts) {
    var cfg    = SERVICE_CONFIG[serviceType] || _DEFAULT_CFG;
    opts       = opts || {};
    var route  = _resolveProvider(opts.intent || null, opts.altKeys || null);
    var provider = route.provider;
    var keys     = route.keys;

    if (provider === 'openai' && keys.openai) {
      return _callOpenAI(keys.openai, cfg.openaiModel || 'gpt-4o-mini', cfg.maxTokens, systemPrompt, messages)
        .catch(function (e) {
          console.warn('[AIEngine] OpenAI failed (' + e.message + '), falling back to Claude');
          return _callClaude(apiKey, cfg.model, cfg.maxTokens, systemPrompt, messages);
        });
    }
    if (provider === 'gemini' && keys.gemini) {
      return _callGemini(keys.gemini, cfg.geminiModel || 'gemini-2.0-flash', cfg.maxTokens, systemPrompt, messages)
        .catch(function (e) {
          console.warn('[AIEngine] Gemini failed (' + e.message + '), falling back to Claude');
          return _callClaude(apiKey, cfg.model, cfg.maxTokens, systemPrompt, messages);
        });
    }
    // Default: Claude (no opts, no provider key, or forced fallback)
    return _callClaude(apiKey, cfg.model, cfg.maxTokens, systemPrompt, messages);
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
