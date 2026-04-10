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
 */
(function () {
  'use strict';

  // ── Feature detection ─────────────────────────────────────────────────────
  var SR   = window.SpeechRecognition || window.webkitSpeechRecognition;
  var hasSR  = !!SR;
  var hasTTS = !!window.speechSynthesis;

  // BCP-47 tags for Web Speech API
  var LANG_TAG = { en: 'en-US', vi: 'vi-VN', es: 'es-US' };

  // ── Module state ──────────────────────────────────────────────────────────
  var _biz        = null;
  var _msgsEl     = null;    // .mp-ai__messages container
  var _overlay    = null;
  var _rec        = null;    // SpeechRecognition instance
  var _state      = 'idle';  // idle | listening | processing | speaking | error
  var _lang       = 'en';
  var _iosPrimed  = false;   // TTS primed on iOS via silent utterance
  var _keepalive  = null;    // iOS TTS keepalive timer

  // ── State labels ──────────────────────────────────────────────────────────
  var LABEL = {
    en: {
      idle:       'Tap microphone to speak',
      listening:  'Listening\u2026',
      processing: 'Processing\u2026',
      speaking:   'Speaking\u2026',
      error:      'Tap to try again'
    },
    vi: {
      idle:       'Nh\u1ea5n micro \u0111\u1ec3 n\u00f3i',
      listening:  '\u0110ang nghe\u2026',
      processing: '\u0110ang x\u1eed l\u00fd\u2026',
      speaking:   '\u0110ang n\u00f3i\u2026',
      error:      'Th\u1eed l\u1ea1i'
    },
    es: {
      idle:       'Toca el micr\u00f3fono para hablar',
      listening:  'Escuchando\u2026',
      processing: 'Procesando\u2026',
      speaking:   'Hablando\u2026',
      error:      'Toca para reintentar'
    }
  };

  function _lbl(key) {
    return (LABEL[_lang] || LABEL.en)[key] || '';
  }

  // ── Build DOM ─────────────────────────────────────────────────────────────
  function _buildOverlay() {
    var el = document.createElement('div');
    el.id        = 'dlcVoiceOverlay';
    el.className = 'dlc-vm';
    el.setAttribute('role',       'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Voice mode');

    // Microphone SVG (reuse same path as existing micIcon in marketplace.js)
    var micSVG =
      '<svg class="dlc-vm__mic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="9" y="2" width="6" height="11" rx="3"/>' +
        '<path d="M5 10a7 7 0 0014 0"/>' +
        '<line x1="12" y1="21" x2="12" y2="17"/>' +
        '<line x1="8" y1="21" x2="16" y2="21"/>' +
      '</svg>';

    var closeSVG =
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
      'stroke-width="2.5" stroke-linecap="round" aria-hidden="true">' +
        '<line x1="18" y1="6" x2="6" y2="18"/>' +
        '<line x1="6" y1="6" x2="18" y2="18"/>' +
      '</svg>';

    el.innerHTML =
      '<div class="dlc-vm__inner">' +
        '<button class="dlc-vm__close" type="button" aria-label="Close voice mode">' +
          closeSVG +
        '</button>' +
        '<div class="dlc-vm__name" aria-live="polite"></div>' +
        '<div class="dlc-vm__state-label" aria-live="polite" aria-atomic="true"></div>' +
        '<div class="dlc-vm__transcript" aria-live="polite"></div>' +
        '<button class="dlc-vm__mic" type="button" aria-label="Speak">' +
          micSVG +
        '</button>' +
        '<div class="dlc-vm__response" aria-live="polite"></div>' +
        '<div class="dlc-vm__actions">' +
          '<button class="dlc-vm__text-btn" type="button">Switch to text</button>' +
        '</div>' +
        '<div class="dlc-vm__langs">' +
          '<button class="dlc-vm__lang" type="button" data-l="en">EN</button>' +
          '<button class="dlc-vm__lang" type="button" data-l="vi">VI</button>' +
          '<button class="dlc-vm__lang" type="button" data-l="es">ES</button>' +
        '</div>' +
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
    if (mic) mic.disabled = (s === 'processing');
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

  function _startListening() {
    // Mic tap: toggle listening / stop speaking
    if (_state === 'speaking') { _stopSpeaking(); return; }
    if (_state === 'listening') { _stopRec(); return; }
    if (_state === 'processing') return;

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
        if (!transcript) { _setState('idle'); return; }
        _setTranscript(transcript);
        _processTranscript(transcript);
      };

      _rec.onerror = function (e) {
        _rec = null;
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          _handlePermissionDenied();
          return;
        }
        if (e.error === 'no-speech') { _setState('idle'); return; }
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
    _setState('processing');

    // Always use MutationObserver for bot reply detection — reliable across
    // both LilyReceptionist (which has many _appendMessage call sites) and
    // the generic Receptionist._sendMessage path.
    _watchForBotBubble(function (replyText) {
      _setResponse(replyText);
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
            cb(bubble.textContent.trim());
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
    clearInterval(_keepalive);
    _keepalive = null;
    if (hasTTS) { try { window.speechSynthesis.cancel(); } catch (_) {} }
    if (_state === 'speaking') _setState('idle');
  }

  function _speakReply(text) {
    if (!text || !hasTTS) { _setState('idle'); return; }

    // Strip AI state/booking markers and markdown before speaking
    var spoken = text
      .replace(/\[STATE:[^\]]*\]/g,   '')
      .replace(/\[BOOKING:[^\]]*\]/g, '')
      .replace(/\[ESCALATE:[^\]]*\]/g,'')
      .replace(/#{1,6}\s?/g, '')
      .replace(/\*{1,3}([^*]*)\*{1,3}/g, '$1')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!spoken) { _setState('idle'); return; }

    try { window.speechSynthesis.cancel(); } catch (_) {}
    _setState('speaking');

    var utter      = new SpeechSynthesisUtterance(spoken);
    utter.lang     = LANG_TAG[_lang] || 'en-US';
    utter.rate     = 0.92;
    utter.pitch    = 1.0;

    // Pick the best available voice for the target language
    var voices = [];
    try { voices = window.speechSynthesis.getVoices(); } catch (_) {}
    var twoChar = (LANG_TAG[_lang] || 'en').split('-')[0];
    var langVoices = voices.filter(function (v) {
      return v.lang && v.lang.toLowerCase().startsWith(twoChar);
    });
    // Prefer online (non-local) voices for higher quality, fall back to any
    var pick = langVoices.find(function (v) { return !v.localService; }) || langVoices[0];
    if (pick) utter.voice = pick;

    utter.onend = function () {
      clearInterval(_keepalive);
      _keepalive = null;
      if (_state === 'speaking') _setState('idle');
    };
    utter.onerror = function () {
      clearInterval(_keepalive);
      _keepalive = null;
      // Text is still visible — don't dead-end user, just return to idle
      if (_state === 'speaking') _setState('idle');
    };

    // iOS Safari bug: speechSynthesis stops speaking after ~14 s.
    // pause()/resume() cycle every 10 s keeps it alive.
    utter.onstart = function () {
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

    try {
      window.speechSynthesis.speak(utter);
    } catch (_) {
      _setState('idle');
    }
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

    _biz    = null;
    _msgsEl = null;
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
    open:        open,
    close:       close,
    isSupported: function () { return hasSR && hasTTS; }
  };

})();
