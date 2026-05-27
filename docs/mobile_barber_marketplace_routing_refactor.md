# Mobile Barber — Marketplace Routing Refactor

**Date:** 2026-05-27
**Status:** ✅ Shipped to production (`https://www.dulichcali21.com/mobile-barber`)
**Implementer:** Claude (direct, after `ai_dev_loop.sh` codex implementer stalled on a network reconnect mid-edit)

---

## Goal

Move the Mobile Barber customer experience from "browse two barber landing pages and pick one" to a single **marketplace** where the AI engine auto-routes every booking to the right vendor. Vendor admin/dashboard portals stay 100% unchanged. Vendor customer pages at `/mobile-barber/vendor/<id>` remain alive for SEO / direct-ads / debugging but are removed from every customer-navigation path.

---

## Before / after customer flow

### Before

```
www.dulichcali21.com (homepage)
        ↓
"Michael Mobile Barber OC" card  →  /mobile-barber/vendor/michael-nguyen-oc
"Tim Mobile Barber Bay Area" card →  /mobile-barber/vendor/tim-nguyen-bay
        ↓
Customer is locked to a single barber's page before any address check.
        ↓
Booking against that specific vendor (even if out of area).
```

Failure mode: customer in San Jose lands on Michael's page (no homepage region filter at first paint), gets refused on service-area, leaves.

### After

```
www.dulichcali21.com (homepage)
        ↓
"Mobile Barber — Orange County" card  →  /mobile-barber?region=oc
"Mobile Barber — Bay Area" card       →  /mobile-barber?region=bayarea
(or direct visit / QR / ad to /mobile-barber)
        ↓
Marketplace landing (/mobile-barber)
        ↓
Find My Barber gate (city OR ZIP)
        ↓
BOOKING.findVendorForAddress() resolves vendor by ZIP / city / serviceArea
        ↓
state.routedVendor pinned; on-page AI assistant takes over
        ↓
AI agent collects phone / customer / service / date / time
        ↓
Booking created under the routed vendor's id
        ↓
Customer confirmation: "Your barber is Michael / Tim"
```

The customer never lands on a per-barber page through navigation. The barber name is revealed at booking-confirmation time, not before.

---

## Routing examples (worked)

| Inputs | Resolved vendor | Mechanism |
|---|---|---|
| San Jose / 95121 / kids haircut / Vietnamese | **Tim** | `findVendorForAddress` ZIP→city match → Bay Area vendor |
| Garden Grove / fade haircut | **Michael** | city match → OC vendor |
| Westminster / classic mobile cut | **Michael** | city match → OC vendor |
| Santa Clara / beard trim / Vietnamese | **Tim** | city match → Bay Area vendor |
| Out of both vendors' service areas | **No vendor → waitlist** | `mobileBarberWaitlist` Firestore write + email capture |
| "I want Michael" + Westminster | **Michael** | preferredVendor() honors barberPreference when serviceArea covers ZIP |
| "I want Tim" + Santa Clara | **Tim** | same |
| Returning customer (`customers.lastVendorId`) | preferred match | `preferredVendor()` saved-location path uses `findVendorForAddress` against the saved gate location |

---

## Removed customer-facing links

| File | Old href | Replacement |
|---|---|---|
| `script.js:1705` | `https://www.dulichcali21.com/mobile-barber/vendor/michael-nguyen-oc` | `https://www.dulichcali21.com/mobile-barber?region=oc` |
| `script.js:1722` | `https://www.dulichcali21.com/mobile-barber/vendor/tim-nguyen-bay` | `https://www.dulichcali21.com/mobile-barber?region=bayarea` |
| `mobile-barber/mobile-barber.js:471` (was `routeByLocation`) | `root.location.href = vendorUrlForRoute(...)` | `state.routedVendor = vendor; openAssistantPanel('general')` |
| `mobile-barber/mobile-barber.js:1100` (was `renderVendors`) | `cta.href = '/mobile-barber/vendor/' + vendor.id` | Coverage-area cards with `cta.addEventListener('click', promptForLocation)` |
| `mobile-barber/mobile-barber.js:785` (was `vendorUrl`) | Returned `/mobile-barber/vendor/<id>?...` | Returns `#mbAssistantPanel` or `#mbLocationGate` anchor |

Also: `HOMEPAGE_MARKETPLACE_ENTRIES` card names dropped barber names — now `Mobile Barber — Orange County` and `Mobile Barber — Bay Area`.

---

## Preserved routes (SEO / debug)

`firebase.json` `rewrites` block unchanged: `/mobile-barber/vendor/**` still serves `mobile-barber/vendor.html`.

| URL | HTTP status | Notes |
|---|---|---|
| `https://www.dulichcali21.com/mobile-barber/vendor/michael-nguyen-oc` | `200` | Verified post-deploy. SEO + direct ad target preserved. |
| `https://www.dulichcali21.com/mobile-barber/vendor/tim-nguyen-bay` | `200` | Same. |
| `https://www.dulichcali21.com/mobile-barber` | `200` | Marketplace landing, new region deep-link supported. |

Auto-switch banner on vendor pages (`mobile-barber-vendor.js:1711`) is kept — it only triggers when a customer typing an address into the vendor-page booking form falls outside the current vendor's service area. That is intentional fallback behavior for direct/SEO landings; it never fires from the marketplace landing.

