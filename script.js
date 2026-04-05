// ── Firebase Initialization ──────────────────────────────────
const firebaseConfig = {
  apiKey:            'AIzaSyCo1FzDthSCXINRHlyJkqdcVKq_inM71SQ',
  authDomain:        'dulichcali-booking-calendar.firebaseapp.com',
  projectId:         'dulichcali-booking-calendar',
  storageBucket:     'dulichcali-booking-calendar.appspot.com',
  messagingSenderId: '623460884698',
  appId:             '1:623460884698:web:a08bd435c453a7b4db05e3'
};
firebase.initializeApp(firebaseConfig);
firebase.auth().signInAnonymously().catch(console.error);
const db = firebase.firestore();

// ── Global state ─────────────────────────────────────────────
let lastCalculatedMiles = 0;
let currentStep         = 1;
let currentService      = '';
let gapiInited          = false;
let tokenClient;

// ── Region-aware vehicle helper ──────────────────────────────
function getRegionVehicle(passengers) {
  const drivers = window._availableDrivers || [];
  const match = drivers.find(d => d.vehicle && d.vehicle.seats && d.vehicle.seats >= passengers)
             || drivers[0];
  if (match && match.vehicle && match.vehicle.make) {
    const v = match.vehicle;
    return [v.make, v.model].filter(Boolean).join(' ');
  }
  return passengers <= 3 ? 'Tesla Model Y' : 'Mercedes Van';
}

// ── Booking ID & Tracking Token ──────────────────────────────
function generateBookingId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'DLC-';
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  for (const b of arr) id += chars[b % chars.length];
  return id;
}

function generateTrackingToken() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper: backward-compat datetime from doc
function getBookingDatetime(doc) {
  return doc.data().datetime || doc.id;
}

