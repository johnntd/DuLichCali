// Lily Receptionist v3.4 — Stateful, time-aware AI receptionist for Luxurious Nails & Spa
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
    function _buildMsg(biz, key, data) {
      // data.lang wins (needed after booking state reset); biz._bookingState.lang as secondary
      var lang  = (data && data.lang) || (biz._bookingState && biz._bookingState.lang) || 'en';
      var phone = biz.phoneDisplay || biz.phone || '';

      if (key === 'closed') {
        var d = data.day.charAt(0).toUpperCase() + data.day.slice(1);
        if (lang === 'vi') return 'Rất tiếc, tiệm không mở cửa vào ' + d + '. Bạn muốn chọn ngày khác không?';
        if (lang === 'es') return 'Lo sentimos, el salón está cerrado los ' + d + 's. ¿Le gustaría elegir otro día?';
        return 'Sorry, the salon is closed on ' + d + 's. Would you like to pick a different day?';
      }

      if (key === 'too_late') {
        var dur = data.totalMins + ' min';
        if (lang === 'vi') return 'Dịch vụ này cần ' + dur + ' và sẽ kết thúc sau giờ đóng cửa lúc ' + data.close + '. Thời gian bắt đầu muộn nhất là ' + data.latest + '. Bạn có muốn đặt vào lúc đó không?';
        if (lang === 'es') return 'Este servicio toma ' + dur + ' y terminaría después del cierre (' + data.close + '). La última hora disponible es ' + data.latest + '. ¿Le gustaría ese horario?';
        return 'This service takes ' + dur + ' and would run past closing time (' + data.close + '). The latest start available is ' + data.latest + '. Would you like that time instead?';
      }

      if (key === 'conflict') {
        var staffNote = data.staff && data.staff.toLowerCase() !== 'any' ? ' with ' + data.staff : '';
        // Prefer altSlots array (multi-slot); fall back to nextSlot (legacy single-slot)
        var alts = data.altSlots && data.altSlots.length ? data.altSlots : (data.nextSlot ? [data.nextSlot] : []);
        if (alts.length === 1) {
          if (lang === 'vi') return 'Rất tiếc, khung giờ ' + data.time + staffNote + ' đã có lịch. Thời gian trống gần nhất là ' + alts[0] + '. Bạn có muốn đặt vào khung giờ đó không?';
          if (lang === 'es') return 'Lo sentimos, el horario de las ' + data.time + staffNote + ' ya está reservado. El horario más cercano disponible es ' + alts[0] + '. ¿Le gustaría ese?';
          return 'Sorry, ' + data.time + staffNote + ' is already booked. The closest available time is ' + alts[0] + '. Would you like that instead?';
        } else if (alts.length >= 2) {
          var last = alts[alts.length - 1];
          var rest = alts.slice(0, alts.length - 1);
          if (lang === 'vi') return 'Rất tiếc, khung giờ ' + data.time + staffNote + ' đã có lịch. Các khung giờ trống gần nhất là ' + rest.join(', ') + ' và ' + last + '. Bạn muốn chọn khung giờ nào?';
          if (lang === 'es') return 'Lo sentimos, el horario de las ' + data.time + staffNote + ' ya está reservado. Los horarios más cercanos disponibles son ' + rest.join(', ') + ' y ' + last + '. ¿Cuál prefiere?';
          return 'Sorry, ' + data.time + staffNote + ' is already booked. The closest available times are ' + rest.join(', ') + ' and ' + last + '. Which would you prefer?';
        } else {
          if (lang === 'vi') return 'Rất tiếc, không còn khung giờ trống hôm đó' + (staffNote ? ' cho ' + data.staff : '') + '. Vui lòng gọi ' + phone + ' hoặc chọn ngày khác.';
          if (lang === 'es') return 'Lo sentimos, no quedan horarios disponibles ese día' + (staffNote ? ' con ' + data.staff : '') + '. Llame al ' + phone + ' o elija otra fecha.';
          return 'Sorry, there are no more available slots that day' + (staffNote ? ' with ' + data.staff : '') + '. Please call ' + phone + ' or choose a different date.';
        }
      }

      if (key === 'staff_not_working') {
        var sn  = data.staff || 'That technician';
        var day = data.day.charAt(0).toUpperCase() + data.day.slice(1);
        if (lang === 'vi') return sn + ' không làm việc vào ' + day + '. Bạn muốn chọn ngày khác hoặc nhân viên khác không?';
        if (lang === 'es') return sn + ' no trabaja el ' + day + '. ¿Le gustaría elegir otro día u otro técnico?';
        return sn + ' is not working on ' + day + '. Would you like to pick a different day or a different technician?';
      }

      if (key === 'outside_shift') {
        var sn2    = data.staff || 'That technician';
        var hours  = data.open + ' – ' + data.close;
        var latStr = data.latest ? (' ' + (lang === 'vi' ? 'Giờ bắt đầu muộn nhất là ' + data.latest + '.' : lang === 'es' ? 'La última hora disponible es ' + data.latest + '.' : 'The latest start is ' + data.latest + '.')) : '';
        if (lang === 'vi') return sn2 + ' làm từ ' + data.open + ' đến ' + data.close + '.' + latStr + ' Bạn muốn chọn giờ khác không?';
        if (lang === 'es') return sn2 + ' trabaja de ' + data.open + ' a ' + data.close + '.' + latStr + ' ¿Le gustaría elegir otro horario?';
        return sn2 + ' works ' + hours + '.' + latStr + ' Would you like to choose a different time?';
      }

      if (key === 'customer_conflict') {
        var existSvcs  = Array.isArray(data.services) && data.services.length ? data.services.join(' + ') : 'an appointment';
        var existStaff = data.staff && data.staff.toLowerCase() !== 'any' ? ' with ' + data.staff : '';
        var existTime  = data.time || 'another time';
        if (lang === 'vi') return 'Bạn đã có lịch hẹn ' + existSvcs + existStaff + ' lúc ' + existTime + ' hôm đó rồi. Bạn muốn thay lịch đó, giữ nguyên, hay chọn giờ khác?';
        if (lang === 'es') return 'Ya tiene una cita de ' + existSvcs + existStaff + ' a las ' + existTime + ' ese día. ¿Desea reemplazarla, conservarla o elegir otra hora?';
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
          // isWorkingDay failed (off that day, or missing schedule data)
          return Promise.resolve({ valid: false, message: _buildMsg(biz, 'staff_not_working', {
            staff: draft.staff,
            day:   _dayName(draft.date),
            lang:  draft.lang
          })});
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
        .collection('appointments')
        .where('date', '==', draft.date)
        .where('status', '==', 'confirmed')
        .get();

      var escQuery = db.collection('escalations')
        .where('vendorId', '==', biz.id)
        .where('status', '==', 'pending_vendor_response')
        .get();

      return Promise.all([apptQuery, escQuery])
        .then(function (results) {
          var apptSnap = results[0];
          var escSnap  = results[1];

          // Confirmed appointments
          var existing = apptSnap.docs.map(function (d) { return d.data(); });

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
              return { valid: false, message: _buildMsg(biz, 'conflict', {
                time:     draft.time,
                staff:    draft.staff,
                altSlots: altSlots,
                lang:     draft.lang
              })};
            }
          }

          // ── Customer conflict check (same person, overlapping time) ─────────
          // Catches duplicate/overlapping bookings for the same customer.
          // Matches by name OR phone — either field is enough to identify the person.
          // Different-time bookings for the same customer are allowed (e.g. manicure at
          // 10 AM with Tracy, pedicure at 2 PM with Helen — both legitimate).
          // Uses >= on the right boundary so back-to-back bookings are caught even when
          // totalDurationMins is missing (60-min fallback: 9:30+60=10:30 → aEnd>=reqStart).
          if (checkCustomer) {
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
              // Overlap: use >= on right boundary to catch exact back-to-back same-customer
              var aStart = _toMins(appt.time || '00:00');
              var aDur   = appt.totalDurationMins || appt.durationMins || DEFAULT_DUR;
              if (aStart < reqEndMins && (aStart + aDur) >= reqStartMins) {
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
        if (!Array.isArray(rule) || rule.length < 2) continue;
        var a = (rule[0] || '').toLowerCase().trim();
        var b = (rule[1] || '').toLowerCase().trim();
        if (!a || !b) continue;
        // Bidirectional: existing=a+new=b OR existing=b+new=a
        if (eList.indexOf(a) >= 0 && nList.indexOf(b) >= 0) return true;
        if (eList.indexOf(b) >= 0 && nList.indexOf(a) >= 0) return true;
      }
      return false;
    }

    return { check: check };
  })();

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

    var receptionistName = (biz.aiReceptionist && biz.aiReceptionist.name) || 'Lily';
    var salonName = biz.name || 'Luxurious Nails & Spa';
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
      '=== REAL-TIME CLOCK ===',
      'Current local time: ' + nowStr,
      'Today\'s salon status: ' + _todayStatus,
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
      '    → Intent = booking_request. Continue the booking with the staff/date already in CURRENT BOOKING STATE.',
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
      'When in doubt, ask — one short clarifying question is better than booking the wrong service.',
      '',
      '=== YOUR RULES ===',
      '1. Answer naturally — you are a real receptionist, not a scripted bot.',
      '2. Never re-introduce yourself mid-conversation. No "Hi, I\'m Lily" after the first message.',
      '3. Use ONLY the data above (HOURS, STAFF, REAL-TIME CLOCK). Never invent or assume.',
      '4. Responses: 1–3 sentences for simple questions. Plain text always.',
      '5. Walk-ins: "Walk-ins welcome based on availability — we recommend calling ahead."',
      '6. Unknown prices: "Prices vary — please call ' + phone + ' for an exact quote."',
      '7. Pronouns her/him/she/he → most recently named technician. See ACTIVE CONTEXT above.',
      '8. Farewell (goodbye/bye/thanks/done) → 1 warm sentence only. Do NOT re-introduce yourself.',
      '',
      '=== INTENT CLASSIFICATION ===',
      'Classify each message as one of:',
      '  booking_request         — customer wants to make an appointment (including affirmative follow-ups to booking_offer)',
      '  service_question        — asking about what services are available',
      '  price_question          — asking about pricing',
      '  staff_availability      — asking about when a specific technician works',
      '  hours_location          — asking about hours, current open status, or address',
      '  farewell                — goodbye, thanks, done',
      '  general                 — anything else',
      '',
      '=== ENTITY EXTRACTION ===',
      'From each message, extract:',
      '  services  — ALL services mentioned. Support MULTIPLE in one message.',
      '              "gel and pedicure" → ["Gel Nails","Pedicure"]',
      '              "mani pedi" → ["Manicure","Pedicure"]',
      '              "làm móng tay" → ["Manicure"]',
      '  staff     — technician name, or null if none mentioned (inherit from STATE if booking_request)',
      '  date      — as stated ("tomorrow", "next Monday", "April 10") or null',
      '  time      — convert to 24h if clear ("2pm" → "14:00", "2:30 chiều" → "14:30") or null',
      '  lang      — "en", "es", or "vi" based on THIS message',
      '',
      '=== AVAILABILITY — CRITICAL RULE ===',
      'You have staff SCHEDULE data (when technicians work) but NOT real-time booking data.',
      'You cannot know which specific time slots are already taken.',
      'NEVER say: "Helen has a slot at 10" / "I can fit you in at 11" / "10 AM is open" / "That time is available".',
      'These claims are false — you cannot verify them.',
      'CORRECT: Ask what time the customer prefers; the system checks it automatically.',
      '  "Tracy works until 7 PM today. What time works for you?"',
      '  "What time would you like? I\'ll check that it\'s open."',
      'If the customer asks "what times are available?" — give ONLY shift hours, never specific open slots.',
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
      '     Write ONE warm, premium-receptionist confirmation. Use phrasing like:',
      '       "Perfect, [Name]! Your [service] with [staff] is all set for [date] at [time]. We\'re so excited to see you — your appointment is confirmed and locked in!"',
      '       "Wonderful! I\'ve got [Name] booked for [services] with [staff] on [date] at [time] ([total] total). Your spot is reserved — we look forward to seeing you!"',
      '       "All done! [Name]\'s [service] appointment with [staff] is confirmed for [date] at [time]. See you then!"',
      '     For multi-service, always mention total duration naturally.',
      '     For Vietnamese: warm, slightly formal. For Spanish: warm, friendly.',
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
      '  → Carry over existing services, staff, name, phone from CURRENT BOOKING STATE (do NOT ask again).',
      '  → Ask ONLY for the new date and/or time if not already provided.',
      '  → When new date + time are confirmed, emit [BOOKING:...] + [ESCALATE:appointment] as normal.',
      '  → The booking will be flagged as a reschedule on the vendor side.',
      '',
      'When customer has a booking conflict (e.g. already booked same time) and says "replace it" or "yes, change":',
      '  → Treat as modify_booking. Keep services, staff, name, phone. Ask for preferred new time.',
      '  → If they say "keep it" or "different time" → acknowledge and ask for their preferred new time instead.',
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
      '  - pendingAction: "booking_offer" after asking "Would you like to book?"; "modify_booking" when rescheduling; null otherwise.',
      '  - existingBookingId: null unless an existing booking ID was provided or found; carry forward once set.',
      '  - Clear pendingAction to null once the customer answers affirmatively and booking flow resumes.',
      '',
      'STATE examples:',
      '"Is Tracy working today?" → AI answers yes + asks "Would you like to book?":',
      '[STATE:{"intent":"staff_availability","services":[],"staff":"Tracy","date":"' + isoDate + '","time":null,"name":null,"phone":null,"lang":"en","pendingAction":"booking_offer","existingBookingId":null}]',
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
    ].join('\n');
  }

  // ── Pending-confirmation messages (shown after avail check passes, before vendor confirms) ──
  // These replace Claude's premature "confirmed" text.
  // Status: AVAILABLE_NOT_CONFIRMED → shown to customer while waiting for vendor.
  function _buildPendingConfirmMsg(biz, draft) {
    var lang  = (draft && draft.lang) || (biz._bookingState && biz._bookingState.lang) || 'en';
    var salon = biz.name || 'the salon';
    if (lang === 'vi') return 'Yêu cầu của bạn đã được gửi đến ' + salon + ' và đang chờ xác nhận. Chúng tôi sẽ nhắn tin cho bạn ngay khi lịch được xác nhận.';
    if (lang === 'es') return 'Su solicitud fue enviada a ' + salon + ' y está pendiente de confirmación. Le avisaremos por mensaje de texto en cuanto sea confirmada.';
    return 'Your request has been sent to ' + salon + ' and is pending confirmation. We\'ll text you as soon as the salon confirms.';
  }

  // Shown when early availability check passes and slot has NOT yet been offered to customer.
  // Replaces Claude's speculative "What's your name?" with an explicit availability confirm.
  // Status: SLOT_CONFIRMED_AVAILABLE — customer must accept before contact details are collected.
  function _buildAvailConfirmMsg(biz, draft) {
    var lang  = (draft && draft.lang) || 'en';
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
    if (lang === 'vi') {
      return staff + ' trống lúc ' + timeDisplay + (svcs ? ' — dịch vụ ' + svcs : '') + '. Bạn có muốn đặt lịch không?';
    }
    if (lang === 'es') {
      return staff + ' está disponible a las ' + timeDisplay + (svcs ? ' para ' + svcs : '') + '. ¿Le gustaría hacer la reserva?';
    }
    return staff + ' is available at ' + timeDisplay + (svcs ? ' for ' + svcs : '') + '. Would you like to book that?';
  }

  // Shown at 60-second mark if vendor has not yet confirmed (status still PENDING_VENDOR_CONFIRMATION).
  function _buildTextBackMsg(biz, draft) {
    var lang  = (draft && draft.lang) || 'en';
    var phone = draft && draft.phone ? draft.phone : null;
    if (lang === 'vi') return 'Chưa nhận được xác nhận ngay lúc này. Chúng tôi sẽ gửi tin nhắn' + (phone ? ' đến ' + phone : '') + ' khi tiệm xác nhận lịch hẹn của bạn.';
    if (lang === 'es') return 'Aún no tenemos confirmación inmediata. Le enviaremos un mensaje' + (phone ? ' a ' + phone : '') + ' en cuanto el salón confirme su cita.';
    return 'No confirmation yet. We\'ll text you' + (phone ? ' at ' + phone : '') + ' once the salon confirms your appointment.';
  }

  // ── Fallback (no API key / network error) ────────────────────────────────────
  // Must handle: yes/no follow-ups, open-now questions, staff queries, bookings.
  // Uses biz._aiHistory to understand context (last AI message = pending question).
  function _fallback(biz, text) {
    var phone = biz.phoneDisplay || biz.phone || '';
    var name  = biz.name || 'Luxurious Nails & Spa';
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

    // ── API call via shared engine (fetch + 3-attempt retry lives in ai-engine.js) ──
    return AIEngine.fetchWithRetry(apiKey, {
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      system:     systemPrompt,
      messages:   biz._aiHistory.map(function (m) {
        return { role: m.role, content: m.content };
      })
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

      // 2. Parse BOOKING marker; attach modify metadata from STATE before state gets reset in step 4
      var bookingData = _parseBookingMarker(raw);
      if (bookingData) {
        if (stateUpdate && stateUpdate.existingBookingId) bookingData.existingBookingId = stateUpdate.existingBookingId;
        if (stateUpdate && (stateUpdate.existingBookingId || stateUpdate.pendingAction === 'modify_booking')) bookingData.isModify = true;
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

      // Load API key from vendor's Firestore doc so all devices work without manual setup
      biz._firestoreApiKey    = null;
      biz._parallelServices   = [];
      try {
        if (window.dlcDb && biz.id) {
          window.dlcDb.collection('vendors').doc(biz.id).get()
            .then(function(doc) {
              if (doc.exists) {
                var d = doc.data();
                if (d.aiKey)           biz._firestoreApiKey  = d.aiKey;
                if (d.parallelServices) biz._parallelServices = d.parallelServices;
              }
            })
            .catch(function() {});
        }
      } catch(e) {}

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
          var guardLang = (biz._bookingState && biz._bookingState.lang) || 'en';
          var guardMsg = guardLang === 'vi'
            ? 'Yêu cầu của bạn đã được gửi và đang chờ xác nhận. Xin vui lòng chờ.'
            : guardLang === 'es'
              ? 'Su solicitud ya fue enviada y está pendiente de confirmación. Por favor espere.'
              : 'Your request has already been sent and is pending confirmation. Please wait a moment.';
          _appendMessage(messagesEl, guardMsg, 'bot');
          return;
        }

        _appendMessage(messagesEl, text, 'user');
        var typingId = 'lily_t_' + Date.now();
        _showTyping(messagesEl, typingId);

        var apiKey = null;
        try { apiKey = localStorage.getItem('dlc_claude_key'); } catch (e) {}
        if (!apiKey) apiKey = biz._firestoreApiKey || null;

        _handleMessage(biz, text, apiKey)
          .then(function (result) {
            _hideTyping(typingId);

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
              var _ed = {
                staff:             _ecs.staff,
                services:          _ecs.services,
                date:              _ecs.date,
                time:              _ecs.time,
                lang:              _ecs.lang || 'en',
                totalDurationMins: _calcTotalDuration(biz, _ecs.services || [])
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
                      // First confirmation for this slot: replace Claude's speculative text
                      // ("What's your name?") with an explicit availability confirmation so
                      // the customer knows the time is actually free before sharing details.
                      if (biz._aiHistory.length &&
                          biz._aiHistory[biz._aiHistory.length - 1].role === 'assistant') {
                        biz._aiHistory.pop();
                      }
                      var _availMsg = _buildAvailConfirmMsg(biz, _ed);
                      biz._aiHistory.push({ role: 'assistant', content: _availMsg });
                      // pendingAction=booking_offer tells Claude to ask for name after "yes"
                      biz._bookingState.pendingAction = 'booking_offer';
                      _saveBookingState(biz);
                      _saveHistory(biz);
                      biz._offeredSlot = _slotKey;
                      _appendMessage(messagesEl, _availMsg, 'bot');
                    }
                  } else {
                    // Slot is taken — replace Claude's response with conflict notice
                    if (biz._aiHistory.length &&
                        biz._aiHistory[biz._aiHistory.length - 1].role === 'assistant') {
                      biz._aiHistory.pop();
                    }
                    biz._aiHistory.push({ role: 'assistant', content: avail.message });
                    _saveHistory(biz);
                    biz._offeredSlot = null; // slot changed — clear pending offer
                    _appendMessage(messagesEl, avail.message, 'bot');
                    // State preserved: customer only needs a different time/date/staff
                  }
                })
                .catch(function () {
                  // Fail-open: show Claude's response on any Firestore error
                  _appendMessage(messagesEl, result.text, 'bot');
                });
              return; // early check is async — skip the branches below for this turn
            }

            if (result.escalationType === 'appointment' && biz._bookingDraft) {
              // VALIDATE FIRST — do NOT show Claude's text until availability is confirmed.
              // Correct flow: validate → if available show confirmation; if not show rejection.
              var draft = biz._bookingDraft;
              draft.totalDurationMins = _calcTotalDuration(biz, draft.services || []);

              NailAvailabilityChecker.check(biz, draft)
                .then(function (avail) {
                  if (avail.valid) {
                    // Slot passes all checks — but vendor has NOT confirmed yet.
                    // Status: AVAILABLE_NOT_CONFIRMED.
                    // Replace Claude's premature "confirmed" text with a pending message.
                    if (biz._aiHistory && biz._aiHistory.length &&
                        biz._aiHistory[biz._aiHistory.length - 1].role === 'assistant') {
                      biz._aiHistory.pop();
                    }
                    var pendingConfirmMsg = _buildPendingConfirmMsg(biz, draft);
                    biz._aiHistory.push({ role: 'assistant', content: pendingConfirmMsg });
                    _saveHistory(biz);
                    _appendMessage(messagesEl, pendingConfirmMsg, 'bot');

                    // Finalise booking state — request is submitted, slot is held.
                    biz._bookingState = _emptyState();
                    _saveBookingState(biz);
                    biz._offeredSlot = null; // booking submitted — clear slot offer

                    // Capture draft values needed for callbacks before nulling the draft
                    var draftLang  = draft.lang;
                    var draftPhone = draft.phone;
                    biz._bookingDraft = null;

                    // Set in-flight guard BEFORE the async Firestore write.
                    // Cleared after 5s — safely past Firestore commit latency.
                    // Prevents double booking from rapid re-submission during the
                    // ~100-500ms window before the escalation doc becomes queryable.
                    biz._submissionInFlight = true;
                    setTimeout(function () { biz._submissionInFlight = false; }, 5000);

                    // Escalate: EscalationEngine writes to Firestore + shows spinner +
                    // fires onSnapshot when vendor confirms/declines (up to 20 min).
                    var esc = window.EscalationEngine;
                    if (esc && typeof esc.create === 'function') {
                      esc.create(biz, messagesEl, result.escalationType, draft);
                    }

                    // 60-second text-back gate.
                    // If vendor has not confirmed by then, tell customer to expect a text.
                    // Guard: skip if EscalationEngine already placed a confirmed bubble.
                    setTimeout(function () {
                      var confirmed = messagesEl.querySelector('.mp-ai__bubble--vendor-confirmed');
                      if (!confirmed) {
                        var tbMsg = _buildTextBackMsg(biz, { lang: draftLang, phone: draftPhone });
                        _appendMessage(messagesEl, tbMsg, 'bot');
                        biz._aiHistory.push({ role: 'assistant', content: tbMsg });
                        _saveHistory(biz);
                      }
                    }, 60000);
                  } else {
                    // Not available — suppress Claude's premature "confirmed" message.
                    // Replace it in history with the rejection so Claude knows what was
                    // told to the customer and can answer follow-ups naturally:
                    //   "when does Tracy work?", "what about 3 PM?", "who else is free?"
                    if (biz._aiHistory && biz._aiHistory.length &&
                        biz._aiHistory[biz._aiHistory.length - 1].role === 'assistant') {
                      biz._aiHistory.pop();
                    }
                    biz._aiHistory.push({ role: 'assistant', content: avail.message });
                    _saveHistory(biz);
                    biz._offeredSlot = null; // slot conflict at final check — clear offer
                    _appendMessage(messagesEl, avail.message, 'bot');
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

            } else {
              // Non-appointment response — show immediately, no availability gate needed
              _appendMessage(messagesEl, result.text, 'bot');
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
