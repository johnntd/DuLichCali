'use strict';
// node tests/weather.test.js — pure unit test for the weather agent helpers.
const W = require('../functions/lib/weather.js');
let pass = 0, fail = 0;
function ok(n, c) { c ? pass++ : fail++; console.log((c ? '  PASS ' : '  FAIL ') + n); }

// WMO code → condition + emoji.
ok('code 0 → clear', W.wxCondition(0).key === 'clear' && W.wxCondition(0).emoji === '☀️');
ok('code 3 → cloudy', W.wxCondition(3).key === 'cloudy');
ok('code 65 → rain', W.wxCondition(65).key === 'rain');
ok('code 95 → storm', W.wxCondition(95).key === 'storm');
ok('unknown/null code → cloudy fallback', W.wxCondition(null).key === 'cloudy' && W.wxCondition(7777).key === 'cloudy');

// outdoor/indoor/mixed.
ok('clear + mild → outdoor', W.outdoorScore(0, 0, 78, 60) === 'outdoor');
ok('rain → indoor', W.outdoorScore(65, 80, 70, 55) === 'indoor');
ok('high precip prob → indoor even if clear code', W.outdoorScore(0, 70, 78, 60) === 'indoor');
ok('partly + moderate precip → mixed', W.outdoorScore(2, 50, 78, 60) === 'mixed');
ok('extreme heat → mixed (not outdoor)', W.outdoorScore(0, 0, 99, 70) === 'mixed');

// Packing tips (deterministic keys).
var tips = W.buildPackingTips([
  { tMin: 45, tMax: 60, condition: 'cloudy' },     // cold → warm layers
  { tMin: 70, tMax: 92, condition: 'clear' },      // hot+clear → light/sun/hydrate
  { tMin: 55, tMax: 68, condition: 'rain' },       // rain
]);
ok('cold day → pack_warm_layers', tips.indexOf('pack_warm_layers') !== -1);
ok('hot clear → pack_light_breathable + pack_sun', tips.indexOf('pack_light_breathable') !== -1 && tips.indexOf('pack_sun') !== -1);
ok('rain day → pack_rain', tips.indexOf('pack_rain') !== -1);
ok('tips are de-duped + within whitelist', tips.length === new Set(tips).size && tips.every(function (k) { return W.TIP_KEYS.indexOf(k) !== -1; }));
ok('empty days → no tips', W.buildPackingTips([]).length === 0 && W.buildPackingTips(null).length === 0);

// sanitizeWeather: clamp + whitelist + honesty (unknown numerics → null, bad condition → null).
var s = W.sanitizeWeather({ destinations: [
  { city: 'San Diego', source: 'forecast', packingTips: ['pack_sun', 'bogus_tip'], days: [
    { date: '2026-07-01', tMax: 73.8, tMin: 62.7, precipProbMax: 0, condition: 'clear', rec: 'outdoor', source: 'forecast' },
    { date: '2026-07-02', tMax: null, tMin: null, precipProbMax: null, condition: 'weird', rec: 'nonsense', source: 'seasonal_normal' },
    { nodate: true },
  ] },
  { nocity: true },
] });
ok('drops destination with no city', s.length === 1 && s[0].city === 'San Diego');
ok('temps rounded to int', s[0].days[0].tMax === 74 && s[0].days[0].tMin === 63);
ok('bogus packing tip filtered out', s[0].packingTips.length === 1 && s[0].packingTips[0] === 'pack_sun');
ok('invalid condition → null', s[0].days[1].condition === null);
ok('invalid rec → mixed default', s[0].days[1].rec === 'mixed');
ok('day with no date dropped', s[0].days.length === 2);
ok('null temps stay null (no fabrication)', s[0].days[1].tMax === null && s[0].days[1].tMin === null);
ok('seasonal_normal source preserved', s[0].days[1].source === 'seasonal_normal');

// destination source derived when absent.
var s2 = W.sanitizeWeather({ destinations: [{ city: 'X', days: [{ date: '2026-07-01', condition: 'clear', source: 'seasonal_normal' }] }] });
ok('mixed/seasonal destination source derived', s2[0].source === 'seasonal_normal');
ok('all-unavailable → unavailable', W.sanitizeWeather({ destinations: [{ city: 'Y', days: [{ date: '2026-12-25', source: 'unavailable' }] }] })[0].source === 'unavailable');

// garbage input safe.
ok('garbage → []', W.sanitizeWeather(null).length === 0 && W.sanitizeWeather({}).length === 0 && W.sanitizeWeather({ destinations: 'no' }).length === 0);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
