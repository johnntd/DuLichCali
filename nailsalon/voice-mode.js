/**
 * DLC Voice Mode — Phase 1 (Push-to-Talk)
 * =========================================
 * Fullscreen voice overlay for the AI Receptionist.
 * Architecture: ONE receptionist brain, TWO interfaces.
 *   - Voice input  → same Receptionist._sendMessage() as typed chat
 *   - Voice output → speechSynthesis reads the cleanReply text
 *
 * Required: marketplace.js must be loaded first (Receptionist global).
 * Loaded by: nailsalon/index.html only (Phase 1).
 *
 * iOS Safari notes:
 *   - webkitSpeechRecognition available since iOS 14.5
 *   - speechSynthesis.speak() requires user-gesture priming on iOS
 *   - speechSynthesis silently stops after ~14 s on some iOS versions;
 *     guarded with a pause/resume keepalive timer.
 *
 * TTS strategy (language-specific):
 *   English    → browser TTS, exact en-US voice (avoids en-GB on iOS/macOS)
 *   Spanish    → browser TTS, es-US or closest es-* voice
 *   Vietnamese → Gemini TTS (dlc_gemini_key in localStorage) with browser fallback
 *                AudioContext created within open() user-gesture for iOS unlock.
 */
(function () {
  'use strict';

  // ── Feature detection ─────────────────────────────────────────────────────
  var SR   = window.SpeechRecognition || window.webkitSpeechRecognition;
  var hasSR  = !!SR;
  var hasTTS = !!window.speechSynthesis;

  // BCP-47 tags for Web Speech API
  var LANG_TAG = { en: 'en-US', vi: 'vi-VN', es: 'es-US' };

  // Cache browser voice list once — getVoices() returns [] on first call in many browsers
  // (voices load asynchronously). Using a stale empty list means no voice is pinned and
  // the browser picks a random default, causing the voice to change between sessions.
  (function () {
    if (!window.speechSynthesis) return;
    function _loadVoices() {
      try { var v = window.speechSynthesis.getVoices(); if (v && v.length) _voices = v; } catch (_) {}
    }
    _loadVoices();
    try { window.speechSynthesis.addEventListener('voiceschanged', _loadVoices); } catch (_) {}
  })();

  // ── Module state ──────────────────────────────────────────────────────────
  var _biz           = null;
  var _msgsEl        = null;    // .mp-ai__messages container
  var _overlay       = null;
  var _rec           = null;    // SpeechRecognition instance
  var _state         = 'idle';  // idle | listening | processing | speaking | error
  var _lang          = 'en';
  var _iosPrimed     = false;   // TTS primed on iOS via silent utterance
  var _keepalive     = null;    // iOS TTS keepalive timer
  var _ttsStartGuard = null;    // Safety timeout if browser TTS never fires onstart
  var _audioCtx      = null;    // Web Audio API context (OpenAI/Gemini PCM playback)
  var _currentSource = null;    // AudioBufferSourceNode currently playing
  var _welcomeBuffer = null;    // Pre-fetched MP3 ArrayBuffer for welcome message
  var _voices        = [];      // Cached voice list — populated once on voiceschanged
  var _pendingSpoken = null;    // Pre-built spoken text for confirmation flows (set by receptionist)
  var _interruptNext = false;  // User tapped mic during processing — skip TTS, go straight to listening
  var _autoLangTimer = null;    // Timer for auto-detected language hint fadeout

  // ── State labels ──────────────────────────────────────────────────────────
  var LABEL = {
    en: {
      idle:       'Ready \u2014 speak anytime',
      listening:  'Listening\u2026',
      processing: 'Processing\u2026',
      speaking:   'Speaking\u2026',
      error:      'Tap to try again'
    },
    vi: {
      idle:       'S\u1eb5n s\xe0ng \u2014 h\xe3y n\xf3i',
      listening:  '\u0110ang nghe\u2026',
      processing: '\u0110ang x\u1eed l\u00fd\u2026',
      speaking:   '\u0110ang n\u00f3i\u2026',
      error:      'Th\u1eed l\u1ea1i'
    },
    es: {
      idle:       'Listo \u2014 habla cuando quieras',
      listening:  'Escuchando\u2026',
      processing: 'Procesando\u2026',
      speaking:   'Hablando\u2026',
      error:      'Toca para reintentar'
    }
  };

  function _lbl(key) {
    return (LABEL[_lang] || LABEL.en)[key] || '';
  }

  // ── TTS text helpers ──────────────────────────────────────────────────────

  // Convert 24-hour time strings to natural spoken form.
  // "15:30" → "3:30 PM", "09:00" → "9:00 AM", "00:15" → "12:15 AM".
  // Skips strings already followed by AM/PM so formatted display text is left untouched.
  function _humanizeTimeStr(text) {
    return text.replace(
      /\b(0?\d|1\d|2[0-3]):([0-5]\d)\b(?!\s*[AaPp][Mm])/g,
      function (_, hStr, mStr) {
        var hr = parseInt(hStr, 10);
        var mn = parseInt(mStr, 10);
        var ap = hr < 12 ? 'AM' : 'PM';
        hr = hr % 12 || 12;
        return hr + ':' + (mn < 10 ? '0' : '') + mn + ' ' + ap;
      }
    );
  }

  // Strip AI state markers and markdown from text before speaking,
  // then convert any remaining 24h time strings to natural speech form.
  function _cleanForTts(text) {
    var clean = text
      .replace(/\[STATE:[^\]]*\]/g,    '')
      .replace(/\[BOOKING:[^\]]*\]/g,  '')
      .replace(/\[ESCALATE:[^\]]*\]/g, '')
      .replace(/#{1,6}\s?/g, '')
      .replace(/\*{1,3}([^*]*)\*{1,3}/g, '$1')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return _humanizeTimeStr(clean);
  }

  // Trim long replies to a natural sentence boundary.
  // OpenAI TTS handles full replies quickly, so MAX is set generously.
  // Gemini TTS is slower — the trim mainly helps that fallback path.
  // The full reply is always visible in the chat bubble regardless.
  function _truncateForTts(text) {
    var MAX = 600;
    if (text.length <= MAX) return text;
    var dot = text.lastIndexOf('. ', MAX);
    return text.substring(0, dot > MAX * 0.4 ? dot + 1 : MAX).trim();
  }

  // ── Build DOM ─────────────────────────────────────────────────────────────
  function _buildOverlay() {
    var el = document.createElement('div');
    el.id        = 'dlcVoiceOverlay';
    el.className = 'dlc-vm';
    el.setAttribute('role',       'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Voice mode');

    // Waveform bars — AI voice assistant aesthetic (ChatGPT-style).
    // Five spans animate via CSS: static in idle, oscillate while listening/speaking.
    var waveHTML =
      '<div class="dlc-vm__wave" aria-hidden="true">' +
        '<span></span><span></span><span></span><span></span><span></span>' +
      '</div>';

    var closeSVG =
      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ' +
      'stroke-width="2.5" stroke-linecap="round" aria-hidden="true">' +
        '<line x1="18" y1="6" x2="6" y2="18"/>' +
        '<line x1="6" y1="6" x2="18" y2="18"/>' +
      '</svg>';

    // Close button, screen label, and language pills live on the overlay directly
    // (not inside the max-width inner card) so they always anchor to screen edges.
    el.innerHTML =
      '<div class="dlc-vm__screen-label" aria-hidden="true">Voice Assistant</div>' +
      '<button class="dlc-vm__close" type="button" aria-label="Close voice mode">' +
        closeSVG +
      '</button>' +
      '<div class="dlc-vm__inner">' +
        '<div class="dlc-vm__name" aria-live="polite"></div>' +
        '<div class="dlc-vm__state-label" aria-live="polite" aria-atomic="true"></div>' +
        '<div class="dlc-vm__auto-lang" aria-live="polite" aria-atomic="true"></div>' +
        '<div class="dlc-vm__transcript" aria-live="polite"></div>' +
        '<button class="dlc-vm__mic" type="button" aria-label="Speak">' +
          waveHTML +
        '</button>' +
        '<div class="dlc-vm__response" aria-live="polite"></div>' +
        '<div class="dlc-vm__actions">' +
          '<button class="dlc-vm__text-btn" type="button">Switch to text</button>' +
        '</div>' +
      '</div>' +
      '<div class="dlc-vm__langs">' +
        '<button class="dlc-vm__lang" type="button" data-l="en">EN</button>' +
        '<button class="dlc-vm__lang" type="button" data-l="vi">VI</button>' +
        '<button class="dlc-vm__lang" type="button" data-l="es">ES</button>' +
      '</div>';

    return el;
  }

  // ── UI helpers ────────────────────────────────────────────────────────────
  function _setState(s) {
    _state = s;
    if (!_overlay) return;
    _overlay.setAttribute('data-state', s);
    var el = _overlay.querySelector('.dlc-vm__state-label');
    if (el) el.textContent = _lbl(s);
    var mic = _overlay.querySelector('.dlc-vm__mic');
    if (mic) mic.disabled = (s === 'listening');
  }

  function _setTranscript(text) {
    var el = _overlay && _overlay.querySelector('.dlc-vm__transcript');
    if (!el) return;
    el.textContent = text ? '\u201c' + text + '\u201d' : '';
  }

  function _setResponse(text) {
    var el = _overlay && _overlay.querySelector('.dlc-vm__response');
    if (el) el.textContent = text || '';
  }

  function _setName(name) {
    var el = _overlay && _overlay.querySelector('.dlc-vm__name');
    if (el) el.textContent = name || '';
  }

  function _setLang(l) {
    if (!LANG_TAG[l]) return;
    _lang = l;
    if (!_overlay) return;
    _overlay.querySelectorAll('.dlc-vm__lang').forEach(function (btn) {
      btn.classList.toggle('dlc-vm__lang--active', btn.dataset.l === l);
    });
  }

  // ── Language detection (same priority as existing system) ─────────────────
  function _detectLang() {
    // 1. Active booking state (already set by receptionist)
    if (_biz && _biz._bookingState && LANG_TAG[_biz._bookingState.lang]) {
      return _biz._bookingState.lang;
    }
    // 2. localStorage preference
    try {
      var s = localStorage.getItem('dlc_lang');
      if (s && LANG_TAG[s]) return s;
    } catch (_) {}
    return 'en';
  }

  // ── Text-based spoken language detection ──────────────────────────────────
  // Called after STT returns a transcript. Identifies language from Unicode
  // cues so voice mode can auto-switch TTS voice and UI labels to match.
  // Returns { lang: 'en'|'vi'|'es', confidence: 'high'|'low' }
  function _detectLangFromText(text) {
    if (!text) return { lang: 'en', confidence: 'low' };
    // Vietnamese: characters unique to Vietnamese — ă Ă đ Đ ơ Ơ ư Ư + full
    // Latin Extended Additional block U+1EA0-U+1EF9 (ạảấầẩẫậắằẳẵặẹẻ etc.)
    if (/[\u0102\u0103\u0110\u0111\u01a0\u01a1\u01af\u01b0\u1ea0-\u1ef9]/.test(text)) {
      return { lang: 'vi', confidence: 'high' };
    }
    // Spanish: ñ Ñ, ¿, ¡ — or common Spanish words
    if (/[\u00f1\u00d1\u00bf\u00a1]/.test(text) ||
        /\b(hola|qu[ie]ro|hablar|cu[aá]ndo|d[oó]nde|c[oó]mo|gracias|s[ií]|est[aá]|estoy|necesito|reservar|agendar|una\s+cita|para|cita|por\s+favor)\b/i.test(text)) {
      return { lang: 'es', confidence: 'high' };
    }
    return { lang: 'en', confidence: 'low' };
  }

  // Show a brief auto-detection hint (fades after ~2 s)
  function _showAutoLangHint(lang) {
    var el = _overlay && _overlay.querySelector('.dlc-vm__auto-lang');
    if (!el) return;
    var hints = {
      en: 'English detected',
      vi: 'Ti\u1ebfng Vi\u1ec7t',
      es: 'Espa\u00f1ol'
    };
    el.textContent = hints[lang] || '';
    el.classList.add('dlc-vm__auto-lang--show');
    clearTimeout(_autoLangTimer);
    _autoLangTimer = setTimeout(function () {
      el.classList.remove('dlc-vm__auto-lang--show');
    }, 2200);
  }

  // ── Voice selection helper ─────────────────────────────────────────────────
  // Exact BCP-47 match first (e.g. en-US), then same-primary fallback (en-GB, en-AU).
  // Within each tier, non-local (online) voices are preferred for higher quality.
  function _pickVoice(voices, targetTag) {
    var tag     = targetTag.toLowerCase();   // 'en-us', 'vi-vn', 'es-us'
    var primary = tag.split('-')[0];         // 'en', 'vi', 'es'

    // Tier 1: exact match (e.g. en-US only — never en-GB)
    var exact = voices.filter(function (v) {
      return v.lang && v.lang.toLowerCase() === tag;
    });
    var pick = exact.find(function (v) { return !v.localService; }) || exact[0];
    if (pick) return pick;

    // Tier 2: same primary subtag (en-AU, en-CA…) — any accent better than nothing
    var approx = voices.filter(function (v) {
      return v.lang && v.lang.toLowerCase().startsWith(primary + '-');
    });
    pick = approx.find(function (v) { return !v.localService; }) || approx[0];
    return pick || null;
  }

  // ── Web Audio API (for Gemini PCM output) ─────────────────────────────────
  // Must be called from a user-gesture handler on the first use so iOS Safari
  // grants the AudioContext permission.  Subsequent calls are no-ops once open.
  function _ensureAudioCtx() {
    try {
      if (!_audioCtx || _audioCtx.state === 'closed') {
        _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (_audioCtx.state === 'suspended') {
        _audioCtx.resume().catch(function () {});
      }
    } catch (_) {}
    return _audioCtx;
  }

  // ── iOS TTS primer ────────────────────────────────────────────────────────
  // Must be called from inside a user-gesture handler (mic tap).
  // Plays a silent 0-volume utterance to unlock async speechSynthesis.speak()
  // on subsequent calls (even after the gesture chain ends).
  function _primeIosTts() {
    if (_iosPrimed || !hasTTS) return;
    try {
      var u   = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      u.rate   = 16;
      window.speechSynthesis.speak(u);
      _iosPrimed = true;
    } catch (_) {}
  }

  // ── Speech recognition ────────────────────────────────────────────────────
  function _stopRec() {
    if (_rec) {
      try { _rec.abort(); } catch (_) {}
      _rec = null;
    }
    if (_state === 'listening') _setState('idle');
  }

  // ── Hands-free auto-restart ────────────────────────────────────────────────
  // Called after every TTS completion. Waits a brief conversational pause,
  // then restarts the microphone so the user can reply without tapping.
  // 300ms: long enough to prevent audio bleed from TTS tail, short enough
  // that users don't miss the first word of their response.
  // Guards: only fires if overlay is still open and state is still idle.
  function _autoRestartListening() {
    setTimeout(function () {
      if (!_biz || !_overlay) return;    // overlay was closed
      if (_state !== 'idle') return;     // something else already started
      if (!hasSR) return;
      _startListening();
    }, 300);
  }

  function _startListening() {
    // Mic tap while speaking → interrupt AI and start listening immediately
    if (_state === 'speaking') { _stopSpeaking(); _startListening(); return; }
    if (_state === 'listening') { _stopRec(); return; }
    // Mic tap while AI is processing → flag it; TTS will be skipped and mic
    // auto-starts once the bot reply is detected.
    if (_state === 'processing') { _interruptNext = true; return; }

    // Prime iOS TTS while we're still inside the tap handler
    _primeIosTts();

    if (!hasSR) {
      _handleNoSpeechRecognition();
      return;
    }

    _setTranscript('');
    _setResponse('');
    _setState('listening');

    try {
      _rec = new SR();
      _rec.lang            = LANG_TAG[_lang] || 'en-US';
      _rec.continuous      = false;
      _rec.interimResults  = false;
      _rec.maxAlternatives = 1;

      _rec.onresult = function (e) {
        var transcript = (e.results[0] && e.results[0][0].transcript || '').trim();
        _rec = null;
        if (!transcript) { _setState('idle'); _autoRestartListening(); return; }
        _setTranscript(transcript);
        _processTranscript(transcript);
      };

      _rec.onerror = function (e) {
        _rec = null;
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          _handlePermissionDenied();
          return;
        }
        if (e.error === 'no-speech') { _setState('idle'); _autoRestartListening(); return; }
        _setState('error');
      };

      _rec.onend = function () {
        // onresult fires before onend; if still in listening it means no result
        if (_state === 'listening') _setState('idle');
      };

      _rec.start();
    } catch (err) {
      _setState('error');
    }
  }

  // ── Transcript → Receptionist brain ──────────────────────────────────────
  // Routes through the correct send function for the current vendor:
  //   nailsalon (LilyReceptionist): biz._voiceSend — the local send() inside
  //     LilyReceptionist.init with the full specialized AI brain, availability
  //     checks, state machine, and booking logic. Exposed by receptionist.js.
  //   other vendors: window.Marketplace.Receptionist._sendMessage (generic path).
  // MutationObserver detects the bot reply regardless of which path fires.
  function _processTranscript(text) {
    if (!_biz || !_msgsEl) { _setState('idle'); return; }

    // Auto-detect spoken language from transcript text.
    // Only fires when confidence is high AND the detected language differs from
    // current — and only when not mid-booking (receptionist already set a lang).
    if (!(_biz._bookingState && _biz._bookingState.lang)) {
      var _detected = _detectLangFromText(text);
      if (_detected.confidence === 'high' && _detected.lang !== _lang) {
        _setLang(_detected.lang);
        _showAutoLangHint(_detected.lang);
      }
    }

    _setState('processing');

    // Always use MutationObserver for bot reply detection — reliable across
    // both LilyReceptionist (which has many _appendMessage call sites) and
    // the generic Receptionist._sendMessage path.
    _watchForBotBubble(function (replyText) {
      _setResponse(replyText);
      // If user tapped mic during processing, skip TTS and go straight to listening.
      if (_interruptNext) {
        _interruptNext = false;
        _setState('idle');
        _autoRestartListening();
        return;
      }
      _speakReply(replyText);
    });

    // Call the correct send function for this vendor
    try {
      if (typeof _biz._voiceSend === 'function') {
        // nailsalon: use LilyReceptionist's local send() — full specialized brain
        _biz._voiceSend(text);
      } else {
        // other vendors: generic Marketplace receptionist
        window.Marketplace.Receptionist._sendMessage(_biz, text, _msgsEl);
      }
    } catch (err) {
      _setState('error');
    }
  }

  // MutationObserver: fires on the first real bot reply added to the chat.
  // Must skip typing indicators from both receptionist sources:
  //   marketplace.js _appendTyping: outer div has class mp-ai__msg--typing
  //   receptionist.js _showTyping:  outer div has mp-ai__msg--bot only;
  //                                 inner bubble has mp-ai__bubble--typing
  // Selector .mp-ai__bubble:not(.mp-ai__bubble--typing) + non-empty text
  // handles both cases correctly.
  //
  // _pendingSpoken override: when receptionist.js pre-builds a full spoken
  // confirmation text (confirm + closing + tip note as one utterance), it calls
  // DLCVoiceMode.setNextSpoken() before the first _appendMessage fires. The
  // observer then uses that pre-built text instead of the raw bubble text,
  // so the voice path speaks the complete intended confirmation content.
  function _watchForBotBubble(cb) {
    if (!_msgsEl) return;
    var obs = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var nodes = mutations[i].addedNodes;
        for (var j = 0; j < nodes.length; j++) {
          var node = nodes[j];
          if (node.nodeType !== 1) continue;
          if (!node.classList.contains('mp-ai__msg--bot')) continue;
          // Skip marketplace.js typing indicator (has outer --typing class)
          if (node.classList.contains('mp-ai__msg--typing')) continue;
          // Skip receptionist.js typing indicator (inner bubble has --typing class)
          var bubble = node.querySelector('.mp-ai__bubble:not(.mp-ai__bubble--typing)');
          if (bubble && bubble.textContent.trim()) {
            obs.disconnect();
            // Use pre-built spoken text if available (confirmation with closing + tip note);
            // otherwise fall back to raw bubble text content.
            var spoken = _pendingSpoken || bubble.textContent.trim();
            _pendingSpoken = null;
            cb(spoken);
            return;
          }
        }
      }
    });
    obs.observe(_msgsEl, { childList: true, subtree: false });
    // Safety: disconnect after 30 s to avoid zombie observers
    setTimeout(function () { obs.disconnect(); }, 30000);
  }

  // ── Text-to-speech ────────────────────────────────────────────────────────
  function _stopSpeaking() {
    clearTimeout(_ttsStartGuard);
    _ttsStartGuard = null;
    clearInterval(_keepalive);
    _keepalive = null;
    if (hasTTS) { try { window.speechSynthesis.cancel(); } catch (_) {} }
    // Stop any in-flight Gemini/AudioContext playback
    if (_currentSource) {
      try { _currentSource.stop(); } catch (_) {}
      _currentSource = null;
    }
    if (_state === 'speaking') _setState('idle');
  }

  // Browser TTS path — used for English, Spanish, and Vietnamese fallback.
  // Uses _pickVoice() for exact BCP-47 matching (prevents en-GB on en-US intent).
  function _speakViaBrowser(spoken) {
    if (!hasTTS) { _setState('idle'); return; }

    var utter   = new SpeechSynthesisUtterance(spoken);
    utter.lang  = LANG_TAG[_lang] || 'en-US';
    utter.rate  = 0.92;
    utter.pitch = 1.0;

    // Use cached voice list; fall back to live getVoices() only if cache is still empty
    var voices = _voices.length ? _voices : [];
    if (!voices.length) { try { voices = window.speechSynthesis.getVoices() || []; } catch (_) {} }
    var pick = _pickVoice(voices, LANG_TAG[_lang] || 'en-US');
    if (pick) utter.voice = pick;

    clearTimeout(_ttsStartGuard);

    utter.onend = function () {
      clearTimeout(_ttsStartGuard);
      clearInterval(_keepalive);
      _keepalive = null;
      if (_state === 'speaking') _setState('idle');
      _autoRestartListening();
    };
    utter.onerror = function () {
      clearTimeout(_ttsStartGuard);
      clearInterval(_keepalive);
      _keepalive = null;
      if (_state === 'speaking') _setState('idle');
      _autoRestartListening();
    };

    // iOS Safari bug: speechSynthesis stops speaking after ~14 s.
    // pause()/resume() cycle every 10 s keeps it alive.
    utter.onstart = function () {
      clearTimeout(_ttsStartGuard);
      _keepalive = setInterval(function () {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        } else {
          clearInterval(_keepalive);
          _keepalive = null;
        }
      }, 10000);
    };

    // Safety: if TTS never fires onstart within 2 s (silently blocked by browser),
    // reset to idle so the mic is still usable.
    _ttsStartGuard = setTimeout(function () {
      if (_state === 'speaking' && !window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        _setState('idle');
      }
    }, 2000);

    try {
      window.speechSynthesis.speak(utter);
    } catch (_) {
      clearTimeout(_ttsStartGuard);
      _setState('idle');
    }
  }

  // OpenAI TTS — primary engine for all languages.
  // model: tts-1 (speed-optimised), voice: nova (warm female, multilingual).
  // Roundtrip ~200–400 ms vs Gemini's 500–1500 ms.
  // Requires openaiKey in Firestore vendor doc, platform config, or localStorage 'dlc_openai_key'.
  function _speakViaOpenAi(text, onDone) {
    var key = (_biz && _biz._firestoreOpenAiKey) || (_biz && _biz._platformOpenAiKey) || '';
    if (!key) { try { key = localStorage.getItem('dlc_openai_key') || ''; } catch (_) {} }
    if (!key) { onDone(false); return; }

    var ctx = _ensureAudioCtx();
    if (!ctx) { onDone(false); return; }

    fetch('https://api.openai.com/v1/audio/speech', {
      method:  'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model: 'tts-1', input: text, voice: 'nova', response_format: 'mp3' })
    })
    .then(function (resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.arrayBuffer();
    })
    .then(function (buf) {
      return new Promise(function (resolve, reject) {
        ctx.decodeAudioData(buf, resolve, reject);
      });
    })
    .then(function (decoded) {
      if (_state !== 'speaking') return; // cancelled while waiting
      var src = ctx.createBufferSource();
      src.buffer = decoded;
      src.connect(ctx.destination);
      _currentSource = src;
      src.onended = function () {
        _currentSource = null;
        if (_state === 'speaking') _setState('idle');
        onDone(true);
        _autoRestartListening();
      };
      src.start();
    })
    .catch(function () {
      _currentSource = null;
      onDone(false);
    });
  }

  // Pre-fetch welcome message audio via OpenAI TTS while the user is still on
  // the page (before they tap voice mode).  Stores raw MP3 ArrayBuffer so open()
  // can decode + play it instantly with no perceptible delay.
  // Called by receptionist.js after Firestore vendor data loads (keys available).
  function _prefetchWelcome(biz) {
    if (_welcomeBuffer) return; // already fetched
    var key = (biz && biz._firestoreOpenAiKey) || (biz && biz._platformOpenAiKey) || '';
    if (!key) { try { key = localStorage.getItem('dlc_openai_key') || ''; } catch (_) {} }
    if (!key) return;

    var welcome = (biz && biz.aiReceptionist && biz.aiReceptionist.welcomeMessage) || '';
    var text = _cleanForTts(welcome);
    if (!text) return;

    fetch('https://api.openai.com/v1/audio/speech', {
      method:  'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model: 'tts-1', input: text, voice: 'nova', response_format: 'mp3' })
    })
    .then(function (resp) { if (!resp.ok) throw new Error(); return resp.arrayBuffer(); })
    .then(function (buf) { _welcomeBuffer = buf; })
    .catch(function () {}); // silent fail — open() will fall back gracefully
  }

  // Gemini TTS path — fallback when OpenAI key is unavailable.
  // Requires dlc_gemini_key in localStorage.
  // API returns Int16 PCM at 24 kHz (base64); decoded and played via AudioContext.
  // Calls onDone(true) on success, onDone(false) on any failure so the caller
  // can fall through to browser TTS.
  function _speakViaGemini(text, onDone) {
    // Key priority: Firestore vendor doc (geminiKey) → platform config → localStorage override
    var key = (_biz && _biz._firestoreGeminiKey) || (_biz && _biz._platformGeminiKey) || '';
    if (!key) { try { key = localStorage.getItem('dlc_gemini_key') || ''; } catch (_) {} }
    if (!key) { onDone(false); return; }

    var ctx = _ensureAudioCtx();
    if (!ctx) { onDone(false); return; }

    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
              'gemini-2.5-flash-preview-tts:generateContent?key=' +
              encodeURIComponent(key);

    // Voice per language: Sulafat (warm) for EN, Aoede (breezy) for VI/ES
    var voiceName = _lang === 'en' ? 'Sulafat' : 'Aoede';

    var payload = {
      contents: [{ parts: [{ text: text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName }
          }
        }
      }
    };

    fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    })
    .then(function (resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.json();
    })
    .then(function (data) {
      // Navigate the response to the inline audio data
      var part = data.candidates &&
                 data.candidates[0] &&
                 data.candidates[0].content &&
                 data.candidates[0].content.parts &&
                 data.candidates[0].content.parts[0];
      if (!part || !part.inlineData || !part.inlineData.data) {
        throw new Error('no audio data');
      }

      // Decode base64 → raw bytes
      var raw   = atob(part.inlineData.data);
      var bytes = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

      // Interpret as Int16 PCM signed little-endian → normalize to Float32
      var int16   = new Int16Array(bytes.buffer);
      var float32 = new Float32Array(int16.length);
      for (var i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

      // Create AudioBuffer (mono, 24 kHz) and play
      var buf = ctx.createBuffer(1, float32.length, 24000);
      buf.copyToChannel(float32, 0);

      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      _currentSource = src;

      src.onended = function () {
        _currentSource = null;
        if (_state === 'speaking') _setState('idle');
        onDone(true);
        _autoRestartListening();
      };

      src.start();
    })
    .catch(function () {
      _currentSource = null;
      onDone(false);
    });
  }

  // Instant browser TTS — used for the welcome message only.
  // No Gemini roundtrip, no delay. Called synchronously inside the open()
  // user-gesture so iOS Safari allows it.
  function _speakFast(text) {
    try { if (hasTTS) window.speechSynthesis.cancel(); } catch (_) {}
    _setState('speaking');
    _speakViaBrowser(text);
  }

  // TTS router — cleans text, truncates for speed, dispatches to Gemini
  // (best quality) with browser TTS as fallback.
  function _speakReply(text) {
    if (!text) { _setState('idle'); return; }
    var spoken = _cleanForTts(text);
    if (!spoken) { _setState('idle'); return; }

    // Trim to ~2 sentences before sending to Gemini — shorter text processes
    // significantly faster without any perceptible quality loss.
    var ttsText = _truncateForTts(spoken);

    try { if (hasTTS) window.speechSynthesis.cancel(); } catch (_) {}
    _setState('speaking');

    // OpenAI TTS (~200-400ms) → Gemini TTS (~500-1500ms) → browser TTS (instant)
    _speakViaOpenAi(ttsText, function (s1) {
      if (!s1 && _state === 'speaking') {
        _speakViaGemini(ttsText, function (s2) {
          if (!s2 && _state === 'speaking') _speakViaBrowser(ttsText);
        });
      }
    });
  }

  // ── Error / fallback states ───────────────────────────────────────────────
  function _handlePermissionDenied() {
    _setState('error');
    var el = _overlay && _overlay.querySelector('.dlc-vm__state-label');
    if (!el) return;
    el.textContent = _lang === 'vi'
      ? 'Microphone b\u1ecb ch\u1eb7n. Vui l\u00f2ng c\u1ea5p quy\u1ec1n trong c\u00e0i \u0111\u1eb7t tr\u00ecnh duy\u1ec7t.'
      : _lang === 'es'
      ? 'Micr\u00f3fono bloqueado. Permite el acceso en Configuraci\u00f3n del navegador.'
      : 'Microphone access blocked. Allow it in browser settings, then try again.';
  }

  function _handleNoSpeechRecognition() {
    // Browser doesn't support STT — drop back to text chat
    close();
    var inp = document.querySelector('.mp-ai__input');
    if (inp) setTimeout(function () { inp.focus(); }, 300);
  }

  // ── Open / Close ──────────────────────────────────────────────────────────
  function open(biz, messagesEl) {
    _biz    = biz;
    _msgsEl = messagesEl;
    _lang   = _detectLang();
    biz._isVoiceMode = true;   // tells AI prompt to give short spoken-language responses

    if (!_overlay) {
      _overlay = _buildOverlay();
      document.body.appendChild(_overlay);
      _bindOverlayEvents();
    }

    // Sync display
    _setName((biz.aiReceptionist && biz.aiReceptionist.name) || biz.name || '');
    _setLang(_lang);
    _setState('idle');
    _setTranscript('');
    _setResponse('');

    // Trigger CSS transition
    _overlay.removeAttribute('hidden');
    requestAnimationFrame(function () {
      _overlay.classList.add('dlc-vm--open');
    });

    document.documentElement.classList.add('dlc-vm-active');

    // Create AudioContext within this user-gesture handler so iOS Safari
    // grants the permission to play audio on subsequent async Gemini calls.
    _ensureAudioCtx();

    // Welcome message: play pre-fetched OpenAI audio instantly if available,
    // otherwise fall through normal TTS pipeline.
    // AudioContext is already created above (user-gesture), so decodeAudioData
    // and BufferSource.start() work asynchronously without a new gesture.
    var welcome = (biz.aiReceptionist && biz.aiReceptionist.welcomeMessage) || '';
    if (welcome) {
      var w = _cleanForTts(welcome);
      if (w) {
        if (_welcomeBuffer) {
          // Pre-fetched — decode + play; near-instant, high quality
          var _wCtx = _audioCtx;
          var _wBuf = _welcomeBuffer;
          _welcomeBuffer = null;
          // Re-prefetch immediately so the NEXT open also gets instant OpenAI nova audio.
          // Without this, the 2nd+ open falls into the live TTS chain which may land on
          // Gemini or browser TTS — a different-sounding voice.
          setTimeout(function () { _prefetchWelcome(biz); }, 1500);
          _setState('speaking');
          _wCtx.decodeAudioData(_wBuf,
            function (decoded) {
              if (_state !== 'speaking') return;
              var src = _wCtx.createBufferSource();
              src.buffer = decoded;
              src.connect(_wCtx.destination);
              _currentSource = src;
              src.onended = function () { _currentSource = null; _setState('idle'); _autoRestartListening(); };
              src.start();
            },
            function () { _speakReply(welcome); } // decode failed → normal pipeline
          );
        } else {
          // Pre-fetch not ready (slow network / no key) — use normal TTS pipeline
          _speakReply(welcome);
        }
      }
    }
  }

  function close() {
    _stopSpeaking();
    _stopRec();

    // Clear any pending hook so it doesn't fire after close
    var R = window.Marketplace && window.Marketplace.Receptionist;
    if (R && typeof R._onBotMessage === 'function') R._onBotMessage = null;

    if (_overlay) {
      _overlay.classList.remove('dlc-vm--open');
    }
    document.documentElement.classList.remove('dlc-vm-active');

    if (_biz) _biz._isVoiceMode = false;
    _biz           = null;
    _msgsEl        = null;
    _interruptNext = false;
    _setState('idle');
  }

  function _bindOverlayEvents() {
    var mic      = _overlay.querySelector('.dlc-vm__mic');
    var closeBtn = _overlay.querySelector('.dlc-vm__close');
    var textBtn  = _overlay.querySelector('.dlc-vm__text-btn');
    var langBtns = _overlay.querySelectorAll('.dlc-vm__lang');

    mic.addEventListener('click', _startListening);

    closeBtn.addEventListener('click', close);

    textBtn.addEventListener('click', function () {
      close();
      var inp = document.querySelector('.mp-ai__input');
      if (inp) setTimeout(function () { inp.focus(); }, 300);
    });

    langBtns.forEach(function (btn) {
      btn.addEventListener('click', function () { _setLang(btn.dataset.l); });
    });

    // Tap outside inner card closes overlay (accessibility)
    _overlay.addEventListener('click', function (e) {
      if (e.target === _overlay) close();
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────
  window.DLCVoiceMode = {
    open:            open,
    close:           close,
    isSupported:     function () { return hasSR && hasTTS; },
    prefetchWelcome: _prefetchWelcome,
    // Called by receptionist.js before the first confirmation bubble is appended.
    // Sets a one-shot spoken override: the next _watchForBotBubble callback will
    // speak this text instead of the raw first-bubble text content. This lets the
    // voice path speak the full confirmation (factual + closing + tip note) as a
    // single natural utterance rather than only the first of several bubbles.
    setNextSpoken:   function (text) { _pendingSpoken = text || null; }
  };

})();
