# Travel Concierge — "Add My Choice" User Place Insertion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a trip participant add their own named place; the AI researches it in the background (never faking data), auto-places it on a validated schedule slot, persists it across refresh + regenerate, and lets families vote.

**Architecture:** Reuse the existing stores — `addedPlaces[]` (added/backup/vote_only) and `placeOverrides[].replacement` (replaced), all tagged `userChoice:true`. New backend callable `researchUserPlace` (Gemini-grounded + Google Places photos + route legs) with a standalone, unit-tested **sanitizer** that enforces honesty. New pure frontend helpers live in a small browser-IIFE module so they are node-testable (the repo's `pricing.js`/`pricing.test.js` pattern). DOM wiring is verified manually at 375px/1280px + the dry-run gate (no DOM test runner exists in this repo).

**Tech Stack:** Plain ES5-ish browser JS (IIFE, no build), Firebase Cloud Functions (Node, `firebase-functions` v7), Firestore + `@firebase/rules-unit-testing` emulator harness, Gemini 2.5 Flash (grounded) + Google Places/Distance Matrix. Tests run via bare `node` and `npm run test:rules` (emulator). No jest/mocha anywhere.

**Spec:** `docs/superpowers/specs/2026-06-22-travel-concierge-user-place-insertion-design.md`

**Ground rules (every phase):**
- **No fabricated data.** AI facts stay `dataSource:'ai_researched_pending_verification'`; the card shows the pending tag. `'verified'` markers only for `google_maps`-sourced sub-fields (photos, route distance).
- **i18n:** every new UI string added to the module-level `T` object in **en (~L37) + vi (~L314) + es (~L581)** in the *same commit*; access only via `t('key')`. Never write a literal to the DOM.
- **Mobile-first:** verify 375px then 1280px.
- **Version bump:** when `travel-concierge.js` changes, bump `?v=` in `travel-concierge.html` (the only HTML consumer) to the next **unused** string (verify with `git log --all -p` first), in the same commit.
- **Gate each phase:** `npm run test:userplace` (the new node unit tests — **the dry-run gate does NOT run them**, so run them explicitly) → `npm run test:rules` → `bash scripts/ai/targeted_dry_run.sh travel` → `scripts/ai/full_system_dry_run.sh` must end `FINAL: PASS`. **Do not deploy** until all 4 phases pass and the user confirms. (Optional hardening: add `node tests/travel-place-utils.test.js && node tests/user-place-sanitize.test.js` to the `travel)` branch of `scripts/ai/targeted_dry_run.sh` so the sanitizer honesty invariants run inside the gate.)
- **Commit frequently** (per task). Branch is `travel-concierge`.

---

## File Structure

**New files**
- `functions/lib/userPlaceSanitize.js` — pure, dependency-free honesty sanitizer + URL/maps helpers. `module.exports`. Required by `functions/index.js` and by the node test.
- `tests/user-place-sanitize.test.js` — node test for the sanitizer (run: `node tests/user-place-sanitize.test.js`).
- `travel-place-utils.js` — browser IIFE exposing `window.TCPlaceUtils` (pure helpers: `mealTypeToSlot`, `normalizeNameKey`, `clampPlacement`, `researchToPlace`, `findDuplicatePlace`). Loaded by `travel-concierge.html` **before** `travel-concierge.js`.
- `tests/travel-place-utils.test.js` — node test for `TCPlaceUtils` (run: `node tests/travel-place-utils.test.js`).
- `tests/live/research-user-place.js` — opt-in live integration test for the deployed `researchUserPlace` callable.

**Modified files**
- `functions/index.js` — add `exports.researchUserPlace` (Phase 1).
- `travel-concierge.js` — entry points, intake form, optimistic insert + research orchestration, `addedToPlace` extension, `placeCard` states/honesty tag, resume pass (P1); replace path (P2); proposed lane + `canSuggestPlace` + vote keying (P3); cost line-item + Food Picks + bookings (P4).
- `travel-concierge.html` — load `travel-place-utils.js`; bump `?v=`.
- `tests/rules/firestore-rules.test.js` — add member-can-write / stranger-cannot cases for the new fields (P1).
- `package.json` — add `test:userplace` script wiring the two node tests (P1).

---

# PHASE 1 — Foundation (honesty-first)

Scope: `researchUserPlace` + sanitizer; pure frontend helpers; "Add to itinerary / Save as backup" with optimistic Researching/Pending cards; extended `addedToPlace`; placeCard honesty tag + new fields; meal-slot mapping; placement clamp; resume-research pass; i18n; version bump; rules test; node tests. **No** Proposed lane, **no** cost change; entry points stay owner/organizer (`canEditPlan`).

---

### Task 1.1: Backend sanitizer module (pure, unit-tested)

**Files:**
- Create: `functions/lib/userPlaceSanitize.js`
- Test: `tests/user-place-sanitize.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/user-place-sanitize.test.js`:

```js
'use strict';
// node tests/user-place-sanitize.test.js  — pure-function test, no emulator.
const S = require('../functions/lib/userPlaceSanitize.js');
let pass = 0, fail = 0;
function ok(name, cond) { cond ? pass++ : fail++; console.log((cond ? '  PASS ' : '  FAIL ') + name); }

// priceRange: only $/$$/$$$ or a numeric range survives; anything else → 'pending verification'
ok('price $$ kept', S.sanitizeUserPlace({ priceRange: '$$' }, {}).priceRange === '$$');
ok('price "$20" range kept', S.sanitizeUserPlace({ priceRange: '$15-$25' }, {}).priceRange === '$15-$25');
ok('price prose blanked', S.sanitizeUserPlace({ priceRange: 'about twenty bucks' }, {}).priceRange === 'pending verification');

// phone is always stripped
ok('phone stripped', S.sanitizeUserPlace({ phone: '714-555-1212', name: 'X' }, {}).phone === undefined);

// guessed URLs blanked; official-looking domain kept
ok('guessed reservationUrl blanked', S.sanitizeUserPlace({ reservationUrl: 'http://book-pho79-now.example' }, {}).reservationUrl === '');
ok('opentable reservationUrl kept', S.sanitizeUserPlace({ reservationUrl: 'https://www.opentable.com/r/pho-79' }, {}).reservationUrl === 'https://www.opentable.com/r/pho-79');

// maps URLs are BUILT, never taken from the model
const m = S.sanitizeUserPlace({ name: 'Pho 79', address: 'Garden Grove, CA', googleMapsUrl: 'http://evil.example' }, {});
ok('googleMapsUrl rebuilt', m.googleMapsUrl.indexOf('google.com/maps') !== -1 && m.googleMapsUrl.indexOf('evil') === -1);

// dataSource forced to the pending tag so the client honesty marker fires
ok('dataSource forced pending', S.sanitizeUserPlace({ name: 'X', dataSource: 'verified' }, {}).dataSource === 'ai_researched_pending_verification');

// no photos field can come from the model (photos are added separately, deterministically)
ok('model photos dropped', S.sanitizeUserPlace({ name: 'X', photos: [{ url: 'http://ai.example/img' }] }, {}).photos === undefined);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run it; verify it fails**

Run: `node tests/user-place-sanitize.test.js`
Expected: FAIL — `Cannot find module '../functions/lib/userPlaceSanitize.js'`.

- [ ] **Step 3: Write the module**

Create `functions/lib/userPlaceSanitize.js`:

```js
'use strict';
// Pure, dependency-free honesty sanitizer for user-added place research.
// Mirrors the .map() clamp in researchTripStays (functions/index.js): every
// ungrounded field is blanked, never guessed; AI output is always pending verification.

var PRICE_RE = /^\s*(\${1,3}|\$?\d[\d,]*\s*(?:[-–]\s*\$?\d[\d,]*)?)\s*$/; // $/$$/$$$ or an optionally $-prefixed numeric range
var OFFICIAL_HOSTS = [
  'opentable.com', 'resy.com', 'yelp.com', 'tripadvisor.com', 'google.com',
  'toasttab.com', 'exploretock.com', 'ubereats.com', 'doordash.com', 'grubhub.com',
];

function cleanStr(s, max) { return String(s == null ? '' : s).slice(0, max || 200); }

function buildMapsUrls(name, address) {
  var q = encodeURIComponent((cleanStr(name, 120) + ' ' + cleanStr(address, 160)).trim());
  return {
    googleMapsUrl: q ? ('https://www.google.com/maps/search/?api=1&query=' + q) : '',
    appleMapsUrl: q ? ('https://maps.apple.com/?q=' + q) : '',
  };
}

function isAllowedUrl(u) {
  u = String(u || '').trim();
  if (!/^https:\/\//i.test(u)) return false;
  var host = '';
  try { host = u.replace(/^https:\/\//i, '').split('/')[0].toLowerCase(); } catch (e) { return false; }
  return OFFICIAL_HOSTS.some(function (h) { return host === h || host.indexOf('.' + h) !== -1 || host === 'www.' + h; });
}

// `parsed` = one place object from the model. `input` = the original request (reserved).
function sanitizeUserPlace(parsed, input) {
  parsed = parsed || {};
  var maps = buildMapsUrls(parsed.name, parsed.address);
  var price = String(parsed.priceRange || '').trim();
  var out = {
    name: cleanStr(parsed.name, 120),
    address: cleanStr(parsed.address, 160),
    rating: cleanStr(parsed.rating, 24),            // model may ground this; kept as-is text, blank if absent
    reviewCount: cleanStr(parsed.reviewCount, 16),
    hours: cleanStr(parsed.hours, 120),
    popularDishes: (Array.isArray(parsed.popularDishes) ? parsed.popularDishes : []).slice(0, 4).map(function (x) { return cleanStr(x, 60); }),
    priceRange: PRICE_RE.test(price) ? price.slice(0, 40) : 'pending verification',
    parkingNote: cleanStr(parsed.parkingNote, 120),
    kidSuitability: cleanStr(parsed.kidSuitability, 90),
    seniorSuitability: cleanStr(parsed.seniorSuitability, 90),
    estimatedDuration: cleanStr(parsed.estimatedDuration, 60),
    websiteUrl: isAllowedUrl(parsed.websiteUrl) ? cleanStr(parsed.websiteUrl, 240) : '',
    reservationUrl: isAllowedUrl(parsed.reservationUrl) ? cleanStr(parsed.reservationUrl, 240) : '',
    reservationNote: cleanStr(parsed.reservationNote, 120),
    googleMapsUrl: maps.googleMapsUrl,
    appleMapsUrl: maps.appleMapsUrl,
    why: cleanStr(parsed.why, 240),
    dataSource: 'ai_researched_pending_verification',
  };
  // photos are NEVER taken from the model — added separately from Google Places. (out.photos left undefined)
  // phone is never carried.
  return out;
}

module.exports = { sanitizeUserPlace: sanitizeUserPlace, buildMapsUrls: buildMapsUrls, isAllowedUrl: isAllowedUrl, PRICE_RE: PRICE_RE, OFFICIAL_HOSTS: OFFICIAL_HOSTS };
```

- [ ] **Step 4: Run it; verify it passes**

Run: `node tests/user-place-sanitize.test.js`
Expected: PASS — `9 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add functions/lib/userPlaceSanitize.js tests/user-place-sanitize.test.js
git commit -m "feat(travel-concierge): user-place research sanitizer (honesty-first, unit-tested)"
```

---

### Task 1.2: `researchUserPlace` callable

**Files:**
- Modify: `functions/index.js` (add a new `exports.researchUserPlace`; reuse `serverCallGeminiGrounded`, `tripSalvageJson`, `getAiKey`, `GOOGLE_MAPS_API_KEY`, `tcComputeRouteLegs`, `tripRequireAuth`, `tripCallerRole`)
- Test: `tests/live/research-user-place.js` (integration, opt-in)

- [ ] **Step 1: Add the callable**

In `functions/index.js`, near the other `researchTrip*` callables (after `researchTripStays`), add. Note: `require` the sanitizer at the top of the function (module load is fine — it's dependency-free):

```js
const _userPlaceSanitize = require('./lib/userPlaceSanitize.js');

// Research ONE user-named place (e.g. "Pho 79, Garden Grove"). Returns labeled,
// never-faked details + a placement suggestion. Photos come ONLY from Google Places.
exports.researchUserPlace = onCall(
  { region: 'us-central1', secrets: [GEMINI_API_KEY, GOOGLE_MAPS_API_KEY], timeoutSeconds: 60, memory: '256MiB', cors: true },
  async (request) => {
    const uid = tripRequireAuth(request);
    const d = request.data || {};
    const tripId = String(d.tripId || '');
    const role = await tripCallerRole(tripId, uid);
    if (!role) throw new HttpsError('permission-denied', 'Join this trip to add places.');
    const name = String(d.name || '').trim();
    if (!name) return { ok: false, debugCode: 'NO_NAME' };
    const lang = (d.lang === 'vi' || d.lang === 'es') ? d.lang : 'en';
    const geminiKey = await getAiKey('gemini');
    if (!geminiKey) return { ok: false, debugCode: 'NO_GEMINI_KEY' };

    const ctx = d.tripContext || {};
    const userContent = 'Research this ONE place the user already chose. Input JSON:\n' + JSON.stringify({
      name: name, area: String(d.area || '').slice(0, 120), placeType: String(d.placeType || '').slice(0, 40),
      mealType: String(d.mealType || '').slice(0, 20), notes: String(d.notes || '').slice(0, 300),
      destinations: Array.isArray(ctx.destinations) ? ctx.destinations.slice(0, 6) : [],
      dayContents: Array.isArray(ctx.dayContents) ? ctx.dayContents.slice(0, 10) : [],
      hotelsByCity: ctx.hotelsByCity || {}, groupProfile: ctx.groupProfile || {},
    });
    // Prompt carries the SAME honesty guardrails as researchTripRestaurants.
    const prompt = [
      'You are a LOCAL concierge for Du Lich Cali. The user already chose a specific place; research it using current web knowledge. You ONLY research — never reserve or charge.',
      'Return ONLY valid JSON (no markdown): { "place": { "name","address"(approx street + city, no fake suite),"rating"(rough star ONLY if grounded, e.g. "4.6★", else ""),"reviewCount"(e.g. "2k+" only if grounded, else ""),"hours"(short, only if grounded, else ""),"popularDishes":[up to 4 real signature items],"priceRange"("pending verification" or rough $/$$/$$$ — NEVER exact),"parkingNote"(short),"kidSuitability"(short),"seniorSuitability"(short),"estimatedDuration"(e.g. "1–2 hours"),"reservationNote"(walk-in ok / reserve ahead),"why"(one sentence) }, "suggestedPlacement": { "day"(0-based index into dayContents),"slot"(morning|lunch|afternoon|dinner|evening),"reason"(one sentence),"fits"(true|false) } }',
      'NEVER output exact prices, availability, confirmation numbers, phone numbers, or website/reservation URLs. NEVER output photos or image URLs. If you are not confident of a fact, leave that field "" — do not guess.',
      'For suggestedPlacement, reason from the provided dayContents, hotels, route, opening hours, mealType and the group mix (kids/seniors). Pick the day/slot that best fits.',
    ].join('\n');

    try {
      const text = await serverCallGeminiGrounded(prompt + '\n\n' + userContent, geminiKey, 2200);
      let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
      if (s > 0 || e > 0) raw = raw.slice(s, e + 1);
      const parsed = tripSalvageJson(raw);
      if (!parsed || !parsed.place) return { ok: false, debugCode: 'RESEARCH_ERROR' };

      const place = _userPlaceSanitize.sanitizeUserPlace(parsed.place, d);
      place.name = place.name || name; // never lose the user's name

      // Photos — Google Places only (same logic as placePhotos); empty without a key.
      place.photos = [];
      let researchedPlaceId = '';
      try {
        const key = GOOGLE_MAPS_API_KEY.value();
        if (key && String(key).trim().length >= 20) {
          const q = encodeURIComponent((place.name + ' ' + place.address).trim());
          const fp = await fetch(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${q}&inputtype=textquery&fields=place_id,photos,name&key=${key}`).then((r) => r.json());
          const cand = fp && fp.candidates && fp.candidates[0];
          researchedPlaceId = (cand && cand.place_id) || '';
          const refs = (cand && Array.isArray(cand.photos)) ? cand.photos.slice(0, 3) : [];
          for (const ph of refs) {
            try {
              const resp = await fetch(`https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(ph.photo_reference)}&key=${key}`, { redirect: 'manual' });
              const loc = resp.headers.get('location');
              if (loc && /^https?:\/\//.test(loc) && loc.indexOf('key=') === -1) place.photos.push({ url: loc, source: 'google_places' });
            } catch (e3) { /* skip photo */ }
          }
        }
      } catch (e2) { /* no photos */ }

      // Distance from hotel/route — labeled estimate under the placeholder key.
      let distanceNote = '', distanceSource = 'unknown';
      try {
        const fromCity = (ctx.hotelsByCity && Object.keys(ctx.hotelsByCity)[0]) || (Array.isArray(ctx.destinations) && ctx.destinations[0] && ctx.destinations[0].city) || '';
        const toArea = String(d.area || '') || place.address;
        if (fromCity && toArea) {
          const rl = await tcComputeRouteLegs([fromCity, toArea], GOOGLE_MAPS_API_KEY.value());
          const leg = rl && rl.legs && rl.legs[0];
          if (leg) { distanceNote = (leg.distanceText ? leg.distanceText + ' · ' : '') + (leg.durationText || ''); distanceSource = leg.source; }
        }
      } catch (e4) { /* no distance */ }
      if (distanceNote && distanceSource !== 'google_maps') distanceNote = distanceNote + ' (est.)';

      // Validate placement loosely server-side; the client clamps deterministically too.
      const sp = parsed.suggestedPlacement || {};
      const slots = ['morning', 'lunch', 'afternoon', 'dinner', 'evening'];
      const suggestedPlacement = {
        day: Number.isInteger(sp.day) ? sp.day : null,
        slot: slots.indexOf(String(sp.slot)) !== -1 ? sp.slot : '',
        reason: String(sp.reason || '').slice(0, 200),
        fits: sp.fits !== false,
      };

      return { ok: true, place, suggestedPlacement, distanceNote, distanceSource, researchedPlaceId, verificationStatus: 'pending_verification' };
    } catch (e) {
      console.error('[researchUserPlace] failed', e && e.message);
      return { ok: false, debugCode: 'RESEARCH_ERROR' };
    }
  }
);
```

> **Server-auth note:** `researchUserPlace` gates on `tripCallerRole(tripId, uid)`, which resolves via the `tripMembers/{tripId}/members/{uid}` doc (written by the join/share flow) — NOT the trip's `families` array. The admin-SDK callable bypasses Firestore rules, so passing the Task 1.8 client rules check does **not** imply the server accepts the call. Ensure anyone reaching the Add-my-place UI has joined via the share flow so `tripCallerRole` resolves non-null.

- [ ] **Step 2: Lint-check the file parses**

Run: `node -e "require('./functions/lib/userPlaceSanitize.js'); console.log('sanitizer ok')"`
Expected: `sanitizer ok` (confirms the new dependency resolves; full `index.js` needs firebase env so we don't run it directly).

- [ ] **Step 3: Write the live integration test**

Create `tests/live/research-user-place.js`:

```js
'use strict';
// OPT-IN live test for researchUserPlace. NOT run by the dry-run gate (live cost).
// Usage: TC_TOKEN=<idToken> TRIP_ID=<tripId> node tests/live/research-user-place.js
const https = require('https');
const TOKEN = process.env.TC_TOKEN, TRIP_ID = process.env.TRIP_ID;
const ENDPOINT = process.env.TC_ENDPOINT || 'https://us-central1-dulichcali-booking-calendar.cloudfunctions.net/researchUserPlace';
if (!TOKEN || !TRIP_ID) { console.error('Set TC_TOKEN and TRIP_ID.'); process.exit(2); }
function call(data) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ data });
    const u = new URL(ENDPOINT);
    const req = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN, 'Content-Length': Buffer.byteLength(body) } },
      (res) => { let d = ''; res.on('data', (c) => d += c); res.on('end', () => resolve(JSON.parse(d).result || {})); });
    req.on('error', (e) => resolve({ error: String(e) })); req.write(body); req.end();
  });
}
(async () => {
  const real = await call({ tripId: TRIP_ID, name: 'Pho 79', area: 'Garden Grove, CA', placeType: 'restaurant', mealType: 'dinner' });
  console.log('REAL place:', JSON.stringify(real.place || real, null, 2).slice(0, 800));
  const p = real.place || {};
  console.log('  honesty: dataSource =', p.dataSource, '| photos from google only:', (p.photos || []).every(x => x.source === 'google_places'));
  console.log('  no phone field:', p.phone === undefined, '| price labeled:', /pending|^\$|\d/.test(p.priceRange || ''));
  const fake = await call({ tripId: TRIP_ID, name: 'Zzqx Nonexistent Place 99999', area: 'Nowhere, CA', placeType: 'restaurant' });
  const fp = fake.place || {};
  console.log('FAKE place address blanked-or-empty:', !fp.address || fp.address.length < 30, '| rating empty:', !fp.rating);
})();
```

- [ ] **Step 4: Commit** (deploy + live run happen at the phase gate, not now)

```bash
git add functions/index.js tests/live/research-user-place.js
git commit -m "feat(travel-concierge): researchUserPlace callable (grounded + Google Places photos + route, sanitized)"
```

---

### Task 1.3: Pure frontend helpers module (unit-tested)

**Files:**
- Create: `travel-place-utils.js`
- Test: `tests/travel-place-utils.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/travel-place-utils.test.js`:

```js
'use strict';
// node tests/travel-place-utils.test.js — loads the browser IIFE like tests/pricing.test.js does.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'travel-place-utils.js'), 'utf8') + '\nreturn window.TCPlaceUtils;';
const w = {}; const U = new Function('window', src)(w); // same loader pattern as tests/pricing.test.js
let pass = 0, fail = 0;
function ok(n, c) { c ? pass++ : fail++; console.log((c ? '  PASS ' : '  FAIL ') + n); }

// meal-type → a real TIME_SLOTS member
ok('breakfast→morning', U.mealTypeToSlot('breakfast') === 'morning');
ok('dinner→dinner', U.mealTypeToSlot('dinner') === 'dinner');
ok('coffee→afternoon', U.mealTypeToSlot('coffee') === 'afternoon');
ok('dessert late→evening', U.mealTypeToSlot('dessert', '21:00') === 'evening');
ok('unknown→afternoon', U.mealTypeToSlot('xyz') === 'afternoon');

// name normalization folds case + diacritics
ok('diacritic fold', U.normalizeNameKey('Phở 79') === U.normalizeNameKey('Pho 79'));
ok('trim+lower', U.normalizeNameKey('  PHO 79 ') === 'pho 79');

// placement clamp: out-of-range / travel day → nearest valid non-travel day
ok('clamp day too big', U.clampPlacement({ day: 9, slot: 'dinner' }, { dayCount: 3, travelDays: [] }).day === 2);
ok('clamp travel day', U.clampPlacement({ day: 1, slot: 'dinner' }, { dayCount: 3, travelDays: [1] }).day !== 1);
ok('clamp bad slot→afternoon', U.clampPlacement({ day: 0, slot: 'midnight' }, { dayCount: 3, travelDays: [] }).slot === 'afternoon');

// researchToPlace maps research output → placeCard field names
const rp = U.researchToPlace({ priceRange: '$$', popularDishes: ['Phở'], hours: '9-9', kidSuitability: 'High' }, { name: 'Pho 79' });
ok('priceRange→estimatedCost', rp.estimatedCost === '$$');
ok('dishes carried', rp.popularDishes[0] === 'Phở');
ok('dataSource pending', /pending/.test(rp.dataSource));

console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run it; verify it fails**

Run: `node tests/travel-place-utils.test.js`
Expected: FAIL — cannot read `travel-place-utils.js` (ENOENT).

- [ ] **Step 3: Write the module**

Create `travel-place-utils.js`:

```js
/* Pure helpers for user-place insertion. Browser IIFE, also node-testable. */
(function (root) {
  'use strict';
  var TIME_SLOTS = ['morning', 'lunch', 'afternoon', 'dinner', 'evening', 'optional', 'backup'];

  function mealTypeToSlot(mealType, preferredTime) {
    var m = String(mealType || '').toLowerCase();
    if (m === 'breakfast') return 'morning';
    if (m === 'lunch') return 'lunch';
    if (m === 'dinner') return 'dinner';
    if (m === 'snack' || m === 'dessert' || m === 'coffee') {
      var hr = parseInt(String(preferredTime || '').replace(/[^\d]/g, '').slice(0, 2), 10);
      return (hr >= 19 || hr === 0 && /pm|night|evening/i.test(String(preferredTime))) ? 'evening' : 'afternoon';
    }
    return 'afternoon';
  }

  function normalizeNameKey(name) {
    return String(name || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  }

  function clampPlacement(suggested, ctx) {
    suggested = suggested || {}; ctx = ctx || {};
    var count = Math.max(1, ctx.dayCount || 1);
    var travel = ctx.travelDays || [];
    var day = (typeof suggested.day === 'number' && suggested.day >= 0) ? suggested.day : 0;
    if (day > count - 1) day = count - 1;
    // move off a travel day to the nearest non-travel day
    if (travel.indexOf(day) !== -1) {
      var found = -1;
      for (var off = 1; off < count; off++) {
        if (day + off <= count - 1 && travel.indexOf(day + off) === -1) { found = day + off; break; }
        if (day - off >= 0 && travel.indexOf(day - off) === -1) { found = day - off; break; }
      }
      day = found >= 0 ? found : day;
    }
    var slot = TIME_SLOTS.indexOf(String(suggested.slot)) >= 0 ? suggested.slot : 'afternoon';
    return { day: day, slot: slot };
  }

  // Map sanitized research output onto the field names placeCard reads.
  function researchToPlace(research, entry) {
    research = research || {}; entry = entry || {};
    return {
      name: research.name || entry.name || '',
      address: research.address || '',
      estimatedCost: research.priceRange || '',           // placeCard reads estimatedCost
      estimatedDuration: research.estimatedDuration || '',
      popularDishes: Array.isArray(research.popularDishes) ? research.popularDishes : [],
      rating: research.rating || '', reviewCount: research.reviewCount || '', hours: research.hours || '',
      parkingNote: research.parkingNote || '',
      kidSuitability: research.kidSuitability || '', seniorSuitability: research.seniorSuitability || '',
      googleMapsUrl: research.googleMapsUrl || '', appleMapsUrl: research.appleMapsUrl || '',
      websiteUrl: research.websiteUrl || '', reservationUrl: research.reservationUrl || '',
      whySelected: research.why || '',
      dataSource: research.dataSource || 'ai_researched_pending_verification',
    };
  }

  // Find a duplicate by normalized name across the trip's place stores.
  function findDuplicatePlace(name, trip) {
    var key = normalizeNameKey(name); if (!key || !trip) return null;
    var hit = null;
    (trip.addedPlaces || []).forEach(function (a) { if (a && normalizeNameKey(a.name) === key) hit = hit || { where: 'added', name: a.name }; });
    ((trip.plan && trip.plan.days) || []).forEach(function (d) { (d && d.sections || []).forEach(function (sec) { (sec.places || []).forEach(function (p) { if (p && normalizeNameKey(p.name) === key) hit = hit || { where: 'itinerary', name: p.name }; }); }); });
    (trip.food || []).forEach(function (f) { (f.picks || []).forEach(function (p) { if (p && normalizeNameKey(p.name) === key) hit = hit || { where: 'food', name: p.name }; }); });
    return hit;
  }

  root.TCPlaceUtils = { mealTypeToSlot: mealTypeToSlot, normalizeNameKey: normalizeNameKey, clampPlacement: clampPlacement, researchToPlace: researchToPlace, findDuplicatePlace: findDuplicatePlace, TIME_SLOTS: TIME_SLOTS };
})(typeof window !== 'undefined' ? window : this);
```

- [ ] **Step 4: Run it; verify it passes**

Run: `node tests/travel-place-utils.test.js`
Expected: PASS — `14 passed, 0 failed`.

- [ ] **Step 5: Wire npm script + load the module in HTML**

Add to `package.json` `scripts` (after `test:pricing`):

```json
    "test:userplace": "node tests/travel-place-utils.test.js && node tests/user-place-sanitize.test.js",
```

In `travel-concierge.html`, add **before** the `<script src="travel-concierge.js?v=…">` line (use the same `?v=` you will set at the version-bump step):

```html
<script src="travel-place-utils.js?v=PLACEHOLDER_BUMP"></script>
```

- [ ] **Step 6: Run the npm script; commit**

Run: `npm run test:userplace`
Expected: both suites print `passed, 0 failed`.

```bash
git add travel-place-utils.js tests/travel-place-utils.test.js package.json travel-concierge.html
git commit -m "feat(travel-concierge): pure place-utils module (meal-slot, name-key, clamp, mapper) + node test"
```

---

### Task 1.4: Extend `addedToPlace` to forward enriched fields

**Files:**
- Modify: `travel-concierge.js` — `addedToPlace` (~L4552)

- [ ] **Step 1: Replace the lossy mapper**

Find:

```js
  function addedToPlace(ap) { return { id: ap.id, name: ap.name, category: ap.category || '', address: ap.address || '', whySelected: ap.note || '', dataSource: 'user_entered', _added: true }; }
```

Replace with:

```js
  function addedToPlace(ap) {
    return {
      id: ap.id, name: ap.name, category: ap.category || '', _added: true,
      address: ap.address || '', whySelected: ap.whySelected || ap.note || '',
      estimatedCost: ap.estimatedCost || '', estimatedDuration: ap.estimatedDuration || '',
      popularDishes: Array.isArray(ap.popularDishes) ? ap.popularDishes : [],
      rating: ap.rating || '', reviewCount: ap.reviewCount || '', hours: ap.hours || '',
      parkingNote: ap.parkingNote || '', kidSuitability: ap.kidSuitability || '', seniorSuitability: ap.seniorSuitability || '',
      googleMapsUrl: ap.googleMapsUrl || '', appleMapsUrl: ap.appleMapsUrl || '',
      websiteUrl: ap.websiteUrl || '', reservationUrl: ap.reservationUrl || '',
      photos: Array.isArray(ap.photos) ? ap.photos : [],
      distanceNote: ap.distanceNote || '', distanceSource: ap.distanceSource || '',
      verificationStatus: ap.verificationStatus || '',
      dataSource: ap.dataSource || 'user_entered',
    };
  }
```

- [ ] **Step 2: Verify the file still parses**

Run: `node -e "new Function(require('fs').readFileSync('travel-concierge.js','utf8')); console.log('parse ok')"`
Expected: `parse ok` (syntax check only — the IIFE references `window`/DOM at call time, but parsing must succeed).

- [ ] **Step 3: Commit**

```bash
git add travel-concierge.js
git commit -m "feat(travel-concierge): addedToPlace forwards enriched research + verification fields"
```

---

### Task 1.5: `placeCard` — Researching state, pending-verification tag, new field chips, photos

**Files:**
- Modify: `travel-concierge.js` — `placeCard` (~L5057)
- i18n: add keys to `T` (en/vi/es)

- [ ] **Step 1: Add the i18n keys**

In `T.en` (near the `addedByYou`/`addKind_*` block ~L202-207) add:

```js
      ucResearching: '🔎 Researching…', ucPending: 'Pending verification', ucRetry: '↻ Retry research',
      ucRatingLabel: 'Rating', ucHoursLabel: 'Hours', ucParkingLabel: 'Parking',
      ucKid: 'Kids', ucSenior: 'Seniors', ucDistance: 'From hotel',
```

Add the SAME keys to `T.vi` (~L314) and `T.es` (~L581) with correct translations, e.g.
vi: `ucResearching: '🔎 Đang tìm hiểu…', ucPending: 'Chưa xác minh', ucRetry: '↻ Thử lại', ucRatingLabel: 'Đánh giá', ucHoursLabel: 'Giờ mở cửa', ucParkingLabel: 'Đậu xe', ucKid: 'Trẻ em', ucSenior: 'Người lớn tuổi', ucDistance: 'Từ khách sạn',`
es: `ucResearching: '🔎 Investigando…', ucPending: 'Verificación pendiente', ucRetry: '↻ Reintentar', ucRatingLabel: 'Calificación', ucHoursLabel: 'Horario', ucParkingLabel: 'Estacionamiento', ucKid: 'Niños', ucSenior: 'Mayores', ucDistance: 'Desde el hotel',`

- [ ] **Step 2: Add the Researching short-circuit + honesty tag + chips to `placeCard`**

In `placeCard`, immediately after `body.appendChild(el('strong', 'tc-place__name', p.name));`, insert the Researching short-circuit and pending tag:

```js
    // User-choice research states (honesty-first).
    if (p.verificationStatus === 'researching') {
      var rb = el('p', 'tc-unverified', t('ucResearching'));
      body.appendChild(rb);
      // While researching, show name + address only — no factual chips.
      if (p.address) body.appendChild(el('p', 'tc-place__addr', p.address));
      c.appendChild(body); return c;
    }
    if (p.dataSource && /pending/.test(p.dataSource)) body.appendChild(el('p', 'tc-unverified', '⚠ ' + t('ucPending')));
```

Then, in the chips section, after the existing `walkingLevel` chip line, add chips for the research fields (all degrade gracefully — only render when present):

```js
    if (p.rating) chips.appendChild(chip('', '★ ' + p.rating + (p.reviewCount ? ' (' + p.reviewCount + ')' : '')));
    if (p.hours) chips.appendChild(chip('', '🕒 ' + p.hours));
    if (p.parkingNote) chips.appendChild(chip('', '🅿 ' + p.parkingNote));
    if (p.kidSuitability) chips.appendChild(chip('', '🧒 ' + p.kidSuitability));
    if (p.seniorSuitability) chips.appendChild(chip('', '🧓 ' + p.seniorSuitability));
    if (p.distanceNote) { var dc = chip('tc-chip--dist', '📍 ' + t('ucDistance') + ': ' + p.distanceNote); if (p.distanceSource && p.distanceSource !== 'google_maps') dc.classList.add('tc-unverified'); chips.appendChild(dc); }
```

- [ ] **Step 3: Add a Retry button for pending entries that are user-added**

In `placeCard`, in the action buttons (`acts`) section, after the `det` (details) button append:

```js
    if (ctx.added && p.dataSource && /pending/.test(p.dataSource) && canEditPlan()) {
      var rt = el('button', 'tc-pbtn', t('ucRetry')); rt.type = 'button';
      rt.addEventListener('click', function () { if (ctx.addedRef) retryUserPlaceResearch(ctx.addedRef); });
      acts.appendChild(rt);
    }
```

(`retryUserPlaceResearch` is defined in Task 1.7.)

- [ ] **Step 4: Manual verify (375px + 1280px)**

Start a local server: `python3 -m http.server 8080` (from repo root). Open `http://localhost:8080/travel-concierge.html`, load/seed a trip, and confirm: an added place with `verificationStatus:'researching'` shows the Researching line and no chips; a place with `dataSource` containing `pending` shows the "⚠ Pending verification" tag; rating/hours/distance chips render when present. Resize to 375px and 1280px — layout intact. (DOM behavior is verified here because the repo has no DOM unit-test runner.)

- [ ] **Step 5: Commit**

```bash
git add travel-concierge.js
git commit -m "feat(travel-concierge): placeCard researching state + pending-verification tag + research chips (i18n vi/en/es)"
```

---

### Task 1.6: Intake — 9-type "Add my place" expander + 3-step form (owner/organizer for now)

**Files:**
- Modify: `travel-concierge.js` — `dayActionsBar` (~L5161), `addPlaceForm` (~L5174); add `state._ucForm` handling
- i18n: add type labels + form labels to `T`

- [ ] **Step 1: Add i18n keys** (en, then vi + es equivalents)

```js
      ucAddMine: '＋ Add my place', ucPickType: 'What kind of place?',
      uct_restaurant: 'Restaurant', uct_coffee: 'Coffee / Dessert', uct_attraction: 'Attraction', uct_event: 'Event',
      uct_stay: 'Hotel / Stay', uct_stopover: 'Stopover', uct_activity: 'Activity', uct_shopping: 'Shopping', uct_other: 'Other / Note',
      ucName: 'Place name', ucArea: 'City / area', ucMore: 'More details (optional)',
      ucPrefDay: 'Preferred day', ucPrefTime: 'Preferred time', ucMeal: 'Meal type', ucNotes: 'Notes',
      ucAction: 'What should we do with it?',
      uca_add: 'Add to itinerary', uca_backup: 'Save as backup', uca_vote: 'Ask group to vote', uca_food: 'Add to Food Picks', uca_replace: 'Replace a recommendation',
      ucNext: 'Next', ucBack: 'Back', ucSubmit: 'Research & add', ucDupWarn: 'This place is already on your trip.', ucGoTo: 'Go to it',
      ucMeal_breakfast: 'Breakfast', ucMeal_lunch: 'Lunch', ucMeal_dinner: 'Dinner', ucMeal_snack: 'Snack', ucMeal_dessert: 'Dessert', ucMeal_coffee: 'Coffee',
```

(Phase 1 only wires `uca_add` + `uca_backup`. The others render but are disabled until their phase — show with a `disabled` attribute + a "coming soon" title, OR omit them from the selector in Phase 1 and add per phase. **Decision: in Phase 1 the action selector lists only `uca_add` and `uca_backup`.** Phase 2 adds `uca_replace`; Phase 3 adds `uca_vote`; Phase 4 adds `uca_food`.)

- [ ] **Step 2: Replace `dayActionsBar` to use the expander**

Replace the three `＋ Activity/Restaurant/Rest Stop` buttons with a single expander that opens the new form. Find the `row.appendChild(pbtn('＋ ' + t('addActivity')…` block (3 lines) and replace those three lines with:

```js
    row.appendChild(pbtn(t('ucAddMine'), 'tc-pbtn--accent', function () { state._ucForm = (state._ucForm && state._ucForm.day === dayIdx) ? null : { day: dayIdx, step: 1, draft: { placeType: 'restaurant', action: 'add' } }; render(); }));
```

Keep the Regenerate / Re-optimize buttons. Then replace the trailing `if (state._addOpen …) bar.appendChild(addPlaceForm(…))` line with:

```js
    if (state._ucForm && state._ucForm.day === dayIdx) bar.appendChild(addMyChoiceForm(dayIdx));
```

- [ ] **Step 3: Add the 3-step `addMyChoiceForm`** (replace the old `addPlaceForm` body or add alongside; the old one is no longer called)

```js
  var UC_TYPES = ['restaurant', 'coffee', 'attraction', 'event', 'stay', 'stopover', 'activity', 'shopping', 'other'];
  var UC_MEALS = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'coffee'];

  function addMyChoiceForm(dayIdx) {
    var st = state._ucForm, draft = st.draft;
    var f = el('div', 'tc-addform tc-ucform');
    if (st.step === 1) {
      f.appendChild(el('p', 'tc-addform__h', t('ucPickType')));
      var typeSel = selectFrom(UC_TYPES, draft.placeType, function (o) { return t('uct_' + o); });
      f.appendChild(field(t('ucPickType'), typeSel));
      var nm = input(draft.name || '', t('ucName')); f.appendChild(field(t('ucName'), nm));
      var ar = input(draft.area || '', t('ucArea')); f.appendChild(field(t('ucArea'), ar));
      var dupNote = el('div', 'tc-ucdup');
      var nextRow = el('div', 'tc-addform__acts');
      nextRow.appendChild(pbtn(t('ucNext'), 'tc-pbtn--accent', function () {
        draft.placeType = typeSel.value; draft.name = (nm.value || '').trim(); draft.area = (ar.value || '').trim();
        if (!draft.name) { toast(t('ucName')); return; }
        var dup = TCPlaceUtils.findDuplicatePlace(draft.name, state.trip);
        if (dup) { dupNote.textContent = t('ucDupWarn') + ' (' + dup.where + ')'; return; }
        st.step = 2; render();
      }));
      nextRow.appendChild(pbtn(t('cancelAdd'), '', function () { state._ucForm = null; render(); }));
      f.appendChild(dupNote); f.appendChild(nextRow);
    } else if (st.step === 2) {
      f.appendChild(el('p', 'tc-addform__h', t('ucAction')));
      // Phase 1: only add + backup. (Phase 2 adds 'replace'; Phase 3 'vote'; Phase 4 'food'.)
      var actions = ['add', 'backup'];
      var actSel = selectFrom(actions, draft.action, function (o) { return t('uca_' + o); });
      f.appendChild(field(t('ucAction'), actSel));
      // Optional details collapsed.
      var moreWrap = el('details', 'tc-ucmore'); moreWrap.appendChild(el('summary', '', t('ucMore')));
      var prefDay = selectFrom(dayIndexOptions(), String(draft.prefDay != null ? draft.prefDay : dayIdx), function (o) { return t('day') + ' ' + (parseInt(o, 10) + 1); });
      moreWrap.appendChild(field(t('ucPrefDay'), prefDay));
      var mealSel = selectFrom([''].concat(UC_MEALS), draft.mealType || '', function (o) { return o ? t('ucMeal_' + o) : '—'; });
      moreWrap.appendChild(field(t('ucMeal'), mealSel));
      f.appendChild(moreWrap);
      var row = el('div', 'tc-addform__acts');
      row.appendChild(pbtn(t('ucBack'), '', function () { st.step = 1; render(); }));
      row.appendChild(pbtn(t('ucSubmit'), 'tc-pbtn--accent', function () {
        draft.action = actSel.value; draft.prefDay = parseInt(prefDay.value, 10); draft.mealType = mealSel.value;
        submitUserPlace(draft); state._ucForm = null; render();
      }));
      f.appendChild(row);
    }
    return f;
  }
  function dayIndexOptions() { var n = ((state.trip && state.trip.plan && state.trip.plan.days) || []).length || 1; var a = []; for (var i = 0; i < n; i++) a.push(String(i)); return a; }
```

(`submitUserPlace` is defined in Task 1.7. `selectFrom`, `input`, `field`, `pbtn`, `toast`, `el` already exist.)

- [ ] **Step 4: Manual verify (375px + 1280px)**

Reload `travel-concierge.html`. As the trip owner, on a day, tap **＋ Add my place** → Step 1 shows type/name/area; entering a name already on the trip shows the duplicate warning; **Next** → Step 2 shows the action selector (Add / Save as backup) and a collapsed "More details". Confirm both breakpoints.

- [ ] **Step 5: Commit**

```bash
git add travel-concierge.js
git commit -m "feat(travel-concierge): 9-type Add-my-place expander + 3-step intake form (add/backup; i18n vi/en/es)"
```

---

### Task 1.7: Optimistic insert + background research + auto-place + resume pass

**Files:**
- Modify: `travel-concierge.js` — add `submitUserPlace`, `runUserPlaceResearch`, `retryUserPlaceResearch`, and a resume hook in the trip-load path; reuse `addedPlaces`, `saveTrip`, `render`, `laneMaxOrder`, `uid`, `curUid`, the Firebase callable bridge.
- i18n: toast keys.

- [ ] **Step 1: Confirm the callable bridge**

The frontend bridge is `mkCallable(name, timeout)` (travel-concierge.js:~1501) → `root.firebase.functions().httpsCallable(name, { timeout })`, invoked with a **bare** payload and read as `r.data` (the callable SDK adds the `{data:...}` envelope itself). Verify:

```bash
grep -n "mkCallable" travel-concierge.js | head
```

The steps below call `tcCallable('researchUserPlace', payload)` — a thin wrapper over `mkCallable` defined in Step 4.

- [ ] **Step 2: Add toast i18n keys** (en/vi/es)

```js
      ucToastResearching: 'Researching {name}…', ucToastAdded: '{name} added — {slot} Day {day} (pending verification)', ucToastFailed: 'Could not verify {name} — added as pending.',
```

- [ ] **Step 3: Add the orchestration functions**

```js
  function submitUserPlace(draft) {
    var slot = draft.mealType ? TCPlaceUtils.mealTypeToSlot(draft.mealType, draft.prefTime) : 'afternoon';
    var day = (typeof draft.prefDay === 'number' && draft.prefDay >= 0) ? draft.prefDay : (state.activeDay || 0);
    var entry = {
      id: uid('add'), name: draft.name, category: draft.placeType || 'activity', addedKind: draft.placeType || 'activity',
      userChoice: true, ucAction: draft.action || 'add',
      locationHint: draft.area || '', mealType: draft.mealType || '', notes: draft.notes || '', lockedByUser: false, proposed: false,
      day: day, slot: (draft.action === 'backup' ? 'backup' : slot), order: laneMaxOrder(day, (draft.action === 'backup' ? 'backup' : slot)) + 1,
      verificationStatus: 'researching', researchAttempts: 0,
      dataSource: 'user_entered', createdBy: curUid() || '', createdAt: new Date().toISOString(),
    };
    addedPlaces().push(entry); saveTrip(state.trip); render();
    toast(t('ucToastResearching').replace('{name}', entry.name));
    runUserPlaceResearch(entry, draft.prefDay == null /* allow auto-reslot only if user gave no day */);
  }

  function tcTripContext() {
    var tr = state.trip || {};
    var days = ((tr.plan && tr.plan.days) || []).map(function (d, i) {
      return { day: i, isTravelDay: !!(d && d.isTravelDay), title: (d && d.title) || '', places: ((d && d.sections) || []).flatMap ? (d.sections || []).flatMap(function (s) { return (s.places || []).map(function (p) { return p.name; }); }) : [] };
    });
    var hotelsByCity = {}; (tr.destinations || []).forEach(function (d) { if (d && d.city) hotelsByCity[d.city] = (d.hotelName || d.bestArea || ''); });
    return { destinations: (tr.destinations || []).map(function (d) { return { city: d.city, role: d.role }; }), dayContents: days, hotelsByCity: hotelsByCity, groupProfile: tr.groupProfile || {} };
  }

  function runUserPlaceResearch(entry, allowReslot) {
    entry.researchAttempts = (entry.researchAttempts || 0) + 1;
    var payload = { tripId: state.trip.id, name: entry.name, area: entry.locationHint, placeType: entry.category, mealType: entry.mealType, notes: entry.notes, lang: state.lang, tripContext: tcTripContext() };
    return tcCallable('researchUserPlace', payload).then(function (res) {
      var r = res || {}; // tcCallable already returns the unwrapped data object
      if (!r.ok || !r.place) { return failUserPlaceResearch(entry); }
      var mapped = TCPlaceUtils.researchToPlace(r.place, entry);
      Object.keys(mapped).forEach(function (k) { entry[k] = mapped[k]; }); // forward enriched fields onto the entry
      entry.photos = (r.place.photos || []); entry.researchedPlaceId = r.researchedPlaceId || '';
      entry.distanceNote = r.distanceNote || ''; entry.distanceSource = r.distanceSource || '';
      entry.verificationStatus = 'pending_verification';
      entry.dataSource = 'ai_researched_pending_verification'; // flip so the honesty tag fires
      // Auto-place: only re-slot if the user did not pin a day, and only for non-backup.
      if (allowReslot && entry.ucAction !== 'backup' && r.suggestedPlacement) {
        var travelDays = ((state.trip.plan && state.trip.plan.days) || []).map(function (d, i) { return (d && d.isTravelDay) ? i : -1; }).filter(function (i) { return i >= 0; });
        var cl = TCPlaceUtils.clampPlacement({ day: r.suggestedPlacement.day, slot: r.suggestedPlacement.slot }, { dayCount: dayIndexOptions().length, travelDays: travelDays });
        entry.day = cl.day; entry.slot = cl.slot; entry.order = laneMaxOrder(cl.day, cl.slot) + 1;
      }
      saveTrip(state.trip); render();
      toast(t('ucToastAdded').replace('{name}', entry.name).replace('{slot}', t('ts_' + entry.slot)).replace('{day}', (entry.day + 1)));
    }).catch(function () { return failUserPlaceResearch(entry); });
  }

  function failUserPlaceResearch(entry) {
    entry.verificationStatus = 'pending_verification';
    entry.dataSource = 'ai_researched_pending_verification';
    saveTrip(state.trip); render();
    toast(t('ucToastFailed').replace('{name}', entry.name));
  }

  function retryUserPlaceResearch(entry) {
    if (!entry) return;
    entry.verificationStatus = 'researching'; saveTrip(state.trip); render();
    runUserPlaceResearch(entry, false);
  }

  // Resume any entries left mid-research (page closed before resolve). Creator-only, capped at 3.
  function resumeUserPlaceResearch() {
    var me = curUid();
    addedPlaces().forEach(function (ap) {
      if (ap && ap.userChoice && ap.verificationStatus === 'researching' && (ap.researchAttempts || 0) < 3 && (!ap.createdBy || ap.createdBy === me)) {
        runUserPlaceResearch(ap, false);
      }
    });
  }
```

- [ ] **Step 4: Define the `tcCallable` wrapper over `mkCallable`, and call `resumeUserPlaceResearch` after a trip loads**

Add next to the other Firebase calls:

```js
  function tcCallable(name, data) {
    var c = mkCallable(name, 60000); // mkCallable(name, timeout) → root.firebase.functions().httpsCallable(name, { timeout })
    if (!c) return Promise.reject(new Error('functions unavailable'));
    return c(data).then(function (r) { return (r && r.data) || {}; }); // pass the BARE payload; the SDK wraps it as {data:...}
  }
```

Find where a loaded trip is assigned to `state.trip` and the first `render()` happens after `loadTrip(...)` resolves (search `loadTrip(`); add right after that render:

```js
      try { resumeUserPlaceResearch(); } catch (e) {}
```

- [ ] **Step 5: Manual verify (375px + 1280px) — requires the function deployed (do at the phase gate)**

After the Phase-1 deploy gate, add *Pho 79, Garden Grove*: the card shows Researching, then fills with address/rating/dishes + a pending tag, auto-places to a non-travel day, toast fires. Reload mid-research → it resumes. Both breakpoints.

- [ ] **Step 6: Commit**

```bash
git add travel-concierge.js
git commit -m "feat(travel-concierge): optimistic insert + background researchUserPlace + auto-place + resume pass"
```

---

### Task 1.8: Firestore rules test (member can write user-choice fields; stranger cannot)

**Files:**
- Modify: `tests/rules/firestore-rules.test.js` — append after the existing member-collaborate (~L220) / stranger-deny (~L225) cases, reusing the existing trip contexts (`tripper`/owner, member, stranger, anon at ~L209-212).

- [ ] **Step 1: Read the existing trip test block + contexts**

Run: `grep -n "groupTrips\|tripMember\|member-collaborate\|stranger" tests/rules/firestore-rules.test.js | head -30` and read ~L206-246 to match the exact `allowed(...)`/`denied(...)` helper names and the context variable names used there.

- [ ] **Step 2: Add the cases** — the file's real contexts are `tripper` / `tripMember` / `tripMember2` / `stranger`; helpers are `allowed(name, p)` / `denied(name, p)`; the seeded trip doc is the literal `'groupTrips/trip-1'`; calls use the **single-string** path form `doc(tripMember, 'groupTrips/trip-1')`. NOTE: the `groupTrips` update rule does **no** field-level validation (owner/member may write any field), so these cases are **documentation-only** — they assert nothing the existing `notes` allow/deny cases don't. Keep them as living docs of intent; do not claim new rule coverage.

```js
  // ── User Place Insertion: members write userChoice fields on the trip doc (documentation-only) ──
  await allowed('member adds a userChoice place (addedPlaces)',
    updateDoc(doc(tripMember, 'groupTrips/trip-1'), { addedPlaces: [{ id: 'add_1', name: 'Pho 79', userChoice: true, ucAction: 'add', proposed: false, verificationStatus: 'researching' }] }));
  await allowed('member writes a placeOverride replacement',
    updateDoc(doc(tripMember, 'groupTrips/trip-1'), { placeOverrides: { 'pho 79': { action: 'replaced', replacement: { name: 'Pho 79', userChoice: true } } } }));
  await denied('stranger cannot write userChoice place',
    updateDoc(doc(stranger, 'groupTrips/trip-1'), { addedPlaces: [{ id: 'add_x', name: 'X', userChoice: true }] }));
```

- [ ] **Step 3: Run the rules suite**

Run: `npm run test:rules`
Expected: the new lines print `PASS`, and the suite's final tally shows `0 failed`. (Requires JDK 11+ and the firebase CLI — same as any rules run.)

- [ ] **Step 4: Commit**

```bash
git add tests/rules/firestore-rules.test.js
git commit -m "test(travel-concierge): rules — member writes userChoice/placeOverride fields; stranger denied"
```

---

### Task 1.9: Phase 1 gate — version bump, dry run, report

- [ ] **Step 1: Bump the version string**

Find the highest deployed version (never reuse):

```bash
git log --all -p -- travel-concierge.html | grep -oE 'travel-concierge\.js\?v=[0-9]{8}[a-z]*' | sort -u | tail -1
```

Set BOTH `travel-place-utils.js?v=` and `travel-concierge.js?v=` in `travel-concierge.html` to the next unused string (e.g. if highest is `20260621n`, use `20260622a`). Replace the `PLACEHOLDER_BUMP` from Task 1.3.

- [ ] **Step 2: Run the unit + rules tests**

Run: `npm run test:userplace && npm run test:rules`
Expected: all `0 failed`.

- [ ] **Step 3: Targeted + full dry run**

Run: `bash scripts/ai/targeted_dry_run.sh travel` then `scripts/ai/full_system_dry_run.sh`
Expected: ends with `FINAL: PASS`. If `FINAL: FAIL`, inspect `.ai_runs/latest/` — fix before proceeding (a trailing FAIL on stale artifacts is a known false alarm; confirm the real failure).

- [ ] **Step 4: Commit + write the CLAUDE.md report blocks**

```bash
git add travel-concierge.html
git commit -m "chore(travel-concierge): bump cache-bust version for user-place Phase 1"
```

Produce the **Required Review Format** + **Required Report Format** blocks (Verdict / Scope / Safety / Tests with the dry-run excerpt / Remaining risks / Next command). **Phase 1 complete — do NOT deploy yet** (deploy is held until all 4 phases pass + user confirms; the live research verify in Task 1.7 Step 5 requires a one-time functions deploy to the staging project, gated on user OK).

---

# PHASE 2 — Replace path + survival

Scope: "Replace with my choice" + "Add to this day" per-card actions; route a researched user place into `placeOverrides[].replacement`; ensure BOTH the replacement and the skipped original survive regenerate, incl. name-drift; duplicate detection already in place (Task 1.3). Entry stays owner/organizer.

---

### Task 2.1: Add `uca_replace` to the form + per-card actions

**Files:**
- Modify: `travel-concierge.js` — `addMyChoiceForm` action list; `cardMenuPanel` (~L5120) to add "Replace with my choice", "Add to this day", "Add alternative".
- i18n: per-card labels.

- [ ] **Step 1: i18n keys** (en/vi/es)

```js
      ucReplaceMine: '↻ Replace with my choice', ucAddToDay: '＋ Add to this day', ucAddAlt: '＋ Add alternative',
```

- [ ] **Step 2: Extend the form action list**

In `addMyChoiceForm` Step 2, change `var actions = ['add', 'backup'];` to `var actions = ['add', 'backup', 'replace'];`. When `replace` is chosen, reveal a card-picker for the current day (a `selectFrom` of `buildDayView(state.trip.plan)[dayIdx].lanes`-flattened place names) stored as `draft.replaceTargetKey` (the original's `placeKey`). Add after the action selector:

```js
      if (actSel.value === 'replace') {
        var targets = []; (buildDayView(state.trip.plan)[dayIdx] || { lanes: [] }).lanes.forEach(function (ln) { ln.items.forEach(function (it) { if (!it.added) targets.push(it.p); }); });
        if (targets.length) {
          var tgtSel = selectFrom(targets.map(function (p) { return placeKey(p); }), draft.replaceTargetKey || placeKey(targets[0]), function (k) { var hit = targets.filter(function (p) { return placeKey(p) === k; })[0]; return hit ? hit.name : k; });
          f.appendChild(field(t('uca_replace'), tgtSel));
          draft.replaceTargetKey = tgtSel.value;
          tgtSel.addEventListener('change', function () { draft.replaceTargetKey = tgtSel.value; });
        }
      }
```

(Re-render is needed when the action changes to reveal the picker — add an `actSel.addEventListener('change', function(){ draft.action = actSel.value; render(); })`.)

- [ ] **Step 3: Add per-card menu actions** in `cardMenuPanel` — every existing item is appended via the panel container (`<panel>.appendChild(pbtn(...))`, ~L5134). Confirm the local container variable name and match it. Add (for non-added controllable cards, inside the branch where `ctx.p` exists):

```js
    panel.appendChild(pbtn(t('ucReplaceMine'), '', function () { state._cardMenu = null; state._ucForm = { day: ctx.day, step: 1, draft: { placeType: 'restaurant', action: 'replace', replaceTargetKey: placeKey(ctx.p) } }; render(); }));
    panel.appendChild(pbtn(t('ucAddToDay'), '', function () { state._cardMenu = null; state._ucForm = { day: ctx.day, step: 1, draft: { placeType: 'restaurant', action: 'add' } }; render(); }));
```

(Replace `panel` with the file's actual container variable.)

- [ ] **Step 4: Commit**

```bash
git add travel-concierge.js
git commit -m "feat(travel-concierge): replace-with-my-choice + per-card add actions (i18n vi/en/es)"
```

---

### Task 2.2: Route a researched user place into `placeOverrides[].replacement`

**Files:**
- Modify: `travel-concierge.js` — `submitUserPlace` + `runUserPlaceResearch` to handle `ucAction === 'replace'`; reuse `setPlaceOverride`/`getOverrides`.

- [ ] **Step 1: Branch `submitUserPlace` for replace**

At the top of `submitUserPlace`, before the addedPlaces path, add:

```js
    if (draft.action === 'replace' && draft.replaceTargetKey) {
      var ov = getOverrides();
      // Skip the original immediately; the replacement fills in after research.
      ov[draft.replaceTargetKey] = { name: (ov[draft.replaceTargetKey] && ov[draft.replaceTargetKey].name) || draft.replaceTargetKey, action: 'replaced',
        replacement: { id: uid('rep'), name: draft.name, category: draft.placeType, userChoice: true, ucAction: 'replaced', verificationStatus: 'researching', dataSource: 'user_entered' },
        createdBy: curUid() || '', createdAt: new Date().toISOString() };
      saveTrip(state.trip); render();
      toast(t('ucToastResearching').replace('{name}', draft.name));
      runUserPlaceResearch(ov[draft.replaceTargetKey].replacement, false, draft);
      return;
    }
```

- [ ] **Step 2: Make `runUserPlaceResearch` merge into a replacement object too**

`runUserPlaceResearch(entry, allowReslot)` already mutates `entry` in place. Because the replacement object is passed as `entry`, the enriched fields + `verificationStatus:'pending_verification'` + `dataSource` flip land on it directly, and `saveTrip` persists the whole `placeOverrides`. No slot change for replacements (the original's placement is reused by the render path). Confirm by reading the `replaced` render branch (`placeNode`, the `ov.action === 'replaced'` block) — it renders `ov.replacement` via `placeCard`, so the Researching → pending states from Task 1.5 apply automatically.

- [ ] **Step 3: Manual verify (after gate deploy)**

Replace an AI restaurant with "Pho 79": original shows as "↻ replaced original" with Undo; the replacement card shows Researching → pending. Both breakpoints.

- [ ] **Step 4: Commit**

```bash
git add travel-concierge.js
git commit -m "feat(travel-concierge): route user-choice replace into placeOverrides.replacement (researched)"
```

---

### Task 2.3: Regenerate-survival of replacement + original (name-drift)

**Files:**
- Modify: `travel-concierge.js` — `regenerateSingleDay` (~L4703) / `resetDayToAI` (~L4691): confirm `replaced` overrides (with `replacement`) are preserved (existing code keeps them); add diacritic-folded matching so a renamed near-duplicate of the skipped original does not reappear. Reuse `TCPlaceUtils.normalizeNameKey`.

- [ ] **Step 1: Add a fold-aware skip check**

Find the regenerate path where new AI places are merged and `getOverride(p)` is consulted (it keys by exact lowercased name via `placeKey`). Add a fallback: when no exact override matches, check folded equality against any `action:'skipped'|'replaced'` override key. Add a helper near `getOverride`:

```js
  function getOverrideFolded(p) {
    var exact = getOverride(p); if (exact) return exact;
    var key = TCPlaceUtils.normalizeNameKey(p && p.name); if (!key) return null;
    var ov = getOverrides(), hit = null;
    Object.keys(ov).forEach(function (k) { if (!hit && (ov[k].action === 'skipped' || ov[k].action === 'replaced') && TCPlaceUtils.normalizeNameKey(ov[k].name || k) === key) hit = ov[k]; });
    return hit;
  }
```

In `buildDayView`, change the AI-place override lookup `var ov = it.added ? null : getOverride(it.p);` to `var ov = it.added ? null : getOverrideFolded(it.p);` so a regenerated near-duplicate name still resolves to its `skipped`/`replaced` override.

- [ ] **Step 2: Add a focused node test for the fold match** (extends `tests/travel-place-utils.test.js`)

Add cases asserting `normalizeNameKey('Phở 79') === normalizeNameKey('Pho 79')` (already present) and a small synthetic `findDuplicatePlace`/fold scenario. Run `node tests/travel-place-utils.test.js` → `0 failed`.

- [ ] **Step 3: Manual verify (after gate deploy)**

Replace a place, then **Regenerate day**: the replacement persists; the skipped original does not reappear even if the AI renames it with diacritics. Both breakpoints.

- [ ] **Step 4: Commit, then Phase 2 gate**

```bash
git add travel-concierge.js tests/travel-place-utils.test.js
git commit -m "feat(travel-concierge): regenerate-survival for replacement + diacritic-folded skip match"
```

Then: bump version in `travel-concierge.html` (next unused), `npm run test:userplace && npm run test:rules`, `bash scripts/ai/targeted_dry_run.sh travel`, `scripts/ai/full_system_dry_run.sh` → `FINAL: PASS`; produce the Review + Report blocks. **Hold deploy.**

---

# PHASE 3 — Group voting (Proposed lane + member access)

Scope: "Ask group to vote" → a Proposed (voting) lane on the target day; new `canSuggestPlace()` member gate; name-keyed voting via a `voteRow` `voteKey` override; consensus auto-promote; trust-model note. AI optimize respects votes.

---

### Task 3.1: `canSuggestPlace()` gate + open "Add my place" to members

**Files:**
- Modify: `travel-concierge.js` — add `canSuggestPlace`; the day-render gate (~L4296-4329) currently wraps `dayActionsBar` in `if (canEditPlan())`. Render the **Add my place** expander under `canSuggestPlace()` while keeping Regenerate/Re-optimize/Replace under `canEditPlan()`.

- [ ] **Step 1: Add the gate**

```js
  function canSuggestPlace() { return !!(state.trip && !state.trip._demo && !state.readonly && (isOwnerOfTrip() || canApprove() || getMe())); }
```

(`getMe()` returns the member's familyId once they've picked their family — i.e. a joined participant.)

- [ ] **Step 2: Split the day-actions gate**

There are **TWO** `if (canEditPlan()) wrap.appendChild(dayActionsBar(di2));` call sites — one inside the empty-lanes early return (~L4304) and one after the lanes loop (~L4325). Change **both** to `canSuggestPlace()` (the day-index var is `di2` at both sites):

```js
    if (canSuggestPlace()) wrap.appendChild(dayActionsBar(di2));
```

In `dayActionsBar`, wrap the Regenerate + Re-optimize buttons in `if (canEditPlan()) { … }`; the **Add my place** expander stays unconditional (already gated by the caller).

- [ ] **Step 3: Manual verify** a non-owner member (pick a family, not owner) sees **Add my place** but not Regenerate. Commit.

```bash
git add travel-concierge.js
git commit -m "feat(travel-concierge): canSuggestPlace gate — members can add/propose, owner-only regenerate"
```

---

### Task 3.2: `vote_only` → Proposed lane in `buildDayView`

**Files:**
- Modify: `travel-concierge.js` — `addMyChoiceForm` (add `'vote'` action); `submitUserPlace` (set `proposed:true`, `ucAction:'vote_only'`); `buildDayView` (route proposed entries to a synthetic lane); the day renderer (render the Proposed lane after the time lanes).
- i18n: proposed-lane heading.

- [ ] **Step 1: i18n** (en/vi/es): `ucProposedLane: 'Proposed — vote to add', ucPromote: '✓ Add to itinerary', ucDemote: '↩ Back to proposed',`

- [ ] **Step 2: Form** — change `var actions = ['add', 'backup', 'replace'];` to include `'vote'`. In `submitUserPlace`, when `draft.action === 'vote'`, build the entry with `ucAction:'vote_only', proposed:true, slot:'backup'` (slot is irrelevant while proposed) and still run research.

- [ ] **Step 3: `buildDayView`** — exclude proposed entries from the normal slot merge and collect them per day. In the `addedPlaces().forEach`, add `if (ap.proposed) { (proposedByDay[ap.day || 0] = proposedByDay[ap.day || 0] || []).push(ap); return; }` (declare `var proposedByDay = {};` above). Return `proposed: (proposedByDay[di] || [])` on each day view object alongside `lanes`.

- [ ] **Step 4: Day renderer** — after the `view.lanes.forEach(...)` block and before `dayActionsBar`, render the proposed lane:

```js
    var proposed = (buildDayView(plan)[di2] || {}).proposed || [];
    if (proposed.length) {
      var pl = el('div', 'tc-section tc-section--proposed');
      pl.appendChild(el('strong', 'tc-section__title', '🗳 ' + t('ucProposedLane')));
      proposed.forEach(function (ap) {
        var pctx = { p: addedToPlace(ap), added: true, addedRef: ap, day: di2, slot: 'proposed', pkey: ap.id, proposed: true };
        pl.appendChild(placeCard(pctx.p, pctx));
      });
      wrap.appendChild(pl);
    }
```

- [ ] **Step 5: Manual verify + commit** a "vote" submission appears under the Proposed lane with research + a vote row. Commit.

```bash
git add travel-concierge.js
git commit -m "feat(travel-concierge): vote_only Proposed lane in buildDayView + day render (i18n vi/en/es)"
```

---

### Task 3.3: Name-keyed voting + consensus auto-promote

**Files:**
- Modify: `travel-concierge.js` — `voteRow` (~L5471): add an `opts.voteKey` override; in `placeCard`, pass `voteKey: TCPlaceUtils.normalizeNameKey(p.name)` for `userChoice` entries; add `maybePromoteProposed()` called after a vote.

- [ ] **Step 1: `voteRow` key override**

Change `var pid = p.id || p.name;` to:

```js
    var pid = opts.voteKey || p.id || p.name;
```

- [ ] **Step 2: `placeCard` passes the name key for user-choice cards**

The single `voteRow(p, { booking: true })` call becomes:

```js
    body.appendChild(voteRow(p, (ctx.added || p.userChoice) ? { booking: false, voteKey: TCPlaceUtils.normalizeNameKey(p.name) } : { booking: true }));
```

(Proposed/added places vote by normalized name → consistent with `consensusFor`/`recomputeAutoReject`; votes carry across promotion + regenerate.)

- [ ] **Step 3: Auto-promote**

Add and call after a vote on a proposed card. In `voteRow`'s like/maybe/skip click handler, after `recomputeAutoReject(p); saveTrip(state.trip);` add `try { maybePromoteProposed(pid); } catch(e){}` then `render();`. Define:

```js
  function maybePromoteProposed(voteKey) {
    addedPlaces().forEach(function (ap) {
      if (ap && ap.proposed && TCPlaceUtils.normalizeNameKey(ap.name) === voteKey) {
        var verdict = consensusFor(voteKey).verdict;
        if (verdict === 'liked' || verdict === 'loved') {
          ap.proposed = false; // promote into the itinerary
          ap.slot = ap.mealType ? TCPlaceUtils.mealTypeToSlot(ap.mealType) : 'afternoon';
          ap.order = laneMaxOrder(ap.day || 0, ap.slot) + 1;
        }
      }
    });
  }
```

- [ ] **Step 4: Owner promote/demote buttons** on the proposed card (Task 3.2 renderer) — add under `canEditPlan()`:

```js
        if (canEditPlan()) { var pm = el('button', 'tc-pbtn tc-pbtn--accent', t('ucPromote')); pm.addEventListener('click', function () { ap.proposed = false; ap.slot = ap.mealType ? TCPlaceUtils.mealTypeToSlot(ap.mealType) : 'afternoon'; ap.order = laneMaxOrder(ap.day || 0, ap.slot) + 1; saveTrip(state.trip); render(); }); pl.appendChild(pm); }
```

- [ ] **Step 5: AI-optimize respects votes** — confirm `recomputeAutoReject` does not drop a non-proposed `userChoice 'added'` place; treat `added` userChoice as pinned in the regenerate path (search `pinnedActivities`/`isPinnedName` and include `userChoice && ucAction==='added'`). Add the guard where rejected names are computed.

- [ ] **Step 6: Manual verify + commit** — two families vote 👍 on a proposal → it auto-promotes; votes survive a day regenerate. Commit, then **Phase 3 gate** (version bump, `test:userplace`, `test:rules`, targeted + full dry run → `FINAL: PASS`, Review + Report). Hold deploy.

```bash
git add travel-concierge.js
git commit -m "feat(travel-concierge): name-keyed user-place voting + consensus auto-promote + owner promote/demote"
```

---

# PHASE 4 — Integrations (cost · Food Picks · bookings)

Scope: cost line-item in `computeTripCosts`; "Add to Food Picks only"; explicit "Add to bookings" for Hotel/Stay + ticketed.

---

### Task 4.1: Per-user-place cost line-item

**Files:**
- Modify: `travel-concierge.js` — `computeTripCosts` (~L1419-1455). Reuse `tpCostMid`.

- [ ] **Step 1: Add user-place costs**

After the existing `add('other', t('costSouvenirs'), …)` line and before the buffer line, insert:

```js
    // User-added places with a parseable estimate (labeled, never inflated).
    var ucCatMap = { restaurant: 'food', coffee: 'food', attraction: 'activities', activity: 'activities', shopping: 'other', stay: 'stay', stopover: 'transport', event: 'activities', other: 'other' };
    (tr.addedPlaces || []).forEach(function (ap) {
      if (!ap || !ap.userChoice || ap.proposed) return;
      var mid = tpCostMid(ap.estimatedCost || ap.priceRange);
      if (mid > 0) add(ucCatMap[ap.category] || 'other', (ap.name || 'Place'), mid, { required: false, highF: 1.4 });
    });
```

- [ ] **Step 2: Node-test the parse** (extend `tests/travel-place-utils.test.js` is N/A — `tpCostMid` lives in travel-concierge.js). Instead add a tiny assertion via a temporary harness OR rely on manual verify of the cost panel. **Manual verify:** add a place with `estimatedCost:'$$'` style numeric (e.g. enter a place whose research returns a numeric range) and confirm the cost panel total increases and the line item is labeled an estimate.

- [ ] **Step 3: Commit**

```bash
git add travel-concierge.js
git commit -m "feat(travel-concierge): user-place cost line-items roll into computeTripCosts (labeled estimate)"
```

---

### Task 4.2: "Add to Food Picks only"

**Files:**
- Modify: `travel-concierge.js` — `addMyChoiceForm` (`'food'` action); `submitUserPlace` (food branch); insert into `trip.food[]` city bucket; `foodCard` already renders. Reuse `researchUserPlace`.

- [ ] **Step 1: Form** — add `'food'` to the actions list.

- [ ] **Step 2: `submitUserPlace` food branch** — when `draft.action === 'food'`, create a transient research entry, run `researchUserPlace`, and on resolve push a foodCard-shaped pick into the matching city bucket:

```js
    if (draft.action === 'food') {
      var stub = { id: uid('add'), name: draft.name, category: draft.placeType, userChoice: true, ucAction: 'food', locationHint: draft.area, verificationStatus: 'researching', dataSource: 'user_entered' };
      toast(t('ucToastResearching').replace('{name}', draft.name));
      tcCallable('researchUserPlace', { tripId: state.trip.id, name: draft.name, area: draft.area, placeType: draft.placeType, lang: state.lang, tripContext: tcTripContext() }).then(function (res) {
        var r = res || {}; var pl = r.place || {}; // tcCallable returns the unwrapped data object
        var bucketCity = (draft.area || '').split(',')[0].trim() || t('ucMyPicks');
        var tr = state.trip; tr.food = tr.food || [];
        var bucket = tr.food.filter(function (f) { return (f.city || '').toLowerCase() === bucketCity.toLowerCase(); })[0];
        if (!bucket) { bucket = { city: bucketCity, note: '', picks: [] }; tr.food.push(bucket); }
        bucket.picks.push({ name: pl.name || draft.name, cuisine: draft.placeType, address: pl.address || '', dishes: pl.popularDishes || [], rating: pl.rating || '', priceRange: pl.priceRange || 'pending verification', kidSuitability: pl.kidSuitability || '', parkingNote: pl.parkingNote || '', reservationNote: pl.reservationNote || '', why: pl.why || '', userChoice: true, verificationStatus: 'pending_verification', dataSource: 'ai_researched_pending_verification' });
        saveTrip(tr); render(); toast(t('ucToastAdded').replace('{name}', draft.name).replace('{slot}', t('uca_food')).replace('Day {day}', ''));
      }).catch(function () { toast(t('ucToastFailed').replace('{name}', draft.name)); });
      return;
    }
```

Add i18n `ucMyPicks: 'My picks'` (en/vi/es).

- [ ] **Step 3: Manual verify + commit** — "Add to Food Picks" adds Pho 79 to the Garden Grove (or "My picks") bucket with a pending tag. Commit.

```bash
git add travel-concierge.js
git commit -m "feat(travel-concierge): Add-to-Food-Picks routes researched user place into trip.food bucket"
```

---

### Task 4.3: Explicit "Add to bookings" for Hotel/Stay + ticketed

**Files:**
- Modify: `travel-concierge.js` — on a user-choice Hotel/Stay (or ticketed) card, add an "Add to bookings" action calling the existing `newBooking`/`mergeBookings` (~L1382/L1193), deduped by `bookingKey`.

- [ ] **Step 1: Read the existing booking add path**

Run: `grep -n "newBooking\|mergeBookings\|bookingKey\|Add to bookings\|addBooking" travel-concierge.js | head`. Match the existing hotel/restaurant "add to bookings" button (~L5828/L5956) field shape.

- [ ] **Step 2: Add the button** in `placeCard` `acts`, for user-choice stays/ticketed:

```js
    if (ctx.added && (p.category === 'stay') && canEditPlan()) {
      var ab = el('button', 'tc-pbtn', t('addToBookings') || '＋ Bookings'); ab.type = 'button';
      ab.addEventListener('click', function () { addUserPlaceBooking(ctx.addedRef); });
      acts.appendChild(ab);
    }
```

Define `addUserPlaceBooking(ap)` to call the existing `newBooking(...)` with the user-choice fields and dedupe via the existing `bookingKey`. (Use the exact `newBooking` signature found in Step 1.)

- [ ] **Step 3: Manual verify + commit, then Phase 4 gate**

Verify a user-added hotel can be added to the bookings checklist (deduped). Commit, then bump version, `npm run test:userplace && npm run test:rules`, targeted + full dry run → `FINAL: PASS`, Review + Report.

```bash
git add travel-concierge.js
git commit -m "feat(travel-concierge): explicit Add-to-bookings for user-choice stays (deduped via bookingKey)"
```

---

## Final Acceptance (after all 4 phases, before deploy)

Run the spec's scenario end-to-end (San Jose → OC → San Diego; add *Pho 79, Garden Grove, dinner, Jul 3*) at 375px and 1280px:
- [ ] Researches Pho 79; shows address + rating *(if grounded)* + dishes + **pending-verification** photos (real photos only with a live Maps key).
- [ ] Auto-places on a non-travel day; toast fires.
- [ ] Persists after refresh; survives regenerate (add AND replace paths); skipped original does not reappear (incl. diacritic rename).
- [ ] Another family votes; a vote_only entry's votes survive a day regenerate and still drive auto-promote.
- [ ] Cost panel reflects the added place; a user-added hotel can be added to bookings.
- [ ] No fabricated price/URL/phone anywhere; estimates labeled.

Then: deploy is a **separate, user-confirmed** step — `firebase deploy --only functions,hosting`, verify `https://www.dulichcali21.com/travel-concierge.html` serves the new `?v=`, end with `✔ Production domain updated`.

---

## Self-Review (completed by author)

- **Spec coverage:** §5 entry points → 1.6/2.1/3.1; §6 callable + sanitizer → 1.1/1.2; §7 data model + addedToPlace → 1.4/1.7; §8 voting/keying/promote → 3.3; §9 flow + resume → 1.7; §10 Food Picks + bookings → 4.2/4.3; §11 edge/dup → 1.3/2.3; §12 trust model → noted in 3.x (collaborative); §13 phasing → the 4 phases; §14 tests → 1.1/1.3/1.8 + gates; §15 i18n/version → each phase. **No gaps.**
- **Placeholders:** none — every code step shows real code; the only deliberate "match the existing name" notes are for helper/context names the worker confirms by `grep` (test contexts, `newBooking`, the callable bridge) because those identifiers cannot be assumed sight-unseen in a 7400-line file.
- **Type consistency:** `researchToPlace` output field names match `placeCard` readers (`estimatedCost`, `popularDishes`, `googleMapsUrl`…); `ucAction` values (`add|backup|vote_only|replaced|food`) consistent across tasks; vote key = `normalizeNameKey(name)` everywhere user-choice voting is touched.