// ── SPA Navigation ───────────────────────────────────────────
function switchScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.toggle('screen--active', s.id === screenId);
  });
  document.querySelectorAll('.nav-tab').forEach(tab => {
    const active = tab.dataset.screen === screenId;
    tab.classList.toggle('nav-tab--active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  // Scroll active screen to top
  const el = document.getElementById(screenId);
  if (el) el.scrollTop = 0;
  // Keep back button state accurate after screen change
  _updateBackBtn();
}

// ── Global Back Navigation System ───────────────────────────
// Evaluates current app state and returns the appropriate back
// action: closes modal, collapses sheet, or steps backward.
// No manual stack needed — derived from live DOM state.

function _getBackAction() {
  // Priority 1: highlight detail sheet
  const hlSheet = document.getElementById('hlSheet');
  if (hlSheet && !hlSheet.hidden && hlSheet.classList.contains('hl-sheet--open')) {
    return closeHighlight;
  }
  // Priority 2: destination video modal
  const destModal = document.getElementById('destModal');
  if (destModal && !destModal.hidden && destModal.classList.contains('dest-modal--open')) {
    return closeDestination;
  }
  // Priority 3: booking wizard steps 2–5
  if (typeof currentStep !== 'undefined' && currentStep > 1) {
    const step = currentStep; // capture before closure
    return function () { goStep(step - 1); };
  }
  return null;
}

function _updateBackBtn() {
  const btn = document.getElementById('globalBack');
  if (!btn) return;
  btn.hidden = !_getBackAction();
}

function globalBack() {
  const action = _getBackAction();
  if (action) {
    action();
    // Re-evaluate after the action settles (modals use CSS transitions)
    setTimeout(_updateBackBtn, 120);
  }
}

// Browser/OS back gesture support
window.addEventListener('popstate', function () {
  const action = _getBackAction();
  if (action) {
    action();
    setTimeout(_updateBackBtn, 120);
  }
});

// Hash-based deep linking (from marketplace bottom nav links like ../#travel)
// Query-param entry routing: ?entry=airport|tour|marketplace|food|hair|nails
document.addEventListener('DOMContentLoaded', function () {
  const hash  = location.hash;
  const entry = new URLSearchParams(location.search).get('entry');

  if      (hash === '#travel' || hash === '#destinations') switchScreen('screenDest');
  else if (hash === '#ai'     || hash === '#chat')         switchScreen('screenChat');
  else if (hash === '#book'   || hash === '#booking')      switchScreen('screenBook');
  else if (hash === '#airport' || hash === '#ride') {
    // Stay on screenHome, scroll to the Airport & Ride section
    setTimeout(function() {
      var sec = document.getElementById('hpAirport');
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  }

  // entry= param: used by QR codes and social media deep links
  // Delay to allow DLChat.init() and all module setup to complete first
  if (entry) {
    setTimeout(function () {
      if (entry === 'airport' || entry === 'ride') {
        switchScreen('screenChat');
        setTimeout(function () { if (window.DLChat && DLChat.openWithMode) DLChat.openWithMode('airport'); }, 200);
        setTimeout(function () { if (window.DLChat && DLChat.startFlow) DLChat.startFlow('airport'); }, 250);
      } else if (entry === 'tour') {
        switchScreen('screenChat');
        setTimeout(function () { if (window.DLChat && DLChat.openWithMode) DLChat.openWithMode('tour'); }, 200);
        setTimeout(function () { if (window.DLChat && DLChat.startFlow) DLChat.startFlow('tour'); }, 250);
      } else if (entry === 'marketplace' || entry === 'food' || entry === 'hair' || entry === 'nails') {
        openMarketplaceChat();
      }
    }, 600);
  }

  _updateBackBtn(); // initialise back button state
});

// ── Destination Cards (Home screen, horizontal scroll) ────────
function renderDestCards() {
  const container = document.getElementById('destCards');
  if (!container || typeof DESTINATIONS === 'undefined') return;

  container.innerHTML = DESTINATIONS.map(d => {
    const cost = d.cost.transport;
    return `
      <div class="dest-card" role="listitem" onclick="openDestination('${d.id}')" aria-label="${d.name.vi}">
        <div class="dest-card__img" style="background:${d.gradient}">
          <img src="${d.image}" alt="${d.name.vi}" loading="lazy" onerror="this.style.opacity='0'">
          <div class="dest-card__gradient"></div>
        </div>
        <div class="dest-card__body">
          <div class="dest-card__tag">${d.state}</div>
          <div class="dest-card__name">${d.name.vi}</div>
          <div class="dest-card__range">
            Từ <strong>$${cost.min}</strong> · ${d.duration.min}–${d.duration.max} ngày
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── Full Destination List (Destinations screen) ───────────────
function renderDestList() {
  const container = document.getElementById('destList');
  if (!container || typeof DESTINATIONS === 'undefined') return;

  container.innerHTML = DESTINATIONS.map(d => {
    const cost = d.cost.transport;
    const highlights = d.highlights.slice(0, 3);
    return `
      <div class="dest-full-card" onclick="openDestination('${d.id}')">
        <div class="dest-full-card__hero" style="background:${d.gradient}">
          <img src="${d.image}" alt="${d.name.vi}" loading="lazy" onerror="this.style.opacity='0'">
          <div class="dest-full-card__hero-overlay"></div>
          <div class="dest-full-card__tagline">
            <div class="dest-full-card__state">${d.state}</div>
            <div class="dest-full-card__name">${d.name.vi}</div>
          </div>
        </div>
        <div class="dest-full-card__body">
          <p class="dest-full-card__summary">${d.summary.vi}</p>
          <div class="dest-full-card__highlights">
            ${highlights.map(h => `<div class="dest-full-card__hl">${h.name} — ${h.vi}</div>`).join('')}
          </div>
          <div class="dest-full-card__footer">
            <span class="dest-full-card__price">
              Từ $${cost.min} – $${cost.max}
            </span>
            <button class="btn btn--gold" style="height:38px;font-size:.75rem;padding:0 1rem">
              Đặt tour
            </button>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── Airport helpers ───────────────────────────────────────────
/** Returns airports for the current region; falls back to all if no match. */
function getRegionAirports() {
  if (typeof AIRPORTS === 'undefined') return [];
  if (!window.DLCRegion) return AIRPORTS;
  const id       = DLCRegion.current.id;
  const filtered = AIRPORTS.filter(a => a.region === id);
  return filtered.length ? filtered : AIRPORTS;
}

// ── Airport Chips ─────────────────────────────────────────────
function renderAirportChips() {
  const container = document.getElementById('airportChips');
  if (!container) return;
  const airports = getRegionAirports();
  container.innerHTML = airports.map(a => `
    <div class="airport-chip">
      <span class="airport-chip__code">${a.code}</span>
      <span class="airport-chip__name">${a.label.split(' — ')[0]}</span>
    </div>`).join('');
}

// ── Airport Select Options ────────────────────────────────────
function populateAirportSelect() {
  const sel = document.getElementById('airport');
  if (!sel) return;
  const airports  = getRegionAirports();
  const regionName = window.DLCRegion ? DLCRegion.current.nameVi : 'Sân bay';
  sel.innerHTML = `<option value="">Chọn sân bay...</option>` +
    `<optgroup label="${regionName}">` +
    airports.map(a => `<option value="${a.value}">${a.label}</option>`).join('') +
    `</optgroup>`;
}

// ── Quick Estimate (Home screen) ──────────────────────────────
function renderQuickEstimate() {
  const key = document.getElementById('quickService')?.value;
  const out  = document.getElementById('quickEstResult');
  if (!out) return;
  if (!key || typeof QUICK_ESTIMATES === 'undefined') { out.innerHTML = ''; return; }
  const est = QUICK_ESTIMATES[key];
  if (!est) { out.innerHTML = ''; return; }
  out.innerHTML = `
    <div class="est-range">${est.range}</div>
    <div class="est-detail">${est.detail}</div>`;
}

// ── Gas Price (EIA API with sessionStorage cache) ─────────────
async function fetchGasPrice() {
  // EIA API requires a registered key from eia.gov/opendata (free).
  // DEMO_KEY is rate-limited instantly in production — live fetch disabled.
  // Static fallback (~CA average) is used; update EIA_KEY below to enable live prices.
  const EIA_KEY = '';  // set to your free EIA API key to enable live CA gas prices
  if (!EIA_KEY) return;  // skip fetch — static fallback in applyGasPrice default

  const CACHE_KEY = 'dlc_gas_price';
  const CACHE_TTL = 6 * 3600 * 1000; // 6 hours

  const cached = sessionStorage.getItem(CACHE_KEY);
  if (cached) {
    const { price, ts } = JSON.parse(cached);
    if (Date.now() - ts < CACHE_TTL) { applyGasPrice(price); return; }
  }

  try {
    const url =
      'https://api.eia.gov/v2/petroleum/pri/gnd/data/' +
      '?api_key=' + EIA_KEY +
      '&frequency=weekly' +
      '&data[0]=value' +
      '&facets[series][]=EMM_EPMR_PTE_SCA_DPG' +
      '&sort[0][column]=period&sort[0][direction]=desc&length=1';
    const res  = await fetch(url);
    if (!res.ok) return;
    const json = await res.json();
    const price = parseFloat(json?.response?.data?.[0]?.value);
    if (!isNaN(price) && price > 0) {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ price, ts: Date.now() }));
      applyGasPrice(price);
    }
  } catch {
    // EIA unavailable — static fallback already set by default
  }
}

function applyGasPrice(price) {
  // Update global used by updateEstimate()
  window._gasCaliPrice = price;
  const badge = document.getElementById('gasPriceBadge');
  if (badge) {
    badge.textContent = `⛽ Giá xăng CA hiện tại: ~$${price.toFixed(2)}/gal (EIA)`;
  }
  const gasRow = document.getElementById('gasRow');
  const gasEl  = document.getElementById('gasPriceDisplay');
  if (gasRow && gasEl) {
    gasRow.style.display = '';
    gasEl.textContent = `$${price.toFixed(2)}/gal`;
  }
}

// ── Wizard Step Navigation ────────────────────────────────────
function goStep(n) {
  currentStep = n;
  const total = 5;

  // Show/hide step panels
  for (let i = 1; i <= total; i++) {
    const el = document.getElementById(`wStep${i}`);
    if (el) el.style.display = i === n ? '' : 'none';
  }

  // Progress bar
  const bar = document.getElementById('wizBar');
  if (bar) bar.style.setProperty('--wiz-pct', `${(n / total) * 100}%`);

  // Step dots
  const dotsEl = document.getElementById('wizStepDots');
  if (dotsEl) {
    dotsEl.innerHTML = Array.from({ length: total }, (_, i) => {
      const idx = i + 1;
      let cls = 'wiz-dot';
      if (idx < n) cls += ' wiz-dot--done';
      if (idx === n) cls += ' wiz-dot--active';
      return `<div class="${cls}" aria-label="Bước ${idx}"></div>`;
    }).join('');
  }

  // Update aria-valuenow
  const prog = document.getElementById('wizProgress');
  if (prog) prog.setAttribute('aria-valuenow', n);

  // When navigating to step 4, recalculate estimate
  if (n === 4) updateEstimate();

  // Scroll step into view
  const stepEl = document.getElementById(`wStep${n}`);
  if (stepEl) stepEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Show/hide back button based on wizard depth
  _updateBackBtn();
}

// ── Pickup Type Toggle (airport vs personal address) ─────────
let currentPickupType = 'airport'; // 'airport' | 'address'

function setPickupType(type) {
  currentPickupType = type;
  const airportWrap = document.getElementById('wAirportWrap');
  const addressWrap = document.getElementById('wAddressWrap');

  // Toggle visibility: show one, hide the other
  if (airportWrap) airportWrap.style.display = type === 'airport' ? '' : 'none';
  if (addressWrap) addressWrap.style.display = type === 'address' ? '' : 'none';

  // Clear the hidden field so it doesn't affect estimate
  if (type === 'airport') {
    const addr = document.getElementById('address');
    if (addr) addr.value = '';
  } else {
    const apt = document.getElementById('airport');
    if (apt) apt.value = '';
  }

  // Toggle button styling
  document.querySelectorAll('.pickup-toggle__btn').forEach(btn => {
    btn.classList.toggle('pickup-toggle__btn--active', btn.dataset.pickup === type);
  });

  updateEstimate();
}

// ── Service Selection ─────────────────────────────────────────
function selectService(svc) {
  currentService = svc;
  document.getElementById('serviceType').value = svc;

  // Highlight chosen button (works for both .svc-choice and .tour-choice)
  document.querySelectorAll('[data-svc]').forEach(btn => {
    btn.classList.toggle('svc-choice--active', btn.dataset.svc === svc);
  });

  const isTransfer = svc === 'pickup' || svc === 'dropoff';

  // Step 2: show/hide pickup toggle, airport vs address, lodging
  const pickupTypeWrap = document.getElementById('wPickupTypeWrap');
  const airportWrap    = document.getElementById('wAirportWrap');
  const addressWrap    = document.getElementById('wAddressWrap');
  const lodgingWrap    = document.getElementById('wLodgingWrap');
  const daysWrap       = document.getElementById('wDaysWrap');
  const step2Sub       = document.getElementById('wStep2Sub');

  if (isTransfer) {
    // Show the toggle so user picks airport OR address
    if (pickupTypeWrap) pickupTypeWrap.style.display = '';
    // Reset to airport by default
    setPickupType('airport');
    if (lodgingWrap) lodgingWrap.style.display = 'none';
    if (daysWrap)    daysWrap.style.display    = 'none';
    if (step2Sub) step2Sub.textContent = 'Chọn điểm đón hoặc trả khách';
  } else {
    // Tour: hide toggle, show only address field
    if (pickupTypeWrap) pickupTypeWrap.style.display = 'none';
    if (airportWrap) airportWrap.style.display = 'none';
    if (addressWrap) addressWrap.style.display = '';
    if (lodgingWrap) lodgingWrap.style.display = '';
    if (daysWrap)    daysWrap.style.display    = '';
    if (step2Sub) step2Sub.textContent = 'Nhập địa chỉ xuất phát / điểm đón của bạn';
  }

  goStep(2);
}

function selectServiceAndBook(svc) {
  switchScreen('screenBook');
  // Slight delay so screen transition completes first
  setTimeout(() => selectService(svc), 60);
}

// ── Shared Distance Helper ────────────────────────────────────────────────────
// Single source of truth for all distance calculations across the app.
//
// Uses RouteMatrix.computeRouteMatrix (routes.googleapis.com) — the current
// recommended Google Maps JS API for matrix distance calculations.
//
// Usage: const { distMiles, durMins } = await DLCRouteMatrix(origin, destination);
//   origin / destination: any string Google Maps can geocode (address, airport name, etc.)
//
// Example — airport proximity:
//   const { distMiles } = await DLCRouteMatrix(userLocation, 'San Jose Mineta Airport, CA');
//
// Example — private ride estimate:
//   const { distMiles, durMins } = await DLCRouteMatrix('SJC Airport', '2534 Clarebank Way, San Jose');
//
window.DLCRouteMatrix = async function(origin, destination) {
  if (typeof google === 'undefined' || !google.maps) throw new Error('Maps not loaded');
  const lib = await google.maps.importLibrary('routes');
  const RouteMatrix = lib.RouteMatrix;
  if (!RouteMatrix) throw new Error('RouteMatrix not available');
  // Routes library TravelMode uses DRIVING (same as legacy maps TravelMode)
  const travelMode = (lib.TravelMode && lib.TravelMode.DRIVING) || 'DRIVING';
  const result = await RouteMatrix.computeRouteMatrix({
    origins:      [origin],
    destinations: [destination],
    travelMode,
    fields: ['distanceMeters', 'condition', 'localizedValues', 'originIndex', 'destinationIndex'],
  });
  // Response shape: { matrix: { rows: [ { items: [ RouteMatrixElement ] } ] } }
  const el = result && result.matrix && result.matrix.rows &&
             result.matrix.rows[0] && result.matrix.rows[0].items &&
             result.matrix.rows[0].items[0];
  if (!el || el.condition !== 'ROUTE_EXISTS' || !el.distanceMeters) throw new Error('no-route');
  // Parse localized duration string e.g. "14 mins" or "1 hr 5 mins"
  const durStr = (el.localizedValues && el.localizedValues.duration) || '';
  const hrM    = durStr.match(/(\d+)\s*hr/i);
  const minM   = durStr.match(/(\d+)\s*min/i);
  const durMins = (hrM ? parseInt(hrM[1]) * 60 : 0) + (minM ? parseInt(minM[1]) : 0);
  return {
    distMiles: el.distanceMeters / 1609.34,
    durMins,
  };
};

// ── Estimate Calculator ───────────────────────────────────────
// Math delegated to DLCPricing (pricing.js) — single source of truth.
const CALIFORNIA_AVG_FUEL_PRICE = 5.00; // kept as fallback constant

function updateEstimate() {
  const passengers  = +document.getElementById('passengers')?.value || 1;
  const serviceType = document.getElementById('serviceType')?.value || currentService;
  const airport     = document.getElementById('airport')?.value || '';
  const address     = document.getElementById('address')?.value || '';
  const lodging     = document.getElementById('lodging')?.value || '';
  const days        = +document.getElementById('days')?.value || 1;

  const estEl  = document.getElementById('estimateDisplay');
  const vehEl  = document.getElementById('vehicleDisplay');
  if (!estEl || !vehEl) return;

  let origin, destination;
  if (['pickup', 'dropoff'].includes(serviceType)) {
    origin      = serviceType === 'pickup' ? airport : address;
    destination = serviceType === 'pickup' ? address : airport;
  } else {
    const dest = typeof DESTINATIONS !== 'undefined'
      ? DESTINATIONS.find(d => d.id === serviceType)
      : null;
    origin      = dest ? dest.origin_for_tour : getTourOrigin(serviceType);
    destination = address;
  }

  if (!origin || !destination) {
    estEl.textContent = '—';
    vehEl.textContent = '—';
    return;
  }

  if (typeof google === 'undefined') return;

  window.DLCRouteMatrix(origin, destination).then(({ distMiles }) => {
      const miles = distMiles;
      lastCalculatedMiles = miles;

      // Delegate math to shared pricing engine
      const pricing = window.DLCPricing;
      let cost, vehicle;
      const regionId = window.DLCRegion?.current?.id;
      if (['pickup', 'dropoff'].includes(serviceType)) {
        cost    = pricing ? pricing.transferCost(miles, passengers) : fallbackTransfer(miles, passengers);
        vehicle = pricing ? pricing.getVehicle(passengers, regionId) : getRegionVehicle(passengers);
      } else {
        cost    = pricing ? pricing.tourCost(miles, passengers, days, lodging) : fallbackTour(miles, passengers, days, lodging);
        vehicle = pricing ? pricing.getVehicle(passengers, regionId) : getRegionVehicle(passengers);
      }

      estEl.textContent = `$${Math.round(cost)}`;
      vehEl.textContent = vehicle;

      // Show Uber comparison for transfers
      const uberRow    = document.getElementById('uberCompareRow');
      const savingsRow = document.getElementById('savingsRow');
      const uberEl     = document.getElementById('uberEstDisplay');
      const savingsEl  = document.getElementById('savingsDisplay');

      if (pricing && pricing.transferCostWithComparison && ['pickup', 'dropoff'].includes(serviceType)) {
        const comp = pricing.transferCostWithComparison(miles, passengers);
        if (uberRow && uberEl) {
          uberRow.style.display = '';
          uberEl.textContent = `$${comp.uberEstimate}`;
        }
        if (savingsRow && savingsEl) {
          savingsRow.style.display = '';
          savingsEl.textContent = `-$${comp.savings} (${comp.savingsPercent}%)`;
        }
      } else {
        // For tours, show a simpler comparison
        const isVan = passengers > 3;
        const uberEq = pricing ? Math.round(pricing.estimateUberPrice(miles * 2, isVan ? 'van' : 'sedan') * (days || 1)) : 0;
        if (uberRow && uberEl && uberEq > 0) {
          uberRow.style.display = '';
          uberEl.textContent = `~$${uberEq}`;
        }
        if (savingsRow && savingsEl && uberEq > cost) {
          savingsRow.style.display = '';
          savingsEl.textContent = `-$${Math.round(uberEq - cost)}`;
        } else if (savingsRow) {
          savingsRow.style.display = 'none';
        }
      }

      // Update lodging info card
      const lodgingCard = document.getElementById('lodgingInfoCard');
      if (lodgingCard) {
        if (lodging === 'hotel') {
          lodgingCard.style.display = '';
          lodgingCard.textContent =
            `Ước tính khách sạn ~$150/đêm/phòng × ${days} đêm. ` +
            `Giá thực tế tùy vị trí và mùa — chúng tôi sẽ tư vấn cụ thể sau khi nhận đặt chỗ.`;
        } else if (lodging === 'airbnb') {
          lodgingCard.style.display = '';
          lodgingCard.textContent =
            `Ước tính Airbnb ~$165/đêm (không có API chính thức — giá thực tế có thể khác đáng kể). ` +
            `Chúng tôi sẽ giúp tìm kiếm và tư vấn sau khi nhận đặt chỗ.`;
        } else {
          lodgingCard.style.display = 'none';
        }
      }
  }).catch(() => {
    estEl.textContent = '$0';
  });
}

function getTourOrigin(serviceType) {
  if (typeof DESTINATIONS !== 'undefined') {
    const dest = DESTINATIONS.find(d => d.id === serviceType);
    if (dest) return dest.origin_for_tour || '';
  }
  return '';
}

// Inline fallbacks (used only if pricing.js fails to load)
// Uses simplified Uber-based pricing: estimate Uber then discount 20%
function fallbackTransfer(miles, passengers) {
  const isVan = passengers > 3;
  const perMile = isVan ? 1.50 : 0.90;
  const base = isVan ? 2.50 : 1.50;
  const estMin = Math.round((miles / 35) * 60);
  const perMin = isVan ? 0.40 : 0.25;
  const uberEst = base + miles * perMile + estMin * perMin + 4;
  let price = uberEst * 0.80; // 20% less
  if (miles > 300) price += 250;
  return Math.round(Math.max(price, isVan ? 120 : 100));
}
function fallbackTour(miles, passengers, days, lodging) {
  const gas = window._gasCaliPrice || CALIFORNIA_AVG_FUEL_PRICE;
  const rt  = miles * 2;
  let lodge = 0;
  if (lodging === 'hotel')  lodge = (passengers > 8 ? 3 : passengers > 4 ? 2 : 1) * 150 * days;
  if (lodging === 'airbnb') lodge = Math.ceil(passengers / 8) * 165 * days;
  const wear = !lodging ? (passengers > 8 ? 150 : passengers > 4 ? 100 : 50) * days : 0;
  return Math.round(Math.max((180 + rt * (gas / 14)) * days + lodge + 50 * days + wear, 300 * days));
}

// ── Booking Submission ────────────────────────────────────────
async function submitBooking(event) {
  event.preventDefault();
  const form      = document.getElementById('bookingForm');
  const submitBtn = document.getElementById('submitBtn');

  if (submitBtn.disabled) return false;
  submitBtn.disabled = true;
  const origText = submitBtn.textContent;
  submitBtn.textContent = 'Đang gửi...';

  const datetime = document.getElementById('datetime').value;
  if (!datetime) {
    document.getElementById('slotWarning').textContent = 'Vui lòng chọn ngày và giờ.';
    submitBtn.disabled = false;
    submitBtn.textContent = origText;
    return false;
  }
  const selectedTime = new Date(datetime);

  // Conflict check
  try {
    const snapshot = await db.collection('bookings').get();
    for (const doc of snapshot.docs) {
      const datetimeStr = getBookingDatetime(doc);
      const bookedTime  = new Date(datetimeStr);
      if (isNaN(bookedTime.getTime())) continue;
      const distance      = doc.data().distance || 10;
      const bufferMinutes = Math.ceil(distance * 2) + 15;
      const diff          = Math.abs((selectedTime - bookedTime) / 60000);
      if (diff < bufferMinutes) {
        document.getElementById('slotWarning').textContent =
          `Khung giờ xung đột với lịch ${bookedTime.toLocaleTimeString()} (cần cách ${bufferMinutes} phút).`;
        submitBtn.disabled = false;
        submitBtn.textContent = origText;
        return false;
      }
    }
  } catch (err) {
    console.warn('Conflict check failed (non-critical):', err);
  }

  document.getElementById('slotWarning').textContent = '';

  const bookingId     = generateBookingId();
  const trackingToken = generateTrackingToken();

  const name       = document.getElementById('name').value.trim();
  const phone      = document.getElementById('phone').value.trim();
  const airport    = document.getElementById('airport')?.value || '';
  const address    = document.getElementById('address').value.trim();
  const lodging    = document.getElementById('lodging')?.value || '';
  const passengers = document.getElementById('passengers').value;
  const days       = document.getElementById('days').value;
  const serviceType = currentService || document.getElementById('serviceType').value;

  const timeStr = selectedTime.toLocaleString('vi-VN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  const summary = [
    `Mã đặt chỗ: ${bookingId}`,
    `Khách hàng: ${name}`,
    `Số điện thoại: ${phone}`,
    `Dịch vụ: ${serviceType}`,
    airport ? `Sân bay: ${airport}` : '',
    `Địa chỉ: ${address}`,
    `Số khách: ${passengers}`,
    !['pickup','dropoff'].includes(serviceType) ? `Số ngày: ${days}` : '',
    lodging ? `Chỗ ở: ${lodging}` : '',
    `Thời gian: ${timeStr}`,
  ].filter(Boolean).join('\n');

  document.getElementById('bookingSummary').value = summary;

  // Write to Firestore
  try {
    await db.collection('bookings').doc(bookingId).set({
      bookingId,
      trackingToken,
      status:       'pending',
      datetime,
      name,
      phone,
      airport,
      address,
      serviceType,
      lodging,
      passengers:   parseInt(passengers) || 1,
      days:         parseInt(days) || 1,
      distance:     lastCalculatedMiles,
      createdAt:    firebase.firestore.FieldValue.serverTimestamp(),
      driver:       null,
      vehicleLat:   null,
      vehicleLng:   null,
      vehicleHeading: null,
      etaMinutes:   null
    });
  } catch (err) {
    console.error('Firestore write failed:', err);
  }

  // Optional Google Calendar
  if (gapiInited && tokenClient) {
    tokenClient.callback = async (resp) => {
      if (resp.error !== undefined) return;
      try {
        await gapi.client.calendar.events.insert({
          calendarId: 'primary',
          resource: {
            summary:  `Dịch vụ: ${name} [${bookingId}]`,
            location: airport || address,
            description: summary,
            start: { dateTime: selectedTime.toISOString(), timeZone: 'America/Los_Angeles' },
            end:   { dateTime: new Date(selectedTime.getTime() + 3600000).toISOString(), timeZone: 'America/Los_Angeles' },
          }
        });
      } catch (err) {
        console.error('Calendar insert failed:', err);
      }
    };
    tokenClient.requestAccessToken();
  }

  // POST to Formspree (fire & forget)
  try {
    const fd = new FormData(form);
    fetch(form.action, { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
  } catch (err) {
    console.warn('Formspree notification failed:', err);
  }

  // Redirect to thank-you with tracking params
  const lang = new URLSearchParams(window.location.search).get('lang') || 'vi';
  window.location.href =
    `thankyou.html?id=${encodeURIComponent(bookingId)}&t=${encodeURIComponent(trackingToken)}&lang=${lang}`;
  return false;
}

// ── Google Calendar API Setup ─────────────────────────────────
function safeInitGoogleAPI() {
  if (typeof gapi !== 'undefined') initGoogleAPI();
  else setTimeout(safeInitGoogleAPI, 100);
}

function initGoogleAPI() {
  gapi.load('client', async () => {
    try {
      await gapi.client.init({
        apiKey: firebaseConfig.apiKey,
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
      });
      gapiInited = true;
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: '623460884698-0k6g2r4ltb3c0d9hs0odms2b5j2hsp67.apps.googleusercontent.com',
        scope: 'https://www.googleapis.com/auth/calendar.events',
        callback: (tokenResponse) => {
          if (!tokenResponse || tokenResponse.error) console.error('Access token error', tokenResponse);
        }
      });
    } catch (err) {
      console.error('Google API Init Failed:', err);
    }
  });
}

window.gapiLoaded = () => initGoogleAPI();

// ══════════════════════════════════════════════════════════════
//  DESTINATION VIDEO MODAL — Direct iframe + postMessage
// ══════════════════════════════════════════════════════════════

const SVG_MUTED = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
  <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
</svg>`;

const SVG_SOUND = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
  <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
</svg>`;

let _destMuted       = true;
let _ytMsgListener   = null;
let _ytFallbackTimer = null;

/**
 * Creates a youtube-nocookie.com iframe with enablejsapi=1.
 * Listens for postMessage state=PLAYING to fade poster out.
 * Falls back to "Watch on YouTube" link after 5 seconds if video never plays.
 */
function loadDestVideo(videoId) {
  const wrap = document.querySelector('.dest-modal__video-wrap');
  if (!wrap) return;
  _clearYtVideo();

  const origin = window.location.origin || 'https://dulichcali21.com';
  const iframe = document.createElement('iframe');
  iframe.id  = 'destYtPlayer';
  iframe.src =
    `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}` +
    `?autoplay=1&mute=1&controls=1&playsinline=1&rel=0&enablejsapi=1` +
    `&origin=${encodeURIComponent(origin)}`;
  iframe.setAttribute('frameborder', '0');
  iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
  iframe.setAttribute('allowfullscreen', '');
  iframe.style.opacity    = '0';
  iframe.style.transition = 'opacity .6s ease';

  // Insert before gradient so z-index stacking is predictable
  const grad = wrap.querySelector('.dest-modal__vid-grad');
  grad ? wrap.insertBefore(iframe, grad) : wrap.appendChild(iframe);

  // postMessage listener — detect state 1 (PLAYING)
  _ytMsgListener = (e) => {
    if (e.origin !== 'https://www.youtube.com' &&
        e.origin !== 'https://www.youtube-nocookie.com') return;
    try {
      const data = JSON.parse(e.data);
      if (data.event === 'onStateChange' && data.info === 1) {
        _onVideoPlaying();
      }
    } catch (_) {}
  };
  window.addEventListener('message', _ytMsgListener);

  // 5-second safety fallback — add YouTube link if video never starts
  _ytFallbackTimer = setTimeout(() => {
    const el = document.getElementById('destYtPlayer');
    if (el && parseFloat(el.style.opacity || 0) < 0.5) {
      _showYtLink(videoId);
    }
  }, 5000);
}

/** Called when postMessage confirms playback started */
function _onVideoPlaying() {
  if (_ytFallbackTimer) { clearTimeout(_ytFallbackTimer); _ytFallbackTimer = null; }
  const poster = document.getElementById('destPoster');
  if (poster) poster.classList.add('dest-modal__poster--hidden');
  const iframe = document.getElementById('destYtPlayer');
  if (iframe) iframe.style.opacity = '1';
  const soundBtn = document.getElementById('destSoundBtn');
  if (soundBtn) { soundBtn.style.display = ''; soundBtn.innerHTML = SVG_MUTED; }
  _destMuted = true;
}

/** Show "Watch on YouTube" link over the poster when video can't embed */
function _showYtLink(videoId) {
  const wrap = document.querySelector('.dest-modal__video-wrap');
  if (!wrap || wrap.querySelector('.dest-modal__yt-link')) return;
  const link = document.createElement('a');
  link.className = 'dest-modal__yt-link';
  link.href      = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  link.target    = '_blank';
  link.rel       = 'noopener noreferrer';
  link.innerHTML =
    `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81z"/>
      <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/>
    </svg><span>Xem trên YouTube</span>`;
  wrap.appendChild(link);
}

/** Remove iframe + listener + timer cleanly */
function _clearYtVideo() {
  if (_ytFallbackTimer) { clearTimeout(_ytFallbackTimer); _ytFallbackTimer = null; }
  if (_ytMsgListener)   { window.removeEventListener('message', _ytMsgListener); _ytMsgListener = null; }
  const wrap = document.querySelector('.dest-modal__video-wrap');
  if (wrap) wrap.querySelectorAll('iframe, .dest-modal__yt-link').forEach(el => el.remove());
}

function openDestination(destId) {
  const dest = typeof getDestination === 'function' ? getDestination(destId) : null;
  if (!dest) return;

  const modal = document.getElementById('destModal');
  if (!modal) return;

  // Set poster — Ken Burns animation always-on via CSS
  const poster = document.getElementById('destPoster');
  if (poster) {
    poster.src = dest.image || '';
    poster.alt = dest.name.vi;
    poster.classList.remove('dest-modal__poster--hidden');
    poster.onerror = () => {
      poster.style.opacity = '0';
      const videoWrap = document.querySelector('.dest-modal__video-wrap');
      if (videoWrap) videoWrap.style.background = dest.gradient;
    };
  }

  // Build info sheet
  const sheet = document.getElementById('destSheet');
  if (sheet) sheet.innerHTML = buildDestSheet(dest);

  // Sound button hidden until video actually plays
  const soundBtn = document.getElementById('destSoundBtn');
  if (soundBtn) { soundBtn.style.display = 'none'; soundBtn.innerHTML = SVG_MUTED; }

  // Show modal
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => modal.classList.add('dest-modal--open'));
  });

  // Load video in background (poster remains visible until confirmed playing)
  if (dest.youtubeId) loadDestVideo(dest.youtubeId);

  // Show back button when modal opens
  setTimeout(_updateBackBtn, 60);
}

// ── Highlight Detail Sheet ────────────────────────────────────
/**
 * Opens a bottom-sheet with detailed info about a specific highlight.
 * @param {string} destId - destination id from DESTINATIONS array
 * @param {number} hlIdx  - index into dest.highlights[]
 */
function openHighlight(destId, hlIdx) {
  const dest = typeof getDestination === 'function' ? getDestination(destId) : (DESTINATIONS || []).find(d => d.id === destId);
  if (!dest) return;
  const h = dest.highlights[hlIdx];
  if (!h) return;

  const body = document.getElementById('hlSheetBody');
  if (!body) return;

  const bestTimeBadge = h.bestTime
    ? `<div class="hl-info-row"><div class="hl-info-row__label">Thời điểm tốt nhất</div><div class="hl-info-row__badge">${h.bestTime}</div></div>`
    : '';
  const whySection = h.whyPopular
    ? `<div class="hl-section"><div class="hl-section__label">Tại sao nổi tiếng</div><p class="hl-section__text">${h.whyPopular}</p></div>`
    : '';
  const notesSection = h.travelNotes
    ? `<div class="hl-section"><div class="hl-section__label">Ghi chú du lịch</div><p class="hl-section__text">${h.travelNotes}</p></div>`
    : '';

  body.innerHTML = `
    <div class="hl-eyebrow">${dest.name.vi}</div>
    <h3 class="hl-title">${h.name}</h3>
    <p class="hl-desc">${h.vi}</p>
    ${bestTimeBadge}
    ${whySection}
    ${notesSection}
    <div class="hl-ctas">
      <button class="btn btn--gold" style="flex:1;height:46px;font-size:.85rem"
        onclick="closeHighlight(); selectServiceAndBook('${destId}')">Đặt tour</button>
      <button class="btn btn--outline" style="flex:1;height:46px;font-size:.85rem"
        onclick="closeHighlight(); switchScreen('screenChat')">Hỏi AI</button>
    </div>`;

  const sheet = document.getElementById('hlSheet');
  sheet.hidden = false;
  requestAnimationFrame(() => sheet.classList.add('hl-sheet--open'));
  document.body.style.overflow = 'hidden';
  setTimeout(_updateBackBtn, 60);
}

function closeHighlight() {
  const sheet = document.getElementById('hlSheet');
  if (!sheet) return;
  sheet.classList.remove('hl-sheet--open');
  document.body.style.overflow = '';
  setTimeout(() => {
    sheet.hidden = true;
    _updateBackBtn(); // re-evaluate: may still have dest modal open
  }, 320);
}

function closeDestination() {
  const modal = document.getElementById('destModal');
  if (!modal) return;

  modal.classList.remove('dest-modal--open');
  document.body.style.overflow = '';

  setTimeout(() => {
    modal.hidden = true;
    _clearYtVideo();
    const poster = document.getElementById('destPoster');
    if (poster) poster.classList.remove('dest-modal__poster--hidden');
    const soundBtn = document.getElementById('destSoundBtn');
    if (soundBtn) { soundBtn.style.display = 'none'; soundBtn.innerHTML = SVG_MUTED; }
    _updateBackBtn(); // hide back button once modal is fully gone
  }, 450);
}

function toggleDestSound() {
  const iframe = document.getElementById('destYtPlayer');
  if (!iframe || !iframe.contentWindow) return;
  const btn = document.getElementById('destSoundBtn');
  if (_destMuted) {
    iframe.contentWindow.postMessage('{"event":"command","func":"unMute","args":""}', '*');
    iframe.contentWindow.postMessage('{"event":"command","func":"setVolume","args":[85]}', '*');
    _destMuted = false;
    if (btn) btn.innerHTML = SVG_SOUND;
  } else {
    iframe.contentWindow.postMessage('{"event":"command","func":"mute","args":""}', '*');
    _destMuted = true;
    if (btn) btn.innerHTML = SVG_MUTED;
  }
}

function buildDestSheet(dest) {
  const cost       = dest.cost.transport;
  const highlights = dest.highlights.slice(0, 4);
  const tags       = (dest.highlightTags || []).slice(0, 5);

  const tagsHtml = tags.map(t => `<span class="sheet-tag">${t}</span>`).join('');

  const hlHtml = highlights.map((h, idx) => `
    <button class="sheet-hl" onclick="openHighlight('${dest.id}', ${idx})" aria-label="Chi tiết: ${h.name}">
      <div class="sheet-hl__dot"></div>
      <div class="sheet-hl__content">
        <div class="sheet-hl__name">${h.name}</div>
        <div class="sheet-hl__desc">${h.vi}</div>
      </div>
      <div class="sheet-hl__arrow">›</div>
    </button>`).join('');

  return `
    <div class="sheet-drag" aria-hidden="true"></div>
    <div class="sheet-eyebrow">${dest.state}</div>
    <h2 class="sheet-title">${dest.name.vi}</h2>
    <p class="sheet-hook">${dest.hook || dest.summary.vi}</p>
    ${tags.length ? `<div class="sheet-tags">${tagsHtml}</div>` : ''}
    <div class="sheet-highlights">${hlHtml}</div>
    <div class="sheet-price">
      <span class="sheet-price__label">Xe khứ hồi</span>
      <span class="sheet-price__range">$${cost.min}–$${cost.max}</span>
      <span class="sheet-price__note">từ OC</span>
    </div>
    <div class="sheet-ctas">
      <button class="btn btn--gold" style="height:48px;font-size:.88rem"
        onclick="closeDestination(); selectServiceAndBook('${dest.id}')">
        Đặt tour ngay
      </button>
      <div class="sheet-ctas__row">
        <button class="btn btn--outline" style="height:42px;font-size:.78rem"
          onclick="closeDestination(); switchScreen('screenChat')">
          Hỏi AI tư vấn
        </button>
        <a href="tel:4089163439" class="btn btn--outline" style="height:42px;font-size:.78rem;text-decoration:none">
          Gọi ngay
        </a>
      </div>
    </div>
    <p class="sheet-foot">Giá xe chưa bao gồm chỗ ở. Gọi để nhận báo giá trọn gói.</p>`;
}

// ── Tour Choice Grid (Booking Step 1) ────────────────────────
/**
 * Dynamically renders all 15 destinations as selectable tour cards.
 * Called from DOMContentLoaded; runs every time DESTINATIONS changes.
 */
function renderTourChoiceGrid() {
  const grid = document.getElementById('tourChoiceGrid');
  if (!grid || typeof DESTINATIONS === 'undefined') return;
  grid.innerHTML = DESTINATIONS.map(dest => {
    const cost  = dest.cost.transport;
    const dur   = dest.duration;
    const sub   = dest.outOfState
      ? `${dest.state} · từ $${cost.min}`
      : `${dur.min}–${dur.max} ngày · từ $${cost.min}`;
    return `<button class="tour-choice" data-svc="${dest.id}" onclick="selectService('${dest.id}')">
      <div class="tour-choice__img" style="background-image:url('${dest.image}'),${dest.gradient};background-size:cover,cover;background-position:center,center"></div>
      <div class="tour-choice__body">
        <strong>${dest.name.vi}</strong>
        <span>${sub}</span>
      </div>
    </button>`;
  }).join('');
}

// ── Region UI ─────────────────────────────────────────────────
/**
 * Renders all region-dependent UI elements from a single region config.
 * Called by DLCRegion.init() on load and DLCRegion.setRegion() on manual change.
 */
function updateRegionUI(region) {
  // 1. App bar call button → primary host
  const callBtn = document.getElementById('appBarCallBtn');
  if (callBtn) {
    callBtn.href = `tel:${region.hosts[0].phone}`;
  }

  // 2. Region tag strip
  const regionTag = document.getElementById('regionTag');
  if (regionTag) {
    const otherRegions = Object.values(DLCRegion.all)
      .filter(r => r.id !== region.id)
      .map(r =>
        `<button class="region-option" onclick="DLCRegion.setRegion('${r.id}',updateRegionUI);document.getElementById('regionPicker').hidden=true">${r.nameVi}</button>`
      ).join('');
    document.getElementById('regionPicker').innerHTML = otherRegions;

    regionTag.innerHTML =
      `<span class="region-tag__loc">📍 ${region.nameVi}</span>` +
      `<span class="region-tag__sep">·</span>` +
      `<span class="region-tag__vehicle">${region.vehicle.name} · ${region.vehicle.seats} ghế</span>` +
      `<button class="region-tag__change" onclick="toggleRegionPicker()">Đổi vùng ›</button>`;
    regionTag.hidden = false;
  }

  // 3. Contact strip → all hosts for this region
  const strip = document.getElementById('contactStrip');
  if (strip) {
    strip.innerHTML = region.hosts.map((h, i) =>
      (i > 0 ? '<div class="contact-strip__divider"></div>' : '') +
      `<a href="tel:${h.phone}" class="contact-strip__item">` +
        `<span class="contact-strip__name">${h.name}</span>` +
        `<span class="contact-strip__num">${h.display}</span>` +
      `</a>`
    ).join('');
  }

  // 4. Booking form call-alt link → primary host
  const callAlt = document.getElementById('submitCallAlt');
  if (callAlt) {
    callAlt.href        = `tel:${region.hosts[0].phone}`;
    callAlt.textContent = `Hoặc gọi ngay: ${region.hosts[0].display}`;
  }

  // 5. Airport chips + booking form dropdown → region airports
  renderAirportChips();
  populateAirportSelect();

  // 6. Airport section on Destinations screen → count, label, vehicles
  const airportCount = document.getElementById('airportCount');
  if (airportCount) {
    const n = getRegionAirports().length;
    airportCount.textContent = `${n} Sân Bay Phục Vụ`;
  }
  const airportVehicles = document.getElementById('airportVehicles');
  if (airportVehicles) {
    if (region.id === 'bayarea') {
      airportVehicles.innerHTML =
        `<div class="vehicle-pill"><strong>${region.vehicle.name}</strong><span>Tối đa ${region.vehicle.seats} khách</span></div>`;
    } else {
      airportVehicles.innerHTML =
        `<div class="vehicle-pill"><strong>Tesla Model Y</strong><span>1–3 khách</span></div>` +
        `<div class="vehicle-pill"><strong>Mercedes Van</strong><span>4–12 khách</span></div>`;
    }
  }

  // 7. Homepage service card airport count labels
  document.querySelectorAll('.svc-airport-count').forEach(el => {
    el.textContent = `${getRegionAirports().length} sân bay`;
  });
}

function toggleRegionPicker() {
  const picker = document.getElementById('regionPicker');
  if (picker) picker.hidden = !picker.hidden;
}

// ── Ride-service availability gating ─────────────────────────
// Queries the `drivers` collection for active, ride-enabled drivers whose
// regions include the current region and who are available right now.
// Fails open (shows ride service) if Firestore is unavailable.
async function checkRideServiceAvailability(regionId) {
  try {
    // Query all active drivers regardless of rideServiceEnabled — we need vehicle data for display
    const snap = await db.collection('drivers')
      .where('active', '==', true)
      .get();

    const now      = new Date();
    const day      = now.getDay();                           // 0=Sun … 6=Sat
    const nowMins  = now.getHours() * 60 + now.getMinutes();
    const todayStr = now.toISOString().split('T')[0];        // YYYY-MM-DD

    // Store ALL active drivers for vehicle display (regardless of schedule/region)
    window._activeDrivers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const isScheduledAvailable = doc => {
      const d = doc.data ? doc.data() : doc;
      if (!(d.regions || []).includes(regionId)) return false;
      if ((d.availability?.blackoutDates || []).includes(todayStr)) return false;
      const sched = d.availability?.weeklySchedule?.[day];
      if (!sched?.enabled) return false;
      const [sh, sm] = (sched.start || '00:00').split(':').map(Number);
      const [eh, em] = (sched.end   || '23:59').split(':').map(Number);
      return nowMins >= sh * 60 + sm && nowMins <= eh * 60 + em;
    };

    const hasAvailable = snap.docs.some(isScheduledAvailable);

    // Store on-shift drivers for assignment logic
    window._availableDrivers = snap.docs
      .filter(isScheduledAvailable)
      .map(doc => ({ id: doc.id, ...doc.data() }));

    window._rideServiceAvailable = hasAvailable;
    updateRideServiceCards(hasAvailable);
    return hasAvailable;
  } catch (_) {
    window._rideServiceAvailable = true; // fail open
    updateRideServiceCards(true); // fail open — never hide service on error
    return true;
  }
}

// Toggle ride-gated UI elements based on driver availability.
function updateRideServiceCards(available) {
  document.querySelectorAll('[data-ride-gate]').forEach(el => {
    el.classList.toggle('ride-unavailable', !available);
    var existing = el.querySelector('.ride-unavail-badge');
    if (!available && !existing) {
      var badge = document.createElement('div');
      badge.className = 'ride-unavail-badge';
      badge.innerHTML = '<span>Không Có Xe</span>';
      el.appendChild(badge);
    } else if (available && existing) {
      existing.remove();
    }
  });
}

// ── Homepage Intelligence ─────────────────────────────────────
// Part 1: User behavior tracking & personalization
// Part 2: Dynamic featured vendors
// Part 3: Real-time availability highlights

// ── Time / hours helpers ──────────────────────────────────────
function _dlcHoursForDay(biz, jsDay) {
  // jsDay: 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
  // Vi keys: 'Chủ Nhật'=Sun, 'Thứ 2'=Mon … 'Thứ 7'=Sat
  const hours = biz.hours;
  if (!hours) return null;
  const thuNum = jsDay === 0 ? null : jsDay + 1; // Mon=2 … Sat=7; Sun=null

  for (const key of Object.keys(hours)) {
    if (key === 'Chủ Nhật') { if (jsDay === 0) return hours[key]; continue; }
    const m = key.match(/Thứ\s*(\d+)(?:[–\-](\d+))?/);
    if (!m || thuNum === null) continue;
    const s = parseInt(m[1], 10), e = m[2] ? parseInt(m[2], 10) : s;
    if (thuNum >= s && thuNum <= e) return hours[key];
  }
  return null;
}

function _dlcParseTimeStr(str) {
  // '9:00 AM' → minutes since midnight, null if unparseable
  const m = (str || '').trim().match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1], 10), min = parseInt(m[2], 10);
  const pm = m[3].toUpperCase() === 'PM';
  if (pm && h !== 12) h += 12;
  if (!pm && h === 12) h = 0;
  return h * 60 + min;
}

