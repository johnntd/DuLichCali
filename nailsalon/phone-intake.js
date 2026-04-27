// nailsalon/phone-intake.js
// Normalizes spoken phone number input (Vietnamese + English word sequences → digit string)
// Used by receptionist.js runtime intake and _mergeState to handle voice-dictated phone numbers.
// v=20260427b

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.PhoneIntake = factory();
  }
}(typeof window !== 'undefined' ? window : this, function () {

  var VI_DIGIT_MAP = {
    // Vietnamese
    'không': '0', 'khong': '0',
    'một':   '1', 'mot':   '1',
    'hai':   '2',
    'ba':    '3',
    'bốn':   '4', 'bon':   '4', 'bọn': '4',
    'năm':   '5', 'nam':   '5', 'lăm': '5', 'lam': '5',
    'sáu':   '6', 'sau':   '6',
    'bảy':   '7', 'bay':   '7',
    'tám':   '8', 'tam':   '8',
    'chín':  '9', 'chin':  '9',
    // English
    'zero':  '0', 'oh':    '0', 'o':    '0',
    'one':   '1',
    'two':   '2',
    'three': '3',
    'four':  '4',
    'five':  '5',
    'six':   '6',
    'seven': '7',
    'eight': '8',
    'nine':  '9',
  };

  var FILLER = {
    'à': 1, 'a': 1, 'ạ': 1, 'cũng': 1, 'cung': 1,
    'số': 1, 'so': 1, 'điện': 1, 'dien': 1, 'thoại': 1, 'thoai': 1,
    'phone': 1, 'number': 1,
    'là': 1, 'la': 1, 'is': 1, 'my': 1, 'the': 1,
    'của': 1, 'cua': 1, 'mình': 1, 'minh': 1, 'em': 1, 'tôi': 1, 'toi': 1,
  };

  function normalizeSpokenPhoneNumber(text, lang, context) {
    if (!text || typeof text !== 'string') return null;
    var t = text.trim();
    if (!t) return null;

    // Fast path: already numeric. Do not use digit-dominance for mixed speech
    // like "4084 397 năm 22"; word tokens in phone context must be normalized
    // before length checks, especially Vietnamese "năm"/"lăm" = digit 5.
    var digitsOnly = t.replace(/\D/g, '');
    if (!/[A-Za-zÀ-ỹ]/.test(t)) {
      if (digitsOnly.length >= 6 && digitsOnly.length <= 11) return digitsOnly;
      return null;
    }

    // Word path: tokenize on whitespace + common separators
    var tokens = t.toLowerCase().split(/[\s,\-\.\/]+/);
    var digits = [];
    var sawPhoneSignal = false;
    for (var i = 0; i < tokens.length; i++) {
      var tok = tokens[i].replace(/^[^0-9A-Za-zÀ-ỹ]+|[^0-9A-Za-zÀ-ỹ]+$/g, '');
      if (!tok) continue;
      if (FILLER[tok]) { sawPhoneSignal = true; continue; }
      if (/^\d+$/.test(tok)) {
        for (var j = 0; j < tok.length; j++) digits.push(tok[j]);
        continue;
      }
      var mapped = VI_DIGIT_MAP[tok];
      if (mapped !== undefined) {
        digits.push(mapped);
      } else {
        // In runtime speech transcripts, polite lead-ins often survive
        // tokenization. Ignore unknown words only when the utterance has a
        // phone cue or we have already started collecting digits.
        if (sawPhoneSignal || digits.length > 0) continue;
        return null;
      }
    }

    var result = digits.join('');
    if (result.length >= 6 && result.length <= 11) return result;
    return null;
  }

  return {
    normalizeSpokenPhoneNumber: normalizeSpokenPhoneNumber,
    VI_DIGIT_MAP: VI_DIGIT_MAP,
  };
}));
