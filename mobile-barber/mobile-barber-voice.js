'use strict';
/*
 * Mobile Barber Phase 7 voice booking agent.
 * Reuses the DuLichCali voice pattern: SpeechRecognition input and
 * language-aware provider fallback for speechSynthesis output.
 */
(function(root) {
  var SR = root.SpeechRecognition || root.webkitSpeechRecognition;
  var hasSR = !!SR;
  var hasTTS = !!root.speechSynthesis;
  var LANG_TAG = { en: 'en-US', vi: 'vi-VN', es: 'es-US' };

  var STRINGS = {
    en: {
      title: 'Barber Voice Assistant',
      statusIdle: 'Ready',
      statusListening: 'listening',
      statusThinking: 'thinking',
      statusConfirming: 'confirming',
      statusBooked: 'booked',
      statusError: 'Microphone blocked. Switching to text chat.',
      micLabel: 'Talk to Barber Assistant',
      closeLabel: 'Close',
      textFallback: 'Use text chat',
      welcome: 'Hi, I can help book a mobile haircut. What phone number should I use to look up your appointment record?'
    },
    vi: {
      title: 'Trợ Lý Giọng Nói Barber',
      statusIdle: 'Sẵn sàng',
      statusListening: 'đang nghe',
      statusThinking: 'đang xử lý',
      statusConfirming: 'đang xác nhận',
      statusBooked: 'đã đặt',
      statusError: 'Micro bị chặn. Chuyển sang chat chữ.',
      micLabel: 'Nói chuyện với Trợ Lý Barber',
      closeLabel: 'Đóng',
      textFallback: 'Dùng chat chữ',
      welcome: 'Dạ em có thể giúp đặt thợ cắt tóc tại nhà. Mình cho em số điện thoại để em tìm hồ sơ trước nhé?'
    },
    es: {
      title: 'Asistente de Voz Barber',
      statusIdle: 'Listo',
      statusListening: 'escuchando',
      statusThinking: 'pensando',
      statusConfirming: 'confirmando',
      statusBooked: 'reservado',
      statusError: 'Micrófono bloqueado. Cambio al chat de texto.',
      micLabel: 'Hablar con el Asistente Barber',
      closeLabel: 'Cerrar',
      textFallback: 'Usar chat de texto',
      welcome: 'Puedo ayudar a reservar un corte móvil. ¿Qué número de teléfono debo usar para buscar su historial?'
    }
  };

  var controller = null;
  var overlay = null;
  var rec = null;
  var state = 'idle';
  var lang = 'en';
  var audioCtx = null;
  var currentSource = null;
  var keepalive = null;
  var ttsStartGuard = null;
  var voices = [];
  var autoTimer = null;
  var voiceSession = null;
  var voiceTurn = 0;
  var voiceHadSuccessfulAudio = false;
  var sessionCounter = 0;

  var VOICE_CONFIG = {
    en: { provider: 'openai', model: 'tts-1', voice: 'nova', accent: 'en-us' },
    vi: { provider: 'gemini', model: 'gemini-2.5-flash-preview-tts', voice: 'Aoede', accent: 'vi-stable' },
    es: { provider: 'openai', model: 'tts-1', voice: 'nova', accent: 'es-us' }
  };

  function _loadVoices() {
    if (!hasTTS) return;
    try {
      var v = root.speechSynthesis.getVoices();
      if (v && v.length) voices = v;
    } catch (e) {}
  }
  _loadVoices();
  try { if (hasTTS) root.speechSynthesis.addEventListener('voiceschanged', _loadVoices); } catch (e) {}

  function t(key) {
    return (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || '';
  }

  function cleanForTts(text) {
    return String(text || '')
      .replace(/\[STATE:[^\]]*\]/g, '')
      .replace(/\[BOOKING:[^\]]*\]/g, '')
      .replace(/\[ESCALATE:[^\]]*\]/g, '')
      .replace(/#{1,6}\s?/g, '')
      .replace(/\*{1,3}([^*]*)\*{1,3}/g, '$1')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .replace(/\b(0?\d|1\d|2[0-3]):([0-5]\d)\b(?!\s*[AaPp][Mm])/g, function(_, hStr, mStr) {
        var hr = parseInt(hStr, 10);
        var mn = parseInt(mStr, 10);
        var ap = hr < 12 ? 'AM' : 'PM';
        hr = hr % 12 || 12;
        return hr + ':' + (mn < 10 ? '0' : '') + mn + ' ' + ap;
      })
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function truncateForTts(text) {
    var max = 600;
    if (text.length <= max) return text;
    var dot = text.lastIndexOf('. ', max);
    return text.substring(0, dot > max * 0.4 ? dot + 1 : max).trim();
  }

  function safeRepairFragment(text) {
    return cleanForTts(text).substring(0, 60).trim();
  }

  function getControllerVendorId() {
    if (!controller) return '';
    if (typeof controller.vendorId === 'function') return controller.vendorId() || '';
    return controller.vendorId || '';
  }

  function detectLangFromText(text) {
    if (root.AIEngine && typeof root.AIEngine.detectLang === 'function') {
      var detected = root.AIEngine.detectLang(text);
      if (LANG_TAG[detected]) return detected;
    }
    if (/[\u0102\u0103\u0110\u0111\u01a0\u01a1\u01af\u01b0\u1ea0-\u1ef9]/.test(text || '')) return 'vi';
    if (/[\u00f1\u00d1\u00bf\u00a1]/.test(text || '') ||
        /\b(hola|quiero|cu[aá]ndo|gracias|reservar|cita|por favor|barbero)\b/i.test(text || '')) return 'es';
    return 'en';
  }

  function createVoiceSession(language) {
    var normalized = LANG_TAG[language] ? language : 'en';
    var cfg = VOICE_CONFIG[normalized] || VOICE_CONFIG.en;
    sessionCounter += 1;
    voiceTurn = 0;
    voiceHadSuccessfulAudio = false;
    voiceSession = {
      sessionId: 'mbv-' + Date.now().toString(36) + '-' + sessionCounter,
      provider: cfg.provider,
      model: cfg.model,
      voice: cfg.voice,
      accent: cfg.accent,
      language: normalized
    };
    try {
      console.info('[voice-session]', {
        sessionId: voiceSession.sessionId,
        language: voiceSession.language,
        provider: voiceSession.provider,
        model: voiceSession.model,
        voice: voiceSession.voice,
        accent: voiceSession.accent,
        vendorId: getControllerVendorId()
      });
    } catch (e) {}
    return voiceSession;
  }

  function currentVoiceSession() {
    return voiceSession || createVoiceSession(lang);
  }

  function logTtsTurn() {
    var session = currentVoiceSession();
    voiceTurn += 1;
    try {
      console.info('[tts-turn]', {
        sessionId: session.sessionId,
        turn: voiceTurn,
        provider: session.provider,
        voice: session.voice,
        accent: session.accent
      });
    } catch (e) {}
    return session;
  }

  function lockVoiceFallback(provider, model, voice, accent, reason) {
    var session = currentVoiceSession();
    if (voiceHadSuccessfulAudio) {
      _voiceProviderLog({
        selectedProvider: session.provider,
        selectedModel: session.model,
        selectedVoice: session.voice,
        selectedAccent: session.accent,
        fallbackReason: 'session-locked:' + reason
      });
      return session;
    }
    session.provider = provider;
    session.model = model;
    session.voice = voice;
    session.accent = accent;
    _voiceProviderLog({
      selectedProvider: provider,
      selectedModel: model,
      selectedVoice: voice,
      selectedAccent: accent,
      fallbackReason: reason
    });
    return session;
  }

  function markVoiceAudioSuccess() {
    voiceHadSuccessfulAudio = true;
  }

  function ensureAudioCtx() {
    try {
      if (!audioCtx || audioCtx.state === 'closed') audioCtx = new (root.AudioContext || root.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(function() {});
    } catch (e) {}
    return audioCtx;
  }

  function getOpenAiKey() {
    var key = controller && (controller.openAiKey || controller.vendorOpenAiKey || controller.platformOpenAiKey || controller.firestoreOpenAiKey);
    if (!key) { try { key = root.localStorage.getItem('dlc_openai_key') || ''; } catch (e) {} }
    return key || '';
  }

  function getGeminiKey() {
    var key = controller && (controller.geminiKey || controller.vendorGeminiKey || controller.platformGeminiKey || controller.firestoreGeminiKey);
    if (!key) { try { key = root.localStorage.getItem('dlc_gemini_key') || ''; } catch (e) {} }
    return key || '';
  }

  function buildOverlay() {
    var el = document.createElement('div');
    el.id = 'mbVoiceOverlay';
    el.className = 'mb-voice';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.innerHTML = [
      '<button class="mb-voice__close" type="button"></button>',
      '<div class="mb-voice__body">',
        '<p class="mb-voice__title"></p>',
        '<div class="mb-voice__status" aria-live="polite" aria-atomic="true"></div>',
        '<div class="mb-voice__transcript" aria-live="polite"></div>',
        '<button class="mb-voice__mic" type="button">',
          '<span class="mb-voice__wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>',
          '<span class="mb-voice__mic-label"></span>',
        '</button>',
        '<div class="mb-voice__response" aria-live="polite"></div>',
        '<button class="mb-voice__text" type="button"></button>',
      '</div>',
      '<div class="mb-voice__langs">',
        '<button type="button" data-lang="en">EN</button>',
        '<button type="button" data-lang="vi">VI</button>',
        '<button type="button" data-lang="es">ES</button>',
      '</div>'
    ].join('');
    return el;
  }

  function syncLabels() {
    if (!overlay) return;
    overlay.querySelector('.mb-voice__title').textContent = t('title');
    overlay.querySelector('.mb-voice__close').textContent = t('closeLabel');
    overlay.querySelector('.mb-voice__close').setAttribute('aria-label', t('closeLabel'));
    overlay.querySelector('.mb-voice__mic-label').textContent = t('micLabel');
    overlay.querySelector('.mb-voice__mic').setAttribute('aria-label', t('micLabel'));
    overlay.querySelector('.mb-voice__text').textContent = t('textFallback');
    overlay.querySelectorAll('.mb-voice__langs button').forEach(function(btn) {
      btn.classList.toggle('mb-voice__lang--active', btn.getAttribute('data-lang') === lang);
    });
    setState(state);
  }

  function setState(next) {
    state = next;
    if (!overlay) return;
    overlay.setAttribute('data-state', next);
    var map = {
      idle: 'statusIdle',
      listening: 'statusListening',
      thinking: 'statusThinking',
      confirming: 'statusConfirming',
      booked: 'statusBooked',
      error: 'statusError'
    };
    overlay.querySelector('.mb-voice__status').textContent = t(map[next] || 'statusIdle');
    overlay.querySelector('.mb-voice__mic').disabled = next === 'listening' || next === 'booked';
  }

  function setTranscript(text) {
    var el = overlay && overlay.querySelector('.mb-voice__transcript');
    if (el) el.textContent = text ? '"' + text + '"' : '';
  }

  function setResponse(text) {
    var el = overlay && overlay.querySelector('.mb-voice__response');
    if (el) el.textContent = text || '';
  }

  function pickVoice(targetTag) {
    var tag = String(targetTag || 'en-US').toLowerCase();
    var primary = tag.split('-')[0];
    var list = voices.length ? voices : [];
    if (!list.length) { try { list = root.speechSynthesis.getVoices() || []; } catch (e) {} }
    var exact = list.filter(function(v) { return v.lang && v.lang.toLowerCase() === tag; });
    var pick = exact.find(function(v) { return !v.localService; }) || exact[0];
    if (pick) return pick;
    var approx = list.filter(function(v) { return v.lang && v.lang.toLowerCase().startsWith(primary + '-'); });
    return approx.find(function(v) { return !v.localService; }) || approx[0] || null;
  }

  function stopSpeaking() {
    clearTimeout(ttsStartGuard);
    clearInterval(keepalive);
    ttsStartGuard = null;
    keepalive = null;
    if (hasTTS) { try { root.speechSynthesis.cancel(); } catch (e) {} }
    if (currentSource) { try { currentSource.stop(); } catch (e) {} currentSource = null; }
  }

  function speakViaBrowser(text) {
    var session = currentVoiceSession();
    if (!hasTTS) {
      _voiceProviderLog({ selectedProvider: 'browser', fallbackReason: 'no-speech-synthesis' });
      afterSpeech(false);
      return;
    }
    _voiceProviderLog({
      selectedProvider: 'browser',
      selectedModel: 'speechSynthesis',
      selectedVoice: session.voice,
      selectedAccent: session.accent,
      transport: 'browser-builtin',
      fallbackReason: 'gemini-and-openai-unavailable'
    });
    var utter = new SpeechSynthesisUtterance(text);
    utter.lang = LANG_TAG[lang] || 'en-US';
    utter.rate = 0.92;
    utter.pitch = 1;
    var voice = pickVoice(utter.lang);
    if (voice) utter.voice = voice;
    utter.onend = function() { markVoiceAudioSuccess(); afterSpeech(true); };
    utter.onerror = function() { afterSpeech(false); };
    utter.onstart = function() {
      clearTimeout(ttsStartGuard);
      keepalive = setInterval(function() {
        if (root.speechSynthesis.speaking) {
          root.speechSynthesis.pause();
          root.speechSynthesis.resume();
        }
      }, 10000);
    };
    ttsStartGuard = setTimeout(function() {
      if (root.speechSynthesis && !root.speechSynthesis.speaking) {
        try { root.speechSynthesis.cancel(); } catch (e) {}
        afterSpeech(false);
      }
    }, 2000);
    try { root.speechSynthesis.speak(utter); } catch (e) { afterSpeech(false); }
  }

  function _playDecodedAudioBuffer(buf, ctx, onDone) {
    return new Promise(function(resolve, reject) { ctx.decodeAudioData(buf, resolve, reject); })
      .then(function(decoded) {
        if (state !== 'confirming' && state !== 'booked' && state !== 'thinking') return;
        var src = ctx.createBufferSource();
        src.buffer = decoded;
        src.connect(ctx.destination);
        currentSource = src;
        src.onended = function() { currentSource = null; markVoiceAudioSuccess(); onDone(true); afterSpeech(true); };
        src.start();
      })
      .catch(function() { currentSource = null; onDone(false); });
  }

  function _b64ToArrayBuffer(b64) {
    var raw = atob(b64);
    var bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes.buffer;
  }

  function _speakViaOpenAi(text, onDone) {
    var session = currentVoiceSession();
    var ctx = ensureAudioCtx();
    if (!ctx) {
      _voiceProviderLog({ selectedProvider: 'openai', fallbackReason: 'no-audio-context' });
      onDone(false); return;
    }

    var hasFunctions = !!(root.firebase && typeof root.firebase.functions === 'function');
    if (hasFunctions) {
      _voiceProviderLog({
        selectedProvider: 'openai',
        selectedModel: session.model || 'tts-1',
        selectedVoice: session.voice || 'nova',
        selectedAccent: session.accent,
        transport: 'aiTtsProxy',
        usingOpenAI: true
      });
      try {
        var fn = root.firebase.functions().httpsCallable('aiTtsProxy');
        fn({ provider: 'openai', text: text, voice: session.voice || 'nova', language: session.language || lang })
          .then(function(result) {
            var data = (result && result.data) || {};
            if (!data.ok || !data.audioBase64) {
              _voiceProviderLog({
                selectedProvider: 'openai',
                usingOpenAI: false,
                fallbackReason: 'proxy:' + (data.debugCode || 'no-audio')
              });
              currentSource = null;
              onDone(false);
              return;
            }
            _playDecodedAudioBuffer(_b64ToArrayBuffer(data.audioBase64), ctx, onDone);
          })
          .catch(function(err) {
            _voiceProviderLog({
              selectedProvider: 'openai',
              usingOpenAI: false,
              fallbackReason: 'proxy-call-failed:' + ((err && err.message) || '').slice(0, 80)
            });
            currentSource = null;
            onDone(false);
          });
        return;
      } catch (e) {
        _voiceProviderLog({
          selectedProvider: 'openai',
          usingOpenAI: false,
          fallbackReason: 'proxy-throw:' + ((e && e.message) || '').slice(0, 80)
        });
        // fall through to legacy client-direct path
      }
    }

    // Legacy fallback: only fires if Firebase Functions SDK isn't loaded AND a
    // client-readable OpenAI key happens to be configured.
    var key = getOpenAiKey();
    if (!key) {
      _voiceProviderLog({
        selectedProvider: 'openai',
        fallbackReason: hasFunctions ? 'no-proxy-and-no-key' : 'no-functions-sdk-and-no-key'
      });
      onDone(false); return;
    }
    _voiceProviderLog({
      selectedProvider: 'openai',
      selectedModel: session.model || 'tts-1',
      selectedVoice: session.voice || 'nova',
      selectedAccent: session.accent,
      transport: 'client-direct',
      usingOpenAI: true
    });
    fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: session.model || 'tts-1', input: text, voice: session.voice || 'nova', response_format: 'mp3' })
    })
    .then(function(resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.arrayBuffer();
    })
    .then(function(buf) { return _playDecodedAudioBuffer(buf, ctx, onDone); })
    .catch(function() { currentSource = null; onDone(false); });
  }

  function _voiceProviderLog(payload) {
    try {
      var base = {
        vertical: 'mobile-barber',
        route: (root.location && root.location.pathname) || '',
        vendorId: getControllerVendorId(),
        requestedLanguage: lang,
        normalizedLanguage: lang,
        usingGemini: false,
        usingOpenAI: false,
        usingAnthropic: false
      };
      Object.keys(payload || {}).forEach(function(k) { base[k] = payload[k]; });
      console.info('[voice-provider]', base);
    } catch (e) {}
  }

  function _decodeGeminiPcm(audioBase64, ctx, onDone) {
    try {
      var raw = atob(audioBase64);
      var bytes = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      var int16 = new Int16Array(bytes.buffer);
      var float32 = new Float32Array(int16.length);
      for (var j = 0; j < int16.length; j++) float32[j] = int16[j] / 32768;
      var buf = ctx.createBuffer(1, float32.length, 24000);
      buf.copyToChannel(float32, 0);
      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      currentSource = src;
      src.onended = function() { currentSource = null; markVoiceAudioSuccess(); onDone(true); afterSpeech(true); };
      src.start();
    } catch (e) {
      currentSource = null;
      onDone(false);
    }
  }

  function _speakViaGemini(text, onDone) {
    var session = currentVoiceSession();
    var ctx = ensureAudioCtx();
    if (!ctx) {
      _voiceProviderLog({ selectedProvider: 'gemini', fallbackReason: 'no-audio-context' });
      onDone(false); return;
    }

    var voice = session.voice || (lang === 'en' ? 'Sulafat' : 'Aoede');
    var hasFunctions = !!(root.firebase && typeof root.firebase.functions === 'function');
    if (hasFunctions) {
      _voiceProviderLog({
        selectedProvider: 'gemini',
        selectedModel: session.model || 'gemini-2.5-flash-preview-tts',
        selectedVoice: voice,
        selectedAccent: session.accent,
        transport: 'aiTtsProxy',
        usingGemini: true
      });
      try {
        var fn = root.firebase.functions().httpsCallable('aiTtsProxy');
        fn({ provider: 'gemini', text: text, voice: voice, language: session.language || lang })
          .then(function(result) {
            var data = (result && result.data) || {};
            if (!data.ok || !data.audioBase64) {
              _voiceProviderLog({
                selectedProvider: 'gemini',
                usingGemini: false,
                fallbackReason: 'proxy:' + (data.debugCode || 'no-audio')
              });
              currentSource = null;
              onDone(false);
              return;
            }
            _decodeGeminiPcm(data.audioBase64, ctx, onDone);
          })
          .catch(function(err) {
            _voiceProviderLog({
              selectedProvider: 'gemini',
              usingGemini: false,
              fallbackReason: 'proxy-call-failed:' + ((err && err.message) || '').slice(0, 80)
            });
            currentSource = null;
            onDone(false);
          });
        return;
      } catch (e) {
        _voiceProviderLog({
          selectedProvider: 'gemini',
          usingGemini: false,
          fallbackReason: 'proxy-throw:' + ((e && e.message) || '').slice(0, 80)
        });
        // fall through to legacy client-direct path if a client key exists
      }
    }

    // Legacy fallback: only fires if Firebase Functions SDK isn't loaded AND a
    // client-readable Gemini key happens to be configured. Keeps backwards-compat.
    var key = getGeminiKey();
    if (!key) {
      _voiceProviderLog({
        selectedProvider: 'gemini',
        fallbackReason: hasFunctions ? 'no-proxy-and-no-key' : 'no-functions-sdk-and-no-key'
      });
      onDone(false);
      return;
    }
    _voiceProviderLog({
      selectedProvider: 'gemini',
      selectedModel: session.model || 'gemini-2.5-flash-preview-tts',
      selectedVoice: voice,
      selectedAccent: session.accent,
      transport: 'client-direct',
      usingGemini: true
    });
    fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }
        }
      })
    })
    .then(function(resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.json();
    })
    .then(function(data) {
      var part = data.candidates && data.candidates[0] && data.candidates[0].content &&
        data.candidates[0].content.parts && data.candidates[0].content.parts[0];
      if (!part || !part.inlineData || !part.inlineData.data) throw new Error('no audio');
      _decodeGeminiPcm(part.inlineData.data, ctx, onDone);
    })
    .catch(function() { currentSource = null; onDone(false); });
  }

  function speakReply(text, nextState) {
    var spoken = truncateForTts(cleanForTts(text));
    if (!spoken) { afterSpeech(false); return; }
    stopSpeaking();
    setState(nextState || 'thinking');
    var session = logTtsTurn();
    if (session.provider === 'gemini') {
      _speakViaGemini(spoken, function(okGemini) {
        if (!okGemini && (state === 'confirming' || state === 'booked' || state === 'thinking')) {
          session = lockVoiceFallback('openai', 'tts-1', 'nova', (session.language || lang) + '-openai', 'gemini-unavailable-before-first-audio');
          _speakViaOpenAi(spoken, function(okOpenAi) {
            if (!okOpenAi && (state === 'confirming' || state === 'booked' || state === 'thinking')) {
              session = lockVoiceFallback('browser', 'speechSynthesis', session.voice, session.accent, 'openai-unavailable-before-first-audio');
              speakViaBrowser(spoken);
            }
          });
        }
      });
      return;
    }
    if (session.provider === 'openai') {
      _speakViaOpenAi(spoken, function(okOpenAi) {
        if (!okOpenAi && (state === 'confirming' || state === 'booked' || state === 'thinking')) {
          session = lockVoiceFallback('gemini', 'gemini-2.5-flash-preview-tts', (session.language === 'en' ? 'Sulafat' : 'Aoede'), (session.language || lang) + '-gemini', 'openai-unavailable-before-first-audio');
          _speakViaGemini(spoken, function(okGemini) {
            if (!okGemini && (state === 'confirming' || state === 'booked' || state === 'thinking')) {
              session = lockVoiceFallback('browser', 'speechSynthesis', session.voice, session.accent, 'gemini-unavailable-before-first-audio');
              speakViaBrowser(spoken);
            }
          });
        }
      });
      return;
    }
    speakViaBrowser(spoken);
  }

  function getExpectedRepairType() {
    var session = controller && typeof controller.getSession === 'function' ? controller.getSession() : null;
    var st = session && session.state;
    if (!st) return '';
    if (!st.phone || st.step === 'ASK_PHONE' || st.step === 'LOOKUP_CUSTOMER') return 'phone';
    if (!st.address || st.step === 'ASK_ADDRESS' || !st.city || !st.zip) return 'address';
    return '';
  }

  function repairPrompt(type, transcript) {
    if (type === 'phone') {
      return lang === 'vi'
        ? 'Dạ em nghe số chưa rõ. Mình đọc từng số chậm giúp em nhé?'
        : lang === 'es'
        ? 'No escuché bien el número. ¿Puede decir los dígitos uno por uno?'
        : "I didn't catch the number clearly. Could you say the digits one by one?";
    }
    if (type === 'address') {
      var city = /\b(san jose|westminster|garden grove|irvine|orange county|santa ana|fountain valley|anaheim)\b/i.exec(transcript || '');
      var street = /\b([a-zA-ZÀ-ỹ.'-]+\s+(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|way|ct|court))\b/i.exec(transcript || '');
      if (city || street) {
        var heardStreet = street && safeRepairFragment(street[1]);
        var heardCity = city && safeRepairFragment(city[1]);
        return lang === 'vi'
          ? 'Dạ em nghe ' + [heardStreet, heardCity].filter(Boolean).join(' ở ') + '. Đúng không ạ?'
          : lang === 'es'
          ? 'Escuché ' + [heardStreet, heardCity].filter(Boolean).join(' en ') + '. ¿Es correcto?'
          : 'I heard ' + [heardStreet, heardCity].filter(Boolean).join(' in ') + '. Is that correct?';
      }
      return lang === 'vi'
        ? 'Dạ em có thể bị lỡ địa chỉ. Mình đọc thành phố trước, rồi đánh vần tên đường giúp em nhé?'
        : lang === 'es'
        ? 'Puede que haya perdido la dirección. ¿Puede decir la ciudad primero y luego deletrear la calle?'
        : 'I may have missed the address. Could you say the city first, then spell the street name?';
    }
    return '';
  }

  function maybeRepairLowConfidence(transcript, confidence) {
    // Browser STT confidence is noisy; 0.72 catches clear misrecognitions
    // without interrupting normal mobile speech in quiet rooms.
    if (confidence === undefined || confidence === null || confidence >= 0.72) return false;
    var type = getExpectedRepairType();
    if (!type) return false;
    var prompt = repairPrompt(type, transcript);
    if (!prompt) return false;
    setTranscript(transcript);
    setResponse(prompt);
    speakReply(prompt, 'thinking');
    return true;
  }

  function afterSpeech() {
    clearTimeout(ttsStartGuard);
    clearInterval(keepalive);
    ttsStartGuard = null;
    keepalive = null;
    if (state === 'booked') return;
    setState('idle');
    autoTimer = setTimeout(function() {
      if (overlay && overlay.classList.contains('mb-voice--open') && state === 'idle') startListening();
    }, 300);
  }

  function stopRec() {
    if (rec) { try { rec.abort(); } catch (e) {} rec = null; }
    if (state === 'listening') setState('idle');
  }

  function textFallback() {
    setState('error');
    if (controller && typeof controller.openTextFallback === 'function') controller.openTextFallback();
    setTimeout(close, 650);
  }

  function startListening() {
    if (state === 'thinking' || state === 'confirming') return;
    if (state === 'listening') { stopRec(); return; }
    stopSpeaking();
    ensureAudioCtx();
    if (!hasSR) { textFallback(); return; }
    setTranscript('');
    setResponse('');
    setState('listening');
    try {
      rec = new SR();
      rec.lang = LANG_TAG[lang] || 'en-US';
      rec.continuous = false;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = function(event) {
        var alt = event.results[0] && event.results[0][0];
        var transcript = (alt && alt.transcript || '').trim();
        var confidence = alt && typeof alt.confidence === 'number' ? alt.confidence : null;
        rec = null;
        if (!transcript) { setState('idle'); return; }
        if (maybeRepairLowConfidence(transcript, confidence)) return;
        var detected = detectLangFromText(transcript);
        // Auto-detect may only UPGRADE from the English default to vi/es. It
        // must never downgrade vi/es -> en, because Web Speech often returns
        // unaccented Vietnamese ("toi muon cat toc") which the diacritic
        // detector misreads as English. The user's explicit UI/URL choice
        // wins; downgrades happen only via the EN button.
        var allowSwitch = detected !== lang && (lang === 'en' || (detected !== 'en' && detected !== lang));
        if (allowSwitch && detected !== 'en') {
          lang = detected;
          if (controller && typeof controller.setLang === 'function') controller.setLang(lang);
          syncLabels();
        }
        setTranscript(transcript);
        setState('thinking');
        Promise.resolve(controller.sendMessage(transcript, { source: 'ai_voice' })).then(function(result) {
          var response = result && result.response ? result.response : '';
          setResponse(response);
          var sessionState = result && result.session && result.session.state;
          var next = result && result.booking ? 'booked' :
            (sessionState && sessionState.pendingAction === 'final_confirmation' ? 'confirming' : 'thinking');
          speakReply(response, next);
        }).catch(function() {
          textFallback();
        });
      };
      rec.onerror = function(event) {
        rec = null;
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') textFallback();
        else setState('idle');
      };
      rec.onend = function() {
        if (state === 'listening') setState('idle');
      };
      rec.start();
    } catch (e) {
      textFallback();
    }
  }

  function setLang(next) {
    if (!LANG_TAG[next]) return;
    if (voiceSession) return;
    lang = next;
    syncLabels();
  }

  function open(nextController) {
    controller = nextController || controller;
    lang = (controller && controller.getLang && controller.getLang()) || lang || 'en';
    if (!overlay) {
      overlay = buildOverlay();
      document.body.appendChild(overlay);
      overlay.querySelector('.mb-voice__mic').addEventListener('click', startListening);
      overlay.querySelector('.mb-voice__close').addEventListener('click', close);
      overlay.querySelector('.mb-voice__text').addEventListener('click', function() {
        if (controller && typeof controller.openTextFallback === 'function') controller.openTextFallback();
        close();
      });
      overlay.querySelectorAll('.mb-voice__langs button').forEach(function(btn) {
        btn.addEventListener('click', function() {
          setLang(btn.getAttribute('data-lang'));
          if (controller && typeof controller.setLang === 'function') controller.setLang(lang);
        });
      });
    }
    syncLabels();
    setTranscript('');
    setResponse('');
    setState('idle');
    overlay.removeAttribute('hidden');
    document.documentElement.classList.add('mb-voice-active');
    ensureAudioCtx();
    requestAnimationFrame(function() {
      overlay.classList.add('mb-voice--open');
      createVoiceSession(lang);
      var welcome = controller && typeof controller.initialPrompt === 'function'
        ? controller.initialPrompt()
        : t('welcome');
      speakReply(welcome, 'thinking');
    });
  }

  function close() {
    clearTimeout(autoTimer);
    stopSpeaking();
    stopRec();
    voiceSession = null;
    voiceTurn = 0;
    voiceHadSuccessfulAudio = false;
    if (overlay) overlay.classList.remove('mb-voice--open');
    document.documentElement.classList.remove('mb-voice-active');
    setState('idle');
  }

  root.MobileBarberVoice = {
    open: open,
    close: close,
    isSupported: function() { return hasSR && hasTTS; },
    _speakViaOpenAi: _speakViaOpenAi,
    _speakViaGemini: _speakViaGemini
  };
})(window);