function _dlcFmtMins(mins) {
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const sfx = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return h + (m ? ':' + String(m).padStart(2, '0') : '') + '\u202f' + sfx;
}

// ── Vendor availability ───────────────────────────────────────
function computeBizAvailability(biz) {
  // Returns { status: 'now'|'soon'|'order'|'closed', label, sublabel }
  if (biz.availabilityType === 'order_window') {
    return { status: 'order', label: 'Đang nhận đơn', sublabel: 'Giao cuối tuần' };
  }

  const now   = new Date();
  const jsDay = now.getDay();
  const cur   = now.getHours() * 60 + now.getMinutes();
  const hoursStr = _dlcHoursForDay(biz, jsDay);

  if (hoursStr && hoursStr !== 'Nghỉ') {
    const parts = hoursStr.split('–').map(s => s.trim());
    const open  = _dlcParseTimeStr(parts[0]);
    const close = _dlcParseTimeStr(parts[1]);
    if (open !== null && close !== null) {
      if (cur >= open && cur < close)
        return { status: 'now',  label: 'Đang mở cửa', sublabel: 'Đến ' + _dlcFmtMins(close) };
      if (cur < open)
        return { status: 'soon', label: 'Mở cửa sớm',  sublabel: 'Lúc ' + _dlcFmtMins(open) };
    }
  }

  // Look ahead up to 6 days
  const VI_DAYS = ['Chủ Nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
  for (let i = 1; i <= 6; i++) {
    const d = (jsDay + i) % 7;
    const h = _dlcHoursForDay(biz, d);
    if (h && h !== 'Nghỉ') return { status: 'soon', label: 'Mở ' + VI_DAYS[d], sublabel: '' };
  }

  return { status: 'closed', label: 'Tạm đóng', sublabel: '' };
}

// ── User behavior tracking ────────────────────────────────────
const HomepagePersonalizer = (() => {
  const LS_KEY = 'dlc_behavior';

  function getScores() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (_) { return {}; }
  }

  function track(catId) {
    const s = getScores();
    s[catId] = (s[catId] || 0) + 1;
    try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (_) {}
  }

  function getTopCategories(regionId) {
    const s = getScores();
    const defaults = regionId === 'bayarea'
      ? ['food', 'travel', 'nails', 'hair']
      : ['food', 'nails', 'hair', 'travel'];
    return [...defaults].sort((a, b) => (s[b] || 0) - (s[a] || 0));
  }

  function getContext() {
    const regionId = window.DLCRegion?.current?.id || 'oc';
    return { regionId, topCategories: getTopCategories(regionId), scores: getScores() };
  }

  return { track, getTopCategories, getContext };
})();

