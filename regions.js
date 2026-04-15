/**
 * Du Lịch Cali — Regional Service Configuration  v1.1
 *
 * Single source of truth for:
 *   - Region definitions (hosts, vehicles, airports, coverage)
 *   - Region detection (geolocation bounding box, text keywords, sessionStorage)
 *   - AI context builder (used by chat.js system prompt)
 *
 * Usage:
 *   DLCRegion.init(callback)          // detect + call callback(region)
 *   DLCRegion.setRegion(id, callback) // manual override + persists for session
 *   DLCRegion.current                 // active region config object
 *   DLCRegion.detectFromText(text)    // text-based detection for chat
 *   DLCRegion.buildAIRegionContext()  // AI system prompt string
 *
 * To add a new region: add an entry to _DLC_REGIONS below — no other changes needed.
 */

// ── Region Definitions ────────────────────────────────────────
const _DLC_REGIONS = {

  bayarea: {
    id:        'bayarea',
    name:      'Bay Area',
    nameVi:    'Bay Area',

    // First host = primary (used for app bar call button, fallback phone)
    hosts: [
      { name: 'Du Lịch Cali', phone: '4089163439', display: '408-916-3439' },
    ],

    vehicle:  { name: 'Toyota Sienna', seats: 8 },
    airports: ['SFO', 'SJC', 'OAK'],

    // Keywords for text-based region detection (chat, address fields)
    keywords: [
      'bay area', 'san jose', 'san francisco', 'oakland', 'fremont',
      'sunnyvale', 'santa clara', 'milpitas', 'cupertino', 'mountain view',
      'palo alto', 'redwood city', 'san mateo', 'daly city', 'hayward',
      'berkeley', 'walnut creek', 'concord', 'pleasanton', 'livermore',
      'gilroy', 'morgan hill', 'campbell', 'los gatos', 'saratoga',
      'sfo', 'sjc', 'oak', 'smf',
      'san francisco international', 'mineta san jose', 'metro oakland', 'sacramento international',
    ],

    // Bounding box for GPS-based detection
    geoBounds: { latMin: 36.8, latMax: 38.5, lngMin: -123.0, lngMax: -121.5 },

    serviceNote:   'Phục vụ Bay Area · Bắc California',
    serviceNoteEn: 'Serving Bay Area · Northern California',
  },

  oc: {
    id:        'oc',
    name:      'Orange County',
    nameVi:    'Orange County',

    // First host = primary
    hosts: [
      { name: 'Du Lịch Cali', phone: '4089163439', display: '408-916-3439' },
    ],

    vehicle:  { name: 'Tesla Model Y / Mercedes Van', seats: 12 },
    airports: ['LAX', 'SNA', 'LGB', 'ONT', 'BUR', 'SAN'],

    keywords: [
      'orange county', 'anaheim', 'irvine', 'santa ana', 'garden grove',
      'westminster', 'fountain valley', 'huntington beach', 'newport beach',
      'fullerton', 'buena park', 'tustin', 'costa mesa', 'mission viejo',
      'los angeles', 'riverside', 'corona', 'ontario', 'pomona',
      'long beach', 'torrance', 'pasadena', 'burbank', 'glendale',
      'san diego', 'lax', 'sna', 'lgb', 'ont', 'bur',
      'john wayne', 'los angeles international', 'long beach airport',
      'ontario airport', 'burbank airport',
    ],

    geoBounds: { latMin: 32.5, latMax: 34.8, lngMin: -118.6, lngMax: -116.0 },

    serviceNote:   'Phục vụ Orange County · Nam California',
    serviceNoteEn: 'Serving Orange County · Southern California',
  },

};

const _DLC_DEFAULT_REGION_ID  = 'oc';
const _DLC_REGION_STORAGE_KEY = 'dlc_region';

