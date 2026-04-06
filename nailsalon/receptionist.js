// Lily Receptionist — dedicated AI receptionist for Luxurious Nails & Spa
// Voice-ready: LilyReceptionist.handleMessage(biz, text, apiKey) → Promise<{text, escalationType}>
// Language: English + Spanish (auto-detect, session-persistent)
// Live data: reads from biz.services, biz.staff, biz.hours populated by Firestore
(function () {
  'use strict';

  var MODEL      = 'claude-sonnet-4-6';
  var MAX_TOKENS = 600;
  var HISTORY_CAP = 20;
  var API_URL    = 'https://api.anthropic.com/v1/messages';
  var DAYS       = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

  // ── Language detection ────────────────────────────────────────────────────────
  function _detectLang(text) {
    var esPattern = /\b(hola|cuánto|cuanto|cómo|como esta|qué|que servicios|cuando|cuándo|tiene|tengo|quisiera|quiero|gracias|buenos|buenas|precio|precios|horario|cita|disponible|está|hay|puedo|podría|podria|hablan|español|servicios|técnico|manicure en|pedicure en|uñas)\b/i;
    return esPattern.test(text) ? 'es' : 'en';
  }

  // ── System prompt builder (pure — no DOM access) ──────────────────────────────
  function _buildPrompt(biz, lang) {
    var today    = new Date();
    var todayIdx = today.getDay();
    var todayName = DAYS[todayIdx];
    var dateStr  = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    var receptionistName = (biz.aiReceptionist && biz.aiReceptionist.name) || 'Lily';
    var salonName = biz.name || 'Luxurious Nails & Spa';
    var phone     = biz.phoneDisplay || biz.phone || '408-859-6718';
    var address   = biz.address || 'Bay Area, California';

    // Services block — prefer active services from live Firestore data
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

    // Hours block — from live biz.hours
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

    // Staff block — from live biz.staff
    var staffBlock;
    var activeStaff = (biz.staff || []).filter(function (m) { return m.active !== false; });
    if (activeStaff.length > 0) {
      staffBlock = activeStaff.map(function (m) {
        var header = '• ' + m.name + (m.title ? ' (' + m.title + ')' : '');
        var lines  = [header];
        if (m.schedule) {
          daysOrder.forEach(function (d) {
            var s = m.schedule[d];
            var label = d.charAt(0).toUpperCase() + d.slice(1);
            var marker = (d === todayName) ? ' ← TODAY' : '';
            if (!s || !s.open) {
              lines.push('    ' + label + ': OFF' + marker);
            } else {
              lines.push('    ' + label + ': ' + s.open + ' – ' + s.close + marker);
            }
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

    var langInstruction = lang === 'es'
      ? 'CRITICAL: The customer is speaking Spanish. You MUST reply entirely in Spanish. Be warm and professional.'
      : 'Reply in English. Be warm, concise, and professional.';

    return [
      'You are ' + receptionistName + ', the professional AI receptionist for ' + salonName + '.',
      'Today is ' + dateStr + '.',
      '',
      langInstruction,
      '',
      '=== SALON INFO ===',
      'Name: ' + salonName,
      'Phone: ' + phone,
      'Address: ' + address,
      '',
      '=== HOURS (live) ===',
      hoursBlock,
      '',
      '=== SERVICES & PRICING (live from Firestore) ===',
      servicesBlock,
      '',
      '=== NAIL TECHNICIANS (live from Firestore) ===',
      staffBlock,
      '',
      '=== NAIL KNOWLEDGE ===',
      'Common nail terms: gel, acrylic, dip powder, regular polish, manicure, pedicure, nail art, fill, removal.',
      'Gel/acrylic fills typically every 2-3 weeks. Removal takes extra time — mention it when asked.',
      'Allergy/sensitivity? Recommend calling ' + phone + ' to discuss options.',
      '',
      '=== YOUR RULES ===',
      '1. You are a professional receptionist — answer naturally like a real person, not a chatbot.',
      '2. Use ONLY the information above. Do NOT invent prices, hours, or staff schedules.',
      '3. If data shows "(not yet loaded)" — tell customer to call ' + phone + ' for that info.',
      '4. Keep responses to 2-4 sentences. No bullet lists unless listing services was explicitly requested.',
      '5. Plain text only — no markdown, no **, no #, no dashes as bullet points.',
      '6. Walk-ins: "Walk-ins are welcome based on availability — calling ahead is recommended."',
      '7. For services/prices not in the list: "Prices vary — please call ' + phone + ' for an exact quote."',
      '8. Pronoun resolution: if customer says "she/her/him" after naming a technician, use the named technician.',
      '',
      '=== APPOINTMENT BOOKING FLOW ===',
      'When a customer wants to book/schedule an appointment, collect info ONE piece at a time:',
      '  Step 1: Which service?',
      '  Step 2: Preferred technician? (optional — "any available" is fine)',
      '  Step 3: Preferred date and time?',
      '  Step 4: Customer name?',
      '  Step 5: Customer phone number?',
      'Once you have service + date/time + name + phone — read the details back to confirm, then end your reply with exactly: [ESCALATE:appointment]',
      'Do NOT include [ESCALATE:appointment] until all four required pieces are collected.',
      'If unsure or customer wants immediate help: suggest calling ' + phone + ' directly.',
    ].join('\n');
  }

  // ── Escalation marker parsing ─────────────────────────────────────────────────
  function _parseEscalationType(reply) {
    var m = reply.match(/\[ESCALATE:(order|appointment|reservation|question)\]/i);
    return m ? m[1].toLowerCase() : null;
  }

  function _stripMarker(reply) {
    return reply.replace(/\s*\[ESCALATE:[^\]]+\]/gi, '').trim();
  }

  // ── Fallback (no API key) ─────────────────────────────────────────────────────
  function _fallback(biz, text) {
    var phone = biz.phoneDisplay || biz.phone || '408-859-6718';
    var name  = biz.name || 'Luxurious Nails & Spa';
    var t     = text.toLowerCase();

    if (/hour|open|close|time|schedule|horas|horario|abre|cierra/i.test(t)) {
      var todayName2 = DAYS[new Date().getDay()];
      var todayHours = biz.hours && biz.hours[todayName2];
      if (todayHours && todayHours.open) {
        return 'Today we are open ' + todayHours.open + ' – ' + todayHours.close + '. Mon–Fri 9:30am–7:30pm, Sat 9:30am–7pm, Sun 10am–6pm. Call us at ' + phone + ' to confirm same-day availability.';
      }
      return 'We are open Mon–Fri 9:30am–7:30pm, Sat 9:30am–7:00pm, Sun 10:00am–6:00pm. Call ' + phone + ' for same-day availability.';
    }
    if (/walk.?in|sin cita|sin reserva/i.test(t)) {
      return 'Walk-ins are welcome based on current availability! We recommend calling ' + phone + ' to check wait times before you come in.';
    }
    if (/price|cost|how much|precio|costo|cuánto|cuanto/i.test(t)) {
      return 'Our prices vary by service. For an exact quote, please call us at ' + phone + ' or ask about a specific service and I can look it up for you.';
    }
    if (/book|appoint|schedule|reserv|cita|reservar/i.test(t)) {
      return 'To book an appointment, please call us at ' + phone + '. We will find the perfect time and technician for you!';
    }
    if (/staff|technician|helen|tracy|who|quién|quien|técnico|nail tech/i.test(t)) {
      return 'Our nail technicians are experienced professionals. Call us at ' + phone + ' and we can match you with the best technician for your service.';
    }
    return 'Thank you for contacting ' + name + '! For immediate assistance please call ' + phone + '. We are happy to help with services, pricing, and scheduling.';
  }

  // ── Core message handler (voice-ready — no DOM access) ───────────────────────
  function _handleMessage(biz, text, apiKey) {
    // Initialize history
    if (!biz._aiHistory) biz._aiHistory = [];
    biz._aiHistory.push({ role: 'user', content: text });
    if (biz._aiHistory.length > HISTORY_CAP) {
      biz._aiHistory = biz._aiHistory.slice(-HISTORY_CAP);
    }

    // Track named staff for pronoun resolution
    (biz.staff || []).forEach(function (m) {
      if (m.active !== false && new RegExp('\\b' + m.name + '\\b', 'i').test(text)) {
        biz._selectedStaff = m;
      }
    });

    // Language detection — persist for session
    var detected = _detectLang(text);
    if (detected === 'es') biz._lilyLang = 'es';
    var lang = biz._lilyLang || 'en';

    // No API key — use rule-based fallback
    if (!apiKey) {
      return new Promise(function (resolve) {
        setTimeout(function () {
          var reply = _fallback(biz, text);
          biz._aiHistory.push({ role: 'assistant', content: reply });
          resolve({ text: reply, escalationType: null });
        }, 600);
      });
    }

    var systemPrompt = _buildPrompt(biz, lang);

    return fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: biz._aiHistory.map(function (m) {
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
      var raw          = (data.content && data.content[0] && data.content[0].text) || '';
      var escalationType = _parseEscalationType(raw);
      var clean        = _stripMarker(raw);
      biz._aiHistory.push({ role: 'assistant', content: clean });
      return { text: clean, escalationType: escalationType };
    });
  }

  // ── DOM helpers (used only in init) ──────────────────────────────────────────
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
                esc.create(biz, messagesEl, result.escalationType);
              }
            }
          })
          .catch(function (err) {
            _hideTyping(typingId);
            console.warn('[LilyReceptionist] API error, using fallback:', err.message || err);
            var fallbackText = _fallback(biz, text);
            biz._aiHistory.push({ role: 'assistant', content: fallbackText });
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