// ── Featured vendor helpers ───────────────────────────────────
// ── Vendor admin-status cache (populated from Firestore on load) ─────────────
window._vendorAdminStatus = {}; // vendorId → 'active'|'blocked'|'deactivated'|'archived'

async function loadVendorAdminStatuses() {
  try {
    const snap = await db.collection('vendors').get();
    snap.docs.forEach(doc => {
      const s = doc.data().adminStatus;
      if (s) window._vendorAdminStatus[doc.id] = s;
    });
  } catch (_) { /* fail open — show all vendors if Firestore unreachable */ }
}

function _isVendorActive(vendorId) {
  const s = window._vendorAdminStatus[vendorId];
  return !s || s === 'active'; // undefined or 'active' = show
}

function getFeaturedVendors(regionId) {
  if (!window.MARKETPLACE) return [];
  return MARKETPLACE.businesses
    .filter(b => b.active && b.homepageActive && b.featuredRegions?.includes(regionId) && _isVendorActive(b.id))
    .sort((a, b) => (a.featuredPriority || 99) - (b.featuredPriority || 99));
}

function _hpCatLabel(c)  { return { nails: 'Nail Salon', hair: 'Tiệm Tóc', food: 'Ẩm Thực' }[c] || c; }
function _hpCatAccent(c) { return { nails: '#f472b6', hair: '#38bdf8', food: '#f59e0b' }[c] || 'var(--gold)'; }

