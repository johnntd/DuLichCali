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
  // Persisted slots that a stray AI [STATE]:null must never wipe once set.
  var PROTECTED_FROM_NULL = { address: 1, city: 1, zip: 1, customerName: 1, phone: 1 };
  var ACTIVE_STATUSES = ['pending_confirmation', 'confirmed', 'vendor_review'];

  var STRINGS = {
    en: {
      welcome: 'Hi, I can help book a mobile haircut. What phone number should I use to look up your appointment record?',
      welcomeVendor: 'Hi, this is {vendor}. What phone number should I use to look up your appointment record?',
      askPhone: 'What phone number should I use to look up your appointment record?',
      askPhoneRepair: "I didn't catch the number clearly. Could you say the digits one by one?",
      checkingPhone: 'Thanks. I am checking that phone number now.',
      foundCustomer: 'I found your record, {name}. Do you want to use the same address in {city}?',
      foundCustomerNoAddress: 'I found your record, {name}. What service address should the barber visit?',
      newCustomerName: "I don't see a record yet. What name should I put on the booking?",
      askName: 'What name should I put on the booking?',
      askMissing: 'I still need: {fields}.',
      askAddress: 'What service address, city, and ZIP should the barber visit?',
      askCityZip: 'What city and ZIP code is that address in?',
      askAddressRepair: 'I may have missed the address. Could you say the city first, then spell the street name?',
      confirmPartialAddress: 'I heard {partial}. Is that correct?',
      askService: 'What barber service would you like?',
      askDateTime: 'What day and time would you like?',
      offerSlots: 'Here are the next open times: {slots}. Which one works for you?',
      noSlots: 'There are no open times in that window. Could you pick another day, or give me a specific time to check?',
      priceOnly: '{service} is {price}. With the mobile travel fee, the estimated total due after service is {total}. Pay by cash or Zelle after the haircut.',
      language: 'Yes. This assistant can help in English, Vietnamese, or Spanish.',
      photo: 'Yes. Upload a reference photo in the photo field and I will attach it to the booking request.',
      unavailable: 'That time is not available. Please send another date or time.',
      outOfArea: 'That address is outside the normal service area, so the request can be sent for barber review before confirmation.',
      summary: 'Review this request: {service} on {date} at {time}, {address}, {city} {zip}. Estimated total {price}. Payment is collected after the haircut by cash or Zelle to {zellePhone}; preference: {paymentMethod}. Reply yes to send it.',
      saved: "Perfect. {service} on {date} at {time} sent to {barber}. You'll get a confirmation once they accept. Booking ID: {id}. Estimated total {price}. Payment after the haircut by cash or Zelle to {zellePhone}.",
      cancelled: 'I can help with cancellation or rescheduling, but this phase does not change existing bookings yet. Please call the barber for existing booking changes.',
      alreadyBooked: "Your booking is already in (ID: {id}). The barber will confirm shortly. If you need to change or cancel, please call the barber directly.",
      promoApplied: "🎟️ Good news — {pct}% promotion applied ({name}). Original {original}, you pay {discounted}.",
      fallback: 'I can help collect a mobile barber booking request. What phone number should I use first?'
    },
    vi: {
      welcome: 'Dạ em có thể giúp đặt thợ cắt tóc tại nhà. Mình cho em số điện thoại để em tìm hồ sơ trước nhé?',
      welcomeVendor: 'Dạ đây là {vendor}. Mình cho em số điện thoại để em tìm hồ sơ đặt lịch trước nhé?',
      askPhone: 'Mình cho em số điện thoại để em tìm hồ sơ đặt lịch trước nhé?',
      askPhoneRepair: 'Dạ em nghe số chưa rõ. Mình đọc từng số chậm giúp em nhé?',
      checkingPhone: 'Dạ em đang kiểm tra số điện thoại đó.',
      foundCustomer: 'Em thấy hồ sơ của anh/chị {name}. Mình muốn dùng lại địa chỉ ở {city} không ạ?',
      foundCustomerNoAddress: 'Em thấy hồ sơ của anh/chị {name}. Thợ sẽ đến địa chỉ nào ạ?',
      newCustomerName: 'Em chưa thấy hồ sơ với số này. Mình cho em tên để đặt lịch nhé?',
      askName: 'Mình cho em tên để đặt lịch nhé?',
      askMissing: 'Em còn cần: {fields}.',
      askAddress: 'Thợ sẽ đến địa chỉ nào, thành phố nào, và mã ZIP nào?',
      askCityZip: 'Địa chỉ đó ở thành phố nào và mã ZIP nào ạ?',
      askAddressRepair: 'Dạ em có thể bị lỡ địa chỉ. Mình đọc thành phố trước, rồi đánh vần tên đường giúp em nhé?',
      confirmPartialAddress: 'Dạ em nghe {partial}. Đúng không ạ?',
      askService: 'Mình muốn đặt dịch vụ barber nào ạ?',
      askDateTime: 'Mình muốn đặt ngày nào và giờ nào ạ?',
      offerSlots: 'Dạ có các khung giờ trống sau: {slots}. Anh/chị chọn giờ nào ạ?',
      noSlots: 'Dạ khung giờ đó hiện không còn chỗ trống. Anh/chị chọn ngày khác, hoặc cho mình một giờ cụ thể để kiểm tra nhé?',
      priceOnly: '{service} là {price}. Cộng phí di chuyển, tổng ước tính trả sau khi cắt là {total}. Thanh toán bằng tiền mặt hoặc Zelle sau dịch vụ.',
      language: 'Dạ có. Trợ lý này hỗ trợ tiếng Việt, tiếng Anh, hoặc tiếng Tây Ban Nha.',
      photo: 'Dạ được. Tải ảnh tham khảo ở ô ảnh và em sẽ đính kèm vào yêu cầu đặt lịch.',
      unavailable: 'Giờ đó không còn trống. Vui lòng gửi ngày hoặc giờ khác.',
      outOfArea: 'Địa chỉ đó ngoài khu vực phục vụ thường lệ, nên yêu cầu có thể gửi để thợ xem xét trước khi xác nhận.',
      summary: 'Vui lòng xem lại: {service} ngày {date} lúc {time}, {address}, {city} {zip}. Tổng ước tính {price}. Thanh toán sau khi cắt bằng tiền mặt hoặc Zelle tới {zellePhone}; cách muốn dùng: {paymentMethod}. Trả lời đồng ý để gửi.',
      saved: 'Tuyệt vời. Đã gửi {service} ngày {date} lúc {time} cho {barber}. Bạn sẽ nhận xác nhận khi thợ chấp nhận. Mã đặt lịch: {id}. Tổng ước tính {price}. Thanh toán sau dịch vụ bằng tiền mặt hoặc Zelle tới {zellePhone}.',
      cancelled: 'Em có thể hỗ trợ hướng dẫn hủy hoặc đổi lịch, nhưng phase này chưa thay đổi lịch đã có. Vui lòng gọi trực tiếp cho thợ.',
      alreadyBooked: 'Lịch hẹn của bạn đã được gửi (Mã: {id}). Thợ sẽ xác nhận trong giây lát. Nếu cần đổi hoặc hủy, vui lòng gọi trực tiếp cho thợ.',
      promoApplied: '🎟️ Tin vui — đã áp khuyến mãi {pct}% ({name}). Giá gốc {original}, bạn trả {discounted}.',
      fallback: 'Em có thể nhận yêu cầu đặt thợ cắt tóc tại nhà. Mình cho em số điện thoại trước nhé?'
    },
    es: {
      welcome: 'Puedo ayudar a reservar un corte móvil. ¿Qué número de teléfono debo usar para buscar su historial?',
      welcomeVendor: 'Este es {vendor}. ¿Qué número de teléfono debo usar para buscar su historial?',
      askPhone: '¿Qué número de teléfono debo usar para buscar su historial?',
      askPhoneRepair: 'No escuché bien el número. ¿Puede decir los dígitos uno por uno?',
      checkingPhone: 'Gracias. Estoy revisando ese número ahora.',
      foundCustomer: 'Encontré su registro, {name}. ¿Quiere usar la misma dirección en {city}?',
      foundCustomerNoAddress: 'Encontré su registro, {name}. ¿A qué dirección debe ir el barbero?',
      newCustomerName: 'No veo un registro con ese número. ¿Qué nombre pongo en la reserva?',
      askName: '¿Qué nombre pongo en la reserva?',
      askMissing: 'Todavía necesito: {fields}.',
      askAddress: '¿A qué dirección, ciudad, y código ZIP debe ir el barbero?',
      askCityZip: '¿En qué ciudad y código ZIP está esa dirección?',
      askAddressRepair: 'Puede que haya perdido la dirección. ¿Puede decir la ciudad primero y luego deletrear la calle?',
      confirmPartialAddress: 'Escuché {partial}. ¿Es correcto?',
      askService: '¿Qué servicio de barbería quiere?',
      askDateTime: '¿Qué día y hora prefiere?',
      offerSlots: 'Estos son los próximos horarios disponibles: {slots}. ¿Cuál le funciona?',
      noSlots: 'No hay horarios libres en ese rango. ¿Puede elegir otro día o darme una hora específica para verificar?',
      priceOnly: '{service} cuesta {price}. Con la tarifa móvil, el total estimado después del servicio es {total}. Puede pagar en efectivo o Zelle después del corte.',
      language: 'Sí. Este asistente puede ayudar en inglés, vietnamita, o español.',
      photo: 'Sí. Suba una foto de referencia en el campo de foto y la adjuntaré a la solicitud.',
      unavailable: 'Ese horario no está disponible. Envíe otra fecha u hora.',
      outOfArea: 'Esa dirección está fuera del área normal de servicio, así que se puede enviar para revisión del barbero antes de confirmar.',
      summary: 'Revise esta solicitud: {service} el {date} a las {time}, {address}, {city} {zip}. Total estimado {price}. El pago se cobra despues del corte en efectivo o por Zelle a {zellePhone}; preferencia: {paymentMethod}. Responda si para enviarla.',
      saved: 'Perfecto. {service} el {date} a las {time} enviado a {barber}. Recibirá confirmación cuando lo acepte. ID de reserva: {id}. Total estimado {price}. Pago despues del servicio en efectivo o Zelle a {zellePhone}.',
      cancelled: 'Puedo ayudar con cancelación o cambio, pero esta fase todavía no modifica reservas existentes. Llame directamente al barbero.',
      alreadyBooked: 'Su reserva ya está enviada (ID: {id}). El barbero confirmará en breve. Si necesita cambiar o cancelar, llame directamente al barbero.',
      promoApplied: '🎟️ Buenas noticias — promoción del {pct}% aplicada ({name}). Original {original}, paga {discounted}.',
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

  var SPOKEN_DIGITS = {
    zero: '0', oh: '0', o: '0',
    one: '1', two: '2', three: '3', four: '4', five: '5',
    six: '6', seven: '7', eight: '8', nine: '9',
    khong: '0', le: '0', linh: '0',
    mot: '1', hai: '2', ba: '3', bon: '4', tu: '4',
    nam: '5', lam: '5', sau: '6', bay: '7', tam: '8', chin: '9',
    cero: '0', uno: '1', una: '1', dos: '2', tres: '3', cuatro: '4',
    cinco: '5', seis: '6', siete: '7', ocho: '8', nueve: '9'
  };

  function stripDiacritics(text) {
    return trim(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  }

  function normalizeSpokenPhone(text) {
    var numeric = digits(text);
    if (numeric.length === 11 && numeric.charAt(0) === '1') numeric = numeric.slice(1);
    if (numeric.length === 10) return numeric;
    var tokens = stripDiacritics(text).toLowerCase().split(/[\s,\-.\/]+/);
    var out = [];
    for (var i = 0; i < tokens.length; i++) {
      var tok = tokens[i].replace(/[^a-z0-9]/g, '');
      if (!tok) continue;
      if (/^\d+$/.test(tok)) {
        for (var j = 0; j < tok.length; j++) out.push(tok[j]);
      } else if (SPOKEN_DIGITS[tok] !== undefined) {
        out.push(SPOKEN_DIGITS[tok]);
      }
    }
    var joined = out.join('');
    if (joined.length === 11 && joined.charAt(0) === '1') joined = joined.slice(1);
    return joined.length === 10 ? joined : null;
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
      paymentMethod: 'cash',
      photoUrls: [],
      pendingAction: null,
      lastAvailabilityKey: null,
      flexibleWindow: null,
      offeredSlots: null
    };
  }

  function mergeState(current, update, today) {
    var state = current || emptyState('en');
    update = update || {};
    today = today || new Date();
    Object.keys(update).forEach(function(key) {
      var value = update[key];
      if (value === null) {
        // Defense-in-depth (BUG 2): the AI [STATE] marker sometimes echoes a
        // full state with nulls for fields it did not capture this turn. Never
        // let that wipe an already-collected persisted slot.
        if (PROTECTED_FROM_NULL[key] && trim(state[key])) return;
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
        if (/^\d{1,2}:\d{2}$/.test(value)) {
          state.time = value.length === 4 ? '0' + value : value;
          // A concrete time supersedes any flexible window / pending offer.
          state.flexibleWindow = null;
          state.offeredSlots = null;
        }
        return;
      }
      if (key === 'flexibleWindow') {
        state.flexibleWindow = (value && typeof value === 'object') ? value : null;
        return;
      }
      if (key === 'offeredSlots') {
        state.offeredSlots = Array.isArray(value) ? value : null;
        return;
      }
      if (key === 'photoUrls') {
        if (Array.isArray(value)) state.photoUrls = value.filter(function(item) { return trim(item); });
        return;
      }
      if (key === 'paymentMethod') {
        var method = trim(value).toLowerCase();
        if (method === 'cash' || method === 'zelle' || method === 'unknown') state.paymentMethod = method === 'unknown' ? 'cash' : method;
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

  function parseAddressParts(message, ctx) {
    var text = trim(message)
      .replace(/\b20\d{2}-\d{2}-\d{2}\b/g, ' ')
      .replace(/\b\d{1,2}:\d{2}\s*(?:am|pm)?\b/ig, ' ')
      .replace(/\b(?:at|lúc|luc|a las)\s+(?=\d{1,2}(?::\d{2})?\s*(?:am|pm)\b)/ig, ' ')
      .replace(/\s+/g, ' ');
    var lower = text.toLowerCase();
    var parsed = {};
    var zip = /\b(9\d{4})\b/.exec(text);
    if (zip) parsed.zip = zip[1];

    var knownCities = ['San Jose', 'Westminster', 'Garden Grove', 'Irvine', 'Santa Ana', 'Fountain Valley', 'Anaheim'];
    (ctx.vendor && ctx.vendor.serviceAreas || []).forEach(function(area) {
      if (knownCities.indexOf(area) < 0) knownCities.push(area);
    });
    for (var i = 0; i < knownCities.length; i++) {
      if (lower.indexOf(knownCities[i].toLowerCase()) >= 0) {
        parsed.city = knownCities[i];
        break;
      }
    }

    var streetRe = /\b(\d{1,6}\s+[a-zA-Z0-9À-ỹ\s.'-]{2,70}?\s(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|boulevard|way|ct|court|place|pl)\b\.?)/i;
    var street = streetRe.exec(text);
    if (street) parsed.address = street[1].replace(/\s*,?\s*(?:California|CA)\b.*$/i, '').trim();
    else {
      var firstPart = text.split(',')[0].trim();
      if (/^\d{1,6}\s+/.test(firstPart) && firstPart.length <= 90) parsed.address = firstPart;
    }
    return parsed;
  }

  // Representative ZIP per known service-area city. Routing only needs the
  // CITY (isWithinServiceArea matches city OR zip), but the booking WRITE
  // requires a zip (validateRequiredFields). When a customer gives a
  // city-routable address without a ZIP we derive a representative one here so
  // the agent never loops asking for the ZIP ("address again") and the booking
  // still persists. The street + city remain the customer's real values.
  var CITY_REP_ZIP = {
    // Orange County (Michael)
    'westminster': '92683', 'garden grove': '92840', 'santa ana': '92704',
    'fountain valley': '92708', 'huntington beach': '92647', 'costa mesa': '92627',
    'irvine': '92614', 'orange': '92868', 'anaheim': '92805',
    // Bay Area (Tim)
    'san jose': '95112', 'santa clara': '95050', 'milpitas': '95035',
    'sunnyvale': '94085', 'mountain view': '94040', 'cupertino': '95014',
    'los gatos': '95030', 'campbell': '95008', 'fremont': '94536'
  };
  function cityRepZip(city) {
    return CITY_REP_ZIP[trim(city).toLowerCase()] || '';
  }

  // BUG 1 — flexible time. Map a natural availability phrase to a search window
  // (minutes-of-day band, single/multi-day, from-now). Returns null when the
  // message has no flexible signal (a concrete time is handled by normalizeTime).
  function parseFlexibleWindow(message) {
    var t = stripDiacritics(trim(message).toLowerCase());
    if (/\b(earliest|soonest|asap|as soon as possible|next available|first available|som nhat|sm nhat|cuanto antes|lo antes posible)\b/.test(t)) {
      return { kind: 'earliest', startMin: null, endMin: null, fromNow: true, multiDay: true };
    }
    if (/\b(this weekend|cuoi tuan|fin de semana)\b/.test(t)) {
      return { kind: 'weekend', startMin: null, endMin: null, multiDay: true, weekend: true };
    }
    if (/\b(before noon|before 12|before midday|truoc trua|antes del mediodia)\b/.test(t)) {
      return { kind: 'morning', startMin: 0, endMin: 12 * 60 };
    }
    if (/\b(morning|buoi sang|sang|por la manana)\b/.test(t)) {
      return { kind: 'morning', startMin: 0, endMin: 12 * 60 };
    }
    if (/\b(afternoon|buoi chieu|chieu|por la tarde)\b/.test(t)) {
      return { kind: 'afternoon', startMin: 12 * 60, endMin: 17 * 60 };
    }
    // NOTE: do NOT match a bare "toi" — after stripDiacritics, "tôi" (Vietnamese
    // for "I") collapses to "toi" and would be mis-read as "tối" (evening),
    // corrupting availability for the very common "tôi muốn..." phrasing. Match
    // the unambiguous evening forms only ("buổi tối", "tối nay").
    if (/\b(evening|tonight|buoi toi|toi nay|por la noche|night)\b/.test(t)) {
      return { kind: 'evening', startMin: 17 * 60, endMin: null };
    }
    if (/\b(all day|any ?time|anytime|when ?ever|flexible|free all|available all|am available|i am available|im available|are you free|todo el dia|cualquier hora|disponible todo|ranh ca ngay|ca ngay|ranh)\b/.test(t)) {
      return { kind: 'allday', startMin: null, endMin: null, fromNow: true };
    }
    return null;
  }

  // "after 5" / "sau 5 giờ" / "before noon" → an OPEN time band, not a fixed
  // clock minute. Must run BEFORE normalizeTime (which would otherwise lock
  // "after 5" to exactly 17:00) so the agent offers every real slot in the band.
  function parseTimeBandWindow(message) {
    var t = stripDiacritics(trim(message).toLowerCase());
    function toMinutes(hStr, mStr, suf) {
      var h = Number(hStr); var m = Number(mStr || 0);
      suf = (suf || '').toLowerCase();
      if (suf === 'pm' && h < 12) h += 12;
      else if (suf === 'am' && h === 12) h = 0;
      else if (!suf && h < 8) h += 12; // bare "5" in a service context means 5pm
      if (h < 0 || h > 23 || m < 0 || m > 59) return null;
      return h * 60 + m;
    }
    var after = /\b(?:after|from|sau|tu|a partir de|despues de)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/.exec(t);
    if (after) {
      var startMin = toMinutes(after[1], after[2], after[3]);
      if (startMin != null) return { kind: 'after', startMin: startMin, endMin: null };
    }
    var before = /\b(?:before|truoc|antes de)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/.exec(t);
    if (before) {
      var endMin = toMinutes(before[1], before[2], before[3]);
      if (endMin != null) return { kind: 'before', startMin: null, endMin: endMin };
    }
    return null;
  }

  // Match the customer's reply to one of the slots we just offered, by ordinal
  // ("first" / "1" / "the second one") or by a concrete time.
  function _pickOfferedSlot(message, slots) {
    if (!Array.isArray(slots) || !slots.length) return null;
    var t = trim(message).toLowerCase();
    var ordinals = [
      [/\b(1st|first|earliest|soonest|one|number 1|number one|cai dau|primero|primera)\b/, 0],
      [/\b(2nd|second|two|number 2|number two|cai hai|segundo|segunda)\b/, 1],
      [/\b(3rd|third|three|number 3|cai ba|tercero|tercera)\b/, 2],
      [/\b(4th|fourth|four)\b/, 3],
      [/\b(5th|fifth|five)\b/, 4]
    ];
    for (var i = 0; i < ordinals.length; i++) {
      if (ordinals[i][0].test(t) && slots[ordinals[i][1]]) return slots[ordinals[i][1]];
    }
    var tm = normalizeTime(message);
    if (tm) {
      for (var j = 0; j < slots.length; j++) {
        if (slots[j].startTime === tm) return slots[j];
      }
    }
    // A bare number "1".."5"
    var n = /^\s*([1-5])\s*$/.exec(t);
    if (n && slots[Number(n[1]) - 1]) return slots[Number(n[1]) - 1];
    return null;
  }

  function _fmt12(hhmm) {
    return (BOOKING && BOOKING.formatTime12Hour) ? BOOKING.formatTime12Hour(hhmm) : hhmm;
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

    // "after 5" / "before noon" are time BANDS, not fixed minutes — detect them
    // first so they become a flexible window (search + offer real slots) instead
    // of locking to one clock time.
    var band = parseTimeBandWindow(message);
    if (band) {
      update.flexibleWindow = band;
    } else {
      var time = normalizeTime(message);
      if (time) update.time = time;
      else {
        // No concrete clock time — detect a flexible availability window so the
        // agent can search the live schedule and offer real slots (BUG 1).
        var flex = parseFlexibleWindow(message);
        if (flex) update.flexibleWindow = flex;
      }
    }
    if (service) update.serviceId = service.id;

    var phone = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/.exec(message);
    if (phone) update.phone = phone[0];
    else if (ctx.phoneIntake && typeof ctx.phoneIntake.normalizeSpokenPhoneNumber === 'function') {
      var spokenPhone = ctx.phoneIntake.normalizeSpokenPhoneNumber(message, lang, { phoneContext: true, expected: 'phone' });
      if (spokenPhone) update.phone = spokenPhone;
    } else {
      var builtinPhone = normalizeSpokenPhone(message);
      if (builtinPhone) update.phone = builtinPhone;
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

    var shouldParseAddress = prevStep === 'ASK_ADDRESS' ||
      /\b(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|boulevard|way|ct|court|place|pl)\b/i.test(message) ||
      /,\s*[a-zA-ZÀ-ỹ]/.test(message);
    if (shouldParseAddress) {
      var parsedAddress = parseAddressParts(message, ctx);
      if (parsedAddress.address) update.address = parsedAddress.address;
      if (parsedAddress.city) update.city = parsedAddress.city;
      if (parsedAddress.zip) update.zip = parsedAddress.zip;
    }

    if (/\b(same address|same place|use same|yes|yeah|correct|đúng|dạ đúng|địa chỉ cũ|sí|si|misma dirección)\b/i.test(lower)) {
      update.addressConfirmed = true;
    }
    if (/\bjohn\b/i.test(message)) update.barberPreference = 'John';
    if (/\btim\b/i.test(message)) update.barberPreference = 'Tim Nguyen';
    if (/\bmichael\b/i.test(message)) update.barberPreference = 'Michael Nguyen';
    if (/\b(style|kiểu|estilo|fade|beard|râu|barba)\b/i.test(lower)) update.notes = trim(message);
    if (/\b(zelle)\b/i.test(lower)) update.paymentMethod = 'zelle';
    else if (/\b(cash|tiền mặt|tien mat|efectivo)\b/i.test(lower)) update.paymentMethod = 'cash';

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
          // A regex-matched street (parseAddressParts) is always trusted.
          // The loose first-comma-part fallback is ONLY accepted when it
          // looks like a street (leading house number) and we don't already
          // hold a good street — otherwise a follow-up reply like a bare ZIP
          // ("95121") or non-address text ("classic haircut at 5pm") would
          // clobber the real street the customer already gave. That was the
          // address-pollution bug found 2026-05-29.
          var strictAddr = parseAddressParts(trimmedMsg, ctx).address;
          var existingStreet = currentState && /^\d{1,6}\s+\S/.test(trim(currentState.address || ''));
          var looseAddr = parts[0] || trimmedMsg;
          var looseLooksLikeStreet = /^\d{1,6}\s+\S/.test(looseAddr) && !/^9\d{4}$/.test(looseAddr);
          var addrCandidate = strictAddr || ((!existingStreet && looseLooksLikeStreet) ? looseAddr : '');
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
      paymentMethod: state.paymentMethod || 'cash',
      paymentStatus: 'unpaid',
      zellePhone: (state.vendorZellePhone || state.vendorPhone || '').trim(),
      photoUrls: state.photoUrls || []
    };
  }

  function missingFields(state) {
    return ['customerName', 'phone', 'serviceId', 'date', 'time', 'address', 'city', 'zip'].filter(function(key) {
      return !trim(state[key]);
    });
  }

  // Live active-promotion filter shared by both prompt builders so the
  // conversational brain and the legacy prompt never diverge from the price
  // engine's own check (mobile-barber-data.js findActivePromotionForService).
  function _activePromotions(vendor, now) {
    if (!vendor || !Array.isArray(vendor.promotions)) return [];
    var iso = (now instanceof Date ? now : new Date()).toISOString().slice(0, 10);
    return vendor.promotions.filter(function(p) {
      if (!p || p.active !== true) return false;
      if (p.startDate && iso < p.startDate) return false;
      if (p.endDate && iso > p.endDate) return false;
      var max = Number(p.maxRedemptions || 0);
      var cur = Number(p.currentRedemptions || 0);
      if (max > 0 && cur >= max) return false;
      return true;
    });
  }

  function _promoLines(promos) {
    return (promos || []).map(function(p) {
      var scope = p.applyToScope === 'selected'
        ? ('selected services: ' + (Array.isArray(p.appliesToServiceIds) ? p.appliesToServiceIds.join(', ') : ''))
        : 'all services';
      var range = [p.startDate, p.endDate].filter(Boolean).join(' to ');
      return '- ' + p.discountPercent + '% off — ' + (p.name || '') + ' (' + scope + (range ? '; ' + range : '') + ')';
    }).join('\n');
  }

  function buildPrompt(ctx, lang) {
    var vendor = ctx.vendor;
    var services = (ctx.services || []).map(function(service) {
      return service.name + ' — $' + service.price + ' (' + service.durationMinutes + ' min, travel buffer ' + service.travelBufferMinutes + ' min)';
    }).join('\n');
    // Surface active vendor promotions to the brain so it can mention them
    // naturally ("Michael currently has a 20% promotion on Classic Haircut").
    var promoLines = _promoLines(_activePromotions(vendor, ctx.now));
    return [
      'You are the Du Lich Cali Mobile Barber booking assistant.',
      'Respond in this language code unless the customer changes language: ' + (VALID_LANGS[lang] ? lang : 'en') + '.',
      'Vendor scope: ' + vendor.businessName + ' / ' + vendor.barberName + '.',
      'Service areas: ' + (vendor.serviceAreas || []).join(', ') + '. Travel radius miles: ' + vendor.travelRadiusMiles + '.',
      'Services and prices:\n' + services,
      promoLines ? ('Active promotions (mention naturally when the customer asks about price or chooses a matching service):\n' + promoLines) : '',
      'Never invent availability, prices, travel radius, barber names, or internal data.',
      'Use MobileBarberBooking.calculateMobileBarberPrice for quotes; service price alone is not the final mobile total. The pricing engine already applies any active promotion — quote the discounted total.',
      'Never confirm a booking until backend availability and service-area checks have passed.',
      'Payment is collected after service by cash or Zelle. Ask for the preferred payment method when natural; default to cash if the customer does not choose. Do not require prepayment, card payment, Apple Pay, Google Pay, or Stripe.',
      'When you see a user message starting with [SYSTEM: ...], rewrite that backend result naturally in the customer language and do not expose the marker.',
      'Use the serviceBookingAgentBrain pattern: intent extraction, slot filling, one question at a time, customer lookup, service lookup, availability check, summary, then booking write.',
      'Phone lookup is always first for booking. Never ask for name, phone, address, service, date, and time in one message.'
    ].filter(Boolean).join('\n');
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

  function partialAddressText(state) {
    return [state.address, state.city, state.zip].filter(function(value) { return trim(value); }).join(', ');
  }

  function initialPrompt(ctx, lang) {
    var vendor = ctx && ctx.vendor;
    var vendorName = vendor && (vendor.businessName || vendor.barberName);
    return vendorName ? reply(lang, 'welcomeVendor', { vendor: vendorName }) : reply(lang, 'welcome');
  }

  // ── AI Brain (Phase 2) ─────────────────────────────────────────────────────
  // The deterministic state machine above decides WHICH question to ask next.
  // The AI brain (when present) is responsible for understanding short / natural
  // customer replies and paraphrasing the next question in a human voice, while
  // emitting a [STATE:{...}] marker so the deterministic state can be re-merged
  // with what the AI understood. Deterministic guards (phone lookup, availability,
  // booking write) stay the source of truth — the AI never confirms a booking.

  var STATE_MARKER_RE = /\[STATE:(\{[\s\S]*?\})\s*\]/i;
  var ACTION_MARKER_RE = /\[ACTION:[^\]]+\]/gi;

  var AI_STEP_GUIDANCE = {
    START: 'Greet briefly and ask for the customer phone number.',
    ASK_PHONE: 'Politely ask for the customer phone number so you can look up their record.',
    LOOKUP_CUSTOMER: 'Acknowledge you are checking the phone number. Do not ask another question yet.',
    IF_NEW_CUSTOMER_ASK_NAME: 'Say you do not see a record yet. Ask what name should go on the booking.',
    IF_EXISTING_CUSTOMER_CONFIRM_PROFILE: 'Greet the customer by their saved name. If you have a saved address, offer it for reuse; otherwise ask for the service address.',
    ASK_NAME: 'Ask for the customer name.',
    ASK_ADDRESS: 'Ask for the service address (street, city, ZIP). One question only.',
    ASK_SERVICE: 'Ask which barber service they would like. List a couple of options if helpful.',
    ASK_DATE_TIME: 'Ask what day and time they would prefer.',
    OFFER_SLOTS: 'The system has found REAL open times from the live schedule (listed in the system note). Offer exactly those times and ask the customer to pick one. Never invent or imply other availability.',
    CHECK_AVAILABILITY: 'Acknowledge the request and wait for the system availability result. Do not promise the slot.',
    CONFIRM_SUMMARY: 'Read back the booking summary (service, date/time, address, total). Ask the customer to reply yes to send it.',
    CREATE_BOOKING: 'Acknowledge the booking is being sent.',
    DONE: 'Confirm the request was sent and mention the barber still needs to confirm.'
  };

  // English reason instructions handed to the AI brain (via a [SYSTEM: ...]
  // note) when a booking cannot be completed, so it can explain WHY in the
  // customer's language. These are AI instructions, not user-facing strings
  // (RULE #2 compliant — the AI rephrases them in the customer locale).
  var AVAIL_REASONS = {
    service_area_out_of_range: 'The address is outside every mobile-barber service area we cover. We currently serve Orange County (barber Michael) and the Bay Area (barber Tim). Tell the customer we do not have a barber who can travel to that address, and name the areas we do serve.',
    closed_day: 'The barber is closed on the requested day. Ask the customer to choose a day the barber is open.',
    outside_hours: 'The requested time is outside the barber working hours for that day. Ask for a time within working hours.',
    unavailable_block: 'The barber has blocked off the requested time. Ask the customer to pick a different time.',
    same_day_cutoff: 'The requested time is too soon to schedule today (past the same-day cutoff). Ask for a later time or a different day.',
    availability_missing: 'This barber has not published working hours yet. Ask the customer to try another day or contact the barber directly.',
    blackout_date: 'The barber is not available on that date. Ask the customer to choose another date.',
    invalid_hours: 'The barber working hours for that day are not set correctly. Ask the customer to try a different day.',
    required_fields: 'Some required booking details are still missing. Ask only for the missing detail (such as the ZIP code) and do not say the booking is done.'
  };

  function _parseStateMarker(reply) {
    if (!reply || typeof reply !== 'string') return null;
    var m = STATE_MARKER_RE.exec(reply);
    if (!m) return null;
    try { return JSON.parse(m[1]); } catch (e) { return null; }
  }

  function _stripMarkers(reply) {
    if (!reply || typeof reply !== 'string') return '';
    return reply.replace(STATE_MARKER_RE, '').replace(ACTION_MARKER_RE, '').replace(/\s+\n/g, '\n').trim();
  }

  function _buildAIBrainPrompt(state, ctx, lang) {
    var vendor = (ctx && ctx.vendor) || {};
    var services = (ctx && ctx.services) || [];
    var langCode = VALID_LANGS[lang] ? lang : 'en';
    var langName = { en: 'English', vi: 'Tiếng Việt', es: 'Español' }[langCode] || 'English';

    var serviceLines = services.map(function(s) {
      return '- ' + s.id + ' : ' + s.name + ' ($' + s.price + ', ' + s.durationMinutes + ' min)';
    }).join('\n');

    var slotLines = [];
    if (state.customerName) slotLines.push('customerName: ' + state.customerName);
    if (state.phone) slotLines.push('phone: ' + state.phone);
    if (state.address || state.city || state.zip) {
      slotLines.push('address: ' + trim((state.address || '') + ', ' + (state.city || '') + ' ' + (state.zip || '')));
    }
    if (state.serviceId) slotLines.push('serviceId: ' + state.serviceId);
    if (state.date) slotLines.push('date: ' + state.date);
    if (state.time) slotLines.push('time: ' + state.time);
    if (state.paymentMethod) slotLines.push('paymentMethod: ' + state.paymentMethod);
    if (state.customerLookupStatus) slotLines.push('customerLookupStatus: ' + state.customerLookupStatus);
    if (state.addressConfirmed) slotLines.push('addressConfirmed: true');

    var guidance = AI_STEP_GUIDANCE[state.step] || AI_STEP_GUIDANCE.START;

    var serviceAreas = (vendor.serviceAreas || []).join(', ') || 'Bay Area & Orange County';
    var vendorName = vendor.businessName || vendor.barberName || 'Mobile Barber';
    var barberName = vendor.barberName || vendorName;
    var promoLines = _promoLines(_activePromotions(vendor, ctx && ctx.now));
    var todayIso = (ctx && ctx.todayIso)
      || ((ctx && ctx.now instanceof Date ? ctx.now : new Date()).toISOString().slice(0, 10));

    return [
      'LANGUAGE LOCK: Customer-facing text MUST be entirely in ' + langName + '. Never mix languages. Match the customer completely.',
      'You are the Du Lich Cali Mobile Barber booking assistant for ' + vendorName + ' (barber: ' + barberName + ').',
      'Instructions and data examples below are in English for model reference only. Customer-facing text must remain in ' + langName + '.',
      'Behave human. Acknowledge what the customer just said before asking the next question. One question per turn.',
      'Never ask for name, phone, address, service, date, and time all at once. Phone lookup is always first for booking.',
      'Service areas: ' + serviceAreas + '.',
      'Available services:',
      serviceLines || '(none configured)',
      'NEVER invent prices, services, availability, addresses, or barber names not listed above.',
      '',
      '=== ACTIVE PROMOTIONS (live from the vendor portal) ===',
      promoLines
        ? ('The vendor currently has these live promotions. Mention them naturally when the customer asks about price or selects a matching service. The pricing engine already applies the discount to the quoted total — never invent, stack, or change a promotion:\n' + promoLines)
        : 'No active promotions right now. Do not invent or imply any discount.',
      '',
      '=== LANGUAGE ===',
      'Detect the customer language from the active session and respond ENTIRELY in that same language.',
      'Current locked language: ' + langName + ' (' + langCode + ').',
      'Never mix languages. Match the customer completely.',
      '',
      '=== VIETNAMESE OUTPUT RULES (applies whenever lang = vi) ===',
      'RULE V1 — No English fragments inside Vietnamese sentences.',
      '  Wrong pattern: Vietnamese sentence with English connector words such as "with", "at", "available", "booked", or "confirmed".',
      '  Right pattern: use Vietnamese connectors: "với", "lúc", "còn trống", "đã có lịch", "đã xác nhận".',
      '  [STATE:{...}] markers are data — keep service ids and field names in English there.',
      'RULE V2 — Use Vietnamese service phrasing in conversation: "cắt tóc", "fade", "tỉa râu", "dịch vụ barber tại nhà".',
      'RULE V3 — Time expressions use Vietnamese phrasing: "9 giờ sáng", "3 giờ chiều", "lúc 5 giờ chiều". If numeric time appears, add "sáng", "chiều", or "tối" when known.',
      'RULE V4 — Respectful address: use "dạ", "anh/chị", "mình", and natural Vietnamese warmth. Do not switch to English after long histories.',
      'RULE V5 — Backend/system notes must be rephrased in Vietnamese; never expose "[SYSTEM:]" or technical terms.',
      '',
      '=== SPANISH OUTPUT RULES (applies whenever lang = es) ===',
      'RULE S1 — No English fragments inside Spanish sentences.',
      'RULE S2 — Use natural Spanish connectors: "con", "a las", "el", "disponible", "reservado", "confirmado".',
      'RULE S3 — [STATE:{...}] markers are data — keep service ids and field names in English there, but conversational text stays Spanish.',
      'RULE S4 — Backend/system notes must be rephrased in Spanish; never expose "[SYSTEM:]" or technical terms.',
      '',
      '=== SYSTEM FEEDBACK MESSAGES ===',
      'When you see a user message starting with [SYSTEM: ...], it is a backend booking, customer-lookup, service-area, or conflict-guard result.',
      'Respond naturally in ' + langName + '. Never expose "[SYSTEM:]" or any technical detail to the customer.',
      '',
      '=== AVAILABILITY AND CONFLICT GUARD — CRITICAL RULE ===',
      'The SYSTEM validates real-time slot availability, service area, duplicate risk, and owner-wide conflicts automatically through BookingGuard.',
      'You do not and cannot validate those yourself. Your job is to collect phone, service, date, time, and location.',
      'NEVER claim a booking is confirmed or a slot is available. Only the backend write/guard result can confirm or reject.',
      'If the backend sends a [SYSTEM: booking_guard_...] result, apologize briefly and explain the next safe step in the customer language.',
      '',
      'Payment is collected after the haircut. Customers can pay cash or Zelle to the barber Zelle contact (' + (vendor.zellePhone || vendor.phone || vendor.zelleEmail || 'vendor settings') + '). Ask which they prefer when natural, and default to cash if they skip it.',
      '',
      'Currently collected booking slots:',
      slotLines.length ? slotLines.join('\n') : '(none yet)',
      '',
      'Next step the deterministic agent will run: ' + state.step,
      'Guidance for this turn: ' + guidance,
      '',
      'STATE MARKER PROTOCOL — when the customer reply contains a value for a slot, emit ONE marker on the LAST line of your response (NEVER inside the customer-facing text).',
      'Reference-only marker examples, not customer-facing replies:',
      '  [STATE:{"customerName":"John"}]',
      '  [STATE:{"addressConfirmed":true}]',
      '  [STATE:{"serviceId":"' + ((services[0] && services[0].id) || 'service-id') + '","date":"' + todayIso + '","time":"17:00"}]',
      '',
      'Allowed STATE keys: customerName, phone, address, city, zip, serviceId, date, time, addressConfirmed, intent, barberPreference, notes, paymentMethod.',
      'Allowed serviceId values: ' + (services.map(function(s) { return s.id; }).join(', ') || '(none)') + '.',
      'date MUST be ISO YYYY-MM-DD. time MUST be HH:MM 24-hour. Phone digits only.',
      'If the customer reply contains NO new slot value, do not emit a marker — just ask the next question naturally.',
      'The marker is stripped from the user-visible reply automatically. NEVER paraphrase the marker or read it aloud.',
      'FINAL LANGUAGE LOCK: Customer-facing text MUST be entirely in ' + langName + '. Never mix languages. Match the customer completely.'
    ].join('\n');
  }

  // Ground-truth status of what the deterministic core actually did this turn.
  // Fed to the AI brain so its narration can never claim a booking is submitted
  // when the core did not build one (the root cause of "AI said booked but the
  // vendor portal was empty"). Returns an English instruction string; the AI
  // rephrases it in the customer's language (RULE #2 compliant).
  function _authoritativeOutcome(baseResult) {
    if (!baseResult) return '';
    if (baseResult.booking && baseResult.booking.id) {
      if (baseResult.booking.status === 'vendor_review') {
        return 'BOOKING_RESULT=submitted_for_review. The system created booking ' + baseResult.booking.id +
          ', but it needs the barber to personally confirm the details (travel distance / special quote). ' +
          'Tell the customer their request was sent and the barber will personally confirm shortly. ' +
          'Do NOT say it is fully confirmed, and do not alter any detail.';
      }
      return 'BOOKING_RESULT=submitted. The system created and is sending booking ' + baseResult.booking.id +
        '. Tell the customer their request was sent and the barber will confirm shortly. Do not alter any detail.';
    }
    var note = trim((baseResult.session && baseResult.session.lastSystemContext) || '');
    return 'BOOKING_RESULT=not_submitted. ' + (note ? (note + ' ') : '') +
      'A booking was NOT created this turn. Do NOT tell the customer it is booked, confirmed, submitted, or done. ' +
      'Ask only for the next missing detail, or if a reason is given above, explain that reason in the customer language.';
  }

  function _runAIBrain(session, message, ctx, baseResult) {
    if (!baseResult || !baseResult.session) return Promise.resolve(baseResult);
    var provider = ctx && ctx.aiBrainProvider;
    if (typeof provider !== 'function') return Promise.resolve(baseResult);
    // Skip the AI hop when there is nothing to say (e.g. customer-lookup phase
    // returned a status message that the second handleMessage call replaces).
    if (!baseResult.response && !message) return Promise.resolve(baseResult);

    var state = baseResult.session.state || {};
    var lang = state.lang || 'en';
    var systemPrompt = _buildAIBrainPrompt(state, ctx, lang);
    baseResult.session.history = baseResult.session.history || [];
    var history = baseResult.session.history;

    if (message) {
      history.push({ role: 'user', content: trim(message) });
    } else if (baseResult.systemContextForAI) {
      // Synthetic system message describing what the deterministic layer just did
      // (e.g. "customer lookup miss") so the AI can react naturally.
      history.push({ role: 'user', content: '[SYSTEM: ' + baseResult.systemContextForAI + ']' });
    }

    // Keep history bounded (last 20 turns) to limit token spend.
    var historyForAI = history.slice(-20);

    // Append the deterministic ground truth for THIS turn so the AI narration
    // matches reality (cannot fabricate a confirmation). Appended only to the
    // copy sent to the model — never persisted — so these notes cannot pile up.
    var outcomeNote = _authoritativeOutcome(baseResult);
    if (outcomeNote) {
      historyForAI = historyForAI.concat([{ role: 'user', content: '[SYSTEM: ' + outcomeNote + ']' }]);
    }

    return Promise.resolve(provider({
      systemPrompt: systemPrompt,
      history: historyForAI,
      state: state,
      vendor: ctx.vendor,
      lang: lang
    })).then(function(aiResp) {
      var rawReply = (aiResp && (aiResp.text || aiResp.reply)) || '';
      var stateUpdate = _parseStateMarker(rawReply);
      var naturalReply = _stripMarkers(rawReply);

      if (stateUpdate && typeof stateUpdate === 'object') {
        baseResult.session.state = mergeState(baseResult.session.state, stateUpdate, ctx.now);
        baseResult.session._aiStateUpdate = stateUpdate;
      }

      if (naturalReply) {
        baseResult.response = naturalReply;
        baseResult.session.lastReply = naturalReply;
        history.push({ role: 'assistant', content: naturalReply });
      } else if (baseResult.response) {
        history.push({ role: 'assistant', content: baseResult.response });
      }
      baseResult.aiBrainUsed = true;
      baseResult.session.history = history;
      return baseResult;
    }).catch(function(err) {
      // AI failed → keep deterministic reply. Do not append failed AI text to history.
      baseResult.aiBrainError = (err && err.message) || String(err);
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[mobile-barber-agent] AI brain failed, using deterministic reply:', baseResult.aiBrainError);
      }
      if (baseResult.response) {
        history.push({ role: 'assistant', content: baseResult.response });
      }
      return baseResult;
    });
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

  // Schedule diagnostic — emitted on both the green-light path (before a
  // booking write) and every schedule-type rejection, so production logs show
  // exactly what the availability engine decided and which alternates (if any)
  // were offered. See spec: [mobile-barber-agent-schedule].
  function logScheduleCheck(session, vendor, draft, availability, suggested) {
    if (typeof console === 'undefined' || !console.log) return;
    try {
      console.log('[mobile-barber-agent-schedule]', JSON.stringify({
        sessionId: (session && session.id) || null,
        assignedBarberId: (vendor && (vendor.assignedBarberId || vendor.barberId || vendor.id)) || null,
        requestedStart: trim(((draft && draft.requestedDate) || '') + ' ' + ((draft && draft.startTime) || '')),
        requestedEnd: (availability && availability.timing && availability.timing.endTime) || '',
        availabilityResult: availability ? (availability.canCreate ? 'available' : availability.key) : 'unknown',
        conflicts: availability && availability.canCreate ? [] : [availability && availability.key].filter(Boolean),
        suggestedSlots: (suggested || []).map(function(s) { return s.requestedDate + ' ' + s.startTime; })
      }));
    } catch (e) { /* logging is best-effort */ }
  }

  // Booking-write diagnostic — emitted the moment the deterministic core builds
  // a booking, BEFORE the caller persists it. See spec:
  // [mobile-barber-agent-booking-write].
  function logBookingWrite(session, booking) {
    if (typeof console === 'undefined' || !console.log) return;
    try {
      console.log('[mobile-barber-agent-booking-write]', JSON.stringify({
        sessionId: (session && session.id) || null,
        bookingId: (booking && booking.id) || null,
        status: (booking && booking.status) || null,
        vendorId: (booking && booking.vendorId) || null,
        assignedBarberId: (booking && booking.assignedBarberId) || null,
        ownerId: (booking && booking.ownerId) || null,
        routingReason: (booking && booking.routingReason) || null,
        previousCustomerMatched: !!(booking && booking.previousCustomerMatched),
        source: (booking && booking.source) || null
      }));
    } catch (e) { /* logging is best-effort */ }
  }

  // BUG 1 — flexible time: search the LIVE schedule for real open slots inside
  // the customer's flexible window. Returns an array of {requestedDate,
  // startTime, endTime} (possibly empty). Never invents availability.
  function _offerFlexibleSlots(state, ctx, vendor, services) {
    if (!BOOKING || typeof BOOKING.findNextAvailableSlots !== 'function' || !vendor) return [];
    var fw = state.flexibleWindow || {};
    var now = (ctx && ctx.now instanceof Date) ? ctx.now : new Date();
    var todayIso = localISODate(now);
    var startDate = (state.date && state.date >= todayIso) ? state.date : todayIso;
    var fromNowMin = fw.fromNow ? (now.getHours() * 60 + now.getMinutes()) : null;
    var baseOpts = {
      vendor: vendor,
      services: services,
      availability: (ctx && ctx.availability) || DATA.sampleAvailability,
      existingBookings: (ctx && ctx.existingBookings) || [],
      unavailableBlocks: (ctx && ctx.unavailableBlocks) || [],
      now: now,
      windowStartMinutes: fw.startMin,
      windowEndMinutes: fw.endMin,
      fromNowMinutes: fromNowMin,
      limit: 5
    };
    function search(endDate) {
      try {
        return BOOKING.findNextAvailableSlots(vendor.id, state.serviceId, { start: startDate, end: endDate }, baseOpts) || [];
      } catch (e) { return []; }
    }
    // Stage 1: the requested day (or a multi-day span for open-ended phrases).
    var slots = search(fw.multiDay ? addDays(now, 13) : startDate);
    // Stage 2 (forward fallback): the requested day is full → keep the same time
    // band but search the next ~2 weeks so the customer always gets the NEXT real
    // openings ("Tim is full today — next open is tomorrow 9:00 / 10:30 / 1:00").
    var usedFallback = false;
    if (!slots.length && !fw.multiDay) {
      usedFallback = true;
      slots = search(addDays(now, 14));
    }
    if (typeof console !== 'undefined' && console.log) {
      try {
        console.log('[mb-agent-availability]', JSON.stringify({
          vendorId: vendor.id,
          serviceId: state.serviceId,
          requestedWindowStart: startDate + (fw.startMin != null ? ' ' + Math.floor(fw.startMin / 60) + ':00' : ''),
          requestedWindowEnd: ((fw.multiDay || usedFallback) ? '(forward)' : startDate) + (fw.endMin != null ? ' ' + Math.floor(fw.endMin / 60) + ':00' : ''),
          fixedTime: false,
          flexibleKind: fw.kind || (trim(state.date) ? 'specific-day' : null),
          usedForwardFallback: usedFallback,
          slotsReturned: slots.length,
          conflicts: 0,
          source: 'live-db'
        }));
      } catch (e) {}
    }
    return slots;
  }

  function _handleMessageCore(session, message, ctx) {
    ctx = ctx || {};
    session = session || {};
    var currentState = session.state || emptyState(ctx.lang || 'en');
    var previousStep = currentState.step;
    var update = extractUpdate(message, ctx, currentState);
    var state = mergeState(currentState, update, ctx.now);
    session._lastExtractedUpdate = update;
    var lang = state.lang;
    var vendor = ctx.vendor;
    var services = ctx.services || [];
    var service = serviceById(state.serviceId, services) || services[0];
    var text = trim(message).toLowerCase();
    // Affirmative detection — broad enough to cover everyday human replies.
    // The previous regex only matched literal yes/confirm/send/book it, so
    // customers replying "ok", "okay", "perfect", "thanks", "go ahead",
    // "sure", "yeah", "sounds good" got stuck in a confirmation loop.
    var affirmative = /\b(yes|yeah|yep|yup|ok|okay|sure|please|confirm|confirmed|send|submit|book it|go ahead|sounds good|perfect|great|good|alright|all right|that works|let's do it|do it|fine|cool|thanks|thank you|đồng ý|xác nhận|được|ok luôn|ok nhé|tốt|cảm ơn|cám ơn|cảm ơn nhé|sí|si|claro|por favor|confirmar|gracias|adelante)\b/i.test(text);

    session.state = state;
    session.systemPrompt = buildPrompt(ctx, lang);
    session.lastSystemContext = null;

    if (ctx.customerLookupResult !== undefined && state.phone && !state.customerLookupStatus) {
      applyCustomerRecord(state, ctx.customerLookupResult);
    }

    if (state.intent === 'language') return { session: session, response: reply(lang, 'language') };
    if (state.intent === 'photo') return { session: session, response: reply(lang, 'photo') };
    if (state.intent === 'modify_existing') return { session: session, response: reply(lang, 'cancelled') };

    // Terminal-state guard: once a booking has been submitted in this session
    // (step === 'DONE' AND lastBooking is set), any further customer message
    // must NOT re-enter the auto-submit path. Without this guard, replies
    // like "thanks" or "what time again?" would re-trigger buildBooking and
    // write a duplicate row to the vendor's Pending list — which is exactly
    // the bug reported on 2026-05-27 (two identical 4:00 PM $50 rows).
    if (state.step === 'DONE' && session.lastBooking && session.lastBooking.id) {
      session.lastSystemContext = systemReason('already_booked', { id: session.lastBooking.id });
      return {
        session: session,
        response: reply(lang, 'alreadyBooked', { id: session.lastBooking.id })
      };
    }

    if (state.intent === 'price' && service) {
      var quickPrice = BOOKING.calculateMobileBarberPrice({
        vendor: vendor,
        service: service,
        customerAddress: draftFromState(state),
        requestedDateTime: state.date && state.time ? (state.date + 'T' + state.time) : ''
      });
      return {
        session: session,
        response: reply(lang, 'priceOnly', { service: service.name, price: money(quickPrice.baseServicePrice), total: money(quickPrice.totalPrice) })
      };
    }

    if (!state.phone) {
      state.step = 'ASK_PHONE';
      session.lastSystemContext = systemReason('ask_phone_first');
      return { session: session, response: previousStep === 'ASK_PHONE' && trim(message) ? reply(lang, 'askPhoneRepair') : reply(lang, 'askPhone') };
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

    // BUG 2 fix — route by city: when the customer gave a city-routable address
    // without a ZIP, derive a representative ZIP so the agent never loops asking
    // for it ("address again") and the booking still writes. Street + city are
    // the customer's real values; the ZIP is a city representative only.
    if (trim(state.city) && !trim(state.zip)) {
      var derivedZip = cityRepZip(state.city);
      if (derivedZip) {
        state.zip = derivedZip;
        state.zipDerivedFromCity = true;
      }
    }
    // Address-repeat guard diagnostic.
    if (typeof console !== 'undefined' && console.log) {
      try {
        var _hasRoutableAddr = !!(trim(state.address) && (trim(state.city) || trim(state.zip)));
        var _wouldAskAddr = !!trim(state.customerName) && (!trim(state.address) || !trim(state.city));
        console.log('[mb-agent-address-repeat-guard]', JSON.stringify({
          alreadyHasAddress: _hasRoutableAddr,
          attemptedToAskAddressAgain: _hasRoutableAddr && _wouldAskAddr,
          blockedRepeatQuestion: _hasRoutableAddr && !_wouldAskAddr,
          address: trim(state.address) || null,
          city: trim(state.city) || null,
          zip: trim(state.zip) || null,
          zipDerived: !!state.zipDerivedFromCity
        }));
      } catch (e) {}
    }

    // ── BUG 1 — flexible time → real slots ────────────────────────────────
    // (a) Customer is picking from slots we already offered.
    if (Array.isArray(state.offeredSlots) && state.offeredSlots.length && !trim(state.time)) {
      var picked = _pickOfferedSlot(message, state.offeredSlots);
      if (picked) {
        state.date = picked.requestedDate;
        state.time = picked.startTime;
        state.flexibleWindow = null;
        state.offeredSlots = null;
      }
    }
    // (b) Flexible window + everything except the time present → search the live
    // schedule and offer real open slots (never invent / never loop on time).
    var _preTimeMissing = ['customerName', 'address', 'city', 'serviceId'].filter(function(k) { return !trim(state[k]); });
    // Offer real slots whenever the customer has given a day OR a flexible window
    // but no concrete clock time — never loop asking "what time?". A bare date
    // ("hôm nay" / "today" / a specific day) means "any open time that day"; if
    // that day is full, _offerFlexibleSlots searches forward for the next real
    // openings. A concrete time (state.time) skips this and books directly.
    var _hasDayOrWindow = state.flexibleWindow || trim(state.date);
    if (!_preTimeMissing.length && !trim(state.time) && _hasDayOrWindow) {
      var realSlots = _offerFlexibleSlots(state, ctx, vendor, services);
      if (realSlots && realSlots.length) {
        state.offeredSlots = realSlots;
        state.step = 'OFFER_SLOTS';
        var listText = realSlots.map(function(s, i) {
          return (i + 1) + ') ' + s.requestedDate + ' ' + _fmt12(s.startTime);
        }).join('; ');
        session.lastSystemContext = 'These are REAL open times from the live schedule. Offer exactly these and ask the customer to pick one; never invent other times: ' + listText;
        return { session: session, response: reply(lang, 'offerSlots', { slots: listText }) };
      }
      // No real slots in the window → drop the flexible flag and ask for a day.
      state.flexibleWindow = null;
      state.step = 'ASK_DATE_TIME';
      session.lastSystemContext = 'No open times were found in the requested window. Apologize briefly and ask the customer to choose a different day or give a specific time.';
      return { session: session, response: reply(lang, 'noSlots') };
    }

    var nextQuestion = nextMissingQuestion(state, lang);
    if (nextQuestion) {
      var missing = missingFields(state);
      session.lastSystemContext = systemReason('missing_fields', { fields: missing.join(',') });
      if (previousStep === 'ASK_ADDRESS' && trim(message) &&
          missing.some(function(key) { return key === 'address' || key === 'city' || key === 'zip'; }) &&
          (state.address || state.city || state.zip)) {
        return { session: session, response: reply(lang, 'confirmPartialAddress', { partial: partialAddressText(state) }) };
      }
      if (previousStep === 'ASK_ADDRESS' && trim(message) &&
          missing.some(function(key) { return key === 'address' || key === 'city' || key === 'zip'; })) {
        return { session: session, response: reply(lang, 'askAddressRepair') };
      }
      return { session: session, response: nextQuestion };
    }

    state.step = 'CHECK_AVAILABILITY';

    var draft = draftFromState(state);
    var availability = BOOKING.checkAvailability({
      vendor: vendor,
      services: services,
      availability: ctx.availability || DATA.sampleAvailability,
      unavailableBlocks: ctx.unavailableBlocks || [],
      draft: draft,
      existingBookings: ctx.existingBookings || [],
      liveDataSource: ctx.liveDataSource || 'provided'
    });
    state.lastAvailabilityKey = availability.key;

    if (!availability.canCreate) {
      // Hand the AI a specific, human reason so it can explain WHY the booking
      // could not be completed instead of a generic "not available".
      var failReason = AVAIL_REASONS[availability.key]
        || ('The booking could not be completed (reason code: ' + availability.key + '). Apologize and explain we could not complete it.');

      // Schedule-type failures (closed day, outside hours, blocked time,
      // same-day cutoff, overlap, duplicate) get up to 3 real alternate slots
      // from the same availability engine, handed to the AI as data so it can
      // offer them in the customer's language. Service-area and missing-field
      // failures are not schedule problems → no alternate-time list.
      var scheduleFail = availability.key !== 'service_area_out_of_range' &&
        availability.key !== 'required_fields' && availability.key !== 'service_missing';
      var suggested = [];
      if (scheduleFail && typeof BOOKING.findNextAvailableSlots === 'function' && trim(state.serviceId)) {
        try {
          suggested = BOOKING.findNextAvailableSlots(vendor.id, state.serviceId, { start: draft.requestedDate }, {
            vendor: vendor,
            services: services,
            availability: ctx.availability || DATA.sampleAvailability,
            existingBookings: ctx.existingBookings || [],
            unavailableBlocks: ctx.unavailableBlocks || [],
            now: ctx.now,
            limit: 3
          }) || [];
        } catch (e) { suggested = []; }
      }
      if (suggested.length) {
        var slotText = suggested.map(function(s) {
          var t = BOOKING.formatTime12Hour ? BOOKING.formatTime12Hour(s.startTime) : s.startTime;
          return s.requestedDate + ' ' + t;
        }).join('; ');
        failReason += ' Offer these next available times and ask the customer to pick one: ' + slotText + '.';
      }
      session.lastSystemContext = failReason;
      logScheduleCheck(session, vendor, draft, availability, suggested);

      // Deterministic fallback (used only when the AI brain is unavailable): an
      // out-of-area address gets the area-specific line; everything else gets
      // the generic "pick another time" line.
      var detReply = availability.key === 'service_area_out_of_range'
        ? reply(lang, 'outOfArea')
        : reply(lang, 'unavailable');
      return { session: session, response: detReply };
    }

    // Out-of-area + review-required quotes still need one round of explicit
    // confirmation because the price might shift; those keep the legacy gate.
    // Otherwise: ALL slots present + availability OK → auto-submit. The
    // customer never has to say "yes" / "ok" again. This eliminates the
    // confirmation loop the nail-agent flow already avoided.
    var requiresExplicitConfirm = !!availability.reviewRequired;
    if (requiresExplicitConfirm && (!affirmative || state.pendingAction !== 'final_confirmation')) {
      state.pendingAction = 'final_confirmation';
      state.step = 'CONFIRM_SUMMARY';
      session.lastAvailabilityResult = availability;
      session.lastSystemContext = systemReason('booking_summary_ready', { status: availability.status, total: availability.price.totalPrice });
      var summaryText = reply(lang, 'summary', {
        service: availability.service.name,
        date: draft.requestedDate,
        time: BOOKING.formatTime12Hour ? BOOKING.formatTime12Hour(draft.startTime) : draft.startTime,
        address: draft.address,
        city: draft.city,
        zip: draft.zip,
        price: money(availability.price.totalPrice),
        zellePhone: vendor.zellePhone || vendor.phone || '',
        paymentMethod: state.paymentMethod || 'cash'
      });
      return {
        session: session,
        response: reply(lang, 'outOfArea') + ' ' + summaryText
      };
    }

    // Schedule cleared → log the green-light snapshot before writing.
    logScheduleCheck(session, vendor, draft, availability, []);

    // Routing + customer-memory audit trail stamped onto the booking doc so the
    // vendor portal can see which barber the request was routed to and why.
    var routedReason = trim(ctx.routingReason) ||
      ('address_match ' + trim((state.city || '') + ' ' + (state.zip || '')) + ' -> ' + (vendor.id || ''));
    var record = state.customerRecord || {};
    var prefSnapshot = {
      preferredBarber: state.barberPreference || record.preferredBarber || '',
      lastServiceId: record.lastServiceId || state.previousServiceId || '',
      lastServiceName: record.lastServiceName || state.previousServiceName || '',
      notes: state.notes || ''
    };
    var schedSnapshot = {
      key: availability.key,
      date: draft.requestedDate,
      startTime: draft.startTime,
      endTime: availability.timing && availability.timing.endTime,
      quoteType: availability.price && availability.price.quoteType
    };
    var built = BOOKING.buildBooking({
      vendor: vendor,
      draft: draft,
      availabilityResult: availability,
      id: ctx.id,
      now: ctx.nowIso,
      meta: {
        routingReason: routedReason,
        previousCustomerMatched: state.customerLookupStatus === 'found',
        customerPreferenceSnapshot: prefSnapshot,
        scheduleCheckSnapshot: schedSnapshot
      }
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
    // Long-distance / low-profitability quotes (quoteType === 'vendor_review')
    // need the barber to personally confirm the travel quote → mark the booking
    // vendor_review so it lands in the barber's review queue, not as a normal
    // pending request. The save-time conflict guard can also elevate to
    // vendor_review independently; that path is unaffected.
    var needsVendorReview = !!(availability.price && availability.price.quoteType === 'vendor_review');
    if (needsVendorReview) built.booking.status = 'vendor_review';
    state.pendingAction = null;
    state.step = 'DONE';
    session.lastAvailabilityResult = availability;
    session.lastBooking = built.booking;
    logBookingWrite(session, built.booking);
    session.lastSystemContext = needsVendorReview
      ? systemReason('booking_vendor_review', { id: built.booking.id })
      : systemReason('booking_created', { id: built.booking.id, status: built.booking.status });
    var barberDisplay = (vendor.barberName || vendor.businessName || '').trim() || 'the barber';
    // When a vendor promo is applied, prepend a natural acknowledgement so
    // the customer sees the discount called out in the saved confirmation.
    var savedReply = reply(lang, 'saved', {
      id: built.booking.id,
      zellePhone: built.booking.zellePhone || vendor.phone || '',
      barber: barberDisplay,
      service: availability.service.name,
      date: draft.requestedDate,
      time: BOOKING.formatTime12Hour ? BOOKING.formatTime12Hour(draft.startTime) : draft.startTime,
      price: money(availability.price.totalPrice)
    });
    if (availability.price && availability.price.promoApplied && Number(availability.price.discountPercent || 0) > 0) {
      var promoLine = reply(lang, 'promoApplied', {
        pct: Number(availability.price.discountPercent || 0),
        name: availability.price.promotionName || '',
        original: money(availability.price.originalPrice || availability.price.totalPrice),
        discounted: money(availability.price.discountedPrice || availability.price.totalPrice)
      });
      if (promoLine) savedReply = promoLine + '\n\n' + savedReply;
    }
    return {
      session: session,
      response: savedReply,
      booking: built.booking
    };
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
    if (first && first.needsCustomerLookup && typeof ctx.customerLookupProvider === 'function') {
      var phone = first.session && first.session.state && first.session.state.phone;
      return Promise.resolve(ctx.customerLookupProvider(phone, first.session.state))
        .then(function(record) {
          var nextCtx = Object.assign({}, ctx, { customerLookupResult: record || null });
          var second = handleMessage(first.session, '', nextCtx);
          // AI brain reacts to the post-lookup state (new vs existing customer).
          second.systemContextForAI = record
            ? 'customer_lookup_hit'
            : 'customer_lookup_miss';
          return _runAIBrain(second.session, '', nextCtx, second);
        })
        .catch(function() {
          var nextCtx = Object.assign({}, ctx, { customerLookupResult: null });
          var second = handleMessage(first.session, '', nextCtx);
          second.systemContextForAI = 'customer_lookup_error';
          return _runAIBrain(second.session, '', nextCtx, second);
        });
    }
    return _runAIBrain(first && first.session, message, ctx, first);
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
    buildAIBrainPrompt: _buildAIBrainPrompt,
    parseStateMarker: _parseStateMarker,
    stripMarkers: _stripMarkers,
    handleMessage: handleMessage,
    handleMessageAsync: handleMessageAsync,
    serviceBookingAgentBrain: serviceBookingAgentBrain,
    initialPrompt: initialPrompt,
    missingFields: missingFields,
    draftFromState: draftFromState,
    _systemReason: systemReason
  };
});
