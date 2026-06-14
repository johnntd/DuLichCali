'use strict';
// Pure-function tests for the AI Style Studio backend helpers. No Gemini calls.
// Run: node tests/unit/style-studio.test.js  (exit 0 = pass, 1 = fail)
const assert = require('assert');
const S = require('../../functions/style-studio-lib.js'); // extracted pure lib (see Step 3)

let n = 0; const ok = (m) => { n++; console.log('  ok -', m); };

// normalizeStudioMode
assert.strictEqual(S.normalizeStudioMode('haircut'), 'haircut'); ok('mode haircut');
assert.strictEqual(S.normalizeStudioMode('WIG'), 'wig'); ok('mode upper->wig');
assert.strictEqual(S.normalizeStudioMode('nonsense'), 'haircut'); ok('mode fallback->haircut');

// normalizeStudioOptions clamps to the mode's allowed enums
assert.deepStrictEqual(S.normalizeStudioOptions('color', { type: 'balayage' }), { type: 'balayage' }); ok('color balayage kept');
assert.deepStrictEqual(S.normalizeStudioOptions('color', { type: 'bogus' }), { type: 'highlight' }); ok('color bad->default');
assert.deepStrictEqual(S.normalizeStudioOptions('hairsystem', { type: 'crown' }), { type: 'crown' }); ok('hairsystem crown kept');

// beard forces audience=man at the orchestrator boundary (helper exposes the rule)
assert.strictEqual(S.audienceForMode('beard', 'woman'), 'man'); ok('beard forces man');
assert.strictEqual(S.audienceForMode('haircut', 'woman'), 'woman'); ok('haircut keeps audience');

// buildStudioAnalysisPrompt embeds mode guidance, scores schema, safety, lang
const p = S.buildStudioAnalysisPrompt('beard', { length: 'short', density: 'natural', shape: 'tapered' }, 'man', 'professional', 'masculine', 'en');
assert.ok(/symmetry/i.test(p) && /youthfulness/i.test(p), 'prompt has score keys'); ok('analysis prompt has scores');
assert.ok(/EXACTLY 5/i.test(p), 'prompt asks for 5'); ok('analysis prompt asks 5');
assert.ok(/positive/i.test(p) && /never.*medical/i.test(p), 'prompt has safety'); ok('analysis prompt has safety');

// normalizeStudioScores clamps 0..100 ints, fills missing with null
const sc = S.normalizeStudioScores({ symmetry: 87.4, youthfulness: 200, professional: -3, confidence: '70' });
assert.strictEqual(sc.symmetry, 87, 'symmetry rounded'); ok('scores rounded');
assert.strictEqual(sc.youthfulness, 100, 'over clamps to 100'); ok('scores clamp high');
assert.strictEqual(sc.professional, 0, 'under clamps to 0'); ok('scores clamp low');
assert.strictEqual(sc.confidence, 70, 'string coerced'); ok('scores coerce string');
assert.strictEqual(sc.softness, null, 'missing -> null'); ok('scores missing null');

// normalizeStudioScores rejects booleans, arrays, and objects (returns null)
const scBad = S.normalizeStudioScores({ professional: true, confidence: false, symmetry: [50], softness: {} });
assert.strictEqual(scBad.professional, null, 'boolean true -> null'); ok('scores boolean true -> null');
assert.strictEqual(scBad.confidence, null, 'boolean false -> null'); ok('scores boolean false -> null');
assert.strictEqual(scBad.symmetry, null, 'array -> null'); ok('scores array -> null');
assert.strictEqual(scBad.softness, null, 'object -> null'); ok('scores object -> null');

// normalizeStudioOptions: bad values fall back to defaults AND missing keys use default
assert.deepStrictEqual(
  S.normalizeStudioOptions('beard', { length: 'short', density: 'bogus' }),
  { length: 'short', density: 'natural', shape: 'rounded' }
); ok('beard options: valid kept, bad->default, missing->default');

// Guard: generateHaircutPreviews signature + the reused helpers still exist and
// were not renamed/broken by the studio addition (static source check — no exec).
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '../../functions/index.js'), 'utf8');
assert.ok(/exports\.generateHaircutPreviews\s*=\s*onCall\(/.test(src), 'generateHaircutPreviews intact'); ok('generateHaircutPreviews intact');
assert.ok(/exports\.generateStyleStudio\s*=\s*onCall\(/.test(src), 'generateStyleStudio added'); ok('generateStyleStudio present');
['function callGeminiImageEdit', 'function callGeminiHaircutAnalysis', 'function normalizeHaircutStyle', 'async function getAiKey']
  .forEach((sig) => { assert.ok(src.indexOf(sig) >= 0, sig + ' present'); ok(sig.replace('function ', '') + ' present'); });

// Guard: the studio module must never write image bytes to Firestore. It may
// only use localStorage/sessionStorage + native download. Static source scan.
const studioSrc = fs.readFileSync(require('path').join(__dirname, '../../mobile-barber/mobile-barber-style-studio.js'), 'utf8');
assert.ok(!/\.set\(|\.add\(|\.update\(|uploadBytes|putString/.test(studioSrc.replace(/setItem|setLang|setTimeout|setAttribute|addEventListener/g, '')),
  'studio module performs no Firestore/Storage write'); ok('studio writes nothing server-side');
assert.ok(/localStorage/.test(studioSrc), 'studio uses localStorage for favorites/cache'); ok('studio uses localStorage');

console.log(`\nstyle-studio pure tests: ${n} passed`);
