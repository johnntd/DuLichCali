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
    assertEq(second.booking.status, 'pending_barber_confirmation');
    assertEq(second.booking.endTime, '11:15');
  });

  test('Mobile Barber AI parses spoken English and Vietnamese phone digits', function() {
    var en = MobileBarberAgent.handleMessage(null, 'four oh eight five zero four three six eight four', context());
    assertEq(en.session.state.phone, '4085043684');
    var vi = MobileBarberAgent.handleMessage(null, 'bốn không tám năm không bốn ba sáu tám bốn', Object.assign(context(), { lang: 'vi' }));
    assertEq(vi.session.state.phone, '4085043684');
  });

  test('Mobile Barber AI uses repair prompts for unclear phone and partial address', function() {
    var r1 = MobileBarberAgent.handleMessage(null, 'call me maybe', context());
    assertEq(r1.session.state.step, 'ASK_PHONE');
    var r2 = MobileBarberAgent.handleMessage(r1.session, 'five four maybe', context());
    assert(r2.response.indexOf('digits one by one') >= 0, 'phone repair prompt must ask for digit-by-digit retry');

    var session = { state: MobileBarberAgent.mergeState(MobileBarberAgent.emptyState('en'), {
      phone: '4085043684',
      customerLookupStatus: 'not_found',
      customerName: 'Kim',
      step: 'ASK_ADDRESS'
    }, new Date('2026-05-25T12:00:00-07:00')) };
    var r3 = MobileBarberAgent.handleMessage(session, 'Main Street San Jose', context());
    assert(r3.response.indexOf('San Jose') >= 0, 'partial address confirmation should preserve heard city');
    assert(r3.response.indexOf('Is that correct') >= 0, 'partial address should confirm instead of restarting');
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

  test('Mobile Barber AI blocks out-of-service-area request (strict)', function() {
    var result = MobileBarberAgent.handleMessage(null, 'My name is Kim. Phone 714-555-0100. I need haircut on 2026-06-01 at 10:00 at 123 Main St San Jose 95112.', Object.assign(context(), { customerLookupResult: null }));
    assertEq(result.session.state.lastAvailabilityKey, 'service_area_out_of_range');
    assert(!result.booking, 'out-of-area must not create booking');
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

  test('Mobile Barber AI new customer multi-turn flow advances past phone lookup', function() {
    var ctx = context();
    var r1 = MobileBarberAgent.handleMessage(null, '714-555-0199', ctx);
    assertEq(r1.session.state.step, 'LOOKUP_CUSTOMER');
    var r2 = MobileBarberAgent.handleMessage(r1.session, '', Object.assign({}, ctx, { customerLookupResult: null }));
    assertEq(r2.session.state.step, 'IF_NEW_CUSTOMER_ASK_NAME');
    var r3 = MobileBarberAgent.handleMessage(r2.session, 'John Smith', ctx);
    assertEq(r3.session.state.customerName, 'John Smith', 'bare name reply must bind to customerName');
    assertEq(r3.session.state.step, 'ASK_ADDRESS', 'after name captured, must advance to address');
    var r4 = MobileBarberAgent.handleMessage(r3.session, '123 Main St, San Jose, 95123', ctx);
    assertEq(r4.session.state.address, '123 Main St');
    assertEq(r4.session.state.city, 'San Jose');
    assertEq(r4.session.state.zip, '95123');
    assertEq(r4.session.state.step, 'ASK_SERVICE');
    var r5 = MobileBarberAgent.handleMessage(r4.session, 'fade', ctx);
    assert(r5.session.state.serviceId, 'bare service word must bind to serviceId');
    assertEq(r5.session.state.step, 'ASK_DATE_TIME');
  });

  test('Mobile Barber AI never restarts after detecting new customer', function() {
    var ctx = context();
    var r1 = MobileBarberAgent.handleMessage(null, '714-555-0188', ctx);
    var r2 = MobileBarberAgent.handleMessage(r1.session, '', Object.assign({}, ctx, { customerLookupResult: null }));
    assertEq(r2.session.state.customerLookupStatus, 'not_found');
    // Next turn: user provides ANY plausible name. Step must move forward.
    var r3 = MobileBarberAgent.handleMessage(r2.session, 'Alex', ctx);
    assertEq(r3.session.state.step, 'ASK_ADDRESS', 'agent must not loop on name question');
    // And another turn: customer answers ONLY for the next slot.
    var r4 = MobileBarberAgent.handleMessage(r3.session, '999 Park Ave, Garden Grove, 92840', ctx);
    assert(r4.session.state.step === 'ASK_SERVICE' || r4.session.state.step === 'ASK_DATE_TIME',
      'agent must keep advancing through slots, got ' + r4.session.state.step);
  });

  test('Mobile Barber AI Vietnamese natural replies advance state machine', function() {
    var ctx = context({ now: new Date('2026-05-25T12:00:00-07:00') });
    var r1 = MobileBarberAgent.handleMessage(null, '408 555 1234', Object.assign({}, ctx, { lang: 'vi' }));
    var r2 = MobileBarberAgent.handleMessage(r1.session, '', Object.assign({}, ctx, { customerLookupResult: null }));
    assertEq(r2.session.state.step, 'IF_NEW_CUSTOMER_ASK_NAME');
    var r3 = MobileBarberAgent.handleMessage(r2.session, 'Nguyễn Văn A', ctx);
    assertEq(r3.session.state.customerName, 'Nguyễn Văn A');
    assertEq(r3.session.state.step, 'ASK_ADDRESS');
    var r4 = MobileBarberAgent.handleMessage(r3.session, '456 Lê Lợi, San Jose, 95128', ctx);
    assertEq(r4.session.state.address, '456 Lê Lợi');
    assertEq(r4.session.state.city, 'San Jose');
    assertEq(r4.session.state.zip, '95128');
    var r5 = MobileBarberAgent.handleMessage(r4.session, 'cắt tóc fade', ctx);
    assert(r5.session.state.serviceId, 'Vietnamese service phrase must bind to serviceId');
    var r6 = MobileBarberAgent.handleMessage(r5.session, 'ngày mai 3pm', ctx);
    assertEq(r6.session.state.date, '2026-05-26');
    assertEq(r6.session.state.time, '15:00');
  });

  test('Mobile Barber AI existing customer reuses saved profile and confirms address', function() {
    var ctx = context();
    var r1 = MobileBarberAgent.handleMessage(null, '714-555-0100', ctx);
    var r2 = MobileBarberAgent.handleMessage(r1.session, '', Object.assign({}, ctx, {
      customerLookupResult: {
        customerName: 'John',
        customerPhone: '7145550100',
        address: '123 Brookhurst St',
        city: 'Westminster',
        zip: '92683'
      }
    }));
    assertEq(r2.session.state.customerLookupStatus, 'found');
    assertEq(r2.session.state.step, 'IF_EXISTING_CUSTOMER_CONFIRM_PROFILE');
    assert(r2.response.indexOf('John') >= 0, 'must greet by saved name');
    assert(r2.response.indexOf('Westminster') >= 0, 'must offer saved city');
    var r3 = MobileBarberAgent.handleMessage(r2.session, 'same address', ctx);
    assertEq(r3.session.state.addressConfirmed, true);
    assertEq(r3.session.state.address, '123 Brookhurst St');
    assertEq(r3.session.state.city, 'Westminster');
    assertEq(r3.session.state.zip, '92683');
    assert(r3.session.state.step === 'ASK_SERVICE' || r3.session.state.step === 'ASK_DATE_TIME',
      'after address confirmed, must advance to service or date/time, got ' + r3.session.state.step);
  });

  test('Mobile Barber AI session carries id, vendorId, and lastReply across turns', function() {
    var ctx = context({ id: 'sess-test' });
    ctx.vendorId = 'oc-mobile-barber-demo';
    var r1 = MobileBarberAgent.handleMessage(null, '714-555-0150', ctx);
    assert(r1.session.id, 'session must receive an id');
    assertEq(r1.session.vendorId, 'oc-mobile-barber-demo');
    var firstId = r1.session.id;
    var r2 = MobileBarberAgent.handleMessage(r1.session, '', Object.assign({}, ctx, { customerLookupResult: null }));
    assertEq(r2.session.id, firstId, 'session id must persist across turns');
    assert(r2.session.lastReply && r2.session.lastReply.length > 0, 'lastReply must be tracked for diagnostics');
  });

  // ── AI Brain (Phase 2) ──────────────────────────────────────────────────────

  test('parseStateMarker extracts JSON STATE marker', function() {
    var update = MobileBarberAgent.parseStateMarker('Hello John. [STATE:{"customerName":"John"}]');
    assertEq(update && update.customerName, 'John');
    assertEq(MobileBarberAgent.parseStateMarker('no marker here'), null);
    assertEq(MobileBarberAgent.parseStateMarker('[STATE:{not json}]'), null);
  });

  test('stripMarkers removes STATE and ACTION markers from visible reply', function() {
    var visible = MobileBarberAgent.stripMarkers('Nice to meet you. [STATE:{"customerName":"Ann"}] [ACTION:check_availability]');
    assertEq(visible, 'Nice to meet you.');
  });

  test('buildAIBrainPrompt includes vendor, services, current state, and STATE protocol', function() {
    var ctx = context();
    var state = MobileBarberAgent.mergeState(MobileBarberAgent.emptyState('vi'), {
      phone: '7145550100', customerName: 'Linh'
    }, new Date('2026-05-25T12:00:00'));
    state.step = 'ASK_ADDRESS';
    var prompt = MobileBarberAgent.buildAIBrainPrompt(state, ctx, 'vi');
    assert(prompt.indexOf('Mobile Barber') >= 0, 'prompt must name the assistant');
    assert(prompt.indexOf('tiếng Việt') >= 0, 'Vietnamese instruction must be present for vi lang');
    assert(prompt.indexOf('customerName: Linh') >= 0, 'collected slots must be in prompt');
    assert(prompt.indexOf('Next step the deterministic agent will run: ASK_ADDRESS') >= 0, 'next step guidance present');
    assert(prompt.indexOf('STATE MARKER PROTOCOL') >= 0, 'marker contract present');
    assert(prompt.indexOf('classic-mobile-cut') >= 0, 'allowed serviceId values listed');
  });

  test('handleMessageAsync calls aiBrainProvider and uses paraphrased reply', function() {
    var ctx = context();
    var aiCalls = [];
    ctx.aiBrainProvider = function(req) {
      aiCalls.push({ step: req.state.step, history: req.history.slice() });
      return Promise.resolve({ text: 'Sure, what is your phone number? [STATE:{"intent":"booking_request"}]' });
    };
    return MobileBarberAgent.handleMessageAsync(null, 'I want a haircut', ctx).then(function(result) {
      assertEq(aiCalls.length, 1, 'AI brain must be invoked');
      assertEq(result.aiBrainUsed, true);
      assert(result.response.indexOf('phone') >= 0, 'AI reply text must surface');
      assert(result.response.indexOf('[STATE') < 0, 'STATE marker must be stripped from user-visible reply');
      assert(result.session.history.length >= 2, 'history must contain user + assistant turns');
    });
  });

  test('handleMessageAsync AI brain STATE marker overrides deterministic state', function() {
    var ctx = context();
    ctx.aiBrainProvider = function() {
      return Promise.resolve({ text: 'Hello Daniel Tran. What address?\n[STATE:{"customerName":"Daniel Tran"}]' });
    };
    var session = { state: MobileBarberAgent.mergeState(MobileBarberAgent.emptyState('en'), {
      phone: '7145550100',
      customerLookupStatus: 'not_found',
      step: 'IF_NEW_CUSTOMER_ASK_NAME'
    }, new Date('2026-05-25T10:00:00')) };
    return MobileBarberAgent.handleMessageAsync(session, 'Daniel Tran', ctx).then(function(result) {
      assertEq(result.session.state.customerName, 'Daniel Tran', 'AI marker must update customerName');
      assertEq(result.session.state.step, 'ASK_ADDRESS', 'state must advance after AI fills slot');
    });
  });

  test('handleMessageAsync falls back to deterministic reply when AI brain throws', function() {
    var ctx = context();
    ctx.aiBrainProvider = function() { return Promise.reject(new Error('aiProxy 500')); };
    return MobileBarberAgent.handleMessageAsync(null, '714-555-0100', ctx).then(function(result) {
      assert(!result.aiBrainUsed, 'aiBrainUsed must be false when AI throws');
      assertEq(result.aiBrainError, 'aiProxy 500');
      assert(result.response && result.response.length > 0, 'deterministic reply must surface as fallback');
    });
  });

  test('handleMessageAsync accumulates history across multiple turns', function() {
    var ctx = context();
    var turnIdx = 0;
    ctx.aiBrainProvider = function() {
      turnIdx++;
      return Promise.resolve({ text: 'Reply ' + turnIdx + '. [STATE:{}]' });
    };
    ctx.customerLookupProvider = function() { return Promise.resolve(null); };
    var session = null;
    return MobileBarberAgent.handleMessageAsync(session, '714-555-0123', ctx)
      .then(function(r1) {
        session = r1.session;
        assert(session.history.length >= 2, 'history must accumulate after first turn');
        return MobileBarberAgent.handleMessageAsync(session, 'My name is Tom', ctx);
      })
      .then(function(r2) {
        session = r2.session;
        var roles = session.history.map(function(m) { return m.role; });
        assert(roles.indexOf('user') >= 0 && roles.indexOf('assistant') >= 0, 'history has both roles');
        assert(session.history.length >= 4, 'history must keep prior turns');
      });
  });

  test('handleMessageAsync sends customer_lookup_miss system context to AI after no-record', function() {
    var ctx = context();
    var sentSystem = null;
    ctx.aiBrainProvider = function(req) {
      var last = req.history[req.history.length - 1];
      if (last && last.content && last.content.indexOf('[SYSTEM:') === 0) sentSystem = last.content;
      return Promise.resolve({ text: 'No record yet — what name should I use? [STATE:{}]' });
    };
    ctx.customerLookupProvider = function() { return Promise.resolve(null); };
    return MobileBarberAgent.handleMessageAsync(null, '714-555-0177', ctx).then(function() {
      assert(sentSystem && sentSystem.indexOf('customer_lookup_miss') >= 0,
        'AI must see [SYSTEM: customer_lookup_miss] after no-record lookup');
    });
  });
}

if (require.main === module) {
  var passed = 0;
  var failed = 0;
  var pending = [];
  runMobileBarberAgentTests(function(name, fn) {
    var result;
    try { result = fn(); }
    catch (e) { failed++; console.log('FAIL', name); console.log(' ', e.message); return; }
    if (result && typeof result.then === 'function') {
      pending.push(result.then(function() {
        passed++; console.log('PASS', name);
      }, function(err) {
        failed++; console.log('FAIL', name); console.log(' ', err && err.message);
      }));
      return;
    }
    passed++;
    console.log('PASS', name);
    return;
  });
  Promise.all(pending).then(function() {
    console.log('Mobile Barber agent tests:', passed + ' passed, ' + failed + ' failed');
    if (failed > 0) process.exit(1);
  });
}

module.exports = {
  runMobileBarberAgentTests: runMobileBarberAgentTests
};
