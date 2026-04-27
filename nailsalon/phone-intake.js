// nailsalon/phone-intake.js
// Normalizes spoken phone number input (Vietnamese + English word sequences → digit string)
// Used by receptionist.js _mergeState to handle voice-dictated phone numbers.
// v=20260426a

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
    'năm':   '5', 'nam':   '5',
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
    'số': 1, 'so': 1, 'phone': 1, 'number': 1,
    'là': 1, 'la': 1, 'is': 1, 'my': 1, 'the': 1,
  };

  function normalizeSpokenPhoneNumber(text, lang, context) {
    if (!text || typeof text !== 'string') return null;
    var t = text.trim();
    if (!t) return null;

    // Fast path: already digit-dominant (≥ 60% of non-space chars are digits)
    var digitsOnly = t.replace(/\D/g, '');
    var nonSpace   = t.replace(/\s/g, '');
    if (nonSpace.length > 0 && digitsOnly.length / nonSpace.length >= 0.6) {
      if (digitsOnly.length >= 6 && digitsOnly.length <= 11) return digitsOnly;
      return null;
    }

    // Word path: tokenize on whitespace + common separators
    var tokens = t.toLowerCase().split(/[\s,\-\.\/]+/);
    var digits = [];
    for (var i = 0; i < tokens.length; i++) {
      var tok = tokens[i];
      if (!tok) continue;
      if (FILLER[tok]) continue;
      if (/^\d+$/.test(tok)) {
        for (var j = 0; j < tok.length; j++) digits.push(tok[j]);
        continue;
      }
      var mapped = VI_DIGIT_MAP[tok];
      if (mapped !== undefined) {
        digits.push(mapped);
      } else {
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
