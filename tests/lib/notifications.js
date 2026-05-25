'use strict';

var fs = require('fs');
var path = require('path');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertContains(haystack, needle, msg) {
  if (typeof haystack !== 'string' || haystack.indexOf(needle) < 0) {
    throw new Error((msg ? msg + ': ' : '') + 'expected to contain: ' + needle);
  }
}

function runNotificationTests(test) {
  var src = fs.readFileSync(path.join(__dirname, '../..', 'notifications.js'), 'utf8');
  test('Mobile Barber notifications include confirmation, status-change, SMS flag, and diagnostic logs', function() {
    assertContains(src, 'function queueMobileBarberConfirmation');
    assertContains(src, 'function queueMobileBarberStatusChange');
    assertContains(src, 'mobile_barber_sms_confirmation');
    assertContains(src, '[mobile-barber-notification]');
    assertContains(src, 'confirmed');
    assertContains(src, 'declined');
    assertContains(src, 'cancelled');
    assert(src.indexOf('queueMobileBarberStatusChange') > src.indexOf('queueMobileBarberConfirmation'), 'status-change hook should live after confirmation hook');
  });
}

if (require.main === module) {
  var passed = 0;
  var failed = 0;
  runNotificationTests(function(name, fn) {
    try {
      fn();
      passed++;
      console.log('PASS', name);
    } catch (e) {
      failed++;
      console.log('FAIL', name);
      console.log(' ', e.message);
    }
  });
  console.log('Notification tests:', passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

module.exports = {
  runNotificationTests: runNotificationTests
};