// ── HTML builders ─────────────────────────────────────────────
const _CAT_PATHS = { nails: 'nailsalon/', hair: 'hairsalon/', food: 'foods/' };

function buildVendorCardHtml(biz) {
  const avail  = computeBizAvailability(biz);
  const accent = _hpCatAccent(biz.category);
  const catPath = _CAT_PATHS[biz.category] || ('marketplace/index.html?cat=' + biz.category);
  const href   = biz.id ? catPath + '?id=' + biz.id : catPath;
  const bg     = biz.heroImage
    ? `background:${biz.heroGradient};background-image:url(${biz.heroImage});background-size:cover;background-position:center`
    : `background:${biz.heroGradient}`;
  const trk = `HomepagePersonalizer.track('${biz.category}')`;

  return `<div class="hp-vendor-card" role="listitem"
    onclick="${trk}; window.location.href='${href}'">
    <div class="hp-vendor-card__img" style="${bg}">
      <span class="hp-vendor-card__cat" style="--cat-accent:${accent}">${_hpCatLabel(biz.category)}</span>
      <span class="hp-avail-badge hp-avail-badge--${avail.status}">${avail.label}</span>
    </div>
    <div class="hp-vendor-card__body">
      <div class="hp-vendor-card__name">${biz.name}</div>
      <div class="hp-vendor-card__city">${biz.city}</div>
      <div class="hp-vendor-card__promo">${biz.shortPromoText || biz.tagline}</div>
    </div>
  </div>`;
}

