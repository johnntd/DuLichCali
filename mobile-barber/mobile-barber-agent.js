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
      welcome: 'Hi, I can help book a mobile haircut. What phone number should I use to look up your appointment record?',
      welcomeVendor: 'Hi, this is {vendor}. What phone number should I use to look up your appointment record?',
      askPhone: 'What phone number should I use to look up your appointment record?',
      checkingPhone: 'Thanks. I am checking that phone number now.',
      foundCustomer: 'I found your record, {name}. Do you want to use the same address in {city}?',
      foundCustomerNoAddress: 'I found your record, {name}. What service address should the barber visit?',
      newCustomerName: "I don't see a record yet. What name should I put on the booking?",
      askName: 'What name should I put on the booking?',
      askMissing: 'I still need: {fields}.',
      askAddress: 'What service address, city, and ZIP should the barber visit?',
      askCityZip: 'What city and ZIP code is that address in?',
      askService: 'What barber service would you like?',
      askDateTime: 'What day and time would you like?',
      priceOnly: '{service} is {price}. Travel fee starts at {travelFee}.',
      language: 'Yes. This assistant can help in English, Vietnamese, or Spanish.',
      photo: 'Yes. Upload a reference photo in the photo field and I will attach it to the booking request.',
      unavailable: 'That time is not available. Please send another date or time.',
      outOfArea: 'That address is outside the normal service area, so the request can be sent for barber review before confirmation.',
      summary: 'Review this request: {service} on {date} at {time}, {address}, {city} {zip}. Estimated total {price}. Reply yes to send it.',
      saved: 'Request sent. Booking ID: {id}. The barber still needs to confirm the appointment.',
      cancelled: 'I can help with cancellation or rescheduling, but this phase does not change existing bookings yet. Please call the barber for existing booking changes.',
      fallback: 'I can help collect a mobile barber booking request. What phone number should I use first?'
    },
    vi: {
      welcome: 'Dạ em có thể giúp đặt thợ cắt tóc tại nhà. Mình cho em số điện thoại để em tìm hồ sơ trước nhé?',
      welcomeVendor: 'Dạ đây là {vendor}. Mình cho em số điện thoại để em tìm hồ sơ đặt lịch trước nhé?',
      askPhone: 'Mình cho em số điện thoại để em tìm hồ sơ đặt lịch trước nhé?',
      checkingPhone: 'Dạ em đang kiểm tra số điện thoại đó.',
      foundCustomer: 'Em thấy hồ sơ của anh/chị {name}. Mình muốn dùng lại địa chỉ ở {city} không ạ?',
      foundCustomerNoAddress: 'Em thấy hồ sơ của anh/chị {name}. Thợ sẽ đến địa chỉ nào ạ?',
      newCustomerName: 'Em chưa thấy hồ sơ với số này. Mình cho em tên để đặt lịch nhé?',
      askName: 'Mình cho em tên để đặt lịch nhé?',
      askMissing: 'Em còn cần: {fields}.',
      askAddress: 'Thợ sẽ đến địa chỉ nào, thành phố nào, và mã ZIP nào?',
      askCityZip: 'Địa chỉ đó ở thành phố nào và mã ZIP nào ạ?',
      askService: 'Mình muốn đặt dịch vụ barber nào ạ?',
      askDateTime: 'Mình muốn đặt ngày nào và giờ nào ạ?',
      priceOnly: '{service} là {price}. Phí di chuyển bắt đầu từ {travelFee}.',
      language: 'Dạ có. Trợ lý này hỗ trợ tiếng Việt, tiếng Anh, hoặc tiếng Tây Ban Nha.',
      photo: 'Dạ được. Tải ảnh tham khảo ở ô ảnh và em sẽ đính kèm vào yêu cầu đặt lịch.',
      unavailable: 'Giờ đó không còn trống. Vui lòng gửi ngày hoặc giờ khác.',
      outOfArea: 'Địa chỉ đó ngoài khu vực phục vụ thường lệ, nên yêu cầu có thể gửi để thợ xem xét trước khi xác nhận.',
      summary: 'Vui lòng xem lại: {service} ngày {date} lúc {time}, {address}, {city} {zip}. Tổng ước tính {price}. Trả lời đồng ý để gửi.',
      saved: 'Đã gửi yêu cầu. Mã đặt lịch: {id}. Thợ vẫn cần xác nhận lịch hẹn.',
      cancelled: 'Em có thể hỗ trợ hướng dẫn hủy hoặc đổi lịch, nhưng phase này chưa thay đổi lịch đã có. Vui lòng gọi trực tiếp cho thợ.',
      fallback: 'Em có thể nhận yêu cầu đặt thợ cắt tóc tại nhà. Mình cho em số điện thoại trước nhé?'
    },
    es: {
      welcome: 'Puedo ayudar a reservar un corte móvil. ¿Qué número de teléfono debo usar para buscar su historial?',
      welcomeVendor: 'Este es {vendor}. ¿Qué número de teléfono debo usar para buscar su historial?',
      askPhone: '¿Qué número de teléfono debo usar para buscar su historial?',
      checkingPhone: 'Gracias. Estoy revisando ese número ahora.',
      foundCustomer: 'Encontré su registro, {name}. ¿Quiere usar la misma dirección en {city}?',
      foundCustomerNoAddress: 'Encontré su registro, {name}. ¿A qué dirección debe ir el barbero?',
      newCustomerName: 'No veo un registro con ese número. ¿Qué nombre pongo en la reserva?',
      askName: '¿Qué nombre pongo en la reserva?',
      askMissing: 'Todavía necesito: {fields}.',
      askAddress: '¿A qué dirección, ciudad, y código ZIP debe ir el barbero?',
      askCityZip: '¿En qué ciudad y código ZIP está esa dirección?',
      askService: '¿Qué servicio de barbería quiere?',
      askDateTime: '¿Qué día y hora prefiere?',
      priceOnly: '{service} cuesta {price}. La tarifa de viaje empieza en {travelFee}.',
      language: 'Sí. Este asistente puede ayudar en inglés, vietnamita, o español.',
      photo: 'Sí. Suba una foto de referencia en el campo de foto y la adjuntaré a la solicitud.',
      unavailable: 'Ese horario no está disponible. Envíe otra fecha u hora.',
      outOfArea: 'Esa dirección está fuera del área normal de servicio, así que se puede enviar para revisión del barbero antes de confirmar.',
      summary: 'Revise esta solicitud: {service} el {date} a las {time}, {address}, {city} {zip}. Total estimado {price}. Responda sí para enviarla.',
      saved: 'Solicitud enviada. ID de reserva: {id}. El barbero todavía debe confirmar la cita.',
      cancelled: 'Puedo ayudar con cancelación o cambio, pero esta fase todavía no modifica reservas existentes. Llame directamente al barbero.',
      fallback: 'Puedo recopilar una solicitud de barbero móvil. ¿Qué teléfono debo usar primero?'
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
      customerLookupStatus: null,
      customerRecord: null,
      addressConfirmed: false,
      step: 'START',
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
      if (key === 'customerLookupStatus') {
        if (value === 'found' || value === 'not_found' || value === 'done') state.customerLookupStatus = value;
        return;
      }
      if (key === 'customerRecord') {
        if (value && typeof value === 'object') state.customerRecord = value;
        return;
      }
      if (key === 'addressConfirmed') {
        state.addressConfirmed = value === true;
        return;
      }
      if (key === 'step') {
        if (typeof value === 'string' && trim(value)) state.step = trim(value);
        return;
      }
      if (key === 'phone') {
        var phone = digits(value);
        if (phone.length === 11 && phone.charAt(0) === '1') phone = phone.slice(1);
        if (phone.length >= 7 && state.phone !== phone) {
          state.phone = phone;
          state.customerLookupStatus = null;
          state.customerRecord = null;
          state.addressConfirmed = false;
        }
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

  function extractUpdate(message, ctx, currentState) {
    var now = ctx.now || new Date();
    var lang = detectLang(message);
    var lower = trim(message).toLowerCase();
    var service = matchService(message, ctx.services);
    var prevStep = currentState && currentState.step;
    // Only emit a language update when detection found a STRONG non-default
    // signal (vi or es). detectLang() falls through to 'en' for any input
    // that lacks diacritics, including unaccented Vietnamese coming back from
    // mobile speech-to-text. Emitting `lang: 'en'` here would silently
    // downgrade a session that the user explicitly set to vi via UI / URL.
    // The UI language button remains the only path back to en.
    var update = {};
    if (lang !== 'en') update.lang = lang;

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
    else if (ctx.phoneIntake && typeof ctx.phoneIntake.normalizeSpokenPhoneNumber === 'function') {
      var spokenPhone = ctx.phoneIntake.normalizeSpokenPhoneNumber(message, lang, { phoneContext: true, expected: 'phone' });
      if (spokenPhone) update.phone = spokenPhone;
    }
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

    if (/\b(same address|same place|use same|yes|yeah|correct|đúng|dạ đúng|địa chỉ cũ|sí|si|misma dirección)\b/i.test(lower)) {
      update.addressConfirmed = true;
    }
    if (/\bjohn\b/i.test(message)) update.barberPreference = 'John';
    if (/\bdaniel\b/i.test(message)) update.barberPreference = 'Daniel Nguyen';
    if (/\btim\b/i.test(message)) update.barberPreference = 'Tim Nguyen';
    if (/\bmichael\b/i.test(message)) update.barberPreference = 'Michael Nguyen';
    if (/\b(style|kiểu|estilo|fade|beard|râu|barba)\b/i.test(lower)) update.notes = trim(message);

    // Step-aware fallback: when the agent has just asked for a specific slot
    // and the regex extractors above did not populate it, treat the user's
    // reply as the answer to that slot. Without this, replies like
    // "John Smith" / "123 Main St, San Jose, 95123" / "fade" never bind to
    // their target field and the agent loops on the same question.
    var trimmedMsg = trim(message);
    if (trimmedMsg) {
      var lowerMsg = trimmedMsg.toLowerCase();

      if (!update.customerName &&
          (prevStep === 'ASK_NAME' || prevStep === 'IF_NEW_CUSTOMER_ASK_NAME') &&
          trimmedMsg.length >= 2 && trimmedMsg.length <= 60 &&
          !/^\d+$/.test(trimmedMsg) && !/\d{3,}/.test(trimmedMsg) &&
          !/^(yes|no|ok|sure|đúng|sí|si)\b/i.test(lowerMsg)) {
        update.customerName = trimmedMsg
          .replace(/^(?:my name is|i am|i'm|tên tôi là|tên em là|tên là|mình tên|em tên|tôi là|me llamo|soy)\s+/i, '')
          .replace(/^(?:it'?s|this is)\s+/i, '')
          .trim();
      }

      if (prevStep === 'ASK_ADDRESS' && trimmedMsg.length <= 160) {
        var parts = trimmedMsg.split(',').map(function(p) { return p.trim(); }).filter(Boolean);
        if (!update.address) {
          var addrCandidate = parts[0] || trimmedMsg;
          if (addrCandidate && addrCandidate.length >= 3 && addrCandidate.length <= 120) {
            update.address = addrCandidate;
          }
        }
        if (!update.city && parts.length >= 2) {
          var cityCandidate = parts[1].replace(/\s*\d{5}.*$/, '').trim();
          if (cityCandidate && cityCandidate.length >= 2 && cityCandidate.length <= 40 && !/^\d+$/.test(cityCandidate)) {
            update.city = cityCandidate;
          }
        }
        if (!update.zip) {
          var zipCandidate = /\b(9\d{4})\b/.exec(trimmedMsg);
          if (zipCandidate) update.zip = zipCandidate[1];
        }
      }

      if (prevStep === 'ASK_SERVICE' && !update.serviceId) {
        (ctx.services || []).forEach(function(svc) {
          if (update.serviceId) return;
          var name = (svc.name || '').toLowerCase();
          var cat = (svc.category || '').toLowerCase();
          if (name && lowerMsg.indexOf(name) >= 0) update.serviceId = svc.id;
          else if (name && name.indexOf(lowerMsg) >= 0 && lowerMsg.length >= 3) update.serviceId = svc.id;
          else if (cat && lowerMsg.indexOf(cat) >= 0 && cat.length >= 3) update.serviceId = svc.id;
        });
      }
    }

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
      'Use the serviceBookingAgentBrain pattern: intent extraction, slot filling, one question at a time, customer lookup, service lookup, availability check, summary, then booking write.',
      'Phone lookup is always first for booking. Never ask for name, phone, address, service, date, and time in one message.'
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

  function publicAddressCity(record) {
    return trim(record && record.city) || trim(record && record.serviceCity) || trim(record && record.lastCity) || 'the saved city';
  }

  function applyCustomerRecord(state, record) {
    if (!record) {
      state.customerLookupStatus = 'not_found';
      state.customerRecord = null;
      return;
    }
    state.customerLookupStatus = 'found';
    state.customerRecord = record;
    if (record.customerName || record.name) state.customerName = record.customerName || record.name;
    if (record.lastServiceId && !state.serviceId) state.previousServiceId = record.lastServiceId;
    if (record.lastServiceName && !state.previousServiceName) state.previousServiceName = record.lastServiceName;
    if (record.preferredBarber && !state.barberPreference) state.barberPreference = record.preferredBarber;
    if (record.barberName && !state.barberPreference) state.barberPreference = record.barberName;
  }

  function applySavedAddress(state) {
    var record = state.customerRecord || {};
    state.address = state.address || record.address || record.serviceAddress || record.lastAddress || '';
    state.city = state.city || record.city || record.serviceCity || record.lastCity || '';
    state.zip = state.zip || record.zip || record.serviceZip || record.lastZip || '';
  }

  function nextMissingQuestion(state, lang) {
    if (!trim(state.customerName)) {
      state.step = state.customerLookupStatus === 'not_found' ? 'IF_NEW_CUSTOMER_ASK_NAME' : 'ASK_NAME';
      return reply(lang, state.customerLookupStatus === 'not_found' ? 'newCustomerName' : 'askName');
    }
    if (!trim(state.address)) {
      state.step = 'ASK_ADDRESS';
      return reply(lang, 'askAddress');
    }
    if (!trim(state.city) || !trim(state.zip)) {
      state.step = 'ASK_ADDRESS';
      return reply(lang, 'askCityZip');
    }
    if (!trim(state.serviceId)) {
      state.step = 'ASK_SERVICE';
      return reply(lang, 'askService');
    }
    if (!trim(state.date) || !trim(state.time)) {
      state.step = 'ASK_DATE_TIME';
      return reply(lang, 'askDateTime');
    }
    return null;
  }

  function initialPrompt(ctx, lang) {
    var vendor = ctx && ctx.vendor;
    var vendorName = vendor && (vendor.businessName || vendor.barberName);
    return vendorName ? reply(lang, 'welcomeVendor', { vendor: vendorName }) : reply(lang, 'welcome');
  }

  var _sessionCounter = 0;
  function _assignSessionId(session) {
    if (!session.id) {
      _sessionCounter += 1;
      session.id = 'mb-' + Date.now().toString(36) + '-' + _sessionCounter;
    }
    return session.id;
  }

  function logStateTransition(previousStep, lastQuestion, message, session, extracted, response) {
    if (typeof console === 'undefined' || !console.log) return;
    try {
      var state = (session && session.state) || {};
      console.log('[mobile-barber-agent-state]', JSON.stringify({
        sessionId: session && session.id || null,
        vendorId: session && session.vendorId || null,
        previousStep: previousStep || 'START',
        lastQuestion: trim(lastQuestion || '').substring(0, 120),
        userInput: trim(message).substring(0, 120),
        understoodIntent: state.intent || null,
        extractedSlots: extracted || {},
        nextStep: state.step || 'UNKNOWN',
        customerFound: state.customerLookupStatus === 'found',
        missingSlots: missingFields(state),
        reply: trim(response || '').substring(0, 120)
      }));
    } catch (e) { /* logging is best-effort */ }
  }

  function _handleMessageCore(session, message, ctx) {
    ctx = ctx || {};
    session = session || {};
    var currentState = session.state || emptyState(ctx.lang || 'en');
    var update = extractUpdate(message, ctx, currentState);
    var state = mergeState(currentState, update, ctx.now);
    session._lastExtractedUpdate = update;
    var lang = state.lang;
    var vendor = ctx.vendor;
    var services = ctx.services || [];
    var service = serviceById(state.serviceId, services) || services[0];
    var text = trim(message).toLowerCase();
    var affirmative = /\b(yes|confirm|send|book it|đồng ý|xác nhận|sí|si|confirmar)\b/i.test(text);

    session.state = state;
    session.systemPrompt = buildPrompt(ctx, lang);
    session.lastSystemContext = null;

    if (ctx.customerLookupResult !== undefined && state.phone && !state.customerLookupStatus) {
      applyCustomerRecord(state, ctx.customerLookupResult);
    }

    if (state.intent === 'language') return { session: session, response: reply(lang, 'language') };
    if (state.intent === 'photo') return { session: session, response: reply(lang, 'photo') };
    if (state.intent === 'modify_existing') return { session: session, response: reply(lang, 'cancelled') };

    if (state.intent === 'price' && service) {
      return {
        session: session,
        response: reply(lang, 'priceOnly', { service: service.name, price: money(service.price), travelFee: money(vendor.baseTravelFee) })
      };
    }

    if (!state.phone) {
      state.step = 'ASK_PHONE';
      session.lastSystemContext = systemReason('ask_phone_first');
      return { session: session, response: reply(lang, 'askPhone') };
    }

    if (!state.customerLookupStatus) {
      state.step = 'LOOKUP_CUSTOMER';
      session.lastSystemContext = systemReason('lookup_customer', { phone: state.phone });
      return { session: session, response: reply(lang, 'checkingPhone'), needsCustomerLookup: true };
    }

    if (state.customerLookupStatus === 'found' && state.customerRecord && !state.addressConfirmed && !state.address) {
      state.step = 'IF_EXISTING_CUSTOMER_CONFIRM_PROFILE';
      var foundName = state.customerName || state.customerRecord.customerName || state.customerRecord.name || '';
      if (state.customerRecord.address || state.customerRecord.serviceAddress || state.customerRecord.lastAddress) {
        return { session: session, response: reply(lang, 'foundCustomer', { name: foundName, city: publicAddressCity(state.customerRecord) }) };
      }
      return { session: session, response: reply(lang, 'foundCustomerNoAddress', { name: foundName }) };
    }

    if (state.addressConfirmed && state.customerRecord) {
      applySavedAddress(state);
    }

    var nextQuestion = nextMissingQuestion(state, lang);
    if (nextQuestion) {
      var missing = missingFields(state);
      session.lastSystemContext = systemReason('missing_fields', { fields: missing.join(',') });
      return { session: session, response: nextQuestion };
    }

    state.step = 'CHECK_AVAILABILITY';

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
      state.step = 'CONFIRM_SUMMARY';
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
    state.step = 'DONE';
    session.lastBooking = built.booking;
    session.lastSystemContext = systemReason('booking_created', { id: built.booking.id, status: built.booking.status });
    return { session: session, response: reply(lang, 'saved', { id: built.booking.id }), booking: built.booking };
  }

  function handleMessage(session, message, ctx) {
    session = session || {};
    _assignSessionId(session);
    if (ctx && ctx.vendorId && !session.vendorId) session.vendorId = ctx.vendorId;
    var previousStep = session.state && session.state.step;
    var lastQuestion = session.lastReply || '';
    var result = _handleMessageCore(session, message, ctx);
    var extracted = (result && result.session && result.session._lastExtractedUpdate) || {};
    if (result && result.session) {
      result.session.lastReply = result.response || '';
      logStateTransition(previousStep, lastQuestion, message, result.session, extracted, result.response);
    }
    return result;
  }

  function handleMessageAsync(session, message, ctx) {
    ctx = ctx || {};
    var first = handleMessage(session, message, ctx);
    if (!first || !first.needsCustomerLookup || typeof ctx.customerLookupProvider !== 'function') {
      return Promise.resolve(first);
    }
    var phone = first.session && first.session.state && first.session.state.phone;
    return Promise.resolve(ctx.customerLookupProvider(phone, first.session.state))
      .then(function(record) {
        var nextCtx = Object.assign({}, ctx, { customerLookupResult: record || null });
        return handleMessage(first.session, '', nextCtx);
      })
      .catch(function() {
        var nextCtx = Object.assign({}, ctx, { customerLookupResult: null });
        return handleMessage(first.session, '', nextCtx);
      });
  }

  function serviceBookingAgentBrain(config) {
    config = config || {};
    return {
      vertical: config.vertical || 'mobile_barber',
      handleMessage: function(session, message, ctx) {
        return handleMessage(session, message, Object.assign({}, config, ctx || {}));
      },
      handleMessageAsync: function(session, message, ctx) {
        return handleMessageAsync(session, message, Object.assign({}, config, ctx || {}));
      }
    };
  }

  return {
    emptyState: emptyState,
    mergeState: mergeState,
    extractUpdate: extractUpdate,
    buildPrompt: buildPrompt,
    handleMessage: handleMessage,
    handleMessageAsync: handleMessageAsync,
    serviceBookingAgentBrain: serviceBookingAgentBrain,
    initialPrompt: initialPrompt,
    missingFields: missingFields,
    draftFromState: draftFromState,
    _systemReason: systemReason
  };
});
