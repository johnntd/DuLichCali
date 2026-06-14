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

// Guard: wig/hair-system replacement fix — mode-aware clause is wired correctly.
assert.ok(/const REPLACE_HAIR_CLAUSE\s*=/.test(src), 'REPLACE_HAIR_CLAUSE defined'); ok('REPLACE_HAIR_CLAUSE present');
assert.ok(/function normalizeHaircutStyle\(s, audience, idx, mode\)/.test(src), 'normalizeHaircutStyle takes mode'); ok('normalizeHaircutStyle mode param');
assert.ok(/mode === 'wig' \|\| mode === 'hairsystem'/.test(src), 'wig/hairsystem select replacement clause'); ok('replace-mode selection');
// generateHaircutPreviews codepath must stay in-place: its calls pass 'haircut'.
assert.ok((src.match(/normalizeHaircutStyle\(s, audience, i, 'haircut'\)/g) || []).length >= 2, 'planHaircutStyles pins haircut mode'); ok('haircut mode pinned (no regression)');
assert.ok(/normalizeHaircutStyle\(s, opts\.audience, i, opts\.mode\)/.test(src), 'studio passes opts.mode'); ok('studio passes mode');

// ── Task 1: Master Stylist — expanded goals + the master prompt builder ──────
assert.ok(S.STUDIO_GOALS.includes('executive') && S.STUDIO_GOALS.includes('business') && S.STUDIO_GOALS.includes('glamorous'), 'goals expanded'); ok('goals expanded');
const mp = S.buildMasterStylistPrompt('man', 'professional', 'en');
assert.ok(/single best look|ONE/i.test(mp) && /bestLook/.test(mp), 'master prompt asks one best look'); ok('master prompt one look');
assert.ok(/imageEditPrompt/.test(mp) && /explanation/.test(mp), 'master prompt requests edit + explanation'); ok('master prompt edit+why');
assert.ok(/positive/i.test(mp) && /never.*(balding|medical)/i.test(mp), 'master prompt safety'); ok('master prompt safety');
// normalizeMasterpiece coerces a partial model object into the masterpiece shape.
const m = S.normalizeMasterpiece({ title:'X', explanation:'Y', imageEditPrompt:'Z', attributes:{ haircut:'a' } });
assert.strictEqual(m.title,'X'); assert.strictEqual(m.imageEditPrompt,'Z'); assert.strictEqual(m.attributes.haircut,'a'); ok('normalizeMasterpiece ok');
assert.deepStrictEqual(S.normalizeMasterpiece(null).attributes, {}); ok('normalizeMasterpiece null-safe');

// ── Task 2: shared core + master mode + clause wiring (static source guards) ──
assert.ok(/const MASTER_STYLIST_CLAUSE\s*=/.test(src), 'MASTER_STYLIST_CLAUSE present'); ok('master clause present');
assert.ok(/async function runStudioGeneration\(/.test(src), 'runStudioGeneration extracted'); ok('shared core present');
assert.ok(/exports\.generateStyleStudio\s*=\s*onCall\(/.test(src), 'vendor studio intact'); ok('vendor studio intact');
assert.ok(/mode === 'master'/.test(src), 'master branch present'); ok('master branch');

console.log(`\nstyle-studio pure tests: ${n} passed`);