// ── Public API ────────────────────────────────────────────────
window.DLCRegion = {

  _current: null,

  /** Active region config. Returns default if init() not yet called. */
  get current() {
    return this._current || _DLC_REGIONS[_DLC_DEFAULT_REGION_ID];
  },

  /** All region config objects keyed by id. */
  get all() {
    return _DLC_REGIONS;
  },

  /**
   * Detect and set the active region.
   * Priority: sessionStorage saved preference → geolocation → default (oc)
   * Fires default immediately so UI is never blank, then updates if geo succeeds.
   *
   * @param {Function} onRegionSet  Called with region config when determined.
   */
  async init(onRegionSet) {
    // 1. Saved manual preference (survives page reloads for this session)
    const saved = sessionStorage.getItem(_DLC_REGION_STORAGE_KEY);
    if (saved && _DLC_REGIONS[saved]) {
      this._current = _DLC_REGIONS[saved];
      if (onRegionSet) onRegionSet(this._current);
      return;
    }

    // 2a. Fire default immediately so UI renders without waiting for GPS
    this._current = _DLC_REGIONS[_DLC_DEFAULT_REGION_ID];
    if (onRegionSet) onRegionSet(this._current);

    // 2b. Try GPS geolocation — updates UI if a better match is found
    if (!('geolocation' in navigator)) {
      this._tryIPGeolocation(onRegionSet);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const detected = this._detectFromCoords(pos.coords.latitude, pos.coords.longitude);
        if (detected.id !== this._current.id) {
          this._current = detected;
          if (onRegionSet) onRegionSet(this._current);
        }
      },
      () => {
        // GPS denied or timed out — fall back to IP-based detection
        // so Bay Area users don't silently default to Orange County.
        this._tryIPGeolocation(onRegionSet);
      },
      { timeout: 5000, maximumAge: 3600000 }
    );
  },

  /**
   * IP-based region detection fallback (ipapi.co — free, HTTPS, no API key).
   * Only fires when GPS is unavailable or denied. Silently no-ops on failure.
   */
  async _tryIPGeolocation(onRegionSet) {
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 4000);
      const resp = await fetch('https://ipapi.co/json/', { signal: ctrl.signal });
      const data = await resp.json();
      if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        const detected = this._detectFromCoords(data.latitude, data.longitude);
        if (detected.id !== this._current.id) {
          this._current = detected;
          if (onRegionSet) onRegionSet(this._current);
        }
      }
    } catch (_) {
      // IP lookup failed — keep default region
    }
  },

  /**
   * Manually set region and save preference for this session.
   * @param {string}   regionId
   * @param {Function} onRegionSet  Optional callback with new region config.
   */
  setRegion(regionId, onRegionSet) {
    if (!_DLC_REGIONS[regionId]) return;
    sessionStorage.setItem(_DLC_REGION_STORAGE_KEY, regionId);
    this._current = _DLC_REGIONS[regionId];
    if (onRegionSet) onRegionSet(this._current);
  },

  /** Clear saved preference so geolocation re-runs on next page load. */
  clearSavedRegion() {
    sessionStorage.removeItem(_DLC_REGION_STORAGE_KEY);
  },

  /** Detect region from lat/lng using bounding boxes. */
  _detectFromCoords(lat, lng) {
    for (const region of Object.values(_DLC_REGIONS)) {
      const b = region.geoBounds;
      if (lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax) {
        return region;
      }
    }
    return _DLC_REGIONS[_DLC_DEFAULT_REGION_ID];
  },

  /**
   * Detect region from free text (city name, airport code, query text).
   * Used by chat to answer cross-region questions regardless of UI setting.
   * @param  {string} text
   * @returns {object|null}  Matching region config, or null if no match.
   */
  detectFromText(text) {
    if (!text) return null;
    const t = text.toLowerCase();
    for (const region of Object.values(_DLC_REGIONS)) {
      if (region.keywords.some(kw => t.includes(kw))) return region;
    }
    return null;
  },

  /** Primary phone display string for current region (first host). */
  get phone() { return this.current.hosts[0].display; },

  /** Primary host name for current region (first host). */
  get hostName() { return this.current.hosts[0].name; },

  /**
   * Build AI system prompt context block.
   * Includes active region details AND a full summary of all regions so the
   * AI can answer cross-region questions correctly.
   */
  buildAIRegionContext() {
    const active    = this.current;
    const hostsStr  = active.hosts.map(h => `  ${h.name}: ${h.display}`).join('\n');

    const allProfiles = Object.values(_DLC_REGIONS).map(r => {
      const hList = r.hosts.map(h => `${h.name} (${h.display})`).join(', ');
      return `  ${r.name}:\n    Hosts: ${hList}\n    Vehicle: ${r.vehicle.name} (max ${r.vehicle.seats} seats)\n    Airports: ${r.airports.join(', ')}\n    Coverage: ${r.serviceNoteEn}`;
    }).join('\n\n');

    return `
ACTIVE SERVICE REGION: ${active.name} (${active.nameVi})
${active.serviceNoteEn}

HOSTS FOR THIS REGION:
${hostsStr}

VEHICLE: ${active.vehicle.name} — up to ${active.vehicle.seats} seats
AIRPORTS SERVED: ${active.airports.join(', ')}

ALL REGIONAL SERVICE PROFILES (use for cross-region questions):
${allProfiles}

REGIONAL RULES FOR AI:
- Bay Area hosts: Dung Pham (408-859-6718) — driver/service contact
- Bay Area vehicle: Toyota Sienna, 8 seats max
- Orange County hosts: Du Lịch Cali (408-916-3439)
- Orange County vehicles: Tesla Model Y (1-3 pax) or Mercedes Van (4-12 pax)
- Main booking line: Du Lịch Cali 408-916-3439 (serves both regions)
- If user asks capacity for Bay Area, answer: Toyota Sienna, up to 8 seats
- If region is unclear, ask: "Bạn đang ở vùng nào — Bay Area hay Orange County?"`;
  },
};
