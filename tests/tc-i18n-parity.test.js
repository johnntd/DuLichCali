'use strict';
// node tests/tc-i18n-parity.test.js — asserts the en/vi/es i18n blocks in travel-concierge.js have
// identical key sets (no string ships in only one or two languages). Extracts the `var T = {...}`
// literal with a string-aware brace scanner and evals it (pure string data).
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../travel-concierge.js', 'utf8');
let pass = 0, fail = 0;
function ok(n, c) { c ? pass++ : fail++; console.log((c ? '  PASS ' : '  FAIL ') + n); }

const start = src.indexOf('var T = {');
if (start < 0) { console.log('  FAIL could not locate "var T = {"'); process.exit(1); }
let i = src.indexOf('{', start), depth = 0, inStr = false, q = '', end = -1;
for (; i < src.length; i++) {
  const ch = src[i];
  if (inStr) { if (ch === '\\') { i++; continue; } if (ch === q) inStr = false; continue; }
  if (ch === "'" || ch === '"' || ch === '`') { inStr = true; q = ch; continue; }
  if (ch === '{') depth++;
  else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
}
const lit = src.slice(src.indexOf('{', start), end + 1);
let T;
try { T = eval('(' + lit + ')'); } catch (e) { console.log('  FAIL eval T: ' + e.message); process.exit(1); }

['en', 'vi', 'es'].forEach((l) => ok('block ' + l + ' present', T[l] && typeof T[l] === 'object'));
const en = Object.keys(T.en), vi = Object.keys(T.vi), es = Object.keys(T.es);
console.log('    key counts → en:' + en.length + ' vi:' + vi.length + ' es:' + es.length);
const diff = (a, b) => { const sb = new Set(b); return a.filter((k) => !sb.has(k)); };
const missVi = diff(en, vi), extraVi = diff(vi, en), missEs = diff(en, es), extraEs = diff(es, en);
if (missVi.length) console.log('    vi MISSING: ' + missVi.join(', '));
if (extraVi.length) console.log('    vi EXTRA: ' + extraVi.join(', '));
if (missEs.length) console.log('    es MISSING: ' + missEs.join(', '));
if (extraEs.length) console.log('    es EXTRA: ' + extraEs.join(', '));
ok('vi has exactly the en keys', !missVi.length && !extraVi.length);
ok('es has exactly the en keys', !missEs.length && !extraEs.length);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
