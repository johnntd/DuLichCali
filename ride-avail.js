/**
 * ride-avail.js — Future ride availability + double-booking prevention
 *
 * Checks whether drivers are on schedule AND have no conflicting bookings
 * at a requested future date/time/region, then returns the number of free slots.
 *
 * Exposed globally as window.DLCRideAvail
 *
 * API:
 *   DLCRideAvail.check(dateStr, timeStr, regionId, durationMins)
 *     → Promise<{ available, freeCount, driverCount, reason, eligibleDrivers }>
 *
 *   DLCRideAvail.getRegionForAirport(airportCode) → regionId | null
 *
 * reason values:
 *   'ok'           — drivers are available and not fully booked
 *   'no_schedule'  — no driver has this day/time in their weekly schedule
 *   'fully_booked' — all scheduled drivers already have conflicting bookings
 *   'missing_datetime' — dateStr or timeStr not provided
 *   'no_region'    — regionId not provided; check cannot run
 *   'no_db'        — Firestore not reachable; caller should fail open
 *   'error'        — unexpected error; caller should fail open
 */
window.DLCRideAvail = (function () {
  'use strict';

  // Airport code → DLC region ID (mirrors workflowEngine.js AIRPORT_REGION)
  var AIRPORT_REGION = {
    SFO: 'bayarea', OAK: 'bayarea', SJC: 'bayarea', SMF: 'bayarea',
    LAX: 'socal',   SNA: 'socal',   BUR: 'socal',   LGB: 'socal',   ONT: 'socal',
    SAN: 'sandiego', PSP: 'palmsprings',
  };

  // Statuses that mean the booking is finished and no longer blocks availability
  var DONE = { cancelled: 1, rejected: 1, completed: 1, no_show: 1 };

  // Minutes of buffer pad added around each ride when computing overlap windows
  var BUFFER = 30;

  // Default trip duration used when we have no route estimate
  var DEFAULT_DURATION = 90;

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function _toMins(hhmm) {
    if (!hhmm) return 0;
    var p = String(hhmm).split(':');
    return (+p[0]) * 60 + (+(p[1] || 0));
  }

  function _fromMins(m) {
    m = Math.max(0, Math.min(1439, m));
    var h  = Math.floor(m / 60);
    var mn = m % 60;
    return (h < 10 ? '0' : '') + h + ':' + (mn < 10 ? '0' : '') + mn;
  }

  // Parse YYYY-MM-DD without timezone drift
  function _dayOfWeek(dateStr) {
    var p = dateStr.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]).getDay(); // 0=Sun … 6=Sat
  }

  function _getDb() {
    // script.js sets `const db = firebase.firestore()` at top level (accessible as global)
    // workflowEngine / ride-intake use `firebase.firestore()` inline
    if (typeof db !== 'undefined' && db) return db;
    if (typeof firebase !== 'undefined' && firebase.firestore) return firebase.firestore();
    if (window.dlcDb) return window.dlcDb;
    return null;
  }

  // ── Core availability check ──────────────────────────────────────────────────

  /**
   * @param {string} dateStr       YYYY-MM-DD
   * @param {string} timeStr       HH:mm
   * @param {string} regionId      e.g. 'bayarea', 'socal', 'sandiego'
   * @param {number} [durationMins] estimated trip length (default 90)
   */
  function check(dateStr, timeStr, regionId, durationMins) {
    // Validate inputs
    if (!dateStr || !timeStr) {
      return Promise.resolve({
        available: false, freeCount: 0, driverCount: 0,
        reason: 'missing_datetime', eligibleDrivers: [],
      });
    }
    if (!regionId) {
      // Can't check without region — fail open so booking proceeds
      return Promise.resolve({
        available: true, freeCount: 1, driverCount: 0,
        reason: 'no_region', eligibleDrivers: [],
      });
    }

    var firestoreDb = _getDb();
    if (!firestoreDb) {
      console.warn('[DLCRideAvail] Firestore not available — failing open');
      return Promise.resolve({
        available: true, freeCount: 1, driverCount: 0,
        reason: 'no_db', eligibleDrivers: [],
      });
    }

    var reqMins    = _toMins(timeStr);
    var reqDay     = _dayOfWeek(dateStr);
    var duration   = (typeof durationMins === 'number' && durationMins > 0) ? durationMins : DEFAULT_DURATION;
    var winStart   = dateStr + 'T' + _fromMins(Math.max(0, reqMins - BUFFER)) + ':00';
    var winEnd     = dateStr + 'T' + _fromMins(Math.min(1439, reqMins + duration + BUFFER)) + ':00';

    // ── Step 1: pull all active drivers ──────────────────────────────────────
    return firestoreDb.collection('drivers')
      .where('adminStatus', '==', 'active')
      .get()
      .then(function (driverSnap) {
        var eligible = [];

        driverSnap.docs.forEach(function (doc) {
          var d    = doc.data();
          d.id     = doc.id;
          var name = d.fullName || doc.id;

          // Compliance: must be fully approved
          if (d.complianceStatus !== 'approved') {
            console.log('[RideAvail]', name, '→ skip: complianceStatus', d.complianceStatus);
            return;
          }
          // Region: driver must serve this region
          if ((d.regions || []).indexOf(regionId) < 0) {
            console.log('[RideAvail]', name, '→ skip: not in region', regionId);
            return;
          }
          // Document expiry: check against requested DATE (not today)
          if (d.licExpiry && d.licExpiry < dateStr) {
            console.log('[RideAvail]', name, '→ skip: licExpiry', d.licExpiry);
            return;
          }
          if (d.regExpiry && d.regExpiry < dateStr) {
            console.log('[RideAvail]', name, '→ skip: regExpiry', d.regExpiry);
            return;
          }
          if (d.insExpiry && d.insExpiry < dateStr) {
            console.log('[RideAvail]', name, '→ skip: insExpiry', d.insExpiry);
            return;
          }
          // Blackout date
          var blackouts = (d.availability && d.availability.blackoutDates) || [];
          if (blackouts.indexOf(dateStr) >= 0) {
            console.log('[RideAvail]', name, '→ skip: blackout on', dateStr);
            return;
          }
          // Weekly schedule: must have this day enabled and the requested time within shift
          var ws    = d.availability && d.availability.weeklySchedule;
          var sched = ws && ws[reqDay];
          if (!sched || !sched.enabled) {
            console.log('[RideAvail]', name, '→ skip: not scheduled on day', reqDay);
            return;
          }
          var schedStart = _toMins(sched.start || '00:00');
          var schedEnd   = _toMins(sched.end   || '23:59');
          if (reqMins < schedStart || reqMins > schedEnd) {
            console.log('[RideAvail]', name, '→ skip: outside hours', sched.start, '–', sched.end);
            return;
          }

          console.log('[RideAvail]', name, '→ eligible for', dateStr, timeStr);
          eligible.push(d);
        });

        if (eligible.length === 0) {
          return {
            available: false, freeCount: 0, driverCount: 0,
            reason: 'no_schedule', eligibleDrivers: [],
          };
        }

        // ── Step 2: query bookings in the conflict window ─────────────────────
        return firestoreDb.collection('bookings')
          .where('datetime', '>=', winStart)
          .where('datetime', '<=', winEnd)
          .get()
          .then(function (bookSnap) {
            // Collect non-cancelled/completed bookings
            var conflicts = [];
            bookSnap.docs.forEach(function (doc) {
              var b = doc.data();
              if (!DONE[b.status]) {
                conflicts.push(b);
              }
            });

            console.log('[RideAvail] Conflict window', winStart, '→', winEnd,
                        '| conflicts:', conflicts.length, '| eligible drivers:', eligible.length);

            // Tally occupied driver slots
            //   - driverId set → that specific driver is occupied
            //   - driverId absent (dispatching/offered) → consumes one driver slot from the region
            var assignedIds   = {};
            var dispatchCount = 0;
            conflicts.forEach(function (b) {
              if (b.driverId) {
                assignedIds[b.driverId] = true;
              } else {
                dispatchCount++;
              }
            });

            // Drivers still free = eligible minus already-assigned ones
            var freeDrivers = eligible.filter(function (d) { return !assignedIds[d.id]; });
            // Subtract dispatching slots (each can claim one free driver)
            var freeCount = Math.max(0, freeDrivers.length - dispatchCount);

            console.log('[RideAvail] assigned:', Object.keys(assignedIds).length,
                        'dispatching:', dispatchCount, '| free slots:', freeCount);

            return {
              available:       freeCount > 0,
              freeCount:       freeCount,
              driverCount:     eligible.length,
              conflictCount:   conflicts.length,
              reason:          freeCount > 0 ? 'ok' : 'fully_booked',
              eligibleDrivers: eligible,
            };
          });
      })
      .catch(function (err) {
        console.warn('[DLCRideAvail] check error:', err);
        // Fail open — a Firestore error must never silently block a booking
        return {
          available: true, freeCount: 1, driverCount: 0,
          reason: 'error', eligibleDrivers: [],
        };
      });
  }

  // ── Airport → region helper ──────────────────────────────────────────────────
  function getRegionForAirport(code) {
    return AIRPORT_REGION[(code || '').toUpperCase()] || null;
  }

  // ── Human-readable unavailability messages ────────────────────────────────────
  var MSGS = {
    no_schedule: {
      en: function(d,t){ return 'No drivers are scheduled on ' + d + ' at ' + t + '. Please choose a different date or time.'; },
      vi: function(d,t){ return 'Không có tài xế nào trong lịch ngày ' + d + ' lúc ' + t + '. Vui lòng chọn thời gian khác.'; },
      es: function(d,t){ return 'No hay conductores programados el ' + d + ' a las ' + t + '. Por favor elige otra hora.'; },
    },
    fully_booked: {
      en: function(d,t,n){ return 'Fully booked at ' + t + ' on ' + d + ' — all ' + n + ' driver(s) are reserved. Please choose a different time.'; },
      vi: function(d,t,n){ return 'Đã hết chỗ lúc ' + t + ' ngày ' + d + ' — ' + n + ' tài xế đều đã có lịch. Vui lòng chọn giờ khác.'; },
      es: function(d,t,n){ return 'Sin disponibilidad a las ' + t + ' el ' + d + ' — los ' + n + ' conductor(es) están reservados. Elige otra hora.'; },
    },
  };

  function getMessage(result, dateStr, timeStr, lang) {
    var l = lang || 'en';
    if (!MSGS[result.reason]) return null;
    var fn = MSGS[result.reason][l] || MSGS[result.reason].en;
    return fn(dateStr, timeStr, result.driverCount || 0);
  }

  // ── Public API ────────────────────────────────────────────────────────────────
  return {
    check:               check,
    getRegionForAirport: getRegionForAirport,
    getMessage:          getMessage,
  };

}());
