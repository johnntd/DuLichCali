# Unified Owner Multi-Service Dashboard Architecture

**Date:** 2026-05-28
**Phase delivered:** Phase 1 — ownerId data model + owner dashboard shell + business switcher
**Status:** PASS — one owner login can manage multiple service businesses cleanly, backward compatible
**Gate:** `scripts/ai/full_system_dry_run.sh` → `ALL TESTS PASSED: 459 passed, 0 failed` → `FINAL: PASS`

---

## Goal

Move from **1 login = 1 vendor** to **1 owner account = multiple businesses/services**.
Example: Michael Nguyen owns a Mobile Barber business, an Airport/Ride business, and a
Tours business — and manages all of them from one dashboard with a business switcher,
without separate logins.

This is an **internal architecture layer**. Customers still see separate services
(Mobile Barber, Ride, Tours). Nothing customer-facing is merged.

---

## What shipped in Phase 1

| Deliverable | File | Notes |
|---|---|---|
| Owner model (source of truth) | `owner-model.js` (new) | Owner registry + owner→businesses mapping + backward-compatible helpers. UMD: works in browser (`window.OwnerModel`) and node (tests). |
| `ownerId` on vendor model | `mobile-barber/mobile-barber-data.js` | Added optional `ownerId` + `serviceType` to `VENDOR_FIELDS`; mapped sample vendors (`michael-nguyen-oc`→`michael-nguyen`, `tim-nguyen-bay`→`tim-nguyen`). |
| Owner dashboard shell | `owner-dashboard.html` (new) | Premium navy/gold shell, business switcher, per-business panel + grid, full vi/en/es i18n, mobile-first + 768/1200 breakpoints. |
| Tests | `tests/lib/owner-account-model.js` (new) + `tests/runner.js` | 15 tests (OWN-01…OWN-15): owner-model behavior, isolation, backward compat, dashboard structure, i18n, responsiveness. |

---

## Data model

### Owner

```
OWNERS['michael-nguyen'] = {
  id, displayName, email, emails[], phone, defaultLang, homeRegion
}
```

`emails[]` lists every login email that should resolve to this owner (owner's
personal email plus business emails) so the dashboard can greet the right owner
in Phase 1 without a new auth system.

### Business (owner → businesses)

```
BUSINESSES = [{
  id, ownerId, serviceType ('barber'|'ride'|'tour'),
  providerId,        // links to the underlying provider record (e.g. a
                     // mobileBarberVendors doc) when one exists; null otherwise
  name, region,
  status ('active'|'coming_soon'),
  dashboardUrl, customerUrl
}]
```

Seeded:

| Business | Owner | Type | Status | Provider record |
|---|---|---|---|---|
| Michael Mobile Barber OC | michael-nguyen | barber | active | `michael-nguyen-oc` |
| Michael Airport & Rides OC | michael-nguyen | ride | coming_soon | — |
| Michael Private Tours OC | michael-nguyen | tour | coming_soon | — |
| Tim Mobile Barber Bay Area | tim-nguyen | barber | active | `tim-nguyen-bay` |

### Vendor record (additive)

`ownerId` and `serviceType` are **optional** fields on the vendor doc. Existing
Firestore docs without them still work — see Backward Compatibility.

---

## Helper API (`owner-model.js`)

| Function | Purpose |
|---|---|
| `listOwners()` | All owner objects |
| `findOwner(ownerId)` | Owner object or null |
| `businessesForOwner(ownerId, serviceType?)` | Owner's businesses, optionally filtered by type |
| `findBusiness(businessId)` | Business object or null |
| `ownerForBusiness(businessId)` | ownerId for a business id, or null |
| `resolveOwnerId(record)` | **Backward-compatible** owner resolution: explicit `record.ownerId` → mapping by id/vendorId/providerId → null |
| `ownerForEmail(email)` | Resolve owner from login email (case-insensitive) |
| `ownerHasMultipleBusinesses(ownerId)` | Drives whether the switcher renders |

---

## Owner dashboard shell (`owner-dashboard.html`)

- **Owner resolution (Phase 1, no new auth):** `?owner=<id>` param → `?email=`/stored
  `dlc_vendor_email` via `ownerForEmail` → `localStorage('dlc_owner_id')` → first owner.
- **Business switcher:** top-nav dropdown, shown only when the owner has >1 business.
  Selecting a business updates the current panel, persists to
  `localStorage('dlc_owner_business')`, and updates the grid highlight.
- **Current business panel:** name, service-type chip, region, status chip, and two
  actions — *Open dashboard* (deep-links to the existing per-business portal) and
  *View customer page*. `coming_soon` businesses show disabled actions.
