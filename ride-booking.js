/**
 * Du Lịch Cali — Smart Ride Booking Engine  v1.0
 *
 * Capacity-aware, location-aware, quote-first ride booking system.
 * Works with both the booking wizard UI and AI chat.
 *
 * Responsibilities:
 *   - GPS pickup estimation + confirmation flow
 *   - Dropoff address verification / ambiguity detection
 *   - Vehicle capacity rules & enforcement
 *   - AI-assisted ride/vehicle recommendation
 *   - Feasibility check (can driver reach pickup in time?)
 *   - Normalized ride object for all booking sources
 *   - Full-trip GPS link generation for driver
 *   - Complete driver handoff payload
 *
 * Usage:
 *   DLCRide.getGPSLocation()           → Promise<{lat, lng, address}>
 *   DLCRide.resolveVehicle(passengers)  → { type, name, capacity, tier }
 *   DLCRide.validateCapacity(pax, veh)  → { valid, message }
 *   DLCRide.checkFeasibility(pickup, pickupTime) → { feasible, eta, nextAvailable }
 *   DLCRide.buildRideObject(params)     → normalized ride object
 *   DLCRide.generateMapLink(ride)       → full-trip Google Maps URL
 *   DLCRide.isAmbiguousAddress(text)    → boolean
 *   DLCRide.suggestClarification(text)  → string prompt
 */