function buildAvailChipHtml(label, sublabel, status, onclick) {
  const sub = sublabel ? `<span class="hp-chip__sub">${sublabel}</span>` : '';
  const oc  = onclick  ? ` onclick="${onclick}"` : '';
  return `<div class="hp-chip hp-chip--${status}"${oc}>
    <span class="hp-chip__label">${label}</span>${sub}
  </div>`;
}

// ── Homepage renderers ────────────────────────────────────────
function renderFeaturedVendors(regionId) {
  const section   = document.getElementById('hpFeatured');
  const container = document.getElementById('hpVendorCards');
  const titleEl   = document.getElementById('hpFeaturedTitle');
  if (!section || !container) return;

  const vendors = getFeaturedVendors(regionId);
  if (!vendors.length) { section.hidden = true; return; }

  const regionName = window.DLCRegion?.current?.name;
  if (titleEl && regionName) titleEl.textContent = `Đề Xuất Tại ${regionName}`;

  container.innerHTML = vendors.map(buildVendorCardHtml).join('');
  section.hidden = false;
}

function renderAvailabilityHighlights(regionId, driverAvailable) {
  const section   = document.getElementById('hpAvail');
  const container = document.getElementById('hpAvailChips');
  if (!section || !container) return;

  const chips = [];
  for (const biz of getFeaturedVendors(regionId)) {
    const avail = computeBizAvailability(biz);
    if (avail.status === 'closed') continue;
    const label = biz.name.length > 20 ? biz.name.slice(0, 18) + '…' : biz.name;
    const catPath = _CAT_PATHS[biz.category] || 'marketplace/index.html';
    const nav   = `HomepagePersonalizer.track('${biz.category}'); window.location.href='${catPath}?id=${biz.id}'`;
    chips.push(buildAvailChipHtml(avail.label, label, avail.status, nav));
  }

  if (driverAvailable) {
    chips.push(buildAvailChipHtml(
      'Xe có sẵn', 'Đặt ngay', 'driver',
      "HomepagePersonalizer.track('travel'); switchScreen('screenBook')"
    ));
  }

  if (!chips.length) { section.hidden = true; return; }
  container.innerHTML = chips.join('');
  section.hidden = false;
}

