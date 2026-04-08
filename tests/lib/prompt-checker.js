'use strict';
// tests/lib/prompt-checker.js
// Loads nailsalon/receptionist.js source as a string and provides
// helpers to assert that critical prompt instructions are present.
// This is a "static analysis" test — no execution, just grep.

var fs   = require('fs');
var path = require('path');

var RECEPTIONIST_PATH = path.join(__dirname, '../../nailsalon/receptionist.js');

function loadSource() {
  return fs.readFileSync(RECEPTIONIST_PATH, 'utf8');
}

/** Returns true if the source contains the given string or regex. */
function sourceContains(src, pattern) {
  if (typeof pattern === 'string')  return src.indexOf(pattern) >= 0;
  if (pattern instanceof RegExp)    return pattern.test(src);
  return false;
}

/** Count occurrences of a string in source. */
function sourceCount(src, str) {
  var count = 0, idx = 0;
  while ((idx = src.indexOf(str, idx)) >= 0) { count++; idx++; }
  return count;
}

module.exports = { loadSource, sourceContains, sourceCount, RECEPTIONIST_PATH };
