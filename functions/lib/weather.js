'use strict';
// Pure, node-testable weather helpers for the Travel Concierge weather agent (Open-Meteo data).
// NO network, NO secrets. The callable in functions/index.js does the fetch; this module maps WMO
// codes → conditions, decides indoor/outdoor, derives deterministic packing-tip KEYS (resolved to
// vi/en/es on the frontend), and clamps the assembled output. HONESTY: condition is a FIXED lookup
// (never inferred), and the clamp never invents temps — unknown numeric fields stay null.

var COND_BY_CODE = {
  0: 'clear',
  1: 'partly', 2: 'partly',
  3: 'cloudy',
  45: 'fog', 48: 'fog',
  51: 'drizzle', 53: 'drizzle', 55: 'drizzle', 56: 'drizzle', 57: 'drizzle',
  61: 'rain', 63: 'rain', 65: 'rain', 66: 'rain', 67: 'rain',
  71: 'snow', 73: 'snow', 75: 'snow', 77: 'snow',
  80: 'showers', 81: 'showers', 82: 'showers',
  85: 'snow', 86: 'snow',
  95: 'storm', 96: 'storm', 99: 'storm',
};
var EMOJI = { clear: '☀️', partly: '🌤️', cloudy: '☁️', fog: '🌫️', drizzle: '🌦️', rain: '🌧️', snow: '🌨️', showers: '🌧️', storm: '⛈️' };
var CONDITIONS = ['clear', 'partly', 'cloudy', 'fog', 'drizzle', 'rain', 'snow', 'showers', 'storm'];
var RECS = ['outdoor', 'indoor', 'mixed'];
var SOURCES = ['forecast', 'seasonal_normal', 'unavailable'];
var TIP_KEYS = ['pack_warm_layers', 'pack_light_breathable', 'pack_sun', 'pack_rain', 'pack_layers_swing', 'pack_snow', 'pack_hydrate'];

function wxCondition(code) {
  var key = (code == null) ? 'cloudy' : (COND_BY_CODE[code] || 'cloudy');
  return { key: key, emoji: EMOJI[key] || '☁️' };
}

// rec: 'outdoor' | 'indoor' | 'mixed' — wet conditions or high precip chance → indoor; calm + mild → outdoor.
function outdoorScore(code, precipProbMax, tMax, tMin) {
  var cond = wxCondition(code).key;
  var wet = (cond === 'rain' || cond === 'storm' || cond === 'snow' || cond === 'drizzle' || cond === 'showers');
  var pp = (precipProbMax == null) ? null : Number(precipProbMax);
  if (wet || (pp != null && pp >= 60)) return 'indoor';
  var dry = (cond === 'clear' || cond === 'partly' || cond === 'cloudy' || cond === 'fog');
  var tempOk = (tMax == null || Number(tMax) <= 95) && (tMin == null || Number(tMin) >= 40);
  if (dry && (pp == null || pp < 40) && tempOk) return 'outdoor';
  return 'mixed';
}

// Deterministic packing-tip KEYS from a city's days (resolved to language on the frontend).
function buildPackingTips(days) {
  days = Array.isArray(days) ? days : [];
  var tips = {}, anyRain = false, anySnow = false, anyClearHot = false;
  days.forEach(function (d) {
    if (!d) return;
    var tMin = (d.tMin == null) ? null : Number(d.tMin);
    var tMax = (d.tMax == null) ? null : Number(d.tMax);
    var cond = d.condition || '';
    if (tMin != null && tMin < 50) tips.pack_warm_layers = 1;
    if (tMax != null && tMax >= 88) { tips.pack_light_breathable = 1; tips.pack_sun = 1; }
    if (cond === 'rain' || cond === 'showers' || cond === 'storm' || cond === 'drizzle') anyRain = true;
    if (cond === 'snow') anySnow = true;
    if (tMax != null && tMin != null && (tMax - tMin) >= 25) tips.pack_layers_swing = 1;
    if (cond === 'clear' && tMax != null && tMax >= 80) anyClearHot = true;
  });
  if (anyRain) tips.pack_rain = 1;
  if (anySnow) tips.pack_snow = 1;
  if (anyClearHot) { tips.pack_sun = 1; tips.pack_hydrate = 1; }
  return TIP_KEYS.filter(function (k) { return tips[k]; });
}

function clampInt(x) { if (x == null) return null; var n = Math.round(Number(x)); return isFinite(n) ? n : null; }
function clampPct(x) { if (x == null) return null; var n = Math.round(Number(x)); return (isFinite(n) && n >= 0 && n <= 100) ? n : null; }

function sanitizeDay(d) {
  d = d || {};
  var source = SOURCES.indexOf(d.source) !== -1 ? d.source : 'forecast';
  var condition = CONDITIONS.indexOf(d.condition) !== -1 ? d.condition : null;
  return {
    date: String(d.date || '').slice(0, 10),
    tMax: clampInt(d.tMax),
    tMin: clampInt(d.tMin),
    precipProbMax: clampPct(d.precipProbMax),
    condition: condition,
    emoji: condition ? (EMOJI[condition] || '') : '',
    rec: RECS.indexOf(d.rec) !== -1 ? d.rec : 'mixed',
    source: source,
  };
}

function sanitizeWeather(parsed) {
  var dests = (parsed && Array.isArray(parsed.destinations)) ? parsed.destinations : [];
  return dests.filter(function (x) { return x && x.city; }).slice(0, 8).map(function (x) {
    var days = (Array.isArray(x.days) ? x.days : []).filter(function (d) { return d && d.date; }).slice(0, 14).map(sanitizeDay);
    var tips = (Array.isArray(x.packingTips) ? x.packingTips : []).filter(function (k) { return TIP_KEYS.indexOf(k) !== -1; });
    var known = days.filter(function (d) { return d.source !== 'unavailable'; });
    var source = SOURCES.indexOf(x.source) !== -1 ? x.source
      : (!known.length ? 'unavailable' : (known.every(function (d) { return d.source === 'forecast'; }) ? 'forecast' : 'seasonal_normal'));
    return { city: String(x.city).slice(0, 80), days: days, packingTips: tips, source: source };
  });
}

module.exports = {
  wxCondition: wxCondition,
  outdoorScore: outdoorScore,
  buildPackingTips: buildPackingTips,
  sanitizeWeather: sanitizeWeather,
  COND_BY_CODE: COND_BY_CODE,
  CONDITIONS: CONDITIONS,
  TIP_KEYS: TIP_KEYS,
};
