'use strict';
/*
 * Mobile Barber Phase 6 AI chat booking agent.
 * Booking enforcement stays delegated to MobileBarberBooking so chat and manual flows
 * share service-area, duration, buffer, schedule, and overlap validation.
 */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./mobile-barber-data'), require('./mobile-barber-booking'));
  } else {
    root.MobileBarberAgent = factory(root.MobileBarberData, root.MobileBarberBooking, root.AIEngine);
  }
})(typeof window !== 'undefined' ? window : globalThis, function(DATA, BOOKING, AIEngine) {
  var VALID_LANGS = { en: 1, vi: 1, es: 1 };
  var VALID_PENDING = { booking_summary: 1, final_confirmation: 1 };
  var ACTIVE_STATUSES = ['pending_confirmation', 'confirmed', 'vendor_review'];

  var STRINGS = {
    en: {
      welcome: 'Tell me what service, date, time, and address you want. You can also upload a style photo before we send the request.',
      askMissing: 'I still need: {fields}.',
      askAddress: 'What service address, city, and ZIP should the barber visit?',
      priceOnly: '{service} is {price}. Travel fee starts at {travelFee}.',
      language: 'Yes. This assistant can help in English, Vietnamese, or Spanish.',
      photo: 'Yes. Upload a reference photo in the photo field and I will attach it to the booking request.',
      unavailable: 'That time is not available. Please send another date or time.',
      outOfArea: 'That address is outside the normal service area, so the request can be sent for barber review before confirmation.',
      summary: 'Review this request: {service} on {date} at {time}, {address}, {city} {zip}. Estimated total {price}. Reply yes to send it.',
      saved: 'Request sent. Booking ID: {id}. The barber still needs to confirm the appointment.',
      cancelled: 'I can help with cancellation or rescheduling, but this phase does not change existing bookings yet. Please call the barber for existing booking changes.',
      fallback: 'I can help collect a mobile barber booking request. Please send service, date, time, address, city, ZIP, name, and phone.'
    },
    vi: {
      welcome: 'Cho em biết dịch vụ, ngày, giờ, và địa chỉ muốn đặt. Anh/chị cũng có thể tải ảnh kiểu tóc trước khi gửi yêu cầu.',
      askMissing: 'Em còn cần: {fields}.',
      askAddress: 'Thợ sẽ đến địa chỉ nào, thành phố nào, và mã ZIP nào?',
      priceOnly: '{service} là {price}. Phí di chuyển bắt đầu từ {travelFee}.',
      language: 'Dạ có. Trợ lý này hỗ trợ tiếng Việt, tiếng Anh, hoặc tiếng Tây Ban Nha.',
      photo: 'Dạ được. Tải ảnh tham khảo ở ô ảnh và em sẽ đính kèm vào yêu cầu đặt lịch.',
      unavailable: 'Giờ đó không còn trống. Vui lòng gửi ngày hoặc giờ khác.',
      outOfArea: 'Địa chỉ đó ngoài khu vực phục vụ thường lệ, nên yêu cầu có thể gửi để thợ xem xét trước khi xác nhận.',
      summary: 'Vui lòng xem lại: {service} ngày {date} lúc {time}, {address}, {city} {zip}. Tổng ước tính {price}. Trả lời đồng ý để gửi.',
      saved: 'Đã gửi yêu cầu. Mã đặt lịch: {id}. Thợ vẫn cần xác nhận lịch hẹn.',
      cancelled: 'Em có thể hỗ trợ hướng dẫn hủy hoặc đổi lịch, nhưng phase này chưa thay đổi lịch đã có. Vui lòng gọi trực tiếp cho thợ.',
      fallback: 'Em có thể nhận yêu cầu đặt thợ cắt tóc tại nhà. Vui lòng gửi dịch vụ, ngày, giờ, địa chỉ, thành phố, ZIP, tên, và số điện thoại.'
    },
    es: {
      welcome: 'Dígame el servicio, fecha, hora, y dirección que prefiere. También puede subir una foto de referencia antes de enviar la solicitud.',
      askMissing: 'Todavía necesito: {fields}.',
      askAddress: '¿A qué dirección, ciudad, y código ZIP debe ir el barbero?',
      priceOnly: '{service} cuesta {price}. La tarifa de viaje empieza en {travelFee}.',
      language: 'Sí. Este asistente puede ayudar en inglés, vietnamita, o español.',
      photo: 'Sí. Suba una foto de referencia en el campo de foto y la adjuntaré a la solicitud.',
      unavailable: 'Ese horario no está disponible. Envíe otra fecha u hora.',
      outOfArea: 'Esa dirección está fuera del área normal de servicio, así que se puede enviar para revisión del barbero antes de confirmar.',
      summary: 'Revise esta solicitud: {service} el {date} a las {time}, {address}, {city} {zip}. Total estimado {price}. Responda sí para enviarla.',
      saved: 'Solicitud enviada. ID de reserva: {id}. El barbero todavía debe confirmar la cita.',
      cancelled: 'Puedo ayudar con cancelación o cambio, pero esta fase todavía no modifica reservas existentes. Llame directamente al barbero.',
      fallback: 'Puedo recopilar una solicitud de barbero móvil. Envíe servicio, fecha, hora, dirección, ciudad, ZIP, nombre, y teléfono.'
    }
  };

  var FIELD_LABELS = {
    en: { customerName: 'name', phone: 'phone', serviceId: 'service', date: 'date', time: 'time', address: 'address', city: 'city', zip: 'ZIP' },
    vi: { customerName: 'tên', phone: 'số điện thoại', serviceId: 'dịch vụ', date: 'ngày', time: 'giờ', address: 'địa chỉ', city: 'thành phố', zip: 'ZIP' },
    es: { customerName: 'nombre', phone: 'teléfono', serviceId: 'servicio', date: 'fecha', time: 'hora', address: 'dirección', city: 'ciudad', zip: 'ZIP' }
  };

  function trim(value) {
    return String(value == null ? '' : value).trim();
  }

  function digits(value) {
    return trim(value).replace(/\D/g, '');
  }

  function money(value) {
    return '$' + Number(value || 0).toFixed(0);
  }

  function interpolate(template, values) {
    return String(template || '').replace(/\{(\w+)\}/g, function(_, key) {
      return values[key] == null ? '' : values[key];
    });
  }

  function detectLang(text) {
    var engine = AIEngine || (typeof globalThis !== 'undefined' && globalThis.AIEngine);
    if (engine && engine.detectLang) return engine.detectLang(text);
    if (/[\u1EA0-\u1EF9]|[ơưđĐ]/i.test(text)) return 'vi';
    if (/[¿¡ñÑ]|\b(hola|cuanto|cuánto|quiero|cita|mañana|gracias)\b/i.test(text)) return 'es';
    return 'en';
  }

  function localISODate(date) {
    if (AIEngine && AIEngine.localISODate) return AIEngine.localISODate(date);
    var y = date.getFullYear();
    var m = ('0' + (date.getMonth() + 1)).slice(-2);
    var d = ('0' + date.getDate()).slice(-2);
    return y + '-' + m + '-' + d;
  }

  function addDays(date, days) {
    var copy = new Date(date.getTime());
    copy.setDate(copy.getDate() + days);
    return localISODate(copy);
  }

  function emptyState(lang) {
    return {
      lang: VALID_LANGS[lang] ? lang : 'en',
      intent: null,
      customerName: null,
      phone: null,
      serviceId: null,
      date: null,
      time: null,
      address: null,
      city: null,
      zip: null,
      barberPreference: null,
      notes: null,
      photoUrls: [],
      pendingAction: null,
      lastAvailabilityKey: null
    };
  }

  function mergeState(current, update, today) {
    var state = current || emptyState('en');
    update = update || {};
    today = today || new Date();
    Object.keys(update).forEach(function(key) {
      var value = update[key];
      if (value === null) {
        state[key] = null;
        return;
      }
      if (key === 'lang') {
        if (VALID_LANGS[value]) state.lang = value;
        return;
      }
      if (key === 'pendingAction') {
        if (VALID_PENDING[value]) state.pendingAction = value;
        return;
      }
      if (key === 'phone') {
        var phone = digits(value);
        if (phone.length === 11 && phone.charAt(0) === '1') phone = phone.slice(1);
        if (phone.length >= 7) state.phone = phone;
        return;
      }
      if (key === 'date') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(value) && value >= localISODate(today)) state.date = value;
        return;
      }
      if (key === 'time') {
        if (/^\d{1,2}:\d{2}$/.test(value)) state.time = value.length === 4 ? '0' + value : value;
        return;
      }
      if (key === 'photoUrls') {
        if (Array.isArray(value)) state.photoUrls = value.filter(function(item) { return trim(item); });
        return;
      }
      if (key === 'customerName' || key === 'serviceId' || key === 'address' || key === 'city' || key === 'zip' || key === 'barberPreference' || key === 'notes' || key === 'intent' || key === 'lastAvailabilityKey') {
        if (typeof value === 'string' && trim(value)) state[key] = trim(value);
      }
    });
    return state;
  }

  function normalizeTime(raw) {
    var text = trim(raw).toLowerCase();
    var after = /\b(after|sau|despu[eé]s de)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i.exec(text);
    var clock = /\b(\d{1,2}):(\d{2})\b/i.exec(text);
    var match = after || /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(text);
    if (clock && !after) {
      var clockHour = Number(clock[1]);
      var clockMinute = Number(clock[2]);
      if (clockHour < 0 || clockHour > 23 || clockMinute < 0 || clockMinute > 59) return null;
      return String(clockHour).padStart(2, '0') + ':' + String(clockMinute).padStart(2, '0');
    }
    if (!match) return null;
    var hour = Number(after ? match[2] : match[1]);
    var minute = Number(after ? (match[3] || 0) : (match[2] || 0));
    var suffix = String(after ? (match[4] || '') : (match[3] || '')).toLowerCase();
    if (suffix === 'pm' && hour < 12) hour += 12;
    if (suffix === 'am' && hour === 12) hour = 0;
    if (!suffix && hour < 8) hour += 12;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
  }

  function matchService(text, services) {
    var lower = trim(text).toLowerCase();
    services = services || [];
    var wantsBeard = /\b(beard|râu|barba)\b/i.test(lower);
    var wantsFade = /\b(fade|taper|skin)\b/i.test(lower);
    for (var i = 0; i < services.length; i++) {
      var service = services[i];
      var hay = (service.name + ' ' + service.description + ' ' + service.category).toLowerCase();
      if (wantsBeard && /\bbeard|râu|barba|combo/.test(hay)) return service;
      if ((wantsFade || /\b(haircut|cut|cắt tóc|corte)\b/i.test(lower)) && /\bhaircut|cut|cắt tóc|corte/.test(hay)) return service;
    }
    return null;
  }

  function extractUpdate(message, ctx) {
    var now = ctx.now || new Date();
    var lang = detectLang(message);
    var lower = trim(message).toLowerCase();
    var service = matchService(message, ctx.services);
    var update = { lang: lang };

    if (/\b(price|how much|bao nhiêu|giá|cu[aá]nto|precio)\b/i.test(lower)) update.intent = 'price';
    else if (/\b(cancel|reschedule|hủy|đổi lịch|cancelar|cambiar)\b/i.test(lower)) update.intent = 'modify_existing';
    else if (/\b(vietnamese|tiếng việt|speak vietnamese|habla vietnamita)\b/i.test(lower)) update.intent = 'language';
    else if (/\b(photo|upload|ảnh|hình|foto|subir)\b/i.test(lower)) update.intent = 'photo';
    else update.intent = 'booking_request';

    if (/\b(today|hôm nay|hoy)\b/i.test(lower)) update.date = localISODate(now);
    if (/\b(tomorrow|ngày mai|mañana)\b/i.test(lower)) update.date = addDays(now, 1);
    var isoDate = /\b(20\d{2}-\d{2}-\d{2})\b/.exec(lower);
    if (isoDate) update.date = isoDate[1];

    var time = normalizeTime(message);
    if (time) update.time = time;
    if (service) update.serviceId = service.id;

    var phone = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/.exec(message);
    if (phone) update.phone = phone[0];
    var zip = /\b9\d{4}\b/.exec(message);
    if (zip) update.zip = zip[0];

    (ctx.vendor.serviceAreas || []).forEach(function(area) {
      if (lower.indexOf(String(area).toLowerCase()) >= 0) update.city = area;
    });
    if (/\bsan jose\b/i.test(lower)) update.city = 'San Jose';
    if (/\birvine\b/i.test(lower)) update.city = 'Irvine';

    var name = /\b(?:my name is|i am|tên tôi là|mình tên|me llamo|soy)\s+([a-zA-ZÀ-ỹ\s'-]{2,40})/i.exec(message);
    if (name) update.customerName = name[1].replace(/\b(?:and|và|y)\b.*$/i, '').trim();

    var address = /\b(\d{2,6}\s+[a-zA-Z0-9À-ỹ\s.'-]{3,60}(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|way|ct|court)\b\.?)/i.exec(message);
    if (address) update.address = address[1];

    if (/\bjohn\b/i.test(message)) update.barberPreference = 'John';
    if (/\bdaniel\b/i.test(message)) update.barberPreference = 'Daniel Nguyen';
    if (/\b(style|kiểu|estilo|fade|beard|râu|barba)\b/i.test(lower)) update.notes = trim(message);
    return update;
  }

  function draftFromState(state) {
    return {
      customerName: state.customerName,
      customerPhone: state.phone,
      serviceId: state.serviceId,
      requestedDate: state.date,
      startTime: state.time,
      address: state.address,
      city: state.city,
      zip: state.zip,
      notes: state.notes || state.barberPreference || '',
      photoUrls: state.photoUrls || []
    };
  }

  function missingFields(state) {
    return ['customerName', 'phone', 'serviceId', 'date', 'time', 'address', 'city', 'zip'].filter(function(key) {
      return !trim(state[key]);
    });
  }

  function buildPrompt(ctx, lang) {
    var vendor = ctx.vendor;
    var services = (ctx.services || []).map(function(service) {
      return service.name + ' — $' + service.price + ' (' + service.durationMinutes + ' min, travel buffer ' + service.travelBufferMinutes + ' min)';
    }).join('\n');
    return [
      'You are the Du Lich Cali Mobile Barber booking assistant.',
      'Respond in this language code unless the customer changes language: ' + (VALID_LANGS[lang] ? lang : 'en') + '.',
      'Vendor scope: ' + vendor.businessName + ' / ' + vendor.barberName + '.',
      'Service areas: ' + (vendor.serviceAreas || []).join(', ') + '. Travel radius miles: ' + vendor.travelRadiusMiles + '.',
      'Services and prices:\n' + services,
      'Never invent availability, prices, travel radius, barber names, or internal data.',
      'Never confirm a booking until backend availability and service-area checks have passed.',
      'When you see a user message starting with [SYSTEM: ...], rewrite that backend result naturally in the customer language and do not expose the marker.',
      'Collect name, phone, service, preferred date/time, address/city/ZIP, barber preference, notes/style, and photo if available.'
    ].join('\n');
  }

  function systemReason(type, details) {
    details = details || {};
    return type + ' ' + Object.keys(details).map(function(key) {
      return key + '=' + details[key];
    }).join(' ');
  }

  function serviceById(serviceId, services) {
    for (var i = 0; i < (services || []).length; i++) {
      if (services[i].id === serviceId) return services[i];
    }
    return null;
  }

  function reply(lang, key, values) {
    return interpolate((STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key], values || {});
  }

  function handleMessage(session, message, ctx) {
    ctx = ctx || {};
    session = session || {};
    var state = mergeState(session.state || emptyState(ctx.lang || 'en'), extractUpdate(message, ctx), ctx.now);
    var lang = state.lang;
    var vendor = ctx.vendor;
    var services = ctx.services || [];
    var service = serviceById(state.serviceId, services) || services[0];
    var text = trim(message).toLowerCase();
    var affirmative = /\b(yes|confirm|send|book it|đồng ý|xác nhận|sí|si|confirmar)\b/i.test(text);

    session.state = state;
    session.systemPrompt = buildPrompt(ctx, lang);
    session.lastSystemContext = null;

    if (state.intent === 'language') return { session: session, response: reply(lang, 'language') };
    if (state.intent === 'photo') return { session: session, response: reply(lang, 'photo') };
    if (state.intent === 'modify_existing') return { session: session, response: reply(lang, 'cancelled') };

    if (state.intent === 'price' && service) {
      return {
        session: session,
        response: reply(lang, 'priceOnly', { service: service.name, price: money(service.price), travelFee: money(vendor.baseTravelFee) })
      };
    }

    var missing = missingFields(state);
    if (missing.length) {
      session.lastSystemContext = systemReason('missing_fields', { fields: missing.join(',') });
      var labels = FIELD_LABELS[lang] || FIELD_LABELS.en;
      if (missing.indexOf('address') >= 0 || missing.indexOf('city') >= 0 || missing.indexOf('zip') >= 0) {
        return { session: session, response: reply(lang, 'askAddress') };
      }
      return { session: session, response: reply(lang, 'askMissing', {
        fields: missing.map(function(key) { return labels[key] || key; }).join(', ')
      }) };
    }

    var draft = draftFromState(state);
    var availability = BOOKING.checkAvailability({
      vendor: vendor,
      services: services,
      availability: ctx.availability || DATA.sampleAvailability,
      draft: draft,
      existingBookings: ctx.existingBookings || []
    });
    state.lastAvailabilityKey = availability.key;

    if (!availability.canCreate) {
      session.lastSystemContext = systemReason('availability_failed', { key: availability.key });
      return { session: session, response: reply(lang, 'unavailable') };
    }

    if (!affirmative || state.pendingAction !== 'final_confirmation') {
      state.pendingAction = 'final_confirmation';
      session.lastAvailabilityResult = availability;
      session.lastSystemContext = systemReason('booking_summary_ready', { status: availability.status, total: availability.price.totalPrice });
      var summaryText = reply(lang, 'summary', {
        service: availability.service.name,
        date: draft.requestedDate,
        time: draft.startTime,
        address: draft.address,
        city: draft.city,
        zip: draft.zip,
        price: money(availability.price.totalPrice)
      });
      return {
        session: session,
        response: availability.reviewRequired ? (reply(lang, 'outOfArea') + ' ' + summaryText) : summaryText
      };
    }

    var built = BOOKING.buildBooking({
      vendor: vendor,
      draft: draft,
      availabilityResult: availability,
      id: ctx.id,
      now: ctx.nowIso
    });
    if (!built.valid) {
      session.lastSystemContext = systemReason('booking_build_failed', { errors: built.errors.join(',') });
      return { session: session, response: reply(lang, 'fallback') };
    }
    built.booking.source = 'ai_chat';
    built.booking.aiConversationSummary = systemReason('ai_chat_summary', {
      lang: lang,
      barberPreference: state.barberPreference || '',
      notes: state.notes || ''
    });
    state.pendingAction = null;
    session.lastBooking = built.booking;
    session.lastSystemContext = systemReason('booking_created', { id: built.booking.id, status: built.booking.status });
    return { session: session, response: reply(lang, 'saved', { id: built.booking.id }), booking: built.booking };
  }

  return {
    emptyState: emptyState,
    mergeState: mergeState,
    extractUpdate: extractUpdate,
    buildPrompt: buildPrompt,
    handleMessage: handleMessage,
    missingFields: missingFields,
    draftFromState: draftFromState,
    _systemReason: systemReason
  };
});