---

## Vendor portal verification (unchanged)

| Surface | URL | Status |
|---|---|---|
| Vendor login | `/vendor-login.html?id=michael-nguyen-oc` | unchanged (vendor-admin.html redirect intact) |
| Vendor dashboard | `/mobile-barber/dashboard.html?id=michael-nguyen-oc` | unchanged + compact list rows + 5 stat counters from prior commit |
| Realtime booking alerts | `subscribeBookingAlerts()` Firestore onSnapshot | unchanged; still scoped to `vendorId` |
| `publicLink.href` in dashboard | `/mobile-barber/vendor/<id>` | intentional internal "view my public page" shortcut for operators |

---

## Test results

```
$ node tests/lib/mobile-barber-data-model.js
Mobile Barber data model tests: 12 passed, 0 failed

$ node tests/lib/mobile-barber-agent.js
Mobile Barber agent tests: 29 passed, 0 failed

$ node -e "var t = require('./tests/lib/mobile-barber-landing'); ..."
PASS 35 / FAIL 0

$ scripts/ai/targeted_dry_run.sh booking
== Summary ==
  PASS: 8 | FAIL: 0 | SKIP: 0
FINAL: PASS

$ scripts/ai/full_system_dry_run.sh
FINAL: PASS
```

---

## Production deploy confirmation

```
$ firebase deploy --only hosting
✔  hosting[dulichcali-booking-calendar]: release complete
✔  Deploy complete!

$ curl -sL "https://www.dulichcali21.com/mobile-barber" | grep "v=20260527a"
  <link rel="stylesheet" href="/mobile-barber/mobile-barber.css?v=20260527a">
  <script src="/mobile-barber/mobile-barber.js?v=20260527a"></script>

$ curl -sL "https://www.dulichcali21.com/script.js" | grep "mobile-barber?region"
    href: 'https://www.dulichcali21.com/mobile-barber?region=oc',
    href: 'https://www.dulichcali21.com/mobile-barber?region=bayarea',

$ curl -sIL "https://www.dulichcali21.com/mobile-barber/vendor/michael-nguyen-oc"
HTTP/2 200
content-type: text/html; charset=utf-8
```

✔ Production domain updated — https://www.dulichcali21.com

---

## i18n keys added (en / vi / es)

- `vendorsKicker` repurposed: Barbers → Coverage / Khu vực / Cobertura
- `vendorsTitle` repurposed: Available profiles → Where we serve / Khu vực đang phục vụ / Áreas donde servimos
- `coverageCityListLabel` — "Cities served" / "Thành phố phục vụ" / "Ciudades atendidas"
- `coverageCta` — "Find My Barber" / "Tìm Thợ Cắt Tóc" / "Buscar Mi Barbero"
- `coverageRegionOC` — region card title for OC
- `coverageRegionBay` — region card title for Bay Area
- `regionGateBannerOC` / `regionGateBannerBay` — banner shown when `?region=` deep-link triggers
- `barberMatchedAnnounce` — short status announce after auto-routing succeeds

---

## Files changed

```
 mobile-barber/dashboard.html             |   2 +-  (css version bump)
 mobile-barber/index.html                 |   4 +-  (css + js version bump)
 mobile-barber/mobile-barber.css          |  39 ++++  (coverage card styles)
 mobile-barber/mobile-barber.js           | 198 ++++++++++++--  (routing rewrite + strings + init)
 mobile-barber/vendor.html                |   2 +-  (css version bump)
 script.js                                |  16 +-  (HOMEPAGE_MARKETPLACE_ENTRIES)
 tests/lib/mobile-barber-landing.js       |  20 +-  (assertions for new flow + version strings)
```

---

## Remaining risks

1. **`?region=` deep-link** scrolls to the gate + shows banner copy only; it does NOT auto-fill city/ZIP. If we want a true zero-friction OC-only or Bay-Area-only flow, we'd add a one-line prefill (`region=oc → city='Westminster'`) — deferred since it would presume a specific city the customer may not live in.
2. **Vendor-page direct landings still exist.** `/mobile-barber/vendor/<id>` is publicly reachable. Search engines, prior bookmarks, and the `publicLink.href` operator shortcut all still resolve. That is by design (SEO/ads), but it does mean a single customer could land on Michael's page directly and book there. The cross-vendor auto-switch banner on `mobile-barber-vendor.js:1711` mitigates the wrong-vendor case.
3. **`vendorUrlForRoute()` preserved.** The function body still exists in `mobile-barber.js` even though no customer path invokes it. Kept for SEO debug + future "view profile" CTA hook.
4. **Coverage cards aggregate from active vendors.** If a new vendor is added with `region: 'la'`, the landing will silently render an "LA coverage" card with no special copy. Adding a new region just needs a `coverageRegion<KEY>` translation key + (optional) a homepage entry in `script.js`.
5. **No master-detail desktop layout** for the vendor dashboard yet (deferred from the previous dashboard redesign brief).

---

## Next steps (if requested)

- Wire `?region=` to prefill the city input from a region-default city
- Add `vendor.metadata.featuredInRegion` so the coverage card's `cities` list can hide expansion cities until launch
- Hide `publicLink.href` from `dashboard.html` if operators don't actually use it
- Add a `noindex` meta to vendor.html if we want SEO to flow only to the marketplace landing