- **Businesses grid:** all owner businesses with service-type icon, type, region, status.
- **i18n:** every string in vi/en/es via a `LABELS` table; lang persists to
  `localStorage('dlc_lang')`. No hardcoded single-language strings.
- **Responsive:** mobile-first base, `@media(min-width:768px)` (2-col grid),
  `@media(min-width:1200px)` (3-col); `prefers-reduced-motion` respected; 44px+ touch
  targets; inline SVG icons (no emoji).

The shell **deep-links** into existing dashboards rather than reimplementing their
panels — that keeps Phase 1 small and the existing portals untouched.

---

## Permission model

| Role | Scope |
|---|---|
| Owner | Manages all businesses mapped to their `ownerId` (`businessesForOwner` returns only their own). |
| Staff / vendor / driver | Unchanged — keeps using existing per-business portals via existing auth. |

Isolation is enforced by `businessesForOwner` / `ownerForBusiness` filtering strictly
by `ownerId`. Test OWN-03 asserts Tim never sees Michael's businesses.

Future-ready for employees/drivers/barbers/assistants: add them as records carrying an
`ownerId` and extend the role check; no model change needed.

---

## Backward compatibility

- `ownerId` / `serviceType` are **optional** vendor fields. Legacy Firestore docs
  without them resolve via `resolveOwnerId()`'s static-mapping fallback
  (`{id:'michael-nguyen-oc'}` → `michael-nguyen`). Unknown records → `null`, preserving
  legacy single-vendor behavior (test OWN-07).
- Existing vendor/driver/salon portals and their auth flows are **not modified**.
- No Firestore schema migration is required to deploy Phase 1; the owner→business map
  lives in `owner-model.js`. Writing `ownerId` onto live docs is an additive,
  non-breaking follow-up.
- No customer-facing surface changed. No booking, AI, or voice path touched.

## Migration plan (forward)

1. **Now (Phase 1):** static owner→business map in `owner-model.js`; vendor seeds carry
   `ownerId`.
2. **Backfill (non-breaking):** write `ownerId` onto live `mobileBarberVendors` (and
   future `drivers`/tour) docs. `resolveOwnerId` already prefers the explicit field.
3. **Owner auth (later):** map Firebase Auth user → ownerId (e.g. an `owners/{uid}` doc
   or `ownerId` on the existing vendor user record) so the dashboard reads the owner
   from auth instead of the `?owner=` param.

---

## Future phases (not in this delivery)

| Phase | Scope |
|---|---|
| Phase 2 | Unified notification inbox aggregating per-business notifications |
| Phase 3 | Shared owner calendar with travel buffers + overlap prevention across service types |
| Phase 4 | Shared customer CRM (phone/address/language/preferences reused across the owner's services) |

---

## Tests

`tests/lib/owner-account-model.js`, group **"Unified Owner Account Model (Phase 1)"**:

- OWN-01 registry + helpers present
- OWN-02 Michael owns barber + ride + tour; switcher should show
- OWN-03 Tim sees only Tim businesses (no cross-owner leak)
- OWN-04 filter by service type
- OWN-05 ownerForBusiness mapping
- OWN-06 resolveOwnerId honors explicit ownerId
- OWN-07 resolveOwnerId fallback for legacy records; unknown → null
- OWN-08 ownerForEmail case-insensitive
- OWN-09 VENDOR_FIELDS has ownerId + serviceType
- OWN-10 sample vendors mapped to owners; agrees with owner-model
- OWN-11 dashboard exists + loads owner-model
- OWN-12 switcher + grid + persistence
- OWN-13 vi/en/es labels for every key
- OWN-14 responsive breakpoints + reduced-motion
- OWN-15 deep-links, does not replace existing portals

---

## Verification

```
scripts/ai/full_system_dry_run.sh   →  ALL TESTS PASSED: 459 passed, 0 failed  →  FINAL: PASS
node -e require('./owner-model.js')  →  michael: barber,ride,tour | tim: 1
curl localhost/owner-dashboard.html  →  200
curl localhost/owner-model.js        →  200
```

**Not verified in this environment:** pixel-level browser rendering of
`owner-dashboard.html` (no headless browser/jsdom available here). Structure, i18n
tables, responsive breakpoints, and module logic are verified; a visual pass on
mobile (375px) + desktop (1280px) at `www.dulichcali21.com/owner-dashboard.html` is
recommended after deploy.

---

## Verdict

**PASS** — one owner login (`/owner-dashboard.html?owner=michael-nguyen`) cleanly lists
and switches between multiple service businesses (barber + ride + tour), with strict
per-owner isolation and full backward compatibility. Phases 2–4 (notifications,
calendar, CRM) are scoped above and not yet implemented.
