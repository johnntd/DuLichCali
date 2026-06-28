/* Travel Package / Travel Guide — pure helpers (browser IIFE + node-testable, like tc-stays.js).
 * estimateEvPlan(opts)      — honest EV charge-stop estimate from VERIFIED distance + USER range.
 *                             Never invents battery state; returns rangeKnown:false when no range.
 * goldenHour(dateIso,lat,lng,utcOffset) — real sunrise/sunset/golden-hour (astronomical math).
 * verifyOrLink(value,opts)  — honesty gate: real value, else a {verify:true,label,url} marker so
 *                             the UI shows "Verify before going" + a search/directions link.
 * NO DOM / network / fabricated data. */
(function (root) {
  'use strict';

  // ── Honest EV charge planner ────────────────────────────────────────────────
  // Estimate ONLY from a verified drive distance + the user's own vehicle range. No live battery,
  // no charger availability — those are deferred. Returns rangeKnown:false (→ caller shows
  // Supercharger SEARCH links + "enter range") when range is unknown, so nothing is fabricated.
  function estimateEvPlan(o) {
    o = o || {};
    var miles = Number(o.miles) || 0;
    if (!(miles > 0)) return { ok: false, reason: 'no_distance' };
    var range = Number(o.rangeMiles) || 0;
    if (!(range > 0)) return { ok: true, rangeKnown: false, totalMiles: Math.round(miles), stops: null, reason: 'no_range' };
    var startPct = (o.startPct != null) ? Number(o.startPct) : 90;
    var reservePct = (o.reservePct != null) ? Number(o.reservePct) : 15;
    var chargeToPct = (o.chargeToPct != null) ? Number(o.chargeToPct) : 80;
    var firstLeg = range * Math.max(0, startPct - reservePct) / 100;          // miles before 1st charge
    var perCharge = range * Math.max(0, chargeToPct - reservePct) / 100;       // miles per charge cycle
    var stops = 0;
    if (miles > firstLeg && perCharge > 0) stops = 1 + Math.floor((miles - firstLeg) / perCharge);
    var arrivalPct = (stops === 0) ? Math.max(0, Math.round(startPct - (miles / range * 100))) : null;
    return {
      ok: true, rangeKnown: true, totalMiles: Math.round(miles), stops: stops,
      firstLegMiles: Math.round(firstLeg), usablePerChargeMiles: Math.round(perCharge),
      arrivalPct: arrivalPct, // battery % at destination IF no stop needed (else null)
      assumptions: { rangeMiles: range, startPct: startPct, reservePct: reservePct, chargeToPct: chargeToPct },
    };
  }

  // ── Real sunrise / sunset / golden hour (Almanac sunrise equation) ──────────
  // utcOffset = local offset in hours (California PDT = -7). Returns null when lat/lng missing.
  function sunTimes(dateIso, lat, lng, utcOffset) {
    if (lat == null || lng == null || dateIso == null) return null;
    lat = Number(lat); lng = Number(lng); utcOffset = (utcOffset == null) ? -7 : Number(utcOffset);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    var d = new Date(String(dateIso).slice(0, 10) + 'T12:00:00Z');
    if (isNaN(d.getTime())) return null;
    var start = Date.UTC(d.getUTCFullYear(), 0, 0);
    var N = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start) / 86400000);
    var rad = Math.PI / 180, deg = 180 / Math.PI, ZENITH = 90.833;
    function calc(isSunrise) {
      var lngHour = lng / 15;
      var t = isSunrise ? N + ((6 - lngHour) / 24) : N + ((18 - lngHour) / 24);
      var M = (0.9856 * t) - 3.289;
      var L = M + (1.916 * Math.sin(M * rad)) + (0.020 * Math.sin(2 * M * rad)) + 282.634;
      L = ((L % 360) + 360) % 360;
      var RA = deg * Math.atan(0.91764 * Math.tan(L * rad));
      RA = ((RA % 360) + 360) % 360;
      RA = (RA + (Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90)) / 15;
      var sinDec = 0.39782 * Math.sin(L * rad);
      var cosDec = Math.cos(Math.asin(sinDec));
      var cosH = (Math.cos(ZENITH * rad) - (sinDec * Math.sin(lat * rad))) / (cosDec * Math.cos(lat * rad));
      if (cosH > 1 || cosH < -1) return null; // sun never rises / never sets at this date+lat
      var H = isSunrise ? (360 - deg * Math.acos(cosH)) : (deg * Math.acos(cosH));
      H = H / 15;
      var T = H + RA - (0.06571 * t) - 6.622;
      var UT = ((T - lngHour) % 24 + 24) % 24;
      var local = ((UT + utcOffset) % 24 + 24) % 24;
      return Math.round(local * 60); // minutes after local midnight
    }
    var sr = calc(true), ss = calc(false);
    if (sr == null || ss == null) return null;
    return { sunriseMin: sr, sunsetMin: ss };
  }
  function fmtMin(min) {
    if (min == null || isNaN(min)) return '';
    min = ((Math.round(min) % 1440) + 1440) % 1440;
    var h = Math.floor(min / 60), m = min % 60, sfx = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + sfx;
  }
  // Golden hour ≈ the hour after sunrise + the hour before sunset. Strings labeled approximate.
  function goldenHour(dateIso, lat, lng, utcOffset) {
    var s = sunTimes(dateIso, lat, lng, utcOffset);
    if (!s) return null;
    return {
      sunrise: fmtMin(s.sunriseMin), sunset: fmtMin(s.sunsetMin),
      morningGolden: fmtMin(s.sunriseMin) + '–' + fmtMin(s.sunriseMin + 60),
      eveningGolden: fmtMin(s.sunsetMin - 60) + '–' + fmtMin(s.sunsetMin),
      sunriseMin: s.sunriseMin, sunsetMin: s.sunsetMin,
    };
  }

  // ── Honesty gate ────────────────────────────────────────────────────────────
  // A real, present value passes through; anything missing/placeholder returns a verify marker so
  // the UI renders "Verify before going" + a search/directions link — NEVER a fabricated value.
  function verifyOrLink(value, opts) {
    opts = opts || {};
    var s = (value == null) ? '' : String(value).trim();
    var bad = s === '' || /^(n\/?a|none|null|undefined|unknown|pending( verification)?|tbd|\$\$\$?\$?)$/i.test(s);
    if (!bad) return { verify: false, text: s };
    return { verify: true, label: opts.label || 'Verify before going', url: opts.url || '' };
  }
  function estLabel(text) { var s = (text == null) ? '' : String(text).trim(); return s ? (s + ' (est.)') : ''; }

  root.TCPackage = {
    estimateEvPlan: estimateEvPlan,
    sunTimes: sunTimes, goldenHour: goldenHour, fmtMin: fmtMin,
    verifyOrLink: verifyOrLink, estLabel: estLabel,
  };
})(typeof window !== 'undefined' ? window : this);
