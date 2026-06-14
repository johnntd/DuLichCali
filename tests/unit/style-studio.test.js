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

console.log(`\nstyle-studio pure tests: ${n} passed`);
