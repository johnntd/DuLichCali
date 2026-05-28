# Homepage Initial Active-Provider Filter Fix

**Status:** Shipped to production (`https://www.dulichcali21.com`)
**Date:** 2026-05-28

## Bug

On first load of the homepage, inactive vendors and services were visible. The hero carousel rotated through category slides whose underlying vendor pool was empty. Filtering only "started working" after the user manually changed the location.

## Root Cause

Three stacked bugs:

### 1. Render race — admin-status cache empty on first paint

`loadVendorAdminStatuses()` was fire-and-forget at the bottom of the DOMContentLoaded handler. `DLCRegion.init()` fires its callback **immediately** with the default region, which triggers `renderHomepageVendors()` — at which point `window._vendorAdminStatus` is still empty.

`_isVendorActive(id)` defaults to `true` on cache miss:

```javascript
function _isVendorActive(vendorId) {
  const s = window._vendorAdminStatus[vendorId];
  return !s || s === 'active'; // ← empty cache returns true for everyone
}
```

So the static-fallback path (`MARKETPLACE.businesses.filter(b => ... && _isVendorActive(b.id))`) lets every static vendor through on first paint. Once the cache populated in the background, the next region change re-rendered with the full cache — which exactly matches the user's observation ("filtering only happens after I change location").

### 2. Hero carousel slides hardcoded in HTML

`index.html` ships four hero slides as static markup: Airport (1), Food (2), Hair (3), Nails (4). The carousel rotates them on a timer regardless of whether the underlying category has any active vendor. Result: even with zero active hair salons, the "Hair Color · Professional Styling" slide still appears and clicks lead to an empty marketplace.

### 3. Marketplace region cards never checked underlying provider pool

`HOMEPAGE_MARKETPLACE_ENTRIES` (the "Mobile Barber — Orange County" / "Mobile Barber — Bay Area" routing cards) carry hardcoded `active: true`. The gate `_isVendorActive('mobile-barber-oc')` returns `true` because no Firestore vendor doc has that ID, so the cache miss defaults to active. These cards always rendered, even when every real barber (`michael-nguyen-oc`, `tim-nguyen-bay`) was inactive.

## Fix

### 1. Boot order — `loadVendorAdminStatuses` runs first and returns a Promise

```javascript
// script.js, DOMContentLoaded handler
loadVendorAdminStatuses();        // ← moved ABOVE DLCRegion.init
if (window.DLCRegion) DLCRegion.init(...);
```

`loadVendorAdminStatuses()` now:
- stores its in-flight promise on `window._vendorAdminCacheReady`
- captures `category` and `region` per vendor in `window._vendorAdminMeta` so the hero carousel can answer "any active vendor in this category/region?"

`renderHomepageVendors()` awaits the cache before assembling vendors:

```javascript
if (window._vendorAdminCacheReady && typeof window._vendorAdminCacheReady.then === 'function') {
  try { await window._vendorAdminCacheReady; } catch (_) {}
}
```

### 2. Canonical filter — `isPublicProviderVisible(biz, regionId)`

Single source of truth for every homepage surface. Rules in one place:

```javascript
function isPublicProviderVisible(biz, regionId) {
  if (!biz) return false;
  if (biz.active === false || biz.disabled === true) return false;
  if (biz.status && String(biz.status).toLowerCase() === 'inactive') return false;
  if (biz.id && !_isVendorActive(biz.id)) return false;            // ← Firestore-cached adminStatus
  if (regionId) { /* region or featuredRegions must match */ }
  if (biz._homepageMarketplaceEntry === true) return true;          // ← always-available routing cards
  if (biz.availabilityStatus && biz.availabilityStatus !== 'closed') return true;
  if (computeBizAvailability(biz)?.status === 'closed') return false;
  return true;
}
```

Exported on `window.isPublicProviderVisible`. The previous `_filterPubliclyVisibleVendors(vendors, regionId)` is now a one-liner that delegates to it.

### 3. Hero carousel — data-driven

Slides 2, 3, 4 in `index.html` tagged with `data-hc-category="food|hair|nails"`. New `applyHeroSlideVisibility(regionId)`:

```javascript
allSlides.forEach((slide, idx) => {
  const cat = slide.getAttribute('data-hc-category');
  if (!cat) { slide.hidden = false; return; }      // Airport slide always shows
  const visible = _hasActiveVendorInCategory(cat, regionId);
  slide.hidden = !visible;
  if (allDots[idx]) allDots[idx].hidden = !visible;
});
HeroCarousel.refresh();
```

`HeroCarousel` rewritten to re-query visible slides on every cycle (`visibleSlides()`, `visibleDots()`, new `refresh()` method). When zero or one slide is visible, auto-rotation is suppressed.

Called from:
- `renderHomepageVendors` after the filter runs (covers first paint + region changes)
- DOMContentLoaded → after `window._vendorAdminCacheReady` resolves (covers carousels that initialize before the first render)
- `DLCRegion.init` callback → after cache ready (covers region-change re-renders)

### 4. Marketplace entries — gated on real providers

```javascript
HOMEPAGE_MARKETPLACE_ENTRIES.forEach(entry => {
  if (!entry.active || !entry.homepageActive || !_isVendorActive(entry.id)) return;
  if (regionId && !(entry.featuredRegions || []).includes(regionId)) return;
  const targetRegion = (entry.featuredRegions || [])[0] || regionId || null;
  if (!_hasActiveVendorInCategory(entry.category, targetRegion)) return;  // ← NEW
  const tagged = Object.assign({}, entry, { _homepageMarketplaceEntry: true });
  ...
});
```

