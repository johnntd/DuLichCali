# Travel Booking + Promo Video System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complete Travel Booking + Promo Video system to DuLichCali: package pages, private/group pricing, booking wizard writing to Firestore, Remotion video generation, YouTube upload, and AI-guided trip planning.

**Architecture:** New `travel.html` package detail page + `travel-booking.js` wizard module + `calculateTravelQuote()` in `pricing.js`. Remotion `TravelPromo` composition renders a 5-scene 1920×1080 MP4 that uploads to YouTube via `generate-travel-promo.js`. AI guided flow hooks into the existing `aiOrchestrator.js` `travel.plan` route and opens the booking wizard pre-filled.

**Tech Stack:** Vanilla JS (ES5-compatible IIFE pattern matching existing codebase), Firebase Firestore (anonymous auth), Remotion 4.x (TypeScript, React), YouTube Data API v3 (googleapis npm), `firebase deploy --only hosting` for deployment.

---

## CRITICAL RULES (from CLAUDE.md — read before every task)

1. **Mobile-first**: All CSS must have base (mobile) styles + `@media (min-width: 768px)` overrides.
2. **Cache busting**: Bump `?v=` on EVERY edited JS/CSS file in ALL HTML files that load it. Current high-water marks: `script.js → v=20260421d`, `pricing.js → v=20260421e`. Use `v=20260421f`, `v=20260421g`, etc. for new edits.
3. **i18n**: Every user-visible string needs entries in `en:{}`, `vi:{}`, `es:{}` inside `script.js`'s i18n object, or in `travel-booking.js`'s own i18n object using the same pattern.
4. **Deploy**: `firebase deploy --only hosting` from `DuLichCali/` root. Verify at `https://www.dulichcali21.com`.
5. **Multi-phase work**: Hold all deploys until the final task confirms all phases locally verified.

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `travel-packages.js` | CREATE | Static package seed data — fallback + admin seeder |
| `travel-booking.js` | CREATE | Booking wizard module: steps, quote calc, Firestore write |
| `travel.html` | CREATE | Package detail page — hero, itinerary, booking wizard, YouTube embed |
| `scripts/seed-travel-packages.js` | CREATE | Node.js one-shot Firestore seeder (run once) |
| `remotion-promo/src/TravelPromo/TravelPromo.tsx` | CREATE | 5-scene Remotion composition (1920×1080) |
| `remotion-promo/src/TravelPromo/schema.ts` | CREATE | Zod schema for TravelPromo props |
| `remotion-promo/generate-travel-promo.js` | CREATE | CLI: render → Firebase Storage → YouTube → Firestore update |
| `firestore.rules` | MODIFY | Add `travel_packages` + `travel_bookings` rules |
| `pricing.js` | MODIFY | Add `calculateTravelQuote()` to `DLCPricing` module |
| `remotion-promo/src/Root.tsx` | MODIFY | Register TravelPromo composition |
| `aiOrchestrator.js` | MODIFY | `defTravelPlan()` returns structured booking-ready data |
| `tour.html` | MODIFY | Add package cards section linking to `travel.html?pkg=<slug>` |
| `script.js` | MODIFY | Add `selectVehicleForTravelBooking()` + i18n keys for travel pages |

---

## Task 1: Firestore Rules — travel_packages + travel_bookings

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Add travel collection rules**

In `firestore.rules`, insert before the final `match /{document=**}` deny rule:

```
// ── Travel packages — public read, no client write (seeded by admin script) ──
match /travel_packages/{pkgId} {
  allow read:  if true;
  allow write: if false; // seeded server-side only
}

// ── Travel bookings — open create (unauthenticated booking flow) ──────────────
match /travel_bookings/{bookingId} {
  allow create: if true;
  allow read:   if true;
  allow update: if request.auth != null;
}
```

- [ ] **Step 2: Deploy rules**

```bash
cd /Users/johntd/Documents/claude-projects/ai_dulich_cali/DuLichCali
firebase deploy --only firestore:rules
```

Expected output: `✔  firestore: released rules`

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat: add firestore rules for travel_packages and travel_bookings"
```

---

## Task 2: Package Seed Data — travel-packages.js

**Files:**
- Create: `travel-packages.js`

- [ ] **Step 1: Create the file**

```javascript
// travel-packages.js — Static package definitions.
// Source of truth for travel package data. Used by:
//   - scripts/seed-travel-packages.js (writes to Firestore once)
//   - travel.html (reads from Firestore; falls back to this when offline)
// Do NOT modify individual package prices without updating both this file
// AND the Firestore seed document.

var DLC_TRAVEL_PACKAGES = [
  {
    id:                   'big_sur_monterey_1_day',
    name:                 'Big Sur & Monterey — 1 Day',
    name_vi:              'Big Sur & Monterey — 1 Ngày',
    name_es:              'Big Sur & Monterey — 1 Día',
    slug:                 'big_sur_monterey_1_day',
    duration_days:        1,
    region:               'bayarea',
    hub_city:             'San Jose',
    distance_miles:       180,   // round-trip from San Jose
    highlights: [
      { en: 'McWay Falls viewpoint at sunset', vi: 'Thác McWay lúc hoàng hôn', es: 'Mirador de McWay Falls al atardecer' },
      { en: 'Bixby Creek Bridge photo stop',   vi: 'Chụp ảnh cầu Bixby Creek',  es: 'Parada fotográfica en el puente Bixby' },
      { en: 'Monterey Bay Aquarium visit',     vi: 'Thủy cung Vịnh Monterey',   es: 'Visita al Acuario de la Bahía de Monterey' },
    ],
    itinerary: [
      { time: '7:00 AM',  en: 'Depart San Jose — south on Hwy 101',         vi: 'Khởi hành San Jose — Hwy 101',              es: 'Salida de San Jose — Hwy 101' },
      { time: '9:30 AM',  en: 'Bixby Bridge & Big Sur coastline stops',     vi: 'Cầu Bixby & bờ biển Big Sur',               es: 'Puente Bixby y costa de Big Sur' },
      { time: '11:00 AM', en: 'McWay Falls & Pfeiffer Beach',               vi: 'Thác McWay & Bãi Pfeiffer',                  es: 'Caídas McWay y Playa Pfeiffer' },
      { time: '1:00 PM',  en: 'Lunch in Carmel-by-the-Sea',                 vi: 'Ăn trưa ở Carmel-by-the-Sea',               es: 'Almuerzo en Carmel-by-the-Sea' },
      { time: '2:30 PM',  en: 'Monterey Bay Aquarium (self-guided, 2 hrs)', vi: 'Thủy cung Vịnh Monterey (tự tham quan)',    es: 'Acuario de Monterey (2 horas libre)' },
      { time: '5:00 PM',  en: 'Return drive to San Jose',                   vi: 'Trở về San Jose',                           es: 'Regreso a San Jose' },
      { time: '7:30 PM',  en: 'Arrive home',                                vi: 'Về đến nhà',                                 es: 'Llegada a casa' },
    ],
    base_price_private:           299,   // flat rate, vehicle included
    base_price_per_person_group:   89,   // per person
    min_group:   4,
    max_group:  12,
    images: [
      '/monterey.jpg',
    ],
    active: true,
  },
  {
    id:                   'highway_1_classic_2_day',
    name:                 'Highway 1 Classic — 2 Days',
    name_vi:              'Quốc Lộ 1 Cổ Điển — 2 Ngày',
    name_es:              'Clásico Hwy 1 — 2 Días',
    slug:                 'highway_1_classic_2_day',
    duration_days:        2,
    region:               'bayarea',
    hub_city:             'San Jose',
    distance_miles:       420,
    highlights: [
      { en: 'Full Highway 1 coastal drive',     vi: 'Toàn tuyến Hwy 1 ven biển',     es: 'Ruta costera completa Hwy 1' },
      { en: 'Hearst Castle tour',               vi: 'Tham quan lâu đài Hearst',       es: 'Tour por el Castillo Hearst' },
      { en: 'Elephant Seal Vista Point',        vi: 'Khu bảo tồn Hải Cẩu Elephant',  es: 'Mirador de las Focas Elefante' },
    ],
    itinerary: [
      { time: 'Day 1 · 7:00 AM',  en: 'Depart San Jose → Davenport cliffs',    vi: 'Khởi hành → vách đá Davenport',          es: 'Salida → acantilados Davenport' },
      { time: 'Day 1 · 10:00 AM', en: 'Santa Cruz Boardwalk',                  vi: 'Khu vui chơi Santa Cruz',                es: 'Boardwalk de Santa Cruz' },
      { time: 'Day 1 · 1:00 PM',  en: 'Big Sur scenic drive & lunch',          vi: 'Big Sur & ăn trưa',                       es: 'Big Sur y almuerzo' },
      { time: 'Day 1 · 4:00 PM',  en: 'Check-in hotel in San Simeon',          vi: 'Nhận phòng San Simeon',                  es: 'Check-in en San Simeon' },
      { time: 'Day 2 · 9:00 AM',  en: 'Hearst Castle guided tour',             vi: 'Tour Lâu Đài Hearst',                    es: 'Tour guiado Castillo Hearst' },
      { time: 'Day 2 · 12:00 PM', en: 'Elephant Seal Vista Point & lunch',     vi: 'Khu bảo tồn hải cẩu & ăn trưa',         es: 'Vista Point de focas y almuerzo' },
      { time: 'Day 2 · 2:00 PM',  en: 'Return via Hwy 101 to San Jose',        vi: 'Về San Jose qua Hwy 101',                es: 'Regreso vía Hwy 101 a San Jose' },
      { time: 'Day 2 · 6:00 PM',  en: 'Arrive home',                           vi: 'Về đến nhà',                              es: 'Llegada a casa' },
    ],
    base_price_private:           599,
    base_price_per_person_group:  169,
    min_group:   4,
    max_group:  12,
    images: [
      '/santabarbara.jpg',
    ],
    active: true,
  },
  {
    id:                   'coastal_premium_3_day',
    name:                 'Coastal Premium — 3 Days',
    name_vi:              'Gói Bờ Biển Cao Cấp — 3 Ngày',
    name_es:              'Premium Costero — 3 Días',
    slug:                 'coastal_premium_3_day',
    duration_days:        3,
    region:               'bayarea',
    hub_city:             'San Jose',
    distance_miles:       680,
    highlights: [
      { en: 'Private vehicle — no shared stops',      vi: 'Xe riêng — không dừng chung',      es: 'Vehículo privado — sin paradas compartidas' },
      { en: 'Santa Barbara wine country excursion',   vi: 'Thăm vùng rượu vang Santa Barbara', es: 'Excursión a viñedos Santa Barbara' },
      { en: 'Malibu PCH + Getty Villa',               vi: 'Malibu PCH + Getty Villa',          es: 'Malibu PCH + Getty Villa' },
    ],
    itinerary: [
      { time: 'Day 1 · 7:00 AM',  en: 'San Jose → Carmel wine tasting',          vi: 'San Jose → thử rượu Carmel',           es: 'San Jose → cata de vinos en Carmel' },
      { time: 'Day 1 · 3:00 PM',  en: 'Big Sur overnight at boutique inn',       vi: 'Nghỉ đêm Big Sur tại inn boutique',    es: 'Noche en Big Sur en hotel boutique' },
      { time: 'Day 2 · 9:00 AM',  en: 'Hearst Castle → Santa Barbara',           vi: 'Hearst Castle → Santa Barbara',        es: 'Castillo Hearst → Santa Barbara' },
      { time: 'Day 2 · 4:00 PM',  en: 'Santa Barbara wine country',              vi: 'Vùng rượu Santa Barbara',              es: 'Viñedos de Santa Barbara' },
      { time: 'Day 2 · 7:00 PM',  en: 'Hotel check-in Santa Barbara',            vi: 'Nhận phòng Santa Barbara',             es: 'Check-in en Santa Barbara' },
      { time: 'Day 3 · 9:00 AM',  en: 'Malibu PCH → Getty Villa',                vi: 'Malibu PCH → Getty Villa',             es: 'Malibu PCH → Getty Villa' },
      { time: 'Day 3 · 3:00 PM',  en: 'Return to San Jose via Hwy 101',          vi: 'Trở về San Jose Hwy 101',              es: 'Regreso a San Jose vía Hwy 101' },
      { time: 'Day 3 · 8:00 PM',  en: 'Arrive home',                             vi: 'Về đến nhà',                            es: 'Llegada a casa' },
    ],
    base_price_private:          1199,
    base_price_per_person_group:  349,
    min_group:   4,
    max_group:   8,   // smaller van for premium experience
    images: [
      '/santabarbara.jpg',
    ],
    active: true,
  },
];

