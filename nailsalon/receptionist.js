// Lily Receptionist v2.0 — Intelligent AI receptionist for Luxurious Nails & Spa
// Voice-ready: LilyReceptionist.handleMessage(biz, text, apiKey) → Promise<{text, escalationType}>
// Languages: English + Spanish + Vietnamese (Claude-detected, not just regex)
// Features: intent classification, entity extraction, booking state machine, multi-service
(function () {
  'use strict';

  var MODEL       = 'claude-sonnet-4-6';
  var MAX_TOKENS  = 900;   // increased: response + STATE marker JSON
  var HISTORY_CAP = 20;
  var API_URL     = 'https://api.anthropic.com/v1/messages';
  var DAYS        = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

  // ── Language detection (fast client-side hint — Claude overrides via STATE) ──
  function _detectLang(text) {
    // Vietnamese: tonal diacritics OR common Vietnamese words
    if (/[ắặầấậẻẽẹềếệỉịọốồổỗộởờớợụừứựỳỵăơưđ]/.test(text) ||
        /\b(mình|tôi|bạn|muốn|đặt lịch|làm móng|tiệm|dịch vụ|hôm nay|ngày mai|bao nhiêu|cảm ơn|xin chào|được không|cho tôi|cho mình|nhé|nha|vậy|ơi|thứ|tuần|lịch hẹn)\b/i.test(text)) {
      return 'vi';
    }
    if (/\b(hola|cuánto|cuanto|cómo|qué|cuando|tiene|tengo|quisiera|quiero|gracias|buenos|precio|cita|disponible|puedo|podría|servicios|uñas)\b/i.test(text)) {
      return 'es';
    }
    return 'en';
  }

  // ── Booking state machine ─────────────────────────────────────────────────────
  function _emptyState() {
    return { intent: null, services: [], staff: null, date: null, time: null, name: null, phone: null, lang: null };
  }

  function _saveBookingState(biz) {
    try { sessionStorage.setItem('lily_s_' + biz.id, JSON.stringify(biz._bookingState)); } catch (e) {}
  }

  function _restoreBookingState(biz) {
    if (biz._bookingState) return;
    try {
      var raw = sessionStorage.getItem('lily_s_' + biz.id);
      if (raw) { biz._bookingState = JSON.parse(raw); return; }
    } catch (e) {}
    biz._bookingState = _emptyState();
  }

  // Merge Claude's extracted STATE into current booking state
  function _mergeState(biz, update) {
    if (!biz._bookingState) biz._bookingState = _emptyState();
    // Take all fields from Claude's STATE (Claude is responsible for carrying forward known values)
    Object.keys(update).forEach(function (k) {
      biz._bookingState[k] = update[k];
    });
  }

  // Build human-readable booking state context for the system prompt
  function _buildBookingStateContext(biz) {
    var s = biz._bookingState || {};
    var hasData = (s.services && s.services.length) || s.staff || s.date || s.time || s.name || s.phone;
    if (!hasData) return '';
    var lines = ['=== CURRENT BOOKING STATE (already collected — do NOT ask for these again) ==='];
    lines.push('Services: ' + ((s.services && s.services.length) ? s.services.join(', ') : 'not yet specified'));
    lines.push('Staff: '    + (s.staff || 'not yet specified'));
    lines.push('Date: '     + (s.date  || 'not yet specified'));
    lines.push('Time: '     + (s.time  || 'not yet specified'));
    lines.push('Customer name: '  + (s.name  || 'not yet specified'));
    lines.push('Customer phone: ' + (s.phone || 'not yet specified'));
    return lines.join('\n');
  }

  // ── Marker parsing ────────────────────────────────────────────────────────────
  function _parseEscalationType(reply) {
    var m = reply.match(/\[ESCALATE:(order|appointment|reservation|question)\]/i);
    return m ? m[1].toLowerCase() : null;
  }

  function _parseBookingMarker(reply) {
    try {
      var m = reply.match(/\[BOOKING:(\{[^}]+\})\]/);
      if (!m) return null;
      return JSON.parse(m[1]);
    } catch (e) { return null; }
  }

  // STATE marker contains arrays: find "[STATE:{" then first "}]" after it
  function _parseStateMarker(reply) {
    try {
      var idx = reply.lastIndexOf('[STATE:{');
      if (idx < 0) return null;
      var end = reply.indexOf('}]', idx + 8);
      if (end < 0) return null;
      return JSON.parse(reply.slice(idx + 7, end + 1));
    } catch (e) { return null; }
  }

  // Strip all machine markers from displayed text
  function _stripAllMarkers(reply) {
    // Strip STATE (must go first — it contains }] which could confuse other strips)
    var idx = reply.lastIndexOf('[STATE:{');
    if (idx >= 0) {
      var end = reply.indexOf('}]', idx + 8);
      if (end >= 0) reply = reply.slice(0, idx) + reply.slice(end + 2);
    }
    reply = reply.replace(/\s*\[BOOKING:\{[^}]+\}\]/gi, '');
    reply = reply.replace(/\s*\[ESCALATE:[^\]]+\]/gi, '');
    return reply.trim();
  }

  // ── System prompt builder ─────────────────────────────────────────────────────
  function _buildPrompt(biz, langHint) {
    var today     = new Date();
    var todayIdx  = today.getDay();
    var todayName = DAYS[todayIdx];
    var dateStr   = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    var isoDate   = today.toISOString().slice(0, 10);

    var receptionistName = (biz.aiReceptionist && biz.aiReceptionist.name) || 'Lily';
    var salonName = biz.name || 'Luxurious Nails & Spa';
    var phone     = biz.phoneDisplay || biz.phone || '408-859-6718';
    var address   = biz.address || 'Bay Area, California';

    // Services block
    var services = biz.services || [];
    var shown = services.filter(function (s) { return s.active !== false; });
    if (shown.length === 0) shown = services.slice(0, 30);
    var servicesBlock = shown.length > 0
      ? shown.map(function (s) {
          var line = '• ' + s.name;
          if (s.price)    line += ' — $' + s.price;
          if (s.duration) line += ' (' + s.duration + ' min)';
          if (s.description) line += ': ' + s.description;
          return line;
        }).join('\n')
      : '(Service list not yet loaded — tell customer to call ' + phone + ' for menu.)';

    // Hours block
    var daysOrder = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
    var hoursBlock;
    if (biz.hours) {
      hoursBlock = daysOrder.map(function (d) {
        var h = biz.hours[d];
        var label = d.charAt(0).toUpperCase() + d.slice(1);
        var marker = (d === todayName) ? ' ← TODAY' : '';
        if (!h || !h.open) return label + ': Closed' + marker;
        return label + ': ' + h.open + ' – ' + h.close + marker;
      }).join('\n');
    } else {
      hoursBlock = 'Mon–Fri 9:30 am–7:30 pm\nSat 9:30 am–7:00 pm\nSun 10:00 am–6:00 pm\n(TODAY is ' + todayName + ')';
    }

    // Staff block
    var activeStaff = (biz.staff || []).filter(function (m) { return m.active !== false; });
    var staffBlock;
    if (activeStaff.length > 0) {
      staffBlock = activeStaff.map(function (m) {
        var header = '• ' + m.name + (m.title ? ' (' + m.title + ')' : '');
        var lines  = [header];
        if (m.schedule) {
          daysOrder.forEach(function (d) {
            var s = m.schedule[d];
            var label = d.charAt(0).toUpperCase() + d.slice(1);
            var marker = (d === todayName) ? ' ← TODAY' : '';
            if (!s || !s.open) lines.push('    ' + label + ': OFF' + marker);
            else lines.push('    ' + label + ': ' + s.open + ' – ' + s.close + marker);
          });
        }
        if (m.specialties) {
          var sp = Array.isArray(m.specialties) ? m.specialties.join(', ') : m.specialties;
          lines.push('    Specialties: ' + sp);
        }
        return lines.join('\n');
      }).join('\n');
    } else {
      staffBlock = '(Staff data not yet loaded — tell customer to call ' + phone + ' for scheduling.)';
    }

    // Active context for pronoun resolution
    var selectedStaffCtx = '';
    if (biz._selectedStaff) {
      selectedStaffCtx = '\n=== ACTIVE CONTEXT ===\nCustomer has been referring to: ' + biz._selectedStaff.name + '. Pronouns "her/him/she/he/the technician" mean ' + biz._selectedStaff.name + '. Use this name directly.';
    }

    // Booking state context (only shown when data has been collected)
    var bookingStateCtx = _buildBookingStateContext(biz);

    return [
      'You are ' + receptionistName + ', the professional AI receptionist for ' + salonName + '.',
      'Today is ' + dateStr + ' (ISO date: ' + isoDate + ').',
      '',
      '=== FORMAT RULE — CRITICAL ===',
      'Write in plain conversational text ONLY. No markdown whatsoever.',
      'No **, no ##, no bullet dashes, no "Label: Value" pairs.',
      'WRONG: "**Service:** Gel Nails\\n**Staff:** Tracy"',
      'RIGHT: "I have you down for Gel Nails with Tracy on Friday at 2 PM."',
      '',
      '=== LANGUAGE ===',
      'Detect the customer language from their message and respond ENTIRELY in that same language.',
      'English (en): default. American customers at a Bay Area salon.',
      'Spanish (es): customer uses Spanish words — "¿Cuánto cuesta?", "quiero", "hola", "cita".',
      'Vietnamese (vi): customer uses Vietnamese — "mình", "tôi", "muốn", "đặt lịch", "làm móng",',
      '  "ngày mai", "giá", "cảm ơn", or characters with tonal marks (ắ ặ ầ ề ộ ở ứ ừ đ ă ơ ư).',
      'Never mix languages. Match the customer completely.',
      '',
      '=== SALON INFO ===',
      'Name: ' + salonName,
      'Phone: ' + phone,
      'Address: ' + address,
      '',
      '=== HOURS (live) ===',
      hoursBlock,
      '',
      '=== SERVICES & PRICING (live) ===',
      servicesBlock,
      '',
      '=== STAFF SCHEDULES (recurring weekly — same every week) ===',
      'For "next week" or any future date: look up the matching day-of-week below. The schedule repeats weekly.',
      staffBlock,
      selectedStaffCtx,
      '',
      bookingStateCtx,
      '',
      '=== NAIL KNOWLEDGE ===',
      'Terms: gel, acrylic, dip powder, regular polish, manicure, pedicure, nail art, fill, removal.',
      'Fills typically every 2–3 weeks. Removal takes extra time — mention it when relevant.',
      '',
      '=== YOUR RULES ===',
      '1. Answer naturally — you are a real receptionist, not a scripted bot.',
      '2. Never re-introduce yourself mid-conversation. No "Hi, I\'m Lily" after the first message.',
      '3. Use ONLY the data above. Never invent prices, hours, or staff availability.',
      '4. Responses: 1–3 sentences for simple questions. Plain text always.',
      '5. Walk-ins: "Walk-ins welcome based on availability — we recommend calling ahead."',
      '6. Unknown prices: "Prices vary — please call ' + phone + ' for an exact quote."',
      '7. Pronouns her/him/she/he → most recently named technician. See ACTIVE CONTEXT above.',
      '8. Farewell (goodbye/bye/thanks/done) → 1 warm sentence only. Do NOT re-introduce yourself.',
      '',
      '=== INTENT CLASSIFICATION ===',
      'Classify each message as one of:',
      '  booking_request     — customer wants to make an appointment',
      '  service_question    — asking about what services are available',
      '  price_question      — asking about pricing',
      '  staff_availability  — asking about when a specific technician works',
      '  hours_location      — asking about hours or address',
      '  farewell            — goodbye, thanks, done',
      '  general             — anything else',
      '',
      '=== ENTITY EXTRACTION ===',
      'From each message, extract:',
      '  services  — ALL services mentioned. Support MULTIPLE in one message.',
      '              "gel and pedicure" → ["Gel Nails","Pedicure"]',
      '              "mani pedi" → ["Manicure","Pedicure"]',
      '              "làm móng tay" → ["Manicure"]',
      '  staff     — technician name, or null if none mentioned',
      '  date      — as stated ("tomorrow", "next Monday", "April 10") or null',
      '  time      — convert to 24h if clear ("2pm" → "14:00", "2:30 chiều" → "14:30") or null',
      '  lang      — "en", "es", or "vi" based on THIS message',
      '',
      '=== BOOKING FLOW ===',
      'When intent = booking_request:',
      '  A. Use entities from current message PLUS any already in CURRENT BOOKING STATE above.',
      '     Do NOT ask for fields already collected.',
      '  B. Identify the first MISSING required field in this order:',
      '     service(s) → date → time → customer name → customer phone',
      '     Staff is optional — "any available" is fine if customer does not specify.',
      '  C. Ask for exactly ONE missing field at a time. Be natural ("What day works for you?"',
      '     not "Please provide your preferred date.").',
      '  D. When ALL required fields are collected (service, date, time, name, phone):',
      '     Write ONE plain sentence confirmation. Then on new lines:',
      '     [BOOKING:{"service":"<comma-separated if multiple>","staff":"<name or Any>","date":"YYYY-MM-DD","time":"HH:MM","name":"<name>","phone":"<phone>"}]',
      '     [ESCALATE:appointment]',
      '     Convert relative dates to ISO using today (' + isoDate + ') as reference.',
      '     "tomorrow" → ' + (function() { var d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); })(),
      '     "next Monday" → calculate from today.',
      '',
      '=== STATE MARKER — REQUIRED ON EVERY REPLY ===',
      'Append this at the very end of EVERY reply (after all text and any other markers):',
      '[STATE:{"intent":"<intent>","services":[<array>],"staff":<null or "Name">,"date":<null or "date">,"time":<null or "HH:MM">,"name":<null or "Name">,"phone":<null or "phone">,"lang":"<en|es|vi>"}]',
      '',
      'STATE rules:',
      '  - Merge with CURRENT BOOKING STATE above — carry forward non-null fields.',
      '  - services: always an array. Empty [] if none mentioned.',
      '  - All non-array fields: null (JSON null, no quotes) if unknown.',
      '  - lang: detected language of THIS customer message.',
      '',
      'STATE examples:',
      '"Gel manicure and pedicure tomorrow with Tracy":',
      '[STATE:{"intent":"booking_request","services":["Gel Manicure","Pedicure"],"staff":"Tracy","date":"tomorrow","time":null,"name":null,"phone":null,"lang":"en"}]',
      '',
      '"Mình muốn đặt lịch làm móng gel ngày mai lúc 2 giờ":',
      '[STATE:{"intent":"booking_request","services":["Gel Nails"],"staff":null,"date":"tomorrow","time":"14:00","name":null,"phone":null,"lang":"vi"}]',
      '',
      '"¿Cuánto cuesta gel manicure?":',
      '[STATE:{"intent":"price_question","services":["Gel Manicure"],"staff":null,"date":null,"time":null,"name":null,"phone":null,"lang":"es"}]',
    ].join('\n');
  }

  // ── Fallback (no API key) ─────────────────────────────────────────────────────
  function _fallback(biz, text) {
    var phone = biz.phoneDisplay || biz.phone || '408-859-6718';
    var name  = biz.name || 'Luxurious Nails & Spa';
    var t     = text.toLowerCase();
    var lang  = _detectLang(text);

    if (lang === 'vi') {
      if (/giờ|mở|đóng|lịch làm việc/.test(t)) return 'Chúng tôi mở cửa Thứ 2–6: 9:30–19:30, Thứ 7: 9:30–19:00, Chủ nhật: 10:00–18:00. Gọi ' + phone + ' để đặt lịch nhé!';
      if (/giá|bao nhiêu|chi phí/.test(t))      return 'Giá dịch vụ tuỳ loại. Vui lòng gọi ' + phone + ' để biết giá chính xác nhé!';
      if (/đặt|lịch|hẹn|book/.test(t))           return 'Để đặt lịch, bạn gọi ' + phone + ' nhé. Chúng tôi sẽ sắp xếp thời gian phù hợp cho bạn!';
      return 'Cảm ơn bạn đã liên hệ ' + name + '! Vui lòng gọi ' + phone + ' để được hỗ trợ ngay.';
    }

    if (lang === 'es') {
      if (/hora|horario|abre|cierra/.test(t)) return 'Nuestro horario: Lun–Vie 9:30am–7:30pm, Sáb 9:30am–7pm, Dom 10am–6pm. Llame al ' + phone + '.';
      if (/precio|costo|cuánto/.test(t))      return 'Los precios varían según el servicio. Llame al ' + phone + ' para un presupuesto exacto.';
      if (/cita|reserva|agendar/.test(t))     return 'Para agendar una cita llame al ' + phone + '. ¡Le encontraremos el horario perfecto!';
      return '¡Gracias por contactar a ' + name + '! Para asistencia inmediata llame al ' + phone + '.';
    }

    // English
    if (/hour|open|close|schedule/.test(t))  return 'We are open Mon–Fri 9:30am–7:30pm, Sat 9:30am–7pm, Sun 10am–6pm. Call ' + phone + ' to confirm availability.';
    if (/walk.?in/.test(t))                  return 'Walk-ins welcome based on availability! Call ' + phone + ' to check wait times.';
    if (/price|cost|how much/.test(t))       return 'Prices vary by service. Call us at ' + phone + ' or ask about a specific service.';
    if (/book|appoint|schedule|reserv/.test(t)) return 'To book an appointment, please call ' + phone + '. We\'ll find the perfect time!';
    if (/staff|technician|helen|tracy/.test(t)) return 'Our technicians are experienced professionals. Call ' + phone + ' to be matched with the right person.';
    return 'Thank you for contacting ' + name + '! For immediate help please call ' + phone + '.';
  }

  // ── History persistence ───────────────────────────────────────────────────────
  function _saveHistory(biz) {
    try { sessionStorage.setItem('lily_h_' + biz.id, JSON.stringify(biz._aiHistory)); } catch (e) {}
  }

  function _restoreHistory(biz) {
    if (biz._aiHistory && biz._aiHistory.length > 0) return;
    try {
      var raw = sessionStorage.getItem('lily_h_' + biz.id);
      if (raw) biz._aiHistory = JSON.parse(raw);
    } catch (e) {}
  }

  // ── Core message handler (voice-ready — no DOM access) ───────────────────────
  function _handleMessage(biz, text, apiKey) {
    _restoreHistory(biz);
    _restoreBookingState(biz);

    if (!biz._aiHistory) biz._aiHistory = [];
    biz._aiHistory.push({ role: 'user', content: text });
    if (biz._aiHistory.length > HISTORY_CAP) {
      biz._aiHistory = biz._aiHistory.slice(-HISTORY_CAP);
    }

    // Client-side language hint — Claude confirms/overrides via STATE
    var detectedLang = _detectLang(text);
    if (detectedLang !== 'en' && biz._bookingState && !biz._bookingState.lang) {
      biz._bookingState.lang = detectedLang;
    }

    // Track named staff for pronoun resolution
    (biz.staff || []).forEach(function (m) {
      if (m.active !== false && new RegExp('\\b' + m.name + '\\b', 'i').test(text)) {
        biz._selectedStaff = m;
      }
    });

    var lang = (biz._bookingState && biz._bookingState.lang) || detectedLang || 'en';

    if (!apiKey) {
      return new Promise(function (resolve) {
        setTimeout(function () {
          var reply = _fallback(biz, text);
          biz._aiHistory.push({ role: 'assistant', content: reply });
          _saveHistory(biz);
          resolve({ text: reply, escalationType: null });
        }, 600);
      });
    }

    var systemPrompt = _buildPrompt(biz, lang);

    return fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':     'application/json',
        'x-api-key':        apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: MAX_TOKENS,
        system:     systemPrompt,
        messages:   biz._aiHistory.map(function (m) {
          return { role: m.role, content: m.content };
        })
      })
    })
    .then(function (res) {
      if (!res.ok) {
        return res.text().then(function (body) {
          throw new Error('API ' + res.status + ': ' + body.slice(0, 120));
        });
      }
      return res.json();
    })
    .then(function (data) {
      var raw = (data.content && data.content[0] && data.content[0].text) || '';

      // 1. Parse and merge STATE marker
      var stateUpdate = _parseStateMarker(raw);
      if (stateUpdate) {
        _mergeState(biz, stateUpdate);
        // Sync selected staff from STATE
        if (stateUpdate.staff && biz.staff) {
          biz.staff.forEach(function (m) {
            if (m.active !== false && m.name.toLowerCase() === stateUpdate.staff.toLowerCase()) {
              biz._selectedStaff = m;
            }
          });
        }
        _saveBookingState(biz);
      }

      // 2. Parse BOOKING marker
      var bookingData = _parseBookingMarker(raw);
      if (bookingData) biz._bookingDraft = bookingData;

      // 3. Parse ESCALATE marker
      var escalationType = _parseEscalationType(raw);

      // 4. Reset state after booking is sent to vendor
      if (escalationType === 'appointment') {
        biz._bookingState = _emptyState();
        _saveBookingState(biz);
      }

      // 5. Strip all markers from displayed text
      var clean = _stripAllMarkers(raw);

      biz._aiHistory.push({ role: 'assistant', content: clean });
      _saveHistory(biz);

      return { text: clean, escalationType: escalationType };
    });
  }

  // ── DOM helpers ───────────────────────────────────────────────────────────────
  function _appendMessage(messagesEl, text, who) {
    var div    = document.createElement('div');
    div.className = 'mp-ai__msg mp-ai__msg--' + who;
    var bubble = document.createElement('div');
    bubble.className = 'mp-ai__bubble';
    bubble.textContent = text;
    div.appendChild(bubble);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function _showTyping(messagesEl, id) {
    var div = document.createElement('div');
    div.id  = id;
    div.className = 'mp-ai__msg mp-ai__msg--bot';
    div.innerHTML = '<div class="mp-ai__bubble mp-ai__bubble--typing"><span></span><span></span><span></span></div>';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function _hideTyping(id) {
    var el = document.getElementById(id);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  // ── Public API ────────────────────────────────────────────────────────────────
  window.LilyReceptionist = {

    // Voice-ready: no DOM access, returns Promise<{text, escalationType}>
    handleMessage: _handleMessage,

    // Inspectable prompt builder for debugging / voice gateway
    buildPrompt: _buildPrompt,

    // DOM binding — same interface as Receptionist.init in marketplace.js
    init: function (biz, containerId) {
      var container  = document.getElementById(containerId);
      if (!container) return;

      var input      = container.querySelector('.mp-ai__input');
      var sendBtn    = container.querySelector('.mp-ai__send');
      var chips      = container.querySelectorAll('.mp-ai__chip');
      var messagesEl = container.querySelector('.mp-ai__messages');

      if (!input || !sendBtn || !messagesEl) return;

      function send(text) {
        if (!text) return;
        _appendMessage(messagesEl, text, 'user');
        var typingId = 'lily_t_' + Date.now();
        _showTyping(messagesEl, typingId);

        var apiKey = null;
        try { apiKey = localStorage.getItem('dlc_claude_key'); } catch (e) {}

        _handleMessage(biz, text, apiKey)
          .then(function (result) {
            _hideTyping(typingId);
            _appendMessage(messagesEl, result.text, 'bot');
            if (result.escalationType) {
              var esc = window.EscalationEngine;
              if (esc && typeof esc.create === 'function') {
                esc.create(biz, messagesEl, result.escalationType, biz._bookingDraft || null);
              }
            }
          })
          .catch(function (err) {
            _hideTyping(typingId);
            console.warn('[LilyReceptionist] API error, using fallback:', err.message || err);
            var fallbackText = _fallback(biz, text);
            biz._aiHistory.push({ role: 'assistant', content: fallbackText });
            _saveHistory(biz);
            _appendMessage(messagesEl, fallbackText, 'bot');
          });
      }

      sendBtn.addEventListener('click', function () {
        var text = input.value.trim();
        if (!text) return;
        input.value = '';
        send(text);
      });

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          var text = input.value.trim();
          if (!text) return;
          input.value = '';
          send(text);
        }
      });

      chips.forEach(function (chip) {
        chip.addEventListener('click', function () {
          send(chip.textContent.trim());
        });
      });
    }
  };

})();
