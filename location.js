/**
 * location.js — DLCLocation module
 * Browser geolocation, reverse geocoding, airport proximity, landmark awareness.
 * All features degrade gracefully — nothing blocks the UI if location is denied.
 */
window.DLCLocation = (function () {

  // ── Airport coordinates ──────────────────────────────────────────────────────
  var AIRPORTS = {
    SJC: { name: 'San José Intl',              lat: 37.3639, lng: -121.9289 },
    SFO: { name: 'San Francisco Intl',         lat: 37.6213, lng: -122.3790 },
    OAK: { name: 'Oakland Intl',               lat: 37.7213, lng: -122.2208 },
    SMF: { name: 'Sacramento Intl',            lat: 38.6954, lng: -121.5908 },
    LAX: { name: 'Los Angeles Intl',           lat: 33.9425, lng: -118.4081 },
    SNA: { name: 'John Wayne (Orange County)', lat: 33.6762, lng: -117.8675 },
    BUR: { name: 'Hollywood Burbank',          lat: 34.2007, lng: -118.3587 },
    LGB: { name: 'Long Beach',                 lat: 33.8177, lng: -118.1516 },
    ONT: { name: 'Ontario Intl',               lat: 34.0560, lng: -117.6009 },
    SAN: { name: 'San Diego Intl',             lat: 32.7338, lng: -117.1933 },
    PSP: { name: 'Palm Springs Intl',          lat: 33.8297, lng: -116.5068 },
  };

  // ── Known landmarks → {city, airport, lat, lng} ──────────────────────────────
  var LANDMARKS = {
    'santana row':         { city: 'san jose',       airport: 'SJC', lat: 37.3196, lng: -121.9477 },
    'san jose downtown':   { city: 'san jose',       airport: 'SJC', lat: 37.3382, lng: -121.8863 },
    'silicon valley':      { city: 'san jose',       airport: 'SJC', lat: 37.3861, lng: -122.0839 },
    'stanford university': { city: 'palo alto',      airport: 'SFO', lat: 37.4275, lng: -122.1697 },
    'stanford':            { city: 'palo alto',      airport: 'SFO', lat: 37.4275, lng: -122.1697 },
    'golden gate':         { city: 'san francisco',  airport: 'SFO', lat: 37.8199, lng: -122.4783 },
    'fisherman':           { city: 'san francisco',  airport: 'SFO', lat: 37.8080, lng: -122.4177 },
    'ghirardelli':         { city: 'san francisco',  airport: 'SFO', lat: 37.8058, lng: -122.4225 },
    'union square':        { city: 'san francisco',  airport: 'SFO', lat: 37.7880, lng: -122.4076 },
    'disneyland':          { city: 'anaheim',        airport: 'SNA', lat: 33.8121, lng: -117.9190 },
    'california adventure':{ city: 'anaheim',        airport: 'SNA', lat: 33.8091, lng: -117.9183 },
    'knott':               { city: 'buena park',     airport: 'SNA', lat: 33.8444, lng: -118.0021 },
    'rodeo drive':         { city: 'beverly hills',  airport: 'LAX', lat: 34.0683, lng: -118.4014 },
    'beverly hills':       { city: 'beverly hills',  airport: 'LAX', lat: 34.0736, lng: -118.4004 },
    'santa monica':        { city: 'santa monica',   airport: 'LAX', lat: 34.0195, lng: -118.4912 },
    'venice beach':        { city: 'los angeles',    airport: 'LAX', lat: 33.9850, lng: -118.4695 },
    'universal studios':   { city: 'los angeles',    airport: 'BUR', lat: 34.1381, lng: -118.3534 },
    'hollywood':           { city: 'hollywood',      airport: 'BUR', lat: 34.0928, lng: -118.3287 },
    'griffith':            { city: 'los angeles',    airport: 'BUR', lat: 34.1184, lng: -118.3004 },
    'little saigon':       { city: 'westminster',    airport: 'SNA', lat: 33.7497, lng: -117.9953 },
    'westminster':         { city: 'westminster',    airport: 'SNA', lat: 33.7513, lng: -117.9939 },
    'garden grove':        { city: 'garden grove',   airport: 'SNA', lat: 33.7739, lng: -117.9425 },
    'orange county':       { city: 'orange county',  airport: 'SNA', lat: 33.7879, lng: -117.8531 },
    'irvine':              { city: 'irvine',         airport: 'SNA', lat: 33.6846, lng: -117.8265 },
    'las vegas strip':     { city: 'las vegas',      airport: 'LAS', lat: 36.1147, lng: -115.1728 },
    'grand canyon':        { city: 'grand canyon',   airport: 'FLG', lat: 36.0565, lng: -112.1401 },
    'yosemite':            { city: 'yosemite',       airport: 'YOS', lat: 37.8651, lng: -119.5383 },
    'napa valley':         { city: 'napa',           airport: 'SFO', lat: 38.5025, lng: -122.2654 },
    'monterey':            { city: 'monterey',       airport: 'MRY', lat: 36.6002, lng: -121.8947 },
    'san diego':           { city: 'san diego',      airport: 'SAN', lat: 32.7157, lng: -117.1611 },
    // Airport codes as text → same airport
    'sjc':  { city: 'san jose',       airport: 'SJC', lat: 37.3639, lng: -121.9289 },
    'sfo':  { city: 'san francisco',  airport: 'SFO', lat: 37.6213, lng: -122.3790 },
    'oak':  { city: 'oakland',        airport: 'OAK', lat: 37.7213, lng: -122.2208 },
    'lax':  { city: 'los angeles',    airport: 'LAX', lat: 33.9425, lng: -118.4081 },
    'sna':  { city: 'orange county',  airport: 'SNA', lat: 33.6762, lng: -117.8675 },
    'bur':  { city: 'burbank',        airport: 'BUR', lat: 34.2007, lng: -118.3587 },
    'lgb':  { city: 'long beach',     airport: 'LGB', lat: 33.8177, lng: -118.1516 },
    'ont':  { city: 'ontario',        airport: 'ONT', lat: 34.0560, lng: -117.6009 },
    'smf':  { city: 'sacramento',     airport: 'SMF', lat: 38.6954, lng: -121.5908 },
    'san':  { city: 'san diego',      airport: 'SAN', lat: 32.7338, lng: -117.1933 },
  };

  // ── State ────────────────────────────────────────────────────────────────────
  var state = {
    lat: null, lng: null,
    place: null, city: null, region: null,
    timestamp: null,
    permitted: null, // null=not asked, true=granted, false=denied
  };

  // Restore from sessionStorage (1-hour TTL)
  try {
    var saved = sessionStorage.getItem('dlc_location');
    if (saved) {
      var parsed = JSON.parse(saved);
      if (parsed && parsed.timestamp && (Date.now() - parsed.timestamp) < 3600000) {
        state.lat       = parsed.lat       || null;
        state.lng       = parsed.lng       || null;
        state.place     = parsed.place     || null;
        state.city      = parsed.city      || null;
        state.region    = parsed.region    || null;
        state.timestamp = parsed.timestamp || null;
        state.permitted = parsed.permitted != null ? parsed.permitted : null;
      }
    }
  } catch (_) {}

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function haversineKm(lat1, lng1, lat2, lng2) {
    var R    = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a    = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
               Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
               Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function save() {
    try { sessionStorage.setItem('dlc_location', JSON.stringify(state)); } catch (_) {}
  }

  // ── Reverse geocode using Google Maps Geocoder ───────────────────────────────
  function reverseGeocode(lat, lng, cb) {
    if (typeof google === 'undefined' || !google.maps || !google.maps.Geocoder) {
      cb(null);
      return;
    }
    try {
      new google.maps.Geocoder().geocode({ location: { lat: lat, lng: lng } }, function (results, status) {
        if (status !== 'OK' || !results || !results.length) { cb(null); return; }
        var place  = results[0].formatted_address;
        var city   = null;
        var region = null;
        var comps  = results[0].address_components || [];
        for (var i = 0; i < comps.length; i++) {
          var c = comps[i];
          if (!city && (c.types.indexOf('locality') >= 0 || c.types.indexOf('sublocality_level_1') >= 0)) {
            city = c.long_name;
          }
          if (!region && c.types.indexOf('administrative_area_level_1') >= 0) {
            region = c.short_name; // "CA", "NV", etc.
          }
        }
        cb({ place: place, city: city, region: region });
      });
    } catch (_) { cb(null); }
  }

  // ── Public: request location ─────────────────────────────────────────────────
  function request(onSuccess, onDenied) {
    // Use cached location if fresh (< 1 hour)
    if (state.lat && state.timestamp && (Date.now() - state.timestamp) < 3600000) {
      if (onSuccess) onSuccess(state);
      return;
    }
    if (!navigator.geolocation) {
      if (onDenied) onDenied('not_supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        state.lat       = pos.coords.latitude;
        state.lng       = pos.coords.longitude;
        state.timestamp = Date.now();
        state.permitted = true;
        save();
        // Async reverse geocode — state still available with lat/lng immediately
        reverseGeocode(state.lat, state.lng, function (geo) {
          if (geo) {
            state.place  = geo.place;
            state.city   = geo.city;
            state.region = geo.region;
            save();
          }
          if (onSuccess) onSuccess(state);
        });
      },
      function (err) {
        state.permitted = false;
        save();
        if (onDenied) onDenied(err.code === 1 ? 'denied' : 'unavailable');
      },
      { timeout: 8000, maximumAge: 300000 }
    );
  }

  // ── Public: nearest N airports sorted by distance ───────────────────────────
  function nearestAirports(n) {
    var count = n || 3;
    var codes = Object.keys(AIRPORTS);
    if (!state.lat) {
      // No location — return top airports for NorCal/SoCal context
      return ['SJC', 'SFO', 'OAK', 'LAX', 'SNA'].slice(0, count).map(function (code) {
        return { code: code, name: AIRPORTS[code].name, km: null };
      });
    }
    var sorted = codes.map(function (code) {
      var a  = AIRPORTS[code];
      var km = haversineKm(state.lat, state.lng, a.lat, a.lng);
      return { code: code, name: a.name, km: Math.round(km) };
    }).sort(function (a, b) { return a.km - b.km; });
    return sorted.slice(0, count);
  }

  function nearestAirport() {
    var list = nearestAirports(1);
    return list.length ? list[0] : null;
  }

  // ── Public: look up a known landmark/place name in text ─────────────────────
  // Returns {city, airport, lat, lng} or null
  function lookupLandmark(text) {
    if (!text) return null;
    var t    = text.toLowerCase();
    var best = null;
    var bestLen = 0;
    var keys = Object.keys(LANDMARKS);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (t.indexOf(key) >= 0 && key.length > bestLen) {
        best    = LANDMARKS[key];
        bestLen = key.length;
      }
    }
    return best;
  }

  // ── Public: structured location context string for Claude system prompt ──────
  function getContext() {
    if (!state.lat) return null;
    var nearList = nearestAirports(3).map(function (a) {
      return a.code + (a.km !== null ? ' (~' + a.km + ' km)' : '');
    }).join(', ');
    var parts = [];
    if (state.city)   parts.push('City: ' + state.city);
    else if (state.place) parts.push('Near: ' + state.place);
    if (state.region) parts.push('State: ' + state.region);
    parts.push('Nearest airports: ' + nearList);
    return 'CUSTOMER CURRENT LOCATION: ' + parts.join(' | ');
  }

  // ── Public: suggested pickup label for AI workflows ─────────────────────────
  function pickupHint() {
    if (!state.lat) return null;
    return state.city || state.place || null;
  }

  // ── Expose public API ────────────────────────────────────────────────────────
  return {
    state:          state,
    request:        request,
    nearestAirports: nearestAirports,
    nearestAirport: nearestAirport,
    lookupLandmark: lookupLandmark,
    getContext:     getContext,
    pickupHint:     pickupHint,
    AIRPORTS:       AIRPORTS,
    LANDMARKS:      LANDMARKS,
  };

}());
