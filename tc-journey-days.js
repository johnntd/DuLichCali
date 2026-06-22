/* Deterministic journey-day helpers for the Travel Concierge. Pure, browser-IIFE + node-testable.
 *
 * Fix for the P0 "Journey Builder skips Day 3" bug. Two pure functions:
 *   1) fillStayWindows  — resolve a parseable [arrival, departure) window for every overnight
 *      stay, so the deterministic day plan (buildSegmentDayPlan) never sees an empty date and
 *      bails to the legacy AI-skeleton path (which folds short transfer/pass-through stops and
 *      drops the intermediate day).
 *   2) reconcileCalendarDays — after generation, guarantee EXACTLY one day per inclusive calendar
 *      date, in order; insert a placeholder for any MISSING day (incl. middle days — the bug);
 *      drop out-of-range days. Never silently skips a transfer/middle day.
 *
 * No DOM / Firebase / framework deps — loadable in the browser and under bare `node` (see
 * tests/journey-days.test.js). ISO dates are YYYY-MM-DD (lexically sortable). */
(function (root) {
  'use strict';
  var DAY_MS = 86400000;
  function isoToDate(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function dateToIso(dt) { var mo = dt.getMonth() + 1, d = dt.getDate(); return dt.getFullYear() + '-' + (mo < 10 ? '0' : '') + mo + '-' + (d < 10 ? '0' : '') + d; }
  function addDaysIso(iso, n) { var d = isoToDate(iso); return d ? dateToIso(new Date(d.getTime() + n * DAY_MS)) : ''; }

  // Resolve [arrival, departure) ISO windows for overnight stays (in trip order).
  //   arrival = explicit stay.date → the inbound transfer/transport date for that city
  //             → the previous stay's arrival → startIso (first stay).
  //   departure = the NEXT stay's arrival → endIso (last stay).
  // Then enforce arrival < departure (≥ 1 night) and re-thread the chain so it stays contiguous.
  // inboundIsoByCity: { '<city lowercased>': '<arriving-leg ISO date>' }.
  function fillStayWindows(stays, startIso, endIso, inboundIsoByCity) {
    stays = (stays || []).map(function (s) { return { city: (s && s.city) || '', date: (s && s.date) || '' }; });
    inboundIsoByCity = inboundIsoByCity || {};
    var n = stays.length;
    if (!n) return [];
    var arr = new Array(n);
    // Pass 1: explicit stay date, else the inbound-leg date for that city.
    for (var i = 0; i < n; i++) {
      var iso = isoToDate(stays[i].date) ? stays[i].date : '';
      if (!iso) { var inb = inboundIsoByCity[(stays[i].city || '').trim().toLowerCase()]; if (isoToDate(inb)) iso = inb; }
      arr[i] = iso;
    }
    // Pass 2: forward-fill still-empty arrivals (first → startIso, rest → previous arrival).
    for (var j = 0; j < n; j++) { if (!arr[j]) arr[j] = (j === 0) ? (startIso || '') : (arr[j - 1] || startIso || ''); }
    if (!arr[0]) arr[0] = startIso || '';
    // Departures + ≥1-night enforcement.
    var out = [];
    for (var k = 0; k < n; k++) {
      var a = arr[k] || startIso || '';
      var dep = (k < n - 1) ? (arr[k + 1] || '') : (endIso || '');
      if (!dep) dep = endIso || a;
      if (!(isoToDate(a) && isoToDate(dep)) || dep <= a) dep = addDaysIso(a, 1) || dep;
      out.push({ city: stays[k].city, arrivalIso: a, departureIso: dep, date: a });
    }
    // Re-thread: each non-last departure meets the next arrival (keeps the calendar contiguous).
    for (var m = 0; m < out.length - 1; m++) {
      var nextA = out[m + 1].arrivalIso;
      if (nextA && nextA > out[m].arrivalIso && out[m].departureIso !== nextA) out[m].departureIso = nextA;
    }
    return out;
  }

  // Guarantee plan.days has EXACTLY one entry per expected inclusive calendar date, in order.
  //   days     = existing plan.days (each may carry .iso and/or display .date, .sections, flags)
  //   expected = [{ iso, date, isTravelDay?, isReturnDay?, destinationIndex? }] — the canonical
  //              calendar sequence (type hints from the deterministic segment plan when available)
  // Existing days are matched by ISO, falling back to display-date string (skeleton days have no
  // .iso). A missing calendar date becomes a placeholder day (_placeholder + _needsDetail) carrying
  // the segment type hint. Out-of-range days are dropped. Returns { days, repaired }.
  function reconcileCalendarDays(days, expected) {
    days = days || []; expected = expected || [];
    if (!expected.length) return { days: days, repaired: 0 };
    var used = [], out = [], repaired = 0, lastDest = 0;
    function findMatch(e) {
      for (var i = 0; i < days.length; i++) {
        if (used[i]) continue;
        var d = days[i];
        if ((d && d.iso && e.iso && d.iso === e.iso) || (d && d.date && e.date && d.date === e.date)) { used[i] = true; return d; }
      }
      return null;
    }
    expected.forEach(function (e) {
      var d = findMatch(e);
      if (d) {
        d.iso = e.iso; if (!d.date) d.date = e.date;
        if (d.destinationIndex == null) d.destinationIndex = (e.destinationIndex != null ? e.destinationIndex : lastDest);
        out.push(d);
      } else {
        repaired++;
        out.push({
          date: e.date || '', iso: e.iso, title: '', theme: '', summary: '',
          destinationIndex: (e.destinationIndex != null ? e.destinationIndex : lastDest),
          isTravelDay: !!e.isTravelDay, isReturnDay: !!e.isReturnDay,
          sections: [], _needsDetail: true, _placeholder: true,
        });
      }
      lastDest = out[out.length - 1].destinationIndex || 0;
    });
    out.forEach(function (d, k) { d.dayNumber = k + 1; });
    return { days: out, repaired: repaired };
  }

  root.TCJourneyDays = {
    fillStayWindows: fillStayWindows,
    reconcileCalendarDays: reconcileCalendarDays,
    _isoToDate: isoToDate, _dateToIso: dateToIso, _addDaysIso: addDaysIso,
  };
})(typeof window !== 'undefined' ? window : this);