`_hasActiveVendorInCategory(category, regionId)`:
- Pass 1 — Firestore-derived cache (`_vendorAdminMeta`) when populated
- Pass 2 — `MARKETPLACE.businesses` static fallback when cache empty

So the Mobile Barber OC card never shows if every barber serving OC is inactive in Firestore.

### 5. Ride/driver cards — already correct

`checkRideServiceAvailability` already filters by `adminStatus === 'active'` + compliance + region + schedule, so the existing code path was already honoring active state. No change needed.

## Files Changed

| File | Change |
|------|--------|
| `script.js` | `loadVendorAdminStatuses` returns Promise + captures category/region; `isPublicProviderVisible` + `_hasActiveVendorInCategory` added; `_filterPubliclyVisibleVendors` delegates; `_withHomepageMarketplaceEntries` gates on real providers; `applyHeroSlideVisibility` added; `HeroCarousel` rewritten to honor `hidden` slides; boot order fixed |
| `index.html` | `data-hc-category` tags on slides 2-4; cache-bust `script.js?v=20260528a` |
| `tests/lib/homepage-visibility.js` | Extended from 9 to 15 pinning tests covering all four root causes |
| `tests/lib/mobile-barber-landing.js` | Updated script.js version assert |
| `tests/runner.js` | Wired `homepage-visibility` into the main runner |

## Tests

`tests/lib/homepage-visibility.js` — **15 tests, all PASS**:

| # | Test |
|---|------|
| 1 | Homepage filter helper exists in script.js |
| 2 | Canonical `isPublicProviderVisible` is the single source of truth (`_filterPubliclyVisibleVendors` delegates to it) |
| 3 | `isPublicProviderVisible` covers all inactive cases (5 branches) |
| 4 | Region-aware filter — vendor region or featuredRegions must match |
| 5 | Firestore admin-cache load returns a Promise and is awaited before first render |
| 6 | Boot order: admin cache load fires before `DLCRegion.init` |
| 7 | Vendor admin cache stores category + region (drives `_hasActiveVendorInCategory`) |
| 8 | `HOMEPAGE_MARKETPLACE_ENTRIES` gated on real active provider in region |
| 9 | Hero carousel slides 2-4 carry `data-hc-category` for active filtering |
| 10 | `applyHeroSlideVisibility` hides inactive-category slides |
| 11 | `HeroCarousel` re-syncs to visible slides after filter runs |
| 12 | Empty list hides the entire section instead of "Coming soon" |
| 13 | Firestore vendor docs preserve the active flag (not hardcoded `true`) |
| 14 | Hard active-check skips vendors before they enter the list |
| 15 | Region-scoped Mobile Barber entries still set `availabilityStatus: "now"` |

Plus the previously orphaned suite is now wired into `tests/runner.js`.

Full system gate: **`FINAL: PASS` — 407 passed, 0 failed**.

## Cache-Bust

`script.js` bumped from `?v=20260527m` → `?v=20260528a` in `index.html`. Test version-assert updated to match.

## What Does NOT Change

- Inactive records remain in Firestore — nothing deleted.
- Admin / vendor / driver portals still show inactive records (those screens read by ID with no filter; they're for management).
- The four-step admin → vendor onboarding workflow is untouched.
- Compliance gates on drivers are untouched.
- Booking, promotion, AI chat, voice, AI hairstyle flows are untouched.

## Manual Smoke Test (Production)

1. Hard-refresh `https://www.dulichcali21.com` in a private window (no session storage).
2. Open DevTools → Application → Local Storage / Session Storage → confirm no region preference is set.
3. Page renders. Featured marketplace cards show ONLY currently-open active vendors. Inactive vendors do not appear.
4. Hero carousel rotates only through categories that have at least one active vendor. If, e.g., all hair salons are toggled off in admin, the "Hair Color" slide is hidden and the carousel rotates through Airport / Food / Nails.
5. Open `admin.html`, toggle a vendor's `adminStatus` to `blocked`. Reload the homepage — that vendor is gone from the marketplace section. Reload `admin.html` — the vendor is still listed (admin can manage it).
6. In `admin.html` block every barber for OC. Reload homepage with OC region → the "Mobile Barber — Orange County" routing card no longer renders.
7. Change region via the picker — the homepage re-filters live, but the result on first load now matches what was previously only visible after the change.

## Why This Was Missed Originally

The 9 homepage-visibility tests shipped on 2026-05-27 covered the filter logic itself (`_filterPubliclyVisibleVendors`) but didn't pin:
- The boot-order requirement (cache must load before first render)
- The hero carousel filter (carousel was treated as a separate, unrelated subsystem)
- The marketplace-entry gating (the hardcoded `active: true` on routing cards never made it into the test contract)

The new 15-test suite covers all three so a future regression — anyone re-introducing the race, removing the `data-hc-category` tags, or simplifying `_withHomepageMarketplaceEntries` back to "always show" — will fail the gate.

## Remaining Risks

- `_hasActiveVendorInCategory` falls open (returns `true`) only via Pass 2 (static `MARKETPLACE`) when the Firestore cache is empty AND the static catalog has a matching active entry. This is intentional so a Firestore outage doesn't blank the homepage — but it does mean if admin toggles every static vendor `homepageActive: false`, the cache miss + static fall-open is still gated by `active: true` on the static entry. To fully blank the static catalog, both flags must be removed from `services-data.js`.
- The carousel `refresh()` re-binds `current` to the visible-slide range. If admin flips a category off mid-rotation (e.g. via another tab and the customer's tab gets a re-render), the active slide jumps to slide 0. Acceptable for the rare mid-session admin toggle.