if (typeof module !== 'undefined') module.exports = { DLC_TRAVEL_PACKAGES };
```

- [ ] **Step 2: Commit**

```bash
git add travel-packages.js
git commit -m "feat: add travel package seed data (3 coastal packages)"
```

---

## Task 3: Seed travel_packages to Firestore

**Files:**
- Create: `scripts/seed-travel-packages.js`

- [ ] **Step 1: Create seeder script**

```javascript
#!/usr/bin/env node
/**
 * scripts/seed-travel-packages.js
 * Run ONCE: node scripts/seed-travel-packages.js
 * Writes DLC_TRAVEL_PACKAGES to Firestore travel_packages collection.
 * Idempotent — safe to re-run (uses doc.set with merge:false so it overwrites).
 *
 * Prerequisites:
 *   firebase login (or set GOOGLE_APPLICATION_CREDENTIALS)
 *   npm install firebase-admin  (in DuLichCali/ root)
 */
'use strict';

const admin = require('firebase-admin');
const { DLC_TRAVEL_PACKAGES } = require('../travel-packages.js');

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId:  'dulichcali-booking-calendar',
});
const db = admin.firestore();

async function seed() {
  console.log(`Seeding ${DLC_TRAVEL_PACKAGES.length} travel packages...`);
  for (const pkg of DLC_TRAVEL_PACKAGES) {
    await db.collection('travel_packages').doc(pkg.id).set({
      ...pkg,
      seededAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`  ✓ ${pkg.id}`);
  }
  console.log('Done. Firestore travel_packages updated.');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Run seeder**

```bash
cd /Users/johntd/Documents/claude-projects/ai_dulich_cali/DuLichCali
firebase login   # if not already authenticated
node scripts/seed-travel-packages.js
```

Expected output:
```
Seeding 3 travel packages...
  ✓ big_sur_monterey_1_day
  ✓ highway_1_classic_2_day
  ✓ coastal_premium_3_day
Done. Firestore travel_packages updated.
```

- [ ] **Step 3: Verify in Firestore console**

Open `https://console.firebase.google.com/project/dulichcali-booking-calendar/firestore` → `travel_packages` collection should show 3 docs.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-travel-packages.js
git commit -m "feat: add Firestore seeder for travel_packages"
```

---

## Task 4: calculateTravelQuote() — Add to DLCPricing module

**Files:**
- Modify: `pricing.js:100–end`

The `DLCPricing` IIFE already exposes `quoteRide`, `tourCost`, etc. Add `calculateTravelQuote` inside the IIFE before the `return {}` statement.

- [ ] **Step 1: Find the return statement in DLCPricing**

```bash
grep -n "return {" /Users/johntd/Documents/claude-projects/ai_dulich_cali/DuLichCali/pricing.js | tail -5
```

Note the line number of the final `return {` inside the `DLCPricing` IIFE. It will be the last one.

- [ ] **Step 2: Read pricing.js bottom section**

Read from line `[return-line - 30]` to end to understand what is already exported.

- [ ] **Step 3: Insert calculateTravelQuote before the return**

Add this function before the final `return {}` statement in the IIFE:

```javascript
  /**
   * Calculate a price quote for a travel package booking.
   *
   * @param {object} pkg          A DLC_TRAVEL_PACKAGES entry (from travel-packages.js or Firestore)
   * @param {'private'|'group'} type  Booking type
   * @param {number} travelers    Number of travelers (used only for group type)
   * @param {string} pickupRegion 'bayarea' | 'socal' — affects deadhead surcharge
   * @returns {{ subtotal, taxes, total, pricePerPerson, vehicle, breakdown }}
   */
  function calculateTravelQuote(pkg, type, travelers, pickupRegion) {
    var pax       = Math.max(1, parseInt(travelers) || 1);
    var isSocal   = pickupRegion === 'socal';
    var surcharge = isSocal ? 1.15 : 1.00;   // SoCal +15% (longer deadhead)
    var TAX_RATE  = 0.0875;                   // California 8.75%

    var subtotal, pricePerPerson, vehicleName;

    if (type === 'private') {
      subtotal      = Math.round(pkg.base_price_private * surcharge);
      pricePerPerson = null;
      vehicleName   = getVehicle(pax, pickupRegion);
    } else {
      // group: per-person price × headcount
      pricePerPerson = Math.round(pkg.base_price_per_person_group * surcharge);
      subtotal       = pricePerPerson * pax;
      vehicleName    = getVehicle(pax, pickupRegion);
    }

    var taxes = Math.round(subtotal * TAX_RATE);
    var total = subtotal + taxes;

    return {
      type:           type,
      travelers:      pax,
      subtotal:       subtotal,
      taxes:          taxes,
      total:          total,
      pricePerPerson: pricePerPerson,
      vehicle:        vehicleName,
      breakdown: {
        base:      type === 'private' ? pkg.base_price_private : pkg.base_price_per_person_group,
        surcharge: isSocal ? '15% SoCal surcharge' : null,
        taxRate:   '8.75%',
      },
    };
  }
```

- [ ] **Step 4: Export calculateTravelQuote**

In the `return {}` at the bottom of `DLCPricing`, add the new function:

```javascript
// Inside the existing return { ... } — add this line:
calculateTravelQuote: calculateTravelQuote,
```

- [ ] **Step 5: Bump pricing.js version in all HTML files**

Current version: `v=20260421e`. Next safe: `v=20260421f`.

```bash
grep -rn "pricing.js" /Users/johntd/Documents/claude-projects/ai_dulich_cali/DuLichCali --include="*.html"
```

For each HTML file found, change `pricing.js?v=20260421e` → `pricing.js?v=20260421f`.

Known HTML files loading pricing.js:
- `airport.html` line 716
- `index.html` line 1211

- [ ] **Step 6: Commit**

```bash
git add pricing.js airport.html index.html
git commit -m "feat: add calculateTravelQuote() to DLCPricing module"
```

---

## Task 5: Vehicle + Driver Selection for Travel Bookings

**Files:**
- Modify: `script.js` (add helper functions near existing `getRegionVehicle`)
- Modify: `travel-booking.js` (will use these helpers — created in Task 7)

Add `selectVehicleForTravelBooking()` and `selectDriverForTravelBooking()` to `script.js` alongside the existing `getRegionVehicle()` function (around line 20).

- [ ] **Step 1: Read script.js around line 20**

Read lines 15–50 of `script.js` to see the exact location of `getRegionVehicle`.

- [ ] **Step 2: Add vehicle + driver selection functions after getRegionVehicle**

```javascript
/**
 * Select the best vehicle type for a travel booking.
 * @param {number} travelers    Number of travelers
 * @param {string} region       'bayarea' | 'socal'
 * @returns {string} vehicle name
 */
function selectVehicleForTravelBooking(travelers, region) {
  var pax = Math.max(1, parseInt(travelers) || 1);
  if (region === 'bayarea') {
    return pax >= 8 ? 'Mercedes Van' : 'Toyota Sienna';
  }
  // SoCal
  if (pax <= 3) return 'Tesla Model Y';
  if (pax <= 7) return 'Toyota Sienna';
  return 'Mercedes Van';
}

/**
 * Find an available driver for a travel booking date.
 * Queries travel_drivers collection — returns first driver whose
 * vehicle matches and who has no conflicting travel_booking on that date.
 * Returns null (no driver found) — caller should surface "call to confirm" message.
 *
 * @param {string} vehicleType  'Tesla Model Y' | 'Toyota Sienna' | 'Mercedes Van'
 * @param {string} dateStr      ISO date string 'YYYY-MM-DD'
 * @returns {Promise<object|null>}
 */
async function selectDriverForTravelBooking(vehicleType, dateStr) {
  try {
    var snap = await db.collection('travel_drivers')
      .where('active', '==', true)
      .get();
    if (snap.empty) return null;

    // Filter: vehicle type match
    var candidates = snap.docs
      .map(function(d) { return Object.assign({ id: d.id }, d.data()); })
      .filter(function(d) {
        return d.vehicle && d.vehicle.name &&
               d.vehicle.name.toLowerCase().indexOf(vehicleType.toLowerCase().split(' ')[0]) !== -1;
      });

    if (!candidates.length) return candidates[0] || null; // take any if no vehicle match

    // Filter: no conflicting booking on this date
    var datePrefix = dateStr.slice(0, 10);
    var busyIds = new Set();
    var conflicts = await db.collection('travel_bookings')
      .where('date', '>=', datePrefix)
      .where('date', '<', datePrefix + 'z')
      .where('status', 'in', ['pending', 'confirmed'])
      .get();
    conflicts.forEach(function(d) {
      if (d.data().driverId) busyIds.add(d.data().driverId);
    });

    var available = candidates.filter(function(d) { return !busyIds.has(d.id); });
    return available[0] || null;
  } catch (e) {
    console.warn('[selectDriverForTravelBooking]', e.message);
    return null;
  }
}
```

- [ ] **Step 3: Bump script.js version in index.html**

Current: `v=20260421d` → use `v=20260421e`.

```bash
# In index.html, change:
# script.js?v=20260421d  →  script.js?v=20260421e
```

- [ ] **Step 4: Commit**

```bash
git add script.js index.html
git commit -m "feat: add selectVehicleForTravelBooking + selectDriverForTravelBooking"
```

---

## Task 6: travel.html — Package Detail Page

**Files:**
- Create: `travel.html`

This page: reads `?pkg=<slug>` from the URL → loads that package from `DLC_TRAVEL_PACKAGES` → shows hero image, itinerary accordion, pricing, booking CTA, and YouTube video.

- [ ] **Step 1: Create travel.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#0a2344">
  <title id="pageTitle">California Tour · Du Lich Cali</title>
  <meta name="description" id="pageDesc" content="Book a California coastal tour with Du Lich Cali. Vietnamese-English bilingual guides.">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;1,6..96,300&family=Jost:wght@300;400;500;600&display=swap" rel="stylesheet">

  <link rel="stylesheet" href="/style.css?v=20260421f">
  <link rel="stylesheet" href="/desktop.css">

  <style>
    html, body { height: auto; min-height: 100vh; }
    body { overflow-y: auto; overflow-x: hidden; background: var(--navy-900); }

    /* ── Hero ── */
    .tp-hero {
      position: relative;
      height: 55vw;
      min-height: 260px;
      max-height: 480px;
      overflow: hidden;
      background: var(--navy-800);
    }
    .tp-hero__img {
      width: 100%; height: 100%;
      object-fit: cover;
      display: block;
    }
    .tp-hero__overlay {
      position: absolute; inset: 0;
      background: linear-gradient(to bottom, rgba(10,35,68,0.2) 0%, rgba(10,35,68,0.75) 100%);
      display: flex; flex-direction: column; justify-content: flex-end;
      padding: 1.25rem 1rem;
    }
    .tp-hero__badge {
      display: inline-flex; align-items: center; gap: .35rem;
      background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.2);
      border-radius: 20px; padding: .2rem .65rem;
      font-size: .68rem; color: var(--cream); letter-spacing: .05em;
      width: fit-content; margin-bottom: .5rem;
    }
    .tp-hero__name {
      font-family: var(--font-d);
      font-size: clamp(1.4rem, 5vw, 2.4rem);
      font-weight: 400; color: var(--cream);
      line-height: 1.15; margin: 0 0 .35rem;
    }
    .tp-hero__sub {
      font-size: .78rem; color: rgba(255,255,255,.75);
    }

    /* ── Content ── */
    .tp-content { padding: 1.25rem 1rem 6rem; max-width: 680px; margin: 0 auto; }

    /* ── Price bar ── */
    .tp-price-bar {
      display: flex; align-items: center; justify-content: space-between;
      background: var(--navy-800); border: 1px solid var(--border);
      border-radius: var(--r-lg); padding: .85rem 1rem;
      margin-bottom: 1.25rem;
    }
    .tp-price-bar__label { font-size: .72rem; color: var(--muted); }
    .tp-price-bar__amount {
      font-size: 1.3rem; font-weight: 600; color: var(--gold); line-height: 1;
    }
    .tp-price-bar__from { font-size: .68rem; color: var(--muted); }

    /* ── Section header ── */
    .tp-section-head {
      font-family: var(--font-d);
      font-size: 1.1rem; font-weight: 400;
      color: var(--cream); margin: 1.5rem 0 .75rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: .5rem;
    }

    /* ── Highlights ── */
    .tp-highlights { list-style: none; padding: 0; margin: 0 0 1rem; }
    .tp-highlights li {
      display: flex; align-items: flex-start; gap: .5rem;
      font-size: .82rem; color: var(--cream); padding: .45rem 0;
      border-bottom: 1px solid rgba(255,255,255,.06);
    }
    .tp-highlights li:last-child { border: none; }
    .tp-highlights li::before {
      content: '✓'; color: var(--gold); font-weight: 700; flex-shrink: 0; margin-top: .05rem;
    }

    /* ── Itinerary ── */
    .tp-itin { margin-bottom: 1rem; }
    .tp-itin-item {
      display: flex; gap: .75rem;
      padding: .55rem 0; border-bottom: 1px solid rgba(255,255,255,.06);
    }
    .tp-itin-item:last-child { border: none; }
    .tp-itin-time {
      font-size: .68rem; color: var(--gold); font-weight: 600;
      min-width: 72px; flex-shrink: 0; padding-top: .12rem;
    }
    .tp-itin-desc { font-size: .8rem; color: var(--cream); line-height: 1.45; }

    /* ── Video embed ── */
    .tp-video-wrap {
      position: relative; width: 100%;
      padding-bottom: 56.25%; /* 16:9 */
      background: #000; border-radius: var(--r-lg); overflow: hidden;
      margin-bottom: 1.25rem;
    }
    .tp-video-wrap iframe {
      position: absolute; inset: 0; width: 100%; height: 100%; border: 0;
    }
    .tp-video-poster {
      position: absolute; inset: 0; width: 100%; height: 100%;
      object-fit: cover; cursor: pointer;
    }
    .tp-video-play {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,.35); cursor: pointer; border: none;
      width: 100%; font-size: 3rem; color: #fff;
    }

    /* ── Booking panel ── */
    .tp-book-panel {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 80;
      background: var(--navy-800); border-top: 1px solid var(--border);
      padding: .9rem 1rem; display: flex; align-items: center; justify-content: space-between;
      gap: .75rem;
    }
    .tp-book-panel__price { font-size: .82rem; color: var(--muted); }
    .tp-book-panel__amount { font-size: 1.1rem; font-weight: 700; color: var(--cream); }
    .tp-book-btn {
      background: var(--gold); color: #0a1a2e; font-weight: 700;
      border: none; border-radius: var(--r-md); padding: .75rem 1.5rem;
      font-size: .9rem; cursor: pointer; white-space: nowrap;
      -webkit-tap-highlight-color: transparent; flex-shrink: 0;
    }
    .tp-book-btn:active { opacity: .85; }

    /* ── Booking wizard modal ── */
    .tp-wizard {
      position: fixed; inset: 0; z-index: 200;
      background: rgba(0,0,0,.6); display: flex; align-items: flex-end;
      opacity: 0; pointer-events: none; transition: opacity .22s;
    }
    .tp-wizard--open { opacity: 1; pointer-events: auto; }
    .tp-wizard__sheet {
      background: var(--navy-800); width: 100%; max-height: 92vh;
      border-radius: var(--r-xl) var(--r-xl) 0 0;
      overflow-y: auto; padding: 1.25rem 1rem 2.5rem;
      transform: translateY(100%); transition: transform .28s ease;
    }
    .tp-wizard--open .tp-wizard__sheet { transform: translateY(0); }
    .tp-wizard__handle {
      width: 2.5rem; height: .3rem; border-radius: 3px;
      background: var(--border); margin: 0 auto .9rem;
    }
    .tp-wizard__title {
      font-family: var(--font-d); font-size: 1.2rem; color: var(--cream);
      text-align: center; margin-bottom: 1rem;
    }
    .tp-wizard__step { display: none; }
    .tp-wizard__step--active { display: block; }

    /* Step labels */
    .tp-wizard__label {
      font-size: .75rem; color: var(--muted); margin-bottom: .3rem; display: block;
    }
    /* Option buttons */
    .tp-opt-group { display: flex; flex-direction: column; gap: .5rem; margin-bottom: 1rem; }
    .tp-opt-btn {
      background: var(--navy-900); border: 1px solid var(--border);
      border-radius: var(--r-md); padding: .85rem 1rem;
      display: flex; justify-content: space-between; align-items: center;
      cursor: pointer; color: var(--cream); font-size: .9rem;
      -webkit-tap-highlight-color: transparent; transition: border-color .18s;
    }
    .tp-opt-btn--selected { border-color: var(--gold); background: rgba(212,175,55,.08); }
    .tp-opt-btn__price { font-size: .78rem; color: var(--gold); font-weight: 600; }
    /* Number input */
    .tp-num-input {
      display: flex; align-items: center; gap: 1rem;
      background: var(--navy-900); border: 1px solid var(--border);
      border-radius: var(--r-md); padding: .5rem 1rem;
      width: fit-content; margin-bottom: 1rem;
    }
    .tp-num-btn {
      background: none; border: 1px solid var(--border); border-radius: 50%;
      width: 2rem; height: 2rem; color: var(--cream); font-size: 1.2rem;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
    }
    .tp-num-val { font-size: 1.1rem; color: var(--cream); min-width: 1.5rem; text-align: center; }
    /* Date input */
    .tp-date-input {
      width: 100%; background: var(--navy-900); border: 1px solid var(--border);
      border-radius: var(--r-md); padding: .75rem 1rem; color: var(--cream);
      font-size: .9rem; margin-bottom: 1rem;
    }
    /* Quote summary */
    .tp-quote-row {
      display: flex; justify-content: space-between;
      font-size: .82rem; padding: .3rem 0;
      color: var(--muted); border-bottom: 1px solid rgba(255,255,255,.06);
    }
    .tp-quote-row--total { color: var(--cream); font-weight: 700; font-size: .95rem; }
    .tp-quote-rows { margin-bottom: 1rem; }
    /* Next / confirm */
    .tp-next-btn {
      width: 100%; background: var(--gold); color: #0a1a2e;
      border: none; border-radius: var(--r-md); padding: .9rem;
      font-weight: 700; font-size: .95rem; cursor: pointer; margin-top: .5rem;
    }
    /* Customer fields */
    .tp-field {
      width: 100%; background: var(--navy-900); border: 1px solid var(--border);
      border-radius: var(--r-md); padding: .75rem 1rem; color: var(--cream);
      font-size: .9rem; margin-bottom: .65rem;
    }
    .tp-field::placeholder { color: var(--muted); }
    /* Success */
    .tp-success {
      text-align: center; padding: 2rem 1rem;
    }
    .tp-success__icon { font-size: 3rem; margin-bottom: .75rem; }
    .tp-success__title { font-family: var(--font-d); font-size: 1.4rem; color: var(--cream); margin-bottom: .5rem; }
    .tp-success__sub { font-size: .82rem; color: var(--muted); line-height: 1.6; }
    .tp-success__id { font-size: .72rem; color: var(--gold); margin-top: .75rem; font-family: monospace; }

    @media (min-width: 768px) {
      .tp-hero { max-height: 560px; }
      .tp-content { padding: 2rem 1.5rem 8rem; }
      .tp-wizard__sheet { max-width: 480px; margin: 0 auto; border-radius: var(--r-xl); }
      .tp-wizard { align-items: center; }
    }
  </style>
</head>
<body>

<a href="/tour.html" class="back-btn" id="backBtn" aria-label="Back to tours" style="position:fixed;top:env(safe-area-inset-top,12px);left:12px;z-index:90;background:rgba(10,35,68,.7);border:1px solid rgba(255,255,255,.15);border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;color:#fff;text-decoration:none;font-size:1.1rem;">←</a>

<!-- Hero -->
<div class="tp-hero">
  <img class="tp-hero__img" id="tpHeroImg" src="/monterey.jpg" alt="Tour">
  <div class="tp-hero__overlay">
    <div class="tp-hero__badge">
      <span id="tpDurationBadge">1 Day</span>
    </div>
    <h1 class="tp-hero__name" id="tpPkgName">California Tour</h1>
    <p class="tp-hero__sub" id="tpPkgSub">Du Lich Cali · Bilingual Guide</p>
  </div>
</div>

<!-- Content -->
<div class="tp-content">

  <!-- Price bar -->
  <div class="tp-price-bar">
    <div>
      <div class="tp-price-bar__label" data-i18n="tpFromLabel">From</div>
      <div class="tp-price-bar__amount" id="tpGroupPrice">$89</div>
      <div class="tp-price-bar__from" data-i18n="tpPerPersonLabel">per person (group)</div>
    </div>
    <div style="text-align:right">
      <div class="tp-price-bar__label" data-i18n="tpPrivateLabel">Private from</div>
      <div class="tp-price-bar__amount" id="tpPrivatePrice">$299</div>
    </div>
  </div>

  <!-- Highlights -->
  <h2 class="tp-section-head" data-i18n="tpHighlightsHead">Highlights</h2>
  <ul class="tp-highlights" id="tpHighlightsList"></ul>

  <!-- Itinerary -->
  <h2 class="tp-section-head" data-i18n="tpItineraryHead">Itinerary</h2>
  <div class="tp-itin" id="tpItinerary"></div>

  <!-- Video (inserted dynamically when youtubeId exists) -->
  <div id="tpVideoSection" style="display:none">
    <h2 class="tp-section-head" data-i18n="tpVideoHead">Tour Preview</h2>
    <div class="tp-video-wrap" id="tpVideoWrap"></div>
  </div>

</div>

<!-- Fixed booking panel -->
<div class="tp-book-panel">
  <div>
    <div class="tp-book-panel__price" data-i18n="tpGroupPrice">Group from</div>
    <div class="tp-book-panel__amount" id="tpPanelPrice">$89/person</div>
  </div>
  <button class="tp-book-btn" id="tpOpenWizardBtn" data-i18n="tpBookNow">Book Now</button>
</div>

<!-- Booking wizard modal -->
<div class="tp-wizard" id="tpWizard" role="dialog" aria-modal="true" aria-label="Book tour">
  <div class="tp-wizard__sheet" id="tpWizardSheet">
    <div class="tp-wizard__handle"></div>
    <h2 class="tp-wizard__title" id="tpWizardTitle" data-i18n="tpBookNow">Book Your Tour</h2>

    <!-- Step 1: Type -->
    <div class="tp-wizard__step tp-wizard__step--active" id="tpStep1">
      <span class="tp-wizard__label" data-i18n="tpTypeLabel">Tour type</span>
      <div class="tp-opt-group">
        <button class="tp-opt-btn tp-opt-btn--selected" id="tpTypePrivate" data-type="private">
          <span data-i18n="tpPrivateType">Private (exclusive vehicle)</span>
          <span class="tp-opt-btn__price" id="tpTypePrivatePrice">$299</span>
        </button>
        <button class="tp-opt-btn" id="tpTypeGroup" data-type="group">
          <span data-i18n="tpGroupType">Group (join a group)</span>
          <span class="tp-opt-btn__price" id="tpTypeGroupPrice">$89/person</span>
        </button>
      </div>
      <button class="tp-next-btn" id="tpStep1Next" data-i18n="tpNext">Next →</button>
    </div>

    <!-- Step 2: Travelers + Date -->
    <div class="tp-wizard__step" id="tpStep2">
      <span class="tp-wizard__label" data-i18n="tpTravelersLabel">Number of travelers</span>
      <div class="tp-num-input">
        <button class="tp-num-btn" id="tpDecBtn">−</button>
        <span class="tp-num-val" id="tpTravelersVal">2</span>
        <button class="tp-num-btn" id="tpIncBtn">+</button>
      </div>
      <span class="tp-wizard__label" data-i18n="tpDateLabel">Tour date</span>
      <input class="tp-date-input" type="date" id="tpDateInput" min="">
      <span class="tp-wizard__label" data-i18n="tpRegionLabel">Pickup region</span>
      <div class="tp-opt-group">
        <button class="tp-opt-btn tp-opt-btn--selected" id="tpRegionBay" data-region="bayarea">
          <span data-i18n="tpBayArea">Bay Area (San Jose / San Francisco)</span>
        </button>
        <button class="tp-opt-btn" id="tpRegionSoCal" data-region="socal">
          <span data-i18n="tpSoCal">SoCal (LA / San Diego) +15%</span>
        </button>
      </div>
      <button class="tp-next-btn" id="tpStep2Next" data-i18n="tpNext">Next →</button>
    </div>

    <!-- Step 3: Quote + customer info -->
    <div class="tp-wizard__step" id="tpStep3">
      <span class="tp-wizard__label" data-i18n="tpQuoteLabel">Your quote</span>
      <div class="tp-quote-rows" id="tpQuoteRows"></div>
      <span class="tp-wizard__label" data-i18n="tpNameLabel">Your name</span>
      <input class="tp-field" type="text" id="tpCustName" data-i18n-ph="tpNamePh" placeholder="Full name">
      <span class="tp-wizard__label" data-i18n="tpPhoneLabel">Phone number</span>
      <input class="tp-field" type="tel" id="tpCustPhone" data-i18n-ph="tpPhonePh" placeholder="+1 (408) 555-0100">
      <button class="tp-next-btn" id="tpConfirmBtn" data-i18n="tpConfirm">Confirm Booking</button>
    </div>

    <!-- Step 4: Success -->
    <div class="tp-wizard__step" id="tpStep4">
      <div class="tp-success">
        <div class="tp-success__icon">✅</div>
        <div class="tp-success__title" data-i18n="tpSuccessTitle">Booking Confirmed!</div>
        <div class="tp-success__sub" data-i18n="tpSuccessSub">We'll call you within 2 hours to confirm details and send a confirmation SMS.</div>
        <div class="tp-success__id" id="tpSuccessId"></div>
      </div>
    </div>

  </div>
</div>

<!-- Firebase -->
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>

<script src="/travel-packages.js?v=20260421a"></script>
<script src="/travel-booking.js?v=20260421a"></script>
<script src="/landing-nav.js?v=20260421b"></script>

<script>
// Init Firebase (same config as script.js)
var firebaseConfig = {
  apiKey:            'AIzaSyCo1FzDthSCXINRHlyJkqdcVKq_inM71SQ',
  authDomain:        'dulichcali-booking-calendar.firebaseapp.com',
  projectId:         'dulichcali-booking-calendar',
  storageBucket:     'dulichcali-booking-calendar.appspot.com',
  messagingSenderId: '623460884698',
  appId:             '1:623460884698:web:a08bd435c453a7b4db05e3'
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
firebase.auth().signInAnonymously().catch(console.error);
var db = firebase.firestore();

// Boot page
document.addEventListener('DOMContentLoaded', function() {
  var lang = (function(){
    try { return localStorage.getItem('dlcLang') || 'en'; } catch(e) { return 'en'; }
  })();
  TravelBooking.init({ db: db, lang: lang });
});
</script>

<script src="/analytics.js?v=20260420a"></script>
</body>
</html>
```

- [ ] **Step 2: Verify file was created**

```bash
ls -la /Users/johntd/Documents/claude-projects/ai_dulich_cali/DuLichCali/travel.html
```

- [ ] **Step 3: Commit**

```bash
git add travel.html
git commit -m "feat: add travel.html package detail page skeleton"
```

---

## Task 7: travel-booking.js — Booking Wizard Logic

**Files:**
- Create: `travel-booking.js`

This module reads the `?pkg=` URL param, loads the package from Firestore (with local fallback), drives the 4-step wizard, computes quotes via `DLCPricing.calculateTravelQuote()`, and writes to `travel_bookings`.

- [ ] **Step 1: Create travel-booking.js**

```javascript
// travel-booking.js — Travel booking wizard module.
// Loaded by travel.html. Depends on:
//   DLC_TRAVEL_PACKAGES  (travel-packages.js)
//   DLCPricing           (pricing.js — loaded by travel.html when needed)
//   firebase / db        (injected via TravelBooking.init)

var TravelBooking = (function() {
  'use strict';

  // ── i18n strings ─────────────────────────────────────────────
  var STRINGS = {
    en: {
      tpFromLabel:'From', tpPerPersonLabel:'per person (group)',
      tpPrivateLabel:'Private from',
      tpHighlightsHead:'Highlights', tpItineraryHead:'Itinerary', tpVideoHead:'Tour Preview',
      tpGroupPrice:'Group from', tpBookNow:'Book Now',
      tpTypeLabel:'Tour type', tpPrivateType:'Private (exclusive vehicle)', tpGroupType:'Group (join a group)',
      tpNext:'Next →',
      tpTravelersLabel:'Travelers', tpDateLabel:'Tour date',
      tpRegionLabel:'Pickup region', tpBayArea:'Bay Area (San Jose / SF)', tpSoCal:'SoCal (LA / SD) +15%',
      tpQuoteLabel:'Your quote',
      tpNameLabel:'Your name', tpNamePh:'Full name',
      tpPhoneLabel:'Phone', tpPhonePh:'+1 (408) 555-0100',
      tpConfirm:'Confirm Booking',
      tpSuccessTitle:'Booking Confirmed!',
      tpSuccessSub:"We'll call you within 2 hours to confirm details.",
      tpSubtotal:'Subtotal', tpTaxes:'Taxes (8.75%)', tpTotal:'Total',
      tpVehicle:'Vehicle', tpDuration:'Duration',
      tpDay:'day', tpDays:'days',
      tpPanelPriceGroup:'$%s/person', tpPanelPricePrivate:'$%s private',
    },
    vi: {
      tpFromLabel:'Từ', tpPerPersonLabel:'mỗi người (nhóm)',
      tpPrivateLabel:'Riêng từ',
      tpHighlightsHead:'Điểm Nổi Bật', tpItineraryHead:'Lịch Trình', tpVideoHead:'Xem Trước Tour',
      tpGroupPrice:'Nhóm từ', tpBookNow:'Đặt Ngay',
      tpTypeLabel:'Loại tour', tpPrivateType:'Riêng (xe chuyên dụng)', tpGroupType:'Nhóm (đi chung)',
      tpNext:'Tiếp →',
      tpTravelersLabel:'Số người', tpDateLabel:'Ngày tour',
      tpRegionLabel:'Điểm đón', tpBayArea:'Bay Area (San Jose / SF)', tpSoCal:'SoCal (LA / SD) +15%',
      tpQuoteLabel:'Báo giá',
      tpNameLabel:'Họ tên', tpNamePh:'Họ và tên đầy đủ',
      tpPhoneLabel:'Điện thoại', tpPhonePh:'+1 (408) 555-0100',
      tpConfirm:'Xác Nhận Đặt Tour',
      tpSuccessTitle:'Đặt Tour Thành Công!',
      tpSuccessSub:'Chúng tôi sẽ gọi cho bạn trong 2 giờ để xác nhận.',
      tpSubtotal:'Tạm tính', tpTaxes:'Thuế (8.75%)', tpTotal:'Tổng cộng',
      tpVehicle:'Phương tiện', tpDuration:'Thời gian',
      tpDay:'ngày', tpDays:'ngày',
    },
    es: {
      tpFromLabel:'Desde', tpPerPersonLabel:'por persona (grupo)',
      tpPrivateLabel:'Privado desde',
      tpHighlightsHead:'Puntos Destacados', tpItineraryHead:'Itinerario', tpVideoHead:'Vista Previa',
      tpGroupPrice:'Grupo desde', tpBookNow:'Reservar Ahora',
      tpTypeLabel:'Tipo de tour', tpPrivateType:'Privado (vehículo exclusivo)', tpGroupType:'Grupo (viaje compartido)',
      tpNext:'Siguiente →',
      tpTravelersLabel:'Viajeros', tpDateLabel:'Fecha del tour',
      tpRegionLabel:'Región de salida', tpBayArea:'Bay Area (San Jose / SF)', tpSoCal:'SoCal (LA / SD) +15%',
      tpQuoteLabel:'Tu cotización',
      tpNameLabel:'Tu nombre', tpNamePh:'Nombre completo',
      tpPhoneLabel:'Teléfono', tpPhonePh:'+1 (408) 555-0100',
      tpConfirm:'Confirmar Reserva',
      tpSuccessTitle:'¡Reserva Confirmada!',
      tpSuccessSub:'Te llamaremos en 2 horas para confirmar los detalles.',
      tpSubtotal:'Subtotal', tpTaxes:'Impuestos (8.75%)', tpTotal:'Total',
      tpVehicle:'Vehículo', tpDuration:'Duración',
      tpDay:'día', tpDays:'días',
    },
  };

  // ── Module state ──────────────────────────────────────────────
  var _db, _lang, _pkg, _type, _travelers, _date, _region, _quote;

  function t(key) {
    var s = STRINGS[_lang] || STRINGS.en;
    return s[key] || STRINGS.en[key] || key;
  }

  // ── Booking ID generator (same algorithm as script.js) ───────
  function generateBookingId() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var id = 'TRV-';
    var arr = new Uint8Array(6);
    crypto.getRandomValues(arr);
    for (var i = 0; i < arr.length; i++) id += chars[arr[i] % chars.length];
    return id;
  }

  // ── Apply i18n to elements with data-i18n / data-i18n-ph ─────
  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      var k = el.dataset.i18n;
      if (t(k) !== k) el.textContent = t(k);
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function(el) {
      var k = el.dataset.i18nPh;
      if (t(k) !== k) el.placeholder = t(k);
    });
  }

  // ── Render package into page ──────────────────────────────────
  function renderPackage(pkg) {
    _pkg = pkg;
    var langKey = _lang === 'vi' ? 'name_vi' : (_lang === 'es' ? 'name_es' : 'name');
    var name = pkg[langKey] || pkg.name;

    document.title = name + ' · Du Lich Cali';
    var nameEl = document.getElementById('tpPkgName');
    if (nameEl) nameEl.textContent = name;

    var durEl = document.getElementById('tpDurationBadge');
    if (durEl) durEl.textContent = pkg.duration_days + ' ' + (pkg.duration_days === 1 ? t('tpDay') : t('tpDays'));

    var heroImg = document.getElementById('tpHeroImg');
    if (heroImg && pkg.images && pkg.images[0]) {
      heroImg.src = pkg.images[0];
      heroImg.alt = name;
    }

    // Price bar
    var gpEl = document.getElementById('tpGroupPrice');
    var ppEl = document.getElementById('tpPrivatePrice');
    if (gpEl) gpEl.textContent = '$' + pkg.base_price_per_person_group;
    if (ppEl) ppEl.textContent = '$' + pkg.base_price_private;

    // Panel price
    var panelEl = document.getElementById('tpPanelPrice');
    if (panelEl) panelEl.textContent = '$' + pkg.base_price_per_person_group + '/person';

    // Wizard type prices
    var tpp = document.getElementById('tpTypePrivatePrice');
    var tpg = document.getElementById('tpTypeGroupPrice');
    if (tpp) tpp.textContent = '$' + pkg.base_price_private;
    if (tpg) tpg.textContent = '$' + pkg.base_price_per_person_group + '/person';

    // Highlights
    var hlList = document.getElementById('tpHighlightsList');
    if (hlList) {
      hlList.innerHTML = '';
      (pkg.highlights || []).forEach(function(h) {
        var li = document.createElement('li');
        li.textContent = h[_lang] || h.en;
        hlList.appendChild(li);
      });
    }

    // Itinerary
    var itinEl = document.getElementById('tpItinerary');
    if (itinEl) {
      itinEl.innerHTML = '';
      (pkg.itinerary || []).forEach(function(item) {
        var div = document.createElement('div');
        div.className = 'tp-itin-item';
        div.innerHTML = '<span class="tp-itin-time">' + item.time + '</span>' +
                        '<span class="tp-itin-desc">' + (item[_lang] || item.en) + '</span>';
        itinEl.appendChild(div);
      });
    }

    // YouTube embed (if already stored)
    if (pkg.youtubeId) {
      loadTravelVideo(pkg.youtubeId);
    }
  }

  // ── Load travel video (YouTube embed) ────────────────────────
  function loadTravelVideo(youtubeId) {
    var section = document.getElementById('tpVideoSection');
    var wrap = document.getElementById('tpVideoWrap');
    if (!section || !wrap) return;
    section.style.display = 'block';

    var src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(youtubeId) +
              '?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1';
    var iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.allow = 'autoplay; encrypted-media';
    iframe.allowFullscreen = true;
    iframe.setAttribute('loading', 'lazy');
    wrap.appendChild(iframe);
  }

  // ── Wizard steps ─────────────────────────────────────────────
  function showStep(n) {
    for (var i = 1; i <= 4; i++) {
      var el = document.getElementById('tpStep' + i);
      if (el) el.classList.toggle('tp-wizard__step--active', i === n);
    }
  }

  function openWizard() {
    var w = document.getElementById('tpWizard');
    if (w) w.classList.add('tp-wizard--open');
    showStep(1);
    _type     = 'private';
    _travelers = 2;
    _region   = 'bayarea';
    setTravelersDisplay(2);
  }

  function closeWizard() {
    var w = document.getElementById('tpWizard');
    if (w) w.classList.remove('tp-wizard--open');
  }

  function setTravelersDisplay(n) {
    var el = document.getElementById('tpTravelersVal');
    if (el) el.textContent = n;
  }

  function renderQuote() {
    if (!window.DLCPricing || !_pkg) return;
    _quote = DLCPricing.calculateTravelQuote(_pkg, _type, _travelers, _region);
    var rows = document.getElementById('tpQuoteRows');
    if (!rows) return;

    var html = '';
    if (_type === 'group') {
      html += '<div class="tp-quote-row"><span>' + t('tpGroupType') + ' ×' + _travelers + '</span>' +
              '<span>$' + _quote.pricePerPerson + '/person</span></div>';
    }
    html += '<div class="tp-quote-row"><span>' + t('tpSubtotal') + '</span><span>$' + _quote.subtotal + '</span></div>';
    html += '<div class="tp-quote-row"><span>' + t('tpTaxes') + '</span><span>$' + _quote.taxes + '</span></div>';
    html += '<div class="tp-quote-row tp-quote-row--total"><span>' + t('tpTotal') + '</span><span>$' + _quote.total + '</span></div>';
    html += '<div class="tp-quote-row"><span>' + t('tpVehicle') + '</span><span>' + _quote.vehicle + '</span></div>';
    rows.innerHTML = html;
  }

  // ── Submit booking to Firestore ───────────────────────────────
  async function submitTravelBooking() {
    var nameEl  = document.getElementById('tpCustName');
    var phoneEl = document.getElementById('tpCustPhone');
    var name    = nameEl ? nameEl.value.trim() : '';
    var phone   = phoneEl ? phoneEl.value.trim() : '';

    if (!name || !phone) {
      alert(t('tpNameLabel') + ' & ' + t('tpPhoneLabel') + ' required');
      return;
    }

    var btn = document.getElementById('tpConfirmBtn');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }

    var bookingId = generateBookingId();

    try {
      await _db.collection('travel_bookings').doc(bookingId).set({
        bookingId:   bookingId,
        packageId:   _pkg.id,
        packageName: _pkg.name,
        type:        _type,
        travelers:   _travelers,
        date:        _date || '',
        region:      _region,
        customer: {
          name:  name,
          phone: phone,
        },
        vehicle:   _quote ? _quote.vehicle : '',
        total:     _quote ? _quote.total : 0,
        subtotal:  _quote ? _quote.subtotal : 0,
        taxes:     _quote ? _quote.taxes : 0,
        status:    'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      var idEl = document.getElementById('tpSuccessId');
      if (idEl) idEl.textContent = 'Booking ID: ' + bookingId;
      showStep(4);
    } catch (err) {
      console.error('[TravelBooking] submit error', err);
      alert('Booking failed. Please call (408) 916-3439.');
      if (btn) { btn.disabled = false; btn.textContent = t('tpConfirm'); }
    }
  }

  // ── Init ──────────────────────────────────────────────────────
  function init(opts) {
    _db   = opts.db;
    _lang = opts.lang || 'en';

    applyI18n();

    // Read ?pkg= from URL
    var params = new URLSearchParams(window.location.search);
    var slug   = params.get('pkg');

    // Try Firestore first, fall back to local DLC_TRAVEL_PACKAGES
    if (slug) {
      _db.collection('travel_packages').doc(slug).get()
        .then(function(doc) {
          var pkg = doc.exists ? doc.data() : null;
          if (!pkg) {
            // Fallback to local static data
            pkg = (DLC_TRAVEL_PACKAGES || []).find(function(p) { return p.slug === slug || p.id === slug; }) || null;
          }
          if (pkg) renderPackage(pkg);
          else {
            document.getElementById('tpPkgName').textContent = 'Package not found';
          }
        })
        .catch(function() {
          // Firestore unavailable — use local data
          var pkg = (DLC_TRAVEL_PACKAGES || []).find(function(p) { return p.slug === slug || p.id === slug; }) || null;
          if (pkg) renderPackage(pkg);
        });
    } else {
      // Default: first package
      var pkg = (DLC_TRAVEL_PACKAGES || [])[0];
      if (pkg) renderPackage(pkg);
    }

    // Set minimum date to tomorrow
    var tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    var minDate = tomorrow.toISOString().split('T')[0];
    var dateInput = document.getElementById('tpDateInput');
    if (dateInput) dateInput.min = minDate;

    // ── Event listeners ───────────────────────────────────────
    var openBtn = document.getElementById('tpOpenWizardBtn');
    if (openBtn) openBtn.addEventListener('click', openWizard);

    // Close on backdrop click
    var wizard = document.getElementById('tpWizard');
    if (wizard) wizard.addEventListener('click', function(e) {
      if (e.target === wizard) closeWizard();
    });

    // Step 1: type selection
    document.querySelectorAll('[data-type]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        _type = btn.dataset.type;
        document.querySelectorAll('[data-type]').forEach(function(b) {
          b.classList.toggle('tp-opt-btn--selected', b === btn);
        });
      });
    });

    var step1Next = document.getElementById('tpStep1Next');
    if (step1Next) step1Next.addEventListener('click', function() { showStep(2); });

    // Step 2: travelers
    var decBtn = document.getElementById('tpDecBtn');
    var incBtn = document.getElementById('tpIncBtn');
    if (decBtn) decBtn.addEventListener('click', function() {
      _travelers = Math.max(1, _travelers - 1);
      setTravelersDisplay(_travelers);
    });
    if (incBtn) incBtn.addEventListener('click', function() {
      var maxPax = (_pkg && _pkg.max_group) ? _pkg.max_group : 12;
      _travelers = Math.min(maxPax, _travelers + 1);
      setTravelersDisplay(_travelers);
    });

    var dateInput2 = document.getElementById('tpDateInput');
    if (dateInput2) dateInput2.addEventListener('change', function() { _date = this.value; });

    // Region selection
    document.querySelectorAll('[data-region]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        _region = btn.dataset.region;
        document.querySelectorAll('[data-region]').forEach(function(b) {
          b.classList.toggle('tp-opt-btn--selected', b === btn);
        });
      });
    });

    var step2Next = document.getElementById('tpStep2Next');
    if (step2Next) step2Next.addEventListener('click', function() {
      renderQuote();
      showStep(3);
    });

    // Step 3: confirm
    var confirmBtn = document.getElementById('tpConfirmBtn');
    if (confirmBtn) confirmBtn.addEventListener('click', submitTravelBooking);
  }

  return { init: init };

})();
```

- [ ] **Step 2: Commit**

```bash
git add travel-booking.js
git commit -m "feat: add travel-booking.js wizard module (4-step, Firestore write)"
```

---

## Task 8: Add Package Cards to tour.html

Link from the existing tour landing page to the new package detail pages.

**Files:**
- Modify: `tour.html` (after the destination highlight cards section)

- [ ] **Step 1: Read tour.html destination section**

```bash
grep -n "dest-highlights\|lp-cta\|lp-ai\|Book" /Users/johntd/Documents/claude-projects/ai_dulich_cali/DuLichCali/tour.html
```

Find the line where the destination highlight cards end and the AI block begins.

- [ ] **Step 2: Insert travel package cards between destinations and the AI block**

After the destinations section closing `</div>` and before the `<div class="lp-ai">` block, insert:

```html
<!-- ── Travel Packages ────────────────────────────────── -->
<section style="padding: 1.5rem 1rem 0;">
  <h2 style="font-family:var(--font-d);font-size:1.3rem;font-weight:400;color:var(--cream);margin:0 0 .85rem;">
    Coastal Tour Packages
  </h2>
  <div style="display:flex;flex-direction:column;gap:.75rem;">
    <a href="/travel.html?pkg=big_sur_monterey_1_day" class="dest-card-lp">
      <div class="dest-card-lp__img"><img src="/monterey.jpg" alt="Big Sur & Monterey" loading="lazy"></div>
      <div class="dest-card-lp__body">
        <span class="dest-card-lp__name">Big Sur &amp; Monterey — 1 Day</span>
        <span class="dest-card-lp__sub">McWay Falls · Bixby Bridge · Monterey Bay Aquarium</span>
        <span class="dest-card-lp__price">From $89/person · Private $299</span>
      </div>
    </a>
    <a href="/travel.html?pkg=highway_1_classic_2_day" class="dest-card-lp">
      <div class="dest-card-lp__img"><img src="/santabarbara.jpg" alt="Highway 1 Classic" loading="lazy"></div>
      <div class="dest-card-lp__body">
        <span class="dest-card-lp__name">Highway 1 Classic — 2 Days</span>
        <span class="dest-card-lp__sub">Hearst Castle · Elephant Seals · Full coastal drive</span>
        <span class="dest-card-lp__price">From $169/person · Private $599</span>
      </div>
    </a>
    <a href="/travel.html?pkg=coastal_premium_3_day" class="dest-card-lp">
      <div class="dest-card-lp__img"><img src="/santabarbara.jpg" alt="Coastal Premium" loading="lazy"></div>
      <div class="dest-card-lp__body">
        <span class="dest-card-lp__name">Coastal Premium — 3 Days</span>
        <span class="dest-card-lp__sub">Santa Barbara wine · Malibu PCH · Getty Villa</span>
        <span class="dest-card-lp__price">From $349/person · Private $1,199</span>
      </div>
    </a>
  </div>
</section>
```

- [ ] **Step 3: Test on mobile (375px)**

Open `http://localhost:8080/tour.html` in browser dev tools at 375px width. Verify all 3 cards render correctly with images, names, prices.

- [ ] **Step 4: Test travel.html**

Open `http://localhost:8080/travel.html?pkg=big_sur_monterey_1_day` — verify:
- Hero image loads, package name shows
- Highlights and itinerary render
- "Book Now" button opens the wizard
- Wizard step 1 shows type options with correct prices
- Step 2 shows traveler counter, date picker, region picker
- Step 3 shows quote breakdown
- Step 4 (on submit) shows success state

- [ ] **Step 5: Commit**

```bash
git add tour.html
git commit -m "feat: add travel package cards to tour.html landing page"
```

---

## Task 9: Remotion TravelPromo — 5-Scene Video Template

**Files:**
- Create: `remotion-promo/src/TravelPromo/schema.ts`
- Create: `remotion-promo/src/TravelPromo/TravelPromo.tsx`
- Modify: `remotion-promo/src/Root.tsx`

- [ ] **Step 1: Create schema.ts**

```typescript
// remotion-promo/src/TravelPromo/schema.ts
import { z } from 'zod';

export const TravelPromoSchema = z.object({
  packageName:   z.string().default('Big Sur & Monterey — 1 Day'),
  tagline:       z.string().default('California Coastal Experience'),
  durationDays:  z.number().default(1),
  priceGroup:    z.string().default('$89/person'),
  pricePrivate:  z.string().default('$299 private'),
  highlights:    z.array(z.string()).default([
    'McWay Falls viewpoint',
    'Bixby Creek Bridge',
    'Monterey Bay Aquarium',
  ]),
  itinerary: z.array(z.object({
    time: z.string(),
    desc: z.string(),
  })).default([
    { time: '7:00 AM',  desc: 'Depart San Jose' },
    { time: '9:30 AM',  desc: 'Bixby Bridge & Big Sur' },
    { time: '1:00 PM',  desc: 'Carmel lunch' },
    { time: '2:30 PM',  desc: 'Monterey Aquarium' },
    { time: '5:00 PM',  desc: 'Return' },
  ]),
  heroImageUrl:  z.string().default(''),   // absolute path to image in public/
  accentColor:   z.string().default('#d4af37'),
  phone:         z.string().default('(408) 916-3439'),
  website:       z.string().default('dulichcali21.com/travel'),
  ctaText:       z.string().default('Book Now'),
});

export type TravelPromoProps = z.infer<typeof TravelPromoSchema>;
```

- [ ] **Step 2: Create TravelPromo.tsx**

```tsx
// remotion-promo/src/TravelPromo/TravelPromo.tsx
// 5 scenes @ 30fps — total 600 frames = 20 seconds, 1920×1080
// Scene 1 (0–90):    Hero — package name, duration, price
// Scene 2 (90–210):  Highlights — 3 bullet points fade in
// Scene 3 (210–360): Itinerary — scrolling timeline cards
// Scene 4 (360–480): Pricing — private vs group comparison
// Scene 5 (480–600): CTA — "Book Now", phone, website

import React from 'react';
import {
  AbsoluteFill, Audio, Img, Sequence, interpolate,
  spring, useCurrentFrame, useVideoConfig,
} from 'remotion';
import { TravelPromoSchema } from './schema';

const NAVY   = '#0a2344';
const NAVY2  = '#0e2c54';
const CREAM  = '#f5f0e8';
const MUTED  = 'rgba(245,240,232,0.65)';

const fadeIn = (frame: number, start: number, dur: number) =>
  interpolate(frame, [start, start + dur], [0, 1], { extrapolateRight: 'clamp' });

const slideUp = (frame: number, start: number, dur: number) =>
  interpolate(frame, [start, start + dur], [24, 0], { extrapolateRight: 'clamp' });

export const TravelPromo: React.FC<TravelPromoSchema['_type']> = (props) => {
  const { durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const accent = props.accentColor || '#d4af37';

  const textStyle: React.CSSProperties = {
    fontFamily: "'Jost', 'Inter', sans-serif",
    color: CREAM,
  };

  return (
    <AbsoluteFill style={{ background: NAVY }}>
      {/* ── Scene 1: Hero (0–90) ── */}
      <Sequence from={0} durationInFrames={90}>
        <AbsoluteFill style={{ ...textStyle }}>
          {props.heroImageUrl && (
            <Img
              src={props.heroImageUrl}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
                       objectFit: 'cover', opacity: 0.4 }}
            />
          )}
          <div style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(to bottom, rgba(10,35,68,0.3), rgba(10,35,68,0.85))`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '80px',
          }}>
            <div style={{
              fontSize: 28, letterSpacing: '0.12em', color: accent,
              textTransform: 'uppercase', marginBottom: 20,
              opacity: fadeIn(frame, 5, 20),
            }}>
              Du Lich Cali
            </div>
            <div style={{
              fontFamily: "'Bodoni Moda', 'Georgia', serif",
              fontSize: 72, fontWeight: 400, color: CREAM,
              textAlign: 'center', lineHeight: 1.15,
              opacity: fadeIn(frame, 15, 25),
              transform: `translateY(${slideUp(frame, 15, 25)}px)`,
            }}>
              {props.packageName}
            </div>
            <div style={{
              fontSize: 32, color: MUTED, marginTop: 24, textAlign: 'center',
              opacity: fadeIn(frame, 35, 20),
            }}>
              {props.tagline}
            </div>
            <div style={{
              marginTop: 40, display: 'flex', gap: 48, alignItems: 'center',
              opacity: fadeIn(frame, 50, 20),
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: accent }}>{props.priceGroup}</div>
                <div style={{ fontSize: 22, color: MUTED }}>per person</div>
              </div>
              <div style={{ width: 2, height: 60, background: accent, opacity: 0.5 }}></div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: accent }}>{props.pricePrivate}</div>
                <div style={{ fontSize: 22, color: MUTED }}>exclusive</div>
              </div>
            </div>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* ── Scene 2: Highlights (90–210) ── */}
      <Sequence from={90} durationInFrames={120}>
        <AbsoluteFill style={{ ...textStyle, background: NAVY2,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px 100px' }}>
          <div style={{
            fontFamily: "'Bodoni Moda', serif",
            fontSize: 52, fontWeight: 400, color: CREAM, marginBottom: 48,
            opacity: fadeIn(frame - 90, 0, 15),
          }}>
            Highlights
          </div>
          {(props.highlights || []).slice(0, 3).map((h, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 28,
              marginBottom: 36,
              opacity: fadeIn(frame - 90, 20 + i * 18, 20),
              transform: `translateX(${interpolate(frame - 90, [20 + i * 18, 40 + i * 18], [-30, 0], { extrapolateRight: 'clamp' })}px)`,
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: accent, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 26, flexShrink: 0,
              }}>✓</div>
              <div style={{ fontSize: 38, color: CREAM, lineHeight: 1.3 }}>{h}</div>
            </div>
          ))}
        </AbsoluteFill>
      </Sequence>

      {/* ── Scene 3: Itinerary (210–360) ── */}
      <Sequence from={210} durationInFrames={150}>
        <AbsoluteFill style={{ ...textStyle, background: NAVY,
          display: 'flex', flexDirection: 'column', padding: '60px 80px', overflow: 'hidden' }}>
          <div style={{
            fontFamily: "'Bodoni Moda', serif",
            fontSize: 52, color: CREAM, marginBottom: 36,
            opacity: fadeIn(frame - 210, 0, 15),
          }}>
            Your Day
          </div>
          {(props.itinerary || []).slice(0, 5).map((item, i) => (
            <div key={i} style={{
              display: 'flex', gap: 32, alignItems: 'flex-start',
              marginBottom: 28,
              opacity: fadeIn(frame - 210, 15 + i * 14, 18),
              transform: `translateX(${interpolate(frame - 210, [15 + i * 14, 33 + i * 14], [-20, 0], { extrapolateRight: 'clamp' })}px)`,
            }}>
              <div style={{
                fontSize: 24, color: accent, fontWeight: 700,
                minWidth: 120, paddingTop: 4,
              }}>{item.time}</div>
              <div style={{ width: 2, background: accent, alignSelf: 'stretch', opacity: 0.4, flexShrink: 0 }}></div>
              <div style={{ fontSize: 32, color: CREAM, lineHeight: 1.4 }}>{item.desc}</div>
            </div>
          ))}
        </AbsoluteFill>
      </Sequence>

      {/* ── Scene 4: Pricing (360–480) ── */}
      <Sequence from={360} durationInFrames={120}>
        <AbsoluteFill style={{ ...textStyle, background: NAVY2,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '80px' }}>
          <div style={{
            fontFamily: "'Bodoni Moda', serif",
            fontSize: 52, color: CREAM, marginBottom: 56, textAlign: 'center',
            opacity: fadeIn(frame - 360, 0, 15),
          }}>
            Choose Your Experience
          </div>
          <div style={{ display: 'flex', gap: 48, width: '100%', maxWidth: 1100 }}>
            {/* Group card */}
            <div style={{
              flex: 1, background: 'rgba(255,255,255,0.06)',
              border: `2px solid rgba(255,255,255,0.15)`,
              borderRadius: 24, padding: '48px 40px',
              opacity: fadeIn(frame - 360, 20, 20),
              transform: `translateY(${slideUp(frame - 360, 20, 20)}px)`,
            }}>
              <div style={{ fontSize: 28, color: MUTED, marginBottom: 16 }}>Group</div>
              <div style={{ fontSize: 72, fontWeight: 700, color: accent, lineHeight: 1 }}>{props.priceGroup}</div>
              <div style={{ fontSize: 24, color: MUTED, marginTop: 12 }}>Join a shared group</div>
              <div style={{ marginTop: 24, fontSize: 22, color: CREAM }}>Min 4 · Max 12 travelers</div>
            </div>
            {/* Private card */}
            <div style={{
              flex: 1, background: `rgba(212,175,55,0.1)`,
              border: `2px solid ${accent}`,
              borderRadius: 24, padding: '48px 40px',
              opacity: fadeIn(frame - 360, 30, 20),
              transform: `translateY(${slideUp(frame - 360, 30, 20)}px)`,
            }}>
              <div style={{ fontSize: 28, color: MUTED, marginBottom: 16 }}>Private</div>
              <div style={{ fontSize: 72, fontWeight: 700, color: accent, lineHeight: 1 }}>{props.pricePrivate}</div>
              <div style={{ fontSize: 24, color: MUTED, marginTop: 12 }}>Exclusive vehicle</div>
              <div style={{ marginTop: 24, fontSize: 22, color: CREAM }}>All-inclusive · Bilingual guide</div>
            </div>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* ── Scene 5: CTA (480–600) ── */}
      <Sequence from={480} durationInFrames={120}>
        <AbsoluteFill style={{ ...textStyle, background: NAVY,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', textAlign: 'center', padding: '80px' }}>
          <div style={{
            fontSize: 36, letterSpacing: '0.1em', color: accent,
            textTransform: 'uppercase', marginBottom: 24,
            opacity: fadeIn(frame - 480, 5, 20),
          }}>Du Lich Cali</div>
          <div style={{
            fontFamily: "'Bodoni Moda', serif",
            fontSize: 96, fontWeight: 400, color: CREAM, lineHeight: 1.1, marginBottom: 32,
            opacity: fadeIn(frame - 480, 15, 25),
            transform: `translateY(${slideUp(frame - 480, 15, 25)}px)`,
          }}>
            {props.ctaText}
          </div>
          <div style={{
            fontSize: 52, color: accent, fontWeight: 700, marginBottom: 16,
            opacity: fadeIn(frame - 480, 35, 20),
          }}>{props.phone}</div>
          <div style={{
            fontSize: 36, color: MUTED,
            opacity: fadeIn(frame - 480, 45, 20),
          }}>{props.website}</div>
          {/* Animated underline */}
          <div style={{
            marginTop: 48, height: 4, background: accent, borderRadius: 2,
            width: interpolate(frame - 480, [55, 90], [0, 600], { extrapolateRight: 'clamp' }),
          }}></div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: Register in Root.tsx**

In `remotion-promo/src/Root.tsx`, add import and composition:

```tsx
// Add to existing imports:
import { TravelPromo } from "./TravelPromo/TravelPromo";
import { TravelPromoSchema } from "./TravelPromo/schema";
```

Inside `RemotionRoot`, add after the last `<Composition>`:

```tsx
<Composition
  id="TravelPromo"
  component={TravelPromo}
  durationInFrames={600}
  fps={30}
  width={1920}
  height={1080}
  schema={TravelPromoSchema}
  defaultProps={{
    packageName:  'Big Sur & Monterey — 1 Day',
    tagline:      'California Coastal Experience',
    durationDays: 1,
    priceGroup:   '$89/person',
    pricePrivate: '$299 private',
    highlights: [
      'McWay Falls viewpoint at sunset',
      'Bixby Creek Bridge photo stop',
      'Monterey Bay Aquarium',
    ],
    itinerary: [
      { time: '7:00 AM',  desc: 'Depart San Jose — Hwy 101' },
      { time: '9:30 AM',  desc: 'Bixby Bridge & Big Sur coast' },
      { time: '1:00 PM',  desc: 'Lunch in Carmel-by-the-Sea' },
      { time: '2:30 PM',  desc: 'Monterey Bay Aquarium' },
      { time: '5:00 PM',  desc: 'Return to San Jose' },
    ],
    heroImageUrl:  '',
    accentColor:  '#d4af37',
    phone:        '(408) 916-3439',
    website:      'dulichcali21.com/travel',
    ctaText:      'Book Now',
  }}
/>
```

- [ ] **Step 4: Verify Remotion build compiles**

```bash
cd /Users/johntd/Documents/claude-projects/ai_dulich_cali/DuLichCali/remotion-promo
npm run build 2>&1 | tail -5
```

Expected: no TypeScript errors.

- [ ] **Step 5: Preview in Remotion Studio**

```bash
cd /Users/johntd/Documents/claude-projects/ai_dulich_cali/DuLichCali/remotion-promo
npx remotion studio
```

Open browser → select `TravelPromo` → verify all 5 scenes render correctly.

- [ ] **Step 6: Commit**

```bash
cd /Users/johntd/Documents/claude-projects/ai_dulich_cali/DuLichCali/remotion-promo
git add src/TravelPromo src/Root.tsx
git commit -m "feat: add TravelPromo Remotion composition (5 scenes, 1920x1080)"
```

---

## Task 10: generate-travel-promo.js — Render + YouTube Upload

**Files:**
- Create: `remotion-promo/generate-travel-promo.js`

**Prerequisites (one-time setup):**
1. Enable YouTube Data API v3 in Google Cloud Console for project `dulichcali-booking-calendar`
2. Create OAuth2 credentials (Desktop app) → download `client_secret.json` → save to `remotion-promo/client_secret.json`
3. `cd remotion-promo && npm install googleapis`
4. First run will open browser for OAuth consent — this generates `token.json`

- [ ] **Step 1: Create generate-travel-promo.js**

```javascript
#!/usr/bin/env node
/**
 * generate-travel-promo.js
 * ─────────────────────────
 * Render a TravelPromo video, upload to YouTube, and update Firestore.
 *
 * Usage:
 *   node generate-travel-promo.js --pkg big_sur_monterey_1_day
 *   node generate-travel-promo.js --pkg highway_1_classic_2_day [--no-youtube]
 *
 * Flags:
 *   --pkg <id>        Package slug from DLC_TRAVEL_PACKAGES (required)
 *   --image <path>    Hero image path (copied into public/)
 *   --no-youtube      Skip YouTube upload — just render the MP4
 *   --no-firestore    Skip Firestore update
 *   --help
 *
 * Output: out/<pkg-id>.mp4
 * YouTube: uploaded to DuLichCali channel as unlisted
 * Firestore: travel_packages/<pkg-id>.youtubeId = <id>
 */
'use strict';

const { execSync }  = require('child_process');
const fs            = require('fs');
const path          = require('path');
const { google }    = require('googleapis');
const admin         = require('firebase-admin');

const SCRIPT_DIR  = __dirname;
const PUBLIC_DIR  = path.join(SCRIPT_DIR, 'public');
const OUT_DIR     = path.join(SCRIPT_DIR, 'out');
const TOKEN_FILE  = path.join(SCRIPT_DIR, 'token.json');
const SECRET_FILE = path.join(SCRIPT_DIR, 'client_secret.json');

const args = process.argv.slice(2);
function flag(name) { const i = args.indexOf(name); return i !== -1 && args[i+1] ? args[i+1] : null; }
function hasFlag(name) { return args.includes(name); }

if (hasFlag('--help')) {
  console.log('Usage: node generate-travel-promo.js --pkg <packageId> [--image <path>] [--no-youtube] [--no-firestore]');
  process.exit(0);
}

const pkgId    = flag('--pkg');
const imagePath = flag('--image');
const skipYT   = hasFlag('--no-youtube');
const skipFS   = hasFlag('--no-firestore');

if (!pkgId) { console.error('--pkg <id> required'); process.exit(1); }

// Load package data
const { DLC_TRAVEL_PACKAGES } = require('../travel-packages.js');
const pkg = DLC_TRAVEL_PACKAGES.find(function(p) { return p.id === pkgId || p.slug === pkgId; });
if (!pkg) { console.error('Package not found: ' + pkgId); process.exit(1); }

// Ensure directories exist
fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR,    { recursive: true });

// Copy hero image to public/
var heroPublicPath = '';
if (imagePath) {
  var ext  = path.extname(imagePath) || '.jpg';
  var dest = path.join(PUBLIC_DIR, pkgId + '-hero' + ext);
  fs.copyFileSync(path.resolve(imagePath), dest);
  heroPublicPath = './' + pkgId + '-hero' + ext;
  console.log('Copied hero image → ' + dest);
}

// Build Remotion props
var remProps = {
  packageName:  pkg.name,
  tagline:      'California Coastal Experience · Du Lich Cali',
  durationDays: pkg.duration_days,
  priceGroup:   '$' + pkg.base_price_per_person_group + '/person',
  pricePrivate: '$' + pkg.base_price_private + ' private',
  highlights:   (pkg.highlights || []).map(function(h) { return h.en; }),
  itinerary:    (pkg.itinerary  || []).slice(0, 5).map(function(item) {
    return { time: item.time, desc: item.en };
  }),
  heroImageUrl: heroPublicPath,
  accentColor: '#d4af37',
  phone:       '(408) 916-3439',
  website:     'dulichcali21.com/travel',
  ctaText:     'Book Now',
};

var outPath  = path.join(OUT_DIR, pkgId + '.mp4');
var propsStr = JSON.stringify(remProps);

// ─── Render ───────────────────────────────────────────────────
console.log('Rendering TravelPromo for: ' + pkg.name + ' ...');
var renderCmd = 'npx remotion render TravelPromo ' +
  '--output=' + outPath + ' ' +
  '--props=\'' + propsStr.replace(/'/g, "'\\''") + '\'';
execSync(renderCmd, { cwd: SCRIPT_DIR, stdio: 'inherit' });
console.log('Rendered → ' + outPath);

if (skipYT) { console.log('--no-youtube: skipping upload'); process.exit(0); }

// ─── YouTube upload ───────────────────────────────────────────
async function uploadToYouTube() {
  if (!fs.existsSync(SECRET_FILE)) {
    console.error('client_secret.json not found at: ' + SECRET_FILE);
    console.error('Download OAuth2 Desktop credentials from Google Cloud Console.');
    process.exit(1);
  }

  var secret = JSON.parse(fs.readFileSync(SECRET_FILE));
  var { client_id, client_secret, redirect_uris } = secret.installed || secret.web;

  var oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  if (fs.existsSync(TOKEN_FILE)) {
    oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_FILE)));
  } else {
    // First-time OAuth flow
    var authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/youtube.upload'],
    });
    console.log('Open this URL to authorize YouTube access:\n' + authUrl);
    var readline = require('readline');
    var rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    var code = await new Promise(function(res) { rl.question('Enter auth code: ', function(c) { rl.close(); res(c.trim()); }); });
    var tokenRes = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokenRes.tokens);
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokenRes.tokens));
    console.log('Token saved to ' + TOKEN_FILE);
  }

  var youtube = google.youtube({ version: 'v3', auth: oAuth2Client });

  console.log('Uploading to YouTube...');
  var uploadRes = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title:       pkg.name + ' — California Tour · Du Lich Cali',
        description: 'Book at dulichcali21.com/travel?pkg=' + pkg.id +
                     '\n\nCall: (408) 916-3439' +
                     '\n\n' + (pkg.highlights || []).map(function(h) { return '• ' + h.en; }).join('\n'),
        tags:        ['California tour', 'coastal tour', 'vietnamese tour', pkg.name, 'Du Lich Cali'],
        categoryId:  '19',  // Travel & Events
      },
      status: {
        privacyStatus: 'unlisted',  // change to 'public' when ready
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: fs.createReadStream(outPath),
    },
  });

  var youtubeId = uploadRes.data.id;
  console.log('YouTube upload complete: https://www.youtube.com/watch?v=' + youtubeId);

  if (!skipFS) {
    // Update Firestore
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId:  'dulichcali-booking-calendar',
    });
    var db = admin.firestore();
    await db.collection('travel_packages').doc(pkgId).update({
      youtubeId: youtubeId,
      videoUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('Firestore travel_packages/' + pkgId + '.youtubeId updated.');
  }

  return youtubeId;
}

uploadToYouTube().catch(function(err) {
  console.error('Upload failed:', err.message || err);
  process.exit(1);
});
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x /Users/johntd/Documents/claude-projects/ai_dulich_cali/DuLichCali/remotion-promo/generate-travel-promo.js
```

- [ ] **Step 3: Test render (no upload)**

```bash
cd /Users/johntd/Documents/claude-projects/ai_dulich_cali/DuLichCali/remotion-promo
node generate-travel-promo.js --pkg big_sur_monterey_1_day --no-youtube
```

Expected: `out/big_sur_monterey_1_day.mp4` created (~5-15MB).

- [ ] **Step 4: Commit**

```bash
git add remotion-promo/generate-travel-promo.js
git commit -m "feat: add generate-travel-promo.js (render + YouTube upload + Firestore update)"
```

---

## Task 11: AI Guided Flow — travel.plan in aiOrchestrator.js

**Files:**
- Modify: `aiOrchestrator.js`

When a user asks the AI "plan a trip to Big Sur for 4 people", the AI should return structured data that the UI can use to auto-open `travel.html` with the right package.

- [ ] **Step 1: Read the defTravelPlan function**

```bash
grep -n "defTravelPlan\|travel\.plan\|travel\.estimate" /Users/johntd/Documents/claude-projects/ai_dulich_cali/DuLichCali/aiOrchestrator.js
```

Note the line numbers of `defTravelPlan` and its `system` prompt.

- [ ] **Step 2: Update defTravelPlan system prompt**

Find the `defTravelPlan` function. Replace the `system:` string with:

```javascript
system: `You are a travel advisor for Du Lịch Cali.
Our packages:
- big_sur_monterey_1_day: Big Sur & Monterey, 1 day, from $89/person (group) or $299 private
- highway_1_classic_2_day: Highway 1 Classic, 2 days, from $169/person (group) or $599 private
- coastal_premium_3_day: Coastal Premium, 3 days, from $349/person (group) or $1199 private

When the user describes a trip, respond with JSON:
{
  "recommended_package": "<slug>",
  "type": "group|private",
  "travelers": <number>,
  "reason": "<1 sentence why this package fits>",
  "redirect_url": "/travel.html?pkg=<slug>"
}

If you cannot match a package, set recommended_package to null and redirect_url to "/tour.html".
Always respond in the user's language.`,
```

- [ ] **Step 3: Read aiOrchestrator.js around line 234 (case 'travel.plan')**

```bash
sed -n '230,260p' /Users/johntd/Documents/claude-projects/ai_dulich_cali/DuLichCali/aiOrchestrator.js
```

- [ ] **Step 4: Update the travel.plan case to pass through redirect_url**

In the `case 'travel.plan':` handler, ensure the result JSON is returned as-is so the client UI can read `result.redirect_url` and navigate to it. If the current handler strips the JSON, adjust it to return the raw parsed response.

The client-side code in `chat.js` or the main chat handler should check:
```javascript
if (result && result.redirect_url) {
  // Show a "View Package" button
  appendMessage('assistant',
    result.reason + ' <a href="' + result.redirect_url + '" class="btn btn--gold" style="display:inline-block;margin-top:.5rem;padding:.4rem .9rem;border-radius:8px;text-decoration:none;font-size:.82rem;">View Package →</a>',
    { html: true }
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add aiOrchestrator.js
git commit -m "feat: update defTravelPlan to return booking-ready redirect_url"
```

---

## Task 12: Final Deploy + Production Verify

- [ ] **Step 1: Local smoke test — all key pages**

```bash
# Start local server
cd /Users/johntd/Documents/claude-projects/ai_dulich_cali/DuLichCali
python3 -m http.server 8080
```

Open in browser at 375px (mobile) width:
1. `http://localhost:8080/tour.html` → verify 3 travel package cards appear
2. `http://localhost:8080/travel.html?pkg=big_sur_monterey_1_day` → verify hero, highlights, itinerary
3. Click "Book Now" → verify wizard opens, all 4 steps work, step 3 shows quote with taxes
4. Submit with test name/phone → verify step 4 shows success + booking ID
5. `http://localhost:8080/travel.html?pkg=highway_1_classic_2_day` → verify different package loads
6. Check Firestore console → `travel_bookings` collection → verify the test booking was written

- [ ] **Step 2: Check for any missed ?v= version bumps**

```bash
# Verify all edited JS files have bumped versions in all HTML files
grep -rn "pricing.js\|script.js\|travel" /Users/johntd/Documents/claude-projects/ai_dulich_cali/DuLichCali --include="*.html" | grep "v=2024\|v=20260[0-9]"
```

If any version strings are not yet bumped, bump them now.

- [ ] **Step 3: Git status check**

```bash
cd /Users/johntd/Documents/claude-projects/ai_dulich_cali/DuLichCali
git status
git diff --stat
```

Verify all changes are committed. If any uncommitted files, commit them now.

- [ ] **Step 4: Deploy to Firebase Hosting**

```bash
cd /Users/johntd/Documents/claude-projects/ai_dulich_cali/DuLichCali
firebase deploy --only hosting
```

Expected output:
```
✔  Deploy complete!
Hosting URL: https://dulichcali-booking-calendar.web.app
```

- [ ] **Step 5: Verify production**

```bash
# Check travel.html is live
curl -s "https://www.dulichcali21.com/travel.html" | grep "tp-hero\|TravelBooking" | head -3

# Check tour.html has the new package cards
curl -s "https://www.dulichcali21.com/tour.html" | grep "big_sur\|Coastal Tour" | head -3

# Check travel-booking.js is deployed
curl -Is "https://www.dulichcali21.com/travel-booking.js" | grep "HTTP\|content-type"
```

Expected: all three return matching content.

- [ ] **Step 6: Push to GitHub**

```bash
git push origin main
```

- [ ] **Final confirmation**

```
✔ Production domain updated — https://www.dulichcali21.com
```

---

## Self-Review Checklist

**Spec coverage:**
- Phase 2 (Firestore model): Task 1 adds rules; Task 3 seeds the data — ✓
- Phase 3 (seed 3 packages): Task 2 (static data) + Task 3 (Firestore seed) — ✓
- Phase 4 (calculateTravelQuote): Task 4 — ✓
- Phase 5 (vehicle/driver selection): Task 5 — ✓
- Phase 6 (full booking flow): Task 7 (travel-booking.js) + Task 6 (travel.html) — ✓
- Phase 7 (package page): Task 6 (travel.html) + Task 8 (tour.html cards) — ✓
- Phase 8 (Remotion template): Task 9 — ✓
- Phase 9 (YouTube upload): Task 10 — ✓
- Phase 10 (YouTube embed): Task 7 `loadTravelVideo()` in travel-booking.js — ✓
- Phase 11 (testing): Task 12 Step 1 smoke test — ✓
- Phase 12 (AI guided flow): Task 11 — ✓

**Placeholder scan:** No TBDs, no "implement later", no vague steps — all code included.

**Type consistency:**
- `DLCPricing.calculateTravelQuote(pkg, type, travelers, region)` defined in Task 4, called in `travel-booking.js` Task 7 — consistent.
- `TravelPromoSchema` defined in Task 9 Step 1, used in `Root.tsx` Task 9 Step 3 — consistent.
- Firestore collection name `travel_bookings` used in Task 1 (rules), Task 7 (write), Task 5 (conflict check) — consistent.
- `generateBookingId()` in `travel-booking.js` generates `TRV-XXXXXX` prefix (distinct from `DLC-XXXXXX` in script.js) — intentional, no conflict.
