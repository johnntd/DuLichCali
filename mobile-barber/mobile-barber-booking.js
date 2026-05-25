'use strict';
/*
 * Mobile Barber Phase 4 manual booking logic.
 * Pure validation stays isolated so tests can prove availability rules without Firestore writes.
 */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./mobile-barber-data'), root);
  } else {
    root.MobileBarberBooking = factory(root.MobileBarberData, root);
  }
})(typeof window !== 'undefined' ? window : globalThis, function(DATA, root) {
  var ACTIVE_BOOKING_STATUSES = ['pending_barber_confirmation', 'pending_confirmation', 'confirmed', 'vendor_review'];
  var PENDING_STATUS = 'pending_barber_confirmation';
  var STATUS_ALIASES = {
    pending_confirmation: 'pending_barber_confirmation',
    vendor_review: 'pending_barber_confirmation',
    pending: 'pending_barber_confirmation'
  };
  var STATUS_LIFECYCLE = ['pending_barber_confirmation', 'confirmed', 'declined', 'completed', 'cancelled'];
  var DEFAULT_SLOT_STEP_MINUTES = 30;
  var DEFAULT_SAME_DAY_CUTOFF_MINUTES = 120;

  function trim(value) {
    return String(value == null ? '' : value).trim();
  }

  function lower(value) {
    return trim(value).toLowerCase();
  }

  function digits(value) {
    return trim(value).replace(/\D/g, '');
  }

  function normalizePhone(value) {
    return digits(value);
  }

  function hasText(value) {
    return trim(value).length > 0;
  }

  function normalizeBookingStatus(status) {
    status = trim(status);
    if (STATUS_ALIASES[status]) return STATUS_ALIASES[status];
    return STATUS_LIFECYCLE.indexOf(status) >= 0 ? status : PENDING_STATUS;
  }

  function normalizePaymentMethod(method) {
    method = lower(method);
    return ['cash', 'zelle', 'unknown'].indexOf(method) >= 0 ? method : 'unknown';
  }

  function normalizePaymentStatus(status) {
    status = lower(status);
    return ['unpaid', 'pending', 'paid', 'waived'].indexOf(status) >= 0 ? status : 'unpaid';
  }

  function findService(services, serviceId) {
    services = services || [];
    for (var i = 0; i < services.length; i++) {
      if (services[i].id === serviceId && services[i].active !== false) return services[i];
    }
    return null;
  }

  function findVendor(vendorId, vendors) {
    vendors = vendors || (DATA && DATA.sampleVendors) || [];
    for (var i = 0; i < vendors.length; i++) {
      if (vendors[i].id === vendorId) return vendors[i];
    }
    return null;
  }

  function findAvailability(availabilityRows, vendorId) {
    availabilityRows = availabilityRows || [];
    for (var i = 0; i < availabilityRows.length; i++) {
      if (availabilityRows[i].vendorId === vendorId) return availabilityRows[i];
    }
    return null;
  }

  function parseDateParts(dateStr) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trim(dateStr));
    if (!match) return null;
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3])
    };
  }

  function dateStringFromDate(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return '';
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function timeStringFromDate(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return '';
    return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
  }

  function dayKey(dateStr) {
    var parts = parseDateParts(dateStr);
    if (!parts) return '';
    var date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    if (date.getUTCFullYear() !== parts.year || date.getUTCMonth() !== parts.month - 1 || date.getUTCDate() !== parts.day) return '';
    return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getUTCDay()];
  }

  function minutesFromTime(timeStr) {
    var match = /^(\d{1,2}):(\d{2})$/.exec(trim(timeStr));
    if (!match) return null;
    var hour = Number(match[1]);
    var minute = Number(match[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return hour * 60 + minute;
  }

  function timeFromMinutes(total) {
    var hour = Math.floor(total / 60);
    var minute = total % 60;
    return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
  }

  function parseRequestedTime(value) {
    if (value instanceof Date) {
      return { date: dateStringFromDate(value), time: timeStringFromDate(value), minutes: value.getHours() * 60 + value.getMinutes(), raw: value };
    }
    if (typeof value === 'string') {
      var text = trim(value);
      var iso = /^(\d{4}-\d{2}-\d{2})[T\s](\d{1,2}:\d{2})/.exec(text);
      if (iso) return { date: iso[1], time: iso[2], minutes: minutesFromTime(iso[2]), raw: value };
      if (/^\d{1,2}:\d{2}$/.test(text)) return { date: '', time: text, minutes: minutesFromTime(text), raw: value };
    }
    if (value && typeof value === 'object') {
      var time = value.startTime || value.time || value.requestedTime || '';
      return { date: value.requestedDate || value.date || '', time: time, minutes: minutesFromTime(time), raw: value };
    }
    return { date: '', time: '', minutes: null, raw: value };
  }

  function rangesOverlap(startA, endA, startB, endB) {
    return startA < endB && endA > startB;
  }

  function validateRequiredFields(draft) {
    var errors = [];
    draft = draft || {};
    [
      ['customerName', 'missing_name'],
      ['customerPhone', 'missing_phone'],
      ['serviceId', 'missing_service'],
      ['requestedDate', 'missing_date'],
      ['startTime', 'missing_time'],
      ['address', 'missing_address'],
      ['city', 'missing_city'],
      ['zip', 'missing_zip']
    ].forEach(function(pair) {
      if (!hasText(draft[pair[0]])) errors.push(pair[1]);
    });
    if (hasText(draft.customerPhone) && digits(draft.customerPhone).length < 7) errors.push('invalid_phone');
    if (hasText(draft.requestedDate) && !dayKey(draft.requestedDate)) errors.push('invalid_date');
    if (hasText(draft.startTime) && minutesFromTime(draft.startTime) == null) errors.push('invalid_time');
    return errors;
  }

  function isWithinServiceArea(vendor, address) {
    var areas = vendor && Array.isArray(vendor.serviceAreas) ? vendor.serviceAreas : [];
    var city = lower(address && address.city);
    var zip = trim(address && address.zip);
    var cityAllowed = areas.some(function(area) { return lower(area) === city; });
    var zipAllowed = ['serviceZips', 'serviceAreaZips', 'zipCodes'].some(function(field) {
      return Array.isArray(vendor && vendor[field]) && vendor[field].indexOf(zip) >= 0;
    });
    return !!(cityAllowed || zipAllowed);
  }

  function validateServiceArea(vendor, draft) {
    if (isWithinServiceArea(vendor, draft)) return { valid: true, reviewRequired: false, key: 'service_area_ok' };
    return { valid: false, canCreate: false, reviewRequired: false, key: 'service_area_out_of_range' };
  }

  function findVendorForAddress(address, options) {
    options = options || {};
    var allVendors = Array.isArray(options.vendors) && options.vendors.length
      ? options.vendors
      : (root.MobileBarberData && Array.isArray(root.MobileBarberData.sampleVendors) ? root.MobileBarberData.sampleVendors : []);
    if (!address || !allVendors.length) return null;
    var candidates = [];
    for (var i = 0; i < allVendors.length; i++) {
      var v = allVendors[i];
      if (options.excludeVendorId && v && v.id === options.excludeVendorId) continue;
      if (isWithinServiceArea(v, address)) candidates.push(v);
    }
    if (!candidates.length) return null;
    candidates.sort(function(a, b) {
      return vendorRoutingScore(b) - vendorRoutingScore(a);
    });
    return candidates[0];
  }

  function vendorRoutingScore(vendor) {
    var score = 0;
    if (!vendor || vendor.active === false) return -1000;
    if (vendor.region) score += 4;
    if (Array.isArray(vendor.zipCoverage) && vendor.zipCoverage.length) score += 3;
    if (Array.isArray(vendor.travelFeeTiers) && vendor.travelFeeTiers.length) score += 2;
    if (vendor.bio) score += 1;
    return score;
  }

  function calculateAppointmentWindow(service, requestedTime, vendor) {
    var parsed = parseRequestedTime(requestedTime);
    var start = parsed.minutes;
    var serviceMinutes = Number(service.durationMinutes || 0);
    var cleanupMinutes = Number(service.cleanupBufferMinutes || 0);
    var travelMinutes = Number(service.travelBufferMinutes != null ? service.travelBufferMinutes : (vendor && vendor.travelBufferMinutes) || 0);
    var totalMinutes = serviceMinutes + cleanupMinutes + travelMinutes;
    return {
      requestedDate: parsed.date,
      startTime: parsed.time,
      startMinutes: start,
      endMinutes: start == null ? null : start + totalMinutes,
      serviceMinutes: serviceMinutes,
      cleanupMinutes: cleanupMinutes,
      travelMinutes: travelMinutes,
      totalMinutes: totalMinutes,
      endTime: start == null ? '' : timeFromMinutes(start + totalMinutes)
    };
  }

  function calculateTiming(service, draft, vendor) {
    return calculateAppointmentWindow(service, draft, vendor);
  }

  function checkWeeklyAvailability(availability, draft, timing) {
    if (!availability || !availability.weeklyHours) {
      return { valid: false, key: 'availability_missing' };
    }
    if (Array.isArray(availability.blackoutDates) && availability.blackoutDates.indexOf(draft.requestedDate) >= 0) {
      return { valid: false, key: 'blackout_date' };
    }
    var day = dayKey(draft.requestedDate);
    var row = day && availability.weeklyHours[day];
    if (!row || !row.active) return { valid: false, key: 'closed_day' };
    var open = minutesFromTime(row.start);
    var close = minutesFromTime(row.end);
    if (open == null || close == null) return { valid: false, key: 'invalid_hours' };
    if (timing.startMinutes < open || timing.endMinutes > close) {
      return { valid: false, key: 'outside_hours' };
    }
    return { valid: true, key: 'hours_ok' };
  }

  function checkUnavailableBlocks(vendorId, draft, timing, unavailableBlocks) {
    unavailableBlocks = unavailableBlocks || [];
    for (var i = 0; i < unavailableBlocks.length; i++) {
      var block = unavailableBlocks[i] || {};
      if (block.vendorId && block.vendorId !== vendorId) continue;
      if ((block.date || block.requestedDate) !== draft.requestedDate) continue;
      var start = minutesFromTime(block.startTime || block.start);
      var end = minutesFromTime(block.endTime || block.end);
      if (start == null || end == null) continue;
      if (rangesOverlap(timing.startMinutes, timing.endMinutes, start, end)) {
        return { valid: false, key: 'unavailable_block', blockId: block.id || '' };
      }
    }
    return { valid: true, key: 'no_block' };
  }

  function checkSameDayCutoff(vendor, draft, timing, now) {
    now = now instanceof Date ? now : new Date();
    if (isNaN(now.getTime())) return { valid: true, key: 'cutoff_skipped' };
    var cutoff = Number(vendor && vendor.sameDayCutoffMinutes != null ? vendor.sameDayCutoffMinutes : DEFAULT_SAME_DAY_CUTOFF_MINUTES);
    if (cutoff <= 0) return { valid: true, key: 'cutoff_disabled' };
    if (draft.requestedDate !== dateStringFromDate(now)) return { valid: true, key: 'cutoff_not_same_day' };
    var requested = timing.startMinutes;
    var current = now.getHours() * 60 + now.getMinutes();
    if (requested - current < cutoff) return { valid: false, key: 'same_day_cutoff' };
    return { valid: true, key: 'cutoff_ok' };
  }

  function checkBookingOverlap(vendorId, draft, timing, existingBookings) {
    existingBookings = existingBookings || [];
    for (var i = 0; i < existingBookings.length; i++) {
      var booking = existingBookings[i] || {};
      if (booking.vendorId !== vendorId) continue;
      if (booking.requestedDate !== draft.requestedDate) continue;
      if (ACTIVE_BOOKING_STATUSES.indexOf(booking.status) < 0) continue;
      var start = minutesFromTime(booking.startTime);
      var end = minutesFromTime(booking.endTime);
      if (start == null || end == null) continue;
      if (rangesOverlap(timing.startMinutes, timing.endMinutes, start, end)) {
        return { valid: false, key: 'booking_overlap', bookingId: booking.id || booking.bookingId || '' };
      }
    }
    return { valid: true, key: 'no_overlap' };
  }

  function calculateMobileBarberPrice(vendor, service, address) {
    var base = Number(service.price || 0);
    var travel = Number(vendor && vendor.baseTravelFee || 0);
    var distanceFee = 0;
    if (address && isFinite(Number(address.distanceMiles)) && vendor && isFinite(Number(vendor.pricePerTravelMile))) {
      distanceFee = Math.max(0, Number(address.distanceMiles)) * Math.max(0, Number(vendor.pricePerTravelMile));
    }
    return {
      servicePrice: base,
      travelFee: travel,
      distanceFee: distanceFee,
      totalPrice: base + travel + distanceFee,
      reviewRequired: !isWithinServiceArea(vendor, address || {})
    };
  }

  function estimatePrice(vendor, service, areaResult, address) {
    var price = calculateMobileBarberPrice(vendor, service, address);
    price.reviewRequired = !!(areaResult && areaResult.reviewRequired);
    return price;
  }

  function checkWindowAvailability(vendor, availabilityRows, existingBookings, unavailableBlocks, draft, timing, now) {
    var availability = findAvailability(availabilityRows, vendor.id);
    var cutoffResult = checkSameDayCutoff(vendor, draft, timing, now);
    if (!cutoffResult.valid) return cutoffResult;
    var weeklyResult = checkWeeklyAvailability(availability, draft, timing);
    if (!weeklyResult.valid) return weeklyResult;
    var blockResult = checkUnavailableBlocks(vendor.id, draft, timing, unavailableBlocks);
    if (!blockResult.valid) return blockResult;
    return checkBookingOverlap(vendor.id, draft, timing, existingBookings);
  }

  function checkMobileBarberAvailability(vendorId, start, end, opts) {
    opts = opts || {};
    var vendor = opts.vendor || findVendor(vendorId, opts.vendors);
    if (!vendor) return { available: false, key: 'missing_vendor', errors: ['missing_vendor'] };
    var parsedStart = parseRequestedTime(start);
    var parsedEnd = parseRequestedTime(end);
    var date = parsedStart.date || opts.requestedDate || '';
    var timing = {
      startMinutes: parsedStart.minutes,
      endMinutes: parsedEnd.minutes,
      endTime: parsedEnd.time,
      totalMinutes: parsedStart.minutes == null || parsedEnd.minutes == null ? 0 : parsedEnd.minutes - parsedStart.minutes
    };
    if (!date || timing.startMinutes == null || timing.endMinutes == null || timing.endMinutes <= timing.startMinutes) {
      return { available: false, key: 'invalid_window', errors: ['invalid_window'] };
    }
    var draft = { requestedDate: date, startTime: parsedStart.time };
    var result = checkWindowAvailability(
      vendor,
      opts.availability || (DATA && DATA.sampleAvailability) || [],
      opts.existingBookings || [],
      opts.unavailableBlocks || [],
      draft,
      timing,
      opts.now
    );
    return {
      available: result.valid,
      key: result.key,
      errors: result.valid ? [] : [result.key],
      timing: timing
    };
  }

  function addDays(date, days) {
    var copy = new Date(date.getTime());
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  function normalizeDateRange(dateRange, now) {
    now = now instanceof Date ? now : new Date();
    dateRange = dateRange || {};
    var start = dateRange.start || dateRange.from || dateRange.startDate;
    var end = dateRange.end || dateRange.to || dateRange.endDate;
    var startDate = start ? new Date(start + 'T00:00:00') : now;
    var endDate = end ? new Date(end + 'T00:00:00') : addDays(startDate, 7);
    return { start: startDate, end: endDate };
  }

  function findNextAvailableSlots(vendorId, serviceId, dateRange, opts) {
    opts = opts || {};
    var vendor = opts.vendor || findVendor(vendorId, opts.vendors);
    var services = opts.services || (DATA && DATA.sampleServices) || [];
    var service = opts.service || findService(services, serviceId);
    if (!vendor || !service) return [];
    var availabilityRows = opts.availability || (DATA && DATA.sampleAvailability) || [];
    var availability = findAvailability(availabilityRows, vendor.id);
    if (!availability || !availability.weeklyHours) return [];
    var range = normalizeDateRange(dateRange, opts.now);
    var limit = Number(opts.limit || 5);
    var step = Number(opts.stepMinutes || DEFAULT_SLOT_STEP_MINUTES);
    var slots = [];
    for (var cursor = new Date(range.start.getTime()); cursor <= range.end && slots.length < limit; cursor = addDays(cursor, 1)) {
      var dateStr = dateStringFromDate(cursor);
      var row = availability.weeklyHours[dayKey(dateStr)];
      if (!row || !row.active) continue;
      var open = minutesFromTime(row.start);
      var close = minutesFromTime(row.end);
      if (open == null || close == null) continue;
      for (var minute = open; minute < close && slots.length < limit; minute += step) {
        var draft = { requestedDate: dateStr, startTime: timeFromMinutes(minute) };
        var timing = calculateTiming(service, draft, vendor);
        var result = checkWindowAvailability(
          vendor,
          availabilityRows,
          opts.existingBookings || [],
          opts.unavailableBlocks || [],
          draft,
          timing,
          opts.now
        );
        if (result.valid) {
          slots.push({ vendorId: vendor.id, serviceId: service.id, requestedDate: dateStr, startTime: draft.startTime, endTime: timing.endTime });
        }
      }
    }
    return slots;
  }

  function checkAvailability(input) {
    input = input || {};
    var vendor = input.vendor;
    var draft = input.draft || {};
    var services = input.services || (DATA && DATA.sampleServices) || [];
    var availabilityRows = input.availability || (DATA && DATA.sampleAvailability) || [];
    var existingBookings = input.existingBookings || [];
    var unavailableBlocks = input.unavailableBlocks || [];
    var errors = validateRequiredFields(draft);

    if (!vendor) errors.push('missing_vendor');
    if (errors.length) return { valid: false, canCreate: false, key: 'required_fields', errors: errors };

    var areaResult = validateServiceArea(vendor, draft);
    if (!areaResult.valid) {
      return {
        valid: false,
        canCreate: false,
        key: areaResult.key,
        reviewRequired: false,
        errors: [areaResult.key],
        suggestedVendor: findVendorForAddress(draft, { excludeVendorId: vendor && vendor.id })
      };
    }
    var service = findService(services, draft.serviceId);
    if (!service) return { valid: false, canCreate: false, key: 'service_missing', errors: ['missing_service_duration'] };

    var timing = calculateTiming(service, draft, vendor);
    var windowResult = checkWindowAvailability(vendor, availabilityRows, existingBookings, unavailableBlocks, draft, timing, input.now);
    if (!windowResult.valid) {
      return { valid: false, canCreate: false, key: windowResult.key, errors: [windowResult.key], service: service, timing: timing };
    }

    var price = estimatePrice(vendor, service, areaResult, draft);
    return {
      valid: true,
      canCreate: true,
      key: areaResult.key,
      reviewRequired: areaResult.reviewRequired,
      status: PENDING_STATUS,
      service: service,
      timing: timing,
      price: price,
      errors: []
    };
  }

  function buildBooking(input) {
    input = input || {};
    var draft = input.draft || {};
    var check = input.availabilityResult;
    if (!check || !check.canCreate) {
      return { valid: false, errors: ['availability_check_required'] };
    }
    var now = input.now || new Date().toISOString();
    var id = input.id || ('mb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8));
    var servicePrice = Number(check.price.servicePrice || check.service.price || 0);
    var travelFee = Number(check.price.travelFee || 0) + Number(check.price.distanceFee || 0);
    var amountDue = Number(check.price.totalPrice != null ? check.price.totalPrice : (servicePrice + travelFee));
    var booking = {
      id: id,
      vendorId: input.vendor.id,
      customerName: trim(draft.customerName),
      customerPhone: digits(draft.customerPhone),
      customerEmail: trim(draft.customerEmail),
      smsOptIn: draft.smsOptIn === true || draft.smsOptIn === 'true',
      serviceId: check.service.id,
      serviceName: check.service.name,
      servicePrice: servicePrice,
      travelFee: travelFee,
      amountDue: amountDue,
      paymentMethod: normalizePaymentMethod(draft.paymentMethod),
      paymentStatus: normalizePaymentStatus(draft.paymentStatus),
      zellePhone: trim(draft.zellePhone) || trim(input.vendor.phone),
      paymentNote: trim(draft.paymentNote),
      address: trim(draft.address),
      city: trim(draft.city),
      zip: trim(draft.zip),
      requestedDate: trim(draft.requestedDate),
      startTime: trim(draft.startTime),
      endTime: check.timing.endTime,
      status: normalizeBookingStatus(check.status),
      source: 'customer_form',
      notes: trim(draft.notes),
      stylePreference: trim(draft.stylePreference),
      photoUrls: Array.isArray(draft.photoUrls) ? draft.photoUrls.slice() : [],
      aiConversationSummary: '',
      rebookedFromBookingId: trim(draft.rebookedFromBookingId),
      previousServiceName: trim(draft.previousServiceName),
      customerUid: trim(draft.customerUid),
      createdAt: now,
      updatedAt: now
    };
    var validationBooking = Object.assign({}, booking);
    delete validationBooking.smsOptIn;
    if (validationBooking.status === 'pending_barber_confirmation') {
      validationBooking.status = 'pending_confirmation';
    }
    var validation = DATA && DATA.validateBooking ? DATA.validateBooking(validationBooking) : { valid: true, errors: [] };
    return validation.valid ? { valid: true, booking: booking, errors: [] } : { valid: false, errors: validation.errors };
  }

  function canUseFirestore() {
    return typeof root.firebase !== 'undefined' && root.firebase.firestore && root.firebase.apps && root.firebase.apps.length;
  }

  function loadExistingBookings(vendorId) {
    if (!canUseFirestore()) return Promise.resolve([]);
    return root.firebase.firestore().collection(DATA.COLLECTIONS.bookings)
      .where('vendorId', '==', vendorId)
      .get()
      .then(function(snapshot) {
        var rows = [];
        snapshot.forEach(function(doc) {
          var data = doc.data() || {};
          data.id = data.id || doc.id;
          rows.push(data);
        });
        return rows;
      })
      .catch(function() { return []; });
  }

  function firstValue(data, keys) {
    data = data || {};
    for (var i = 0; i < keys.length; i++) {
      if (hasText(data[keys[i]])) return trim(data[keys[i]]);
    }
    return '';
  }

  function safeCustomerRecord(data, vendorId, phone) {
    data = data || {};
    var recPhone = normalizePhone(data.customerPhoneNormalized || data.phoneNormalized || data.normalizedPhone || data.customerPhone || data.phone);
    if (!recPhone || recPhone !== phone) return null;
    var recVendor = trim(data.vendorId || data.vendor_id);
    if (vendorId && recVendor && recVendor !== vendorId) return null;
    return {
      id: trim(data.id),
      vendorId: recVendor || vendorId || '',
      customerName: firstValue(data, ['customerName', 'name']),
      customerPhone: recPhone,
      customerEmail: firstValue(data, ['customerEmail', 'email']),
      address: firstValue(data, ['address', 'serviceAddress', 'lastAddress']),
      city: firstValue(data, ['city', 'serviceCity', 'lastCity']),
      zip: firstValue(data, ['zip', 'serviceZip', 'lastZip']),
      preferredBarber: firstValue(data, ['preferredBarber', 'barberPreference', 'barberName']),
      lastServiceId: firstValue(data, ['lastServiceId', 'serviceId']),
      lastServiceName: firstValue(data, ['lastServiceName', 'serviceName', 'previousServiceName']),
      lastBookingId: firstValue(data, ['lastBookingId', 'id', 'bookingId']),
      notes: firstValue(data, ['notes', 'safeNotes', 'stylePreference'])
    };
  }

  function recordMillis(record) {
    var value = record && (record.updatedAt || record.createdAt || record.requestedDate || record.date);
    if (!value) return 0;
    if (value.toMillis) return value.toMillis();
    var parsed = Date.parse(value);
    return isNaN(parsed) ? 0 : parsed;
  }

  function bestCustomerRecord(records, vendorId, phone) {
    var matches = (records || [])
      .map(function(record) {
        var data = typeof record.data === 'function' ? record.data() : record;
        if (data && record.id && !data.id) data.id = record.id;
        return data;
      })
      .filter(function(data) { return !!safeCustomerRecord(data, vendorId, phone); })
      .sort(function(a, b) { return recordMillis(b) - recordMillis(a); });
    return matches.length ? safeCustomerRecord(matches[0], vendorId, phone) : null;
  }

  function scanCollectionByPhone(collectionName, vendorId, phone) {
    if (!canUseFirestore()) return Promise.resolve([]);
    var db = root.firebase.firestore();
    var fields = ['customerPhoneNormalized', 'phoneNormalized', 'normalizedPhone', 'customerPhone', 'phone'];
    function queryField(index) {
      if (index >= fields.length) return db.collection(collectionName).get();
      return db.collection(collectionName).where(fields[index], '==', phone).get()
        .then(function(snapshot) {
          return snapshot && snapshot.docs && snapshot.docs.length ? snapshot : queryField(index + 1);
        })
        .catch(function() { return queryField(index + 1); });
    }
    return queryField(0).then(function(snapshot) {
      var rows = [];
      if (snapshot && snapshot.forEach) {
        snapshot.forEach(function(doc) {
          var data = doc.data() || {};
          data.id = data.id || doc.id;
          rows.push(data);
        });
      }
      return rows.filter(function(row) {
        return !!safeCustomerRecord(row, vendorId, phone);
      });
    }).catch(function() { return []; });
  }

  function lookupReturningCustomer(vendorId, phone, options) {
    options = options || {};
    var normalized = normalizePhone(phone);
    if (normalized.length === 11 && normalized.charAt(0) === '1') normalized = normalized.slice(1);
    if (!normalized) return Promise.resolve(null);
    if (options.records) return Promise.resolve(bestCustomerRecord(options.records, vendorId, normalized));

    var localRows = [];
    try {
      localRows = JSON.parse(root.localStorage.getItem('dlc_mobile_barber_bookings') || '[]');
    } catch (e) {}
    var localMatch = bestCustomerRecord(localRows, vendorId, normalized);

    if (!canUseFirestore()) return Promise.resolve(localMatch);

    return scanCollectionByPhone(DATA.COLLECTIONS.customers, vendorId, normalized)
      .then(function(customerRows) {
        var customerMatch = bestCustomerRecord(customerRows, vendorId, normalized);
        if (customerMatch) return customerMatch;
        return scanCollectionByPhone(DATA.COLLECTIONS.bookings, vendorId, normalized)
          .then(function(bookingRows) {
            return bestCustomerRecord(bookingRows, vendorId, normalized) || localMatch;
          });
      })
      .catch(function() { return localMatch; });
  }

  function bookingMatchesCustomer(booking, identity) {
    identity = identity || {};
    var phone = normalizePhone(identity.phone || identity.customerPhone);
    var uid = trim(identity.uid || identity.customerUid);
    if (uid && trim(booking.customerUid) && trim(booking.customerUid) === uid) return true;
    return !!(phone && normalizePhone(booking.customerPhone) === phone);
  }

  function filterCustomerBookings(bookings, vendorId, identity) {
    bookings = bookings || [];
    return bookings.filter(function(booking) {
      return booking && booking.vendorId === vendorId && bookingMatchesCustomer(booking, identity);
    }).sort(function(a, b) {
      return ((b.requestedDate || '') + (b.startTime || '')).localeCompare((a.requestedDate || '') + (a.startTime || ''));
    });
  }

  function splitCustomerBookingHistory(bookings, vendorId, identity, now) {
    now = now instanceof Date ? now : new Date();
    var today = dateStringFromDate(now);
    var currentMinutes = now.getHours() * 60 + now.getMinutes();
    var rows = filterCustomerBookings(bookings, vendorId, identity);
    var upcoming = [];
    var past = [];
    rows.forEach(function(booking) {
      var status = booking.status || '';
      var bookingMinutes = minutesFromTime(booking.startTime) || 0;
      var isPast = status === 'completed' || status === 'cancelled' ||
        booking.requestedDate < today ||
        (booking.requestedDate === today && bookingMinutes < currentMinutes);
      (isPast ? past : upcoming).push(booking);
    });
    return { upcoming: upcoming, past: past, all: rows };
  }

  function buildRebookDraft(booking, profile, overrides) {
    booking = booking || {};
    profile = profile || {};
    overrides = overrides || {};
    return Object.assign({
      customerName: trim(profile.customerName) || trim(booking.customerName),
      customerPhone: normalizePhone(profile.customerPhone || booking.customerPhone),
      customerEmail: trim(profile.customerEmail) || trim(booking.customerEmail),
      customerUid: trim(profile.customerUid) || trim(booking.customerUid),
      serviceId: trim(booking.serviceId),
      requestedDate: '',
      startTime: '',
      address: trim(booking.address),
      city: trim(booking.city),
      zip: trim(booking.zip),
      notes: trim(profile.notes) || trim(booking.notes),
      stylePreference: trim(profile.stylePreference) || trim(booking.stylePreference),
      photoUrls: Array.isArray(profile.photoUrls) && profile.photoUrls.length ? profile.photoUrls.slice() : [],
      rebookedFromBookingId: trim(booking.id),
      previousServiceName: trim(booking.serviceName)
    }, overrides);
  }

  function loadCustomerBookings(vendorId, identity) {
    identity = identity || {};
    var phone = normalizePhone(identity.phone || identity.customerPhone);
    var uid = trim(identity.uid || identity.customerUid);
    if (canUseFirestore()) {
      var query = root.firebase.firestore().collection(DATA.COLLECTIONS.bookings)
        .where('vendorId', '==', vendorId);
      if (uid) query = query.where('customerUid', '==', uid);
      else if (phone) query = query.where('customerPhone', '==', phone);
      else return Promise.resolve([]);
      return query.get().then(function(snapshot) {
        var rows = [];
        snapshot.forEach(function(doc) {
          var data = doc.data() || {};
          data.id = data.id || doc.id;
          rows.push(data);
        });
        return filterCustomerBookings(rows, vendorId, identity);
      }).catch(function() {
        return loadLocalCustomerBookings(vendorId, identity);
      });
    }
    return loadLocalCustomerBookings(vendorId, identity);
  }

  function loadLocalCustomerBookings(vendorId, identity) {
    try {
      var rows = JSON.parse(root.localStorage.getItem('dlc_mobile_barber_bookings') || '[]');
      return Promise.resolve(filterCustomerBookings(rows, vendorId, identity));
    } catch (e) {
      return Promise.resolve([]);
    }
  }

  function saveBookingLocal(booking) {
    var key = 'dlc_mobile_barber_bookings';
    var existing = JSON.parse(root.localStorage.getItem(key) || '[]');
    existing.push(booking);
    root.localStorage.setItem(key, JSON.stringify(existing));
    return { saved: true, source: 'local', method: 'local', booking: booking };
  }

  function saveBooking(booking, options) {
    options = options || {};
    if (canUseFirestore()) {
      return root.firebase.firestore().collection(DATA.COLLECTIONS.bookings).doc(booking.id).set(booking)
        .then(function() { return { saved: true, source: 'firestore', method: 'firestore', booking: booking }; })
        .catch(function(error) {
          if (options.requireDatabase) return Promise.reject(error);
          return saveBookingLocal(booking);
        });
    }
    if (options.requireDatabase) return Promise.reject(new Error('firestore_unavailable'));
    try {
      return Promise.resolve(saveBookingLocal(booking));
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function withPaymentDefaults(booking, vendor) {
    booking = Object.assign({}, booking || {});
    var servicePrice = Number(booking.servicePrice || 0);
    var travelFee = Number(booking.travelFee || 0);
    var legacyTotal = servicePrice && !travelFee && !booking.amountDue ? servicePrice : null;
    booking.paymentMethod = normalizePaymentMethod(booking.paymentMethod);
    booking.paymentStatus = normalizePaymentStatus(booking.paymentStatus);
    booking.zellePhone = trim(booking.zellePhone) || trim(vendor && vendor.phone);
    booking.servicePrice = servicePrice;
    booking.travelFee = travelFee;
    booking.amountDue = Number(booking.amountDue != null ? booking.amountDue : (legacyTotal != null ? legacyTotal : servicePrice + travelFee));
    booking.paymentNote = trim(booking.paymentNote);
    return booking;
  }

  function updateBookingPayment(bookingId, patch, options) {
    options = options || {};
    patch = patch || {};
    if (!bookingId) return Promise.reject(new Error('missing_booking_id'));
    var update = { updatedAt: options.now || new Date().toISOString() };
    if (patch.paymentMethod != null) update.paymentMethod = normalizePaymentMethod(patch.paymentMethod);
    if (patch.paymentStatus != null) update.paymentStatus = normalizePaymentStatus(patch.paymentStatus);
    if (patch.paymentNote != null) update.paymentNote = trim(patch.paymentNote);
    if (patch.zellePhone != null) update.zellePhone = trim(patch.zellePhone);
    if (!canUseFirestore()) return Promise.reject(new Error('firestore_unavailable'));
    return root.firebase.firestore().collection(DATA.COLLECTIONS.bookings).doc(bookingId).set(update, { merge: true }).then(function() {
      return { saved: true, bookingId: bookingId, update: update };
    });
  }

  function updateBookingStatus(bookingId, status, options) {
    options = options || {};
    var normalized = normalizeBookingStatus(status);
    if (!bookingId) return Promise.reject(new Error('missing_booking_id'));
    if (STATUS_LIFECYCLE.indexOf(normalized) < 0) return Promise.reject(new Error('invalid_booking_status'));
    if (!canUseFirestore()) return Promise.reject(new Error('firestore_unavailable'));
    return root.firebase.firestore().collection(DATA.COLLECTIONS.bookings).doc(bookingId).set({
      status: normalized,
      updatedAt: options.now || new Date().toISOString()
    }, { merge: true }).then(function() {
      return { saved: true, bookingId: bookingId, status: normalized };
    });
  }

  return {
    ACTIVE_BOOKING_STATUSES: ACTIVE_BOOKING_STATUSES,
    STATUS_LIFECYCLE: STATUS_LIFECYCLE,
    normalizeBookingStatus: normalizeBookingStatus,
    normalizePaymentMethod: normalizePaymentMethod,
    normalizePaymentStatus: normalizePaymentStatus,
    withPaymentDefaults: withPaymentDefaults,
    normalizePhone: normalizePhone,
    validateRequiredFields: validateRequiredFields,
    isWithinServiceArea: isWithinServiceArea,
    validateServiceArea: validateServiceArea,
    findVendorForAddress: findVendorForAddress,
    calculateAppointmentWindow: calculateAppointmentWindow,
    checkMobileBarberAvailability: checkMobileBarberAvailability,
    findNextAvailableSlots: findNextAvailableSlots,
    calculateMobileBarberPrice: calculateMobileBarberPrice,
    calculateTiming: calculateTiming,
    checkUnavailableBlocks: checkUnavailableBlocks,
    checkSameDayCutoff: checkSameDayCutoff,
    checkBookingOverlap: checkBookingOverlap,
    checkAvailability: checkAvailability,
    buildBooking: buildBooking,
    buildRebookDraft: buildRebookDraft,
    filterCustomerBookings: filterCustomerBookings,
    splitCustomerBookingHistory: splitCustomerBookingHistory,
    lookupReturningCustomer: lookupReturningCustomer,
    loadCustomerBookings: loadCustomerBookings,
    loadExistingBookings: loadExistingBookings,
    saveBooking: saveBooking,
    updateBookingStatus: updateBookingStatus,
    updateBookingPayment: updateBookingPayment,
    _minutesFromTime: minutesFromTime,
    _rangesOverlap: rangesOverlap
  };
});
