'use strict';
// tests/lib/avail-logic.js
// Pure availability-check logic extracted from NailAvailabilityChecker in receptionist.js.
// Takes pre-loaded booking arrays instead of querying Firestore — fully unit-testable.
//
// IMPORTANT: Keep this in sync with NailAvailabilityChecker in nailsalon/receptionist.js.
// If the production checker changes its conflict logic, update this file to match.

var DAYS        = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
var SLOT_STEP   = 30;  // minutes between candidate slots
var DEFAULT_DUR = 60;  // fallback service duration

// Short-day key map (matches _staffShortKey in receptionist.js)
var SHORT_KEY = { monday:'mon', tuesday:'tue', wednesday:'wed', thursday:'thu', friday:'fri', saturday:'sat', sunday:'sun' };

function toMins(t) {
  if (!t || typeof t !== 'string') return 0;
  var p = t.split(':');
  return parseInt(p[0] || '0', 10) * 60 + parseInt(p[1] || '0', 10);
}

function fromMins(m) {
  var h = Math.floor(m / 60), min = m % 60;
  return (h < 10 ? '0' : '') + h + ':' + (min < 10 ? '0' : '') + min;
}

function dayName(dateStr) {
  var d = new Date(dateStr + 'T12:00:00');
  return DAYS[d.getDay()];
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Get staff working hours for a specific date.
 * Returns {open: mins, close: mins} or null if not working.
 * Mirrors _getStaffShift() in receptionist.js exactly.
 */
function getStaffShift(biz, staffName, dateStr) {
  if (!biz || !biz.staff || !biz.staff.length || !staffName || !dateStr) return null;
  var keyLower = staffName.toLowerCase().trim();
  var member = null;
  for (var i = 0; i < biz.staff.length; i++) {
    var nm = (biz.staff[i].name || '').toLowerCase().trim();
    if (nm === keyLower || nm.indexOf(keyLower) >= 0 || keyLower.indexOf(nm) >= 0) {
      member = biz.staff[i]; break;
    }
  }
  if (!member || !member.schedule) return null;
  var dn    = dayName(dateStr);
  var sched = member.schedule[dn] || member.schedule[SHORT_KEY[dn]];
  if (!sched || sched.active === false) return null;
  var openStr  = sched.open  || sched.start;
  var closeStr = sched.close || sched.end;
  if (!openStr) return null;
  return { open: toMins(openStr), close: closeStr ? toMins(closeStr) : (19 * 60 + 30) };
}

/**
 * Find alternative free slots for a named staff member.
 * Searches bidirectionally from reqStart in 30-min steps.
 * Mirrors _findAlternativeSlots() in receptionist.js.
 */
function findAlternativeSlots(existing, staffKey, reqStart, totalMins, openMins, closeMins, maxSlots) {
  maxSlots = maxSlots || 3;
  var MAX_STEPS = 16;

  function isFree(t) {
    var tEnd = t + totalMins;
    if (t < openMins || tEnd > closeMins) return false;
    return !existing.some(function(appt) {
      var as = (appt.staff || '').toLowerCase();
      if (as !== staffKey && as !== 'any') return false;
      var aS = toMins(appt.requestedTime || appt.time || '00:00');
      var aD = appt.totalDurationMins || appt.durationMins || DEFAULT_DUR;
      return overlaps(t, tEnd, aS, aS + aD);
    });
  }

  var seen = {}, found = [];
  for (var i = 1; i <= MAX_STEPS && found.length < maxSlots * 2; i++) {
    var later   = reqStart + i * SLOT_STEP;
    var earlier = reqStart - i * SLOT_STEP;
    if (!seen[later]   && isFree(later))   { seen[later]   = true; found.push(later); }
    if (!seen[earlier] && isFree(earlier)) { seen[earlier] = true; found.push(earlier); }
  }
  found.sort(function(a, b) {
    var da = Math.abs(a - reqStart), db = Math.abs(b - reqStart);
    if (da !== db) return da - db;
    return b - a;
  });
  return found.slice(0, maxSlots).map(fromMins);
}

/**
 * Check booking availability against pre-loaded existing bookings.
 *
 * @param {Object}   biz              - vendor data with .staff[].schedule
 * @param {Object}   draft            - { staff, date, time, totalDurationMins, name, phone, isModify }
 * @param {Object[]} existingBookings - pre-loaded booking array (not Firestore)
 * @returns {{ valid: boolean, key?: string, message?: string, altSlots?: string[] }}
 */
function checkAvailability(biz, draft, existingBookings) {
  existingBookings = existingBookings || [];

  if (!draft || !draft.date || !draft.time) return { valid: true };

  var requestedStaff = (draft.staff || 'any').toLowerCase();
  var checkStaff     = requestedStaff !== 'any';
  // Customer conflict check: only run when name/phone present AND not a reschedule
  var checkCustomer  = !!(draft.name || draft.phone) && !draft.isModify;

  if (!checkStaff && !checkCustomer) return { valid: true };

  var totalMins    = draft.totalDurationMins || DEFAULT_DUR;
  var reqStartMins = toMins(draft.time);
  var reqEndMins   = reqStartMins + totalMins;

  // Filter to confirmed/in-progress bookings on the same date
  var existing = existingBookings.filter(function(b) {
    var bDate = b.requestedDate || b.date;
    return (b.status === 'confirmed' || b.status === 'in_progress') && bDate === draft.date;
  });

  // For reschedules: exclude the customer's own booking so it doesn't block itself
  // This mirrors the exact guard at line ~409 in receptionist.js:
  //   if (draft.isModify && draft.phone) { exclude phone matches }
  if (draft.isModify && draft.phone) {
    var ownPhone = draft.phone.replace(/\D/g, '');
    existing = existing.filter(function(b) {
      return (b.customerPhone || '').replace(/\D/g, '') !== ownPhone;
    });
  }

  // ── Staff shift gates ────────────────────────────────────────────────────
  if (checkStaff) {
    var shift = getStaffShift(biz, draft.staff, draft.date);

    if (shift === null) {
      return {
        valid: false, key: 'staff_not_working',
        message: (draft.staff || 'That technician') + ' is not working on ' + dayName(draft.date) + '.'
      };
    }

    if (reqStartMins < shift.open || reqEndMins > shift.close) {
      var openStr  = fromMins(shift.open);
      var closeStr = fromMins(shift.close);
      var latest   = fromMins(shift.close - totalMins);
      return {
        valid: false, key: 'outside_shift',
        open: openStr, close: closeStr, latest,
        message: draft.staff + ' works ' + openStr + '–' + closeStr + '. Latest start: ' + latest + '.'
      };
    }
  }

  // ── Staff conflict check ─────────────────────────────────────────────────
  if (checkStaff) {
    var hasConflict = existing.some(function(appt) {
      if ((appt.staff || '').toLowerCase() !== requestedStaff) return false;
      var aStart = toMins(appt.requestedTime || appt.time || '00:00');
      var aDur   = appt.totalDurationMins || appt.durationMins || DEFAULT_DUR;
      return overlaps(reqStartMins, reqEndMins, aStart, aStart + aDur);
    });

    if (hasConflict) {
      var sh      = getStaffShift(biz, draft.staff, draft.date);
      var openM   = sh ? sh.open  : toMins('09:00');
      var closeM  = sh ? sh.close : toMins('19:30');
      var altSlots = findAlternativeSlots(existing, requestedStaff, reqStartMins, totalMins, openM, closeM);

      // RX-012: find other staff who ARE available at the exact same time.
      // Mirrors the altStaff computation in NailAvailabilityChecker.check().
      var altStaff = [];
      (biz.staff || []).forEach(function(m) {
        if (m.active === false) return;
        var mName = (m.name || '').trim();
        if (!mName || mName.toLowerCase() === requestedStaff) return;
        var mShift = getStaffShift(biz, mName, draft.date);
        if (!mShift) return;
        if (reqStartMins < mShift.open || reqEndMins > mShift.close) return;
        var busy = existing.some(function(appt) {
          var as = (appt.staff || '').toLowerCase().trim();
          if (as !== mName.toLowerCase() && as !== 'any') return false;
          var aS = toMins(appt.requestedTime || appt.time || '00:00');
          var aD = appt.totalDurationMins || appt.durationMins || DEFAULT_DUR;
          return overlaps(aS, aS + aD, reqStartMins, reqEndMins);
        });
        if (!busy) altStaff.push(mName);
      });

      return {
        valid: false, key: 'conflict',
        staff: draft.staff, time: draft.time, altSlots: altSlots, altStaff: altStaff,
        message: (draft.staff || 'That technician') + ' at ' + draft.time + ' is already booked.'
          + (altSlots.length ? ' Alternatives: ' + altSlots.join(', ') : '')
          + (altStaff.length ? ' Available staff: ' + altStaff.join(', ') : '')
      };
    }
  }

  // ── Customer conflict check ──────────────────────────────────────────────
  if (checkCustomer) {
    var draftName  = (draft.name  || '').toLowerCase().trim();
    var draftPhone = (draft.phone || '').replace(/\D/g, '');

    for (var i = 0; i < existing.length; i++) {
      var appt      = existing[i];
      var apptName  = (appt.customerName  || '').toLowerCase().trim();
      var apptPhone = (appt.customerPhone || '').replace(/\D/g, '');
      var nameMatch  = draftName  && apptName  && (apptName === draftName || apptName.indexOf(draftName) >= 0 || draftName.indexOf(apptName) >= 0);
      var phoneMatch = draftPhone.length >= 7 && apptPhone.length >= 7 && apptPhone.indexOf(draftPhone.slice(-7)) >= 0;

      if (nameMatch || phoneMatch) {
        var aStart = toMins(appt.requestedTime || appt.time || '00:00');
        var aDur   = appt.totalDurationMins || appt.durationMins || DEFAULT_DUR;
        if (overlaps(reqStartMins, reqEndMins, aStart, aStart + aDur)) {
          var existSvcs = appt.selectedServices || (appt.service ? [appt.service] : ['an appointment']);
          return {
            valid: false, key: 'customer_conflict',
            services: existSvcs, staff: appt.staff, time: appt.requestedTime || appt.time,
            message: 'Customer already has ' + existSvcs.join('+') + ' at ' + (appt.requestedTime || appt.time) + ' that day.'
          };
        }
      }
    }
  }

  return { valid: true };
}

module.exports = { checkAvailability, getStaffShift, findAlternativeSlots, toMins, fromMins, dayName };
