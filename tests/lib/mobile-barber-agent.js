'use strict';

var MobileBarberData = require('../../mobile-barber/mobile-barber-data');
var MobileBarberBooking = require('../../mobile-barber/mobile-barber-booking');
var MobileBarberAgent = require('../../mobile-barber/mobile-barber-agent');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertEq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg ? msg + ': ' : '') + 'expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(actual));
  }
}

function context(overrides) {
  overrides = overrides || {};
  return {
    vendor: MobileBarberData.findVendorById(MobileBarberData.SAMPLE_VENDOR_ID),
    services: MobileBarberData.listServicesForVendor(MobileBarberData.SAMPLE_VENDOR_ID),
    availability: MobileBarberData.sampleAvailability,
    existingBookings: overrides.existingBookings || [],
    now: overrides.now || new Date('2026-05-23T12:00:00-07:00'),
    nowIso: '2026-05-23T19:00:00.000Z',
    id: overrides.id || 'ai-test-1'
  };
}

function runMobileBarberAgentTests(test) {
  test('Mobile Barber AI agent builds vendor-scoped prompt with booking guardrails', function() {
    var prompt = MobileBarberAgent.buildPrompt(context(), 'en');
    assert(prompt.indexOf('Vendor scope: OC Mobile Barber Demo / Daniel Nguyen') >= 0, 'prompt must be vendor scoped');
    assert(prompt.indexOf('Never invent availability') >= 0, 'prompt must forbid invented availability');
    assert(prompt.indexOf('[SYSTEM: ...]') >= 0, 'prompt must route backend reasons through AI system context');
  });

  test('Mobile Barber AI mergeState validates phone, date, time, pending action, and photo', function() {
    var state = MobileBarberAgent.emptyState('en');
    MobileBarberAgent.mergeState(state, {
      phone: '(714) 555-0100',
      date: '2026-06-01',
      time: '9:30',
      pendingAction: 'final_confirmation',
      photoUrls: ['fade.jpg']
    }, new Date('2026-05-23T12:00:00-07:00'));
    assertEq(state.phone, '7145550100');
    assertEq(state.date, '2026-06-01');
    assertEq(state.time, '09:30');
    assertEq(state.pendingAction, 'final_confirmation');
    assertEq(state.photoUrls[0], 'fade.jpg');
  });

  test('Mobile Barber AI asks for missing address before availability check', function() {
    var result = MobileBarberAgent.handleMessage(null, 'I need a haircut at home tomorrow after 5 PM. My name is Kim and phone is 714-555-0100.', Object.assign(context(), { customerLookupResult: null }));
    assert(result.session.lastSystemContext.indexOf('missing_fields') === 0, 'missing fields should use system context');
    assert(result.session.state.serviceId, 'service should be extracted');
    assertEq(result.session.state.date, '2026-05-24');
    assertEq(result.session.state.time, '17:00');
  });

  test('Mobile Barber AI asks phone first before collecting booking details', function() {
    var result = MobileBarberAgent.handleMessage(null, 'I need a fade tomorrow afternoon', context());
    assertEq(result.session.state.step, 'ASK_PHONE');
    assert(result.response.indexOf('phone number') >= 0, 'first booking question must ask for phone');
    assert(!result.booking, 'phone-first turn must not create booking');
  });

  test('Mobile Barber AI new customer flow asks name after phone lookup misses', function() {
    var result = MobileBarberAgent.handleMessage(null, 'My number is 714-555-0100', Object.assign(context(), { customerLookupResult: null }));
    assertEq(result.session.state.customerLookupStatus, 'not_found');
    assertEq(result.session.state.step, 'IF_NEW_CUSTOMER_ASK_NAME');
    assert(result.response.indexOf('name') >= 0, 'new customer after phone lookup should ask name');
  });

  test('Mobile Barber AI existing customer flow confirms saved address', function() {
    var result = MobileBarberAgent.handleMessage(null, 'My number is 714-555-0100', Object.assign(context(), {
      customerLookupResult: {
        customerName: 'John',
        customerPhone: '7145550100',
        address: '123 Brookhurst St',
        city: 'Westminster',
        zip: '92683',
        lastServiceName: 'Fade Haircut',
        preferredBarber: 'Daniel Nguyen'
      }
    }));
    assertEq(result.session.state.customerLookupStatus, 'found');
    assertEq(result.session.state.step, 'IF_EXISTING_CUSTOMER_CONFIRM_PROFILE');
    assert(result.response.indexOf('John') >= 0, 'existing customer greeting should use name');
    assert(result.response.indexOf('Westminster') >= 0, 'existing customer prompt should confirm saved city');
  });

  test('Mobile Barber AI handles price-only request without creating booking', function() {
    var result = MobileBarberAgent.handleMessage(null, 'How much for fade and beard?', context());
    assert(!result.booking, 'price-only request must not create booking');
    assertEq(result.session.state.intent, 'price');
  });

  test('Mobile Barber AI successful booking requires summary then final confirmation', function() {
    var session = null;
    var ctx = context({ id: 'ai-success-1' });
    var first = MobileBarberAgent.handleMessage(session, 'My name is Kim. Phone 714-555-0100. I need haircut on 2026-06-01 at 10:00 at 123 Brookhurst St Westminster 92683.', Object.assign(ctx, { customerLookupResult: null }));
    session = first.session;
    assertEq(session.state.pendingAction, 'final_confirmation');
    assert(!first.booking, 'first complete turn presents summary only');

    var second = MobileBarberAgent.handleMessage(session, 'yes', ctx);
    assert(second.booking, 'affirmative after summary creates booking');
    assertEq(second.booking.source, 'ai_chat');
    assertEq(second.booking.status, 'pending_confirmation');
    assertEq(second.booking.endTime, '11:15');
  });

  test('Mobile Barber AI blocks unavailable overlapping time', function() {
    var ctx = context({
      existingBookings: [{
        id: 'overlap-1',
        vendorId: MobileBarberData.SAMPLE_VENDOR_ID,
        requestedDate: '2026-06-01',
        startTime: '10:30',
        endTime: '11:00',
        status: 'confirmed'
      }]
    });
    var result = MobileBarberAgent.handleMessage(null, 'My name is Kim. Phone 714-555-0100. I need haircut on 2026-06-01 at 10:00 at 123 Brookhurst St Westminster 92683.', Object.assign(ctx, { customerLookupResult: null }));
    assertEq(result.session.state.lastAvailabilityKey, 'booking_overlap');
    assert(!result.booking, 'overlap must not create booking');
  });

  test('Mobile Barber AI marks out-of-service-area request for vendor review only after validation', function() {
    var result = MobileBarberAgent.handleMessage(null, 'My name is Kim. Phone 714-555-0100. I need haircut on 2026-06-01 at 10:00 at 123 Main St San Jose 95112.', Object.assign(context(), { customerLookupResult: null }));
    assertEq(result.session.state.lastAvailabilityKey, 'service_area_review');
    assertEq(result.session.lastAvailabilityResult.status, 'vendor_review');
    assert(!result.booking, 'review request still requires final confirmation');
  });

  test('Mobile Barber AI supports Vietnamese and Spanish language detection', function() {
    var vi = MobileBarberAgent.handleMessage(null, 'Tôi cần cắt tóc tại nhà ngày mai sau 5 PM', context());
    var es = MobileBarberAgent.handleMessage(null, 'Hola, quiero una cita mañana a las 10 PM', context());
    assertEq(vi.session.state.lang, 'vi');
    assertEq(es.session.state.lang, 'es');
  });

  test('Mobile Barber AI uses AIEngine for unaccented Vietnamese detection', function() {
    var previous = global.AIEngine;
    global.AIEngine = {
      detectLang: function(text) {
        return text === 'toi muon cat toc ngay mai' ? 'vi' : 'en';
      }
    };
    try {
      var vi = MobileBarberAgent.handleMessage(null, 'toi muon cat toc ngay mai', context());
      assertEq(vi.session.state.lang, 'vi');
    } finally {
      if (previous) global.AIEngine = previous;
      else delete global.AIEngine;
    }
  });

  test('Mobile Barber AI handles cancel or reschedule intent without changing bookings', function() {
    var result = MobileBarberAgent.handleMessage(null, 'I want to reschedule my booking', context());
    assertEq(result.session.state.intent, 'modify_existing');
    assert(!result.booking, 'modify intent must not create booking in Phase 6');
  });
}

if (require.main === module) {
  var passed = 0;
  var failed = 0;
  runMobileBarberAgentTests(function(name, fn) {
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
  console.log('Mobile Barber agent tests:', passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

module.exports = {
  runMobileBarberAgentTests: runMobileBarberAgentTests
};
