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
  var ACTIVE_BOOKING_STATUSES = ['pending', 'pending_barber_confirmation', 'pending_confirmation', 'confirmed', 'in_progress', 'traveling', 'vendor_review'];
  var PENDING_STATUS = 'pending_barber_confirmation';
  var STATUS_ALIASES = {
    pending_confirmation: 'pending_barber_confirmation',
    pending: 'pending_barber_confirmation'
  };
  var STATUS_LIFECYCLE = ['pending_barber_confirmation', 'vendor_review', 'confirmed', 'in_progress', 'traveling', 'declined', 'completed', 'cancelled'];
  var DEFAULT_SLOT_STEP_MINUTES = 30;
  var DEFAULT_SAME_DAY_CUTOFF_MINUTES = 120;
  var DEFAULT_PRICING = {
    wearRatePerMile: 0.67,
    freeTravelMiles: 5,
    customQuoteMiles: 20,
    minimumMobileVisitPrice: 50,
    minimumHourlyTarget: 35
  };

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

  function stableHash(value) {
    value = trim(value);
    var hash = 0;
    for (var i = 0; i < value.length; i++) {
      hash = ((hash << 5) - hash) + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  function bookingRequestKey(vendor, draft, serviceId) {
    draft = draft || {};
    var explicit = trim(draft.bookingRequestId || draft.idempotencyKey || draft.requestId);
    if (explicit) return explicit.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
    var raw = [
      normalizePhone(draft.customerPhone),
      trim(vendor && vendor.id),
      trim(serviceId || draft.serviceId),
      trim(draft.requestedDate),
      trim(draft.startTime)
    ].join('|').toLowerCase();
    return stableHash(raw);
  }

  function hasText(value) {
    return trim(value).length > 0;
  }

  function safeLog(tag, payload) {
    if (typeof console === 'undefined' || !console.log) return;
    try { console.log(tag, JSON.stringify(payload || {})); } catch (e) {}
  }

  function normalizeBookingStatus(status) {
    status = trim(status);
    if (STATUS_ALIASES[status]) return STATUS_ALIASES[status];
    return STATUS_LIFECYCLE.indexOf(status) >= 0 ? status : PENDING_STATUS;
  }

  function normalizePaymentMethod(method) {
    method = lower(method);
    return ['cash', 'zelle', 'unknown'].indexOf(method) >= 0 ? method : 'cash';
  }

  function normalizePaymentStatus(status) {
    status = lower(status);
    return ['unpaid', 'payment_requested', 'pending', 'paid', 'waived'].indexOf(status) >= 0 ? status : 'unpaid';
  }

  // Customer confirmation channel preference. Defaults to 'text' so every
  // booking has a deterministic value the vendor portal can render against.
  function normalizeConfirmationPreference(pref) {
    var supported = (DATA && DATA.CONFIRMATION_PREFERENCES) || ['call', 'text', 'app'];
    var def = (DATA && DATA.DEFAULT_CONFIRMATION_PREFERENCE) || 'text';
    var v = lower(pref);
    return supported.indexOf(v) >= 0 ? v : def;
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

  function minutesToTime(total) {
    total = Number(total);
    if (!isFinite(total)) return '';
    var h = Math.floor(total / 60);
    var m = total % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
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

  function formatTime12Hour(dateOrTime) {
    var parsed = parseRequestedTime(dateOrTime);
    var mins = parsed.minutes;
    if (mins == null && typeof dateOrTime === 'string') mins = minutesFromTime(dateOrTime);
    if (mins == null) return trim(dateOrTime);
    var hour = Math.floor(mins / 60) % 24;
    var minute = mins % 60;
    var suffix = hour >= 12 ? 'PM' : 'AM';
    var displayHour = hour % 12;
    if (displayHour === 0) displayHour = 12;
    return displayHour + ':' + String(minute).padStart(2, '0') + ' ' + suffix;
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
    if (!address || !allVendors.length) {
      safeLog('[booking-route]', {
        address: address && address.address || '',
        city: address && address.city || '',
        zip: address && address.zip || '',
        assignedVendorId: null,
        reason: 'missing_address_or_vendors'
      });
      return null;
    }
    var candidates = [];
    for (var i = 0; i < allVendors.length; i++) {
      var v = allVendors[i];
      // NOTE: do NOT filter by status here. The vendor list passed in is already
      // the live ACTIVE set (resolved upstream by serviceAreas). A status gate at
      // this layer wrongly dropped live vendors (their docs carry an adminStatus
      // that isn't the literal 'active'), so findVendorForAddress returned null
      // and broke page-init routing + the AI preview. Keep this loop status-free.
      if (options.excludeVendorId && v && v.id === options.excludeVendorId) continue;
      if (isWithinServiceArea(v, address)) candidates.push(v);
    }
    if (!candidates.length) {
      safeLog('[booking-route]', {
        address: address.address || '',
        city: address.city || '',
        zip: address.zip || '',
        assignedVendorId: null,
        reason: hasText(address.city) || hasText(address.zip) ? 'outside_service_area' : 'ambiguous_location'
      });
      return null;
    }
    candidates.sort(function(a, b) {
      return vendorRoutingScore(b) - vendorRoutingScore(a);
    });
    safeLog('[booking-route]', {
      address: address.address || '',
      city: address.city || '',
      zip: address.zip || '',
      assignedVendorId: candidates[0].id,
      reason: 'service_area_match'
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
    if (root.BookingGuard && root.BookingGuard._evaluate) {
      // Synchronous pre-validation only. saveBooking() remains the authoritative
      // atomic check because it uses BookingGuard.guardedWrite().
      var ownerId = trim(draft.ownerId || (root.OwnerModel && root.OwnerModel.ownerForBusiness ? root.OwnerModel.ownerForBusiness(vendorId) : ''));
      var guarded = root.BookingGuard._evaluate({
        ownerId: ownerId || 'vendor:' + vendorId,
        serviceType: 'barber',
        vendorId: vendorId,
        customerPhone: draft.customerPhone,
        customerName: draft.customerName,
        customerUid: draft.customerUid,
        customerEmail: draft.customerEmail,
        requestedDate: draft.requestedDate,
        startTime: minutesToTime(timing.startMinutes),
        endTime: minutesToTime(timing.endMinutes),
        city: draft.city,
        zip: draft.zip,
        serviceAddress: draft.address,
        source: 'barber_overlap_check'
      }, existingBookings, { origin: { city: draft.city, zip: draft.zip } });
      if (guarded.disposition === 'block') {
        return {
          valid: false,
          key: guarded.reason === 'customer_duplicate' ? 'customer_duplicate' : guarded.reason,
          bookingId: guarded.conflicts[0] && guarded.conflicts[0].bookingId,
          guardResult: guarded
        };
      }
      return { valid: true, key: 'no_overlap', guardResult: guarded };
    }
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

  function pricingNumber(source, key) {
    var value = source && source[key];
    return isFinite(Number(value)) ? Number(value) : DEFAULT_PRICING[key];
  }

  function distanceTierFee(vendor, miles, freeTravelMiles, customQuoteMiles) {
    var tiers = Array.isArray(vendor && vendor.travelFeeTiers) ? vendor.travelFeeTiers.slice() : [];
    if (tiers.length) {
      tiers.sort(function(a, b) { return Number(a.maxMiles || 0) - Number(b.maxMiles || 0); });
      for (var i = 0; i < tiers.length; i++) {
        if (miles <= Number(tiers[i].maxMiles || 0)) return Number(tiers[i].fee || 0);
      }
      return Number(tiers[tiers.length - 1].fee || 0);
    }
    if (miles <= freeTravelMiles) return 0;
    if (miles <= 10) return 8;
    if (miles <= 15) return 15;
    if (miles <= customQuoteMiles) return 25;
    return 25;
  }

  function estimateDistance(input, address) {
    var source = input || {};
    address = address || {};
    if (isFinite(Number(source.roundTripMiles))) return Math.max(0, Number(source.roundTripMiles));
    if (isFinite(Number(address.roundTripMiles))) return Math.max(0, Number(address.roundTripMiles));
    if (isFinite(Number(source.distanceMiles))) return Math.max(0, Number(source.distanceMiles));
    if (isFinite(Number(address.distanceMiles))) return Math.max(0, Number(address.distanceMiles));
    if (isFinite(Number(source.oneWayMiles))) return Math.max(0, Number(source.oneWayMiles) * 2);
    if (isFinite(Number(address.oneWayMiles))) return Math.max(0, Number(address.oneWayMiles) * 2);
    return 0;
  }

  // Distance Matrix lookup via Google Maps JS SDK (already loaded with the
  // public Web API key on mobile-barber pages). Caches results in
  // sessionStorage so the same address doesn't burn repeated API calls.
  function requestDistanceMatrix(vendor, customerAddress) {
    function originStr() {
      if (vendor && typeof vendor.homeBaseAddress === 'string' && vendor.homeBaseAddress.trim()) {
        return vendor.homeBaseAddress.trim();
      }
      var areas = vendor && Array.isArray(vendor.serviceAreas) ? vendor.serviceAreas : [];
      return (areas[0] || '') + ', CA';
    }
    function destStr() {
      if (!customerAddress) return '';
      if (typeof customerAddress === 'string') return customerAddress;
      var parts = [customerAddress.address, customerAddress.city, customerAddress.zip].filter(function(x) { return x && String(x).trim(); });
      return parts.join(', ');
    }
    var origin = originStr();
    var dest = destStr();
    if (!origin || !dest) return Promise.resolve(null);
    var cacheKey = 'mb_dist_' + (vendor && vendor.id) + '|' + dest.toLowerCase();
    try {
      var cached = root.sessionStorage && root.sessionStorage.getItem(cacheKey);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (parsed && isFinite(parsed.distanceMiles)) return Promise.resolve(parsed);
      }
    } catch (e) { /* ignore */ }
    if (typeof root.google === 'undefined' || !root.google.maps || !root.google.maps.DistanceMatrixService) {
      return Promise.resolve(null);
    }
    return new Promise(function(resolve) {
      try {
        var service = new root.google.maps.DistanceMatrixService();
        service.getDistanceMatrix({
          origins: [origin],
          destinations: [dest],
          travelMode: root.google.maps.TravelMode.DRIVING,
          unitSystem: root.google.maps.UnitSystem.IMPERIAL
        }, function(response, status) {
          if (status !== 'OK' || !response || !response.rows || !response.rows[0]) {
            if (root.console) root.console.warn('[mobile-barber-distance] status', status);
            return resolve(null);
          }
          var el = response.rows[0].elements && response.rows[0].elements[0];
          if (!el || el.status !== 'OK') {
            if (root.console) root.console.warn('[mobile-barber-distance] element', el && el.status);
            return resolve(null);
          }
          var meters = el.distance && el.distance.value;
          var seconds = el.duration && el.duration.value;
          var miles = isFinite(meters) ? meters / 1609.344 : null;
          var minutes = isFinite(seconds) ? seconds / 60 : null;
          if (!isFinite(miles)) return resolve(null);
          var result = { distanceMiles: miles, travelMinutes: minutes || 0, origin: origin, dest: dest };
          try { root.sessionStorage && root.sessionStorage.setItem(cacheKey, JSON.stringify(result)); } catch (e) {}
          resolve(result);
        });
      } catch (e) {
        if (root.console) root.console.warn('[mobile-barber-distance] error', e);
        resolve(null);
      }
    });
  }

  function calculateMobileBarberPrice(arg1, arg2, arg3) {
    var input = arg1 && arg1.vendor ? arg1 : {
      vendor: arg1,
      service: arg2,
      customerAddress: arg3
    };
    var vendor = input.vendor || {};
    var service = input.service || {};
    var address = input.customerAddress || input.address || arg3 || {};
    var base = Number(service.price || 0);
    var freeTravelMiles = pricingNumber(vendor, 'freeTravelMiles');
    var customQuoteMiles = pricingNumber(vendor, 'customQuoteMiles');
    var estimatedDistance = estimateDistance(input, address);
    var estimatedTravelMinutes = isFinite(Number(input.travelMinutes))
      ? Math.max(0, Number(input.travelMinutes))
      : Number(service.travelBufferMinutes != null ? service.travelBufferMinutes : vendor.travelBufferMinutes || 0);
    var tierFee = distanceTierFee(vendor, estimatedDistance, freeTravelMiles, customQuoteMiles);
    var baseTravelFee = Number(vendor.baseTravelFee || 0);
    var travel = Math.max(baseTravelFee, tierFee);
    var vehicleWearCost = Math.round(estimatedDistance * pricingNumber(vendor, 'wearRatePerMile') * 100) / 100;
    var distanceAdjustment = 0;
    var peakAdjustment = 0;
    var total = base + travel;
    var quoteType = estimatedDistance > customQuoteMiles ? 'vendor_review' : 'standard';
    var effectiveMinutes = Number(service.durationMinutes || 0) + Number(service.cleanupBufferMinutes || 0) + estimatedTravelMinutes;
    var minimumVisit = pricingNumber(vendor, 'minimumMobileVisitPrice');
    if (total < minimumVisit && quoteType !== 'vendor_review') {
      distanceAdjustment += minimumVisit - total;
      total = minimumVisit;
    }
    var hourlyTarget = pricingNumber(vendor, 'minimumHourlyTarget');
    var grossProfitEstimate = total - vehicleWearCost;
    var estimatedHourlyGross = effectiveMinutes > 0 ? grossProfitEstimate / (effectiveMinutes / 60) : grossProfitEstimate;
    if (quoteType !== 'vendor_review' && estimatedHourlyGross < hourlyTarget) {
      var needed = Math.ceil((hourlyTarget * (effectiveMinutes / 60) + vehicleWearCost) - total);
      if (needed > 0 && needed <= 15) {
        distanceAdjustment += needed;
        total += needed;
        estimatedHourlyGross = (total - vehicleWearCost) / (effectiveMinutes / 60);
      } else if (needed > 15) {
        quoteType = 'vendor_review';
      }
    }
    // Apply vendor promotion if one is active for this service today.
    // Discount is applied to the FINAL total (service + travel + any
    // distance/profitability adjustment) so the customer gets the full
    // discount on the out-the-door price, matching what the promo banner
    // advertises.
    var originalTotal = total;
    var promotion = (DATA && typeof DATA.findActivePromotionForService === 'function')
      ? DATA.findActivePromotionForService(vendor, service, input.now || new Date())
      : null;
    var promoApplied = false;
    var promoPct = 0;
    var promoId = '';
    var promoName = '';
    if (promotion) {
      var promoResult = DATA.applyPromotionToPrice(originalTotal, promotion);
      if (promoResult.discountPercent > 0) {
        promoPct = promoResult.discountPercent;
        total = promoResult.discountedPrice;
        promoApplied = true;
        promoId = promotion.id || '';
        promoName = promotion.name || '';
      }
    }
    var explanation = [
      'Service price ' + base,
      'mobile travel fee ' + travel,
      'estimated vehicle wear ' + vehicleWearCost.toFixed(2),
      estimatedDistance ? ('estimated distance ' + estimatedDistance + ' miles') : 'distance unavailable; used configured/fallback travel tier',
      distanceAdjustment ? ('profitability adjustment ' + distanceAdjustment) : '',
      promoApplied ? ('promotion ' + promoName + ' ' + promoPct + '% off (was $' + originalTotal.toFixed(2) + ')') : '',
      quoteType === 'vendor_review' ? 'vendor review required for distance/profitability' : 'payment due after service by cash or Zelle'
    ].filter(Boolean).join('; ');
    return {
      baseServicePrice: base,
      servicePrice: base,
      travelFee: travel,
      vehicleWearCost: vehicleWearCost,
      distanceAdjustment: distanceAdjustment,
      peakAdjustment: peakAdjustment,
      totalPrice: total,
      estimatedDistanceMiles: estimatedDistance,
      estimatedTravelMinutes: estimatedTravelMinutes,
      pricingExplanation: explanation,
      quoteType: quoteType,
      grossProfitEstimate: Math.round((total - vehicleWearCost) * 100) / 100,
      estimatedHourlyGross: Math.round(estimatedHourlyGross * 100) / 100,
      reviewRequired: quoteType === 'vendor_review' || !isWithinServiceArea(vendor, address || {}),
      // Promotion fields — buildBooking copies these onto the booking doc.
      promotion: promotion || null,
      promotionId: promoId,
      promotionName: promoName,
      discountPercent: promoPct,
      originalPrice: originalTotal,
      discountedPrice: promoApplied ? total : originalTotal,
      promoApplied: promoApplied
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
    if (!cutoffResult.valid) {
      logConflictCheck(draft, timing, [cutoffResult.key], 'block');
      return cutoffResult;
    }
    var weeklyResult = checkWeeklyAvailability(availability, draft, timing);
    if (!weeklyResult.valid) {
      logConflictCheck(draft, timing, [weeklyResult.key], 'block');
      return weeklyResult;
    }
    var blockResult = checkUnavailableBlocks(vendor.id, draft, timing, unavailableBlocks);
    if (!blockResult.valid) {
      logConflictCheck(draft, timing, [blockResult.key], 'block');
      return blockResult;
    }
    var overlap = checkBookingOverlap(vendor.id, draft, timing, existingBookings);
    logConflictCheck(draft, timing, overlap.valid ? [] : [overlap.key], overlap.valid ? 'allow' : 'block');
    return overlap;
  }

  function logConflictCheck(draft, timing, conflicts, result) {
    safeLog('[booking-conflict-check]', {
      requestedStart: trim((draft && draft.requestedDate || '') + ' ' + (draft && draft.startTime || '')),
      requestedEnd: trim((draft && draft.requestedDate || '') + ' ' + (timing && timing.endTime || '')),
      conflicts: conflicts || [],
      result: result || 'unknown'
    });
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
    // Optional intra-day window (minutes from midnight) so a flexible request
    // ("morning" / "afternoon" / "after 5") only searches that band. When a
    // fromNowMinutes is given, slots earlier than that on TODAY are skipped.
    var winStart = (opts.windowStartMinutes != null) ? Number(opts.windowStartMinutes) : null;
    var winEnd = (opts.windowEndMinutes != null) ? Number(opts.windowEndMinutes) : null;
    var nowRef = (opts.now instanceof Date) ? opts.now : (opts.now ? new Date(opts.now) : new Date());
    var todayStr = dateStringFromDate(nowRef);
    var fromNowMin = (opts.fromNowMinutes != null) ? Number(opts.fromNowMinutes) : null;
    var slots = [];
    for (var cursor = new Date(range.start.getTime()); cursor <= range.end && slots.length < limit; cursor = addDays(cursor, 1)) {
      var dateStr = dateStringFromDate(cursor);
      var row = availability.weeklyHours[dayKey(dateStr)];
      if (!row || !row.active) continue;
      var open = minutesFromTime(row.start);
      var close = minutesFromTime(row.end);
      if (open == null || close == null) continue;
      var lo = open, hi = close;
      if (winStart != null) lo = Math.max(lo, winStart);
      if (winEnd != null) hi = Math.min(hi, winEnd);
      if (fromNowMin != null && dateStr === todayStr) lo = Math.max(lo, fromNowMin);
      for (var minute = lo; minute < hi && slots.length < limit; minute += step) {
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

    safeLog('[booking-live-data]', {
      vendorId: vendor && vendor.id || '',
      servicesLoaded: services.length,
      promotionsLoaded: vendor && Array.isArray(vendor.promotions) ? vendor.promotions.length : 0,
      scheduleLoaded: availabilityRows.some(function(row) { return row && row.vendorId === (vendor && vendor.id) && row.weeklyHours; }),
      source: input.liveDataSource || input.source || (input.usedStaticFallback ? 'static-fallback' : 'provided')
    });

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
      // Echo the live-data provenance so buildBooking can route a booking to
      // vendor_review when the schedule/services it was checked against came
      // from the static fallback (Firestore was configured but unreachable).
      liveDataSource: input.liveDataSource || input.source || 'provided',
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
    var id = input.id || ('mb-' + bookingRequestKey(input.vendor, draft, check.service && check.service.id));
    var servicePrice = Number(check.price.servicePrice || check.service.price || 0);
    var travelFee = Number(check.price.travelFee || 0);
    var amountDue = Number(check.price.totalPrice != null ? check.price.totalPrice : (servicePrice + travelFee));
    var _ownerId = input.vendor.ownerId
      || (root && root.OwnerModel && root.OwnerModel.resolveBookingOwner
          ? root.OwnerModel.resolveBookingOwner({ serviceType: 'barber', vendorId: input.vendor.id, ownerId: input.vendor.ownerId })
          : null);
    // The mobile-barber model treats each barber as a vendor doc, so the
    // assigned barber IS the routed vendor. Prefer explicit barber id fields
    // when present so future multi-barber-per-vendor setups still resolve.
    var meta = input.meta || {};
    var _assignedBarberId = trim(input.vendor.assignedBarberId || input.vendor.barberId || input.vendor.id);
    function metaJson(value) {
      if (value == null || value === '') return '';
      if (typeof value === 'string') return value;
      try { return JSON.stringify(value); } catch (e) { return ''; }
    }
    var haircutRef = buildHaircutReference(draft, check.service, now);
    var booking = {
      id: id,
      bookingRequestId: bookingRequestKey(input.vendor, draft, check.service && check.service.id),
      vendorId: input.vendor.id,
      ownerId: _ownerId || null,
      serviceType: 'barber',
      assignedBarberId: _assignedBarberId,
      routingReason: trim(meta.routingReason),
      previousCustomerMatched: meta.previousCustomerMatched === true,
      customerPreferenceSnapshot: metaJson(meta.customerPreferenceSnapshot),
      scheduleCheckSnapshot: metaJson(meta.scheduleCheckSnapshot),
      customerName: trim(draft.customerName),
      customerPhone: digits(draft.customerPhone),
      customerEmail: trim(draft.customerEmail),
      smsOptIn: draft.smsOptIn === true || draft.smsOptIn === 'true',
      serviceId: check.service.id,
      serviceName: check.service.name,
      servicePrice: servicePrice,
      travelFee: travelFee,
      vehicleWearCost: Number(check.price.vehicleWearCost || 0),
      distanceAdjustment: Number(check.price.distanceAdjustment || 0),
      peakAdjustment: Number(check.price.peakAdjustment || 0),
      amountDue: amountDue,
      totalPrice: amountDue,
      estimatedDistanceMiles: Number(check.price.estimatedDistanceMiles || 0),
      estimatedTravelMinutes: Number(check.price.estimatedTravelMinutes || 0),
      pricingExplanation: trim(check.price.pricingExplanation),
      quoteType: trim(check.price.quoteType || 'standard'),
      paymentMethod: normalizePaymentMethod(draft.paymentMethod),
      paymentStatus: normalizePaymentStatus(draft.paymentStatus),
      zellePhone: trim(draft.zellePhone) || trim(input.vendor.zellePhone) || trim(input.vendor.phone),
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
      customerId: trim(draft.customerId || draft.customerUid),
      normalizedPhone: normalizePhone(draft.normalizedPhone || draft.customerPhone),
      customerProfileSnapshot: draft.customerProfileSnapshot && typeof draft.customerProfileSnapshot === 'object'
        ? Object.assign({}, draft.customerProfileSnapshot)
        : {},
      confirmationPreference: normalizeConfirmationPreference(draft.confirmationPreference),
      confirmationSentAt: '',
      // Optional AI haircut preview (all default to empty so bookings stay
      // valid when the customer skips the feature).
      selfieDataUrl: typeof draft.selfieDataUrl === 'string' ? draft.selfieDataUrl : '',
      aiAnalysisSummary: trim(draft.aiAnalysisSummary),
      aiAnalysisConsent: draft.aiAnalysisConsent === true || draft.aiAnalysisConsent === 'true' ? 'true' : 'false',
      recommendedStyles: Array.isArray(draft.recommendedStyles) ? draft.recommendedStyles.slice() : [],
      // Canonical AI hairstyle reference. selectedStyleId / selectedStylePreviewUrl
      // are kept as legacy mirrors so the vendor dashboard, source-pattern tests,
      // and saved bookings written before this field set was added all continue to work.
      selectedAiStyleId: trim(draft.selectedAiStyleId || draft.selectedStyleId),
      selectedAiStyleName: trim(draft.selectedAiStyleName),
      selectedAiStyleImage: typeof draft.selectedAiStyleImage === 'string'
        ? draft.selectedAiStyleImage
        : (typeof draft.selectedStylePreviewUrl === 'string' ? draft.selectedStylePreviewUrl : ''),
      selectedAiStyleDescription: trim(draft.selectedAiStyleDescription),
      selectedAiBarberNotes: trim(draft.selectedAiBarberNotes),
      selectedAiMaintenanceLevel: trim(draft.selectedAiMaintenanceLevel),
      selectedStyleId: trim(draft.selectedAiStyleId || draft.selectedStyleId),
      selectedStylePreviewUrl: trim(draft.selectedStylePreviewUrl || draft.selectedAiStyleImage),
      // All-audience AI hairstyle attributes. Audience: man|woman|child|neutral.
      // Color/highlight/texture recommendations are populated only when the
      // customer asked the AI to explore those options.
      selectedAudienceType: trim(draft.selectedAudienceType),
      selectedColorRecommendation: trim(draft.selectedColorRecommendation),
      selectedHighlightRecommendation: trim(draft.selectedHighlightRecommendation),
      selectedTexturePreference: trim(draft.selectedTexturePreference),
      barberCuttingNotes: trim(draft.barberCuttingNotes),
      selectedHaircutSource: haircutRef.selectedHaircutSource,
      selectedHaircutTitle: haircutRef.selectedHaircutTitle,
      selectedHaircutDescription: haircutRef.selectedHaircutDescription,
      selectedHaircutImageUrl: haircutRef.selectedHaircutImageUrl,
      selectedHaircutImageStoragePath: haircutRef.selectedHaircutImageStoragePath,
      selectedHaircutThumbnailUrl: haircutRef.selectedHaircutThumbnailUrl,
      selectedHaircutBarberNotes: haircutRef.selectedHaircutBarberNotes,
      selectedHaircutMaintenanceLevel: haircutRef.selectedHaircutMaintenanceLevel,
      selectedHaircutGeneratedAt: haircutRef.selectedHaircutGeneratedAt,
      selectedHaircutPromptSnapshot: haircutRef.selectedHaircutPromptSnapshot,
      customerSelfieUrl: haircutRef.customerSelfieUrl,
      customerSelfieStoragePath: haircutRef.customerSelfieStoragePath,
      aiPreviewSessionId: trim(draft.aiPreviewSessionId),
      // Promotion fields — populated by calculateMobileBarberPrice when an
      // active vendor promotion applies. All default to empty/0/false so
      // bookings without a promo stay valid.
      promotionId: trim(check.price && check.price.promotionId),
      promotionName: trim(check.price && check.price.promotionName),
      discountPercent: Number((check.price && check.price.discountPercent) || 0),
      originalPrice: Number((check.price && check.price.originalPrice) || amountDue),
      discountedPrice: Number((check.price && check.price.discountedPrice) || amountDue),
      promoApplied: !!(check.price && check.price.promoApplied),
      createdAt: now,
      updatedAt: now
    };
    safeLog('[haircut-reference]', {
      bookingId: booking.id,
      source: booking.selectedHaircutSource,
      imageUrl: booking.selectedHaircutImageUrl,
      storagePath: booking.selectedHaircutImageStoragePath,
      barberNotes: booking.selectedHaircutBarberNotes
    });
    var validationBooking = Object.assign({}, booking);
    delete validationBooking.smsOptIn;
    if (validationBooking.status === 'pending_barber_confirmation') {
      validationBooking.status = 'pending_confirmation';
    }
    var validation = DATA && DATA.validateBooking ? DATA.validateBooking(validationBooking) : { valid: true, errors: [] };
    if (!validation.valid) return { valid: false, errors: validation.errors };
    // Live-data enforcement: if the availability check ran against the static
    // fallback because the live Firestore read failed (vendor hours, blocks,
    // services, promos may be stale), do NOT auto-confirm. Route to
    // vendor_review so the barber re-checks against the real schedule. In
    // tests and non-Firebase contexts liveDataSource is 'provided', so this is
    // a no-op there; the server-side conflict guard is the second safety net.
    var _liveSrc = trim(input.liveDataSource || (check && check.liveDataSource) || 'provided');
    if (_liveSrc === 'static-fallback') {
      booking.status = 'vendor_review';
      booking.reviewReason = 'stale_vendor_data';
    }
    return { valid: true, booking: booking, errors: [] };
  }

  function buildHaircutReference(draft, service, now) {
    draft = draft || {};
    service = service || {};
    var selectedAiImage = trim(draft.selectedAiStyleImage || draft.selectedStylePreviewUrl);
    var hasAi = hasText(draft.selectedAiStyleId || draft.selectedAiStyleName || selectedAiImage);
    var selfieConsented = draft.aiAnalysisConsent === true || draft.aiAnalysisConsent === 'true';
    if (hasAi) {
      return {
        selectedHaircutSource: 'ai_generated',
        selectedHaircutTitle: trim(draft.selectedAiStyleName || draft.selectedAiStyleId || service.name),
        selectedHaircutDescription: trim(draft.selectedAiStyleDescription || draft.aiAnalysisSummary || service.description),
        selectedHaircutImageUrl: selectedAiImage,
        selectedHaircutImageStoragePath: trim(draft.selectedAiStyleStoragePath || draft.selectedHaircutImageStoragePath),
        selectedHaircutThumbnailUrl: trim(draft.selectedAiStyleThumbnailUrl || selectedAiImage),
        selectedHaircutBarberNotes: trim(draft.selectedAiBarberNotes || draft.barberCuttingNotes || service.barberNotes),
        selectedHaircutMaintenanceLevel: trim(draft.selectedAiMaintenanceLevel),
        selectedHaircutGeneratedAt: trim(draft.selectedHaircutGeneratedAt || draft.aiGeneratedAt || now),
        selectedHaircutPromptSnapshot: trim(draft.selectedHaircutPromptSnapshot || draft.aiPromptSnapshot || draft.aiAnalysisSummary),
        customerSelfieUrl: selfieConsented ? trim(draft.customerSelfieUrl || draft.selfieDataUrl) : '',
        customerSelfieStoragePath: selfieConsented ? trim(draft.customerSelfieStoragePath) : ''
      };
    }
    return {
      selectedHaircutSource: 'service_list',
      selectedHaircutTitle: trim(service.name || draft.serviceName),
      selectedHaircutDescription: trim(service.description || draft.serviceDescription),
      selectedHaircutImageUrl: trim(service.imageUrl || draft.serviceImageUrl),
      selectedHaircutImageStoragePath: trim(service.imageStoragePath || draft.serviceImageStoragePath),
      selectedHaircutThumbnailUrl: trim(service.thumbnailUrl || service.imageUrl || draft.serviceImageUrl),
      selectedHaircutBarberNotes: trim(service.barberNotes || draft.barberNotes || draft.notes),
      selectedHaircutMaintenanceLevel: trim(service.maintenanceLevel || draft.maintenanceLevel),
      selectedHaircutGeneratedAt: '',
      selectedHaircutPromptSnapshot: trim(service.imagePrompt || ''),
      customerSelfieUrl: '',
      customerSelfieStoragePath: ''
    };
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
      previousServiceName: trim(booking.serviceName),
      confirmationPreference: normalizeConfirmationPreference(profile.confirmationPreference || booking.confirmationPreference)
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

  function unifiedGuardRequestFromBooking(booking) {
    booking = booking || {};
    return {
      ownerId: trim(booking.ownerId || (root.OwnerModel && root.OwnerModel.resolveOwnerId ? root.OwnerModel.resolveOwnerId(booking) : '')),
      serviceType: 'barber',
      vendorId: trim(booking.vendorId),
      customerPhone: booking.customerPhone,
      customerName: booking.customerName,
      customerUid: booking.customerUid,
      customerEmail: booking.customerEmail,
      requestedDate: booking.requestedDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
      requestedStart: booking.requestedStart,
      requestedEnd: booking.requestedEnd,
      serviceAddress: booking.address,
      city: booking.city,
      zip: booking.zip,
      lat: booking.lat || booking.latitude,
      lng: booking.lng || booking.longitude,
      serviceDurationMinutes: booking.serviceDurationMinutes || booking.durationMinutes,
      travelBufferMinutes: booking.travelBufferMinutes,
      source: booking.source || 'barber'
    };
  }

  function bookingGuardError(result) {
    var error = new Error('booking_guard_' + (result && result.reason ? result.reason : 'invalid_request'));
    error.code = result && result.reason;
    error.guardResult = result;
    return error;
  }

  // ── Durable image storage ──────────────────────────────────────────────────
  // AI-generated hairstyle previews (and consented selfies) start life as inline
  // data URLs on the draft so the flow works with zero backend. At write time we
  // upload them to Firebase Storage under the SAME path the nailsalon flow uses
  // (vendors/{vendorId}/bookings/{bookingId}/...), which the live storage rules
  // already permit, then store the durable download URL on the booking instead of
  // the bulky data URL — keeping the Firestore doc small. Upload is best-effort:
  // if Storage is unavailable or the upload fails, the inline data URL stays in
  // place (prior behaviour) so the booking still completes and the vendor still
  // sees the reference.
  var HAIRCUT_IMAGE_FIELDS = ['selectedHaircutImageUrl', 'selectedHaircutThumbnailUrl', 'selectedAiStyleImage', 'selectedStylePreviewUrl'];

  function isDataUrl(value) {
    return typeof value === 'string' && value.indexOf('data:') === 0;
  }

  function canUseStorage() {
    return typeof root.firebase !== 'undefined'
        && typeof root.firebase.storage === 'function'
        && root.firebase.apps && root.firebase.apps.length;
  }

  function firstDataUrl(values) {
    for (var i = 0; i < values.length; i++) {
      if (isDataUrl(values[i])) return values[i];
    }
    return '';
  }

  function bookingHaircutDataUrls(booking) {
    return HAIRCUT_IMAGE_FIELDS.map(function(field) { return booking[field]; });
  }

  // Prefer the full-resolution copy the customer page cached in localStorage
  // (keyed by AI preview session + style) so the barber sees a crisp reference
  // rather than the compressed inline thumbnail kept for offline fallback.
  function fullResHaircutDataUrl(booking) {
    try {
      var AIP = root.MobileBarberAIPreview;
      if (!AIP || typeof AIP.readLocalCopy !== 'function') return '';
      var styleId = trim(booking.selectedAiStyleId || booking.selectedStyleId);
      var sessionId = trim(booking.aiPreviewSessionId);
      if (!sessionId && !styleId) return '';
      var full = AIP.readLocalCopy(sessionId, styleId);
      return isDataUrl(full) ? full : '';
    } catch (e) { return ''; }
  }

  function uploadDataUrlToStorage(dataUrl, path) {
    var ref = root.firebase.storage().ref(path);
    return ref.putString(dataUrl, 'data_url').then(function() {
      return ref.getDownloadURL();
    });
  }

  function hasUploadableImages(booking) {
    if (!booking) return false;
    if (firstDataUrl(bookingHaircutDataUrls(booking))) return true;
    return isDataUrl(booking.customerSelfieUrl);
  }

  // A synchronous thenable so saveBooking keeps its (test- and stub-relied-upon)
  // synchronous return shape when there is nothing to upload.
  function syncResolved(value) {
    return { then: function(cb) { return cb ? cb(value) : value; } };
  }

  function uploadBookingImages(booking) {
    if (!canUseStorage() || !booking || !booking.id || !booking.vendorId || !hasUploadableImages(booking)) {
      return syncResolved(booking);
    }
    var ts = Date.now();
    var basePath = 'vendors/' + booking.vendorId + '/bookings/' + booking.id;
    var tasks = [];

    var imageDataUrl = fullResHaircutDataUrl(booking) || firstDataUrl(bookingHaircutDataUrls(booking));
    if (imageDataUrl) {
      var imgPath = basePath + '/ai_haircut_' + ts + '.png';
      tasks.push(
        uploadDataUrlToStorage(imageDataUrl, imgPath).then(function(url) {
          HAIRCUT_IMAGE_FIELDS.forEach(function(field) {
            if (isDataUrl(booking[field])) booking[field] = url;
          });
          if (!hasText(booking.selectedHaircutImageUrl)) booking.selectedHaircutImageUrl = url;
          if (!hasText(booking.selectedHaircutThumbnailUrl)) booking.selectedHaircutThumbnailUrl = url;
          booking.selectedHaircutImageStoragePath = imgPath;
          safeLog('[haircut-storage]', { bookingId: booking.id, field: 'haircutImage', storagePath: imgPath, uploaded: true });
        }).catch(function(e) {
          safeLog('[haircut-storage]', { bookingId: booking.id, field: 'haircutImage', uploaded: false, error: e && e.message });
        })
      );
    }

    if (isDataUrl(booking.customerSelfieUrl)) {
      var selfiePath = basePath + '/selfie_' + ts + '.jpg';
      tasks.push(
        uploadDataUrlToStorage(booking.customerSelfieUrl, selfiePath).then(function(url) {
          booking.customerSelfieUrl = url;
          booking.customerSelfieStoragePath = selfiePath;
          safeLog('[haircut-storage]', { bookingId: booking.id, field: 'customerSelfie', storagePath: selfiePath, uploaded: true });
        }).catch(function(e) {
          safeLog('[haircut-storage]', { bookingId: booking.id, field: 'customerSelfie', uploaded: false, error: e && e.message });
        })
      );
    }

    if (!tasks.length) return syncResolved(booking);
    return Promise.all(tasks).then(function() { return booking; });
  }

  // AI-generated hairstyle previews + customer selfies are intentionally NOT
  // persisted to Firestore or Firebase Storage (privacy + data-minimization).
  // The customer saves the generated style to their phone and shows the barber
  // in person; the booking keeps only the lightweight TEXT reference (style
  // title/description/barber notes/color/highlight). This also removes the
  // image-upload Storage surface flagged in the pre-production security audit.
  var STORED_IMAGE_FIELDS = [
    'selectedHaircutImageUrl', 'selectedHaircutThumbnailUrl', 'selectedHaircutImageStoragePath',
    'selectedAiStyleImage', 'selectedStylePreviewUrl',
    'customerSelfieUrl', 'customerSelfieStoragePath', 'selfieDataUrl'
  ];
  function isPersistedImageValue(v) {
    return typeof v === 'string' && (
      v.indexOf('data:') === 0 ||
      v.indexOf('firebasestorage.googleapis') >= 0 ||
      v.indexOf('storage.googleapis.com') >= 0 ||
      v.indexOf('appspot.com/o/') >= 0
    );
  }
  function stripUnstoredImages(booking) {
    if (!booking) return booking;
    STORED_IMAGE_FIELDS.forEach(function(field) {
      // selfieDataUrl/storagePath are always cleared; URL fields are cleared
      // only when they hold an actual uploaded/data image (keep static
      // /assets/ catalog references so the barber still sees the style name+pic).
      if (field === 'selfieDataUrl' || field.indexOf('StoragePath') >= 0) booking[field] = '';
      else if (isPersistedImageValue(booking[field])) booking[field] = '';
    });
    if (Array.isArray(booking.photoUrls)) {
      booking.photoUrls = booking.photoUrls.filter(function(u) { return !isPersistedImageValue(u); });
    }
    if (Array.isArray(booking.recommendedStyles)) {
      booking.recommendedStyles = booking.recommendedStyles.map(function(s) {
        if (!s || typeof s !== 'object') return s;
        var c = Object.assign({}, s);
        ['image', 'imageUrl', 'previewUrl', 'dataUrl', 'thumbnailUrl'].forEach(function(k) {
          if (isPersistedImageValue(c[k])) c[k] = '';
        });
        return c;
      });
    }
    return booking;
  }

  function saveBooking(booking, options) {
    options = options || {};
    // No image upload — strip any generated/selfie image data before persisting.
    stripUnstoredImages(booking);
    return persistBooking(booking, options);
  }

  // The unified BookingGuard runs a Firestore TRANSACTION that reads a lock doc
  // and queries owner-scoped bookings for cross-service conflict detection.
  // Anonymous customers (the public booking flow signs in anonymously) cannot
  // perform those reads under Firestore rules, so the guarded transaction is
  // denied ("permission-denied" on BatchGetDocuments) and the booking never
  // saves. Worse, the guard's conflict query is ALSO denied for anon, so it was
  // never providing customers any conflict detection — it only blocked the save.
  // Anonymous writers therefore use the plain create path, which the rules
  // explicitly allow for guest booking requests (isValidMobileBarberBookingCreate).
  // Authenticated vendor/owner writes keep the full guard (they can read).
  function _isAnonymousWriter() {
    try {
      var auth = (root.firebase && typeof root.firebase.auth === 'function') ? root.firebase.auth() : null;
      var user = auth && auth.currentUser;
      return !user || user.isAnonymous === true;
    } catch (e) { return true; } // fail-safe: treat as guest → plain create (rules allow it)
  }

  function canUseFunctions() {
    try { return !!(root.firebase && typeof root.firebase.functions === 'function'); }
    catch (e) { return false; }
  }

  // A structured rejection the booking UI inspects (err.bookingConflict) so it can
  // show "that time is no longer available" + alternate times instead of "success".
  function bookingConflictError(data) {
    var err = new Error('booking_time_conflict');
    err.bookingConflict = true;
    err.conflictCode = (data && data.code) || 'time_conflict';
    err.conflicts = (data && data.conflicts) || [];
    err.suggestions = (data && data.suggestions) || [];
    return err;
  }

  // Customer booking create through the server guard. Returns the saved booking on
  // success, REJECTS with a bookingConflict error when the slot is taken (never
  // silently writes an overlap), and only falls back to a direct write if the
  // callable itself is unreachable (offline / functions down) — the onCreate trigger
  // remains the post-write safety net in that degraded case.
  // Structured rejection for "the server guard could not run / did not authorize this
  // booking" (callable unreachable, functions SDK missing, or a non-conflict guard
  // refusal). The UI treats this as a retry-able FAILURE, never a success. The customer
  // (anonymous) flow cannot run the owner-scoped conflict query under Firestore rules,
  // so this callable is the ONLY safe gate — writing directly and showing "success"
  // when it cannot run is exactly how an overlapping booking reached a "confirmed"
  // screen. NO SUCCESS WITHOUT A GUARDED WRITE.
  function bookingUnavailableError(data) {
    var err = new Error('booking_guard_unavailable');
    err.bookingUnavailable = true;
    err.guardCode = (data && data.code) || 'guard_unavailable';
    return err;
  }
  // Same customer already has a same-day haircut and the slot is NOT an exact conflict —
  // the UI must ask whether this is a reschedule, a family member, or a mistake BEFORE any
  // booking is created. Carries the existing booking(s) so the UI can name the time.
  function duplicateIntentError(data) {
    var err = new Error('booking_duplicate_intent');
    err.duplicateIntent = true;
    err.intentCode = (data && data.code) || 'SAME_DAY_DUPLICATE_NEEDS_INTENT';
    err.existing = (data && data.existing) || [];
    err.riskReasons = (data && data.riskReasons) || [];
    return err;
  }
  // Too many booking requests from this customer (spam / abuse guard).
  function bookingSpamError(data) {
    var err = new Error('booking_too_many_requests');
    err.bookingSpam = true;
    err.spamCode = (data && data.code) || 'TOO_MANY_REQUESTS';
    return err;
  }
  function guardedCreateViaCallable(booking, options) {
    options = options || {};
    var fn = null;
    try { fn = root.firebase.functions().httpsCallable('createMobileBarberBookingGuarded'); }
    catch (e) { fn = null; }
    // No callable → the conflict guard cannot run → refuse rather than write blindly.
    if (!fn) return Promise.reject(bookingUnavailableError());
    return fn({ booking: booking }).then(function(res) {
      var data = (res && res.data) || {};
      if (data.ok === false) {
        var code = data.code || '';
        // Hard time conflict (exact / overlapping slot — same or different customer):
        // "slot taken + alternate times".
        if (code === 'time_conflict' || code === 'DUPLICATE_EXACT' || code === 'CUSTOMER_OVERLAP') {
          return Promise.reject(bookingConflictError(data));
        }
        // Same-day duplicate that needs the customer's intent (reschedule vs family member).
        if (code === 'SAME_DAY_DUPLICATE_NEEDS_INTENT' || code === 'FAMILY_MEMBER_REQUIRED') {
          return Promise.reject(duplicateIntentError(data));
        }
        if (code === 'TOO_MANY_REQUESTS') return Promise.reject(bookingSpamError(data));
        // Any other guard refusal (malformed payload, missing owner, etc.): the guard did
        // NOT authorize this booking, so we must not silently write it and report success.
        return Promise.reject(bookingUnavailableError(data));
      }
      var saved = data.booking || booking;
      safeLog('[booking-write]', { bookingId: saved.id, vendorId: saved.vendorId, status: saved.status, source: 'callable', idempotent: !!data.idempotent, intent: data.code || '' });
      return { saved: true, source: 'callable', method: 'callable', booking: saved, idempotent: !!data.idempotent, intentCode: data.code || 'OK', rescheduled: !!data.rescheduled };
    }).catch(function(error) {
      if (error && error.bookingConflict) return Promise.reject(error);    // slot taken → conflict UI
      if (error && error.duplicateIntent) return Promise.reject(error);    // same-day dup → intent UI
      if (error && error.bookingSpam) return Promise.reject(error);        // rate limit → spam UI
      if (error && error.bookingUnavailable) return Promise.reject(error); // guard refused → retry UI
      // Callable unreachable (network down / functions error). The guard could not run, so
      // we CANNOT confirm the slot is free. Refuse rather than write an unguarded booking
      // that flashes "success" and is then auto-declined by the onCreate trigger.
      return Promise.reject(bookingUnavailableError());
    });
  }

  function persistBooking(booking, options) {
    options = options || {};
    var guard = root.BookingGuard;
    var guardReq = unifiedGuardRequestFromBooking(booking);
    if (guard && guardReq.ownerId && options.skipUnifiedGuard !== true && !_isAnonymousWriter()) {
      return guard.guardedWrite(guardReq, function(tx, guardMeta) {
        guardMeta = guardMeta || {};
        booking.status = guardMeta.disposition === 'review' ? 'vendor_review' : normalizeBookingStatus(booking.status);
        if (guardMeta.disposition === 'review') booking.reviewReason = guardMeta.reason || '';
        if (guardMeta.disposition === 'review') booking.reviewConflicts = guardMeta.conflicts || [];
        if (canUseFirestore()) {
          var ref = root.firebase.firestore().collection(DATA.COLLECTIONS.bookings).doc(booking.id);
          if (tx && tx.set) {
            tx.set(ref, booking);
            safeLog('[booking-write]', { bookingId: booking.id, vendorId: booking.vendorId, status: booking.status, source: 'firestore' });
            return { saved: true, source: 'firestore', method: 'transaction', booking: booking };
          }
          return ref.set(booking).then(function() {
            safeLog('[booking-write]', { bookingId: booking.id, vendorId: booking.vendorId, status: booking.status, source: 'firestore' });
            return { saved: true, source: 'firestore', method: 'firestore', booking: booking };
          });
        }
        var localResult = saveBookingLocal(booking);
        safeLog('[booking-write]', { bookingId: booking.id, vendorId: booking.vendorId, status: booking.status, source: 'static-fallback' });
        return localResult;
      }, { origin: options.origin || options.vendor || {}, barberVendorIds: options.barberVendorIds })
        .then(function(result) {
          if (!result || result.disposition === 'block') return Promise.reject(bookingGuardError(result));
          if (result.disposition === 'review') {
            booking.status = 'vendor_review';
            booking.reviewReason = result.reason || '';
            booking.reviewConflicts = result.conflicts || [];
          }
          return result.writeResult || { saved: true, source: 'guard', method: 'guard', booking: booking };
        })
        .catch(function(error) {
          if (error && error.guardResult) return Promise.reject(error);
          if (options.requireDatabase) return Promise.reject(error);
          return saveBookingLocal(booking);
        });
    }
    if (canUseFirestore()) {
      // Customer path (anonymous writers can't run the owner-scoped guard query under
      // Firestore rules). Route through the server callable that runs the conflict
      // guard BEFORE the write, so a second booking for a taken slot is blocked at
      // submission instead of being auto-declined after a "success" screen.
      if (canUseFunctions() && options.skipGuardedCallable !== true) {
        return guardedCreateViaCallable(booking, options);
      }
      return root.firebase.firestore().collection(DATA.COLLECTIONS.bookings).doc(booking.id).set(booking)
        .then(function() {
          safeLog('[booking-write]', { bookingId: booking.id, vendorId: booking.vendorId, status: booking.status, source: 'firestore' });
          return { saved: true, source: 'firestore', method: 'firestore', booking: booking };
        })
        .catch(function(error) {
          if (options.requireDatabase) return Promise.reject(error);
          return saveBookingLocal(booking);
        });
    }
    if (options.requireDatabase) return Promise.reject(new Error('firestore_unavailable'));
    try {
      var savedLocal = saveBookingLocal(booking);
      safeLog('[booking-write]', { bookingId: booking.id, vendorId: booking.vendorId, status: booking.status, source: 'static-fallback' });
      return Promise.resolve(savedLocal);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function withPaymentDefaults(booking, vendor) {
    booking = Object.assign({}, booking || {});
    var servicePrice = Number(booking.servicePrice || 0);
    var travelFee = Number(booking.travelFee || 0);
    var amountDue = Number(booking.amountDue != null ? booking.amountDue : (servicePrice + travelFee));
    var legacyTotal = servicePrice && !travelFee && !booking.amountDue ? servicePrice : null;
    booking.paymentMethod = normalizePaymentMethod(booking.paymentMethod);
    booking.paymentStatus = normalizePaymentStatus(booking.paymentStatus);
    booking.zellePhone = trim(booking.zellePhone) || trim(vendor && vendor.phone);
    booking.servicePrice = servicePrice;
    booking.travelFee = travelFee;
    booking.vehicleWearCost = Number(booking.vehicleWearCost || 0);
    booking.distanceAdjustment = Number(booking.distanceAdjustment || 0);
    booking.peakAdjustment = Number(booking.peakAdjustment || 0);
    booking.amountDue = Number(legacyTotal != null ? legacyTotal : amountDue);
    booking.totalPrice = Number(booking.totalPrice != null ? booking.totalPrice : booking.amountDue);
    booking.estimatedDistanceMiles = Number(booking.estimatedDistanceMiles || 0);
    booking.estimatedTravelMinutes = Number(booking.estimatedTravelMinutes || 0);
    booking.pricingExplanation = trim(booking.pricingExplanation);
    booking.quoteType = trim(booking.quoteType || 'standard');
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

  // Stamp a customer's duplicate-intent decision onto a built booking so the guarded
  // create honors it. type 'family_member' → verified family booking; 'self_reschedule'
  // → move the linked existing booking in place (the callable does not create a new doc).
  function applyDuplicateIntent(booking, decision) {
    booking = Object.assign({}, booking || {});
    decision = decision || {};
    if (decision.type === 'family_member') {
      booking.bookingFor = 'family_member';
      booking.duplicateIntentVerified = true;
      booking.duplicateIntentType = 'family_member';
      booking.familyMemberName = trim(decision.familyMemberName);
      booking.familyMemberAgeGroup = trim(decision.familyMemberAgeGroup) || '';
      booking.primaryCustomerPhone = normalizePhone(booking.customerPhone);
      booking.primaryCustomerName = trim(booking.customerName);
    } else if (decision.type === 'self_reschedule') {
      booking.bookingFor = 'self';
      booking.duplicateIntentVerified = true;
      booking.duplicateIntentType = 'self_reschedule';
      booking.linkedExistingBookingId = trim(decision.linkedExistingBookingId);
    }
    return booking;
  }

  return {
    ACTIVE_BOOKING_STATUSES: ACTIVE_BOOKING_STATUSES,
    applyDuplicateIntent: applyDuplicateIntent,
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
    formatTime12Hour: formatTime12Hour,
    checkMobileBarberAvailability: checkMobileBarberAvailability,
    findNextAvailableSlots: findNextAvailableSlots,
    calculateMobileBarberPrice: calculateMobileBarberPrice,
    requestDistanceMatrix: requestDistanceMatrix,
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
    uploadBookingImages: uploadBookingImages,
    saveBooking: saveBooking,
    updateBookingStatus: updateBookingStatus,
    updateBookingPayment: updateBookingPayment,
    _minutesFromTime: minutesFromTime,
    _rangesOverlap: rangesOverlap
  };
});
