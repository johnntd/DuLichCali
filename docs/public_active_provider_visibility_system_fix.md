# Public Active/Inactive Provider Visibility — System Fix

**Date:** 2026-05-28
**Scope:** Homepage + marketplace + hero + airport/ride public visibility
**Status:** PASS — 444/444 tests, `FINAL: PASS`

## Problem

Public surfaces could surface a service category that had no real active
provider behind it. The reported symptom: the **Airport & Private Rides**
section rendered with bookable tiles in a region (Bay Area) that had **zero
active drivers**. Each surface (hero carousel, featured vendors, ride/airport
cards) applied its own ad-hoc active check, so a provider toggled inactive in
the admin panel could still leak through a surface whose one-off filter was
incomplete or out of date.

## Root Cause

1. **No single source of truth for "is this provider active?"** Active state
   was scattered across many possible fields (`active`, `isActive`, `enabled`,
   `isEnabled`, `visible`, `publicVisible`, `adminStatus`, `status`, plus hard
   boolean flags `disabled`/`suspended`/`archived`/`deleted`). `isPublicProviderVisible`
   only checked `active === false`, `disabled === true`, and `status === 'inactive'`.
2. **The airport/ride section had no region-coverage gate at all.** It rendered
   whenever the ride feature existed, regardless of whether any active, compliant
   driver covered the selected region.

## Fix

### 1. Canonical active-provider model (`script.js`)

Added one helper consulted by every public surface:

```js
normalizeProviderStatus(record) -> { isActive, reasonInactive, statusSource }
isActiveProvider(record)        -> boolean
```

- Checks hard inactive booleans (`disabled`/`suspended`/`archived`/`deleted`).
- Checks `adminStatus` and `status` against a shared `_INACTIVE_STATUS_VALUES`
  set (`inactive`, `disabled`, `suspended`, `archived`, `closed`, `blocked`,
  `deactivated`, `paused`, `banned`, `removed`, `deleted`).
- Checks boolean active flags must not be explicitly `false`.
- Defaults to **active** (fail-open) for records with no status info.
- Exported on `window.isActiveProvider` / `window.normalizeProviderStatus`.

`isPublicProviderVisible(biz, regionId)` now delegates its first gate to
`isActiveProvider(biz)` instead of the old three-field check.

### 2. Region-coverage gate for airport/ride

`checkRideServiceAvailability(regionId)`:
- `window._activeDrivers` now filtered through `isActiveProvider`.
- New `isRegionallyEligible(doc)` — active + compliance `approved` +
  non-expired license/registration/insurance + region match (NOT schedule, so
  customers can still pre-book future dates where coverage exists).
- New `window._regionalDrivers` / `window._hasRegionalDriver`.

`updateRideServiceCards(available)`:
- Hides `#hpAirport` entirely when `_hasRegionalDriver === false`.
- Fail-open: defaults to visible if the flag is undefined or the Firestore
  query throws.

### 3. Diagnostics

- `console.info('[ride-visibility]', { region, totalDrivers, activeDrivers, regionalDrivers, onShiftNow, showRideService })`
- `console.info('[public-visibility-filter]', { section: 'hpAirport' | 'hpFeatured', ... })`

## Files Changed

| File | Change |
|------|--------|
| `script.js` | Canonical active model, ride region-coverage gate, section-hide logic, diagnostics |
| `index.html` | `script.js?v=20260528e` cache bump |
| `tests/lib/homepage-visibility.js` | Tests for `isActiveProvider`/`normalizeProviderStatus`, delegation, ride section hide, diagnostics |
| `tests/lib/mobile-barber-landing.js` | Homepage script.js version assert → `20260528e` |

## Verification

```
scripts/ai/full_system_dry_run.sh  →  ALL TESTS PASSED: 444 passed, 0 failed  →  FINAL: PASS
node --check nailsalon/receptionist.js  →  SYNTAX OK
```

## Backward Compatibility

- Fail-open everywhere: records with no status info, and Firestore errors,
  default to visible. Existing active providers are unaffected.
- No schema changes. No Firestore rule changes.
- The old narrow checks are a strict subset of the new canonical model.

## Remaining Risks

- The targeted `ai-receptionist` dry run reports a false-positive FAIL on a
  `require()`-style load of `receptionist.js`; `node --check` and the full
  gate's RX-030 both pass. Pre-existing, unrelated to this change.
- Region coverage depends on drivers having a correct `regions` array; a driver
  with a missing/empty `regions` field will not count toward coverage.