function initHomepageIntelligence(region, driverAvailable) {
  const regionId = region?.id || 'oc';
  renderFeaturedVendors(regionId);
  // renderAvailabilityHighlights removed — "Có Sẵn Hôm Nay" section removed from homepage
}

// ── Homepage Panel Switcher ───────────────────────────────────
function switchHpPanel(panel) {
  document.querySelectorAll('.hp-tab').forEach(function(t) {
    var active = t.dataset.panel === panel;
    t.classList.toggle('hp-tab--active', active);
    t.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('.hp-panel').forEach(function(p) {
    var id = 'panel' + panel.charAt(0).toUpperCase() + panel.slice(1);
    var active = p.id === id;
    p.classList.toggle('hp-panel--active', active);
    if (active) {
      p.removeAttribute('hidden');
    } else {
      p.setAttribute('hidden', '');
    }
  });
}

// ── Travel Services Carousel ──────────────────────────────────
// Service cards appended after destinations
var _TRAVEL_SERVICES_EXTRA = [
  {
    chip: 'Sân Bay',
    title: 'Đưa Đón Sân Bay',
    sub: 'LAX · SFO · SJC · OAK · SAN · BUR',
    img: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600&auto=format&fit=crop&q=80',
    cta: 'Đặt với AI',
    intent: 'airport'
  },
  {
    chip: 'Xe Riêng',
    title: 'Xe Riêng Cao Cấp',
    sub: 'Tesla · Mercedes Van · Bay Area ↔ OC',
    img: 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=600&auto=format&fit=crop&q=80',
    cta: 'Đặt với AI',
    intent: 'ride'
  },
  {
    chip: 'Tùy Chỉnh',
    title: 'Kế Hoạch Riêng',
    sub: '15 điểm đến · AI tư vấn 24/7',
    img: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&auto=format&fit=crop&q=75',
    cta: 'Hỏi AI',
    intent: 'tour'
  }
];

function renderTravelCarousel() {
  var container = document.getElementById('travCarousel');
  if (!container) return;

  var cards = [];

  // All destinations from DESTINATIONS array (destinations.js)
  if (typeof DESTINATIONS !== 'undefined') {
    cards = DESTINATIONS.map(function(dest) {
      var chip = dest.duration
        ? (dest.duration.min + '–' + dest.duration.max + ' ' + dest.duration.unit)
        : 'Du Lịch';
      var id = dest.id;
      return '<div class="trav-card" role="listitem" onclick="openDestination(\'' + id + '\')" aria-label="' + dest.name.vi + '">' +
        '<div class="trav-card__bg" style="background-image:url(\'' + dest.image + '\')"></div>' +
        '<div class="trav-card__overlay"></div>' +
        '<div class="trav-card__body">' +
          '<span class="trav-card__chip">' + chip + '</span>' +
          '<h3 class="trav-card__title">' + dest.name.vi + '</h3>' +
          '<p class="trav-card__sub">' + dest.tagline.vi + '</p>' +
          '<button class="trav-card__cta" onclick="event.stopPropagation();openDestination(\'' + id + '\')">Khám phá</button>' +
        '</div>' +
      '</div>';
    });
  }

  // Append service cards
  _TRAVEL_SERVICES_EXTRA.forEach(function(s) {
    cards.push(
      '<div class="trav-card" role="listitem" onclick="openAIWithIntent(\'' + s.intent + '\')" aria-label="' + s.title + '">' +
        '<div class="trav-card__bg" style="background-image:url(\'' + s.img + '\')"></div>' +
        '<div class="trav-card__overlay"></div>' +
        '<div class="trav-card__body">' +
          '<span class="trav-card__chip">' + s.chip + '</span>' +
          '<h3 class="trav-card__title">' + s.title + '</h3>' +
          '<p class="trav-card__sub">' + s.sub + '</p>' +
          '<button class="trav-card__cta" onclick="event.stopPropagation();openAIWithIntent(\'' + s.intent + '\')">' + s.cta + '</button>' +
        '</div>' +
      '</div>'
    );
  });

  container.innerHTML = cards.join('');
}

// ── All Homepage Vendors (non-region-gated fallback) ──────────
function renderAllHomepageVendors() {
  var container = document.getElementById('hpVendorCards');
  var section   = document.getElementById('hpFeatured');
  if (!container || !window.MARKETPLACE) return;
  var vendors = MARKETPLACE.businesses
    .filter(function(b) { return b.active && b.homepageActive && _isVendorActive(b.id); })
    .sort(function(a, b) { return (a.featuredPriority || 99) - (b.featuredPriority || 99); });
  if (!vendors.length) return;
  container.innerHTML = vendors.map(buildVendorCardHtml).join('');
  if (section) section.hidden = false;
}

// ── Hero Carousel ─────────────────────────────────────────────
function heroCarouselCta(service) {
  if (service === 'travel') {
    switchScreen('screenBook');
  } else if (_CAT_PATHS[service]) {
    window.location.href = _CAT_PATHS[service];
  } else {
    window.location.href = 'marketplace/index.html?cat=' + service;
  }
}

var HeroCarousel = (function () {
  var SLIDES   = 4;
  var DURATION = 5000;
  var current  = 0;
  var timer    = null;
  var slides, dots, bar;
  var startX = 0;

  function init() {
    var el = document.getElementById('heroCarousel');
    if (!el) return;
    slides = el.querySelectorAll('.hc__slide');
    dots   = el.querySelectorAll('.hc__dot');
    SLIDES = slides.length; // always matches actual slide count in HTML
    bar    = document.getElementById('hcProgressBar');

    dots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        goto(parseInt(dot.dataset.dot, 10));
      });
    });

    el.addEventListener('touchstart', function (e) {
      startX = e.changedTouches[0].clientX;
    }, { passive: true });

    el.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) < 44) return;
      goto(dx < 0 ? (current + 1) % SLIDES : (current - 1 + SLIDES) % SLIDES);
    }, { passive: true });

    start();
  }

  function goto(idx) {
    slides[current].classList.remove('hc__slide--active');
    dots[current].classList.remove('hc__dot--active');
    dots[current].setAttribute('aria-selected', 'false');
    current = idx;
    slides[current].classList.add('hc__slide--active');
    dots[current].classList.add('hc__dot--active');
    dots[current].setAttribute('aria-selected', 'true');
    stop();
    start();
  }

  function start() {
    animateProgress();
    timer = setTimeout(function () {
      goto((current + 1) % SLIDES);
    }, DURATION);
  }

  function stop() {
    clearTimeout(timer);
    if (bar) {
      bar.style.transition = 'none';
      bar.style.width = '0%';
      void bar.offsetWidth; // force reflow
    }
  }

  function animateProgress() {
    if (!bar) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      bar.style.width = '100%';
      return;
    }
    bar.style.transition = 'none';
    bar.style.width = '0%';
    void bar.offsetWidth; // force reflow
    bar.style.transition = 'width ' + DURATION + 'ms linear';
    bar.style.width = '100%';
  }

  return { init: init, goto: goto };
})();

