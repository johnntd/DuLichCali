'use strict';
/*
 * Mobile Barber Phase 7 voice booking agent.
 * Reuses the DuLichCali voice pattern: SpeechRecognition input and
 * OpenAI TTS -> Gemini TTS -> browser speechSynthesis fallback output.
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
      welcome: 'Hi, I can help request an in-home haircut. Tell me the service, day, time, and address.'
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
      welcome: 'Em có thể giúp gửi yêu cầu cắt tóc tại nhà. Hãy nói dịch vụ, ngày, giờ, và địa chỉ.'
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
      welcome: 'Puedo ayudar a solicitar un corte en casa. Dígame el servicio, día, hora, y dirección.'
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

  function detectLangFromText(text) {
    if (/[\u0102\u0103\u0110\u0111\u01a0\u01a1\u01af\u01b0\u1ea0-\u1ef9]/.test(text || '')) return 'vi';
    if (/[\u00f1\u00d1\u00bf\u00a1]/.test(text || '') ||
        /\b(hola|quiero|cu[aá]ndo|gracias|reservar|cita|por favor|barbero)\b/i.test(text || '')) return 'es';
    return 'en';
  }

  function ensureAudioCtx() {
    try {
      if (!audioCtx || audioCtx.state === 'closed') audioCtx = new (root.AudioContext || root.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(function() {});
    } catch (e) {}
    return audioCtx;
  }

  function getOpenAiKey() {
    var key = controller && (controller.openAiKey || controller.platformOpenAiKey || controller.firestoreOpenAiKey);
    if (!key) { try { key = root.localStorage.getItem('dlc_openai_key') || ''; } catch (e) {} }
    return key || '';
  }

  function getGeminiKey() {
    var key = controller && (controller.geminiKey || controller.platformGeminiKey || controller.firestoreGeminiKey);
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
    if (!hasTTS) { afterSpeech(false); return; }
    var utter = new SpeechSynthesisUtterance(text);
    utter.lang = LANG_TAG[lang] || 'en-US';
    utter.rate = 0.92;
    utter.pitch = 1;
    var voice = pickVoice(utter.lang);
    if (voice) utter.voice = voice;
    utter.onend = function() { afterSpeech(true); };
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

  function _speakViaOpenAi(text, onDone) {
    var key = getOpenAiKey();
    var ctx = ensureAudioCtx();
    if (!key || !ctx) { onDone(false); return; }
    fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'tts-1', input: text, voice: 'nova', response_format: 'mp3' })
    })
    .then(function(resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.arrayBuffer();
    })
    .then(function(buf) {
      return new Promise(function(resolve, reject) { ctx.decodeAudioData(buf, resolve, reject); });
    })
    .then(function(decoded) {
      if (state !== 'confirming' && state !== 'booked' && state !== 'thinking') return;
      var src = ctx.createBufferSource();
      src.buffer = decoded;
      src.connect(ctx.destination);
      currentSource = src;
      src.onended = function() { currentSource = null; onDone(true); afterSpeech(true); };
      src.start();
    })
    .catch(function() { currentSource = null; onDone(false); });
  }

  function _speakViaGemini(text, onDone) {
    var key = getGeminiKey();
    var ctx = ensureAudioCtx();
    if (!key || !ctx) { onDone(false); return; }
    fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: lang === 'en' ? 'Sulafat' : 'Aoede' } } }
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
      var raw = atob(part.inlineData.data);
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
      src.onended = function() { currentSource = null; onDone(true); afterSpeech(true); };
      src.start();
    })
    .catch(function() { currentSource = null; onDone(false); });
  }

  function speakReply(text, nextState) {
    var spoken = truncateForTts(cleanForTts(text));
    if (!spoken) { afterSpeech(false); return; }
    stopSpeaking();
    setState(nextState || 'thinking');
    _speakViaOpenAi(spoken, function(okOpenAi) {
      if (!okOpenAi && (state === 'confirming' || state === 'booked' || state === 'thinking')) {
        _speakViaGemini(spoken, function(okGemini) {
          if (!okGemini && (state === 'confirming' || state === 'booked' || state === 'thinking')) speakViaBrowser(spoken);
        });
      }
    });
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
        var transcript = (event.results[0] && event.results[0][0].transcript || '').trim();
        rec = null;
        if (!transcript) { setState('idle'); return; }
        var detected = detectLangFromText(transcript);
        if (detected !== lang) {
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
    requestAnimationFrame(function() { overlay.classList.add('mb-voice--open'); });
    document.documentElement.classList.add('mb-voice-active');
    ensureAudioCtx();
    speakReply(t('welcome'), 'thinking');
  }

  function close() {
    clearTimeout(autoTimer);
    stopSpeaking();
    stopRec();
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
