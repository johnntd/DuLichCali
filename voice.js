/**
 * Du Lịch Cali — Voice Input Module
 * Bilingual: vi-VN recognises both Vietnamese words and English in same utterance.
 * Uses Web Speech API (SpeechRecognition / webkitSpeechRecognition).
 */

const DLCVoice = (() => {
  'use strict';

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const isSupported = !!SR;

  let recognition  = null;
  let _state       = 'idle';   // idle | listening | processing | error
  let _onTranscript = null;

  function _setState(s) {
    _state = s;
    const btn = document.getElementById('chatMicBtn');
    if (!btn) return;
    btn.dataset.state = s;
    const labels = {
      idle:       'Nhấn để nói',
      listening:  'Đang nghe... nhấn để dừng',
      processing: 'Đang xử lý...',
      error:      'Lỗi microphone',
    };
    btn.setAttribute('aria-label', labels[s] || 'Nhấn để nói');
  }

  /**
   * @param {function(string): void} onTranscript  Called with recognized text.
   * @returns {boolean} true if Web Speech API is supported.
   */
  function init(onTranscript) {
    _onTranscript = onTranscript;
    if (!isSupported) return false;

    recognition = new SR();
    recognition.continuous      = false;
    recognition.interimResults  = false;
    recognition.maxAlternatives = 1;
    // vi-VN handles both Vietnamese and English (Latin script) in the same utterance
    recognition.lang = 'vi-VN';

    recognition.onresult = (e) => {
      const text = e.results[0][0].transcript.trim();
      _setState('processing');
      if (_onTranscript && text) _onTranscript(text);
      setTimeout(() => _setState('idle'), 600);
    };

    recognition.onerror = (e) => {
      const silent = ['no-speech', 'aborted'];
      if (!silent.includes(e.error)) console.warn('[DLC Voice]', e.error);
      _setState('error');
      setTimeout(() => _setState('idle'), 1800);
    };

    recognition.onend = () => {
      if (_state === 'listening') _setState('idle');
    };

    return true;
  }

  function toggleListen() {
    if (!isSupported) {
      const hint = document.getElementById('voiceHint');
      if (hint) {
        hint.textContent = 'Trình duyệt không hỗ trợ giọng nói. Dùng Chrome hoặc Edge.';
        hint.style.display = '';
        setTimeout(() => { hint.style.display = 'none'; }, 4000);
      }
      return;
    }
    if (!recognition) init(_onTranscript);

    if (_state === 'listening') {
      recognition.stop();
      _setState('idle');
    } else {
      try {
        recognition.start();
        _setState('listening');
      } catch (err) {
        // DOMException if recognition already started
        _setState('error');
        setTimeout(() => _setState('idle'), 1000);
      }
    }
  }

  return {
    init,
    toggleListen,
    get isSupported() { return isSupported; },
    get state()       { return _state; },
  };
})();