// ── AI-Centric Homepage Functions ────────────────────────────

/**
 * Toggle expand/collapse of a service feature card.
 * Only one card is open at a time.
 */
function toggleFc(cardId) {
  var card = document.getElementById(cardId);
  if (!card) return;
  var isOpen = card.classList.contains('svc-fc--open');
  // Close all
  document.querySelectorAll('.svc-fc--open').forEach(function(c) {
    c.classList.remove('svc-fc--open');
    var hdr = c.querySelector('.svc-fc__hdr');
    if (hdr) hdr.setAttribute('aria-expanded', 'false');
  });
  // Open this one if it was closed
  if (!isOpen) {
    card.classList.add('svc-fc--open');
    var hdr = card.querySelector('.svc-fc__hdr');
    if (hdr) hdr.setAttribute('aria-expanded', 'true');
  }
}

/**
 * Home screen AI card helpers — navigate to chat and seed the user's message.
 */
function homeAiSubmit() {
  var input = document.getElementById('homeAiInput');
  if (!input) return;
  var text = input.value.trim();
  if (!text) return;
  input.value = '';
  homeAiSend(text);
}

/**
 * Open chat in Marketplace mode — clears history, shows marketplace greeting + chips.
 * Called from the Marketplace AI launcher button on the homepage.
 */
function openMarketplaceChat() {
  switchScreen('screenChat');
  setTimeout(function() {
    if (window.DLChat && DLChat.openWithMode) DLChat.openWithMode('marketplace');
  }, 220);
}

/**
 * Open chat in Marketplace mode and send a user text message.
 * Called when the user submits the home panel text input.
 */
function homeAiSend(text) {
  switchScreen('screenChat');
  setTimeout(function () {
    if (window.DLChat) {
      if (DLChat.openWithMode) DLChat.openWithMode('marketplace', text);
      else {
        if (DLChat.setMode) DLChat.setMode('marketplace');
        if (DLChat.send) DLChat.send(text);
      }
    }
  }, 220);
}

/**
 * Switch to AI chat and send a pre-loaded intent message.
 * @param {string} intent - 'airport'|'tour'|'ride'|'price'|'order'|''
 */
function openAIWithIntent(intent) {
  // Silently request geolocation for transport-related intents (non-blocking)
  if (/airport|ride|private/.test(intent) && window.DLCLocation) {
    DLCLocation.request(null, null);
  }

  switchScreen('screenChat');

  // Intents that map directly to structured booking workflows
  var structuredFlows = {
    airport:         'airport',
    airport_pickup:  'airport_pickup',
    airport_dropoff: 'airport_dropoff',
    tour:            'tour',
    ride:            'ride',
    private_ride:    'ride',
  };
  if (Object.prototype.hasOwnProperty.call(structuredFlows, intent)) {
    var flowKey = structuredFlows[intent];
    // Determine mode for this flow so openWithMode shows the right greeting
    var modeForFlow = /tour/.test(flowKey) ? 'tour' : 'airport';
    setTimeout(function() {
      if (window.DLChat) {
        // Open with mode greeting first (resets history + shows mode-specific greeting+chips)
        if (DLChat.openWithMode) DLChat.openWithMode(modeForFlow);
        // Then start the workflow — its first question appends after the greeting
        if (DLChat.startFlow) DLChat.startFlow(flowKey);
      }
    }, 300);
    return;
  }

  var prompts = {
    price: 'Cho tôi biết bảng giá dịch vụ',
    order: 'Kiểm tra đơn đặt chỗ của tôi'
  };
  var prompt = intent && prompts[intent];
  if (prompt) {
    setTimeout(function() {
      if (window.DLChat && DLChat.send) DLChat.send(prompt);
    }, 300);
  }
}

/**
 * Populate airport chips and tour destination tags inside the feature cards.
 * Called after region is known and DESTINATIONS / AIRPORTS are loaded.
 */
function renderFeatureCards() {
  // Airport tags (region-filtered)
  var airTags = document.getElementById('fcAirTags');
  if (airTags && typeof AIRPORTS !== 'undefined') {
    var regionId = window.DLCRegion ? DLCRegion.current.id : 'oc';
    var filtered = AIRPORTS.filter(function(a) {
      return !a.region || a.region === regionId;
    });
    if (filtered.length === 0) filtered = AIRPORTS.slice(0, 6);
    airTags.innerHTML = filtered.map(function(a) {
      return '<span class="svc-fc__tag">' + a.code + '</span>';
    }).join('');
  }
  // Airport subtitle (region-specific count)
  var airSub = document.getElementById('fcAirSub');
  if (airSub && window.DLCRegion) {
    var r = DLCRegion.current;
    if (r && r.airports && r.airports.length) {
      var codes = r.airports;
      airSub.textContent = codes.length + ' sân bay · ' + codes.slice(0, 3).join(' · ') +
        (codes.length > 3 ? ' và thêm' : '');
    }
  }
  // Tour destination tags
  var tourTags = document.getElementById('fcTourTags');
  if (tourTags && typeof DESTINATIONS !== 'undefined') {
    var names = DESTINATIONS.slice(0, 9).map(function(d) {
      return d.name ? (d.name.vi || d.name.en || d.id) : d.id;
    });
    tourTags.innerHTML = names.map(function(n) {
      return '<span class="svc-fc__tag">' + n + '</span>';
    }).join('') + '<span class="svc-fc__tag">+ thêm</span>';
  }
}

// ── DOMContentLoaded ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

  // Region detection — fires updateRegionUI + availability check + homepage intelligence
  if (window.DLCRegion) {
    DLCRegion.init(async function(region) {
      updateRegionUI(region);
      const driverAvail = await checkRideServiceAvailability(region.id);
      initHomepageIntelligence(region, driverAvail);
    });
  }

  // Load vendor admin statuses first, then render (async, won't block long)
  loadVendorAdminStatuses().then(function() { renderAllHomepageVendors(); });

  // Render data-driven UI
  renderTravelCarousel();
  renderDestCards();
  renderDestList();
  renderTourChoiceGrid();
  renderFeatureCards();
  // Note: renderAirportChips() and populateAirportSelect() are called inside
  // updateRegionUI() so they always render with the correct region's airports.

  // Gas price (async, non-blocking)
  fetchGasPrice();

  // Flatpickr
  flatpickr('#datetime', {
    enableTime: true,
    time_24hr:  false,
    dateFormat: 'Y-m-d H:i',
    minDate:    new Date(),
    onOpen: async function (_, dateStr, instance) {
      if (!dateStr) return;
      const dateOnlyStr = dateStr.split(' ')[0];
      const snapshot = await db.collection('bookings').get();
      const unavailable = [];
      snapshot.forEach(doc => {
        const datetimeStr = getBookingDatetime(doc);
        const bookedTime  = new Date(datetimeStr);
        if (isNaN(bookedTime.getTime())) return;
        if (bookedTime.toISOString().split('T')[0] !== dateOnlyStr) return;
        const buffer = Math.ceil((doc.data().distance || 10) * 2) + 15;
        unavailable.push({
          from: new Date(bookedTime.getTime() - buffer * 60000),
          to:   new Date(bookedTime.getTime() + buffer * 60000)
        });
      });
      instance.set('disable', unavailable);
    }
  });

  // Initialize wizard to step 1 state
  goStep(1);

  // Initialize hero carousel
  HeroCarousel.init();

  // Initialize AI chat module
  if (window.DLChat) {
    DLChat.init({
      messagesId: 'chatMessages',
      inputId:    'chatInput',
      sendBtnId:  'chatSend'
    });
  }

  // Initialize bilingual voice input
  if (window.DLCVoice) {
    DLCVoice.init((transcript) => {
      const input = document.getElementById('chatInput');
      if (!input) return;
      input.value = transcript;
      // Trigger send (same as pressing Enter)
      const sendBtn = document.getElementById('chatSend');
      if (sendBtn) sendBtn.click();
    });
    // Hide mic button if unsupported
    if (!DLCVoice.isSupported) {
      const btn = document.getElementById('chatMicBtn');
      if (btn) btn.style.display = 'none';
    }
  }

  // Initialize Google Calendar (optional)
  safeInitGoogleAPI();
});
