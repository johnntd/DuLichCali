/**
 * Du Lịch Cali — Shared Pricing Engine  v2.0
 *
 * Single source of truth for ALL cost estimates.
 * Used by: booking wizard (script.js), AI chat (chat.js), destination modal.
 *
 * Design rules:
 *   • Core math functions are pure — no DOM reads, no API calls
 *   • getCurrentFormState() is the only DOM-touching helper (optional)
 *   • All functions return plain objects so callers can format freely
 *   • Confidence levels: 'range' = city-level estimate, 'better' = address known
 */

const DLCPricing = (() => {
  'use strict';

  // ── Constants ────────────────────────────────────────────────
  const FUEL_FALLBACK   = 5.00;  // $/gal — used when EIA price not yet loaded
  const VAN_MPG         = 14;    // Mercedes-Benz Sprinter Van fuel economy
  const SIENNA_MPG      = 20;    // Toyota Sienna Hybrid fuel economy
  const TESLA_RATE      = 0.22;  // $/mile energy equivalent for Tesla Model Y
  const BASE_MIN        = 100;   // Minimum transfer fare
  const UBER_DISCOUNT   = 0.20;  // We charge 20% less than Uber

  // ── Uber-equivalent rate estimation (per-mile + per-minute) ──
  // Based on average Uber/Lyft rates in California (2025-2026 market data).
  // UberX: ~$1.50 base + $0.90/mile + $0.25/min
  // UberXL/Van: ~$2.50 base + $1.50/mile + $0.40/min
  // We estimate total trip time as miles / 35 mph average speed.
  const UBER_RATES = {
    sedan: { base: 1.50, perMile: 0.90, perMin: 0.25, bookingFee: 3.50, minFare: 8.00 },
    van:   { base: 2.50, perMile: 1.50, perMin: 0.40, bookingFee: 5.50, minFare: 15.00 },
  };

  // ── Ride-Hailing Rate Card (Airport & Private Ride intake) ─────────────────
  // UberXL-calibrated against real California market prices (2025-2026).
  // Verification: 10 mi / 17 min → $3 + $2.50 + 10×$2.30 + 17×$0.30 = $33.60 ✓ (real UberXL: $25–35)
  // This is the single source of truth — ride-intake.js delegates here.
  const RIDE_RATE_CARD = {
    vehicleName:  'Tesla Model Y',
    vehicleSeats: 4,
    base:         3.00,          // $ base fare per trip
    perMile:      2.30,          // $ per mile (ride distance + deadhead)
    perMin:       0.30,          // $ per minute (ride duration only)
    bookingFee:   2.50,          // $ fixed booking fee
    minFare:      25.00,         // $ minimum fare floor
    discount:     UBER_DISCOUNT, // 0.20 — DLC charges 20% below Uber market rate
  };

  // Sienna (midsize) rates: between sedan and van
  UBER_RATES.sienna = { base: 2.00, perMile: 1.20, perMin: 0.32, bookingFee: 4.50, minFare: 12.00 };

  /** Estimate what Uber would charge for the same trip */
  function estimateUberPrice(miles, vehicleType) {
    const rate = UBER_RATES[vehicleType] || UBER_RATES.sedan;
    const estMinutes = Math.round((miles / 35) * 60); // avg 35 mph
    const uberTotal = rate.base + (miles * rate.perMile) + (estMinutes * rate.perMin) + rate.bookingFee;
    return Math.max(uberTotal, rate.minFare);
  }

  /**
   * Get the correct vehicle pricing tier based on passengers + region.
   * Returns 'sedan' | 'sienna' | 'van'
   */
  function getVehiclePricingTier(passengers, regionId) {
    const pax = Math.max(1, parseInt(passengers) || 1);
    const isBayArea = regionId === 'bayarea' ||
      (typeof window !== 'undefined' && window.DLCRegion && window.DLCRegion.current.id === 'bayarea' && !regionId);

    if (isBayArea) return 'sienna'; // Bay Area only has Sienna
    if (pax <= 3) return 'sedan';
    if (pax <= 7) return 'sienna';
    return 'van';
  }

  /**
   * Calculate a fare for the Airport & Private Ride flow.
   * Uses real route data from Google Routes API (actual miles + duration).
   * Vehicle is selected automatically based on passenger count.
   * Single source of truth — eliminates the duplicate rate card in ride-intake.js.
   *
   * @param {number} miles       Ride distance in miles (pickup → destination)
   * @param {number} durMins     Ride duration in minutes
   * @param {object} [opts]
   * @param {number} [opts.deadheadMiles]  Driver → pickup distance in miles (default 0)
   * @param {number} [opts.passengers]     Passenger count — selects vehicle tier (default 1)
   * @param {string} [opts.regionId]       'bayarea' | 'socal' — affects vehicle availability
   * @returns {{ miles, minutes, deadheadMiles, totalMiles, vehicleName, vehicleSeats, uberEstimate, dlcPrice, savings }}
   */
  function quoteRide(miles, durMins, opts) {
    const dh          = (opts && opts.deadheadMiles) || 0;
    const pax         = Math.max(1, parseInt((opts && opts.passengers) || 1));
    const regionId    = (opts && opts.regionId) || null;
    const vehicleName = getVehicle(pax, regionId);
    const r           = VEHICLE_RATE_CARDS[vehicleName] || VEHICLE_RATE_CARDS['Tesla Model Y'];
    const totalMiles  = miles + dh;
    // Uber-equivalent market rate: base + booking + distance + time
    const uberRaw     = r.base + r.bookingFee + (totalMiles * r.perMile) + (durMins * r.perMin);
    const uberEst     = Math.max(uberRaw, r.minFare);
    // DLC price = Uber baseline × (1 − 20% discount), rounded up to nearest $5
    // dlcMin floor ensures consistency with transferCost() minimums across both booking paths
    const dlcRaw      = uberEst * (1 - UBER_DISCOUNT);
    const dlcPrice    = Math.ceil(Math.max(dlcRaw, r.dlcMin || 80) / 5) * 5;
    return {
      miles:         Math.round(miles),
      minutes:       Math.round(durMins),
      deadheadMiles: Math.round(dh),
      totalMiles:    Math.round(totalMiles),
      vehicleName,
      vehicleSeats:  r.seats,
      uberEstimate:  Math.round(uberEst),
      dlcPrice,
      savings:       Math.round(uberEst) - dlcPrice,
    };
  }

  // ── Approximate distances (one-way miles from Orange County) ─
  const OC_TO_DEST = {
    lasvegas:      270,
    yosemite:      350,
    sanfrancisco:  400,
    losangeles:     35,
    sandiego:       90,
    anaheim:        10,
    napavalley:    430,
    laketahoe:     490,
    monterey:      330,
    '17miledrive': 335,
    palmsprings:   110,
    sequoia:       260,
    santabarbara:  110,
    solvang:       165,
    grandcanyon:   490,
  };

  // Common California city/neighborhood → approximate miles to OC
  const CITY_TO_OC = {
    'irvine':           5,
    'orange county':    5,
    'oc':               5,
    'santa ana':        7,
    'anaheim':         10,
    'garden grove':    10,
    'fullerton':       15,
    'long beach':      20,
    'torrance':        30,
    'los angeles':     35,
    'la':              35,
    'downtown la':     40,
    'culver city':     40,
    'santa monica':    45,
    'pasadena':        45,
    'glendale':        50,
    'burbank':         50,
    'north hollywood': 52,
    'ontario':         55,
    'riverside':       55,
    'san bernardino':  60,
    'temecula':        60,
    'corona':          55,
    'palm springs':   100,
    'san diego':       90,
    'bakersfield':    185,
    'fresno':         280,
    'san jose':       420,
    'san francisco':  400,
    'sf':             400,
    'oakland':        395,
    'sacramento':     500,
    'stockton':       430,
    // New destination cities
    'napa':           430,
    'napa valley':    430,
    'lake tahoe':     490,
    'south lake tahoe': 490,
    'tahoe':          490,
    'monterey':       330,
    'big sur':        335,
    'santa barbara':  110,
    'solvang':        165,
    'sequoia':        260,
    'kings canyon':   265,
    'joshua tree':    120,
    'grand canyon':   490,
    'flagstaff':      480,
    'las vegas':      270,
    'pebble beach':   335,
    '17 mile drive':  335,
  };

  // Airport code → approximate miles to OC
  const AIRPORT_TO_OC = {
    'sna': 5,    // John Wayne (Orange County)
    'lgb': 20,   // Long Beach
    'lax': 40,   // Los Angeles
    'ont': 55,   // Ontario
    'bur': 55,   // Burbank
    'san': 90,   // San Diego
    'sfo': 395,  // San Francisco International
    'oak': 395,  // Oakland International
    'sjc': 420,  // San Jose Mineta
    'smf': 495,  // Sacramento
  };

  // City/airport → destination one-way miles (keyed as `from|destId`)
  // More accurate than computing via OC triangle; covers common origin cities
  const ORIGIN_TO_DEST = {
    // From Orange County / Southern CA
    'orange county|lasvegas':     270, 'oc|lasvegas':           270,
    'irvine|lasvegas':            270, 'anaheim|lasvegas':       275,
    'los angeles|lasvegas':       270, 'la|lasvegas':            270,
    'long beach|lasvegas':        285, 'san diego|lasvegas':     340,
    'riverside|lasvegas':         240, 'ontario|lasvegas':       240,
    'bakersfield|lasvegas':       295, 'fresno|lasvegas':        395,
    'san jose|lasvegas':          510, 'san francisco|lasvegas': 570,
    'sf|lasvegas':                570, 'sacramento|lasvegas':    570,
    'stockton|lasvegas':          490,
    // Yosemite
    'orange county|yosemite':     350, 'oc|yosemite':           350,
    'irvine|yosemite':            350, 'anaheim|yosemite':       345,
    'los angeles|yosemite':       315, 'la|yosemite':            315,
    'long beach|yosemite':        335, 'san diego|yosemite':     435,
    'riverside|yosemite':         310, 'ontario|yosemite':       305,
    'bakersfield|yosemite':       165, 'fresno|yosemite':         75,
    'san jose|yosemite':          155, 'san francisco|yosemite': 185,
    'sf|yosemite':                185, 'sacramento|yosemite':    170,
    'stockton|yosemite':          125,
    // San Francisco
    'orange county|sanfrancisco': 400, 'oc|sanfrancisco':       400,
    'irvine|sanfrancisco':        400, 'anaheim|sanfrancisco':   400,
    'los angeles|sanfrancisco':   380, 'la|sanfrancisco':        380,
    'long beach|sanfrancisco':    390, 'san diego|sanfrancisco': 500,
    'riverside|sanfrancisco':     420, 'ontario|sanfrancisco':   420,
    'bakersfield|sanfrancisco':   280, 'fresno|sanfrancisco':    185,
    'san jose|sanfrancisco':       50, 'sacramento|sanfrancisco': 90,
    'stockton|sanfrancisco':      85,
  };

  // Common city-pair direct distances (keyed as `from|to`, alphabetical order for dedup)
  // Used for city-to-city transfer estimates
  const CITY_PAIRS = {
    'anaheim|los angeles':      35,  'anaheim|san diego':       90,
    'anaheim|san francisco':   400,  'anaheim|san jose':        395,
    'anaheim|sacramento':      480,  'anaheim|las vegas':       275,
    'burbank|los angeles':      15,  'fresno|los angeles':      220,
    'fresno|sacramento':       170,  'fresno|san francisco':    185,
    'fresno|san jose':         170,  'long beach|los angeles':   25,
    'long beach|san diego':    110,  'los angeles|san diego':   120,
    'los angeles|san francisco':380, 'los angeles|san jose':    340,
    'los angeles|sacramento':  385,  'ontario|los angeles':      50,
    'ontario|san diego':       100,  'palm springs|los angeles': 110,
    'riverside|los angeles':    55,  'riverside|san diego':     105,
    'sacramento|san francisco':  90, 'sacramento|san jose':     130,
    'san diego|san francisco':  500, 'san diego|san jose':      500,
    'san francisco|san jose':    50, 'san jose|sacramento':     130,
    'san jose|stockton':         80, 'stockton|sacramento':      50,
    'temecula|los angeles':     80,  'temecula|san diego':       60,
  };

  /** Normalise a city/airport string for lookup */
  function normaliseCity(s) {
    return (s || '').toLowerCase()
      .replace(/\s+airport.*$/i, '')   // strip " airport" suffix
      .replace(/\bca\b\.?/i, '')       // strip state abbreviation
      .trim();
  }

  /** Look up one-way miles from any origin to a destination ID */
  function lookupOriginToDest(originStr, destId) {
    const origin = normaliseCity(originStr);
    // Direct ORIGIN_TO_DEST hit
    const key = `${origin}|${destId}`;
    if (ORIGIN_TO_DEST[key]) return ORIGIN_TO_DEST[key];
    // Partial match in CITY_TO_OC then fall back to OC_TO_DEST
    const ocMiles = lookupCityMiles(origin);
    if (ocMiles !== null) {
      const destMiles = OC_TO_DEST[destId];
      if (destMiles) {
        // Simple linear approximation for origins within CA (not Vegas-bound cross-state)
        // For origins north of OC going to SF/Yosemite the OC distance overshoot is small
        // For origins north going to Vegas the estimate is less accurate but still useful
        if (destId === 'sanfrancisco') {
          // SF is north; from north CA cities it's shorter than from OC
          return Math.max(40, destMiles - ocMiles * 0.85);
        }
        if (destId === 'yosemite') {
          return Math.max(60, destMiles - ocMiles * 0.75);
        }
        if (destId === 'lasvegas') {
          // Vegas is east; from north CA it's actually farther
          return Math.round(destMiles + ocMiles * 0.6);
        }
      }
    }
    return null;
  }

  /** Look up approximate direct miles between two arbitrary cities */
  function lookupCityPairMiles(fromStr, toStr) {
    const a = normaliseCity(fromStr);
    const b = normaliseCity(toStr);
    const key1 = `${a}|${b}`;
    const key2 = `${b}|${a}`;
    if (CITY_PAIRS[key1]) return CITY_PAIRS[key1];
    if (CITY_PAIRS[key2]) return CITY_PAIRS[key2];
    // Fallback: estimate via |CITY_TO_OC[a] - CITY_TO_OC[b]|
    const ma = lookupCityMiles(a);
    const mb = lookupCityMiles(b);
    if (ma !== null && mb !== null) {
      // Rough direct distance; multiply by 1.3 for road vs straight-line
      return Math.round(Math.abs(ma - mb) * 1.3 + 15);
    }
    return null;
  }

  // Lodging cost per night estimates
  const LODGING_RATE = {
    hotel:  150,  // per room
    airbnb: 165,  // per property (up to 8 pax)
  };

  // ── Helpers ──────────────────────────────────────────────────
  function getFuelPrice() {
    return (window._gasCaliPrice && window._gasCaliPrice > 0)
      ? window._gasCaliPrice
      : FUEL_FALLBACK;
  }

  // Vehicle seat capacities — used for capacity warnings and UI display
  const VEHICLE_SEATS = {
    'Tesla Model Y': 4,
    'Toyota Sienna': 7,
    'Mercedes Van':  12,
  };

  // Per-vehicle rate cards for quoteRide() — capacity-aware pricing
  // These are Uber-equivalent market rates; DLC charges UBER_DISCOUNT (20%) less.
  // Tesla (4-seat) · Sienna (7-seat) · Van (12-seat)
  const VEHICLE_RATE_CARDS = {
    // minFare = Uber-equivalent floor (applied before discount)
    // dlcMin  = DLC price floor after 20% discount (must match transferCost() minimums)
    'Tesla Model Y': { seats: 4,  base: 3.00, perMile: 2.30, perMin: 0.30, bookingFee: 2.50, minFare: 25.00, dlcMin: 100 },
    'Toyota Sienna': { seats: 7,  base: 4.00, perMile: 3.00, perMin: 0.40, bookingFee: 3.50, minFare: 35.00, dlcMin: 120 },
    'Mercedes Van':  { seats: 12, base: 6.00, perMile: 3.80, perMin: 0.55, bookingFee: 5.00, minFare: 60.00, dlcMin: 140 },
  };

  function getVehicle(passengers, regionId) {
    var pax = Math.max(1, parseInt(passengers) || 1);
    var isBayArea = regionId === 'bayarea' ||
      (typeof window !== 'undefined' && window.DLCRegion &&
       window.DLCRegion.current && window.DLCRegion.current.id === 'bayarea' && !regionId);
    if (isBayArea) {
      // Bay Area: no Tesla in fleet — Sienna is the base vehicle
      return pax > 7 ? 'Mercedes Van' : 'Toyota Sienna';
    }
    // SoCal + default: 3-tier capacity matching
    if (pax <= 3) return 'Tesla Model Y';   // 1–3 pax → 4-seat Tesla
    if (pax <= 7) return 'Toyota Sienna';   // 4–7 pax → 7-seat Sienna
    return 'Mercedes Van';                  // 8+ pax → 12-seat Van
  }

  function lookupCityMiles(query) {
    if (!query) return null;
    const q = query.toLowerCase().trim();
    for (const [key, miles] of Object.entries(CITY_TO_OC)) {
      if (q.includes(key) || key.includes(q)) return miles;
    }
    return null;
  }

  function lookupAirportMiles(query) {
    if (!query) return null;
    const q = query.toLowerCase().trim();
    for (const [code, miles] of Object.entries(AIRPORT_TO_OC)) {
      if (q.includes(code)) return miles;
    }
    return null;
  }

  // ── Core Math: Transfer cost by exact miles ──────────────────
  /**
   * Smart pricing: estimate Uber equivalent, then charge 20% less.
   * Van (4+ passengers) costs more than sedan (1-3 passengers).
   *
   * @param {number} miles      One-way distance
   * @param {number} passengers Number of passengers
   * @returns {number}          Estimated cost in USD (rounded)
   */
  function transferCost(miles, passengers, regionId) {
    const vehType    = getVehiclePricingTier(passengers, regionId);
    const isVan      = vehType === 'van';
    const isSienna   = vehType === 'sienna';
    const uberPrice  = estimateUberPrice(miles, vehType);

    // Our price = Uber price minus 20% discount
    let ourPrice = uberPrice * (1 - UBER_DISCOUNT);

    // Long-haul adjustments (driver time, overnight, etc.)
    const longHaul = miles > 300;
    if (longHaul) {
      // Add driver compensation for long trips
      ourPrice += 250;
      if (isVan) ourPrice += 75;
      else if (isSienna) ourPrice += 50;
    } else if (miles > 100) {
      // Medium distance: small surcharge for highway tolls/time
      ourPrice += miles * 0.10;
    }

    // Enforce minimum fare by vehicle tier
    const minFare = isVan ? 140 : isSienna ? 120 : BASE_MIN;
    ourPrice = Math.max(minFare, ourPrice);

    return Math.round(ourPrice);
  }

  /** Returns transfer cost breakdown with Uber comparison */
  function transferCostWithComparison(miles, passengers, regionId) {
    const vehType   = getVehiclePricingTier(passengers, regionId);
    const uberPrice = estimateUberPrice(miles, vehType);
    const ourPrice  = transferCost(miles, passengers, regionId);
    const savings   = Math.round(uberPrice - ourPrice);
    return {
      ourPrice,
      uberEstimate: Math.round(uberPrice),
      savings,
      savingsPercent: Math.round((savings / uberPrice) * 100),
      vehicleType: vehType,
    };
  }

  // ── Core Math: Tour cost by distance + trip params ───────────
  /**
   * @param {number} miles      One-way miles from OC to destination
   * @param {number} passengers
   * @param {number} days       Number of trip days
   * @param {string} lodging    '' | 'hotel' | 'airbnb'
   * @returns {number}          Estimated total cost in USD (rounded)
   */
  function tourCost(miles, passengers, days, lodging) {
    const gasPrice       = getFuelPrice();
    const isVan          = passengers > 3;
    const mpg            = isVan ? VAN_MPG : 30; // Van MPG vs Tesla-equivalent for sedan
    const fuelPerMile    = gasPrice / mpg;
    const roundtripMiles = miles * 2;

    let lodgingCost = 0;
    if (lodging === 'hotel') {
      const rooms  = passengers > 8 ? 3 : passengers > 4 ? 2 : 1;
      lodgingCost  = rooms * LODGING_RATE.hotel * days;
    } else if (lodging === 'airbnb') {
      const units  = Math.ceil(passengers / 8);
      lodgingCost  = units * LODGING_RATE.airbnb * days;
    }

    // Driver overnight accommodation: for trips >75 miles the driver must stay at the
    // destination. Charged per night away from home (a days-day tour = days-1 nights).
    // $120/night covers a budget hotel room for the driver.
    const driverNights = miles > 75 && days > 1 ? days - 1 : 0;
    const driverAccomm = driverNights * 120;

    // Vehicle wear allowance (misc costs: parking, tolls, vehicle upkeep)
    const wearCost = (passengers > 8 ? 100 : passengers > 4 ? 75 : 50) * days;

    // Base driver daily rate: higher for van (larger vehicle, more responsibility)
    const driverRate = isVan ? 220 : 180;

    // Note: estimateUberPrice uses 35 mph average which only applies to short urban trips.
    // Multi-day highway tours are not an Uber use case — we use cost-based pricing only.
    let cost = (driverRate + roundtripMiles * fuelPerMile) * days
               + lodgingCost
               + 50 * days      // service/tolls/misc
               + driverAccomm   // driver hotel for overnight trips
               + wearCost;

    // Daily minimum floor (covers vehicle depreciation + driver base compensation)
    cost = Math.max(cost, (isVan ? 350 : 300) * days);
    return Math.round(cost);
  }

  // ── Public: Tour estimate by destination ID ──────────────────
  /**
   * Returns a full estimate object for a known destination.
   * Confidence = 'range' because we use approximate OC distances, not exact pickup address.
   *
   * @param {object} params
   * @param {string} params.destId        'lasvegas' | 'yosemite' | 'sanfrancisco'
   * @param {number} [params.passengers]  Default 2
   * @param {number} [params.days]        Default 2
   * @param {string} [params.lodging]     '' | 'hotel' | 'airbnb'
   * @returns {object|null}
   */
  function estimateTour({ destId, passengers = 2, days = 2, lodging = '', regionId = null, vehicleOverride = null }) {
    const miles = OC_TO_DEST[destId];
    if (!miles) return null;
    const p    = Math.max(1, passengers);
    const d    = Math.max(1, days);
    const cost = tourCost(miles, p, d, lodging);
    return {
      type:       'tour',
      destId,
      total:      cost,
      perPerson:  Math.round(cost / p),
      // Vehicle comes from live Firestore driver data via vehicleOverride.
      // Falls back to region-based selection when no driver data is available.
      vehicle:    vehicleOverride || getVehicle(p, regionId),
      miles,
      passengers: p,
      days:       d,
      lodging,
      gasPrice:   getFuelPrice(),
      confidence: 'range',   // based on OC avg, not exact pickup
    };
  }

  // ── Public: Airport/transfer estimate by city or airport ─────
  /**
   * @param {object} params
   * @param {string} [params.fromCity]    User's city/area name
   * @param {string} [params.airport]     Airport code e.g. 'LAX'
   * @param {number} [params.passengers]  Default 2
   * @param {string} [params.direction]   'pickup' | 'dropoff'
   * @returns {object|null}  null if city/airport not in lookup table
   */
  function estimateTransfer({ fromCity = '', airport = '', passengers = 2, direction = 'pickup' }) {
    const p = Math.max(1, passengers);
    let miles = lookupCityMiles(fromCity)
             || lookupAirportMiles(airport)
             || lookupCityMiles(airport);
    if (!miles) return null;
    const cost = transferCost(miles, p);
    return {
      type:       'transfer',
      total:      cost,
      perPerson:  Math.round(cost / p),
      vehicle:    getVehicle(p),
      miles,
      passengers: p,
      direction,
      fromCity,
      airport,
      confidence: 'range',
    };
  }

  // ── Public: Compare all tour destinations ────────────────────
  /**
   * Returns estimates for every known destination, sorted cheapest first.
   */
  function compareTours({ passengers = 2, days = 2, lodging = '' } = {}) {
    return Object.keys(OC_TO_DEST)
      .map(id => ({ id, est: estimateTour({ destId: id, passengers, days, lodging }) }))
      .filter(x => x.est)
      .sort((a, b) => a.est.total - b.est.total);
  }

  // ── Public: Read current booking form state ──────────────────
  /**
   * Returns the current values from the booking wizard form.
   * Returns zeros/empty strings if elements don't exist.
   */
  function getCurrentFormState() {
    const g = id => document.getElementById(id)?.value || '';
    return {
      serviceType: g('serviceType') || (window.currentService || ''),
      passengers:  Math.max(1, parseInt(g('passengers')) || 1),
      airport:     g('airport'),
      address:     g('address'),
      lodging:     g('lodging'),
      days:        Math.max(1, parseInt(g('days')) || 1),
      hasAddress:  (g('address') || '').length > 3,
    };
  }

  // ── Public: Human-readable breakdown string ──────────────────
  /**
   * Returns a short explanation of what goes into the estimate.
   */
  function explainTour({ destId, passengers = 2, days = 2, lodging = '' }) {
    const est = estimateTour({ destId, passengers, days, lodging });
    if (!est) return null;
    const gas      = est.gasPrice.toFixed(2);
    const rtMiles  = est.miles * 2;
    const fuelCost = Math.round((rtMiles / VAN_MPG) * est.gasPrice * days);
    const baseDrv  = 180 * days;
    const lodgLine = lodging
      ? `chỗ ở ~$${lodging === 'hotel'
          ? (passengers > 8 ? 3 : passengers > 4 ? 2 : 1) * 150
          : Math.ceil(passengers / 8) * 165}/đêm × ${days} đêm`
      : 'chưa bao gồm chỗ ở';
    return `Ước tính dựa trên: ${rtMiles} dặm khứ hồi × xăng $${gas}/gal + phí tài xế $${baseDrv} + phí dịch vụ + ${lodgLine}.`;
  }

  // ── Public: Route estimate from any origin city to a destination ─
  /**
   * Like estimateTour but uses the origin city's actual distance,
   * not the default OC-based distance.
   *
   * @param {object} params
   * @param {string} params.fromCity   Origin city name (e.g. "San Jose")
   * @param {string} params.destId     'lasvegas' | 'yosemite' | 'sanfrancisco'
   * @param {number} [params.passengers]
   * @param {number} [params.days]
   * @param {string} [params.lodging]
   * @returns {object|null}
   */
  function estimateFromCity({ fromCity, destId, passengers = 2, days = 2, lodging = '' }) {
    const p     = Math.max(1, passengers);
    const d     = Math.max(1, days);
    const miles = lookupOriginToDest(fromCity, destId);
    if (!miles) return null;
    const cost = tourCost(miles, p, d, lodging);
    return {
      type:       'tour',
      destId,
      fromCity,
      total:      cost,
      perPerson:  Math.round(cost / p),
      vehicle:    getVehicle(p),
      miles,
      passengers: p,
      days:       d,
      lodging,
      gasPrice:   getFuelPrice(),
      confidence: 'range',
    };
  }

  // ── Public: General city-to-city transfer estimate ───────────
  /**
   * Estimates a point-to-point transfer between two arbitrary cities.
   * Used for "How much from San Jose to San Francisco?" type queries.
   *
   * @param {object} params
   * @param {string} params.from        Origin city / address
   * @param {string} params.to          Destination city / address
   * @param {number} [params.passengers]
   * @param {boolean} [params.roundTrip] Default false
   * @returns {object|null}
   */
  function estimateCityToCity({ from, to, passengers = 2, roundTrip = false }) {
    const p     = Math.max(1, passengers);
    const fNorm = normaliseCity(from);
    const tNorm = normaliseCity(to);

    // First try exact pair lookup
    let miles = lookupCityPairMiles(fNorm, tNorm);

    // If no direct pair, try via CITY_TO_OC as common reference
    if (!miles) {
      const mf = lookupCityMiles(fNorm) || lookupAirportMiles(fNorm);
      const mt = lookupCityMiles(tNorm) || lookupAirportMiles(tNorm);
      if (mf !== null && mt !== null) {
        // Estimate direct distance as difference * road factor
        miles = Math.round(Math.abs(mf - mt) * 1.3 + 15);
      }
    }
    if (!miles) return null;

    const totalMiles = roundTrip ? miles * 2 : miles;
    const cost       = transferCost(totalMiles, p);
    return {
      type:       'cityToCity',
      from,
      to,
      total:      cost,
      perPerson:  Math.round(cost / p),
      vehicle:    getVehicle(p),
      miles,
      roundTrip,
      passengers: p,
      confidence: 'range',
    };
  }

  // ── Travel package quote ─────────────────────────────────────
  /**
   * Calculate a price quote for a travel package booking.
   * @param {object} pkg          A DLC_TRAVEL_PACKAGES entry
   * @param {'private'|'group'} type  Booking type
   * @param {number} travelers    Number of travelers (used for group type)
   * @param {string} pickupRegion 'bayarea' | 'socal' — affects deadhead surcharge
   * @returns {{ type, travelers, subtotal, taxes, total, pricePerPerson, vehicle, breakdown }}
   */
  /**
   * Resolve private-pricing tier key for a given party size.
   * Returns { basePrice, tierKey } — tierKey is null when flat pricing used.
   */
  function _travelPrivateTier(pkg, pax) {
    var tiers = pkg.pricing_private;
    if (tiers && typeof tiers === 'object') {
      if (pax <= 2) return { basePrice: tiers['1_2'],  tierKey: '1_2'  };
      if (pax <= 5) return { basePrice: tiers['3_5'],  tierKey: '3_5'  };
      if (pax <= 7) return { basePrice: tiers['6_7'],  tierKey: '6_7'  };
      return            { basePrice: tiers['8_12'], tierKey: '8_12' };
    }
    return { basePrice: pkg.base_price_private || 0, tierKey: null };
  }

  function calculateTravelQuote(pkg, type, travelers, pickupRegion) {
    const pax      = Math.max(1, parseInt(travelers) || 1);
    const TAX_RATE = 0.0875;

    // ── Regional price adjustment ────────────────────────────────────────────
    // Packages define departure_region_adjustments keyed by 'bayarea' | 'socal'.
    // If the package has no adjustments, or the region is unknown, fall back to
    // bayarea (multiplier 1.0) so legacy packages continue working unchanged.
    const adjMap   = (pkg && pkg.departure_region_adjustments) || {};
    const rKey     = pickupRegion || 'bayarea';
    const adj      = adjMap[rKey] || adjMap['bayarea'] || { multiplier: 1.0, label: '' };
    const mult     = (adj.multiplier != null) ? adj.multiplier : 1.0;
    const rLabel   = adj.label || '';

    let subtotal, pricePerPerson, tierKey;

    if (type === 'private') {
      const tier    = _travelPrivateTier(pkg, pax);
      tierKey       = tier.tierKey;
      subtotal      = Math.round((tier.basePrice || 0) * mult);
      pricePerPerson = null;
    } else {
      tierKey        = null;
      pricePerPerson = Math.round((pkg.base_price_per_person_group || 0) * mult);
      subtotal       = pricePerPerson * pax;
    }

    const taxes       = Math.round(subtotal * TAX_RATE);
    const total       = subtotal + taxes;
    const vehicleName = getVehicle(pax, 'bayarea'); // vehicle size by pax

    return {
      type,
      travelers:    pax,
      pickupRegion: rKey,
      regionLabel:  rLabel,
      subtotal,
      taxes,
      total,
      pricePerPerson,
      vehicle:      vehicleName,
      breakdown: {
        base:             type === 'private'
          ? (pkg.pricing_private && tierKey ? pkg.pricing_private[tierKey] : pkg.base_price_private)
          : pkg.base_price_per_person_group,
        tierKey,
        taxRate:          '8.75%',
        regionMultiplier: mult,
        regionLabel:      rLabel,
      },
    };
  }

  // ── Expose ───────────────────────────────────────────────────
  return {
    // Core math (used by script.js updateEstimate)
    transferCost,
    transferCostWithComparison,
    tourCost,
    estimateUberPrice,
    getVehiclePricingTier,
    // Ride-hailing fare engine (used by ride-intake.js)
    quoteRide,
    RIDE_RATE_CARD,       // backwards-compat: Tesla-only rate card
    VEHICLE_RATE_CARDS,   // capacity-aware rate cards keyed by vehicle name
    VEHICLE_SEATS,
    // Higher-level estimates (used by AI chat)
    estimateTour,
    estimateTransfer,
    estimateFromCity,
    estimateCityToCity,
    compareTours,
    explainTour,
    // Travel package pricing
    calculateTravelQuote,
    // Context helpers
    getCurrentFormState,
    getFuelPrice,
    getVehicle,
    normaliseCity,
    // Lookup data (useful for chat context)
    OC_TO_DEST,
    CITY_TO_OC,
    AIRPORT_TO_OC,
    ORIGIN_TO_DEST,
    FUEL_FALLBACK,
    UBER_DISCOUNT,
  };
})();
