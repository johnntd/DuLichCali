// Lily Receptionist v3.5 — Stateful, time-aware AI receptionist for nail & hair salon vendors
// Voice-ready: LilyReceptionist.handleMessage(biz, text, apiKey) → Promise<{text, escalationType}>
// Languages: English + Spanish + Vietnamese (Claude-detected, not just regex)
// Features: intent classification, entity extraction, booking state machine,
//           multi-service selection, duration aggregation, availability checking,
//           smart alternatives (next slot / different staff suggestion)
//
// Depends on: ai-engine.js (AIEngine.detectLang, AIEngine.fetchWithRetry,
//             AIEngine.saveHistory, AIEngine.restoreHistory)
(function () {
  'use strict';

  var MODEL       = 'claude-sonnet-4-6';
  var MAX_TOKENS  = 900;   // increased: response + STATE marker JSON
  var HISTORY_CAP = 20;
  var DAYS        = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

  // ── Language detection — delegates to shared AIEngine ────────────────────────
  // AIEngine.detectLang is the single implementation for the entire app.
  // _detectLang() kept as a thin local alias so call sites inside this file are unchanged.
  function _detectLang(text) { return AIEngine.detectLang(text); }

  function _memoryHelper() {
    return (typeof window !== 'undefined' && window.SalonCustomerMemory) ? window.SalonCustomerMemory : null;
  }

  function _normalizeSalonMemoryPhone(text) {
    var phone = _normalizeSalonRuntimePhone(text, null, { phoneContext: true, expected: 'phone' });
    if (phone) return phone;
    var mem = _memoryHelper();
    if (mem && typeof mem.normalizePhone === 'function') return mem.normalizePhone(text);
    var digits = String(text || '').replace(/\D/g, '');
    if (digits.length === 11 && digits.charAt(0) === '1') digits = digits.slice(1);
    return digits.length === 10 ? digits : null;
  }

  function _phoneIntakeHelper() {
    return (typeof window !== 'undefined' && window.PhoneIntake)
      ? window.PhoneIntake
      : (typeof PhoneIntake !== 'undefined' ? PhoneIntake : null);
  }

  function _normalizeSalonRuntimePhone(text, lang, context) {
    var digits = _extractSalonRuntimePhoneDigits(text, lang, context);
    return digits && digits.length === 10 ? digits : null;
  }

  function _extractSalonRuntimePhoneDigits(text, lang, context) {
    context = context || {};
    var pi = _phoneIntakeHelper();
    var digits = pi && typeof pi.normalizeSpokenPhoneNumber === 'function'
      ? pi.normalizeSpokenPhoneNumber(String(text || ''), lang || null, context)
      : null;
    if (!digits) digits = String(text || '').replace(/\D/g, '');
    if (digits.length === 11 && digits.charAt(0) === '1') digits = digits.slice(1);
    return digits.length >= 6 && digits.length <= 10 ? digits : null;
  }

  function _formatPhoneForConfirm(phone) {
    var digits = String(phone || '').replace(/\D/g, '');
    if (digits.length === 10) {
      return digits.slice(0, 3) + '-' + digits.slice(3, 6) + '-' + digits.slice(6);
    }
    if (digits.length === 9) {
      return digits.slice(0, 3) + '-' + digits.slice(3, 6) + '-' + digits.slice(6);
    }
    return phone;
  }

  function _isAwaitingPhoneNumber(state) {
    if (!state || state.phone) return false;
    if (state.pendingAction === 'modify_booking') return true;
    if (state.intent !== 'booking_request' && state.pendingAction !== 'booking_offer') return false;
    return state.pendingAction === 'booking_offer' ||
      !!(state.services && state.services.length) ||
      !!state.date || !!state.time || !!state.name || !!state.staff;
  }

  function _hasPhoneIntentText(text) {
    var pi = _phoneIntakeHelper();
    if (pi && typeof pi.hasPhoneIntent === 'function') return pi.hasPhoneIntent(text);
    var raw = String(text || '').toLowerCase();
    var plain = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
    return /\b(phone|phone number|number|cell|mobile|telephone|tel)\b/.test(plain) ||
      /\b(numero de telefono|telefono|celular|movil)\b/.test(plain) ||
      /(số điện thoại|so dien thoai|điện thoại|dien thoai)/i.test(raw);
  }

  function _hasSalonPhoneContext(biz, text, lang) {
    var s = (biz && biz._bookingState) || _emptyState();
    return !!(
      (biz && biz._expectingPhone) ||
      _isAwaitingPhoneNumber(s) ||
      _hasPhoneIntentText(text) ||
      (s && !s.phone && (
        s.pendingAction === 'modify_booking' ||
        s.pendingAction === 'booking_offer' ||
        (s.intent === 'booking_request' && (
          (s.services && s.services.length) || s.date || s.time || s.name || s.staff
        ))
      ))
    );
  }

  function _markExpectingPhoneFromReply(biz, reply) {
    if (!biz) return;
    var s = biz._bookingState || null;
    if (s && s.phone) {
      biz._expectingPhone = false;
      return;
    }
    if (_hasPhoneIntentText(reply)) {
      biz._expectingPhone = true;
    }
  }

  function _buildPhoneConfirmReply(phone, lang) {
    var formatted = _formatPhoneForConfirm(phone);
    if (lang === 'vi') return 'Em nghe số điện thoại là ' + formatted + ', đúng không ạ?';
    if (lang === 'es') return 'Escuché su número como ' + formatted + '. ¿Es correcto?';
    return 'I heard your phone number as ' + formatted + '. Is that correct?';
  }

  function _buildPartialPhoneReply(phone, lang) {
    var formatted = _formatPhoneForConfirm(phone);
    if (lang === 'vi') return 'Em nghe được ' + formatted + ', nhưng hình như còn thiếu số. Mình đọc lại đầy đủ 10 số giúp em nhé?';
    if (lang === 'es') return 'Escuché ' + formatted + ', pero parece que falta un dígito. ¿Me lo puede repetir completo con 10 números?';
    return 'I heard ' + formatted + ', but it looks like one digit is missing. Could you repeat the full 10-digit phone number?';
  }

  function _isPhoneFirstBookingIntent(text) {
    var t = String(text || '').toLowerCase();
    return /\b(book|booking|appointment|appt|come today|come in|schedule|haircut|cut my hair|nails done|manicure|pedicure)\b/.test(t) ||
      /(đặt lịch|dat lich|làm móng|lam mong|cắt tóc|cat toc|làm tóc|lam toc|muốn làm|muon lam|muốn cắt|muon cat)/i.test(t) ||
      /\b(cita|reservar|agenda|quiero.*(uñas|corte|pelo|cabello))\b/.test(t);
  }

  function _buildPhoneFirstPrompt() {
    return 'The customer wants to book an appointment. Ask for their phone number first — it is needed to look up your customer record. Do not ask for service, staff, or time yet.';
  }

  function _serviceStillExistsAtVendor(biz, serviceName) {
    if (!serviceName) return false;
    var key = String(serviceName).toLowerCase();
    var catalog = (biz.services || []).concat(biz._staticServices || []);
    return catalog.some(function (svc) {
      return svc && svc.name && String(svc.name).toLowerCase() === key && svc.active !== false;
    });
  }

  function _staffStillWorksAtVendor(biz, staffName) {
    if (!staffName) return false;
    var key = String(staffName).toLowerCase();
    return (biz.staff || []).some(function (m) {
      return m && m.name && String(m.name).toLowerCase() === key && m.active !== false;
    });
  }

  function _safeApplyReturningCustomer(biz, customer) {
    if (!customer || !biz._bookingState) return null;
    var safeCustomer = {
      name: customer.name || null,
      lastService: _serviceStillExistsAtVendor(biz, customer.lastService) ? customer.lastService : null,
      lastStaff: _staffStillWorksAtVendor(biz, customer.lastStaff) ? customer.lastStaff : null,
      lastAppointmentDate: customer.lastAppointmentDate || null,
      vendorId: customer.vendorId || null
    };
    if (safeCustomer.name) biz._bookingState.name = safeCustomer.name;
    if (safeCustomer.lastService && (!biz._bookingState.services || !biz._bookingState.services.length)) {
      biz._bookingState.services = [safeCustomer.lastService];
    }
    if (safeCustomer.lastStaff && !biz._bookingState.staff) biz._bookingState.staff = safeCustomer.lastStaff;
    biz._returningCustomerMemory = safeCustomer;
    return safeCustomer;
  }

  function _maybeHandleSalonCustomerMemory(biz, text, lang) {
    var mem = _memoryHelper();
    var s = biz._bookingState || _emptyState();
    var phoneContext = _hasSalonPhoneContext(biz, text, lang);
    var phoneCandidate = phoneContext
      ? _extractSalonRuntimePhoneDigits(text, lang, { phoneContext: true, expected: 'phone' })
      : null;
    var phone = (phoneCandidate && phoneCandidate.length === 10 ? phoneCandidate : null) ||
      ((phoneContext || /^\D*\+?[\d\s().-]{7,}\D*$/.test(String(text || ''))) ? _normalizeSalonMemoryPhone(text) : null);
    var wasAwaitingPhone = _isAwaitingPhoneNumber(s);
    var hasPhone = s.phone || phone;
    var bookingIntent = _isPhoneFirstBookingIntent(text) || s.intent === 'booking_request' || s.pendingAction === 'booking_offer';

    if (phone && !s.phone) {
      _mergeState(biz, {
        intent: s.intent || 'booking_request',
        services: s.services || [],
        phone: phone,
        lang: lang || s.lang || 'en',
        pendingAction: s.pendingAction || null
      });
      s = biz._bookingState;
      if (wasAwaitingPhone || bookingIntent) {
        biz._expectingPhone = false;
        _saveBookingState(biz);
        return Promise.resolve({ directResponse: _buildPhoneConfirmReply(phone, lang || s.lang || 'en') });
      }
    }

    if (!phone && phoneCandidate && (wasAwaitingPhone || bookingIntent)) {
      biz._expectingPhone = true;
      return Promise.resolve({ directResponse: _buildPartialPhoneReply(phoneCandidate, lang || s.lang || 'en') });
    }

    if (bookingIntent && !hasPhone) {
      s.intent = 'booking_request';
      s.lang = lang || s.lang || 'en';
      biz._expectingPhone = true;
      _saveBookingState(biz);
      return Promise.resolve({ systemContext: _buildPhoneFirstPrompt() });
    }

    if (!mem || !hasPhone || biz._returningCustomerMemoryChecked === hasPhone) {
      return Promise.resolve(null);
    }

    biz._returningCustomerMemoryChecked = hasPhone;
    return mem.lookupReturningSalonCustomer({
      db: window.dlcDb,
      biz: biz,
      phone: hasPhone
    }).then(function (customer) {
      if (!customer) return null;
      var safeCustomer = _safeApplyReturningCustomer(biz, customer);
      _saveBookingState(biz);
      var ctx = 'Returning customer found.';
      if (safeCustomer.name) ctx += ' Name: ' + safeCustomer.name + '.';
      if (safeCustomer.lastService) ctx += ' Last service: ' + safeCustomer.lastService + '.';
      if (safeCustomer.lastStaff) ctx += ' Last staff/stylist: ' + safeCustomer.lastStaff + '.';
      ctx += ' Greet them warmly and suggest the same service with the same staff. All booking details must still be validated before confirming — do not skip availability or conflict checks.';
      return { systemContext: ctx };
    }).catch(function () {
      return null;
    });
  }

  // ── Booking state machine ─────────────────────────────────────────────────────
  function _emptyState() {
    return { intent: null, services: [], staff: null, date: null, time: null, name: null, phone: null, lang: null, pendingAction: null, existingBookingId: null };
  }

  function _saveBookingState(biz) {
    try { sessionStorage.setItem('lily_s_' + biz.id, JSON.stringify(biz._bookingState)); } catch (e) {}
  }

  function _restoreBookingState(biz) {
    if (biz._bookingState) return;
    try {
      var raw = sessionStorage.getItem('lily_s_' + biz.id);
      if (raw) {
        var parsed = JSON.parse(raw);
        // Clear stale date: if the saved date is in the past, wipe date/time/staff/pendingAction
        // so old booking context from a prior day never bleeds into a fresh conversation.
        var todayIso = AIEngine.localISODate(new Date());
        if (parsed.date && parsed.date < todayIso) {
          parsed.date          = null;
          parsed.time          = null;
          parsed.staff         = null;
          parsed.pendingAction = null;
        }
        biz._bookingState = parsed;
        return;
      }
    } catch (e) {}
    biz._bookingState = _emptyState();
  }

  // Merge Claude's extracted STATE into current booking state.
  // RX-016: field-level validation rejects malformed values from Claude's STATE marker
  // so that bad JSON (wrong date format, non-array services, etc.) cannot corrupt the
  // booking state machine. Invalid fields are dropped and logged; valid ones merge normally.
  var _VALID_LANGS = { en: 1, vi: 1, es: 1 };
  var _VALID_PENDING = { booking_offer: 1, modify_booking: 1 };

  function _mergeState(biz, update) {
    if (!biz._bookingState) biz._bookingState = _emptyState();
    // RX-021: when a fresh booking_request (pendingAction=null) arrives with a NEW time that
    // differs from the last confirmed time, clear the post-booking CONFIRMED signal context.
    // This prevents the CONFIRMED signal from persisting into subsequent turns of a new booking
    // flow, which would keep confusing Claude into treating the new request as a reschedule.
    if (update && update.intent === 'booking_request' &&
        update.pendingAction !== 'modify_booking' &&
        update.time && biz._lastConfirmedTime && update.time !== biz._lastConfirmedTime) {
      biz._lastBookingId     = null;
      biz._lastConfirmedTime = null;
      biz._lastConfirmedDate = null;
    }
    Object.keys(update).forEach(function (k) {
      var val = update[k];
      // null is always valid — it means "clear this field"
      if (val === null) { biz._bookingState[k] = null; return; }

      // Per-field validation (RX-016)
      if (k === 'date') {
        // Must be YYYY-MM-DD and not in the past
        if (typeof val !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
          console.warn('[mergeState] rejected invalid date:', val); return;
        }
        // Reject dates more than 1 year in the future (likely hallucination)
        var parsed = new Date(val + 'T00:00:00');
        var now = new Date(); now.setHours(0,0,0,0);
        var cutoff = new Date(now); cutoff.setFullYear(cutoff.getFullYear() + 1);
        if (parsed < now || parsed > cutoff) {
          console.warn('[mergeState] rejected out-of-range date:', val); return;
        }
        biz._bookingState[k] = val; return;
      }
      if (k === 'time') {
        if (typeof val !== 'string' || !/^\d{1,2}:\d{2}$/.test(val)) {
          console.warn('[mergeState] rejected invalid time:', val); return;
        }
        biz._bookingState[k] = val; return;
      }
      if (k === 'phone') {
        var rawPhone = String(val);
        var _PI = (typeof window !== 'undefined' && window.PhoneIntake)
          ? window.PhoneIntake
          : (typeof PhoneIntake !== 'undefined' ? PhoneIntake : null);
        var normalized = _PI ? _PI.normalizeSpokenPhoneNumber(rawPhone, biz._bookingState.lang, { phoneContext: true, expected: 'phone' }) : null;
        var phoneDigits = normalized || rawPhone.replace(/\D/g, '');
        // Normalize 11-digit +1 country code to 10 digits for consistent lookup
        if (phoneDigits.length === 11 && phoneDigits.charAt(0) === '1') {
          phoneDigits = phoneDigits.slice(1);
        }
        if (phoneDigits.length === 10) {
          biz._bookingState[k] = phoneDigits; return; // full US number — store
        }
        if (phoneDigits.length >= 6) {
          // Partial candidate — helper parsed something but it's not a complete number.
          // Do NOT store; leave phone null so the AI asks for the full number.
          console.warn('[mergeState] partial phone (not a full number):', val); return;
        }
        console.warn('[mergeState] rejected invalid phone:', val); return;
      }
      if (k === 'services') {
        if (!Array.isArray(val)) {
          console.warn('[mergeState] rejected non-array services:', val); return;
        }
        // All elements must be non-empty strings
        var clean = val.filter(function(s) { return typeof s === 'string' && s.trim().length > 0; });
        biz._bookingState[k] = clean; return;
      }
      if (k === 'lang') {
        if (!_VALID_LANGS[val]) {
          console.warn('[mergeState] rejected unknown lang:', val); return;
        }
        biz._bookingState[k] = val; return;
      }
      if (k === 'pendingAction') {
        // Only recognised pendingAction values (or null already handled above)
        if (!_VALID_PENDING[val]) {
          console.warn('[mergeState] rejected unknown pendingAction:', val); return;
        }
        biz._bookingState[k] = val; return;
      }
      if (k === 'name') {
        // Must be a non-empty string with at least 1 letter
        if (typeof val !== 'string' || val.trim().length < 1 || !/[a-zA-ZÀ-ỹ]/.test(val)) {
          console.warn('[mergeState] rejected invalid name:', val); return;
        }
        biz._bookingState[k] = val.trim(); return;
      }
      // All other fields (intent, staff, existingBookingId) — accept as-is
      biz._bookingState[k] = val;
    });
  }

  // Build human-readable booking state context for the system prompt
  function _buildBookingStateContext(biz) {
    var s = biz._bookingState || {};
    var hasData = (s.services && s.services.length) || s.staff || s.date || s.time || s.name || s.phone || s.pendingAction;
    if (!hasData) return '';
    var lines = ['=== CURRENT BOOKING STATE (already collected — do NOT ask for these again) ==='];
    lines.push('Services: ' + ((s.services && s.services.length) ? s.services.join(', ') : 'not yet specified'));
    lines.push('Staff: '    + (s.staff || 'not yet specified'));
    lines.push('Date: '     + (s.date  || 'not yet specified'));
    lines.push('Time: '     + (s.time  || 'not yet specified'));
    lines.push('Customer name: '  + (s.name  || 'not yet specified'));
    lines.push('Customer phone: ' + (s.phone || 'not yet specified'));
    lines.push('Pending action: ' + (s.pendingAction || 'none'));
    if (s.existingBookingId) lines.push('Existing booking ID (reschedule): ' + s.existingBookingId);
    // Post-booking signal: date/time are null after confirmation — do NOT treat as incomplete.
    // RX-021: include the confirmed date/time so Claude knows exactly what was booked and
    // does NOT inherit that time for a new booking request.
    if (biz._lastBookingId && s.name && s.phone && !s.date && !s.time) {
      var _cfmSlot = [biz._lastConfirmedDate, biz._lastConfirmedTime ? 'at ' + biz._lastConfirmedTime : ''].filter(Boolean).join(' ');
      lines.push(
        'BOOKING STATUS: CONFIRMED (ref: ' + biz._lastBookingId + '). ' +
        'The previous appointment' + (_cfmSlot ? ' (' + _cfmSlot + ')' : '') + ' is complete. ' +
        'If the customer now makes a NEW booking request with a different date or time, ' +
        'treat it as a fresh booking_request (intent=booking_request, pendingAction=null) — ' +
        'use the date/time THEY explicitly provide, do NOT reuse the confirmed slot ' + (_cfmSlot ? '(' + _cfmSlot + ')' : '') + '. ' +
        'Only set pendingAction=modify_booking if the customer explicitly says to change, reschedule, or cancel THIS booking. ' +
        'Name + phone are already on file. Do NOT ask for date/time again unless the customer is requesting a NEW booking.'
      );
    }
    return lines.join('\n');
  }

  // ── Duration helpers ──────────────────────────────────────────────────────────

  // Sum durationMins for all requested service names against biz.services catalog
  function _calcTotalDuration(biz, serviceNames) {
    if (!serviceNames || !serviceNames.length) return 60;
    var catalog = biz.services || [];
    var total = 0;
    serviceNames.forEach(function (name) {
      var found = null;
      for (var i = 0; i < catalog.length; i++) {
        if (catalog[i].name && catalog[i].name.toLowerCase() === name.toLowerCase()) {
          found = catalog[i];
          break;
        }
      }
      total += (found && found.durationMins) ? found.durationMins : 60;
    });
    return total || 60;
  }

  // ── Nail Availability Checker ─────────────────────────────────────────────────
  // Checks vendor/appointments Firestore subcollection for conflicts BEFORE escalating.
  // Only blocks named-staff conflicts and out-of-hours requests.
  // 'Any' staff requests pass through (salon assigns dynamically).
  var NailAvailabilityChecker = (function () {
    var SLOT_STEP       = 30;  // minute increment for alternative suggestions
    var DEFAULT_DUR     = 60;  // fallback if service not found

    function _toMins(t) {
      if (!t || typeof t !== 'string') return 0;
      var p = t.split(':');
      return parseInt(p[0] || '0', 10) * 60 + parseInt(p[1] || '0', 10);
    }

    function _fromMins(m) {
      var h = Math.floor(m / 60), min = m % 60;
      return (h < 10 ? '0' : '') + h + ':' + (min < 10 ? '0' : '') + min;
    }

    function _dayName(dateStr) {
      // 'YYYY-MM-DD' → 'monday'
      var d = new Date(dateStr + 'T12:00:00');
      return DAYS[d.getDay()];
    }

    // Get salon close time (minutes) for a given ISO date string.
    // Handles all biz.hours formats: { Mon:'9:30 AM – 7:30 PM' }, { monday:{open,close} }, { mon:{start,end} }
    var _k3 = { monday:'Mon', tuesday:'Tue', wednesday:'Wed', thursday:'Thu', friday:'Fri', saturday:'Sat', sunday:'Sun' };
    function _salonCloseMins(biz, dateStr) {
      var DEFAULT_CLOSE = 19 * 60 + 30; // 7:30 PM
      if (!biz || !biz.hours || !dateStr) return DEFAULT_CLOSE;
      var dayName = _dayName(dateStr); // 'monday' etc.
      var h = biz.hours[dayName] || biz.hours[_k3[dayName]] || biz.hours[dayName.slice(0,3)];
      if (!h) return DEFAULT_CLOSE;
      // String format: "9:30 AM – 7:30 PM" or "Closed"
      if (typeof h === 'string') {
        if (h === 'Closed') return -1; // signals closed
        var parts = h.split(/\s*[–-]\s*/);
        if (parts.length < 2) return DEFAULT_CLOSE;
        var cs = parts[1].trim();
        var m12 = cs.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
        if (m12) {
          var ch = +m12[1], cm = +(m12[2]||0), ap = m12[3].toUpperCase();
          if (ap === 'PM' && ch !== 12) ch += 12;
          if (ap === 'AM' && ch === 12) ch = 0;
          return ch * 60 + cm;
        }
        return DEFAULT_CLOSE;
      }
      // Object format: { close:'19:30' } or { end:'19:30' }
      var closeStr = h.close || h.end;
      if (!closeStr) return DEFAULT_CLOSE;
      var p = closeStr.split(':');
      return parseInt(p[0]||'19',10) * 60 + parseInt(p[1]||'30',10);
    }

    function _overlaps(aStart, aEnd, bStart, bEnd) {
      return aStart < bEnd && aEnd > bStart;
    }

    // Returns {open: mins, close: mins} if named staff is scheduled to work on dateStr
    // AND has valid shift hours. Returns null in ALL other cases.
    // Safe policy (per system rules): null = NOT AVAILABLE — missing/unclear data blocks booking.
    //   • staff not in biz.staff        → null → block
    //   • staff has no schedule         → null → block
    //   • day absent from schedule      → null → block
    //   • day explicitly off            → null → block
    //   • no open/start time on record  → null → block
    var _staffShortKey = { monday:'mon', tuesday:'tue', wednesday:'wed', thursday:'thu', friday:'fri', saturday:'sat', sunday:'sun' };
    function _getStaffShift(biz, staffName, dateStr) {
      if (!biz || !biz.staff || !biz.staff.length || !staffName || !dateStr) return null;
      var keyLower = staffName.toLowerCase().trim();
      var member = null;
      for (var i = 0; i < biz.staff.length; i++) {
        var nm = (biz.staff[i].name || '').toLowerCase().trim();
        if (!nm) continue; // skip placeholder/unnamed staff docs
        // Partial-match: handles "Tracy" matching "Tracy Nguyen" and vice-versa
        if (nm === keyLower || nm.indexOf(keyLower) >= 0 || keyLower.indexOf(nm) >= 0) {
          member = biz.staff[i]; break;
        }
      }
      if (!member || !member.schedule) return null;
      var dayName = _dayName(dateStr);
      var sched = member.schedule[dayName] || member.schedule[_staffShortKey[dayName]];
      if (!sched || sched.active === false) return null;
      var openStr  = sched.open  || sched.start;
      var closeStr = sched.close || sched.end;
      if (!openStr) return null;
      return { open: _toMins(openStr), close: closeStr ? _toMins(closeStr) : (19 * 60 + 30) };
    }

    // Walk forward from reqStart in SLOT_STEP increments; return first non-conflicting slot for named staff.
    // Kept for backward-compat (tests + outside callers); conflict check now uses _findAlternativeSlots.
    function _findNextSlot(existing, staffKey, reqStart, totalMins, openMins, closeMins) {
      var try_ = reqStart + SLOT_STEP;
      while (try_ + totalMins <= closeMins) {
        var tryEnd = try_ + totalMins;
        var blocked = existing.some(function (appt) {
          var apptStaff = (appt.staff || '').toLowerCase();
          if (apptStaff !== staffKey && apptStaff !== 'any') return false;
          var aStart = _toMins(appt.time || '00:00');
          var aDur   = appt.totalDurationMins || appt.durationMins || DEFAULT_DUR;
          return _overlaps(try_, tryEnd, aStart, aStart + aDur);
        });
        if (!blocked) return _fromMins(try_);
        try_ += SLOT_STEP;
      }
      return null; // no slot found today
    }

    // Find up to maxSlots free alternatives nearest to reqStart, searching BOTH directions.
    // Returns array of HH:MM strings sorted by proximity (closest first).
    // For equal distance, later time wins (customer asked for X, X+30 feels closer than X-30).
    function _findAlternativeSlots(existing, staffKey, reqStart, totalMins, openMins, closeMins, maxSlots) {
      maxSlots = maxSlots || 3;
      var MAX_STEPS = 16; // search up to 8 hours in each direction (16 × 30 min)

      function _isFree(t) {
        var tEnd = t + totalMins;
        if (t < openMins || tEnd > closeMins) return false;
        return !existing.some(function (appt) {
          var as_ = (appt.staff || '').toLowerCase();
          if (as_ !== staffKey && as_ !== 'any') return false;
          var aS = _toMins(appt.time || '00:00');
          var aD = appt.totalDurationMins || appt.durationMins || DEFAULT_DUR;
          return _overlaps(t, tEnd, aS, aS + aD);
        });
      }

      // Collect candidates from both directions, interleaved by step distance
      var seen  = {};
      var found = [];
      for (var i = 1; i <= MAX_STEPS && found.length < maxSlots * 2; i++) {
        var later   = reqStart + i * SLOT_STEP;
        var earlier = reqStart - i * SLOT_STEP;
        if (!seen[later]   && _isFree(later))   { seen[later]   = true; found.push(later); }
        if (!seen[earlier] && _isFree(earlier)) { seen[earlier] = true; found.push(earlier); }
      }

      // Sort: primary = absolute distance from reqStart; secondary = prefer later (same distance)
      found.sort(function (a, b) {
        var da = Math.abs(a - reqStart), db = Math.abs(b - reqStart);
        if (da !== db) return da - db;
        return b - a; // later wins on tie
      });

      return found.slice(0, maxSlots).map(_fromMins);
    }

    // Build a natural language conflict / hours message
    // _buildMsg returns English-only structured facts about why a slot was rejected.
    // These strings go into AI history as context so the AI can respond naturally
    // in the customer's language — no translations here.
    function _buildMsg(biz, key, data) {
      var phone = biz.phoneDisplay || biz.phone || '';

      if (key === 'closed') {
        var d = data.day.charAt(0).toUpperCase() + data.day.slice(1);
        return 'Sorry, the salon is closed on ' + d + 's. Would you like to pick a different day?';
      }

      if (key === 'too_late') {
        var dur = data.totalMins + ' min';
        return 'This service takes ' + dur + ' and would run past closing time (' + data.close + '). The latest start available is ' + data.latest + '. Would you like that time instead?';
      }

      if (key === 'conflict') {
        var staffNote = data.staff && data.staff.toLowerCase() !== 'any' ? ' with ' + data.staff : '';
        var alts = data.altSlots && data.altSlots.length ? data.altSlots : (data.nextSlot ? [data.nextSlot] : []);
        var staffSuffix = '';
        if (data.altStaff && data.altStaff.length > 0) {
          var _as = data.altStaff;
          var _nameStr = _as.length === 1 ? _as[0]
            : _as.slice(0, -1).join(', ') + (_as.length > 2 ? ',' : '') + ' or ' + _as[_as.length - 1];
          staffSuffix = ' However, ' + _nameStr + ' ' + (_as.length === 1 ? 'is' : 'are') + ' available at that time.';
        }
        if (alts.length === 1) {
          return 'Sorry, ' + data.time + staffNote + ' is already booked. The closest available time is ' + alts[0] + '.' + staffSuffix + ' Which would you prefer?';
        } else if (alts.length >= 2) {
          var last = alts[alts.length - 1];
          var rest = alts.slice(0, alts.length - 1);
          return 'Sorry, ' + data.time + staffNote + ' is already booked. The closest available times are ' + rest.join(', ') + ' and ' + last + '.' + staffSuffix + ' Which would you prefer?';
        } else {
          return 'Sorry, there are no more available slots that day' + (staffNote ? ' with ' + data.staff : '') + '.' + staffSuffix + (staffSuffix ? '' : ' Please call ' + phone + ' or choose a different date.');
        }
      }

      if (key === 'staff_not_working') {
        var sn  = data.staff || 'That technician';
        var day = data.day.charAt(0).toUpperCase() + data.day.slice(1);
        return sn + ' is not working on ' + day + '. Would you like to pick a different day or a different technician?';
      }

      if (key === 'outside_shift') {
        var sn2   = data.staff || 'That technician';
        var hours = data.open + ' \u2013 ' + data.close;
        var latStr = data.latest ? (' The latest start is ' + data.latest + '.') : '';
        return sn2 + ' works ' + hours + '.' + latStr + ' Would you like to choose a different time?';
      }

      if (key === 'customer_conflict') {
        var existSvcs  = Array.isArray(data.services) && data.services.length ? data.services.join(' + ') : 'an appointment';
        var existStaff = data.staff && data.staff.toLowerCase() !== 'any' ? ' with ' + data.staff : '';
        var existTime  = data.time || 'another time';
        return 'You already have ' + existSvcs + existStaff + ' at ' + existTime + ' that day. Would you like to replace it, keep it, or pick a different time?';
      }

      return '';
    }

    function check(biz, draft) {
      var db = window.dlcDb;

      // No Firestore, or incomplete draft — pass through
      if (!db || !draft || !draft.date || !draft.time) {
        return Promise.resolve({ valid: true });
      }

      var requestedStaff = (draft.staff || 'any').toLowerCase();
      var checkStaff     = requestedStaff !== 'any'; // named-staff conflict check
      var checkCustomer  = !!(draft.name || draft.phone); // customer duplicate check

      // Nothing to check — anonymous 'any' booking with no identity info
      if (!checkStaff && !checkCustomer) {
        return Promise.resolve({ valid: true });
      }

      var totalMins    = draft.totalDurationMins || DEFAULT_DUR;
      var reqStartMins = _toMins(draft.time);
      var reqEndMins   = reqStartMins + totalMins;

      // ── Closing-time check — named staff only (mirrors pre-v3.1 behaviour) ──
      // 'Any' staff bookings skip this: Claude handles open/closed via the prompt,
      // and the old code intentionally bypassed this check for 'any' requests.
      var closeMins = null;
      if (checkStaff) {
        closeMins = _salonCloseMins(biz, draft.date);
        if (closeMins === -1) {
          return Promise.resolve({ valid: false, message: _buildMsg(biz, 'closed', { day: _dayName(draft.date), lang: draft.lang }) });
        }
        if (reqEndMins > closeMins) {
          var latest = closeMins - totalMins;
          return Promise.resolve({ valid: false, message: _buildMsg(biz, 'too_late', {
            totalMins: totalMins,
            close:     _fromMins(closeMins),
            latest:    latest > 0 ? _fromMins(latest) : 'N/A',
            lang:      draft.lang
          })});
        }
      }

      // ── isWorkingDay AND isWithinShift (hard gates, no Firestore needed) ────────
      // _getStaffShift returns {open,close} mins when staff works, null otherwise.
      // null covers: off that day, no schedule data, staff not found — all block.
      // Both gates must pass before Firestore conflict queries run.
      if (checkStaff) {
        var shift = _getStaffShift(biz, draft.staff, draft.date);
        if (shift === null) {
          return Promise.resolve({ valid: false, message: _buildMsg(biz, 'staff_not_working', { staff: draft.staff, day: _dayName(draft.date), lang: draft.lang }) });
        }
        // isWithinShift: booking must start at or after shift open, end at or before shift close
        if (reqStartMins < shift.open || reqEndMins > shift.close) {
          var shiftLatest = shift.close - totalMins;
          return Promise.resolve({ valid: false, message: _buildMsg(biz, 'outside_shift', {
            staff:  draft.staff,
            open:   _fromMins(shift.open),
            close:  _fromMins(shift.close),
            latest: shiftLatest > shift.open ? _fromMins(shiftLatest) : null,
            lang:   draft.lang
          })});
        }
      }

      // Run both queries in parallel:
      // 1. Confirmed appointments in the vendor's appointments subcollection
      // 2. Pending escalations not yet confirmed by the vendor
      //    (escalations store appointmentData.date separately — filter client-side)
      var apptQuery = db.collection('vendors').doc(biz.id)
        .collection('bookings')
        .where('requestedDate', '==', draft.date)
        .get();

      var escQuery = db.collection('escalations')
        .where('vendorId', '==', biz.id)
        .where('status', '==', 'pending_vendor_response')
        .get();

      return Promise.all([apptQuery, escQuery])
        .then(function (results) {
          var apptSnap = results[0];
          var escSnap  = results[1];

          // Confirmed bookings — normalize field names (requestedTime/time, durationMins/totalDurationMins)
          var existing = apptSnap.docs
            .filter(function (d) { var s = d.data().status || ''; return s === 'confirmed' || s === 'in_progress'; })
            .map(function (d) {
              var dd = d.data();
              return {
                customerName:      dd.customerName  || dd.name  || '',
                customerPhone:     dd.customerPhone || dd.phone || '',
                staff:             dd.staff || 'any',
                time:              dd.requestedTime  || dd.time  || '00:00',
                totalDurationMins: dd.totalDurationMins || dd.durationMins || DEFAULT_DUR,
                selectedServices:  dd.selectedServices || dd.services || (dd.service ? [dd.service] : [])
              };
            });

          // Reschedule: exclude the customer's own existing booking so it doesn't
          // block their new slot (the old booking will be updated in place on confirm).
          if (draft.isModify && draft.phone) {
            var _ownPhone = draft.phone.replace(/\D/g, '');
            existing = existing.filter(function (e) {
              return (e.customerPhone || '').replace(/\D/g, '') !== _ownPhone;
            });
          }

          // Pending escalations — normalize to same shape as appointment docs
          escSnap.docs.forEach(function (d) {
            var esc  = d.data();
            var appt = esc.appointmentData;
            if (!appt || appt.date !== draft.date) return; // different date — skip
            existing.push({
              customerName:      appt.name     || '',
              customerPhone:     appt.phone    || '',
              staff:             appt.staff    || 'any',
              time:              appt.time     || '00:00',
              totalDurationMins: appt.totalDurationMins || DEFAULT_DUR,
              selectedServices:  appt.services || []
            });
          });

          // ── Staff conflict check (named staff only) ─────────────────────────
          if (checkStaff) {
            var hasConflict = existing.some(function (appt) {
              var apptStaff = (appt.staff || '').toLowerCase();
              if (apptStaff !== requestedStaff && apptStaff !== 'any') return false;
              var aStart = _toMins(appt.time || '00:00');
              var aDur   = appt.totalDurationMins || appt.durationMins || DEFAULT_DUR;
              return _overlaps(reqStartMins, reqEndMins, aStart, aStart + aDur);
            });

            if (hasConflict) {
              // Use staff shift bounds (not salon close time) so the suggested next slot
              // is always within the technician's actual working hours.
              // shift is guaranteed non-null here (null exits above).
              var _slotOpen  = shift ? Math.max(_toMins('09:00'), shift.open)  : _toMins('09:00');
              var _slotClose = shift ? Math.min(closeMins, shift.close) : closeMins;
              var altSlots = _findAlternativeSlots(existing, requestedStaff, reqStartMins, totalMins,
                _slotOpen, _slotClose, 3);

              // RX-012: find other staff who ARE available at the exact same time.
              // Uses already-loaded `existing` bookings — no extra Firestore queries.
              var altStaff = [];
              (biz.staff || []).forEach(function (m) {
                if (m.active === false) return;
                var mName = (m.name || '').trim();
                if (!mName || mName.toLowerCase() === requestedStaff) return;
                var mShift = _getStaffShift(biz, mName, draft.date);
                if (!mShift) return; // not working that day
                if (reqStartMins < mShift.open || reqEndMins > mShift.close) return; // outside their shift
                var busy = existing.some(function (appt) {
                  var as = (appt.staff || '').toLowerCase().trim();
                  if (as !== mName.toLowerCase() && as !== 'any') return false;
                  var aS = _toMins(appt.time || '00:00');
                  var aD = appt.totalDurationMins || appt.durationMins || DEFAULT_DUR;
                  return _overlaps(reqStartMins, reqEndMins, aS, aS + aD);
                });
                if (!busy) altStaff.push(mName);
              });

              return { valid: false, message: _buildMsg(biz, 'conflict', {
                time:     draft.time,
                staff:    draft.staff,
                altSlots: altSlots,
                altStaff: altStaff,
                lang:     draft.lang
              })};
            }
          }

          // ── Customer conflict check (same person, overlapping time) ─────────
          // Catches duplicate/overlapping bookings for the same customer.
          // Matches by name OR phone — either field is enough to identify the person.
          // Different-time bookings for the same customer are allowed (e.g. manicure at
          // 10 AM with Tracy, pedicure at 2 PM with Helen — both legitimate).
          // Uses _overlaps() (strict >) so back-to-back appointments are NOT flagged:
          // a customer can finish one service and start another immediately after.
          // RX-020: was using >= which caused false positives for exactly-back-to-back slots
          // (e.g. existing ends 16:15, new starts 16:15 → was incorrectly blocked).
          if (checkCustomer && !draft.isModify) {
            var draftName  = (draft.name  || '').toLowerCase().trim();
            var draftPhone = (draft.phone || '').replace(/\D/g, '');
            var custConflict = null;

            for (var i = 0; i < existing.length; i++) {
              var appt = existing[i];
              var apptName  = (appt.customerName  || '').toLowerCase().trim();
              var apptPhone = (appt.customerPhone || '').replace(/\D/g, '');
              // Partial name match: handles "Jane" vs "Jane Smith"
              var nameMatch  = draftName  && apptName  && (apptName === draftName || apptName.indexOf(draftName) >= 0 || draftName.indexOf(apptName) >= 0);
              // Phone match: require ≥7 digits to avoid false positives on short inputs
              var phoneMatch = draftPhone.length >= 7 && apptPhone && apptPhone === draftPhone;
              if (!nameMatch && !phoneMatch) continue;
              var aStart = _toMins(appt.time || '00:00');
              var aDur   = appt.totalDurationMins || appt.durationMins || DEFAULT_DUR;
              // Use _overlaps() (strict >) — consistent with staff conflict check.
              // Back-to-back (aEnd === reqStart) is allowed for customers.
              if (_overlaps(reqStartMins, reqEndMins, aStart, aStart + aDur)) {
                // Check vendor-defined parallel rules before flagging as conflict.
                // e.g. manicure + pedicure at the same time with different staff = OK.
                var existSvcs = appt.selectedServices || (appt.service ? [appt.service] : []);
                var parallelOk = _isParallelAllowed(
                  biz._parallelServices || [],
                  existSvcs,
                  draft.services || [],
                  appt.staff,
                  draft.staff
                );
                if (!parallelOk) {
                  custConflict = appt;
                  break;
                }
              }
            }

            if (custConflict) {
              return { valid: false, message: _buildMsg(biz, 'customer_conflict', {
                services: custConflict.selectedServices,
                staff:    custConflict.staff,
                time:     custConflict.time,
                lang:     draft.lang
              })};
            }
          }

          return { valid: true };
        })
        .catch(function (err) {
          // Fail-open: never block a booking due to a Firestore query error
          console.warn('[NailAvailabilityChecker] query error — allowing booking:', err && err.message);
          return { valid: true };
        });
    }

    // Returns true if biz has a parallel-service rule that covers this combination.
    // Example rule ['Manicure','Pedicure']: Helen does Manicure while Tracy does Pedicure
    // at the same time for the same customer → allowed, not a conflict.
    // Staff must be different; same staff can't do two services simultaneously.
    function _isParallelAllowed(parallelRules, existingSvcs, newSvcs, existingStaff, newStaff) {
      if (!parallelRules || !parallelRules.length) return false;
      var es = (existingStaff || '').toLowerCase().trim();
      var ns = (newStaff     || '').toLowerCase().trim();
      if (es && ns && es !== 'any' && ns !== 'any' && es === ns) return false; // same staff
      var eList = (existingSvcs || []).map(function(s) { return (s || '').toLowerCase().trim(); });
      var nList = (newSvcs     || []).map(function(s) { return (s || '').toLowerCase().trim(); });
      if (!eList.length || !nList.length) return false;
      for (var r = 0; r < parallelRules.length; r++) {
        var rule = parallelRules[r];
        var a, b;
        // Accept both old array format [[svcA,svcB],...] and new object format [{a,b},...]
        if (Array.isArray(rule) && rule.length >= 2) {
          a = (rule[0] || '').toLowerCase().trim();
          b = (rule[1] || '').toLowerCase().trim();
        } else if (rule && typeof rule === 'object' && (rule.a || rule.b)) {
          a = (rule.a || '').toLowerCase().trim();
          b = (rule.b || '').toLowerCase().trim();
        } else {
          continue;
        }
        if (!a || !b) continue;
        // Bidirectional: existing=a+new=b OR existing=b+new=a
        if (eList.indexOf(a) >= 0 && nList.indexOf(b) >= 0) return true;
        if (eList.indexOf(b) >= 0 && nList.indexOf(a) >= 0) return true;
      }
      return false;
    }

    return { check: check };
  })();

  // Expose for manual booking form — shares the same validation path as the AI flow
  window.NailAvailabilityChecker = NailAvailabilityChecker;

  // ── _findFreeStaff — proactive staff availability query (Phase 3) ────────────
  // Returns array of staff names who are working on `date` at `timeStr` for
  // `durationMins` minutes and have no conflicting booking in `existing`.
  // `existing`: array of {staff, time, totalDurationMins} (same shape as checker).
  // Pure computation — no Firestore queries; uses biz.staff + schedule config.
  function _findFreeStaff(biz, date, timeStr, durationMins, existing) {
    if (!biz || !biz.staff || !date || !timeStr) return [];
    existing = existing || [];
    var reqStart = _toMins(timeStr);
    var reqEnd   = reqStart + (durationMins || DEFAULT_DUR);
    var free = [];
    (biz.staff || []).forEach(function (m) {
      if (m.active === false) return;
      var mName = (m.name || '').trim();
      if (!mName) return;
      var shift = _getStaffShift(biz, mName, date);
      if (!shift) return; // not working that day
      if (reqStart < shift.open || reqEnd > shift.close) return; // outside shift
      var busy = existing.some(function (appt) {
        var as = (appt.staff || '').toLowerCase().trim();
        if (as !== mName.toLowerCase() && as !== 'any') return false;
        var aS = _toMins(appt.time || '00:00');
        var aD = appt.totalDurationMins || appt.durationMins || DEFAULT_DUR;
        return _overlaps(reqStart, reqEnd, aS, aS + aD);
      });
      if (!busy) free.push(mName);
    });
    return free;
  }

  // ── _validateResponseQuality — Phase 4 response validator ───────────────────
  // Three quality checks on each Claude turn before it is shown to the customer.
  // Non-blocking by design: language and passive-ending issues warn to console only.
  // Only active intervention: suppress ESCALATE:appointment when services=[].
  //
  // Returns { suppressEscalate: bool }
  //   suppressEscalate=true → caller sets escalationType=null (no booking attempt)
  //
  // RX-018: response quality enforcement — Phase 4
  function _validateResponseQuality(biz, clean, escalationType, lang) {
    var result = { suppressEscalate: false };

    // 1. Language consistency — Claude's visible text vs expected lang in STATE
    var respLang = _detectLang(clean);
    if (respLang && lang && respLang !== lang && lang !== 'en') {
      // Only warn when both sides are non-English to avoid false positives from
      // mixed-language inputs (e.g. en name embedded in a vi reply).
      console.warn('[QV] lang mismatch: expected=' + lang + ' detected=' + respLang);
    }

    // 2. BOOKING draft completeness — only gates ESCALATE:appointment
    // If Claude fires [ESCALATE:appointment] but services=[], the booking packet
    // would have no service name: suppress escalation so Claude re-collects.
    if (escalationType === 'appointment') {
      var draft = biz._bookingDraft;
      var svcs  = (draft && draft.services) ||
                  (biz._bookingState && biz._bookingState.services) || [];
      if (!svcs.length) {
        console.warn('[QV] ESCALATE:appointment with empty services — suppressing escalation');
        result.suppressEscalate = true;
      }
    }

    // 3. Passive ending detection — mid-booking turns only (no active block, warn only)
    // A mid-booking response with no `?` may leave the customer unsure what to do next.
    if (!result.suppressEscalate && escalationType !== 'appointment' && escalationType !== 'cancel') {
      var _bs = biz._bookingState;
      var midBooking = _bs && (_bs.intent === 'booking_request' || !!_bs.pendingAction);
      if (midBooking && clean.indexOf('?') < 0 && clean.trim().length > 20) {
        console.warn('[QV] passive ending: no ? in mid-booking response — consider prompt adjustment');
      }
    }

    // 4. Banned phrase detection — Claude leaking availability data-access limitations
    // These phrases indicate the prompt contract is being violated: Claude is telling
    // the customer it cannot check availability, when the system does so automatically.
    var _bannedPhrases = [
      "can't see real-time",
      "cannot see real-time",
      "don't have access to real-time",
      "do not have access to real-time",
      "don't have real-time booking",
      "do not have real-time booking",
      "cannot verify if that slot",
      "can't verify if that slot",
      "i'll check if that",
      "let me verify",
      "the system will check",
      "i don't have booking data",
      "i do not have booking data",
      "no access to booking"
    ];
    var _cleanLower = clean.toLowerCase();
    _bannedPhrases.forEach(function(phrase) {
      if (_cleanLower.indexOf(phrase) >= 0) {
        console.warn('[QV] BANNED PHRASE detected in Claude response: "' + phrase + '" — prompt contract violation. Review _buildPrompt availability section.');
      }
    });

    return result;
  }

  // ── Response sanitizer — NON-BYPASSABLE EXECUTION GUARD ──────────────────────
  // Called in send() as the FIRST operation after _handleMessage resolves.
  // Runs on 100% of Claude responses before earlyCheckReady, before escalation
  // handling, before _appendMessage — nothing can display until this passes.
  //
  // If Claude's response contains any banned availability phrase:
  //   1. The phrase NEVER reaches the customer (text is replaced)
  //   2. _aiHistory is corrected with the safe replacement (Claude doesn't see
  //      the bad text in future turns either)
  //   3. escalationType is cleared (no escalation on a sanitized response)
  //   4. [GUARD] warning is logged to console for monitoring
  //
  // Safe replacement is context-aware: asks for the next missing booking field
  // if in a booking flow, otherwise gives a neutral "how can I help?" prompt.
  //
  // RX-023: permanent non-bypassable availability contract enforcement
  function _sanitizeResponse(biz, result) {
    var text = result.text || '';

    // Regex patterns — broader than the QV warn list to cover paraphrases
    var _guardPatterns = [
      /i\s+can'?t\s+see\s+real.?time/i,
      /i\s+cannot\s+see\s+real.?time/i,
      /don'?t\s+have\s+(access\s+to\s+)?real.?time/i,
      /do\s+not\s+have\s+(access\s+to\s+)?real.?time/i,
      /no\s+access\s+to\s+(real.?time|booking|calendar)/i,
      /cannot\s+verify\s+(if\s+)?that\s+slot/i,
      /can'?t\s+verify\s+(if\s+)?that\s+slot/i,
      /i\s+don'?t\s+have\s+(booking|calendar)\s+data/i,
      /i\s+do\s+not\s+have\s+(booking|calendar)\s+data/i,
      /the\s+system\s+will\s+check\s+(that|it|availability)/i,
      /i'?ll\s+check\s+if\s+that'?s\s+(open|available)/i,
      /let\s+me\s+verify\s+(if\s+)?that'?s\s+(open|available)/i,
      /cannot\s+access\s+(the\s+)?(booking|calendar|real.?time)/i,
      /my\s+(data\s+)?access\s+(is\s+)?limited/i,
      /limited\s+to\s+schedule\s+data/i,
      /only\s+have\s+schedule\s+data/i
    ];

    var triggered = null;
    _guardPatterns.some(function(rx) {
      if (rx.test(text)) { triggered = rx.toString(); return true; }
      return false;
    });
    if (!triggered) return result; // clean — pass through unchanged

    // Banned phrase detected — build safe, context-aware replacement
    var bs   = biz._bookingState;
    var lang = (bs && bs.lang) || 'en';
    var safe;

    if (bs && (bs.intent === 'booking_request' || bs.pendingAction)) {
      // In booking flow — ask for the next uncollected field
      if (!bs.services || bs.services.length === 0) {
        if (lang === 'vi') safe = 'Bạn muốn đặt dịch vụ gì ạ?';
        else if (lang === 'es') safe = '¿Qué servicio desea reservar?';
        else safe = 'What service would you like to book?';
      } else if (!bs.date) {
        if (lang === 'vi') safe = 'Bạn muốn đặt vào ngày nào ạ?';
        else if (lang === 'es') safe = '¿Qué día le viene bien?';
        else safe = 'What day works for you?';
      } else if (!bs.time) {
        if (lang === 'vi') safe = 'Bạn muốn đặt lúc mấy giờ ạ?';
        else if (lang === 'es') safe = '¿A qué hora prefiere?';
        else safe = 'What time would you prefer?';
      } else if (!bs.name) {
        if (lang === 'vi') safe = 'Cho mình biết tên của bạn được không ạ?';
        else if (lang === 'es') safe = '¿Me podría dar su nombre?';
        else safe = 'Could I get your name?';
      } else if (!bs.phone) {
        if (lang === 'vi') safe = 'Và số điện thoại của bạn ạ?';
        else if (lang === 'es') safe = '¿Y su número de teléfono?';
        else safe = 'And your phone number?';
      } else {
        if (lang === 'vi') safe = 'Để mình xác nhận cho bạn nhé!';
        else if (lang === 'es') safe = '¡Permítame confirmarle la reserva!';
        else safe = 'Let me get that confirmed for you!';
      }
    } else if (bs && bs.intent === 'staff_availability' && bs.staff) {
      if (lang === 'vi') safe = 'Bạn muốn đặt với ' + bs.staff + ' vào ngày và giờ nào ạ?';
      else if (lang === 'es') safe = '¿Qué día y hora desea con ' + bs.staff + '?';
      else safe = 'What day and time would you like with ' + bs.staff + '?';
    } else {
      if (lang === 'vi') safe = 'Mình có thể giúp gì cho bạn ạ?';
      else if (lang === 'es') safe = '¿En qué le puedo ayudar?';
      else safe = 'What can I help you with today?';
    }

    console.warn('[GUARD] _sanitizeResponse: banned phrase blocked before display.',
      'Pattern:', triggered,
      '| First 120 chars of original:', text.slice(0, 120),
      '| Replaced with:', safe);

    // Correct _aiHistory: overwrite Claude's bad text with the safe replacement
    // so future Claude turns don't see or build on the bad response.
    if (biz._aiHistory && biz._aiHistory.length &&
        biz._aiHistory[biz._aiHistory.length - 1].role === 'assistant') {
      biz._aiHistory[biz._aiHistory.length - 1].content = safe;
      _saveHistory(biz);
    }

    return { text: safe, escalationType: null, _wasSanitized: true };
  }

  // ── Marker parsing ────────────────────────────────────────────────────────────
  function _parseEscalationType(reply) {
    var m = reply.match(/\[ESCALATE:(order|appointment|reservation|question|cancel)\]/i);
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

  // ── Time helpers ──────────────────────────────────────────────────────────────

  // Parse "9:30 AM" or "9:30" (24h) → minutes since midnight
  function _parseTMins(t) {
    if (!t || typeof t !== 'string') return null;
    t = t.trim();
    var m12 = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (m12) {
      var h = +m12[1], mn = +(m12[2] || 0), ap = m12[3].toUpperCase();
      if (ap === 'PM' && h !== 12) h += 12;
      if (ap === 'AM' && h === 12) h = 0;
      return h * 60 + mn;
    }
    var m24 = t.match(/^(\d{1,2}):(\d{2})$/);
    if (m24) return +m24[1] * 60 + +m24[2];
    return null;
  }

  // Parse "9:30 AM – 7:30 PM" → { openMins, closeMins, openStr, closeStr }
  function _parseHoursRange(str) {
    if (!str || str === 'Closed') return null;
    var parts = str.split(/\s*[–-]\s*/);
    if (parts.length !== 2) return null;
    var om = _parseTMins(parts[0].trim());
    var cm = _parseTMins(parts[1].trim());
    if (om === null || cm === null) return null;
    return { openMins: om, closeMins: cm, openStr: parts[0].trim(), closeStr: parts[1].trim() };
  }

  // ── System prompt builder ─────────────────────────────────────────────────────
  function _buildPrompt(biz, langHint) {
    var today     = new Date();
    var todayIdx  = today.getDay();
    var todayName = DAYS[todayIdx];
    var dateStr   = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    var isoDate   = AIEngine.localISODate(today);

    // Current local time — injected so Claude can answer "open now?" correctly
    var nowMins  = today.getHours() * 60 + today.getMinutes();
    var nowStr   = today.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    // Time-of-day bucket for greeting rule (uses browser-local clock = customer's local time)
    var _hour       = today.getHours();
    var _timeOfDay  = _hour < 12 ? 'morning' : _hour < 18 ? 'afternoon' : 'evening';

    var receptionistName = (biz.aiReceptionist && biz.aiReceptionist.name) || 'Lily';
    var salonName = biz.name || 'this salon';
    var phone     = biz.phoneDisplay || biz.phone || '';
    var address   = biz.address || 'Bay Area, California';

    // Services block — prefer active Firestore services; fall back to full static catalog so
    // Claude always has service/price/duration knowledge even before vendor activates services.
    var services = biz.services || [];
    var shown = services.filter(function (s) { return s.active !== false; });
    if (shown.length === 0) {
      // No active services yet — use full static catalog (AI knowledge only, not shown publicly)
      var staticSvcs = biz._staticServices || [];
      shown = staticSvcs.slice(0, 40); // cap at 40 to stay within prompt size
    }
    var servicesBlock = shown.length > 0
      ? shown.map(function (s) {
          var line = '• ' + s.name;
          if (s.price) line += ' — $' + s.price;
          // Use durationMins (integer) if available, otherwise duration string
          if (s.durationMins) line += ' (' + s.durationMins + ' min)';
          else if (s.duration) line += ' (' + s.duration + ')';
          if (s.description) line += ': ' + s.description;
          return line;
        }).join('\n')
      : '(Service list not yet loaded — tell customer to call ' + phone + ' for menu.)';

    // Hours block — biz.hours can come in several formats:
    //   { Mon:'9:30 AM – 7:30 PM', ... }  — from _hoursScheduleToHours() (Firestore vendor-admin, 3-letter cap keys)
    //   { monday:{open,close}, ... }        — normalized full-name object format
    //   { 'Thứ 2–6':'9:00 AM – 7:00 PM' }  — static Vietnamese grouped keys (NOT day-by-day parseable)
    // If no per-day English keys are found, fall back to generic text so AI never sees all days as "Closed".
    var daysOrder = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
    var _hoursKey3 = { monday:'Mon', tuesday:'Tue', wednesday:'Wed', thursday:'Thu', friday:'Fri', saturday:'Sat', sunday:'Sun' };
    var hoursBlock;

    // Detect whether biz.hours has any recognizable per-day English keys
    var _hasPerDayHours = false;
    if (biz.hours) {
      daysOrder.forEach(function (d) {
        if (biz.hours[d] !== undefined || biz.hours[_hoursKey3[d]] !== undefined || biz.hours[d.slice(0,3)] !== undefined) {
          _hasPerDayHours = true;
        }
      });
    }

    if (biz.hours && _hasPerDayHours) {
      hoursBlock = daysOrder.map(function (d) {
        // Try all known key formats
        var h = biz.hours[d]                 // 'monday' (full lowercase)
             || biz.hours[_hoursKey3[d]]     // 'Mon' (3-letter cap — from _hoursScheduleToHours)
             || biz.hours[d.slice(0,3)];     // 'mon' (3-letter lower)
        var label  = d.charAt(0).toUpperCase() + d.slice(1);
        var marker = (d === todayName) ? ' ← TODAY' : '';
        if (!h) return label + ': Closed' + marker;
        // h is a string ('9:30 AM – 7:30 PM' or 'Closed') from _hoursScheduleToHours
        if (typeof h === 'string') {
          return h === 'Closed'
            ? label + ': Closed' + marker
            : label + ': ' + h + marker;
        }
        // h is an object {open, close}
        if (!h.open) return label + ': Closed' + marker;
        return label + ': ' + h.open + ' – ' + h.close + marker;
      }).join('\n');
    } else {
      // biz.hours is absent or uses non-parseable keys (e.g. Vietnamese grouped format).
      // Use safe generic hours — Firestore vendor-admin hours will override these once loaded.
      var _todayCap = todayName.charAt(0).toUpperCase() + todayName.slice(1);
      var _genericDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
      var _genericHrs  = ['9:00 AM – 7:00 PM','9:00 AM – 7:00 PM','9:00 AM – 7:00 PM','9:00 AM – 7:00 PM','9:00 AM – 7:00 PM','9:00 AM – 6:00 PM','10:00 AM – 5:00 PM'];
      hoursBlock = _genericDays.map(function (label, i) {
        return label + ': ' + _genericHrs[i] + (label === _todayCap ? ' ← TODAY' : '');
      }).join('\n');
    }

    // Safety net: if ALL 7 recognised days are 'Closed', this is almost certainly a vendor
    // misconfiguration (e.g. all "Đóng" boxes were checked when saving). Override with generic
    // defaults so the AI never tells customers the salon is permanently closed.
    if (_hasPerDayHours) {
      var _closedCount = 0;
      daysOrder.forEach(function (d) {
        var _h = biz.hours[d] || biz.hours[_hoursKey3[d]] || biz.hours[d.slice(0,3)];
        if (!_h || _h === 'Closed' || (typeof _h === 'object' && !_h.open)) _closedCount++;
      });
      if (_closedCount >= 7) {
        console.warn('[LilyReceptionist] All days in hoursSchedule are Closed — vendor admin misconfiguration. Using safe defaults.');
        _hasPerDayHours = false;
        var _tc = todayName.charAt(0).toUpperCase() + todayName.slice(1);
        var _gd = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
        var _gh = ['9:00 AM – 7:00 PM','9:00 AM – 7:00 PM','9:00 AM – 7:00 PM','9:00 AM – 7:00 PM','9:00 AM – 7:00 PM','9:00 AM – 6:00 PM','10:00 AM – 5:00 PM'];
        hoursBlock = _gd.map(function (label, i) {
          return label + ': ' + _gh[i] + (label === _tc ? ' ← TODAY' : '');
        }).join('\n');
      }
    }

    // Pre-compute today's real-time open/closed status so Claude doesn't have to reason about it
    // Extract today's hours string from the hoursBlock we already built
    var _todayHoursStr = null;
    hoursBlock.split('\n').forEach(function (line) {
      if (line.indexOf('← TODAY') >= 0) {
        var colon = line.indexOf(':');
        if (colon >= 0) _todayHoursStr = line.slice(colon + 1).replace('← TODAY', '').trim();
      }
    });
    var _todayRange   = _parseHoursRange(_todayHoursStr);
    var _isOpenNow    = _todayRange && nowMins >= _todayRange.openMins && nowMins < _todayRange.closeMins;
    var _todayStatus;
    if (!_todayHoursStr || _todayHoursStr === 'Closed') {
      _todayStatus = 'CLOSED (not open today)';
    } else if (_isOpenNow) {
      _todayStatus = 'OPEN NOW — closes at ' + (_todayRange ? _todayRange.closeStr : '?');
    } else if (_todayRange && nowMins < _todayRange.openMins) {
      _todayStatus = 'CLOSED NOW — opens today at ' + _todayRange.openStr;
    } else {
      _todayStatus = 'CLOSED NOW — already past closing time (' + (_todayRange ? _todayRange.closeStr : '?') + ')';
    }

    // Short-key map for schedule lookup — handles both storage formats:
    //   services-data.js / Firestore vendor-admin: { mon:{active,start,end}, tue:... }
    //   future normalized format:                  { monday:{open,close}, tuesday:... }
    var _shortKey = { monday:'mon', tuesday:'tue', wednesday:'wed', thursday:'thu', friday:'fri', saturday:'sat', sunday:'sun' };

    function _schedDay(schedule, longDay) {
      if (!schedule) return null;
      var s = schedule[longDay] || schedule[_shortKey[longDay]];
      if (!s) return null;
      // Normalize field names: start→open, end→close, active flag
      var open  = s.open  || s.start;
      var close = s.close || s.end;
      var off   = s.active === false || !open;
      return off ? null : { open: open, close: close };
    }

    // Parallel services block — live from vendor settings (biz._parallelServices)
    var parallelRules = (biz._parallelServices || []).filter(function(p) { return p.a && p.b; });
    var parallelBlock;
    if (parallelRules.length > 0) {
      parallelBlock = 'Yes — this salon supports PARALLEL BOOKINGS: two customers can be served simultaneously by different technicians.\n'
        + 'Configured simultaneous pairs:\n'
        + parallelRules.map(function(p) { return '• ' + p.a + ' + ' + p.b; }).join('\n');
    } else {
      parallelBlock = null; // omit section entirely when no rules configured
    }

    // Staff block
    var activeStaff = (biz.staff || []).filter(function (m) { return m.active !== false; });
    var staffBlock;
    if (activeStaff.length > 0) {
      staffBlock = activeStaff.map(function (m) {
        var header = '• ' + m.name + (m.role ? ' (' + m.role + ')' : (m.title ? ' (' + m.title + ')' : ''));
        var lines  = [header];
        if (m.schedule) {
          daysOrder.forEach(function (d) {
            var hrs    = _schedDay(m.schedule, d);
            var label  = d.charAt(0).toUpperCase() + d.slice(1);
            var marker = (d === todayName) ? ' ← TODAY' : '';
            if (!hrs) lines.push('    ' + label + ': OFF' + marker);
            else lines.push('    ' + label + ': ' + hrs.open + ' – ' + hrs.close + marker);
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

    var tomorrowIso = (function() { var d = new Date(); d.setDate(d.getDate()+1); return AIEngine.localISODate(d); })();
    var pendingActionStr = (biz._bookingState && biz._bookingState.pendingAction) || 'none';

    var voiceModeBlock = biz._isVoiceMode ? [
      '=== VOICE MODE — CRITICAL ===',
      'Customer is speaking — responses will be read aloud via text-to-speech.',
      'Keep every reply to 1–2 SHORT sentences. Maximum 25 words.',
      'No lists. No options rundowns. Ask ONE question at a time.',
      'Sound like a quick phone call, not a written message.',
      'WRONG: "I can offer you gel nails, acrylic nails, dip powder, or a manicure. Which would you like?"',
      'RIGHT: "Sure — gel or acrylic nails?"',
      '',
    ] : [];

    return voiceModeBlock.concat([
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
      '=== VIETNAMESE OUTPUT RULES (applies whenever lang = vi) ===',
      'RULE V1 — No English fragments inside Vietnamese sentences.',
      '  WRONG: "khung giờ 09:00 with Tracy đã có lịch"',
      '  RIGHT: "lúc 9:00 sáng với chị Tracy đã có lịch rồi ạ"',
      '  WRONG: "mình sẽ book cho bạn lúc 2pm với Helen"',
      '  RIGHT: "mình sẽ đặt lịch cho bạn lúc 2 giờ chiều với chị Helen nhé"',
      '  [BOOKING:...] and [STATE:...] markers are data — keep service names in English there.',
      'RULE V2 — Staff names take Vietnamese respectful prefix in text: "chị Tracy", "cô Helen", "anh/chị [name]".',
      '  Do NOT use a bare English name as subject: "Tracy có lịch" → "chị Tracy đã có lịch".',
      'RULE V3 — Time expressions use Vietnamese phrasing:',
      '  9:00 AM → "9 giờ sáng" or "lúc 9 giờ"   |   3:00 PM → "3 giờ chiều" or "lúc 3 giờ chiều"',
      '  When you must write a numeric time (9:00), always add "sáng"/"chiều"/"tối" beside it.',
      'RULE V4 — Service names in conversational text — use Vietnamese alongside English brand name:',
      '  Pedicure → "pedicure (làm móng chân)"   |   Manicure → "manicure (làm móng tay)"',
      '  Gel Manicure → "gel móng tay"            |   Gel Pedicure → "gel móng chân"',
      '  Acrylic → "acrylic (đắp bột)"            |   Dip Powder → "bột nhúng"',
      'RULE V5 — Connectors always in Vietnamese:',
      '  "with" → "với"   |   "at [time]" → "lúc"/"vào lúc"   |   "on [date]" → "vào ngày"',
      '  "available" → "còn trống"   |   "booked/taken" → "đã có lịch"   |   "confirmed" → "đã xác nhận"',
      '',
      '=== SALON INFO ===',
      'Name: ' + salonName,
      'Phone: ' + phone,
      'Address: ' + address,
      '',
      '=== REAL-TIME CLOCK ===',
      'Current local time: ' + nowStr,
      'Today\'s salon status: ' + _todayStatus,
      '',
      '=== GREETING RULE ===',
      'Current time of day: ' + _timeOfDay + '.',
      'When greeting, use time-appropriate salutation:',
      '  morning (before 12:00 PM): "Good morning" / "Buenos días" / "Chào buổi sáng"',
      '  afternoon (12:00–5:59 PM): "Good afternoon" / "Buenas tardes" / "Chào buổi chiều"',
      '  evening (6:00 PM+): "Good evening" / "Buenas noches" / "Chào buổi tối"',
      'NEVER use "Good day" — it does not reflect the actual time of day.',
      '',
      '=== HOURS (weekly schedule — live from vendor admin) ===',
      hoursBlock,
      '',
      '=== OPEN/CLOSED RULES (TWO SEPARATE CASES) ===',
      'CASE 1 — Customer asks "is the salon open now?" / "are you open right now?" / "are you still open?":',
      '  → Answer using REAL-TIME CLOCK above. The status is already computed for you.',
      '  → Examples: "We\'re closed right now — we open today at 9:00 AM." or "Yes, we\'re open until 7:00 PM!"',
      'CASE 2 — Customer books a FUTURE appointment on a specific day:',
      '  → Ignore current clock time. Check only if that day-of-week is listed as open in HOURS above.',
      '  → Do NOT apply industry assumptions (e.g., "nail salons close Mondays"). This salon\'s schedule is authoritative.',
      '',
      '=== SERVICES & PRICING (live) ===',
      servicesBlock,
      '',
    ].concat(parallelBlock ? [
      '=== PARALLEL / SIMULTANEOUS BOOKINGS (live from vendor settings) ===',
      parallelBlock,
      'When customer asks "do you offer parallel services?", "can two people book at the same time?",',
      '"can we come together?", "simultaneous booking", "book together", or similar:',
      '  → Answer YES and list the available pairs above.',
      '  → Explain: each person needs their own separate booking, each with a different technician.',
      '  → Offer to start one of the bookings now.',
      'When customer asks about a specific combination (e.g. "manicure and pedicure at the same time"):',
      '  → Check the configured pairs above. If the combination is listed → confirm it is allowed.',
      '  → If the combination is NOT listed → say only that pair is not in the simultaneous booking options.',
      '  → Do NOT invent combinations. Only confirm what is configured above.',
      '',
    ] : []).concat([
      '=== STAFF SCHEDULES (recurring weekly — same every week) ===',
      'For "next week" or any future date: look up the matching day-of-week below. The schedule repeats weekly.',
      staffBlock,
      selectedStaffCtx,
      '',
      bookingStateCtx,
      '',
      '=== FOLLOW-UP / PENDING ACTION — CRITICAL ===',
      'PENDING ACTION right now: ' + pendingActionStr,
      '',
      'When PENDING ACTION = booking_offer:',
      '  AFFIRMATIVE replies (yes / yeah / sure / okay / sounds good / sí / claro / por favor / dạ / vâng / được / ừ / ok):',
      '    → Intent = booking_request. Set pendingAction: null in STATE (transition is done — do NOT keep booking_offer).',
      '    → Continue the booking with the staff/date already in CURRENT BOOKING STATE.',
      '    → Do NOT reset. Do NOT give generic contact info. Ask for the next missing field.',
      '    → Next missing field order: service(s) → date → time → customer name → customer phone.',
      '    → Example: staff=Tracy, date=today → ask "What service would you like with Tracy?" or "What time today works for you?"',
      '  NEGATIVE replies (no / not now / maybe later / no thanks / không / chưa / no gracias):',
      '    → Acknowledge: "No problem! Let me know if there\'s anything else I can help with."',
      '    → Set pendingAction: null in STATE.',
      '',
      'When PENDING ACTION = none AND message is just "yes/no/sure" with no other content:',
      '  → If conversation history shows AI just asked a question, answer relative to that question.',
      '  → Otherwise ask: "What can I help you with today?"',
      '',
      '=== NAIL KNOWLEDGE ===',
      'Terms: gel, acrylic, dip powder, regular polish, manicure, pedicure, nail art, fill, removal.',
      'Fills typically every 2–3 weeks. Removal takes extra time — mention it when relevant.',
      '',
      '=== SERVICE DISAMBIGUATION RULES ===',
      'Before mapping customer input to a specific service, check for ambiguity:',
      '',
      'AMBIGUOUS — always clarify with ONE brief question:',
      '  "gel"           → could be Gel Manicure, Gel Pedicure, or Gel Polish (add-on)',
      '                    Ask: "Sure! Do you mean a gel manicure, gel pedicure, or gel polish as an add-on?"',
      '  "gel and manicure" → could be Gel Manicure (one service) OR Gel Polish + Classic Manicure (two)',
      '                    Ask: "Just to confirm — do you mean a gel manicure (gel applied on nails with shaping), or gel polish added on top of a classic manicure?"',
      '  "acrylic"       → could be Acrylic Full Set or Acrylic Fill',
      '                    Ask: "Is that a new acrylic full set, or a fill on existing acrylics?"',
      '  "fill" / "fills" → could be Acrylic Fill or Gel Fill',
      '                    Ask: "Are those acrylic fills or gel fills?"',
      '  "nails" alone   → too vague; ask what type',
      '',
      'CLEAR — map directly without asking:',
      '  "gel manicure", "gel nails", "gel mani"   → Gel Manicure',
      '  "gel pedicure", "gel pedi"                 → Gel Pedicure',
      '  "manicure", "mani", "classic manicure"     → Manicure',
      '  "pedicure", "pedi"                         → Pedicure',
      '  "mani pedi", "manicure and pedicure"        → Manicure + Pedicure',
      '  "acrylic full set", "new set", "full set"  → Acrylic Full Set',
      '  "acrylic fill", "fill-in"                  → Acrylic Fill',
      '  "dip", "dip powder", "dip nails"           → Dip Powder Nails',
      '  "nail art", "design"                        → Nail Art Design',
      '  "removal"                                   → Nail Removal',
      '',
      'VIETNAMESE SHORTCUTS — infer and confirm (do not force full menu):',
      '  "làm móng chân" / "móng chân" / "chân thôi" / "nails chân" → infer Pedicure.',
      '    Confirm: "Bạn muốn làm pedicure (móng chân) đúng không ạ?"',
      '  "làm móng tay" / "móng tay" / "tay thôi" / "nails tay" → infer Manicure.',
      '    Confirm: "Bạn muốn làm manicure (móng tay) đúng không ạ?"',
      '  "làm cả hai" / "tay lẫn chân" / "cả tay và chân" → infer Manicure + Pedicure.',
      '    Confirm: "Bạn muốn làm cả manicure và pedicure đúng không ạ?"',
      '  "gel chân" / "gel móng chân" → infer Gel Pedicure.',
      '    Confirm: "Bạn muốn gel pedicure (móng chân) đúng không ạ?"',
      '  "gel tay" / "gel móng tay" → infer Gel Manicure.',
      '    Confirm: "Bạn muốn gel manicure (gel móng tay) đúng không ạ?"',
      '  "đắp bột" / "đắp" → infer Acrylic Full Set. Confirm: "Đắp bột nguyên bộ hay fill đắp bột ạ?"',
      '  After confirmation, proceed with the inferred service — do not show the full menu.',
      '',
      'When in doubt, ask — one short clarifying question is better than booking the wrong service.',
      '',
      '=== YOUR RULES ===',
      '1. Answer naturally — you are a real receptionist, not a scripted bot.',
      '2. Never re-introduce yourself mid-conversation. No "Hi, I\'m Lily" after the first message.',
      '3. Use ONLY the data above (HOURS, STAFF, REAL-TIME CLOCK). Never invent or assume.',
      '4. Responses: 1–3 sentences for simple questions. Plain text always.',
      '5. Walk-ins: "Walk-ins welcome based on availability — we recommend calling ahead."',
      '6. Prices: The SERVICE MENU above has live prices. Always mention the price when answering a price question or discussing a specific service. If price is unknown: "Prices vary — please call ' + phone + ' for an exact quote."',
      '7. Pronouns her/him/she/he → most recently named technician. See ACTIVE CONTEXT above.',
      '8. Farewell (goodbye/bye/thanks/done) → 1 warm sentence only. Do NOT re-introduce yourself.',
      '9. ANTI-REPETITION — After the previous turn showed a slot conflict, do NOT repeat the same',
      '   explanation. Acknowledge in ONE short phrase, then immediately offer 2–3 specific options.',
      '   WRONG (repeat): "I\'m sorry, Tracy is fully booked at 3:00 PM. Here are the next available..."',
      '   RIGHT (pivot): "3 giờ cũng kín rồi — mình có 10:30 sáng hoặc 2 giờ chiều trống, bạn chọn khung nào?"',
      '   The pivot applies: same conflict type, same turn or the one right after. Move the conversation forward.',
      '10. UNCLEAR INPUT — When input is garbled, speech-like, or partially heard (e.g. "năm K em",',
      '   broken digits, incomplete words): ask ONE targeted clarification for the specific unclear part.',
      '   WRONG: repeat the full question ("Can you give me your name and phone number?")',
      '   RIGHT: "Mình chưa nghe rõ số điện thoại, bạn đọc lại giúp mình nhé?"',
      '          "Mình chưa nghe rõ 3 số cuối, bạn đọc lại giúp mình nhé?"',
      '   Never ask for information already confirmed in the current session.',
      '11. NAME ACCEPTANCE — Single Vietnamese first names are complete names.',
      '   "Thùy", "Lan", "Nam", "Hoa" — accept and record without asking for a last name.',
      '',
      '=== RESPONSE QUALITY — ALWAYS LEAD ===',
      '// RX-013: AI must never end a turn passively. Every response must move the conversation forward.',
      'After answering any question or showing a conflict/availability result, you MUST end with a clear next step.',
      'NEVER end with just a statement. Always close with a specific question or offer.',
      '',
      'Required patterns:',
      '  After conflict / alt slots  → "Which time works for you?" or "Would you like one of these, or prefer [name]?"',
      '  After alt staff suggestion  → "Would you like to book with [name] at [time]?"',
      '  After hours/location answer → "Would you like to book an appointment?"',
      '  After price answer          → "Would you like to schedule [service]?"',
      '  After service question      → "Which service would you like to book?"',
      '  After general info          → One sentence of info + "Anything I can help you with?"',
      '',
      'NEVER end a response with:',
      '  — A bare statement with no question ("Helen is available on Tuesday.")',
      '  — "Let me know if you need anything" (too vague — be specific)',
      '  — "Feel free to ask" (passive — always lead)',
      '',
      '=== INTENT CLASSIFICATION ===',
      'Classify each message as one of:',
      '  booking_request         — customer wants to make an appointment (including affirmative follow-ups to booking_offer)',
      '  service_question        — asking about what services are available',
      '  price_question          — asking about pricing',
      '  staff_availability      — asking about a technician\'s GENERAL schedule (no specific time):',
      '                            "Is Tracy working today?", "When does Helen come in?", "Does Loan work Fridays?"',
      '                            IMPORTANT: If the customer names a SPECIFIC TIME ("Is Tracy available at 9AM?",',
      '                            "Is Helen free at 3?", "Can I book Loan at 10:15?"), that is a booking_request,',
      '                            NOT staff_availability. Classify as booking_request and set time in STATE.',
      '  hours_location          — asking about hours, current open status, or address',
      '  cancel_booking          — customer wants to cancel an existing appointment',
      '  farewell                — goodbye, thanks, done',
      '  general                 — anything else',
      '',
      '=== ENTITY EXTRACTION ===',
      'From each message, extract:',
      '  services  — ALL services mentioned. Support MULTIPLE in one message.',
      '              "gel and pedicure" → ["Gel Nails","Pedicure"]',
      '              "mani pedi" → ["Manicure","Pedicure"]',
      '              "làm móng tay" → ["Manicure"]',
      '  staff     — technician name mentioned in THIS message. If customer switches from a prior staff ("how about Tracy", "what about [name]", "try someone else") → use the NEW name. "other tech"/"any available"/"whoever is free" → null. Do NOT inherit prior staff from STATE if customer explicitly mentions a different person or asks for someone else.',
      '  date      — as stated ("tomorrow", "next Monday", "April 10") or null',
      '  time      — convert to 24h if clear ("2pm" → "14:00", "2:30 chiều" → "14:30") or null.',
      '             Period as separator: "5.30", "05.30" → treat as "5:30" first, then apply AM/PM.',
      '             Vietnamese time words: "5 rưỡi" → 5:30 | "kém mười" → subtract 10 min | "nửa" → :30.',
      '             AMBIGUOUS TIME — hour 1–7 with no AM/PM context:',
      '               Do NOT silently default. Ask once:',
      '               (vi) "Bạn muốn [time] sáng (AM) hay [time] chiều (PM) ạ?"',
      '               (en) "Did you mean [time] AM or [time] PM?"',
      '             Exception: if earlier context clearly implies a session (morning/afternoon booking),',
      '             use that context to infer — no need to ask again.',
      '  lang      — "en", "es", or "vi" based on THIS message',
      '',
      '=== SYSTEM FEEDBACK MESSAGES ===',
      'When you see a user message starting with [SYSTEM: ...], it is an availability result from the backend.',
      'Respond naturally as the receptionist — relay the information warmly in the customer language.',
      'Never expose "[SYSTEM:]" or any technical detail to the customer.',
      '',
      '=== AVAILABILITY — CRITICAL RULE ===',
      'The SYSTEM validates real-time slot availability automatically — you do not need to and cannot do it yourself.',
      'Your job: collect service, staff preference, date, and time from the customer. The system checks the slot silently.',
      '',
      'BANNED PHRASES — never say these to a customer:',
      '  "I can\'t see real-time availability"',
      '  "I don\'t have access to real-time booking data"',
      '  "I cannot verify if that slot is open"',
      '  "I\'ll check if that\'s available" / "the system will check" / "let me verify"',
      '  "that time is available" / "Helen has a slot at 10" / "I can fit you in at 11"',
      'The first three claim you lack access (leaks internals). The last two claim availability you cannot confirm.',
      'Both are wrong. Collect the fields; the system does the rest.',
      '',
      'CORRECT: Ask what time the customer prefers without commenting on your data access.',
      '  "Tracy works until 7 PM today. What time works for you?"',
      '  "What day and time would you like?"',
      'If the customer asks "what times are available?" — give ONLY shift hours, never specific open slots.',
      '',
      'CRITICAL — SCHEDULE ≠ SLOT AVAILABILITY:',
      '  A staff shift start time is NOT proof that a slot is open.',
      '  Example: Tracy starts at 9AM does NOT mean the 9AM slot is free.',
      '  NEVER answer "Is Tracy available at 9AM?" with just her schedule/start time.',
      '  When a customer asks about a SPECIFIC TIME, classify as booking_request and let',
      '  the system validate the slot. Your role: collect the fields, not confirm availability.',
      '',
      '=== BOOKING FLOW ===',
      'When intent = booking_request:',
      '  A. Use entities from current message PLUS any already in CURRENT BOOKING STATE above.',
      '     Do NOT ask for fields already collected.',
      '  B. Identify the first MISSING required field in this order:',
      '     service(s) → date → time → [system validates slot] → customer name → customer phone',
      '     Staff is optional — "any available" is fine if customer does not specify.',
      '  C. Ask for exactly ONE missing field at a time. Be natural ("What day works for you?"',
      '     not "Please provide your preferred date.").',
      '  D. MULTIPLE SERVICES: Customers may book more than one service in a single appointment.',
      '     "Gel manicure and pedicure" → services: ["Gel Manicure","Pedicure"].',
      '     The total appointment duration = sum of all selected services.',
      '     When confirming multi-service bookings, mention the total time naturally:',
      '     "That will take about 2 hours total — you\'re all set!"',
      '  E. When ALL required fields are collected (service, date, time, name, phone):',
      '     DO NOT write a confirmation or claim the booking is confirmed — the system validates availability first.',
      '     Write only a brief, warm transitional phrase — one short sentence — then immediately emit the markers.',
      '     Use phrasing like:',
      '       "Let me get that booked for you!"',
      '       "Got it — checking your spot now!"',
      '       "Perfect — one moment!"',
      '       "¡Un momento!" (Spanish) / "Để tôi xác nhận cho bạn nhé!" (Vietnamese)',
      '     NEVER say "Your spot is reserved", "confirmed", "all set", "booked" — the booking is not final yet.',
      '     The system will confirm or redirect after checking availability.',
      '     Then on new lines:',
      '     [BOOKING:{"services":["Service1","Service2"],"staff":"<name or Any>","date":"YYYY-MM-DD","time":"HH:MM","name":"<name>","phone":"<phone>","lang":"<en|es|vi>"}]',
      '     [ESCALATE:appointment]',
      '     FAREWELL EXCEPTION: If intent = farewell — output ONLY the farewell sentence + STATE marker. NEVER output [BOOKING:...] or [ESCALATE:...] regardless of booking progress.',
      '     Convert relative dates to ISO using today (' + isoDate + ') as reference.',
      '     "tomorrow" → ' + tomorrowIso,
      '     "next Monday" → calculate from today.',
      '  F. After asking "Would you like to book an appointment?" — set pendingAction: "booking_offer" in STATE.',
      '     Keep staff and date in STATE so they persist for the follow-up "yes" turn.',
      '',
      '=== MODIFY / RESCHEDULE DETECTION ===',
      'When customer says: "reschedule", "change my appointment", "move my appointment", "I need to change",',
      '  "can I change my booking", "dời lịch", "thay đổi lịch", "đổi lịch", "cambiar mi cita", "reagendar":',
      '  → Set pendingAction: "modify_booking" in STATE.',
      '  → SAME-SESSION: If services AND name AND phone ARE already in CURRENT BOOKING STATE:',
      '     Carry them over. Ask ONLY for the new date and/or time. Do NOT re-ask for service/name/phone.',
      '  → CROSS-SESSION: If services/name/phone are NOT in CURRENT BOOKING STATE (new browser session):',
      '     Ask: "Of course! Could you give me your phone number so I can look up your appointment?"',
      '     Do NOT ask for date/time yet. Do NOT guess services. The system will find the booking once phone is known.',
      '  → When new date + time are confirmed, emit [BOOKING:...] + [ESCALATE:appointment] as normal.',
      '  → IMPORTANT: Keep pendingAction: "modify_booking" in the STATE marker even on the final [BOOKING:...] turn.',
      '  → Do NOT clear pendingAction to null for reschedules — this flag is required to update the existing record.',
      '',
      'When customer has a booking conflict (e.g. already booked same time) and says "replace it", "replace", "yes, change", "change it":',
      '  → Set pendingAction: "modify_booking" in STATE.',
      '  → Keep services, staff, name, phone. Set time: null (new time needed). Keep date unless customer says different day.',
      '  → Ask ONCE for their preferred new time. Do NOT re-show the conflict message.',
      '  → If they say "keep it" → acknowledge booking stands, set pendingAction: null.',
      '  → If they say "different time" or "other time" → same as "replace it": set time: null, ask for new time.',
      '',
      '=== CANCEL BOOKING ===',
      'When customer says: "cancel my appointment", "cancel it", "I want to cancel", "please cancel",',
      '  "hủy lịch", "hủy hẹn", "cancelar mi cita", "quiero cancelar":',
      '  → If name AND phone are already in CURRENT BOOKING STATE:',
      '     Confirm warmly (e.g. "Of course — I\'ve cancelled your appointment. Sorry to see you go!"),',
      '     then emit [ESCALATE:cancel] on a new line. Do NOT emit [BOOKING:...] for cancellations.',
      '  → If name/phone are NOT in CURRENT BOOKING STATE:',
      '     Ask: "Of course! Can you confirm your name and phone number so I can locate your booking?"',
      '     Once confirmed, emit [ESCALATE:cancel].',
      '  → Do NOT tell the customer to call the salon to cancel — handle it directly.',
      '',
      '=== CONFLICT RESOLUTION — STAFF SWITCH ===',
      'After showing a conflict for one technician, if customer says:',
      '  "how about Tracy", "what about [name]", "try [name]", "other tech", "any other technician",',
      '  "ai trống", "người khác", "whoever is free", "anyone else", "any available tech":',
      '  → Intent = booking_request.',
      '  → If a specific new name is mentioned → set staff to that name in STATE.',
      '  → If vague ("other tech", "anyone") → set staff to null in STATE.',
      '  → KEEP date and time from CURRENT BOOKING STATE — do NOT clear or re-ask.',
      '  → Do NOT carry forward the conflicting staff name.',
      '  → Do NOT repeat the previous conflict message — check availability for the new staff.',
      '',
      '=== STATE MARKER — REQUIRED ON EVERY REPLY ===',
      'Append this at the very end of EVERY reply (after all text and any other markers):',
      '[STATE:{"intent":"<intent>","services":[<array>],"staff":<null or "Name">,"date":<null or "YYYY-MM-DD or today">,"time":<null or "HH:MM">,"name":<null or "Name">,"phone":<null or "phone">,"lang":"<en|es|vi>","pendingAction":<null or "booking_offer" or "modify_booking">,"existingBookingId":<null or "id">}]',
      '',
      'STATE rules:',
      '  - Merge with CURRENT BOOKING STATE above — carry forward non-null fields.',
      '  - services: always an array. Empty [] if none mentioned.',
      '  - All non-array fields: null (JSON null, no quotes) if unknown.',
      '  - lang: detected language of THIS customer message.',
      '  - pendingAction: "booking_offer" after asking "Would you like to book?"; "modify_booking" during any reschedule — keep it set THROUGH the [BOOKING:...] turn, do NOT clear to null; null for all other cases.',
      '  - existingBookingId: null unless an existing booking ID was provided or found; carry forward once set.',
      '',
      'STATE examples:',
      '"Is Tracy working today?" → general schedule question, no specific time → staff_availability:',
      '[STATE:{"intent":"staff_availability","services":[],"staff":"Tracy","date":"' + isoDate + '","time":null,"name":null,"phone":null,"lang":"en","pendingAction":"booking_offer","existingBookingId":null}]',
      '',
      '"Is Tracy available at 9AM today?" / "Can I book Helen at 3?" → SPECIFIC TIME → booking_request (not staff_availability):',
      '[STATE:{"intent":"booking_request","services":[],"staff":"Tracy","date":"' + isoDate + '","time":"09:00","name":null,"phone":null,"lang":"en","pendingAction":null,"existingBookingId":null}]',
      '',
      '"Yes" (after booking_offer with Tracy):',
      '[STATE:{"intent":"booking_request","services":[],"staff":"Tracy","date":"' + isoDate + '","time":null,"name":null,"phone":null,"lang":"en","pendingAction":null,"existingBookingId":null}]',
      '',
      '"I need to reschedule my appointment" (customer already has services/name/phone in STATE):',
      '[STATE:{"intent":"booking_request","services":["Gel Manicure"],"staff":"Tracy","date":null,"time":null,"name":"Jane","phone":"4085551234","lang":"en","pendingAction":"modify_booking","existingBookingId":null}]',
      '',
      '"Gel manicure and pedicure tomorrow with Tracy":',
      '[STATE:{"intent":"booking_request","services":["Gel Manicure","Pedicure"],"staff":"Tracy","date":"' + tomorrowIso + '","time":null,"name":null,"phone":null,"lang":"en","pendingAction":null,"existingBookingId":null}]',
      '',
      '"Mình muốn đặt lịch làm móng gel ngày mai lúc 2 giờ":',
      '[STATE:{"intent":"booking_request","services":["Gel Nails"],"staff":null,"date":"' + tomorrowIso + '","time":"14:00","name":null,"phone":null,"lang":"vi","pendingAction":null,"existingBookingId":null}]',
      '',
      '"¿Cuánto cuesta gel manicure?":',
      '[STATE:{"intent":"price_question","services":["Gel Manicure"],"staff":null,"date":null,"time":null,"name":null,"phone":null,"lang":"es","pendingAction":null,"existingBookingId":null}]',
    ])).join('\n');
  }

  // ── Pending-confirmation messages (shown after avail check passes, before vendor confirms) ──
  // These replace Claude's premature "confirmed" text.
  // Status: AVAILABLE_NOT_CONFIRMED → shown to customer while waiting for vendor.
  function _buildPendingConfirmMsg(biz, draft) {
    var salon = biz.name || 'the salon';
    var lang  = (draft && draft.lang) || 'en';
    if (lang === 'vi') return 'Yêu cầu của bạn đã được gửi đến ' + salon + ' và đang chờ xác nhận. Chúng tôi sẽ nhắn tin cho bạn khi tiệm xác nhận.';
    if (lang === 'es') return 'Su solicitud ha sido enviada a ' + salon + ' y está pendiente de confirmación. Le enviaremos un mensaje en cuanto el salón confirme.';
    return 'Your request has been sent to ' + salon + ' and is pending confirmation. We\'ll text you as soon as the salon confirms.';
  }

  // Shown when early availability check passes and slot has NOT yet been offered to customer.
  // Replaces Claude's speculative "What's your name?" with an explicit availability confirm.
  // Status: SLOT_CONFIRMED_AVAILABLE — customer must accept before contact details are collected.
  function _buildAvailConfirmMsg(biz, draft) {
    var staff = draft.staff || 'Your technician';
    var t24   = draft.time || '';
    // HH:MM (24h) → friendly 12h display
    var timeDisplay = (function () {
      var p = t24.split(':');
      if (p.length < 2) return t24;
      var h = parseInt(p[0], 10), m = parseInt(p[1], 10) || 0;
      var ap = h < 12 ? 'AM' : 'PM';
      h = h % 12 || 12;
      return h + (m ? ':' + ('0' + m).slice(-2) : '') + ' ' + ap;
    })();
    var svcs = (draft.services && draft.services.length > 0) ? draft.services.join(' + ') : null;

    // Price estimate — look up each service from live vendor data
    var prices = (draft.services || []).map(function(sn) { return _priceForService(biz, sn); }).filter(Boolean);
    var priceHint = prices.length ? ' (' + prices.join(' + ') + ')' : '';

    var lang = (draft && draft.lang) || 'en';
    if (lang === 'vi') return staff + ' có thể phục vụ bạn lúc ' + timeDisplay + (svcs ? ' cho dịch vụ ' + svcs + priceHint : '') + '. Bạn có muốn đặt lịch không?';
    if (lang === 'es') return staff + ' está disponible a las ' + timeDisplay + (svcs ? ' para ' + svcs + priceHint : '') + '. ¿Desea reservar?';
    return staff + ' is available at ' + timeDisplay + (svcs ? ' for ' + svcs + priceHint : '') + '. Would you like to book that?';
  }

  // Shown at 60-second mark if vendor has not yet confirmed (status still PENDING_VENDOR_CONFIRMATION).
  function _buildTextBackMsg(biz, draft) {
    var phone = draft && draft.phone ? draft.phone : null;
    var lang  = (draft && draft.lang) || 'en';
    if (lang === 'vi') return 'Chưa có xác nhận. Chúng tôi sẽ nhắn tin cho bạn' + (phone ? ' tại ' + phone : '') + ' khi tiệm xác nhận lịch hẹn.';
    if (lang === 'es') return 'Aún no hay confirmación. Le enviaremos un mensaje' + (phone ? ' al ' + phone : '') + ' cuando el salón confirme su cita.';
    return 'No confirmation yet. We\'ll text you' + (phone ? ' at ' + phone : '') + ' once the salon confirms your appointment.';
  }

  // Localized generic slot-rejection message for catch/fallback paths where the
  // AI could not re-phrase the English avail.message in the customer's language.
  function _rejectionFallback(lang) {
    if (lang === 'vi') return 'Rất tiếc, khung giờ đó không còn trống. Bạn có muốn chọn ngày/giờ khác không?';
    if (lang === 'es') return 'Lo sentimos, ese horario no está disponible. ¿Desea elegir otra fecha u hora?';
    return 'Sorry, that time is no longer available. Would you like to choose a different date or time?';
  }

  // ── Fallback (no API key / network error) ────────────────────────────────────
  // Must handle: yes/no follow-ups, open-now questions, staff queries, bookings.
  // Uses biz._aiHistory to understand context (last AI message = pending question).
  function _fallback(biz, text) {
    var phone = biz.phoneDisplay || biz.phone || '';
    var name  = biz.name || 'this salon';
    var t     = text.toLowerCase().trim();
    var lang  = _detectLang(text);

    // ── Check last AI message for pending booking offer ───────────────────────
    var lastAiMsg = '';
    if (biz._aiHistory) {
      for (var i = biz._aiHistory.length - 1; i >= 0; i--) {
        if (biz._aiHistory[i].role === 'assistant') {
          lastAiMsg = (biz._aiHistory[i].content || '').toLowerCase();
          break;
        }
      }
    }
    var pendingBookingOffer = /would you like to book|want to book|shall i book|book an appointment|đặt lịch không|muốn đặt không|¿quieres reservar|¿te gustaría reservar/.test(lastAiMsg);

    // ── Affirmative detection (all 3 languages) ───────────────────────────────
    var isAffirmative = /^(yes|yeah|yep|yup|sure|ok|okay|sounds good|great|perfect|definitely|please|go ahead|absolutely|of course|why not|let'?s do it)$/i.test(t)
      || /^(s[ií]|claro|por supuesto|dale|perfecto|bueno|de acuerdo|va bien|está bien)$/i.test(t)
      || /^(dạ|vâng|ừ|được|ok|oke|tốt|có|muốn|đặt đi)$/i.test(t);

    // ── Negative detection ────────────────────────────────────────────────────
    var isNegative = /^(no|nope|not now|maybe later|no thanks|never mind|cancel|nah)$/i.test(t)
      || /^(no gracias|ahora no|tal vez después|no por ahora)$/i.test(t)
      || /^(không|chưa|thôi|không cần|để sau)$/i.test(t);

    // ── Pending booking offer + affirmative → continue booking ────────────────
    if (pendingBookingOffer && isAffirmative) {
      var pendingStaff = biz._bookingState && biz._bookingState.staff;
      var pendingDate  = biz._bookingState && biz._bookingState.date;
      if (lang === 'vi') {
        return pendingStaff
          ? 'Tuyệt! Bạn muốn làm dịch vụ gì với ' + pendingStaff + '?'
          : 'Tuyệt! Bạn muốn đặt dịch vụ gì hôm nay?';
      }
      if (lang === 'es') {
        return pendingStaff
          ? '¡Perfecto! ¿Qué servicio le gustaría reservar con ' + pendingStaff + '?'
          : '¡Perfecto! ¿Qué servicio le gustaría reservar?';
      }
      return pendingStaff
        ? 'Great! What service would you like to book with ' + pendingStaff + '?'
        : 'Great! What service would you like to book today?';
    }

    // ── Pending booking offer + negative → graceful exit ─────────────────────
    if (pendingBookingOffer && isNegative) {
      if (lang === 'vi') return 'Không sao! Nếu cần gì thêm, cứ nhắn nhé.';
      if (lang === 'es') return '¡Sin problema! Avísenos si necesita algo más.';
      return 'No problem! Let me know if there\'s anything else I can help with.';
    }

    // ── Lone affirmative with no booking context → gentle redirect ────────────
    if (isAffirmative) {
      if (lang === 'vi') return 'Bạn muốn đặt lịch hay hỏi về dịch vụ nào ạ?';
      if (lang === 'es') return '¿En qué le puedo ayudar? ¿Desea reservar una cita o tiene alguna pregunta?';
      return 'Of course! What can I help you with — would you like to book an appointment or do you have a question?';
    }

    // ── Real-time open/closed ─────────────────────────────────────────────────
    // Catches: "is it open now", "are you open", "when will you open", "what time do you open",
    //          "still open", "is the store open", "when do you open"
    if (/open.?now|open.?right.?now|still open|open.?today|closed.?now|currently open|are you open|is it open|is the.{0,10}open|when.{0,10}open|what time.{0,10}open/i.test(t)
      || /abierto.?ahora|están abiertos|cuándo abren|a qué hora abren|siguen abiertos/i.test(t)
      || /mở.?cửa.?chưa|đang mở|còn mở|giờ.?này.?mở|mấy giờ mở|khi nào mở/i.test(t)) {
      var _now = new Date();
      var _nowMins = _now.getHours() * 60 + _now.getMinutes();
      var _nowStr  = _now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      // Use generic fallback hours for open/now check
      var _dayIdx  = _now.getDay(); // 0=Sun
      var _defOpen = [600, 570, 570, 570, 570, 570, 570]; // Sun=10am, Mon-Sat=9:30am
      var _defClose= [1020,1140,1140,1140,1140,1140,1080]; // Sun=5pm, Mon-Fri=7pm, Sat=6pm
      var _opens   = _defOpen[_dayIdx], _closes = _defClose[_dayIdx];
      var _openStr = (_opens >= 720 ? (_opens-720)/60 : _opens/60);
      // Build readable time strings
      function _mToStr(m) { var h=Math.floor(m/60),mn=m%60,ap=h<12?'AM':'PM'; h=h%12||12; return h+(mn?':'+('0'+mn).slice(-2):'')+' '+ap; }
      if (lang === 'vi') {
        if (_nowMins < _opens) return 'Tiệm chưa mở cửa. Hôm nay mở lúc ' + _mToStr(_opens) + '. Bạn cần gì cứ nhắn nhé!';
        if (_nowMins >= _closes) return 'Tiệm đã đóng cửa rồi. Ngày mai chúng tôi sẽ mở lúc ' + _mToStr(_opens) + ' nhé!';
        return 'Dạ tiệm đang mở cửa! Đóng cửa lúc ' + _mToStr(_closes) + ' hôm nay. Bạn cần đặt lịch không?';
      }
      if (lang === 'es') {
        if (_nowMins < _opens) return 'Aún estamos cerrados. Abrimos hoy a las ' + _mToStr(_opens) + '.';
        if (_nowMins >= _closes) return 'Ya cerramos por hoy. Mañana abrimos a las ' + _mToStr(_opens) + '.';
        return '¡Sí, estamos abiertos! Cerramos a las ' + _mToStr(_closes) + ' hoy. ¿Le gustaría reservar?';
      }
      if (_nowMins < _opens) return 'We\'re closed right now — we open today at ' + _mToStr(_opens) + '.';
      if (_nowMins >= _closes) return 'We\'re closed for today. We\'ll be back tomorrow at ' + _mToStr(_opens) + '.';
      return 'Yes, we\'re open right now until ' + _mToStr(_closes) + ' today! Would you like to book an appointment?';
    }

    // ── Vietnamese handlers ───────────────────────────────────────────────────
    if (lang === 'vi') {
      if (/giờ|mở|đóng|lịch làm việc/.test(t)) return 'Chúng tôi mở cửa Thứ 2–6: 9:30–19:30, Thứ 7: 9:30–19:00, Chủ nhật: 10:00–18:00. Gọi ' + phone + ' để đặt lịch nhé!';
      if (/giá|bao nhiêu|chi phí/.test(t))      return 'Giá dịch vụ tuỳ loại. Vui lòng gọi ' + phone + ' để biết giá chính xác nhé!';
      if (/đặt|lịch|hẹn|book/.test(t))           return 'Để đặt lịch, bạn gọi ' + phone + ' nhé. Chúng tôi sẽ sắp xếp thời gian phù hợp cho bạn!';
      return 'Cảm ơn bạn đã liên hệ ' + name + '! Vui lòng gọi ' + phone + ' để được hỗ trợ ngay.';
    }

    // ── Spanish handlers ──────────────────────────────────────────────────────
    if (lang === 'es') {
      if (/hora|horario|abre|cierra/.test(t)) return 'Nuestro horario: Lun–Vie 9:30am–7:30pm, Sáb 9:30am–7pm, Dom 10am–6pm. Llame al ' + phone + '.';
      if (/precio|costo|cuánto/.test(t))      return 'Los precios varían según el servicio. Llame al ' + phone + ' para un presupuesto exacto.';
      if (/cita|reserva|agendar/.test(t))     return 'Para agendar una cita llame al ' + phone + '. ¡Le encontraremos el horario perfecto!';
      return '¡Gracias por contactar a ' + name + '! Para asistencia inmediata llame al ' + phone + '.';
    }

    // ── English: staff availability ───────────────────────────────────────────
    if (/staff|technician|working|available|when|today|schedule|helen|tracy/i.test(t)) {
      var _fbnow   = new Date();
      var _fbDow   = DAYS[_fbnow.getDay()];
      var _fbShort = { sunday:'sun', monday:'mon', tuesday:'tue', wednesday:'wed', thursday:'thu', friday:'fri', saturday:'sat' };
      var _fbSsDow = _fbShort[_fbDow];
      var _staffList = (biz.staff || []).filter(function (m) { return m.active !== false; });
      var _named = null;
      _staffList.forEach(function (m) { if (t.indexOf(m.name.toLowerCase()) >= 0) _named = m; });
      if (_named) {
        var _sch = _named.schedule || {};
        var _sd  = _sch[_fbDow] || _sch[_fbSsDow];
        var _ot  = _sd && (_sd.open  || _sd.start);
        var _ct  = _sd && (_sd.close || _sd.end);
        if (!_sd || _sd.active === false || !_ot) {
          return _named.name + ' is not working today. Call ' + phone + ' for their next available day.';
        }
        // Time-aware: compare NOW against the actual shift window
        function _parseShiftMins(s) { var p=String(s||'').split(':'); return parseInt(p[0],10)*60+(parseInt(p[1],10)||0); }
        function _fmtShift(s) { var p=String(s||'').split(':'),h=parseInt(p[0],10),m=parseInt(p[1],10)||0,ap=h<12?'AM':'PM'; return (h%12||12)+(m?':'+('0'+m).slice(-2):'')+' '+ap; }
        var _fbCurMins = _fbnow.getHours() * 60 + _fbnow.getMinutes();
        var _fbStart   = _parseShiftMins(_ot);
        var _fbEnd     = _parseShiftMins(_ct);
        if (_fbEnd > 0 && _fbCurMins >= _fbEnd) {
          return _named.name + '\'s shift ended at ' + _fmtShift(_ct) + ' today, and the salon is closed now. We reopen tomorrow at 9:00 AM.';
        }
        if (_fbStart > 0 && _fbCurMins < _fbStart) {
          return _named.name + ' starts at ' + _fmtShift(_ot) + ' today and is not here yet. Would you like to book an appointment for later?';
        }
        return _named.name + ' is working right now until ' + _fmtShift(_ct) + '. Would you like to book an appointment?';
      }
      var _todayStaff = _staffList.filter(function (m) {
        var _s = (m.schedule || {}); var _d = _s[_fbDow] || _s[_fbSsDow];
        return _d && _d.active !== false && (_d.open || _d.start);
      }).map(function (m) { return m.name; });
      if (_todayStaff.length > 0) return 'Working today: ' + _todayStaff.join(' and ') + '. Use the booking form or call ' + phone + '!';
      return 'Our technicians are experienced professionals. Use the booking form above or call ' + phone + '.';
    }

    // ── English: generic handlers ─────────────────────────────────────────────
    if (/hour|open|close/.test(t)) return 'We\'re open Mon–Fri 9:30am–7:30pm, Sat 9:30am–7pm, Sun 10am–6pm. Call ' + phone + ' to confirm current hours.';
    if (/walk.?in/.test(t))        return 'Walk-ins welcome based on availability! Call ' + phone + ' to check wait times.';
    if (/price|cost|how much/.test(t)) return 'Prices vary by service. Call us at ' + phone + ' or ask about a specific service.';
    if (/book|appoint|reserv/.test(t)) return 'Use the booking form above to select your services and request an appointment!';
    return 'Thank you for contacting ' + name + '! For immediate help please call ' + phone + '.';
  }

  // ── History persistence — delegates to shared AIEngine ───────────────────────
  function _saveHistory(biz) {
    AIEngine.saveHistory('lily_h_' + biz.id, biz._aiHistory);
  }

  function _restoreHistory(biz) {
    if (biz._aiHistory && biz._aiHistory.length > 0) return;
    var saved = AIEngine.restoreHistory('lily_h_' + biz.id);
    if (saved) biz._aiHistory = saved;
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

    // Await the in-flight fresh Firestore read before building the prompt.
    // On the first message after page load this waits for _fetchLiveBizData() to finish
    // (typically ~200-500ms) so biz.staff/hours/services reflect the latest admin changes.
    // On subsequent messages biz._dataPromise is null → Promise.resolve() → zero added latency.
    var _ready = biz._dataPromise || Promise.resolve();
    return _ready.then(function() {

    return _maybeHandleSalonCustomerMemory(biz, text, lang).then(function(memoryResult) {
      if (memoryResult && memoryResult.directResponse) {
        biz._aiHistory.push({ role: 'assistant', content: memoryResult.directResponse });
        _saveHistory(biz);
        return { text: memoryResult.directResponse, escalationType: null };
      }

      if (memoryResult && memoryResult.systemContext) {
        biz._aiHistory.push({ role: 'user', content: '[SYSTEM: ' + memoryResult.systemContext + ']' });
        _saveHistory(biz);
      }

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

    // RX-021: capture pendingAction BEFORE the API call so the early check (in send()) and
    // the isModify guard (below) can distinguish modify_booking set THIS turn vs a prior turn.
    // Stored on biz so it survives into the async send() callback.
    biz._prevPendingAction = (biz._bookingState && biz._bookingState.pendingAction) || null;

    // ── API call via unified dispatcher (model + tokens from AIEngine.SERVICE_CONFIG.nails) ──
    // Phase 5: pass intent so the router can prefer OpenAI for booking-critical turns.
    // Booking intents (booking_request, modify_booking, booking_offer) → OpenAI when key set.
    // Informational intents (price_question, staff_availability, etc.) → Gemini when key set.
    // Safe fallback: Claude is always used if preferred provider key is absent or request fails.
    var _routeIntent = (biz._bookingState && biz._bookingState.intent) || null;
    return AIEngine.call('nails', apiKey, systemPrompt,
      biz._aiHistory.map(function (m) {
        return { role: m.role, content: m.content };
      }),
      { intent: _routeIntent }
    )
    .then(function (data) {
      var raw = (data.content && data.content[0] && data.content[0].text) || '';

      // 1. Parse and merge STATE marker
      // Capture pendingAction BEFORE merge — Claude clears it to null on the
      // final booking turn, so we need the prior value to detect reschedules.
      var _prevPendingAction = biz._bookingState && biz._bookingState.pendingAction;
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

      // 2. Parse BOOKING marker; attach modify metadata from STATE before state gets reset in step 4
      var bookingData = _parseBookingMarker(raw);
      if (bookingData) {
        if (stateUpdate && stateUpdate.existingBookingId) bookingData.existingBookingId = stateUpdate.existingBookingId;
        // isModify: current STATE has pendingAction:'modify_booking' (primary, now kept through final BOOKING turn)
        // OR prior turn had it (fallback for older conversations)
        // OR existingBookingId is set in STATE
        var _isModFromState = !!(stateUpdate && stateUpdate.pendingAction === 'modify_booking');
        var _isModFromPrev  = (_prevPendingAction === 'modify_booking');
        var _isModFromId    = !!(stateUpdate && stateUpdate.existingBookingId);
        if (_isModFromState || _isModFromPrev || _isModFromId) {
          bookingData.isModify = true;
          // RX-021: stale-time contamination guard.
          // If modify_booking came ONLY from this turn's STATE (not from a prior turn,
          // not from an explicit existingBookingId, not from a cross-session lookup),
          // AND the booking time exactly matches the last confirmed time — Claude is reusing
          // the previously confirmed slot rather than the time the user just requested.
          // Clear isModify so the availability check runs without the reschedule bypass,
          // which would catch the stale slot as a staff conflict.
          if (_isModFromState && !_isModFromPrev && !_isModFromId && !biz._xsLookupDone) {
            if (biz._lastConfirmedTime && bookingData.time &&
                bookingData.time === biz._lastConfirmedTime) {
              bookingData.isModify = false;
              console.warn('[RX-021] Stale confirmed-time reuse detected (booking=' +
                bookingData.time + ' == lastConfirmed=' + biz._lastConfirmedTime +
                ') — clearing isModify to force full availability check');
            }
          }
        }
        biz._bookingDraft = bookingData;
      }

      // 3. Parse ESCALATE marker
      var escalationType = _parseEscalationType(raw);

      // 3b. Farewell guard — never escalate on goodbye/thanks/done
      if (stateUpdate && stateUpdate.intent === 'farewell') {
        escalationType = null;
      }

      // 4. State is intentionally NOT reset here.
      //    send() manages state after the availability check outcome is known:
      //      confirmed  → reset state (booking finalised)
      //      rejected   → preserve state (customer only needs to fix the invalid slot)

      // 5. Strip all markers from displayed text
      var clean = _stripAllMarkers(raw);

      // 6. Phase 4 — response quality validation
      // Checks: lang consistency (warn), booking draft completeness (suppress escalation
      // when services=[]), passive ending (warn). See _validateResponseQuality for details.
      var _qv = _validateResponseQuality(biz, clean, escalationType, lang);
      if (_qv.suppressEscalate) {
        escalationType = null; // drop the escalation — Claude will be asked again
      }

      biz._aiHistory.push({ role: 'assistant', content: clean });
      _markExpectingPhoneFromReply(biz, clean);
      _saveHistory(biz);

      return { text: clean, escalationType: escalationType };
    });
    });
    }); // end _ready.then — guarantees first-message prompt uses fresh Firestore data
  }

  // ── DOM helpers ───────────────────────────────────────────────────────────────
  var _BOT_AVATAR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>';

  function _appendMessage(messagesEl, text, who) {
    var div    = document.createElement('div');
    div.className = 'mp-ai__msg mp-ai__msg--' + who;
    if (who === 'bot') {
      var av = document.createElement('div');
      av.className = 'mp-ai__msg__avatar';
      av.innerHTML = _BOT_AVATAR_SVG;
      div.appendChild(av);
    }
    var bubble = document.createElement('div');
    bubble.className = 'mp-ai__bubble';
    bubble.textContent = text;
    div.appendChild(bubble);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function _appendHtmlMessage(messagesEl, htmlContent) {
    var div = document.createElement('div');
    div.className = 'mp-ai__msg mp-ai__msg--bot';
    var av = document.createElement('div');
    av.className = 'mp-ai__msg__avatar';
    av.innerHTML = _BOT_AVATAR_SVG;
    div.appendChild(av);
    var bubble = document.createElement('div');
    bubble.className = 'mp-ai__bubble mp-ai__bubble--packet';
    bubble.innerHTML = htmlContent;
    div.appendChild(bubble);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ── Calendar helpers ─────────────────────────────────────────────────────────

  function _padN(n) { return ('0' + n).slice(-2); }

  function _fmtIcsLocal(date, time) {
    // 'YYYY-MM-DD', 'HH:MM' → 'YYYYMMDDTHHMMSS' (local wall-clock)
    return date.replace(/-/g, '') + 'T' + time.replace(':', '') + '00';
  }

  function _buildGCalUrl(ev) {
    var endD = new Date(ev.date + 'T' + ev.time + ':00');
    endD.setTime(endD.getTime() + (ev.durationMins || 60) * 60000);
    var endDate = endD.getFullYear() + '-' + _padN(endD.getMonth()+1) + '-' + _padN(endD.getDate());
    var endTime = _padN(endD.getHours()) + ':' + _padN(endD.getMinutes());
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      '&text='     + encodeURIComponent(ev.title) +
      '&dates='    + _fmtIcsLocal(ev.date, ev.time) + '/' + _fmtIcsLocal(endDate, endTime) +
      '&details='  + encodeURIComponent(ev.description || '') +
      '&location=' + encodeURIComponent(ev.location || '');
  }

  function _buildIcsUrl(ev) {
    var endD = new Date(ev.date + 'T' + ev.time + ':00');
    endD.setTime(endD.getTime() + (ev.durationMins || 60) * 60000);
    var endDate = endD.getFullYear() + '-' + _padN(endD.getMonth()+1) + '-' + _padN(endD.getDate());
    var endTime = _padN(endD.getHours()) + ':' + _padN(endD.getMinutes());
    var now = new Date();
    var nowStr = now.getUTCFullYear() + _padN(now.getUTCMonth()+1) + _padN(now.getUTCDate()) +
      'T' + _padN(now.getUTCHours()) + _padN(now.getUTCMinutes()) + _padN(now.getUTCSeconds()) + 'Z';
    var lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0',
      'PRODID:-//Du Lich Cali//Booking//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:dlc-' + Date.now() + '@dulichcali21.com',
      'DTSTAMP:' + nowStr,
      'DTSTART;TZID=America/Los_Angeles:' + _fmtIcsLocal(ev.date, ev.time),
      'DTEND;TZID=America/Los_Angeles:'   + _fmtIcsLocal(endDate, endTime),
      'SUMMARY:'     + (ev.title       || '').replace(/[,;]/g, '\\$&'),
      'LOCATION:'    + (ev.location    || '').replace(/[,;]/g, '\\$&'),
      'DESCRIPTION:' + (ev.description || '').replace(/\n/g, '\\n').replace(/[,;]/g, '\\$&'),
      'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR',
    ];
    return 'data:text/calendar;charset=utf8,' + encodeURIComponent(lines.join('\r\n'));
  }

  // ── genId — compact unique booking reference ──────────────────────────────────

  function _genBookingId() {
    return 'DLC-' + Date.now().toString(36).toUpperCase().slice(-5) +
           Math.random().toString(36).slice(2, 4).toUpperCase();
  }

  // ── _priceForService — look up price from biz.services data ─────────────────

  function _priceForService(biz, serviceName) {
    // Price comes exclusively from live vendor Firestore data (biz.services).
    // Claude's system prompt is built from the same source, so service names match.
    var key = (serviceName || '').trim().toLowerCase();
    var svcs = biz.services || [];
    for (var i = 0; i < svcs.length; i++) {
      var s = svcs[i];
      if (!s.name) continue;
      if (s.name.trim().toLowerCase() === key) {
        if (s.price == null || s.price === '') return null;
        // Normalize: ensure exactly one $ prefix and + suffix regardless of how vendor stored it
        // (e.g. 20, "20", "20+", "$20", "$20+" all → "$20+")
        var p = String(s.price).trim();
        if (!p.startsWith('$')) p = '$' + p;
        if (!p.endsWith('+')) p = p + '+';
        return p;
      }
    }
    return null;
  }

  // ── _buildConfirmedNatural — natural-language sentence ───────────────────────

  function _buildConfirmedNatural(biz, draft, lang) {
    var svcs = Array.isArray(draft.services) ? draft.services : [];
    var svcStr = svcs.join(' + ') || 'appointment';
    var timeStr = (function () {
      if (!draft.time) return '';
      var p = draft.time.split(':'), h = parseInt(p[0]), m = parseInt(p[1] || 0);
      var ap = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12;
      return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
    })();
    if (lang === 'vi') {
      return 'Lịch hẹn ' + svcStr + (draft.staff ? ' với ' + draft.staff : '') +
             (timeStr ? ' lúc ' + timeStr : '') + ' đã được xác nhận.';
    }
    if (lang === 'es') {
      return 'Tu cita de ' + svcStr + (draft.staff ? ' con ' + draft.staff : '') +
             (timeStr ? ' a las ' + timeStr : '') + ' ha sido confirmada.';
    }
    return 'Your ' + svcStr + (draft.staff ? ' with ' + draft.staff : '') +
           (timeStr ? ' at ' + timeStr : '') + ' is confirmed and booked.';
  }

  // ── _buildClosingNatural — warm closing shown AFTER confirmation card + photo widget ──

  function _buildClosingNatural(lang) {
    if (lang === 'vi') return 'Chúng tôi rất mong được gặp bạn! Nếu cần thay đổi hoặc đặt thêm dịch vụ, cứ nhắn cho mình nhé.';
    if (lang === 'es') return '¡Con gusto la esperamos! Si necesita cambiar algo o reservar otro servicio, no dude en escribirnos.';
    return 'We look forward to seeing you! Feel free to reach out if you need to make any changes or book anything else.';
  }

  // ── _buildCashTipNote — optional vendor-controlled gratuity note (Part 1 — Phase 5C) ──
  // Returns null when disabled; returns vendor custom text or a premium default message.

  function _buildCashTipNote(biz, lang) {
    if (!biz._enableCashTipNote) return null;
    // Vendor-supplied custom text takes precedence
    if (biz._cashTipNoteText) return biz._cashTipNoteText;
    // Premium default — warm, gracious, conversational, never pushy
    if (lang === 'vi') {
      return 'Mẹo nhỏ: nhiều khách hay mang theo ít tiền mặt để cảm ơn trực tiếp kỹ thuật viên — hoàn toàn tùy bạn thôi nhé! 😊';
    }
    if (lang === 'es') {
      return 'Un pequeño detalle: muchos de nuestros clientes prefieren traer un poco de efectivo para agradecer personalmente a su técnica — es totalmente opcional.';
    }
    return 'Quick tip: many of our guests like to bring a little cash to thank their technician directly — totally optional, just a thoughtful touch!';
  }

  // ── _buildBookingPacketHtml — card rendered in chat after confirmation ────────

  function _buildBookingPacketHtml(biz, draft, orderId, lang) {
    var svcs = Array.isArray(draft.services) ? draft.services : [];
    var svcStr = svcs.join(' + ') || '—';

    // Price: sum from biz.services data
    var prices = svcs.map(function(sn) { return _priceForService(biz, sn); }).filter(Boolean);
    var priceStr = prices.length ? prices.join(' + ') : null;

    // Date
    var dateStr = '';
    if (draft.date) {
      try {
        var d = new Date(draft.date + 'T12:00:00');
        var DOWS = { vi:['CN','T2','T3','T4','T5','T6','T7'], en:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], es:['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'] };
        var MONS = { vi:['tháng 1','tháng 2','tháng 3','tháng 4','tháng 5','tháng 6','tháng 7','tháng 8','tháng 9','tháng 10','tháng 11','tháng 12'], en:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], es:['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'] };
        var dl = DOWS[lang] || DOWS.en, ml = MONS[lang] || MONS.en;
        dateStr = lang === 'vi' ? dl[d.getDay()] + ', ' + d.getDate() + ' ' + ml[d.getMonth()] : dl[d.getDay()] + ', ' + ml[d.getMonth()] + ' ' + d.getDate();
      } catch(e) { dateStr = draft.date; }
    }

    // Time
    var timeStr = '';
    if (draft.time) {
      var tp = draft.time.split(':'), th = parseInt(tp[0]), tm2 = parseInt(tp[1] || 0);
      var tap = th < 12 ? 'AM' : 'PM'; th = th % 12 || 12;
      timeStr = th + ':' + (tm2 < 10 ? '0' : '') + tm2 + ' ' + tap;
    }

    // Labels (all three languages)
    var L = {
      vi: { header:'✅ Lịch Hẹn Đã Xác Nhận', svc:'Dịch vụ', staff:'Kỹ thuật viên', date:'Ngày', time:'Giờ', price:'Giá từ', loc:'Địa điểm', phone:'Điện thoại', ref:'Mã đặt chỗ', foot:'Nếu có thay đổi, chúng tôi sẽ nhắn tin cho bạn.', gcal:'📅 Google Calendar', ics:'⬇ Lưu vào Calendar' },
      en: { header:'✅ Appointment Confirmed', svc:'Service', staff:'Technician', date:'Date', time:'Time', price:'Est. from', loc:'Location', phone:'Phone', ref:'Booking ID', foot:"If anything changes, we'll text you.", gcal:'📅 Google Calendar', ics:'⬇ Save to Calendar' },
      es: { header:'✅ Cita Confirmada', svc:'Servicio', staff:'Técnica', date:'Fecha', time:'Hora', price:'Precio desde', loc:'Ubicación', phone:'Teléfono', ref:'N.° de cita', foot:'Si algo cambia, te avisaremos por mensaje.', gcal:'📅 Google Calendar', ics:'⬇ Guardar en Calendario' },
    };
    var lbl = L[lang] || L.en;

    // Resolve location
    var locStr = biz.address || biz.shortAddress || null;

    // Build calendar event
    var calEvent = {
      title: (biz.name || 'Du Lịch Cali') + ' — ' + svcStr,
      date:  draft.date || '',
      time:  draft.time || '09:00',
      durationMins: draft.totalDurationMins || 60,
      location: locStr || (biz.name || '') + ', Bay Area, CA',
      description: [
        draft.staff ? ('Technician: ' + draft.staff) : null,
        'Services: ' + svcStr,
        priceStr    ? ('Est.: ' + priceStr) : null,
        draft.name  ? ('Customer: ' + draft.name) : null,
        'Booking ID: ' + orderId,
        'Contact: ' + (biz.phoneDisplay || biz.phone || '+1 (408) 916-3439'),
      ].filter(Boolean).join('\n'),
    };
    var gcalUrl = (draft.date && draft.time) ? _buildGCalUrl(calEvent) : null;
    var icsUrl  = (draft.date && draft.time) ? _buildIcsUrl(calEvent) : null;

    // Build rows
    var rows = [
      [lbl.svc, svcStr],
      draft.staff ? [lbl.staff, draft.staff] : null,
      dateStr     ? [lbl.date,  dateStr]     : null,
      timeStr     ? [lbl.time,  timeStr]     : null,
      priceStr    ? [lbl.price, priceStr]    : null,
      locStr      ? [lbl.loc,   locStr]      : null,
      (biz.phoneDisplay || biz.phone) ? [lbl.phone, biz.phoneDisplay || biz.phone] : null,
      [lbl.ref, orderId],
    ].filter(Boolean);

    var S = 'style=';
    var rowHtml = rows.map(function(r) {
      return '<div ' + S + '"display:flex;justify-content:space-between;gap:.5rem;padding:.34rem 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:.8rem">' +
        '<span ' + S + '"color:#718096;white-space:nowrap;flex-shrink:0">' + r[0] + '</span>' +
        '<span ' + S + '"color:#f0e6d3;text-align:right;font-weight:500">' + r[1] + '</span>' +
      '</div>';
    }).join('');

    var calHtml = (gcalUrl && icsUrl) ?
      '<div ' + S + '"display:flex;gap:.5rem;margin-top:.85rem">' +
        '<a href="' + gcalUrl + '" target="_blank" rel="noopener" ' + S + '"flex:1;display:block;text-align:center;padding:.48rem .4rem;border-radius:6px;background:rgba(200,146,42,.18);border:1px solid rgba(200,146,42,.4);color:#e8b84b;font-size:.72rem;font-weight:700;text-decoration:none;letter-spacing:.03em">' + lbl.gcal + '</a>' +
        '<a href="' + icsUrl + '" download="appointment.ics" ' + S + '"flex:1;display:block;text-align:center;padding:.48rem .4rem;border-radius:6px;background:rgba(200,146,42,.08);border:1px solid rgba(200,146,42,.28);color:#e8b84b;font-size:.72rem;font-weight:700;text-decoration:none;letter-spacing:.03em">' + lbl.ics + '</a>' +
      '</div>' : '';

    return '<div ' + S + '"background:linear-gradient(135deg,rgba(8,18,40,.96),rgba(14,25,52,.96));border:1px solid rgba(200,146,42,.35);border-radius:12px;padding:1rem 1.1rem;max-width:340px">' +
      '<div ' + S + '"font-size:.88rem;font-weight:700;color:#e8b84b;margin-bottom:.75rem;letter-spacing:.02em">' + lbl.header + '</div>' +
      rowHtml +
      '<div ' + S + '"margin-top:.7rem;font-size:.76rem;color:#718096;font-style:italic">' + lbl.foot + '</div>' +
      calHtml +
    '</div>';
  }

  // ── Cross-session booking lookup messages (RX-014/015) ───────────────────────
  function _buildFoundBookingMsg(biz, booking, lang) {
    var svcs  = (booking.services && booking.services.length)
      ? booking.services.join(' + ')
      : (booking.serviceType || 'your appointment');
    var staffSfx  = booking.staff ? ' with ' + booking.staff    : '';
    var staffSfxV = booking.staff ? ' với '  + booking.staff    : '';
    var staffSfxE = booking.staff ? ' con '  + booking.staff    : '';
    var d = booking.requestedDate || '';
    var t = booking.requestedTime || '';
    var tSfx  = t ? ' at '    + t : '';
    var tSfxV = t ? ' lúc '   + t : '';
    var tSfxE = t ? ' a las ' + t : '';
    if (lang === 'vi') return 'Tìm thấy lịch hẹn của bạn: ' + svcs + staffSfxV + (d ? ' vào ngày ' + d : '') + tSfxV + '. Bạn muốn đổi sang ngày giờ nào?';
    if (lang === 'es') return 'Encontré tu cita: ' + svcs + staffSfxE + (d ? ' el ' + d : '') + tSfxE + '. ¿A qué nueva fecha y hora quieres reagendarla?';
    return 'Found your appointment: ' + svcs + staffSfx + (d ? ' on ' + d : '') + tSfx + '. What new date and time would you like?';
  }

  function _buildNoBookingFoundMsg(lang, phone) {
    if (lang === 'vi') return 'Tôi không tìm thấy lịch hẹn nào với số điện thoại ' + phone + '. Bạn có muốn đặt lịch mới không?';
    if (lang === 'es') return 'No encontré ninguna cita con el número ' + phone + '. ¿Le gustaría hacer una nueva reserva?';
    return 'I couldn\'t find any upcoming appointment for ' + phone + '. Would you like to make a new booking instead?';
  }

  // ── _lookupActiveBookingByPhone — shared Firestore lookup utility (Phase 3) ──
  // Queries customerPhone (primary) then legacy 'phone' field (fallback).
  // Returns Promise<Array<QueryDocumentSnapshot>> of confirmed/in_progress docs,
  // sorted most-recent-first by createdAt. Callers decide what action to take.
  function _lookupActiveBookingByPhone(db, vid, phone) {
    var _actv = ['confirmed', 'in_progress'];
    var _sortDesc = function (docs) {
      return docs.slice().sort(function (a, b) {
        var ta = a.data().createdAt, tb = b.data().createdAt;
        return (ta && ta.toMillis && tb && tb.toMillis) ? tb.toMillis() - ta.toMillis() : 0;
      });
    };
    return db.collection('vendors').doc(vid).collection('bookings')
      .where('customerPhone', '==', phone)
      .get()
      .then(function (snap) {
        var active = snap.docs.filter(function (d) { return _actv.indexOf(d.data().status) >= 0; });
        if (active.length) return _sortDesc(active);
        // Fallback: legacy 'phone' field (bookings before customerPhone standardisation)
        return db.collection('vendors').doc(vid).collection('bookings')
          .where('phone', '==', phone)
          .get()
          .then(function (s2) {
            return _sortDesc(s2.docs.filter(function (d) { return _actv.indexOf(d.data().status) >= 0; }));
          });
      });
  }

  // ── Cross-session modify: look up booking by phone and pre-populate STATE (RX-015) ──
  // When a customer returns in a new browser session and wants to reschedule,
  // sessionStorage is gone so services/staff/name are empty.  This function
  // queries Firestore by phone, finds the most recent active booking, pre-populates
  // biz._bookingState, and injects a "found your booking" message into the chat.
  // The NEXT customer turn will see the populated state and proceed with date/time.
  function _xsBookingLookup(biz, phone, messagesEl, lang) {
    var db  = window.dlcDb;
    var vid = biz.id || biz.slug || '';
    if (!db || !vid) return;
    _lookupActiveBookingByPhone(db, vid, phone)
      .then(function (active) {
        if (!active || !active.length) {
          // No active booking found — inform customer and cancel the modify flow
          var noMsg = _buildNoBookingFoundMsg(lang, phone);
          biz._aiHistory = biz._aiHistory || [];
          biz._aiHistory.push({ role: 'assistant', content: noMsg });
          _saveHistory(biz);
          _appendMessage(messagesEl, noMsg, 'bot');
          biz._bookingState.pendingAction = null;
          _saveBookingState(biz);
          return;
        }
        // active is already sorted desc by createdAt
        var bookingDoc = active[0];
        var booking    = bookingDoc.data();
        var bookingId  = bookingDoc.id;
        // Pre-populate booking state with found booking details so the modify flow
        // carries real service/staff/name into the new booking record.
        var foundSvcs = booking.services && booking.services.length
          ? booking.services
          : (booking.serviceType ? [booking.serviceType] : []);
        biz._bookingState.services          = foundSvcs;
        biz._bookingState.staff             = booking.staff || null;
        biz._bookingState.name              = booking.customerName || booking.name || null;
        biz._bookingState.existingBookingId = bookingId;
        biz._lastBookingId                  = bookingId;
        _saveBookingState(biz);
        // Inject "found your booking" message into chat + AI history
        var foundMsg = _buildFoundBookingMsg(biz, booking, lang);
        biz._aiHistory.push({ role: 'assistant', content: foundMsg });
        _saveHistory(biz);
        _appendMessage(messagesEl, foundMsg, 'bot');
      })
      .catch(function (e) { console.warn('[xsLookup] Firestore error:', e.message); });
  }

  // ── _submitDirectBooking — writes 'confirmed' to Firestore, shows packet ─────

  function _submitDirectBooking(biz, draft, messagesEl) {
    var lang   = draft.lang || 'en';
    var svcs   = Array.isArray(draft.services) ? draft.services : [];
    var svcStr = svcs.join(' + ');
    var vendorId = biz.id || biz.slug || 'unknown';
    var db = window.dlcDb;
    var fv = db && firebase && firebase.firestore ? firebase.firestore.FieldValue : null;

    // ── Booking ID strategy ────────────────────────────────────────────────────────
    // RESCHEDULE with exact ID → reuse existing doc ID (update in place, same record).
    // RESCHEDULE without ID    → generate new ID (old bookings marked 'rescheduled').
    // NEW booking              → generate new ID.
    // ⚠️ INVARIANT: do NOT change isExactReschedule logic — it controls whether we
    //   update in-place (reschedule) or create a new doc (new booking).
    var isExactReschedule = !!(draft.isModify && draft.existingBookingId);
    var finalBookingId    = isExactReschedule ? draft.existingBookingId : _genBookingId();

    // Natural-language confirmation (factual sentence only — closing appended after photo widget)
    var confirmMsg = _buildConfirmedNatural(biz, draft, lang);
    var closingMsg = _buildClosingNatural(lang);
    // Build tip note here — needed both for the voice spoken hook below and for display after
    // the closing message. Moving it up avoids computing it twice.
    var tipNote    = _buildCashTipNote(biz, lang);

    // Voice mode: pre-build the full spoken confirmation before the first bubble is appended.
    // _watchForBotBubble fires on the FIRST bot bubble (confirmMsg) and disconnects immediately.
    // closingMsg and tipNote arrive as separate subsequent bubbles that the observer never sees.
    // setNextSpoken() feeds the complete spoken text as a one-shot override so voice speaks the
    // full intended confirmation — confirm + closing + tip note — in a single natural utterance.
    if (window.DLCVoiceMode && typeof window.DLCVoiceMode.setNextSpoken === 'function') {
      var _vmSpoken = confirmMsg + ' ' + closingMsg;
      if (tipNote) _vmSpoken += ' ' + tipNote;
      window.DLCVoiceMode.setNextSpoken(_vmSpoken);
    }

    biz._aiHistory = biz._aiHistory || [];
    // History stores the full message (factual + closing) as a single assistant turn
    biz._aiHistory.push({ role: 'assistant', content: confirmMsg + ' ' + closingMsg });
    _saveHistory(biz);
    // Show only the factual sentence now — closing will appear AFTER card + photo widget
    _appendMessage(messagesEl, confirmMsg, 'bot');

    // Booking packet card with calendar buttons
    var packetHtml = _buildBookingPacketHtml(biz, draft, finalBookingId, lang);
    _appendHtmlMessage(messagesEl, packetHtml);

    // ── Post-booking context: restore name/phone/services for follow-up cancel/modify ──
    // ⚠️ INVARIANT: this block MUST remain. Removing it breaks cancel/modify after booking.
    // biz._bookingState was cleared before _submitDirectBooking was called.
    // Do NOT set existingBookingId in STATE — it would tag any new booking as a reschedule.
    // Use biz._lastBookingId for direct cancel/modify lookup instead.
    biz._lastBookingId          = finalBookingId;
    // RX-021: track the confirmed date/time so stale-time contamination can be detected.
    // When a new booking request arrives with a different time, these are used to recognize
    // that Claude is reusing the old confirmed slot rather than honoring the new request.
    biz._lastConfirmedDate      = draft.date || null;
    biz._lastConfirmedTime      = draft.time || null;
    biz._bookingState.services  = svcs;
    biz._bookingState.staff     = draft.staff || null;
    biz._bookingState.name      = draft.name  || null;
    biz._bookingState.phone     = draft.phone || null;
    biz._bookingState.lang      = lang;
    _saveBookingState(biz);

    // Write to Firestore (non-blocking — customer sees confirmation immediately)
    if (db && fv) {
      var vendorBookingsRef = db.collection('vendors').doc(vendorId).collection('bookings');
      var svcPrices = svcs.map(function(sn) { return _priceForService(biz, sn); }).filter(Boolean);

      if (isExactReschedule) {
        // ── UPDATE EXISTING BOOKING IN PLACE ──────────────────────────────────────
        // Same Firestore doc ID — preserves booking history (createdAt, customerName/Phone).
        // Only mutable fields (time, staff, services) are overwritten.
        // ⚠️ INVARIANT: use .update() NOT .delete()+.set() — must preserve booking history.
        vendorBookingsRef.doc(finalBookingId).update({
          services:         svcs,
          selectedServices: svcs,
          serviceType:      svcStr,
          staff:            draft.staff || null,
          requestedDate:    draft.date  || '',
          requestedTime:    draft.time  || '',
          durationMins:     draft.totalDurationMins || 60,
          priceEst:         svcPrices.join(' + '),
          status:           'confirmed',
          isReschedule:     true,
          rescheduledAt:    fv.serverTimestamp(),
        }).catch(function(e) { console.warn('[reschedule] in-place update failed:', e.message); });
      } else {
        // ── FALLBACK RESCHEDULE (no exact ID) ────────────────────────────────────
        // Mark all confirmed bookings for this phone as rescheduled, then create new doc.
        if (draft.isModify && draft.phone) {
          vendorBookingsRef
            .where('customerPhone', '==', draft.phone)
            .where('status', '==', 'confirmed')
            .get()
            .then(function(snap) {
              snap.docs.forEach(function(d) {
                d.ref.update({ status: 'rescheduled', rescheduledAt: fv.serverTimestamp() })
                  .catch(function(e) { console.warn('[reschedule] mark-rescheduled failed:', e.message); });
              });
            })
            .catch(function(e) { console.warn('[reschedule] lookup failed:', e.message); });
        }

        // ── CREATE NEW BOOKING DOC ────────────────────────────────────────────────
        // Use requestedDate/requestedTime to match vendor-admin schema (orderBy('requestedDate'))
        var bookingDoc = {
          bookingId:        finalBookingId,
          type:             'nail_appointment',
          vendorId:         vendorId,
          services:         svcs,
          selectedServices: svcs,          // explicit alias for vendor-admin multi-service rendering
          serviceType:      svcStr,        // single string alias for backward compat
          staff:            draft.staff || null,
          requestedDate:    draft.date  || '',
          requestedTime:    draft.time  || '',
          durationMins:     draft.totalDurationMins || 60,
          priceEst:         svcPrices.join(' + '),
          customerName:     draft.name  || '',
          customerPhone:    draft.phone || '',
          name:             draft.name  || '', // alias for backward compat
          phone:            draft.phone || '', // alias for backward compat
          notes:            draft.notes || '',
          lang:             lang,
          status:           'confirmed',
          isReschedule:     draft.isModify ? true : false,
          source:           'lily_receptionist',
          createdAt:        fv.serverTimestamp(),
        };
        vendorBookingsRef.doc(finalBookingId).set(bookingDoc)
          .catch(function(e) { console.warn('[booking] Firestore write failed:', e.message); });

        // Analytics: nail appointment conversion
        if (window.DLCAnalytics) {
          DLCAnalytics.track('appointment_booked', {
            vendor_id:    vendorId,
            service_type: svcStr,
            is_reschedule: isExactReschedule,
            lang:         lang
          });
        }
      }

      // Show image upload widget after packet
      _showRefImageWidget(messagesEl, vendorId, finalBookingId, vendorBookingsRef, lang);

      var notifTitle = isExactReschedule ? '🔄 Đổi lịch hẹn — ' : '💅 Lịch hẹn — ';
      var notifLines = [
        (isExactReschedule ? '🔄 ĐỔI LỊCH — ' : '💅 LỊCH HẸN MỚI — ') + finalBookingId,
        '💆 Dịch vụ: ' + svcStr,
        draft.staff ? '👩 Kỹ thuật viên: ' + draft.staff : null,
        '📅 ' + (draft.date || '') + ' lúc ' + (draft.time || ''),
        '👤 ' + (draft.name || '') + ' · ' + (draft.phone || ''),
      ].filter(Boolean).join('\n');
      db.collection('vendors').doc(vendorId).collection('notifications').add({
        type:          isExactReschedule ? 'appointment_rescheduled' : 'new_appointment',
        title:         notifTitle + (draft.name || ''),
        message:       notifLines,
        bookingId:     finalBookingId,
        customerName:  draft.name  || '',
        customerPhone: draft.phone || '',
        services:      svcs,
        serviceType:   svcStr,
        staff:         draft.staff || null,
        requestedDate: draft.date  || '',
        requestedTime: draft.time  || '',
        read:          false,
        createdAt:     fv.serverTimestamp(),
      }).catch(function(e) { console.warn('[notif] Firestore write failed:', e.message); });
    }

    // Warm closing always appears as the last visible element — after card + photo widget.
    // Outside the if(db) block so it fires whether or not Firestore is available.
    _appendMessage(messagesEl, closingMsg, 'bot');

    // Optional cash tip note — shown only when vendor enables it (Part 1 — Phase 5C)
    // tipNote was already computed above (near confirmMsg) for the voice spoken hook.
    if (tipNote) _appendMessage(messagesEl, tipNote, 'bot');

    // ── Optional email confirmation ────────────────────────────────────────────
    // Booking is already confirmed and saved. This is purely additive — the customer
    // can skip and it has zero effect on the booking. _emailState is cleared by the
    // send() intercept once the customer responds (or on session end).
    biz._emailState = {
      bookingId: finalBookingId,
      vendorId:  vendorId,
      draft: {
        name:     draft.name  || '',
        services: svcs,
        staff:    draft.staff || null,
        date:     draft.date  || '',
        time:     draft.time  || '',
        lang:     lang,
      },
    };
    var emailAskMsg = lang === 'vi'
      ? 'Bạn có muốn nhận email xác nhận không? Hãy nhập địa chỉ email, hoặc nhập "bỏ qua".'
      : lang === 'es'
        ? '¿Desea recibir un email de confirmación? Escriba su correo o "omitir".'
        : 'Would you like a confirmation email? Reply with your email address, or type "skip."';
    _appendMessage(messagesEl, emailAskMsg, 'bot');
  }

  // ── Email queue writer ────────────────────────────────────────────────────────
  // Called when customer provides a valid email after booking confirmation.
  // Writes to vendors/{vendorId}/emailQueue → triggers Cloud Function → sends email.
  // Completely non-blocking — booking is already saved regardless of email outcome.
  // Also stamps customerEmail on the booking doc for Phase 2 inbound matching.
  function _queueBookingEmail(biz, customerEmail, emailState) {
    var db = window.dlcDb;
    if (!db) return;
    var fv = firebase && firebase.firestore ? firebase.firestore.FieldValue : null;
    var emailDoc = {
      bookingId:     emailState.bookingId,
      vendorId:      emailState.vendorId,
      customerEmail: customerEmail,
      customerName:  emailState.draft.name     || '',
      services:      emailState.draft.services || [],
      staff:         emailState.draft.staff    || null,
      requestedDate: emailState.draft.date     || '',
      requestedTime: emailState.draft.time     || '',
      lang:          emailState.draft.lang     || 'en',
      shopName:      (biz.aiReceptionist && biz.aiReceptionist.name) || biz.businessName || biz.name || '',
      shopPhone:     biz.phone     || biz.businessPhone    || '',
      shopAddress:   biz.address   || biz.businessAddress  || '',
      shopUrl:       'https://www.dulichcali21.com/' + (biz.category === 'hair' ? 'hairsalon' : 'nailsalon') + '?id=' + (biz.id || ''),
      status:        'pending',
    };
    if (fv) emailDoc.createdAt = fv.serverTimestamp();
    db.collection('vendors').doc(emailState.vendorId)
      .collection('emailQueue').add(emailDoc)
      .then(function () {
        // Stamp customerEmail on the booking doc so Phase 2 inbound replies can match.
        db.collection('vendors').doc(emailState.vendorId)
          .collection('bookings').doc(emailState.bookingId)
          .update({ customerEmail: customerEmail })
          .catch(function () {});
      })
      .catch(function (e) { console.warn('[email] emailQueue write failed:', e.message); });
  }

  // ── Reference image upload widget ────────────────────────────────────────────
  // Shown after booking confirmation. Lets customer attach 1-5 reference photos.
  // Uploads to Firebase Storage → saves URLs to booking doc's referenceImages field.

  function _showRefImageWidget(messagesEl, vendorId, orderId, vendorBookingsRef, lang) {
    var widgetId  = 'ref-img-' + orderId;
    var inputId   = widgetId + '-input';
    var previewId = widgetId + '-previews';
    var statusId  = widgetId + '-status';
    var btnId     = widgetId + '-btn';
    var skipId    = widgetId + '-skip';

    var labels = {
      vi: { title: '📷 Ảnh tham khảo (tùy chọn)', sub: 'Thêm ảnh để thợ biết kiểu bạn muốn', btn: 'Chọn ảnh', skip: 'Bỏ qua' },
      en: { title: '📷 Reference photos (optional)', sub: 'Add photos so your technician knows the style you want', btn: 'Choose photos', skip: 'Skip' },
      es: { title: '📷 Fotos de referencia (opcional)', sub: 'Agrega fotos para que tu técnica sepa el estilo', btn: 'Elegir fotos', skip: 'Omitir' }
    };
    var L = labels[lang] || labels['en'];

    var html =
      '<div class="ns-img-upload" id="' + widgetId + '">' +
        '<div class="ns-img-upload__title">' + L.title + '</div>' +
        '<div class="ns-img-upload__sub">' + L.sub + '</div>' +
        '<input type="file" accept="image/*" multiple id="' + inputId + '" style="display:none">' +
        '<div class="ns-img-upload__row">' +
          '<button class="ns-img-upload__btn" id="' + btnId + '">' + L.btn + '</button>' +
          '<button class="ns-img-upload__skip" id="' + skipId + '">' + L.skip + '</button>' +
        '</div>' +
        '<div class="ns-img-upload__previews" id="' + previewId + '"></div>' +
        '<div class="ns-img-upload__status" id="' + statusId + '"></div>' +
      '</div>';

    _appendHtmlMessage(messagesEl, html);

    // Attach all event listeners after DOM is ready (onclick attrs can't reach IIFE scope)
    setTimeout(function() {
      var input = document.getElementById(inputId);
      var btn   = document.getElementById(btnId);
      var skip  = document.getElementById(skipId);
      if (btn && input) btn.addEventListener('click', function() { input.click(); });
      if (skip) skip.addEventListener('click', function() {
        var el = document.getElementById(widgetId);
        if (el) el.style.display = 'none';
      });
      if (input) input.addEventListener('change', function() {
        _uploadRefImages(input.files, vendorId, orderId, vendorBookingsRef, previewId, statusId, lang);
      });
    }, 150);
  }

  function _uploadRefImages(files, vendorId, orderId, vendorBookingsRef, previewId, statusId, lang) {
    if (!files || !files.length) return;
    var storage = window.dlcStorage;
    var db      = window.dlcDb;
    if (!storage || !db) { console.warn('[img-upload] storage not ready'); return; }

    var statusEl  = document.getElementById(statusId);
    var previewEl = document.getElementById(previewId);
    if (statusEl) statusEl.textContent = lang === 'vi' ? 'Đang tải ảnh…' : lang === 'es' ? 'Subiendo…' : 'Uploading…';

    var selected = Array.from(files).slice(0, 5);
    var uploadedUrls = [];
    var done = 0;

    selected.forEach(function(file, i) {
      // Show local preview immediately
      var reader = new FileReader();
      reader.onload = function(e) {
        if (!previewEl) return;
        var img = document.createElement('img');
        img.src = e.target.result;
        img.className = 'ns-img-upload__preview ns-img-upload__preview--loading';
        img.dataset.idx = i;
        previewEl.appendChild(img);
      };
      reader.readAsDataURL(file);

      // Upload to Firebase Storage
      var ext  = file.name.split('.').pop() || 'jpg';
      var path = 'vendors/' + vendorId + '/bookings/' + orderId + '/ref_' + i + '_' + Date.now() + '.' + ext;
      var ref  = storage.ref(path);

      ref.put(file).then(function() {
        return ref.getDownloadURL();
      }).then(function(url) {
        uploadedUrls.push(url);
        // Mark preview as done
        var img = previewEl ? previewEl.querySelector('[data-idx="' + i + '"]') : null;
        if (img) img.classList.remove('ns-img-upload__preview--loading');
        done++;
        if (done === selected.length) {
          // Save all URLs to booking doc
          vendorBookingsRef.doc(orderId).update({
            referenceImages: firebase.firestore.FieldValue.arrayUnion.apply(null, uploadedUrls)
          }).then(function() {
            if (statusEl) {
              statusEl.textContent = lang === 'vi' ? '✓ Đã lưu ' + done + ' ảnh tham khảo' : lang === 'es' ? '✓ ' + done + ' foto(s) guardada(s)' : '✓ ' + done + ' photo(s) saved';
              statusEl.style.color = '#4ade80';
            }
          }).catch(function(e) {
            console.warn('[img-upload] Firestore update failed:', e.message);
            if (statusEl) { statusEl.textContent = '⚠ Could not save to booking.'; statusEl.style.color = '#f87171'; }
          });
        }
      }).catch(function(e) {
        console.warn('[img-upload] Storage upload failed:', e.message);
        done++;
        if (statusEl) { statusEl.textContent = '⚠ Upload failed. Check storage permissions.'; statusEl.style.color = '#f87171'; }
      });
    });
  }

  function _showTyping(messagesEl, id) {
    var div = document.createElement('div');
    div.id  = id;
    div.className = 'mp-ai__msg mp-ai__msg--bot';
    div.innerHTML =
      '<div class="mp-ai__msg__avatar">' + _BOT_AVATAR_SVG + '</div>' +
      '<div class="mp-ai__bubble mp-ai__bubble--typing"><span class="mp-ai__typing-dot"></span><span class="mp-ai__typing-dot"></span><span class="mp-ai__typing-dot"></span></div>';
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

      // Live vendor data strategy:
      //   Staff     → onSnapshot listener: fires on page load AND on every admin change (true live sync)
      //   Vendor doc → one-time server get: apiKey, parallelServices, hoursSchedule
      //   Services   → one-time server get: active service catalog
      // _dataPromise resolves when all three are ready; _handleMessage awaits it before building prompt.
      biz._firestoreApiKey    = null;
      biz._platformApiKey     = null;  // shared platform key — fallback when no vendor-specific key
      biz._platformGeminiKey  = null;
      biz._platformOpenAiKey  = null;
      biz._parallelServices   = [];
      biz._dataFetchedAt      = 0;
      biz._dataPromise        = null;
      biz._staffUnsub         = null;  // unsubscribe fn for the staff onSnapshot listener
      biz._xsLookupDone       = false; // RX-015: cross-session modify lookup guard (one lookup per modify flow)

      function _fetchLiveBizData() {
        try {
          if (!window.dlcDb || !biz.id) return;
          var _vref = window.dlcDb.collection('vendors').doc(biz.id);

          // ── Staff: forced server read + onSnapshot for live updates ─────────────
          // onSnapshot fires from Firestore local cache first. If the cache is stale
          // (e.g. admin saved a new schedule but the customer's browser cached the old
          // empty-{} data), booking validation would see no schedule and block the
          // booking. get({ source: 'server' }) bypasses the cache and returns the
          // authoritative server data, then we subscribe to onSnapshot so that any
          // subsequent admin saves push to the client without a page refresh.
          if (biz._staffUnsub) { biz._staffUnsub(); biz._staffUnsub = null; }
          var _staffRef = _vref.collection('staff');
          function _buildStaffArrFromSnap(snap) {
            var arr = [];
            snap.forEach(function(sdoc) {
              var s = sdoc.data();
              if (!s.name) return; // skip placeholder / nameless docs
              arr.push({
                id:               sdoc.id,
                name:             s.name,
                role:             s.role             || 'Nail Tech',
                specialties:      s.specialties      || [],
                assignedServices: s.assignedServices || [],
                schedule:         s.schedule         || {},
                active:           s.active !== false,
                sortOrder:        s.sortOrder        || 0
              });
            });
            arr.sort(function(a, b) { return a.sortOrder - b.sortOrder; });
            return arr;
          }
          var _staffReady = _staffRef.get({ source: 'server' }).then(function(snap) {
            if (!snap.empty) { biz.staff = _buildStaffArrFromSnap(snap); }
            // Subscribe AFTER server read so onSnapshot starts with fresh cached data,
            // not the stale pre-read cache version.
            biz._staffUnsub = _staffRef.onSnapshot(function(liveSnap) {
              if (!liveSnap.empty) { biz.staff = _buildStaffArrFromSnap(liveSnap); }
            }, function(err) { console.warn('[DLC Staff] Firestore onSnapshot error for', biz.id, err); });
          }, function(err) {
            // Server read failed (offline?) — fall back to onSnapshot which may serve cache
            console.warn('[DLC Staff] Server read failed, falling back to onSnapshot for', biz.id, err);
            return new Promise(function(resolve) {
              biz._staffUnsub = _staffRef.onSnapshot(function(snap) {
                if (!snap.empty) { biz.staff = _buildStaffArrFromSnap(snap); }
                resolve();
              }, function(e) { console.warn('[DLC Staff] Firestore error for', biz.id, e); resolve(); });
            });
          });

          // ── Vendor doc + services + platform config: one-time server reads ──────────
          biz._dataPromise = Promise.all([
            _vref.get({ source: 'server' }),
            _vref.collection('services').where('active', '==', true).get({ source: 'server' }),
            _staffReady,
            // Platform-level shared API key — fallback for vendors without their own key
            window.dlcDb.collection('config').doc('platform').get().catch(function() { return null; })
          ]).then(function(results) {
            var vdoc      = results[0];
            var svcSnap   = results[1];
            var platDoc   = results[3];
            // results[2] is undefined — staff handled by onSnapshot above

            // ── Platform config: shared API keys (fallback when vendor has no key) ──
            if (platDoc && platDoc.exists) {
              var pd = platDoc.data();
              if (pd.aiKey)     biz._platformApiKey    = pd.aiKey;
              if (pd.geminiKey) biz._platformGeminiKey = pd.geminiKey;
              if (pd.openaiKey) biz._platformOpenAiKey = pd.openaiKey;
            }

            // ── Vendor doc: apiKey, parallelServices, hoursSchedule ─────────────────
            if (vdoc.exists) {
              var d = vdoc.data();
              if (d.aiKey)     biz._firestoreApiKey    = d.aiKey;
              if (d.geminiKey) biz._firestoreGeminiKey = d.geminiKey;
              if (d.openaiKey) biz._firestoreOpenAiKey = d.openaiKey;
              // Vendor-configurable cash tip note (Part 1 — Phase 5C)
              biz._enableCashTipNote = d.enableCashTipNote === true;
              biz._cashTipNoteText   = d.cashTipNoteText   || '';
              // Pre-fetch welcome TTS audio in background so open() plays instantly
              setTimeout(function () {
                if (window.DLCVoiceMode && window.DLCVoiceMode.prefetchWelcome) {
                  window.DLCVoiceMode.prefetchWelcome(biz);
                }
              }, 0);
              // Normalize parallelServices: accept both old [[a,b],...] and new [{a,b},...] formats
              if (d.parallelServices && d.parallelServices.length) {
                biz._parallelServices = d.parallelServices.map(function(p) {
                  if (Array.isArray(p)) return { a: p[0] || '', b: p[1] || '' };
                  return { a: p.a || '', b: p.b || '' };
                }).filter(function(p) { return p.a && p.b; });
              }
              // Convert hoursSchedule → biz.hours display format used by prompt + availability
              if (d.hoursSchedule) {
                var _hs = d.hoursSchedule;
                var _hkeys   = ['mon','tue','wed','thu','fri','sat','sun'];
                var _hlabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
                var _fmtT = function(t) {
                  if (!t) return '';
                  var p = t.split(':'), hh = +p[0], mm = +p[1];
                  var ap = hh < 12 ? 'AM' : 'PM'; hh = hh % 12 || 12;
                  return hh + (mm ? ':' + (mm < 10 ? '0' : '') + mm : '') + ' ' + ap;
                };
                var _mappedHours = {};
                _hkeys.forEach(function(k, i) {
                  var day = _hs[k];
                  if (day) _mappedHours[_hlabels[i]] = day.closed ? 'Closed' : (_fmtT(day.open) + ' – ' + _fmtT(day.close));
                });
                if (Object.keys(_mappedHours).length) biz.hours = _mappedHours;
              }
            }

            // ── Services: replace with live active services from Firestore ───────────
            if (!svcSnap.empty) {
              var _svcs = [];
              svcSnap.forEach(function(sdoc) {
                var s = sdoc.data();
                _svcs.push({
                  id:            sdoc.id,
                  name:          s.name          || '',
                  category:      s.category      || '',
                  price:         s.price         || '',
                  priceFrom:     s.priceFrom     || 0,
                  duration:      s.duration      || '',
                  durationMins:  s.durationMins  || 0,
                  desc:          s.desc          || '',
                  description:   s.desc          || '',
                  imageUrl:      s.imageUrl      || '',
                  assignedStaff: s.assignedStaff || [],
                  active:        true,
                  sortOrder:     s.sortOrder     || 0
                });
              });
              _svcs.sort(function(a, b) { return a.sortOrder - b.sortOrder; });
              biz.services = _svcs;
            }
            // svcSnap empty → keep existing biz.services; prompt falls back to biz._staticServices

            biz._dataFetchedAt = Date.now();
            biz._dataPromise   = null;
          }).catch(function() {
            biz._dataPromise   = null;
          });
        } catch(e) {
          biz._dataPromise = null;
        }
      }

      _fetchLiveBizData();

      function send(text) {
        if (!text) return;

        // Guard: block re-submission while escalation write is in flight.
        // Race window: esc.create() starts an async Firestore write (~100-500ms
        // to commit). A second submission in that window queries before the doc
        // is visible → conflict check passes → double booking.
        // This flag is set before esc.create() and cleared after 5s (well past
        // commit latency). After 5s the doc IS queryable so any re-try will hit
        // the conflict check and be rejected correctly.
        if (biz._submissionInFlight) {
          var _inflightLang = (biz._bookingState && biz._bookingState.lang) || 'en';
          var _inflightMsg = _inflightLang === 'vi'
            ? 'Yêu cầu của bạn đã được gửi đi và đang chờ xác nhận. Vui lòng chờ một chút.'
            : _inflightLang === 'es'
              ? 'Su solicitud ya ha sido enviada y está pendiente de confirmación. Por favor, espere un momento.'
              : 'Your request has already been sent and is pending confirmation. Please wait a moment.';
          _appendMessage(messagesEl, _inflightMsg, 'bot');
          return;
        }

        // ── Email collection intercept ─────────────────────────────────────────
        // After booking confirmation, _emailState is set and the next customer
        // message is checked for an email address before reaching the AI brain.
        // Covers: valid email → queue email, skip/no → silent dismiss, anything
        // else → clear state and let AI handle normally.
        if (biz._emailState) {
          var emailIn = text.trim();
          // Skip keyword: dismiss silently, don't pass to AI
          if (/^(skip|no|nope|không|bỏ qua|omitir)$/i.test(emailIn)) {
            biz._emailState = null;
            return;
          }
          // Valid email address: queue confirmation + show feedback
          if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailIn)) {
            var capturedState = biz._emailState;
            biz._emailState   = null;
            _appendMessage(messagesEl, emailIn, 'user');
            _queueBookingEmail(biz, emailIn, capturedState);
            var _emailLang = (capturedState && capturedState.draft && capturedState.draft.lang) || 'en';
            var _emailAckMsg = _emailLang === 'vi'
              ? 'Được rồi! Email xác nhận đang được gửi đến ' + emailIn + '.'
              : _emailLang === 'es'
                ? '¡Listo! Su confirmación está en camino a ' + emailIn + '.'
                : 'Got it! Your confirmation is on its way to ' + emailIn + '.';
            _appendMessage(messagesEl, _emailAckMsg, 'bot');
            return;
          }
          // Anything else: clear email state and fall through to normal AI handling
          biz._emailState = null;
        }

        // TTL refresh: if biz data is older than 10 minutes, re-fetch with fresh server data.
        // Reset timestamp immediately to prevent concurrent refreshes.
        // _handleMessage() will await biz._dataPromise so the refreshed data lands before the prompt.
        if (biz._dataFetchedAt && (Date.now() - biz._dataFetchedAt > 600000)) {
          biz._dataFetchedAt = Date.now();
          _fetchLiveBizData();
        }

        _appendMessage(messagesEl, text, 'user');
        var typingId = 'lily_t_' + Date.now();
        _showTyping(messagesEl, typingId);

        var apiKey = null;
        try { apiKey = localStorage.getItem('dlc_claude_key'); } catch (e) {}
        // Priority: localStorage → vendor Firestore key → platform shared key
        if (!apiKey) apiKey = biz._firestoreApiKey || biz._platformApiKey || null;

        _handleMessage(biz, text, apiKey)
          .then(function (result) {
            _hideTyping(typingId);

            // ── HARD EXECUTION GUARD — runs before EVERYTHING else ────────────────
            // _sanitizeResponse intercepts 100% of Claude responses.
            // Any banned availability phrase (data-access claims, premature confirmations)
            // is REPLACED with a safe, context-aware response before any further processing.
            // Claude's bad text never reaches _appendMessage, earlyCheckReady, or
            // the escalation handler. _aiHistory is also corrected so Claude never
            // sees the bad text in future turns.
            // This cannot be bypassed — it is the outermost gate on every response.
            result = _sanitizeResponse(biz, result);

            // ── Early slot validation (fires before contact-detail collection) ──────
            // Problem: the full check only runs on [ESCALATE:appointment], which Claude
            // emits only after collecting name+phone. Old flow: asked for contact info
            // and THEN told the customer the slot was already taken — wrong UX.
            //
            // Fix: as soon as Claude's STATE has all 4 scheduling fields
            // (named staff + services + date + time) but before [ESCALATE:appointment]
            // is emitted, validate the slot RIGHT NOW with a partial draft.
            //
            //   AVAILABLE   → show Claude's message (e.g. "What's your name?")
            //   UNAVAILABLE → replace Claude's message with the conflict/suggestion;
            //                 preserve booking state so customer only needs a new slot
            var _ecs = biz._bookingState;
            var _earlyCheckReady = (
              _ecs &&
              _ecs.intent   === 'booking_request' &&
              _ecs.staff    && _ecs.staff.toLowerCase() !== 'any' &&
              _ecs.services && _ecs.services.length > 0 &&
              _ecs.date     &&
              _ecs.time     &&
              !result.escalationType  // [BOOKING+ESCALATE] not yet emitted
            );

            if (_earlyCheckReady) {
              // When rescheduling: pass isModify+phone so the customer's own existing
              // booking is excluded from conflict checks (prevents customer_conflict loop
              // after user says "replace it" and old time is still in STATE).
              var _inModify = _ecs.pendingAction === 'modify_booking';
              // RX-021: stale-time guard for early check.
              // If modify_booking is set THIS turn (biz._prevPendingAction was null before),
              // and the requested time matches the last confirmed time (stale reuse),
              // and no cross-session lookup was done — treat as a new booking, not reschedule.
              if (_inModify && !biz._prevPendingAction && !biz._xsLookupDone) {
                if (_ecs.time && biz._lastConfirmedTime && _ecs.time === biz._lastConfirmedTime) {
                  _inModify = false; // force full availability check — don't use reschedule bypass
                }
              }
              var _ed = {
                staff:             _ecs.staff,
                services:          _ecs.services,
                date:              _ecs.date,
                time:              _ecs.time,
                lang:              _ecs.lang || 'en',
                totalDurationMins: _calcTotalDuration(biz, _ecs.services || []),
                isModify:          _inModify,
                phone:             _inModify ? (_ecs.phone || null) : null
              };
              // Track which slot was offered so we show the confirmation ONCE then pass
              // through to normal contact-collection on subsequent turns.
              var _slotKey = _ecs.staff + '|' + _ecs.date + '|' + _ecs.time;
              NailAvailabilityChecker.check(biz, _ed)
                .then(function (avail) {
                  if (avail.valid) {
                    if (biz._offeredSlot === _slotKey) {
                      // Slot already confirmed on a prior turn — customer is now giving
                      // name/phone. Show Claude's collection question directly.
                      _appendMessage(messagesEl, result.text, 'bot');
                    } else {
                      // New slot verified free. Replace Claude's speculative history entry.
                      if (biz._aiHistory.length &&
                          biz._aiHistory[biz._aiHistory.length - 1].role === 'assistant') {
                        biz._aiHistory.pop();
                      }
                      if (_ecs.name && _ecs.phone) {
                        // Contact info already on file — no need to ask "Would you like to book?".
                        // Show Claude's confirmed text directly (e.g. "Of course! 10 AM for John.
                        // Does that look correct?"). Slot is verified free; update offeredSlot so
                        // the next "yes" passes through to the booking creation check.
                        biz._aiHistory.push({ role: 'assistant', content: result.text });
                        // RX-011: do NOT overwrite 'modify_booking' — isModify detection in
                        // handleMessage() depends on this flag surviving to the [BOOKING:] turn.
                        // Only switch to 'booking_offer' for brand-new bookings.
                        if (!_inModify) biz._bookingState.pendingAction = 'booking_offer';
                        _saveBookingState(biz);
                        _saveHistory(biz);
                        biz._offeredSlot = _slotKey;
                        _appendMessage(messagesEl, result.text, 'bot');
                      } else {
                        // Contact info unknown — show explicit availability confirmation
                        // before asking for name/phone. Prevents speculative contact collection.
                        var _availMsg = _buildAvailConfirmMsg(biz, _ed);
                        biz._aiHistory.push({ role: 'assistant', content: _availMsg });
                        // RX-011: same guard — preserve 'modify_booking' for reschedules so
                        // the isModify flag survives to the [BOOKING:] turn.
                        if (!_inModify) biz._bookingState.pendingAction = 'booking_offer';
                        _saveBookingState(biz);
                        _saveHistory(biz);
                        biz._offeredSlot = _slotKey;
                        _appendMessage(messagesEl, _availMsg, 'bot');
                      }
                    }
                  } else {
                    // Slot is taken — re-route through AI so it responds in customer language
                    if (biz._aiHistory.length &&
                        biz._aiHistory[biz._aiHistory.length - 1].role === 'assistant') {
                      biz._aiHistory.pop();
                    }
                    biz._offeredSlot = null;
                    var _rjLang1 = (biz._bookingState && biz._bookingState.lang) || 'en';
                    biz._aiHistory.push({ role: 'user', content: '[SYSTEM: ' + avail.message + ']' });
                    AIEngine.call('nails', apiKey, _buildPrompt(biz, _rjLang1),
                        biz._aiHistory.map(function(m) { return { role: m.role, content: m.content }; }),
                        { intent: null }
                    ).then(function(_rd1) {
                        var _rt1raw = (_rd1.content && _rd1.content[0] && _rd1.content[0].text) || _rejectionFallback(_rjLang1);
                        var _st1 = _parseStateMarker(_rt1raw);
                        if (_st1) _mergeState(biz, _st1);
                        var _rt1 = _stripAllMarkers(_rt1raw);
                        biz._aiHistory.pop();
                        biz._aiHistory.push({ role: 'assistant', content: _rt1raw });
                        _saveHistory(biz);
                        _appendMessage(messagesEl, _rt1, 'bot');
                    }).catch(function() {
                        var _fb1 = _rejectionFallback(_rjLang1);
                        biz._aiHistory.pop();
                        biz._aiHistory.push({ role: 'assistant', content: _fb1 });
                        _saveHistory(biz);
                        _appendMessage(messagesEl, _fb1, 'bot');
                    });
                    // State preserved: customer only needs a different time/date/staff
                  }
                })
                .catch(function () {
                  // Fail-open: show Claude's response on any Firestore error
                  _appendMessage(messagesEl, result.text, 'bot');
                });
              return; // early check is async — skip the branches below for this turn
            }

            // ── Specific-time staff_availability safeguard ──────────────────────────
            // Problem: "Is Tracy available at 9AM?" may still be classified as
            // staff_availability by Claude (not booking_request). Claude reads Tracy's
            // shift start time (e.g. 9AM) and answers "Tracy is available from 9AM today"
            // — without checking whether the 9AM slot is actually open in Firestore.
            // This causes a contradiction: AI says "available", then booking check says "taken".
            //
            // Fix: if STATE has staff_availability + specific time + named staff + date,
            // validate the slot NOW (same as earlyCheckReady) before showing the response.
            // Slot free → show Claude's response (schedule-based answer happens to be correct).
            // Slot taken → replace response with the real conflict message.
            //
            // Uses totalDurationMins: 0 → NailAvailabilityChecker falls back to DEFAULT_DUR (60min).
            // Also covers booking_request + named staff + time + date + NO services:
            // earlyCheckReady requires services.length > 0, so that gap is closed here.
            var _staffAvailWithTime = (
              _ecs &&
              _ecs.staff  && _ecs.staff.toLowerCase() !== 'any' &&
              _ecs.date   &&
              _ecs.time   &&
              !result.escalationType &&
              !_earlyCheckReady &&  // don't double-fire if already caught above
              (
                _ecs.intent === 'staff_availability' ||
                (_ecs.intent === 'booking_request' && (!_ecs.services || _ecs.services.length === 0))
              )
            );
            if (_staffAvailWithTime) {
              var _sad = {
                staff:             _ecs.staff,
                services:          [],
                date:              _ecs.date,
                time:              _ecs.time,
                lang:              _ecs.lang || 'en',
                totalDurationMins: 0,   // checker falls back to DEFAULT_DUR (60 min)
                isModify:          false
              };
              NailAvailabilityChecker.check(biz, _sad)
                .then(function(avail) {
                  if (avail.valid) {
                    // Slot is free — Claude's answer is safe to show
                    _appendMessage(messagesEl, result.text, 'bot');
                  } else {
                    // Slot is taken — replace Claude's schedule-based answer with truth
                    var _sadLang = (_ecs && _ecs.lang) || 'en';
                    var _sadMsg = _rejectionFallback(_sadLang);
                    if (biz._aiHistory.length &&
                        biz._aiHistory[biz._aiHistory.length - 1].role === 'assistant') {
                      biz._aiHistory.pop();
                    }
                    biz._aiHistory.push({ role: 'assistant', content: avail.message }); // English for AI context
                    _saveHistory(biz);
                    biz._offeredSlot = null;
                    _appendMessage(messagesEl, _sadMsg, 'bot');
                  }
                })
                .catch(function() {
                  // Fail-open: show Claude's response on any Firestore error
                  _appendMessage(messagesEl, result.text, 'bot');
                });
              return; // async — skip remaining sync branches for this turn
            }

            // Safety net: Claude sometimes emits [ESCALATE:appointment] without
            // [BOOKING:{...}] (all info is in STATE but the BOOKING marker is missing).
            // Without a bookingDraft the full check can't run, and the else branch would
            // show Claude's unvalidated text + create a bad null-data escalation.
            // Build a synthetic draft from the current booking state so the check can proceed.
            if (result.escalationType === 'appointment' && !biz._bookingDraft) {
              var _ss = biz._bookingState;
              if (_ss && _ss.staff && _ss.date && _ss.time && _ss.services && _ss.services.length) {
                biz._bookingDraft = {
                  staff:    _ss.staff,
                  services: _ss.services,
                  date:     _ss.date,
                  time:     _ss.time,
                  name:     _ss.name  || null,
                  phone:    _ss.phone || null,
                  lang:     _ss.lang  || 'en'
                };
              }
            }

            if (result.escalationType === 'appointment' && biz._bookingDraft) {
              // VALIDATE FIRST — do NOT show Claude's text until availability is confirmed.
              // Correct flow: validate → if available show confirmation; if not show rejection.
              var draft = biz._bookingDraft;
              draft.totalDurationMins = _calcTotalDuration(biz, draft.services || []);

              NailAvailabilityChecker.check(biz, draft)
                .then(function (avail) {
                  if (avail.valid) {
                    // Slot is available — escalate to vendor inbox for confirmation.
                    // Vendor must confirm via salon-admin before booking is finalised.
                    // Remove Claude's speculative text from history.
                    if (biz._aiHistory && biz._aiHistory.length &&
                        biz._aiHistory[biz._aiHistory.length - 1].role === 'assistant') {
                      biz._aiHistory.pop();
                    }

                    // Capture the draft before clearing state
                    var confirmedDraft = draft;

                    // Clear booking state — request is now pending vendor confirmation.
                    biz._bookingState = _emptyState();
                    biz._xsLookupDone = false; // reset: allow lookup for a future modify flow
                    _saveBookingState(biz);
                    biz._offeredSlot = null;
                    biz._bookingDraft = null;

                    // In-flight guard prevents double-submission during Firestore commit window.
                    biz._submissionInFlight = true;
                    setTimeout(function () { biz._submissionInFlight = false; }, 5000);

                    // No conflict — confirm directly. _submitDirectBooking shows the
                    // natural confirmation + booking packet + calendar links instantly
                    // and sends the vendor a push notification. No vendor-confirm wait.
                    // Reschedule: look up the existing booking by phone to get its exact
                    // Firestore document ID — lets _submitDirectBooking delete the old
                    // booking by exact ID (not the fragile phone+date filter).
                    if (confirmedDraft.isModify && confirmedDraft.phone && window.dlcDb) {
                      // Phase 3: use existingBookingId already known from _xsBookingLookup
                      // (set in biz._bookingState and carried into STATE/BOOKING marker),
                      // or fall back to biz._lastBookingId (set by same-session _submitDirectBooking).
                      // Either avoids an extra Firestore round-trip before submit.
                      if (!confirmedDraft.existingBookingId && biz._lastBookingId) {
                        confirmedDraft.existingBookingId = biz._lastBookingId;
                      }
                      if (confirmedDraft.existingBookingId) {
                        // Booking ID already known — skip the Firestore round-trip
                        _submitDirectBooking(biz, confirmedDraft, messagesEl);
                      } else {
                        // ID unknown — look up by phone using shared utility
                        var _rVid = biz.id || biz.slug || 'unknown';
                        _lookupActiveBookingByPhone(window.dlcDb, _rVid, confirmedDraft.phone)
                          .then(function (active) {
                            if (active.length) {
                              confirmedDraft.existingBookingId = active[0].id;
                            }
                          })
                          .catch(function () {}) // offline or permission denied — submit without ID
                          .then(function () {
                            _submitDirectBooking(biz, confirmedDraft, messagesEl);
                          });
                      }
                    } else {
                      _submitDirectBooking(biz, confirmedDraft, messagesEl);
                    }
                  } else {
                    // Not available — re-route through AI so it responds in customer language.
                    // Claude knows what happened and can answer follow-ups naturally.
                    if (biz._aiHistory && biz._aiHistory.length &&
                        biz._aiHistory[biz._aiHistory.length - 1].role === 'assistant') {
                      biz._aiHistory.pop();
                    }
                    biz._offeredSlot = null;
                    var _rjLang2 = (biz._bookingState && biz._bookingState.lang) || 'en';
                    biz._aiHistory.push({ role: 'user', content: '[SYSTEM: ' + avail.message + ']' });
                    AIEngine.call('nails', apiKey, _buildPrompt(biz, _rjLang2),
                        biz._aiHistory.map(function(m) { return { role: m.role, content: m.content }; }),
                        { intent: null }
                    ).then(function(_rd2) {
                        var _rt2raw = (_rd2.content && _rd2.content[0] && _rd2.content[0].text) || _rejectionFallback(_rjLang2);
                        var _st2 = _parseStateMarker(_rt2raw);
                        if (_st2) _mergeState(biz, _st2);
                        var _rt2 = _stripAllMarkers(_rt2raw);
                        biz._aiHistory.pop();
                        biz._aiHistory.push({ role: 'assistant', content: _rt2raw });
                        _saveHistory(biz);
                        _appendMessage(messagesEl, _rt2, 'bot');
                    }).catch(function() {
                        var _fb2 = _rejectionFallback(_rjLang2);
                        biz._aiHistory.pop();
                        biz._aiHistory.push({ role: 'assistant', content: _fb2 });
                        _saveHistory(biz);
                        _appendMessage(messagesEl, _fb2, 'bot');
                    });
                    // Do NOT clear _bookingState or _bookingDraft.
                    // Rejection ≠ cancellation: staff, service, name, phone are still valid.
                    // Customer should only need to supply a new date/time or staff member.
                  }
                })
                .catch(function () {
                  // Availability check error — fail-open: show text and escalate
                  _appendMessage(messagesEl, result.text, 'bot');
                  var esc = window.EscalationEngine;
                  if (esc && typeof esc.create === 'function') {
                    esc.create(biz, messagesEl, result.escalationType, draft);
                  }
                });

            } else if (result.escalationType === 'cancel') {
              // Customer is cancelling their confirmed booking.
              // Show Claude's confirmation text, then mark booking cancelled in Firestore.
              _appendMessage(messagesEl, result.text, 'bot');
              var _cDb  = window.dlcDb;
              var _cVid = biz.id || biz.slug || 'unknown';
              if (_cDb) {
                var _cFv    = firebase && firebase.firestore ? firebase.firestore.FieldValue : null;
                var _cId    = biz._lastBookingId;                             // set by _submitDirectBooking
                var _cPhone = biz._bookingState && biz._bookingState.phone;
                if (_cId) {
                  // Exact ID known — fastest path (same-session cancel)
                  _cDb.collection('vendors').doc(_cVid).collection('bookings').doc(_cId)
                    .update({ status: 'cancelled', cancelledAt: _cFv ? _cFv.serverTimestamp() : new Date() })
                    .catch(function (e) { console.warn('[cancel] update failed:', e.message); });
                } else if (_cPhone) {
                  // RX-014: cross-session cancel — query by phone, include in_progress,
                  // cancel only the most recent booking (not all matching bookings).
                  // Uses shared _lookupActiveBookingByPhone (also handles legacy 'phone' field).
                  _lookupActiveBookingByPhone(_cDb, _cVid, _cPhone)
                    .then(function (active) {
                      if (!active.length) return;
                      // active[0] is the most recent — cancel only that one
                      active[0].ref.update({ status: 'cancelled', cancelledAt: _cFv ? _cFv.serverTimestamp() : new Date() })
                        .catch(function (e) { console.warn('[cancel] update failed:', e.message); });
                    })
                    .catch(function (e) { console.warn('[cancel] lookup failed:', e.message); });
                }
              }
              biz._lastBookingId  = null;
              biz._xsLookupDone   = false; // reset for next modify flow
              biz._bookingState   = _emptyState();
              _saveBookingState(biz);

            } else {
              // Non-appointment response — show immediately, no availability gate needed
              _appendMessage(messagesEl, result.text, 'bot');

              // ── Cross-session modify lookup (RX-015) ────────────────────────────
              // Trigger: customer provided phone for a cross-session reschedule
              // (services empty + pendingAction=modify_booking + phone just populated).
              // Look up their most recent booking in Firestore, pre-populate state,
              // and inject a "Found your appointment" message so the next turn can
              // proceed with new date/time without re-asking for service/name.
              var _xst = biz._bookingState;
              if (_xst &&
                  _xst.pendingAction === 'modify_booking' &&
                  _xst.phone && _xst.phone.length >= 7 &&
                  (!_xst.services || _xst.services.length === 0) &&
                  !_xst.date &&
                  !result.escalationType &&
                  !biz._xsLookupDone &&
                  window.dlcDb) {
                biz._xsLookupDone = true;
                _xsBookingLookup(biz, _xst.phone, messagesEl, _xst.lang || 'en');
              }

              if (result.escalationType) {
                var esc = window.EscalationEngine;
                if (esc && typeof esc.create === 'function') {
                  esc.create(biz, messagesEl, result.escalationType, biz._bookingDraft || null);
                }
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

      // Expose send() so voice-mode.js calls the correct specialized brain,
      // not the generic Marketplace.Receptionist._sendMessage path.
      biz._voiceSend = send;

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

      // Voice input (STT-to-text-field)
      if (window.DLCVoiceInput) window.DLCVoiceInput.attach(biz, container, input);

      // Voice Mode overlay — wire the button added by renderAiSection.
      // Receptionist.init (marketplace.js) is NOT called for LilyReceptionist,
      // so the wiring must live here instead.
      var _vmBtn = container.querySelector('.mp-ai__voice-btn');
      if (_vmBtn) {
        if (window.DLCVoiceMode) {
          container.classList.add('mp-ai--voice-ready');
          _vmBtn.addEventListener('click', function (e) {
            e.stopPropagation(); // prevent chat fullscreen toggle
            window.DLCVoiceMode.open(biz, messagesEl);
          });
        }
        // If DLCVoiceMode is not defined, do NOT set style.display='none' —
        // the CSS default (display:none on .mp-ai__voice-btn) already hides it,
        // and an inline style would permanently block the CSS rule that shows it
        // when mp-ai--fs.mp-ai--voice-ready is later applied.
      }

      // ── Full-screen mode (mobile only) ──────────────────────────────────────
      (function _initFullScreen() {
        var _fsSavedY    = 0;
        var _isClosing   = false;
        var _origParent  = null;
        var _origNextSib = null;

        function _fsUpdateVH() {
          var vv = window.visualViewport;
          if (!vv || !container.classList.contains('mp-ai--fs')) return;
          var fullH = window.innerHeight;
          var kbH   = Math.max(0, fullH - vv.height - (vv.offsetTop || 0));
          container.style.top           = '0px';
          container.style.height        = fullH + 'px';
          container.style.paddingBottom = kbH + 'px';
        }

        function _fsOpen() {
          if (_isClosing || window.innerWidth >= 768 || container.classList.contains('mp-ai--fs')) return;
          _fsSavedY = window.scrollY || window.pageYOffset || 0;

          // Move container to <body> so position:fixed is unambiguously viewport-relative.
          // When the widget lives inside #mpApp, any ancestor stacking context (transforms,
          // backdrop-filter, isolation) can make position:fixed position relative to that
          // ancestor instead of the viewport, causing page content to bleed through.
          // Moving to body eliminates that entire class of problem.
          _origParent  = container.parentNode;
          _origNextSib = container.nextSibling;
          container.classList.add('mp-ai--fs');
          document.body.appendChild(container);

          document.documentElement.classList.add('mp-ai-open-root');
          document.body.classList.add('mp-ai-open');
          _fsUpdateVH();
          setTimeout(function () { messagesEl.scrollTop = messagesEl.scrollHeight; }, 50);
        }

        function _fsClose() {
          _isClosing = true;
          input.blur();
          container.classList.remove('mp-ai--fs');
          document.documentElement.classList.remove('mp-ai-open-root');
          document.body.classList.remove('mp-ai-open');

          // Restore container to its original position in the page
          if (_origParent) {
            _origParent.insertBefore(container, _origNextSib);
            _origParent  = null;
            _origNextSib = null;
          }

          window.scrollTo(0, _fsSavedY);
          container.style.height        = '';
          container.style.top           = '';
          container.style.paddingBottom = '';
          setTimeout(function () { _isClosing = false; }, 400);
        }

        container.addEventListener('click', function (e) {
          var ct = e.target.closest ? e.target.closest.bind(e.target) : function () { return null; };
          if (ct('.mp-ai__fs-close-bar'))  { _fsClose(); return; }
          if (ct('.mp-ai__header-back'))   { _fsClose(); return; }
          _fsOpen();
        });
        input.addEventListener('focus', _fsOpen);

        if (window.visualViewport) {
          window.visualViewport.addEventListener('resize', _fsUpdateVH);
          window.visualViewport.addEventListener('scroll', _fsUpdateVH);
        }

        container._fsOpen = _fsOpen;
      }());
    }
  };

})();