window.DLCRide = (() => {
  'use strict';

  // ══════════════════════════════════════════════════════════════
  //  VEHICLE DEFINITIONS & CAPACITY RULES
  // ══════════════════════════════════════════════════════════════

  const VEHICLES = {
    sedan: {
      type: 'sedan',
      name: 'Tesla Model Y',
      capacity: 4,
      maxPassengers: 3,
      tier: 'standard',
      luggageMax: 3,
      description: 'Comfortable 4-seat electric sedan',
      descriptionVi: 'Xe điện 4 chỗ cao cấp',
    },
    sienna: {
      type: 'sienna',
      name: 'Toyota Sienna',
      capacity: 8,
      maxPassengers: 7,
      tier: 'midsize',
      luggageMax: 6,
      description: '8-seat hybrid minivan',
      descriptionVi: 'Xe 8 chỗ tiết kiệm xăng',
    },
    van: {
      type: 'van',
      name: 'Mercedes Van',
      capacity: 12,
      maxPassengers: 11,
      tier: 'premium',
      luggageMax: 12,
      description: 'Spacious 12-seat luxury van',
      descriptionVi: 'Xe van 12 chỗ rộng rãi',
    },
  };

  // Passenger count → eligible vehicles (ordered by recommendation priority)
  const CAPACITY_MAP = [
    { min: 1,  max: 3,  eligible: ['sedan', 'sienna', 'van'], recommended: 'sedan' },
    { min: 4,  max: 4,  eligible: ['sienna', 'van'],          recommended: 'sienna' },
    { min: 5,  max: 7,  eligible: ['sienna', 'van'],          recommended: 'sienna' },
    { min: 8,  max: 11, eligible: ['van'],                    recommended: 'van' },
    { min: 12, max: 12, eligible: ['van'],                    recommended: 'van' },
  ];

  // Derive available vehicle types from actual active drivers in the detected region.
  // Fails open to full fleet if no driver data is available yet.
  function getRegionVehicles() {
    const regionId = window.DLCRegion?.current?.id;
    const pool = window._activeDrivers || [];
    const inRegion = regionId ? pool.filter(d => (d.regions || []).includes(regionId)) : pool;

    if (inRegion.length > 0) {
      const seen = new Set();
      for (const d of inRegion) {
        const vn = ((d.vehicle?.make || '') + ' ' + (d.vehicle?.model || '')).toLowerCase();
        if (/tesla|model y|model 3|model s/.test(vn))    seen.add('sedan');
        if (/sienna|minivan|odyssey|pacifica/.test(vn))  seen.add('sienna');
        if (/van|sprinter|transit|mercedes|promaster/.test(vn)) seen.add('van');
      }
      if (seen.size > 0) {
        const available = ['sedan', 'sienna', 'van'].filter(t => seen.has(t));
        const maxPax = seen.has('van') ? 11 : seen.has('sienna') ? 7 : 4;
        return { override: true, available, maxPassengers: maxPax };
      }
    }

    // Fail open: driver data not loaded yet — allow full fleet
    return { override: false, available: ['sedan', 'sienna', 'van'], maxPassengers: 11 };
  }

  // ══════════════════════════════════════════════════════════════
  //  VEHICLE RESOLUTION & CAPACITY VALIDATION
  // ══════════════════════════════════════════════════════════════

  /**
   * Given passenger count, return the recommended vehicle + all eligible options.
   * Respects regional availability (derived dynamically from active driver fleet).
   */
  function resolveVehicle(passengers, luggage) {
    const pax = Math.max(1, parseInt(passengers) || 1);
    const bags = Math.max(0, parseInt(luggage) || 0);
    const region = getRegionVehicles();

    // Find capacity tier based on passengers
    const tier = CAPACITY_MAP.find(t => pax >= t.min && pax <= t.max);
    if (!tier) {
      return {
        recommended: null,
        eligible: [],
        passengers: pax,
        error: pax > 12
          ? 'Tối đa 12 khách mỗi chuyến. Vui lòng liên hệ để đặt nhiều xe.'
          : 'Số khách không hợp lệ.',
        errorEn: pax > 12
          ? 'Maximum 12 passengers per trip. Please contact us for multiple vehicles.'
          : 'Invalid passenger count.',
      };
    }

    // Filter by regional availability, then upgrade if luggage exceeds vehicle capacity
    let eligible = tier.eligible.filter(v => region.available.includes(v));

    // If luggage requires a larger vehicle, remove undersized options
    if (bags > 0) {
      const fitsLuggage = eligible.filter(v => VEHICLES[v].luggageMax >= bags);
      if (fitsLuggage.length > 0) eligible = fitsLuggage;
      // If no single eligible vehicle fits all bags, keep all eligible (admin handles overflow)
    }

    // Pick smallest eligible vehicle that fits both pax and luggage
    let recommended = eligible.find(v =>
      eligible.includes(tier.recommended) && v === tier.recommended
    ) || eligible[0];

    if (!recommended || eligible.length === 0) {
      const regionName = window.DLCRegion?.current?.name || 'This region';
      const regionNameVi = window.DLCRegion?.current?.nameVi || 'Vùng này';
      const regionVeh = getRegionVehicles();
      const maxAvail = regionVeh.maxPassengers;
      return {
        recommended: null,
        eligible: [],
        passengers: pax,
        error: `${regionNameVi} chỉ phục vụ tối đa ${maxAvail} khách mỗi chuyến. Vui lòng liên hệ để đặt nhiều xe.`,
        errorEn: `${regionName} can accommodate up to ${maxAvail} passengers per trip. Please contact us for larger groups.`,
      };
    }

    return {
      recommended: VEHICLES[recommended],
      eligible: eligible.map(v => VEHICLES[v]),
      passengers: pax,
      luggage: bags,
      error: null,
    };
  }

  /**
   * Validate that a specific vehicle can carry the given passengers.
   * Returns { valid, message }
   */
  function validateCapacity(passengers, vehicleType) {
    const pax = parseInt(passengers) || 1;
    const veh = VEHICLES[vehicleType];
    if (!veh) return { valid: false, message: 'Loại xe không hợp lệ / Invalid vehicle type.' };

    if (pax > veh.maxPassengers) {
      const rec = resolveVehicle(pax);
      return {
        valid: false,
        message: `${veh.name} chỉ chở tối đa ${veh.maxPassengers} khách. Bạn cần ${pax} chỗ.`,
        messageEn: `${veh.name} holds max ${veh.maxPassengers} passengers. You need ${pax} seats.`,
        recommendation: rec.recommended,
      };
    }

    return { valid: true, vehicle: veh };
  }

  // ══════════════════════════════════════════════════════════════
  //  GPS PICKUP ESTIMATION
  // ══════════════════════════════════════════════════════════════

  /**
   * Attempt to get user's current GPS location.
   * Returns { lat, lng, address, accuracy } or throws.
   */
  function getGPSLocation() {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('Geolocation not available'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude: lat, longitude: lng, accuracy } = pos.coords;
          // Reverse geocode to get readable address
          let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          try {
            if (typeof google !== 'undefined' && google.maps) {
              const geocoder = new google.maps.Geocoder();
              const result = await new Promise((res, rej) => {
                geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                  if (status === 'OK' && results[0]) res(results[0]);
                  else rej(new Error(status));
                });
              });
              address = result.formatted_address;
            }
          } catch { /* keep coordinate string */ }

          resolve({ lat, lng, address, accuracy: Math.round(accuracy) });
        },
        (err) => reject(err),
        { timeout: 8000, maximumAge: 300000, enableHighAccuracy: false }
      );
    });
  }

  /**
   * Format GPS location as a confirmation prompt for the user.
   */
  function formatGPSConfirmation(location) {
    return {
      vi: `Tôi tìm thấy vị trí hiện tại của bạn:\n📍 ${location.address}\n\nBạn muốn dùng vị trí này làm điểm đón không?`,
      en: `I found your current location:\n📍 ${location.address}\n\nWould you like to use this as your pickup location?`,
    };
  }

  // ══════════════════════════════════════════════════════════════
  //  DROPOFF ADDRESS VERIFICATION
  // ══════════════════════════════════════════════════════════════

  const AMBIGUOUS_PATTERNS = [
    /^(my|the|a|our)\s+(house|home|place|apartment|apt|condo|hotel|motel|office|work)/i,
    /^(nhà|khách sạn|nơi|chỗ)\s/i,
    /^(downtown|midtown|uptown|near|around|by)\b/i,
    /^(trung tâm|gần|khu vực)\b/i,
    /^(the|a)\s+\w+$/i,  // "the Marriott", "a restaurant"
    /^[\w\s]{1,12}$/,     // Very short strings likely incomplete
  ];

  /** Check if a dropoff address is too vague to book */
  function isAmbiguousAddress(text) {
    if (!text || text.trim().length < 5) return true;
    const t = text.trim();
    return AMBIGUOUS_PATTERNS.some(p => p.test(t));
  }

  /** Generate a clarification prompt for ambiguous addresses */
  function suggestClarification(text) {
    const t = (text || '').trim().toLowerCase();
    if (/house|home|nhà/i.test(t)) {
      return {
        vi: 'Vui lòng nhập địa chỉ đầy đủ nhà của bạn (số nhà, đường, thành phố).',
        en: 'Please enter your full home address (street number, street name, city).',
      };
    }
    if (/hotel|khách sạn|marriott|hilton|hyatt/i.test(t)) {
      return {
        vi: `Bạn muốn đến "${t}" ở thành phố nào? Vui lòng nhập tên đầy đủ và thành phố.`,
        en: `Which "${t}" location? Please include the full hotel name and city.`,
      };
    }
    if (/airport|sân bay/i.test(t)) {
      return {
        vi: 'Bạn muốn đến sân bay nào? (SFO, SJC, OAK, LAX, SNA, LGB, ONT, BUR, SAN)',
        en: 'Which airport? (SFO, SJC, OAK, LAX, SNA, LGB, ONT, BUR, SAN)',
      };
    }
    return {
      vi: `"${text}" chưa đủ rõ ràng. Vui lòng nhập địa chỉ đầy đủ (số nhà, đường, thành phố, tiểu bang).`,
      en: `"${text}" is too vague. Please enter a full address (street, city, state).`,
    };
  }

  // ══════════════════════════════════════════════════════════════
  //  FEASIBILITY CHECK
  // ══════════════════════════════════════════════════════════════

  /**
   * Check if a ride can realistically happen at the requested time.
   * Uses driver location (if known) or defaults to service region center.
   *
   * @param {string} pickupLocation  Address or place name
   * @param {Date}   pickupTime      Requested pickup time
   * @param {object} [driverInfo]    Optional { lat, lng, currentLocation }
   * @returns {object} { feasible, etaMinutes, message, nextAvailableTime }
   */
  async function checkFeasibility(pickupLocation, pickupTime, driverInfo) {
    const now = new Date();
    const requestedTime = new Date(pickupTime);

    // Basic time validation
    if (isNaN(requestedTime.getTime())) {
      return { feasible: false, message: 'Thời gian không hợp lệ / Invalid time.' };
    }

    // Can't book in the past
    if (requestedTime < now) {
      return {
        feasible: false,
        message: 'Không thể đặt chuyến trong quá khứ.',
        messageEn: 'Cannot book a ride in the past.',
      };
    }

    const minutesUntilPickup = (requestedTime - now) / 60000;

    // Minimum lead time: 45 minutes for any ride
    const MIN_LEAD_MINUTES = 45;
    if (minutesUntilPickup < MIN_LEAD_MINUTES) {
      const nextAvailable = new Date(now.getTime() + MIN_LEAD_MINUTES * 60000);
      // Round up to next 15 minutes
      nextAvailable.setMinutes(Math.ceil(nextAvailable.getMinutes() / 15) * 15, 0, 0);
      return {
        feasible: false,
        etaMinutes: null,
        message: `Cần ít nhất ${MIN_LEAD_MINUTES} phút để chuẩn bị. Thời gian sớm nhất: ${nextAvailable.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: true })}`,
        messageEn: `We need at least ${MIN_LEAD_MINUTES} minutes to prepare. Earliest available: ${nextAvailable.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`,
        nextAvailableTime: nextAvailable.toISOString(),
      };
    }

    // If driver location is known, estimate drive time to pickup
    if (driverInfo && driverInfo.currentLocation && pickupLocation) {
      try {
        const { durMins } = await window.DLCRouteMatrix(driverInfo.currentLocation, pickupLocation);
        const bufferMins = 15; // buffer for preparation
        const neededMins = durMins + bufferMins;

        if (minutesUntilPickup < neededMins) {
          const nextAvailable = new Date(now.getTime() + neededMins * 60000);
          nextAvailable.setMinutes(Math.ceil(nextAvailable.getMinutes() / 15) * 15, 0, 0);
          return {
            feasible: false,
            etaMinutes: durMins,
            message: `Tài xế cần ~${durMins} phút để đến điểm đón. Thời gian sớm nhất: ${nextAvailable.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: true })}`,
            messageEn: `Driver needs ~${durMins} minutes to reach pickup. Earliest: ${nextAvailable.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`,
            nextAvailableTime: nextAvailable.toISOString(),
          };
        }

        return { feasible: true, etaMinutes: durMins };
      } catch {
        // If route calc fails, fall back to time-based check only
      }
    }

    // Default: feasible if enough lead time
    return { feasible: true, etaMinutes: null };
  }

  // ══════════════════════════════════════════════════════════════
  //  NORMALIZED RIDE OBJECT
  // ══════════════════════════════════════════════════════════════

  /**
   * Build a normalized ride object from any booking source.
   * This is the single structure used for Firestore, driver handoff, and tracking.
   */
  function buildRideObject(params) {
    const {
      pickupLocation,
      dropoffLocation,
      pickupSource = 'typed',  // 'gps-confirmed' | 'typed' | 'airport'
      requestedDateTime,
      passengers = 1,
      serviceType,
      airport,
      terminal,
      lodging,
      days,
      customerName,
      customerPhone,
      riderNotes,
    } = params;

    const pax = Math.max(1, parseInt(passengers) || 1);
    const vehicleInfo = resolveVehicle(pax);
    const vehicle = vehicleInfo.recommended;

    // Determine pricing tier
    const vehicleType = vehicle ? vehicle.type : 'sedan';
    const pricingTier = vehicle ? vehicle.tier : 'standard';

    // Calculate estimate if pricing engine available
    let estimatedFare = null;
    let estimatedDistance = null;
    let estimatedDuration = null;

    return {
      // Location
      pickupLocation: pickupLocation || '',
      dropoffLocation: dropoffLocation || '',
      pickupSource,

      // Timing
      requestedDateTime: requestedDateTime || null,

      // Passengers & vehicle
      passengerCount: pax,
      rideType: serviceType || '',
      vehicleType,
      vehicleName: vehicle ? vehicle.name : 'TBD',
      vehicleCapacity: vehicle ? vehicle.capacity : null,
      pricingTier,

      // Estimates (filled in async by caller)
      estimatedFare,
      estimatedDistance,
      estimatedDuration,

      // Feasibility
      feasibilityStatus: 'pending', // 'pending' | 'feasible' | 'infeasible'

      // Airport info
      airport: airport || null,
      terminal: terminal || null,

      // Tour info
      lodging: lodging || null,
      days: days || null,

      // Customer
      customerName: customerName || '',
      customerPhone: customerPhone || '',
      riderNotes: riderNotes || '',

      // Driver route data (filled after booking)
      driverRouteLink: null,
      driverCurrentLocation: null,
    };
  }

  // ══════════════════════════════════════════════════════════════
  //  FULL-TRIP GPS / MAP LINK
  // ══════════════════════════════════════════════════════════════

  /**
   * Generate a Google Maps link for the full trip.
   * For airport transfers: driver location → pickup → dropoff
   * For tours: pickup → destination (→ return)
   *
   * @param {object} ride  Normalized ride object
   * @param {object} [driverLocation]  Optional { address } or { lat, lng }
   * @returns {string}  Google Maps URL
   */
  function generateMapLink(ride, driverLocation) {
    const encode = encodeURIComponent;
    const baseUrl = 'https://www.google.com/maps/dir/';

    const waypoints = [];

    // Start with driver location if known
    if (driverLocation) {
      if (driverLocation.lat && driverLocation.lng) {
        waypoints.push(`${driverLocation.lat},${driverLocation.lng}`);
      } else if (driverLocation.address) {
        waypoints.push(encode(driverLocation.address));
      }
    }

    // Add pickup
    if (ride.pickupLocation) {
      waypoints.push(encode(ride.pickupLocation));
    }

    // Add dropoff
    if (ride.dropoffLocation) {
      waypoints.push(encode(ride.dropoffLocation));
    }

    if (waypoints.length < 2) return null;

    return baseUrl + waypoints.join('/');
  }

  /**
   * Generate a mobile-friendly navigation link (opens in Google Maps app)
   */
  function generateNavLink(ride, driverLocation) {
    // For mobile: use google.navigation intent with waypoints
    const mapLink = generateMapLink(ride, driverLocation);
    if (!mapLink) return null;
    return mapLink; // Google Maps URLs auto-open in the app on mobile
  }

  // ══════════════════════════════════════════════════════════════
  //  DRIVER HANDOFF PAYLOAD
  // ══════════════════════════════════════════════════════════════

  /**
   * Build the complete payload a driver needs to service a ride.
   */
  function buildDriverPayload(ride, bookingId, driverLocation) {
    const mapLink = generateMapLink(ride, driverLocation);

    return {
      bookingId,
      customerName: ride.customerName,
      customerPhone: ride.customerPhone,
      pickupLocation: ride.pickupLocation,
      pickupSource: ride.pickupSource,
      dropoffLocation: ride.dropoffLocation,
      requestedDateTime: ride.requestedDateTime,
      rideType: ride.rideType,
      vehicleName: ride.vehicleName,
      passengerCount: ride.passengerCount,
      estimatedFare: ride.estimatedFare,
      estimatedDistance: ride.estimatedDistance,
      estimatedDuration: ride.estimatedDuration,
      airport: ride.airport,
      terminal: ride.terminal,
      riderNotes: ride.riderNotes,
      routeMapLink: mapLink,
      pricingTier: ride.pricingTier,
    };
  }

  // ══════════════════════════════════════════════════════════════
  //  AI RIDE RECOMMENDATION
  // ══════════════════════════════════════════════════════════════

  /**
   * Smart ride recommendation based on context.
   * Returns a natural-language recommendation string + structured data.
   */
  function recommendRide({ passengers, luggage, isAirport, destination }) {
    const pax = parseInt(passengers) || 1;
    const res = resolveVehicle(pax);

    if (res.error) {
      return { text: res.error, textEn: res.errorEn, vehicle: null, eligible: [] };
    }

    const rec = res.recommended;
    let text, textEn;

    // Heavy luggage upgrade suggestion
    const heavyLuggage = luggage && /nhiều|heavy|larg|big|golf|ski|surf/i.test(luggage);
    if (heavyLuggage && rec.type === 'sedan') {
      const upgrade = res.eligible.find(v => v.type === 'sienna') || res.eligible.find(v => v.type === 'van');
      if (upgrade) {
        text = `Với ${pax} khách và hành lý nhiều, tôi đề nghị ${upgrade.name} (${upgrade.descriptionVi}) thay vì ${rec.name} để có đủ chỗ cho hành lý.`;
        textEn = `For ${pax} passengers with heavy luggage, I recommend ${upgrade.name} (${upgrade.description}) instead of ${rec.name} for luggage space.`;
        return { text, textEn, vehicle: upgrade, eligible: res.eligible, upgraded: true };
      }
    }

    // Standard recommendation
    if (res.eligible.length === 1) {
      text = `Với ${pax} khách, xe phù hợp duy nhất là ${rec.name} (${rec.descriptionVi}, tối đa ${rec.maxPassengers} khách).`;
      textEn = `For ${pax} passengers, the only suitable vehicle is ${rec.name} (${rec.description}, max ${rec.maxPassengers}).`;
    } else {
      const others = res.eligible.filter(v => v.type !== rec.type).map(v => v.name).join(', ');
      text = `Với ${pax} khách, tôi đề nghị ${rec.name} (${rec.descriptionVi}). Bạn cũng có thể chọn: ${others}.`;
      textEn = `For ${pax} passengers, I recommend ${rec.name} (${rec.description}). Also available: ${others}.`;
    }

    return { text, textEn, vehicle: rec, eligible: res.eligible, upgraded: false };
  }

  // ══════════════════════════════════════════════════════════════
  //  EXPOSE PUBLIC API
  // ══════════════════════════════════════════════════════════════

  return {
    // Vehicle & capacity
    VEHICLES,
    resolveVehicle,
    validateCapacity,
    getRegionVehicles,

    // GPS / location
    getGPSLocation,
    formatGPSConfirmation,

    // Address verification
    isAmbiguousAddress,
    suggestClarification,

    // Feasibility
    checkFeasibility,

    // Ride object
    buildRideObject,

    // Maps / navigation
    generateMapLink,
    generateNavLink,

    // Driver
    buildDriverPayload,

    // AI recommendation
    recommendRide,
  };
})();
